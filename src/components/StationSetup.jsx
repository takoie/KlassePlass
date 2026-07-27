import React, { useState, useEffect } from 'react';
import { normalizeStudents } from '../shared/utils';
import { generateGroups } from '../shared/groupRandomizer';

/** Enkel round-robin rotasjonsplan: steps[rotasjon][stasjon] = gruppeindeks. */
function buildRotationPlan(numGroups, numStations) {
  const steps = [];
  for (let step = 0; step < numStations; step++) {
    const assignment = [];
    for (let station = 0; station < numStations; station++) {
      assignment.push((step + station) % numGroups);
    }
    steps.push(assignment);
  }
  return steps;
}

let idCounter = 0;
const newStationId = () => `st-${Date.now()}-${idCounter++}`;

export default function StationSetup({ onBack, onStartPresenting, initialId }) {
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [name, setName] = useState('');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState([]);
  const [minutesPerStation, setMinutesPerStation] = useState(10);
  const [stations, setStations] = useState([
    { id: newStationId(), name: '', isTeacher: false, note: '' },
    { id: newStationId(), name: '', isTeacher: false, note: '' },
  ]);
  const [allStudents, setAllStudents] = useState([]);
  const [groups, setGroups] = useState([[], []]);
  const [saveState, setSaveState] = useState('idle');

  useEffect(() => { loadInitial(); }, [initialId]);

  const loadInitial = async () => {
    setLoading(true);
    try {
      const cls = await window.api.getClasses();
      setClasses(cls);

      if (initialId && initialId !== 'new') {
        const s = await window.api.getStationSession(initialId);
        if (s) {
          setSessionId(s.id);
          setName(s.name);
          setClassId(s.class_id);
          setMinutesPerStation(s.minutes_per_station ?? 10);
          try { setStations(JSON.parse(s.stations || '[]')); } catch (e) {}
          try { setGroups(JSON.parse(s.groups || '[]')); } catch (e) {}
          await loadStudentsForClass(s.class_id);
        }
      }
    } catch (e) {}
    setLoading(false);
  };

  const loadStudentsForClass = async (cid) => {
    if (!cid) { setAllStudents([]); return; }
    try {
      const cls = await window.api.getClass(cid);
      const parsed = cls?.students ? JSON.parse(cls.students) : [];
      const list = Array.isArray(parsed) ? parsed : (parsed.students || []);
      setAllStudents(normalizeStudents(list));
    } catch (e) { setAllStudents([]); }
  };

  const handleClassChange = async (cid) => {
    setClassId(cid);
    await loadStudentsForClass(cid);
  };

  const addStation = () => setStations(prev => [...prev, { id: newStationId(), name: '', isTeacher: false, note: '' }]);
  const removeStation = (id) => setStations(prev => prev.length > 2 ? prev.filter(s => s.id !== id) : prev);
  const updateStation = (id, field, value) => setStations(prev => prev.map(s => {
    if (s.id !== id) return field === 'isTeacher' && value ? { ...s, isTeacher: false } : s;
    return { ...s, [field]: value };
  }));

  const setNumGroups = (n) => {
    const target = Math.max(2, n);
    setGroups(prev => {
      const next = prev.slice(0, target);
      while (next.length < target) next.push([]);
      return next;
    });
  };

  const autoDistribute = () => {
    if (allStudents.length === 0) return;
    const studentsById = Object.fromEntries(allStudents.map(s => [s.id, s]));
    const result = generateGroups({
      studentIds: allStudents.map(s => s.id),
      studentsById,
      numGroups: groups.length,
      useConstraints: false,
    });
    setGroups(result.groups);
  };

  const moveStudent = (studentId, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setGroups(prev => {
      const next = prev.map(g => [...g]);
      next[fromIdx] = next[fromIdx].filter(id => id !== studentId);
      next[toIdx] = [...next[toIdx], studentId];
      return next;
    });
  };

  const studentsById = Object.fromEntries(allStudents.map(s => [s.id, s]));
  const validStations = stations.filter(s => s.name.trim());
  const canSave = name.trim() && classId && validStations.length >= 2;

  const handleSave = async () => {
    if (!canSave) return;
    setSaveState('saving');
    try {
      const rotationPlan = buildRotationPlan(groups.length, validStations.length);
      const result = await window.api.saveStationSession({
        id: sessionId,
        name: name.trim(),
        classId,
        stations: validStations,
        groups,
        rotationPlan,
        minutesPerStation,
      });
      if (!sessionId && result?.lastID) setSessionId(result.lastID);
      setSaveState('saved');
    } catch (e) {
      setSaveState('idle');
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-slate-500">Laster...</div>;
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#202534] overflow-hidden">
      <div className="px-4 py-2 bg-[#1a1e2b] border-b border-slate-800 flex flex-wrap justify-between items-center gap-x-4 gap-y-2 z-10 flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn btn-ghost btn-xs text-slate-400 hover:text-white gap-1" onClick={onBack}>
            <i className="fa-solid fa-arrow-left"></i> Tilbake
          </button>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Navn på økt..."
            className="input input-ghost text-sm font-bold bg-[#262b3a] border border-slate-700 focus:border-orange-400 px-3 h-8 rounded text-white w-40"
          />
          <select
            className="select select-bordered select-xs bg-[#262b3a] border-slate-700 text-white font-bold"
            value={classId}
            onChange={(e) => handleClassChange(e.target.value)}
          >
            <option value="">Velg klasse...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {sessionId && (
            <button className="btn btn-sm bg-orange-500/20 text-orange-300 border-none hover:bg-orange-500/30 gap-2" onClick={() => onStartPresenting(sessionId)}>
              <i className="fa-solid fa-play"></i> Start økt
            </button>
          )}
          <button className="btn btn-sm bg-[#34d399]/20 text-[#34d399] border-none hover:bg-[#34d399]/30 gap-2" onClick={handleSave} disabled={!canSave || saveState === 'saving'}>
            {saveState === 'saving' ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
            Lagre
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-4xl">
        <div className="bg-[#1a1e2b] border border-slate-800 rounded-2xl p-5">
          <label className="text-xs font-bold uppercase opacity-50 text-slate-400 mb-2 block">Minutter per stasjon</label>
          <input
            type="number" min="1" max="60"
            className="input input-bordered input-sm w-24 bg-[#262b3a] border-slate-700 text-white"
            value={minutesPerStation}
            onChange={(e) => setMinutesPerStation(Number(e.target.value))}
          />
        </div>

        <div className="bg-[#1a1e2b] border border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sm text-white">Stasjoner ({stations.length})</h3>
            <button className="btn btn-xs btn-outline border-slate-700 text-slate-300 hover:bg-slate-800 gap-1" onClick={addStation}>
              <i className="fa-solid fa-plus"></i> Legg til stasjon
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {stations.map((s, idx) => (
              <div key={s.id} className="flex items-start gap-2 bg-[#262b3a] rounded-lg p-2.5">
                <span className="text-xs text-slate-500 font-bold w-5 pt-2 flex-shrink-0">{idx + 1}.</span>
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => updateStation(s.id, 'name', e.target.value)}
                  placeholder="Stasjonsnavn..."
                  className="input input-bordered input-sm flex-1 bg-[#1a1e2b] border-slate-700 text-white"
                />
                <input
                  type="text"
                  value={s.note}
                  onChange={(e) => updateStation(s.id, 'note', e.target.value)}
                  placeholder="Instruksjon (valgfritt)..."
                  className="input input-bordered input-sm flex-[1.5] bg-[#1a1e2b] border-slate-700 text-slate-300"
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap pt-2 cursor-pointer">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={!!s.isTeacher} onChange={(e) => updateStation(s.id, 'isTeacher', e.target.checked)} />
                  Lærerstasjon
                </label>
                <button className="btn btn-ghost btn-xs text-red-400 flex-shrink-0" onClick={() => removeStation(s.id)} disabled={stations.length <= 2}>
                  <i className="fa-solid fa-trash"></i>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1a1e2b] border border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sm text-white">Grupper ({groups.length})</h3>
            <div className="flex items-center gap-2">
              <button className="btn btn-xs btn-outline border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setNumGroups(groups.length - 1)} disabled={groups.length <= 2}>
                <i className="fa-solid fa-minus"></i>
              </button>
              <span className="text-xs text-slate-400 w-4 text-center">{groups.length}</span>
              <button className="btn btn-xs btn-outline border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setNumGroups(groups.length + 1)}>
                <i className="fa-solid fa-plus"></i>
              </button>
              <button className="btn btn-xs bg-amber-500/20 text-amber-300 border-none hover:bg-amber-500/30 gap-1 ml-2" onClick={autoDistribute} disabled={allStudents.length === 0}>
                <i className="fa-solid fa-shuffle"></i> Auto-fordel
              </button>
            </div>
          </div>
          {!classId && <p className="text-xs text-slate-500 italic">Velg en klasse for å fordele elever i grupper.</p>}
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(200px, 1fr))` }}>
            {groups.map((studentIds, idx) => (
              <div key={idx} className="bg-[#262b3a] rounded-xl p-2.5">
                <div className="text-xs font-bold text-slate-300 mb-1.5">Gruppe {idx + 1} ({studentIds.length})</div>
                <div className="flex flex-col gap-1">
                  {studentIds.map(sid => {
                    const student = studentsById[sid];
                    if (!student) return null;
                    return (
                      <div key={sid} className="flex items-center justify-between gap-1 bg-[#1a1e2b] rounded px-2 py-1">
                        <span className="text-xs text-slate-200 truncate">{student.name}</span>
                        <select
                          className="select select-bordered select-xs bg-[#262b3a] border-slate-700 text-slate-300"
                          value={idx}
                          onChange={(e) => moveStudent(sid, idx, Number(e.target.value))}
                        >
                          {groups.map((_, gi) => <option key={gi} value={gi}>{gi + 1}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
