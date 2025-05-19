// File: /api/recordings/[recordingId]/analysis/pdf.js
// Handles GET /api/recordings/:recordingId/analysis/pdf
// Fetches LATEST COMPLETED analysis data, then proxies to AWS API Gateway for PDF Lambda.

import { authenticateTokenOrClientAccess } from '../../../utils/auth.js'; 
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb"; // QueryCommand
// import fetch from 'node-fetch'; // Or global fetch in Node 18+

const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.MY_AWS_REGION; // Ensure this is MY_AWS_REGION or AWS_REGION
const PDF_API_GATEWAY_ENDPOINT = process.env.PDF_API_GATEWAY_ENDPOINT; 
const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY; // Optional

if (!RECORDINGS_ANALYSIS_TABLE_NAME || !REGION || !PDF_API_GATEWAY_ENDPOINT || !process.env.JWT_SECRET) {
    console.error("FATAL_ERROR: Missing critical environment variables for /api/recordings/[recordingId]/analysis/pdf.js");
}

let docClient;
if (REGION && RECORDINGS_ANALYSIS_TABLE_NAME) {
    try {
        const ddbClient = new DynamoDBClient({ region: REGION });
        docClient = DynamoDBDocumentClient.from(ddbClient);
        console.log(`DynamoDB client initialized successfully for region: ${REGION} in /api/recordings/[recordingId]/analysis/pdf.js`);
    } catch (error) {
        console.error("Failed to initialize DynamoDB client in /api/recordings/[recordingId]/analysis/pdf.js:", error);
    }
} else {
     console.error("DynamoDB Document Client not initialized in /api/recordings/[recordingId]/analysis/pdf.js due to missing env vars.");
}

/**
 * Helper to get the latest analysis item for a given recordingId that is 'completed' or 'analyzed'.
 * @param {DynamoDBDocumentClient} client - The DynamoDB Document Client instance.
 * @param {string} recId - The recordingId to query for.
 * @returns {Promise<object|null>} The latest completed/analyzed item or null.
 */
