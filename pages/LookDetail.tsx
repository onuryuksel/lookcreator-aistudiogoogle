import React, { useState, useEffect, useRef } from 'react';
import { Look } from '../types';
import ProductCard from '../components/ProductCard';
import { ChevronLeftIcon, ChevronRightIcon, MessageSquareIcon, PersonStandingIcon, CameraIcon, VideoIcon } from '../components/Icons';
import { Button, Input } from '../components/common';

interface LookDetailProps {
  look: Look;
  onBack: () => void;
  onLookUpdated: (updatedLook: Look) => void;
}

const LookDetail: React.FC<LookDetailProps> = ({ look, onBack, onLookUpdated }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const [mainImage, setMainImage] = useState(look.finalImage);
  const [variations, setVariations] = useState(look.variations || [look.finalImage]);

  useEffect(() => {
    setMainImage(look.finalImage);
    setVariations(look.variations || [look.finalImage]);
  }, [look]);


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

  const handleSetAsMain = (variationUrl: string) => {
    const updatedLook = { ...look, finalImage: variationUrl };
    onLookUpdated(updatedLook);
  };

  // Placeholder function for adding a new variation
  const handleAddVariation = (newVariationUrl: string) => {
    const newVariations = [...variations, newVariationUrl];
    const updatedLook = { ...look, variations: newVariations };
    onLookUpdated(updatedLook);
    setVariations(newVariations);
  };


  return (
    <div>
        <div className="mb-6">
            <Button variant="secondary" onClick={onBack}>
                <ChevronLeftIcon />
                Back to Lookbook
            </Button>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 lg:grid-cols-3 gap-8 p-6">
          <div className="lg:col-span-1 flex flex-col gap-4">
              <div className="aspect-[3/4] rounded-md overflow-hidden ring-1 ring-zinc-200 dark:ring-zinc-800">
                <img src={mainImage} alt="Main look" className="w-full h-full object-cover" />
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2 text-zinc-800 dark:text-zinc-200">Variations</h3>
                 <div className="grid grid-cols-4 gap-2">
                    {variations.map((v, index) => (
                        <div key={index} className="relative group aspect-square">
                            <img 
                                src={v} 
                                alt={`Variation ${index + 1}`} 
                                className={`w-full h-full object-cover rounded-md cursor-pointer ring-2 ${mainImage === v ? 'ring-zinc-800 dark:ring-zinc-200' : 'ring-transparent'}`}
                                onClick={() => setMainImage(v)}
                            />
                            {mainImage === v && look.finalImage !== v && (
                                <div className="absolute -top-1 -right-1">
                                    <button 
                                        onClick={() => handleSetAsMain(v)}
                                        className="bg-zinc-800 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg hover:bg-zinc-600 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-transform transform group-hover:scale-100 scale-0"
                                        title="Set as Main Look"
                                    >
                                      Set as Main
                                    </button>
                                </div>
                            )}
                             {look.finalImage === v && (
                                <div className="absolute top-1 right-1 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                                  Main
                                </div>
                            )}
                        </div>
                    ))}
                 </div>
              </div>
          </div>
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div>
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

            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
              <h3 className="font-semibold text-lg mb-4 text-zinc-800 dark:text-zinc-200">Creative Tools</h3>
              <div className="space-y-4">
                {/* 1. Conversational Edit */}
                <div className="p-4 rounded-md bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                    <label className="font-semibold text-sm flex items-center gap-2 mb-2"><MessageSquareIcon/> Conversational Edit</label>
                    <div className="flex gap-2">
                        <Input placeholder="e.g., 'make the shirt red' or 'add a necklace'" />
                        <Button onClick={() => alert('Feature coming soon!')}>Apply</Button>
                    </div>
                </div>

                {/* 2, 3, 4: Other tools */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button variant="secondary" onClick={() => alert('Feature coming soon!')} className="w-full">
                        <PersonStandingIcon/> Change Model Pose
                    </Button>
                     <Button variant="secondary" onClick={() => alert('Feature coming soon!')} className="w-full">
                        <CameraIcon/> Create Lifestyle Shoot
                    </Button>
                     <Button variant="secondary" onClick={() => alert('Feature coming soon!')} className="w-full">
                        <VideoIcon/> Create Video
                    </Button>
                </div>
              </div>
            </div>

          </div>
        </div>
    </div>
  );
};

export default LookDetail;