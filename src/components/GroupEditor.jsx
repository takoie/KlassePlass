import React, { useState, useEffect, useRef } from 'react';
import { DndContext, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { normalizeStudents, showToast, focusAfterRender } from '../shared/utils';
import { generateGroups, buildGroupPairs } from '../shared/groupRandomizer';
import { rulesToGroupConstraints } from '../shared/ruleConstraints.mjs';
import StudentContextMenu from './GroupWork/StudentContextMenu';
import PrintPreviewModal from './Print/PrintPreviewModal';

const GROUP_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#84cc16', '#06b6d4', '#d946ef'];

export default function GroupEditor({ onBack, initialId }) {
  const [loading, setLoading] = useState(true);
  const [assignmentId, setAssignmentId] = useState(null);
  const [name, setName] = useState('');
  const [classId, setClassId] = useState(null);
  const [className, setClassName] = useState('');
  const [useConstraints, setUseConstraints] = useState(true);
  const [avoidLastN, setAvoidLastN] = useState(3);
  const [requireLeaders, setRequireLeaders] = useState(false);
  const [leaderIds, setLeaderIds] = useState([]);
  const [lockedIds, setLockedIds] = useState([]);
  // Elever holdt utenfor fordelingen (fravær/sykdom): ikke med i grupper, og
  // ignorert av "Generer på nytt" / balansering. Ligger i egen "Ikke med"-sone.
  const [excludedIds, setExcludedIds] = useState([]);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, studentId, groupIdx }
  const [activeDragId, setActiveDragId] = useState(null);
  const [studentsById, setStudentsById] = useState({});
  const [allStudentIds, setAllStudentIds] = useState([]);
  const [constraints, setConstraints] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupNames, setGroupNames] = useState([]);
  const [useCustomNames, setUseCustomNames] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [regenerating, setRegenerating] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [isProjectorMode, setIsProjectorMode] = useState(false);

  useEffect(() => { loadAssignment(); }, [initialId]);

  // Speiler isProjectorMode mot native OS-fullskjerm. Samme mønster som
  // SeatingChart.jsx (ikke som cleanup+body-par, for å unngå to overlappende
  // setFullscreen-kall til WebView2 - se docs/plans/2026-08-20-fullskjerm-avslutt-fiks.md).
  useEffect(() => {
    window.api?.setFullscreen?.(isProjectorMode)
      .catch((err) => console.error('setFullscreen feilet:', err));
    window.dispatchEvent(new CustomEvent('toggle-projector', { detail: isProjectorMode }));
  }, [isProjectorMode]);

  // Sikkerhetsnett: går ut av native fullskjerm hvis komponenten unmountes
  // mens prosjektorvisning er aktiv. Tom dep-array = kun ved ekte unmount.
  useEffect(() => {
    return () => {
      window.api?.setFullscreen?.(false)
        .catch((err) => console.error('setFullscreen cleanup feilet:', err));
      window.dispatchEvent(new CustomEvent('toggle-projector', { detail: false }));
    };
  }, []);

  useEffect(() => {
    if (!isProjectorMode) return;
    const handler = (e) => { if (e.key === 'Escape') setIsProjectorMode(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isProjectorMode]);

  useEffect(() => {
    if (editingName) focusAfterRender(nameInputRef.current);
  }, [editingName]);

  useEffect(() => {
    if (loading || !assignmentId) return;
    if (localStorage.getItem('print_on_mount') === 'true') {
      localStorage.removeItem('print_on_mount');
      setTimeout(() => setShowPrintPreview(true), 500);
    }
  }, [loading, assignmentId]);

  const loadAssignment = async () => {
    if (!initialId || initialId === 'new') { setLoading(false); return; }
    setLoading(true);
    try {
      const [assignment, groupRows] = await Promise.all([
        window.api.getGroupAssignment(initialId),
        window.api.getGroupAssignmentGroups(initialId),
      ]);
      if (!assignment) { setLoading(false); return; }

      const cls = await window.api.getClass(assignment.class_id);
      const parsed = cls?.students ? JSON.parse(cls.students) : [];
      const list = Array.isArray(parsed) ? parsed : (parsed.students || []);
      const students = normalizeStudents(list);
      const byId = Object.fromEntries(students.map(s => [s.id, s]));

      // Elevregler leses fra klassens blob (samme kilde som klassekart-løseren).
      // Kun kritiske avoid/pair-regler blir harde constraints for gruppene.
      const blobRules = Array.isArray(parsed) ? [] : (parsed.rules || []);
      const mappedConstraints = rulesToGroupConstraints(blobRules, students);

      setAssignmentId(assignment.id);
      setName(assignment.name);
      setClassId(assignment.class_id);
      setClassName(cls?.name || '');
      setUseConstraints(!!assignment.use_constraints);
      setAvoidLastN(assignment.avoid_last_n ?? 3);
      setRequireLeaders(!!assignment.require_leaders);
      try { setLeaderIds(JSON.parse(assignment.leader_ids || '[]')); } catch (e) { setLeaderIds([]); }
      try { setLockedIds(JSON.parse(assignment.locked_ids || '[]')); } catch (e) { setLockedIds([]); }
      try { setExcludedIds(JSON.parse(assignment.excluded_ids || '[]')); } catch (e) { setExcludedIds([]); }
      setStudentsById(byId);
      setAllStudentIds(students.map(s => s.id));
      setConstraints(mappedConstraints);
      setGroups(groupRows.map(row => { try { return JSON.parse(row.student_ids); } catch (e) { return []; } }));
      setGroupNames(groupRows.map(row => row.group_name || ''));
      setUseCustomNames(!!assignment.use_custom_names);
      setDirty(false);
    } catch (e) {}
    setLoading(false);
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      let recentPairs = [];
      if (avoidLastN > 0) {
        const rows = await window.api.getGroupHistory(classId, avoidLastN);
        recentPairs = (rows || []).flatMap(row => {
          try { return JSON.parse(row.pairs); } catch (e) { return []; }
        });
      }
      const lockedPlacements = lockedIds
        .map(sid => {
          const groupIndex = groups.findIndex(g => g.includes(sid));
          return groupIndex === -1 ? null : { studentId: sid, groupIndex };
        })
        .filter(Boolean);
      const result = generateGroups({
        studentIds: allStudentIds.filter(id => !excludedIds.includes(id)),
        studentsById,
        numGroups: groups.length,
        constraints,
        useConstraints,
        lockedPlacements,
        leaderIds: leaderIds.filter(id => !excludedIds.includes(id)),
        requireLeaders,
        recentPairs,
      });
      setGroups(result.groups);
      setDirty(true);
    } catch (e) {}
    setRegenerating(false);
  };

  const addGroup = () => {
    setGroups(prev => [...prev, []]);
    setGroupNames(prev => [...prev, '']);
    setDirty(true);
  };

  const removeGroup = (idx) => {
    if (groups[idx].length > 0) return;
    setGroups(prev => prev.filter((_, i) => i !== idx));
    setGroupNames(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const updateGroupName = (idx, value) => {
    setGroupNames(prev => prev.map((n, i) => i === idx ? value : n));
    setDirty(true);
  };

  const toggleCustomNames = () => {
    setUseCustomNames(prev => !prev);
    setDirty(true);
  };

  const moveStudent = (studentId, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setGroups(prev => {
      const next = prev.map(g => [...g]);
      next[fromIdx] = next[fromIdx].filter(id => id !== studentId);
      next[toIdx] = [...next[toIdx], studentId];
      return next;
    });
    setDirty(true);
  };

  const toggleLock = (studentId) => {
    setLockedIds(prev => prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]);
    setDirty(true);
  };

  // Ta en elev ut av fordelingen: fjern fra gruppa si (og som låst), legg i
  // "Ikke med". Beholdes som eventuell leder, så statusen er der om de tas med igjen.
  const excludeStudent = (studentId) => {
    setGroups(prev => prev.map(g => g.filter(id => id !== studentId)));
    setLockedIds(prev => prev.filter(id => id !== studentId));
    setExcludedIds(prev => prev.includes(studentId) ? prev : [...prev, studentId]);
    setDirty(true);
  };

  // Ta en elev tilbake i fordelingen. Uten mål-gruppe havner de i den minste
  // gruppa, så fordelingen holder seg jevn.
  const includeStudent = (studentId, targetGroupIdx = null) => {
    setExcludedIds(prev => prev.filter(id => id !== studentId));
    setGroups(prev => {
      if (prev.some(g => g.includes(studentId))) return prev;
      const idx = (targetGroupIdx != null && targetGroupIdx >= 0 && targetGroupIdx < prev.length)
        ? targetGroupIdx
        : prev.reduce((minI, g, i, arr) => g.length < arr[minI].length ? i : minI, 0);
      if (prev.length === 0) return prev;
      return prev.map((g, i) => i === idx ? [...g, studentId] : g);
    });
    setDirty(true);
  };

  const toggleExcluded = (studentId) => {
    if (excludedIds.includes(studentId)) includeStudent(studentId);
    else excludeStudent(studentId);
  };

  const setGroupLeader = (studentId, groupIdx) => {
    setLeaderIds(prev => {
      const others = new Set(groups[groupIdx].filter(id => id !== studentId));
      return [...prev.filter(id => !others.has(id) && id !== studentId), studentId];
    });
    setDirty(true);
  };

  const removeGroupLeader = (studentId) => {
    setLeaderIds(prev => prev.filter(id => id !== studentId));
    setDirty(true);
  };

  const rotateLeaders = () => {
    setLeaderIds(prev => {
      const prevSet = new Set(prev);
      return groups
        .filter(studentIds => studentIds.length > 0)
        .map(studentIds => {
          const currentIdx = studentIds.findIndex(id => prevSet.has(id));
          const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % studentIds.length;
          return studentIds[nextIdx];
        });
    });
    setDirty(true);
  };

  const randomizeLeaders = () => {
    setLeaderIds(
      groups
        .filter(studentIds => studentIds.length > 0)
        .map(studentIds => studentIds[Math.floor(Math.random() * studentIds.length)])
    );
    setDirty(true);
  };

  const handleStudentContextMenu = (e, studentId, groupIdx) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, studentId, groupIdx });
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (event) => setActiveDragId(event.active.id);

  const handleDragEnd = (event) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const sid = active.id;

    // Sluppet i "Ikke med"-sonen → hold eleven utenfor fordelingen.
    if (over.id === 'excluded') {
      if (!excludedIds.includes(sid)) excludeStudent(sid);
      return;
    }

    const toIdx = Number(String(over.id).slice('group-'.length));
    if (Number.isNaN(toIdx)) return;
    const fromIdx = groups.findIndex(g => g.includes(sid));

    // Kom fra "Ikke med" (ikke i noen gruppe) → ta med igjen i mål-gruppa.
    if (fromIdx === -1) {
      if (excludedIds.includes(sid)) includeStudent(sid, toIdx);
      return;
    }
    if (fromIdx === toIdx) return;
    moveStudent(sid, fromIdx, toIdx);
  };

  const latestGroupDataRef = useRef({});
  useEffect(() => {
    latestGroupDataRef.current = {
      assignmentId, name, classId, useConstraints, avoidLastN, requireLeaders,
      leaderIds, lockedIds, excludedIds, useCustomNames, groups, groupNames, studentsById, dirty
    };
  });

  useEffect(() => {
    return () => {
      const data = latestGroupDataRef.current;
      if (data.dirty && data.assignmentId) {
        const groupsPayload = (data.groups || []).map((studentIds, i) => ({
          groupNumber: i + 1,
          studentIds,
          groupName: data.useCustomNames && data.groupNames?.[i]?.trim() ? data.groupNames[i].trim() : null,
        }));
        window.api.saveGroupAssignment({
          id: data.assignmentId,
          name: data.name?.trim() || 'Uten navn',
          classId: data.classId,
          sourceSeatingId: null,
          useConstraints: data.useConstraints,
          avoidLastN: data.avoidLastN,
          requireLeaders: data.requireLeaders,
          leaderIds: data.leaderIds,
          lockedIds: data.lockedIds,
          excludedIds: data.excludedIds,
          useCustomNames: data.useCustomNames,
          groups: groupsPayload,
        }).catch(() => {});
        const pairs = buildGroupPairs(data.groups || [], data.studentsById || {});
        window.api.saveGroupHistory({ classId: data.classId, assignmentId: data.assignmentId, pairs }).catch(() => {});
      }
    };
  }, []);

  // Autolagring er alltid på (se useEffect under) — denne funksjonen gjør selve
  // lagringen og driver "Lagrer …/Lagret"-indikatoren i toppbaren. Feil vises
  // alltid som toast; vellykket lagring vises kun i indikatoren, ikke som toast,
  // så det ikke dukker opp en boks i hjørnet ved hver lille endring.
  const handleSave = async () => {
    if (!assignmentId) return;
    setSaveState('saving');
    try {
      const groupsPayload = groups.map((studentIds, i) => ({
        groupNumber: i + 1, studentIds,
        groupName: useCustomNames && groupNames[i]?.trim() ? groupNames[i].trim() : null,
      }));
      await window.api.saveGroupAssignment({
        id: assignmentId, name: name.trim() || 'Uten navn', classId,
        sourceSeatingId: null, useConstraints, avoidLastN, requireLeaders, leaderIds, lockedIds,
        excludedIds, useCustomNames, groups: groupsPayload,
      });
      const pairs = buildGroupPairs(groups, studentsById);
      await window.api.saveGroupHistory({ classId, assignmentId, pairs });
      setDirty(false);
      setSaveState('saved');
    } catch (e) {
      setSaveState('idle');
      showToast('Kunne ikke lagre.', 'error', { key: 'group-save' });
    }
  };

  // Autolagring: lagre et lite øyeblikk etter siste endring, i stedet for å kreve manuelt trykk.
  useEffect(() => {
    if (!dirty || !assignmentId || loading) return;
    const timer = setTimeout(() => { handleSave(); }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, name, groups, groupNames, useCustomNames, leaderIds, lockedIds, excludedIds, useConstraints, avoidLastN, requireLeaders]);

  const handleBack = async () => {
    if (dirty) {
      await handleSave();
    }
    onBack();
  };

  const handleDelete = async () => {
    if (!assignmentId) return;
    try {
      await window.api.deleteGroupAssignment(assignmentId);
      onBack();
    } catch (e) {}
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-base-content/50">Laster...</div>;
  }

  if (!assignmentId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-base-content/50 gap-3">
        <i className="fa-solid fa-people-group text-5xl opacity-20"></i>
        <h2 className="text-lg font-bold text-base-content">Fant ikke gruppeinndelingen</h2>
        <button className="btn btn-ghost btn-sm text-base-content/60" onClick={onBack}>
          <i className="fa-solid fa-arrow-left"></i> Tilbake
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-base-100 overflow-hidden relative">
      {!isProjectorMode && (
      <div className="bg-base-200 border-b border-base-300 z-20 flex-shrink-0">
        <div className="px-4 py-2 grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <button className="btn btn-ghost btn-xs text-base-content/60 hover:text-base-content gap-1 flex-shrink-0" onClick={handleBack}>
              <i className="fa-solid fa-arrow-left"></i> Tilbake
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 min-w-0">
            {editingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setDirty(true); }}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
                className="input input-ghost text-sm font-bold bg-surface-field border border-base-300 focus:border-fuchsia-400 px-3 h-8 rounded text-base-content w-40"
              />
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-bold text-base-content truncate max-w-[10rem]">{name || 'Uten navn'}</span>
                <button
                  className="btn btn-ghost btn-xs text-base-content/60 hover:text-base-content flex-shrink-0"
                  title="Endre navn"
                  onClick={() => setEditingName(true)}
                >
                  <i className="fa-solid fa-pen text-xs"></i>
                </button>
              </div>
            )}
            <span className="text-xs font-bold uppercase opacity-50 text-base-content/60 flex-shrink-0">{className}</span>
          </div>

          <div className="flex items-center justify-end gap-2 flex-wrap">
            <button className="btn btn-sm btn-ghost text-base-content/60 hover:text-base-content gap-2" onClick={() => setShowPrintPreview(true)}>
              <i className="fa-solid fa-print"></i> Skriv ut / PDF
            </button>
            {(saveState === 'saving' || saveState === 'saved') && (
              <span className="text-[11px] text-base-content/40 flex items-center gap-1.5 px-1" aria-live="polite">
                {saveState === 'saving' ? (<><i className="fa-solid fa-spinner fa-spin"></i> Lagrer …</>) : (<><i className="fa-solid fa-check text-success"></i> Lagret</>)}
              </span>
            )}
            <button className="btn btn-sm bg-fuchsia-500/20 text-fuchsia-300 border-none hover:bg-fuchsia-500/30 gap-2" onClick={() => setIsProjectorMode(true)}>
              <i className="fa-solid fa-expand"></i> Prosjektor-modus
            </button>
            <button className="btn btn-ghost text-red-400 hover:bg-red-950/40 btn-xs" onClick={() => document.getElementById('modal_delete_group_assignment')?.showModal()}>
              <i className="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>

        <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
          <button
            className={`btn btn-xs rounded-full font-bold gap-1.5 ${useCustomNames ? 'bg-fuchsia-500 border-fuchsia-500 text-white hover:bg-fuchsia-500' : 'btn-ghost border border-base-300 text-base-content/70'}`}
            onClick={toggleCustomNames}
            title="Bytt mellom nummererte og egendefinerte gruppenavn"
          >
            <i className="fa-solid fa-pen text-[10px]"></i> Egendefinerte navn
          </button>
          <button className="btn btn-xs rounded-full font-bold gap-1.5 btn-ghost border border-base-300 text-base-content/70 hover:border-fuchsia-400 hover:text-fuchsia-300" onClick={addGroup}>
            <i className="fa-solid fa-plus text-[10px]"></i> Legg til gruppe
          </button>
          <button className="btn btn-xs rounded-full font-bold gap-1.5 btn-ghost border border-base-300 text-base-content/70 hover:border-fuchsia-400 hover:text-fuchsia-300" onClick={handleRegenerate} disabled={regenerating}>
            <i className={`fa-solid fa-shuffle text-[10px] ${regenerating ? 'fa-spin' : ''}`}></i> Generer på nytt
          </button>
          <div className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-full border border-base-300 bg-base-100/60 flex-shrink-0 whitespace-nowrap">
            <span className="text-[10px] uppercase tracking-wide font-bold text-base-content/50 pl-1 flex items-center gap-1">
              <i className="fa-solid fa-star text-amber-400"></i> Leder
            </span>
            <button className="btn btn-xs rounded-full btn-ghost text-base-content/80 hover:bg-base-200 gap-1" onClick={rotateLeaders} title="Roter lederen videre til neste elev i hver gruppe">
              <i className="fa-solid fa-rotate text-[10px]"></i> Roter
            </button>
            <button className="btn btn-xs rounded-full btn-ghost text-base-content/80 hover:bg-base-200 gap-1" onClick={randomizeLeaders} title="Velg tilfeldig leder i hver gruppe">
              <i className="fa-solid fa-dice text-[10px]"></i> Tilfeldig
            </button>
          </div>
        </div>
      </div>
      )}

      {isProjectorMode && (
        <>
          <div className="fixed top-4 left-4 z-[9999] flex items-center gap-2 bg-base-200/95 border border-base-300 rounded-xl shadow-2xl px-3.5 py-2.5">
            <span className="text-sm font-bold text-base-content">{name || 'Uten navn'}</span>
            <span className="text-[10px] font-bold uppercase opacity-50 text-base-content/60">{className}</span>
          </div>
          <button className="fixed top-4 right-4 z-[9999] btn btn-error shadow-2xl animate-pulse" onClick={() => setIsProjectorMode(false)}>
            Avslutt prosjektorvisning
          </button>
        </>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className={`flex-1 overflow-y-auto ${isProjectorMode ? 'p-10' : 'p-6'}`}>
          <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${isProjectorMode ? 280 : 220}px, 1fr))`, gap: isProjectorMode ? '1.5rem' : '1rem' }}>
            {groups.map((studentIds, idx) => {
              const color = GROUP_COLORS[idx % GROUP_COLORS.length];
              return (
                <GroupPanel key={idx} idx={idx} color={color}>
                  <div className={`flex items-center justify-between gap-2 ${isProjectorMode ? 'px-5 py-4' : 'px-4 py-2.5'}`} style={{ backgroundColor: `${color}22`, borderBottom: `2px solid ${color}` }}>
                    {useCustomNames ? (
                      <input
                        type="text"
                        value={groupNames[idx] || ''}
                        onChange={(e) => updateGroupName(idx, e.target.value)}
                        placeholder={`Gruppe ${idx + 1}`}
                        className={`font-bold bg-transparent border-b border-transparent hover:border-base-300 focus:border-current focus:outline-none min-w-0 flex-1 ${isProjectorMode ? 'text-xl' : 'text-sm'}`}
                        style={{ color }}
                      />
                    ) : (
                      <span className={`font-bold ${isProjectorMode ? 'text-xl' : 'text-sm'}`} style={{ color }}>Gruppe {idx + 1}</span>
                    )}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-base-content/60 ${isProjectorMode ? 'text-sm' : 'text-xs'}`}>{studentIds.length} elever</span>
                      {!isProjectorMode && studentIds.length === 0 && groups.length > 1 && (
                        <button
                          className="text-base-content/60 hover:text-red-400 transition-colors"
                          title="Fjern tom gruppe"
                          onClick={() => removeGroup(idx)}
                        >
                          <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={`flex flex-col flex-1 ${isProjectorMode ? 'p-3 gap-2.5' : 'p-2 gap-1.5'}`}>
                    {studentIds.length === 0 && (
                      <p className="text-xs text-base-content/50 italic text-center py-3">Ingen elever</p>
                    )}
                    {studentIds.filter(sid => !excludedIds.includes(sid)).map(sid => {
                      const student = studentsById[sid];
                      if (!student) return null;
                      return (
                        <StudentCard
                          key={sid}
                          sid={sid}
                          student={student}
                          isLeader={leaderIds.includes(sid)}
                          isLocked={lockedIds.includes(sid)}
                          large={isProjectorMode}
                          onContextMenu={(e) => handleStudentContextMenu(e, sid, idx)}
                        />
                      );
                    })}
                  </div>
                </GroupPanel>
              );
            })}
          </div>

          {!isProjectorMode && (
            <ExcludedZone
              studentIds={excludedIds}
              studentsById={studentsById}
              onContextMenu={(e, sid) => handleStudentContextMenu(e, sid, null)}
              onIncludeAll={() => excludedIds.forEach(id => includeStudent(id))}
            />
          )}
        </div>
        <DragOverlay>
          {activeDragId ? (
            <div className="bg-surface-field rounded-lg px-2.5 py-1.5 shadow-2xl border border-fuchsia-400 text-sm text-base-content flex items-center gap-1.5">
              {leaderIds.includes(activeDragId) && <i className="fa-solid fa-star text-amber-400 text-[10px]"></i>}
              {studentsById[activeDragId]?.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <StudentContextMenu
        contextMenu={contextMenu}
        studentsById={studentsById}
        leaderIds={leaderIds}
        lockedIds={lockedIds}
        excludedIds={excludedIds}
        setGroupLeader={setGroupLeader}
        removeGroupLeader={removeGroupLeader}
        toggleLock={toggleLock}
        toggleExcluded={toggleExcluded}
        setContextMenu={setContextMenu}
      />

      {showPrintPreview && (
        <PrintPreviewModal
          contentType="groupWork"
          chartName={name}
          className={className}
          chartComment=""
          groupWorkProps={{
            groups,
            studentsById,
            leaderIds,
            groupColors: GROUP_COLORS,
            groupNames: groups.map((_, i) => (useCustomNames && groupNames[i]?.trim()) ? groupNames[i].trim() : null),
          }}
          initialShowNumbers={false}
          initialShowZones={false}
          initialShowGroups={true}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      <dialog id="modal_delete_group_assignment" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-surface-raised border border-base-300 text-base-content rounded-2xl">
          <h3 className="font-bold text-lg text-red-400 flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation"></i> Slett gruppeinndeling?
          </h3>
          <p className="py-4 text-sm text-base-content/80">Er du helt sikker på at du vil slette <strong>{name}</strong>? Historikken for denne inndelingen forsvinner også.</p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-base-content/60 mr-2 hover:bg-base-200">Avbryt</button>
            </form>
            <button className="btn btn-error" onClick={handleDelete}>Ja, slett</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function StudentCard({ sid, student, isLeader, isLocked, large, onContextMenu }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: sid });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onContextMenu={onContextMenu}
      className={`flex items-center justify-between gap-2 bg-surface-field rounded-lg cursor-grab select-none touch-none ${large ? 'px-4 py-3' : 'px-2.5 py-1.5'}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <span className={`text-base-content truncate flex items-center gap-1.5 ${large ? 'text-lg' : 'text-sm'}`}>
        {isLeader && <i className={`fa-solid fa-star text-amber-400 ${large ? 'text-xs' : 'text-[10px]'}`}></i>}
        {student.name}
      </span>
      {isLocked && <i className={`fa-solid fa-lock text-red-400 ${large ? 'text-xs' : 'text-[10px]'}`} title="Låst (høyreklikk for å låse opp)"></i>}
    </div>
  );
}

function GroupPanel({ idx, color, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-${idx}` });
  return (
    <div
      ref={setNodeRef}
      className={`bg-base-200 border rounded-2xl overflow-hidden flex flex-col transition-colors ${isOver ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/30' : 'border-base-300'}`}
    >
      {children}
    </div>
  );
}

/** "Ikke med i fordelingen"-sonen: dra elever hit (eller høyreklikk → Sett som
 *  fraværende) for å holde dem utenfor generering/balansering. Kan felles
 *  sammen som en skuff så elevnavnene ikke vises (f.eks. på prosjektor). Alltid
 *  rendret – også sammenfelt er den et gyldig slippmål. Åpen/lukket huskes. */
function ExcludedZone({ studentIds, studentsById, onContextMenu, onIncludeAll }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'excluded' });
  const has = studentIds.length > 0;

  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('groupEditor_excludedOpen') === 'true'; } catch (e) { return false; }
  });
  const toggle = () => setOpen(prev => {
    const next = !prev;
    try { localStorage.setItem('groupEditor_excludedOpen', String(next)); } catch (e) {}
    return next;
  });

  return (
    <div
      ref={setNodeRef}
      className={`mt-6 rounded-2xl border border-dashed transition-colors ${
        isOver ? 'border-amber-400 bg-amber-400/10' : has ? 'border-base-300 bg-base-200/60' : 'border-base-300 bg-transparent'
      }`}
    >
      <div className={`px-4 py-2.5 flex items-center justify-between gap-2 ${open ? 'border-b border-base-300/70' : ''}`}>
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 font-bold text-sm text-base-content/80 hover:text-base-content transition-colors min-w-0"
          title={open ? 'Skjul navnene' : 'Vis navnene'}
        >
          <i className={`fa-solid fa-chevron-right text-[10px] text-base-content/50 transition-transform ${open ? 'rotate-90' : ''}`}></i>
          <i className="fa-solid fa-user-clock text-amber-400"></i>
          <span className="truncate">Ikke med i fordelingen</span>
          <span className="text-xs font-normal text-base-content/50">({studentIds.length})</span>
        </button>
        {has && (
          <button
            className="btn btn-xs btn-ghost text-base-content/60 hover:text-base-content gap-1 flex-shrink-0"
            onClick={onIncludeAll}
            title="Ta alle med i fordelingen igjen"
          >
            <i className="fa-solid fa-rotate-left"></i> Ta med alle
          </button>
        )}
      </div>
      {open && (
        <div className="p-3">
          {has ? (
            <div className="flex flex-wrap gap-1.5">
              {studentIds.map(sid => {
                const student = studentsById[sid];
                if (!student) return null;
                return (
                  <StudentCard
                    key={sid}
                    sid={sid}
                    student={student}
                    isLeader={false}
                    isLocked={false}
                    onContextMenu={(e) => onContextMenu(e, sid)}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-base-content/50 italic text-center py-2">
              Dra elever hit – eller høyreklikk en elev og velg «Sett som fraværende» – for å holde dem utenfor når du genererer eller jevner ut grupper.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
