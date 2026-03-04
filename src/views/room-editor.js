/**
 * room-editor.js — Romdesigner med snapping, multi-select og dekorasjoner.
 * Snapping: edge-to-edge mot andre pulter, fallback 10px grid.
 */

import { DESK_TYPES } from '../shared/constants.js';
import { showToast, createDesk, uid } from '../shared/utils.js';

let _room = null;  // { id, name, desks, decorations, designMode, roomHeight }
let _selectedIds = new Set();
let _dragState = null;

// Multi-select drag (selection box on canvas background)
let _selBoxState = null;

const SNAP_T  = 15;  // Pixel threshold for edge-to-edge snap
const GRID_SZ = 10;  // Grid snap fallback

const TEMPLATE = `
<div class="editor-layout">
  <div class="editor-toolbar">
    <div class="toolbar-left">
      <button class="btn btn-ghost btn-sm" id="btn-room-back"><i class="fa-solid fa-arrow-left"></i></button>
      <input type="text" id="room-name-input" class="toolbar-title-input" placeholder="Romnavn...">
    </div>
    <div class="toolbar-center">
      <div class="desk-picker" id="desk-picker">
        <button class="desk-add-btn" data-type="single" title="Enkeltpult"><span class="desk-mini single"></span></button>
        <button class="desk-add-btn" data-type="bench2" title="Benk (2)"><span class="desk-mini bench2"></span></button>
        <button class="desk-add-btn" data-type="bench4" title="Benk (4)"><span class="desk-mini bench4 w-8"></span></button>
        <button class="desk-add-btn" data-type="round3" title="Rundbord (3)"><span class="desk-mini round"></span></button>
        <button class="desk-add-btn" data-type="round4" title="Rundbord (4)"><span class="desk-mini round"></span></button>
        <button class="desk-add-btn" data-type="round6" title="Rundbord (6)"><span class="desk-mini round"></span></button>
      </div>
      <div class="toolbar-divider"></div>
      <div class="deco-picker">
        <button class="desk-add-btn" data-deco="wall" title="Vegg"><i class="fa-solid fa-minus"></i></button>
        <button class="desk-add-btn" data-deco="cabinet" title="Skap"><i class="fa-solid fa-box"></i></button>
        <button class="desk-add-btn" data-deco="window" title="Vindu"><i class="fa-regular fa-window-maximize"></i></button>
        <button class="desk-add-btn" data-deco="door" title="Dør"><i class="fa-solid fa-door-open"></i></button>
      </div>
      <div class="toolbar-divider"></div>
      <button class="btn btn-ghost btn-sm" id="btn-auto-generate">
        <i class="fa-solid fa-wand-magic-sparkles"></i> Auto
      </button>
    </div>
    <div class="toolbar-right">
      <div class="design-mode-toggle">
        <label class="toggle-label">
          <input type="radio" name="design-mode" value="board-top" id="mode-board-top" checked>
          <span>Tavle øverst</span>
        </label>
        <label class="toggle-label">
          <input type="radio" name="design-mode" value="board-bottom" id="mode-board-bottom">
          <span>Tavle nederst</span>
        </label>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-room-save">
        <i class="fa-solid fa-floppy-disk"></i> Lagre
      </button>
    </div>
  </div>
  <div class="canvas-wrapper">
    <div id="room-canvas" class="room-canvas">
      <div id="room-front-board" class="front-board board-top">TAVLE</div>
    </div>
  </div>
</div>`;

export const roomEditorView = {
  async mount(container, params = {}) {
    container.innerHTML = TEMPLATE;

    if (params.roomId) {
      await loadRoom(params.roomId);
    } else {
      initNewRoom();
    }

    bindEvents();
    render();
  },
  unmount() {
    _room = null; _selectedIds.clear(); _dragState = null; _selBoxState = null;
  },
};

/* ---- Initialisering ---- */

function initNewRoom() {
  _room = { id: null, name: '', desks: [], decorations: [], designMode: 'board-top', roomHeight: 600 };
}

