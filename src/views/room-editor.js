/**
 * room-editor.js — Romdesigner med drag-and-drop og dekorasjoner.
 * Data-first: all state i _room-objektet, DOM er kun visning.
 */

import { DESK_TYPES, DECORATION_TYPES } from '../shared/constants.js';
import { showToast, createDesk, snapToGrid, uid } from '../shared/utils.js';

let _room = null;  // { id, name, desks, decorations, designMode, roomHeight }
let _selectedIds = new Set();
let _dragState = null;

export const roomEditorView = {
  async mount(container, params = {}) {
    const html = await fetch('src/views/room-editor.html').then(r => r.text());
    container.innerHTML = html;

    if (params.roomId) {
      await loadRoom(params.roomId);
    } else {
      initNewRoom();
    }

    bindEvents();
    render();
  },
  unmount() { _room = null; _selectedIds.clear(); _dragState = null; },
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
    decorations: layout?.decorations ?? [],
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

  // Fjern gamle pulter og dekorasjoner (behold tavle)
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
  el.dataset.deskId = desk.id;
  el.style.cssText = `left:${desk.x}px;top:${desk.y}px;width:${info.width}px;height:${info.height}px;`;
  if (desk.rotation) el.style.transform = `rotate(${desk.rotation}deg)`;
  if (isRound) el.style.borderRadius = '50%';

  const label = document.createElement('span');
  label.style.cssText = 'font-size:9px;color:var(--text-muted);pointer-events:none';
  label.textContent = info.label;
  el.appendChild(label);

  makeDraggable(el, desk);
  el.addEventListener('contextmenu', e => { e.preventDefault(); showDeskContextMenu(desk.id, e); });
  el.addEventListener('click', e => {
    if (!e.shiftKey) _selectedIds.clear();
    _selectedIds.add(desk.id);
    render();
  });

  return el;
}

function buildDecoEl(deco) {
  const el = document.createElement('div');
  el.className = `decoration decoration-${deco.type}`;
  el.dataset.decoId = deco.id;
  el.style.cssText = `left:${deco.x}px;top:${deco.y}px;width:${deco.width}px;height:${deco.height}px;`;
  if (deco.label) el.textContent = deco.label;
  makeDraggable(el, deco, true);
  return el;
}

/* ---- Drag-and-drop (pointerevents) ---- */

function makeDraggable(el, item, isDeco = false) {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = el.parentElement.getBoundingClientRect();
    _dragState = {
      item, isDeco,
      startX: e.clientX - rect.left - item.x,
      startY: e.clientY - rect.top  - item.y,
    };
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', e => {
    if (!_dragState || _dragState.item.id !== item.id) return;
    const rect = el.parentElement.getBoundingClientRect();
    const x = snapToGrid(e.clientX - rect.left - _dragState.startX);
    const y = snapToGrid(e.clientY - rect.top  - _dragState.startY);
    item.x = Math.max(0, x);
    item.y = Math.max(0, y);
    el.style.left = item.x + 'px';
    el.style.top  = item.y + 'px';
  });

  el.addEventListener('pointerup', () => { _dragState = null; });
}

/* ---- Context menu ---- */

function showDeskContextMenu(deskId, event) {
  const desk = _room.desks.find(d => d.id === deskId);
  if (!desk) return;

  showMenu(event.clientX, event.clientY, [
    { label: 'Roter 90°', icon: 'fa-rotate-right', action: () => {
      desk.rotation = ((desk.rotation ?? 0) + 90) % 360; render();
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

function showMenu(x, y, items) {
  const existing = document.querySelector('.room-ctx-menu');
  existing?.remove();

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
      _room.designMode = radio.value;
      render();
    });
  });

  // Legg til pulter
  document.querySelectorAll('.desk-add-btn[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const info = DESK_TYPES[type];
      const canvas = document.getElementById('room-canvas');
      const rect = canvas?.getBoundingClientRect();
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

  // Deselect ved klikk på canvas
  document.getElementById('room-canvas')?.addEventListener('click', (e) => {
    if (e.target.id === 'room-canvas' || e.target.id === 'room-front-board') {
      _selectedIds.clear();
      render();
    }
  });
}

function parseLayout(raw) {
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}
