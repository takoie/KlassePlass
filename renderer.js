const API_URL = "http://127.0.0.1:5000/api";
let editingId = null;
let editingChartId = null;
let currentChartName = "";
let currentChartComment = "";
let currentClassId = null;
let currentRoomId = null;

let lastDeskPos = { x: 20, y: 60 };
let rightClickedDesk = null;
let selectedSeatingDeskIdx = null;

// Zoom State
let currentZoom = 1.0;

const DESK_W = 80;
const DESK_H = 50;
const GROUP_COLORS = ['#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#ef4444'];

let currentSeatingLayout = [];
let isGroupMode = false;
let selectedDesksForGroup = [];
let groupCounter = 0;

function navTo(viewId) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    let navId = "";
    if (viewId.includes('class')) navId = 'nav-classes';
    if (viewId === 'view-class-create') navId = 'nav-class-create';
    if (viewId.includes('room')) navId = 'nav-rooms';
    if (viewId === 'view-room-create') navId = 'nav-room-create';
    if (viewId.includes('chart') || viewId.includes('seating')) navId = 'nav-charts';
    if (viewId === 'view-seating-create') navId = 'nav-seating-create';
    if (viewId === 'view-seating-edit') navId = 'nav-seating-edit';

    const activeEl = document.getElementById(navId);
    if (activeEl) activeEl.classList.add('active');

    if (viewId === 'view-class-create') viewId = 'view-class-editor';
    if (viewId === 'view-room-create') viewId = 'view-room-editor';
    if (viewId === 'view-seating-create') viewId = 'view-seating-setup';
    if (viewId === 'view-seating-edit') viewId = 'view-charts-dashboard';

    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    if (viewId === 'view-classes') loadClasses();
    if (viewId === 'view-rooms') loadRooms();
    if (viewId === 'view-charts-dashboard') loadChartsDashboard();
    if (viewId === 'view-seating-setup') loadSetupOptions();
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('click', () => {
    document.getElementById('deskContextMenu').style.display = 'none';
    document.getElementById('seatingContextMenu').style.display = 'none';
});

// --- STANDARD CRUD ---
function openClassCreate() { editingId = null; document.getElementById('classEditorTitle').innerText = "Opprett klasse"; document.getElementById('classNameInput').value = ""; document.getElementById('studentListInput').value = ""; document.getElementById('btnClassDelete').style.display = 'none'; navTo('view-class-create'); }
async function openClassEdit(id) { editingId = id; const res = await fetch(`${API_URL}/classes/${id}`); const data = await res.json(); document.getElementById('classEditorTitle').innerText = "Redigerer: " + data.name; document.getElementById('classNameInput').value = data.name; document.getElementById('studentListInput').value = data.students.map(s => s.name).join('\n'); document.getElementById('btnClassDelete').style.display = 'block'; document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active')); document.getElementById('view-class-editor').classList.add('active'); }
async function loadClasses() { const res = await fetch(`${API_URL}/classes`); const classes = await res.json(); const grid = document.getElementById('classGrid'); grid.innerHTML = ""; if (classes.length === 0) { grid.innerHTML = `<p class="empty-state">Ingen klasser opprettet.</p>`; return; } classes.forEach(c => { const card = document.createElement('div'); card.className = "info-card"; card.onclick = () => openClassEdit(c.id); card.innerHTML = `<i class="fas fa-pen icon-edit"></i><div class="mt-2"><h5 class="card-title-large">${c.name}</h5><span class="card-info-text">Antall elever: ${c.student_count}</span></div>`; grid.appendChild(card); }); }
async function saveClass() { const name = document.getElementById('classNameInput').value; const text = document.getElementById('studentListInput').value; if (!name) return showToast("Mangler navn!"); const students = text.split('\n').filter(n => n.trim() !== ""); const payload = { name, students }; const method = editingId ? 'PUT' : 'POST'; const url = editingId ? `${API_URL}/classes/${editingId}` : `${API_URL}/classes`; await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); showToast(editingId ? "Klasse oppdatert!" : "Klasse opprettet!"); navTo('view-classes'); }
async function deleteClass() { if (!editingId) return; await fetch(`${API_URL}/classes/${editingId}`, { method: 'DELETE' }); showToast("Klasse slettet"); navTo('view-classes'); }

