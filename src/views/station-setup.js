/**
 * station-setup.js — Stasjonsundervisning: oppsett og oversikt.
 * Wizard: (1) grunnoppsett, (2) stasjoner, (3) grupper med drag-and-drop.
 */

import { showToast, showConfirm } from '../shared/utils.js';
import { generateGroups } from '../shared/groupRandomizer.js';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeParseJSON(str) {
  if (!str) return null;
  try { return typeof str === 'string' ? JSON.parse(str) : str; } catch { return null; }
}

/**
 * Beregner rotasjonsplan: rotationPlan[rotIdx][stationIdx] = groupIndex.
 * Round-robin slik at på rotasjon R, stasjon S får gruppe (R + S) % numGroups.
 */
function buildRotationPlan(numGroups, numStations) {
  const steps = [];
  const numRotations = numStations; // ett rotasjonssteg per stasjon
  for (let step = 0; step < numRotations; step++) {
    const assignment = [];
    for (let station = 0; station < numStations; station++) {
      assignment.push((step + station) % numGroups);
    }
    steps.push(assignment);
  }
  return steps;
}

let _classes  = [];
let _sessions = [];

export const stationSetupView = {
  async mount(container) {
    container.innerHTML = '<div class="p-6 flex items-center justify-center opacity-40">Laster…</div>';
    [_classes, _sessions] = await Promise.all([
      window.api.getClasses(),
      window.api.getStationSessions(),
    ]);
    renderDashboard(container);
  },
  unmount() {
    _classes  = [];
    _sessions = [];
  },
};

/* ---- Dashboard ---- */

