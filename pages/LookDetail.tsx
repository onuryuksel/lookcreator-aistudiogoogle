import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Look } from '../types';
import * as blobService from '../services/blobService';
import { base64toBlob } from '../utils';
import ProductCard from '../components/ProductCard';
import { Button, Card, Dropdown, DropdownItem } from '../components/common';
import { ChevronLeftIcon, EditIcon, ClapperboardIcon, TrashIcon, EllipsisVerticalIcon, StarIcon, ChevronRightIcon, CropIcon, XIcon, FilmIcon } from '../components/Icons';
import AspectRatioModal from '../components/AspectRatioModal';
import ImageViewer from '../components/ImageViewer';
import { useToast } from '../contexts/ToastContext';

interface LookDetailProps {
  look: Look;
  onBack: () => void;
  onDelete: (id: number) => Promise<void>;
  onUpdate: (updatedLook: Look) => Promise<void>;
  onEdit: () => void;
  onLifestyleShoot: () => void;
  onVideoCreation: () => void;
  isSaving: boolean;
}

const LookDetail: React.FC<LookDetailProps> = ({ look, onBack, onDelete, onUpdate, onEdit, onLifestyleShoot, onVideoCreation, isSaving }) => {
  const [selectedImage, setSelectedImage] = useState(look.finalImage);
  const productsScrollContainerRef = useRef<HTMLDivElement>(null);
  const variationsScrollContainerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const [showProductLeftArrow, setShowProductLeftArrow] = useState(false);
  const [showProductRightArrow, setShowProductRightArrow] = useState(false);
  const [showVariationLeftArrow, setShowVariationLeftArrow] = useState(false);
  const [showVariationRightArrow, setShowVariationRightArrow] = useState(false);
  const [isAspectRatioModalOpen, setIsAspectRatioModalOpen] = useState(false);

  const allImages = useMemo(() => {
    return [...new Set([look.finalImage, ...(look.variations || [])])].filter(Boolean);
  }, [look.finalImage, look.variations]);

  const imageVariations = useMemo(() => {
    return allImages.filter(img => !(img.startsWith('data:video/') || img.endsWith('.mp4')));
  }, [allImages]);

  const hasImagesForEditing = imageVariations.length > 0;

  useEffect(() => {
    setSelectedImage(look.finalImage);
  }, [look.finalImage]);

  const handleSetAsMain = async () => {
    const updatedLook: Look = {
      ...look,
      finalImage: selectedImage,
      variations: allImages.filter(v => v !== selectedImage),
    };
    await onUpdate(updatedLook);
  };
  
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this look? This action cannot be undone.')) {
      await onDelete(look.id!);
    }
  };

  const handleSaveNewVariation = async (base64Image: string) => {
    setIsProcessing(true);
    try {
        const imageBlob = await base64toBlob(base64Image);
        const imageUrl = await blobService.uploadFile(imageBlob);

        const updatedLook: Look = {
            ...look,
            variations: [...new Set([...(look.variations || []), imageUrl])],
        };
        await onUpdate(updatedLook);
        showToast("New variation saved!", "success");
    } catch (error) {
        console.error("Failed to save new variation:", error);
        showToast("Failed to save variation.", "error");
    } finally {
        setIsProcessing(false);
        setIsAspectRatioModalOpen(false);
    }
  };

    const handleDeleteVariation = async (imageToDelete: string) => {
        if (allImages.length <= 1) {
            showToast("You cannot delete the last image of a look.", "error");
            return;
        }

        const remainingImages = allImages.filter(img => img !== imageToDelete);
        const newFinalImage = remainingImages[0];
        const newVariations = remainingImages.slice(1);

        const updatedLook: Look = {
            ...look,
            finalImage: newFinalImage,
            variations: newVariations,
        };

        if (selectedImage === imageToDelete) {
            setSelectedImage(newFinalImage);
        }
        
        await onUpdate(updatedLook);
        showToast("Variation deleted.", "success");
    };
  
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
      <div className="flex justify-between items-center mb-6">
        <Button onClick={onBack} variant="secondary" disabled={isSaving}>
          <ChevronLeftIcon /> Back to Lookbook
        </Button>
        <p className="hidden md:block text-sm text-zinc-500 dark:text-zinc-400">
          Created on {new Date(look.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <Dropdown
            trigger={
                <Button variant="secondary" disabled={isSaving}>
                    <EllipsisVerticalIcon/>
                    Actions
                </Button>
            }
        >
            <DropdownItem onClick={onEdit} disabled={isSaving || !hasImagesForEditing}>
                <EditIcon/> Edit with AI
            </DropdownItem>
            <DropdownItem onClick={onLifestyleShoot} disabled={isSaving || !hasImagesForEditing}>
                <ClapperboardIcon/> Create Lifestyle Shoot
            </DropdownItem>
             <DropdownItem onClick={onVideoCreation} disabled={isSaving}>
                <FilmIcon/> Create Video
            </DropdownItem>
            <DropdownItem onClick={() => setIsAspectRatioModalOpen(true)} disabled={isSaving || !hasImagesForEditing}>
                <CropIcon/> Change Aspect Ratio
            </DropdownItem>
            <DropdownItem onClick={handleDelete} className="text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50" disabled={isSaving}>
                <TrashIcon/> Delete Look
            </DropdownItem>
        </Dropdown>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2">
          <div className="sticky top-24">
            <div className="aspect-[3/4] relative">
              <ImageViewer src={selectedImage} alt="Selected look" />
              {selectedImage !== look.finalImage && (
                <Button 
                  onClick={handleSetAsMain}
                  className="absolute top-4 left-4"
                  disabled={isSaving}
                >
                  <StarIcon/> Set as Main
                </Button>
              )}
            </div>
          </div>
        </div>


        <div className="lg:col-span-3 flex flex-col gap-8">
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

            {allImages.length > 1 && (
              <Card className="flex-grow flex flex-col">
                <h3 className="text-lg font-bold mb-4 flex-shrink-0">Variations ({allImages.length})</h3>
                <div className="relative flex-grow flex items-center">
                  {showVariationLeftArrow && (
                      <button onClick={() => scrollVariations('left')} className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-zinc-800/80 rounded-full p-2 shadow-md hover:scale-110 transition-transform">
                          <ChevronLeftIcon />
                      </button>
                  )}
                  <div ref={variationsScrollContainerRef} className="flex w-full gap-4 overflow-x-auto p-2 scroll-smooth" style={{ scrollbarWidth: 'none' }}>
                    {allImages.map((img, index) => {
                      const isVideo = img && (img.startsWith('data:video/') || img.endsWith('.mp4'));
                      return (
                      <div
                        key={index}
                        className="relative group w-28 aspect-[3/4] flex-shrink-0"
                      >
                        <div
                          onClick={() => setSelectedImage(img)}
                          className={`w-full h-full rounded-md overflow-hidden cursor-pointer ring-2 ring-offset-2 dark:ring-offset-zinc-950 ${selectedImage === img ? 'ring-zinc-900 dark:ring-zinc-200' : 'ring-transparent'}`}
                        >
                          {isVideo ? (
                             <video src={img} className="w-full h-full object-contain bg-zinc-100 dark:bg-zinc-800" muted autoPlay loop playsInline />
                          ) : (
                             <img src={img} alt={`Variation ${index + 1}`} className="w-full h-full object-contain bg-zinc-100 dark:bg-zinc-800" />
                          )}
                        </div>
                         {allImages.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteVariation(img);
                                }}
                                className="absolute top-1 right-1 z-10 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity"
                                aria-label="Delete variation"
                                disabled={isSaving}
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        )}
                      </div>
                      );
                    })}
                  </div>
                   {showVariationRightArrow && (
                      <button onClick={() => scrollVariations('right')} className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-zinc-800/80 rounded-full p-2 shadow-md hover:scale-110 transition-transform">
                          <ChevronRightIcon />
                      </button>
                  )}
                </div>
              </Card>
            )}
        </div>
      </div>
      
      {isAspectRatioModalOpen && (
        <AspectRatioModal
            isOpen={isAspectRatioModalOpen}
            onClose={() => setIsAspectRatioModalOpen(false)}
            look={look}
            onSaveVariation={handleSaveNewVariation}
            isProcessing={isProcessing || isSaving}
        />
       )}
    </div>
  );
};

export default LookDetail;