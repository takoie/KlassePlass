const { ipcRenderer } = require('electron');

const DESK_W = 85;
const DESK_H = 55;
const SNAP_THRESHOLD = 15;
const GROUP_COLORS = [
    '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981',
    '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
    '#06b6d4', '#d946ef', '#e11d48', '#22c55e', '#64748b'
];
const CANVAS_W = 920;

// Desk type specifications
const DESK_TYPES = {
    single: { width: 85, height: 55, capacity: 1 },
    round3: { width: 90, height: 90, capacity: 3 },
    round4: { width: 110, height: 110, capacity: 4 },
    round6: { width: 130, height: 130, capacity: 6 },
    bench2: { width: 170, height: 55, capacity: 2 },
    bench4: { width: 170, height: 110, capacity: 4 }
};


// --- APP STATE ---
let editingId = null;
let currentChart = { id: null, classId: null, roomId: null, layout: [], allStudents: [] };
let modalCallback = null;
let deleteCallback = null;
let confirmCallback = null;
let rightClickedDesk = null;
let selectedSeatingDeskIdx = null;

// Group Mode State
let isGroupMode = false;
let selectedDesksForGroup = [];
let groupCounter = 0;

// Room Editor Selection State
let selectedDesks = [];

// --- WINDOW CONTROLS ---
function minimizeApp() { ipcRenderer.send('app:minimize'); }
function maximizeApp() { ipcRenderer.send('app:maximize'); }
function closeApp() { ipcRenderer.send('app:close'); }

// --- NAVIGATION ---
function navTo(view) {
    document.querySelectorAll('.view-section').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));

    let navId = '';

    if (view === 'view-class-create' || view === 'view-group-create' || view === 'view-room-create' || view === 'view-seating-create') {
        navId = 'nav-create';
    }
    else if (view === 'view-groups' || view === 'view-group-editor' || view === 'view-classes' || view === 'view-class-editor') {
        navId = 'nav-groups';
    }
    else if (view.includes('room')) navId = 'nav-rooms';
    else if (view.includes('chart') || view.includes('seating')) navId = 'nav-charts';

    if (navId) {
        const navEl = document.getElementById(navId);
        if (navEl) navEl.classList.add('active');
    }

    if (view === 'view-class-create' || view === 'view-group-create') { openClassCreate(); view = 'view-group-editor'; }
    if (view === 'view-room-create') { openRoomCreate(); view = 'view-room-editor'; }
    if (view === 'view-seating-create') { openSeatingSetup(); view = 'view-seating-setup'; }
    if (view === 'view-seating-edit') { view = 'view-seating-editor'; }

    // Fallback for old view names
    if (view === 'view-classes') view = 'view-groups';
    if (view === 'view-class-editor') view = 'view-group-editor';

    document.getElementById(view).classList.add('active');

    // Reset Modes
    isGroupMode = false;
    selectedDesksForGroup = [];
    selectedDesks = [];
    const btn = document.getElementById('btnGroupMode');
    const confirmBtn = document.getElementById('btnConfirmGroup');
    if (btn) {
        btn.classList.remove('btn-group-mode');
        // VIKTIG: Vi endrer IKKE teksten her lenger, kun fargen (via klassen)
        // btn.innerHTML = '<i class="fas fa-object-group"></i> Lag Grupper'; 
    }
    if (confirmBtn) confirmBtn.style.display = 'none';

    if (view === 'view-groups') loadClasses();
    if (view === 'view-rooms') loadRooms();
    if (view === 'view-charts-dashboard') loadCharts();
    if (view === 'view-seating-setup') loadSetup();
}

function toggleDrawer() {
    document.getElementById('createDrawer').classList.toggle('open');
    document.getElementById('drawerIcon').classList.toggle('rotate-icon');
}
function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

// --- STANDARD VISNING (PREFERANSE) ---
function toggleDefaultFlip() {
    const isChecked = document.getElementById('defaultFlipToggle').checked;
    localStorage.setItem('defaultFlipped', isChecked ? 'yes' : 'no');
    applyDefaultFlip('seatingCanvas');
    applyDefaultFlip('displayCanvas');
}

function applyDefaultFlip(canvasId) {
    const isFlipped = localStorage.getItem('defaultFlipped') === 'yes';
    const canvas = document.getElementById(canvasId);
    if (canvas) {
        if (isFlipped) {
            canvas.classList.add('flipped');
        } else {
            canvas.classList.remove('flipped');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const isFlipped = localStorage.getItem('defaultFlipped') === 'yes';
    const toggle = document.getElementById('defaultFlipToggle');
    if (toggle) toggle.checked = isFlipped;

    // Sjekk om onboarding wizard skal vises
    const hasCompletedOnboarding = localStorage.getItem('onboardingCompleted');
    if (!hasCompletedOnboarding) {
        startOnboardingWizard();
    }
});

// --- MODAL SYSTEM ---
function openModal(title, val, cb) {
    document.getElementById('customModal').style.display = 'flex';
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalInput').value = val;
    modalCallback = cb;
    document.getElementById('modalInput').focus();
}
function closeModal(save) {
    document.getElementById('customModal').style.display = 'none';
    if (save && modalCallback) modalCallback(document.getElementById('modalInput').value);
}
function openDeleteModal(action) {
    deleteCallback = action;
    document.getElementById('deleteModal').style.display = 'flex';
}
function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    deleteCallback = null;
}
function confirmDeleteAction() {
    if (deleteCallback) deleteCallback();
    closeDeleteModal();
}

function openConfirmModal(title, message, cb) {
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMessage').innerText = message;
    document.getElementById('confirmModal').style.display = 'flex';
    confirmCallback = cb;
}
function closeConfirmModal(result) {
    document.getElementById('confirmModal').style.display = 'none';
    if (confirmCallback) confirmCallback(result);
}

// ABOUT MODAL
function openAboutModal() { document.getElementById('aboutModal').style.display = 'flex'; }
function closeAboutModal() { document.getElementById('aboutModal').style.display = 'none'; }

// =========================================================
// PRESENTATION / NEW WINDOW FUNCTION
// =========================================================
function openPresentationWindow() {
    if (!currentChart || !currentChart.layout) return showToast("Ingen data å vise");
    const isFlipped = localStorage.getItem('defaultFlipped') === 'yes';
    const dataToSend = { layout: currentChart.layout, defaultFlipped: isFlipped };
    ipcRenderer.send('open-presentation-window', JSON.stringify(dataToSend));
}

// =========================================================
// SELECTION LOGIC (ROOM EDITOR)
// =========================================================
const roomContainer = document.getElementById('roomContainer');
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionBox = null;

roomContainer.onmousedown = (e) => {
    if (e.target.closest('.desk')) return;

    if (!e.shiftKey) {
        selectedDesks.forEach(d => d.classList.remove('is-selected'));
        selectedDesks = [];
    }

    isSelecting = true;
    selectionStart = {
        x: e.pageX + roomContainer.scrollLeft,
        y: e.pageY + roomContainer.scrollTop
    };

    selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    selectionBox.style.left = selectionStart.x + 'px';
    selectionBox.style.top = selectionStart.y + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    document.body.appendChild(selectionBox);
};

