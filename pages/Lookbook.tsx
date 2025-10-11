import React, { useRef, useState } from 'react';
import { Look, Lookboard } from '../types';
import { UploadIcon, DownloadIcon, ShareIcon, XIcon, PlusIcon } from '../components/Icons';
import { Button, Modal } from '../components/common';
import LookboardsList from '../components/LookboardsList';
import CreateLookboardModal from '../components/CreateLookboardModal';
import ShareLinkModal from '../components/ShareLinkModal';

interface LookbookProps {
  looks: Look[];
  lookboards: Lookboard[];
  onLooksExport: () => void;
  onLooksImport: (file: File) => void;
  onSelectLook: (lookId: number) => void;
  onLookboardCreated: (boardData: Omit<Lookboard, 'id' | 'publicId'>, lookIds: number[]) => Promise<Lookboard>;
  onLookboardDeleted: (id: number) => void;
}

type Tab = 'looks' | 'boards';

const Lookbook: React.FC<LookbookProps> = ({ looks, lookboards, onLooksExport, onLooksImport, onSelectLook, onLookboardCreated, onLookboardDeleted }) => {
  const importFileRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('looks');
  
  // Selection mode for sharing
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedLookIds, setSelectedLookIds] = useState<Set<number>>(new Set());
  
  // Modals for sharing flow
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isShareLinkModalOpen, setIsShareLinkModalOpen] = useState(false);
  const [lastCreatedBoard, setLastCreatedBoard] = useState<Lookboard | null>(null);


  const handleImportClick = () => {
    importFileRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onLooksImport(file);
    }
    if (importFileRef.current) {
        importFileRef.current.value = '';
    }
  };
  
  const toggleLookSelection = (lookId: number) => {
    setSelectedLookIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(lookId)) {
            newSet.delete(lookId);
        } else {
            newSet.add(lookId);
        }
        return newSet;
    });
  };

  // FIX: The `onLookboardCreated` prop expects a full `Omit<Lookboard, 'id' | 'publicId'>` object.
  // The `boardData` object was missing several required properties (`lookIds`, `feedbacks`, etc.), causing a type error.
  // This has been corrected by constructing the complete object before passing it to the callback.
  const handleCreateBoard = async (title: string, note?: string) => {
    if (selectedLookIds.size === 0) return;
    const boardData: Omit<Lookboard, 'id' | 'publicId'> = {
        title,
        note,
        lookIds: Array.from(selectedLookIds),
        feedbacks: {},
        comments: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    const board = await onLookboardCreated(boardData, Array.from(selectedLookIds));
    setLastCreatedBoard(board);
    setIsCreateModalOpen(false);
    setIsShareLinkModalOpen(true);
    // Reset selection
    setIsSelectionMode(false);
    setSelectedLookIds(new Set());
  };
  
  const handleCardClick = (lookId: number) => {
    if (isSelectionMode) {
      toggleLookSelection(lookId);
    } else {
      onSelectLook(lookId);
    }
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">My Lookbook</h1>
        <div className="flex gap-2">
          <input
            type="file"
            ref={importFileRef}
            onChange={handleFileChange}
            accept="application/json"
            className="hidden"
          />
          <Button onClick={handleImportClick} variant="secondary">
            <UploadIcon /> Import
          </Button>
          <Button onClick={onLooksExport} variant="secondary" disabled={looks.length === 0}>
            <DownloadIcon /> Export
          </Button>
          <Button onClick={() => setIsSelectionMode(true)} variant="primary" disabled={looks.length === 0}>
              <ShareIcon /> Share Looks
          </Button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-700 mb-6">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              <button onClick={() => setActiveTab('looks')} className={`${activeTab === 'looks' ? 'border-zinc-500 text-zinc-600 dark:border-zinc-400 dark:text-zinc-300' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                  My Looks ({looks.length})
              </button>
              <button onClick={() => setActiveTab('boards')} className={`${activeTab === 'boards' ? 'border-zinc-500 text-zinc-600 dark:border-zinc-400 dark:text-zinc-300' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                  Shared Boards ({lookboards.length})
              </button>
          </nav>
      </div>

      {activeTab === 'looks' && (
        <>
          {looks.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
              <p className="text-lg text-zinc-600 dark:text-zinc-400">Your lookbook is empty.</p>
              <p className="text-zinc-500 dark:text-zinc-500 mt-2">Go to the "Create" tab to start your first project.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {looks.map((look) => {
                const isSelected = selectedLookIds.has(look.id!);
                return (
                 <div 
                  key={look.id} 
                  className="group aspect-[3/4] rounded-lg overflow-hidden cursor-pointer relative shadow-sm bg-zinc-100 dark:bg-zinc-800"
                  onClick={() => handleCardClick(look.id!)}
                >
                  <img src={look.finalImage} alt={`Look created on ${new Date(look.createdAt).toLocaleDateString()}`} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
                  <div className={`absolute inset-0 transition-all duration-300 ${isSelectionMode ? 'bg-black/30' : 'bg-black/20 opacity-0 group-hover:opacity-100'}`}></div>
                  {isSelectionMode && (
                    <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-black/30'}`}>
                      {isSelected && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'boards' && (
        <LookboardsList 
            lookboards={lookboards}
            onDelete={onLookboardDeleted}
        />
      )}
      
      {/* Selection Mode Action Bar */}
      {isSelectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-white dark:bg-zinc-800 shadow-2xl rounded-lg p-3 flex items-center gap-4 border border-zinc-200 dark:border-zinc-700">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedLookIds.size} look(s) selected</p>
                <Button variant="secondary" onClick={() => { setIsSelectionMode(false); setSelectedLookIds(new Set()); }}>Cancel</Button>
                <Button variant="primary" onClick={() => setIsCreateModalOpen(true)} disabled={selectedLookIds.size === 0}>Next</Button>
            </div>
        </div>
      )}
      
      <CreateLookboardModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateBoard}
      />
      
      {lastCreatedBoard && (
        <ShareLinkModal
          isOpen={isShareLinkModalOpen}
          onClose={() => setIsShareLinkModalOpen(false)}
          board={lastCreatedBoard}
        />
      )}

    </div>
  );
};

export default Lookbook;