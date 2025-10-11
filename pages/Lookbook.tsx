
import React, { useState, useMemo } from 'react';
import { Look, Lookboard } from '../types';
import { Card, Button } from '../components/common';
import LookboardsList from '../components/LookboardsList';
import CreateLookboardModal from '../components/CreateLookboardModal';
import ShareLinkModal from '../components/ShareLinkModal';
import * as db from '../services/dbService';

interface LookbookProps {
  looks: Look[];
  lookboards: Lookboard[];
  onSelectLook: (look: Look) => void;
  onUpdateLookboards: (boards: Lookboard[]) => void;
}

type Tab = 'looks' | 'boards';

const Lookbook: React.FC<LookbookProps> = ({ looks, lookboards, onSelectLook, onUpdateLookboards }) => {
    const [activeTab, setActiveTab] = useState<Tab>('looks');
    const [selectedLookIds, setSelectedLookIds] = useState<Set<number>>(new Set());
    const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);
    const [isShareLinkModalOpen, setIsShareLinkModalOpen] = useState(false);
    const [newlyCreatedBoard, setNewlyCreatedBoard] = useState<Lookboard | null>(null);

    const sortedLooks = useMemo(() => {
        return [...looks].sort((a, b) => b.createdAt - a.createdAt);
    }, [looks]);
    
    const sortedLookboards = useMemo(() => {
        return [...lookboards].sort((a, b) => b.createdAt - a.createdAt);
    }, [lookboards]);

    const toggleLookSelection = (id: number) => {
        setSelectedLookIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };
    
    const handleSelectAll = () => {
        if (selectedLookIds.size === looks.length) {
            setSelectedLookIds(new Set());
        } else {
            setSelectedLookIds(new Set(looks.map(l => l.id)));
        }
    };
    
    const handleCreateBoard = async (title: string, note?: string) => {
        const newBoard: Lookboard = {
            id: db.generateId(),
            publicId: `board_${Math.random().toString(36).substring(2, 11)}`,
            title,
            note,
            lookIds: Array.from(selectedLookIds),
            createdAt: Date.now(),
        };
        const updatedBoards = [...lookboards, newBoard];
        onUpdateLookboards(updatedBoards);
        
        // Reset state and show share link modal
        setSelectedLookIds(new Set());
        setIsCreateBoardModalOpen(false);
        setNewlyCreatedBoard(newBoard);
        setIsShareLinkModalOpen(true);
    };

    const handleDeleteBoard = (id: number) => {
        const updatedBoards = lookboards.filter(b => b.id !== id);
        onUpdateLookboards(updatedBoards);
    };

    const renderLooksTab = () => (
        <>
             {looks.length > 0 && (
                <div className="mb-4 flex justify-between items-center">
                    <div>
                        <Button variant="secondary" onClick={handleSelectAll}>
                            {selectedLookIds.size === looks.length ? 'Deselect All' : 'Select All'}
                        </Button>
                        <span className="ml-4 text-sm text-zinc-500">{selectedLookIds.size} selected</span>
                    </div>
                    <Button onClick={() => setIsCreateBoardModalOpen(true)} disabled={selectedLookIds.size === 0}>
                        Share Looks...
                    </Button>
                </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {sortedLooks.map(look => (
                    <div key={look.id} className="relative group">
                        <Card 
                            onClick={() => onSelectLook(look)} 
                            className="p-2 cursor-pointer aspect-[3/4] flex items-center justify-center transition-all duration-200 hover:scale-105"
                        >
                            <img src={look.finalImage} alt={`Look created on ${new Date(look.createdAt).toLocaleDateString()}`} className="max-w-full max-h-full object-contain" />
                        </Card>
                        <div 
                            className={`absolute top-2 left-2 w-5 h-5 rounded-sm border-2 bg-white/50 backdrop-blur-sm cursor-pointer ${selectedLookIds.has(look.id) ? 'bg-zinc-900 border-zinc-900 dark:bg-zinc-200 dark:border-zinc-200' : 'border-zinc-400'}`}
                            onClick={() => toggleLookSelection(look.id)}
                        >
                            {selectedLookIds.has(look.id) && <div className="w-full h-full flex items-center justify-center text-white dark:text-black">✓</div>}
                        </div>
                    </div>
                ))}
            </div>
            {looks.length === 0 && (
                <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300">No Looks Created Yet</h3>
                    <p className="mt-2 text-zinc-500">Go to the Creator Studio to start building your first look.</p>
                </div>
            )}
        </>
    );

    const renderBoardsTab = () => (
        <LookboardsList lookboards={sortedLookboards} onDelete={handleDeleteBoard} />
    );

    return (
        <div className="p-6">
            <div className="mb-6 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex space-x-8">
                    <button onClick={() => setActiveTab('looks')} className={`py-2 px-1 border-b-2 font-medium ${activeTab === 'looks' ? 'border-zinc-900 dark:border-zinc-200 text-zinc-900 dark:text-zinc-200' : 'border-transparent text-zinc-500 hover:border-zinc-300'}`}>
                        My Looks
                    </button>
                    <button onClick={() => setActiveTab('boards')} className={`py-2 px-1 border-b-2 font-medium ${activeTab === 'boards' ? 'border-zinc-900 dark:border-zinc-200 text-zinc-900 dark:text-zinc-200' : 'border-transparent text-zinc-500 hover:border-zinc-300'}`}>
                        Shared Boards
                    </button>
                </div>
            </div>

            {activeTab === 'looks' ? renderLooksTab() : renderBoardsTab()}

            <CreateLookboardModal
                isOpen={isCreateBoardModalOpen}
                onClose={() => setIsCreateBoardModalOpen(false)}
                onSubmit={handleCreateBoard}
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
