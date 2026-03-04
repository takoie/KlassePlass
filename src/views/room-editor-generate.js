/**
 * room-editor-generate.js — Bygge-hjelpere, auto-generering og context-menyer
 * for romdesigneren.
 * Eksporterer: AUTO_PRESETS, autoGenerate, applyAutoGenerate, buildRoomDeskEl,
 *              buildDecoEl, showDeskContextMenu, showDecoContextMenu
 */

import { DESK_TYPES } from '../shared/constants.js';
import { getPortal, createDesk, uid } from '../shared/utils.js';
import { makeDeskDraggable, makeDecoDraggable } from './room-editor-drag.js';

/* ---- Auto-generer presets ---- */

export const AUTO_PRESETS = [
  { label: '2-2 (4 bord per rad)',      groups: [2, 2] },
  { label: '2-2-2 (6 bord per rad)',    groups: [2, 2, 2] },
  { label: '2-2-2-2 (8 bord per rad)',  groups: [2, 2, 2, 2] },
  { label: '2-3-2 (7 bord per rad)',    groups: [2, 3, 2] },
  { label: '3-3-3 (9 bord per rad)',    groups: [3, 3, 3] },
  { label: '4-4 (8 bord per rad)',      groups: [4, 4] },
  { label: '4-2-4 (10 bord per rad)',   groups: [4, 2, 4] },
  { label: 'Eksamen (1-1-1-1-1)',       groups: [1, 1, 1, 1, 1] },
];

/* ---- Bygge-hjelpere ---- */

/**
 * @param {Object} desk
 * @param {{ selectedIds: Set, dragState, room }} state
 * @param {Function} renderFn
 * @param {Function} showDeskCtxFn
 */
export function buildRoomDeskEl(desk, state, renderFn, showDeskCtxFn) {
  const info    = DESK_TYPES[desk.type] ?? DESK_TYPES.single;
  const isRound = desk.type.startsWith('round');

  const el = document.createElement('div');
  el.className = 'desk room-desk' + (state.selectedIds.has(desk.id) ? ' selected' : '');
  if (isRound) el.className += ' desk-' + desk.type;
  el.dataset.deskId = desk.id;
  el.style.cssText = `left:${desk.x}px;top:${desk.y}px;width:${info.width}px;height:${info.height}px;`;
  if (desk.rotation) el.style.transform = `rotate(${desk.rotation}deg)`;
  if (isRound) el.style.borderRadius = '50%';

  const label = document.createElement('span');
  label.style.cssText = 'font-size:9px;opacity:0.5;pointer-events:none;user-select:none';
  label.textContent = info.label;
  el.appendChild(label);

  makeDeskDraggable(el, desk, state);
  el.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); showDeskCtxFn(desk.id, e); });
  el.addEventListener('click', e => {
    e.stopPropagation();
    if (!e.shiftKey) state.selectedIds.clear();
    state.selectedIds.add(desk.id);
    document.querySelectorAll('.room-desk').forEach(d => {
      d.classList.toggle('selected', state.selectedIds.has(d.dataset.deskId));
    });
  });

  return el;
}

export function buildDecoEl(deco, state, renderFn, showDecoCtxFn) {
  const icons = { wall: '', cabinet: '<i class="fa-solid fa-box"></i>', window: '<i class="fa-regular fa-window-maximize"></i>', door: '<i class="fa-solid fa-door-open"></i>' };
  const el = document.createElement('div');
  el.className = `decoration decoration-${deco.type}` + (state.selectedIds.has(deco.id) ? ' selected-deco' : '');
  el.dataset.decoId = deco.id;
  el.style.cssText = `left:${deco.x}px;top:${deco.y}px;width:${deco.width}px;height:${deco.height}px;`;
  if (deco.rotation) el.style.transform = `rotate(${deco.rotation}deg)`;
  if (icons[deco.type]) el.innerHTML = icons[deco.type];
  if (deco.type === 'label' && deco.label) el.textContent = deco.label;

  makeDecoDraggable(el, deco, state);
  el.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); showDecoCtxFn(deco.id, e); });
  return el;
}

/* ---- Context menus ---- */

