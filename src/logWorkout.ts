import { parseFitFile } from './fitParser.js';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('saveLogBtn')?.addEventListener('click', saveVectorLog);

    const dateInput = document.getElementById('activityDate') as HTMLInputElement | null;
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    const embeddingModelSelect = document.getElementById('embeddingModelSelect') as HTMLSelectElement | null;
    if (embeddingModelSelect) {
        const saved = localStorage.getItem('ai_embedding_model');
        if (saved) embeddingModelSelect.value = saved;
        embeddingModelSelect.addEventListener('change', () => {
            localStorage.setItem('ai_embedding_model', embeddingModelSelect.value);
        });
    }

    setupFileDropZone();
    setupTrainingPlanDropdown();
});

function setupTrainingPlanDropdown() {
    const planStr = localStorage.getItem('cursor_weekly_plan');
    const select = document.getElementById('planDaySelect') as HTMLSelectElement | null;
    const btn = document.getElementById('insertPlanBtn') as HTMLButtonElement | null;
    const details = document.getElementById('logDetails') as HTMLTextAreaElement | null;

    if (!select || !btn || !details) return;

    if (planStr) {
        let plan: any[] = [];
        try { plan = JSON.parse(planStr); } catch (e) {}
        
        plan.forEach((dayData) => {
            const opt = document.createElement('option');
            opt.value = dayData.day;
            opt.text = `${dayData.day} - ${dayData.type}`;
            // Store the full details as data attribute for easy access
            opt.dataset.plan = `Focus: ${dayData.focus}\n${dayData.details}`;
            select.appendChild(opt);
        });

        const jsDay = new Date().getDay(); 
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const todayName = dayNames[jsDay];
        
        // Auto-select today if it exists
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === todayName) {
                select.selectedIndex = i;
                break;
            }
        }
    } else {
        select.disabled = true;
        btn.disabled = true;
        const opt = document.createElement('option');
        opt.text = "No active training plan found";
        select.appendChild(opt);
    }

    btn.addEventListener('click', () => {
        const selectedOpt = select.options[select.selectedIndex];
        if (selectedOpt && selectedOpt.dataset.plan) {
            const currentVal = details.value.trim();
            const insertion = `--- Training Plan ---\n${selectedOpt.dataset.plan}\n---------------------`;
            details.value = currentVal ? `${currentVal}\n\n${insertion}` : insertion;
        }
    });
}

function setupFileDropZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('corosFileInput') as HTMLInputElement | null;

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ff5722';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#444';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#444';
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            handleFiles(Array.from(e.dataTransfer.files));
        }
    });

    fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            handleFiles(Array.from(target.files));
        }
    });
}

async function handleFiles(files: File[]) {
    const detailsArea = document.getElementById('logDetails') as HTMLTextAreaElement;
    const statusText = document.getElementById('logStatus');
    if (!detailsArea) return;
    
    let combinedContent = detailsArea.value ? detailsArea.value + '\n\n' : '';

    for (const file of files) {
        if (file.name.endsWith('.fit')) {
            if (statusText) statusText.innerText = `⏳ Parsing and summarizing ${file.name} using AI...`;
            try {
                const buffer = await file.arrayBuffer();
                const parsed = await parseFitFile(buffer);
                
                // Call API to summarize
                const chatModel = localStorage.getItem('ai_chat_model') || 'gemini-3.7-flash';
                const response = await fetch('/api/summarize_fit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fitData: parsed, chatModel })
                });
                
                const data = await response.json();
                if (data.summary) {
                    combinedContent += `--- Summary for ${file.name} ---\n${data.summary}\n`;
                } else {
                    combinedContent += `--- Raw Data for ${file.name} (Summary Failed) ---\n${JSON.stringify(parsed, null, 2)}\n`;
                }
            } catch (e) {
                combinedContent += `--- Raw Data for ${file.name} (Summary Error) ---\nError parsing file.\n`;
            }
        } else if (file.name.endsWith('.txt')) {
            const text = await file.text();
            combinedContent += `--- Notes from ${file.name} ---\n${text}\n`;
        }
    }
    
    detailsArea.value = combinedContent;
    if (statusText) statusText.innerText = "✅ Files imported successfully!";
}

async function saveVectorLog(): Promise<void> {
    const typeInput = (document.getElementById('activityType') as HTMLSelectElement).value;
    const dateInput = (document.getElementById('activityDate') as HTMLInputElement).value;
    const detailsInput = (document.getElementById('logDetails') as HTMLTextAreaElement).value;
    const statusText = document.getElementById('logStatus');
    const embeddingModel = (document.getElementById('embeddingModelSelect') as HTMLSelectElement)?.value
        || localStorage.getItem('ai_embedding_model')
        || 'gemini-embedding-exp-03-07';

    if (!detailsInput.trim() || !statusText || !dateInput) return;

    statusText.innerText = `⏳ Vectorizing with ${embeddingModel} and saving to Supabase...`;

    const weight = (document.getElementById('weight') as HTMLInputElement)?.value;
    const muscle = (document.getElementById('muscle') as HTMLInputElement)?.value;
    const bf = (document.getElementById('bf') as HTMLInputElement)?.value;

    let finalDetails = detailsInput;
    if (weight || muscle || bf) {
        finalDetails += `\n\nBody Composition:`;
        if (weight) finalDetails += `\nWeight: ${weight} kg`;
        if (muscle) finalDetails += `\nMuscle Mass: ${muscle} kg`;
        if (bf) finalDetails += `\nBody Fat: ${bf}%`;
    }

    try {
        const response = await fetch('/api/save_log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity_date: dateInput, activity_type: typeInput, details: finalDetails, embeddingModel })
        });

        const data = await response.json();
        if (data.success) {
            statusText.innerText = "✅ Successfully vectorized and saved!";
            (document.getElementById('logDetails') as HTMLTextAreaElement).value = '';

            const rawHistory = localStorage.getItem('cursor_workout_history');
            if (rawHistory) {
                let logs = JSON.parse(rawHistory);
                logs = logs.map((log: any) => {
                    if (log.date === dateInput && log.type === typeInput) {
                        log.vectorized = true;
                    }
                    return log;
                });
                localStorage.setItem('cursor_workout_history', JSON.stringify(logs));
            }
        } else {
            statusText.innerText = "❌ Error: " + data.error;
        }
    } catch (err) {
        statusText.innerText = "❌ Network error occurred.";
    }
}
