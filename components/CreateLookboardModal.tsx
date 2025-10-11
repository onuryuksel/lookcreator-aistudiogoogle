import React, { useState } from 'react';
import { Modal, Button, Input } from './common';

interface CreateLookboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, note?: string) => void;
}

const CreateLookboardModal: React.FC<CreateLookboardModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit(title.trim(), note.trim());
      // Reset fields for next time
      setTitle('');
      setNote('');
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create a Shareable Board">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Board Title*</label>
            <Input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Autumn Collection for Ms. Smith"
              required
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
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!title.trim()}>Create Board</Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateLookboardModal;
