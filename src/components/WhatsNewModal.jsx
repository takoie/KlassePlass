import React from 'react';
import { CHANGELOG } from '../shared/changelogData';

/**
 * Popup som vises ÉN GANG rett etter at en oppdatering er installert
 * (App.jsx sammenligner lagret `lastSeenVersion` mot `window.api.getVersion()`
 * ved oppstart) — viser KUN nyeste versjons endringer, til forskjell fra
 * "Oppdatering og endringslogg" (UpdateModal.jsx) som viser hele historikken.
 * Samme badge-stil for highlight-typer som UpdateModal, for gjenkjennelse.
 */
export default function WhatsNewModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const latest = CHANGELOG[0];
  if (!latest) return null;

  // "Nyhet" (feature) er det brukerne bryr seg mest om i en "hva er nytt"-
  // popup, så den sorteres øverst. Stabil sortering (map+sort på index)
  // bevarer ellers den opprinnelige rekkefølgen innad i hver type.
  const sortedHighlights = latest.highlights
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const aIsFeature = a.item.type === 'feature' ? 0 : 1;
      const bIsFeature = b.item.type === 'feature' ? 0 : 1;
      if (aIsFeature !== bIsFeature) return aIsFeature - bIsFeature;
      return a.idx - b.idx;
    })
    .map(({ item }) => item);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-[fadeIn_0.15s_ease-out]">
      <div
        className="w-full max-w-lg bg-base-200 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-surface-raised border-b border-slate-700">
          <h2 className="font-extrabold text-white text-lg tracking-tight">Hva er nytt i v{latest.version}?</h2>
          <p className="text-xs text-slate-400">KlassePlass er nettopp oppdatert</p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 divide-y divide-slate-800/70">
          {sortedHighlights.map((item, idx) => (
            <div key={idx} className={`flex flex-col items-center gap-1.5 text-xs ${idx > 0 ? 'pt-4' : ''} ${idx < sortedHighlights.length - 1 ? 'pb-4' : ''}`}>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                item.type === 'feature'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                  : item.type === 'fix'
                  ? 'bg-amber-950/60 text-amber-300 border-amber-500/30'
                  : item.type === 'stability'
                  ? 'bg-blue-950/60 text-blue-300 border-blue-500/30'
                  : 'bg-purple-950/60 text-purple-300 border-purple-500/30'
              }`}>
                {item.type === 'feature' ? 'Nyhet' : item.type === 'fix' ? 'Feilretting' : item.type === 'stability' ? 'Stabilitet' : 'Forbedring'}
              </span>
              <div className="w-full leading-relaxed">
                <strong className="block text-slate-200">{item.title}:</strong>
                <span className="text-slate-400">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 bg-surface-raised border-t border-slate-800 flex justify-end">
          <button className="btn btn-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold border-none px-6" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
