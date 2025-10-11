import React, { useState, useEffect, useCallback } from 'react';
import { Look, Model, Lookboard } from './types';
import * as db from './services/dbService';
import { INITIAL_MODELS } from './initialData';
import CreatorStudio from './pages/CreatorStudio';
import Lookbook from './pages/Lookbook';
import LookDetail from './pages/LookDetail';
import ConversationalEditPage from './pages/ConversationalEditPage';
import LifestyleShootPage from './pages/LifestyleShootPage';
import ViewLookboardPage from './pages/ViewLookboardPage';
import { Button } from './components/common';

type Page = 
  | { name: 'creator' }
  | { name: 'lookbook' }
  | { name: 'look-detail', lookId: number }
  | { name: 'edit-look', lookId: number }
  | { name: 'lifestyle-shoot', lookId: number }
  | { name: 'view-lookboard', publicId: string };

const App: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [lookboards, setLookboards] = useState<Lookboard[]>([]);
  const [currentPage, setCurrentPage] = useState<Page>({ name: 'creator' });
  const [isLoading, setIsLoading] = useState(true);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    console.log('[App] Starting data load...');
    try {
      let dbModels = await db.getAll<Model>('models');
      console.log('[App] Raw models from DB:', JSON.parse(JSON.stringify(dbModels)));
      
      if (dbModels.length === 0) {
        console.log('[App] No models found in DB, adding initial models.');
        await db.bulkAdd('models', INITIAL_MODELS);
        dbModels = await db.getAll<Model>('models');
      }
      const dbLooks = await db.getAll<Look>('looks');
      console.log('[App] Raw looks from DB:', JSON.parse(JSON.stringify(dbLooks)));

      const dbLookboards = await db.getAll<Lookboard>('lookboards');
      console.log('[App] Raw lookboards from DB:', JSON.parse(JSON.stringify(dbLookboards)));
      
      console.log('[App] Starting data sanitization...');
      const sanitizedLooks = dbLooks.map(look => {
          console.log(`[App] Sanitizing look ID: ${look.id}`, look);
          return {
              ...look,
              createdAt: look.createdAt || Date.now(),
              variations: look.variations || [],
          };
      });

      const sanitizedLookboards = dbLookboards.map(board => {
          console.log(`[App] Sanitizing lookboard ID: ${board.id}`, board);
          return {
              ...board,
              createdAt: board.createdAt || Date.now(),
              updatedAt: board.updatedAt || Date.now(),
              lookIds: board.lookIds || [],
              feedbacks: board.feedbacks || {},
              comments: board.comments || {},
          };
      });
      console.log('[App] Data sanitization complete.');
      
      console.log('[App] Setting application state with sanitized data.');
      setModels(dbModels);
      setLooks(sanitizedLooks.sort((a, b) => b.createdAt - a.createdAt));
      setLookboards(sanitizedLookboards.sort((a, b) => b.createdAt - a.createdAt));
      console.log('[App] Data loading process finished successfully.');

    } catch (error) {
      console.error("[App] CRITICAL: Failed to load or sanitize data from IndexedDB:", error);
      setDbError(String(error));
    } finally {
      setIsLoading(false);
      console.log('[App] Loading state set to false.');
    }
  }, []);

  useEffect(() => {
    // Critical: Check for API key presence on startup.
    if (!process.env.API_KEY) {
      console.error("FATAL: API_KEY environment variable is not set.");
      setIsApiKeyMissing(true);
      setIsLoading(false); // Stop loading to show the error
      return;
    }
    
    const path = window.location.pathname;
    const boardMatch = path.match(/\/board\/(.+)/);

    if (boardMatch && boardMatch[1]) {
        // Set page but don't change browser history, as we're just reading it.
        setCurrentPage({ name: 'view-lookboard', publicId: boardMatch[1] });
    }
    loadData();
  }, [loadData]);
  
  const navigate = (page: Page) => {
    setCurrentPage(page);
    if (page.name !== 'view-lookboard') {
        window.history.pushState({}, '', '/');
    }
  };


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
    navigate({ name: 'lookbook' });
  };
  
  const handleLookUpdated = async (updatedLook: Look) => {
    await db.put<Look>('looks', updatedLook);
    setLooks(prev => prev.map(l => l.id === updatedLook.id ? updatedLook : l));
    if (currentPage.name === 'edit-look' || currentPage.name === 'lifestyle-shoot') {
      navigate({ name: 'look-detail', lookId: updatedLook.id! });
    }
  };

  const handleLookDeleted = async (id: number) => {
    await db.remove('looks', id);
    setLooks(prev => prev.filter(l => l.id !== id));
    navigate({ name: 'lookbook' });
  }

  // Lookboard Handlers
  const handleLookboardCreated = async (boardData: Omit<Lookboard, 'id' | 'publicId'>, lookIds: number[]): Promise<Lookboard> => {
    const newBoardData: Omit<Lookboard, 'id'> = {
        ...boardData,
        publicId: crypto.randomUUID(),
        lookIds,
        feedbacks: {},
        comments: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    const newBoard = await db.add<Lookboard>('lookboards', newBoardData);
    setLookboards(prev => [newBoard, ...prev]);
    return newBoard;
  };

  const handleLookboardUpdated = async (updatedBoard: Lookboard) => {
    await db.put<Lookboard>('lookboards', { ...updatedBoard, updatedAt: Date.now() });
    setLookboards(prev => prev.map(b => b.id === updatedBoard.id ? updatedBoard : b));
  };

  const handleLookboardDeleted = async (id: number) => {
    await db.remove('lookboards', id);
    setLookboards(prev => prev.filter(b => b.id !== id));
  };

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
            if (!Array.isArray(importedLooksData) || importedLooksData.some(l => !l.finalImage || !l.products)) {
                throw new Error("Invalid look file format.");
            }
            const importedLooks = importedLooksData.map(({ id, ...rest }) => rest);
            await db.bulkAdd<Look>('looks', importedLooks);
            loadData();
        } catch (error) {
            console.error("Error importing looks:", error);
            alert("Failed to import looks. Please check the file format.");
        }
    };
    reader.readAsText(file);
  };
  
  const handleResetAppData = async () => {
    try {
      await db.deleteDB();
      // Reload the page to start from a clean slate
      window.location.reload();
    } catch (e) {
      alert("Automatic reset failed. Please clear your browser's site data for this page manually in the browser settings.");
      console.error("Failed to delete database:", e);
    }
  };


  const renderPage = () => {
    if (isApiKeyMissing) {
      return (
        <div className="flex flex-col justify-center items-center h-screen text-center p-4">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-500 mb-2">Configuration Error</h2>
          <p className="text-lg text-zinc-700 dark:text-zinc-300">The Gemini API key is missing.</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-md">
            Please ensure the <code>API_KEY</code> environment variable is correctly set in your Vercel project settings and that the deployment has been rebuilt.
          </p>
        </div>
      );
    }
    
    if (dbError) {
        return (
          <div className="flex flex-col justify-center items-center h-screen text-center p-4">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-500 mb-2">Application Error</h2>
            <p className="text-lg text-zinc-700 dark:text-zinc-300">Could not load application data.</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-md">
              This can happen if the local database becomes corrupted. Resetting the application data will resolve this.
            </p>
            <Button onClick={handleResetAppData} variant="danger" className="mt-6">
              Reset Application Data
            </Button>
            <p className="text-xs text-zinc-500 mt-2">This will delete all your saved looks and models.</p>
            <details className="mt-4 max-w-lg text-left">
              <summary className="text-xs text-zinc-500 cursor-pointer">Error Details</summary>
              <pre className="mt-2 text-xs bg-zinc-100 dark:bg-zinc-800 p-2 rounded overflow-auto">{dbError}</pre>
            </details>
          </div>
        );
    }
    
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
          lookboards={lookboards}
          onLooksExport={handleLooksExport}
          onLooksImport={handleLooksImport}
          onSelectLook={(lookId) => navigate({ name: 'look-detail', lookId })}
          onLookboardCreated={handleLookboardCreated}
          onLookboardDeleted={handleLookboardDeleted}
        />;
      case 'look-detail': {
        const look = looks.find(l => l.id === currentPage.lookId);
        return look ? <LookDetail 
          look={look}
          onBack={() => navigate({ name: 'lookbook' })}
          onDelete={handleLookDeleted}
          onUpdate={handleLookUpdated}
          onEdit={() => navigate({ name: 'edit-look', lookId: currentPage.lookId })}
          onLifestyleShoot={() => navigate({ name: 'lifestyle-shoot', lookId: currentPage.lookId })}
        /> : <div>Look not found.</div>;
      }
      case 'edit-look': {
        const look = looks.find(l => l.id === currentPage.lookId);
        return look ? <ConversationalEditPage 
          look={look}
          onBack={() => navigate({ name: 'look-detail', lookId: currentPage.lookId })}
          onSave={handleLookUpdated}
        /> : <div>Look not found.</div>;
      }
      case 'lifestyle-shoot': {
        const look = looks.find(l => l.id === currentPage.lookId);
        return look ? <LifestyleShootPage 
          look={look}
          onBack={() => navigate({ name: 'look-detail', lookId: currentPage.lookId })}
          onSave={handleLookUpdated}
        /> : <div>Look not found.</div>;
      }
      case 'view-lookboard': {
        const lookboard = lookboards.find(lb => lb.publicId === currentPage.publicId);
        if (!lookboard) return <div className="flex justify-center items-center h-screen"><p>Lookboard not found.</p></div>;
        
        // BUGFIX: Defensively check for `lookboard.lookIds` to prevent crashes
        // if the data is from an older version of the app. Default to an empty array.
        const lookIds = lookboard.lookIds || [];
        const boardLooks = looks.filter(l => l.id !== undefined && lookIds.includes(l.id));
        
        return <ViewLookboardPage 
          lookboard={lookboard}
          looks={boardLooks}
          onUpdate={handleLookboardUpdated}
        />;
      }
      default:
        return <div>Page not found.</div>;
    }
  };
  
  const shouldShowNav = currentPage.name !== 'view-lookboard';

  const NavButton: React.FC<{pageName: Page['name'], children: React.ReactNode}> = ({ pageName, children }) => {
    const isActive = currentPage.name === pageName;
    return (
        <button
            onClick={() => navigate({ name: pageName } as Page)}
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
      {shouldShowNav && (
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
      )}
      <main className={shouldShowNav ? "container mx-auto p-4 sm:p-6 lg:p-8" : ""}>
        {renderPage()}
      </main>
    </div>
  );
};

export default App;