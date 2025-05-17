// File: /api/recordings/[recordingId]/analysis/pdf.js
// Handles GET /api/recordings/:recordingId/analysis/pdf
// Vercel function fetches data from DynamoDB, then proxies to AWS API Gateway for PDF Lambda.

import { authenticateTokenOrClientAccess } from '/var/task/api/utils/auth.js'; // Adjust path
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
// import fetch from 'node-fetch';

const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.MY_AWS_REGION;
const PDF_API_GATEWAY_ENDPOINT = process.env.PDF_API_GATEWAY_ENDPOINT; 
const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY;

if (!RECORDINGS_ANALYSIS_TABLE_NAME || !REGION || !PDF_API_GATEWAY_ENDPOINT || !process.env.JWT_SECRET) {
    console.error("FATAL_ERROR: Missing critical environment variables for PDF API.");
}

let docClient;
if (REGION && RECORDINGS_ANALYSIS_TABLE_NAME) {
    const ddbClient = new DynamoDBClient({ region: REGION });
    docClient = DynamoDBDocumentClient.from(ddbClient);
} else {
     console.error("DynamoDB Document Client not initialized in /api/recordings/[recordingId]/analysis/pdf.js");
}


export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    const { recordingId } = req.query;

    if (!docClient || !RECORDINGS_ANALYSIS_TABLE_NAME || !PDF_API_GATEWAY_ENDPOINT) {
        return res.status(500).json({ success: false, message: "Server PDF generation system not configured." });
    }

    const authResult = await authenticateTokenOrClientAccess(req, recordingId);
    if (!authResult.granted) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Access Denied" });
    }
    const role = authResult.role;

    if (!recordingId) {
        return res.status(400).json({ success: false, message: "Recording ID is required." });
    }

    try {
        // 1. Fetch analysis data from DynamoDB
        const recordingParams = {
            TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
            Key: { recordingId: recordingId },
        };
        const { Item: recording } = await docClient.send(new GetCommand(recordingParams));
        if (!recording || !recording.analysisData || recording.analysisStatus !== 'completed') {
            return res.status(404).json({ success: false, message: 'Completed analysis data not found for PDF generation.' });
        }
        
        // Shape data for PDF Lambda based on role
        let analysisDataForPdf = {}; 
        const fullAnalysis = recording.analysisData;
        const meetingContextInfo = {
            title: recording.title || (recording.originalMeetingId ? `Meeting ${recording.originalMeetingId}` : "Meeting Analysis Report"),
            date: recording.recordingStartTimeActual || recording.uploadTimestamp || recording.date,
            duration: recording.durationSeconds,
            audioQuality: recording.audioQuality,
            fileSize: recording.fileSizeMB
        };

        if (role === 'salesperson') analysisDataForPdf = { ...fullAnalysis, meetingContextInfo };
        else if (role === 'recorder') analysisDataForPdf = { summary: fullAnalysis.generalSummary, transcript: fullAnalysis.transcript, ...meetingContextInfo };
        else if (role === 'client') {
             const ca = fullAnalysis.clientAnalysis || {};
             const gs = fullAnalysis.generalSummary || "Summary not available.";
             analysisDataForPdf = { summary: ca.tailoredSummary || gs, keyPoints: ca.keyDecisionsAndCommitments, actionItems: ca.actionItemsRelevantToClient, questions: ca.questionsAnsweredForClient, ...meetingContextInfo };
        } else { 
            analysisDataForPdf = { summary: fullAnalysis.generalSummary, ...meetingContextInfo };
        }

        // 2. Call the PDF Generation API Gateway endpoint
        const pdfApiGatewayUrl = PDF_API_GATEWAY_ENDPOINT; 
        const apiGwPayload = {
            recordingId,
            analysisData: analysisDataForPdf, 
            roleContext: role,
            // meetingTitle and meetingDate are now part of analysisDataForPdf.meetingContextInfo
        };
        
        console.log(`API: Requesting PDF from API Gateway: ${pdfApiGatewayUrl} for recording ${recordingId}, role ${role}`);
        const apiGwResponse = await fetch(pdfApiGatewayUrl, {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
                ...(API_GATEWAY_KEY && { 'x-api-key': API_GATEWAY_KEY }),
                ...(req.headers.authorization && { 'Authorization': req.headers.authorization })
            },
            body: JSON.stringify(apiGwPayload)
        });

        if (!apiGwResponse.ok) {
            const errorBodyText = await apiGwResponse.text();
            console.error("PDF Generation API Gateway Error Response:", errorBodyText);
            const errorData = JSON.parse(errorBodyText || "{}"); 
            throw new Error(errorData.message || `PDF Generation Service error: ${apiGwResponse.status}`);
        }
        
        const contentType = apiGwResponse.headers.get('content-type');
        const contentDispositionHeader = apiGwResponse.headers.get('content-disposition') || `attachment; filename="AnalysisReport_${recordingId}.pdf"`;

        if (contentType && contentType.includes('application/pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', contentDispositionHeader);
            const pdfBuffer = await apiGwResponse.arrayBuffer(); 
            res.send(Buffer.from(pdfBuffer));
        } else { 
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
                 throw new Error("Unexpected JSON response structure from PDF generation service.");
            }
        }

    } catch (error) {
        console.error(`API Error generating PDF for recording ${recordingId}:`, error);
        res.status(500).json({ success: false, message: 'Failed to generate PDF report.', errorDetails: error.message });
    }
}