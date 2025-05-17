// File: /api/auth/login.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME;
const JWT_SECRET = process.env.JWT_SECRET;
const REGION = process.env.MY_AWS_REGION;

if (!USERS_TABLE_NAME || !JWT_SECRET || !REGION) {
    console.error("FATAL_ERROR: Missing critical environment variables for /api/auth/login.");
    throw new Error("Server authentication system not configured."); // Fail fast at module load
}

const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }
        const lowerCaseEmail = email.toLowerCase().trim();

        const params = {
            TableName: USERS_TABLE_NAME,
            Key: { email: lowerCaseEmail }, 
        };
        
        const { Item: user } = await docClient.send(new GetCommand(params));

        if (!user || !user.hashedPassword) {
            console.warn(`Login attempt failed: User not found or no password hash for ${lowerCaseEmail}`);
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
        if (!isPasswordValid) {
            console.warn(`Login attempt failed: Password mismatch for ${lowerCaseEmail}`);
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const tokenPayload = { 
            userId: user.userId, 
            email: user.email, 
            name: user.name, 
            role: user.role || 'salesperson' 
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' }); 

        console.log(`API: User ${user.email} logged in successfully.`);
        res.status(200).json({
            success: true,
            message: "Login successful",
            token: token,
            user: { 
                id: user.userId, 
                name: user.name, 
                email: user.email, 
                role: user.role || 'salesperson' 
            }
        });

    } catch (error) {
        console.error('API Login error:', error);
        res.status(500).json({ success: false, message: 'An internal server error occurred during login.', errorDetails: error.message });
    }
}
