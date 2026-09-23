// Global type declarations for Lucide icons
declare const lucide: any;


interface WorkoutBlock {
    type: 'exercise' | 'rest';
    name?: string;
    equipment?: string;
    load?: string;
    sets?: string;
    reps?: string;
    rir?: string;
    duration?: string;
}

interface Workout {
    id: string;
    name: string;
    description: string;
    label: string;
    workout_data: WorkoutBlock[];
}

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const tabBuilder = document.getElementById('tabBuilder') as HTMLButtonElement;
    const tabCatalog = document.getElementById('tabCatalog') as HTMLButtonElement;
    const builderPanel = document.getElementById('builderPanel') as HTMLDivElement;
    const catalogPanel = document.getElementById('catalogPanel') as HTMLDivElement;
    
    const blockList = document.getElementById('blockList') as HTMLDivElement;
    const addExerciseBtn = document.getElementById('addExerciseBtn') as HTMLButtonElement;
    const addRestBtn = document.getElementById('addRestBtn') as HTMLButtonElement;
    const timelineGraph = document.getElementById('timelineGraph') as HTMLDivElement;
    
    const workoutName = document.getElementById('workoutName') as HTMLInputElement;
    const workoutDesc = document.getElementById('workoutDesc') as HTMLTextAreaElement;
    const workoutLabel = document.getElementById('workoutLabel') as HTMLInputElement;
    const saveWorkoutBtn = document.getElementById('saveWorkoutBtn') as HTMLButtonElement;
    const copyPreviewBtn = document.getElementById('copyPreviewBtn') as HTMLButtonElement;
    
    const workoutList = document.getElementById('workoutList') as HTMLDivElement;

    let blocksData: WorkoutBlock[] = [];

    // Tabs
    tabBuilder?.addEventListener('click', () => {
        tabBuilder.classList.add('active');
        tabCatalog.classList.remove('active');
        builderPanel.classList.remove('hidden');
        catalogPanel.classList.add('hidden');
    });

    tabCatalog?.addEventListener('click', () => {
        tabCatalog.classList.add('active');
        tabBuilder.classList.remove('active');
        catalogPanel.classList.remove('hidden');
        builderPanel.classList.add('hidden');
        loadCatalog();
    });

    // Builder Interactions
    addExerciseBtn?.addEventListener('click', () => addBlock('exercise'));
    addRestBtn?.addEventListener('click', () => addBlock('rest'));
    
    function addBlock(type: 'exercise' | 'rest') {
        const templateId = type === 'exercise' ? 'exerciseBlockTemplate' : 'restBlockTemplate';
        const template = document.getElementById(templateId) as HTMLTemplateElement;
        const clone = template.content.cloneNode(true) as DocumentFragment;
        const blockEl = clone.querySelector('.workout-block') as HTMLDivElement;
        
        blockEl.dataset.type = type;
        
        // Add delete listener
        const removeBtn = blockEl.querySelector('.remove-block-btn') as HTMLButtonElement;
        removeBtn?.addEventListener('click', () => {
            blockEl.remove();
            updateTimeline();
        });

        // Add input listeners for real-time timeline updates
        blockEl.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', updateTimeline);
        });

        blockList?.appendChild(clone);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        updateTimeline();
    }

    function gatherWorkoutData(): WorkoutBlock[] {
        const data: WorkoutBlock[] = [];
        const blocks = blockList?.querySelectorAll('.workout-block');
        blocks?.forEach(block => {
            const blockEl = block as HTMLDivElement;
            if (blockEl.dataset.type === 'exercise') {
                data.push({
                    type: 'exercise',
                    name: (blockEl.querySelector('.ex-name') as HTMLInputElement)?.value || 'Unnamed Exercise',
                    equipment: (blockEl.querySelector('.ex-equip') as HTMLSelectElement)?.value,
                    load: (blockEl.querySelector('.ex-load') as HTMLInputElement)?.value || '',
                    sets: (blockEl.querySelector('.ex-sets') as HTMLInputElement)?.value || '',
                    reps: (blockEl.querySelector('.ex-reps') as HTMLInputElement)?.value || '',
                    rir: (blockEl.querySelector('.ex-rir') as HTMLInputElement)?.value || ''
                });
            } else if (blockEl.dataset.type === 'rest') {
                data.push({
                    type: 'rest',
                    duration: (blockEl.querySelector('.rest-duration') as HTMLInputElement)?.value || '0s'
                });
            }
        });
        return data;
    }

    function updateTimeline() {
        blocksData = gatherWorkoutData();
        if (!timelineGraph) return;

        timelineGraph.innerHTML = '';
        
        if (blocksData.length === 0) {
            timelineGraph.innerHTML = '<div class="text-muted" style="font-size: 0.9rem;">Add blocks to see timeline...</div>';
            return;
        }

        blocksData.forEach(block => {
            const item = document.createElement('div');
            item.className = 'timeline-item ' + (block.type === 'rest' ? 'rest' : '');
            
            if (block.type === 'exercise') {
                let detailStr: string[] = [];
                if (block.load) detailStr.push(`Load: ${block.load}`);
                if (block.sets && block.reps) detailStr.push(`${block.sets}x${block.reps}`);
                if (block.rir) detailStr.push(`RIR: ${block.rir}`);
                
                item.innerHTML = `
                    <div style="font-weight: bold;">${block.name} <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-muted);">(${block.equipment})</span></div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">${detailStr.join(' | ')}</div>
                `;
            } else {
                item.innerHTML = `
                    <div style="color: var(--text-muted); font-style: italic;">Rest: ${block.duration}</div>
                `;
            }
            timelineGraph.appendChild(item);
        });
    }

    function formatWorkoutToText(name: string, desc: string, blocks: WorkoutBlock[]): string {
        let text = `${name}\n`;
        if (desc) text += `${desc}\n`;
        text += `\n`;
        
        blocks.forEach(b => {
            if (b.type === 'exercise') {
                let details: string[] = [];
                if (b.load) details.push(`@ ${b.load}`);
                if (b.sets && b.reps) details.push(`${b.sets} sets x ${b.reps} reps`);
                if (b.rir) details.push(`(RIR: ${b.rir})`);
                text += `- ${b.name} (${b.equipment}) ${details.join(' ')}\n`;
            } else {
                text += `[ Rest: ${b.duration} ]\n`;
            }
        });
        return text;
    }

    copyPreviewBtn?.addEventListener('click', async () => {
        const text = formatWorkoutToText(workoutName.value || 'Custom Workout', workoutDesc.value, gatherWorkoutData());
        try {
            await navigator.clipboard.writeText(text);
            const orig = copyPreviewBtn.innerHTML;
            copyPreviewBtn.innerHTML = '<i data-lucide="check" style="width:16px;height:16px;vertical-align:middle;"></i> Copied!';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            setTimeout(() => {
                copyPreviewBtn.innerHTML = orig;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 2000);
        } catch (err) {
            console.error('Failed to copy', err);
            alert('Failed to copy text.');
        }
    });

    saveWorkoutBtn?.addEventListener('click', async () => {
        const name = workoutName.value.trim();
        if (!name) {
            alert('Please provide a workout name.');
            return;
        }
        
        const data = gatherWorkoutData();
        if (data.length === 0) {
            alert('Please add at least one workout block.');
            return;
        }

        const payload = {
            name: name,
            description: workoutDesc.value,
            label: workoutLabel.value,
            workout_data: data
        };

        saveWorkoutBtn.disabled = true;
        saveWorkoutBtn.textContent = 'Saving...';

        try {
            const res = await fetch('/api/save_workout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (res.ok) {
                alert('Workout saved successfully!');
                // Clear form
                workoutName.value = '';
                workoutDesc.value = '';
                workoutLabel.value = '';
                blockList.innerHTML = '';
                updateTimeline();
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (err: any) {
            console.error(err);
            alert('Failed to save workout: ' + err.message);
        } finally {
            saveWorkoutBtn.disabled = false;
            saveWorkoutBtn.innerHTML = '<i data-lucide="save" style="width:16px;height:16px;vertical-align:middle;"></i> Save to Catalog';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    });

    // Catalog Logic
    async function loadCatalog() {
        if (!workoutList) return;
        workoutList.innerHTML = '<p>Loading workouts...</p>';
        try {
            const res = await fetch('/api/get_workouts');
            const data = await res.json();
            if (res.ok) {
                renderCatalog(data.workouts);
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            workoutList.innerHTML = `<p style="color:red">Error loading catalog: ${err.message}</p>`;
        }
    }

    (window as any).copyWorkoutFromCatalog = async function(btn: HTMLButtonElement, id: string) {
        const card = btn.closest('.workout-card') as HTMLDivElement;
        const text = card.dataset.rawText || '';
        try {
            await navigator.clipboard.writeText(text);
            const orig = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check" style="width:16px;height:16px;vertical-align:middle;"></i> Copied!';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            setTimeout(() => {
                btn.innerHTML = orig;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 2000);
        } catch (err) {
            alert('Failed to copy.');
        }
    };

    (window as any).deleteWorkout = async function(id: string) {
        if (!confirm('Are you sure you want to delete this workout?')) return;
        
        try {
            const res = await fetch('/api/delete_workout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                loadCatalog();
            } else {
                const data = await res.json();
                throw new Error(data.error);
            }
        } catch (err: any) {
            alert('Error deleting: ' + err.message);
        }
    };

    function renderCatalog(workouts: Workout[]) {
        if (!workoutList) return;
        
        if (!workouts || workouts.length === 0) {
            workoutList.innerHTML = '<p class="text-muted">No workouts saved yet. Go build one!</p>';
            return;
        }

        workoutList.innerHTML = workouts.map(w => {
            const rawText = formatWorkoutToText(w.name, w.description, w.workout_data);
            const escapedText = rawText.replace(/"/g, '&quot;');
            
            return `
                <div class="workout-card" data-raw-text="${escapedText}">
                    <div class="workout-card-header">
                        <div>
                            <div class="workout-card-title">${w.name}</div>
                            ${w.label ? `<span class="workout-card-label">${w.label}</span>` : ''}
                        </div>
                        <button onclick="deleteWorkout('${w.id}')" style="background:none;border:none;color:var(--error-color);cursor:pointer;" title="Delete">
                            <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                        </button>
                    </div>
                    ${w.description ? `<p style="font-size:0.9rem; color:var(--text-muted); margin-top:8px;">${w.description}</p>` : ''}
                    
                    <div class="workout-card-actions">
                        <button onclick="copyWorkoutFromCatalog(this, '${w.id}')" class="main-btn" style="padding: 6px 12px; font-size: 0.9rem; background-color: var(--background-color); border: 1px solid var(--border-color);">
                            <i data-lucide="copy" style="width:14px;height:14px;vertical-align:middle;"></i> Copy text
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    // Automatically initialize first tab layout if active
    if (tabCatalog?.classList.contains('active')) {
        loadCatalog();
    }
});
