/**
 * onboarding-wizard.js — Veiviser for nye brukere.
 * Loser brukeren gjennom: opprett klasse → velg romoppsett → lag klassekart.
 * Vises automatisk første gang appen åpnes uten data.
 *
 * Eksporterer: showOnboardingWizard(onComplete)
 */

import { getPortal, focusAfterRender, showToast } from '../shared/utils.js';
import { applyAutoGenerate } from './room-editor-generate.js';

const LAYOUT_PRESETS = [
  { label: '2 grupper × 2 bord (4 bord per rad)', groups: [2, 2] },
  { label: '3 grupper × 2 bord (6 bord per rad)', groups: [2, 2, 2] },
  { label: '4 grupper × 2 bord (8 bord per rad)', groups: [2, 2, 2, 2] },
  { label: '3 grupper ulik bredde (7 bord per rad)', groups: [2, 3, 2] },
  { label: '3 grupper × 3 bord (9 bord per rad)', groups: [3, 3, 3] },
  { label: 'Eksamen (enkeltbord i kolonner)', groups: [1, 1, 1, 1, 1] },
];

/**
 * Åpner onboarding-wizarden som en modal.
 * @param {Function} onComplete — kalles med { classId, roomId } etter fullføring, slik at
 *                                 dashbordet kan tilby å lage klassekart med det samme.
 */