window.addEventListener('mousemove', (e) => {
    if (!isSelecting || !selectionBox) return;

    const currentX = e.pageX + roomContainer.scrollLeft;
    const currentY = e.pageY + roomContainer.scrollTop;

    const width = currentX - selectionStart.x;
    const height = currentY - selectionStart.y;

    selectionBox.style.width = Math.abs(width) + 'px';
    selectionBox.style.height = Math.abs(height) + 'px';
    selectionBox.style.left = (width > 0 ? selectionStart.x : currentX) + 'px';
    selectionBox.style.top = (height > 0 ? selectionStart.y : currentY) + 'px';
});

window.addEventListener('mouseup', (e) => {
    if (!isSelecting) return;
    isSelecting = false;

    if (selectionBox) {
        const rect = selectionBox.getBoundingClientRect();
        const desks = Array.from(document.querySelectorAll('#roomCanvas .desk'));

        desks.forEach(desk => {
            const deskRect = desk.getBoundingClientRect();
            if (rect.left < deskRect.right && rect.right > deskRect.left &&
                rect.top < deskRect.bottom && rect.bottom > deskRect.top) {

                if (!selectedDesks.includes(desk)) {
                    selectedDesks.push(desk);
                    desk.classList.add('is-selected');
                }
            }
        });

        selectionBox.remove();
        selectionBox = null;
    }
});

// =========================================================
// CLASS LOGIC
// =========================================================
async function loadClasses() {
    const classes = await ipcRenderer.invoke('get-classes');
    const grid = document.getElementById('classGrid'); grid.innerHTML = '';
    classes.forEach(c => {
        const count = c.students ? c.students.split('\n').filter(s => s.trim()).length : 0;
        grid.innerHTML += `
            <div class="info-card" onclick="editClass(${c.id})">
                <h5 class="card-title-large">${c.name}</h5>
                <span class="card-info-text">${count} Elever</span>
                <button class="btn-action btn-danger btn-sm-action" style="position:absolute; bottom:15px; right:15px;" 
                onclick="event.stopPropagation(); openDeleteModal(() => deleteClass(${c.id}))">Slett</button>
            </div>`;
    });
}
function openClassCreate() {
    editingId = null;
    document.getElementById('classIdInput').value = '';
    document.getElementById('classNameInput').value = '';
    document.getElementById('studentListInput').value = '';
    document.getElementById('classEditorTitle').innerText = "Opprett gruppe";
    document.getElementById('btnClassDelete').style.display = 'none';
}
async function editClass(id) {
    editingId = id;
    const c = await ipcRenderer.invoke('get-class', id);
    document.getElementById('classIdInput').value = c.id;
    document.getElementById('classEditorTitle').innerText = "Rediger: " + c.name;
    document.getElementById('classNameInput').value = c.name;
    document.getElementById('studentListInput').value = c.students;
    document.getElementById('btnClassDelete').style.display = 'block';
    navTo('view-group-editor');
}
async function saveClass() {
    const name = document.getElementById('classNameInput').value;
    const students = document.getElementById('studentListInput').value;
    if (!name) return showToast("Mangler navn");
    await ipcRenderer.invoke('save-class', editingId, name, students);
    showToast("Lagret"); navTo('view-groups');
}
async function deleteClass(id) {
    await ipcRenderer.invoke('delete-class', id || editingId);
    showToast("Slettet"); navTo('view-groups');
}

// =========================================================
// ROOM LOGIC
// =========================================================
function openRoomCreate() {
    editingId = null;
    document.getElementById('roomEditorTitle').innerText = "Opprett rom";
    document.getElementById('roomNameInput').value = '';
    document.getElementById('btnRoomDelete').style.display = 'none';
    clearCanvas();
}
async function loadRooms() {
    const rooms = await ipcRenderer.invoke('get-rooms');
    const grid = document.getElementById('roomGrid'); grid.innerHTML = '';
    rooms.forEach(r => {
        const l = JSON.parse(r.layout_data || '[]');
        grid.innerHTML += `
            <div class="info-card" onclick="editRoom(${r.id})">
                <span class="card-label-small">ROM</span>
                <h5 class="card-title-large">${r.name}</h5>
                <span class="card-info-text">${l.length} Bord</span>
                <button class="btn-action btn-danger btn-sm-action" style="position:absolute; bottom:15px; right:15px;" 
                onclick="event.stopPropagation(); openDeleteModal(() => deleteRoom(${r.id}))">Slett</button>
            </div>`;
    });
}
async function editRoom(id) {
    editingId = id;
    const rooms = await ipcRenderer.invoke('get-rooms');
    const r = rooms.find(x => x.id == id);
    document.getElementById('roomEditorTitle').innerText = "Rediger: " + r.name;
    document.getElementById('roomNameInput').value = r.name;
    document.getElementById('btnRoomDelete').style.display = 'block';
    renderRoomCanvas(JSON.parse(r.layout_data));
    navTo('view-room-editor');
}
function renderRoomCanvas(layout) {
    const c = document.getElementById('roomCanvas');
    c.innerHTML = '<div class="front-board">TAVLE</div>';

    layout.forEach(d => {
        const type = d.type || 'single';  // Default to single if no type
        spawnDesk(d.x, d.y, c, type);

        // Apply rotation if it exists
        if (d.rotation && d.rotation !== 0) {
            const desk = c.lastElementChild; // Get the desk we just spawned
            desk.dataset.rotation = d.rotation;
            desk.classList.add(`rotated-${d.rotation}`);
        }
    });

    updateDeskNumbers();
}

function ensureCanvasHeight(yPos) {
    const canvas = document.getElementById('roomCanvas');
    const currentHeight = canvas.clientHeight;
    if (yPos + DESK_H + 50 > currentHeight) {
        canvas.style.height = (yPos + DESK_H + 100) + 'px';
    }
}

function generateLayout() {
    const preset = document.getElementById('roomPreset').value;
    const rows = parseInt(document.getElementById('roomRows').value) || 4;
    if (!preset) return;

    const canvas = document.getElementById('roomCanvas');
    canvas.innerHTML = '<div class="front-board">TAVLE</div>';
    canvas.style.height = '100%';

    const groups = preset.split(',').map(Number);
    const gap = 0;
    const aisle = 30; // 30px
    const rowGap = 20; // 20px

    const totalCols = groups.reduce((a, b) => a + b, 0);
    const totalAisles = Math.max(0, groups.length - 1);
    let rowWidth = (totalCols * DESK_W) + (totalCols * gap) + (totalAisles * aisle) - gap;

    // START 70px
    let startY = 70;

    for (let r = 0; r < rows; r++) {
        let startX = (CANVAS_W - rowWidth) / 2;
        if (startX < 20) startX = 20;

        let currentX = startX;
        groups.forEach((gSize, gIdx) => {
            for (let i = 0; i < gSize; i++) {
                spawnDesk(currentX, startY, canvas);
                currentX += DESK_W + gap;
            }
            if (gIdx < groups.length - 1) currentX += aisle;
        });
        startY += DESK_H + rowGap;
    }
    updateDeskNumbers();
}

