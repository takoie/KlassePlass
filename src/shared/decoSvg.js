/**
 * decoSvg.js — Inline SVG-symboler for dekorasjonselementer (arkitektplanstil).
 * Brukes av romdesigneren og av seating-editor / presentasjon for å vise dekorasjoner.
 */

/**
 * Returnerer inline SVG-streng for en dekorasjonstype.
 * viewBox="0 0 100 100" + preserveAspectRatio="none" skalerer med div-størrelsen.
 * @param {string} type
 * @returns {string} SVG HTML-streng, eller '' for ukjente typer
 */
export function buildDecoSVG(type) {
  switch (type) {
    case 'wall':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="0" y="0" width="100" height="100" fill="#4b5563"/>
        <line x1="0" y1="50" x2="100" y2="50" stroke="#9ca3af" stroke-width="2" stroke-dasharray="8,6" vector-effect="non-scaling-stroke"/>
      </svg>`;

    case 'cabinet':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="1" y="1" width="98" height="98" fill="rgba(120,53,15,0.2)" stroke="#b45309" stroke-width="2" vector-effect="non-scaling-stroke"/>
        <line x1="0" y1="0" x2="100" y2="100" stroke="#b45309" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line x1="100" y1="0" x2="0" y2="100" stroke="#b45309" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
      </svg>`;

    case 'window':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="0" y="0" width="100" height="100" fill="rgba(186,230,253,0.15)" stroke="#38bdf8" stroke-width="3" vector-effect="non-scaling-stroke"/>
        <line x1="0" y1="30" x2="100" y2="30" stroke="#7dd3fc" stroke-width="2" vector-effect="non-scaling-stroke"/>
        <line x1="0" y1="70" x2="100" y2="70" stroke="#7dd3fc" stroke-width="2" vector-effect="non-scaling-stroke"/>
        <line x1="20" y1="30" x2="20" y2="70" stroke="#7dd3fc" stroke-width="1" vector-effect="non-scaling-stroke"/>
        <line x1="40" y1="30" x2="40" y2="70" stroke="#7dd3fc" stroke-width="1" vector-effect="non-scaling-stroke"/>
        <line x1="60" y1="30" x2="60" y2="70" stroke="#7dd3fc" stroke-width="1" vector-effect="non-scaling-stroke"/>
        <line x1="80" y1="30" x2="80" y2="70" stroke="#7dd3fc" stroke-width="1" vector-effect="non-scaling-stroke"/>
      </svg>`;

    case 'door':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="0" y="0" width="8" height="100" fill="#16a34a" rx="1"/>
        <line x1="8" y1="100" x2="100" y2="100" stroke="#16a34a" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/>
        <path d="M 8 0 A 97 97 0 0 1 100 100" stroke="#16a34a" stroke-width="1.5" fill="rgba(34,197,94,0.10)" stroke-dasharray="4,3" vector-effect="non-scaling-stroke"/>
      </svg>`;

    case 'screen':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="2" y="5" width="96" height="70" fill="rgba(99,102,241,0.15)" stroke="#6366f1" stroke-width="3" rx="4" vector-effect="non-scaling-stroke"/>
        <rect x="8" y="11" width="84" height="58" fill="rgba(99,102,241,0.1)" stroke="#6366f1" stroke-width="1" rx="2" vector-effect="non-scaling-stroke"/>
        <line x1="50" y1="75" x2="50" y2="92" stroke="#6366f1" stroke-width="3" vector-effect="non-scaling-stroke"/>
        <line x1="30" y1="92" x2="70" y2="92" stroke="#6366f1" stroke-width="3" vector-effect="non-scaling-stroke"/>
        <text x="50" y="46" text-anchor="middle" font-size="20" fill="#6366f1" opacity="0.6" font-family="sans-serif">▶</text>
      </svg>`;

    case 'bookshelf':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="1" y="1" width="98" height="98" fill="rgba(120,53,15,0.12)" stroke="#92400e" stroke-width="2.5" rx="2" vector-effect="non-scaling-stroke"/>
        <line x1="1" y1="34" x2="99" y2="34" stroke="#92400e" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line x1="1" y1="67" x2="99" y2="67" stroke="#92400e" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line x1="18" y1="1"  x2="18" y2="34" stroke="#92400e" stroke-width="1" opacity="0.5" vector-effect="non-scaling-stroke"/>
        <line x1="35" y1="1"  x2="35" y2="34" stroke="#92400e" stroke-width="1" opacity="0.5" vector-effect="non-scaling-stroke"/>
        <line x1="55" y1="1"  x2="55" y2="34" stroke="#92400e" stroke-width="1" opacity="0.5" vector-effect="non-scaling-stroke"/>
        <line x1="75" y1="1"  x2="75" y2="34" stroke="#92400e" stroke-width="1" opacity="0.5" vector-effect="non-scaling-stroke"/>
        <line x1="22" y1="34" x2="22" y2="67" stroke="#92400e" stroke-width="1" opacity="0.5" vector-effect="non-scaling-stroke"/>
        <line x1="48" y1="34" x2="48" y2="67" stroke="#92400e" stroke-width="1" opacity="0.5" vector-effect="non-scaling-stroke"/>
        <line x1="70" y1="34" x2="70" y2="67" stroke="#92400e" stroke-width="1" opacity="0.5" vector-effect="non-scaling-stroke"/>
        <line x1="30" y1="67" x2="30" y2="99" stroke="#92400e" stroke-width="1" opacity="0.5" vector-effect="non-scaling-stroke"/>
        <line x1="60" y1="67" x2="60" y2="99" stroke="#92400e" stroke-width="1" opacity="0.5" vector-effect="non-scaling-stroke"/>
      </svg>`;

    case 'sink':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="2" y="2" width="96" height="96" fill="rgba(14,165,233,0.1)" stroke="#0ea5e9" stroke-width="2.5" rx="4" vector-effect="non-scaling-stroke"/>
        <ellipse cx="50" cy="58" rx="35" ry="28" fill="rgba(14,165,233,0.12)" stroke="#0ea5e9" stroke-width="2" vector-effect="non-scaling-stroke"/>
        <line x1="50" y1="10" x2="50" y2="30" stroke="#0ea5e9" stroke-width="3" vector-effect="non-scaling-stroke"/>
        <line x1="35" y1="20" x2="65" y2="20" stroke="#0ea5e9" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
        <circle cx="50" cy="58" r="5" fill="#0ea5e9" opacity="0.5"/>
      </svg>`;

    case 'trashcan':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M 20 30 L 26 90 L 74 90 L 80 30 Z" fill="rgba(107,114,128,0.2)" stroke="#6b7280" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        <line x1="10" y1="30" x2="90" y2="30" stroke="#6b7280" stroke-width="3" vector-effect="non-scaling-stroke"/>
        <line x1="38" y1="16" x2="62" y2="16" stroke="#6b7280" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <line x1="40" y1="16" x2="38" y2="30" stroke="#6b7280" stroke-width="2" vector-effect="non-scaling-stroke"/>
        <line x1="60" y1="16" x2="62" y2="30" stroke="#6b7280" stroke-width="2" vector-effect="non-scaling-stroke"/>
        <line x1="40" y1="45" x2="38" y2="80" stroke="#6b7280" stroke-width="1.5" opacity="0.6" vector-effect="non-scaling-stroke"/>
        <line x1="50" y1="45" x2="50" y2="80" stroke="#6b7280" stroke-width="1.5" opacity="0.6" vector-effect="non-scaling-stroke"/>
        <line x1="60" y1="45" x2="62" y2="80" stroke="#6b7280" stroke-width="1.5" opacity="0.6" vector-effect="non-scaling-stroke"/>
      </svg>`;

    case 'whiteboard':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="0" y="0" width="100" height="100" fill="rgba(99,102,241,0.10)" stroke="#6366f1" stroke-width="3" vector-effect="non-scaling-stroke" rx="2"/>
        <rect x="0" y="85" width="100" height="15" fill="rgba(99,102,241,0.18)" stroke="none" vector-effect="non-scaling-stroke"/>
        <line x1="0" y1="85" x2="100" y2="85" stroke="#6366f1" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
        <circle cx="12" cy="92" r="4" fill="#6366f1" opacity="0.5" vector-effect="non-scaling-stroke"/>
        <circle cx="88" cy="92" r="4" fill="#6366f1" opacity="0.5" vector-effect="non-scaling-stroke"/>
      </svg><span class="deco-whiteboard-label">TAVLE</span>`;

    default:
      return '';
  }
}
