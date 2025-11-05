

import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Look, Lookboard, SharedLookboardInstance, User, MainImageProposal } from '../types';
import crypto from 'crypto';

// --- MAIN HANDLER ---
export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    // FIX: Use bracket notation to access 'method' property to bypass potential TypeScript type resolution issues in some environments.
    if (request['method'] !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    const { action } = request.body;
    switch (action) {
        case 'share-board':
            return await shareBoard(request, response);
        case 'update-instance':
            return await updateInstance(request, response);
        case 'duplicate-board':
            return await duplicateBoard(request, response);
        case 'update-board':
            return await updateBoard(request, response);
        case 'add-variation-to-look':
            return await addVariationToLook(request, response);
        case 'accept-main-image-proposal':
            return await acceptMainImageProposal(request, response);
        default:
            return response.status(400).json({ message: 'Invalid or missing action for POST request.' });
    }
}

// --- ACTION HANDLERS ---

async function acceptMainImageProposal(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { lookId, proposal, userEmail } = request.body as { lookId: number, proposal: MainImageProposal, userEmail: string };

        if (!lookId || !proposal || !userEmail) {
            return response.status(400).json({ message: 'Missing required fields: lookId, proposal, userEmail.' });
        }
        const emailLower = userEmail.toLowerCase();

        // 1. Find the look
        let look: Look | null = null;
        let foundIn: 'public' | 'private' | null = null;
        
        const publicLooksKey = 'public_looks_hash';
        const publicLookData = await kv.hget(publicLooksKey, String(lookId));
        
        if (publicLookData) {
            const parsedLook = typeof publicLookData === 'string' ? JSON.parse(publicLookData) : publicLookData as Look;
            // Ensure this public look belongs to the user trying to modify it
            if (parsedLook.createdBy === emailLower) {
                look = parsedLook;
                foundIn = 'public';
            }
        }
        
        if (!look) {
            const privateLookKey = `looks:${emailLower}`;
            const userLooks = await kv.get<Look[]>(privateLookKey);
            const privateLook = userLooks?.find(l => l.id === lookId);
            if (privateLook) {
                look = privateLook;
                foundIn = 'private';
            }
        }

        if (!look || !foundIn) {
            return response.status(404).json({ message: 'Look not found or you do not have permission to edit it.' });
        }

        // 2. Update the look object
        const oldFinalImage = look.finalImage;
        const updatedLook: Look = {
            ...look,
            finalImage: proposal.proposedImage,
            variations: [...new Set([...(look.variations || []), oldFinalImage])].filter(v => v !== proposal.proposedImage),
        };

        const pipeline = kv.pipeline();

        // 3. Save the look back to its original location
        if (foundIn === 'public') {
            pipeline.hset(publicLooksKey, { [String(lookId)]: updatedLook });
        } else { // 'private'
            const privateLookKey = `looks:${emailLower}`;
            const userLooks = (await kv.get<Look[]>(privateLookKey)) || [];
            const updatedUserLooks = userLooks.map(l => l.id === lookId ? updatedLook : l);
            pipeline.set(privateLookKey, updatedUserLooks);
        }

        // 4. Remove all proposals for this look ID for the creator
        const proposalKey = `proposals_for_user:${emailLower}`;
        const proposalsForCreator = await kv.get<Record<string, MainImageProposal[]>>(proposalKey) || {};
        if (proposalsForCreator[String(lookId)]) {
            delete proposalsForCreator[String(lookId)];
            pipeline.set(proposalKey, proposalsForCreator);
        }
        
        await pipeline.exec();

        return response.status(200).json({ message: 'Proposal accepted and look updated.', updatedLook });

    } catch (error) {
        console.error('Error accepting main image proposal:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}


async function addVariationToLook(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { lookId, createdBy, visibility, newVariations } = request.body;

        if (!lookId || !createdBy || !visibility || !newVariations || !Array.isArray(newVariations) || newVariations.length === 0) {
            return response.status(400).json({ message: 'Missing required fields: lookId, createdBy, visibility, newVariations.' });
        }

        let look: Look | null = null;
        let foundIn: 'public' | 'private' | null = null;

        // 1. Find the look
        const publicLooksKey = 'public_looks_hash';
        // Always check public first, as a user's local version might be stale.
        const publicLookData = await kv.hget(publicLooksKey, String(lookId));
        if (publicLookData) {
            look = typeof publicLookData === 'string' ? JSON.parse(publicLookData) : publicLookData as Look;
            foundIn = 'public';
        }
        
        // If not found in public (or it's private), check the user's private store
        if (!look && visibility === 'private') {
            const privateLookKey = `looks:${createdBy.toLowerCase()}`;
            const userLooks = await kv.get<Look[]>(privateLookKey);
            const privateLook = userLooks?.find(l => l.id === lookId);
            if (privateLook) {
                look = privateLook;
                foundIn = 'private';
            }
        }

        if (!look || !foundIn) {
            return response.status(404).json({ message: 'Look not found.' });
        }
        
        // 2. Update the look
        const updatedLook: Look = {
            ...look,
            variations: [...new Set([...(look.variations || []), ...newVariations])]
        };

        // 3. Save the look back where it was found
        if (foundIn === 'public') {
            await kv.hset(publicLooksKey, { [String(lookId)]: updatedLook });
        } else { // 'private'
            const privateLookKey = `looks:${createdBy.toLowerCase()}`;
            const userLooks = (await kv.get<Look[]>(privateLookKey)) || [];
            const updatedUserLooks = userLooks.map(l => l.id === lookId ? updatedLook : l);
            await kv.set(privateLookKey, updatedUserLooks);
        }

        return response.status(200).json({ message: 'Variation added successfully.' });

    } catch (error) {
        console.error('Error adding variation to look:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}


async function shareBoard(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { publicId, sharedBy, sharedByUsername, clientName, title, note } = request.body;
        if (!publicId || !sharedBy || !sharedByUsername) {
            return response.status(400).json({ message: 'Lookboard publicId, sharedBy email, and sharedBy username are required.' });
        }
        
        const lookboard = await kv.get(`publicId:${publicId}`);
        if (!lookboard) {
            return response.status(404).json({ message: 'The lookboard you are trying to share does not exist.' });
        }

        const instanceId = crypto.randomUUID();

        const newInstance: SharedLookboardInstance = {
            id: instanceId,
            lookboardPublicId: publicId,
            sharedBy: sharedBy,
            sharedByUsername: sharedByUsername,
            clientName: clientName || undefined,
            createdAt: Date.now(),
            feedbacks: {},
            comments: {},
            title: title || undefined,
            note: note || undefined,
        };
        
        const instanceKey = `instance:${instanceId}`;
        const instancesIndexKey = `instances_for_board:${publicId}`;

        const pipeline = kv.pipeline();
        pipeline.set(instanceKey, JSON.stringify(newInstance), { ex: 90 * 24 * 60 * 60 });
        pipeline.sadd(instancesIndexKey, instanceId);
        await pipeline.exec();

        return response.status(201).json({ instanceId });

    } catch (error) {
        console.error('Error creating share instance:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}

async function updateInstance(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { instanceId, feedbacks, comments } = request.body;
        if (!instanceId) {
            return response.status(400).json({ message: 'Instance ID is required.' });
        }

        const instanceKey = `instance:${instanceId}`;
        const existingInstanceData = await kv.get(instanceKey);

        if (!existingInstanceData) {
            return response.status(404).json({ message: 'Share link not found or has expired.' });
        }

        const existingInstance: SharedLookboardInstance = typeof existingInstanceData === 'string' ? JSON.parse(existingInstanceData) : existingInstanceData as SharedLookboardInstance;

        const updatedInstance: SharedLookboardInstance = {
            ...existingInstance,
            feedbacks: feedbacks !== undefined ? feedbacks : existingInstance.feedbacks,
            comments: comments !== undefined ? comments : existingInstance.comments,
        };
        
        await kv.set(instanceKey, JSON.stringify(updatedInstance), { keepTtl: true });

        return response.status(200).json({ message: 'Feedback saved successfully.' });

    } catch (error) {
        console.error('Error updating instance:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}

async function duplicateBoard(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { publicId, user } = request.body as { publicId: string; user: User };
        if (!publicId || !user || !user.email || !user.username) {
            return response.status(400).json({ message: 'Public ID and user info are required.' });
        }
        
        const originalBoardData = await kv.get<Lookboard>(`publicId:${publicId}`);
        if (!originalBoardData) {
            return response.status(404).json({ message: 'The board to copy was not found.' });
        }
        const originalBoard = typeof originalBoardData === 'string' ? JSON.parse(originalBoardData) : originalBoardData;

        const newBoard: Lookboard = {
            ...originalBoard,
            id: Date.now(),
            publicId: Math.random().toString(36).substring(2, 10),
            title: `${originalBoard.title} (Copy)`,
            createdBy: user.email,
            createdByUsername: user.username,
            visibility: 'private',
            createdAt: Date.now(),
        };
        
        const userBoardsKey = `lookboards:${user.email.toLowerCase()}`;
        const userBoards = await kv.get<Lookboard[]>(userBoardsKey) || [];
        await kv.set(userBoardsKey, [...userBoards, newBoard]);
        
        await kv.set(`publicId:${newBoard.publicId}`, newBoard);
        
        return response.status(201).json({ message: 'Board duplicated successfully.', newBoard });
    } catch (error) {
        console.error('Error duplicating board:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}

async function updateBoard(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { board, userEmail } = request.body as { board: Lookboard; userEmail: string; };
        if (!board || !userEmail) {
            return response.status(400).json({ message: 'Board data and user email are required.' });
        }

        const originalBoardData = await kv.get<Lookboard>(`publicId:${board.publicId}`);
        if (!originalBoardData) {
            return response.status(404).json({ message: 'Board not found.' });
        }
        const originalBoard = typeof originalBoardData === 'string' ? JSON.parse(originalBoardData) : originalBoardData;

        if (originalBoard.createdBy !== userEmail) {
            return response.status(403).json({ message: 'You do not have permission to edit this board.' });
        }

        const updatedBoard: Lookboard = { ...originalBoard, ...board };

        const userBoardsKey = `lookboards:${userEmail.toLowerCase()}`;
        const userBoards = await kv.get<Lookboard[]>(userBoardsKey) || [];

        const isOriginallyPublic = originalBoard.visibility === 'public';
        const isNowPublic = updatedBoard.visibility === 'public';
        
        const pipeline = kv.pipeline();

        if (isNowPublic) {
            pipeline.hset('public_lookboards_hash', { [String(updatedBoard.id)]: updatedBoard });
            if (!isOriginallyPublic) {
                const filteredUserBoards = userBoards.filter(b => b.id !== updatedBoard.id);
                pipeline.set(userBoardsKey, filteredUserBoards);
            }
        } else { // isNowPrivate
            pipeline.hdel('public_lookboards_hash', String(updatedBoard.id));
            if (isOriginallyPublic) {
                pipeline.set(userBoardsKey, [...userBoards, updatedBoard]);
            } else {
                const updatedUserBoards = userBoards.map(b => b.id === updatedBoard.id ? updatedBoard : b);
                pipeline.set(userBoardsKey, updatedUserBoards);
            }
        }

        pipeline.set(`publicId:${updatedBoard.publicId}`, updatedBoard);
        await pipeline.exec();

        return response.status(200).json({ message: 'Board updated successfully.' });

    } catch (error) {
        console.error('Error updating board:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}