import { GoogleGenAI } from "@google/genai";
import { Look } from '../types';
import { urlToGenerativePart, urlToBase64 } from './geminiUtils';

const getOutfitDescription = (look: Look): string => {
    return look.products.map(p => `- ${p.name} (Brand: ${p.brand}, Type: ${p.class})`).join('\n');
};

export const generateVideoDirectorPrompt = async (
    look: Look,
    startImage: string,
    endImage: string | null,
    aspectRatio: string
): Promise<string> => {
    const outfitDescription = getOutfitDescription(look);

    const promptForDirector = `
You are an AI Video Director for a luxury fashion brand. Your task is to create a short, compelling video concept.

**Input:**
- A start image of a model wearing an outfit.
- An optional end image of the same model and outfit.
- The outfit description: 
${outfitDescription}
- Desired aspect ratio: ${aspectRatio}.

**Task:**
Generate a single, concise, and highly descriptive prompt for a text-to-video generation model (like Google Veo). This will be used to create the final video.

**Creative Direction:**
- The video should be a seamless, cinematic shot, hyper-realistic, 4k quality.
- If an end image is provided, create a concept that smoothly transitions the model's pose or the scene from the start image to the end image. Describe this transition.
- If no end image is provided, create a concept that brings the static start image to life with subtle, elegant motion. The model could slightly shift their weight, the camera could perform a slow push-in or pan, and the environment could have gentle movement (wind in hair, soft light changes).
- The prompt must describe the model, the full outfit, the setting, the camera movement, and the overall mood.
- The tone should be aspirational, luxurious, and visually rich.

**Output Format:**
A single string containing the final, complete prompt. Do not add any extra text, titles, or explanations. Just the prompt itself.
Example: "An ultra-realistic, cinematic 4k video of a woman wearing a blue silk dress, standing on a balcony overlooking the sea at sunset. A gentle breeze flows through her hair as the camera slowly pushes in. Golden hour lighting, soft and warm."
`.trim();

    console.log('[AI Video Director] Sending prompt generation request...');
    const startImagePart = await urlToGenerativePart(startImage);
    const parts = [startImagePart, { text: promptForDirector }];
    if (endImage) {
        parts.push(await urlToGenerativePart(endImage));
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: parts },
    });
    
    console.log('[AI Video Director] Received prompt:', response.text);
    return response.text.trim();
}


export const generateVideo = async (
    prompt: string,
    startImage: string,
    endImage: string | null,
    aspectRatio: '16:9' | '9:16',
    durationSeconds: number
): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const startImagePart = {
            imageBytes: await urlToBase64(startImage),
            mimeType: 'image/jpeg',
        };

        const lastFramePart = endImage ? {
            imageBytes: await urlToBase64(endImage),
            mimeType: 'image/jpeg',
        } : undefined;

        // FIX: Conditionally build the config. `durationSeconds` and `lastFrame`
        // are mutually exclusive. Sending both causes an "INVALID_ARGUMENT" error.
        const config: {
            numberOfVideos: number;
            resolution: string;
            aspectRatio: '16:9' | '9:16';
            durationSeconds?: number;
            lastFrame?: { imageBytes: string; mimeType: string; };
        } = {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio,
        };
        
        if (lastFramePart) {
            config.lastFrame = lastFramePart;
        } else {
            config.durationSeconds = durationSeconds;
        }

        console.log(`[Veo Service] Starting video generation with config:`, config);
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            image: startImagePart,
            config: config
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
            console.log('[Veo Service] Polling video generation status...');
        }
        
        console.log('[Veo Service] Video generation complete.');
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) throw new Error("Video generation failed, no download link found.");

        console.log('[Veo Service] Fetching video from URI...');
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!response.ok) {
             throw new Error(`Failed to download video file. Status: ${response.status}`);
        }
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result as string);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error: any) {
        console.error("[Veo Service] Error during video generation:", error);
        if (error.message && error.message.includes("Requested entity was not found")) {
            throw new Error("API_KEY_INVALID");
        }
        throw error;
    }
};