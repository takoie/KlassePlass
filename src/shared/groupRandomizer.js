/**
 * groupRandomizer.js — Fordeler elever i grupper.
 * Samme mønster som randomize.js. Ingen DOM-avhengigheter.
 */

const MAX_ITERATIONS = 200;

/**
 * Generer gruppeinndelinger.
 * @param {Object} opts
 * @param {string[]} opts.studentIds         — alle student-IDer som skal fordeles
 * @param {Object}   opts.studentsById       — { [id]: { id, name } }
 * @param {number}   opts.numGroups          — antall grupper
 * @param {Object[]} opts.constraints        — [{ studentA, studentB, type }] (navn-basert)
 * @param {boolean}  opts.useConstraints     — om constraints skal respekteres
 * @param {Array}    opts.lockedPlacements   — [{ studentId, groupIndex }] låste plasseringer
 * @param {string[]} opts.leaderIds          — student-IDer som er ledere
 * @param {boolean}  opts.requireLeaders     — om ledere skal spres (én per gruppe)
 * @param {Array}    opts.recentPairs        — [[nameA, nameB], ...] par fra historikk
 * @returns {{ groups: string[][] }}         — groups[i] = array of studentIds
 */
export function generateGroups({
  studentIds,
  studentsById,
  numGroups,
  constraints = [],
  useConstraints = true,
  lockedPlacements = [],
  leaderIds = [],
  requireLeaders = false,
  recentPairs = [],
}) {
  let best = null;
  let bestScore = Infinity;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const groups = Array.from({ length: numGroups }, () => []);

    // Plasser låste elever i sine respektive grupper
    for (const lp of lockedPlacements) {
      if (lp.groupIndex >= 0 && lp.groupIndex < numGroups) {
        groups[lp.groupIndex].push(lp.studentId);
      }
    }

    const lockedIds = new Set(lockedPlacements.map(l => l.studentId));

    // Fordel ledere én per gruppe i tilfeldig rekkefølge (hvis requireLeaders)
    if (requireLeaders && leaderIds.length > 0) {
      const shuffledLeaders = shuffle([...leaderIds]);
      for (let i = 0; i < shuffledLeaders.length && i < numGroups; i++) {
        const lid = shuffledLeaders[i];
        if (!lockedIds.has(lid)) {
          groups[i].push(lid);
          lockedIds.add(lid);
        }
      }
    }

    // Fordel resterende elever tilfeldig over gruppene, balansert
    const remaining = shuffle(studentIds.filter(id => !lockedIds.has(id)));
    // Sorter grupper etter størrelse (minst først) for jevn fordeling
    let gi = 0;
    for (const sid of remaining) {
      // Finn gruppen med færrest elever blant de neste numGroups plassene
      const targetIdx = findSmallestGroup(groups);
      groups[targetIdx].push(sid);
      gi++;
    }

    // Valider hard constraints
    if (useConstraints && !isValid(groups, studentsById, constraints)) continue;

    // Skår mot historikk (lavere = bedre)
    const score = scoreGroups(groups, studentsById, recentPairs);
    if (score < bestScore) {
      bestScore = score;
      best = groups.map(g => [...g]);
      if (score === 0) break; // Perfekt løsning funnet
    }
  }

  // Fallback: returner siste forsøk om ingen gyldig løsning ble funnet
  if (!best) {
    best = Array.from({ length: numGroups }, () => []);
    const allIds = shuffle([...studentIds]);
    for (let i = 0; i < allIds.length; i++) {
      best[i % numGroups].push(allIds[i]);
    }
  }

  return { groups: best };
}

/** Finn indeksen til gruppen med færrest elever */
function findSmallestGroup(groups) {
  let minIdx = 0;
  let minSize = groups[0].length;
  for (let i = 1; i < groups.length; i++) {
    if (groups[i].length < minSize) {
      minSize = groups[i].length;
      minIdx = i;
    }
  }
  return minIdx;
}

/** Fisher-Yates shuffle in-place, returnerer arrayet */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Sjekk om gruppeinndelingen respekterer never_together og always_together constraints */
function isValid(groups, studentsById, constraints) {
  for (const g of groups) {
    const names = new Set(g.map(id => studentsById[id]?.name).filter(Boolean));
    for (const c of constraints) {
      if (c.type === 'never_together') {
        if (names.has(c.studentA) && names.has(c.studentB)) return false;
      }
      if (c.type === 'always_together') {
        const hasA = names.has(c.studentA);
        const hasB = names.has(c.studentB);
        if (hasA !== hasB) return false;
      }
    }
  }
  return true;
}

/** Skår antall par som har vært i gruppe nylig (lavere er bedre) */
function scoreGroups(groups, studentsById, recentPairs) {
  const pairSet = new Set(recentPairs.map(([a, b]) => [a, b].sort().join('|')));
  let score = 0;
  for (const g of groups) {
    const names = g.map(id => studentsById[id]?.name).filter(Boolean);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = [names[i], names[j]].sort().join('|');
        if (pairSet.has(key)) score++;
      }
    }
  }
  return score;
}

/**
 * Bygg alle par fra en gruppeinndelng, for lagring i group_history.
 * @param {string[][]} groups
 * @param {Object} studentsById
 * @returns {string[][]} — [[nameA, nameB], ...]
 */
export function buildGroupPairs(groups, studentsById) {
  const pairs = [];
  for (const g of groups) {
    const names = g.map(id => studentsById[id]?.name).filter(Boolean);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        pairs.push([names[i], names[j]]);
      }
    }
  }
  return pairs;
}
