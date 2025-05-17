// File: /api/meetings/index.js
// Handles GET /api/meetings (list meetings for the authenticated user)
// Handles POST /api/meetings (create a new meeting for the authenticated user)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../utils/auth.js';

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
    console.error("FATAL_ERROR: Missing critical environment variables for meetings API:", missingEnvVars.join(', '));
    // This function might still be invoked by Vercel, so subsequent checks are needed.
}

let docClient;
if (REGION && MEETINGS_TABLE_NAME) {
    try {
        const ddbClient = new DynamoDBClient({ region: REGION });
        docClient = DynamoDBDocumentClient.from(ddbClient);
        console.log(`DynamoDB client initialized successfully for region: ${REGION}`);
    } catch (error) {
        console.error("Failed to initialize DynamoDB client:", error);
    }
} else {
    console.error("DynamoDB Document Client not initialized in /api/meetings/index.js due to missing REGION or MEETINGS_TABLE_NAME.");
}

export default async function handler(req, res) {
    if (!docClient || !MEETINGS_TABLE_NAME) { 
        return res.status(500).json({ success: false, message: "Server configuration error for meetings API." });
    }

    const authResult = authenticateToken(req);
    if (!authResult.authenticated) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Unauthorized" });
    }
    const userId = authResult.user.userId;

    if (req.method === 'GET') {
        try {
            // Fetch meetings for the authenticated userId from DynamoDB
            // Assumes a GSI 'UserIdDateIndex' with 'userId' as partition key and 'date' as sort key for efficient querying.
            const params = {
                TableName: MEETINGS_TABLE_NAME,
                IndexName: 'UserIdDateIndex', // Ensure this GSI exists on your table
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: { ":uid": userId },
                ScanIndexForward: false // To get newest meetings first if 'date' is the GSI sort key
            };
            
            const { Items: userMeetings } = await docClient.send(new QueryCommand(params));
            
            console.log(`API: Fetched ${userMeetings ? userMeetings.length : 0} meetings for user ${userId}`);
            res.status(200).json({ 
                success: true, 
                message: 'Meetings fetched successfully',
                data: userMeetings || [] 
            });

        } catch (error) {
            console.error('API Error fetching meetings:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to fetch meetings.', 
                errorDetails: error.message 
            });
        }
    } else if (req.method === 'POST') {
        try {
            const { title, date, clientEmail, notes } = req.body;

            if (!title || !date || !clientEmail) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Title, date, and clientEmail are required.' 
                });
            }
            if (isNaN(new Date(date).getTime())) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid date format for meeting.' 
                });
            }
            if (!/\S+@\S+\.\S+/.test(clientEmail)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid client email format.' 
                });
            }

            const meetingId = `sm-${uuidv4()}`; 
            const recordingId = `rec-${uuidv4()}`; 
            const clientCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const recorderAccessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
            const recorderLink = `recorder.html?recordingId=${recordingId}&recorderCode=${recorderAccessCode}`;

            const newMeeting = {
                id: meetingId, 
                userId, 
                title: title.trim(),
                date, 
                clientEmail: clientEmail.trim(),
                notes: notes ? notes.trim() : '',
                status: 'Scheduled',
                clientCode,
                recordingId, 
                recorderLink, 
                recorderAccessCode, 
                analysisAvailable: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const putParams = {
                TableName: MEETINGS_TABLE_NAME,
                Item: newMeeting
            };
            await docClient.send(new PutCommand(putParams));
            console.log(`API: Meeting ${meetingId} created for user ${userId} with linked recordingId ${recordingId}`);
            res.status(201).json({ 
                success: true, 
                message: 'Meeting created successfully',
                data: newMeeting 
            }); 

        } catch (error) {
            console.error('API Error creating meeting:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to create meeting.', 
                errorDetails: error.message 
            });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ 
            success: false, 
            message: `Method ${req.method} Not Allowed` 
        });
    }
}