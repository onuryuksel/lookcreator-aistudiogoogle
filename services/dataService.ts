import { Look, Lookboard } from '../types';

const handleApiResponse = async (response: Response) => {
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'An API error occurred');
    }
    return data;
};

export const fetchServerData = async (email: string): Promise<{ looks: Look[], lookboards: Lookboard[] }> => {
    const response = await fetch(`/api/data?email=${encodeURIComponent(email)}`);
    return handleApiResponse(response);
};

export const saveServerData = async (email: string, looks: Look[], lookboards: Lookboard[]): Promise<void> => {
    const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, looks, lookboards }),
    });
    await handleApiResponse(response);
};
