// /js/recorder-view.js
const RecorderView = (() => {
    let meetings = []; // This will be the meetingsData from SharedAppLogic
    let showNotificationCallback;
    let switchViewCallback; // For window.location.href
    let saveMeetingsCallback; // To call SharedAppLogic.saveMeetings
    let setButtonLoadingStateCallback;
    let getMeetingByIdCallback;
    let updateMeetingCallback;


    let currentRecorderMeeting = null; // The meeting object being recorded/analyzed
    let isRecording = false, isPaused = false, recordingStartTime, accumulatedPausedTime = 0, pauseStartTime, timerInterval;
    let mediaRecorder, audioChunks = [], audioStreamForVisualizer;
    let audioContext, analyser, visualizerFrameId;

    // DOM Elements (will be queried after HTML injection)
    let meetingListViewRec, recordingViewRec, analysisViewRec;
    let newRecordingBtnRec, meetingListRec, noMeetingsMessageRec;
    let recordingMeetingTitleElemRec, meetingTitleInputElemRec, stopBtnElemRec, pauseResumeBtnElemRec, recordingIndicatorElemRec, recordingStatusTextElemRec, recordingTimeDisplayElemRec, recordingProgressElemRec, audioInputSelectElemRec, audioVisualizerCanvasElemRec, meetingNotesElemRec, audioQualitySelectElemRec;
    let analysisMeetingTitleElemRec, analysisDateDisplayElemRec, analysisProgressSectionElemRec, analysisStatusTextElemRec, analysisProgressPercentageElemRec, analysisProgressBarElemRec, analysisContentSectionElemRec, analysisTabsElemsRec, analysisPanelsElemsRec;
    let backToListBtnRec, logoutBtnRec, mainMenuBtnRec, downloadTranscriptBtnRec, downloadPdfBtnRec; // Added downloadPdfBtnRec


    function getHTML() {
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
                    <p id="no-meetings-message-rec" class="text-center text-gray-500 py-8 text-lg italic hidden">No meetings found or scheduled for recording.</p>
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
                            <div><label for="audio-quality-rec" class="block text-gray-700 mb-1.5 text-sm font-medium">Quality (Informational)</label><select id="audio-quality-rec" class="w-full custom-input"><option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option></select></div>
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
        downloadPdfBtnRec = viewContainer.querySelector('#download-pdf-btn-rec'); // Cache new button

        const currentYearSpan = viewContainer.querySelector('#current-year-recorder');
        if(currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
    }
    
    function setupEventListeners() {
        if (!newRecordingBtnRec) { console.error("Recorder DOM not fully initialized for event listeners."); return; }

        newRecordingBtnRec.addEventListener('click', handleStartAdHocRecording);
        if(stopBtnElemRec) stopBtnElemRec.addEventListener('click', () => stopActualRecording(false));
        if(pauseResumeBtnElemRec) pauseResumeBtnElemRec.addEventListener('click', handlePauseResumeRec);
        
        if(backToListBtnRec) { 
            backToListBtnRec.addEventListener('click', () => {
                if(isRecording && !confirm("Recording is in progress. Are you sure you want to stop and go back to the list? The current recording will be processed.")) {
                    return;
                }
                if(isRecording) {
                    stopActualRecording(false); 
                } else {
                    renderRecorderMeetingList(); 
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

        // Add event listener for the new PDF button
        if (downloadPdfBtnRec) {
            downloadPdfBtnRec.addEventListener('click', () => {
                if (currentRecorderMeeting && currentRecorderMeeting.status === 'completed' && currentRecorderMeeting.analysisData) {
                    handleDownloadRecorderPdf(currentRecorderMeeting);
                } else {
                    showNotificationCallback("No completed analysis available to generate PDF.", "warning");
                }
            });
        }
    }

    // Add this new function
    function handleDownloadRecorderPdf(meeting) {
        if (!meeting || !meeting.analysisData) {
            showNotificationCallback("Cannot generate PDF: Missing meeting or analysis data.", "error");
            return;
        }

        let reportHtml = `
            <html>
            <head>
                <title>Recording Analysis Report: ${meeting.title}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; color: #333; }
                    h1 { color: #1e3a8a; border-bottom: 2px solid #d0e9fd; padding-bottom: 5px;}
                    h2 { color: #1e40af; margin-top: 30px; border-bottom: 1px solid #e0f2fe; padding-bottom: 3px;}
                    .section { margin-bottom: 25px; padding: 15px; border: 1px solid #d0e9fd; border-radius: 8px; background-color: #f7faff; }
                    .meta-info p { font-size: 0.9em; color: #555; margin-bottom: 3px;}
                    strong { color: #1e40af; }
                    pre { background-color: #f0f2f5; padding: 10px; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; font-family: monospace; }
                </style>
            </head>
            <body>
                <h1>Recording Analysis Report</h1>
                <div class="meta-info section">
                    <p><strong>Title:</strong> ${meeting.title}</p>
                    <p><strong>Recorded Date:</strong> ${new Date(meeting.startTimeActual || meeting.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
                    <p><strong>Duration:</strong> ${meeting.duration || 'N/A'}</p>
                    <p><strong>Audio Quality Setting:</strong> ${meeting.audioQuality || 'N/A'}</p>
                    <p><strong>File Size:</strong> ${meeting.size || 'N/A'}</p>
                </div>

                ${meeting.analysisData.summary ? `<div class="section"><h2>Summary</h2>${meeting.analysisData.summary}</div>` : ''}
                ${meeting.analysisData.transcript ? `<div class="section"><h2>Transcript</h2><pre>${meeting.analysisData.transcript.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></div>` : ''}
                
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
    
    // --- All other functions from your original js/recorder-view.js (Part 6) should be here ---
    function showRecorderView(viewName) {
        if (!meetingListViewRec || !recordingViewRec || !analysisViewRec || !backToListBtnRec) { return; }
        meetingListViewRec.classList.add('hidden');
        recordingViewRec.classList.add('hidden');
        analysisViewRec.classList.add('hidden');
        backToListBtnRec.classList.add('hidden');
        if (viewName === 'list') meetingListViewRec.classList.remove('hidden');
        else { 
            recordingViewRec.classList.toggle('hidden', viewName !== 'recording'); 
            analysisViewRec.classList.toggle('hidden', viewName !== 'analysis'); 
            if (viewName === 'recording' || viewName === 'analysis') {
                backToListBtnRec.classList.remove('hidden');
            }
        }
    }
    function renderRecorderMeetingList() { 
        if (!meetingListRec || !noMeetingsMessageRec) return;
        meetingListRec.innerHTML = '';
        const availableMeetings = meetings.filter(m => m.status === 'Scheduled' || (m.recorderId && ['Processing', 'Completed', 'recording'].includes(m.status)));
        if (availableMeetings.length === 0) { noMeetingsMessageRec.classList.remove('hidden'); return; }
        noMeetingsMessageRec.classList.add('hidden');
        availableMeetings.sort((a,b) => new Date(b.date) - new Date(a.date));
        availableMeetings.forEach((meeting, index) => {
            const item = document.createElement('div');
            item.className = 'meeting-item-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 fade-in';
            item.style.setProperty('--delay', `${index * 0.05}s`);
            let statusClass = 'status-cancelled'; 
            if (meeting.status === 'Scheduled') statusClass = 'status-scheduled';
            else if (meeting.status === 'Completed') statusClass = 'status-completed';
            else if (meeting.status === 'Processing') statusClass = 'status-processing';
            else if (meeting.status === 'recording') statusClass = 'status-recording'; 
            item.innerHTML = `
                <div class="flex-grow">
                    <h3 class="text-lg font-semibold text-blue-700 mb-1">${meeting.title}</h3>
                    <p class="text-sm text-gray-600">Client: ${meeting.clientEmail || 'N/A (Ad-hoc)'}</p>
                    <p class="text-sm text-gray-500">Scheduled: ${new Date(meeting.date).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    ${meeting.duration ? `<p class="text-sm text-gray-500">Duration: ${meeting.duration}</p>` : ''}
                </div>
                <div class="flex flex-col items-start sm:items-end gap-2 mt-3 sm:mt-0">
                    <div class="flex items-center">
                        <span class="status-indicator ${statusClass} mr-2"></span>
                        <span class="text-sm font-medium text-gray-700">${meeting.status}</span>
                    </div>
                    ${meeting.status === 'Scheduled' ? `<button data-id="${meeting.id}" class="start-scheduled-recording-btn btn-primary-blue btn-hover text-xs px-3 py-1.5"><i class="fas fa-play mr-1.5"></i>Record Now</button>` : ''}
                    ${(meeting.status === 'Completed' && meeting.analysisData) ? `<button data-id="${meeting.recorderId || meeting.id}" class="view-recorder-analysis-btn btn-success btn-hover text-xs px-3 py-1.5"><i class="fas fa-eye mr-1.5"></i>View Analysis</button>` : ''}
                    ${meeting.status === 'Processing' ? `<button data-id="${meeting.recorderId || meeting.id}" class="view-recorder-analysis-btn btn-warning btn-hover text-xs px-3 py-1.5"><i class="fas fa-cogs mr-1.5"></i>View Progress</button>` : ''}
                     ${meeting.status === 'recording' ? `<button data-id="${meeting.recorderId || meeting.id}" class="resume-recording-btn btn-danger btn-hover text-xs px-3 py-1.5"><i class="fas fa-microphone mr-1.5"></i>Resume Session</button>` : ''}
                </div>`;
            meetingListRec.appendChild(item);
        });
        meetingListRec.querySelectorAll('.start-scheduled-recording-btn').forEach(btn => btn.addEventListener('click', (e) => handleStartScheduledRecording(e.currentTarget.dataset.id)));
        meetingListRec.querySelectorAll('.view-recorder-analysis-btn').forEach(btn => btn.addEventListener('click', (e) => handleViewRecorderAnalysis(e.currentTarget.dataset.id)));
        meetingListRec.querySelectorAll('.resume-recording-btn').forEach(btn => btn.addEventListener('click', (e) => handleResumeRecordingSession(e.currentTarget.dataset.id)));
    }
    async function populateAudioInputDevicesRec() { 
        if (!audioInputSelectElemRec) return;
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); 
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');
            audioInputSelectElemRec.innerHTML = audioInputs.length === 0 ? '<option value="">No audio input devices found</option>' : 
                audioInputs.map((d,i) => `<option value="${d.deviceId}">${d.label || `Microphone ${i+1}`}</option>`).join('');
        } catch (err) { 
            showNotificationCallback("Error getting audio devices: " + err.message, "error");
            audioInputSelectElemRec.innerHTML = '<option value="">Microphone access denied or error</option>';
        }
    }
    function handleStartScheduledRecording(salesMeetingId) { 
        const meetingToRecord = meetings.find(m => m.id === salesMeetingId);
        if (!meetingToRecord || meetingToRecord.status !== 'Scheduled') {
            showNotificationCallback("This meeting cannot be recorded now (not scheduled or already processed).", "warning");
            return;
        }
        const recorderId = meetingToRecord.recorderId || `rec-${SharedAppLogic.generateId(8)}`; // Use SharedAppLogic
        currentRecorderMeeting = { 
            ...meetingToRecord, 
            id: recorderId, 
            recorderId: recorderId, 
            salesMeetingId: meetingToRecord.id, 
            status: 'pending_start', 
        };
        if(meetingTitleInputElemRec) meetingTitleInputElemRec.value = currentRecorderMeeting.title;
        if(meetingNotesElemRec) meetingNotesElemRec.value = currentRecorderMeeting.notes || '';
        if(recordingMeetingTitleElemRec) recordingMeetingTitleElemRec.textContent = `Recording: ${currentRecorderMeeting.title}`;
        showRecorderView('recording');
        startActualRecording();
    }
    function handleStartAdHocRecording() { 
        currentRecorderMeeting = {
            id: `rec-adhoc-${SharedAppLogic.generateId(8)}`, // Use SharedAppLogic
            recorderId: `rec-adhoc-${SharedAppLogic.generateId(8)}`, 
            title: "Ad-hoc Recording", 
            date: new Date().toISOString(), 
            status: 'pending_start',
            analysisAvailable: false,
            clientEmail: "N/A (Ad-hoc)",
            notes: ""
        };
        if(meetingTitleInputElemRec) meetingTitleInputElemRec.value = ""; 
        if(meetingNotesElemRec) meetingNotesElemRec.value = "";
        if(recordingMeetingTitleElemRec) recordingMeetingTitleElemRec.textContent = "New Ad-hoc Recording";
        showRecorderView('recording');
        startActualRecording();
    }
    function handleResumeRecordingSession(recorderId) { 
        const meetingToResume = meetings.find(m => m.recorderId === recorderId && m.status === 'recording');
        if (meetingToResume) {
            currentRecorderMeeting = { ...meetingToResume }; 
            showNotificationCallback("Attempting to resume recording session... (Feature not fully implemented in this demo)", "info");
            if(meetingTitleInputElemRec) meetingTitleInputElemRec.value = currentRecorderMeeting.title;
            if(meetingNotesElemRec) meetingNotesElemRec.value = currentRecorderMeeting.notes || '';
            if(recordingMeetingTitleElemRec) recordingMeetingTitleElemRec.textContent = `Resuming: ${currentRecorderMeeting.title}`;
            showRecorderView('recording');
            startActualRecording(); 
        } else {
            showNotificationCallback("Could not find active recording session to resume.", "error");
        }
    }
    async function startActualRecording() { 
        if (isRecording) { showNotificationCallback("A recording is already in progress.", "warning"); return; }
        if (!currentRecorderMeeting) { showNotificationCallback("No meeting selected or prepared for recording.", "error"); return; }
        try {
            const constraints = { audio: { deviceId: audioInputSelectElemRec.value ? { exact: audioInputSelectElemRec.value } : undefined } };
            audioStreamForVisualizer = await navigator.mediaDevices.getUserMedia(constraints);
            setupAudioVisualizerRec(audioStreamForVisualizer);
            mediaRecorder = new MediaRecorder(audioStreamForVisualizer);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = handleActualRecordingStop; 
            mediaRecorder.onerror = (event) => { console.error("MediaRecorder error:", event.error); showNotificationCallback(`Recording error: ${event.error.name} - ${event.error.message}`, "error"); stopActualRecording(true); };
            mediaRecorder.start();
            isRecording = true; isPaused = false; recordingStartTime = Date.now(); accumulatedPausedTime = 0;
            currentRecorderMeeting.status = 'recording';
            currentRecorderMeeting.startTimeActual = new Date().toISOString();
            if(audioQualitySelectElemRec) currentRecorderMeeting.audioQuality = audioQualitySelectElemRec.value;
            if(meetingTitleInputElemRec) currentRecorderMeeting.title = meetingTitleInputElemRec.value.trim() || currentRecorderMeeting.title || "Untitled Recording";
            if(meetingNotesElemRec) currentRecorderMeeting.notes = meetingNotesElemRec.value.trim();
            updateMeetingCallback(currentRecorderMeeting); 
            saveMeetingsCallback(); 
            renderRecorderMeetingList(); 
            updateRecorderRecordingUI();
            if(timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateRecorderTimer, 1000);
            showNotificationCallback("Recording started!", "success");
        } catch (err) { 
            console.error("Error starting recording:", err);
            showNotificationCallback(`Error starting recording: ${err.message}. Check microphone permissions.`, "error");
            if (currentRecorderMeeting) { currentRecorderMeeting.status = 'failed_to_start'; updateMeetingCallback(currentRecorderMeeting); saveMeetingsCallback(); renderRecorderMeetingList(); }
            showRecorderView('list'); 
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
        if (audioStreamForVisualizer) { audioStreamForVisualizer.getTracks().forEach(track => track.stop()); audioStreamForVisualizer = null; }
        mediaRecorder = null; 
    }
    async function handleActualRecordingStop() { 
        handleMediaRecorderCleanup();
        if (!currentRecorderMeeting) { console.error("currentRecorderMeeting is null in onstop handler"); if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false); showRecorderView('list'); return;}
        const audioBlob = new Blob(audioChunks, {type: 'audio/webm;codecs=opus'}); 
        audioChunks = []; 
        currentRecorderMeeting.duration = formatDurationRec(Date.now() - recordingStartTime - accumulatedPausedTime);
        currentRecorderMeeting.status = 'processing';
        currentRecorderMeeting.size = audioBlob.size > 0 ? `${(audioBlob.size / (1024*1024)).toFixed(2)}MB` : '0MB';
        currentRecorderMeeting.audioBlob = audioBlob; 
        updateMeetingCallback(currentRecorderMeeting);
        saveMeetingsCallback(); 
        renderRecorderMeetingList(); 
        if(stopBtnElemRec) setButtonLoadingStateCallback(stopBtnElemRec, false);
        showNotificationCallback("Recording stopped. Processing analysis...", "success");
        initiateRecorderAnalysis(currentRecorderMeeting);
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
    function initiateRecorderAnalysis(meeting) { 
        if (!analysisMeetingTitleElemRec || !analysisViewRec) { showRecorderView('list'); return; }
        currentRecorderMeeting = meeting; 
        showRecorderView('analysis');
        analysisMeetingTitleElemRec.textContent = `Analysis for: ${meeting.title}`;
        analysisDateDisplayElemRec.textContent = `Recorded: ${new Date(meeting.startTimeActual || meeting.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}`;
        analysisProgressSectionElemRec.classList.remove('hidden');
        analysisContentSectionElemRec.classList.add('hidden');
        analysisProgressBarElemRec.style.width = '0%';
        analysisProgressPercentageElemRec.textContent = '0%';
        analysisStatusTextElemRec.textContent = 'Preparing analysis...';
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 10) + 5; 
            if (progress >= 100) {
                progress = 100; clearInterval(interval);
                analysisStatusTextElemRec.textContent = 'Analysis Complete!';
                setTimeout(() => { analysisProgressSectionElemRec.classList.add('hidden'); analysisContentSectionElemRec.classList.remove('hidden'); }, 500);
                const mockAnalysis = { 
                    summary: `<p>This is a <strong>simulated AI summary</strong> for the meeting titled "<em>${meeting.title}</em>" which occurred on ${new Date(meeting.startTimeActual || meeting.date).toLocaleDateString()}.</p><p>Key discussion points revolved around ${meeting.notes || 'the main agenda items'}. The overall sentiment appeared to be generally positive, with several action items identified for follow-up. Specific data points and participant contributions have been noted in the full transcript.</p><h3>Key Themes:</h3><ul><li>Theme A was prominent.</li><li>Theme B was discussed with examples.</li><li>Decisions on Theme C were deferred.</li></ul>`,
                    transcript: `[00:00:00] Speaker 1: Okay, let's kick off this meeting for "${meeting.title}". Today is ${new Date(meeting.startTimeActual || meeting.date).toLocaleDateString()}.\n[00:00:05] Speaker 2: Thanks for setting this up. Regarding ${meeting.notes ? meeting.notes.split(',')[0] : 'the first agenda item'}...\n[00:00:15] Speaker 1: Good point. We should also consider...\n...\n[${meeting.duration || '00:10:00'}] Speaker 1: Any final thoughts before we wrap up?\n[${meeting.duration || '00:10:05'}] Speaker 2: No, I think we've covered everything. Thanks.\n(End of simulated transcript. Full transcript would be much longer.)`,
                    keyPoints: `<ul><li>Initial discussion on ${meeting.notes || 'agenda point 1'}.</li><li>Decision made regarding X.</li><li>Follow-up required for Y by Salesperson.</li><li>Client Z raised a question about pricing.</li></ul>`,
                    actionItems: `<ol><li>Salesperson to send follow-up email by EOD.</li><li>Technical team to investigate integration feasibility.</li><li>Client to provide feedback on proposal by next week.</li></ol>`,
                    questions: `<ul><li>"What is the timeline for Phase 2?"</li><li>"Are there any volume discounts available?"</li><li>"Can we get a copy of this presentation?"</li></ul>`,
                    sentiment: `<p>Overall Sentiment: <strong>Positive (78%)</strong></p><p>Key Segments:</p><ul><li>Opening (0-2min): Neutral-Positive</li><li>Core Discussion (2-8min): Positive, some concerns raised.</li><li>Closing (8-10min): Very Positive, clear next steps.</li></ul>`
                };
                meeting.analysisData = mockAnalysis; meeting.status = 'completed'; 
                updateMeetingCallback(meeting); saveMeetingsCallback(); renderRecorderMeetingList(); 
                if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.innerHTML = mockAnalysis.summary;
                if(analysisPanelsElemsRec.transcript) analysisPanelsElemsRec.transcript.innerHTML = mockAnalysis.transcript;
                if(analysisTabsElemsRec && analysisTabsElemsRec.length > 0) { analysisTabsElemsRec.forEach(t => t.classList.remove('active')); analysisTabsElemsRec[0].classList.add('active');}
                Object.values(analysisPanelsElemsRec).forEach(p => { if(p) p.classList.add('hidden'); });
                if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.classList.remove('hidden');
            }
            analysisProgressBarElemRec.style.width = `${progress}%`;
            analysisProgressPercentageElemRec.textContent = `${progress}%`;
            if (progress < 30) analysisStatusTextElemRec.textContent = 'Transcribing audio...';
            else if (progress < 70) analysisStatusTextElemRec.textContent = 'Identifying speakers & topics...';
            else analysisStatusTextElemRec.textContent = 'Generating summary & insights...';
        }, 800); 
    }
    function handleViewRecorderAnalysis(recorderId) { 
        const meetingToAnalyze = getMeetingByIdCallback(recorderId); 
        if (meetingToAnalyze && meetingToAnalyze.status === 'completed' && meetingToAnalyze.analysisData) {
            currentRecorderMeeting = meetingToAnalyze;
            analysisMeetingTitleElemRec.textContent = `Analysis for: ${currentRecorderMeeting.title}`;
            analysisDateDisplayElemRec.textContent = `Recorded: ${new Date(currentRecorderMeeting.startTimeActual || currentRecorderMeeting.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}`;
            analysisProgressSectionElemRec.classList.add('hidden');
            analysisContentSectionElemRec.classList.remove('hidden');
            if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.innerHTML = currentRecorderMeeting.analysisData.summary;
            if(analysisPanelsElemsRec.transcript) analysisPanelsElemsRec.transcript.innerHTML = currentRecorderMeeting.analysisData.transcript;
            if(analysisTabsElemsRec && analysisTabsElemsRec.length > 0) { analysisTabsElemsRec.forEach(t => t.classList.remove('active')); analysisTabsElemsRec[0].classList.add('active');}
            Object.values(analysisPanelsElemsRec).forEach(p => {if(p) p.classList.add('hidden');});
            if(analysisPanelsElemsRec.summary) analysisPanelsElemsRec.summary.classList.remove('hidden');
            showRecorderView('analysis');
        } else if (meetingToAnalyze && meetingToAnalyze.status === 'processing') {
            initiateRecorderAnalysis(meetingToAnalyze);
        } else {
            showNotificationCallback("Analysis not found or meeting not completed.", "error");
        }
    }
    function handleDeepLink(recorderId, recorderCode) { 
        const meeting = getMeetingByIdCallback(recorderId);
        if (meeting && meeting.recorderAccessCode === recorderCode) { // Assuming recorderAccessCode is stored
            showNotificationCallback(`Accessing scheduled recording: ${meeting.title}`, "info");
            handleStartScheduledRecording(meeting.id); 
        } else if (meeting) {
            showNotificationCallback(`Invalid recorder code for meeting: ${meeting.title}`, "warning");
            renderRecorderMeetingList(); showRecorderView('list');
        } else {
            showNotificationCallback(`Meeting with Recorder ID ${recorderId} not found.`, "error");
            renderRecorderMeetingList(); showRecorderView('list');
        }
    }


    return {
        init: (meetingsArr, notifyCb, switchCb, saveCb, setLoadStateCb, getMeetingCb, updateMeetingCb) => {
            meetings = meetingsArr;
            showNotificationCallback = notifyCb;
            switchViewCallback = switchCb;
            saveMeetingsCallback = saveCb;
            setButtonLoadingStateCallback = setLoadStateCb;
            getMeetingByIdCallback = getMeetingCb;
            updateMeetingCallback = updateMeetingCb;
            
            initDOMReferences(); 
            setupEventListeners();
            populateAudioInputDevicesRec();
            
            renderRecorderMeetingList();
            showRecorderView('list');
        },
        getHTML,
        handleDeepLink
    };
})();