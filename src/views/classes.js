/**
 * classes.js — Klasse- og elevadministrasjon: liste, åpne/lagre/slette klasser.
 * Elevliste, notater, constraints og historikk: classes-student-panel.js
 */

import { showToast, normalizeStudents, getPortal, showConfirm, focusAfterRender } from '../shared/utils.js';
import {
  renderStudentList, renderConstraints, renderHistorySummary,
  addConstraint, parseStudents,
} from './classes-student-panel.js';

let _classes     = [];
let _activeClass = null;
let _constraints = [];
let _students    = [];  // Normalized student objects for active class
let _autoSaveTimer = null;

const TEMPLATE = `
<div class="view-header">
  <div>
    <h1 class="view-title">Klasser</h1>
    <p class="view-subtitle">Administrer klasser og elevlister</p>
  </div>
  <button class="btn btn-primary btn-sm" id="btn-new-class">
    <i class="fa-solid fa-plus"></i> Ny klasse
  </button>
</div>
<div class="classes-layout">
  <div class="classes-list-panel">
    <div id="classes-list"></div>
    <div id="classes-empty" class="empty-state hidden">
      <i class="fa-solid fa-users"></i>
      <h3>Ingen klasser ennå</h3>
      <p>Opprett en klasse for å legge til elever.</p>
    </div>
  </div>
  <div id="class-detail-panel" class="class-detail-panel hidden">
    <div class="panel-header">
      <input type="text" id="class-name-input" class="panel-title-input" placeholder="Klassenavn...">
      <div class="panel-header-actions">
        <span class="save-status" id="save-status"></span>
        <button class="btn btn-ghost btn-ghost-danger btn-xs" id="btn-delete-class" title="Slett klasse">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>

    <div class="student-editor">
      <div class="student-editor-header">
        <span class="section-label">Elever</span>
        <div class="section-header-controls">
          <span id="class-student-count" class="badge"></span>
          <button class="btn btn-ghost btn-xs" id="btn-add-student" title="Legg til elev">
            <i class="fa-solid fa-user-plus"></i> Legg til
          </button>
          <button class="btn btn-ghost btn-xs" id="btn-toggle-bulk" title="Importer liste">
            <i class="fa-solid fa-file-import"></i> Importer
          </button>
        </div>
      </div>

      <div id="student-list-view">
        <div id="student-list"></div>
        <div id="student-list-empty" class="empty-state-inline hidden">Ingen elever ennå.</div>
      </div>
    </div>

    <div class="constraints-section">
      <div class="section-header">
        <span class="section-label">Plasserings-regler</span>
        <button class="btn btn-ghost btn-sm" id="btn-add-constraint">
          <i class="fa-solid fa-plus"></i> Ny regel
        </button>
      </div>
      <div id="constraints-list"></div>
      <div id="constraints-empty" class="empty-state-inline hidden">
        Ingen regler ennå. Legg til for å kontrollere plasseringer.
      </div>
    </div>

    <div class="history-section">
      <div class="section-header">
        <span class="section-label">Historikk</span>
        <button class="btn btn-ghost btn-sm" id="btn-view-history">
          <i class="fa-solid fa-clock-rotate-left"></i> Se historikk
        </button>
      </div>
      <div id="class-history-summary" class="history-summary"></div>
    </div>
  </div>
</div>`;

export const classesView = {
  async mount(container) {
    container.innerHTML = TEMPLATE;
    await loadClasses();
    bindEvents();
  },
  unmount() { _activeClass = null; _students = []; },
};

function showLoadingSkeleton(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const el = document.createElement('div');
  el.id = 'loading-skeleton';
  el.className = 'loading-skeleton';
  el.innerHTML = `<span class="loading loading-spinner loading-md"></span><span>Laster…</span>`;
  container.appendChild(el);
}

