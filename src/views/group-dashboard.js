/**
 * group-dashboard.js — Oversikt over alle lagrede gruppeinndelinger.
 */

import { showToast, showConfirm } from '../shared/utils.js';

let _allAssignments = [];
let _allClasses = [];

const TEMPLATE = `
<div style="height:100%;overflow-y:auto;display:flex;flex-direction:column;">
<div class="view-header" style="flex-shrink:0">
  <div>
    <h1 class="view-title">Gruppearbeid</h1>
    <p class="view-subtitle">Oversikt over alle gruppeinndelinger</p>
  </div>
  <button class="btn btn-secondary btn-sm" id="btn-new-assignment">
    <i class="fa-solid fa-plus"></i> Ny gruppeinndeling
  </button>
</div>
<div class="filter-bar" style="flex-shrink:0">
  <div class="filter-group">
    <label class="filter-label">Klasse</label>
    <select id="gd-filter-class" class="select select-sm select-bordered"><option value="">Alle klasser</option></select>
  </div>
  <div class="filter-group">
    <label class="filter-label">Sorter</label>
    <select id="gd-filter-sort" class="select select-sm select-bordered">
      <option value="newest">Nyeste først</option>
      <option value="oldest">Eldste først</option>
      <option value="name">Alfabetisk</option>
    </select>
  </div>
</div>
<div id="gd-grid" class="cards-grid" style="flex:1"></div>
<div id="gd-empty" class="empty-state hidden">
  <i class="fa-solid fa-people-group"></i>
  <h3>Ingen gruppeinndelinger ennå</h3>
  <p>Generer din første gruppeinndeling for å komme i gang.</p>
  <button class="btn btn-primary" id="btn-new-assignment-empty">
    <i class="fa-solid fa-plus"></i> Ny gruppeinndeling
  </button>
</div>
</div>`;

export const groupDashboardView = {
  async mount(container) {
    container.innerHTML = TEMPLATE;
    await loadData();
    bindEvents();
  },
  unmount() {
    _allAssignments = [];
    _allClasses = [];
  },
};

async function loadData() {
  const grid = document.getElementById('gd-grid');
  if (grid) {
    grid.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:24px;opacity:0.5"><span class="loading loading-spinner loading-sm"></span><span>Laster…</span></div>';
  }

  [_allAssignments, _allClasses] = await Promise.all([
    window.api.getGroupAssignments(),
    window.api.getClasses(),
  ]);

  populateClassFilter();
  renderAssignments(_allAssignments);
}

function populateClassFilter() {
  const sel = document.getElementById('gd-filter-class');
  if (!sel) return;
  _allClasses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function renderAssignments(assignments) {
  const grid = document.getElementById('gd-grid');
  const empty = document.getElementById('gd-empty');
  if (!grid) return;

  grid.innerHTML = '';

  if (assignments.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  assignments.forEach(a => grid.appendChild(buildCard(a)));
}

function buildCard(assignment) {
  const className = assignment.class_name ?? '—';

  const groupCount = assignment.group_count ?? '?';

  const card = document.createElement('div');
  card.className = 'chart-card';
  card.innerHTML = `
    <div class="chart-card-title">${escHtml(assignment.name ?? 'Uten navn')}</div>
    <div class="chart-card-meta" style="margin-top:6px">
      <span><i class="fa-solid fa-users" style="margin-right:4px"></i>${escHtml(className)}</span>
      <span><i class="fa-solid fa-people-group" style="margin-right:4px"></i>${groupCount} grupper</span>
      <span><i class="fa-regular fa-clock" style="margin-right:4px"></i>${formatDate(assignment.created_at)}</span>
    </div>
    <div class="chart-card-actions">
      <button class="btn btn-ghost btn-sm btn-gd-delete" data-id="${assignment.id}" title="Slett">
        <i class="fa-solid fa-trash text-error"></i>
      </button>
      <button class="btn btn-outline btn-primary btn-sm btn-gd-open" data-id="${assignment.id}">
        <i class="fa-solid fa-pen"></i> Åpne
      </button>
    </div>`;

  card.querySelector('.btn-gd-open').addEventListener('click', e => {
    e.stopPropagation();
    window.navTo('group-editor', { mode: 'existing', assignmentId: assignment.id });
  });

  card.querySelector('.btn-gd-delete').addEventListener('click', async e => {
    e.stopPropagation();
    const ok = await showConfirm({
      title: 'Slett gruppeinndeling?',
      message: `"${assignment.name}" slettes permanent og kan ikke gjenopprettes.`,
      confirmLabel: 'Ja, slett',
    });
    if (!ok) return;
    await window.api.deleteGroupAssignment(assignment.id);
    showToast('Gruppeinndeling slettet', 'info');
    await loadData();
  });

  card.addEventListener('click', () => {
    window.navTo('group-editor', { mode: 'existing', assignmentId: assignment.id });
  });

  return card;
}

function bindEvents() {
  document.getElementById('btn-new-assignment')?.addEventListener('click', () => window.navTo('group-setup'));
  document.getElementById('btn-new-assignment-empty')?.addEventListener('click', () => window.navTo('group-setup'));
  document.getElementById('gd-filter-class')?.addEventListener('change', applyFilters);
  document.getElementById('gd-filter-sort')?.addEventListener('change', applyFilters);
}

function applyFilters() {
  const classId = document.getElementById('gd-filter-class')?.value;
  const sort = document.getElementById('gd-filter-sort')?.value ?? 'newest';

  let filtered = classId
    ? _allAssignments.filter(a => String(a.class_id) === classId)
    : [..._allAssignments];

  if (sort === 'newest') filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  else if (sort === 'oldest') filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  else filtered.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

  renderAssignments(filtered);
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
