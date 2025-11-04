import { Modality } from '@google/genai';
import { Model, OunassSKU } from '../types';
import { ai, base64ToGenerativePart, urlToGenerativePart } from './geminiUtils';

/**
 * Categorizes a product based on its name and class to assist in virtual try-on logic.
 * This has been updated to use the full Ounass product classification for better accuracy.
 * @param product The OunassSKU product object.
 * @returns A specific category like 'Bags', 'Footwear', 'Outerwear', 'Base Top', etc.
 */
const getProductCategory = (product: OunassSKU): string => {
    const pClass = (product.productClass || '').toLowerCase(); // e.g., 'clothing', 'shoes', 'bags', 'accessories'
    const cls = (product.class || '').toLowerCase(); // e.g., 'dresses', 'sneakers', 'shoulder bags'
    const name = product.name.toLowerCase();
    
    // --- Bags ---
    if (pClass === 'bags') return 'Bags';

    // --- Footwear ---
    if (pClass === 'shoes') return 'Footwear';

    // --- Accessories & Jewellery ---
    if (pClass === 'accessories' || pClass === 'jewellery') {
        if (cls.includes('hats')) return 'Headwear';
        if (cls.includes('sunglasses')) return 'Headwear';
        if (cls.includes('belts')) return 'Belts';
        if (cls.includes('watches')) return 'Jewellery-Wrists'; // Handle watches
        if (cls.includes('necklaces')) return 'Jewellery-Neck';
        if (cls.includes('earrings')) return 'Jewellery-Ears';
        if (cls.includes('bracelets')) return 'Jewellery-Wrists';
        if (cls.includes('rings')) return 'Jewellery-Hands';
        // Generic fallback for jewellery
        if (cls.includes('jewellery') || pClass === 'jewellery') {
            if (name.includes('necklace')) return 'Jewellery-Neck';
            if (name.includes('earring')) return 'Jewellery-Ears';
            if (name.includes('bracelet')) return 'Jewellery-Wrists';
            if (name.includes('ring')) return 'Jewellery-Hands';
        }
        // Other accessories might not be suitable for try-on
        return 'Accessory-Other'; 
    }

    // --- Clothing ---
    if (pClass === 'clothing') {
        // Full-body
        if (['dresses', 'jumpsuits', 'rompers', 'abayas', 'kaftan', 'all in ones', 'evening dress', 'dungarees'].includes(cls)) return 'Full-body Outfit';
        if (name.includes('dress') || name.includes('jumpsuit') || name.includes('romper') || name.includes('abaya') || name.includes('kaftan')) return 'Full-body Outfit';

        // Outerwear
        if (['outerwear', 'blazers', 'jacket', 'jackets'].includes(cls)) return 'Outerwear';
        if (name.includes('jacket') || name.includes('coat') || name.includes('blazer') || name.includes('cardigan') || name.includes('outerwear')) return 'Outerwear';
        
        // Bottoms
        if (['trousers', 'shorts', 'skirts', 'denim'].includes(cls)) return 'Bottoms';
        if (name.includes('jeans') || name.includes('trousers') || name.includes('pants') || name.includes('skirt') || name.includes('shorts')) return 'Bottoms';

        // Default to Base Top for other clothing
        // This covers: 't shirts', 'tops', 'shirts', 'sweatshirts', 'polos', 'knitwear', 'bodysuits', 'beachwear' etc.
        return 'Base Top';
    }

    // Fallback based on name if pClass is missing or unexpected
    if (name.includes('bag')) return 'Bags';
    if (name.includes('shoe') || name.includes('sneaker') || name.includes('boot') || name.includes('sandal') || name.includes('heel')) return 'Footwear';
    if (name.includes('hat') || name.includes('sunglasses')) return 'Headwear';
    if (name.includes('watch')) return 'Jewellery-Wrists'; // Handle watches in fallback
    if (name.includes('necklace')) return 'Jewellery-Neck';
    if (name.includes('earring')) return 'Jewellery-Ears';
    if (name.includes('bracelet')) return 'Jewellery-Wrists';
    if (name.includes('ring')) return 'Jewellery-Hands';
    if (name.includes('belt')) return 'Belts';
    if (name.includes('jacket') || name.includes('coat') || name.includes('blazer')) return 'Outerwear';
    if (name.includes('pants') || name.includes('trousers') || name.includes('skirt') || name.includes('shorts') || name.includes('jeans')) return 'Bottoms';
    if (name.includes('dress') || name.includes('jumpsuit')) return 'Full-body Outfit';

    return 'Base Top'; // Final, ultimate default
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
    
    let category = getProductCategory(product);

    // Dynamic Category Adjustment: If a shirt-like item is added on top of an existing top,
    // treat it as Outerwear to enable layering instead of replacement.
    const hasExistingTopLayer = previousProducts.some(p => {
        const prevCategory = getProductCategory(p);
        return ['Base Top', 'Full-body Outfit', 'Outerwear'].includes(prevCategory);
    });

    if (category === 'Base Top' && hasExistingTopLayer) {
        const productName = product.name.toLowerCase();
        const productClass = (product.class || '').toLowerCase();
        // Keywords that suggest an item can be worn as an open layer. Exclude "t-shirt".
        if (
            (productName.includes('shirt') && !productName.includes('t-shirt')) ||
            (productClass.includes('shirts') && !productClass.includes('t shirts')) ||
             productName.includes('cardigan') || 
             productClass.includes('cardigan')
        ) {
            category = 'Outerwear';
        }
    }
    
    const productItemDescription = `${product.class} named '${product.name}'`;
    
    let compositingInstruction: string;
    let preservationInstruction = `The model's appearance (face, hair, skin, pose) and the background MUST NOT be altered.`;

    switch(category) {
        case 'Bags': {
            // FIX: The instruction for bag placement was too ambiguous, leading the AI to change the
            // model's pose. It's now explicitly instructed to add the bag to the *existing* pose
            // without altering the model, ensuring accessories are added non-destructively.
            let compositingInstructionBuilder = `**CRITICAL INSTRUCTION: DO NOT CHANGE THE MODEL'S POSE.** Composite the isolated bag (${productItemDescription}) onto the model as they are currently posed. The bag must be placed realistically on their body (e.g., on the shoulder, slung cross-body, on their back if a backpack) *without* altering the model's stance, posture, or arm positions. The goal is to add the accessory to the existing photograph, not to create a new one.`;
            
            if (product.sizeAndFit && product.sizeAndFit.length > 0) {
                const sizeInfo = `\n\n**CRITICAL SCALING INSTRUCTION:** The bag's dimensions are: ${product.sizeAndFit.join('; ')}. You MUST use these dimensions to render the bag at the correct scale relative to the model. This is essential for realism.`;
                compositingInstructionBuilder += sizeInfo;
            }
            
            compositingInstruction = compositingInstructionBuilder;
            preservationInstruction += ` The model's existing clothing must be fully preserved.`
            break;
        }
        case 'Headwear': {
            const isHat = (product.class || '').toLowerCase().includes('hats') || product.name.toLowerCase().includes('hat');
            
            if (isHat) {
                compositingInstruction = `
**CRITICAL TASK: Fit the Hat Realistically.**
Composite the isolated hat (${productItemDescription}) onto the model's head. This requires extreme attention to detail for a photorealistic result.

1.  **Placement & Angle:** Place the hat at a natural, slightly tilted angle on the model's head. Avoid a perfectly straight, artificial placement.
2.  **Hair Interaction:** The hat MUST interact with the model's hair. It should visibly press the hair down underneath it. Some strands of hair should naturally fall around the hat's brim or sides. Do not make the hair disappear; show how the hat realistically sits on it.
3.  **Shadows & Lighting:** This is essential. The hat must cast a soft, realistic shadow on the model's forehead, face, and hair, consistent with the existing studio lighting. The shadow's direction and softness must perfectly match the lighting on the model.
4.  **Scale:** Ensure the hat is scaled perfectly to the model's head size. It must not look oversized or undersized.
`;
            } else { // For sunglasses or other headwear
                compositingInstruction = `Composite the isolated headwear (${productItemDescription}, e.g., sunglasses) onto the model's face. It must fit perfectly and be angled naturally, with realistic reflections and shadows on the face.`;
            }
            
            // Updated preservation to explicitly protect facial identity.
            preservationInstruction += ` The model's existing clothing must be fully preserved. The model's face and identity under the headwear must be perfectly preserved.`
            break;
        }
        case 'Belts':
            compositingInstruction = `Composite the isolated belt (${productItemDescription}) around the model's waist, over their current outfit. Ensure it fits snugly and naturally.`;
            preservationInstruction += ` The clothing underneath the belt should be cinched realistically.`
            break;
        case 'Jewellery-Neck':
            compositingInstruction = `Composite the isolated necklace (${productItemDescription}) around the model's neck. It should drape realistically over their skin or clothing.`;
            preservationInstruction += ` The model's existing clothing must be fully preserved.`
            break;
        case 'Jewellery-Ears':
            compositingInstruction = `Composite the isolated earrings (${productItemDescription}) onto the model's ears.`;
            preservationInstruction += ` The model's existing clothing must be fully preserved.`
            break;
        case 'Jewellery-Wrists':
            compositingInstruction = `Composite the isolated bracelet or watch (${productItemDescription}) onto the model's wrist.`;
            preservationInstruction += ` The model's existing clothing must be fully preserved.`
            break;
        case 'Jewellery-Hands':
            compositingInstruction = `Composite the isolated ring (${productItemDescription}) onto one of the model's fingers.`;
            preservationInstruction += ` The model's existing clothing must be fully preserved.`
            break;
        case 'Accessory-Other':
            compositingInstruction = `Composite the small accessory (${productItemDescription}) onto the model where it would naturally be worn or held. If it's too small to be clearly visible (like a wallet), show the model holding it.`;
            preservationInstruction += ` The model's existing clothing must be fully preserved.`
            break;
        case 'Footwear':
            compositingInstruction = `Composite the isolated footwear (${productItemDescription}) onto the model's feet, replacing their bare feet.`;
            preservationInstruction += ` The model's existing clothing must be fully preserved.`
            break;
        case 'Bottoms':
            const initialBottoms = model.gender === 'Male' ? 'shorts' : 'the bottom part of their bodysuit';
            compositingInstruction = `Composite the isolated bottoms (${productItemDescription}) onto the model, completely replacing their existing lower-body garment (initially, this is their ${initialBottoms}).`;
            preservationInstruction += ` The model's existing top garment MUST remain perfectly visible and unaltered.`
            break;
        case 'Base Top':
            const initialTop = model.gender === 'Male' ? 't-shirt' : 'bodysuit';
            compositingInstruction = `Composite the isolated top (${productItemDescription}) onto the model's torso, completely replacing their existing top garment (initially, this is their ${initialTop}).`;
            preservationInstruction += ` Any existing lower-body garment (e.g., jeans, shorts) must remain perfectly visible and unaltered.`
            break;
        case 'Outerwear':
            compositingInstruction = `Add the isolated outerwear (${productItemDescription}) onto the model, layered ON TOP of their existing clothes. If the item is a shirt, jacket, or cardigan that can be worn open, ensure it is styled that way so the clothing underneath is clearly visible.`;
            preservationInstruction += ` All clothes underneath the new outerwear must be preserved and visible where appropriate (e.g., at the neckline, hem).`
            break;
        case 'Full-body Outfit':
            const initialFullOutfit = model.gender === 'Male' ? 't-shirt and shorts' : 'bodysuit';
            compositingInstruction = `Composite the isolated full-body outfit (${productItemDescription}) onto the model, completely replacing ALL of their current clothing (initially, this is their ${initialFullOutfit}).`;
            break;
        default: 
             compositingInstruction = `Composite the isolated garment (${productItemDescription}) onto the model over their existing clothes.`;
    }

    const wearingItemsList = previousProducts.map(p => `- ${p.name} (${getProductCategory(p)})`);
    const wearingItemsText = wearingItemsList.length > 0 
        ? `${wearingItemsList.join('\n      ')}`
        : 'None';

    const ACCESSORY_CATEGORIES_FOR_MULTI_IMAGE = ['Headwear', 'Belts', 'Jewellery-Neck', 'Jewellery-Ears', 'Jewellery-Wrists', 'Jewellery-Hands', 'Accessory-Other'];
    const isMultiImageAccessory = ACCESSORY_CATEGORIES_FOR_MULTI_IMAGE.includes(category);
    
    const garmentIsolationPreamble = isMultiImageAccessory && product.media.length > 1
        ? `From the **multiple Product Images provided**, isolate ONLY the garment listed below. These images show the **SAME product** from different angles. You MUST analyze all of them to understand the product's full 3D shape, texture, details, and scale before compositing.`
        : `From the **Product Image**, you must isolate ONLY the following garment:`;

    const VIRTUAL_TRY_ON_PROMPT = `You are a professional AI photo editor creating a composite image for a luxury fashion catalog. Your task is to realistically merge a garment from a product photo onto a model photo.

**Objective:** Create a seamless, photorealistic composite.

**Instructions:**
1.  **Isolate Garment:** ${garmentIsolationPreamble}
    - **Product:** ${product.name}
    - **Type:** ${product.class} / ${product.subClass}
    - **IMPORTANT:** Ignore any other items styled in the product photo.

2.  **Composite onto Model:** Composite the isolated garment onto the model from the **Model Image**. The composite must be flawless.
    - **Specific Task:** ${compositingInstruction}
    - Ensure the garment drapes and fits the model's body and pose naturally.
    - Match lighting, shadows, and textures perfectly between the garment and the model.

3.  **Preserve Integrity:**
    - ${preservationInstruction}
    - **CRITICAL RULE:** The garment's design, color, and details must be an **identical match** to the product photo.
    - **List of items the model is ALREADY wearing (these must be visible if not covered by the new item):**
      ${wearingItemsText}

The final output must be a single, full-body image that is indistinguishable from a real photograph.`;
  
  console.log('[Virtual Try-On] Using revised image generation prompt:', VIRTUAL_TRY_ON_PROMPT);

  const imagePart = await urlToGenerativePart(baseImage);
  
  const productMediaToFetch = (isMultiImageAccessory && product.media.length > 1) ? product.media : [product.media[0]];
  console.log(`[Virtual Try-On] Fetching ${productMediaToFetch.length} product image(s) for SKU ${product.sku}`);

  const productParts = await Promise.all(productMediaToFetch.map(async (mediaItem) => {
      try {
          const response = await fetch(mediaItem.src);
          if (!response.ok) throw new Error(`Failed to fetch product image with status: ${response.status}`);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64String = await new Promise<string>((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
          });
          return base64ToGenerativePart(base64String, blob.type);
      } catch (e) {
          console.error(`Failed to fetch product image ${mediaItem.src} directly for SKU ${product.sku}`, e);
          throw new Error(`Could not download product image for SKU ${product.sku}.`);
      }
  }));

  console.log('[Virtual Try-On] Sending image generation request...');
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: VIRTUAL_TRY_ON_PROMPT },
        imagePart, // model image
        ...productParts, // product image(s)
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