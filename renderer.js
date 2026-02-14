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
    single: { width: 85, height: 55, capacity: 1, name: 'Enkeltpult' },
    round3: { width: 130, height: 130, capacity: 3, name: 'Rundbord (3)' },
    round4: { width: 145, height: 145, capacity: 4, name: 'Rundbord (4)' },
    round6: { width: 160, height: 160, capacity: 6, name: 'Rundbord (6)' },
    bench2: { width: 170, height: 55, capacity: 2, name: 'Langbord (2)' },
    bench4: { width: 340, height: 55, capacity: 4, name: 'Langbord (4)' }
};


// --- APP STATE ---
let editingId = null;
let currentChart = { id: null, classId: null, roomId: null, layout: [], allStudents: [] };
let modalCallback = null;
let deleteCallback = null;
let confirmCallback = null;
let rightClickedDesk = null;
let selectedSeatingDeskIdx = null;
let selectedStudentPos = null;

// Group Mode State
let isGroupMode = false;
let selectedDesksForGroup = [];
let groupCounter = 0;

// Dropdown State
let activeDropdown = null;

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
    if (canvas) {
        if (isFlipped) {
            canvas.classList.add('flipped');
            // Adjust canvas height for flipped view
            if (canvasId === 'seatingCanvas') {
                setTimeout(() => adjustCanvasForFlipSeating(), 100);
            }
        } else {
            canvas.classList.remove('flipped');
        }
    }
}

// Toggle design mode for room editor
function toggleDesignMode() {
    const isChecked = document.getElementById('designModeToggle').checked;
    const canvas = document.getElementById('roomCanvas');
    const board = canvas.querySelector('.front-board');
    
    if (isChecked) {
        // Board-bottom mode: Move board to bottom
        if (board) {
            board.style.top = 'auto';
            board.style.bottom = '10px';
        }
    } else {
        // Board-top mode: Reset board to top
        if (board) {
            board.style.top = '10px';
            board.style.bottom = 'auto';
        }
    }
}

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
    if (currentChart.roomId) {
        const room = await ipcRenderer.invoke('get-room', currentChart.roomId);
        if (room) {
            const roomLayout = ensureRoomLayoutFormat(JSON.parse(room.layout_data || '{}'));
            designMode = roomLayout.designMode || 'board-top';
        }
    }
    
    const dataToSend = { 
        layout: currentChart.layout, 
        defaultFlipped: isFlipped,
        designMode: designMode  // Pass design mode to presentation window
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
    selectedDesks = [];
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
    
    // Set design mode toggle
    const designModeToggle = document.getElementById('designModeToggle');
    if (designModeToggle) {
        designModeToggle.checked = (layoutData.designMode === 'board-bottom');
    }
    
    renderRoomCanvas(layoutData.desks);
    
    // Apply design mode visually
    toggleDesignMode();
    
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
    selectedDesks = [];
    attachRoomEditorKeyboardListeners();
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
        const rect = d.getBoundingClientRect();
        const containerRect = canvas.getBoundingClientRect();
        const y = rect.top - containerRect.top + canvas.scrollTop;
        const h = rect.height;
        if (y + h > maxY) maxY = y + h;
    });
    
    // Calculate needed offset for flipped view
    const baseHeight = canvas.scrollHeight || 500;
    const buffer = 200;
    const flipOffset = Math.max(0, maxY - baseHeight + buffer);
    
    canvas.style.setProperty('--flip-offset', flipOffset + 'px');
}

// =========================================================
// COORDINATE TRANSFORMATION FOR DESIGN MODE
// =========================================================

// Get desk height based on type
function getDeskHeight(type) {
    const spec = DESK_TYPES[type];
    return spec ? spec.height : DESK_H;
}

// Transform coordinates between board-top and board-bottom modes
function transformCoordinatesForMode(desks, fromMode, toMode) {
    if (fromMode === toMode) return desks;
    
    const CANVAS_H = 500;
    return desks.map(desk => ({
        ...desk,
        y: CANVAS_H - desk.y - getDeskHeight(desk.type || 'single')
    }));
}

