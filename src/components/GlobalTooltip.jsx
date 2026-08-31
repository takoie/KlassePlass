import React, { useEffect, useRef, useState } from 'react';
import { TooltipBubble } from './HoverTip';

const SELECTOR = '[data-hint], [title]';

/**
 * App-stylet erstatning for nettleserens native `title`-tooltip, montert én
 * gang i App. Fanger hover/fokus på ethvert element med `title=` (eller
 * `data-hint=`), flytter den native title-en inn i `data-hint` slik at
 * nettleserens egen boks ikke dobbeltvises, og viser vår egen boks som holder
 * seg innenfor vinduet. Kallstedene trenger ingen endring – de beholder `title=`.
 */
export default function GlobalTooltip() {
  const [tip, setTip] = useState(null); // { content, rect, container }
  const elRef = useRef(null);

  useEffect(() => {
    // Flytt en fersk native title inn i data-hint (skjuler nettleserboksen) og
    // gi ikon-only elementer et aria-label så skjermlesere ikke mister teksten.
    const normalize = (el) => {
      const t = el.getAttribute('title');
      if (t != null && t !== '') {
        el.setAttribute('data-hint', t);
        el.removeAttribute('title');
        if (!el.getAttribute('aria-label') && !el.textContent.trim()) {
          el.setAttribute('aria-label', t);
        }
      }
      return el.getAttribute('data-hint') || '';
    };

    const open = (e) => {
      const el = e.target?.closest?.(SELECTOR);
      if (!el || el === elRef.current) return;
      const content = normalize(el);
      if (!content) return;
      elRef.current = el;
      setTip({
        content,
        rect: el.getBoundingClientRect(),
        container: el.closest('dialog[open]') || undefined,
      });
    };

    const close = (e) => {
      if (!elRef.current) return;
      const to = e.relatedTarget;
      if (to && elRef.current.contains && elRef.current.contains(to)) return;
      elRef.current = null;
      setTip(null);
    };

    // Rect blir feil ved scroll/layout-endring og tastaturnavigasjon – lukk da.
    const dismiss = () => {
      if (!elRef.current) return;
      elRef.current = null;
      setTip(null);
    };

    document.addEventListener('pointerover', open, true);
    document.addEventListener('pointerout', close, true);
    document.addEventListener('focusin', open, true);
    document.addEventListener('focusout', close, true);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss, true);
    window.addEventListener('keydown', dismiss, true);
    return () => {
      document.removeEventListener('pointerover', open, true);
      document.removeEventListener('pointerout', close, true);
      document.removeEventListener('focusin', open, true);
      document.removeEventListener('focusout', close, true);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss, true);
      window.removeEventListener('keydown', dismiss, true);
    };
  }, []);

  if (!tip) return null;
  return <TooltipBubble content={tip.content} anchorRect={tip.rect} placement="top" container={tip.container} />;
}
