    // /js/salesperson-view.js
    const SalespersonView = (() => {
        let meetings = []; // Local cache of meetings, fetched from backend
        
        // Callbacks from SharedAppLogic
        let showNotificationCallback;
        let switchViewCallback;
        let setButtonLoadingStateCallback;
        let getMeetingByIdCallback; // From SharedAppLogic, searches SharedAppLogic's meetingsDataCache

        // API interaction callbacks from SharedAppLogic
        let fetchMeetingsAPI;
        let createMeetingAPI;
        let updateMeetingAPI;
        let deleteMeetingAPI;
        let fetchAnalysisDataAPI;
        let queryAnalysisAPI;
        let downloadAnalysisPdfAPI;
        // generateIdCallback and generateRecorderLinkCallback are less critical now as backend handles this
        // but can be kept if frontend needs to display something optimistically.
        let generateIdCallback; 
        let generateRecorderLinkCallback; 

        let currentMeetingId = null; // Stores the ID of the meeting being edited or viewed in detail
        let currentMeetingForAnalysis = null; // Stores the full meeting object when its details/analysis are viewed
        let questionHistoryArray = [];

        // DOM Elements
        let meetingListView, newEditMeetingView, meetingDetailsView, newMeetingBtn, meetingList, noMeetingsMessage;
        let formTitle, newEditMeetingForm, meetingIdInputHidden, meetingTitleInput, meetingDateInput, clientEmailInput, meetingNotesInput, cancelMeetingFormBtn, saveMeetingBtn, newMeetingError;
        let detailsMeetingTitle, detailsMeetingDate, detailsClientEmail, detailsMeetingStatus, detailsClientCode, detailsRecorderLinkAnchor, detailsMeetingNotes, editMeetingBtn, deleteMeetingBtn, downloadPdfBtnSales;
        let analysisNotAvailable, analysisContentWrapper, analysisTabs, analysisPanels;
        let questionForm, questionInput, askButton, questionResultWrapper, questionTextEl, answerTextEl, questionHistory;
        let backToListBtn, logoutBtnSales, mainMenuBtnSales;

        function getHTML() {
            // HTML structure includes the "Download PDF Report" button
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
                                <nav class="flex flex-wrap -mb-px">
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
                </div>
            </main>
            <footer class="bg-gray-800 text-white py-6 text-center mt-auto">
                <p class="text-sm">&copy; <span id="current-year-sales"></span> Meeting Analysis System (Salesperson View). All rights reserved.</p>
            </footer>
        `;
    }
    
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
        detailsRecorderLinkAnchor = viewContainer.querySelector('#details-recorder-link-sales');
        detailsMeetingNotes = viewContainer.querySelector('#details-meeting-notes-sales');
        editMeetingBtn = viewContainer.querySelector('#edit-meeting-btn-sales');
        deleteMeetingBtn = viewContainer.querySelector('#delete-meeting-btn-sales');
        downloadPdfBtnSales = viewContainer.querySelector('#download-pdf-btn-sales'); 
        analysisNotAvailable = viewContainer.querySelector('#analysis-not-available-sales');
        analysisContentWrapper = viewContainer.querySelector('#analysis-content-wrapper-sales');
        analysisTabs = viewContainer.querySelectorAll('#meeting-details-view-sales .analysis-tab');
        analysisPanels = {
            summary: viewContainer.querySelector('#summary-content-panel-sales'),
            keyPoints: viewContainer.querySelector('#key-points-content-panel-sales'),
            actionItems: viewContainer.querySelector('#action-items-content-panel-sales'),
            questions: viewContainer.querySelector('#questions-content-panel-sales'),
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

    function showSalesView(viewName) {
        if (!meetingListView || !newEditMeetingView || !meetingDetailsView || !backToListBtn) {return;}
        meetingListView.classList.add('hidden');
        newEditMeetingView.classList.add('hidden');
        meetingDetailsView.classList.add('hidden');
        backToListBtn.classList.add('hidden');
        if (viewName === 'list') meetingListView.classList.remove('hidden');
        else if (viewName === 'form') { newEditMeetingView.classList.remove('hidden'); backToListBtn.classList.remove('hidden');}
        else if (viewName === 'details') { meetingDetailsView.classList.remove('hidden'); backToListBtn.classList.remove('hidden');}
    }

    async function refreshMeetingsDisplay() {
        if (!fetchMeetingsAPI) {
            console.error("fetchMeetingsAPI callback not initialized in SalespersonView.");
            if (noMeetingsMessage) noMeetingsMessage.textContent = "Error: Meeting service not available.";
            return;
        }
        try {
            if (noMeetingsMessage) {
                noMeetingsMessage.textContent = "Fetching meetings...";
                noMeetingsMessage.classList.remove('hidden'); // Show fetching message
            }
            meetings = await fetchMeetingsAPI(); 
            renderSalesMeetingList(); // This will hide noMeetingsMessage if meetings are found
        } catch (error) {
            if (noMeetingsMessage) {
                noMeetingsMessage.textContent = "Could not load meetings. Please try refreshing.";
                noMeetingsMessage.classList.remove('hidden');
            }
        }
    }

    function renderSalesMeetingList() {
        if (!meetingList || !noMeetingsMessage) return;
        meetingList.innerHTML = '';
        
        if (!Array.isArray(meetings) || meetings.length === 0) { 
            if (noMeetingsMessage) {
                noMeetingsMessage.textContent = 'No meetings scheduled. Click "Schedule New Meeting" to begin.';
                noMeetingsMessage.classList.remove('hidden'); 
            }
            return; 
        }
        if (noMeetingsMessage) noMeetingsMessage.classList.add('hidden');
        
        const sortedMeetings = [...meetings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        sortedMeetings.forEach((meeting, index) => {
            const item = document.createElement('div');
            item.className = 'meeting-item-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 fade-in';
            item.style.setProperty('--delay', `${index * 0.05}s`);
            item.dataset.id = meeting.id; 
            
            let statusClass = 'status-cancelled'; 
            if (meeting.status === 'Scheduled') statusClass = 'status-scheduled';
            else if (meeting.status === 'Completed') statusClass = 'status-completed';
            else if (meeting.status === 'Processing') statusClass = 'status-processing'; 
            else if (meeting.status === 'Recording') statusClass = 'status-recording'; 

            item.innerHTML = `
                <div class="flex-grow">
                    <h3 class="text-lg font-semibold text-purple-700 mb-1">${escapeHtml(meeting.title)}</h3>
                    <p class="text-sm text-gray-600">With: ${escapeHtml(meeting.clientEmail)}</p>
                    <p class="text-sm text-gray-500">Date: ${new Date(meeting.date).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div class="flex items-center mt-2 sm:mt-0">
                    <span class="status-indicator ${statusClass} mr-2"></span>
                    <span class="text-sm font-medium text-gray-700">${escapeHtml(meeting.status)}</span>
                </div>`;
            item.addEventListener('click', () => viewSalesMeetingDetails(meeting.id));
            meetingList.appendChild(item);
        });
    }
    
    function openNewSalesMeetingForm() {
        currentMeetingId = null;
        currentMeetingForAnalysis = null; 
        if(formTitle) formTitle.textContent = 'Schedule New Meeting';
        if(newEditMeetingForm) newEditMeetingForm.reset();
        if(meetingIdInputHidden) meetingIdInputHidden.value = ''; 
        if(meetingDateInput) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9,0,0,0);
            try {
                meetingDateInput.value = tomorrow.toISOString().slice(0,16);
            } catch(e) { console.error("Error setting default date:", e); }
        }
        showSalesView('form');
    }

    function openEditSalesMeetingForm(id) {
        const meeting = meetings.find(m => m.id === id); 
        if (!meeting) {
            showNotificationCallback("Meeting not found in local cache. Please refresh.", "error");
            return;
        }
        currentMeetingId = id;
        currentMeetingForAnalysis = null; 
        if(formTitle) formTitle.textContent = 'Edit Meeting Details';
        if(newEditMeetingForm) newEditMeetingForm.reset();
        if(meetingIdInputHidden) meetingIdInputHidden.value = meeting.id;
        if(meetingTitleInput) meetingTitleInput.value = meeting.title;
        if(meetingDateInput) meetingDateInput.value = new Date(meeting.date).toISOString().slice(0,16);
        if(clientEmailInput) clientEmailInput.value = meeting.clientEmail;
        if(meetingNotesInput) meetingNotesInput.value = meeting.notes || '';
        showSalesView('form');
    }

    async function handleSaveMeeting(e) { 
        e.preventDefault();
        
        const saveButton = document.getElementById('save-meeting-btn-sales');
        setButtonLoadingStateCallback(saveButton, true);

        try {
            const meetingId = meetingIdInputHidden.value;
            const title = meetingTitleInput.value.trim();
            const date = meetingDateInput.value;
            const clientEmail = clientEmailInput.value.trim().toLowerCase();
            const notes = meetingNotesInput.value.trim();

            // Validate required fields
            if (!title || !date || !clientEmail) {
                throw new Error('Title, date, and client email are required.');
            }

            // Validate date
            if (isNaN(new Date(date).getTime())) {
                throw new Error('Invalid date format.');
            }

            // Validate email format
            if (!/\S+@\S+\.\S+/.test(clientEmail)) {
                throw new Error('Invalid client email format.');
            }

            // Validate title length
            if (title.length < 3) {
                throw new Error('Title must be at least 3 characters long.');
            }

            const meetingDetails = {
                title,
                date,
                clientEmail,
                notes
            };

            let result;
            if (meetingId) {
                result = await updateMeetingAPI(meetingId, meetingDetails);
            } else {
                result = await createMeetingAPI(meetingDetails);
            }

            if (!result || !result.id) { 
                // If result is null, or doesn't have an id, something went wrong despite response.ok (unlikely here)
                // or the API contract changed unexpectedly.
                console.error("Unexpected result from save meeting API:", result);
                throw new Error('Failed to save meeting or received an invalid response.');
            }

            await refreshMeetingsDisplay();
            showSalesView('list');
            showNotificationCallback('Meeting saved successfully!', 'success');

        } catch (error) {
            console.error('Error saving meeting:', error);
            newMeetingError.textContent = error.message;
            newMeetingError.classList.remove('hidden');
            showNotificationCallback(error.message, 'error');
        } finally {
            setButtonLoadingStateCallback(saveButton, false);
        }
    }

    async function viewSalesMeetingDetails(id) { 
        let meeting = meetings.find(m => m.id === id); 
        if (!meeting) { 
            showNotificationCallback("Meeting details not found in cache. Refreshing...", "warning");
            await refreshMeetingsDisplay(); 
            meeting = meetings.find(m => m.id === id);
            if (!meeting) {
                showNotificationCallback("Meeting not found even after refresh.", "error");
                return;
            }
        }
        currentMeetingForAnalysis = { ...meeting }; 
        currentMeetingId = currentMeetingForAnalysis.id;

        if(detailsMeetingTitle) detailsMeetingTitle.textContent = escapeHtml(currentMeetingForAnalysis.title);
        if(detailsMeetingDate) detailsMeetingDate.textContent = new Date(currentMeetingForAnalysis.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
        if(detailsClientEmail) detailsClientEmail.textContent = escapeHtml(currentMeetingForAnalysis.clientEmail);
        if(detailsMeetingStatus) {
            detailsMeetingStatus.textContent = escapeHtml(currentMeetingForAnalysis.status);
            detailsMeetingStatus.className = `font-medium ${currentMeetingForAnalysis.status === 'Scheduled' ? 'text-purple-600' : currentMeetingForAnalysis.status === 'Completed' ? 'text-green-600' :  currentMeetingForAnalysis.status === 'Processing' ? 'text-yellow-600' : 'text-gray-600'}`;
        }
        if(detailsClientCode) detailsClientCode.textContent = escapeHtml(currentMeetingForAnalysis.clientCode || 'N/A');
        if(detailsRecorderLinkAnchor) {
            const recorderLink = currentMeetingForAnalysis.recorderLink || "#";
            detailsRecorderLinkAnchor.href = recorderLink;
            detailsRecorderLinkAnchor.dataset.link = recorderLink; 
        }
        if(detailsMeetingNotes) detailsMeetingNotes.textContent = escapeHtml(currentMeetingForAnalysis.notes || 'No notes provided.');

        if (downloadPdfBtnSales) downloadPdfBtnSales.classList.add('hidden'); 
        if (analysisContentWrapper) analysisContentWrapper.classList.add('hidden');
        if (analysisNotAvailable) analysisNotAvailable.classList.add('hidden');


        if (currentMeetingForAnalysis.status === 'Completed' && currentMeetingForAnalysis.recordingId) {
            if(analysisNotAvailable) analysisNotAvailable.classList.add('hidden'); 
            if(analysisContentWrapper) {
                 analysisContentWrapper.classList.remove('hidden'); 
                 Object.values(analysisPanels).forEach(p => { if(p) p.innerHTML = '<p class="text-center p-4">Loading analysis...</p>'; });
            }

            try {
                // Use the recordingId from the meeting object to fetch analysis
                const analysisData = await fetchAnalysisDataAPI(currentMeetingForAnalysis.recordingId);
                if (analysisData) { 
                    currentMeetingForAnalysis.analysisData = analysisData; // Cache on the meeting object for PDF/Q&A
                    populateSalesAnalysisData(analysisData);
                    if(downloadPdfBtnSales) downloadPdfBtnSales.classList.remove('hidden');
                } else {
                    // This case means API returned success but no data, which is unusual.
                    throw new Error("No analysis data returned from API, though meeting is completed.");
                }
            } catch (error) {
                if(analysisContentWrapper) analysisContentWrapper.classList.add('hidden');
                if(analysisNotAvailable) {
                    analysisNotAvailable.classList.remove('hidden');
                    analysisNotAvailable.querySelector('p:first-of-type').textContent = "Failed to load meeting analysis.";
                    analysisNotAvailable.querySelector('p:last-of-type').textContent = error.message || "Please try again later.";
                }
            }
        } else { 
            if(analysisContentWrapper) analysisContentWrapper.classList.add('hidden');
            if(analysisNotAvailable) {
                analysisNotAvailable.classList.remove('hidden');
                const p1 = analysisNotAvailable.querySelector('p:first-of-type');
                const p2 = analysisNotAvailable.querySelector('p:last-of-type');
                if(currentMeetingForAnalysis.status === 'Scheduled') {
                    if(p1) p1.textContent = "This meeting is scheduled for the future.";
                    if(p2) p2.textContent = "Analysis will be available after the meeting is recorded and processed.";
                } else if (currentMeetingForAnalysis.status === 'Processing'){
                     if(p1) p1.textContent = "Meeting analysis is currently processing.";
                    if(p2) p2.textContent = "Please check back later. You can refresh the meetings list.";
                } else { 
                    if(p1) p1.textContent = "Meeting analysis is not yet available.";
                    if(p2) p2.textContent = "Ensure the recording has been scheduled and processed.";
                }
            }
        }
        questionHistoryArray = []; 
        renderSalesQuestionHistory();
        if(questionResultWrapper) questionResultWrapper.classList.add('hidden');
        showSalesView('details');
    }
    
    function populateSalesAnalysisData(analysisData) { 
        if(!analysisPanels || !analysisData) {
            Object.values(analysisPanels).forEach(p => { if(p) p.innerHTML = '<p class="text-center p-4 text-red-500">Analysis data is missing or corrupt.</p>'; });
            return;
        }
        // Backend shapes data for salesperson role. Access directly.
        analysisPanels.summary.innerHTML = analysisData.salespersonAnalysis?.tailoredSummary || analysisData.generalSummary || "<p>Summary not available.</p>";
        analysisPanels.keyPoints.innerHTML = analysisData.salespersonAnalysis?.keyPoints ? formatList(analysisData.salespersonAnalysis.keyPoints) : "<p>Key points not available.</p>";
        analysisPanels.actionItems.innerHTML = analysisData.salespersonAnalysis?.actionItems ? formatActionItems(analysisData.salespersonAnalysis.actionItems) : "<p>Action items not available.</p>";
        analysisPanels.questions.innerHTML = analysisData.salespersonAnalysis?.identifiedClientQuestions ? formatList(analysisData.salespersonAnalysis.identifiedClientQuestions) : "<p>Client questions not available.</p>";
        analysisPanels.sentiment.innerHTML = analysisData.salespersonAnalysis?.sentimentAnalysis ? formatSentiment(analysisData.salespersonAnalysis.sentimentAnalysis) : "<p>Sentiment analysis not available.</p>";

        if(analysisTabs && analysisTabs.length > 0) {
            analysisTabs.forEach(t => t.classList.remove('active'));
            analysisTabs[0].classList.add('active');
        }
        Object.values(analysisPanels).forEach(p => { if(p) p.classList.add('hidden'); });
        if(analysisPanels.summary) analysisPanels.summary.classList.remove('hidden');
    }

    function formatList(items) {
        if (!Array.isArray(items) || items.length === 0) return "<p>Not available.</p>";
        return `<ul>${items.map(item => `<li>${escapeHtml(typeof item === 'string' ? item : JSON.stringify(item))}</li>`).join('')}</ul>`;
    }
    function formatActionItems(items) {
        if (!Array.isArray(items) || items.length === 0) return "<p>No action items.</p>";
        return `<ol>${items.map(item => `<li><strong>${escapeHtml(item.assignee || 'Task')}:</strong> ${escapeHtml(item.task)}${item.dueDate ? ` (Due: ${escapeHtml(item.dueDate)})` : ''}</li>`).join('')}</ol>`;
    }
    function formatSentiment(sentiment) {
        if (typeof sentiment !== 'object' || sentiment === null) return "<p>Sentiment data not available.</p>";
        let html = `<p><strong>Overall:</strong> ${escapeHtml(sentiment.overall || 'N/A')}</p>`;
        if (sentiment.trendOverTime && Array.isArray(sentiment.trendOverTime) && sentiment.trendOverTime.length > 0) {
            html += `<h3>Trend:</h3><ul>${sentiment.trendOverTime.map(s => `<li>${escapeHtml(s.segment)}: ${escapeHtml(s.sentiment)}</li>`).join('')}</ul>`;
        }
        if (sentiment.keywords && Array.isArray(sentiment.keywords) && sentiment.keywords.length > 0) {
            html += `<h3>Keywords:</h3><ul>${sentiment.keywords.map(k => `<li><strong>${escapeHtml(k.term)}:</strong> ${escapeHtml(k.sentiment)} (Mentions: ${k.mentions || 1})</li>`).join('')}</ul>`;
        }
        return html;
    }
    function escapeHtml(unsafe) { 
        if (typeof unsafe !== 'string') return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    
    async function handleDeleteSalesMeeting() {
        if (!currentMeetingId) return;
        const meetingToDelete = meetings.find(m => m.id === currentMeetingId);
        if (!meetingToDelete || !confirm(`Are you sure you want to delete the meeting "${meetingToDelete.title}"? This action cannot be undone.`)) return;
        
        try {
            if(deleteMeetingBtn) setButtonLoadingStateCallback(deleteMeetingBtn, true); 
            await deleteMeetingAPI(currentMeetingId);
            showNotificationCallback("Meeting deleted successfully.", "info");
            await refreshMeetingsDisplay();
            showSalesView('list');
            currentMeetingId = null; 
            currentMeetingForAnalysis = null;
        } catch (error) {
            console.error("Failed to delete meeting:", error);
        } finally {
            if(deleteMeetingBtn) setButtonLoadingStateCallback(deleteMeetingBtn, false);
        }
    }

    async function handleSalesQuestion(e){
        e.preventDefault();
        const q = questionInput.value.trim();
        if(!q) { showNotificationCallback("Please type your query.", "warning"); return; }
        if (!currentMeetingForAnalysis || !currentMeetingForAnalysis.recordingId) {
            showNotificationCallback("No active meeting context for Q&A. Please view a completed meeting's details.", "error");
            return;
        }
        if(askButton) setButtonLoadingStateCallback(askButton, true);

        try {
            const response = await queryAnalysisAPI(currentMeetingForAnalysis.recordingId, q);
            if(questionTextEl) questionTextEl.textContent = q;
            if(answerTextEl) answerTextEl.innerHTML = response.answer || "No answer received or an error occurred."; 
            if(questionResultWrapper) questionResultWrapper.classList.remove('hidden');
            
            questionHistoryArray.unshift({question: q, answer: response.answer});
            if(questionHistoryArray.length > 3) questionHistoryArray.pop();
            renderSalesQuestionHistory();
            if(questionInput) questionInput.value = ''; 
        } catch (error) {
             if(answerTextEl) answerTextEl.textContent = `Error fetching answer: ${error.message}`;
             if(questionResultWrapper) questionResultWrapper.classList.remove('hidden');
        } finally {
            if(askButton) setButtonLoadingStateCallback(askButton, false);
        }
    }

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
            historyItem.style.setProperty('--delay', `${index * 0.1}s`); 
            historyItem.innerHTML = `
                <p class="mb-1.5"><strong class="text-gray-700">Q:</strong> ${escapeHtml(item.question)}</p>
                <p class="text-gray-600 leading-relaxed"><strong class="text-gray-700">A:</strong> ${item.answer}</p> 
            `; 
            questionHistory.appendChild(historyItem);
        });
    }

    async function handleDownloadSalespersonPdf() { 
        if (!currentMeetingForAnalysis || !currentMeetingForAnalysis.recordingId) {
            showNotificationCallback("No meeting selected or analysis available for PDF.", "warning");
            return;
        }
        if (currentMeetingForAnalysis.status !== 'Completed') {
             showNotificationCallback("Analysis not yet complete for this meeting to download PDF.", "warning");
            return;
        }
        
        if (!currentMeetingForAnalysis.analysisData) { // Ensure analysisData is loaded
            showNotificationCallback("Fetching latest analysis data for PDF...", "info");
            try {
                const analysisData = await fetchAnalysisDataAPI(currentMeetingForAnalysis.recordingId);
                if (!analysisData) throw new Error("Analysis data is empty or could not be fetched for PDF.");
                currentMeetingForAnalysis.analysisData = analysisData; // Cache it
            } catch (error) {
                 showNotificationCallback("Failed to fetch analysis data for PDF generation.", "error");
                 return;
            }
        }
        
        try {
            if(downloadPdfBtnSales) setButtonLoadingStateCallback(downloadPdfBtnSales, true); 
            await downloadAnalysisPdfAPI(currentMeetingForAnalysis.recordingId);
        } catch (error) {
            console.error("Salesperson PDF Download trigger failed:", error);
        } finally {
            if(downloadPdfBtnSales) setButtonLoadingStateCallback(downloadPdfBtnSales, false);
        }
    }
    
    function setupEventListeners() {
        // Ensure all DOM elements are cached before adding listeners
        if (!newMeetingBtn || !cancelMeetingFormBtn || !newEditMeetingForm || !editMeetingBtn || !deleteMeetingBtn || !backToListBtn || !mainMenuBtnSales || !logoutBtnSales || !analysisTabs.length || !questionForm || !downloadPdfBtnSales) { 
            console.error("Salesperson DOM not fully initialized for event listeners. One or more elements are missing."); 
            return; 
        }
        newMeetingBtn.addEventListener('click', openNewSalesMeetingForm);
        cancelMeetingFormBtn.addEventListener('click', () => showSalesView('list'));
        newEditMeetingForm.addEventListener('submit', handleSaveMeeting);
        editMeetingBtn.addEventListener('click', () => { if(currentMeetingId) openEditSalesMeetingForm(currentMeetingId); });
        deleteMeetingBtn.addEventListener('click', handleDeleteSalesMeeting);
        
        backToListBtn.addEventListener('click', () => showSalesView('list'));
        
        mainMenuBtnSales.addEventListener('click', () => {
            switchViewCallback('index'); 
        });
        logoutBtnSales.addEventListener('click', async () => { 
            await SharedAppLogic.logoutAPI(); 
            showNotificationCallback("Logged out. Redirecting...", "info");
            window.location.href = 'landing-page.html'; 
        });

        analysisTabs.forEach(tab => { 
            tab.addEventListener('click', () => {
                analysisTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const targetPanelId = tab.dataset.tab + '-content-panel-sales';
                Object.values(analysisPanels).forEach(panel => { if(panel) panel.classList.add('hidden'); });
                const targetPanel = document.getElementById(targetPanelId);
                if(targetPanel) targetPanel.classList.remove('hidden');
            });
        });
        
        if(questionForm) questionForm.addEventListener('submit', handleSalesQuestion);
        
        if (downloadPdfBtnSales) { 
            downloadPdfBtnSales.addEventListener('click', handleDownloadSalespersonPdf);
        }
        
        if (meetingDetailsView) {
            // Use event delegation for copy buttons if meetingDetailsView is repopulated often,
            // otherwise, this direct binding is fine if setupEventListeners is called once after getHTML.
            const copyButtons = meetingDetailsView.querySelectorAll('.copy-code-btn');
            copyButtons.forEach(button => {
                if (button.dataset.listenerAttached !== 'true') {
                    button.addEventListener('click', (event) => {
                        const targetElement = event.currentTarget.previousElementSibling;
                        let textToCopy;
                        let labelText = "Content";

                        if (targetElement && targetElement.tagName === 'A' && targetElement.id === 'details-recorder-link-sales') {
                            textToCopy = targetElement.dataset.link; 
                            if (textToCopy && textToCopy.startsWith('recorder.html')) {
                                textToCopy = window.location.origin + 
                                             window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1) + 
                                             textToCopy;
                            } else if (textToCopy && !textToCopy.startsWith('http')) {
                                textToCopy = window.location.origin + textToCopy;
                            }
                            labelText = "Recorder Link";
                        } else if (targetElement && targetElement.tagName === 'SPAN') {
                            textToCopy = targetElement.textContent;
                            if(targetElement.previousElementSibling && targetElement.previousElementSibling.tagName === 'STRONG'){
                                labelText = targetElement.previousElementSibling.textContent.replace(':','');
                            }
                        }

                        if (textToCopy) {
                            navigator.clipboard.writeText(textToCopy)
                                .then(() => showNotificationCallback(`${labelText} Copied!`, 'success'))
                                .catch(err => showNotificationCallback('Failed to copy.', 'error'));
                        } else {
                            showNotificationCallback('Nothing to copy.', 'warning');
                        }
                    });
                    button.dataset.listenerAttached = 'true';
                }
            });
        }
    }

    return {
        init: (
            _notifyCb, _switchCb, 
            _genIdCb, _genRecLinkCb, 
            _fetchMeetings, _createMeeting, _updateMeeting, _deleteMeeting, 
            _fetchAnalysis, _queryAnalysis, _downloadPdf,
            _setLoadStateCb, _getMeetingById 
        ) => {
            showNotificationCallback = _notifyCb;
            switchViewCallback = _switchCb;
            generateIdCallback = _genIdCb; 
            generateRecorderLinkCallback = _genRecLinkCb; 
            fetchMeetingsAPI = _fetchMeetings;
            createMeetingAPI = _createMeeting;
            updateMeetingAPI = _updateMeeting;
            deleteMeetingAPI = _deleteMeeting;
            fetchAnalysisDataAPI = _fetchAnalysis;
            queryAnalysisAPI = _queryAnalysis;
            downloadAnalysisPdfAPI = _downloadPdf;
            setButtonLoadingStateCallback = _setLoadStateCb;
            getMeetingByIdCallback = _getMeetingById; 
            
            initDOMReferences(); 
            setupEventListeners();
            
            refreshMeetingsDisplay(); 
            showSalesView('list');
        },
        getHTML
    };
})();
