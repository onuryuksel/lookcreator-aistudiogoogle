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
            primaryTask = `Digitally TRANSFER the footwear from the product photo onto the model, replacing the model's bare feet.`;
            break;
        case 'Bottoms':
            primaryTask = `Digitally TRANSFER the bottoms from the product photo onto the model, replacing the lower part of the ${modelGarment}.`;
            break;
        case 'Full-body Outfit':
            primaryTask = `Digitally TRANSFER the garment(s) shown in the product photo onto the model, replacing the underlying ${modelGarment}. The result must be a flawless visual transfer, not an interpretation.`;
            break;
        default: // 'Base Top' or 'Outerwear'
             primaryTask = `Digitally LAYER the garment from the product photo over the model's existing clothes.`;
    }

    const VIRTUAL_TRY_ON_PROMPT = `You are a digital tailor specializing in hyper-realistic virtual try-on. Your SOLE job is to transfer a garment from a product image onto a model's image with absolute, pixel-perfect precision.

**PRIME DIRECTIVE: FLAWLESS REPLICATION. NO CREATIVE CHANGES.**
This is a technical replication task, not a creative one. You MUST transfer the garment from the product photo to the model with ZERO alterations. The final garment on the model must be an IDENTICAL copy of the one in the product photo.

**PRIMARY TASK:**
${primaryTask}

**CRITICAL RULES:**
1.  **DO NOT ALTER THE PRODUCT (MOST IMPORTANT RULE):** You are forbidden from changing the product's design. The sleeves, neckline, length, pattern, texture, color, buttons, lace, and any other details must be replicated exactly as they appear in the product photo. If the product has puff sleeves, the result MUST have identical puff sleeves.
2.  **PRESERVE MODEL & BACKGROUND:** The model's face, physical characteristics, hair, pose, and the background must remain IDENTICAL to the base image. Only the clothing being replaced should change.
3.  **VISUALS ARE THE ONLY TRUTH:** The product PHOTO is the only source of truth. Ignore any product name or text. Replicate exactly what you SEE in the image.
4.  **PRESERVE EXISTING ITEMS:** The model is already wearing these items. They MUST be perfectly preserved under or around the new garment:
${wearingItems.length > 0 ? wearingItems.join('\n') : 'None'}

The final output must be a single, complete, full-body image that looks like a real photograph.`;
  
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