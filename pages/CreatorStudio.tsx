import React, { useState, useEffect, useCallback } from 'react';
import { Model, OunassSKU, TryOnStep, Look, Lookboard } from '../types';
import * as db from '../services/dbService';
import * as dataService from '../services/dataService';
import * as blobService from '../services/blobService';
import * as ounassService from '../services/ounassService';
import { generateModelFromForm, generateModelFromPhoto } from '../services/modelGenerationService';
import { performVirtualTryOn } from '../services/virtualTryOnService';
import { base64toBlob } from '../utils';

import ModelPanel from '../components/ModelPanel';
import CreatorPanel from '../components/CreatorPanel';
import TryOnSequence from '../components/TryOnSequence';
import Lookbook from './Lookbook';
import LookDetail from './LookDetail';
import ConversationalEditPage from './ConversationalEditPage';
import LifestyleShootPage from './LifestyleShootPage';
import VideoCreationPage from './VideoCreationPage';

import { Modal, Button, Spinner, Dropdown, DropdownItem } from '../components/common';
import ModelCreationForm from '../components/ModelCreationForm';
import { SaveIcon, SettingsIcon, DownloadIcon, UploadIcon, TrashIcon, CloudUploadIcon } from '../components/Icons';
import FullscreenImageViewer from '../components/FullscreenImageViewer';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

type View = 'creator' | 'lookbook' | 'look-detail' | 'edit-look' | 'lifestyle-shoot' | 'video-creation';

