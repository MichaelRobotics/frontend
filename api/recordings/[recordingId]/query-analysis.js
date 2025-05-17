// File: /api/recordings/[recordingId]/query-analysis.js
// Handles POST /api/recordings/:recordingId/query-analysis
// Vercel function fetches context from DynamoDB, proxies Q&A to role-specific AWS API Gateway -> Lambda,
// and stores Q&A history within the main analysis object in DynamoDB.

import { authenticateTokenOrClientAccess } from '../../utils/auth.js'; // Adjust path
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
// import fetch from 'node-fetch'; // Or global fetch in Node 18+

const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.MY_AWS_REGION;

// API Gateway Endpoints for Q&A Lambdas
const SALES_QNA_API_GATEWAY_ENDPOINT = process.env.SALES_QNA_API_GATEWAY_ENDPOINT;
const CLIENT_QNA_API_GATEWAY_ENDPOINT = process.env.CLIENT_QNA_API_GATEWAY_ENDPOINT;
const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY; // Optional

if (!RECORDINGS_ANALYSIS_TABLE_NAME || !REGION || 
    !SALES_QNA_API_GATEWAY_ENDPOINT || !CLIENT_QNA_API_GATEWAY_ENDPOINT ||
    !process.env.JWT_SECRET /* Needed by auth util */) {
    console.error("FATAL_ERROR: Missing critical environment variables for query-analysis API.");
}

const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }
    
    if (!RECORDINGS_ANALYSIS_TABLE_NAME || !SALES_QNA_API_GATEWAY_ENDPOINT || !CLIENT_QNA_API_GATEWAY_ENDPOINT) {
        return res.status(500).json({ success: false, message: "Server Q&A system not configured." });
    }

    const { recordingId } = req.query;
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ success: false, message: 'A question is required.' });
    }
    if (!recordingId) {
        return res.status(400).json({ success: false, message: 'Recording ID is required.' });
    }

    const authResult = await authenticateTokenOrClientAccess(req, recordingId);
    if (!authResult.granted) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message || "Access Denied" });
    }
    const role = authResult.role;
    const userIdForLog = authResult.user ? authResult.user.userId : 'client_session';

    try {
        // 1. Fetch analysisData from DynamoDB to get transcript and agent identifier
        const recordingParams = {
            TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
            Key: { recordingId: recordingId },
        };
        const { Item: recording } = await docClient.send(new GetCommand(recordingParams));

        if (!recording || !recording.analysisData || !recording.analysisData.transcript) {
            return res.status(404).json({ success: false, message: 'Transcript context not found for Q&A for this recording.' });
        }
        if (recording.analysisStatus !== 'completed') {
            return res.status(400).json({ success: false, message: 'Analysis is not yet complete for this recording. Cannot query.' });
        }

        const transcriptContext = recording.analysisData.transcript;
        let queryAgentIdentifier = null;
        let additionalContextForAgent = {}; 
        let targetApiGatewayEndpoint;

        if (role === 'salesperson' && recording.analysisData.salespersonAnalysis) {
            queryAgentIdentifier = recording.analysisData.salespersonAnalysis.queryAgentIdentifier;
            additionalContextForAgent = { 
                summary: recording.analysisData.salespersonAnalysis.tailoredSummary, 
                keyPoints: recording.analysisData.salespersonAnalysis.keyPoints 
            };
            targetApiGatewayEndpoint = SALES_QNA_API_GATEWAY_ENDPOINT;
        } else if (role === 'client' && recording.analysisData.clientAnalysis) {
            queryAgentIdentifier = recording.analysisData.clientAnalysis.queryAgentIdentifier;
            additionalContextForAgent = { 
                summary: recording.analysisData.clientAnalysis.tailoredSummary, 
                keyDecisions: recording.analysisData.clientAnalysis.keyDecisionsAndCommitments 
            };
            targetApiGatewayEndpoint = CLIENT_QNA_API_GATEWAY_ENDPOINT;
        } else {
            console.warn(`Q&A agent identifier or specific analysis section not found for role "${role}" on recording "${recordingId}".`);
            return res.status(400).json({ success: false, message: "Q&A agent not configured for your role or this recording's current analysis state." });
        }
        
        if (!queryAgentIdentifier || !targetApiGatewayEndpoint) {
             console.error(`Configuration error: Query agent identifier or target endpoint missing for role ${role}, recording ${recordingId}`);
             return res.status(500).json({ success: false, message: "Internal server error: Q&A agent configuration missing." });
        }

        // 2. Call the role-specific Q&A API Gateway endpoint
        const apiGwPayload = {
            question,
            transcriptContext,
            additionalRoleContext: additionalContextForAgent,
            agentIdentifier: queryAgentIdentifier, 
            recordingId, 
            userId: userIdForLog 
        };
        
        const fetchOptions = {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(API_GATEWAY_KEY && { 'x-api-key': API_GATEWAY_KEY }),
            },
            body: JSON.stringify(apiGwPayload)
        };

        console.log(`API: Calling Q&A Agent at ${targetApiGatewayEndpoint} for recording ${recordingId}, role ${role}`);
        const apiGwResponse = await fetch(targetApiGatewayEndpoint, fetchOptions);
        
        const responseBodyText = await apiGwResponse.text();
        let qnaResult;
        try {
            qnaResult = JSON.parse(responseBodyText);
        } catch(e) {
            console.error("Failed to parse Q&A API Gateway response as JSON:", responseBodyText, "Status:", apiGwResponse.status);
            throw new Error(`Invalid response from Q&A service: ${apiGwResponse.status} ${apiGwResponse.statusText}`);
        }

        if (!apiGwResponse.ok || !qnaResult.success || typeof qnaResult.answer === 'undefined') {
            console.error("Q&A API Gateway Error Data:", qnaResult);
            throw new Error(qnaResult.message || `Q&A Agent API Gateway error: ${apiGwResponse.status}`);
        }

        // 3. Store Q&A pair in DynamoDB (Append to list in RecordingsAnalysisTable)
        const qnaEntry = { 
            timestamp: new Date().toISOString(), 
            roleOfQuerier: role, 
            userId: userIdForLog, 
            question, 
            answerFromAgent: qnaResult.answer, 
            agentUsed: queryAgentIdentifier 
        };
        
        const updateQnAParams = {
            TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
            Key: { recordingId },
            // Initialize interactiveQnAHistory as an empty list if it doesn't exist, then append.
            UpdateExpression: "SET #ad.#ih = list_append(if_not_exists(#ad.#ih, :empty_list), :qnaEntryVal)",
            ExpressionAttributeNames: { 
                "#ad": "analysisData", // 'analysisData' is a top-level attribute (Map)
                "#ih": "interactiveQnAHistory" // 'interactiveQnAHistory' is an attribute within the 'analysisData' map
            },
            ExpressionAttributeValues: { 
                ":qnaEntryVal": [qnaEntry], // list_append expects lists as arguments
                ":empty_list": [] 
            }
        };
        await docClient.send(new UpdateCommand(updateQnAParams));
        
        console.log(`API: Q&A for ${recordingId} (Role: ${role}) processed and logged. Question: "${question}"`);
        res.status(200).json({ success: true, answer: qnaResult.answer });

    } catch (error) {
        console.error(`API Error querying analysis for recording ${recordingId}:`, error);
        res.status(500).json({ success: false, message: 'Failed to query analysis.', errorDetails: error.message });
    }
}
