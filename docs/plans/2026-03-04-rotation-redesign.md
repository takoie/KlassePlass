# Rotation Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the mathematical coordinate-flip approach with a CSS `rotate(180deg)` on the canvas element, add CSS counter-rotation for all text elements, rename all "tavle øverst/nederst" labels to "Roter visning", and ensure everything (desks, decorations, text, board indicator) looks correct from any rotation.

**Architecture:** The canvas element (`#seating-canvas` / `#room-canvas`) gets a CSS class `canvas-rotated` when rotation is active. Child text elements (`.student-name`, `.desk-number`, `.front-board`, `.decoration` icon/label, desk type labels) get CSS counter-rotation (`rotate(-180deg)`) so they remain readable. The mathematical `flipDesks()` transform and `getDisplayDesks()` call are **removed** from the render pipeline — the data model is never mutated for display. Drag/drop hit-testing must account for the 180° canvas transform.

**Tech Stack:** Vanilla JS, CSS transforms, Tailwind/DaisyUI, Electron (rebuild worktree at `F:\stian.taknes.no\Git\KlassePlass\.worktrees\rebuild`)

---

## Files overview

| File | Role |
|---|---|
| `src/styles/canvas.css` | All CSS — add `.canvas-rotated` + counter-rotation rules |
| `src/shared/transforms.js` | Remove `flipDesks` usage from render path (keep function for potential future use) |
| `src/shared/renderDesks.js` | No changes needed (CSS handles it) |
| `src/views/seating-editor.js` | Remove `getDisplayDesks` call, toggle `canvas-rotated` class, update UI label, fix drag hit-test |
| `src/views/room-editor.js` | Replace radio "Tavle øverst/Tavle nederst" with single rotate button, toggle `canvas-rotated`, fix drag hit-test |
| `src/views/settings.js` | Update label "Standard visning" hint text |

---

## Task 1: Add CSS for canvas rotation and text counter-rotation

**Files:**
- Modify: `src/styles/canvas.css`

**Step 1: Add these CSS rules** at the end of the `canvas.css` file (after all existing rules):

```css
/* ---- Canvas 180° rotation ---- */
.seating-canvas.canvas-rotated,
.room-canvas.canvas-rotated {
  transform: rotate(180deg);
  transform-origin: center center;
}

/* Counter-rotate all text inside a rotated canvas so it stays readable */
.canvas-rotated .student-name,
.canvas-rotated .desk-number,
.canvas-rotated .desk-slot,
.canvas-rotated .room-desk > span {
  transform: rotate(-180deg);
  display: inline-block;
}

/* Keep the TAVLE board label readable */
.canvas-rotated .front-board {
  transform: translateX(-50%) rotate(-180deg);
}

/* Decoration icons and labels */
.canvas-rotated .decoration {
  /* Decorations are absolutely positioned with their own rotation already applied inline.
     We need their content (icons, text) to be counter-rotated.
     We achieve this by adding the counter-rotation to the decoration's own transform
     in JS, not CSS, because the inline style overrides CSS transform. See Task 3. */
}
```

**Step 2: Verify** — open the app (npm start from worktree), open a seating chart, click the rotate button. All text should be readable right-way-up. The "TAVLE" label should move to what is visually the top.

**Step 3: Commit**

```bash
cd F:\stian.taknes.no\Git\KlassePlass\.worktrees\rebuild
git add src/styles/canvas.css
git commit -m "style: add canvas-rotated CSS class with text counter-rotation"
```

---

## Task 2: Update seating-editor — switch from coordinate flip to CSS class toggle

**Files:**
- Modify: `src/views/seating-editor.js`

### Step 1: Remove `getDisplayDesks` from render()

Find this block in `render()` (around line 124):
```js
const displayDesks = getDisplayDesks(_chart.desks, _chart.roomHeight, _chart.flipForDisplay);
```

Replace it with:
```js
const displayDesks = _chart.desks;
```

Also find the canvas rotation logic. After `canvas.style.minHeight = ...`, add:
```js
canvas.classList.toggle('canvas-rotated', !!_chart.flipForDisplay);
```

