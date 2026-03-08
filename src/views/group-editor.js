/**
 * group-editor.js — Rediger og lagre gruppeinndelinger.
 */

import { normalizeStudents, showToast, showConfirm } from '../shared/utils.js';
import { generateGroups, buildGroupPairs, groupByLevelHomogeneous, groupByLevelHeterogeneous } from '../shared/groupRandomizer.js';

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
  if (params.mode === 'existing') {
    await initStateFromDb(params.assignmentId);
  } else {
    await initStateNew(params);
  }
}

async function initStateNew(params) {
  const { mode, name, classId, sourceSeatingId, students, numGroups,
    useConstraints, avoidLastN, requireLeaders, leaderIds, groupingMode } = params;

  const studentsById = {};
  const normalized = normalizeStudents(students);
  normalized.forEach(s => { studentsById[s.id] = s; });

  const rawConstraints = await window.api.getConstraints(classId);

  let recentPairs = [];
  if (avoidLastN > 0) {
    const histRows = await window.api.getGroupHistory(classId, avoidLastN);
    recentPairs = histRows.flatMap(row => {
      try { return JSON.parse(row.pairs); } catch { return []; }
    });
  }

  _state = {
    mode,
    name,
    classId,
    sourceSeatingId: sourceSeatingId ?? null,
    students: normalized,
    studentsById,
    constraints: rawConstraints ?? [],
    numGroups,
    groups: [],
    lockedPlacements: [],
    leaderIds: leaderIds ?? [],
    requireLeaders: requireLeaders ?? false,
    useConstraints: useConstraints ?? true,
    avoidLastN: avoidLastN ?? 3,
    recentPairs,
    groupingMode: groupingMode ?? 'random',
    assignmentId: null,
    saved: false,
  };

  randomize();
}

async function initStateFromDb(assignmentId) {
  const [assignment, groupRows] = await Promise.all([
    window.api.getGroupAssignment(assignmentId),
    window.api.getGroupAssignmentGroups(assignmentId),
  ]);

  if (!assignment) {
    showToast('Fant ikke gruppeinndelingen', 'error');
    window.navTo('group-dashboard');
    return;
  }

  const cls = await window.api.getClass(assignment.class_id);
  const rawStudents = cls?.students ?? '[]';
  const parsed = (() => {
    try { return JSON.parse(rawStudents); } catch { return String(rawStudents).split('\n').filter(Boolean); }
  })();
  const normalized = normalizeStudents(parsed);
  const studentsById = {};
  normalized.forEach(s => { studentsById[s.id] = s; });

  const rawConstraints = await window.api.getConstraints(assignment.class_id);

  // Gjenbygg grupper fra DB
  const groups = groupRows.map(row => {
    try { return JSON.parse(row.student_ids); } catch { return []; }
  });

  _state = {
    mode: 'existing',
    name: assignment.name,
    classId: assignment.class_id,
    sourceSeatingId: assignment.source_seating_id ?? null,
    students: normalized,
    studentsById,
    constraints: rawConstraints ?? [],
    numGroups: groups.length,
    groups,
    lockedPlacements: [],
    leaderIds: (() => { try { return JSON.parse(assignment.leader_ids ?? '[]'); } catch { return []; } })(),
    requireLeaders: !!assignment.require_leaders,
    useConstraints: !!assignment.use_constraints,
    avoidLastN: assignment.avoid_last_n ?? 3,
    recentPairs: [],
    groupingMode: 'random',
    assignmentId: assignmentId,
    saved: true,
  };
}

// ---------------------------------------------------------------------------
// Randomisering
// ---------------------------------------------------------------------------

