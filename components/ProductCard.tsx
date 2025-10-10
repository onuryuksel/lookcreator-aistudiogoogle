
import React from 'react';
import { OunassSKU } from '../types';

interface ProductCardProps {
  product: OunassSKU;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const handleProductClick = () => {
    // A simplified URL construction, might need adjustment for specific product pages.
    window.open(`https://www.ounass.ae/${product.urlKey}.html`, '_blank');
  };

  return (
    <div 
      className="w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-md overflow-hidden transform hover:scale-105 transition-transform duration-300 cursor-pointer"
      onClick={handleProductClick}
    >
      <div className="w-full h-72 bg-zinc-100 dark:bg-zinc-700">
        <img 
          src={product.media[0]?.src || 'https://picsum.photos/300/400'} 
          alt={product.name} 
          className="w-full h-full object-contain"
        />
      </div>
      <div className="p-4">
        <p className="text-sm font-bold text-gray-800 dark:text-zinc-200">{product.designer}</p>
        <p className="text-xs text-gray-600 dark:text-zinc-400 truncate">{product.name}</p>
        <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-zinc-100">
          {product.minPriceInAED !== product.initialPrice && (
            <span className="text-red-500 mr-2">{product.minPriceInAED.toFixed(2)} AED</span>
          )}
          <span className={product.minPriceInAED !== product.initialPrice ? 'line-through text-gray-400 dark:text-zinc-500' : ''}>
            {product.initialPrice.toFixed(2)} AED
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;