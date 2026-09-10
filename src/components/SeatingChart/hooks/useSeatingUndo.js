import { useReducer, useRef, useEffect, useCallback } from 'react';
import { historyReducer, initHistory, sameArrangement } from '../seatingHistory.mjs';

// In-memory angre/gjør-om for det aktive klassekartets oppsett (elevplasseringer,
// låste seter, skjulte plasser, makkergruppe-farger). Lever så lenge editoren er
// åpen på samme periode; bytte periode nullstiller loggen (RESET) og tar et nytt
// åpningspunkt.
//
// Fanger endringer via ÉN sentral overvåker (250 ms debounce) i stedet for å
// instrumentere hver mutasjonskilde (dra-og-slipp, Plasser alle, Randomiser,
// Fun Modes, høyreklikk-menyer). Reducerens likhetssjekk gjør at vår egen
// "speiling" tilbake til editoren ikke blir nye angre-steg.

const RECORD_DEBOUNCE_MS = 250;
// Endringer som lander like etter at en periode ble åpnet er som regel bare
// oppsettet som "setter seg" (useSeatings rydder/deduperer plasseringer over et
// par renders). Innenfor dette vinduet re-baseline-r vi i stedet for å lage et
// angre-steg av mellomtilstanden.
const SETTLE_WINDOW_MS = 450;

const snapshotOf = (placements, lockedSeats, unusedSeats, groupOverrides) => ({
  placements: { ...placements },
  lockedSeats: { ...lockedSeats },
  unusedSeats: { ...unusedSeats },
  groupOverrides: { ...groupOverrides },
});

export function useSeatingUndo({
  selectedSeatingId,
  placements, setPlacements,
  lockedSeats, setLockedSeats,
  unusedSeats, setUnusedSeats,
  groupOverrides, setGroupOverrides,
  allStudents, setUnplacedStudents,
}) {
  const live = snapshotOf(placements, lockedSeats, unusedSeats, groupOverrides);
  const liveRef = useRef(live);
  liveRef.current = live;
  const allStudentsRef = useRef(allStudents);
  allStudentsRef.current = allStudents;

  const [hist, dispatch] = useReducer(historyReducer, live, initHistory);
  const keyRef = useRef(selectedSeatingId);
  const timerRef = useRef(null);
  const appliedSeqRef = useRef(0);
  const resetAtRef = useRef(0);

  // Ny periode åpnet -> tøm loggen og ta nytt åpningspunkt. Denne effekten er
  // definert FØR record-effekten, så keyRef er oppdatert når record-effekten
  // kjører samme runde.
  useEffect(() => {
    if (keyRef.current !== selectedSeatingId) {
      keyRef.current = selectedSeatingId;
      resetAtRef.current = Date.now();
      clearTimeout(timerRef.current);
      dispatch({ type: 'RESET', snapshot: liveRef.current });
    }
  }, [selectedSeatingId]);

  // Registrer endringer i oppsettet (debouncet, så en operasjon som utløser
  // flere setState-kall blir ETT angre-steg).
  useEffect(() => {
    if (keyRef.current !== selectedSeatingId) return; // RESET-runden – hopp over
    clearTimeout(timerRef.current);
    const snap = liveRef.current;
    timerRef.current = setTimeout(() => {
      const kind = Date.now() - resetAtRef.current < SETTLE_WINDOW_MS ? 'RESET' : 'RECORD';
      dispatch({ type: kind, snapshot: snap });
    }, RECORD_DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [placements, lockedSeats, unusedSeats, groupOverrides, selectedSeatingId]);

  // Speil reducerens `present` tilbake til editoren – KUN når endringen kom fra
  // undo/redo/restore (applySeq økte), ikke fra record/reset.
  useEffect(() => {
    if (hist.applySeq === appliedSeqRef.current) return;
    appliedSeqRef.current = hist.applySeq;

    const s = hist.present;
    setPlacements(s.placements);
    setLockedSeats(s.lockedSeats);
    setUnusedSeats(s.unusedSeats);
    setGroupOverrides(s.groupOverrides);

    // unplacedStudents utledes ikke automatisk fra placements noe sted, så den
    // må regnes på nytt her (samme regel som setupNewChart i useSeatings).
    const placed = new Set(Object.values(s.placements));
    setUnplacedStudents(allStudentsRef.current.filter((st) => !placed.has(st.id) && !placed.has(st.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hist.applySeq]);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const restoreToOpen = useCallback(() => dispatch({ type: 'RESTORE_OPEN' }), []);

  return {
    undo,
    redo,
    restoreToOpen,
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
    canRestoreToOpen: !sameArrangement(hist.present, hist.open),
    undoDepth: hist.past.length,
  };
}
