
import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Look, Lookboard, LookOverrides } from '../types';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    // FIX: Use bracket notation to access 'method' property to bypass potential TypeScript type resolution issues in some environments.
    if (request['method'] === 'GET') {
        return await handleGet(request, response);
    }
    // FIX: Use bracket notation to access 'method' property to bypass potential TypeScript type resolution issues in some environments.
    if (request['method'] === 'POST') {
        return await handlePost(request, response);
    }
    return response.status(405).json({ message: 'Method Not Allowed' });
}

async function handleGet(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { email } = request.query;
        if (!email || typeof email !== 'string') {
            return response.status(400).json({ message: 'Email query parameter is required.' });
        }
        const emailLower = email.toLowerCase();

        const userLooksKey = `looks:${emailLower}`;
        const boardsKey = `lookboards:${emailLower}`;
        const overridesKey = `user_overrides:${emailLower}`;
        const publicLooksKey = 'public_looks_hash';
        const publicLookboardsKey = 'public_lookboards_hash';

        const [
            userLooks, 
            publicLooksMap, 
            userPrivateLookboards,
            publicLookboardsMap,
            overrides
        ] = await Promise.all([
            kv.get<Look[]>(userLooksKey),
            kv.hgetall(publicLooksKey),
            kv.get<Lookboard[]>(boardsKey),
            kv.hgetall(publicLookboardsKey),
            kv.get<LookOverrides>(overridesKey)
        ]);
        
        const combinedLooksMap = new Map<number, Look>();

        // Add all public looks first
        if (publicLooksMap) {
            // FIX: Defensively handle both string and object data types from KV,
            // which can occur depending on how the data was stored or if the KV
            // client auto-parses the JSON. This prevents runtime errors.
            Object.values(publicLooksMap).forEach(lookData => {
                if (!lookData) return;

                let look: Look;
                if (typeof lookData === 'string') {
                    try {
                        look = JSON.parse(lookData);
                    } catch (e) {
                        console.error('Failed to parse public look data string:', lookData, e);
                        return; // Skip corrupted data
                    }
                } else if (typeof lookData === 'object' && lookData !== null) {
                    look = lookData as Look;
                } else {
                    return; // Skip unexpected data types
                }

                if(look && typeof look.id === 'number') {
                    combinedLooksMap.set(look.id, look);
                }
            });
        }

        // Add user's own looks, overwriting any public versions of their own looks
        if (userLooks) {
            userLooks.forEach(look => {
                if(look) combinedLooksMap.set(look.id, look);
            });
        }
        
        const combinedLooks = Array.from(combinedLooksMap.values());

        const combinedLookboardsMap = new Map<number, Lookboard>();

        // Add all public lookboards
        if (publicLookboardsMap) {
            Object.values(publicLookboardsMap).forEach(boardData => {
                if (!boardData) return;

                let board: Lookboard;
                if (typeof boardData === 'string') {
                    try { board = JSON.parse(boardData); } catch (e) { return; }
                } else if (typeof boardData === 'object' && boardData !== null) {
                    board = boardData as Lookboard;
                } else {
                    return;
                }

                if (board && typeof board.id === 'number') {
                    combinedLookboardsMap.set(board.id, board);
                }
            });
        }

        // Add user's own private lookboards
        if (userPrivateLookboards) {
            userPrivateLookboards.forEach(board => {
                if (board) combinedLookboardsMap.set(board.id, board);
            });
        }

        const combinedLookboards = Array.from(combinedLookboardsMap.values());

        return response.status(200).json({
            looks: combinedLooks || [],
            lookboards: combinedLookboards || [],
            overrides: overrides || {},
        });

    } catch (error) {
        console.error('Error fetching data from KV:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}

async function handlePost(request: NextApiRequest, response: NextApiResponse) {
    const { action } = request.body;
    switch (action) {
        case 'save-chunk':
            return handleSaveChunk(request, response);
        case 'commit-chunks':
            return handleCommitChunks(request, response);
        case 'save-overrides':
            return handleSaveOverrides(request, response);
        default:
             return response.status(400).json({ message: 'Invalid or missing action.' });
    }
}

async function handleSaveChunk(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { email, importId, chunkIndex, chunkType, data } = request.body;

        if (!email || !importId || chunkIndex === undefined || !chunkType || !data) {
            return response.status(400).json({ message: 'Missing required fields for chunk upload.' });
        }
        
        const chunkKey = `import:${email.toLowerCase()}:${importId}:${chunkType}:${chunkIndex}`;
        await kv.set(chunkKey, data, { ex: 3600 });

        return response.status(200).json({ message: `Chunk ${chunkIndex} for ${chunkType} received.` });
    } catch (error) {
        console.error('Error saving data chunk to KV:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}

async function handleCommitChunks(request: NextApiRequest, response: NextApiResponse) {
     try {
        const { email, importId, chunkCounts, overrides } = request.body;
        if (!email || !importId || !chunkCounts || !overrides) {
            return response.status(400).json({ message: 'Missing required fields for commit.' });
        }
        const emailLower = email.toLowerCase();

        // --- 1. FETCH COMPLETE "BEFORE" STATE FOR THE CURRENT USER ---
        const userLooksKey = `looks:${emailLower}`;
        const userLookboardsKey = `lookboards:${emailLower}`;
        const publicLooksKey = 'public_looks_hash';
        const publicLookboardsKey = 'public_lookboards_hash';
        
        const [
            oldUserPrivateLooks,
            publicLooksMap,
            oldUserPrivateLookboards,
            publicLookboardsMap,
        ] = await Promise.all([
            kv.get<Look[]>(userLooksKey) || [],
            kv.hgetall<Record<string, Look>>(publicLooksKey),
            kv.get<Lookboard[]>(userLookboardsKey) || [],
            kv.hgetall<Record<string, Lookboard>>(publicLookboardsKey),
        ]);

        const safeParse = <T>(data: any): T | null => {
            if (!data) return null;
            if (typeof data === 'object') return data as T;
            if (typeof data === 'string') {
                try { return JSON.parse(data) as T; } catch { return null; }
            }
            return null;
        };

        // FIX: Explicitly provide the generic type to `safeParse` to ensure the mapped array has the correct type (`(Look | null)[]`), allowing safe property access within the subsequent filter.
        const oldUserPublicLooks = publicLooksMap ? Object.values(publicLooksMap).map(data => safeParse<Look>(data)).filter((l): l is Look => l !== null && l.createdBy === emailLower) : [];
        
        const oldUserAllLooks = [...oldUserPrivateLooks, ...oldUserPublicLooks];
        
        // FIX: Explicitly provide the generic type to `safeParse` to ensure the mapped array has the correct type (`(Lookboard | null)[]`), allowing safe property access within the subsequent filter.
        const oldUserPublicLookboards = publicLookboardsMap ? Object.values(publicLookboardsMap).map(data => safeParse<Lookboard>(data)).filter((b): b is Lookboard => b !== null && b.createdBy === emailLower) : [];
        const oldUserAllLookboards = [...oldUserPrivateLookboards, ...oldUserPublicLookboards];
        
        // --- 2. GET "AFTER" STATE FROM CLIENT CHUNKS ---
        const { looks: totalLookChunks, lookboards: totalLookboardChunks } = chunkCounts;
        const lookChunkKeys = Array.from({ length: totalLookChunks }, (_, i) => `import:${emailLower}:${importId}:looks:${i}`);
        const lookboardChunkKeys = Array.from({ length: totalLookboardChunks }, (_, i) => `import:${emailLower}:${importId}:lookboards:${i}`);

        const lookChunksData = totalLookChunks > 0 ? await kv.mget<Look[][]>(...lookChunkKeys) : [];
        const lookboardChunksData = totalLookboardChunks > 0 ? await kv.mget<Lookboard[][]>(...lookboardChunkKeys) : [];

        const allLooks: Look[] = lookChunksData.flat().filter(Boolean) as Look[];
        const allLookboards: Lookboard[] = lookboardChunksData.flat().filter(Boolean) as Lookboard[];
        
        const newAllLooksMap = new Map(allLooks.map(l => [l.id, l]));
        const newAllLookboardsMap = new Map(allLookboards.map(b => [b.id, b]));
        
        // --- 3. IDENTIFY DELETED ITEMS AND PREPARE CLEANUP ---
        const deletedLooks = oldUserAllLooks.filter(look => !newAllLooksMap.has(look.id));
        const deletedLookboards = oldUserAllLookboards.filter(board => !newAllLookboardsMap.has(board.id));
        
        const pipeline = kv.pipeline();

        // Cleanup for deleted looks
        const publicLookIdsToDelete = deletedLooks.filter(l => l.visibility === 'public').map(l => String(l.id));
        if (publicLookIdsToDelete.length > 0) {
            pipeline.hdel(publicLooksKey, ...publicLookIdsToDelete);
        }

        // Cleanup for deleted lookboards
        const publicBoardIdsToDelete = deletedLookboards.filter(b => b.visibility === 'public').map(b => String(b.id));
        const publicBoardPublicIdsToDelete = deletedLookboards.map(b => b.publicId).filter((id): id is string => !!id);
        
        if (publicBoardIdsToDelete.length > 0) {
            pipeline.hdel(publicLookboardsKey, ...publicBoardIdsToDelete);
        }
        if (publicBoardPublicIdsToDelete.length > 0) {
            pipeline.del(...publicBoardPublicIdsToDelete.map(id => `publicId:${id}`));
        }
        
        // CRITICAL: Delete associated instances for deleted boards
        const instanceCleanupPromises = deletedLookboards.map(async board => {
            if (!board.publicId) return;
            const instancesIndexKey = `instances_for_board:${board.publicId}`;
            const instanceIds = await kv.smembers(instancesIndexKey);
            if (instanceIds && instanceIds.length > 0) {
                const instanceKeysToDelete = instanceIds.map(id => `instance:${id}`);
                pipeline.del(...instanceKeysToDelete);
            }
            pipeline.del(instancesIndexKey);
        });
        await Promise.all(instanceCleanupPromises);
        
        // --- 4. PREPARE NEW STATE FOR SAVING ---
        const userPrivateLooks = allLooks.filter(l => l.createdBy === emailLower && l.visibility !== 'public');
        const userPrivateBoards = allLookboards.filter(b => b.createdBy === emailLower && b.visibility !== 'public');

        const allPublicLooks = allLooks.filter(l => l.visibility === 'public');
        const allPublicBoards = allLookboards.filter(b => b.visibility === 'public');

        const publicLooksToUpdate = allPublicLooks.reduce((acc, look) => ({ ...acc, [String(look.id)]: look }), {});
        const publicBoardsToUpdate = allPublicBoards.reduce((acc, board) => ({ ...acc, [String(board.id)]: board }), {});

        const userBoardsPublicIdIndex = allLookboards
            .filter(b => b.createdBy === emailLower && b.publicId)
            .reduce((acc, board) => ({ ...acc, [`publicId:${board.publicId}`]: JSON.stringify(board) }), {});

        // --- 5. EXECUTE SAVE AND CLEANUP PIPELINE ---
        pipeline.set(userLooksKey, userPrivateLooks);
        pipeline.set(userLookboardsKey, userPrivateBoards);
        
        if (Object.keys(publicLooksToUpdate).length > 0) {
            pipeline.hset(publicLooksKey, publicLooksToUpdate);
        }
        if (Object.keys(publicBoardsToUpdate).length > 0) {
            pipeline.hset(publicLookboardsKey, publicBoardsToUpdate);
        }
        if (Object.keys(userBoardsPublicIdIndex).length > 0) {
            pipeline.mset(userBoardsPublicIdIndex);
        }

        pipeline.set(`user_overrides:${emailLower}`, overrides);
        
        await pipeline.exec();

        const allChunkKeys = [...lookChunkKeys, ...lookboardChunkKeys];
        if (allChunkKeys.length > 0) {
            await kv.del(...allChunkKeys);
        }

        return response.status(200).json({ message: 'Data committed successfully.' });
    } catch (error) {
        console.error('Error committing data from KV:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}

async function handleSaveOverrides(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { email, overrides } = request.body;
        if (!email || typeof email !== 'string' || !overrides) {
            return response.status(400).json({ message: 'Email and overrides object are required.' });
        }

        const overridesKey = `user_overrides:${email.toLowerCase()}`;
        await kv.set(overridesKey, overrides);

        return response.status(200).json({ message: 'Overrides saved successfully.' });
    } catch (error) {
        console.error('Error saving overrides to KV:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}