async function loadRoom(roomId) {
  const raw = await window.api.getRoom(roomId);
  if (!raw) { initNewRoom(); return; }

  const layout = parseLayout(raw.layout_data);
  _room = {
    id: raw.id,
    name: raw.name,
    desks: (layout?.desks ?? []).map(d => ({ ...d, id: d.id ?? uid() })),
    decorations: (layout?.decorations ?? []).map(d => ({ ...d, id: d.id ?? uid() })),
    designMode: layout?.designMode ?? 'board-top',
    roomHeight: layout?.roomHeight ?? 600,
  };
  document.getElementById('room-name-input').value = _room.name;
}

/* ---- Rendering ---- */

function render() {
  const canvas = document.getElementById('room-canvas');
  if (!canvas || !_room) return;

  canvas.style.minHeight = _room.roomHeight + 'px';

  [...canvas.querySelectorAll('.room-desk, .decoration')].forEach(el => el.remove());

  const board = document.getElementById('room-front-board');
  board?.classList.toggle('board-bottom', _room.designMode === 'board-bottom');
  board?.classList.toggle('board-top',    _room.designMode !== 'board-bottom');

  _room.desks.forEach(desk => canvas.appendChild(buildRoomDeskEl(desk)));
  _room.decorations.forEach(deco => canvas.appendChild(buildDecoEl(deco)));
}

function buildRoomDeskEl(desk) {
  const info = DESK_TYPES[desk.type] ?? DESK_TYPES.single;
  const isRound = desk.type.startsWith('round');

  const el = document.createElement('div');
  el.className = 'desk room-desk' + (_selectedIds.has(desk.id) ? ' selected' : '');
  if (isRound) el.className += ' desk-' + desk.type;
  el.dataset.deskId = desk.id;
  el.style.cssText = `left:${desk.x}px;top:${desk.y}px;width:${info.width}px;height:${info.height}px;`;
  if (desk.rotation) el.style.transform = `rotate(${desk.rotation}deg)`;
  if (isRound) el.style.borderRadius = '50%';

  const label = document.createElement('span');
  label.style.cssText = 'font-size:9px;opacity:0.5;pointer-events:none;user-select:none';
  label.textContent = info.label;
  el.appendChild(label);

  makeDeskDraggable(el, desk);
  el.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); showDeskContextMenu(desk.id, e); });
  el.addEventListener('click', e => {
    e.stopPropagation();
    if (!e.shiftKey) _selectedIds.clear();
    _selectedIds.add(desk.id);
    render();
  });

  return el;
}

function buildDecoEl(deco) {
  const icons = { wall: '', cabinet: '<i class="fa-solid fa-box"></i>', window: '<i class="fa-regular fa-window-maximize"></i>', door: '<i class="fa-solid fa-door-open"></i>' };
  const el = document.createElement('div');
  el.className = `decoration decoration-${deco.type}` + (_selectedIds.has(deco.id) ? ' selected-deco' : '');
  el.dataset.decoId = deco.id;
  el.style.cssText = `left:${deco.x}px;top:${deco.y}px;width:${deco.width}px;height:${deco.height}px;`;
  if (deco.rotation) el.style.transform = `rotate(${deco.rotation}deg)`;
  if (icons[deco.type]) el.innerHTML = icons[deco.type];
  if (deco.type === 'label' && deco.label) el.textContent = deco.label;

  makeDecoDraggable(el, deco);
  el.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); showDecoContextMenu(deco.id, e); });
  return el;
}

/* ---- Snapping ---- */

/**
 * Snaps x,y for a given desk against all other desks.
 * Priority: edge-to-edge alignment → fallback to 10px grid.
 */
