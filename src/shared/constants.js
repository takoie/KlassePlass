/**
 * Delte konstanter — DESK_TYPES, canvas-dimensjoner, farger.
 */

export const CANVAS_W = 920;
export const SNAP = 15;

export const DESK_TYPES = {
  single: { width: 85,  height: 55,  capacity: 1, label: 'Enkeltbord' },
  bench2: { width: 170, height: 55,  capacity: 2, label: 'Benk (2)' },
  bench4: { width: 340, height: 55,  capacity: 4, label: 'Benk (4)' },
  round3: { width: 130, height: 130, capacity: 3, label: 'Rundbord (3)' },
  round4: { width: 145, height: 145, capacity: 4, label: 'Rundbord (4)' },
  round6: { width: 160, height: 160, capacity: 6, label: 'Rundbord (6)' },
};

export const DESK_COLORS = [
  'default', 'red', 'green', 'blue', 'yellow', 'purple', 'orange', 'pink',
];

/** CSS-klasse per farge */
export const DESK_COLOR_CLASS = {
  default: 'desk-color-default',
  red:     'desk-color-red',
  green:   'desk-color-green',
  blue:    'desk-color-blue',
  yellow:  'desk-color-yellow',
  purple:  'desk-color-purple',
  orange:  'desk-color-orange',
  pink:    'desk-color-pink',
};

export const DECORATION_TYPES = {
  wall:         { label: 'Vegg/Skillevegg',  icon: 'fa-minus',          resizable: true  },
  cabinet:      { label: 'Skap',             icon: 'fa-box',             resizable: true  },
  window:       { label: 'Vindu',            icon: 'fa-window-maximize', resizable: true  },
  door:         { label: 'Dør',              icon: 'fa-door-open',       resizable: false },

  whiteboard:   { label: 'Tavle',            icon: 'fa-chalkboard',      resizable: true  },
  screen:       { label: 'TV/Projektor',     icon: 'fa-display',         resizable: true  },
  bookshelf:    { label: 'Bokhylle',         icon: 'fa-book',            resizable: true  },
  sink:         { label: 'Vask',             icon: 'fa-sink',            resizable: false },
  trashcan:     { label: 'Søppelkasse',      icon: 'fa-trash',           resizable: false },
  label:        { label: 'Tekst-label',      icon: 'fa-font',            resizable: false },
};
