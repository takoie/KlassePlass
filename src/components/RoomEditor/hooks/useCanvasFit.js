import { useState, useRef, useEffect, useCallback } from 'react';

// Skalerer og sentrerer det faste 1100×700 canvas-et til den tilgjengelige
// plassen i containeren, og holder det oppdatert ved vindusendring og ved
// åpning/lukking av verktøy-sidebaren.
export function useCanvasFit(showToolsDrawer) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerNodeRef = useRef(null);
  const observerRef = useRef(null);
  const canvasRef = useRef(null);

  const fitCanvasToContainer = (width, height) => {
    const availW = width - 24;
    const availH = height - 24;
    const sX = availW / 1100;
    const sY = availH / 700;
    // Skaler både ned OG opp for å fylle det tilgjengelige vinduet — ikke
    // bare krymp på små vinduer. Øvre tak hindrer at klasserommet blir
    // urimelig stort/uskarpt-følende på svært brede skjermer.
    const s = Math.min(1.5, sX, sY);
    setScale(s);

    const scaledW = 1100 * s;
    const scaledH = 700 * s;
    setOffset({
      x: Math.max(12, (width - scaledW) / 2),
      y: Math.max(12, (height - scaledH) / 2)
    });
  };

  // Container-diven monteres først når et rom er valgt (async, etter at
  // rooms er lastet), ikke ved første render. En vanlig useRef+useEffect([])
  // ville da prøve å observere før noden fantes og aldri prøve på nytt —
  // canvaset ville fått riktig startstørrelse (via den forsinkede
  // drawer-effekten under), men aldri følge senere vindusendringer. En
  // callback-ref fanger derfor opp nøyaktig når noden faktisk monteres.
  const containerRef = useCallback((node) => {
    observerRef.current?.disconnect();
    containerNodeRef.current = node;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        fitCanvasToContainer(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  // ResizeObserver fanger ikke alltid opp den animerte bredde-transisjonen
  // på verktøy-sidebaren pålitelig (sidebaren er en flex-sibling, ikke selve
  // det observerte elementet) — tving derfor et re-fit rett etter at
  // åpne/lukke-transisjonen (300ms, se sidebar-wrapperens `duration-300`) er
  // ferdig, slik at klasserommet alltid havner sentrert i den nye bredden.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!containerNodeRef.current) return;
      const { width, height } = containerNodeRef.current.getBoundingClientRect();
      fitCanvasToContainer(width, height);
    }, 320);
    return () => clearTimeout(timeout);
  }, [showToolsDrawer]);

  return { scale, offset, containerRef, canvasRef };
}
