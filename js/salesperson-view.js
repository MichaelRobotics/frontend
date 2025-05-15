// /js/salesperson-view.js
const SalespersonView = (() => {
    let meetings = []; // This will be the meetingsData from SharedAppLogic
    let showNotificationCallback;
    let switchViewCallback; // Will be used for window.location.href
    let generateIdCallback;
    let generateRecorderLinkCallback;
    let saveMeetingsCallback; // To call SharedAppLogic.saveMeetings
    let setButtonLoadingStateCallback;
    let getMeetingByIdCallback; // To get specific meeting details, e.g., recorder analysis

    let currentMeetingId = null; // For editing or viewing details
    let questionHistoryArray = []; // Specific to this view instance

    // DOM Elements (will be queried after HTML injection by initDOMReferences)
    let meetingListView, newEditMeetingView, meetingDetailsView, newMeetingBtn, meetingList, noMeetingsMessage;
    let formTitle, newEditMeetingForm, meetingIdInput, meetingTitleInput, meetingDateInput, clientEmailInput, meetingNotesInput, cancelMeetingFormBtn, saveMeetingBtn, newMeetingError;
    let detailsMeetingTitle, detailsMeetingDate, detailsClientEmail, detailsMeetingStatus, detailsClientCode, detailsRecorderLinkAnchor, detailsMeetingNotes, editMeetingBtn, deleteMeetingBtn, downloadPdfBtnSales; // Added downloadPdfBtnSales
    let analysisNotAvailable, analysisContentWrapper, analysisTabs, analysisPanels;
    let questionForm, questionInput, askButton, questionResultWrapper, questionTextEl, answerTextEl, questionHistory;
    let backToListBtn, logoutBtnSales, mainMenuBtnSales;


    function getHTML() {
        // This HTML is from your original SalespersonView (Part 2 of the 4-part JS)
        // It includes the header specific to the Salesperson dashboard and the main content areas.
        // MODIFIED to include the download PDF button
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
                    <p id="no-meetings-message-sales" class="text-center text-gray-500 py-8 text-lg italic hidden">No meetings scheduled.</p>
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
        meetingIdInput = viewContainer.querySelector('#meeting-id-sales-hidden');
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
        downloadPdfBtnSales = viewContainer.querySelector('#download-pdf-btn-sales'); // Cache the new button
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

    function setupEventListeners() {
        if (!newMeetingBtn) { console.error("Salesperson DOM not fully initialized for event listeners."); return; }
        newMeetingBtn.addEventListener('click', openNewSalesMeetingForm);
        cancelMeetingFormBtn.addEventListener('click', () => showSalesView('list'));
        newEditMeetingForm.addEventListener('submit', handleSaveMeeting);
        editMeetingBtn.addEventListener('click', () => { if(currentMeetingId) openEditSalesMeetingForm(currentMeetingId); });
        deleteMeetingBtn.addEventListener('click', handleDeleteSalesMeeting);
        
        if(backToListBtn) backToListBtn.addEventListener('click', () => showSalesView('list'));
        
        if(mainMenuBtnSales) {
            mainMenuBtnSales.addEventListener('click', () => {
                switchViewCallback('index'); 
            });
        }
        if(logoutBtnSales) {
            logoutBtnSales.addEventListener('click', () => {
                showNotificationCallback("Exited Salesperson Role.", "info");
                switchViewCallback('index'); 
            });
        }

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
        
        // Add event listener for the new PDF button
        if (downloadPdfBtnSales) {
            downloadPdfBtnSales.addEventListener('click', () => {
                if (currentMeetingId) {
                    const meeting = meetings.find(m => m.id === currentMeetingId);
                    const recorderMeeting = meeting ? getMeetingByIdCallback(meeting.recorderId) : null; 
                    
                    if (recorderMeeting && recorderMeeting.analysisData) {
                        handleDownloadSalespersonPdf(meeting, recorderMeeting.analysisData);
                    } else {
                        showNotificationCallback("No analysis data available to generate PDF.", "warning");
                    }
                } else {
                    showNotificationCallback("No meeting selected.", "warning");
                }
            });
        }
        
        const copyButtons = document.querySelectorAll('#meeting-details-view-sales .copy-code-btn');
        copyButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const strongEl = event.currentTarget.previousElementSibling.previousElementSibling;
                const labelText = strongEl ? strongEl.textContent : "Content";
                let textToCopy;

                if (event.currentTarget.previousElementSibling.id === 'details-recorder-link-sales') {
                    const linkAnchor = document.getElementById('details-recorder-link-sales');
                    textToCopy = linkAnchor ? linkAnchor.dataset.link : null;
                     if (textToCopy && textToCopy.startsWith('recorder.html')) {
                        textToCopy = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1) + textToCopy;
                    }
                } else {
                    const codeSpan = event.currentTarget.previousElementSibling;
                    textToCopy = codeSpan ? codeSpan.textContent : null;
                }

                if (textToCopy) {
                    navigator.clipboard.writeText(textToCopy)
                        .then(() => showNotificationCallback(`${labelText} Copied!`, 'success'))
                        .catch(err => showNotificationCallback('Failed to copy.', 'error'));
                } else {
                    showNotificationCallback('Nothing to copy.', 'warning');
                }
            });
        });
    }

    function handleDownloadSalespersonPdf(meeting, analysisData) {
        if (!meeting || !analysisData) {
            showNotificationCallback("Cannot generate PDF: Missing meeting or analysis data.", "error");
            return;
        }

        let reportHtml = `
            <html>
            <head>
                <title>Meeting Analysis Report: ${meeting.title}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; color: #333; }
                    h1 { color: #4c1d95; border-bottom: 2px solid #e9d5ff; padding-bottom: 5px;}
                    h2 { color: #581c87; margin-top: 30px; border-bottom: 1px solid #f3e8ff; padding-bottom: 3px;}
                    h3 { color: #6b21a8; margin-top: 20px;}
                    p { margin-bottom: 10px; }
                    ul, ol { margin-left: 20px; margin-bottom: 10px; }
                    li { margin-bottom: 5px; }
                    .section { margin-bottom: 25px; padding: 15px; border: 1px solid #e9d5ff; border-radius: 8px; background-color: #fdfaff; }
                    .section-title { font-size: 1.2em; font-weight: bold; color: #7e22ce; margin-bottom:10px;}
                    .meta-info p { font-size: 0.9em; color: #555; margin-bottom: 3px;}
                    strong { color: #581c87; }
                    pre { white-space: pre-wrap; word-wrap: break-word; background-color: #f8f9fa; padding: 10px; border-radius: 4px; }
                </style>
            </head>
            <body>
                <h1>Meeting Analysis Report</h1>
                <div class="meta-info section">
                    <p><strong>Title:</strong> ${meeting.title}</p>
                    <p><strong>Date:</strong> ${new Date(meeting.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
                    <p><strong>Client:</strong> ${meeting.clientEmail}</p>
                    <p><strong>Status:</strong> ${meeting.status}</p>
                </div>

                ${analysisData.summary ? `<div class="section"><h2>Summary</h2>${analysisData.summary}</div>` : ''}
                ${analysisData.keyPoints ? `<div class="section"><h2>Key Points</h2>${analysisData.keyPoints}</div>` : ''}
                ${analysisData.actionItems ? `<div class="section"><h2>Action Items</h2>${analysisData.actionItems}</div>` : ''}
                ${analysisData.questions ? `<div class="section"><h2>Client Questions</h2>${analysisData.questions}</div>` : ''}
                ${analysisData.sentiment ? `<div class="section"><h2>Sentiment Analysis</h2>${analysisData.sentiment}</div>` : ''}
                ${analysisData.transcript ? `<div class="section"><h2>Transcript</h2><pre>${analysisData.transcript.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></div>` : ''}
                
                <script>
                    // setTimeout(() => {
                    //     alert("Please use your browser's 'Print' function (Ctrl+P or Cmd+P) and select 'Save as PDF'.");
                    // }, 500);
                <\/script>
            </body>
            </html>
        `;

        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
            reportWindow.document.open();
            reportWindow.document.write(reportHtml);
            reportWindow.document.close();
            reportWindow.focus(); 
            showNotificationCallback("Report opened in new tab. Use browser's Print to PDF.", "info");
        } else {
            showNotificationCallback("Could not open new window. Please check your pop-up blocker.", "error");
        }
    }

    function viewSalesMeetingDetails(id) {
        const meeting = meetings.find(m => m.id === id);
        if (!meeting) { showNotificationCallback("Meeting details not found.", "error"); return; }
        currentMeetingId = id; 

        if(detailsMeetingTitle) detailsMeetingTitle.textContent = meeting.title;
        if(detailsMeetingDate) detailsMeetingDate.textContent = new Date(meeting.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
        if(detailsClientEmail) detailsClientEmail.textContent = meeting.clientEmail;
        if(detailsMeetingStatus) {
            detailsMeetingStatus.textContent = meeting.status;
            detailsMeetingStatus.className = `font-medium ${meeting.status === 'Scheduled' ? 'text-purple-600' : meeting.status === 'Completed' ? 'text-green-600' : 'text-gray-600'}`;
        }
        if(detailsClientCode) detailsClientCode.textContent = meeting.clientCode || 'N/A';
        if(detailsRecorderLinkAnchor) {
            detailsRecorderLinkAnchor.href = meeting.recorderLink || "#";
            detailsRecorderLinkAnchor.textContent = "Open Recorder Page"; 
            detailsRecorderLinkAnchor.dataset.link = meeting.recorderLink || "";
        }
        if(detailsMeetingNotes) detailsMeetingNotes.textContent = meeting.notes || 'No notes provided for this meeting.';

        const recorderMeeting = getMeetingByIdCallback(meeting.recorderId);

        if (recorderMeeting && recorderMeeting.status === 'completed' && recorderMeeting.analysisData) {
            if(analysisNotAvailable) analysisNotAvailable.classList.add('hidden');
            if(analysisContentWrapper) analysisContentWrapper.classList.remove('hidden');
            populateSalesAnalysisData(recorderMeeting.analysisData);
            if(downloadPdfBtnSales) downloadPdfBtnSales.classList.remove('hidden'); // Show PDF button
        } else {
            if(analysisContentWrapper) analysisContentWrapper.classList.add('hidden');
            if(analysisNotAvailable) {
                analysisNotAvailable.classList.remove('hidden');
                const p1 = analysisNotAvailable.querySelector('p:first-of-type');
                const p2 = analysisNotAvailable.querySelector('p:last-of-type');
                if(meeting && meeting.status === 'Scheduled') {
                    if(p1) p1.textContent = "This meeting is scheduled for the future.";
                    if(p2) p2.textContent = "Analysis will be available after the meeting is recorded and processed.";
                } else {
                    if(p1) p1.textContent = "Meeting analysis is not yet available.";
                    if(p2) p2.textContent = "The associated recording might not have been processed, or analysis is pending.";
                }
            }
            if(downloadPdfBtnSales) downloadPdfBtnSales.classList.add('hidden'); // Hide PDF button
        }
        questionHistoryArray = []; 
        renderSalesQuestionHistory();
        if(questionResultWrapper) questionResultWrapper.classList.add('hidden');
        showSalesView('details');
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
    function renderSalesMeetingList() {
        if (!meetingList || !noMeetingsMessage) return;
        meetingList.innerHTML = '';
        const salespersonMeetings = meetings; 
        if (salespersonMeetings.length === 0) { noMeetingsMessage.classList.remove('hidden'); return; }
        noMeetingsMessage.classList.add('hidden');
        salespersonMeetings.sort((a, b) => new Date(b.date) - new Date(a.date));
        salespersonMeetings.forEach((meeting, index) => {
            const item = document.createElement('div');
            item.className = 'meeting-item-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 fade-in';
            item.style.setProperty('--delay', `${index * 0.05}s`);
            item.dataset.id = meeting.id;
            let statusClass = 'status-cancelled'; 
            if (meeting.status === 'Scheduled') statusClass = 'status-scheduled';
            else if (meeting.status === 'Completed') statusClass = 'status-completed';
            item.innerHTML = `
                <div class="flex-grow">
                    <h3 class="text-lg font-semibold text-purple-700 mb-1">${meeting.title}</h3>
                    <p class="text-sm text-gray-600">With: ${meeting.clientEmail}</p>
                    <p class="text-sm text-gray-500">Date: ${new Date(meeting.date).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div class="flex items-center mt-2 sm:mt-0">
                    <span class="status-indicator ${statusClass} mr-2"></span>
                    <span class="text-sm font-medium text-gray-700">${meeting.status}</span>
                </div>`;
            item.addEventListener('click', () => viewSalesMeetingDetails(meeting.id));
            meetingList.appendChild(item);
        });
    }
    function openNewSalesMeetingForm() {
        currentMeetingId = null;
        if(formTitle) formTitle.textContent = 'Schedule New Meeting';
        if(newEditMeetingForm) newEditMeetingForm.reset();
        if(meetingIdInput) meetingIdInput.value = '';
        if(meetingDateInput) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9,0,0,0);
            meetingDateInput.value = tomorrow.toISOString().slice(0,16);
        }
        showSalesView('form');
    }
    function openEditSalesMeetingForm(id) {
        const meeting = meetings.find(m => m.id === id);
        if (!meeting) { showNotificationCallback("Meeting not found.", "error"); return; }
        currentMeetingId = id;
        if(formTitle) formTitle.textContent = 'Edit Meeting Details';
        if(newEditMeetingForm) newEditMeetingForm.reset();
        if(meetingIdInput) meetingIdInput.value = meeting.id;
        if(meetingTitleInput) meetingTitleInput.value = meeting.title;
        if(meetingDateInput) meetingDateInput.value = new Date(meeting.date).toISOString().slice(0,16);
        if(clientEmailInput) clientEmailInput.value = meeting.clientEmail;
        if(meetingNotesInput) meetingNotesInput.value = meeting.notes || '';
        showSalesView('form');
    }
    function handleSaveMeeting(e) {
        e.preventDefault();
        if(newMeetingError) newMeetingError.classList.add('hidden');
        if(saveMeetingBtn) setButtonLoadingStateCallback(saveMeetingBtn, true);
        const title = meetingTitleInput.value.trim();
        const date = meetingDateInput.value;
        const clientEmail = clientEmailInput.value.trim();
        const notes = meetingNotesInput.value.trim();
        if (!title || !date || !clientEmail) {
            if(newMeetingError) { newMeetingError.textContent = "Title, Date, and Client Email are required."; newMeetingError.classList.remove('hidden');}
            if(saveMeetingBtn) setButtonLoadingStateCallback(saveMeetingBtn, false);
            return;
        }
        setTimeout(() => {
            let meetingToSave;
            if (currentMeetingId) {
                const index = meetings.findIndex(m => m.id === currentMeetingId);
                if (index > -1) {
                    meetings[index] = { ...meetings[index], title, date, clientEmail, notes };
                    meetingToSave = meetings[index]; 
                    showNotificationCallback("Meeting updated successfully!", "success");
                } else { showNotificationCallback("Error finding meeting to update.", "error"); if(saveMeetingBtn) setButtonLoadingStateCallback(saveMeetingBtn, false); return; }
            } else {
                const newMeetingId = `sm-${generateIdCallback(8)}`;
                const newRecorderId = `rec-${generateIdCallback(8)}`;
                meetingToSave = {
                    id: newMeetingId, title, date, clientEmail, notes,
                    status: 'Scheduled', clientCode: generateIdCallback(6), 
                    recorderId: newRecorderId, 
                    recorderLink: generateRecorderLinkCallback(newRecorderId, generateIdCallback(8)), 
                    analysisAvailable: false, analysisData: null
                };
                meetings.push(meetingToSave);
                showNotificationCallback("Meeting scheduled successfully!", "success");
            }
            saveMeetingsCallback(); 
            renderSalesMeetingList();
            showSalesView('list');
            if(saveMeetingBtn) setButtonLoadingStateCallback(saveMeetingBtn, false);
        }, 700);
    }
    function populateSalesAnalysisData(analysisData) {
        if(!analysisPanels || !analysisData) return;
        analysisPanels.summary.innerHTML = analysisData.summary || "<p>Summary not available.</p>";
        analysisPanels.keyPoints.innerHTML = analysisData.keyPoints || "<p>Key points not available.</p>";
        analysisPanels.actionItems.innerHTML = analysisData.actionItems || "<p>Action items not available.</p>";
        analysisPanels.questions.innerHTML = analysisData.questions || "<p>Client questions not available.</p>";
        analysisPanels.sentiment.innerHTML = analysisData.sentiment || "<p>Sentiment analysis not available.</p>";
        if(analysisTabs && analysisTabs.length > 0) {
            analysisTabs.forEach(t => t.classList.remove('active'));
            analysisTabs[0].classList.add('active');
        }
        Object.values(analysisPanels).forEach(p => { if(p) p.classList.add('hidden'); });
        if(analysisPanels.summary) analysisPanels.summary.classList.remove('hidden');
    }
    function handleDeleteSalesMeeting() {
        if (!currentMeetingId) return;
        const meetingToDelete = meetings.find(m => m.id === currentMeetingId);
        if (!meetingToDelete || !confirm(`Are you sure you want to delete the meeting "${meetingToDelete.title}"? This action cannot be undone.`)) return;
        meetings = meetings.filter(m => m.id !== currentMeetingId);
        saveMeetingsCallback(); renderSalesMeetingList(); showSalesView('list');
        currentMeetingId = null; 
        showNotificationCallback("Meeting deleted successfully.", "info");
    }
    function handleSalesQuestion(e){
        e.preventDefault();
        const q = questionInput.value.trim();
        if(!q) { showNotificationCallback("Please type your query.", "warning"); return; }
        if(askButton) setButtonLoadingStateCallback(askButton, true);
        setTimeout(() => {
            if(questionTextEl) questionTextEl.textContent = q;
            let ans = "Simulated AI Response: Thinking...";
            const currentMeetingForQ = meetings.find(m => m.id === currentMeetingId);
            const recorderMeetingForQ = currentMeetingForQ ? getMeetingByIdCallback(currentMeetingForQ.recorderId) : null;
            if (recorderMeetingForQ && recorderMeetingForQ.analysisData) {
                if (q.toLowerCase().includes("concerns") && recorderMeetingForQ.analysisData.summary) { ans = `Based on the summary: ${recorderMeetingForQ.analysisData.summary.split('. ')[0]}. For more, check Key Points.`; }
                else if (q.toLowerCase().includes("action items") && recorderMeetingForQ.analysisData.actionItems) { ans = `Identified Action Items: ${recorderMeetingForQ.analysisData.actionItems.replace(/<[^>]+>/g, ' ').substring(0,100)}...`;}
                else if (q.toLowerCase().includes("sentiment") && recorderMeetingForQ.analysisData.sentiment) { ans = `Sentiment Analysis: ${recorderMeetingForQ.analysisData.sentiment.replace(/<[^>]+>/g, ' ')}`;}
                else { ans = "This is a sales-focused AI insight. The analysis data suggests focusing on follow-up actions.";}
            } else { ans = "Analysis data not available for this meeting to answer your query effectively.";}
            if(answerTextEl) answerTextEl.innerHTML = ans; 
            if(questionResultWrapper) questionResultWrapper.classList.remove('hidden');
            questionHistoryArray.unshift({question: q, answer: ans});
            if(questionHistoryArray.length > 3) questionHistoryArray.pop();
            renderSalesQuestionHistory();
            if(questionInput) questionInput.value = ''; 
            if(askButton) setButtonLoadingStateCallback(askButton, false);
        }, 1000);
    }
    function renderSalesQuestionHistory(){
        if (!questionHistory) return;
        questionHistory.innerHTML = ''; 
        if (questionHistoryArray.length === 0) { questionHistory.innerHTML = '<p class="text-gray-500 italic text-sm text-center py-3">No recent queries for this meeting.</p>'; return; }
        questionHistoryArray.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'bg-white/70 p-3.5 rounded-lg shadow-sm border border-gray-200 text-sm fade-in';
            historyItem.style.setProperty('--delay', `${index * 0.1}s`); 
            historyItem.innerHTML = `
                <p class="mb-1.5"><strong class="text-gray-700">Q:</strong> ${item.question}</p>
                <p class="text-gray-600 leading-relaxed"><strong class="text-gray-700">A:</strong> ${item.answer}</p>
            `; 
            questionHistory.appendChild(historyItem);
        });
    }


    return {
        init: (meetingsArr, notifyCb, switchCb, genIdCb, genRecLinkCb, 
               saveCb, 
               setLoadStateCb, getMeetingByIdCb) => {
            meetings = meetingsArr;
            showNotificationCallback = notifyCb;
            switchViewCallback = switchCb;
            generateIdCallback = genIdCb;
            generateRecorderLinkCallback = genRecLinkCb;
            saveMeetingsCallback = saveCb; 
            setButtonLoadingStateCallback = setLoadStateCb;
            getMeetingByIdCallback = getMeetingByIdCb; 
            
            initDOMReferences(); 
            setupEventListeners();
            
            renderSalesMeetingList();
            showSalesView('list');
        },
        getHTML
    };
})();