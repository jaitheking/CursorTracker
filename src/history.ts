interface HistoricLog {
    id: string;
    date: string;
    type: string;
    summary: string;
    vectorized?: boolean;
}

// Global View-State Boundaries
let currentDate: Date = new Date();
let selectedLogId: string | null = null;

// Core Initializer Routine
document.addEventListener('DOMContentLoaded', (): void => {
    const currentYearEl = document.getElementById('currentYear');
    if (currentYearEl) {
        currentYearEl.innerText = new Date().getFullYear().toString();
    }

    initializeCalendarControls();
    setupFileImporter();
    bindHistoryActions();
    
    // Initial draw pass
    renderCalendarView();
});

function initializeCalendarControls(): void {
    document.getElementById('prevMonthBtn')?.addEventListener('click', (): void => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendarView();
        closeInspector();
    });

    document.getElementById('nextMonthBtn')?.addEventListener('click', (): void => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendarView();
        closeInspector();
    });
}

/**
 * Primary Layout Engine: Calculates grid indexes, queries local data arrays,
 * and dynamically renders individual date cells.
 */
async function renderCalendarView(): Promise<void> {
    const daysGrid = document.getElementById('calendarDaysGrid');
    const monthTitle = document.getElementById('calendarMonthTitle');
    const importStatus = document.getElementById('importStatus');
    if (!daysGrid || !monthTitle) return;

    if (importStatus) importStatus.innerText = "🔄 Syncing with DB...";

    const months = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];
    
    monthTitle.innerText = `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

    const rawHistory = localStorage.getItem('cursor_workout_history');
    let logs: HistoricLog[] = rawHistory ? JSON.parse(rawHistory) : [];

    try {
        const response = await fetch('/api/get_logs');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.logs) {
                data.logs.forEach((dbLog: any) => {
                    const existingLogIndex = logs.findIndex(l => l.date === dbLog.activity_date && l.type === dbLog.activity_type);
                    if (existingLogIndex >= 0) {
                        logs[existingLogIndex].vectorized = true;
                        logs[existingLogIndex].summary = dbLog.details;
                    } else {
                        logs.push({
                            id: `db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            date: dbLog.activity_date,
                            type: dbLog.activity_type,
                            summary: dbLog.details,
                            vectorized: true
                        });
                    }
                });
                localStorage.setItem('cursor_workout_history', JSON.stringify(logs));
            }
        }
    } catch (err) {
        console.error("Failed to sync from Supabase:", err);
    }

    if (importStatus) importStatus.innerText = "";

    daysGrid.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // 1. Render padding blocks for pre-month alignment
    for (let i = 0; i < firstDayIndex; i++) {
        const space = document.createElement('div');
        space.className = 'calendar-day empty';
        daysGrid.appendChild(space);
    }

    // 2. Map individual active workout days
    for (let day = 1; day <= totalDays; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.innerText = day.toString();

        const currentIsoStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const activeWorkouts = logs.filter((log: HistoricLog) => log.date.trim() === currentIsoStr);

        if (activeWorkouts.length > 0) {
            dayCell.classList.add('has-workout');
            
            const indicators = activeWorkouts.map(w => {
                let icon = w.type === 'Running' ? '🏃‍♂️' : (w.type === 'Hybrid' ? '🏃‍♂️🏋️‍♂️' : '🏋️‍♂️');
                if (w.vectorized) {
                    icon += '✅';
                }
                return icon;
            }).join('');
            const badge = document.createElement('span');
            badge.className = 'workout-indicator';
            badge.innerText = indicators;
            dayCell.appendChild(badge);

            dayCell.addEventListener('click', () => openInspector(activeWorkouts[0]));
        } else {
            dayCell.addEventListener('click', closeInspector);
        }

        const today = new Date();
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayCell.classList.add('today');
        }

        daysGrid.appendChild(dayCell);
    }

    const clearBtn = document.getElementById('clearHistoryBtn');
    if (clearBtn) {
        if (logs.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }
}

/**
 * High-Performance Ingestion Loop: Processes batch file selections asynchronously,
 * safely cleans up mobile carriage lines, and triggers an immediate UI redraw.
 */
