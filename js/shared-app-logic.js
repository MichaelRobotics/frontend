// /js/shared-app-logic.js
const SharedAppLogic = (() => {
    // --- STATE & CONFIG ---
    let meetingsDataCache = []; 
    let authToken = localStorage.getItem('authToken'); 
    const USER_STORAGE_KEY = 'meetingAnalysisUser'; 
    let currentUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY)) || null;

    let notificationTimeout;
    let appNotificationElement, appNotificationMessage, appNotificationIconContainer, appNotificationCloseButton;

    // --- UTILITY: HTTP Request Helper ---
    async function makeApiRequest(endpoint, method = 'GET', body = null, isFormData = false, isBlobResponse = false) {
        const headers = {};
        const currentToken = localStorage.getItem('authToken');
        
        // console.log(`[SharedAppLogic] makeApiRequest: ${method} ${endpoint} - Token: ${currentToken ? "Present" : "Absent"}`); // Less verbose logging

        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        
        if (body && !isFormData && method !== 'GET' && method !== 'HEAD') { 
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
            const response = await fetch(endpoint, config); 

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
                    const textError = await response.text(); 
                    console.error("[SharedAppLogic] makeApiRequest: Non-JSON error response:", textError);
                    errorData = { message: `HTTP error! Status: ${response.status} ${response.statusText}. Response: ${textError.substring(0,100)}...` };
                }
                throw new Error(errorData.message || `HTTP error! Status: ${response.status} ${response.statusText}`);
            }

            if (response.status === 204) { // No Content
                return null;
            }

            if (isBlobResponse) { 
                return response; // Return the full response for blob handling (e.g. PDF download)
            }
            return await response.json(); // Parse JSON for other successful responses
        } catch (error) {
            console.error(`[SharedAppLogic] API request to ${method} ${endpoint} failed:`, error.message);
            if (error.message !== "Unauthorized") { // Avoid double notification for unauthorized
                 showGlobalNotification(`API Error: ${error.message || 'Could not connect to server.'}`, "error");
            }
            throw error; // Re-throw to be caught by the calling function
        }
    }


    // --- AUTHENTICATION ---
    async function registerAPI(userData) { 
        const data = await makeApiRequest('/api/auth/register', 'POST', userData);
        if (data && data.success && data.token && data.user) {
            setAuthToken(data.token);
            setCurrentUser(data.user);
        }
        return data; 
    }

    async function loginAPI(credentials) { 
        const data = await makeApiRequest('/api/auth/login', 'POST', credentials);
        if (data && data.success && data.token && data.user) {
            setAuthToken(data.token);
            setCurrentUser(data.user);
        }
        return data;
    }

    async function logoutAPI() {
        // The backend logout might invalidate the token on the server-side (e.g., if using a denylist)
        // For a simple JWT setup, client-side clearing is often the main part.
        try {
            // Optional: Call a backend endpoint to invalidate the token if your backend supports it.
            // await makeApiRequest('/api/auth/logout', 'POST'); 
            console.log("[SharedAppLogic] logoutAPI: Called.");
        } catch (error) {
            // Log if backend logout fails, but proceed with client-side cleanup
            console.warn("[SharedAppLogic] Backend logout call failed (if implemented), proceeding with client cleanup:", error.message);
        } finally {
            clearAuthTokenAndUser();
            localStorage.removeItem('pendingRole'); // Clear any pending role from landing page
            // Redirect to landing page
            if (window.location.pathname !== '/landing-page.html' && window.location.pathname !== '/') {
                showGlobalNotification('You have been signed out.', 'info', 2000);
                setTimeout(() => { window.location.href = '/landing-page.html'; }, 2000);
            }
        }
    }
    
    async function checkSessionAPI() { 
        if (!localStorage.getItem('authToken')) { 
            clearAuthTokenAndUser(); 
            return null;
        }
        
        authToken = localStorage.getItem('authToken'); 

        try {
            const data = await makeApiRequest('/api/auth/me', 'GET');
            if (data && data.success && data.user) {
                setCurrentUser(data.user);
                return data.user;
            }
            clearAuthTokenAndUser(); 
            return null;
        } catch (error) { 
            // Error (like "Unauthorized") already handled by makeApiRequest, which calls clearAuthTokenAndUser
            console.error("[SharedAppLogic] checkSessionAPI: Error during session check, session likely cleared.", error.message);
            return null;
        }
    }

    function setAuthToken(token) {
        if (token) {
            authToken = token;
            localStorage.setItem('authToken', token);
        } else {
            clearAuthTokenAndUser(); // Ensure consistency if called with null/undefined
        }
    }

    function clearAuthTokenAndUser() {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem(USER_STORAGE_KEY); 
        console.log("[SharedAppLogic] Cleared auth token and user data from localStorage.");
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
                    console.error("[SharedAppLogic] getCurrentUser: Error parsing stored user data:", e);
                    localStorage.removeItem(USER_STORAGE_KEY); 
                    currentUser = null;
                }
            }
        }
        return currentUser;
    }

    // --- MEETINGS DATA ---
    async function fetchMeetingsAPI() {
        const response = await makeApiRequest('/api/meetings', 'GET');
        if (response && response.success && Array.isArray(response.data)) {
            meetingsDataCache = response.data;
            console.log("[SharedAppLogic] fetchMeetingsAPI: Meetings cache updated.", meetingsDataCache.length, "meetings fetched.");
        } else {
            meetingsDataCache = []; // Ensure cache is an array even on failure or unexpected response
            console.warn("[SharedAppLogic] fetchMeetingsAPI: Failed to fetch or invalid data format.", response);
        }
        return response; // Return the full response for the caller to handle success/failure messages
    }

    async function createMeetingAPI(meetingDetails) { 
        const response = await makeApiRequest('/api/meetings', 'POST', meetingDetails);
        if (response && response.success && response.data) {
            meetingsDataCache.unshift(response.data); // Add to the beginning of the cache
            console.log("[SharedAppLogic] createMeetingAPI: New meeting added to cache.");
        }
        return response; 
    }

    async function updateMeetingAPI(meetingId, meetingDetails) {
        const response = await makeApiRequest(`/api/meetings/${meetingId}`, 'PUT', meetingDetails);
        if (response && response.success && response.data) {
            const index = meetingsDataCache.findIndex(m => m.id === meetingId);
            if (index !== -1) {
                meetingsDataCache[index] = response.data; // Update in cache
            } else {
                meetingsDataCache.unshift(response.data); // Or add if not found (though update implies it should exist)
            }
            console.log("[SharedAppLogic] updateMeetingAPI: Meeting updated in cache.");
        }
        return response;
    }

    async function deleteMeetingAPI(meetingId) {
        // Backend DELETE /api/meetings/[meetingId] doesn't return the deleted item, just success/failure.
        // So we remove from cache optimistically or based on success.
        await makeApiRequest(`/api/meetings/${meetingId}`, 'DELETE'); // Throws on failure
        
        const index = meetingsDataCache.findIndex(m => m.id === meetingId);
        if (index !== -1) {
            meetingsDataCache.splice(index, 1); // Remove from cache
            console.log("[SharedAppLogic] deleteMeetingAPI: Meeting removed from cache.");
        }
        return { success: true, meetingId }; // Return success for the caller
    }

    function getMeetings() { 
        return [...meetingsDataCache]; // Return a copy to prevent direct modification
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
        // This endpoint in analysis.js shapes data by role.
        // The role is determined by the token on the backend.
        return await makeApiRequest(`/api/recordings/${recordingId}/analysis`, 'GET');
    }

    async function queryAnalysisAPI(recordingId, question) {
        return await makeApiRequest(`/api/recordings/${recordingId}/query-analysis`, 'POST', { question });
    }

    async function downloadAnalysisPdfAPI(recordingId) {
        // makeApiRequest with isBlobResponse = true will return the raw Response object
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
        showGlobalNotification("PDF download initiated.", "success"); // Optimistic
        return { success: true }; // Indicates the process was started
    }

    // --- CLIENT ACCESS ---
    async function validateClientAccessAPI(shareableId, clientCode) {
        return await makeApiRequest('/api/client/validate-access', 'POST', { 
            shareableId: shareableId, 
            clientCode: clientCode 
        });
    }

    // --- UTILITIES ---
    function generateId(length = 8) { 
        return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
    }
    function generateRecorderLink(recordingId, recorderCode) { 
        // Ensure the link is relative to the current deployment or absolute if needed
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        return `${basePath}recorder.html?recordingId=${recordingId}&recorderCode=${recorderCode}`;
    }
    
    function initGlobalNotifications() {
        appNotificationElement = document.getElementById('app-notification');
        appNotificationMessage = document.getElementById('app-notification-message');
        appNotificationIconContainer = document.getElementById('app-notification-icon-container');
        appNotificationCloseButton = document.getElementById('app-notification-close');

        if (appNotificationCloseButton) {
            appNotificationCloseButton.addEventListener('click', hideGlobalNotification);
        } else {
            console.warn("Global notification close button not found. Notifications cannot be dismissed by click.");
        }
    }

    function showGlobalNotification(message, type = 'info', duration = 4000) {
        if (!appNotificationElement || !appNotificationMessage || !appNotificationIconContainer) {
            console.warn("Global notification elements not found. Alerting as fallback:", message);
            alert(`${type.toUpperCase()}: ${message}`); 
            return;
        }
        if (notificationTimeout) clearTimeout(notificationTimeout);
        
        appNotificationMessage.textContent = message;
        appNotificationElement.classList.remove('opacity-0', 'translate-x-full', 'notification-hide', 'hidden');
        appNotificationElement.classList.add('opacity-100', 'notification-show', 'pointer-events-auto');
        
        appNotificationIconContainer.innerHTML = ''; 
        let iconClass = 'fas fa-info-circle';
        let bgColor = 'bg-blue-500'; // Default

        // Theme specific default icon color if not overridden by type
        if (document.body.classList.contains('client-view-active')) bgColor = 'bg-green-500';
        else if (document.body.classList.contains('recorder-view-active')) bgColor = 'bg-blue-500';
        else if (document.body.classList.contains('salesperson-view-active')) bgColor = 'bg-purple-500';
        else if (document.body.classList.contains('index-view-active')) bgColor = 'bg-gray-500';

        // Type overrides default theme color for icon
        if (type === 'success') { iconClass = 'fas fa-check-circle'; bgColor = 'bg-green-500'; }
        else if (type === 'error') { iconClass = 'fas fa-exclamation-circle'; bgColor = 'bg-red-500'; }
        else if (type === 'warning') { iconClass = 'fas fa-exclamation-triangle'; bgColor = 'bg-yellow-500 text-black'; } // Yellow often needs dark text
        
        const iconElement = document.createElement('i');
        iconElement.className = `${iconClass} text-white text-lg`; // Assuming white icon text for colored backgrounds
        if (type === 'warning') iconElement.classList.replace('text-white', 'text-yellow-800'); // Specific for warning

        appNotificationIconContainer.className = `flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full mr-3.5 ${bgColor}`;
        appNotificationIconContainer.appendChild(iconElement);
        
        notificationTimeout = setTimeout(hideGlobalNotification, duration);
    }

    function hideGlobalNotification() {
        if (!appNotificationElement) return;
        appNotificationElement.classList.remove('notification-show', 'opacity-100');
        appNotificationElement.classList.add('notification-hide');
        // Ensure it becomes non-interactive and hidden after animation
        setTimeout(() => {
            if(appNotificationElement) {
                appNotificationElement.classList.add('opacity-0','translate-x-full', 'pointer-events-none', 'hidden');
            }
        }, 450); // Duration should match animation
    }
    
    function setButtonLoadingState(button, isLoading, defaultTextSelector = '.button-text', loaderSelector = '.button-loader') {
        if (!button) return;
        const textSpan = button.querySelector(defaultTextSelector);
        const loaderSpan = button.querySelector(loaderSelector);
        button.disabled = isLoading;
        if (isLoading) {
            button.classList.add('opacity-70', 'cursor-not-allowed');
        } else {
            button.classList.remove('opacity-70', 'cursor-not-allowed');
        }
        if (textSpan) textSpan.classList.toggle('hidden', isLoading);
        if (loaderSpan) loaderSpan.classList.toggle('hidden', !isLoading);
    }

    // Exposed public methods
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
        // Note: addMeetingAPI was removed as it was undefined. RecorderView should use createMeetingAPI for ad-hoc.
    };
})();