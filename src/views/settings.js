/**
 * settings.js — Innstillinger: tema, database, om-info.
 */

import { store } from '../store.js';
import { showToast } from '../shared/utils.js';

export const settingsView = {
  async mount(container) {
    const html = await fetch('src/views/settings.html').then(r => r.text());
    container.innerHTML = html;
    await loadSettings();
    bindEvents();
  },
  unmount() {},
};

async function loadSettings() {
  const settings = await window.api.getSettings();
  store.setState({ settings });

  // Tema-toggle
  const isDark = (settings.theme ?? 'dark') === 'dark';
  document.getElementById('btn-theme-dark')?.classList.toggle('active', isDark);
  document.getElementById('btn-theme-light')?.classList.toggle('active', !isDark);

  // Flip display
  const flipEl = document.getElementById('setting-flip-display');
  if (flipEl) flipEl.checked = settings.defaultFlipDisplay ?? false;

  // DB-path
  const dbPathEl = document.getElementById('db-path-display');
  if (dbPathEl) dbPathEl.textContent = '(vises ved neste oppstart)';

  // App-versjon
  const verEl = document.getElementById('app-version');
  if (verEl) {
    try {
      const pkg = await fetch('package.json').then(r => r.json());
      verEl.textContent = `v${pkg.version}`;
    } catch { verEl.textContent = '—'; }
  }
}

function bindEvents() {
  // Tema
  document.getElementById('btn-theme-dark')?.addEventListener('click', () => setTheme('dark'));
  document.getElementById('btn-theme-light')?.addEventListener('click', () => setTheme('light'));

  // Flip
  document.getElementById('setting-flip-display')?.addEventListener('change', async (e) => {
    await window.api.saveSettings({ defaultFlipDisplay: e.target.checked });
    const s = store.getState().settings;
    store.setState({ settings: { ...s, defaultFlipDisplay: e.target.checked } });
  });

  // Eksport / Import
  document.getElementById('btn-export-class')?.addEventListener('click', exportClass);
  document.getElementById('btn-import-class')?.addEventListener('click', importClass);

  // Database
  document.getElementById('btn-backup-db')?.addEventListener('click', async () => {
    const r = await window.api.backupDb();
    if (r.success) showToast(`Backup lagret: ${r.filePath}`, 'success');
    else if (!r.canceled) showToast('Backup feilet: ' + r.error, 'error');
  });

  document.getElementById('btn-restore-db')?.addEventListener('click', async () => {
    if (!confirm('Gjenopprette database? Nåværende data erstattes.')) return;
    const r = await window.api.restoreDb();
    if (r.success) { showToast('Database gjenopprettet. Start appen på nytt.', 'success'); }
    else if (!r.canceled) showToast('Gjenoppretting feilet: ' + r.error, 'error');
  });

  document.getElementById('btn-move-db')?.addEventListener('click', async () => {
    const r = await window.api.moveDb();
    if (r.success) showToast('Database flyttet. Start appen på nytt.', 'success');
    else if (!r.canceled) showToast('Feil: ' + r.error, 'error');
  });
}

async function exportClass() {
  const classes = await window.api.getClasses();
  if (!classes.length) { showToast('Ingen klasser å eksportere', 'error'); return; }

  // Velg klasse
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header"><span class="modal-title">Eksporter klasse</span></div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Velg klasse</label>
        <select id="export-class-sel" class="form-input">
          ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="exp-cancel">Avbryt</button>
        <button class="btn btn-primary" id="exp-ok">Eksporter</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  backdrop.querySelector('#exp-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#exp-ok').addEventListener('click', async () => {
    const classId = parseInt(backdrop.querySelector('#export-class-sel').value);
    backdrop.remove();
    const bundle = await window.api.exportBundle(classId);
    const json   = JSON.stringify(bundle, null, 2);
    const blob   = new Blob([json], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href = url;
    a.download = `klasseplass-${bundle.class.name.replace(/\s+/g,'-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Klasse eksportert!', 'success');
  });
}

async function importClass() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text   = await file.text();
      const bundle = JSON.parse(text);
      if (!bundle.class) { showToast('Ugyldig fil — ikke en KlassePlass-bundle', 'error'); return; }
      const result = await window.api.importBundle(bundle);
      if (result.success) showToast(`Klasse "${bundle.class.name}" importert!`, 'success');
      else showToast('Import feilet: ' + result.error, 'error');
    } catch (err) {
      showToast('Feil ved lesing av fil: ' + err.message, 'error');
    }
  });
  input.click();
}

async function setTheme(theme) {
  document.getElementById('btn-theme-dark')?.classList.toggle('active', theme === 'dark');
  document.getElementById('btn-theme-light')?.classList.toggle('active', theme === 'light');
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : '';
  await window.api.saveSettings({ theme });
  const s = store.getState().settings;
  store.setState({ settings: { ...s, theme } });
}
