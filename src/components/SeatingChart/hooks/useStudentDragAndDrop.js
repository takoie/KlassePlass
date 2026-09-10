import { useState, useRef, useEffect } from 'react';
import { getDeskLayout, slotIndexAtPointerX } from '../deskLayout';

// Hvor langt (i skjerm-piksler) pekeren må ha flyttet seg fra der draget startet
// før et slipp «på gulvet» tolkes som "fjern eleven" – hindrer at et rent klikk
// på en plassert elev fjerner vedkommende ved uhell.
const REMOVE_DRAG_THRESHOLD = 20;

// Drag-and-drop av elever mellom seteplasser og elevskuffen (venstre kant).
export function useStudentDragAndDrop({
  canvasRef, scale, desks, placements, setPlacements,
  unplacedStudents, setUnplacedStudents, getStudentByIdOrName,
  unusedSeats, setUnusedSeats
}) {
  const [draggedStudent, setDraggedStudent] = useState(null);
  const [hoverSlotKey, setHoverSlotKey] = useState(null);
  const [overDrawer, setOverDrawer] = useState(false);

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
      currentY,
      pointerX: e.clientX,
      pointerY: e.clientY,
      startClientX: e.clientX,
      startClientY: e.clientY,
    });
  };

  const isPointOverDrawer = (clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY);
    return !!el?.closest?.('[data-drawer-dropzone]');
  };

  const handleMouseMove = (e) => {
    if (!draggedStudent) return false;
    if (!canvasRef.current) return true;
    const rect = canvasRef.current.getBoundingClientRect();
    const studentCurX = (e.clientX - rect.left) / scale - draggedStudent.offsetX;
    const studentCurY = (e.clientY - rect.top) / scale - draggedStudent.offsetY;

    setDraggedStudent(prev => prev && ({
      ...prev,
      currentX: studentCurX,
      currentY: studentCurY,
      pointerX: e.clientX,
      pointerY: e.clientY,
    }));

    const onDrawer = isPointOverDrawer(e.clientX, e.clientY);
    setOverDrawer(onDrawer);

    // Calculate hover target desk slot for clear visual highlight
    const cx = studentCurX + 50;
    const cy = studentCurY + 20;
    let targetKey = null;

    if (!onDrawer) {
      for (let d of desks) {
        // Bruk KOLLAPSET bord-geometri (samme som render), ellers peker
        // treff-boksen på de gamle koordinatene der setene lå før kollapsen.
        const layout = getDeskLayout(d, placements, unusedSeats);
        if (cx >= d.x && cx <= (d.x + layout.width) && cy >= d.y && cy <= (d.y + 60)) {
          const slotIdx = slotIndexAtPointerX(layout, d.x, cx);
          if (slotIdx == null) break; // helt kollapset bord – ingen sete å treffe
          const key = `${d.id}_seat_${slotIdx}`;
          // Håndskjulte (tomme "ubrukt"-merkede) plasser er ikke gyldige mål – de
          // vises ikke under draget, så de skal heller ikke få "Slipp her"-highlight.
          targetKey = (unusedSeats?.[key] && !placements[key]) ? null : key;
          break;
        }
      }
    }
    setHoverSlotKey(targetKey);
    return true;
  };

  const handleMouseUp = () => {
    if (!draggedStudent) return false;

    const { studentObj, fromSlotKey, currentX, currentY, pointerX, pointerY, startClientX, startClientY } = draggedStudent;
    const cx = currentX + 50;
    const cy = currentY + 20;

    const movedDist = (pointerX != null && startClientX != null)
      ? Math.hypot(pointerX - startClientX, pointerY - startClientY)
      : Infinity;

    const droppedOnDrawer = pointerX != null && isPointOverDrawer(pointerX, pointerY);

    let targetSlotKey = null;
    if (!droppedOnDrawer && canvasRef.current) {
      for (let d of desks) {
        // Samme kollapset geometri som render + handleMouseMove.
        const layout = getDeskLayout(d, placements, unusedSeats);
        if (cx >= d.x && cx <= (d.x + layout.width) && cy >= d.y && cy <= (d.y + 60)) {
          const slotIdx = slotIndexAtPointerX(layout, d.x, cx);
          if (slotIdx == null) break;
          const key = `${d.id}_seat_${slotIdx}`;
          // Håndskjulte (tomme "ubrukt"-merkede) plasser er ikke gyldige slippmål.
          targetSlotKey = (unusedSeats?.[key] && !placements[key]) ? null : key;
          break;
        }
      }
    }

    let newPlacements = { ...placements };
    let newUnplaced = [...unplacedStudents];

    const returnToDrawer = () => {
      if (fromSlotKey) delete newPlacements[fromSlotKey];
      if (!newUnplaced.some(s => s.id === studentObj.id || s.name === studentObj.name)) {
        newUnplaced.push(studentObj);
      }
    };

    if (droppedOnDrawer) {
      // Sluppet over elevskuffen – ta eleven av bordet og legg tilbake i skuffen.
      returnToDrawer();
    } else if (targetSlotKey) {
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

      // Manuell plassering på et sete markert "ubrukt" overstyrer merkingen - setet
      // er nå tydelig i bruk, i stedet for å blokkere den manuelle handlingen.
      if (unusedSeats?.[targetSlotKey] && setUnusedSeats) {
        setUnusedSeats(prev => {
          const next = { ...prev };
          delete next[targetSlotKey];
          return next;
        });
      }
    } else if (fromSlotKey && (movedDist > REMOVE_DRAG_THRESHOLD || cx < -50)) {
      // En plassert elev som dras vekk fra setet og slippes et sted som ikke er
      // et gyldig sete (gulvet, verktøymenyen, lukket skuff …) tolkes som "fjern
      // eleven fra kartet". Terskelen hindrer at et rent klikk fjerner noen.
      returnToDrawer();
    } else {
      // Elev fra skuffen som bommet på et sete, eller et sub-terskel-klikk –
      // smetter bare tilbake (vi endrer ingenting).
    }

    setPlacements(newPlacements);
    setUnplacedStudents(newUnplaced);
    setDraggedStudent(null);
    setHoverSlotKey(null);
    setOverDrawer(false);
    return true;
  };

  // Under et aktivt drag lytter vi på HELE vinduet, ikke bare lerretet – slik at
  // eleven følger musa jevnt også når pekeren er over skuffen/verktøymenyen, og
  // draget ikke avbrytes bare fordi pekeren forlot lerretet.
  const handlersRef = useRef({});
  handlersRef.current.move = handleMouseMove;
  handlersRef.current.up = handleMouseUp;
  const isDragging = !!draggedStudent;
  useEffect(() => {
    if (!isDragging) return;
    const mm = (e) => handlersRef.current.move(e);
    const mu = (e) => handlersRef.current.up(e);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
    };
  }, [isDragging]);

  return { draggedStudent, hoverSlotKey, overDrawer, startDrag, handleMouseMove, handleMouseUp };
}