// Convert room layout from old array format to new object format
function ensureRoomLayoutFormat(layout) {
    // If already in new format
    if (layout && layout.desks && layout.designMode !== undefined) {
        return layout;
    }
    
    // If old format (array), convert to new format
    if (Array.isArray(layout)) {
        return {
            desks: layout,
            designMode: 'board-top'
        };
    }
    
    // Default empty layout
    return {
        desks: [],
        designMode: 'board-top'
    };
}

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

    const groups = preset.split(',').map(Number);
    const gap = 10; // Gap between desks in same group
    const aisle = 40; // Gap between groups
    const rowGap = 30; // Gap between rows

    const totalCols = groups.reduce((a, b) => a + b, 0);
    const totalAisles = Math.max(0, groups.length - 1);
    let rowWidth = (totalCols * spec.width) + ((totalCols - 1) * gap) + (totalAisles * aisle);

    // Start 70px from top
    let startY = 70;

    for (let r = 0; r < rows; r++) {
        let startX = (CANVAS_W - rowWidth) / 2;
        if (startX < 20) startX = 20;

        let currentX = startX;
        groups.forEach((gSize, gIdx) => {
            for (let i = 0; i < gSize; i++) {
                spawnDesk(currentX, startY, canvas, selectedType);
                currentX += spec.width + gap;
            }
            if (gIdx < groups.length - 1) currentX += aisle;
        });
        startY += spec.height + rowGap;
    }
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

    // Check if canvas is flipped - adjust vertical centering accordingly
    const canvas = document.getElementById('roomCanvas');
    const isFlipped = canvas && canvas.classList.contains('flipped');
    const CANVAS_H = 500;
    const targetCenterY = isFlipped ? (CANVAS_H - 100) : (CANVAS_H / 2 + 15);
    const currentCenterY = minY + (contentHeight / 2);
    const diffY = targetCenterY - currentCenterY;

    desks.forEach(d => {
        const currentX = parseInt(d.style.left);
        const currentY = parseInt(d.style.top);
        d.style.left = (currentX + diffX) + 'px';
        d.style.top = Math.max(60, currentY + diffY) + 'px';
    });
    
    // Adjust canvas height if flipped
    if (isFlipped) {
        adjustCanvasForFlip();
    }
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

function deleteSelectedDesks() {
    if (selectedDesks.length === 0) return;
    
    const count = selectedDesks.length;
    selectedDesks.forEach(desk => desk.remove());
    selectedDesks = [];
    
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
    
    // Check if canvas is flipped - start from bottom instead of top
    const canvas = document.getElementById('roomCanvas');
    const isFlipped = canvas && canvas.classList.contains('flipped');
    const CANVAS_H = 500;
    const startY = isFlipped ? (CANVAS_H - 200) : 60;
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
    updateDeskNumbers();
    showToast(`✓ ${DESK_TYPES[type].name} lagt til`);
}

// Legacy function for compatibility
function addDesk() {
    addDeskOfType('single');
}

function clearCanvas() { document.getElementById('roomCanvas').innerHTML = '<div class="front-board">TAVLE</div>'; }

