// File: /api/meetings/[meetingId].js
// Handles GET, PUT, DELETE for /api/meetings/:meetingId

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { authenticateToken } from '../../../utils/auth.js'; // Adjust path

const MEETINGS_TABLE_NAME = process.env.MEETINGS_TABLE_NAME;
// If cascading deletes involve other tables:
// const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
// const QNA_HISTORY_TABLE_NAME = process.env.QNA_HISTORY_TABLE_NAME;
const REGION = process.env.MY_AWS_REGION;

if (!MEETINGS_TABLE_NAME || !REGION) {
    console.error("FATAL_ERROR: Missing critical environment variables for meetings/[meetingId] API.");
}

const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Helper to get and verify ownership
async function getMeetingAndVerifyOwnership(meetingId, ownerId) {
    if (!MEETINGS_TABLE_NAME) throw new Error("MEETINGS_TABLE_NAME not configured for ownership check.");
    const params = {
        TableName: MEETINGS_TABLE_NAME,
        Key: { id: meetingId }, 
    };
    const { Item: meeting } = await docClient.send(new GetCommand(params));
    if (!meeting) {
        return { error: true, status: 404, message: 'Meeting not found.' };
    }
    if (meeting.userId !== ownerId) { 
        console.warn(`Authorization attempt failed: User ${ownerId} tried to access meeting ${meetingId} owned by ${meeting.userId}`);
        return { error: true, status: 403, message: 'Access denied to this meeting.' };
    }
    return { meeting };
}

export default async function handler(req, res) {
    const { meetingId } = req.query;

    if (!MEETINGS_TABLE_NAME || !REGION) { 
        return res.status(500).json({ success: false, message: "Server configuration error." });
    }

    const authResult = authenticateToken(req);
    if (!authResult.authenticated) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Unauthorized" });
    }
    const userId = authResult.user.userId;

    if (!meetingId) {
        return res.status(400).json({ success: false, message: "Meeting ID is required." });
    }

    if (req.method === 'GET') {
        try {
            const { meeting, error, status, message } = await getMeetingAndVerifyOwnership(meetingId, userId);
            if (error) return res.status(status).json({ success: false, message });
            
            console.log(`API: Fetched meeting ${meetingId} for user ${userId}`);
            res.status(200).json(meeting);

        } catch (error) {
            console.error(`API Error fetching meeting ${meetingId}:`, error);
            res.status(500).json({ success: false, message: `Failed to fetch meeting.`, errorDetails: error.message });
        }
    } else if (req.method === 'PUT') {
        try {
            const updates = req.body; 
            
            if (Object.keys(updates).length === 0 || 
                (updates.title === undefined && updates.date === undefined && updates.clientEmail === undefined && updates.notes === undefined)) {
                 return res.status(400).json({ success: false, message: 'No valid update data provided. At least one field (title, date, clientEmail, notes) is required.' });
            }
            if (updates.date && isNaN(new Date(updates.date).getTime())) {
                 return res.status(400).json({ success: false, message: 'Invalid date format for update.' });
            }
            if (updates.clientEmail && !/\S+@\S+\.\S+/.test(updates.clientEmail)) {
                return res.status(400).json({ success: false, message: 'Invalid client email format for update.' });
            }

            const { meeting: existingMeeting, error, status, message } = await getMeetingAndVerifyOwnership(meetingId, userId);
            if (error) return res.status(status).json({ success: false, message });

            let updateExpression = "SET updatedAt = :ua";
            const expressionAttributeValues = { ":ua": new Date().toISOString() };
            const expressionAttributeNames = {};

            if (updates.title !== undefined) { updateExpression += ", title = :t"; expressionAttributeValues[":t"] = updates.title.trim(); }
            if (updates.date !== undefined) { updateExpression += ", #dt = :d"; expressionAttributeNames["#dt"] = "date"; expressionAttributeValues[":d"] = updates.date; }
            if (updates.clientEmail !== undefined) { updateExpression += ", clientEmail = :ce"; expressionAttributeValues[":ce"] = updates.clientEmail.trim(); }
            if (updates.notes !== undefined) { updateExpression += ", notes = :n"; expressionAttributeValues[":n"] = updates.notes.trim(); }
            // Potentially add status update if allowed through this endpoint, e.g., for cancellation
            // if (updates.status !== undefined && ['Scheduled', 'Cancelled'].includes(updates.status)) { 
            //    updateExpression += ", #st = :s"; expressionAttributeNames["#st"] = "status"; expressionAttributeValues[":s"] = updates.status; 
            // }
            
            if (Object.keys(expressionAttributeValues).length <= 1) { // Only :ua is present
                 return res.status(400).json({ success: false, message: 'No valid fields provided for update.' });
            }

            const updateParams = {
                TableName: MEETINGS_TABLE_NAME,
                Key: { id: meetingId },
                UpdateExpression: updateExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: "ALL_NEW"
            };
            if (Object.keys(expressionAttributeNames).length > 0) {
                updateParams.ExpressionAttributeNames = expressionAttributeNames;
            }

            const { Attributes: updatedMeeting } = await docClient.send(new UpdateCommand(updateParams));
            console.log(`API: Meeting ${meetingId} updated for user ${userId}`);
            res.status(200).json(updatedMeeting);

        } catch (error) {
            console.error(`API Error updating meeting ${meetingId}:`, error);
            res.status(500).json({ success: false, message: `Failed to update meeting.`, errorDetails: error.message });
        }
    } else if (req.method === 'DELETE') {
        try {
            const { meeting, error, status, message } = await getMeetingAndVerifyOwnership(meetingId, userId);
            if (error) return res.status(status).json({ success: false, message });

            const deleteParams = {
                TableName: MEETINGS_TABLE_NAME,
                Key: { id: meetingId }
            };
            await docClient.send(new DeleteCommand(deleteParams));
            
            // PRODUCTION TODO: Implement robust cascading delete logic.
            // This is critical to avoid orphaned data and unnecessary storage costs.
            // This might involve:
            // 1. Getting the meeting.recordingId.
            // 2. Deleting the corresponding item from RECORDINGS_ANALYSIS_TABLE_NAME.
            // 3. Deleting the audio file from S3 (using s3AudioPath from RECORDINGS_ANALYSIS_TABLE_NAME).
            // 4. Deleting PDF from S3 if stored (using pdfReportS3Path).
            // 5. Deleting Q&A history from QNA_HISTORY_TABLE_NAME if used.
            // This complex cleanup is often best handled by a separate, asynchronously invoked Lambda
            // (e.g., triggered by a DynamoDB Stream on the MEETINGS_TABLE_NAME, or called by this function).
            console.log(`API: Meeting ${meetingId} deleted by user ${userId}. Associated recordingId: ${meeting.recordingId}. Manual or automated cleanup of related resources (S3 audio, analysis data) is required.`);

            res.status(200).json({ success: true, message: `Meeting ${meetingId} deleted successfully.` });

        } catch (error) {
            console.error(`API Error deleting meeting ${meetingId}:`, error);
            res.status(500).json({ success: false, message: `Failed to delete meeting.`, errorDetails: error.message });
        }
    } else {
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }
}