function openRoomCreate() { editingId = null; document.getElementById('roomEditorTitle').innerText = "Opprett rom"; document.getElementById('roomNameInput').value = ""; document.getElementById('configPreset').value = ""; document.getElementById('roomCanvas').innerHTML = '<div class="front-board"></div>'; document.getElementById('btnRoomDelete').style.display = 'none'; lastDeskPos = { x: 20, y: 60 }; navTo('view-room-create'); }
async function openRoomEdit(id) { editingId = id; const res = await fetch(`${API_URL}/rooms/${id}`); const data = await res.json(); document.getElementById('roomEditorTitle').innerText = "Redigerer: " + data.name; document.getElementById('roomNameInput').value = data.name; document.getElementById('configPreset').value = ""; document.getElementById('btnRoomDelete').style.display = 'block'; const canvas = document.getElementById('roomCanvas'); canvas.innerHTML = '<div class="front-board"></div>'; if (data.layout.length > 0) { data.layout.forEach(d => spawnDesk(d.x, d.y)); const last = data.layout[data.layout.length - 1]; lastDeskPos = { x: last.x, y: last.y }; } else { lastDeskPos = { x: 20, y: 60 }; } document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active')); document.getElementById('view-room-editor').classList.add('active'); }
async function loadRooms() { const res = await fetch(`${API_URL}/rooms`); const rooms = await res.json(); const grid = document.getElementById('roomGrid'); grid.innerHTML = ""; if (rooms.length === 0) { grid.innerHTML = `<p class="empty-state">Ingen rom opprettet.</p>`; return; } rooms.forEach(r => { const card = document.createElement('div'); card.className = "info-card"; card.onclick = () => openRoomEdit(r.id); card.innerHTML = `<i class="fas fa-pencil-ruler icon-edit"></i><div><span class="card-label-small">Rom:</span><h5 class="card-title-large">${r.name}</h5><span class="card-info-text">Antall bord: ${r.desk_count}</span></div>`; grid.appendChild(card); }); }
function deleteSelectedDesk() { if (rightClickedDesk) { rightClickedDesk.remove(); rightClickedDesk = null; document.getElementById('deskContextMenu').style.display = 'none'; showToast("Bord slettet"); } }
// FIX: saveRoom only uses DOM, so no array state issues
function spawnDesk(x, y) { const d = document.createElement('div'); d.className = 'desk'; d.innerText = "Bord"; d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.width = DESK_W + 'px'; d.style.height = DESK_H + 'px'; d.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); rightClickedDesk = d; const menu = document.getElementById('deskContextMenu'); menu.style.display = 'block'; menu.style.left = e.pageX + 'px'; menu.style.top = e.pageY + 'px'; }); d.onmousedown = (e) => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); const canvas = document.getElementById('roomCanvas'); const rect = d.getBoundingClientRect(); const offsetX = e.clientX - rect.left; const offsetY = e.clientY - rect.top; const otherDesks = Array.from(document.querySelectorAll('.desk')).filter(el => el !== d).map(el => ({ el: el, x: parseInt(el.style.left), y: parseInt(el.style.top), w: DESK_W, h: DESK_H })); canvas.appendChild(d); let isDragging = false; const startMouseX = e.clientX; const startMouseY = e.clientY; const move = (ev) => { if (!isDragging && (Math.abs(ev.clientX - startMouseX) > 5 || Math.abs(ev.clientY - startMouseY) > 5)) isDragging = true; if (!isDragging) return; const canvasRect = canvas.getBoundingClientRect(); let newX = ev.clientX - canvasRect.left - offsetX; let newY = ev.clientY - canvasRect.top - offsetY; if (newX < 0) newX = 0; if (newY < 0) newY = 0; const snap = checkSnapping(newX, newY, otherDesks); d.style.left = snap.x + 'px'; d.style.top = snap.y + 'px'; if (snap.snapped) d.classList.add('is-snapped'); else d.classList.remove('is-snapped'); }; const stop = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); if (isDragging) { if (d.classList.contains('is-snapped')) { d.classList.add('snap-effect'); setTimeout(() => d.classList.remove('snap-effect'), 500); } d.classList.remove('is-snapped'); } }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', stop); }; document.getElementById('roomCanvas').appendChild(d); }
function checkSnapping(x, y, otherDesks) { const THRESHOLD = 10; let finalX = x; let finalY = y; let snapped = false; for (let other of otherDesks) { const ox = other.x; const oy = other.y; const ow = other.w; const oh = other.h; if (Math.abs(x - (ox + ow)) < THRESHOLD) { finalX = ox + ow; snapped = true; } else if (Math.abs(x - (ox - DESK_W)) < THRESHOLD) { finalX = ox - DESK_W; snapped = true; } else if (Math.abs(x - ox) < THRESHOLD) { finalX = ox; snapped = true; } if (Math.abs(y - (oy + oh)) < THRESHOLD) { finalY = oy + oh; snapped = true; } else if (Math.abs(y - oy) < THRESHOLD) { finalY = oy; snapped = true; } } return { x: finalX, y: finalY, snapped }; }
function applyPreset(val) { if (!val) return; document.getElementById('rowConfigInput').value = val; }
function generateLayoutFromConfig() { const configStr = document.getElementById('rowConfigInput').value; const rowCount = parseInt(document.getElementById('rowCountInput').value); const limit = parseInt(document.getElementById('limitCountInput').value); if (!configStr || rowCount < 1) return showToast("Sjekk innstillinger"); const canvas = document.getElementById('roomCanvas'); canvas.innerHTML = '<div class="front-board"></div>'; const groups = configStr.split(',').map(n => parseInt(n.trim())); const canvasW = canvas.offsetWidth; const margin = 20; const gap = 0; const aisle = 40; const totalCols = groups.reduce((a, b) => a + b, 0); const totalAisles = Math.max(0, groups.length - 1); let startY = 60; let placedCount = 0; for (let r = 0; r < rowCount; r++) { let rowWidth = (totalCols * DESK_W) + (totalAisles * aisle); let startX = (canvasW - rowWidth) / 2; if (startX < margin) startX = margin; let currentX = startX; groups.forEach((groupSize, gIdx) => { for (let i = 0; i < groupSize; i++) { if (placedCount >= limit) return; spawnDesk(currentX, startY); currentX += DESK_W + gap; placedCount++; } if (gIdx < groups.length - 1) currentX += aisle; }); startY += DESK_H + 30; if (placedCount >= limit) break; } lastDeskPos = { x: 20, y: startY }; }
function addTableSmart() { spawnDesk(lastDeskPos.x, lastDeskPos.y); lastDeskPos.x += (DESK_W + 10); }
function clearRoomCanvas() { document.getElementById('roomCanvas').innerHTML = '<div class="front-board"></div>'; }
async function saveRoom() {
    if (editingChartId) return; // Sikkerhet: Ikke lagre rom fra kart-editor
    const name = document.getElementById('roomNameInput').value; if (!name) return showToast("Mangler navn!"); const layout = []; document.querySelectorAll('.desk').forEach(d => { layout.push({ x: parseInt(d.style.left), y: parseInt(d.style.top) }); }); const payload = { name, layout }; const method = editingId ? 'PUT' : 'POST'; const url = editingId ? `${API_URL}/rooms/${editingId}` : `${API_URL}/rooms`; await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); showToast(editingId ? "Rom oppdatert!" : "Rom opprettet!"); navTo('view-rooms');
}
async function deleteRoom() { if (!editingId) return; await fetch(`${API_URL}/rooms/${editingId}`, { method: 'DELETE' }); showToast("Rom slettet"); navTo('view-rooms'); }

