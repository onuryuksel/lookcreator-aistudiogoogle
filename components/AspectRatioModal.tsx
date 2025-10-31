import React, { useState, useMemo } from 'react';
import { Look } from '../types';
import { Modal, Button, Spinner } from './common';
import { changeImageAspectRatio } from '../services/directImageEditingService';
import { SaveIcon } from './Icons';
import { ASPECT_RATIOS } from '../constants';

interface AspectRatioModalProps {
    isOpen: boolean;
    onClose: () => void;
    look: Look;
    onSaveVariation: (newImage: string) => void;
    isProcessing: boolean;
}

const AspectRatioModal: React.FC<AspectRatioModalProps> = ({ isOpen, onClose, look, onSaveVariation, isProcessing }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    
    const imageVariations = useMemo(() => {
        return [...new Set([look.finalImage, ...(look.variations || [])])].filter(
            (asset) => asset && !asset.startsWith('data:video/') && !asset.endsWith('.mp4')
        );
    }, [look.finalImage, look.variations]);

    const [sourceImage, setSourceImage] = useState<string>(() => {
        const isFinalImageAnImage = imageVariations.includes(look.finalImage);
        return isFinalImageAnImage ? look.finalImage : imageVariations[0] || '';
    });
    
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedRatio, setSelectedRatio] = useState<string | null>(null);

    const handleSourceImageChange = (newSource: string) => {
        if (newSource === sourceImage) return;

        if (generatedImage && !window.confirm('Changing the source image will discard your generated image. Continue?')) {
            return;
        }
        setSourceImage(newSource);
        setGeneratedImage(null);
        setError(null);
        setSelectedRatio(null);
    };

    const handleGenerate = async (ratio: string) => {
        setIsGenerating(true);
        setError(null);
        setGeneratedImage(null);
        setSelectedRatio(ratio);
        try {
            const newImage = await changeImageAspectRatio(sourceImage, ratio);
            setGeneratedImage(newImage);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate new image.');
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSave = () => {
        if (generatedImage) {
            onSaveVariation(generatedImage);
        }
    };

    const handleClose = () => {
        setGeneratedImage(null);
        setError(null);
        setIsGenerating(false);
        setSelectedRatio(null);
        onClose();
    }

    const displayImage = generatedImage || sourceImage;

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Change Image Aspect Ratio">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative w-full aspect-auto bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center min-h-[400px]">
                    <img src={displayImage} alt="Aspect Ratio Preview" className="max-w-full max-h-full object-contain" />
                    {(isGenerating || isProcessing) && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center backdrop-blur-sm p-4 text-center">
                            <Spinner />
                            <p className="text-white mt-2 font-semibold">
                                {isProcessing ? 'Saving...' : `Generating ${selectedRatio} ratio...`}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col">
                     <div className="mb-4">
                        <h3 className="font-semibold mb-2">Source Image:</h3>
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

                    <h3 className="font-semibold mb-2">Select a new aspect ratio:</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                        {ASPECT_RATIOS.map(ratio => (
                            <Button
                                key={ratio.value}
                                variant="secondary"
                                onClick={() => handleGenerate(ratio.value)}
                                disabled={isGenerating || isProcessing}
                                className={`justify-center ${selectedRatio === ratio.value && isGenerating ? 'ring-2 ring-zinc-500' : ''}`}
                            >
                                {ratio.value}
                            </Button>
                        ))}
                    </div>

                    {error && (
                        <div className="my-4 p-3 bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
                            <p className="font-bold text-sm">An Error Occurred</p>
                            <p className="text-xs">{error}</p>
                        </div>
                    )}

                    <div className="mt-auto flex justify-end gap-3">
                        <Button variant="secondary" onClick={handleClose} disabled={isProcessing}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!generatedImage || isGenerating || isProcessing}>
                            <SaveIcon /> Save as Variation
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default AspectRatioModal;