function snapDesk(desk, rawX, rawY) {
  const info    = DESK_TYPES[desk.type] ?? DESK_TYPES.single;
  const others  = _room.desks.filter(d => d.id !== desk.id && !_selectedIds.has(d.id));

  let snapX = null, snapY = null;

  for (const other of others) {
    const oi = DESK_TYPES[other.type] ?? DESK_TYPES.single;

    // X snapping
    if (snapX === null) {
      if (Math.abs(rawX - (other.x + oi.width)) < SNAP_T)   snapX = other.x + oi.width;  // stick right
      else if (Math.abs(rawX + info.width - other.x) < SNAP_T) snapX = other.x - info.width; // stick left
      else if (Math.abs(rawX - other.x) < SNAP_T)            snapX = other.x;              // align left
      else if (Math.abs(rawX + info.width - other.x - oi.width) < SNAP_T) snapX = other.x + oi.width - info.width; // align right
    }

    // Y snapping
    if (snapY === null) {
      if (Math.abs(rawY - (other.y + oi.height)) < SNAP_T)   snapY = other.y + oi.height; // stick below
      else if (Math.abs(rawY + info.height - other.y) < SNAP_T) snapY = other.y - info.height; // stick above
      else if (Math.abs(rawY - other.y) < SNAP_T)            snapY = other.y;              // align top
    }

    if (snapX !== null && snapY !== null) break;
  }

  const x = Math.max(0, snapX ?? Math.round(rawX / GRID_SZ) * GRID_SZ);
  const y = Math.max(0, snapY ?? Math.round(rawY / GRID_SZ) * GRID_SZ);
  return { x, y };
}

function snapDeco(rawX, rawY) {
  return {
    x: Math.max(0, Math.round(rawX / GRID_SZ) * GRID_SZ),
    y: Math.max(0, Math.round(rawY / GRID_SZ) * GRID_SZ),
  };
}

/* ---- Drag-and-drop (pointer events) ---- */

function makeDeskDraggable(el, desk) {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = el.parentElement.getBoundingClientRect();

    // If the dragged desk isn't in the selection, make it the only selected
    if (!_selectedIds.has(desk.id)) {
      _selectedIds.clear();
      _selectedIds.add(desk.id);
      render();
    }

    // Capture start offsets for ALL selected desks
    const offsets = {};
    _selectedIds.forEach(id => {
      const d = _room.desks.find(x => x.id === id);
      if (d) offsets[id] = { dx: e.clientX - rect.left - d.x, dy: e.clientY - rect.top - d.y };
    });

    _dragState = { deskId: desk.id, offsets, isDeco: false };
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', e => {
    if (!_dragState || _dragState.isDeco || _dragState.deskId !== desk.id) return;
    const rect = el.parentElement.getBoundingClientRect();

    // Compute raw position for primary desk
    const off = _dragState.offsets[desk.id];
    const rawX = e.clientX - rect.left - off.dx;
    const rawY = e.clientY - rect.top  - off.dy;

    // Snap primary desk
    const { x: snappedX, y: snappedY } = snapDesk(desk, rawX, rawY);
    const deltaX = snappedX - desk.x;
    const deltaY = snappedY - desk.y;

    // Move all selected desks by same delta
    _selectedIds.forEach(id => {
      const d = _room.desks.find(x => x.id === id);
      if (!d) return;
      d.x = Math.max(0, d.x + deltaX);
      d.y = Math.max(0, d.y + deltaY);
      const domEl = document.querySelector(`[data-desk-id="${id}"]`);
      if (domEl) { domEl.style.left = d.x + 'px'; domEl.style.top = d.y + 'px'; }
    });
  });

  el.addEventListener('pointerup', () => { _dragState = null; });
}

function makeDecoDraggable(el, deco) {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = el.parentElement.getBoundingClientRect();
    _dragState = {
      isDeco: true, decoId: deco.id,
      offsetX: e.clientX - rect.left - deco.x,
      offsetY: e.clientY - rect.top  - deco.y,
    };
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', e => {
    if (!_dragState || !_dragState.isDeco || _dragState.decoId !== deco.id) return;
    const rect = el.parentElement.getBoundingClientRect();
    const rawX = e.clientX - rect.left - _dragState.offsetX;
    const rawY = e.clientY - rect.top  - _dragState.offsetY;
    const { x, y } = snapDeco(rawX, rawY);
    deco.x = x; deco.y = y;
    el.style.left = x + 'px'; el.style.top = y + 'px';
  });

  el.addEventListener('pointerup', () => { _dragState = null; });
}

