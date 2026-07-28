# Design: Bedre print/PDF-eksport for klassekart

## Bakgrunn

Dagens utskrift skjer via `window.print()` mot en skjult `#print-overlay`-div
(`src/components/SeatingChart/PrintOverlay.jsx`, styrt av
`src/styles/print.css`). Overlayet ignorerer alle av/på-brytere som finnes i
appen (`showNumbers`, `showZones`, `hideGroups`), viser ingen farger, og har
ingen skalering for store rom — resultatet er avkuttet grafikk og
sort/hvitt-utskrift uten sonemerking. "PDF" i dag er bare OS/Electron sin
"Lagre som PDF" i print-dialogen; appen genererer ikke PDF selv.

Målet er et eget print-verktøy med forhåndsvisning, egne knapper for "Skriv
ut" og "Eksporter til PDF", og brytere for farger/numre/makkergrupper/soner —
delt mellom klassekart-visningen (`SeatingChart.jsx`) og stasjonsplaner
(`StationPresenter`/`StationSetup`).

## Omfang

- **Fase 1:** Klassekartet (`SeatingChart.jsx`/`PrintOverlay.jsx`) — størst
  smerte i dag.
- **Fase 2 (samme leveranse):** Stasjonsplaner kobles på samme motor,
  `#station-print-overlay` fjernes.
- Gammel `PrintOverlay.jsx` fjernes først når begge er migrert.

## Arkitektur

Electron 28 + React 18, ingen router (view-state i `App.jsx`), ingen
PDF/canvas-bibliotek i dag. Vi bygger et **delt `PrintDocument`-komponentsett**
i `src/components/Print/` i stedet for å rasterisere (html2canvas/jsPDF) eller
kun flikke på dagens CSS-overlay — se avveininger i prosjekthistorikken for
brainstormingen. Dette gir ekte WYSIWYG (forhåndsvisning = faktisk print-DOM)
og vektor-PDF via Electrons innebygde `webContents.printToPDF()`, uten nye
npm-avhengigheter.

### Nye filer

- `src/components/Print/PrintPage.jsx` — paper-abstraksjon: A4-landskap
  (fast standard, alltid), mm-basert layout, header (tittel uten
  periode-parentes + egen periode-linje som i dag), footer (liten
  KlassePlass-logo + evt. sidetall). Beregner skaleringsfaktor
  `min(1, pageWidth/contentWidth, pageHeight/contentHeight)` slik at store rom
  (f.eks. 36 pulter) alltid får plass på én side — samme beregning brukes i
  forhåndsvisning og faktisk eksport, så det som vises er det som skrives ut.
- `src/components/Print/PrintPreviewModal.jsx` — DaisyUI `<dialog>` (samme
  mønster som `Settings.jsx`), bryterpanel til venstre, skalert
  `PrintPage`-forhåndsvisning til høyre (`transform: scale()`).
- `src/components/Print/usePrintSettings.js` — initierer brytere fra
  gjeldende visning (arver `showNumbers`/`showZones`/`hideGroups` fra
  `SeatingChart.jsx`-state), pluss ny `showColors`-master-bryter (default på).
  Huskes i `localStorage` mellom sesjoner.
- `src/components/Print/useExportPdf.js` — kaller ny Electron IPC-kanal
  `print:export-pdf`.
- `src/components/Print/printLayouts/SeatingChartPrintContent.jsx` — dagens
  `PrintOverlay`-innhold flyttet hit som ren innholdskomponent
  (`{desks, deskNumberMap, placements, settings}` → JSX), rammet inn av
  `PrintPage`.
- `src/components/Print/printLayouts/StationPrintContent.jsx` — tilsvarende
  for stasjonsplaner, bygget fra dagens `#station-print-overlay`-innhold.

### Dataflyt

