/**
 * group-editor.js — Rediger og lagre gruppeinndelinger.
 */

import { normalizeStudents, showToast } from '../shared/utils.js';
import { generateGroups, buildGroupPairs } from '../shared/groupRandomizer.js';

// 8 gruppefarger (samme palett som desk-group i seating-editor)
const GROUP_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

let _state = null;
let _dragSourceGroupIdx = null;
let _dragSourceStudentId = null;

export const groupEditorView = {
  async mount(container, params) {
    _state = null;
    await initState(params);
    container.innerHTML = buildTemplate();
    attachStyles();
    render();
    bindToolbar();
  },
  unmount() {
    _state = null;
    _dragSourceGroupIdx = null;
    _dragSourceStudentId = null;
  },
};

// ---------------------------------------------------------------------------
// State init
// ---------------------------------------------------------------------------

async function initState(params) {
  const { mode, name, classId, sourceSeatingId, students, numGroups,
    useConstraints, avoidLastN, requireLeaders, leaderIds } = params;

  const studentsById = {};
  const normalized = normalizeStudents(students);
  normalized.forEach(s => { studentsById[s.id] = s; });

  // Hent constraints
  const rawConstraints = await window.api.getConstraints(classId);

  // Hent historikk-par
  let recentPairs = [];
  if (avoidLastN > 0) {
    const histRows = await window.api.getGroupHistory(classId, avoidLastN);
    recentPairs = histRows.flatMap(row => {
      try { return JSON.parse(row.pairs); } catch { return []; }
    });
  }

  _state = {
    mode,                        // 'new' | 'existing'
    name,
    classId,
    sourceSeatingId: sourceSeatingId ?? null,
    students: normalized,
    studentsById,
    constraints: rawConstraints ?? [],
    numGroups,
    groups: [],                  // string[][]
    lockedPlacements: [],        // [{ studentId, groupIndex }]
    leaderIds: leaderIds ?? [],
    requireLeaders: requireLeaders ?? false,
    useConstraints: useConstraints ?? true,
    avoidLastN: avoidLastN ?? 3,
    recentPairs,
    assignmentId: null,
    saved: false,
  };

  // Initial randomisering
  randomize();
}

// ---------------------------------------------------------------------------
// Randomisering
// ---------------------------------------------------------------------------

