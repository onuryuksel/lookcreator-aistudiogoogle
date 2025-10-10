import React from 'react';
import { Model } from '../types';
import { Card } from './common';
import { PlusIcon, TrashIcon } from './Icons';

interface ModelPanelProps {
    models: Model[];
    selectedModelId: number | null;
    onSelectModel: (id: number) => void;
    onDeleteModel: (id: number) => void;
    onOpenCreateModelModal: () => void;
    onOpenImageModal: (imageUrl: string) => void;
}

const ModelPanel: React.FC<ModelPanelProps> = ({
    models,
    selectedModelId,
    onSelectModel,
    onDeleteModel,
    onOpenCreateModelModal,
    onOpenImageModal,
}) => {
    return (
        <Card className="flex-1 flex flex-col">
            <h2 className="text-xl font-bold mb-4">Models</h2>
            <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-2">
                {models.map(model => (
                    <div
                        key={model.id}
                        onClick={() => onSelectModel(model.id!)}
                        className={`flex items-center p-2 rounded-lg cursor-pointer transition-all border-2 ${selectedModelId === model.id ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-800 dark:border-zinc-300' : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    >
                        <div className="w-16 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-md mr-4 flex-shrink-0 overflow-hidden" >
                            <img
                                src={model.imageUrl}
                                alt={model.name}
                                onClick={(e) => { e.stopPropagation(); onOpenImageModal(model.imageUrl); }}
                                className="w-full h-full object-contain cursor-pointer"
                            />
                        </div>
                        <div className="flex-grow">
                            <p className="font-semibold">{model.name}</p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">{model.ageAppearance}, {model.height}</p>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDeleteModel(model.id!); }}
                            className="ml-2 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-full transition-colors"
                            aria-label={`Delete ${model.name}`}
                        >
                            <TrashIcon />
                        </button>
                    </div>
                ))}
            </div>
            <div className="mt-4 space-y-2">
                <button onClick={onOpenCreateModelModal} className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
                    <PlusIcon/>
                    <span>Create New Model</span>
                </button>
            </div>
        </Card>
    );
};

export default ModelPanel;