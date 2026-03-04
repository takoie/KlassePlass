/**
 * classes-student-panel.js — Elevliste-visning, notater, constraints og historikk
 * for klasse-panelet.
 * Eksporterer: renderStudentList, openNoteModal, renderConstraints,
 *              renderHistorySummary, addConstraint, parseStudents
 */

import { showToast, getPortal } from '../shared/utils.js';

/* ---- Student list rendering ---- */

/**
 * @param {Array}    students       - normalisert student-array (muteres ved endringer)
 * @param {Function} onListChange   - kalles etter endringer (re-render callback)
 */
export function renderStudentList(students, onListChange) {
  const list  = document.getElementById('student-list');
  const empty = document.getElementById('student-list-empty');
  if (!list) return;

  list.innerHTML = '';

  if (students.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  students.forEach((student, idx) => {
    const row = document.createElement('div');
    row.className = 'student-row';
    row.dataset.idx = idx;

    const p = student.placement ?? '';
    const hasNote = !!(student.note?.trim());

    row.innerHTML = `
      <span class="student-name">${_escHtml(student.name)}</span>
      <div class="student-row-controls">
        <select class="student-placement-select${p ? ' has-value' : ''}" data-idx="${idx}" title="Plasseringsprioritet">
          <option value="">— Prioritet —</option>
          <option value="front"      ${p==='front'      ?'selected':''}>Fremst</option>
          <option value="back"       ${p==='back'       ?'selected':''}>Bakerst</option>
          <option value="middle"     ${p==='middle'     ?'selected':''}>Midten</option>
          <option value="never-front"${p==='never-front'?'selected':''}>Aldri fremst</option>
          <option value="never-back" ${p==='never-back' ?'selected':''}>Aldri bakerst</option>
        </select>
        <button class="btn btn-ghost btn-xs btn-note-edit${hasNote ? ' has-note' : ''}" data-idx="${idx}" title="${hasNote ? _escHtml(student.note) : 'Legg til notat'}">
          <i class="fa-solid fa-${hasNote ? 'note-sticky' : 'pencil'}"></i>
        </button>
      </div>
    `;

    row.querySelector('.student-placement-select').addEventListener('change', (e) => {
      students[parseInt(e.target.dataset.idx, 10)].placement = e.target.value || null;
      renderStudentList(students, onListChange);
    });

    row.querySelector('.btn-note-edit').addEventListener('click', () =>
      openNoteModal(idx, students, () => renderStudentList(students, onListChange)));

    list.appendChild(row);
  });
}

export function openNoteModal(idx, students, onSave) {
  const student = students[idx];
  const backdrop = document.createElement('div');
  backdrop.className = 'kp-backdrop';
  backdrop.innerHTML = `
    <div class="kp-modal">
      <div class="modal-header">
        <span class="modal-title">Notat for ${_escHtml(student.name)}</span>
      </div>
      <textarea id="note-input" class="students-textarea" rows="4"
        placeholder="F.eks: ADHD – sitter best fremst til venstre"
        style="min-height:80px">${_escHtml(student.note ?? '')}</textarea>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="note-cancel">Avbryt</button>
        <button class="btn btn-primary" id="note-save">Lagre</button>
      </div>
    </div>
  `;
  getPortal().appendChild(backdrop);
  backdrop.querySelector('#note-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#note-save').addEventListener('click', () => {
    students[idx].note = backdrop.querySelector('#note-input').value.trim();
    backdrop.remove();
    onSave?.();
  });
}

/* ---- Constraints ---- */

/**
 * @param {Array}    constraints    - array av constraint-objekter
 * @param {Object}   activeClass    - { id }
 * @param {Function} onConstraintChange - callback etter endring
 */
export function renderConstraints(constraints, activeClass, onConstraintChange) {
  const list  = document.getElementById('constraints-list');
  const empty = document.getElementById('constraints-empty');
  if (!list) return;

  list.innerHTML = '';

  if (constraints.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  constraints.forEach(c => {
    const el = document.createElement('div');
    el.className = 'constraint-item';
    const isAlways  = c.type === 'always_together';
    const badgeCls  = isAlways ? 'badge-always' : 'badge-never';
    const typeLabel = isAlways ? 'Alltid sammen' : 'Aldri sammen';
    const desc      = isAlways
      ? `${_escHtml(c.student_a)} og ${_escHtml(c.student_b)} skal alltid sitte på samme bord`
      : `${_escHtml(c.student_a)} og ${_escHtml(c.student_b)} skal aldri sitte på samme bord`;

    el.innerHTML = `
      <div class="constraint-item-main">
        <span class="constraint-type-badge ${badgeCls}">${typeLabel}</span>
        <span class="constraint-desc">${desc}</span>
      </div>
      <div class="constraint-item-actions">
        <button class="btn btn-ghost btn-xs btn-toggle-constraint" data-id="${c.id}" title="Bytt til ${isAlways ? 'Aldri sammen' : 'Alltid sammen'}">
          <i class="fa-solid fa-arrow-right-arrow-left"></i>
        </button>
        <button class="btn btn-ghost btn-xs btn-del-constraint" data-id="${c.id}" title="Slett regel">
          <i class="fa-solid fa-xmark text-error"></i>
        </button>
      </div>
    `;
    el.querySelector('.btn-del-constraint').addEventListener('click', async () => {
      await window.api.deleteConstraint(c.id);
      const idx = constraints.findIndex(x => x.id === c.id);
      if (idx !== -1) constraints.splice(idx, 1);
      renderConstraints(constraints, activeClass, onConstraintChange);
    });
    el.querySelector('.btn-toggle-constraint').addEventListener('click', async () => {
      const newType = c.type === 'always_together' ? 'never_together' : 'always_together';
      await window.api.deleteConstraint(c.id);
      const result = await window.api.saveConstraint({
        classId: activeClass.id,
        studentA: c.student_a,
        studentB: c.student_b,
        type: newType,
      });
      const idx = constraints.findIndex(x => x.id === c.id);
      if (idx !== -1) constraints[idx] = { ...c, id: result.lastID, type: newType };
      renderConstraints(constraints, activeClass, onConstraintChange);
    });
    list.appendChild(el);
  });
}

export async function renderHistorySummary(classId) {
  const summary = document.getElementById('class-history-summary');
  if (!summary) return;
  const history = await window.api.getHistory(classId, 5);
  summary.textContent = history.length
    ? `${history.length} klassekart i historikken`
    : 'Ingen historikk ennå';
}

export async function addConstraint(students, constraints, activeClass, onConstraintChange) {
  if (!activeClass) return;
  const names = students.map(s => s.name);

  const backdrop = document.createElement('div');
  backdrop.className = 'kp-backdrop';
  backdrop.innerHTML = `
    <div class="kp-modal">
      <div class="modal-header"><span class="modal-title">Ny plasserings-regel</span></div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Elev A</label>
        <select id="c-student-a" class="select select-bordered w-full">
          ${names.map(n => `<option>${_escHtml(n)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Elev B</label>
        <select id="c-student-b" class="select select-bordered w-full">
          ${names.map(n => `<option>${_escHtml(n)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Type</label>
        <select id="c-type" class="select select-bordered w-full">
          <option value="always_together">Alltid sammen</option>
          <option value="never_together">Aldri sammen</option>
        </select>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="c-cancel">Avbryt</button>
        <button class="btn btn-primary" id="c-save">Legg til</button>
      </div>
    </div>
  `;
  getPortal().appendChild(backdrop);

  backdrop.querySelector('#c-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#c-save').addEventListener('click', async () => {
    const a    = backdrop.querySelector('#c-student-a').value;
    const b    = backdrop.querySelector('#c-student-b').value;
    const type = backdrop.querySelector('#c-type').value;
    if (a === b) { showToast('Velg to forskjellige elever', 'error'); return; }
    const result = await window.api.saveConstraint({ classId: activeClass.id, studentA: a, studentB: b, type });
    constraints.push({ id: result.lastID, class_id: activeClass.id, student_a: a, student_b: b, type });
    onConstraintChange?.();
    backdrop.remove();
    showToast('Regel lagt til', 'success');
  });
}

/* ---- Helpers ---- */

export function parseStudents(raw) {
  if (!raw) return [];
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(p) ? p : String(raw).split('\n').filter(Boolean);
  } catch { return String(raw).split('\n').filter(Boolean); }
}

function _escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
