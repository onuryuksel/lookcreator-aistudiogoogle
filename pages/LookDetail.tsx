
import React, { useState, useRef, useEffect } from 'react';
import { Look } from '../types';
import ProductCard from '../components/ProductCard';
import { Button, Card, Dropdown, DropdownItem } from '../components/common';
import { ChevronLeftIcon, EditIcon, ClapperboardIcon, TrashIcon, EllipsisVerticalIcon, StarIcon, ChevronRightIcon } from '../components/Icons';

interface LookDetailProps {
  look: Look;
  onBack: () => void;
  onDelete: (id: number) => void;
  onUpdate: (updatedLook: Look) => void;
  onEdit: () => void;
  onLifestyleShoot: () => void;
}

const LookDetail: React.FC<LookDetailProps> = ({ look, onBack, onDelete, onUpdate, onEdit, onLifestyleShoot }) => {
  const [selectedImage, setSelectedImage] = useState(look.finalImage);
  const productsScrollContainerRef = useRef<HTMLDivElement>(null);
  const variationsScrollContainerRef = useRef<HTMLDivElement>(null);

  const [showProductLeftArrow, setShowProductLeftArrow] = useState(false);
  const [showProductRightArrow, setShowProductRightArrow] = useState(true);
  const [showVariationLeftArrow, setShowVariationLeftArrow] = useState(false);
  const [showVariationRightArrow, setShowVariationRightArrow] = useState(true);

  // The main image is the source of truth, variations are everything else.
  const variations = (look.variations || []).filter(v => v !== look.finalImage);
  const allImages = [look.finalImage, ...variations];

  useEffect(() => {
    // When the look prop changes (e.g., after setting a new main image),
    // reset the selected image to the new finalImage to keep UI in sync.
    setSelectedImage(look.finalImage);
  }, [look.finalImage]);

  const handleSetAsMain = () => {
    const updatedLook: Look = {
      ...look,
      finalImage: selectedImage,
      variations: [...new Set([look.finalImage, ...(look.variations || [])])].filter(v => v !== selectedImage),
    };
    onUpdate(updatedLook);
  };
  
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this look? This action cannot be undone.')) {
      onDelete(look.id!);
    }
  };
  
  const handleProductScroll = () => {
    if (productsScrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = productsScrollContainerRef.current;
      setShowProductLeftArrow(scrollLeft > 0);
      setShowProductRightArrow(scrollLeft < scrollWidth - clientWidth - 1); // -1 for precision issues
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

  const handleVariationsScroll = () => {
    if (variationsScrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = variationsScrollContainerRef.current;
        const isScrollable = scrollWidth > clientWidth;
        setShowVariationLeftArrow(scrollLeft > 0);
        setShowVariationRightArrow(isScrollable && scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  const scrollVariations = (direction: 'left' | 'right') => {
      if (variationsScrollContainerRef.current) {
          const scrollAmount = variationsScrollContainerRef.current.clientWidth * 0.8;
          variationsScrollContainerRef.current.scrollBy({
              left: direction === 'left' ? -scrollAmount : scrollAmount,
              behavior: 'smooth'
          });
      }
  };
  
  useEffect(() => {
    handleProductScroll(); // Initial check
    const container = productsScrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleProductScroll);
      window.addEventListener('resize', handleProductScroll);
      return () => {
        container.removeEventListener('scroll', handleProductScroll);
        window.removeEventListener('resize', handleProductScroll);
      }
    }
  }, [look.products]);

  useEffect(() => {
    handleVariationsScroll();
    const container = variationsScrollContainerRef.current;
    if (container) {
        container.addEventListener('scroll', handleVariationsScroll);
        window.addEventListener('resize', handleVariationsScroll);
        return () => {
            container.removeEventListener('scroll', handleVariationsScroll);
            window.removeEventListener('resize', handleVariationsScroll);
        };
    }
  }, [allImages]);


  return (
    <div>
      {/* --- START: Header Bar --- */}
      <div className="flex justify-between items-center mb-6">
        <Button onClick={onBack} variant="secondary">
          <ChevronLeftIcon /> Back to Lookbook
        </Button>
        <p className="hidden md:block text-sm text-zinc-500 dark:text-zinc-400">
          Created on {new Date(look.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <Dropdown
            trigger={
                <Button variant="secondary">
                    <EllipsisVerticalIcon/>
                    Actions
                </Button>
            }
        >
            <DropdownItem onClick={onEdit}>
                <EditIcon/> Edit with AI
            </DropdownItem>
            <DropdownItem onClick={onLifestyleShoot}>
                <ClapperboardIcon/> Create Lifestyle Shoot
            </DropdownItem>
            <DropdownItem onClick={handleDelete} className="text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50">
                <TrashIcon/> Delete Look
            </DropdownItem>
        </Dropdown>
      </div>
      {/* --- END: Header Bar --- */}

      {/* --- START: Main Content Grid --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* --- START: Left Column (Image) --- */}
        <div className="lg:col-span-1">
          <Card className="p-0 overflow-hidden sticky top-24">
            <div className="aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative">
              <img src={selectedImage} alt="Selected look" className="max-h-full max-w-full object-contain" />
               {selectedImage !== look.finalImage && (
                    <Button 
                        onClick={handleSetAsMain}
                        className="absolute top-4 right-4"
                    >
                       <StarIcon/> Set as Main
                    </Button>
                )}
            </div>
          </Card>
        </div>
        {/* --- END: Left Column --- */}


        {/* --- START: Right Column (Products) --- */}
        <div className="lg:col-span-2">
            <Card>
                <h3 className="text-lg font-bold mb-4">Products in this Look ({look.products.length})</h3>
                 <div className="relative">
                    {showProductLeftArrow && (
                        <button onClick={() => scrollProducts('left')} className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-zinc-800/80 rounded-full p-2 shadow-md hover:scale-110 transition-transform">
                            <ChevronLeftIcon />
                        </button>
                    )}
                    <div ref={productsScrollContainerRef} className="flex gap-4 overflow-x-auto pb-4 scroll-smooth" style={{ scrollbarWidth: 'none' }}>
                        {look.products.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                    {showProductRightArrow && (
                        <button onClick={() => scrollProducts('right')} className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-zinc-800/80 rounded-full p-2 shadow-md hover:scale-110 transition-transform">
                            <ChevronRightIcon />
                        </button>
                    )}
                </div>
            </Card>
        </div>
        {/* --- END: Right Column --- */}
      </div>

      {/* --- START: Full-Width Variations Section --- */}
      {allImages.length > 1 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold mb-4">Variations ({allImages.length})</h3>
           <div className="relative">
            {showVariationLeftArrow && (
                <button onClick={() => scrollVariations('left')} className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-zinc-800/80 rounded-full p-2 shadow-md hover:scale-110 transition-transform">
                    <ChevronLeftIcon />
                </button>
            )}
            <div ref={variationsScrollContainerRef} className="flex gap-4 overflow-x-auto p-2 scroll-smooth" style={{ scrollbarWidth: 'none' }}>
              {allImages.map((img, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedImage(img)}
                  className={`w-28 aspect-[3/4] flex-shrink-0 rounded-md overflow-hidden cursor-pointer ring-2 ring-offset-2 dark:ring-offset-zinc-950 ${selectedImage === img ? 'ring-zinc-900 dark:ring-zinc-200' : 'ring-transparent'}`}
                >
                  <img src={img} alt={`Variation ${index + 1}`} className="w-full h-full object-contain bg-zinc-100 dark:bg-zinc-800" />
                </div>
              ))}
            </div>
             {showVariationRightArrow && (
                <button onClick={() => scrollVariations('right')} className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-zinc-800/80 rounded-full p-2 shadow-md hover:scale-110 transition-transform">
                    <ChevronRightIcon />
                </button>
            )}
          </div>
        </div>
      )}
      {/* --- END: Variations Section --- */}
    </div>
  );
};

export default LookDetail;
