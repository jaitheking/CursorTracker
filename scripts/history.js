"use strict";
document.addEventListener('DOMContentLoaded', () => {
    // Dynamic Year Injection
    const currentYearEl = document.getElementById('currentYear');
    if (currentYearEl) {
        currentYearEl.innerText = new Date().getFullYear().toString();
    }
    renderHistoryTimeline();
    bindHistoryActions();
    setupFileImporter();
});
function renderHistoryTimeline() {
    const listContainer = document.getElementById('historyLogList');
    const clearBtn = document.getElementById('clearHistoryBtn');
    if (!listContainer)
        return;
    // Retrieve historical records array array
    const rawHistory = localStorage.getItem('cursor_workout_history');
    const logs = rawHistory ? JSON.parse(rawHistory) : [];
    if (logs.length === 0) {
        listContainer.innerHTML = `<p class="empty-state">No previous logs saved on this device yet.</p>`;
        clearBtn?.classList.add('hidden');
        return;
    }
    // Sort entries chronologically descending (newest first)
    logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    clearBtn?.classList.remove('hidden');
    listContainer.innerHTML = '';
    logs.forEach((log) => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
            <div class="meta">
                <span>${log.type === 'Running' ? '🏃‍♂️ Running' : '🏋️‍♂️ Gym/Strength'}</span>
                <span>${log.date}</span>
            </div>
            <div class="metrics">${log.summary}</div>
        `;
        listContainer.appendChild(card);
    });
}
function setupFileImporter() {
    const fileImporter = document.getElementById('fileImporter');
    const statusSpan = document.getElementById('importStatus');
    if (!fileImporter || !statusSpan)
        return;
    fileImporter.addEventListener('change', async (event) => {
        const target = event.target;
        const files = target.files;
        if (!files || files.length === 0)
            return;
        const rawHistory = localStorage.getItem('cursor_workout_history');
        let currentLogs = rawHistory ? JSON.parse(rawHistory) : [];
        let importedCount = 0;
        // Loop through every uploaded text file asynchronously
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const text = await readFileAsText(file);
                // Regex patterns to parse out specific data markers inside your markdown template
                const dateMatch = text.match(/WORKOUT LOG:\s*([^\n\*]+)/i);
                const typeMatch = text.match(/Type:\s*([^\n\*]+)/i);
                if (dateMatch) {
                    const parsedDate = dateMatch[1].replace(/\*/g, '').trim();
                    const parsedType = typeMatch ? typeMatch[1].replace(/\*/g, '').trim() : 'Gym';
                    // Strip the header out to keep standard history cards uniform
                    const sanitizedSummary = text.replace(/📊 \*\*WORKOUT LOG: .*\*\n/, '');
                    // Deduplication check: verify if this exact file entry timestamp is already saved
                    const isDuplicate = currentLogs.some(log => log.date === parsedDate && log.type === parsedType);
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
            }
            catch (err) {
                console.error(`Failed parsing file: ${file.name}`, err);
            }
        }
        // Commit updated history back to local storage and update view
        localStorage.setItem('cursor_workout_history', JSON.stringify(currentLogs));
        renderHistoryTimeline();
        statusSpan.innerText = `✅ Successfully synced ${importedCount} new historical logs!`;
        target.value = ''; // Reset input selection state
        setTimeout(() => { statusSpan.innerText = ''; }, 4000);
    });
}
/**
 * Wraps the HTML5 FileReader API inside a clean Promise construct
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}
function bindHistoryActions() {
    const clearBtn = document.getElementById('clearHistoryBtn');
    if (!clearBtn)
        return;
    clearBtn.addEventListener('click', () => {
        if (confirm('⚠️ Are you absolutely sure you want to completely delete your entire local workout history log cache? This step cannot be undone.')) {
            localStorage.removeItem('cursor_workout_history');
            renderHistoryTimeline();
        }
    });
}
