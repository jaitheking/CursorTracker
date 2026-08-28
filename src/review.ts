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

    renderLocalReview();
});

async function generateReview(): Promise<void> {
    const statusText = document.getElementById('reviewStatus');
    const outputPanel = document.getElementById('reviewOutputPanel');
    const chatModel = localStorage.getItem('ai_chat_model') || 'gemini-3.7-flash';
    
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

    let review = null;
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
        titleEl.innerText = `Weekly Breakdown (${review.dateRange})`;
    } else if (titleEl) {
        titleEl.innerText = `Weekly Breakdown`;
    }

    setText('reviewSummary', review.summary || 'No summary available.');
    setText('reviewVolume', review.volumeProgression || 'No data.');
    setText('reviewEconomy', review.runningEconomy || 'No data.');
    setText('reviewFatigue', review.fatigueReadiness || 'No data.');

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
}
