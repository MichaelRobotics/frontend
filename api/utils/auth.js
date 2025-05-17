// File: /api/utils/auth.js
// Handles JWT verification for protected API routes.

import jwt from 'jsonwebtoken'; // npm install jsonwebtoken

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verifies the JWT token from the request's Authorization header.
 * @param {object} req - The Vercel request object.
 * @returns {{authenticated: boolean, user?: object, message?: string, status?: number}}
 * - user object contains the decoded JWT payload if authentication is successful.
 */
export function authenticateToken(req) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects "Bearer TOKEN_STRING"

    if (!token) {
        return { authenticated: false, status: 401, message: 'Access token is missing or invalid.' };
    }

    if (!JWT_SECRET) {
        console.error("CRITICAL_AUTH_ERROR: JWT_SECRET environment variable is not defined.");
        return { authenticated: false, status: 500, message: 'Authentication system configuration error.' };
    }

    try {
        const decodedPayload = jwt.verify(token, JWT_SECRET);
        // decodedPayload should contain { userId, email, name, role, iat, exp }
        return { authenticated: true, user: decodedPayload };
    } catch (err) {
        console.warn("JWT Verification Error:", err.message);
        if (err.name === 'TokenExpiredError') {
            return { authenticated: false, status: 401, message: 'Access token has expired.' };
        }
        return { authenticated: false, status: 403, message: 'Access token is not valid.' };
    }
}

/**
 * Authenticates a request that could be from a logged-in user (via JWT)
 * or a client with temporary validated access to a specific recording.
 * The client-specific part needs a robust mechanism (e.g., short-lived scoped tokens).
 * @param {object} req - The Vercel request object.
 * @param {string} recordingIdForClientValidation - The recordingId the client is trying to access.
 * @returns {Promise<{granted: boolean, role?: string, user?: object, message?: string, status?: number}>}
 */
export async function authenticateTokenOrClientAccess(req, recordingIdForClientValidation) {
    const authResult = authenticateToken(req); // Try standard JWT auth first
    if (authResult.authenticated) {
        // TODO: Implement granular authorization if needed:
        // Check if authResult.user (e.g., authResult.user.userId) has specific permission
        // to access 'recordingIdForClientValidation'. This might involve checking
        // ownership (e.g., uploaderUserId on the recording) or shared access rules in DynamoDB.
        // For now, if token is valid, we assume they have role-based access for the endpoint's purpose.
        console.log(`User authenticated via JWT: ${authResult.user.email}, Role: ${authResult.user.role}`);
        return { granted: true, role: authResult.user.role || 'user', user: authResult.user };
    }

    // Placeholder for Client-Specific Access Token Validation
    // In a real application, after POST /api/client/validate-access, the client would receive
    // a short-lived, scoped token. They would send this token in a header for subsequent requests.
    // This function would then validate that client-specific token.
    const clientSpecificAccessToken = req.headers['x-client-recording-access-token']; // Example header
    if (clientSpecificAccessToken) {
        // TODO: Implement robust validation for clientSpecificAccessToken.
        // This might involve:
        // 1. Decoding/verifying this token (it could be another JWT or an opaque token).
        // 2. Checking it against a temporary store (e.g., Redis, or DynamoDB with TTL)
        //    to ensure it's valid, not expired, and scoped to 'recordingIdForClientValidation'.
        // For this example, we'll use a simple simulated check based on a header.
        // This SIMULATED check is NOT secure for production.
        if (req.headers['x-client-validated-for-recording'] === recordingIdForClientValidation) {
            console.log(`Simulated client access granted for recording: ${recordingIdForClientValidation} via x-client-validated-for-recording header.`);
            return { granted: true, role: "client" }; // No full 'user' object for client here
        }
    }
    
    console.log(`Access Denied for recording ${recordingIdForClientValidation}: No valid user token or client access validation found.`);
    return { granted: false, message: "Access Denied. Valid authentication or client session required.", status: 401 };
}
