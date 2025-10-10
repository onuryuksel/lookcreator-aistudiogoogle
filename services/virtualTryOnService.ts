import { Modality } from '@google/genai';
import { OunassSKU, Model } from '../types';
import { ai, base64ToGenerativePart } from './geminiUtils';

const getProductImageAsBase64 = async (imageUrl: string): Promise<{ base64: string; mimeType: string }> => {
    try {
        // FIX: The Ounass image CDN (ounass-ae.atgcdn.ae) allows cross-origin requests.
        // Fetching the image directly is significantly more reliable than relying on
        // third-party CORS proxies, which were the source of intermittent "Failed to fetch" errors.
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Image request failed: ${response.status} ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            throw new Error(`Invalid content type. Expected an image, got '${contentType}'`);
        }

        const blob = await response.blob();
        const reader = new FileReader();

        return new Promise((resolve, reject) => {
            reader.onloadend = () => {
                if (reader.error) {
                    return reject(new Error("Failed to read image file."));
                }
                const base64 = (reader.result as string).split(',')[1];
                resolve({ base64, mimeType: blob.type });
            };
            reader.onerror = (error) => reject(new Error(`FileReader error: ${error}`));
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error(`[Image Service] Failed to fetch or process product image at ${imageUrl}:`, error);
        // Re-throw a user-friendly error that will be displayed in the UI.
        throw new Error(`Could not download product image. This might be a network issue or the image URL is invalid.`);
    }
};

type ProductCategory = 'Base Top' | 'Layerable Top' | 'Outerwear' | 'Bottoms' | 'Full Body' | 'Shoes' | 'Accessory';

// Helper sets based on the provided CSV data for robust categorization.
const SHOES_CLASSES = new Set(['sneakers', 'heels', 'flats', 'sandals', 'boots', 'slip on', 'lace ups', 'espadrilles', 'pumps', 'footwear']);
const FULL_BODY_CLASSES = new Set(['dresses', 'jumpsuits', 'rompers', 'all in ones', 'abayas', 'kaftan', 'evening dress', 'beachwear', 'multi piece sets', 'sets', 'tracksuits', 'sleepwear', 'loungewear', 'dungarees']);
const OUTERWEAR_CLASSES = new Set(['outerwear', 'blazers', 'jacket', 'jackets', 'coat', 'coats']);
const BOTTOMS_CLASSES = new Set(['trousers', 'shorts', 'skirts', 'denim', 'jeans']);
const LAYERABLE_TOP_CLASSES = new Set(['shirts', 'sweatshirts', 'knitwear']);
const BASE_TOP_CLASSES = new Set(['t shirts', 'tops', 'polos', 'bodysuits', 't-shirt', 't shirt', 'sweatshirt']); // A sweatshirt can be a base or layer; base is a safer default.
const ACCESSORY_CLASSES = new Set(['jewellery', 'small leather goods', 'hats', 'sunglasses', 'belts', 'soft accessories', 'bags', 'cross body', 'tote bags', 'clutches']);

/**
 * Classifies a product into a logical category for styling decisions, using extensive
 * keywords from product data analysis. This helps determine whether an item should
 * be layered or should replace an existing item.
 */
const getProductCategory = (product: OunassSKU): ProductCategory => {
    const productClass = product.productClass.toLowerCase(); // e.g., 'Clothing', 'Shoes'
    const itemClass = product.class.toLowerCase();       // e.g., 'Dresses', 'T Shirts'
    const name = product.name.toLowerCase();

    // Priority 1: Check non-clothing top-level classes first for a quick exit.
    if (productClass.includes('shoes') || SHOES_CLASSES.has(itemClass)) {
        return 'Shoes';
    }
    if (productClass.includes('bags') || productClass.includes('accessories') || productClass.includes('jewellery') || ACCESSORY_CLASSES.has(itemClass)) {
        return 'Accessory';
    }

    // Priority 2: Disambiguate within 'Clothing' using specific keywords in the name, which are often more descriptive than the class.
    if (OUTERWEAR_CLASSES.has(itemClass) || name.includes('jacket') || name.includes('coat') || name.includes('blazer')) {
        return 'Outerwear';
    }
    if (FULL_BODY_CLASSES.has(itemClass) || name.includes('dress') || name.includes('jumpsuit') || name.includes('romper') || name.includes('abaya')) {
        return 'Full Body';
    }
    // A "denim shirt" should be a top, not bottoms. Check for "shirt" in name before checking for "denim" in class.
    if (name.includes('shirt') && !name.includes('t-shirt')) {
        return 'Layerable Top';
    }

    // Priority 3: Use the item class for common clothing types.
    if (BOTTOMS_CLASSES.has(itemClass)) {
        return 'Bottoms';
    }
    if (LAYERABLE_TOP_CLASSES.has(itemClass)) {
        return 'Layerable Top';
    }
    if (BASE_TOP_CLASSES.has(itemClass)) {
        return 'Base Top';
    }

    // Priority 4: Fallbacks. If it's in the 'Clothing' class but hasn't been categorized, it's most likely a top.
    if (productClass.includes('clothing')) {
        return 'Base Top';
    }

    // Default fallback for anything that slips through.
    return 'Accessory';
}


export const performVirtualTryOn = async (
  baseModelImage: string,
  selectedModel: Model,
  newProduct: OunassSKU,
  previousProducts: OunassSKU[]
): Promise<string> => {

    const previousProductsList = previousProducts.length > 0
        ? previousProducts.map(p => `- ${p.name} (${getProductCategory(p)})`).join('\n')
        : 'None';
        
    // --- START: Refined Dynamic Placement Instruction ---
    let placementInstruction = '';
    const newProductCategory = getProductCategory(newProduct);

    const existingBaseTop = previousProducts.find(p => getProductCategory(p) === 'Base Top');
    const existingBottoms = previousProducts.find(p => getProductCategory(p) === 'Bottoms');
    const existingClothing = previousProducts.filter(p => getProductCategory(p) !== 'Shoes' && getProductCategory(p) !== 'Accessory');
    const baseClothing = selectedModel.gender === 'Male' ? 'his skin-tone matching t-shirt and shorts' : 'her bodysuit';

    if (newProductCategory === 'Shoes') {
        placementInstruction = `REPLACE the model's bare feet with the new shoes: '${newProduct.name}'.`;
    } else if (newProductCategory === 'Accessory') {
        placementInstruction = `ADD the new accessory, '${newProduct.name}', to the model's look.`;
    } else if (newProductCategory === 'Outerwear' || newProductCategory === 'Layerable Top') {
        placementInstruction = `ADD the new '${newProduct.name}' over the model's current clothing. The existing clothes underneath should remain visible if the new item is open (like an open jacket or shirt).`;
    } else if (newProductCategory === 'Base Top') {
        if (existingBaseTop) {
            placementInstruction = `REPLACE the existing top ('${existingBaseTop.name}') with the new top ('${newProduct.name}').`;
        } else {
            placementInstruction = `DRESS the model in the new top, '${newProduct.name}', replacing the upper part of ${baseClothing}.`;
        }
    } else if (newProductCategory === 'Bottoms') {
        if (existingBottoms) {
            placementInstruction = `REPLACE the existing bottoms ('${existingBottoms.name}') with the new bottoms ('${newProduct.name}').`;
        } else {
            placementInstruction = `DRESS the model in the new bottoms, '${newProduct.name}', replacing the lower part of ${baseClothing}.`;
        }
    } else if (newProductCategory === 'Full Body') {
        if (existingClothing.length > 0) {
            placementInstruction = `REMOVE all existing clothing and DRESS the model in the new item: '${newProduct.name}'.`;
        } else {
            placementInstruction = `DRESS the model in the new item, '${newProduct.name}', replacing ${baseClothing}.`;
        }
    } else { // Fallback for uncategorized clothing
        placementInstruction = `ADD the new product, '${newProduct.name}', to the model's look.`;
    }
    // --- END: Refined Dynamic Placement Instruction ---
        
    const imageGenPrompt = `
You are a world-class fashion stylist and photo editor specializing in hyper-realistic virtual try-ons.

**Primary Task:**
${placementInstruction}

**Image Analysis:**
- **Base Image:** A full-body photo of a model.
- **Product Image:** A photo of the new product to be added.

**Critical Directives:**
1.  **Identity Preservation:** The model's face, body shape, hair, pose, skin tone, and the studio background MUST remain IDENTICAL to the base image. DO NOT alter the model's identity.
2.  **Item Fidelity:** The new product ('${newProduct.name}') MUST be an EXACT, photorealistic replica of the product image. Replicate its color, texture, fit, drape, and details (buttons, seams, logos) with perfect accuracy.
3.  **Contextual Integrity:** The model is already wearing these items, which must be perfectly preserved unless being replaced by the primary task:
    ${previousProductsList}
4.  **Seamless Integration:** The final image must be a single, cohesive, photorealistic image. Ensure realistic lighting, shadows, and interaction between the new clothing and the model's body.

**Final Output:**
Return ONLY the complete, full-body, modified image.
`.trim();

    console.log('[Virtual Try-On] Using refined image generation prompt:', imageGenPrompt);

    // Fetch product image and convert to GenerativePart
    const productImageUrl = newProduct.media[0]?.src;
    if (!productImageUrl) {
        throw new Error(`No image found for SKU ${newProduct.sku}`);
    }
    const { base64: productBase64, mimeType: productMimeType } = await getProductImageAsBase64(productImageUrl);

    const modelImagePart = base64ToGenerativePart(baseModelImage, 'image/jpeg');
    const productImagePart = base64ToGenerativePart(productBase64, productMimeType);

    console.log('[Virtual Try-On] Sending image generation request...');
    const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { text: imageGenPrompt },
                modelImagePart, // Base model image
                productImagePart, // New product image
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    const textPart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart) {
      console.log("[Virtual Try-On] Received AI Text Response:", textPart.text);
    }
    
    const imagePart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart || !imagePart.inlineData) {
        throw new Error('Virtual try-on failed: No image was generated.');
    }

    const { data: generatedBase64, mimeType: generatedMimeType } = imagePart.inlineData;
    return `data:${generatedMimeType};base64,${generatedBase64}`;
};

// FIX: Added a new service function to handle conversational image editing.
// This function takes a base image and a text prompt to generate an edited image using Gemini.
export const editImageWithPrompt = async (
  baseImage: string,
  prompt: string
): Promise<string> => {
  const editPrompt = `
You are an expert photo editor. The user wants to modify an image.
**CRITICAL INSTRUCTION:** Apply the user's request precisely to the provided base image.
**User's Request:** "${prompt}"

**RULES:**
1.  **Preserve Identity:** Maintain the model's identity, pose, and the overall composition of the base image unless specifically asked to change them.
2.  **Realism:** The final image must be photorealistic and seamlessly edited.
3.  **Output:** Return ONLY the modified image. Do not add text or commentary.
  `.trim();

  const imagePart = base64ToGenerativePart(baseImage, 'image/jpeg');

  console.log('[Conversational Edit] Sending image generation request...');
  const imageResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: editPrompt },
        imagePart,
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });
  
  const imagePartOut = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!imagePartOut || !imagePartOut.inlineData) {
      throw new Error('Image editing failed: No image was generated.');
  }

  const { data: generatedBase64, mimeType: generatedMimeType } = imagePartOut.inlineData;
  return `data:${generatedMimeType};base64,${generatedBase64}`;
};
