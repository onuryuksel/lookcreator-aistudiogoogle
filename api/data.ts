import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Look, Lookboard, LookOverrides } from '../types';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method === 'GET') {
        return await handleGet(request, response);
    }
    if (request.method === 'POST') {
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

        const { looks: totalLookChunks, lookboards: totalLookboardChunks } = chunkCounts;
        const emailLower = email.toLowerCase();
        
        const lookChunkKeys = Array.from({ length: totalLookChunks }, (_, i) => `import:${emailLower}:${importId}:looks:${i}`);
        const lookboardChunkKeys = Array.from({ length: totalLookboardChunks }, (_, i) => `import:${emailLower}:${importId}:lookboards:${i}`);
        
        const lookChunksData = totalLookChunks > 0 ? await kv.mget<Look[][]>(...lookChunkKeys) : [];
        const lookboardChunksData = totalLookboardChunks > 0 ? await kv.mget<Lookboard[][]>(...lookboardChunkKeys) : [];

        const allLooks: Look[] = lookChunksData.flat().filter(Boolean) as Look[];
        const allLookboards: Lookboard[] = lookboardChunksData.flat().filter(Boolean) as Lookboard[];

        const userLooksKey = `looks:${emailLower}`;
        const publicLooksKey = 'public_looks_hash';

        const oldUserLooks: Look[] = await kv.get(userLooksKey) || [];
        const currentUserLooks = allLooks.filter(l => l.createdBy === emailLower);
        const updatedPublicLooksFromOthers = allLooks.filter(l => l.visibility === 'public' && l.createdBy !== emailLower);

        const oldPublicLooksFromUser = oldUserLooks.filter(l => l.visibility === 'public');
        const newPublicLooksFromUser = currentUserLooks.filter(l => l.visibility === 'public');
        
        const oldPublicLookIdsFromUser = new Set(oldPublicLooksFromUser.map(l => l.id));
        const newPublicLookIdsFromUser = new Set(newPublicLooksFromUser.map(l => l.id));

        const lookIdsToRemovePublicly = oldPublicLooksFromUser
            .filter(l => !newPublicLookIdsFromUser.has(l.id))
            .map(l => String(l.id));

        const looksToUpdatePubliclyMap: Record<string, Look> = {};
        newPublicLooksFromUser.forEach(look => { looksToUpdatePubliclyMap[String(look.id)] = look; });
        updatedPublicLooksFromOthers.forEach(look => { looksToUpdatePubliclyMap[String(look.id)] = look; });
        
        const userLookboardsKey = `lookboards:${emailLower}`;
        const publicLookboardsKey = 'public_lookboards_hash';

        const oldUserLookboards: Lookboard[] = await kv.get(userLookboardsKey) || [];
        const currentUserLookboards = allLookboards.filter(b => b.createdBy === emailLower);
        const updatedPublicLookboardsFromOthers = allLookboards.filter(b => b.visibility === 'public' && b.createdBy !== emailLower);

        const privateLookboards = currentUserLookboards.filter(b => b.visibility !== 'public');
        const publicLookboardsFromUser = currentUserLookboards.filter(b => b.visibility === 'public');

        const oldPublicLookboardIdsFromUser = new Set(oldUserLookboards.filter(b => b.visibility === 'public').map(b => b.id));
        const newPublicLookboardIdsFromUser = new Set(publicLookboardsFromUser.map(b => b.id));

        const boardIdsToRemovePublicly = oldUserLookboards
            .filter(b => oldPublicLookboardIdsFromUser.has(b.id) && !newPublicLookboardIdsFromUser.has(b.id))
            .map(b => String(b.id));

        const boardsToUpdatePubliclyMap: Record<string, Lookboard> = {};
        publicLookboardsFromUser.forEach(board => { boardsToUpdatePubliclyMap[String(board.id)] = board; });
        updatedPublicLookboardsFromOthers.forEach(board => { boardsToUpdatePubliclyMap[String(board.id)] = board; });
        
        const pipeline = kv.pipeline();
        
        if (Object.keys(looksToUpdatePubliclyMap).length > 0) { pipeline.hset(publicLooksKey, looksToUpdatePubliclyMap); }
        if (lookIdsToRemovePublicly.length > 0) { pipeline.hdel(publicLooksKey, ...lookIdsToRemovePublicly); }
        pipeline.set(userLooksKey, currentUserLooks);
        
        if (Object.keys(boardsToUpdatePubliclyMap).length > 0) { pipeline.hset(publicLookboardsKey, boardsToUpdatePubliclyMap); }
        if (boardIdsToRemovePublicly.length > 0) { pipeline.hdel(publicLookboardsKey, ...boardIdsToRemovePublicly); }
        pipeline.set(userLookboardsKey, privateLookboards);

        // --- NEW: Sync publicId direct lookup index ---
        const oldPublicIds = new Set(oldUserLookboards.map(b => b.publicId).filter(Boolean));
        const newPublicIds = new Set(currentUserLookboards.map(b => b.publicId).filter(Boolean));
        
        const idsToDelete = [...oldPublicIds].filter(id => !newPublicIds.has(id));
        const publicIdKeysToDelete = idsToDelete.map(id => `publicId:${id}`);
        if (publicIdKeysToDelete.length > 0) {
            pipeline.del(...publicIdKeysToDelete);
        }
        
        const publicIdIndexMap: Record<string, string> = {};
        currentUserLookboards.forEach(board => {
            if (board.publicId) {
                publicIdIndexMap[`publicId:${board.publicId}`] = JSON.stringify(board);
            }
        });
        if (Object.keys(publicIdIndexMap).length > 0) {
            pipeline.mset(publicIdIndexMap);
        }
        // --- END NEW ---
        
        pipeline.set(`user_overrides:${emailLower}`, overrides);
        await pipeline.exec();

        const allChunkKeys = [...lookChunkKeys, ...lookboardChunkKeys];
        if (allChunkKeys.length > 0) {
            await kv.del(...allChunkKeys);
        }

        return response.status(200).json({ message: 'Data imported and committed successfully.' });
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