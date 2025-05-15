// /js/shared-app-logic.js
const SharedAppLogic = (() => {
    // --- STATE & CONFIG ---
    let meetingsData = [];
    const MEETINGS_STORAGE_KEY = 'integratedMeetingsApp'; // From original App module
    const USER_STORAGE_KEY = 'meetingAnalysisUser'; // From landing page script
    let notificationTimeout;

    // --- DOM ELEMENTS (for global notification, assumed to be consistent across pages) ---
    // These will be queried by initGlobalNotifications if the elements exist on the current page.
    let appNotificationElement, appNotificationMessage, appNotificationIconContainer, appNotificationCloseButton;

    // --- LOCAL STORAGE ---
    function saveMeetingsToStorage() {
        localStorage.setItem(MEETINGS_STORAGE_KEY, JSON.stringify(meetingsData));
        // console.log("Meetings saved to storage:", meetingsData);
    }

    function loadMeetingsFromStorage() {
        const stored = localStorage.getItem(MEETINGS_STORAGE_KEY);
        if (stored) {
            meetingsData = JSON.parse(stored);
        } else {
            // Initialize with some default if none exist (from original App module)
            meetingsData = [
                { 
                    id: 'sm-default-1', 
                    title: 'Q4 Strategy with Acme Corp', 
                    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), 
                    clientEmail: 'contact@acme.com', 
                    notes: 'Discuss Q4 targets and new product line.', 
                    status: 'Scheduled', 
                    clientCode: generateId(6), 
                    // salespersonCode: generateId(6), // Not used in this structure
                    recorderId: `rec-${generateId(5)}`, // Ensure recorderId is distinct
                    recorderLink: generateRecorderLink(`rec-${generateId(5)}`, generateId(8)), 
                    analysisAvailable: false,
                    analysisData: null
                },
                { 
                    id: 'sm-default-2', 
                    title: 'Product Demo for Globex Inc.', 
                    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), 
                    clientEmail: 'info@globex.com', 
                    notes: 'Showcased new AI features. Client seemed impressed. Follow up on pricing.', 
                    status: 'Completed', 
                    clientCode: generateId(6), 
                    // salespersonCode: generateId(6),
                    recorderId: `rec-${generateId(5)}`,
                    recorderLink: generateRecorderLink(`rec-${generateId(5)}`, generateId(8)), 
                    analysisAvailable: true,
                    startTimeActual: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                    duration: "00:45:12",
                    analysisData: { // Mock analysis for the completed default meeting
                        summary: `<p>The product demo for <strong>Globex Inc.</strong> was successful. Key discussion points included the new AI features, which the client found impressive. A follow-up regarding pricing is required.</p>`,
                        transcript: `Speaker 1: Welcome to the Globex Inc. demo.\nSpeaker 2: Thank you for presenting today.\n...\n(Simulated transcript for Globex Inc. demo)\n...\nSpeaker 1: Any final questions on the AI capabilities?\nSpeaker 2: Not at this time, it looks very promising. We'll need the pricing details.`,
                        keyPoints: `<ul><li>Client (Globex Inc.) impressed with new AI features.</li><li>Pricing information requested.</li><li>Potential for strong partnership.</li></ul>`,
                        actionItems: `<ol><li><strong>Salesperson:</strong> Send detailed pricing proposal to info@globex.com.</li><li><strong>Salesperson:</strong> Schedule follow-up call for next week.</li></ol>`,
                        questions: `<ul><li>"What is the estimated ROI for a company of our size?" (Client)</li><li>"How does the AI handle industry-specific jargon?" (Client)</li></ul>`,
                        sentiment: `<p>Overall meeting sentiment: <strong>Very Positive (85%)</strong>.</p><ul><li>Client Engagement: High</li><li>Key Positives: AI features, ease of use.</li><li>Next Steps: Pricing, follow-up call.</li></ul>`
                    }
                },
            ];
            saveMeetingsToStorage();
        }
        // console.log("Meetings loaded from storage:", meetingsData);
    }
    
    // --- UTILITIES ---
    function generateId(length = 8) {
        return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
    }

    function generateRecorderLink(recorderId, recorderCode) {
        // This link will now point to recorder.html with query parameters
        // The base URL will be resolved by the browser.
        return `recorder.html?meetingId=${recorderId}&recorderCode=${recorderCode}`;
    }

    function setButtonLoadingState(button, isLoading, defaultTextSelector = '.button-text', loaderSelector = '.button-loader') {
        if (!button) return;
        const textSpan = button.querySelector(defaultTextSelector);
        const loaderSpan = button.querySelector(loaderSelector);
        button.disabled = isLoading;
        if (textSpan) textSpan.classList.toggle('hidden', isLoading);
        if (loaderSpan) loaderSpan.classList.toggle('hidden', !isLoading);
    }

    // --- GLOBAL NOTIFICATION (adapted from App module) ---
    function initGlobalNotifications() {
        // Query for notification elements on the current page
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
            // console.warn("Global notification elements not found on this page.");
            alert(message); // Fallback to alert if notification elements are not present
            return;
        }
        if (notificationTimeout) clearTimeout(notificationTimeout);
        
        appNotificationMessage.textContent = message;
        appNotificationElement.classList.remove('opacity-0', 'translate-x-full', 'notification-hide', 'hidden');
        appNotificationElement.classList.add('opacity-100', 'notification-show', 'pointer-events-auto');
        
        appNotificationIconContainer.innerHTML = ''; 
        let iconClass = 'fas fa-info-circle';
        let bgColor = 'bg-blue-500'; // Default

        // Determine color based on current page's body class (theme) if not error/success/warning
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
            appNotificationElement.classList.add('opacity-0','translate-x-full', 'pointer-events-none', 'hidden');
        }, 450); 
    }
    
    // --- PUBLIC API ---
    // Load meetings immediately when this script is parsed
    loadMeetingsFromStorage();

    return {
        initGlobalNotifications, // Call this on DOMContentLoaded in each HTML page
        loadMeetings: loadMeetingsFromStorage, // Explicit call if needed, but auto-loads
        saveMeetings: saveMeetingsToStorage,
        getMeetings: () => meetingsData,
        getMeetingById: (id) => meetingsData.find(m => m.id === id || m.recorderId === id),
        updateMeeting: (updatedMeeting) => {
            const index = meetingsData.findIndex(m => m.id === updatedMeeting.id || m.recorderId === updatedMeeting.id);
            if (index !== -1) {
                meetingsData[index] = { ...meetingsData[index], ...updatedMeeting }; // Merge to preserve all fields
                saveMeetingsToStorage();
                return true;
            }
            // console.warn("Meeting not found for update:", updatedMeeting.id);
            return false;
        },
        addMeeting: (newMeeting) => {
            // Ensure no duplicate IDs if adding from different contexts
            if (meetingsData.some(m => m.id === newMeeting.id || m.recorderId === newMeeting.id)) {
                // console.warn("Attempted to add a meeting with an existing ID:", newMeeting.id);
                // Potentially update if it's an ad-hoc recording becoming official
                return SharedAppLogic.updateMeeting(newMeeting);
            }
            meetingsData.push(newMeeting);
            saveMeetingsToStorage();
        },
        generateId,
        generateRecorderLink,
        showGlobalNotification,
        setButtonLoadingState,
        USER_STORAGE_KEY // Expose for landing page to use the same key
    };
})();
