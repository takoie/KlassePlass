# Print/PDF-eksport Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Erstatte dagens `window.print()`-only utskrift av klassekart (og legge til utskrift av stasjonsplaner) med en delt forhåndsvisnings-modal som har brytere for farger/numre/makkergrupper/soner, og to eksplisitte handlinger: "Skriv ut" (systemets print-dialog) og "Eksporter til PDF" (Electron genererer PDF-filen direkte, med automatisk filnavn og en bekreftelse med "Åpne fil"/"Åpne mappe").

**Architecture:** Ny delt komponentmappe `src/components/Print/` med en paper-abstraksjon (`PrintPage`) og en forhåndsvisnings-modal (`PrintPreviewModal`) som begge klassekartet (`SeatingChartPrintContent`) og stasjonsplaner (`StationPrintContent`) fyller med sitt eget innhold. Samme innholdskomponent + samme `settings`-state rendres to steder: skalert og synlig i modalen (forhåndsvisning), og fullstørrelse men skjult utenfor `@media print` (det faktiske print/PDF-målet) — akkurat som dagens `#print-overlay`-mønster, bare generalisert og bryter-styrt. PDF-eksport bruker Electrons innebygde `webContents.printToPDF()` på hovedvinduet (samme webContents som allerede har print-innholdet i DOM-en), ingen ny npm-avhengighet.

**Tech Stack:** Electron 28, React 18, DaisyUI/Tailwind, ren CSS (`@media print`) — ingen nye biblioteker. Prosjektet har **ingen automatisert testoppsett** (ikke i `package.json`, ingen test-filer funnet), og design-dokumentet (`docs/plans/2026-07-28-print-pdf-eksport-design.md`) fastslo eksplisitt at vi ikke innfører et testrammeverk kun for denne funksjonen. Derfor bruker denne planen **manuell verifisering i den kjørende appen** (`/run`-skillet) i stedet for "skriv feilende test → gjør den grønn"-steg. Rene hjelpefunksjoner (filnavn-generering) verifiseres med et lite engangs-scriptkall i steget selv, ikke en permanent test-suite.

**Referansedokument:** `docs/plans/2026-07-28-print-pdf-eksport-design.md`

---

## Nøkkelfiler i dagens kode (referanse)

- `src/components/SeatingChart/PrintOverlay.jsx` — dagens print-DOM for klassekart (skal erstattes).
- `src/styles/print.css` — dagens `@media print`-regler, inkl. **orphanet** `#station-print-overlay`-CSS (linje 121-205) som ingen komponent faktisk rendrer i dag (bekreftet: ingen treff på `station-print-overlay` i `.jsx`-filer).
- `src/components/SeatingChart.jsx` — `GROUP_COLORS` (linje 9-13), `zoneMeta` (linje 1012-1018), `deskNumberMap` (linje 1007-1010), `showNumbers`/`showZones`/`hideGroups`-state (linje 61-64), `handlePrint` (linje 836-841), desk-rendering med farger/numre/soner (linje 1117-1246), `<PrintOverlay .../>`-kallet (linje 1300-1308).
- `src/components/SeatingChart/Toolbar.jsx` — "Skriv ut / PDF"-knapp (linje 111-113), kaller `handlePrint` prop.
- `src/components/OverviewViews.jsx` — kort-knapp som setter `localStorage.setItem('print_on_mount', 'true')` og navigerer (linje 366-371, 397).
- `src/ipc-handlers.js` — `registerHandlers(winRef)`, eksisterende `backup-db`-handler (linje 223-233) er mønsteret for `dialog.showSaveDialog` + filskriving.
- `src/preload.js` — `contextBridge.exposeInMainWorld('api', {...})`, alle IPC-kall eksponeres herfra.
- `src/db.js` — `loadSettings()`/`saveSettings()` — brukes for å huske "sist brukte mappe" (samme mønster som andre innstillinger, ikke en ny fil).
- `src/components/StationPresenter.jsx` (linje 23-27) — datamodell for stasjonsøkt: `stations[]`, `groups[]` (array av studentId-lister per gruppe), `groupLeaders[]`, `rotationPlan[]` (array av rotasjonssteg).

---

## Fase 1 — Klassekart

### Task 1: Filnavn-generator

**Files:**
- Create: `src/components/Print/printFilename.js`

**Step 1: Skriv funksjonen**

