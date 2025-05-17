// File: /api/client/validate-access.js
// Handles POST /api/client/validate-access

// const AWS = require('aws-sdk');
// AWS.config.update({ /* ... */ });
// const dynamoDb = new AWS.DynamoDB.DocumentClient();
// const MEETINGS_TABLE_NAME = process.env.MEETINGS_TABLE_NAME; 
// const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    try {
        const { meetingId, clientCode } = req.body; // meetingId here is the salesperson's original meeting ID

        if (!meetingId || !clientCode) {
            return res.status(400).json({ success: false, message: 'Meeting ID and Client Code are required.' });
        }

        // --- PRODUCTION: Database Interaction (DynamoDB) ---
        /*
        // 1. Find the meeting in MEETINGS_TABLE_NAME by its original ID and validate clientCode
        const meetingParams = {
            TableName: MEETINGS_TABLE_NAME,
            Key: { id: meetingId }, 
        };
        const { Item: meeting } = await dynamoDb.get(meetingParams).promise();

        if (!meeting || meeting.clientCode !== clientCode) {
            return res.status(401).json({ success: false, message: 'Invalid Meeting ID or Client Code.' });
        }

        if (meeting.status !== 'completed') { // Or check analysisAvailable flag
            return res.status(403).json({ success: false, message: 'Meeting analysis is not yet complete or available.' });
        }

        // 2. Fetch the actual analysis data using the linked recordingId from the meeting object
        const recordingIdForAnalysis = meeting.recordingId; // This is the crucial link
        if (!recordingIdForAnalysis) {
             return res.status(404).json({ success: false, message: 'Recording session identifier not found for this meeting.' });
        }

        const analysisParams = {
            TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
            Key: { recordingId: recordingIdForAnalysis },
        };
        const { Item: recordingWithAnalysis } = await dynamoDb.get(analysisParams).promise();

        if (!recordingWithAnalysis || !recordingWithAnalysis.analysisData) {
            return res.status(404).json({ success: false, message: 'Analysis data not found for this meeting.' });
        }
        
        // Shape the data specifically for the client
        const clientSpecificAnalysisData = {
            summary: recordingWithAnalysis.analysisData.clientAnalysis ? recordingWithAnalysis.analysisData.clientAnalysis.tailoredSummary : recordingWithAnalysis.analysisData.generalSummary,
            keyPoints: recordingWithAnalysis.analysisData.clientAnalysis ? recordingWithAnalysis.analysisData.clientAnalysis.keyDecisionsAndCommitments : [],
            actionItems: recordingWithAnalysis.analysisData.clientAnalysis ? recordingWithAnalysis.analysisData.clientAnalysis.actionItemsRelevantToClient : [],
            questions: recordingWithAnalysis.analysisData.clientAnalysis ? recordingWithAnalysis.analysisData.clientAnalysis.questionsAnsweredForClient : [],
            // Exclude sensitive fields like full transcript or internal sales sentiment
        };

        res.status(200).json({
            success: true,
            analysisData: clientSpecificAnalysisData,
            recordingId: recordingIdForAnalysis, // Send the ID client needs for further calls (PDF, Q&A)
            title: meeting.title,
            date: meeting.date
        });
        */

        // --- SIMULATED CLIENT ACCESS ---
        console.log(`API: POST /api/client/validate-access for meetingId: ${meetingId}, clientCode: ${clientCode}`);
        let foundMeetingData = null;
        if (clientCode === "C1A2B3" && meetingId === "sm-server-" + (new Date(Date.now() + 86400000 * 2).toISOString().substring(0,10).replace(/-/g,''))) { // Example matching
            foundMeetingData = { 
                title: "Q1 Review (Server)", 
                date: new Date(Date.now() + 86400000 * 2).toISOString(),
                recordingId: `rec-srv-${new Date(Date.now() + 86400000 * 2).toISOString().substring(0,10).replace(/-/g,'')}`, // Example
                analysisData: {
                    summary: `<p>Client Access: Summary for 'Q1 Review (Server)'. Analysis is complete.</p>`,
                    keyPoints: [`Client Key Point Alpha for Q1 Review`],
                    actionItems: [`Client Action: Review Q1 proposal.`],
                    questions: [`Was the Q1 budget approved?`]
                }
            };
        } else if (clientCode === "D4E5F6" && meetingId === "sm-server-" + (new Date(Date.now() - 86400000 * 5).toISOString().substring(0,10).replace(/-/g,''))) {
             foundMeetingData = {
                title: "Project Phoenix Kickoff (Server)",
                date: new Date(Date.now() - 86400000 * 5).toISOString(),
                recordingId: `rec-srv-${new Date(Date.now() - 86400000 * 5).toISOString().substring(0,10).replace(/-/g,'')}`,
                analysisData: { 
                    summary: "<p>Client View: Mock summary from server for Project Phoenix</p>", 
                    keyPoints: ["Client Key Decision 1", "Client Key Decision 2"], 
                    actionItems: ["Client Action Item: Provide feedback."], 
                    questions: ["When is next milestone?"]
                }
            };
        }

        if (foundMeetingData) {
            res.status(200).json({ 
                success: true, 
                analysisData: foundMeetingData.analysisData, 
                recordingId: foundMeetingData.recordingId,
                title: foundMeetingData.title,
                date: foundMeetingData.date
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials or analysis not ready (Simulated).' });
        }
        // --- END SIMULATED CLIENT ACCESS ---

    } catch (error) {
        console.error('Client access validation API error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during client access validation.', errorDetails: error.message });
    }
}
