
import React from 'react';
import { Look } from '../types';
import ProductCard from '../components/ProductCard';
import { Button } from '../components/common';
import { ChevronLeftIcon, TrashIcon, MessageSquareIcon } from '../components/Icons';

interface LookDetailProps {
  look: Look;
  onBack: () => void;
  onDelete: (id: number) => void;
  onNavigateToEdit: (id: number) => void;
}

const LookDetail: React.FC<LookDetailProps> = ({ look, onBack, onDelete, onNavigateToEdit }) => {
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this look? This action cannot be undone.')) {
      onDelete(look.id!);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Button onClick={onBack} variant="secondary">
          <ChevronLeftIcon /> Back to Lookbook
        </Button>
        <div className="flex gap-2">
            <Button onClick={() => onNavigateToEdit(look.id!)} variant="secondary">
              <MessageSquareIcon className="h-5 w-5"/> Conversational Edit
            </Button>
            <Button onClick={handleDelete} variant="danger">
              <TrashIcon /> Delete Look
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-2">
          <div className="relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <img src={look.finalImage} alt="Final look" className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="md:col-span-1 flex flex-col gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-2xl font-bold mb-2">Look Details</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Created on {new Date(look.createdAt).toLocaleString()}
            </p>
            
            <h3 className="text-lg font-semibold mb-4">Products Used ({look.products.length})</h3>
            <div className="flex overflow-x-auto space-x-4 pb-4 -mb-4 -mx-6 px-6">
              {look.products.length > 0 ? (
                look.products.map((product) => (
                  <div key={product.id} className="flex-shrink-0">
                     <ProductCard product={product} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500">No products are associated with this look.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LookDetail;
