interface HistoricLog {
    id: string;
    date: string;
    type: string;
    summary: string;
}

// Global scope tracker to handle cross-year browsability
let viewDate: Date = new Date();

document.addEventListener('DOMContentLoaded', (): void => {
    const currentYearEl = document.getElementById('currentYear');
    if (currentYearEl) {
        currentYearEl.innerText = new Date().getFullYear().toString();
    }

    initializeSegmentTabs();
    initializePeriodControls();
    
    // Core computation pass
    calculatePerformanceAnalytics();
});

function initializeSegmentTabs(): void {
    const btnRun = document.getElementById('tabRunning');
    const btnGym = document.getElementById('tabGym');
    const panelRun = document.getElementById('runningStatsPanel');
    const panelGym = document.getElementById('gymStatsPanel');

    btnRun?.addEventListener('click', () => {
        btnRun.classList.add('active');
        btnGym?.classList.remove('active');
        panelRun?.classList.remove('hidden');
        panelGym?.classList.add('hidden');
    });

    btnGym?.addEventListener('click', () => {
        btnGym.classList.add('active');
        btnRun.classList.remove('active');
        panelGym?.classList.remove('hidden');
        panelRun?.classList.add('hidden');
    });
}

function initializePeriodControls(): void {
    document.getElementById('prevPeriodBtn')?.addEventListener('click', () => {
        viewDate.setMonth(viewDate.getMonth() - 1);
        calculatePerformanceAnalytics();
    });

    document.getElementById('nextPeriodBtn')?.addEventListener('click', () => {
        viewDate.setMonth(viewDate.getMonth() + 1);
        calculatePerformanceAnalytics();
    });
}

/**
 * Computes analytics contextually based on the active viewDate period selection,
 * allowing long-term historical exploration across multiple months and years.
 */
function calculatePerformanceAnalytics(): void {
    const rawHistory = localStorage.getItem('cursor_workout_history');
    const logs: HistoricLog[] = rawHistory ? JSON.parse(rawHistory) : [];

    const months = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];

    const targetYearStr = viewDate.getFullYear().toString();
    const targetMonthPrefix = `${targetYearStr}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;

    // Update Title Deck
    const titleEl = document.getElementById('dashboardPeriodTitle');
    if (titleEl) {
        titleEl.innerText = `${months[viewDate.getMonth()]} ${targetYearStr}`;
    }

    // Dynamic Context Labels
    document.getElementById('monthlyLabel')!.innerText = `${months[viewDate.getMonth()].toUpperCase()} MILEAGE`;
    document.getElementById('yearlyLabel')!.innerText = `${targetYearStr} TOTAL MILEAGE`;

    // Filter Repositories
    const runningLogs = logs.filter(l => l.type === 'Running');
    
    let monthlyMileage = 0;
    let yearlyMileage = 0;
    let maxDistance = 0; // Lifetime stat
    let periodTotalPaceSeconds = 0;
    let periodPaceCount = 0;
    let lifetimeFastestPaceSeconds = Infinity; // Lifetime stat

    // Process Running Logs
    runningLogs.forEach(log => {
        const distMatch = log.summary.match(/Distance:\s*([0-9\.]+)/i);
        const paceMatch = log.summary.match(/Average Pace:\s*([0-9]+):([0-9]+)/i);

        if (distMatch) {
            const dist = parseFloat(distMatch[1]);
            
            // Period context filtering checks
            if (log.date.startsWith(targetMonthPrefix)) monthlyMileage += dist;
            if (log.date.startsWith(targetYearStr)) yearlyMileage += dist;
            if (dist > maxDistance) maxDistance = dist; // Absolute record check

            if (paceMatch) {
                const mins = parseInt(paceMatch[1], 10);
                const secs = parseInt(paceMatch[2], 10);
                const totalSecs = (mins * 60) + secs;

                // Average calculation scoped directly to the selected period
                if (log.date.startsWith(targetMonthPrefix)) {
                    periodTotalPaceSeconds += totalSecs;
                    periodPaceCount++;
                }

                // Lifetime record check
                if (totalSecs < lifetimeFastestPaceSeconds) {
                    lifetimeFastestPaceSeconds = totalSecs;
                }
            }
        }
    });

    // Process Gym Logs contextually filtered to the chosen month
    const periodGymLogs = logs.filter(l => l.type === 'Gym' && l.date.startsWith(targetMonthPrefix));
    let periodGymCount = periodGymLogs.length;
    let maxWeight = 0;
    let maxMuscle = 0;
    let focusMap: { [key: string]: number } = {};

    periodGymLogs.forEach(log => {
        const weightMatch = log.summary.match(/Weight:\s*([0-9\.]+)/i);
        const muscleMatch = log.summary.match(/Muscle Mass:\s*([0-9\.]+)/i);
        const focusMatch = log.summary.match(/Focus:\s*([^\n]+)/i);

        if (weightMatch) maxWeight = Math.max(maxWeight, parseFloat(weightMatch[1]));
        if (muscleMatch) maxMuscle = Math.max(maxMuscle, parseFloat(muscleMatch[1]));
        
        if (focusMatch) {
            const focus = focusMatch[1].trim();
            focusMap[focus] = (focusMap[focus] || 0) + 1;
        }
    });

    let topFocus = 'N/A';
    let maxFocusCount = 0;
    for (const k in focusMap) {
        if (focusMap[k] > maxFocusCount) {
            maxFocusCount = focusMap[k];
            topFocus = k;
        }
    }

    // --- Render Elements to DOM ---
    // Running Updates
    document.getElementById('runMonthDist')!.innerHTML = `${monthlyMileage.toFixed(2)} <span class="unit">km</span>`;
    document.getElementById('runYearDist')!.innerHTML = `${yearlyMileage.toFixed(2)} <span class="unit">km</span>`;
    document.getElementById('runMaxDist')!.innerText = `${maxDistance.toFixed(2)} km`;

    const avgPaceEl = document.getElementById('runAvgPace')!;
    if (periodPaceCount > 0) {
        const avgSecs = periodTotalPaceSeconds / periodPaceCount;
        avgPaceEl.innerText = `${Math.floor(avgSecs / 60)}:${String(Math.floor(avgSecs % 60)).padStart(2, '0')} /km`;
    } else {
        avgPaceEl.innerText = '--:--';
    }

    const fastPaceEl = document.getElementById('runFastPace')!;
    if (lifetimeFastestPaceSeconds !== Infinity) {
        fastPaceEl.innerText = `${Math.floor(lifetimeFastestPaceSeconds / 60)}:${String(Math.floor(lifetimeFastestPaceSeconds % 60)).padStart(2, '0')} /km`;
    } else {
        fastPaceEl.innerText = '--:--';
    }

    // Gym Updates (Time spent calculated contextually per session at a standard 45-min duration)
    document.getElementById('gymTotalTime')!.innerHTML = `${periodGymCount * 45} <span class="unit">mins</span>`;
    document.getElementById('gymTotalCount')!.innerHTML = `${periodGymCount} <span class="unit">logs</span>`;
    document.getElementById('gymTopFocus')!.innerText = topFocus;
    document.getElementById('gymMaxWeight')!.innerText = `${maxWeight.toFixed(1)} kg`;
    document.getElementById('gymMaxMuscle')!.innerText = `${maxMuscle.toFixed(1)} kg`;
}