const CreatorStudio: React.FC = () => {
    // Main state
    const [view, setView] = useState<View>('creator');
    const [models, setModels] = useState<Model[]>([]);
    const [looks, setLooks] = useState<Look[]>([]);
    const [lookboards, setLookboards] = useState<Lookboard[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);
    const [isImporting, setIsImporting] = useState(false);


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
    const [isCreatingModel, setIsCreatingModel] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [imageModalUrl, setImageModalUrl] = useState('');

    // Hooks
    const { showToast } = useToast();
    const { user, logout } = useAuth();


    // --- Data Persistence ---
    const saveAllData = useCallback(async (updatedModels: Model[], updatedLooks: Look[], updatedLookboards: Lookboard[]) => {
        if (!user) return;
        try {
            await dataService.saveLargeData(user.email, updatedModels, updatedLooks, updatedLookboards);
            // Models are also saved locally
            await db.saveModels(updatedModels);
            showToast('Changes saved to cloud.', 'success');
        } catch (error) {
            console.error('Failed to save data:', error);
            showToast('Failed to save changes to the cloud.', 'error');
        }
    }, [user, showToast]);


    // --- Data Loading ---
    const loadData = useCallback(async () => {
        if (!user) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        // Models are still local as they are not user-specific yet
        const loadedModels = await db.getModels();
        setModels(loadedModels);

        if (loadedModels.length > 0 && !selectedModelId) {
            setSelectedModelId(loadedModels[0].id);
        }

        try {
            const { looks: serverLooks, lookboards: serverLookboards } = await dataService.fetchServerData(user.email);
            setLooks(serverLooks);
            setLookboards(serverLookboards);
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
                } catch (err) {
                    setTryOnSteps(prev => prev.map((step, index) => index === i ? { ...step, status: 'failed' } : step));
                    throw err; // Stop the process
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

    const handleSaveLook = async () => {
        const selectedModel = models.find(m => m.id === selectedModelId);
        if (!finalLookImage || !selectedModel) {
            showToast("Cannot save look. Final image or model is missing.", "error");
            return;
        }
    
        setIsGenerating(true); // Reuse isGenerating for saving state
        setError(null);
    
        try {
            // 1. Convert base64 to Blob
            const imageBlob = await base64toBlob(finalLookImage);
    
            // 2. Upload Blob and get URL
            const imageUrl = await blobService.uploadFile(imageBlob);
    
            // 3. Create new Look with URL
            const newLook: Look = {
                id: db.generateId(),
                model: selectedModel,
                products: tryOnSteps.map(step => step.sku),
                finalImage: imageUrl,
                variations: [],
                createdAt: Date.now()
            };
    
            // 4. Update state and save to server
            const updatedLooks = [...looks, newLook];
            setLooks(updatedLooks);
            await saveAllData(models, updatedLooks, lookboards);
            showToast("Look saved successfully!", "success");
    
            // 5. Reset for next creation
            setTryOnSteps([]);
            setFinalLookImage(null);
    
        } catch (err) {
            console.error("Error saving look:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred while saving.');
            showToast("Failed to save look.", "error");
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
        await saveAllData(models, updatedLooks, lookboards);
        if (activeLook && activeLook.id === updatedLook.id) {
            setActiveLook(updatedLook);
        }
    };

    const handleDeleteLook = async (id: number) => {
        const updatedLooks = looks.filter(l => l.id !== id);
        setLooks(updatedLooks);
        await saveAllData(models, updatedLooks, lookboards);
        setView('lookbook');
        setActiveLook(null);
    };

    // --- Lookboards Management ---
    const handleUpdateLookboards = async (boards: Lookboard[]) => {
        setLookboards(boards);
        await saveAllData(models, looks, boards);
    };

    const selectedModel = models.find(m => m.id === selectedModelId);

    // --- Data Management ---
    const handleMigrateData = async () => {
        if (!user) {
            showToast('You must be logged in to sync data.', 'error');
            return;
        }
    
        const localLooks = await db.getLooks();
        const localLookboards = await db.getLookboards();
    
        if (localLooks.length === 0 && localLookboards.length === 0) {
            showToast('No local data found to sync.', 'success');
            return;
        }
    
        const serverLooks = looks;
        const serverLookboards = lookboards;
    
        const combinedLooksMap = new Map<number, Look>();
        serverLooks.forEach(look => combinedLooksMap.set(look.id, look));
        localLooks.forEach(look => combinedLooksMap.set(look.id, look));
        const mergedLooks = Array.from(combinedLooksMap.values());
    
        const combinedLookboardsMap = new Map<number, Lookboard>();
        serverLookboards.forEach(board => combinedLookboardsMap.set(board.id, board));
        localLookboards.forEach(board => combinedLookboardsMap.set(board.id, board));
        const mergedLookboards = Array.from(combinedLookboardsMap.values());
        
        const newLooksCount = mergedLooks.length - serverLooks.length;
        const newBoardsCount = mergedLookboards.length - serverLookboards.length;
        
        if (newLooksCount <= 0 && newBoardsCount <= 0) {
            showToast('Local data is already in sync. Clearing local cache.', 'success');
            await db.clearLooks();
            await db.clearLookboards();
            return;
        }
    
        if (window.confirm(`This will merge your ${localLooks.length} local look(s) and ${localLookboards.length} local board(s) with your cloud account. Continue?`)) {
            setIsMigrating(true);
            try {
                await saveAllData(models, mergedLooks, mergedLookboards);
                showToast('Data successfully synced to your account!', 'success');
                
                await db.clearLooks();
                await db.clearLookboards();
                
                await loadData();
            } catch (error) {
                console.error('Failed to migrate data:', error);
                showToast('Failed to sync data to the cloud.', 'error');
            } finally {
                setIsMigrating(false);
            }
        }
    };
    
    const handleExportData = async () => {
        try {
            const dataToExport = {
                models: await db.getModels(),
                looks: looks,
                lookboards: lookboards,
            };
            const jsonString = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ounass-studio-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Data exported successfully!', 'success');
        } catch (error) {
            console.error('Failed to export data:', error);
            showToast('Failed to export data.', 'error');
        }
    };

    const handleImportData = () => {
        if (!user) {
            showToast('You must be logged in to import data.', 'error');
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                setIsImporting(true);
                try {
                    const importedData = JSON.parse(event.target?.result as string);
                    if (importedData.models && importedData.looks && importedData.lookboards) {
                        
                        const existingModels = await db.getModels();
                        const combinedModelsMap = new Map<number, Model>();
                        existingModels.forEach(model => combinedModelsMap.set(model.id, model));
                        importedData.models.forEach((model: Model) => combinedModelsMap.set(model.id, model));
                        const mergedModels = Array.from(combinedModelsMap.values());

                        const existingLooks = looks;
                        const combinedLooksMap = new Map<number, Look>();
                        existingLooks.forEach(look => combinedLooksMap.set(look.id, look));
                        importedData.looks.forEach((look: Look) => combinedLooksMap.set(look.id, look));
                        const mergedLooks = Array.from(combinedLooksMap.values());

                        const existingLookboards = lookboards;
                        const combinedLookboardsMap = new Map<number, Lookboard>();
                        existingLookboards.forEach(board => combinedLookboardsMap.set(board.id, board));
                        importedData.lookboards.forEach((board: Lookboard) => combinedLookboardsMap.set(board.id, board));
                        const mergedLookboards = Array.from(combinedLookboardsMap.values());

                        await saveAllData(mergedModels, mergedLooks, mergedLookboards);
                        
                        await loadData();
                        showToast('Data successfully merged and imported!', 'success');
                    } else {
                        throw new Error('Invalid backup file format. Expected keys: models, looks, lookboards.');
                    }
                } catch (error) {
                    console.error('Failed to import data:', error);
                    showToast(error instanceof Error ? error.message : 'Failed to import data.', 'error');
                } finally {
                    setIsImporting(false);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleClearData = async () => {
        if (!user) {
             showToast('You must be logged in to clear data.', 'error');
            return;
        }
        if (window.confirm('Are you sure you want to delete ALL your data (local models, and all cloud looks/boards)? This action cannot be undone.')) {
            try {
                await db.clearModels();
                await saveAllData([], [], []);
                await loadData();
                showToast('All data has been cleared.', 'success');
            } catch (error) {
                console.error('Failed to clear data:', error);
                showToast('Failed to clear data.', 'error');
            }
        }
    };


    // --- UI Rendering ---
    const renderHeader = () => (
        <header className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-40">
            <h1 className="text-2xl font-bold">Ounass Look Creator</h1>
            <div className="flex items-center gap-4">
                <nav className="flex gap-4">
                    <Button variant={view === 'creator' ? 'primary' : 'secondary'} onClick={() => setView('creator')}>Create</Button>
                    <Button variant={['lookbook', 'look-detail', 'edit-look', 'lifestyle-shoot', 'video-creation'].includes(view) ? 'primary' : 'secondary'} onClick={handleViewLookbook}>Lookbook ({looks.length})</Button>
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
                     <DropdownItem onClick={handleMigrateData} disabled={isMigrating}>
                        {isMigrating ? <Spinner/> : <CloudUploadIcon />} {isMigrating ? 'Syncing...' : 'Sync Local Data to Cloud'}
                    </DropdownItem>
                    <DropdownItem onClick={handleExportData}>
                        <DownloadIcon /> Export All Data
                    </DropdownItem>
                    <DropdownItem onClick={handleImportData} disabled={isImporting}>
                        {isImporting ? <Spinner /> : <UploadIcon />} {isImporting ? 'Importing...' : 'Import Data'}
                    </DropdownItem>
                    <DropdownItem onClick={handleClearData} className="text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50">
                        <TrashIcon /> Clear All Data
                    </DropdownItem>
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
        
        if (isImporting) {
             return <div className="flex-grow flex items-center justify-center"><Spinner/> <span className="ml-2">Importing data... This may take a moment.</span></div>;
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
                                    <Button variant="primary" onClick={handleSaveLook} className="py-3 px-6 text-lg">
                                        <SaveIcon /> Add to Lookbook
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
                    onVideoCreation={() => setView('video-creation')}
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
             case 'video-creation':
                 return activeLook ? <div className="p-6"><VideoCreationPage
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
            <FullscreenImageViewer
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                src={imageModalUrl}
                alt="Model Image"
            />
        </div>
    );
};

export default CreatorStudio;