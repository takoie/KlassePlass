import React, { useState, useEffect } from 'react';
import { CHANGELOG } from '../shared/changelogData';
import { showToast } from '../shared/utils';

export default function UpdateModal({ isOpen, onClose }) {
  const [currentVersion, setCurrentVersion] = useState(null);
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(null); // { version, date, body, updateObj }
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null); // { percent }
  const [updateReady, setUpdateReady] = useState(null); // { version }
  const [checkError, setCheckError] = useState(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    window.api?.getVersion?.().then(v => setCurrentVersion(v)).catch(() => {});
  }, []);

  useEffect(() => {
    const unlisten = window.api?.onUpdateReady?.((info) => {
      setUpdateReady(info);
      setDownloading(false);
    });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCheckError(null);
      handleCheck(false);
    }
  }, [isOpen]);

  const handleCheck = async (showToastOnNoUpdate = true) => {
    if (checking || downloading) return;
    setChecking(true);
    setCheckError(null);

    try {
      const res = await window.api?.checkForUpdates?.();
      if (res?.available) {
        setUpdateAvailable(res);
      } else {
        setUpdateAvailable(null);
        if (showToastOnNoUpdate) {
          showToast('Du har allerede den nyeste versjonen!', 'info');
        }
      }
    } catch (err) {
      console.warn('Update check failed:', err);
      setCheckError(err?.message || 'Kunne ikke kontakte oppdateringstjeneren.');
    } finally {
      setChecking(false);
    }
  };

  const handleDownloadAndInstall = async () => {
    if (!updateAvailable?.updateObj || downloading) return;
    setDownloading(true);
    setDownloadProgress({ percent: 0 });

    try {
      await window.api?.downloadAndInstallUpdate?.(updateAvailable.updateObj, (progress) => {
        setDownloadProgress(progress);
      });
    } catch (err) {
      console.error('Download failed:', err);
      setDownloading(false);
      setCheckError('Nedlasting feilet: ' + (err?.message || err));
      showToast('Nedlasting av oppdatering feilet.', 'error');
    }
  };

  const handleRestart = () => {
    setRestarting(true);
    window.api?.restartApp?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-[fadeIn_0.15s_ease-out]">
      <div 
        className="w-full max-w-2xl bg-base-200 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-surface-raised border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <i className="fa-solid fa-cloud-arrow-down text-lg"></i>
            </div>
            <div>
              <h2 className="font-extrabold text-white text-lg tracking-tight flex items-center gap-2">
                Oppdatering & Endringslogg
              </h2>
              <p className="text-xs text-slate-400">
                Installert versjon: <span className="font-bold text-slate-200">v{currentVersion || '2.5.0'}</span>
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            onClick={onClose}
            title="Lukk"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Status Box */}
          <div className="p-4 rounded-xl border border-slate-700/80 bg-surface-field/60 backdrop-blur flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                {checking ? (
                  <i className="fa-solid fa-spinner fa-spin text-emerald-400 text-base"></i>
                ) : updateReady ? (
                  <i className="fa-solid fa-circle-check text-emerald-400 text-base"></i>
                ) : updateAvailable ? (
                  <i className="fa-solid fa-circle-arrow-down text-emerald-400 text-base"></i>
                ) : checkError ? (
                  <i className="fa-solid fa-triangle-exclamation text-amber-400 text-base"></i>
                ) : (
                  <i className="fa-solid fa-circle-check text-emerald-400 text-base"></i>
                )}

                <div>
                  <h4 className="text-sm font-bold text-white">
                    {checking
                      ? 'Søker etter oppdateringer...'
                      : updateReady
                      ? `KlassePlass v${updateReady.version} er klar til installasjon!`
                      : updateAvailable
                      ? `Ny versjon tilgjengelig: v${updateAvailable.version}`
                      : checkError
                      ? 'Kunne ikke hente oppdateringsstatus'
                      : `Du har nyeste versjon installert (v${currentVersion || '2.5.0'})`}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {checking
                      ? 'Kobler til GitHub Releases...'
                      : updateReady
                      ? 'Oppdateringen er lastet ned. Restart appen for å ta den i bruk.'
                      : updateAvailable
                      ? 'En ny versjon er publisert. Trykk på knappen for å laste ned.'
                      : checkError
                      ? checkError
                      : 'KlassePlass sjekker automatisk etter nye versjoner i bakgrunnen ved oppstart.'}
                  </p>
                </div>
              </div>

              {/* Action buttons inside status box */}
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-sm btn-outline border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5"
                  onClick={() => handleCheck(true)}
                  disabled={checking || downloading}
                >
                  <i className={`fa-solid fa-arrows-rotate ${checking ? 'fa-spin text-emerald-400' : ''}`}></i>
                  Søk på nytt
                </button>

                {updateAvailable && !updateReady && (
                  <button
                    className="btn btn-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold border-none gap-1.5 shadow"
                    onClick={handleDownloadAndInstall}
                    disabled={downloading}
                  >
                    <i className={`fa-solid ${downloading ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                    {downloading ? 'Laster ned...' : 'Last ned & installer'}
                  </button>
                )}

                {updateReady && (
                  <button
                    className="btn btn-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold border-none gap-1.5 shadow animate-pulse"
                    onClick={handleRestart}
                    disabled={restarting}
                  >
                    <i className="fa-solid fa-rotate-right"></i>
                    {restarting ? 'Restarter...' : 'Restart nå'}
                  </button>
                )}
              </div>
            </div>

            {/* Download Progress Bar */}
            {downloading && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Laster ned installasjonsfiler...</span>
                  <span className="font-bold text-emerald-400">{downloadProgress?.percent ?? 50}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${downloadProgress?.percent ?? 50}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Changelog Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <i className="fa-solid fa-list-check text-emerald-400"></i> Hva er nytt i KlassePlass
              </h3>
            </div>

            <div className="space-y-4">
              {CHANGELOG.map((rel) => (
                <div 
                  key={rel.version}
                  className="rounded-xl border border-slate-800 bg-surface-raised/40 p-4 transition-all hover:border-slate-700"
                >
                  <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-extrabold text-white tracking-tight">
                        Versjon {rel.version}
                      </span>
                      {rel.isLatest && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                          Nyeste
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      {rel.date}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {rel.highlights.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5 flex-shrink-0 border ${
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
                        <div className="leading-relaxed">
                          <strong className="text-slate-200">{item.title}: </strong>
                          <span className="text-slate-400">{item.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-surface-raised border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <span>Automatisk oppdatering aktivert via GitHub Releases</span>
          <button className="btn btn-sm btn-ghost text-slate-300 hover:text-white" onClick={onClose}>
            Lukk
          </button>
        </div>
      </div>
    </div>
  );
}
