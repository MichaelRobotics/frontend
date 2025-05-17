# frontend

# Meeting Analysis App

A web application for analyzing meetings with different user roles including salesperson, recorder, and client views.

## Repository Structure

This repository is structured for easy deployment with Vercel:

```
/my-meeting-analysis-app/   (Your root project folder)
├── landing-page.html           # The main public landing page
├── app-main-dashboard.html     # Dashboard for authenticated users to select roles
├── salesperson.html            # Dedicated page for the Salesperson view
├── recorder.html               # Dedicated page for the Recorder view
├── client.html                 # Dedicated page for the Client view
│
├── css/                        # Folder for all your CSS files
│   └── main-app-styles.css     # Shared styles for app-main-dashboard, salesperson, recorder, client
│   └── (optional) landing-page-styles.css # If you decide to separate landing page specific styles
│
├── js/                         # Folder for all your JavaScript files
│   └── shared-app-logic.js     # Core shared logic, data management, global notifications
│   └── salesperson-view.js     # Logic for salesperson.html
│   └── recorder-view.js        # Logic for recorder.html
│   └── client-view.js          # Logic for client.html
│   └── (optional) landing-page-script.js # If you extract the script from landing-page.html
│
├── assets/                     # Optional: For any local images, custom fonts, etc.
│   └── images/
│       └── logo.svg            # Example if you host your logo locally
│   └── fonts/
│
├── .gitignore                  # To exclude files like node_modules, .env, etc. (if you add a build step later)
├── README.md                   # Project description, setup, and deployment notes
└── (optional) vercel.json      # For advanced Vercel configurations (usually not needed for this setup)
```

## Structure Explanation

### Root Directory (`/my-meeting-analysis-app/`)
Contains all top-level HTML files which serve as entry points for Vercel:
- `landing-page.html`: The main public landing page
- `app-main-dashboard.html`: Dashboard for authenticated users to select roles
- `salesperson.html`: Dedicated page for the Salesperson view
- `recorder.html`: Dedicated page for the Recorder view
- `client.html`: Dedicated page for the Client view

### CSS Folder (`/css/`)
- `main-app-styles.css`: Contains styles used by app-main-dashboard.html, salesperson.html, recorder.html, and client.html, including theming variables, common component styles (buttons, glass effect, modals), and animations.
- `landing-page-styles.css` (Optional): For landing page specific styles if they differ significantly from the main app.

### JavaScript Folder (`/js/`)
- `shared-app-logic.js`: Contains the SharedAppLogic IIFE for loading/saving meeting data to localStorage, global notifications, and utility functions shared across app pages.
- `salesperson-view.js`: Contains the SalespersonView IIFE.
- `recorder-view.js`: Contains the RecorderView IIFE.
- `client-view.js`: Contains the ClientView IIFE.
- `landing-page-script.js` (Optional): For any landing page specific scripts.

### Assets Folder (`/assets/`) (Optional)
For any local assets such as:
- Images (like logos)
- Custom font files
- Other static assets

### Other Files
- `.gitignore`: Excludes unnecessary files from version control.
- `README.md`: This documentation file.
- `vercel.json` (Optional): For advanced Vercel configurations (typically not needed for this setup).

## Deployment with Vercel

### How Vercel Works with This Structure

When you connect your GitHub repository to Vercel:

1. Select the root directory as the project root
2. Vercel will identify it as a static site
3. It will deploy all HTML, CSS, JS, and asset files
4. `landing-page.html` will typically be the default page served at your main Vercel domain (e.g., your-app.vercel.app)
5. Other pages will be directly accessible at their paths (e.g., your-app.vercel.app/salesperson.html)
6. All relative paths in your HTML files will work correctly since the directory structure is preserved

### Vercel Configuration

For this simple static site structure, Vercel's default settings will likely work perfectly without any additional configuration. The optional `vercel.json` file would only be needed if you require:

- Custom build commands
- Redirects
- Headers
- Environment variables
- Other advanced configurations

## Local Development

To run this project locally:

