// File: /api/recordings/[recordingId]/analysis.js
// Handles GET /api/recordings/:recordingId/analysis
// Fetches the LATEST COMPLETED analysis data and shapes it by role.
// Admins now receive a comprehensive (salesperson-like) view by default,
// but can receive a recorder-like view if context=recorderDashboard is passed.

import { authenticateTokenOrClientAccess } from '../../utils/auth.js'; 
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.AWS_REGION; 

if (!RECORDINGS_ANALYSIS_TABLE_NAME || !REGION || !process.env.JWT_SECRET) {
    console.error("FATAL_ERROR: Missing critical environment variables for /api/recordings/[recordingId]/analysis.js");
}

let docClient;
try {
    if (REGION && RECORDINGS_ANALYSIS_TABLE_NAME) {
        const ddbClient = new DynamoDBClient({ region: REGION });
        docClient = DynamoDBDocumentClient.from(ddbClient);
        // console.log(`DynamoDB client initialized successfully for region: ${REGION} in /api/recordings/[recordingId]/analysis.js`);
    } else {
        console.error("DynamoDB Document Client not initialized in /api/recordings/[recordingId]/analysis.js due to missing environment variables.");
    }
} catch (error) {
    console.error("Error initializing DynamoDB client in /api/recordings/[recordingId]/analysis.js:", error);
}

/**
 * Helper to get the latest analysis item for a given recordingId that is 'completed' or 'analyzed'.
 * @param {DynamoDBDocumentClient} client - The DynamoDB Document Client instance.
 * @param {string} recId - The recordingId to query for.
 * @returns {Promise<object|null>} The latest completed/analyzed item or null.
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
        console.error(`Error querying latest completed analysis for ${recId}:`, error);
        throw error; 
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

    const { recordingId, context } = req.query; // Extract 'context' from query parameters

    if (!recordingId) {
        return res.status(400).json({ success: false, message: "Recording ID is required." });
    }
    
    const authResult = await authenticateTokenOrClientAccess(req, recordingId); 
    if (!authResult.granted) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Access Denied" });
    }
    const role = authResult.role; 

    try {
        const recordingAnalysisItem = await getLatestCompletedAnalysisItem(docClient, recordingId);

        if (!recordingAnalysisItem || !recordingAnalysisItem.analysisData) {
            return res.status(404).json({ success: false, message: 'Completed analysis data not found or not ready for this recording.' });
        }
        
        let responseDataToFrontend = {};
        const fullAnalysis = recordingAnalysisItem.analysisData; 

        if (role === 'admin') { 
            // Check context for admin
            if (context === 'recorderDashboard') {
                console.log(`API [analysis.js]: Admin user ("${authResult.user?.email || 'N/A'}") detected with 'recorderDashboard' context. Providing recorder-like analysis data for recording ${recordingId}.`);
                responseDataToFrontend = { 
                    summary: fullAnalysis.generalSummary || fullAnalysis.salespersonAnalysis?.tailoredSummary || "Summary not available.",
                    transcript: fullAnalysis.transcript || "Transcript not available.",
                };
            } else {
                // Default for admin (or other contexts like 'salespersonDashboard') is comprehensive view
                console.log(`API [analysis.js]: Admin user ("${authResult.user?.email || 'N/A'}") detected (context: ${context || 'none'}). Providing comprehensive (salesperson-like) analysis data for recording ${recordingId}.`);
                responseDataToFrontend = {
                    transcript: fullAnalysis.transcript,
                    generalSummary: fullAnalysis.generalSummary,
                    salespersonAnalysis: fullAnalysis.salespersonAnalysis, 
                    clientAnalysis: fullAnalysis.clientAnalysis,
                };
            }
        } else if (role === 'salesperson') {
            responseDataToFrontend = {
                transcript: fullAnalysis.transcript,
                generalSummary: fullAnalysis.generalSummary,
                salespersonAnalysis: fullAnalysis.salespersonAnalysis, 
                clientAnalysis: fullAnalysis.clientAnalysis 
            };
        } else if (role === 'recorder') {
            responseDataToFrontend = { 
                summary: fullAnalysis.generalSummary || fullAnalysis.salespersonAnalysis?.tailoredSummary || "Summary not available.",
                transcript: fullAnalysis.transcript || "Transcript not available.",
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
            console.warn(`API [analysis.js]: Unrecognized role "${role}" or default case hit for recording ${recordingId}.`);
            responseDataToFrontend = { 
                summary: fullAnalysis.generalSummary || "Summary not available for this role.",
                message: "Limited data due to unrecognized role."
            }; 
        }
        
        res.status(200).json(responseDataToFrontend);

    } catch (error) {
        console.error(`API Error fetching analysis for recording ${recordingId}, role ${role}, context ${context}:`, error);
        res.status(500).json({ success: false, message: `Failed to fetch analysis.`, errorDetails: error.message });
    }
}
