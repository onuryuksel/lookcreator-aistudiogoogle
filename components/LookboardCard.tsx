import React, { useState } from 'react';
import { Look } from '../types';
import { TrashIcon } from './Icons';

interface LookboardCardProps {
  look: Look;
  onImageClick?: () => void;
  // New props for editing
  isEditing?: boolean;
  onDelete?: (lookId: number) => void;
  // Drag props
  draggable?: boolean;
  onDragStart?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onDragEnter?: React.DragEventHandler<HTMLDivElement>;
  onDragLeave?: React.DragEventHandler<HTMLDivElement>;
  // FIX: Add onDragEnd to the component's props to allow passing the event handler for drag-and-drop sorting.
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
}

const LookboardCard: React.FC<LookboardCardProps> = ({ 
  look, 
  onImageClick,
  isEditing,
  onDelete,
  ...dragProps
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > naturalHeight) {
      setIsLandscape(true);
    }
    setIsLoaded(true);
  };

  const isVideo = look.finalImage.startsWith('data:video/') || look.finalImage.endsWith('.mp4');

  return (
    <div
      className={`relative group ${isLandscape && !isEditing ? 'col-span-2' : ''}`}
      onClick={!isEditing ? onImageClick : undefined}
      {...dragProps}
    >
      <div className={`relative ${isEditing ? 'cursor-grab' : 'cursor-pointer'}`}>
        {!isLoaded && <div className="pt-[125%] bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />}
        
        {isVideo ? (
            <video 
              src={look.finalImage} 
              className={`w-full h-auto object-cover rounded-lg transition-opacity duration-300 ${isLoaded ? 'static opacity-100' : 'absolute inset-0 opacity-0'}`}
              onLoadedData={() => setIsLoaded(true)}
              muted
              autoPlay
              loop
              playsInline
            />
        ) : (
          <img
            src={look.finalImage}
            alt="Look"
            className={`w-full h-auto object-cover rounded-lg transition-opacity duration-300 ${isLoaded ? 'static opacity-100' : 'absolute inset-0 opacity-0'}`}
            onLoad={handleImageLoad}
          />
        )}
        
        {isEditing && (
          <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onDelete && onDelete(look.id)}
              className="text-white bg-red-600/80 hover:bg-red-600 rounded-full p-2"
              aria-label="Remove look"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LookboardCard;