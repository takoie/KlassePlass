import { useRef, useEffect } from 'react';
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { computeBoundedDelta, findOverlappingDeskIds } from '../geometry';

// All drag-and-drop-/magnetisk snapping-logikk for pulter og tavle på
// RoomEditor-canvaset: dnd-kit-modifier for live-forhåndsvisning under drag,
// og commit av sluttposisjon ved slipp.
export function useDeskDragAndDrop({ desks, setDesks, selectedDesks, setBoardObj, scale }) {
  const desksRef = useRef(desks);
  const selectedDesksRef = useRef(selectedDesks);
  const isDraggingRef = useRef(false);
  const preOverlappingIdsRef = useRef([]);
  const altKeyRef = useRef(false);
  const lastDeskDragResultRef = useRef(null);
  const lastSnapTargetIdRef = useRef(null);

  useEffect(() => { desksRef.current = desks; }, [desks]);
  useEffect(() => { selectedDesksRef.current = selectedDesks; }, [selectedDesks]);

  useEffect(() => {
    const onAltDown = (e) => { if (e.key === 'Alt') altKeyRef.current = true; };
    const onAltUp = (e) => { if (e.key === 'Alt') altKeyRef.current = false; };
    const onBlur = () => { altKeyRef.current = false; }; // f.eks. alt-tab bort fra vinduet
    window.addEventListener('keydown', onAltDown);
    window.addEventListener('keyup', onAltUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onAltDown);
      window.removeEventListener('keyup', onAltUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const getBoundedDelta = (movingDesks, rawDx, rawDy, stationaryDesks, options = {}) => {
    const result = computeBoundedDelta({
      movingDesks, rawDx, rawDy, stationaryDesks,
      skipSnap: options.skipSnap || false,
      ignoreOverlapIds: options.ignoreOverlapIds || [],
      preferredTargetId: options.preferredTargetId || null
    });

    return {
      x: result.dx,
      y: result.dy,
      targetDeskIds: result.targetDeskIds,
      alignmentGuides: result.alignmentGuides
    };
  };

  const snapToDesksModifier = ({ transform, active }) => {
    if (!isDraggingRef.current || !active?.data?.current) return transform;
    const rawDx = transform.x / scale;
    const rawDy = transform.y / scale;

    if (active.data.current.type !== 'desk') {
       return {
         ...transform,
         x: Math.round(rawDx / 10) * 10,
         y: Math.round(rawDy / 10) * 10
       };
    }

    const draggedDeskId = active.id;
    const isPartOftMultiSelection = selectedDesksRef.current.includes(draggedDeskId);
    const desksToMoveIds = isPartOftMultiSelection ? selectedDesksRef.current : [draggedDeskId];

    const movingDesksObjs = desksRef.current.filter(d => desksToMoveIds.includes(d.id));
    if (movingDesksObjs.length === 0) return transform;
    const stationary = desksRef.current.filter(d => !desksToMoveIds.includes(d.id));

    const result = getBoundedDelta(movingDesksObjs, rawDx, rawDy, stationary, {
      ignoreOverlapIds: preOverlappingIdsRef.current,
      skipSnap: altKeyRef.current,
      preferredTargetId: lastSnapTargetIdRef.current
    });

    // Husk hvilken pult som ble snappet mot, slik at neste frame favoriserer samme
    // mål (hysterese). Uten dette kan to nesten likeverdige nabo-pulter (typisk i et
    // generert rad-oppsett) "kjempe" om å være mål fra frame til frame, og pulten
    // ser ut til å hoppe rundt selv ved svært små musebevegelser.
    lastSnapTargetIdRef.current = result.targetDeskIds?.[0] || null;

    // Cache nøyaktig samme resultat som vises live (inkl. hvilken pult som
    // highlightes grønt), slik at handleDragEnd kan gjenbruke det i stedet for
    // å regne ut snap på nytt fra en potensielt marginalt annen rå-delta ved
    // selve drop-eventet — det kunne før føre til at pulten "hoppet" til en
    // annen posisjon enn den som var highlightet idet man slapp museknappen.
    lastDeskDragResultRef.current = { desksToMoveIds, x: result.x, y: result.y };

    // Direct DOM guide lines (60fps performance without React re-render loops)
    const xGuide = document.getElementById('guide-line-x');
    const yGuide = document.getElementById('guide-line-y');

    if (xGuide) {
      if (result.alignmentGuides.xLines.length > 0) {
        xGuide.style.left = `${result.alignmentGuides.xLines[0]}px`;
        xGuide.style.display = 'block';
      } else {
        xGuide.style.display = 'none';
      }
    }

    if (yGuide) {
      if (result.alignmentGuides.yLines.length > 0) {
        yGuide.style.top = `${result.alignmentGuides.yLines[0]}px`;
        yGuide.style.display = 'block';
      } else {
        yGuide.style.display = 'none';
      }
    }

    // Apply real-time visual transform & style to ALL moving desks in selection
    movingDesksObjs.forEach(md => {
       const el = document.getElementById(`desk-item-${md.id}`);
       if (el) {
          el.style.transform = `translate3d(${result.x}px, ${result.y}px, 0)`;
          el.style.boxShadow = '0 0 24px rgba(99, 102, 241, 0.8)';
          el.style.borderColor = '#6366f1';
          el.style.zIndex = '100';
       }
    });

    // Apply snap target highlight to stationary desks being snapped to
    stationary.forEach(s => {
       const el = document.getElementById(`desk-item-${s.id}`);
       if (el) {
          if (result.targetDeskIds.includes(s.id)) {
             el.style.boxShadow = '0 0 30px rgba(16, 185, 129, 0.95)';
             el.style.borderColor = '#10b981';
             el.style.zIndex = '50';
          } else {
             el.style.boxShadow = '';
             el.style.borderColor = '';
             el.style.zIndex = '';
          }
       }
    });

    return {
       ...transform,
       x: result.x,
       y: result.y,
    };
  };

  const handleDragStart = (event) => {
    isDraggingRef.current = true;
    lastDeskDragResultRef.current = null;
    lastSnapTargetIdRef.current = null;
    const { active } = event;
    if (!active || active.data.current?.type !== 'desk') return;

    const isPartOftMultiSelection = selectedDesksRef.current.includes(active.id);
    const desksToMove = isPartOftMultiSelection ? selectedDesksRef.current : [active.id];

    const movingDesks = desksRef.current.filter(d => desksToMove.includes(d.id));
    const stationary = desksRef.current.filter(d => !desksToMove.includes(d.id));
    const overlapping = new Set();
    movingDesks.forEach(md => {
      findOverlappingDeskIds(md, stationary).forEach(id => overlapping.add(id));
    });
    preOverlappingIdsRef.current = [...overlapping];

    desksToMove.forEach(id => {
       const el = document.getElementById(`desk-item-${id}`);
       if (el) el.style.zIndex = '100';
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event) => {
    isDraggingRef.current = false;
    const xGuide = document.getElementById('guide-line-x');
    const yGuide = document.getElementById('guide-line-y');
    if (xGuide) xGuide.style.display = 'none';
    if (yGuide) yGuide.style.display = 'none';

    desksRef.current.forEach(d => {
       const el = document.getElementById(`desk-item-${d.id}`);
       if (el) {
         el.style.boxShadow = '';
         el.style.borderColor = '';
         el.style.transform = '';
         el.style.zIndex = '';
       }
    });

    const { active, delta } = event;
    if (!active || !active.data.current) return;

    if (active.data.current.type === 'board') {
      setBoardObj(prev => ({
        x: Math.max(10, Math.min(1100 - 256 - 10, prev.x + delta.x / scale)),
        y: Math.max(10, Math.min(700 - 36 - 10, prev.y + delta.y / scale))
      }));
    } else if (active.data.current.type === 'desk') {
      const draggedDeskId = active.id;
      const isPartOftMultiSelection = selectedDesks.includes(draggedDeskId);
      const desksToMove = isPartOftMultiSelection ? selectedDesks : [draggedDeskId];

      // Gjenbruk resultatet fra siste live-frame (samme som ble vist/highlightet
      // under draget) i stedet for å regne ut snap på nytt her — se kommentar
      // i snapToDesksModifier.
      const cached = lastDeskDragResultRef.current;
      const cachedMatches = cached && cached.desksToMoveIds.length === desksToMove.length &&
        cached.desksToMoveIds.every(id => desksToMove.includes(id));

      let result;
      if (cachedMatches) {
        result = cached;
      } else {
        const draggedDesk = desks.find(d => d.id === draggedDeskId);
        if (!draggedDesk) return;
        const stationary = desks.filter(d => !desksToMove.includes(d.id));
        const movingDesks = desks.filter(d => desksToMove.includes(d.id));
        result = getBoundedDelta(movingDesks, delta.x / scale, delta.y / scale, stationary, {
          ignoreOverlapIds: preOverlappingIdsRef.current,
          skipSnap: altKeyRef.current
        });
      }

      setDesks(prev => prev.map(d => {
        if (desksToMove.includes(d.id)) {
          return { ...d, x: Math.round(d.x + result.x), y: Math.round(d.y + result.y) };
        }
        return d;
      }));
      lastDeskDragResultRef.current = null;
    }
  };

  return { desksRef, sensors, snapToDesksModifier, handleDragStart, handleDragEnd };
}
