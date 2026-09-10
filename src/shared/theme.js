// Tema-oppløsning for lys/mørk modus.
//
// settings.theme    = fargetema-navn: 'klasseplass' | 'havbris' | 'solnedgang' | 'lavendel'
// settings.colorMode = 'dark' | 'light' | 'system'  (default 'system')
//
// Effektivt daisyUI-tema = <fargetema>[-light], der "-light" legges på når
// colorMode er 'light', eller 'system' og OS-en foretrekker lyst.

const BASE_THEMES = ['klasseplass', 'havbris', 'solnedgang', 'lavendel'];

export function prefersLight() {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  } catch (e) {
    return false;
  }
}

export function resolveTheme(baseTheme, colorMode) {
  const base = String(baseTheme || 'klasseplass').replace(/-light$/, '');
  const safeBase = BASE_THEMES.includes(base) ? base : 'klasseplass';
  const light = colorMode === 'light' || (colorMode === 'system' && prefersLight());
  return light ? `${safeBase}-light` : safeBase;
}

// Setter data-theme + color-scheme (så native scrollbars/kontroller følger).
// Returnerer det oppløste tema-navnet.
export function applyResolvedTheme(baseTheme, colorMode) {
  const t = resolveTheme(baseTheme, colorMode);
  const root = document.documentElement;
  root.setAttribute('data-theme', t);
  root.style.colorScheme = t.endsWith('-light') ? 'light' : 'dark';
  return t;
}
