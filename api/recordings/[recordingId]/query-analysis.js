// File: /api/recordings/[recordingId]/query-analysis.js
// Handles POST /api/recordings/:recordingId/query-analysis
// Fetches LATEST COMPLETED analysis context, proxies Q&A, stores history.
// Admins now use the salesperson's Q&A context/agent.

import { authenticateTokenOrClientAccess } from '../../utils/auth.js'; 
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const RECORDINGS_ANALYSIS_TABLE_NAME = process.env.RECORDINGS_ANALYSIS_TABLE_NAME;
const REGION = process.env.MY_AWS_REGION; 
const SALES_QNA_API_GATEWAY_ENDPOINT = process.env.SALES_QNA_API_GATEWAY_ENDPOINT;
const CLIENT_QNA_API_GATEWAY_ENDPOINT = process.env.CLIENT_QNA_API_GATEWAY_ENDPOINT;
const API_GATEWAY_KEY = process.env.API_GATEWAY_KEY; 

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
        // console.log(`DynamoDB client initialized successfully for region: ${REGION} in /api/recordings/[recordingId]/query-analysis.js`);
    } catch (error) {
        console.error("Failed to initialize DynamoDB client in /api/recordings/[recordingId]/query-analysis.js:", error);
    }
} else {
    console.error("DynamoDB Document Client not initialized in /api/recordings/[recordingId]/query-analysis.js due to missing env vars.");
}

/**
 * Helper to get the latest analysis item for a given recordingId that is 'completed' or 'analyzed'.
 */
