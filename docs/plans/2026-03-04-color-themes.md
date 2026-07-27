# Color Themes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 3 dark and 3 light DaisyUI color themes selectable from the settings menu, replacing the hardcoded dracula/light pair, with a new default (night/nord) and adaptive logo text color.

**Architecture:** Extend `settings.json` with a `colorTheme` string field. `applyTheme()` in `renderer.js` sets `data-theme` directly from `colorTheme`. Settings UI gets a row of 3 theme swatches per mode. Logo "Klasse" text uses a CSS variable so it inverts on light themes. No new dependencies.

**Tech Stack:** Electron, DaisyUI v4 (CDN — all 35 themes already available), vanilla JS, CSS custom properties.

---

## Context

- `index.html` line 49: Logo markup with hardcoded `color:#e0f2fe` for "Klasse" span
- `src/renderer.js` line 69-71: `applyTheme()` maps `'light'` → `'light'`, else → `'dracula'`
- `src/renderer.js` line 81: `store.on('settings', s => applyTheme(s?.theme ?? 'dark'))`
- `src/db.js` line 35: default settings `{ theme: 'dark', defaultFlipDisplay: false, onboardingCompleted: false }`
- `src/store.js` line 11-15: initial settings state
- `src/views/settings.js` line 8-77: TEMPLATE string with theme toggle buttons
- `src/views/settings.js` line 88-118: `loadSettings()` sets active button state
- `src/views/settings.js` line 120-131: `bindEvents()` wires theme buttons
- `src/views/settings.js` line 218-225: `setTheme()` updates DOM, saves settings, updates store

Dark themes: `night` (default), `dracula`, `coffee`
Light themes: `nord` (default), `winter`, `corporate`

---

### Task 1: Fix logo text color for light/dark modes

**Files:**
- Modify: `index.html:49`

The "Klasse" span has a hardcoded light-blue color. Replace it with a CSS class so it can respond to theme changes via a CSS variable.

**Step 1: Replace hardcoded span color with a CSS class**

In `index.html` line 49, replace:
```html
<span style="color:#e0f2fe;text-shadow:0 0 10px rgba(59,130,246,0.7)">Klasse</span><span style="color:#fbbf24;text-shadow:0 0 12px #f59e0b">Plass</span>
```
With:
```html
<span class="logo-klasse">Klasse</span><span style="color:#fbbf24;text-shadow:0 0 12px #f59e0b">Plass</span>
```

**Step 2: Add CSS for `.logo-klasse` in the `<style>` block of `index.html`**

Find the `.sidebar-logo` style block (around line 115) and add after it:

```css
.logo-klasse {
  color: #e0f2fe;
  text-shadow: 0 0 10px rgba(59,130,246,0.7);
}
/* Light themes: dark text for contrast */
[data-theme="light"] .logo-klasse,
[data-theme="nord"] .logo-klasse,
[data-theme="winter"] .logo-klasse,
[data-theme="corporate"] .logo-klasse {
  color: #1e3a5f;
  text-shadow: 0 0 8px rgba(59,130,246,0.3);
}
```

**Step 3: Verify visually**

Open the app, switch between dark and light modes — "Klasse" should be light-blue on dark themes and dark-navy on light themes. "Plass" (yellow) stays the same.

**Step 4: Commit**

```bash
git add index.html
git commit -m "fix: adapt logo Klasse text color for light/dark themes"
```

---

### Task 2: Add `colorTheme` to settings data layer

**Files:**
- Modify: `src/db.js:35`
- Modify: `src/store.js:11-15`

**Step 1: Update default settings in `src/db.js`**

On line 35, replace:
```js
return { theme: 'dark', defaultFlipDisplay: false, onboardingCompleted: false };
```
With:
```js
return { theme: 'dark', colorTheme: 'night', defaultFlipDisplay: false, onboardingCompleted: false };
```

**Step 2: Update initial state in `src/store.js`**

