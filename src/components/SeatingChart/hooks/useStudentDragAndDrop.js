import { useState } from 'react';

// Drag-and-drop av elever mellom seteplasser og elevskuffen (venstre kant).
export function useStudentDragAndDrop({
  canvasRef, scale, desks, placements, setPlacements,
  unplacedStudents, setUnplacedStudents, getStudentByIdOrName
}) {
  const [draggedStudent, setDraggedStudent] = useState(null);
  const [hoverSlotKey, setHoverSlotKey] = useState(null);

  const startDrag = (e, studentObj, fromSlotKey = null) => {
    if (e.button === 2) return;
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    let currentX = (e.clientX - rect.left) / scale - 50;
    let currentY = (e.clientY - rect.top) / scale - 20;

    setDraggedStudent({
      studentObj,
      fromSlotKey,
      offsetX: 50,
      offsetY: 20,
      currentX,
      currentY
    });
  };

  const handleMouseMove = (e) => {
    if (!draggedStudent) return false;
    if (!canvasRef.current) return true;
    const rect = canvasRef.current.getBoundingClientRect();
    const studentCurX = (e.clientX - rect.left) / scale - draggedStudent.offsetX;
    const studentCurY = (e.clientY - rect.top) / scale - draggedStudent.offsetY;

    setDraggedStudent(prev => ({
      ...prev,
      currentX: studentCurX,
      currentY: studentCurY
    }));

    // Calculate hover target desk slot for clear visual highlight
    const cx = studentCurX + 50;
    const cy = studentCurY + 20;
    let targetKey = null;

    for (let d of desks) {
      const cap = d.capacity || 1;
      const deskW = cap * 100;
      if (cx >= d.x && cx <= (d.x + deskW) && cy >= d.y && cy <= (d.y + 60)) {
        const slotIdx = Math.min(cap - 1, Math.max(0, Math.floor((cx - d.x) / 100)));
        targetKey = `${d.id}_seat_${slotIdx}`;
        break;
      }
    }
    setHoverSlotKey(targetKey);
    return true;
  };

  const handleMouseUp = () => {
    if (!draggedStudent) return false;
    if (!canvasRef.current) { setDraggedStudent(null); return true; }

    const { studentObj, fromSlotKey, currentX, currentY } = draggedStudent;
    const cx = currentX + 50;
    const cy = currentY + 20;

    let targetSlotKey = null;

    for (let d of desks) {
      const cap = d.capacity || 1;
      const deskW = cap * 100;
      if (cx >= d.x && cx <= (d.x + deskW) && cy >= d.y && cy <= (d.y + 60)) {
        const slotW = 100;
        const relativeX = cx - d.x;
        const slotIdx = Math.min(cap - 1, Math.max(0, Math.floor(relativeX / slotW)));
        targetSlotKey = `${d.id}_seat_${slotIdx}`;
        break;
      }
    }

    let newPlacements = { ...placements };
    let newUnplaced = [...unplacedStudents];

    if (targetSlotKey) {
      if (fromSlotKey) delete newPlacements[fromSlotKey];
      else newUnplaced = newUnplaced.filter(s => s.id !== studentObj.id && s.name !== studentObj.name);

      const existingVal = newPlacements[targetSlotKey];
      if (existingVal) {
        const existingObj = getStudentByIdOrName(existingVal);
        if (existingObj) {
          if (fromSlotKey) newPlacements[fromSlotKey] = existingObj.id;
          else newUnplaced.push(existingObj);
        }
      }
      newPlacements[targetSlotKey] = studentObj.id;
    } else if (cx < -50) {
      // Dratt ut til venstre (over elevskuffen eller verktøymenyen)
      if (fromSlotKey) {
        delete newPlacements[fromSlotKey];
        if (!newUnplaced.some(s => s.id === studentObj.id)) newUnplaced.push(studentObj);
      }
    } else {
      // Sluppet på gulvet - smetter bare tilbake (vi endrer ingenting)
    }

    setPlacements(newPlacements);
    setUnplacedStudents(newUnplaced);
    setDraggedStudent(null);
    setHoverSlotKey(null);
    return true;
  };

  return { draggedStudent, hoverSlotKey, startDrag, handleMouseMove, handleMouseUp };
}
