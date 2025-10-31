/**
 * Converts a base64 string (with or without a data-url prefix) into a Blob object.
 * It intelligently parses the MIME type from the data-url if present.
 * @param base64 The base64 encoded string.
 * @param fallbackContentType Optional. The MIME type to use if one cannot be determined from the base64 string.
 * @returns A promise that resolves to a Blob object.
 */
export const base64toBlob = (base64: string, fallbackContentType: string = ''): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        try {
            // Check for data URL prefix and capture content type and base64 data
            const parts = base64.match(/^data:(.*?);base64,(.*)$/);
            
            const base64Data = parts ? parts[2] : base64;
            const contentType = parts ? parts[1] : fallbackContentType;

            if (!contentType) {
                 console.warn('Could not determine content type for base64 string. Blob may be invalid.');
            }

            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: contentType });
            resolve(blob);
        } catch (error) {
            console.error("Failed to convert base64 to Blob:", error);
            reject(new Error("Invalid base64 string provided for Blob conversion."));
        }
    });
};