```js
/**
 * Bygger et sanert PDF-filnavn: Klassekart_{klasse}_{kart}_{YYYY-MM-DD}.pdf
 */
export function buildPrintFilename({ className, chartName, date = new Date() }) {
  const namePart = [className, chartName].filter(Boolean).join('_');
  const dateStr = date.toISOString().slice(0, 10);
  const base = `Klassekart_${namePart || 'Uten_navn'}_${dateStr}`;
  const sanitized = base
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_');
  return `${sanitized}.pdf`;
}
```

**Step 2: Verifiser manuelt**

Kjør i prosjektroten:

```bash
node -e "const {buildPrintFilename}=require('./src/components/Print/printFilename.js'); console.log(buildPrintFilename({className:'1ST5',chartName:'w2dd',date:new Date('2026-07-28')}))"
```

Forventet output: `Klassekart_1ST5_w2dd_2026-07-28.pdf`

Prøv også med `/`, `:` eller `?` i `chartName` (f.eks. `'Uke 5/8'`) og bekreft at output ikke inneholder ugyldige filnavn-tegn.

Merk: filen bruker CommonJS (`module.exports`) siden den også må kunne `require`-es fra Electron main-prosessen (Task 6), ikke bare importeres i React-koden. Bruk:

```js
module.exports = { buildPrintFilename };
```

i stedet for `export function` — og i React-siden importer med `import { buildPrintFilename } from './printFilename.js'` (Vite/ESM håndterer CJS-interop automatisk for denne typen enkle named exports; bekreft ved å kjøre dev-serveren etter Task 4/5 at import fungerer, ikke bare anta det).

**Step 3: Commit**

```bash
git add src/components/Print/printFilename.js
git commit -m "feat: legg til filnavn-generator for PDF-eksport"
```

---

### Task 2: `PrintPage` — delt paper-abstraksjon

**Files:**
- Create: `src/components/Print/PrintPage.jsx`
- Modify: `src/styles/print.css`

**Kontekst:** A4 landskap er alltid 297×210mm. Ved 96dpi er 1mm ≈ 3.7795px. Innhold (klassekartets `print-canvas-wrapper` er i dag fast 1100×700px, se `PrintOverlay.jsx:20`) skal skaleres ned med `transform: scale()` slik at det alltid får plass på én side, aldri skaleres opp. Header (tittel + periode) og footer (logo) tar fast plass i mm, resten er tilgjengelig for innhold.

**Step 1: Skriv komponenten**

```jsx
import React from 'react';

const MM_TO_PX = 3.7795;
const PAGE_MM = { width: 297, height: 210 };
const MARGIN_MM = 10;
const HEADER_MM = 18;
const FOOTER_MM = 10;

export function getPrintableAreaPx() {
  const width = (PAGE_MM.width - MARGIN_MM * 2) * MM_TO_PX;
  const height = (PAGE_MM.height - MARGIN_MM * 2 - HEADER_MM - FOOTER_MM) * MM_TO_PX;
  return { width, height };
}

/**
 * Skalerer ned (aldri opp) slik at contentW×contentH får plass i printbart areal.
 */
export function computePrintScale(contentWidthPx, contentHeightPx) {
  const area = getPrintableAreaPx();
  return Math.min(1, area.width / contentWidthPx, area.height / contentHeightPx);
}

export default function PrintPage({ title, periodText, contentWidthPx, contentHeightPx, children }) {
  const scale = computePrintScale(contentWidthPx, contentHeightPx);
  return (
    <div className="print-page">
      <div className="print-page-header">
        <div className="print-chart-name">{title || 'Klassekart'}</div>
        {periodText && <div className="print-meta">{periodText}</div>}
      </div>
      <div
        className="print-page-content"
        style={{ width: contentWidthPx, height: contentHeightPx, transform: `scale(${scale})` }}
      >
        {children}
      </div>
      <div className="print-page-footer">
        <span className="print-logo">KlassePlass</span>
      </div>
    </div>
  );
}
```

**Step 2: Oppdater `print.css`**

Erstatt hele `#print-overlay`-blokken (linje 5-23) og hele stasjons-blokken (linje 121-137, den orphanede `#station-print-overlay`-CSS-en) med ett delt `#print-output`-system. Behold `.print-chart-name`, `.print-meta`, `.print-desk*`-klassene (de gjenbrukes av `SeatingChartPrintContent` i Task 4) og `.station-print-table*`-klassene (gjenbrukes av `StationPrintContent` i Fase 2) uendret.

