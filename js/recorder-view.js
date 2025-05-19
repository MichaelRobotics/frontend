// /js/recorder-view.js
const RecorderView = (() => {
    // Local cache of meetings, fetched from backend via SharedAppLogic
    let meetings = []; 
    
    // Callbacks from SharedAppLogic, assigned during init
    let showNotificationCallback;
    let switchViewCallback;
    let setButtonLoadingStateCallback;
    let getMeetingByIdCallback; 
    let updateMeetingCallback;  // Expected to be SharedAppLogic.updateMeetingAPI
    let addMeetingCallback;     // Expected to be SharedAppLogic.createMeetingAPI (for ad-hoc)
    let fetchMeetingsAPI;       
    let uploadRecordingAPI;
    let fetchAnalysisStatusAPI;
    let fetchAnalysisDataAPI;
    let downloadAnalysisPdfAPI; 
    let generateIdCallback;     

    // State variables for recording
    let currentRecorderMeeting = null; // Holds the meeting object currently being recorded or viewed for analysis
    let isRecording = false, isPaused = false, recordingStartTime, accumulatedPausedTime = 0, pauseStartTime, timerInterval, pollingInterval;
    let mediaRecorder, audioChunks = [], audioStreamForVisualizer, currentStreamTracks = [];
    let audioContext, analyser, visualizerFrameId;

    // DOM Elements - to be populated by initDOMReferences
    let meetingListViewRec, recordingViewRec, analysisViewRec;
    let newRecordingBtnRec, meetingListRec, noMeetingsMessageRec;
    let recordingMeetingTitleElemRec, meetingTitleInputElemRec, stopBtnElemRec, pauseResumeBtnElemRec, recordingIndicatorElemRec, recordingStatusTextElemRec, recordingTimeDisplayElemRec, recordingProgressElemRec, audioInputSelectElemRec, audioVisualizerCanvasElemRec, meetingNotesElemRec, audioQualitySelectElemRec;
    let analysisMeetingTitleElemRec, analysisDateDisplayElemRec, analysisProgressSectionElemRec, analysisStatusTextElemRec, analysisProgressPercentageElemRec, analysisProgressBarElemRec, analysisContentSectionElemRec, analysisTabsElemsRec, analysisPanelsElemsRec;
    let backToListBtnRec, logoutBtnRec, mainMenuBtnRec, downloadTranscriptBtnRec, downloadPdfBtnRec;

    /**
     * Returns the HTML structure for the recorder view.
     * This HTML is typically injected into a container element on recorder.html.
     */
    function getHTML() {
        // This HTML should match the structure expected by initDOMReferences.
        // It's taken from the user-provided michaelrobotics/frontend/frontend-prod-api/recorder.html
        return `
        <header class="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-xl sticky top-0 z-40">
            <div class="container mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center">
                <h1 class="text-xl sm:text-2xl font-bold mb-3 sm:mb-0 text-center sm:text-left tracking-tight flex items-center">
                    <i class="fas fa-microphone-alt mr-3 text-2xl opacity-90"></i>Meeting Recorder Portal
                </h1>
                <div id="user-controls-rec" class="fade-in" style="--delay: 1s;">
                    <button id="back-to-list-btn-rec" class="btn-header btn-hover px-4 py-2 transition mr-2 text-sm sm:text-base font-medium hidden">
                        <i class="fas fa-arrow-left mr-2 icon-hover"></i>My Recordings
                    </button>
                    <button id="main-menu-btn-rec" class="btn-header btn-hover px-4 py-2 transition mr-2 text-sm sm:text-base font-medium">
                        <i class="fas fa-th-large mr-2 icon-hover"></i>App Dashboard
                    </button>
                    <button id="logout-btn-rec" class="btn-header btn-hover px-4 py-2 transition text-sm sm:text-base font-medium">
                        <i class="fas fa-sign-out-alt mr-2 icon-hover"></i>Logout Role
                    </button>
                </div>
            </div>
        </header>
        <main class="flex-grow container mx-auto p-5 sm:p-8">
            <div id="meeting-list-view-rec" class="view-section max-w-4xl mx-auto fade-in" style="--delay: 0.2s;">
                <div class="flex flex-col sm:flex-row justify-between items-center mb-8">
                    <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-0">Available Meetings for Recording</h2>
                    <button id="new-recording-btn-rec" class="btn-primary-blue btn-hover text-white flex items-center self-start sm:self-center">
                        <i class="fas fa-plus mr-2 icon-hover"></i> Start Ad-hoc Recording
                    </button>
                </div>
                <p class="text-sm text-gray-600 mb-4">Select a scheduled meeting to record, or start an ad-hoc recording. Recordings marked 'Completed' can have their analysis viewed.</p>
                <div id="meeting-list-rec" class="space-y-5">
                    <p id="no-meetings-message-rec" class="text-center text-gray-500 py-8 text-lg italic hidden">Fetching meetings...</p>
                </div>
            </div>
            <div id="recording-view-rec" class="view-section max-w-4xl mx-auto glass-effect p-7 sm:p-10 hidden fade-in">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 sm:mb-0" id="recording-meeting-title-rec">New Recording</h2>
                    <div class="flex space-x-3 self-start sm:self-center">
                        <button id="stop-btn-rec" class="btn-danger btn-hover flex items-center" disabled>
                            <span class="button-text"><i class="fas fa-stop mr-2 icon-hover"></i>Stop</span>
                            <span class="button-loader hidden"><i class="fas fa-spinner fa-spin mr-2"></i>Stopping...</span>
                        </button>
                        <button id="pause-resume-btn-rec" class="btn-warning btn-hover flex items-center" disabled>
                            <span class="button-text"><i class="fas fa-pause mr-2 icon-hover"></i>Pause</span>
                        </button>
                    </div>
                </div>
                <div class="mb-6 p-4 bg-blue-50/70 rounded-xl border border-blue-200/70">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center">
                            <div id="recording-indicator-rec" class="w-3.5 h-3.5 bg-gray-400 rounded-full mr-2.5"></div>
                            <span id="recording-status-text-rec" class="text-gray-700 font-medium">Idle</span>
                        </div>
                        <div id="recording-time-rec" class="text-gray-700 font-semibold text-lg">00:00:00</div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700"><div id="recording-progress-rec" class="bg-blue-500 h-2.5 rounded-full" style="width: 0%"></div></div>
                    <canvas id="audio-visualizer-rec" class="w-full h-20 mt-4 bg-gray-100 rounded-lg"></canvas>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                        <h3 class="text-lg font-semibold mb-3 text-blue-800">Audio Settings</h3>
                        <div class="space-y-4 p-4 bg-white/50 rounded-lg border border-gray-200">
                            <div><label for="audio-input-rec" class="block text-gray-700 mb-1.5 text-sm font-medium">Audio Input</label><select id="audio-input-rec" class="w-full custom-input"></select></div>
                            <div><label for="audio-quality-rec" class="block text-gray-700 mb-1.5 text-sm font-medium">Recording Quality</label><select id="audio-quality-rec" class="w-full custom-input"><option value="high">High (e.g., 128kbps)</option><option value="medium" selected>Medium (e.g., 96kbps)</option><option value="low">Low (e.g., 64kbps)</option></select></div>
                        </div>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold mb-3 text-blue-800">Meeting Details</h3>
                        <div class="space-y-4 p-4 bg-white/50 rounded-lg border border-gray-200">
                            <div><label for="meeting-title-input-rec" class="block text-gray-700 mb-1.5 text-sm font-medium">Title</label><input type="text" id="meeting-title-input-rec" class="w-full custom-input" placeholder="e.g., Weekly Sync"></div>
                            <div><label for="meeting-notes-rec" class="block text-gray-700 mb-1.5 text-sm font-medium">Notes (Context for AI)</label><textarea id="meeting-notes-rec" class="w-full custom-input custom-textarea" placeholder="Key topics, participants, objectives..."></textarea></div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="analysis-view-rec" class="view-section max-w-5xl mx-auto glass-effect p-7 sm:p-10 hidden fade-in">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-5">
                    <h2 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 md:mb-0" id="analysis-meeting-title-rec">Analysis</h2>
                    <div class="flex flex-wrap gap-2 self-start md:self-center">
                        <button id="download-transcript-btn-rec" class="btn-primary-blue btn-hover flex items-center text-sm"><i class="fas fa-file-alt mr-2 icon-hover"></i> Transcript</button>
                        <button id="download-pdf-btn-rec" class="btn-success btn-hover flex items-center text-sm"> 
                            <i class="fas fa-file-pdf mr-2 icon-hover"></i> Download PDF Report
                        </button>
                    </div>
                </div>
                <div id="analysis-date-display-rec" class="text-gray-600 mb-8 text-sm font-medium">Recorded:</div>
                <div id="analysis-progress-section-rec" class="mb-8 p-4 bg-blue-50/70 rounded-xl border border-blue-200/70">
                    <div class="flex items-center justify-between mb-2">
                        <span id="analysis-status-text-rec" class="text-blue-700 font-medium">Processing...</span>
                        <span id="analysis-progress-percentage-rec" class="text-blue-700 font-semibold">0%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700"><div id="analysis-progress-bar-rec" class="bg-blue-500 h-2.5 rounded-full" style="width: 0%"></div></div>
                </div>
                <div id="analysis-content-section-rec" class="hidden">
                    <div class="mb-8"><div class="border-b border-gray-300"><nav class="flex flex-wrap -mb-px">
                        <button data-tab="summary" class="analysis-tab active">Summary</button>
                        <button data-tab="transcript" class="analysis-tab">Transcript</button>
                    </nav></div></div>
                    <div class="analysis-content min-h-[300px] analysis-content-bg">
                        <div id="summary-content-panel-rec" class="analysis-panel markdown-content fade-in"></div>
                        <div id="transcript-content-panel-rec" class="analysis-panel markdown-content hidden fade-in whitespace-pre-wrap text-sm"></div>
                    </div>
                </div>
            </main>
            <footer class="bg-gray-800 text-white py-6 text-center mt-auto">
                <p class="text-sm">&copy; <span id="current-year-recorder">${new Date().getFullYear()}</span> Meeting Analysis System (Recorder View). All rights reserved.</p>
            </footer>
        `;
    }
    
    /**
     * Initializes references to DOM elements used by the recorder view.
     */
    function initDOMReferences() {
        const viewContainer = document.getElementById('recorder-view-container');
        if (!viewContainer) { console.error("Recorder view container not found!"); return; }

        meetingListViewRec = viewContainer.querySelector('#meeting-list-view-rec');
        recordingViewRec = viewContainer.querySelector('#recording-view-rec');
        analysisViewRec = viewContainer.querySelector('#analysis-view-rec');
        newRecordingBtnRec = viewContainer.querySelector('#new-recording-btn-rec');
        meetingListRec = viewContainer.querySelector('#meeting-list-rec');
        noMeetingsMessageRec = viewContainer.querySelector('#no-meetings-message-rec');
        
        recordingMeetingTitleElemRec = viewContainer.querySelector('#recording-meeting-title-rec');
        meetingTitleInputElemRec = viewContainer.querySelector('#meeting-title-input-rec');
        stopBtnElemRec = viewContainer.querySelector('#stop-btn-rec');
        pauseResumeBtnElemRec = viewContainer.querySelector('#pause-resume-btn-rec');
        recordingIndicatorElemRec = viewContainer.querySelector('#recording-indicator-rec');
        recordingStatusTextElemRec = viewContainer.querySelector('#recording-status-text-rec');
        recordingTimeDisplayElemRec = viewContainer.querySelector('#recording-time-rec');
        recordingProgressElemRec = viewContainer.querySelector('#recording-progress-rec');
        audioInputSelectElemRec = viewContainer.querySelector('#audio-input-rec');
        audioVisualizerCanvasElemRec = viewContainer.querySelector('#audio-visualizer-rec');
        meetingNotesElemRec = viewContainer.querySelector('#meeting-notes-rec');
        audioQualitySelectElemRec = viewContainer.querySelector('#audio-quality-rec');
        
        analysisMeetingTitleElemRec = viewContainer.querySelector('#analysis-meeting-title-rec');
        analysisDateDisplayElemRec = viewContainer.querySelector('#analysis-date-display-rec');
        analysisProgressSectionElemRec = viewContainer.querySelector('#analysis-progress-section-rec');
        analysisStatusTextElemRec = viewContainer.querySelector('#analysis-status-text-rec');
        analysisProgressPercentageElemRec = viewContainer.querySelector('#analysis-progress-percentage-rec');
        analysisProgressBarElemRec = viewContainer.querySelector('#analysis-progress-bar-rec');
        analysisContentSectionElemRec = viewContainer.querySelector('#analysis-content-section-rec');
        analysisTabsElemsRec = viewContainer.querySelectorAll('#analysis-view-rec .analysis-tab');
        analysisPanelsElemsRec = {
            summary: viewContainer.querySelector('#summary-content-panel-rec'),
            transcript: viewContainer.querySelector('#transcript-content-panel-rec'),
        };
        
        backToListBtnRec = viewContainer.querySelector('#back-to-list-btn-rec');
        logoutBtnRec = viewContainer.querySelector('#logout-btn-rec');
        mainMenuBtnRec = viewContainer.querySelector('#main-menu-btn-rec');
        downloadTranscriptBtnRec = viewContainer.querySelector('#download-transcript-btn-rec');
        downloadPdfBtnRec = viewContainer.querySelector('#download-pdf-btn-rec'); 

        const currentYearSpan = viewContainer.querySelector('#current-year-recorder');
        if(currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
    }

    /**
     * Shows the specified view section (list, recording, analysis) and hides others.
     * @param {string} viewName - The name of the view to show ('list', 'recording', 'analysis').
     */
    function showRecorderView(viewName) {
        if (!meetingListViewRec || !recordingViewRec || !analysisViewRec || !backToListBtnRec) {
            console.error("Recorder view elements not fully initialized for showRecorderView.");
            return;
        }
        meetingListViewRec.classList.add('hidden');
        recordingViewRec.classList.add('hidden');
        analysisViewRec.classList.add('hidden');
        
        // Control visibility of the "Back to List" button
        if (viewName === 'list') {
            backToListBtnRec.classList.add('hidden');
            meetingListViewRec.classList.remove('hidden');
        } else if (viewName === 'recording') {
            backToListBtnRec.classList.remove('hidden');
            recordingViewRec.classList.remove('hidden');
        } else if (viewName === 'analysis') {
            backToListBtnRec.classList.remove('hidden');
            analysisViewRec.classList.remove('hidden');
        }
    }
    
    /**
     * Maps backend meeting statuses to human-readable text.
     * @param {string} status - The status string from the backend.
     * @returns {string} Human-readable status.
     */
    function getMeetingStatusText(status) {
        if (!status) return 'Unknown';
        const lowerStatus = status.toLowerCase();
        switch (lowerStatus) {
            case 'scheduled': return 'Scheduled';
            case 'recording': return 'Recording Now';
            case 'uploading_to_backend': return 'Uploading...';
            case 'processing': return 'Processing Analysis';
            case 'completed': return 'Completed & Analyzed';
            case 'analyzed': return 'Analyzed'; // Could be same as 'completed' for display
            case 'recorded': return 'Recorded (Pending Analysis)';
            case 'failed_to_start': return 'Failed to Start';
            case 'upload_failed': return 'Upload Failed';
            case 'status_check_error': return 'Status Check Error';
            case 'failed': return 'Failed';
            case 'failed_empty_recording': return 'Empty Recording - Failed';
            default: return status.charAt(0).toUpperCase() + status.slice(1); // Capitalize if unknown
        }
    }

    /**
     * Maps backend meeting statuses to CSS classes for styling indicators.
     * @param {string} status - The status string from the backend.
     * @returns {string} CSS class name.
     */
    function getMeetingStatusClass(status) {
        if (!status) return 'status-unknown';
        const lowerStatus = status.toLowerCase();
        switch (lowerStatus) {
            case 'scheduled': return 'status-scheduled'; // e.g., bg-purple-500 text-white
            case 'recording': return 'status-recording'; // e.g., bg-red-500 text-white (with pulse animation)
            case 'uploading_to_backend': return 'status-uploading_to_backend'; // e.g., bg-blue-500 text-white (with pulse)
            case 'processing': return 'status-processing'; // e.g., bg-yellow-500 text-black (with pulse)
            case 'completed':
            case 'analyzed':
                return 'status-completed'; // e.g., bg-green-500 text-white
            case 'recorded': return 'status-processing'; // Or a distinct 'status-recorded' e.g. bg-indigo-500 text-white
            case 'failed_to_start':
            case 'upload_failed':
            case 'status_check_error':
            case 'failed':
            case 'failed_empty_recording':
                return 'status-failed'; // e.g., bg-red-700 text-white
            default: return 'status-unknown'; // e.g., bg-gray-400 text-black
        }
    }

    /**
     * Renders the list of meetings available for recording.
     * Called after meetings are fetched.
     */
    async function renderRecorderMeetingList() {
        if (!meetingListRec) {
            console.error('Meeting list container (#meeting-list-rec) not found in DOM.');
            return;
        }
    
        meetingListRec.innerHTML = ''; 
        
        if (!meetings || meetings.length === 0) {
            if (noMeetingsMessageRec) {
                noMeetingsMessageRec.textContent = 'No meetings found or scheduled for recording.';
                noMeetingsMessageRec.classList.remove('hidden');
            } else { // Fallback if noMeetingsMessageRec element itself is missing
                meetingListRec.innerHTML = '<div class="no-meetings text-center text-gray-500 py-8 text-lg italic">No meetings found or scheduled for recording.</div>';
            }
            return;
        }
    
        if (noMeetingsMessageRec) noMeetingsMessageRec.classList.add('hidden');
    
        const sortedMeetings = [...meetings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
        sortedMeetings.forEach(meeting => {
            const meetingItemElement = document.createElement('div');
            meetingItemElement.className = 'meeting-item-card bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow duration-200 cursor-pointer mb-3'; // Base styling
            
            const statusText = getMeetingStatusText(meeting.status);
            const statusClass = getMeetingStatusClass(meeting.status); // This should return a CSS class for background/text color
            
            meetingItemElement.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-lg font-semibold text-blue-700 flex-grow pr-2">${meeting.title}</h3>
                    <span class="status-indicator-text text-xs font-semibold px-2 py-1 rounded-full ${statusClass}">${statusText}</span>
                </div>
                <p class="text-sm text-gray-600 mb-1">
                    <i class="fas fa-calendar-alt mr-2 text-gray-400"></i>
                    ${new Date(meeting.date).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                ${meeting.clientEmail ? `<p class="text-sm text-gray-600 mb-1"><i class="fas fa-user-friends mr-2 text-gray-400"></i>Client: ${meeting.clientEmail}</p>` : ''}
                ${meeting.notes ? `<p class="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">Notes: ${meeting.notes.substring(0,100)}${meeting.notes.length > 100 ? '...' : ''}</p>` : ''}
            `;
            
            const nonStartableStatuses = ['recording', 'uploading_to_backend', 'processing', 'completed', 'analyzed', 'failed', 'failed_to_start', 'upload_failed', 'status_check_error', 'failed_empty_recording'];
            const currentStatusLower = meeting.status?.toLowerCase();

            if (!nonStartableStatuses.includes(currentStatusLower)) {
                meetingItemElement.addEventListener('click', () => {
                    handleStartScheduledRecording(meeting.id); // Pass the main meeting ID (sm-...)
                });
            } else {
                meetingItemElement.classList.remove('cursor-pointer');
                meetingItemElement.classList.add('opacity-70'); 
                if (['completed', 'analyzed'].includes(currentStatusLower) && meeting.recordingId) {
                    meetingItemElement.classList.add('cursor-pointer'); 
                    meetingItemElement.classList.remove('opacity-70');
                    meetingItemElement.addEventListener('click', () => {
                        handleViewRecorderAnalysis(meeting.recordingId); // Use recordingId (rec-...) here
                    });
                }
            }
            meetingListRec.appendChild(meetingItemElement);
        });
    }

    /**
     * Handles the initiation of a pre-scheduled meeting recording.
     * @param {string} meetingId - The primary ID (sm-...) of the meeting to start.
     */
    async function handleStartScheduledRecording(meetingId) { 
        try {
            if (isRecording) {
                showNotificationCallback("A recording is already in progress. Please stop it before starting another.", "warning");
                return;
            }
            if (!meetingId) {
                showNotificationCallback('Invalid meeting ID provided.', 'error');
                console.error('Invalid meeting ID for handleStartScheduledRecording');
                return;
            }
    
            const meetingObject = getMeetingByIdCallback(meetingId); 
            if (!meetingObject) {
                showNotificationCallback('Scheduled meeting not found. Please refresh the list.', 'error');
                return;
            }
    
            const currentStatusLower = meetingObject.status?.toLowerCase();
            const nonStartableStatuses = ['recording', 'uploading_to_backend', 'processing', 'completed', 'analyzed', 'failed', 'failed_to_start', 'upload_failed', 'status_check_error', 'failed_empty_recording'];
            if (nonStartableStatuses.includes(currentStatusLower)) {
                showNotificationCallback(`Meeting "${meetingObject.title}" is currently '${getMeetingStatusText(meetingObject.status)}' and cannot be started.`, 'warning');
                if (['completed', 'analyzed'].includes(currentStatusLower) && meetingObject.recordingId) {
                    // Optionally, directly navigate to analysis view:
                    // handleViewRecorderAnalysis(meetingObject.recordingId);
                }
                return;
            }
    
            const meetingTime = new Date(meetingObject.date);
            const now = new Date();
            const timeDiffMinutes = (meetingTime.getTime() - now.getTime()) / (1000 * 60);
            const allowStartBeforeMinutes = 5; 
            const tooLateAfterMinutes = 60;    

            if (timeDiffMinutes > allowStartBeforeMinutes) {
                showNotificationCallback(`Meeting "${meetingObject.title}" is scheduled for ${meetingTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}. Please wait.`, 'warning');
                return;
            }
            if (timeDiffMinutes < -tooLateAfterMinutes) {
                showNotificationCallback(`Meeting "${meetingObject.title}" was scheduled for ${meetingTime.toLocaleString()} and is too far in the past to start recording.`, 'warning');
                return;
            }
    
            if (!meetingObject.recordingId) { // recordingId is the rec-xxxx ID
                showNotificationCallback('This meeting is missing an associated recording identifier. Cannot start recording.', 'error');
                console.error('Error: meetingObject.recordingId is missing for scheduled meeting:', meetingObject);
                return;
            }

            currentRecorderMeeting = {
                ...meetingObject, 
                id: meetingObject.id, // This is the main meeting ID (sm-...)
                recorderId: meetingObject.recordingId, // This is the specific ID for the recording (rec-...)
                // notes and title are spread from meetingObject
                audioQuality: audioQualitySelectElemRec ? audioQualitySelectElemRec.value : 'medium' // Set current quality
            };
    
            if (meetingTitleInputElemRec) {
                meetingTitleInputElemRec.value = currentRecorderMeeting.title;
                meetingTitleInputElemRec.readOnly = true; 
            }
            if (meetingNotesElemRec) {
                meetingNotesElemRec.value = currentRecorderMeeting.notes || '';
                meetingNotesElemRec.readOnly = true; // For scheduled, notes are usually fixed by salesperson
            }
            if (recordingMeetingTitleElemRec) {
                recordingMeetingTitleElemRec.textContent = `Recording: ${currentRecorderMeeting.title}`;
            }
    
            showRecorderView('recording');
            await startActualRecording(); 
    
        } catch (error) {
            console.error('Error starting scheduled recording:', error);
            showNotificationCallback('Failed to start recording: ' + (error.message || 'Unknown error'), 'error');
            currentRecorderMeeting = null; 
            showRecorderView('list'); 
        }
    }
    
    /**
     * Fetches meetings from the backend and renders them in the list.
     */
    async function refreshMeetingsForRecorder() {
        try {
            if (noMeetingsMessageRec) {
                noMeetingsMessageRec.textContent = "Fetching meetings...";
                noMeetingsMessageRec.classList.remove('hidden');
            }
            const response = await fetchMeetingsAPI(); 
            // Ensure meetings is always an array, even if response.data is null/undefined
            meetings = (response && response.success && Array.isArray(response.data)) ? response.data : []; 
            
            renderRecorderMeetingList(); // This will handle the "No meetings" message if meetings array is empty

        } catch (error) {
            console.error("Error fetching meetings in RecorderView:", error);
            meetings = []; // Ensure meetings is an empty array on error
            renderRecorderMeetingList(); // Call render to show appropriate message
            // The noMeetingsMessageRec might be set by renderRecorderMeetingList itself,
            // but as a fallback:
            if (noMeetingsMessageRec && meetings.length === 0) { 
                noMeetingsMessageRec.textContent = "Could not load meetings. Please try refreshing.";
                noMeetingsMessageRec.classList.remove('hidden');
            }
        }
    }

    /**
     * Handles starting an ad-hoc (unscheduled) recording.
     */
    async function handleStartAdHocRecording() {
        if (isRecording) {
            showNotificationCallback("A recording is already in progress. Please stop it first.", "warning");
            return;
        }
    
        const newRecId = `rec-${generateIdCallback()}`; // Generate rec-xxxx ID
        // Ad-hoc recordings will get their main 'sm-...' ID from the backend if/when a meeting record is created for them.
        // For now, we use the rec-id as the primary local identifier for this ad-hoc session's context.
    
        currentRecorderMeeting = {
            // id: newRecId, // Tentatively use rec-id as the main local ID for this adhoc context before backend assigns one
            recorderId: newRecId,    // The actual ID for the recording file and analysis
            title: `Ad-hoc Recording - ${new Date().toLocaleDateString()}`,
            date: new Date().toISOString(), // Current time
            status: 'Scheduled', // Initial status before actual recording starts
            notes: '',
            clientEmail: '', // Can be left blank or prompted
            isAdhoc: true, // Flag to identify this as an ad-hoc recording
            audioQuality: audioQualitySelectElemRec ? audioQualitySelectElemRec.value : 'medium',
            // originalMeetingId will be null for a new ad-hoc
        };
    
        if (meetingTitleInputElemRec) {
            meetingTitleInputElemRec.value = currentRecorderMeeting.title;
            meetingTitleInputElemRec.readOnly = false; // Allow editing title for ad-hoc
        }
        if (meetingNotesElemRec) {
            meetingNotesElemRec.value = '';
            meetingNotesElemRec.readOnly = false; // Allow editing notes
        }
        if (recordingMeetingTitleElemRec) {
            recordingMeetingTitleElemRec.textContent = `Recording: ${currentRecorderMeeting.title}`;
        }
        
        showNotificationCallback("Preparing new ad-hoc recording session.", "info");
        showRecorderView('recording');
        await startActualRecording(); // This will handle backend communication if needed for ad-hoc at start
    }
    
    /**
     * Populates the audio input device selection dropdown.
     * Requests microphone permissions if not already granted.
     */
    async function populateAudioInputDevicesRec() {
        if (!audioInputSelectElemRec) {
            console.warn("Audio input select element not found.");
            return;
        }
        try {
            // Ensure permissions are granted before enumerating devices for labels
            await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); 
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            audioInputSelectElemRec.innerHTML = ''; // Clear existing options

            if (audioInputs.length > 0) {
                audioInputs.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.label || `Microphone ${audioInputSelectElemRec.options.length + 1}`;
                    audioInputSelectElemRec.appendChild(option);
                });
            } else {
                audioInputSelectElemRec.innerHTML = '<option value="">No audio input devices found</option>';
                showNotificationCallback("No audio input devices found. Please check your microphone connection and browser permissions.", "warning");
            }
        } catch (err) {
            console.error("Error populating audio devices or getting permissions:", err);
            audioInputSelectElemRec.innerHTML = '<option value="">Error accessing microphones</option>';
            let message = "Could not access microphones.";
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                message = "Microphone access denied. Please enable microphone permissions in your browser settings.";
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                message = "No microphone found. Please connect a microphone.";
            } else {
                message = `Error accessing microphones: ${err.message}`;
            }
            showNotificationCallback(message, "error");
        }
    }

    /**
     * Sets up all event listeners for the recorder view.
     */
    function setupEventListeners() {
        // Guard to ensure DOM elements are available
        if (!newRecordingBtnRec || !stopBtnElemRec || !pauseResumeBtnElemRec || 
            !audioInputSelectElemRec || !backToListBtnRec || !mainMenuBtnRec || 
            !logoutBtnRec || !analysisTabsElemsRec || !downloadTranscriptBtnRec || !downloadPdfBtnRec) { 
            console.error("Recorder DOM not fully initialized for event listeners. One or more elements are missing."); 
            return; 
        }

        newRecordingBtnRec.addEventListener('click', handleStartAdHocRecording);
        stopBtnElemRec.addEventListener('click', () => stopActualRecording(false)); 
        pauseResumeBtnElemRec.addEventListener('click', handlePauseResumeRec);
        audioInputSelectElemRec.addEventListener('change', handleAudioInputChange);
        
        backToListBtnRec.addEventListener('click', async () => {
            if(isRecording && !confirm("Recording is in progress. Are you sure you want to stop and go back to the list? The current recording will be processed if stopped.")) {
                return;
            }
            if(isRecording) {
                await stopActualRecording(false); 
                let attempts = 0; 
                while(isRecording && attempts < 50) { 
                    await new Promise(resolve => setTimeout(resolve, 100)); 
                    attempts++;
                }
                 if(isRecording) console.warn("Failed to confirm recording stopped before navigating back to list.");
            }
            await refreshMeetingsForRecorder(); 
            showRecorderView('list');
        });

        mainMenuBtnRec.addEventListener('click', async () => {
             if(isRecording && !confirm("Recording is in progress. Are you sure you want to stop and go to the App Dashboard?")) return;
             if(isRecording) {
                await stopActualRecording(false);
                let attempts = 0; 
                while(isRecording && attempts < 50) { 
                    await new Promise(resolve => setTimeout(resolve, 100)); 
                    attempts++;
                }
                if(isRecording) console.warn("Failed to confirm recording stopped before navigating to main menu.");
             }
            switchViewCallback('index'); 
        });

        logoutBtnRec.addEventListener('click', async () => { 
            if(isRecording && !confirm("Recording is in progress. Are you sure you want to stop and logout?")) return;
            if(isRecording) {
                await stopActualRecording(false); 
                let attempts = 0; 
                while(isRecording && attempts < 50) { 
                    await new Promise(resolve => setTimeout(resolve, 100)); 
                    attempts++;
                }
                 if(isRecording) console.warn("Failed to confirm recording stopped before logout.");
            }
            
            if (typeof SharedAppLogic !== 'undefined' && typeof SharedAppLogic.logoutAPI === 'function') {
                await SharedAppLogic.logoutAPI(); // This should handle token clearing and redirection
            } else {
                console.warn("SharedAppLogic.logoutAPI not available. Performing client-side only logout actions.");
                if (typeof SharedAppLogic !== 'undefined' && SharedAppLogic.clearAuthTokenAndUser) SharedAppLogic.clearAuthTokenAndUser();
                localStorage.removeItem('pendingRole'); 
                window.location.href = 'landing-page.html'; // Manual redirect
            }
            showNotificationCallback("Logged out successfully. Redirecting...", "info");
            // If SharedAppLogic.logoutAPI doesn't redirect, ensure redirection here or in the main script.
        });

        analysisTabsElemsRec.forEach(tab => {
            tab.addEventListener('click', () => {
                analysisTabsElemsRec.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const targetPanelId = tab.dataset.tab + '-content-panel-rec';
                Object.values(analysisPanelsElemsRec).forEach(panel => { if(panel) panel.classList.add('hidden');});
                const targetPanel = document.getElementById(targetPanelId);
                if(targetPanel) targetPanel.classList.remove('hidden');
            });
        });

        if (downloadTranscriptBtnRec) { 
            downloadTranscriptBtnRec.addEventListener('click', () => {
                if (currentRecorderMeeting && currentRecorderMeeting.analysisData && currentRecorderMeeting.analysisData.transcript) {
                    const blob = new Blob([currentRecorderMeeting.analysisData.transcript], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${(currentRecorderMeeting.title || 'meeting').replace(/[^\w\s]/gi, '').replace(/\s+/g, '_')}_transcript.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showNotificationCallback("Transcript download started.", "success");
                } else {
                    showNotificationCallback("No transcript available to download for the current meeting.", "warning");
                }
            });
        }

        if (downloadPdfBtnRec) {
            downloadPdfBtnRec.addEventListener('click', async () => { 
                const statusLower = currentRecorderMeeting?.status?.toLowerCase();
                if (currentRecorderMeeting && (statusLower === 'completed' || statusLower === 'analyzed') && currentRecorderMeeting.recorderId) {
                    try {
                        setButtonLoadingStateCallback(downloadPdfBtnRec, true, '.button-text', '.button-loader'); // Assuming standard selectors
                        await downloadAnalysisPdfAPI(currentRecorderMeeting.recorderId); 
                    } catch (error) {
                        console.error("Recorder PDF Download trigger failed:", error);
                        showNotificationCallback("Failed to download PDF report. " + (error.message || ""), "error");
                    } finally {
                        setButtonLoadingStateCallback(downloadPdfBtnRec, false, '.button-text', '.button-loader');
                    }
                } else {
                    showNotificationCallback("PDF report is not available. Analysis must be complete.", "warning");
                }
            });
        }
    }

    /**
     * Handles changes to the selected audio input device.
     * If recording, prompts the user to stop and restart with the new device.
     */
    async function handleAudioInputChange() { 
        if (isRecording) {
            if (confirm("Changing the microphone will stop the current recording segment and start a new one with the selected device. Continue?")) {
                showNotificationCallback("Stopping current recording segment...", "info");
                await stopActualRecording(false); 
                
                let attempts = 0;
                while(isRecording && attempts < 50) { 
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                if(isRecording) { 
                    showNotificationCallback("Failed to stop the previous recording segment. Cannot switch microphone at this time.", "error");
                    // Attempt to revert dropdown to original device if possible, or re-populate.
                    // For now, user might need to manually stop and restart.
                    return;
                }

                showNotificationCallback("Starting new recording segment with selected microphone...", "info");
                
                const previousTitleBase = currentRecorderMeeting?.title?.replace(/ \(Segment .*\)| \(Ad-hoc.*?\)/, '') || "Continued Recording";
                const previousNotes = currentRecorderMeeting?.notes || "";
                const originalMeetingIdForSegment = currentRecorderMeeting?.isAdhoc ? null : (currentRecorderMeeting?.originalMeetingId || currentRecorderMeeting?.id);
                const clientEmailForSegment = currentRecorderMeeting?.clientEmail || null;

                const newSegmentRecorderId = `rec-segment-${generateIdCallback(6)}`;
                // A new segment might need a new primary meeting ID if each segment is tracked as a distinct "meeting" entry
                // or it might update the existing meeting record. For simplicity, let's treat it as a new adhoc-like entry for now.
                const newMeetingIdForSegment = `sm-segment-${generateIdCallback(6)}`;


                currentRecorderMeeting = { 
                    id: newMeetingIdForSegment, 
                    recorderId: newSegmentRecorderId, 
                    title: `${previousTitleBase} (Segment ${Math.floor(Math.random()*900)+100})`, // Random segment number
                    date: new Date().toISOString(), 
                    status: 'Scheduled', 
                    analysisAvailable: false,
                    clientEmail: clientEmailForSegment, 
                    notes: previousNotes, 
                    originalMeetingId: originalMeetingIdForSegment, 
                    audioQuality: audioQualitySelectElemRec ? audioQualitySelectElemRec.value : 'medium',
                    isAdhoc: !originalMeetingIdForSegment, // If no original link, it's essentially a new ad-hoc chain
                };

                if(meetingTitleInputElemRec) meetingTitleInputElemRec.value = currentRecorderMeeting.title;
                if(meetingNotesElemRec) meetingNotesElemRec.value = currentRecorderMeeting.notes;
                if(recordingMeetingTitleElemRec) recordingMeetingTitleElemRec.textContent = `Recording: ${currentRecorderMeeting.title}`;
                
                await startActualRecording(); 
            } else {
                // If user cancels, try to revert the dropdown to the device that was active for the current stream (if any)
                // This is complex if the stream was already stopped. For now, notify.
                showNotificationCallback("Microphone change cancelled. The previously selected device (if any) remains for a new recording.", "info");
            }
        } else {
            if (audioInputSelectElemRec && audioInputSelectElemRec.options.length > 0 && audioInputSelectElemRec.selectedIndex >=0) {
                showNotificationCallback(`Microphone selection changed to: ${audioInputSelectElemRec.options[audioInputSelectElemRec.selectedIndex].text}. This will be used for the next recording.`, "info");
            }
        }
    }

    /**
     * Starts the actual browser-based audio recording process.
     * Initializes MediaRecorder, sets up event handlers, and updates backend status.
     */
    async function startActualRecording() {
        if (isRecording) { 
            showNotificationCallback("A recording is already in progress.", "warning");
            return; 
        }
        if (!currentRecorderMeeting || !currentRecorderMeeting.recorderId) {
            showNotificationCallback("No meeting context or recorder ID. Cannot start recording.", "error");
            console.error("startActualRecording: currentRecorderMeeting or recorderId is missing.", currentRecorderMeeting);
            return; 
        }

        try {
            const selectedDeviceId = audioInputSelectElemRec.value;
            const constraints = { 
                audio: { 
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    // Consider adding these for better quality, but test browser compatibility
                    // echoCancellation: true,
                    // noiseSuppression: true,
                    // autoGainControl: true 
                } 
            };
            
            audioStreamForVisualizer = await navigator.mediaDevices.getUserMedia(constraints);
            currentStreamTracks = audioStreamForVisualizer.getAudioTracks();
            if (currentStreamTracks.length === 0) {
                throw new Error("No audio tracks found in the selected media stream.");
            }

            setupAudioVisualizerRec(audioStreamForVisualizer);
            
            const qualitySetting = audioQualitySelectElemRec ? audioQualitySelectElemRec.value : 'medium';
            let mediaRecorderOptions = { mimeType: 'audio/webm;codecs=opus' }; 
            
            if (!MediaRecorder.isTypeSupported(mediaRecorderOptions.mimeType)) {
                console.warn("audio/webm;codecs=opus not supported, trying audio/ogg;codecs=opus");
                mediaRecorderOptions.mimeType = 'audio/ogg;codecs=opus';
                if (!MediaRecorder.isTypeSupported(mediaRecorderOptions.mimeType)) {
                    console.warn("audio/ogg;codecs=opus not supported, trying audio/webm (browser default codecs)");
                    mediaRecorderOptions.mimeType = 'audio/webm'; 
                     if (!MediaRecorder.isTypeSupported(mediaRecorderOptions.mimeType)) {
                        console.error("No suitable webm/ogg opus MIME type supported by this browser.");
                        showNotificationCallback("Your browser does not support the required audio recording format.", "error");
                        handleMediaRecorderCleanup(); 
                        return;
                    }
                }
            }

            if (qualitySetting === 'high') mediaRecorderOptions.audioBitsPerSecond = 128000;
            else if (qualitySetting === 'medium') mediaRecorderOptions.audioBitsPerSecond = 96000;
            else if (qualitySetting === 'low') mediaRecorderOptions.audioBitsPerSecond = 64000;
            
            try {
                mediaRecorder = new MediaRecorder(audioStreamForVisualizer, mediaRecorderOptions);
            } catch (e) {
                console.warn("Failed to create MediaRecorder with specified bitrate/mime, trying with minimal options (mimeType only):", e);
                mediaRecorderOptions = { mimeType: mediaRecorderOptions.mimeType }; 
                mediaRecorder = new MediaRecorder(audioStreamForVisualizer, mediaRecorderOptions);
            }
            
            audioChunks = [];
            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = handleActualRecordingStop; 
            mediaRecorder.onerror = (event) => { 
                console.error("MediaRecorder error:", event.error?.name, event.error?.message); 
                showNotificationCallback(`Recording error: ${event.error?.name || 'Unknown error'} - ${event.error?.message || 'Please check console.'}`, "error"); 
                stopActualRecording(true); // Pass true for errorOccurred
            };

            mediaRecorder.start(1000); // timeslice can be useful for future features like live processing
            isRecording = true; isPaused = false; recordingStartTime = Date.now(); accumulatedPausedTime = 0;
            
            // Update local meeting context
            currentRecorderMeeting.status = 'recording';
            currentRecorderMeeting.startTimeActual = new Date().toISOString(); // Record actual start time
            if(audioQualitySelectElemRec) currentRecorderMeeting.audioQuality = audioQualitySelectElemRec.value;
            if(meetingTitleInputElemRec) currentRecorderMeeting.title = meetingTitleInputElemRec.value.trim() || currentRecorderMeeting.title || "Untitled Recording";
            if(meetingNotesElemRec) currentRecorderMeeting.notes = meetingNotesElemRec.value.trim();
            
            // Update backend:
            // If currentRecorderMeeting.id (sm-xxxx) exists and it's not flagged as a brand new adhoc that hasn't been saved
            if (currentRecorderMeeting.id && !currentRecorderMeeting.isNewAdhocPendingSave) { 
                const meetingUpdatePayload = {
                    status: 'recording',
                    startTimeActual: currentRecorderMeeting.startTimeActual,
                    // Only include notes/title if they were editable and potentially changed by recorder
                    ...(meetingNotesElemRec && !meetingNotesElemRec.readOnly && { notes: currentRecorderMeeting.notes }),
                    ...(meetingTitleInputElemRec && !meetingTitleInputElemRec.readOnly && { title: currentRecorderMeeting.title }),
                };
                try {
                    await updateMeetingCallback(currentRecorderMeeting.id, meetingUpdatePayload); 
                } catch (updateError) {
                    console.error("Failed to update meeting status to 'recording' on backend:", updateError);
                    showNotificationCallback("Recording started, but failed to sync status with server.", "warning");
                }
            } else if (currentRecorderMeeting.isAdhoc) {
                // For a brand new ad-hoc, we might create the meeting record on the backend now.
                // This requires `addMeetingCallback` (SharedAppLogic.createMeetingAPI) to be robust.
                // The backend /api/meetings POST will generate its own 'id' (sm-...) and 'recordingId' (rec-...).
                // We need to update `currentRecorderMeeting.id` and `currentRecorderMeeting.recorderId` with these backend values.
                const adhocPayloadForCreate = {
                    title: currentRecorderMeeting.title,
                    date: currentRecorderMeeting.date, // This is now() for adhoc
                    clientEmail: currentRecorderMeeting.clientEmail || "ad-hoc-recorder@system.local", // Placeholder
                    notes: currentRecorderMeeting.notes,
                    // Pass the locally generated recorderId so backend can use it or link to it
                    // This depends on how createMeetingAPI and backend are designed for adhoc.
                    // For now, let's assume backend generates these and we might reconcile on STOP.
                    // Or, the backend /api/meetings POST needs to accept a preferred recordingId.
                };
                try {
                    // const createdMeetingData = await addMeetingCallback(adhocPayloadForCreate);
                    // if (createdMeetingData && createdMeetingData.success && createdMeetingData.data) {
                    //    currentRecorderMeeting.id = createdMeetingData.data.id; // Update with backend assigned meeting ID
                    //    currentRecorderMeeting.recorderId = createdMeetingData.data.recordingId; // Crucial: update with backend assigned recording ID
                    //    currentRecorderMeeting.isNewAdhocPendingSave = false; // It's now saved
                    //    showNotificationCallback("Ad-hoc session registered with backend.", "info");
                    // } else {
                    //    throw new Error("Failed to register ad-hoc session with backend.");
                    // }
                    console.log("Ad-hoc recording started. Backend record creation deferred or handled by upload process.");
                    currentRecorderMeeting.isNewAdhocPendingSave = true; // Mark that it needs full creation on stop/upload
                } catch (createError) {
                     console.error("Failed to create backend record for ad-hoc session at start:", createError);
                     showNotificationCallback("Ad-hoc recording started locally. Backend sync issue.", "warning");
                     currentRecorderMeeting.isNewAdhocPendingSave = true; // Still needs creation
                }
            }
            
            await refreshMeetingsForRecorder(); 
            updateRecorderRecordingUI();
            if(timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateRecorderTimer, 1000);
            showNotificationCallback(`Recording started (Quality: ${qualitySetting}).`, "success");

        } catch (err) { 
            console.error("Error starting recording:", err);
            showNotificationCallback(`Error starting recording: ${err.message}. Check microphone permissions and selection.`, "error");
            handleMediaRecorderCleanup(); 
            if (currentRecorderMeeting) { 
                currentRecorderMeeting.status = 'failed_to_start'; 
                try { 
                    if (currentRecorderMeeting.id && !currentRecorderMeeting.isAdhoc && !currentRecorderMeeting.isNewAdhocPendingSave) { 
                        await updateMeetingCallback(currentRecorderMeeting.id, { status: 'failed_to_start' }); 
                    }
                } catch(e) { console.error("Failed to update meeting status on start error:", e);}
            }
            isRecording = false; 
            updateRecorderRecordingUI(); // Reflect that it's not recording
            // Don't necessarily go back to list, user might want to try again with different mic.
            // showRecorderView('list'); 
        }
    }
    
    /**
     * Handles the 'stop' event of the MediaRecorder.
     * Processes the recorded audio, uploads it, and initiates analysis.
     */
    async function handleActualRecordingStop() { 
        // Capture context at time of stop, as currentRecorderMeeting might change if user navigates quickly
        const stoppedMeetingContext = { ...currentRecorderMeeting }; 
        
        handleMediaRecorderCleanup(); // Stops timer, visualizer, audio tracks, nullifies mediaRecorder

        if (!stoppedMeetingContext || !stoppedMeetingContext.recorderId) {
            console.error("Stopped meeting context or its recorderId is null in onstop handler");
            if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false);
            isRecording = false; // Ensure flag is reset
            updateRecorderRecordingUI();
            // showRecorderView('list'); // Or stay on recording view if error
            return;
        }
        
        if (audioChunks.length === 0) {
            showNotificationCallback("No audio data was recorded. Upload cancelled.", "warning");
            if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false);
            isRecording = false;
            updateRecorderRecordingUI();
            try {
                // If it was a known meeting, update its status to reflect empty recording
                if(stoppedMeetingContext.id && !stoppedMeetingContext.isAdhoc && !stoppedMeetingContext.isNewAdhocPendingSave) {
                     await updateMeetingCallback(stoppedMeetingContext.id, { status: 'failed_empty_recording' });
                }
            } catch (e) { console.error("Failed to update status for empty recording", e); }
            await refreshMeetingsForRecorder();
            // showRecorderView('list'); // Decide if to navigate away or allow re-record
            return;
        }

        const audioBlob = new Blob(audioChunks, {type: mediaRecorder?.mimeType || stoppedMeetingContext.mimeType || 'audio/webm;codecs=opus'}); 
        audioChunks = []; 

        stoppedMeetingContext.duration = formatDurationRec(Date.now() - recordingStartTime - accumulatedPausedTime); 
        stoppedMeetingContext.status = 'uploading_to_backend'; 
        stoppedMeetingContext.size = audioBlob.size > 0 ? `${(audioBlob.size / (1024*1024)).toFixed(2)}MB` : '0MB';
        
        try {
            // Update the original meeting's status (if it's a known, non-adhoc meeting)
            if(stoppedMeetingContext.id && !stoppedMeetingContext.isAdhoc && !stoppedMeetingContext.isNewAdhocPendingSave) {
                await updateMeetingCallback(stoppedMeetingContext.id, { 
                    status: 'uploading_to_backend', 
                    duration: stoppedMeetingContext.duration, 
                    // Potentially update fileSizeMB if backend stores it on meeting item
                }); 
            }
            // For adhoc that was isNewAdhocPendingSave, the upload itself will effectively create/finalize its record.
            
            await refreshMeetingsForRecorder(); 
            showNotificationCallback("Recording stopped. Uploading to server...", "info");

            const formData = new FormData();
            formData.append('audioFile', audioBlob, `${stoppedMeetingContext.recorderId}.webm`); 
            formData.append('notes', stoppedMeetingContext.notes || '');
            formData.append('quality', stoppedMeetingContext.audioQuality || 'medium');
            formData.append('title', stoppedMeetingContext.title || 'Untitled Recording');
            
            // Link back to original meeting if this was derived from one (scheduled or segment)
            if (stoppedMeetingContext.originalMeetingId) { 
                formData.append('originalMeetingId', stoppedMeetingContext.originalMeetingId);
            } else if (!stoppedMeetingContext.isAdhoc && stoppedMeetingContext.id) {
                // If it's not adhoc (so it's a scheduled meeting that wasn't a segment)
                // its own 'id' is the original.
                formData.append('originalMeetingId', stoppedMeetingContext.id);
            }
            // If it's a brand new adhoc (isAdhoc=true, isNewAdhocPendingSave=true), originalMeetingId might be omitted.
            // The backend upload handler will treat it as a new root recording.
            
            const uploadResponse = await uploadRecordingAPI(stoppedMeetingContext.recorderId, formData); 

            if (uploadResponse && uploadResponse.success) {
                // The backend /upload endpoint is expected to initiate processing and return relevant IDs/status.
                // Update local context with any canonical IDs returned by the backend.
                const finalMeetingId = uploadResponse.meetingId || stoppedMeetingContext.id; // sm-xxxx
                const finalRecorderId = uploadResponse.recordingId || stoppedMeetingContext.recorderId; // rec-xxxx
                const finalStatus = uploadResponse.status || 'processing';

                stoppedMeetingContext.id = finalMeetingId;
                stoppedMeetingContext.recorderId = finalRecorderId;
                stoppedMeetingContext.status = finalStatus;

                // If this was an adhoc recording that just got its meetingId from backend:
                if (stoppedMeetingContext.isAdhoc && stoppedMeetingContext.isNewAdhocPendingSave && finalMeetingId) {
                    // We might not need to call updateMeetingCallback if the upload itself created the full record.
                    // However, refreshing the list is good.
                    console.log("Adhoc upload successful, backend processing initiated. Meeting ID:", finalMeetingId);
                } else if (finalMeetingId) { // For existing meetings, update their status
                    await updateMeetingCallback(finalMeetingId, { status: finalStatus, analysisAvailable: false }); // analysisAvailable becomes true after completion
                }
                
                showNotificationCallback("Upload complete. Analysis processing started by backend.", "success");
                // Update currentRecorderMeeting to the one that was just processed before initiating analysis
                currentRecorderMeeting = { ...stoppedMeetingContext }; 
                initiateRecorderAnalysis(currentRecorderMeeting); 
            } else {
                throw new Error(uploadResponse?.message || "Upload to backend failed or did not confirm success.");
            }
        } catch (error) {
            console.error("Error during recording stop/upload:", error);
            showNotificationCallback(`Error during upload or processing trigger: ${error.message}`, "error");
            stoppedMeetingContext.status = 'upload_failed';
            try { 
                if(stoppedMeetingContext.id && !stoppedMeetingContext.isAdhoc && !stoppedMeetingContext.isNewAdhocPendingSave) {
                    await updateMeetingCallback(stoppedMeetingContext.id, { status: 'upload_failed' }); 
                }
            } catch(e) { console.error("Failed to update meeting status after upload error", e); }
        } finally {
            if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false);
            isRecording = false; 
            updateRecorderRecordingUI(); // Ensure UI reflects stop
            await refreshMeetingsForRecorder(); 
        }
    }
    
    /**
     * Initiates polling for analysis status and displays results when complete.
     * @param {object} meetingForAnalysis - The meeting object to get analysis for.
     */
    async function initiateRecorderAnalysis(meetingForAnalysis) { 
        if (!analysisMeetingTitleElemRec || !analysisViewRec || !meetingForAnalysis || !meetingForAnalysis.recorderId) {
            console.error("Cannot initiate analysis: missing DOM elements or meeting data/recorderId.", meetingForAnalysis);
            showRecorderView('list'); 
            return; 
        }
        // Ensure currentRecorderMeeting is set to the meeting whose analysis is being initiated/polled.
        // This is important if the user navigates away and comes back, or if multiple analyses could be polled (though unlikely here).
        currentRecorderMeeting = { ...meetingForAnalysis }; 
        
        showRecorderView('analysis');
        analysisMeetingTitleElemRec.textContent = `Analysis for: ${currentRecorderMeeting.title}`;
        analysisDateDisplayElemRec.textContent = `Recorded: ${new Date(currentRecorderMeeting.startTimeActual || currentRecorderMeeting.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}`;
        
        analysisProgressSectionElemRec.classList.remove('hidden');
        analysisContentSectionElemRec.classList.add('hidden');
        analysisProgressBarElemRec.style.width = '0%';
        analysisProgressBarElemRec.style.backgroundColor = 'var(--blue-500)'; 
        analysisProgressPercentageElemRec.textContent = '0%';
        analysisStatusTextElemRec.textContent = 'Checking analysis status...';

        if (pollingInterval) clearInterval(pollingInterval); 

        async function pollStatus() {
            // Check if the context is still for the same meeting, especially if user can navigate while polling.
            if (!currentRecorderMeeting || currentRecorderMeeting.recorderId !== meetingForAnalysis.recorderId) { 
                console.warn("Polling stopped: Analysis context changed to a different meeting or cleared.");
                clearInterval(pollingInterval);
                return;
            }
            try {
                const statusResult = await fetchAnalysisStatusAPI(currentRecorderMeeting.recorderId); 
                if (!statusResult || !statusResult.success) { 
                    throw new Error(statusResult.message || "Failed to get status update from server.");
                }

                analysisStatusTextElemRec.textContent = statusResult.status_message || `Status: ${getMeetingStatusText(statusResult.status)}`;
                const progressPercent = parseInt(statusResult.progress) || 0;
                analysisProgressBarElemRec.style.width = `${progressPercent}%`;
                analysisProgressPercentageElemRec.textContent = `${progressPercent}%`;

                const finalStatusLower = statusResult.status?.toLowerCase();
                if (finalStatusLower === 'completed' || finalStatusLower === 'analyzed') {
                    clearInterval(pollingInterval);
                    analysisStatusTextElemRec.textContent = 'Analysis Complete! Fetching results...';
                    const analysisData = await fetchAnalysisDataAPI(currentRecorderMeeting.recorderId); 
                    
                    if (analysisData) { // For recorder, typically { summary, transcript }
                        currentRecorderMeeting.analysisData = analysisData; 
                        currentRecorderMeeting.status = finalStatusLower; 
                        
                        // Update the main meeting entry in MEETINGS_TABLE_NAME
                        if(currentRecorderMeeting.id ) { // .id is sm-xxxx
                             await updateMeetingCallback(currentRecorderMeeting.id, { 
                                status: currentRecorderMeeting.status, 
                                analysisAvailable: true 
                            });
                        }
                        await refreshMeetingsForRecorder(); // Refresh list to show new status
                        
                        if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.innerHTML = analysisData.summary ? analysisData.summary.replace(/\n/g, '<br>') : "<p>Summary not available.</p>";
                        if(analysisPanelsElemsRec.transcript) analysisPanelsElemsRec.transcript.innerHTML = analysisData.transcript ? `<pre class="whitespace-pre-wrap text-sm">${analysisData.transcript}</pre>` : "<p>Transcript not available.</p>";
                        
                        // Activate the summary tab by default
                        if(analysisTabsElemsRec && analysisTabsElemsRec.length > 0) {
                            analysisTabsElemsRec.forEach(t => t.classList.remove('active'));
                            const summaryTab = Array.from(analysisTabsElemsRec).find(t => t.dataset.tab === 'summary');
                            if (summaryTab) summaryTab.classList.add('active');
                        }
                        Object.values(analysisPanelsElemsRec).forEach(p => { if(p) p.classList.add('hidden'); });
                        if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.classList.remove('hidden');
                        
                        analysisProgressSectionElemRec.classList.add('hidden');
                        analysisContentSectionElemRec.classList.remove('hidden');
                    } else {
                        throw new Error("Analysis data not found after completion status from server.");
                    }
                } else if (finalStatusLower === 'failed') {
                    clearInterval(pollingInterval);
                    analysisStatusTextElemRec.textContent = `Analysis Failed: ${statusResult.error_message || 'Unknown error during analysis.'}`;
                    analysisProgressBarElemRec.style.backgroundColor = 'var(--red-600)'; // Use CSS var or Tailwind class
                    currentRecorderMeeting.status = 'failed';
                     if(currentRecorderMeeting.id){ // .id is sm-xxxx
                        await updateMeetingCallback(currentRecorderMeeting.id, { status: 'failed', analysisAvailable: false });
                     }
                    await refreshMeetingsForRecorder();
                }
            } catch (error) {
                console.error("Error polling analysis status:", error);
                analysisStatusTextElemRec.textContent = `Error updating status: ${error.message}. Retrying...`;
                // Consider adding a retry limit before clearing interval permanently
                // clearInterval(pollingInterval); 
            }
        }
        pollStatus(); 
        pollingInterval = setInterval(pollStatus, 8000); 
    }
    
    /**
     * Handles viewing analysis for a meeting that is already completed/analyzed.
     * Typically called when a user clicks on such a meeting from the list.
     * @param {string} recorderIdToView - The recorder ID (rec-...) of the meeting analysis to view.
     */
    async function handleViewRecorderAnalysis(recorderIdToView) { 
        if (!recorderIdToView) {
            showNotificationCallback("No recording ID specified to view analysis.", "error");
            return;
        }
        
        let meetingToAnalyze = meetings.find(m => m.recordingId === recorderIdToView); 

        if (!meetingToAnalyze) { 
            showNotificationCallback("Meeting details not found in local cache. Attempting to refresh...", "info");
            await refreshMeetingsForRecorder(); 
            meetingToAnalyze = meetings.find(m => m.recordingId === recorderIdToView);
            if (!meetingToAnalyze) {
                showNotificationCallback("Meeting not found even after refresh. Cannot display analysis.", "error");
                return;
            }
        }
        currentRecorderMeeting = { ...meetingToAnalyze }; // Set current context
        
        const statusLower = currentRecorderMeeting.status?.toLowerCase();

        if ((statusLower === 'completed' || statusLower === 'analyzed')) {
            if (!currentRecorderMeeting.analysisData) { // If analysis data isn't already on the object
                showNotificationCallback("Fetching latest analysis data...", "info");
                try {
                    const analysisData = await fetchAnalysisDataAPI(currentRecorderMeeting.recordingId);
                    if (analysisData) { // For recorder, this is { summary, transcript }
                        currentRecorderMeeting.analysisData = analysisData;
                    } else {
                        throw new Error("No analysis data returned from API for this completed meeting.");
                    }
                } catch (error) {
                    console.error("Failed to fetch analysis data for viewing:", error);
                    showNotificationCallback("Could not load analysis data: " + error.message, "error");
                    return; // Don't proceed to show analysis view if data fetch failed
                }
            }
            
            // Populate and show the analysis view
            analysisMeetingTitleElemRec.textContent = `Analysis for: ${currentRecorderMeeting.title}`;
            analysisDateDisplayElemRec.textContent = `Recorded: ${new Date(currentRecorderMeeting.startTimeActual || currentRecorderMeeting.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}`;
            analysisProgressSectionElemRec.classList.add('hidden'); // Hide progress bar
            analysisContentSectionElemRec.classList.remove('hidden'); // Show content
            
            if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.innerHTML = currentRecorderMeeting.analysisData.summary ? currentRecorderMeeting.analysisData.summary.replace(/\n/g, '<br>') : "<p>Summary not available.</p>";
            if(analysisPanelsElemsRec.transcript) analysisPanelsElemsRec.transcript.innerHTML = currentRecorderMeeting.analysisData.transcript ? `<pre class="whitespace-pre-wrap text-sm">${currentRecorderMeeting.analysisData.transcript}</pre>` : "<p>Transcript not available.</p>";
            
            if(analysisTabsElemsRec && analysisTabsElemsRec.length > 0) {
                analysisTabsElemsRec.forEach(t => t.classList.remove('active'));
                const summaryTab = Array.from(analysisTabsElemsRec).find(t => t.dataset.tab === 'summary');
                if (summaryTab) summaryTab.classList.add('active'); // Default to summary tab
            }
            Object.values(analysisPanelsElemsRec).forEach(p => {if(p) p.classList.add('hidden');}); // Hide all panels first
            if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.classList.remove('hidden'); // Show summary panel
            
            showRecorderView('analysis');

        } else if (statusLower === 'processing' || statusLower === 'uploading_to_backend') {
            showNotificationCallback(`Analysis for "${currentRecorderMeeting.title}" is still processing. Displaying progress.`, "info");
            initiateRecorderAnalysis(currentRecorderMeeting); // This will switch to analysis view and show progress
        } else {
            showNotificationCallback(`Analysis not yet available for "${currentRecorderMeeting.title}". Current status: ${getMeetingStatusText(currentRecorderMeeting.status)}.`, "warning");
            // Optionally, do not switch view if no analysis can be shown or polled for
        }
    }
    
    /**
     * Updates the UI elements related to recording state (indicator, status text, buttons).
     */
    function updateRecorderRecordingUI() { 
        if (!recordingIndicatorElemRec || !recordingStatusTextElemRec || !pauseResumeBtnElemRec || !stopBtnElemRec || !newRecordingBtnRec) {
            console.warn("Cannot update recording UI: one or more elements missing.");
            return;
        }
        recordingIndicatorElemRec.className = `w-3.5 h-3.5 rounded-full mr-2.5 ${isRecording && !isPaused ? 'bg-red-500 status-recording' : (isRecording && isPaused ? 'bg-yellow-500 animate-none' : 'bg-gray-400 animate-none')}`;
        recordingStatusTextElemRec.textContent = isRecording && !isPaused ? "Recording..." : (isRecording && isPaused ? "Paused" : "Idle");
        
        const pauseResumeTextSpan = pauseResumeBtnElemRec.querySelector('.button-text');
        if (pauseResumeTextSpan) { 
            pauseResumeTextSpan.innerHTML = isPaused ? '<i class="fas fa-play mr-2 icon-hover"></i>Resume' : '<i class="fas fa-pause mr-2 icon-hover"></i>Pause';
        }
        
        stopBtnElemRec.disabled = !isRecording;
        pauseResumeBtnElemRec.disabled = !isRecording;
        newRecordingBtnRec.disabled = isRecording; // Disable starting new if one is active
        if(audioInputSelectElemRec) audioInputSelectElemRec.disabled = isRecording; // Disable changing mic while recording (or handle via handleAudioInputChange prompt)
        if(audioQualitySelectElemRec) audioQualitySelectElemRec.disabled = isRecording;
        if(meetingTitleInputElemRec && currentRecorderMeeting && !currentRecorderMeeting.isAdhoc) meetingTitleInputElemRec.readOnly = true; else if (meetingTitleInputElemRec) meetingTitleInputElemRec.readOnly = isRecording;
        if(meetingNotesElemRec && currentRecorderMeeting && !currentRecorderMeeting.isAdhoc) meetingNotesElemRec.readOnly = true; else if (meetingNotesElemRec) meetingNotesElemRec.readOnly = isRecording;

    }

    /**
     * Updates the displayed recording timer.
     */
    function updateRecorderTimer() { 
        if (!isRecording || isPaused || !recordingTimeDisplayElemRec) return;
        const elapsed = Date.now() - recordingStartTime - accumulatedPausedTime;
        recordingTimeDisplayElemRec.textContent = formatDurationRec(elapsed);
        if(recordingProgressElemRec) {
             // Illustrative progress: assumes a 2-hour max for full bar, adjust as needed
            const maxDurationForProgress = 2 * 60 * 60 * 1000; // 2 hours in ms
            recordingProgressElemRec.style.width = `${Math.min(100, (elapsed / maxDurationForProgress) * 100)}%`;
        }
    }

    /**
     * Formats milliseconds into HH:MM:SS string.
     * @param {number} ms - Duration in milliseconds.
     * @returns {string} Formatted duration string.
     */
    function formatDurationRec(ms) { 
        if (isNaN(ms) || ms < 0) return "00:00:00";
        const totalSeconds = Math.floor(ms / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return [h,m,s].map(v => String(v).padStart(2,'0')).join(':');
    }

    /**
     * Handles pausing or resuming the current recording.
     */
    function handlePauseResumeRec() { 
        if (!mediaRecorder || !isRecording) { // Can only pause/resume if actually recording
            showNotificationCallback("No active recording to pause or resume.", "warning");
            return;
        }
        if(isPaused) { 
            try {
                mediaRecorder.resume(); 
                accumulatedPausedTime += Date.now() - pauseStartTime; 
                isPaused = false; 
                if(timerInterval) clearInterval(timerInterval); 
                timerInterval = setInterval(updateRecorderTimer, 1000); 
                if(audioStreamForVisualizer && audioStreamForVisualizer.active) setupAudioVisualizerRec(audioStreamForVisualizer); 
                showNotificationCallback("Recording Resumed.", "info");
            } catch (e) {
                console.error("Error resuming MediaRecorder:", e);
                showNotificationCallback("Failed to resume recording.", "error");
                // Potentially stop recording if resume fails critically
            }
        } else { 
            try {
                mediaRecorder.pause(); 
                isPaused = true; 
                pauseStartTime = Date.now(); 
                clearInterval(timerInterval); 
                stopAudioVisualizerRec(); 
                showNotificationCallback("Recording Paused.", "info");
            } catch (e) {
                console.error("Error pausing MediaRecorder:", e);
                showNotificationCallback("Failed to pause recording.", "error");
            }
        }
        updateRecorderRecordingUI();
    }

    /**
     * Stops the current recording process.
     * @param {boolean} errorOccurred - Indicates if stopping due to an error.
     */
    async function stopActualRecording(errorOccurred = false) { 
        if (!isRecording && !errorOccurred) { 
            if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false, '.button-text', '.button-loader'); 
            updateRecorderRecordingUI(); // Ensure UI is in idle state
            return; 
        }
        
        if (isRecording || errorOccurred) { 
             if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, true, '.button-text', '.button-loader');
        }

        const wasRecordingFlag = isRecording; // Capture state before it's changed by async operations
        isRecording = false; // Set flag immediately

        if (mediaRecorder && mediaRecorder.state !== "inactive") { 
            mediaRecorder.stop(); // This will asynchronously trigger 'onstop' event (handleActualRecordingStop)
        } else { 
            // If mediaRecorder is already inactive or null (e.g. error before mediaRecorder.start() completed)
            handleMediaRecorderCleanup(); // Ensure resources are released
            if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false, '.button-text', '.button-loader');
            if (errorOccurred) { 
                showNotificationCallback("Recording stopped due to an error.", "error");
            } else if (wasRecordingFlag) { // Only show "stopped" if it was actually recording and onstop won't fire
                 showNotificationCallback("Recording process already stopped or was not active.", "info");
            }
            updateRecorderRecordingUI(); // Ensure UI reflects stop
            // If onstop is not going to be called, and it wasn't an error that led here,
            // we might need to transition UI, e.g., back to list.
            if (!errorOccurred && wasRecordingFlag && (!mediaRecorder || mediaRecorder.state === "inactive")) {
                 await refreshMeetingsForRecorder(); 
                 // showRecorderView('list'); // Or stay, allow user to decide next step
            }
        }
        // The main logic continues in handleActualRecordingStop (the onstop event handler)
    }

    /**
     * Cleans up all resources related to media recording (timer, visualizer, stream tracks, MediaRecorder instance).
     */
    function handleMediaRecorderCleanup() { 
        if(timerInterval) clearInterval(timerInterval); 
        timerInterval = null;
        stopAudioVisualizerRec(); // Stops animation and disconnects analyser nodes

        if (currentStreamTracks && currentStreamTracks.length > 0) { 
            currentStreamTracks.forEach(track => track.stop()); 
            currentStreamTracks = []; 
        }
        // Also ensure the main stream is stopped if it's still around
        if (audioStreamForVisualizer && audioStreamForVisualizer.active) { 
             audioStreamForVisualizer.getTracks().forEach(track => track.stop());
             audioStreamForVisualizer = null;
        }
        if (mediaRecorder) {
            // Remove event listeners to prevent memory leaks if instance is not nulled immediately
            mediaRecorder.ondataavailable = null;
            mediaRecorder.onstop = null;
            mediaRecorder.onerror = null;
            mediaRecorder = null; 
        }
        
        audioChunks = []; // Clear any remaining chunks
        isPaused = false; // Reset paused state
        // isRecording is typically set by the caller of stopActualRecording or in handleActualRecordingStop
        updateRecorderRecordingUI(); // Update UI to reflect "Idle" state
    }

    /**
     * Sets up the audio visualizer using the provided media stream.
     * @param {MediaStream} stream - The audio stream to visualize.
     */
    function setupAudioVisualizerRec(stream) { 
        if (!audioVisualizerCanvasElemRec || !stream || !stream.active || stream.getAudioTracks().length === 0) {
            console.warn("Audio visualizer setup skipped: no canvas, or stream is inactive/missing audio tracks.");
            if(audioVisualizerCanvasElemRec && audioVisualizerCanvasElemRec.getContext('2d')) { // Clear canvas if it exists
                const canvasCtx = audioVisualizerCanvasElemRec.getContext('2d');
                canvasCtx.fillStyle = '#e0f2fe'; 
                canvasCtx.fillRect(0, 0, audioVisualizerCanvasElemRec.width, audioVisualizerCanvasElemRec.height);
            }
            return;
        }
        try {
            if (!audioContext || audioContext.state === 'closed') { 
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioContext.state === 'suspended') { 
                audioContext.resume().catch(e => console.error("Error resuming AudioContext:", e)); 
            }

            if (analyser && typeof analyser.disconnect === 'function') analyser.disconnect(); 
            if (window.currentVisualizerSourceNode && typeof window.currentVisualizerSourceNode.disconnect === 'function') window.currentVisualizerSourceNode.disconnect();

            analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            window.currentVisualizerSourceNode = source; 
            source.connect(analyser);
            analyser.fftSize = 256; // Number of samples for FFT (power of 2)
            const bufferLength = analyser.frequencyBinCount; // fftSize / 2
            const dataArray = new Uint8Array(bufferLength);

            const canvasCtx = audioVisualizerCanvasElemRec.getContext('2d');
            // Ensure canvas dimensions are set based on its actual display size for crisp rendering
            audioVisualizerCanvasElemRec.width = audioVisualizerCanvasElemRec.offsetWidth; 
            audioVisualizerCanvasElemRec.height = audioVisualizerCanvasElemRec.offsetHeight; 
            
            function draw() {
                // Stop drawing if not recording, paused, or analyser is gone
                if (!isRecording || isPaused || !analyser || !audioVisualizerCanvasElemRec) { 
                    if (visualizerFrameId) cancelAnimationFrame(visualizerFrameId);
                    visualizerFrameId = null;
                    return; 
                }
                visualizerFrameId = requestAnimationFrame(draw);
                analyser.getByteFrequencyData(dataArray); // Populate dataArray with frequency data

                canvasCtx.fillStyle = 'rgb(224, 242, 254)'; // Light blue background (Tailwind sky-100 equivalent)
                canvasCtx.fillRect(0, 0, audioVisualizerCanvasElemRec.width, audioVisualizerCanvasElemRec.height);
                
                const barWidth = (audioVisualizerCanvasElemRec.width / bufferLength) * 1.8; // Adjusted for aesthetics
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeightFraction = dataArray[i] / 255.0; // Normalize to 0-1
                    const barHeight = barHeightFraction * audioVisualizerCanvasElemRec.height * 0.9; // Scale to canvas height
                    
                    // Dynamic color based on amplitude - example
                    const g = Math.floor(barHeightFraction * 150); // More green for higher amplitude
                    const b = Math.floor(50 + barHeightFraction * 205); // More blue overall
                    canvasCtx.fillStyle = `rgb(30, ${g}, ${b})`; // Darker blue to lighter cyan/green
                    
                    canvasCtx.fillRect(x, audioVisualizerCanvasElemRec.height - barHeight, barWidth, barHeight);
                    x += barWidth + 1; // Bar width + 1px spacing
                }
            }
            if (visualizerFrameId) cancelAnimationFrame(visualizerFrameId); 
            draw(); // Start the animation loop
        } catch (e) { 
            console.error("Error setting up audio visualizer:", e); 
            showNotificationCallback("Could not start audio visualizer: " + e.message, "warning");
        }
    }

    /**
     * Stops the audio visualizer animation and clears the canvas.
     */
    function stopAudioVisualizerRec() { 
        if (visualizerFrameId) cancelAnimationFrame(visualizerFrameId); 
        visualizerFrameId = null;
        if(audioVisualizerCanvasElemRec && audioVisualizerCanvasElemRec.getContext('2d')) {
            const canvasCtx = audioVisualizerCanvasElemRec.getContext('2d');
            canvasCtx.fillStyle = 'rgb(224, 242, 254)'; 
            canvasCtx.fillRect(0, 0, audioVisualizerCanvasElemRec.width, audioVisualizerCanvasElemRec.height);
        }
        // Disconnect nodes to free up resources
         if (analyser && typeof analyser.disconnect === 'function') {
            analyser.disconnect();
            // analyser = null; // Optional: nullify to be recreated if needed
        }
        if (window.currentVisualizerSourceNode && typeof window.currentVisualizerSourceNode.disconnect === 'function') {
            window.currentVisualizerSourceNode.disconnect();
            // window.currentVisualizerSourceNode = null; // Optional
        }
        // Consider closing audioContext only if view is fully destroyed and not reused.
        // if (audioContext && audioContext.state !== 'closed') {
        //    audioContext.close().catch(e => console.error("Error closing AudioContext:", e));
        //    audioContext = null;
        // }
    }

    /**
     * Handles deep linking to a specific recording session.
     * @param {string} urlRecordingId - The recorder ID (rec-...) from the URL.
     * @param {string} urlRecorderCode - The recorder access code from the URL.
     */
    function handleDeepLink(urlRecordingId, urlRecorderCode) { 
        if (!urlRecordingId || !urlRecorderCode) {
            showNotificationCallback("Deep link is missing recording ID or access code.", "warning");
            showRecorderView('list');
            return;
        }
        showNotificationCallback(`Attempting to access via deep link for recording ID: ${urlRecordingId}`, "info");

        refreshMeetingsForRecorder().then(() => { 
            const meeting = meetings.find(m => m.recordingId === urlRecordingId); // Find by rec-xxxx
            if (meeting) {
                if (meeting.recorderAccessCode === urlRecorderCode) {
                    showNotificationCallback(`Accessing scheduled recording via link: ${meeting.title}`, "info");
                    // Ensure meeting.id (sm-xxxx) is passed to start scheduled recording
                    handleStartScheduledRecording(meeting.id); 
                } else {
                    showNotificationCallback(`Invalid recorder access code for meeting: ${meeting.title}. Please check the link.`, "error");
                    showRecorderView('list');
                }
            } else {
                showNotificationCallback(`Meeting with Recording ID ${urlRecordingId} not found or not accessible to you.`, "error");
                showRecorderView('list');
            }
        }).catch(error => {
            console.error("Error refreshing meetings for deep link processing:", error);
            showNotificationCallback("Error processing deep link. Please try navigating manually.", "error");
            showRecorderView('list');
        });
    }

    // Publicly exposed methods of the RecorderView module
    return {
        /**
         * Initializes the RecorderView module.
         * Sets up callbacks, DOM references, event listeners, and initial state.
         */
        init: (
            _notifyCb, _switchCb, 
            _setLoadStateCb, 
            _getMeetingByIdCb, _updateMeetingCb, _addMeetingCb, // _addMeetingCb for adhoc creation
            _fetchMeetings, _uploadRecording, 
            _fetchAnalysisStatus, _fetchAnalysisData, _downloadPdf,
            _generateIdCb 
        ) => {
            // Assign callbacks from SharedAppLogic
            showNotificationCallback = _notifyCb;
            switchViewCallback = _switchCb;
            setButtonLoadingStateCallback = _setLoadStateCb;
            getMeetingByIdCallback = _getMeetingByIdCb;
            updateMeetingCallback = _updateMeetingCb;
            addMeetingCallback = _addMeetingCb; 
            fetchMeetingsAPI = _fetchMeetings;
            uploadRecordingAPI = _uploadRecording;
            fetchAnalysisStatusAPI = _fetchAnalysisStatus;
            fetchAnalysisDataAPI = _fetchAnalysisData; 
            downloadAnalysisPdfAPI = _downloadPdf;
            generateIdCallback = _generateIdCb; 
            
            // Setup the view
            initDOMReferences(); 
            setupEventListeners();
            populateAudioInputDevicesRec(); 
            
            // Initial data load and view display
            refreshMeetingsForRecorder(); 
            showRecorderView('list');
            updateRecorderRecordingUI(); // Set initial button states etc.
        },
        getHTML, // Expose getHTML to allow injection by the main page script
        handleDeepLink // Expose handleDeepLink for invocation from main page script
    };
})();
