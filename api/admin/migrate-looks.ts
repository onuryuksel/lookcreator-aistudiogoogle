import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Look } from '../../types';

const ADMIN_EMAIL = 'oyouksel@altayer.com';
const ADMIN_USERNAME = 'Ounass Admin';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }
    
    // In a real app, you would add authentication here to ensure only admins can access this.
    
    try {
        const userKeys = await kv.keys('user:*');
        if (userKeys.length === 0) {
            return response.status(200).json({ message: 'No users found to process.' });
        }
        
        const lookKeys = userKeys.map(key => key.replace('user:', 'looks:'));
        const allUsersLooksData = lookKeys.length > 0 ? await kv.mget<Look[][]>(...lookKeys) : [];

        let migratedCount = 0;
        const publicLooksToUpdate: Record<string, Look> = {};
        const userLooksToUpdate: Map<string, Look[]> = new Map();

        allUsersLooksData.forEach((userLooks, index) => {
            if (!userLooks || !Array.isArray(userLooks)) {
                return;
            }

            const currentLookKey = lookKeys[index];
            let needsUpdate = false;
            const updatedLooksForUser = userLooks.map(look => {
                // A "legacy" look is one that does not have the `visibility` property.
                if (look && typeof look === 'object' && !('visibility' in look)) {
                    migratedCount++;
                    needsUpdate = true;
                    const migratedLook: Look = {
                        ...look,
                        visibility: 'public',
                        createdBy: ADMIN_EMAIL,
                        createdByUsername: ADMIN_USERNAME,
                    };
                    publicLooksToUpdate[migratedLook.id] = migratedLook;
                    return migratedLook;
                }
                return look;
            });

            if (needsUpdate) {
                userLooksToUpdate.set(currentLookKey, updatedLooksForUser);
            }
        });

        if (migratedCount === 0) {
            return response.status(200).json({ message: 'No legacy looks found to migrate.' });
        }

        const pipeline = kv.pipeline();

        // Update the main public looks hash
        if (Object.keys(publicLooksToUpdate).length > 0) {
            pipeline.hset('public_looks_hash', publicLooksToUpdate);
        }
        
        // Update each user's individual looks array
        userLooksToUpdate.forEach((looks, key) => {
            pipeline.set(key, looks);
        });

        await pipeline.exec();

        return response.status(200).json({ message: `Successfully migrated ${migratedCount} legacy look(s) to public.` });

    } catch (error) {
        console.error('Error during look migration:', error);
        return response.status(500).json({ message: 'Internal Server Error during migration.' });
    }
}