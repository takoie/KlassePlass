/**
 * Metadata for elev-regel-typene: kategori (for to-stegs valg i modalen),
 * ikon/farge (for kompakte merker i oversikten) og hvor mange elever
 * regelen gjelder for. `type`-verdiene er de samme som er lagret i
 * klassens `rules`-blob siden før denne omarbeidingen - IKKE endre dem,
 * kun visnings-metadata her.
 */

export const RULE_CATEGORIES = [
  { id: 'social', label: 'Sosialt', icon: 'fa-solid fa-people-arrows' },
  { id: 'placement', label: 'Plassering i rommet', icon: 'fa-solid fa-chair' },
];

// extra: 'none' = gjelder kun eleven selv, 'one' = nøyaktig én ekstra elev,
// 'multi' = 1 til 4 ekstra elever (2 til 5 totalt).
export const RULE_TYPES = [
  { type: 'avoid', category: 'social', label: 'Skal IKKE sitte sammen', hint: '2 til 5 elever', icon: 'fa-solid fa-shield-halved', tone: 'text-error', extra: 'multi' },
  { type: 'pair', category: 'social', label: 'God makkermatch', hint: '2 elever', icon: 'fa-solid fa-heart', tone: 'text-success', extra: 'one' },
  { type: 'supportPair', category: 'social', label: 'Faglig støttemakker', hint: '2 elever', icon: 'fa-solid fa-graduation-cap', tone: 'text-indigo-400', extra: 'one' },
  { type: 'nearBoard', category: 'placement', label: 'Må sitte nær tavlen', hint: 'fremste rad', icon: 'fa-solid fa-location-dot', tone: 'text-amber-400', extra: 'none' },
  { type: 'sitBack', category: 'placement', label: 'Må sitte bakerst', hint: 'bakre rad', icon: 'fa-solid fa-arrow-down', tone: 'text-purple-400', extra: 'none' },
  { type: 'sitMiddle', category: 'placement', label: 'Må sitte i midten', hint: 'midterste rad', icon: 'fa-solid fa-align-center', tone: 'text-cyan-400', extra: 'none' },
  { type: 'awayDoor', category: 'placement', label: 'Skjermet for dør-støy', hint: 'unngå dør', icon: 'fa-solid fa-door-open', tone: 'text-blue-400', extra: 'none' },
  { type: 'awayWindow', category: 'placement', label: 'Skjermet fra vindu', hint: 'unngå vindu', icon: 'fa-solid fa-sun', tone: 'text-yellow-400', extra: 'none' },
];

export function findRuleType(type) {
  return RULE_TYPES.find((r) => r.type === type);
}

export const PRIORITY_META = {
  critical: { label: 'Kritisk', dot: 'bg-error', badge: 'badge-error' },
  important: { label: 'Viktig', dot: 'bg-warning', badge: 'badge-warning' },
  wish: { label: 'Ønske', dot: 'bg-success', badge: 'badge-success' },
};
