import React, { useState } from 'react';
import { Look } from '../types';
import { editImageWithPrompt } from '../services/virtualTryOnService';
import { Button, Input, Spinner } from '../components/common';
import { ChevronLeftIcon, SaveIcon } from '../components/Icons';

interface ConversationalEditPageProps {
  look: Look;
  onBack: () => void;
  onSave: (updatedLook: Look) => void;
}

const ConversationalEditPage: React.FC<ConversationalEditPageProps> = ({ look, onBack, onSave }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    try {
      const imageToEdit = generatedImage || look.finalImage;
      const result = await editImageWithPrompt(imageToEdit, prompt);
      setGeneratedImage(result);
    } catch (err) {
      console.error('Error during conversational edit:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate image: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generatedImage) return;

    const baseVariations = look.variations || [look.finalImage];
    // Use Set to ensure variations are unique before saving
    const newVariations = [...new Set([...baseVariations, generatedImage])];
    
    const updatedLook: Look = {
      ...look,
      variations: newVariations,
    };
    onSave(updatedLook);
  };
  
  const currentImage = generatedImage || look.finalImage;

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <Button onClick={onBack} variant="secondary">
                <ChevronLeftIcon /> Back to Look Details
            </Button>
            <Button onClick={handleSave} disabled={!generatedImage || isGenerating}>
                <SaveIcon /> Save as Variation
            </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold">Edit Image with AI</h2>
                <p className="text-zinc-600 dark:text-zinc-400">Describe the changes you want to make to the image. For example: "change the background to a beach" or "make the jacket red".</p>
                <div className="flex gap-2">
                    <Input 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter your edit instruction..."
                        disabled={isGenerating}
                    />
                    <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}>
                        {isGenerating ? <Spinner/> : 'Generate'}
                    </Button>
                </div>
                {error && (
                    <div className="p-4 bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg text-sm">
                       {error}
                    </div>
                )}
            </div>

            <div className="relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                {isGenerating && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                        <Spinner />
                    </div>
                )}
                <img 
                    src={currentImage} 
                    alt="Image being edited" 
                    className="w-full h-full object-contain" 
                />
            </div>
        </div>
    </div>
  );
};

export default ConversationalEditPage;