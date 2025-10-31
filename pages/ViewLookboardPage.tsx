import React, { useState, useRef, useEffect } from 'react';
import { Look, Lookboard, SharedLookboardInstance } from '../types';
import LookboardCard from '../components/LookboardCard';
import { Modal, Button, Spinner } from '../components/common';
import ProductCard from '../components/ProductCard';
import { ChevronLeftIcon, ChevronRightIcon, EditIcon, SaveIcon } from '../components/Icons';
import OunassLogo from '../components/OunassLogo';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface ViewLookboardData {
    lookboard: Lookboard;
    looks: Look[];
    instance?: SharedLookboardInstance;
}

interface ViewLookboardPageProps {
  data: ViewLookboardData;
  onUpdate?: (updatedInstance: SharedLookboardInstance) => void;
}

const ViewLookboardPage: React.FC<ViewLookboardPageProps> = ({ data, onUpdate }) => {
  const { lookboard, looks, instance } = data;
  const isFeedbackEnabled = !!instance && !!onUpdate;
  const [selectedLook, setSelectedLook] = useState<Look | null>(null);

  const productsScrollContainerRef = useRef<HTMLDivElement>(null);
  const [showProductLeftArrow, setShowProductLeftArrow] = useState(false);
  const [showProductRightArrow, setShowProductRightArrow] = useState(false);

  const { user } = useAuth();
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editableLookboard, setEditableLookboard] = useState<Lookboard>(lookboard);
  const [editableLooks, setEditableLooks] = useState<Look[]>(looks);
  const [isSaving, setIsSaving] = useState(false);
  const draggedItemIndex = useRef<number | null>(null);
  const dragOverItemIndex = useRef<number | null>(null);

  const isOwner = user?.email === lookboard.createdBy;

  const handleProductScroll = () => {
    if (productsScrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = productsScrollContainerRef.current;
      const isScrollable = scrollWidth > clientWidth;
      setShowProductLeftArrow(scrollLeft > 0);
      setShowProductRightArrow(isScrollable && scrollLeft < scrollWidth - clientWidth - 1);
    }
  };
  
  const scrollProducts = (direction: 'left' | 'right') => {
    if (productsScrollContainerRef.current) {
        const scrollAmount = productsScrollContainerRef.current.clientWidth * 0.8;
        productsScrollContainerRef.current.scrollBy({ 
            left: direction === 'left' ? -scrollAmount : scrollAmount, 
            behavior: 'smooth' 
        });
    }
  };

  useEffect(() => {
    if (selectedLook) {
      setTimeout(() => {
        handleProductScroll();
        const container = productsScrollContainerRef.current;
        if (container) {
          container.addEventListener('scroll', handleProductScroll);
          window.addEventListener('resize', handleProductScroll);
          return () => {
            container.removeEventListener('scroll', handleProductScroll);
            window.removeEventListener('resize', handleProductScroll);
          }
        }
      }, 100);
    }
  }, [selectedLook]);

  const handleDuplicateAndEdit = async () => {
    if (!user) {
        showToast("You must be logged in to copy this board.", "error");
        return;
    }
    if (!window.confirm("This is a public board. To edit it, a private copy will be created in your account. Continue?")) {
        return;
    }
    setIsSaving(true);
    try {
        const response = await fetch('/api/board', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'duplicate-board',
                publicId: lookboard.publicId,
                user: { email: user.email, username: user.username },
            }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to copy board.');
        
        showToast("Board copied to your account! You can now edit it.", "success");
        window.location.href = `/board/public/${result.publicId}`;

    } catch (error) {
        console.error("Failed to duplicate board:", error);
        showToast(error instanceof Error ? error.message : "Could not copy board.", "error");
    } finally {
        setIsSaving(false);
    }
  };

  const handleEditClick = () => {
    if (!isOwner && lookboard.visibility === 'public') {
        handleDuplicateAndEdit();
    } else if (isOwner) {
        setEditableLookboard(lookboard);
        setEditableLooks(looks);
        setIsEditing(true);
    } else {
        showToast("You don't have permission to edit this board.", "error");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditableLookboard(lookboard);
    setEditableLooks(looks);
  };
  
  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
        const response = await fetch('/api/board', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update-board',
                board: editableLookboard,
                userEmail: user?.email,
            }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to save changes.');

        showToast("Changes saved successfully!", "success");
        setIsEditing(false);
        window.location.reload(); // Easiest way to reflect changes

    } catch (error) {
        console.error("Failed to save board:", error);
        showToast(error instanceof Error ? error.message : "Could not save changes.", "error");
    } finally {
        setIsSaving(false);
    }
  };

  const handleTitleChange = (e: React.FocusEvent<HTMLHeadingElement>) => {
    setEditableLookboard(prev => ({ ...prev, title: e.currentTarget.textContent || '' }));
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableLookboard(prev => ({ ...prev, note: e.target.value }));
  };
  
  const handleDeleteLook = (lookId: number) => {
    setEditableLooks(prev => prev.filter(look => look.id !== lookId));
    setEditableLookboard(prev => ({
        ...prev,
        lookIds: prev.lookIds.filter(id => id !== lookId)
    }));
  };

  const handleDragSort = () => {
    if (draggedItemIndex.current === null || dragOverItemIndex.current === null) return;
    
    const newLooks = [...editableLooks];
    const [draggedItem] = newLooks.splice(draggedItemIndex.current, 1);
    newLooks.splice(dragOverItemIndex.current, 0, draggedItem);

    setEditableLooks(newLooks);
    setEditableLookboard(prev => ({ ...prev, lookIds: newLooks.map(l => l.id) }));
    
    draggedItemIndex.current = null;
    dragOverItemIndex.current = null;
  };

  const currentLooks = isEditing ? editableLooks : looks;
  const currentLookboard = isEditing ? editableLookboard : lookboard;


  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="py-6 border-b border-zinc-200 dark:border-zinc-800 mb-8 sm:mb-12">
            <OunassLogo className="h-8 mx-auto" />
        </header>
        
        <main>
            <div className="text-center mb-10">
              <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 mb-2">
                A lookboard curated by <span className="font-semibold">{currentLookboard.createdByUsername}</span>
              </p>
              <h2 
                className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 ${isEditing ? 'outline-none ring-2 ring-zinc-400 rounded-md px-2' : ''}`}
                contentEditable={isEditing}
                onBlur={handleTitleChange}
                suppressContentEditableWarning={true}
              >
                {currentLookboard.title}
              </h2>
              {isEditing ? (
                  <textarea
                    value={currentLookboard.note || ''}
                    onChange={handleNoteChange}
                    placeholder="Add a personal note..."
                    className="w-full max-w-3xl mx-auto mt-4 p-2 border rounded-md bg-transparent dark:border-zinc-700 dark:bg-zinc-900 focus:ring-2 focus:ring-zinc-500"
                    rows={3}
                  />
              ) : (
                currentLookboard.note && <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto mt-4">{currentLookboard.note}</p>
              )}
            </div>

            {user && (
                <div className="flex justify-end mb-6 gap-2">
                    {isEditing ? (
                        <>
                            <Button variant="secondary" onClick={handleCancelEdit} disabled={isSaving}>Cancel</Button>
                            <Button variant="primary" onClick={handleSaveEdit} disabled={isSaving}>
                                {isSaving ? <Spinner /> : <SaveIcon />} Save Changes
                            </Button>
                        </>
                    ) : (
                        <Button variant="secondary" onClick={handleEditClick} disabled={isSaving}>
                            <EditIcon /> Edit Board
                        </Button>
                    )}
                </div>
            )}

            {currentLooks.length > 0 ? (
                <div 
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
                >
                    {currentLooks.map((look, index) => (
                        <LookboardCard
                          key={look.id}
                          look={look}
                          onImageClick={() => setSelectedLook(look)}
                          isEditing={isEditing}
                          onDelete={() => handleDeleteLook(look.id)}
                          draggable={isEditing}
                          onDragStart={() => (draggedItemIndex.current = index)}
                          onDragEnter={() => (dragOverItemIndex.current = index)}
                          onDragEnd={handleDragSort}
                          onDragOver={(e) => e.preventDefault()}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 border border-dashed rounded-lg">
                     <p className="text-lg text-zinc-600 dark:text-zinc-400">This lookboard is empty.</p>
                </div>
            )}
        </main>
        
        <footer className="text-center mt-16 py-6 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
                &copy; {new Date().getFullYear()} Ounass. All Rights Reserved.
            </p>
        </footer>
      </div>
      {selectedLook && (
            <Modal
                isOpen={!!selectedLook}
                onClose={() => setSelectedLook(null)}
                title={`Products in Look`}
            >
                <div>
                    <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-6">
                       <img src={selectedLook.finalImage} alt="Look" className="w-full h-auto object-cover sm:rounded-t-lg" />
                    </div>
                    <div>
                         <h3 className="text-lg font-bold mb-4">Products ({selectedLook.products.length})</h3>
                         {selectedLook.products.length > 0 ? (
                            <div className="relative">
                                {showProductLeftArrow && (
                                    <button onClick={() => scrollProducts('left')} className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-zinc-800/80 rounded-full p-2 shadow-md hover:scale-110 transition-transform">
                                        <ChevronLeftIcon />
                                    </button>
                                )}
                                <div ref={productsScrollContainerRef} className="flex gap-4 overflow-x-auto pb-4 scroll-smooth" style={{ scrollbarWidth: 'none' }}>
                                    {selectedLook.products.map(product => (
                                        <ProductCard key={product.id} product={product} />
                                    ))}
                                </div>
                                {showProductRightArrow && (
                                    <button onClick={() => scrollProducts('right')} className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-zinc-800/80 rounded-full p-2 shadow-md hover:scale-110 transition-transform">
                                        <ChevronRightIcon />
                                    </button>
                                )}
                            </div>
                         ) : (
                            <p className="text-zinc-500">No products are associated with this look.</p>
                         )}
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};

export default ViewLookboardPage;
