import React, { useRef } from 'react';

/**
 * Fast, klippet "vindu" rundt selve print-innholdet på en side (pulter, stasjonstabell
 * eller gruppeliste) — uavhengig av topptekst/bunntekst på arket. Samme pan/zoom-state
 * brukes for både den interaktive previewen og det faktiske print-outputet, slik at
 * det læreren ser er nøyaktig det som skrives ut.
 */
export default function RoomViewport({
  width, height, zoom, panX, panY, onPanChange, dragScale = 1, interactive = false, children,
}) {
  const dragRef = useRef(null);
  const canDrag = interactive;

  const handleMouseDown = (e) => {
    if (!canDrag) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX, panY };
  };
  const handleMouseMove = (e) => {
    if (!canDrag || !dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / dragScale;
    const dy = (e.clientY - dragRef.current.startY) / dragScale;
    onPanChange(dragRef.current.panX + dx, dragRef.current.panY + dy);
  };
  const stopDrag = () => { dragRef.current = null; };

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        overflow: zoom > 1 ? 'hidden' : 'visible',
        background: '#fff',
        cursor: canDrag ? 'grab' : 'default',
        userSelect: canDrag ? 'none' : 'auto',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transformOrigin: '50% 50%', transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}>
        {children}
      </div>
    </div>
  );
}
