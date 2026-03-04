// =========================================================
// ONBOARDING WIZARD MODULE
// =========================================================
const { ipcRenderer } = require('electron');
const { DESK_W, DESK_H, CANVAS_W } = require('./state');

let wizardStep = 1;
let wizardData = {
    className: '',
    students: [],
    roomTemplate: 'standard'
};

// Dependencies injected from main renderer (functions that can't be imported directly)
let deps = {};

function init(dependencies) {
    deps = dependencies;
}

function startOnboardingWizard() {
    document.getElementById('onboardingWizard').style.display = 'flex';
    wizardStep = 1;
    wizardData = { className: '', students: [], roomTemplate: 'standard' };
    renderWizardStep();
}

function renderWizardStep() {
    const content = document.getElementById('wizardContent');
    updateWizardProgress();

    switch (wizardStep) {
        case 1:
            content.innerHTML = `
                <h2>Velkommen til KlassePlass! 👋</h2>
                <p>La oss lage ditt første klassekart sammen. Først må vi opprette en klasse.</p>
                
                <div style="margin-top: 25px;">
                    <label class="form-label">Klassenavn</label>
                    <input type="text" id="wizardClassName" class="dark-input" placeholder="f.eks. 8A" value="${wizardData.className}">
                </div>
                
                <div style="margin-top: 20px;">
                    <label class="form-label">Elever (ett navn per linje)</label>
                    <textarea id="wizardStudents" class="dark-input" rows="8" placeholder="Ola Nordmann
Kari Hansen
Per Jensen
Anne Olsen
...">${wizardData.students.join('\n')}</textarea>
                </div>
            `;
            document.getElementById('btnWizPrev').style.display = 'none';
            document.getElementById('btnWizNext').innerHTML = 'Neste <i class="fas fa-arrow-right"></i>';
            break;

        case 2:
            const templates = [
                { id: 'standard', name: 'Standard', desc: '24 bord (4×6)' },
                { id: 'large', name: 'Stort', desc: '30 bord (5×6)' },
                { id: 'small', name: 'Lite', desc: '20 bord (4×5)' },
                { id: 'groups', name: 'Gruppebord', desc: '6 grupper à 4' }
            ];

            content.innerHTML = `
                <h2>Velg klasserom 🏫</h2>
                <p>Hvilket rom passer best for klassen <strong>${wizardData.className}</strong> med <strong>${wizardData.students.length} elever</strong>?</p>
                
                <div class="template-grid">
                    ${templates.map(t => `
                        <div class="template-card ${wizardData.roomTemplate === t.id ? 'selected' : ''}" onclick="selectTemplate('${t.id}')">
                            <h3>${t.name}</h3>
                            <p>${t.desc}</p>
                        </div>
                    `).join('')}
                </div>
            `;
            document.getElementById('btnWizPrev').style.display = 'inline-block';
            document.getElementById('btnWizNext').innerHTML = 'Neste <i class="fas fa-arrow-right"></i>';
            break;

        case 3:
            content.innerHTML = `
                <h2>Nesten ferdig! 🎉</h2>
                <p>Vi oppretter nå klassekartet for <strong>${wizardData.className}</strong> i et <strong>${getTemplateName(wizardData.roomTemplate)}</strong> klasserom.</p>
                
                <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 10px; padding: 20px; margin-top: 25px;">
                    <p style="margin: 0; color: #cbd5e1;">
                        <i class="fas fa-info-circle" style="color: var(--accent);"></i>
                        Elevene vil bli randomisert automatisk. Du kan alltid endre plassering senere!
                    </p>
                </div>
                
                <div style="margin-top: 25px;">
                    <strong style="display: block; margin-bottom: 10px;">Dine elever:</strong>
                    <div style="max-height: 150px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; font-size: 0.9rem; color: #94a3b8;">
                        ${wizardData.students.map((s, i) => `${i + 1}. ${s}`).join('<br>')}
                    </div>
                </div>
            `;
            document.getElementById('btnWizNext').innerHTML = '<i class="fas fa-check"></i> Opprett klassekart';
            break;
    }

    updateWizardButtons();
}

function updateWizardProgress() {
    for (let i = 1; i <= 3; i++) {
        const step = document.getElementById(`wizStep${i}`);
        if (i < wizardStep) {
            step.classList.remove('active');
            step.classList.add('completed');
        } else if (i === wizardStep) {
            step.classList.remove('completed');
            step.classList.add('active');
        } else {
            step.classList.remove('active', 'completed');
        }
    }
}

