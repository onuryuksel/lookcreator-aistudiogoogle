import { Modality, Type } from '@google/genai';
import { Look, LifestyleShootUserInput, ArtDirectorPrompt } from '../types';
import { ai, base64ToGenerativePart, filesToGenerativeParts } from './geminiUtils';

// --- START: Lifestyle Shoot Constants ---
const ART_DIRECTOR_PROMPT_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        scene_setting: {
            type: Type.OBJECT,
            properties: {
                location: { type: Type.STRING, description: "Detailed description of the chosen location. If user provided a location, expand on it with rich sensory details. If not, choose a suitable location from the context list based on the outfit and describe it vividly." },
                mood: { type: Type.STRING },
                time: { type: Type.STRING },
                details: { type: Type.STRING, description: "Additional props, weather, or atmospheric elements." },
                visual_style: { type: Type.STRING }
            }
        },
        camera_lens_specifications: {
            type: Type.OBJECT,
            properties: {
                camera_model: { type: Type.STRING, description: "e.g., 'Hasselblad X2D 100C'" },
                lens_choices: { type: Type.ARRAY, items: { type: Type.STRING }, description: "e.g., ['Hasselblad XCD 90mm f/2.5']" },
                aperture: { type: Type.STRING },
                shutter_speed: { type: Type.STRING },
                iso: { type: Type.STRING },
                focus_mode: { type: Type.STRING, description: "e.g., 'Autofocus on model's eyes'" }
            }
        },
        lighting_setup: {
            type: Type.OBJECT,
            properties: {
                key_light: { type: Type.STRING },
                fill_light: { type: Type.STRING },
                rim_back_light: { type: Type.STRING },
                modifiers: { type: Type.STRING },
                color_temp: { type: Type.STRING }
            }
        },
        composition: {
            type: Type.OBJECT,
            properties: {
                shot_type: { type: Type.STRING, description: "Choose ONE: wide | medium | close-up" },
                camera_angle: { type: Type.STRING },
                rule_of_thirds: { type: Type.STRING },
                depth_of_field: { type: Type.STRING },
                background: { type: Type.STRING }
            }
        },
        post_production: {
            type: Type.OBJECT,
            properties: {
                color_grading: { type: Type.STRING },
                filters: { type: Type.STRING },
                skin_retouching: { type: Type.STRING },
                product_enhancement: { type: Type.STRING },
                output: { type: Type.STRING }
            }
        },
        professional_director_notes: {
            type: Type.OBJECT,
            properties: {
                model_direction: { type: Type.STRING, description: "Overall guidance for the model's attitude." },
                wardrobe_styling: { type: Type.STRING, description: "Notes on how the outfit should be worn." },
                set_design: { type: Type.STRING },
                atmosphere: { type: Type.STRING },
                brand_consistency: { type: Type.STRING, description: "How this shoot aligns with a luxury brand like Ounass." }
            }
        },
        model_direction: {
            type: Type.OBJECT,
            properties: {
                characteristics: { type: Type.STRING, description: "Based on the model in the image." },
                posing: { type: Type.STRING, description: "A new, dynamic pose suitable for the scene." },
                expressions: { type: Type.STRING },
                body_language: { type: Type.STRING },
                interaction: { type: Type.STRING, description: "How the model interacts with the environment." },
                hair_makeup: {
                    type: Type.OBJECT,
                    properties: {
                        hair: { type: Type.STRING },
                        makeup: { type: Type.STRING }
                    }
                }
            }
        }
    }
};

const getOutfitDescription = (look: Look): string => {
    return look.products.map(p => `- ${p.name} (Brand: ${p.brand}, Type: ${p.class})`).join('\n');
};

export const generateArtDirectorPrompt = async (
    userInput: LifestyleShootUserInput,
    look: Look,
): Promise<ArtDirectorPrompt> => {
    const outfitDescription = getOutfitDescription(look);

    const artDirectorSystemPrompt = `
You are an AI Art Director for a world-renowned luxury fashion brand, creating a concept for a seasonal lookbook or a top-tier magazine photoshoot.
Your task is to take a user's creative brief and a fashion look, and generate a comprehensive, highly creative, and professional photoshoot plan.
The output MUST be a JSON object that strictly adheres to the provided schema.

**Analysis Task:**
1.  **Analyze the User Brief:**
    - Location: ${userInput.location || 'Not specified'}
    - Mood: ${userInput.mood || 'Not specified'}
    - Time: ${userInput.time || 'Not specified'}
    - Extra Details: ${userInput.details || 'Not specified'}
    - Visual Style: ${userInput.visualStyle}

2.  **Analyze the Outfit:**
${outfitDescription}

3.  **Analyze the Model:**
    Examine the model in the provided image. Infer their characteristics (age, ethnicity, style) to inform your directions.

**Your Creative Output (The Photoshoot Plan):**
Based on your expert analysis, create the ultimate photoshoot concept.

*   **Location Direction:**
    *   If the user specified a location: Elevate their idea. Expand on it with rich, sensory details that evoke a sense of luxury and exclusivity. Describe the specific textures, architecture, and atmosphere.
    *   If the user did NOT specify a location: This is your moment to shine. **Invent a breathtaking, unique, and perfectly suitable location.** Do NOT use a generic list. Think like a location scout for Vogue. Consider the outfit's story. Is it a minimalist architectural masterpiece, a secluded private beach, a vibrant and historic city street, or a lavish interior? Describe this imagined location with vivid detail.

*   **Model Pose:** The model's pose MUST be completely new and different from the static studio shot. It must be a dynamic, natural, and elegant pose that perfectly fits the new scene and mood.
*   **Completeness:** Fill out every single field in the JSON schema with expert, creative, and detailed information. Your choices for lighting, camera, composition, and post-production should all work together to tell a cohesive, luxurious story.
`.trim();
    
    console.log('[AI Art Director] Sending prompt generation request...');
    const imagePart = base64ToGenerativePart(look.finalImage, 'image/jpeg');
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [imagePart, { text: artDirectorSystemPrompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: ART_DIRECTOR_PROMPT_SCHEMA,
        },
    });

    console.log('[AI Art Director] Received prompt:', response.text);
    return JSON.parse(response.text) as ArtDirectorPrompt;
};

