# Changelog — KlassePlass

Kort, lesbar logg over vesentlige endringer. Én oppføring per arbeidsøkt/PR — noen linjer, ikke en avhandling. For fullstendig historikk før 2026-07-27, se `.agent/changelog.md` (arkiv, ikke lenger aktivt vedlikeholdt).

Format per oppføring: dato, hva ble gjort, hvorfor (kun hvis ikke opplagt), berørte filer/områder.

---

## 2026-07-27 — Gjeninnført gruppetildeling for gruppearbeid

Første av de bevisst utsatte "punkt 4"-funksjonene fra v2 som er gjenoppbygd
i React (brukervalgt prioritet av de resterende: gruppetildeling,
stasjonsundervisning, deltakelseslogg, onboarding-wizard).

**Ny funksjonalitet:**
- Ny fane "Gruppearbeid" i hovednavigasjonen.
- **Opprett ny inndeling**: velg klasse, antall grupper, regler
  (aldri/alltid sammen — gjenbruker eksisterende `student_constraints`),
  unngå nylige gruppekombinasjoner (siste N inndelinger), og valgfri
  gruppeleder-spredning (én leder per gruppe).
- Grupper genereres og lagres med det samme, så redigeringsvisningen alltid
  åpnes med en ekte, lagret inndeling (samme mønster som klassekart).
- Redigeringsvisning: se genererte grupper i fargede kolonner, flytt
  enkeltelever manuelt mellom grupper, "Generer på nytt", eksplisitt
  "Lagre" (lagrer inndelingen OG skriver til historikk-tabellen — historikk
  skrives bevisst kun ved eksplisitt lagring, ikke ved hver regenerering).

**Reell bug funnet og fikset underveis:** `groupRandomizer.js`s
`generateGroups()`-funksjon forventer constraint-objekter med camelCase-felt
(`studentA`/`studentB`), men `get-constraints`-IPC-en returnerer rader
direkte fra SQLite med snake_case-kolonnenavn (`student_a`/`student_b`).
Uten oversettelse ville "Respekter plasserings-regler" vært en stille no-op
— reglene ville aldri faktisk blitt sjekket. Dette gjaldt sannsynligvis
allerede i v2 (samme mismatch fantes der). Fikset ved å mappe feltnavnene
riktig før kall til `generateGroups()` i både opprettelses- og
regenereringsstegene.

