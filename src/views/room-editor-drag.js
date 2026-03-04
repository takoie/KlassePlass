/**
 * room-editor-drag.js — Drag-and-drop og multi-select for romdesigneren.
 * Eksporterer: makeDeskDraggable, makeDecoDraggable, initSelectionBox, snapDesk, snapDeco
 */

import { DESK_TYPES } from '../shared/constants.js';

const SNAP_T  = 15;  // Pixel threshold for edge-to-edge snap
const GRID_SZ = 10;  // Grid snap fallback

/* ---- Snapping ---- */

/**
 * Snaps x,y for a given desk against all other desks.
 * Priority: edge-to-edge alignment → fallback to 10px grid.
 */
export function snapDesk(desk, rawX, rawY, allDesks, selectedIds) {
  const info    = DESK_TYPES[desk.type] ?? DESK_TYPES.single;
  const others  = allDesks.filter(d => d.id !== desk.id && !selectedIds.has(d.id));

  let snapX = null, snapY = null;

  for (const other of others) {
    const oi = DESK_TYPES[other.type] ?? DESK_TYPES.single;

    if (snapX === null) {
      if (Math.abs(rawX - (other.x + oi.width)) < SNAP_T)        snapX = other.x + oi.width;
      else if (Math.abs(rawX + info.width - other.x) < SNAP_T)   snapX = other.x - info.width;
      else if (Math.abs(rawX - other.x) < SNAP_T)                snapX = other.x;
      else if (Math.abs(rawX + info.width - other.x - oi.width) < SNAP_T) snapX = other.x + oi.width - info.width;
    }

    if (snapY === null) {
      if (Math.abs(rawY - (other.y + oi.height)) < SNAP_T)       snapY = other.y + oi.height;
      else if (Math.abs(rawY + info.height - other.y) < SNAP_T)  snapY = other.y - info.height;
      else if (Math.abs(rawY - other.y) < SNAP_T)                snapY = other.y;
    }

    if (snapX !== null && snapY !== null) break;
  }

  return {
    x: Math.max(0, snapX ?? Math.round(rawX / GRID_SZ) * GRID_SZ),
    y: Math.max(0, snapY ?? Math.round(rawY / GRID_SZ) * GRID_SZ),
  };
}

export function snapDeco(rawX, rawY) {
  return {
    x: Math.max(0, Math.round(rawX / GRID_SZ) * GRID_SZ),
    y: Math.max(0, Math.round(rawY / GRID_SZ) * GRID_SZ),
  };
}

/* ---- Drag-and-drop (pointer events) ---- */

/**
 * @param {HTMLElement} el
 * @param {Object} desk
 * @param {{ selectedIds: Set, dragState: {current}, room: {desks} }} state
 */
export function makeDeskDraggable(el, desk, state) {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = el.parentElement.getBoundingClientRect();

    // Do NOT call render() here — it rebuilds DOM and detaches el
    if (!state.selectedIds.has(desk.id)) {
      state.selectedIds.clear();
      state.selectedIds.add(desk.id);
      document.querySelectorAll('.room-desk').forEach(d => {
        d.classList.toggle('selected', state.selectedIds.has(d.dataset.deskId));
      });
    }

    const isRotated = el.parentElement?.classList.contains('canvas-rotated');
    const offsets = {};
    state.selectedIds.forEach(id => {
      const d = state.room.desks.find(x => x.id === id);
      if (d) {
        let localX = e.clientX - rect.left;
        let localY = e.clientY - rect.top;
        if (isRotated) { localX = rect.width - localX; localY = rect.height - localY; }
        offsets[id] = { dx: localX - d.x, dy: localY - d.y };
      }
    });

    state.dragState.current = { deskId: desk.id, offsets, isDeco: false };
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* pointer already released */ }
  });

  el.addEventListener('pointermove', e => {
    const ds = state.dragState.current;
    if (!ds || ds.isDeco || ds.deskId !== desk.id) return;
    const rect = el.parentElement.getBoundingClientRect();
    const off  = ds.offsets[desk.id];
    let localX = e.clientX - rect.left;
    let localY = e.clientY - rect.top;
    if (el.parentElement?.classList.contains('canvas-rotated')) {
      localX = rect.width - localX;
      localY = rect.height - localY;
    }
    const rawX = localX - off.dx;
    const rawY = localY - off.dy;

    const { x: snappedX, y: snappedY } = snapDesk(desk, rawX, rawY, state.room.desks, state.selectedIds);
    const deltaX = snappedX - desk.x;
    const deltaY = snappedY - desk.y;

    state.selectedIds.forEach(id => {
      const d = state.room.desks.find(x => x.id === id);
      if (!d) return;
      d.x = Math.max(0, d.x + deltaX);
      d.y = Math.max(0, d.y + deltaY);
      const domEl = document.querySelector(`[data-desk-id="${id}"]`);
      if (domEl) { domEl.style.left = d.x + 'px'; domEl.style.top = d.y + 'px'; }
    });
  });

  el.addEventListener('pointerup', () => { state.dragState.current = null; });
}

