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

        // --- REVISED Public Look Logic ---
        const userLooksKey = `looks:${emailLower}`;
        const publicLooksKey = 'public_looks_hash';

        // 1. Get the user's previously saved looks (to determine what has changed for THEIR looks)
        const oldUserLooks: Look[] = await kv.get(userLooksKey) || [];

        // 2. Separate the submitted looks into those created by the current user and those created by others.
        const currentUserLooks = allLooks.filter(l => l.createdBy === emailLower);
        const updatedPublicLooksFromOthers = allLooks.filter(l => l.visibility === 'public' && l.createdBy !== emailLower);

        // 3. Determine which of the USER'S looks should be added to/removed from the public hash.
        const oldPublicLooksFromUser = oldUserLooks.filter(l => l.visibility === 'public');
        const newPublicLooksFromUser = currentUserLooks.filter(l => l.visibility === 'public');
        
        const oldPublicLookIdsFromUser = new Set(oldPublicLooksFromUser.map(l => l.id));
        const newPublicLookIdsFromUser = new Set(newPublicLooksFromUser.map(l => l.id));

        const lookIdsToRemovePublicly = oldPublicLooksFromUser
            .filter(l => !newPublicLookIdsFromUser.has(l.id))
            .map(l => String(l.id));

        // 4. Create a map of ALL public looks that need to be updated in the public hash.
        const looksToUpdatePubliclyMap: Record<string, Look> = {};

        // Add the user's own public looks
        newPublicLooksFromUser.forEach(look => {
            looksToUpdatePubliclyMap[String(look.id)] = look;
        });

        // Add the public looks from other users that this user has updated (e.g., added a tag to).
        updatedPublicLooksFromOthers.forEach(look => {
            looksToUpdatePubliclyMap[String(look.id)] = look;
        });
        // --- END REVISED Public Look Logic ---

        const pipeline = kv.pipeline();
        
        // 5. Execute the pipeline
        // Update the public hash with all additions/modifications
        if (Object.keys(looksToUpdatePubliclyMap).length > 0) {
            pipeline.hset(publicLooksKey, looksToUpdatePubliclyMap);
        }
        // Remove any of the user's looks that are no longer public
        if (lookIdsToRemovePublicly.length > 0) {
            pipeline.hdel(publicLooksKey, ...lookIdsToRemovePublicly);
        }

        // 6. Overwrite the user's personal list of looks with their latest set
        pipeline.set(userLooksKey, currentUserLooks);
        pipeline.set(`lookboards:${emailLower}`, allLookboards);
        pipeline.set(`user_overrides:${emailLower}`, overrides);

        await pipeline.exec();

        // 7. Clean up temporary chunks
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