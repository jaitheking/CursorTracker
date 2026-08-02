import { parseFitFile } from './fitParser.js';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('saveLogBtn')?.addEventListener('click', saveVectorLog);
    document.getElementById('generatePlanBtn')?.addEventListener('click', fetchCoachPlan);
    document.getElementById('insertPlanBtn')?.addEventListener('click', insertActivePlan);

    // Initialize activity date to today
    const dateInput = document.getElementById('activityDate') as HTMLInputElement | null;
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // Preset prompts
    document.querySelectorAll('.preset-coach').forEach(btn => {
        btn.addEventListener('click', () => {
            const promptArea = document.getElementById('coachPrompt') as HTMLTextAreaElement | null;
            if (promptArea) {
                promptArea.value = btn.getAttribute('data-val') || '';
            }
        });
    });
});

async function saveVectorLog(): Promise<void> {
    const typeInput = (document.getElementById('activityType') as HTMLSelectElement).value;
    const dateInput = (document.getElementById('activityDate') as HTMLInputElement).value;
    const detailsInput = (document.getElementById('logDetails') as HTMLTextAreaElement).value;
    const statusText = document.getElementById('logStatus');

    if (!detailsInput.trim() || !statusText || !dateInput) return;

    statusText.innerText = "⏳ Vectorizing and saving to Supabase...";

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
            body: JSON.stringify({ activity_date: dateInput, activity_type: typeInput, details: finalDetails })
        });

        const data = await response.json();
        if (data.success) {
            statusText.innerText = "✅ Successfully vectorized and saved!";
            (document.getElementById('logDetails') as HTMLTextAreaElement).value = '';

            // Mark this session as vectorized in local history
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

async function fetchCoachPlan(): Promise<void> {
    const promptInput = (document.getElementById('coachPrompt') as HTMLTextAreaElement).value;
    const outputPanel = document.getElementById('coachOutputPanel');
    const planContent = document.getElementById('coachPlanContent');

    if (!promptInput.trim() || !planContent || !outputPanel) return;

    outputPanel.classList.remove('hidden');
    planContent.innerText = "⏳ Retrieving vector history and generating plan...";

    try {
        const response = await fetch('/api/coach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userPrompt: promptInput })
        });

        const data = await response.json();
        if (data.plan) {
            planContent.innerText = data.plan;
            localStorage.setItem('activeCoachingPlan', data.plan);
            localStorage.setItem('activeCoachingPlanDate', new Date().toISOString());
        } else {
            planContent.innerText = "❌ Error: " + data.error;
        }
    } catch (err) {
        planContent.innerText = "❌ Network error communicating with AI.";
    }
}

function insertActivePlan(): void {
    const plan = localStorage.getItem('activeCoachingPlan');
    if (!plan) {
        alert("No active training plan found. Generate one first.");
        return;
    }
    const textArea = document.getElementById('logDetails') as HTMLTextAreaElement | null;
    if (textArea) {
        textArea.value = textArea.value + (textArea.value ? '\n\n' : '') + "--- ACTIVE PLAN ---\n" + plan;
    }
}

// Add file handling logic to your existing src/coach.ts

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('corosFileInput') as HTMLInputElement;

    // Trigger file selection window when clicking drop zone
    dropZone?.addEventListener('click', () => fileInput?.click());

    // File selection handler
    fileInput?.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
            processCorosFile(target.files[0]);
        }
    });

    // Drag and drop handlers
    dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#4caf50';
    });

    dropZone?.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#ff5722';
    });

    dropZone?.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ff5722';
        if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
            processCorosFile(e.dataTransfer.files[0]);
        }
    });
});

/**
 * Reads and parses exported Coros FIT and TXT files directly in the browser.
 */
function processCorosFile(file: File): void {
    const statusText = document.getElementById('logStatus');
    const detailsArea = document.getElementById('logDetails') as HTMLTextAreaElement;

    if (!file.name.toLowerCase().endsWith('.fit') && !file.name.toLowerCase().endsWith('.txt')) {
        if (statusText) statusText.innerText = "❌ Please upload a valid .fit or .txt file.";
        return;
    }

    const reader = new FileReader();
    
    if (file.name.toLowerCase().endsWith('.txt')) {
        reader.onload = (event: ProgressEvent<FileReader>) => {
            const fileContent = event.target?.result as string;
            if (detailsArea) detailsArea.value = fileContent;
            if (statusText) statusText.innerText = "✅ Text log parsed successfully! Ready to save to Vector DB.";
            
            const dateMatch = fileContent.match(/WORKOUT LOG:\s*([0-9\-]+)/i);
            if (dateMatch) {
                const dateInput = document.getElementById('activityDate') as HTMLInputElement;
                if (dateInput) dateInput.value = dateMatch[1].trim();
            }
            const typeMatch = fileContent.match(/Type:\s*([a-zA-Z\/ ]+)/i);
            if (typeMatch) {
                const parsedType = typeMatch[1].trim();
                const typeInput = document.getElementById('activityType') as HTMLSelectElement;
                if (typeInput) {
                    if (parsedType.toLowerCase().includes('run')) {
                        typeInput.value = 'Running';
                    } else {
                        typeInput.value = 'Strength';
                    }
                }
            }
        };
        reader.readAsText(file);
    } else {
        // FIT file parsing
        reader.onload = (event: ProgressEvent<FileReader>) => {
            try {
                if (!event.target?.result) return;
                const buffer = event.target.result as ArrayBuffer;
                const fitData = parseFitFile(buffer);
                
                const formattedSummary = `Workout: Coros ${fitData.sport} Session
File: ${file.name}
Distance: ${fitData.distanceKm} km
Total Duration: ${fitData.totalTimeMins} mins ${fitData.totalTimeSecs} secs
Average Pace: ${fitData.paceStr}
Average Heart Rate: ${fitData.avgHeartRate} bpm
Max Heart Rate: ${fitData.maxHeartRate} bpm
Calories: ${fitData.calories} kcal
Ascent: ${fitData.ascent} m
Descent: ${fitData.descent} m
Average Cadence: ${fitData.avgCadence} spm
Notes: Automatically parsed from watch export (.fit).`;

                if (detailsArea) detailsArea.value = formattedSummary;
                if (statusText) statusText.innerText = "✅ .fit File parsed successfully! Ready to save to Vector DB.";
                
                const typeInput = document.getElementById('activityType') as HTMLSelectElement;
                if (typeInput) {
                    if (fitData.sport.toLowerCase().includes('run')) {
                        typeInput.value = 'Running';
                    } else {
                        typeInput.value = 'Strength';
                    }
                }
            } catch (err) {
                console.error("Error parsing FIT file:", err);
                if (statusText) statusText.innerText = "❌ Failed to parse .fit file format.";
            }
        };
        reader.readAsArrayBuffer(file);
    }
}