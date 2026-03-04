const { ipcRenderer } = require('electron');
const onboarding = require('./modules/onboarding');
const classes = require('./modules/classes');
const transforms = require('./modules/transforms');
const { DESK_W, DESK_H, SNAP_THRESHOLD, CANVAS_W, ROOM_EDITOR_CANVAS_H, GROUP_COLORS, DESK_TYPES, state } = require('./modules/state');

// --- APP STATE ---
// Mutable state lives in state.js for cross-module access.
// renderer.js uses local lets for backward compatibility; extracted modules use state.xxx directly.
let editingId = null;
let currentChart = { id: null, classId: null, roomId: null, layout: [], allStudents: [] };
let modalCallback = null;
let deleteCallback = null;
let confirmCallback = null;
let rightClickedDesk = null;
let selectedSeatingDeskIdx = null;
let selectedStudentPos = null;
let isGroupMode = false;
let selectedDesksForGroup = [];
let groupCounter = 0;
let activeDropdown = null;
let selectedDesks = [];

// Keep state.js in sync for modules that read it
function syncState() {
    state.editingId = editingId;
    state.currentChart = currentChart;
    state.modalCallback = modalCallback;
    state.deleteCallback = deleteCallback;
    state.confirmCallback = confirmCallback;
    state.rightClickedDesk = rightClickedDesk;
    state.selectedSeatingDeskIdx = selectedSeatingDeskIdx;
    state.selectedStudentPos = selectedStudentPos;
    state.isGroupMode = isGroupMode;
    state.selectedDesksForGroup = selectedDesksForGroup;
    state.groupCounter = groupCounter;
    state.activeDropdown = activeDropdown;
    state.selectedDesks = selectedDesks;
}


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

    // Remove room editor keyboard listeners when leaving room editor
    if (view !== 'view-room-editor') {
        removeRoomEditorKeyboardListeners();
    }

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

let benchTooltipTimeout = null;
function showBenchTooltip(el, names) {
    if (!names || names.length === 0) return;
    const tt = document.getElementById('benchTooltip');
    if (!tt) return;
    clearTimeout(benchTooltipTimeout);
    const namesEl = tt.querySelector('.bench-tooltip-names');
    namesEl.innerHTML = names.map(n => `<span>${n}</span>`).join('');
    benchTooltipTimeout = setTimeout(() => {
        const rect = el.getBoundingClientRect();
        tt.style.left = (rect.left + rect.width / 2) + 'px';
        tt.style.top = (rect.top - 8) + 'px';
        tt.style.transform = 'translate(-50%, -100%)';
        tt.classList.add('show');
    }, 250);
}
function hideBenchTooltip() {
    clearTimeout(benchTooltipTimeout);
    const tt = document.getElementById('benchTooltip');
    if (tt) tt.classList.remove('show');
}

// --- STANDARD VISNING (PREFERANSE) ---
async function toggleDefaultFlip() {
    const isChecked = document.getElementById('defaultFlipToggle').checked;
    await ipcRenderer.invoke('save-setting', 'defaultFlipped', isChecked);
    applyDefaultFlip('seatingCanvas');
    applyDefaultFlip('displayCanvas');
}

async function applyDefaultFlip(canvasId) {
    const isFlipped = await ipcRenderer.invoke('get-setting', 'defaultFlipped');
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // For seatingCanvas: use coordinate transform for board-top+flipped (no CSS flip, no empty space)
    // board-bottom never uses flip
    if (canvasId === 'seatingCanvas' && currentChart) {
        const roomDesignMode = currentChart.roomDesignMode || 'board-top';
        currentChart.shouldFlipForDisplay = isFlipped;
        if (roomDesignMode === 'board-bottom' || (roomDesignMode === 'board-top' && isFlipped)) {
            canvas.classList.remove('flipped');
            renderSeating(); // Re-render with correct coordinates
            return;
        }
        // board-top without flip: remove flipped class
        canvas.classList.remove('flipped');
        renderSeating();
        return;
    }

    // displayCanvas and others
    if (isFlipped) {
        canvas.classList.add('flipped');
    } else {
        canvas.classList.remove('flipped');
    }
}

// Toggle design mode for room editor (coordinate transform, no CSS flip)
function toggleDesignMode() {
    const canvas = document.getElementById('roomCanvas');
    if (!canvas) return;

    // Never use CSS flip; remove if present
    canvas.classList.remove('flipped');
    if (canvas.style) canvas.style.setProperty('--flip-offset', '0px');

    const isChecked = document.getElementById('designModeToggle').checked;
    const layoutToShow = isChecked
        ? transformCoordinatesForMode(roomEditorLayoutBoardTop, 'board-top', 'board-bottom', roomEditorCurrentHeight)
        : roomEditorLayoutBoardTop;

    renderRoomCanvas(layoutToShow);
    setRoomEditorBoardPosition(isChecked);
}

// Prevent Electron from intercepting HTML5 drag-and-drop as native file drags.
// Without this, Electron shows a forbidden cursor and blocks in-page drag-and-drop entirely.
// Global drag event monitoring (Capture Phase)
// Document-level preventDefault allows HTML5 drops to function and intercepts Electron file drops
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    document.addEventListener(evt, (e) => {
        // We MUST preventDefault on dragenter and dragover to allow drop
        if (evt === 'dragover' || evt === 'dragenter') {
            e.preventDefault();
        }
        if (evt === 'drop') {
            e.preventDefault();
        }
    }, true);
});

