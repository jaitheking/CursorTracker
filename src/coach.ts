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