import React, { useState, useEffect, useCallback } from 'react';
import CreatorStudio from './pages/CreatorStudio';
import Lookbook from './pages/Lookbook';
import LookDetail from './pages/LookDetail';
import ConversationalEditPage from './pages/ConversationalEditPage';
import LifestyleShootPage from './pages/LifestyleShootPage';
import ViewLookboardPage from './pages/ViewLookboardPage';
import { Model, Look, Lookboard } from './types';
import * as db from './services/dbService';
import { Spinner } from './components/common';

type AppView = 'creator' | 'lookbook';
type EditingMode = 'none' | 'conversational' | 'lifestyle';

const App: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [lookboards, setLookboards] = useState<Lookboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- START: Navigation State ---
  const [activeTab, setActiveTab] = useState<AppView>('creator');
  const [selectedLookId, setSelectedLookId] = useState<number | null>(null);
  const [editingMode, setEditingMode] = useState<EditingMode>('none');
  // --- END: Navigation State ---

  // --- START: Public Board Viewing State ---
  const [viewingBoard, setViewingBoard] = useState<{ board: Lookboard; looks: Look[] } | null>(null);
  // --- END: Public Board Viewing State ---

  const selectedLook = looks.find(l => l.id === selectedLookId);

  // --- START: Data Loading ---
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await db.initDB();
      const dbModels = await db.getAllModels();
      setModels(dbModels);
      setLooks(await db.getAllLooks());
      setLookboards(await db.getAllLookboards());
    } catch (error) {
      console.error("Failed to load data from IndexedDB:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePublicBoardRoute = useCallback(async () => {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts[0] === 'board' && pathParts[1]) {
      const publicId = pathParts[1];
      setIsLoading(true);
      try {
        const board = await db.getLookboardByPublicId(publicId);
        if (board) {
          const boardLooks = await Promise.all(
            board.lookIds.map(id => db.getById<Look>('looks', id))
          );
          setViewingBoard({ board, looks: boardLooks.filter(Boolean) });
        } else {
          // Handle board not found
          console.error(`Lookboard with public ID ${publicId} not found.`);
        }
      } catch (error) {
        console.error("Failed to load public lookboard:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      loadData();
    }
  }, [loadData]);


  useEffect(() => {
    handlePublicBoardRoute();
  }, [handlePublicBoardRoute]);
  // --- END: Data Loading ---


  // --- START: Model Handlers ---
  const handleModelCreated = async (modelData: Omit<Model, 'id'>): Promise<Model> => {
    const newId = await db.addModel(modelData);
    const newModel = { ...modelData, id: newId };
    setModels(prev => [...prev, newModel]);
    return newModel;
  };
  const handleModelDeleted = async (id: number) => {
    await db.deleteModel(id);
    setModels(prev => prev.filter(m => m.id !== id));
  };
  // --- END: Model Handlers ---


  // --- START: Look Handlers ---
  const handleLookSaved = async (lookData: Omit<Look, 'id'>) => {
    const newId = await db.addLook(lookData);
    const newLook = { ...lookData, id: newId };
    setLooks(prev => [...prev, newLook]);
    setActiveTab('lookbook');
  };
  const handleLookUpdated = async (updatedLook: Look) => {
    await db.updateLook(updatedLook);
    setLooks(prev => prev.map(l => l.id === updatedLook.id ? updatedLook : l));
  };
  const handleLookDeleted = async (id: number) => {
    await db.deleteLook(id);
    setLooks(prev => prev.filter(l => l.id !== id));
    setSelectedLookId(null);
  };
  // --- END: Look Handlers ---


  // --- START: Lookboard Handlers ---
  const handleLookboardCreated = async (boardData: Omit<Lookboard, 'id' | 'publicId'>): Promise<Lookboard> => {
      const publicId = `ounass-ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newBoardData = { ...boardData, publicId };
      const newId = await db.addLookboard(newBoardData);
      const newBoard = { ...newBoardData, id: newId };
      setLookboards(prev => [...prev, newBoard]);
      return newBoard;
  };

  const handleLookboardDeleted = async (id: number) => {
      await db.deleteLookboard(id);
      setLookboards(prev => prev.filter(b => b.id !== id));
  };
  const handleLookboardUpdated = async (updatedBoard: Lookboard) => {
    await db.updateLookboard(updatedBoard);
    // This is for client-side updates on the public board view
    if (viewingBoard && viewingBoard.board.id === updatedBoard.id) {
        setViewingBoard(prev => prev ? { ...prev, board: updatedBoard } : null);
    }
    setLookboards(prev => prev.map(b => b.id === updatedBoard.id ? updatedBoard : b));
  };
  // --- END: Lookboard Handlers ---


  // --- START: File Import/Export Handlers ---
  const handleLooksExport = () => {
    const dataStr = JSON.stringify({ looks }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.download = `ounass-lookbook-export-${new Date().toISOString()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLooksImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedData.looks)) {
          const newLooks: Look[] = [];
          for (const look of importedData.looks) {
            // Remove ID to let IndexedDB assign a new one
            const { id, ...lookData } = look;
            const newId = await db.addLook(lookData);
            newLooks.push({ ...lookData, id: newId });
          }
          setLooks(prev => [...prev, ...newLooks]);
          alert(`${newLooks.length} looks imported successfully!`);
        } else {
          throw new Error('Invalid file format.');
        }
      } catch (error) {
        console.error("Import failed:", error);
        alert('Import failed. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };
  // --- END: File Import/Export Handlers ---

  // --- START: Render Logic ---
  const renderContent = () => {
    if (isLoading && !viewingBoard) {
      return (
        <div className="flex justify-center items-center h-full pt-20">
          <Spinner />
          <p className="ml-4 text-zinc-600 dark:text-zinc-400">Loading your studio...</p>
        </div>
      );
    }

    if (viewingBoard) {
      return (
        <ViewLookboardPage
          lookboard={viewingBoard.board}
          looks={viewingBoard.looks}
          onUpdate={handleLookboardUpdated}
        />
      );
    }

    if (selectedLook) {
      if (editingMode === 'conversational') {
        return <ConversationalEditPage
          look={selectedLook}
          onBack={() => setEditingMode('none')}
          onSave={(updatedLook) => {
            handleLookUpdated(updatedLook);
            setEditingMode('none');
          }}
        />;
      }
      if (editingMode === 'lifestyle') {
        return <LifestyleShootPage
          look={selectedLook}
          onBack={() => setEditingMode('none')}
          onSave={(updatedLook) => {
            handleLookUpdated(updatedLook);
            setEditingMode('none');
          }}
        />;
      }
      return <LookDetail
        look={selectedLook}
        onBack={() => setSelectedLookId(null)}
        onDelete={handleLookDeleted}
        onUpdate={handleLookUpdated}
        onEdit={() => setEditingMode('conversational')}
        onLifestyleShoot={() => setEditingMode('lifestyle')}
      />;
    }

    switch (activeTab) {
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
          onSelectLook={setSelectedLookId}
          onLookboardCreated={handleLookboardCreated}
          onLookboardDeleted={handleLookboardDeleted}
        />;
      default:
        return null;
    }
  };

  if (viewingBoard) {
    return renderContent();
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <header className="bg-white dark:bg-zinc-900 shadow-sm sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold tracking-tight">Ounass AI Studio</h1>
            </div>
            <nav className="flex space-x-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
              <button
                onClick={() => { setActiveTab('creator'); setSelectedLookId(null); }}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'creator' && !selectedLookId ? 'bg-white dark:bg-zinc-900 shadow-sm' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
              >
                Create
              </button>
              <button
                onClick={() => { setActiveTab('lookbook'); setSelectedLookId(null); }}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'lookbook' && !selectedLookId ? 'bg-white dark:bg-zinc-900 shadow-sm' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
              >
                Lookbook
              </button>
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;