function centerTables() {
    const desks = Array.from(document.querySelectorAll('#roomCanvas .desk'));
    if (desks.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    desks.forEach(d => {
        const x = parseInt(d.style.left);
        const y = parseInt(d.style.top);
        if (x < minX) minX = x;
        if (x + DESK_W > maxX) maxX = x + DESK_W;
        if (y < minY) minY = y;
        if (y + DESK_H > maxY) maxY = y + DESK_H;
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const targetCenterX = CANVAS_W / 2;
    const currentCenterX = minX + (contentWidth / 2);
    const diffX = targetCenterX - currentCenterX;

    const targetCenterY = 500 / 2 + 15;
    const currentCenterY = minY + (contentHeight / 2);
    const diffY = targetCenterY - currentCenterY;

    desks.forEach(d => {
        const currentX = parseInt(d.style.left);
        const currentY = parseInt(d.style.top);
        d.style.left = (currentX + diffX) + 'px';
        d.style.top = Math.max(60, currentY + diffY) + 'px';
    });
}

function checkSnapping(x, y, otherDesks) {
    let finalX = x;
    let finalY = y;
    let snapped = false;

    for (let other of otherDesks) {
        const ox = other.x;
        const oy = other.y;
        const ow = DESK_W;
        const oh = DESK_H;

        if (Math.abs(x - (ox + ow)) < SNAP_THRESHOLD) { finalX = ox + ow; snapped = true; }
        else if (Math.abs(x - (ox - DESK_W)) < SNAP_THRESHOLD) { finalX = ox - DESK_W; snapped = true; }
        else if (Math.abs(x - ox) < SNAP_THRESHOLD) { finalX = ox; snapped = true; }

        if (Math.abs(y - (oy + oh)) < SNAP_THRESHOLD) { finalY = oy + oh; snapped = true; }
        else if (Math.abs(y - oy) < SNAP_THRESHOLD) { finalY = oy; snapped = true; }
    }

    if (!snapped) {
        finalX = Math.round(finalX / 10) * 10;
        finalY = Math.round(finalY / 10) * 10;
    }
    return { x: finalX, y: finalY, snapped };
}

function spawnDesk(x, y, container, type = 'single') {
    const d = document.createElement('div'); d.className = 'desk';
    d.dataset.type = type;

    // Get dimensions based on type
    const spec = DESK_TYPES[type] || DESK_TYPES.single;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    d.style.width = spec.width + 'px'; d.style.height = spec.height + 'px';

    // Add type class
    d.classList.add(`type-${type}`);

    // Initialize rotation to 0
    d.dataset.rotation = '0';

    d.innerHTML = `<span class="desk-number"></span>`;
    ensureCanvasHeight(y);

    d.onmousedown = (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        if (!selectedDesks.includes(d) && !e.shiftKey) {
            selectedDesks.forEach(d => d.classList.remove('is-selected'));
            selectedDesks = [d];
            d.classList.add('is-selected');
        } else if (!selectedDesks.includes(d)) {
            selectedDesks.push(d);
            d.classList.add('is-selected');
        }

        const startMouseX = e.clientX;
        const startMouseY = e.clientY;

        const initialPositions = selectedDesks.map(desk => ({
            el: desk,
            startX: parseInt(desk.style.left || 0),
            startY: parseInt(desk.style.top || 0)
        }));

        const otherDesks = Array.from(container.querySelectorAll('.desk'))
            .filter(el => !selectedDesks.includes(el))
            .map(el => ({ x: parseInt(el.style.left), y: parseInt(el.style.top) }));

        function move(ev) {
            const deltaX = ev.clientX - startMouseX;
            const deltaY = ev.clientY - startMouseY;

            const primaryInit = initialPositions.find(p => p.el === d);
            let rawX = primaryInit.startX + deltaX;
            let rawY = primaryInit.startY + deltaY;

            const snap = checkSnapping(rawX, rawY, otherDesks);

            const appliedDeltaX = snap.x - primaryInit.startX;
            const appliedDeltaY = snap.y - primaryInit.startY;

            initialPositions.forEach(pos => {
                const newY = pos.startY + appliedDeltaY;
                pos.el.style.left = (pos.startX + appliedDeltaX) + 'px';
                pos.el.style.top = newY + 'px';

                ensureCanvasHeight(newY);

                if (snap.snapped) pos.el.classList.add('is-snapped');
                else pos.el.classList.remove('is-snapped');
            });
        }

        function stop() {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', stop);
            selectedDesks.forEach(desk => desk.classList.remove('is-snapped'));
            updateDeskNumbers();
        }
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', stop);
    };

    d.oncontextmenu = (e) => {
        e.preventDefault(); rightClickedDesk = d;
        const m = document.getElementById('deskContextMenu');
        m.style.display = 'block'; m.style.left = e.pageX + 'px'; m.style.top = e.pageY + 'px';
    };
    container.appendChild(d);
}

function updateDeskNumbers() {
    const desks = Array.from(document.querySelectorAll('#roomCanvas .desk'));
    desks.sort((a, b) => {
        const ay = parseInt(a.style.top); const by = parseInt(b.style.top);
        const ax = parseInt(a.style.left); const bx = parseInt(b.style.left);
        if (Math.abs(ay - by) > 20) return ay - by;
        return ax - bx;
    });

    desks.forEach((d, i) => {
        const span = d.querySelector('.desk-number');
        if (span) span.innerText = i + 1;
    });
}

function deleteSelectedDesk() {
    if (rightClickedDesk) rightClickedDesk.remove();
    document.getElementById('deskContextMenu').style.display = 'none';
    updateDeskNumbers();
}

function rotateDeskCW() {
    if (!rightClickedDesk) return;

    const currentRotation = parseInt(rightClickedDesk.dataset.rotation || 0);
    const newRotation = (currentRotation + 90) % 360;

    rightClickedDesk.dataset.rotation = newRotation;

    // Remove all rotation classes
    rightClickedDesk.classList.remove('rotated-0', 'rotated-90', 'rotated-180', 'rotated-270');

    // Add new rotation class (skip if 0)
    if (newRotation !== 0) {
        rightClickedDesk.classList.add(`rotated-${newRotation}`);
    }

    document.getElementById('deskContextMenu').style.display = 'none';
}

function rotateDeskCCW() {
    if (!rightClickedDesk) return;

    const currentRotation = parseInt(rightClickedDesk.dataset.rotation || 0);
    const newRotation = (currentRotation - 90 + 360) % 360;

    rightClickedDesk.dataset.rotation = newRotation;

    // Remove all rotation classes
    rightClickedDesk.classList.remove('rotated-0', 'rotated-90', 'rotated-180', 'rotated-270');

    // Add new rotation class (skip if 0)
    if (newRotation !== 0) {
        rightClickedDesk.classList.add(`rotated-${newRotation}`);
    }

    document.getElementById('deskContextMenu').style.display = 'none';
}

function addDesk() {
    const desks = Array.from(document.querySelectorAll('#roomCanvas .desk'));
    const selectedType = document.getElementById('deskTypeSelect').value || 'single';
    const spec = DESK_TYPES[selectedType];

    let newX = 20;
    let newY = 60;

    if (desks.length > 0) {
        const last = desks[desks.length - 1];
        const lastX = parseInt(last.style.left);
        const lastY = parseInt(last.style.top);
        const lastWidth = parseInt(last.style.width);
        const lastHeight = parseInt(last.style.height);

        newX = lastX + lastWidth + 15;
        newY = lastY;

        if (newX > CANVAS_W - spec.width) {
            newX = 20;
            newY = lastY + lastHeight + 20;
        }
    }

    spawnDesk(newX, newY, document.getElementById('roomCanvas'), selectedType);
    updateDeskNumbers();
}
function clearCanvas() { document.getElementById('roomCanvas').innerHTML = '<div class="front-board">TAVLE</div>'; }

async function saveRoom() {
    const name = document.getElementById('roomNameInput').value;
    const layout = [];

    document.querySelectorAll('#roomCanvas .desk').forEach(d => {
        const type = d.dataset.type || 'single';
        const spec = DESK_TYPES[type];

        layout.push({
            x: parseInt(d.style.left),
            y: parseInt(d.style.top),
            rotation: parseInt(d.dataset.rotation || 0),
            type: type,
            capacity: spec.capacity
        });
    });

    if (editingId) await ipcRenderer.invoke('update-room', editingId, name, JSON.stringify(layout));
    else await ipcRenderer.invoke('save-room', name, JSON.stringify(layout));
    showToast("Lagret"); navTo('view-rooms');
}
async function deleteRoom(id) { await ipcRenderer.invoke('delete-room', id || editingId); showToast("Slettet"); navTo('view-rooms'); }

// =========================================================
// KLASSEKART DASHBOARD LOGIC (GROUPING)
// =========================================================
let allCharts = [];

async function loadCharts() {
    allCharts = await ipcRenderer.invoke('get-seatings');
    const grid = document.getElementById('chartGrid'); grid.innerHTML = '';

    // Group by Class+Room
    const groups = {};
    allCharts.forEach(c => {
        const key = c.class_id + '-' + c.room_id;
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
    });

    Object.keys(groups).forEach(key => {
        const list = groups[key];
        list.sort((a, b) => b.id - a.id);
        const latest = list[0];

        // CLICKABLE CARD - VIS KNAPP LAGT TILBAKE
        grid.innerHTML += `
            <div class="info-card" onclick="editChart(${latest.id})">
                <h5 class="card-title-large">${latest.name}</h5>
                <span class="card-info-text">${latest.class_name} @ ${latest.room_name}</span>
                <span class="card-week-text">${latest.comment || ''}</span>
                
                <div class="d-flex gap-3 mt-3">
                    <button class="btn-action btn-secondary btn-sm-action" onclick="event.stopPropagation(); openChartDisplay(${latest.id})"><i class="fas fa-magnifying-glass"></i> Vis</button>
                    <button class="btn-action btn-secondary btn-sm-action" onclick="event.stopPropagation(); editChart(${latest.id})">Rediger</button>
                    <button class="btn-action btn-secondary btn-sm-action" onclick="event.stopPropagation(); showHistory('${key}')"><i class="fas fa-history"></i></button>
                    <button class="btn-action btn-danger btn-sm-action ms-auto" onclick="event.stopPropagation(); openDeleteModal(() => deleteChartHistory('${key}'))">Slett alt</button>
                </div>
            </div>`;
    });
}

function showHistory(key) {
    const list = allCharts.filter(c => (c.class_id + '-' + c.room_id) === key).sort((a, b) => b.id - a.id);
    const content = document.getElementById('historyListContent');
    const titleEl = document.getElementById('historyModalTitle');

    if (list.length > 0) titleEl.innerText = "Historikk for " + list[0].name;

    content.innerHTML = '';
    list.forEach(c => {
        content.innerHTML += `
            <div class="history-item">
                <div onclick="openChartDisplay(${c.id}); closeHistoryModal()" style="flex:1">
                    <div class="history-weeks">${c.comment || 'Uke ?'}</div>
                    <div class="history-date">${new Date(c.created_at).toLocaleDateString()}</div>
                </div>
                <button class="btn-history-del" onclick="event.stopPropagation(); deleteSingleHistory(${c.id}, '${key}')"><i class="fas fa-trash"></i></button>
            </div>
        `;
    });
    document.getElementById('historyModal').style.display = 'flex';
}
function closeHistoryModal() { document.getElementById('historyModal').style.display = 'none'; }

async function deleteSingleHistory(id, key) {
    openConfirmModal("Slett versjon", "Slette denne versjonen?", async (res) => {
        if (!res) return;
        await ipcRenderer.invoke('delete-seating', id);
        allCharts = await ipcRenderer.invoke('get-seatings');
        showHistory(key);
        loadCharts();
    });
}

async function deleteChartHistory(key) {
    openConfirmModal("Slett alt", "Er du sikker på at du vil slette hele historikken for dette klassekartet?", async (res) => {
        if (!res) return;
        const list = allCharts.filter(c => (c.class_id + '-' + c.room_id) === key);
        if (list.length === 0) return;

        const cid = list[0].class_id;
        const rid = list[0].room_id;

        await ipcRenderer.invoke('delete-seating-history', cid, rid);
        showToast("Hele historikken slettet");
        loadCharts();
    });
}

// =========================================================
// SETUP & UTILS
// =========================================================
function openSeatingSetup() {
    document.getElementById('chartNameInput').value = '';
    document.getElementById('setupClassSelect').value = '';
}
async function loadSetup() {
    const cls = await ipcRenderer.invoke('get-classes'); const rms = await ipcRenderer.invoke('get-rooms');
    document.getElementById('setupClassSelect').innerHTML = cls.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('setupRoomSelect').innerHTML = rms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

async function createChart() {
    const name = document.getElementById('chartNameInput').value; const cid = document.getElementById('setupClassSelect').value; const rid = document.getElementById('setupRoomSelect').value;
    if (!name || !cid || !rid) return showToast("Fyll ut alt");
    const rooms = await ipcRenderer.invoke('get-rooms'); const room = rooms.find(r => r.id == rid);

    // FETCH FULL STUDENT LIST TO STORE IN CHART
    const cls = await ipcRenderer.invoke('get-class', cid);
    const studentList = cls.students.split('\n').filter(s => s.trim());

    const layout = JSON.parse(room.layout_data).map(p => ({
        ...p, student: null, color: 'bg-default', locked: false, groupId: null
    }));

    currentChart = {
        id: null, classId: cid, roomId: rid, layout: layout,
        allStudents: studentList // STORE ALL STUDENTS
    };
    document.getElementById('editChartName').value = name;

    const currentWeek = getWeekNumber(new Date());
    document.getElementById('editChartComment').value = `Uke ${currentWeek} - ${currentWeek + 4}`;

    await generateSeating(false);
    renderSeating();
    navTo('view-seating-editor');
}

async function editChart(id) {
    const charts = await ipcRenderer.invoke('get-seatings'); const c = charts.find(x => x.id == id);

    // FETCH FULL STUDENT LIST AGAIN TO DETECT NEW STUDENTS
    const cls = await ipcRenderer.invoke('get-class', c.class_id);
    const studentList = cls.students.split('\n').filter(s => s.trim());

    currentChart = {
        id: c.id, classId: c.class_id, roomId: c.room_id, layout: JSON.parse(c.placements),
        allStudents: studentList
    };
    document.getElementById('editChartName').value = c.name;
    document.getElementById('editChartComment').value = c.comment;
    renderSeating();
    navTo('view-seating-editor');
}

// NEW PERIOD LOGIC
async function startNewPeriod() {
    await saveChart();
    if (!currentChart.id) return showToast("Lagre først");

    const currentComment = document.getElementById('editChartComment').value;
    let nextStart = getWeekNumber(new Date()) + 1;

    const match = currentComment.match(/Uke\s+(\d+)\s*-\s*(\d+)/i);
    if (match && match[2]) {
        nextStart = parseInt(match[2]) + 1;
    }

    document.getElementById('npStartWeek').value = nextStart;
    document.getElementById('npEndWeek').value = nextStart + 3; // +3 betyr 4 uker totalt (f.eks 11,12,13,14)

    document.getElementById('newPeriodModal').style.display = 'flex';
}

function closeNewPeriodModal() { document.getElementById('newPeriodModal').style.display = 'none'; }

async function confirmNewPeriod() {
    const start = document.getElementById('npStartWeek').value;
    const end = document.getElementById('npEndWeek').value;
    const oldName = document.getElementById('editChartName').value;

    try {
        const newId = await ipcRenderer.invoke('duplicate-seating', currentChart.id, oldName);
        await ipcRenderer.invoke('save-seating', newId, oldName, currentChart.classId, currentChart.roomId, JSON.stringify(currentChart.layout), `Uke ${start}-${end}`);

        closeNewPeriodModal();
        showToast("Ny periode opprettet!");
        editChart(newId);
    } catch (err) {
        console.error(err);
        showToast("Feil: " + err.message);
    }
}

// --- SYNC ROOM ---
async function syncRoomLayout() {
    if (!currentChart.roomId) return;

    openConfirmModal("Oppdater Layout", "Dette vil flytte alle bord til posisjonen definert i 'Mine Rom'. Elever beholdes hvis mulig. Fortsette?", async (result) => {
        if (!result) return;

        try {
            const rooms = await ipcRenderer.invoke('get-rooms');
            const room = rooms.find(r => r.id == currentChart.roomId);

            if (!room) return showToast("Finner ikke rommet");

            const newLayoutBase = JSON.parse(room.layout_data);

            const newLayout = newLayoutBase.map((pos, i) => {
                const oldSpot = currentChart.layout[i];
                return {
                    x: pos.x,
                    y: pos.y,
                    type: pos.type || 'single',           // NEW: preserve desk type
                    rotation: pos.rotation || 0,          // NEW: preserve rotation
                    capacity: pos.capacity || 1,          // NEW: preserve capacity
                    students: oldSpot ? oldSpot.students : [],  // NEW: preserve students array
                    student: oldSpot ? oldSpot.student : null,  // Keep for backwards compat
                    color: oldSpot ? oldSpot.color : 'bg-default',
                    locked: oldSpot ? oldSpot.locked : false,
                    groupId: oldSpot ? oldSpot.groupId : null
                };
            });

            currentChart.layout = newLayout;
            renderSeating(); // This will trigger unplaced check
            showToast("Layout oppdatert fra rom!");

        } catch (e) {
            console.error(e);
            showToast("Feil under synkronisering");
        }
    });
}

// --- MAKKERGRUPPER ---
function toggleGroupMode() {
    isGroupMode = !isGroupMode;
    const btn = document.getElementById('btnGroupMode');
    const confirmBtn = document.getElementById('btnConfirmGroup');

    if (isGroupMode) {
        btn.classList.add('btn-group-mode');
        btn.innerText = "Avslutt gruppering";
        confirmBtn.style.display = 'block';

        selectedDesksForGroup = [];
        showToast("Klikk på bord + ENTER for å lage en gruppe");

        // ENTER-LISTENER
        window.addEventListener('keydown', handleGroupEnter);

    } else {
        btn.classList.remove('btn-group-mode');
        btn.innerHTML = '<i class="fas fa-object-group"></i> Lag Grupper';
        confirmBtn.style.display = 'none';

        window.removeEventListener('keydown', handleGroupEnter);

        document.querySelectorAll('.selected-for-group').forEach(el => el.classList.remove('selected-for-group'));
        selectedDesksForGroup = [];
    }
}

// --- NY FUNKSJON: Nullstill alle grupper ---
function resetGroups() {
    openConfirmModal("Nullstill grupper", "Vil du fjerne alle grupper (farger) fra dette klassekartet?", (res) => {
        if (!res) return;

        currentChart.layout.forEach(desk => {
            desk.groupId = null;
        });
        renderSeating();
        showToast("Alle grupper fjernet");
    });
}

function handleGroupEnter(e) {
    if (!isGroupMode) return;
    // SPERRE FOR NAVNEFELT SÅ IKKE ENTER UTLØSER GRUPPE
    if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;

    if (e.key === 'Enter') {
        commitGroup();
    }
}

function commitGroup() {
    if (selectedDesksForGroup.length > 0) {
        const currentIds = currentChart.layout.map(s => s.groupId || 0);
        const maxId = Math.max(...currentIds, 0);
        const gid = maxId + 1;

        selectedDesksForGroup.forEach(idx => {
            currentChart.layout[idx].groupId = gid;
        });
        showToast(`Gruppe ${gid} opprettet!`);
        renderSeating();

        selectedDesksForGroup = [];
    } else {
        showToast("Ingen bord valgt");
    }
}

function ungroupDesk() {
    if (selectedSeatingDeskIdx !== null) {
        currentChart.layout[selectedSeatingDeskIdx].groupId = null;
        showToast("Fjernet fra gruppe");
        renderSeating();
        document.getElementById('seatingContextMenu').style.display = 'none';
    }
}

function handleDeskClick(element, idx) {
    if (selectedDesksForGroup.includes(idx)) {
        selectedDesksForGroup = selectedDesksForGroup.filter(i => i !== idx);
        element.classList.remove('selected-for-group');
    } else {
        selectedDesksForGroup.push(idx);
        element.classList.add('selected-for-group');
    }
}

// --- UNPLACED STUDENTS LOGIC ---
function updateUnplacedDock() {
    const dock = document.getElementById('unplacedDock');
    if (!currentChart.allStudents) {
        dock.style.display = 'none';
        return;
    }

    const placedNames = [];
    currentChart.layout.forEach(desk => {
        if (desk.students && desk.students.length > 0) {
            desk.students.forEach(s => placedNames.push(s.name || s));
        } else if (desk.student) {
            placedNames.push(desk.student.name);
        }
    });

    const unplaced = currentChart.allStudents.filter(name => !placedNames.includes(name));

    if (unplaced.length === 0) {
        dock.style.display = 'none';
        return;
    }

    dock.style.display = 'flex';
    // Remove old chips (except header)
    dock.innerHTML = '<div class="dock-header">Elever uten plass</div>';

    unplaced.forEach(name => {
        const chip = document.createElement('div');
        chip.className = 'student-chip';
        chip.innerText = name;
        chip.draggable = true;

        chip.ondragstart = (e) => {
            e.dataTransfer.setData("text/plain", name);
        };

        dock.appendChild(chip);
    });
}

function handleStudentSwap(e, targetDeskIdx, targetStudentPos) {
    const name = e.dataTransfer.getData('text/plain');
    const sourceDeskIdx = e.dataTransfer.getData('source-desk-idx');
    const sourceStudentPos = e.dataTransfer.getData('source-student-pos');

    console.log('🎯 handleStudentSwap:', name, 'from', sourceDeskIdx, ':', sourceStudentPos, 'to', targetDeskIdx, ':', targetStudentPos);

    if (!name || !sourceDeskIdx || !sourceStudentPos) {
        const targetDesk = currentChart.layout[targetDeskIdx];
        const capacity = targetDesk.capacity || 1;
        const currentStudents = targetDesk.students || [];

        if (currentStudents.length < capacity) {
            const newStudent = { name: name, note: '', position: currentStudents.length };
            targetDesk.students = targetDesk.students || [];
            targetDesk.students.push(newStudent);
            if (targetDesk.students.length === 1) {
                targetDesk.student = newStudent;
            }
            renderSeating();
        } else {
            showToast(`Bordet er fullt (${capacity}/${capacity})`);
        }
        return;
    }

    const srcIdx = parseInt(sourceDeskIdx);
    const srcPos = parseInt(sourceStudentPos);

    if (srcIdx === targetDeskIdx && srcPos === targetStudentPos) {
        console.log('⚠️ Cannot swap student with itself');
        return;
    }

    const sourceDesk = currentChart.layout[srcIdx];
    const targetDesk = currentChart.layout[targetDeskIdx];

    if (!sourceDesk || !targetDesk) return;

    const draggedStudent = sourceDesk.students && sourceDesk.students[srcPos];
    const targetStudent = targetDesk.students && targetDesk.students[targetStudentPos];

    if (!draggedStudent || !targetStudent) return;

    console.log('🔄 Swapping:', draggedStudent.name, '↔', targetStudent.name);

    const tempName = draggedStudent.name;
    const tempNote = draggedStudent.note || '';
    const targetOriginalName = targetStudent.name; // Save for toast

    draggedStudent.name = targetStudent.name;
    draggedStudent.note = targetStudent.note || '';

    targetStudent.name = tempName;
    targetStudent.note = tempNote;

    if (sourceDesk.students.length === 1) {
        sourceDesk.student = sourceDesk.students[0];
    }
    if (targetDesk.students.length === 1) {
        targetDesk.student = targetDesk.students[0];
    }

    showToast(`🔄 Byttet ${tempName} ↔ ${targetOriginalName}`);
    renderSeating();
}

function renderSeating() {
    const c = document.getElementById('seatingCanvas');
    c.innerHTML = '<div class="front-board">TAVLE</div>';

    // START STANDARDVISNING HVIS AKTIV
    applyDefaultFlip('seatingCanvas');

    currentChart.layout.forEach((desk, idx) => {
        const d = document.createElement('div');
        let colorClass = desk.color || 'bg-default';

        d.className = `desk ${colorClass}`;

        // Add type and rotation classes
        const deskType = desk.type || 'single';
        d.classList.add(`type-${deskType}`);
        if (desk.rotation && desk.rotation !== 0) {
            d.classList.add(`rotated-${desk.rotation}`);
        }

        // Set position and dimensions
        d.style.left = desk.x + 'px';
        d.style.top = desk.y + 'px';
        const spec = DESK_TYPES[deskType];
        d.style.width = spec.width + 'px';
        d.style.height = spec.height + 'px';

        // LEGGER TIL BORDNUMMER
        d.innerHTML += `<span class="desk-number">${idx + 1}</span>`;

        if (desk.groupId) {
            d.style.borderWidth = "3px";
            d.style.borderColor = GROUP_COLORS[(desk.groupId - 1) % GROUP_COLORS.length];
        }

        if (desk.locked) d.innerHTML += `<i class="fas fa-lock lock-icon"></i>`;

        // Render students - support both old (single) and new (array) formats
        const students = desk.students || (desk.student ? [desk.student] : []);

        if (students.length > 0) {
            if (students.length === 1 && deskType === 'single') {
                // Single student on single desk - show name (large)
                const nameSpan = document.createElement('span');
                const studentData = students[0];
                const studentName = studentData.name || studentData;
                nameSpan.innerText = studentName;
                if (studentName.length > 10) nameSpan.style.fontSize = '0.75rem';
                if (studentName.length > 15) nameSpan.style.fontSize = '0.65rem';
                if (studentName.length > 20) nameSpan.style.fontSize = '0.55rem';

                // Make single student name draggable
                nameSpan.draggable = true;
                nameSpan.style.cursor = 'grab';
                nameSpan.onmousedown = (e) => e.stopPropagation();
                nameSpan.ondragstart = (e) => {
                    e.stopPropagation();
                    nameSpan.style.opacity = '0.5';
                    e.dataTransfer.setData('text/plain', studentName);
                    e.dataTransfer.setData('source-desk-idx', idx.toString());
                    e.dataTransfer.setData('source-student-pos', '0');
                };
                nameSpan.ondragend = () => nameSpan.style.opacity = '1';
                nameSpan.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); nameSpan.style.background = 'rgba(14, 165, 233, 0.3)'; };
                nameSpan.ondragleave = () => nameSpan.style.background = '';
                nameSpan.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); nameSpan.style.background = ''; handleStudentSwap(e, idx, 0); };

                d.appendChild(nameSpan);

                if (studentData.note) {
                    d.innerHTML += `<i class="fas fa-sticky-note note-icon"></i>`;
                }
            } else {
                // Multiple students - show names in compact list
                const nameContainer = document.createElement('div');
                nameContainer.className = 'student-names-list';

                students.forEach((student, pos) => {
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'student-name-item';
                    const studentName = student.name || student;
                    nameDiv.textContent = studentName;

                    // Make each name draggable
                    nameDiv.draggable = true;
                    nameDiv.setAttribute('draggable', 'true');
                    nameDiv.style.cursor = 'grab';
                    nameDiv.style.userSelect = 'none';
                    nameDiv.style.webkitUserSelect = 'none';

                    // Prevent desk drag from activating
                    nameDiv.onmousedown = (e) => {
                        e.stopPropagation();
                    };

                    nameDiv.ondragstart = (e) => {
                        e.stopPropagation();
                        console.log('🎯 Drag started:', studentName, 'from desk', idx, 'position', pos);
                        nameDiv.style.cursor = 'grabbing';
                        nameDiv.style.opacity = '0.5';
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData("text/plain", studentName);
                        e.dataTransfer.setData("source-desk-idx", idx.toString());
                        e.dataTransfer.setData("source-student-pos", pos.toString());
                    };

                    nameDiv.ondragend = () => {
                        console.log('✅ Drag ended');
                        nameDiv.style.cursor = 'grab';
                        nameDiv.style.opacity = '1';
                    };

                    // Add drop handler for precise swapping
                    nameDiv.ondragover = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        nameDiv.style.background = 'rgba(14, 165, 233, 0.3)'; // Highlight on hover
                    };

                    nameDiv.ondragleave = (e) => {
                        nameDiv.style.background = '';
                    };

                    nameDiv.ondrop = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        nameDiv.style.background = '';
                        handleStudentSwap(e, idx, pos);
                    };

                    // Add note indicator if student has notes
                    if (student.note) {
                        const noteIcon = document.createElement('i');
                        noteIcon.className = 'fas fa-sticky-note';
                        noteIcon.style.marginLeft = '3px';
                        noteIcon.style.fontSize = '0.5rem';
                        noteIcon.style.color = '#fcd34d';
                        noteIcon.style.pointerEvents = 'none';
                        nameDiv.appendChild(noteIcon);
                    }

                    nameContainer.appendChild(nameDiv);
                });

                d.appendChild(nameContainer);
            }
        }

        // ENABLE DROP ON DESK
        d.ondragover = (e) => e.preventDefault();
        d.ondrop = (e) => {
            e.preventDefault();
            const name = e.dataTransfer.getData("text/plain");
            const sourceDeskIdx = e.dataTransfer.getData("source-desk-idx");
            const sourceStudentPos = e.dataTransfer.getData("source-student-pos");

            if (name) {
                // Check if desk has capacity
                const capacity = desk.capacity || 1;
                const currentStudents = desk.students || [];

                if (currentStudents.length < capacity) {
                    // Remove from source desk if dragging between desks
                    if (sourceDeskIdx && sourceStudentPos) {
                        const srcIdx = parseInt(sourceDeskIdx);
                        const srcPos = parseInt(sourceStudentPos);
                        if (srcIdx !== idx && currentChart.layout[srcIdx]) {
                            const sourceDesk = currentChart.layout[srcIdx];
                            if (sourceDesk.students && sourceDesk.students[srcPos]) {
                                sourceDesk.students.splice(srcPos, 1);
                                if (sourceDesk.students.length === 0) {
                                    sourceDesk.student = null;
                                } else {
                                    sourceDesk.student = sourceDesk.students[0];
                                }
                            }
                        }
                    }

                    // Add student to desk
                    const newStudent = { name: name, note: '', position: currentStudents.length };
                    desk.students = desk.students || [];
                    desk.students.push(newStudent);

                    // Update backwards compat field
                    if (desk.students.length === 1) {
                        desk.student = newStudent;
                    }

                    renderSeating();
                } else {
                    // SWAP CASE: Desk is full, swap students
                    if (sourceDeskIdx && sourceStudentPos) {
                        const srcIdx = parseInt(sourceDeskIdx);
                        const srcPos = parseInt(sourceStudentPos);

                        // Don't swap if dragging within same desk
                        if (srcIdx === idx) {
                            console.log('⚠️ Cannot swap within same desk');
                            return;
                        }

                        if (currentChart.layout[srcIdx]) {
                            const sourceDesk = currentChart.layout[srcIdx];

                            // Get the student being dragged
                            const draggedStudent = sourceDesk.students && sourceDesk.students[srcPos];
                            if (!draggedStudent) return;

                            // Get the last student from target desk (the one being replaced)
                            const replacedStudent = desk.students[desk.students.length - 1];

                            console.log('🔄 Swapping:', draggedStudent.name, '↔', replacedStudent.name);

                            // Remove dragged student from source
                            sourceDesk.students.splice(srcPos, 1);

                            // Remove replaced student from target
                            desk.students.pop();

                            // Add dragged student to target
                            desk.students.push({ name: draggedStudent.name, note: draggedStudent.note || '', position: desk.students.length });

                            // Add replaced student to source
                            sourceDesk.students.push({ name: replacedStudent.name, note: replacedStudent.note || '', position: sourceDesk.students.length });

                            // Update backwards compat fields
                            if (desk.students.length === 1) {
                                desk.student = desk.students[0];
                            }
                            if (sourceDesk.students.length === 1) {
                                sourceDesk.student = sourceDesk.students[0];
                            } else if (sourceDesk.students.length === 0) {
                                sourceDesk.student = null;
                            }

                            showToast(`🔄 Byttet ${draggedStudent.name} ↔ ${replacedStudent.name}`);
                            renderSeating();
                        }
                    } else {
                        // Dragging from unplaced dock to full desk - no swap possible
                        showToast(`Bordet er fullt (${capacity}/${capacity})`);
                    }
                }
            }
        };
        d.onmousedown = (e) => {
            if (isGroupMode) {
                handleDeskClick(d, idx);
                return;
            }

            // Don't drag whole desk if it has multiple students - let individual names be dragged
            if (students.length > 1) {
                return;
            }

            if (e.button !== 0) return; e.stopPropagation();
            e.preventDefault();

            if (desk.locked) return showToast("Plassen er låst");

            d.classList.add('drag-origin');

            const ghost = d.cloneNode(true);
            ghost.classList.remove('drag-origin');
            ghost.style.position = 'fixed'; ghost.style.zIndex = 999;
            ghost.style.opacity = 0.8; ghost.style.pointerEvents = 'none';
            document.body.append(ghost);

            function move(ev) {
                requestAnimationFrame(() => {
                    ghost.style.left = ev.clientX - 40 + 'px';
                    ghost.style.top = ev.clientY - 25 + 'px';
                });
            }

            function drop(ev) {
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', drop);
                ghost.remove();
                d.classList.remove('drag-origin');

                const elem = document.elementFromPoint(ev.clientX, ev.clientY);
                const target = elem ? elem.closest('.desk') : null;

                if (target && target !== d) {
                    const targetIdx = currentChart.layout.findIndex(s => s.x == parseInt(target.style.left) && s.y == parseInt(target.style.top));
                    if (targetIdx !== -1) {
                        if (currentChart.layout[targetIdx].locked) {
                            showToast("Målplassen er låst");
                        } else {
                            const tempS = currentChart.layout[idx].student;
                            const tempC = currentChart.layout[idx].color;
                            currentChart.layout[idx].student = currentChart.layout[targetIdx].student;
                            currentChart.layout[idx].color = currentChart.layout[targetIdx].color;
                            currentChart.layout[idx].student = currentChart.layout[targetIdx].student;
                            currentChart.layout[targetIdx].student = tempS;
                            currentChart.layout[targetIdx].color = tempC;
                            renderSeating();
                        }
                    }
                }
            }
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', drop);
        };

        d.oncontextmenu = (e) => {
            e.preventDefault(); e.stopPropagation();
            selectedSeatingDeskIdx = idx;

            const m = document.getElementById('seatingContextMenu');
            document.getElementById('ctxLockText').innerText = spot.locked ? "Lås opp" : "Lås plass";

            const ungroupItem = document.getElementById('ctxUngroupAction');
            ungroupItem.style.display = spot.groupId ? 'block' : 'none';

            m.style.display = 'block'; m.style.left = e.pageX + 'px'; m.style.top = e.pageY + 'px';
        };
        c.appendChild(d);
    });

    // UPDATE DOCK WHEN RENDERED
    updateUnplacedDock();
}

