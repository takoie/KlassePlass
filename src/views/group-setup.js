/**
 * group-setup.js — Oppsett for gruppearbeid (steg 1).
 * Velg klasse, kilde, antall grupper og innstillinger.
 */

import { normalizeStudents, showToast } from '../shared/utils.js';

const TEMPLATE = `
<div class="view-header">
  <div>
    <h1 class="view-title">Gruppearbeid</h1>
    <p class="view-subtitle">Generer tilfeldige grupper for klassen</p>
  </div>
  <button class="btn btn-ghost btn-sm" id="btn-gs-cancel">
    <i class="fa-solid fa-arrow-left"></i> Avbryt
  </button>
</div>
<div class="setup-form">
  <div class="form-group">
    <label class="form-label">Navn på inndelingen</label>
    <input type="text" id="gs-name" class="input input-bordered w-full" placeholder="f.eks. Prosjektgrupper uke 12">
  </div>

  <div class="form-group">
    <label class="form-label">Klasse</label>
    <select id="gs-class" class="select select-bordered w-full"><option value="">Velg klasse...</option></select>
    <div id="gs-class-info" class="form-hint hidden"></div>
  </div>

  <div class="form-group">
    <label class="form-label">Kilde for elevliste</label>
    <div style="display:flex;flex-direction:column;gap:8px">
      <label class="flex items-center gap-2 cursor-pointer text-sm">
        <input type="radio" name="gs-source" id="gs-source-class" value="class" class="radio radio-sm" checked>
        Alle elever i klassen
      </label>
      <label class="flex items-center gap-2 cursor-pointer text-sm">
        <input type="radio" name="gs-source" id="gs-source-seating" value="seating" class="radio radio-sm">
        Fra eksisterende klassekart
      </label>
    </div>
    <select id="gs-seating" class="select select-bordered w-full mt-2 hidden">
      <option value="">Velg klassekart...</option>
    </select>
  </div>

  <div class="form-group">
    <label class="form-label">Antall grupper</label>
    <div style="display:flex;align-items:center;gap:8px">
      <input type="number" id="gs-num-groups" class="input input-bordered input-sm" value="4" min="2" max="30" style="width:80px">
      <span id="gs-group-size-hint" class="text-sm opacity-60"></span>
    </div>
  </div>

  <div class="form-group">
    <label class="form-label">Regler og historikk</label>
    <div style="display:flex;flex-direction:column;gap:8px">
      <label class="flex items-center gap-2 cursor-pointer text-sm">
        <input type="checkbox" id="gs-use-constraints" class="checkbox checkbox-sm" checked>
        Respekter plasserings-regler (aldri/alltid sammen)
      </label>
      <label class="flex items-center gap-2 cursor-pointer text-sm">
        <input type="checkbox" id="gs-avoid-toggle" class="checkbox checkbox-sm" checked>
        Unngå nylige gruppekombinasjoner — siste
        <input type="number" id="gs-avoid-n" class="input input-bordered input-sm" value="3" min="1" max="20" style="width:60px">
        runder
      </label>
    </div>
  </div>

  <div class="form-group">
    <label class="form-label">Gruppeledere</label>
    <label class="flex items-center gap-2 cursor-pointer text-sm">
      <input type="checkbox" id="gs-require-leaders" class="checkbox checkbox-sm">
      Krev gruppeleder — én leder per gruppe
    </label>
    <div id="gs-leaders-section" class="hidden" style="margin-top:12px">
      <div class="form-hint" style="margin-bottom:8px">Velg hvem som er gruppeleder. De blir automatisk spredt til ulike grupper.</div>
      <div id="gs-leaders-list" style="display:flex;flex-wrap:wrap;gap:6px"></div>
      <div id="gs-leader-warning" class="alert alert-warning hidden" style="margin-top:8px">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span id="gs-leader-warning-msg"></span>
      </div>
    </div>
  </div>

  <div class="form-actions">
    <button class="btn btn-ghost" id="btn-gs-cancel2">Avbryt</button>
    <button class="btn btn-secondary" id="btn-gs-generate" disabled>
      <i class="fa-solid fa-wand-magic-sparkles"></i> Generer grupper
    </button>
  </div>
</div>`;

let _classes = [];
let _seatings = [];
let _selectedLeaders = new Set();

