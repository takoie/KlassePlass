import React, { useState } from 'react';
import Layout from './components/Layout';
import ClassManager from './components/ClassManager';
import RoomEditor from './components/RoomEditor';
import SeatingChart from './components/SeatingChart';
import Settings from './components/Settings';
import GroupEditor from './components/GroupEditor';
import { ClassesOverview, RoomsOverview, SeatingOverview, GroupOverview } from './components/OverviewViews';

function App() {
  const [currentView, setCurrentView] = useState('classes-overview');
  const [editId, setEditId] = useState(null);

  const handleEdit = (view, id) => {
    setEditId(id);
    setCurrentView(view);
  };

  const handleAdd = (view) => {
    setEditId('new');
    setCurrentView(view);
  };

  const renderView = () => {
    switch(currentView) {
      case 'classes-overview': return <ClassesOverview onEdit={(id) => handleEdit('classes', id)} onAdd={() => handleAdd('classes')} />;
      case 'rooms-overview': return <RoomsOverview onEdit={(id) => handleEdit('rooms', id)} onAdd={() => handleAdd('rooms')} />;
      case 'seating-overview': return <SeatingOverview onEdit={(id) => handleEdit('seating', id)} onAdd={() => handleAdd('seating')} />;
      case 'group-overview': return <GroupOverview onEdit={(id) => handleEdit('group-editor', id)} />;
      case 'classes': return <ClassManager initialId={editId} onBack={() => setCurrentView('classes-overview')} />;
      case 'rooms': return <RoomEditor initialId={editId} onBack={() => setCurrentView('rooms-overview')} />;
      case 'seating': return <SeatingChart initialId={editId} onBack={() => setCurrentView('seating-overview')} />;
      case 'group-editor': return <GroupEditor initialId={editId} onBack={() => setCurrentView('group-overview')} />;
      case 'settings': return <Settings />;
      default: return <div>Not found</div>;
    }
  };

  return (
    <div id="app-shell" className="h-full w-full">
      <Layout currentView={currentView} setCurrentView={(v) => { setEditId(null); setCurrentView(v); }}>
        {renderView()}
      </Layout>
    </div>
  );
}

export default App;
