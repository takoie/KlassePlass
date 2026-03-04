/**
 * seating-history.js — Historikk-visning per klasse.
 * Viser timeline og par-matrise (hvem har sittet med hvem).
 */

import { showToast } from '../shared/utils.js';

export const seatingHistoryView = {
  async mount(container, params = {}) {
    const { classId } = params;
    if (!classId) { window.navTo('classes'); return; }

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Historikk</h1>
          <p id="history-class-name" class="view-subtitle"></p>
        </div>
        <button class="btn btn-ghost" id="btn-history-back">
          <i class="fa-solid fa-arrow-left"></i> Tilbake
        </button>
      </div>
      <div style="padding:0 28px 24px;display:flex;flex-direction:column;gap:24px">
        <div id="history-timeline"></div>
        <div id="pair-matrix-section" class="hidden">
          <h2 style="font-size:15px;font-weight:600;margin-bottom:12px">Par-matrise</h2>
          <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">
            Antall ganger elev-par har sittet ved siden av hverandre
          </p>
          <div id="pair-matrix" style="overflow-x:auto"></div>
        </div>
      </div>
    `;

    document.getElementById('btn-history-back')?.addEventListener('click', () => window.navTo('classes'));

    const [cls, history] = await Promise.all([
      window.api.getClass(classId),
      window.api.getHistory(classId, 50),
    ]);

    document.getElementById('history-class-name').textContent = cls?.name ?? '';

    renderTimeline(history);
    if (history.length > 0) renderPairMatrix(history, cls);
  },
  unmount() {},
};

function renderTimeline(history) {
  const el = document.getElementById('history-timeline');
  if (!el) return;

  if (history.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <h3>Ingen historikk ennå</h3>
        <p>Historikk registreres når du lagrer klassekart.</p>
      </div>`;
    return;
  }

  el.innerHTML = `<h2 style="font-size:15px;font-weight:600;margin-bottom:12px">Tidslinje (${history.length} kart)</h2>`;

  history.forEach((entry, i) => {
    const pairs = parseJSON(entry.pairs) ?? [];
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:flex-start;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)';
    div.innerHTML = `
      <span style="font-size:11px;color:var(--text-muted);min-width:80px;padding-top:2px">
        ${formatDate(entry.created_at)}
      </span>
      <div>
        <span style="font-size:13px;color:var(--text-primary)">Kart #${history.length - i}</span>
        <span style="font-size:11px;color:var(--text-muted);margin-left:8px">${pairs.length} par</span>
      </div>
    `;
    el.appendChild(div);
  });
}

function renderPairMatrix(history, cls) {
  const section = document.getElementById('pair-matrix-section');
  const matrixEl = document.getElementById('pair-matrix');
  if (!section || !matrixEl) return;

  section.classList.remove('hidden');

  // Tell par
  const pairCounts = {};
  history.forEach(entry => {
    const pairs = parseJSON(entry.pairs) ?? [];
    pairs.forEach(([a, b]) => {
      const key = [a, b].sort().join('|||');
      pairCounts[key] = (pairCounts[key] ?? 0) + 1;
    });
  });

  if (Object.keys(pairCounts).length === 0) return;

  // Finn alle unike navn
  const names = [...new Set(
    Object.keys(pairCounts).flatMap(k => k.split('|||'))
  )].sort();

  if (names.length > 30) {
    matrixEl.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">For mange elever til matrise-visning (maks 30)</p>';
    return;
  }

  // Bygg tabell
  const table = document.createElement('table');
  table.style.cssText = 'border-collapse:collapse;font-size:11px';

  // Header
  const thead = table.createTHead();
  const headRow = thead.insertRow();
  headRow.insertCell().textContent = '';
  names.forEach(n => {
    const th = document.createElement('th');
    th.textContent = n.split(' ')[0]; // Fornavn
    th.style.cssText = 'padding:4px 6px;writing-mode:vertical-rl;max-height:80px;font-weight:500;color:var(--text-secondary)';
    headRow.appendChild(th);
  });

  // Rader
  const tbody = table.createTBody();
  names.forEach(rowName => {
    const row = tbody.insertRow();
    const th = document.createElement('th');
    th.textContent = rowName.split(' ')[0];
    th.style.cssText = 'padding:4px 8px;text-align:right;font-weight:500;color:var(--text-secondary);white-space:nowrap';
    row.appendChild(th);

    names.forEach(colName => {
      const td = row.insertCell();
      if (rowName === colName) {
        td.style.background = 'var(--border)';
        td.textContent = '—';
        td.style.textAlign = 'center';
        return;
      }
      const key = [rowName, colName].sort().join('|||');
      const count = pairCounts[key] ?? 0;
      const intensity = Math.min(count / Math.max(...Object.values(pairCounts)), 1);
      td.textContent = count || '';
      td.style.cssText = `padding:4px 8px;text-align:center;border:1px solid var(--border);
        background:rgba(37,99,235,${intensity * 0.4});
        color:${count > 0 ? 'var(--text-primary)' : 'transparent'}`;
    });
  });

  matrixEl.appendChild(table);
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function parseJSON(str) {
  try { return typeof str === 'string' ? JSON.parse(str) : str; } catch { return null; }
}
