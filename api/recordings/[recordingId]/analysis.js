// File: /api/recordings/[recordingId]/analysis.js
// Handles GET /api/recordings/:recordingId/analysis
// Fetches the LATEST COMPLETED analysis data and shapes it by role.

import { authenticateTokenOrClientAccess } from '../../utils/auth.js'; 
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb"; // Changed from GetCommand

const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.AWS_REGION; // Standard Vercel env var for AWS region

if (!RECORDINGS_ANALYSIS_TABLE_NAME || !REGION || !process.env.JWT_SECRET) {
    console.error("FATAL_ERROR: Missing critical environment variables for /api/recordings/[recordingId]/analysis.js");
}

let docClient;
try {
    if (REGION && RECORDINGS_ANALYSIS_TABLE_NAME) {
        const ddbClient = new DynamoDBClient({ region: REGION });
        docClient = DynamoDBDocumentClient.from(ddbClient);
        console.log(`DynamoDB client initialized successfully for region: ${REGION} in /api/recordings/[recordingId]/analysis.js`);
    } else {
        console.error("DynamoDB Document Client not initialized in /api/recordings/[recordingId]/analysis.js due to missing environment variables.");
    }
} catch (error) {
    console.error("Error initializing DynamoDB client in /api/recordings/[recordingId]/analysis.js:", error);
}

/**
 * Helper to get the latest analysis item for a given recordingId.
 * Assumes RECORDINGS_ANALYSIS_TABLE_NAME has PK: recordingId (String), SK: createdAt (String - ISO8601).
 * @param {DynamoDBDocumentClient} client - The DynamoDB Document Client instance.
 * @param {string} recId - The recordingId to query for.
 * @param {string} [statusToFilter='completed'] - The analysisStatus to filter for (e.g., 'completed', 'analyzed').
 * @returns {Promise<object|null>} The latest item or null if not found/not matching status.
 */
async function getLatestAnalysisByRecordingIdAndStatus(client, recId, statusToFilter = 'completed') {
    if (!client || !RECORDINGS_ANALYSIS_TABLE_NAME) {
        console.error("getLatestAnalysisByRecordingIdAndStatus: Client or table name not configured.");
        return null;
    }
    const params = {
        TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
        KeyConditionExpression: "recordingId = :rid",
        FilterExpression: "analysisStatus = :statusVal", // Ensure it's completed or analyzed
        ExpressionAttributeValues: {
            ":rid": recId,
            ":statusVal": statusToFilter 
        },
        ScanIndexForward: false, // Sort by 'createdAt' (the range key) descending to get the latest
        Limit: 1                 // We only want the most recent one matching the criteria
    };

    try {
        const { Items } = await client.send(new QueryCommand(params));
        return (Items && Items.length > 0) ? Items[0] : null;
    } catch (error) {
        console.error(`Error querying latest analysis for ${recId} with status ${statusToFilter}:`, error);
        throw error; // Re-throw to be handled by the caller
    }
}


export default async function handler(req, res) {
    if (!docClient || !RECORDINGS_ANALYSIS_TABLE_NAME) {
        return res.status(500).json({ success: false, message: "Server configuration error for analysis API." });
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    const { recordingId } = req.query;

    if (!recordingId) {
        return res.status(400).json({ success: false, message: "Recording ID is required." });
    }
    
    const authResult = await authenticateTokenOrClientAccess(req, recordingId); 
    if (!authResult.granted) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Access Denied" });
    }
    const role = authResult.role; 

    try {
        // Fetch the latest completed (or analyzed) analysis item
        const recordingAnalysisItem = await getLatestAnalysisByRecordingIdAndStatus(docClient, recordingId, 'completed');
        // If 'completed' yields nothing, you might try 'analyzed' if that's a distinct terminal status
        // const recordingAnalysisItem = await getLatestAnalysisByRecordingIdAndStatus(docClient, recordingId, 'completed') || await getLatestAnalysisByRecordingIdAndStatus(docClient, recordingId, 'analyzed');


        if (!recordingAnalysisItem || !recordingAnalysisItem.analysisData) {
            // It's important that analysisStatus was checked by getLatestAnalysisByRecordingIdAndStatus
            return res.status(404).json({ success: false, message: 'Completed analysis data not found or not ready for this recording.' });
        }
        
        // Shape the data based on the role
        let responseDataToFrontend = {};
        const fullAnalysis = recordingAnalysisItem.analysisData; 

        if (role === 'salesperson') {
            responseDataToFrontend = {
                // Salesperson gets comprehensive data
                transcript: fullAnalysis.transcript,
                generalSummary: fullAnalysis.generalSummary,
                salespersonAnalysis: fullAnalysis.salespersonAnalysis, // Includes tailored summary, key points, action items, client Qs, sentiment
                clientAnalysis: fullAnalysis.clientAnalysis // Might also be useful for salesperson context
            };
        } else if (role === 'recorder') {
            // Recorder gets a basic view, primarily transcript and a general summary
            responseDataToFrontend = { 
                summary: fullAnalysis.generalSummary || fullAnalysis.salespersonAnalysis?.tailoredSummary || "Summary not available.",
                transcript: fullAnalysis.transcript || "Transcript not available.",
            };
        } else if (role === 'client') {
            // Client gets their tailored view
            const ca = fullAnalysis.clientAnalysis || {};
            const gs = fullAnalysis.generalSummary || "Summary not available.";
            responseDataToFrontend = { 
                summary: ca.tailoredSummary || gs,
                keyPoints: ca.keyDecisionsAndCommitments || [],
                actionItems: ca.actionItemsRelevantToClient || [],
                questions: ca.questionsAnsweredForClient || [], // Questions AI identified and answered for client
            };
        } else { // Default or unknown role
            responseDataToFrontend = { 
                summary: fullAnalysis.generalSummary || "Summary not available for this role.",
                message: "Limited data due to unrecognized role."
            }; 
        }
        
        console.log(`API: Fetched and shaped analysis for recordingId ${recordingId}, role ${role}`);
        res.status(200).json(responseDataToFrontend); // Send only the shaped data, not the full API response object

    } catch (error) {
        console.error(`API Error fetching analysis for recording ${recordingId}:`, error);
        res.status(500).json({ success: false, message: `Failed to fetch analysis.`, errorDetails: error.message });
    }
}