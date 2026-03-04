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
 * @param {boolean} options.hideIcons        - Skjul lås/notat ikoner (presentasjon)
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
    onStudentDrop = null,
    onDeskContextMenu = null,
    onStudentContextMenu = null,
  } = options;

  container.innerHTML = '';

  desks.forEach((desk, idx) => {
    const el = buildDeskElement(desk, idx, studentsById, {
      interactive, showNames, showNumbers, showGroups, hideIcons,
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

  return el;
}

function buildSlotElement(desk, slotIdx, slot, studentsById, opts, isRound) {
  const el = document.createElement('div');
  el.className = 'desk-slot';
  el.dataset.deskId = desk.id;
  el.dataset.slotIdx = slotIdx;

  const student = slot ? studentsById[slot.studentId] : null;

  if (opts.showNames && student) {
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
      if (slot.locked) {
        const lock = document.createElement('i');
        lock.className = 'fa-solid fa-lock lock-icon';
        lock.title = 'Låst posisjon';
        el.appendChild(lock);
      }
      if (student.note) {
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
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
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
