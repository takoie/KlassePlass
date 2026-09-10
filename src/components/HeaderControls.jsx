import React from 'react';

/**
 * Delte primitiver for modul-toppbarene (klassekart + rom-bygger), så
 * knapper, etiketter og lagre-status ser like ut på tvers.
 */

/** Etikett + kontroll på samme rad ("Klasse:", "Rom:", "Periode:" …). */
export const HeaderField = ({ label, title, children }) => (
  <div className="flex items-center gap-1.5 flex-shrink-0" title={title}>
    <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 whitespace-nowrap">{label}</span>
    {children}
  </div>
);

const TONES = {
  ghost: 'border-transparent text-base-content/60 hover:text-base-content hover:bg-base-200',
  neutral: 'border-base-300 text-base-content hover:text-base-content hover:bg-base-200',
  primary: 'border-emerald-500/40 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10',
  danger: 'border-rose-500/30 text-rose-300 hover:text-rose-200 hover:bg-rose-950/40',
};

/** Ensartet header-knapp: samme boks-høyde som nedtrekksmenyene, litt mindre tekst. */
export const HeaderButton = ({ onClick, title, tone = 'neutral', icon, iconClass = '', active, disabled, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={`h-9 inline-flex flex-shrink-0 items-center gap-2 px-3 rounded-md border text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      active ? 'border-base-300 bg-base-200 text-base-content' : TONES[tone]
    }`}
  >
    {icon && <i className={`${icon} ${iconClass}`}></i>}
    {children && <span className="whitespace-nowrap">{children}</span>}
  </button>
);

/** Lagre-status i fast bredde-slot. saveState: 'saving' | 'error' | annet (= lagret). */
export const SaveStatus = ({ saveState }) => (
  <div className="w-[92px] flex-shrink-0 flex items-center justify-end">
    {saveState === 'saving' ? (
      <span className="text-amber-400 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap">
        <i className="fa-solid fa-spinner fa-spin"></i> Lagrer…
      </span>
    ) : saveState === 'error' ? (
      <span className="text-rose-400 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap">
        <i className="fa-solid fa-triangle-exclamation"></i> Ikke lagret
      </span>
    ) : (
      <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap">
        <i className="fa-solid fa-circle-check"></i> Lagret
      </span>
    )}
  </div>
);

/** Felles ytre skall for en modul-toppbar. Holdes alltid på ÉN linje
 *  (flex-nowrap) – ved ekstrem smal bredde scrolles den horisontalt i stedet
 *  for å bryte over flere rader. */
export const HeaderBarShell = ({ children }) => (
  <div className="px-4 py-2 bg-base-200 border-b border-base-300 flex flex-nowrap justify-between items-center gap-x-3 z-20 flex-shrink-0 shadow-md overflow-x-auto">
    {children}
  </div>
);

export const HeaderDivider = () => (
  <div className="w-px h-6 bg-base-300/70 mx-0.5 hidden sm:block" />
);
