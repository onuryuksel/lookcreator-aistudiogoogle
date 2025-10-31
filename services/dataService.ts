// FIX: Added `Model` to the import statement to resolve the TypeScript error "Cannot find name 'Model'".
import { Model, Look, Lookboard, LegacyLook, OunassSKU } from '../types';
import * as db from './dbService';
import * as ounassService from './ounassService';


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

export const importLegacyLooks = async (
    fileContent: string,
    models: Model[]
): Promise<Look[]> => {
    if (models.length === 0) {
        throw new Error("Cannot import: No models are available to assign to the new looks. Please create a model first.");
    }
    const defaultModel = models[0];

    let parsedJson;
    try {
        parsedJson = JSON.parse(fileContent);
    } catch (e) {
        throw new Error("Invalid import file format. Could not parse JSON.");
    }

    let looksToProcess: any[];
    if (Array.isArray(parsedJson)) {
        looksToProcess = parsedJson;
    } else if (parsedJson && typeof parsedJson === 'object' && 'looks' in parsedJson && Array.isArray((parsedJson as {looks: unknown[]}).looks)) {
        looksToProcess = (parsedJson as {looks: unknown[]}).looks;
    } else {
        throw new Error("Invalid import file format. Expected a JSON array of looks, or an object containing a 'looks' array.");
    }
    
    if (!Array.isArray(looksToProcess)) {
         throw new Error("Invalid import file format. The 'looks' property must be an array.");
    }

    const importedLooks: Look[] = [];

    // Process sequentially to avoid potential rate-limiting on the Ounass API
    for (const lookData of looksToProcess) {
        if (!lookData || typeof lookData !== 'object' || !lookData.finalImage) {
            console.warn("Skipping invalid look object (missing finalImage):", lookData);
            continue;
        }

        let skusToFetch: string[] = [];

        // FIX: Handle both legacy format (productSkus) and current format (products array)
        if (Array.isArray(lookData.products)) {
            // Current format: extract SKUs from product objects
            skusToFetch = lookData.products
                .map((p: any) => p && typeof p === 'object' && typeof p.sku === 'string' ? p.sku : null)
                .filter((sku): sku is string => !!sku);
        } else if (Array.isArray(lookData.productSkus)) {
            // Legacy format: use the array of SKU strings directly
            skusToFetch = lookData.productSkus.filter((s: any) => typeof s === 'string');
        }


        const productData = (await Promise.all(
            skusToFetch.map(sku => ounassService.fetchSkuData(sku))
        )).filter((p): p is OunassSKU => p !== null);

        if (skusToFetch.length > 0 && productData.length < skusToFetch.length) {
             console.warn(`Could not find all products for a legacy look. Found ${productData.length}/${skusToFetch.length} SKUs.`);
        }

        const newLook: Look = {
            id: db.generateId(),
            model: defaultModel,
            products: productData,
            finalImage: lookData.finalImage,
            variations: Array.isArray(lookData.variations) ? lookData.variations : [],
            createdAt: Date.now(),
        };
        importedLooks.push(newLook);
    }
    
    return importedLooks;
};
