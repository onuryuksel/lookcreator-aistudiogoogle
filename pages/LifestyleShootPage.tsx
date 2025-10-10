import React, { useState } from 'react';
import { Look, LifestyleShootUserInput, ArtDirectorPrompt } from '../types';
import { Button, Spinner } from '../components/common';
import { ChevronLeftIcon, SaveIcon } from '../components/Icons';
import { generateArtDirectorPrompt, generateLifestyleImage } from '../services/imageEditingService';

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
  onSave: (updatedLook: Look) => void;
}

type PageStep = 'input' | 'review' | 'result';

const LifestyleShootPage: React.FC<LifestyleShootPageProps> = ({ look, onBack, onSave }) => {
  const [step, setStep] = useState<PageStep>('input');
  const [userInput, setUserInput] = useState<LifestyleShootUserInput>({
    location: '',
    mood: '',
    time: '',
    details: '',
    visualStyle: '', // Changed: Default is now empty, making it optional
  });
  const [artDirectorPrompt, setArtDirectorPrompt] = useState<ArtDirectorPrompt | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserInput(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerateBrief = async () => {
    setIsGeneratingBrief(true);
    setError(null);
    try {
      const brief = await generateArtDirectorPrompt(userInput, look);
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
      const image = await generateLifestyleImage(look.finalImage, artDirectorPrompt);
      setGeneratedImage(image);
      setStep('result');
    } catch (err) {
      console.error("Error generating lifestyle image:", err);
      setError(err instanceof Error ? err.message : 'Failed to generate image.');
    } finally {
      setIsGeneratingImage(false);
    }
  };
  
  const handleSave = () => {
    if (generatedImage) {
        const updatedLook: Look = {
            ...look,
            variations: [...new Set([...(look.variations || []), generatedImage])],
        };
        onSave(updatedLook);
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
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">Provide some direction for the AI Art Director. Leave fields blank to give the AI more creative freedom.</p>
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
          </>
        );
      case 'review':
        return (
           <>
            <h2 className="text-xl font-bold mb-2">Step 2: Art Director's Brief</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">The AI Art Director has created a detailed plan based on your input. Review it, then proceed to generate the final image.</p>
            <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-md text-xs whitespace-pre-wrap overflow-x-auto">
                <code>
                    {JSON.stringify(artDirectorPrompt, null, 2)}
                </code>
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
            <Button onClick={step === 'input' ? onBack : () => setStep('input')} variant="secondary">
                <ChevronLeftIcon /> {step === 'input' ? 'Back to Look' : 'Back to Brief'}
            </Button>
            {step === 'result' && (
                <Button onClick={handleSave} disabled={isGenerating}>
                    <SaveIcon /> Save as Variation
                </Button>
            )}
        </div>
        <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Panel: Controls */}
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
                            <Button onClick={handleGenerateBrief} disabled={isGenerating}>
                                {isGeneratingBrief ? <Spinner /> : 'Generate Brief'}
                            </Button>
                        )}
                         {step === 'review' && (
                            <Button onClick={handleGenerateImage} disabled={isGenerating}>
                                {isGeneratingImage ? <Spinner /> : 'Generate Image'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Panel: Image Viewer */}
            <div className="lg:w-1/2">
                <div className="sticky top-24">
                     <div className="relative w-full aspect-[3/4] bg-zinc-100 dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                        <img src={generatedImage || look.finalImage} alt="Lifestyle look" className="w-full h-full object-contain" />
                        {isGenerating && (
                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center backdrop-blur-sm p-4 text-center">
                                <Spinner />
                                <p className="text-white mt-2 font-semibold">
                                    {isGeneratingBrief ? "AI Art Director is creating the brief..." : "Generating final lifestyle image..."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default LifestyleShootPage;