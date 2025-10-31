import { Type } from "@google/genai";
import { ai, urlToGenerativePart } from './geminiUtils';

const TAG_GENERATION_PROMPT = `
You are an expert fashion stylist and merchandiser. Analyze the provided image of a complete look on a model.
Based on the image, generate a list of descriptive and accurate tags.

The tags should cover the following categories:
- **Mood/Aesthetic:** (e.g., elegant, casual, minimalist, bohemian, edgy, romantic, sophisticated)
- **Occasion:** (e.g., evening wear, office attire, weekend casual, beach holiday, formal event, date night)
- **Style/Garment Type:** (e.g., floral print dress, leather jacket, wide-leg trousers, silk blouse, high heels)
- **Key Colors:** (e.g., monochrome, neutral tones, vibrant colors, pastel palette)
- **Key Attributes:** (e.g., textured fabric, gold accessories, statement piece, layered look)

**Instructions:**
- Provide a diverse range of tags, aiming for 10-15 relevant tags.
- Be specific and descriptive. Instead of just "dress", use "midi floral dress".
- The output MUST be a JSON object with a single key "tags" which is an array of strings.
- Example: { "tags": ["elegant", "evening wear", "black slip dress", "minimalist", "gold accessories"] }
`;

const TAG_GENERATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "An array of descriptive tags for the fashion look."
    }
  },
  required: ['tags']
};

/**
 * Generates descriptive tags for a look based on its final image.
 * @param imageUrl The URL of the look's final image.
 * @returns A promise that resolves to an array of string tags.
 */
export const generateTagsForLook = async (imageUrl: string): Promise<string[]> => {
  try {
    console.log('[Tag Generation] Generating tags for image:', imageUrl);
    const imagePart = await urlToGenerativePart(imageUrl);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [imagePart, { text: TAG_GENERATION_PROMPT }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: TAG_GENERATION_SCHEMA,
      },
    });

    console.log('[Tag Generation] Received response:', response.text);
    const result = JSON.parse(response.text);
    return result.tags || [];

  } catch (error) {
    console.error("Error generating tags for look:", error);
    // Return empty array on failure so it doesn't block the save process
    return [];
  }
};
