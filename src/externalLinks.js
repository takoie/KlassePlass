/**
 * externalLinks.js — Tauri-motstykke til Electrons `setWindowOpenHandler` i
 * `src/window-manager.js:50-57`.
 *
 * Bakgrunn: I Electron ville en lenke med `target="_blank"` (eller en
 * `mailto:`-lenke) ellers spawnet et nytt, uhåndtert Electron-vindu.
 * `setWindowOpenHandler` fanget dette opp, åpnet http(s)/mailto-URL-er i
 * systemets nettleser/e-postklient via `shell.openExternal`, og nektet
 * (`{ action: 'deny' }`) selve vindu-opprettelsen uansett URL-skjema.
 *
 * Tauri 2 har INGEN ekvivalent hook på Rust/WRY-siden (verken på
 * `WebviewWindowBuilder` eller som et vindus-event) — dette er bekreftet ved
 * research (ikke gjettet): Tauri-vedlikeholdere har selv uttalt at uten
 * håndtering "may open a new uncontrolled app window instead of launching it
 * in the same window" for `target="_blank"`-lenker (se
 * github.com/orgs/tauri-apps/discussions/11580), og det finnes åpne
 * feature-requests (tauri-apps/tauri#11825, #1657) for en konfigurerbar
 * Rust-side løsning som ikke er landet i stabil Tauri 2 ennå. Det er altså
 * IKKE slik at WRY trygt no-op'er target="_blank" av seg selv — risikoen for
 * et uhåndtert vindu er reell, akkurat som i Electron.
 *
 * Den idiomatiske Tauri 2-løsningen (dokumentert av `@tauri-apps/plugin-opener`
 * sine egne vedlikeholdere som svar i nevnte diskusjon) er derfor en
 * JS-side klikk-lytter: fang klikk på `<a target="_blank">`/`<a
 * href="mailto:...">`, kall `preventDefault()`, og send URL-en videre til
 * OS-et via `openUrl()` fra `@tauri-apps/plugin-opener`.
 *
 * Faktiske forekomster i denne kodebasen i dag (verifisert med grep, ikke
 * antatt): `src/components/Settings.jsx` har tre `target="_blank"`-lenker
 * (UDIR/Datatilsynet-personvernlenker) og én `mailto:`-lenke. Denne
 * håndteringen er altså ikke bare defensiv/fremtidsrettet — den dekker
 * lenker som finnes i appen allerede.
 */

import { openUrl } from '@tauri-apps/plugin-opener';

/**
 * Speiler URL-sjekken i `src/window-manager.js:53` — samme tre skjemaer skal
 * håndteres av systemet fremfor av selve webview-vinduet.
 */
export function isExternalLinkUrl(url) {
  return (
    typeof url === 'string' &&
    (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:'))
  );
}

/**
 * Finner nærmeste `<a href>`-forelder til et klikk-target, hvis noen.
 */
function closestAnchor(target) {
  if (!(target instanceof Element)) return null;
  return target.closest('a[href]');
}

/**
 * Avgjør om en gitt lenke ville forsøkt å åpne en ny nettleser-kontekst
 * (target="_blank", eller en mailto-lenke som uansett ikke kan navigeres til
 * i selve appvinduet).
 */
function opensNewContext(link) {
  return link.target === '_blank' || (link.getAttribute('href') || '').startsWith('mailto:');
}

/**
 * Installerer en global klikk-lytter som fanger opp `target="_blank"`- og
 * `mailto:`-lenker og åpner dem i systemets nettleser/e-postklient via
 * opener-pluginet, i stedet for å la webview-en forsøke å åpne et nytt,
 * uhåndtert vindu.
 *
 * Kalles kun når `isTauri()` er sann (se `src/main.jsx`), slik at
 * Electron-bygget er upåvirket — der dekkes dette allerede av
 * `window-manager.js` sin `setWindowOpenHandler`.
 */
export function initExternalLinkHandler() {
  document.addEventListener('click', (event) => {
    const link = closestAnchor(event.target);
    if (!link) return;

    const href = link.getAttribute('href') || '';
    if (!opensNewContext(link) || !isExternalLinkUrl(href)) return;

    event.preventDefault();
    openUrl(href).catch((err) => {
      console.error('Kunne ikke åpne ekstern lenke via systemet:', err);
    });
  });
}
