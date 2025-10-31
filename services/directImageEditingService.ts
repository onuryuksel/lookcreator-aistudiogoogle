import { Modality } from '@google/genai';
import { ai, urlToGenerativePart, filesToGenerativeParts } from './geminiUtils';


export const changeImageAspectRatio = async (
  baseImage: string,
  aspectRatio: string
): Promise<string> => {
  const imagePart = await urlToGenerativePart(baseImage);
  const prompt = `Your task is to change the aspect ratio of this image to ${aspectRatio}. You must intelligently extend the background and scene to fill the new canvas dimensions using generative fill. The original subject (the model, their complete outfit, and immediate surroundings) must remain the central focus, perfectly preserved, and appropriately scaled within the new frame. Do not crop, distort, or change the original subject. The final output must be a seamless, photorealistic image.`;

  console.log(`[Aspect Ratio Change] Sending request for ratio: ${aspectRatio}`);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: prompt },
        imagePart,
      ],
    },
    config: {
      // @ts-ignore - Per user request, adding imageConfig. This may not be officially documented
      // in the provided guidelines, but following the specific instruction for this feature.
      imageConfig: {
        aspectRatio: aspectRatio,
      },
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  const candidate = response.candidates?.[0];
  if (!candidate || !candidate.content || !candidate.content.parts) {
    const blockReason = candidate?.finishReason;
    const safetyRatings = candidate?.safetyRatings;
    console.error(`[Aspect Ratio Change] Generation failed. Block Reason: ${blockReason}`, { safetyRatings });

    let errorMessage = "Aspect ratio change failed. The model did not return a valid image response.";
    if (blockReason === 'SAFETY') {
        errorMessage = "The request was blocked due to safety policies.";
    } else if (response.text) {
        errorMessage = `Aspect ratio change failed. Details: ${response.text}`;
    }
    throw new Error(errorMessage);
  }

  const generatedPart = candidate.content.parts.find(p => p.inlineData);
  if (!generatedPart || !generatedPart.inlineData) {
    const textPart = candidate.content.parts.find(p => p.text);
    console.error("[Aspect Ratio Change] Image generation failed. Text response:", textPart?.text);
    throw new Error("Aspect ratio change failed. The model returned text but no image.");
  }

  const base64Image = generatedPart.inlineData.data;
  const mimeType = generatedPart.inlineData.mimeType;
  return `data:${mimeType};base64,${base64Image}`;
};


const EDIT_PROMPT_TEMPLATE = `
You are an AI photo editor. Your task is to perform a photorealistic edit on the provided image based on the user's instructions.

**Key Rules for a Great Edit:**
1.  **Respect the Original:** Do not change the model's identity, pose, or the background unless the user's prompt specifically asks for it.
2.  **Seamless Changes:** Any edits must be blended realistically into the image.
3.  **High-Quality Output:** The final image must be high-resolution and free of digital errors.

**User's Edit Request:** "{PROMPT}"
`;

export const editImageWithPrompt = async (
  baseImage: string,
  prompt: string
): Promise<string> => {
  const imagePart = await urlToGenerativePart(baseImage);
  const fullPrompt = EDIT_PROMPT_TEMPLATE.replace('{PROMPT}', prompt);
  
  console.log('[Image Editing] Sending prompt:', fullPrompt);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: fullPrompt },
        imagePart,
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
    console.error(`[Image Editing] Generation failed. Block Reason: ${blockReason}`, { safetyRatings });

    let errorMessage = "Image editing failed. The model did not return a valid image response.";
    if (blockReason === 'SAFETY') {
        errorMessage = "The request was blocked due to safety policies. Please try a different prompt.";
    } else if (response.text) {
        errorMessage = `Image editing failed. Details: ${response.text}`;
    }
    throw new Error(errorMessage);
  }
  
  const generatedPart = candidate.content.parts.find(p => p.inlineData);
  if (!generatedPart || !generatedPart.inlineData) {
    const textPart = candidate.content.parts.find(p => p.text);
    console.error("[Image Editing] Image generation failed. Text response:", textPart?.text);
    throw new Error("Image editing failed. The model returned text but no image.");
  }

  const base64Image = generatedPart.inlineData.data;
  const mimeType = generatedPart.inlineData.mimeType;
  return `data:${mimeType};base64,${base64Image}`;
};

export const editImageWithImageAndPrompt = async (
  baseImage: string,
  guideImage: File,
  prompt: string
): Promise<string> => {
  const baseImagePart = await urlToGenerativePart(baseImage);
  const guideImageParts = await filesToGenerativeParts([guideImage]);
  const fullPrompt = EDIT_PROMPT_TEMPLATE.replace('{PROMPT}', prompt) + "\n\n**Additional Guidance:** Use the second image provided as a visual reference for the style, color, or object to add.";

  console.log('[Image Editing] Sending prompt with image guide:', fullPrompt);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: fullPrompt },
        baseImagePart,
        ...guideImageParts
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
    console.error(`[Image Editing] Generation failed. Block Reason: ${blockReason}`, { safetyRatings });

    let errorMessage = "Image editing with guide failed. The model did not return a valid image response.";
    if (blockReason === 'SAFETY') {
        errorMessage = "The request was blocked by safety policies. Please try a different prompt or guide image.";
    } else if (response.text) {
        errorMessage = `Image editing with guide failed. Details: ${response.text}`;
    }
    throw new Error(errorMessage);
  }

  const generatedPart = candidate.content.parts.find(p => p.inlineData);
  if (!generatedPart || !generatedPart.inlineData) {
    const textPart = candidate.content.parts.find(p => p.text);
    console.error("[Image Editing] Image generation failed. Text response:", textPart?.text);
    throw new Error("Image editing with guide failed. The model returned text but no image.");
  }

  const base64Image = generatedPart.inlineData.data;
  const mimeType = generatedPart.inlineData.mimeType;
  return `data:${mimeType};base64,${base64Image}`;
};