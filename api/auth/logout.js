// File: /api/auth/logout.js
// Handles POST /api/auth/logout
// With stateless JWTs, server-side action is minimal beyond acknowledging.
// Client is responsible for clearing the token.

// import { authenticateToken } from '../../utils/auth'; // Still good to ensure a valid token is being "logged out" if you want to log the action

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    // Optional: You can still validate the token here if you want to log which user initiated logout,
    // but it's not strictly necessary for the logout process itself if you're not blacklisting.
    // const authResult = authenticateToken(req);
    // if (authResult.authenticated && authResult.user) {
    //     console.log(`API: Logout initiated by user: ${authResult.user.email}`);
    // } else {
    //     console.log("API: Logout attempt with invalid or missing token.");
    // }

    // For stateless JWTs, the server doesn't need to do much.
    // The client will discard the JWT.
    // If you had a refresh token mechanism, you might invalidate the refresh token here.
    
    console.log("API: POST /api/auth/logout called. Client should clear its token.");
    res.status(200).json({ success: true, message: "Logout processed. Please clear client-side token." });
}
