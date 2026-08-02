/**
 * fitParser.ts
 * A lightweight, dependency-free binary FIT file parser in TypeScript.
 * Specifically targets metrics useful for Coros running and strength activities.
 */

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
    trainingEffect: string;
    laps: any[];
}

export function parseFitFile(buffer: ArrayBuffer): FitSummary {
    const view = new DataView(buffer);
    let offset = 0;

    // 1. Read File Header
    const headerSize = view.getUint8(offset);
    if (headerSize !== 12 && headerSize !== 14) {
        throw new Error("Invalid FIT file header size");
    }

    const protocol = view.getUint8(offset + 1);
    const profileVersion = view.getUint16(offset + 2, true);
    const dataSize = view.getUint32(offset + 4, true);
    
    // Check ".FIT" magic string
    let magic = "";
    for (let i = 0; i < 4; i++) {
        magic += String.fromCharCode(view.getUint8(offset + 8 + i));
    }
    if (magic !== ".FIT") {
        throw new Error("Not a valid FIT file");
    }

    offset += headerSize;

    // We will extract data from the 'session' (18) and 'lap' (19) messages
    const summary: any = {
        distanceMeters: 0,
        totalTimeSeconds: 0,
        avgHeartRate: "N/A",
        maxHeartRate: "N/A",
        calories: "N/A",
        ascent: "N/A",
        descent: "N/A",
        avgCadence: "N/A",
        sport: "Running",
        trainingEffect: "N/A",
        laps: []
    };

    const definitions = new Map<number, any>();

    // End of file is headerSize + dataSize
    const endOffset = headerSize + dataSize;

    while (offset < endOffset) {
        const recordHeader = view.getUint8(offset);
        offset++;

        const isDefinition = (recordHeader & 0x40) !== 0;
        const localMessageType = recordHeader & 0x0F;

        if (isDefinition) {
            offset++; // reserved
            const architecture = view.getUint8(offset); // 0 = Little Endian, 1 = Big Endian
            const littleEndian = architecture === 0;
            offset++;

            const globalMessageNum = view.getUint16(offset, littleEndian);
            offset += 2;

            const numFields = view.getUint8(offset);
            offset++;

            const fields = [];
            let totalSize = 0;
            for (let i = 0; i < numFields; i++) {
                const defNum = view.getUint8(offset);
                const size = view.getUint8(offset + 1);
                const baseType = view.getUint8(offset + 2);
                fields.push({ defNum, size, baseType });
                totalSize += size;
                offset += 3;
            }

            definitions.set(localMessageType, { globalMessageNum, fields, littleEndian });
        } else {
            // Data message
            const def = definitions.get(localMessageType);
            if (!def) {
                console.warn(`Missing definition for local message type ${localMessageType}`);
                break;
            }

            const data: any = {};
            for (const field of def.fields) {
                if (offset + field.size > buffer.byteLength) break;
                
                // Read field data (simplified - just reading the raw bytes based on size for now)
                let value = 0;
                if (field.size === 1) value = view.getUint8(offset);
                else if (field.size === 2) value = view.getUint16(offset, def.littleEndian);
                else if (field.size === 4) value = view.getUint32(offset, def.littleEndian);
                
                data[field.defNum] = value;
                offset += field.size;
            }

            // Session Message (18)
            if (def.globalMessageNum === 18) {
                // Fields mapped to common FIT SDK definitions
                if (data[7] !== undefined) summary.totalTimeSeconds = data[7] / 1000;
                if (data[9] !== undefined) summary.distanceMeters = data[9] / 100;
                if (data[11] !== undefined) summary.calories = data[11];
                if (data[16] !== undefined) summary.avgHeartRate = data[16];
                if (data[17] !== undefined) summary.maxHeartRate = data[17];
                if (data[18] !== undefined) summary.avgCadence = data[18];
                if (data[22] !== undefined) summary.ascent = data[22];
                if (data[23] !== undefined) summary.descent = data[23];
            }
        }
    }

    const distanceKm = summary.distanceMeters > 0 ? (summary.distanceMeters / 1000).toFixed(2) : "0.00";
    
    let paceStr = "N/A";
    if (summary.distanceMeters > 0 && summary.totalTimeSeconds > 0) {
        const paceSecondsPerKm = summary.totalTimeSeconds / (summary.distanceMeters / 1000);
        const minutes = Math.floor(paceSecondsPerKm / 60);
        const seconds = Math.floor(paceSecondsPerKm % 60);
        paceStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds} /km`;
    }

    return {
        distanceKm,
        totalTimeMins: Math.floor(summary.totalTimeSeconds / 60),
        totalTimeSecs: Math.floor(summary.totalTimeSeconds % 60),
        paceStr,
        avgHeartRate: summary.avgHeartRate.toString(),
        maxHeartRate: summary.maxHeartRate.toString(),
        calories: summary.calories.toString(),
        ascent: summary.ascent.toString(),
        descent: summary.descent.toString(),
        avgCadence: summary.avgCadence.toString(),
        sport: summary.sport,
        trainingEffect: summary.trainingEffect,
        laps: summary.laps
    };
}