function randomize() {
  if (!_state) return;
  const result = generateGroups({
    studentIds: _state.students.map(s => s.id),
    studentsById: _state.studentsById,
    numGroups: _state.numGroups,
    constraints: _state.constraints,
    useConstraints: _state.useConstraints,
    lockedPlacements: _state.lockedPlacements,
    leaderIds: _state.leaderIds,
    requireLeaders: _state.requireLeaders,
    recentPairs: _state.recentPairs,
  });
  _state.groups = result.groups;
  _state.saved = false;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function buildTemplate() {
  return `
<div style="display:flex;flex-direction:column;height:100%">
  <div class="view-header" style="padding-bottom:0;border-bottom:none">
    <div style="display:flex;align-items:center;gap:10px;flex:1">
      <button class="btn btn-ghost btn-sm" id="ge-btn-back">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div>
        <h1 class="view-title" id="ge-title"></h1>
        <p class="view-subtitle" id="ge-subtitle"></p>
      </div>
    </div>
    <div class="ge-toolbar-actions">
      <label class="flex items-center gap-2 cursor-pointer text-sm" title="Respekter plasserings-regler">
        <input type="checkbox" id="ge-toggle-constraints" class="checkbox checkbox-sm">
        <span>Regler</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer text-sm" title="Krev én leder per gruppe">
        <input type="checkbox" id="ge-toggle-leaders" class="checkbox checkbox-sm">
        <span>Ledere</span>
      </label>
      <button class="btn btn-ghost btn-sm" id="ge-btn-reshuffle" title="Generer på nytt">
        <i class="fa-solid fa-shuffle"></i> Generer på nytt
      </button>
      <button class="btn btn-ghost btn-sm" id="ge-btn-leaders-modal" title="Velg gruppeledere">
        <i class="fa-solid fa-user-tie"></i>
      </button>
      <button class="btn btn-primary btn-sm" id="ge-btn-save">
        <i class="fa-solid fa-floppy-disk"></i> Lagre
      </button>
    </div>
  </div>

  <div id="ge-groups-container" class="ge-groups-container"></div>
  <div id="ge-summary" class="ge-summary"></div>
</div>

<!-- Leaders modal -->
<div id="ge-leaders-modal" class="kp-backdrop hidden">
  <div class="kp-modal">
    <div class="modal-header">
      <span class="modal-title">Velg gruppeledere</span>
      <button class="btn btn-ghost btn-sm" id="ge-leaders-modal-close">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="form-hint" style="margin-bottom:12px">
      Valgte ledere plasseres automatisk i ulike grupper ved generering.
    </div>
    <div id="ge-leaders-picker" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    <div id="ge-leaders-modal-warning" class="alert alert-warning hidden" style="margin-top:12px">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span id="ge-leaders-modal-warning-msg"></span>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary btn-sm" id="ge-leaders-modal-ok">OK</button>
    </div>
  </div>
</div>`;
}

function render() {
  if (!_state) return;
  renderTitle();
  renderGroups();
  renderSummary();
  syncToolbarToggles();
}

function renderTitle() {
  const el = document.getElementById('ge-title');
  const sub = document.getElementById('ge-subtitle');
  if (el) el.textContent = _state.name;
  if (sub) {
    const cls = _state.students.length;
    sub.textContent = `${cls} elever · ${_state.numGroups} grupper`;
  }
}

function renderGroups() {
  const container = document.getElementById('ge-groups-container');
  if (!container) return;
  container.innerHTML = '';

  if (!_state.groups.length) {
    container.innerHTML = '<div class="ge-empty"><i class="fa-solid fa-people-group fa-2x"></i><span>Ingen grupper generert</span></div>';
    return;
  }

  _state.groups.forEach((group, gi) => {
    const card = buildGroupCard(group, gi);
    container.appendChild(card);
  });
}

function buildGroupCard(group, gi) {
  const colorIdx = gi % GROUP_COLORS.length;
  const color = GROUP_COLORS[colorIdx];

  const card = document.createElement('div');
  card.className = 'ge-group-card';
  card.dataset.groupIdx = gi;
  card.dataset.color = colorIdx;

  // Drop target events
  card.addEventListener('dragover', e => {
    e.preventDefault();
    card.classList.add('drag-over');
  });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  card.addEventListener('drop', e => {
    e.preventDefault();
    card.classList.remove('drag-over');
    handleDrop(gi);
  });

  const header = document.createElement('div');
  header.className = 'ge-group-header';
  header.innerHTML = `
    <span style="display:flex;align-items:center;gap:6px">
      <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
      Gruppe ${gi + 1}
    </span>
    <span class="badge-count">${group.length}</span>`;
  card.appendChild(header);

  const members = document.createElement('div');
  members.className = 'ge-group-members';

  group.forEach(studentId => {
    const chip = buildChip(studentId, gi);
    members.appendChild(chip);
  });

  card.appendChild(members);
  return card;
}

function buildChip(studentId, groupIdx) {
  const s = _state.studentsById[studentId];
  if (!s) return document.createTextNode('');

  const isLeader = _state.leaderIds.includes(studentId);
  const isLocked = _state.lockedPlacements.some(
    lp => lp.studentId === studentId && lp.groupIndex === groupIdx
  );

  const chip = document.createElement('div');
  chip.className = `ge-chip${isLeader ? ' is-leader' : ''}${isLocked ? ' is-locked' : ''}`;
  chip.draggable = true;
  chip.dataset.studentId = studentId;
  chip.dataset.groupIdx = groupIdx;

  chip.innerHTML = `
    ${isLeader ? '<i class="fa-solid fa-star ge-leader-icon" title="Gruppeleder"></i>' : ''}
    <span class="ge-chip-name">${s.name}</span>
    <span class="ge-chip-actions">
      <button class="ge-chip-btn ge-lock-btn" title="${isLocked ? 'Lås opp' : 'Lås til denne gruppen'}">
        <i class="fa-solid ${isLocked ? 'fa-lock' : 'fa-lock-open'}"></i>
      </button>
    </span>`;

  if (isLocked) {
    chip.querySelector('.ge-lock-icon')?.setAttribute('title', 'Låst');
  }

  // Drag events
  chip.addEventListener('dragstart', e => {
    chip.classList.add('dragging');
    _dragSourceGroupIdx = groupIdx;
    _dragSourceStudentId = studentId;
    e.dataTransfer.effectAllowed = 'move';
  });
  chip.addEventListener('dragend', () => chip.classList.remove('dragging'));

  // Lock button
  chip.querySelector('.ge-lock-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    toggleLock(studentId, groupIdx);
  });

  return chip;
}

