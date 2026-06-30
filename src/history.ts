interface HistoricLog {
    id: string;
    date: string;
    type: string;
    summary: string;
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
function renderCalendarView(): void {
    const daysGrid = document.getElementById('calendarDaysGrid');
    const monthTitle = document.getElementById('calendarMonthTitle');
    if (!daysGrid || !monthTitle) return;

    const months = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];
    
    monthTitle.innerText = `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

    const rawHistory = localStorage.getItem('cursor_workout_history');
    const logs: HistoricLog[] = rawHistory ? JSON.parse(rawHistory) : [];

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
            
            const indicators = activeWorkouts.map(w => w.type === 'Running' ? '🏃‍♂️' : '🏋️‍♂️').join('');
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
                    
                    if (parsedType.toLowerCase().includes('run')) {
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
        <label style="font-size:0.8rem; font-weight:700; margin-bottom:4px; display:block;">Workout Data Template Editor</label>
        <textarea id="editLogSummary" class="edit-textarea" rows="8">${log.summary}</textarea>
        <div class="inspector-actions">
            <button type="button" class="inline-save-btn" id="inlineSaveBtn">💾 Update Log</button>
            <button type="button" class="inline-delete-btn" id="inlineDeleteBtn">🗑️ Delete</button>
        </div>
    `;

    document.getElementById('inlineSaveBtn')?.addEventListener('click', saveModifiedLog);
    document.getElementById('inlineDeleteBtn')?.addEventListener('click', deleteIndividualLog);
}

function closeInspector(): void {
    document.getElementById('inspectorPanel')?.classList.add('hidden');
    selectedLogId = null;
}

function saveModifiedLog(): void {
    if (!selectedLogId) return;
    const textArea = document.getElementById('editLogSummary') as HTMLTextAreaElement | null;
    if (!textArea) return;

    const rawHistory = localStorage.getItem('cursor_workout_history');
    let logs: HistoricLog[] = rawHistory ? JSON.parse(rawHistory) : [];

    logs = logs.map(log => {
        if (log.id === selectedLogId) {
            log.summary = textArea.value;
        }
        return log;
    });

    localStorage.setItem('cursor_workout_history', JSON.stringify(logs));
    renderCalendarView();
    closeInspector();
}

function deleteIndividualLog(): void {
    if (!selectedLogId || !confirm('Confirm deleting this single workout log entry?')) return;

    const rawHistory = localStorage.getItem('cursor_workout_history');
    let logs: HistoricLog[] = rawHistory ? JSON.parse(rawHistory) : [];

    logs = logs.filter(log => log.id !== selectedLogId);

    localStorage.setItem('cursor_workout_history', JSON.stringify(logs));
    renderCalendarView();
    closeInspector();
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