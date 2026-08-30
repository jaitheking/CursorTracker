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

    initializeThemeToggle();
    initializeCollapsibles();
    initializeSegmentTabs();
    initializePeriodControls();
    initializeAICoach();

    // Core computation pass
    calculatePerformanceAnalytics();
});

/* ── Theme Toggle ── */
function initializeThemeToggle(): void {
    const btn = document.getElementById('themeToggle');
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';

    btn?.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
    });
}

/* ── Collapsible Sections ── */
function initializeCollapsibles(): void {
    const sections = [
        { toggleId: 'navHubToggle',       sectionId: 'navHubSection',        storeKey: 'collapse_navHub' },
        { toggleId: 'trainingPlanToggle', sectionId: 'trainingPlanSection',  storeKey: 'collapse_trainingPlan' },
    ];

    sections.forEach(({ toggleId, sectionId, storeKey }) => {
        const toggle  = document.getElementById(toggleId);
        const section = document.getElementById(sectionId);
        if (!toggle || !section) return;

        // Restore saved state (default = expanded)
        const isCollapsed = localStorage.getItem(storeKey) === 'true';
        if (isCollapsed) section.classList.add('collapsed');

        toggle.addEventListener('click', () => {
            const nowCollapsed = section.classList.toggle('collapsed');
            localStorage.setItem(storeKey, nowCollapsed.toString());
        });
    });
}

// Handle Back/Forward Cache (bfcache) restorations
window.addEventListener('pageshow', (event: PageTransitionEvent) => {
    if (event.persisted) {
        initializeAICoach();
        calculatePerformanceAnalytics();
    }
});

/* ── Lightweight Markdown Renderer ── */
/**
 * Converts a subset of markdown to safe HTML for rendering AI coach plans.
 * Handles: headings (##, ###), bold (**), bullet lists, numbered lists,
 * horizontal rules (---), and preserves line breaks.
 */
