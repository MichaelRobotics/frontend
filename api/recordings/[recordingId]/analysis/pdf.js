// File: /api/recordings/[recordingId]/analysis/pdf.js
// Handles GET /api/recordings/:recordingId/analysis/pdf
// Vercel function acts as a proxy to AWS API Gateway for PDF Lambda.

// const fetch = require('node-fetch');
// const { authenticateTokenOrClientAccess } = require('../../../../utils/auth'); // Adjust path
// const AWS = require('aws-sdk'); // For fetching context from DynamoDB if needed by Vercel func

// Configure AWS SDK for DynamoDB (if Vercel func needs to fetch data to pass to API GW)
// AWS.config.update({ /* ... */ });
// const dynamoDb = new AWS.DynamoDB.DocumentClient();
// const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;

// const PDF_API_GATEWAY_ENDPOINT = process.env.PDF_API_GATEWAY_ENDPOINT; // e.g., https://your-api-gw.execute-api.region.amazonaws.com/prod/generate-pdf
// const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY;

// Placeholder for your actual authentication and role determination logic
async function authenticateTokenOrClientAccess(req, recordingId) {
    const userToken = req.headers.authorization;
    if (userToken && (userToken.includes("salesperson") || userToken.includes("recorder"))) {
        return { granted: true, role: userToken.includes("salesperson") ? "salesperson" : "recorder", user: { id: "user-sim-123"} };
    }
    if (req.headers['x-client-validated-for-recording'] === recordingId) return { granted: true, role: "client" };
    return { granted: true, role: req.headers['x-simulated-role'] || "client", user: { id: "user-sim-123"} }; // Default for testing
    // return { granted: false, message: "Access Denied", status: 401 };
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    const { recordingId } = req.query;

    const authResult = await authenticateTokenOrClientAccess(req, recordingId);
    if (!authResult.granted) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Access Denied" });
    }
    const role = authResult.role;

    if (!recordingId) {
        return res.status(400).json({ success: false, message: "Recording ID is required." });
    }

    try {
        // --- PRODUCTION: Fetch analysis data if needed, then Proxy to AWS API Gateway for PDF ---
        /*
        // 1. Optionally, fetch some metadata or specific analysis parts from DynamoDB if needed by the PDF Lambda
        //    or if you need to pass specific context to the PDF generation API Gateway.
        const recordingParams = {
            TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
            Key: { recordingId: recordingId },
        };
        const { Item: recording } = await dynamoDb.get(recordingParams).promise();
        if (!recording || !recording.analysisData || recording.analysisStatus !== 'completed') {
            return res.status(404).json({ success: false, message: 'Completed analysis data not found for PDF.' });
        }
        const dataToPassToPdfLambda = { // Example payload for your PDF Lambda
            analysisData: recording.analysisData, // Or a subset based on 'role'
            title: recording.title || "Meeting Analysis",
            date: recording.startTimeActual || recording.date,
            roleContext: role
        };

        // 2. Call the PDF Generation API Gateway endpoint
        const pdfApiGatewayUrl = `${PDF_API_GATEWAY_ENDPOINT}/${recordingId}`; // Or pass data in POST body
        const apiGwResponse = await fetch(pdfApiGatewayUrl, {
            method: 'POST', // Or GET if just passing recordingId
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_GATEWAY_KEY,
                // Include auth token if your PDF API Gateway endpoint is protected
                // 'Authorization': req.headers.authorization 
            },
            body: JSON.stringify(dataToPassToPdfLambda) // If sending data
        });

        if (!apiGwResponse.ok) {
            const errorData = await apiGwResponse.json().catch(() => ({ message: `PDF Generation API Gateway error: ${apiGwResponse.status}`}));
            throw new Error(errorData.message);
        }

        // API Gateway -> Lambda might return:
        // A) Direct PDF stream (if Lambda generates and returns binary)
        // B) Base64 encoded PDF in JSON
        // C) An S3 pre-signed URL to the generated PDF

        // Assuming Lambda (via API GW) returns the PDF stream directly or base64
        const contentType = apiGwResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="AnalysisReport_${recordingId}.pdf"`);
            const pdfBuffer = await apiGwResponse.buffer(); // or .arrayBuffer()
            res.send(pdfBuffer);
        } else { // Handle JSON with base64 or S3 link
            const pdfPayload = await apiGwResponse.json();
            if (pdfPayload.pdfBase64) {
                 res.setHeader('Content-Type', 'application/pdf');
                 res.setHeader('Content-Disposition', `attachment; filename="AnalysisReport_${recordingId}.pdf"`);
                 res.send(Buffer.from(pdfPayload.pdfBase64, 'base64'));
            } else if (pdfPayload.pdfS3Url) {
                res.redirect(302, pdfPayload.pdfS3Url);
            } else {
                 throw new Error("Unexpected response from PDF generation service.");
            }
        }
        */

        // --- SIMULATED PDF RESPONSE ---
        console.log(`API: PDF download requested for recordingId: ${recordingId} by role: ${role}`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Simulated_Analysis_Report_${recordingId}.pdf"`);
        const dummyPdfContent = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 60>>stream\nBT /F1 18 Tf 72 700 Td (Simulated PDF Report for ${recordingId}) Tj\nET\nBT /F1 12 Tf 72 650 Td (Role: ${role}) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000111 00000 n \n0000000209 00000 n \n0000000277 00000 n \ntrailer<</Size 6/Root 1 0 R>>\n%EOF`;
        res.send(dummyPdfContent);
        // --- END SIMULATED PDF RESPONSE ---

    } catch (error) {
        console.error(`API Error generating PDF for recording ${recordingId}:`, error);
        res.status(500).json({ success: false, message: 'Failed to generate PDF report.', errorDetails: error.message });
    }
}