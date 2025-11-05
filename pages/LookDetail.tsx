import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Look, LookOverrides, MainImageProposal } from '../types';
import * as blobService from '../services/blobService';
import * as dataService from '../services/dataService';
import { base64toBlob } from '../utils';
import ProductCard from '../components/ProductCard';
import { Button, Card, Dropdown, DropdownItem, Spinner } from '../components/common';
import { ChevronLeftIcon, EditIcon, ClapperboardIcon, TrashIcon, EllipsisVerticalIcon, StarIcon, ChevronRightIcon, CropIcon, XIcon, FilmIcon, ShareIcon, PlusCircleIcon, UsersIcon } from '../components/Icons';
import AspectRatioModal from '../components/AspectRatioModal';
import ImageViewer from '../components/ImageViewer';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { generateTagsForLook } from '../services/tagGenerationService';

interface LookDetailProps {
  look: Look;
  lookOverrides: LookOverrides;
  proposals: Record<number, MainImageProposal[]>;
  onBack: () => void;
  onDelete: (id: number) => Promise<void>;
  onUpdate: (updatedLook: Look) => Promise<void>;
  onUpdateOverride: (lookId: number, newFinalImage: string | null) => Promise<void>;
  onEdit: () => void;
  onLifestyleShoot: () => void;
  onVideoCreation: () => void;
  onAddNewSku: () => void;
  isSaving: boolean;
  scrollToProposals?: boolean;
  onScrollComplete?: () => void;
}

