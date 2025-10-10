import React from 'react';
import { Model } from '../types';
import { Card, Input, Button, Spinner } from './common';

interface CreatorPanelProps {
    selectedModel: Model | undefined;
    skuInput: string;
    onSkuInputChange: (value: string) => void;
    onAddSku: () => void;
    isGenerating: boolean;
}

const CreatorPanel: React.FC<CreatorPanelProps> = ({
    selectedModel,
    skuInput,
    onSkuInputChange,
    onAddSku,
    isGenerating
}) => {
    return (
        <Card>
            <h2 className="text-xl font-bold mb-2">Creator Studio</h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                {selectedModel ? `Add products by SKU to create a new look for ${selectedModel.name}.` : 'Select or create a model to begin.'}
            </p>
            <div className="flex gap-2">
                <Input
                    type="text"
                    value={skuInput}
                    onChange={(e) => onSkuInputChange(e.target.value)}
                    placeholder="Enter one or more product SKUs, separated by commas"
                    disabled={isGenerating || !selectedModel}
                />
                <Button
                    onClick={onAddSku}
                    disabled={isGenerating || !skuInput || !selectedModel}
                >
                    {isGenerating ? <Spinner /> : 'Create Look'}
                </Button>
            </div>
        </Card>
    );
};

export default CreatorPanel;
