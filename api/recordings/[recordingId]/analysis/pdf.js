// File: /api/recordings/[recordingId]/analysis/pdf.js
// Handles GET /api/recordings/:recordingId/analysis/pdf
// Fetches LATEST COMPLETED analysis data, then proxies to AWS API Gateway for PDF Lambda.
// Admins now receive a salesperson-like PDF.

import { authenticateTokenOrClientAccess } from '../../../utils/auth.js'; 
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.MY_AWS_REGION; 
const PDF_API_GATEWAY_ENDPOINT = process.env.PDF_API_GATEWAY_ENDPOINT; 
const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY; 

if (!RECORDINGS_ANALYSIS_TABLE_NAME || !REGION || !PDF_API_GATEWAY_ENDPOINT || !process.env.JWT_SECRET) {
    console.error("FATAL_ERROR: Missing critical environment variables for /api/recordings/[recordingId]/analysis/pdf.js");
}

let docClient;
if (REGION && RECORDINGS_ANALYSIS_TABLE_NAME) {
    try {
        const ddbClient = new DynamoDBClient({ region: REGION });
        docClient = DynamoDBDocumentClient.from(ddbClient);
        // console.log(`DynamoDB client initialized successfully for region: ${REGION} in /api/recordings/[recordingId]/analysis/pdf.js`);
    } catch (error) {
        console.error("Failed to initialize DynamoDB client in /api/recordings/[recordingId]/analysis/pdf.js:", error);
    }
} else {
     console.error("DynamoDB Document Client not initialized in /api/recordings/[recordingId]/analysis/pdf.js due to missing env vars.");
}

/**
 * Helper to get the latest analysis item for a given recordingId that is 'completed' or 'analyzed'.
 */
