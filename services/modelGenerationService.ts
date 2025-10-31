import { Modality, Type } from "@google/genai";
import { Model } from '../types';
import { ai, filesToGenerativeParts } from './geminiUtils';

const MODEL_GENERATION_PROMPT = `
**CRITICAL INSTRUCTION: Generate an ultra-realistic, FULL-BODY photograph of a model standing, from HEAD-TO-TOE. The model's feet MUST be clearly visible and flat on the floor.**

**Style & Composition:**
- Professional model agency polaroid/catalog style.
- The entire body must be vertically centered in the frame.
- **Camera Angle:** Straight-on front view, camera positioned at the model's waist height to ensure a full head-to-toe perspective.
- **Pose:** Standing straight, looking directly at the camera, neutral expression, arms relaxed naturally at the sides.
- **Background:** Seamless, plain, non-distracting, off-white studio background (#F5F5F5).

**Lighting & Camera:**
- **Lighting:** Soft, even, diffuse three-point studio lighting. No harsh shadows or highlights.
- **Camera:** 85mm portrait lens, f/8 aperture, ISO 100.
- **Quality:** Hyper-realistic, high-resolution, sharp focus on the entire subject, natural skin texture, no digital artifacts.

**Model Description:**
{MODEL_SPECIFICS}

**Negative Prompt (WHAT TO AVOID):**
ABSOLUTELY NO cropped images, NO cut-off feet or legs, NO half-body shots, NO portraits, NO sitting, kneeling, or dynamic poses, NO dramatic camera angles, NO wide-angle distortion, NO blur, NO props, NO patterned backgrounds, NO jewelry, NO exaggerated makeup, NO strong shadows, NO cinematic filters.
`;

export const generateModelFromForm = async (formData: Omit<Model, 'imageUrl' | 'id'>): Promise<{imageUrl: string, name: string}> => {
  const clothing = formData.gender === 'Male'
    ? 'wearing a neutral light grey (#D3D3D3) fitted t-shirt and shorts.'
    : 'wearing a neutral light grey (#D3D3D3), minimal and elegant bodysuit.';

  const facialHairPrompt = formData.gender === 'Male' && formData.facialHair !== 'None'
    ? `- Facial Hair: ${formData.facialHair}`
    : '';

  const modelSpecifics = `
- Gender: ${formData.gender}
- Ethnicity: ${formData.ethnicity}
- Apparent Age: ${formData.ageAppearance}
- Height: ${formData.height}
- Skin Tone: ${formData.skinTone}
- Hair Color: ${formData.hairColor}
- Hair Style: ${formData.hairStyle}
- Body Shape: ${formData.bodyShape}
${facialHairPrompt}
- Clothing: The model is ${clothing}
- Feet: The model is barefoot, with both feet flat on the ground.
`;

  const prompt = MODEL_GENERATION_PROMPT.replace('{MODEL_SPECIFICS}', modelSpecifics);
  
  let modelName = formData.name;
  if (!modelName) {
      const namePrompt = `Suggest a single, suitable name for a model with these attributes: Gender: ${formData.gender}, Ethnicity: ${formData.ethnicity}. Just return the name, nothing else.`;
      console.log("[Gemini Service] Sending Name Generation Prompt:", namePrompt);
      const nameResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: namePrompt
      });
      modelName = nameResponse.text.trim();
      console.log("[Gemini Service] Received AI Response (Name):", modelName);
  }

  console.log("[Gemini Service] Sending Model Image Generation Prompt:", prompt);
  const response = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt: prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: '3:4',
      outputMimeType: 'image/jpeg'
    }
  });

  const base64Image = response.generatedImages[0].image.imageBytes;
  return { imageUrl: `data:image/jpeg;base64,${base64Image}`, name: modelName };
};


