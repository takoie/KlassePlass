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
  const canDrag = interactive && zoom > 1;

  const handleMouseDown = (e) => {
    if (!canDrag) return;
    // Uten dette starter nettleseren tekstmarkering samtidig som man drar (innholdet
    // er tekst/tabeller for stasjon/gruppe-print), noe som "spiser" mousemove-eventene
    // og gjør at panoreringen ser ut som den ikke fungerer i det hele tatt.
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
        // Klipper kun når læreren faktisk har zoomet inn (bevisst utsnitt). Ved zoom=1
        // (standard) er dette bare et estimert boksmål — å klippe der ville usynlig
        // kappe innhold hver gang det virkelige, oppløste innholdet (tabell/liste) blir
        // litt høyere enn det statiske estimatet tilsier.
        position: 'relative', width, height, overflow: zoom > 1 ? 'hidden' : 'visible', background: '#fff',
        cursor: canDrag ? 'grab' : 'default', userSelect: canDrag ? 'none' : 'auto',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}>
        {children}
      </div>
    </div>
  );
}
