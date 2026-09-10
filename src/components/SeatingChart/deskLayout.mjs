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
