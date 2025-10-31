import React, { useState } from 'react';
import { Modal, Button, Spinner } from './common';

interface SaveLookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (visibility: 'public' | 'private') => Promise<void>;
  isSubmitting: boolean;
}

const SaveLookModal: React.FC<SaveLookModalProps> = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(visibility);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !isSubmitting && onClose()} title="Save Look">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <p className="text-zinc-600 dark:text-zinc-400">How would you like to save this look?</p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div
              className={`flex-1 p-4 border-2 rounded-lg cursor-pointer ${visibility === 'private' ? 'border-zinc-800 dark:border-zinc-300 bg-zinc-100 dark:bg-zinc-800' : 'border-zinc-300 dark:border-zinc-700'}`}
              onClick={() => setVisibility('private')}
            >
              <h3 className="font-bold">Private</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Only you will be able to see and edit this look.</p>
            </div>
            <div
              className={`flex-1 p-4 border-2 rounded-lg cursor-pointer ${visibility === 'public' ? 'border-zinc-800 dark:border-zinc-300 bg-zinc-100 dark:bg-zinc-800' : 'border-zinc-300 dark:border-zinc-700'}`}
              onClick={() => setVisibility('public')}
            >
              <h3 className="font-bold">Public</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Other users will see this look in their Lookbook and can add variations.</p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Saving...' : 'Save Look'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default SaveLookModal;
