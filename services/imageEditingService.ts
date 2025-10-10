import { Modality, Type } from '@google/genai';
import { Look, LifestyleShootUserInput, ArtDirectorPrompt } from '../types';
import { ai, base64ToGenerativePart, filesToGenerativeParts } from './geminiUtils';

// --- START: Lifestyle Shoot Constants ---
const ICONIC_LOCATIONS_CONTEXT = `
ICONIC CITIES: Paris, Milan, NYC, London, Tokyo, Dubai, Los Angeles, Hong Kong, Rome, Istanbul, Barcelona, Marrakech, Vienna, Cape Town, Sydney
ICONIC OUTDOOR LOCATIONS: Santorini cliffs, Amalfi Coast, Central Park NYC, Dubai Desert, Jardin des Tuileries Paris, Cinque Terre, Shibuya Crossing, Lake Como, Cappadocia, Joshua Tree, Swiss Alps
ICONIC HOTELS: Ritz Paris, Burj Al Arab Dubai, Plaza Athénée Paris, Peninsula Hong Kong, Aman Tokyo, Gritti Palace Venice, Beverly Hills Hotel, La Mamounia Marrakech
ICONIC RESTAURANTS: Noma Copenhagen, Cipriani Venice, Le Jules Verne Paris, Zuma Dubai, Caviar Kaspia Paris, Nobu Malibu, Sketch London
ICONIC MONUMENTS: Eiffel Tower, Colosseum, Statue of Liberty, Burj Khalifa, Taj Mahal, Big Ben, Arc de Triomphe, Sagrada Familia
ICONIC SQUARES: Times Square, Piazza San Marco Venice, Place Vendôme Paris, Trafalgar Square London, Red Square Moscow
ICONIC INTERIORS: Versailles Hall of Mirrors, Louvre galleries, Met Museum NYC, Milan Cathedral, Royal Opera House London
ICONIC BRIDGES: Pont Alexandre III Paris, Brooklyn Bridge NYC, Golden Gate Bridge, Tower Bridge London, Rialto Bridge Venice
ICONIC BEACHES: Bondi Beach, Whitehaven Beach, Seychelles, Malibu Beach, Navagio Beach Greece
ICONIC SHOPPING: Champs-Élysées, Rodeo Drive, Bond Street, Ginza Tokyo, Via Montenapoleone Milan, Fifth Avenue NYC
ICONIC ROOFTOPS: Sky Garden London, The Roof NYC, Cé La Vie Singapore, View at The Palm Dubai
ICONIC VIEWPOINTS: Top of the Rock NYC, Montmartre Paris, The Peak Hong Kong, Table Mountain Cape Town
WINTER LOCATIONS: St. Moritz, Aspen, Courchevel, Zermatt, Lapland Northern Lights
`.trim();

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
You are an AI Art Director for a luxury fashion brand like Ounass.
Your task is to take a user's creative brief and a description of a fashion look, and generate a comprehensive, professional photoshoot plan.
You must return your plan as a JSON object that strictly adheres to the provided schema.

**Context of Iconic Locations (for inspiration if the user doesn't provide a location):**
${ICONIC_LOCATIONS_CONTEXT}

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

**Your Output:**
Based on your analysis, create the ultimate photoshoot plan.
- If the user specified a location, create a vivid, detailed scene around it.
- If the user did NOT specify a location, choose the MOST SUITABLE location from the iconic locations list that fits the outfit's style and the user's requested mood/visual style.
- The model's pose MUST be different from the studio shot. It should be a dynamic, natural pose that fits the new scene.
- Fill out every single field in the JSON schema with expert, creative, and detailed information.
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