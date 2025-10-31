/**
 * Converts a base64 string (with or without a data-url prefix) into a Blob object.
 * @param base64 The base64 encoded string.
 * @param contentType The MIME type of the data (e.g., 'image/jpeg', 'video/mp4').
 * @returns A promise that resolves to a Blob object.
 */
export const base64toBlob = (base64: string, contentType: string = ''): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        // Strip data-url prefix if it exists
        const base64Data = base64.split(',')[1] || base64;
        
        try {
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: contentType });
            resolve(blob);
        } catch (error) {
            reject(error);
        }
    });
};
