import React from 'react';

const MM_TO_PX = 3.7795;
const PAGE_MM = { width: 297, height: 210 };
const MARGIN_MM = 10;
const HEADER_MM = 18;
const FOOTER_MM = 10;

export function getPrintableAreaPx() {
  const width = (PAGE_MM.width - MARGIN_MM * 2) * MM_TO_PX;
  const height = (PAGE_MM.height - MARGIN_MM * 2 - HEADER_MM - FOOTER_MM) * MM_TO_PX;
  return { width, height };
}

/**
 * Skalerer ned (aldri opp) slik at contentW×contentH får plass i printbart areal.
 */
export function computePrintScale(contentWidthPx, contentHeightPx) {
  const area = getPrintableAreaPx();
  return Math.min(1, area.width / contentWidthPx, area.height / contentHeightPx);
}

export function getPageSizePx() {
  return { width: PAGE_MM.width * MM_TO_PX, height: PAGE_MM.height * MM_TO_PX };
}

export default function PrintPage({ title, periodText, contentWidthPx, contentHeightPx, children }) {
  const scale = computePrintScale(contentWidthPx, contentHeightPx);
  return (
    <div className="print-page">
      <div className="print-page-header">
        <div className="print-chart-name">{title || 'Klassekart'}</div>
        {periodText && <div className="print-meta">{periodText}</div>}
      </div>
      <div
        className="print-page-content"
        style={{ width: contentWidthPx, height: contentHeightPx, zoom: scale }}
      >
        {children}
      </div>
      <div className="print-page-footer">
        <span className="print-logo">
          <span style={{ color: '#111' }}>Klasse</span><span style={{ color: '#f59e0b' }}>Plass</span>
        </span>
      </div>
    </div>
  );
}
