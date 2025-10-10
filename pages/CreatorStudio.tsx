import React, { useState, useEffect } from 'react';
import { Model, Look, OunassSKU, TryOnStep } from '../types';
import CreatorPanel from '../components/CreatorPanel';
import ModelPanel from '../components/ModelPanel';
import TryOnSequence from '../components/TryOnSequence';
import ModelCreationForm from '../components/ModelCreationForm';
import { Modal, Button, Spinner } from '../components/common';
import { SaveIcon } from '../components/Icons';
import { fetchSkuData } from '../services/ounassService';
import { generateModelFromForm, generateModelFromPhoto } from '../services/modelGenerationService';
import { performVirtualTryOn } from '../services/virtualTryOnService';

interface CreatorStudioProps {
  models: Model[];
  onLookSaved: (look: Omit<Look, 'id'>) => void;
  onModelCreated: (model: Omit<Model, 'id'>) => Promise<Model>;
  onModelDeleted: (id: number) => void;
}

const CreatorStudio: React.FC<CreatorStudioProps> = ({ models, onLookSaved, onModelCreated, onModelDeleted }) => {
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [skuInput, setSkuInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingModel, setIsCreatingModel] = useState(false);
  const [tryOnSteps, setTryOnSteps] = useState<TryOnStep[]>([]);
  
  const [isCreateModelModalOpen, setIsCreateModelModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageModalUrl, setImageModalUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedModel = models.find(m => m.id === selectedModelId);
  const canSave = tryOnSteps.length > 0 && tryOnSteps.every(s => s.status === 'completed');

  useEffect(() => {
    if (models.length > 0 && !selectedModelId) {
      setSelectedModelId(models[0].id!);
    }
    if (selectedModelId && !models.find(m => m.id === selectedModelId)) {
      setSelectedModelId(models.length > 0 ? models[0].id! : null);
    }
  }, [models, selectedModelId]);

  const handleSelectModel = (id: number) => {
    if (isGenerating) return;
    setSelectedModelId(id);
    setTryOnSteps([]);
    setSkuInput('');
    setError(null);
  };

  const processTryOnQueue = async (steps: TryOnStep[]) => {
    let currentSteps = [...steps];
    
    for (let i = 0; i < currentSteps.length; i++) {
        if(currentSteps[i].status === 'completed') continue;

        const previousStep = i > 0 ? currentSteps[i-1] : null;
        const inputImage = previousStep ? previousStep.outputImage : selectedModel!.imageUrl;
        const previousProducts = currentSteps.slice(0, i).map(s => s.sku);
        
        currentSteps = currentSteps.map((step, idx) => 
            idx === i ? { ...step, status: 'generating', inputImage } : step
        );
        setTryOnSteps(currentSteps);
        
        try {
            const outputImage = await performVirtualTryOn(inputImage, selectedModel!, currentSteps[i].sku, previousProducts);
            currentSteps = currentSteps.map((step, idx) => 
                idx === i ? { ...step, status: 'completed', outputImage } : step
            );
            setTryOnSteps(currentSteps);
        } catch (err) {
            console.error(`Error processing step ${i + 1} for SKU ${currentSteps[i].sku.sku}:`, err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed at step ${i + 1}: ${errorMessage}`);
            currentSteps = currentSteps.map((step, idx) => 
                idx === i ? { ...step, status: 'failed' } : step
            );
            setTryOnSteps(currentSteps);
            return; // Stop processing on failure
        }
    }
  }

  const handleAddSku = async () => {
    if (!selectedModel || !skuInput.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setTryOnSteps([]);

    const skuCodes = skuInput.split(',').map(s => s.trim()).filter(Boolean);
    const newSteps: TryOnStep[] = [];
    
    for (const sku of skuCodes) {
      const product = await fetchSkuData(sku);
      if (product) {
        newSteps.push({
          sku: product,
          inputImage: '',
          outputImage: '',
          prompt: '',
          status: 'pending',
        });
      } else {
        setError(`SKU not found: ${sku}`);
        setIsGenerating(false);
        return;
      }
    }

    setTryOnSteps(newSteps);
    await processTryOnQueue(newSteps);

    setIsGenerating(false);
  };

  const handleRegenerateStep = async (stepIndex: number) => {
    setIsGenerating(true);
    setError(null);
    
    // FIX: Explicitly type the `stepsToProcess` array as `TryOnStep[]`.
    // This resolves an issue where TypeScript's type inference was widening the `status` property
    // to a generic `string` instead of preserving its literal union type, causing a type mismatch.
    const stepsToProcess: TryOnStep[] = tryOnSteps.map((step, index) => 
      index >= stepIndex ? { ...step, status: 'pending', outputImage: '' } : step
    );
    setTryOnSteps(stepsToProcess);

    await processTryOnQueue(stepsToProcess);
    
    setIsGenerating(false);
  };

  const handleSaveLook = () => {
    if (!canSave || !selectedModel) return;

    const finalImage = tryOnSteps[tryOnSteps.length - 1].outputImage;
    const products = tryOnSteps.map(step => step.sku);

    const newLook: Omit<Look, 'id'> = {
      finalImage,
      products,
      baseImage: selectedModel.imageUrl,
      createdAt: Date.now(),
    };
    onLookSaved(newLook);
    setTryOnSteps([]);
    setSkuInput('');
  };

  const handleCreateModelFromScratch = async (formData: Omit<Model, 'imageUrl' | 'id'>) => {
    setIsCreatingModel(true);
    try {
        const { imageUrl, name } = await generateModelFromForm(formData);
        const newModelData = { ...formData, imageUrl, name };
        const newModel = await onModelCreated(newModelData);
        setSelectedModelId(newModel.id!);
        setIsCreateModelModalOpen(false);
    } catch (err) {
        console.error("Error creating model from scratch:", err);
        throw err;
    } finally {
        setIsCreatingModel(false);
    }
  };
  
  const handleCreateModelFromPhoto = async (photo: File, name: string) => {
    setIsCreatingModel(true);
    try {
      const { imageUrl, metadata, name: generatedName } = await generateModelFromPhoto([photo], name);
      const newModelData: Omit<Model, 'id'> = { ...metadata, imageUrl, name: generatedName };
      const newModel = await onModelCreated(newModelData);
      setSelectedModelId(newModel.id!);
      setIsCreateModelModalOpen(false);
    } catch (err) {
      console.error("Error creating model from photo:", err);
      throw err;
    } finally {
      setIsCreatingModel(false);
    }
  };

  const openImageModal = (imageUrl: string) => {
    setImageModalUrl(imageUrl);
    setIsImageModalOpen(true);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      <div className="lg:w-1/3 xl:w-1/4">
        <ModelPanel
          models={models}
          selectedModelId={selectedModelId}
          onSelectModel={handleSelectModel}
          onDeleteModel={onModelDeleted}
          onOpenCreateModelModal={() => setIsCreateModelModalOpen(true)}
          onOpenImageModal={openImageModal}
        />
      </div>
      <div className="lg:w-2/3 xl:w-3/4 flex-1 flex flex-col gap-6">
        <CreatorPanel
          selectedModel={selectedModel}
          skuInput={skuInput}
          onSkuInputChange={setSkuInput}
          onAddSku={handleAddSku}
          isGenerating={isGenerating}
        />

        {error && (
            <div className="p-4 bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
                <p className="font-bold">An Error Occurred</p>
                <p className="text-sm">{error}</p>
            </div>
        )}

        {tryOnSteps.length > 0 && (
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <TryOnSequence 
                steps={tryOnSteps}
                isGenerating={isGenerating}
                onRegenerateStep={handleRegenerateStep}
            />
          </div>
        )}

        {canSave && (
          <div className="mt-auto pt-4 flex justify-end">
            <Button onClick={handleSaveLook} disabled={isGenerating}>
              <SaveIcon/>
              Save to Lookbook
            </Button>
          </div>
        )}

      </div>

      <Modal isOpen={isCreateModelModalOpen} onClose={() => !isCreatingModel && setIsCreateModelModalOpen(false)} title="Create New Model">
        <ModelCreationForm 
          onClose={() => setIsCreateModelModalOpen(false)}
          isCreating={isCreatingModel}
          onCreateFromScratch={handleCreateModelFromScratch}
          onCreateFromPhoto={handleCreateModelFromPhoto}
        />
      </Modal>
      
      <Modal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} title="Model Image">
        <img src={imageModalUrl} alt="Model full view" className="max-w-full max-h-[80vh] mx-auto"/>
      </Modal>

    </div>
  );
};

export default CreatorStudio;