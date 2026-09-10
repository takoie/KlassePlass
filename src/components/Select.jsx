import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tema-tilpasset nedtrekksmeny som erstatter native <select>. Den native
 * varianten tegner options-lista via OS-en og kan ikke stiles – derfor denne:
 * en knapp + en egen liste i en portal, klemt innenfor vinduet.
 *
 * options: Array<{ value, label, disabled? } | string>
 * onChange: (value) => void   – value gis tilbake som streng.
 */

const SIZES = {
  xs: 'h-7 text-xs px-2.5',
  sm: 'h-9 text-sm px-3',
  // Modul-toppbarene: samme boks-høyde som `sm`, men litt mindre tekst så den
  // matcher HeaderButton.
  bar: 'h-9 text-xs px-3',
  md: 'h-10 text-sm px-3',
};

const normalize = (options) =>
  options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

export default function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Velg …',
  size = 'sm',
  className = '',
  disabled = false,
  ariaLabel,
}) {
  const items = useMemo(() => normalize(options), [options]);
  const selected = items.find((o) => String(o.value) === String(value)) || null;

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [pos, setPos] = useState(null);

  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const typeahead = useRef({ str: '', at: 0 });

  const firstSelectable = (start, dir) => {
    for (let i = 0; i < items.length; i++) {
      const idx = start + dir * i;
      if (idx < 0 || idx >= items.length) break;
      if (!items[idx]?.disabled) return idx;
    }
    for (let i = 0; i < items.length; i++) if (!items[i]?.disabled) return i;
    return -1;
  };

  const openMenu = () => {
    if (disabled) return;
    const selIdx = items.findIndex((o) => String(o.value) === String(value));
    setActiveIdx(selIdx >= 0 ? selIdx : firstSelectable(0, 1));
    setOpen(true);
  };
  const closeMenu = () => {
    setOpen(false);
    setPos(null);
    triggerRef.current?.focus();
  };

  const pick = (idx) => {
    const opt = items[idx];
    if (!opt || opt.disabled) return;
    onChange?.(String(opt.value));
    setOpen(false);
    setPos(null);
    triggerRef.current?.focus();
  };

  // Plasser lista under knappen, snu opp hvis det ikke er plass, klem i vinduet.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !listRef.current) return;
    const margin = 8;
    const r = triggerRef.current.getBoundingClientRect();
    const listH = listRef.current.offsetHeight;
    let top = r.bottom + 4;
    if (top + listH > window.innerHeight - margin && r.top - listH - 4 > margin) {
      top = r.top - listH - 4;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - listH - margin));
    const width = r.width;
    let left = Math.max(margin, Math.min(r.left, window.innerWidth - width - margin));
    setPos({ top, left, width });
  }, [open, items]);

  // Flytt fokus til lista når den åpnes (så tastaturnavigasjon virker).
  useEffect(() => {
    if (open && pos) listRef.current?.focus({ preventScroll: true });
  }, [open, pos]);

  // Hold uthevet rad synlig ved tastaturnavigasjon.
  useEffect(() => {
    if (!open || activeIdx < 0) return;
    const node = listRef.current?.children?.[activeIdx];
    node?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIdx]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (
        !triggerRef.current?.contains(e.target) &&
        !listRef.current?.contains(e.target)
      ) {
        setOpen(false);
        setPos(null);
      }
    };
    const close = () => { setOpen(false); setPos(null); };
    // Scroll INNI lista (piltast-navigasjon) skal ikke lukke – bare scroll utenfor.
    const onScroll = (e) => {
      if (listRef.current && (e.target === listRef.current || listRef.current.contains(e.target))) return;
      close();
    };
    document.addEventListener('mousedown', onDocDown, true);
    window.addEventListener('resize', close, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDocDown, true);
      window.removeEventListener('resize', close, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const onTriggerKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
  };

  // Et <dialog> åpnet med showModal() ligger i nettleserens "top layer". En
  // portal til document.body havner da BAK dialogens backdrop og blir uklikkbar.
  // Rendrer derfor lista inn i nærmeste åpne <dialog> når trigger-knappen er
  // inni en – ellers document.body som før.
  const portalTarget =
    (open && triggerRef.current?.closest?.('dialog[open]')) || document.body;

  const onListKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key === 'Tab') { e.preventDefault(); closeMenu(); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(activeIdx); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => firstSelectable(Math.min(i + 1, items.length - 1), 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => firstSelectable(Math.max(i - 1, 0), -1)); return; }
    if (e.key === 'Home') { e.preventDefault(); setActiveIdx(firstSelectable(0, 1)); return; }
    if (e.key === 'End') { e.preventDefault(); setActiveIdx(firstSelectable(items.length - 1, -1)); return; }
    if (e.key.length === 1) {
      const now = Date.now();
      typeahead.current.str = now - typeahead.current.at > 700 ? e.key : typeahead.current.str + e.key;
      typeahead.current.at = now;
      const q = typeahead.current.str.toLowerCase();
      const hit = items.findIndex((o) => !o.disabled && String(o.label).toLowerCase().startsWith(q));
      if (hit >= 0) setActiveIdx(hit);
    }
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? (setOpen(false), setPos(null)) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={`inline-flex items-center justify-between gap-2 rounded-md border bg-surface-field border-base-300 font-semibold text-base-content transition-colors hover:border-base-300 focus:outline-none focus-visible:border-emerald-500 focus-visible:ring-1 focus-visible:ring-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed ${SIZES[size] || SIZES.sm} ${className}`}
      >
        <span className={`truncate ${selected ? '' : 'text-base-content/60 font-normal'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <i className={`fa-solid fa-chevron-down text-[10px] text-base-content/60 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}></i>
      </button>

      {open && createPortal(
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          style={{
            position: 'fixed',
            top: pos ? pos.top : -9999,
            left: pos ? pos.left : -9999,
            width: pos ? pos.width : (triggerRef.current?.offsetWidth || 220),
            visibility: pos ? 'visible' : 'hidden',
            zIndex: 99999,
          }}
          className="max-h-64 overflow-y-auto rounded-lg border border-base-300 bg-base-200 shadow-2xl py-1 custom-scrollbar focus:outline-none animate-[fadeIn_0.1s_ease-out]"
        >
          {items.length === 0 && (
            <li className="px-3 py-2 text-xs text-base-content/50">Ingen valg</li>
          )}
          {items.map((opt, idx) => {
            const isSelected = String(opt.value) === String(value);
            const isActive = idx === activeIdx;
            return (
              <li
                key={`${opt.value}-${idx}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                onMouseEnter={() => !opt.disabled && setActiveIdx(idx)}
                onMouseDown={(e) => { e.preventDefault(); pick(idx); }}
                className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs cursor-pointer select-none ${
                  opt.disabled
                    ? 'text-base-content/40 cursor-not-allowed'
                    : isActive
                    ? 'bg-base-200 text-base-content'
                    : isSelected
                    ? 'text-emerald-300'
                    : 'text-base-content'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <i className="fa-solid fa-check text-[11px] text-emerald-400 flex-shrink-0"></i>}
              </li>
            );
          })}
        </ul>,
        portalTarget
      )}
    </>
  );
}
