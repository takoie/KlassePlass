/**
 * Bygger et sanert PDF-filnavn: Klassekart_{klasse}_{kart}_{YYYY-MM-DD}.pdf
 */
export function buildPrintFilename({ className, chartName, date = new Date(), prefix = 'Klassekart' }) {
  const namePart = [className, chartName].filter(Boolean).join('_');
  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  const base = `${prefix}_${namePart || 'Uten_navn'}_${dateStr}`;
  const sanitized = base
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_');
  return `${sanitized}.pdf`;
}
