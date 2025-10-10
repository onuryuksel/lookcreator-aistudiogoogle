import React, { useState, useEffect, useCallback } from 'react';
import CreatorStudio from './pages/CreatorStudio';
import Lookbook from './pages/Lookbook';
import LookDetail from './pages/LookDetail';
import ConversationalEditPage from './pages/ConversationalEditPage';
import { Model, Look } from './types';
import * as dbService from './services/dbService';
import { INITIAL_MODELS } from './initialData';
import { WandSparklesIcon, BookOpenIcon, SunIcon, MoonIcon } from './components/Icons';

type View = 'creator' | 'lookbook' | 'lookDetail' | 'conversationalEdit';

const App: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [currentView, setCurrentView] = useState<View>('creator');
  const [selectedLookId, setSelectedLookId] = useState<number | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const loadData = useCallback(async () => {
    try {
      let dbModels = await dbService.getAll<Model>('models');
      if (dbModels.length === 0) {
        await dbService.bulkAdd('models', INITIAL_MODELS);
        dbModels = await dbService.getAll<Model>('models');
      }
      const dbLooks = await dbService.getAll<Look>('looks');

      setModels(dbModels);
      setLooks(dbLooks.sort((a, b) => b.createdAt - a.createdAt)); // Sort by newest first
    } catch (error) {
      console.error("Failed to load data from IndexedDB:", error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleModelCreated = async (modelData: Omit<Model, 'id'>): Promise<Model> => {
    const newModel = await dbService.add<Model>('models', modelData);
    setModels(prev => [...prev, newModel]);
    return newModel;
  };

  const handleModelDeleted = async (id: number) => {
    await dbService.remove('models', id);
    setModels(prev => prev.filter(m => m.id !== id));
  };

  const handleLookSaved = async (lookData: Omit<Look, 'id'>) => {
    const newLook = await dbService.add<Look>('looks', lookData);
    setLooks(prev => [newLook, ...prev]);
    setCurrentView('lookbook');
  };
  
  const handleLookUpdated = async (updatedLook: Look) => {
    await dbService.put<Look>('looks', updatedLook);
    setLooks(prev => prev.map(l => l.id === updatedLook.id ? updatedLook : l));
    setSelectedLookId(updatedLook.id!);
    setCurrentView('lookDetail');
  }

  const handleLookDeleted = async (id: number) => {
    await dbService.remove('looks', id);
    setLooks(prev => prev.filter(l => l.id !== id));
    setCurrentView('lookbook');
  };

  const handleSelectLook = (lookId: number) => {
    setSelectedLookId(lookId);
    setCurrentView('lookDetail');
  };
  
  const handleNavigateToEdit = (lookId: number) => {
    setSelectedLookId(lookId);
    setCurrentView('conversationalEdit');
  }

  const handleExportLooks = () => {
    const dataStr = JSON.stringify(looks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'ounass_lookbook.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  
  const handleImportLooks = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const looksToImport = JSON.parse(event.target?.result as string) as Omit<Look, 'id'>[];
        // Basic validation
        if (Array.isArray(looksToImport) && looksToImport.every(l => l.finalImage && l.products)) {
          await dbService.bulkAdd<Look>('looks', looksToImport);
          await loadData(); // Reload all data to reflect imports
        } else {
          alert('Invalid lookbook file format.');
        }
      } catch (error) {
        console.error("Error importing looks:", error);
        alert('Failed to import lookbook file.');
      }
    };
    reader.readAsText(file);
  };


  const renderContent = () => {
    const selectedLook = looks.find(l => l.id === selectedLookId);

    switch (currentView) {
      case 'creator':
        return <CreatorStudio 
                  models={models} 
                  onLookSaved={handleLookSaved} 
                  onModelCreated={handleModelCreated} 
                  onModelDeleted={handleModelDeleted}
               />;
      case 'lookbook':
        return <Lookbook 
                  looks={looks} 
                  onLooksExport={handleExportLooks}
                  onLooksImport={handleImportLooks}
                  onSelectLook={handleSelectLook}
               />;
      case 'lookDetail':
        if (selectedLook) {
          return <LookDetail 
                    look={selectedLook} 
                    onBack={() => setCurrentView('lookbook')} 
                    onDelete={handleLookDeleted} 
                    onNavigateToEdit={handleNavigateToEdit}
                  />
        }
        return null;
      case 'conversationalEdit':
        if (selectedLook) {
          return <ConversationalEditPage 
                    look={selectedLook}
                    onBack={() => {setSelectedLookId(selectedLook.id!); setCurrentView('lookDetail');}}
                    onSave={handleLookUpdated}
                 />
        }
        return null;
      default:
        return <CreatorStudio models={models} onLookSaved={handleLookSaved} onModelCreated={handleModelCreated} onModelDeleted={handleModelDeleted}/>;
    }
  };

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen font-sans">
      <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-40">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <span className="font-bold text-xl tracking-tight">Ounass Look Creator</span>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentView('creator')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'creator' ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                <WandSparklesIcon /> Create
              </button>
              <button onClick={() => setCurrentView('lookbook')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'lookbook' || currentView === 'lookDetail' || currentView === 'conversationalEdit' ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                <BookOpenIcon /> Lookbook
              </button>
              <button onClick={toggleTheme} className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
              </button>
            </div>
          </div>
        </nav>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
