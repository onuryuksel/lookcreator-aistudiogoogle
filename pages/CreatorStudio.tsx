import React, { useState, useEffect, useCallback } from 'react';
import { Model, OunassSKU, TryOnStep, Look, Lookboard, LookOverrides, SharedLookboardInstance } from '../types';
import * as db from '../services/dbService';
import * as dataService from '../services/dataService';
import * as blobService from '../services/blobService';
import * as ounassService from '../services/ounassService';
import { generateModelFromForm, generateModelFromPhoto } from '../services/modelGenerationService';
import { performVirtualTryOn } from '../services/virtualTryOnService';
import { generateTagsForLook } from '../services/tagGenerationService';
import { base64toBlob } from '../utils';

import ModelPanel from '../components/ModelPanel';
import CreatorPanel from '../components/CreatorPanel';
import TryOnSequence from '../components/TryOnSequence';
import Lookbook from './Lookbook';
import LookDetail from './LookDetail';
import ConversationalEditPage from './ConversationalEditPage';
import LifestyleShootPage from './LifestyleShootPage';
import VideoCreationPage from './VideoCreationPage';
import AddSkuPage from './AddSkuPage';

import { Modal, Button, Spinner, Dropdown, DropdownItem } from '../components/common';
import ModelCreationForm from '../components/ModelCreationForm';
import { SaveIcon, SettingsIcon } from '../components/Icons';
import FullscreenImageViewer from '../components/FullscreenImageViewer';
import SaveLookModal from '../components/SaveLookModal';
import LookboardEditorModal from '../components/LookboardEditorModal';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

type View = 'creator' | 'lookbook' | 'look-detail' | 'edit-look' | 'lifestyle-shoot' | 'video-creation' | 'add-sku';

