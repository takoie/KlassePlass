# Stasjonsmodul: tastatur-vennlig "ny stasjon", dra-og-slipp grupper, gruppeleder

## Bakgrunn

I `StationSetup.jsx` ligger "Legg til stasjon"-knappen i toppen av stasjonspanelet, før
listen av stasjoner. Det gjør at tab-rekkefølgen hopper fra siste stasjons søppelbøtte
rett videre til Gruppe-seksjonen — det finnes ingen tastaturvennlig måte å legge til en
ny stasjon rett etter man er ferdig med forrige.

Elever flyttes i dag mellom grupper via en `<select>`-dropdown per elevkort, samme mønster
som i `GroupEditor.jsx`. Det finnes ingen måte å utpeke en gruppeleder i stasjonsmodulen.

Et beslektet design (`2026-07-27-group-editor-dnd-lock-leader-design.md`) er skrevet for
`GroupEditor.jsx` (dra-og-slipp + høyreklikk-meny for leder/lås), men ikke implementert.
Denne planen gjenbruker samme dra-og-slipp-mønster (`@dnd-kit/core`) for konsistens, men
med enklere leder-UX (stjerne-klikk, ikke kontekstmeny) og uten lås-funksjonalitet, som
avtalt for `StationSetup.jsx` spesifikt.

## Mål

1. `+ Ny stasjon` flyttes til bunnen av stasjonslisten, slik at den havner naturlig i
   tab-rekkefølgen rett etter siste stasjons felter. Mellomrom (nativ knappe-aktivering)
   legger til en ny stasjon, og fokus hopper automatisk til dens navnefelt.
2. Erstatt dropdown med dra-og-slipp mellom gruppepaneler i stasjonsmodulen.
3. Legg til manuell gruppeleder: stjerne-ikon per elev i gruppekortet, kun én leder per
   gruppe, ren manuell merking uten kobling til Auto-fordel.
4. Vis leder i `StationPresenter.jsx` under rotasjon.

## 1. Ny stasjon via tab + mellomrom

- Fjern "Legg til stasjon"-knappen fra header-raden i Stasjoner-kortet.
- Legg til en `+ Ny stasjon`-knapp (stiplet kant, samme visuelle språk som tomme
  drop-soner ellers i appen) som siste element i stasjonslisten, etter `stations.map(...)`.
  Siden den er sist i DOM-rekkefølgen får den naturlig riktig tab-plassering — ingen
  `tabIndex`-manipulasjon nødvendig.
- `addStation` settes til å også lagre id-en til den nye stasjonen i en ny state
  `pendingFocusId`.
- Navnefeltene får en ref pr. stasjon (`useRef({})`-map, keyed på stasjon-id).
- `useEffect` som kjører når `pendingFocusId` endres: fokuserer input-refen for den nye
  stasjonen og nullstiller `pendingFocusId`.
- Native `<button>` trenger ingen egen `onKeyDown`-håndtering for mellomrom — nettleseren
  aktiverer `onClick` på mellomrom/enter automatisk.

## 2. Dra-og-slipp for elever mellom grupper

- `@dnd-kit/core` (eksisterende avhengighet, brukt i `RoomEditor.jsx`) — `DndContext`,
  `useDraggable`, `useDroppable`, `DragOverlay`, `PointerSensor`/`useSensor`.
- Gruppe-gridet i `StationSetup.jsx` wrappes i én `DndContext`.
- Hvert gruppepanel blir en droppable-sone: `useDroppable({ id: 'station-group-' + idx })`.
- Hvert elevkort blir draggable: `useDraggable({ id: studentId })` — hele kortet er
  drahåndtak, `<select>` fjernes.
- `DragOverlay` viser et kort som følger pekeren under dra (samme visuell stil som
  elevkortet, litt skygge/skalert).
- Droppable-panelet får en visuell highlight (ring i gruppefargen) når et kort dras over
  det, styrt av `isOver`-flagget fra `useDroppable`.
