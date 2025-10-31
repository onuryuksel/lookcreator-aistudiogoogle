import { handleUpload } from '@vercel/blob/client';
import type { NextApiRequest, NextApiResponse } from 'next';

// By adding this config, we disable the default Vercel body parser for this route.
// This is crucial because the Vercel Blob client needs to handle the raw request stream.
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  try {
    // The `handleUpload` function from `@vercel/blob/client` needs the raw `request`
    // object to process the file stream. The incorrect `body: request` line has been removed.
    const jsonResponse = await handleUpload({
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
          tokenPayload: JSON.stringify({
            // Optional: pass any custom metadata to your on-upload-completed function
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Optional: Perform any server-side actions after the file has been uploaded.
        // E.g., save blob.url to your database.
        console.log('Blob upload completed', blob, tokenPayload);
      },
    });

    return response.status(200).json(jsonResponse);
  } catch (error) {
    console.error('Error in blob upload handler:', error);
    // The error is already an object with a message property, so we can pass it directly
    return response.status(400).json({ error: (error as Error).message });
  }
}
