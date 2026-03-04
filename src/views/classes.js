/**
 * classes.js — Klasse- og elevadministrasjon: liste, åpne/lagre/slette klasser.
 * Elevliste, notater, constraints og historikk: classes-student-panel.js
 */

import { showToast, normalizeStudents } from '../shared/utils.js';
import {
  renderStudentList, renderConstraints, renderHistorySummary,
  addConstraint, parseStudents,
} from './classes-student-panel.js';

let _classes     = [];
let _activeClass = null;
let _constraints = [];
let _students    = [];  // Normalized student objects for active class

const TEMPLATE = `
<div class="view-header">
  <div>
    <h1 class="view-title">Klasser</h1>
    <p class="view-subtitle">Administrer klasser og elevlister</p>
  </div>
  <button class="btn btn-secondary btn-sm" id="btn-new-class">
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
      <div style="display:flex;gap:6px">
        <button class="btn btn-error btn-sm btn-outline" id="btn-delete-class"><i class="fa-solid fa-trash"></i></button>
        <button class="btn btn-primary btn-sm" id="btn-save-class">
          <i class="fa-solid fa-floppy-disk"></i> Lagre
        </button>
      </div>
    </div>

    <div class="student-editor">
      <div class="student-editor-header">
        <span style="font-weight:600;font-size:13px">Elever</span>
        <div style="display:flex;gap:6px;align-items:center">
          <span id="class-student-count" class="badge"></span>
          <button class="btn btn-ghost btn-xs" id="btn-toggle-bulk" title="Bulk-rediger elevliste">
            <i class="fa-solid fa-list"></i>
          </button>
        </div>
      </div>

      <div id="student-list-view">
        <div id="student-list"></div>
        <div id="student-list-empty" class="empty-state-inline hidden">Ingen elever ennå.</div>
        <button class="btn btn-ghost btn-xs" id="btn-add-student" style="margin-top:6px">
          <i class="fa-solid fa-plus"></i> Legg til elev
        </button>
      </div>

      <div id="student-bulk-view" class="hidden">
        <textarea id="class-students-input" class="students-textarea"
          placeholder="Skriv ett elevnavn per linje&#10;Ola Nordmann&#10;Kari Hansen&#10;..."></textarea>
        <div class="form-hint">Én elev per linje. Eksisterende notater og prioriteter beholdes.</div>
        <button class="btn btn-ghost btn-xs" id="btn-apply-bulk" style="margin-top:6px">
          <i class="fa-solid fa-check"></i> Bruk liste
        </button>
      </div>
    </div>

    <div class="constraints-section">
      <div class="section-header">
        <span style="font-weight:600;font-size:13px">Plasserings-regler</span>
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
        <span style="font-weight:600;font-size:13px">Historikk</span>
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

async function loadClasses() {
  _classes = await window.api.getClasses();
  renderClassList();
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
  renderConstraints(_constraints, _activeClass, onConstraintChange);
  renderHistorySummary(cls.id);
  renderClassList();
}

function onStudentListChange() {
  document.getElementById('class-student-count').textContent = _students.length;
  renderStudentList(_students, onStudentListChange);
}

function onConstraintChange() {
  renderConstraints(_constraints, _activeClass, onConstraintChange);
}

async function saveClass() {
  if (!_activeClass) return;
  const name = document.getElementById('class-name-input')?.value.trim();
  if (!name) { showToast('Skriv inn klassenavn', 'error'); return; }

  await window.api.saveClass({ id: _activeClass.id, name, students: JSON.stringify(_students) });
  _activeClass.name     = name;
  _activeClass.students = JSON.stringify(_students);
  await loadClasses();
  document.getElementById('class-student-count').textContent = _students.length;
  showToast('Klasse lagret!', 'success');
}

async function deleteClass() {
  if (!_activeClass) return;
  if (!confirm(`Slett klassen "${_activeClass.name}"? Dette kan ikke angres.`)) return;
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
  document.getElementById('btn-save-class')?.addEventListener('click', saveClass);
  document.getElementById('btn-delete-class')?.addEventListener('click', deleteClass);
  document.getElementById('btn-add-constraint')?.addEventListener('click', () =>
    addConstraint(_students, _constraints, _activeClass, onConstraintChange));
  document.getElementById('btn-view-history')?.addEventListener('click', () => {
    if (_activeClass) window.navTo('seating-history', { classId: _activeClass.id });
  });

  document.getElementById('btn-add-student')?.addEventListener('click', () => {
    const name = prompt('Elevnavn:')?.trim();
    if (!name) return;
    _students.push({ id: `new-${Date.now()}`, name, note: '', placement: null });
    document.getElementById('class-student-count').textContent = _students.length;
    renderStudentList(_students, onStudentListChange);
  });

  document.getElementById('btn-toggle-bulk')?.addEventListener('click', () => {
    const listView = document.getElementById('student-list-view');
    const bulkView = document.getElementById('student-bulk-view');
    const isShowing = !bulkView.classList.contains('hidden');
    if (isShowing) {
      bulkView.classList.add('hidden');
      listView.classList.remove('hidden');
    } else {
      document.getElementById('class-students-input').value = _students.map(s => s.name).join('\n');
      listView.classList.add('hidden');
      bulkView.classList.remove('hidden');
    }
  });

  document.getElementById('btn-apply-bulk')?.addEventListener('click', () => {
    const raw   = document.getElementById('class-students-input')?.value ?? '';
    const names = raw.split('\n').map(s => s.trim()).filter(Boolean);
    const existing = Object.fromEntries(_students.map(s => [s.name, s]));
    _students = names.map((name, i) =>
      existing[name] ?? { id: `new-${Date.now()}-${i}`, name, note: '', placement: null }
    );
    document.getElementById('class-student-count').textContent = _students.length;
    document.getElementById('student-bulk-view').classList.add('hidden');
    document.getElementById('student-list-view').classList.remove('hidden');
    renderStudentList(_students, onStudentListChange);
  });
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
