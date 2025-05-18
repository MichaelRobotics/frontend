// File: /api/client/validate-access.js
// Handles POST /api/client/validate-access
// This Vercel function interacts directly with DynamoDB.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getLatestRecordingAnalysisItem } from '../utils/analysis.js';

const MEETINGS_TABLE_NAME = process.env.MEETINGS_TABLE_NAME;
const REGION = process.env.AWS_REGION;

// Validate all required environment variables
const requiredEnvVars = {
    MEETINGS_TABLE_NAME,
    AWS_REGION: REGION
};

const missingEnvVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

if (missingEnvVars.length > 0) {
    console.error("FATAL_ERROR: Missing critical environment variables for client validate-access API:", missingEnvVars.join(', '));
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
    console.error("DynamoDB Document Client not initialized in /api/client/validate-access.js due to missing REGION or MEETINGS_TABLE_NAME.");
}

export default async function handler(req, res) {
    if (!docClient || !MEETINGS_TABLE_NAME) { 
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

        const meeting = Items.find(item => item.clientCode === clientCode.toUpperCase());

        if (!meeting) {
            return res.status(401).json({ success: false, message: 'Invalid Shareable Meeting ID or Client Code.' });
        }

        if (meeting.status !== 'Completed' || !meeting.recordingId) {
            return res.status(403).json({ success: false, message: 'Meeting analysis is not yet complete or available for client access.' });
        }

        const recordingIdForAnalysis = meeting.recordingId;
        const recordingWithAnalysis = await getLatestRecordingAnalysisItem(docClient, recordingIdForAnalysis);

        if (!recordingWithAnalysis || !recordingWithAnalysis.analysisData || recordingWithAnalysis.analysisStatus !== 'completed') {
            return res.status(404).json({ success: false, message: 'Analysis data not found or not completed for this meeting.' });
        }

        const fullAnalysis = recordingWithAnalysis.analysisData;
        const clientSpecificAnalysisData = {
            summary: fullAnalysis.clientAnalysis?.tailoredSummary || fullAnalysis.generalSummary || "Summary not available.",
            keyPoints: fullAnalysis.clientAnalysis?.keyDecisionsAndCommitments || [],
            actionItems: fullAnalysis.clientAnalysis?.actionItemsRelevantToClient || [],
            questions: fullAnalysis.clientAnalysis?.questionsAnsweredForClient || [],
        };

        console.log(`API: Client access validated for shareableId ${shareableId}, serving analysis for recordingId ${recordingIdForAnalysis}`);
        res.status(200).json({
            success: true,
            analysisData: clientSpecificAnalysisData,
            recordingId: recordingIdForAnalysis,
            title: meeting.title,
            date: meeting.date,
            meetingId: meeting.id
        });

    } catch (error) {
        console.error('API Error validating client access:', error);
        res.status(500).json({ success: false, message: 'Failed to validate client access.', errorDetails: error.message });
    }
}
