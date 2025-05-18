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
        // Always get the latest token from localStorage
        const currentToken = localStorage.getItem('authToken');
        
        // <<< START DEBUG LOGGING >>>
        console.log("[SharedAppLogic] makeApiRequest: Current authToken from localStorage:", currentToken ? "Present" : "Absent");
        // <<< END DEBUG LOGGING >>>

        if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
        }
        
        // <<< START DEBUG LOGGING >>>
        console.log(`[SharedAppLogic] makeApiRequest: Sending request to ${endpoint} with headers:`, JSON.stringify(headers));
        // <<< END DEBUG LOGGING >>>

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

            if (response.status === 204) { 
                return null;
            }

            if (isBlobResponse) { 
                return response; 
            }
            return await response.json(); 
        } catch (error) {
            console.error(`[SharedAppLogic] API request to ${method} ${endpoint} failed:`, error.message);
            if (error.message !== "Unauthorized") { 
                 showGlobalNotification(`API Error: ${error.message || 'Could not connect to server.'}`, "error");
            }
            throw error; 
        }
    }


    // --- AUTHENTICATION ---
    async function registerAPI(userData) { 
        const data = await makeApiRequest('/api/auth/register', 'POST', userData);
        if (data && data.success && data.token && data.user) {
            setAuthToken(data.token);
            setCurrentUser(data.user);
            console.log("[SharedAppLogic] registerAPI: Token and user set after registration.");
        } else {
            console.warn("[SharedAppLogic] registerAPI: Registration response missing token or user, or not successful.", data);
        }
        return data; 
    }

    async function loginAPI(credentials) { 
        const data = await makeApiRequest('/api/auth/login', 'POST', credentials);
        if (data && data.success && data.token && data.user) {
            setAuthToken(data.token);
            setCurrentUser(data.user);
            console.log("[SharedAppLogic] loginAPI: Token and user set after login.");
        } else {
             console.warn("[SharedAppLogic] loginAPI: Login response missing token or user, or not successful.", data);
        }
        return data;
    }

    async function logoutAPI() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Logout failed');
            }

            // Clear local storage using the correct keys
            clearAuthTokenAndUser();
            localStorage.removeItem('pendingRole');
            
            // Redirect to landing page
            window.location.href = '/landing-page.html';
        } catch (error) {
            console.error('Logout error:', error);
            // Still clear local storage and redirect even if API call fails
            clearAuthTokenAndUser(); 
            localStorage.removeItem('pendingRole');
            window.location.href = '/landing-page.html';
        }
    }
    
    async function checkSessionAPI() { 
        if (!localStorage.getItem('authToken')) { 
            console.log("[SharedAppLogic] checkSessionAPI: No auth token in localStorage, clearing session.");
            clearAuthTokenAndUser(); 
            return null;
        }
        
        // Update the authToken variable from localStorage
        authToken = localStorage.getItem('authToken'); 
        console.log("[SharedAppLogic] checkSessionAPI: Attempting to verify session with token:", authToken ? "Present" : "Absent");

        try {
            const data = await makeApiRequest('/api/auth/me', 'GET');
            if (data && data.success && data.user) {
                setCurrentUser(data.user);
                console.log("[SharedAppLogic] checkSessionAPI: Session verified, user set:", data.user);
                return data.user;
            }
            console.warn("[SharedAppLogic] checkSessionAPI: /api/auth/me did not return success or user data.", data);
            clearAuthTokenAndUser(); 
            return null;
        } catch (error) { 
            console.error("[SharedAppLogic] checkSessionAPI: Error during session check:", error.message);
            clearAuthTokenAndUser();
            return null;
        }
    }

    function setAuthToken(token) {
        if (token) {
        authToken = token;
        localStorage.setItem('authToken', token);
        console.log("[SharedAppLogic] setAuthToken: Token stored in localStorage and variable.");
        } else {
            clearAuthTokenAndUser();
        }
    }
    function clearAuthTokenAndUser() {
        console.log("[SharedAppLogic] clearAuthTokenAndUser: Clearing token and user from localStorage and variable.");
        authToken = null;
        currentUser = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem(USER_STORAGE_KEY); 
    }
    function isAuthenticated() {
        const tokenExists = !!localStorage.getItem('authToken');
        // console.log("[SharedAppLogic] isAuthenticated check:", tokenExists); // Can be noisy
        return tokenExists; 
    }
    function setCurrentUser(userData) {
        currentUser = userData;
        if (userData) {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
            console.log("[SharedAppLogic] setCurrentUser: User data stored/updated in localStorage.");
        } else {
            localStorage.removeItem(USER_STORAGE_KEY);
            console.log("[SharedAppLogic] setCurrentUser: User data removed from localStorage.");
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
        // console.log("[SharedAppLogic] getCurrentUser:", currentUser); // Can be noisy
        return currentUser;
    }

    // --- MEETINGS DATA ---
    async function fetchMeetingsAPI() {
        const response = await makeApiRequest('/api/meetings', 'GET');
        meetingsDataCache = response.data || []; 
        console.log("[SharedAppLogic] fetchMeetingsAPI: Meetings cache updated.", meetingsDataCache.length, "meetings fetched.");
        return response;
    }

    async function createMeetingAPI(meetingDetails) { 
        const newMeeting = await makeApiRequest('/api/meetings', 'POST', meetingDetails);
        return newMeeting; 
    }

    async function updateMeetingAPI(meetingId, meetingDetails) {
        const updatedMeeting = await makeApiRequest(`/api/meetings/${meetingId}`, 'PUT', meetingDetails);
        return updatedMeeting;
    }

    async function deleteMeetingAPI(meetingId) {
        await makeApiRequest(`/api/meetings/${meetingId}`, 'DELETE');
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
            console.error("[SharedAppLogic] Error triggering PDF download:", error);
            throw error; 
        }
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
        return `recorder.html?recordingId=${recordingId}&recorderCode=${recorderCode}`;
    }
    
    function initGlobalNotifications() {
        appNotificationElement = document.getElementById('app-notification');
        appNotificationMessage = document.getElementById('app-notification-message');
        appNotificationIconContainer = document.getElementById('app-notification-icon-container');
        appNotificationCloseButton = document.getElementById('app-notification-close');

        if (appNotificationCloseButton) {
            appNotificationCloseButton.addEventListener('click', hideGlobalNotification);
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