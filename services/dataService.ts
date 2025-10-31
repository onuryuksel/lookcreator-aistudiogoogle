// FIX: Added `Model` to the import statement to resolve the TypeScript error "Cannot find name 'Model'".
import { Model, Look, Lookboard } from '../types';

// FIX: Drastically reduce chunk size. Look objects can contain large base64 images,
// so a smaller number of items per chunk is needed to stay under payload limits.
const CHUNK_SIZE = 10; // Number of items per chunk

const handleApiResponse = async (response: Response) => {
    const responseText = await response.text();
    if (!response.ok) {
        // If response is not OK, body might be plain text (e.g., from a proxy or server error)
        // Try to parse it as JSON, but fall back to the raw text
        try {
            const errorJson = JSON.parse(responseText);
            throw new Error(errorJson.message || 'An API error occurred');
        } catch (e) {
            // The error response was not JSON. Throw the raw text.
            // This will show "Request Entity Too Large" instead of a JSON parse error.
            throw new Error(responseText || `API Error: ${response.status} ${response.statusText}`);
        }
    }
    // If response is OK, we expect JSON. If it's empty, text is empty.
    return responseText ? JSON.parse(responseText) : {};
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

// --- Chunked Upload Functions for Large Data Import ---

const sendChunk = async (email: string, importId: string, chunkIndex: number, totalChunks: number, chunkType: 'looks' | 'lookboards' | 'models', data: any[]) => {
    const response = await fetch('/api/data-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, importId, chunkIndex, totalChunks, chunkType, data }),
    });
    return handleApiResponse(response);
};

const commitChunks = async (email: string, importId: string, chunkCounts: { models: number, looks: number, lookboards: number }) => {
    const response = await fetch('/api/data-commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, importId, chunkCounts }),
    });
    return handleApiResponse(response);
};

export const saveLargeData = async (email: string, models: Model[], looks: Look[], lookboards: Lookboard[]): Promise<void> => {
    const importId = `import-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const modelChunks = [];
    for (let i = 0; i < models.length; i += CHUNK_SIZE) {
        modelChunks.push(models.slice(i, i + CHUNK_SIZE));
    }
    
    const lookChunks = [];
    for (let i = 0; i < looks.length; i += CHUNK_SIZE) {
        lookChunks.push(looks.slice(i, i + CHUNK_SIZE));
    }

    const lookboardChunks = [];
    for (let i = 0; i < lookboards.length; i += CHUNK_SIZE) {
        lookboardChunks.push(lookboards.slice(i, i + CHUNK_SIZE));
    }

    const chunkCounts = {
        models: modelChunks.length,
        looks: lookChunks.length,
        lookboards: lookboardChunks.length,
    };
    
    // FIX: Process chunks sequentially to prevent overloading the server with concurrent requests
    // and to ensure each chunk is processed one by one, making the process more robust.
    for (let i = 0; i < modelChunks.length; i++) {
        await sendChunk(email, importId, i, chunkCounts.models, 'models', modelChunks[i]);
    }

    for (let i = 0; i < lookChunks.length; i++) {
        await sendChunk(email, importId, i, chunkCounts.looks, 'looks', lookChunks[i]);
    }

    for (let i = 0; i < lookboardChunks.length; i++) {
        await sendChunk(email, importId, i, chunkCounts.lookboards, 'lookboards', lookboardChunks[i]);
    }

    await commitChunks(email, importId, chunkCounts);
};