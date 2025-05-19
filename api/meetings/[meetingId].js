// File: /api/meetings/[meetingId].js
// Handles GET, PUT, DELETE for /api/meetings/:meetingId

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { authenticateToken } from '../utils/auth.js'; // Ensure this path is correct

const MEETINGS_TABLE_NAME = process.env.MEETINGS_TABLE_NAME;
const REGION = process.env.AWS_REGION;

// Validate all required environment variables
const requiredEnvVars = {
    MEETINGS_TABLE_NAME,
    AWS_REGION: REGION,
    JWT_SECRET: process.env.JWT_SECRET // Needed by authenticateToken
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
        docClient = DynamoDBDocumentClient.from(ddbClient);
        console.log(`DynamoDB client initialized successfully for region: ${REGION} in /api/meetings/[meetingId].js`);
    } catch (error) {
        console.error("Failed to initialize DynamoDB client in /api/meetings/[meetingId].js:", error);
    }
} else {
    console.error("DynamoDB Document Client not initialized in /api/meetings/[meetingId].js due to missing REGION or MEETINGS_TABLE_NAME.");
}

// Helper to get a meeting and verify ownership by userId
// Assumes primary key is userId (Partition Key) and id (Sort Key - meeting's unique sm-xxxx ID)
async function getMeetingAndVerifyOwnership(meetingId, ownerId) {
    if (!docClient) throw new Error("DynamoDB client not initialized in getMeetingAndVerifyOwnership.");
    if (!MEETINGS_TABLE_NAME) throw new Error("MEETINGS_TABLE_NAME not configured for ownership check.");
    
    const params = {
        TableName: MEETINGS_TABLE_NAME,
        Key: { 
            userId: ownerId, 
            id: meetingId     
        },
    };
    const { Item: meeting } = await docClient.send(new GetCommand(params));

    if (!meeting) {
        // It's possible the meeting exists but is not owned by this user, 
        // or it truly doesn't exist. For security, give a generic message.
        return { error: true, status: 404, message: 'Meeting not found or you do not have access.' };
    }
    // The Key condition `userId: ownerId` in the GetCommand ensures ownership if the item is found.
    return { meeting }; 
}

