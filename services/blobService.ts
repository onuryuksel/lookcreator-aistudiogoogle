import { upload } from '@vercel/blob/client';
import type { PutBlobResult } from '@vercel/blob';

/**
 * Uploads a file to Vercel Blob storage using the client-side `upload` helper.
 * This handles the entire flow:
 * 1. Pings the `/api/upload-blob` route to get a signed URL.
 * 2. Uploads the file to that URL.
 * 3. Waits for the upload to be confirmed and returns the final result.
 * @param file The Blob object to upload.
 * @param filename A unique name for the file.
 * @returns A promise that resolves to the permanent URL of the uploaded file.
 */
export const uploadFile = async (file: Blob, filename?: string): Promise<string> => {
    const uniqueFilename = filename || `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
        const newBlob: PutBlobResult = await upload(uniqueFilename, file, {
            access: 'public',
            // The API route that will handle the upload and generate the signed URL
            handleUploadUrl: '/api/upload-blob',
        });
        
        // The `upload` function returns the final blob result, which includes the public URL.
        return newBlob.url;

    } catch (error) {
        console.error('Error during file upload:', error);
        // Re-throw the original error to be handled by the calling function
        throw error;
    }
};