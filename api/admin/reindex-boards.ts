import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Lookboard } from '../types';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }
    
    // In a real app, you would add authentication here to ensure only admins can access this.
    
    try {
        const userKeys = await kv.keys('user:*');
        if (userKeys.length === 0) {
            return response.status(200).json({ message: 'No users found to process.' });
        }
        
        const lookboardKeys = userKeys.map(key => key.replace('user:', 'lookboards:'));
        const allUsersBoardsData: (Lookboard[] | null)[] = lookboardKeys.length > 0 ? await kv.mget(...lookboardKeys) : [];

        const publicBoardsMap = await kv.hgetall<Record<string, Lookboard>>('public_lookboards_hash');
        
        const allBoards = new Map<number, Lookboard>();

        // Add private boards
        allUsersBoardsData.forEach(userBoards => {
            if (userBoards && Array.isArray(userBoards)) {
                userBoards.forEach(board => {
                    if (board && board.id) allBoards.set(board.id, board);
                });
            }
        });

        // Add public boards, overwriting any duplicates
        if (publicBoardsMap) {
            // FIX: Defensively handle both string and object data types from KV,
            // which can occur depending on how the data was stored or if the KV
            // client auto-parses the JSON. This prevents runtime errors.
            Object.values(publicBoardsMap).forEach(boardData => {
                if (!boardData) return;

                let board: Lookboard;
                if (typeof boardData === 'string') {
                    try {
                        board = JSON.parse(boardData);
                    } catch (e) {
                        console.error('Failed to parse public lookboard data string:', boardData, e);
                        return; // Skip corrupted data
                    }
                } else if (typeof boardData === 'object' && boardData !== null) {
                    board = boardData as Lookboard;
                } else {
                    return; // Skip unexpected data types
                }

                if (board && typeof board.id === 'number') {
                    allBoards.set(board.id, board);
                }
            });
        }

        if (allBoards.size === 0) {
             return response.status(200).json({ message: 'No lookboards found to index.' });
        }

        const publicIdIndexMap: Record<string, string> = {};
        allBoards.forEach(board => {
             if (board.publicId) {
                publicIdIndexMap[`publicId:${board.publicId}`] = JSON.stringify(board);
            }
        });

        if (Object.keys(publicIdIndexMap).length > 0) {
            await kv.mset(publicIdIndexMap);
        }

        return response.status(200).json({ message: `Successfully indexed ${Object.keys(publicIdIndexMap).length} lookboard share links.` });

    } catch (error) {
        console.error('Error during lookboard re-indexing:', error);
        return response.status(500).json({ message: 'Internal Server Error during re-indexing.' });
    }
}