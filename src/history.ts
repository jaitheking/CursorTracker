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
let viewMode: 'month' | 'week' = 'month';

// Week anchor — the Monday of the displayed week
let currentWeekMonday: Date = getThisWeekMonday(new Date());

function getThisWeekMonday(d: Date): Date {
    const day = d.getDay(); // 0=Sun
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
}

// Core Initializer Routine
document.addEventListener('DOMContentLoaded', (): void => {
    const currentYearEl = document.getElementById('currentYear');
    if (currentYearEl) {
        currentYearEl.innerText = new Date().getFullYear().toString();
    }

    initializeCalendarControls();
    bindHistoryActions();
    
    // View mode toggle
    document.getElementById('viewMonthBtn')?.addEventListener('click', () => {
        viewMode = 'month';
        document.getElementById('viewMonthBtn')?.classList.add('active');
        document.getElementById('viewWeekBtn')?.classList.remove('active');
        document.getElementById('monthView')?.classList.remove('hidden');
        document.getElementById('weekView')?.classList.add('hidden');
        renderView();
    });
    document.getElementById('viewWeekBtn')?.addEventListener('click', () => {
        viewMode = 'week';
        document.getElementById('viewWeekBtn')?.classList.add('active');
        document.getElementById('viewMonthBtn')?.classList.remove('active');
        document.getElementById('weekView')?.classList.remove('hidden');
        document.getElementById('monthView')?.classList.add('hidden');
        renderView();
    });

    // Initial draw pass
    renderView();
});

function initializeCalendarControls(): void {
    document.getElementById('prevPeriodBtn')?.addEventListener('click', (): void => {
        if (viewMode === 'month') {
            currentDate.setMonth(currentDate.getMonth() - 1);
        } else {
            currentWeekMonday.setDate(currentWeekMonday.getDate() - 7);
        }
        renderView();
        closeInspector();
    });

    document.getElementById('nextPeriodBtn')?.addEventListener('click', (): void => {
        if (viewMode === 'month') {
            currentDate.setMonth(currentDate.getMonth() + 1);
        } else {
            currentWeekMonday.setDate(currentWeekMonday.getDate() + 7);
        }
        renderView();
        closeInspector();
    });
}

async function renderView(): Promise<void> {
    if (viewMode === 'month') {
        await renderCalendarView();
    } else {
        await renderWeekView();
    }
}

/**
 * Primary Layout Engine: Calculates grid indexes, queries local data arrays,
 * and dynamically renders individual date cells.
 */
