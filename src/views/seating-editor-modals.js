/**
 * seating-editor-modals.js — Modaler, context-menyer og unplaced-dock
 * for seating-editoren.
 * Eksporterer: openNoteModal, openNewPeriodModal, showDeskContextMenu,
 *              showStudentContextMenu, wireDesksForSidebarDrop, renderUnplacedDock
 */

import { DESK_COLORS } from '../shared/constants.js';
import { showToast, getWeekNumber, getPortal } from '../shared/utils.js';
import { showContextMenu } from '../shared/contextMenu.js';

const COLOR_HEX = {
  default: '#6b7280', red: '#ef4444', green: '#22c55e', blue: '#3b82f6',
  yellow: '#eab308', purple: '#8b5cf6', orange: '#f97316', pink: '#ec4899',
};

/* ---- Unplaced students dock ---- */

export function renderUnplacedDock(chart, renderFn) {
  const container = document.getElementById('unassigned-students');
  const badge     = document.getElementById('student-count-badge');
  if (!container || !chart) return;

  const placedIds = new Set();
  chart.desks.forEach(desk => {
    (desk.slots ?? []).forEach(slot => { if (slot?.studentId) placedIds.add(slot.studentId); });
  });

  const unplaced = chart.students.filter(s => !placedIds.has(s.id));
  badge.textContent = unplaced.length;

  container.innerHTML = '';
  unplaced.forEach(student => {
    const chip = document.createElement('div');
    chip.className = 'student-chip';
    chip.textContent = student.name;
    chip.draggable = true;
    chip.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ fromSidebar: true, studentId: student.id }));
    });
    container.appendChild(chip);
  });

  container.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
  container.addEventListener('drop', e => {
    e.preventDefault();
    const data = _safeParseJSON(e.dataTransfer.getData('text/plain'));
    if (!data || data.fromSidebar) return;
    const desk = chart.desks.find(d => d.id === data.deskId);
    if (desk && desk.slots[data.slotIdx]) { desk.slots[data.slotIdx] = null; renderFn(); }
  });
}

/* ---- Sidebar drag-to-slot wiring ---- */

export function wireDesksForSidebarDrop(chart, handleDropFromSidebar) {
  const canvas = document.getElementById('seating-canvas');
  if (!canvas) return;
  canvas.addEventListener('sidebar-drop', e => {
    const { studentId, deskId, slotIdx } = e.detail;
    handleDropFromSidebar(studentId, deskId, slotIdx);
  });
}

/* ---- Context menus ---- */

export function showDeskContextMenu(deskId, event, chart, renderFn) {
  const desk = chart.desks.find(d => d.id === deskId);
  if (!desk) return;

  const colorSwatches = DESK_COLORS.map(color =>
    `<span class="desk-color-swatch" data-color="${color}" title="${color}" style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${COLOR_HEX[color]};cursor:pointer;border:2px solid ${desk.color===color?'#fff':'transparent'};margin:1px"></span>`
  ).join('');

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.cssText = `left:${event.clientX}px;top:${event.clientY}px`;
  menu.innerHTML = `
    <div class="context-menu-item" id="_cm-clear"><i class="fa-solid fa-eraser"></i> Fjern elever</div>
    <div class="context-menu-divider"></div>
    <div style="padding:6px 12px;font-size:11px;color:oklch(var(--bc)/0.4)">Bordfarge</div>
    <div style="padding:4px 12px 8px;display:flex;flex-wrap:wrap;gap:2px">${colorSwatches}</div>
  `;

  menu.querySelector('#_cm-clear').addEventListener('click', () => {
    desk.slots = desk.slots.map(() => null); renderFn(); menu.remove();
  });
  menu.querySelectorAll('.desk-color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => { desk.color = swatch.dataset.color; renderFn(); menu.remove(); });
  });

  getPortal().appendChild(menu);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