export const generateModelFromPhoto = async (photos: File[], name?: string): Promise<{imageUrl: string, metadata: Omit<Model, 'imageUrl' | 'name' | 'id'>, name: string}> => {
  const imageParts = await filesToGenerativeParts(photos);

  const metadataPromptText = "Analyze the person in the provided image(s) and describe their physical attributes, including an estimated height in centimeters. Also, suggest a single suitable name for the model. Provide your response as a JSON object.";
  console.log("[Gemini Service] Sending Metadata Extraction Prompt:", metadataPromptText);
  const metadataResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
        parts: [
            ...imageParts,
            { text: metadataPromptText }
        ]
    },
    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                suggestedName: { type: Type.STRING, description: "A single, suitable first name for the model." },
                gender: { type: Type.STRING },
                ethnicity: { type: Type.STRING },
                ageAppearance: { type: Type.STRING, description: "e.g., '20s', '30s'" },
                height: { type: Type.STRING, description: "e.g., '175-180 cm'" },
                skinTone: { type: Type.STRING },
                hairColor: { type: Type.STRING },
                bodyShape: { type: Type.STRING },
                hairStyle: { type: Type.STRING },
                facialHair: { type: Type.STRING, description: "if applicable, otherwise 'none'" }
            },
            required: ['suggestedName', 'gender', 'ethnicity', 'ageAppearance']
        }
    }
  });
  
  console.log('[Gemini Service] Received AI Response (Metadata):', metadataResponse.text);

  const rawMetadata = JSON.parse(metadataResponse.text);
  const metadata = {
    gender: rawMetadata.gender || 'Female',
    ethnicity: rawMetadata.ethnicity || 'Caucasian',
    ageAppearance: rawMetadata.ageAppearance || '20s',
    height: rawMetadata.height || "171-175 cm",
    skinTone: rawMetadata.skinTone || 'N/A',
    hairColor: rawMetadata.hairColor || 'N/A',
    bodyShape: rawMetadata.bodyShape || 'N/A',
    hairStyle: rawMetadata.hairStyle || 'N/A',
    facialHair: rawMetadata.facialHair || 'None',
  };

  const modelName = name || rawMetadata.suggestedName || 'New Model';

  const clothingPrompt = metadata.gender.toLowerCase() === 'male'
    ? 'a neutral light grey (#D3D3D3) fitted t-shirt and shorts.'
    : 'a neutral light grey (#D3D3D3), minimal and elegant bodysuit.';
    
  const modelSpecifics = `
- **IDENTITY**: Re-create the person from the reference image IDENTICALLY. Match their facial features, skin tone, estimated height (${metadata.height}), age appearance, hair color, hairstyle, body shape, and any facial hair.
- **Clothing**: The model's clothing must be: ${clothingPrompt}
- **Feet**: The model must be barefoot with both feet flat on the ground.
`;
  
  const prompt = MODEL_GENERATION_PROMPT.replace('{MODEL_SPECIFICS}', modelSpecifics);

  console.log("[Gemini Service] Sending Model Image Generation from Photo Prompt:", prompt);
  const imageResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: prompt },
        ...imageParts
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });
  
  const candidate = imageResponse.candidates?.[0];
  if (!candidate || !candidate.content || !candidate.content.parts) {
    const blockReason = candidate?.finishReason;
    const safetyRatings = candidate?.safetyRatings;
    console.error(`[Model Gen] Generation failed. Block Reason: ${blockReason}`, { safetyRatings });

    let errorMessage = "Model creation failed. The model did not return a valid image response.";
    if (blockReason === 'SAFETY') {
        errorMessage = "The request was blocked due to safety policies. Please try a different photo.";
    } else if (imageResponse.text) {
        errorMessage = `Model creation failed. Details: ${imageResponse.text}`;
    }
    throw new Error(errorMessage);
  }

  const textPart = candidate.content.parts.find(p => p.text);
  if (textPart) {
    console.log("[Gemini Service] Received AI Text Response (Image Gen):", textPart.text);
  }

  const generatedPart = candidate.content.parts.find(p => p.inlineData);
  if (!generatedPart || !generatedPart.inlineData) throw new Error("Image generation failed. The model returned text but no image.");


  const base64Image = generatedPart.inlineData.data;
  const mimeType = generatedPart.inlineData.mimeType;
  
  return { imageUrl: `data:${mimeType};base64,${base64Image}`, metadata, name: modelName };
};