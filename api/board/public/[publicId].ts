import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Look, Lookboard } from '../../../types';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'GET') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { publicId } = request.query;
        if (!publicId || typeof publicId !== 'string') {
            return response.status(400).json({ message: 'Public ID is required.' });
        }

        // 1. Fetch the lookboard directly using the fast-access index
        const lookboardData = await kv.get(`publicId:${publicId}`);

        if (!lookboardData) {
            return response.status(404).json({ message: 'Lookboard not found.' });
        }

        const lookboard: Lookboard = typeof lookboardData === 'string' ? JSON.parse(lookboardData) : lookboardData as Lookboard;

        // 2. Fetch the looks needed for this board
        const lookIds = lookboard.lookIds || [];
        if (lookIds.length === 0) {
            return response.status(200).json({ lookboard, looks: [] });
        }
        
        const creatorEmail = lookboard.createdBy;

        // Fetch both the creator's private looks and all public looks
        const [userLooks, publicLooksMap] = await Promise.all([
            kv.get<Look[]>(`looks:${creatorEmail}`),
            kv.hgetall<Record<string, Look>>('public_looks_hash')
        ]);
        
        const combinedLooksMap = new Map<number, Look>();

        // Add public looks
        if (publicLooksMap) {
            Object.values(publicLooksMap).forEach(lookData => {
                if (!lookData) return;
                const look = typeof lookData === 'string' ? JSON.parse(lookData) : lookData;
                if (look && typeof look.id === 'number') combinedLooksMap.set(look.id, look);
            });
        }
        
        // Add user's own looks, potentially overwriting
        if (userLooks) {
            userLooks.forEach(look => {
                if(look) combinedLooksMap.set(look.id, look);
            });
        }
        
        // 3. Filter to get only the looks that are in the board
        const boardLooks = lookIds
            .map(id => combinedLooksMap.get(id))
            .filter((look): look is Look => look !== undefined);

        // This endpoint does not return an 'instance' object, as it's for view-only access.
        return response.status(200).json({ lookboard, looks: boardLooks });

    } catch (error) {
        console.error('Error fetching public board data:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}