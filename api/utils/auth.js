// File: /api/utils/auth.js
// Handles JWT verification for protected API routes.

import jwt from 'jsonwebtoken'; // npm install jsonwebtoken

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verifies the JWT token from the request's Authorization header.
 * @param {object} req - The Vercel request object.
 * @returns {{authenticated: boolean, user?: object, message?: string, status?: number}}
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
 */
export async function authenticateTokenOrClientAccess(req, recordingIdForClientValidation) {
    const authResult = authenticateToken(req); 
    if (authResult.authenticated) {
        // TODO: Implement granular authorization: check if authResult.user has permission
        // to access 'recordingIdForClientValidation'.
        console.log(`User authenticated via JWT: ${authResult.user.email}, Role: ${authResult.user.role}`);
        return { granted: true, role: authResult.user.role || 'user', user: authResult.user };
    }

    // Placeholder for Client-Specific Access Token Validation
    // This requires a robust mechanism, e.g., short-lived scoped tokens.
    const clientSpecificAccessToken = req.headers['x-client-recording-access-token']; 
    if (clientSpecificAccessToken) {
        // TODO: Implement robust validation for clientSpecificAccessToken against a store or verification method,
        // ensuring it's valid, not expired, and scoped to 'recordingIdForClientValidation'.
        // For DEMONSTRATION ONLY, using a less secure header check:
        if (req.headers['x-client-validated-for-recording'] === recordingIdForClientValidation) {
            console.log(`Simulated client access granted for recording: ${recordingIdForClientValidation} via x-client-validated-for-recording header.`);
            return { granted: true, role: "client" }; 
        }
    }
    
    console.log(`Access Denied for recording ${recordingIdForClientValidation}: No valid user token or client access validation found.`);
    return { granted: false, message: "Access Denied. Valid authentication or client session required.", status: 401 };
}
