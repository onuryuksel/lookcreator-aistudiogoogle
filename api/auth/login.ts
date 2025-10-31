import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { User } from '../../types';

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    // 1. Ensure the request is a POST request
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // 2. Extract email and password from the request body
        const { email, password } = request.body;

        if (!email || !password) {
            return response.status(400).json({ message: 'Email and password are required' });
        }
        
        // 3. Fetch user data from the database using a standardized key
        const emailLower = email.toLowerCase();
        const userKey = `user:${emailLower}`;
        const userData = await kv.get<string>(userKey);

        if (!userData) {
            return response.status(404).json({ message: 'Invalid credentials' });
        }
        
        const user: User = JSON.parse(userData);

        // 4. Validate the password (NOTE: This is an insecure plaintext comparison for demo purposes)
        // WARNING: Comparing plaintext passwords. This is NOT secure and is for demo purposes only.
        const isPasswordValid = user.password === password;

        if (!isPasswordValid) {
            return response.status(401).json({ message: 'Invalid credentials' });
        }

        // 5. Check if the user's account has been approved by an admin
        if (user.status !== 'approved') {
            return response.status(403).json({ message: 'Your account is pending approval.' });
        }

        // 6. IMPORTANT: Remove password from the user object before sending it to the client
        delete user.password;

        // 7. Send a successful response with the user data
        return response.status(200).json({ message: 'Login successful', user });

    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}
