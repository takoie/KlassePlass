/**
 * tauriUpdater.js — Tauri-motstykke til Electrons `src/updater.js`.
 *
 * Bakgrunn: Electrons `electron-updater` er PUSH-basert. Den kjører en
 * bakgrunnssjekk selv (`autoUpdater.checkForUpdatesAndNotify()`), laster ned
 * automatisk (`autoDownload = true`), og PUSHER en `update-downloaded`-
 * hendelse til rendereren når filen er klar — rendereren (`UpdateBanner.jsx`)
 * abonnerer bare passivt via `window.api.onUpdateReady(cb)`.
 *
 * Tauris `@tauri-apps/plugin-updater` er derimot PULL-basert: frontend må
 * selv kalle `check()` (returnerer `Update | null` — bekreftet ved å lese
 * `node_modules/@tauri-apps/plugin-updater/dist-js/index.d.ts`, ikke
 * gjettet), og deretter selv kalle `update.downloadAndInstall()` hvis en
 * oppdatering finnes. Det finnes ingen automatisk bakgrunns-push.
 *
 * Denne modulen bygger derfor selv "push"-laget: `initAutoUpdateCheck()`
 * kalles én gang ved oppstart (fra `main.jsx`, kun når `isTauri()`), gjør
 * check() + downloadAndInstall() selv, og kaller REGISTRERTE callbacks
 * (samme kontrakt som Electron-preloadens `onUpdateReady`) når nedlastingen
 * faktisk er fullført. `tauriApi.js` sin `onUpdateReady(cb)` registrerer seg
 * her — dette betyr at `UpdateBanner.jsx` selv IKKE trenger noen endring:
 * den kaller fortsatt bare `window.api.onUpdateReady(cb)` og får `cb` kalt
 * med `{ version }` når en oppdatering er installert og klar for restart,
 * akkurat som under Electron.
 *
 * KRITISK produktkrav (eksplisitt fra bruker, ikke bare arvet fra Electron-
 * adferden): "Ønsker ikke visuelle feilmeldinger i appen om manglende
 * connection til databasen, kun varslinger evt. om det er tilgjengelig
 * update og connection tilgjengelig." Enhver feil fra `check()` eller
 * `downloadAndInstall()` (nettverksfeil, 404 pga. privat GitHub-repo, osv.)
 * skal derfor ALDRI vises til brukeren — kun logges til konsollen for
 * utviklerdiagnose, akkurat som Electron-versjonens
 * `autoUpdater.on('error', ...)`. Kun en VELLYKKET nedlasting trigger UI
 * (de registrerte callbackene).
 */

/** Registrerte "update-ready"-callbacks, kalt når en nedlasting fullføres. */
const updateReadyCallbacks = new Set();

/**
 * Registrerer en callback som kalles med `{ version }` når en oppdatering er
 * lastet ned og installert og appen er klar for restart. Speiler Electron-
 * preloadens `onUpdateReady(cb)`-kontrakt eksakt (samme signatur, samme
 * "abonner og glem"-semantikk), slik at `UpdateBanner.jsx` kan forbli
 * uendret.
 *
 * Returnerer en avregistreringsfunksjon (som `tauriApi.js` sin gamle no-op-
 * stub allerede gjorde, for API-kompatibilitet — selv om `UpdateBanner.jsx`
 * ikke bruker den i dag).
 */
export function onUpdateReady(cb) {
  if (typeof cb !== 'function') return () => {};
  updateReadyCallbacks.add(cb);
  return () => updateReadyCallbacks.delete(cb);
}

function notifyUpdateReady(info) {
  for (const cb of updateReadyCallbacks) {
    try {
      cb(info);
    } catch (err) {
      console.error('onUpdateReady-callback kastet en feil:', err);
    }
  }
}

/**
 * Sjekker for oppdatering, laster ned og installerer den hvis en finnes.
 * Kalles én gang ved oppstart via `initAutoUpdateCheck()`.
 *
 * Enhver feil (nettverk, privat repo som svarer 404/403, manglende
 * `latest.json` osv.) fanges og logges KUN til konsollen — se modul-doc for
 * hvorfor dette er et eksplisitt produktkrav, ikke bare en bekvemmelighet.
 * `check()` som resolver til `null` (ingen oppdatering tilgjengelig) er en
 * normal, forventet vei og skal heller ikke logges som en feil.
 */
async function checkAndInstallUpdate() {
  let check;
  try {
    ({ check } = await import('@tauri-apps/plugin-updater'));
  } catch (err) {
    console.error('Auto-updater: kunne ikke laste updater-pluginet:', err?.message ?? err);
    return;
  }

  let update = null;
  try {
    update = await check();
  } catch (err) {
    // Stille feil ved manglende nettverkstilgang / privat GitHub-repo /
    // utvikling uten publisert release — speiler Electron-versjonens
    // `checkForUpdatesAndNotify().catch(() => {})`.
    console.error('Auto-updater error:', err?.message ?? err);
    return;
  }

  if (!update) {
    // Ingen oppdatering tilgjengelig - helt normal vei, ingen UI, ingen feil.
    return;
  }

  try {
    await update.downloadAndInstall();
    notifyUpdateReady({ version: update.version });
  } catch (err) {
    console.error('Auto-updater error:', err?.message ?? err);
  } finally {
    // Frigjør den underliggende Rust-ressursen (Update extends Resource).
    update.close().catch(() => {});
  }
}

/**
 * Starter oppdateringssjekken. Kalles fra `main.jsx`, kun når `isTauri()`,
 * på samme måte som `setupUpdater(winRef)` kalles fra Electrons
 * hovedprosess ved vindu-opprettelse.
 */
export function initAutoUpdateCheck() {
  checkAndInstallUpdate();
}
