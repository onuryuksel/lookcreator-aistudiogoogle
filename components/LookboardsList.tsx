import React from 'react';
import { Lookboard } from '../types';
import { Card, Button } from './common';
import { ShareIcon, TrashIcon } from './Icons';

interface LookboardsListProps {
  lookboards: Lookboard[];
  onDelete: (id: number) => void;
}

const LookboardsList: React.FC<LookboardsListProps> = ({ lookboards, onDelete }) => {
  
  const handleCopyLink = (publicId: string) => {
    const url = `${window.location.origin}/board/${publicId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied to clipboard!');
    }, (err) => {
      console.error('Could not copy text: ', err);
      alert('Failed to copy link.');
    });
  };

  if (lookboards.length === 0) {
    return (
      <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
        <p className="text-lg text-zinc-600 dark:text-zinc-400">No shared boards yet.</p>
        <p className="text-zinc-500 dark:text-zinc-500 mt-2">Select looks from the "My Looks" tab and click "Share Looks" to create your first board.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {lookboards.map(board => (
        <Card key={board.id} className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg">{board.title}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {board.lookIds.length} looks &bull; Created on {new Date(board.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => handleCopyLink(board.publicId)}>
              <ShareIcon /> Copy Link
            </Button>
            <Button 
                variant="secondary" 
                onClick={() => {
                    if (window.confirm(`Are you sure you want to delete the board "${board.title}"?`)) {
                        onDelete(board.id!);
                    }
                }} 
                className="hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400"
            >
              <TrashIcon />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default LookboardsList;
