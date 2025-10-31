import { User } from '../types';

const handleResponse = async (response: Response) => {
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'An error occurred');
    }
    return data;
};

export const signup = async (username: string, email: string, password: string): Promise<void> => {
    const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
    });
    await handleResponse(response);
};

export const login = async (email: string, password: string): Promise<User> => {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const { user } = await handleResponse(response);
    return user;
};

export const getPendingUsers = async (): Promise<User[]> => {
    const response = await fetch('/api/admin/users');
    const { users } = await handleResponse(response);
    return users;
};

export const approveUser = async (email: string): Promise<void> => {
    const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    await handleResponse(response);
};

export const migrateLegacyLooks = async (): Promise<{ message: string }> => {
    const response = await fetch('/api/admin/migrate-looks', {
        method: 'POST',
    });
    return handleResponse(response);
};

export const generateTagsForUntaggedLooks = async (): Promise<{ message: string }> => {
    const response = await fetch('/api/admin/generate-tags', {
        method: 'POST',
    });
    return handleResponse(response);
};