async function getLatestCompletedAnalysisItem(client, recId) {
    if (!client || !RECORDINGS_ANALYSIS_TABLE_NAME) {
        console.error("getLatestCompletedAnalysisItem: Client or table name not configured.");
        return null;
    }
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
    const role = authResult.role; 
    const userEmailForLog = authResult.user ? authResult.user.email : 'client_session';


    if (!recordingId) {
        return res.status(400).json({ success: false, message: "Recording ID is required." });
    }

    try {
        const latestCompletedAnalysis = await getLatestCompletedAnalysisItem(docClient, recordingId);

        if (!latestCompletedAnalysis || !latestCompletedAnalysis.analysisData) {
            return res.status(404).json({ success: false, message: 'Completed analysis data not found for PDF generation for this recording.' });
        }
        
        let analysisDataForPdf = {}; 
        const fullAnalysisFromDB = latestCompletedAnalysis.analysisData;
        
        const meetingContextInfo = {
            title: latestCompletedAnalysis.title || (latestCompletedAnalysis.originalMeetingId ? `Meeting Analysis for ${latestCompletedAnalysis.originalMeetingId}` : "Meeting Analysis Report"),
            date: latestCompletedAnalysis.recordingStartTimeActual || latestCompletedAnalysis.uploadTimestamp || latestCompletedAnalysis.createdAt, 
            durationSeconds: latestCompletedAnalysis.durationSeconds,
            audioQuality: latestCompletedAnalysis.audioQuality,
            fileSizeMB: latestCompletedAnalysis.fileSizeMB,
            analysisVersionDate: latestCompletedAnalysis.createdAt 
        };
        
        let effectiveRoleForPdf = role;
        if (role === 'admin') {
            console.log(`API [pdf.js]: Admin user ("${userEmailForLog}") detected. Using salesperson PDF context for recording ${recordingId}.`);
            effectiveRoleForPdf = 'salesperson'; // Admin gets salesperson-like PDF
        }

        if (effectiveRoleForPdf === 'salesperson') {
            analysisDataForPdf = { 
                ...fullAnalysisFromDB, 
                meetingContextInfo 
            };
        } else if (effectiveRoleForPdf === 'recorder') {
            analysisDataForPdf = { 
                summary: fullAnalysisFromDB.generalSummary || fullAnalysisFromDB.salespersonAnalysis?.tailoredSummary, 
                transcript: fullAnalysisFromDB.transcript, 
                meetingContextInfo 
            };
        } else if (effectiveRoleForPdf === 'client') {
             const ca = fullAnalysisFromDB.clientAnalysis || {};
             const gs = fullAnalysisFromDB.generalSummary || "Summary not available.";
             analysisDataForPdf = { 
                summary: ca.tailoredSummary || gs, 
                keyPoints: ca.keyDecisionsAndCommitments, 
                actionItems: ca.actionItemsRelevantToClient, 
                questions: ca.questionsAnsweredForClient, 
                meetingContextInfo 
            };
        } else { 
            console.warn(`API [pdf.js]: Unrecognized effective role "${effectiveRoleForPdf}" (actual: "${role}") for PDF generation on recording ${recordingId}. Providing general PDF.`);
            analysisDataForPdf = { 
                summary: fullAnalysisFromDB.generalSummary, 
                transcript: fullAnalysisFromDB.transcript, 
                meetingContextInfo 
            };
        }

        const pdfApiGatewayUrl = PDF_API_GATEWAY_ENDPOINT; 
        const apiGwPayload = {
            recordingId,
            analysisData: analysisDataForPdf, 
            roleContext: effectiveRoleForPdf, // Send the effective role for PDF template selection
        };
        
        console.log(`API: Requesting PDF from API Gateway: ${pdfApiGatewayUrl} for recording ${recordingId}, actual role ${role} (using ${effectiveRoleForPdf} context), analysis version ${latestCompletedAnalysis.createdAt}`);
        const apiGwResponse = await fetch(pdfApiGatewayUrl, { /* ... fetch options as before ... */ 
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
                ...(API_GATEWAY_KEY && { 'x-api-key': API_GATEWAY_KEY }),
            },
            body: JSON.stringify(apiGwPayload)
        });

        if (!apiGwResponse.ok) {
            // ... (error handling for API Gateway response as before) ...
            const errorBodyText = await apiGwResponse.text();
            console.error("PDF Generation API Gateway Error Response:", errorBodyText, "Status:", apiGwResponse.status);
            let errorData = { message: `PDF Generation Service error: ${apiGwResponse.status}`};
            try { errorData = JSON.parse(errorBodyText); } catch (e) { /* Keep default message */ }
            throw new Error(errorData.message || `PDF Generation Service error: ${apiGwResponse.status}`);
        }
        
        const contentType = apiGwResponse.headers.get('content-type');
        const contentDispositionHeader = apiGwResponse.headers.get('content-disposition') || `attachment; filename="AnalysisReport_${recordingId}_${effectiveRoleForPdf}.pdf"`;

        if (contentType && contentType.includes('application/pdf')) {
            // ... (stream PDF buffer as before) ...
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', contentDispositionHeader);
            const pdfBuffer = await apiGwResponse.arrayBuffer(); 
            res.send(Buffer.from(pdfBuffer));
        } else { 
            // ... (handle JSON response with base64 or S3 URL as before) ...
            const pdfPayloadText = await apiGwResponse.text();
            let pdfPayload;
            try {
                pdfPayload = JSON.parse(pdfPayloadText);
            } catch(e){
                 console.error("Failed to parse PDF service JSON response:", pdfPayloadText);
                 throw new Error("Unexpected response format from PDF service (not PDF or valid JSON).")
            }

            if (pdfPayload.pdfBase64) { 
                 res.setHeader('Content-Type', 'application/pdf');
                 res.setHeader('Content-Disposition', contentDispositionHeader);
                 res.send(Buffer.from(pdfPayload.pdfBase64, 'base64'));
            } else if (pdfPayload.pdfS3Url) { 
                res.redirect(302, pdfPayload.pdfS3Url); 
            } else {
                 throw new Error("Unexpected JSON response structure from PDF generation service (missing pdfBase64 or pdfS3Url).");
            }
        }

    } catch (error) {
        console.error(`API Error generating PDF for recording ${recordingId}, role ${role}:`, error);
        res.status(500).json({ success: false, message: 'Failed to generate PDF report.', errorDetails: error.message });
    }
}