function updateWizardButtons() {
    // Handled in renderWizardStep
}

function wizardNext() {
    // Validate current step
    if (wizardStep === 1) {
        wizardData.className = document.getElementById('wizardClassName').value.trim();
        wizardData.students = document.getElementById('wizardStudents').value
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        if (!wizardData.className) {
            deps.showToast('Vennligst fyll ut klassenavn');
            return;
        }
        if (wizardData.students.length === 0) {
            deps.showToast('Vennligst legg til minst én elev');
            return;
        }
    }

    if (wizardStep === 3) {
        wizardFinish();
        return;
    }

    wizardStep++;
    renderWizardStep();
}

function wizardPrev() {
    wizardStep--;
    if (wizardStep < 1) wizardStep = 1;
    renderWizardStep();
}

function wizardSkip() {
    if (confirm('Er du sikker på at du vil hoppe over veiledningen?')) {
        closeWizard();
    }
}

function selectTemplate(templateId) {
    wizardData.roomTemplate = templateId;
    renderWizardStep(); // Re-render to update selected state
}

function getTemplateName(id) {
    const names = { standard: 'standard', large: 'stort', small: 'lite', groups: 'gruppebord' };
    return names[id] || id;
}

function generateTemplateLayout(template) {
    const layouts = {
        standard: { rows: 4, cols: [6] },
        large: { rows: 5, cols: [6] },
        small: { rows: 4, cols: [5] },
        groups: { rows: 3, cols: [2, 2, 2] }
    };

    const config = layouts[template] || layouts.standard;
    const desks = [];

    const aisle = 30;
    const rowGap = 20;
    let startY = 70;

    for (let r = 0; r < config.rows; r++) {
        const totalCols = config.cols.reduce((a, b) => a + b, 0);
        const totalAisles = Math.max(0, config.cols.length - 1);
        const rowWidth = (totalCols * DESK_W) + (totalAisles * aisle);
        let startX = (CANVAS_W - rowWidth) / 2;

        if (startX < 20) startX = 20;

        let currentX = startX;
        config.cols.forEach((groupSize, gIdx) => {
            for (let i = 0; i < groupSize; i++) {
                desks.push({ x: currentX, y: startY });
                currentX += DESK_W;
            }
            if (gIdx < config.cols.length - 1) currentX += aisle;
        });

        startY += DESK_H + rowGap;
    }

    return desks;
}

async function wizardFinish() {
    try {
        // Opprett klasse
        const classId = await ipcRenderer.invoke('save-class', null,
            wizardData.className, wizardData.students.join('\n'));

        // Opprett rom fra template
        const layout = generateTemplateLayout(wizardData.roomTemplate);
        const roomId = await ipcRenderer.invoke('save-room',
            getTemplateName(wizardData.roomTemplate) + ' rom', JSON.stringify(layout));

        // Opprett klassekart
        const chartName = `${wizardData.className} Klassekart`;
        const currentWeek = deps.getWeekNumber(new Date());

        const chartLayout = layout.map(p => ({
            ...p,
            type: p.type || 'single',
            capacity: p.capacity ?? 1,
            students: null,
            student: null,
            color: 'bg-default',
            locked: false,
            groupId: null
        }));

        deps.setCurrentChart({
            id: null,
            classId: classId,
            roomId: roomId,
            layout: chartLayout,
            allStudents: wizardData.students
        });

        document.getElementById('editChartName').value = chartName;
        document.getElementById('editChartComment').value = `Uke ${currentWeek} - ${currentWeek + 4}`;

        await deps.generateSeating(false);
        deps.renderSeating();

        // Merk wizard som fullført
        await ipcRenderer.invoke('save-setting', 'onboardingCompleted', true);

        // Lukk wizard og naviger til editor
        document.getElementById('onboardingWizard').style.display = 'none';
        deps.navTo('view-seating-editor');
        deps.loadNormalToolbar();

        deps.showToast('🎉 Ditt første klassekart er klart!');

    } catch (err) {
        console.error(err);
        deps.showToast('Feil: ' + err.message);
    }
}

async function closeWizard() {
    document.getElementById('onboardingWizard').style.display = 'none';
    await ipcRenderer.invoke('save-setting', 'onboardingCompleted', true);
    deps.navTo('view-charts-dashboard');
}

module.exports = {
    init,
    startOnboardingWizard,
    wizardNext,
    wizardPrev,
    wizardSkip,
    selectTemplate,
    closeWizard
};
