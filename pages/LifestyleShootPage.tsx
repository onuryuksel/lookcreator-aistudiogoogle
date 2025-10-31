import React, { useState, useMemo } from 'react';
import { Look, LifestyleShootUserInput, ArtDirectorPrompt } from '../types';
import * as blobService from '../services/blobService';
import { base64toBlob } from '../utils';
import { Button, Spinner } from '../components/common';
import { ChevronLeftIcon, SaveIcon } from '../components/Icons';
import { generateArtDirectorPrompt, generateLifestyleImage, generateArtDirectorPromptFromImage } from '../services/lifestyleShootService';
import { ASPECT_RATIOS } from '../constants';
import ImageViewer from '../components/ImageViewer';
import { useToast } from '../contexts/ToastContext';

// --- START: Lifestyle Shoot Page Constants ---
const VISUAL_STYLES = {
  'cinematic': 'Shallow depth of field, natural light or directional cinematic lighting, filmic color grading, widescreen framing. Dramatic, storytelling, emotional mood.',
  'minimalist': 'Clean backgrounds, neutral or monochrome palettes, precise composition, negative space. Modern, understated elegance.',
  'high-gloss': 'Perfectly lit, sharp focus everywhere, bright and vibrant colors, retouched to perfection. Polished, premium, aspirational mood.',
  'dark-moody': 'Deep shadows, strong contrast, directional light from one side, rich dark tones. Mysterious, seductive, powerful mood.',
  'lifestyle': 'Real-life context (dining, travel, work), natural interactions, warm tones. Relatable luxury, "I want to live this life" mood.',
  'avant-garde': 'Unconventional angles, bold set design, surreal or experimental lighting. Creative, disruptive, memorable mood.',
  'vintage': 'Film grain, muted tones, warm color cast, retro styling. Nostalgic, romantic, timeless mood.',
  'hyper-real': 'Extreme detail, textures pop, high clarity, often focus stacking. Bold, high-impact, "luxury tech" vibe.',
  'documentary': 'Natural light, candid moments, less retouched but still composed. Authentic, insider access, exclusive mood.',
  'monochromatic': 'One dominant color in different shades, including product and background. Cohesive, sophisticated, visually striking mood.',
  'conceptual': 'Symbolism, metaphors, unusual objects paired with product. Thought-provoking, gallery-worthy mood.',
  'natural': 'Soft sunlight, earthy textures, natural props (stone, wood, foliage). Warm, grounded, artisan luxury mood.',
};
// --- END: Lifestyle Shoot Page Constants ---

interface LifestyleShootPageProps {
  look: Look;
  onBack: () => void;
  onSave: (updatedLook: Look) => Promise<void>;
  isSaving: boolean;
}

type PageStep = 'input' | 'review' | 'result';
type CreationMode = 'text' | 'image';