function renderSummary() {
  const el = document.getElementById('ge-summary');
  if (!el || !_state) return;
  const leaderCount = _state.leaderIds.length;
  const lockedCount = _state.lockedPlacements.length;
  const parts = [];
  if (lockedCount > 0) parts.push(`${lockedCount} låst${lockedCount !== 1 ? 'e' : ''}`);
  if (leaderCount > 0) parts.push(`${leaderCount} leder${leaderCount !== 1 ? 'e' : ''}`);
  if (_state.saved) parts.push('Lagret');
  el.textContent = parts.join(' · ');
}

function syncToolbarToggles() {
  const constraintsChk = document.getElementById('ge-toggle-constraints');
  const leadersChk = document.getElementById('ge-toggle-leaders');
  if (constraintsChk) constraintsChk.checked = _state.useConstraints;
  if (leadersChk) leadersChk.checked = _state.requireLeaders;
}

// ---------------------------------------------------------------------------
// Drag and drop
// ---------------------------------------------------------------------------

function handleDrop(targetGroupIdx) {
  if (_dragSourceStudentId === null || _dragSourceGroupIdx === null) return;
  if (_dragSourceGroupIdx === targetGroupIdx) return;

  // Flytt elev mellom grupper
  const srcGroup = _state.groups[_dragSourceGroupIdx];
  const tgtGroup = _state.groups[targetGroupIdx];

  const idx = srcGroup.indexOf(_dragSourceStudentId);
  if (idx === -1) return;

  srcGroup.splice(idx, 1);
  tgtGroup.push(_dragSourceStudentId);

  // Oppdater eventuell lås
  const lockIdx = _state.lockedPlacements.findIndex(
    lp => lp.studentId === _dragSourceStudentId && lp.groupIndex === _dragSourceGroupIdx
  );
  if (lockIdx !== -1) {
    _state.lockedPlacements[lockIdx].groupIndex = targetGroupIdx;
  }

  _state.saved = false;
  renderGroups();
  renderSummary();

  _dragSourceGroupIdx = null;
  _dragSourceStudentId = null;
}

// ---------------------------------------------------------------------------
// Locking
// ---------------------------------------------------------------------------

function toggleLock(studentId, groupIdx) {
  const existing = _state.lockedPlacements.findIndex(
    lp => lp.studentId === studentId && lp.groupIndex === groupIdx
  );
  if (existing !== -1) {
    _state.lockedPlacements.splice(existing, 1);
  } else {
    // Fjern eventuell annen lås for samme elev (kan bare være låst ett sted)
    const otherIdx = _state.lockedPlacements.findIndex(lp => lp.studentId === studentId);
    if (otherIdx !== -1) _state.lockedPlacements.splice(otherIdx, 1);
    _state.lockedPlacements.push({ studentId, groupIndex: groupIdx });
  }
  _state.saved = false;
  renderGroups();
  renderSummary();
}

// ---------------------------------------------------------------------------
// Leaders modal
// ---------------------------------------------------------------------------

function openLeadersModal() {
  const modal = document.getElementById('ge-leaders-modal');
  const picker = document.getElementById('ge-leaders-picker');
  if (!modal || !picker) return;

  picker.innerHTML = '';
  _state.students.forEach(s => {
    const isLeader = _state.leaderIds.includes(s.id);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `btn btn-xs ${isLeader ? 'btn-primary' : 'btn-outline'}`;
    chip.dataset.studentId = s.id;
    chip.innerHTML = `<i class="fa-solid fa-user"></i> ${s.name}`;
    chip.addEventListener('click', () => {
      const idx = _state.leaderIds.indexOf(s.id);
      if (idx !== -1) {
        _state.leaderIds.splice(idx, 1);
        chip.classList.remove('btn-primary');
        chip.classList.add('btn-outline');
      } else {
        _state.leaderIds.push(s.id);
        chip.classList.remove('btn-outline');
        chip.classList.add('btn-primary');
      }
      updateLeaderModalWarning();
    });
    picker.appendChild(chip);
  });

  updateLeaderModalWarning();
  modal.classList.remove('hidden');
}

