// File: /api/auth/register.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME;
const JWT_SECRET = process.env.JWT_SECRET;
const REGION = process.env.AWS_REGION; // Use Vercel's standard AWS_REGION

if (!USERS_TABLE_NAME || !JWT_SECRET || !REGION) {
    console.error("FATAL_ERROR: Missing critical environment variables for /api/auth/register. Ensure USERS_TABLE_NAME, JWT_SECRET, and AWS_REGION are set in Vercel.");
    // This function might still be invoked by Vercel, so handle gracefully in handler.
}

let docClient;
try {
    if (REGION && USERS_TABLE_NAME && JWT_SECRET) { // Check all critical vars for this function
        const ddbClient = new DynamoDBClient({ region: REGION }); // SDK picks up AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from env
        docClient = DynamoDBDocumentClient.from(ddbClient);
    } else {
        console.error("DynamoDB Document Client or JWT_SECRET not initialized in /api/auth/register due to missing environment variables.");
    }
} catch(e) {
    console.error("Error initializing AWS SDK client in /api/auth/register:", e);
}


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }
    
    if (!docClient || !USERS_TABLE_NAME || !JWT_SECRET) { // Re-check for safety
        return res.status(500).json({ success: false, message: "Server authentication system not configured due to missing environment variables." });
    }

    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }
        if (!/\S+@\S+\.\S+/.test(email)) { 
            return res.status(400).json({ success: false, message: 'Invalid email format.' });
        }
        if (password.length < 8) { 
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
        }
        
        const lowerCaseEmail = email.toLowerCase().trim();

        const checkUserParams = {
            TableName: USERS_TABLE_NAME,
            Key: { email: lowerCaseEmail }, 
        };
        const { Item: existingUser } = await docClient.send(new GetCommand(checkUserParams));

        if (existingUser) {
            return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
        }

        const saltRounds = 12; 
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const userId = uuidv4(); 
        const newUser = {
            userId: userId, 
            email: lowerCaseEmail, 
            hashedPassword,
            name: name ? name.trim() : lowerCaseEmail.split('@')[0], 
            role: 'salesperson', 
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const putUserParams = {
            TableName: USERS_TABLE_NAME,
            Item: newUser,
            ConditionExpression: "attribute_not_exists(email)" 
        };
        try {
            await docClient.send(new PutCommand(putUserParams));
        } catch (dbError) {
            if (dbError.name === 'ConditionalCheckFailedException') {
                 return res.status(409).json({ success: false, message: 'User with this email already exists (concurrent registration).' });
            }
            console.error("DynamoDB Put Error:", dbError);
            throw dbError; 
        }
        
        const tokenPayload = { userId: newUser.userId, email: newUser.email, name: newUser.name, role: newUser.role };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });

        console.log(`API: User ${newUser.email} registered successfully with ID ${newUser.userId}.`);
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token: token,
            user: { id: newUser.userId, name: newUser.name, email: newUser.email, role: newUser.role }
        });

    } catch (error) {
        console.error('API Registration error:', error);
        // Check if it's an SDK client initialization error
        if (error.message.includes("DynamoDBClient") || error.message.includes("credentials")) {
             return res.status(500).json({ success: false, message: 'Server configuration error related to AWS credentials or region.' });
        }
        res.status(500).json({ success: false, message: 'An internal server error occurred during registration.' });
    }
}
