// Ren angre/gjør-om-logikk for ett klassekarts oppsett (uavhengig av React).
//
// Et "oppsett" (arrangement) er de fire kartene som autolagres per periode:
//   { placements, lockedSeats, unusedSeats, groupOverrides }
// Alle verdiene er primitiver (elev-id-streng, true/false, gruppe-nummer), så
// grunn sammenligning holder.

export const MAX_HISTORY = 100;

const ARRANGEMENT_KEYS = ['placements', 'lockedSeats', 'unusedSeats', 'groupOverrides'];

function sameMap(a = {}, b = {}) {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every((k) => a[k] === b[k]);
}

// Sant når to oppsett er like – nøkkelrekkefølge spiller ingen rolle.
export function sameArrangement(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return ARRANGEMENT_KEYS.every((k) => sameMap(a[k], b[k]));
}

// { past, present, future, open, applySeq }
//  - past/future: stakker med oppsett-øyeblikksbilder
//  - present: gjeldende oppsett i loggen
//  - open: øyeblikksbildet fra da perioden ble åpnet
//  - applySeq: teller som KUN økes av undo/redo/restore, slik at React-laget
//    vet når det skal speile `present` tilbake til editoren (ikke ved record/reset)
export const initHistory = (snapshot) => ({
  past: [],
  present: snapshot,
  future: [],
  open: snapshot,
  applySeq: 0,
});

export function historyReducer(state, action) {
  switch (action.type) {
    // Ny periode åpnet: nullstill loggen, nytt åpningspunkt. applySeq bevares
    // (monotont) så speil-effekten ikke misfyrer på en gjenbrukt verdi.
    case 'RESET':
      return {
        past: [],
        present: action.snapshot,
        future: [],
        open: action.snapshot,
        applySeq: state.applySeq,
      };

    // En ekte endring i oppsettet. Ekko fra vår egen "apply" fanges av
    // likhetssjekken og blir en no-op.
    case 'RECORD':
      if (sameArrangement(state.present, action.snapshot)) return state;
      return {
        ...state,
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        present: action.snapshot,
        future: [],
      };

    case 'UNDO':
      if (state.past.length === 0) return state;
      return {
        ...state,
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
        applySeq: state.applySeq + 1,
      };

    case 'REDO':
      if (state.future.length === 0) return state;
      return {
        ...state,
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
        applySeq: state.applySeq + 1,
      };

    // Hopp helt tilbake til slik oppsettet var da perioden ble åpnet.
    case 'RESTORE_OPEN':
      if (sameArrangement(state.present, state.open)) return state;
      return {
        ...state,
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        present: state.open,
        future: [],
        applySeq: state.applySeq + 1,
      };

    default:
      return state;
  }
}
