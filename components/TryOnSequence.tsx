import React from 'react';
import { TryOnStep } from '../types';
import { Spinner } from './common';
import { RefreshIcon } from './Icons';

interface TryOnSequenceProps {
  steps: TryOnStep[];
  isGenerating: boolean;
  onRegenerateStep: (stepIndex: number) => void;
}

const TryOnSequence: React.FC<TryOnSequenceProps> = ({ steps, isGenerating, onRegenerateStep }) => {
  return (
    <div className="space-y-6">
      {steps.map((step, index) => (
        <div key={index} className="relative border p-4 rounded-lg bg-white dark:bg-zinc-900 shadow-sm border-zinc-200 dark:border-zinc-800">
          
          { (step.status === 'completed' || step.status === 'failed') &&
            <button 
              onClick={() => onRegenerateStep(index)}
              disabled={isGenerating}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-800 disabled:text-zinc-300 disabled:cursor-not-allowed transition-colors p-1 bg-white/50 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-full backdrop-blur-sm"
              aria-label="Regenerate this step"
            >
              <RefreshIcon />
            </button>
          }

          <h3 className="font-bold text-lg mb-4 text-center">
            Step {index + 1}: <span className="font-normal">{step.sku.name}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            {/* Input Image */}
            <div className="text-center">
              <h4 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2">Model</h4>
              <div className="aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 rounded-md ring-1 ring-zinc-200 dark:ring-zinc-700 overflow-hidden">
                {step.inputImage ? (
                  <img src={step.inputImage} alt="Input model" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400">Waiting...</div>
                )}
              </div>
            </div>

            {/* Product Image */}
            <div className="text-center">
              <h4 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2">Product</h4>
               <div className="aspect-[3/4] bg-white dark:bg-zinc-800 rounded-md ring-1 ring-zinc-200 dark:ring-zinc-700 overflow-hidden">
                <img src={step.sku.media[0]?.src} alt={step.sku.name} className="w-full h-full object-contain" />
              </div>
            </div>

            {/* Output Image */}
            <div className="text-center">
              <h4 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2">Result</h4>
              <div className="relative w-full aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 rounded-md ring-1 ring-zinc-200 dark:ring-zinc-700 overflow-hidden">
                {step.status === 'generating' && <div className="absolute inset-0 flex items-center justify-center"><Spinner /></div>}
                {step.status === 'completed' && <img src={step.outputImage} alt={`Try-on step ${index + 1}`} className="w-full h-full object-cover" />}
                {step.status === 'failed' && <div className="absolute inset-0 flex items-center justify-center text-red-500 font-semibold bg-red-50 dark:bg-red-900/40">Failed</div>}
                {step.status === 'pending' && <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800"></div>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TryOnSequence;