async function getLatestCompletedAnalysisItem(client, recId) {
    if (!client || !RECORDINGS_ANALYSIS_TABLE_NAME) return null;
    const params = {
        TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
        KeyConditionExpression: "recordingId = :rid",
        FilterExpression: "analysisStatus = :statusCompleted OR analysisStatus = :statusAnalyzed",
        ExpressionAttributeValues: {
            ":rid": recId,
            ":statusCompleted": "completed",
            ":statusAnalyzed": "analyzed"
        },
        ScanIndexForward: false, 
        Limit: 1
    };
    try {
        const { Items } = await client.send(new QueryCommand(params));
        return (Items && Items.length > 0) ? Items[0] : null;
    } catch (error) {
        console.error(`Error querying latest completed analysis for PDF for ${recId}:`, error);
        throw error;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    if (!docClient || !RECORDINGS_ANALYSIS_TABLE_NAME || !PDF_API_GATEWAY_ENDPOINT) {
        return res.status(500).json({ success: false, message: "Server PDF generation system not configured." });
    }

    const { recordingId } = req.query;

    const authResult = await authenticateTokenOrClientAccess(req, recordingId);
    if (!authResult.granted) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Access Denied" });
    }
    const role = authResult.role; // Role of the requester (salesperson, client, recorder)

    if (!recordingId) {
        return res.status(400).json({ success: false, message: "Recording ID is required." });
    }

    try {
        // 1. Fetch the LATEST COMPLETED analysis data from DynamoDB
        const latestCompletedAnalysis = await getLatestCompletedAnalysisItem(docClient, recordingId);

        if (!latestCompletedAnalysis || !latestCompletedAnalysis.analysisData) {
            // analysisStatus check is part of getLatestCompletedAnalysisItem
            return res.status(404).json({ success: false, message: 'Completed analysis data not found for PDF generation for this recording.' });
        }
        
        // Shape data for PDF Lambda based on role and the fetched analysis item
        let analysisDataForPdf = {}; 
        const fullAnalysisFromDB = latestCompletedAnalysis.analysisData;
        
        // Common context info that might be useful for the PDF header/footer
        const meetingContextInfo = {
            title: latestCompletedAnalysis.title || (latestCompletedAnalysis.originalMeetingId ? `Meeting Analysis for ${latestCompletedAnalysis.originalMeetingId}` : "Meeting Analysis Report"),
            date: latestCompletedAnalysis.recordingStartTimeActual || latestCompletedAnalysis.uploadTimestamp || latestCompletedAnalysis.createdAt, // Use best available date
            durationSeconds: latestCompletedAnalysis.durationSeconds,
            audioQuality: latestCompletedAnalysis.audioQuality,
            fileSizeMB: latestCompletedAnalysis.fileSizeMB,
            analysisVersionDate: latestCompletedAnalysis.createdAt // Timestamp of this specific analysis version
        };

        // Role-specific shaping of the analysisData to send to PDF Lambda
        if (role === 'salesperson') {
            analysisDataForPdf = { 
                ...fullAnalysisFromDB, // Salesperson gets the most comprehensive data
                meetingContextInfo 
            };
        } else if (role === 'recorder') {
            analysisDataForPdf = { 
                summary: fullAnalysisFromDB.generalSummary || fullAnalysisFromDB.salespersonAnalysis?.tailoredSummary, 
                transcript: fullAnalysisFromDB.transcript, 
                meetingContextInfo 
            };
        } else if (role === 'client') {
             const ca = fullAnalysisFromDB.clientAnalysis || {};
             const gs = fullAnalysisFromDB.generalSummary || "Summary not available.";
             analysisDataForPdf = { 
                summary: ca.tailoredSummary || gs, 
                keyPoints: ca.keyDecisionsAndCommitments, 
                actionItems: ca.actionItemsRelevantToClient, 
                questions: ca.questionsAnsweredForClient, 
                meetingContextInfo 
            };
        } else { // Default or unknown role gets a general view
            analysisDataForPdf = { 
                summary: fullAnalysisFromDB.generalSummary, 
                transcript: fullAnalysisFromDB.transcript, // Optionally include transcript for general
                meetingContextInfo 
            };
        }

        // 2. Call the PDF Generation API Gateway endpoint
        const pdfApiGatewayUrl = PDF_API_GATEWAY_ENDPOINT; 
        const apiGwPayload = {
            recordingId, // Keep for identification in PDF Lambda if needed
            analysisData: analysisDataForPdf, // The shaped data
            roleContext: role, // Let PDF Lambda know who the report is for
            // meetingTitle and meetingDate are now part of analysisDataForPdf.meetingContextInfo
        };
        
        console.log(`API: Requesting PDF from API Gateway: ${pdfApiGatewayUrl} for recording ${recordingId}, role ${role}, analysis version ${latestCompletedAnalysis.createdAt}`);
        const apiGwResponse = await fetch(pdfApiGatewayUrl, {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
                ...(API_GATEWAY_KEY && { 'x-api-key': API_GATEWAY_KEY }),
                // Forward auth if PDF lambda needs to verify user again (less common if this Vercel func already did)
                // ...(req.headers.authorization && { 'Authorization': req.headers.authorization })
            },
            body: JSON.stringify(apiGwPayload)
        });

        if (!apiGwResponse.ok) {
            const errorBodyText = await apiGwResponse.text();
            console.error("PDF Generation API Gateway Error Response:", errorBodyText, "Status:", apiGwResponse.status);
            let errorData = { message: `PDF Generation Service error: ${apiGwResponse.status}`};
            try { errorData = JSON.parse(errorBodyText); } catch (e) { /* Keep default message */ }
            throw new Error(errorData.message || `PDF Generation Service error: ${apiGwResponse.status}`);
        }
        
        const contentType = apiGwResponse.headers.get('content-type');
        const contentDispositionHeader = apiGwResponse.headers.get('content-disposition') || `attachment; filename="AnalysisReport_${recordingId}_${role}.pdf"`;

        if (contentType && contentType.includes('application/pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', contentDispositionHeader);
            const pdfBuffer = await apiGwResponse.arrayBuffer(); 
            res.send(Buffer.from(pdfBuffer));
        } else { 
            // Handle if PDF service returns JSON with S3 URL or base64 PDF
            const pdfPayloadText = await apiGwResponse.text();
            let pdfPayload;
            try {
                pdfPayload = JSON.parse(pdfPayloadText);
            } catch(e){
                 console.error("Failed to parse PDF service JSON response:", pdfPayloadText);
                 throw new Error("Unexpected response format from PDF service (not PDF or valid JSON).")
            }

            if (pdfPayload.pdfBase64) { // If PDF is returned as base64 string in JSON
                 res.setHeader('Content-Type', 'application/pdf');
                 res.setHeader('Content-Disposition', contentDispositionHeader);
                 res.send(Buffer.from(pdfPayload.pdfBase64, 'base64'));
            } else if (pdfPayload.pdfS3Url) { // If PDF service returns a pre-signed S3 URL
                res.redirect(302, pdfPayload.pdfS3Url); // Redirect client to download from S3
            } else {
                 throw new Error("Unexpected JSON response structure from PDF generation service (missing pdfBase64 or pdfS3Url).");
            }
        }

    } catch (error) {
        console.error(`API Error generating PDF for recording ${recordingId}:`, error);
        res.status(500).json({ success: false, message: 'Failed to generate PDF report.', errorDetails: error.message });
    }
}