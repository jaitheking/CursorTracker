declare var Chart: any;
let runChartInstance: any = null;
let gymChartInstance: any = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('generateReviewBtn')?.addEventListener('click', generateReview);
    
    // Initialize date pickers to the current week (Monday - Sunday)
    const startDateInput = document.getElementById('startDate') as HTMLInputElement;
    const endDateInput = document.getElementById('endDate') as HTMLInputElement;
    
    if (startDateInput && endDateInput) {
        const today = new Date();
        const day = today.getDay();
        const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1); 
        
        const monday = new Date(today.setDate(diffToMonday));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        startDateInput.value = monday.toISOString().split('T')[0];
        endDateInput.value = sunday.toISOString().split('T')[0];
    }

    document.getElementById('preset2Weeks')?.addEventListener('click', () => {
        if (!startDateInput || !endDateInput) return;
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 14);
        startDateInput.value = start.toISOString().split('T')[0];
        endDateInput.value = end.toISOString().split('T')[0];
    });

    document.getElementById('preset1Month')?.addEventListener('click', () => {
        if (!startDateInput || !endDateInput) return;
        const end = new Date();
        const start = new Date();
        start.setMonth(end.getMonth() - 1);
        startDateInput.value = start.toISOString().split('T')[0];
        endDateInput.value = end.toISOString().split('T')[0];
    });

    renderLocalReview();
});

async function generateReview(): Promise<void> {
    const statusText = document.getElementById('reviewStatus');
    const outputPanel = document.getElementById('reviewOutputPanel');
    const chatModel = localStorage.getItem('ai_chat_model') || 'gemini-3.8-flash';
    
    const startDate = (document.getElementById('startDate') as HTMLInputElement)?.value;
    const endDate = (document.getElementById('endDate') as HTMLInputElement)?.value;

    if (!statusText || !outputPanel || !startDate || !endDate) return;

    statusText.innerText = `⏳ Analyzing performance data for ${startDate} to ${endDate} with ${chatModel}...`;

    try {
        const response = await fetch('/api/generate_review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatModel, startDate, endDate })
        });

        const data = await response.json();
        if (data.review) {
            statusText.innerText = "✅ Performance review generated!";
            
            // Append the date range to the review object for local storage tracking
            data.review.dateRange = `${startDate} to ${endDate}`;
            localStorage.setItem('cursor_performance_review', JSON.stringify(data.review));
            
            renderLocalReview();
        } else {
            statusText.innerText = "❌ Error: " + data.error;
        }
    } catch (err) {
        statusText.innerText = "❌ Network error communicating with AI.";
    }
}

function renderLocalReview(): void {
    const reviewStr = localStorage.getItem('cursor_performance_review');
    if (!reviewStr) return;

    const outputPanel = document.getElementById('reviewOutputPanel');
    if (!outputPanel) return;

    let review: any = null;
    try {
        review = JSON.parse(reviewStr);
    } catch (e) {
        console.error("Invalid JSON in local storage", e);
        return;
    }

    outputPanel.classList.remove('hidden');

    const setText = (id: string, text: string) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    const titleEl = document.getElementById('reviewTitle');
    if (titleEl && review.dateRange) {
        titleEl.innerText = `Performance Breakdown (${review.dateRange})`;
    } else if (titleEl) {
        titleEl.innerText = `Performance Breakdown`;
    }

    setText('reviewSummary', review.summary || 'No summary available.');

    const insightsEl = document.getElementById('reviewInsights');
    if (insightsEl) {
        insightsEl.innerHTML = '';
        if (Array.isArray(review.keyInsights)) {
            review.keyInsights.forEach((insight: string) => {
                const li = document.createElement('li');
                li.innerText = insight;
                insightsEl.appendChild(li);
            });
        }
    }

    // Render stats
    if (review.runningStats) {
        setText('runTotalDist', review.runningStats.totalDistance || '--');
        setText('runAvgPace', review.runningStats.avgPace || '--');
        setText('runAvgHR', review.runningStats.avgHR || '--');
    }
    if (review.strengthStats) {
        setText('strengthTotalTime', review.strengthStats.totalTime || '--');
        setText('strengthAvgHR', review.strengthStats.avgHR || '--');
    }

    const createGradient = (context: any, r: number, g: number, b: number) => {
        const chart = context.chart;
        const {ctx, chartArea} = chart;
        if (!chartArea) return null;

        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.35)`);   
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.1)`); 
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);   
        return gradient;
    };

    const commonDatasetOptions = {
        borderWidth: 3,
        tension: 0.4, 
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
        fill: true
    };

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1200, easing: 'easeOutQuart' },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1f2937',
                titleFont: { family: 'Inter', size: 13, weight: '600' },
                bodyFont: { family: 'Inter', size: 13 },
                padding: 12,
                cornerRadius: 8,
                displayColors: false,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#9ca3af', font: { family: 'Inter', size: 12 } }
            },
            y: {
                type: 'linear', display: true, position: 'left',
                grid: { color: 'rgba(156, 163, 175, 0.07)', drawBorder: false },
                ticks: { color: '#9ca3af', font: { family: 'Inter', size: 12 }, padding: 8 }
            },
            y1: {
                type: 'linear', display: true, position: 'right',
                grid: { drawOnChartArea: false },
                ticks: { color: '#9ca3af', font: { family: 'Inter', size: 12 }, padding: 8 }
            }
        },
        interaction: { mode: 'index', intersect: false }
    };

    // Chart.js rendering
    if (review.chartData && Array.isArray(review.chartData.labels)) {
        const labels = review.chartData.labels;
        
        const runCtx = document.getElementById('runChart') as HTMLCanvasElement;
        const gymCtx = document.getElementById('gymChart') as HTMLCanvasElement;

        if (runChartInstance) runChartInstance.destroy();
        if (gymChartInstance) gymChartInstance.destroy();

        if (runCtx && typeof Chart !== 'undefined') {
            runChartInstance = new Chart(runCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            ...commonDatasetOptions,
                            label: 'Pace (mins/km)',
                            data: review.chartData.runningPace || [],
                            borderColor: '#00f2fe',
                            pointHoverBackgroundColor: '#00f2fe',
                            backgroundColor: (ctx: any) => createGradient(ctx, 0, 242, 254),
                            yAxisID: 'y'
                        },
                        {
                            ...commonDatasetOptions,
                            label: 'Heart Rate (bpm)',
                            data: review.chartData.runningHR || [],
                            borderColor: '#ef4444',
                            pointHoverBackgroundColor: '#ef4444',
                            backgroundColor: (ctx: any) => createGradient(ctx, 239, 68, 68),
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: commonOptions as any
            });
        }

        if (gymCtx && typeof Chart !== 'undefined') {
            gymChartInstance = new Chart(gymCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            ...commonDatasetOptions,
                            label: 'Duration (mins)',
                            data: review.chartData.strengthDuration || [],
                            borderColor: '#10b981',
                            pointHoverBackgroundColor: '#10b981',
                            backgroundColor: (ctx: any) => createGradient(ctx, 16, 185, 129),
                            yAxisID: 'y'
                        },
                        {
                            ...commonDatasetOptions,
                            label: 'Heart Rate (bpm)',
                            data: review.chartData.strengthHR || [],
                            borderColor: '#ef4444',
                            pointHoverBackgroundColor: '#ef4444',
                            backgroundColor: (ctx: any) => createGradient(ctx, 239, 68, 68),
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: commonOptions as any
            });
        }
    }
}
