/**
 * charts-dashboard.js — Oversikt over alle klassekart, gruppert per klasse.
 */

import { showToast, showConfirm } from '../shared/utils.js';
import { buildChartFromDb } from '../shared/chartHelpers.js';
import { showOnboardingWizard } from './onboarding-wizard.js';

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
    <label class="filter-label">Sorter klasser etter</label>
    <select id="filter-sort" class="select select-sm select-bordered">
      <option value="newest">Nyeste kart først</option>
      <option value="oldest">Eldste kart først</option>
      <option value="name">Klasse alfabetisk</option>
    </select>
  </div>
</div>
<div id="charts-grid" class="class-groups-list"></div>
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
    await renderTodayPanel();
    bindEvents();
  },
  unmount() { _container = null; _allCharts = []; _allClasses = []; _allRooms = []; },
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

async function loadData() {
  showLoadingSkeleton('charts-grid');
  try {
    [_allCharts, _allClasses] = await Promise.all([
      window.api.getSeatings(),
      window.api.getClasses(),
    ]);
    renderClassGroups(_allCharts);
    maybeShowOnboarding();
  } catch (err) {
    showToast('Kunne ikke laste data. Sjekk databasen.', 'error');
    console.error('loadData error:', err);
  } finally {
    document.getElementById('loading-skeleton')?.remove();
  }
}

function maybeShowOnboarding() {
  const isEmpty = _allClasses.length === 0 && _allCharts.length === 0;
  if (!isEmpty) return;

  showOnboardingWizard(async ({ classId, roomId, goToChart }) => {
    await loadData();
    if (goToChart) {
      window.navTo('seating-setup', { preselect: { classId, roomId } });
    }
  });
}

/* ---- Grouped rendering ---- */

