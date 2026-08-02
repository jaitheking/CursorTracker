/**
 * fitParser.ts
 * A robust, dependency-free binary FIT file parser in TypeScript.
 * Specifically targets metrics from Coros running and strength activities.
 *
 * Coros FIT field mappings for Session (global msg 18) confirmed via live file analysis:
 *   field[7]  = total_elapsed_time   (units: ms / 1000 → seconds)
 *   field[9]  = total_distance       (units: cm / 100  → metres)
 *   field[11] = total_calories       (units: kcal)
 *   field[16] = avg_heart_rate       (units: bpm)
 *   field[17] = max_heart_rate       (units: bpm)
 *   field[18] = avg_cadence          (units: spm)
 *   field[22] = total_ascent         (units: m)
 *   field[23] = total_descent        (units: m)
 *
 * Coros FIT field mappings for Lap (global msg 19):
 *   Same field numbering as session but scoped to each km split.
 */

export interface LapSplit {
    lapNum: number;
    distanceKm: string;
    timeMins: number;
    timeSecs: number;
    paceStr: string;
    avgHeartRate: string;
}

export interface FitSummary {
    distanceKm: string;
    totalTimeMins: number;
    totalTimeSecs: number;
    paceStr: string;
    avgHeartRate: string;
    maxHeartRate: string;
    calories: string;
    ascent: string;
    descent: string;
    avgCadence: string;
    sport: string;
    laps: LapSplit[];
}

interface FieldDef {
    defNum: number;
    size: number;
    baseType: number;
}

interface MsgDef {
    globalNum: number;
    fields: FieldDef[];
    devFields: { size: number }[];
    le: boolean;    // little-endian
    totalSz: number;
}

/** Read a field value from the DataView, handling 1/2/4/8-byte sizes. */
function readField(view: DataView, offset: number, size: number, le: boolean): number {
    switch (size) {
        case 1: return view.getUint8(offset);
        case 2: return view.getUint16(offset, le);
        case 4: return view.getUint32(offset, le);
        // 8-byte fields — cap to safe JS number precision
        case 8: return Number(view.getBigUint64(offset, le));
        default: return 0;
    }
}