The board position logic already handles `flipForDisplay` to show "TAVLE" at bottom — keep it:
```js
const showAtBottom = _chart.roomDesignMode === 'board-bottom' || _chart.flipForDisplay;
board?.classList.toggle('board-bottom', showAtBottom);
board?.classList.toggle('board-top', !showAtBottom);
```

### Step 2: Update UI button label

Find in TEMPLATE (around line 40):
```html
<button class="btn btn-ghost btn-sm" id="btn-flip-view" title="Snu visning (speil bord)">
  <i class="fa-solid fa-rotate-180"></i> Snu visning
</button>
```

Change to:
```html
<button class="btn btn-ghost btn-sm" id="btn-flip-view" title="Roter visning 180°">
  <i class="fa-solid fa-rotate-180"></i> Roter visning
</button>
```

### Step 3: Fix drag/drop hit-testing when canvas is rotated

When the canvas is rotated 180°, `e.clientX/Y` coordinates are from the *original* (unrotated) viewport origin. The canvas `getBoundingClientRect()` still reflects the visual bounding box correctly (same position, same size), but the *internal* coordinate mapping is flipped: what the user drags at visual position (vx, vy) within the canvas corresponds to internal coordinates (canvasW - vx, canvasH - vy).

Find `handleStudentSwap` and any drop handlers that compute canvas-relative coordinates. Look for code that reads `e.clientX - rect.left` and `e.clientY - rect.top`. After computing `localX` and `localY`, add:

```js
// If canvas is rotated 180°, mirror the hit coordinates
if (_chart.flipForDisplay) {
  localX = canvasWidth - localX;
  localY = _chart.roomHeight - localY;
}
```

Where `canvasWidth` = `CANVAS_W` constant (920).

> **Note:** In the seating editor, swaps are done by desk ID via drag-and-drop on individual desk elements, not by raw coordinate. Because each desk element is a child of the rotated canvas, pointer events still target the correct element. The coordinate correction is only needed if there is any code that resolves desk from (x,y) coordinates. Search for `getBoundingClientRect` in `seating-editor.js` and check each usage.

### Step 4: Remove the `getDisplayDesks` import (if no longer used)

Check top of file for:
```js
import { getDisplayDesks } from '../shared/transforms.js';
```
If `getDisplayDesks` is no longer called anywhere in the file, remove this import.

### Step 5: Commit

```bash
git add src/views/seating-editor.js
git commit -m "feat: use CSS canvas rotation in seating editor instead of coordinate flip"
```

---

## Task 3: Handle decoration transform when canvas is rotated (seating-editor)

**Files:**
- Modify: `src/views/seating-editor.js` — `renderDecorations()`

Decorations use inline `style.transform = rotate(Xdeg)`. Because the canvas itself is CSS-rotated 180°, the decoration is additionally rotated 180°. The decoration's *position* (x, y) also needs to be mirrored, as decorations are positioned with `left`/`top` inside the rotated canvas.

Find `renderDecorations()` (around line 148):

```js
function renderDecorations(canvas) {
  canvas.querySelectorAll('.decoration').forEach(el => el.remove());
  (_chart.decorations ?? []).forEach(deco => {
    const el = document.createElement('div');
    el.className = `decoration decoration-${deco.type}`;
    el.style.cssText = `left:${deco.x}px;top:${deco.y}px;width:${deco.width}px;height:${deco.height}px;pointer-events:none;`;
    if (deco.rotation) el.style.transform = `rotate(${deco.rotation}deg)`;
    if (deco.type === 'label' && deco.label) el.textContent = deco.label;
    canvas.appendChild(el);
  });
}
```

Replace with:

