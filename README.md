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
