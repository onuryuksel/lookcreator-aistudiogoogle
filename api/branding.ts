
import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    // FIX: Use bracket notation to access 'method' property to bypass potential TypeScript type resolution issues in some environments.
    if (request['method'] === 'GET') {
        try {
            const logo = await kv.get<string>('app_logo');
            return response.status(200).json({ logo: logo || null });
        } catch (error) {
            console.error('Error fetching logo from KV:', error);
            return response.status(500).json({ message: 'Internal Server Error' });
        }
    }
    return response.status(405).json({ message: 'Method Not Allowed' });
}
