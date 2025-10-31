import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import type { NextApiRequest, NextApiResponse } from 'next';

// NOTE: The default Vercel body parser is now ENABLED by removing the config export.
// The client-side `upload` function sends a JSON request to get a signed URL,
// so the body must be parsed. Disabling the parser was incorrect and caused the token error.

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  const body = request.body as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        // This function is called before a token is generated.
        // It can be used to override the token's properties.
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
          tokenPayload: JSON.stringify({
            // Pass custom metadata to the onUploadCompleted callback
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This function is called after the blob is uploaded.
        // It can be used to store the blob details in a database.
        console.log('Blob upload completed', blob, tokenPayload);
      },
    });

    return response.status(200).json(jsonResponse);
  } catch (error) {
    console.error('Error in blob upload handler:', error);
    return response.status(400).json({ error: (error as Error).message });
  }
}
