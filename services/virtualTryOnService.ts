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
    const productItemDescription = `${product.class} named '${product.name}'`;

    let primaryTask: string;

    switch(category) {
        case 'Footwear':
            primaryTask = `Digitally TRANSFER the footwear (${productItemDescription}) from the product photo onto the model, replacing the model's bare feet.`;
            break;
        case 'Bottoms':
            primaryTask = `Digitally TRANSFER the bottoms (${productItemDescription}) from the product photo onto the model, replacing the lower part of the ${modelGarment} or any existing bottoms.`;
            break;
        case 'Full-body Outfit':
            primaryTask = `Digitally TRANSFER the full-body outfit (${productItemDescription}) shown in the product photo onto the model, replacing the underlying ${modelGarment} and any other worn items.`;
            break;
        default: // 'Base Top' or 'Outerwear'
             primaryTask = `Digitally LAYER the top/outerwear (${productItemDescription}) from the product photo over the model's existing clothes.`;
    }

    const productDetails = `
- **Product Name:** ${product.name}
- **Product Type:** ${product.class} / ${product.subClass}
`;

    const VIRTUAL_TRY_ON_PROMPT = `You are a digital tailor specializing in hyper-realistic virtual try-on. Your task is to transfer a SINGLE SPECIFIC garment from a product image onto a model's image with absolute precision.

**PRIME DIRECTIVE: FLAWLESS REPLICATION OF A SINGLE ITEM.**

**THE SPECIFIC GARMENT TO TRANSFER:**
You must identify and transfer ONLY the following item from the product image. IGNORE any other garments or accessories shown in the product photo.
${productDetails}

**PRIMARY TASK:**
${primaryTask}

**CRITICAL RULES:**
1.  **TRANSFER ONLY THE SPECIFIED GARMENT (MOST IMPORTANT RULE):** The product photo may show a full outfit, but you must ONLY transfer the specific item detailed above. For example, if the product is a 'Top', you must ignore any pants, skirts, or shorts in the product photo.
2.  **DO NOT ALTER THE PRODUCT:** The garment you transfer must be an IDENTICAL copy of the one in the product photo in terms of design, color, texture, and fit.
3.  **PRESERVE MODEL & BACKGROUND:** The model's face, physical characteristics, hair, pose, and the background must remain IDENTICAL to the base image. Only the clothing being replaced should change.
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