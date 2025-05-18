// File: /api/client/validate-access.js
// Handles POST /api/client/validate-access
// This Vercel function interacts directly with DynamoDB.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const MEETINGS_TABLE_NAME = process.env.MEETINGS_TABLE_NAME;
const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.AWS_REGION;

// Validate all required environment variables
const requiredEnvVars = {
    MEETINGS_TABLE_NAME,
    RECORDINGS_ANALYSIS_TABLE_NAME,
    AWS_REGION: REGION
};

const missingEnvVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

if (missingEnvVars.length > 0) {
    console.error("FATAL_ERROR: Missing critical environment variables for client validate-access API:", missingEnvVars.join(', '));
}

let docClient;
if (REGION && MEETINGS_TABLE_NAME && RECORDINGS_ANALYSIS_TABLE_NAME) {
    try {
        const ddbClient = new DynamoDBClient({ region: REGION });
        docClient = DynamoDBDocumentClient.from(ddbClient);
        console.log(`DynamoDB client initialized successfully for region: ${REGION}`);
    } catch (error) {
        console.error("Failed to initialize DynamoDB client:", error);
    }
} else {
    console.error("DynamoDB Document Client not initialized in /api/client/validate-access.js due to missing environment variables.");
}

async function getRecordingAnalysis(recordingId) {
    const params = {
        TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
        Key: { 
            recordingId: recordingId
        }
    };
    const { Item } = await docClient.send(new GetCommand(params));
    return Item;
}

export default async function handler(req, res) {
    if (!docClient || !MEETINGS_TABLE_NAME || !RECORDINGS_ANALYSIS_TABLE_NAME) { 
        return res.status(500).json({ success: false, message: "Server configuration error for client validate-access API." });
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    try {
        const { shareableId, clientCode } = req.body;

        if (!shareableId || !clientCode) {
            return res.status(400).json({ success: false, message: 'Shareable Meeting ID and Client Code are required.' });
        }

        // Case 1: Check if Shareable ID exists
        const meetingParams = {
            TableName: MEETINGS_TABLE_NAME,
            IndexName: "ShareableMeetingIdIndex",
            KeyConditionExpression: "shareableMeetingId = :sid",
            ExpressionAttributeValues: {
                ":sid": shareableId
            }
        };

        const { Items } = await docClient.send(new QueryCommand(meetingParams));

        if (!Items || Items.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid Shareable Meeting ID.' });
        }

        // Case 2: Check if Access Code matches
        const meeting = Items.find(item => item.clientCode === clientCode.toUpperCase());

        if (!meeting) {
            return res.status(401).json({ success: false, message: 'Invalid Access Code.' });
        }

        // Case 3: Check if analysis is complete
        if (meeting.status !== 'Completed' || !meeting.recordingId) {
            return res.status(403).json({ success: false, message: 'Meeting analysis is not yet complete.' });
        }

        const recordingAnalysis = await getRecordingAnalysis(meeting.recordingId);

        if (!recordingAnalysis || !recordingAnalysis.analysisData || recordingAnalysis.analysisStatus !== 'completed') {
            return res.status(403).json({ success: false, message: 'Analysis is still in progress. Please try again later.' });
        }

        const fullAnalysis = recordingAnalysis.analysisData;
        const clientSpecificAnalysisData = {
            summary: fullAnalysis.clientAnalysis?.tailoredSummary || fullAnalysis.generalSummary || "Summary not available.",
            keyPoints: fullAnalysis.clientAnalysis?.keyDecisionsAndCommitments || [],
            actionItems: fullAnalysis.clientAnalysis?.actionItemsRelevantToClient || [],
            questions: fullAnalysis.clientAnalysis?.questionsAnsweredForClient || [],
        };

        console.log(`API: Client access validated for shareableId ${shareableId}, serving analysis for recordingId ${meeting.recordingId}`);
        res.status(200).json({
            success: true,
            analysisData: clientSpecificAnalysisData,
            recordingId: meeting.recordingId,
            title: meeting.title,
            date: meeting.date,
            meetingId: meeting.id
        });

    } catch (error) {
        console.error('API Error validating client access:', error);
        res.status(500).json({ success: false, message: 'Failed to validate client access.', errorDetails: error.message });
    }
}