export function showStudentContextMenu(deskId, slotIdx, event, chart, renderFn) {
  const desk    = chart.desks.find(d => d.id === deskId);
  const slot    = desk?.slots[slotIdx];
  const student = slot ? chart.studentsById[slot.studentId] : null;
  if (!student) return;

  showContextMenu(event.clientX, event.clientY, [
    {
      label: slot.locked ? 'Lås opp posisjon' : 'Lås posisjon',
      icon: slot.locked ? 'fa-lock-open' : 'fa-lock',
      action: () => { slot.locked = !slot.locked; renderFn(); },
    },
    { label: 'Rediger notat', icon: 'fa-note-sticky', action: () => openNoteModal(deskId, slotIdx, chart, renderFn) },
    { divider: true },
    { label: 'Fjern fra bord', icon: 'fa-user-minus', action: () => { desk.slots[slotIdx] = null; renderFn(); } },
  ], 'seating-ctx-menu');
}

/* ---- Notat-modal ---- */

export function openNoteModal(deskId, slotIdx, chart, renderFn) {
  const desk    = chart.desks.find(d => d.id === deskId);
  const slot    = desk?.slots[slotIdx];
  const student = slot ? chart.studentsById[slot.studentId] : null;
  if (!student) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'kp-backdrop';
  backdrop.innerHTML = `
    <div class="kp-modal">
      <div class="modal-header">
        <span class="modal-title">Notat — ${_escHtml(student.name)}</span>
        <button class="btn btn-ghost btn-sm" id="btn-note-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <textarea id="note-textarea" class="textarea textarea-bordered w-full" style="min-height:120px;resize:vertical">${_escHtml(student.note ?? '')}</textarea>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" id="btn-note-cancel">Avbryt</button>
        <button class="btn btn-primary btn-sm" id="btn-note-save">Lagre</button>
      </div>
    </div>
  `;
  getPortal().appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('#btn-note-close').addEventListener('click', close);
  backdrop.querySelector('#btn-note-cancel').addEventListener('click', close);
  backdrop.querySelector('#btn-note-save').addEventListener('click', () => {
    student.note = backdrop.querySelector('#note-textarea').value;
    close();
    renderFn();
  });
}

/* ---- Ny periode ---- */

export function openNewPeriodModal(chart, navigateFn) {
  if (!chart) return;
  if (!chart.id) { showToast('Lagre klassekart først før du starter ny periode', 'error'); return; }

  const currentWeek = getWeekNumber(new Date());
  const fromWeek = currentWeek;
  const toWeek   = currentWeek + 3;

  const backdrop = document.createElement('div');
  backdrop.className = 'kp-backdrop';
  backdrop.innerHTML = `
    <div class="kp-modal" style="min-width:300px">
      <div class="modal-header"><span class="modal-title">Start ny periode</span></div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Fra uke</label>
        <input type="number" id="period-from" class="input input-bordered w-full" value="${fromWeek}" min="1" max="53">
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Til uke</label>
        <input type="number" id="period-to" class="input input-bordered w-full" value="${toWeek}" min="1" max="53">
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="period-cancel">Avbryt</button>
        <button class="btn btn-primary" id="period-ok">Opprett</button>
      </div>
    </div>
  `;
  getPortal().appendChild(backdrop);
  backdrop.querySelector('#period-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#period-ok').addEventListener('click', async () => {
    const from = parseInt(backdrop.querySelector('#period-from').value, 10);
    const to   = parseInt(backdrop.querySelector('#period-to').value, 10);
    if (!from || !to || from > to) { showToast('Ugyldig ukeintervall', 'error'); return; }
    backdrop.remove();
    const comment = `Uke ${from}–${to}`;
    const name    = `${chart.name} (${comment})`;
    const result  = await window.api.duplicateSeating({ sourceId: chart.id, name, comment });
    if (result?.lastID) {
      showToast(`Ny periode opprettet: ${comment}`, 'success');
      navigateFn('seating-editor', { chartId: result.lastID });
    } else {
      showToast('Feil ved oppretting av periode', 'error');
    }
  });
}

/* ---- Hjelpefunksjoner ---- */

function _safeParseJSON(str) {
  if (!str) return null;
  try { return typeof str === 'string' ? JSON.parse(str) : str; } catch { return null; }
}

function _escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