Replace lines 11-15:
```js
settings: {
  theme: 'dark',
  defaultFlipDisplay: false,
  onboardingCompleted: false,
},
```
With:
```js
settings: {
  theme: 'dark',
  colorTheme: 'night',
  defaultFlipDisplay: false,
  onboardingCompleted: false,
},
```

**Step 3: Commit**

```bash
git add src/db.js src/store.js
git commit -m "feat: add colorTheme field to settings schema"
```

---

### Task 3: Update `applyTheme()` in renderer to use `colorTheme`

**Files:**
- Modify: `src/renderer.js:69-81`

Currently `applyTheme(theme)` only receives the mode (`'dark'`/`'light'`) and maps it to a hardcoded DaisyUI theme name. We change it to receive the full settings object and use `colorTheme` directly, with fallback.

**Step 1: Replace `applyTheme` function and its subscriber**

Replace lines 69-81 in `src/renderer.js`:
```js
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dracula';
}

// Lytt på tema-endringer
store.on('settings', s => applyTheme(s?.theme ?? 'dark'));
```
With:
```js
const DARK_THEMES  = ['night', 'dracula', 'coffee'];
const LIGHT_THEMES = ['nord', 'winter', 'corporate'];

function applyTheme(settings) {
  const mode = settings?.theme ?? 'dark';
  const colorTheme = settings?.colorTheme;
  const validThemes = [...DARK_THEMES, ...LIGHT_THEMES];
  if (colorTheme && validThemes.includes(colorTheme)) {
    document.documentElement.dataset.theme = colorTheme;
  } else {
    document.documentElement.dataset.theme = mode === 'light' ? 'nord' : 'night';
  }
}

// Lytt på tema-endringer
store.on('settings', s => applyTheme(s));
```

**Step 2: Commit**

```bash
git add src/renderer.js
git commit -m "feat: applyTheme uses colorTheme field directly"
```

---

### Task 4: Add theme swatch UI to settings view

**Files:**
- Modify: `src/views/settings.js:8-77` (TEMPLATE)
- Modify: `src/views/settings.js:88-118` (loadSettings)
- Modify: `src/views/settings.js:120-131` (bindEvents)
- Modify: `src/views/settings.js:218-225` (setTheme)

This is the largest task. We add a new settings row with 3 swatches under the mode toggle, and wire up the logic.

**Step 1: Update TEMPLATE — add color theme row**

After the existing theme row (closes with `</div>` after the `theme-toggle` div, around line 23), add a new settings row. The full block to add goes right after line 23's closing `</div></div>`:

```html
<div class="settings-row" id="color-theme-row">
  <div>
    <div class="settings-label">Fargetema</div>
    <div class="settings-hint">Velg fargepalett for gjeldende modus</div>
  </div>
  <div class="color-theme-swatches" id="color-theme-swatches">
    <!-- Populated by JS -->
  </div>
</div>
```

**Step 2: Add swatch CSS to the settings TEMPLATE or layout.css**

In `src/styles/layout.css`, add at the end:

```css
.color-theme-swatches {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-swatch {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.color-swatch:hover {
  transform: scale(1.1);
}

.color-swatch.active {
  border-color: oklch(var(--bc));
  outline: 2px solid oklch(var(--p));
  outline-offset: 2px;
}
```

**Step 3: Add theme config constant above TEMPLATE**

Add this constant at the top of `src/views/settings.js`, before the `TEMPLATE` declaration:

```js
const THEMES = {
  dark: [
    { id: 'night',   label: 'Natt',   bg: '#1a1f2e', primary: '#7c3aed' },
    { id: 'dracula', label: 'Dracula', bg: '#282a36', primary: '#bd93f9' },
    { id: 'coffee',  label: 'Kaffe',  bg: '#1e1512', primary: '#db924b' },
  ],
  light: [
    { id: 'nord',      label: 'Nord',    bg: '#eceff4', primary: '#5e81ac' },
    { id: 'winter',    label: 'Vinter',  bg: '#f6f8ff', primary: '#047aff' },
    { id: 'corporate', label: 'Bedrift', bg: '#f9fafb', primary: '#4b6bfb' },
  ],
};
```