async function generateSeating(keepLocked = true) {
    const cls = await ipcRenderer.invoke('get-class', currentChart.classId);
    let allNames = cls.students.split('\n').filter(s => s.trim());

    const lockedStudents = [];
    if (keepLocked) {
        currentChart.layout.forEach(desk => {
            // Support both old (single student) and new (students array) format
            if (desk.locked) {
                if (desk.students && desk.students.length > 0) {
                    desk.students.forEach(s => lockedStudents.push(s.name));
                } else if (desk.student) {
                    lockedStudents.push(desk.student.name);
                }
            }
        });
    }

    let availableStudents = allNames.filter(name => !lockedStudents.includes(name));
    availableStudents.sort(() => Math.random() - 0.5);

    let studentIndex = 0;
    currentChart.layout.forEach(desk => {
        if (keepLocked && desk.locked) return;

        // Initialize students array
        desk.students = [];
        const capacity = desk.capacity || 1;

        // Fill desk up to capacity
        for (let i = 0; i < capacity && studentIndex < availableStudents.length; i++) {
            desk.students.push({
                name: availableStudents[studentIndex],
                note: '',
                position: i
            });
            studentIndex++;
        }

        // Maintain backwards compatibility with old student property
        if (desk.students.length > 0) {
            desk.student = desk.students[0]; // Keep first student for backwards compat
        } else {
            desk.student = null;
        }

        desk.color = 'bg-default';
    });

    renderSeating();
}

