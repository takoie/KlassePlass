import { useState, useRef, useEffect } from 'react';

// Skalerer og sentrerer det faste 1100×700 canvas-et til den tilgjengelige
// plassen i containeren, og holder det oppdatert ved vindusendring.
export function useCanvasFit() {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
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
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return { scale, offset, containerRef, canvasRef };
}