function setupFileImporter(): void {
    const fileImporter = document.getElementById('fileImporter') as HTMLInputElement | null;
    const statusSpan = document.getElementById('importStatus');
    if (!fileImporter || !statusSpan) return;

    fileImporter.addEventListener('change', async (event: Event): Promise<void> => {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        if (!files || files.length === 0) return;

        const rawHistory = localStorage.getItem('cursor_workout_history');
        let currentLogs: HistoricLog[] = rawHistory ? JSON.parse(rawHistory) : [];
        let importedCount = 0;

        const fileReadPromises = Array.from(files).map(async (file: File): Promise<void> => {
            try {
                let text = await readFileAsText(file);
                
                // Normalizes structure for accurate header tracking
                const cleanInputText = sanitizeRawLogSummary(text);

                const dateMatch = text.match(/WORKOUT LOG:\s*([0-9\-]+)/i);
                const typeMatch = cleanInputText.match(/Type:\s*([a-zA-Z\/ ]+)/i);

                if (dateMatch) {
                    const parsedDate = dateMatch[1].trim();
                    let parsedType = typeMatch ? typeMatch[1].trim() : 'Gym';
                    
                    if (parsedType.toLowerCase().includes('hybrid')) {
                        parsedType = 'Hybrid';
                    } else if (parsedType.toLowerCase().includes('run')) {
                        parsedType = 'Running';
                    } else {
                        parsedType = 'Gym';
                    }

                    // Extracts raw summary lines clean of custom titles
                    const sanitizedSummary = text.replace(/📊 \*\*WORKOUT LOG: .*\*\n/, '');

                    const isDuplicate = currentLogs.some(log => log.date.trim() === parsedDate && log.type === parsedType);

                    if (!isDuplicate) {
                        currentLogs.push({
                            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            date: parsedDate,
                            type: parsedType,
                            summary: sanitizedSummary
                        });
                        importedCount++;
                    }
                }
            } catch (err) {
                console.error(`Parsing failure on: ${file.name}`, err);
            }
        });

        await Promise.all(fileReadPromises);
        localStorage.setItem('cursor_workout_history', JSON.stringify(currentLogs));
        
        renderCalendarView();
        statusSpan.innerText = `✅ Successfully synced ${importedCount} new historical logs!`;
        target.value = ''; 
        setTimeout(() => { statusSpan.innerText = ''; }, 4000);
    });
}

function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

function openInspector(log: HistoricLog): void {
    const panel = document.getElementById('inspectorPanel');
    const header = document.getElementById('inspectorHeader');
    const content = document.getElementById('inspectorContent');
    if (!panel || !header || !content) return;

    selectedLogId = log.id;
    panel.classList.remove('hidden');
    header.innerText = `🛠️ Manage Session: ${log.date}`;

    content.innerHTML = `
        <label style="font-size:0.8rem; font-weight:700; margin-bottom:4px; display:block;">Workout Type</label>
        <select id="editLogType" style="margin-bottom: 12px; width: 100%; padding: 8px; background: #333; color: #fff; border: 1px solid #444; border-radius: 4px;">
            <option value="Running" ${log.type === 'Running' ? 'selected' : ''}>🏃‍♂️ Running</option>
            <option value="Gym" ${log.type === 'Gym' ? 'selected' : ''}>🏋️‍♂️ Gym / Strength</option>
            <option value="Hybrid" ${log.type === 'Hybrid' ? 'selected' : ''}>🏃‍♂️🏋️‍♂️ Hybrid</option>
        </select>
        <label style="font-size:0.8rem; font-weight:700; margin-bottom:4px; display:block;">Workout Data Template Editor</label>
        <textarea id="editLogSummary" class="edit-textarea" rows="8">${log.summary}</textarea>
        <div class="inspector-actions">
            <button type="button" class="inline-save-btn" id="inlineSaveBtn">💾 Update Log</button>
            <button type="button" class="inline-delete-btn" id="inlineDeleteBtn">🗑️ Delete</button>
            ${log.vectorized ? `<button type="button" class="inline-save-btn" id="downloadLogBtn" style="background:var(--accent);border-color:var(--accent);color:#fff;">📥 Download Log</button>` : ''}
        </div>
        <p id="inspectorStatus" style="font-size: 0.8rem; margin-top: 8px; color: #ff5722;"></p>
    `;

    document.getElementById('inlineSaveBtn')?.addEventListener('click', () => saveModifiedLog(log));
    document.getElementById('inlineDeleteBtn')?.addEventListener('click', () => deleteIndividualLog(log));
    document.getElementById('downloadLogBtn')?.addEventListener('click', () => downloadSupabaseLog(log));
}