**Bevisst forenklet fra v2:** kun "alle elever i klassen" støttes som kilde
for gruppeinndeling i denne runden (v2 støttet også "fra eksisterende
klassekart" som delmengde) — dekker de fleste bruksmåter, og
klassekart-kilde kan legges til senere om det trengs.

**Verifisert end-to-end** i ekte kjørende app mot ekte data (28 elever):
opprettet inndeling → 4 grupper à 7 elever generert og lagret korrekt →
flyttet en elev manuelt mellom grupper → lagret → bekreftet i databasen at
`group_assignment_groups` og `group_history` (85 par, matcher
kombinatorikken nøyaktig) ble skrevet riktig → regenerering ga ny,
gyldig fordeling → oversiktskort viser riktig antall grupper og
historikk-teller. All testdata slettet fra databasen etterpå.

**Nye filer:** `src/components/GroupEditor.jsx`,
`src/components/GroupWork/CreateGroupModal.jsx`

**Berørte filer:** `src/App.jsx`, `src/components/Layout.jsx`,
`src/components/OverviewViews.jsx` (ny `GroupOverview`-eksport)

---

## 2026-07-27 — Splittet RoomEditor.jsx (1197 → 1075 linjer)

Samme trygge tilnærming som `SeatingChart.jsx` rett over: kun rene
presentasjonsblokker flyttet ut, all drag-and-drop-logikk (magnetisk
snapping, kollisjonssjekk, `@dnd-kit`-integrasjon) beholdt uendret i
hovedfilen. `RoomEditor.jsx` hadde allerede en del av arbeidet gjort fra før
(`DeskItem`, `BoardItem`, `DoorItem`, `WindowItem`, `RoomToolsDrawer` var
extrahert tidligere), så gjenstående trygt uttrekkbart innhold var mindre
enn i klassekartet.

**Nye filer i `src/components/RoomEditor/`:**
- `HeaderBar.jsx` — rom-valg, nytt rom-knapp, lagre-status, slett-knapp
- `DeskContextMenu.jsx` — høyreklikk-meny på valgte bord
- `Modals.jsx` — opprett nytt rom (med preset-valg) + slett rom-dialog

**Verifisert end-to-end** i ekte kjørende app: rom-valg, høyreklikk-meny med
korrekt bordvalg-synkronisering mot sidepanelet, "Nytt rom"-modal med alle
presets, "Slett rom"-modal med korrekt romnavn. Ingen endringer lagret til
databasen under testing.

**Berørte filer:** `src/components/RoomEditor.jsx`,
`src/components/RoomEditor/*.jsx` (3 nye filer)

---

## 2026-07-27 — Splittet SeatingChart.jsx (1755 → 1374 linjer)

Filstørrelse-disiplinen fra v2-rebuilden (maks ~300 linjer/fil) var forlatt i
React-migreringen. `SeatingChart.jsx` hadde vokst til 1755 linjer og var
identifisert som teknisk gjeld i statusgjennomgangen tidligere i dag.

**Tilnærming — kun trygge, rent presentasjonsmessige utrekk:** all
tilstand/forretningslogikk (drag-and-drop, autolagring, periodebytte,
randomisering osv.) er beholdt uendret i `SeatingChart.jsx`. Kun JSX-blokker
som utelukkende leser props og kaller videreførte callback-funksjoner ble
flyttet ut — ingen closures over delt tilstand ble flyttet. Dette var et
bevisst valg: dagens økt viste to ganger (lastID-bug, stale closure i
periodebytte) hvor lett denne typen kode introduserer subtile feil, så
selve tilstandshåndteringen ble ikke rørt.

**Nye filer i `src/components/SeatingChart/`:**
- `HeaderBar.jsx` — klasse/rom/periode-valg, kartnavn, lagre-status
- `Toolbar.jsx` — venstre verktøypanel (handling/visning/administrasjon)
- `StudentDrawer.jsx`, `GroupDrawer.jsx`, `FunDrawer.jsx` — de tre skuffene
- `Modals.jsx` — de fire bekreftelses-/redigeringsdialogene samlet
- `DeskContextMenu.jsx` — høyreklikk-meny på bord
- `PrintOverlay.jsx` — utskriftsvisningen

**Verifisert end-to-end** i ekte kjørende app etter hvert steg (ikke bare
bygget): periode-velger, skuffer (åpne/lukke/veksle), høyreklikk-meny på
bord med korrekt makkergruppe-tildeling (bekreftet full rundtur til state og
tilbake), dra-og-slipp av elev. All testdata ryddet fra ekte database
etterpå.

**Ikke gjort:** selve lerret-rendering (bord/dra-slipp-matematikk) ble
bevisst IKKE flyttet ut — det er der drag-state og musehåndterere henger tett
sammen, og risikoen for regresjon vurderes for høy til å gjøre det uten enda
grundigere testing. `RoomEditor.jsx` (1197 linjer) er heller ikke rørt i
denne økten.

**Berørte filer:** `src/components/SeatingChart.jsx`,
`src/components/SeatingChart/*.jsx` (7 nye filer)

---

## 2026-07-27 — Oppdaterte school-features.md: var ikke en plan, men en fasit

`docs/plans/2026-03-07-school-features.md` beskrev 8 "planlagte" skolefunksjoner.
Ved gjennomgang viste det seg at samtlige 8 allerede var bygget ferdig i
v2-arkitekturen (bekreftet ved å lese `db/schema.js` og `src/ipc-handlers.js`
direkte — ikke bare anta ut fra dokumentet):

- **Deltakelseslogg** (`participation_logs`-tabell + full IPC) — helt ny
  oppdagelse, ikke tidligere nevnt som manglende funksjonalitet.
- **Timeplan/Dagsoversikt** (`schedule`-tabell + full IPC) — samme, ny
  oppdagelse.
- Stasjonsundervisning og gruppetildeling — bekrefter det som allerede var
  kjent som utsatt "punkt 4"-funksjonalitet.
- Parvisning, grupperotering-statistikk, nivåbasert gruppering, gradvis
  avdekking i presentasjon — krever ingen nye databasetabeller, kan bygges
  direkte i React.
- Utskrift/vikarmodus — allerede løst (se fiksen tidligere i dag).

Alt dette ble bygget i v2 (`src/views/*.js`), men de filene ble slettet i
React-migreringen uten at funksjonaliteten ble gjenoppbygd — kun databasen,
IPC-laget og preload-broen overlevde uendret. Dokumentet er nå merket som
arkivert/historisk referanse i stedet for aktiv plan, med en tydelig statusboks
som lister nøyaktig hva som er bekreftet intakt i backend.

**Ingen kodeendringer** — kun dokumentasjon. Dette utvider listen over
funksjonalitet som gjenstår å gjenoppbygge i React utover det som tidligere
var identifisert (gruppetildeling, onboarding-wizard, stasjonsundervisning).

**Berørte filer:** `docs/plans/2026-03-07-school-features.md`

---

## 2026-07-27 — Lagt til Database & Sikkerhetskopi-fane i Innstillinger

Backend har hele tiden hatt full støtte for database-backup/restore/flytting
(`backup-db`, `restore-db`, `move-db` i `ipc-handlers.js`, eksponert i
`preload.js`), men React-versjonen av Innstillinger hadde ingen fane som
viste dette — kun Visning, Om, Personvern og Lisenser.

**Lagt til ny fane "Database & Sikkerhetskopi" i `Settings.jsx`:**
- **Ta sikkerhetskopi** — lagrer en kopi av hele databasen til valgfri fil
  (native lagre-dialog).
- **Gjenopprett fra sikkerhetskopi** — med bekreftelsesdialog som forklarer
  at gjeldende database erstattes (og at den automatisk tas vare på som
  `.bak` først, jf. tidligere fiks i `6d6ea31`).
- **Flytt database** — flytter databasefilen til en annen mappe (f.eks.
  delt stasjon), med bekreftelsesdialog om at appen må startes på nytt.

Underveis avdekket en visuell bug i mine egne første bekreftelsesdialoger:
brukte først React-betinget rendering (`{open && <dialog className="modal
modal-open">...}`) i stedet for native `dialog.showModal()`. Skjermbilder
tatt rett etter åpning viste tekst fra kortet bak "blø gjennom" — men dette
var kun daisyUIs CSS-overgang midt i animasjon på grunn av øyeblikkelig
skjermbilde, ikke en reell rendering-bug. Byttet likevel til samme
native-`showModal()`-mønster som resten av appen (`SeatingChart.jsx`) for
konsistens og fordi det er det bekreftet fungerende mønsteret.

**Verifisert i ekte kjørende app:** fanen viser riktig innhold, begge
bekreftelsesdialogene åpner/lukker korrekt. Selve native fil-dialogene
(lagre/åpne/velg mappe) ble bevisst IKKE trigget under automatisert testing
— disse blokkerer Electron-rendereren slik `window.print()` gjorde tidligere
i økten, og koden bak er allerede validert (samme `backup-db`/`restore-db`
IPC-handlere har vært i bruk og testet manuelt i tidligere versjoner).

**Berørte filer:** `src/components/Settings.jsx`

---

## 2026-07-27 — Gjeninnført periodebytte for klassekart + fikset at nye rader alltid fikk id 0

**Bakgrunn:** "se historikk" var ett av de fire opprinnelige kjernekravene, men
i React-migreringen manglet det helt en måte å bytte mellom tidligere lagrede
klassekart-perioder for en klasse. Ved kodegjennomgang viste det seg at all
logikken for dette (`handleStartNewPeriod`, `handleSelectSeating`,
`editingPeriod`/`handleSaveEditedPeriod`) allerede fantes i `SeatingChart.jsx`
— men var aldri koblet til noen knapp eller `<select>` i JSX. "Mine
Klassekart"-oversikten viste kun "Historikk: N perioder" som ren tekst, uten
noen måte å faktisk åpne de eldre periodene.

**Lagt til i verktøylinjen:**
- **Periode**-nedtrekksmeny: lister alle lagrede perioder for gjeldende
  klasse (nyeste først), bytter direkte til valgt periode.
- **Ny periode**-knapp: lagrer gjeldende oppsett som en ny, separat periode
  (f.eks. "Uke 5-8") og bytter til den — den forrige perioden blir liggende
  urørt som historikk.
- Blyant-ikon åpner en rediger-modal for periodens navn/kommentar
  (gjenbruker den eksisterende `handleSaveEditedPeriod`-logikken).

**Reell bug funnet og fikset underveis (uavhengig av UI-jobben over):**
`dbRun()` i `ipc-handlers.js` beregnet `lastID` via `SELECT
last_insert_rowid()` **etter** `saveDbToDisk()` — men `saveDbToDisk()` kaller
`db.export()` (sql.js), som nullstiller tilkoblingens `last_insert_rowid()`.
Resultat: *alle* nye rader i hele appen (nye klasser, rom, klassekart) fikk
`lastID: 0` tilbake til rendereren, uavhengig av at raden ble opprettet
korrekt i databasen med riktig auto-increment-id. Dette gjorde at kode som
stolte på `result.lastID` for å automatisk åpne/velge en nyopprettet rad
(bl.a. den nye periode-bytte-funksjonaliteten) stille feilet — databasen var
riktig, men UI-et ble stående på den gamle raden.
Fikset ved å snu rekkefølgen: hent `lastID` **før** `saveDbToDisk()` kalles.
Bekreftet årsak ved isolert testing direkte mot IPC-laget (samme kall med og
uten `saveDbToDisk()` i mellom ga hhv. korrekt id og alltid 0).

**Verifisert end-to-end** i ekte kjørende app: opprettet ny periode fra et
klassekart med en plassert elev → periode-velgeren byttet automatisk til den
nye perioden (id fra databasen, ikke 0) → byttet tilbake til den opprinnelige
perioden via nedtrekksmenyen → begge perioder beholdt riktig data uavhengig
av hverandre. Ryddet bort alt testdata (testklasser/perioder) fra den ekte
brukerdatabasen etter verifisering.

**Berørte filer:** `src/components/SeatingChart.jsx`, `src/ipc-handlers.js`

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
