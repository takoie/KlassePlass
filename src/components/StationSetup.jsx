import React, { useState, useEffect, useRef } from 'react';
import { normalizeStudents } from '../shared/utils';
import { generateGroups } from '../shared/groupRandomizer';
import Select from './Select';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
import PrintPreviewModal from './Print/PrintPreviewModal';
import { GROUP_COLORS } from './StationPresenter';

const QUICK_STATION_NAMES = ['Lesing', 'Skriving', 'Spill', 'Lærerstasjon'];
const TIME_PRESETS = [5, 10, 15, 20];

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

function DraggableStudent({ studentId, name, isLeader, isLocked, onToggleLeader, onToggleLock }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: studentId });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center justify-between gap-1.5 bg-base-200 rounded px-2 py-1 cursor-grab active:cursor-grabbing select-none ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleLeader(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex-shrink-0"
          title={isLeader ? 'Fjern som gruppeleder' : 'Gjør til gruppeleder'}
        >
          <i className={`fa-solid fa-star text-[11px] ${isLeader ? 'text-amber-400' : 'text-base-content/40 hover:text-amber-400/70'}`}></i>
        </button>
        <span className="text-xs text-base-content truncate">{name}</span>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-shrink-0 p-0.5 rounded hover:bg-base-300/50"
        title={isLocked ? 'Låst til denne stasjonen/gruppen (klikk for å låse opp)' : 'Lås elev til denne stasjonen/gruppen (påvirkes ikke av randomisering)'}
      >
        <i className={`fa-solid text-[10px] ${isLocked ? 'fa-lock text-red-400' : 'fa-lock-open text-base-content/40 hover:text-base-content/60'}`}></i>
      </button>
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
  const [lockedIds, setLockedIds] = useState([]);
  const [activeDragId, setActiveDragId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [saveState, setSaveState] = useState('idle');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const nameInputRefs = useRef({});
  const [pendingFocusId, setPendingFocusId] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [classDraft, setClassDraft] = useState('');
  const nameModalInputRef = useRef(null);
  const hasAutoOpenedNameModalRef = useRef(false);
  const [timerMode, setTimerMode] = useState('preset');
  const [previousSession, setPreviousSession] = useState(null);
  const newStationInputRef = useRef(null);
  const [pendingFocusNew, setPendingFocusNew] = useState(false);
  const [newStationDraft, setNewStationDraft] = useState('');

  useEffect(() => { loadInitial(); }, [initialId]);

  useEffect(() => {
    if (!pendingFocusId) return;
    const el = nameInputRefs.current[pendingFocusId];
    if (el) el.focus();
    setPendingFocusId(null);
  }, [stations, pendingFocusId]);

  useEffect(() => {
    if (!pendingFocusNew) return;
    newStationInputRef.current?.focus();
    setPendingFocusNew(false);
  }, [stations, pendingFocusNew]);

  const skipNextAutosaveRef = useRef(true);

  const distributeStudentsIntoGroups = (
    studentsList = allStudents,
    numGroups = stations.length,
    locked = lockedIds,
    existingGroups = groups
  ) => {
    const targetCount = Math.max(2, numGroups);
    if (!studentsList || studentsList.length === 0) {
      setGroups(Array.from({ length: targetCount }, () => []));
      setGroupLeaders(Array.from({ length: targetCount }, () => null));
      return;
    }
    const studentsByIdMap = Object.fromEntries(studentsList.map(s => [s.id, s]));

    // Ta vare på plassering for låste elever i eksisterende grupper
    const lockedPlacements = [];
    if (existingGroups && existingGroups.length > 0) {
      existingGroups.forEach((groupStudents, groupIdx) => {
        if (groupIdx < targetCount) {
          groupStudents.forEach(sid => {
            if (locked.includes(sid) && studentsByIdMap[sid]) {
              lockedPlacements.push({ studentId: sid, groupIndex: groupIdx });
            }
          });
        }
      });
    }

    const result = generateGroups({
      studentIds: studentsList.map(s => s.id),
      studentsById: studentsByIdMap,
      numGroups: targetCount,
      useConstraints: false,
      lockedPlacements,
    });

    setGroups(result.groups);
    setGroupLeaders(prev => {
      const next = Array.from({ length: result.groups.length }, () => null);
      result.groups.forEach((g, idx) => {
        if (prev[idx] && g.includes(prev[idx])) {
          next[idx] = prev[idx];
        }
      });
      return next;
    });
  };

  const loadInitial = async () => {
    setLoading(true);
    skipNextAutosaveRef.current = true;
    try {
      const cls = await window.api.getClasses();
      setClasses(cls || []);

      if (initialId && initialId !== 'new') {
        const s = await window.api.getStationSession(initialId);
        if (s) {
          setSessionId(s.id);
          setName(s.name);
          setClassId(s.class_id);
          const mins = s.minutes_per_station ?? 10;
          const secs = s.seconds_per_station ?? 0;
          setMinutesPerStation(mins);
          setSecondsPerStation(secs);
          setNoTimer(!!s.no_timer);
          setTimerMode(TIME_PRESETS.includes(mins) && secs === 0 ? 'preset' : 'custom');
          let parsedStations = [];
          try { parsedStations = JSON.parse(s.stations || '[]'); setStations(parsedStations); } catch (e) {}
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
        const defaultClassId = cls?.[0]?.id ? String(cls[0].id) : '';
        setClassDraft(defaultClassId);
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

  const handleConfirmSessionName = async () => {
    if (!nameDraft.trim() || !classDraft) return;
    const cid = Number(classDraft);
    setName(nameDraft.trim());
    setClassId(cid);
    const modal = document.getElementById('modal_new_station_session');
    if (modal) modal.close();

    const loadedStudents = await loadStudentsForClass(cid);
    if (loadedStudents && loadedStudents.length > 0) {
      distributeStudentsIntoGroups(loadedStudents, stations.length, [], []);
    }
    loadPreviousSessionForClass(cid);
  };

  const loadPreviousSessionForClass = async (cid) => {
    if (!cid) { setPreviousSession(null); return; }
    try {
      const all = await window.api.getStationSessions();
      const forClass = (all || [])
        .filter(s => s.class_id === cid && s.id !== sessionId)
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setPreviousSession(forClass[0] || null);
    } catch (e) {
      setPreviousSession(null);
    }
  };

  const applyPreviousSession = () => {
    if (!previousSession) return;
    let prevStations = [], prevMinutes = 10, prevSeconds = 0, prevNoTimer = false;
    try { prevStations = JSON.parse(previousSession.stations || '[]'); } catch (e) {}
    prevMinutes = previousSession.minutes_per_station ?? 10;
    prevSeconds = previousSession.seconds_per_station ?? 0;
    prevNoTimer = !!previousSession.no_timer;
    if (prevStations.length === 0) return;

    const nextStations = prevStations.map(s => ({
      id: newStationId(),
      name: s.name || '',
      note: s.note || '',
      isTeacher: !!s.isTeacher,
    }));
    setStations(nextStations);
    setMinutesPerStation(prevMinutes);
    setSecondsPerStation(prevSeconds);
    setNoTimer(prevNoTimer);
    setTimerMode(TIME_PRESETS.includes(prevMinutes) && prevSeconds === 0 ? 'preset' : 'custom');
    setLockedIds([]);
    if (allStudents.length > 0) {
      distributeStudentsIntoGroups(allStudents, nextStations.length, [], []);
    } else {
      setGroups(Array.from({ length: nextStations.length }, () => []));
      setGroupLeaders(Array.from({ length: nextStations.length }, () => null));
    }
    setPreviousSession(null);
  };

  const loadStudentsForClass = async (cid) => {
    if (!cid) { setAllStudents([]); return []; }
    try {
      const cls = await window.api.getClass(cid);
      const parsed = cls?.students ? JSON.parse(cls.students) : [];
      const list = Array.isArray(parsed) ? parsed : (parsed.students || []);
      const normalized = normalizeStudents(list);
      setAllStudents(normalized);
      return normalized;
    } catch (e) {
      setAllStudents([]);
      return [];
    }
  };

  const handleClassChange = async (cid) => {
    const numericCid = cid === '' ? '' : Number(cid);
    setClassId(numericCid);
    setLockedIds([]);
    const loadedStudents = await loadStudentsForClass(numericCid);
    if (loadedStudents && loadedStudents.length > 0) {
      distributeStudentsIntoGroups(loadedStudents, stations.length, [], []);
    } else {
      setGroups(Array.from({ length: stations.length }, () => []));
      setGroupLeaders(Array.from({ length: stations.length }, () => null));
    }
    if (!sessionId) loadPreviousSessionForClass(numericCid);
  };

  const addStation = (name = '') => {
    const st = { id: newStationId(), name, isTeacher: false, note: '' };
    const nextStations = [...stations, st];
    setStations(nextStations);
    if (name) setPendingFocusNew(true); else setPendingFocusId(st.id);
    if (allStudents.length > 0) {
      distributeStudentsIntoGroups(allStudents, nextStations.length, lockedIds, groups);
    } else {
      setGroups(prev => [...prev, []]);
      setGroupLeaders(prev => [...prev, null]);
    }
  };

  const removeStation = (id) => {
    if (stations.length <= 2) return;
    const nextStations = stations.filter(s => s.id !== id);
    setStations(nextStations);
    if (allStudents.length > 0) {
      distributeStudentsIntoGroups(allStudents, nextStations.length, lockedIds, groups);
    } else {
      setGroups(prev => prev.slice(0, nextStations.length));
      setGroupLeaders(prev => prev.slice(0, nextStations.length));
    }
  };

  const updateStation = (id, field, value) => setStations(prev => prev.map(s => {
    if (s.id !== id) return field === 'isTeacher' && value ? { ...s, isTeacher: false } : s;
    return { ...s, [field]: value };
  }));

  const handleStationNameKeyDown = (e, idx, id) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = stations[idx + 1];
      if (next) {
        nameInputRefs.current[next.id]?.focus();
      } else {
        newStationInputRef.current?.focus();
      }
    } else if (e.key === 'Backspace' && e.currentTarget.value === '' && idx > 0 && stations.length > 2) {
      e.preventDefault();
      const prev = stations[idx - 1];
      removeStation(id);
      if (prev) setPendingFocusId(prev.id);
    }
  };

  const handleNewStationKeyDown = (e) => {
    if (e.key === 'Enter' && newStationDraft.trim()) {
      e.preventDefault();
      addStation(newStationDraft.trim());
      setNewStationDraft('');
    }
  };

  const selectTimerPreset = (mins) => {
    setNoTimer(false);
    setTimerMode('preset');
    setMinutesPerStation(mins);
    setSecondsPerStation(0);
  };
  const selectCustomTimer = () => { setNoTimer(false); setTimerMode('custom'); };
  const selectNoTimer = () => { setNoTimer(true); setTimerMode('preset'); };

  const handleRandomize = () => {
    if (allStudents.length === 0) return;
    distributeStudentsIntoGroups(allStudents, stations.length, lockedIds, groups);
  };

  const toggleLock = (studentId) => {
    setLockedIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
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

  const performSave = async () => {
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
    const id = sessionId || result?.lastID || null;
    if (!sessionId && result?.lastID) setSessionId(result.lastID);
    return id;
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaveState('saving');
    try {
      await performSave();
      setSaveState('saved');
    } catch (e) {
      setSaveState('idle');
    }
  };

  const handleStartSession = async () => {
    if (!canSave) return;
    setSaveState('saving');
    try {
      const id = await performSave();
      setSaveState('saved');
      if (id) onStartPresenting(id);
    } catch (e) {
      setSaveState('idle');
    }
  };

  const handleBack = async () => {
    if (canSave) await handleSave();
    onBack();
  };

  const autosaveKey = JSON.stringify({ name, classId, stations, groups, groupLeaders, minutesPerStation, secondsPerStation, noTimer });

  useEffect(() => {
    if (loading) return;
    if (skipNextAutosaveRef.current) { skipNextAutosaveRef.current = false; return; }
    if (!canSave) return;
    setSaveState('saving');
    const t = setTimeout(() => { handleSave(); }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveKey, loading]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-base-content/50">Laster...</div>;
  }

  return (
    <div className="flex flex-col h-full w-full bg-base-100 overflow-hidden">
      <div className="px-4 py-2 bg-base-200 border-b border-base-300 flex flex-wrap justify-between items-center gap-x-4 gap-y-2 z-10 flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn btn-ghost btn-sm text-base-content/60 hover:text-base-content gap-1" onClick={handleBack}>
            <i className="fa-solid fa-arrow-left"></i> Tilbake
          </button>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Navn på økt..."
            className="input input-ghost text-sm font-bold bg-surface-field border border-base-300 focus:border-orange-400 px-3 h-9 rounded text-base-content w-40"
          />
          <Select
            size="sm"
            className="w-44"
            ariaLabel="Klasse"
            placeholder="Velg klasse …"
            value={classId}
            onChange={handleClassChange}
            options={classes.map(c => ({ value: c.id, label: c.name }))}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="btn btn-sm btn-ghost text-base-content/60 hover:text-base-content gap-2"
            onClick={() => setShowPrintPreview(true)}
            disabled={validStations.length < 2}
            title={validStations.length < 2 ? 'Legg til minst 2 stasjoner for å skrive ut' : undefined}
          >
            <i className="fa-solid fa-print"></i> Skriv ut / PDF
          </button>
          {(saveState === 'saving' || (saveState === 'saved' && sessionId)) && (
            <span className="text-[11px] text-base-content/40 flex items-center gap-1.5 px-1" aria-live="polite">
              {saveState === 'saving' ? (<><i className="fa-solid fa-spinner fa-spin"></i> Lagrer …</>) : (<><i className="fa-solid fa-check text-success"></i> Lagret</>)}
            </span>
          )}
          <button className="btn btn-sm bg-orange-500/20 text-orange-300 border-none hover:bg-orange-500/30 gap-2" onClick={handleStartSession} disabled={!canSave || saveState === 'saving'}>
            <i className="fa-solid fa-play"></i> Start økt
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
      <div className="p-6 flex flex-col gap-6 max-w-4xl mx-auto">
        <div className="bg-base-200 border border-base-300 rounded-2xl p-5">
          <label className="text-xs font-bold uppercase opacity-50 text-base-content/60 mb-2 block">Tid per stasjon</label>
          <div className="flex items-center gap-2 flex-wrap">
            {TIME_PRESETS.map(m => {
              const active = !noTimer && timerMode === 'preset' && minutesPerStation === m && secondsPerStation === 0;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => selectTimerPreset(m)}
                  className={`btn btn-xs rounded-full font-bold ${active ? 'bg-orange-500 border-orange-500 text-white hover:bg-orange-500' : 'btn-ghost border border-base-300 text-base-content/70'}`}
                >
                  {m} min
                </button>
              );
            })}
            <button
              type="button"
              onClick={selectCustomTimer}
              className={`btn btn-xs rounded-full font-bold ${!noTimer && timerMode === 'custom' ? 'bg-orange-500 border-orange-500 text-white hover:bg-orange-500' : 'btn-ghost border border-base-300 text-base-content/70'}`}
            >
              Egendefinert
            </button>
            <button
              type="button"
              onClick={selectNoTimer}
              className={`btn btn-xs rounded-full font-bold ${noTimer ? 'bg-orange-500 border-orange-500 text-white hover:bg-orange-500' : 'btn-ghost border border-base-300 text-base-content/70'}`}
            >
              Ingen tidtaker
            </button>

            {!noTimer && timerMode === 'custom' && (
              <div className="flex items-end gap-2 ml-2">
                <div>
                  <span className="text-[10px] text-base-content/50 block mb-1">Minutter</span>
                  <input
                    type="number" min="0" max="60"
                    className="input input-bordered input-sm w-20 bg-surface-field border-base-300 text-base-content"
                    value={minutesPerStation}
                    onChange={(e) => setMinutesPerStation(Math.max(0, Number(e.target.value)))}
                  />
                </div>
                <span className="text-base-content/50 pb-1.5">:</span>
                <div>
                  <span className="text-[10px] text-base-content/50 block mb-1">Sekunder</span>
                  <input
                    type="number" min="0" max="59" step="5"
                    className="input input-bordered input-sm w-20 bg-surface-field border-base-300 text-base-content"
                    value={secondsPerStation}
                    onChange={(e) => setSecondsPerStation(Math.min(59, Math.max(0, Number(e.target.value))))}
                  />
                </div>
              </div>
            )}
          </div>
          {noTimer && (
            <p className="text-[11px] text-base-content/50 italic mt-2">
              Ingen nedtelling vises under økten — du bytter stasjon i eget tempo med "Neste rotasjon".
            </p>
          )}
          {!noTimer && minutesPerStation * 60 + secondsPerStation === 0 && (
            <p className="text-[11px] text-amber-300 italic mt-2">
              Sett en tid over 0, eller velg "Ingen tidtaker".
            </p>
          )}
        </div>

        {previousSession && !sessionId && (
          <div className="flex items-center gap-3 flex-wrap bg-orange-500/10 border border-dashed border-orange-400/60 rounded-xl px-4 py-3 text-xs">
            <i className="fa-solid fa-rotate text-orange-400"></i>
            <span><b className="font-bold">Gjenbruk fra sist:</b> «{previousSession.name}»</span>
            <button type="button" onClick={applyPreviousSession} className="btn btn-ghost btn-xs ml-auto border border-base-300 font-bold">
              Bruk dette oppsettet
            </button>
          </div>
        )}

        <div className="bg-base-200 border border-base-300 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sm text-base-content">Stasjoner ({stations.length})</h3>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_STATION_NAMES.map(qn => {
              const exists = stations.some(s => s.name.trim() === qn);
              return (
                <button
                  key={qn}
                  type="button"
                  disabled={exists}
                  onClick={() => addStation(qn)}
                  className={`btn btn-xs rounded-full font-bold ${exists ? 'btn-ghost border border-base-300 text-base-content/30 line-through' : 'btn-ghost border border-base-300 text-base-content/70 hover:border-orange-400 hover:text-orange-300'}`}
                >
                  {exists ? '✓ ' : '+ '}{qn}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            {stations.map((s, idx) => (
              <div key={s.id} className="flex items-start gap-2 bg-surface-field rounded-lg p-2.5">
                <span className="text-xs text-base-content/50 font-bold w-5 pt-2 flex-shrink-0">{idx + 1}.</span>
                <input
                  type="text"
                  ref={(el) => { if (el) nameInputRefs.current[s.id] = el; else delete nameInputRefs.current[s.id]; }}
                  value={s.name}
                  onChange={(e) => updateStation(s.id, 'name', e.target.value)}
                  onKeyDown={(e) => handleStationNameKeyDown(e, idx, s.id)}
                  placeholder="Stasjonsnavn..."
                  className="input input-bordered input-sm flex-1 bg-base-200 border-base-300 text-base-content"
                />
                <input
                  type="text"
                  value={s.note}
                  onChange={(e) => updateStation(s.id, 'note', e.target.value)}
                  placeholder="Instruksjon (valgfritt)..."
                  className="input input-bordered input-sm flex-[1.5] bg-base-200 border-base-300 text-base-content/80"
                />
                <label className="flex items-center gap-1.5 text-xs text-base-content/80 whitespace-nowrap pt-2 cursor-pointer">
                  <input type="checkbox" className="checkbox checkbox-xs" checked={!!s.isTeacher} onChange={(e) => updateStation(s.id, 'isTeacher', e.target.checked)} />
                  Lærerstasjon
                </label>
                <button className="btn btn-ghost btn-xs text-red-400 flex-shrink-0" tabIndex={-1} onClick={() => removeStation(s.id)} disabled={stations.length <= 2}>
                  <i className="fa-solid fa-trash"></i>
                </button>
              </div>
            ))}
            <div className="flex items-start gap-2 rounded-lg p-2.5 border-2 border-dashed border-base-300">
              <span className="text-xs text-base-content/30 font-bold w-5 pt-2 flex-shrink-0">{stations.length + 1}.</span>
              <input
                type="text"
                ref={newStationInputRef}
                value={newStationDraft}
                onChange={(e) => setNewStationDraft(e.target.value)}
                onKeyDown={handleNewStationKeyDown}
                placeholder="Ny stasjon — skriv navn og trykk Enter…"
                className="input input-bordered input-sm flex-1 bg-transparent border-transparent focus:border-orange-400 focus:bg-base-200 text-base-content placeholder:text-base-content/40"
              />
            </div>
          </div>
        </div>

        <div className="bg-base-200 border border-base-300 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-bold text-sm text-base-content">Grupper ({groups.length})</h3>
              <p className="text-[11px] text-base-content/60">Gruppene følger automatisk antall stasjoner ({stations.length}).</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-xs bg-amber-500/20 text-amber-300 border-none hover:bg-amber-500/30 gap-1.5 font-bold"
                onClick={handleRandomize}
                disabled={allStudents.length === 0}
                title="Randomiser elever på nytt over stasjonene (beholder låste elever)"
              >
                <i className="fa-solid fa-shuffle text-xs"></i> Randomiser
              </button>
            </div>
          </div>
          {!classId && <p className="text-xs text-base-content/50 italic">Velg en klasse for å fordele elever i grupper.</p>}
          <DndContext
            sensors={sensors}
            onDragStart={(event) => setActiveDragId(event.active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveDragId(null)}
          >
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(200px, 1fr))` }}>
              {groups.map((studentIds, idx) => (
                <DroppableGroup key={idx} groupIdx={idx}>
                  <div className="text-xs font-bold text-base-content/80 mb-1.5 flex items-center justify-between">
                    <span>Gruppe {idx + 1} ({studentIds.length})</span>
                    {stations[idx]?.name && (
                      <span className="text-[10px] text-orange-400 truncate max-w-[100px] font-normal" title={stations[idx].name}>
                        {stations[idx].name}
                      </span>
                    )}
                  </div>
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
                          isLocked={lockedIds.includes(sid)}
                          onToggleLeader={() => toggleLeader(idx, sid)}
                          onToggleLock={() => toggleLock(sid)}
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
                  <span className="text-xs text-base-content">{studentsById[activeDragId]?.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
      </div>

      <dialog id="modal_new_station_session" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-surface-raised border border-base-300 text-base-content rounded-2xl max-w-md">
          <h3 className="font-bold text-lg flex items-center gap-2 text-base-content">
            <i className="fa-solid fa-arrows-rotate text-orange-400"></i> Ny stasjonsøkt
          </h3>
          
          <div className="flex flex-col gap-3 py-3">
            <div>
              <label className="text-xs font-bold uppercase opacity-50 text-base-content/60 mb-1 block">Navn på økten</label>
              <input
                ref={nameModalInputRef}
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && nameDraft.trim() && classDraft) handleConfirmSessionName(); }}
                placeholder="f.eks. Norsk - stasjoner uke 12..."
                className="input input-bordered w-full bg-surface-field border-base-300 text-base-content"
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
                value={classDraft}
                onChange={setClassDraft}
                options={classes.map(c => ({ value: c.id, label: c.name }))}
              />
            </div>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost text-base-content/60 mr-2"
              onClick={() => {
                document.getElementById('modal_new_station_session')?.close();
                if (initialId === 'new' && !sessionId) onBack();
              }}
            >
              Avbryt
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmSessionName}
              disabled={!nameDraft.trim() || !classDraft}
            >
              Opprett
            </button>
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
