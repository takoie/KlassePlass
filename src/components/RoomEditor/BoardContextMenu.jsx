import React, { useLayoutEffect, useRef, useState } from 'react';

/** Høyreklikk-meny på tavlen: sentrer tavleboksen på canvasets x-akse. */
export default function BoardContextMenu({ contextMenu, setContextMenu, centerBoardX }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) { setPos(null); return; }
    const margin = 8;
    const { offsetWidth: w, offsetHeight: h } = menuRef.current;
    let top = contextMenu.mouseY;
    let left = contextMenu.mouseX;
    if (top + h > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - h - margin);
    if (left + w > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - w - margin);
    setPos({ top, left });
  }, [contextMenu]);

  if (!contextMenu) return null;

  const style = pos
    ? { top: pos.top, left: pos.left }
    : { top: contextMenu.mouseY, left: contextMenu.mouseX, visibility: 'hidden' };

  return (
    <ul
      ref={menuRef}
      className="menu bg-surface-raised border border-slate-700 rounded-2xl shadow-2xl fixed z-50 p-2 text-xs text-slate-200 w-56"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <li><a onClick={() => { centerBoardX(); setContextMenu(null); }}><i className="fa-solid fa-align-center text-[#f59e0b]"></i> Sentrer på x-akse</a></li>
    </ul>
  );
}
