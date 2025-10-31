import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Spinner } from './common';

interface CreateLookboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, note?: string) => Promise<void>;
  isSubmitting: boolean;
}

const CreateLookboardModal: React.FC<CreateLookboardModalProps> = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
        setTitle('');
        setNote('');
        setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      setError(null);
      try {
        await onSubmit(title.trim(), note.trim());
        // Parent will close modal on success
      } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to create board. Please try again.");
      }
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={() => !isSubmitting && onClose()} title="Create a Shareable Board">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Board Title*</label>
            <Input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Autumn Collection for Ms. Smith"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Personal Note (Optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="e.g., Here are the looks we discussed. Let me know your thoughts!"
              className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-white text-zinc-900 placeholder-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 dark:placeholder-zinc-500"
              disabled={isSubmitting}
            />
          </div>
        </div>
        
        {error && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200 rounded-md text-sm">
                <p><span className="font-bold">Error:</span> {error}</p>
            </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!title.trim() || isSubmitting}>
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Creating...' : 'Create Board'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateLookboardModal;