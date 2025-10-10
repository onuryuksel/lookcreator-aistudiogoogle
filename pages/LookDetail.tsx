import React, { useState, useEffect, useRef } from 'react';
import { Look } from '../types';
import ProductCard from '../components/ProductCard';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/Icons';
import { Button } from '../components/common';

interface LookDetailProps {
  look: Look;
  onBack: () => void;
}

const LookDetail: React.FC<LookDetailProps> = ({ look, onBack }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const checkArrows = () => {
        if (container.scrollWidth > container.clientWidth) {
          handleScroll();
        } else {
            setShowLeftArrow(false);
            setShowRightArrow(false);
        }
      };
      checkArrows();
      
      const resizeObserver = new ResizeObserver(checkArrows);
      resizeObserver.observe(container);
      
      return () => resizeObserver.disconnect();
    }
  }, [look.products]);

  return (
    <div>
        <div className="mb-6">
            <Button variant="secondary" onClick={onBack}>
                <ChevronLeftIcon />
                Back to Lookbook
            </Button>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="aspect-[3/4] rounded-md overflow-hidden ring-1 ring-zinc-200 dark:ring-zinc-800">
              <img src={look.finalImage} alt="Saved look" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="lg:col-span-2">
            <h3 className="font-semibold text-lg mb-1 text-zinc-800 dark:text-zinc-200">Products Used</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Created on {new Date(look.createdAt).toLocaleDateString()}</p>
            <div className="relative">
              {showLeftArrow && (
                <button
                  onClick={() => scroll('left')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-white dark:hover:bg-zinc-700 transition"
                  aria-label="Scroll left"
                >
                  <ChevronLeftIcon />
                </button>
              )}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex gap-4 overflow-x-auto pb-2"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {look.products.map(product => (
                  <div key={product.sku} className="flex-shrink-0">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
              {showRightArrow && (
                <button
                  onClick={() => scroll('right')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-white dark:hover:bg-zinc-700 transition"
                  aria-label="Scroll right"
                >
                  <ChevronRightIcon />
                </button>
              )}
            </div>
          </div>
        </div>
    </div>
  );
};

export default LookDetail;
