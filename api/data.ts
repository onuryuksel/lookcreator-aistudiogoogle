import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Look, Lookboard, LookOverrides } from '../../types';

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
        const emailLower = email.toLowerCase();

        const userLooksKey = `looks:${emailLower}`;
        const boardsKey = `lookboards:${emailLower}`;
        const overridesKey = `user_overrides:${emailLower}`;
        const publicLooksKey = 'public_looks_hash';
        const publicLookboardsKey = 'public_lookboards_hash';

        const [
            userLooks, 
            publicLooksMap, 
            userPrivateLookboards,
            publicLookboardsMap,
            overrides
        ] = await Promise.all([
            kv.get<Look[]>(userLooksKey),
            kv.hgetall(publicLooksKey),
            kv.get<Lookboard[]>(boardsKey),
            kv.hgetall(publicLookboardsKey),
            kv.get<LookOverrides>(overridesKey)
        ]);
        
        const combinedLooksMap = new Map<number, Look>();

        // Add all public looks first
        if (publicLooksMap) {
            // FIX: Defensively handle both string and object data types from KV,
            // which can occur depending on how the data was stored or if the KV
            // client auto-parses the JSON. This prevents runtime errors.
            Object.values(publicLooksMap).forEach(lookData => {
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

                if(look && typeof look.id === 'number') {
                    combinedLooksMap.set(look.id, look);
                }
            });
        }

        // Add user's own looks, overwriting any public versions of their own looks
        if (userLooks) {
            userLooks.forEach(look => {
                if(look) combinedLooksMap.set(look.id, look);
            });
        }
        
        const combinedLooks = Array.from(combinedLooksMap.values());

        const combinedLookboardsMap = new Map<number, Lookboard>();

        // Add all public lookboards
        if (publicLookboardsMap) {
            Object.values(publicLookboardsMap).forEach(boardData => {
                if (!boardData) return;

                let board: Lookboard;
                if (typeof boardData === 'string') {
                    try { board = JSON.parse(boardData); } catch (e) { return; }
                } else if (typeof boardData === 'object' && boardData !== null) {
                    board = boardData as Lookboard;
                } else {
                    return;
                }

                if (board && typeof board.id === 'number') {
                    combinedLookboardsMap.set(board.id, board);
                }
            });
        }

        // Add user's own private lookboards
        if (userPrivateLookboards) {
            userPrivateLookboards.forEach(board => {
                if (board) combinedLookboardsMap.set(board.id, board);
            });
        }

        const combinedLookboards = Array.from(combinedLookboardsMap.values());

        return response.status(200).json({
            looks: combinedLooks || [],
            lookboards: combinedLookboards || [],
            overrides: overrides || {},
        });

    } catch (error) {
        console.error('Error fetching data from KV:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}

async function handlePost(request: NextApiRequest, response: NextApiResponse) {
    try {
        // This endpoint is now deprecated in favor of the chunked upload flow
        // but is kept for simple, small saves if the architecture changes.
        // The main logic is now in `api/data-commit.ts`.
        const { email, looks, lookboards, overrides } = request.body;
        if (!email || !looks || !lookboards || !overrides) {
            return response.status(400).json({ message: 'Missing required fields.' });
        }
        const emailLower = email.toLowerCase();

        const userLooksKey = `looks:${emailLower}`;
        const boardsKey = `lookboards:${emailLower}`;
        const overridesKey = `user_overrides:${emailLower}`;
        const publicLooksKey = 'public_looks_hash';

        // Full rewrite logic
        const oldUserLooks: Look[] = await kv.get(userLooksKey) || [];
        const newUserLooks = looks.filter((l: Look) => l.createdBy === emailLower);

        const newPublicLooks = newUserLooks.filter((l: Look) => l.visibility === 'public');
        const oldPublicLookIds = new Set(oldUserLooks.filter(l => l.visibility === 'public').map(l => l.id));
        const newPublicLookIds = new Set(newPublicLooks.map(l => l.id));

        const looksToAddPublicly = newPublicLooks.filter(l => !oldPublicLookIds.has(l.id));
        const lookIdsToRemovePublicly = oldUserLooks.filter(l => oldPublicLookIds.has(l.id) && !newPublicLookIds.has(l.id)).map(l => String(l.id));

        const pipeline = kv.pipeline();

        if (looksToAddPublicly.length > 0) {
            const looksToAddMap = looksToAddPublicly.reduce((acc, look) => {
                acc[look.id] = look;
                return acc;
            }, {} as Record<string, Look>);
            pipeline.hset(publicLooksKey, looksToAddMap);
        }

        if (lookIdsToRemovePublicly.length > 0) {
            pipeline.hdel(publicLooksKey, ...lookIdsToRemovePublicly);
        }
        
        pipeline.set(userLooksKey, newUserLooks);
        pipeline.set(boardsKey, lookboards);
        pipeline.set(overridesKey, overrides);

        await pipeline.exec();

        return response.status(200).json({ message: 'Data saved successfully.' });
    } catch (error) {
        console.error('Error saving data to KV:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}