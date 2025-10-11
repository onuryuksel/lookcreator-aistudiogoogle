import React, { useState, useRef, useEffect } from 'react';
import { Look } from '../types';
import { Button, Spinner } from '../components/common';
import { ChevronLeftIcon, SaveIcon, PlusIcon, XIcon } from '../components/Icons';
import { editImageWithPrompt, editImageWithImageAndPrompt } from '../services/directImageEditingService';
import ImageViewer from '../components/ImageViewer';

interface ConversationalEditPageProps {
  look: Look;
  onBack: () => void;
  onSave: (updatedLook: Look) => void;
}

type ConversationTurn = {
  prompt: string;
  responseImage: string;
  uploadedImagePreview?: string; 
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};


const ConversationalEditPage: React.FC<ConversationalEditPageProps> = ({ look, onBack, onSave }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [latestImage, setLatestImage] = useState(look.finalImage);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFilePreview, setUploadedFilePreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to the bottom of the chat history when it updates
    if (chatHistoryRef.current) {
        chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [conversation]);


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const preview = await fileToBase64(file);
      setUploadedFilePreview(preview);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !uploadedFile) return;

    setIsGenerating(true);
    setError(null);
    
    try {
      const newImage = uploadedFile
        ? await editImageWithImageAndPrompt(latestImage, uploadedFile, prompt)
        : await editImageWithPrompt(latestImage, prompt);

      const newTurn: ConversationTurn = {
        prompt: prompt,
        responseImage: newImage,
        uploadedImagePreview: uploadedFilePreview || undefined,
      };

      setConversation(prev => [...prev, newTurn]);
      setLatestImage(newImage);
      
      // Reset inputs
      setPrompt('');
      setUploadedFile(null);
      setUploadedFilePreview(null);
      if(fileInputRef.current) fileInputRef.current.value = '';

    } catch (err) {
      console.error("Error editing image:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during image generation.';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (conversation.length > 0) {
        const updatedLook: Look = {
            ...look,
            variations: [...new Set([...(look.variations || []), latestImage])],
        };
        onSave(updatedLook);
    } else {
        onBack();
    }
  };
  
  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-10rem)]">
      {/* Left Panel: Chat & Controls */}
      <div className="lg:w-1/3 flex flex-col h-full">
         <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <Button onClick={onBack} variant="secondary">
                <ChevronLeftIcon /> Back to Look Details
            </Button>
            <Button onClick={handleSave} disabled={isGenerating || conversation.length === 0}>
                <SaveIcon /> Save as Variation
            </Button>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 flex-grow flex flex-col">
            <h2 className="text-xl font-bold mb-2 flex-shrink-0">Edit with AI</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 flex-shrink-0">
                Describe your edit. You can also add an image to guide the AI.
            </p>
            
            {/* Chat History */}
            <div ref={chatHistoryRef} className="flex-grow overflow-y-auto space-y-4 pr-2 -mr-2 mb-4">
                {conversation.map((turn, index) => (
                    <div key={index} className="flex flex-col items-start">
                        <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg max-w-xs">
                            <p className="text-sm">{turn.prompt}</p>
                            {turn.uploadedImagePreview && <img src={turn.uploadedImagePreview} className="mt-2 rounded-md max-w-24 max-h-24"/>}
                        </div>
                        <img src={turn.responseImage} className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-700 w-24 h-auto"/>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="mt-auto flex-shrink-0 space-y-3">
                {error && (
                    <div className="p-3 bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
                        <p className="font-bold text-sm">An Error Occurred</p>
                        <p className="text-xs">{error}</p>
                    </div>
                )}
                {uploadedFilePreview && (
                    <div className="relative w-20 h-20">
                        <img src={uploadedFilePreview} className="rounded-md w-full h-full object-cover"/>
                        <button onClick={() => { setUploadedFile(null); setUploadedFilePreview(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute -top-1 -right-1 bg-zinc-800 text-white rounded-full p-0.5">
                            <XIcon />
                        </button>
                    </div>
                )}
                <div className="flex gap-2 items-center">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden"/>
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isGenerating}>
                        <PlusIcon/>
                    </Button>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., add these sunglasses..."
                        rows={1}
                        className="flex-grow px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-white text-zinc-900 placeholder-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 dark:placeholder-zinc-500 disabled:opacity-50 resize-none"
                        disabled={isGenerating}
                    />
                    <Button onClick={handleGenerate} disabled={isGenerating || (!prompt.trim() && !uploadedFile)} className="h-10">
                        {isGenerating ? <Spinner /> : 'Generate'}
                    </Button>
                </div>
            </div>
        </div>
      </div>

      {/* Right Panel: Image Viewer */}
      <div className="lg:w-2/3 h-full">
        <ImageViewer
          src={latestImage}
          alt="Editable look"
          isLoading={isGenerating}
          loadingText="Generating..."
        />
      </div>
    </div>
  );
};

export default ConversationalEditPage;