import { Modality } from '@google/genai';
import { Model, OunassSKU } from '../types';
import { ai, base64ToGenerativePart } from './geminiUtils';

/**
 * Categorizes a product based on its name and class to assist in virtual try-on logic.
 * @param product The OunassSKU product object.
 * @returns A specific category like 'Base Top', 'Outerwear', 'Bottoms', etc.
 */
const getProductCategory = (product: OunassSKU): string => {
    const name = product.name.toLowerCase();
    const pClass = product.class.toLowerCase();
    const subClass = product.subClass.toLowerCase();

    // Prioritize specific keywords for outerwear
    if (name.includes('jacket') || name.includes('coat') || name.includes('blazer') || name.includes('cardigan') || name.includes('outerwear')) return 'Outerwear';
    if (pClass.includes('outerwear')) return 'Outerwear';
    
    // Check for bottoms
    if (['trousers', 'pants', 'jeans', 'shorts', 'skirts', 'denim'].includes(pClass)) return 'Bottoms';
    if (name.includes('jeans') || name.includes('trousers') || name.includes('pants') || name.includes('skirt') || name.includes('shorts')) return 'Bottoms';
    
    // Check for footwear
    if (['shoes', 'sneakers', 'boots', 'sandals', 'heels', 'flats'].includes(pClass)) return 'Footwear';
    if (name.includes('sneaker') || name.includes('boot') || name.includes('sandal') || name.includes('heel') || name.includes('shoe')) return 'Footwear';

    // Check for full-body items
    if (['dresses', 'jumpsuits', 'rompers', 'abayas', 'kaftan'].includes(pClass)) return 'Full-body Outfit';
    if (name.includes('dress') || name.includes('jumpsuit') || name.includes('romper') || name.includes('abaya') || name.includes('kaftan')) return 'Full-body Outfit';

    // Default to a base layer top
    return 'Base Top';
};


/**
 * Performs a virtual try-on, adding a product to a model image.
 */
export const performVirtualTryOn = async (
  baseImage: string,
  model: Model,
  product: OunassSKU,
  previousProducts: OunassSKU[]
): Promise<string> => {
    
    const category = getProductCategory(product);
    const wearingItems = previousProducts.map(p => `- ${p.name} (${getProductCategory(p)})`);
    const productItemDescription = `${product.class} named '${product.name}'`;

    let compositingInstruction: string;
    let preservationInstruction = `The model's appearance (face, hair, skin, pose) and the background MUST NOT be altered.`;

    switch(category) {
        case 'Footwear':
            compositingInstruction = `Composite the isolated footwear (${productItemDescription}) onto the model's feet.`;
            preservationInstruction += ` The model's existing clothing must be fully preserved.`
            break;
        case 'Bottoms':
            compositingInstruction = `Composite the isolated bottoms (${productItemDescription}) onto the model, covering them from the waist down. This should replace the lower part of the bodysuit.`;
            preservationInstruction += ` The model's existing top garment MUST remain perfectly visible and unaltered.`
            break;
        case 'Base Top':
            compositingInstruction = `Composite the isolated top (${productItemDescription}) onto the model's torso, replacing the upper part of their bodysuit.`;
            preservationInstruction += ` The lower part of the bodysuit must remain visible and unaltered where the new top does not cover it.`
            break;
        case 'Outerwear':
            compositingInstruction = `Composite the isolated outerwear (${productItemDescription}) onto the model, layering it realistically OVER their existing clothes.`;
            preservationInstruction += ` All clothes underneath the new outerwear must be preserved and visible where appropriate (e.g., at the neckline).`
            break;
        case 'Full-body Outfit':
            compositingInstruction = `Composite the isolated full-body outfit (${productItemDescription}) onto the model, replacing their bodysuit entirely.`;
            break;
        default: 
             compositingInstruction = `Composite the isolated garment (${productItemDescription}) onto the model over their existing clothes.`;
    }

    const VIRTUAL_TRY_ON_PROMPT = `You are a professional AI photo editor creating a composite image for a luxury fashion catalog. Your task is to realistically merge a garment from a product photo onto a model photo.

**Objective:** Create a seamless, photorealistic composite.

**Instructions:**
1.  **Isolate Garment:** From the provided product image, you must isolate ONLY the following garment:
    - **Product:** ${product.name}
    - **Type:** ${product.class} / ${product.subClass}
    - **IMPORTANT:** Ignore any other items styled in the product photo.

2.  **Composite onto Model:** ${compositingInstruction} The composite must be flawless.
    - Ensure the garment drapes and fits the model's body and pose naturally.
    - Match lighting, shadows, and textures perfectly between the garment and the model.

3.  **Preserve Integrity:**
    - ${preservationInstruction}
    - The garment's design, color, and details must be an identical match to the product photo.
    - List of items the model is ALREADY wearing:
      ${wearingItems.length > 0 ? wearingItems.join('\n') : 'None'}

The final output must be a single, full-body image that is indistinguishable from a real photograph.`;
  
  console.log('[Virtual Try-On] Using refined image generation prompt:', VIRTUAL_TRY_ON_PROMPT);

  const imagePart = base64ToGenerativePart(baseImage, 'image/jpeg');
  
  // Directly fetch product image to avoid proxy issues, as Ounass CDN seems to allow it.
  let productPart;
  try {
      const response = await fetch(product.media[0].src);
      if (!response.ok) throw new Error(`Failed to fetch product image with status: ${response.status}`);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64String = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
      productPart = base64ToGenerativePart(base64String, blob.type);
  } catch (e) {
      console.error("Failed to fetch product image directly, falling back to proxy...", e);
      // Fallback or error handling can be added here if direct fetch fails.
      // For now, re-throwing to indicate failure.
      throw new Error(`Could not download product image for SKU ${product.sku}.`);
  }

  console.log('[Virtual Try-On] Sending image generation request...');
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: VIRTUAL_TRY_ON_PROMPT },
        imagePart, // model image
        productPart, // product image
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  const candidate = response.candidates?.[0];
  if (!candidate || !candidate.content || !candidate.content.parts) {
    const blockReason = candidate?.finishReason;
    const safetyRatings = candidate?.safetyRatings;
    console.error(`[Virtual Try-On] Generation failed. Block Reason: ${blockReason}`, { safetyRatings });

    let errorMessage = "Virtual try-on failed. The model did not return a valid image response.";
    // FIX: The `FinishReason` type from the SDK does not contain 'IMAGE_SAFETY' or 'IMAGE_OTHER'.
    // The correct check for a safety block is just 'SAFETY'.
    if (blockReason === 'SAFETY') {
        errorMessage = "The request was blocked by safety filters. This can sometimes happen with certain garments or poses. Please try a different product or model.";
    } else if (response.text) {
        errorMessage = `Virtual try-on failed. Details: ${response.text}`;
    }
    throw new Error(errorMessage);
  }

  const generatedPart = candidate.content.parts.find(p => p.inlineData);
  if (!generatedPart || !generatedPart.inlineData) {
    const textPart = candidate.content.parts.find(p => p.text);
    console.error("[Virtual Try-On] Image generation failed. Text response:", textPart?.text);
    throw new Error("Virtual try-on failed. The model returned text but no image.");
  }


  const base64Image = generatedPart.inlineData.data;
  const mimeType = generatedPart.inlineData.mimeType;
  return `data:${mimeType};base64,${base64Image}`;
};