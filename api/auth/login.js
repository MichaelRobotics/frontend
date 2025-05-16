// File: /api/auth/login.js
// Handles POST /api/auth/login

// --- Dependencies (Install these via npm/yarn if you use them) ---
// const bcrypt = require('bcryptjs'); // For comparing hashed passwords
// const jwt = require('jsonwebtoken'); // For generating JWTs
// const AWS = require('aws-sdk'); // If using AWS SDK for Cognito or custom auth with DynamoDB

// --- AWS SDK Configuration (Set credentials and region via Vercel Environment Variables) ---
// AWS.config.update({
//   accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
//   region: process.env.MY_AWS_REGION
// });
// const dynamoDb = new AWS.DynamoDB.DocumentClient();
// const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME; // e.g., 'MeetingAppUsers'
// const JWT_SECRET = process.env.JWT_SECRET; // A strong secret for signing JWTs, store in Vercel Env Vars

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

        // --- PRODUCTION: Implement Database Interaction (e.g., DynamoDB) ---
        /*
        const params = {
            TableName: USERS_TABLE_NAME,
            Key: {
                email: email.toLowerCase(), // Assuming email is the primary key and stored lowercase
            },
        };
        const { Item: user } = await dynamoDb.get(params).promise();

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        // Compare hashed password
        // const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
        // if (!isPasswordValid) {
        //     return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        // }

        // Passwords match, generate JWT token
        const tokenPayload = {
            userId: user.id, // Assuming user object has an 'id'
            email: user.email,
            name: user.name, 
            role: user.role || 'salesperson', // Default role or from DB
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour

        res.status(200).json({
            success: true,
            message: "Login successful",
            token: token,
            user: { // Send back some user info for the frontend
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role || 'salesperson'
            }
        });
        */

        // --- SIMULATED SUCCESSFUL LOGIN (for development without DB) ---
        console.log(`Login attempt for: ${email}`);
        if (email.toLowerCase() === "test@example.com" && password === "password123") {
            const simulatedUser = { 
                id: 'user-sim-123', 
                name: 'Test User', 
                email: email.toLowerCase(), 
                role: 'salesperson' // Example role
            };
            // In a real scenario, JWT_SECRET should be a strong, environment-variable-stored secret
            const simulatedToken = "simulated_jwt_token_for_" + email.toLowerCase(); // Replace with actual jwt.sign in production

            res.status(200).json({
                success: true,
                message: "Login successful (simulated)",
                token: simulatedToken,
                user: simulatedUser
            });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid credentials (simulated).' });
        }
        // --- END SIMULATED LOGIN ---

    } catch (error) {
        console.error('Login API error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during login.', errorDetails: error.message });
    }
}