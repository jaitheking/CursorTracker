document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('generatePlanBtn')?.addEventListener('click', fetchWeeklyPlan);
    
    // Restore & persist model selections
    const chatModelSelect = document.getElementById('chatModelSelect') as HTMLSelectElement | null;
    const embeddingModelSelect = document.getElementById('embeddingModelSelect') as HTMLSelectElement | null;

    if (chatModelSelect) {
        const saved = localStorage.getItem('ai_chat_model');
        if (saved) chatModelSelect.value = saved;
        chatModelSelect.addEventListener('change', () => {
            localStorage.setItem('ai_chat_model', chatModelSelect.value);
        });
    }
    if (embeddingModelSelect) {
        const saved = localStorage.getItem('ai_embedding_model');
        if (saved) embeddingModelSelect.value = saved;
        embeddingModelSelect.addEventListener('change', () => {
            localStorage.setItem('ai_embedding_model', embeddingModelSelect.value);
        });
    }

    renderLocalPlan();
});

async function fetchWeeklyPlan(): Promise<void> {
    const promptInput = (document.getElementById('coachPrompt') as HTMLTextAreaElement).value;
    const planStatus = document.getElementById('planStatus');
    const outputPanel = document.getElementById('coachOutputPanel');
    const chatModel = (document.getElementById('chatModelSelect') as HTMLSelectElement)?.value || 'gemini-3.8-flash';
    const embeddingModel = (document.getElementById('embeddingModelSelect') as HTMLSelectElement)?.value || 'gemini-embedding-exp-03-07';

    if (!planStatus || !outputPanel) return;

    planStatus.innerText = `⏳ Generating 7-day plan with ${chatModel}...`;

    try {
        const response = await fetch('/api/generate_weekly_plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userPrompt: promptInput, chatModel, embeddingModel })
        });

        const data = await response.json();
        if (data.plan) {
            planStatus.innerText = "✅ Plan generated successfully!";
            localStorage.setItem('cursor_weekly_plan', JSON.stringify(data.plan));
            renderLocalPlan();
        } else {
            planStatus.innerText = "❌ Error: " + data.error;
        }
    } catch (err) {
        planStatus.innerText = "❌ Network error communicating with AI.";
    }
}

function renderLocalPlan(): void {
    const planStr = localStorage.getItem('cursor_weekly_plan');
    if (!planStr) return;

    const outputPanel = document.getElementById('coachOutputPanel');
    const container = document.getElementById('weeklyPlanContainer');
    if (!outputPanel || !container) return;

    let plan = [];
    try {
        plan = JSON.parse(planStr);
    } catch (e) {
        console.error("Invalid JSON in local storage", e);
        return;
    }

    outputPanel.classList.remove('hidden');
    container.innerHTML = '';

    plan.forEach((dayPlan: any, index: number) => {
        const card = document.createElement('div');
        card.className = 'day-card';
        card.innerHTML = `
            <h4>${dayPlan.day} - ${dayPlan.type}</h4>
            <p><strong>Focus:</strong> ${dayPlan.focus}</p>
            <p>${dayPlan.details.replace(/\n/g, '<br>')}</p>
            <button class="secondary-btn edit-day-btn" data-index="${index}">✏️ Edit with AI</button>
        `;
        container.appendChild(card);
    });

    document.querySelectorAll('.edit-day-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = (e.target as HTMLElement).getAttribute('data-index');
            if (index !== null) {
                promptDayEdit(parseInt(index, 10), plan);
            }
        });
    });
}

async function promptDayEdit(index: number, fullPlan: any[]): Promise<void> {
    const userPrompt = prompt(`What would you like to change about ${fullPlan[index].day}? (e.g., "Make it a rest day", "Add core exercises")`);
    if (!userPrompt) return;

    const chatModel = (document.getElementById('chatModelSelect') as HTMLSelectElement)?.value || 'gemini-8-flash';
    const planStatus = document.getElementById('planStatus');
    if (planStatus) planStatus.innerText = `⏳ Updating ${fullPlan[index].day}...`;

    try {
        const response = await fetch('/api/update_day_plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentDayPlan: fullPlan[index], userPrompt, chatModel })
        });

        const data = await response.json();
        if (data.updatedPlan) {
            fullPlan[index] = data.updatedPlan;
            localStorage.setItem('cursor_weekly_plan', JSON.stringify(fullPlan));
            renderLocalPlan();
            if (planStatus) planStatus.innerText = `✅ ${fullPlan[index].day} updated successfully!`;
        } else {
            if (planStatus) planStatus.innerText = "❌ Error: " + data.error;
        }
    } catch (err) {
        if (planStatus) planStatus.innerText = "❌ Network error updating day.";
    }
}