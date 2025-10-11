import React, { useState, useEffect } from 'react';
import { Lookboard } from '../types';
import { Modal, Button, Input } from './common';
import { CheckCircleIcon, ShareIcon } from './Icons';

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: Lookboard;
}

const ShareLinkModal: React.FC<ShareLinkModalProps> = ({ isOpen, onClose, board }) => {
  const [isCopied, setIsCopied] = useState(false);
  const shareUrl = `${window.location.origin}/board/${board.publicId}`;

  useEffect(() => {
    if (isOpen) {
        setIsCopied(false);
    }
  }, [isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Your Board is Ready to Share!">
      <p className="text-zinc-600 dark:text-zinc-400 mb-4">
        Share this private link with your client. They can view the looks and leave feedback.
      </p>
      <div className="flex gap-2">
        <Input 
          type="text"
          value={shareUrl}
          readOnly
          className="bg-zinc-100 dark:bg-zinc-800"
        />
        <Button onClick={handleCopy}>
          {isCopied ? <CheckCircleIcon /> : <ShareIcon />}
          {isCopied ? 'Copied!' : 'Copy Link'}
        </Button>
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
};

export default ShareLinkModal;
