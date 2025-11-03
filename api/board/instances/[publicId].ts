import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { SharedLookboardInstance } from '../../../types';

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
            return response.status(400).json({ message: 'Lookboard public ID is required.' });
        }

        const instancesIndexKey = `instances_for_board:${publicId}`;
        const instanceIds = await kv.smembers(instancesIndexKey);

        if (!instanceIds || instanceIds.length === 0) {
            return response.status(200).json({ instances: [] });
        }

        const instanceKeys = instanceIds.map(id => `instance:${id}`);
        const instancesData = await kv.mget<SharedLookboardInstance[]>(...instanceKeys);

        const instances = instancesData
            .filter((instance): instance is SharedLookboardInstance => instance !== null && typeof instance === 'object');

        return response.status(200).json({ instances });

    } catch (error) {
        console.error('Error fetching board instances:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}