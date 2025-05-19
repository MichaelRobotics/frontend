// /js/salesperson-view.js
const SalespersonView = (() => {
    // Local cache of meetings for this view, typically synced from SharedAppLogic
    let meetings = []; 
    
    // Callbacks from SharedAppLogic, assigned during init
    let showNotificationCallback;
    let switchViewCallback; // For navigating to other main pages like app-main-dashboard
    let setButtonLoadingStateCallback;
    let getMeetingByIdCallback; // From SharedAppLogic, searches SharedAppLogic.meetingsDataCache

    // API interaction callbacks from SharedAppLogic
    let fetchMeetingsAPI;
    let createMeetingAPI;
    let updateMeetingAPI;
    let deleteMeetingAPI;
    let fetchAnalysisDataAPI;
    let queryAnalysisAPI;
    let downloadAnalysisPdfAPI;
    // generateIdCallback and generateRecorderLinkCallback are not directly used by SalespersonView for its core logic
    // but might be passed if some utility relied on them here.

    let currentMeetingId = null; // Stores the ID of the meeting being edited or viewed in detail (sm-xxxx)
    let currentMeetingForAnalysis = null; // Stores the full meeting object when its details/analysis are viewed
    let questionHistoryArray = []; // Stores Q&A history for the current viewed meeting

    // DOM Elements - to be populated by initDOMReferences
    let meetingListView, newEditMeetingView, meetingDetailsView, newMeetingBtn, meetingList, noMeetingsMessage;
    let formTitle, newEditMeetingForm, meetingIdInputHidden, meetingTitleInput, meetingDateInput, clientEmailInput, meetingNotesInput, cancelMeetingFormBtn, saveMeetingBtn, newMeetingError;
    let detailsMeetingTitle, detailsMeetingDate, detailsClientEmail, detailsMeetingStatus, detailsClientCode, detailsShareableIdSales, detailsMeetingIdSales, detailsRecorderLinkAnchor, detailsMeetingNotes, editMeetingBtn, deleteMeetingBtn, downloadPdfBtnSales;
    let analysisNotAvailable, analysisContentWrapper, analysisTabs, analysisPanels;
    let questionForm, questionInput, askButton, questionResultWrapper, questionTextEl, answerTextEl, questionHistory;
    let backToListBtn, logoutBtnSales, mainMenuBtnSales;

    /**
     * Returns the HTML structure for the salesperson view.
     * This HTML is injected into a container element on salesperson.html.
     */
    function getHTML() {
        // This HTML should match the structure expected by initDOMReferences.
        // It's taken from the user-provided michaelrobotics/frontend/frontend-prod-api/salesperson.html
        return `
        <header class="bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-xl sticky top-0 z-40">
            <div class="container mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center">
                <h1 class="text-xl sm:text-2xl font-bold mb-3 sm:mb-0 text-center sm:text-left tracking-tight flex items-center">
                    <i class="fas fa-user-tie mr-3 text-2xl opacity-90"></i>Salesperson Dashboard
                </h1>
                <div id="user-controls-sales" class="fade-in" style="--delay: 1s;">
                    <button id="back-to-list-btn-sales" class="btn-header btn-hover px-4 py-2 transition mr-2 text-sm sm:text-base font-medium hidden">
                        <i class="fas fa-arrow-left mr-2 icon-hover"></i>My Meetings
                    </button>
                    <button id="main-menu-btn-sales" class="btn-header btn-hover px-4 py-2 transition mr-2 text-sm sm:text-base font-medium">
                        <i class="fas fa-th-large mr-2 icon-hover"></i>App Dashboard
                    </button>
                    <button id="logout-btn-sales" class="btn-header btn-hover px-4 py-2 transition text-sm sm:text-base font-medium">
                        <i class="fas fa-sign-out-alt mr-2 icon-hover"></i>Logout Role
                    </button>
                </div>
            </div>
        </header>
        <main class="flex-grow container mx-auto p-5 sm:p-8">
            <div id="meeting-list-view-sales" class="view-section max-w-4xl mx-auto fade-in" style="--delay: 0.2s;">
                <div class="flex flex-col sm:flex-row justify-between items-center mb-8">
                    <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-0">My Scheduled Meetings</h2>
                    <button id="new-meeting-btn-sales" class="btn-primary-purple btn-hover text-white flex items-center self-start sm:self-center">
                        <i class="fas fa-plus mr-2 icon-hover"></i> Schedule New Meeting
                    </button>
                </div>
                <div id="meeting-list-sales" class="space-y-5">
                    <p id="no-meetings-message-sales" class="text-center text-gray-500 py-8 text-lg italic hidden">No meetings scheduled. Fetching...</p>
                </div>
            </div>
            <div id="new-edit-meeting-view-sales" class="view-section max-w-2xl mx-auto glass-effect p-7 sm:p-10 hidden fade-in">
                <h2 class="text-2xl sm:text-3xl font-bold mb-8 text-center text-gray-800" id="form-title-sales">Schedule New Meeting</h2>
                <form id="new-edit-meeting-form-sales" class="space-y-6">
                    <input type="hidden" id="meeting-id-sales-hidden">
                    <div>
                        <label for="meeting-title-sales-input" class="block text-gray-700 mb-1.5 font-semibold text-sm">Meeting Title</label>
                        <input type="text" id="meeting-title-sales-input" class="w-full custom-input" required placeholder="e.g., Q4 Strategy Discussion">
                    </div>
                    <div>
                        <label for="meeting-date-sales-input" class="block text-gray-700 mb-1.5 font-semibold text-sm">Date & Time</label>
                        <input type="datetime-local" id="meeting-date-sales-input" class="w-full custom-input" required>
                    </div>
                    <div>
                        <label for="client-email-sales-input" class="block text-gray-700 mb-1.5 font-semibold text-sm">Client Email</label>
                        <input type="email" id="client-email-sales-input" class="w-full custom-input" required placeholder="client@example.com">
                    </div>
                    <div>
                        <label for="meeting-notes-sales-input" class="block text-gray-700 mb-1.5 font-semibold text-sm">Agenda / Notes</label>
                        <textarea id="meeting-notes-sales-input" class="w-full custom-input custom-textarea" placeholder="Key topics..."></textarea>
                    </div>
                    <div class="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-2">
                        <button type="button" id="cancel-meeting-form-btn-sales" class="btn-secondary-outline btn-secondary-outline-purple btn-hover w-full sm:w-auto">Cancel</button>
                        <button type="submit" id="save-meeting-btn-sales" class="btn-primary-purple btn-hover w-full sm:w-auto">
                            <span class="button-text">Save Meeting</span>
                            <span class="button-loader hidden"><i class="fas fa-spinner fa-spin mr-2"></i>Saving...</span>
                        </button>
                    </div>
                </form>
                <p id="new-meeting-error-sales" class="error mt-5 text-center hidden text-sm"></p>
            </div>
            <div id="meeting-details-view-sales" class="view-section max-w-5xl mx-auto glass-effect p-7 sm:p-10 hidden fade-in">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-5">
                    <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 md:mb-0" id="details-meeting-title-sales">Meeting Details</h2>
                    <div class="flex flex-wrap gap-2 self-start md:self-center">
                        <button id="edit-meeting-btn-sales" class="btn-primary-purple btn-hover flex items-center text-sm"><i class="fas fa-edit mr-2 icon-hover"></i> Edit</button>
                        <button id="delete-meeting-btn-sales" class="btn-danger btn-hover flex items-center text-sm"><i class="fas fa-trash-alt mr-2 icon-hover"></i> Delete</button>
                        <button id="download-pdf-btn-sales" class="btn-success btn-hover flex items-center text-sm hidden">
                            <i class="fas fa-file-pdf mr-2 icon-hover"></i> Download PDF Report
                        </button>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8 p-5 bg-purple-50/70 rounded-xl border border-purple-200/70">
                    <div>
                        <h3 class="text-lg font-semibold mb-2 text-purple-800">Information</h3>
                        <div class="space-y-1.5 text-sm">
                            <p><strong class="text-gray-700">Date & Time:</strong> <span id="details-meeting-date-sales" class="text-gray-600"></span></p>
                            <p><strong class="text-gray-700">Client:</strong> <span id="details-client-email-sales" class="text-gray-600"></span></p>
                            <p><strong class="text-gray-700">Status:</strong> <span id="details-meeting-status-sales" class="font-medium"></span></p>
                        </div>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold mb-2 text-purple-800">Access Details</h3>
                        <div class="space-y-1.5 text-sm">
                            <p><strong class="text-gray-700">Client Code:</strong> <span id="details-client-code-sales" class="text-gray-600 font-mono bg-purple-100 px-1.5 py-0.5 rounded"></span> <button class="copy-code-btn text-purple-500 hover:text-purple-700 text-xs ml-1" aria-label="Copy Client Code"><i class="far fa-copy"></i></button></p>
                            <p><strong class="text-gray-700">Shareable ID:</strong> <span id="details-shareable-id-sales" class="text-gray-600 font-mono bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold"></span> <button class="copy-code-btn text-purple-500 hover:text-purple-700 text-xs ml-1" aria-label="Copy Shareable ID"><i class="far fa-copy"></i></button></p>
                            <p><strong class="text-gray-700">System Meeting ID:</strong> <span id="details-meeting-id-sales" class="text-gray-600 font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs"></span> <button class="copy-code-btn text-purple-500 hover:text-purple-700 text-xs ml-1" aria-label="Copy System Meeting ID"><i class="far fa-copy"></i></button></p>
                            <p><strong class="text-gray-700">Recorder Link:</strong> <a id="details-recorder-link-sales" href="#" target="_blank" class="text-purple-600 hover:underline break-all">Open Recorder</a> <button class="copy-code-btn text-purple-500 hover:text-purple-700 text-xs ml-1" aria-label="Copy Recorder Link"><i class="far fa-copy"></i></button></p>
                        </div>
                    </div>
                    <div class="md:col-span-2 mt-2">
                        <h3 class="text-lg font-semibold mb-2 text-purple-800">Agenda / Notes</h3>
                        <p id="details-meeting-notes-sales" class="text-sm text-gray-600 whitespace-pre-wrap bg-white/50 p-3 rounded-md border border-gray-200 min-h-[50px]"></p>
                    </div>
                </div>
                <div id="analysis-not-available-sales" class="text-center py-8 px-4 bg-gray-50 rounded-lg my-8 hidden">
                    <i class="fas fa-info-circle text-3xl text-gray-400 mb-3"></i>
                    <p class="text-gray-600 font-medium">Meeting analysis is not yet available.</p>
                    <p class="text-sm text-gray-500">Analysis will appear after the recording is processed.</p>
                </div>
                <div id="analysis-content-wrapper-sales" class="hidden">
                    <h3 class="text-xl font-semibold mb-1 text-purple-800">AI-Powered Meeting Insights</h3>
                    <p class="text-sm text-gray-500 mb-6">Review the automatically generated analysis of your meeting.</p>
                    <div class="mb-8">
                        <div class="border-b border-gray-300">
                            <nav class="flex flex-wrap -mb-px" id="analysis-tabs-sales">
                                <button data-tab="summary" class="analysis-tab active">Summary</button>
                                <button data-tab="key-points" class="analysis-tab">Key Points</button>
                                <button data-tab="action-items" class="analysis-tab">Action Items</button>
                                <button data-tab="questions" class="analysis-tab">Client Questions</button>
                                <button data-tab="sentiment" class="analysis-tab">Sentiment</button>
                            </nav>
                        </div>
                    </div>
                    <div class="analysis-content min-h-[300px] analysis-content-bg">
                        <div id="summary-content-panel-sales" class="analysis-panel markdown-content fade-in"></div>
                        <div id="key-points-content-panel-sales" class="analysis-panel markdown-content hidden fade-in"></div>
                        <div id="action-items-content-panel-sales" class="analysis-panel markdown-content hidden fade-in"></div>
                        <div id="questions-content-panel-sales" class="analysis-panel markdown-content hidden fade-in"></div>
                        <div id="sentiment-content-panel-sales" class="analysis-panel markdown-content hidden fade-in"></div>
                    </div>
                    <div class="mt-10 p-7 bg-purple-50/80 rounded-2xl border border-purple-200/70 shadow-lg">
                        <h3 class="text-xl sm:text-2xl font-semibold mb-5 text-purple-800 flex items-center"><i class="fas fa-search-dollar mr-3 text-purple-600"></i>Query Meeting Data</h3>
                        <form id="question-form-sales" class="mb-7">
                            <div class="flex items-center">
                                <input type="text" id="question-input-sales" class="flex-grow p-3.5 border-gray-300 rounded-l-xl custom-input text-base" placeholder="e.g., 'Client concerns?'">
                                <button type="submit" id="ask-button-sales" class="btn-primary-purple text-white px-5 py-3.5 rounded-r-xl btn-hover text-sm">
                                    <span class="button-text"><i class="fas fa-paper-plane mr-2 icon-hover"></i>Ask AI</span>
                                    <span class="button-loader hidden"><i class="fas fa-spinner fa-spin mr-2"></i>Asking...</span>
                                </button>
                            </div>
                        </form>
                        <div id="question-result-wrapper-sales" class="hidden fade-in">
                            <div id="question-result-sales" class="bg-white p-5 rounded-xl shadow-md mb-5 border-gray-200">
                                <div class="mb-2"><strong class="text-gray-700">Q:</strong> <span id="question-text-sales"></span></div>
                                <div><strong class="text-gray-700">A:</strong> <span id="answer-text-sales" class="leading-relaxed"></span></div>
                            </div>
                        </div>
                        <div>
                            <h4 class="font-semibold mb-4 text-purple-700 text-lg">Recent Queries</h4>
                            <div id="question-history-sales" class="space-y-4 max-h-72 overflow-y-auto p-1 custom-scrollbar">
                                 <p class="text-gray-500 italic text-sm text-center py-3">No recent queries for this meeting.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <footer class="bg-gray-800 text-white py-6 text-center mt-auto">
                <p class="text-sm">&copy; <span id="current-year-sales">${new Date().getFullYear()}</span> Meeting Analysis System (Salesperson View). All rights reserved.</p>
            </footer>
        `;
    }
    
    /**
     * Initializes references to DOM elements used by the salesperson view.
     */
    function initDOMReferences() {
        const viewContainer = document.getElementById('salesperson-view-container');
        if (!viewContainer) { console.error("Salesperson view container not found!"); return; }

        meetingListView = viewContainer.querySelector('#meeting-list-view-sales');
        newEditMeetingView = viewContainer.querySelector('#new-edit-meeting-view-sales');
        meetingDetailsView = viewContainer.querySelector('#meeting-details-view-sales');
        newMeetingBtn = viewContainer.querySelector('#new-meeting-btn-sales');
        meetingList = viewContainer.querySelector('#meeting-list-sales');
        noMeetingsMessage = viewContainer.querySelector('#no-meetings-message-sales');
        
        formTitle = viewContainer.querySelector('#form-title-sales');
        newEditMeetingForm = viewContainer.querySelector('#new-edit-meeting-form-sales');
        meetingIdInputHidden = viewContainer.querySelector('#meeting-id-sales-hidden');
        meetingTitleInput = viewContainer.querySelector('#meeting-title-sales-input');
        meetingDateInput = viewContainer.querySelector('#meeting-date-sales-input');
        clientEmailInput = viewContainer.querySelector('#client-email-sales-input');
        meetingNotesInput = viewContainer.querySelector('#meeting-notes-sales-input');
        cancelMeetingFormBtn = viewContainer.querySelector('#cancel-meeting-form-btn-sales');
        saveMeetingBtn = viewContainer.querySelector('#save-meeting-btn-sales');
        newMeetingError = viewContainer.querySelector('#new-meeting-error-sales');
        
        detailsMeetingTitle = viewContainer.querySelector('#details-meeting-title-sales');
        detailsMeetingDate = viewContainer.querySelector('#details-meeting-date-sales');
        detailsClientEmail = viewContainer.querySelector('#details-client-email-sales');
        detailsMeetingStatus = viewContainer.querySelector('#details-meeting-status-sales');
        detailsClientCode = viewContainer.querySelector('#details-client-code-sales');
        detailsShareableIdSales = viewContainer.querySelector('#details-shareable-id-sales');
        detailsMeetingIdSales = viewContainer.querySelector('#details-meeting-id-sales');
        detailsRecorderLinkAnchor = viewContainer.querySelector('#details-recorder-link-sales');
        detailsMeetingNotes = viewContainer.querySelector('#details-meeting-notes-sales');
        editMeetingBtn = viewContainer.querySelector('#edit-meeting-btn-sales');
        deleteMeetingBtn = viewContainer.querySelector('#delete-meeting-btn-sales');
        downloadPdfBtnSales = viewContainer.querySelector('#download-pdf-btn-sales'); 
        
        analysisNotAvailable = viewContainer.querySelector('#analysis-not-available-sales');
        analysisContentWrapper = viewContainer.querySelector('#analysis-content-wrapper-sales');
        analysisTabs = viewContainer.querySelectorAll('#analysis-tabs-sales .analysis-tab'); // Corrected selector
        analysisPanels = { // Ensure these IDs match the getHTML() output
            summary: viewContainer.querySelector('#summary-content-panel-sales'),
            keyPoints: viewContainer.querySelector('#key-points-content-panel-sales'),
            actionItems: viewContainer.querySelector('#action-items-content-panel-sales'),
            questions: viewContainer.querySelector('#questions-content-panel-sales'), // This panel is for client questions identified by AI
            sentiment: viewContainer.querySelector('#sentiment-content-panel-sales'),
        };
        
        questionForm = viewContainer.querySelector('#question-form-sales');
        questionInput = viewContainer.querySelector('#question-input-sales');
        askButton = viewContainer.querySelector('#ask-button-sales');
        questionResultWrapper = viewContainer.querySelector('#question-result-wrapper-sales');
        questionTextEl = viewContainer.querySelector('#question-text-sales');
        answerTextEl = viewContainer.querySelector('#answer-text-sales');
        questionHistory = viewContainer.querySelector('#question-history-sales');
        
        backToListBtn = viewContainer.querySelector('#back-to-list-btn-sales');
        logoutBtnSales = viewContainer.querySelector('#logout-btn-sales');
        mainMenuBtnSales = viewContainer.querySelector('#main-menu-btn-sales');

        const currentYearSpan = viewContainer.querySelector('#current-year-sales');
        if(currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
    }

    /**
     * Shows the specified view section (list, form, details) and hides others.
     * @param {string} viewName - The name of the view to show.
     */
    function showSalesView(viewName) {
        if (!meetingListView || !newEditMeetingView || !meetingDetailsView || !backToListBtn) {
            console.error("Salesperson view elements not fully initialized for showSalesView.");
            return;
        }
        meetingListView.classList.add('hidden');
        newEditMeetingView.classList.add('hidden');
        meetingDetailsView.classList.add('hidden');
        
        if (viewName === 'list') {
            meetingListView.classList.remove('hidden');
            backToListBtn.classList.add('hidden');
        } else if (viewName === 'form') {
            newEditMeetingView.classList.remove('hidden');
            backToListBtn.classList.remove('hidden');
        } else if (viewName === 'details') {
            meetingDetailsView.classList.remove('hidden');
            backToListBtn.classList.remove('hidden');
        }
    }

    /**
     * Fetches meetings if cache is empty or forces a refresh, then renders the meeting list.
     * Uses SharedAppLogic.getMeetings() to benefit from cache updates after CUD operations.
     */
    async function refreshAndRenderMeetings() {
        if (!fetchMeetingsAPI || !noMeetingsMessage || !SharedAppLogic || typeof SharedAppLogic.getMeetings !== 'function') {
            console.error("refreshAndRenderMeetings: Required callbacks or SharedAppLogic.getMeetings not initialized.");
            if (noMeetingsMessage) {
                noMeetingsMessage.textContent = "Error: Meeting service not available.";
                noMeetingsMessage.classList.remove('hidden');
            }
            return;
        }
    
        try {
            // Show loading message while deciding to fetch or use cache
            if (noMeetingsMessage) {
                noMeetingsMessage.textContent = "Loading meetings...";
                noMeetingsMessage.classList.remove('hidden');
                meetingList.innerHTML = ''; // Clear previous items
            }
    
            let currentMeetings = SharedAppLogic.getMeetings();
            if (currentMeetings.length === 0) { // Fetch if cache is empty
                console.log("[SalespersonView] Meetings cache empty, fetching from API...");
                const response = await fetchMeetingsAPI(); // This updates SharedAppLogic.meetingsDataCache
                if (response && response.success) {
                    currentMeetings = SharedAppLogic.getMeetings(); // Get the newly populated cache
                } else {
                    throw new Error(response?.message || "Failed to fetch meetings from server.");
                }
            } else {
                 console.log("[SalespersonView] Using cached meetings.");
            }
            
            meetings = currentMeetings; // Update local 'meetings' variable for this view
            renderSalesMeetingList(); // Render using the (potentially updated) local 'meetings'
    
        } catch (error) {
            console.error('Error in refreshAndRenderMeetings:', error);
            if (noMeetingsMessage) {
                noMeetingsMessage.textContent = "Could not load meetings. Please try refreshing the page.";
                noMeetingsMessage.classList.remove('hidden');
            }
            meetings = []; // Ensure local meetings is empty on error
            renderSalesMeetingList(); // Attempt to render (will show no meetings message)
        }
    }


    /**
     * Renders the list of salesperson's meetings in the UI.
     */
    function renderSalesMeetingList() {
        if (!meetingList || !noMeetingsMessage) {
            console.error("renderSalesMeetingList: meetingList or noMeetingsMessage element not found.");
            return;
        }
        meetingList.innerHTML = ''; // Clear existing list items
        
        if (!Array.isArray(meetings) || meetings.length === 0) { 
            noMeetingsMessage.textContent = 'No meetings scheduled. Click "Schedule New Meeting" to begin.';
            noMeetingsMessage.classList.remove('hidden'); 
            return; 
        }
        
        noMeetingsMessage.classList.add('hidden'); // Hide "no meetings" message if there are meetings
        
        // Sort meetings by date, newest first
        const sortedMeetings = [...meetings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        sortedMeetings.forEach((meeting, index) => {
            const item = document.createElement('div');
            // Using Tailwind classes for styling, ensure these are defined or use your own
            item.className = 'meeting-item-card bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow duration-200 cursor-pointer mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 fade-in';
            item.style.setProperty('--delay', `${index * 0.05}s`);
            item.dataset.id = meeting.id; // The main meeting ID (sm-xxxx)
            
            let statusClass = 'bg-gray-400 text-gray-800'; // Default/unknown status
            const lowerStatus = meeting.status?.toLowerCase();

            if (lowerStatus === 'scheduled') statusClass = 'bg-purple-200 text-purple-800 status-scheduled';
            else if (lowerStatus === 'completed' || lowerStatus === 'analyzed') statusClass = 'bg-green-200 text-green-800 status-completed';
            else if (lowerStatus === 'processing' || lowerStatus === 'uploading_to_backend') statusClass = 'bg-yellow-200 text-yellow-800 status-processing'; 
            else if (lowerStatus === 'recording') statusClass = 'bg-red-200 text-red-800 status-recording'; 
            else if (lowerStatus && lowerStatus.includes('failed')) statusClass = 'bg-red-300 text-red-900 status-failed';


            item.innerHTML = `
                <div class="flex-grow mb-2 sm:mb-0">
                    <h3 class="text-lg font-semibold text-purple-700 mb-1">${escapeHtml(meeting.title)}</h3>
                    <p class="text-sm text-gray-600">With: ${escapeHtml(meeting.clientEmail)}</p>
                    <p class="text-sm text-gray-500">Date: ${new Date(meeting.date).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div class="flex items-center self-start sm:self-center">
                    <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${statusClass}">${escapeHtml(meeting.status)}</span>
                </div>`;
            item.addEventListener('click', () => viewSalesMeetingDetails(meeting.id));
            meetingList.appendChild(item);
        });
    }
    
    /**
     * Opens the form for creating a new meeting.
     */
    function openNewSalesMeetingForm() {
        currentMeetingId = null;
        currentMeetingForAnalysis = null; 
        if(formTitle) formTitle.textContent = 'Schedule New Meeting';
        if(newEditMeetingForm) newEditMeetingForm.reset();
        if(meetingIdInputHidden) meetingIdInputHidden.value = ''; 
        if(newMeetingError) newMeetingError.classList.add('hidden'); // Clear previous errors
        if(meetingDateInput) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9,0,0,0); // Default to 9 AM tomorrow
            try {
                // Format for datetime-local: YYYY-MM-DDTHH:mm
                const year = tomorrow.getFullYear();
                const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
                const day = String(tomorrow.getDate()).padStart(2, '0');
                const hours = String(tomorrow.getHours()).padStart(2, '0');
                const minutes = String(tomorrow.getMinutes()).padStart(2, '0');
                meetingDateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
            } catch(e) { console.error("Error setting default date for new meeting:", e); }
        }
        // Enable inputs that might have been disabled
        if(meetingTitleInput) meetingTitleInput.readOnly = false;
        if(clientEmailInput) clientEmailInput.readOnly = false;
        if(meetingDateInput) meetingDateInput.readOnly = false;
        if(meetingNotesInput) meetingNotesInput.readOnly = false;

        showSalesView('form');
    }

    /**
     * Opens the form for editing an existing meeting.
     * @param {string} id - The ID of the meeting to edit.
     */
    function openEditSalesMeetingForm(id) {
        // Use getMeetingByIdCallback which checks SharedAppLogic.meetingsDataCache
        const meeting = getMeetingByIdCallback(id); 
        if (!meeting) {
            showNotificationCallback("Meeting not found in local cache. Please refresh the list.", "error");
            return;
        }
        currentMeetingId = id;
        currentMeetingForAnalysis = null; 
        if(formTitle) formTitle.textContent = 'Edit Meeting Details';
        if(newEditMeetingForm) newEditMeetingForm.reset();
        if(newMeetingError) newMeetingError.classList.add('hidden'); // Clear previous errors

        if(meetingIdInputHidden) meetingIdInputHidden.value = meeting.id;
        if(meetingTitleInput) meetingTitleInput.value = meeting.title;
        if(meetingDateInput) {
            try {
                // Ensure date from backend is correctly formatted for datetime-local
                const meetingDate = new Date(meeting.date);
                const year = meetingDate.getFullYear();
                const month = String(meetingDate.getMonth() + 1).padStart(2, '0');
                const day = String(meetingDate.getDate()).padStart(2, '0');
                const hours = String(meetingDate.getHours()).padStart(2, '0');
                const minutes = String(meetingDate.getMinutes()).padStart(2, '0');
                meetingDateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
            } catch (e) {
                console.error("Error formatting meeting date for edit form:", e);
                meetingDateInput.value = ''; // Fallback
            }
        }
        if(clientEmailInput) clientEmailInput.value = meeting.clientEmail;
        if(meetingNotesInput) meetingNotesInput.value = meeting.notes || '';
        
        // Decide if fields should be read-only based on meeting status
        const isEditableStatus = !['completed', 'analyzed', 'recording', 'processing'].includes(meeting.status?.toLowerCase());
        if(meetingTitleInput) meetingTitleInput.readOnly = !isEditableStatus;
        if(clientEmailInput) clientEmailInput.readOnly = !isEditableStatus;
        if(meetingDateInput) meetingDateInput.readOnly = !isEditableStatus;
        if(meetingNotesInput) meetingNotesInput.readOnly = !isEditableStatus;
        if(saveMeetingBtn) saveMeetingBtn.disabled = !isEditableStatus;


        showSalesView('form');
    }

    /**
     * Handles saving a new or edited meeting.
     * Performs client-side validation and calls the appropriate API.
     * @param {Event} e - The form submission event.
     */
    async function handleSaveMeeting(e) { 
        e.preventDefault();
        if (!saveMeetingBtn || !newMeetingError || !createMeetingAPI || !updateMeetingAPI || !SharedAppLogic) {
            console.error("handleSaveMeeting: Critical components or callbacks not initialized.");
            showNotificationCallback("Cannot save meeting: system error.", "error");
            return;
        }
        
        setButtonLoadingStateCallback(saveMeetingBtn, true);
        newMeetingError.classList.add('hidden'); // Hide previous errors

        try {
            const meetingId = meetingIdInputHidden.value; // Will be empty for new meetings
            const title = meetingTitleInput.value.trim();
            const dateString = meetingDateInput.value;
            const clientEmail = clientEmailInput.value.trim().toLowerCase();
            const notes = meetingNotesInput.value.trim();

            // Client-side validation
            if (!title || !dateString || !clientEmail) {
                throw new Error('Meeting Title, Date & Time, and Client Email are required.');
            }
            if (title.length < 3) {
                throw new Error('Meeting Title must be at least 3 characters long.');
            }
            if (new Date(dateString) < new Date() && !meetingId) { // Only for new meetings, allow editing past dates
                 // throw new Error('Meeting date cannot be in the past for new meetings.');
                 // Relaxed this for now, backend might enforce if needed.
            }
            if (!/\S+@\S+\.\S+/.test(clientEmail)) {
                throw new Error('Invalid Client Email format.');
            }

            const meetingDetails = { title, date: dateString, clientEmail, notes };
            let response;

            if (meetingId) { // Editing existing meeting
                response = await updateMeetingAPI(meetingId, meetingDetails);
            } else { // Creating new meeting
                response = await createMeetingAPI(meetingDetails);
            }

            if (response && response.success) {
                showNotificationCallback(`Meeting ${meetingId ? 'updated' : 'created'} successfully!`, 'success');
                // SharedAppLogic CUD functions now update the cache, so just re-render from cache.
                meetings = SharedAppLogic.getMeetings(); // Get updated cache
                renderSalesMeetingList(); // Re-render the list
                showSalesView('list'); // Switch back to the list view
            } else {
                throw new Error(response?.message || `Failed to ${meetingId ? 'update' : 'create'} meeting.`);
            }

        } catch (error) {
            console.error('Error saving meeting:', error);
            newMeetingError.textContent = error.message;
            newMeetingError.classList.remove('hidden');
            showNotificationCallback(error.message, 'error');
        } finally {
            setButtonLoadingStateCallback(saveMeetingBtn, false);
        }
    }

    /**
     * Displays the details and analysis of a selected meeting.
     * @param {string} id - The ID of the meeting to view.
     */
    async function viewSalesMeetingDetails(id) { 
        if (!getMeetingByIdCallback || !fetchAnalysisDataAPI || !SharedAppLogic) {
            console.error("viewSalesMeetingDetails: Critical callbacks not initialized.");
            showNotificationCallback("Cannot view meeting details: system error.", "error");
            return;
        }

        let meeting = getMeetingByIdCallback(id); // Check cache first
        
        if (!meeting) { 
            showNotificationCallback("Meeting details not in cache. Refreshing from server...", "warning");
            const fetchResponse = await fetchMeetingsAPI(); // This updates SharedAppLogic.meetingsDataCache
            if (fetchResponse && fetchResponse.success) {
                meeting = getMeetingByIdCallback(id); // Try getting from updated cache
            }
            if (!meeting) {
                showNotificationCallback("Meeting not found even after refresh. It might have been deleted.", "error");
                refreshAndRenderMeetings(); // Go back to list and re-render
                showSalesView('list');
                return;
            }
        }
        currentMeetingForAnalysis = { ...meeting }; // Make a copy for local manipulation if needed
        currentMeetingId = currentMeetingForAnalysis.id; // Ensure currentMeetingId is set

        // Populate basic meeting details
        if(detailsMeetingTitle) detailsMeetingTitle.textContent = escapeHtml(currentMeetingForAnalysis.title);
        if(detailsMeetingDate) detailsMeetingDate.textContent = new Date(currentMeetingForAnalysis.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
        if(detailsClientEmail) detailsClientEmail.textContent = escapeHtml(currentMeetingForAnalysis.clientEmail);
        if(detailsMeetingStatus) {
            detailsMeetingStatus.textContent = escapeHtml(currentMeetingForAnalysis.status);
            // Apply dynamic styling based on status (similar to renderSalesMeetingList)
            const statusClass = currentMeetingForAnalysis.status?.toLowerCase() === 'scheduled' ? 'text-purple-600' : 
                                currentMeetingForAnalysis.status?.toLowerCase() === 'completed' || currentMeetingForAnalysis.status?.toLowerCase() === 'analyzed' ? 'text-green-600' :  
                                (currentMeetingForAnalysis.status?.toLowerCase() === 'processing' || currentMeetingForAnalysis.status?.toLowerCase() === 'uploading_to_backend') ? 'text-yellow-600' : 
                                currentMeetingForAnalysis.status?.toLowerCase() === 'recording' ? 'text-red-600' :
                                'text-gray-600';
            detailsMeetingStatus.className = `font-medium ${statusClass}`;
        }
        if(detailsClientCode) detailsClientCode.textContent = escapeHtml(currentMeetingForAnalysis.clientCode || 'N/A');
        if(detailsShareableIdSales) detailsShareableIdSales.textContent = escapeHtml(currentMeetingForAnalysis.shareableMeetingId || 'N/A');
        if(detailsMeetingIdSales) detailsMeetingIdSales.textContent = escapeHtml(currentMeetingForAnalysis.id || 'N/A');
        if(detailsRecorderLinkAnchor) {
            const recorderLink = currentMeetingForAnalysis.recorderLink || "#";
            detailsRecorderLinkAnchor.href = recorderLink;
            detailsRecorderLinkAnchor.setAttribute('data-link', recorderLink); // Store for copy
        }
        if(detailsMeetingNotes) detailsMeetingNotes.textContent = escapeHtml(currentMeetingForAnalysis.notes || 'No notes provided.');

        // Reset analysis section
        if (downloadPdfBtnSales) downloadPdfBtnSales.classList.add('hidden'); 
        if (analysisContentWrapper) analysisContentWrapper.classList.add('hidden');
        if (analysisNotAvailable) analysisNotAvailable.classList.add('hidden');
        Object.values(analysisPanels).forEach(p => { if(p) p.innerHTML = ''; }); // Clear previous panel content

        // Fetch and display analysis data if applicable
        const lowerStatus = currentMeetingForAnalysis.status?.toLowerCase();
        if ((lowerStatus === 'completed' || lowerStatus === 'analyzed') && currentMeetingForAnalysis.recordingId) {
            if(analysisContentWrapper) analysisContentWrapper.classList.remove('hidden'); 
            Object.values(analysisPanels).forEach(p => { if(p) p.innerHTML = '<p class="text-center p-4 text-gray-500 italic">Loading analysis...</p>'; });

            try {
                const analysisDataResponse = await fetchAnalysisDataAPI(currentMeetingForAnalysis.recordingId);
                // analysisDataResponse is the already shaped data for salesperson from backend
                if (analysisDataResponse) { 
                    currentMeetingForAnalysis.analysisData = analysisDataResponse; 
                    populateSalesAnalysisData(analysisDataResponse);
                    if(downloadPdfBtnSales) downloadPdfBtnSales.classList.remove('hidden');
                } else {
                    throw new Error("No analysis data returned from API, though meeting status is completed.");
                }
            } catch (error) {
                console.error("Error fetching analysis data for meeting details:", error);
                if(analysisContentWrapper) analysisContentWrapper.classList.add('hidden');
                if(analysisNotAvailable) {
                    analysisNotAvailable.classList.remove('hidden');
                    analysisNotAvailable.querySelector('p:first-of-type').textContent = "Failed to load meeting analysis.";
                    analysisNotAvailable.querySelector('p:last-of-type').textContent = error.message || "Please try again later or contact support.";
                }
            }
        } else { 
            if(analysisContentWrapper) analysisContentWrapper.classList.add('hidden');
            if(analysisNotAvailable) {
                analysisNotAvailable.classList.remove('hidden');
                const p1 = analysisNotAvailable.querySelector('p:first-of-type');
                const p2 = analysisNotAvailable.querySelector('p:last-of-type');
                if(lowerStatus === 'scheduled') {
                    if(p1) p1.textContent = "This meeting is scheduled for the future.";
                    if(p2) p2.textContent = "Analysis will be available after the meeting is recorded and processed.";
                } else if (lowerStatus === 'processing' || lowerStatus === 'uploading_to_backend' || lowerStatus === 'recording'){
                     if(p1) p1.textContent = "Meeting analysis is currently processing or recording ongoing.";
                    if(p2) p2.textContent = "Please check back later. You can refresh the meetings list for status updates.";
                } else { 
                    if(p1) p1.textContent = "Meeting analysis is not yet available for this meeting.";
                    if(p2) p2.textContent = "Ensure the recording has been successfully processed.";
                }
            }
        }
        questionHistoryArray = []; // Reset Q&A history for the new meeting
        renderSalesQuestionHistory(); // Render empty history
        if(questionResultWrapper) questionResultWrapper.classList.add('hidden'); // Hide previous Q&A result
        if(questionInput) questionInput.value = ''; // Clear question input

        showSalesView('details');
    }
    
    /**
     * Populates the analysis tabs with data received from the backend.
     * @param {object} analysisData - The analysis data object.
     */
    function populateSalesAnalysisData(analysisData) { 
        if(!analysisPanels || !analysisData) {
            Object.values(analysisPanels).forEach(p => { if(p) p.innerHTML = '<p class="text-center p-4 text-red-500">Analysis data is missing or corrupt.</p>'; });
            return;
        }
        // Backend shapes data for salesperson role. Access directly.
        // analysisData directly contains: transcript, generalSummary, salespersonAnalysis, clientAnalysis
        const sa = analysisData.salespersonAnalysis || {}; // Salesperson specific part
        const ca = analysisData.clientAnalysis || {};   // Client specific part (might be useful for salesperson too)

        analysisPanels.summary.innerHTML = sa.tailoredSummary || analysisData.generalSummary || "<p class='text-gray-500 italic p-2'>Summary not available.</p>";
        analysisPanels.keyPoints.innerHTML = sa.keyPoints && sa.keyPoints.length > 0 ? formatList(sa.keyPoints) : "<p class='text-gray-500 italic p-2'>Key points not available.</p>";
        analysisPanels.actionItems.innerHTML = sa.actionItems && sa.actionItems.length > 0 ? formatActionItems(sa.actionItems) : "<p class='text-gray-500 italic p-2'>Action items not available.</p>";
        analysisPanels.questions.innerHTML = sa.identifiedClientQuestions && sa.identifiedClientQuestions.length > 0 ? formatList(sa.identifiedClientQuestions, "Identified Client Questions:") : "<p class='text-gray-500 italic p-2'>No specific client questions identified by AI.</p>";
        analysisPanels.sentiment.innerHTML = sa.sentimentAnalysis ? formatSentiment(sa.sentimentAnalysis) : "<p class='text-gray-500 italic p-2'>Sentiment analysis not available.</p>";

        // Ensure the first tab is active and its panel visible
        if(analysisTabs && analysisTabs.length > 0) {
            analysisTabs.forEach(t => t.classList.remove('active'));
            analysisTabs[0].classList.add('active'); // Default to first tab (Summary)
        }
        Object.values(analysisPanels).forEach(p => { if(p) p.classList.add('hidden'); });
        if(analysisPanels.summary) analysisPanels.summary.classList.remove('hidden');
    }

    // Helper to format a list of strings into an HTML unordered list
    function formatList(items, title = null) {
        if (!Array.isArray(items) || items.length === 0) return `<p class='text-gray-500 italic p-2'>${title ? title + ' N' : 'N'}ot available.</p>`;
        let html = title ? `<h4 class="font-semibold text-md text-gray-700 mb-2">${escapeHtml(title)}</h4>` : '';
        html += `<ul class="list-disc list-inside space-y-1 text-sm text-gray-600">`;
        items.forEach(item => {
            html += `<li>${escapeHtml(typeof item === 'string' ? item : JSON.stringify(item))}</li>`;
        });
        html += `</ul>`;
        return html;
    }
    // Helper to format action items (assuming items are objects like { assignee, task, dueDate })
    function formatActionItems(items) {
        if (!Array.isArray(items) || items.length === 0) return "<p class='text-gray-500 italic p-2'>No action items identified.</p>";
        let html = `<ol class="list-decimal list-inside space-y-2 text-sm text-gray-600">`;
        items.forEach(item => {
            html += `<li><strong>${escapeHtml(item.assignee || 'Unassigned')}:</strong> ${escapeHtml(item.task)}${item.dueDate ? ` <span class="text-xs text-gray-500">(Due: ${escapeHtml(item.dueDate)})</span>` : ''}</li>`;
        });
        html += `</ol>`;
        return html;
    }
    // Helper to format sentiment analysis data
    function formatSentiment(sentiment) {
        if (typeof sentiment !== 'object' || sentiment === null) return "<p class='text-gray-500 italic p-2'>Sentiment data not available.</p>";
        let html = `<div class="space-y-3 text-sm">`;
        html += `<p><strong class="text-gray-700">Overall Sentiment:</strong> <span class="font-medium ${sentiment.overall?.toLowerCase() === 'positive' ? 'text-green-600' : sentiment.overall?.toLowerCase() === 'negative' ? 'text-red-600' : 'text-yellow-600'}">${escapeHtml(sentiment.overall || 'N/A')}</span></p>`;
        
        if (sentiment.trendOverTime && Array.isArray(sentiment.trendOverTime) && sentiment.trendOverTime.length > 0) {
            html += `<div><strong class="text-gray-700 block mb-1">Sentiment Trend:</strong><ul class="list-disc list-inside space-y-1">`;
            sentiment.trendOverTime.forEach(s => {
                html += `<li>${escapeHtml(s.segment || 'Segment')}: ${escapeHtml(s.sentiment)}</li>`;
            });
            html += `</ul></div>`;
        }
        if (sentiment.keywords && Array.isArray(sentiment.keywords) && sentiment.keywords.length > 0) {
            html += `<div><strong class="text-gray-700 block mb-1">Key Sentiment Drivers (Keywords):</strong><ul class="list-disc list-inside space-y-1">`;
            sentiment.keywords.forEach(k => {
                html += `<li><strong>${escapeHtml(k.term)}:</strong> ${escapeHtml(k.sentiment)} <span class="text-xs text-gray-500">(Mentions: ${k.mentions || 1})</span></li>`;
            });
            html += `</ul></div>`;
        }
        html += `</div>`;
        return html;
    }
    // Utility to escape HTML special characters
    function escapeHtml(unsafe) { 
        if (typeof unsafe !== 'string') {
            if (unsafe === null || unsafe === undefined) return '';
            try {
                return String(unsafe)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            } catch (e) { return '';}
        }
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    /**
     * Handles deleting the currently viewed meeting after confirmation.
     */
    async function handleDeleteSalesMeeting() {
        if (!currentMeetingId || !deleteMeetingAPI || !SharedAppLogic) {
            showNotificationCallback("No meeting selected or delete function unavailable.", "error");
            return;
        }
        
        const meetingToDelete = getMeetingByIdCallback(currentMeetingId); // Get from cache for title
        if (!meetingToDelete) { // Should not happen if currentMeetingId is set from a valid meeting
            showNotificationCallback("Meeting to delete not found. Please refresh.", "error");
            return;
        }

        if (!confirm(`Are you sure you want to delete the meeting "${escapeHtml(meetingToDelete.title)}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            if(deleteMeetingBtn) setButtonLoadingStateCallback(deleteMeetingBtn, true); 
            await deleteMeetingAPI(currentMeetingId); // This updates SharedAppLogic.meetingsDataCache
            showNotificationCallback("Meeting deleted successfully.", "info");
            
            meetings = SharedAppLogic.getMeetings(); // Get updated cache
            renderSalesMeetingList(); // Re-render list
            showSalesView('list'); // Switch to list view
            currentMeetingId = null; 
            currentMeetingForAnalysis = null;
        } catch (error) {
            console.error("Failed to delete meeting:", error);
            showNotificationCallback("Failed to delete meeting: " + (error.message || "Unknown error"), "error");
        } finally {
            if(deleteMeetingBtn) setButtonLoadingStateCallback(deleteMeetingBtn, false);
        }
    }

    /**
     * Handles submitting a question about the current meeting's analysis.
     * @param {Event} e - The form submission event.
     */
    async function handleSalesQuestion(e){
        e.preventDefault();
        if (!questionInput || !askButton || !queryAnalysisAPI) {
            console.error("handleSalesQuestion: Q&A DOM elements or API callback missing.");
            return;
        }
        const question = questionInput.value.trim();
        if(!question) { 
            showNotificationCallback("Please type your query into the question box.", "warning"); 
            return; 
        }
        if (!currentMeetingForAnalysis || !currentMeetingForAnalysis.recordingId) {
            showNotificationCallback("No active meeting context for Q&A. Please view a completed meeting's details first.", "error");
            return;
        }
        if (currentMeetingForAnalysis.status?.toLowerCase() !== 'completed' && currentMeetingForAnalysis.status?.toLowerCase() !== 'analyzed') {
            showNotificationCallback("Q&A is only available for meetings with completed analysis.", "warning");
            return;
        }

        if(askButton) setButtonLoadingStateCallback(askButton, true);
        if(questionResultWrapper) questionResultWrapper.classList.add('hidden'); // Hide previous result

        try {
            const response = await queryAnalysisAPI(currentMeetingForAnalysis.recordingId, question);
            if (response && response.success && typeof response.answer !== 'undefined') {
                if(questionTextEl) questionTextEl.textContent = question;
                if(answerTextEl) answerTextEl.innerHTML = escapeHtml(response.answer).replace(/\n/g, '<br>'); // Display answer, basic formatting
                if(questionResultWrapper) questionResultWrapper.classList.remove('hidden');
                
                questionHistoryArray.unshift({question: question, answer: response.answer});
                if(questionHistoryArray.length > 5) questionHistoryArray.pop(); // Keep last 5
                renderSalesQuestionHistory();
                if(questionInput) questionInput.value = ''; 
                showNotificationCallback("AI has answered your question.", "success");
            } else {
                throw new Error(response?.message || "No answer received or an error occurred with the AI query.");
            }
        } catch (error) {
             console.error("Error querying analysis:", error);
             if(questionTextEl) questionTextEl.textContent = question; // Show the question that failed
             if(answerTextEl) answerTextEl.textContent = `Error fetching answer: ${error.message}`;
             if(questionResultWrapper) questionResultWrapper.classList.remove('hidden');
             showNotificationCallback("Error getting answer: " + error.message, "error");
        } finally {
            if(askButton) setButtonLoadingStateCallback(askButton, false);
        }
    }

    /**
     * Renders the history of questions and answers for the current meeting.
     */
    function renderSalesQuestionHistory(){ 
        if (!questionHistory) return;
        questionHistory.innerHTML = ''; 
        if (questionHistoryArray.length === 0) { 
            questionHistory.innerHTML = '<p class="text-gray-500 italic text-sm text-center py-3">No recent queries for this meeting.</p>'; 
            return; 
        }
        questionHistoryArray.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'bg-white/70 p-3.5 rounded-lg shadow-sm border border-gray-200 text-sm fade-in';
            historyItem.style.setProperty('--delay', `${index * 0.05}s`); // Staggered fade-in
            historyItem.innerHTML = `
                <p class="mb-1.5"><strong class="text-gray-700">Q:</strong> ${escapeHtml(item.question)}</p>
                <p class="text-gray-600 leading-relaxed"><strong class="text-gray-700">A:</strong> ${escapeHtml(item.answer).replace(/\n/g, '<br>')}</p> 
            `; 
            questionHistory.appendChild(historyItem);
        });
    }

    /**
     * Handles the download of the PDF analysis report for the current meeting.
     */
    async function handleDownloadSalespersonPdf() { 
        if (!currentMeetingForAnalysis || !currentMeetingForAnalysis.recordingId || !downloadAnalysisPdfAPI || !downloadPdfBtnSales) {
            showNotificationCallback("No meeting selected or download function unavailable.", "warning");
            return;
        }
        const lowerStatus = currentMeetingForAnalysis.status?.toLowerCase();
        if (lowerStatus !== 'completed' && lowerStatus !== 'analyzed') {
             showNotificationCallback("PDF report is only available for meetings with completed analysis.", "warning");
            return;
        }
        
        // Ensure analysisData is loaded on currentMeetingForAnalysis if PDF generation needs it (backend might re-fetch anyway)
        if (!currentMeetingForAnalysis.analysisData) { 
            showNotificationCallback("Analysis data not fully loaded for PDF. Attempting to fetch...", "info");
            try {
                const analysisDataResponse = await fetchAnalysisDataAPI(currentMeetingForAnalysis.recordingId);
                if (!analysisDataResponse) throw new Error("Analysis data is empty or could not be fetched for PDF generation.");
                currentMeetingForAnalysis.analysisData = analysisDataResponse; 
            } catch (error) {
                 showNotificationCallback("Failed to fetch necessary analysis data for PDF generation: " + error.message, "error");
                 return;
            }
        }
        
        try {
            setButtonLoadingStateCallback(downloadPdfBtnSales, true); 
            // downloadAnalysisPdfAPI in SharedAppLogic handles the blob response and triggers download
            await downloadAnalysisPdfAPI(currentMeetingForAnalysis.recordingId);
            // Success notification is handled within downloadAnalysisPdfAPI
        } catch (error) {
            console.error("Salesperson PDF Download trigger failed:", error);
            showNotificationCallback("Failed to download PDF report: " + (error.message || "Unknown error"), "error");
        } finally {
            setButtonLoadingStateCallback(downloadPdfBtnSales, false);
        }
    }
    
    /**
     * Sets up all event listeners for the salesperson view.
     */
    function setupEventListeners() {
        if (!newMeetingBtn || !cancelMeetingFormBtn || !newEditMeetingForm || !editMeetingBtn || 
            !deleteMeetingBtn || !backToListBtn || !mainMenuBtnSales || !logoutBtnSales || 
            !analysisTabs || !questionForm || !downloadPdfBtnSales || !meetingTitleInput /* for error clearing */) { 
            console.error("Salesperson DOM not fully initialized for event listeners. One or more elements are missing."); 
            return; 
        }
        newMeetingBtn.addEventListener('click', openNewSalesMeetingForm);
        cancelMeetingFormBtn.addEventListener('click', () => {
            refreshAndRenderMeetings(); // Refresh list when cancelling form
            showSalesView('list');
        });
        newEditMeetingForm.addEventListener('submit', handleSaveMeeting);
        editMeetingBtn.addEventListener('click', () => { if(currentMeetingId) openEditSalesMeetingForm(currentMeetingId); });
        deleteMeetingBtn.addEventListener('click', handleDeleteSalesMeeting);
        
        backToListBtn.addEventListener('click', () => {
            refreshAndRenderMeetings(); // Refresh list when going back
            showSalesView('list');
        });
        
        mainMenuBtnSales.addEventListener('click', () => {
            if (switchViewCallback) switchViewCallback('index'); 
            else console.error("mainMenuBtnSales: switchViewCallback not defined.");
        });
        logoutBtnSales.addEventListener('click', async () => { 
            if (SharedAppLogic && SharedAppLogic.logoutAPI) {
                await SharedAppLogic.logoutAPI(); 
                // SharedAppLogic.logoutAPI should handle notifications and redirection
            } else {
                console.error("logoutBtnSales: SharedAppLogic.logoutAPI not available.");
                showNotificationCallback("Logout failed: system error.", "error");
            }
        });

        analysisTabs.forEach(tab => { 
            tab.addEventListener('click', () => {
                if (!analysisPanels) return;
                analysisTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const targetPanelKey = tab.dataset.tab; // e.g., "summary", "key-points"
                Object.values(analysisPanels).forEach(panel => { if(panel) panel.classList.add('hidden'); });
                if(analysisPanels[targetPanelKey]) {
                    analysisPanels[targetPanelKey].classList.remove('hidden');
                } else {
                    console.warn(`Analysis panel for tab "${targetPanelKey}" not found.`);
                }
            });
        });
        
        if(questionForm) questionForm.addEventListener('submit', handleSalesQuestion);
        if(downloadPdfBtnSales) downloadPdfBtnSales.addEventListener('click', handleDownloadSalespersonPdf);
        
        // Clear form validation error on input
        const clearErrorOnInput = () => { if(newMeetingError) newMeetingError.classList.add('hidden'); };
        if(meetingTitleInput) meetingTitleInput.addEventListener('input', clearErrorOnInput);
        if(meetingDateInput) meetingDateInput.addEventListener('input', clearErrorOnInput);
        if(clientEmailInput) clientEmailInput.addEventListener('input', clearErrorOnInput);


        // Event delegation for copy buttons inside meetingDetailsView (if it's re-rendered often, though not in this setup)
        // Direct binding is fine since meetingDetailsView content is populated, not fully re-rendered.
        const detailsViewContainer = document.getElementById('meeting-details-view-sales');
        if (detailsViewContainer) {
            detailsViewContainer.addEventListener('click', (event) => {
                const button = event.target.closest('.copy-code-btn');
                if (button) {
                    const targetElement = button.previousElementSibling; // Assumes span or anchor is direct sibling
                    let textToCopy;
                    let labelText = "Content";

                    if (targetElement && targetElement.tagName === 'A' && targetElement.id === 'details-recorder-link-sales') {
                        textToCopy = targetElement.dataset.link || targetElement.href; 
                        // Ensure full URL for recorder link if it's relative
                        if (textToCopy && textToCopy.startsWith('recorder.html')) {
                             const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
                             textToCopy = window.location.origin + basePath + textToCopy;
                        } else if (textToCopy && textToCopy.startsWith('/')) { // Relative from root
                             textToCopy = window.location.origin + textToCopy;
                        }
                        labelText = "Recorder Link";
                    } else if (targetElement && targetElement.tagName === 'SPAN') {
                        textToCopy = targetElement.textContent;
                        if(targetElement.previousElementSibling && targetElement.previousElementSibling.tagName === 'STRONG'){
                            labelText = targetElement.previousElementSibling.textContent.replace(':','').trim();
                        }
                    }

                    if (textToCopy && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                        navigator.clipboard.writeText(textToCopy)
                            .then(() => showNotificationCallback(`${labelText} copied to clipboard!`, 'success'))
                            .catch(err => {
                                console.error('Failed to copy with clipboard API:', err);
                                showNotificationCallback('Failed to copy text.', 'error');
                            });
                    } else if (textToCopy) { // Fallback for older browsers (less secure, more intrusive)
                        const textArea = document.createElement("textarea");
                        textArea.value = textToCopy;
                        textArea.style.position = "fixed"; textArea.style.left = "-9999px"; // Off-screen
                        document.body.appendChild(textArea);
                        textArea.focus(); textArea.select();
                        try {
                            document.execCommand('copy');
                            showNotificationCallback(`${labelText} copied to clipboard! (fallback)`, 'success');
                        } catch (err) {
                            console.error('Fallback copy failed:', err);
                            showNotificationCallback('Failed to copy text using fallback.', 'error');
                        }
                        document.body.removeChild(textArea);
                    } else {
                        showNotificationCallback('Nothing to copy for this element.', 'warning');
                    }
                }
            });
        }
    }

    // Publicly exposed methods of the SalespersonView module
    return {
        /**
         * Initializes the SalespersonView module.
         * Sets up callbacks, DOM references, event listeners, and initial data load.
         */
        init: (
            _notifyCb, _switchCb, 
            _genIdCb, _genRecLinkCb, // Note: _genIdCb, _genRecLinkCb are passed but not directly used by SalespersonView
            _fetchMeetingsAPICb, _createMeetingAPICb, _updateMeetingAPICb, _deleteMeetingAPICb, 
            _fetchAnalysisAPICb, _queryAnalysisAPICb, _downloadPdfAPICb,
            _setLoadStateCb, _getMeetingByIdCb 
        ) => {
            // Assign callbacks from SharedAppLogic
            showNotificationCallback = _notifyCb;
            switchViewCallback = _switchCb;
            setButtonLoadingStateCallback = _setLoadStateCb;
            getMeetingByIdCallback = _getMeetingByIdCb; // Used to get meeting from shared cache

            fetchMeetingsAPI = _fetchMeetingsAPICb;
            createMeetingAPI = _createMeetingAPICb;
            updateMeetingAPI = _updateMeetingAPICb;
            deleteMeetingAPI = _deleteMeetingAPICb;
            fetchAnalysisDataAPI = _fetchAnalysisAPICb;
            queryAnalysisAPI = _queryAnalysisAPICb;
            downloadAnalysisPdfAPI = _downloadPdfAPICb;
            
            // Setup the view
            initDOMReferences(); 
            setupEventListeners();
            
            // Initial data load and view display
            refreshAndRenderMeetings(); // Fetch/use cache and render the initial list
            showSalesView('list'); // Default to the meeting list view
        },
        getHTML // Expose getHTML to allow injection by the main page script
    };
})();