async function getLatestCompletedAnalysisItem(client, recId) {
    if (!client || !RECORDINGS_ANALYSIS_TABLE_NAME) {
        console.error("getLatestCompletedAnalysisItem: Client or table name not configured.");
        return null;
    }
    const params = {
        TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
        KeyConditionExpression: "recordingId = :rid",
        FilterExpression: "analysisStatus = :statusCompleted OR analysisStatus = :statusAnalyzed",
        ExpressionAttributeValues: {
            ":rid": recId,
            ":statusCompleted": "completed",
            ":statusAnalyzed": "analyzed" 
        },
        ScanIndexForward: false, 
        Limit: 1
    };
    try {
        const { Items } = await client.send(new QueryCommand(params));
        return (Items && Items.length > 0) ? Items[0] : null;
    } catch (error) {
        console.error(`Error querying latest completed analysis for ${recId} (Q&A):`, error);
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
    const userEmailForLog = authResult.user ? authResult.user.email : 'client_session';


    try {
        const latestCompletedAnalysis = await getLatestCompletedAnalysisItem(docClient, recordingId);

        if (!latestCompletedAnalysis || !latestCompletedAnalysis.analysisData || !latestCompletedAnalysis.analysisData.transcript) {
            return res.status(404).json({ success: false, message: 'Completed transcript context not found for Q&A for this recording.' });
        }

        const transcriptContext = latestCompletedAnalysis.analysisData.transcript;
        let queryAgentIdentifier = null;
        let additionalContextForAgent = {}; 
        let targetApiGatewayEndpoint;
        let effectiveRoleForQnA = role; // The role context to use for Q&A

        if (role === 'admin') {
            console.log(`API [query-analysis.js]: Admin user ("${userEmailForLog}") detected. Using salesperson Q&A context for recording ${recordingId}.`);
            effectiveRoleForQnA = 'salesperson'; // Admin will use salesperson's Q&A setup
        }

        if (effectiveRoleForQnA === 'salesperson' && latestCompletedAnalysis.analysisData.salespersonAnalysis) {
            queryAgentIdentifier = latestCompletedAnalysis.analysisData.salespersonAnalysis.queryAgentIdentifier;
            additionalContextForAgent = { 
                summary: latestCompletedAnalysis.analysisData.salespersonAnalysis.tailoredSummary, 
                keyPoints: latestCompletedAnalysis.analysisData.salespersonAnalysis.keyPoints 
            };
            targetApiGatewayEndpoint = SALES_QNA_API_GATEWAY_ENDPOINT;
        } else if (effectiveRoleForQnA === 'client' && latestCompletedAnalysis.analysisData.clientAnalysis) {
            queryAgentIdentifier = latestCompletedAnalysis.analysisData.clientAnalysis.queryAgentIdentifier;
            additionalContextForAgent = { 
                summary: latestCompletedAnalysis.analysisData.clientAnalysis.tailoredSummary, 
                keyDecisions: latestCompletedAnalysis.analysisData.clientAnalysis.keyDecisionsAndCommitments 
            };
            targetApiGatewayEndpoint = CLIENT_QNA_API_GATEWAY_ENDPOINT;
        } else {
            console.warn(`Q&A: Appropriate analysis section not found for effective role "${effectiveRoleForQnA}" (actual role: "${role}") on recording "${recordingId}".`);
            return res.status(400).json({ success: false, message: "Q&A agent not configured for your role or this recording's current analysis state." });
        }
        
        if (!queryAgentIdentifier || !targetApiGatewayEndpoint) {
             console.error(`Configuration error: Query agent identifier or target endpoint missing for effective role ${effectiveRoleForQnA}, recording ${recordingId}`);
             return res.status(500).json({ success: false, message: "Internal server error: Q&A agent configuration missing." });
        }

        const apiGwPayload = {
            question,
            transcriptContext,
            additionalRoleContext: additionalContextForAgent,
            agentIdentifier: queryAgentIdentifier, 
            recordingId, 
            userId: userIdForLog, 
            analysisCreatedAt: latestCompletedAnalysis.createdAt 
        };
        
        const fetchOptions = { /* ... as before ... */ };
        fetchOptions.method = 'POST';
        fetchOptions.headers = { 
            'Content-Type': 'application/json',
            ...(API_GATEWAY_KEY && { 'x-api-key': API_GATEWAY_KEY }),
        };
        fetchOptions.body = JSON.stringify(apiGwPayload);

        console.log(`API: Calling Q&A Agent at ${targetApiGatewayEndpoint} for recording ${recordingId}, actual role ${role} (using ${effectiveRoleForQnA} context), analysis from ${latestCompletedAnalysis.createdAt}`);
        const apiGwResponse = await fetch(targetApiGatewayEndpoint, fetchOptions);
        
        const responseBodyText = await apiGwResponse.text(); 
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

        const qnaEntry = { 
            timestamp: new Date().toISOString(), 
            roleOfQuerier: role, // Log the actual role of the admin/user
            userId: userIdForLog, 
            question, 
            answerFromAgent: qnaResult.answer, 
            agentUsed: queryAgentIdentifier,
            contextRoleUsed: effectiveRoleForQnA // Log which role's context was used
        };
        
        const updateQnAParams = {
            TableName: RECORDINGS_ANALYSIS_TABLE_NAME,
            Key: { 
                recordingId: recordingId, 
                createdAt: latestCompletedAnalysis.createdAt 
            },
            UpdateExpression: "SET #ad.#ih = list_append(if_not_exists(#ad.#ih, :empty_list), :qnaEntryVal), #ad.#ua = :now",
            ExpressionAttributeNames: { 
                "#ad": "analysisData",
                "#ih": "interactiveQnAHistory",
                "#ua": "qnaLastUpdatedAt" // More specific updatedAt for Q&A history
            },
            ExpressionAttributeValues: { 
                ":qnaEntryVal": [qnaEntry],
                ":empty_list": [],
                ":now": new Date().toISOString()
            }
        };
        await docClient.send(new UpdateCommand(updateQnAParams));
        
        console.log(`API: Q&A for ${recordingId} (Role: ${role}, Analysis: ${latestCompletedAnalysis.createdAt}) processed and logged.`);
        res.status(200).json({ success: true, answer: qnaResult.answer });

    } catch (error) {
        console.error(`API Error querying analysis for recording ${recordingId}, role ${role}:`, error);
        res.status(500).json({ success: false, message: 'Failed to query analysis.', errorDetails: error.message });
    }
}
