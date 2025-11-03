import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs';
// FIX: Import 'process' to provide correct types for process.cwd() in the Node.js environment.
import process from 'process';

// Define minimal types needed for this function to avoid dependency issues.
interface Look {
    id: number;
    finalImage: string;
}
interface Lookboard {
    title: string;
    note?: string;
}
interface LookOverrides {
    [key: number]: { finalImage: string };
}
interface ApiResponseData {
    lookboard: Lookboard;
    looks: Look[];
    overrides?: LookOverrides;
}


// Helper to create meta tags safely
const createMetaTag = (property: string, content: string) => {
    const attr = property.startsWith('og:') ? 'property' : 'name';
    // Escape content to prevent HTML injection
    const escapedContent = content.replace(/"/g, '&quot;');
    return `<meta ${attr}="${property}" content="${escapedContent}">`;
};

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
    try {
        const url = request.url!;
        let apiUrl = '';

        const publicMatch = url.match(/\/board\/public\/(.*)/);
        if (publicMatch && publicMatch[1]) {
            const publicId = publicMatch[1].split('?')[0]; // Remove query params
            apiUrl = `https://${request.headers['x-forwarded-host']}/api/board/public/${publicId}`;
        }

        const instanceMatch = url.match(/\/board\/instance\/(.*)/);
        if (instanceMatch && instanceMatch[1]) {
            const instanceId = instanceMatch[1].split('?')[0];
            apiUrl = `https://${request.headers['x-forwarded-host']}/api/board/instance/${instanceId}`;
        }

        let metaTagsBlock = '';

        if (apiUrl) {
            try {
                const apiResponse = await fetch(apiUrl);
                if (apiResponse.ok) {
                    const data: ApiResponseData = await apiResponse.json();
                    const { lookboard, looks, overrides } = data;
                    
                    if (lookboard && looks) {
                        const title = lookboard.title || 'Ounass Look Creator';
                        const description = lookboard.note || 'An AI-powered application to create virtual try-ons and model photoshoots.';
                        const pageUrl = `https://${request.headers['x-forwarded-host']}${url}`;
                        
                        let imageUrl = '';
                        const firstLook = looks[0];
                        if (firstLook) {
                            imageUrl = (overrides && overrides[firstLook.id]?.finalImage) || firstLook.finalImage;
                        }

                        let tags = [];
                        tags.push(`<!-- Dynamic Social Meta Tags for ${title.replace(/"/g, '&quot;')} -->`);
                        tags.push(createMetaTag('og:site_name', 'Ounass Look Creator'));
                        tags.push(createMetaTag('og:url', pageUrl));
                        tags.push(createMetaTag('og:title', title));
                        tags.push(createMetaTag('twitter:title', title));
                        tags.push(createMetaTag('og:description', description));
                        tags.push(createMetaTag('twitter:description', description));
                        tags.push(createMetaTag('og:type', 'website'));
                        tags.push(createMetaTag('twitter:card', 'summary_large_image'));
                        
                        if (imageUrl) {
                            tags.push(createMetaTag('og:image', imageUrl));
                            tags.push(createMetaTag('twitter:image', imageUrl));
                            tags.push(createMetaTag('og:image:width', '600')); // Typical vertical image width
                            tags.push(createMetaTag('og:image:height', '800')); // Assuming 3:4 aspect ratio
                        }
                        metaTagsBlock = tags.join('\n');
                    }
                }
            } catch (error) {
                console.error('Failed to fetch board data for SSR meta tags:', error);
                // Fail gracefully, will serve HTML without dynamic tags
            }
        }

        const indexPath = path.join(process.cwd(), 'index.html');
        const html = fs.readFileSync(indexPath, 'utf-8');
        let modifiedHtml;

        if (metaTagsBlock) {
            // Replace the entire default block with the dynamically generated one
            modifiedHtml = html.replace(/<!-- SOCIAL_META_TAGS_BLOCK -->[\s\S]*?<!-- END_SOCIAL_META_TAGS_BLOCK -->/, metaTagsBlock);
        } else {
            // If we didn't generate tags (e.g., API error), just serve the original HTML with default tags
            modifiedHtml = html;
        }
        
        response.setHeader('Content-Type', 'text/html');
        response.status(200).send(modifiedHtml);

    } catch (error) {
        console.error('Error in render function:', error);
        // Fallback to sending a generic error or the unmodified HTML
        try {
            const indexPath = path.join(process.cwd(), 'index.html');
            const html = fs.readFileSync(indexPath, 'utf-8');
            response.setHeader('Content-Type', 'text/html');
            response.status(200).send(html);
        } catch (e) {
            response.status(500).json({ message: 'Internal Server Error' });
        }
    }
}