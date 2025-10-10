import { Modality } from '@google/genai';
import { ai, base64ToGenerativePart, filesToGenerativeParts } from './geminiUtils';

/**
 * Changes the aspect ratio of an image using inpainting/outpainting.
 */
export const changeImageAspectRatio = async (
    base64Image: string,
    aspectRatio: string
): Promise<string> => {
    const prompt = `
        **CRITICAL INSTRUCTION: As an expert photo editor, recompose this image to a ${aspectRatio} aspect ratio.**
        
        **PRIMARY GOAL:** The subject (the model) MUST remain the main focus and be scaled appropriately to fill the new frame.
        
        **RULES:**
        1.  **PRESERVE THE SUBJECT:** The model's appearance, pose, and clothing must be perfectly preserved.
        2.  **SCALE THE SUBJECT:** The model must be scaled up to be the primary focus of the new aspect ratio. DO NOT let the subject appear small or distant in the final image.
        3.  **EXTEND THE SCENE:** Seamlessly extend the entire scene (background, floor, lighting) to fill the new dimensions. The extension must match the existing simple, clean studio environment. The transition must be invisible.
        4.  **MAINTAIN PHOTOREALISM:** The final image must be a cohesive, high-resolution photograph.

        **NEGATIVE PROMPT (WHAT TO AVOID):**
        - DO NOT SHRINK THE MODEL.
        - DO NOT change the model or their clothing.
        - DO NOT add new objects.
        - DO NOT create a blurry or pixelated result.
        - DO NOT leave any visible seams.
    `;
    const imagePart = base64ToGenerativePart(base64Image, 'image/jpeg');

    console.log(`[Aspect Ratio] Sending generation prompt for ratio ${aspectRatio}.`);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: prompt }, imagePart],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            imageConfig: {
                aspectRatio: aspectRatio as any,
            }
        },
    });

    const generatedPart = response.candidates[0].content.parts.find(p => p.inlineData);
    if (!generatedPart || !generatedPart.inlineData) {
        const textPart = response.candidates[0].content.parts.find(p => p.text);
        console.error("[Aspect Ratio] Image generation failed. Text response:", textPart?.text);
        throw new Error("Failed to change aspect ratio. The model did not return an image.");
    }

    const newBase64Image = generatedPart.inlineData.data;
    const mimeType = generatedPart.inlineData.mimeType;
    return `data:${mimeType};base64,${newBase64Image}`;
};

/**
 * Edits an image based on a text prompt.
 */
export const editImageWithPrompt = async (
    base64Image: string,
    prompt: string
): Promise<string> => {
    const editPrompt = `
        **CRITICAL INSTRUCTION: Perform the following edit on the image while preserving photorealism and model identity.**
        
        **Edit Request:** "${prompt}"

        **Core Principles:**
        1.  **Identity Preservation:** The model's face, body, and core features MUST remain unchanged unless the prompt specifically requests to alter them.
        2.  **Seamless Integration:** The edit must blend perfectly with the existing image. Lighting, shadows, and textures must match.
        3.  **Background Integrity:** The background must remain the same unless the edit requires changing it.
        
        Apply the user's request precisely.
    `;
    const imagePart = base64ToGenerativePart(base64Image, 'image/jpeg');

    console.log('[Edit with Prompt] Sending generation prompt.');

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: editPrompt }, imagePart],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    
    const generatedPart = response.candidates[0].content.parts.find(p => p.inlineData);
    if (!generatedPart || !generatedPart.inlineData) {
        const textPart = response.candidates[0].content.parts.find(p => p.text);
        console.error("[Edit with Prompt] Image generation failed. Text response:", textPart?.text);
        throw new Error(`Image editing failed. The model said: "${textPart?.text || 'No text response'}"`);
    }

    const newBase64Image = generatedPart.inlineData.data;
    const mimeType = generatedPart.inlineData.mimeType;
    return `data:${mimeType};base64,${newBase64Image}`;
};

/**
 * Edits an image based on a text prompt and a guide image.
 */
export const editImageWithImageAndPrompt = async (
    base64Image: string,
    guideImage: File,
    prompt: string
): Promise<string> => {
    const editPrompt = `
        **CRITICAL INSTRUCTION: Perform an edit guided by the user's text and the provided reference image.**

        **Edit Request:** "${prompt}"

        **Core Principles:**
        1.  **Reference Image:** Use the second image as a visual guide for the object to add or the style to apply. For example, if the prompt is "add these sunglasses" and a picture of sunglasses is provided, add those specific sunglasses to the model.
        2.  **Identity Preservation:** The main model's face, body, and core features MUST remain unchanged.
        3.  **Seamless Integration:** The edit must blend perfectly. Match lighting, shadows, and perspective.
        4.  **Background Integrity:** Do not change the background unless specified.

        Apply the user's request precisely, using the reference image.
    `;
    const targetImagePart = base64ToGenerativePart(base64Image, 'image/jpeg');
    const [guideImagePart] = await filesToGenerativeParts([guideImage]);

    console.log('[Edit with Image and Prompt] Sending generation prompt.');

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: editPrompt }, targetImagePart, guideImagePart],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    const generatedPart = response.candidates[0].content.parts.find(p => p.inlineData);
    if (!generatedPart || !generatedPart.inlineData) {
        const textPart = response.candidates[0].content.parts.find(p => p.text);
        console.error("[Edit with Image and Prompt] Image generation failed. Text response:", textPart?.text);
        throw new Error(`Image editing failed. The model said: "${textPart?.text || 'No text response'}"`);
    }

    const newBase64Image = generatedPart.inlineData.data;
    const mimeType = generatedPart.inlineData.mimeType;
    return `data:${mimeType};base64,${newBase64Image}`;
};