import { GoogleGenAI } from "@google/genai";

// Fix: Per coding guidelines, the API key must be obtained exclusively from `process.env.API_KEY`.
// This change aligns with the project's API key handling policy and resolves the TypeScript error.
const apiKey = process.env.API_KEY;

if (!apiKey) {
  // The app cannot function without the API key. Throwing a clear error helps diagnose
  // deployment issues like a missing or incorrectly named environment variable.
  throw new Error("API_KEY is not defined in environment variables. Please ensure it is set.");
}

/**
 * Shared GoogleGenAI client instance.
 */
export const ai = new GoogleGenAI({ apiKey: apiKey });


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