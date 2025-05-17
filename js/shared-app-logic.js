// /js/shared-app-logic.js
const SharedAppLogic = (() => {
    // --- STATE & CONFIG ---
    let meetingsData = []; // Acts as a local cache
    let authToken = localStorage.getItem('authToken'); // Load token on script init
    const USER_STORAGE_KEY = 'meetingAnalysisUser'; // For user object from login/register
    let currentUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY)) || null;

    let notificationTimeout;
    let appNotificationElement, appNotificationMessage, appNotificationIconContainer, appNotificationCloseButton;

    // --- API Base Path (if needed, otherwise relative paths are fine for same-origin) ---
    // const API_BASE_URL = ''; // e.g., https://your-app.vercel.app/api if different, or keep empty

    // --- UTILITY: HTTP Request Helper ---
    async function makeApiRequest(endpoint, method = 'GET', body = null, isFormData = false) {
        const headers = {};
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        if (body && !isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        const config = {
            method,
            headers,
        };

        if (body) {
            config.body = isFormData ? body : JSON.stringify(body);
        }

        try {
            const response = await fetch(`${endpoint}`, config); // API_BASE_URL + endpoint
            if (response.status === 401) { // Unauthorized
                clearAuthToken(); // Clear invalid token
                showGlobalNotification("Session expired or invalid. Please log in again.", "error");
                // Redirect to login after a delay, allowing notification to be seen
                setTimeout(() => {
                    if (window.location.pathname !== '/landing-page.html' && window.location.pathname !== '/') {
                         window.location.href = 'landing-page.html'; // Or just '/' if that's your landing
                    }
                }, 2500);
                throw new Error("Unauthorized");
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `HTTP error! Status: ${response.status}` }));
                throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
            }
            if (response.status === 204) { // No Content
                return null;
            }
            return await response.json();
        } catch (error) {
            console.error(`API request to ${method} ${endpoint} failed:`, error);
            // showGlobalNotification(`API Error: ${error.message}`, "error"); // Already shown for 401
            if (error.message !== "Unauthorized") { // Avoid double notification for 401
                 showGlobalNotification(`Network or API Error: ${error.message || 'Could not connect to server.'}`, "error");
            }
            throw error; // Re-throw for specific view handling if needed
        }
    }


    // --- AUTHENTICATION ---
    async function registerAPI(userData) { // { email, password, name }
        const data = await makeApiRequest('/api/auth/register', 'POST', userData);
        if (data && data.success && data.token) {
            setAuthToken(data.token);
            setCurrentUser(data.user);
        }
        return data;
    }

    async function loginAPI(credentials) { // { email, password }
        const data = await makeApiRequest('/api/auth/login', 'POST', credentials);
        if (data && data.success && data.token) {
            setAuthToken(data.token);
            setCurrentUser(data.user);
        }
        return data;
    }

    async function logoutAPI() {
        try {
            // Call backend logout if it does anything (like token blacklisting)
            // await makeApiRequest('/api/auth/logout', 'POST');
            console.log("Logout API called (simulated if no server-side invalidation).");
        } catch (error) {
            console.warn("Logout API call failed (might be okay if stateless):", error);
        } finally {
            clearAuthToken();
            setCurrentUser(null);
            // Frontend should redirect after this
        }
    }
    
    async function checkSessionAPI() { // Corresponds to GET /api/auth/me
        if (!authToken) return null;
        try {
            const data = await makeApiRequest('/api/auth/me', 'GET');
            if (data && data.user) {
                setCurrentUser(data.user);
                return data.user;
            }
            clearAuthToken(); // Token might be invalid
            return null;
        } catch (error) {
            clearAuthToken();
            return null;
        }
    }

    function setAuthToken(token) {
        authToken = token;
        localStorage.setItem('authToken', token);
    }
    function clearAuthToken() {
        authToken = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem(USER_STORAGE_KEY); // Also clear user object
        currentUser = null;
    }
    function isAuthenticated() {
        return !!authToken; // Basic check, could be enhanced by checkSessionAPI
    }
    function setCurrentUser(userData) {
        currentUser = userData;
        if (userData) {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
        } else {
            localStorage.removeItem(USER_STORAGE_KEY);
        }
    }
    function getCurrentUser() {
        if (!currentUser) {
            currentUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY));
        }
        return currentUser;
    }


    // --- MEETINGS DATA ---
    async function fetchMeetingsAPI() {
        try {
            meetingsData = await makeApiRequest('/api/meetings', 'GET');
            return meetingsData;
        } catch (error) {
            // meetingsData will retain its last successful state or be empty
            return meetingsData; // Return cached or empty on error
        }
    }

    async function createMeetingAPI(meetingDetails) { // { title, date, clientEmail, notes }
        const newMeeting = await makeApiRequest('/api/meetings', 'POST', meetingDetails);
        // No local meetingsData.push(newMeeting) here; fetchMeetingsAPI should be called to get the source of truth
        return newMeeting; // Return the created meeting from backend (which includes IDs)
    }

    async function updateMeetingAPI(meetingId, meetingDetails) {
        const updatedMeeting = await makeApiRequest(`/api/meetings/${meetingId}`, 'PUT', meetingDetails);
        // No local update here; fetchMeetingsAPI should be called
        return updatedMeeting;
    }

    async function deleteMeetingAPI(meetingId) {
        await makeApiRequest(`/api/meetings/${meetingId}`, 'DELETE');
        // No local update here; fetchMeetingsAPI should be called
        return { success: true, meetingId };
    }

    function getMeetings() { // Returns local cache, ensure it's up-to-date by calling fetchMeetingsAPI
        return meetingsData;
    }

    function getMeetingById(id) { // Searches local cache
        return meetingsData.find(m => m.id === id || m.recorderId === id);
    }

    // --- RECORDINGS & ANALYSIS DATA ---
    async function uploadRecordingAPI(recordingId, formData) { // formData includes audioBlob, notes, quality, originalMeetingId
        // The `recordingId` here is the one for the session (from meeting.recordingId or ad-hoc generated)
        return await makeApiRequest(`/api/recordings/${recordingId}/upload`, 'POST', formData, true);
    }

    async function fetchAnalysisStatusAPI(recordingId) {
        return await makeApiRequest(`/api/recordings/${recordingId}/analysis/status`, 'GET');
    }

    async function fetchAnalysisDataAPI(recordingId) {
        // This function will now be called by Salesperson, Recorder, and Client views.
        // The backend endpoint GET /api/recordings/{recordingId}/analysis is responsible
        // for returning role-specific data if needed.
        return await makeApiRequest(`/api/recordings/${recordingId}/analysis`, 'GET');
    }

    async function queryAnalysisAPI(recordingId, question) {
        return await makeApiRequest(`/api/recordings/${recordingId}/query-analysis`, 'POST', { question });
    }

    async function downloadAnalysisPdfAPI(recordingId) {
        // This function will initiate a download by navigating or handling a blob response.
        // The backend endpoint GET /api/recordings/{recordingId}/analysis/pdf streams the PDF.
        try {
            const response = await fetch(`/api/recordings/${recordingId}/analysis/pdf`, {
                method: 'GET',
                headers: getAuthHeader()
            });

            if (!response.ok) {
                if (response.status === 401) throw new Error("Unauthorized to download PDF.");
                const errData = await response.json().catch(() => ({ message: `PDF Download failed: ${response.status}`}));
                throw new Error(errData.message);
            }

            const blob = await response.blob();
            const contentDisposition = response.headers.get('content-disposition');
            let filename = `analysis_report_${recordingId}.pdf`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
                if (filenameMatch && filenameMatch.length === 2)
                    filename = filenameMatch[1];
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showGlobalNotification("PDF download started.", "success");
            return { success: true };
        } catch (error) {
            console.error("Error downloading PDF:", error);
            showGlobalNotification(`PDF Download Error: ${error.message}`, "error");
            throw error;
        }
    }

    // --- CLIENT ACCESS ---
    async function validateClientAccessAPI(meetingId, clientCode) {
        return await makeApiRequest('/api/client/validate-access', 'POST', { meetingId, clientCode });
    }


    // --- UTILITIES (some might be frontend only, some backend generated) ---
    function generateId(length = 8) { // May still be used for frontend temporary IDs if needed
        return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
    }
    function generateRecorderLink(recordingId, recorderCode) { // Backend now generates this primarily
        // Frontend might use this for display if link isn't directly from backend meeting object
        return `recorder.html?recordingId=${recordingId}&recorderCode=${recorderCode}`;
    }
    
    // --- GLOBAL NOTIFICATION (remains mostly the same as in Part 1 of 5-file app) ---
    function initGlobalNotifications() {
        appNotificationElement = document.getElementById('app-notification');
        appNotificationMessage = document.getElementById('app-notification-message');
        appNotificationIconContainer = document.getElementById('app-notification-icon-container');
        appNotificationCloseButton = document.getElementById('app-notification-close');

        if (appNotificationCloseButton) {
            appNotificationCloseButton.addEventListener('click', hideGlobalNotification);
        }
    }

    function showGlobalNotification(message, type = 'info', duration = 5000) {
        if (!appNotificationElement || !appNotificationMessage || !appNotificationIconContainer) {
            console.warn("Global notification elements not found on this page. Alerting instead:", message);
            alert(message); 
            return;
        }
        if (notificationTimeout) clearTimeout(notificationTimeout);
        
        appNotificationMessage.textContent = message;
        appNotificationElement.classList.remove('opacity-0', 'translate-x-full', 'notification-hide', 'hidden');
        appNotificationElement.classList.add('opacity-100', 'notification-show', 'pointer-events-auto');
        
        appNotificationIconContainer.innerHTML = ''; 
        let iconClass = 'fas fa-info-circle';
        let bgColor = 'bg-blue-500'; 

        if (document.body.classList.contains('client-view-active')) bgColor = 'bg-green-500';
        else if (document.body.classList.contains('recorder-view-active')) bgColor = 'bg-blue-500';
        else if (document.body.classList.contains('salesperson-view-active')) bgColor = 'bg-purple-500';
        else if (document.body.classList.contains('index-view-active')) bgColor = 'bg-gray-500';

        if (type === 'success') { iconClass = 'fas fa-check-circle'; bgColor = 'bg-green-500'; }
        else if (type === 'error') { iconClass = 'fas fa-exclamation-circle'; bgColor = 'bg-red-500'; }
        else if (type === 'warning') { iconClass = 'fas fa-exclamation-triangle'; bgColor = 'bg-yellow-500'; }
        
        const iconElement = document.createElement('i');
        iconElement.className = `${iconClass} text-white text-lg`;
        appNotificationIconContainer.className = `flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full mr-3.5 ${bgColor}`;
        appNotificationIconContainer.appendChild(iconElement);
        
        notificationTimeout = setTimeout(hideGlobalNotification, duration);
    }

    function hideGlobalNotification() {
        if (!appNotificationElement) return;
        appNotificationElement.classList.remove('notification-show', 'opacity-100');
        appNotificationElement.classList.add('notification-hide');
        setTimeout(() => {
            appNotificationElement.classList.add('opacity-0','translate-x-full', 'pointer-events-none', 'hidden');
        }, 450); 
    }
    
    function setButtonLoadingState(button, isLoading, defaultTextSelector = '.button-text', loaderSelector = '.button-loader') {
        if (!button) return;
        const textSpan = button.querySelector(defaultTextSelector);
        const loaderSpan = button.querySelector(loaderSelector);
        button.disabled = isLoading;
        if (textSpan) textSpan.classList.toggle('hidden', isLoading);
        if (loaderSpan) loaderSpan.classList.toggle('hidden', !isLoading);
    }

    // Public API of SharedAppLogic
    return {
        // Auth
        registerAPI,
        loginAPI,
        logoutAPI,
        checkSessionAPI,
        setAuthToken, // For landing page to set after its own auth flow if needed
        clearAuthToken,
        isAuthenticated,
        getCurrentUser,
        USER_STORAGE_KEY,

        // Meetings
        fetchMeetings: fetchMeetingsAPI,
        createMeeting: createMeetingAPI,
        updateMeeting: updateMeetingAPI,
        deleteMeeting: deleteMeetingAPI,
        getMeetings, // Returns local cache
        getMeetingById, // Searches local cache

        // Recordings & Analysis
        uploadRecordingAPI,
        fetchAnalysisStatusAPI,
        fetchAnalysisDataAPI,
        queryAnalysisAPI,
        downloadAnalysisPdfAPI,

        // Client Access
        validateClientAccessAPI,

        // Utilities
        generateId, // Still useful for frontend temp IDs or non-critical unique keys
        generateRecorderLink, // Backend primarily generates this; this is a fallback/display helper
        showGlobalNotification,
        initGlobalNotifications,
        setButtonLoadingState
    };
})();