const CreatorStudio: React.FC = () => {
    // Main state
    const [view, setView] = useState<View>('lookbook');
    const [activeLookbookTab, setActiveLookbookTab] = useState<'looks' | 'boards'>('looks');
    const [models, setModels] = useState<Model[]>([]);
    const [looks, setLooks] = useState<Look[]>([]);
    const [lookboards, setLookboards] = useState<Lookboard[]>([]);
    const [sharedInstances, setSharedInstances] = useState<Record<string, SharedLookboardInstance[]>>({});
    const [lookOverrides, setLookOverrides] = useState<LookOverrides>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);


    // Creator view state
    const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
    const [skuInput, setSkuInput] = useState('');
    const [tryOnSteps, setTryOnSteps] = useState<TryOnStep[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [finalLookImage, setFinalLookImage] = useState<string | null>(null);


    // Look detail/edit state
    const [activeLook, setActiveLook] = useState<Look | null>(null);

    // Modals state
    const [isCreateModelModalOpen, setIsCreateModelModalOpen] = useState(false);
    const [isSaveLookModalOpen, setIsSaveLookModalOpen] = useState(false);
    const [isCreatingModel, setIsCreatingModel] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [imageModalUrl, setImageModalUrl] = useState('');
    const [isEditBoardModalOpen, setIsEditBoardModalOpen] = useState(false);
    const [boardToEdit, setBoardToEdit] = useState<Lookboard | null>(null);

    // Hooks
    const { showToast } = useToast();
    const { user, logout } = useAuth();


    // --- Data Persistence ---
    const saveAllData = useCallback(async (updatedModels: Model[], updatedLooks: Look[], updatedLookboards: Lookboard[], updatedOverrides: LookOverrides, successMessage?: string) => {
        if (!user) return;
        setIsSaving(true);
        try {
            await dataService.saveLargeData(user.email, updatedModels, updatedLooks, updatedLookboards, updatedOverrides);
            showToast(successMessage || 'Changes saved to cloud.', 'success');
        } catch (error) {
            console.error('Failed to save data:', error);
            showToast('Failed to save changes to the cloud.', 'error');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [user, showToast]);


    // --- Data Loading ---
    const loadData = useCallback(async () => {
        if (!user) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const loadedModels = await db.getModels();

        // --- MIGRATION: Ensure all model images are URLs, not base64 ---
        let modelsUpdated = false;
        const migrationPromises = loadedModels.map(async (model) => {
            if (model.imageUrl && model.imageUrl.startsWith('data:image')) {
                modelsUpdated = true;
                console.log(`Migrating model image to URL for: ${model.name}`);
                try {
                    const imageBlob = await base64toBlob(model.imageUrl);
                    const imageUrl = await blobService.uploadFile(imageBlob, `model-migrated-${model.id}.png`);
                    return { ...model, imageUrl };
                } catch (migrationError) {
                    console.error(`Failed to migrate model ${model.id}, will keep base64 for now.`, migrationError);
                    return model; // return original if upload fails
                }
            }
            return model;
        });
        const migratedModels = await Promise.all(migrationPromises);
        if (modelsUpdated) {
            await db.saveModels(migratedModels);
            showToast('Updated model images to new format.', 'success');
        }
        setModels(migratedModels);
        // --- END MIGRATION ---

        if (migratedModels.length > 0 && !selectedModelId) {
            setSelectedModelId(migratedModels[0].id);
        }

        try {
            const { looks: serverLooks, lookboards: serverLookboards, overrides: serverOverrides } = await dataService.fetchServerData(user.email);
            setLooks(serverLooks);
            setLookboards(serverLookboards);
            setLookOverrides(serverOverrides || {});
        } catch (error) {
            console.error("Failed to load server data:", error);
            showToast("Could not load your data from the cloud.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [user, selectedModelId, showToast]);


    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]); // Re-load data when user logs in
    
    // NEW: Fetch shared instances whenever lookboards are loaded/updated
    useEffect(() => {
        const fetchAllInstances = async () => {
            if (lookboards.length === 0) return;

            const instancePromises = lookboards.map(async (board) => {
                try {
                    const response = await fetch(`/api/board/instances/${board.publicId}`);
                    if (!response.ok) return { publicId: board.publicId, instances: [] };
                    const data = await response.json();
                    return { publicId: board.publicId, instances: data.instances || [] };
                } catch (error) {
                    console.error(`Failed to fetch instances for board ${board.publicId}:`, error);
                    return { publicId: board.publicId, instances: [] };
                }
            });
            
            const results = await Promise.all(instancePromises);
            const instancesMap = results.reduce((acc, result) => {
                acc[result.publicId] = result.instances;
                return acc;
            }, {} as Record<string, SharedLookboardInstance[]>);
            
            setSharedInstances(instancesMap);
        };
        fetchAllInstances();
    }, [lookboards]);


    // --- Model Management ---
    const handleCreateModelFromScratch = async (formData: Omit<Model, 'imageUrl' | 'id'>) => {
        setIsCreatingModel(true);
        setError(null);
        try {
            const { imageUrl: imageBase64, name } = await generateModelFromForm(formData);
            
            const imageBlob = await base64toBlob(imageBase64);
            const imageUrl = await blobService.uploadFile(imageBlob, `model-scratch-${Date.now()}.png`);

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
            throw err; 
        } finally {
            setIsCreatingModel(false);
        }
    };

    const handleCreateModelFromPhoto = async (photo: File, name: string) => {
        setIsCreatingModel(true);
        setError(null);
        try {
            const { imageUrl: imageBase64, metadata, name: generatedName } = await generateModelFromPhoto([photo], name);

            const imageBlob = await base64toBlob(imageBase64);
            const imageUrl = await blobService.uploadFile(imageBlob, `model-photo-${Date.now()}.png`);
            
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
            throw err; 
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
        setFinalLookImage(null);
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
            const fetchedSkus = (await Promise.all(skuDataPromises)).filter((s): s is Omit<OunassSKU, 'id'> & { id: number } => s !== null);

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

            for (let i = 0; i < fetchedSkus.length; i++) {
                const sku = fetchedSkus[i];
                setTryOnSteps(prev => prev.map((step, index) => index === i ? { ...step, status: 'generating', inputImage: currentModelImage } : step));
                
                try {
                    const previousProducts = fetchedSkus.slice(0, i);
                    const newImage = await performVirtualTryOn(currentModelImage, selectedModel, sku, previousProducts);
                    
                    currentModelImage = newImage;
                    
                    setTryOnSteps(prev => prev.map((step, index) => index === i ? { ...step, outputImage: newImage, status: 'completed' } : step));
                    
                    if (i < fetchedSkus.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, 1000)); // 1-second delay
                    }
                } catch (err) {
                    setTryOnSteps(prev => prev.map((step, index) => index === i ? { ...step, status: 'failed' } : step));
                    throw err; 
                }
            }
            
            setFinalLookImage(currentModelImage);

        } catch (err) {
            console.error("Error creating look:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsGenerating(false);
            setSkuInput('');
        }
    };
    
    const handleRegenerateStep = async (stepIndex: number) => {
        const selectedModel = models.find(m => m.id === selectedModelId);
        if (!selectedModel) {
            setError("No model selected for regeneration.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setFinalLookImage(null);

        try {
            const stepsToReset = tryOnSteps.map((step, index) => 
                index >= stepIndex ? { ...step, outputImage: null, status: 'pending' as const } : step
            );
            setTryOnSteps(stepsToReset);

            const startImage = stepIndex === 0 ? selectedModel.imageUrl : tryOnSteps[stepIndex - 1].outputImage;
            if (!startImage) {
                throw new Error("Cannot regenerate. The previous step's image is missing.");
            }

            let currentModelImage = startImage;
            const allSkus = tryOnSteps.map(step => step.sku);

            for (let i = stepIndex; i < tryOnSteps.length; i++) {
                const sku = allSkus[i];
                setTryOnSteps(prev => prev.map((step, index) => index === i ? { ...step, status: 'generating', inputImage: currentModelImage } : step));

                try {
                    const previousProducts = allSkus.slice(0, i);
                    const newImage = await performVirtualTryOn(currentModelImage, selectedModel, sku, previousProducts);
                    currentModelImage = newImage;
                    setTryOnSteps(prev => prev.map((step, index) => index === i ? { ...step, outputImage: newImage, status: 'completed' } : step));
                    
                    if (i < tryOnSteps.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, 1000)); // 1-second delay
                    }
                } catch (err) {
                    setTryOnSteps(prev => prev.map((step, index) => index === i ? { ...step, status: 'failed' } : step));
                    throw err;
                }
            }
            
            setFinalLookImage(currentModelImage);

        } catch (err) {
            console.error("Error regenerating look:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred during regeneration.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveLook = async (visibility: 'public' | 'private') => {
        const selectedModel = models.find(m => m.id === selectedModelId);
        if (!finalLookImage || !selectedModel || !user) {
            showToast("Cannot save look. Final image, model, or user is missing.", "error");
            return;
        }
    
        setIsGenerating(true); 
        setError(null);
    
        try {
            const imageBlob = await base64toBlob(finalLookImage);
            const imageUrl = await blobService.uploadFile(imageBlob);

            const generatedTags = await generateTagsForLook(imageUrl);
    
            const newLook: Look = {
                id: db.generateId(),
                model: selectedModel,
                products: tryOnSteps.map(step => step.sku),
                finalImage: imageUrl,
                variations: [],
                createdAt: Date.now(),
                visibility,
                createdBy: user.email,
                createdByUsername: user.username,
                tags: generatedTags,
            };
    
            const updatedLooks = [...looks, newLook];
            setLooks(updatedLooks);
            await saveAllData(models, updatedLooks, lookboards, lookOverrides, "Look saved successfully!");
    
            setTryOnSteps([]);
            setFinalLookImage(null);
            setIsSaveLookModalOpen(false);
    
        } catch (err) {
            console.error("Error saving look:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred while saving.');
        } finally {
            setIsGenerating(false);
        }
    };


    // --- View Navigation & Look Management ---
    const handleViewLookbook = () => {
        setTryOnSteps([]);
        setFinalLookImage(null);
        setView('lookbook');
    };
    
    const handleSelectLook = (look: Look) => {
        setActiveLook(look);
        setView('look-detail');
    };

    const handleUpdateLook = async (updatedLook: Look) => {
        const updatedLooks = looks.map(l => l.id === updatedLook.id ? updatedLook : l);
        setLooks(updatedLooks);
        await saveAllData(models, updatedLooks, lookboards, lookOverrides);
        if (activeLook && activeLook.id === updatedLook.id) {
            setActiveLook(updatedLook);
        }
    };

    const handleUpdateLookOverride = async (lookId: number, newFinalImage: string) => {
        const updatedOverrides = {
            ...lookOverrides,
            [lookId]: { finalImage: newFinalImage },
        };
        setLookOverrides(updatedOverrides);
        // Save overrides separately for responsiveness
        await dataService.saveOverrides(user!.email, updatedOverrides);
        showToast("Your view of this look has been updated.", "success");
    };


    const handleDeleteLook = async (id: number) => {
        const updatedLooks = looks.filter(l => l.id !== id);
        setLooks(updatedLooks);
        await saveAllData(models, updatedLooks, lookboards, lookOverrides, "Look deleted.");
        setView('lookbook');
        setActiveLook(null);
    };

    // --- Lookboards Management ---
    const handleUpdateLookboards = async (boards: Lookboard[]) => {
        setLookboards(boards);
        await saveAllData(models, looks, boards, lookOverrides, "Lookboards updated.");
    };
    
    const handleEditLookboard = (board: Lookboard) => {
        setBoardToEdit(board);
        setIsEditBoardModalOpen(true);
    };

    const handleDuplicateLookboard = async (publicId: string) => {
        if (!user) {
            showToast('You must be logged in to duplicate a board.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const response = await fetch('/api/board', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'duplicate-board',
                    publicId: publicId,
                    user: user,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to duplicate board.');
            }

            showToast('Board duplicated successfully!', 'success');
            await loadData();
        } catch (error) {
            console.error('Failed to duplicate board:', error);
            showToast(error instanceof Error ? error.message : 'Could not duplicate board.', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleLookboardSaveSuccess = async () => {
        await loadData();
    };


    const selectedModel = models.find(m => m.id === selectedModelId);

    // --- UI Rendering ---
    const renderHeader = () => (
        <header className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-40">
            <h1 className="text-2xl font-bold">Ounass Look Creator</h1>
            <div className="flex items-center gap-4">
                 {isSaving && (
                    <div className="flex items-center gap-2 text-sm text-zinc-500 animate-pulse">
                        <Spinner />
                        <span>Saving to cloud...</span>
                    </div>
                )}
                <nav className="flex gap-4">
                    <Button variant={view === 'creator' ? 'primary' : 'secondary'} onClick={() => setView('creator')}>Create</Button>
                    <Button variant={['lookbook', 'look-detail', 'edit-look', 'lifestyle-shoot', 'video-creation', 'add-sku'].includes(view) ? 'primary' : 'secondary'} onClick={handleViewLookbook}>Lookbook ({looks.length})</Button>
                    {user?.role === 'admin' && (
                         <Button variant={'secondary'} onClick={() => window.location.href = '/admin'}>Admin Panel</Button>
                    )}
                </nav>
                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700"></div>
                 <Dropdown
                    trigger={
                        <Button variant="secondary" className="p-2" aria-label="User Settings">
                            <SettingsIcon />
                        </Button>
                    }
                >
                    <div className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                        Signed in as <span className="font-medium text-zinc-800 dark:text-zinc-200">{user?.username}</span>
                    </div>
                     <div className="border-t border-zinc-200 dark:border-zinc-700 my-1" />
                    <DropdownItem onClick={logout}>
                        Logout
                    </DropdownItem>
                </Dropdown>
            </div>
        </header>
    );

    const renderView = () => {
        if (isLoading) {
            return <div className="flex-grow flex items-center justify-center"><Spinner/> <span className="ml-2">Loading your studio...</span></div>;
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
                            {finalLookImage && !isGenerating && (
                                <div className="mt-6 text-center">
                                    <Button variant="primary" onClick={() => setIsSaveLookModalOpen(true)} className="py-3 px-6 text-lg" disabled={isSaving}>
                                        <SaveIcon />
                                        Add to Lookbook
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'lookbook':
                return <Lookbook 
                    looks={looks}
                    lookboards={lookboards} 
                    sharedInstances={sharedInstances}
                    lookOverrides={lookOverrides}
                    onSelectLook={handleSelectLook}
                    onUpdateLookboards={handleUpdateLookboards}
                    onEditLookboard={handleEditLookboard}
                    onDuplicateLookboard={handleDuplicateLookboard}
                    isSaving={isSaving}
                    onGoToCreator={() => setView('creator')}
                    activeTab={activeLookbookTab}
                    onTabChange={setActiveLookbookTab}
                />;
            case 'look-detail':
                return activeLook ? <div className="p-6"><LookDetail 
                    look={activeLook} 
                    lookOverrides={lookOverrides}
                    onBack={() => setView('lookbook')} 
                    onDelete={handleDeleteLook}
                    onUpdate={handleUpdateLook}
                    onUpdateOverride={handleUpdateLookOverride}
                    onEdit={() => setView('edit-look')}
                    onLifestyleShoot={() => setView('lifestyle-shoot')}
                    onVideoCreation={() => setView('video-creation')}
                    onAddNewSku={() => setView('add-sku')}
                    isSaving={isSaving}
                /></div> : null;
            case 'edit-look':
                 return activeLook ? <div className="p-6"><ConversationalEditPage
                    look={activeLook}
                    onBack={() => setView('look-detail')}
                    onSave={async (updatedLook) => { await handleUpdateLook(updatedLook); setView('look-detail'); }}
                    isSaving={isSaving}
                /></div> : null;
            case 'lifestyle-shoot':
                 return activeLook ? <div className="p-6"><LifestyleShootPage
                    look={activeLook}
                    onBack={() => setView('look-detail')}
                    onSave={async (updatedLook) => { await handleUpdateLook(updatedLook); setView('look-detail'); }}
                    isSaving={isSaving}
                /></div> : null;
             case 'video-creation':
                 return activeLook ? <div className="p-6"><VideoCreationPage
                    look={activeLook}
                    onBack={() => setView('look-detail')}
                    onSave={async (updatedLook) => { await handleUpdateLook(updatedLook); setView('look-detail'); }}
                    isSaving={isSaving}
                /></div> : null;
             case 'add-sku':
                 return activeLook ? <div className="p-6"><AddSkuPage
                    look={activeLook}
                    onBack={() => setView('look-detail')}
                    onSave={async (updatedLook) => { await handleUpdateLook(updatedLook); setView('look-detail'); }}
                    isSaving={isSaving}
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
            {isSaveLookModalOpen && (
                <SaveLookModal
                    isOpen={isSaveLookModalOpen}
                    onClose={() => setIsSaveLookModalOpen(false)}
                    onSubmit={handleSaveLook}
                    isSubmitting={isGenerating}
                />
            )}
            <FullscreenImageViewer
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                src={imageModalUrl}
                alt="Model Image"
            />
             <LookboardEditorModal
                isOpen={isEditBoardModalOpen}
                onClose={() => setIsEditBoardModalOpen(false)}
                board={boardToEdit}
                allUserLooks={looks}
                lookOverrides={lookOverrides}
                onSaveSuccess={handleLookboardSaveSuccess}
            />
        </div>
    );
};

export default CreatorStudio;