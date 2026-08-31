import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const TIP_CLASS =
  'pointer-events-none rounded-xl bg-slate-950/95 border border-slate-700 shadow-2xl ' +
  'px-2.5 py-2 text-[11px] leading-relaxed text-slate-200 text-left normal-case font-normal ' +
  'tracking-normal whitespace-pre-line';

/**
 * Selve tooltip-boksen: rendres i en portal (som regel på document.body) med
 * position: fixed, måler sin egen størrelse og klemmes innenfor vinduet – så
 * den aldri blir klippet av en overflow-container eller havner utenfor kanten.
 * Ligger anker-elementet inne i en åpen <dialog> (top layer), portaleres boksen
 * dit i stedet, ellers ville den havnet bak modalen.
 */
export function TooltipBubble({ content, anchorRect, placement = 'top', maxWidth = 260, container }) {
  const tipRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!anchorRect || !tipRef.current) { setPos(null); return; }
    const margin = 8;
    const gap = 6;
    const tip = tipRef.current.getBoundingClientRect();

    let top = placement === 'bottom' ? anchorRect.bottom + gap : anchorRect.top - tip.height - gap;
    if (top < margin) top = anchorRect.bottom + gap;
    if (top + tip.height > window.innerHeight - margin) {
      top = Math.max(margin, anchorRect.top - tip.height - gap);
    }

    let left = anchorRect.left + anchorRect.width / 2 - tip.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - tip.width - margin));

    setPos({ top, left });
  }, [anchorRect, content, placement]);

  if (content == null || content === '') return null;

  return createPortal(
    <div
      ref={tipRef}
      role="tooltip"
      style={{
        position: 'fixed',
        top: pos ? pos.top : -9999,
        left: pos ? pos.left : -9999,
        maxWidth,
        visibility: pos ? 'visible' : 'hidden',
        zIndex: 99999,
      }}
      className={TIP_CLASS}
    >
      {content}
    </div>,
    container || document.body
  );
}

/**
 * Wrapper som viser en app-stylet hjelpetekst ved hover/fokus på barnet sitt.
 * Bruk der teksten er rik (flerlinjet, forklarende). For enkle knappe-etiketter
 * holder det å sette `title=` – GlobalTooltip fanger dem opp med samme stil.
 */
export function HoverTip({ content, children, placement = 'top', maxWidth = 260, className = '' }) {
  const triggerRef = useRef(null);
  const [rect, setRect] = useState(null);

  if (content == null || content === '') return children ?? null;

  const show = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  };
  const hide = () => setRect(null);

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex ${className}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {rect && (
        <TooltipBubble
          content={content}
          anchorRect={rect}
          placement={placement}
          maxWidth={maxWidth}
          container={triggerRef.current?.closest?.('dialog[open]') || undefined}
        />
      )}
    </>
  );
}

/** Info-ikon med tilhørende HoverTip – brukt i verktøylinjas visningsbrytere. */
export function InfoTip({ text, className = '' }) {
  return (
    <HoverTip content={text} placement="bottom" className={`flex-shrink-0 ${className}`}>
      <i
        tabIndex={0}
        className="fa-solid fa-circle-info text-xs text-slate-400 opacity-60 hover:opacity-100 focus:opacity-100 outline-none transition-opacity cursor-help"
      />
    </HoverTip>
  );
}

export default HoverTip;
