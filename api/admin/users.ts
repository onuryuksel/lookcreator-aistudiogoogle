import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { User } from '../../types';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'GET') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }
    
    // In a real app, you would add authentication here to ensure only admins can access this.
    
    try {
        const pendingEmails = await kv.smembers('pending_users');
        if (!pendingEmails || pendingEmails.length === 0) {
            return response.status(200).json({ users: [] });
        }

        const userKeys = pendingEmails.map(email => `user:${email}`);
        const usersData = await kv.mget<string[]>(...userKeys);
        
        const users = usersData
            .filter(Boolean) // Filter out null results if a user was deleted but not from the set
            .map(userData => {
                // FIX: Simplified type declaration now that `password` is an optional field on `User`.
                const user: User = JSON.parse(userData);
                delete user.password; // Don't send password to client
                return user;
            });

        return response.status(200).json({ users });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}