`Toolbar.jsx` sin "Skriv ut / PDF"-knapp åpner `PrintPreviewModal` i stedet
for å kalle `handlePrint()` direkte. Modalen mottar samme props som
`PrintOverlay` allerede får, pluss `contentType: 'seatingChart' | 'station'`
som velger riktig `printLayouts/*Content`. Bryterendringer oppdaterer kun
lokal `settings`-state — `PrintPage` re-rendrer live uten ny datahenting.

## Brytere og standardverdier

| Bryter | Styrer | Default |
|---|---|---|
| Farger | Master av/på for gruppefarger, sonefarger, bakgrunn vs. sort/hvitt-kontur | På |
| Numre | Pult-nummerering (`deskNumberMap`) | Arves fra gjeldende visning |
| Makkergrupper | Gruppe-badge/leder-stjerne (uavhengig av Farger-bryteren) | Arves fra gjeldende visning |
| Soner | Sonemerking (vindu/dør/foran/bak/senter) | Arves fra gjeldende visning |

Forhåndsvisningen arver alltid brytertilstanden fra skjermen den ble åpnet
fra ("det du ser er det du får"), ikke faste standardverdier.

## Handlinger

To tydelige knapper nederst i modalen, som løser "må bruke PDF-modulen i
print"-problemet:

- **"Skriv ut"** — `window.print()` mot den skjulte fullstørrelses
  `PrintPage`, med `@page { size: A4 landscape }` tvunget i CSS.
- **"Eksporter til PDF"** — se under.

## PDF-eksport (Electron-mekanikk)

1. Renderer kaller `useExportPdf()` → `ipcRenderer.invoke('print:export-pdf', …)`
   med et automatisk generert filnavn:
   `Klassekart_{klasse}_{rom}_{YYYY-MM-DD}.pdf` (sanitert for ugyldige
   filnavn-tegn), bygget fra samme `chartName`/`className`-props som
   `PrintOverlay` allerede mottar.
2. Main-prosessen kaller `webContents.printToPDF({ landscape: true,
   pageSize: 'A4', printBackground: true, margins: {...} })` på hovedvinduet
   —  ingen eget vindu trengs, siden `PrintPage` alltid finnes off-screen i
   samme DOM. `printBackground: true` er kritisk for at farger/soner faktisk
   kommer med i PDF-en (motsatt av i dag).
3. Main viser `dialog.showSaveDialog` forhåndsutfylt med det genererte
   filnavnet i sist brukte mappe (husket lokalt), skriver PDF-bufferet til
   valgt sti.
4. Ved suksess: modalen viser en bekreftelsesboks ("PDF lagret som
   *filnavn*") med to knapper — **"Åpne fil"** (`shell.openPath`) og
   **"Åpne mappe"** (`shell.showItemInFolder`) — begge via samme IPC-kanal.

### Feilhåndtering

- Avbrutt lagre-dialog → ingen feilmelding, modal forblir åpen.
- Skrivefeil (mappe fjernet, disk full, o.l.) → toast med feilmelding, modal
  forblir åpen for nytt forsøk/annen mappe.
- Tomt klasserom/ingen elever plassert → forhåndsvisningen viser samme
  "tomt"-tilstand som dagens visning, ikke en feil.

## Testing

Ingen automatisert UI-test-infrastruktur finnes for print i dag, og omfanget
tilsier ikke at vi bygger et rammeverk kun for dette. Verifisering skjer
manuelt i den kjørende Electron-appen: lite og stort (36-pulters) klasserom,
alle brytekombinasjoner, "Skriv ut" og "Eksporter til PDF", samt åpning av
resulterende PDF i ekstern leser for å bekrefte farger/footer-logo/ingen
avkutting.

## Ikke i scope

- Batch-eksport av flere klassekart samtidig (bruksmønsteret er ett rom om
  gangen, ofte).
- Flersides/tiling-utskrift av store rom (vi skalerer alltid ned til én
  side).
- Eget forhåndsvisningsvindu (vi bruker in-app modal, ikke separat
  Electron-vindu).