function renderClassGroups(charts) {
  const grid  = document.getElementById('charts-grid');
  const empty = document.getElementById('charts-empty');
  if (!grid) return;

  grid.innerHTML = '';

  if (charts.length === 0) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  // Group charts by class_id, sort within each group newest first
  const groups = new Map();
  for (const chart of charts) {
    const key = chart.class_id ?? 0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(chart);
  }
  for (const [, group] of groups) {
    group.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // Sort groups by their newest chart's created_at (matches current sort select)
  const sort = document.getElementById('filter-sort')?.value ?? 'newest';
  const sortedGroups = [...groups.values()].sort((a, b) => {
    const newestA = a[0];
    const newestB = b[0];
    if (sort === 'oldest') return new Date(newestA.created_at) - new Date(newestB.created_at);
    if (sort === 'name') return (newestA.class_name ?? '').localeCompare(newestB.class_name ?? '');
    return new Date(newestB.created_at) - new Date(newestA.created_at);
  });

  for (const group of sortedGroups) {
    grid.appendChild(buildClassGroupCard(group));
  }
}

function buildClassGroupCard(charts) {
  const [active, ...history] = charts;
  const className = active.class_name ?? 'Ukjent klasse';
  const totalCount = charts.length;

  const card = document.createElement('div');
  card.className = 'class-group-card';

  // Header
  const header = document.createElement('div');
  header.className = 'class-group-header';
  header.innerHTML = `
    <i class="fa-solid fa-users class-group-icon"></i>
    <span class="class-group-name">${escHtml(className)}</span>
    <span class="class-group-badge">${totalCount} ${totalCount === 1 ? 'kart' : 'kart'}</span>
    <button class="btn btn-ghost btn-xs class-group-history-btn" title="Vis nabohistorikk for ${escHtml(className)}">
      <i class="fa-solid fa-chart-simple"></i>
      <span class="class-group-toggle-label">Nabohistorikk</span>
    </button>
    ${history.length > 0 ? `
      <button class="btn btn-ghost btn-xs class-group-toggle" title="Vis tidligere kart">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <span class="class-group-toggle-label">Tidligere (${history.length})</span>
        <i class="fa-solid fa-chevron-down class-group-chevron"></i>
      </button>` : ''}
  `;

  // Active (newest) chart row
  const activeRow = document.createElement('div');
  activeRow.className = 'class-group-active';
  activeRow.innerHTML = `
    <div class="class-group-active-info">
      <span class="class-group-active-name">${escHtml(active.name ?? 'Uten navn')}</span>
      ${active.comment ? `<span class="class-group-active-period"><i class="fa-solid fa-calendar-week"></i> ${escHtml(active.comment)}</span>` : ''}
      <span class="class-group-active-meta">
        <i class="fa-solid fa-door-open"></i> ${escHtml(active.room_name ?? '—')}
        <span class="class-group-dot">·</span>
        <i class="fa-regular fa-clock"></i> ${formatDate(active.created_at)}
      </span>
    </div>
    <div class="class-group-active-actions">
      <button class="btn btn-ghost btn-sm btn-print" title="Skriv ut / Vikarmodus">
        <i class="fa-solid fa-print"></i>
      </button>
      <button class="btn btn-ghost btn-sm btn-delete" title="Slett">
        <i class="fa-solid fa-trash text-error"></i>
      </button>
      <button class="btn btn-outline btn-primary btn-sm btn-open">
        <i class="fa-solid fa-pen"></i> Rediger
      </button>
    </div>
  `;

  wireChartActions(activeRow, active);
  activeRow.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    window.navTo('seating-editor', { chartId: active.id });
  });

  // History list (hidden by default)
  const historyList = document.createElement('div');
  historyList.className = 'chart-history-list hidden';

  for (const chart of history) {
    const row = document.createElement('div');
    row.className = 'chart-history-row';
    row.innerHTML = `
      <div class="chart-history-row-info">
        <span class="chart-history-row-name">${escHtml(chart.name ?? 'Uten navn')}</span>
        ${chart.comment ? `<span class="chart-history-row-period"><i class="fa-solid fa-calendar-week"></i> ${escHtml(chart.comment)}</span>` : ''}
        <span class="chart-history-row-date"><i class="fa-regular fa-clock"></i> ${formatDate(chart.created_at)}</span>
      </div>
      <div class="chart-history-row-actions">
        <button class="btn btn-ghost btn-xs btn-print" title="Skriv ut">
          <i class="fa-solid fa-print"></i>
        </button>
        <button class="btn btn-ghost btn-xs btn-delete" title="Slett">
          <i class="fa-solid fa-trash text-error"></i>
        </button>
        <button class="btn btn-ghost btn-xs btn-open">
          <i class="fa-solid fa-pen"></i> Åpne
        </button>
      </div>
    `;
    wireChartActions(row, chart);
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      window.navTo('seating-editor', { chartId: chart.id });
    });
    historyList.appendChild(row);
  }

  // Navigate to neighbor history view
  header.querySelector('.class-group-history-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.navTo('seating-history', { classId: active.class_id });
  });

  // Toggle older charts list
  if (history.length > 0) {
    const toggleBtn = header.querySelector('.class-group-toggle');
    toggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = historyList.classList.toggle('hidden');
      const chevron = toggleBtn.querySelector('.class-group-chevron');
      if (chevron) chevron.style.transform = isHidden ? '' : 'rotate(180deg)';
    });
  }

  card.appendChild(header);
  card.appendChild(activeRow);
  if (history.length > 0) card.appendChild(historyList);
  return card;
}

function wireChartActions(el, chart) {
  el.querySelector('.btn-print')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const raw = await window.api.getSeating(chart.id);
    if (!raw) { showToast('Fant ikke klassekart', 'error'); return; }
    const chartObj = await buildChartFromDb(raw, window.api.getClass);
    chartObj.className = chart.class_name ?? '';
    window.openPrintOverlay(chartObj);
  });
  el.querySelector('.btn-open')?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.navTo('seating-editor', { chartId: chart.id });
  });
  el.querySelector('.btn-delete')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const ok = await showConfirm({
      title: 'Slett klassekart?',
      message: `"${chart.name}" slettes permanent og kan ikke gjenopprettes.`,
      confirmLabel: 'Ja, slett',
    });
    if (!ok) return;
    await window.api.deleteSeating(chart.id);
    showToast('Klassekart slettet', 'info');
    await loadData();
  });
}

