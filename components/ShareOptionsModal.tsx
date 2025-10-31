import React, { useState } from 'react';
import { Lookboard } from '../types';
import { Modal, Button, Input, Spinner } from './common';
import { CheckCircleIcon, ShareIcon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface ShareOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: Lookboard;
}

const ShareOptionsModal: React.FC<ShareOptionsModalProps> = ({ isOpen, onClose, board }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [view, setView] = useState<'options' | 'link'>('options');
  
  const { user } = useAuth();
  const { showToast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
        setIsCopied(false);
        setGeneratedUrl('');
        setView('options');
    }
  }, [isOpen]);
  
  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleGetGeneralLink = () => {
    const url = `${window.location.origin}/board/public/${board.publicId}`;
    setGeneratedUrl(url);
    handleCopy(url);
    setView('link');
  };

  const handleCreatePersonalizedLink = async () => {
    if (!user) {
        showToast("You must be logged in to share.", "error");
        return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            action: 'share-board',
            publicId: board.publicId, 
            sharedBy: user.email 
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to create share link.');
      }
      const { instanceId } = await response.json();
      const url = `${window.location.origin}/board/instance/${instanceId}`;
      setGeneratedUrl(url);
      handleCopy(url);
      setView('link');
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Could not generate link.", "error");
    } finally {
      setIsGenerating(false);
    }
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Options">
        {view === 'options' ? (
            <div>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">Choose how you want to share this board.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                     <div
                        className="flex-1 p-4 border-2 rounded-lg cursor-pointer hover:border-zinc-800 dark:hover:border-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        onClick={handleGetGeneralLink}
                    >
                        <h3 className="font-bold">Get General Link (View-Only)</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            A single public link for bulk sharing. Clients can view the looks but cannot leave feedback. Ideal for sending to many clients at once.
                        </p>
                    </div>
                     <div
                        className="flex-1 p-4 border-2 rounded-lg cursor-pointer hover:border-zinc-800 dark:hover:border-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        onClick={handleCreatePersonalizedLink}
                    >
                        <h3 className="font-bold">Create Personalized Link (For Feedback)</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            Generate a unique, private link for a specific client. This link allows them to like, dislike, and comment on looks.
                        </p>
                    </div>
                </div>
                 {isGenerating && (
                    <div className="text-center mt-4">
                        <Spinner />
                        <p className="text-sm text-zinc-500">Creating personalized link...</p>
                    </div>
                )}
            </div>
        ) : (
            <div>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">Your shareable link has been copied to your clipboard.</p>
                <div className="flex gap-2">
                    <Input 
                        type="text"
                        value={generatedUrl}
                        readOnly
                        className="bg-zinc-100 dark:bg-zinc-800"
                    />
                    <Button onClick={() => handleCopy(generatedUrl)}>
                        {isCopied ? <CheckCircleIcon /> : <ShareIcon />}
                        {isCopied ? 'Copied!' : 'Copy Link'}
                    </Button>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setView('options')}>Back</Button>
                    <Button variant="primary" onClick={onClose}>Done</Button>
                </div>
            </div>
        )}
    </Modal>
  );
};

export default ShareOptionsModal;