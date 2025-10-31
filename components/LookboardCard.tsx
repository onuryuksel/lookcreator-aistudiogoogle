import React, { useState } from 'react';
import { Look } from '../types';

interface LookboardCardProps {
  look: Look;
  onImageClick?: () => void;
}

const LookboardCard: React.FC<LookboardCardProps> = ({ look, onImageClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > naturalHeight) {
      setIsLandscape(true);
    }
    setIsLoaded(true);
  };

  return (
    <div
      className={`${isLandscape ? 'col-span-2' : ''}`}
      onClick={onImageClick}
    >
      <div className="relative">
        {/* Placeholder with a common aspect ratio to reserve space and prevent layout jank */}
        {!isLoaded && <div className="pt-[125%] bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />}
        <img
          src={look.finalImage}
          alt="Look"
          className={`w-full h-auto object-cover rounded-lg transition-opacity duration-300 cursor-pointer ${isLoaded ? 'static opacity-100' : 'absolute inset-0 opacity-0'}`}
          onLoad={handleImageLoad}
        />
      </div>
    </div>
  );
};

export default LookboardCard;