async function renderCalendarView(): Promise<void> {
    const daysGrid = document.getElementById('calendarDaysGrid');
    const monthTitle = document.getElementById('calendarMonthTitle');
    if (!daysGrid || !monthTitle) return;

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
        const dayPlan = getPlanForDate(currentIsoStr);

        if (activeWorkouts.length > 0) {
            dayCell.classList.add('has-workout');
            
            const indicators = activeWorkouts.map(w => {
                let icon = w.type === 'Running' ? '<i data-lucide="footprints" style="width:12px;height:12px;"></i>' : (w.type === 'Hybrid' ? '<i data-lucide="activity" style="width:12px;height:12px;"></i>' : '<i data-lucide="dumbbell" style="width:12px;height:12px;"></i>');
                if (w.vectorized) {
                    icon += '<i data-lucide="check" style="width:12px;height:12px;color:var(--success);margin-left:2px;"></i>';
                }
                return icon;
            }).join('');
            const badge = document.createElement('span');
            badge.className = 'workout-indicator';
            badge.innerHTML = indicators;
            dayCell.appendChild(badge);
        }

        dayCell.style.cursor = 'pointer';
        dayCell.addEventListener('click', () => openInspector(currentIsoStr, activeWorkouts, dayPlan));

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
 * Weekly view: shows Mon–Sun with training plan (if current week) + actual logged sessions.
 */
async function renderWeekView(): Promise<void> {
    const grid = document.getElementById('weeklyDaysGrid');
    const monthTitle = document.getElementById('calendarMonthTitle');
    if (!grid) return;

    // Sync logs
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

    // Determine if this week is the current week
    const thisWeekMonday = getThisWeekMonday(new Date());
    const isCurrentWeek = currentWeekMonday.toDateString() === thisWeekMonday.toDateString();

    // Load plan only for current week
    let planDays: any[] = [];
    if (isCurrentWeek) {
        const planStr = localStorage.getItem('cursor_weekly_plan');
        if (planStr) {
            try { planDays = JSON.parse(planStr); } catch(e) {}
        }
    }

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    today.setHours(0,0,0,0);

    // Build the sunday (end of week)
    const weekSunday = new Date(currentWeekMonday);
    weekSunday.setDate(weekSunday.getDate() + 6);

    const formatShort = (d: Date) => {
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    };

    if (monthTitle) {
        monthTitle.innerText = `${formatShort(currentWeekMonday)} – ${formatShort(weekSunday)} ${weekSunday.getFullYear()}`;
    }

    grid.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(currentWeekMonday);
        dayDate.setDate(currentWeekMonday.getDate() + i);
        dayDate.setHours(0,0,0,0);

        const iso = `${dayDate.getFullYear()}-${String(dayDate.getMonth()+1).padStart(2,'0')}-${String(dayDate.getDate()).padStart(2,'0')}`;
        const dayWorkouts = logs.filter(l => l.date.trim() === iso);
        const dayPlan = planDays.find((p: any) => p.day && p.day.toLowerCase().startsWith(dayNames[i].toLowerCase()));
        const isToday = dayDate.toDateString() === today.toDateString();

        const card = document.createElement('div');
        card.className = 'weekly-day-card' + (isToday ? ' today-card' : '');

        let planHtml = '';
        if (isCurrentWeek && dayPlan) {
            planHtml = `<div class="weekly-plan-box"><div class="plan-label">📋 Plan — ${dayPlan.type || ''}</div>${(dayPlan.details || dayPlan.focus || '').substring(0, 120)}</div>`;
        }

        let actualHtml = '';
        if (dayWorkouts.length > 0) {
            actualHtml = dayWorkouts.map(w => {
                const icon = w.type === 'Running' ? '<i data-lucide="footprints" style="width:14px;height:14px;vertical-align:middle;"></i>' : (w.type === 'Hybrid' ? '<i data-lucide="activity" style="width:14px;height:14px;vertical-align:middle;"></i>' : '<i data-lucide="dumbbell" style="width:14px;height:14px;vertical-align:middle;"></i>');
                return `<div class="weekly-actual-box">
                    <div class="plan-label"><i data-lucide="check" style="width:12px;height:12px;vertical-align:middle;"></i> Logged</div>
                    <span class="week-session-chip">${icon} ${w.type}</span>
                    <span style="font-size:0.72rem;">${(w.summary || '').substring(0, 80)}</span>
                </div>`;
            }).join('');
        } else if (!dayPlan || !isCurrentWeek) {
            actualHtml = `<div class="weekly-rest-label">No session logged</div>`;
        }

        card.innerHTML = `
            <div class="weekly-day-header">
                <span class="weekly-day-name">${isToday ? '📍 ' : ''}${dayNames[i]}</span>
                <span class="weekly-day-date">${formatShort(dayDate)}</span>
            </div>
            ${planHtml}
            ${actualHtml}
        `;

        card.style.cursor = 'pointer';
        card.addEventListener('click', () => openInspector(iso, dayWorkouts, isCurrentWeek ? dayPlan : null));

        grid.appendChild(card);
    }
}


function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

function getPlanForDate(isoDateStr: string): any {
    const planStr = localStorage.getItem('cursor_weekly_plan');
    if (!planStr) return null;
    
    // Check if isoDateStr falls in the current week
    const targetDate = new Date(isoDateStr);
    targetDate.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const targetMonday = getThisWeekMonday(targetDate);
    const thisWeekMonday = getThisWeekMonday(today);
    
    if (targetMonday.getTime() === thisWeekMonday.getTime()) {
        try {
            const planDays = JSON.parse(planStr);
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayName = dayNames[targetDate.getDay()];
            return planDays.find((p: any) => p.day && p.day.toLowerCase().startsWith(dayName.toLowerCase()));
        } catch(e) {}
    }
    return null;
}