```css
@media print {
  @page { size: A4 landscape; margin: 0; }
  body > #app-shell { display: none !important; }
  #print-output { display: block !important; }
}

#print-output {
  display: none;
  position: fixed;
  inset: 0;
  background: white;
  z-index: 9999;
}

.print-page {
  width: 297mm;
  height: 210mm;
  padding: 10mm;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  color: black;
  background: white;
  font-family: 'Inter', sans-serif;
}

.print-page-header {
  border-bottom: 2px solid #333;
  padding-bottom: 6px;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.print-page-content {
  position: relative;
  flex: 1;
  transform-origin: top left;
  overflow: visible;
}

.print-page-footer {
  flex-shrink: 0;
  text-align: right;
  padding-top: 4px;
}

.print-logo {
  font-size: 9px;
  color: #9ca3af;
  font-weight: 600;
  letter-spacing: 0.05em;
}
```

**Step 3: Manuell sjekk**

Ingen kjørende UI ennå (komponenten er ikke montert noe sted) — bekreft kun at filene lagres uten syntaksfeil ved å kjøre `npm run vite` og se at Vite ikke rapporterer parse-feil i terminalen (avslutt med Ctrl+C etter oppstart er bekreftet).

**Step 4: Commit**

```bash
git add src/components/Print/PrintPage.jsx src/styles/print.css
git commit -m "feat: legg til delt PrintPage paper-abstraksjon"
```

---

### Task 3: `usePrintSettings` — brytere med riktig standardverdi

**Files:**
- Create: `src/components/Print/usePrintSettings.js`

**Kontekst:** `showNumbers`/`showZones`/`hideGroups` skal **arves** fra `SeatingChart.jsx`s nåværende state hver gang modalen åpnes (ikke huskes separat — det du ser på skjermen er utgangspunktet). `showColors` har ingen on-screen-ekvivalent, så den huskes i `localStorage` mellom sesjoner, default `true`.

**Step 1: Skriv hooken**

```js
import { useState, useEffect } from 'react';

const COLORS_KEY = 'print_show_colors';

export function usePrintSettings({ initialShowNumbers, initialShowZones, initialShowGroups }) {
  const [showNumbers, setShowNumbers] = useState(initialShowNumbers);
  const [showZones, setShowZones] = useState(initialShowZones);
  const [showGroups, setShowGroups] = useState(initialShowGroups);
  const [showColors, setShowColors] = useState(() => {
    const stored = localStorage.getItem(COLORS_KEY);
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(COLORS_KEY, String(showColors));
  }, [showColors]);

  return {
    settings: { showNumbers, showZones, showGroups, showColors },
    setShowNumbers, setShowZones, setShowGroups, setShowColors,
  };
}
```

Merk: `initialShowGroups` = `!hideGroups` fra `SeatingChart.jsx` (bryteren i UI heter "Makkergrupper" og er positiv, mens kildestate `hideGroups` er negert — konverter ved kallsted i Task 5).

**Step 2: Manuell sjekk**

Utsett til Task 5 (hooken har ingen isolert UI å teste før den er koblet til modalen).

**Step 3: Commit**

```bash
git add src/components/Print/usePrintSettings.js
git commit -m "feat: legg til usePrintSettings hook for print-brytere"
```

---

### Task 4: `SeatingChartPrintContent` — flytt og bryter-styr klassekart-innholdet

**Files:**
- Create: `src/components/Print/printLayouts/SeatingChartPrintContent.jsx`
- Delete: `src/components/SeatingChart/PrintOverlay.jsx` (etter at Task 6 har fjernet siste referanse)

**Kontekst:** Dette er `PrintOverlay.jsx` sitt innhold (linje 20-57), utvidet til å vise farger/grupper/soner styrt av `settings`, gjenbruker `GROUP_COLORS` og `zoneMeta` fra `SeatingChart.jsx` (send dem inn som props — ikke dupliser konstantene, se `GROUP_COLORS` linje 9-13 og `zoneMeta` linje 1012-1018 i `SeatingChart.jsx`).

**Step 1: Skriv komponenten**

