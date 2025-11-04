import React, { useState, useMemo } from 'react';
import { Lookboard, SharedLookboardInstance, Look, LookOverrides } from '../types';
import { Card, Button } from './common';
import { EditIcon, ShareIcon, TrashIcon, CopyIcon, ChevronDownIcon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const BoardItem: React.FC<{
  board: Lookboard;
  instances: SharedLookboardInstance[];
  allUserLooks: Look[];
  lookOverrides: LookOverrides;
  onDelete: (id: number) => void;
  onShare: (board: Lookboard) => void;
  onEdit: (board: Lookboard) => void;
  onDuplicate: (publicId: string) => void;
  isSaving: boolean;
}> = ({ board, instances, allUserLooks, lookOverrides, onDelete, onShare, onEdit, onDuplicate, isSaving }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const isCreator = user?.email === board.createdBy;
    const [isLinksVisible, setIsLinksVisible] = useState(false);

    const boardLooks = useMemo(() => {
        const lookMap = new Map(allUserLooks.map(l => [l.id, l]));
        return board.lookIds
            .map(id => {
                const look = lookMap.get(id);
                if (!look) return null;
                const finalImage = lookOverrides[id]?.finalImage || look.finalImage;
                return { ...look, finalImage };
            })
            .filter((l): l is Look => !!l);
    }, [board.lookIds, allUserLooks, lookOverrides]);

    const MAX_THUMBNAILS = 5;
    const visibleLooks = boardLooks.slice(0, MAX_THUMBNAILS);
    const remainingLooksCount = boardLooks.length - visibleLooks.length;


    const handleCopy = (url: string, message: string) => {
        navigator.clipboard.writeText(url).then(() => {
            showToast(message, 'success');
        });
    };

    const generalLink = `${window.location.origin}/board/public/${board.publicId}`;

    return (
        <Card className="flex flex-col">
            <div className="flex justify-between items-start">
                <div className="flex-grow">
                    <h3 className="font-bold text-lg">{board.title}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {(board.lookIds || []).length} looks &bull; 
                        {board.createdByUsername ? ` Created by ${board.createdByUsername}` : ''} on {new Date(board.createdAt).toLocaleDateString()}
                    </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-4">
                    <Button variant="secondary" onClick={() => onDuplicate(board.publicId)} disabled={isSaving}>
                        <CopyIcon />
                        Duplicate
                    </Button>
                    <Button variant="secondary" onClick={() => onShare(board)} disabled={isSaving}>
                        <ShareIcon />
                        Share
                    </Button>
                    {isCreator && (
                        <>
                        <Button variant="secondary" onClick={() => onEdit(board)} disabled={isSaving}>
                            <EditIcon />
                            Edit
                        </Button>
                        <Button 
                            variant="secondary" 
                            onClick={() => {
                                if (window.confirm(`Are you sure you want to delete the board "${board.title}"?`)) {
                                    onDelete(board.id!);
                                }
                            }} 
                            className="hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400"
                            disabled={isSaving}
                        >
                            <TrashIcon />
                        </Button>
                        </>
                    )}
                </div>
            </div>

            {visibleLooks.length > 0 && (
                 <div className="mt-4">
                    <div className="flex -space-x-2">
                        {visibleLooks.map((look) => (
                            <div key={look.id} className="h-12 w-12 flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 rounded-full border-2 border-white dark:border-zinc-900 overflow-hidden">
                                <img
                                    src={look.finalImage}
                                    alt={`Look ${look.id}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                        {remainingLooksCount > 0 && (
                            <div className="h-12 w-12 flex-shrink-0 bg-zinc-200 dark:bg-zinc-700 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                                    +{remainingLooksCount}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {(board.visibility === 'public' || isCreator) && (
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <button onClick={() => setIsLinksVisible(!isLinksVisible)} className="w-full flex justify-between items-center text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                        <span>Show Shared Links ({1 + instances.length})</span>
                        <ChevronDownIcon className={`transform transition-transform ${isLinksVisible ? 'rotate-180' : ''}`} />
                    </button>
                    {isLinksVisible && (
                        <div className="mt-3 space-y-2 text-sm">
                            <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/40 rounded">
                                <div>
                                    <p className="font-semibold">General View-Only Link</p>
                                    <p className="text-xs text-zinc-500">{generalLink}</p>
                                </div>
                                <Button size="sm" variant="secondary" onClick={() => handleCopy(generalLink, 'General link copied!')}>Copy</Button>
                            </div>
                            {instances.map(instance => {
                                const instanceLink = `${window.location.origin}/board/instance/${instance.id}`;
                                const canViewLink = user?.email === instance.sharedBy;
                                return (
                                <div key={instance.id} className="flex justify-between items-center p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded">
                                    <div>
                                        <p className="font-semibold">
                                            Personalized Link for: <span className="text-zinc-800 dark:text-zinc-200">{instance.clientName || 'Unnamed Client'}</span>
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                            Shared by {instance.sharedByUsername} on {new Date(instance.createdAt).toLocaleDateString()}
                                        </p>
                                        {canViewLink && <p className="text-xs text-zinc-500 mt-1">{instanceLink}</p>}
                                    </div>
                                    {canViewLink && (
                                        <Button size="sm" variant="secondary" onClick={() => handleCopy(instanceLink, `Link for ${instance.clientName} copied!`)}>Copy</Button>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </Card>
    )
}

interface LookboardsListProps {
  lookboards: Lookboard[];
  sharedInstances: Record<string, SharedLookboardInstance[]>;
  allUserLooks: Look[];
  lookOverrides: LookOverrides;
  onDelete: (id: number) => void;
  onShare: (board: Lookboard) => void;
  onEdit: (board: Lookboard) => void;
  onDuplicate: (publicId: string) => void;
  isSaving: boolean;
}

const LookboardsList: React.FC<LookboardsListProps> = ({ lookboards, sharedInstances, allUserLooks, lookOverrides, onDelete, onShare, onEdit, onDuplicate, isSaving }) => {
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
          <BoardItem 
            key={board.id}
            board={board}
            instances={sharedInstances[board.publicId] || []}
            allUserLooks={allUserLooks}
            lookOverrides={lookOverrides}
            onDelete={onDelete}
            onShare={onShare}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            isSaving={isSaving}
          />
      ))}
    </div>
  );
};

export default LookboardsList;