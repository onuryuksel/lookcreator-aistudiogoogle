import { OunassSKU } from '../types';
import { fetchWithFallbacks } from './proxyService';

const OUNASS_API_BASE_URL = 'https://www.ounass.ae/product/findbysku?sku=';
export const IMAGE_BASE_URL = 'https://ounass-ae.atgcdn.ae/pub/media/catalog/product';

export const fetchSkuData = async (sku: string): Promise<OunassSKU | null> => {
  const targetUrl = `${OUNASS_API_BASE_URL}${sku}`;
  
  try {
    const response = await fetchWithFallbacks(targetUrl);
    const data = await response.json();

    // FIX: The validation check was incorrect. The API response uses `entityId` or `sku`, not a top-level `id`.
    if (data && data.entityId && data.sku) {
        
        const formattedMedia = data.media.map((m: { src: string }) => ({
            ...m,
            src: `${IMAGE_BASE_URL}${m.src}`
        }));

        // FIX: Update 'sizeAndFit' parsing to handle multiple response formats from the API.
        // The API can return an array of objects OR an HTML string.
        const rawSizeAndFit = data.sizeAndFit;
        let parsedSizeAndFit: string[] = [];
        
        if (Array.isArray(rawSizeAndFit) && rawSizeAndFit.length > 0 && rawSizeAndFit[0]?.values && Array.isArray(rawSizeAndFit[0].values)) {
            // Case 1: Handle format: [{ "label": "...", "values": ["...", "..."] }]
            parsedSizeAndFit = rawSizeAndFit[0].values;
        } else if (typeof rawSizeAndFit === 'string') {
            // Case 2: Handle format: "<p>• Width: 36cm</p>\n<p>• Height: 28cm</p>..."
            parsedSizeAndFit = rawSizeAndFit
                .replace(/<p>/g, '\n')       // Replace opening <p> with a newline
                .replace(/<\/p>/g, '')      // Remove closing </p>
                .split('\n')                // Split into an array of lines
                .map(line => line.replace(/•/g, '').trim()) // Remove bullet points and trim whitespace
                .filter(line => line.length > 0); // Filter out any resulting empty lines
        }

        // Manually construct the OunassSKU object to match our type definition
        // and correctly handle nested properties from the API response.
        const productData: OunassSKU = {
            id: data.entityId, // Map entityId to id
            sku: data.sku,
            name: data.name,
            urlKey: data.slug, // Map slug to urlKey
            initialPrice: data.initialPrice,
            minPriceInAED: data.minPriceInAED,
            media: formattedMedia,
            sizesInHomeDeliveryStock: data.sizesInHomeDeliveryStock || [],
            sizeAndFit: parsedSizeAndFit,
            // Extract from top-level or the nested analytics object for robustness
            division: data.analytics?.division || 'N/A',
            productClass: data.productClass || data.analytics?.productClass || 'N/A',
            color: data.color || data.analytics?.color || 'N/A',
            subClass: data.analytics?.subClass || 'N/A',
            season: data.season || data.analytics?.season || 'N/A',
            designer: data.designer || data.analytics?.designer || 'N/A',
            department: data.department || data.analytics?.department || 'N/A',
            class: data.analytics?.class || 'N/A',
            group: data.analytics?.group || 'N/A',
            brand: data.analytics?.brand || 'N/A',
        };

        return productData;
    }
    
    console.warn(`[Ounass Service] SKU ${sku} not found in response data or data is malformed. Response received:`, data);
    return null;

  } catch (error) {
    console.error(`[Ounass Service] Critical error fetching SKU data for ${sku}:`, error);
    if (error instanceof SyntaxError) {
        console.error("[Ounass Service] This is a JSON parsing error. The proxy might have returned non-JSON content (e.g., an HTML error page).");
    }
    return null;
  }
};