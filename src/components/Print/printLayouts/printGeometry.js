// Ren geometri delt mellom klassekart-utskrift sin JSX-rendering
// (SeatingChartPrintContent.jsx) og PDF-eksport-nyttelasten
// (buildSeatingChartPrintPayload.js). Ingen JSX/rendering-avhengigheter her
// med hensikt — begge forbrukerne trenger nøyaktig samme tavle/pult-mål og
// sentrerings-algoritme, og å holde dem som to separate kopier ville gjort
// det mulig for en fremtidig endring i den ene å stille utskrift og
// PDF-eksport i utakt uten at noe fanger det opp.

export const BOARD_W = 256;
export const BOARD_H = 36;
export const DESK_H = 60;
export const CONTENT_WIDTH_PX = 1100;
export const CONTENT_HEIGHT_PX = 700;

// Rommet i klasseromsbyggeren fyller ikke nødvendigvis hele det faste
// 1100×700-canvaset (f.eks. et smalt eller lite rom) — uten dette havner
// pultene der de en gang ble plassert på canvaset, som ofte er forskjøvet
// fra midten av papirarket. Vi regner derfor ut den faktiske bounding-boksen
// til tavle+pulter og sentrerer DEN i print-arealet, slik at utskriften alltid
// er sentrert uten at læreren må justere zoom/pan manuelt.
export function computeCenteringOffset(boardObj, desks) {
  const rects = [
    { x: boardObj.x, y: boardObj.y, w: BOARD_W, h: BOARD_H },
    ...desks.map((d) => ({ x: d.x, y: d.y, w: (d.capacity || 1) * 100, h: DESK_H })),
  ];
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return {
    x: (CONTENT_WIDTH_PX - (maxX - minX)) / 2 - minX,
    y: (CONTENT_HEIGHT_PX - (maxY - minY)) / 2 - minY,
  };
}
