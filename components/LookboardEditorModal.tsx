import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Look, Lookboard } from '../types';
import { Modal, Button, Spinner } from './common';
import LookboardCard from './LookboardCard';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { PlusIcon, SaveIcon } from './Icons';

interface LookboardEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: Lookboard | null;
  allUserLooks: Look[];
  onSaveSuccess: () => void;
}

const AddLooksToBoardModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    onAddLooks: (newLooks: Look[]) => void,
    allUserLooks: Look[],
    existingLookIds: Set<number>,
}> = ({ isOpen, onClose, onAddLooks, allUserLooks, existingLookIds }) => {
    const [selectedLookIds, setSelectedLookIds] = useState<Set<number>>(new Set());

    const availableLooks = useMemo(() => {
        return allUserLooks.filter(look => !existingLookIds.has(look.id));
    }, [allUserLooks, existingLookIds]);

    const handleToggleSelection = (lookId: number) => {
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

    const handleAdd = () => {
        const looksToAdd = allUserLooks.filter(look => selectedLookIds.has(look.id));
        onAddLooks(looksToAdd);
        onClose();
    };

    useEffect(() => {
        if (isOpen) {
            setSelectedLookIds(new Set());
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Looks to Board">
            <div className="max-h-[60vh] overflow-y-auto">
                {availableLooks.length > 0 ? (
                    <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 space-y-4 p-1">
                        {availableLooks.map(look => (
                            <div key={look.id} className="relative group cursor-pointer break-inside-avoid" onClick={() => handleToggleSelection(look.id)}>
                                <img src={look.finalImage} alt={`Look ${look.id}`} className="w-full h-auto object-cover rounded-lg transition-opacity group-hover:opacity-70 block" />
                                <div className={`absolute inset-0 rounded-lg transition-all ${selectedLookIds.has(look.id) ? 'ring-4 ring-zinc-900 dark:ring-zinc-200 ring-inset bg-black/30' : ''}`}></div>
                                <div className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer bg-white/80 backdrop-blur-sm border border-zinc-300 dark:bg-zinc-900/80 dark:border-zinc-700">
                                    {selectedLookIds.has(look.id) && <div className="w-3.5 h-3.5 bg-zinc-900 dark:bg-zinc-200 rounded-full" />}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-zinc-500 py-8">No other looks available to add.</p>
                )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={handleAdd} disabled={selectedLookIds.size === 0}>
                    Add {selectedLookIds.size > 0 ? selectedLookIds.size : ''} Look{selectedLookIds.size !== 1 && 's'}
                </Button>
            </div>
        </Modal>
    );
};


const LookboardEditorModal: React.FC<LookboardEditorModalProps> = ({ isOpen, onClose, board, allUserLooks, onSaveSuccess }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [editableLookboard, setEditableLookboard] = useState<Lookboard | null>(board);
    const [editableLooks, setEditableLooks] = useState<Look[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isAddLooksModalOpen, setIsAddLooksModalOpen] = useState(false);

    const draggedItemIndex = useRef<number | null>(null);
    const dragOverItemIndex = useRef<number | null>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);


    useEffect(() => {
        if (board) {
            setEditableLookboard(board);
            const looksForBoard = board.lookIds
                .map(id => allUserLooks.find(look => look.id === id))
                .filter((l): l is Look => !!l);
            setEditableLooks(looksForBoard);
        }
    }, [board, allUserLooks]);

    if (!isOpen || !editableLookboard) return null;

    const handleSave = async () => {
        if (!user || !editableLookboard) return;
        setIsSaving(true);
        try {
            const finalBoard = {
                ...editableLookboard,
                lookIds: editableLooks.map(l => l.id),
            };

            const response = await fetch('/api/board', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update-board',
                    board: finalBoard,
                    userEmail: user.email,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Failed to save changes.');

            showToast("Board updated successfully!", "success");
            onSaveSuccess();
            onClose();

        } catch (error) {
            console.error("Failed to save board:", error);
            showToast(error instanceof Error ? error.message : "Could not save changes.", "error");
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteLook = (lookId: number) => {
        setEditableLooks(prev => prev.filter(look => look.id !== lookId));
    };

    const handleAddLooks = (newLooks: Look[]) => {
        setEditableLooks(prev => [...prev, ...newLooks]);
    };

    const handleDragSort = () => {
        if (draggedItemIndex.current === null || dragOverItemIndex.current === null) return;
        
        const newLooks = [...editableLooks];
        const [draggedItem] = newLooks.splice(draggedItemIndex.current, 1);
        newLooks.splice(dragOverItemIndex.current, 0, draggedItem);

        setEditableLooks(newLooks);
        
        draggedItemIndex.current = null;
        dragOverItemIndex.current = null;
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Edit Lookboard">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:h-[65vh]">
                    {/* Left Column: Details */}
                    <div className="md:col-span-1 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Board Title</label>
                            <input
                                type="text"
                                value={editableLookboard.title}
                                onChange={(e) => setEditableLookboard(prev => prev ? { ...prev, title: e.target.value } : null)}
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-white text-zinc-900 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Personal Note</label>
                            <textarea
                                value={editableLookboard.note || ''}
                                onChange={(e) => setEditableLookboard(prev => prev ? { ...prev, note: e.target.value } : null)}
                                rows={6}
                                placeholder="Add a client-facing note..."
                                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-white text-zinc-900 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 resize-none"
                                disabled={isSaving}
                            />
                        </div>
                    </div>

                    {/* Right Column: Looks */}
                    <div className="md:col-span-2 flex flex-col h-full min-h-[40vh]">
                        <div className="flex justify-between items-center mb-2 flex-shrink-0">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Looks ({editableLooks.length})</label>
                            <Button variant="secondary" onClick={() => setIsAddLooksModalOpen(true)} disabled={isSaving}>
                                <PlusIcon /> Add Looks
                            </Button>
                        </div>
                        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex-grow overflow-y-auto">
                            {editableLooks.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {editableLooks.map((look, index) => (
                                        <LookboardCard
                                            key={look.id}
                                            look={look}
                                            isEditing={true}
                                            onDelete={() => handleDeleteLook(look.id)}
                                            draggable={true}
                                            onDragStart={() => {
                                                draggedItemIndex.current = index;
                                                setDraggedIndex(index);
                                            }}
                                            onDragEnter={() => (dragOverItemIndex.current = index)}
                                            onDragEnd={() => {
                                                handleDragSort();
                                                setDraggedIndex(null);
                                            }}
                                            onDragOver={(e) => e.preventDefault()}
                                            isDragging={draggedIndex === index}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <p className="text-center text-zinc-500">This board has no looks. <br/> Click "Add Looks" to get started.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Spinner /> : <SaveIcon />} Save Changes
                    </Button>
                </div>
            </Modal>
            <AddLooksToBoardModal
                isOpen={isAddLooksModalOpen}
                onClose={() => setIsAddLooksModalOpen(false)}
                onAddLooks={handleAddLooks}
                allUserLooks={allUserLooks}
                existingLookIds={new Set(editableLooks.map(l => l.id))}
            />
        </>
    );
};

export default LookboardEditorModal;