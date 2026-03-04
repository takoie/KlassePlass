/**
 * classes.js — Klasse- og elevadministrasjon.
 * Studentliste med notater, plasseringsprioritet og constraints.
 */

import { showToast } from '../shared/utils.js';

let _classes    = [];
let _activeClass = null;
let _constraints = [];
let _students   = [];  // Normalized student objects for active class

const PLACEMENT_OPTIONS = [
  { value: 'front',      icon: '⬆', label: 'Fremst' },
  { value: 'back',       icon: '⬇', label: 'Bakerst' },
  { value: 'middle',     icon: '⬛', label: 'Midten' },
  { value: 'never-front', icon: '🚫⬆', label: 'Aldri fremst' },
  { value: 'never-back',  icon: '🚫⬇', label: 'Aldri bakerst' },
];

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
  _students = normalizeStudentsLocal(parseStudents(cls.students));

  document.getElementById('class-detail-panel')?.classList.remove('hidden');
  document.getElementById('class-name-input').value = cls.name;
  document.getElementById('class-student-count').textContent = _students.length;

  renderStudentList();
  renderConstraints();
  renderHistorySummary(cls.id);
  renderClassList();
}

/* ---- Student list rendering ---- */

function renderStudentList() {
  const list  = document.getElementById('student-list');
  const empty = document.getElementById('student-list-empty');
  if (!list) return;

  list.innerHTML = '';

  if (_students.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  _students.forEach((student, idx) => {
    const row = document.createElement('div');
    row.className = 'student-row';
    row.dataset.idx = idx;

    const activePlacement = student.placement ?? null;

    row.innerHTML = `
      <div class="student-row-main">
        <span class="student-name">${escHtml(student.name)}</span>
        ${student.note ? `<span class="student-note-chip" title="${escHtml(student.note)}"><i class="fa-solid fa-note-sticky"></i></span>` : ''}
        <button class="btn btn-ghost btn-xs btn-note-edit" data-idx="${idx}" title="Rediger notat">
          <i class="fa-solid fa-pencil"></i>
        </button>
      </div>
      <div class="student-placement-row">
        ${PLACEMENT_OPTIONS.map(opt => `
          <button class="placement-btn${activePlacement === opt.value ? ' active' : ''}"
            data-idx="${idx}" data-placement="${opt.value}" title="${escHtml(opt.label)}">
            ${opt.icon}
          </button>
        `).join('')}
        ${activePlacement ? `<button class="placement-btn placement-clear" data-idx="${idx}" title="Fjern prioritet">✕</button>` : ''}
      </div>
    `;

    row.querySelectorAll('.placement-btn[data-placement]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.idx, 10);
        const val = btn.dataset.placement;
        _students[i].placement = _students[i].placement === val ? null : val;
        document.getElementById('class-student-count').textContent = _students.length;
        renderStudentList();
      });
    });

    const clearBtn = row.querySelector('.placement-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const i = parseInt(clearBtn.dataset.idx, 10);
        _students[i].placement = null;
        renderStudentList();
      });
    }

    row.querySelector('.btn-note-edit').addEventListener('click', () => openNoteModal(idx));

    list.appendChild(row);
  });
}

function openNoteModal(idx) {
  const student = _students[idx];
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Notat for ${escHtml(student.name)}</span>
      </div>
      <textarea id="note-input" class="students-textarea" rows="4"
        placeholder="F.eks: ADHD – sitter best fremst til venstre"
        style="min-height:80px">${escHtml(student.note ?? '')}</textarea>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="note-cancel">Avbryt</button>
        <button class="btn btn-primary" id="note-save">Lagre</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelector('#note-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#note-save').addEventListener('click', () => {
    _students[idx].note = backdrop.querySelector('#note-input').value.trim();
    backdrop.remove();
    renderStudentList();
  });
}

/* ---- Constraints ---- */

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
      <button class="btn btn-ghost btn-sm btn-icon btn-del-constraint" data-id="${c.id}" title="Slett regel">
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

/* ---- Save ---- */

async function saveClass() {
  if (!_activeClass) return;
  const name = document.getElementById('class-name-input')?.value.trim();
  if (!name) { showToast('Skriv inn klassenavn', 'error'); return; }

  await window.api.saveClass({
    id: _activeClass.id,
    name,
    students: JSON.stringify(_students),
  });

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

async function addConstraint() {
  if (!_activeClass) return;
  const names = _students.map(s => s.name);

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header"><span class="modal-title">Ny plasserings-regel</span></div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Elev A</label>
        <select id="c-student-a" class="select select-bordered w-full">
          ${names.map(n => `<option>${escHtml(n)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Elev B</label>
        <select id="c-student-b" class="select select-bordered w-full">
          ${names.map(n => `<option>${escHtml(n)}</option>`).join('')}
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
  document.getElementById('btn-add-constraint')?.addEventListener('click', addConstraint);
  document.getElementById('btn-view-history')?.addEventListener('click', () => {
    if (_activeClass) window.navTo('seating-history', { classId: _activeClass.id });
  });

  document.getElementById('btn-add-student')?.addEventListener('click', () => {
    const name = prompt('Elevnavn:')?.trim();
    if (!name) return;
    _students.push({ id: `new-${Date.now()}`, name, note: '', placement: null });
    document.getElementById('class-student-count').textContent = _students.length;
    renderStudentList();
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
    const raw = document.getElementById('class-students-input')?.value ?? '';
    const names = raw.split('\n').map(s => s.trim()).filter(Boolean);
    const existing = Object.fromEntries(_students.map(s => [s.name, s]));
    _students = names.map((name, i) =>
      existing[name] ?? { id: `new-${Date.now()}-${i}`, name, note: '', placement: null }
    );
    document.getElementById('class-student-count').textContent = _students.length;
    document.getElementById('student-bulk-view').classList.add('hidden');
    document.getElementById('student-list-view').classList.remove('hidden');
    renderStudentList();
  });
}

/* ---- Helpers ---- */

function parseStudents(raw) {
  if (!raw) return [];
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(p) ? p : String(raw).split('\n').filter(Boolean);
  } catch { return String(raw).split('\n').filter(Boolean); }
}

function normalizeStudentsLocal(arr) {
  return arr.map((s, i) => {
    if (typeof s === 'string') return { id: `s-${i}-${s}`, name: s, note: '', placement: null };
    return { placement: null, note: '', ...s, id: s.id ?? `s-${i}` };
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
