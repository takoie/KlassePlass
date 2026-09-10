import { useState, useEffect } from 'react';

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

// True når det aktive daisyUI-temaet er en "-light"-variant. Reagerer på
// bytte (App/Settings endrer data-theme på <html>). Brukes bl.a. av canvas-
// bakgrunnen i klassekart/rom-editor så lyst tema = lys tegneflate.
export function useIsLightTheme() {
  const read = () => (document.documentElement.getAttribute('data-theme') || '').endsWith('-light');
  const [light, setLight] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setLight(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return light;
}