async function saveChart() {
    const name = document.getElementById('editChartName').value;
    const comm = document.getElementById('editChartComment').value;
    const result = await ipcRenderer.invoke('save-seating', currentChart.id, name, currentChart.classId, currentChart.roomId, JSON.stringify(currentChart.layout), comm);

    if (result && !currentChart.id) {
        currentChart.id = result;
    }
    showToast("Lagret");
}
async function deleteChart(id) { await ipcRenderer.invoke('delete-seating', id || editingId); showToast("Slettet"); loadCharts(); }

async function openChartDisplay(id) {
    const charts = await ipcRenderer.invoke('get-seatings'); const c = charts.find(x => x.id == id);
    document.getElementById('displayTitle').innerText = c.name;
    document.getElementById('displaySubtitle').innerText = c.comment || '';

    // SET PRINT HEADER VALUES
    document.getElementById('printTitle').innerText = c.name;
    document.getElementById('printSubtitle').innerText = c.comment || '';

    const container = document.getElementById('displayCanvas');
    container.innerHTML = '<div class="front-board">TAVLE</div>';

    // START STANDARDVISNING HVIS AKTIV
    applyDefaultFlip('displayCanvas');

    // OPPDATER CURRENTCHART SLIK AT ZOOM FUNGERER FOR DENNE VISNINGEN OGSÅ
    currentChart.layout = JSON.parse(c.placements);

    JSON.parse(c.placements).forEach((spot, idx) => {
        const d = document.createElement('div');
        let colorClass = spot.color || 'bg-default';

        d.className = `desk ${colorClass}`;
        d.style.left = spot.x + 'px'; d.style.top = spot.y + 'px';
        d.style.width = DESK_W + 'px'; d.style.height = DESK_H + 'px';

        d.innerHTML += `<span class="desk-number">${idx + 1}</span>`;

        if (spot.groupId) {
            d.style.borderWidth = "3px";
            d.style.borderColor = GROUP_COLORS[(spot.groupId - 1) % GROUP_COLORS.length];
        }

        if (spot.student) {
            const nameSpan = document.createElement('span');
            nameSpan.innerText = spot.student.name;

            // AUTO TEXT SIZE LOGIC FOR DISPLAY TOO
            if (spot.student.name.length > 10) nameSpan.style.fontSize = '0.75rem';
            if (spot.student.name.length > 15) nameSpan.style.fontSize = '0.65rem';
            if (spot.student.name.length > 20) nameSpan.style.fontSize = '0.55rem';

            d.appendChild(nameSpan);
        }
        container.appendChild(d);
    });

    navTo('view-chart-display');
}
function flipView() { document.getElementById('displayCanvas').classList.toggle('flipped'); }
function editStudentNote() {
    if (selectedSeatingDeskIdx === null) return;

    const placement = currentChart.layout[selectedSeatingDeskIdx];
    if (!placement || !placement.student) return showToast("Ingen elev her");

    // Åpne større modal med textarea
    document.getElementById('noteStudentName').textContent = placement.student.name;
    document.getElementById('noteTextarea').value = placement.student.note || '';
    document.getElementById('studentNoteModal').style.display = 'flex';

    // Fokuser på textarea
    setTimeout(() => document.getElementById('noteTextarea').focus(), 100);
}

