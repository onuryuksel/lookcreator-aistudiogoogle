import React, { useState } from 'react';
import { Look, Lookboard, LookOverrides } from '../types';
import * as db from '../services/dbService';
import { Button } from '../components/common';
import LookboardsList from '../components/LookboardsList';
import CreateLookboardModal from '../components/CreateLookboardModal';
import ShareOptionsModal from '../components/ShareOptionsModal';
import { PlusIcon, ShareIcon } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface LookbookProps {
  looks: Look[];
  lookboards: Lookboard[];
  lookOverrides: LookOverrides;
  onSelectLook: (look: Look) => void;
  onUpdateLookboards: (boards: Lookboard[]) => Promise<void>;
  onEditLookboard: (board: Lookboard) => void;
  isSaving: boolean;
  onGoToCreator: () => void;
}

const Lookbook: React.FC<LookbookProps> = ({ looks, lookboards, lookOverrides, onSelectLook, onUpdateLookboards, onEditLookboard, isSaving, onGoToCreator }) => {
  const [activeTab, setActiveTab] = useState<'looks' | 'boards'>('looks');
  const [selectedLookIds, setSelectedLookIds] = useState<Set<number>>(new Set());
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);
  
  const [boardToShare, setBoardToShare] = useState<Lookboard | null>(null);
  const [isShareOptionsModalOpen, setIsShareOptionsModalOpen] = useState(false);

  const { user } = useAuth();
  const { showToast } = useToast();

  const handleToggleLookSelection = (lookId: number) => {
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

  const handleCreateLookboard = async (title: string, note: string | undefined, visibility: 'public' | 'private') => {
    if (!user) {
        showToast("You must be logged in to create a board.", "error");
        return;
    }

    const newBoard: Lookboard = {
      id: db.generateId(),
      publicId: Math.random().toString(36).substring(2, 10),
      title,
      note,
      lookIds: Array.from(selectedLookIds),
      createdAt: Date.now(),
      visibility,
      createdBy: user.email,
      createdByUsername: user.username,
    };

    const updatedLookboards = [...lookboards, newBoard];
    await onUpdateLookboards(updatedLookboards);
    
    setIsCreateBoardModalOpen(false);
    setSelectedLookIds(new Set());
    // After creating, immediately open the share flow for the new board.
    handleOpenShareOptions(newBoard);
  };

  const handleOpenShareOptions = (board: Lookboard) => {
    setBoardToShare(board);
    setIsShareOptionsModalOpen(true);
  };

  const handleDeleteLookboard = async (boardId: number) => {
    const updatedLookboards = lookboards.filter(board => board.id !== boardId);
    await onUpdateLookboards(updatedLookboards);
  };
  
  const selectedLooksCount = selectedLookIds.size;

  return (
    <div className="p-6 space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('looks')}
            className={`${
              activeTab === 'looks'
                ? 'border-zinc-900 dark:border-zinc-200 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            My Looks ({looks.length})
          </button>
          <button
            onClick={() => setActiveTab('boards')}
            className={`${
              activeTab === 'boards'
                ? 'border-zinc-900 dark:border-zinc-200 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Shared Boards ({lookboards.length})
          </button>
        </nav>
      </div>

      {activeTab === 'looks' && (
        <div>
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">My Looks</h2>
              <Button onClick={() => setIsCreateBoardModalOpen(true)} disabled={selectedLooksCount === 0 || isSaving}>
                  <ShareIcon/>
                  Share {selectedLooksCount > 0 ? `${selectedLooksCount} Look${selectedLooksCount > 1 ? 's' : ''}` : 'Looks'}
              </Button>
          </div>

          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 2xl:columns-7 gap-4 space-y-4">
            <div
              onClick={onGoToCreator}
              className="group cursor-pointer break-inside-avoid"
            >
              <div className="w-full aspect-[3/4] bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800/50 rounded-lg flex items-center justify-center border border-zinc-200 dark:border-zinc-800 shadow-md transition-all duration-300 ease-in-out hover:shadow-lg hover:scale-105 hover:border-zinc-300 dark:hover:border-zinc-700">
                <div className="text-center text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                  <PlusIcon className="mx-auto h-10 w-10" />
                  <span className="mt-2 block text-sm font-semibold">Create New Look</span>
                </div>
              </div>
            </div>

            {looks.map(look => {
              const displayImage = lookOverrides[look.id]?.finalImage || look.finalImage;
              const isVideo = displayImage.startsWith('data:video/') || displayImage.endsWith('.mp4');
              return (
              <div 
                key={look.id} 
                className="relative group cursor-pointer break-inside-avoid"
              >
                <div onClick={() => onSelectLook(look)}>
                  {isVideo ? (
                     <video 
                        src={displayImage} 
                        className="w-full h-auto object-cover rounded-lg transition-opacity group-hover:opacity-80 block"
                        muted
                        autoPlay
                        loop
                        playsInline
                      />
                  ) : (
                    <img 
                      src={displayImage} 
                      alt={`Look ${look.id}`} 
                      className="w-full h-auto object-cover rounded-lg transition-opacity group-hover:opacity-80 block"
                    />
                  )}
                </div>
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleLookSelection(look.id);
                  }}
                  className="absolute top-3 left-3 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer bg-white/80 backdrop-blur-sm border border-zinc-300 dark:bg-zinc-900/80 dark:border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {selectedLookIds.has(look.id) && <div className="w-3.5 h-3.5 bg-zinc-900 dark:bg-zinc-200 rounded-full"/>}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'boards' && (
        <div>
           <h2 className="text-2xl font-bold mb-4">Shared Boards</h2>
           <LookboardsList 
              lookboards={lookboards} 
              onDelete={handleDeleteLookboard} 
              onShare={handleOpenShareOptions}
              onEdit={onEditLookboard}
              isSaving={isSaving} 
            />
        </div>
      )}

      <CreateLookboardModal
        isOpen={isCreateBoardModalOpen}
        onClose={() => setIsCreateBoardModalOpen(false)}
        onSubmit={handleCreateLookboard}
        isSubmitting={isSaving}
      />
      
      {boardToShare && (
        <ShareOptionsModal
            isOpen={isShareOptionsModalOpen}
            onClose={() => setIsShareOptionsModalOpen(false)}
            board={boardToShare}
        />
      )}

    </div>
  );
};

export default Lookbook;