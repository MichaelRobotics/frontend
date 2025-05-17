// File: /api/auth/me.js
// Handles GET /api/auth/me - To verify token and get current user details

// Assuming your utility file is in /api/utils/auth.js
// Adjust the path if your project structure is different.
import { authenticateToken } from '../utils/auth.js'; 
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME;
const REGION = process.env.AWS_REGION;

// Environment variable check at module load time
if (!USERS_TABLE_NAME || !REGION || !process.env.JWT_SECRET) {
    console.error("FATAL_ERROR: Missing critical environment variables for /api/auth/me:", {
        USERS_TABLE_NAME: !!USERS_TABLE_NAME,
        REGION: !!REGION,
        JWT_SECRET: !!process.env.JWT_SECRET
    });
}

let ddbClient, docClient;
try {
    if (REGION && USERS_TABLE_NAME) {
        ddbClient = new DynamoDBClient({ region: REGION });
        docClient = DynamoDBDocumentClient.from(ddbClient);
    } else {
        console.error("DynamoDB client not initialized due to missing environment variables");
    }
} catch (error) {
    console.error("Error initializing DynamoDB client:", error);
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    // Re-check environment variables in handler
    if (!USERS_TABLE_NAME || !REGION || !process.env.JWT_SECRET) {
        console.error("Missing environment variables in handler:", {
            USERS_TABLE_NAME: !!USERS_TABLE_NAME,
            REGION: !!REGION,
            JWT_SECRET: !!process.env.JWT_SECRET
        });
        return res.status(500).json({ 
            success: false, 
            message: "Server authentication system configuration error.",
            details: "Missing required environment variables"
        });
    }

    if (!docClient) {
        console.error("DynamoDB client not initialized");
        return res.status(500).json({ 
            success: false, 
            message: "Database connection error",
            details: "DynamoDB client not initialized"
        });
    }

    try {
        const authResult = authenticateToken(req);
        if (!authResult.authenticated) {
            console.warn("Authentication failed:", authResult.message);
            return res.status(authResult.status || 401).json({ 
                success: false, 
                message: authResult.message 
            });
        }
        
        const tokenUser = authResult.user;
        const emailFromToken = tokenUser.email; // Changed from userId to email

        if (!emailFromToken) {
            console.error("API /auth/me error: email not found in decoded token payload");
            return res.status(403).json({ 
                success: false, 
                message: "Invalid token payload: User email missing" 
            });
        }

        // Fetch fresh user details from DB
        const params = {
            TableName: USERS_TABLE_NAME,
            Key: { 
                email: emailFromToken // Changed from userId to email
            },
            ProjectionExpression: "userId, email, #usrName, #usrRole",
            ExpressionAttributeNames: { 
                "#usrName": "name",
                "#usrRole": "role"
            }
        };

        console.log("Fetching user with params:", JSON.stringify(params));
        const { Item: dbUser } = await docClient.send(new GetCommand(params));

        if (!dbUser) {
            console.warn(`API /auth/me: User ${emailFromToken} from token not found in DB`);
            return res.status(404).json({ 
                success: false, 
                message: "User associated with token no longer exists" 
            });
        }

        console.log(`API: GET /api/auth/me successful for user ${dbUser.email}`);
        return res.status(200).json({
            success: true,
            user: { 
                id: dbUser.userId,
                name: dbUser.name,
                email: dbUser.email,
                role: dbUser.role
            }
        });

    } catch (error) {
        console.error('API /auth/me error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error while fetching user details',
            errorDetails: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
