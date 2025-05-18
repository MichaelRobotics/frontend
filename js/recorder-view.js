// /js/recorder-view.js
const RecorderView = (() => {
    let meetings = []; // Local cache, fetched from backend via SharedAppLogic
    
    // Callbacks from SharedAppLogic
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
    let mediaRecorder, audioChunks = [], audioStreamForVisualizer, currentStreamTracks = [];
    let audioContext, analyser, visualizerFrameId;

    // DOM Elements
    let meetingListViewRec, recordingViewRec, analysisViewRec;
    let newRecordingBtnRec, meetingListRec, noMeetingsMessageRec;
    let recordingMeetingTitleElemRec, meetingTitleInputElemRec, stopBtnElemRec, pauseResumeBtnElemRec, recordingIndicatorElemRec, recordingStatusTextElemRec, recordingTimeDisplayElemRec, recordingProgressElemRec, audioInputSelectElemRec, audioVisualizerCanvasElemRec, meetingNotesElemRec, audioQualitySelectElemRec;
    let analysisMeetingTitleElemRec, analysisDateDisplayElemRec, analysisProgressSectionElemRec, analysisStatusTextElemRec, analysisProgressPercentageElemRec, analysisProgressBarElemRec, analysisContentSectionElemRec, analysisTabsElemsRec, analysisPanelsElemsRec;
    let backToListBtnRec, logoutBtnRec, mainMenuBtnRec, downloadTranscriptBtnRec, downloadPdfBtnRec;

    function getHTML() {
        // HTML structure includes the "Download PDF Report" button in the analysis view
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
                        <button id="stop-btn-rec" class="btn-danger btn-hover flex items-center">
                            <span class="button-text"><i class="fas fa-stop mr-2 icon-hover"></i>Stop</span>
                            <span class="button-loader hidden"><i class="fas fa-spinner fa-spin mr-2"></i>Stopping...</span>
                        </button>
                        <button id="pause-resume-btn-rec" class="btn-warning btn-hover flex items-center">
                            <span class="button-text"><i class="fas fa-pause mr-2 icon-hover"></i>Pause</span>
                        </button>
                    </div>
                </div>
                <div class="mb-6 p-4 bg-blue-50/70 rounded-xl border border-blue-200/70">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center">
                            <div id="recording-indicator-rec" class="w-3.5 h-3.5 bg-red-500 rounded-full mr-2.5 status-recording"></div>
                            <span id="recording-status-text-rec" class="text-gray-700 font-medium">Recording...</span>
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
            </div>
        </main>
        <footer class="bg-gray-800 text-white py-6 text-center mt-auto">
            <p class="text-sm">&copy; <span id="current-year-recorder"></span> Meeting Analysis System (Recorder View). All rights reserved.</p>
        </footer>
        `;
    }

    function initDOMReferences() {
        const viewContainer = document.getElementById('recorder-view-container');
        if (!viewContainer) { console.error("Recorder view container not found."); return; }

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
    
    async function refreshMeetingsForRecorder() {
        try {
            if (noMeetingsMessageRec) noMeetingsMessageRec.textContent = "Fetching meetings...";
            const response = await fetchMeetingsAPI();
            
            // Handle both direct array response and wrapped response format
            if (Array.isArray(response)) {
                meetings = response;
            } else if (response && response.success && Array.isArray(response.data)) {
                meetings = response.data;
            } else {
                console.error('Invalid API Response:', { response });
                throw new Error('Invalid response from server');
            }
            
            renderRecorderMeetingList();
            if (noMeetingsMessageRec && meetings.filter(m => m.status === 'Scheduled' || m.recorderId).length === 0) {
                noMeetingsMessageRec.textContent = 'No meetings found or scheduled for recording.';
            } else if (noMeetingsMessageRec) {
                noMeetingsMessageRec.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error fetching meetings:', error);
            if (noMeetingsMessageRec) noMeetingsMessageRec.textContent = "Could not load meetings. Please try refreshing.";
        }
    }

    function setupEventListeners() {
        if (!newRecordingBtnRec) { console.error("Recorder DOM not fully initialized for event listeners."); return; }

        newRecordingBtnRec.addEventListener('click', handleStartAdHocRecording);
        if(stopBtnElemRec) stopBtnElemRec.addEventListener('click', () => stopActualRecording(false));
        if(pauseResumeBtnElemRec) pauseResumeBtnElemRec.addEventListener('click', handlePauseResumeRec);
        
        if (audioInputSelectElemRec) {
            audioInputSelectElemRec.addEventListener('change', handleAudioInputChange);
        }

        if(backToListBtnRec) { 
            backToListBtnRec.addEventListener('click', async () => { // Made async
                if(isRecording && !confirm("Recording is in progress. Are you sure you want to stop and go back to the list? The current recording will be processed.")) {
                    return;
                }
                if(isRecording) {
                    await stopActualRecording(false); // Wait for stop to complete
                }
                // After stop (or if not recording), refresh and show list
                await refreshMeetingsForRecorder(); 
                showRecorderView('list');
            });
        }
        if(mainMenuBtnRec) { 
            mainMenuBtnRec.addEventListener('click', async () => { // Made async
                 if(isRecording && !confirm("Recording is in progress. Stop and go to App Dashboard?")) return;
                 if(isRecording) await stopActualRecording(false);
                switchViewCallback('index'); 
            });
        }
        if(logoutBtnRec) { 
            logoutBtnRec.addEventListener('click', async () => { // Made async
                if(isRecording && !confirm("Recording is in progress. Stop and logout?")) return;
                if(isRecording) await stopActualRecording(false);
                await SharedAppLogic.logoutAPI(); // Call shared logout
                showNotificationCallback("Logged out. Redirecting...", "info");
                switchViewCallback('index'); // This should ideally be window.location.href = 'landing-page.html'
            });
        }

        if(analysisTabsElemsRec) { 
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
        }
        if (downloadTranscriptBtnRec) { 
            downloadTranscriptBtnRec.addEventListener('click', () => {
                if (currentRecorderMeeting && currentRecorderMeeting.analysisData && currentRecorderMeeting.analysisData.transcript) {
                    const blob = new Blob([currentRecorderMeeting.analysisData.transcript], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${(currentRecorderMeeting.title || 'meeting').replace(/\s+/g, '_')}_transcript.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showNotificationCallback("Transcript download started.", "success");
                } else {
                    showNotificationCallback("No transcript available to download.", "warning");
                }
            });
        }

        if (downloadPdfBtnRec) {
            downloadPdfBtnRec.addEventListener('click', async () => { 
                if (currentRecorderMeeting && currentRecorderMeeting.status === 'completed' && currentRecorderMeeting.recorderId) {
                    try {
                        setButtonLoadingStateCallback(downloadPdfBtnRec, true);
                        await downloadAnalysisPdfAPI(currentRecorderMeeting.recorderId); 
                    } catch (error) {
                        console.error("Recorder PDF Download trigger failed:", error);
                    } finally {
                        setButtonLoadingStateCallback(downloadPdfBtnRec, false);
                    }
                } else {
                    showNotificationCallback("No completed analysis available to generate PDF.", "warning");
                }
            });
        }
    }

    async function handleAudioInputChange() { 
        if (isRecording) {
            if (confirm("Changing the microphone will stop the current recording segment and start a new one. Continue?")) {
                showNotificationCallback("Stopping current segment to switch microphone...", "info");
                await stopActualRecording(false); 
                
                let attempts = 0;
                while(isRecording && attempts < 50) { 
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                if(isRecording) { 
                    showNotificationCallback("Failed to stop previous segment. Cannot switch microphone now.", "error");
                    return;
                }

                showNotificationCallback("Starting new segment with selected microphone...", "info");
                const previousTitle = currentRecorderMeeting ? currentRecorderMeeting.title : "Continued Recording";
                const previousNotes = currentRecorderMeeting ? currentRecorderMeeting.notes : "";
                const originalMeetingIdForNewSegment = currentRecorderMeeting ? currentRecorderMeeting.originalMeetingId : null;
                const clientEmailForNewSegment = currentRecorderMeeting ? currentRecorderMeeting.clientEmail : null;

                const newSegmentRecorderId = `rec-segment-${generateIdCallback(8)}`;
                currentRecorderMeeting = { 
                    id: newSegmentRecorderId, 
                    recorderId: newSegmentRecorderId,
                    title: `${previousTitle.replace(/ \(Segment .*\)/, '')} (Segment ${Math.floor(Math.random()*100)})`,
                    date: new Date().toISOString(), 
                    status: 'pending_start',
                    analysisAvailable: false,
                    clientEmail: clientEmailForNewSegment, 
                    notes: previousNotes,
                    originalMeetingId: originalMeetingIdForNewSegment, 
                    audioQuality: audioQualitySelectElemRec ? audioQualitySelectElemRec.value : 'medium',
                };
                if(meetingTitleInputElemRec) meetingTitleInputElemRec.value = currentRecorderMeeting.title;
                if(meetingNotesElemRec) meetingNotesElemRec.value = currentRecorderMeeting.notes;
                if(recordingMeetingTitleElemRec) recordingMeetingTitleElemRec.textContent = `Recording: ${currentRecorderMeeting.title}`;
                
                await startActualRecording(); 
            } else {
                showNotificationCallback("Microphone change cancelled. Previous device remains active if recording is restarted.", "info");
            }
        } else {
            showNotificationCallback(`Microphone selection changed to: ${audioInputSelectElemRec.options[audioInputSelectElemRec.selectedIndex].text}. This will be used for the next recording.`, "info");
        }
    }

    async function startActualRecording() {
        if (isRecording) { 
            showNotificationCallback("A recording is already in progress.", "warning");
            return; 
        }
        if (!currentRecorderMeeting || !currentRecorderMeeting.recorderId) { // Ensure recorderId is set
            showNotificationCallback("No meeting selected or recorder ID missing.", "error");
            return; 
        }

        try {
            const selectedDeviceId = audioInputSelectElemRec.value;
            const constraints = { 
                audio: { 
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined 
                } 
            };
            
            audioStreamForVisualizer = await navigator.mediaDevices.getUserMedia(constraints);
            currentStreamTracks = audioStreamForVisualizer.getAudioTracks();

            setupAudioVisualizerRec(audioStreamForVisualizer);
            
            const qualitySetting = audioQualitySelectElemRec ? audioQualitySelectElemRec.value : 'medium';
            let mediaRecorderOptions = { mimeType: 'audio/webm;codecs=opus' };
            
            if (qualitySetting === 'high') mediaRecorderOptions.audioBitsPerSecond = 128000;
            else if (qualitySetting === 'medium') mediaRecorderOptions.audioBitsPerSecond = 96000;
            else if (qualitySetting === 'low') mediaRecorderOptions.audioBitsPerSecond = 64000;
            
            try {
                mediaRecorder = new MediaRecorder(audioStreamForVisualizer, mediaRecorderOptions);
            } catch (e) {
                console.warn("Failed to create MediaRecorder with specified options, trying without:", e);
                mediaRecorderOptions = { mimeType: 'audio/webm;codecs=opus' };
                mediaRecorder = new MediaRecorder(audioStreamForVisualizer, mediaRecorderOptions);
            }
            
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = handleActualRecordingStop; 
            mediaRecorder.onerror = (event) => { 
                console.error("MediaRecorder error:", event.error); 
                showNotificationCallback(`Recording error: ${event.error.name} - ${event.error.message}`, "error"); 
                stopActualRecording(true); 
            };

            mediaRecorder.start();
            isRecording = true; isPaused = false; recordingStartTime = Date.now(); accumulatedPausedTime = 0;
            
            currentRecorderMeeting.status = 'recording';
            currentRecorderMeeting.startTimeActual = new Date().toISOString();
            if(audioQualitySelectElemRec) currentRecorderMeeting.audioQuality = audioQualitySelectElemRec.value;
            if(meetingTitleInputElemRec) currentRecorderMeeting.title = meetingTitleInputElemRec.value.trim() || currentRecorderMeeting.title || "Untitled Recording";
            if(meetingNotesElemRec) currentRecorderMeeting.notes = meetingNotesElemRec.value.trim();
            
            const existingMeeting = getMeetingByIdCallback(currentRecorderMeeting.recorderId);
            if (existingMeeting) {
                await updateMeetingCallback(currentRecorderMeeting); 
            } else {
                if (typeof addMeetingCallback === 'function') { 
                    await addMeetingCallback(currentRecorderMeeting);
                } else { 
                    await updateMeetingCallback(currentRecorderMeeting);
                }
            }
            await refreshMeetingsForRecorder(); 
            updateRecorderRecordingUI();
            if(timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateRecorderTimer, 1000);
            showNotificationCallback(`Recording started (Quality: ${qualitySetting}).`, "success");

        } catch (err) { 
            console.error("Error starting recording:", err);
            showNotificationCallback(`Error starting recording: ${err.message}. Check microphone permissions.`, "error");
            if (currentRecorderMeeting) { 
                currentRecorderMeeting.status = 'failed_to_start'; 
                try { await updateMeetingCallback(currentRecorderMeeting); } catch(e) { console.error("Failed to update meeting status on error:", e);}
                await refreshMeetingsForRecorder(); 
            }
            showRecorderView('list'); 
        }
    }
    
    async function handleActualRecordingStop() { 
        handleMediaRecorderCleanup();
        if (!currentRecorderMeeting || !currentRecorderMeeting.recorderId) {
            console.error("currentRecorderMeeting or its recorderId is null in onstop handler");
            if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false);
            showRecorderView('list');
            return;
        }
        
        const audioBlob = new Blob(audioChunks, {type: 'audio/webm;codecs=opus'}); 
        audioChunks = []; 

        currentRecorderMeeting.duration = formatDurationRec(Date.now() - recordingStartTime - accumulatedPausedTime);
        currentRecorderMeeting.status = 'uploading_to_backend'; 
        currentRecorderMeeting.size = audioBlob.size > 0 ? `${(audioBlob.size / (1024*1024)).toFixed(2)}MB` : '0MB';
        
        try {
            await updateMeetingCallback(currentRecorderMeeting); 
            await refreshMeetingsForRecorder(); 
            showNotificationCallback("Recording stopped. Uploading to server...", "info");

            const formData = new FormData();
            formData.append('audioFile', audioBlob, `${currentRecorderMeeting.recorderId}.webm`);
            formData.append('notes', currentRecorderMeeting.notes || '');
            formData.append('quality', currentRecorderMeeting.audioQuality || 'medium');
            formData.append('title', currentRecorderMeeting.title || 'Untitled Recording');
            if (currentRecorderMeeting.originalMeetingId) { 
                formData.append('originalMeetingId', currentRecorderMeeting.originalMeetingId);
            }
            
            const uploadResponse = await uploadRecordingAPI(currentRecorderMeeting.recorderId, formData);

            if (uploadResponse && uploadResponse.success) {
                currentRecorderMeeting.status = uploadResponse.status || 'processing'; // Use status from backend
                // If backend confirms/returns a canonical recordingId different from what was sent (e.g. for ad-hoc)
                currentRecorderMeeting.id = uploadResponse.recordingId || currentRecorderMeeting.id; 
                currentRecorderMeeting.recorderId = uploadResponse.recordingId || currentRecorderMeeting.recorderId;

                await updateMeetingCallback(currentRecorderMeeting);
                showNotificationCallback("Upload complete. Analysis started by backend.", "success");
                initiateRecorderAnalysis(currentRecorderMeeting); 
            } else {
                throw new Error(uploadResponse.message || "Upload to backend failed.");
            }
        } catch (error) {
            showNotificationCallback(`Error during upload/processing trigger: ${error.message}`, "error");
            currentRecorderMeeting.status = 'upload_failed';
            try { await updateMeetingCallback(currentRecorderMeeting); } catch(e) { console.error("Failed to update status after upload error", e); }
        } finally {
            if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false);
            await refreshMeetingsForRecorder();
        }
    }
    
    async function initiateRecorderAnalysis(meeting) { 
        if (!analysisMeetingTitleElemRec || !analysisViewRec || !meeting || !meeting.recorderId) {
            showRecorderView('list'); 
            return; 
        }
        currentRecorderMeeting = meeting; 
        showRecorderView('analysis');
        analysisMeetingTitleElemRec.textContent = `Analysis for: ${meeting.title}`;
        analysisDateDisplayElemRec.textContent = `Recorded: ${new Date(meeting.startTimeActual || meeting.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}`;
        
        analysisProgressSectionElemRec.classList.remove('hidden');
        analysisContentSectionElemRec.classList.add('hidden');
        analysisProgressBarElemRec.style.width = '0%';
        analysisProgressPercentageElemRec.textContent = '0%';
        analysisStatusTextElemRec.textContent = 'Checking analysis status...';

        if (pollingInterval) clearInterval(pollingInterval); 

        async function pollStatus() {
            try {
                const statusResult = await fetchAnalysisStatusAPI(meeting.recorderId); 
                if (!statusResult || !statusResult.success) { 
                    throw new Error(statusResult.message || "Failed to get status update.");
                }

                analysisStatusTextElemRec.textContent = statusResult.status_message || `Status: ${statusResult.status}`;
                const progressPercent = parseInt(statusResult.progress) || 0;
                analysisProgressBarElemRec.style.width = `${progressPercent}%`;
                analysisProgressPercentageElemRec.textContent = `${progressPercent}%`;

                if (statusResult.status === 'completed') {
                    clearInterval(pollingInterval);
                    analysisStatusTextElemRec.textContent = 'Analysis Complete! Fetching results...';
                    const analysisData = await fetchAnalysisDataAPI(meeting.recorderId); 
                    if (analysisData) {
                        meeting.analysisData = analysisData; 
                        meeting.status = 'completed';
                        await updateMeetingCallback(meeting); 
                        
                        if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.innerHTML = analysisData.summary || "<p>Summary not available.</p>";
                        if(analysisPanelsElemsRec.transcript) analysisPanelsElemsRec.transcript.innerHTML = analysisData.transcript || "<p>Transcript not available.</p>";
                        
                        if(analysisTabsElemsRec && analysisTabsElemsRec.length > 0) {
                            analysisTabsElemsRec.forEach(t => t.classList.remove('active'));
                            analysisTabsElemsRec[0].classList.add('active');
                        }
                        Object.values(analysisPanelsElemsRec).forEach(p => { if(p) p.classList.add('hidden'); });
                        if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.classList.remove('hidden');
                        
                        analysisProgressSectionElemRec.classList.add('hidden');
                        analysisContentSectionElemRec.classList.remove('hidden');
                    } else {
                        throw new Error("Analysis data not found after completion.");
                    }
                } else if (statusResult.status === 'failed') {
                    clearInterval(pollingInterval);
                    analysisStatusTextElemRec.textContent = `Analysis Failed: ${statusResult.error_message || 'Unknown error'}`;
                    analysisProgressBarElemRec.style.backgroundColor = 'var(--red-500)'; 
                    meeting.status = 'failed';
                    await updateMeetingCallback(meeting);
                }
            } catch (error) {
                console.error("Error polling analysis status:", error);
                analysisStatusTextElemRec.textContent = `Error updating status: ${error.message}`;
                clearInterval(pollingInterval); 
                meeting.status = 'status_check_error'; 
                try { await updateMeetingCallback(meeting); } catch(e) {console.error("Failed to update status on poll error", e);}
            }
        }
        pollStatus(); 
        pollingInterval = setInterval(pollStatus, 7000); 
    }
    
    async function handleViewRecorderAnalysis(recorderId) { 
        let meetingToAnalyze = getMeetingByIdCallback(recorderId); 

        if (!meetingToAnalyze) { 
            await refreshMeetingsForRecorder();
            meetingToAnalyze = getMeetingByIdCallback(recorderId);
        }

        if (!meetingToAnalyze) {
            showNotificationCallback("Meeting not found. Please refresh the list.", "error");
            return;
        }
        
        currentRecorderMeeting = meetingToAnalyze; 

        if (meetingToAnalyze.status === 'completed' && meetingToAnalyze.analysisData) {
            analysisMeetingTitleElemRec.textContent = `Analysis for: ${meetingToAnalyze.title}`;
            analysisDateDisplayElemRec.textContent = `Recorded: ${new Date(meetingToAnalyze.startTimeActual || meetingToAnalyze.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}`;
            analysisProgressSectionElemRec.classList.add('hidden');
            analysisContentSectionElemRec.classList.remove('hidden');
            
            if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.innerHTML = meetingToAnalyze.analysisData.summary || "<p>Summary not available.</p>";
            if(analysisPanelsElemsRec.transcript) analysisPanelsElemsRec.transcript.innerHTML = meetingToAnalyze.analysisData.transcript || "<p>Transcript not available.</p>";
            
            if(analysisTabsElemsRec && analysisTabsElemsRec.length > 0) {
                analysisTabsElemsRec.forEach(t => t.classList.remove('active'));
                analysisTabsElemsRec[0].classList.add('active');
            }
            Object.values(analysisPanelsElemsRec).forEach(p => {if(p) p.classList.add('hidden');});
            if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.classList.remove('hidden');
            
            showRecorderView('analysis');
        } else if (meetingToAnalyze.status === 'processing' || (meetingToAnalyze.status === 'completed' && !meetingToAnalyze.analysisData) ) {
            showNotificationCallback("Analysis is processing or data needs to be fetched. Please wait.", "info");
            initiateRecorderAnalysis(meetingToAnalyze); 
        } else {
            showNotificationCallback("Analysis not yet available or meeting status is not 'completed' or 'processing'.", "warning");
        }
    }
    
    function handleDownloadRecorderPdf(meeting) { 
        if (!meeting || !meeting.analysisData) {
            showNotificationCallback("Cannot generate PDF: Missing meeting or analysis data.", "error");
            return;
        }
        // This uses the client-side HTML generation for PDF as per previous implementation
        // If backend PDF generation is preferred for Recorder, this would call downloadAnalysisPdfAPI
        let reportHtml = `
            <html><head><title>Recording Analysis Report: ${meeting.title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; color: #333; }
                h1 { color: #1e3a8a; border-bottom: 2px solid #d0e9fd; padding-bottom: 5px;}
                h2 { color: #1e40af; margin-top: 30px; border-bottom: 1px solid #e0f2fe; padding-bottom: 3px;}
                .section { margin-bottom: 25px; padding: 15px; border: 1px solid #d0e9fd; border-radius: 8px; background-color: #f7faff; }
                .meta-info p { font-size: 0.9em; color: #555; margin-bottom: 3px;}
                strong { color: #1e40af; }
                pre { background-color: #f0f2f5; padding: 10px; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; font-family: monospace; }
            </style>
            </head><body><h1>Recording Analysis Report</h1>
            <div class="meta-info section">
                <p><strong>Title:</strong> ${meeting.title}</p>
                <p><strong>Recorded Date:</strong> ${new Date(meeting.startTimeActual || meeting.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
                <p><strong>Duration:</strong> ${meeting.duration || 'N/A'}</p>
                <p><strong>Audio Quality Setting:</strong> ${meeting.audioQuality || 'N/A'}</p>
                <p><strong>File Size:</strong> ${meeting.size || 'N/A'}</p>
            </div>
            ${meeting.analysisData.summary ? `<div class="section"><h2>Summary</h2>${meeting.analysisData.summary}</div>` : ''}
            ${meeting.analysisData.transcript ? `<div class="section"><h2>Transcript</h2><pre>${meeting.analysisData.transcript.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></div>` : ''}
            <script> /* setTimeout(() => { alert("Please use your browser\\'s \\'Print\\' function (Ctrl+P or Cmd+P) and select \\'Save as PDF\\'."); }, 500); */ <\/script>
            </body></html>`;
        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
            reportWindow.document.open(); reportWindow.document.write(reportHtml); reportWindow.document.close(); reportWindow.focus();
            showNotificationCallback("Report opened in new tab. Use browser's Print to PDF.", "info");
        } else {
            showNotificationCallback("Could not open new window. Please check your pop-up blocker.", "error");
        }
    }
    function updateRecorderRecordingUI() { 
        if (!recordingIndicatorElemRec || !recordingStatusTextElemRec || !pauseResumeBtnElemRec) return;
        recordingIndicatorElemRec.className = `w-3.5 h-3.5 rounded-full mr-2.5 ${isPaused ? 'bg-yellow-500 animate-none' : 'bg-red-500 status-recording'}`;
        recordingStatusTextElemRec.textContent = isPaused ? "Paused" : "Recording...";
        const pauseResumeText = pauseResumeBtnElemRec.querySelector('.button-text');
        if (pauseResumeText) { pauseResumeText.innerHTML = isPaused ? '<i class="fas fa-play mr-2 icon-hover"></i>Resume' : '<i class="fas fa-pause mr-2 icon-hover"></i>Pause';}
    }
    function updateRecorderTimer() { 
        if (!isRecording || isPaused || !recordingTimeDisplayElemRec) return;
        const elapsed = Date.now() - recordingStartTime - accumulatedPausedTime;
        recordingTimeDisplayElemRec.textContent = formatDurationRec(elapsed);
        if(recordingProgressElemRec) recordingProgressElemRec.style.width = `${Math.min(100, (elapsed / (3600000 * 2)) * 100)}%`;
    }
    function formatDurationRec(ms) { 
        const s = Math.floor((ms/1000) % 60); const m = Math.floor((ms/(1000*60)) % 60); const h = Math.floor((ms/(1000*60*60)) % 24);
        return [h,m,s].map(v => String(v).padStart(2,'0')).join(':');
    }
    function handlePauseResumeRec() { 
        if (!mediaRecorder) return;
        if(isPaused) { mediaRecorder.resume(); accumulatedPausedTime += Date.now() - pauseStartTime; isPaused = false; if(timerInterval) clearInterval(timerInterval); timerInterval = setInterval(updateRecorderTimer, 1000); if(audioStreamForVisualizer) setupAudioVisualizerRec(audioStreamForVisualizer); showNotificationCallback("Recording Resumed.", "info");
        } else { mediaRecorder.pause(); isPaused = true; pauseStartTime = Date.now(); clearInterval(timerInterval); stopAudioVisualizerRec(); showNotificationCallback("Recording Paused.", "info");}
        updateRecorderRecordingUI();
    }
    function stopActualRecording(errorOccurred = false) { 
        if (!isRecording && !errorOccurred) return; 
        if (isRecording && stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, true);
        if (mediaRecorder && mediaRecorder.state !== "inactive") { mediaRecorder.stop(); } 
        else { if (errorOccurred) { showNotificationCallback("Recording stopped due to an error.", "error");} handleMediaRecorderCleanup(); if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false); if (!errorOccurred) { showRecorderView('list'); }}
        isRecording = false; 
    }
    function handleMediaRecorderCleanup() { 
        clearInterval(timerInterval); stopAudioVisualizerRec();
        if (currentStreamTracks.length > 0) { 
            currentStreamTracks.forEach(track => track.stop()); 
            currentStreamTracks = []; 
        }
        if (audioStreamForVisualizer) { 
             audioStreamForVisualizer.getTracks().forEach(track => track.stop());
             audioStreamForVisualizer = null;
        }
        mediaRecorder = null; 
    }
    function setupAudioVisualizerRec(stream) { 
        if (!audioVisualizerCanvasElemRec) return;
        try {
            if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') { audioContext.resume(); }
            if (analyser) analyser.disconnect(); 
            analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256; 
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const canvasCtx = audioVisualizerCanvasElemRec.getContext('2d');
            audioVisualizerCanvasElemRec.width = audioVisualizerCanvasElemRec.offsetWidth;
            audioVisualizerCanvasElemRec.height = audioVisualizerCanvasElemRec.offsetHeight;
            function draw() {
                if (!isRecording || isPaused) { stopAudioVisualizerRec(); return; }
                visualizerFrameId = requestAnimationFrame(draw);
                analyser.getByteFrequencyData(dataArray);
                canvasCtx.fillStyle = '#e0f2fe'; 
                canvasCtx.fillRect(0, 0, audioVisualizerCanvasElemRec.width, audioVisualizerCanvasElemRec.height);
                const barWidth = (audioVisualizerCanvasElemRec.width / bufferLength) * 2.0; 
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i] / 2.8; 
                    canvasCtx.fillStyle = `rgba(37, 99, 235, ${Math.max(0.2, barHeight / 100)})`; 
                    canvasCtx.fillRect(x, audioVisualizerCanvasElemRec.height - barHeight, barWidth, barHeight);
                    x += barWidth + 1; 
                }
            }
            draw();
        } catch (e) { console.error("Error setting up audio visualizer:", e); showNotificationCallback("Could not start audio visualizer.", "warning");}
    }
    function stopAudioVisualizerRec() { 
        if (visualizerFrameId) cancelAnimationFrame(visualizerFrameId); visualizerFrameId = null;
        if(audioVisualizerCanvasElemRec && audioVisualizerCanvasElemRec.getContext) {
            const canvasCtx = audioVisualizerCanvasElemRec.getContext('2d');
            canvasCtx.fillStyle = '#e0f2fe'; 
            canvasCtx.fillRect(0, 0, audioVisualizerCanvasElemRec.width, audioVisualizerCanvasElemRec.height);
        }
    }
    function handleDeepLink(urlRecorderId, urlRecorderCode) { 
        // This function assumes 'meetings' (the shared cache) is populated by refreshMeetingsForRecorder
        const meeting = meetings.find(m => m.recorderId === urlRecorderId); // Find by recorderId
        if (meeting && meeting.recorderAccessCode === urlRecorderCode) { 
            showNotificationCallback(`Accessing scheduled recording via link: ${meeting.title}`, "info");
            // handleStartScheduledRecording expects the original salesperson meeting ID
            handleStartScheduledRecording(meeting.id); 
        } else if (meeting) {
            showNotificationCallback(`Invalid recorder code for meeting: ${meeting.title}`, "warning");
            refreshMeetingsForRecorder(); showRecorderView('list');
        } else {
            showNotificationCallback(`Meeting with Recorder ID ${urlRecorderId} not found. Refreshing list...`, "info");
            refreshMeetingsForRecorder().then(() => { // Try refreshing then check again
                const refreshedMeeting = meetings.find(m => m.recorderId === urlRecorderId);
                if (refreshedMeeting && refreshedMeeting.recorderAccessCode === urlRecorderCode) {
                     showNotificationCallback(`Accessing scheduled recording via link: ${refreshedMeeting.title}`, "info");
                     handleStartScheduledRecording(refreshedMeeting.id);
                } else {
                    showNotificationCallback(`Meeting with Recorder ID ${urlRecorderId} still not found or code invalid after refresh.`, "error");
                    showRecorderView('list');
                }
            });
        }
    }

    function renderRecorderMeetingList() {
        if (!meetingListRec || !noMeetingsMessageRec) return;
        meetingListRec.innerHTML = '';
        
        if (!Array.isArray(meetings) || meetings.length === 0) { 
            if (noMeetingsMessageRec) {
                noMeetingsMessageRec.textContent = 'No meetings found or scheduled for recording.';
                noMeetingsMessageRec.classList.remove('hidden'); 
            }
            return; 
        }
        if (noMeetingsMessageRec) noMeetingsMessageRec.classList.add('hidden');
        
        // Filter meetings to show only those that are scheduled or have a recorderId
        const filteredMeetings = meetings.filter(m => m.status === 'Scheduled' || m.recorderId);
        const sortedMeetings = [...filteredMeetings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
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
                    <h3 class="text-lg font-semibold text-blue-700 mb-1">${escapeHtml(meeting.title)}</h3>
                    <p class="text-sm text-gray-600">With: ${escapeHtml(meeting.clientEmail)}</p>
                    <p class="text-sm text-gray-500">Date: ${new Date(meeting.date).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div class="flex items-center mt-2 sm:mt-0">
                    <span class="status-indicator ${statusClass} mr-2"></span>
                    <span class="text-sm font-medium text-gray-700">${escapeHtml(meeting.status)}</span>
                </div>`;
            
            item.addEventListener('click', () => {
                if (meeting.status === 'Scheduled') {
                    handleStartScheduledRecording(meeting.id);
                } else if (meeting.status === 'Completed' && meeting.analysisData) {
                    handleViewRecorderAnalysis(meeting.recorderId);
                }
            });
            
            meetingListRec.appendChild(item);
        });
    }

    async function handleStartScheduledRecording(meetingId) {
        try {
            const meeting = getMeetingByIdCallback(meetingId);
            if (!meeting) {
                showNotificationCallback("Meeting not found.", "error");
                return;
            }

            if (meeting.status !== 'Scheduled') {
                showNotificationCallback("This meeting is not in a scheduled state.", "error");
                return;
            }

            const newRecordingId = `rec-${generateIdCallback(8)}`;
            currentRecorderMeeting = {
                id: meetingId,
                recorderId: newRecordingId,
                title: meeting.title,
                date: meeting.date,
                clientEmail: meeting.clientEmail,
                notes: meeting.notes,
                audioQuality: audioQualitySelectElemRec ? audioQualitySelectElemRec.value : 'medium'
            };

            if (meetingTitleInputElemRec) meetingTitleInputElemRec.value = currentRecorderMeeting.title;
            if (meetingNotesElemRec) meetingNotesElemRec.value = currentRecorderMeeting.notes;
            if (recordingMeetingTitleElemRec) recordingMeetingTitleElemRec.textContent = `Recording: ${currentRecorderMeeting.title}`;

            showRecorderView('recording');
            await startActualRecording();
        } catch (error) {
            console.error("Error starting scheduled recording:", error);
            showNotificationCallback(`Error starting recording: ${error.message}`, "error");
        }
    }

    async function handleStartAdHocRecording() {
        try {
            const newRecordingId = `rec-${generateIdCallback(8)}`;
            currentRecorderMeeting = {
                id: newRecordingId,
                recorderId: newRecordingId,
                title: "New Ad-hoc Recording",
                date: new Date().toISOString(),
                status: 'pending_start',
                audioQuality: audioQualitySelectElemRec ? audioQualitySelectElemRec.value : 'medium'
            };

            if (meetingTitleInputElemRec) meetingTitleInputElemRec.value = currentRecorderMeeting.title;
            if (meetingNotesElemRec) meetingNotesElemRec.value = '';
            if (recordingMeetingTitleElemRec) recordingMeetingTitleElemRec.textContent = `Recording: ${currentRecorderMeeting.title}`;

            showRecorderView('recording');
            await startActualRecording();
        } catch (error) {
            console.error("Error starting ad-hoc recording:", error);
            showNotificationCallback(`Error starting recording: ${error.message}`, "error");
        }
    }

    function showRecorderView(view) {
        if (!meetingListViewRec || !recordingViewRec || !analysisViewRec) return;
        
        // Hide all views first
        meetingListViewRec.classList.add('hidden');
        recordingViewRec.classList.add('hidden');
        analysisViewRec.classList.add('hidden');
        
        // Show the requested view
        switch (view) {
            case 'list':
                meetingListViewRec.classList.remove('hidden');
                if (backToListBtnRec) backToListBtnRec.classList.add('hidden');
                break;
            case 'recording':
                recordingViewRec.classList.remove('hidden');
                if (backToListBtnRec) backToListBtnRec.classList.remove('hidden');
                break;
            case 'analysis':
                analysisViewRec.classList.remove('hidden');
                if (backToListBtnRec) backToListBtnRec.classList.remove('hidden');
                break;
            default:
                console.error("Invalid view requested:", view);
                return;
        }
    }

    function init(
        showNotification,
        switchView,
        setButtonLoadingState,
        getMeetingById,
        updateMeeting,
        addMeeting,
        fetchMeetings,
        uploadRecording,
        fetchAnalysisStatus,
        fetchAnalysisData,
        downloadAnalysisPdf,
        generateId
    ) {
        // Store callbacks
        showNotificationCallback = showNotification;
        switchViewCallback = switchView;
        setButtonLoadingStateCallback = setButtonLoadingState;
        getMeetingByIdCallback = getMeetingById;
        updateMeetingCallback = updateMeeting;
        addMeetingCallback = addMeeting;
        fetchMeetingsAPI = fetchMeetings;
        uploadRecordingAPI = uploadRecording;
        fetchAnalysisStatusAPI = fetchAnalysisStatus;
        fetchAnalysisDataAPI = fetchAnalysisData;
        downloadAnalysisPdfAPI = downloadAnalysisPdf;
        generateIdCallback = generateId;

        // Initialize DOM references
        initDOMReferences();

        // Setup event listeners
        setupEventListeners();

        // Load available audio inputs
        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                const audioInputs = devices.filter(device => device.kind === 'audioinput');
                if (audioInputSelectElemRec) {
                    audioInputSelectElemRec.innerHTML = audioInputs.map(input => 
                        `<option value="${input.deviceId}">${input.label || `Microphone ${audioInputSelectElemRec.length + 1}`}</option>`
                    ).join('');
                }
            })
            .catch(err => {
                console.error('Error getting audio devices:', err);
                showNotificationCallback('Could not access microphone devices. Please check permissions.', 'error');
            });

        // Initial refresh of meetings
        refreshMeetingsForRecorder();
    }

    return {
        init,
        getHTML,
        handleDeepLink 
    };
})();
