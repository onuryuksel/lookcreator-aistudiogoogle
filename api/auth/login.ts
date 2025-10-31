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

    try {
        const { email, password } = request.body;

        if (!email || !password) {
            return response.status(400).json({ message: 'Email and password are required' });
        }
        
        const emailLower = email.toLowerCase();
        const userKey = `user:${emailLower}`;
        const userData = await kv.get<string>(userKey);

        if (!userData) {
            return response.status(404).json({ message: 'Invalid credentials' });
        }
        
        // FIX: Simplified type declaration now that `password` is an optional field on `User`.
        const user: User = JSON.parse(userData);

        // WARNING: Comparing plaintext passwords. This is NOT secure and is for demo purposes only.
        // In production, use a library like bcrypt to compare hashed passwords.
        // const isPasswordValid = await bcrypt.compare(password, user.password);
        const isPasswordValid = user.password === password;

        if (!isPasswordValid) {
            return response.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.status !== 'approved') {
            return response.status(403).json({ message: 'Your account is pending approval.' });
        }

        // Remove password before sending user object to client
        delete user.password;

        return response.status(200).json({ message: 'Login successful', user });

    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}