1. Clone the repository
2. Open any of the HTML files in your browser
3. No build step is required for this static site

## Notes

This structure is intentionally clean, standard, and well-suited for Vercel deployment of a static site. If the project grows to require build tools (like for minifying JS/CSS or using a framework), the structure can be adapted accordingly.

# Meeting Analysis System

This project is an AI-powered meeting analysis system with distinct interfaces for Salespeople, Recorders, and Clients.

## Project Structure

-   **`/` (root):** Contains HTML pages for the frontend application.
-   **`/css`:** Shared CSS files.
-   **`/js`:** Shared and view-specific frontend JavaScript modules.
-   **`/api`:** Vercel Serverless Functions for the backend API.
    -   **`/api/utils`:** Shared utilities for backend functions.
    -   **`/api/auth`:** Authentication related endpoints.
    -   **`/api/meetings`:** Endpoints for managing meeting schedules.
    -   **`/api/recordings`:** Endpoints for handling recordings and their analysis.
    -   **`/api/client`:** Endpoint for client access validation.

## Frontend

Built with HTML, CSS (Tailwind CSS utility classes), and vanilla JavaScript. The application is structured as a multi-page application (MPA).

## Backend

Implemented as Vercel Serverless Functions (Node.js runtime). It interacts with AWS services:
-   **DynamoDB:** For data storage (users, meetings, analysis data).
-   **S3:** For storing audio recordings (handled by an AWS Lambda via API Gateway).
-   **AWS Lambda & API Gateway:** For processing-intensive tasks like audio intake/S3 upload, AI analysis, Q&A with LLMs, and PDF generation. Vercel functions act as proxies to these API Gateway endpoints.

## Deployment

Deployed on Vercel. Environment variables must be configured for AWS credentials, database table names, API Gateway endpoint URLs, and JWT secrets.

## Setup (Conceptual)

1.  Clone the repository.
2.  Set up AWS resources (DynamoDB tables, S3 bucket, Lambda functions, API Gateway endpoints).
3.  Configure Vercel Environment Variables in the Vercel project settings.
4.  Install backend dependencies: `npm install` or `yarn install` in the project root (if `package.json` is at the root and Vercel builds from there).
5.  Deploy to Vercel: `vercel` or `vercel --prod`.

## Key Environment Variables (To be set in Vercel)

-   `MY_AWS_ACCESS_KEY_ID`
-   `MY_AWS_SECRET_ACCESS_KEY`
-   `MY_AWS_REGION`
-   `JWT_SECRET`
-   `USERS_TABLE_NAME`
-   `MEETINGS_TABLE_NAME`
-   `RECORDINGS_ANALYSIS_TABLE_NAME`
-   `S3_AUDIO_UPLOAD_BUCKET` (Used by your Audio Intake Lambda)
-   `API_GATEWAY_AUDIO_INTAKE_ENDPOINT`
-   `SALES_QNA_API_GATEWAY_ENDPOINT`
-   `CLIENT_QNA_API_GATEWAY_ENDPOINT`
-   `PDF_API_GATEWAY_ENDPOINT`
-   `API_GATEWAY_KEY` (Optional)

{
  "name": "meeting-analysis-backend",
  "version": "1.0.0",
  "private": true,
  "description": "Backend API for Meeting Analysis System",
  "scripts": {
    "dev": "vercel dev",
    "deploy": "vercel --prod"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.577.0",
    "@aws-sdk/lib-dynamodb": "^3.577.0",
    "@aws-sdk/client-s3": "^3.577.0",  // If Vercel functions were to upload to S3 directly
    "@aws-sdk/client-lambda": "^3.577.0", // If Vercel functions were to invoke Lambda directly
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^9.0.1",
    "node-fetch": "^2.6.7", // For Node.js < 18 if making HTTP calls from Vercel to API Gateway
    "formidable-serverless": "^1.1.1" // If Vercel func needs to parse multipart before proxying
    // Or use "formidable" v3+ for modern Node.js
  },
  "engines": {
    "node": ">=18.x" // Specify Node.js version for Vercel
  }
}
