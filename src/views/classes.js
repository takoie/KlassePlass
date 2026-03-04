/**
 * classes.js — Klasse- og elevadministrasjon + constraints.
 */

import { showToast, normalizeStudents } from '../shared/utils.js';

let _classes    = [];
let _activeClass = null;
let _constraints = [];

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
        <span id="class-student-count" class="badge"></span>
      </div>
      <textarea id="class-students-input" class="students-textarea"
        placeholder="Skriv ett elevnavn per linje&#10;Ola Nordmann&#10;Kari Hansen&#10;..."></textarea>
      <div class="form-hint">Én elev per linje. Tomme linjer ignoreres.</div>
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
  unmount() { _activeClass = null; },
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

  document.getElementById('class-detail-panel')?.classList.remove('hidden');
  document.getElementById('class-name-input').value = cls.name;

  const students = normalizeStudents(parseStudents(cls.students));
  document.getElementById('class-students-input').value = students.map(s => s.name).join('\n');
  document.getElementById('class-student-count').textContent = students.length;

  renderConstraints();
  renderHistorySummary(cls.id);
  renderClassList(); // Refresh active state
}

function renderConstraints() {
  const list  = document.getElementById('constraints-list');
  const empty = document.getElementById('constraints-empty');
  if (!list) return;

  list.innerHTML = '';

  if (_constraints.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  _constraints.forEach(c => {
    const el = document.createElement('div');
    el.className = 'constraint-item';
    const typeLabel = c.type === 'always_together' ? 'Alltid sammen' : 'Aldri sammen';
    const badgeCls  = c.type === 'always_together' ? 'badge-always' : 'badge-never';
    el.innerHTML = `
      <span class="constraint-type-badge ${badgeCls}">${typeLabel}</span>
      <span style="flex:1;font-size:12px">${escHtml(c.student_a)} og ${escHtml(c.student_b)}</span>
      <button class="btn btn-ghost btn-sm btn-icon btn-del-constraint" data-id="${c.id}">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;
    el.querySelector('.btn-del-constraint').addEventListener('click', async () => {
      await window.api.deleteConstraint(c.id);
      _constraints = _constraints.filter(x => x.id !== c.id);
      renderConstraints();
    });
    list.appendChild(el);
  });
}

async function renderHistorySummary(classId) {
  const summary = document.getElementById('class-history-summary');
  if (!summary) return;
  const history = await window.api.getHistory(classId, 5);
  summary.textContent = history.length
    ? `${history.length} klassekart i historikken`
    : 'Ingen historikk ennå';
}

async function saveClass() {
  if (!_activeClass) return;

  const name     = document.getElementById('class-name-input')?.value.trim();
  const rawText  = document.getElementById('class-students-input')?.value ?? '';
  const students = rawText.split('\n').map(s => s.trim()).filter(Boolean);

  if (!name) { showToast('Skriv inn klassenavn', 'error'); return; }

  await window.api.saveClass({
    id: _activeClass.id,
    name,
    students: JSON.stringify(students),
  });

  _activeClass.name     = name;
  _activeClass.students = JSON.stringify(students);
  await loadClasses();
  document.getElementById('class-student-count').textContent = students.length;
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

async function addConstraint() {
  if (!_activeClass) return;

  const students = normalizeStudents(parseStudents(_activeClass.students));
  const names    = students.map(s => s.name);

  // Enkel modal
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header"><span class="modal-title">Ny plasserings-regel</span></div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Elev A</label>
        <select id="c-student-a" class="form-input">
          ${names.map(n => `<option>${escHtml(n)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Elev B</label>
        <select id="c-student-b" class="form-input">
          ${names.map(n => `<option>${escHtml(n)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Type</label>
        <select id="c-type" class="form-input">
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
  document.body.appendChild(backdrop);

  backdrop.querySelector('#c-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#c-save').addEventListener('click', async () => {
    const a    = backdrop.querySelector('#c-student-a').value;
    const b    = backdrop.querySelector('#c-student-b').value;
    const type = backdrop.querySelector('#c-type').value;
    if (a === b) { showToast('Velg to forskjellige elever', 'error'); return; }
    const result = await window.api.saveConstraint({ classId: _activeClass.id, studentA: a, studentB: b, type });
    _constraints.push({ id: result.lastID, class_id: _activeClass.id, student_a: a, student_b: b, type });
    renderConstraints();
    backdrop.remove();
    showToast('Regel lagt til', 'success');
  });
}

function bindEvents() {
  document.getElementById('btn-new-class')?.addEventListener('click', async () => {
    const result = await window.api.saveClass({ id: null, name: 'Ny klasse', students: '[]' });
    await loadClasses();
    const newCls = _classes.find(c => c.id === result.lastID) ?? { id: result.lastID, name: 'Ny klasse', students: '[]' };
    openClass(newCls);
  });
  document.getElementById('btn-save-class')?.addEventListener('click', saveClass);
  document.getElementById('btn-delete-class')?.addEventListener('click', deleteClass);
  document.getElementById('btn-add-constraint')?.addEventListener('click', addConstraint);
  document.getElementById('btn-view-history')?.addEventListener('click', () => {
    if (_activeClass) window.navTo('seating-history', { classId: _activeClass.id });
  });

  document.getElementById('class-students-input')?.addEventListener('input', () => {
    const raw = document.getElementById('class-students-input')?.value ?? '';
    const count = raw.split('\n').map(s => s.trim()).filter(Boolean).length;
    document.getElementById('class-student-count').textContent = count;
  });
}

function parseStudents(raw) {
  if (!raw) return [];
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(p) ? p : String(raw).split('\n').filter(Boolean);
  } catch { return String(raw).split('\n').filter(Boolean); }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
