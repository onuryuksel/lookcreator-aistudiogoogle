import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { User } from '../../types';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }
    
    // In a real app, you would add authentication here to ensure only admins can access this.
    
    try {
        const { email } = request.body;

        if (!email) {
            return response.status(400).json({ message: 'Email is required' });
        }

        const emailLower = email.toLowerCase();
        const userKey = `user:${emailLower}`;
        const userData = await kv.get<string>(userKey);

        if (!userData) {
            return response.status(404).json({ message: 'User not found' });
        }

        const user: User = JSON.parse(userData);
        user.status = 'approved';

        // Update the user object and remove them from the pending set
        await kv.set(userKey, JSON.stringify(user));
        await kv.srem('pending_users', emailLower);

        return response.status(200).json({ message: `User ${emailLower} approved successfully.` });

    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}