```jsx
import React from 'react';

export const CONTENT_WIDTH_PX = 1100;
export const CONTENT_HEIGHT_PX = 700;

export default function SeatingChartPrintContent({
  boardObj, desks, deskNumberMap, placements, getStudentByIdOrName,
  groupColors, zoneMeta, settings,
}) {
  const { showNumbers, showZones, showGroups, showColors } = settings;
  return (
    <div style={{ position: 'relative', width: CONTENT_WIDTH_PX, height: CONTENT_HEIGHT_PX }}>
      <div
        style={{
          position: 'absolute', left: boardObj.x, top: boardObj.y, width: 256, height: 36,
          border: '1px solid #374151', borderRadius: 18, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', color: '#374151',
        }}
      >
        TAVLE
      </div>
      {desks.map((d) => {
        const cap = d.capacity || 1;
        const deskW = cap * 100;
        const deskNumber = deskNumberMap[d.id] || '';
        const gId = d.groupId;
        const groupColor = (gId && showGroups) ? groupColors[(gId - 1) % groupColors.length] : null;
        const activeZones = showZones ? (d.zones || []) : [];
        return (
          <div
            key={d.id}
            className="print-desk"
            style={{
              left: d.x, top: d.y, width: deskW, height: 60,
              borderColor: showColors && groupColor ? groupColor : '#374151',
            }}
          >
            {showNumbers && (
              <span style={{ position: 'absolute', top: -14, left: -4, fontSize: 10, fontWeight: 700, color: '#555' }}>
                {deskNumber}
              </span>
            )}
            {showGroups && gId && (
              <span
                style={{
                  position: 'absolute', top: -14, right: -2, fontSize: 8, fontWeight: 700,
                  color: showColors ? '#fff' : '#111', background: showColors ? groupColor : 'transparent',
                  border: showColors ? 'none' : '1px solid #374151', borderRadius: 4, padding: '1px 4px',
                }}
              >
                {gId}
              </span>
            )}
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              {Array.from({ length: cap }).map((_, slotIdx) => {
                const slotKey = `${d.id}_seat_${slotIdx}`;
                const studentVal = placements[slotKey];
                const studentObj = studentVal ? getStudentByIdOrName(studentVal) : null;
                return (
                  <div
                    key={slotIdx}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: slotIdx > 0 ? '1px solid #e5e7eb' : 'none', overflow: 'hidden' }}
                  >
                    <span className={`print-desk-name ${studentObj ? '' : 'print-desk-empty'}`}>
                      {studentObj ? studentObj.name : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
            {activeZones.length > 0 && (
              <div style={{ position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 2 }}>
                {activeZones.map((zKey) => {
                  const zm = zoneMeta[zKey];
                  if (!zm) return null;
                  return (
                    <span key={zKey} style={{ fontSize: 7, fontWeight: 700, padding: '1px 3px', border: '1px solid #999', borderRadius: 6, whiteSpace: 'nowrap' }}>
                      {zm.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Manuell sjekk**

Utsett til Task 5 (trenger `PrintPreviewModal` for å faktisk se den rendret).

**Step 3: Commit**

```bash
git add src/components/Print/printLayouts/SeatingChartPrintContent.jsx
git commit -m "feat: bryter-styrt print-innhold for klassekart"
```

---

### Task 5: `PrintPreviewModal`

**Files:**
- Create: `src/components/Print/PrintPreviewModal.jsx`

**Kontekst:** DaisyUI `<dialog>`-mønster som `Settings.jsx` bruker (`showModal()`/`close()`). To synlige mounts av `SeatingChartPrintContent` med samme `settings`: én skalert-visuell (i modalens høyre kolonne, alltid synlig når modalen er åpen) og én fullstørrelse inni `#print-output` (kun synlig via `@media print`, brukes av både "Skriv ut" og PDF-eksport siden `webContents.printToPDF()` respekterer samme `@media print`-regler som fysisk utskrift).

**Step 1: Skriv modalen**

