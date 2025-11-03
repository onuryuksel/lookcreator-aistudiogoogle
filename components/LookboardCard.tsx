import React, { useState } from 'react';
import { Look } from '../types';
import { TrashIcon, ThumbsUpIcon, ThumbsDownIcon, MessageSquareIcon } from './Icons';

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
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
  isDragging?: boolean;
  // Feedback props
  isFeedbackEnabled?: boolean;
  feedback?: 'liked' | 'disliked';
  commentCount?: number;
  onLike?: () => void;
  onDislike?: () => void;
  onComment?: () => void;
}

const LookboardCard: React.FC<LookboardCardProps> = ({ 
  look, 
  onImageClick,
  isEditing,
  onDelete,
  isDragging,
  isFeedbackEnabled,
  feedback,
  commentCount = 0,
  onLike,
  onDislike,
  onComment,
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
  
  const handleVideoLoad = (event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const { videoWidth, videoHeight } = event.currentTarget;
    if (videoWidth > videoHeight) {
        setIsLandscape(true);
    }
    setIsLoaded(true);
  };

  const isVideo = look.finalImage.startsWith('data:video/') || look.finalImage.endsWith('.mp4');

  return (
    <div
      className={`relative group transition-opacity ${isLandscape ? 'col-span-2' : ''} ${isDragging ? 'opacity-40' : ''}`}
      onClick={!isEditing ? onImageClick : undefined}
      {...dragProps}
    >
      <div className={`relative ${isEditing ? 'cursor-grab' : 'cursor-pointer'}`}>
        {!isLoaded && <div className="pt-[125%] bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />}
        
        {isVideo ? (
            <video 
              src={look.finalImage} 
              className={`w-full h-auto object-cover rounded-lg transition-opacity duration-300 ${isLoaded ? 'static opacity-100' : 'absolute inset-0 opacity-0'}`}
              onLoadedMetadata={handleVideoLoad}
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

        {isFeedbackEnabled && (
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-end items-center gap-2">
                <button 
                    onClick={(e) => { e.stopPropagation(); onLike?.(); }} 
                    className={`p-1.5 rounded-full transition-colors ${feedback === 'liked' ? 'bg-blue-500 text-white' : 'bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm'}`}
                    aria-label="Like"
                >
                    <ThumbsUpIcon className="h-4 w-4" />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDislike?.(); }} 
                    className={`p-1.5 rounded-full transition-colors ${feedback === 'disliked' ? 'bg-red-500 text-white' : 'bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm'}`}
                    aria-label="Dislike"
                >
                    <ThumbsDownIcon className="h-4 w-4" />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onComment?.(); }} 
                    className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm transition-colors flex items-center gap-1.5"
                    aria-label="Comment"
                >
                    <MessageSquareIcon className="h-4 w-4" />
                    {commentCount > 0 && <span className="text-xs font-bold">{commentCount}</span>}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default LookboardCard;
