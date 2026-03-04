// =========================================================
// COORDINATE TRANSFORMATION MODULE
// =========================================================
const { DESK_W, DESK_H, CANVAS_W, ROOM_EDITOR_CANVAS_H, DESK_TYPES } = require('./state');

// Get desk dimensions by type (for 180° flip transform)
function getDeskHeight(type) {
    const spec = DESK_TYPES[type];
    return spec ? spec.height : DESK_H;
}

function getDeskWidth(type) {
    const spec = DESK_TYPES[type];
    return spec ? spec.width : DESK_W;
}

// Full 180° room flip: mirror X, mirror Y, rotate every desk 180° so orientations stay correct.
// Transform is self-inverse (flip twice = identity), so same formula for board-top <-> board-bottom.
function transformCoordinatesForMode(desks, fromMode, toMode, roomHeight = ROOM_EDITOR_CANVAS_H) {
    if (fromMode === toMode) return desks;

    const H = roomHeight;
    const W = CANVAS_W;
    return desks.map(desk => {
        const type = desk.type || 'single';
        const w = getDeskWidth(type);
        const h = getDeskHeight(type);
        return {
            ...desk,
            x: W - desk.x - w,
            y: H - desk.y - h,
            rotation: (parseInt(desk.rotation || 0, 10) + 180) % 360
        };
    });
}

// Get layout with coordinate transform applied when board-top + defaultFlipped
function getRenderedLayoutForDisplay(layout, roomDesignMode, isFlipped, roomHeight = ROOM_EDITOR_CANVAS_H) {
    if (roomDesignMode === 'board-bottom') return layout;
    if (roomDesignMode === 'board-top' && isFlipped) {
        return transformCoordinatesForMode(layout, 'board-top', 'board-bottom', roomHeight);
    }
    return layout;
}

// Convert room layout from old array format to new object format
function ensureRoomLayoutFormat(layout) {
    // If already in new format
    if (layout && layout.desks && layout.designMode !== undefined) {
        return {
            ...layout,
            roomHeight: layout.roomHeight || ROOM_EDITOR_CANVAS_H
        };
    }

    // If old format (array), convert to new format
    if (Array.isArray(layout)) {
        return {
            desks: layout,
            designMode: 'board-top',
            roomHeight: ROOM_EDITOR_CANVAS_H
        };
    }

    // Default empty layout
    return {
        desks: [],
        designMode: 'board-top',
        roomHeight: ROOM_EDITOR_CANVAS_H
    };
}

module.exports = {
    getDeskHeight,
    getDeskWidth,
    transformCoordinatesForMode,
    getRenderedLayoutForDisplay,
    ensureRoomLayoutFormat
};