```jsx
import React, { useState } from 'react';
import PrintPage, { computePrintScale } from './PrintPage';
import { usePrintSettings } from './usePrintSettings';
import { buildPrintFilename } from './printFilename';
import SeatingChartPrintContent, { CONTENT_WIDTH_PX, CONTENT_HEIGHT_PX } from './printLayouts/SeatingChartPrintContent';

export default function PrintPreviewModal({
  chartName, className, chartComment, boardObj, desks, deskNumberMap, placements,
  getStudentByIdOrName, groupColors, zoneMeta,
  initialShowNumbers, initialShowZones, initialShowGroups,
  onClose,
}) {
  const { settings, setShowNumbers, setShowZones, setShowGroups, setShowColors } =
    usePrintSettings({ initialShowNumbers, initialShowZones, initialShowGroups });
  const [exportState, setExportState] = useState({ status: 'idle' }); // idle | working | done | error

  const previewScale = computePrintScale(CONTENT_WIDTH_PX, CONTENT_HEIGHT_PX) * 0.6; // ekstra nedskalering for modal-visning

  const contentProps = {
    boardObj, desks, deskNumberMap, placements, getStudentByIdOrName, groupColors, zoneMeta, settings,
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    setExportState({ status: 'working' });
    const suggestedName = buildPrintFilename({ className, chartName });
    const result = await window.api.exportPrintPdf({ suggestedName });
    if (result.canceled) { setExportState({ status: 'idle' }); return; }
    if (!result.success) { setExportState({ status: 'error', message: result.error }); return; }
    setExportState({ status: 'done', filePath: result.filePath });
  };

  return (
    <>
      <dialog id="modal_print_preview" className="modal" open onClose={onClose}>
        <div className="modal-box max-w-6xl">
          <h3 className="font-bold text-lg mb-4">Skriv ut / Eksporter klassekart</h3>
          <div className="flex gap-6">
            <div className="w-48 flex flex-col gap-3">
              <label className="label cursor-pointer justify-between">
                <span>Farger</span>
                <input type="checkbox" className="toggle" checked={settings.showColors} onChange={(e) => setShowColors(e.target.checked)} />
              </label>
              <label className="label cursor-pointer justify-between">
                <span>Numre</span>
                <input type="checkbox" className="toggle" checked={settings.showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} />
              </label>
              <label className="label cursor-pointer justify-between">
                <span>Makkergrupper</span>
                <input type="checkbox" className="toggle" checked={settings.showGroups} onChange={(e) => setShowGroups(e.target.checked)} />
              </label>
              <label className="label cursor-pointer justify-between">
                <span>Soner</span>
                <input type="checkbox" className="toggle" checked={settings.showZones} onChange={(e) => setShowZones(e.target.checked)} />
              </label>
            </div>
            <div className="flex-1 overflow-auto bg-slate-800 rounded-lg p-4 flex items-center justify-center">
              <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                <PrintPage title={chartName} periodText={[className, chartComment].filter(Boolean).join(' · ')} contentWidthPx={CONTENT_WIDTH_PX} contentHeightPx={CONTENT_HEIGHT_PX}>
                  <SeatingChartPrintContent {...contentProps} />
                </PrintPage>
              </div>
            </div>
          </div>

          {exportState.status === 'done' && (
            <div className="alert alert-success mt-4 flex justify-between">
              <span>PDF lagret som {exportState.filePath.split(/[\\/]/).pop()}</span>
              <div className="flex gap-2">
                <button className="btn btn-xs" onClick={() => window.api.openPath(exportState.filePath)}>Åpne fil</button>
                <button className="btn btn-xs" onClick={() => window.api.showInFolder(exportState.filePath)}>Åpne mappe</button>
              </div>
            </div>
          )}
          {exportState.status === 'error' && (
            <div className="alert alert-error mt-4">Kunne ikke lagre PDF: {exportState.message}</div>
          )}

          <div className="modal-action">
            <button className="btn" onClick={onClose}>Lukk</button>
            <button className="btn btn-outline" onClick={handlePrint}>Skriv ut</button>
            <button className="btn btn-primary" onClick={handleExportPdf} disabled={exportState.status === 'working'}>
              {exportState.status === 'working' ? 'Genererer PDF…' : 'Eksporter til PDF'}
            </button>
          </div>
        </div>
      </dialog>

      {/* Faktisk print/PDF-mål — skjult utenfor @media print */}
      <div id="print-output">
        <PrintPage title={chartName} periodText={[className, chartComment].filter(Boolean).join(' · ')} contentWidthPx={CONTENT_WIDTH_PX} contentHeightPx={CONTENT_HEIGHT_PX}>
          <SeatingChartPrintContent {...contentProps} />
        </PrintPage>
      </div>
    </>
  );
}
```

**Step 2: Manuell sjekk**

Kan ikke fullføres før Task 9 kobler modalen til Toolbar-knappen. Fortsett til Task 6-9 før verifisering.

