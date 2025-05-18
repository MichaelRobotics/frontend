// File: /api/client/validate-access.js
// Handles POST /api/client/validate-access
// This Vercel function interacts directly with DynamoDB.

// At the top of /api/client/validate-access.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"; // Add QueryCommand here

const MEETINGS_TABLE_NAME = process.env.MEETINGS_TABLE_NAME; 
const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.AWS_REGION;

if (!MEETINGS_TABLE_NAME || !RECORDINGS_ANALYSIS_TABLE_NAME || !REGION) {
    console.error("FATAL_ERROR: Missing critical environment variables for client access API.");
}

const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    if (!MEETINGS_TABLE_NAME || !RECORDINGS_ANALYSIS_TABLE_NAME || !REGION) {
        return res.status(500).json({ success: false, message: "Server configuration error." });
    }

    try {
        const { meetingId, clientCode } = req.body; 

        if (!meetingId || !clientCode) {
            return res.status(400).json({ success: false, message: 'Meeting ID and Client Code are required.' });
        }

        // 1. Find the meeting in MEETINGS_TABLE_NAME by its original ID and validate clientCode
        const meetingParams = {
            TableName: MEETINGS_TABLE_NAME,
            IndexName: "MeetingIdIndex", // Use the name of the GSI you created
            KeyConditionExpression: "id = :mid", // Query by 'id' on the GSI
            ExpressionAttributeValues: {
                ":mid": meetingId
            }
        };
        const { Items } = await docClient.send(new QueryCommand(meetingParams));
        
        if (!Items || Items.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid Meeting ID.' });
        }
        const meeting = Items[0]; // Assuming 'id' is globally unique, so expect 0 or 1 item
        
        // The rest of your validation logic using the 'meeting' object:
        if (!meeting || meeting.clientCode !== clientCode.toUpperCase()) { 
            return res.status(401).json({ success: false, message: 'Invalid Meeting ID or Client Code.' });
        }        

        if (!meeting || meeting.clientCode !== clientCode.toUpperCase()) { 
            return res.status(401).json({ success: false, message: 'Invalid Meeting ID or Client Code.' });
        }

        // 2. Check if the meeting is completed and has a linked recordingId
        if (meeting.status !== 'completed' || !meeting.recordingId) { 
            return res.status(403).json({ success: false, message: 'Meeting analysis is not yet complete or available for client access.' });
        }
        const recordingIdForAnalysis = meeting.recordingId; 

        // 3. Fetch the actual analysis data using the linked recordingId from RECORDINGS_ANALYSIS_TABLE_NAME
        const analysisParams = {
            TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
            Key: { recordingId: recordingIdForAnalysis },
        };
        const { Item: recordingWithAnalysis } = await docClient.send(new GetCommand(analysisParams));

        if (!recordingWithAnalysis || !recordingWithAnalysis.analysisData || recordingWithAnalysis.analysisStatus !== 'completed') {
            return res.status(404).json({ success: false, message: 'Analysis data not found or not completed for this meeting.' });
        }
        
        // 4. Shape the data specifically for the client
        const fullAnalysis = recordingWithAnalysis.analysisData;
        const clientSpecificAnalysisData = {
            summary: fullAnalysis.clientAnalysis?.tailoredSummary || fullAnalysis.generalSummary || "Summary not available.",
            keyPoints: fullAnalysis.clientAnalysis?.keyDecisionsAndCommitments || [],
            actionItems: fullAnalysis.clientAnalysis?.actionItemsRelevantToClient || [],
            questions: fullAnalysis.clientAnalysis?.questionsAnsweredForClient || [],
        };
        
        console.log(`API: Client access validated for meetingId ${meetingId}, serving analysis for recordingId ${recordingIdForAnalysis}`);
        res.status(200).json({
            success: true,
            analysisData: clientSpecificAnalysisData,
            recordingId: recordingIdForAnalysis, 
            title: meeting.title,
            date: meeting.date 
        });

    } catch (error) {
        console.error('Client access validation API error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during client access validation.', errorDetails: error.message });
    }
}
