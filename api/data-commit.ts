import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Model, Look, Lookboard } from '../../types';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { email, importId, chunkCounts } = request.body;
        if (!email || !importId || !chunkCounts) {
            return response.status(400).json({ message: 'Missing required fields for commit.' });
        }

        const { models: totalModelChunks, looks: totalLookChunks, lookboards: totalLookboardChunks } = chunkCounts;
        const emailLower = email.toLowerCase();
        
        // Generate keys for all chunks
        const modelChunkKeys = Array.from({ length: totalModelChunks }, (_, i) => `import:${emailLower}:${importId}:models:${i}`);
        const lookChunkKeys = Array.from({ length: totalLookChunks }, (_, i) => `import:${emailLower}:${importId}:looks:${i}`);
        const lookboardChunkKeys = Array.from({ length: totalLookboardChunks }, (_, i) => `import:${emailLower}:${importId}:lookboards:${i}`);
        
        // Fetch all chunks
        const modelChunksData = totalModelChunks > 0 ? await kv.mget<Model[][]>(...modelChunkKeys) : [];
        const lookChunksData = totalLookChunks > 0 ? await kv.mget<Look[][]>(...lookChunkKeys) : [];
        const lookboardChunksData = totalLookboardChunks > 0 ? await kv.mget<Lookboard[][]>(...lookboardChunkKeys) : [];

        // Reassemble arrays, filtering out any null/undefined chunks
        const allModels: Model[] = modelChunksData.flat().filter(Boolean) as Model[];
        const allLooks: Look[] = lookChunksData.flat().filter(Boolean) as Look[];
        const allLookboards: Lookboard[] = lookboardChunksData.flat().filter(Boolean) as Lookboard[];

        // Final destination keys
        const looksKey = `looks:${emailLower}`;
        const boardsKey = `lookboards:${emailLower}`;

        // Save reassembled data
        // NOTE: Models are saved locally on the client, so we don't save them to the server here.
        // This commit is for looks and lookboards.
        await kv.set(looksKey, allLooks);
        await kv.set(boardsKey, allLookboards);

        // Clean up temporary chunks
        const allChunkKeys = [...modelChunkKeys, ...lookChunkKeys, ...lookboardChunkKeys];
        if (allChunkKeys.length > 0) {
            await kv.del(...allChunkKeys);
        }

        return response.status(200).json({ message: 'Data imported and committed successfully.' });
    } catch (error) {
        console.error('Error committing data from KV:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}
