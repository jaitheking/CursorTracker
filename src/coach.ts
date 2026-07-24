document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('saveLogBtn')?.addEventListener('click', saveVectorLog);
    document.getElementById('generatePlanBtn')?.addEventListener('click', fetchCoachPlan);

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

    try {
        const response = await fetch('/api/save_log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity_date: dateInput, activity_type: typeInput, details: detailsInput })
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
 * Reads and parses exported Coros TCX XML files directly in the browser.
 */
function processCorosFile(file: File): void {
    const statusText = document.getElementById('logStatus');
    const detailsArea = document.getElementById('logDetails') as HTMLTextAreaElement;

    if (!file.name.endsWith('.tcx') && !file.name.endsWith('.gpx') && !file.name.endsWith('.txt')) {
        if (statusText) statusText.innerText = "❌ Please upload a valid .tcx, .gpx, or .txt file.";
        return;
    }

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
            const fileContent = event.target?.result as string;
            
            if (file.name.toLowerCase().endsWith('.txt')) {
                if (detailsArea) {
                    detailsArea.value = fileContent;
                }
                if (statusText) {
                    statusText.innerText = "✅ Text log parsed successfully! Ready to save to Vector DB.";
                }
                
                // Attempt to auto-fill the date and type if the file format is standard from entry.html
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
                return;
            }

            const xmlContent = fileContent;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

            let distanceMeters = 0;
            let totalTimeSeconds = 0;
            let avgHeartRate: string | number = "N/A";

            if (file.name.toLowerCase().endsWith('.tcx')) {
                const laps = xmlDoc.querySelectorAll("Lap");
                let totalHr = 0;
                let hrCount = 0;
                laps.forEach(lap => {
                    distanceMeters += parseFloat(lap.querySelector("DistanceMeters")?.textContent || "0");
                    totalTimeSeconds += parseFloat(lap.querySelector("TotalTimeSeconds")?.textContent || "0");
                    const hrValue = lap.querySelector("AverageHeartRateBpm Value")?.textContent;
                    if (hrValue) {
                        totalHr += parseFloat(hrValue);
                        hrCount++;
                    }
                });
                if (hrCount > 0) {
                    avgHeartRate = Math.round(totalHr / hrCount).toString();
                }
            } else if (file.name.toLowerCase().endsWith('.gpx')) {
                const trkpts = xmlDoc.querySelectorAll("trkpt");
                if (trkpts.length > 0) {
                    const firstTimeStr = trkpts[0].querySelector("time")?.textContent;
                    const lastTimeStr = trkpts[trkpts.length - 1].querySelector("time")?.textContent;
                    if (firstTimeStr && lastTimeStr) {
                        const firstTime = new Date(firstTimeStr).getTime();
                        const lastTime = new Date(lastTimeStr).getTime();
                        totalTimeSeconds = (lastTime - firstTime) / 1000;
                    }

                    for (let i = trkpts.length - 1; i >= 0; i--) {
                        const distNodes = trkpts[i].getElementsByTagName("gpxdata:distance");
                        if (distNodes.length > 0 && distNodes[0].textContent) {
                            distanceMeters = parseFloat(distNodes[0].textContent);
                            break;
                        }
                    }

                    const hrNodes = xmlDoc.getElementsByTagName("gpxdata:hr");
                    if (hrNodes.length > 0) {
                        let totalHr = 0;
                        for (let i = 0; i < hrNodes.length; i++) {
                            totalHr += parseFloat(hrNodes[i].textContent || "0");
                        }
                        avgHeartRate = Math.round(totalHr / hrNodes.length).toString();
                    }
                }
            }

            const distanceKm = (distanceMeters / 1000).toFixed(2);
            
            // Calculate Pace (min/km)
            let paceStr = "N/A";
            if (distanceMeters > 0 && totalTimeSeconds > 0) {
                const paceSecondsPerKm = totalTimeSeconds / (distanceMeters / 1000);
                const minutes = Math.floor(paceSecondsPerKm / 60);
                const seconds = Math.floor(paceSecondsPerKm % 60);
                paceStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds} /km`;
            }

            // Build automated structured summary
            const formattedSummary = `Workout: Coros Running Session
File: ${file.name}
Distance: ${distanceKm} km
Total Duration: ${Math.floor(totalTimeSeconds / 60)} mins ${Math.floor(totalTimeSeconds % 60)} secs
Average Pace: ${paceStr}
Average Heart Rate: ${avgHeartRate} bpm
Notes: Automatically parsed from watch export.`;

            if (detailsArea) detailsArea.value = formattedSummary;
            if (statusText) statusText.innerText = "✅ File parsed successfully! Ready to save to Vector DB.";

        } catch (err) {
            console.error("Error parsing TCX file:", err);
            if (statusText) statusText.innerText = "❌ Failed to parse watch file format.";
        }
    };

    reader.readAsText(file);
}