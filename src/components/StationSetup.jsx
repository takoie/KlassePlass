import React, { useState, useEffect, useRef } from 'react';
import { normalizeStudents } from '../shared/utils';
import { generateGroups } from '../shared/groupRandomizer';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
import PrintPreviewModal from './Print/PrintPreviewModal';
import { GROUP_COLORS } from './StationPresenter';

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

function DroppableGroup({ groupIdx, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `station-group-${groupIdx}` });
  return (
    <div ref={setNodeRef} className={`bg-surface-field rounded-xl p-2.5 transition-colors ${isOver ? 'ring-2 ring-orange-400' : ''}`}>
      {children}
    </div>
  );
}

function DraggableStudent({ studentId, name, isLeader, onToggleLeader }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: studentId });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-1.5 bg-base-200 rounded px-2 py-1 cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleLeader(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-shrink-0"
        title={isLeader ? 'Fjern som gruppeleder' : 'Gjør til gruppeleder'}
      >
        <i className={`fa-solid fa-star text-[11px] ${isLeader ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400/70'}`}></i>
      </button>
      <span className="text-xs text-slate-200 truncate">{name}</span>
    </div>
  );
}

export default function StationSetup({ onBack, onStartPresenting, initialId }) {
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [name, setName] = useState('');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState([]);
  const [minutesPerStation, setMinutesPerStation] = useState(10);
  const [secondsPerStation, setSecondsPerStation] = useState(0);
  const [noTimer, setNoTimer] = useState(false);
  const [stations, setStations] = useState([
    { id: newStationId(), name: '', isTeacher: false, note: '' },
    { id: newStationId(), name: '', isTeacher: false, note: '' },
  ]);
  const [allStudents, setAllStudents] = useState([]);
  const [groups, setGroups] = useState([[], []]);
  const [groupLeaders, setGroupLeaders] = useState([null, null]);
  const [activeDragId, setActiveDragId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [saveState, setSaveState] = useState('idle');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const nameInputRefs = useRef({});
  const [pendingFocusId, setPendingFocusId] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const nameModalInputRef = useRef(null);
  const classSelectRef = useRef(null);
  const hasAutoOpenedNameModalRef = useRef(false);

  useEffect(() => { loadInitial(); }, [initialId]);

  useEffect(() => {
    if (!pendingFocusId) return;
    const el = nameInputRefs.current[pendingFocusId];
    if (el) el.focus();
    setPendingFocusId(null);
  }, [stations, pendingFocusId]);

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
          setSecondsPerStation(s.seconds_per_station ?? 0);
          setNoTimer(!!s.no_timer);
          try { setStations(JSON.parse(s.stations || '[]')); } catch (e) {}
          let parsedGroups = [];
          try { parsedGroups = JSON.parse(s.groups || '[]'); setGroups(parsedGroups); } catch (e) {}
          try {
            const gl = JSON.parse(s.group_leaders || '[]');
            setGroupLeaders(Array.isArray(gl) && gl.length === parsedGroups.length ? gl : parsedGroups.map(() => null));
          } catch (e) {
            setGroupLeaders(parsedGroups.map(() => null));
          }
          await loadStudentsForClass(s.class_id);
        }
      } else if (initialId === 'new' && !hasAutoOpenedNameModalRef.current) {
        hasAutoOpenedNameModalRef.current = true;
        setNameDraft('');
        setTimeout(() => {
          const modal = document.getElementById('modal_new_station_session');
          if (modal) {
            modal.showModal();
            setTimeout(() => nameModalInputRef.current?.focus(), 150);
          }
        }, 100);
      }
    } catch (e) {}
    setLoading(false);
  };

  const handleConfirmSessionName = () => {
    if (!nameDraft.trim()) return;
    setName(nameDraft.trim());
    const modal = document.getElementById('modal_new_station_session');
    if (modal) modal.close();
    setTimeout(() => classSelectRef.current?.focus(), 150);
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
    // `cid` kommer fra <select>-elementets `value` og er alltid en JS-streng
    // — Rust-siden (getClass/saveStationSession) forventer class_id som
    // i64/Option<i64> og godtar ikke en JSON-streng der. Samme bug-klasse som
    // ble fikset for klassekart i SeatingOverview (se seatings.rs).
    const numericCid = cid === '' ? '' : Number(cid);
    setClassId(numericCid);
    // Tøm utdaterte grupper og gruppeledere fra forrige klasse
    setGroups(prev => prev.map(() => []));
    setGroupLeaders(prev => prev.map(() => null));
    await loadStudentsForClass(numericCid);
  };

  const addStation = () => {
    const st = { id: newStationId(), name: '', isTeacher: false, note: '' };
    setStations(prev => [...prev, st]);
    setPendingFocusId(st.id);
  };
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
    setGroupLeaders(prev => {
      const next = prev.slice(0, target);
      while (next.length < target) next.push(null);
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
    setGroupLeaders(result.groups.map(() => null));
  };

  const moveStudent = (studentId, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setGroups(prev => {
      const next = prev.map(g => [...g]);
      next[fromIdx] = next[fromIdx].filter(id => id !== studentId);
      next[toIdx] = [...next[toIdx], studentId];
      return next;
    });
    setGroupLeaders(prev => {
      if (prev[fromIdx] !== studentId) return prev;
      const next = [...prev];
      next[fromIdx] = null;
      return next;
    });
  };

  const toggleLeader = (groupIdx, studentId) => {
    setGroupLeaders(prev => {
      const next = [...prev];
      next[groupIdx] = next[groupIdx] === studentId ? null : studentId;
      return next;
    });
  };

  const handleDragEnd = (event) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const toIdx = Number(String(over.id).replace('station-group-', ''));
    if (Number.isNaN(toIdx)) return;
    const fromIdx = groups.findIndex(g => g.includes(active.id));
    if (fromIdx === -1) return;
    moveStudent(active.id, fromIdx, toIdx);
  };

  const studentsById = Object.fromEntries(allStudents.map(s => [s.id, s]));
  const validStations = stations.filter(s => s.name.trim());
  const canSave = name.trim() && classId && validStations.length >= 2 && (noTimer || minutesPerStation * 60 + secondsPerStation > 0);
  const hasGroupStationMismatch = validStations.length >= 2 && groups.length !== validStations.length;
  const tooFewGroups = hasGroupStationMismatch && groups.length < validStations.length;

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
        groupLeaders,
        rotationPlan,
        minutesPerStation,
        secondsPerStation,
        noTimer,
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
    <div className="flex flex-col h-full w-full bg-base-100 overflow-hidden">
      <div className="px-4 py-2 bg-base-200 border-b border-slate-800 flex flex-wrap justify-between items-center gap-x-4 gap-y-2 z-10 flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn btn-ghost btn-xs text-slate-400 hover:text-white gap-1" onClick={onBack}>
            <i className="fa-solid fa-arrow-left"></i> Tilbake
          </button>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Navn på økt..."
            className="input input-ghost text-sm font-bold bg-surface-field border border-slate-700 focus:border-orange-400 px-3 h-8 rounded text-white w-40"
          />
          <select
            ref={classSelectRef}
            className="select select-bordered select-xs bg-surface-field border-slate-700 text-white font-bold"
            value={classId}
            onChange={(e) => handleClassChange(e.target.value)}
          >
            <option value="">Velg klasse...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="btn btn-sm btn-ghost text-slate-400 hover:text-white gap-2"
            onClick={() => setShowPrintPreview(true)}
            disabled={validStations.length < 2}
            title={validStations.length < 2 ? 'Legg til minst 2 stasjoner for å skrive ut' : undefined}
          >
            <i className="fa-solid fa-print"></i> Skriv ut / PDF
          </button>
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

      <div className="flex-1 overflow-y-auto">
      <div className="p-6 flex flex-col gap-6 max-w-4xl mx-auto">
        <div className="bg-base-200 border border-slate-800 rounded-2xl p-5">
          <label className="text-xs font-bold uppercase opacity-50 text-slate-400 mb-2 block">Tid per stasjon</label>
          <div className="flex items-end gap-4 flex-wrap">
            <div className={`flex items-end gap-2 transition-opacity ${noTimer ? 'opacity-40' : ''}`}>
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Minutter</span>
                <input
                  type="number" min="0" max="60"
                  disabled={noTimer}
                  className="input input-bordered input-sm w-20 bg-surface-field border-slate-700 text-white disabled:cursor-not-allowed"
                  value={minutesPerStation}
                  onChange={(e) => setMinutesPerStation(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <span className="text-slate-500 pb-1.5">:</span>
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Sekunder</span>
                <input
                  type="number" min="0" max="59" step="5"
                  disabled={noTimer}
                  className="input input-bordered input-sm w-20 bg-surface-field border-slate-700 text-white disabled:cursor-not-allowed"
                  value={secondsPerStation}
                  onChange={(e) => setSecondsPerStation(Math.min(59, Math.max(0, Number(e.target.value))))}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pb-1.5">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={noTimer}
                onChange={(e) => setNoTimer(e.target.checked)}
              />
              Ingen tidtaker (styr rotasjon manuelt)
            </label>
          </div>
          {noTimer && (
            <p className="text-[11px] text-slate-500 italic mt-2">
              Ingen nedtelling vises under økten — du bytter stasjon i eget tempo med "Neste rotasjon".
            </p>
          )}
          {!noTimer && minutesPerStation * 60 + secondsPerStation === 0 && (
            <p className="text-[11px] text-amber-300 italic mt-2">
              Sett en tid over 0, eller kryss av for "Ingen tidtaker".
            </p>
          )}
        </div>

        <div className="bg-base-200 border border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sm text-white">Stasjoner ({stations.length})</h3>
          </div>
          <div className="flex flex-col gap-2">
            {stations.map((s, idx) => (
              <div key={s.id} className="flex items-start gap-2 bg-surface-field rounded-lg p-2.5">
                <span className="text-xs text-slate-500 font-bold w-5 pt-2 flex-shrink-0">{idx + 1}.</span>
                <input
                  type="text"
                  ref={(el) => { if (el) nameInputRefs.current[s.id] = el; else delete nameInputRefs.current[s.id]; }}
                  value={s.name}
                  onChange={(e) => updateStation(s.id, 'name', e.target.value)}
                  placeholder="Stasjonsnavn..."
                  className="input input-bordered input-sm flex-1 bg-base-200 border-slate-700 text-white"
                />
                <input
                  type="text"
                  value={s.note}
                  onChange={(e) => updateStation(s.id, 'note', e.target.value)}
                  placeholder="Instruksjon (valgfritt)..."
                  className="input input-bordered input-sm flex-[1.5] bg-base-200 border-slate-700 text-slate-300"
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
            <button
              type="button"
              onClick={addStation}
              className="py-2 rounded-lg border-2 border-dashed border-slate-700 text-slate-400 text-xs font-bold hover:border-orange-400 hover:text-orange-300 transition-colors flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-plus"></i> Ny stasjon
            </button>
          </div>
        </div>

        <div className="bg-base-200 border border-slate-800 rounded-2xl p-5">
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
          {hasGroupStationMismatch && (
            <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-3 text-xs text-amber-200">
              <i className="fa-solid fa-triangle-exclamation text-amber-400 mt-0.5 flex-shrink-0"></i>
              <div className="flex-1">
                {tooFewGroups ? (
                  <>
                    <strong>{groups.length} grupper</strong> dekker ikke <strong>{validStations.length} stasjoner</strong> 1:1.
                    Det går fint å gjennomføre, men i hver rotasjon vil noen grupper stå oppført på flere stasjoner samtidig.
                  </>
                ) : (
                  <>
                    <strong>{groups.length} grupper</strong> er flere enn <strong>{validStations.length} stasjoner</strong>.
                    Det går fint å gjennomføre, men noen grupper vil ikke bli tildelt en stasjon i rotasjonsplanen.
                  </>
                )}
              </div>
              <button
                type="button"
                className="btn btn-xs bg-amber-500/20 text-amber-300 border-none hover:bg-amber-500/30 flex-shrink-0 whitespace-nowrap"
                onClick={() => setNumGroups(validStations.length)}
              >
                Sett til {validStations.length}
              </button>
            </div>
          )}
          <DndContext
            sensors={sensors}
            onDragStart={(event) => setActiveDragId(event.active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveDragId(null)}
          >
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(200px, 1fr))` }}>
              {groups.map((studentIds, idx) => (
                <DroppableGroup key={idx} groupIdx={idx}>
                  <div className="text-xs font-bold text-slate-300 mb-1.5">Gruppe {idx + 1} ({studentIds.length})</div>
                  <div className="flex flex-col gap-1">
                    {studentIds.map(sid => {
                      const student = studentsById[sid];
                      if (!student) return null;
                      return (
                        <DraggableStudent
                          key={sid}
                          studentId={sid}
                          name={student.name}
                          isLeader={groupLeaders[idx] === sid}
                          onToggleLeader={() => toggleLeader(idx, sid)}
                        />
                      );
                    })}
                  </div>
                </DroppableGroup>
              ))}
            </div>
            <DragOverlay>
              {activeDragId ? (
                <div className="flex items-center gap-1.5 bg-base-200 border border-orange-400 rounded px-2 py-1 shadow-lg">
                  <i className="fa-solid fa-star text-[11px] text-transparent"></i>
                  <span className="text-xs text-slate-200">{studentsById[activeDragId]?.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
      </div>

      <dialog id="modal_new_station_session" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-surface-raised border border-slate-700 text-slate-100 rounded-2xl max-w-md">
          <h3 className="font-bold text-lg flex items-center gap-2 text-white">
            <i className="fa-solid fa-arrows-rotate text-orange-400"></i> Ny stasjonsøkt
          </h3>
          <p className="py-2 text-xs text-slate-400">Gi økten et navn, f.eks. tema eller dato:</p>
          <input
            ref={nameModalInputRef}
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmSessionName(); }}
            placeholder="f.eks. Norsk - stasjoner uke 12..."
            className="input input-bordered w-full bg-surface-field border-slate-700 text-white"
            autoFocus
          />
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2">Avbryt</button>
              <button className="btn btn-primary" onClick={handleConfirmSessionName} disabled={!nameDraft.trim()}>Opprett</button>
            </form>
          </div>
        </div>
      </dialog>

      {showPrintPreview && (
        <PrintPreviewModal
          contentType="station"
          chartName={name.trim() || 'Stasjonsplan'}
          className={classes.find(c => String(c.id) === String(classId))?.name || ''}
          chartComment=""
          stationProps={{
            stations: validStations,
            groups,
            groupLeaders,
            rotationPlan: buildRotationPlan(groups.length, validStations.length),
            students: allStudents,
            groupColors: GROUP_COLORS,
          }}
          initialShowNumbers={false}
          initialShowZones={false}
          initialShowGroups={true}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}
