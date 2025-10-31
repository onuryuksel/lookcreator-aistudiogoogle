import React, { useState, useRef, useEffect } from 'react';
import { Look, Lookboard, SharedLookboardInstance } from '../types';
import LookboardCard from '../components/LookboardCard';
import { Modal } from '../components/common';
import ProductCard from '../components/ProductCard';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/Icons';

interface ViewLookboardData {
    lookboard: Lookboard;
    looks: Look[];
    instance?: SharedLookboardInstance; // Instance is now optional for view-only mode
}

interface ViewLookboardPageProps {
  data: ViewLookboardData;
  onUpdate?: (updatedInstance: SharedLookboardInstance) => void; // onUpdate is also optional
}

const ViewLookboardPage: React.FC<ViewLookboardPageProps> = ({ data, onUpdate }) => {
  const { lookboard, looks, instance } = data;
  const isFeedbackEnabled = !!instance && !!onUpdate;
  const [selectedLook, setSelectedLook] = useState<Look | null>(null);

  const productsScrollContainerRef = useRef<HTMLDivElement>(null);
  const [showProductLeftArrow, setShowProductLeftArrow] = useState(false);
  const [showProductRightArrow, setShowProductRightArrow] = useState(false);

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

  const handleVote = (lookId: number, vote: 'liked' | 'disliked') => {
    if (!isFeedbackEnabled) return;
    const newFeedbacks = { ...(instance.feedbacks || {}) };
    if (newFeedbacks[lookId] === vote) {
        delete newFeedbacks[lookId];
    } else {
        newFeedbacks[lookId] = vote;
    }
    onUpdate({ ...instance, feedbacks: newFeedbacks });
  };

  const handleComment = (lookId: number, text: string) => {
    if (!isFeedbackEnabled) return;
    const newComment = {
      id: Date.now().toString(),
      author: 'client' as const,
      text,
      createdAt: Date.now(),
    };
    const newComments = { ...(instance.comments || {}) };
    if (!newComments[lookId]) {
        newComments[lookId] = [];
    }
    newComments[lookId].push(newComment);
    onUpdate({ ...instance, comments: newComments });
  };


  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="py-6 border-b border-zinc-200 dark:border-zinc-800 mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-3xl font-bold text-center tracking-tight text-zinc-800 dark:text-zinc-200">OUNASS</h1>
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-1">AI Studio</p>
        </header>
        
        <main>
            <div className="text-center mb-10">
              <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 mb-2">
                A lookboard curated by <span className="font-semibold">{lookboard.createdByUsername}</span>
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{lookboard.title}</h2>
              {lookboard.note && <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto mt-4">{lookboard.note}</p>}
            </div>

            {looks.length > 0 ? (
                <div 
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
                >
                    {looks.map(look => (
                        <LookboardCard
                          key={look.id}
                          look={look}
                          onImageClick={() => setSelectedLook(look)}
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
                &copy; {new Date().getFullYear()} Ounass. All Rights Reserved. Powered by AI Studio.
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