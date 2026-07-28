# Klassekart: flere Fun modes + fungerende regelmotor

## Bakgrunn

`SeatingChart.jsx` har i dag kun én animert "fun"-funksjon i Fun mode-skuffen:
Gradvis avdekking (`startReveal`/`revealNext`/`revealAll`/`endReveal`). "Randomiser"
(`handleRuleBasedFunSpin`) er en egen, ikke-animert knapp utenfor skuffen som forsøker
å ta hensyn til elevregler via `evaluatePlacementScore`.

Under research ble det oppdaget at `evaluatePlacementScore` sjekker en regeltype
(`rule.type === 'separate'`, felter `rule.student1`/`rule.student2`) som ikke finnes i
den faktiske datamodellen. Reglene som faktisk lagres (`ClassManager.jsx`) har formen
`{ id, type, priority, studentIds: [...] }`, med `type` én av: `avoid`, `pair`,
`nearBoard`, `sitBack`, `sitMiddle`, `awayDoor`, `awayWindow`, `supportPair`, og
`priority` én av: `critical`, `important`, `wish`. Konsekvens: **ingen regel blir i dag
faktisk håndhevet** av Randomiser — funksjonen er dødt reparasjonsarbeid fra en tidligere
datamodell.

Bruker ønsker to nye fun modes (Roulette, Randombomb) som skal ta hensyn til reglene, samt
tre ekstra foreslåtte moduser (Musikkstoler, Makkerbytte, Trekk en elev/Spotlight) — alle
godkjent for bygging i denne runden.

## Mål

1. Fiks regelmotoren slik at den faktisk evaluerer opp mot dagens regelmodell.
2. Bygg fem nye fun modes: Roulette, Randombomb, Musikkstoler, Makkerbytte, Trekk en elev.
3. Gjør "Plasser alle" regel-bevisst (bruker samme motor).
4. Behold eksisterende oppførsel for låste seter (`lockedSeats`) og kronologisk
   pult-fylling (fra forrige fiks av "ingen elev alene ved et bord") i alle nye moduser.

## 1. Delt regelmotor (`findBestPlacement`)

Erstatt `evaluatePlacementScore` med en ny, gjenbrukbar `scoreClassPlacement(candidatePlacements, classRules, desks)`:

- Startpoeng 100, trekk fra for hvert regelbrudd.
- Straff skalert etter `priority`: `critical` -500, `important` -150, `wish` -30.
- Evaluering per `rule.type` (bruker `rule.studentIds`, finner faktisk sete via
  `Object.keys(candidatePlacements).find(...)`, deretter tilhørende `desk` via
  `slotKey.split('_seat_')[0]` og `desks.find(d => d.id === deskId)`):
  - `avoid`: brudd hvis to eller flere av `studentIds` deler samme pult.
  - `pair` / `supportPair`: brudd hvis de (nøyaktig 2) `studentIds` IKKE deler samme pult
    (når begge er plassert — uplasserte teller ikke som brudd).
  - `nearBoard`: brudd hvis noen av `studentIds` sitter ved en pult uten `front`-sone.
  - `sitBack`: brudd hvis pult mangler `back`-sone.
  - `sitMiddle`: brudd hvis pult IKKE har `center`-sone (soner er `window`/`door`/
    `front`/`back`/`center`, tagges i `RoomEditor.jsx` — bekreftet at `center` finnes
    som egen sone, ikke utledet fra fravær av front/back).
  - `awayDoor`: brudd hvis pult har `door`-sone.
  - `awayWindow`: brudd hvis pult har `window`-sone.

Ny delt hjelpefunksjon `findBestPlacement(seatSlots, students, currentPlacements, classRules, desks, attempts = 35)`:
kjører samme "prøv N tilfeldige varianter, behold høyest score"-mønster som i dag,
returnerer beste `placements`-objekt. Brukes av: Randomiser (erstatter dagens logikk
1:1), Plasser alle (ny — se pkt. 2), og som "beregn sluttresultat"-steg i Roulette,
Randombomb, Musikkstoler og Makkerbytte.

`sortSlotsByDeskOrder` (allerede innført i forrige endring) brukes fortsatt til å velge
*hvilke* seter som er i spill (kronologisk fra tavlen, ingen isolerte elever), før
`findBestPlacement` avgjør *hvem* som sitter hvor blant de valgte setene.

## 2. "Plasser alle" blir regel-bevisst

`handleAutoFill` beholder dagens logikk for å velge de første N ledige setene
kronologisk (unngår isolasjon), men i stedet for å shuffle elevene tilfeldig blant disse
N setene, kalles `findBestPlacement` med kun de valgte setene og de uplasserte/flyttbare
elevene. Randomiser (`handleRuleBasedFunSpin`) forenkles til et tynt kall inn i samme
hjelpefunksjon.

