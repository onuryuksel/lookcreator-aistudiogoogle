import React from 'react';
import { OunassSKU } from '../types';
import { Card } from './common';

interface ProductCardProps {
  product: OunassSKU;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const productUrl = `https://www.ounass.ae/${product.urlKey}.html`;

  return (
    <div className="w-32 sm:w-40">
      <Card className="flex flex-col h-full p-3">
        <a href={productUrl} target="_blank" rel="noopener noreferrer" className="block group">
          <div className="aspect-[3/4] bg-white rounded-md overflow-hidden mb-2">
            <img 
              src={product.media[0]?.src} 
              alt={product.name}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="flex-grow">
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 group-hover:underline truncate">{product.brand}</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate h-8">{product.name}</p>
          </div>
        </a>
        <div className="mt-auto pt-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            AED {product.minPriceInAED.toLocaleString()}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ProductCard;