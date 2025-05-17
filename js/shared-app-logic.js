// /js/shared-app-logic.js
const SharedAppLogic = (() => {
    // --- STATE & CONFIG ---
    let meetingsDataCache = []; // Local cache of meetings, primarily populated from API
    let authToken = localStorage.getItem('authToken'); // Load token on script init
    const USER_STORAGE_KEY = 'meetingAnalysisUser'; 
    let currentUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY)) || null;

    let notificationTimeout;
    let appNotificationElement, appNotificationMessage, appNotificationIconContainer, appNotificationCloseButton;

    // --- API Base Path (Leave empty for relative paths if API is on the same origin) ---
    // const API_BASE_URL = ''; 

    // --- UTILITY: HTTP Request Helper ---
    async function makeApiRequest(endpoint, method = 'GET', body = null, isFormData = false, isBlobResponse = false) {
        const headers = {};
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        // Content-Type is not set for FormData; browser does it with boundary
        if (body && !isFormData && method !== 'GET' && method !== 'HEAD') { // GET/HEAD requests cannot have a body
            headers['Content-Type'] = 'application/json';
        }

        const config = {
            method,
            headers,
        };

        if (body && method !== 'GET' && method !== 'HEAD') {
            config.body = isFormData ? body : JSON.stringify(body);
        }

        try {
            const response = await fetch(endpoint, config); // Assumes API endpoints are relative or API_BASE_URL is prepended

            if (response.status === 401) { 
                clearAuthTokenAndUser(); 
                showGlobalNotification("Session expired or invalid. Please log in again.", "error", 4000);
                setTimeout(() => {
                    if (window.location.pathname !== '/landing-page.html' && window.location.pathname !== '/') {
                         window.location.href = 'landing-page.html'; 
                    }
                }, 2500);
                throw new Error("Unauthorized"); 
            }

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    // If response is not JSON, use status text
                    errorData = { message: `HTTP error! Status: ${response.status} ${response.statusText}` };
                }
                throw new Error(errorData.message || `HTTP error! Status: ${response.status} ${response.statusText}`);
            }

            if (response.status === 204) { // No Content
                return null;
            }

            if (isBlobResponse) { // For PDF download
                return response; 
            }
            return await response.json(); // For all other successful JSON responses
        } catch (error) {
            console.error(`API request to ${method} ${endpoint} failed:`, error);
            if (error.message !== "Unauthorized") { 
                 showGlobalNotification(`API Error: ${error.message || 'Could not connect to server.'}`, "error");
            }
            throw error; 
        }
    }


    // --- AUTHENTICATION ---
    async function registerAPI(userData) { // { email, password, name }
        const data = await makeApiRequest('/api/auth/register', 'POST', userData);
        if (data && data.success && data.token && data.user) {
            setAuthToken(data.token);
            setCurrentUser(data.user);
        }
        return data; 
    }

    async function loginAPI(credentials) { // { email, password }
        const data = await makeApiRequest('/api/auth/login', 'POST', credentials);
        if (data && data.success && data.token && data.user) {
            setAuthToken(data.token);
            setCurrentUser(data.user);
        }
        return data;
    }

    async function logoutAPI() {
        try {
            // Call backend logout. Even if it's just for logging, it's good practice.
            await makeApiRequest('/api/auth/logout', 'POST'); 
            console.log("Logout API call successful or simulated.");
        } catch (error) {
            console.warn("Logout API call failed (might be okay if stateless or already invalid):", error.message);
        } finally {
            clearAuthTokenAndUser(); // Always clear client-side session
        }
    }
    
    async function checkSessionAPI() { 
        if (!authToken) {
            clearAuthTokenAndUser(); 
            return null;
        }
        try {
            const data = await makeApiRequest('/api/auth/me', 'GET'); // Endpoint to verify token and get user
            if (data && data.success && data.user) {
                setCurrentUser(data.user); // Refresh user data
                return data.user;
            }
            clearAuthTokenAndUser(); // Token might be invalid if no user data returned
            return null;
        } catch (error) { 
            // makeApiRequest already handles 401 by clearing token
            return null;
        }
    }

    function setAuthToken(token) {
        authToken = token;
        localStorage.setItem('authToken', token);
    }
    function clearAuthTokenAndUser() {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem(USER_STORAGE_KEY); 
    }
    function isAuthenticated() {
        return !!localStorage.getItem('authToken'); 
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
            const storedUser = localStorage.getItem(USER_STORAGE_KEY);
            if (storedUser) {
                try {
                    currentUser = JSON.parse(storedUser);
                } catch (e) {
                    console.error("Error parsing stored user data:", e);
                    localStorage.removeItem(USER_STORAGE_KEY); 
                    currentUser = null;
                }
            }
        }
        return currentUser;
    }

    // --- MEETINGS DATA ---
    async function fetchMeetingsAPI() {
        const data = await makeApiRequest('/api/meetings', 'GET');
        meetingsDataCache = Array.isArray(data) ? data : []; 
        return meetingsDataCache;
    }

    async function createMeetingAPI(meetingDetails) { 
        const newMeeting = await makeApiRequest('/api/meetings', 'POST', meetingDetails);
        // Caller should refresh the list via fetchMeetingsAPI()
        return newMeeting; 
    }

    async function updateMeetingAPI(meetingId, meetingDetails) {
        const updatedMeeting = await makeApiRequest(`/api/meetings/${meetingId}`, 'PUT', meetingDetails);
        // Caller should refresh the list via fetchMeetingsAPI()
        return updatedMeeting;
    }

    async function deleteMeetingAPI(meetingId) {
        await makeApiRequest(`/api/meetings/${meetingId}`, 'DELETE');
        // Caller should refresh the list via fetchMeetingsAPI()
        return { success: true, meetingId };
    }

    function getMeetings() { 
        return meetingsDataCache;
    }

    function getMeetingById(id) { 
        return meetingsDataCache.find(m => m.id === id || m.recordingId === id);
    }

    // --- RECORDINGS & ANALYSIS DATA ---
    async function uploadRecordingAPI(recordingId, formData) { 
        return await makeApiRequest(`/api/recordings/${recordingId}/upload`, 'POST', formData, true);
    }

    async function fetchAnalysisStatusAPI(recordingId) {
        return await makeApiRequest(`/api/recordings/${recordingId}/analysis/status`, 'GET');
    }

    async function fetchAnalysisDataAPI(recordingId) {
        return await makeApiRequest(`/api/recordings/${recordingId}/analysis`, 'GET');
    }

    async function queryAnalysisAPI(recordingId, question) {
        return await makeApiRequest(`/api/recordings/${recordingId}/query-analysis`, 'POST', { question });
    }

    async function downloadAnalysisPdfAPI(recordingId) {
        try {
            const response = await makeApiRequest(`/api/recordings/${recordingId}/analysis/pdf`, 'GET', null, false, true);
            
            const blob = await response.blob();
            const contentDisposition = response.headers.get('content-disposition');
            let filename = `AnalysisReport_${recordingId}.pdf`; 
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
            showGlobalNotification("PDF download initiated.", "success");
            return { success: true };
        } catch (error) {
            console.error("Error triggering PDF download in SharedAppLogic:", error);
            // Error notification is likely already handled by makeApiRequest
            throw error; 
        }
    }

    // --- CLIENT ACCESS ---
    async function validateClientAccessAPI(meetingId, clientCode) {
        return await makeApiRequest('/api/client/validate-access', 'POST', { meetingId, clientCode });
    }

    // --- UTILITIES ---
    function generateId(length = 8) { 
        return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
    }
    function generateRecorderLink(recordingId, recorderCode) { 
        // This is primarily for display if the backend doesn't return the full link.
        // The canonical link should come from the backend meeting object.
        return `recorder.html?recordingId=${recordingId}&recorderCode=${recorderCode}`;
    }
    
    function initGlobalNotifications() {
        appNotificationElement = document.getElementById('app-notification');
        appNotificationMessage = document.getElementById('app-notification-message');
        appNotificationIconContainer = document.getElementById('app-notification-icon-container');
        appNotificationCloseButton = document.getElementById('app-notification-close');

        if (appNotificationCloseButton) {
            appNotificationCloseButton.addEventListener('click', hideGlobalNotification);
        } else {
            // console.warn("Notification close button not found on this page. Notifications might not be closable manually.");
        }
    }

    function showGlobalNotification(message, type = 'info', duration = 4000) {
        if (!appNotificationElement || !appNotificationMessage || !appNotificationIconContainer) {
            console.warn("Global notification elements not found. Alerting:", message);
            alert(`${type.toUpperCase()}: ${message}`); 
            return;
        }
        if (notificationTimeout) clearTimeout(notificationTimeout);
        
        appNotificationMessage.textContent = message;
        appNotificationElement.classList.remove('opacity-0', 'translate-x-full', 'notification-hide', 'hidden');
        appNotificationElement.classList.add('opacity-100', 'notification-show', 'pointer-events-auto');
        
        appNotificationIconContainer.innerHTML = ''; 
        let iconClass = 'fas fa-info-circle';
        let bgColor = 'bg-blue-500'; 

        // Determine theme color for info notifications
        if (type === 'info') {
            if (document.body.classList.contains('client-view-active')) bgColor = 'bg-green-500';
            else if (document.body.classList.contains('recorder-view-active')) bgColor = 'bg-blue-500';
            else if (document.body.classList.contains('salesperson-view-active')) bgColor = 'bg-purple-500';
            else if (document.body.classList.contains('index-view-active')) bgColor = 'bg-gray-500'; // For app-main-dashboard
        }

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
            if(appNotificationElement) appNotificationElement.classList.add('opacity-0','translate-x-full', 'pointer-events-none', 'hidden');
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

    return {
        // Auth
        registerAPI, loginAPI, logoutAPI, checkSessionAPI,
        setAuthToken, clearAuthTokenAndUser, isAuthenticated, getCurrentUser, USER_STORAGE_KEY,

        // Meetings
        fetchMeetingsAPI, createMeetingAPI,
        updateMeetingAPI, deleteMeetingAPI,
        getMeetings, getMeetingById,

        // Recordings & Analysis
        uploadRecordingAPI, fetchAnalysisStatusAPI, fetchAnalysisDataAPI,
        queryAnalysisAPI, downloadAnalysisPdfAPI,

        // Client Access
        validateClientAccessAPI,

        // Utilities
        generateId, generateRecorderLink,
        showGlobalNotification, initGlobalNotifications, setButtonLoadingState
    };
})();