function updateLeaderModalWarning() {
  const warning = document.getElementById('ge-leaders-modal-warning');
  const msg = document.getElementById('ge-leaders-modal-warning-msg');
  if (!warning || !msg) return;

  const count = _state.leaderIds.length;
  const numGroups = _state.numGroups;

  if (count === 0 || count === numGroups) {
    warning.classList.add('hidden');
  } else {
    msg.textContent = count < numGroups
      ? `${count} leder(e) valgt — ${numGroups - count} gruppe(r) vil ikke ha leder.`
      : `${count} ledere valgt — det er flere enn ${numGroups} grupper.`;
    warning.classList.remove('hidden');
  }
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

async function save() {
  if (!_state) return;
  const btn = document.getElementById('ge-btn-save');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

  try {
    const groups = _state.groups.map((studentIds, i) => ({
      groupNumber: i + 1,
      studentIds,
    }));

    const result = await window.api.saveGroupAssignment({
      id: _state.assignmentId,
      name: _state.name,
      classId: _state.classId,
      sourceSeatingId: _state.sourceSeatingId,
      useConstraints: _state.useConstraints,
      avoidLastN: _state.avoidLastN,
      requireLeaders: _state.requireLeaders,
      leaderIds: _state.leaderIds,
      groups,
    });

    const assignmentId = _state.assignmentId ?? result.lastID;
    _state.assignmentId = assignmentId;

    // Lagre historikk-par
    const pairs = buildGroupPairs(_state.groups, _state.studentsById);
    if (pairs.length > 0) {
      await window.api.saveGroupHistory({
        classId: _state.classId,
        assignmentId,
        pairs,
      });
    }

    _state.saved = true;
    showToast('Gruppeinndelingen er lagret', 'success');
    renderSummary();
  } catch (err) {
    console.error('Feil ved lagring:', err);
    showToast('Lagring feilet', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lagre'; }
  }
}

// ---------------------------------------------------------------------------
// Toolbar binding
// ---------------------------------------------------------------------------

function bindToolbar() {
  document.getElementById('ge-btn-back')?.addEventListener('click', () => {
    window.navTo('charts-dashboard');
  });

  document.getElementById('ge-btn-reshuffle')?.addEventListener('click', () => {
    randomize();
    renderGroups();
    renderSummary();
    syncToolbarToggles();
  });

  document.getElementById('ge-btn-save')?.addEventListener('click', save);

  document.getElementById('ge-toggle-constraints')?.addEventListener('change', e => {
    _state.useConstraints = e.target.checked;
  });

  document.getElementById('ge-toggle-leaders')?.addEventListener('change', e => {
    _state.requireLeaders = e.target.checked;
  });

  document.getElementById('ge-btn-leaders-modal')?.addEventListener('click', openLeadersModal);

  document.getElementById('ge-leaders-modal-close')?.addEventListener('click', () => {
    document.getElementById('ge-leaders-modal')?.classList.add('hidden');
  });

  document.getElementById('ge-leaders-modal-ok')?.addEventListener('click', () => {
    document.getElementById('ge-leaders-modal')?.classList.add('hidden');
    renderGroups();
    renderSummary();
  });

  // Lukk modal ved klikk på backdrop
  document.getElementById('ge-leaders-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.add('hidden');
    }
  });
}

// ---------------------------------------------------------------------------
// CSS injection
// ---------------------------------------------------------------------------

function attachStyles() {
  if (document.getElementById('ge-styles')) return;
  const link = document.createElement('link');
  link.id = 'ge-styles';
  link.rel = 'stylesheet';
  link.href = './styles/group-editor.css';
  document.head.appendChild(link);
}