// ==========================================
// MODUL 3: COMPLETE SEATING SYSTEM
// ==========================================

// 1. DASHBOARD
async function loadChartsDashboard() {
    const res = await fetch(`${API_URL}/charts`);
    const charts = await res.json();
    const grid = document.getElementById('chartGrid');
    grid.innerHTML = "";

    if (charts.length === 0) {
        grid.innerHTML = `<p class="empty-state">Ingen klassekart lagret.</p>`;
        return;
    }

    charts.forEach(chart => {
        const card = document.createElement('div');
        card.className = "info-card";

        let dateStr = "Dato ukjent";
        try {
            if (chart.created_at) dateStr = new Date(chart.created_at).toLocaleDateString('no-NO');
        } catch (e) { }

        const subtitle = chart.comment ? `<div style="font-size:0.9rem; color:#f59e0b;">${chart.comment}</div>` : '';

        card.innerHTML = `
            <div>
                <span class="card-label-small">${dateStr}</span>
                <h5 class="card-title-large" style="font-size: 1.5rem;">${chart.name}</h5>
                ${subtitle}
                <span class="card-info-text">${chart.class_name || 'Ukjent'} i ${chart.room_name || 'Ukjent'}</span>
            </div>
            <div class="mt-3 d-flex gap-2">
                <button class="btn-action btn-secondary btn-sm-action" onclick="openChartDisplay(${chart.id})">Vis</button>
                <button class="btn-action btn-secondary btn-sm-action" onclick="openChartEdit(${chart.id})">Rediger</button>
                <button class="btn-action btn-danger btn-sm-action ms-auto" onclick="deleteChart(${chart.id})"><i class="fas fa-trash"></i></button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openSeatingSetup() {
    document.getElementById('chartNameInput').value = "";
    document.getElementById('chartCommentInput').value = "";
    loadSetupOptions();
    navTo('view-seating-setup');
}

async function loadSetupOptions() {
    const cRes = await fetch(`${API_URL}/classes`); const classes = await cRes.json();
    const rRes = await fetch(`${API_URL}/rooms`); const rooms = await rRes.json();
    const cSelect = document.getElementById('setupClassSelect'); cSelect.innerHTML = '<option value="">Velg klasse...</option>';
    classes.forEach(c => cSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`);
    const rSelect = document.getElementById('setupRoomSelect'); rSelect.innerHTML = '<option value="">Velg rom...</option>';
    rooms.forEach(r => rSelect.innerHTML += `<option value="${r.id}">${r.name}</option>`);
}

async function startNewChart() {
    const name = document.getElementById('chartNameInput').value;
    const comment = document.getElementById('chartCommentInput').value;
    const classId = document.getElementById('setupClassSelect').value;
    const roomId = document.getElementById('setupRoomSelect').value;

    if (!name || !classId || !roomId) return showToast("Fyll ut alle felt");

    currentChartName = name;
    currentChartComment = comment;
    currentClassId = classId;
    currentRoomId = roomId;
    editingChartId = null;

    // Get fresh room layout
    const rRes = await fetch(`${API_URL}/rooms/${roomId}`);
    const roomData = await rRes.json();

    // RESET LAYOUT (No colors, no groups)
    currentSeatingLayout = [];
    roomData.layout.forEach((pos, idx) => {
        currentSeatingLayout.push({
            ...pos,
            student: null,
            groupId: null,
            colorClass: 'bg-default', // RESET
            locked: false
        });
    });

    // Force reset colors when populating students
    await generateSeating(false, true);

    document.getElementById('seatingTitle').innerText = "Opprett: " + name;
    document.getElementById('editChartName').value = name;
    document.getElementById('editChartComment').value = comment;
    navTo('view-seating-editor');
}

// 2. EDITING
async function openChartEdit(id) {
    editingChartId = id;
    const res = await fetch(`${API_URL}/charts/${id}`);
    const chart = await res.json();

    currentChartName = chart.name;
    currentChartComment = chart.comment || "";
    currentClassId = chart.class_id;
    currentRoomId = chart.room_id;

    document.getElementById('seatingTitle').innerText = "Redigerer: " + chart.name;
    document.getElementById('editChartName').value = currentChartName;
    document.getElementById('editChartComment').value = currentChartComment;

    currentSeatingLayout = chart.layout.map(spot => ({
        x: spot.x, y: spot.y,
        groupId: spot.groupId,
        colorClass: spot.color || 'bg-default',
        locked: spot.locked || false,
        student: spot.student
    }));

    renderSeating();
    navTo('view-seating-editor');
}

async function deleteChart(id) {
    if (!confirm("Er du sikker?")) return;
    await fetch(`${API_URL}/charts/${id}`, { method: 'DELETE' });
    showToast("Kart slettet");
    loadChartsDashboard();
}

// 3. DISPLAY & ZOOM
function changeZoom(delta) {
    currentZoom += delta;
    if (currentZoom < 0.5) currentZoom = 0.5;
    if (currentZoom > 2.0) currentZoom = 2.0;

    const content = document.getElementById('displayCanvas');
    content.style.transform = `scale(${currentZoom})`;
}

async function openChartDisplay(id) {
    const res = await fetch(`${API_URL}/charts/${id}`);
    const chart = await res.json();
    document.getElementById('displayTitle').innerText = chart.name;
    document.getElementById('displaySubtitle').innerText = chart.comment || "";

    const canvas = document.querySelector('#displayCanvas .front-board').parentElement;
    // Clear old desks
    const old = canvas.querySelectorAll('.desk');
    old.forEach(o => o.remove());

    currentZoom = 1.0;
    document.getElementById('displayCanvas').style.transform = `scale(1)`;

    chart.layout.forEach(spot => {
        const d = document.createElement('div');
        d.className = `desk ${spot.color || 'bg-default'}`;
        d.style.left = spot.x + 'px'; d.style.top = spot.y + 'px';
        d.style.width = DESK_W + 'px'; d.style.height = DESK_H + 'px';
        d.innerText = spot.student ? spot.student.name : "-";
        if (spot.groupId) {
            d.style.borderColor = GROUP_COLORS[spot.groupId % GROUP_COLORS.length];
            d.style.borderWidth = "3px";
        }
        canvas.appendChild(d);
    });
    navTo('view-chart-display');
}

// 4. EDITOR LOGIC
function renderSeating() {
    const canvas = document.getElementById('seatingCanvas');
    const oldDesks = canvas.querySelectorAll('.desk');
    oldDesks.forEach(od => od.remove());

    currentSeatingLayout.forEach((spot, i) => {
        const d = document.createElement('div');
        d.className = `desk ${spot.colorClass}`;

        d.style.left = spot.x + 'px'; d.style.top = spot.y + 'px';
        d.style.width = DESK_W + 'px'; d.style.height = DESK_H + 'px';
        d.id = `seat-desk-${i}`;

        d.draggable = !spot.locked;
        d.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', i);
            e.dataTransfer.effectAllowed = "move";
            setTimeout(() => { d.classList.add('drag-source'); }, 0);
        };
        d.ondragend = () => { d.classList.remove('drag-source'); };
        d.ondragover = (e) => { e.preventDefault(); };
        d.ondrop = (e) => {
            e.preventDefault();
            const srcIdx = parseInt(e.dataTransfer.getData('text/plain'));
            swapStudents(srcIdx, i);
        };

        if (spot.student) {
            d.innerText = spot.student.name;
            if (spot.student.note) {
                const icon = document.createElement('i');
                icon.className = 'fas fa-sticky-note note-icon';
                d.appendChild(icon);
            }
            if (spot.locked) {
                const lock = document.createElement('i');
                lock.className = 'fas fa-lock lock-icon';
                d.appendChild(lock);
            }

            d.oncontextmenu = (e) => {
                e.preventDefault(); selectedSeatingDeskIdx = i;
                const menu = document.getElementById('seatingContextMenu');
                document.getElementById('ctxStudentActions').style.display = spot.student ? 'block' : 'none';
                document.getElementById('ctxGroupActions').style.display = spot.groupId ? 'block' : 'none';
                const lockText = document.getElementById('ctxLockText');
                lockText.innerText = spot.locked ? "Lås opp plass" : "Lås plass";

                if (spot.student) {
                    const noteDisplay = document.getElementById('ctxNoteDisplay');
                    if (spot.student.note) {
                        noteDisplay.innerText = "Notat: " + spot.student.note;
                        noteDisplay.classList.add('has-note');
                    } else {
                        noteDisplay.classList.remove('has-note');
                    }
                    document.getElementById('ctxHistoryList').innerHTML = `<div class="history-item">Ingen tidligere data</div>`;
                }
                const menuHeight = 350; menu.style.display = 'block'; menu.style.left = e.pageX + 'px';
                if (e.clientY + menuHeight > window.innerHeight) menu.style.top = (e.pageY - menuHeight) + 'px';
                else menu.style.top = e.pageY + 'px';
            };
        } else {
            d.innerText = "-";
        }

        if (spot.groupId) {
            d.setAttribute('data-group', spot.groupId);
            d.style.borderColor = GROUP_COLORS[spot.groupId % GROUP_COLORS.length];
            d.style.borderWidth = "3px";
        }
        d.onclick = () => handleDeskClick(d, i);
        canvas.appendChild(d);
    });
}

