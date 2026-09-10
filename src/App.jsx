import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ClassManager from './components/ClassManager';
import RoomEditor from './components/RoomEditor';
import SeatingChart from './components/SeatingChart';
import Settings from './components/Settings';
import GroupEditor from './components/GroupEditor';
import StationOverview from './components/StationOverview';
import StationSetup from './components/StationSetup';
import StationPresenter from './components/StationPresenter';
import UpdateBanner from './components/UpdateBanner';
import UpdateModal from './components/UpdateModal';
import WhatsNewModal from './components/WhatsNewModal';
import OnboardingGuide from './components/OnboardingGuide';
import GlobalTooltip from './components/GlobalTooltip';
import { ClassesOverview, RoomsOverview, SeatingOverview, GroupOverview } from './components/OverviewViews';
import { showToast } from './shared/utils';
import { foldLegacyConstraints } from './shared/ruleConstraints.mjs';

// Engangs-migrering: eldre versjoner kunne få rader i student_constraints-
// tabellen via bundle-import. Regler bor nå kun i klassens `rules`-blob, så vi
// folder eventuelle slike rader inn i blobben én gang og setter et flagg.
// Feiler trygt: flagget blir stående usatt, så den prøver igjen neste oppstart.
async function foldLegacyConstraintsOnce() {
  const classes = await window.api.getClasses();
  for (const c of classes || []) {
    try {
      const rows = await window.api.getConstraints(c.id);
      if (!rows || rows.length === 0) continue;
      const full = await window.api.getClass(c.id);
      const parsed = full?.students ? JSON.parse(full.students) : { students: [], rules: [] };
      const blob = Array.isArray(parsed) ? { students: parsed, rules: [] } : parsed;
      const folded = foldLegacyConstraints(blob, rows);
      if (folded !== blob) {
        await window.api.saveClass({ id: c.id, name: c.name, students: JSON.stringify(folded) });
      }
    } catch (e) {
      console.error('constraint-fold feilet for klasse', c?.id, e);
    }
  }
  await window.api.saveSettings({ constraintsFoldComplete: true });
}

function App() {
  const [currentView, setCurrentView] = useState('classes-overview');
  const [editId, setEditId] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  // Bruk lagret tema fra første render - index.html har "klasseplass" som
  // statisk fallback for aller første maling, før innstillingene er hentet.
  useEffect(() => {
    window.api?.getSettings?.().then((s) => {
      if (s?.theme) document.documentElement.setAttribute('data-theme', s.theme);
      if (!s?.onboardingCompleted) setShowOnboarding(true);

      if (s?.constraintsFoldComplete !== true) {
        foldLegacyConstraintsOnce().catch((e) => console.error('constraint-fold (oppstart) feilet, prøver igjen neste gang', e));
      }

      // "Hva er nytt"-popup: vises KUN når appen nettopp ble oppdatert (lagret
      // `lastSeenVersion` fra forrige oppstart avviker fra kjørende versjon) -
      // ikke ved aller første installasjon (da finnes ingen lastSeenVersion
      // ennå, og det ville vært misvisende å kalle det en "oppdatering").
      window.api?.getVersion?.().then((currentVersion) => {
        if (!currentVersion) return;
        if (s?.lastSeenVersion && s.lastSeenVersion !== currentVersion) {
          setShowWhatsNew(true);
        }
        if (s?.lastSeenVersion !== currentVersion) {
          window.api?.saveSettings?.({ lastSeenVersion: currentVersion }).catch(() => {});
        }
      }).catch(() => {});
    }).catch(() => {});

    // Varsle brukeren dersom databasen nettopp ble migrert til nyere
    // schema-versjon — en sikkerhetskopi av den forrige versjonen ble tatt.
    window.api?.getMigrationInfo?.().then((info) => {
      if (info) {
        showToast(`Databasen ble oppdatert (v${info.fromVersion} → v${info.toVersion}). Sikkerhetskopi lagret ved siden av databasefilen.`, 'info');
      }
    }).catch(() => {});
  }, []);

  const handleEdit = (view, id) => {
    setEditId(id);
    setCurrentView(view);
  };

  const handleAdd = (view) => {
    setEditId('new');
    setCurrentView(view);
  };

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    window.api?.saveSettings?.({ onboardingCompleted: true }).catch(() => {
      showToast('Kunne ikke lagre at veiledningen er fullført. Den kan dukke opp igjen neste gang.', 'error');
    });
  };

  const renderView = () => {
    switch(currentView) {
      case 'classes-overview': return <ClassesOverview onEdit={(id) => handleEdit('classes', id)} />;
      case 'rooms-overview': return <RoomsOverview onEdit={(id) => handleEdit('rooms', id)} onAdd={() => handleAdd('rooms')} />;
      case 'seating-overview': return <SeatingOverview onEdit={(id) => handleEdit('seating', id)} onAdd={() => handleAdd('seating')} />;
      case 'group-overview': return <GroupOverview onEdit={(id) => handleEdit('group-editor', id)} />;
      case 'station-overview': return <StationOverview onEdit={(id) => handleEdit('station-setup', id)} onAdd={() => handleAdd('station-setup')} onPrint={(id) => handleEdit('station-presenter', id)} />;
      case 'classes': return <ClassManager initialId={editId} onBack={() => setCurrentView('classes-overview')} />;
      case 'rooms': return <RoomEditor initialId={editId} onBack={() => setCurrentView('rooms-overview')} />;
      case 'seating': return <SeatingChart initialId={editId} onBack={() => setCurrentView('seating-overview')} />;
      case 'group-editor': return <GroupEditor initialId={editId} onBack={() => setCurrentView('group-overview')} />;
      case 'station-setup': return <StationSetup initialId={editId} onBack={() => setCurrentView('station-overview')} onStartPresenting={(id) => { setEditId(id); setCurrentView('station-presenter'); }} />;
      case 'station-presenter': return <StationPresenter initialId={editId} onBack={() => setCurrentView('station-setup')} />;
      case 'settings': return <Settings />;
      default: return <div>Not found</div>;
    }
  };

  return (
    <div id="app-shell" className="h-full w-full">
      <Layout
        currentView={currentView}
        setCurrentView={(v) => { setEditId(null); setCurrentView(v); }}
        onOpenOnboarding={() => setShowOnboarding(true)}
        onOpenUpdateModal={() => setShowUpdateModal(true)}
      >
        {renderView()}
      </Layout>
      <UpdateBanner />
      <UpdateModal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} />
      <WhatsNewModal isOpen={showWhatsNew} onClose={() => setShowWhatsNew(false)} />
      {showOnboarding && <OnboardingGuide onClose={handleCloseOnboarding} />}
      <GlobalTooltip />
    </div>
  );
}

export default App;
