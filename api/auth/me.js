// File: /api/auth/me.js
// Handles GET /api/auth/me - To verify token and get current user details

// Assuming your utility file is in /api/utils/auth.js
// Adjust the path if your project structure is different.
import { authenticateToken } from '/var/task/api/utils/auth.js'; 
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME;
const REGION = process.env.MY_AWS_REGION;

// Environment variable check at module load time (good for early failure detection)
if (!USERS_TABLE_NAME || !REGION || !process.env.JWT_SECRET) { // JWT_SECRET is used by authenticateToken
    console.error("FATAL_ERROR: Missing critical environment variables for /api/auth/me. This function may not operate correctly.");
    // In a real production scenario, this might prevent the function from being deployed
    // or cause it to always return an error if Vercel still tries to run it.
}

const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    // Re-check environment variables in handler for safety, as Vercel might still invoke the function
    if (!USERS_TABLE_NAME || !REGION || !process.env.JWT_SECRET) {
        return res.status(500).json({ success: false, message: "Server authentication system configuration error." });
    }

    const authResult = authenticateToken(req); // Verifies JWT from Authorization header
    if (!authResult.authenticated) {
        return res.status(authResult.status || 401).json({ success: false, message: authResult.message });
    }
    
    // The user object from the decoded token payload
    const tokenUser = authResult.user; 
    const userIdFromToken = tokenUser.userId;

    if (!userIdFromToken) {
        console.error("API /auth/me error: userId not found in decoded token payload.");
        return res.status(403).json({ success: false, message: "Invalid token payload: User identifier missing." });
    }

    try {
        // Fetch fresh user details from DB to ensure the user still exists and their details (like role) are current.
        const params = {
            TableName: USERS_TABLE_NAME,
            Key: { 
                // Assuming your Users table primary key is 'userId'. 
                // If 'email' is the PK, you'd use tokenUser.email and ensure your PK schema matches.
                userId: userIdFromToken 
            },
            // Specify only the attributes you need to return to the client to avoid exposing sensitive data
            ProjectionExpression: "userId, email, #usrName, #usrRole", 
            ExpressionAttributeNames: { 
                "#usrName": "name", // 'name' can be a reserved keyword in DynamoDB
                "#usrRole": "role"  // 'role' can be a reserved keyword
            }
        };
        const { Item: dbUser } = await docClient.send(new GetCommand(params));

        if (!dbUser) {
            // Token might be valid, but user was deleted from DB (edge case).
            // Invalidate client-side token.
            console.warn(`API /auth/me: User ${userIdFromToken} from token not found in DB.`);
            return res.status(404).json({ success: false, message: "User associated with token no longer exists." });
        }

        console.log(`API: GET /api/auth/me successful for user ${dbUser.email}`);
        res.status(200).json({
            success: true,
            user: { 
                id: dbUser.userId, // Consistently use 'id' if frontend expects it, or stick to 'userId'
                name: dbUser.name, 
                email: dbUser.email, 
                role: dbUser.role 
            }
        });

    } catch (error) {
        console.error('API /auth/me error:', error);
        res.status(500).json({ success: false, message: 'Internal server error while fetching user details.', errorDetails: error.message });
    }
}
