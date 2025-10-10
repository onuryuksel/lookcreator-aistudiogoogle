import { GoogleGenAI } from "@google/genai";

// FIX: Resolved TypeScript error `Property 'env' does not exist on type 'ImportMeta'`.
// Aligned with @google/genai guidelines by using `process.env.API_KEY` for the API key.
// This assumes the build environment is configured to expose this variable.
/**
 * Shared GoogleGenAI client instance.
 */
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


/**
 * Converts a list of File objects to Gemini's GenerativePart format.
 * @param files The array of File objects to convert.
 * @returns A promise that resolves to an array of GenerativeParts.
 */
export const filesToGenerativeParts = (files: File[]) => {
  return Promise.all(files.map(file => {
    return new Promise<{ inlineData: { mimeType: string; data: string } }>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64Data = dataUrl.split(',')[1];
        resolve({
            inlineData: {
            mimeType: file.type,
            data: base64Data,
            },
        });
        };
        reader.onerror = error => reject(error);
    });
  }));
};

/**
 * Converts a base64 string to Gemini's GenerativePart format.
 * @param base64Data The base64 encoded image string.
 * @param mimeType The MIME type of the image.
 * @returns A GenerativePart object.
 */
export const base64ToGenerativePart = (base64Data: string, mimeType: string = 'image/jpeg') => {
  return {
    inlineData: {
        data: base64Data.split(',')[1] || base64Data,
        mimeType
    }
  }
}