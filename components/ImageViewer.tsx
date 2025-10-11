import React, { useState } from 'react';
import { Modal, Spinner } from './common';
import { DownloadIcon, ZoomInIcon } from './Icons';

interface ImageViewerProps {
  src: string;
  alt: string;
  isLoading?: boolean;
  loadingText?: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, isLoading = false, loadingText }) => {
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `ounass-ai-studio-${alt.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative w-full h-full bg-zinc-100 dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
      <img src={src} alt={alt} className="w-full h-full object-contain" />

      {/* Icons Overlay */}
      <div className="absolute top-4 right-4 flex gap-2">
        <button onClick={() => setIsZoomModalOpen(true)} className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm" aria-label="Zoom in on image">
          <ZoomInIcon />
        </button>
        <button onClick={handleDownload} className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm" aria-label="Download image">
          <DownloadIcon />
        </button>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center backdrop-blur-sm p-4 text-center">
          <Spinner />
          {loadingText && <p className="text-white mt-2 font-semibold">{loadingText}</p>}
        </div>
      )}

      {/* Zoom Modal */}
      <Modal isOpen={isZoomModalOpen} onClose={() => setIsZoomModalOpen(false)} title="Image Preview">
        <img src={src} alt={alt} className="max-w-full max-h-[80vh] mx-auto" />
      </Modal>
    </div>
  );
};

export default ImageViewer;