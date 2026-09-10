import React, { useState, useEffect } from 'react';
import { normalizeStudents, showToast } from '../../shared/utils';
import { generateGroups } from '../../shared/groupRandomizer';
import { rulesToGroupConstraints } from '../../shared/ruleConstraints.mjs';
import Select from '../Select';

/**
 * Modal for å opprette en ny gruppeinndeling: velg klasse, antall grupper,
 * regler og gruppeledere. Genererer gruppene med det samme og lagrer,
 * slik at redigeringsvisningen alltid åpnes med en ekte, lagret inndeling.
 */
export default function CreateGroupModal({ classes, onCreated }) {
  const [name, setName] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [numGroups, setNumGroups] = useState(4);
  const [useConstraints, setUseConstraints] = useState(false);
  const [avoidHistory, setAvoidHistory] = useState(false);
  const [avoidLastN, setAvoidLastN] = useState(3);
  const [requireLeaders, setRequireLeaders] = useState(false);
  const [leaderIds, setLeaderIds] = useState([]);
  const [busy, setBusy] = useState(false);

  const classBlob = (() => {
    const cls = classes.find(c => c.id === Number(selectedClass));
    if (!cls) return { students: [], rules: [] };
    try {
      const parsed = cls.students ? JSON.parse(cls.students) : [];
      if (Array.isArray(parsed)) return { students: normalizeStudents(parsed), rules: [] };
      return { students: normalizeStudents(parsed.students || []), rules: parsed.rules || [] };
    } catch (e) {
      return { students: [], rules: [] };
    }
  })();
  const classStudents = classBlob.students;

  useEffect(() => {
    // Fjern ledere som ikke lenger finnes i klassen når klassen byttes
    setLeaderIds(prev => prev.filter(id => classStudents.some(s => s.id === id)));
  }, [selectedClass]);

  const resetAndClose = () => {
    setName('');
    setSelectedClass('');
    setNumGroups(4);
    setUseConstraints(false);
    setAvoidHistory(false);
    setAvoidLastN(3);
    setRequireLeaders(false);
    setLeaderIds([]);
    document.getElementById('modal_create_group')?.close();
  };

  const toggleLeader = (id) => {
    setLeaderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    if (!name.trim() || !selectedClass || classStudents.length === 0 || busy) return;
    setBusy(true);
    try {
      // `selectedClass` kommer fra et <select>-element sin `value` og er
      // derfor alltid en JS-streng — IPC-laget deserialiserer class_id som
      // i64/Option<i64> og godtar ikke en JSON-streng der (samme bug-klasse
      // som ble fikset for klassekart i SeatingOverview, se
      // seatings.rs::class_id_and_room_id_must_be_numeric_not_string).
      const classIdNum = Number(selectedClass);
      const studentsById = Object.fromEntries(classStudents.map(s => [s.id, s]));

      // Elevregler fra klassens blob (samme kilde som klassekart-løseren).
      // Kun kritiske avoid/pair-regler blir harde constraints for gruppene.
      const constraints = rulesToGroupConstraints(classBlob.rules, classStudents);

      let recentPairs = [];
      if (avoidHistory && avoidLastN > 0) {
        const rows = await window.api.getGroupHistory(classIdNum, avoidLastN);
        recentPairs = (rows || []).flatMap(row => {
          try { return JSON.parse(row.pairs); } catch (e) { return []; }
        });
      }

      const result = generateGroups({
        studentIds: classStudents.map(s => s.id),
        studentsById,
        numGroups: Math.max(2, Math.min(numGroups, classStudents.length)),
        constraints,
        useConstraints,
        leaderIds,
        requireLeaders,
        recentPairs,
      });

      const groups = result.groups.map((studentIds, i) => ({ groupNumber: i + 1, studentIds }));

      const saveResult = await window.api.saveGroupAssignment({
        id: null,
        name: name.trim(),
        classId: classIdNum,
        sourceSeatingId: null,
        useConstraints,
        avoidLastN: avoidHistory ? avoidLastN : 0,
        requireLeaders,
        leaderIds,
        groups,
      });

      resetAndClose();
      if (saveResult?.lastID) onCreated(saveResult.lastID);
    } catch (e) {
      showToast(e?.message || 'Kunne ikke opprette gruppeinndeling.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog id="modal_create_group" className="modal modal-bottom sm:modal-middle">
      <div className="modal-box bg-surface-raised border border-base-300 text-base-content rounded-2xl max-w-lg">
        <h3 className="font-bold text-lg flex items-center gap-2 text-base-content">
          <i className="fa-solid fa-people-group text-fuchsia-400"></i> Ny gruppeinndeling
        </h3>

        <div className="flex flex-col gap-4 py-3">
          <div>
            <label className="text-xs font-bold uppercase opacity-50 text-base-content/60 mb-1 block">Navn på inndelingen</label>
            <input
              type="text"
              className="input input-bordered w-full bg-surface-field border-base-300 text-base-content"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="f.eks. Prosjektgrupper uke 12"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase opacity-50 text-base-content/60 mb-1 block">Klasse</label>
            <Select
              size="sm"
              className="w-full"
              ariaLabel="Klasse"
              placeholder="Velg klasse …"
              value={selectedClass}
              onChange={setSelectedClass}
              options={classes.map(c => ({ value: c.id, label: c.name }))}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase opacity-50 text-base-content/60 mb-1 block">Antall grupper</label>
            <input
              type="number"
              min="2"
              max={Math.max(2, classStudents.length)}
              className="input input-bordered w-24 bg-surface-field border-base-300 text-base-content"
              value={numGroups}
              onChange={(e) => setNumGroups(Number(e.target.value))}
            />
            {selectedClass && (
              <span className="text-xs text-base-content/60 ml-2">
                {classStudents.length} elever · ca. {Math.round(classStudents.length / Math.max(1, numGroups))} per gruppe
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-base-content">
              <input type="checkbox" className="checkbox checkbox-sm" checked={useConstraints} onChange={(e) => setUseConstraints(e.target.checked)} />
              Respekter plasserings-regler (aldri/alltid sammen)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-base-content">
              <input type="checkbox" className="checkbox checkbox-sm" checked={avoidHistory} onChange={(e) => setAvoidHistory(e.target.checked)} />
              Unngå nylige gruppekombinasjoner — siste
              <input
                type="number" min="1" max="20"
                className="input input-bordered input-xs w-16 bg-surface-field border-base-300 text-base-content"
                value={avoidLastN}
                onChange={(e) => setAvoidLastN(Number(e.target.value))}
                disabled={!avoidHistory}
              />
              inndelinger
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-base-content">
              <input type="checkbox" className="checkbox checkbox-sm" checked={requireLeaders} onChange={(e) => setRequireLeaders(e.target.checked)} />
              Krev gruppeleder — én leder per gruppe
            </label>
            {requireLeaders && (
              <div className="mt-2 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {classStudents.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${leaderIds.includes(s.id) ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'border-base-300 text-base-content/60 hover:bg-base-200'}`}
                    onClick={() => toggleLeader(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-action">
          <form method="dialog">
            <button className="btn btn-ghost text-base-content/60 mr-2" onClick={resetAndClose}>Avbryt</button>
          </form>
          <button
            className="btn btn-primary gap-2"
            onClick={handleCreate}
            disabled={!name.trim() || !selectedClass || classStudents.length === 0 || busy}
          >
            {busy ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
            Generer grupper
          </button>
        </div>
      </div>
    </dialog>
  );
}
