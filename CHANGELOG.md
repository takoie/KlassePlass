# Changelog — KlassePlass

Kort, lesbar logg over vesentlige endringer. Én oppføring per arbeidsøkt/PR — noen linjer, ikke en avhandling. For fullstendig historikk før 2026-07-27, se `.agent/changelog.md` (arkiv, ikke lenger aktivt vedlikeholdt).

Format per oppføring: dato, hva ble gjort, hvorfor (kun hvis ikke opplagt), berørte filer/områder.

---

## 2026-07-27 — Fikset at rom-editor stille ødela eksisterende klassekart

**Root cause (bekreftet ved kodelesing, ikke bare antatt):** dette var IKKE et
formmismatch (rundbord vs. rektangel) — begge moduler tegner bord identisk
(`kapasitet × 100px`). Det reelle problemet: bord-IDer er ikke stabile.

- `SeatingChart.jsx` lagret kun `placements` (elev → `{bordId}_seat_{N}`),
  aldri selve bordoppsettet, og leste bordene **live** fra romets
  `layout_data` hver gang et klassekart ble åpnet (`setupNewChart(Local)`).
- "Hurtiglayout"/generator-knappen i `RoomEditor.jsx` bygger hele
  bord-arrayen på nytt med ferske `Date.now()`-baserte IDer
  (linje ~181-189), selv på et rom som allerede har aktive klassekart.
- Konsekvens: å regenerere et rom som allerede er i bruk gjorde alle
  eksisterende elevplasseringer foreldreløse — stille, uten advarsel.
  Klassekartet så ut som om alle elevene forsvant.

**Fiks — klassekart får sitt eget frosne snapshot av bordoppsettet:**
- `saveCurrentSeating`/`handleStartNewPeriod` lagrer nå `deskLayout: { desks,
  doors, windows, boardObj }` sammen med `placements` i samme JSON-blob
  (ingen skjemamigrering nødvendig — gjenbruker eksisterende `placements`-kolonne).
- `setupNewChart`/`setupNewChartLocal` bruker snapshotet hvis det finnes,
  og faller tilbake til å lese rommet live kun for kart lagret før denne
  fiksen (bakoverkompatibelt).
- Ny knapp **"Hent fra rom"** i verktøypanelet: henter bevisst det
  nåværende romoppsettet inn i klassekartet, med bekreftelsesdialog som
  forklarer at elever ved bord som ikke lenger finnes blir uplasserte.
  Dette var en reell funksjon i v1 (`syncRoomLayout()`), som forsvant i
  senere rebuilds — gjeninnført her som en eksplisitt, ikke-automatisk handling.

**Verifisert end-to-end** via reell kjøring av appen (ikke bare bygget):
plasserte en elev, regenererte rommet (nye bord-IDer), åpnet klassekartet
på nytt — eleven satt fortsatt riktig. Trykket "Hent fra rom" — eleven
ble korrekt uplassert og bord-tellingen oppdatert (27 → 28 uplasserte).

**Berørte filer:** `src/components/SeatingChart.jsx`, `.gitignore` (la til
`dist-react/`, som manglet fra Vite-migreringen)

---

## 2026-07-27 — Fikset manglende utskrift/PDF + krasj ved oppstart (electron-updater)

**1. "Skriv ut / PDF" i klassekart produserte ikke lenger et brukbart resultat**
`SeatingChart.jsx` kaller `window.print()`, men den tilhørende `src/styles/print.css` (med `#print-overlay`, `.print-desk` osv.) var aldri importert noe sted, og selve overlay-markupen som skulle vises under utskrift fantes ikke i React-komponenten — verken i v2 eller v3. Resultatet ville vært utskrift av selve mørke redigerings-UI-et (verktøylinjer, sidepanel osv.), eller en blank side (siden CSS-en skjuler `#app-shell` i `@media print` uten noe å vise i stedet).

- Importerte `print.css` globalt i `src/main.jsx`.
- La til `#print-overlay`-markup i `SeatingChart.jsx`: tegner klassekartnavn, klasse, periode, dato, tavle og alle bord med plasserte elever — kun synlig for skriveren (`@media print`), aldri på skjerm.
- La til `@page { size: landscape; margin: 10mm }` for riktig papirretning (rommet er liggende).
- **Verifisert visuelt**: startet appen ekte (ikke bare bygget), åpnet et eksisterende klassekart (1ST5), og emulerte print-media via DevTools Protocol for å se faktisk utskriftsresultat — ren hvit A4-vennlig visning med korrekt bordoppsett, i stedet for det tidligere ødelagte/manglende resultatet.

**2. Appen krasjet umiddelbart ved oppstart (`npm start`), uavhengig av print-fiksen**
`src/updater.js` gjorde `require('electron-updater')` på modul-nivå, og denne modulen instansierer `NsisUpdater` med det samme en `autoUpdater`-property leses. Siden `src/updater.js` lastes helt i toppen av `main.js` (før `app.whenReady()`), skjedde dette for tidlig i prosess-oppstarten og feilet med `TypeError: Cannot read properties of undefined (reading 'getVersion')` — appen avsluttet før noe vindu i det hele tatt ble opprettet.

