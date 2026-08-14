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

import { computeCenteringOffset } from './printGeometry.js';
import { lightenHex } from '../../../shared/utils.js';

const DEFAULT_DESK_BORDER = '#475569';
const DEFAULT_ZONE_COLOR = '#555';

/**
 * Bygger PrintPayload-formen for klassekart-PDF-eksport.
 * Tar de SAMME props som SeatingChartPrintContent mottar.
 */
export function buildSeatingChartPrintPayload({
  boardObj, desks, deskNumberMap, placements, getStudentByIdOrName,
  groupColors, zoneMeta, groupOverrides, settings, chartName, periodText,
}) {
  const { showNumbers, showZones, showGroups, showColors, colorSeats } = settings;
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
      fillColorHex: (showColors && groupColor && colorSeats) ? lightenHex(groupColor, 0.65) : null,
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
