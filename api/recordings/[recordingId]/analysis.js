// File: /api/recordings/[recordingId]/analysis.js
// Handles GET /api/recordings/:recordingId/analysis
// This Vercel function interacts directly with DynamoDB and shapes data by role.

import { authenticateTokenOrClientAccess } from '../../utils/auth.js'; // Adjust path
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.MY_AWS_REGION;

if (!RECORDINGS_ANALYSIS_TABLE_NAME || !REGION || !process.env.JWT_SECRET) {
    console.error("FATAL_ERROR: Missing critical environment variables for analysis API.");
}

const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    const { recordingId } = req.query;

    if (!RECORDINGS_ANALYSIS_TABLE_NAME || !REGION) {
        return res.status(500).json({ success: false, message: "Server configuration error." });
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
        const params = {
            TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
            Key: { recordingId: recordingId }, 
        };
        const { Item: recording } = await docClient.send(new GetCommand(params));

        if (!recording || recording.analysisStatus !== 'completed' || !recording.analysisData) {
            return res.status(404).json({ success: false, message: 'Completed analysis not found or not ready for this recording.' });
        }
        
        // Authorization based on role and data should be handled by authenticateTokenOrClientAccess
        // or additional checks here if needed.

        // Shape the data based on the role
        let responseDataToFrontend = {};
        const fullAnalysis = recording.analysisData; 

        if (role === 'salesperson') {
            responseDataToFrontend = {
                transcript: fullAnalysis.transcript,
                generalSummary: fullAnalysis.generalSummary,
                salespersonAnalysis: fullAnalysis.salespersonAnalysis,
                clientAnalysis: fullAnalysis.clientAnalysis 
            };
        } else if (role === 'recorder') {
            responseDataToFrontend = { 
                summary: fullAnalysis.generalSummary || fullAnalysis.salespersonAnalysis?.tailoredSummary,
                transcript: fullAnalysis.transcript,
            };
        } else if (role === 'client') {
            const ca = fullAnalysis.clientAnalysis || {};
            const gs = fullAnalysis.generalSummary || "Summary not available.";
            responseDataToFrontend = { 
                summary: ca.tailoredSummary || gs,
                keyPoints: ca.keyDecisionsAndCommitments || [],
                actionItems: ca.actionItemsRelevantToClient || [],
                questions: ca.questionsAnsweredForClient || [],
            };
        } else { 
            responseDataToFrontend = { summary: fullAnalysis.generalSummary || "Summary not available for this role." }; 
        }
        
        console.log(`API: Fetched analysis for ${recordingId}, role ${role}`);
        res.status(200).json(responseDataToFrontend);

    } catch (error) {
        console.error(`API Error fetching analysis for recording ${recordingId}:`, error);
        res.status(500).json({ success: false, message: `Failed to fetch analysis.`, errorDetails: error.message });
    }
}
