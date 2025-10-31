import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { email, importId, chunkIndex, chunkType, data } = request.body;

        if (!email || !importId || chunkIndex === undefined || !chunkType || !data) {
            return response.status(400).json({ message: 'Missing required fields for chunk upload.' });
        }
        
        // Key for storing the chunk
        const chunkKey = `import:${email.toLowerCase()}:${importId}:${chunkType}:${chunkIndex}`;
        
        // Store the chunk. KV values can be up to 1MB, which should be fine for our chunk size.
        // We set an expiry time (e.g., 1 hour) to auto-clean failed imports.
        await kv.set(chunkKey, data, { ex: 3600 });

        return response.status(200).json({ message: `Chunk ${chunkIndex} for ${chunkType} received.` });
    } catch (error) {
        console.error('Error saving data chunk to KV:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}