**Step 3: Commit**

```bash
git add src/components/Print/PrintPreviewModal.jsx
git commit -m "feat: legg til PrintPreviewModal med brytere og eksport-knapper"
```

---

### Task 6: Electron IPC — `print:export-pdf`, `print:open-path`, `print:show-in-folder`

**Files:**
- Modify: `src/ipc-handlers.js`

**Step 1: Legg til `shell` i importen (linje 6)**

```js
const { ipcMain, dialog, app, shell } = require('electron');
```

**Step 2: Legg til handlerne** (rett etter `move-db`-handleren, før "Dupliser klassekart"-seksjonen, ca. linje 265)

```js
  // ---- Print / PDF-eksport ----
  ipcMain.handle('print:export-pdf', async (_, { suggestedName }) => {
    const settings = loadSettings();
    const defaultDir = settings.lastPrintExportDir || app.getPath('documents');
    const result = await dialog.showSaveDialog(winRef.win, {
      title: 'Eksporter klassekart til PDF',
      defaultPath: path.join(defaultDir, suggestedName),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (result.canceled) return { success: false, canceled: true };
    try {
      const pdfBuffer = await winRef.win.webContents.printToPDF({
        landscape: true,
        pageSize: 'A4',
        printBackground: true,
        margins: { marginType: 'none' },
      });
      fs.writeFileSync(result.filePath, pdfBuffer);
      saveSettings({ ...settings, lastPrintExportDir: path.dirname(result.filePath) });
      return { success: true, filePath: result.filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('print:open-path', async (_, filePath) => {
    const err = await shell.openPath(filePath);
    return { success: !err, error: err || null };
  });

  ipcMain.handle('print:show-in-folder', async (_, filePath) => {
    shell.showItemInFolder(filePath);
    return { success: true };
  });
```

**Merk om marger:** `@page { size: A4 landscape; margin: 0; }` i `print.css` (Task 2) håndterer sideranden i CSS (10mm padding inni `.print-page`), så `margins: { marginType: 'none' }` her unngår at Chromium legger til *enda et* lag med marger oppå det.

**Step 3: Manuell sjekk**

Kan ikke testes isolert uten renderer-siden. Fortsett til Task 7-9.

**Step 4: Commit**

```bash
git add src/ipc-handlers.js
git commit -m "feat: Electron IPC for PDF-eksport, åpne fil og åpne mappe"
```

---

### Task 7: Eksponer IPC i `preload.js`

**Files:**
- Modify: `src/preload.js`

**Step 1: Legg til under "Database"-seksjonen (etter linje 53)**

```js
  // Print / PDF-eksport
  exportPrintPdf:   (data)   => ipcRenderer.invoke('print:export-pdf', data),
  openPath:         (path)   => ipcRenderer.invoke('print:open-path', path),
  showInFolder:     (path)   => ipcRenderer.invoke('print:show-in-folder', path),
```

**Step 2: Commit**

```bash
git add src/preload.js
git commit -m "feat: eksponer print/PDF-eksport-API til renderer"
```

---

### Task 8: Koble modalen til Toolbar og OverviewViews

**Files:**
- Modify: `src/components/SeatingChart.jsx`
- Modify: `src/components/SeatingChart/Toolbar.jsx` (ingen endring i knappe-JSX nødvendig — kun hva `handlePrint`-prop gjør)

**Step 1: Endre `SeatingChart.jsx`**

Fjern `import PrintOverlay from './SeatingChart/PrintOverlay';` (linje 2), legg til:

```js
import PrintPreviewModal from './Print/PrintPreviewModal';
```

Erstatt `handlePrint` (linje 836-841) med en modal-åpner:

```js
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const handlePrint = () => {
    setShowPrintPreview(true);
    if (new URLSearchParams(window.location.search).has('print_on_mount')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };
```

(Legg `useState`-linjen sammen med de andre `useState`-deklarasjonene rundt linje 60-64, ikke midt i funksjonen — flytt den opp dit ved implementering.)

Erstatt `<PrintOverlay .../>` (linje 1300-1308) med:

