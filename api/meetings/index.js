// File: /api/meetings/index.js
// Handles GET /api/meetings (list meetings for the authenticated user)
// Handles POST /api/meetings (create a new meeting for the authenticated user)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../utils/auth.js'; // Adjust path

const MEETINGS_TABLE_NAME = process.env.MEETINGS_TABLE_NAME;
const REGION = process.env.MY_AWS_REGION;

if (!MEETINGS_TABLE_NAME || !REGION) {
    console.error("FATAL_ERROR: Missing critical environment variables for meetings API.");
}

const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

export default async function handler(req, res) {
    if (!MEETINGS_TABLE_NAME || !REGION) { 
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
            // Assuming a GSI 'UserIdDateIndex' with 'userId' as partition key and 'date' as sort key for efficient querying.
            const params = {
                TableName: MEETINGS_TABLE_NAME,
                IndexName: 'UserIdDateIndex', // Replace with your actual GSI name
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: { ":uid": userId },
                ScanIndexForward: false // To get newest meetings first if 'date' is the GSI sort key
            };
            
            // If you don't have a GSI on userId, you'd have to use Scan + FilterExpression,
            // which is less performant on large tables.
            // const params = {
            //     TableName: MEETINGS_TABLE_NAME,
            //     FilterExpression: "userId = :uid",
            //     ExpressionAttributeValues: { ":uid": userId }
            // };
            // const { Items: userMeetings } = await docClient.send(new ScanCommand(params));
            
            const { Items: userMeetings } = await docClient.send(new QueryCommand(params));
            
            // DynamoDB Query with ScanIndexForward: false on a date sort key should return them sorted.
            // If not, or if using Scan, sort here:
            // if (userMeetings) {
            //     userMeetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            // }
            
            console.log(`API: Fetched ${userMeetings ? userMeetings.length : 0} meetings for user ${userId}`);
            res.status(200).json(userMeetings || []);

        } catch (error) {
            console.error('API Error fetching meetings:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch meetings.', errorDetails: error.message });
        }
    } else if (req.method === 'POST') {
        try {
            const { title, date, clientEmail, notes } = req.body;

            // Basic Input Validation
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
