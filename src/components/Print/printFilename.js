/**
 * Bygger et sanert PDF-filnavn etter formatet:
 * Klassekart - klasse - navn på klassekart - ukeintervall.pdf
 */
export function buildPrintFilename({ className, chartName, chartComment, prefix = 'Klassekart' }) {
  const parts = [
    prefix,
    className,
    chartName,
    chartComment,
  ]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);

  const base = parts.length > 0 ? parts.join(' - ') : prefix;
  const sanitized = base
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return `${sanitized}.pdf`;
}
