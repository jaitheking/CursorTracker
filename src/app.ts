interface TrackerState {
    workoutType: string;
    runDist: string;
    avgPace: string;
    gymFocus: string;
    weight: string;
    muscle: string;
    bf: string;
    description: string;
    comments: string;
    [key: string]: string;
}

const formFields: string[] = [
    'workoutType', 'runDist', 'avgPace', 'gymFocus', 
    'weight', 'muscle', 'bf', 'description', 'comments'
];

document.addEventListener('DOMContentLoaded', (): void => {
    const logDateInput = document.getElementById('logDate') as HTMLInputElement | null;
    if (logDateInput) {
        logDateInput.valueAsDate = new Date();
    }

    const currentYearEl = document.getElementById('currentYear');
    if (currentYearEl) {
        currentYearEl.innerText = new Date().getFullYear().toString();
    }
    
    loadCachedState();
    bindAutoSaveListeners();
    setupPresetBindings();
});

function bindAutoSaveListeners(): void {
    formFields.forEach((fieldId: string) => {
        const node = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (node) {
            node.addEventListener('input', saveCachedState);
            node.addEventListener('change', saveCachedState);
        }
    });

    const workoutTypeSelect = document.getElementById('workoutType') as HTMLSelectElement | null;
    if (workoutTypeSelect) {
        workoutTypeSelect.addEventListener('change', toggleFields);
    }

    document.getElementById('generateBtn')?.addEventListener('click', generateSummary);
    document.getElementById('copyBtn')?.addEventListener('click', copyToClipboard);
    document.getElementById('saveBtn')?.addEventListener('click', saveLogAsFile);
}

function setupPresetBindings(): void {
    const attachClick = (selector: string, callback: (e: Event) => void) => {
        document.querySelectorAll(selector).forEach(btn => btn.addEventListener('click', callback));
    };

    attachClick('.preset-dist', (e) => {
        const val = (e.target as HTMLButtonElement).getAttribute('data-val') || '';
        setFieldValue('runDist', val);
    });

    attachClick('.preset-pace', (e) => {
        const val = (e.target as HTMLButtonElement).getAttribute('data-val') || '';
        setFieldValue('avgPace', val);
    });

    attachClick('.preset-gym', (e) => {
        const val = (e.target as HTMLButtonElement).getAttribute('data-val') || '';
        setFieldValue('gymFocus', val);
    });
}

function setFieldValue(id: string, val: string): void {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) {
        el.value = val;
        saveCachedState();
    }
}

function toggleFields(): void {
    const typeEl = document.getElementById('workoutType') as HTMLSelectElement | null;
    const runningMetrics = document.getElementById('runningMetrics');
    const gymMetrics = document.getElementById('gymMetrics');

    if (!typeEl || !runningMetrics || !gymMetrics) return;

    if (typeEl.value === 'Running') {
        runningMetrics.classList.remove('hidden');
        gymMetrics.classList.add('hidden');
    } else {
        runningMetrics.classList.add('hidden');
        gymMetrics.classList.remove('hidden');
    }
    saveCachedState();
}

function saveCachedState(): void {
    const state: Partial<TrackerState> = {};
    formFields.forEach((fieldId: string) => {
        const node = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (node) state[fieldId] = node.value;
    });
    localStorage.setItem('cursor_tracker_state', JSON.stringify(state));
}

function loadCachedState(): void {
    try {
        const serialized = localStorage.getItem('cursor_tracker_state');
        if (!serialized) return;
        const state = JSON.parse(serialized) as TrackerState;
        formFields.forEach((fieldId: string) => {
            const node = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
            if (node && state[fieldId] !== undefined) {
                node.value = state[fieldId];
            }
        });
        toggleFields();
    } catch (e) {
        console.error("Cache compilation failed to read structural layout state.", e);
    }
}

function clearCachedState(): void {
    localStorage.removeItem('cursor_tracker_state');
}

