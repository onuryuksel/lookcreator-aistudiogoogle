import React, { useState, useMemo } from 'react';
import { Look, OunassSKU } from '../types';
import * as ounassService from '../services/ounassService';
import * as virtualTryOnService from '../services/virtualTryOnService';
import * as blobService from '../services/blobService';
import { base64toBlob } from '../utils';
import { Button, Input, Spinner } from '../components/common';
import { ChevronLeftIcon, SaveIcon } from '../components/Icons';
import ImageViewer from '../components/ImageViewer';
import { useToast } from '../contexts/ToastContext';

interface AddSkuPageProps {
  look: Look;
  onBack: () => void;
  onSave: (updatedLook: Look) => Promise<void>;
  isSaving: boolean;
}

const AddSkuPage: React.FC<AddSkuPageProps> = ({ look, onBack, onSave, isSaving }) => {
  const imageVariations = useMemo(() => {
    return [...new Set([look.finalImage, ...(look.variations || [])])].filter(
      (asset) => asset && !asset.startsWith('data:video/') && !asset.endsWith('.mp4')
    );
  }, [look.finalImage, look.variations]);

  const [sourceImage, setSourceImage] = useState<string>(() => {
    const isFinalImageAnImage = imageVariations.includes(look.finalImage);
    return isFinalImageAnImage ? look.finalImage : imageVariations[0] || '';
  });

  const [skuInput, setSkuInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [newSkuData, setNewSkuData] = useState<OunassSKU | null>(null);

  const { showToast } = useToast();

  const handleSourceImageChange = (newSource: string) => {
    if (newSource === sourceImage) return;

    if (generatedImage && !window.confirm('Changing the source image will discard your generated image. Continue?')) {
        return;
    }
    setSourceImage(newSource);
    setGeneratedImage(null);
    setError(null);
    setNewSkuData(null);
  };

  const handleGenerate = async () => {
    if (!skuInput.trim()) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);
    setNewSkuData(null);

    try {
      const fetchedSku = await ounassService.fetchSkuData(skuInput.trim());
      if (!fetchedSku) {
        throw new Error(`Could not find data for SKU: ${skuInput.trim()}`);
      }
      setNewSkuData(fetchedSku);

      // Perform virtual try-on. This service returns a base64 image.
      const newImageBase64 = await virtualTryOnService.performVirtualTryOn(
        sourceImage,
        look.model,
        fetchedSku,
        look.products
      );

      // Upload the base64 image to get a permanent URL
      const imageBlob = await base64toBlob(newImageBase64);
      const imageUrl = await blobService.uploadFile(imageBlob, `new-sku-variation-${Date.now()}.png`);
      setGeneratedImage(imageUrl);
      showToast('New look generated successfully!', 'success');

    } catch (err) {
      console.error("Error adding new SKU:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during image generation.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (generatedImage && newSkuData) {
      try {
        const updatedLook: Look = {
          ...look,
          variations: [...new Set([...(look.variations || []), generatedImage])],
          products: [...look.products, newSkuData],
        };
        await onSave(updatedLook);
        // The onSave prop will handle navigation back to the detail page.
      } catch (err) {
        // Error toast is handled by the parent saveAllData function
      }
    } else {
      onBack();
    }
  };

  const displayImage = generatedImage || sourceImage;
  const isLoading = isGenerating || isSaving;
  const loadingText = isSaving ? 'Saving...' : isGenerating ? 'Generating new look...' : '';

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-10rem)]">
      {/* Control Panel */}
      <div className="lg:w-1/3 flex flex-col h-full">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <Button onClick={onBack} variant="secondary" disabled={isLoading}>
            <ChevronLeftIcon /> Back to Look Details
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !generatedImage}>
            {isSaving ? <Spinner /> : <SaveIcon />}
            {isSaving ? 'Saving...' : 'Save as Variation'}
          </Button>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 flex-grow flex flex-col">
          <h2 className="text-xl font-bold mb-2 flex-shrink-0">Add New SKU</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">1. Select Base Image</label>
            <div className="flex gap-2 overflow-x-auto pb-2 -ml-2 pl-2" style={{ scrollbarWidth: 'none' }}>
              {imageVariations.map(img => (
                <div key={img} className="flex-shrink-0">
                  <img 
                    src={img}
                    alt="Variation"
                    onClick={() => handleSourceImageChange(img)}
                    className={`w-20 h-auto rounded-md cursor-pointer ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 ${sourceImage === img ? 'ring-zinc-900 dark:ring-zinc-200' : 'ring-transparent'}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="sku-input" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">2. Enter Product SKU</label>
            <div className="flex gap-2">
              <Input
                id="sku-input"
                type="text"
                value={skuInput}
                onChange={(e) => setSkuInput(e.target.value)}
                placeholder="Enter a single SKU"
                disabled={isLoading}
              />
              <Button
                onClick={handleGenerate}
                disabled={isLoading || !skuInput.trim()}
              >
                {isGenerating ? <Spinner /> : 'Generate'}
              </Button>
            </div>
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
                <p className="font-bold text-sm">An Error Occurred</p>
                <p className="text-xs">{error}</p>
            </div>
          )}

          <div className="mt-auto">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              The AI will add the product to the selected base image. If you're happy with the result, you can save it as a new variation. The SKU will be added to the look's product list upon saving.
            </p>
          </div>
        </div>
      </div>
      
      {/* Image Viewer */}
      <div className="lg:w-2/3 h-full">
        <ImageViewer
          src={displayImage}
          alt="Generated look with new SKU"
          isLoading={isLoading}
          loadingText={loadingText}
        />
      </div>
    </div>
  );
};

export default AddSkuPage;
