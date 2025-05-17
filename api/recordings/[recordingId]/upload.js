// File: /api/recordings/[recordingId]/upload.js
// Handles POST /api/recordings/:recordingId/upload
// Vercel function acts as a proxy to an AWS API Gateway endpoint for audio intake and processing.

import { authenticateToken } from '../../../utils/auth'; // Adjust path to your auth.js utility
// import fetch from 'node-fetch'; // For Node.js < 18, or use global fetch in Node 18+
// For handling multipart/form-data if Vercel function needs to parse before proxying:
// import formidable from 'formidable-serverless';
// import fs from 'fs'; // If reading from temp file path from formidable

// Environment Variables (set in Vercel project settings)
const API_GATEWAY_AUDIO_INTAKE_ENDPOINT = process.env.API_GATEWAY_AUDIO_INTAKE_ENDPOINT;
const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY; // If your API Gateway endpoint is secured with an API key

// Vercel specific config if handling multipart/form-data directly in the function before proxying
// export const config = {
//   api: {
//     bodyParser: false, 
//   },
// };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    const { recordingId } = req.query; 

    // Authenticate the user making the upload request
    const authResult = authenticateToken(req);
    if (!authResult.authenticated) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Unauthorized" });
    }
    const userId = authResult.user.userId; 

    if (!recordingId) {
        return res.status(400).json({ success: false, message: "Recording ID is required in the path." });
    }
    if (!API_GATEWAY_AUDIO_INTAKE_ENDPOINT) {
        console.error("CRITICAL_ERROR: API_GATEWAY_AUDIO_INTAKE_ENDPOINT is not configured.");
        return res.status(500).json({ success: false, message: "Server configuration error for audio processing." });
    }

    try {
        // This Vercel function proxies the multipart/form-data request to AWS API Gateway.
        // The most robust way to handle file uploads to another service from a Vercel function
        // is often to stream the request body directly if the receiving endpoint (API Gateway)
        // is configured to handle raw binary streams or multipart/form-data passthrough.

        // Construct headers for the API Gateway request
        const headersToApiGw = {
            // Forward the original Content-Type, which includes the multipart boundary
            'Content-Type': req.headers['content-type'],
            // Forward Content-Length if available and required by API Gateway
            ...(req.headers['content-length'] && { 'Content-Length': req.headers['content-length'] }),
            ...(API_GATEWAY_KEY && { 'x-api-key': API_GATEWAY_KEY }),
            'X-User-Id': userId, 
            'X-Recording-Id': recordingId, 
            // If other form fields (notes, quality, originalMeetingId, title) are sent
            // and API Gateway + Lambda can parse them from multipart, they will be part of `req.body`.
            // If not, you'd parse them here with `formidable` and send them as separate headers or in a JSON part.
        };
        
        console.log(`API: Proxying audio upload for recordingId: ${recordingId} to API Gateway: ${API_GATEWAY_AUDIO_INTAKE_ENDPOINT}`);
        
        const responseFromApiGw = await fetch(API_GATEWAY_AUDIO_INTAKE_ENDPOINT, {
            method: 'POST',
            headers: headersToApiGw,
            body: req, // Stream the incoming request body. Node 18+ fetch supports this.
                      // For older Node, `req` is a ReadableStream, might need `node-fetch` with specific handling.
            // duplex: 'half' // May be needed for some Node.js fetch implementations when streaming request body
        });

        const responseBodyText = await responseFromApiGw.text();
        let result;
        try {
            result = JSON.parse(responseBodyText);
        } catch (e) {
            console.error("API Gateway response was not valid JSON:", responseBodyText, "Status:", responseFromApiGw.status);
            // If API Gateway returns a non-JSON error (e.g., HTML error page), capture that.
            throw new Error(`Invalid response from audio processing service. Status: ${responseFromApiGw.status}. Response: ${responseBodyText.substring(0, 200)}`);
        }

        if (!responseFromApiGw.ok) {
            console.error("API Gateway Error Data:", result);
            throw new Error(result.message || `Audio processing initiation failed via API Gateway: ${responseFromApiGw.status}`);
        }
        
        console.log(`API: Upload for ${recordingId} proxied. API GW response:`, result);
        // The Vercel function's primary role here is to proxy and relay the response.
        // Any DB updates related to the *original meeting* (e.g., setting its status to 'Processing')
        // should ideally be handled by the Audio Intake Lambda after successful S3 upload,
        // or this Vercel function could do it if the API Gateway response confirms receipt by Lambda.
        res.status(responseFromApiGw.status).json(result); 

    } catch (error) {
        console.error(`API Error uploading recording ${recordingId}:`, error);
        res.status(500).json({ success: false, message: 'Failed to submit recording for processing.', errorDetails: error.message });
    }
}
