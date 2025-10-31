import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Model, Look, Lookboard, LookOverrides } from '../../types';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

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
