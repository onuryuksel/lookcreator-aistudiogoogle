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
    // test
    try {
        const pendingEmails = await kv.smembers('pending_users');
        if (!pendingEmails || pendingEmails.length === 0) {
            return response.status(200).json({ users: [] });
        }

        const userKeys = pendingEmails.map(email => `user:${email}`);
        // FIX: Remove incorrect generic and let KV client infer return type.
        // This makes the code more resilient to the client's auto-parsing behavior.
        const usersData = await kv.mget(...userKeys);
        
        const users = usersData
            .filter(Boolean) // Filter out null results if a user key doesn't exist.
            .map(userData => {
                let user: User;
                
                // FIX: Defensively handle both string and object data types from KV.
                // This prevents a JSON.parse error if the KV client has already parsed the data.
                if (typeof userData === 'string') {
                    try {
                        user = JSON.parse(userData);
                    } catch (e) {
                        console.error('Failed to parse user data string:', userData, e);
                        return null; // Skip corrupted data
                    }
                } else if (typeof userData === 'object' && userData !== null) {
                    user = userData as User;
                } else {
                    return null; // Skip unexpected data types
                }

                // Strip sensitive auth fields before sending to client
                delete user.hashedPassword;
                delete user.salt;
                return user;
            })
            // Filter out any nulls that resulted from parsing errors or bad data.
            .filter((user): user is User => user !== null);

        return response.status(200).json({ users });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}