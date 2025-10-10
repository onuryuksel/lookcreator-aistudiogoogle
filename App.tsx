import React, { useState, useEffect, useCallback } from 'react';
import { Look, Model } from './types';
import * as db from './services/dbService';
import { INITIAL_MODELS } from './initialData';
import CreatorStudio from './pages/CreatorStudio';
import Lookbook from './pages/Lookbook';
import LookDetail from './pages/LookDetail';
import ConversationalEditPage from './pages/ConversationalEditPage';
import LifestyleShootPage from './pages/LifestyleShootPage';

type Page = 
  | { name: 'creator' }
  | { name: 'lookbook' }
  | { name: 'look-detail', lookId: number }
  | { name: 'edit-look', lookId: number }
  | { name: 'lifestyle-shoot', lookId: number };

const App: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [currentPage, setCurrentPage] = useState<Page>({ name: 'creator' });
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      let dbModels = await db.getAll<Model>('models');
      if (dbModels.length === 0) {
        await db.bulkAdd('models', INITIAL_MODELS);
        dbModels = await db.getAll<Model>('models');
      }
      const dbLooks = await db.getAll<Look>('looks');
      
      setModels(dbModels);
      // Sort looks by newest first
      setLooks(dbLooks.sort((a, b) => b.createdAt - a.createdAt));

    } catch (error) {
      console.error("Failed to load data from IndexedDB:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Model Handlers
  const handleModelCreated = async (modelData: Omit<Model, 'id'>): Promise<Model> => {
    const newModel = await db.add<Model>('models', modelData);
    setModels(prev => [...prev, newModel]);
    return newModel;
  };

  const handleModelDeleted = async (id: number) => {
    await db.remove('models', id);
    setModels(prev => prev.filter(m => m.id !== id));
  };

  // Look Handlers
  const handleLookSaved = async (lookData: Omit<Look, 'id'>) => {
    const newLook = await db.add<Look>('looks', lookData);
    setLooks(prev => [newLook, ...prev]);
    // Navigate to lookbook to see the new creation
    setCurrentPage({ name: 'lookbook' });
  };
  
  const handleLookUpdated = async (updatedLook: Look) => {
    await db.put<Look>('looks', updatedLook);
    setLooks(prev => prev.map(l => l.id === updatedLook.id ? updatedLook : l));
    // If the user is on the edit page, navigate back to detail view
    if (currentPage.name === 'edit-look' || currentPage.name === 'lifestyle-shoot') {
      setCurrentPage({ name: 'look-detail', lookId: updatedLook.id! });
    }
  };

  const handleLookDeleted = async (id: number) => {
    await db.remove('looks', id);
    setLooks(prev => prev.filter(l => l.id !== id));
    setCurrentPage({ name: 'lookbook' });
  }

  // Lookbook Import/Export
  const handleLooksExport = () => {
    const dataStr = JSON.stringify(looks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'ounass_ai_studio_looks.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleLooksImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const importedLooksData = JSON.parse(event.target?.result as string) as Look[];
            // Basic validation
            if (!Array.isArray(importedLooksData) || importedLooksData.some(l => !l.finalImage || !l.products)) {
                throw new Error("Invalid look file format.");
            }
            // FIX: Remove 'id' before bulk adding to prevent ConstraintError
            const importedLooks = importedLooksData.map(({ id, ...rest }) => rest);
            await db.bulkAdd<Look>('looks', importedLooks);
            loadData(); // Reload all data
        } catch (error) {
            console.error("Error importing looks:", error);
            alert("Failed to import looks. Please check the file format.");
        }
    };
    reader.readAsText(file);
  };

  const renderPage = () => {
    if (isLoading) {
      return <div className="flex justify-center items-center h-screen"><p>Loading Studio...</p></div>;
    }

    switch (currentPage.name) {
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
          onLooksExport={handleLooksExport}
          onLooksImport={handleLooksImport}
          onSelectLook={(lookId) => setCurrentPage({ name: 'look-detail', lookId })}
        />;
      case 'look-detail': {
        const look = looks.find(l => l.id === currentPage.lookId);
        return look ? <LookDetail 
          look={look}
          onBack={() => setCurrentPage({ name: 'lookbook' })}
          onDelete={handleLookDeleted}
          onUpdate={handleLookUpdated}
          onEdit={() => setCurrentPage({ name: 'edit-look', lookId: currentPage.lookId })}
          onLifestyleShoot={() => setCurrentPage({ name: 'lifestyle-shoot', lookId: currentPage.lookId })}
        /> : <div>Look not found.</div>;
      }
      case 'edit-look': {
        const look = looks.find(l => l.id === currentPage.lookId);
        return look ? <ConversationalEditPage 
          look={look}
          onBack={() => setCurrentPage({ name: 'look-detail', lookId: currentPage.lookId })}
          onSave={handleLookUpdated}
        /> : <div>Look not found.</div>;
      }
      case 'lifestyle-shoot': {
        const look = looks.find(l => l.id === currentPage.lookId);
        return look ? <LifestyleShootPage 
          look={look}
          onBack={() => setCurrentPage({ name: 'look-detail', lookId: currentPage.lookId })}
          onSave={handleLookUpdated}
        /> : <div>Look not found.</div>;
      }
      default:
        return <div>Page not found.</div>;
    }
  };

  const NavButton: React.FC<{pageName: Page['name'], children: React.ReactNode}> = ({ pageName, children }) => {
    const isActive = currentPage.name === pageName;
    return (
        <button
            onClick={() => setCurrentPage({ name: pageName } as Page)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                ? 'bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
        >
            {children}
        </button>
    );
  }

  return (
    <div className="bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen font-sans">
      <header className="bg-white dark:bg-zinc-900 shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <h1 className="text-xl font-bold tracking-tight">Ounass AI Studio</h1>
            <nav className="flex items-center gap-2">
                <NavButton pageName="creator">Create</NavButton>
                <NavButton pageName="lookbook">My Lookbook</NavButton>
            </nav>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;