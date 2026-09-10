import React from 'react';

/**
 * Skuff med uplasserte elever: dra herfra og ut på et bord for å plassere,
 * eller dra en elev fra et bord og hit for å ta vedkommende av kartet igjen.
 * Hele skuffen er dropsone (`data-drawer-dropzone`, se useStudentDragAndDrop).
 * Elev-boksene har samme uttrykk som boksen som følger musa under et drag.
 */
export default function StudentDrawer({ showStudentDrawer, setShowStudentDrawer, unplacedStudents, startDrag, overDrawer }) {
  return (
    <div
      data-drawer-dropzone
      className={`bg-surface-raised border-base-300 flex flex-col z-[49] transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${showStudentDrawer ? 'w-64 border-r' : 'w-0 border-r-0'} ${overDrawer ? 'ring-2 ring-inset ring-emerald-400/70' : ''}`}
    >
      <div className="px-4 py-3 border-b border-base-300 flex justify-between items-center bg-base-200 whitespace-nowrap min-w-[16rem]">
        <h3 className="text-sm font-bold text-base-content flex items-center gap-2">
          <i className="fa-solid fa-users text-success"></i> Elever ({unplacedStudents.length})
        </h3>
        <button className="btn btn-ghost btn-xs btn-square hover:bg-base-200 text-base-content/60" onClick={() => setShowStudentDrawer(false)}>
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2.5 bg-surface-raised min-w-[16rem]">
        {unplacedStudents.length === 0 ? (
          <div className="text-center opacity-50 text-xs text-base-content/60 p-4 font-semibold mt-10">
            <i className="fa-solid fa-check-circle text-2xl mb-2 text-emerald-500 block"></i>
            Alle elever er plassert!
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {unplacedStudents.map(student => (
              <div
                key={student.id}
                className="h-[52px] rounded-xl border-2 border-emerald-500 bg-base-200 p-1 shadow-[0_0_16px_rgba(16,185,129,0.25)] cursor-grab active:cursor-grabbing transition-transform hover:scale-[1.04] select-none"
                onMouseDown={(e) => startDrag(e, student, null)}
              >
                <div className="w-full h-full rounded-lg flex items-center justify-center bg-emerald-500/20 text-base-content border border-emerald-500/40 text-[13px] font-bold text-center leading-tight px-1 shadow-md">
                  <span className="line-clamp-2 break-words">{student.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
