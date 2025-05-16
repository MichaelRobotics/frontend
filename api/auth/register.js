// File: /api/auth/register.js
// Handles POST /api/auth/register

// --- Dependencies ---
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const AWS = require('aws-sdk');
// const { v4: uuidv4 } = require('uuid'); // For generating unique user IDs

// --- AWS SDK Configuration ---
// AWS.config.update({ /* ... as in login.js ... */ });
// const dynamoDb = new AWS.DynamoDB.DocumentClient();
// const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME;
// const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }
        if (password.length < 6) { // Basic password policy example
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
        }
        // Add more validation for email format, name, etc. as needed

        // --- PRODUCTION: Implement Database Interaction (e.g., DynamoDB) ---
        /*
        const lowerCaseEmail = email.toLowerCase();
        // 1. Check if user already exists
        const checkUserParams = {
            TableName: USERS_TABLE_NAME,
            Key: { email: lowerCaseEmail }, // Assuming email is unique and primary key
        };
        const { Item: existingUser } = await dynamoDb.get(checkUserParams).promise();

        if (existingUser) {
            return res.status(409).json({ success: false, message: 'User with this email already exists.' });
        }

        // 2. Hash the password
        // const salt = await bcrypt.genSalt(10);
        // const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Create new user object
        const userId = uuidv4(); // Generate a unique ID for the user
        const newUser = {
            id: userId,
            email: lowerCaseEmail,
            hashedPassword,
            name: name || lowerCaseEmail.split('@')[0], // Default name from email if not provided
            role: 'salesperson', // Default role, or determine based on registration context
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // 4. Store user in DynamoDB
        const putUserParams = {
            TableName: USERS_TABLE_NAME,
            Item: newUser,
        };
        await dynamoDb.put(putUserParams).promise();

        // 5. Generate JWT token
        const tokenPayload = { userId: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token: token,
            user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
        });
        */

        // --- SIMULATED SUCCESSFUL REGISTRATION ---
        console.log(`Registration attempt for: ${email}`);
        const simulatedUserId = `user-sim-${Date.now()}`;
        const simulatedUser = {
            id: simulatedUserId,
            name: name || email.split('@')[0],
            email: email.toLowerCase(),
            role: 'salesperson' // Default role for demo
        };
        const simulatedToken = "simulated_jwt_token_for_" + email.toLowerCase();

        res.status(201).json({
            success: true,
            message: "User registered successfully (simulated)",
            token: simulatedToken,
            user: simulatedUser
        });
        // --- END SIMULATED REGISTRATION ---

    } catch (error) {
        console.error('Registration API error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during registration.' });
    }
}
