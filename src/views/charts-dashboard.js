/**
 * charts-dashboard.js — Oversikt over alle klassekart.
 */

import { showToast } from '../shared/utils.js';

let _container = null;
let _allCharts = [];
let _allClasses = [];

const TEMPLATE = `
<div class="view-header">
  <div>
    <h1 class="view-title">Klassekart</h1>
    <p class="view-subtitle">Oversikt over alle dine klassekart</p>
  </div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-ghost btn-sm" id="btn-new-group">
      <i class="fa-solid fa-people-group"></i> Gruppearbeid
    </button>
    <button class="btn btn-secondary btn-sm" id="btn-new-chart">
      <i class="fa-solid fa-plus"></i> Nytt klassekart
    </button>
  </div>
</div>
<div class="filter-bar">
  <div class="filter-group">
    <label class="filter-label">Klasse</label>
    <select id="filter-class" class="select select-sm select-bordered"><option value="">Alle klasser</option></select>
  </div>
  <div class="filter-group">
    <label class="filter-label">Sorter</label>
    <select id="filter-sort" class="select select-sm select-bordered">
      <option value="newest">Nyeste først</option>
      <option value="oldest">Eldste først</option>
      <option value="name">Alfabetisk</option>
    </select>
  </div>
</div>
<div id="charts-grid" class="cards-grid"></div>
<div id="charts-empty" class="empty-state hidden">
  <i class="fa-solid fa-chalkboard"></i>
  <h3>Ingen klassekart ennå</h3>
  <p>Opprett ditt første klassekart for å komme i gang.</p>
  <button class="btn btn-primary" id="btn-new-chart-empty">
    <i class="fa-solid fa-plus"></i> Opprett klassekart
  </button>
</div>`;

export const chartsDashboardView = {
  async mount(container) {
    _container = container;
    container.innerHTML = TEMPLATE;
    await loadData();
    bindEvents();
  },
  unmount() { _container = null; },
};

async function loadData() {
  [_allCharts, _allClasses] = await Promise.all([
    window.api.getSeatings(),
    window.api.getClasses(),
  ]);
  populateClassFilter();
  renderCharts(_allCharts);
}

function populateClassFilter() {
  const sel = document.getElementById('filter-class');
  if (!sel) return;
  _allClasses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function renderCharts(charts) {
  const grid  = document.getElementById('charts-grid');
  const empty = document.getElementById('charts-empty');
  if (!grid) return;

  grid.innerHTML = '';

  if (charts.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  charts.forEach(chart => {
    const card = buildChartCard(chart);
    grid.appendChild(card);
  });
}

function buildChartCard(chart) {
  const card = document.createElement('div');
  card.className = 'chart-card';
  card.innerHTML = `
    <div class="chart-card-title">${escHtml(chart.name ?? 'Uten navn')}</div>
    ${chart.comment ? `<div class="chart-card-comment"><i class="fa-solid fa-calendar-week" style="margin-right:4px"></i>${escHtml(chart.comment)}</div>` : ''}
    <div class="chart-card-meta">
      <span><i class="fa-solid fa-users" style="margin-right:4px"></i>${escHtml(chart.class_name ?? '—')}</span>
      <span><i class="fa-solid fa-door-open" style="margin-right:4px"></i>${escHtml(chart.room_name ?? '—')}</span>
      <span><i class="fa-regular fa-clock" style="margin-right:4px"></i>${formatDate(chart.created_at)}</span>
    </div>
    <div class="chart-card-actions">
      <button class="btn btn-ghost btn-sm btn-delete" data-id="${chart.id}" title="Slett">
        <i class="fa-solid fa-trash text-error"></i>
      </button>
      <button class="btn btn-outline btn-primary btn-sm btn-open" data-id="${chart.id}">
        <i class="fa-solid fa-pen"></i> Rediger
      </button>
    </div>
  `;

  card.querySelector('.btn-open').addEventListener('click', (e) => {
    e.stopPropagation();
    window.navTo('seating-editor', { chartId: chart.id });
  });
  card.querySelector('.btn-delete').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`Slett "${chart.name}"?`)) return;
    await window.api.deleteSeating(chart.id);
    showToast('Klassekart slettet', 'info');
    await loadData();
  });
  card.addEventListener('click', () => window.navTo('seating-editor', { chartId: chart.id }));
  return card;
}

function bindEvents() {
  document.getElementById('btn-new-chart')?.addEventListener('click', () => window.navTo('seating-setup'));
  document.getElementById('btn-new-chart-empty')?.addEventListener('click', () => window.navTo('seating-setup'));
  document.getElementById('btn-new-group')?.addEventListener('click', () => window.navTo('group-setup'));
  document.getElementById('filter-class')?.addEventListener('change', applyFilters);
  document.getElementById('filter-sort')?.addEventListener('change', applyFilters);
}

function applyFilters() {
  const classId = document.getElementById('filter-class')?.value;
  const sort    = document.getElementById('filter-sort')?.value ?? 'newest';

  let filtered = classId
    ? _allCharts.filter(c => String(c.class_id) === classId)
    : [..._allCharts];

  if (sort === 'newest') filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  else if (sort === 'oldest') filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  else filtered.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

  renderCharts(filtered);
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
