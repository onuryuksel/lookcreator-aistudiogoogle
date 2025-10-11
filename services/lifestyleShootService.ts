import { Modality, Type } from '@google/genai';
import { Look, LifestyleShootUserInput, ArtDirectorPrompt } from '../types';
import { ai, base64ToGenerativePart, filesToGenerativeParts } from './geminiUtils';

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
                skin_retouching: { type: Type.STRING, description: "e.g., 'Natural, minimal retouching to preserve skin texture. Avoid an overly smooth, artificial look.'" },
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
                brand_consistency: { type: Type.STRING, description: "How this shoot aligns with a luxury brand like Ounass, focusing on authenticity and hyperrealism." }
            }
        },
        model_direction: {
            type: Type.OBJECT,
            properties: {
                characteristics: { type: Type.STRING, description: "Based on the model in the image." },
                posing: { type: Type.STRING, description: "A new, dynamic pose suitable for the scene." },
                expressions: { type: Type.STRING, description: "Subtle, natural, and authentic expressions. Avoid anything exaggerated or artificial." },
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

**Core Objective: Hyperrealism.** The final image must be indistinguishable from a high-end photograph. Pay meticulous attention to creating a natural, lifelike model, especially in the face, expression, and skin texture. Your plan must facilitate this realism.

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

*   **Model Pose & Expression:** The model's pose MUST be completely new and different from the static studio shot. It must be a dynamic, natural, and elegant pose. The facial expression must be subtle and authentic, avoiding any hint of artificiality.
*   **Completeness:** Fill out every single field in the JSON schema with expert, creative, and detailed information. Your choices for lighting, camera, composition, and post-production should all work together to tell a cohesive, luxurious story focused on achieving hyperrealism.
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

export const generateArtDirectorPromptFromImage = async (
    referenceImage: File,
    look: Look,
): Promise<ArtDirectorPrompt> => {
    const outfitDescription = getOutfitDescription(look);

    const artDirectorSystemPromptFromImage = `
You are an AI Art Director with a photographer's eye, tasked with creating a textual blueprint of a scene. Your goal is to describe the provided reference image with such extreme detail that a person who cannot see it could paint a vivid, accurate picture of it in their mind. You will then use this description to create a professional photoshoot plan.
The output MUST be a JSON object that strictly adheres to the provided schema.

**CRITICAL INSTRUCTION: Your description must focus ONLY on the environment, atmosphere, composition, and the POSE of the person in the reference image. DO NOT describe the person's physical appearance (face, hair, ethnicity, etc.) or their clothing. You are describing a stage, not the actor on it.**

**Analysis Task: Describe the Scene for a Blind Person**
1.  **Deconstruct the Reference Image (First Image):** Meticulously analyze the scene.
    *   **The Space:** Where are we? Is it a grand hallway, a sun-drenched loft, a moody library? Describe the architecture. Detail the materials—the grain and finish of the wooden floors, the texture of the plaster walls, the cool metal of a window frame.
    *   **The Light:** How is the scene lit? Is it soft, diffused light from a large window? Is it a dramatic, hard light creating sharp shadows? What is the color of the light—is it the warm gold of late afternoon or the cool blue of morning? Describe how this light interacts with the space, creating highlights on the floor and gentle gradients on the walls.
    *   **The Atmosphere:** What is the mood? Is it serene and calm, opulent and luxurious, or mysterious and intimate? Use sensory language to evoke this feeling.
    *   **The Composition:** Describe the camera's perspective. Is it a wide shot showing the scale of the space, or an intimate medium shot? Where is the camera placed? How does it use depth of field to draw focus?
    *   **The Pose:** This is crucial. Deconstruct the person's pose limb by limb, as if you are a choreographer. Describe the angle of the head, the direction of their gaze, the position of their arms, hands, and fingers. How is their weight distributed? What is the position of their legs and feet? This pose will be adopted by our new model.

2.  **Information about the NEW Look (to be inserted into the replicated scene):**
    *   **Outfit to use:**
        ${outfitDescription}
    *   **Model to use:** Analyze the model from the second image provided (the "look" image). Note their characteristics (these will be used by the photographer AI later).

**Your Creative Output (The Photoshoot Plan):**
Based on your hyper-detailed "description for a blind person," fill out every field in the JSON schema. The 'scene_setting', 'lighting_setup', and 'composition' sections must be populated with your rich, narrative description. The 'model_direction.posing' field must contain your exhaustive, limb-by-limb deconstruction of the pose from the reference image. The final JSON will serve as the complete and only blueprint for the photographer.
`.trim();

    console.log('[AI Art Director from Image] Sending prompt generation request...');
    
    const lookImagePart = base64ToGenerativePart(look.finalImage, 'image/jpeg');
    const referenceImageParts = await filesToGenerativeParts([referenceImage]);

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [...referenceImageParts, lookImagePart, { text: artDirectorSystemPromptFromImage }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: ART_DIRECTOR_PROMPT_SCHEMA,
        },
    });

    console.log('[AI Art Director from Image] Received prompt:', response.text);
    return JSON.parse(response.text) as ArtDirectorPrompt;
};


export const generateLifestyleImage = async (
  baseImage: string, // This is look.finalImage
  artDirectorPrompt: ArtDirectorPrompt,
  aspectRatio: string
): Promise<string> => {
    const lookImagePart = base64ToGenerativePart(baseImage, 'image/jpeg');
   
    const finalGenerationPrompt = `
You are an AI photographer creating a hyperrealistic lifestyle image based on a professional art director's plan.

**Your Goal:** Produce a new photograph featuring the *exact same model and outfit* from the original image, but place them in the new scene described in the Art Director's Plan. The model should adopt the new pose and expression from the plan.

**Key Rules for a Flawless Photo:**
1.  **Model & Outfit Consistency:** It is crucial that the model (their face, body, hair) and their complete outfit are identical to the original image. You are changing the setting and pose, not the person or what they're wearing.
2.  **Follow the Art Director's Plan:** The provided JSON plan is your complete and only guide. You must adhere to its rich, descriptive specifications for the new scene, lighting, camera work, and model direction.
3.  **Seamless Integration:** The model must look like they were naturally photographed in the new environment. Pay close attention to realistic lighting, shadows, and perspective.
4.  **Hyperrealism is Key:** The final image must be indistinguishable from a real, high-fashion photograph. The model's face and skin must look completely natural and human, with no 'AI-generated' artifacts.

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
                lookImagePart
            ],
        },
        config: {
            // @ts-ignore - This property is used to control the output image's aspect ratio.
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
        console.error(`[Lifestyle Shoot] Generation failed. Block Reason: ${blockReason}`, { safetyRatings });

        let errorMessage = "Lifestyle image generation failed. The model did not return a valid image response.";
        if (blockReason === 'SAFETY') {
            errorMessage = "The request was blocked due to safety policies. Please adjust your creative brief.";
        } else if (response.text) {
            errorMessage = `Lifestyle image generation failed. Details: ${response.text}`;
        }
        throw new Error(errorMessage);
    }

    const generatedPart = candidate.content.parts.find(p => p.inlineData);
    if (!generatedPart || !generatedPart.inlineData) {
        const textPart = candidate.content.parts.find(p => p.text);
        console.error("[Lifestyle Shoot] Image generation failed. Text response:", textPart?.text);
        throw new Error("Lifestyle image generation failed. The model returned text but no image.");
    }

    const base64Image = generatedPart.inlineData.data;
    const mimeType = generatedPart.inlineData.mimeType;
    return `data:${mimeType};base64,${base64Image}`;
};