- `onDragEnd(event)`: parse gruppeindeks fra `over.id` (`'station-group-' + idx`), finn
  kildegruppe ved å skanne `groups` for `active.id`, kall eksisterende
  `moveStudent(studentId, fromIdx, toIdx)` uendret. Ingen endring i `moveStudent`-logikken.
- Slipp utenfor en gyldig droppable (`over == null`) er en no-op.

## 3. Gruppeleder

- Ny state `groupLeaders`: array parallelt med `groups`, ett element per gruppe —
  elev-id for lederen, eller `null`. Initialiseres til `groups.map(() => null)` og
  holdes synkronisert i `setNumGroups` (nye grupper får `null`, fjernede grupper sin
  leder fjernes).
- Stjerne-ikon (`fa-star`, samme visuelle mønster som `isLeader` i `GroupEditor.jsx`) i
  hver elevrad i gruppekortet. Klikk kaller `toggleLeader(groupIdx, studentId)`:
  - Hvis eleven allerede er leder for gruppa: sett til `null` (fjern lederstatus).
  - Ellers: sett `groupLeaders[groupIdx] = studentId` (overskriver evt. tidligere leder
    i samme gruppe — kun én leder per gruppe).
- `moveStudent` oppdateres til å nullstille leder-status for en elev som flyttes ut av
  gruppen den var leder for (leder-status følger ikke eleven til ny gruppe).
- Ren UI-tilstand + lagring — ingen kobling til `autoDistribute`/`generateGroups`.

## 4. Datamodell og persistering

- Ny kolonne på `station_sessions`: `group_leaders TEXT DEFAULT '[]'` — schema-migrasjon
  v8 i `db/schema.js`, samme `try { db.run(\`ALTER TABLE ...\`) } catch(e){}`-mønster som
  `teacher_station_id` (v6) og `neighbors` (v7).
- `save-station-session`-handleren i `src/ipc-handlers.js` utvides til å ta imot og
  lagre `groupLeaders` (samme JSON.stringify-mønster som `groups`). `get-station-session`
  gjør allerede `SELECT *`, så ingen endring der.
- `preload.js` sjekkes — `saveStationSession` videresender trolig hele payload-objektet
  uendret (samme mønster som `saveGroupAssignment`), men verifiseres under implementasjon.
- `StationSetup.jsx` sin `loadInitial` parser `s.group_leaders` på samme måte som
  `s.groups` i dag (`JSON.parse(... || '[]')` i try/catch, fallback til
  `groups.map(() => null)` hvis feltet mangler/er tomt — dekker eksisterende økter lagret
  før migreringen).

## 5. Visning i StationPresenter

- `StationPresenter.jsx` parser `s.group_leaders` på samme måte som `groups`.
- I elevlisten for hver stasjon: eleven som matcher `groupLeaders[groupIdx]` får en liten
  gul stjerne foran navnet (samme ikon/farge som i redigeringsvisningen).

## Ikke i scope

- Endre `autoDistribute`/`generateGroups` til å ta hensyn til gruppeledere.
- Lås-funksjonalitet (som i det beslektede GroupEditor-designet).
- Reordering av elever innad i en gruppe (kun flytting mellom grupper).
- Endringer i `GroupEditor.jsx` (eget, allerede skrevet design — separat arbeid).

## Testing

Manuell test i appen:
- Legge til flere stasjoner kun med tastatur (tab til `+ Ny stasjon`, mellomrom, skriv
  navn, gjenta).
- Dra elever mellom grupper, verifisere highlight og korrekt plassering etter slipp.
- Sette/bytte leder i en gruppe, flytte lederen til en annen gruppe og verifisere at
  leder-status nullstilles.
- Lagre økten, laste den på nytt (F5/naviger bort og tilbake) og verifisere at
  gruppeplassering og lederstatus overlever reload.
- Åpne en eksisterende (før-migrering) stasjonsøkt og verifisere at den laster uten feil
  (manglende `group_leaders`-felt håndteres med fallback).
- Starte en økt i `StationPresenter` og verifisere at lederstjernen vises riktig gjennom
  rotasjonene.