const LookDetail: React.FC<LookDetailProps> = ({ look, lookOverrides, proposals, onBack, onDelete, onUpdate, onUpdateOverride, onEdit, onLifestyleShoot, onVideoCreation, onAddNewSku, isSaving, scrollToProposals, onScrollComplete }) => {
  const { user } = useAuth();
  const isCreator = user?.email === look.createdBy;
  
  const displayImage = lookOverrides[look.id]?.finalImage || look.finalImage;
  const [selectedImage, setSelectedImage] = useState(displayImage);
  
  const productsScrollContainerRef = useRef<HTMLDivElement>(null);
  const variationsScrollContainerRef = useRef<HTMLDivElement>(null);
  const proposalsRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [processingProposal, setProcessingProposal] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');

  const [showProductLeftArrow, setShowProductLeftArrow] = useState(false);
  const [showProductRightArrow, setShowProductRightArrow] = useState(false);
  const [showVariationLeftArrow, setShowVariationLeftArrow] = useState(false);
  const [showVariationRightArrow, setShowVariationRightArrow] = useState(false);
  const [isAspectRatioModalOpen, setIsAspectRatioModalOpen] = useState(false);

  const lookProposals = useMemo(() => proposals[look.id] || [], [proposals, look.id]);
  const isOverridden = !isCreator && lookOverrides[look.id];
  const originalFinalImage = look.finalImage;

  const allImages = useMemo(() => {
    const overrideImage = lookOverrides[look.id]?.finalImage;
    const images = [look.finalImage, ...(look.variations || [])];
    if (overrideImage) {
        images.push(overrideImage);
    }
    return [...new Set(images)].filter(Boolean);
  }, [look.finalImage, look.variations, lookOverrides, look.id]);

  const imageVariations = useMemo(() => {
    return allImages.filter(img => !(img.startsWith('data:video/') || img.endsWith('.mp4')));
  }, [allImages]);

  const hasImagesForEditing = imageVariations.length > 0;

  useEffect(() => {
    const newDisplayImage = lookOverrides[look.id]?.finalImage || look.finalImage;
    setSelectedImage(newDisplayImage);
  }, [look.finalImage, look.id, lookOverrides]);

   useEffect(() => {
    if (scrollToProposals && proposalsRef.current) {
      setTimeout(() => {
        proposalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (onScrollComplete) {
            onScrollComplete();
        }
      }, 100);
    }
  }, [scrollToProposals, onScrollComplete]);

  const handleSetAsMain = async () => {
    if (isCreator) {
      // Creator updates the global finalImage
      const updatedLook: Look = {
        ...look,
        finalImage: selectedImage,
        variations: allImages.filter(v => v !== selectedImage),
      };
      await onUpdate(updatedLook);
      showToast("Main image updated for all users.", "success");
    } else {
      // Other users set a personal override
      await onUpdateOverride(look.id, selectedImage);
    }
  };

  const handleRevertOverride = async () => {
    await onUpdateOverride(look.id, null);
    showToast("Reverted to the original main image.", "success");
  };
  
  const handleAcceptProposal = async (proposal: MainImageProposal) => {
    if (!user) return;
    setProcessingProposal(proposal.proposedImage);
    try {
        const result = await dataService.acceptMainImageProposal(look.id, proposal, user.email);
        showToast(`Accepted proposal from ${proposal.proposedByUsername}. The main image has been updated for everyone.`, 'success');
        await onUpdate(result.updatedLook); // This will trigger a full data reload in CreatorStudio
    } catch (err) {
        console.error("Failed to accept proposal:", err);
        showToast(err instanceof Error ? err.message : "Could not accept proposal.", "error");
    } finally {
        setProcessingProposal(null);
    }
  };

  const handleRejectProposal = async (proposal: MainImageProposal) => {
    if (!user) return;
    setProcessingProposal(proposal.proposedImage);
    try {
        await dataService.rejectMainImageProposal(look.id, proposal, user.email);
        showToast(`Rejected proposal from ${proposal.proposedByUsername}.`, 'success');
        // Trigger a reload by calling onUpdate with the original look data.
        // The CreatorStudio will then call loadData() to refresh everything.
        await onUpdate(look);
    } catch (err) {
        console.error("Failed to reject proposal:", err);
        showToast(err instanceof Error ? err.message : "Could not reject proposal.", "error");
    } finally {
        setProcessingProposal(null);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this look? This action cannot be undone.')) {
      await onDelete(look.id!);
    }
  };

  const handleMakePublic = async () => {
    if (window.confirm('Are you sure you want to make this look public? This action cannot be undone.')) {
        const updatedLook = { ...look, visibility: 'public' as const };
        await onUpdate(updatedLook);
        showToast("Look is now public!", "success");
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || (look.tags && look.tags.map(t => t.toLowerCase()).includes(newTag.trim().toLowerCase()))) {
        setNewTag('');
        return;
    }
    const updatedLook: Look = {
        ...look,
        tags: [...new Set([...(look.tags || []), newTag.trim()])],
    };
    await onUpdate(updatedLook);
    setNewTag('');
    showToast("Tag added!", "success");
  };
  
  const handleGenerateAITags = async () => {
    setIsGeneratingTags(true);
    showToast("AI is generating tags...", "success");
    try {
        const newTags = await generateTagsForLook(look.finalImage);
        if (newTags.length > 0) {
            const updatedLook: Look = {
                ...look,
                tags: [...new Set([...(look.tags || []), ...newTags])],
            };
            await onUpdate(updatedLook);
            showToast("AI tags generated and saved!", "success");
        } else {
            showToast("AI could not generate any tags for this image.", "error");
        }
    } catch (err) {
        console.error("Error generating AI tags:", err);
        showToast(err instanceof Error ? err.message : "Failed to generate AI tags.", "error");
    } finally {
        setIsGeneratingTags(false);
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
        const newFinalImage = look.finalImage === imageToDelete ? remainingImages[0] : look.finalImage;
        const newVariations = remainingImages.filter(img => img !== newFinalImage);

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
        {look.createdByUsername && (
            <p className="hidden md:block text-sm text-zinc-500 dark:text-zinc-400">
            Created by {look.createdByUsername} on {new Date(look.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
        )}
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
            <DropdownItem onClick={onAddNewSku} disabled={isSaving || !hasImagesForEditing}>
                <PlusCircleIcon /> Add New SKU
            </DropdownItem>
            {isCreator && lookProposals.length > 0 && (
                <DropdownItem onClick={() => proposalsRef.current?.scrollIntoView({ behavior: 'smooth' })}>
                    <UsersIcon />
                    <span className="flex-grow">View Proposals</span>
                    <span className="bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{lookProposals.length}</span>
                </DropdownItem>
            )}
            {isCreator && look.visibility === 'private' && (
                 <DropdownItem onClick={handleMakePublic} disabled={isSaving}>
                    <ShareIcon/> Make Public
                </DropdownItem>
            )}
            {isCreator && (
              <DropdownItem onClick={handleDelete} className="text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50" disabled={isSaving}>
                  <TrashIcon/> Delete Look
              </DropdownItem>
            )}
        </Dropdown>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2">
          <div className="sticky top-24">
            <div className="aspect-[3/4] relative">
              <ImageViewer src={selectedImage} alt="Selected look" />
              {selectedImage !== displayImage && (
                <Button 
                  onClick={handleSetAsMain}
                  className="absolute top-4 left-4"
                  disabled={isSaving}
                >
                  <StarIcon/> {isCreator ? 'Set as Main' : 'Set as My Main'}
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

            {allImages.length > 0 && (
              <Card className="flex-grow flex flex-col">
                <h3 className="text-lg font-bold mb-4 flex-shrink-0">Variations ({allImages.length})</h3>
                {isOverridden && (
                    <div className="mb-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex justify-between items-center text-sm">
                        <p className="text-zinc-700 dark:text-zinc-300">You've set a personal main image for this look.</p>
                        <Button variant="secondary" size="sm" onClick={handleRevertOverride} disabled={isSaving}>
                            Revert to Original
                        </Button>
                    </div>
                )}
                <div className="relative flex-grow flex items-center">
                  {showVariationLeftArrow && (
                      <button onClick={() => scrollVariations('left')} className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 dark:bg-zinc-800/80 rounded-full p-2 shadow-md hover:scale-110 transition-transform">
                          <ChevronLeftIcon />
                      </button>
                  )}
                  <div ref={variationsScrollContainerRef} className="flex w-full gap-4 overflow-x-auto p-2 scroll-smooth" style={{ scrollbarWidth: 'none' }}>
                    {allImages.map((img, index) => {
                      const isVideo = img && (img.startsWith('data:video/') || img.endsWith('.mp4'));
                      const isOriginal = img === originalFinalImage;
                      return (
                      <div
                        key={index}
                        className="relative group w-28 aspect-[3/4] flex-shrink-0"
                      >
                         {isOriginal && !isOverridden && (
                            <div className="absolute top-1 left-1 bg-white/80 dark:bg-zinc-900/80 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm z-10">
                                Original
                            </div>
                        )}
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
                         {allImages.length > 1 && isCreator && (
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

            <Card>
                <h3 className="text-lg font-bold mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                    {(look.tags && look.tags.length > 0) ? (
                        look.tags.map((tag, index) => (
                            <span key={index} className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full text-sm">
                                {tag}
                            </span>
                        ))
                    ) : (
                        <div className="text-sm text-zinc-500 w-full">
                           <p className="mb-2">No tags yet. Add one below or let AI generate them.</p>
                            {user?.role === 'admin' && (
                                <Button onClick={handleGenerateAITags} disabled={isGeneratingTags || isSaving} variant="secondary">
                                    {isGeneratingTags ? <Spinner /> : 'Generate AI Tags'}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                        placeholder="Add a new tag..."
                        className="flex-grow w-full px-3 py-1.5 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-white text-zinc-900 placeholder-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 dark:placeholder-zinc-500"
                        disabled={isSaving}
                    />
                    <Button onClick={handleAddTag} disabled={!newTag.trim() || isSaving}>
                        Add
                    </Button>
                </div>
            </Card>

            {isCreator && lookProposals.length > 0 && (
                <div ref={proposalsRef}>
                <Card>
                    <h3 className="text-lg font-bold mb-4">Main Image Proposals ({lookProposals.length})</h3>
                    <div className="space-y-4">
                    {lookProposals.map((proposal, index) => (
                        <div key={index} className="flex items-center gap-4 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                        <img src={proposal.proposedImage} alt={`Proposal by ${proposal.proposedByUsername}`} className="w-20 aspect-[3/4] object-contain rounded-md bg-zinc-100 dark:bg-zinc-800" />
                        <div className="flex-grow">
                            <p className="text-sm font-semibold">Proposed by {proposal.proposedByUsername}</p>
                            <p className="text-xs text-zinc-500">{proposal.proposedByEmail}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button 
                                variant="secondary" 
                                size="sm"
                                onClick={() => handleRejectProposal(proposal)}
                                disabled={isSaving || !!processingProposal}
                            >
                                {processingProposal === proposal.proposedImage ? <Spinner /> : 'Reject'}
                            </Button>
                            <Button 
                                variant="primary" 
                                size="sm"
                                onClick={() => handleAcceptProposal(proposal)}
                                disabled={isSaving || !!processingProposal}
                            >
                                {processingProposal === proposal.proposedImage ? <Spinner /> : 'Accept'}
                            </Button>
                        </div>
                        </div>
                    ))}
                    </div>
                </Card>
                </div>
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