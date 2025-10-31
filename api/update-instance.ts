import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { SharedLookboardInstance } from '../../types';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { instanceId, feedbacks, comments } = request.body;
        if (!instanceId) {
            return response.status(400).json({ message: 'Instance ID is required.' });
        }

        const instanceKey = `instance:${instanceId}`;
        const existingInstance = await kv.get<SharedLookboardInstance>(instanceKey);

        if (!existingInstance) {
            return response.status(404).json({ message: 'Share link not found or has expired.' });
        }

        const updatedInstance: SharedLookboardInstance = {
            ...existingInstance,
            feedbacks: feedbacks !== undefined ? feedbacks : existingInstance.feedbacks,
            comments: comments !== undefined ? comments : existingInstance.comments,
        };
        
        // Update the instance, preserving its original expiration time (TTL)
        await kv.set(instanceKey, JSON.stringify(updatedInstance), { keepttl: true });

        return response.status(200).json({ message: 'Feedback saved successfully.' });

    } catch (error) {
        console.error('Error updating instance:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}