/* ---- Context menus ---- */

function showDeskContextMenu(deskId, event) {
  const desk = _room.desks.find(d => d.id === deskId);
  if (!desk) return;

  showMenu(event.clientX, event.clientY, [
    { label: 'Roter 90° med klokken', icon: 'fa-rotate-right', action: () => {
      desk.rotation = ((desk.rotation ?? 0) + 90) % 360; render();
    }},
    { label: 'Roter 90° mot klokken', icon: 'fa-rotate-left', action: () => {
      desk.rotation = ((desk.rotation ?? 0) - 90 + 360) % 360; render();
    }},
    { label: 'Dupliser', icon: 'fa-copy', action: () => {
      _room.desks.push({ ...desk, id: uid(), x: desk.x + 20, y: desk.y + 20 }); render();
    }},
    { divider: true },
    { label: 'Slett', icon: 'fa-trash', danger: true, action: () => {
      _room.desks = _room.desks.filter(d => d.id !== deskId);
      _selectedIds.delete(deskId);
      render();
    }},
  ]);
}

function showDecoContextMenu(decoId, event) {
  const deco = _room.decorations.find(d => d.id === decoId);
  if (!deco) return;

  showMenu(event.clientX, event.clientY, [
    { label: 'Roter 90°', icon: 'fa-rotate-right', action: () => {
      deco.rotation = ((deco.rotation ?? 0) + 90) % 360; render();
    }},
    { divider: true },
    { label: 'Slett', icon: 'fa-trash', danger: true, action: () => {
      _room.decorations = _room.decorations.filter(d => d.id !== decoId);
      render();
    }},
  ]);
}

