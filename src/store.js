/**
 * Reaktiv state store — én sannhetskilde for hele renderer-prosessen.
 * Ingen duplikater, ingen syncState()-kall.
 */

const INITIAL_STATE = {
  currentView: 'charts-dashboard',
  currentChart: null,       // Chart-objekt under redigering
  currentRoom: null,        // Rom-objekt under redigering
  currentClass: null,       // Klasse-objekt under redigering
  settings: {
    theme: 'dark',          // 'dark' | 'light'
    defaultFlipDisplay: false,
    onboardingCompleted: false,
  },
  updateReady: null,        // { version } når auto-update er klar
};

const listeners = new Set();
let _state = { ...INITIAL_STATE };

export const store = {
  /** Returnerer en kopi av nåværende state */
  getState() {
    return { ..._state };
  },

  /** Slå sammen patch med eksisterende state og notify alle lyttere */
  setState(patch) {
    _state = { ..._state, ...patch };
    listeners.forEach(fn => fn(_state));
  },

  /** Subscribe til state-endringer. Returnerer unsubscribe-funksjon */
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Subscribe på én spesifikk nøkkel — kaller bare fn når den nøkkelen endres */
  on(key, fn) {
    let prev = _state[key];
    return this.subscribe((state) => {
      if (state[key] !== prev) {
        prev = state[key];
        fn(state[key], state);
      }
    });
  },
};
