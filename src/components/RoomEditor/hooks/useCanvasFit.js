import { useState, useRef, useEffect } from 'react';

// Skalerer og sentrerer det faste 1100×700 canvas-et til den tilgjengelige
// plassen i containeren, og holder det oppdatert ved vindusendring og ved
// åpning/lukking av verktøy-sidebaren.
export function useCanvasFit(showToolsDrawer) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const fitCanvasToContainer = (width, height) => {
    const availW = width - 60;
    const availH = height - 60;
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
      x: Math.max(30, (width - scaledW) / 2),
      y: Math.max(30, (height - scaledH) / 2)
    });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        fitCanvasToContainer(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ResizeObserver fanger ikke alltid opp den animerte bredde-transisjonen
  // på verktøy-sidebaren pålitelig (sidebaren er en flex-sibling, ikke selve
  // det observerte elementet) — tving derfor et re-fit rett etter at
  // åpne/lukke-transisjonen (300ms, se sidebar-wrapperens `duration-300`) er
  // ferdig, slik at klasserommet alltid havner sentrert i den nye bredden.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      fitCanvasToContainer(width, height);
    }, 320);
    return () => clearTimeout(timeout);
  }, [showToolsDrawer]);

  return { scale, offset, containerRef, canvasRef };
}
