import React, { useState, useEffect } from 'react';
import { normalizeStudents } from '../shared/utils';
import { generateGroups, buildGroupPairs } from '../shared/groupRandomizer';
import StudentContextMenu from './GroupWork/StudentContextMenu';

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
  const [studentsById, setStudentsById] = useState({});
  const [allStudentIds, setAllStudentIds] = useState([]);
  const [constraints, setConstraints] = useState([]);
  const [groups, setGroups] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState('saved');
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => { loadAssignment(); }, [initialId]);

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

  const handleSave = async () => {
    if (!assignmentId) return;
    setSaveState('saving');
    try {
      const groupsPayload = groups.map((studentIds, i) => ({ groupNumber: i + 1, studentIds }));
      await window.api.saveGroupAssignment({
        id: assignmentId, name: name.trim() || 'Uten navn', classId,
        sourceSeatingId: null, useConstraints, avoidLastN, requireLeaders, leaderIds, lockedIds,
        groups: groupsPayload,
      });
      const pairs = buildGroupPairs(groups, studentsById);
      await window.api.saveGroupHistory({ classId, assignmentId, pairs });
      setDirty(false);
      setSaveState('saved');
    } catch (e) {
      setSaveState('saved');
    }
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
    <div className="flex flex-col h-full w-full bg-[#202534] overflow-hidden">
      <div className="px-4 py-2 bg-[#1a1e2b] border-b border-slate-800 flex flex-wrap justify-between items-center gap-x-4 gap-y-2 z-20 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <button className="btn btn-ghost btn-xs text-slate-400 hover:text-white gap-1 flex-shrink-0" onClick={onBack}>
            <i className="fa-solid fa-arrow-left"></i> Tilbake
          </button>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            className="input input-ghost text-sm font-bold bg-[#262b3a] border border-slate-700 focus:border-fuchsia-400 px-3 h-8 rounded text-white w-40"
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
          <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 hover:bg-slate-800 gap-2" onClick={handleRegenerate} disabled={regenerating}>
            <i className={`fa-solid fa-shuffle ${regenerating ? 'fa-spin' : ''}`}></i> Generer på nytt
          </button>
          <button className="btn btn-sm bg-fuchsia-500/20 text-fuchsia-300 border-none hover:bg-fuchsia-500/30 gap-2" onClick={handleSave}>
            <i className="fa-solid fa-floppy-disk"></i> Lagre
          </button>
          <button className="btn btn-ghost text-red-400 hover:bg-red-950/40 btn-xs" onClick={() => document.getElementById('modal_delete_group_assignment')?.showModal()}>
            <i className="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(220px, 1fr))` }}>
          {groups.map((studentIds, idx) => {
            const color = GROUP_COLORS[idx % GROUP_COLORS.length];
            return (
              <div key={idx} className="bg-[#1a1e2b] border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: `${color}22`, borderBottom: `2px solid ${color}` }}>
                  <span className="font-bold text-sm" style={{ color }}>Gruppe {idx + 1}</span>
                  <span className="text-xs text-slate-400">{studentIds.length} elever</span>
                </div>
                <div className="p-2 flex flex-col gap-1.5 flex-1">
                  {studentIds.length === 0 && (
                    <p className="text-xs text-slate-500 italic text-center py-3">Ingen elever</p>
                  )}
                  {studentIds.map(sid => {
                    const student = studentsById[sid];
                    if (!student) return null;
                    const isLeader = leaderIds.includes(sid);
                    const isLocked = lockedIds.includes(sid);
                    return (
                      <div
                        key={sid}
                        onContextMenu={(e) => handleStudentContextMenu(e, sid, idx)}
                        className="flex items-center justify-between gap-2 bg-[#262b3a] rounded-lg px-2.5 py-1.5 cursor-grab select-none"
                      >
                        <span className="text-sm text-slate-200 truncate flex items-center gap-1.5">
                          {isLeader && <i className="fa-solid fa-star text-amber-400 text-[10px]"></i>}
                          {student.name}
                        </span>
                        {isLocked && <i className="fa-solid fa-lock text-red-400 text-[10px]" title="Låst"></i>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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

      <dialog id="modal_delete_group_assignment" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-[#171a25] border border-slate-700 text-slate-100 rounded-2xl">
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
