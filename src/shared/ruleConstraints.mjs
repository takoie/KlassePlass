/**
 * Bro mellom klassens `rules`-blob (kilden til sannhet for elevregler) og
 * gruppe-randomiseren (src/shared/groupRandomizer.js), som forventer en
 * navnebasert, parvis liste med harde constraints.
 *
 * Blob-regelform:  { id, type, priority, studentIds: string[] }
 *   type ∈ avoid | pair | supportPair | nearBoard | sitBack | sitMiddle | awayDoor | awayWindow
 *   priority ∈ critical | important | wish
 * Gruppe-constraint-form:  { studentA, studentB, type: 'never_together' | 'always_together' }
 *
 * Produktbeslutning 2026-09-10: KUN `critical`-regler binder gruppegenerering.
 * Sone-regler (nearBoard, ...) gjelder bare klassekart og droppes her.
 */

const PAIR_TYPES = new Set(['pair', 'supportPair']);

/**
 * @param {Array} rules      klassens blob-regler (kan være undefined)
 * @param {Array} students   [{ id, name }] for klassen
 * @returns {Array<{studentA: string, studentB: string, type: string}>}
 */
export function rulesToGroupConstraints(rules, students) {
  const nameById = new Map((students || []).map((s) => [s.id, s.name]));
  const seen = new Set();
  const out = [];

  for (const rule of rules || []) {
    if (!rule || rule.priority !== 'critical') continue;
    const isAvoid = rule.type === 'avoid';
    const isPair = PAIR_TYPES.has(rule.type);
    if (!isAvoid && !isPair) continue;

    const names = (rule.studentIds || [])
      .map((id) => nameById.get(id))
      .filter(Boolean);
    if (names.length < 2) continue;

    const type = isAvoid ? 'never_together' : 'always_together';
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const [a, b] = [names[i], names[j]].sort();
        if (a === b) continue;
        const key = `${a}|${b}|${type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ studentA: a, studentB: b, type });
      }
    }
  }
  return out;
}

/**
 * Folder gamle `student_constraints`-rader inn i en klasse-blob som kritiske
 * regler. Engangs-migrering (se App.jsx oppstart og import-flyten). Idempotent:
 * en rad som allerede finnes i blobben legges ikke til på nytt. Navn som ikke
 * kan slås opp mot en elev-id beholdes som rå streng, så ingenting mistes stille.
 *
 * @param {{students: Array, rules: Array}} blob
 * @param {Array<{student_a: string, student_b: string, type: string}>} constraintRows
 * @returns {{students: Array, rules: Array}}  samme referanse hvis ingenting endres
 */
export function foldLegacyConstraints(blob, constraintRows) {
  const rows = constraintRows || [];
  if (rows.length === 0) return blob;

  const idByName = new Map((blob.students || []).map((s) => [s.name, s.id]));
  const resolve = (v) => (idByName.has(v) ? idByName.get(v) : v);
  const rules = [...(blob.rules || [])];

  const keyOf = (type, ids) => `${type}|${[...ids].sort().join(',')}`;
  const existing = new Set(rules.map((r) => keyOf(r.type, r.studentIds || [])));

  let changed = false;
  for (const row of rows) {
    const type = row.type === 'together' ? 'pair' : 'avoid';
    const ids = [resolve(row.student_a), resolve(row.student_b)];
    const key = keyOf(type, ids);
    if (existing.has(key)) continue;
    existing.add(key);
    rules.push({
      id: `fold-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      priority: 'critical',
      studentIds: ids,
    });
    changed = true;
  }

  return changed ? { ...blob, rules } : blob;
}