export function showDeskContextMenu(deskId, event, room, renderFn) {
  const desk = room.desks.find(d => d.id === deskId);
  if (!desk) return;

  _showMenu(event.clientX, event.clientY, [
    { label: 'Roter 90° med klokken', icon: 'fa-rotate-right', action: () => {
      desk.rotation = ((desk.rotation ?? 0) + 90) % 360; renderFn();
    }},
    { label: 'Roter 90° mot klokken', icon: 'fa-rotate-left', action: () => {
      desk.rotation = ((desk.rotation ?? 0) - 90 + 360) % 360; renderFn();
    }},
    { label: 'Dupliser', icon: 'fa-copy', action: () => {
      room.desks.push({ ...desk, id: uid(), x: desk.x + 20, y: desk.y + 20 }); renderFn();
    }},
    { divider: true },
    { label: 'Slett', icon: 'fa-trash', danger: true, action: () => {
      room.desks = room.desks.filter(d => d.id !== deskId); renderFn();
    }},
  ]);
}

export function showDecoContextMenu(decoId, event, room, renderFn) {
  const deco = room.decorations.find(d => d.id === decoId);
  if (!deco) return;

  _showMenu(event.clientX, event.clientY, [
    { label: 'Roter 90°', icon: 'fa-rotate-right', action: () => {
      deco.rotation = ((deco.rotation ?? 0) + 90) % 360; renderFn();
    }},
    { divider: true },
    { label: 'Slett', icon: 'fa-trash', danger: true, action: () => {
      room.decorations = room.decorations.filter(d => d.id !== decoId); renderFn();
    }},
  ]);
}

function _showMenu(x, y, items) {
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

  getPortal().appendChild(menu);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

/* ---- Auto-generering ---- */

export function autoGenerate(room, renderFn) {
  const backdrop = document.createElement('div');
  backdrop.className = 'kp-backdrop';
  backdrop.innerHTML = `
    <div class="kp-modal" style="min-width:320px">
      <div class="modal-header"><span class="modal-title">Auto-generer rom</span></div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Oppsett</label>
        <select id="ag-preset" class="select select-bordered w-full">
          ${AUTO_PRESETS.map((p, i) => `<option value="${i}">${_escHtml(p.label)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Antall rader</label>
        <input type="number" id="ag-rows" class="input input-bordered w-full" value="5" min="1" max="20">
      </div>
      <div class="form-group" style="margin-bottom:16px;display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="ag-keep-deco" class="checkbox checkbox-sm">
        <label for="ag-keep-deco" class="form-label" style="margin:0">Behold dekorasjoner</label>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="ag-cancel">Avbryt</button>
        <button class="btn btn-primary" id="ag-ok">Generer</button>
      </div>
    </div>
  `;
  getPortal().appendChild(backdrop);
  backdrop.querySelector('#ag-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#ag-ok').addEventListener('click', () => {
    const presetIdx = parseInt(backdrop.querySelector('#ag-preset').value, 10);
    const rows      = parseInt(backdrop.querySelector('#ag-rows').value, 10) || 5;
    const keepDeco  = backdrop.querySelector('#ag-keep-deco').checked;
    backdrop.remove();
    applyAutoGenerate(AUTO_PRESETS[presetIdx].groups, rows, keepDeco, room, renderFn);
  });
}

export function applyAutoGenerate(groups, rows, keepDeco, room, renderFn) {
  const info    = DESK_TYPES.single;
  const deskW   = info.width;
  const deskH   = info.height;
  const aisle   = 40;
  const gapX    = 2;
  const rowGapY = 30;

  const rowWidth = groups.reduce((sum, g) => sum + g * deskW + (g - 1) * gapX, 0)
    + (groups.length - 1) * aisle;

  const startX = Math.round((920 - rowWidth) / 2);
  const startY = 80;

  if (!keepDeco) {
    room.desks = [];
    room.decorations = [];
  } else {
    room.desks = [];
  }

  for (let r = 0; r < rows; r++) {
    let x = startX;
    const y = startY + r * (deskH + rowGapY);
    for (let g = 0; g < groups.length; g++) {
      for (let i = 0; i < groups[g]; i++) {
        room.desks.push(createDesk('single', x, y));
        x += deskW + (i < groups[g] - 1 ? gapX : 0);
      }
      if (g < groups.length - 1) x += aisle;
    }
  }
  renderFn();
}

function _escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
