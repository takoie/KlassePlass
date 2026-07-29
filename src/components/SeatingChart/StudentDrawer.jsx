import React from 'react';

/** Skuff med uplasserte elever, dratt fra her og over på et bord. */
export default function StudentDrawer({ showStudentDrawer, setShowStudentDrawer, unplacedStudents, startDrag }) {
  return (
    <div className={`bg-surface-raised border-slate-800 flex flex-col z-[49] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${showStudentDrawer ? 'w-64 border-r' : 'w-0 border-r-0'}`}>
      <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-base-200 whitespace-nowrap min-w-[16rem]">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <i className="fa-solid fa-users text-emerald-400"></i> Elever ({unplacedStudents.length})
        </h3>
        <button className="btn btn-ghost btn-xs btn-square hover:bg-slate-800 text-slate-400" onClick={() => setShowStudentDrawer(false)}>
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 bg-surface-raised min-w-[16rem]">
        {unplacedStudents.length === 0 ? (
          <div className="text-center opacity-50 text-xs text-slate-400 p-4 font-semibold mt-10">
            <i className="fa-solid fa-check-circle text-2xl mb-2 text-emerald-500 block"></i>
            Alle elever er plassert!
          </div>
        ) : (
          unplacedStudents.map(student => (
            <div
              key={student.id}
              className="p-2.5 bg-base-100 hover:bg-[#34d399] hover:text-slate-950 text-sm font-bold rounded-lg cursor-move flex items-center shadow-sm transition-colors text-slate-200 border border-slate-700/50"
              onMouseDown={(e) => startDrag(e, student, null)}
            >
              <span className="truncate">{student.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