function swapStudents(srcIdx, tgtIdx) {
    if (currentSeatingLayout[srcIdx].locked || currentSeatingLayout[tgtIdx].locked) {
        showToast("Kan ikke flytte låst elev");
        return;
    }
    if (srcIdx === tgtIdx) return;
    const tempStudent = currentSeatingLayout[srcIdx].student;
    const tempColor = currentSeatingLayout[srcIdx].colorClass;
    currentSeatingLayout[srcIdx].student = currentSeatingLayout[tgtIdx].student;
    currentSeatingLayout[srcIdx].colorClass = currentSeatingLayout[tgtIdx].colorClass;
    currentSeatingLayout[tgtIdx].student = tempStudent;
    currentSeatingLayout[tgtIdx].colorClass = tempColor;
    renderSeating();
}

function toggleDeskLock() {
    if (selectedSeatingDeskIdx !== null) {
        const spot = currentSeatingLayout[selectedSeatingDeskIdx];
        spot.locked = !spot.locked;
        renderSeating();
        document.getElementById('seatingContextMenu').style.display = 'none';
    }
}

async function setDeskColor(colorClass) {
    if (selectedSeatingDeskIdx !== null) {
        currentSeatingLayout[selectedSeatingDeskIdx].colorClass = colorClass;
        renderSeating();
        document.getElementById('seatingContextMenu').style.display = 'none';
    }
}