function randomize() {
  if (!_state) return;

  if (_state.groupingMode === 'homogeneous') {
    _state.groups = groupByLevelHomogeneous(_state.students, _state.numGroups);
  } else if (_state.groupingMode === 'heterogeneous') {
    _state.groups = groupByLevelHeterogeneous(_state.students, _state.numGroups);
  } else {
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
  }
  _state.saved = false;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function buildTemplate() {
  return `
<div style="display:flex;flex-direction:column;height:100%">
  <div class="view-header" style="padding-bottom:0;border-bottom:none;flex-shrink:0">
    <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
      <button class="btn btn-ghost btn-sm" id="ge-btn-back">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div style="min-width:0">
        <h1 class="view-title" id="ge-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></h1>
        <p class="view-subtitle" id="ge-subtitle"></p>
      </div>
    </div>
    <div class="ge-toolbar-actions">
      <button class="btn btn-ghost btn-sm" id="ge-btn-toggle-constraints" title="Respekter plasserings-regler">
        <i class="fa-solid fa-gavel"></i> Regler
      </button>
      <button class="btn btn-ghost btn-sm" id="ge-btn-toggle-leaders" title="Krev én leder per gruppe">
        <i class="fa-solid fa-user-tie"></i> Ledere
        <span id="ge-leaders-badge" class="ge-leader-badge hidden">0</span>
      </button>
      <div class="ge-toolbar-sep"></div>
      <button class="btn btn-ghost btn-sm" id="ge-btn-leaders-modal" title="Velg gruppeledere">
        <i class="fa-solid fa-user-pen"></i>
      </button>
      <button class="btn btn-ghost btn-sm" id="ge-btn-reshuffle" title="Generer på nytt">
        <i class="fa-solid fa-shuffle"></i> Generer på nytt
      </button>
      <div class="ge-toolbar-sep"></div>
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
  card.style.borderLeft = `4px solid ${color}`;

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
  // Lett tint av gruppefargen på header-bakgrunnen
  header.style.background = `${color}18`;
  header.innerHTML = `
    <div class="ge-group-header-left">
      <span class="ge-group-number" style="color:${color}">${gi + 1}</span>
      <span class="ge-group-label">Gruppe</span>
    </div>
    <span class="ge-group-count">${group.length} elever</span>`;
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
    ${isLocked ? '<i class="fa-solid fa-lock ge-lock-icon-visible" title="Låst til denne gruppen"></i>' : ''}
    <span class="ge-chip-actions">
      <button class="ge-chip-btn ge-lock-btn" title="${isLocked ? 'Lås opp' : 'Lås til denne gruppen'}">
        <i class="fa-solid ${isLocked ? 'fa-lock' : 'fa-lock-open'}"></i>
      </button>
    </span>`;

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
  const totalStudents = _state.students.length;
  const numGroups = _state.groups.length;

  const parts = [
    `${numGroups} grupper`,
    `${totalStudents} elever`,
  ];
  if (lockedCount > 0) parts.push(`${lockedCount} låst${lockedCount !== 1 ? 'e' : ''}`);
  if (leaderCount > 0) parts.push(`${leaderCount} leder${leaderCount !== 1 ? 'e' : ''}`);

  let savedHtml = '';
  if (_state.saved) {
    savedHtml = `<span class="ge-summary-saved"><i class="fa-solid fa-check" style="margin-right:3px"></i>Lagret</span>`;
  }

  el.innerHTML = parts.join(' · ') + (savedHtml ? `<span style="flex:1"></span>${savedHtml}` : '');
}

function syncToolbarToggles() {
  // Oppdater toggle-knapper for constraints og leaders
  const constraintsBtn = document.getElementById('ge-btn-toggle-constraints');
  const leadersBtn = document.getElementById('ge-btn-toggle-leaders');
  const leadersBadge = document.getElementById('ge-leaders-badge');

  if (constraintsBtn) {
    constraintsBtn.classList.toggle('btn-active', _state.useConstraints);
  }
  if (leadersBtn) {
    leadersBtn.classList.toggle('btn-active', _state.requireLeaders);
  }
  if (leadersBadge) {
    const count = _state.leaderIds.length;
    if (count > 0) {
      leadersBadge.textContent = count;
      leadersBadge.classList.remove('hidden');
    } else {
      leadersBadge.classList.add('hidden');
    }
  }
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
    window.navTo('group-dashboard');
  });

  document.getElementById('ge-btn-reshuffle')?.addEventListener('click', async () => {
    const hasManualChanges = !_state.saved && _state.lockedPlacements.length > 0;
    if (hasManualChanges) {
      const ok = await showConfirm({
        title: 'Generer på nytt?',
        message: 'Du har gjort manuelle endringer (låste elever). Disse vil gå tapt.',
        confirmLabel: 'Generer på nytt',
        danger: false,
      });
      if (!ok) return;
    }
    randomize();
    renderGroups();
    renderSummary();
    syncToolbarToggles();
  });

  document.getElementById('ge-btn-save')?.addEventListener('click', save);

  document.getElementById('ge-btn-toggle-constraints')?.addEventListener('click', () => {
    _state.useConstraints = !_state.useConstraints;
    syncToolbarToggles();
  });

  document.getElementById('ge-btn-toggle-leaders')?.addEventListener('click', () => {
    _state.requireLeaders = !_state.requireLeaders;
    syncToolbarToggles();
  });

  document.getElementById('ge-btn-leaders-modal')?.addEventListener('click', openLeadersModal);

  document.getElementById('ge-leaders-modal-close')?.addEventListener('click', () => {
    document.getElementById('ge-leaders-modal')?.classList.add('hidden');
  });

  document.getElementById('ge-leaders-modal-ok')?.addEventListener('click', () => {
    document.getElementById('ge-leaders-modal')?.classList.add('hidden');
    syncToolbarToggles();
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