function saveStudentNote() {
    if (selectedSeatingDeskIdx === null) return;

    const note = document.getElementById('noteTextarea').value.trim();
    currentChart.layout[selectedSeatingDeskIdx].student.note = note;
    renderSeating();
    closeStudentNoteModal();
    showToast('Notat lagret');
}

function closeStudentNoteModal() {
    document.getElementById('studentNoteModal').style.display = 'none';
    document.getElementById('seatingContextMenu').style.display = 'none';
}
function setDeskColor(c) {
    currentChart.layout[selectedSeatingDeskIdx].color = c; renderSeating(); document.getElementById('seatingContextMenu').style.display = 'none';
}
function toggleDeskLock() {
    const s = currentChart.layout[selectedSeatingDeskIdx]; s.locked = !s.locked; renderSeating(); document.getElementById('seatingContextMenu').style.display = 'none';
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.ctx-item')) {
        document.getElementById('deskContextMenu').style.display = 'none';
        document.getElementById('seatingContextMenu').style.display = 'none';
    }
});

// =========================================================
// ONBOARDING WIZARD
// =========================================================
let wizardStep = 1;
let wizardData = {
    className: '',
    students: [],
    roomTemplate: 'standard'
};

function startOnboardingWizard(

) {
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
            showToast('Vennligst fyll ut klassenavn');
            return;
        }
        if (wizardData.students.length === 0) {
            showToast('Vennligst legg til minst én elev');
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
        groups: { rows: 3, cols: [2, 2, 2] }  // 3x(2+2+2) = 24 bord, 6 grupper à 4
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
        const currentWeek = getWeekNumber(new Date());

        const chartLayout = layout.map(p => ({
            x: p.x,
            y: p.y,
            student: null,
            color: 'bg-default',
            locked: false,
            groupId: null
        }));

        currentChart = {
            id: null,
            classId: classId,
            roomId: roomId,
            layout: chartLayout,
            allStudents: wizardData.students
        };

        document.getElementById('editChartName').value = chartName;
        document.getElementById('editChartComment').value = `Uke ${currentWeek} - ${currentWeek + 4}`;

        await generateSeating(false);
        renderSeating();

        // Merk wizard som fullført
        localStorage.setItem('onboardingCompleted', 'true');

        // Lukk wizard og naviger til editor
        document.getElementById('onboardingWizard').style.display = 'none';
        navTo('view-seating-editor');

        showToast('🎉 Ditt første klassekart er klart!');

    } catch (err) {
        console.error(err);
        showToast('Feil: ' + err.message);
    }
}

function closeWizard() {
    document.getElementById('onboardingWizard').style.display = 'none';
    localStorage.setItem('onboardingCompleted', 'true');
    navTo('view-charts-dashboard');
}

// STARTUP CALL
navTo('view-charts-dashboard');