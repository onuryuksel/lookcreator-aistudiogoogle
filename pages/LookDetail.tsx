import React, { useState } from 'react';
import { Look } from '../types';
import ProductCard from '../components/ProductCard';
import { Button, Dropdown, DropdownItem } from '../components/common';
import { ChevronLeftIcon, TrashIcon, MessageSquareIcon, EllipsisVerticalIcon } from '../components/Icons';

interface LookDetailProps {
  look: Look;
  onBack: () => void;
  onDelete: (id: number) => void;
  onNavigateToEdit: (id: number) => void;
  onUpdateLook: (updatedLook: Look) => void;
}

const LookDetail: React.FC<LookDetailProps> = ({ look, onBack, onDelete, onNavigateToEdit, onUpdateLook }) => {
  const [activeImage, setActiveImage] = useState(look.finalImage);

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this look? This action cannot be undone.')) {
      onDelete(look.id!);
    }
  };

  const handleSetAsMain = (imageUrl: string) => {
    if (look.finalImage === imageUrl) return;
    const updatedLook = { ...look, finalImage: imageUrl };
    onUpdateLook(updatedLook);
    setActiveImage(imageUrl);
  };
  
  const variationsToShow = [...new Set([look.finalImage, ...(look.variations || [])])];


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Button onClick={onBack} variant="secondary">
          <ChevronLeftIcon /> Back to Lookbook
        </Button>
        <div className="flex gap-2">
            <Dropdown
              trigger={
                <Button variant="secondary" aria-label="More options">
                  <EllipsisVerticalIcon />
                </Button>
              }
            >
              <DropdownItem onClick={() => onNavigateToEdit(look.id!)}>
                <MessageSquareIcon className="h-5 w-5" />
                <span>Conversational Edit</span>
              </DropdownItem>
              <DropdownItem 
                onClick={handleDelete} 
                className="text-red-600 hover:!bg-red-50 hover:!text-red-700 dark:text-red-400 dark:hover:!bg-red-900/40 dark:hover:!text-red-300"
              >
                <TrashIcon />
                <span>Delete Look</span>
              </DropdownItem>
            </Dropdown>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="md:col-span-1">
          <div className="relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <img src={activeImage} alt="Final look" className="w-full h-full object-contain" />
          </div>
        </div>

        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-2xl font-bold mb-2">Look Details</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Created on {new Date(look.createdAt).toLocaleString()}
            </p>
            
            <h3 className="text-lg font-semibold mb-4">Products Used ({look.products.length})</h3>
            <div className="flex flex-wrap gap-4">
              {look.products.length > 0 ? (
                look.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))
              ) : (
                <p className="text-sm text-zinc-500">No products are associated with this look.</p>
              )}
            </div>
            
            {variationsToShow.length > 1 && (
              <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-700">
                <h3 className="text-lg font-semibold mb-4">Variations</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {variationsToShow.map((variation, index) => (
                    <div
                      key={index}
                      onClick={() => setActiveImage(variation)}
                      className={`relative group aspect-square bg-zinc-100 dark:bg-zinc-800 rounded-md cursor-pointer overflow-hidden border-2 transition-all ${activeImage === variation ? 'border-zinc-800 dark:border-zinc-200' : 'border-transparent hover:border-zinc-400 dark:hover:border-zinc-500'}`}
                    >
                      <img
                        src={variation}
                        alt={`Variation ${index + 1}`}
                        className="w-full h-full object-contain"
                      />
                      {activeImage === variation && look.finalImage !== variation && (
                         <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleSetAsMain(variation); }}
                                className="px-2 py-1 text-xs font-semibold rounded-md bg-white/80 dark:bg-black/60 backdrop-blur-sm text-zinc-900 dark:text-zinc-100 hover:bg-white dark:hover:bg-black transition-all shadow-md"
                            >
                                Set as Main
                            </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default LookDetail;