export const generateLifestyleImage = async (
  baseImage: string,
  artDirectorPrompt: ArtDirectorPrompt,
): Promise<string> => {
  const imagePart = base64ToGenerativePart(baseImage, 'image/jpeg');
  
  const finalGenerationPrompt = `
**TASK: Create a photorealistic lifestyle image based on a professional art director's plan.**

**CRITICAL RULES:**
1.  **IDENTICAL MODEL & OUTFIT:** The model's face, body, hair, and the complete outfit (including all clothing items and accessories) must be transferred FLAWLESSLY and IDENTICALLY from the original image to the new scene. DO NOT change the model or their clothes.
2.  **EXECUTE THE PLAN:** You MUST follow the detailed JSON brief provided. This includes the new scene, lighting, camera angle, and a new model pose as described in the 'model_direction'.
3.  **REALISTIC SCENE INTEGRATION:** The model must be seamlessly and realistically integrated into the new background. Pay close attention to lighting, shadows, and perspective to make it look like a real photograph.
4.  **HIGH-END PHOTOGRAPHY STYLE:** The final image should look like a professional, high-fashion lifestyle photograph. It should be high-resolution, well-composed, and visually appealing.

**Art Director's Plan (JSON):**
${JSON.stringify(artDirectorPrompt, null, 2)}

Now, generate the final image.
`.trim();
  
  console.log('[Lifestyle Shoot] Sending image generation request...');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: finalGenerationPrompt },
        imagePart,
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  const generatedPart = response.candidates[0].content.parts.find(p => p.inlineData);
  if (!generatedPart || !generatedPart.inlineData) {
    const textPart = response.candidates[0].content.parts.find(p => p.text);
    console.error("[Lifestyle Shoot] Image generation failed. Text response:", textPart?.text);
    throw new Error("Lifestyle image generation failed. The model did not return an image.");
  }

  const base64Image = generatedPart.inlineData.data;
  const mimeType = generatedPart.inlineData.mimeType;
  return `data:${mimeType};base64,${base64Image}`;
};

export const changeImageAspectRatio = async (
  baseImage: string,
  aspectRatio: string
): Promise<string> => {
  const imagePart = base64ToGenerativePart(baseImage, 'image/jpeg');
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

  const generatedPart = response.candidates[0].content.parts.find(p => p.inlineData);
  if (!generatedPart || !generatedPart.inlineData) {
    const textPart = response.candidates[0].content.parts.find(p => p.text);
    console.error("[Aspect Ratio Change] Image generation failed. Text response:", textPart?.text);
    throw new Error("Aspect ratio change failed. The model did not return an image.");
  }

  const base64Image = generatedPart.inlineData.data;
  const mimeType = generatedPart.inlineData.mimeType;
  return `data:${mimeType};base64,${base64Image}`;
};


// --- Other Editing Functions (Unchanged) ---
const EDIT_PROMPT_TEMPLATE = `
**TASK: Edit the base image based on the user's prompt.**
**CRITICAL RULES:**
1.  **PRESERVE UNCHANGED AREAS:** The model's identity, pose, and the background must remain IDENTICAL unless the prompt specifically requests to change them.
2.  **APPLY EDITS REALISTICALLY:** The edits must be photorealistic and seamlessly integrated into the image.
3.  **MAINTAIN HIGH QUALITY:** The output image must be high-resolution and free of artifacts.
**USER PROMPT:** "{PROMPT}"
Analyze the base image and apply the changes described in the user prompt.
`;

export const editImageWithPrompt = async (
  baseImage: string,
  prompt: string
): Promise<string> => {
  const imagePart = base64ToGenerativePart(baseImage, 'image/jpeg');
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

  const generatedPart = response.candidates[0].content.parts.find(p => p.inlineData);
  if (!generatedPart || !generatedPart.inlineData) {
    const textPart = response.candidates[0].content.parts.find(p => p.text);
    console.error("[Image Editing] Image generation failed. Text response:", textPart?.text);
    throw new Error("Image editing failed. The model did not return an image.");
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
  const baseImagePart = base64ToGenerativePart(baseImage, 'image/jpeg');
  const guideImageParts = await filesToGenerativeParts([guideImage]);
  const fullPrompt = EDIT_PROMPT_TEMPLATE.replace('{PROMPT}', prompt) + "\n\n**ADDITIONAL INSTRUCTION:** Use the second image provided as a visual reference for the style, color, or object to add.";

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

  const generatedPart = response.candidates[0].content.parts.find(p => p.inlineData);
  if (!generatedPart || !generatedPart.inlineData) {
    const textPart = response.candidates[0].content.parts.find(p => p.text);
    console.error("[Image Editing] Image generation failed. Text response:", textPart?.text);
    throw new Error("Image editing with guide failed. The model did not return an image.");
  }

  const base64Image = generatedPart.inlineData.data;
  const mimeType = generatedPart.inlineData.mimeType;
  return `data:${mimeType};base64,${base64Image}`;
};