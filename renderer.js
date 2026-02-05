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
        btn.innerHTML = '<i class="fas fa-object-group"></i> Lag Grupper';
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
    // Check if we have data
    if (!currentChart || !currentChart.layout) return showToast("Ingen data å vise");
    // Send to main process
    ipcRenderer.send('open-presentation-window', JSON.stringify(currentChart.layout));
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
    layout.forEach(d => spawnDesk(d.x, d.y, c));
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

function spawnDesk(x, y, container) {
    const d = document.createElement('div'); d.className = 'desk';
    d.style.left = x + 'px'; d.style.top = y + 'px';
    d.style.width = DESK_W + 'px'; d.style.height = DESK_H + 'px';

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

function addDesk() {
    const desks = Array.from(document.querySelectorAll('#roomCanvas .desk'));
    let newX = 20;
    let newY = 100;

    if (desks.length > 0) {
        desks.sort((a, b) => {
            const ay = parseInt(a.style.top); const by = parseInt(b.style.top);
            if (Math.abs(ay - by) > 20) return ay - by;
            return parseInt(a.style.left) - parseInt(b.style.left);
        });
        const last = desks[desks.length - 1];
        const lx = parseInt(last.style.left);
        const ly = parseInt(last.style.top);

        newX = lx + DESK_W;
        newY = ly;

        if (newX > (CANVAS_W - 130)) {
            newX = 20;
            newY = ly + DESK_H + 40;
        }
    }
    spawnDesk(newX, newY, document.getElementById('roomCanvas'));
    updateDeskNumbers();
}
function clearCanvas() { document.getElementById('roomCanvas').innerHTML = '<div class="front-board">TAVLE</div>'; }

async function saveRoom() {
    const name = document.getElementById('roomNameInput').value;
    const layout = []; document.querySelectorAll('#roomCanvas .desk').forEach(d => layout.push({ x: parseInt(d.style.left), y: parseInt(d.style.top) }));
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
                    student: oldSpot ? oldSpot.student : null,
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
        btn.innerText = "Avslutt Gruppering";
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

    const placedNames = currentChart.layout
        .filter(d => d.student)
        .map(d => d.student.name);

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

function renderSeating() {
    const c = document.getElementById('seatingCanvas');
    c.innerHTML = '<div class="front-board">TAVLE</div>';

    currentChart.layout.forEach((spot, idx) => {
        const d = document.createElement('div');
        let colorClass = spot.color || 'bg-default';

        d.className = `desk ${colorClass}`;
        d.style.left = spot.x + 'px'; d.style.top = spot.y + 'px';
        d.style.width = DESK_W + 'px'; d.style.height = DESK_H + 'px';

        // LEGGER TIL BORDNUMMER
        d.innerHTML += `<span class="desk-number">${idx + 1}</span>`;

        if (spot.groupId) {
            d.style.borderWidth = "3px";
            d.style.borderColor = GROUP_COLORS[(spot.groupId - 1) % GROUP_COLORS.length];
        }

        if (spot.locked) d.innerHTML += `<i class="fas fa-lock lock-icon"></i>`;

        if (spot.student) {
            const nameSpan = document.createElement('span');
            nameSpan.innerText = spot.student.name;
            if (spot.student.name.length > 10) nameSpan.style.fontSize = '0.75rem';
            if (spot.student.name.length > 15) nameSpan.style.fontSize = '0.65rem';
            if (spot.student.name.length > 20) nameSpan.style.fontSize = '0.55rem';

            d.appendChild(nameSpan);

            if (spot.student.note) {
                d.innerHTML += `<i class="fas fa-sticky-note note-icon"></i>`;
            }
        }

        // ENABLE DROP ON DESK
        d.ondragover = (e) => e.preventDefault();
        d.ondrop = (e) => {
            e.preventDefault();
            const name = e.dataTransfer.getData("text/plain");
            if (name) {
                // Assign from Dock
                spot.student = { name: name, note: '' };
                renderSeating();
            }
        };

        d.onmousedown = (e) => {
            if (isGroupMode) {
                handleDeskClick(d, idx);
                return;
            }

            if (e.button !== 0) return; e.stopPropagation();
            e.preventDefault();

            if (spot.locked) return showToast("Plassen er låst");

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
        currentChart.layout.forEach(spot => {
            if (spot.locked && spot.student) lockedStudents.push(spot.student.name);
        });
    }

    let availableStudents = allNames.filter(name => !lockedStudents.includes(name));
    availableStudents.sort(() => Math.random() - 0.5);

    let studentIndex = 0;
    currentChart.layout.forEach(spot => {
        if (keepLocked && spot.locked) return;
        if (studentIndex < availableStudents.length) {
            spot.student = { name: availableStudents[studentIndex], note: '' };
            spot.color = 'bg-default';
            studentIndex++;
        } else {
            spot.student = null;
            spot.color = 'bg-default';
        }
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
    const s = currentChart.layout[selectedSeatingDeskIdx].student;
    if (!s) return showToast("Ingen elev her");
    openModal("Notat", s.note || "", (val) => { s.note = val; renderSeating(); document.getElementById('seatingContextMenu').style.display = 'none'; });
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

// STARTUP CALL
navTo('view-charts-dashboard');