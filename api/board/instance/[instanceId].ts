import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Look, Lookboard, SharedLookboardInstance, LookOverrides } from '../../../types';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'GET') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { instanceId } = request.query;
        if (!instanceId || typeof instanceId !== 'string') {
            return response.status(400).json({ message: 'Instance ID is required.' });
        }

        // 1. Fetch the unique shared instance
        const instance = await kv.get<SharedLookboardInstance>(`instance:${instanceId}`);
        if (!instance) {
            return response.status(404).json({ message: 'Lookboard link not found or expired.' });
        }
        
        // 2. Fetch the base lookboard template using the public ID from the instance
        const lookboard = await kv.get<Lookboard>(`publicId:${instance.lookboardPublicId}`);
        if (!lookboard) {
            // This could happen if the original board was deleted after the link was shared
            return response.status(404).json({ message: 'The original lookboard for this link could not be found.' });
        }

        // 3. Fetch all looks required for this board
        const lookIds = lookboard.lookIds || [];
        if (lookIds.length === 0) {
            return response.status(200).json({ lookboard, looks: [], instance });
        }
        
        const creatorEmail = lookboard.createdBy;

        // Fetch the creator's private looks, all public looks, AND the creator's overrides
        const [userLooks, publicLooksMap, overrides] = await Promise.all([
            kv.get<Look[]>(`looks:${creatorEmail}`),
            kv.hgetall<Record<string, Look>>('public_looks_hash'),
            kv.get<LookOverrides>(`user_overrides:${creatorEmail}`)
        ]);
        
        const combinedLooksMap = new Map<number, Look>();

        // Populate with all available public looks
        if (publicLooksMap) {
             Object.values(publicLooksMap).forEach(lookData => {
                if (!lookData) return;
                const look = typeof lookData === 'string' ? JSON.parse(lookData) : lookData;
                if (look && typeof look.id === 'number') combinedLooksMap.set(look.id, look);
            });
        }
        
        // Populate with the creator's looks (private and public), overwriting to ensure the latest version is used
        if (userLooks) {
            userLooks.forEach(look => {
                if(look) combinedLooksMap.set(look.id, look);
            });
        }
        
        // Filter the combined list to get only the looks that are actually in this specific lookboard
        const boardLooks = lookIds
            .map(id => combinedLooksMap.get(id))
            .filter((look): look is Look => look !== undefined);

        return response.status(200).json({ lookboard, looks: boardLooks, instance, overrides: overrides || {} });

    } catch (error) {
        console.error('Error fetching public board data:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}