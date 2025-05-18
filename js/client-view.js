// /js/client-view.js
const ClientView = (() => {
    // No local 'meetings' array, as client accesses one meeting at a time via code/validation
    let showNotificationCallback;
    let switchViewCallback; // For window.location.href to landing page
    let setButtonLoadingStateCallback;
    
    // API interaction callbacks from SharedAppLogic
    let validateClientAccessAPI;
    // fetchAnalysisDataAPI is not directly called by client; validateClientAccessAPI returns the needed data.
    let queryAnalysisAPI;
    let downloadAnalysisPdfAPI;

    let currentClientMeeting = null; // Stores { title, date, recordingId, analysisData } after validation
    let questionHistoryArray = [];

    // DOM Elements
    let accessFormView, meetingDetailsView, clientAccessForm, shareableIdInputClient, accessCodeInputClient, accessSubmitButtonClient, accessErrorClient;
    let detailsMeetingTitle, detailsMeetingDate, detailsMeetingStatus, detailsShareableIdClient, detailsMeetingIdClient, detailsMeetingNotes, downloadPdfBtnClient;
    let analysisNotAvailable, analysisContentWrapper;
    let analysisTabs, analysisPanels = {};
    let questionForm, questionInput, askButton, questionResultWrapper, questionTextEl, answerTextEl, questionHistory;
    let logoutBtnClient, mainMenuBtnClient; // 'logoutBtnClient' is the "Exit View" button


    function getHTML() {
        return `
            <header class="bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-xl sticky top-0 z-40">
                <div class="container mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center">
                    <h1 class="text-xl sm:text-2xl font-bold mb-3 sm:mb-0 text-center sm:text-left tracking-tight flex items-center">
                        <i class="fas fa-user-circle mr-3 text-2xl opacity-90"></i>Client Access
                    </h1>
                    <div id="user-controls-client" class="fade-in" style="--delay: 1s;">
                        <button id="main-menu-btn-client" class="btn-header btn-hover px-4 py-2 transition mr-2 text-sm sm:text-base font-medium">
                            <i class="fas fa-th-large mr-2 icon-hover"></i>App Dashboard
                        </button>
                        <button id="logout-btn-client" class="btn-header btn-hover px-4 py-2 transition text-sm sm:text-base font-medium">
                            <i class="fas fa-sign-out-alt mr-2 icon-hover"></i>Logout Role
                        </button>
                    </div>
                </div>
            </header>
            <main class="flex-grow container mx-auto p-5 sm:p-8">
                <div id="access-form-view-client" class="view-section max-w-md mx-auto glass-effect p-7 sm:p-10 fade-in" style="--delay: 0.2s;">
                    <h2 class="text-2xl sm:text-3xl font-bold mb-8 text-center text-gray-800">Access Meeting Analysis</h2>
                    <form id="client-access-form" class="space-y-6">
                        <div>
                            <label for="shareable-id-client" class="block text-gray-700 mb-1.5 font-semibold text-sm">Shareable Meeting ID</label>
                            <input type="text" id="shareable-id-client" class="w-full custom-input" required placeholder="Enter Shareable ID (e.g., ABC-123)">
                        </div>
                        <div>
                            <label for="access-code-client" class="block text-gray-700 mb-1.5 font-semibold text-sm">Client Access Code</label>
                            <input type="text" id="access-code-client" class="w-full custom-input" required placeholder="Enter Client Access Code">
                        </div>
                        <button type="submit" id="access-submit-button-client" class="btn-primary-green btn-hover w-full">
                            <span class="button-text">Access Meeting</span>
                            <span class="button-loader hidden"><i class="fas fa-spinner fa-spin mr-2"></i>Accessing...</span>
                        </button>
                    </form>
                    <p id="access-error-client" class="error mt-5 text-center hidden text-sm"></p>
                </div>
                <div id="meeting-details-view-client" class="view-section max-w-5xl mx-auto glass-effect p-7 sm:p-10 hidden fade-in">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-5">
                        <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 md:mb-0" id="details-meeting-title-client">Meeting Details</h2>
                        <div class="flex flex-wrap gap-2 self-start md:self-center">
                            <button id="download-pdf-btn-client" class="btn-success btn-hover flex items-center text-sm">
                                <i class="fas fa-file-pdf mr-2 icon-hover"></i> Download PDF Report
                            </button>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8 p-5 bg-green-50/70 rounded-xl border border-green-200/70">
                        <div>
                            <h3 class="text-lg font-semibold mb-2 text-green-800">Information</h3>
                            <div class="space-y-1.5 text-sm">
                                <p><strong class="text-gray-700">Date & Time:</strong> <span id="details-meeting-date-client" class="text-gray-600"></span></p>
                                <p><strong class="text-gray-700">Status:</strong> <span id="details-meeting-status-client" class="font-medium"></span></p>
                            </div>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold mb-2 text-green-800">Access Details</h3>
                            <div class="space-y-1.5 text-sm">
                                <p><strong class="text-gray-700">Shareable ID:</strong> <span id="details-shareable-id-client" class="text-gray-600 font-mono bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold"></span> <button class="copy-code-btn text-green-500 hover:text-green-700 text-xs ml-1" aria-label="Copy Shareable ID"><i class="far fa-copy"></i></button></p>
                                <p><strong class="text-gray-700">System Meeting ID:</strong> <span id="details-meeting-id-client" class="text-gray-600 font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs"></span> <button class="copy-code-btn text-green-500 hover:text-green-700 text-xs ml-1" aria-label="Copy System Meeting ID"><i class="far fa-copy"></i></button></p>
                            </div>
                        </div>
                        <div class="md:col-span-2 mt-2">
                            <h3 class="text-lg font-semibold mb-2 text-green-800">Agenda / Notes</h3>
                            <p id="details-meeting-notes-client" class="text-sm text-gray-600 whitespace-pre-wrap bg-white/50 p-3 rounded-md border border-gray-200 min-h-[50px]"></p>
                        </div>
                    </div>
                    <div id="analysis-not-available-client" class="text-center py-8 px-4 bg-gray-50 rounded-lg my-8 hidden">
                        <i class="fas fa-info-circle text-3xl text-gray-400 mb-3"></i>
                        <p class="text-gray-600 font-medium">Meeting analysis is not yet available.</p>
                        <p class="text-sm text-gray-500">Analysis will appear after the recording is processed.</p>
                    </div>
                    <div id="analysis-content-wrapper-client" class="hidden">
                        <h3 class="text-xl font-semibold mb-1 text-green-800">AI-Powered Meeting Insights</h3>
                        <p class="text-sm text-gray-500 mb-6">Review the automatically generated analysis of your meeting.</p>
                        <div class="mb-8">
                            <div class="border-b border-gray-300">
                                <nav class="flex flex-wrap -mb-px">
                                    <button data-tab="summary" class="analysis-tab active">Summary</button>
                                    <button data-tab="key-points" class="analysis-tab">Key Points</button>
                                    <button data-tab="action-items" class="analysis-tab">Action Items</button>
                                    <button data-tab="questions" class="analysis-tab">Your Questions</button>
                                    <button data-tab="sentiment" class="analysis-tab">Sentiment</button>
                                </nav>
                            </div>
                        </div>
                        <div class="analysis-content min-h-[300px] analysis-content-bg">
                            <div id="summary-content-panel-client" class="analysis-panel markdown-content fade-in"></div>
                            <div id="key-points-content-panel-client" class="analysis-panel markdown-content hidden fade-in"></div>
                            <div id="action-items-content-panel-client" class="analysis-panel markdown-content hidden fade-in"></div>
                            <div id="questions-content-panel-client" class="analysis-panel markdown-content hidden fade-in"></div>
                            <div id="sentiment-content-panel-client" class="analysis-panel markdown-content hidden fade-in"></div>
                        </div>
                        <div class="mt-10 p-7 bg-green-50/80 rounded-2xl border border-green-200/70 shadow-lg">
                            <h3 class="text-xl sm:text-2xl font-semibold mb-5 text-green-800 flex items-center"><i class="fas fa-search-dollar mr-3 text-green-600"></i>Query Meeting Data</h3>
                            <form id="question-form-client" class="mb-7">
                                <div class="flex items-center">
                                    <input type="text" id="question-input-client" class="flex-grow p-3.5 border-gray-300 rounded-l-xl custom-input text-base" placeholder="e.g., 'What were the main concerns?'">
                                    <button type="submit" id="ask-button-client" class="btn-primary-green text-white px-5 py-3.5 rounded-r-xl btn-hover text-sm">
                                        <span class="button-text"><i class="fas fa-paper-plane mr-2 icon-hover"></i>Ask AI</span>
                                        <span class="button-loader hidden"><i class="fas fa-spinner fa-spin mr-2"></i>Asking...</span>
                                    </button>
                                </div>
                            </form>
                            <div id="question-result-wrapper-client" class="hidden fade-in">
                                <div id="question-result-client" class="bg-white p-5 rounded-xl shadow-md mb-5 border-gray-200">
                                    <div class="mb-2"><strong class="text-gray-700">Q:</strong> <span id="question-text-client"></span></div>
                                    <div><strong class="text-gray-700">A:</strong> <span id="answer-text-client" class="leading-relaxed"></span></div>
                                </div>
                            </div>
                            <div>
                                <h4 class="font-semibold mb-4 text-green-700 text-lg">Recent Queries</h4>
                                <div id="question-history-client" class="space-y-4 max-h-72 overflow-y-auto p-1 custom-scrollbar">
                                    <p class="text-gray-500 italic text-sm text-center py-3">No recent queries for this meeting.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <footer class="bg-gray-800 text-white py-6 text-center mt-auto">
                <p class="text-sm">&copy; <span id="current-year-client"></span> Meeting Analysis System (Client View). All rights reserved.</p>
            </footer>
        `;
    }

    function initDOMReferences() {
        const viewContainer = document.getElementById('client-view-container');
        if (!viewContainer) { console.error("Client view container not found!"); return; }

        accessFormView = viewContainer.querySelector('#access-form-view-client');
        meetingDetailsView = viewContainer.querySelector('#meeting-details-view-client');
        clientAccessForm = viewContainer.querySelector('#client-access-form');
        shareableIdInputClient = viewContainer.querySelector('#shareable-id-client');
        accessCodeInputClient = viewContainer.querySelector('#access-code-client');
        accessSubmitButtonClient = viewContainer.querySelector('#access-submit-button-client');
        accessErrorClient = viewContainer.querySelector('#access-error-client');
        detailsMeetingTitle = viewContainer.querySelector('#details-meeting-title-client');
        detailsMeetingDate = viewContainer.querySelector('#details-meeting-date-client');
        detailsMeetingStatus = viewContainer.querySelector('#details-meeting-status-client');
        detailsShareableIdClient = viewContainer.querySelector('#details-shareable-id-client');
        detailsMeetingIdClient = viewContainer.querySelector('#details-meeting-id-client');
        detailsMeetingNotes = viewContainer.querySelector('#details-meeting-notes-client');
        downloadPdfBtnClient = viewContainer.querySelector('#download-pdf-btn-client');
        analysisNotAvailable = viewContainer.querySelector('#analysis-not-available-client');
        analysisContentWrapper = viewContainer.querySelector('#analysis-content-wrapper-client');
        analysisTabs = viewContainer.querySelectorAll('#meeting-details-view-client .analysis-tab');
        analysisPanels = {
            summary: viewContainer.querySelector('#summary-content-panel-client'),
            keyPoints: viewContainer.querySelector('#key-points-content-panel-client'),
            actionItems: viewContainer.querySelector('#action-items-content-panel-client'),
            questions: viewContainer.querySelector('#questions-content-panel-client'),
            sentiment: viewContainer.querySelector('#sentiment-content-panel-client'),
        };
        questionForm = viewContainer.querySelector('#question-form-client');
        questionInput = viewContainer.querySelector('#question-input-client');
        askButton = viewContainer.querySelector('#ask-button-client');
        questionResultWrapper = viewContainer.querySelector('#question-result-wrapper-client');
        questionTextEl = viewContainer.querySelector('#question-text-client');
        answerTextEl = viewContainer.querySelector('#answer-text-client');
        questionHistory = viewContainer.querySelector('#question-history-client');
        mainMenuBtnClient = viewContainer.querySelector('#main-menu-btn-client');
        logoutBtnClient = viewContainer.querySelector('#logout-btn-client');

        const currentYearSpan = viewContainer.querySelector('#current-year-client');
        if(currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
    }

    function showClientView(viewName) { 
        if (!accessFormView || !meetingDetailsView || !logoutBtnClient) { return; }
        accessFormView.classList.toggle('hidden', viewName !== 'access');
        meetingDetailsView.classList.toggle('hidden', viewName !== 'details');
        logoutBtnClient.classList.toggle('hidden', viewName === 'access'); 
    }

    async function handleClientAccess(e) { 
        if(e) e.preventDefault(); 
        if(!clientAccessForm || !shareableIdInputClient || !accessCodeInputClient || !accessSubmitButtonClient) {
            console.error("Client access form elements not found!");
            return;
        }

        const shareableId = shareableIdInputClient.value.trim();
        const clientCode = accessCodeInputClient.value.trim();

        if(!shareableId || !clientCode) { 
            if(accessErrorClient) {
                accessErrorClient.textContent = "Shareable Meeting ID and Client Access Code are required.";
                accessErrorClient.classList.remove('hidden');
            }
            return; 
        }

        try {
            setButtonLoadingStateCallback(accessSubmitButtonClient, true);
            if(accessErrorClient) accessErrorClient.classList.add('hidden');

            const response = await validateClientAccessAPI(shareableId, clientCode);
            if (!response || !response.success || !response.data) {
                throw new Error('Invalid response from server');
            }

            currentClientMeeting = { 
                title: response.data.title,
                date: response.data.date,
                recordingId: response.data.recordingId,
                shareableIdUsed: shareableId,
                systemMeetingId: response.data.id,
                analysisData: response.data.analysisData
            };

            showClientView('details');
            await populateClientMeetingDetails();
            if (currentClientMeeting.analysisData) {
                populateClientAnalysisData(currentClientMeeting.analysisData);
            }
            questionHistoryArray = [];
            renderClientQuestionHistory();
            if(questionResultWrapper) questionResultWrapper.classList.add('hidden');

        } catch (error) {
            console.error('Error accessing meeting:', error);
            if(accessErrorClient) {
                accessErrorClient.textContent = error.message || 'Failed to access meeting. Please check your Shareable ID and Access Code.';
                accessErrorClient.classList.remove('hidden');
            }
        } finally {
            setButtonLoadingStateCallback(accessSubmitButtonClient, false);
        }
    }

    async function populateClientMeetingDetails() {
        if (!currentClientMeeting) return;

        if(detailsMeetingTitle) detailsMeetingTitle.textContent = escapeHtml(currentClientMeeting.title);
        if(detailsMeetingDate) detailsMeetingDate.textContent = new Date(currentClientMeeting.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
        if(detailsMeetingStatus) {
            detailsMeetingStatus.textContent = escapeHtml(currentClientMeeting.status);
            detailsMeetingStatus.className = `font-medium ${currentClientMeeting.status === 'Scheduled' ? 'text-green-600' : currentClientMeeting.status === 'Completed' ? 'text-green-600' :  currentClientMeeting.status === 'Processing' ? 'text-yellow-600' : 'text-gray-600'}`;
        }
        if(detailsShareableIdClient) detailsShareableIdClient.textContent = escapeHtml(currentClientMeeting.shareableIdUsed || 'N/A');
        if(detailsMeetingIdClient) detailsMeetingIdClient.textContent = escapeHtml(currentClientMeeting.systemMeetingId || 'N/A');
        if(detailsMeetingNotes) detailsMeetingNotes.textContent = escapeHtml(currentClientMeeting.notes || 'No notes provided.');

        if (downloadPdfBtnClient) downloadPdfBtnClient.classList.add('hidden');
        if (analysisContentWrapper) analysisContentWrapper.classList.add('hidden');
        if (analysisNotAvailable) analysisNotAvailable.classList.add('hidden');

        if (currentClientMeeting.status === 'Completed' && currentClientMeeting.recordingId) {
            if(analysisNotAvailable) analysisNotAvailable.classList.add('hidden');
            if(analysisContentWrapper) {
                analysisContentWrapper.classList.remove('hidden');
                Object.values(analysisPanels).forEach(p => { if(p) p.innerHTML = '<p class="text-center p-4">Loading analysis...</p>'; });
            }

            try {
                const analysisData = await fetchAnalysisDataAPI(currentClientMeeting.recordingId);
                if (analysisData) {
                    currentClientMeeting.analysisData = analysisData;
                    populateClientAnalysisData(analysisData);
                    if(downloadPdfBtnClient) downloadPdfBtnClient.classList.remove('hidden');
                } else {
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
                if(currentClientMeeting.status === 'Scheduled') {
                    if(p1) p1.textContent = "This meeting is scheduled for the future.";
                    if(p2) p2.textContent = "Analysis will be available after the meeting is recorded and processed.";
                } else if (currentClientMeeting.status === 'Processing'){
                    if(p1) p1.textContent = "Meeting analysis is currently processing.";
                    if(p2) p2.textContent = "Please check back later. You can refresh the page.";
                } else {
                    if(p1) p1.textContent = "Meeting analysis is not yet available.";
                    if(p2) p2.textContent = "Ensure the recording has been scheduled and processed.";
                }
            }
        }
    }

    async function handleClientQuestion(e){ 
        e.preventDefault();
        const q = questionInput.value.trim();
        if(!q) {
            showNotificationCallback("Please type a question.", "warning");
            return;
        }
        if(!currentClientMeeting || !currentClientMeeting.recordingId) {
            showNotificationCallback("No active meeting context for Q&A. Please access a meeting first.", "error");
            return;
        }
        if(askButton) setButtonLoadingStateCallback(askButton, true);
        
        try {
            const response = await queryAnalysisAPI(currentClientMeeting.recordingId, q); 
            
            if(questionTextEl) questionTextEl.textContent = q;
            if(answerTextEl) answerTextEl.innerHTML = response.answer || "No answer received from AI.";
            if(questionResultWrapper) questionResultWrapper.classList.remove('hidden');
            
            questionHistoryArray.unshift({question: q, answer: response.answer});
            if(questionHistoryArray.length > 3) questionHistoryArray.pop();
            renderClientQuestionHistory();
            if(questionInput) questionInput.value = '';

        } catch (error) {
             if(answerTextEl) answerTextEl.textContent = `Error fetching answer: ${error.message}`;
             if(questionResultWrapper) questionResultWrapper.classList.remove('hidden');
        } finally {
            if(askButton) setButtonLoadingStateCallback(askButton, false);
        }
    }

    function escapeHtml(unsafe) { // Basic HTML escaping
        if (typeof unsafe !== 'string') return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function renderClientQuestionHistory(){ 
        if (!questionHistory) return;
        questionHistory.innerHTML = ''; 
        if (questionHistoryArray.length === 0) {
            questionHistory.innerHTML = '<p class="text-gray-500 italic text-sm text-center py-3">No recent queries for this meeting.</p>';
            return;
        }
        questionHistoryArray.forEach((item, i) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'bg-white/70 p-3.5 rounded-lg shadow-sm border border-gray-200 text-sm fade-in';
            historyItem.style.setProperty('--delay', `${i*0.1}s`);
            historyItem.innerHTML = `
                <p class="mb-1.5"><strong class="text-gray-700">Q:</strong> ${escapeHtml(item.question)}</p>
                <p class="text-gray-600 leading-relaxed"><strong class="text-gray-700">A:</strong> ${item.answer}</p> 
            `; 
            questionHistory.appendChild(historyItem);
        });
    }

    async function handleDownloadClientPdf() { 
        if (!currentClientMeeting || !currentClientMeeting.recordingId) {
            showNotificationCallback("No meeting analysis loaded to download PDF.", "warning");
            return;
        }
        try {
            if(downloadPdfBtnClient) setButtonLoadingStateCallback(downloadPdfBtnClient, true); 
            await downloadAnalysisPdfAPI(currentClientMeeting.recordingId); 
        } catch (error) {
            console.error("Client PDF Download trigger failed:", error);
        } finally {
            if(downloadPdfBtnClient) setButtonLoadingStateCallback(downloadPdfBtnClient, false);
        }
    }

    function setupEventListeners() {
        if (!accessFormView) { console.error("Client DOM not fully initialized for event listeners."); return; }

        accessFormView.addEventListener('submit', handleClientAccess);
        
        if(analysisTabs) {
            analysisTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    analysisTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const targetPanelId = tab.dataset.tab + '-content-client';
                    Object.values(analysisPanels).forEach(panel => {if(panel) panel.classList.add('hidden');});
                    const targetPanel = document.getElementById(targetPanelId);
                    if(targetPanel) targetPanel.classList.remove('hidden');
                });
            });
        }
        if(questionForm) questionForm.addEventListener('submit', handleClientQuestion);
        
        if(logoutBtnClient) { 
            logoutBtnClient.addEventListener('click', () => { 
                showClientView('access'); 
                if(clientAccessForm) clientAccessForm.reset(); 
                currentClientMeeting = null; 
                questionHistoryArray = []; 
                if(questionResultWrapper) questionResultWrapper.classList.add('hidden');
                renderClientQuestionHistory();
                showNotificationCallback("Exited Meeting View. Enter new credentials to access another meeting.", "info");
            });
        }
        if(mainMenuBtnClient) { 
             mainMenuBtnClient.addEventListener('click', () => {
                switchViewCallback('index'); // This will navigate to landing-page.html
            });
        }
        if(downloadPdfBtnClient) { 
            downloadPdfBtnClient.addEventListener('click', (e) => {
                e.preventDefault(); // Good practice for buttons that trigger JS
                handleDownloadClientPdf();
            });
        }
    }

    return {
        init: (
            notifyCb, switchCb, 
            _setButtonLoadingStateCb, 
            _validateClientAccess, 
            _fetchAnalysis, // Kept for consistency, though validateClientAccessAPI returns data
            _queryAnalysis,
            _downloadPdf
        ) => {
            showNotificationCallback = notifyCb;
            switchViewCallback = switchCb;
            setButtonLoadingStateCallback = _setButtonLoadingStateCb;
            validateClientAccessAPI = _validateClientAccess;
            // fetchAnalysisDataAPI = _fetchAnalysis; // Not directly used for initial load
            queryAnalysisAPI = _queryAnalysis;
            downloadAnalysisPdfAPI = _downloadPdf;
            
            initDOMReferences(); 
            setupEventListeners();
            showClientView('access'); 
        },
        getHTML,
        attemptDirectAccess: async (meetingId, accessCode) => { 
            if(shareableIdInputClient) shareableIdInputClient.value = meetingId;
            if(accessCodeInputClient) accessCodeInputClient.value = accessCode;
            // Automatically submit the form if values are pre-filled
            if (shareableIdInputClient.value && accessCodeInputClient.value && accessSubmitButtonClient) {
                accessSubmitButtonClient.click(); // This will trigger handleClientAccess
            } else {
                 await handleClientAccess(); // Call if button click isn't feasible or for direct logic
            }
        }
    };
})();