async function saveRoom() {
    const name = document.getElementById('roomNameInput').value;
    const desks = [];

    document.querySelectorAll('#roomCanvas .desk').forEach(d => {
        const type = d.dataset.type || 'single';
        const spec = DESK_TYPES[type];

        desks.push({
            x: parseInt(d.style.left),
            y: parseInt(d.style.top),
            rotation: parseInt(d.dataset.rotation || 0),
            type: type,
            capacity: spec.capacity
        });
    });

    // Get design mode from toggle
    const designModeToggle = document.getElementById('designModeToggle');
    const designMode = designModeToggle && designModeToggle.checked ? 'board-bottom' : 'board-top';

    // Create layout object with new structure
    const layout = {
        desks: desks,
        designMode: designMode
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
            const layout = JSON.parse(r.layout_data || '[]');
            totalCapacity = layout.reduce((sum, desk) => {
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

    const rawLayout = JSON.parse(room.layout_data || '[]');
    if (!Array.isArray(rawLayout) || rawLayout.length === 0) return showToast("Rommet har ingen bord – legg til bord i Mine rom først");

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
    loadNormalToolbar();
}

async function editChart(id) {
    const charts = await ipcRenderer.invoke('get-seatings'); const c = charts.find(x => x.id == id);

    // FETCH FULL STUDENT LIST AGAIN TO DETECT NEW STUDENTS
    const cls = await ipcRenderer.invoke('get-class', c.class_id);
    const studentList = cls.students.split('\n').filter(s => s.trim());

    // Fetch room data to check designMode
    let roomDesignMode = 'board-top';
    if (c.room_id) {
        const room = await ipcRenderer.invoke('get-room', c.room_id);
        if (room) {
            const roomLayout = ensureRoomLayoutFormat(JSON.parse(room.layout_data || '{}'));
            roomDesignMode = roomLayout.designMode || 'board-top';
        }
    }

    currentChart = {
        id: c.id, 
        classId: c.class_id, 
        roomId: c.room_id, 
        layout: JSON.parse(c.placements),
        allStudents: studentList,
        roomDesignMode: roomDesignMode  // Store for rendering
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

            const newLayoutBase = JSON.parse(room.layout_data || '[]');

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
            <button class="btn-action btn-secondary" onclick="resetGroups()">
                <i class="fas fa-eraser"></i> Nullstill
            </button>
            <button class="btn-action btn-primary" onclick="confirmGrouping()">
                <i class="fas fa-check"></i> Ferdig
            </button>
            <button class="btn-action btn-secondary" onclick="cancelGroupMode()">
                <i class="fas fa-times"></i> Avbryt
            </button>
        `;
        document.getElementById('btnConfirmGroup').style.display = 'block';
        selectedDesksForGroup = [];
        showToast("Klikk på bord + ENTER for å lage en gruppe");
        window.addEventListener('keydown', handleGroupEnter);
    } else {
        cancelGroupMode();
    }
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
    loadNormalToolbar();
    renderSeating();
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
            <button class="btn-action btn-secondary dropdown-toggle" onclick="toggleDropdown('toolsDropdown')">
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
        <button class="btn-action btn-accent btn-lg" onclick="generateSeating()">
            <i class="fas fa-random"></i> Shuffle
        </button>
        <button class="btn-action btn-primary" onclick="saveChart()">
            <i class="fas fa-save"></i> Lagre
        </button>
        <button class="btn-action btn-secondary" onclick="navTo('view-charts-dashboard')">
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
    
    openModal("Legg til bord", "", () => {});
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
    
    deskEl.onmousedown = function(e) {
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
            
            currentChart.layout[idx].x = Math.round(newX);
            currentChart.layout[idx].y = Math.round(newY);
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
        console.log('⚠️ Cannot swap student with itself');
        return;
    }

    const sourceDesk = currentChart.layout[srcIdx];
    const targetDesk = currentChart.layout[targetDeskIdx];

    if (!sourceDesk || !targetDesk) return;

    const draggedStudent = sourceDesk.students && sourceDesk.students[srcPos];
    const targetStudent = targetDesk.students && targetDesk.students[targetStudentPos];

    if (!draggedStudent || !targetStudent) return;
    if (draggedStudent.locked || targetStudent.locked) {
        showToast('Kan ikke bytte med låst elev');
        return;
    }

    console.log('🔄 Swapping:', draggedStudent.name, '↔', targetStudent.name);

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

    // Check if room is designed with board-bottom mode
    const roomDesignMode = currentChart.roomDesignMode || 'board-top';
    const board = c.querySelector('.front-board');
    
    if (roomDesignMode === 'board-bottom') {
        // Native board-bottom mode: Place board at bottom
        if (board) {
            board.style.top = 'auto';
            board.style.bottom = '10px';
        }
        // Don't use CSS flip transform for native board-bottom rooms
    } else {
        // Legacy board-top mode: Use defaultFlipped setting with CSS transform
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
            d.appendChild(nameSpan);

            if (studentData.note) {
                d.innerHTML += `<i class="fas fa-sticky-note note-icon"></i>`;
            }
            if (isLocked) {
                d.innerHTML += `<i class="fas fa-lock lock-icon" style="top:2px; right:3px; left:auto;"></i>`;
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
                    d.classList.add('drag-source');
                    nameSpan.style.opacity = '0.5';
                    e.dataTransfer.setData('text/plain', studentName);
                    e.dataTransfer.setData('source-desk-idx', idx.toString());
                    e.dataTransfer.setData('source-student-pos', '0');
                };
                d.ondragend = () => { d.classList.remove('drag-source'); nameSpan.style.opacity = '1'; };
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
                            d.classList.add('drag-source');
                            nameDiv.style.opacity = '0.5';
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData("text/plain", studentName);
                            e.dataTransfer.setData("source-desk-idx", idx.toString());
                            e.dataTransfer.setData("source-student-pos", pos.toString());
                        };
                        nameDiv.ondragend = () => { d.classList.remove('drag-source'); nameDiv.style.opacity = '1'; };
                        nameDiv.ondragover = (e) => { e.preventDefault(); if (!isLocked) nameDiv.style.background = 'rgba(14, 165, 233, 0.3)'; };
                        nameDiv.ondragleave = () => { nameDiv.style.background = ''; };
                        nameDiv.ondrop = (e) => { e.preventDefault(); nameDiv.style.background = ''; handleStudentSwap(e, idx, pos); };
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
                                if (srcIdx !== idx && currentChart.layout[srcIdx]) {
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
                    nameDiv.ondrop = (e) => { e.preventDefault(); nameDiv.style.background = ''; handleStudentSwap(e, idx, pos); };
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
        d.ondragover = (e) => e.preventDefault();
        d.ondrop = (e) => {
            e.preventDefault();
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
                        if (srcIdx !== idx && currentChart.layout[srcIdx]) {
                            const sourceDesk = currentChart.layout[srcIdx];
                            if (sourceDesk.students && sourceDesk.students[srcPos]) {
                                studentData = sourceDesk.students[srcPos]; // Preserve student object
                                // For single desks, clear the array; for multi-student desks, set to null
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
                            console.log('⚠️ Cannot swap within same desk');
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

                            console.log('🔄 Swapping:', draggedStudent.name, '↔', replacedStudent.name);

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

    // Get room design mode
    let designMode = 'board-top';
    if (c.room_id) {
        const room = await ipcRenderer.invoke('get-room', c.room_id);
        if (room) {
            const roomLayout = ensureRoomLayoutFormat(JSON.parse(room.layout_data || '{}'));
            designMode = roomLayout.designMode || 'board-top';
        }
    }

    const container = document.getElementById('displayCanvas');
    container.innerHTML = '<div class="front-board">TAVLE</div>';

    const board = container.querySelector('.front-board');
    
    // Check if room is designed with board-bottom mode
    if (designMode === 'board-bottom') {
        // Native board-bottom mode: Place board at bottom
        if (board) {
            board.classList.add('bottom');
            board.style.top = 'auto';
            board.style.bottom = '10px';
        }
        // Don't use CSS flip for native board-bottom rooms
    } else {
        // Legacy board-top mode: Use defaultFlipped setting
        applyDefaultFlip('displayCanvas');
    }

    // OPPDATER CURRENTCHART SLIK AT ZOOM FUNGERER FOR DENNE VISNINGEN OGSÅ
    currentChart.layout = JSON.parse(c.placements);

    // Use DESK_TYPES for consistent sizing
    const DESK_SPECS = {
        single: { w: DESK_TYPES.single.width, h: DESK_TYPES.single.height },
        round3: { w: DESK_TYPES.round3.width, h: DESK_TYPES.round3.height },
        round4: { w: DESK_TYPES.round4.width, h: DESK_TYPES.round4.height },
        round6: { w: DESK_TYPES.round6.width, h: DESK_TYPES.round6.height },
        bench2: { w: DESK_TYPES.bench2.width, h: DESK_TYPES.bench2.height },
        bench4: { w: DESK_TYPES.bench4.width, h: DESK_TYPES.bench4.height }
    };
    JSON.parse(c.placements).forEach((spot, idx) => {
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
            ...p,
            type: p.type || 'single',
            capacity: p.capacity ?? 1,
            students: null,
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
        await ipcRenderer.invoke('save-setting', 'onboardingCompleted', true);

        // Lukk wizard og naviger til editor
        document.getElementById('onboardingWizard').style.display = 'none';
        navTo('view-seating-editor');
        loadNormalToolbar();

        showToast('🎉 Ditt første klassekart er klart!');

    } catch (err) {
        console.error(err);
        showToast('Feil: ' + err.message);
    }
}

async function closeWizard() {
    document.getElementById('onboardingWizard').style.display = 'none';
    await ipcRenderer.invoke('save-setting', 'onboardingCompleted', true);
    navTo('view-charts-dashboard');
}

// STARTUP CALL
navTo('view-charts-dashboard');