import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { XIcon } from './Icons';

interface FullscreenImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt: string;
}

const FullscreenImageViewer: React.FC<FullscreenImageViewerProps> = ({ isOpen, onClose, src, alt }) => {
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      document.body.classList.add('overflow-hidden');
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.classList.remove('overflow-hidden');
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const isVideo = src && (src.startsWith('data:video/') || src.endsWith('.mp4'));

  // A simple fade-in animation for a smoother appearance.
  const animationStyle = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
  `;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 sm:p-8 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <style>{animationStyle}</style>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white bg-black/50 rounded-full hover:bg-black/70 transition-colors z-[51]"
        aria-label="Close image viewer"
      >
        <XIcon className="h-6 w-6" />
      </button>
      {/* Stop propagation so clicking the image itself doesn't close the modal */}
      <div className="relative w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {isVideo ? (
            <video
              src={src}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              controls
              autoPlay
              muted
              loop
            />
        ) : (
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
        )}
      </div>
    </div>,
    document.body
  );
};

export default FullscreenImageViewer;