function downloadSupabaseLog(log: HistoricLog): void {
    const filename = `${log.date}.txt`;
    const blob = new Blob([log.summary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function closeInspector(): void {
    document.getElementById('inspectorPanel')?.classList.add('hidden');
    selectedLogId = null;
}

async function saveModifiedLog(originalLog: HistoricLog): Promise<void> {
    if (!selectedLogId) return;
    const textArea = document.getElementById('editLogSummary') as HTMLTextAreaElement | null;
    const typeSelect = document.getElementById('editLogType') as HTMLSelectElement | null;
    const statusText = document.getElementById('inspectorStatus');
    if (!textArea || !typeSelect || !statusText) return;

    statusText.innerText = "⏳ Updating log in database...";
    const newType = typeSelect.value;
    const newSummary = textArea.value;

    try {
        if (originalLog.vectorized) {
            const response = await fetch('/api/update_log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    old_activity_date: originalLog.date,
                    old_activity_type: originalLog.type,
                    new_activity_type: newType,
                    details: newSummary
                })
            });
            const data = await response.json();
            if (!data.success) {
                statusText.innerText = "❌ Error: " + data.error;
                return;
            }
        }

        const rawHistory = localStorage.getItem('cursor_workout_history');
        let logs: HistoricLog[] = rawHistory ? JSON.parse(rawHistory) : [];

        logs = logs.map(log => {
            if (log.id === selectedLogId) {
                log.summary = newSummary;
                log.type = newType;
            }
            return log;
        });

        localStorage.setItem('cursor_workout_history', JSON.stringify(logs));
        renderCalendarView();
        closeInspector();
    } catch (err) {
        statusText.innerText = "❌ Network error updating log.";
    }
}

async function deleteIndividualLog(log: HistoricLog): Promise<void> {
    if (!selectedLogId || !confirm('Confirm deleting this single workout log entry?')) return;
    const statusText = document.getElementById('inspectorStatus');
    if (statusText) statusText.innerText = "⏳ Deleting log from database...";

    try {
        if (log.vectorized) {
            const response = await fetch('/api/delete_log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activity_date: log.date,
                    activity_type: log.type
                })
            });
            const data = await response.json();
            if (!data.success) {
                if (statusText) statusText.innerText = "❌ Error: " + data.error;
                return;
            }
        }

        const rawHistory = localStorage.getItem('cursor_workout_history');
        let logs: HistoricLog[] = rawHistory ? JSON.parse(rawHistory) : [];

        logs = logs.filter(l => l.id !== selectedLogId);

        localStorage.setItem('cursor_workout_history', JSON.stringify(logs));
        renderCalendarView();
        closeInspector();
    } catch (err) {
        if (statusText) statusText.innerText = "❌ Network error deleting log.";
    }
}

function bindHistoryActions(): void {
    document.getElementById('clearHistoryBtn')?.addEventListener('click', (): void => {
        if (confirm('⚠️ Wipe entire local workout history log cache? This step cannot be undone.')) {
            localStorage.removeItem('cursor_workout_history');
            renderCalendarView();
            closeInspector();
        }
    });
}

function sanitizeRawLogSummary(text: string): string {
    if (!text) return "";
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\*\*/g, '')
        .replace(/Avg\s*Pace:/i, 'Average Pace:')
        .replace(/(⏱️|🏃‍♂️|🔹)?\s*Pace:/i, 'Average Pace:')
        .replace(/(🏃‍♂️|🔹)?\s*Distance:/i, 'Distance:')
        .replace(/(🏋️‍♂️|🔹)?\s*Type:/i, 'Type:')
        .trim();
}