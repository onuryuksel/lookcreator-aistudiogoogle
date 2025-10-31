import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { SharedLookboardInstance } from '../types';
import crypto from 'crypto';

// --- MAIN HANDLER ---
export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    const { action } = request.body;
    switch (action) {
        case 'share-board':
            return await shareBoard(request, response);
        case 'update-instance':
            return await updateInstance(request, response);
        default:
            return response.status(400).json({ message: 'Invalid or missing action for POST request.' });
    }
}

// --- ACTION HANDLERS ---

async function shareBoard(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { publicId, sharedBy } = request.body;
        if (!publicId || !sharedBy) {
            return response.status(400).json({ message: 'Lookboard publicId and sharedBy email are required.' });
        }
        
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
        await kv.set(instanceKey, JSON.stringify(newInstance), { ex: 90 * 24 * 60 * 60 });

        return response.status(201).json({ instanceId });

    } catch (error) {
        console.error('Error creating share instance:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}

async function updateInstance(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { instanceId, feedbacks, comments } = request.body;
        if (!instanceId) {
            return response.status(400).json({ message: 'Instance ID is required.' });
        }

        const instanceKey = `instance:${instanceId}`;
        const existingInstanceData = await kv.get(instanceKey);

        if (!existingInstanceData) {
            return response.status(404).json({ message: 'Share link not found or has expired.' });
        }

        const existingInstance: SharedLookboardInstance = typeof existingInstanceData === 'string' ? JSON.parse(existingInstanceData) : existingInstanceData as SharedLookboardInstance;

        const updatedInstance: SharedLookboardInstance = {
            ...existingInstance,
            feedbacks: feedbacks !== undefined ? feedbacks : existingInstance.feedbacks,
            comments: comments !== undefined ? comments : existingInstance.comments,
        };
        
        await kv.set(instanceKey, JSON.stringify(updatedInstance), { keepTtl: true });

        return response.status(200).json({ message: 'Feedback saved successfully.' });

    } catch (error) {
        console.error('Error updating instance:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}
