

import React, { useState } from 'react';
import { Look, Lookboard } from '../types';
import * as db from '../services/dbService';
import { Button } from '../components/common';
import LookboardsList from '../components/LookboardsList';
import CreateLookboardModal from '../components/CreateLookboardModal';
import ShareLinkModal from '../components/ShareLinkModal';
import { ShareIcon } from '../components/Icons';

interface LookbookProps {
  looks: Look[];
  lookboards: Lookboard[];
  onSelectLook: (look: Look) => void;
  onUpdateLookboards: (boards: Lookboard[]) => void;
}

const Lookbook: React.FC<LookbookProps> = ({ looks, lookboards, onSelectLook, onUpdateLookboards }) => {
  const [activeTab, setActiveTab] = useState<'looks' | 'boards'>('looks');
  const [selectedLookIds, setSelectedLookIds] = useState<Set<number>>(new Set());
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);
  const [isShareLinkModalOpen, setIsShareLinkModalOpen] = useState(false);
  const [newlyCreatedBoard, setNewlyCreatedBoard] = useState<Lookboard | null>(null);

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

  const handleCreateLookboard = async (title: string, note?: string) => {
    const newBoard: Lookboard = {
      id: db.generateId(),
      publicId: Math.random().toString(36).substring(2, 10),
      title,
      note,
      lookIds: Array.from(selectedLookIds),
      createdAt: Date.now(),
      feedbacks: {},
      comments: {}
    };

    const updatedLookboards = [...lookboards, newBoard];
    onUpdateLookboards(updatedLookboards);
    
    setNewlyCreatedBoard(newBoard);
    setIsCreateBoardModalOpen(false);
    setIsShareLinkModalOpen(true);
    setSelectedLookIds(new Set());
  };

  const handleDeleteLookboard = (boardId: number) => {
    const updatedLookboards = lookboards.filter(board => board.id !== boardId);
    onUpdateLookboards(updatedLookboards);
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
              <Button onClick={() => setIsCreateBoardModalOpen(true)} disabled={selectedLooksCount === 0}>
                  <ShareIcon/>
                  Share {selectedLooksCount > 0 ? `${selectedLooksCount} Look${selectedLooksCount > 1 ? 's' : ''}` : 'Looks'}
              </Button>
          </div>

          {looks.length > 0 ? (
            <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 2xl:columns-7 gap-4 space-y-4">
              {looks.map(look => {
                const isVideo = look.finalImage.startsWith('data:video/');
                return (
                <div 
                  key={look.id} 
                  className="relative group break-inside-avoid cursor-pointer"
                  onClick={() => onSelectLook(look)}
                >
                  {isVideo ? (
                     <video 
                        src={look.finalImage} 
                        className="w-full h-auto object-cover rounded-lg transition-opacity group-hover:opacity-80"
                        muted
                        autoPlay
                        loop
                        playsInline
                      />
                  ) : (
                    <img 
                      src={look.finalImage} 
                      alt={`Look ${look.id}`} 
                      className="w-full h-auto object-cover rounded-lg transition-opacity group-hover:opacity-80"
                    />
                  )}
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
          ) : (
             <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
                <p className="text-lg text-zinc-600 dark:text-zinc-400">Your lookbook is empty.</p>
                <p className="text-zinc-500 dark:text-zinc-500 mt-2">Go to the Creator Studio to start creating looks.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'boards' && (
        <div>
           <h2 className="text-2xl font-bold mb-4">Shared Boards</h2>
           <LookboardsList lookboards={lookboards} onDelete={handleDeleteLookboard} />
        </div>
      )}

      <CreateLookboardModal
        isOpen={isCreateBoardModalOpen}
        onClose={() => setIsCreateBoardModalOpen(false)}
        onSubmit={handleCreateLookboard}
      />
      
      {newlyCreatedBoard && (
        <ShareLinkModal
            isOpen={isShareLinkModalOpen}
            onClose={() => setIsShareLinkModalOpen(false)}
            board={newlyCreatedBoard}
        />
      )}

    </div>
  );
};

export default Lookbook;