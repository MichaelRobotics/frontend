// File: /api/meetings/index.js
// Handles GET /api/meetings (list meetings)
// Handles POST /api/meetings (create new meeting)

// const AWS = require('aws-sdk');
// const { authenticateToken } = require('../../utils/auth'); // Your JWT authentication utility
// const { v4: uuidv4 } = require('uuid');

// Configure AWS SDK
// AWS.config.update({ /* ... */ });
// const dynamoDb = new AWS.DynamoDB.DocumentClient();
// const MEETINGS_TABLE_NAME = process.env.MEETINGS_TABLE_NAME;

// Placeholder for your actual authentication logic
function authenticateToken(req) {
    // In a real app, verify JWT from req.headers.authorization
    // For now, simulate an authenticated user
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer simulated_jwt_token_for_")) {
        const email = authHeader.split("Bearer simulated_jwt_token_for_")[1];
         return { authenticated: true, user: { userId: `user-sim-${email.split('@')[0]}`, email: email, role: 'salesperson' } };
    }
    // return { authenticated: false, message: "Invalid or missing token" };
    // For broader testing without frontend sending token yet:
    return { authenticated: true, user: { userId: "user-sim-123", email: "test@example.com", role: "salesperson" } };
}


export default async function handler(req, res) {
    const authResult = authenticateToken(req);
    if (!authResult.authenticated) {
        return res.status(401).json({ success: false, message: authResult.message || "Unauthorized" });
    }
    const userId = authResult.user.userId;

    if (req.method === 'GET') {
        try {
            // --- PRODUCTION: Fetch meetings for the authenticated userId from DynamoDB ---
            /*
            const params = {
                TableName: MEETINGS_TABLE_NAME,
                FilterExpression: "userId = :uid", 
                ExpressionAttributeValues: { ":uid": userId }
            };
            const data = await dynamoDb.scan(params).promise(); 
            const userMeetings = data.Items || [];
            res.status(200).json(userMeetings);
            */

            // --- SIMULATED GET ---
            console.log(`API: GET /api/meetings for user ${userId}`);
            const simulatedMeetings = [
                { id: `sm-server-${Date.now() + 1000}`, userId, title: 'Q1 Review (Server)', date: new Date(Date.now() + 86400000 * 2).toISOString(), clientEmail: 'client.q1@example.com', status: 'Scheduled', notes: 'Review Q1 performance and plan Q2.', clientCode: 'C1A2B3', recordingId: `rec-srv-${Date.now() + 1000}`, recorderLink: `recorder.html?recordingId=rec-srv-${Date.now() + 1000}&recorderCode=RECCODE1`, analysisAvailable: false, analysisData: null, recorderAccessCode: "RECCODE1" },
                { id: `sm-server-${Date.now() + 2000}`, userId, title: 'Project Phoenix Kickoff (Server)', date: new Date(Date.now() - 86400000 * 5).toISOString(), clientEmail: 'phoenix.lead@example.com', status: 'Completed', notes: 'Kickoff meeting for Project Phoenix.', clientCode: 'D4E5F6', recordingId: `rec-srv-${Date.now() + 2000}`, recorderLink: `recorder.html?recordingId=rec-srv-${Date.now() + 2000}&recorderCode=RECCODE2`, analysisAvailable: true, analysisData: { summary: "<p>Successful kickoff for Project Phoenix. Key stakeholders aligned.</p>", transcript: "[00:00:00] Welcome to Project Phoenix...", keyPoints: "<li>Finalize budget</li>", actionItems: "<ol><li>PM to create project plan</li></ol>", questions: "<ul><li>What is the hard deadline?</li></ul>", sentiment: "<p>Very Positive</p>"}, recorderAccessCode: "RECCODE2"}
            ];
            res.status(200).json(simulatedMeetings);
            // --- END SIMULATED GET ---

        } catch (error) {
            console.error('API Error fetching meetings:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch meetings.', errorDetails: error.message });
        }
    } else if (req.method === 'POST') {
        try {
            const { title, date, clientEmail, notes } = req.body;

            if (!title || !date || !clientEmail) {
                return res.status(400).json({ success: false, message: 'Title, date, and clientEmail are required.' });
            }

            const meetingId = `sm-server-${Date.now()}`; 
            const recordingId = `rec-server-${Date.now()}`; 
            const clientCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const recorderAccessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
            const recorderLink = `recorder.html?recordingId=${recordingId}&recorderCode=${recorderAccessCode}`;

            const newMeeting = {
                id: meetingId,
                userId, 
                title, date, clientEmail,
                notes: notes || '',
                status: 'Scheduled', clientCode, recordingId, recorderLink, 
                recorderAccessCode, 
                analysisAvailable: false, analysisData: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // --- PRODUCTION: Store newMeeting in DynamoDB ---
            /*
            const params = {
                TableName: MEETINGS_TABLE_NAME,
                Item: newMeeting
            };
            await dynamoDb.put(params).promise();
            res.status(201).json(newMeeting);
            */

            // --- SIMULATED POST ---
            console.log('API: POST /api/meetings creating (simulated):', newMeeting);
            res.status(201).json(newMeeting);
            // --- END SIMULATED POST ---

        } catch (error) {
            console.error('API Error creating meeting:', error);
            res.status(500).json({ success: false, message: 'Failed to create meeting.', errorDetails: error.message });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }
}
