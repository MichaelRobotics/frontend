// /js/client-view.js
const ClientView = (function() {
    let showNotificationCallback, switchViewCallback, setButtonLoadingStateCallback;
    let queryAnalysisAPI, downloadAnalysisPdfAPI;
    let currentClientMeeting = null;

    // DOM References
    let clientDashboardContentArea, clientPageMessage;
    let meetingTitleDisplayClient, meetingDateDisplayClient, pdfLinkClientButton;
    let analysisTabsClient, summaryContentClient, keyPointsContentClient;
    let actionItemsContentClient, questionsContentClient;
    let questionFormClient, questionInputClient, askButtonClient;
    let questionResultWrapperClient, questionTextElClient, answerTextElClient;
    let questionHistoryClient;

    function getHTML() {
        const headerHTML = `
        <header class="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-xl sticky top-0 z-40">
            <div class="container mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center">
                <h1 class="text-xl sm:text-2xl font-bold mb-3 sm:mb-0 text-center sm:text-left tracking-tight flex items-center">
                    <i class="fas fa-users mr-3 text-2xl opacity-90"></i>Client Meeting Portal
                </h1>
                    <div id="user-controls-client" class="fade-in">
                        <button id="main-menu-btn-client" class="px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors btn-hover">
                            <i class="fas fa-home mr-2"></i>Main Site
                    </button>
                </div>
            </div>
            </header>`;

        const footerHTML = `
            <footer class="bg-gray-800 text-white py-6 text-center mt-auto">
                <p class="text-sm">&copy; <span id="current-year-client">${new Date().getFullYear()}</span> Meeting Analysis System (Client Portal). All rights reserved.</p>
            </footer>`;

        const mainContentHTML = `
        <main class="flex-grow container mx-auto p-5 sm:p-8">
                <div id="client-dashboard-content-area" class="view-section max-w-5xl mx-auto glass-effect p-7 sm:p-10 fade-in">
                    <p id="client-page-message" class="text-xl text-gray-500 text-center py-10">Loading analysis data...</p>
                    </div>
            </main>`;

        return headerHTML + mainContentHTML + footerHTML;
    }

    function getClientDashboardHTMLStructure() {
        return `
            <div id="meeting-analysis-view-client" class="view-section w-full">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-5">
                    <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 md:mb-0" id="meeting-title-client"></h2>
                    <button id="pdf-link-client" class="btn-primary-green btn-hover text-white px-4 py-2 rounded-lg shadow-md flex items-center">
                        <i class="fas fa-file-pdf mr-2"></i>Download PDF
                    </button>
                </div>
                <div id="meeting-date-client" class="text-gray-600 mb-8 text-sm font-medium"></div>
                
                <div class="analysis-tabs mb-6 flex space-x-1 border-b border-gray-200">
                    <button class="analysis-tab active px-4 py-2 text-sm font-medium" data-tab="summary">Summary</button>
                    <button class="analysis-tab px-4 py-2 text-sm font-medium" data-tab="key-points">Key Points</button>
                    <button class="analysis-tab px-4 py-2 text-sm font-medium" data-tab="action-items">Action Items</button>
                    <button class="analysis-tab px-4 py-2 text-sm font-medium" data-tab="questions">Ask Questions</button>
                </div>

                <div id="summary-content-client" class="analysis-panel"></div>
                <div id="key-points-content-client" class="analysis-panel hidden"></div>
                <div id="action-items-content-client" class="analysis-panel hidden"></div>
                <div id="questions-content-client" class="analysis-panel hidden">
                    <form id="question-form-client" class="mb-6">
                        <div class="flex gap-2">
                            <input type="text" id="question-input-client" class="custom-input flex-grow" placeholder="Ask a question about the meeting...">
                            <button type="submit" id="ask-button-client" class="btn-primary-green btn-hover">
                                <span class="button-text">Ask</span>
                                <span class="button-loader hidden"><i class="fas fa-spinner fa-spin"></i></span>
                            </button>
                        </div>
                    </form>
                    <div id="question-result-wrapper-client" class="hidden mb-6 p-4 bg-gray-50 rounded-lg">
                        <p class="font-medium text-gray-700 mb-2">Q: <span id="question-text-client"></span></p>
                        <p class="text-gray-600">A: <span id="answer-text-client"></span></p>
                    </div>
                    <div id="question-history-client" class="space-y-4"></div>
                </div>
            </div>`;
    }

    function initDOMReferences() {
        const viewContainer = document.getElementById('client-view-container');
        if (!viewContainer) {
            console.error("Client view container not found!");
            return;
        }

        clientDashboardContentArea = viewContainer.querySelector('#client-dashboard-content-area');
        if (clientDashboardContentArea) {
            clientPageMessage = clientDashboardContentArea.querySelector('#client-page-message');
        } else {
            console.error("Client dashboard content area not found!");
        }
    }

    function setupDashboardEventListeners() {
        if (analysisTabsClient) {
            analysisTabsClient.forEach(tab => {
                tab.addEventListener('click', () => {
                    const panels = clientDashboardContentArea.querySelectorAll('.analysis-panel');
                    analysisTabsClient.forEach(t => t.classList.remove('active'));
                    panels.forEach(p => {
                        p.classList.add('hidden');
                        p.classList.remove('fade-in');
                    });
                    tab.classList.add('active');
                    const targetPanelId = tab.dataset.tab + '-content-client';
                    const targetPanel = clientDashboardContentArea.querySelector('#' + targetPanelId);
                    if (targetPanel) {
                        targetPanel.classList.remove('hidden');
                        void targetPanel.offsetWidth;
                        targetPanel.classList.add('fade-in');
                    }
                });
            });
            if (analysisTabsClient.length > 0) {
                const summaryTab = Array.from(analysisTabsClient).find(tab => tab.dataset.tab === 'summary');
                if (summaryTab) summaryTab.click();
            }
        }

        if (questionFormClient) {
            questionFormClient.addEventListener('submit', handleClientQuestion);
        }
        if (pdfLinkClientButton) {
            pdfLinkClientButton.addEventListener('click', handleDownloadClientPdf);
        }
    }

    async function handleClientQuestion(e) {
        e.preventDefault();
        if (!currentClientMeeting || !questionInputClient || !askButtonClient) return;

        const question = questionInputClient.value.trim();
        if (!question) return;

        try {
            setButtonLoadingStateCallback(askButtonClient, true);
            const response = await queryAnalysisAPI(currentClientMeeting.recordingId, question);
            
            if (response.success) {
                // Add to history
                const historyItem = document.createElement('div');
                historyItem.className = 'p-4 bg-gray-50 rounded-lg';
                historyItem.innerHTML = `
                    <p class="font-medium text-gray-700 mb-2">Q: ${escapeHtml(question)}</p>
                    <p class="text-gray-600">A: ${escapeHtml(response.answer)}</p>
                `;
                questionHistoryClient.insertBefore(historyItem, questionHistoryClient.firstChild);
                
                // Clear input
                questionInputClient.value = '';
            } else {
                showNotificationCallback('Failed to get answer. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error querying analysis:', error);
            showNotificationCallback('Error processing your question. Please try again.', 'error');
        } finally {
            setButtonLoadingStateCallback(askButtonClient, false);
        }
    }

    async function handleDownloadClientPdf() {
        if (!currentClientMeeting || !pdfLinkClientButton) return;

        try {
            setButtonLoadingStateCallback(pdfLinkClientButton, true);
            const response = await downloadAnalysisPdfAPI(currentClientMeeting.recordingId);
            
            if (response.success) {
                const link = document.createElement('a');
                link.href = response.url;
                link.download = `meeting-analysis-${currentClientMeeting.recordingId}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                showNotificationCallback('Failed to generate PDF. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error downloading PDF:', error);
            showNotificationCallback('Error generating PDF. Please try again.', 'error');
        } finally {
            setButtonLoadingStateCallback(pdfLinkClientButton, false);
        }
    }

    function populateAndShowDashboard(status, storedDataString) {
        if (!clientDashboardContentArea) {
            console.error("Cannot populate dashboard, content area not found.");
            document.body.innerHTML = "<p class='text-center p-8 text-red-500'>Error: Client page structure failed to initialize.</p>";
            return;
        }

        if (status === 'success' && storedDataString) {
            const meetingData = JSON.parse(storedDataString);
            currentClientMeeting = {
                recordingId: meetingData.recordingId,
                title: meetingData.title
            };

            // Inject the dashboard structure
            clientDashboardContentArea.innerHTML = getClientDashboardHTMLStructure();

            // Get references to dashboard elements
            meetingTitleDisplayClient = clientDashboardContentArea.querySelector('#meeting-title-client');
            meetingDateDisplayClient = clientDashboardContentArea.querySelector('#meeting-date-client');
            pdfLinkClientButton = clientDashboardContentArea.querySelector('#pdf-link-client');
            analysisTabsClient = clientDashboardContentArea.querySelectorAll('.analysis-tab');
            summaryContentClient = clientDashboardContentArea.querySelector('#summary-content-client');
            keyPointsContentClient = clientDashboardContentArea.querySelector('#key-points-content-client');
            actionItemsContentClient = clientDashboardContentArea.querySelector('#action-items-content-client');
            questionsContentClient = clientDashboardContentArea.querySelector('#questions-content-client');
            questionFormClient = clientDashboardContentArea.querySelector('#question-form-client');
            questionInputClient = clientDashboardContentArea.querySelector('#question-input-client');
            askButtonClient = clientDashboardContentArea.querySelector('#ask-button-client');
            questionResultWrapperClient = clientDashboardContentArea.querySelector('#question-result-wrapper-client');
            questionTextElClient = clientDashboardContentArea.querySelector('#question-text-client');
            answerTextElClient = clientDashboardContentArea.querySelector('#answer-text-client');
            questionHistoryClient = clientDashboardContentArea.querySelector('#question-history-client');

            // Populate the dashboard
            if (meetingTitleDisplayClient) {
                meetingTitleDisplayClient.textContent = `Analysis for: ${escapeHtml(meetingData.title)}`;
            }
            if (meetingDateDisplayClient) {
                meetingDateDisplayClient.textContent = `Date: ${new Date(meetingData.date).toLocaleDateString('en-US', { dateStyle: 'full' })}`;
            }

            const analysisData = meetingData.analysisData;
            if (summaryContentClient) {
                summaryContentClient.innerHTML = analysisData.summary || "<p>Summary not available.</p>";
            }
            if (keyPointsContentClient) {
                keyPointsContentClient.innerHTML = (analysisData.keyPoints && analysisData.keyPoints.length > 0) 
                    ? `<ul>${analysisData.keyPoints.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` 
                    : "<p>Key points not available.</p>";
            }
            if (actionItemsContentClient) {
                actionItemsContentClient.innerHTML = (analysisData.actionItems && analysisData.actionItems.length > 0)
                    ? `<ul>${analysisData.actionItems.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
                    : "<p>Action items not available.</p>";
            }

            // Set up event listeners for the dashboard
            setupDashboardEventListeners();
        } else {
            let message = "No meeting analysis data found. Please try accessing your meeting again from the main page.";
            if (storedDataString) {
                try {
                    const errorData = JSON.parse(storedDataString);
                    if (errorData.message) message = errorData.message;
                } catch(e) { /* use default message */ }
            }
            clientDashboardContentArea.innerHTML = `
                <p class="text-center text-red-500 p-8">${escapeHtml(message)}</p>
                <div class="text-center mt-4">
                    <a href="landing-page.html" class="btn-primary-green">Go to Main Page</a>
                </div>`;
        }
    }

    return {
        init: (notifyCb, switchCb, setLoadStateCb, queryAnalysis, downloadPdf) => {
            showNotificationCallback = notifyCb;
            switchViewCallback = switchCb;
            setButtonLoadingStateCallback = setLoadStateCb;
            queryAnalysisAPI = queryAnalysis;
            downloadAnalysisPdfAPI = downloadPdf;
            
            initDOMReferences(); 

            const mainMenuBtn = document.getElementById('main-menu-btn-client');
            if (mainMenuBtn) {
                mainMenuBtn.addEventListener('click', () => switchViewCallback('index'));
            }
        },
        getHTML,
        populateAndShowDashboard
    };
})();
