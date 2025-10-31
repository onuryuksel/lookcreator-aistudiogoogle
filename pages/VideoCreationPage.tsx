import React, { useState, useEffect, useMemo } from 'react';
import { Look } from '../types';
import * as blobService from '../services/blobService';
import { base64toBlob } from '../utils';
import { Button, Spinner } from '../components/common';
import { ChevronLeftIcon, SaveIcon } from '../components/Icons';
import { generateVideo, generateVideoDirectorPrompt } from '../services/videoCreationService';
import { changeImageAspectRatio } from '../services/directImageEditingService';
import ImageViewer from '../components/ImageViewer';
import { useToast } from '../contexts/ToastContext';

interface VideoCreationPageProps {
  look: Look;
  onBack: () => void;
  onSave: (updatedLook: Look) => Promise<void>;
  isSaving: boolean;
}

type PageStep = 'input' | 'review' | 'result';

const getImageDimensions = (url: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; 
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = (err) => reject(err);
        img.src = url;
    });
};

const VideoCreationPage: React.FC<VideoCreationPageProps> = ({ look, onBack, onSave, isSaving }) => {
  const [step, setStep] = useState<PageStep>('input');
  
  const [startImage, setStartImage] = useState<string>(look.finalImage);
  const [endImage, setEndImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [durationSeconds, setDurationSeconds] = useState<number>(4);

  const [directorPrompt, setDirectorPrompt] = useState<string>('');
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const allImages = useMemo(() => {
    return [...new Set([look.finalImage, ...(look.variations || [])])].filter(
      (asset) => asset && !asset.startsWith('data:video/') && !asset.includes('.mp4') // Filter out videos
    );
  }, [look.finalImage, look.variations]);

  const handleGenerateBrief = async () => {
    setIsGenerating(true);
    setLoadingMessage('AI Video Director is crafting a prompt...');
    setError(null);
    try {
      const prompt = await generateVideoDirectorPrompt(look, startImage, endImage, aspectRatio);
      setDirectorPrompt(prompt);
      setStep('review');
    } catch (err) {
      console.error("Error generating director brief:", err);
      setError(err instanceof Error ? err.message : 'Failed to generate brief.');
    } finally {
      setIsGenerating(false);
      setLoadingMessage('');
    }
  };

  const handleGenerateVideo = async () => {
    setIsGenerating(true);
    setError(null);

    let conformedStartImage = startImage;
    let conformedEndImage = endImage;
    const targetRatioValue = aspectRatio === '16:9' ? 16 / 9 : 9 / 16;

    try {
        // --- START: Aspect Ratio Conformance ---
        setLoadingMessage('Checking image aspect ratios...');
        
        // Check Start Image
        const startDims = await getImageDimensions(startImage);
        const startRatioValue = startDims.width / startDims.height;
        if (Math.abs(startRatioValue - targetRatioValue) > 0.05) { // Using a tolerance
            showToast(`Start image aspect ratio doesn't match. Conforming to ${aspectRatio}...`, 'success');
            setLoadingMessage(`AI is conforming start image to ${aspectRatio}...`);
            const correctedBase64 = await changeImageAspectRatio(startImage, aspectRatio);
            const correctedBlob = await base64toBlob(correctedBase64);
            conformedStartImage = await blobService.uploadFile(correctedBlob, `conformed-start-${Date.now()}.png`);
        }

        // Check End Image
        if (endImage) {
            const endDims = await getImageDimensions(endImage);
            const endRatioValue = endDims.width / endDims.height;
            if (Math.abs(endRatioValue - targetRatioValue) > 0.05) {
                showToast(`End image aspect ratio doesn't match. Conforming to ${aspectRatio}...`, 'success');
                setLoadingMessage(`AI is conforming end image to ${aspectRatio}...`);
                const correctedBase64 = await changeImageAspectRatio(endImage, aspectRatio);
                const correctedBlob = await base64toBlob(correctedBase64);
                conformedEndImage = await blobService.uploadFile(correctedBlob, `conformed-end-${Date.now()}.png`);
            }
        }
        // --- END: Aspect Ratio Conformance ---


        setLoadingMessage('Initializing video generation with Veo... This can take a few minutes.');
        const videoBase64 = await generateVideo(directorPrompt, conformedStartImage, conformedEndImage, aspectRatio, durationSeconds);
        const videoBlob = await base64toBlob(videoBase64, 'video/mp4');
        const videoUrl = await blobService.uploadFile(videoBlob, 'video.mp4');
        setGeneratedVideo(videoUrl);
        setStep('result');
    } catch (err) {
        console.error("Error generating video:", err);
        if (err instanceof Error && err.message === 'API_KEY_INVALID') {
            setError("Your API key is invalid or requires billing to be enabled. Please check your Vercel environment variables.");
        } else {
            setError(err instanceof Error ? err.message : 'Failed to generate video.');
        }
    } finally {
        setIsGenerating(false);
        setLoadingMessage('');
    }
  };

  const handleSave = async () => {
    if (generatedVideo) {
        try {
            const updatedLook: Look = {
                ...look,
                variations: [...new Set([...(look.variations || []), generatedVideo])],
            };
            await onSave(updatedLook);
        } catch(err) {
            // Error is handled by parent
        }
    } else {
      onBack();
    }
  };
  
  const renderContent = () => {
    switch (step) {
      case 'input':
        return (
          <>
            <h2 className="text-xl font-bold mb-2">Step 1: Video Setup</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Select the images and settings for your video.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Image</label>
                <div className="flex gap-2 overflow-x-auto p-1">
                  {allImages.map((img) => (
                    <img key={img} src={img} onClick={() => setStartImage(img)} className={`w-20 h-auto rounded-md cursor-pointer ring-2 ring-offset-2 ${startImage === img ? 'ring-zinc-900 dark:ring-zinc-200' : 'ring-transparent'}`} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Image (Optional)</label>
                 <div className="flex gap-2 overflow-x-auto p-1">
                    <div onClick={() => setEndImage(null)} className={`w-20 h-auto rounded-md cursor-pointer ring-2 ring-offset-2 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-xs text-center p-2 ${!endImage ? 'ring-zinc-900 dark:ring-zinc-200' : 'ring-transparent'}`}>No End Image</div>
                  {allImages.map((img) => (
                    <img key={img} src={img} onClick={() => setEndImage(img)} className={`w-20 h-auto rounded-md cursor-pointer ring-2 ring-offset-2 ${endImage === img ? 'ring-zinc-900 dark:ring-zinc-200' : 'ring-transparent'}`} />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Aspect Ratio</label>
                  <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')} className="w-full p-2 border rounded-md bg-transparent dark:border-zinc-700 dark:bg-zinc-900">
                    <option value="16:9">16:9 (Landscape)</option>
                    <option value="9:16">9:16 (Portrait)</option>
                  </select>
                </div>
                 <div>
                  <label className={`block text-sm font-medium mb-1 ${endImage ? 'text-zinc-400 dark:text-zinc-600' : ''}`}>Duration (seconds)</label>
                  <select 
                    value={durationSeconds} 
                    onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10))} 
                    className="w-full p-2 border rounded-md bg-transparent dark:border-zinc-700 dark:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!!endImage}
                  >
                    <option value="4">4 seconds</option>
                    <option value="6">6 seconds</option>
                    <option value="8">8 seconds</option>
                  </select>
                  {endImage && <p className="text-xs text-zinc-500 mt-1">Duration is determined by the start-to-end image transition.</p>}
                </div>
              </div>
            </div>
          </>
        );
      case 'review':
        return (
          <>
            <h2 className="text-xl font-bold mb-2">Step 2: Review Brief</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">The AI Video Director has created a prompt. Review it, then proceed to generate the video.</p>
            <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-md text-sm whitespace-pre-wrap overflow-x-auto max-h-80 mb-4">
              <p>{directorPrompt}</p>
            </div>
          </>
        );
      case 'result':
        return (
          <>
            <h2 className="text-xl font-bold mb-2">Step 3: Final Video</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Here is your generated video. You can save it as a new variation for your look.</p>
          </>
        );
    }
  };
  
  const displaySrc = generatedVideo || startImage;
  const viewerAlt = generatedVideo ? "Generated Video" : "Start Image Preview";
  const currentLoadingText = isSaving ? "Saving variation..." : loadingMessage;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Button onClick={step === 'input' ? onBack : () => setStep('input')} variant="secondary" disabled={isGenerating || isSaving}>
          <ChevronLeftIcon /> {step === 'input' ? 'Back to Look' : 'Back to Setup'}
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
                <Button onClick={handleGenerateBrief} disabled={isGenerating || isSaving}>
                  {isGenerating ? <Spinner /> : 'Generate Brief'}
                </Button>
              )}
              {step === 'review' && (
                <Button onClick={handleGenerateVideo} disabled={isGenerating || isSaving}>
                  {isGenerating ? <Spinner /> : 'Generate Video'}
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="lg:w-1/2">
          <div className="sticky top-24">
            <div className="aspect-[3/4]">
              <ImageViewer src={displaySrc} alt={viewerAlt} isLoading={isGenerating || isSaving} loadingText={currentLoadingText} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCreationPage;