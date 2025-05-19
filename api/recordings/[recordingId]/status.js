// File: /api/recordings/[recordingId]/status.js
// Handles GET /api/recordings/:recordingId/analysis/status
// Fetches the LATEST analysis status item for a recording.

import { authenticateToken } from '../../utils/auth.js'; 
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb"; // Using QueryCommand

const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.AWS_REGION;

if (!RECORDINGS_ANALYSIS_TABLE_NAME || !REGION || !process.env.JWT_SECRET) {
    console.error("FATAL_ERROR: Missing critical environment variables for /api/recordings/[recordingId]/status.js");
}

let docClient;
if (REGION && RECORDINGS_ANALYSIS_TABLE_NAME) {
    try {
        const ddbClient = new DynamoDBClient({ region: REGION });
        docClient = DynamoDBDocumentClient.from(ddbClient);
        console.log(`DynamoDB client initialized successfully for region: ${REGION} in /api/recordings/[recordingId]/status.js`);
    } catch (error) {
        console.error("Failed to initialize DynamoDB client in /api/recordings/[recordingId]/status.js:", error);
    }
} else {
    console.error("DynamoDB Document Client not initialized in /api/recordings/[recordingId]/status.js due to missing env vars.");
}


/**
 * Helper to get the latest analysis item (any status) for a given recordingId.
 * Assumes RECORDINGS_ANALYSIS_TABLE_NAME has PK: recordingId (String), SK: createdAt (String - ISO8601).
 * @param {DynamoDBDocumentClient} client - The DynamoDB Document Client instance.
 * @param {string} recId - The recordingId to query for.
 * @returns {Promise<object|null>} The latest item or null if not found.
 */
async function getLatestRecordingAnalysisItemByRecordingId(client, recId) {
    if (!client || !RECORDINGS_ANALYSIS_TABLE_NAME) {
        console.error("getLatestRecordingAnalysisItemByRecordingId: Client or table name not configured.");
        return null;
    }
    const params = {
        TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
        KeyConditionExpression: "recordingId = :rid",
        ExpressionAttributeValues: {
            ":rid": recId
        },
        ScanIndexForward: false, // Sort by 'createdAt' (the range key) descending
        Limit: 1                 // We only want the most recent one
    };

    try {
        const { Items } = await client.send(new QueryCommand(params));
        return (Items && Items.length > 0) ? Items[0] : null;
    } catch (error) {
        console.error(`Error querying latest analysis item for ${recId}:`, error);
        throw error; 
    }
}


export default async function handler(req, res) {
    if (!docClient || !RECORDINGS_ANALYSIS_TABLE_NAME) {
        return res.status(500).json({ success: false, message: "Server configuration error for analysis status API." });
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    const { recordingId } = req.query;
    
    const authResult = authenticateToken(req); // Or use authenticateTokenOrClientAccess if clients can check status
    if (!authResult.authenticated) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Unauthorized" });
    }
    // const userId = authResult.user.userId; // Available if needed for logging or fine-grained auth

    if (!recordingId) {
        return res.status(400).json({ success: false, message: "Recording ID is required." });
    }

    try {
        const latestAnalysisItem = await getLatestRecordingAnalysisItemByRecordingId(docClient, recordingId); 

        if (!latestAnalysisItem) {
            return res.status(404).json({ success: false, message: 'Recording analysis status not found.' });
        }
        
        // TODO: Implement more granular authorization if needed (e.g., check ownership via originalMeetingId)
        // if (latestAnalysisItem.uploaderUserId !== userId && authResult.user.role !== 'admin' ... ) { ... }

        console.log(`API: Fetched status for recording ${recordingId}. Current status: ${latestAnalysisItem.analysisStatus}`);
        res.status(200).json({
            success: true,
            status: latestAnalysisItem.analysisStatus || 'unknown', 
            progress: latestAnalysisItem.analysisProgress !== undefined ? latestAnalysisItem.analysisProgress : 0, 
            status_message: latestAnalysisItem.analysisStatusMessage || `Current status: ${latestAnalysisItem.analysisStatus || 'unknown'}`,
            error_message: latestAnalysisItem.analysisStatus === 'failed' ? (latestAnalysisItem.analysisErrorMessage || 'Analysis failed with an unspecified error.') : null
        });

    } catch (error) {
        console.error(`API Error fetching status for recording ${recordingId}:`, error);
        res.status(500).json({ success: false, message: `Failed to fetch status.`, errorDetails: error.message });
    }
}