function renderDashboard(container) {
  const sessionCards = _sessions.length === 0
    ? `<div class="empty-state">
        <i class="fa-solid fa-arrows-rotate"></i>
        <h3>Ingen stasjonssett ennå</h3>
        <p>Opprett ditt første stasjonssett for å komme i gang.</p>
      </div>`
    : `<div class="cards-grid" id="station-cards">${_sessions.map(buildSessionCard).join('')}</div>`;

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Stasjonsundervisning</h1>
        <p class="view-subtitle">Roter grupper mellom læringsstasjoner med nedtelling</p>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-new-station">
        <i class="fa-solid fa-plus"></i> Nytt stasjonssett
      </button>
    </div>
    ${sessionCards}`;

  container.querySelector('#btn-new-station')?.addEventListener('click', () => openWizard(container));

  container.querySelectorAll('.btn-start-station').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const raw = await window.api.getStationSession(id);
      if (!raw) return;
      window.navTo('station-presenter', { session: parseSession(raw) });
    });
  });

  container.querySelectorAll('.btn-delete-station').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const name = btn.dataset.name;
      const ok = await showConfirm({
        title: `Slett "${name}"?`,
        message: 'Stasjonsøkten slettes permanent.',
        confirmText: 'Slett',
        danger: true,
      });
      if (!ok) return;
      await window.api.deleteStationSession(id);
      showToast('Stasjonssett slettet', 'info');
      _sessions = await window.api.getStationSessions();
      renderDashboard(container);
    });
  });
}

function buildSessionCard(s) {
  const stations = safeParseJSON(s.stations) ?? [];
  const groups   = safeParseJSON(s.groups) ?? [];
  const teacherCount = stations.filter(st => st.isTeacher).length;
  const date = new Date(s.created_at).toLocaleDateString('no-NO', { day:'2-digit', month:'short', year:'numeric' });
  const teacherBadge = teacherCount > 0
    ? `<span class="badge badge-accent badge-sm ml-1" title="Lærerstasjon"><i class="fa-solid fa-chalkboard-user"></i></span>`
    : '';
  return `
    <div class="chart-card">
      <div class="chart-card-title">${esc(s.name)}${teacherBadge}</div>
      <div class="chart-card-meta">
        <span><i class="fa-solid fa-users" style="margin-right:4px"></i>${esc(s.class_name ?? '—')}</span>
        <span><i class="fa-solid fa-arrows-rotate" style="margin-right:4px"></i>${stations.length} stasjoner, ${groups.length} grupper</span>
        <span><i class="fa-regular fa-clock" style="margin-right:4px"></i>${s.minutes_per_station} min/stasjon</span>
        <span><i class="fa-regular fa-calendar" style="margin-right:4px"></i>${date}</span>
      </div>
      <div class="chart-card-actions">
        <button class="btn btn-ghost btn-sm btn-delete-station" data-id="${s.id}" data-name="${esc(s.name)}" title="Slett">
          <i class="fa-solid fa-trash text-error"></i>
        </button>
        <button class="btn btn-primary btn-sm btn-start-station" data-id="${s.id}">
          <i class="fa-solid fa-play"></i> Start
        </button>
      </div>
    </div>`;
}

function parseSession(raw) {
  const stations = safeParseJSON(raw.stations) ?? [];
  const groups   = safeParseJSON(raw.groups) ?? [];
  // Bakoverkompatibilitet: gamle groups var [[0],[1],...] — konverter om nødvendig
  const normalizedGroups = groups.map((g, i) =>
    Array.isArray(g) && !g.hasOwnProperty?.('studentIds')
      ? { label: `Gruppe ${i + 1}`, studentIds: [] }
      : g
  );
  return {
    id: raw.id,
    name: raw.name,
    classId: raw.class_id,
    className: raw.class_name ?? '',
    stations,
    groups: normalizedGroups,
    rotationPlan: safeParseJSON(raw.rotation_plan) ?? [],
    minutesPerStation: raw.minutes_per_station ?? 10,
  };
}

/* ================================================================
   WIZARD — 3 steg
   ================================================================ */

/**
 * Wizard-tilstand delt mellom stegene.
 */
const wiz = {
  step: 1,
  // Steg 1
  name: '',
  classId: null,
  minutesPerStation: 10,
  differentTimes: false,
  numGroups: 3,
  // Steg 2
  stations: [],   // [{ id, name, isTeacher, note, minutes }]
  // Steg 3
  students: [],   // [{ id, name }] — alle elever i klassen
  groups: [],     // [{ label, studentIds }]
  unassigned: [], // student ids ikke tildelt gruppe
};

function openWizard(dashboardContainer) {
  Object.assign(wiz, {
    step: 1,
    name: '',
    classId: null,
    minutesPerStation: 10,
    differentTimes: false,
    numGroups: 3,
    stations: [],
    students: [],
    groups: [],
    unassigned: [],
  });

  const backdrop = document.createElement('div');
  backdrop.className = 'kp-backdrop';
  backdrop.id = 'station-wizard-backdrop';
  document.body.appendChild(backdrop);

  renderWizardStep(backdrop, dashboardContainer);
}

function renderWizardStep(backdrop, dashboardContainer) {
  const steps = [
    { num: 1, label: 'Grunnoppsett' },
    { num: 2, label: 'Stasjoner' },
    { num: 3, label: 'Grupper' },
  ];

  const stepsHtml = steps.map(s => `
    <div class="wiz-step ${wiz.step === s.num ? 'active' : wiz.step > s.num ? 'done' : ''}">
      <span class="wiz-step-num">${wiz.step > s.num ? '<i class="fa-solid fa-check"></i>' : s.num}</span>
      <span class="wiz-step-label">${s.label}</span>
    </div>
    ${s.num < steps.length ? '<div class="wiz-connector"></div>' : ''}
  `).join('');

  const content = wiz.step === 1
    ? renderStep1()
    : wiz.step === 2
      ? renderStep2()
      : renderStep3();

  backdrop.innerHTML = `
    <div class="kp-modal onboarding-wizard" style="max-width:620px;width:95vw">
      <div class="modal-header">
        <span class="modal-title">
          <i class="fa-solid fa-arrows-rotate mr-2 text-primary"></i>
          Nytt stasjonssett
        </span>
      </div>
      <div class="wizard-steps-indicator">${stepsHtml}</div>
      <div id="wiz-content">${content}</div>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" id="btn-wiz-cancel">Avbryt</button>
        ${wiz.step > 1 ? '<button class="btn btn-ghost btn-sm" id="btn-wiz-back"><i class="fa-solid fa-arrow-left"></i> Tilbake</button>' : ''}
        <button class="btn btn-primary btn-sm" id="btn-wiz-next" disabled>
          ${wiz.step < 3 ? 'Neste <i class="fa-solid fa-arrow-right ml-1"></i>' : '<i class="fa-solid fa-floppy-disk mr-1"></i> Lagre'}
        </button>
      </div>
    </div>`;

  backdrop.querySelector('#btn-wiz-cancel')?.addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#btn-wiz-back')?.addEventListener('click', () => {
    wiz.step--;
    renderWizardStep(backdrop, dashboardContainer);
  });
  backdrop.querySelector('#btn-wiz-next')?.addEventListener('click', async () => {
    if (wiz.step === 1) {
      collectStep1(backdrop);
      wiz.step = 2;
      if (wiz.stations.length === 0) {
        wiz.stations = [
          { id: 0, name: 'Stasjon 1', isTeacher: false, note: '', minutes: null },
          { id: 1, name: 'Stasjon 2', isTeacher: false, note: '', minutes: null },
          { id: 2, name: 'Stasjon 3', isTeacher: false, note: '', minutes: null },
        ];
      }
      renderWizardStep(backdrop, dashboardContainer);
    } else if (wiz.step === 2) {
      collectStep2(backdrop);
      // Hent elevdata
      const cls = await window.api.getClass(wiz.classId);
      wiz.students = (safeParseJSON(cls?.students) ?? []).map(s => ({ id: s.id, name: s.name }));
      // Init grupper
      if (wiz.groups.length !== wiz.numGroups) {
        wiz.groups = Array.from({ length: wiz.numGroups }, (_, i) => ({
          label: `Gruppe ${i + 1}`,
          studentIds: [],
        }));
        wiz.unassigned = wiz.students.map(s => s.id);
      }
      wiz.step = 3;
      renderWizardStep(backdrop, dashboardContainer);
    } else {
      collectStep3(backdrop);
      await saveWizard(backdrop, dashboardContainer);
    }
  });

  // Steg-spesifik binding
  if (wiz.step === 1) bindStep1(backdrop);
  if (wiz.step === 2) bindStep2(backdrop);
  if (wiz.step === 3) bindStep3(backdrop);
}

/* ---- STEG 1 ---- */

function renderStep1() {
  const classOptions = _classes.map(c => `<option value="${c.id}" ${wiz.classId == c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  return `
    <div class="wizard-step-title">Grunnoppsett</div>
    <div class="wizard-step-desc">Gi stasjonsettet et navn og velg hvilken klasse som deltar.</div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group">
        <label class="form-label">Navn på stasjonssett</label>
        <input id="wiz-name" type="text" class="input input-bordered w-full" placeholder="f.eks. Lesekurs uke 12" value="${esc(wiz.name)}">
      </div>
      <div class="form-group">
        <label class="form-label">Klasse</label>
        <select id="wiz-class" class="select select-bordered w-full">
          <option value="">Velg klasse…</option>
          ${classOptions}
        </select>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div class="form-group" style="flex:0 0 auto">
          <label class="form-label">Minutter per stasjon</label>
          <input id="wiz-minutes" type="number" class="input input-bordered input-sm" value="${wiz.minutesPerStation}" min="1" max="120" style="width:100px">
        </div>
        <div class="form-group" style="flex:0 0 auto">
          <label class="form-label">Antall grupper</label>
          <input id="wiz-num-groups" type="number" class="input input-bordered input-sm" value="${wiz.numGroups}" min="2" max="20" style="width:80px">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input id="wiz-diff-times" type="checkbox" class="checkbox checkbox-sm" ${wiz.differentTimes ? 'checked' : ''}>
          <span>Ulike tidsintervaller per stasjon</span>
        </label>
        <div class="form-hint">Skru på for å angi egne minutter for hver stasjon i neste steg.</div>
      </div>
    </div>`;
}

function bindStep1(backdrop) {
  const validate = () => {
    const name = backdrop.querySelector('#wiz-name')?.value.trim();
    const classId = backdrop.querySelector('#wiz-class')?.value;
    const numGroups = parseInt(backdrop.querySelector('#wiz-num-groups')?.value ?? 0);
    const valid = !!(name && classId && numGroups >= 2);
    backdrop.querySelector('#btn-wiz-next').disabled = !valid;
  };
  ['#wiz-name', '#wiz-class', '#wiz-minutes', '#wiz-num-groups', '#wiz-diff-times'].forEach(sel =>
    backdrop.querySelector(sel)?.addEventListener('input', validate)
  );
  backdrop.querySelector('#wiz-class')?.addEventListener('change', validate);
  validate();
}

function collectStep1(backdrop) {
  wiz.name = backdrop.querySelector('#wiz-name')?.value.trim() ?? '';
  wiz.classId = parseInt(backdrop.querySelector('#wiz-class')?.value);
  wiz.minutesPerStation = parseInt(backdrop.querySelector('#wiz-minutes')?.value ?? 10);
  wiz.numGroups = parseInt(backdrop.querySelector('#wiz-num-groups')?.value ?? 3);
  wiz.differentTimes = backdrop.querySelector('#wiz-diff-times')?.checked ?? false;
}

/* ---- STEG 2 ---- */

function renderStep2() {
  const rows = wiz.stations.map((st, i) => renderStationRow(st, i)).join('');
  return `
    <div class="wizard-step-title">Stasjoner</div>
    <div class="wizard-step-desc">Definer stasjonsnavnene. Merk hvilken stasjon (om noen) som er <strong>Lærerstasjon</strong>.</div>
    <div id="wiz-stations-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
      ${rows}
    </div>
    <button class="btn btn-ghost btn-xs" id="btn-wiz-add-station">
      <i class="fa-solid fa-plus"></i> Legg til stasjon
    </button>`;
}

function renderStationRow(st, i) {
  return `
    <div class="wiz-station-row" data-idx="${i}" style="background:oklch(var(--b2));border:1px solid oklch(var(--b3));border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;gap:8px;align-items:center">
        <input type="text" class="input input-bordered input-sm flex-1 wiz-st-name"
          value="${esc(st.name)}" placeholder="Stasjonsnavn"
          ${st.isTeacher ? 'style="border-color:oklch(var(--a)/0.5)"' : ''}>
        <label class="flex items-center gap-1 text-xs cursor-pointer" title="Lærerstasjon">
          <input type="checkbox" class="checkbox checkbox-xs wiz-st-teacher" ${st.isTeacher ? 'checked' : ''}>
          <i class="fa-solid fa-chalkboard-user ${st.isTeacher ? 'text-accent' : 'opacity-30'}"></i>
          <span class="${st.isTeacher ? 'text-accent font-semibold' : 'opacity-50'}">Lærer</span>
        </label>
        ${wiz.differentTimes ? `<input type="number" class="input input-bordered input-xs wiz-st-minutes" value="${st.minutes ?? wiz.minutesPerStation}" min="1" max="120" style="width:64px" title="Minutter for denne stasjonen">` : ''}
        <button class="btn btn-ghost btn-xs btn-wiz-remove-station" title="Fjern stasjon"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <textarea class="textarea textarea-bordered textarea-xs w-full wiz-st-note" rows="2"
        placeholder="Notat / instruksjon for denne stasjonen (vises i presenter)">${esc(st.note ?? '')}</textarea>
    </div>`;
}

function bindStep2(backdrop) {
  const validate = () => {
    const rows = [...backdrop.querySelectorAll('.wiz-station-row')];
    const validNames = rows.filter(r => r.querySelector('.wiz-st-name')?.value.trim()).length;
    const teacherCount = rows.filter(r => r.querySelector('.wiz-st-teacher')?.checked).length;
    const valid = rows.length >= 2 && validNames === rows.length && teacherCount <= 1;
    backdrop.querySelector('#btn-wiz-next').disabled = !valid;
  };

  const list = backdrop.querySelector('#wiz-stations-list');

  const rebindRows = () => {
    list?.querySelectorAll('.wiz-station-row').forEach(row => {
      row.querySelector('.wiz-st-name')?.addEventListener('input', validate);
      row.querySelector('.wiz-st-teacher')?.addEventListener('change', (e) => {
        // Bare én lærerstasjon tillatt
        if (e.target.checked) {
          list?.querySelectorAll('.wiz-st-teacher').forEach(cb => {
            if (cb !== e.target) cb.checked = false;
          });
          // Oppdater visuell stil
          list?.querySelectorAll('.wiz-station-row').forEach(r => {
            const isT = r.querySelector('.wiz-st-teacher')?.checked;
            const nameInput = r.querySelector('.wiz-st-name');
            const icon = r.querySelector('.fa-chalkboard-user');
            const label = r.querySelector('.wiz-st-teacher + i + span') ?? r.querySelector('span:last-of-type');
            if (nameInput) nameInput.style.borderColor = isT ? 'oklch(var(--a)/0.5)' : '';
            if (icon) icon.className = `fa-solid fa-chalkboard-user ${isT ? 'text-accent' : 'opacity-30'}`;
          });
        }
        validate();
      });
      row.querySelector('.wiz-st-note')?.addEventListener('input', validate);
      row.querySelector('.wiz-st-minutes')?.addEventListener('input', validate);
      row.querySelector('.btn-wiz-remove-station')?.addEventListener('click', () => {
        row.remove();
        validate();
      });
    });
  };

  backdrop.querySelector('#btn-wiz-add-station')?.addEventListener('click', () => {
    const idx = list?.querySelectorAll('.wiz-station-row').length ?? 0;
    const row = document.createElement('div');
    const newSt = { id: idx, name: `Stasjon ${idx + 1}`, isTeacher: false, note: '', minutes: null };
    row.outerHTML; // placeholder
    list?.insertAdjacentHTML('beforeend', renderStationRow(newSt, idx));
    rebindRows();
    validate();
  });

  rebindRows();
  validate();
}

function collectStep2(backdrop) {
  const rows = [...backdrop.querySelectorAll('.wiz-station-row')];
  wiz.stations = rows.map((row, i) => ({
    id: i,
    name: row.querySelector('.wiz-st-name')?.value.trim() ?? `Stasjon ${i + 1}`,
    isTeacher: row.querySelector('.wiz-st-teacher')?.checked ?? false,
    note: row.querySelector('.wiz-st-note')?.value.trim() ?? '',
    minutes: wiz.differentTimes
      ? parseInt(row.querySelector('.wiz-st-minutes')?.value ?? wiz.minutesPerStation) || null
      : null,
  }));
}

/* ---- STEG 3 — Grupper med drag-and-drop ---- */

function renderStep3() {
  const studentsById = Object.fromEntries(wiz.students.map(s => [s.id, s]));

  const unassignedChips = wiz.unassigned
    .map(sid => `<div class="student-chip" draggable="true" data-student-id="${sid}">${esc(studentsById[sid]?.name ?? sid)}</div>`)
    .join('');

  const groupBuckets = wiz.groups.map((g, gi) => `
    <div style="margin-bottom:10px">
      <div class="group-bucket-label" style="display:flex;align-items:center;justify-content:space-between">
        <input type="text" class="input input-bordered input-xs wiz-group-label" data-gi="${gi}"
          value="${esc(g.label)}" style="width:120px">
        <span class="text-xs opacity-40">${g.studentIds.length} elev(er)</span>
      </div>
      <div class="group-bucket" id="group-bucket-${gi}" data-gi="${gi}">
        ${g.studentIds.map(sid =>
          `<div class="student-chip" draggable="true" data-student-id="${sid}">${esc(studentsById[sid]?.name ?? sid)}</div>`
        ).join('')}
      </div>
    </div>
  `).join('');

  const allAssigned = wiz.unassigned.length === 0;
  const assignedCount = wiz.groups.reduce((s, g) => s + g.studentIds.length, 0);

  return `
    <div class="wizard-step-title">Grupper</div>
    <div class="wizard-step-desc">
      Dra elever fra "Ikke tildelt" ned i en gruppe. Alle elever må tildeles for å kunne lagre.
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:10px">
      <button class="btn btn-ghost btn-xs" id="btn-wiz-clear-groups">
        <i class="fa-solid fa-rotate-left"></i> Tøm alle grupper
      </button>
      <button class="btn btn-ghost btn-xs" id="btn-wiz-auto-distribute">
        <i class="fa-solid fa-wand-magic-sparkles"></i> Auto-fordel
      </button>
    </div>

    <div style="margin-bottom:14px">
      <div class="group-bucket-label">
        Ikke tildelt
        <span class="badge badge-sm ml-2 ${wiz.unassigned.length > 0 ? 'badge-warning' : 'badge-success'}">${wiz.unassigned.length}</span>
      </div>
      <div class="group-bucket" id="group-bucket-unassigned" data-gi="-1">
        ${unassignedChips}
      </div>
    </div>

    <div id="wiz-groups-area">
      ${groupBuckets}
    </div>

    <div id="wiz-validation-msg" style="font-size:12px;color:oklch(var(--wa));margin-top:6px;${allAssigned ? 'display:none' : ''}">
      <i class="fa-solid fa-triangle-exclamation"></i>
      ${wiz.students.length - assignedCount} elev(er) er ikke tildelt en gruppe.
    </div>`;
}

function bindStep3(backdrop) {
  const validate = () => {
    const allAssigned = wiz.unassigned.length === 0;
    backdrop.querySelector('#btn-wiz-next').disabled = !allAssigned;
    const msgEl = backdrop.querySelector('#wiz-validation-msg');
    if (msgEl) msgEl.style.display = allAssigned ? 'none' : '';
    // Oppdater teller i bucket-labels
    wiz.groups.forEach((g, gi) => {
      const label = backdrop.querySelector(`[data-gi="${gi}"].wiz-group-label`);
      if (!label) return;
      const countEl = label.closest('div')?.querySelector('.text-xs.opacity-40');
      if (countEl) countEl.textContent = `${g.studentIds.length} elev(er)`;
    });
    // Oppdater unassigned badge
    const badge = backdrop.querySelector('#group-bucket-unassigned')?.previousElementSibling?.querySelector('.badge');
    if (badge) {
      badge.textContent = wiz.unassigned.length;
      badge.className = `badge badge-sm ml-2 ${wiz.unassigned.length > 0 ? 'badge-warning' : 'badge-success'}`;
    }
  };

  // Drag-and-drop
  let _dragStudentId = null;

  const setupDraggable = (chip) => {
    chip.addEventListener('dragstart', (e) => {
      _dragStudentId = chip.dataset.studentId;
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
    });
  };

  const setupBucket = (bucket) => {
    bucket.addEventListener('dragover', (e) => {
      e.preventDefault();
      bucket.classList.add('drag-over');
    });
    bucket.addEventListener('dragleave', () => bucket.classList.remove('drag-over'));
    bucket.addEventListener('drop', (e) => {
      e.preventDefault();
      bucket.classList.remove('drag-over');
      if (!_dragStudentId) return;
      const targetGi = parseInt(bucket.dataset.gi);
      moveStudent(_dragStudentId, targetGi);
      _dragStudentId = null;
    });
  };

  // Init drag on existing chips
  backdrop.querySelectorAll('.student-chip').forEach(setupDraggable);
  backdrop.querySelectorAll('.group-bucket').forEach(setupBucket);

  // Flytt elev mellom grupper / unassigned
  const moveStudent = (studentId, targetGi) => {
    // Fjern fra nåværende plassering
    wiz.unassigned = wiz.unassigned.filter(id => id !== studentId);
    wiz.groups.forEach(g => {
      g.studentIds = g.studentIds.filter(id => id !== studentId);
    });
    // Legg til ny plassering
    if (targetGi === -1) {
      wiz.unassigned.push(studentId);
    } else {
      wiz.groups[targetGi]?.studentIds.push(studentId);
    }
    // Re-render steg 3-innholdet
    const content = backdrop.querySelector('#wiz-content');
    if (content) {
      content.innerHTML = renderStep3();
      bindStep3(backdrop);
    }
    validate();
  };

  // Auto-fordel
  backdrop.querySelector('#btn-wiz-auto-distribute')?.addEventListener('click', () => {
    if (wiz.students.length === 0) return;
    const studentIds = wiz.students.map(s => s.id);
    const studentsById = Object.fromEntries(wiz.students.map(s => [s.id, s]));
    try {
      const result = generateGroups({
        studentIds,
        studentsById,
        numGroups: wiz.numGroups,
        useConstraints: false,
      });
      wiz.groups = result.groups.map((gIds, i) => ({
        label: wiz.groups[i]?.label ?? `Gruppe ${i + 1}`,
        studentIds: gIds,
      }));
      wiz.unassigned = [];
    } catch {
      // Fallback: jevn fordeling
      const shuffled = [...studentIds].sort(() => Math.random() - 0.5);
      wiz.groups = Array.from({ length: wiz.numGroups }, (_, i) => ({
        label: wiz.groups[i]?.label ?? `Gruppe ${i + 1}`,
        studentIds: shuffled.filter((_, idx) => idx % wiz.numGroups === i),
      }));
      wiz.unassigned = [];
    }
    const content = backdrop.querySelector('#wiz-content');
    if (content) {
      content.innerHTML = renderStep3();
      bindStep3(backdrop);
    }
    validate();
  });

  // Tøm alle grupper
  backdrop.querySelector('#btn-wiz-clear-groups')?.addEventListener('click', () => {
    wiz.unassigned = wiz.students.map(s => s.id);
    wiz.groups = wiz.groups.map(g => ({ ...g, studentIds: [] }));
    const content = backdrop.querySelector('#wiz-content');
    if (content) {
      content.innerHTML = renderStep3();
      bindStep3(backdrop);
    }
    validate();
  });

  // Gruppe-label editing
  backdrop.querySelectorAll('.wiz-group-label').forEach(input => {
    input.addEventListener('change', () => {
      const gi = parseInt(input.dataset.gi);
      if (wiz.groups[gi]) wiz.groups[gi].label = input.value.trim() || `Gruppe ${gi + 1}`;
    });
  });

  validate();
}

function collectStep3(backdrop) {
  // Samle eventuelle gruppe-label-endringer
  backdrop.querySelectorAll('.wiz-group-label').forEach(input => {
    const gi = parseInt(input.dataset.gi);
    if (wiz.groups[gi]) wiz.groups[gi].label = input.value.trim() || `Gruppe ${gi + 1}`;
  });
}

/* ---- Lagre ---- */

async function saveWizard(backdrop, dashboardContainer) {
  if (!wiz.name || !wiz.classId || wiz.stations.length < 2 || wiz.numGroups < 2) return;

  const rotationPlan = buildRotationPlan(wiz.numGroups, wiz.stations.length);

  await window.api.saveStationSession({
    name: wiz.name,
    classId: wiz.classId,
    stations: wiz.stations,
    groups: wiz.groups,
    rotationPlan,
    minutesPerStation: wiz.minutesPerStation,
  });

  showToast('Stasjonssett lagret!', 'success');
  backdrop.remove();
  _sessions = await window.api.getStationSessions();
  renderDashboard(dashboardContainer);
}
