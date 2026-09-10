// Én kilde til sannhet for hvordan et bord tegnes når «Skjul denne plassen»
// (unusedSeats) er brukt: hvilke seteindekser som faktisk vises, i hvilken
// rekkefølge, og hvor bredt bordet blir på lerretet.
//
// Både bord-renderingen i SeatingChart.jsx OG treff-testen i
// useStudentDragAndDrop.js MÅ bruke denne – ellers havner slippmålene et annet
// sted enn setene faktisk tegnes (elever på plass 3-4 vises kollapset til
// venstre, men draget traff fortsatt de gamle koordinatene lengst til høyre).

export const SEAT_W = 100;
// Bredden på «hele bordet skjult»-brikken (jf. style={{ width: '54px' }} i render).
export const COLLAPSED_DESK_W = 54;

// desk: { id, capacity }. placements/unusedSeats: slotKey -> verdi.
export function getDeskLayout(desk, placements = {}, unusedSeats = {}) {
  const cap = desk.capacity || 1;
  const allSlots = Array.from({ length: cap }, (_, i) => i);
  const key = (i) => `${desk.id}_seat_${i}`;
  // En plass er «håndskjult» kun når den er merket ubrukt OG tom.
  const isHiddenEmpty = (i) => !!unusedSeats[key(i)] && !placements[key(i)];

  const hasStudents = allSlots.some((i) => placements[key(i)]);
  const visibleSlots = allSlots.filter((i) => !isHiddenEmpty(i));
  const hiddenSlotCount = cap - visibleSlots.length;

  // Alle ledige plasser skjult + ingen elever => hele bordet krymper til en
  // liten brikke med et øye-ikon (ingen seter tegnes, ikke et slippmål).
  const collapsedWhole = hiddenSlotCount > 0 && visibleSlots.length === 0 && !hasStudents;
  // Noen plasser skjult, men minst én synlig => bordet trekkes sammen rundt
  // de synlige plassene, som pakkes fra venstre.
  const collapseUnused = visibleSlots.length > 0 && hiddenSlotCount > 0;

  const renderSlots = collapseUnused ? visibleSlots : allSlots;
  const width = collapsedWhole ? COLLAPSED_DESK_W : renderSlots.length * SEAT_W;

  return {
    cap, allSlots, visibleSlots, hiddenSlotCount, hasStudents,
    collapsedWhole, collapseUnused, renderSlots, width,
  };
}

// Peker-X i lerret-koordinater -> den FAKTISKE seteindeksen under pekeren
// (tar høyde for at synlige seter er pakket sammen fra venstre). null når
// bordet er helt kollapset og ikke har noe sete å treffe.
export function slotIndexAtPointerX(layout, deskX, cx) {
  if (layout.collapsedWhole || layout.renderSlots.length === 0) return null;
  const visualIdx = Math.min(
    layout.renderSlots.length - 1,
    Math.max(0, Math.floor((cx - deskX) / SEAT_W)),
  );
  return layout.renderSlots[visualIdx];
}

/**
 * Sete-nummerering sett fra lærerens side (teller fra tavla og utover). Numrene
 * følger seteplasser, ikke bord: et 2-seters bord bruker to numre, så neste bord
 * fortsetter fra riktig setenummer. Delt mellom klassekart-renderingen og
 * romeditoren.
 *
 * @param {Array<{id: string, x: number, y: number, capacity?: number}>} desks
 * @param {{y?: number}} boardObj
 * @param {{ placements?: object|null, unusedSeats?: object|null, hideEmptyDesks?: boolean }} [opts]
 *   Kun klassekartet sender disse: ubrukte seter, og helt tomme bord når "Skjul
 *   tomme bord" er på, hopper HELT over tellingen så resten forblir 1,2,3...
 *   Romeditoren kaller uten opts og teller da alle seter fortløpende.
 * @returns {{ sortedDesks: Array, deskNumberMap: Object<string, Array<number|undefined>> }}
 */
export function computeDeskNumbering(desks, boardObj, opts = {}) {
  const { placements = null, unusedSeats = null, hideEmptyDesks = false } = opts;
  const isBoardAtTop = (boardObj?.y || 25) < 350;

  const sortedDesks = [...desks].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (isBoardAtTop) {
      if (Math.abs(yDiff) > 35) return yDiff;
      return a.x - b.x;
    }
    // Tavla i bunnen: rad 1 er nederst, og bordene telles fra høyre mot venstre.
    if (Math.abs(yDiff) > 35) return -yDiff;
    return b.x - a.x;
  });

  const deskNumberMap = {};
  let seatCounter = 0;
  sortedDesks.forEach((d) => {
    const cap = d.capacity || 1;
    const nums = new Array(cap);
    const isFullyEmptyDesk = hideEmptyDesks && !!placements &&
      Array.from({ length: cap }, (_, s) => placements[`${d.id}_seat_${s}`]).every((v) => !v);
    // Tavla i bunnen => setene inni bordet telles også fra høyre mot venstre,
    // ellers får synlig venstre sete lavest nummer uansett hvilken side som er
    // nærmest tavla.
    for (let i = 0; i < cap; i++) {
      const slotIdx = isBoardAtTop ? i : (cap - 1 - i);
      if (isFullyEmptyDesk || (unusedSeats && unusedSeats[`${d.id}_seat_${slotIdx}`])) continue;
      seatCounter += 1;
      nums[slotIdx] = seatCounter;
    }
    deskNumberMap[d.id] = nums;
  });

  return { sortedDesks, deskNumberMap };
}
