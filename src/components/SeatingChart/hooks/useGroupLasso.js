import { useState } from 'react';

// Lasso-basert gruppetildeling: mens en gruppefarge er valgt (`activeGroupId`),
// tegner læreren en boks rundt bord som skal få (eller miste, ved gruppe 0)
// den fargen i `groupOverrides`. `handleMouseMove`/`handleMouseUp` returnerer
// `true` når de faktisk håndterte eventet, slik at den kombinerte
// mouse-handleren i SeatingChart vet om den skal falle videre til elev-draget.
export function useGroupLasso({ desks, canvasRef, scale }) {
  const [groupOverrides, setGroupOverrides] = useState({});
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [lasso, setLasso] = useState(null);

  const startCanvasAction = (e) => {
    if (e.button === 2) return;
    if (activeGroupId !== null) {
      e.preventDefault();
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / scale;
      const cy = (e.clientY - rect.top) / scale;
      setLasso({ startX: cx, startY: cy, currentX: cx, currentY: cy });
    }
  };

  const handleMouseMove = (e) => {
    if (activeGroupId === null || !lasso) return false;
    if (!canvasRef.current) return true;
    const rect = canvasRef.current.getBoundingClientRect();
    setLasso(prev => ({
      ...prev,
      currentX: (e.clientX - rect.left) / scale,
      currentY: (e.clientY - rect.top) / scale
    }));
    return true;
  };

  const handleMouseUp = () => {
    if (activeGroupId === null || !lasso) return false;

    const minX = Math.min(lasso.startX, lasso.currentX);
    const maxX = Math.max(lasso.startX, lasso.currentX);
    const minY = Math.min(lasso.startY, lasso.currentY);
    const maxY = Math.max(lasso.startY, lasso.currentY);

    const newOverrides = { ...groupOverrides };
    desks.forEach(d => {
      const deskW = (d.capacity || 1) * 100;
      const deskH = 60;
      // Sjekk om bordet overlapper med lasso
      if (d.x < maxX && (d.x + deskW) > minX && d.y < maxY && (d.y + deskH) > minY) {
        if (activeGroupId === 0) {
          delete newOverrides[d.id];
        } else {
          newOverrides[d.id] = activeGroupId;
        }
      }
    });
    setGroupOverrides(newOverrides);
    setLasso(null);
    return true;
  };

  return {
    groupOverrides, setGroupOverrides,
    activeGroupId, setActiveGroupId,
    lasso,
    startCanvasAction, handleMouseMove, handleMouseUp
  };
}
