import React from 'react';

/** Høyreklikk-meny på et elevkort i gruppeeditoren: sett/fjern gruppeleder, lås/lås opp. */
export default function StudentContextMenu({
  contextMenu, studentsById, leaderIds, lockedIds,
  setGroupLeader, removeGroupLeader, toggleLock, setContextMenu,
}) {
  if (!contextMenu) return null;
  const { x, y, studentId, groupIdx } = contextMenu;
  const student = studentsById[studentId];
  if (!student) return null;

  const isLeader = leaderIds.includes(studentId);
  const isLocked = lockedIds.includes(studentId);

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)}></div>
      <div
        className="fixed z-[9999] bg-base-200 border border-slate-700 shadow-2xl rounded-xl w-56 overflow-hidden flex flex-col"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 bg-base-100 border-b border-slate-700 text-xs font-bold text-slate-300 truncate">
          {student.name}
        </div>

        <button
          className="px-4 py-2.5 text-left text-sm hover:bg-surface-field text-slate-200 flex items-center gap-2 transition-colors"
          onClick={() => {
            if (isLeader) removeGroupLeader(studentId);
            else setGroupLeader(studentId, groupIdx);
            setContextMenu(null);
          }}
        >
          <i className={`fa-solid fa-star ${isLeader ? 'text-slate-500' : 'text-amber-400'} w-4`}></i>
          {isLeader ? 'Fjern som gruppeleder' : 'Gjør til gruppeleder'}
        </button>

        <button
          className="px-4 py-2.5 text-left text-sm hover:bg-surface-field text-slate-200 flex items-center gap-2 transition-colors border-t border-slate-700/50"
          onClick={() => {
            toggleLock(studentId);
            setContextMenu(null);
          }}
        >
          <i className={`fa-solid ${isLocked ? 'fa-unlock text-emerald-400' : 'fa-lock text-red-400'} w-4`}></i>
          {isLocked ? 'Lås opp elev' : 'Lås elev'}
        </button>
      </div>
    </>
  );
}