export function showOnboardingWizard(onComplete) {
  const portal = getPortal();

  let _step = 1;
  let _className = '';
  let _students  = [];   // [{ id, name, note, placement }]
  let _presetIdx = 1;    // default: 2-2-2
  let _rows      = 5;

  /* ---- Bygg DOM ---- */
  const backdrop = document.createElement('div');
  backdrop.className = 'kp-backdrop';
  backdrop.style.cssText = 'z-index:10001';
  backdrop.innerHTML = `
    <div class="kp-modal onboarding-wizard" style="max-width:520px;min-width:340px">
      <div class="wizard-steps-indicator" id="wiz-steps-bar"></div>
      <div id="wiz-body"></div>
      <div class="modal-footer" id="wiz-footer"></div>
    </div>`;

  portal.appendChild(backdrop);

  /* ---- Steg-indikator ---- */
  function renderStepsBar() {
    const bar = backdrop.querySelector('#wiz-steps-bar');
    const labels = ['Klasse', 'Klasserom', 'Klar!'];
    bar.innerHTML = labels.map((l, i) => {
      const num   = i + 1;
      const active = num === _step ? 'wiz-step-active' : '';
      const done   = num < _step   ? 'wiz-step-done'   : '';
      return `
        <div class="wiz-step ${active} ${done}">
          <span class="wiz-step-num">${done ? '✓' : num}</span>
          <span class="wiz-step-label">${l}</span>
        </div>
        ${i < labels.length - 1 ? '<div class="wiz-step-line"></div>' : ''}`;
    }).join('');
  }

  /* ================================================================
     STEG 1 — Opprett klasse
     ================================================================ */
  function renderStep1() {
    const body = backdrop.querySelector('#wiz-body');
    body.innerHTML = `
      <h2 class="wizard-step-title">
        <i class="fa-solid fa-users" style="color:oklch(var(--p))"></i>
        Opprett din første klasse
      </h2>
      <p class="wizard-step-desc">
        Gi klassen et navn og legg til elevene. Du kan endre dette når som helst etterpå.
      </p>
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label" for="wiz-class-name">Klassenavn</label>
        <input id="wiz-class-name" type="text" class="input input-bordered w-full"
          placeholder="f.eks. 8A, Klasse 1A, Norsk VG1…"
          value="${_escHtml(_className)}" autocomplete="off">
      </div>
      <div class="form-group" style="margin-bottom:6px">
        <label class="form-label" for="wiz-students">Elever</label>
        <p style="font-size:12px;color:oklch(var(--bc)/0.55);margin:-2px 0 8px">
          Lim inn eller skriv ett navn per linje. Du kan legge til flere elever etterpå.
        </p>
        <textarea id="wiz-students" class="students-textarea" rows="8"
          placeholder="Ola Nordmann&#10;Kari Hansen&#10;Per Olsen&#10;…"
          style="min-height:140px">${_escHtml(_students.map(s => s.name).join('\n'))}</textarea>
        <div id="wiz-student-count" class="form-hint" style="margin-top:6px"></div>
      </div>`;

    const nameInput = body.querySelector('#wiz-class-name');
    const textarea  = body.querySelector('#wiz-students');
    const countHint = body.querySelector('#wiz-student-count');

    const updateCount = () => {
      const names = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
      countHint.textContent = names.length > 0 ? `${names.length} elever` : '';
    };

    nameInput.addEventListener('input', () => { _className = nameInput.value; updateNext1(); });
    textarea.addEventListener('input', updateCount);
    updateCount();
    focusAfterRender(nameInput);

    const footer = backdrop.querySelector('#wiz-footer');
    footer.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="wiz-skip">Hopp over</button>
      <button class="btn btn-primary btn-sm" id="wiz-next1" disabled>
        Neste <i class="fa-solid fa-arrow-right"></i>
      </button>`;

    footer.querySelector('#wiz-skip').addEventListener('click', () => {
      backdrop.remove();
    });
    footer.querySelector('#wiz-next1').addEventListener('click', () => {
      _className = nameInput.value.trim();
      const names = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
      _students = names.map((name, i) => ({ id: `new-${Date.now()}-${i}`, name, note: '', placement: null }));
      _step = 2;
      render();
    });

    function updateNext1() {
      const btn = footer.querySelector('#wiz-next1');
      if (btn) btn.disabled = !nameInput.value.trim();
    }
    updateNext1();
  }

  /* ================================================================
     STEG 2 — Velg romoppsett
     ================================================================ */
  function renderStep2() {
    const body = backdrop.querySelector('#wiz-body');
    body.innerHTML = `
      <h2 class="wizard-step-title">
        <i class="fa-solid fa-door-open" style="color:oklch(var(--p))"></i>
        Velg romoppsett
      </h2>
      <p class="wizard-step-desc">
        KlassePlass genererer et klasserom for deg. Du kan tegne ditt eget rom i detalj etterpå.
      </p>
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label" for="wiz-layout">Bordsoppsett</label>
        <select id="wiz-layout" class="select select-bordered w-full">
          ${LAYOUT_PRESETS.map((p, i) => `<option value="${i}" ${i === _presetIdx ? 'selected' : ''}>${_escHtml(p.label)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:6px">
        <label class="form-label" for="wiz-rows">Antall rader</label>
        <div style="display:flex;align-items:center;gap:10px">
          <input id="wiz-rows" type="number" class="input input-bordered input-sm"
            min="1" max="12" value="${_rows}" style="width:80px">
          <span id="wiz-capacity-hint" class="form-hint"></span>
        </div>
      </div>
      <div id="wiz-layout-preview" class="wiz-layout-preview"></div>`;

    const layoutSel = body.querySelector('#wiz-layout');
    const rowsInput = body.querySelector('#wiz-rows');
    const hint      = body.querySelector('#wiz-capacity-hint');
    const preview   = body.querySelector('#wiz-layout-preview');

    function updatePreview() {
      _presetIdx = parseInt(layoutSel.value);
      _rows      = Math.max(1, Math.min(12, parseInt(rowsInput.value) || 5));
      rowsInput.value = _rows;

      const groups  = LAYOUT_PRESETS[_presetIdx].groups;
      const desksPerRow = groups.reduce((s, g) => s + g, 0);
      const total   = desksPerRow * _rows;
      const studCount = _students.length;

      if (studCount > 0) {
        const diff = studCount - total;
        if (diff === 0) {
          hint.textContent = `${total} plasser — passer perfekt til ${studCount} elever ✓`;
          hint.style.color = 'oklch(var(--su))';
        } else if (diff > 0) {
          hint.textContent = `${total} plasser — ${diff} elev${diff === 1 ? '' : 'er'} vil stå uten plass`;
          hint.style.color = 'oklch(var(--wa))';
        } else {
          hint.textContent = `${total} plasser — ${Math.abs(diff)} ledig${Math.abs(diff) === 1 ? '' : 'e'} plasser`;
          hint.style.color = 'oklch(var(--bc)/0.5)';
        }
      } else {
        hint.textContent = `${total} plasser totalt`;
        hint.style.color = '';
      }

      // Mini-forhåndsvisning av rader
      preview.innerHTML = '';
      const scale = Math.min(1, 420 / 920);
      const wrap = document.createElement('div');
      wrap.style.cssText = `transform:scale(${scale});transform-origin:top left;height:${(55 + 30) * _rows * scale + 20}px;position:relative;`;
      for (let r = 0; r < Math.min(_rows, 6); r++) {
        let x = 30;
        const y = r * (55 + 30) + 10;
        for (let g = 0; g < groups.length; g++) {
          for (let i = 0; i < groups[g]; i++) {
            const desk = document.createElement('div');
            desk.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:85px;height:55px;
              background:oklch(var(--b3));border:2px solid oklch(var(--bc)/0.2);border-radius:6px;`;
            wrap.appendChild(desk);
            x += 85 + 2;
          }
          if (g < groups.length - 1) x += 40;
        }
      }
      if (_rows > 6) {
        const more = document.createElement('div');
        more.style.cssText = 'font-size:11px;opacity:0.4;text-align:center;padding-top:4px;';
        more.textContent = `… og ${_rows - 6} rader til`;
        wrap.appendChild(more);
      }
      preview.appendChild(wrap);
    }

    layoutSel.addEventListener('change', updatePreview);
    rowsInput.addEventListener('input', updatePreview);
    updatePreview();

    const footer = backdrop.querySelector('#wiz-footer');
    footer.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="wiz-back2">
        <i class="fa-solid fa-arrow-left"></i> Tilbake
      </button>
      <button class="btn btn-primary btn-sm" id="wiz-next2">
        Lag klassekart <i class="fa-solid fa-wand-magic-sparkles"></i>
      </button>`;

    footer.querySelector('#wiz-back2').addEventListener('click', () => { _step = 1; render(); });
    footer.querySelector('#wiz-next2').addEventListener('click', () => doFinish());
  }

  /* ================================================================
     STEG 3 — Lagre og fullfør
     ================================================================ */
  async function doFinish() {
    const btn = backdrop.querySelector('#wiz-next2');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading loading-spinner loading-sm"></span> Lagrer…'; }

    try {
      // 1) Lagre klasse
      const classResult = await window.api.saveClass({
        id: null,
        name: _className,
        students: JSON.stringify(_students),
      });
      const classId = classResult.lastID;

      // 2) Generer romdesign
      const roomObj = { desks: [], decorations: [], designMode: 'board-top', roomHeight: 500 };
      applyAutoGenerate(LAYOUT_PRESETS[_presetIdx].groups, _rows, false, roomObj, () => {});

      // 3) Lagre rom
      const roomResult = await window.api.saveRoom({
        id: null,
        name: `${_className} — rom`,
        layout_data: JSON.stringify(roomObj),
        design_mode: 'board-top',
        room_height: 500,
      });
      const roomId = roomResult.lastID;

      // 4) Vis steg 3 (bekreftelse) og tilby å gå til klassekart
      _step = 3;
      renderStep3(classId, roomId);

    } catch (err) {
      if (btn) { btn.disabled = false; btn.innerHTML = 'Lag klassekart <i class="fa-solid fa-wand-magic-sparkles"></i>'; }
      console.error('Onboarding wizard error:', err);
      showToast('Feil ved oppretting. Prøv igjen.', 'error');
    }
  }

  function renderStep3(classId, roomId) {
    const body = backdrop.querySelector('#wiz-body');
    body.innerHTML = `
      <div style="text-align:center;padding:16px 0 8px">
        <div style="font-size:48px;margin-bottom:12px">🎉</div>
        <h2 class="wizard-step-title" style="justify-content:center">Alt er klart!</h2>
        <p class="wizard-step-desc" style="text-align:center">
          Klassen <strong>${_escHtml(_className)}</strong> er opprettet med ${_students.length} elever,
          og klasserommet er tegnet og klart.
        </p>
        <p style="font-size:13px;color:oklch(var(--bc)/0.55);margin-top:8px">
          Klikk nedenfor for å lage ditt første klassekart, eller utforsk appen på egen hånd.
        </p>
      </div>`;

    const footer = backdrop.querySelector('#wiz-footer');
    footer.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="wiz-done-later">Gjør det senere</button>
      <button class="btn btn-primary btn-sm" id="wiz-done-chart">
        <i class="fa-solid fa-wand-magic-sparkles"></i> Lag første klassekart
      </button>`;

    footer.querySelector('#wiz-done-later').addEventListener('click', () => {
      backdrop.remove();
      onComplete?.({ classId, roomId, goToChart: false });
    });
    footer.querySelector('#wiz-done-chart').addEventListener('click', () => {
      backdrop.remove();
      onComplete?.({ classId, roomId, goToChart: true });
    });
  }

  /* ---- Hoved-render ---- */
  function render() {
    renderStepsBar();
    if (_step === 1) renderStep1();
    else if (_step === 2) renderStep2();
  }

  render();

  // Ikke lukk ved klikk utenfor — wizarden er bevisst modal
  backdrop.addEventListener('click', e => e.stopPropagation());
}

function _escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
