import { put } from '@vercel/blob';

/**
 * Uploads a file to Vercel Blob storage.
 * @param file The Blob object to upload.
 * @param filename A unique name for the file.
 * @returns A promise that resolves to the permanent URL of the uploaded file.
 */
export const uploadFile = async (file: Blob, filename?: string): Promise<string> => {
    const uniqueFilename = filename || `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
        const response = await fetch(`/api/upload-blob?filename=${uniqueFilename}`, {
            method: 'POST',
        });

        const newBlob = await response.json();

        if (!newBlob.url) {
            throw new Error('Failed to get a signed upload URL from the server.');
        }

        const result = await fetch(newBlob.url, {
            method: 'PUT',
            body: file,
            headers: {
                // Vercel Blob's signed URL for PUT requires this header.
                'x-vercel-blob-headers': 'x-ms-blob-type=BlockBlob',
            },
        });
        
        if (!result.ok) {
            throw new Error(`Failed to upload file to Vercel Blob. Status: ${result.status}`);
        }

        // The permanent URL is different from the temporary signed upload URL.
        // We can construct it based on the `pathname`.
        return newBlob.pathname;

    } catch (error) {
        console.error('Error during file upload:', error);
        throw error;
    }
};
