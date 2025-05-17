// File: /api/recordings/[recordingId]/status.js
// Handles GET /api/recordings/:recordingId/analysis/status
// This Vercel function interacts directly with DynamoDB.

import { authenticateToken } from '../../../utils/auth'; // Adjust path
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.MY_AWS_REGION;

if (!RECORDINGS_ANALYSIS_TABLE_NAME || !REGION) {
    console.error("FATAL_ERROR: Missing critical environment variables for analysis status API.");
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

    const authResult = authenticateToken(req);
    if (!authResult.authenticated) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Unauthorized" });
    }
    const userId = authResult.user.userId; 

    if (!recordingId) {
        return res.status(400).json({ success: false, message: "Recording ID is required." });
    }

    try {
        const params = {
            TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
            Key: { recordingId: recordingId }, 
            ProjectionExpression: "analysisStatus, analysisProgress, analysisStatusMessage, analysisErrorMessage, uploaderUserId, originalMeetingId" 
        };
        const { Item: recording } = await docClient.send(new GetCommand(params));

        if (!recording) {
            return res.status(404).json({ success: false, message: 'Recording status not found.' });
        }
        
        // Authorization: Ensure this user (userId) can see this recording's status.
        // This might involve checking recording.uploaderUserId or if it's linked to a meeting they own (via originalMeetingId).
        // Example (needs refinement based on your exact ownership rules):
        // if (recording.uploaderUserId !== userId && /* !await userOwnsOriginalMeeting(userId, recording.originalMeetingId) && */ authResult.user.role !== 'admin') { 
        //     return res.status(403).json({ success: false, message: 'Access denied to this recording status.'});
        // }

        console.log(`API: Fetched status for recording ${recordingId} by user ${userId}`);
        res.status(200).json({
            success: true,
            status: recording.analysisStatus || 'unknown', 
            progress: recording.analysisProgress || 0, 
            status_message: recording.analysisStatusMessage || `Current status: ${recording.analysisStatus || 'unknown'}`,
            error_message: recording.analysisStatus === 'failed' ? (recording.analysisErrorMessage || 'Analysis failed.') : null
        });

    } catch (error) {
        console.error(`API Error fetching status for recording ${recordingId}:`, error);
        res.status(500).json({ success: false, message: `Failed to fetch status.`, errorDetails: error.message });
    }
}