const LifestyleShootPage: React.FC<LifestyleShootPageProps> = ({ look, onBack, onSave, isSaving }) => {
  const [step, setStep] = useState<PageStep>('input');
  const [creationMode, setCreationMode] = useState<CreationMode>('text');
  const [userInput, setUserInput] = useState<LifestyleShootUserInput>({
    location: '',
    mood: '',
    time: '',
    details: '',
    visualStyle: '',
  });
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);

  const imageVariations = useMemo(() => {
    return [...new Set([look.finalImage, ...(look.variations || [])])].filter(
      (asset) => asset && !asset.startsWith('data:video/') && !asset.endsWith('.mp4')
    );
  }, [look.finalImage, look.variations]);

  const [sourceImage, setSourceImage] = useState<string>(() => {
    const isFinalImageAnImage = imageVariations.includes(look.finalImage);
    return isFinalImageAnImage ? look.finalImage : imageVariations[0] || '';
  });

  const [artDirectorPrompt, setArtDirectorPrompt] = useState<ArtDirectorPrompt | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserInput(prev => ({ ...prev, [name]: value }));
  };

  const handleReferenceImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setReferenceImage(file);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
          setReferenceImagePreview(reader.result as string);
      }
    }
  };
  
  const handleSourceImageChange = (newSource: string) => {
    if (newSource === sourceImage) return;

    if (step !== 'input' && !window.confirm('Changing the source image will reset your progress. Continue?')) {
        return;
    }
    setSourceImage(newSource);
    setStep('input');
    setArtDirectorPrompt(null);
    setGeneratedImage(null);
    setError(null);
  };


  const handleGenerateBrief = async () => {
    setIsGeneratingBrief(true);
    setError(null);
    try {
      const brief = creationMode === 'image' && referenceImage
        ? await generateArtDirectorPromptFromImage(referenceImage, look, sourceImage)
        : await generateArtDirectorPrompt(userInput, look, sourceImage);
      
      setArtDirectorPrompt(brief);
      setStep('review');
    } catch (err) {
      console.error("Error generating Art Director brief:", err);
      setError(err instanceof Error ? err.message : 'Failed to generate brief.');
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!artDirectorPrompt) return;
    setIsGeneratingImage(true);
    setError(null);
    try {
        const imageBase64 = await generateLifestyleImage(
            sourceImage,
            artDirectorPrompt,
            aspectRatio,
        );
        // We get base64 back, but need to display a URL
        const imageBlob = await base64toBlob(imageBase64);
        const imageUrl = await blobService.uploadFile(imageBlob);
        setGeneratedImage(imageUrl);
        setStep('result');
    } catch (err) {
        console.error("Error generating lifestyle image:", err);
        setError(err instanceof Error ? err.message : 'Failed to generate image.');
    } finally {
        setIsGeneratingImage(false);
    }
  };
  
  const handleSave = async () => {
    if (generatedImage) {
        try {
            const updatedLook: Look = {
                ...look,
                variations: [...new Set([...(look.variations || []), generatedImage])],
            };
            await onSave(updatedLook);
        } catch(err) {
            // error handled by parent
        }
    } else {
        onBack();
    }
  };

  const isGenerating = isGeneratingBrief || isGeneratingImage;

  const renderContent = () => {
    switch (step) {
      case 'input':
        return (
          <>
            <h2 className="text-xl font-bold mb-2">Step 1: Creative Brief</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Source Image</label>
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
            </div>
            
            <div className="border-b border-zinc-200 dark:border-zinc-700 my-4"></div>

            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Choose how to inspire the AI Art Director.</p>
            
            <div className="border-b border-zinc-200 dark:border-zinc-700 mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setCreationMode('text')} className={`${creationMode === 'text' ? 'border-zinc-500 text-zinc-600 dark:border-zinc-400 dark:text-zinc-300' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                        Describe a Scene
                    </button>
                    <button onClick={() => setCreationMode('image')} className={`${creationMode === 'image' ? 'border-zinc-500 text-zinc-600 dark:border-zinc-400 dark:text-zinc-300' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}>
                        Replicate an Image
                    </button>
                </nav>
            </div>

            {creationMode === 'text' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Location (Optional)</label>
                    <input name="location" value={userInput.location} onChange={handleInputChange} placeholder="e.g., A rooftop cafe in Paris at sunset" className="w-full p-2 border rounded-md bg-transparent dark:border-zinc-700" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Mood (Optional)</label>
                    <input name="mood" value={userInput.mood} onChange={handleInputChange} placeholder="e.g., Romantic, serene, and elegant" className="w-full p-2 border rounded-md bg-transparent dark:border-zinc-700" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Time of Day (Optional)</label>
                    <input name="time" value={userInput.time} onChange={handleInputChange} placeholder="e.g., Golden hour, midday, night" className="w-full p-2 border rounded-md bg-transparent dark:border-zinc-700" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Extra Details (Optional)</label>
                    <textarea name="details" value={userInput.details} onChange={handleInputChange} placeholder="e.g., Include a vintage car, a small dog" rows={2} className="w-full p-2 border rounded-md bg-transparent dark:border-zinc-700" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Visual Style (Optional)</label>
                    <select name="visualStyle" value={userInput.visualStyle} onChange={handleInputChange} className="w-full p-2 border rounded-md bg-transparent dark:border-zinc-700 dark:bg-zinc-900">
                      <option value="">Let AI Art Director decide</option>
                      {Object.entries(VISUAL_STYLES).map(([key, value]) => (
                        <option key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1).replace('-', ' ')}</option>
                      ))}
                    </select>
                    {userInput.visualStyle && (
                        <p className="text-xs text-zinc-500 mt-1">{VISUAL_STYLES[userInput.visualStyle as keyof typeof VISUAL_STYLES]}</p>
                    )}
                  </div>
                </div>
            ) : (
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Upload a reference image. The AI will create a detailed brief to replicate its style, location, lighting, and pose with your model and look.</p>
                  <input type="file" accept="image/*" onChange={handleReferenceImageChange} className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-700 dark:file:text-zinc-200 dark:hover:file:bg-zinc-600"/>
                  {referenceImagePreview && (
                    <div className="mt-4">
                      <img src={referenceImagePreview} alt="Reference preview" className="max-w-full h-auto rounded-md border border-zinc-200 dark:border-zinc-700" />
                    </div>
                  )}
                </div>
            )}
          </>
        );
      case 'review':
        return (
           <>
            <h2 className="text-xl font-bold mb-2">Step 2: Review Brief</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">The AI Art Director has created a detailed plan. Review it and select the final aspect ratio, then proceed to generate the final image.</p>
            <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-md text-xs whitespace-pre-wrap overflow-x-auto max-h-80 mb-4">
                <code>
                    {JSON.stringify(artDirectorPrompt, null, 2)}
                </code>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Output Aspect Ratio</label>
              <select name="aspectRatio" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2 border rounded-md bg-transparent dark:border-zinc-700 dark:bg-zinc-900">
                {ASPECT_RATIOS.map(ratio => (
                  <option key={ratio.value} value={ratio.value}>{ratio.label}</option>
                ))}
              </select>
            </div>
          </>
        );
      case 'result':
        return (
            <>
                <h2 className="text-xl font-bold mb-2">Step 3: Final Image</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Here is your generated lifestyle shoot. You can save it as a variation or go back to try again.</p>
            </>
        )
    }
  };

  return (
    <div>
        <div className="flex justify-between items-center mb-4">
            <Button onClick={step === 'input' ? onBack : () => setStep('input')} variant="secondary" disabled={isGenerating || isSaving}>
                <ChevronLeftIcon /> {step === 'input' ? 'Back to Look' : 'Back to Brief'}
            </Button>
            {step === 'result' && (
                <Button onClick={handleSave} disabled={isGenerating || isSaving}>
                    {isSaving ? <Spinner /> : <SaveIcon />}
                    {isSaving ? 'Saving...' : 'Save as Variation'}
                </Button>
            )}
        </div>
        <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-1/2">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
                    {renderContent()}
                     {error && (
                        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
                            <p className="font-bold text-sm">An Error Occurred</p>
                            <p className="text-xs">{error}</p>
                        </div>
                    )}
                    <div className="mt-6 flex justify-end">
                        {step === 'input' && (
                            <Button onClick={handleGenerateBrief} disabled={isGenerating || isSaving || (creationMode === 'image' && !referenceImage)}>
                                {isGeneratingBrief ? <Spinner /> : 'Generate Brief'}
                            </Button>
                        )}
                         {step === 'review' && (
                            <Button onClick={handleGenerateImage} disabled={isGenerating || isSaving}>
                                {isGeneratingImage ? <Spinner /> : 'Generate Image'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="lg:w-1/2">
                <div className="sticky top-24">
                     <div className="aspect-[3/4]">
                        <ImageViewer
                            src={generatedImage || sourceImage}
                            alt="Lifestyle look"
                            isLoading={isGenerating || isSaving}
                            loadingText={isSaving ? "Saving variation..." : isGeneratingBrief ? "AI Art Director is creating the brief..." : "Generating final lifestyle image..."}
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default LifestyleShootPage;