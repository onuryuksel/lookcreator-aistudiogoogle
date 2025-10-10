import React, { useRef } from 'react';
import { Look } from '../types';
import { UploadIcon, DownloadIcon } from '../components/Icons';
import { Button } from '../components/common';

interface LookbookProps {
  looks: Look[];
  onLooksExport: () => void;
  onLooksImport: (file: File) => void;
  onSelectLook: (lookId: number) => void;
}

const Lookbook: React.FC<LookbookProps> = ({ looks, onLooksExport, onLooksImport, onSelectLook }) => {
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    importFileRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onLooksImport(file);
    }
    // Reset file input to allow importing the same file again
    if (importFileRef.current) {
        importFileRef.current.value = '';
    }
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">My Lookbook</h1>
        <div className="flex gap-2">
          <input
            type="file"
            ref={importFileRef}
            onChange={handleFileChange}
            accept="application/json"
            className="hidden"
          />
          <Button onClick={handleImportClick} variant="secondary">
            <UploadIcon /> Import
          </Button>
          <Button onClick={onLooksExport} variant="secondary" disabled={looks.length === 0}>
            <DownloadIcon /> Export
          </Button>
        </div>
      </div>
      {looks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-lg text-zinc-600 dark:text-zinc-400">Your lookbook is empty.</p>
          <p className="text-zinc-500 dark:text-zinc-500 mt-2">Go to the "Create" tab to start your first project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {looks.map((look) => (
             <div 
              key={look.id} 
              className="group aspect-[3/4] rounded-lg overflow-hidden cursor-pointer relative shadow-sm bg-zinc-100 dark:bg-zinc-800"
              onClick={() => onSelectLook(look.id!)}
            >
              <img src={look.finalImage} alt={`Look created on ${new Date(look.createdAt).toLocaleDateString()}`} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Lookbook;