```jsx
      {showPrintPreview && (
        <PrintPreviewModal
          chartName={chartName}
          className={classes.find(c => c.id === Number(selectedClass))?.name || ''}
          chartComment={chartComment}
          boardObj={boardObj}
          desks={desks}
          deskNumberMap={deskNumberMap}
          placements={placements}
          getStudentByIdOrName={getStudentByIdOrName}
          groupColors={GROUP_COLORS}
          zoneMeta={zoneMeta}
          initialShowNumbers={showNumbers}
          initialShowZones={showZones}
          initialShowGroups={!hideGroups}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
```

**Step 2: `print_on_mount`-effekten (linje 240-245) trenger ingen endring** — den kaller allerede `handlePrint()`, som nå åpner modalen i stedet for å printe direkte. Det er nettopp ønsket oppførsel (bruker ser forhåndsvisningen før noe skrives ut).

**Step 3: Manuell verifisering**

Bruk `/run`-skillet for å starte appen. Åpne et klassekart, klikk "Skriv ut / PDF" i verktøylinjen. Bekreft:
- Modalen åpnes med forhåndsvisning som matcher gjeldende skjermbilde (numre/soner/grupper arvet riktig).
- Alle fire brytere endrer forhåndsvisningen live.
- "Skriv ut" åpner systemets print-dialog med riktig innhold (landskap, ikke avkuttet).
- Test også fra oversikts-siden: klikk print-ikonet på et klassekort, bekreft at det navigerer inn og åpner modalen automatisk (i stedet for å printe med det samme).

**Step 4: Commit**

```bash
git add src/components/SeatingChart.jsx
git commit -m "feat: koble print-modal til klassekart-verktøylinjen"
```

---

### Task 9: Fjern gammel `PrintOverlay` og verifiser PDF-eksport ende-til-ende

**Files:**
- Delete: `src/components/SeatingChart/PrintOverlay.jsx`

**Step 1: Slett filen**

```bash
git rm src/components/SeatingChart/PrintOverlay.jsx
```

**Step 2: Manuell verifisering — liten sjekkliste**

I den kjørende appen (`/run`), for **både** et lite klasserom og et stort (36-pulters, som i skjermbildet) klassekart:

- [ ] "Eksporter til PDF" → lagre-dialog åpnes med forhåndsutfylt filnavn `Klassekart_{klasse}_{kart}_{dato}.pdf`.
- [ ] Etter lagring: bekreftelsesboks vises med "Åpne fil" og "Åpne mappe" — begge fungerer.
- [ ] Åpne den lagrede PDF-en i en ekstern PDF-leser: landskap-orientering, farger med (når Farger er på), ingen avkuttet grafikk selv for det store rommet, footer med "KlassePlass" nederst.
- [ ] Slå av Farger → PDF/print viser sort/hvitt-konturer, men numre/grupper/soner er fortsatt synlige der de respektive bryterne er på.
- [ ] Avbryt lagre-dialogen → ingen feilmelding, modal forblir åpen.
- [ ] (Simuler skrivefeil ved behov: prøv å lagre til en skrivebeskyttet mappe) → feilmelding vises, modal forblir åpen.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: fjern gammel PrintOverlay etter migrering til PrintPreviewModal"
```

---

## Fase 2 — Stasjonsplaner

**Kontekst:** `#station-print-overlay`-CSS i `print.css` er i dag **død kode** — ingen komponent rendrer den (bekreftet: ingen treff på `station-print-overlay` i noen `.jsx`-fil). Det finnes ingen eksisterende print-knapp i `StationPresenter.jsx` eller `StationSetup.jsx`. Fase 2 bygger derfor `StationPrintContent` fra datamodellen i `StationPresenter.jsx:23-27` (`stations[]`, `groups[]`, `groupLeaders[]`, `rotationPlan[]`), ikke en "migrering" av eksisterende UI.

### Task 10: `StationPrintContent` — tabellbasert utskrift

**Files:**
- Create: `src/components/Print/printLayouts/StationPrintContent.jsx`

**Step 1: Skriv komponenten**

Tabell: rader = stasjoner, kolonner = rotasjonssteg. Hver celle viser hvilken gruppe (og evt. leder) som er på stasjonen i den rotasjonen. Gjenbruk `.station-print-table*`-klassene som allerede finnes i `print.css` (linje 160-186 i dagens fil, behold disse uendret gjennom Task 2).