async function loadClasses() {
  showLoadingSkeleton('classes-list');
  try {
    _classes = await window.api.getClasses();
    renderClassList();
  } catch (err) {
    showToast('Kunne ikke laste klasser. Sjekk databasen.', 'error');
    console.error('loadClasses error:', err);
  } finally {
    document.getElementById('loading-skeleton')?.remove();
  }
}

function renderClassList() {
  const list  = document.getElementById('classes-list');
  const empty = document.getElementById('classes-empty');
  if (!list) return;

  list.innerHTML = '';
  if (_classes.length === 0) { empty?.classList.remove('hidden'); return; }
  empty?.classList.add('hidden');

  _classes.forEach(cls => {
    const el = document.createElement('div');
    el.className = 'class-list-item' + (_activeClass?.id === cls.id ? ' active' : '');
    el.dataset.id = cls.id;
    const students = parseStudents(cls.students);
    el.innerHTML = `
      <span>${escHtml(cls.name)}</span>
      <span class="badge">${students.length}</span>
    `;
    el.addEventListener('click', () => openClass(cls));
    list.appendChild(el);
  });
}

async function openClass(cls) {
  _activeClass = cls;
  _constraints = await window.api.getConstraints(cls.id);
  _students = normalizeStudents(parseStudents(cls.students));

  document.getElementById('class-detail-panel')?.classList.remove('hidden');
  document.getElementById('class-name-input').value = cls.name;
  document.getElementById('class-student-count').textContent = _students.length;

  renderStudentList(_students, onStudentListChange);
  renderConstraints(_constraints, _activeClass, onConstraintChange, _students);
  renderHistorySummary(cls.id);
  renderClassList();
}

function onStudentListChange() {
  document.getElementById('class-student-count').textContent = _students.length;
  renderStudentList(_students, onStudentListChange);
  scheduleAutoSave();
}

function onConstraintChange() {
  renderConstraints(_constraints, _activeClass, onConstraintChange, _students);
  scheduleAutoSave();
}

function setSaveStatus(state) {
  const el = document.getElementById('save-status');
  if (!el) return;
  el.className = 'save-status';
  if (state === 'saving') {
    el.textContent = 'Lagrer…';
    el.classList.add('saving');
  } else if (state === 'saved') {
    el.textContent = 'Lagret';
    el.classList.add('saved');
    setTimeout(() => { if (el.classList.contains('saved')) el.textContent = ''; }, 2500);
  } else if (state === 'unsaved') {
    el.textContent = 'Ulagrede endringer';
    el.classList.add('unsaved');
  } else {
    el.textContent = '';
  }
}

async function saveClass() {
  if (!_activeClass) return;
  const name = document.getElementById('class-name-input')?.value.trim();
  if (!name) { showToast('Klassenavn kan ikke være tomt', 'warning'); return; }

  setSaveStatus('saving');
  try {
    await window.api.saveClass({ id: _activeClass.id, name, students: JSON.stringify(_students) });
    _activeClass.name     = name;
    _activeClass.students = JSON.stringify(_students);
    await loadClasses();
    document.getElementById('class-student-count').textContent = _students.length;
    setSaveStatus('saved');
  } catch (err) {
    setSaveStatus('');
    showToast('Feil ved lagring. Prøv igjen.', 'error');
    console.error('saveClass error:', err);
  }
}

function scheduleAutoSave() {
  setSaveStatus('unsaved');
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(saveClass, 1200);
}

async function deleteClass() {
  if (!_activeClass) return;
  const ok = await showConfirm({
    title: 'Slett klasse?',
    message: `"${_activeClass.name}" og alle tilhørende data slettes permanent.`,
    confirmLabel: 'Ja, slett',
  });
  if (!ok) return;
  await window.api.deleteClass(_activeClass.id);
  _activeClass = null;
  document.getElementById('class-detail-panel')?.classList.add('hidden');
  await loadClasses();
  showToast('Klasse slettet', 'info');
}

/* ---- Events ---- */