**Step 4: Update `loadSettings()` to populate swatches**

Add a call to a new `renderSwatches(mode, colorTheme)` function at the end of `loadSettings()`. After the version block (after line 117), add:

```js
renderSwatches(currentTheme === 'light' ? 'light' : 'dark', settings.colorTheme ?? 'night');
```

Note: `currentTheme` is already defined earlier in `loadSettings()` as `settings.theme ?? 'dracula'`. Map it: if it equals `'light'` use `'light'`, otherwise `'dark'`.

**Step 5: Add `renderSwatches()` function**

Add this function before `bindEvents`:

```js
function renderSwatches(mode, activeThemeId) {
  const container = document.getElementById('color-theme-swatches');
  if (!container) return;
  const themes = THEMES[mode] ?? THEMES.dark;
  container.innerHTML = themes.map(t => `
    <button
      class="color-swatch${t.id === activeThemeId ? ' active' : ''}"
      data-theme-id="${t.id}"
      title="${t.label}"
      style="background:${t.bg};border-color:${t.primary}"
    >${t.label.slice(0, 2)}</button>
  `).join('');
  container.querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', () => setColorTheme(btn.dataset.themeId));
  });
}
```

**Step 6: Add `setColorTheme()` function**

Add this function right after `renderSwatches`:

```js
async function setColorTheme(themeId) {
  await window.api.saveSettings({ colorTheme: themeId });
  const s = store.getState().settings;
  const newSettings = { ...s, colorTheme: themeId };
  store.setState({ settings: newSettings });
  document.documentElement.dataset.theme = themeId;
  const mode = s.theme === 'light' ? 'light' : 'dark';
  renderSwatches(mode, themeId);
}
```

**Step 7: Update `setTheme()` to also switch to the default colorTheme for the new mode**

Find the existing `setTheme()` function (lines ~218-225) and replace it:

```js
async function setTheme(theme) {
  const isDark = theme !== 'light';
  const mode = isDark ? 'dark' : 'light';
  const defaultColorTheme = THEMES[mode][0].id; // 'night' for dark, 'nord' for light

  document.getElementById('btn-theme-dark')?.classList.toggle('active', isDark);
  document.getElementById('btn-theme-light')?.classList.toggle('active', !isDark);
  document.documentElement.dataset.theme = defaultColorTheme;

  await window.api.saveSettings({ theme, colorTheme: defaultColorTheme });
  const s = store.getState().settings;
  store.setState({ settings: { ...s, theme, colorTheme: defaultColorTheme } });
  renderSwatches(mode, defaultColorTheme);
}
```

**Step 8: Verify visually**

1. Open settings → "Utseende" section
2. Three swatches appear under the Mørk/Lys toggle
3. Click a swatch — `data-theme` on `<html>` changes, app recolors instantly
4. Switch mode (Mørk↔Lys) — swatches update to show the other mode's 3 themes
5. Close and reopen app — selected theme persists

**Step 9: Commit**

```bash
git add src/views/settings.js src/styles/layout.css
git commit -m "feat: add color theme swatches to settings UI"
```

---

### Task 5: Handle migration for existing users

**Files:**
- Modify: `src/renderer.js` — init sequence

Existing users will have `settings.json` without `colorTheme`. The `applyTheme()` already handles `undefined` colorTheme gracefully (falls back to `night`/`nord`). But we should also handle it in `loadSettings()` in settings.js so the right swatch is highlighted.

**Step 1: Guard `colorTheme` in `loadSettings()`**

In `loadSettings()` in `src/views/settings.js`, where we call `renderSwatches`, use:

```js
const mode = (settings.theme === 'light') ? 'light' : 'dark';
const colorTheme = settings.colorTheme ?? (mode === 'light' ? 'nord' : 'night');
renderSwatches(mode, colorTheme);
```

This is already implied by step 4 above but confirm it's explicit.

**Step 2: Commit**

```bash
git add src/views/settings.js
git commit -m "fix: handle missing colorTheme for existing users"
```
