// File: /api/meetings/[meetingId].js
// Handles GET, PUT, DELETE for /api/meetings/:meetingId

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { authenticateToken } from '../utils/auth.js'; // Ensure this path is correct from /api/meetings/

const MEETINGS_TABLE_NAME = process.env.MEETINGS_TABLE_NAME;
const REGION = process.env.AWS_REGION;

// Validate all required environment variables
const requiredEnvVars = {
    MEETINGS_TABLE_NAME,
    AWS_REGION: REGION,
    JWT_SECRET: process.env.JWT_SECRET
};

const missingEnvVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

if (missingEnvVars.length > 0) {
    console.error("FATAL_ERROR: Missing critical environment variables for /api/meetings/[meetingId].js:", missingEnvVars.join(', '));
}

let docClient;
if (REGION && MEETINGS_TABLE_NAME) {
    try {
        const ddbClient = new DynamoDBClient({ region: REGION });
        docClient = DynamoDBDocumentClient.from(ddbClient, {
            marshallOptions: {
                convertEmptyValues: true,
                removeUndefinedValues: true,
                convertClassInstanceToMap: true
            },
            unmarshallOptions: {
                wrapNumbers: false
            }
        });
        console.log(`DynamoDB client initialized successfully for region: ${REGION}`);
    } catch (error) {
        console.error("Failed to initialize DynamoDB client:", error);
    }
} else {
    console.error("DynamoDB Document Client not initialized in /api/meetings/[meetingId].js due to missing REGION or MEETINGS_TABLE_NAME.");
}

// Helper to get a meeting and verify ownership by userId
async function getMeetingAndVerifyOwnership(meetingId, ownerId) {
    if (!docClient) throw new Error("DynamoDB client not initialized in getMeetingAndVerifyOwnership.");
    if (!MEETINGS_TABLE_NAME) throw new Error("MEETINGS_TABLE_NAME not configured for ownership check.");
    
    const params = {
        TableName: MEETINGS_TABLE_NAME,
        Key: { id: meetingId }, // Assuming 'id' is the Partition Key of MEETINGS_TABLE_NAME
    };
    const { Item: meeting } = await docClient.send(new GetCommand(params));

    if (!meeting) {
        return { error: true, status: 404, message: 'Meeting not found.' };
    }
    if (meeting.userId !== ownerId) { 
        console.warn(`Authorization attempt failed: User ${ownerId} tried to access meeting ${meetingId} owned by ${meeting.userId}`);
        return { error: true, status: 403, message: 'Access denied to this meeting.' };
    }
    return { meeting }; // Contains the fetched meeting item
}

export default async function handler(req, res) {
    const { meetingId } = req.query;

    // Re-check critical configurations within the handler for robustness
    if (!docClient || !MEETINGS_TABLE_NAME) { 
        return res.status(500).json({ success: false, message: "Server configuration error for meetings API." });
    }

    const authResult = authenticateToken(req);
    if (!authResult.authenticated) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Unauthorized" });
    }
    const userId = authResult.user.userId; // ID of the authenticated user

    if (!meetingId) {
        return res.status(400).json({ success: false, message: "Meeting ID parameter is required." });
    }

    if (req.method === 'GET') {
        try {
            const { meeting, error, status, message } = await getMeetingAndVerifyOwnership(meetingId, userId);
            if (error) {
                return res.status(status).json({ success: false, message });
            }
            
            console.log(`API: Fetched meeting ${meetingId} for user ${userId}`);
            res.status(200).json({ success: true, message: 'Meeting fetched successfully', data: meeting });

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
            if (error) {
                return res.status(status).json({ success: false, message });
            }

            // Construct DynamoDB UpdateExpression dynamically
            let updateExpression = "SET updatedAt = :ua";
            const expressionAttributeValues = { ":ua": new Date().toISOString() };
            const expressionAttributeNames = {}; // For reserved keywords

            if (updates.title !== undefined) { 
                updateExpression += ", title = :t"; 
                expressionAttributeValues[":t"] = updates.title.trim(); 
            }
            if (updates.date !== undefined) { 
                updateExpression += ", #dt = :d"; // 'date' is a reserved keyword
                expressionAttributeNames["#dt"] = "date"; 
                expressionAttributeValues[":d"] = updates.date; 
            }
            if (updates.clientEmail !== undefined) { 
                updateExpression += ", clientEmail = :ce"; 
                expressionAttributeValues[":ce"] = updates.clientEmail.trim(); 
            }
            if (updates.notes !== undefined) { 
                updateExpression += ", notes = :n"; 
                expressionAttributeValues[":n"] = updates.notes.trim(); 
            }
            // Add other updatable fields here if necessary (e.g., status if allowed)

            if (Object.keys(expressionAttributeValues).length <= 1) { // Only :ua is present
                 return res.status(400).json({ success: false, message: 'No valid fields provided for update.' });
            }

            const updateParams = {
                TableName: MEETINGS_TABLE_NAME,
                Key: { id: meetingId },
                UpdateExpression: updateExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: "ALL_NEW" // Returns the item as it appears after the update
            };
            if (Object.keys(expressionAttributeNames).length > 0) {
                updateParams.ExpressionAttributeNames = expressionAttributeNames;
            }

            const { Attributes: updatedMeeting } = await docClient.send(new UpdateCommand(updateParams));
            console.log(`API: Meeting ${meetingId} updated for user ${userId}`);
            res.status(200).json({ success: true, message: 'Meeting updated successfully', data: updatedMeeting });

        } catch (error) {
            console.error(`API Error updating meeting ${meetingId}:`, error);
            res.status(500).json({ success: false, message: `Failed to update meeting.`, errorDetails: error.message });
        }
    } else if (req.method === 'DELETE') {
        try {
            const { meeting, error, status, message } = await getMeetingAndVerifyOwnership(meetingId, userId);
            if (error) {
                return res.status(status).json({ success: false, message });
            }

            const deleteParams = {
                TableName: MEETINGS_TABLE_NAME,
                Key: { id: meetingId }
            };
            await docClient.send(new DeleteCommand(deleteParams));
            
            // PRODUCTION TODO: Implement robust cascading delete logic for associated resources.
            // This is critical to avoid orphaned data and unnecessary storage costs.
            // This might involve:
            // 1. Getting the meeting.recordingId.
            // 2. Deleting the corresponding item from RECORDINGS_ANALYSIS_TABLE_NAME.
            // 3. Deleting the audio file from S3 (using s3AudioPath from RECORDINGS_ANALYSIS_TABLE_NAME).
            // 4. Deleting PDF from S3 if stored (using pdfReportS3Path).
            // 5. Deleting Q&A history from RECORDINGS_ANALYSIS_TABLE_NAME.interactiveQnAHistory or a separate table.
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