function generateSummary(): void {
    const date = (document.getElementById('logDate') as HTMLInputElement).value;
    const type = (document.getElementById('workoutType') as HTMLSelectElement).value;
    const weight = (document.getElementById('weight') as HTMLInputElement).value;
    const muscle = (document.getElementById('muscle') as HTMLInputElement).value;
    const bf = (document.getElementById('bf') as HTMLInputElement).value;
    const desc = (document.getElementById('description') as HTMLTextAreaElement).value.trim();
    const comments = (document.getElementById('comments') as HTMLTextAreaElement).value.trim();

    // Outputs clean headers to simplify parsing
    let summary = `📊 **WORKOUT LOG: ${date}**\n`;
    summary += `Type: ${type}\n`;

    if (type === 'Running') {
        const dist = (document.getElementById('runDist') as HTMLInputElement).value;
        const pace = (document.getElementById('avgPace') as HTMLInputElement).value;
        if (dist) summary += `Distance: ${dist} km\n`;
        if (pace) summary += `Average Pace: ${pace} /km\n`;
    } else {
        const focus = (document.getElementById('gymFocus') as HTMLInputElement).value;
        if (focus) summary += `Focus: ${focus}\n`;
    }

    if (weight || muscle || bf) {
        summary += `\nWeight: ${weight ? weight + ' kg' : 'N/A'}\n`;
        summary += `Muscle Mass: ${muscle ? muscle + ' kg' : 'N/A'}\n`;
        summary += `Body Fat: ${bf ? bf + '%' : 'N/A'}\n`;
    }

    if (desc) summary += `\nDetails:\n${desc}\n`;
    if (comments) summary += `\nComments:\n${comments}\n`;

    const outputDiv = document.getElementById('output');
    const actionGroup = document.getElementById('actionGroup');
    
    if (outputDiv && actionGroup) {
        outputDiv.innerText = summary;
        outputDiv.classList.remove('hidden');
        actionGroup.classList.remove('hidden');
    }

    // Auto-save generated output straight into historical timeline
    saveToHistoryLogs(date, type, summary);
}

function saveToHistoryLogs(date: string, type: string, summaryText: string): void {
    const rawHistory = localStorage.getItem('cursor_workout_history');
    const logs = rawHistory ? JSON.parse(rawHistory) : [];
    
    // Strip parent titles during compilation step to avoid multi-header nesting
    const cleanSummaryText = summaryText.replace(/📊 \*\*WORKOUT LOG: .*\*\n/, '');

    const newLog = {
        id: Date.now().toString(),
        date: date,
        type: type,
        summary: cleanSummaryText
    };
    
    // De-duplicate existing items on the exact same date and block path
    const filteredLogs = logs.filter((l: any) => !(l.date === date && l.type === type));
    filteredLogs.push(newLog);
    
    localStorage.setItem('cursor_workout_history', JSON.stringify(filteredLogs));
}

function saveLogAsFile(): void {
    const outputDiv = document.getElementById('output');
    const logDateInput = document.getElementById('logDate') as HTMLInputElement | null;
    if (!outputDiv) return;

    const text = outputDiv.innerText;
    const dateStr = logDateInput?.value || new Date().toISOString().split('T')[0];
    const filename = `${dateStr}.txt`;

    const nav = navigator as any;
    if (nav.canShare && nav.canShare({ files: [] })) {
        try {
            const file = new File([text], filename, { type: 'text/plain' });
            nav.share({
                files: [file],
                title: `Workout Log ${dateStr}`,
                text: `Performance Metrics Compilation ${dateStr}`
            }).then(() => {
                clearCachedState();
            }).catch((err: any) => {
                if (err.name !== 'AbortError') triggerAnchorDownload(text, filename);
            });
            return;
        } catch (e) { /* clean fallback execution */ }
    }
    triggerAnchorDownload(text, filename);
}

function triggerAnchorDownload(text: string, filename: string): void {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    clearCachedState();
}

function copyToClipboard(): void {
    const outputDiv = document.getElementById('output');
    if (!outputDiv) return;
    const text = outputDiv.innerText;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showSuccess).catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text: string): void {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showSuccess();
    } catch (err) {
        alert('Copy failed. Please manually copy text.');
    }
    document.body.removeChild(textArea);
}

function showSuccess(): void {
    const copyBtn = document.getElementById('copyBtn');
    if (!copyBtn) return;
    copyBtn.innerText = '🔥 Copied!';
    copyBtn.style.background = 'var(--success-color)';
    copyBtn.style.color = '#fff';
    setTimeout(() => {
        copyBtn.innerText = '🚀 Copy';
        copyBtn.style.background = 'transparent';
        copyBtn.style.color = 'var(--accent-color)';
    }, 1500);
}