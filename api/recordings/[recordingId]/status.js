// File: /api/recordings/[recordingId]/status.js
// Handles GET /api/recordings/:recordingId/analysis/status
// This Vercel function interacts directly with DynamoDB.

import { authenticateToken } from '../../utils/auth.js'; // Adjust path
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.MY_AWS_REGION;

if (!RECORDINGS_ANALYSIS_TABLE_NAME || !REGION || !process.env.JWT_SECRET) {
    console.error("FATAL_ERROR: Missing critical environment variables for analysis status API.");
}

const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

async function getLatestRecordingAnalysisItem(docClientInstance, recordingIdToQuery) {
    const params = {
        TableName: process.env.RECORDINGS_ANALYSIS_TABLE_NAME, // Use environment variable
        KeyConditionExpression: "recordingId = :rid",
        ExpressionAttributeValues: {
            ":rid": recordingIdToQuery
        },
        ScanIndexForward: false, // Sort by 'createdAt' descending
        Limit: 1               // Get only the newest item
    };
    const { Items } = await docClientInstance.send(new QueryCommand(params));
    return (Items && Items.length > 0) ? Items[0] : null;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    const { recordingId } = req.query;
    
    if (!RECORDINGS_ANALYSIS_TABLE_NAME || !REGION) {
        return res.status(500).json({ success: false, message: "Server configuration error." });
    }

    const authResult = authenticateToken(req);
    if (!authResult.authenticated) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Unauthorized" });
    }
    const userId = authResult.user.userId; 

    if (!recordingId) {
        return res.status(400).json({ success: false, message: "Recording ID is required." });
    }

    try {
        const recording = await getLatestRecordingAnalysisItem(docClient, recordingId); 

        if (!recording) {
            return res.status(404).json({ success: false, message: 'Recording status not found.' });
        }
        // The rest of the logic using 'recording' for status, progress etc. remains.
        // Note: The ProjectionExpression from the old GetCommand should be considered if you
        // only want specific fields after the Query for optimization, but the helper above fetches the whole item.
        // If you keep the helper simple, ensure 'recording' has the needed fields.
        // For status.js, the fields used are: analysisStatus, analysisProgress, analysisStatusMessage, analysisErrorMessage.
        // These should be part of the 'recording' item fetched.

        if (!recording) {
            return res.status(404).json({ success: false, message: 'Recording status not found.' });
        }
        
        // TODO: Implement more granular authorization if needed.
        // For example, check if the authenticated user (userId) is the recording.uploaderUserId
        // or owns the recording.originalMeetingId (if present and linked in your MeetingsTable).
        // if (recording.uploaderUserId !== userId && authResult.user.role !== 'admin' && !await userIsOwnerOfOriginalMeeting(userId, recording.originalMeetingId)) { 
        //     return res.status(403).json({ success: false, message: 'Access denied to this recording status.'});
        // }

        console.log(`API: Fetched status for recording ${recordingId} by user ${userId}`);
        res.status(200).json({
            success: true,
            status: recording.analysisStatus || 'unknown', 
            progress: recording.analysisProgress !== undefined ? recording.analysisProgress : 0, 
            status_message: recording.analysisStatusMessage || `Current status: ${recording.analysisStatus || 'unknown'}`,
            error_message: recording.analysisStatus === 'failed' ? (recording.analysisErrorMessage || 'Analysis failed.') : null
        });

    } catch (error) {
        console.error(`API Error fetching status for recording ${recordingId}:`, error);
        res.status(500).json({ success: false, message: `Failed to fetch status.`, errorDetails: error.message });
    }
}