function bindEvents() {
  document.getElementById('btn-new-class')?.addEventListener('click', async () => {
    const result = await window.api.saveClass({ id: null, name: 'Ny klasse', students: '[]' });
    await loadClasses();
    const newCls = _classes.find(c => c.id === result.lastID) ?? { id: result.lastID, name: 'Ny klasse', students: '[]' };
    openClass(newCls);
  });
  document.getElementById('btn-delete-class')?.addEventListener('click', deleteClass);
  document.getElementById('class-name-input')?.addEventListener('input', scheduleAutoSave);
  document.getElementById('btn-add-constraint')?.addEventListener('click', () =>
    addConstraint(_students, _constraints, _activeClass, onConstraintChange));
  document.getElementById('btn-view-history')?.addEventListener('click', () => {
    if (_activeClass) window.navTo('seating-history', { classId: _activeClass.id });
  });

  document.getElementById('btn-add-student')?.addEventListener('click', () => {
    const portal = getPortal();
    const backdrop = document.createElement('div');
    backdrop.className = 'kp-backdrop';
    backdrop.innerHTML = `
      <div class="kp-modal" style="min-width:300px">
        <div class="modal-header"><span class="modal-title">Legg til elev</span></div>
        <div class="form-group" style="margin-bottom:16px">
          <label class="form-label">Elevnavn</label>
          <input id="new-student-name" type="text" class="input input-bordered w-full" placeholder="Ola Nordmann" autofocus>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="new-student-cancel">Avbryt</button>
          <button class="btn btn-primary" id="new-student-save">Legg til</button>
        </div>
      </div>`;
    portal.appendChild(backdrop);
    const input = backdrop.querySelector('#new-student-name');
    focusAfterRender(input);
    const doAdd = () => {
      const name = input?.value.trim();
      if (!name) return;
      _students.push({ id: `new-${Date.now()}`, name, note: '', placement: null });
      document.getElementById('class-student-count').textContent = _students.length;
      renderStudentList(_students, onStudentListChange);
      scheduleAutoSave();
      backdrop.remove();
    };
    backdrop.querySelector('#new-student-cancel').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('#new-student-save').addEventListener('click', doAdd);
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') backdrop.remove(); });
  });

  document.getElementById('btn-toggle-bulk')?.addEventListener('click', () => {
    const portal = getPortal();
    const backdrop = document.createElement('div');
    backdrop.className = 'kp-backdrop';
    backdrop.innerHTML = `
      <div class="kp-modal" style="min-width:380px">
        <div class="modal-header"><span class="modal-title">Importer elevliste</span></div>
        <p style="font-size:13px;color:oklch(var(--bc)/0.6);margin-bottom:10px">
          Lim inn eller skriv ett elevnavn per linje. Eksisterende notater og prioriteter beholdes for elever som allerede finnes i listen.
        </p>
        <textarea id="bulk-import-input" class="students-textarea"
          placeholder="Ola Nordmann&#10;Kari Hansen&#10;..."
          style="min-height:180px"></textarea>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="bulk-cancel">Avbryt</button>
          <button class="btn btn-primary" id="bulk-apply"><i class="fa-solid fa-check"></i> Bruk liste</button>
        </div>
      </div>`;
    portal.appendChild(backdrop);

    const textarea = backdrop.querySelector('#bulk-import-input');
    textarea.value = _students.map(s => s.name).join('\n');
    focusAfterRender(textarea);

    backdrop.querySelector('#bulk-cancel').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('#bulk-apply').addEventListener('click', () => {
      const raw   = textarea?.value ?? '';
      const names = raw.split('\n').map(s => s.trim()).filter(Boolean);
      const existing = Object.fromEntries(_students.map(s => [s.name, s]));
      _students = names.map((name, i) =>
        existing[name] ?? { id: `new-${Date.now()}-${i}`, name, note: '', placement: null }
      );
      document.getElementById('class-student-count').textContent = _students.length;
      renderStudentList(_students, onStudentListChange);
      scheduleAutoSave();
      backdrop.remove();
    });
  });
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
