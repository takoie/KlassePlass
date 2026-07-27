/**
 * Felles render-funksjon for bord.
 * Brukes av: seating-editor, seating-display, presentation.
 * Maks 300 linjer — hold den tynn.
 */

import { DESK_TYPES, DESK_COLOR_CLASS } from './constants.js';

/**
 * @param {HTMLElement} container
 * @param {Array} desks - desk-objekter (allerede transformert for koordinater)
 * @param {Object} studentsById - Map<studentId, { name, note }>
 * @param {Object} options
 * @param {boolean} options.interactive      - Legg til drag/drop handlers
 * @param {boolean} options.showNames        - Vis elevnavn (default true)
 * @param {boolean} options.showNumbers      - Vis bordnumre
 * @param {boolean} options.showGroups       - Vis gruppefarger
 * @param {boolean} options.hideIcons        - Skjul alle lås/notat ikoner
 * @param {boolean} options.hideLocks        - Skjul lås-ikoner
 * @param {boolean} options.hideNotes        - Skjul notat-ikoner
 * @param {Function} options.onStudentDrop   - (sourceDeskId, sourceSlot, targetDeskId, targetSlot)
 * @param {Function} options.onDeskContextMenu - (deskId, event)
 * @param {Function} options.onStudentContextMenu - (deskId, slotIndex, event)
 */
export function renderDesks(container, desks, studentsById, options = {}) {
  const {
    interactive = false,
    showNames = true,
    showNumbers = false,
    showGroups = false,
    hideIcons = false,
    hideLocks = false,
    hideNotes = false,
    onStudentDrop = null,
    onDeskContextMenu = null,
    onStudentContextMenu = null,
  } = options;

  container.innerHTML = '';

  desks.forEach((desk, idx) => {
    const el = buildDeskElement(desk, idx, studentsById, {
      interactive, showNames, showNumbers, showGroups,
      hideIcons, hideLocks, hideNotes,
      onStudentDrop, onDeskContextMenu, onStudentContextMenu,
    });
    container.appendChild(el);
  });
}

function buildDeskElement(desk, idx, studentsById, opts) {
  const typeInfo = DESK_TYPES[desk.type] ?? DESK_TYPES.single;
  const colorClass = DESK_COLOR_CLASS[desk.color ?? 'default'] ?? 'desk-color-default';
  const isRound = desk.type.startsWith('round');
  const groupClass = opts.showGroups && desk.groupId != null
    ? `desk-group-${(desk.groupId % 8) + 1}`
    : '';

  const el = document.createElement('div');
  el.className = [
    'desk',
    `desk-${desk.type}`,
    colorClass,
    groupClass,
    opts.interactive ? 'desk-interactive' : '',
  ].filter(Boolean).join(' ');

  el.dataset.deskId = desk.id;
  el.style.cssText = `left:${desk.x}px;top:${desk.y}px;width:${typeInfo.width}px;height:${typeInfo.height}px;`;
  if (desk.rotation) el.style.transform = `rotate(${desk.rotation}deg)`;

  // Gruppenummer for fargeblind-sikker visning
  if (opts.showGroups && desk.groupId != null) {
    const groupNum = document.createElement('span');
    groupNum.className = 'desk-group-number';
    groupNum.textContent = (desk.groupId % 8) + 1;
    groupNum.setAttribute('aria-hidden', 'true');
    el.appendChild(groupNum);
  }

  if (opts.showNumbers) {
    const num = document.createElement('span');
    num.className = 'desk-number';
    num.textContent = idx + 1;
    el.appendChild(num);
  }

  // Render slots
  const slots = desk.slots ?? [];
  slots.forEach((slot, slotIdx) => {
    const slotEl = buildSlotElement(desk, slotIdx, slot, studentsById, opts, isRound);
    el.appendChild(slotEl);
  });

  if (opts.onDeskContextMenu) {
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      opts.onDeskContextMenu(desk.id, e);
    });
  }

  // Desk-level drag fallback: catches drops on the padding area between the
  // desk border and the slots, and drops that miss individual slot elements
  // (common with round tables and small slots).
  if (opts.interactive && opts.onStudentDrop) {
    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    el.addEventListener('drop', e => {
      // Only handle if no slot already handled it (slot handlers call stopPropagation)
      e.preventDefault();
      const data = _parseDropData(e.dataTransfer);
      if (!data) return;

      // Find the best target slot: prefer empty slots, fall back to first slot
      const slotEls = el.querySelectorAll('.desk-slot');
      let targetSlotIdx = 0;
      // Find the slot the pointer is closest to
      let bestDist = Infinity;
      slotEls.forEach((slotEl, i) => {
        const r = slotEl.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (dist < bestDist) { bestDist = dist; targetSlotIdx = i; }
      });

      if (data.fromSidebar) {
        const customEvt = new CustomEvent('sidebar-drop', {
          bubbles: true,
          detail: { studentId: data.studentId, deskId: desk.id, slotIdx: targetSlotIdx },
        });
        el.dispatchEvent(customEvt);
      } else if (data.deskId !== undefined) {
        opts.onStudentDrop(data.deskId, data.slotIdx, desk.id, targetSlotIdx);
      }
    });
  }

  return el;
}

