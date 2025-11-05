// FIX: Added `Model` to the import statement to resolve the TypeScript error "Cannot find name 'Model'".
import { Model, Look, Lookboard, LegacyLook, OunassSKU, User, LookOverrides, MainImageProposal } from '../types';
import * as db from './dbService';
import * as ounassService from './ounassService';
import { base64toBlob } from '../utils';
import * as blobService from './blobService';


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

export const fetchServerData = async (email: string): Promise<{ looks: Look[], lookboards: Lookboard[], overrides: LookOverrides, proposals: Record<number, MainImageProposal[]> }> => {
    const response = await fetch(`/api/data?email=${encodeURIComponent(email)}`);
    return handleApiResponse(response);
};

export const saveOverrides = async (
    email: string, 
    overrides: LookOverrides, 
    changeInfo?: { lookId: number, creatorEmail: string, newFinalImage: string | null, username: string }
): Promise<void> => {
    const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'save-overrides', // API consolidation
            email, 
            overrides,
            changeInfo, // NEW: Pass specific change info for proposal logic
        }),
    });
    await handleApiResponse(response);
};

export const acceptMainImageProposal = async (lookId: number, proposal: MainImageProposal, userEmail: string): Promise<{ updatedLook: Look }> => {
    const response = await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'accept-main-image-proposal',
            lookId,
            proposal,
            userEmail,
        }),
    });
    return handleApiResponse(response);
};


// This is the main save function, it replaces the old saveServerData
export const saveLargeData = async (email: string, models: Model[], looks: Look[], lookboards: Lookboard[], overrides: LookOverrides): Promise<void> => {
     // The new /api/data endpoint handles the logic of public/private looks and can handle the full payload.
     // The chunking logic is now primarily for massive imports. For regular saves, a direct call is better.
     // However, to avoid a major refactor, we will continue to use the chunking flow,
     // but the backend commit logic is now much smarter.
    const importId = `import-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const lookChunks = [];
    for (let i = 0; i < looks.length; i += CHUNK_SIZE) {
        lookChunks.push(looks.slice(i, i + CHUNK_SIZE));
    }

    const lookboardChunks = [];
    for (let i = 0; i < lookboards.length; i += CHUNK_SIZE) {
        lookboardChunks.push(lookboards.slice(i, i + CHUNK_SIZE));
    }

    const chunkCounts = {
        looks: lookChunks.length,
        lookboards: lookboardChunks.length,
    };
    
    for (let i = 0; i < lookChunks.length; i++) {
        await sendChunk(email, importId, i, chunkCounts.looks, 'looks', lookChunks[i]);
    }

    for (let i = 0; i < lookboardChunks.length; i++) {
        await sendChunk(email, importId, i, chunkCounts.lookboards, 'lookboards', lookboardChunks[i]);
    }

    await commitChunks(email, importId, chunkCounts, overrides);
};

const sendChunk = async (email: string, importId: string, chunkIndex: number, totalChunks: number, chunkType: 'looks' | 'lookboards', data: any[]) => {
    const response = await fetch('/api/data', { // API consolidation
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            action: 'save-chunk', // API consolidation
            email, 
            importId, 
            chunkIndex, 
            totalChunks, 
            chunkType, 
            data 
        }),
    });
    return handleApiResponse(response);
};

const commitChunks = async (email: string, importId: string, chunkCounts: { looks: number, lookboards: number }, overrides: LookOverrides) => {
    const response = await fetch('/api/data', { // API consolidation
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            action: 'commit-chunks', // API consolidation
            email, 
            importId, 
            chunkCounts, 
            overrides 
        }),
    });
    return handleApiResponse(response);
};

export const importLegacyLooks = async (
    fileContent: string,
    models: Model[],
    user: User
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

        const finalImageBlob = await base64toBlob(lookData.finalImage);
        const finalImageUrl = await blobService.uploadFile(finalImageBlob, `legacy-import-${db.generateId()}.png`);

        const variationUrls: string[] = [];
        if (Array.isArray(lookData.variations)) {
            for (const variationBase64 of lookData.variations) {
                if (typeof variationBase64 === 'string' && variationBase64.startsWith('data:image')) {
                    try {
                        const variationBlob = await base64toBlob(variationBase64);
                        const variationUrl = await blobService.uploadFile(variationBlob, `legacy-variation-${db.generateId()}.png`);
                        variationUrls.push(variationUrl);
                    } catch (error) {
                        console.warn("Skipping invalid variation image during import:", error);
                    }
                }
            }
        }


        let skusToFetch: string[] = [];

        if (Array.isArray(lookData.products)) {
            skusToFetch = lookData.products
                .map((p: any) => p && typeof p === 'object' && typeof p.sku === 'string' ? p.sku : null)
                .filter((sku): sku is string => !!sku);
        } else if (Array.isArray(lookData.productSkus)) {
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
            finalImage: finalImageUrl,
            variations: variationUrls,
            createdAt: Date.now(),
            visibility: 'private', // Imported looks are private by default
            createdBy: user.email,
            createdByUsername: user.username,
        };
        importedLooks.push(newLook);
    }
    
    return importedLooks;
};