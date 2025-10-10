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

    let howToAdd: string;

    switch(category) {
        case 'Footwear':
            howToAdd = `Digitally place the footwear (${productItemDescription}) from the product photo onto the model's feet, so they appear to be wearing them naturally.`;
            break;
        case 'Bottoms':
            howToAdd = `Digitally dress the model in the bottoms (${productItemDescription}) from the product photo. The new bottoms should realistically cover the lower part of the model's bodysuit.`;
            break;
        case 'Full-body Outfit':
            howToAdd = `Digitally dress the model in the full-body outfit (${productItemDescription}) from the product photo. The new outfit should realistically cover the model's bodysuit and any other worn items.`;
            break;
        default: // 'Base Top' or 'Outerwear'
             howToAdd = `Digitally dress the model in the top/outerwear (${productItemDescription}) from the product photo, layering it realistically over their existing clothes.`;
    }

    const productDetails = `
- **Product Name:** ${product.name}
- **Product Type:** ${product.class} / ${product.subClass}
`;

    const VIRTUAL_TRY_ON_PROMPT = `You are a world-class AI fashion stylist. Your goal is to create a photorealistic image of a model wearing a new piece of clothing. You will be given a photo of the model, and a photo of the product.

**Your Task:**
Carefully add the specified garment from the product photo onto the model in the base image.

**The Garment to Add:**
${productDetails}

**How to Add It:**
${howToAdd}

**Key Rules for a Perfect Result:**
1.  **Focus on One Item:** The product photo might show a full look, but you must only add the specific garment detailed above. For instance, if the product is a 'Top', ignore any pants or skirts in the product photo.
2.  **Product Accuracy:** The added garment must be an identical copy of the one in the product photo. Preserve its design, color, texture, and how it fits.
3.  **Model and Scene Consistency:** The model's appearance (face, body, hair, pose) and the studio background must remain exactly the same. Only the clothing should change where the new item is added.
4.  **Layering Logic:** The model may already be wearing other items. These must be preserved correctly under or around the new garment. The items they are already wearing are:
${wearingItems.length > 0 ? wearingItems.join('\n') : 'None'}

The final image must be a complete, full-body photograph that looks completely real.`;
  
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
    if (blockReason === 'SAFETY') {
        errorMessage = "The request was blocked due to safety policies. Please try a different product or model image.";
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