import React, { useState, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { normalizeStudents } from '../shared/utils';
import { generateGroups, buildGroupPairs } from '../shared/groupRandomizer';
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
  const [contextMenu, setContextMenu] = useState(null); // { x, y, studentId, groupIdx }
  const [activeDragId, setActiveDragId] = useState(null);
  const [studentsById, setStudentsById] = useState({});
  const [allStudentIds, setAllStudentIds] = useState([]);
  const [constraints, setConstraints] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupNames, setGroupNames] = useState([]);
  const [useCustomNames, setUseCustomNames] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState('saved');
  const [regenerating, setRegenerating] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => { loadAssignment(); }, [initialId]);

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

      const rawConstraints = await window.api.getConstraints(assignment.class_id);
      const mappedConstraints = (rawConstraints || []).map(c => ({
        studentA: c.student_a, studentB: c.student_b, type: c.type,
      }));

      setAssignmentId(assignment.id);
      setName(assignment.name);
      setClassId(assignment.class_id);
      setClassName(cls?.name || '');
      setUseConstraints(!!assignment.use_constraints);
      setAvoidLastN(assignment.avoid_last_n ?? 3);
      setRequireLeaders(!!assignment.require_leaders);
      try { setLeaderIds(JSON.parse(assignment.leader_ids || '[]')); } catch (e) { setLeaderIds([]); }
      try { setLockedIds(JSON.parse(assignment.locked_ids || '[]')); } catch (e) { setLockedIds([]); }
      setStudentsById(byId);
      setAllStudentIds(students.map(s => s.id));
      setConstraints(mappedConstraints);
      setGroups(groupRows.map(row => { try { return JSON.parse(row.student_ids); } catch (e) { return []; } }));
      setGroupNames(groupRows.map(row => row.group_name || ''));
      setUseCustomNames(!!assignment.use_custom_names);
      setDirty(false);
      setSaveState('saved');
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
        studentIds: allStudentIds,
        studentsById,
        numGroups: groups.length,
        constraints,
        useConstraints,
        lockedPlacements,
        leaderIds,
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
    const toIdx = Number(String(over.id).slice('group-'.length));
    const fromIdx = groups.findIndex(g => g.includes(active.id));
    if (fromIdx === -1 || fromIdx === toIdx) return;
    moveStudent(active.id, fromIdx, toIdx);
  };

  const latestGroupDataRef = useRef({});
  useEffect(() => {
    latestGroupDataRef.current = {
      assignmentId, name, classId, useConstraints, avoidLastN, requireLeaders,
      leaderIds, lockedIds, useCustomNames, groups, groupNames, studentsById, dirty
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
          useCustomNames: data.useCustomNames,
          groups: groupsPayload,
        }).catch(() => {});
        const pairs = buildGroupPairs(data.groups || [], data.studentsById || {});
        window.api.saveGroupHistory({ classId: data.classId, assignmentId: data.assignmentId, pairs }).catch(() => {});
      }
    };
  }, []);

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
        useCustomNames, groups: groupsPayload,
      });
      const pairs = buildGroupPairs(groups, studentsById);
      await window.api.saveGroupHistory({ classId, assignmentId, pairs });
      setDirty(false);
      setSaveState('saved');
    } catch (e) {
      setSaveState('saved');
    }
  };

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
    return <div className="flex h-full items-center justify-center text-slate-500">Laster...</div>;
  }

  if (!assignmentId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-slate-500 gap-3">
        <i className="fa-solid fa-people-group text-5xl opacity-20"></i>
        <h2 className="text-lg font-bold text-white">Fant ikke gruppeinndelingen</h2>
        <button className="btn btn-ghost btn-sm text-slate-400" onClick={onBack}>
          <i className="fa-solid fa-arrow-left"></i> Tilbake
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-base-100 overflow-hidden">
      <div className="px-4 py-2 bg-base-200 border-b border-slate-800 flex flex-wrap justify-between items-center gap-x-4 gap-y-2 z-20 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <button className="btn btn-ghost btn-xs text-slate-400 hover:text-white gap-1 flex-shrink-0" onClick={handleBack}>
            <i className="fa-solid fa-arrow-left"></i> Tilbake
          </button>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            className="input input-ghost text-sm font-bold bg-surface-field border border-slate-700 focus:border-fuchsia-400 px-3 h-8 rounded text-white w-40"
          />
          <span className="text-xs font-bold uppercase opacity-50 text-slate-400 flex-shrink-0">{className}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {dirty && (
            <span className="text-amber-400 opacity-80 text-xs font-semibold">Ulagrede endringer</span>
          )}
          {saveState === 'saving' ? (
            <span className="text-amber-400 opacity-80 text-xs font-semibold flex items-center gap-1">
              <i className="fa-solid fa-spinner fa-spin"></i> Lagrer...
            </span>
          ) : !dirty && (
            <span className="text-[#34d399] text-xs font-semibold flex items-center gap-1">
              <i className="fa-solid fa-circle-check text-[#34d399]"></i> Lagret
            </span>
          )}
          <button
            className={`btn btn-sm gap-2 ${useCustomNames ? 'bg-fuchsia-500/20 text-fuchsia-300 border-none hover:bg-fuchsia-500/30' : 'btn-outline border-slate-700 text-slate-300 hover:bg-slate-800'}`}
            onClick={toggleCustomNames}
            title="Bytt mellom nummererte og egendefinerte gruppenavn"
          >
            <i className="fa-solid fa-pen"></i> Egendefinerte navn
          </button>
          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 hover:bg-slate-800 gap-2" onClick={addGroup}>
            <i className="fa-solid fa-plus"></i> Legg til gruppe
          </button>
          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 hover:bg-slate-800 gap-2" onClick={handleRegenerate} disabled={regenerating}>
            <i className={`fa-solid fa-shuffle ${regenerating ? 'fa-spin' : ''}`}></i> Generer på nytt
          </button>
          <button className="btn btn-sm btn-ghost text-slate-400 hover:text-white gap-2" onClick={() => setShowPrintPreview(true)}>
            <i className="fa-solid fa-print"></i> Skriv ut / PDF
          </button>
          <button className="btn btn-sm bg-fuchsia-500/20 text-fuchsia-300 border-none hover:bg-fuchsia-500/30 gap-2" onClick={handleSave}>
            <i className="fa-solid fa-floppy-disk"></i> Lagre
          </button>
          <button className="btn btn-ghost text-red-400 hover:bg-red-950/40 btn-xs" onClick={() => document.getElementById('modal_delete_group_assignment')?.showModal()}>
            <i className="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(220px, 1fr))` }}>
            {groups.map((studentIds, idx) => {
              const color = GROUP_COLORS[idx % GROUP_COLORS.length];
              return (
                <GroupPanel key={idx} idx={idx} color={color}>
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ backgroundColor: `${color}22`, borderBottom: `2px solid ${color}` }}>
                    {useCustomNames ? (
                      <input
                        type="text"
                        value={groupNames[idx] || ''}
                        onChange={(e) => updateGroupName(idx, e.target.value)}
                        placeholder={`Gruppe ${idx + 1}`}
                        className="font-bold text-sm bg-transparent border-b border-transparent hover:border-slate-600 focus:border-current focus:outline-none min-w-0 flex-1"
                        style={{ color }}
                      />
                    ) : (
                      <span className="font-bold text-sm" style={{ color }}>Gruppe {idx + 1}</span>
                    )}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-400">{studentIds.length} elever</span>
                      {studentIds.length === 0 && groups.length > 1 && (
                        <button
                          className="text-slate-400 hover:text-red-400 transition-colors"
                          title="Fjern tom gruppe"
                          onClick={() => removeGroup(idx)}
                        >
                          <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-2 flex flex-col gap-1.5 flex-1">
                    {studentIds.length === 0 && (
                      <p className="text-xs text-slate-500 italic text-center py-3">Ingen elever</p>
                    )}
                    {studentIds.map(sid => {
                      const student = studentsById[sid];
                      if (!student) return null;
                      return (
                        <StudentCard
                          key={sid}
                          sid={sid}
                          student={student}
                          isLeader={leaderIds.includes(sid)}
                          isLocked={lockedIds.includes(sid)}
                          onContextMenu={(e) => handleStudentContextMenu(e, sid, idx)}
                        />
                      );
                    })}
                  </div>
                </GroupPanel>
              );
            })}
          </div>
        </div>
        <DragOverlay>
          {activeDragId ? (
            <div className="bg-surface-field rounded-lg px-2.5 py-1.5 shadow-2xl border border-fuchsia-400 text-sm text-slate-100 flex items-center gap-1.5">
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
        setGroupLeader={setGroupLeader}
        removeGroupLeader={removeGroupLeader}
        toggleLock={toggleLock}
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
        <div className="modal-box bg-surface-raised border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-lg text-red-400 flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation"></i> Slett gruppeinndeling?
          </h3>
          <p className="py-4 text-sm text-slate-300">Er du helt sikker på at du vil slette <strong>{name}</strong>? Historikken for denne inndelingen forsvinner også.</p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2 hover:bg-slate-800">Avbryt</button>
            </form>
            <button className="btn btn-error" onClick={handleDelete}>Ja, slett</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function StudentCard({ sid, student, isLeader, isLocked, onContextMenu }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: sid });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onContextMenu={onContextMenu}
      className="flex items-center justify-between gap-2 bg-surface-field rounded-lg px-2.5 py-1.5 cursor-grab select-none touch-none"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <span className="text-sm text-slate-200 truncate flex items-center gap-1.5">
        {isLeader && <i className="fa-solid fa-star text-amber-400 text-[10px]"></i>}
        {student.name}
      </span>
      {isLocked && <i className="fa-solid fa-lock text-red-400 text-[10px]" title="Låst"></i>}
    </div>
  );
}

function GroupPanel({ idx, color, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-${idx}` });
  return (
    <div
      ref={setNodeRef}
      className={`bg-base-200 border rounded-2xl overflow-hidden flex flex-col transition-colors ${isOver ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/30' : 'border-slate-800'}`}
    >
      {children}
    </div>
  );
}
