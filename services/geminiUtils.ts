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

/**
 * Fetches a resource from a URL and converts it to a data URL string.
 * This is a necessary step to get both the MIME type and the base64 data for the Gemini API.
 * @param url The URL of the resource to fetch (e.g., from Vercel Blob).
 * @returns A promise that resolves to a data URL string (e.g., "data:image/jpeg;base64,...").
 */
const urlToDataUrl = async (url: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch resource from URL: ${url}. Status: ${response.status}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Fetches an image from a URL and converts it into the GenerativePart format required by the Gemini API.
 * @param url The URL of the image to fetch.
 * @returns A promise that resolves to a GenerativePart object.
 */
export const urlToGenerativePart = async (url: string) => {
    const dataUrl = await urlToDataUrl(url);
    const mimeType = dataUrl.substring(dataUrl.indexOf(":") + 1, dataUrl.indexOf(";"));
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) {
        throw new Error(`Could not extract base64 data from URL: ${url}`);
    }
    return {
        inlineData: {
            data: base64Data,
            mimeType,
        },
    };
};

/**
 * Fetches a resource from a URL and returns just the raw base64 encoded data string.
 * This is specifically useful for APIs like Veo that require the raw base64 string.
 * @param url The URL of the resource to fetch.
 * @returns A promise that resolves to the raw base64 string (without the data URL prefix).
 */
export const urlToBase64 = async (url: string): Promise<string> => {
    const dataUrl = await urlToDataUrl(url);
    const base64Data = dataUrl.split(',')[1];
     if (!base64Data) {
        throw new Error(`Could not extract base64 data from URL: ${url}`);
    }
    return base64Data;
};