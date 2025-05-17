// File: /api/recordings/[recordingId]/upload.js
// Handles POST /api/recordings/:recordingId/upload
// Vercel function acts as a proxy to an AWS API Gateway endpoint for audio intake and processing.

import { authenticateToken } from '/var/task/api/utils/auth.js'; // Adjust path if utils is elsewhere
// For Node.js < 18, you might need 'node-fetch'. For Node 18+, global fetch is available.
// import fetch from 'node-fetch'; 
// If you were to parse multipart/form-data within this Vercel function before proxying:
// import formidable from 'formidable-serverless'; // or 'formidable' v3+
// import fs from 'fs'; // if using formidable and need to read temp file path

// Environment Variables (set in Vercel project settings)
const API_GATEWAY_AUDIO_INTAKE_ENDPOINT = process.env.API_GATEWAY_AUDIO_INTAKE_ENDPOINT;
const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY; // Optional: if your API Gateway endpoint is secured with an API key

if (!API_GATEWAY_AUDIO_INTAKE_ENDPOINT || !process.env.JWT_SECRET) {
    console.error("FATAL_ERROR: Missing critical environment variables for /api/recordings/[recordingId]/upload. This function cannot operate.");
}

// Vercel specific config if handling multipart/form-data directly in the function before proxying
// (Generally, for proxying, you want Vercel to stream the body as is)
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

    const authResult = authenticateToken(req);
    if (!authResult.authenticated) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Unauthorized" });
    }
    const userId = authResult.user.userId; 

    if (!recordingId) {
        return res.status(400).json({ success: false, message: "Recording ID is required in the path." });
    }
    if (!API_GATEWAY_AUDIO_INTAKE_ENDPOINT) { // Re-check for safety
        return res.status(500).json({ success: false, message: "Server configuration error for audio processing." });
    }

    try {
        // This Vercel function proxies the multipart/form-data request to AWS API Gateway.
        // API Gateway must be configured for binary passthrough or to handle multipart/form-data
        // and trigger an AWS Lambda ("Audio Intake Lambda").

        const headersToApiGw = {
            // Forward the original Content-Type, which includes the multipart boundary.
            'Content-Type': req.headers['content-type'],
            // Forward Content-Length if available and potentially required by API Gateway or Lambda.
            ...(req.headers['content-length'] && { 'Content-Length': req.headers['content-length'] }),
            ...(API_GATEWAY_KEY && { 'x-api-key': API_GATEWAY_KEY }),
            'X-User-Id': userId, 
            'X-Recording-Id': recordingId, 
            // If other form fields (notes, quality, originalMeetingId, title) are sent by frontend's FormData:
            // These will be part of the multipart body that is proxied.
            // The AWS Lambda behind API Gateway will need to parse the multipart body to get these fields.
        };
        
        console.log(`API: Proxying audio upload for recordingId: ${recordingId} to API Gateway: ${API_GATEWAY_AUDIO_INTAKE_ENDPOINT}`);
        
        // Use global fetch (available in Node 18+ on Vercel)
        const responseFromApiGw = await fetch(API_GATEWAY_AUDIO_INTAKE_ENDPOINT, {
            method: 'POST',
            headers: headersToApiGw,
            body: req.body, // Stream the incoming request body from Vercel to API Gateway
            // duplex: 'half' // May be needed for older node-fetch or specific streaming scenarios
        });

        const responseBodyText = await responseFromApiGw.text();
        let result;
        try {
            result = JSON.parse(responseBodyText);
        } catch (e) {
            console.error("Failed to parse API Gateway response as JSON for upload:", responseBodyText, "Status:", responseFromApiGw.status);
            throw new Error(`Invalid response from audio processing service. Status: ${responseFromApiGw.status}. Response: ${responseBodyText.substring(0, 200)}...`);
        }

        if (!responseFromApiGw.ok) {
            console.error("API Gateway Error Data for upload:", result);
            throw new Error(result.message || `Audio processing initiation failed via API Gateway: ${responseFromApiGw.status}`);
        }
        
        console.log(`API: Upload for ${recordingId} proxied. API GW response:`, result);
        // The response from API Gateway should confirm that the audio processing has been initiated.
        // It might return a job ID or confirm the recordingId.
        res.status(responseFromApiGw.status).json(result); 

    } catch (error) {
        console.error(`API Error uploading recording ${recordingId}:`, error);
        res.status(500).json({ success: false, message: 'Failed to submit recording for processing.', errorDetails: error.message });
    }
}