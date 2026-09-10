import React from 'react';

/** Høyreklikk-meny på et elevkort i gruppeeditoren: sett/fjern gruppeleder, lås/lås opp. */
export default function StudentContextMenu({
  contextMenu, studentsById, leaderIds, lockedIds, excludedIds = [],
  setGroupLeader, removeGroupLeader, toggleLock, toggleExcluded, setContextMenu,
}) {
  if (!contextMenu) return null;
  const { x, y, studentId, groupIdx } = contextMenu;
  const student = studentsById[studentId];
  if (!student) return null;

  const isLeader = leaderIds.includes(studentId);
  const isLocked = lockedIds.includes(studentId);
  const isExcluded = excludedIds.includes(studentId);

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)}></div>
      <div
        className="fixed z-[9999] bg-base-200 border border-base-300 shadow-2xl rounded-xl w-56 overflow-hidden flex flex-col"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 bg-base-100 border-b border-base-300 text-xs font-bold text-base-content/80 truncate">
          {student.name}
        </div>

        <button
          className="px-4 py-2.5 text-left text-sm hover:bg-surface-field text-base-content flex items-center gap-2 transition-colors"
          onClick={() => {
            if (isLeader) removeGroupLeader(studentId);
            else setGroupLeader(studentId, groupIdx);
            setContextMenu(null);
          }}
        >
          <i className={`fa-solid fa-star ${isLeader ? 'text-base-content/50' : 'text-amber-400'} w-4`}></i>
          {isLeader ? 'Fjern som gruppeleder' : 'Gjør til gruppeleder'}
        </button>

        <button
          className="px-4 py-2.5 text-left text-sm hover:bg-surface-field text-base-content flex items-center gap-2 transition-colors border-t border-base-300/50"
          onClick={() => {
            toggleLock(studentId);
            setContextMenu(null);
          }}
        >
          <i className={`fa-solid ${isLocked ? 'fa-unlock text-success' : 'fa-lock text-red-400'} w-4`}></i>
          {isLocked ? 'Lås opp elev' : 'Lås elev'}
        </button>

        {toggleExcluded && (
          <button
            className="px-4 py-2.5 text-left text-sm hover:bg-surface-field text-base-content flex items-center gap-2 transition-colors border-t border-base-300/50"
            onClick={() => {
              toggleExcluded(studentId);
              setContextMenu(null);
            }}
          >
            <i className={`fa-solid ${isExcluded ? 'fa-user-check text-success' : 'fa-user-clock text-amber-400'} w-4`}></i>
            {isExcluded ? 'Ta med i fordelingen' : 'Sett som fraværende'}
          </button>
        )}
      </div>
    </>
  );
}
