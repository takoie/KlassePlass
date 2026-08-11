// Bygger en flat, "ferdigtygd" JSON-nyttelast for Rust-native PDF-eksport av
// klassekart (Task 6.1). Speiler render-logikken i SeatingChartPrintContent.jsx
// linje for linje, men produserer DATA (posisjoner, hex-farger, tekststrenger)
// i stedet for JSX — all forretningslogikk (elevoppslag, gruppefarge-palett,
// sone-metadata) løses her i JS, slik at Rust-siden (src-tauri/src/pdf_export.rs)
// kan forbli ren geometri/tegne-kode uten domenekunnskap om elever/grupper/soner.
//
// OBS scope: dette dekker KUN contentType === 'seatingChart'. Stasjonsplan og
// gruppeinndeling (station/groupWork) har egne, betydelig mer komplekse
// layout- og pagineringsløp (StationPrintContent/GroupPrintContent) som ikke
// portes til Rust i denne fasen (6.1-6.3) — de fortsetter å fungere som i dag
// via window.print() (den native OS-utskriftsdialogen), helt uavhengig av
// denne nye PDF-eksport-veien. Se PrintPreviewModal.jsx sin handlePrint vs.
// handleExportPdf for skillet.

const BOARD_W = 256;
const BOARD_H = 36;
const DESK_H = 60;
const CONTENT_WIDTH_PX = 1100;
const CONTENT_HEIGHT_PX = 700;

const DEFAULT_DESK_BORDER = '#475569';
const DEFAULT_ZONE_COLOR = '#555';

// Identisk med computeCenteringOffset i SeatingChartPrintContent.jsx.
function computeCenteringOffset(boardObj, desks) {
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

/**
 * Bygger PrintPayload-formen for klassekart-PDF-eksport.
 * Tar de SAMME props som SeatingChartPrintContent mottar.
 */
export function buildSeatingChartPrintPayload({
  boardObj, desks, deskNumberMap, placements, getStudentByIdOrName,
  groupColors, zoneMeta, groupOverrides, settings, chartName, periodText,
}) {
  const { showNumbers, showZones, showGroups, showColors } = settings;
  const offset = computeCenteringOffset(boardObj, desks);

  const payloadDesks = desks.map((d) => {
    const cap = d.capacity || 1;
    const seatNumbers = deskNumberMap[d.id] || [];
    const gId = (groupOverrides && groupOverrides[d.id]) || d.groupId;
    const groupColor = (gId && showGroups) ? groupColors[(gId - 1) % groupColors.length] : null;
    const activeZones = showZones ? (d.zones || []) : [];

    const seats = Array.from({ length: cap }).map((_, slotIdx) => {
      const slotKey = `${d.id}_seat_${slotIdx}`;
      const studentVal = placements[slotKey];
      const studentObj = studentVal ? getStudentByIdOrName(studentVal) : null;
      const seatNumber = (showNumbers && seatNumbers[slotIdx] !== undefined) ? seatNumbers[slotIdx] : null;
      return {
        studentName: studentObj ? studentObj.name : null,
        seatNumber,
      };
    });

    const zoneChips = activeZones
      .map((zKey) => {
        const zm = zoneMeta[zKey];
        if (!zm) return null;
        const colorHex = (showColors && zm.printColor) ? zm.printColor : DEFAULT_ZONE_COLOR;
        return { label: zm.label, colorHex };
      })
      .filter(Boolean);

    return {
      x: d.x + offset.x,
      y: d.y + offset.y,
      capacity: cap,
      borderColorHex: (showColors && groupColor) ? groupColor : DEFAULT_DESK_BORDER,
      seats,
      zoneChips,
    };
  });

  return {
    board: { x: boardObj.x + offset.x, y: boardObj.y + offset.y },
    desks: payloadDesks,
    chartName: chartName || '',
    periodText: periodText || '',
  };
}

export default buildSeatingChartPrintPayload;
