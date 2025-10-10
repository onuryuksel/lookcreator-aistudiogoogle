/**
 * A list of proxy URL formatter functions.
 * Each function takes a target URL and returns a full, proxied URL.
 * This approach allows handling proxies with different URL structures.
 */
const PROXIES: ((targetUrl: string) => string)[] = [
    // Proxy 1: corsproxy.io (fast, requires raw URL, not encoded)
    (targetUrl: string) => `https://corsproxy.io/?${targetUrl}`,
    
    // Proxy 2: allorigins.win (generally reliable)
    (targetUrl: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,

    // Proxy 3: thingproxy.freeboard.io (another option)
    (targetUrl: string) => `https://thingproxy.freeboard.io/fetch/${targetUrl}`,

    // Proxy 4: codetabs.com (last resort)
    (targetUrl: string) => `https://api.codetabs.com/v1/proxy?quest=${targetUrl}`,
];

/**
 * Attempts to fetch a resource using a series of CORS proxies as fallbacks.
 * It will try each proxy in the PROXIES list until one succeeds.
 * @param targetUrl The original URL of the resource to fetch.
 * @param fetchOptions Optional fetch options.
 * @param expectedType The expected content type ('json' or 'image') to validate against.
 * @returns A Promise that resolves to the successful Response object.
 * @throws An error if all proxies fail.
 */
export const fetchWithFallbacks = async (
    targetUrl: string, 
    fetchOptions?: RequestInit,
    expectedType: 'json' | 'image' = 'json'
): Promise<Response> => {
    let lastError: Error | null = null;

    for (let i = 0; i < PROXIES.length; i++) {
        const formatProxyUrl = PROXIES[i];
        const proxiedUrl = formatProxyUrl(targetUrl);
        
        try {
            const response = await fetch(proxiedUrl, fetchOptions);
            
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            
            if (expectedType === 'json') {
                // To safely read the body for both parsing and potential error logging,
                // we read it as text first. This consumes the response body.
                const responseText = await response.text();
                try {
                    JSON.parse(responseText);
                    // If parsing succeeds, we must return a new Response object
                    // because the original response body has been consumed by .text().
                    return new Response(responseText, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                    });
                } catch (e) {
                    throw new Error(`Response could not be parsed as JSON.`);
                }
            } else if (expectedType === 'image') {
                // For images, the content-type header is a more reliable check.
                if (!contentType || !contentType.startsWith('image/')) {
                    throw new Error(`Invalid content type. Expected an image, got '${contentType}'`);
                }
                return response;
            }
            
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw new Error(`All proxies failed to fetch the resource. Last error: ${lastError?.message || 'Unknown fetch error'}`);
};