import { useState, useRef, useEffect } from 'react';
import { findFreeGroupOffset, findFreeSpot } from '../geometry';

// Utvalg av pulter (klikk, boks-utvalg, kontekstmeny), samt utklippstavle
// (kopier/lim inn/dupliser) og tastatursnarveier knyttet til utvalget.
export function useDeskSelection({ desks, setDesks, canvasRef, scale, createGroupForSelected }) {
  const [selectedDesks, setSelectedDesks] = useState([]);
  const [selectionBox, setSelectionBox] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const clipboardRef = useRef(null);
  const lastMousePosRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleCanvasMouseDown = (e) => {
    if (e.target !== canvasRef.current && e.target.closest('.desk-item, .board-item')) return;
    if (e.button === 2) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / scale;
    const startY = (e.clientY - rect.top) / scale;
    setSelectionBox({ startX, startY, currentX: startX, currentY: startY });
    if (!e.shiftKey) setSelectedDesks([]);
  };

  const handleMouseMoveCanvas = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / scale;
    const currentY = (e.clientY - rect.top) / scale;
    lastMousePosRef.current = { x: currentX, y: currentY };

    if (!selectionBox) return;

    setSelectionBox(prev => ({
      ...prev,
      currentX,
      currentY
    }));

    const minX = Math.min(selectionBox.startX, currentX);
    const maxX = Math.max(selectionBox.startX, currentX);
    const minY = Math.min(selectionBox.startY, currentY);
    const maxY = Math.max(selectionBox.startY, currentY);

    const newSelected = desks.filter(d => {
      const dW = (d.capacity || 1) * 100;
      const cx = d.x + dW / 2;
      const cy = d.y + 30;
      return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
    }).map(d => d.id);

    setSelectedDesks(newSelected);
  };

  const handleCanvasMouseUp = () => {
    setSelectionBox(null);
  };

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedDesks.includes(item.id)) {
      setSelectedDesks([item.id]);
    }

    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY });
  };

  const handleDeskClick = (e, item) => {
    e.stopPropagation();
    if (e.shiftKey) {
      if (selectedDesks.includes(item.id)) {
        setSelectedDesks(selectedDesks.filter(id => id !== item.id));
      } else {
        setSelectedDesks([...selectedDesks, item.id]);
      }
    } else {
      setSelectedDesks([item.id]);
    }
  };

  const handleDeleteSelected = () => {
    setDesks(desks.filter(d => !selectedDesks.includes(d.id)));
    setSelectedDesks([]);
    setContextMenu(null);
  };

  // Plasserer en batch med nye bord (dupliser eller lim inn) uten å overlappe
  // eksisterende bord. Prøver først å beholde hele gruppens formasjon ved å
  // flytte alle sammen til samme ledige offset; faller tilbake til å plassere
  // hvert bord for seg (kan bryte formasjonen) kun i svært tette rom.
  const placeDeskBatch = (sourceDesks, startDx, startDy) => {
    const groupOffset = findFreeGroupOffset({ desks: sourceDesks, existingDesks: desks, startDx, startDy });

    if (groupOffset) {
      return sourceDesks.map(d => ({
        ...d,
        id: Date.now() + Math.random().toString(),
        x: d.x + groupOffset.dx,
        y: d.y + groupOffset.dy
      }));
    }

    const placed = [];
    sourceDesks.forEach(d => {
      const spot = findFreeSpot({
        capacity: d.capacity || 1,
        existingDesks: [...desks, ...placed],
        anchor: { x: d.x + startDx, y: d.y + startDy }
      });
      placed.push({ ...d, id: Date.now() + Math.random().toString(), x: spot.x, y: spot.y });
    });
    return placed;
  };

  const handleDuplicateSelected = () => {
    const toDuplicate = desks.filter(d => selectedDesks.includes(d.id));
    if (toDuplicate.length === 0) return;
    const newDesks = placeDeskBatch(toDuplicate, 20, 20);
    setDesks([...desks, ...newDesks]);
    setSelectedDesks(newDesks.map(d => d.id));
    setContextMenu(null);
  };

  const pasteClipboard = () => {
    const clip = clipboardRef.current;
    if (!clip || clip.length === 0) return;

    const minX = Math.min(...clip.map(d => d.x));
    const minY = Math.min(...clip.map(d => d.y));
    const maxX = Math.max(...clip.map(d => d.x + (d.capacity || 1) * 100));
    const maxY = Math.max(...clip.map(d => d.y + 60));
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;

    const target = lastMousePosRef.current || { x: 550, y: 350 };
    const startDx = Math.round(target.x - bboxCenterX);
    const startDy = Math.round(target.y - bboxCenterY);

    const pasted = placeDeskBatch(clip, startDx, startDy).map(d => ({ ...d, groupId: null }));
    setDesks(prev => [...prev, ...pasted]);
    setSelectedDesks(pasted.map(d => d.id));
  };

  const handleKeyDown = (e) => {
    const isTextInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable;
    if (isTextInput) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      if (selectedDesks.length > 0) {
        clipboardRef.current = desks.filter(d => selectedDesks.includes(d.id)).map(d => ({ ...d }));
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      if (clipboardRef.current?.length) {
        pasteClipboard();
      }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedDesks.length > 0) {
        setDesks(desks.filter(d => !selectedDesks.includes(d.id)));
        setSelectedDesks([]);
      }
    } else if (e.key === 'Enter') {
      if (selectedDesks.length > 0) {
        createGroupForSelected();
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDesks, desks]);

  return {
    selectedDesks, setSelectedDesks,
    selectionBox, contextMenu, setContextMenu,
    handleCanvasMouseDown, handleMouseMoveCanvas, handleCanvasMouseUp,
    handleContextMenu, handleDeskClick,
    handleDeleteSelected, handleDuplicateSelected
  };
}
