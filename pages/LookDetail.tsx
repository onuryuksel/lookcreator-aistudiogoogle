import React, { useState, useRef } from 'react';
import { Look } from '../types';
import ProductCard from '../components/ProductCard';
import { Button, Dropdown, DropdownItem, Modal, Spinner } from '../components/common';
import { ChevronLeftIcon, TrashIcon, MessageSquareIcon, EllipsisVerticalIcon, ChevronRightIcon, AspectRatioIcon } from '../components/Icons';
import { changeImageAspectRatio } from '../services/imageEditingService';

interface LookDetailProps {
  look: Look;
  onBack: () => void;
  onDelete: (id: number) => void;
  onNavigateToEdit: (lookId: number) => void;
  onUpdateLook: (updatedLook: Look) => void;
}

const ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

const LookDetail: React.FC<LookDetailProps> = ({ look, onBack, onDelete, onNavigateToEdit, onUpdateLook }) => {
  const allImages = [look.finalImage, ...(look.variations || [])].filter((v, i, a) => a.indexOf(v) === i);
  const [currentImage, setCurrentImage] = useState(look.finalImage);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [isRatioModalOpen, setIsRatioModalOpen] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[3]);
  const [isGeneratingRatio, setIsGeneratingRatio] = useState(false);

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this look?')) {
      onDelete(look.id!);
    }
  };

  const handleSetAsMain = () => {
    if (currentImage !== look.finalImage) {
        const otherVariations = allImages.filter(img => img !== currentImage);
        const updatedLook: Look = {
            ...look,
            finalImage: currentImage,
            variations: otherVariations,
        };
        onUpdateLook(updatedLook);
    }
  };

  const handleApplyRatioChange = async () => {
    setIsGeneratingRatio(true);
    try {
        const newImage = await changeImageAspectRatio(currentImage, selectedRatio);
        const updatedLook: Look = {
            ...look,
            variations: [...new Set([...(look.variations || []), newImage])]
        };
        onUpdateLook(updatedLook);
        setCurrentImage(newImage);
        setIsRatioModalOpen(false);
    } catch (error) {
        console.error("Failed to change aspect ratio:", error);
        alert(`Error changing aspect ratio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsGeneratingRatio(false);
    }
  };


  const scrollProducts = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
        const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
        scrollContainerRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    }
  }

  return (
    <>
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <Button onClick={onBack} variant="secondary">
          <ChevronLeftIcon /> Back to Lookbook
        </Button>
        <div className="flex gap-2">
           <Dropdown 
              trigger={
                <Button variant="secondary">
                    Look Menu <EllipsisVerticalIcon className="h-5 w-5 ml-1"/>
                </Button>
              }
           >
                <DropdownItem onClick={() => onNavigateToEdit(look.id!)}>
                    <MessageSquareIcon className="h-5 w-5"/> Edit with AI
                </DropdownItem>
                <DropdownItem onClick={() => setIsRatioModalOpen(true)}>
                    <AspectRatioIcon className="h-5 w-5"/> Change Aspect Ratio
                </DropdownItem>
                <DropdownItem onClick={handleDelete} className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40">
                    <TrashIcon /> Delete Look
                </DropdownItem>
           </Dropdown>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-2 gap-8">
        {/* Main Image */}
        <div className="md:col-span-1 lg:col-span-1">
          <div className="aspect-[3/4] bg-zinc-100 dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <img src={currentImage} alt="Detailed look" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Products */}
        <div className="md:col-span-2 lg:col-span-1">
          <h2 className="text-2xl font-bold mb-1">Products in this Look</h2>
           <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Created on: {new Date(look.createdAt).toLocaleDateString()}</p>
          <div className="relative">
             <div ref={scrollContainerRef} className="flex gap-4 overflow-x-auto pb-4 scroll-smooth scrollbar-hide">
                {look.products.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
             </div>
             {look.products.length > 3 && (
                <>
                    <button onClick={() => scrollProducts('left')} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-full p-2 shadow-md hover:scale-110 transition-transform">
                        <ChevronLeftIcon />
                    </button>
                     <button onClick={() => scrollProducts('right')} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-full p-2 shadow-md hover:scale-110 transition-transform">
                        <ChevronRightIcon />
                    </button>
                </>
             )}
          </div>
        </div>
      </div>

      {allImages.length > 1 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-8">
          <h3 className="text-xl font-bold mb-4">Variations</h3>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {allImages.map((img, index) => (
              <div
                key={index}
                onClick={() => setCurrentImage(img)}
                className={`group relative aspect-[3/4] rounded-md overflow-hidden cursor-pointer ring-2 ${currentImage === img ? 'ring-zinc-800 dark:ring-zinc-200' : 'ring-transparent hover:ring-zinc-400'}`}
              >
                <img src={img} alt={`Variation ${index + 1}`} className="w-full h-full object-contain bg-zinc-100 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
           <div className="mt-6 flex justify-end">
                <Button onClick={handleSetAsMain} disabled={currentImage === look.finalImage}>
                    Set as Main Image
                </Button>
            </div>
        </div>
      )}
    </div>

    <Modal isOpen={isRatioModalOpen} onClose={() => setIsRatioModalOpen(false)} title="Change Aspect Ratio">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {ASPECT_RATIOS.map(ratio => (
                <button 
                    key={ratio}
                    onClick={() => setSelectedRatio(ratio)}
                    className={`p-4 rounded-md text-center font-mono text-sm transition-colors ${selectedRatio === ratio ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'}`}
                >
                    {ratio}
                </button>
            ))}
        </div>
        <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsRatioModalOpen(false)} disabled={isGeneratingRatio}>Cancel</Button>
            <Button onClick={handleApplyRatioChange} disabled={isGeneratingRatio}>
                {isGeneratingRatio && <Spinner />}
                {isGeneratingRatio ? 'Applying...' : 'Apply'}
            </Button>
        </div>
    </Modal>
    </>
  );
};

export default LookDetail;