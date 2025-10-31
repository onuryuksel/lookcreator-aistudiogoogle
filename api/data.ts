import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Look, Lookboard } from '../../types';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method === 'GET') {
        return await handleGet(request, response);
    }
    if (request.method === 'POST') {
        return await handlePost(request, response);
    }
    return response.status(405).json({ message: 'Method Not Allowed' });
}

async function handleGet(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { email } = request.query;
        if (!email || typeof email !== 'string') {
            return response.status(400).json({ message: 'Email query parameter is required.' });
        }

        const looksKey = `looks:${email.toLowerCase()}`;
        const boardsKey = `lookboards:${email.toLowerCase()}`;

        const [looksData, lookboardsData] = await kv.mget<[Look[] | null, Lookboard[] | null]>(looksKey, boardsKey);

        return response.status(200).json({
            looks: looksData || [],
            lookboards: lookboardsData || [],
        });
    } catch (error) {
        console.error('Error fetching data from KV:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}

async function handlePost(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { email, looks, lookboards } = request.body;

        if (!email || !looks || !lookboards) {
            return response.status(400).json({ message: 'Missing required fields: email, looks, and lookboards.' });
        }

        const looksKey = `looks:${email.toLowerCase()}`;
        const boardsKey = `lookboards:${email.toLowerCase()}`;
        
        await kv.set(looksKey, looks);
        await kv.set(boardsKey, lookboards);

        return response.status(200).json({ message: 'Data saved successfully.' });
    } catch (error) {
        console.error('Error saving data to KV:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}