## 3. Delt animasjonsinfrastruktur

Ny state i `SeatingChart.jsx`:

- `activeFunMode`: `null | 'roulette' | 'randombomb' | 'musikkstoler' | 'makkerbytte' | 'spotlight'`
  — styrer hvilken knapp/overlay som vises som "i gang", og hindrer at flere fun modes
  kjører samtidig.
- Modus-spesifikk transient state (ryddes ved cancel/unmount via `useEffect`-cleanup og
  en `useRef` med aktive timer-IDer):
  - Roulette: `rouletteGhost` (`{ slotKey, studentId } | null`) — vises oppå ordinær
    plassering, skriver ALDRI til `placements` før studenten er "landet".
  - Randombomb: `bombCountdown` (`5..1 | null`), `bombPreBomb` (snapshot av
    `placements` før start, for cancel).
  - Spotlight: `spotlightSlotKey` (`string | null`), forblir satt til neste trekning.
- Alle animasjoner drives av `setTimeout`-kjeder (ikke `setInterval`, for å kunne variere
  hastighet mellom steg — f.eks. Roulette bremser ned mot slutten). Hvert steg planlegger
  neste via en id lagret i en ref, som ryddes i en avbryt-funksjon delt av alle modiene:
  `cancelActiveFunMode()`.
- Ved cancel: Roulette/Musikkstoler/Makkerbytte hopper rett til det ferdig beregnede
  sluttresultatet (siden det uansett er beregnet på forhånd). Randombomb ved cancel
  gjenoppretter `bombPreBomb` (avbryter helt, ingen ny plassering).
- Alle modiene respekterer `lockedSeats` (samme filter som i dag i `handleAutoFill`/
  `handleRuleBasedFunSpin`).

## 4. Roulette

- Trigger: "Start roulette". Beregner sluttresultat med `findBestPlacement` over ALLE
  elever og alle ikke-låste seter (full re-plassering av klassen, som Randombomb).
- Rekkefølge: elevene avsløres i tilfeldig rekkefølge, én om gangen.
- Per elev: `rouletteGhost` hopper gjennom ~6 tilfeldige ledige seter (seter som verken er
  låst, allerede "landet" av en tidligere elev i denne kjøringen, eller studentens eget
  endelige sete) med økende intervall (rundt 90ms → 250ms, for et naturlig
  oppbrems-følelse), før ghost fjernes og `placements` oppdateres permanent med studentens
  reelle sete.
- Kjører automatisk til alle elever er landet. "Stopp"-knapp avslutter momentant til
  fullt sluttresultat.
- Rendring: der `placements` rendres i dag (rundt linje ~1160-1220), sjekk om
  `rouletteGhost?.slotKey === slotKey` og vis i så fall `rouletteGhost.studentId` sitt
  navn med egen pulserende stil, uavhengig av hva som faktisk står i `placements` for det
  setet.

## 5. Randombomb

- Trigger: "Start randombomb". Beregner sluttresultat med `findBestPlacement` (full
  klasse, som over) FØR nedtellingen starter, og lagrer `bombPreBomb = placements` for
  ev. cancel.
- Stor sentrert nedtellings-overlay over klasseromscanvaset (gjenbruker
  prosjektor-lignende overlay-styling), viser tallet 5→1.
- For hvert tikk 5, 4, 3, 2: generer en RAS ren tilfeldig full-klasse-plassering (ingen
  regelsjekk — kun visuelt "kaos" for spenning) og sett `placements` til denne
  midlertidig.
- Tikk 1 → kort "boom"-blits (skjerm-puls/emerald flash + evt. konfetti-ish tekst), deretter
  settes `placements` til det forhåndsberegnede, regel-riktige resultatet, og overlay
  fades ut.
- Avbryt-knapp under nedtelling: gjenoppretter `bombPreBomb` og lukker overlay umiddelbart.

## 6. Musikkstoler

- Randombombs lillesøster: ingen tallnedtelling. "Start musikkstoler" beregner
  sluttresultat med `findBestPlacement` (full klasse), gjør ~5 raske rene tilfeldige
  full-reshuffle-blink (~120ms mellomrom, ingen overlay/tall), lander så på det
  beregnede resultatet. Hele forløpet er under ~1 sekund. Ingen egen cancel nødvendig
  (for kort til å rekke å avbryte meningsfullt) — men samme opprydding ved navigasjon
  bort/unmount som de andre.

## 7. Makkerbytte

