import React from 'react';
import { Look } from '../types';
import { Button } from '../components/common';
import ProductCard from '../components/ProductCard';
import { ChevronLeftIcon, TrashIcon, WandSparklesIcon } from '../components/Icons';

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
              <WandSparklesIcon /> Edit with AI
            </Button>
            <Button onClick={handleDelete} variant="danger">
              <TrashIcon /> Delete Look
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="aspect-[3/4] bg-zinc-100 dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <img 
              src={look.finalImage} 
              alt={`Look created on ${new Date(look.createdAt).toLocaleDateString()}`} 
              className="w-full h-full object-cover" 
            />
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <h2 className="text-2xl font-bold mb-4">Products in this Look</h2>
          <div className="space-y-4">
            {look.products.map(product => (
              <ProductCard key={product.sku} product={product} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LookDetail;