function showMenu(x, y, items) {
  document.querySelector('.room-ctx-menu')?.remove();

  const menu = document.createElement('div');
  menu.className = 'context-menu room-ctx-menu';
  menu.style.cssText = `left:${x}px;top:${y}px`;

  items.forEach(item => {
    if (item.divider) {
      menu.appendChild(Object.assign(document.createElement('div'), { className: 'context-menu-divider' }));
      return;
    }
    const el = document.createElement('div');
    el.className = 'context-menu-item' + (item.danger ? ' danger' : '');
    el.innerHTML = `<i class="fa-solid ${item.icon}"></i> ${item.label}`;
    el.addEventListener('click', () => { item.action(); menu.remove(); });
    menu.appendChild(el);
  });

  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

/* ---- Multi-select: selection box on canvas background ---- */

function initSelectionBox(canvas) {
  canvas.addEventListener('pointerdown', e => {
    if (e.target !== canvas && e.target.id !== 'room-front-board') return;
    if (e.button !== 0) return;

    // Deselect on bare canvas click
    if (!e.shiftKey) _selectedIds.clear();

    const rect = canvas.getBoundingClientRect();
    _selBoxState = {
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      el: null,
    };
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    if (!_selBoxState) return;
    const rect   = canvas.getBoundingClientRect();
    const curX   = e.clientX - rect.left;
    const curY   = e.clientY - rect.top;
    const left   = Math.min(_selBoxState.startX, curX);
    const top    = Math.min(_selBoxState.startY, curY);
    const width  = Math.abs(curX - _selBoxState.startX);
    const height = Math.abs(curY - _selBoxState.startY);

    if (!_selBoxState.el) {
      const box = document.createElement('div');
      box.className = 'selection-box';
      canvas.appendChild(box);
      _selBoxState.el = box;
    }
    _selBoxState.el.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px;`;
  });

  canvas.addEventListener('pointerup', e => {
    if (!_selBoxState) return;
    if (_selBoxState.el) {
      const boxRect = _selBoxState.el.getBoundingClientRect();
      _room.desks.forEach(desk => {
        const info = DESK_TYPES[desk.type] ?? DESK_TYPES.single;
        const deskRight  = desk.x + info.width;
        const deskBottom = desk.y + info.height;
        const canvasRect = document.getElementById('room-canvas').getBoundingClientRect();
        const deskLeft   = canvasRect.left + desk.x;
        const deskTop    = canvasRect.top  + desk.y;
        const deskR      = deskLeft + info.width;
        const deskB      = deskTop  + info.height;

        // Check overlap
        if (deskR > boxRect.left && deskLeft < boxRect.right &&
            deskB > boxRect.top  && deskTop  < boxRect.bottom) {
          _selectedIds.add(desk.id);
        }
      });
      _selBoxState.el.remove();
    } else {
      // Plain click: just re-render to clear selection
      render();
    }
    _selBoxState = null;
    render();
  });
}

/* ---- Lagre ---- */

async function saveRoom() {
  const name = document.getElementById('room-name-input')?.value.trim();
  if (!name) { showToast('Skriv inn romnavn', 'error'); return; }

  _room.name = name;
  const layoutData = {
    desks: _room.desks,
    decorations: _room.decorations,
    designMode: _room.designMode,
    roomHeight: _room.roomHeight,
  };

  const result = await window.api.saveRoom({ id: _room.id, name, layoutData });
  if (!_room.id) _room.id = result?.lastID;
  showToast('Rom lagret!', 'success');
}

/* ---- Auto-generer rutenett ---- */

function autoGenerate() {
  const cols = parseInt(prompt('Antall kolonner:', '5') ?? '5', 10);
  const rows = parseInt(prompt('Antall rader:', '5') ?? '5', 10);
  if (!cols || !rows) return;

  _room.desks = [];
  const type  = 'single';
  const info  = DESK_TYPES[type];
  const gapX  = 20, gapY = 20;
  const startX = 40, startY = 80;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      _room.desks.push(createDesk(type, startX + c * (info.width + gapX), startY + r * (info.height + gapY)));
    }
  }
  render();
}

/* ---- Events ---- */

function bindEvents() {
  document.getElementById('btn-room-back')?.addEventListener('click', () => {
    if (confirm('Gå tilbake? Ulagrede endringer forsvinner.')) window.navTo('charts-dashboard');
  });
  document.getElementById('btn-room-save')?.addEventListener('click', saveRoom);
  document.getElementById('btn-auto-generate')?.addEventListener('click', autoGenerate);

  // Design mode
  document.querySelectorAll('input[name="design-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (_room) { _room.designMode = radio.value; render(); }
    });
  });

  // Legg til pulter
  document.querySelectorAll('.desk-add-btn[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const info = DESK_TYPES[type];
      _room.desks.push(createDesk(type, 80, 80 + _room.desks.length * (info.height + 15)));
      render();
    });
  });

  // Legg til dekorasjoner
  document.querySelectorAll('.desk-add-btn[data-deco]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.deco;
      const defs = { wall: { w: 200, h: 12 }, cabinet: { w: 80, h: 60 }, window: { w: 120, h: 20 }, door: { w: 60, h: 80 } };
      const d = defs[type] ?? { w: 80, h: 80 };
      _room.decorations.push({ id: uid(), type, x: 80, y: 80, width: d.w, height: d.h, rotation: 0, label: '' });
      render();
    });
  });

  // Canvas: deselect + selection box
  const canvas = document.getElementById('room-canvas');
  if (canvas) {
    canvas.addEventListener('click', (e) => {
      if (e.target === canvas || e.target.id === 'room-front-board') {
        _selectedIds.clear();
        render();
      }
    });
    initSelectionBox(canvas);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

function handleKeyboard(e) {
  if (!_room) return;

  // Ctrl+A: select all desks
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault();
    _room.desks.forEach(d => _selectedIds.add(d.id));
    render();
    return;
  }

  // Delete / Backspace: remove selected desks
  if ((e.key === 'Delete' || e.key === 'Backspace') && _selectedIds.size > 0) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    _room.desks = _room.desks.filter(d => !_selectedIds.has(d.id));
    _selectedIds.clear();
    render();
  }
}

function parseLayout(raw) {
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}