```jsx
import React from 'react';

export const STATION_CONTENT_WIDTH_PX = 1000;

export default function StationPrintContent({ stations, groups, groupLeaders, rotationPlan, students, settings }) {
  const findStudentName = (id) => students.find(s => s.id === id)?.name || id;

  return (
    <table className="station-print-table" style={{ width: STATION_CONTENT_WIDTH_PX }}>
      <thead>
        <tr>
          <th>Stasjon</th>
          {rotationPlan.map((_, i) => <th key={i}>Rotasjon {i + 1}</th>)}
        </tr>
      </thead>
      <tbody>
        {stations.map((station, stationIdx) => (
          <tr key={stationIdx}>
            <th>{station.name || `Stasjon ${stationIdx + 1}`}</th>
            {rotationPlan.map((step, rotIdx) => {
              const groupIdx = step[stationIdx];
              const studentIds = groups[groupIdx] || [];
              const leaderId = settings.showGroups ? groupLeaders?.[groupIdx] : null;
              return (
                <td key={rotIdx}>
                  {studentIds.map((sid) => (
                    <div key={sid}>
                      {settings.showGroups && sid === leaderId ? '★ ' : ''}
                      {findStudentName(sid)}
                    </div>
                  ))}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Step 2: Manuell sjekk**

Utsett til Task 11 (trenger modal-kobling).

**Step 3: Commit**

```bash
git add src/components/Print/printLayouts/StationPrintContent.jsx
git commit -m "feat: print-innhold for stasjonsplaner"
```

---

### Task 11: Generaliser `PrintPreviewModal` til å ta `contentType`, koble til `StationPresenter`

**Files:**
- Modify: `src/components/Print/PrintPreviewModal.jsx`
- Modify: `src/components/StationPresenter.jsx`

**Step 1: Utvid modalen**

Legg til en `contentType` prop (`'seatingChart' | 'station'`, default `'seatingChart'`) og en `stationProps`-prop. Der modalen i dag hardkoder `<SeatingChartPrintContent {...contentProps} />` to steder (skalert forhåndsvisning + `#print-output`), bytt til betinget rendering:

```jsx
const content = contentType === 'station'
  ? <StationPrintContent {...stationProps} settings={settings} />
  : <SeatingChartPrintContent {...contentProps} />;
```

og bruk `content` begge steder i stedet for det hardkodede kallet. `Farger`- og `Makkergrupper`-bryterne beholdes og virker identisk (styrer leder-stjerne i stasjonstabellen); `Numre` og `Soner` er ikke meningsfulle for stasjonsplaner — skjul disse to bryterne i panelet når `contentType === 'station'`.

**Step 2: Legg til knapp i `StationPresenter.jsx`**

Følg samme mønster som `Toolbar.jsx:111-113` (ikon + tekst), plasser ved siden av eksisterende rotasjons-kontroller (rundt linje 100-110, der `rotationIndex`/`session` allerede er i scope). Åpner `PrintPreviewModal` med `contentType="station"` og `stationProps={{ stations: session.stations, groups: session.groups, groupLeaders: session.groupLeaders, rotationPlan: session.rotationPlan, students: /* hent fra klassen, se hvordan session.className brukes i samme fil */ }}`.

**Step 3: Manuell verifisering**

`/run`-skillet: åpne en stasjonsøkt, klikk ny print-knapp, bekreft tabellen viser riktige grupper/ledere per stasjon/rotasjon, test "Skriv ut" og "Eksporter til PDF" samme måte som Task 9.

**Step 4: Commit**

```bash
git add src/components/Print/PrintPreviewModal.jsx src/components/StationPresenter.jsx
git commit -m "feat: utskrift av stasjonsplaner via delt print-motor"
```

---

### Task 12: Fjern død stasjons-print-CSS (hvis ikke allerede fjernet i Task 2)

**Files:**
- Modify: `src/styles/print.css`

**Step 1:** Bekreft at `.station-print-table*`-klassene brukes av `StationPrintContent` (Task 10) og er beholdt, men at eventuelle rester av det gamle `#station-print-overlay`-ID-selektoren (display/positionering, ikke tabell-styling) er fjernet — de er overflødige nå som `#print-output` (Task 2) er det eneste synlighets-elementet.

**Step 2: Manuell sjekk**

Kjør en full utskrift av både klassekart og stasjonsplan igjen etter CSS-opprydding, bekreft ingen visuell regresjon.

**Step 3: Commit**

```bash
git add src/styles/print.css
git commit -m "chore: fjern overflødig print-CSS etter stasjonsplan-migrering"
```
