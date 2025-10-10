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
    const modelGarment = model.gender === 'Male' ? 't-shirt and shorts' : 'bodysuit';
    const wearingItems = previousProducts.map(p => `- ${p.name} (${getProductCategory(p)})`);

    let primaryTask: string;

    switch(category) {
        case 'Footwear':
            primaryTask = `REPLACE the model's bare feet with the new product: ${product.name}.`;
            break;
        case 'Bottoms':
            primaryTask = `DRESS the model in the new product, the '${product.name}', placing it directly over her ${modelGarment}. The ${modelGarment} should not be visible in the final image.`;
            break;
        case 'Full-body Outfit':
            primaryTask = `DRESS the model in the new product, the '${product.name}', replacing all existing clothing.`;
            break;
        default: // 'Base Top' or 'Outerwear'
             primaryTask = `ADD the new product, the '${product.name}', over the existing clothes.`;
    }

    const VIRTUAL_TRY_ON_PROMPT = `You are an expert at virtual try-on. Your task is to modify the base image according to a primary task.

**PRIMARY TASK:**
${primaryTask}

**CRITICAL RULES:**
1.  **PRESERVE THE MODEL and BACKGROUND:** The model's face, body, hair, pose, and the background must remain IDENTICAL to the base image. Do not change them.
2.  **PRESERVE EXISTING ITEMS:** The model is already wearing the following items. They MUST be preserved perfectly:
${wearingItems.length > 0 ? wearingItems.join('\n') : 'None'}
3.  **REPLICATE PRODUCT EXACTLY:** The added or replacement product must be an exact replica of the one in the product photo. Pay close attention to details like neckline, color, style, and texture.

The final output should be the complete, full-body image with the task completed.`;
  
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

  const generatedPart = response.candidates[0].content.parts.find(p => p.inlineData);
  if (!generatedPart || !generatedPart.inlineData) {
    const textPart = response.candidates[0].content.parts.find(p => p.text);
    console.error("[Virtual Try-On] Image generation failed. Text response:", textPart?.text);
    throw new Error("Virtual try-on failed. The model did not return an image.");
  }

  const base64Image = generatedPart.inlineData.data;
  const mimeType = generatedPart.inlineData.mimeType;
  return `data:${mimeType};base64,${base64Image}`;
};