export function makeDecoDraggable(el, deco, state) {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = el.parentElement.getBoundingClientRect();
    const isRotated = el.parentElement?.classList.contains('canvas-rotated');
    let localX = e.clientX - rect.left;
    let localY = e.clientY - rect.top;
    if (isRotated) { localX = rect.width - localX; localY = rect.height - localY; }
    state.dragState.current = { isDeco: true, decoId: deco.id, offsetX: localX - deco.x, offsetY: localY - deco.y };
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', e => {
    const ds = state.dragState.current;
    if (!ds || !ds.isDeco || ds.decoId !== deco.id) return;
    const rect = el.parentElement.getBoundingClientRect();
    let localX = e.clientX - rect.left;
    let localY = e.clientY - rect.top;
    if (el.parentElement?.classList.contains('canvas-rotated')) { localX = rect.width - localX; localY = rect.height - localY; }
    const { x, y } = snapDeco(localX - ds.offsetX, localY - ds.offsetY);
    deco.x = x; deco.y = y;
    el.style.left = x + 'px'; el.style.top = y + 'px';
  });

  el.addEventListener('pointerup', () => { state.dragState.current = null; });
}

/* ---- Multi-select: selection box on canvas background ---- */

export function initSelectionBox(canvas, state, renderFn) {
  canvas.addEventListener('pointerdown', e => {
    if (e.target !== canvas && e.target.id !== 'room-front-board') return;
    if (e.button !== 0) return;
    if (!e.shiftKey) state.selectedIds.clear();
    const rect = canvas.getBoundingClientRect();
    state.selBoxState = { startX: e.clientX - rect.left, startY: e.clientY - rect.top, el: null };
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    if (!state.selBoxState) return;
    const rect   = canvas.getBoundingClientRect();
    const curX   = e.clientX - rect.left;
    const curY   = e.clientY - rect.top;
    const left   = Math.min(state.selBoxState.startX, curX);
    const top    = Math.min(state.selBoxState.startY, curY);
    const width  = Math.abs(curX - state.selBoxState.startX);
    const height = Math.abs(curY - state.selBoxState.startY);

    if (!state.selBoxState.el) {
      const box = document.createElement('div');
      box.className = 'selection-box';
      canvas.appendChild(box);
      state.selBoxState.el = box;
    }
    state.selBoxState.el.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px;`;
  });

  canvas.addEventListener('pointerup', e => {
    if (!state.selBoxState) return;
    if (state.selBoxState.el) {
      const boxRect    = state.selBoxState.el.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      state.room.desks.forEach(desk => {
        const info     = DESK_TYPES[desk.type] ?? DESK_TYPES.single;
        const deskLeft = canvasRect.left + desk.x;
        const deskTop  = canvasRect.top  + desk.y;
        const deskR    = deskLeft + info.width;
        const deskB    = deskTop  + info.height;
        if (deskR > boxRect.left && deskLeft < boxRect.right && deskB > boxRect.top && deskTop < boxRect.bottom) {
          state.selectedIds.add(desk.id);
        }
      });
      state.selBoxState.el.remove();
    } else {
      renderFn();
    }
    state.selBoxState = null;
    renderFn();
  });
}
