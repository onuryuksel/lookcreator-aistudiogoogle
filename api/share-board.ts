import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { SharedLookboardInstance } from '../../types';
import crypto from 'crypto';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { publicId, sharedBy } = request.body;
        if (!publicId || !sharedBy) {
            return response.status(400).json({ message: 'Lookboard publicId and sharedBy email are required.' });
        }
        
        // Ensure the base lookboard exists before creating an instance
        const lookboard = await kv.get(`publicId:${publicId}`);
        if (!lookboard) {
            return response.status(404).json({ message: 'The lookboard you are trying to share does not exist.' });
        }

        const instanceId = crypto.randomUUID();

        const newInstance: SharedLookboardInstance = {
            id: instanceId,
            lookboardPublicId: publicId,
            sharedBy: sharedBy,
            createdAt: Date.now(),
            feedbacks: {},
            comments: {},
        };
        
        const instanceKey = `instance:${instanceId}`;
        // Set an expiry for instances, e.g., 90 days, to manage data growth.
        await kv.set(instanceKey, JSON.stringify(newInstance), { ex: 90 * 24 * 60 * 60 });

        return response.status(201).json({ instanceId });

    } catch (error) {
        console.error('Error creating share instance:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}