```js
function renderDecorations(canvas) {
  canvas.querySelectorAll('.decoration').forEach(el => el.remove());
  (_chart.decorations ?? []).forEach(deco => {
    const el = document.createElement('div');
    el.className = `decoration decoration-${deco.type}`;

    let x = deco.x, y = deco.y;
    let rot = deco.rotation ?? 0;

    if (_chart.flipForDisplay) {
      // Mirror position relative to canvas dimensions
      x = CANVAS_W - deco.x - deco.width;
      y = _chart.roomHeight - deco.y - deco.height;
      // Rotate decoration +180° to remain visually correct after canvas rotation
      rot = (rot + 180) % 360;
    }

    el.style.cssText = `left:${x}px;top:${y}px;width:${deco.width}px;height:${deco.height}px;pointer-events:none;`;
    el.style.transform = `rotate(${rot}deg)`;
    if (deco.type === 'label' && deco.label) el.textContent = deco.label;
    canvas.appendChild(el);
  });
}
```

Also add `CANVAS_W` to the imports at the top of the file:
```js
import { CANVAS_W } from '../shared/constants.js';
```

**Step 2: Commit**

```bash
git add src/views/seating-editor.js
git commit -m "fix: mirror decoration positions when canvas is rotated"
```

---

## Task 4: Update room-editor — replace radio buttons with rotate button

**Files:**
- Modify: `src/views/room-editor.js`

### Step 1: Replace the "Tavle øverst / Tavle nederst" radio buttons in TEMPLATE

Find (around line 48):
```html
<div class="design-mode-toggle">
  <label class="toggle-label">
    <input type="radio" name="design-mode" value="board-top" id="mode-board-top" checked>
    <span>Tavle øverst</span>
  </label>
  <label class="toggle-label">
    <input type="radio" name="design-mode" value="board-bottom" id="mode-board-bottom">
    <span>Tavle nederst</span>
  </label>
</div>
```

Replace with:
```html
<button class="btn btn-ghost btn-sm" id="btn-rotate-room" title="Roter visning 180°">
  <i class="fa-solid fa-rotate-180"></i> Roter visning
</button>
```

### Step 2: Add `_rotated` state variable

At the top of the file alongside other module-level variables (`let _room`, `let _selectedIds`, etc.), add:
```js
let _rotated = false;
```

### Step 3: Update `render()` to toggle `canvas-rotated`

In `render()`, after `canvas.style.minHeight = ...`, add:
```js
canvas.classList.toggle('canvas-rotated', _rotated);
```

The board position logic:
```js
const board = document.getElementById('room-front-board');
board?.classList.toggle('board-bottom', _room.designMode === 'board-bottom');
board?.classList.toggle('board-top',    _room.designMode !== 'board-bottom');
```
This should change to respond to `_rotated`:
```js
const board = document.getElementById('room-front-board');
const boardVisuallyAtBottom = (_room.designMode === 'board-bottom') !== _rotated;
board?.classList.toggle('board-bottom', boardVisuallyAtBottom);
board?.classList.toggle('board-top', !boardVisuallyAtBottom);
```

### Step 4: Update `bindEvents()` to wire the new button

Remove the old design-mode radio handler:
```js
// REMOVE THIS:
document.querySelectorAll('input[name="design-mode"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (_room) { _room.designMode = radio.value; render(); }
  });
});
```

Add the new rotate button handler:
```js
document.getElementById('btn-rotate-room')?.addEventListener('click', (e) => {
  _rotated = !_rotated;
  e.currentTarget.classList.toggle('btn-active', _rotated);
  render();
});
```

### Step 5: Fix drag hit-testing in room-editor when rotated

In `makeDeskDraggable()` (around line 220), the drag offset is computed as:
```js
offsets[id] = { dx: e.clientX - rect.left - d.x, dy: e.clientY - rect.top - d.y };
```

When the canvas is rotated 180°, the visual top-left is the data bottom-right. Pointer events in a rotated canvas element: the browser correctly delivers pointer coordinates in the element's own rotated coordinate space when using `setPointerCapture`, but `getBoundingClientRect()` returns the *visual* bounding box (unrotated equivalent). This means we need to mirror the local coordinates.

After computing `rect`, add:
```js
const canvasEl = el.parentElement;
const isRotated = canvasEl?.classList.contains('canvas-rotated');
```