async function editStudentNote() {
    if (selectedSeatingDeskIdx === null) return;
    const spot = currentSeatingLayout[selectedSeatingDeskIdx];
    if (!spot.student) return;
    const newNote = prompt("Skriv inn notat for " + spot.student.name, spot.student.note || "");
    if (newNote !== null) {
        spot.student.note = newNote;
        if (spot.student.id) {
            await fetch(`${API_URL}/students/${spot.student.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: newNote }) });
        }
        showToast("Notat lagret"); renderSeating();
    }
    document.getElementById('seatingContextMenu').style.display = 'none';
}

function ungroupDesk() {
    if (selectedSeatingDeskIdx !== null) {
        currentSeatingLayout[selectedSeatingDeskIdx].groupId = null;
        showToast("Fjernet fra gruppe"); renderSeating();
        document.getElementById('seatingContextMenu').style.display = 'none';
    }
}

function toggleGroupMode() {
    isGroupMode = !isGroupMode;
    const btn = document.getElementById('btnGroupMode');
    if (isGroupMode) {
        btn.classList.add('btn-group-mode'); btn.innerText = "Lagre Gruppe"; selectedDesksForGroup = []; showToast("Klikk på bord for å lage en gruppe");
    } else {
        if (selectedDesksForGroup.length > 0) {
            const gid = ++groupCounter;
            selectedDesksForGroup.forEach(idx => { currentSeatingLayout[idx].groupId = gid; });
            showToast(`Gruppe ${gid} opprettet!`); renderSeating();
        }
        btn.classList.remove('btn-group-mode'); btn.innerHTML = '<i class="fas fa-object-group"></i> Lag Grupper';
    }
}

function handleDeskClick(element, idx) {
    if (!isGroupMode) return;
    if (selectedDesksForGroup.includes(idx)) {
        selectedDesksForGroup = selectedDesksForGroup.filter(i => i !== idx); element.classList.remove('selected-for-group');
    } else {
        selectedDesksForGroup.push(idx); element.classList.add('selected-for-group');
    }
}

async function generateSeating(keepLayout = false, forceResetColors = false) {
    if (!currentClassId) return showToast("Mangler klasse!");

    let studentsPool = [];
    if (currentSeatingLayout.some(s => s.student) && keepLayout) {
        studentsPool = currentSeatingLayout.filter(s => s.student).map(s => s.student);
    } else {
        const res = await fetch(`${API_URL}/classes/${currentClassId}`);
        const data = await res.json();
        studentsPool = data.students;
    }

    const lockedStudentsIds = [];
    currentSeatingLayout.forEach(spot => {
        if (spot.locked && spot.student) {
            lockedStudentsIds.push(spot.student.id);
        }
    });

    let studentsToShuffle = studentsPool.filter(s => !lockedStudentsIds.includes(s.id));
    studentsToShuffle = studentsToShuffle.sort(() => Math.random() - 0.5);

    let shuffleIndex = 0;
    currentSeatingLayout.forEach((spot) => {
        if (!spot.locked) {
            if (shuffleIndex < studentsToShuffle.length) {
                spot.student = studentsToShuffle[shuffleIndex];
                if (forceResetColors) spot.colorClass = 'bg-default';
            } else {
                spot.student = null;
                if (forceResetColors) spot.colorClass = 'bg-default';
            }
            shuffleIndex++;
        }
    });

    renderSeating();
    if (!keepLayout) showToast("Elever plassert!");
}

async function saveCurrentChart() {
    const name = document.getElementById('editChartName').value;
    const comment = document.getElementById('editChartComment').value;

    if (!name) return showToast("Navn mangler!");

    const layoutSnapshot = currentSeatingLayout.map(s => ({
        x: s.x, y: s.y,
        student: s.student ? { id: s.student.id, name: s.student.name, note: s.student.note } : null,
        groupId: s.groupId,
        color: s.colorClass,
        locked: s.locked
    }));

    const chartData = {
        name: name,
        comment: comment,
        classId: currentClassId,
        roomId: currentRoomId,
        layout: layoutSnapshot
    };

    const method = editingChartId ? 'PUT' : 'POST';
    const url = editingChartId ? `${API_URL}/charts/${editingChartId}` : `${API_URL}/charts`;

    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chartData) });
    showToast("Kart lagret!");
    navTo('view-charts-dashboard');
}

loadClasses();