document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('saveLogBtn')?.addEventListener('click', saveVectorLog);
    document.getElementById('generatePlanBtn')?.addEventListener('click', fetchCoachPlan);
});

async function saveVectorLog(): Promise<void> {
    const typeInput = (document.getElementById('activityType') as HTMLSelectElement).value;
    const detailsInput = (document.getElementById('logDetails') as HTMLTextAreaElement).value;
    const statusText = document.getElementById('logStatus');

    if (!detailsInput.trim() || !statusText) return;

    statusText.innerText = "⏳ Vectorizing and saving to Supabase...";

    try {
        const response = await fetch('/api/save_log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity_type: typeInput, details: detailsInput })
        });

        const data = await response.json();
        if (data.success) {
            statusText.innerText = "✅ Successfully vectorized and saved!";
            (document.getElementById('logDetails') as HTMLTextAreaElement).value = '';
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

    if (!file.name.endsWith('.tcx') && !file.name.endsWith('.gpx')) {
        if (statusText) statusText.innerText = "❌ Please upload a valid .tcx or .gpx file.";
        return;
    }

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
            const xmlContent = event.target?.result as string;
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