document.addEventListener('DOMContentLoaded', async () => {
    const isFlipped = await ipcRenderer.invoke('get-setting', 'defaultFlipped');
    const toggle = document.getElementById('defaultFlipToggle');
    if (toggle) toggle.checked = isFlipped;

    // Last inn innhold for standardvisning (charts dashboard)
    await loadCharts();

    // Sjekk om onboarding wizard skal vises
    const hasCompletedOnboarding = await ipcRenderer.invoke('get-setting', 'onboardingCompleted');
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

function showVippsNumber() {
    openConfirmModal('Vipps', 'Telefonnummer: 970 33 580', () => { });
}

// ABOUT MODAL
// Settings Modal with Tabs
async function openSettingsModal() {
    document.getElementById('settingsModal').style.display = 'flex';
    switchTab('settings'); // Default to Settings tab

    // Sync "Tavle nederst" toggle with settings
    const isFlipped = await ipcRenderer.invoke('get-setting', 'defaultFlipped');
    const toggle = document.getElementById('defaultFlipToggle');
    if (toggle) toggle.checked = isFlipped;

    // Load database path
    try {
        const dbPath = await ipcRenderer.invoke('get-db-path');
        document.getElementById('dbPathDisplay').textContent = dbPath;
    } catch (err) {
        document.getElementById('dbPathDisplay').textContent = 'Kunne ikke laste database-plassering';
    }
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

function switchTab(tabId, event) {
    // Hide all tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab pane
    const targetPane = document.getElementById(`tab-${tabId}`);
    if (targetPane) {
        targetPane.classList.add('active');
    }

    // Add active class to clicked button (if called from event)
    if (event && event.target) {
        const button = event.target.closest('.tab-button');
        if (button) {
            button.classList.add('active');
        }
    } else {
        // If called programmatically, find and activate the matching button
        const button = document.querySelector(`.tab-button[onclick*="${tabId}"]`);
        if (button) {
            button.classList.add('active');
        }
    }
}

// Database Backup/Restore Functions
async function backupDatabase() {
    try {
        const result = await ipcRenderer.invoke('backup-database');

        if (result.canceled) {
            return; // User cancelled, do nothing
        }

        if (result.success) {
            showToast(`✓ Database backed up: ${result.filename}`);
        } else {
            showToast(`✗ Backup feilet: ${result.error}`);
        }
    } catch (err) {
        showToast(`✗ Feil ved backup: ${err.message}`);
    }
}

async function restoreDatabase() {
    // Show confirmation warning
    openConfirmModal(
        'Gjenopprett database',
        '⚠️ Dette vil erstatte ALL eksisterende data med data fra backup-filen. Denne handlingen kan ikke angres. Er du sikker?',
        async (confirmed) => {
            if (!confirmed) return;

            try {
                const result = await ipcRenderer.invoke('restore-database');

                if (result.canceled) {
                    return; // User cancelled, do nothing
                }

                if (result.success) {
                    showToast('✓ Database gjenopprettet. Laster applikasjon på nytt...');

                    // Close settings modal
                    closeSettingsModal();

                    // Reload all data after short delay
                    setTimeout(() => {
                        location.reload();
                    }, 1500);
                } else {
                    showToast(`✗ Gjenoppretting feilet: ${result.error}`);
                }
            } catch (err) {
                showToast(`✗ Feil ved gjenoppretting: ${err.message}`);
            }
        }
    );
}

async function moveDatabase() {
    // Show confirmation with explanation
    openConfirmModal(
        'Flytt database',
        'Dette vil flytte databasen til en ny plassering. Applikasjonen må startes på nytt etter flytting. Er du sikker?',
        async (confirmed) => {
            if (!confirmed) return;

            try {
                const result = await ipcRenderer.invoke('move-database');

                if (result.canceled) {
                    return; // User cancelled, do nothing
                }

                if (result.success) {
                    showToast(`✓ Database flyttet til: ${result.newPath}`);

                    // Close settings modal
                    closeSettingsModal();

                    // Show message about restart requirement
                    setTimeout(() => {
                        openConfirmModal(
                            'Applikasjon må startes på nytt',
                            'Databasen er flyttet. Applikasjonen må startes på nytt for at endringen skal tre i kraft. Start på nytt nå?',
                            (restart) => {
                                if (restart) {
                                    location.reload();
                                }
                            }
                        );
                    }, 500);
                } else {
                    showToast(`✗ Flytting feilet: ${result.error}`);
                }
            } catch (err) {
                showToast(`✗ Feil ved flytting: ${err.message}`);
            }
        }
    );
}

// =========================================================
// PRESENTATION / NEW WINDOW FUNCTION
// =========================================================
async function openPresentationWindow() {
    if (!currentChart || !currentChart.layout) return showToast("Ingen data å vise");

    const isFlipped = await ipcRenderer.invoke('get-setting', 'defaultFlipped');

    // Get room design mode
    let designMode = 'board-top';
    let roomHeight = 500;
    if (currentChart.roomId) {
        const room = await ipcRenderer.invoke('get-room', currentChart.roomId);
        if (room) {
            const roomLayout = ensureRoomLayoutFormat(JSON.parse(room.layout_data || '{}'));
            designMode = roomLayout.designMode || 'board-top';
            roomHeight = roomLayout.roomHeight || 500;
        }
    }

    // Use coordinate transform for board-top + tavle nederst (no CSS flip, no empty space)
    const layoutToSend = getRenderedLayoutForDisplay(currentChart.layout, designMode, isFlipped, roomHeight);
    const showBoardAtBottom = designMode === 'board-bottom' || (designMode === 'board-top' && isFlipped);

    const dataToSend = {
        layout: layoutToSend,
        defaultFlipped: isFlipped,
        designMode: designMode,
        showBoardAtBottom: showBoardAtBottom  // Don't use CSS flip - use coord transform
    };
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

    // Get position relative to roomContainer
    const containerRect = roomContainer.getBoundingClientRect();
    selectionStart = {
        x: e.clientX - containerRect.left + roomContainer.scrollLeft,
        y: e.clientY - containerRect.top + roomContainer.scrollTop
    };

    selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    selectionBox.style.position = 'absolute';
    selectionBox.style.left = selectionStart.x + 'px';
    selectionBox.style.top = selectionStart.y + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.pointerEvents = 'none';
    // Append to roomCanvas instead of body
    document.getElementById('roomCanvas').appendChild(selectionBox);
};

window.addEventListener('mousemove', (e) => {
    if (!isSelecting || !selectionBox) return;

    const containerRect = roomContainer.getBoundingClientRect();
    const currentX = e.clientX - containerRect.left + roomContainer.scrollLeft;
    const currentY = e.clientY - containerRect.top + roomContainer.scrollTop;

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
// CLASS LOGIC (extracted to modules/classes.js)
// =========================================================
classes.init({ showToast, navTo });

// Expose class functions to window scope for HTML onclick handlers
window.loadClasses = classes.loadClasses;
window.editClass = classes.editClass;
window.saveClass = classes.saveClass;
window.deleteClass = classes.deleteClass;
window.openClassCreate = classes.openClassCreate;
window.addStudentsFromPaste = classes.addStudentsFromPaste;
window.removeStudent = classes.removeStudent;
window.renderStudentList = classes.renderStudentList;

// Keep references for internal use
const loadClasses = classes.loadClasses;
const parseStudentsFromText = classes.parseStudentsFromText;
const escapeHtml = classes.escapeHtml;
const studentList = { get: classes.getStudentList, set: classes.setStudentList };

// =========================================================
// ROOM LOGIC
// =========================================================

// Room editor: layout always stored in board-top coords; display uses transform when "snu visning" is on (no CSS flip)
let roomEditorLayoutBoardTop = state.roomEditorLayoutBoardTop;
let roomEditorCurrentHeight = state.roomEditorCurrentHeight;

function isRoomEditorDisplayFlipped() {
    const t = document.getElementById('designModeToggle');
    return t ? t.checked === true : false;
}

function readRoomEditorLayoutFromDOM() {
    const desks = [];
    document.querySelectorAll('#roomCanvas .desk').forEach(d => {
        const type = d.dataset.type || 'single';
        const spec = DESK_TYPES[type];
        if (spec) {
            desks.push({
                x: parseInt(d.style.left || 0),
                y: parseInt(d.style.top || 0),
                rotation: parseInt(d.dataset.rotation || 0),
                type: type,
                capacity: spec.capacity
            });
        }
    });
    return desks;
}

function getCalculatedRoomHeight(desks) {
    if (!desks || desks.length === 0) return 500;
    let maxY = 0;
    desks.forEach(d => {
        const type = d.type || 'single';
        const h = getDeskHeight(type);
        if (d.y + h > maxY) maxY = d.y + h;
    });
    return Math.max(500, maxY + 150);
}

function syncRoomEditorLayoutFromDOM() {
    const fromDOM = readRoomEditorLayoutFromDOM();
    roomEditorLayoutBoardTop = isRoomEditorDisplayFlipped()
        ? transformCoordinatesForMode(fromDOM, 'board-bottom', 'board-top', roomEditorCurrentHeight)
        : fromDOM;
    roomEditorCurrentHeight = getCalculatedRoomHeight(roomEditorLayoutBoardTop);
}

function setRoomEditorBoardPosition(atBottom) {
    const canvas = document.getElementById('roomCanvas');
    const board = canvas ? canvas.querySelector('.front-board') : null;
    if (!board) return;
    if (atBottom) {
        board.style.top = 'auto';
        board.style.bottom = '10px';
    } else {
        board.style.top = '10px';
        board.style.bottom = 'auto';
    }
}

async function openRoomCreate() {
    editingId = null;
    document.getElementById('roomEditorTitle').innerText = "Opprett rom";
    document.getElementById('roomNameInput').value = '';
    document.getElementById('btnRoomDelete').style.display = 'none';
    roomEditorLayoutBoardTop = [];
    roomEditorCurrentHeight = 500;
    selectedDesks = [];
    clearCanvas();

    // Sync design mode toggle with "Tavle nederst" setting
    const defaultFlipped = await ipcRenderer.invoke('get-setting', 'defaultFlipped');
    const designModeToggle = document.getElementById('designModeToggle');
    if (designModeToggle) {
        designModeToggle.checked = defaultFlipped;
    }
    toggleDesignMode();
    attachRoomEditorKeyboardListeners();
}
async function loadRooms() {
    const rooms = await ipcRenderer.invoke('get-rooms');
    const grid = document.getElementById('roomGrid'); grid.innerHTML = '';
    rooms.forEach(r => {
        const layoutData = ensureRoomLayoutFormat(JSON.parse(r.layout_data || '[]'));
        const deskCount = layoutData.desks ? layoutData.desks.length : 0;
        const modeIcon = layoutData.designMode === 'board-bottom' ? '<i class="fas fa-arrow-down" style="color: #3b82f6;" title="Tavle nederst"></i> ' : '';

        grid.innerHTML += `
            <div class="info-card" onclick="editRoom(${r.id})">
                <span class="card-label-small">ROM</span>
                <h5 class="card-title-large">${modeIcon}${r.name}</h5>
                <span class="card-info-text">${deskCount} Bord</span>
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

    // Parse layout and ensure correct format
    const layoutData = ensureRoomLayoutFormat(JSON.parse(r.layout_data));
    roomEditorCurrentHeight = layoutData.roomHeight || 500;

    // Store layout in board-top; set toggle and render in display space
    roomEditorLayoutBoardTop = (layoutData.designMode === 'board-bottom')
        ? transformCoordinatesForMode(layoutData.desks, 'board-bottom', 'board-top', roomEditorCurrentHeight)
        : layoutData.desks;

    const designModeToggle = document.getElementById('designModeToggle');
    if (designModeToggle) {
        designModeToggle.checked = (layoutData.designMode === 'board-bottom');
    }

    const layoutToShow = (layoutData.designMode === 'board-bottom')
        ? transformCoordinatesForMode(roomEditorLayoutBoardTop, 'board-top', 'board-bottom', roomEditorCurrentHeight)
        : roomEditorLayoutBoardTop;

    renderRoomCanvas(layoutToShow);
    setRoomEditorBoardPosition(layoutData.designMode === 'board-bottom');

    navTo('view-room-editor');
}
function renderRoomCanvas(layout) {
    const c = document.getElementById('roomCanvas');
    c.classList.remove('flipped');
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
    selectedDesks = [];
    setRoomEditorBoardPosition(isRoomEditorDisplayFlipped());
    attachRoomEditorKeyboardListeners();

    // Ensure canvas expands to fit layout and shows background grid correctly
    c.style.height = Math.max(500, roomEditorCurrentHeight) + 'px';
}

function ensureCanvasHeight(yPos) {
    const canvas = document.getElementById('roomCanvas');
    const currentHeight = canvas.clientHeight;
    if (yPos + DESK_H + 50 > currentHeight) {
        canvas.style.height = (yPos + DESK_H + 100) + 'px';
    }
}

// Adjust canvas height when flipped to ensure all desks are visible (for room editor)
function adjustCanvasForFlip() {
    const canvas = document.getElementById('roomCanvas');
    if (!canvas) return;

    const isFlipped = canvas.classList.contains('flipped');
    if (!isFlipped) {
        // Reset to default if not flipped
        canvas.style.setProperty('--flip-offset', '0px');
        return;
    }

    const desks = Array.from(canvas.querySelectorAll('.desk'));
    if (desks.length === 0) return;

    // Find the highest Y position (bottom-most desk)
    let maxY = 0;
    desks.forEach(d => {
        const y = parseInt(d.style.top || 0);
        const h = parseInt(d.style.height || DESK_H);
        if (y + h > maxY) maxY = y + h;
    });

    // Calculate needed offset for flipped view
    const baseHeight = 500;
    const buffer = 150; // Extra space at bottom when flipped
    const flipOffset = Math.max(0, maxY - baseHeight + buffer);

    canvas.style.setProperty('--flip-offset', flipOffset + 'px');
    const newHeight = baseHeight + flipOffset;
    if (newHeight > parseInt(canvas.style.height || 500)) {
        canvas.style.height = newHeight + 'px';
    }
}

// Adjust canvas height when flipped for seating (klassekart editor)
function adjustCanvasForFlipSeating() {
    const canvas = document.getElementById('seatingCanvas');
    if (!canvas) return;

    const isFlipped = canvas.classList.contains('flipped');
    if (!isFlipped) {
        canvas.style.setProperty('--flip-offset', '0px');
        return;
    }

    const desks = Array.from(canvas.querySelectorAll('.desk'));
    if (desks.length === 0) return;

    // Find the highest Y position (bottom-most desk)
    let maxY = 0;
    desks.forEach(d => {
        const h = parseInt(d.style.height || DESK_H);
        const y = parseInt(d.style.top || 0);
        if (y + h > maxY) maxY = y + h;
    });

    // Calculate needed offset for flipped view based purely on internal desk positions
    const baseHeight = 500;
    const buffer = 150;
    const flipOffset = Math.max(0, maxY - baseHeight + buffer);

    canvas.style.setProperty('--flip-offset', flipOffset + 'px');
}

// =========================================================
// COORDINATE TRANSFORMATION (extracted to modules/transforms.js)
// =========================================================

const getDeskHeight = transforms.getDeskHeight;
const getDeskWidth = transforms.getDeskWidth;
const transformCoordinatesForMode = transforms.transformCoordinatesForMode;
const getRenderedLayoutForDisplay = transforms.getRenderedLayoutForDisplay;
const ensureRoomLayoutFormat = transforms.ensureRoomLayoutFormat;


function generateLayout() {
    const preset = document.getElementById('roomPreset').value;
    const rows = parseInt(document.getElementById('roomRows').value) || 4;
    if (!preset) {
        showToast('⚠️ Velg en struktur først');
        return;
    }

    const canvas = document.getElementById('roomCanvas');
    canvas.innerHTML = '<div class="front-board">TAVLE</div>';
    canvas.style.height = '100%';

    // ALWAYS use single desks for auto-generation
    const selectedType = 'single';
    const spec = DESK_TYPES.single;

    const groups = preset.split(',').map(s => Number(String(s).trim())).filter(n => n > 0);
    if (groups.length === 0) {
        showToast('⚠️ Ugyldig struktur');
        return;
    }
    const gap = 2; // Liten avstand mellom pulter i samme gruppe (2-2 = to og to inntil hverandre)
    const aisle = 40; // Gang mellom gruppene
    const rowGap = 30; // Avstand mellom rader

    // Radbredde = sum per gruppe (antall*bredde + (antall-1)*gap) + gang mellom gruppene
    let rowWidth = 0;
    groups.forEach((gSize, gIdx) => {
        rowWidth += gSize * spec.width + Math.max(0, gSize - 1) * gap;
        if (gIdx < groups.length - 1) rowWidth += aisle;
    });

    let startY = 70;

    for (let r = 0; r < rows; r++) {
        let startX = (CANVAS_W - rowWidth) / 2;
        if (startX < 20) startX = 20;

        let currentX = startX;
        groups.forEach((gSize, gIdx) => {
            for (let i = 0; i < gSize; i++) {
                spawnDesk(currentX, startY, canvas, selectedType);
                currentX += spec.width + (i < gSize - 1 ? gap : 0);
            }
            if (gIdx < groups.length - 1) currentX += aisle;
        });
        startY += spec.height + rowGap;
    }
    syncRoomEditorLayoutFromDOM();
    updateDeskNumbers();
    showToast(`✓ Layout generert med enkeltpulter`);
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

    const isFlipped = isRoomEditorDisplayFlipped();
    const targetCenterY = isFlipped ? (ROOM_EDITOR_CANVAS_H - 100) : (ROOM_EDITOR_CANVAS_H / 2 + 15);
    const currentCenterY = minY + (contentHeight / 2);
    const diffY = targetCenterY - currentCenterY;

    desks.forEach(d => {
        const currentX = parseInt(d.style.left);
        const currentY = parseInt(d.style.top);
        d.style.left = (currentX + diffX) + 'px';
        d.style.top = Math.max(60, currentY + diffY) + 'px';
    });

    syncRoomEditorLayoutFromDOM();
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
            syncRoomEditorLayoutFromDOM();
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
    syncRoomEditorLayoutFromDOM();
    updateDeskNumbers();
}

function deleteSelectedDesks() {
    if (selectedDesks.length === 0) return;

    const count = selectedDesks.length;
    selectedDesks.forEach(desk => desk.remove());
    selectedDesks = [];

    syncRoomEditorLayoutFromDOM();
    updateDeskNumbers();
    showToast(`✓ ${count} bord slettet`);
}

// Keyboard event handler for room editor
let roomEditorKeyHandler = null;

function attachRoomEditorKeyboardListeners() {
    // Remove existing listener if any
    if (roomEditorKeyHandler) {
        document.removeEventListener('keydown', roomEditorKeyHandler);
    }

    roomEditorKeyHandler = (e) => {
        // Only handle if we're in room editor view
        const roomEditorView = document.getElementById('view-room-editor');
        if (!roomEditorView || !roomEditorView.classList.contains('active')) return;

        // Delete or Backspace key
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Don't delete if user is typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }

            e.preventDefault();

            if (selectedDesks.length > 0) {
                deleteSelectedDesks();
            }
        }

        // Escape key to deselect all
        if (e.key === 'Escape') {
            if (selectedDesks.length > 0) {
                selectedDesks.forEach(d => d.classList.remove('is-selected'));
                selectedDesks = [];
                showToast('Avmarkert');
            }
        }

        // Ctrl+A to select all desks
        if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const allDesks = Array.from(document.querySelectorAll('#roomCanvas .desk'));
            selectedDesks.forEach(d => d.classList.remove('is-selected'));
            selectedDesks = allDesks;
            selectedDesks.forEach(d => d.classList.add('is-selected'));
            if (allDesks.length > 0) {
                showToast(`${allDesks.length} bord markert`);
            }
        }
    };

    document.addEventListener('keydown', roomEditorKeyHandler);
    console.log('Room editor keyboard listeners attached');
}

function removeRoomEditorKeyboardListeners() {
    if (roomEditorKeyHandler) {
        document.removeEventListener('keydown', roomEditorKeyHandler);
        roomEditorKeyHandler = null;
    }
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

function findEmptySpot(newWidth, newHeight) {
    const desks = Array.from(document.querySelectorAll('#roomCanvas .desk'));
    const padding = 15;
    const startX = 20;
    // Layout is in display space; "top" of room is always low Y
    const startY = 60;
    const maxX = CANVAS_W - 20;

    // Try to find a spot by scanning in a grid pattern
    for (let y = startY; y < 2000; y += 30) {
        for (let x = startX; x < maxX - newWidth; x += 30) {
            // Check if this position overlaps with any existing desk
            let overlaps = false;

            for (let desk of desks) {
                const deskX = parseInt(desk.style.left);
                const deskY = parseInt(desk.style.top);
                const deskWidth = parseInt(desk.style.width);
                const deskHeight = parseInt(desk.style.height);

                // Check for overlap with padding
                if (!(x + newWidth + padding < deskX ||
                    x > deskX + deskWidth + padding ||
                    y + newHeight + padding < deskY ||
                    y > deskY + deskHeight + padding)) {
                    overlaps = true;
                    break;
                }
            }

            if (!overlaps) {
                return { x, y };
            }
        }
    }

    // Fallback: place at end of canvas
    if (desks.length > 0) {
        const last = desks[desks.length - 1];
        const lastY = parseInt(last.style.top);
        const lastHeight = parseInt(last.style.height);
        return { x: startX, y: lastY + lastHeight + 40 };
    }

    return { x: startX, y: startY };
}

function addDeskOfType(type) {
    const spec = DESK_TYPES[type];
    const position = findEmptySpot(spec.width, spec.height);

    spawnDesk(position.x, position.y, document.getElementById('roomCanvas'), type);
    syncRoomEditorLayoutFromDOM();
    updateDeskNumbers();
    showToast(`✓ ${DESK_TYPES[type].name} lagt til`);
}

// Legacy function for compatibility
function addDesk() {
    addDeskOfType('single');
}

function clearCanvas() {
    roomEditorLayoutBoardTop = [];
    document.getElementById('roomCanvas').innerHTML = '<div class="front-board">TAVLE</div>';
    toggleDesignMode();
}

async function saveRoom() {
    const name = document.getElementById('roomNameInput').value;
    syncRoomEditorLayoutFromDOM();

    const designModeToggle = document.getElementById('designModeToggle');
    const designMode = designModeToggle && designModeToggle.checked ? 'board-bottom' : 'board-top';

    const layout = {
        desks: roomEditorLayoutBoardTop,
        designMode: designMode,
        roomHeight: roomEditorCurrentHeight
    };

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
    const cls = await ipcRenderer.invoke('get-classes');
    const rms = await ipcRenderer.invoke('get-rooms');

    // Klasser med antall elever
    const classOptions = cls.map(c => {
        const studentCount = c.students ? c.students.split('\n').filter(s => s.trim()).length : 0;
        return `<option value="${c.id}">${c.name} (${studentCount} elever)</option>`;
    }).join('');
    document.getElementById('setupClassSelect').innerHTML = '<option value="">Velg gruppe</option>' + classOptions;

    // Rom med antall plasser
    const roomOptions = rms.map(r => {
        let totalCapacity = 0;
        try {
            const layoutData = ensureRoomLayoutFormat(JSON.parse(r.layout_data || '[]'));
            const desks = layoutData.desks || [];
            totalCapacity = desks.reduce((sum, desk) => {
                const deskType = desk.type || 'single';
                const spec = DESK_TYPES[deskType];
                const capacity = desk.capacity ?? spec?.capacity ?? 1;
                return sum + capacity;
            }, 0);
        } catch (e) {
            totalCapacity = 0;
        }
        return `<option value="${r.id}">${r.name} (${totalCapacity} plasser)</option>`;
    }).join('');
    document.getElementById('setupRoomSelect').innerHTML = '<option value="">Velg rom</option>' + roomOptions;
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
    if (!room) return showToast("Rom ikke funnet");

    const layoutData = ensureRoomLayoutFormat(JSON.parse(room.layout_data || '[]'));
    const rawLayout = layoutData.desks || [];
    if (!rawLayout.length) return showToast("Rommet har ingen bord – legg til bord i Mine rom først");

    const cls = await ipcRenderer.invoke('get-class', cid);
    const studentList = cls.students.split('\n').filter(s => s.trim());

    const layout = rawLayout.map(p => ({
        ...p,
        type: p.type || 'single',
        capacity: p.capacity ?? (DESK_TYPES[p.type || 'single']?.capacity ?? 1),
        students: null,
        student: null,
        color: 'bg-default',
        locked: false,
        groupId: null
    }));

    const shouldFlipForDisplay = await ipcRenderer.invoke('get-setting', 'defaultFlipped');
    currentChart = {
        id: null, classId: cid, roomId: rid, layout: layout,
        allStudents: studentList,
        roomDesignMode: layoutData.designMode || 'board-top',
        roomHeight: layoutData.roomHeight || 500,
        shouldFlipForDisplay: shouldFlipForDisplay
    };
    document.getElementById('editChartName').value = name;

    const currentWeek = getWeekNumber(new Date());
    document.getElementById('editChartComment').value = `Uke ${currentWeek} - ${currentWeek + 4}`;

    await generateSeating(false);
    renderSeating();
    navTo('view-seating-editor');
    loadNormalToolbar();
}

async function editChart(id) {
    const charts = await ipcRenderer.invoke('get-seatings'); const c = charts.find(x => x.id == id);

    // FETCH FULL STUDENT LIST AGAIN TO DETECT NEW STUDENTS
    const cls = await ipcRenderer.invoke('get-class', c.class_id);
    const studentList = cls.students.split('\n').filter(s => s.trim());

    // Fetch room data to check designMode
    let roomDesignMode = 'board-top';
    let roomHeight = 500;
    if (c.room_id) {
        const room = await ipcRenderer.invoke('get-room', c.room_id);
        if (room) {
            const roomLayout = ensureRoomLayoutFormat(JSON.parse(room.layout_data || '{}'));
            roomDesignMode = roomLayout.designMode || 'board-top';
            roomHeight = roomLayout.roomHeight || 500;
        }
    }

    const shouldFlipForDisplay = await ipcRenderer.invoke('get-setting', 'defaultFlipped');
    currentChart = {
        id: c.id,
        classId: c.class_id,
        roomId: c.room_id,
        layout: JSON.parse(c.placements),
        allStudents: studentList,
        roomDesignMode: roomDesignMode,
        roomHeight: roomHeight,
        shouldFlipForDisplay: shouldFlipForDisplay
    };
    document.getElementById('editChartName').value = c.name;
    document.getElementById('editChartComment').value = c.comment;
    renderSeating();
    navTo('view-seating-editor');
    loadNormalToolbar();
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

            const layoutData = ensureRoomLayoutFormat(JSON.parse(room.layout_data || '[]'));
            const newLayoutBase = layoutData.desks || [];

            const newLayout = newLayoutBase.map((pos, i) => {
                const oldSpot = currentChart.layout[i];
                const deskType = pos.type || 'single';
                const spec = DESK_TYPES[deskType];
                const deskCapacity = pos.capacity ?? spec?.capacity ?? 1;

                return {
                    x: pos.x,
                    y: pos.y,
                    type: deskType,
                    rotation: pos.rotation || 0,
                    capacity: deskCapacity,
                    students: oldSpot ? oldSpot.students : null,  // null for new desks
                    student: oldSpot ? oldSpot.student : null,
                    color: oldSpot ? oldSpot.color : 'bg-default',
                    locked: false,  // Reset locked when syncing
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
    const editorActions = document.querySelector('#view-seating-editor .editor-actions');

    if (isGroupMode) {
        // Switch to grouping mode UI
        editorActions.classList.add('mode-grouping');
        editorActions.innerHTML = `
            <span class="mode-badge">Grupperingsmodus aktiv</span>
            <button class="btn-action btn-secondary btn-toolbar" onclick="resetGroups()">
                <i class="fas fa-eraser"></i> Nullstill
            </button>
            <button class="btn-action btn-primary btn-toolbar" onclick="confirmGrouping()">
                <i class="fas fa-check"></i> Ferdig
            </button>
            <button class="btn-action btn-secondary btn-toolbar" onclick="cancelGroupMode()">
                <i class="fas fa-times"></i> Avbryt
            </button>
        `;
        document.getElementById('btnConfirmGroup').style.display = 'block';
        document.getElementById('seatingCanvas').classList.add('group-mode-active');
        selectedDesksForGroup = [];
        showToast("Klikk på bord + ENTER for å lage en gruppe");
        window.addEventListener('keydown', handleGroupEnter);
    } else {
        cancelGroupMode();
    }
    syncState();
}

function cancelGroupMode() {
    isGroupMode = false;
    selectedDesksForGroup = [];
    document.getElementById('btnConfirmGroup').style.display = 'none';
    window.removeEventListener('keydown', handleGroupEnter);
    document.querySelectorAll('.selected-for-group').forEach(el => el.classList.remove('selected-for-group'));

    // Restore normal toolbar
    const editorActions = document.querySelector('#view-seating-editor .editor-actions');
    editorActions.classList.remove('mode-grouping');
    document.getElementById('seatingCanvas').classList.remove('group-mode-active');
    loadNormalToolbar();
    renderSeating();
    syncState();
}

function confirmGrouping() {
    if (selectedDesksForGroup.length > 0) {
        groupCounter++;
        selectedDesksForGroup.forEach(idx => {
            currentChart.layout[idx].groupId = groupCounter;
        });
        selectedDesksForGroup = [];
    }
    cancelGroupMode();
}

function loadNormalToolbar() {
    const editorActions = document.querySelector('#view-seating-editor .editor-actions');
    editorActions.innerHTML = `
        <div class="btn-group">
            <button class="btn-action btn-secondary btn-toolbar dropdown-toggle" onclick="toggleDropdown('toolsDropdown')">
                <i class="fas fa-tools"></i> Verktøy
            </button>
            <div class="dropdown-menu" id="toolsDropdown">
                <a onclick="showAddDeskModal()"><i class="fas fa-plus"></i> Legg til bord</a>
                <a onclick="syncRoomLayout()"><i class="fas fa-sync-alt"></i> Oppdater fra rom</a>
                <hr>
                <a onclick="openPresentationWindow()"><i class="fas fa-desktop"></i> Fullskjermvisning</a>
                <a onclick="toggleGroupMode()"><i class="fas fa-object-group"></i> Lag grupper</a>
                <a onclick="startNewPeriod()"><i class="fas fa-code-branch"></i> Ny periode</a>
            </div>
        </div>
        <button class="btn-action btn-accent btn-toolbar" onclick="generateSeating()">
            <i class="fas fa-random"></i> Shuffle
        </button>
        <button class="btn-action btn-primary btn-toolbar" onclick="saveChart()">
            <i class="fas fa-save"></i> Lagre
        </button>
        <button class="btn-action btn-secondary btn-toolbar" onclick="navTo('view-charts-dashboard')">
            <i class="fas fa-times"></i>
        </button>
    `;
}

function toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    if (activeDropdown && activeDropdown !== dropdown) {
        activeDropdown.classList.remove('show');
    }
    dropdown.classList.toggle('show');
    activeDropdown = dropdown.classList.contains('show') ? dropdown : null;
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

// --- LEGG TIL BORD I SEATING EDITOR ---
function showAddDeskModal() {
    if (activeDropdown) {
        activeDropdown.classList.remove('show');
        activeDropdown = null;
    }

    const types = Object.keys(DESK_TYPES);
    const html = types.map(type => {
        const spec = DESK_TYPES[type];
        return `
            <button class="desk-type-option" onclick="addDeskToSeating('${type}')">
                <div class="desk-preview type-${type}">${spec.capacity}</div>
                <span>${spec.name}</span>
            </button>
        `;
    }).join('');

    openModal("Legg til bord", "", () => { });
    const modalContent = document.querySelector('#customModal .modal-content');
    modalContent.innerHTML = `
        <div class="modal-title">Legg til bord</div>
        <div class="desk-type-selector">
            ${html}
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end;">
            <button class="btn-action btn-secondary" onclick="closeModal(false)">Avbryt</button>
        </div>
    `;
    document.getElementById('customModal').style.display = 'flex';
}

function addDeskToSeating(type) {
    if (!currentChart.layout) return;

    const spec = DESK_TYPES[type];
    const position = findOptimalDeskPosition(currentChart.layout, type);

    const newDesk = {
        x: position.x,
        y: position.y,
        type: type,
        capacity: spec.capacity,
        students: null,
        student: null,
        color: 'bg-default',
        locked: false,
        groupId: null,
        rotation: 0
    };

    currentChart.layout.push(newDesk);
    closeModal(false);

    // Render først
    renderSeating();

    // Deretter aktivere drag-mode med visuell feedback
    const newDeskIdx = currentChart.layout.length - 1;
    showToast(`${spec.name} lagt til - dra for å plassere`);

    // Highlight new desk
    setTimeout(() => {
        const deskElements = document.querySelectorAll('#seatingCanvas .desk');
        if (deskElements[newDeskIdx]) {
            const newDeskEl = deskElements[newDeskIdx];
            newDeskEl.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.8)';
            newDeskEl.style.border = '3px solid #3b82f6';

            // Enable dragging immediately
            enableDeskDragging(newDeskEl, newDeskIdx);

            // Remove highlight after 3 seconds
            setTimeout(() => {
                newDeskEl.style.boxShadow = '';
                newDeskEl.style.border = '';
            }, 3000);
        }
    }, 100);
}

function enableDeskDragging(deskEl, idx) {
    let isDragging = false;
    let startX, startY, offsetX, offsetY;

    deskEl.style.cursor = 'move';

    deskEl.onmousedown = function (e) {
        if (isGroupMode) return;
        if (e.target.closest('.student-name-item') || e.target.closest('.bench-slot')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = deskEl.getBoundingClientRect();
        const container = document.getElementById('seatingCanvas').getBoundingClientRect();
        offsetX = startX - rect.left - container.left;
        offsetY = startY - rect.top - container.top;

        deskEl.style.opacity = '0.7';
        deskEl.style.zIndex = '1000';

        function onMouseMove(e) {
            if (!isDragging) return;

            const containerRect = document.getElementById('seatingCanvas').getBoundingClientRect();
            let newX = e.clientX - containerRect.left - offsetX;
            let newY = e.clientY - containerRect.top - offsetY;

            // Bounds checking
            newX = Math.max(10, Math.min(newX, containerRect.width - 100));
            newY = Math.max(60, Math.min(newY, containerRect.height - 70));

            deskEl.style.left = newX + 'px';
            deskEl.style.top = newY + 'px';

            // Save to layout - inverse transform if using coordinate transform (tavle nederst)
            let saveX = Math.round(newX);
            let saveY = Math.round(newY);
            if (currentChart.shouldFlipForDisplay && (currentChart.roomDesignMode || 'board-top') === 'board-top') {
                const deskType = currentChart.layout[idx].type || 'single';
                const roomHeight = currentChart.roomHeight || 500;
                saveX = CANVAS_W - newX - getDeskWidth(deskType);
                saveX = Math.round(saveX);
                saveY = roomHeight - newY - getDeskHeight(deskType);
                saveY = Math.round(saveY);
            }
            currentChart.layout[idx].x = saveX;
            currentChart.layout[idx].y = saveY;
        }

        function onMouseUp() {
            if (!isDragging) return;
            isDragging = false;
            deskEl.style.opacity = '1';
            deskEl.style.zIndex = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        e.preventDefault();
    };
}

function findOptimalDeskPosition(layout, deskType) {
    const spec = DESK_TYPES[deskType];
    const width = spec.width || 85;
    const height = spec.height || 55;

    if (layout.length === 0) {
        return { x: 100, y: 100 };
    }

    // Find rightmost and bottommost positions
    let maxX = -Infinity;
    let maxY = -Infinity;
    let avgY = 0;

    layout.forEach(desk => {
        if (desk.x > maxX) maxX = desk.x;
        if (desk.y > maxY) maxY = desk.y;
        avgY += desk.y;
    });

    avgY = Math.floor(avgY / layout.length);

    // Try to place to the right of rightmost desk
    const newX = maxX + 100;
    const newY = avgY;

    // Check if it fits in view (simple check)
    if (newX > 800) {
        // If too far right, place below
        return { x: 100, y: maxY + 100 };
    }

    return { x: newX, y: newY };
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
            desk.students.filter(s => s).forEach(s => placedNames.push(s.name || s));
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
            const canvas = document.getElementById('seatingCanvas');
            if (canvas) canvas.classList.add('drag-active');
            e.dataTransfer.setData("text/plain", name);
        };
        chip.ondragend = () => {
            const canvas = document.getElementById('seatingCanvas');
            if (canvas) canvas.classList.remove('drag-active');
        };

        dock.appendChild(chip);
    });
}

function handleStudentSwap(e, targetDeskIdx, targetStudentPos) {
    const name = e.dataTransfer.getData('text/plain');
    const sourceDeskIdx = e.dataTransfer.getData('source-desk-idx');
    const sourceStudentPos = e.dataTransfer.getData('source-student-pos');



    if (!name || !sourceDeskIdx || !sourceStudentPos) {
        // This is a drop from unplaced dock or external source
        const targetDesk = currentChart.layout[targetDeskIdx];
        const capacity = targetDesk.capacity || 1;
        const currentStudents = targetDesk.students || [];

        if (currentStudents.length < capacity) {
            const newStudent = { name: name, note: '', locked: false, position: currentStudents.length };
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

        return;
    }

    const sourceDesk = currentChart.layout[srcIdx];
    const targetDesk = currentChart.layout[targetDeskIdx];

    if (!sourceDesk || !targetDesk) return;

    // Ensure both are objects (handle legacy string arrays from DB)
    if (typeof sourceDesk.students[srcPos] === 'string') {
        sourceDesk.students[srcPos] = { name: sourceDesk.students[srcPos], note: '', locked: false, position: srcPos };
    }
    if (typeof targetDesk.students[targetStudentPos] === 'string') {
        targetDesk.students[targetStudentPos] = { name: targetDesk.students[targetStudentPos], note: '', locked: false, position: targetStudentPos };
    }

    const draggedStudent = sourceDesk.students[srcPos];
    const targetStudent = targetDesk.students[targetStudentPos];

    if (!draggedStudent || !targetStudent) return;
    if (draggedStudent.locked || targetStudent.locked) {
        showToast('Kan ikke bytte med låst elev');
        return;
    }

    const tempName = draggedStudent.name;
    const tempNote = draggedStudent.note || '';
    const targetOriginalName = targetStudent.name;

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

function applyAutoScaling(deskElement, students, deskType) {
    // Only apply to round tables with multiple students
    if (!deskType.startsWith('round') || !students || students.length === 0) return;

    const validStudents = students.filter(s => s);
    if (validStudents.length === 0) return;

    // Calculate average name length
    const avgNameLength = validStudents.reduce((sum, s) => sum + (s.name || s).length, 0) / validStudents.length;
    const studentCount = validStudents.length;

    // Base font sizes for different capacities
    const baseFontSizes = {
        round3: 0.7,
        round4: 0.68,
        round6: 0.65
    };

    let fontSize = baseFontSizes[deskType] || 0.7;

    // PRIMARY: Scale based on average name length (longer names = smaller font)
    // This is the most important factor
    if (avgNameLength > 15) {
        fontSize *= 0.70;
    } else if (avgNameLength > 12) {
        fontSize *= 0.80;
    } else if (avgNameLength > 10) {
        fontSize *= 0.85;
    } else if (avgNameLength > 8) {
        fontSize *= 0.90;
    } else if (avgNameLength > 6) {
        fontSize *= 0.95;
    }
    // Short names (≤6 chars) keep full size

    // SECONDARY: Minor adjustment based on student count
    // Only reduce significantly if both many students AND long names
    if (studentCount >= 6 && avgNameLength > 8) {
        fontSize *= 0.90;
    } else if (studentCount >= 5 && avgNameLength > 10) {
        fontSize *= 0.92;
    }

    // Apply minimum font size
    fontSize = Math.max(fontSize, 0.45);

    // Apply to all student name items in this desk
    const nameItems = deskElement.querySelectorAll('.student-name-item');
    nameItems.forEach(item => {
        item.style.fontSize = `${fontSize}rem`;
    });
}

function renderSeating() {
    hideBenchTooltip(); // Skjul tooltip før rendering
    const c = document.getElementById('seatingCanvas');
    c.innerHTML = '<div class="front-board">TAVLE</div>';

    // Check if room is designed with board-bottom mode and if tavle nederst is set
    const roomDesignMode = currentChart.roomDesignMode || 'board-top';
    const shouldFlipForDisplay = currentChart.shouldFlipForDisplay === true;
    const board = c.querySelector('.front-board');

    // Get layout with coordinate transform when board-top + tavle nederst (no CSS flip - eliminates empty space)
    const layoutToRender = getRenderedLayoutForDisplay(
        currentChart.layout,
        roomDesignMode,
        shouldFlipForDisplay,
        currentChart.roomHeight || 500
    );

    // Place board at bottom when: board-bottom design OR (board-top + tavle nederst via coord transform)
    if (roomDesignMode === 'board-bottom' || (roomDesignMode === 'board-top' && shouldFlipForDisplay)) {
        if (board) {
            board.style.top = 'auto';
            board.style.bottom = '10px';
        }
        // Don't use CSS flip - we use coordinate transform for board-top+flipped
        c.classList.remove('flipped');
    } else {
        // Board-top without tavle nederst
        if (board) {
            board.style.top = '10px';
            board.style.bottom = 'auto';
        }
        applyDefaultFlip('seatingCanvas');
    }

    currentChart.layout.forEach((desk, idx) => {
        function showSeatingContextMenu(e, studentPos = null) {
            e.preventDefault();
            e.stopPropagation();
            selectedSeatingDeskIdx = idx;
            selectedStudentPos = studentPos;
            const spot = currentChart.layout[idx];
            const m = document.getElementById('seatingContextMenu');

            // Sjekk om det er en elev å låse
            let hasStudent = false;
            let isLocked = false;
            if (studentPos !== null && spot.students?.[studentPos]) {
                hasStudent = true;
                isLocked = spot.students[studentPos].locked;
            } else if (spot.students) {
                const firstStudent = spot.students.find(s => s);
                if (firstStudent) {
                    hasStudent = true;
                    isLocked = firstStudent.locked;
                }
            } else if (spot.student) {
                hasStudent = true;
                isLocked = spot.student.locked;
            }

            // Oppdater meny-tekster
            document.getElementById('ctxLockText').innerText = isLocked ? "Lås opp plassering" : "Lås plassering";
            document.getElementById('ctxNoteAction').style.display = hasStudent ? 'block' : 'none';
            document.getElementById('ctxLockAction').style.display = hasStudent ? 'block' : 'none';

            const ungroupItem = document.getElementById('ctxUngroupAction');
            ungroupItem.style.display = spot.groupId ? 'block' : 'none';
            m.style.display = 'block';
            m.style.left = e.pageX + 'px';
            m.style.top = e.pageY + 'px';
        }
        const d = document.createElement('div');
        let colorClass = desk.color || 'bg-default';

        d.className = `desk ${colorClass}`;

        // Add type and rotation classes
        const deskType = desk.type || 'single';
        d.classList.add(`type-${deskType}`);
        if (desk.rotation && desk.rotation !== 0) {
            d.classList.add(`rotated-${desk.rotation}`);
        }

        // Set position and dimensions (use layoutToRender for transformed coords when tavle nederst)
        const pos = layoutToRender[idx] || desk;
        d.style.left = pos.x + 'px';
        d.style.top = pos.y + 'px';
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

        const capacity = desk.capacity || (DESK_TYPES[deskType] && DESK_TYPES[deskType].capacity) || 1;

        if (students[0] && deskType === 'single') {
            // Single desk: hele bordet er draggable (treff hvorsomhelst)
            const nameSpan = document.createElement('span');
            nameSpan.className = 'student-name-single';
            const studentData = students[0];
            const studentName = studentData.name || studentData;
            const isLocked = !!studentData.locked;
            nameSpan.innerText = studentName;
            if (studentName.length > 10) nameSpan.style.fontSize = '0.75rem';
            if (studentName.length > 15) nameSpan.style.fontSize = '0.65rem';
            if (studentName.length > 20) nameSpan.style.fontSize = '0.55rem';

            // Tillat høyreklikk på navnet for notat, men ikke venstreklikk (for drag)
            nameSpan.style.cursor = isLocked ? 'default' : 'grab';
            nameSpan.style.pointerEvents = isGroupMode ? 'none' : 'auto';
            nameSpan.onmousedown = (e) => {
                if (isGroupMode) return; // La klikk gå til desk
                if (e.button === 0) { // Venstreklikk - la det gå til desk for drag
                    if (!isLocked) e.stopPropagation();
                }
            };
            nameSpan.oncontextmenu = (e) => showSeatingContextMenu(e, 0);

            // Allow drops on the nameSpan itself (critical for single desks where nameSpan covers the desk)
            nameSpan.ondragover = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            };
            nameSpan.ondrop = (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleStudentSwap(e, idx, 0);
            };

            d.appendChild(nameSpan);

            // CRITICAL: Use insertAdjacentHTML instead of innerHTML += to preserve nameSpan's event handlers
            if (studentData.note) {
                d.insertAdjacentHTML('beforeend', `<i class="fas fa-sticky-note note-icon"></i>`);
            }
            if (isLocked) {
                d.insertAdjacentHTML('beforeend', `<i class="fas fa-lock lock-icon"></i>`);
            }

            // Hele bordet draggable – treff hvorsomhelst (kun hvis ikke låst)
            if (!isLocked) {
                d.draggable = true;
                d.style.cursor = 'grab';
                d.onmousedown = (e) => {
                    if (isGroupMode) { handleDeskClick(d, idx); return; }
                    if (e.target === nameSpan) return; // La nameSpan håndtere sin own mousedown
                    e.stopPropagation();
                };
                d.ondragstart = (e) => {
                    if (isGroupMode) return;
                    c.classList.add('drag-active');
                    d.classList.add('drag-source');
                    nameSpan.style.opacity = '0.5';
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', studentName);
                    e.dataTransfer.setData('source-desk-idx', idx.toString());
                    e.dataTransfer.setData('source-student-pos', '0');
                };
                d.ondragend = () => { c.classList.remove('drag-active'); d.classList.remove('drag-source'); nameSpan.style.opacity = '1'; };
            } else {
                d.style.cursor = 'default';
                d.ondblclick = () => showToast('Eleven er låst og kan ikke flyttes');
            }
        } else if (deskType === 'single' && !students[0]) {
            const slotDiv = document.createElement('div');
            slotDiv.className = 'bench-slot bench-slot-empty';
            slotDiv.innerHTML = '<span class="bench-slot-hint">+</span>';
            slotDiv.style.display = 'flex';
            slotDiv.style.alignItems = 'center';
            slotDiv.style.justifyContent = 'center';
            slotDiv.style.minHeight = '100%';
            slotDiv.ondragover = (e) => { e.preventDefault(); slotDiv.classList.add('drop-target-active'); };
            slotDiv.ondragleave = () => slotDiv.classList.remove('drop-target-active');
            slotDiv.ondrop = (e) => {
                e.preventDefault();
                e.stopPropagation();
                slotDiv.classList.remove('drop-target-active');
                const name = e.dataTransfer.getData("text/plain");
                if (!name) return;
                const sourceDeskIdx = e.dataTransfer.getData("source-desk-idx");
                const sourceStudentPos = e.dataTransfer.getData("source-student-pos");
                if (sourceDeskIdx !== '' && sourceStudentPos !== '') {
                    const srcIdx = parseInt(sourceDeskIdx);
                    const srcPos = parseInt(sourceStudentPos);
                    const srcDesk = currentChart.layout[srcIdx];
                    if (srcDesk?.students?.[srcPos]?.locked) return;
                }
                // Get student data from source if available
                let studentData = null;
                if (sourceDeskIdx && sourceStudentPos) {
                    const srcIdx = parseInt(sourceDeskIdx);
                    const srcPos = parseInt(sourceStudentPos);
                    if (srcIdx !== idx && currentChart.layout[srcIdx]) {
                        const srcDesk = currentChart.layout[srcIdx];
                        studentData = srcDesk?.students?.[srcPos];
                    }
                }

                const newStudent = studentData
                    ? { ...studentData, position: 0 }
                    : { name: name, note: '', locked: false, position: 0 };
                desk.students = [newStudent];
                desk.student = newStudent;
                desk.capacity = 1;
                if (sourceDeskIdx !== '' && sourceStudentPos !== '') {
                    const srcIdx = parseInt(sourceDeskIdx);
                    const srcPos = parseInt(sourceStudentPos);
                    if (srcIdx !== idx && currentChart.layout[srcIdx]) {
                        const srcDesk = currentChart.layout[srcIdx];
                        if (srcDesk.students?.[srcPos]) {
                            // For single desks, clear the array; for multi-student desks, set to null
                            if (srcDesk.type === 'single') {
                                srcDesk.students = [null];
                                srcDesk.student = null;
                            } else {
                                srcDesk.students[srcPos] = null;
                                const firstStudent = srcDesk.students.find(s => s);
                                srcDesk.student = firstStudent || null;
                            }
                        }
                    }
                }
                renderSeating();
            };
            // Ingen kontekstmeny på tomme slots
            d.appendChild(slotDiv);
        } else if (deskType === 'bench2' || deskType === 'bench4' || deskType === 'round3' || deskType === 'round4' || deskType === 'round6') {
            // Sluker for bench og round – tomme som "+"-drop-soner
            const nameContainer = document.createElement('div');
            nameContainer.className = 'student-names-list';
            const slots = capacity;
            for (let pos = 0; pos < slots; pos++) {
                const slotDiv = document.createElement('div');
                slotDiv.className = 'bench-slot';
                slotDiv.dataset.slot = pos.toString();
                const student = students[pos];
                if (student) {
                    const studentName = student.name || student;
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'student-name-item';

                    // Create text node for name
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'student-name-text';
                    nameSpan.textContent = studentName;
                    nameDiv.appendChild(nameSpan);

                    nameDiv.title = studentName; // Tooltip for full name
                    const isLocked = !!student.locked;
                    nameDiv.draggable = !isLocked;
                    nameDiv.style.cursor = isLocked ? 'default' : 'grab';
                    nameDiv.style.pointerEvents = isGroupMode ? 'none' : 'auto';
                    nameDiv.onmousedown = (e) => {
                        if (isGroupMode) return; // La klikk gå til desk
                        e.stopPropagation();
                    };
                    nameDiv.ondragstart = (e) => {
                        if (isLocked) {
                            e.preventDefault();
                            showToast('Eleven er låst og kan ikke flyttes');
                            return;
                        }
                        e.stopPropagation();
                        c.classList.add('drag-active');
                        d.classList.add('drag-source');
                        nameDiv.style.opacity = '0.5';
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData("text/plain", studentName);
                        e.dataTransfer.setData("source-desk-idx", idx.toString());
                        e.dataTransfer.setData("source-student-pos", pos.toString());
                    };
                    nameDiv.ondragend = () => { c.classList.remove('drag-active'); d.classList.remove('drag-source'); nameDiv.style.opacity = '1'; };
                    nameDiv.ondragover = (e) => { e.preventDefault(); if (!isLocked) nameDiv.style.background = 'rgba(14, 165, 233, 0.3)'; };
                    nameDiv.ondragleave = () => { nameDiv.style.background = ''; };
                    nameDiv.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); nameDiv.style.background = ''; handleStudentSwap(e, idx, pos); };
                    nameDiv.oncontextmenu = (ev) => showSeatingContextMenu(ev, pos);

                    // Create icon container
                    const iconContainer = document.createElement('div');
                    iconContainer.className = 'student-icons';
                    iconContainer.style.display = 'inline-flex';
                    iconContainer.style.gap = '2px';
                    iconContainer.style.marginLeft = '3px';
                    iconContainer.style.pointerEvents = 'none';

                    if (student.note) {
                        const noteIcon = document.createElement('i');
                        noteIcon.className = 'fas fa-sticky-note';
                        noteIcon.style.fontSize = '0.5rem';
                        noteIcon.style.color = '#fcd34d';
                        iconContainer.appendChild(noteIcon);
                    }
                    if (isLocked) {
                        const lockIcon = document.createElement('i');
                        lockIcon.className = 'fas fa-lock';
                        lockIcon.style.fontSize = '0.5rem';
                        lockIcon.style.color = '#fbbf24';
                        iconContainer.appendChild(lockIcon);
                    }

                    if (iconContainer.children.length > 0) {
                        nameDiv.appendChild(iconContainer);
                    }

                    slotDiv.appendChild(nameDiv);
                } else {
                    slotDiv.classList.add('bench-slot-empty');
                    slotDiv.innerHTML = '<span class="bench-slot-hint">+</span>';
                    slotDiv.ondragover = (e) => { e.preventDefault(); slotDiv.classList.add('drop-target-active'); };
                    slotDiv.ondragleave = () => slotDiv.classList.remove('drop-target-active');
                    slotDiv.ondrop = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        slotDiv.classList.remove('drop-target-active');
                        const name = e.dataTransfer.getData("text/plain");
                        const sourceDeskIdx = e.dataTransfer.getData("source-desk-idx");
                        const sourceStudentPos = e.dataTransfer.getData("source-student-pos");
                        if (!name) return;
                        if (sourceDeskIdx !== '' && sourceStudentPos !== '') {
                            const srcIdx = parseInt(sourceDeskIdx);
                            const srcPos = parseInt(sourceStudentPos);
                            const srcDesk = currentChart.layout[srcIdx];
                            const srcStudent = srcDesk?.students?.[srcPos];
                            if (srcStudent?.locked) {
                                showToast('Eleven er låst og kan ikke flyttes');
                                return;
                            }
                        }
                        const spec = DESK_TYPES[deskType];
                        const maxSlots = desk.capacity || spec?.capacity || capacity;
                        desk.students = desk.students || Array(maxSlots).fill(null);

                        // Get student data from source if available
                        let studentData = null;
                        if (sourceDeskIdx && sourceStudentPos) {
                            const srcIdx = parseInt(sourceDeskIdx);
                            const srcPos = parseInt(sourceStudentPos);
                            if (currentChart.layout[srcIdx]) {
                                const srcDesk = currentChart.layout[srcIdx];
                                studentData = srcDesk?.students?.[srcPos];
                            }
                        }

                        const newStudent = studentData
                            ? { ...studentData, position: pos }
                            : { name: name, note: '', locked: false, position: pos };
                        desk.students[pos] = newStudent;
                        const firstStudent = desk.students.find(s => s);
                        if (firstStudent) desk.student = firstStudent;
                        if (sourceDeskIdx !== '' && sourceStudentPos !== '') {
                            const srcIdx = parseInt(sourceDeskIdx);
                            const srcPos = parseInt(sourceStudentPos);
                            if (currentChart.layout[srcIdx] && !(srcIdx === idx && srcPos === pos)) {
                                const srcDesk = currentChart.layout[srcIdx];
                                if (srcDesk.students?.[srcPos]) {
                                    // For single desks, clear the array; for multi-student desks, set to null
                                    if (srcDesk.type === 'single') {
                                        srcDesk.students = [null];
                                        srcDesk.student = null;
                                    } else {
                                        srcDesk.students[srcPos] = null;
                                        const firstStudent = srcDesk.students.find(s => s);
                                        srcDesk.student = firstStudent || null;
                                    }
                                }
                            }
                        }
                        renderSeating();
                    };
                    // Ingen kontekstmeny på tomme slots
                }
                nameContainer.appendChild(slotDiv);
            }
            d.appendChild(nameContainer);

            // Auto-scale font size based on student count and name lengths
            applyAutoScaling(d, students, deskType);
        } else if (students.length > 0) {
            // Vanlige bord (single med flere – uvanlig, men fallback)
            const nameContainer = document.createElement('div');
            nameContainer.className = 'student-names-list';
            students.forEach((student, pos) => {
                if (!student) return;
                const nameDiv = document.createElement('div');
                nameDiv.className = 'student-name-item';
                const studentName = student.name || student;
                const isLocked = !!student.locked;
                nameDiv.textContent = studentName;
                nameDiv.title = studentName; // Tooltip for full name
                nameDiv.draggable = !isLocked;
                nameDiv.style.cursor = isLocked ? 'default' : 'grab';
                nameDiv.style.pointerEvents = isGroupMode ? 'none' : 'auto';
                nameDiv.onmousedown = (e) => {
                    if (isGroupMode) return; // La klikk gå til desk
                    e.stopPropagation();
                };
                nameDiv.ondragstart = (e) => {
                    if (isLocked) {
                        e.preventDefault();
                        showToast('Eleven er låst og kan ikke flyttes');
                        return;
                    }
                    e.stopPropagation();
                    d.classList.add('drag-source');
                    nameDiv.style.opacity = '0.5';
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData("text/plain", studentName);
                    e.dataTransfer.setData("source-desk-idx", idx.toString());
                    e.dataTransfer.setData("source-student-pos", pos.toString());
                };
                nameDiv.ondragend = () => { d.classList.remove('drag-source'); nameDiv.style.opacity = '1'; };
                nameDiv.ondragover = (e) => { e.preventDefault(); nameDiv.style.background = 'rgba(14, 165, 233, 0.3)'; };
                nameDiv.ondragleave = () => { nameDiv.style.background = ''; };
                nameDiv.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); nameDiv.style.background = ''; handleStudentSwap(e, idx, pos); };
                nameDiv.oncontextmenu = showSeatingContextMenu;
                if (student.note) {
                    const noteIcon = document.createElement('i');
                    noteIcon.className = 'fas fa-sticky-note';
                    noteIcon.style.marginLeft = '3px';
                    noteIcon.style.fontSize = '0.5rem';
                    noteIcon.style.color = '#fcd34d';
                    noteIcon.style.pointerEvents = 'none';
                    nameDiv.appendChild(noteIcon);
                }
                if (isLocked) {
                    const lockIcon = document.createElement('i');
                    lockIcon.className = 'fas fa-lock';
                    lockIcon.style.marginLeft = '3px';
                    lockIcon.style.fontSize = '0.5rem';
                    lockIcon.style.color = '#fbbf24';
                    lockIcon.style.pointerEvents = 'none';
                    nameDiv.appendChild(lockIcon);
                }
                nameContainer.appendChild(nameDiv);
            });
            d.appendChild(nameContainer);
        }

        // ENABLE DROP ON DESK
        d.ondragenter = (e) => {
            e.preventDefault();
        };
        d.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        };
        d.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const name = e.dataTransfer.getData("text/plain");
            const sourceDeskIdx = e.dataTransfer.getData("source-desk-idx");
            const sourceStudentPos = e.dataTransfer.getData("source-student-pos");

            if (name) {
                // Check if desk has capacity
                const capacity = desk.capacity || 1;
                const currentStudents = (desk.students || []).filter(s => s);


                if (currentStudents.length < capacity) {

                    // Get student data from source desk if available
                    let studentData = null;
                    if (sourceDeskIdx && sourceStudentPos) {
                        const srcIdx = parseInt(sourceDeskIdx);
                        const srcPos = parseInt(sourceStudentPos);
                        if (currentChart.layout[srcIdx]) {
                            const sourceDesk = currentChart.layout[srcIdx];
                            if (sourceDesk.students && sourceDesk.students[srcPos]) {
                                studentData = sourceDesk.students[srcPos]; // Preserve student object
                                // We will clear the source slot momentarily, but we must protect against self-overwrites below.
                            }
                        }
                    }

                    // Initialize students array with correct capacity
                    // CRITICAL: Only reset array if it's empty or missing - NEVER overwrite existing students
                    if (!desk.students) {
                        desk.students = Array(capacity).fill(null);
                    } else if (desk.students.length !== capacity) {
                        // Array length mismatch - resize WITHOUT losing existing students
                        const existingStudents = desk.students.filter(s => s);
                        desk.students = Array(capacity).fill(null);
                        // Restore existing students to their positions
                        existingStudents.forEach((student, i) => {
                            if (i < capacity && student.position !== undefined && student.position < capacity) {
                                desk.students[student.position] = student;
                            } else if (i < capacity) {
                                desk.students[i] = student;
                            }
                        });
                    }

                    // Find first available slot
                    const firstEmptySlot = desk.students.findIndex(s => !s);
                    if (firstEmptySlot !== -1) {
                        const newStudent = studentData
                            ? { ...studentData, position: firstEmptySlot }
                            : { name: name, note: '', locked: false, position: firstEmptySlot };
                        desk.students[firstEmptySlot] = newStudent;

                        if (sourceDeskIdx && sourceStudentPos) {
                            const srcIdx = parseInt(sourceDeskIdx);
                            const srcPos = parseInt(sourceStudentPos);
                            if (currentChart.layout[srcIdx] && !(srcIdx === idx && srcPos === firstEmptySlot)) {
                                const sourceDesk = currentChart.layout[srcIdx];
                                if (sourceDesk.type === 'single') {
                                    sourceDesk.students = [null];
                                    sourceDesk.student = null;
                                } else {
                                    sourceDesk.students[srcPos] = null;
                                    const firstStudent = sourceDesk.students.find(s => s);
                                    sourceDesk.student = firstStudent || null;
                                }
                            }
                        }

                        // Update backwards compat field
                        const firstStudent = desk.students.find(s => s);
                        desk.student = firstStudent || null;
                    }

                    renderSeating();
                } else {
                    // SWAP CASE: Desk is full, swap students

                    if (sourceDeskIdx && sourceStudentPos) {
                        const srcIdx = parseInt(sourceDeskIdx);
                        const srcPos = parseInt(sourceStudentPos);

                        // Don't swap if dragging within same desk
                        if (srcIdx === idx) {

                            return;
                        }

                        if (currentChart.layout[srcIdx]) {
                            const sourceDesk = currentChart.layout[srcIdx];

                            // Get the student being dragged
                            const draggedStudent = sourceDesk.students && sourceDesk.students[srcPos];
                            if (!draggedStudent) return;
                            if (draggedStudent.locked) return;

                            // Find the last occupied slot in target desk
                            let lastOccupiedIdx = -1;
                            for (let i = desk.students.length - 1; i >= 0; i--) {
                                if (desk.students[i]) {
                                    lastOccupiedIdx = i;
                                    break;
                                }
                            }

                            if (lastOccupiedIdx === -1) return; // No student to swap

                            const replacedStudent = desk.students[lastOccupiedIdx];
                            if (replacedStudent?.locked) {
                                showToast('Kan ikke bytte med låst elev');
                                return;
                            }



                            // Remove dragged student from source (set to null, not splice)
                            if (sourceDesk.type === 'single') {
                                sourceDesk.students = [null];
                            } else {
                                sourceDesk.students[srcPos] = null;
                            }

                            // Place dragged student in target slot
                            desk.students[lastOccupiedIdx] = { ...draggedStudent, position: lastOccupiedIdx };

                            // Find first empty slot in source desk for replaced student
                            const srcCapacity = sourceDesk.capacity || 1;
                            if (!sourceDesk.students || sourceDesk.students.length !== srcCapacity) {
                                sourceDesk.students = Array(srcCapacity).fill(null);
                            }
                            const firstEmptyInSource = sourceDesk.students.findIndex(s => !s);
                            if (firstEmptyInSource !== -1) {
                                sourceDesk.students[firstEmptyInSource] = { ...replacedStudent, position: firstEmptyInSource };
                            }

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
        };

        d.oncontextmenu = (e) => {
            // Kun vis meny hvis det ikke er et spesifikt student-element
            if (!e.target.closest('.student-name-item') && !e.target.closest('.bench-slot')) {
                showSeatingContextMenu(e);
            }
        };


        if (deskType === 'bench2' || deskType === 'bench4' || deskType === 'round3' || deskType === 'round4' || deskType === 'round6') {
            // Dynamically fetch names when hovering instead of caching at render time
            d.addEventListener('mouseenter', () => {
                const currentDesk = currentChart.layout[idx];
                const currentStudents = currentDesk.students || [];
                const names = currentStudents.filter(s => s).map(s => s.name || s);
                if (names.length > 0) {
                    showBenchTooltip(d, names);
                }
            });
            d.addEventListener('mouseleave', hideBenchTooltip);
        }
        c.appendChild(d);
    });

    // UPDATE DOCK WHEN RENDERED
    updateUnplacedDock();

    // Ensure canvas expands to fit layout and shows background grid correctly
    c.style.height = Math.max(500, currentChart.roomHeight || 500) + 'px';
}

async function generateSeating(keepLocked = true) {
    const cls = await ipcRenderer.invoke('get-class', currentChart.classId);
    let allNames = cls.students.split('\n').filter(s => s.trim());

    // Build a map of existing student data (notes, locked status)
    const studentDataMap = new Map();
    currentChart.layout.forEach(desk => {
        if (desk.students) {
            desk.students.forEach(s => {
                if (s && s.name) {
                    studentDataMap.set(s.name, { note: s.note || '', locked: !!s.locked });
                }
            });
        } else if (desk.student && desk.student.name) {
            studentDataMap.set(desk.student.name, { note: desk.student.note || '', locked: !!desk.student.locked });
        }
    });

    const lockedStudents = [];
    if (keepLocked) {
        currentChart.layout.forEach(desk => {
            if (desk.students) {
                desk.students.forEach(s => {
                    if (s && s.locked) lockedStudents.push(s.name);
                });
            } else if (desk.student && desk.student.locked) {
                lockedStudents.push(desk.student.name);
            }
        });
    }

    let availableStudents = allNames.filter(name => !lockedStudents.includes(name));
    availableStudents.sort(() => Math.random() - 0.5);

    let studentIndex = 0;
    currentChart.layout.forEach(desk => {
        const spec = DESK_TYPES[desk.type || 'single'];
        const capacity = desk.capacity || spec?.capacity || 1;
        const oldStudents = desk.students ? [...desk.students] : [];

        desk.students = Array(capacity).fill(null);
        for (let pos = 0; pos < capacity; pos++) {
            const oldStudent = oldStudents[pos];
            if (oldStudent && oldStudent.locked) {
                desk.students[pos] = oldStudent;
            } else if (studentIndex < availableStudents.length) {
                const studentName = availableStudents[studentIndex++];
                const existingData = studentDataMap.get(studentName);
                desk.students[pos] = {
                    name: studentName,
                    note: existingData?.note || '',
                    locked: existingData?.locked || false,
                    position: pos
                };
            }
        }

        const first = desk.students.find(s => s !== null);
        desk.student = first || null;
        // DON'T reset color on shuffle - keep existing colors
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

    // Get room design mode and defaultFlipped
    let designMode = 'board-top';
    if (c.room_id) {
        const room = await ipcRenderer.invoke('get-room', c.room_id);
        if (room) {
            const roomLayout = ensureRoomLayoutFormat(JSON.parse(room.layout_data || '{}'));
            designMode = roomLayout.designMode || 'board-top';
        }
    }
    const isFlipped = await ipcRenderer.invoke('get-setting', 'defaultFlipped');

    const container = document.getElementById('displayCanvas');
    container.innerHTML = '<div class="front-board">TAVLE</div>';

    const board = container.querySelector('.front-board');

    // Use coordinate transform for board-top + tavle nederst (no CSS flip, no empty space)
    const rawLayout = JSON.parse(c.placements);
    const layoutToRender = getRenderedLayoutForDisplay(rawLayout, designMode, isFlipped);

    if (designMode === 'board-bottom' || (designMode === 'board-top' && isFlipped)) {
        if (board) {
            board.classList.add('bottom');
            board.style.top = 'auto';
            board.style.bottom = '10px';
        }
        container.classList.remove('flipped');
    } else {
        applyDefaultFlip('displayCanvas');
    }

    // OPPDATER CURRENTCHART SLIK AT ZOOM FUNGERER FOR DENNE VISNINGEN OGSÅ
    currentChart.layout = rawLayout;

    // Use DESK_TYPES for consistent sizing
    const DESK_SPECS = {
        single: { w: DESK_TYPES.single.width, h: DESK_TYPES.single.height },
        round3: { w: DESK_TYPES.round3.width, h: DESK_TYPES.round3.height },
        round4: { w: DESK_TYPES.round4.width, h: DESK_TYPES.round4.height },
        round6: { w: DESK_TYPES.round6.width, h: DESK_TYPES.round6.height },
        bench2: { w: DESK_TYPES.bench2.width, h: DESK_TYPES.bench2.height },
        bench4: { w: DESK_TYPES.bench4.width, h: DESK_TYPES.bench4.height }
    };
    layoutToRender.forEach((spot, idx) => {
        const d = document.createElement('div');
        let colorClass = spot.color || 'bg-default';
        const deskType = spot.type || 'single';
        const spec = DESK_SPECS[deskType] || DESK_SPECS.single;

        d.className = `desk type-${deskType} ${colorClass}`;
        d.style.left = spot.x + 'px'; d.style.top = spot.y + 'px';
        d.style.width = spec.w + 'px'; d.style.height = spec.h + 'px';

        d.innerHTML += `<span class="desk-number">${idx + 1}</span>`;

        if (spot.groupId) {
            d.style.borderWidth = "3px";
            d.style.borderColor = GROUP_COLORS[(spot.groupId - 1) % GROUP_COLORS.length];
        }

        const students = spot.students || (spot.student ? [spot.student] : []);
        const capacity = spot.capacity || spec.capacity || 1;

        // Single desk rendering
        if (deskType === 'single' && students[0]) {
            const studentData = students[0];
            const nameSpan = document.createElement('span');
            nameSpan.textContent = studentData.name || studentData;
            nameSpan.style.fontWeight = '600';
            d.appendChild(nameSpan);
        }
        // Multi-student desk rendering (bench/round)
        else if (deskType === 'bench2' || deskType === 'bench4' || deskType === 'round3' || deskType === 'round4' || deskType === 'round6') {
            const nameContainer = document.createElement('div');
            nameContainer.className = 'student-names-list';

            for (let pos = 0; pos < capacity; pos++) {
                const slotDiv = document.createElement('div');
                slotDiv.className = 'bench-slot';
                const student = students[pos];

                if (student) {
                    const studentName = student.name || student;
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'student-name-item';

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'student-name-text';
                    nameSpan.textContent = studentName;
                    nameDiv.appendChild(nameSpan);

                    slotDiv.appendChild(nameDiv);
                } else {
                    slotDiv.classList.add('bench-slot-empty');
                    slotDiv.innerHTML = '<span class="bench-slot-hint">+</span>';
                }
                nameContainer.appendChild(slotDiv);
            }
            d.appendChild(nameContainer);

            // Apply autoscaling for round tables
            if (deskType.startsWith('round')) {
                applyAutoScaling(d, students, deskType);
            }
        }

        container.appendChild(d);
    });

    navTo('view-chart-display');
}
function flipView() {
    document.getElementById('displayCanvas').classList.toggle('flipped');
    // No need to adjust canvas here since displayCanvas is read-only view
}
function editStudentNote() {
    if (selectedSeatingDeskIdx === null) return;

    const placement = currentChart.layout[selectedSeatingDeskIdx];
    let student = null;
    if (selectedStudentPos !== null && placement?.students?.[selectedStudentPos]) {
        student = placement.students[selectedStudentPos];
    } else if (placement?.students) {
        student = placement.students.find(s => s);
    } else if (placement?.student) {
        student = placement.student;
    }
    if (!placement || !student) return showToast("Ingen elev her");

    document.getElementById('noteStudentName').textContent = student.name || student;
    document.getElementById('noteTextarea').value = student.note || '';
    document.getElementById('studentNoteModal').style.display = 'flex';

    setTimeout(() => document.getElementById('noteTextarea').focus(), 100);
}

function saveStudentNote() {
    if (selectedSeatingDeskIdx === null) return;

    const placement = currentChart.layout[selectedSeatingDeskIdx];
    const student = selectedStudentPos !== null && placement?.students?.[selectedStudentPos]
        ? placement.students[selectedStudentPos]
        : placement?.students?.[0] || placement?.student;
    if (!student) return;

    const note = document.getElementById('noteTextarea').value.trim();
    if (selectedStudentPos !== null && placement.students?.[selectedStudentPos]) {
        placement.students[selectedStudentPos].note = note;
    } else if (placement.students?.length) {
        const firstStudent = placement.students.find(s => s);
        if (firstStudent) firstStudent.note = note;
    } else if (placement.student) {
        placement.student.note = note;
    }
    renderSeating();
    closeStudentNoteModal();
    showToast('Notat lagret');
}

function toggleStudentLock() {
    if (selectedSeatingDeskIdx === null) return;
    const desk = currentChart.layout[selectedSeatingDeskIdx];

    // Finn eleven som skal låses
    let student = null;
    if (selectedStudentPos !== null && desk?.students?.[selectedStudentPos]) {
        student = desk.students[selectedStudentPos];
    } else if (desk?.students) {
        student = desk.students.find(s => s);
    } else if (desk?.student) {
        student = desk.student;
    }

    if (!student) return;

    student.locked = !student.locked;
    renderSeating();
    document.getElementById('seatingContextMenu').style.display = 'none';
    showToast(student.locked ? 'Plassering låst' : 'Plassering låst opp');
}

function closeStudentNoteModal() {
    document.getElementById('studentNoteModal').style.display = 'none';
    document.getElementById('seatingContextMenu').style.display = 'none';
}
function setDeskColor(c) {
    currentChart.layout[selectedSeatingDeskIdx].color = c; renderSeating(); document.getElementById('seatingContextMenu').style.display = 'none';
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.ctx-item')) {
        document.getElementById('deskContextMenu').style.display = 'none';
        document.getElementById('seatingContextMenu').style.display = 'none';
    }

    // Close dropdown when clicking outside
    if (!e.target.closest('.btn-group') && activeDropdown) {
        activeDropdown.classList.remove('show');
        activeDropdown = null;
    }
});


// =========================================================
// ONBOARDING WIZARD (extracted to modules/onboarding.js)
// =========================================================
onboarding.init({
    showToast,
    navTo,
    loadNormalToolbar,
    getWeekNumber,
    generateSeating,
    renderSeating,
    setCurrentChart: (chart) => { currentChart = chart; }
});

// Expose onboarding functions to window scope for HTML onclick handlers

// =========================================================
// AUTO UPDATER LOGIC
// =========================================================
ipcRenderer.on('update-downloaded-ready', (event, info) => {
    console.log('Update downloaded:', info);
    const notification = document.getElementById('updateNotification');
    if (notification) {
        notification.style.display = 'flex';
        // Small delay to allow display flex to apply before transitioning opacity/transform
        setTimeout(() => notification.classList.add('show'), 50);
    }
});

window.restartAppForUpdate = function () {
    ipcRenderer.send('restart-app');
};
window.startOnboardingWizard = onboarding.startOnboardingWizard;
window.wizardNext = onboarding.wizardNext;
window.wizardPrev = onboarding.wizardPrev;
window.wizardSkip = onboarding.wizardSkip;
window.selectTemplate = onboarding.selectTemplate;
window.closeWizard = onboarding.closeWizard;

// Also keep as global functions for internal use
const startOnboardingWizard = onboarding.startOnboardingWizard;

// STARTUP CALL
navTo('view-charts-dashboard');