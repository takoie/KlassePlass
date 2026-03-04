// =========================================================
// CENTRALIZED STATE MODULE
// All shared mutable state lives here so modules can safely
// read/write without circular dependencies.
// =========================================================

// --- CONSTANTS ---
const DESK_W = 85;
const DESK_H = 55;
const SNAP_THRESHOLD = 15;
const CANVAS_W = 920;
const ROOM_EDITOR_CANVAS_H = 500;

const GROUP_COLORS = [
    '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981',
    '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
    '#06b6d4', '#d946ef', '#e11d48', '#22c55e', '#64748b'
];

const DESK_TYPES = {
    single: { width: 85, height: 55, capacity: 1, name: 'Enkeltpult' },
    round3: { width: 130, height: 130, capacity: 3, name: 'Rundbord (3)' },
    round4: { width: 145, height: 145, capacity: 4, name: 'Rundbord (4)' },
    round6: { width: 160, height: 160, capacity: 6, name: 'Rundbord (6)' },
    bench2: { width: 170, height: 55, capacity: 2, name: 'Langbord (2)' },
    bench4: { width: 340, height: 55, capacity: 4, name: 'Langbord (4)' }
};

// --- MUTABLE APP STATE ---
const state = {
    // Editing
    editingId: null,
    currentChart: { id: null, classId: null, roomId: null, layout: [], allStudents: [] },

    // Modal system
    modalCallback: null,
    deleteCallback: null,
    confirmCallback: null,

    // Seating editor context menu
    rightClickedDesk: null,
    selectedSeatingDeskIdx: null,
    selectedStudentPos: null,

    // Group mode
    isGroupMode: false,
    selectedDesksForGroup: [],
    groupCounter: 0,

    // Dropdown
    activeDropdown: null,

    // Room editor
    selectedDesks: [],
    roomEditorLayoutBoardTop: [],
    roomEditorCurrentHeight: 500,

    // Room editor selection
    isSelecting: false,
    selectionStart: { x: 0, y: 0 },
    selectionBox: null
};

module.exports = {
    // Constants
    DESK_W,
    DESK_H,
    SNAP_THRESHOLD,
    CANVAS_W,
    ROOM_EDITOR_CANVAS_H,
    GROUP_COLORS,
    DESK_TYPES,

    // Mutable state
    state
};
