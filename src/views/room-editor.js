/**
 * room-editor.js — Romdesigner: mount/unmount, render, lagre, keyboard, events.
 * Drag og snapping: room-editor-drag.js
 * Bygge-hjelpere og auto-generering: room-editor-generate.js
 */

import { showToast, uid, createDesk } from '../shared/utils.js';
import { DESK_TYPES } from '../shared/constants.js';
import { makeDeskDraggable, makeDecoDraggable, initSelectionBox } from './room-editor-drag.js';
import { buildRoomDeskEl, buildDecoEl, showDeskContextMenu, showDecoContextMenu, autoGenerate } from './room-editor-generate.js';

let _room = null;  // { id, name, desks, decorations, designMode, roomHeight }
let _rotated = false;

// Shared mutable state — passed by reference into drag/generate helpers
const _state = {
  selectedIds: new Set(),
  dragState:   { current: null },
  selBoxState: null,
  get room() { return _room; },
};

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
    _room = null;
    _state.selectedIds.clear();
    _state.dragState.current = null;
    _state.selBoxState = null;
    _rotated = false;
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
  canvas.classList.toggle('canvas-rotated', _rotated);

  [...canvas.querySelectorAll('.room-desk, .decoration')].forEach(el => el.remove());

  const board = document.getElementById('room-front-board');
  const boardVisuallyAtBottom = (_room.designMode === 'board-bottom') !== _rotated;
  board?.classList.toggle('board-bottom', boardVisuallyAtBottom);
  board?.classList.toggle('board-top', !boardVisuallyAtBottom);

  _room.desks.forEach(desk => canvas.appendChild(buildRoomDeskEl(desk, _state, render,
    (id, e) => showDeskContextMenu(id, e, _room, render))));
  _room.decorations.forEach(deco => canvas.appendChild(buildDecoEl(deco, _state, render,
    (id, e) => showDecoContextMenu(id, e, _room, render))));
}

/* ---- Lagre ---- */

async function saveRoom() {
  const name = document.getElementById('room-name-input')?.value.trim();
  if (!name) { showToast('Skriv inn romnavn', 'error'); return; }

  _room.name = name;
  const layoutData = { desks: _room.desks, decorations: _room.decorations, designMode: _room.designMode, roomHeight: _room.roomHeight };
  const result = await window.api.saveRoom({ id: _room.id, name, layoutData });
  if (!_room.id) _room.id = result?.lastID;
  showToast('Rom lagret!', 'success');
}

/* ---- Events ---- */

function bindEvents() {
  document.getElementById('btn-room-back')?.addEventListener('click', () => {
    if (confirm('Gå tilbake? Ulagrede endringer forsvinner.')) window.navTo('rooms-list');
  });
  document.getElementById('btn-room-save')?.addEventListener('click', saveRoom);
  document.getElementById('btn-auto-generate')?.addEventListener('click', () => autoGenerate(_room, render));

  document.getElementById('btn-rotate-room')?.addEventListener('click', (e) => {
    _rotated = !_rotated;
    e.currentTarget.classList.toggle('btn-active', _rotated);
    render();
  });

  document.querySelectorAll('.desk-add-btn[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const info = DESK_TYPES[type];
      _room.desks.push(createDesk(type, 80, 80 + _room.desks.length * (info.height + 15)));
      render();
    });
  });

  document.querySelectorAll('.desk-add-btn[data-deco]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.deco;
      const defs = { wall: { w: 200, h: 12 }, cabinet: { w: 80, h: 60 }, window: { w: 120, h: 20 }, door: { w: 60, h: 80 } };
      const d = defs[type] ?? { w: 80, h: 80 };
      _room.decorations.push({ id: uid(), type, x: 80, y: 80, width: d.w, height: d.h, rotation: 0, label: '' });
      render();
    });
  });

  const canvas = document.getElementById('room-canvas');
  if (canvas) {
    canvas.addEventListener('click', (e) => {
      if (e.target === canvas || e.target.id === 'room-front-board') {
        _state.selectedIds.clear();
        render();
      }
    });
    initSelectionBox(canvas, _state, render);
  }

  document.addEventListener('keydown', handleKeyboard);
}

function handleKeyboard(e) {
  if (!_room) return;

  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault();
    _room.desks.forEach(d => _state.selectedIds.add(d.id));
    render();
    return;
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && _state.selectedIds.size > 0) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    _room.desks = _room.desks.filter(d => !_state.selectedIds.has(d.id));
    _state.selectedIds.clear();
    render();
  }
}

function parseLayout(raw) {
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}

/* ---- Template ---- */

const TEMPLATE = `
<div class="editor-layout">
  <div class="editor-toolbar">
    <div class="toolbar-left">
      <button class="btn btn-ghost btn-sm" id="btn-room-back"><i class="fa-solid fa-arrow-left"></i></button>
      <input type="text" id="room-name-input" class="toolbar-title-input" placeholder="Romnavn...">
    </div>
    <div class="toolbar-center">
      <div class="desk-picker" id="desk-picker">
        <button class="desk-add-btn" data-type="single" title="Enkeltbord"><span class="desk-mini single"></span></button>
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
      <button class="btn btn-ghost btn-sm" id="btn-rotate-room" title="Roter visning 180°">
        <i class="fa-solid fa-rotate-180"></i> Roter visning
      </button>
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
