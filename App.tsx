
import React, { useState, useEffect } from 'react';
import CreatorStudio from './pages/CreatorStudio';
import ViewLookboardPage from './pages/ViewLookboardPage';
import { Lookboard, Look } from './types';
import * as db from './services/dbService';
import { Spinner } from './components/common';

const App: React.FC = () => {
    const [page, setPage] = useState<string>('/');
    const [board, setBoard] = useState<Lookboard | null>(null);
    const [looks, setLooks] = useState<Look[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const path = window.location.pathname;
        if (path.startsWith('/board/')) {
            const publicId = path.split('/board/')[1];
            const loadBoard = async () => {
                try {
                    const allBoards = await db.getLookboards();
                    const targetBoard = allBoards.find(b => b.publicId === publicId);
                    if (targetBoard) {
                        const allLooks = await db.getLooks();
                        const boardLooks = allLooks.filter(l => targetBoard.lookIds.includes(l.id));
                        setBoard(targetBoard);
                        setLooks(boardLooks);
                        setPage('board');
                    } else {
                        setPage('notfound');
                    }
                } catch (error) {
                    console.error("Failed to load board:", error);
                    setPage('notfound');
                } finally {
                    setLoading(false);
                }
            };
            loadBoard();
        } else {
            setPage('creator');
            setLoading(false);
        }
    }, []);

    const handleUpdateBoard = async (updatedBoard: Lookboard) => {
        const allBoards = await db.getLookboards();
        const boardIndex = allBoards.findIndex(b => b.id === updatedBoard.id);
        if (boardIndex > -1) {
            allBoards[boardIndex] = updatedBoard;
            await db.saveLookboards(allBoards);
            setBoard(updatedBoard);
        }
    };

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500">
                <Spinner />
                <span className="ml-2">Loading...</span>
            </div>
        );
    }

    switch (page) {
        case 'creator':
            return <CreatorStudio />;
        case 'board':
            return board ? <ViewLookboardPage lookboard={board} looks={looks} onUpdate={handleUpdateBoard} /> : <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500 text-lg">404 | Lookboard Not Found</div>;
        case 'notfound':
             return <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500 text-lg">404 | Lookboard Not Found</div>;
        default:
            return <CreatorStudio />;
    }
};

export default App;
