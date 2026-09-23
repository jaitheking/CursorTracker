// Global type declarations for Lucide icons
declare const lucide: any;

// Interfaces for the BUILDER (flat list created in the UI)
interface BuilderBlock {
    type: 'exercise' | 'rest';
    name?: string;
    equipment?: string;
    load?: string;
    sets?: string;
    reps?: string;
    rir?: string;
    duration?: string;
}

// Interfaces for CATALOG data (actual Supabase schema)
interface CatalogExercise {
    exercise_name: string;
    load_type: string;
    load_kg: number | null;
    sets: number;
    reps: number;
    reps_unit: string;
    rir: number | null;
    notes?: string;
}

interface CatalogBlock {
    name: string;
    rounds: number;
    exercises: CatalogExercise[];
}

interface CatalogWorkoutData {
    blocks: CatalogBlock[];
    rounds?: number;
    version?: number;
    category?: string;
    session_type?: string;
    rest_between_rounds_seconds?: number;
    source_session?: string;
}

interface Workout {
    id: string;
    name: string;
    description: string;
    label: string;
    workout_data: CatalogWorkoutData;
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
    const builderTitle = document.getElementById('builderTitle') as HTMLHeadingElement;
    const cancelEditBtn = document.getElementById('cancelEditBtn') as HTMLButtonElement;

    const workoutList = document.getElementById('workoutList') as HTMLDivElement;

    let blocksData: BuilderBlock[] = [];
    let allWorkouts: Workout[] = [];
    let editingId: string | null = null;

    // ── Tabs ──────────────────────────────────────────────────────────────────
    tabBuilder?.addEventListener('click', () => switchToBuilder());

    tabCatalog?.addEventListener('click', () => {
        tabCatalog.classList.add('active');
        tabBuilder.classList.remove('active');
        catalogPanel.classList.remove('hidden');
        builderPanel.classList.add('hidden');
        loadCatalog();
    });

    function switchToBuilder() {
        tabBuilder.classList.add('active');
        tabCatalog.classList.remove('active');
        builderPanel.classList.remove('hidden');
        catalogPanel.classList.add('hidden');
    }

    // ── Builder Blocks ─────────────────────────────────────────────────────────
    addExerciseBtn?.addEventListener('click', () => addBlock('exercise'));
    addRestBtn?.addEventListener('click', () => addBlock('rest'));

