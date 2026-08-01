import React, { useState, useEffect } from 'react';
import { showToast } from '../shared/utils';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('visning');
  const [settings, setSettings] = useState({ boardPosition: 'top', theme: 'klasseplass' });
  const [dbMessage, setDbMessage] = useState(null);
  const [appVersion, setAppVersion] = useState(null);

  useEffect(() => {
    loadSettings();
    window.api?.getVersion?.().then(setAppVersion).catch(() => {});
  }, []);

  const loadSettings = async () => {
    try {
      const s = await window.api.getSettings();
      if (s) setSettings(s);
    } catch(e) {
      showToast('Kunne ikke laste innstillinger. Standardverdier brukes.', 'error');
    }
  };

  const handleSaveSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await window.api.saveSettings({ [key]: value });
    } catch(e) {
      showToast('Kunne ikke lagre innstillingen.', 'error');
    }
  };

  const handleSetTheme = (themeId) => {
    document.documentElement.setAttribute('data-theme', themeId);
    handleSaveSetting('theme', themeId);
  };

  const handleBackup = async () => {
    setDbMessage(null);
    try {
      const result = await window.api.backupDb();
      if (result.canceled) return;
      setDbMessage(result.success
        ? { type: 'success', text: `Sikkerhetskopi lagret: ${result.filePath}` }
        : { type: 'error', text: result.error || 'Kunne ikke lagre sikkerhetskopi.' });
    } catch (e) {
      setDbMessage({ type: 'error', text: 'Kunne ikke lagre sikkerhetskopi.' });
    }
  };

  const handleRestore = async () => {
    document.getElementById('modal_restore_db')?.close();
    setDbMessage(null);
    try {
      const result = await window.api.restoreDb();
      if (result.canceled) return;
      setDbMessage(result.success
        ? { type: 'success', text: 'Database gjenopprettet. Start appen på nytt for at endringene skal vises overalt.' }
        : { type: 'error', text: result.error || 'Kunne ikke gjenopprette database.' });
    } catch (e) {
      setDbMessage({ type: 'error', text: 'Kunne ikke gjenopprette database.' });
    }
  };

  const handleMove = async () => {
    document.getElementById('modal_move_db')?.close();
    setDbMessage(null);
    try {
      const result = await window.api.moveDb();
      if (result.canceled) return;
      setDbMessage(result.success
        ? { type: 'success', text: `Database flyttet til: ${result.newPath}. Start appen på nytt.` }
        : { type: 'error', text: result.error || 'Kunne ikke flytte database.' });
    } catch (e) {
      setDbMessage({ type: 'error', text: 'Kunne ikke flytte database.' });
    }
  };

  const themeOptions = [
    { id: 'klasseplass', label: 'Standard', colors: ['#34d399', '#4f46e5', '#f59e0b'] },
    { id: 'havbris', label: 'Havbris', colors: ['#38bdf8', '#6366f1', '#f59e0b'] },
    { id: 'solnedgang', label: 'Solnedgang', colors: ['#fb923c', '#f43f5e', '#38bdf8'] },
    { id: 'lavendel', label: 'Lavendel', colors: ['#a78bfa', '#06b6d4', '#f59e0b'] },
  ];

  const features = [
    { icon: 'fa-solid fa-users', title: 'Klasser', text: 'Registrer klasser og elever, og definer regler for hvem som bør eller ikke bør sitte sammen.' },
    { icon: 'fa-solid fa-school', title: 'Rom', text: 'Tegn opp klasserommet fritt med bord, tavle, dører og vinduer - dra og slipp i egen editor.' },
    { icon: 'fa-solid fa-map-location-dot', title: 'Klassekart', text: 'Plasser elevene i rommet, generer forslag automatisk, og hold styr på flere perioder over tid.' },
    { icon: 'fa-solid fa-people-group', title: 'Gruppearbeid', text: 'Sett sammen makkergrupper automatisk ut fra reglene dine, med historikk som unngår gjentakelser.' },
    { icon: 'fa-solid fa-arrows-rotate', title: 'Stasjoner', text: 'Planlegg og kjør stasjonsundervisning med rotasjon mellom grupper, klart for prosjektor.' },
    { icon: 'fa-solid fa-print', title: 'Utskrift', text: 'Skriv ut eller eksporter klassekart og stasjonsoppsett som PDF, med tilpassbart innhold.' },
  ];

  const tabs = [
    { id: 'visning', label: 'Visning & generelt', icon: 'fa-solid fa-display' },
    { id: 'database', label: 'Database & sikkerhetskopi', icon: 'fa-solid fa-database' },
    { id: 'om', label: 'Om KlassePlass', icon: 'fa-solid fa-circle-info' },
    { id: 'personvern', label: 'Personvern & GDPR', icon: 'fa-solid fa-shield-halved' },
    { id: 'lisenser', label: 'Lisenser', icon: 'fa-solid fa-scale-balanced' },
  ];

  return (
    <div className="flex flex-col h-full module-content-bg text-slate-100">
      {/* Toppmeny for innstillings-faner */}
      <div className="flex items-center gap-4 px-6 pt-6 pb-4 border-b border-white/10 flex-shrink-0 bg-white/[0.03] backdrop-blur-md overflow-x-auto">
        <h2 className="text-lg font-bold flex items-center gap-2 text-white flex-shrink-0">
          <i className="fa-solid fa-gear text-emerald-400"></i> Innstillinger
        </h2>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`btn btn-sm rounded-full border-none gap-2 font-semibold ${
                activeTab === tab.id
                  ? 'bg-emerald-500/15 text-emerald-400 font-bold hover:bg-emerald-500/20'
                  : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`${tab.icon} text-xs`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'visning' && (
          <div className="max-w-2xl mx-auto">
            <h3 className="text-xl font-bold mb-6 text-white">Visning & generelt</h3>
            
            <div className="bg-base-100/50 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-6 mb-6">
              <h4 className="font-bold text-sm text-slate-200 mb-1">Standard tavleplassering</h4>
              <p className="text-xs text-slate-400 mb-4">Velg om tavlen skal ligge øverst eller nederst i klasserommet som standard.</p>
              
              <div className="form-control max-w-xs">
                <select
                  className="select select-bordered bg-base-200 border-slate-700 text-slate-200 focus:border-emerald-500"
                  value={settings.boardPosition || 'top'}
                  onChange={(e) => handleSaveSetting('boardPosition', e.target.value)}
                >
                  <option value="top">Tavle øverst</option>
                  <option value="bottom">Tavle nederst</option>
                </select>
              </div>
            </div>

            <div className="bg-base-100/50 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h4 className="font-bold text-sm text-slate-200 mb-1">Fargetema</h4>
              <p className="text-xs text-slate-400 mb-4">Velg fargeprofilen som passer deg best. Gjelder for hele appen.</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {themeOptions.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSetTheme(t.id)}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                      (settings.theme || 'klasseplass') === t.id
                        ? 'border-white/30 bg-white/5'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]'
                    }`}
                  >
                    {(settings.theme || 'klasseplass') === t.id && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
                        <i className="fa-solid fa-check text-[9px] text-white"></i>
                      </span>
                    )}
                    <div className="flex gap-1">
                      {t.colors.map((c, i) => (
                        <span key={i} className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c }}></span>
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-slate-200">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="max-w-2xl mx-auto">
            <h3 className="text-xl font-bold mb-6 text-white">Database & sikkerhetskopi</h3>

            {dbMessage && (
              <div className={`rounded-2xl p-4 mb-6 text-xs font-semibold border ${
                dbMessage.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}>
                {dbMessage.text}
              </div>
            )}

            <div className="bg-base-100/50 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-6 mb-6">
              <h4 className="font-bold text-sm text-slate-200 mb-1">Ta sikkerhetskopi</h4>
              <p className="text-xs text-slate-400 mb-4">Lagre en kopi av hele databasen (alle klasser, rom og klassekart) som en fil du selv velger.</p>
              <button className="btn btn-sm bg-emerald-500/20 text-emerald-400 border-none hover:bg-emerald-500/30 gap-2" onClick={handleBackup}>
                <i className="fa-solid fa-download"></i> Lagre sikkerhetskopi
              </button>
            </div>

            <div className="bg-base-100/50 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-6 mb-6">
              <h4 className="font-bold text-sm text-slate-200 mb-1">Gjenopprett fra sikkerhetskopi</h4>
              <p className="text-xs text-slate-400 mb-4">Erstatter hele den nåværende databasen med innholdet i en valgt sikkerhetskopi-fil. Den nåværende databasen tas automatisk vare på som <code>.bak</code> først.</p>
              <button className="btn btn-sm btn-outline border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-2" onClick={() => document.getElementById('modal_restore_db')?.showModal()}>
                <i className="fa-solid fa-upload"></i> Gjenopprett fra fil...
              </button>
            </div>

            <div className="bg-base-100/50 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h4 className="font-bold text-sm text-slate-200 mb-1">Flytt database</h4>
              <p className="text-xs text-slate-400 mb-4">Flytt databasefilen til en annen mappe (f.eks. en delt nettverksstasjon eller skylagringsmappe). Appen må startes på nytt etterpå.</p>
              <button className="btn btn-sm btn-outline border-slate-700 text-slate-300 hover:bg-slate-800 gap-2" onClick={() => document.getElementById('modal_move_db')?.showModal()}>
                <i className="fa-solid fa-folder-tree"></i> Velg ny plassering...
              </button>
            </div>
          </div>
        )}

        {activeTab === 'om' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center py-10 bg-base-100/50 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl mb-6 shadow-xl">
              <h1 className="text-4xl font-extrabold mb-2 text-white tracking-wider">
                KLASSE<span className="text-[#f59e0b]">PLASS</span>
              </h1>
              {appVersion && (
                <p className="text-xs text-slate-500 font-mono mb-2">v{appVersion}</p>
              )}
              <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                KlassePlass er et raskt, 100% lokalt verktøy laget for lærerhverdagen - fra å sette opp klassen
                og klasserommet, til å planlegge klassekart, gruppearbeid og stasjonsundervisning, uten
                innlogging, abonnement eller nettskyavhengighet. Alt lagres på din egen maskin, og alt du
                gjør lagres fortløpende mens du jobber.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {features.map((f) => (
                <div key={f.title} className="bg-base-100/50 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-5 flex gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                    <i className={`${f.icon} text-sm`}></i>
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-slate-200 mb-1">{f.title}</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">{f.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-base-100/50 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h4 className="font-bold text-sm text-slate-200 mb-2">Utvikler & informasjon</h4>
              <p className="text-xs text-slate-400">
                Utviklet av Stian Taknæs - <a href="mailto:stian@taknes.no" className="text-emerald-400 hover:underline font-bold">stian@taknes.no</a>
              </p>
            </div>
          </div>
        )}

        {activeTab === 'personvern' && (
          <div className="max-w-2xl mx-auto">
            <h3 className="text-xl font-bold mb-6 text-white">Personvern og GDPR</h3>
            <div className="bg-amber-950/40 border border-amber-500/40 text-amber-200 rounded-2xl p-6 mb-6">
              <h4 className="font-bold mb-2 flex items-center gap-2 text-amber-300">
                <i className="fa-solid fa-shield-halved text-amber-400"></i> 100% lokal datatrygghet
              </h4>
              <p className="text-xs leading-relaxed">
                All data i KlassePlass lagres utelukkende lokalt på din egen PC (SQLite-database). Ingen elevnavn eller annen data sendes til skytjenester eller eksterne servere.
              </p>
            </div>
            
            <div className="bg-base-100/50 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-6 mb-6">
              <h4 className="font-bold text-sm text-slate-200 mb-3">Retningslinjer for skolen</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Behandling av personopplysninger skjer i henhold til skolens interne personvernrutiner og UDIRs retningslinjer for digitale verktøy i skolen.
              </p>
            </div>

            <div className="bg-base-100/50 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h4 className="font-bold text-sm text-slate-200 mb-3">Regelverk og lenker</h4>
              <ul className="flex flex-col gap-3">
                <li>
                  <a
                    href="https://www.udir.no/regelverk-og-tilsyn/personvern-for-barnehage-og-skole/"
                    target="_blank" rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline font-bold text-xs flex items-center gap-2"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    UDIR: Personvern (GDPR) i barnehage og skole
                  </a>
                  <p className="text-xs text-slate-500 mt-1">Utdanningsdirektoratets samleside om hvordan barnehager og skoler skal behandle personopplysninger om barn og elever i tråd med GDPR.</p>
                </li>
                <li>
                  <a
                    href="https://www.udir.no/regelverk-og-tilsyn/personvern-for-barnehage-og-skole/veiledere/personvern-i-skytjenester/"
                    target="_blank" rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline font-bold text-xs flex items-center gap-2"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    UDIR: Veileder om personvern i skytjenester
                  </a>
                  <p className="text-xs text-slate-500 mt-1">Krav til risikovurdering og databehandleravtaler når skolen bruker skytjenester. KlassePlass lagrer alt lokalt og faller utenfor dette, men veilederen er nyttig bakgrunn for skoleeiers helhetlige personvernarbeid.</p>
                </li>
                <li>
                  <a
                    href="https://www.datatilsynet.no/regelverk-og-verktoy/lover-og-regler/om-personopplysningsloven-og-nar-den-gjelder/"
                    target="_blank" rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline font-bold text-xs flex items-center gap-2"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    Datatilsynet: Personopplysningsloven og GDPR i Norge
                  </a>
                  <p className="text-xs text-slate-500 mt-1">Datatilsynets generelle forklaring av personopplysningsloven og EUs personvernforordning (GDPR), og når regelverket gjelder.</p>
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'lisenser' && (
          <div className="max-w-2xl mx-auto">
            <h3 className="text-xl font-bold mb-6 text-white">Tredjepartsbiblioteker & Lisenser</h3>

            <h4 className="font-bold text-sm text-slate-200 mb-2">Kjøretidsbiblioteker (kode som følger med i appen)</h4>
            <div className="overflow-x-auto bg-base-100/50 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl mb-6">
              <table className="table w-full text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-700/80 text-slate-400">
                    <th className="py-3 px-4 text-left">Bibliotek</th>
                    <th className="py-3 px-4 text-left">Lisens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  <tr><td className="py-2.5 px-4 font-semibold">React & React DOM</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">Electron</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">electron-updater</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">dnd kit (core, sortable, utilities)</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">sql.js (SQLite for nettleser/WASM)</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">Font Awesome Free</td><td className="py-2.5 px-4 text-emerald-400">CC BY 4.0 / SIL OFL 1.1 / MIT</td></tr>
                </tbody>
              </table>
            </div>

            <h4 className="font-bold text-sm text-slate-200 mb-2">Byggeverktøy (brukt til å utvikle, style og pakke appen)</h4>
            <div className="overflow-x-auto bg-base-100/50 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl">
              <table className="table w-full text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-700/80 text-slate-400">
                    <th className="py-3 px-4 text-left">Verktøy</th>
                    <th className="py-3 px-4 text-left">Lisens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  <tr><td className="py-2.5 px-4 font-semibold">Vite & @vitejs/plugin-react</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">Tailwind CSS & daisyUI</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">PostCSS & Autoprefixer</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">electron-builder</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                  <tr><td className="py-2.5 px-4 font-semibold">concurrently & wait-on</td><td className="py-2.5 px-4 text-emerald-400">MIT</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      <dialog id="modal_restore_db" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-surface-raised border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-lg text-amber-400 flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation"></i> Gjenopprett database?
          </h3>
          <p className="py-4 text-sm text-slate-300">
            Dette erstatter <strong>hele</strong> den nåværende databasen med innholdet i filen du velger.
            Alle klasser, rom og klassekart som er lagt til etter sikkerhetskopien går tapt.
            Den nåværende databasen tas automatisk vare på som <code>.bak</code> først.
          </p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2 hover:bg-slate-800">Avbryt</button>
            </form>
            <button className="btn btn-warning" onClick={handleRestore}>Velg fil og gjenopprett</button>
          </div>
        </div>
      </dialog>

      <dialog id="modal_move_db" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-surface-raised border border-slate-700 text-slate-100 rounded-2xl">
          <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
            <i className="fa-solid fa-folder-tree text-slate-400"></i> Flytt database?
          </h3>
          <p className="py-4 text-sm text-slate-300">
            Databasefilen flyttes til mappen du velger. Appen må startes på nytt etter flyttingen for at endringen skal tre i kraft.
          </p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost text-slate-400 mr-2 hover:bg-slate-800">Avbryt</button>
            </form>
            <button className="btn btn-primary" onClick={handleMove}>Velg mappe og flytt</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