function bindEvents() {
  document.getElementById('btn-new-chart')?.addEventListener('click', () => window.navTo('seating-setup'));
  document.getElementById('btn-new-chart-empty')?.addEventListener('click', () => window.navTo('seating-setup'));
  document.getElementById('btn-new-group')?.addEventListener('click', () => window.navTo('group-setup'));
  document.getElementById('filter-sort')?.addEventListener('change', applyFilters);
}

function applyFilters() {
  const sort = document.getElementById('filter-sort')?.value ?? 'newest';
  const sorted = [..._allCharts];
  if (sort === 'newest') sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  else if (sort === 'oldest') sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  else sorted.sort((a, b) => (a.class_name ?? '').localeCompare(b.class_name ?? ''));
  renderClassGroups(sorted);
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---- "I dag"-panel (timeplan) ---- */

async function renderTodayPanel() {
  let schedule = [];
  try { schedule = await window.api.getSchedule(); } catch { return; }

  // JS getDay(): 0=søndag, 1=mandag ... 6=lørdag
  // DB weekday: 1=mandag ... 5=fredag
  const jsDay = new Date().getDay();
  if (jsDay === 0 || jsDay === 6) return; // Helg — vis ikke
  const todayWeekday = jsDay; // 1–5

  const todayEntries = schedule.filter(e => e.weekday === todayWeekday);
  if (todayEntries.length === 0) return;

  // Nyeste klassekart per klasse
  const seatingByClass = {};
  for (const s of _allCharts) {
    if (!seatingByClass[s.class_id]) seatingByClass[s.class_id] = s;
  }

  const chips = todayEntries
    .sort((a, b) => a.period - b.period)
    .map(e => {
      const lastSeating = seatingByClass[e.class_id];
      const classInfo = `<span class="font-semibold text-sm">${escHtml(e.class_name ?? '—')}</span>`;
      const chartInfo = lastSeating
        ? `<span class="text-xs opacity-50">${escHtml(lastSeating.name)}</span>`
        : `<span class="badge badge-xs badge-ghost">Ingen kart</span>`;
      const onclick = lastSeating
        ? `window.navTo('seating-editor', {chartId:${lastSeating.id}})`
        : `window.navTo('seating-setup')`;
      return `
        <div class="flex items-center gap-2 bg-base-100 rounded-lg px-3 py-2 cursor-pointer hover:bg-base-300 transition-colors"
          onclick="${onclick}" title="${lastSeating ? 'Åpne ' + escHtml(lastSeating.name) : 'Opprett nytt klassekart'}">
          <span class="text-xs opacity-40 font-mono">${e.period}.</span>
          ${classInfo}
          ${chartInfo}
        </div>`;
    }).join('');

  const weekdays = ['', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag'];
  const todayName = weekdays[todayWeekday] ?? '';
  const panel = document.createElement('div');
  panel.id = 'today-panel';
  panel.style.cssText = 'margin:12px 16px 0;padding:10px 14px;background:oklch(var(--b2));border-radius:10px;border:1px solid oklch(var(--b3)/0.6);';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
      <i class="fa-solid fa-calendar-day" style="color:oklch(var(--p))"></i>
      <span style="font-size:12px;font-weight:600;opacity:0.7">I dag — ${todayName}</span>
      <button class="btn btn-ghost btn-xs ml-auto" id="btn-edit-schedule" title="Rediger timeplan">
        <i class="fa-solid fa-pen" style="font-size:10px"></i>
      </button>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${chips}</div>`;

  // Sett inn over filter-bar
  const filterBar = _container?.querySelector('.filter-bar');
  if (filterBar) {
    filterBar.parentNode.insertBefore(panel, filterBar);
  }

  _container?.querySelector('#btn-edit-schedule')?.addEventListener('click', () => {
    window.navTo('schedule-settings');
  });
}