export default async function handler(req, res) {
    const { meetingId } = req.query; // This is the 'id' (sm-xxxx) part of the composite PK

    if (!docClient || !MEETINGS_TABLE_NAME) { 
        return res.status(500).json({ success: false, message: "Server configuration error for meetings API (client/table name missing)." });
    }

    const authResult = authenticateToken(req);
    if (!authResult.authenticated) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Unauthorized" });
    }
    const userId = authResult.user.userId; 

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
            console.error(`API Error fetching meeting ${meetingId} for user ${userId}:`, error);
            res.status(500).json({ success: false, message: `Failed to fetch meeting.`, errorDetails: error.message });
        }
    } else if (req.method === 'PUT') {
        try {
            const updates = req.body; // e.g., { status: 'uploading_to_backend', duration: 'HH:MM:SS' }
                                    // or { status: 'processing', analysisAvailable: false }
            
            const allowedUpdateFields = ['title', 'date', 'clientEmail', 'notes', 'status', 'startTimeActual', 'duration', 'analysisAvailable'];
            const receivedUpdateFields = Object.keys(updates);
            const validUpdateFieldsProvided = receivedUpdateFields.some(field => allowedUpdateFields.includes(field) && updates[field] !== undefined);

            if (!validUpdateFieldsProvided) {
                 return res.status(400).json({ success: false, message: 'No valid update data provided. At least one allowed field with a non-undefined value is required.' });
            }
            if (updates.date && isNaN(new Date(updates.date).getTime())) {
                 return res.status(400).json({ success: false, message: 'Invalid date format for update.' });
            }
            if (updates.clientEmail && (typeof updates.clientEmail !== 'string' || !/\S+@\S+\.\S+/.test(updates.clientEmail))) {
                return res.status(400).json({ success: false, message: 'Invalid client email format for update.' });
            }

            // Verify ownership before update
            const { meeting: existingMeeting, error, status: ownerCheckStatus, message: ownerCheckMessage } = await getMeetingAndVerifyOwnership(meetingId, userId);
            if (error) {
                return res.status(ownerCheckStatus).json({ success: false, message: ownerCheckMessage });
            }

            let updateExpressionParts = [];
            const expressionAttributeValues = { ":ua": new Date().toISOString() }; // Always update 'updatedAt'
            const expressionAttributeNames = {}; 
            updateExpressionParts.push("updatedAt = :ua");

            // TODO: Implement TTL attribute update if needed based on status changes
            // Example: if (updates.status === 'Completed' || updates.status === 'failed') { ... set ttl ... }

            for (const field of allowedUpdateFields) {
                if (updates[field] !== undefined) { // Process only fields present in the payload
                    const valuePlaceholder = `:${field.toLowerCase().replace(/[^a-z0-9]/gi, '')}`; // e.g. :title, :starttimeactual
                    
                    let attributeNamePlaceholder = field;
                    // Handle DynamoDB reserved keywords by using ExpressionAttributeNames
                    if (["date", "status", "duration", "title", "notes"].includes(field.toLowerCase())) { // Add other common reserved words if used as field names
                        const namePlaceholder = `#attr_${field.toLowerCase()}`;
                        expressionAttributeNames[namePlaceholder] = field;
                        attributeNamePlaceholder = namePlaceholder;
                    }
                    
                    updateExpressionParts.push(`${attributeNamePlaceholder} = ${valuePlaceholder}`);
                    expressionAttributeValues[valuePlaceholder] = typeof updates[field] === 'string' ? updates[field].trim() : updates[field];
                }
            }
            
            // This check ensures at least one field beyond 'updatedAt' was processed from the payload.
            if (updateExpressionParts.length <= 1) { 
                 console.warn("Update attempt for meetingId:", meetingId, "with payload:", updates, "resulted in no actual field changes beyond updatedAt.");
                 return res.status(400).json({ success: false, message: 'No updatable fields provided in the payload.' });
            }

            const updateParams = {
                TableName: MEETINGS_TABLE_NAME,
                Key: { userId: userId, id: meetingId },
                UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: "ALL_NEW" // Returns the item as it appears after the update
            };

            if (Object.keys(expressionAttributeNames).length > 0) {
                updateParams.ExpressionAttributeNames = expressionAttributeNames;
            }

            console.log("Attempting to update meeting with params:", JSON.stringify(updateParams, null, 2));

            const { Attributes: updatedMeeting } = await docClient.send(new UpdateCommand(updateParams));
            console.log(`API: Meeting ${meetingId} updated for user ${userId}. New attributes:`, updatedMeeting);
            res.status(200).json({ success: true, message: 'Meeting updated successfully', data: updatedMeeting });

        } catch (error) {
            console.error(`API Error updating meeting ${meetingId} for user ${userId}. Payload: ${JSON.stringify(req.body)}. Error:`, error);
            res.status(500).json({ 
                success: false, 
                message: `Failed to update meeting. ${error.name === 'ValidationException' ? 'There was an issue with the data provided.' : 'An internal server error occurred.'}`, 
                errorDetails: error.message,
                errorType: error.name 
            });
        }
    } else if (req.method === 'DELETE') {
        try {
            const { meeting, error, status, message } = await getMeetingAndVerifyOwnership(meetingId, userId);
            if (error) {
                return res.status(status).json({ success: false, message });
            }

            const deleteParams = {
                TableName: MEETINGS_TABLE_NAME,
                Key: { userId: userId, id: meetingId }
            };
            await docClient.send(new DeleteCommand(deleteParams));
            
            console.log(`API: Meeting ${meetingId} deleted by user ${userId}. Associated recordingId: ${meeting?.recordingId}. Further cleanup of related resources (S3 audio, analysis data in ${process.env.RECORDINGS_ANALYSIS_TABLE_NAME}) is required.`);

            res.status(200).json({ success: true, message: `Meeting ${meetingId} deleted successfully.` });

        } catch (error) {
            console.error(`API Error deleting meeting ${meetingId} for user ${userId}:`, error);
            res.status(500).json({ success: false, message: `Failed to delete meeting.`, errorDetails: error.message });
        }
    } else {
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }
}
