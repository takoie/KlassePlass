# Gruppeeditor: dra-og-slipp + høyreklikk-meny for leder/lås

## Bakgrunn

I `GroupEditor.jsx` flyttes elever mellom grupper i dag via en `<select>`-dropdown per
elevkort. Det finnes ingen måte å manuelt utpeke en gruppeleder etter at gruppene er
generert, og ingen måte å låse en elev slik at «Generer på nytt» lar den stå i fred —
selv om låse-parameteren (`lockedPlacements`) allerede finnes i `groupRandomizer.js`,
den er bare aldri koblet til fra UI.

## Mål

1. Erstatt dropdown med dra-og-slipp mellom gruppepaneler.
2. Høyreklikk-meny på et elevkort med:
   - Gjør til / fjern som gruppeleder (ett-leder-per-gruppe).
   - Lås / lås opp elev (hindrer flytting kun ved «Generer på nytt», ikke ved manuell dra-og-slipp).

## Datamodell

- Ny kolonne på `group_assignments`: `locked_ids TEXT DEFAULT '[]']` — schema-migrasjon
  v8 i `db/schema.js`, samme `try { db.run(ALTER TABLE ...) } catch(e){}`-mønster som
  v3/v6/v7. `CURRENT_VERSION` bumpes til 8.
- `save-group-assignment`-handleren i `src/ipc-handlers.js` utvides til å ta imot og
  lagre `lockedIds` (samme JSON-stringify-mønster som `leader_ids`). `get-group-assignment`
  gjør allerede `SELECT *`, så ingen endring der. `preload.js` trenger ingen endring —
  `saveGroupAssignment` videresender hele payload-objektet.
- `leaderIds` (eksisterende felt) gjenbrukes uendret for lederstatus.

## Regenerering med låste elever

`handleRegenerate` i `GroupEditor.jsx` bygger `lockedPlacements` fra `lockedIds` ved å
finne hver låst elevs nåværende gruppeindeks (skann `groups`), og sender denne til
`generateGroups(...)`. Algoritmen i `groupRandomizer.js` støtter allerede dette
parameteret uendret — kun kobling fra UI mangler.

## Dra-og-slipp

- `@dnd-kit/core` (eksisterende avhengighet, brukt i `RoomEditor.jsx`) gir `DndContext`,
  `useDraggable`, `useDroppable`, `DragOverlay`.
- Gruppe-gridet i `GroupEditor.jsx` wrappes i én `DndContext`. Hvert gruppepanel blir en
  droppable-sone (`useDroppable({ id: 'group-' + idx })`). Hvert elevkort blir draggable
  (`useDraggable({ id: studentId })`) — hele kortet er drahåndtak, `<select>` fjernes.
- `DragOverlay` viser et kort som følger pekeren under dra.
- Droppable-panelet får en visuell highlight (ring/border-farge) når et kort dras over
  det (`isOver`-flagget fra `useDroppable`).
- `onDragEnd`: finn kildegruppe for `active.id`, mål-gruppe fra `over.id`, kall eksisterende
  `moveStudent(studentId, fromIdx, toIdx)`.
- Låste elever er fortsatt fullt drabare manuelt — låsen påvirker kun algoritmen i
  «Generer på nytt», ikke manuell dra-og-slipp.

## Høyreklikk-meny

Ny komponent `src/components/GroupWork/StudentContextMenu.jsx`, modellert på det
eksisterende mønsteret i `src/components/SeatingChart/DeskContextMenu.jsx` (fast
posisjonert `div` ved `{x, y}`, usynlig backdrop som lukker menyen ved klikk utenfor).

`onContextMenu` på elevkortet setter `contextMenu = { x, y, studentId, groupIdx }` i
`GroupEditor.jsx`.

Menyvalg:
- **Gjør til gruppeleder** (vises hvis eleven ikke allerede er leder for gruppa): fjerner
  leder-status fra alle andre elever i *samme gruppe* (basert på `groups[groupIdx]`, ikke
  hele klassen), setter deretter `leaderIds` til å inkludere denne eleven.
- **Fjern som gruppeleder** (vises hvis eleven allerede er leder): fjerner eleven fra
  `leaderIds`.
- **Lås elev / Lås opp elev**: toggler `studentId` i `lockedIds`-state.

Begge handlinger setter `dirty = true`, samme mønster som eksisterende `moveStudent` —
persisteres først når brukeren trykker «Lagre».

## Visuelle indikatorer på elevkort

- Leder: eksisterende gul stjerne (`fa-star`) foran navnet — ingen endring.
- Låst: nytt lås-ikon (`fa-lock`) på kortet når `lockedIds.includes(sid)`.

## Sameksistens med eksisterende leder-mekanikk

`requireLeaders` + `leaderIds` satt i `CreateGroupModal.jsx` styrer automatisk spredning
av ledere (én tilfeldig per gruppe fra en kandidatpool) ved generering. Den nye
kontekstmeny-handlingen er en manuell, eksplisitt utpeking etter at gruppene er dannet.
De to lever side om side — å sette en leder manuelt låser den *ikke* automatisk; ønsker
brukeren at lederen skal bli stående ved neste «Generer på nytt», må eleven låses separat.

## Ikke i scope

- Endre antall grupper.
- Endre leder-kandidatvalget i opprettelsesmodalen (`CreateGroupModal.jsx`).
- Reordering av elever *innad* i en gruppe (kun flytting mellom grupper).
