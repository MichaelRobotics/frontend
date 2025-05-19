// /js/recorder-view.js
const RecorderView = (() => {
    let meetings = []; 
    
    let showNotificationCallback;
    let switchViewCallback;
    let setButtonLoadingStateCallback;
    let getMeetingByIdCallback; 
    let updateMeetingCallback;  
    let addMeetingCallback; 
    let fetchMeetingsAPI;       
    let uploadRecordingAPI;
    let fetchAnalysisStatusAPI;
    let fetchAnalysisDataAPI;
    let downloadAnalysisPdfAPI; 
    let generateIdCallback;     

    let currentRecorderMeeting = null; 
    let isRecording = false, isPaused = false, recordingStartTime, accumulatedPausedTime = 0, pauseStartTime, timerInterval, pollingInterval;
    
    // Media related state
    let mediaRecorder, audioChunks = [];
    let audioStreamForVisualizer = null; // Holds the current stream for visualization/recording
    let audioContext, analyser, visualizerFrameId;
    let currentSelectedDeviceId = null; // Keep track of the explicitly selected device

    // DOM Elements
    let meetingListViewRec, recordingViewRec, analysisViewRec;
    let newRecordingBtnRec, meetingListRec, noMeetingsMessageRec;
    let recordingMeetingTitleElemRec, meetingTitleInputElemRec, stopBtnElemRec, pauseResumeBtnElemRec, recordingIndicatorElemRec, recordingStatusTextElemRec, recordingTimeDisplayElemRec, recordingProgressElemRec, audioInputSelectElemRec, audioVisualizerCanvasElemRec, meetingNotesElemRec, audioQualitySelectElemRec;
    let analysisMeetingTitleElemRec, analysisDateDisplayElemRec, analysisProgressSectionElemRec, analysisStatusTextElemRec, analysisProgressPercentageElemRec, analysisProgressBarElemRec, analysisContentSectionElemRec, analysisTabsElemsRec, analysisPanelsElemsRec;
    let backToListBtnRec, logoutBtnRec, mainMenuBtnRec, downloadTranscriptBtnRec, downloadPdfBtnRec;

    function getHTML() {
        // HTML structure from michaelrobotics/frontend/frontend-prod-api/recorder.html
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

    function showRecorderView(viewName) {
        if (!meetingListViewRec || !recordingViewRec || !analysisViewRec || !backToListBtnRec) {
            console.error("Recorder view elements not fully initialized for showRecorderView.");
            return;
        }
        meetingListViewRec.classList.add('hidden');
        recordingViewRec.classList.add('hidden');
        analysisViewRec.classList.add('hidden');
        
        if (viewName === 'list') {
            backToListBtnRec.classList.add('hidden');
            meetingListViewRec.classList.remove('hidden');
            stopMicrophonePreview(); // Stop preview when going to list
        } else if (viewName === 'recording') {
            backToListBtnRec.classList.remove('hidden');
            recordingViewRec.classList.remove('hidden');
            // Start preview with currently selected device if not already recording
            if (!isRecording && audioInputSelectElemRec) {
                 activateMicrophonePreview(audioInputSelectElemRec.value || null);
            }
        } else if (viewName === 'analysis') {
            backToListBtnRec.classList.remove('hidden');
            analysisViewRec.classList.remove('hidden');
            stopMicrophonePreview(); // Stop preview when viewing analysis
        }
    }
    
    function getMeetingStatusText(status) {
        if (!status) return 'Unknown';
        const lowerStatus = status.toLowerCase();
        switch (lowerStatus) {
            case 'scheduled': return 'Scheduled';
            case 'recording': return 'Recording Now';
            case 'uploading_to_backend': return 'Uploading...';
            case 'processing': return 'Processing Analysis';
            case 'completed': return 'Completed & Analyzed';
            case 'analyzed': return 'Analyzed';
            case 'recorded': return 'Recorded (Pending Analysis)';
            case 'failed_to_start': return 'Failed to Start';
            case 'upload_failed': return 'Upload Failed';
            case 'status_check_error': return 'Status Check Error';
            case 'failed': return 'Failed';
            case 'failed_empty_recording': return 'Empty Recording - Failed';
            default: return status.charAt(0).toUpperCase() + status.slice(1);
        }
    }

    function getMeetingStatusClass(status) {
        if (!status) return 'status-unknown';
        const lowerStatus = status.toLowerCase();
        switch (lowerStatus) {
            case 'scheduled': return 'bg-purple-200 text-purple-800 status-scheduled';
            case 'recording': return 'bg-red-200 text-red-800 status-recording';
            case 'uploading_to_backend': return 'bg-blue-200 text-blue-800 status-uploading_to_backend';
            case 'processing': return 'bg-yellow-200 text-yellow-800 status-processing';
            case 'completed':
            case 'analyzed':
                return 'bg-green-200 text-green-800 status-completed';
            case 'recorded': return 'bg-indigo-200 text-indigo-800 status-recorded';
            case 'failed_to_start':
            case 'upload_failed':
            case 'status_check_error':
            case 'failed':
            case 'failed_empty_recording':
                return 'bg-red-300 text-red-900 status-failed';
            default: return 'bg-gray-300 text-gray-800 status-unknown';
        }
    }

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
            } else {
                meetingListRec.innerHTML = '<div class="no-meetings text-center text-gray-500 py-8 text-lg italic">No meetings found or scheduled for recording.</div>';
            }
            return;
        }
    
        if (noMeetingsMessageRec) noMeetingsMessageRec.classList.add('hidden');
    
        const sortedMeetings = [...meetings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
        sortedMeetings.forEach(meeting => {
            const meetingItemElement = document.createElement('div');
            meetingItemElement.className = 'meeting-item-card bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow duration-200 cursor-pointer mb-3';
            
            const statusText = getMeetingStatusText(meeting.status);
            const statusClass = getMeetingStatusClass(meeting.status);
            
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
                    handleStartScheduledRecording(meeting.id); 
                });
            } else {
                meetingItemElement.classList.remove('cursor-pointer');
                meetingItemElement.classList.add('opacity-70'); 
                if (['completed', 'analyzed'].includes(currentStatusLower) && meeting.recordingId) {
                    meetingItemElement.classList.add('cursor-pointer'); 
                    meetingItemElement.classList.remove('opacity-70');
                    meetingItemElement.addEventListener('click', () => {
                        handleViewRecorderAnalysis(meeting.recordingId); 
                    });
                }
            }
            meetingListRec.appendChild(meetingItemElement);
        });
    }

    async function handleStartScheduledRecording(meetingId) { 
        try {
            if (isRecording) {
                showNotificationCallback("A recording is already in progress. Please stop it before starting another.", "warning");
                return;
            }
            if (!meetingId) {
                showNotificationCallback('Invalid meeting ID provided.', 'error');
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
    
            if (!meetingObject.recordingId) { 
                showNotificationCallback('This meeting is missing an associated recording identifier (recordingId field). Cannot start recording.', 'error');
                return;
            }

            currentRecorderMeeting = {
                ...meetingObject, 
                id: meetingObject.id, 
                recorderId: meetingObject.recordingId, 
                audioQuality: audioQualitySelectElemRec ? audioQualitySelectElemRec.value : 'medium',
                isAdhoc: false, // Explicitly not ad-hoc
                isNewAdhocPendingSave: false
            };
    
            if (meetingTitleInputElemRec) {
                meetingTitleInputElemRec.value = currentRecorderMeeting.title;
                meetingTitleInputElemRec.readOnly = true; 
            }
            if (meetingNotesElemRec) {
                meetingNotesElemRec.value = currentRecorderMeeting.notes || '';
                meetingNotesElemRec.readOnly = true; 
            }
            if (recordingMeetingTitleElemRec) {
                recordingMeetingTitleElemRec.textContent = `Recording: ${currentRecorderMeeting.title}`;
            }
    
            showRecorderView('recording'); // This will also trigger activateMicrophonePreview
            await startActualRecording(); 
    
        } catch (error) {
            console.error('Error starting scheduled recording:', error);
            showNotificationCallback('Failed to start recording: ' + (error.message || 'Unknown error'), 'error');
            currentRecorderMeeting = null; 
            showRecorderView('list'); 
        }
    }
    
    async function refreshMeetingsForRecorder() {
        try {
            if (noMeetingsMessageRec) {
                noMeetingsMessageRec.textContent = "Fetching meetings...";
                noMeetingsMessageRec.classList.remove('hidden');
            }
            const response = await fetchMeetingsAPI(); 
            meetings = (response && response.success && Array.isArray(response.data)) ? response.data : []; 
            renderRecorderMeetingList(); 
        } catch (error) {
            console.error("Error fetching meetings in RecorderView:", error);
            meetings = []; 
            renderRecorderMeetingList(); 
            if (noMeetingsMessageRec && meetings.length === 0) { 
                noMeetingsMessageRec.textContent = "Could not load meetings. Please try refreshing.";
                noMeetingsMessageRec.classList.remove('hidden');
            }
        }
    }

    async function handleStartAdHocRecording() {
        if (isRecording) {
            showNotificationCallback("A recording is already in progress. Please stop it first.", "warning");
            return;
        }
    
        const newRecId = `rec-${generateIdCallback()}`;
        currentRecorderMeeting = {
            recorderId: newRecId,    
            title: `Ad-hoc Recording - ${new Date().toLocaleDateString()}`,
            date: new Date().toISOString(), 
            status: 'Scheduled', 
            notes: '',
            clientEmail: '', 
            isAdhoc: true, 
            isNewAdhocPendingSave: true, // Indicates it needs a full meeting record creation later
            audioQuality: audioQualitySelectElemRec ? audioQualitySelectElemRec.value : 'medium',
            // 'id' (sm-...) will be assigned by backend if/when a meeting record is created for this.
        };
    
        if (meetingTitleInputElemRec) {
            meetingTitleInputElemRec.value = currentRecorderMeeting.title;
            meetingTitleInputElemRec.readOnly = false; 
        }
        if (meetingNotesElemRec) {
            meetingNotesElemRec.value = '';
            meetingNotesElemRec.readOnly = false;
        }
        if (recordingMeetingTitleElemRec) {
            recordingMeetingTitleElemRec.textContent = `Recording: ${currentRecorderMeeting.title}`;
        }
        
        showNotificationCallback("Preparing new ad-hoc recording session.", "info");
        showRecorderView('recording'); // This will trigger activateMicrophonePreview
        await startActualRecording();
    }
    
    async function populateAudioInputDevicesRec() {
        if (!audioInputSelectElemRec) {
            console.warn("Audio input select element not found for populating.");
            return false; // Indicate failure
        }
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); 
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            audioInputSelectElemRec.innerHTML = ''; 

            if (audioInputs.length > 0) {
                audioInputs.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.label || `Microphone ${audioInputSelectElemRec.options.length + 1}`;
                    audioInputSelectElemRec.appendChild(option);
                });
                currentSelectedDeviceId = audioInputs[0].deviceId; // Default to first device
                return true; // Indicate success
            } else {
                audioInputSelectElemRec.innerHTML = '<option value="">No audio input devices found</option>';
                showNotificationCallback("No audio input devices found. Please check your microphone.", "warning");
                return false; // Indicate failure
            }
        } catch (err) {
            console.error("Error populating audio devices or getting permissions:", err);
            audioInputSelectElemRec.innerHTML = '<option value="">Error accessing microphones</option>';
            let message = "Could not access microphones.";
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                message = "Microphone access denied. Please enable microphone permissions in your browser settings for this site.";
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                message = "No microphone found. Please connect a microphone.";
            } else {
                message = `Error accessing microphones: ${err.message}`;
            }
            showNotificationCallback(message, "error");
            return false; // Indicate failure
        }
    }

    /**
     * Activates a microphone preview stream and starts the visualizer.
     * @param {string|null} deviceId - The specific device ID to use. Null for default.
     */
    async function activateMicrophonePreview(deviceId) {
        if (isRecording) { // Don't interfere if an actual recording is in progress
            console.log("activateMicrophonePreview: Actual recording in progress, preview activation skipped.");
            return;
        }

        stopMicrophonePreview(); // Stop any existing preview stream and visualizer

        if (!deviceId && audioInputSelectElemRec && audioInputSelectElemRec.options.length > 0) {
            deviceId = audioInputSelectElemRec.value; // Use current selection if no specific ID passed
        }
        currentSelectedDeviceId = deviceId; // Store the device ID being activated

        const constraints = { audio: deviceId ? { deviceId: { exact: deviceId } } : true };
        try {
            audioStreamForVisualizer = await navigator.mediaDevices.getUserMedia(constraints);
            if (audioStreamForVisualizer && audioStreamForVisualizer.active) {
                console.log("Microphone preview activated for deviceId:", deviceId || "default");
                setupAudioVisualizerRec(audioStreamForVisualizer);
            } else {
                throw new Error("Failed to get active stream for preview.");
            }
        } catch (err) {
            console.error("Error activating microphone preview:", err);
            showNotificationCallback(`Could not start microphone preview: ${err.message}`, "warning");
            stopAudioVisualizerRec(); // Ensure canvas is cleared
            audioStreamForVisualizer = null;
        }
    }

    /**
     * Stops the current microphone preview stream and visualizer.
     */
    function stopMicrophonePreview() {
        if (audioStreamForVisualizer && audioStreamForVisualizer.active) {
            audioStreamForVisualizer.getTracks().forEach(track => track.stop());
            console.log("Microphone preview stream stopped.");
        }
        audioStreamForVisualizer = null;
        stopAudioVisualizerRec(); // Clears canvas and stops animation loop
    }


    function setupEventListeners() {
        if (!newRecordingBtnRec || !stopBtnElemRec || !pauseResumeBtnElemRec || 
            !audioInputSelectElemRec || !backToListBtnRec || !mainMenuBtnRec || 
            !logoutBtnRec || !analysisTabsElemsRec || !downloadTranscriptBtnRec || !downloadPdfBtnRec) { 
            console.error("Recorder DOM not fully initialized for event listeners."); 
            return; 
        }

        newRecordingBtnRec.addEventListener('click', handleStartAdHocRecording);
        stopBtnElemRec.addEventListener('click', () => stopActualRecording(false)); 
        pauseResumeBtnElemRec.addEventListener('click', handlePauseResumeRec);
        audioInputSelectElemRec.addEventListener('change', handleAudioInputChange);
        
        backToListBtnRec.addEventListener('click', async () => {
            if(isRecording && !confirm("Recording is in progress. Stop and go to list? The current recording will be processed.")) {
                return;
            }
            if(isRecording) await stopActualRecording(false); 
            stopMicrophonePreview(); // Stop preview when going to list
            await refreshMeetingsForRecorder(); 
            showRecorderView('list');
        });

        mainMenuBtnRec.addEventListener('click', async () => {
             if(isRecording && !confirm("Recording in progress. Stop and go to App Dashboard?")) return;
             if(isRecording) await stopActualRecording(false);
             stopMicrophonePreview(); // Stop preview when navigating away
            switchViewCallback('index'); 
        });

        logoutBtnRec.addEventListener('click', async () => { 
            if(isRecording && !confirm("Recording in progress. Stop and logout?")) return;
            if(isRecording) await stopActualRecording(false); 
            stopMicrophonePreview(); // Stop preview on logout

            if (typeof SharedAppLogic !== 'undefined' && typeof SharedAppLogic.logoutAPI === 'function') {
                await SharedAppLogic.logoutAPI(); 
            } else {
                if (typeof SharedAppLogic !== 'undefined' && SharedAppLogic.clearAuthTokenAndUser) SharedAppLogic.clearAuthTokenAndUser();
                localStorage.removeItem('pendingRole'); 
                window.location.href = 'landing-page.html'; 
            }
            // Notification and redirection should be handled by logoutAPI or above.
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
                        setButtonLoadingStateCallback(downloadPdfBtnRec, true, '.button-text', '.button-loader'); 
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

    async function handleAudioInputChange() { 
        const newDeviceId = audioInputSelectElemRec.value;
        if (isRecording) {
            if (currentSelectedDeviceId === newDeviceId) return; // No change

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
                    audioInputSelectElemRec.value = currentSelectedDeviceId; // Revert dropdown
                    return;
                }
                // At this point, isRecording is false, previous recording is stopped and processing.
                // Now prepare for a new segment.
                showNotificationCallback("Starting new recording segment with selected microphone...", "info");
                
                const previousTitleBase = currentRecorderMeeting?.title?.replace(/ \(Segment .*\)| \(Ad-hoc.*?\)/, '') || "Continued Recording";
                const previousNotes = currentRecorderMeeting?.notes || "";
                const originalMeetingIdForSegment = currentRecorderMeeting?.isAdhoc ? null : (currentRecorderMeeting?.originalMeetingId || currentRecorderMeeting?.id);
                const clientEmailForSegment = currentRecorderMeeting?.clientEmail || null;

                const newSegmentRecorderId = `rec-segment-${generateIdCallback(6)}`;
                const newMeetingIdForSegment = `sm-segment-${generateIdCallback(6)}`; // If each segment is a new meeting entry

                currentRecorderMeeting = { 
                    id: newMeetingIdForSegment, 
                    recorderId: newSegmentRecorderId, 
                    title: `${previousTitleBase} (Segment ${Math.floor(Math.random()*900)+100})`,
                    date: new Date().toISOString(), 
                    status: 'Scheduled', 
                    analysisAvailable: false,
                    clientEmail: clientEmailForSegment, 
                    notes: previousNotes, 
                    originalMeetingId: originalMeetingIdForSegment, 
                    audioQuality: audioQualitySelectElemRec ? audioQualitySelectElemRec.value : 'medium',
                    isAdhoc: !originalMeetingIdForSegment, 
                    isNewAdhocPendingSave: !originalMeetingIdForSegment, // Treat as new if no original link
                };
                currentSelectedDeviceId = newDeviceId; // Update selected device ID

                if(meetingTitleInputElemRec) meetingTitleInputElemRec.value = currentRecorderMeeting.title;
                if(meetingNotesElemRec) meetingNotesElemRec.value = currentRecorderMeeting.notes;
                if(recordingMeetingTitleElemRec) recordingMeetingTitleElemRec.textContent = `Recording: ${currentRecorderMeeting.title}`;
                
                // No need to call activateMicrophonePreview here, startActualRecording will handle it.
                await startActualRecording(); 
            } else {
                // User cancelled the switch, revert dropdown to the actual active device ID
                audioInputSelectElemRec.value = currentSelectedDeviceId; 
                showNotificationCallback("Microphone change cancelled.", "info");
            }
        } else { // Not currently recording, just switch the preview
            if (currentSelectedDeviceId !== newDeviceId) {
                await activateMicrophonePreview(newDeviceId);
                if (audioInputSelectElemRec.options.length > 0 && audioInputSelectElemRec.selectedIndex >=0) {
                     showNotificationCallback(`Microphone preview changed to: ${audioInputSelectElemRec.options[audioInputSelectElemRec.selectedIndex].text}.`, "info");
                }
            }
        }
    }

    async function startActualRecording() {
        if (isRecording) { 
            showNotificationCallback("A recording is already in progress.", "warning");
            return; 
        }
        if (!currentRecorderMeeting || !currentRecorderMeeting.recorderId) {
            showNotificationCallback("No meeting context or recorder ID. Cannot start recording.", "error");
            return; 
        }

        try {
            // Ensure audioStreamForVisualizer is active and for the correct device
            // If not, or if it's different from currentSelectedDeviceId, get a new one.
            const selectedDeviceIdInDropdown = audioInputSelectElemRec.value;
            if (!audioStreamForVisualizer || !audioStreamForVisualizer.active || currentSelectedDeviceId !== selectedDeviceIdInDropdown) {
                console.log("startActualRecording: Visualizer stream not active or device mismatch. Getting new stream for device:", selectedDeviceIdInDropdown);
                stopMicrophonePreview(); // Stop any old preview
                const constraints = { audio: selectedDeviceIdInDropdown ? { deviceId: { exact: selectedDeviceIdInDropdown } } : true };
                audioStreamForVisualizer = await navigator.mediaDevices.getUserMedia(constraints);
                currentSelectedDeviceId = selectedDeviceIdInDropdown; // Update the active device ID
                if (!audioStreamForVisualizer || !audioStreamForVisualizer.active) {
                    throw new Error("Failed to get active audio stream for recording.");
                }
                // Visualizer will be set up with this new stream below, or if already set up, it continues
            }
            
            // Now, audioStreamForVisualizer should be the correct, active stream.
            // Setup visualizer if it's not already running with this stream (idempotent call is fine)
            setupAudioVisualizerRec(audioStreamForVisualizer); 
            
            currentStreamTracks = audioStreamForVisualizer.getAudioTracks(); // Get tracks from the stream we will use
            if (currentStreamTracks.length === 0) {
                throw new Error("No audio tracks found in the selected media stream for MediaRecorder.");
            }
            
            const qualitySetting = audioQualitySelectElemRec ? audioQualitySelectElemRec.value : 'medium';
            let mediaRecorderOptions = { mimeType: 'audio/webm;codecs=opus' }; 
            
            if (!MediaRecorder.isTypeSupported(mediaRecorderOptions.mimeType)) {
                mediaRecorderOptions.mimeType = 'audio/ogg;codecs=opus';
                if (!MediaRecorder.isTypeSupported(mediaRecorderOptions.mimeType)) {
                    mediaRecorderOptions.mimeType = 'audio/webm'; 
                     if (!MediaRecorder.isTypeSupported(mediaRecorderOptions.mimeType)) {
                        throw new Error("Browser does not support required audio recording formats (webm/ogg with opus).");
                    }
                }
            }

            if (qualitySetting === 'high') mediaRecorderOptions.audioBitsPerSecond = 128000;
            else if (qualitySetting === 'medium') mediaRecorderOptions.audioBitsPerSecond = 96000;
            else if (qualitySetting === 'low') mediaRecorderOptions.audioBitsPerSecond = 64000;
            
            // Pass the existing stream to MediaRecorder
            mediaRecorder = new MediaRecorder(audioStreamForVisualizer, mediaRecorderOptions);
            
            audioChunks = [];
            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = handleActualRecordingStop; 
            mediaRecorder.onerror = (event) => { 
                console.error("MediaRecorder error:", event.error?.name, event.error?.message); 
                showNotificationCallback(`Recording error: ${event.error?.name || 'Unknown error'} - ${event.error?.message || 'Please check console.'}`, "error"); 
                stopActualRecording(true); 
            };

            mediaRecorder.start(1000); 
            isRecording = true; isPaused = false; recordingStartTime = Date.now(); accumulatedPausedTime = 0;
            
            currentRecorderMeeting.status = 'recording';
            currentRecorderMeeting.startTimeActual = new Date().toISOString(); 
            if(audioQualitySelectElemRec) currentRecorderMeeting.audioQuality = audioQualitySelectElemRec.value;
            if(meetingTitleInputElemRec) currentRecorderMeeting.title = meetingTitleInputElemRec.value.trim() || currentRecorderMeeting.title || "Untitled Recording";
            if(meetingNotesElemRec) currentRecorderMeeting.notes = meetingNotesElemRec.value.trim();
            
            if (currentRecorderMeeting.id && !currentRecorderMeeting.isNewAdhocPendingSave) { 
                const meetingUpdatePayload = {
                    status: 'recording',
                    startTimeActual: currentRecorderMeeting.startTimeActual,
                    ...(meetingNotesElemRec && !meetingNotesElemRec.readOnly && { notes: currentRecorderMeeting.notes }),
                    ...(meetingTitleInputElemRec && !meetingTitleInputElemRec.readOnly && { title: currentRecorderMeeting.title }),
                };
                try {
                    await updateMeetingCallback(currentRecorderMeeting.id, meetingUpdatePayload); 
                } catch (updateError) {
                    console.error("Failed to update meeting status to 'recording' on backend:", updateError);
                    showNotificationCallback("Recording started, but failed to sync status with server.", "warning");
                }
            } else if (currentRecorderMeeting.isAdhoc && currentRecorderMeeting.isNewAdhocPendingSave) {
                // Logic for creating a meeting record for a new ad-hoc session if desired AT START.
                // This often involves reconciling IDs returned from backend.
                // For simplicity, often ad-hoc records are only fully created on STOP/UPLOAD.
                console.log("Ad-hoc recording started. Backend record creation might be deferred to upload.");
            }
            
            await refreshMeetingsForRecorder(); 
            updateRecorderRecordingUI();
            if(timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateRecorderTimer, 1000);
            showNotificationCallback(`Recording started (Quality: ${qualitySetting}).`, "success");

        } catch (err) { 
            console.error("Error starting recording:", err);
            showNotificationCallback(`Error starting recording: ${err.message}. Check microphone permissions and selection.`, "error");
            handleMediaRecorderCleanup(); // Clean up any partial setup
            if (currentRecorderMeeting) { 
                currentRecorderMeeting.status = 'failed_to_start'; 
                try { 
                    if (currentRecorderMeeting.id && !currentRecorderMeeting.isAdhoc && !currentRecorderMeeting.isNewAdhocPendingSave) { 
                        await updateMeetingCallback(currentRecorderMeeting.id, { status: 'failed_to_start' }); 
                    }
                } catch(e) { console.error("Failed to update meeting status on start error:", e);}
            }
            isRecording = false; 
            updateRecorderRecordingUI(); 
        }
    }
    
    async function handleActualRecordingStop() { 
        const stoppedMeetingContext = { ...currentRecorderMeeting }; 
        const mediaRecorderMimeType = mediaRecorder?.mimeType; // Capture before nullifying

        // Call cleanup for MediaRecorder related things, but visualizer stream might persist for preview
        if (mediaRecorder && mediaRecorder.stream && mediaRecorder.stream.active) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop()); // Stop tracks used by MR
        }
        mediaRecorder = null; // Release MediaRecorder instance
        // isRecording and isPaused flags are reset by stopActualRecording or handlePauseResume
        // Don't call full handleMediaRecorderCleanup yet if we want preview to resume.

        if (!stoppedMeetingContext || !stoppedMeetingContext.recorderId) {
            console.error("Stopped meeting context or its recorderId is null in onstop handler");
            if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false);
            isRecording = false; 
            updateRecorderRecordingUI();
            return;
        }
        
        if (audioChunks.length === 0) {
            showNotificationCallback("No audio data was recorded. Upload cancelled.", "warning");
            if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false);
            isRecording = false;
            updateRecorderRecordingUI();
            try {
                if(stoppedMeetingContext.id && !stoppedMeetingContext.isAdhoc && !stoppedMeetingContext.isNewAdhocPendingSave) {
                     await updateMeetingCallback(stoppedMeetingContext.id, { status: 'failed_empty_recording' });
                }
            } catch (e) { console.error("Failed to update status for empty recording", e); }
            await refreshMeetingsForRecorder();
            // After stopping, reactivate microphone preview for the selected device
            if (audioInputSelectElemRec) activateMicrophonePreview(audioInputSelectElemRec.value || null);
            return;
        }

        const audioBlob = new Blob(audioChunks, {type: mediaRecorderMimeType || 'audio/webm;codecs=opus'}); 
        audioChunks = []; 

        stoppedMeetingContext.duration = formatDurationRec(Date.now() - recordingStartTime - accumulatedPausedTime); 
        stoppedMeetingContext.status = 'uploading_to_backend'; 
        stoppedMeetingContext.size = audioBlob.size > 0 ? `${(audioBlob.size / (1024*1024)).toFixed(2)}MB` : '0MB';
        
        try {
            if(stoppedMeetingContext.id && !stoppedMeetingContext.isAdhoc && !stoppedMeetingContext.isNewAdhocPendingSave) {
                await updateMeetingCallback(stoppedMeetingContext.id, { 
                    status: 'uploading_to_backend', 
                    duration: stoppedMeetingContext.duration, 
                }); 
            }
            
            await refreshMeetingsForRecorder(); 
            showNotificationCallback("Recording stopped. Uploading to server...", "info");

            const formData = new FormData();
            formData.append('audioFile', audioBlob, `${stoppedMeetingContext.recorderId}.webm`); 
            formData.append('notes', stoppedMeetingContext.notes || '');
            formData.append('quality', stoppedMeetingContext.audioQuality || 'medium');
            formData.append('title', stoppedMeetingContext.title || 'Untitled Recording');
            
            if (stoppedMeetingContext.originalMeetingId) { 
                formData.append('originalMeetingId', stoppedMeetingContext.originalMeetingId);
            } else if (!stoppedMeetingContext.isAdhoc && stoppedMeetingContext.id) {
                formData.append('originalMeetingId', stoppedMeetingContext.id);
            }
            
            const uploadResponse = await uploadRecordingAPI(stoppedMeetingContext.recorderId, formData); 

            if (uploadResponse && uploadResponse.success) {
                const finalMeetingId = uploadResponse.meetingId || stoppedMeetingContext.id; 
                const finalRecorderId = uploadResponse.recordingId || stoppedMeetingContext.recorderId; 
                const finalStatus = uploadResponse.status || 'processing';

                stoppedMeetingContext.id = finalMeetingId;
                stoppedMeetingContext.recorderId = finalRecorderId;
                stoppedMeetingContext.status = finalStatus;

                if (finalMeetingId) { 
                     await updateMeetingCallback(finalMeetingId, { status: finalStatus, analysisAvailable: false });
                }
                
                showNotificationCallback("Upload complete. Analysis processing started by backend.", "success");
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
            updateRecorderRecordingUI(); 
            await refreshMeetingsForRecorder(); 
            // After everything, reactivate microphone preview for the selected device
            if (audioInputSelectElemRec) activateMicrophonePreview(audioInputSelectElemRec.value || null);
        }
    }
    
    async function initiateRecorderAnalysis(meetingForAnalysis) { 
        if (!analysisMeetingTitleElemRec || !analysisViewRec || !meetingForAnalysis || !meetingForAnalysis.recorderId) {
            console.error("Cannot initiate analysis: missing DOM elements or meeting data/recorderId.", meetingForAnalysis);
            showRecorderView('list'); 
            return; 
        }
        currentRecorderMeeting = { ...meetingForAnalysis }; 
        
        showRecorderView('analysis'); // This will stop any active mic preview from recording view
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
            if (!currentRecorderMeeting || currentRecorderMeeting.recorderId !== meetingForAnalysis.recorderId) { 
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
                    
                    if (analysisData) { 
                        currentRecorderMeeting.analysisData = analysisData; 
                        currentRecorderMeeting.status = finalStatusLower; 
                        
                        if(currentRecorderMeeting.id ){ 
                             await updateMeetingCallback(currentRecorderMeeting.id, { 
                                status: currentRecorderMeeting.status, 
                                analysisAvailable: true 
                            });
                        }
                        await refreshMeetingsForRecorder(); 
                        
                        if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.innerHTML = analysisData.summary ? analysisData.summary.replace(/\n/g, '<br>') : "<p>Summary not available.</p>";
                        if(analysisPanelsElemsRec.transcript) analysisPanelsElemsRec.transcript.innerHTML = analysisData.transcript ? `<pre class="whitespace-pre-wrap text-sm">${analysisData.transcript}</pre>` : "<p>Transcript not available.</p>";
                        
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
                    analysisProgressBarElemRec.style.backgroundColor = 'var(--red-600)'; 
                    currentRecorderMeeting.status = 'failed';
                     if(currentRecorderMeeting.id){ 
                        await updateMeetingCallback(currentRecorderMeeting.id, { status: 'failed', analysisAvailable: false });
                     }
                    await refreshMeetingsForRecorder();
                }
            } catch (error) {
                console.error("Error polling analysis status:", error);
                analysisStatusTextElemRec.textContent = `Error updating status: ${error.message}. Retrying...`;
            }
        }
        pollStatus(); 
        pollingInterval = setInterval(pollStatus, 8000); 
    }
    
    async function handleViewRecorderAnalysis(recorderIdToView) { 
        if (!recorderIdToView) {
            showNotificationCallback("No recording ID specified to view analysis.", "error");
            return;
        }
        
        let meetingToAnalyze = meetings.find(m => m.recordingId === recorderIdToView); 

        if (!meetingToAnalyze) { 
            showNotificationCallback("Meeting details not found. Attempting to refresh...", "info");
            await refreshMeetingsForRecorder(); 
            meetingToAnalyze = meetings.find(m => m.recordingId === recorderIdToView);
            if (!meetingToAnalyze) {
                showNotificationCallback("Meeting not found even after refresh. Cannot display analysis.", "error");
                return;
            }
        }
        currentRecorderMeeting = { ...meetingToAnalyze }; 
        
        const statusLower = currentRecorderMeeting.status?.toLowerCase();

        if ((statusLower === 'completed' || statusLower === 'analyzed')) {
            if (!currentRecorderMeeting.analysisData) { 
                showNotificationCallback("Fetching latest analysis data...", "info");
                try {
                    const analysisData = await fetchAnalysisDataAPI(currentRecorderMeeting.recordingId);
                    if (analysisData) { 
                        currentRecorderMeeting.analysisData = analysisData;
                    } else {
                        throw new Error("No analysis data returned from API for this completed meeting.");
                    }
                } catch (error) {
                    console.error("Failed to fetch analysis data for viewing:", error);
                    showNotificationCallback("Could not load analysis data: " + error.message, "error");
                    return; 
                }
            }
            
            analysisMeetingTitleElemRec.textContent = `Analysis for: ${currentRecorderMeeting.title}`;
            analysisDateDisplayElemRec.textContent = `Recorded: ${new Date(currentRecorderMeeting.startTimeActual || currentRecorderMeeting.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}`;
            analysisProgressSectionElemRec.classList.add('hidden'); 
            analysisContentSectionElemRec.classList.remove('hidden'); 
            
            if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.innerHTML = currentRecorderMeeting.analysisData.summary ? currentRecorderMeeting.analysisData.summary.replace(/\n/g, '<br>') : "<p>Summary not available.</p>";
            if(analysisPanelsElemsRec.transcript) analysisPanelsElemsRec.transcript.innerHTML = currentRecorderMeeting.analysisData.transcript ? `<pre class="whitespace-pre-wrap text-sm">${currentRecorderMeeting.analysisData.transcript}</pre>` : "<p>Transcript not available.</p>";
            
            if(analysisTabsElemsRec && analysisTabsElemsRec.length > 0) {
                analysisTabsElemsRec.forEach(t => t.classList.remove('active'));
                const summaryTab = Array.from(analysisTabsElemsRec).find(t => t.dataset.tab === 'summary');
                if (summaryTab) summaryTab.classList.add('active'); 
            }
            Object.values(analysisPanelsElemsRec).forEach(p => {if(p) p.classList.add('hidden');}); 
            if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.classList.remove('hidden'); 
            
            showRecorderView('analysis');

        } else if (statusLower === 'processing' || statusLower === 'uploading_to_backend') {
            showNotificationCallback(`Analysis for "${currentRecorderMeeting.title}" is still processing. Displaying progress.`, "info");
            initiateRecorderAnalysis(currentRecorderMeeting); 
        } else {
            showNotificationCallback(`Analysis not yet available for "${currentRecorderMeeting.title}". Current status: ${getMeetingStatusText(currentRecorderMeeting.status)}.`, "warning");
        }
    }
    
    function updateRecorderRecordingUI() { 
        if (!recordingIndicatorElemRec || !recordingStatusTextElemRec || !pauseResumeBtnElemRec || !stopBtnElemRec || !newRecordingBtnRec) {
            return;
        }
        const isActuallyRecording = isRecording && !isPaused;
        const isActuallyPaused = isRecording && isPaused;

        recordingIndicatorElemRec.className = `w-3.5 h-3.5 rounded-full mr-2.5 ${isActuallyRecording ? 'bg-red-500 status-recording' : (isActuallyPaused ? 'bg-yellow-500 animate-none' : 'bg-gray-400 animate-none')}`;
        recordingStatusTextElemRec.textContent = isActuallyRecording ? "Recording..." : (isActuallyPaused ? "Paused" : "Idle");
        
        const pauseResumeTextSpan = pauseResumeBtnElemRec.querySelector('.button-text');
        if (pauseResumeTextSpan) { 
            pauseResumeTextSpan.innerHTML = isPaused ? '<i class="fas fa-play mr-2 icon-hover"></i>Resume' : '<i class="fas fa-pause mr-2 icon-hover"></i>Pause';
        }
        
        stopBtnElemRec.disabled = !isRecording;
        pauseResumeBtnElemRec.disabled = !isRecording;
        newRecordingBtnRec.disabled = isRecording; 
        if(audioInputSelectElemRec) audioInputSelectElemRec.disabled = isRecording; 
        if(audioQualitySelectElemRec) audioQualitySelectElemRec.disabled = isRecording;
        
        const titleIsReadOnly = isRecording || (currentRecorderMeeting && !currentRecorderMeeting.isAdhoc);
        const notesAreReadOnly = isRecording || (currentRecorderMeeting && !currentRecorderMeeting.isAdhoc);

        if(meetingTitleInputElemRec) meetingTitleInputElemRec.readOnly = titleIsReadOnly;
        if(meetingNotesElemRec) meetingNotesElemRec.readOnly = notesAreReadOnly;
    }

    function updateRecorderTimer() { 
        if (!isRecording || isPaused || !recordingTimeDisplayElemRec) return;
        const elapsed = Date.now() - recordingStartTime - accumulatedPausedTime;
        recordingTimeDisplayElemRec.textContent = formatDurationRec(elapsed);
        if(recordingProgressElemRec) {
            const maxDurationForProgress = 2 * 60 * 60 * 1000; 
            recordingProgressElemRec.style.width = `${Math.min(100, (elapsed / maxDurationForProgress) * 100)}%`;
        }
    }

    function formatDurationRec(ms) { 
        if (isNaN(ms) || ms < 0) return "00:00:00";
        const totalSeconds = Math.floor(ms / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return [h,m,s].map(v => String(v).padStart(2,'0')).join(':');
    }

    function handlePauseResumeRec() { 
        if (!mediaRecorder || !isRecording) { 
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
            }
        } else { 
            try {
                mediaRecorder.pause(); 
                isPaused = true; 
                pauseStartTime = Date.now(); 
                clearInterval(timerInterval); 
                // Visualizer's draw loop will now pause itself based on isPaused & isRecording
                showNotificationCallback("Recording Paused.", "info");
            } catch (e) {
                console.error("Error pausing MediaRecorder:", e);
                showNotificationCallback("Failed to pause recording.", "error");
            }
        }
        updateRecorderRecordingUI();
    }

    async function stopActualRecording(errorOccurred = false) { 
        if (!isRecording && !errorOccurred) { 
            if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false, '.button-text', '.button-loader'); 
            updateRecorderRecordingUI(); 
            return; 
        }
        
        if (isRecording || errorOccurred) { 
             if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, true, '.button-text', '.button-loader');
        }

        const wasRecordingFlag = isRecording; 
        isRecording = false; // Set flag early
        isPaused = false; // Reset pause state on stop

        if (mediaRecorder && mediaRecorder.state !== "inactive") { 
            mediaRecorder.stop(); 
        } else { 
            // If mediaRecorder already stopped or never started properly
            // We still need to ensure cleanup and UI update if it was an error stop
            if (errorOccurred) {
                handleMediaRecorderCleanup(); // Clean up any partial media resources
                showNotificationCallback("Recording stopped due to an error.", "error");
            } else if (wasRecordingFlag) {
                 showNotificationCallback("Recording process already stopped or was not active.", "info");
            }
            if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false, '.button-text', '.button-loader');
            updateRecorderRecordingUI(); 
            // If onstop won't be called, and not an error, reactivate preview
            if (!errorOccurred && wasRecordingFlag && (!mediaRecorder || mediaRecorder.state === "inactive")) {
                if (audioInputSelectElemRec) activateMicrophonePreview(audioInputSelectElemRec.value || null);
            }
        }
    }

    function handleMediaRecorderCleanup() { 
        if(timerInterval) clearInterval(timerInterval); 
        timerInterval = null;
        // Don't call stopAudioVisualizerRec() here if we want preview to resume.
        // The visualizer will stop drawing if isRecording becomes false (handled by its draw loop).
        // We only need to clean up the MediaRecorder's use of the stream.

        if (mediaRecorder && mediaRecorder.stream && mediaRecorder.stream.active) {
            // MediaRecorder uses a clone of the stream usually, or the stream itself.
            // Stopping tracks here might affect the audioStreamForVisualizer if they are the same.
            // It's safer to let activateMicrophonePreview handle stopping old stream tracks if a new one is started.
            // For now, just ensure mediaRecorder is cleaned up.
            console.log("Cleaning up MediaRecorder instance.");
        }
        
        if (mediaRecorder) {
            mediaRecorder.ondataavailable = null;
            mediaRecorder.onstop = null;
            mediaRecorder.onerror = null;
            mediaRecorder = null; 
        }
        
        audioChunks = []; 
        // isRecording, isPaused are reset by the calling function (stopActualRecording or handlePauseResume)
        updateRecorderRecordingUI(); 
    }

    function setupAudioVisualizerRec(stream) { 
        if (!audioVisualizerCanvasElemRec || !stream || !stream.active || stream.getAudioTracks().length === 0) {
            stopAudioVisualizerRec(); // Ensure it's cleared if conditions aren't met
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
            analyser.fftSize = 256; 
            const bufferLength = analyser.frequencyBinCount; 
            const dataArray = new Uint8Array(bufferLength);

            const canvasCtx = audioVisualizerCanvasElemRec.getContext('2d');
            audioVisualizerCanvasElemRec.width = audioVisualizerCanvasElemRec.offsetWidth; 
            audioVisualizerCanvasElemRec.height = audioVisualizerCanvasElemRec.offsetHeight; 
            
            function draw() {
                // Draw if visualizer stream is active, AND ( (not recording) OR (recording AND not paused) )
                const shouldDraw = audioStreamForVisualizer && audioStreamForVisualizer.active && analyser && 
                                   (!isRecording || (isRecording && !isPaused));

                if (!shouldDraw) { 
                    if (visualizerFrameId) cancelAnimationFrame(visualizerFrameId);
                    visualizerFrameId = null;
                    // Optionally clear canvas to a static "idle" state if desired when not drawing active audio
                    if (canvasCtx && audioVisualizerCanvasElemRec) {
                         canvasCtx.fillStyle = 'rgb(224, 242, 254)'; 
                         canvasCtx.fillRect(0, 0, audioVisualizerCanvasElemRec.width, audioVisualizerCanvasElemRec.height);
                    }
                    return; 
                }
                visualizerFrameId = requestAnimationFrame(draw);
                analyser.getByteFrequencyData(dataArray); 

                canvasCtx.fillStyle = 'rgb(224, 242, 254)'; 
                canvasCtx.fillRect(0, 0, audioVisualizerCanvasElemRec.width, audioVisualizerCanvasElemRec.height);
                
                const barWidth = (audioVisualizerCanvasElemRec.width / bufferLength) * 1.8; 
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeightFraction = dataArray[i] / 255.0; 
                    const barHeight = barHeightFraction * audioVisualizerCanvasElemRec.height * 0.9; 
                    
                    const g = Math.floor(barHeightFraction * 150); 
                    const b = Math.floor(50 + barHeightFraction * 205); 
                    canvasCtx.fillStyle = `rgb(30, ${g}, ${b})`; 
                    
                    canvasCtx.fillRect(x, audioVisualizerCanvasElemRec.height - barHeight, barWidth, barHeight);
                    x += barWidth + 1; 
                }
            }
            if (visualizerFrameId) cancelAnimationFrame(visualizerFrameId); 
            draw(); 
        } catch (e) { 
            console.error("Error setting up audio visualizer:", e); 
            showNotificationCallback("Could not start audio visualizer: " + e.message, "warning");
            stopAudioVisualizerRec(); // Ensure cleanup on error
        }
    }

    function stopAudioVisualizerRec() { 
        if (visualizerFrameId) cancelAnimationFrame(visualizerFrameId); 
        visualizerFrameId = null;
        if(audioVisualizerCanvasElemRec && audioVisualizerCanvasElemRec.getContext('2d')) {
            const canvasCtx = audioVisualizerCanvasElemRec.getContext('2d');
            canvasCtx.fillStyle = 'rgb(224, 242, 254)'; 
            canvasCtx.fillRect(0, 0, audioVisualizerCanvasElemRec.width, audioVisualizerCanvasElemRec.height);
        }
         if (analyser && typeof analyser.disconnect === 'function') {
            analyser.disconnect();
        }
        if (window.currentVisualizerSourceNode && typeof window.currentVisualizerSourceNode.disconnect === 'function') {
            window.currentVisualizerSourceNode.disconnect();
        }
        // audioContext is not closed here to allow reuse.
    }

    function handleDeepLink(urlRecordingId, urlRecorderCode) { 
        if (!urlRecordingId || !urlRecorderCode) {
            showNotificationCallback("Deep link is missing recording ID or access code.", "warning");
            showRecorderView('list');
            return;
        }
        showNotificationCallback(`Attempting to access via deep link for recording ID: ${urlRecordingId}`, "info");

        refreshMeetingsForRecorder().then(() => { 
            const meeting = meetings.find(m => m.recordingId === urlRecordingId); 
            if (meeting) {
                if (meeting.recorderAccessCode === urlRecorderCode) {
                    showNotificationCallback(`Accessing scheduled recording via link: ${meeting.title}`, "info");
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

    return {
        init: async ( // Make init async to await populateAudioInputDevicesRec
            _notifyCb, _switchCb, 
            _setLoadStateCb, 
            _getMeetingByIdCb, _updateMeetingCb, _addMeetingCb,
            _fetchMeetings, _uploadRecording, 
            _fetchAnalysisStatus, _fetchAnalysisData, _downloadPdf,
            _generateIdCb 
        ) => {
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
            
            initDOMReferences(); 
            setupEventListeners();
            const micsPopulated = await populateAudioInputDevicesRec(); 
            
            await refreshMeetingsForRecorder(); 
            showRecorderView('list'); // Start on list view
            updateRecorderRecordingUI(); 

            // If mics were populated and a default is selected, start preview on list view if desired,
            // or wait until 'recording' view is shown (current behavior of showRecorderView).
            // For now, activateMicrophonePreview is called when switching to 'recording' view.
            if (micsPopulated && audioInputSelectElemRec.value) {
                 // activateMicrophonePreview(audioInputSelectElemRec.value); // Optionally start preview even on list view
                 console.log("Microphones populated. Preview will start when recording view is active.");
            }
        },
        getHTML,
        handleDeepLink 
    };
})();