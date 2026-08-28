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
});

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
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            handleFile(target.files[0]);
        }
    });
}

async function handleFile(file: File) {
    if (file.name.endsWith('.fit')) {
        const buffer = await file.arrayBuffer();
        const parsed = await parseFitFile(buffer);
        (document.getElementById('logDetails') as HTMLTextAreaElement).value = JSON.stringify(parsed, null, 2);
    } else if (file.name.endsWith('.txt')) {
        const text = await file.text();
        (document.getElementById('logDetails') as HTMLTextAreaElement).value = text;
    }
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
