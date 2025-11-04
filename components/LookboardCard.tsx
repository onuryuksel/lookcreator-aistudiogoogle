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
  // FIX: Add onDragEnd to the component's props to allow passing the event handler for drag-and-drop sorting.
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
  // New feedback props
  isFeedbackEnabled?: boolean;
  feedback?: 'liked' | 'disliked';
  onFeedback?: (feedback: 'liked' | 'disliked') => void;
  onOpenComments?: () => void;
  commentCount?: number;
}

const LookboardCard: React.FC<LookboardCardProps> = ({ 
  look, 
  onImageClick,
  isEditing,
  onDelete,
  isFeedbackEnabled,
  feedback,
  onFeedback,
  onOpenComments,
  commentCount,
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
  
  const handleFeedbackClick = (e: React.MouseEvent, feedbackType: 'liked' | 'disliked') => {
    e.stopPropagation();
    onFeedback?.(feedbackType);
  };
  
  const handleCommentsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenComments?.();
  };

  return (
    <div
      className={`relative group ${isLandscape && !isEditing ? 'col-span-2' : ''}`}
      {...dragProps}
    >
      <div 
        onClick={onImageClick}
        className={`relative ${isEditing ? 'cursor-grab' : 'cursor-pointer'}`}
      >
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
              onClick={(e) => {
                e.stopPropagation();
                onDelete && onDelete(look.id)
              }}
              className="text-white bg-red-600/80 hover:bg-red-600 rounded-full p-2"
              aria-label="Remove look"
            >
              <TrashIcon />
            </button>
          </div>
        )}

        {isFeedbackEnabled && (
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg flex justify-center items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={(e) => handleFeedbackClick(e, 'liked')} className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full text-white transition-colors" aria-label="Like look">
              <ThumbsUpIcon className={`h-5 w-5 transition-colors ${feedback === 'liked' ? 'fill-current text-green-400' : ''}`} />
            </button>
            <button onClick={(e) => handleFeedbackClick(e, 'disliked')} className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full text-white transition-colors" aria-label="Dislike look">
              <ThumbsDownIcon className={`h-5 w-5 transition-colors ${feedback === 'disliked' ? 'fill-current text-red-400' : ''}`} />
            </button>
            <button onClick={handleCommentsClick} className="relative p-2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full text-white transition-colors" aria-label="View comments">
              <MessageSquareIcon className="h-5 w-5" />
              {commentCount && commentCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-zinc-800 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-stone-50 dark:ring-zinc-950">
                  {commentCount}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LookboardCard;