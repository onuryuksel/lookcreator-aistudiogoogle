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
        
        // Generate keys for all chunks
        const lookChunkKeys = Array.from({ length: totalLookChunks }, (_, i) => `import:${emailLower}:${importId}:looks:${i}`);
        const lookboardChunkKeys = Array.from({ length: totalLookboardChunks }, (_, i) => `import:${emailLower}:${importId}:lookboards:${i}`);
        
        // Fetch all chunks
        const lookChunksData = totalLookChunks > 0 ? await kv.mget<Look[][]>(...lookChunkKeys) : [];
        const lookboardChunksData = totalLookboardChunks > 0 ? await kv.mget<Lookboard[][]>(...lookboardChunkKeys) : [];

        // Reassemble arrays
        const allLooks: Look[] = lookChunksData.flat().filter(Boolean) as Look[];
        const allLookboards: Lookboard[] = lookboardChunksData.flat().filter(Boolean) as Lookboard[];

        // --- Start of Public Look Logic ---
        const userLooksKey = `looks:${emailLower}`;
        const publicLooksKey = 'public_looks_hash';

        const oldUserLooks: Look[] = await kv.get(userLooksKey) || [];
        const newUserLooks = allLooks.filter(l => l.createdBy === emailLower);

        const newPublicLooks = newUserLooks.filter(l => l.visibility === 'public');
        const oldPublicLookIds = new Set(oldUserLooks.filter(l => l.visibility === 'public').map(l => l.id));
        const newPublicLookIds = new Set(newPublicLooks.map(l => l.id));

        const looksToUpdatePublicly = newPublicLooks.filter(l => l.visibility === 'public');
        const lookIdsToRemovePublicly = oldUserLooks.filter(l => oldPublicLookIds.has(l.id) && !newPublicLookIds.has(l.id)).map(l => String(l.id));
        // --- End of Public Look Logic ---

        const pipeline = kv.pipeline();
        
        // 1. Update public hash
        if (looksToUpdatePublicly.length > 0) {
            const looksToUpdateMap = looksToUpdatePublicly.reduce((acc, look) => {
                acc[look.id] = look;
                return acc;
            }, {} as Record<string, Look>);
            pipeline.hset(publicLooksKey, looksToUpdateMap);
        }
        if (lookIdsToRemovePublicly.length > 0) {
            pipeline.hdel(publicLooksKey, ...lookIdsToRemovePublicly);
        }

        // 2. Save user-specific data
        pipeline.set(userLooksKey, newUserLooks);
        pipeline.set(`lookboards:${emailLower}`, allLookboards);
        pipeline.set(`user_overrides:${emailLower}`, overrides);

        await pipeline.exec();

        // 3. Clean up temporary chunks
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