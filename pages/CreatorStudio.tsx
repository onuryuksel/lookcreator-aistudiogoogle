
import React, { useState, useEffect, useCallback } from 'react';
import { Model, OunassSKU, TryOnStep, Look, Lookboard } from '../types';
import * as db from '../services/dbService';
import * as ounassService from '../services/ounassService';
import { generateModelFromForm, generateModelFromPhoto } from '../services/modelGenerationService';
import { performVirtualTryOn } from '../services/virtualTryOnService';

import ModelPanel from '../components/ModelPanel';
import CreatorPanel from '../components/CreatorPanel';
import TryOnSequence from '../components/TryOnSequence';
import Lookbook from './Lookbook';
import LookDetail from './LookDetail';
import ConversationalEditPage from './ConversationalEditPage';
import LifestyleShootPage from './LifestyleShootPage';

import { Modal, Button, Spinner } from '../components/common';
import ModelCreationForm from '../components/ModelCreationForm';

type View = 'creator' | 'lookbook' | 'look-detail' | 'edit-look' | 'lifestyle-shoot';

const CreatorStudio: React.FC = () => {
    // Main state
    const [view, setView] = useState<View>('creator');
    const [models, setModels] = useState<Model[]>([]);
    const [looks, setLooks] = useState<Look[]>([]);
    const [lookboards, setLookboards] = useState<Lookboard[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Creator view state
    const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
    const [skuInput, setSkuInput] = useState('');
    const [tryOnSteps, setTryOnSteps] = useState<TryOnStep[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Look detail/edit state
    const [activeLook, setActiveLook] = useState<Look | null>(null);

    // Modals state
    const [isCreateModelModalOpen, setIsCreateModelModalOpen] = useState(false);
    const [isCreatingModel, setIsCreatingModel] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [imageModalUrl, setImageModalUrl] = useState('');

    // --- Data Loading ---
    const loadData = useCallback(async () => {
        setIsLoading(true);
        const [loadedModels, loadedLooks, loadedLookboards] = await Promise.all([db.getModels(), db.getLooks(), db.getLookboards()]);
        setModels(loadedModels);
        setLooks(loadedLooks);
        setLookboards(loadedLookboards);
        if (loadedModels.length > 0 && !selectedModelId) {
            setSelectedModelId(loadedModels[0].id);
        }
        setIsLoading(false);
    }, [selectedModelId]);

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once on mount

    // --- Model Management ---
    const handleCreateModelFromScratch = async (formData: Omit<Model, 'imageUrl' | 'id'>) => {
        setIsCreatingModel(true);
        setError(null);
        try {
            const { imageUrl, name } = await generateModelFromForm(formData);
            const newModel: Model = {
                id: db.generateId(),
                imageUrl,
                name: name || formData.name || 'New Model',
                ...formData
            };
            const updatedModels = [...models, newModel];
            setModels(updatedModels);
            await db.saveModels(updatedModels);
            setSelectedModelId(newModel.id);
            setIsCreateModelModalOpen(false);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to create model.');
            throw err; // Re-throw to keep form in error state
        } finally {
            setIsCreatingModel(false);
        }
    };

    const handleCreateModelFromPhoto = async (photo: File, name: string) => {
        setIsCreatingModel(true);
        setError(null);
        try {
            const { imageUrl, metadata, name: generatedName } = await generateModelFromPhoto([photo], name);
            const newModel: Model = {
                id: db.generateId(),
                imageUrl,
                name: name || generatedName,
                ...metadata
            };
            const updatedModels = [...models, newModel];
            setModels(updatedModels);
            await db.saveModels(updatedModels);
            setSelectedModelId(newModel.id);
            setIsCreateModelModalOpen(false);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to create model from photo.');
            throw err; // Re-throw to keep form in error state
        } finally {
            setIsCreatingModel(false);
        }
    };

    const handleDeleteModel = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this model?')) {
            const updatedModels = models.filter(m => m.id !== id);
            setModels(updatedModels);
            await db.saveModels(updatedModels);
            if (selectedModelId === id) {
                setSelectedModelId(updatedModels.length > 0 ? updatedModels[0].id : null);
            }
        }
    };

    // --- Look Creation ---
    const handleAddSku = async () => {
        setError(null);
        const skus = skuInput.split(',').map(s => s.trim()).filter(Boolean);
        if (skus.length === 0) return;

        const selectedModel = models.find(m => m.id === selectedModelId);
        if (!selectedModel) {
            setError('Please select a model first.');
            return;
        }

        setIsGenerating(true);

        try {
            const skuDataPromises = skus.map(ounassService.fetchSkuData);
            const fetchedSkus = (await Promise.all(skuDataPromises)).filter((s): s is OunassSKU => s !== null);

            if (fetchedSkus.length !== skus.length) {
                const notFoundSkus = skus.filter(originalSku => !fetchedSkus.some(fetched => fetched.sku === originalSku));
                throw new Error(`Could not find data for SKU(s): ${notFoundSkus.join(', ')}`);
            }
            
            const initialSteps: TryOnStep[] = fetchedSkus.map(sku => ({
                sku,
                inputImage: '',
                outputImage: null,
                status: 'pending'
            }));
            setTryOnSteps(initialSteps);

            let currentModelImage = selectedModel.imageUrl;
            const completedSteps: TryOnStep[] = [];

            for (let i = 0; i < fetchedSkus.length; i++) {
                const sku = fetchedSkus[i];
                setTryOnSteps(prev => prev.map((step, index) => index === i ? { ...step, status: 'generating', inputImage: currentModelImage } : step));
                
                try {
                    const previousProducts = fetchedSkus.slice(0, i);
                    const newImage = await performVirtualTryOn(currentModelImage, selectedModel, sku, previousProducts);
                    
                    const completedStep = { sku, inputImage: currentModelImage, outputImage: newImage, status: 'completed' as const };
                    completedSteps.push(completedStep);
                    currentModelImage = newImage;
                    
                    setTryOnSteps(prev => prev.map((step, index) => index === i ? completedStep : step));
                } catch (err) {
                    setTryOnSteps(prev => prev.map((step, index) => index === i ? { ...step, status: 'failed' } : step));
                    throw err; // Stop the process
                }
            }
            
            // --- Save the final look ---
            const newLook: Look = {
                id: db.generateId(),
                model: selectedModel,
                products: fetchedSkus,
                finalImage: currentModelImage,
                variations: [],
                createdAt: Date.now()
            };
            const updatedLooks = [...looks, newLook];
            setLooks(updatedLooks);
            await db.saveLooks(updatedLooks);

        } catch (err) {
            console.error("Error creating look:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsGenerating(false);
            setSkuInput('');
        }
    };
    
    const handleRegenerateStep = async (stepIndex: number) => {
        // This is a complex feature to implement fully. For now, it will re-run the whole process up to that step.
        alert("Regeneration is a complex process. For now, please restart the look creation if a step fails.");
    };

    // --- View Navigation & Look Management ---
    const handleViewLookbook = () => {
        setTryOnSteps([]);
        setView('lookbook');
    };
    
    const handleSelectLook = (look: Look) => {
        setActiveLook(look);
        setView('look-detail');
    };

    const handleUpdateLook = async (updatedLook: Look) => {
        const updatedLooks = looks.map(l => l.id === updatedLook.id ? updatedLook : l);
        setLooks(updatedLooks);
        await db.saveLooks(updatedLooks);
        if (activeLook && activeLook.id === updatedLook.id) {
            setActiveLook(updatedLook);
        }
    };

    const handleDeleteLook = async (id: number) => {
        const updatedLooks = looks.filter(l => l.id !== id);
        setLooks(updatedLooks);
        await db.saveLooks(updatedLooks);
        setView('lookbook');
        setActiveLook(null);
    };

    // --- Lookboards Management ---
    const handleUpdateLookboards = async (boards: Lookboard[]) => {
        setLookboards(boards);
        await db.saveLookboards(boards);
    };

    const selectedModel = models.find(m => m.id === selectedModelId);

    // --- UI Rendering ---
    const renderHeader = () => (
        <header className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-40">
            <h1 className="text-2xl font-bold">Ounass AI Studio</h1>
            <nav className="flex gap-4">
                <Button variant={view === 'creator' ? 'primary' : 'secondary'} onClick={() => setView('creator')}>Creator Studio</Button>
                <Button variant={view === 'lookbook' ? 'primary' : 'secondary'} onClick={handleViewLookbook}>My Looks ({looks.length})</Button>
            </nav>
        </header>
    );

    const renderView = () => {
        if (isLoading) {
            return <div className="flex-grow flex items-center justify-center"><Spinner/> <span className="ml-2">Loading Studio...</span></div>;
        }

        switch (view) {
            case 'creator':
                return (
                    <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
                        <div className="lg:col-span-1">
                            <ModelPanel
                                models={models}
                                selectedModelId={selectedModelId}
                                onSelectModel={setSelectedModelId}
                                onDeleteModel={handleDeleteModel}
                                onOpenCreateModelModal={() => setIsCreateModelModalOpen(true)}
                                onOpenImageModal={(url) => { setImageModalUrl(url); setIsImageModalOpen(true); }}
                            />
                        </div>
                        <div className="lg:col-span-2 space-y-6">
                            <CreatorPanel
                                selectedModel={selectedModel}
                                skuInput={skuInput}
                                onSkuInputChange={setSkuInput}
                                onAddSku={handleAddSku}
                                isGenerating={isGenerating}
                            />
                             {error && <div className="p-4 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200 rounded-lg">{error}</div>}
                            {tryOnSteps.length > 0 && (
                                <TryOnSequence
                                    steps={tryOnSteps}
                                    isGenerating={isGenerating}
                                    onRegenerateStep={handleRegenerateStep}
                                />
                            )}
                        </div>
                    </div>
                );
            case 'lookbook':
                return <Lookbook 
                    looks={looks}
                    lookboards={lookboards} 
                    onSelectLook={handleSelectLook}
                    onUpdateLookboards={handleUpdateLookboards}
                />;
            case 'look-detail':
                return activeLook ? <div className="p-6"><LookDetail 
                    look={activeLook} 
                    onBack={() => setView('lookbook')} 
                    onDelete={handleDeleteLook}
                    onUpdate={handleUpdateLook}
                    onEdit={() => setView('edit-look')}
                    onLifestyleShoot={() => setView('lifestyle-shoot')}
                /></div> : null;
            case 'edit-look':
                 return activeLook ? <div className="p-6"><ConversationalEditPage
                    look={activeLook}
                    onBack={() => setView('look-detail')}
                    onSave={(updatedLook) => { handleUpdateLook(updatedLook); setView('look-detail'); }}
                /></div> : null;
            case 'lifestyle-shoot':
                 return activeLook ? <div className="p-6"><LifestyleShootPage
                    look={activeLook}
                    onBack={() => setView('look-detail')}
                    onSave={(updatedLook) => { handleUpdateLook(updatedLook); setView('look-detail'); }}
                /></div> : null;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans flex flex-col">
            {renderHeader()}
            <main className="flex-grow flex flex-col">
                {renderView()}
            </main>
            {isCreateModelModalOpen && (
                <Modal isOpen={isCreateModelModalOpen} onClose={() => setIsCreateModelModalOpen(false)} title="Create New Model">
                    <ModelCreationForm
                        onClose={() => setIsCreateModelModalOpen(false)}
                        isCreating={isCreatingModel}
                        onCreateFromScratch={handleCreateModelFromScratch}
                        onCreateFromPhoto={handleCreateModelFromPhoto}
                    />
                </Modal>
            )}
            {isImageModalOpen && (
                <Modal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} title="Model Image">
                    <img src={imageModalUrl} alt="Model" className="max-w-full max-h-[80vh] mx-auto" />
                </Modal>
            )}
        </div>
    );
};

export default CreatorStudio;