export const groupSetupView = {
  async mount(container) {
    _classes = [];
    _seatings = [];
    _selectedLeaders = new Set();

    container.innerHTML = TEMPLATE;
    await loadData();
    bindEvents();
  },
  unmount() {
    _classes = [];
    _seatings = [];
    _selectedLeaders = new Set();
  },
};

async function loadData() {
  _classes = await window.api.getClasses();
  const clsSel = document.getElementById('gs-class');
  _classes.forEach(c => {
    const students = parseStudents(c.students);
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${students.length} elever)`;
    opt.dataset.count = students.length;
    clsSel.appendChild(opt);
  });

  const today = new Date().toLocaleDateString('no-NO', { day: '2-digit', month: 'short' });
  document.getElementById('gs-name').placeholder = `f.eks. Gruppearbeid — ${today}`;
}

async function loadSeatingsForClass(classId) {
  const seatingsSel = document.getElementById('gs-seating');
  seatingsSel.innerHTML = '<option value="">Velg klassekart...</option>';
  if (!classId) return;

  _seatings = await window.api.getSeatings(classId);
  _seatings.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    seatingsSel.appendChild(opt);
  });
}

function renderLeadersList(classId) {
  const container = document.getElementById('gs-leaders-list');
  if (!container) return;
  container.innerHTML = '';
  _selectedLeaders.clear();

  if (!classId) return;
  const cls = _classes.find(c => String(c.id) === String(classId));
  if (!cls) return;

  const students = normalizeStudents(parseStudents(cls.students));
  students.forEach(s => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'btn btn-xs btn-outline';
    chip.dataset.studentId = s.id;
    chip.innerHTML = `<i class="fa-solid fa-user"></i> ${s.name}`;
    chip.addEventListener('click', () => {
      if (_selectedLeaders.has(s.id)) {
        _selectedLeaders.delete(s.id);
        chip.classList.remove('btn-primary');
        chip.classList.add('btn-outline');
      } else {
        _selectedLeaders.add(s.id);
        chip.classList.remove('btn-outline');
        chip.classList.add('btn-primary');
      }
      updateLeaderWarning();
    });
    container.appendChild(chip);
  });
}

function updateLeaderWarning() {
  const numGroups = parseInt(document.getElementById('gs-num-groups')?.value ?? 4);
  const leaderCount = _selectedLeaders.size;
  const warning = document.getElementById('gs-leader-warning');
  const msg = document.getElementById('gs-leader-warning-msg');
  if (!warning || !msg) return;

  if (leaderCount === 0) {
    warning.classList.add('hidden');
  } else if (leaderCount !== numGroups) {
    msg.textContent = leaderCount < numGroups
      ? `Du har ${leaderCount} leder(e) men ${numGroups} grupper — noen grupper får ikke leder.`
      : `Du har ${leaderCount} ledere men bare ${numGroups} grupper — noen ledere blir ikke satt som leder.`;
    warning.classList.remove('hidden');
  } else {
    warning.classList.add('hidden');
  }
}

function bindEvents() {
  const clsSel = document.getElementById('gs-class');
  const numGroupsInput = document.getElementById('gs-num-groups');
  const requireLeadersChk = document.getElementById('gs-require-leaders');
  const avoidToggle = document.getElementById('gs-avoid-toggle');
  const sourceRadios = document.querySelectorAll('input[name="gs-source"]');

  clsSel?.addEventListener('change', async () => {
    const classId = clsSel.value;
    const info = document.getElementById('gs-class-info');
    const opt = clsSel.options[clsSel.selectedIndex];
    if (info && opt?.dataset.count) {
      info.textContent = `${opt.dataset.count} elever`;
      info.classList.remove('hidden');
    } else {
      info?.classList.add('hidden');
    }

    await loadSeatingsForClass(classId);
    renderLeadersList(classId);
    updateGroupSizeHint();
    validateForm();
  });

  numGroupsInput?.addEventListener('input', () => {
    updateGroupSizeHint();
    updateLeaderWarning();
    validateForm();
  });

  requireLeadersChk?.addEventListener('change', () => {
    const section = document.getElementById('gs-leaders-section');
    section?.classList.toggle('hidden', !requireLeadersChk.checked);
    validateForm();
  });

  avoidToggle?.addEventListener('change', () => {
    const avoidN = document.getElementById('gs-avoid-n');
    if (avoidN) avoidN.disabled = !avoidToggle.checked;
  });

  sourceRadios.forEach(r => {
    r.addEventListener('change', () => {
      const seatingRow = document.getElementById('gs-seating');
      seatingRow?.classList.toggle('hidden', r.value !== 'seating');
      validateForm();
    });
  });

  document.getElementById('gs-seating')?.addEventListener('change', validateForm);
  document.getElementById('gs-name')?.addEventListener('input', validateForm);

  document.getElementById('btn-gs-generate')?.addEventListener('click', generate);
  document.getElementById('btn-gs-cancel')?.addEventListener('click', () => window.navTo('charts-dashboard'));
  document.getElementById('btn-gs-cancel2')?.addEventListener('click', () => window.navTo('charts-dashboard'));
}

function updateGroupSizeHint() {
  const classId = document.getElementById('gs-class')?.value;
  const numGroups = parseInt(document.getElementById('gs-num-groups')?.value ?? 4);
  const hint = document.getElementById('gs-group-size-hint');
  if (!hint || !classId || !numGroups) return;

  const cls = _classes.find(c => String(c.id) === String(classId));
  if (!cls) return;
  const studentCount = parseStudents(cls.students).length;
  if (!studentCount || !numGroups) return;

  const base = Math.floor(studentCount / numGroups);
  const extra = studentCount % numGroups;
  if (extra === 0) {
    hint.textContent = `≈ ${base} elever per gruppe`;
  } else {
    hint.textContent = `≈ ${base}–${base + 1} elever per gruppe`;
  }
}

function validateForm() {
  const name = document.getElementById('gs-name')?.value.trim();
  const classId = document.getElementById('gs-class')?.value;
  const numGroups = parseInt(document.getElementById('gs-num-groups')?.value ?? 0);
  const sourceSeating = document.querySelector('input[name="gs-source"]:checked')?.value === 'seating';
  const seatingId = document.getElementById('gs-seating')?.value;

  const btn = document.getElementById('btn-gs-generate');
  const valid = name && classId && numGroups >= 2 && (!sourceSeating || seatingId);
  if (btn) btn.disabled = !valid;
}

async function generate() {
  const name = document.getElementById('gs-name')?.value.trim();
  const classId = parseInt(document.getElementById('gs-class')?.value);
  const numGroups = parseInt(document.getElementById('gs-num-groups')?.value ?? 4);
  const useConstraints = document.getElementById('gs-use-constraints')?.checked ?? true;
  const avoidToggle = document.getElementById('gs-avoid-toggle')?.checked ?? true;
  const avoidLastN = avoidToggle ? parseInt(document.getElementById('gs-avoid-n')?.value ?? 3) : 0;
  const requireLeaders = document.getElementById('gs-require-leaders')?.checked ?? false;
  const sourceValue = document.querySelector('input[name="gs-source"]:checked')?.value ?? 'class';
  const sourceSeatingId = sourceValue === 'seating'
    ? parseInt(document.getElementById('gs-seating')?.value) || null
    : null;

  if (!name || !classId || numGroups < 2) return;

  const cls = await window.api.getClass(classId);
  if (!cls) { showToast('Klassen ble ikke funnet', 'error'); return; }

  let students;
  if (sourceSeatingId) {
    const seating = await window.api.getSeating(sourceSeatingId);
    if (!seating) { showToast('Klassekart ble ikke funnet', 'error'); return; }
    // Hent elevene som faktisk sitter i kartet
    const placements = JSON.parse(seating.placements ?? '[]');
    const seatedIds = new Set();
    placements.forEach(desk => {
      (desk.slots ?? []).forEach(slot => {
        if (slot?.studentId) seatedIds.add(slot.studentId);
      });
    });
    const allStudents = normalizeStudents(parseStudents(cls.students));
    students = allStudents.filter(s => seatedIds.has(s.id));
    if (students.length === 0) {
      showToast('Ingen elever funnet i det valgte klassekartet', 'error');
      return;
    }
  } else {
    students = normalizeStudents(parseStudents(cls.students));
  }

  if (students.length < numGroups) {
    showToast(`For få elever (${students.length}) til ${numGroups} grupper`, 'error');
    return;
  }

  window.navTo('group-editor', {
    mode: 'new',
    name,
    classId,
    sourceSeatingId,
    students,
    numGroups,
    useConstraints,
    avoidLastN,
    requireLeaders,
    leaderIds: [..._selectedLeaders],
  });
}

function parseStudents(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : String(raw).split('\n').filter(Boolean);
  } catch {
    return String(raw).split('\n').filter(Boolean);
  }
}
