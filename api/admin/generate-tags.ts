import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Look } from '../../types';
import { generateTagsForLook } from '../../services/tagGenerationService';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }
    
    // In a real app, you would add authentication here to ensure only admins can access this.
    
    try {
        const publicLooksKey = 'public_looks_hash';
        const userLookKeys = await kv.keys('looks:*');

        const publicLooksData = await kv.hgetall(publicLooksKey);
        const allUsersLooksData = userLookKeys.length > 0 ? await kv.mget<Look[][]>(...userLookKeys) : [];

        let taggedCount = 0;
        const looksToUpdatePublicly: Record<string, Look> = {};
        const userLooksToUpdate: Map<string, Look[]> = new Map();
        
        const allLooksMap = new Map<number, Look>();

        // Populate map with all public looks first
        if (publicLooksData) {
            // FIX: Defensively handle both string and object data types from KV,
            // which can occur depending on how the data was stored or if the KV
            // client auto-parses the JSON. This prevents runtime errors.
            Object.values(publicLooksData).forEach(lookData => {
                if (!lookData) return;

                let look: Look;
                if (typeof lookData === 'string') {
                    try {
                        look = JSON.parse(lookData);
                    } catch (e) {
                        console.error('Failed to parse public look data string:', lookData, e);
                        return; // Skip corrupted data
                    }
                } else if (typeof lookData === 'object' && lookData !== null) {
                    look = lookData as Look;
                } else {
                    return; // Skip unexpected data types
                }

                if (look && typeof look.id === 'number') {
                    allLooksMap.set(look.id, look);
                }
            });
        }
        
        // Add/overwrite with user-specific looks
        allUsersLooksData.forEach((userLooks, index) => {
            if (Array.isArray(userLooks)) {
                userLooks.forEach(look => {
                    if (look && typeof look === 'object' && 'id' in look) {
                        allLooksMap.set(look.id, look);
                    }
                });
            }
        });

        // Process all unique looks
        for (const look of allLooksMap.values()) {
            if (look && (!look.tags || look.tags.length === 0)) {
                try {
                    const newTags = await generateTagsForLook(look.finalImage);
                    if (newTags.length > 0) {
                        look.tags = newTags;
                        taggedCount++;
                        // Mark for update in public hash if it's public
                        if (look.visibility === 'public') {
                            looksToUpdatePublicly[look.id] = look;
                        }
                    }
                } catch (taggingError) {
                    console.error(`Failed to generate tags for look ${look.id}:`, taggingError);
                    // Continue to the next look even if one fails
                }
            }
        }
        
        if (taggedCount === 0) {
            return response.status(200).json({ message: 'No untagged looks found to process.' });
        }

        // Update user-specific look arrays
        allUsersLooksData.forEach((userLooks, index) => {
            if (Array.isArray(userLooks)) {
                const userLookKey = userLookKeys[index];
                const updatedUserLooks = userLooks.map(look => {
                    const updatedLook = allLooksMap.get(look.id);
                    return updatedLook || look;
                });
                userLooksToUpdate.set(userLookKey, updatedUserLooks);
            }
        });

        const pipeline = kv.pipeline();

        // Update the main public looks hash
        if (Object.keys(looksToUpdatePublicly).length > 0) {
            pipeline.hset(publicLooksKey, looksToUpdatePublicly);
        }
        
        // Update each user's individual looks array
        userLooksToUpdate.forEach((looks, key) => {
            pipeline.set(key, looks);
        });

        await pipeline.exec();

        return response.status(200).json({ message: `Successfully generated tags for ${taggedCount} look(s).` });

    } catch (error) {
        console.error('Error during bulk tag generation:', error);
        return response.status(500).json({ message: 'Internal Server Error during tag generation.' });
    }
}