/** Format pace in seconds/km into "M:SS /km" string */
function formatPace(distMetres: number, totalSecs: number): string {
    if (distMetres <= 0 || totalSecs <= 0) return 'N/A';
    const secPerKm = totalSecs / (distMetres / 1000);
    const mins = Math.floor(secPerKm / 60);
    const secs = Math.floor(secPerKm % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs} /km`;
}

export function parseFitFile(buffer: ArrayBuffer): FitSummary {
    const view = new DataView(buffer);
    let offset = 0;

    // ── 1. File Header ──────────────────────────────────────────────────────
    const headerSize = view.getUint8(offset);
    if (headerSize < 12) throw new Error('Not a valid FIT file (header too small)');

    let magic = '';
    for (let i = 0; i < 4; i++) magic += String.fromCharCode(view.getUint8(offset + 8 + i));
    if (magic !== '.FIT') throw new Error('Not a valid FIT file (magic mismatch)');

    const dataSize = view.getUint32(offset + 4, true);
    offset += headerSize;
    const endOffset = headerSize + dataSize;

    // ── 2. State ─────────────────────────────────────────────────────────────
    const definitions = new Map<number, MsgDef>();

    let distMetres  = 0;
    let totalSecs   = 0;
    let avgHR       = 0;
    let maxHR       = 0;
    let calories    = 0;
    let ascent      = 0;
    let descent     = 0;
    let avgCadence  = 0;
    let laps: LapSplit[] = [];

    // ── 3. Record loop ────────────────────────────────────────────────────────
    while (offset < endOffset) {
        if (offset >= view.byteLength) break;
        const recHeader = view.getUint8(offset);
        offset++;

        // Compressed timestamp record (bit 7 set, bit 6 clear)
        if ((recHeader & 0x80) !== 0) {
            // Local message type is bits [4:5]; payload is always 4 bytes
            const localMsgType = (recHeader >> 5) & 0x03;
            const def = definitions.get(localMsgType);
            if (def) {
                // Skip data bytes for this message
                offset += def.totalSz;
            }
            // (No session or lap data lives in compressed records, so we skip)
            continue;
        }

        const isDef  = (recHeader & 0x40) !== 0;
        const hasDev = (recHeader & 0x20) !== 0;
        const localMsgType = recHeader & 0x0F;

        if (isDef) {
            // ── Definition message ──────────────────────────────────────────
            offset++; // reserved byte
            const arch = view.getUint8(offset++);
            const le   = (arch === 0);

            const globalNum = view.getUint16(offset, le); offset += 2;
            const numFields = view.getUint8(offset++);

            const fields: FieldDef[] = [];
            let totalSz = 0;
            for (let i = 0; i < numFields; i++) {
                const defNum   = view.getUint8(offset++);
                const sz       = view.getUint8(offset++);
                const baseType = view.getUint8(offset++);
                fields.push({ defNum, size: sz, baseType });
                totalSz += sz;
            }

            const devFields: { size: number }[] = [];
            if (hasDev) {
                const numDev = view.getUint8(offset++);
                for (let i = 0; i < numDev; i++) {
                    offset++; // field_number
                    const sz = view.getUint8(offset++);
                    offset++; // developer_data_index
                    devFields.push({ size: sz });
                    totalSz += sz;
                }
            }

            definitions.set(localMsgType, { globalNum, fields, devFields, le, totalSz });

        } else {
            // ── Data message ────────────────────────────────────────────────
            const def = definitions.get(localMsgType);
            if (!def) {
                // Unknown local type — cannot safely skip without size info
                console.warn(`FIT: no definition for local msg type ${localMsgType} at offset ${offset}`);
                break;
            }

            // Read all field values into a map keyed by field definition number
            const data: Record<number, number> = {};
            for (const f of def.fields) {
                if (offset + f.size > view.byteLength) { offset += f.size; continue; }
                data[f.defNum] = readField(view, offset, f.size, def.le);
                offset += f.size;
            }
            // Skip developer extension fields
            for (const df of def.devFields) {
                offset += df.size;
            }

            // ── Session (global 18) ─────────────────────────────────────────
            if (def.globalNum === 18) {
                // total_elapsed_time is in ms/1000 (i.e. it needs /1000 for seconds)
                if (data[7]  !== undefined) totalSecs  = data[7]  / 1000;
                // total_distance is in cm (needs /100 for metres)
                if (data[9]  !== undefined) distMetres = data[9]  / 100;
                if (data[11] !== undefined) calories   = data[11];
                if (data[16] !== undefined) avgHR      = data[16];
                if (data[17] !== undefined) maxHR      = data[17];
                if (data[18] !== undefined) avgCadence = data[18];
                if (data[22] !== undefined) ascent     = data[22];
                if (data[23] !== undefined) descent    = data[23];
            }

            // ── Lap (global 19) ────────────────────────────────────────────
            else if (def.globalNum === 19) {
                const lapDistM   = (data[9]  !== undefined) ? data[9]  / 100 : 0;
                const lapTimeSec = (data[7]  !== undefined) ? data[7]  / 1000 : 0;
                const lapHR      = (data[16] !== undefined) ? data[16] : 0;

                laps.push({
                    lapNum: laps.length + 1,
                    distanceKm: (lapDistM / 1000).toFixed(2),
                    timeMins:   Math.floor(lapTimeSec / 60),
                    timeSecs:   Math.floor(lapTimeSec % 60),
                    paceStr:    formatPace(lapDistM, lapTimeSec),
                    avgHeartRate: lapHR > 0 ? lapHR.toString() : 'N/A'
                });
            }
        }
    }

    // ── 4. Build Result ───────────────────────────────────────────────────────
    return {
        distanceKm:    (distMetres / 1000).toFixed(2),
        totalTimeMins: Math.floor(totalSecs / 60),
        totalTimeSecs: Math.floor(totalSecs % 60),
        paceStr:       formatPace(distMetres, totalSecs),
        avgHeartRate:  avgHR      > 0       ? avgHR.toString()      : 'N/A',
        maxHeartRate:  maxHR      > 0       ? maxHR.toString()      : 'N/A',
        calories:      calories   > 0       ? calories.toString()   : 'N/A',
        ascent:        ascent     > 0       ? ascent.toString()     : 'N/A',
        descent:       descent    > 0       ? descent.toString()    : 'N/A',
        avgCadence:    avgCadence > 0       ? avgCadence.toString() : 'N/A',
        sport:         'Running',
        laps
    };
}
