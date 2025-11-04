
import { kv } from '@vercel/kv';
import type { NextApiRequest, NextApiResponse } from 'next';
import { User } from '../types';
import crypto from 'crypto';

const ADMIN_EMAIL = 'oyouksel@altayer.com'; 

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    // FIX: Use bracket notation to access 'method' property to bypass potential TypeScript type resolution issues in some environments.
    if (request['method'] !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    const { action } = request.body;

    switch(action) {
        case 'signup':
            return await handleSignup(request, response);
        case 'login':
            return await handleLogin(request, response);
        default:
            return response.status(400).json({ message: 'Invalid or missing action.' });
    }
}

async function handleSignup(request: NextApiRequest, response: NextApiResponse) {
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

            // Send notification email to admin
            const resendApiKey = process.env.RESEND_API_KEY;
            if (resendApiKey) {
                try {
                    const emailPayload = {
                        from: 'Ounass Look Creator <onboarding@resend.dev>',
                        to: [ADMIN_EMAIL],
                        subject: 'New User Awaiting Approval',
                        html: `
                            <p>A new user has signed up for the Ounass Look Creator and is awaiting your approval.</p>
                            <p><strong>Username:</strong> ${username}</p>
                            <p><strong>Email:</strong> ${emailLower}</p>
                            <p>Please log in to the admin panel to approve their account.</p>
                        `,
                    };

                    const emailResponse = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${resendApiKey}`,
                        },
                        body: JSON.stringify(emailPayload),
                    });

                    if (!emailResponse.ok) {
                        const errorData = await emailResponse.json();
                        console.error('Failed to send approval notification email:', errorData);
                    } else {
                        console.log('Approval notification email sent successfully.');
                    }
                } catch (emailError) {
                    console.error('Error sending notification email via Resend:', emailError);
                }
            } else {
                console.warn('RESEND_API_KEY is not set. Skipping admin notification email.');
            }
        }

        return response.status(201).json({ message: 'User created successfully. Awaiting approval.' });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}

async function handleLogin(request: NextApiRequest, response: NextApiResponse) {
    try {
        const { email, password } = request.body;

        if (!email || !password) {
            return response.status(400).json({ message: 'Email and password are required' });
        }
        
        const emailLower = email.toLowerCase();
        const userKey = `user:${emailLower}`;
        const userData = await kv.get(userKey);

        if (!userData) {
            return response.status(404).json({ message: 'Invalid credentials' });
        }
        
        let user: User;
        if (typeof userData === 'string') {
            try {
                user = JSON.parse(userData);
            } catch (e) {
                console.error('Failed to parse user data string:', userData, e);
                return response.status(500).json({ message: 'Internal Server Error: Corrupted user data.' });
            }
        } else if (typeof userData === 'object' && userData !== null) {
            user = userData as User;
        } else {
            console.error('Unexpected user data type from KV:', typeof userData);
            return response.status(500).json({ message: 'Internal Server Error: Invalid user data format.' });
        }
        
        let isPasswordValid = false;
        let needsUpgrade = false;

        // Modern user with salt and hashed password
        if (user.salt && user.hashedPassword) {
            const hash = crypto.pbkdf2Sync(password, user.salt, 1000, 64, 'sha512').toString('hex');
            isPasswordValid = user.hashedPassword === hash;
        } 
        // Legacy user with plaintext password (no salt)
        else if (user.password) {
            isPasswordValid = user.password === password;
            if (isPasswordValid) {
                needsUpgrade = true;
            }
        }

        if (!isPasswordValid) {
            return response.status(401).json({ message: 'Invalid credentials' });
        }

        // If the legacy user's password was correct, upgrade their account to use hashing.
        if (needsUpgrade) {
            const newSalt = crypto.randomBytes(16).toString('hex');
            const newHashedPassword = crypto.pbkdf2Sync(password, newSalt, 1000, 64, 'sha512').toString('hex');
            user.salt = newSalt;
            user.hashedPassword = newHashedPassword;
            delete user.password; // Remove the old plaintext password
            await kv.set(userKey, JSON.stringify(user));
        }


        if (user.status !== 'approved') {
            return response.status(403).json({ message: 'Your account is pending approval.' });
        }

        // Clean up the user object before sending it to the client
        delete user.hashedPassword;
        delete user.salt;
        delete user.password;

        return response.status(200).json({ message: 'Login successful', user });

    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}
