// File: /api/meetings/index.js
// Handles GET /api/meetings (list meetings for the authenticated user)
// Handles POST /api/meetings (create a new meeting for the authenticated user)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../utils/auth.js'; // Corrected path

// --- Environment Variable Loading and Logging (for debugging) ---
const MEETINGS_TABLE_NAME = process.env.MEETINGS_TABLE_NAME;
const REGION = process.env.MY_AWS_REGION;
const JWT_SECRET_PRESENT = process.env.JWT_SECRET ? "SET" : "NOT SET"; // Check presence, not value
const AWS_ACCESS_KEY_ID_PRESENT = process.env.MY_AWS_ACCESS_KEY_ID ? "SET" : "NOT SET";
const AWS_SECRET_ACCESS_KEY_PRESENT = process.env.MY_AWS_SECRET_ACCESS_KEY ? "TRUNCATED..." : "NOT SET"; // Don't log the actual secret

console.log("--- /api/meetings/index.js Environment Variables ---");
console.log(`MEETINGS_TABLE_NAME: ${MEETINGS_TABLE_NAME || "NOT SET"}`);
console.log(`MY_AWS_REGION: ${REGION || "NOT SET"}`);
console.log(`JWT_SECRET_PRESENT: ${JWT_SECRET_PRESENT}`);
console.log(`MY_AWS_ACCESS_KEY_ID_PRESENT: ${AWS_ACCESS_KEY_ID_PRESENT}`);
console.log(`MY_AWS_SECRET_ACCESS_KEY_PRESENT: ${AWS_SECRET_ACCESS_KEY_PRESENT}`);
console.log("----------------------------------------------------");

if (!MEETINGS_TABLE_NAME || !REGION || !process.env.JWT_SECRET || !process.env.MY_AWS_ACCESS_KEY_ID || !process.env.MY_AWS_SECRET_ACCESS_KEY) {
    console.error("FATAL_ERROR: Missing one or more critical environment variables for meetings API. Function may not initialize AWS SDK correctly.");
    // Note: The function might still be invoked by Vercel, so subsequent checks are needed.
}

let ddbClient;
let docClient;

try {
    if (REGION) { // Only initialize if REGION is set
        ddbClient = new DynamoDBClient({ region: REGION });
        docClient = DynamoDBDocumentClient.from(ddbClient);
    } else {
        console.error("AWS SDK DynamoDB Client NOT initialized due to missing REGION.");
    }
} catch (e) {
    console.error("Error initializing AWS SDK DynamoDB Client:", e);
    // This error at module level might cause Vercel to serve the file as text.
}


export default async function handler(req, res) {
    // Re-check critical configurations within the handler
    if (!MEETINGS_TABLE_NAME || !REGION || !process.env.JWT_SECRET || !docClient) { 
        console.error("/api/meetings handler: Server configuration error. Required variables or DDB client missing.");
        return res.status(500).json({ success: false, message: "Server configuration error for meetings API." });
    }

    const authResult = authenticateToken(req); // authenticateToken also checks for JWT_SECRET
    if (!authResult.authenticated) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Unauthorized" });
    }
    const userId = authResult.user.userId;

    if (req.method === 'GET') {
        try {
            console.log(`API: GET /api/meetings attempt for user ${userId}`);
            // Ensure you have a GSI 'UserIdDateIndex' on MEETINGS_TABLE_NAME
            // Partition Key: userId (String)
            // Sort Key: date (String - ISO8601 format)
            const params = {
                TableName: MEETINGS_TABLE_NAME,
                IndexName: 'UserIdDateIndex', 
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: { ":uid": userId },
                ScanIndexForward: false // To get newest meetings first
            };
            
            const { Items: userMeetings } = await docClient.send(new QueryCommand(params));
            
            console.log(`API: Fetched ${userMeetings ? userMeetings.length : 0} meetings for user ${userId}`);
            res.status(200).json(userMeetings || []);

        } catch (error) {
            console.error('API Error fetching meetings:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch meetings.', errorDetails: error.message });
        }
    } else if (req.method === 'POST') {
        try {
            console.log(`API: POST /api/meetings attempt for user ${userId}`);
            const { title, date, clientEmail, notes } = req.body;

            if (!title || !date || !clientEmail) {
                return res.status(400).json({ success: false, message: 'Title, date, and clientEmail are required.' });
            }
            if (isNaN(new Date(date).getTime())) {
                return res.status(400).json({ success: false, message: 'Invalid date format for meeting.' });
            }
            if (!/\S+@\S+\.\S+/.test(clientEmail)) {
                return res.status(400).json({ success: false, message: 'Invalid client email format.' });
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
            res.status(201).json(newMeeting); 

        } catch (error) {
            console.error('API Error creating meeting:', error);
            res.status(500).json({ success: false, message: 'Failed to create meeting.', errorDetails: error.message });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }
}