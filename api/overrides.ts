import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { LookOverrides } from '../../types';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { email, overrides } = request.body;
        if (!email || typeof email !== 'string' || !overrides) {
            return response.status(400).json({ message: 'Email and overrides object are required.' });
        }

        const overridesKey = `user_overrides:${email.toLowerCase()}`;
        await kv.set(overridesKey, overrides);

        return response.status(200).json({ message: 'Overrides saved successfully.' });
    } catch (error) {
        console.error('Error saving overrides to KV:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}