- Virker kun på delmengden av seter som tilhører pulter med aktiv gruppefarge
  (`groupOverrides[d.id] || d.groupId` er satt). Pulter uten gruppe, og elevene som
  sitter der, røres ikke.
- Bygger `seatSlots` filtrert til kun disse pultene, sorterer kronologisk
  (`sortSlotsByDeskOrder`) for å unngå isolasjon også innad i grupper, samler elevene
  som pr. i dag sitter i disse setene (pluss uplasserte, hvis det er ledig plass i
  gruppene) som kandidatpool, og kaller `findBestPlacement` begrenset til denne
  delmengden.
- Animasjon: samme raske "blink"-stil som Musikkstoler, men kun de berørte
  pultene/setene visualiseres som "i spill" (resten av klasserommet er visuelt uendret,
  ingen tvil om at det er en delvis operasjon).

## 8. Trekk en elev (Spotlight)

- Ren "hvem skal svare"-trekning, ENDRER ALDRI `placements`. Kandidater: elever som er
  plassert i et ikke-tomt sete akkurat nå (uansett låst/ulåst).
- "Trekk elev"-knapp: en highlight hopper raskt (samme ~90ms→250ms oppbrems-mønster som
  Roulette) gjennom flere tilfeldige okkuperte seter, lander til slutt på ett tilfeldig
  valgt sete/elev.
- Det valgte setet får en vedvarende gyllen glød (egen visuell stil, ikke i konflikt med
  historikk-/gruppe-farger) til neste trekning eller til modusen lukkes.
- Ingen "husk forrige trukne" i denne runden — hver trekning er uavhengig (kan utvides
  senere med en `alreadyPickedIds`-set og en "alle trukket, nullstill"-knapp, men holdes
  utenfor scope nå).

## 9. UI i Fun mode-skuffen

Skuffen (`Toolbar.jsx`, `showFunDrawer`-seksjonen) bygges om fra én enkelt boks (Gradvis
avdekking) til seks stablede "modus-kort", hver med egen liten header, ikon og
Start/Stopp-knapp(er) i samme visuelle stil som dagens avdekking-kort:

1. Gradvis avdekking (uendret)
2. Roulette
3. Randombomb
4. Musikkstoler
5. Makkerbytte
6. Trekk en elev (Spotlight)

Kun ett kort kan være aktivt om gangen (styrt av `activeFunMode`) — de andre knappene
disables mens én modus kjører, for å unngå at flere animasjoner skriver til
`placements`/samme transiente state samtidig.

"Randomiser" (den eksisterende, ikke-animerte knappen utenfor Fun mode-skuffen) forblir
der den er, kun med regelmotor-fiksen under panseret.

## Ikke i scope

- "Husk forrige trukket elev" / no-repeat-logikk i Spotlight.
- Justerbar animasjonshastighet fra UI (hastigheter er faste konstanter i koden).
- Endringer i regel-redigeringen i `ClassManager.jsx` (kun `SeatingChart.jsx` sin bruk av
  eksisterende regeldata endres).
- Lyd-effekter (kun visuelle blitzer/glød).

## Testing

Manuell test i appen (Electron, siden dette er animasjoner/UI-timing som ikke fanges av
et build-steg):

- Sett opp minst én `avoid`-regel, én `pair`-regel og én sone-regel (`nearBoard`) på en
  klasse med et rom som har `front`/`door`/`window`-soner tagget. Kjør Randomiser flere
  ganger og verifiser at reglene stort sett overholdes (kritisk aldri brutt over mange
  kjøringer; wish/important kan i sjeldne tilfeller ikke oppfylles hvis umulig å
  tilfredsstille alle samtidig).
- Kjør Roulette på en full klasse, verifiser at alle elever til slutt lander i samme
  sluttresultat som om Randomiser hadde blitt trykket (samme regelrespekt), og at
  "Stopp" midtveis hopper rett til korrekt sluttilstand.
- Kjør Randombomb, verifiser nedtelling 5→1, at mellomstegene tydelig "flimrer" tilfeldig,
  og at sluttresultatet respekterer reglene. Test avbryt midtveis.
- Kjør Musikkstoler og verifiser kort, rask animasjon og regel-riktig sluttresultat.
- Sett opp 2-3 makkergrupper (fargede pulter), kjør Makkerbytte, verifiser at KUN de
  fargede pultene endrer elever, resten av klasserommet er uberørt.
- Plasser noen elever, kjør Trekk en elev flere ganger, verifiser at kun plasserte elever
  kan trekkes, og at gløden flytter seg riktig ved ny trekning.
- Test alle modiene med låste seter til stede — verifiser at låste seter aldri endres.
- Test at kun én modus kan kjøre om gangen (knappene for de andre er disablet mens én
  animasjon pågår).
