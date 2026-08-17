import React, { useState, useEffect } from 'react';

export default function Layout({ currentView, setCurrentView, onOpenOnboarding, onOpenUpdateModal, children }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [hasUpdateReady, setHasUpdateReady] = useState(false);

  useEffect(() => {
    const unlisten = window.api?.onUpdateReady?.(() => setHasUpdateReady(true));
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    const handler = (e) => setIsFullscreen(e.detail);
    window.addEventListener('toggle-projector', handler);
    return () => window.removeEventListener('toggle-projector', handler);
  }, []);

  useEffect(() => {
    let unlisten;
    window.api?.isWindowMaximized?.().then(setIsMaximized);
    window.api?.onWindowMaximizeChange?.(setIsMaximized)?.then((fn) => { unlisten = fn; });
    return () => unlisten?.();
  }, []);

  const mainTabs = [
    { id: 'classes-overview', label: 'Klasser', icon: 'fa-solid fa-users', activeIds: ['classes-overview', 'classes'] },
    { id: 'rooms-overview', label: 'Rom', icon: 'fa-solid fa-school', activeIds: ['rooms-overview', 'rooms'] },
    { id: 'seating-overview', label: 'Klassekart', icon: 'fa-solid fa-map-location-dot', activeIds: ['seating-overview', 'seating'] },
    { id: 'group-overview', label: 'Gruppearbeid', icon: 'fa-solid fa-people-group', activeIds: ['group-overview', 'group-editor'] },
    { id: 'station-overview', label: 'Stasjoner', icon: 'fa-solid fa-arrows-rotate', activeIds: ['station-overview', 'station-setup', 'station-presenter'] }
  ];

  return (
    <div className="flex h-full w-full app-shell-bg p-3 gap-3 relative">
      {/* Global Titlebar (Always on top) */}
      {!isFullscreen && (
        <div className="titlebar flex items-center justify-end pr-3 pt-3 flex-shrink-0 bg-transparent absolute top-0 right-0 w-full z-[100] pointer-events-auto" data-tauri-drag-region style={{ WebkitAppRegion: 'drag', height: '40px' }}>
          {(currentView === 'seating' || currentView === 'rooms') && (
            <div className="absolute left-1/2 top-5 h-7 flex items-center -translate-x-1/2 select-none" data-tauri-drag-region style={{ WebkitAppRegion: 'drag' }}>
              <span className="font-extrabold text-white text-lg tracking-wider">KLASSE<span className="text-[#f59e0b] tracking-wider drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]">PLASS</span></span>
            </div>
          )}
          <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' }}>
            <button className="w-8 h-7 flex items-center justify-center rounded text-slate-400 hover:bg-slate-700/60 hover:text-white transition-colors" onClick={() => window.api?.minimizeWindow()} title="Minimer">
              <i className="fa-solid fa-minus text-xs"></i>
            </button>
            <button className="w-8 h-7 flex items-center justify-center rounded text-slate-400 hover:bg-slate-700/60 hover:text-white transition-colors" onClick={() => window.api?.maximizeWindow()} title={isMaximized ? 'Gjenopprett' : 'Maksimer'}>
              <i className={isMaximized ? 'fa-solid fa-window-restore text-xs' : 'fa-regular fa-square text-xs'}></i>
            </button>
            <button className="w-9 h-7 flex items-center justify-center rounded bg-[#ef4444] text-white hover:bg-red-600 transition-colors shadow" onClick={() => window.api?.closeWindow()} title="Lukk">
              <i className="fa-solid fa-xmark text-sm font-bold"></i>
            </button>
          </div>
        </div>
      )}

      {/* Sidebar for Desktop */}
      {!isFullscreen && currentView !== 'seating' && currentView !== 'rooms' && currentView !== 'station-presenter' && (
        <div className="w-56 bg-base-200 flex flex-col z-50 flex-shrink-0 rounded-2xl border border-slate-800/80 shadow-2xl p-3">
        
        {/* Logo Area - Perfekt Midtstilt */}
        <div className="h-16 flex items-center justify-center mb-3" style={{ WebkitAppRegion: 'drag' }}>
          <div className="select-none flex items-center justify-center tracking-tight text-center">
            <span className="font-extrabold text-white text-2xl tracking-wider">KLASSE</span>
            <span className="font-extrabold text-[#f59e0b] text-2xl tracking-wider drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]">PLASS</span>
          </div>
        </div>
        
        {/* Hovedmeny */}
        <div className="flex flex-col w-full flex-1 gap-2 overflow-y-auto">
          {mainTabs.map((tab) => {
            const isActive = tab.activeIds.includes(currentView);
            return (
              <button 
                key={tab.id}
                className={`overblikk-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => setCurrentView(tab.id)}
              >
                <i className={`${tab.icon} fa-fw text-sm flex-shrink-0 ${isActive ? 'text-[#34d399]' : 'text-slate-400'}`}></i>
                <span className="leading-none flex-1 text-left">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Nederst i Sidemenyen - Oppdatering, Veiledning og Innstillinger */}
        <div className="pt-3 border-t border-slate-800/80 mt-auto flex flex-col gap-2">
          <button
            className={`overblikk-nav-btn relative transition-all duration-300 ${
              hasUpdateReady
                ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                : ''
            }`}
            onClick={onOpenUpdateModal}
          >
            <i className={`fa-solid fa-cloud-arrow-down fa-fw text-sm flex-shrink-0 ${
              hasUpdateReady ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'text-slate-400'
            }`}></i>
            <span className="leading-none flex-1 text-left">Oppdatering</span>
            {hasUpdateReady && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-400 text-slate-950 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse">
                Klar
              </span>
            )}
          </button>
          <button
            className="overblikk-nav-btn"
            onClick={onOpenOnboarding}
          >
            <i className="fa-solid fa-compass fa-fw text-sm flex-shrink-0 text-slate-400"></i>
            <span className="leading-none flex-1 text-left">Veiledning</span>
          </button>
          <button
            className={`overblikk-nav-btn ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentView('settings')}
          >
            <i className="fa-solid fa-gear fa-fw text-sm flex-shrink-0 text-slate-400"></i>
            <span className="leading-none flex-1 text-left">Innstillinger</span>
          </button>
        </div>

      </div>
      )}

      {/* Main Content Area — samme innrammet-boks + topp-avstand for titlebar-knappene
          på alle sider, uansett om sidemenyen er skjult (canvas-fokuserte visninger som
          klassekart/rom/stasjonspresentasjon) eller synlig. Tidligere hoppet "seating" og
          "station-presenter" over denne innpakningen, som fikk deres egne topplinjer til
          å kollidere visuelt med vinduskontrollene (minimer/maksimer/lukk). */}
      <div className="flex-1 flex flex-col overflow-hidden relative module-content-bg rounded-2xl border border-slate-800/80 shadow-[0_10px_35px_rgba(0,0,0,0.6)]">
        <div className="flex-1 overflow-hidden pt-10">
          {children}
        </div>
      </div>
    </div>
  );
}