function openInspector(dateStr: string, activeWorkouts: HistoricLog[], dayPlan?: any): void {
    const panel = document.getElementById('inspectorPanel');
    const header = document.getElementById('inspectorHeader');
    const content = document.getElementById('inspectorContent');
    if (!panel || !header || !content) return;

    panel.classList.remove('hidden');
    header.innerHTML = `<i data-lucide="info" style="width:18px;height:18px;vertical-align:middle;margin-right:4px;"></i> Details for ${dateStr}`;

    let html = '';

    if (dayPlan) {
        html += `<div style="background:var(--surface-sunken); padding:12px; border-radius:8px; margin-bottom:12px;">
            <h4 style="margin-bottom:8px; color:var(--accent);"><i data-lucide="clipboard-list" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"></i> Plan: ${dayPlan.type}</h4>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:4px;"><strong>Focus:</strong> ${dayPlan.focus}</p>
            <p style="font-size:0.85rem; color:var(--text-secondary);">${dayPlan.details}</p>
        </div>`;
    }

    if (activeWorkouts.length > 0) {
        const log = activeWorkouts[0];
        selectedLogId = log.id;
        
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <label style="font-size:0.8rem; font-weight:700;">Workout Data</label>
                <button type="button" class="secondary-btn" id="copyLogBtn" style="padding:4px 8px; font-size:0.75rem;">
                    <i data-lucide="copy" style="width:12px;height:12px;margin-right:4px;"></i> Copy Data
                </button>
            </div>
            
            <textarea id="editLogSummary" class="edit-textarea" rows="12" style="font-family:monospace; white-space:pre;">${log.summary}</textarea>
            
            <label style="font-size:0.8rem; font-weight:700; margin-top:12px; margin-bottom:4px; display:block;">Workout Type</label>
            <select id="editLogType" style="margin-bottom: 12px; width: 100%; padding: 8px; background: #333; color: #fff; border: 1px solid #444; border-radius: 4px;">
                <option value="Running" ${log.type === 'Running' ? 'selected' : ''}>Running</option>
                <option value="Gym" ${log.type === 'Gym' ? 'selected' : ''}>Gym / Strength</option>
                <option value="Hybrid" ${log.type === 'Hybrid' ? 'selected' : ''}>Hybrid</option>
            </select>
            
            <div class="inspector-actions">
                <button type="button" class="inline-save-btn" id="inlineSaveBtn">
                    <i data-lucide="save" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i> Update Log
                </button>
                <button type="button" class="inline-delete-btn" id="inlineDeleteBtn">
                    <i data-lucide="trash-2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i> Delete
                </button>
            </div>
            <p id="inspectorStatus" style="font-size: 0.8rem; margin-top: 8px; color: #ff5722;"></p>
        `;
    } else {
        html += `<p style="font-size:0.85rem; color:var(--text-muted); font-style:italic; padding:12px 0;">No active workouts logged for this day.</p>`;
        selectedLogId = null;
    }

    content.innerHTML = html;

    if (typeof (window as any).lucide !== 'undefined') {
        (window as any).lucide.createIcons();
    }

    if (activeWorkouts.length > 0) {
        document.getElementById('inlineSaveBtn')?.addEventListener('click', () => saveModifiedLog(activeWorkouts[0]));
        document.getElementById('inlineDeleteBtn')?.addEventListener('click', () => deleteIndividualLog(activeWorkouts[0]));
        
        document.getElementById('copyLogBtn')?.addEventListener('click', () => {
            const textarea = document.getElementById('editLogSummary') as HTMLTextAreaElement;
            if (textarea) {
                navigator.clipboard.writeText(textarea.value).then(() => {
                    const btn = document.getElementById('copyLogBtn');
                    if (btn) {
                        btn.innerHTML = `<i data-lucide="check" style="width:12px;height:12px;margin-right:4px;"></i> Copied!`;
                        if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons();
                        setTimeout(() => {
                            btn.innerHTML = `<i data-lucide="copy" style="width:12px;height:12px;margin-right:4px;"></i> Copy Data`;
                            if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons();
                        }, 2000);
                    }
                });
            }
        });
    }
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
            const editEmbeddingModelSelect = document.getElementById('editEmbeddingModelSelect') as HTMLSelectElement | null;
            const embeddingModel = editEmbeddingModelSelect?.value || 'gemini-embedding-exp-03-07';

            const response = await fetch('/api/update_log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    old_activity_date: originalLog.date,
                    old_activity_type: originalLog.type,
                    new_activity_type: newType,
                    details: newSummary,
                    embeddingModel
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