// /js/client-view.js
const ClientView = (() => {
    let meetings = []; // Shared meetings data from SharedAppLogic
    let showNotificationCallback;
    let switchViewCallback; // For window.location.href
    let setButtonLoadingStateCallback;
    let getMeetingByIdCallback;

    let currentClientMeeting = null;
    let questionHistoryArray = [];

    // DOM Elements (will be queried after HTML injection)
    let accessForm, accessCodeViewClient, meetingAnalysisViewClient, accessErrorClient, meetingIdInputClient, accessCodeInputClient, accessSubmitButtonClient;
    let meetingTitleDisplayClient, meetingDateDisplayClient, pdfLinkClient;
    let analysisTabsClient, analysisPanelsClient = {}, summaryContentClient, keyPointsContentClient, actionItemsContentClient, questionsContentClient;
    let questionFormClient, questionInputClient, askButtonClient, questionResultWrapperClient, questionTextElClient, answerTextElClient, questionHistoryClient;
    let logoutBtnClient, mainMenuBtnClient; // Removed backBtn as it's logout/main menu


    function getHTML() {
        // This HTML is from your original ClientView (Part 4 of the 4-part JS)
        return `
        <header class="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-xl sticky top-0 z-40">
            <div class="container mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center">
                <h1 class="text-xl sm:text-2xl font-bold mb-3 sm:mb-0 text-center sm:text-left tracking-tight flex items-center">
                    <i class="fas fa-users mr-3 text-2xl opacity-90"></i>Client Meeting Portal
                </h1>
                <div id="user-controls-client" class="fade-in" style="--delay: 1s;">
                    <button id="main-menu-btn-client" class="btn-header btn-hover px-4 py-2 transition mr-2 text-sm sm:text-base font-medium">
                        <i class="fas fa-home mr-2 icon-hover"></i>Main Site
                    </button>
                    <button id="logout-btn-client" class="btn-header btn-hover px-4 py-2 transition text-sm sm:text-base font-medium hidden">
                        <i class="fas fa-sign-out-alt mr-2 icon-hover"></i>Exit View
                    </button>
                </div>
            </div>
        </header>
        <main class="flex-grow container mx-auto p-5 sm:p-8">
            <div id="access-code-view-client" class="view-section max-w-lg mx-auto glass-effect p-7 sm:p-10 fade-in" style="--delay: 0.2s;">
                <h2 class="text-2xl sm:text-3xl font-bold mb-8 text-center text-gray-800 flex items-center justify-center"><i class="fas fa-shield-alt mr-3 text-green-600"></i>Secure Meeting Access</h2>
                <form id="access-form-client" class="space-y-6">
                    <div>
                        <label for="meeting-id-client" class="block text-gray-700 mb-1.5 font-semibold text-sm">Meeting ID</label>
                        <input type="text" id="meeting-id-client" class="w-full custom-input" required placeholder="Enter Meeting ID">
                    </div>
                    <div>
                        <label for="access-code-client" class="block text-gray-700 mb-1.5 font-semibold text-sm">Client Access Code</label>
                        <input type="text" id="access-code-client" class="w-full custom-input" required placeholder="Enter Your Access Code">
                    </div>
                    <button id="access-submit-client" type="submit" class="w-full btn-primary-green btn-hover text-white">
                        <span class="button-text"><i class="fas fa-key mr-2 icon-hover"></i>Access Meeting</span>
                        <span class="button-loader hidden"><i class="fas fa-spinner fa-spin mr-2"></i>Accessing...</span>
                    </button>
                </form>
                <p id="access-error-client" class="error mt-5 text-center hidden text-sm"></p>
            </div>
            <div id="meeting-analysis-view-client" class="view-section max-w-5xl mx-auto glass-effect p-7 sm:p-10 hidden fade-in">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-5">
                    <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 md:mb-0" id="meeting-title-client">Meeting Analysis</h2>
                    <a id="pdf-link-client" class="btn-primary-green btn-hover text-white flex items-center text-sm self-start md:self-center" href="#" target="_blank" download="meeting_analysis.pdf">
                        <i class="fas fa-file-pdf mr-2 icon-hover"></i> Download PDF
                    </a>
                </div>
                <div id="meeting-date-client" class="text-gray-600 mb-8 text-sm font-medium">Date:</div>
                <div class="mb-8">
                    <div class="border-b border-gray-300">
                        <nav class="flex flex-wrap -mb-px">
                            <button data-tab="summary" class="analysis-tab active">Summary</button>
                            <button data-tab="key-points" class="analysis-tab">Key Points</button>
                            <button data-tab="action-items" class="analysis-tab">Action Items</button>
                            <button data-tab="questions" class="analysis-tab">Questions Discussed</button>
                        </nav>
                    </div>
                </div>
                <div class="analysis-content min-h-[300px] analysis-content-bg">
                    <div id="summary-content-client" class="analysis-panel markdown-content fade-in"></div>
                    <div id="key-points-content-client" class="analysis-panel markdown-content hidden fade-in"></div>
                    <div id="action-items-content-client" class="analysis-panel markdown-content hidden fade-in"></div>
                    <div id="questions-content-client" class="analysis-panel markdown-content hidden fade-in"></div>
                </div>
                <div class="mt-10 p-7 bg-green-50/80 rounded-2xl border border-green-200/70 shadow-lg">
                    <h3 class="text-xl sm:text-2xl font-semibold mb-5 text-green-800 flex items-center"><i class="fas fa-question-circle mr-3 text-green-600"></i>Ask About This Meeting</h3>
                    <form id="question-form-client" class="mb-7">
                        <div class="flex items-center">
                            <input type="text" id="question-input-client" class="flex-grow p-3.5 border-gray-300 rounded-l-xl custom-input" placeholder="Type your question...">
                            <button type="submit" id="ask-button-client" class="btn-primary-green text-white px-5 py-3.5 rounded-r-xl btn-hover text-sm">
                                <span class="button-text"><i class="fas fa-paper-plane mr-2 icon-hover"></i>Ask</span>
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
                        <h4 class="font-semibold mb-4 text-green-700 text-lg">Recent Questions</h4>
                        <div id="question-history-client" class="space-y-4 max-h-72 overflow-y-auto p-1 custom-scrollbar">
                             <p class="text-gray-500 italic text-sm text-center py-3">No recent questions for this meeting.</p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
        <footer class="bg-gray-800 text-white py-6 text-center mt-auto">
            <p class="text-sm">&copy; <span id="current-year-client"></span> Meeting Analysis System (Client Portal). All rights reserved.</p>
        </footer>
        `;
    }

    function initDOMReferences() {
        const viewContainer = document.getElementById('client-view-container');
        if (!viewContainer) { console.error("Client view container not found."); return; }

        accessForm = viewContainer.querySelector('#access-form-client');
        accessCodeViewClient = viewContainer.querySelector('#access-code-view-client');
        meetingAnalysisViewClient = viewContainer.querySelector('#meeting-analysis-view-client');
        accessErrorClient = viewContainer.querySelector('#access-error-client');
        meetingIdInputClient = viewContainer.querySelector('#meeting-id-client');
        accessCodeInputClient = viewContainer.querySelector('#access-code-client');
        accessSubmitButtonClient = viewContainer.querySelector('#access-submit-client');
        
        meetingTitleDisplayClient = viewContainer.querySelector('#meeting-title-client');
        meetingDateDisplayClient = viewContainer.querySelector('#meeting-date-client');
        pdfLinkClient = viewContainer.querySelector('#pdf-link-client');
        
        analysisTabsClient = viewContainer.querySelectorAll('#meeting-analysis-view-client .analysis-tab');
        summaryContentClient = viewContainer.querySelector('#summary-content-client');
        keyPointsContentClient = viewContainer.querySelector('#key-points-content-client');
        actionItemsContentClient = viewContainer.querySelector('#action-items-content-client');
        questionsContentClient = viewContainer.querySelector('#questions-content-client');
        analysisPanelsClient = { 
            summary: summaryContentClient, 
            keyPoints: keyPointsContentClient, 
            actionItems: actionItemsContentClient, 
            questions: questionsContentClient 
        };
        
        questionFormClient = viewContainer.querySelector('#question-form-client');
        questionInputClient = viewContainer.querySelector('#question-input-client');
        askButtonClient = viewContainer.querySelector('#ask-button-client');
        questionResultWrapperClient = viewContainer.querySelector('#question-result-wrapper-client');
        questionTextElClient = viewContainer.querySelector('#question-text-client');
        answerTextElClient = viewContainer.querySelector('#answer-text-client');
        questionHistoryClient = viewContainer.querySelector('#question-history-client');
        
        logoutBtnClient = viewContainer.querySelector('#logout-btn-client');
        mainMenuBtnClient = viewContainer.querySelector('#main-menu-btn-client');

        const currentYearSpan = viewContainer.querySelector('#current-year-client');
        if(currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
    }

    function showClientView(viewName) { // 'access' or 'analysis'
        if (!accessCodeViewClient || !meetingAnalysisViewClient || !logoutBtnClient) {
            // console.error("Client sub-view elements not found.");
             return;
        }
        accessCodeViewClient.classList.toggle('hidden', viewName !== 'access');
        meetingAnalysisViewClient.classList.toggle('hidden', viewName !== 'analysis');
        logoutBtnClient.classList.toggle('hidden', viewName === 'access'); // Show "Exit View" only in analysis view
    }

    function handleClientAccess(e) {
        if(e) e.preventDefault(); // Allow calling without event for auto-submit
        if(accessErrorClient) accessErrorClient.classList.add('hidden');
        
        const id = meetingIdInputClient.value.trim();
        const code = accessCodeInputClient.value.trim();

        if(!id || !code) { 
            if(accessErrorClient) {
                accessErrorClient.textContent = "Meeting ID and Access Code are required.";
                accessErrorClient.classList.remove('hidden');
            }
            return; 
        }
        if(accessSubmitButtonClient) setButtonLoadingStateCallback(accessSubmitButtonClient, true);

        setTimeout(() => {
            // Find meeting by sales ID (m.id) or recorder ID (m.recorderId)
            const meeting = meetings.find(m => (m.id === id || m.recorderId === id) && m.clientCode === code && m.status === 'completed' && m.analysisData);
            
            if(meeting) {
                currentClientMeeting = meeting;
                if(meetingTitleDisplayClient) meetingTitleDisplayClient.textContent = `Analysis for: ${meeting.title}`;
                if(meetingDateDisplayClient) meetingDateDisplayClient.textContent = `Date: ${new Date(meeting.date).toLocaleDateString('en-US', { dateStyle: 'full' })}`;
                // if(pdfLinkClient) pdfLinkClient.href = meeting.analysisData.pdfUrl || "#"; // Placeholder for actual PDF link

                if(analysisPanelsClient.summary) analysisPanelsClient.summary.innerHTML = meeting.analysisData.summary || "<p>Summary not available.</p>";
                if(analysisPanelsClient.keyPoints) analysisPanelsClient.keyPoints.innerHTML = meeting.analysisData.keyPoints || "<p>Key points not available.</p>";
                if(analysisPanelsClient.actionItems) analysisPanelsClient.actionItems.innerHTML = meeting.analysisData.actionItems || "<p>Action items not available.</p>";
                if(analysisPanelsClient.questions) analysisPanelsClient.questions.innerHTML = meeting.analysisData.questions || "<p>Questions discussed not available.</p>";

                if(analysisTabsClient && analysisTabsClient.length > 0) {
                    analysisTabsClient.forEach(t => t.classList.remove('active'));
                    analysisTabsClient[0].classList.add('active'); // Activate summary tab
                }
                Object.values(analysisPanelsClient).forEach(p => { if(p) p.classList.add('hidden');});
                if(analysisPanelsClient.summary) analysisPanelsClient.summary.classList.remove('hidden');

                questionHistoryArray = []; 
                renderClientQuestionHistory();
                if(questionResultWrapperClient) questionResultWrapperClient.classList.add('hidden');
                showClientView('analysis');
                showNotificationCallback(`Successfully accessed meeting: ${meeting.title}`, "success");
            } else {
                if(accessErrorClient) {
                    accessErrorClient.textContent = "Invalid Meeting ID/Access Code, or analysis is not yet ready for this meeting.";
                    accessErrorClient.classList.remove('hidden');
                }
                showNotificationCallback("Access denied. Please check your credentials or try again later.", "error");
            }
            if(accessSubmitButtonClient) setButtonLoadingStateCallback(accessSubmitButtonClient, false);
        }, 800); // Simulate network delay
    }
    
    function handleClientQuestion(e){
        e.preventDefault();
        const q = questionInputClient.value.trim();
        if(!q || !currentClientMeeting) {
            showNotificationCallback("Please type a question.", "warning");
            return;
        }
        if(askButtonClient) setButtonLoadingStateCallback(askButtonClient, true);
        
        setTimeout(() => {
            if(questionTextElClient) questionTextElClient.textContent = q;
            let ans = "AI is processing your question...";
            
            const analysis = currentClientMeeting.analysisData;
            if (analysis) {
                if (q.toLowerCase().includes("summary") && analysis.summary) ans = analysis.summary;
                else if (q.toLowerCase().includes("action items") && analysis.actionItems) ans = analysis.actionItems;
                else if (q.toLowerCase().includes("key points") && analysis.keyPoints) ans = analysis.keyPoints;
                else if (q.toLowerCase().includes("questions discussed") && analysis.questions) ans = analysis.questions;
                else ans = "This is a simulated AI answer based on the available meeting content. For specific details, please refer to the relevant sections or ask a more targeted question.";
            } else {
                ans = "Analysis data is not currently available to answer your question for this meeting.";
            }
            
            if(answerTextElClient) answerTextElClient.innerHTML = ans; // Use innerHTML as analysis data might contain HTML
            if(questionResultWrapperClient) questionResultWrapperClient.classList.remove('hidden');
            
            questionHistoryArray.unshift({question: q, answer: ans});
            if(questionHistoryArray.length > 3) questionHistoryArray.pop(); // Keep history short
            renderClientQuestionHistory();
            
            if(questionInputClient) questionInputClient.value = '';
            if(askButtonClient) setButtonLoadingStateCallback(askButtonClient, false);
        }, 1000); // Simulate AI processing
    }

    function renderClientQuestionHistory(){
        if (!questionHistoryClient) return;
        questionHistoryClient.innerHTML = ''; 
        if (questionHistoryArray.length === 0) {
            questionHistoryClient.innerHTML = '<p class="text-gray-500 italic text-sm text-center py-3">No recent questions for this meeting.</p>';
            return;
        }
        questionHistoryArray.forEach((item, i) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'bg-white/70 p-3.5 rounded-lg shadow-sm border border-gray-200 text-sm fade-in';
            historyItem.style.setProperty('--delay', `${i*0.1}s`);
            historyItem.innerHTML = `
                <p class="mb-1.5"><strong class="text-gray-700">Q:</strong> ${item.question}</p>
                <p class="text-gray-600 leading-relaxed"><strong class="text-gray-700">A:</strong> ${item.answer}</p> 
            `; // Use innerHTML for answer
            questionHistoryClient.appendChild(historyItem);
        });
    }

    function setupEventListeners() {
        if (!accessForm) { /* console.error("Client DOM not fully initialized for event listeners."); */ return; }

        accessForm.addEventListener('submit', handleClientAccess);
        
        if(analysisTabsClient) {
            analysisTabsClient.forEach(tab => {
                tab.addEventListener('click', () => {
                    analysisTabsClient.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const targetPanelId = tab.dataset.tab + '-content-client';
                    Object.values(analysisPanelsClient).forEach(panel => {if(panel) panel.classList.add('hidden');});
                    const targetPanel = document.getElementById(targetPanelId);
                    if(targetPanel) targetPanel.classList.remove('hidden');
                });
            });
        }
        if(questionFormClient) questionFormClient.addEventListener('submit', handleClientQuestion);
        
        if(logoutBtnClient) { // "Exit View" button
            logoutBtnClient.addEventListener('click', () => { 
                showClientView('access'); // Go back to access code screen
                if(accessForm) accessForm.reset(); // Clear the form
                currentClientMeeting = null; // Clear current meeting context
                questionHistoryArray = []; // Clear history
                if(questionResultWrapperClient) questionResultWrapperClient.classList.add('hidden');
                renderClientQuestionHistory();
                showNotificationCallback("Exited Meeting View. Enter new credentials to access another meeting.", "info");
            });
        }
        if(mainMenuBtnClient) { // "Main Site" button
             mainMenuBtnClient.addEventListener('click', () => {
                switchViewCallback('index'); // Navigates to landing-page.html
            });
        }
    }

    return {
        init: (meetingsArr, notifyCb, switchCb, setLoadStateCb, getMeetingCb) => {
            meetings = meetingsArr;
            showNotificationCallback = notifyCb;
            switchViewCallback = switchCb;
            setButtonLoadingStateCallback = setLoadStateCb;
            getMeetingByIdCallback = getMeetingCb; // Store this callback

            initDOMReferences(); 
            setupEventListeners();
            showClientView('access'); // Start with access code view
            // console.log("Client View Initialized");
        },
        getHTML,
        attemptDirectAccess: (meetingId, accessCode) => { // Expose for auto-login from URL
            if(meetingIdInputClient) meetingIdInputClient.value = meetingId;
            if(accessCodeInputClient) accessCodeInputClient.value = accessCode;
            handleClientAccess(); // Call the internal handler
        }
    };
})();