- Flyttet `require('electron-updater')` inn i `setupUpdater()`-funksjonen, som uansett først kalles inne i `app.whenReady()`. Lazy require løser dette uavhengig av miljø.
- Merk: en del av det opprinnelige krasjebildet skyldtes også `ELECTRON_RUN_AS_NODE=1` i selve testmiljøet (fikk Electron til å kjøre som ren Node uten `app`-API) — det er ikke en kodefeil, men gjorde feilsøkingen forvirrende. Selve lazy-require-fiksen er uavhengig gyldig og bør beholdes.

**Ikke gjort ennå (bevisst utsatt, se punkt under):** verifiserte kun klasser → klassekart → utskrift-løypen. Rom-editoren og hvordan bordformer (rundbord, benk osv.) fra rom-editoren faktisk mappes inn i klassekart-modulen er ikke testet i denne økten — bruker har allerede meldt at dette kobles rart, og kodegjennomgang bekrefter: `SeatingChart.jsx` tegner alle bord som ensartede rektangler basert kun på kapasitet (`cap * 100`px bredde), uten å bruke `DESK_TYPES`-formene (rundbord, benk) eller rotasjon fra rom-editoren i det hele tatt. Dette er neste naturlige punkt å ta fatt på.

**Berørte filer:** `src/main.jsx`, `src/styles/print.css`, `src/components/SeatingChart.jsx`, `src/updater.js`

---

## 2026-07-27 — Statusgjennomgang: arkitektur er midt i uferdig React-migrering

**Funn (ikke en endring, en kartlegging):**

Repoet har nå tre arkitektur-generasjoner i sin historie:

1. **v1** — monolittisk `renderer.js` (~3000 linjer) + `index.html` (~3335 linjer). Forlatt 2026-03-04.
2. **v2** — modulær vanilla JS (`src/views/*.js` + `*.html`, DaisyUI/Tailwind). Bygget fra scratch mars 2026, fikk mye funksjonalitet fram til juli: klasser, rom, klassekart, innstillinger m/faner, gruppetildeling for gruppearbeid (`group-editor`/`group-setup`/`group-dashboard`), stasjonsundervisning (`station-setup`), onboarding-wizard, sesonghistorikk-visning.
3. **v3 (pågår, ukommitert)** — React + Vite + Tailwind (`src/App.jsx`, `src/components/*.jsx`). Startet ca. 2026-07-22. Alle v2-view-filene står som slettet i arbeidskopien, men er ikke committet ennå.

**Status på v3 akkurat nå:**
- Fungerer: Klasser, Rom-editor, Klassekart/Seating chart (inkl. bordklynger "Makkergrupper"), Innstillinger (delvis).
- **Mangler helt i UI, men backend/IPC/DB-lag lever fortsatt ubrukt:**
  - Gruppetildeling for gruppearbeid (`get/save/delete-group-assignment*` i `ipc-handlers.js`, `src/shared/groupRandomizer.js`) — ingen React-komponent kaller disse.
  - Sesonghistorikk (`seating_history`-tabell, historikk-IPC) — ingen visning.
  - Database backup/restore og JSON eksport/import (`backup-db`, `restore-db`, `export-bundle`, `import-bundle`) — full backend-støtte, men ny `Settings.jsx` har ingen fane for det (kun Visning/Om/Personvern/Lisenser).
  - Onboarding-wizard — ingen erstatning i React.
  - Stasjonsundervisning — ingen erstatning i React.
- Filstørrelse-disiplinen fra v2-rebuilden (maks ~300 linjer/fil) er forlatt: `SeatingChart.jsx` er 1542 linjer, `RoomEditor.jsx` er 1197 linjer.
- `docs/plans/2026-03-07-school-features.md` beskriver 8 planlagte skolefunksjoner mot v2-arkitekturen (`src/views/...`) — planen er skrevet for et lag som nå er slettet, og må enten oppdateres for React eller arkiveres.

**Vurdering: tilpasse ukommitert React-migrering ferdig, ikke starte på nytt igjen.**

- DB-skjema, IPC-laget og kjernelogikk (randomizer, constraints, historikk) har overlevd uendret gjennom alle tre generasjonene — det er ikke der problemet ligger.
- "Rotet" oppstår fordi UI-laget skrives om fra bunnen før forrige UI-lag rekker å bli ferdig og stabilt (v2 ble aldri helt ferdig med alt skissert i school-features.md før v3 startet). En fjerde full rewrite ville mest sannsynlig gjenta mønsteret.
- Anbefalt rekkefølge: (1) commit v3-migreringen som egen milepæl, (2) gjenopprett de fire orphanede funksjonene i React (gruppetildeling og backup/restore har allerede full backend — kun UI mangler), (3) splitt `SeatingChart.jsx`/`RoomEditor.jsx` i mindre filer, (4) skriv `school-features.md` om til React eller arkiver den.

**Berørte filer:** ingen kodeendringer i denne oppføringen — kun dokumentasjon (`CHANGELOG.md` opprettet).

---
