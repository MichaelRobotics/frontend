// File: /api/recordings/[recordingId]/upload.js
// Handles POST /api/recordings/:recordingId/upload
// This Vercel Serverless Function acts as an authenticated proxy to an AWS API Gateway endpoint,
// which in turn triggers an AWS Lambda for audio intake, S3 upload, and initial processing.

import { authenticateToken } from '../../utils/auth.js'; // Path to your JWT authentication utility

// Environment Variables (must be set in Vercel project settings)
const API_GATEWAY_AUDIO_INTAKE_ENDPOINT = process.env.API_GATEWAY_AUDIO_INTAKE_ENDPOINT;
const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY; // Optional: API key for your API Gateway endpoint

// Critical environment variable check at module load time
if (!API_GATEWAY_AUDIO_INTAKE_ENDPOINT) {
    console.error("FATAL_ERROR: API_GATEWAY_AUDIO_INTAKE_ENDPOINT is not defined. Audio upload functionality will fail.");
}
if (!process.env.JWT_SECRET) { // JWT_SECRET is used by authenticateToken
    console.error("FATAL_ERROR: JWT_SECRET is not defined. Authentication for uploads will fail.");
}

// Vercel specific config: bodyParser must be false to handle multipart/form-data streaming/proxying.
// This is often the default behavior when the Content-Type is multipart/form-data,
// but explicitly setting it or ensuring it's not parsed by Vercel is key.
// If not using a framework that handles this, Vercel usually passes the raw stream.
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

    // Re-check critical env vars inside handler for runtime safety
    if (!API_GATEWAY_AUDIO_INTAKE_ENDPOINT || !process.env.JWT_SECRET) {
        return res.status(500).json({ success: false, message: "Server configuration error: Audio processing system endpoint or JWT secret not configured." });
    }

    const { recordingId } = req.query; // Extract recordingId from the dynamic path segment

    // Authenticate the request using JWT
    const authResult = authenticateToken(req);
    if (!authResult.authenticated) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Unauthorized: Invalid or missing token." });
    }
    const userId = authResult.user.userId; // Get userId from the validated token payload

    if (!recordingId) {
        return res.status(400).json({ success: false, message: "Recording ID is required in the URL path." });
    }

    try {
        // Prepare headers to be forwarded to the AWS API Gateway.
        // It's crucial to forward the original Content-Type header as it includes the
        // boundary for the multipart/form-data.
        const headersToApiGw = {
            'Content-Type': req.headers['content-type'],
            // Forward Content-Length if available and required by API Gateway or the backend Lambda.
            // Some API Gateway configurations might not need it if streaming directly to Lambda.
            ...(req.headers['content-length'] && { 'Content-Length': req.headers['content-length'] }),
            // Add API Gateway specific API key if configured
            ...(API_GATEWAY_KEY && { 'x-api-key': API_GATEWAY_KEY }),
            // Custom headers for context to the backend Lambda
            'X-User-Id': userId, 
            'X-Recording-Id': recordingId, 
            // Other metadata like 'title', 'notes', 'originalMeetingId', 'quality' are expected to be
            // part of the multipart/form-data body sent by the client (e.g., RecorderView.js).
            // The AWS Lambda behind API Gateway will parse these fields from the multipart body.
        };
        
        console.log(`API [upload.js]: Proxying audio upload for recordingId: ${recordingId} by userId: ${userId} to API Gateway: ${API_GATEWAY_AUDIO_INTAKE_ENDPOINT}`);
        
        // Use global fetch (available in Node 18+ on Vercel) to proxy the request.
        // The `req.body` for a Vercel serverless function (when bodyParser is not interfering)
        // is a readable stream for POST/PUT requests with bodies. Fetch can handle this.
        const responseFromApiGw = await fetch(API_GATEWAY_AUDIO_INTAKE_ENDPOINT, {
            method: 'POST',
            headers: headersToApiGw,
            body: req.body, // Stream the incoming request body from Vercel to API Gateway
        });

        // Process the response from API Gateway
        const responseBodyText = await responseFromApiGw.text(); // Read as text first for robust error diagnosis
        let resultPayload;
        try {
            resultPayload = JSON.parse(responseBodyText); // Assume backend Lambda returns JSON
        } catch (e) {
            // If API Gateway or Lambda returns non-JSON (e.g., an HTML error page, or plain text error)
            console.error(`API [upload.js]: Failed to parse API Gateway response as JSON for recordingId ${recordingId}. Status: ${responseFromApiGw.status}. Response Text: ${responseBodyText.substring(0, 500)}...`);
            // Return a generic error or try to relay what was received if safe
            return res.status(responseFromApiGw.status || 502).json({ 
                success: false, 
                message: `Invalid response from audio processing service. Status: ${responseFromApiGw.status}.`,
                rawResponse: responseBodyText.substring(0, 200) // Include a snippet for debugging
            });
        }

        if (!responseFromApiGw.ok) {
            // If API Gateway/Lambda returned an error status code (4xx, 5xx) but valid JSON
            console.error(`API [upload.js]: API Gateway returned an error for recordingId ${recordingId}. Status: ${responseFromApiGw.status}. Payload:`, resultPayload);
            throw new Error(resultPayload.message || `Audio processing initiation failed via API Gateway with status: ${responseFromApiGw.status}`);
        }
        
        // The response from API Gateway/Lambda should confirm that audio processing has been initiated.
        // It might return a job ID, confirm the recordingId, or provide an initial status.
        // This `resultPayload` is what will be sent back to the frontend client.
        console.log(`API [upload.js]: Upload for recordingId ${recordingId} proxied successfully. API GW response status: ${responseFromApiGw.status}. Payload:`, resultPayload);
        res.status(responseFromApiGw.status).json(resultPayload); // Forward the successful JSON payload

    } catch (error) {
        console.error(`API [upload.js]: Error processing upload for recordingId ${recordingId}:`, error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to submit recording for processing due to an internal server error.', 
            errorDetails: error.message 
        });
    }
}
