
import React, { useState, useEffect } from 'react';
import CreatorStudio from './pages/CreatorStudio';
import Lookbook from './pages/Lookbook';
import LookDetail from './pages/LookDetail';
import ConversationalEditPage from './pages/ConversationalEditPage';
import LifestyleShootPage from './pages/LifestyleShootPage';
import ViewLookboardPage from './pages/ViewLookboardPage';
import { Model, Look, Lookboard } from './types';
import * as db from './services/dbService';

// Main application component
const App: React.FC = () => {
    // State management for core application data
    const [models, setModels] = useState<Model[]>([]);
    const [looks, setLooks] = useState<Look[]>([]);
    const [lookboards, setLookboards] = useState<Lookboard[]>([]);

    // Simple state-based routing to manage different views
    type Page = 
      | { name: 'creator' }
      | { name: 'lookbook' }
      | { name: 'look-detail', id: number }
      | { name: 'edit-look', id: number }
      | { name: 'lifestyle-shoot', id: number }
      | { name: 'view-board', publicId: string };

    const [page, setPage] = useState<Page>({ name: 'creator' });
    const [isLoading, setIsLoading] = useState(true);

    // Effect for initial data loading and routing based on URL path
    useEffect(() => {
        const path = window.location.pathname;
        const boardMatch = path.match(/^\/board\/([a-zA-Z0-9-]+)$/);

        // Load all data from dbService (localStorage)
        const loadedModels = db.getModels();
        const loadedLooks = db.getLooks();
        const loadedLookboards = db.getLookboards();

        setModels(loadedModels);
        setLooks(loadedLooks);
        setLookboards(loadedLookboards);

        // Check if the URL is for a public lookboard
        if (boardMatch) {
            const publicId = boardMatch[1];
            setPage({ name: 'view-board', publicId });
        } else {
            // Default to the creator studio page
            setPage({ name: 'creator' });
        }
        setIsLoading(false);
    }, []);
    
    // --- Data Mutation Handlers ---

    const handleModelCreated = async (modelData: Omit<Model, 'id'>): Promise<Model> => {
        const newModel = await db.addModel(modelData);
        setModels(prev => [...prev, newModel]);
        return newModel;
    };

    const handleModelDeleted = (id: number) => {
        db.deleteModel(id);
        setModels(prev => prev.filter(m => m.id !== id));
    };

    const handleLookSaved = (lookData: Omit<Look, 'id'>) => {
        const newLook = db.addLook(lookData);
        setLooks(prev => [newLook, ...prev]);
        setPage({ name: 'lookbook' });
    };
    
    const handleLookUpdated = (updatedLook: Look) => {
        db.updateLook(updatedLook);
        setLooks(prev => prev.map(l => l.id === updatedLook.id ? updatedLook : l));
    };

    const handleLookDeleted = (id: number) => {
        db.deleteLook(id);
        setLooks(prev => prev.filter(l => l.id !== id));
        setPage({ name: 'lookbook' });
    };

    const handleLookboardCreated = async (boardData: Omit<Lookboard, 'id' | 'publicId'>, lookIds: number[]): Promise<Lookboard> => {
        const publicId = `board-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const newBoardData = { ...boardData, publicId, lookIds };
        const newBoard = db.addLookboard(newBoardData);
        setLookboards(prev => [newBoard, ...prev]);
        return newBoard;
    };

    const handleLookboardDeleted = (id: number) => {
        db.deleteLookboard(id);
        setLookboards(prev => prev.filter(b => b.id !== id));
    };
    
    const handleLookboardUpdated = (updatedBoard: Lookboard) => {
        db.updateLookboard(updatedBoard);
        setLookboards(prev => prev.map(b => b.id === updatedBoard.id ? updatedBoard : b));
    };
    
    // --- Import/Export Handlers ---

    const handleExportLooks = () => {
        const dataStr = JSON.stringify({ looks, models }, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'ounass-lookbook.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const handleImportLooks = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (json.looks && Array.isArray(json.looks) && json.models && Array.isArray(json.models)) {
                    // Simple merge: add new items, don't update existing ones with same ID
                    const newLooks = [...looks, ...json.looks.filter((impL: Look) => !looks.some(exL => exL.id === impL.id))];
                    const newModels = [...models, ...json.models.filter((impM: Model) => !models.some(exM => exM.id === impM.id))];
                    
                    db.saveLooks(newLooks);
                    db.saveModels(newModels);
                    setLooks(newLooks);
                    setModels(newModels);
                    alert(`${json.looks.length} looks and ${json.models.length} models imported successfully!`);
                } else {
                    alert('Invalid import file format.');
                }
            } catch (error) {
                alert('Error parsing import file.');
                console.error("Import error:", error);
            }
        };
        reader.readAsText(file);
    };

    // --- Page Rendering Logic ---

    const renderPage = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-screen"><p>Loading Studio...</p></div>;
        }

        switch (page.name) {
            case 'creator':
                return <CreatorStudio models={models} onLookSaved={handleLookSaved} onModelCreated={handleModelCreated} onModelDeleted={handleModelDeleted} />;
            
            case 'lookbook':
                return <Lookbook 
                    looks={looks} 
                    lookboards={lookboards}
                    onLooksExport={handleExportLooks}
                    onLooksImport={handleImportLooks}
                    onSelectLook={(id) => setPage({ name: 'look-detail', id })}
                    onLookboardCreated={handleLookboardCreated}
                    onLookboardDeleted={handleLookboardDeleted}
                />;
            
            case 'look-detail':
                const lookToDetail = looks.find(l => l.id === page.id);
                if (!lookToDetail) return <p>Error: Look not found. <button onClick={() => setPage({ name: 'lookbook' })}>Go back</button></p>;
                return <LookDetail 
                    look={lookToDetail}
                    onBack={() => setPage({ name: 'lookbook' })}
                    onDelete={handleLookDeleted}
                    onUpdate={handleLookUpdated}
                    onEdit={() => setPage({ name: 'edit-look', id: page.id })}
                    onLifestyleShoot={() => setPage({ name: 'lifestyle-shoot', id: page.id })}
                />;
            
            case 'edit-look':
                 const lookToEdit = looks.find(l => l.id === page.id);
                if (!lookToEdit) return <p>Error: Look not found. <button onClick={() => setPage({ name: 'lookbook' })}>Go back</button></p>;
                return <ConversationalEditPage 
                    look={lookToEdit}
                    onBack={() => setPage({ name: 'look-detail', id: page.id })}
                    onSave={(updatedLook) => {
                        handleLookUpdated(updatedLook);
                        setPage({ name: 'look-detail', id: page.id });
                    }}
                />;
            
            case 'lifestyle-shoot':
                const lookToShoot = looks.find(l => l.id === page.id);
                if (!lookToShoot) return <p>Error: Look not found. <button onClick={() => setPage({ name: 'lookbook' })}>Go back</button></p>;
                return <LifestyleShootPage 
                    look={lookToShoot}
                    onBack={() => setPage({ name: 'look-detail', id: page.id })}
                    onSave={(updatedLook) => {
                        handleLookUpdated(updatedLook);
                        setPage({ name: 'look-detail', id: page.id });
                    }}
                />;
            
            case 'view-board':
                const boardToView = db.findLookboardByPublicId(page.publicId);
                if (!boardToView) return <div className="text-center p-8"><p className="text-2xl">Lookboard not found.</p><p>The link may be invalid or the board may have been deleted.</p></div>;
                const boardLooks = looks.filter(l => (boardToView.lookIds || []).includes(l.id!));
                return <ViewLookboardPage 
                    lookboard={boardToView}
                    looks={boardLooks}
                    onUpdate={handleLookboardUpdated}
                />;
            
            default:
                return <p>Page not found</p>;
        }
    };

    // Render the public lookboard page without the main app shell
    if (page.name === 'view-board') {
        return renderPage();
    }
    
    // Render the main application shell with navigation
    return (
        <div className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans min-h-screen">
          <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-40">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex-shrink-0 font-bold text-lg">
                  Ounass AI Studio
                </div>
                <nav className="hidden md:flex md:space-x-8">
                  <button onClick={() => setPage({ name: 'creator' })} className={`font-medium transition-colors ${page.name === 'creator' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}>
                    Creator Studio
                  </button>
                  <button onClick={() => setPage({ name: 'lookbook' })} className={`font-medium transition-colors ${['lookbook', 'look-detail', 'edit-look', 'lifestyle-shoot'].includes(page.name) ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}>
                    My Lookbook
                  </button>
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
