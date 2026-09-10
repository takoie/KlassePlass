import React from 'react';
import { InfoTip } from './HoverTip';

/**
 * Delt "chrome" for radene i sidepanelene (klassekart + rom-bygger), så
 * handlingsknapper og visningsbrytere ser like ut overalt: flat, kompakt,
 * samme innrykk, ikonstørrelse og tekststørrelse.
 */
export const ROW_BASE =
  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all';

export const rowStateClass = ({ disabled, active, activeTone }) => {
  if (disabled) return 'opacity-35 cursor-not-allowed bg-transparent text-base-content/50';
  if (active) {
    return activeTone === 'rose'
      ? 'bg-rose-950/50 text-rose-200 shadow-sm'
      : 'bg-base-200/80 text-base-content shadow-sm';
  }
  return 'bg-transparent text-base-content/60 hover:bg-base-200/40 hover:text-base-content';
};

/** Handlingsrad – samme uttrykk som ToggleRow, men uten bryter. */
export function ActionRow({
  icon, iconColor = 'text-base-content/60', label, onClick, disabled,
  active, activeTone, badge, trailing, tip, title,
}) {
  return (
    <button
      type="button"
      className={`${ROW_BASE} ${rowStateClass({ disabled, active, activeTone })}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
    >
      <span className="flex items-center gap-2.5 min-w-0 flex-1">
        <i className={`${icon} fa-fw text-xs flex-shrink-0 ${disabled ? 'text-base-content/40' : iconColor}`}></i>
        <span className="truncate text-left">{label}</span>
      </span>
      <span className="flex items-center gap-2 flex-shrink-0 ml-2">
        {tip && <InfoTip text={tip} />}
        {badge != null && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-base-content">{badge}</span>
        )}
        {trailing}
      </span>
    </button>
  );
}

export const Chevron = ({ open }) => (
  <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-[10px] opacity-60`}></i>
);

/** Visningsbryter med fast ikon, fast tekst og iOS/macOS-aktig toggle. */
export function ToggleRow({ icon, iconColor, label, checked, onChange, disabled, tip }) {
  return (
    <button
      type="button"
      className={`${ROW_BASE} ${rowStateClass({ disabled, active: checked })}`}
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
    >
      <span className="flex items-center gap-2.5 min-w-0 flex-1">
        {icon && (
          <i className={`${icon} fa-fw text-xs flex-shrink-0 ${checked ? (iconColor || 'text-emerald-400') : 'text-base-content/50'}`}></i>
        )}
        <span className="truncate text-left">{label}</span>
      </span>
      <span className="flex items-center gap-2 flex-shrink-0 ml-2">
        {tip && <InfoTip text={tip} />}
        <span className={`w-7 h-4 rounded-full transition-colors relative flex items-center p-0.5 ${checked ? 'bg-emerald-500' : 'bg-base-300'}`}>
          <span className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 shadow-sm ${checked ? 'translate-x-3' : 'translate-x-0'}`}></span>
        </span>
      </span>
    </button>
  );
}

/** Liten seksjonsoverskrift i et sidepanel. */
export const SectionLabel = ({ children, className = '' }) => (
  <div className={`text-[10px] font-bold text-base-content/50 uppercase tracking-widest pl-1 mb-0.5 ${className}`}>
    {children}
  </div>
);