function _parseDropData(dataTransfer) {
  try {
    const raw = dataTransfer.getData('text/plain');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildSlotElement(desk, slotIdx, slot, studentsById, opts, isRound) {
  const el = document.createElement('div');
  el.className = 'desk-slot';
  el.dataset.deskId = desk.id;
  el.dataset.slotIdx = slotIdx;

  const student = slot ? studentsById[slot.studentId] : null;

  if (student && !opts.showNames) {
    // Hidden name mode (e.g. student-build) — show placeholder
    const placeholder = document.createElement('span');
    placeholder.className = 'student-name';
    placeholder.textContent = '?';
    placeholder.style.opacity = '0.3';
    el.appendChild(placeholder);
  } else if (opts.showNames && student) {
    const nameEl = document.createElement('span');
    nameEl.className = 'student-name';
    nameEl.textContent = student.name;

    if (opts.interactive) {
      nameEl.draggable = true;
      nameEl.addEventListener('dragstart', e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
          deskId: desk.id, slotIdx,
        }));
        nameEl.closest('.desk')?.classList.add('drag-source');
      });
      nameEl.addEventListener('dragend', () => {
        nameEl.closest('.desk')?.classList.remove('drag-source');
      });
    }

    el.appendChild(nameEl);

    if (!opts.hideIcons) {
      if (slot.locked && !opts.hideLocks) {
        const lock = document.createElement('i');
        lock.className = 'fa-solid fa-lock lock-icon';
        lock.title = 'Låst posisjon';
        el.appendChild(lock);
      }
      if (student.note && !opts.hideNotes) {
        const note = document.createElement('i');
        note.className = 'fa-solid fa-note-sticky note-icon';
        note.title = student.note;
        el.appendChild(note);
      }
    }
  } else if (!student) {
    el.classList.add('desk-slot-empty');
  }

  if (opts.interactive && opts.onStudentDrop) {
    el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); });
    el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over'); });
    el.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('drag-over');
      const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
      if (data.fromSidebar) {
        // Sidebar drop: handled by seating-editor's canvas-level listener
        // Re-dispatch on slot so seating-editor can catch it
        el.dataset.dropStudentId = data.studentId;
        const customEvt = new CustomEvent('sidebar-drop', { bubbles: true, detail: { studentId: data.studentId, deskId: desk.id, slotIdx } });
        el.dispatchEvent(customEvt);
      } else if (data.deskId !== undefined) {
        opts.onStudentDrop(data.deskId, data.slotIdx, desk.id, slotIdx);
      }
    });
  }

  if (opts.onStudentContextMenu && student) {
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      opts.onStudentContextMenu(desk.id, slotIdx, e);
    });
  }

  return el;
}
