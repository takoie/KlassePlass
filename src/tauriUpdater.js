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
 * gjettet), og deretter selv kalle `update.download()`/`.install()` hvis en
 * oppdatering finnes. Det finnes ingen automatisk bakgrunns-push.
 *
 * Denne modulen bygger derfor selv "push"-laget: `initAutoUpdateCheck()`
 * kalles én gang ved oppstart (fra `main.jsx`, kun når `isTauri()`), gjør
 * check() + download() (IKKE install() — se `checkAndDownloadUpdate()` for
 * hvorfor) selv, og kaller REGISTRERTE callbacks (samme kontrakt som
 * Electron-preloadens `onUpdateReady`) når nedlastingen faktisk er fullført.
 * `tauriApi.js` sin `onUpdateReady(cb)` registrerer seg her — dette betyr at
 * `UpdateBanner.jsx` selv IKKE trenger noen endring: den kaller fortsatt bare
 * `window.api.onUpdateReady(cb)` og får `cb` kalt med `{ version }` når en
 * oppdatering er lastet ned og klar for installasjon+restart, akkurat som
 * under Electron. Selve installasjonen skjer først når brukeren trykker
 * "Restart nå" (`window.api.restartApp()` → `installPendingUpdateAndRestart()`).
 *
 * KRITISK produktkrav (eksplisitt fra bruker, ikke bare arvet fra Electron-
 * adferden): "Ønsker ikke visuelle feilmeldinger i appen om manglende
 * connection til databasen, kun varslinger evt. om det er tilgjengelig
 * update og connection tilgjengelig." Enhver feil fra `check()` eller
 * `download()` (nettverksfeil, 404 pga. privat GitHub-repo, osv.) skal
 * derfor ALDRI vises til brukeren — kun logges til konsollen for
 * utviklerdiagnose, akkurat som Electron-versjonens
 * `autoUpdater.on('error', ...)`. Kun en VELLYKKET nedlasting trigger UI
 * (de registrerte callbackene).
 */

/** Registrerte "update-ready"-callbacks, kalt når en nedlasting fullføres. */
const updateReadyCallbacks = new Set();
let cachedReadyUpdate = null;

/**
 * `Update`-objektet fra den STILLE bakgrunnssjekken ved oppstart
 * (`checkAndDownloadUpdate()`), holdt i minnet til brukeren selv ber om
 * restart. Installasjon (`.install()`) skjer bevisst IKKE automatisk — se
 * `checkAndDownloadUpdate()` og `installPendingUpdateAndRestart()` under for
 * hvorfor (produktkrav: bruker skal alltid selv få velge når/om restart skjer,
 * ikke bli restartet uten forvarsel).
 */
let pendingBackgroundUpdate = null;

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
  if (cachedReadyUpdate) {
    try { cb(cachedReadyUpdate); } catch (e) {}
  }
  return () => updateReadyCallbacks.delete(cb);
}

export function notifyUpdateReady(info) {
  cachedReadyUpdate = info;
  for (const cb of updateReadyCallbacks) {
    try {
      cb(info);
    } catch (err) {
      console.error('onUpdateReady-callback kastet en feil:', err);
    }
  }
}

/**
 * Sjekker manuelt etter oppdatering og returnerer detaljer til UI.
 */
export async function checkForUpdatesManually() {
  let check;
  try {
    ({ check } = await import('@tauri-apps/plugin-updater'));
  } catch (err) {
    throw new Error('Kunne ikke laste updater-pluginet: ' + (err?.message ?? err));
  }

  const update = await check();
  if (!update) {
    return { available: false };
  }

  return {
    available: true,
    currentVersion: update.currentVersion,
    version: update.version,
    date: update.date,
    body: update.body,
    updateObj: update
  };
}

/**
 * Laster ned og installerer en oppdatering med valgfri fremdrifts-callback.
 */
export async function downloadAndInstallUpdate(updateObj, onProgress) {
  if (!updateObj) throw new Error('Ingen oppdateringsobjekt angitt');

  let downloadedBytes = 0;
  let totalBytes = 0;

  try {
    await updateObj.downloadAndInstall((event) => {
      if (event.event === 'Started' && event.data?.contentLength) {
        totalBytes = event.data.contentLength;
        onProgress?.({ percent: 0, downloadedBytes: 0, totalBytes });
      } else if (event.event === 'Progress' && event.data?.chunkLength) {
        downloadedBytes += event.data.chunkLength;
        const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 50;
        onProgress?.({ percent, downloadedBytes, totalBytes });
      } else if (event.event === 'Finished') {
        onProgress?.({ percent: 100, downloadedBytes: totalBytes, totalBytes });
      }
    });
    notifyUpdateReady({ version: updateObj.version });
  } finally {
    updateObj.close().catch(() => {});
  }
}

/**
 * Simulerer at en ny oppdatering er lastet ned og klar for installasjon.
 * Brukes til testing og demonstrasjon i UI.
 */
export function simulateUpdateReady(testVersion = '2.5.1') {
  notifyUpdateReady({ version: testVersion, simulated: true });
}

/**
 * Sjekker for oppdatering og laster den ned i bakgrunnen (KUN nedlasting,
 * ALDRI installasjon) hvis en finnes. Kalles én gang ved oppstart via
 * `initAutoUpdateCheck()`.
 *
 * Installasjon (`update.install()`) skjer bevisst IKKE her: på Windows må
 * installasjonssteget erstatte den kjørende .exe-filen, noe som i praksis
 * betyr at appen lukkes/restartes — dette skal ALDRI skje uten at brukeren
 * eksplisitt har bedt om det (trykket "Restart nå" i UpdateBanner.jsx /
 * UpdateModal.jsx). Vi laster derfor kun ned og kaller `notifyUpdateReady()`,
 * som viser restart-varselet i UI-et; selve installasjonen skjer først i
 * `installPendingUpdateAndRestart()`, trigget av brukerens knappetrykk.
 */
async function checkAndDownloadUpdate() {
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
    console.error('Auto-updater error:', err?.message ?? err);
    return;
  }

  if (!update) {
    return;
  }

  try {
    await update.download();
    pendingBackgroundUpdate = update;
    notifyUpdateReady({ version: update.version });
  } catch (err) {
    console.error('Auto-updater error:', err?.message ?? err);
    update.close().catch(() => {});
  }
}

/**
 * Installerer en oppdatering som ble lastet ned i bakgrunnen av
 * `checkAndDownloadUpdate()`, og restarter deretter appen. Kalles KUN som
 * respons på et eksplisitt brukervalg (f.eks. "Restart nå"-knappen i
 * UpdateBanner.jsx). Er ingen bakgrunns-nedlasting ventende (f.eks. fordi
 * brukeren i stedet lastet ned+installerte manuelt via UpdateModal sin
 * `downloadAndInstallUpdate`, som allerede installerer som del av
 * knappetrykket), er dette en no-op og kallstedet må selv restarte
 * (`relaunch()`) etterpå.
 */
export async function installPendingUpdateAndRestart() {
  if (!pendingBackgroundUpdate) return;
  const update = pendingBackgroundUpdate;
  pendingBackgroundUpdate = null;
  try {
    await update.install();
  } finally {
    update.close().catch(() => {});
  }
}

/**
 * Starter oppdateringssjekken. Kalles fra `main.jsx`, kun når `isTauri()`.
 */
export function initAutoUpdateCheck() {
  checkAndDownloadUpdate();
}
