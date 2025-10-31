import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { User } from '../types';
import crypto from 'crypto';

// IMPORTANT: Set your admin email here. The first user to sign up with this email gets admin privileges.
const ADMIN_EMAIL = 'oyouksel@altayer.com'; 

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { username, email, password } = request.body;

        if (!username || !email || !password) {
            return response.status(400).json({ message: 'Missing required fields' });
        }

        const emailLower = email.toLowerCase();
        const userKey = `user:${emailLower}`;
        const existingUser = await kv.get(userKey);

        if (existingUser) {
            return response.status(409).json({ message: 'User with this email already exists' });
        }

        const isFirstAdmin = emailLower === ADMIN_EMAIL.toLowerCase();

        // Securely hash the password
        const salt = crypto.randomBytes(16).toString('hex');
        const hashedPassword = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

        const newUser: User = {
            username,
            email: emailLower,
            hashedPassword,
            salt,
            status: isFirstAdmin ? 'approved' : 'pending',
            role: isFirstAdmin ? 'admin' : 'user',
            createdAt: Date.now(),
        };

        await kv.set(userKey, JSON.stringify(newUser));
        if (!isFirstAdmin) {
            await kv.sadd('pending_users', emailLower);
        }

        return response.status(201).json({ message: 'User created successfully. Awaiting approval.' });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}