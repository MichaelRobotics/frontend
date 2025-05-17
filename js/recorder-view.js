// /js/recorder-view.js
const RecorderView = (() => {
    let meetings = []; // Local cache, fetched from backend via SharedAppLogic
    let showNotificationCallback;
    let switchViewCallback;
    let setButtonLoadingStateCallback;
    let getMeetingByIdCallback; // From SharedAppLogic (searches local cache)
    let updateMeetingCallback;  // From SharedAppLogic (calls API)
    let addMeetingCallback;     // From SharedAppLogic (calls API, for new ad-hoc if needed)
    let fetchMeetingsAPI;       // From SharedAppLogic
    let uploadRecordingAPI;
    let fetchAnalysisStatusAPI;
    let fetchAnalysisDataAPI;
    let downloadAnalysisPdfAPI;
    let generateIdCallback; // From SharedAppLogic

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
        // HTML structure remains the same as in recorder_view_js_updated_pdf (with PDF button already added)
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
            meetings = await fetchMeetingsAPI(); // Use the API callback
            renderRecorderMeetingList();
             if (noMeetingsMessageRec && meetings.filter(m => m.status === 'Scheduled' || m.recorderId).length === 0) { // Adjust filter for recorder
                noMeetingsMessageRec.textContent = 'No meetings found or scheduled for recording.';
            }
        } catch (error) {
            showNotificationCallback("Could not load meetings for recorder. Please try again later.", "error");
            if (noMeetingsMessageRec) noMeetingsMessageRec.textContent = "Could not load meetings.";
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
            backToListBtnRec.addEventListener('click', () => {
                if(isRecording && !confirm("Recording is in progress. Are you sure you want to stop and go back to the list? The current recording will be processed.")) {
                    return;
                }
                if(isRecording) {
                    stopActualRecording(false); 
                } else {
                    refreshMeetingsForRecorder(); // Refresh list before showing
                    showRecorderView('list');
                }
            });
        }
        if(mainMenuBtnRec) { 
            mainMenuBtnRec.addEventListener('click', () => {
                 if(isRecording && !confirm("Recording is in progress. Stop and go to App Dashboard?")) return;
                 if(isRecording) stopActualRecording(false);
                switchViewCallback('index'); 
            });
        }
        if(logoutBtnRec) { 
            logoutBtnRec.addEventListener('click', () => {
                if(isRecording && !confirm("Recording is in progress. Stop and logout?")) return;
                if(isRecording) stopActualRecording(false);
                showNotificationCallback("Exited Recorder Role.", "info");
                switchViewCallback('index'); 
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
            downloadPdfBtnRec.addEventListener('click', async () => { // Made async
                if (currentRecorderMeeting && currentRecorderMeeting.status === 'completed' && currentRecorderMeeting.recorderId) {
                    try {
                        setButtonLoadingStateCallback(downloadPdfBtnRec, true);
                        await downloadAnalysisPdfAPI(currentRecorderMeeting.recorderId);
                        // Success/error notification handled by downloadAnalysisPdfAPI in SharedAppLogic
                    } catch (error) {
                        // Error notification already shown by SharedAppLogic
                        console.error("PDF download failed in RecorderView:", error);
                    } finally {
                        setButtonLoadingStateCallback(downloadPdfBtnRec, false);
                    }
                } else {
                    showNotificationCallback("No completed analysis available to generate PDF.", "warning");
                }
            });
        }
    }

    async function handleAudioInputChange() { // Made async
        if (isRecording) {
            if (confirm("Changing the microphone will stop the current recording segment and start a new one. Continue?")) {
                showNotificationCallback("Stopping current segment to switch microphone...", "info");
                await stopActualRecording(false); // Ensure this completes if it has async parts (it calls onstop which is async)
                
                // Wait for isRecording to be false, indicating stop is complete
                // This is a simple polling mechanism, might need refinement for robustness
                let attempts = 0;
                while(isRecording && attempts < 50) { // Max 5 seconds wait
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                if(isRecording) { // If still recording, something went wrong with stop
                    showNotificationCallback("Failed to stop previous segment. Cannot switch microphone now.", "error");
                    return;
                }

                showNotificationCallback("Starting new segment with selected microphone...", "info");
                const previousTitle = currentRecorderMeeting ? currentRecorderMeeting.title : "Continued Recording";
                const previousNotes = currentRecorderMeeting ? currentRecorderMeeting.notes : "";
                const originalMeetingIdForNewSegment = currentRecorderMeeting ? currentRecorderMeeting.originalMeetingId : null;
                const clientEmailForNewSegment = currentRecorderMeeting ? currentRecorderMeeting.clientEmail : null;


                // Prepare a new meeting object for the new segment, using a NEW recorderId for this segment
                const newSegmentRecorderId = `rec-segment-${generateIdCallback(8)}`;
                currentRecorderMeeting = { 
                    id: newSegmentRecorderId, // This ID will be used for the new recording segment
                    recorderId: newSegmentRecorderId,
                    title: `${previousTitle.replace(/ \(Segment .*\)/, '')} (Segment ${Math.floor(Math.random()*100)})`, // Avoid nested segment titles
                    date: new Date().toISOString(), // New date for this segment
                    status: 'pending_start',
                    analysisAvailable: false,
                    clientEmail: clientEmailForNewSegment, 
                    notes: previousNotes,
                    originalMeetingId: originalMeetingIdForNewSegment, // Link back to original if it was a scheduled meeting
                    audioQuality: audioQualitySelectElemRec ? audioQualitySelectElemRec.value : 'medium',
                };
                if(meetingTitleInputElemRec) meetingTitleInputElemRec.value = currentRecorderMeeting.title;
                if(meetingNotesElemRec) meetingNotesElemRec.value = currentRecorderMeeting.notes;
                if(recordingMeetingTitleElemRec) recordingMeetingTitleElemRec.textContent = `Recording: ${currentRecorderMeeting.title}`;
                
                // It's crucial that this new ad-hoc-like segment is also known to the backend
                // or that the upload uses this new ID which the backend then creates a record for.
                // For simplicity, we assume startActualRecording will handle creating/updating the record via API.
                await startActualRecording(); 
            } else {
                // User cancelled, try to revert selection (difficult with standard select, user must re-select)
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
        if (!currentRecorderMeeting) { 
            showNotificationCallback("No meeting selected or prepared for recording.", "error");
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
            
            // If it's a new ad-hoc segment (ID might not be in shared meetingsData yet),
            // ensure it's added or updated.
            const existingMeeting = getMeetingByIdCallback(currentRecorderMeeting.recorderId);
            if (existingMeeting) {
                await updateMeetingCallback(currentRecorderMeeting); 
            } else {
                // If addMeetingCallback is available and distinct from update for new records
                if (typeof addMeetingCallback === 'function') {
                    await addMeetingCallback(currentRecorderMeeting);
                } else { // Fallback to update which might handle upsert
                    await updateMeetingCallback(currentRecorderMeeting);
                }
            }
            // No need to call saveMeetingsCallback() directly, update/add handles persistence via API.
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
    
    async function handleActualRecordingStop() { // Made async
        handleMediaRecorderCleanup();
        if (!currentRecorderMeeting) {
            console.error("currentRecorderMeeting is null in onstop handler");
            if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false);
            showRecorderView('list');
            return;
        }
        
        const audioBlob = new Blob(audioChunks, {type: 'audio/webm;codecs=opus'}); 
        audioChunks = []; 

        currentRecorderMeeting.duration = formatDurationRec(Date.now() - recordingStartTime - accumulatedPausedTime);
        currentRecorderMeeting.status = 'uploading_to_backend'; // New status
        currentRecorderMeeting.size = audioBlob.size > 0 ? `${(audioBlob.size / (1024*1024)).toFixed(2)}MB` : '0MB';
        // currentRecorderMeeting.audioBlob = audioBlob; // Don't store large blob in state if uploading

        try {
            await updateMeetingCallback(currentRecorderMeeting); // Update status before upload
            await refreshMeetingsForRecorder(); 
            showNotificationCallback("Recording stopped. Uploading to server...", "info");

            const formData = new FormData();
            formData.append('audioFile', audioBlob, `${currentRecorderMeeting.recorderId || 'recording'}.webm`);
            formData.append('notes', currentRecorderMeeting.notes || '');
            formData.append('quality', currentRecorderMeeting.audioQuality || 'medium');
            formData.append('title', currentRecorderMeeting.title || 'Untitled Recording');
            if (currentRecorderMeeting.originalMeetingId) {
                formData.append('originalMeetingId', currentRecorderMeeting.originalMeetingId);
            }
            
            // Use the recordingId (which is currentRecorderMeeting.id or currentRecorderMeeting.recorderId)
            const uploadResponse = await uploadRecordingAPI(currentRecorderMeeting.recorderId, formData);

            if (uploadResponse && uploadResponse.success) {
                currentRecorderMeeting.status = 'processing'; // From backend response
                currentRecorderMeeting.backendRecordingId = uploadResponse.recordingId; // If backend returns a canonical ID
                await updateMeetingCallback(currentRecorderMeeting);
                showNotificationCallback("Upload complete. Analysis started by backend.", "success");
                initiateRecorderAnalysis(currentRecorderMeeting); // This will now poll
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
    
    async function initiateRecorderAnalysis(meeting) { // Made async for polling
        if (!analysisMeetingTitleElemRec || !analysisViewRec) {
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

        if (pollingInterval) clearInterval(pollingInterval); // Clear any existing polling

        async function pollStatus() {
            try {
                const statusResult = await fetchAnalysisStatusAPI(meeting.recorderId); // Use recorderId
                if (!statusResult || !statusResult.success) { // Check for success flag from API
                    throw new Error(statusResult.message || "Failed to get status update.");
                }

                analysisStatusTextElemRec.textContent = statusResult.status_message || `Status: ${statusResult.status}`;
                const progressPercent = parseInt(statusResult.progress) || 0;
                analysisProgressBarElemRec.style.width = `${progressPercent}%`;
                analysisProgressPercentageElemRec.textContent = `${progressPercent}%`;

                if (statusResult.status === 'completed') {
                    clearInterval(pollingInterval);
                    analysisStatusTextElemRec.textContent = 'Analysis Complete! Fetching results...';
                    const analysisData = await fetchAnalysisDataAPI(meeting.recorderId); // Use recorderId
                    if (analysisData) {
                        meeting.analysisData = analysisData;
                        meeting.status = 'completed';
                        await updateMeetingCallback(meeting); // Update meeting with fetched analysis
                        // saveMeetingsCallback(); // Not needed if updateMeetingCallback persists
                        
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
                    analysisProgressBarElemRec.style.backgroundColor = 'var(--red-500)'; // Error color
                    meeting.status = 'failed';
                    await updateMeetingCallback(meeting);
                }
                // Continue polling if still processing and not failed
            } catch (error) {
                console.error("Error polling analysis status:", error);
                analysisStatusTextElemRec.textContent = `Error updating status: ${error.message}`;
                clearInterval(pollingInterval); // Stop polling on error
                meeting.status = 'status_check_error'; // Indicate an issue
                try { await updateMeetingCallback(meeting); } catch(e) {console.error("Failed to update status on poll error", e);}
            }
        }
        pollStatus(); // Initial call
        pollingInterval = setInterval(pollStatus, 7000); // Poll every 7 seconds
    }
    
    async function handleViewRecorderAnalysis(recorderId) { 
        let meetingToAnalyze = getMeetingByIdCallback(recorderId); // Check local cache first

        if (!meetingToAnalyze) { // If not in cache, try fetching all meetings again
            await refreshMeetingsForRecorder();
            meetingToAnalyze = getMeetingByIdCallback(recorderId);
        }

        if (!meetingToAnalyze) {
            showNotificationCallback("Meeting not found. Please refresh the list.", "error");
            return;
        }
        
        currentRecorderMeeting = meetingToAnalyze; // Set for PDF download context

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
            // If processing, or completed but data somehow missing, initiate/re-initiate polling
            showNotificationCallback("Analysis is processing or data needs to be fetched. Please wait.", "info");
            initiateRecorderAnalysis(meetingToAnalyze); // This will show progress and fetch if needed
        } else {
            showNotificationCallback("Analysis not yet available or meeting status is not completed.", "warning");
        }
    }
    function handleDeepLink(urlRecorderId, urlRecorderCode) { 
        // Assuming SharedAppLogic.fetchMeetings() has been called and meetings are populated
        const meeting = meetings.find(m => m.recorderId === urlRecorderId);
        if (meeting && meeting.recorderAccessCode === urlRecorderCode) { 
            showNotificationCallback(`Accessing scheduled recording via link: ${meeting.title}`, "info");
            // This should set currentRecorderMeeting and start the recording flow
            handleStartScheduledRecording(meeting.id); // Use original sales meeting ID to start
        } else if (meeting) {
            showNotificationCallback(`Invalid recorder code for meeting: ${meeting.title}`, "warning");
            renderRecorderMeetingList(); showRecorderView('list');
        } else {
            showNotificationCallback(`Meeting with Recorder ID ${urlRecorderId} not found.`, "error");
            renderRecorderMeetingList(); showRecorderView('list');
        }
    }

    return {
        init: (
            // meetingsArr, // No longer pass initial meetings, fetch them
            notifyCb, switchCb, 
            _setLoadStateCb, 
            _getMeetingByIdCb, _updateMeetingCb, _addMeetingCb,
            _fetchMeetingsAPI, _uploadRecordingAPI, 
            _fetchAnalysisStatusAPI, _fetchAnalysisDataAPI, _downloadAnalysisPdfAPI,
            _generateIdCb
        ) => {
            // Store all API callbacks
            showNotificationCallback = notifyCb;
            switchViewCallback = switchCb;
            setButtonLoadingStateCallback = _setLoadStateCb;
            getMeetingByIdCallback = _getMeetingByIdCb;
            updateMeetingCallback = _updateMeetingCb;
            addMeetingCallback = _addMeetingCb; // For ad-hoc potentially
            fetchMeetingsAPI = _fetchMeetingsAPI;
            uploadRecordingAPI = _uploadRecordingAPI;
            fetchAnalysisStatusAPI = _fetchAnalysisStatusAPI;
            fetchAnalysisDataAPI = _fetchAnalysisDataAPI;
            downloadAnalysisPdfAPI = _downloadAnalysisPdfAPI;
            generateIdCallback = _generateIdCb;
            
            initDOMReferences(); 
            setupEventListeners();
            populateAudioInputDevicesRec();
            
            refreshMeetingsForRecorder(); // Initial fetch and render
            showRecorderView('list');
        },
        getHTML,
        handleDeepLink
    };
})();