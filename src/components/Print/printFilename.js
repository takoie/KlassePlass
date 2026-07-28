/**
 * Bygger et sanert PDF-filnavn: Klassekart_{klasse}_{kart}_{YYYY-MM-DD}.pdf
 */
function buildPrintFilename({ className, chartName, date = new Date() }) {
  const namePart = [className, chartName].filter(Boolean).join('_');
  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  const base = `Klassekart_${namePart || 'Uten_navn'}_${dateStr}`;
  const sanitized = base
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_');
  return `${sanitized}.pdf`;
}

module.exports = { buildPrintFilename };