function renderMarkdown(md: string): string {
    if (!md) return '';

    const lines = md.split('\n');
    const html: string[] = [];
    let inList = false;
    let listType = '';

    const closeList = () => {
        if (inList) {
            html.push(listType === 'ul' ? '</ul>' : '</ol>');
            inList = false;
            listType = '';
        }
    };

    for (let raw of lines) {
        const line = raw.trimEnd();

        // Horizontal rule
        if (/^[-*_]{3,}$/.test(line.trim())) {
            closeList();
            html.push('<hr class="md-hr">');
            continue;
        }

        // Headings
        const h3 = line.match(/^###\s+(.+)/);
        const h2 = line.match(/^##\s+(.+)/);
        const h1 = line.match(/^#\s+(.+)/);
        if (h1) { closeList(); html.push(`<h3 class="md-h1">${inlineFormat(h1[1])}</h3>`); continue; }
        if (h2) { closeList(); html.push(`<h4 class="md-h2">${inlineFormat(h2[1])}</h4>`); continue; }
        if (h3) { closeList(); html.push(`<h5 class="md-h3">${inlineFormat(h3[1])}</h5>`); continue; }

        // Unordered list
        const ul = line.match(/^[\-\*\+]\s+(.+)/);
        if (ul) {
            if (!inList || listType !== 'ul') { closeList(); html.push('<ul class="md-ul">'); inList = true; listType = 'ul'; }
            html.push(`<li>${inlineFormat(ul[1])}</li>`);
            continue;
        }

        // Ordered list
        const ol = line.match(/^\d+\.\s+(.+)/);
        if (ol) {
            if (!inList || listType !== 'ol') { closeList(); html.push('<ol class="md-ol">'); inList = true; listType = 'ol'; }
            html.push(`<li>${inlineFormat(ol[1])}</li>`);
            continue;
        }

        // Empty line — close list context and add spacing
        if (line.trim() === '') {
            closeList();
            html.push('<br>');
            continue;
        }

        // Normal paragraph
        closeList();
        html.push(`<p class="md-p">${inlineFormat(line)}</p>`);
    }

    closeList();
    return html.join('');
}

/** Apply inline formatting: bold, italic, inline-code */
function inlineFormat(text: string): string {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // escape HTML first
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="md-code">$1</code>');
}

/* ── AI Coach Plan Panel ── */
function initializeAICoach(): void {
    const hasContent   = document.getElementById('aiPlanHasContent');
    const emptyState   = document.getElementById('aiPlanEmptyState');
    const dateEl       = document.getElementById('aiCoachDate');
    const planContent  = document.getElementById('aiCoachPlanContent');
    const fullContent  = document.getElementById('fullscreenCoachPlanContent');
    const badge        = document.getElementById('planStatusBadge');
    const overlay      = document.getElementById('fullscreenCoachOverlay');

    const planStr = localStorage.getItem('cursor_weekly_plan');
    let plan: any[] = [];
    if (planStr) {
        try {
            plan = JSON.parse(planStr);
        } catch (e) {}
    }

    if (plan.length > 0) {
        hasContent?.classList.remove('hidden');
        emptyState?.classList.add('hidden');

        if (badge) {
            badge.textContent = 'Active';
            badge.style.background = 'rgba(34,197,94,0.12)';
            badge.style.color = '#22c55e';
            badge.style.borderColor = 'rgba(34,197,94,0.3)';
        }

        const dayLabel = document.getElementById('planCurrentDay');
        const jsDay = new Date().getDay(); 
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const todayName = dayNames[jsDay];

        let currentIndex = plan.findIndex((d: any) => d.day === todayName);
        if (currentIndex === -1) currentIndex = 0;

        const renderDay = (index: number) => {
            const dayData = plan[index];
            if (!dayData) return;
            if (dayLabel) dayLabel.innerText = dayData.day;
            
            const md = `### ${dayData.type}\n**Focus:** ${dayData.focus}\n\n${dayData.details}`;
            
            if (planContent) planContent.innerHTML = renderMarkdown(md);
            if (fullContent) fullContent.innerHTML = renderMarkdown(md);
        };

        renderDay(currentIndex);

        // Remove old listeners by cloning
        const prevBtn = document.getElementById('prevPlanDayBtn');
        if (prevBtn) {
            const freshPrev = prevBtn.cloneNode(true) as HTMLElement;
            prevBtn.parentNode?.replaceChild(freshPrev, prevBtn);
            freshPrev.addEventListener('click', () => {
                currentIndex = (currentIndex - 1 + plan.length) % plan.length;
                renderDay(currentIndex);
            });
        }

        const nextBtn = document.getElementById('nextPlanDayBtn');
        if (nextBtn) {
            const freshNext = nextBtn.cloneNode(true) as HTMLElement;
            nextBtn.parentNode?.replaceChild(freshNext, nextBtn);
            freshNext.addEventListener('click', () => {
                currentIndex = (currentIndex + 1) % plan.length;
                renderDay(currentIndex);
            });
        }
    } else {
        hasContent?.classList.add('hidden');
        emptyState?.classList.remove('hidden');
        if (badge) badge.textContent = 'No Plan';
    }

    // Avoid duplicate listeners on bfcache restore by cloning buttons
    const fsBtn = document.getElementById('fullscreenCoachBtn');
    if (fsBtn) {
        const fresh = fsBtn.cloneNode(true) as HTMLElement;
        fsBtn.parentNode?.replaceChild(fresh, fsBtn);
        fresh.addEventListener('click', () => overlay?.classList.remove('hidden'));
    }

    const closeBtn = document.getElementById('closeFullscreenCoachBtn');
    if (closeBtn) {
        const fresh = closeBtn.cloneNode(true) as HTMLElement;
        closeBtn.parentNode?.replaceChild(fresh, closeBtn);
        fresh.addEventListener('click', () => overlay?.classList.add('hidden'));
    }
}

function initializeSegmentTabs(): void {
    const btnRun = document.getElementById('tabRunning');
    const btnGym = document.getElementById('tabGym');
    const panelRun = document.getElementById('runningStatsPanel');
    const panelGym = document.getElementById('gymStatsPanel');

    btnRun?.addEventListener('click', () => {
        btnRun.classList.add('active');
        btnGym?.classList.remove('active');

        if (panelRun && panelGym) {
            panelRun.classList.remove('hidden');
            panelGym.classList.add('hidden');
        }
    });

    btnGym?.addEventListener('click', () => {
        btnGym.classList.add('active');
        btnRun?.classList.remove('active');

        if (panelRun && panelGym) {
            panelGym.classList.remove('hidden');
            panelRun.classList.add('hidden');
        }
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
 * Sanitizes older, mixed-format historical logs into a perfectly predictable 
 * structural syntax for reliable, crash-free downstream dashboard parsing.
 */
function sanitizeRawLogDashboardSummary(text: string): string {
    if (!text) return "";
    
    return text
        // 1. Strip mobile line carriage returns (\r) and trailing whitespaces
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        
        // 2. Clear out markdown bolding elements (**) that break regex limits
        .replace(/\*\*/g, '')
        
        // 3. Normalize common label variations to unified dashboard standards
        .replace(/Avg\s*Pace:/i, 'Average Pace:')
        .replace(/(⏱️|🏃‍♂️|🔹)?\s*Pace:/i, 'Average Pace:')
        .replace(/(🏃‍♂️|🔹)?\s*Distance:/i, 'Distance:')
        .replace(/(🏋️‍♂️|🔹)?\s*Type:/i, 'Type:')
        .trim();
}

/**
 * Computes analytics contextually based on the active viewDate period selection,
 * parsing raw data with absolute mathematical accuracy.
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
    const monthlyLabelEl = document.getElementById('monthlyLabel');
    const yearlyLabelEl = document.getElementById('yearlyLabel');
    if (monthlyLabelEl) monthlyLabelEl.innerText = `${months[viewDate.getMonth()].toUpperCase()} MILEAGE`;
    if (yearlyLabelEl) yearlyLabelEl.innerText = `${targetYearStr} TOTAL MILEAGE`;

    // Filter Repositories
    const runningLogs = logs.filter(l => l.type === 'Running');

    let monthlyMileage = 0;
    let yearlyMileage = 0;
    let maxDistance = 0;
    let periodTotalPaceSeconds = 0;
    let periodPaceCount = 0;
    let lifetimeFastestPaceSeconds = Infinity;

    // Process Running Logs
    runningLogs.forEach(log => {
        const cleanSummary = sanitizeRawLogDashboardSummary(log.summary);
        const cleanLogDate = log.date.trim();

        // High-precision clean regex matching
        const distMatch = cleanSummary.match(/Distance:\s*([0-9\.]+)/i);
        const paceMatch = cleanSummary.match(/Average Pace:\s*([0-9]+):([0-9]+)/i);

        if (distMatch) {
            const dist = parseFloat(distMatch[1]);

            // Period context filtering checks
            if (cleanLogDate.startsWith(targetMonthPrefix)) monthlyMileage += dist;
            if (cleanLogDate.startsWith(targetYearStr)) yearlyMileage += dist;
            if (dist > maxDistance) maxDistance = dist;

            if (paceMatch) {
                const mins = parseInt(paceMatch[1], 10);
                const secs = parseInt(paceMatch[2], 10);

                // Standardized exact 60-second clock conversion
                const totalSecs = (mins * 60) + secs;

                // Average calculation scoped directly to the selected period month
                if (cleanLogDate.startsWith(targetMonthPrefix)) {
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
    const periodGymLogs = logs.filter(l => l.type === 'Gym' && l.date.trim().startsWith(targetMonthPrefix));
    let periodGymCount = periodGymLogs.length;
    let maxWeight = 0;
    let maxMuscle = 0;
    let focusMap: { [key: string]: number } = {};

    periodGymLogs.forEach(log => {
        const cleanGymSummary = sanitizeRawLogDashboardSummary(log.summary);
        const weightMatch = cleanGymSummary.match(/Weight:\s*([0-9\.]+)/i);
        const muscleMatch = cleanGymSummary.match(/Muscle Mass:\s*([0-9\.]+)/i);
        const focusMatch = cleanGymSummary.match(/Focus:\s*([^\n]+)/i);

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

    // --- Render Elements to DOM with Safe Conditional Hooks ---
    const runMonthDistEl = document.getElementById('runMonthDist');
    const runYearDistEl = document.getElementById('runYearDist');
    const runMaxDistEl = document.getElementById('runMaxDist');

    if (runMonthDistEl) runMonthDistEl.innerHTML = `${monthlyMileage.toFixed(2)} <span class="unit">km</span>`;
    if (runYearDistEl) runYearDistEl.innerHTML = `${yearlyMileage.toFixed(2)} <span class="unit">km</span>`;
    if (runMaxDistEl) runMaxDistEl.innerText = `${maxDistance.toFixed(2)} km`;

    const avgPaceEl = document.getElementById('runAvgPace');
    if (avgPaceEl) {
        if (periodPaceCount > 0) {
            const avgSecs = periodTotalPaceSeconds / periodPaceCount;
            avgPaceEl.innerText = `${Math.floor(avgSecs / 60)}:${String(Math.floor(avgSecs % 60)).padStart(2, '0')} /km`;
        } else {
            avgPaceEl.innerText = '--:--';
        }
    }

    const fastPaceEl = document.getElementById('runFastPace');
    if (fastPaceEl) {
        if (lifetimeFastestPaceSeconds !== Infinity) {
            fastPaceEl.innerText = `${Math.floor(lifetimeFastestPaceSeconds / 60)}:${String(Math.floor(lifetimeFastestPaceSeconds % 60)).padStart(2, '0')} /km`;
        } else {
            fastPaceEl.innerText = '--:--';
        }
    }

    const gymTotalTimeEl = document.getElementById('gymTotalTime');
    const gymTotalCountEl = document.getElementById('gymTotalCount');
    const gymTopFocusEl = document.getElementById('gymTopFocus');
    const gymMaxWeightEl = document.getElementById('gymMaxWeight');
    const gymMaxMuscleEl = document.getElementById('gymMaxMuscle');

    if (gymTotalTimeEl) gymTotalTimeEl.innerHTML = `${periodGymCount * 45} <span class="unit">mins</span>`;
    if (gymTotalCountEl) gymTotalCountEl.innerHTML = `${periodGymCount} <span class="unit">logs</span>`;
    if (gymTopFocusEl) gymTopFocusEl.innerText = topFocus;
    if (gymMaxWeightEl) gymMaxWeightEl.innerText = `${maxWeight.toFixed(1)} kg`;
    if (gymMaxMuscleEl) gymMaxMuscleEl.innerText = `${maxMuscle.toFixed(1)} kg`;
}