Then when computing offsets, replace:
```js
offsets[id] = { dx: e.clientX - rect.left - d.x, dy: e.clientY - rect.top - d.y };
```
with:
```js
let localX = e.clientX - rect.left;
let localY = e.clientY - rect.top;
if (isRotated) {
  localX = rect.width - localX;
  localY = rect.height - localY;
}
offsets[id] = { dx: localX - d.x, dy: localY - d.y };
```

Similarly in `pointermove`, after computing `rawX`/`rawY`:
```js
const rawX = e.clientX - rect.left - off.dx;
const rawY = e.clientY - rect.top  - off.dy;
```
Change to:
```js
let localX = e.clientX - rect.left;
let localY = e.clientY - rect.top;
const canvasEl = el.parentElement;
if (canvasEl?.classList.contains('canvas-rotated')) {
  localX = rect.width - localX;
  localY = rect.height - localY;
}
const rawX = localX - off.dx;
const rawY = localY - off.dy;
```

Apply the same fix to `makeDecoDraggable()` if it exists.

### Step 6: Reset `_rotated` on unmount

In `unmount()`:
```js
unmount() {
  _room = null; _selectedIds.clear(); _dragState = null; _selBoxState = null;
  _rotated = false;
},
```

### Step 7: Commit

```bash
git add src/views/room-editor.js
git commit -m "feat: replace board orientation radios with rotate-view button in room editor"
```

---

## Task 5: Update settings.js label text

**Files:**
- Modify: `src/views/settings.js`

Find (around line 27):
```html
<div class="settings-label">Standard visning</div>
<div class="settings-hint">Vis klassekart med tavle nederst som standard</div>
```

Replace with:
```html
<div class="settings-label">Roter visning som standard</div>
<div class="settings-hint">Åpne klassekart med visningen rotert 180° som standard</div>
```

**Commit:**
```bash
git add src/views/settings.js
git commit -m "style: update settings label for rotation default"
```

---

## Task 6: Manual verification checklist

Run the app: `cd F:\stian.taknes.no\Git\KlassePlass\.worktrees\rebuild && npm start`

Check these scenarios:

- [ ] **Seating editor — unrotated:** Desks show at their saved positions, "TAVLE" is at top, student names are readable
- [ ] **Seating editor — click "Roter visning":** Everything rotates 180°, "TAVLE" is now at visual bottom, all student names are still readable (not upside-down), desk type labels are readable
- [ ] **Seating editor — drag student when rotated:** Dragging a student name works correctly (drop lands on the right desk)
- [ ] **Seating editor — decorations when rotated:** Door/window/wall icons are rotated correctly and positioned correctly
- [ ] **Seating editor — toggle back:** Clicking "Roter visning" again returns to normal
- [ ] **Room editor — "Roter visning" button:** Toggles 180° rotation of the canvas
- [ ] **Room editor — drag desk when rotated:** Desk follows cursor correctly
- [ ] **Room editor — desk numbers/labels when rotated:** Text stays readable
- [ ] **Settings default rotation:** Toggle "Roter visning som standard", open a seating chart — it opens rotated
- [ ] **Presentation window:** Verify the presentation view also respects flip state (search `openPresentation` in seating-editor.js — it passes `flipForDisplay` to the presentation; confirm the presentation CSS also gets `canvas-rotated` class)

---

## Notes

- The `flipDesks()` function in `transforms.js` can stay for now — it may be useful for future "export flipped" or "print flipped" scenarios. Just don't call it from the render path.
- The `unflipPoint()` function in `transforms.js` was used to convert click coordinates when the mathematical flip was active. Once the room editor no longer uses mathematical flip, this function is unused. Leave it for now.
- The `designMode` field on rooms (`board-top` / `board-bottom`) is still stored and loaded, but it only affects where "TAVLE" is visually placed in the unrotated view. It is no longer used to trigger a coordinate transform. This is intentional — teachers who designed their room with board at bottom get "TAVLE" at the bottom by default.