    function addBlock(type: 'exercise' | 'rest', values?: Partial<BuilderBlock>) {
        const templateId = type === 'exercise' ? 'exerciseBlockTemplate' : 'restBlockTemplate';
        const template = document.getElementById(templateId) as HTMLTemplateElement;
        const clone = template.content.cloneNode(true) as DocumentFragment;
        const blockEl = clone.querySelector('.workout-block') as HTMLDivElement;

        blockEl.dataset.type = type;

        // Pre-fill values when loading for edit
        if (values && type === 'exercise') {
            (blockEl.querySelector('.ex-name') as HTMLInputElement).value = values.name || '';
            const equipSelect = blockEl.querySelector('.ex-equip') as HTMLSelectElement;
            if (values.equipment) equipSelect.value = values.equipment;
            (blockEl.querySelector('.ex-load') as HTMLInputElement).value = values.load || '';
            (blockEl.querySelector('.ex-sets') as HTMLInputElement).value = values.sets || '';
            (blockEl.querySelector('.ex-reps') as HTMLInputElement).value = values.reps || '';
            (blockEl.querySelector('.ex-rir') as HTMLInputElement).value = values.rir || '';
        } else if (values && type === 'rest') {
            (blockEl.querySelector('.rest-duration') as HTMLInputElement).value = values.duration || '';
        }

        const removeBtn = blockEl.querySelector('.remove-block-btn') as HTMLButtonElement;
        removeBtn?.addEventListener('click', () => {
            blockEl.remove();
            updateTimeline();
        });

        blockEl.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', updateTimeline);
        });

        blockList?.appendChild(clone);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        updateTimeline();
    }

    function gatherWorkoutData(): BuilderBlock[] {
        const data: BuilderBlock[] = [];
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

    // ── Timeline (Builder) ─────────────────────────────────────────────────────
    function updateTimeline() {
        blocksData = gatherWorkoutData();
        if (!timelineGraph) return;
        timelineGraph.innerHTML = '';

        if (blocksData.length === 0) {
            timelineGraph.innerHTML = '<div class="text-muted" style="font-size:0.9rem;">Add blocks to see timeline...</div>';
            return;
        }

        blocksData.forEach(block => {
            const item = document.createElement('div');
            item.className = 'timeline-item ' + (block.type === 'rest' ? 'rest' : '');

            if (block.type === 'exercise') {
                const detailStr: string[] = [];
                if (block.load) detailStr.push(`Load: ${block.load}`);
                if (block.sets && block.reps) detailStr.push(`${block.sets}×${block.reps}`);
                if (block.rir) detailStr.push(`RIR: ${block.rir}`);

                item.innerHTML = `
                    <div style="font-weight:600;">${block.name}
                        <span style="font-size:0.73rem;font-weight:normal;color:var(--text-muted);">&nbsp;(${block.equipment})</span>
                    </div>
                    <div style="font-size:0.82rem;color:var(--text-muted);">${detailStr.join(' · ')}</div>
                `;
            } else {
                item.innerHTML = `<div style="color:var(--text-muted);font-style:italic;">⏱ Rest: ${block.duration}</div>`;
            }
            timelineGraph.appendChild(item);
        });
    }

    // ── Copy helpers ───────────────────────────────────────────────────────────
    function formatRepsStr(reps: number, reps_unit: string): string {
        switch (reps_unit) {
            case 'seconds': return `${reps}s hold`;
            case 'reps_per_side': return `${reps} reps/side`;
            case 'reps_per_direction': return `${reps} reps/dir`;
            default: return `${reps} reps`;
        }
    }

    function formatLoad(ex: CatalogExercise): string {
        return ex.load_kg ? `${ex.load_kg}kg ${ex.load_type}` : ex.load_type;
    }

    // Builder copy (flat blocks)
    function formatBuilderBlocksToText(name: string, desc: string, blocks: BuilderBlock[]): string {
        let text = `${name}\n`;
        if (desc) text += `${desc}\n`;
        text += `\n`;
        blocks.forEach(b => {
            if (b.type === 'exercise') {
                const details: string[] = [];
                if (b.load) details.push(`@ ${b.load}`);
                if (b.sets && b.reps) details.push(`${b.sets} sets × ${b.reps} reps`);
                if (b.rir) details.push(`(RIR: ${b.rir})`);
                text += `- ${b.name} (${b.equipment}) ${details.join(' ')}\n`;
            } else {
                text += `[ Rest: ${b.duration} ]\n`;
            }
        });
        return text;
    }

    /**
     * Catalog copy — two modes:
     *  'plan' → no RIR column  (for programming / sharing / evaluation)
     *  'log'  → adds "RIR: ___" blank per exercise to fill in during execution
     */
    function formatCatalogWorkoutToText(w: Workout, mode: 'plan' | 'log'): string {
        const wd = w.workout_data;
        let text = `${w.name}\n`;
        if (w.description) text += `${w.description}\n`;
        text += `\n`;
        if (wd.session_type) text += `Type: ${wd.session_type}\n`;
        if (wd.rest_between_rounds_seconds) text += `Rest between rounds: ${wd.rest_between_rounds_seconds}s\n`;
        text += `\n`;

        const blocks = wd.blocks ?? [];
        blocks.forEach(block => {
            text += `── ${block.name} (${block.rounds} round${block.rounds !== 1 ? 's' : ''}) ──\n`;
            block.exercises.forEach(ex => {
                const load = formatLoad(ex);
                const repsStr = formatRepsStr(ex.reps, ex.reps_unit);
                const notesStr = ex.notes ? ` (${ex.notes})` : '';
                if (mode === 'log') {
                    // Include a blank RIR field for each set so you can fill in during session
                    const setLines = Array.from({ length: ex.sets }, (_, i) =>
                        `    Set ${i + 1}: ${repsStr}  RIR: ___`
                    ).join('\n');
                    text += `  - ${ex.exercise_name} | ${load}${notesStr}\n${setLines}\n`;
                } else {
                    text += `  - ${ex.exercise_name} | ${load} | ${ex.sets} sets × ${repsStr}${notesStr}\n`;
                }
            });
            text += `\n`;
        });

        if (mode === 'log') text += `Session Notes:\n`;
        return text;
    }

    // ── Catalog timeline HTML ──────────────────────────────────────────────────
    function renderCatalogTimelineHTML(wd: CatalogWorkoutData): string {
        const blocks = wd.blocks ?? [];
        let html = '<div class="catalog-timeline">';
        blocks.forEach(block => {
            html += `<div class="ct-section-label">
                <span>${block.name}</span>
                <span class="ct-rounds-badge">${block.rounds}×</span>
            </div>`;
            block.exercises.forEach(ex => {
                const load = formatLoad(ex);
                const repsStr = formatRepsStr(ex.reps, ex.reps_unit);
                const notesStr = ex.notes ? `<span class="ct-notes">${ex.notes}</span>` : '';
                html += `
                    <div class="timeline-item">
                        <div style="font-weight:600;font-size:0.9rem;">${ex.exercise_name}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);">${load} &nbsp;&middot;&nbsp; ${ex.sets} sets × ${repsStr}${notesStr ? '&nbsp;&middot;&nbsp;' + notesStr : ''}</div>
                    </div>`;
            });
            if (wd.rest_between_rounds_seconds) {
                html += `<div class="timeline-item rest">
                    <div style="color:var(--text-muted);font-style:italic;font-size:0.82rem;">⏱ ${wd.rest_between_rounds_seconds}s rest between rounds</div>
                </div>`;
            }
        });
        html += '</div>';
        return html;
    }

    // ── Catalog → Builder conversion (for editing) ─────────────────────────────
    function mapLoadTypeToEquipment(loadType: string): string {
        const lower = (loadType || '').toLowerCase();
        if (lower.includes('pair')) return 'pair';
        if (lower.includes('single')) return 'single';
        if (lower.includes('barbell')) return 'barbell';
        if (lower.includes('bodyweight')) return 'bodyweight';
        return 'other';
    }

    function convertCatalogToBuilderBlocks(wd: CatalogWorkoutData): BuilderBlock[] {
        const result: BuilderBlock[] = [];
        const rest = wd.rest_between_rounds_seconds;
        const blocks = wd.blocks ?? [];
        blocks.forEach((block, bi) => {
            block.exercises.forEach(ex => {
                result.push({
                    type: 'exercise',
                    name: ex.exercise_name,
                    equipment: mapLoadTypeToEquipment(ex.load_type),
                    load: ex.load_kg ? `${ex.load_kg}kg` : '',
                    sets: String(ex.sets),
                    reps: String(ex.reps),
                    rir: ex.rir !== null && ex.rir !== undefined ? String(ex.rir) : ''
                });
            });
            // Insert rest between blocks (not after the last one)
            if (rest && bi < blocks.length - 1) {
                result.push({ type: 'rest', duration: `${rest}s` });
            }
        });
        return result;
    }

    function editWorkoutById(id: string) {
        const w = allWorkouts.find(x => x.id === id);
        if (!w) return;

        editingId = id;
        workoutName.value = w.name;
        workoutDesc.value = w.description || '';
        workoutLabel.value = w.label || '';

        if (builderTitle) builderTitle.textContent = 'Edit Workout';
        if (saveWorkoutBtn) {
            saveWorkoutBtn.innerHTML = '<i data-lucide="save" style="width:16px;height:16px;vertical-align:middle;"></i> Update Workout';
        }
        cancelEditBtn?.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();

        blockList.innerHTML = '';
        const builderBlocks = convertCatalogToBuilderBlocks(w.workout_data);
        builderBlocks.forEach(b => addBlock(b.type, b));

        switchToBuilder();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function resetBuilder() {
        editingId = null;
        workoutName.value = '';
        workoutDesc.value = '';
        workoutLabel.value = '';
        blockList.innerHTML = '';
        if (builderTitle) builderTitle.textContent = 'Create Workout';
        if (saveWorkoutBtn) {
            saveWorkoutBtn.innerHTML = '<i data-lucide="save" style="width:16px;height:16px;vertical-align:middle;"></i> Save to Catalog';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        cancelEditBtn?.classList.add('hidden');
        updateTimeline();
    }

    cancelEditBtn?.addEventListener('click', resetBuilder);

    // ── Builder: Copy Preview ──────────────────────────────────────────────────
    copyPreviewBtn?.addEventListener('click', async () => {
        const text = formatBuilderBlocksToText(workoutName.value || 'Custom Workout', workoutDesc.value, gatherWorkoutData());
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

    // ── Builder: Save / Update ─────────────────────────────────────────────────
    saveWorkoutBtn?.addEventListener('click', async () => {
        const name = workoutName.value.trim();
        if (!name) { alert('Please provide a workout name.'); return; }

        const data = gatherWorkoutData();
        if (data.length === 0) { alert('Please add at least one workout block.'); return; }

        function convertBuilderToCatalog(builderBlocks: BuilderBlock[]): CatalogWorkoutData {
            const catalogBlocks: CatalogBlock[] = [];
            let currentBlock: CatalogBlock | null = null;
            let restSeconds: number | undefined = undefined;
            
            builderBlocks.forEach(b => {
                if (b.type === 'exercise') {
                    if (!currentBlock) {
                        catalogBlocks.push({ name: 'Circuit ' + (catalogBlocks.length + 1), rounds: 1, exercises: [] });
                        currentBlock = catalogBlocks[catalogBlocks.length - 1];
                    }
                    
                    let load_kg = null;
                    if (b.load) { const num = parseFloat(b.load); if (!isNaN(num)) load_kg = num; }
                    
                    let reps = 0;
                    if (b.reps) { const num = parseInt(b.reps, 10); if (!isNaN(num)) reps = num; }
                    
                    let sets = 1;
                    if (b.sets) { const num = parseInt(b.sets, 10); if (!isNaN(num)) sets = num; }
                    
                    let rir = null;
                    if (b.rir) { const num = parseInt(b.rir, 10); if (!isNaN(num)) rir = num; }
                    
                    currentBlock.exercises.push({
                        exercise_name: b.name || 'Unnamed',
                        load_type: b.equipment || 'Other',
                        load_kg,
                        sets,
                        reps,
                        reps_unit: 'reps',
                        rir
                    });
                } else if (b.type === 'rest') {
                    if (b.duration) {
                        const num = parseInt(b.duration, 10);
                        if (!isNaN(num)) restSeconds = num;
                    }
                    currentBlock = null;
                }
            });
            
            return {
                blocks: catalogBlocks,
                rest_between_rounds_seconds: restSeconds,
                version: 1
            };
        }

        const payload: any = {
            name,
            description: workoutDesc.value,
            label: workoutLabel.value,
            workout_data: convertBuilderToCatalog(data)
        };
        if (editingId) payload.id = editingId;

        saveWorkoutBtn.disabled = true;
        saveWorkoutBtn.textContent = editingId ? 'Updating...' : 'Saving...';

        try {
            const res = await fetch('/api/save_workout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (res.ok) {
                alert(editingId ? 'Workout updated!' : 'Workout saved!');
                resetBuilder();
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (err: any) {
            console.error(err);
            alert('Failed to save workout: ' + err.message);
        } finally {
            saveWorkoutBtn.disabled = false;
            saveWorkoutBtn.innerHTML = editingId
                ? '<i data-lucide="save" style="width:16px;height:16px;vertical-align:middle;"></i> Update Workout'
                : '<i data-lucide="save" style="width:16px;height:16px;vertical-align:middle;"></i> Save to Catalog';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    });

    // ── Catalog: Load ──────────────────────────────────────────────────────────
    async function loadCatalog() {
        if (!workoutList) return;
        workoutList.innerHTML = '<p>Loading workouts...</p>';
        try {
            const res = await fetch('/api/get_workouts');
            const data = await res.json();
            if (res.ok) {
                allWorkouts = data.workouts ?? [];
                renderCatalog(allWorkouts);
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            workoutList.innerHTML = `<p style="color:red">Error loading catalog: ${err.message}</p>`;
        }
    }

    // ── Global callbacks for inline onclick handlers ────────────────────────────
    (window as any).copyWorkoutFromCatalog = async function(btn: HTMLButtonElement, id: string, mode: 'plan' | 'log') {
        const w = allWorkouts.find(x => x.id === id);
        if (!w) { alert('Workout not found.'); return; }
        const text = formatCatalogWorkoutToText(w, mode);
        try {
            await navigator.clipboard.writeText(text);
            const orig = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check" style="width:13px;height:13px;vertical-align:middle;"></i> Copied!';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            setTimeout(() => {
                btn.innerHTML = orig;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 2000);
        } catch {
            alert('Failed to copy.');
        }
    };

    (window as any).editWorkout = function(id: string) {
        editWorkoutById(id);
    };

    (window as any).toggleCatalogTimeline = function(id: string) {
        const container = document.getElementById(`ct-timeline-${id}`);
        const btn = document.getElementById(`ct-toggle-${id}`);
        if (!container) return;
        const isHidden = container.classList.toggle('hidden');
        if (btn) btn.textContent = isHidden ? '▸ View Timeline' : '▾ Hide Timeline';
    };

    (window as any).deleteWorkout = async function(id: string) {
        if (!confirm('Delete this workout from catalog?')) return;
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

    // ── Catalog: Render ─────────────────────────────────────────────────────────
    function renderCatalog(workouts: Workout[]) {
        if (!workoutList) return;
        if (!workouts || workouts.length === 0) {
            workoutList.innerHTML = '<p class="text-muted">No workouts saved yet. Go build one!</p>';
            return;
        }

        workoutList.innerHTML = workouts.map(w => {
            const totalEx = (w.workout_data.blocks ?? []).reduce((a, b) => a + b.exercises.length, 0);
            const blockNames = (w.workout_data.blocks ?? []).map(b => b.name).join(' → ');
            const timelineHTML = renderCatalogTimelineHTML(w.workout_data);

            return `
                <div class="workout-card">
                    <div class="workout-card-header">
                        <div style="flex:1;min-width:0;">
                            <div class="workout-card-title">${w.name}</div>
                            <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;align-items:center;">
                                ${w.label ? `<span class="workout-card-label">${w.label}</span>` : ''}
                                <span style="font-size:0.77rem;color:var(--text-muted);">${totalEx} exercises &middot; ${blockNames}</span>
                            </div>
                        </div>
                        <div style="display:flex;gap:4px;flex-shrink:0;">
                            <button onclick="editWorkout('${w.id}')" style="background:none;border:none;color:var(--primary-color);cursor:pointer;padding:4px;" title="Edit workout">
                                <i data-lucide="pencil" style="width:16px;height:16px;"></i>
                            </button>
                            <button onclick="deleteWorkout('${w.id}')" style="background:none;border:none;color:var(--error-color,#f44);cursor:pointer;padding:4px;" title="Delete">
                                <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                            </button>
                        </div>
                    </div>

                    ${w.description ? `<p style="font-size:0.86rem;color:var(--text-muted);margin:8px 0 0;">${w.description}</p>` : ''}

                    <button id="ct-toggle-${w.id}" onclick="toggleCatalogTimeline('${w.id}')"
                        style="background:none;border:none;color:var(--primary-color);cursor:pointer;font-size:0.82rem;padding:8px 0 0;display:flex;align-items:center;gap:4px;">
                        ▸ View Timeline
                    </button>
                    <div id="ct-timeline-${w.id}" class="hidden" style="margin-top:8px;">
                        ${timelineHTML}
                    </div>

                    <div class="workout-card-actions">
                        <button onclick="copyWorkoutFromCatalog(this,'${w.id}','plan')"
                            class="main-btn" style="padding:6px 10px;font-size:0.83rem;background:var(--surface-color);border:1px solid var(--border-color);flex:1;">
                            <i data-lucide="clipboard-list" style="width:13px;height:13px;vertical-align:middle;"></i> Copy Plan
                        </button>
                        <button onclick="copyWorkoutFromCatalog(this,'${w.id}','log')"
                            class="main-btn" style="padding:6px 10px;font-size:0.83rem;background:var(--primary-color);color:#fff;border:none;flex:1;">
                            <i data-lucide="pencil-line" style="width:13px;height:13px;vertical-align:middle;"></i> Copy Log
                        </button>
                    </div>
                </div>`;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Auto-load catalog if active on page load
    if (tabCatalog?.classList.contains('active')) loadCatalog();
});
