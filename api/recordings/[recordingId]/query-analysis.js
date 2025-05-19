// File: /api/recordings/[recordingId]/query-analysis.js
// Handles POST /api/recordings/:recordingId/query-analysis
// Fetches LATEST COMPLETED analysis context, proxies Q&A, stores history.

import { authenticateTokenOrClientAccess } from '../../utils/auth.js'; 
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"; // QueryCommand
// import fetch from 'node-fetch'; // Or global fetch in Node 18+

const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.MY_AWS_REGION; // Ensure this is MY_AWS_REGION or AWS_REGION as per your Vercel env
const SALES_QNA_API_GATEWAY_ENDPOINT = process.env.SALES_QNA_API_GATEWAY_ENDPOINT;
const CLIENT_QNA_API_GATEWAY_ENDPOINT = process.env.CLIENT_QNA_API_GATEWAY_ENDPOINT;
const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY; // Optional

if (!RECORDINGS_ANALYSIS_TABLE_NAME || !REGION || 
    !SALES_QNA_API_GATEWAY_ENDPOINT || !CLIENT_QNA_API_GATEWAY_ENDPOINT ||
    !process.env.JWT_SECRET) {
    console.error("FATAL_ERROR: Missing critical environment variables for /api/recordings/[recordingId]/query-analysis.js");
}

let docClient;
if (REGION && RECORDINGS_ANALYSIS_TABLE_NAME) {
    try {
        const ddbClient = new DynamoDBClient({ region: REGION });
        docClient = DynamoDBDocumentClient.from(ddbClient);
        console.log(`DynamoDB client initialized successfully for region: ${REGION} in /api/recordings/[recordingId]/query-analysis.js`);
    } catch (error) {
        console.error("Failed to initialize DynamoDB client in /api/recordings/[recordingId]/query-analysis.js:", error);
    }
} else {
    console.error("DynamoDB Document Client not initialized in /api/recordings/[recordingId]/query-analysis.js due to missing env vars.");
}

/**
 * Helper to get the latest analysis item for a given recordingId that is 'completed' or 'analyzed'.
 * @param {DynamoDBDocumentClient} client - The DynamoDB Document Client instance.
 * @param {string} recId - The recordingId to query for.
 * @returns {Promise<object|null>} The latest completed/analyzed item or null.
 */
