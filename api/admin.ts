import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { User, Look, Lookboard } from '../types';

// --- MAIN HANDLER ---
export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    // In a real app, you would add authentication here to ensure only admins can access this.

    if (request.method === 'GET') {
        const { action } = request.query;
        if (action === 'get-pending-users') {
            return await getPendingUsers(request, response);
        }
        return response.status(400).json({ message: 'Invalid action for GET request.' });
    }

    if (request.method === 'POST') {
        const { action } = request.body;
        switch (action) {
            case 'approve-user':
                return await approveUser(request, response);
            case 'migrate-looks':
                return await migrateLooks(request, response);
            case 'reindex-boards':
                return await reindexBoards(request, response);
            default:
                return response.status(400).json({ message: 'Invalid or missing action for POST request.' });
        }
    }
    
    return response.status(405).json({ message: 'Method Not Allowed' });
}


// --- ACTION HANDLERS ---

async function getPendingUsers(request: NextApiRequest, response: NextApiResponse) {
    try {
        const pendingEmails = await kv.smembers('pending_users');
        if (!pendingEmails || pendingEmails.length === 0) {
            return response.status(200).json({ users: [] });
        }

        const userKeys = pendingEmails.map(email => `user:${email}`);
        const usersData = await kv.mget(...userKeys);
        
        const users = usersData
            .filter(Boolean)
            .map(userData => {
                let user: User;
                if (typeof userData === 'string') {
                    try { user = JSON.parse(userData); } catch (e) { return null; }
                } else if (typeof userData === 'object' && userData !== null) {
                    user = userData as User;
                } else {
                    return null;
                }
                delete user.hashedPassword;
                delete user.salt;
                return user;
            })
            .filter((user): user is User => user !== null);

        return response.status(200).json({ users });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}

async function approveUser(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { email } = request.body;
        if (!email) {
            return response.status(400).json({ message: 'Email is required' });
        }

        const emailLower = email.toLowerCase();
        const userKey = `user:${emailLower}`;
        const userData = await kv.get(userKey);

        if (!userData) {
            return response.status(404).json({ message: 'User not found' });
        }

        let user: User;
        if (typeof userData === 'string') {
            user = JSON.parse(userData);
        } else if (typeof userData === 'object' && userData !== null) {
            user = userData as User;
        } else {
            return response.status(500).json({ message: 'Internal server error: Corrupted user data' });
        }

        user.status = 'approved';

        await kv.set(userKey, JSON.stringify(user));
        await kv.srem('pending_users', emailLower);

        return response.status(200).json({ message: `User ${emailLower} approved successfully.` });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}

async function migrateLooks(request: NextApiRequest, response: NextApiResponse) {
    const ADMIN_EMAIL = 'oyouksel@altayer.com';
    const ADMIN_USERNAME = 'Ounass Admin';
    
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
            if (!userLooks || !Array.isArray(userLooks)) return;

            const currentLookKey = lookKeys[index];
            let needsUpdate = false;
            const updatedLooksForUser = userLooks.map(look => {
                if (look && typeof look === 'object' && !('visibility' in look)) {
                    migratedCount++;
                    needsUpdate = true;
                    const migratedLook: Look = {
                        ...(look as Look),
                        visibility: 'public',
                        createdBy: ADMIN_EMAIL,
                        createdByUsername: ADMIN_USERNAME,
                    };
                    publicLooksToUpdate[String(migratedLook.id)] = migratedLook;
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
        if (Object.keys(publicLooksToUpdate).length > 0) {
            pipeline.hset('public_looks_hash', publicLooksToUpdate);
        }
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

async function reindexBoards(request: NextApiRequest, response: NextApiResponse) {
    try {
        const userKeys = await kv.keys('user:*');
        if (userKeys.length === 0) {
            return response.status(200).json({ message: 'No users found to process.' });
        }
        
        const lookboardKeys = userKeys.map(key => key.replace('user:', 'lookboards:'));
        const allUsersBoardsData: (Lookboard[] | null)[] = lookboardKeys.length > 0 ? await kv.mget(...lookboardKeys) : [];
        const publicBoardsMap = await kv.hgetall<Record<string, Lookboard>>('public_lookboards_hash');
        
        const allBoards = new Map<number, Lookboard>();

        // Add private boards
        allUsersBoardsData.forEach(userBoards => {
            if (userBoards && Array.isArray(userBoards)) {
                userBoards.forEach(board => {
                    if (board && board.id) allBoards.set(board.id, board);
                });
            }
        });

        // Add public boards, overwriting any duplicates
        if (publicBoardsMap) {
            Object.values(publicBoardsMap).forEach(boardData => {
                if (!boardData) return;
                const board: Lookboard = typeof boardData === 'string' ? JSON.parse(boardData) : boardData;
                if (board && typeof board.id === 'number') {
                    allBoards.set(board.id, board);
                }
            });
        }

        if (allBoards.size === 0) {
             return response.status(200).json({ message: 'No lookboards found to index.' });
        }

        const publicIdIndexMap: Record<string, string> = {};
        allBoards.forEach(board => {
             if (board.publicId) {
                publicIdIndexMap[`publicId:${board.publicId}`] = JSON.stringify(board);
            }
        });

        if (Object.keys(publicIdIndexMap).length > 0) {
            await kv.mset(publicIdIndexMap);
        }

        return response.status(200).json({ message: `Successfully indexed ${Object.keys(publicIdIndexMap).length} lookboard share links.` });

    } catch (error) {
        console.error('Error during lookboard re-indexing:', error);
        return response.status(500).json({ message: 'Internal Server Error during re-indexing.' });
    }
}