async function getLatestCompletedAnalysisItem(client, recId) {
    if (!client || !RECORDINGS_ANALYSIS_TABLE_NAME) return null;
    const params = {
        TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
        KeyConditionExpression: "recordingId = :rid",
        // Filter for completed or analyzed status
        FilterExpression: "analysisStatus = :statusCompleted OR analysisStatus = :statusAnalyzed",
        ExpressionAttributeValues: {
            ":rid": recId,
            ":statusCompleted": "completed",
            ":statusAnalyzed": "analyzed" // If you use a distinct "analyzed" status
        },
        ScanIndexForward: false, // Sort by 'createdAt' (range key) descending
        Limit: 1
    };
    try {
        const { Items } = await client.send(new QueryCommand(params));
        return (Items && Items.length > 0) ? Items[0] : null;
    } catch (error) {
        console.error(`Error querying latest completed analysis for ${recId}:`, error);
        throw error;
    }
}


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }
    
    if (!docClient || !RECORDINGS_ANALYSIS_TABLE_NAME || !SALES_QNA_API_GATEWAY_ENDPOINT || !CLIENT_QNA_API_GATEWAY_ENDPOINT) {
        return res.status(500).json({ success: false, message: "Server Q&A system not configured." });
    }

    const { recordingId } = req.query;
    const { question } = req.body;

    if (!question || question.trim() === "") {
        return res.status(400).json({ success: false, message: 'A non-empty question is required.' });
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
        // 1. Fetch the LATEST COMPLETED analysisData from DynamoDB
        const latestCompletedAnalysis = await getLatestCompletedAnalysisItem(docClient, recordingId);

        if (!latestCompletedAnalysis || !latestCompletedAnalysis.analysisData || !latestCompletedAnalysis.analysisData.transcript) {
            return res.status(404).json({ success: false, message: 'Completed transcript context not found for Q&A for this recording.' });
        }
        // Note: analysisStatus check is already part of getLatestCompletedAnalysisItem

        const transcriptContext = latestCompletedAnalysis.analysisData.transcript;
        let queryAgentIdentifier = null;
        let additionalContextForAgent = {}; 
        let targetApiGatewayEndpoint;

        // Determine Q&A agent and context based on user role
        if (role === 'salesperson' && latestCompletedAnalysis.analysisData.salespersonAnalysis) {
            queryAgentIdentifier = latestCompletedAnalysis.analysisData.salespersonAnalysis.queryAgentIdentifier;
            additionalContextForAgent = { 
                summary: latestCompletedAnalysis.analysisData.salespersonAnalysis.tailoredSummary, 
                keyPoints: latestCompletedAnalysis.analysisData.salespersonAnalysis.keyPoints 
            };
            targetApiGatewayEndpoint = SALES_QNA_API_GATEWAY_ENDPOINT;
        } else if (role === 'client' && latestCompletedAnalysis.analysisData.clientAnalysis) {
            queryAgentIdentifier = latestCompletedAnalysis.analysisData.clientAnalysis.queryAgentIdentifier;
            additionalContextForAgent = { 
                summary: latestCompletedAnalysis.analysisData.clientAnalysis.tailoredSummary, 
                keyDecisions: latestCompletedAnalysis.analysisData.clientAnalysis.keyDecisionsAndCommitments 
            };
            targetApiGatewayEndpoint = CLIENT_QNA_API_GATEWAY_ENDPOINT;
        } else {
            // Fallback or general agent if role-specific analysis section is missing
            console.warn(`Q&A: Role-specific analysis section not found for role "${role}" on recording "${recordingId}". Using general context if available or failing.`);
            // You might define a default agent or context here, or return an error.
            // For now, let's assume it requires the specific section.
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
            userId: userIdForLog, // For logging/auditing in the Q&A Lambda
            analysisCreatedAt: latestCompletedAnalysis.createdAt // Pass the timestamp of the context used
        };
        
        const fetchOptions = {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(API_GATEWAY_KEY && { 'x-api-key': API_GATEWAY_KEY }),
                // Forward original auth if Q&A lambda needs user context beyond userIdForLog
                // ...(req.headers.authorization && { 'Authorization': req.headers.authorization }) 
            },
            body: JSON.stringify(apiGwPayload)
        };

        console.log(`API: Calling Q&A Agent at ${targetApiGatewayEndpoint} for recording ${recordingId}, role ${role}, analysis context from ${latestCompletedAnalysis.createdAt}`);
        const apiGwResponse = await fetch(targetApiGatewayEndpoint, fetchOptions);
        
        const responseBodyText = await apiGwResponse.text(); // Read as text first for better error diagnosis
        let qnaResult;
        try {
            qnaResult = JSON.parse(responseBodyText);
        } catch(e) {
            console.error("Failed to parse Q&A API Gateway response as JSON:", responseBodyText, "Status:", apiGwResponse.status);
            throw new Error(`Invalid response from Q&A service. Status: ${apiGwResponse.status}. Response: ${responseBodyText.substring(0,200)}...`);
        }

        if (!apiGwResponse.ok || !qnaResult.success || typeof qnaResult.answer === 'undefined') {
            console.error("Q&A API Gateway Error Data:", qnaResult);
            throw new Error(qnaResult.message || `Q&A Agent API Gateway error: ${apiGwResponse.status}`);
        }

        // 3. Store Q&A pair in DynamoDB (Append to list in the specific analysis item used)
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
            Key: { 
                recordingId: recordingId, 
                createdAt: latestCompletedAnalysis.createdAt // IMPORTANT: Update the specific analysis item version
            },
            UpdateExpression: "SET #ad.#ih = list_append(if_not_exists(#ad.#ih, :empty_list), :qnaEntryVal), #ad.#ua = :now",
            ExpressionAttributeNames: { 
                "#ad": "analysisData",
                "#ih": "interactiveQnAHistory",
                "#ua": "updatedAt" // Track when Q&A history was last updated
            },
            ExpressionAttributeValues: { 
                ":qnaEntryVal": [qnaEntry],
                ":empty_list": [],
                ":now": new Date().toISOString()
            }
        };
        await docClient.send(new UpdateCommand(updateQnAParams));
        
        console.log(`API: Q&A for ${recordingId} (Role: ${role}, Analysis: ${latestCompletedAnalysis.createdAt}) processed and logged. Question: "${question}"`);
        res.status(200).json({ success: true, answer: qnaResult.answer });

    } catch (error) {
        console.error(`API Error querying analysis for recording ${recordingId}:`, error);
        res.status(500).json({ success: false, message: 'Failed to query analysis.', errorDetails: error.message });
    }
}