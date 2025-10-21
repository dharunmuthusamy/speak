// static/js/app.js - Full Integrated Version with Enhanced Session Records
let socket;
let video;
let canvas;
let ctx;
let sessionId;
let isSessionActive = false;
let isCameraActive = false;
let stream = null;
let frameInterval = null;

// Session Management
let sessionCounter = 0;
let allSessions = {};

// Real-time feedback variables
let eyeContactStartTime = null;
let currentEyeContactDuration = 0;
let segmentStartTime = null;
let segmentEyeContactTime = 0;
let feedbackHistory = [];

// Canvas dimensions
let canvasWidth = 480;
let canvasHeight = 360;

// Charts
let eyeContactChart, gazePatternChart, volumeChart, pitchChart;

// Speech recording
let mediaRecorder;
let audioChunks = [];
let isRecordingSpeech = false;

// Store analysis data for delayed display
let pendingAnalysisData = null;
let pendingSpeechData = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    video = document.getElementById('video');
    canvas = document.getElementById('overlay');
    ctx = canvas.getContext('2d');
    
    // Set canvas dimensions
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    
    // Initialize feedback display
    initializeFeedbackDisplay();
    
    // Connect to Flask server
    socket = io();
    
    socket.on('connected', function(data) {
        updateStatus('Connected to analysis server');
    });
    
    socket.on('session_started', function(data) {
        sessionId = data.session_id;
        updateStatus('Session started: ' + sessionId + ' - Speak naturally...');
        document.getElementById('stopBtn').disabled = false;
        document.getElementById('analyzeBtn').disabled = true;
        document.getElementById('startBtn').disabled = true;
        
        // Start new segment
        startNewSegment();
    });
    
    socket.on('session_stopped', function(data) {
        updateStatus('Recording stopped. Collected ' + data.total_points + ' data points (' + data.detection_rate + '% detection). Click "Analyze Session" to see results.');
        document.getElementById('analyzeBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('startBtn').disabled = false;
        isSessionActive = false;
        
        // End current segment
        endCurrentSegment();
    });
    
    socket.on('analysis_complete', function(data) {
        // Store analysis data for delayed display after AI feedback
        pendingAnalysisData = data;

        document.getElementById('analyzeBtn').disabled = true;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('startBtn').disabled = false;
        updateStatus('Analysis complete! Getting AI feedback...');

        // Store session in session manager
        storeSessionInManager(data.analysis);

        // Automatically get AI feedback after analysis
        getAIFeedback(sessionId);
    });
    
    socket.on('analysis_error', function(data) {
        updateStatus('Analysis error: ' + data.error);
        document.getElementById('analyzeBtn').disabled = false;
    });
    
    socket.on('ai_feedback_complete', function(data) {
        displayAIFeedback(data.ai_feedback);
        
        // Update session with AI feedback
        updateSessionWithAIFeedback(data.ai_feedback);
        
        // Now display the pending analysis data
        if (pendingAnalysisData) {
            displayFinalAnalysis(pendingAnalysisData);
            pendingAnalysisData = null;
        }
        
        updateStatus('Analysis and AI feedback complete! Check results and insights below.');
        
        // Show visualizations and results
        const visualizations = document.getElementById('visualizations');
        if (visualizations) {
            visualizations.style.display = 'grid';
        }
        
        const resultsSection = document.getElementById('results');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }
    });

    socket.on('ai_feedback_error', function(data) {
        updateStatus('AI feedback error: ' + data.error);
        showTemporaryMessage('AI feedback unavailable', 'error');
    });
    
    socket.on('calibration_complete', function(data) {
        updateStatus('Eye tracker calibrated successfully!');
        showTemporaryMessage('Calibration complete! Look straight at the camera for best results.', 'success');
    });
    
    socket.on('tracker_reset', function(data) {
        updateStatus('Eye tracker reset - ready for new session');
    });
    
    socket.on('processing_error', function(data) {
        console.error('Processing error:', data.error);
        updateStatus('Processing error: ' + data.error);
    });

    socket.on('speech_started', function(data) {
        updateStatus('Speech recording started');
    });

    socket.on('speech_stopped', function(data) {
        updateStatus('⏹Speech recording stopped - analyzing...');
    });

    socket.on('speech_analysis_complete', function(data) {
        pendingSpeechData = data.analysis;
        updateStatus('Speech analysis complete');
    });

    socket.on('speech_error', function(data) {
        updateStatus('Speech error: ' + data.error);
    });

    // Initialize charts
    initializeCharts();

    // Load existing sessions
    loadSessionData();
});

// ==================== SESSION MANAGEMENT ====================

function storeSessionInManager(analysis) {
    if (!sessionId) {
        console.warn('No sessionId available for storing session');
        return;
    }

    const sessionTime = new Date().toLocaleString();

    allSessions[sessionId] = {
        id: sessionId,
        timestamp: sessionTime,
        analysis: analysis,
        total_points: analysis.total_points || 0,
        eye_contact: analysis.core_metrics?.eye_contact_score || 0,
        duration: analysis.core_metrics?.total_eye_contact_time || 0,
        ai_feedback: null
    };

    saveSessionData();
    console.log(' Session stored in manager:', sessionId);
}

function updateSessionWithAIFeedback(aiFeedback) {
    // Find the most recent session and update it with AI feedback
    const sessions = Object.values(allSessions).sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    if (sessions.length > 0) {
        const latestSession = sessions[0];
        latestSession.ai_feedback = aiFeedback;
        saveSessionData();
        console.log('🤖 AI feedback added to session:', latestSession.id);
    }
}

function saveSessionData() {
    try {
        localStorage.setItem('speak_sessions', JSON.stringify(allSessions));
    } catch (e) {
        console.warn('Could not save to localStorage:', e);
    }
}

function loadSessionData() {
    try {
        const saved = localStorage.getItem('speak_sessions');
        if (saved) {
            allSessions = JSON.parse(saved);

            // Find the highest session number to continue sequential numbering
            let maxSessionNumber = 0;
            Object.keys(allSessions).forEach(sessionId => {
                const match = sessionId.match(/^session-(\d+)$/);
                if (match) {
                    const num = parseInt(match[1]);
                    if (num > maxSessionNumber) {
                        maxSessionNumber = num;
                    }
                }
            });
            sessionCounter = maxSessionNumber;

            console.log('📂 Loaded', Object.keys(allSessions).length, 'sessions from storage, next session will be session-', sessionCounter + 1);
        }
    } catch (e) {
        console.warn('Could not load from localStorage:', e);
    }
}

function viewRecords() {
    loadSessionData();
    document.getElementById('mainPage').style.display = 'none';
    document.getElementById('recordsPage').style.display = 'block';
    displayRecordsList();
}

function backToMain() {
    document.getElementById('recordsPage').style.display = 'none';
    document.getElementById('mainPage').style.display = 'block';
}

function displayRecordsList() {
    const recordsListDiv = document.getElementById('recordsList');
    const recordDetailDiv = document.getElementById('recordDetail');
    
    let html = '<h2>All Session Records</h2>';
    
    if (Object.keys(allSessions).length === 0) {
        html += `
            <div class="card" style="text-align: center; padding: 40px;">
                <div style="font-size: 4rem; color: var(--gray-light); margin-bottom: 20px;">
                    <i class="fas fa-folder-open"></i>
                </div>
                <h3 style="color: var(--text-primary); margin-bottom: 15px;">No Sessions Recorded Yet</h3>
                <p style="color: var(--text-gray); margin-bottom: 25px;">
                    Start a session and analyze it to see records here.
                </p>
                <button class="btn btn-primary" onclick="backToMain()">
                    <i class="fas fa-arrow-left"></i> Back to Main
                </button>
            </div>
        `;
    } else {
        html += '<div class="session-list">';
        
        const sortedSessions = Object.values(allSessions).sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        sortedSessions.forEach(session => {
            const hasAIFeedback = session.ai_feedback ? '!' : '';

            html += `
                <div class="card session-item">
                    <div class="session-record">${session.timestamp} ${hasAIFeedback} ${session.id}</div>
                    <div class="session-actions">
                        <button onclick="viewSessionDetail('${session.id}')" class="btn btn-primary">
                            <i class="fas fa-external-link-alt"></i> View Details
                        </button>
                        <button onclick="deleteSession('${session.id}')" class="btn btn-danger">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    recordsListDiv.innerHTML = html;
    recordDetailDiv.innerHTML = '';
}

function getEngagementClass(engagement) {
    if (!engagement) return 'tag-default';
    if (engagement.includes('High')) return 'tag-success';
    if (engagement.includes('Moderate')) return 'tag-warning';
    if (engagement.includes('Low')) return 'tag-danger';
    return 'tag-default';
}

function viewSessionDetail(sessionId) {
    // Store session data in localStorage for session.html to access
    const session = allSessions[sessionId];
    if (session) {
        localStorage.setItem('selected_session', JSON.stringify(session));
        // Redirect to session.html
        window.location.href = '/session';
    } else {
        showTemporaryMessage('Session not found', 'error');
    }
}

function closeSessionDetail() {
    document.getElementById('recordDetail').innerHTML = '';
}

function deleteSession(sessionId) {
    if (confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
        delete allSessions[sessionId];
        saveSessionData();
        displayRecordsList();
        showTemporaryMessage('Session deleted successfully', 'success');
    }
}

function clearAllSessions() {
    if (Object.keys(allSessions).length === 0) {
        showTemporaryMessage('No sessions to clear', 'info');
        return;
    }
    
    if (confirm('Are you sure you want to delete ALL sessions? This action cannot be undone.')) {
        allSessions = {};
        sessionCounter = 0;
        saveSessionData();
        displayRecordsList();
        showTemporaryMessage('All sessions cleared successfully', 'success');
    }
}

// ==================== AI FEEDBACK FUNCTIONS ====================

function getAIFeedback(sessionId) {
    if (!sessionId) {
        showTemporaryMessage('No session to analyze', 'error');
        return;
    }

    updateStatus(' Getting AI-powered feedback...');
    socket.emit('get_ai_feedback', { session_id: sessionId });
}

function displayAIFeedback(aiFeedback) {
    const aiContainer = document.getElementById('aiFeedbackContainer');

    let html = `
        <div class="ai-feedback-section">
            <!-- Header -->
            <div class="ai-header">
                <div class="ai-header-content">
                    <h2>
                        <i class="fas fa-robot"></i>
                        AI-Powered Professional Analysis
                    </h2>
                    <p>Comprehensive feedback based on your eye tracking data and speaking patterns</p>
                </div>
                <div class="ai-header-meta">
                    <span class="ai-badge">Gemini AI</span>
                    <span class="performance-rating ${getRatingClass(aiFeedback.performance_rating)}">
                        ${aiFeedback.performance_rating}
                    </span>
                </div>
            </div>

            <!-- Content -->
            <div class="ai-content">
                <!-- Overall Assessment -->
                <div class="section-header">
                    <h3><i class="fas fa-clipboard-check"></i> Overall Assessment</h3>
                </div>
                <div class="overall-assessment fade-in-section" id="overallAssessment">
                    ${aiFeedback.overall_assessment}
                </div>

                <!-- Strengths & Improvements -->
                <div class="insights-container fade-in-section" id="insightsContainer">
                    <div class="insight-section strengths-section">
                        <h4 class="insight-title strengths-title">
                            <i class="fas fa-check-circle"></i>
                            Key Strengths
                        </h4>
                        <ul class="insight-list" id="strengthsList">
    `;

    aiFeedback.key_strengths.forEach((strength, index) => {
        html += `<li class="fade-in-section" id="strength-${index}">${strength}</li>`;
    });

    html += `
                        </ul>
                    </div>

                    <div class="insight-section improvements-section">
                        <h4 class="insight-title improvements-title">
                            <i class="fas fa-sync-alt"></i>
                            Areas for Improvement
                        </h4>
                        <ul class="insight-list" id="improvementsList">
    `;

    aiFeedback.areas_for_improvement.forEach((area, index) => {
        html += `<li class="fade-in-section" id="improvement-${index}">${area}</li>`;
    });

    html += `
                        </ul>
                    </div>
                </div>

                <!-- Detailed Analysis -->
                <div class="section-header fade-in-section" id="detailedAnalysisHeader">
                    <h3><i class="fas fa-chart-line"></i> Detailed Analysis</h3>
                </div>
                <div class="detailed-analysis fade-in-section" id="detailedAnalysis">
                    ${aiFeedback.personalized_feedback}
                </div>

                <!-- Actionable Strategies -->
                <div class="strategies-section fade-in-section" id="strategiesSection">
                    <div class="section-header">
                        <h3><i class="fas fa-rocket"></i> Actionable Strategies</h3>
                    </div>
                    <ul class="strategies-list" id="strategiesList">
    `;

    aiFeedback.actionable_strategies.forEach((strategy, index) => {
        html += `
                        <li class="strategy-item fade-in-section" id="strategy-${index}">
                            <div class="strategy-name">
                                ${strategy.strategy}
                            </div>
                            <div class="strategy-details">
                                <div class="strategy-detail">
                                    <strong>How to implement:</strong> ${strategy.description}
                                </div>
                                <div class="strategy-detail">
                                    <strong>Expected benefit:</strong> ${strategy.benefit}
                                </div>
                            </div>
                        </li>
        `;
    });

    html += `
                    </ul>
                </div>

                <!-- Practice Exercises -->
                <div class="exercises-section fade-in-section" id="exercisesSection">
                    <div class="section-header">
                        <h3><i class="fas fa-dumbbell"></i> Practice Exercises</h3>
                    </div>
                    <ul class="exercises-list" id="exercisesList">
    `;

    aiFeedback.practice_exercises.forEach((exercise, index) => {
        html += `
                        <li class="exercise-item fade-in-section" id="exercise-${index}">
                            <div class="exercise-name">
                                ${exercise.exercise}
                            </div>
                            <div class="exercise-details">
                                <div class="exercise-detail">
                                    <strong>Instructions:</strong> ${exercise.instructions}
                                </div>
                                <div class="exercise-detail">
                                    <strong>Recommended duration:</strong> ${exercise.duration}
                                </div>
                            </div>
                        </li>
        `;
    });

    html += `
                    </ul>
                </div>

                <!-- Confidence Boosters -->
                <div class="boosters-section fade-in-section" id="boostersSection">
                    <div class="section-header">
                        <h3><i class="fas fa-bolt"></i> Quick Confidence Boosters</h3>
                    </div>
                    <p class="boosters-intro fade-in-section" id="boostersIntro">Simple tips you can implement immediately to improve your presence:</p>
                    <div class="boosters-list" id="boostersList">
    `;

    aiFeedback.confidence_boosters.forEach((booster, index) => {
        html += `<span class="booster-item fade-in-section" id="booster-${index}">${booster}</span>`;
    });

    html += `
                    </div>
                </div>

                <!-- Next Session Goals -->
                <div class="goals-section fade-in-section" id="goalsSection">
                    <div class="section-header">
                        <h3><i class="fas fa-bullseye"></i> Next Session Goals</h3>
                    </div>
                    <p class="goals-intro fade-in-section" id="goalsIntro">Focus on these objectives in your next practice session:</p>
                    <ul class="goals-list" id="goalsList">
    `;

    aiFeedback.next_session_goals.forEach((goal, index) => {
        html += `<li class="fade-in-section" id="goal-${index}">${goal}</li>`;
    });

    html += `
                    </ul>
                </div>
            </div>
        </div>
    `;

    aiContainer.innerHTML = html;

    // Start the sequential fade-in animation
    startSequentialFadeIn(aiFeedback);
}

function getRatingClass(rating) {
    const ratingMap = {
        'Excellent': 'rating-excellent',
        'Good': 'rating-good',
        'Fair': 'rating-fair',
        'Poor': 'rating-poor',
        'Needs Improvement': 'rating-poor'
    };
    return ratingMap[rating] || 'rating-fair';
}

function startSequentialFadeIn(aiFeedback) {
    // Show the insights container first
    const container = document.getElementById('insightsContainer');
    if (container) {
        container.style.display = 'grid';
    }

    // Define the sequence of elements to fade in
    const fadeSequence = [
        { id: 'overallAssessment', delay: 0 },
        { id: 'insightsContainer', delay: 500 },
        { id: 'detailedAnalysisHeader', delay: 1000 },
        { id: 'detailedAnalysis', delay: 1200 },
        { id: 'strategiesSection', delay: 1400 },
        { id: 'exercisesSection', delay: 1600 },
        { id: 'boostersSection', delay: 1800 },
        { id: 'boostersIntro', delay: 1900 },
        { id: 'goalsSection', delay: 2100 },
        { id: 'goalsIntro', delay: 2200 }
    ];

    // Add individual items to the sequence
    aiFeedback.key_strengths.forEach((_, index) => {
        fadeSequence.push({ id: `strength-${index}`, delay: 800 + (index * 200) });
    });

    aiFeedback.areas_for_improvement.forEach((_, index) => {
        fadeSequence.push({ id: `improvement-${index}`, delay: 900 + (index * 200) });
    });

    aiFeedback.actionable_strategies.forEach((_, index) => {
        fadeSequence.push({ id: `strategy-${index}`, delay: 1500 + (index * 300) });
    });

    aiFeedback.practice_exercises.forEach((_, index) => {
        fadeSequence.push({ id: `exercise-${index}`, delay: 1700 + (index * 300) });
    });

    aiFeedback.confidence_boosters.forEach((_, index) => {
        fadeSequence.push({ id: `booster-${index}`, delay: 2000 + (index * 150) });
    });

    aiFeedback.next_session_goals.forEach((_, index) => {
        fadeSequence.push({ id: `goal-${index}`, delay: 2300 + (index * 200) });
    });

    // Execute the fade-in sequence
    fadeSequence.forEach(({ id, delay }) => {
        setTimeout(() => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('fade-in');
            }
        }, delay);
    });

    // Log completion
    setTimeout(() => {
        console.log('🎉 All AI feedback fade-in animations completed!');
    }, fadeSequence[fadeSequence.length - 1].delay + 600);
}



// ==================== CHART FUNCTIONS ====================

function initializeCharts() {
    // Eye Contact Distribution Chart
    const eyeContactCtx = document.getElementById('eyeContactChart').getContext('2d');
    eyeContactChart = new Chart(eyeContactCtx, {
        type: 'doughnut',
        data: {
            labels: ['Eye Contact', 'No Eye Contact'],
            datasets: [{
                data: [50, 50],
                backgroundColor: ['#4ade80', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#1e293b',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });

    // Gaze Pattern Chart
    const gazePatternCtx = document.getElementById('gazePatternChart').getContext('2d');
    gazePatternChart = new Chart(gazePatternCtx, {
        type: 'line',
        data: {
            labels: Array.from({length: 20}, (_, i) => i + 1),
            datasets: [{
                label: 'Gaze X',
                data: Array(20).fill(0),
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Gaze Y',
                data: Array(20).fill(0),
                borderColor: '#4cc9f0',
                backgroundColor: 'rgba(76, 201, 240, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: -1,
                    max: 1,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        color: '#1e293b'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        color: '#1e293b'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#1e293b',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });

    // Volume Chart
    const volumeCtx = document.getElementById('volumeChart').getContext('2d');
    volumeChart = new Chart(volumeCtx, {
        type: 'line',
        data: {
            labels: Array.from({length: 20}, (_, i) => i + 1),
            datasets: [{
                label: 'Volume Level',
                data: Array(20).fill(0),
                borderColor: '#ff6b6b',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        color: '#1e293b'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        color: '#1e293b'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#1e293b',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });

    // Pitch Chart
    const pitchCtx = document.getElementById('pitchChart').getContext('2d');
    pitchChart = new Chart(pitchCtx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Pitch Variation',
                data: [],
                backgroundColor: '#4ecdc4',
                borderColor: '#4ecdc4',
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (s)',
                        color: '#1e293b'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        color: '#1e293b'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Pitch (Hz)',
                        color: '#1e293b'
                    },
                    min: 50,
                    max: 500,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        color: '#1e293b'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#1e293b',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

function updateCharts(analysis) {
    if (!analysis) return;

    // Update eye contact chart
    if (analysis.eye_contact_percentage) {
        eyeContactChart.data.datasets[0].data = [
            analysis.eye_contact_percentage, 
            100 - analysis.eye_contact_percentage
        ];
        eyeContactChart.update();
    }

    // Update gaze pattern chart
    if (analysis.gaze_direction) {
        // Shift data left and add new data point
        gazePatternChart.data.datasets[0].data.shift();
        gazePatternChart.data.datasets[0].data.push(analysis.gaze_direction.x);
        
        gazePatternChart.data.datasets[1].data.shift();
        gazePatternChart.data.datasets[1].data.push(analysis.gaze_direction.y);
        
        gazePatternChart.update();
    }
}

// ==================== TYPING EFFECT FUNCTIONS ====================

function typewriterEffect(element, text, speed = 30) {
    return new Promise((resolve) => {
        element.innerHTML = '';
        let i = 0;
        
        function type() {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                i++;
                setTimeout(type, speed);
            } else {
                element.classList.remove('typing-effect');
                resolve();
            }
        }
        
        element.classList.add('typing-effect');
        type();
    });
}

function applyDeepSeekTypingEffects() {
    const elementsToType = [
        { selector: '.assessment-card p', speed: 20 },
        { selector: '.insight-list li', speed: 15 },
        { selector: '.strategy-card', speed: 25 },
        { selector: '.exercise-card', speed: 25 },
        { selector: '.booster-tag', speed: 8 },
        { selector: '.goals-list li', speed: 15 }
    ];
    
    let delay = 0;
    
    elementsToType.forEach(({ selector, speed }) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element, index) => {
            setTimeout(() => {
                const originalText = element.textContent;
                typewriterEffect(element, originalText, speed);
            }, delay + (index * 300));
        });
        delay += elements.length * 300;
    });
}

// ==================== REAL-TIME ANALYSIS FUNCTIONS ====================

function initializeFeedbackDisplay() {
    const feedbackContainer = document.getElementById('realTimeFeedback');
    // Already implemented in HTML
}

function updateRealTimeFeedback(analysis) {
    if (!analysis) return;
    
    const indicator = document.getElementById('eyeContactIndicator');
    const dot = indicator?.querySelector('.indicator-dot');
    
    if (analysis.eye_contact) {
        if (dot) {
            indicator.style.color = '#28a745';
            dot.style.backgroundColor = '#28a745';
            dot.style.boxShadow = '0 0 10px rgba(40, 167, 69, 0.5)';
        }
        
        if (!eyeContactStartTime) {
            eyeContactStartTime = Date.now();
        }
        currentEyeContactDuration = (Date.now() - eyeContactStartTime) / 1000;
        
        const durationElement = document.getElementById('currentDuration');
        if (durationElement) {
            durationElement.textContent = currentEyeContactDuration.toFixed(1) + 's';
        }
        
        segmentEyeContactTime += (1/10);
    } else {
        if (dot) {
            indicator.style.color = '#dc3545';
            dot.style.backgroundColor = '#dc3545';
            dot.style.boxShadow = '0 0 10px rgba(220, 53, 69, 0.5)';
        }
        eyeContactStartTime = null;
        currentEyeContactDuration = 0;
        
        const durationElement = document.getElementById('currentDuration');
        if (durationElement) {
            durationElement.textContent = '0s';
        }
    }
    
    const eyeContactValue = document.getElementById('eyeContactValue');
    if (eyeContactValue && analysis.eye_contact_percentage) {
        eyeContactValue.textContent = analysis.eye_contact_percentage + '%';
    }
    
    const segmentProgress = document.getElementById('segmentProgress');
    if (segmentProgress) {
        const segmentDuration = (Date.now() - segmentStartTime) / 1000;
        const progress = Math.min(100, (segmentDuration / 60) * 100);
        segmentProgress.style.width = progress + '%';
    }
    
    const liveScore = calculateLiveScore(analysis);
    const liveScoreElement = document.getElementById('liveScore');
    if (liveScoreElement) {
        liveScoreElement.textContent = liveScore;
        liveScoreElement.className = 'score-display ' + getScoreClass(liveScore);
    }
    
    updateCoachingTip(analysis, liveScore);
}

function calculateLiveScore(analysis) {
    const eyeContactScore = analysis.eye_contact_percentage || 0;
    const stabilityBonus = analysis.eye_contact ? 5 : 0;
    const durationBonus = Math.min(10, currentEyeContactDuration / 2);
    
    return Math.min(100, eyeContactScore + stabilityBonus + durationBonus);
}

function getScoreClass(score) {
    if (score >= 80) return 'score-excellent';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-fair';
    return 'score-poor';
}

function updateCoachingTip(analysis, score) {
    const tipElement = document.getElementById('coachingTip');
    if (!tipElement) return;
    
    let tip = '';
    
    if (!analysis.face_detected) {
        tip = 'No face detected - Check lighting and camera position';
    } else if (!analysis.landmarks_detected) {
        tip = 'Face detected but features unclear - Move closer to camera';
    } else if (analysis.eye_contact) {
        if (currentEyeContactDuration < 3) {
            tip = 'Good start! Try holding eye contact for 3-5 seconds';
        } else if (currentEyeContactDuration < 6) {
            tip = 'Excellent! You\'re maintaining strong eye contact';
        } else {
            tip = 'Outstanding! Natural, sustained eye contact';
        }
    } else {
        if (analysis.eye_contact_percentage < 30) {
            tip = 'Look towards the camera to establish connection';
        } else if (analysis.eye_contact_percentage < 50) {
            tip = 'Good moments of eye contact - try to be more consistent';
        } else {
            tip = 'Brief breaks are natural - return your gaze to the camera';
        }
    }
    
    // Apply typing effect to coaching tip
    if (tipElement.textContent !== tip) {
        typewriterEffect(tipElement, tip, 30);
    }
}

function startNewSegment() {
    segmentStartTime = Date.now();
    segmentEyeContactTime = 0;
    eyeContactStartTime = null;
    currentEyeContactDuration = 0;
}

function endCurrentSegment() {
    const segmentDuration = (Date.now() - segmentStartTime) / 1000;
    const segmentScore = (segmentEyeContactTime / segmentDuration) * 100;
    
    feedbackHistory.push({
        duration: segmentDuration,
        score: segmentScore,
        timestamp: new Date().toLocaleTimeString()
    });
}

// ==================== RECORDING FUNCTIONS ====================

async function startRecording() {
    try {
        updateStatus('Starting recording session...');

        // Start camera
        await startCamera();

        // Start real-time voice analysis
        initRealTimeVoice();

        // Start session after camera is ready
        setTimeout(() => {
            startSession();
            document.getElementById('startRecordingBtn').disabled = true;
            document.getElementById('stopRecordingBtn').disabled = false;
            document.getElementById('analyzeBtn').disabled = true;
        }, 1000);

    } catch (error) {
        console.error('Error starting recording:', error);
        updateStatus('Failed to start recording: ' + error.message);
    }
}

function stopRecording() {
    updateStatus('⏹Stopping recording...');

    // Stop session
    stopSession();

    // Stop camera
    stopCamera();

    // Stop real-time voice
    stopRealTimeVoice();

    // Update button states
    document.getElementById('startRecordingBtn').disabled = false;
    document.getElementById('stopRecordingBtn').disabled = true;
    document.getElementById('analyzeBtn').disabled = false;
}

// ==================== CAMERA AND SESSION FUNCTIONS ====================

async function startCamera() {
    try {
        if (stream) {
            stopCamera();
        }
        
        const constraints = {
            video: { 
                width: { ideal: canvasWidth },
                height: { ideal: canvasHeight },
                frameRate: { ideal: 30 },
                facingMode: 'user'
            },
            audio: false
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        video.srcObject = stream;
        isCameraActive = true;
        
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve();
            };
        });
        
        updateStatus('Camera started - Ensure good lighting and face the camera');
        document.getElementById('stopCameraBtn').disabled = false;
        document.getElementById('startBtn').disabled = false;
        
    } catch (error) {
        console.error('Camera error:', error);
        updateStatus('Camera error: ' + error.message);
        showTemporaryMessage('Camera access denied. Please allow camera permissions.', 'error');
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => {
            track.stop();
        });
        stream = null;
    }
    
    if (frameInterval) {
        clearInterval(frameInterval);
        frameInterval = null;
    }
    
    if (isSessionActive) {
        stopSession();
    }
    
    video.srcObject = null;
    isCameraActive = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    document.getElementById('stopCameraBtn').disabled = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('analyzeBtn').disabled = true;
    
    updateStatus('Camera stopped');
}

// ==================== VOICE ANALYSIS FUNCTIONS ====================
// Voice analysis functions are now in speech_recording.js

function startSession() {
    if (!isCameraActive) {
        updateStatus('Please start camera first');
        showTemporaryMessage('Please start camera first', 'error');
        return;
    }

    // Generate timestamp-based session ID
    sessionId = 'session_' + Date.now();
    isSessionActive = true;

    document.getElementById('results').innerHTML = '';
    document.getElementById('aiFeedbackContainer').innerHTML = '';

    socket.emit('start_session', { session_id: sessionId });

    // Start frame processing
    frameInterval = setInterval(() => {
        if (isSessionActive && isCameraActive) {
            captureAndProcessFrame();
        }
    }, 100);
}

function stopSession() {
    if (isSessionActive) {
        updateStatus('⏹️ Stopping recording...');
        socket.emit('stop_session', { session_id: sessionId });
        isSessionActive = false;
    }
}

function analyzeSession() {
    if (sessionId) {
        updateStatus('Analyzing your speech data...');
        document.getElementById('analyzeBtn').disabled = true;
        socket.emit('analyze_session', { session_id: sessionId });
    } else {
        updateStatus('No session data to analyze. Please record first.');
        showTemporaryMessage('No session data to analyze. Please record first.', 'error');
    }
}

function calibrateTracker() {
    if (socket) {
        socket.emit('calibrate_tracker');
        updateStatus('Calibrating eye tracker... Look straight at the camera');
    }
}

function captureAndProcessFrame() {
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    if (socket && sessionId) {
        socket.emit('process_frame', {
            session_id: sessionId,
            image_data: imageData
        });
    }
}

function displayRealTimeAnalysis(data) {
    // Real-time analysis display can be enhanced here
}

function displayFinalAnalysis(data) {
    const resultsDiv = document.getElementById('analysisResults');
    const analysis = data.analysis;

    let html = '<div class="analysis-result">';
    html += '<h2>🎉 Analysis Complete!</h2>';

    // Core metrics - combined eye tracking and speech
    html += `
        <div class="performance-summary">
            <h4>Core Metrics</h4>
            <div class="summary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0;">
                <div class="score-card">
                    <div class="score-value">${analysis.core_metrics.eye_contact_score}%</div>
                    <div class="summary-label">Eye Contact Score</div>
                </div>
                <div class="score-card">
                    <div class="score-value">${analysis.core_metrics.focus_consistency}%</div>
                    <div class="summary-label">Focus Consistency</div>
                </div>
                <div class="score-card">
                    <div class="score-value">${analysis.core_metrics.blink_count}</div>
                    <div class="summary-label">Blink Count</div>
                </div>
                <div class="score-card">
                    <div class="score-value">${analysis.core_metrics.total_eye_contact_time}s</div>
                    <div class="summary-label">Eye Contact Time</div>
                </div>
    `;

    // Add speech metrics if available
    if (pendingSpeechData) {
        const speechAnalysis = pendingSpeechData;
        // Check if speech was detected
        if (speechAnalysis.text && speechAnalysis.text.trim() !== "" && speechAnalysis.word_count > 0) {
            html += `
                    <div class="score-card">
                        <div class="score-value">${speechAnalysis.speech_metrics?.speech_rate || 0}</div>
                        <div class="summary-label">Words per Minute</div>
                    </div>
                    <div class="score-card">
                        <div class="score-value">${speechAnalysis.speech_metrics?.pause_count || 0}</div>
                        <div class="summary-label">Pause Count</div>
                    </div>
                    <div class="score-card">
                        <div class="score-value">${speechAnalysis.speech_metrics?.total_words || 0}</div>
                        <div class="summary-label">Total Words</div>
                    </div>
                    <div class="score-card">
                        <div class="score-value">${speechAnalysis.speech_metrics?.clarity_score || 0}%</div>
                        <div class="summary-label">Clarity Score</div>
                    </div>
            `;
        } else {
            html += `
                    <div class="score-card" style="background: rgba(255, 193, 7, 0.1); border: 1px solid #ffc107;">
                        <div class="score-value" style="color: #856404;">
                            <i class="fas fa-microphone-slash"></i>
                        </div>
                        <div class="summary-label" style="color: #856404;">No Speech Detected</div>
                    </div>
            `;
        }
    }

    html += `
            </div>
        </div>
    `;

    // Speech insights integrated into core metrics
    if (pendingSpeechData && pendingSpeechData.speech_insights) {
        const speechAnalysis = pendingSpeechData;
        html += `
            <div class="speech-insights-core">
                <h5>Speech Insights</h5>
                <div class="insights-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; margin: 10px 0;">
        `;

        if (speechAnalysis.speech_insights.pacing_feedback) {
            html += `<div class="insight-card">⏱<strong>Pacing:</strong> ${speechAnalysis.speech_insights.pacing_feedback}</div>`;
        }
        if (speechAnalysis.speech_insights.clarity_feedback) {
            html += `<div class="insight-card"><strong>Clarity:</strong> ${speechAnalysis.speech_insights.clarity_feedback}</div>`;
        }
        if (speechAnalysis.speech_insights.confidence_indicators) {
            html += `<div class="insight-card"><strong>Confidence:</strong> ${speechAnalysis.speech_insights.confidence_indicators}</div>`;
        }

        html += `
                </div>
            </div>
        `;

        // Clear pending speech data after displaying
        pendingSpeechData = null;
    }

    html += '</div>';

    resultsDiv.innerHTML = html;
}

function displaySpeechAnalysis(data) {
    const speechResultsDiv = document.getElementById('speechResults');
    const analysis = data.analysis;

    let html = '<div class="speech-analysis-result">';

    // Check if no speech was detected
    if (!analysis.text || analysis.text.trim() === "" || analysis.word_count === 0) {
        html += '<h2>🎤 Speech Analysis Complete!</h2>';
        html += `
            <div class="no-speech-feedback" style="text-align: center; padding: 40px; background: rgba(255, 193, 7, 0.1); border: 2px solid #ffc107; border-radius: 12px; margin: 20px 0;">
                <div style="font-size: 3rem; color: #ffc107; margin-bottom: 20px;">
                    <i class="fas fa-microphone-slash"></i>
                </div>
                <h3 style="color: #856404; margin-bottom: 15px;">No Speech Detected</h3>
                <p style="color: #856404; font-size: 1.1rem; margin-bottom: 20px;">
                    Please speak something during your recording session. Make sure your microphone is working and you're speaking clearly.
                </p>
                <button onclick="startSpeechRecording()" class="btn btn-warning" style="margin-top: 10px;">
                    <i class="fas fa-microphone"></i> Try Recording Again
                </button>
            </div>
        `;
    } else {
        html += '<h2>🎤 Speech Analysis Complete!</h2>';

        // Speech metrics
        html += `
            <div class="speech-performance-summary">
                <h4>Speech Metrics</h4>
                <div class="summary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0;">
                    <div class="score-card">
                        <div class="score-value">${analysis.speech_metrics?.speech_rate || 0}</div>
                        <div class="summary-label">Words per Minute</div>
                    </div>
                    <div class="score-card">
                        <div class="score-value">${analysis.speech_metrics?.pause_count || 0}</div>
                        <div class="summary-label">Pause Count</div>
                    </div>
                    <div class="score-card">
                        <div class="score-value">${analysis.speech_metrics?.total_words || 0}</div>
                        <div class="summary-label">Total Words</div>
                    </div>
                    <div class="score-card">
                        <div class="score-value">${analysis.speech_metrics?.clarity_score || 0}%</div>
                        <div class="summary-label">Clarity Score</div>
                    </div>
                </div>
            </div>
        `;

        // Speech insights
        if (analysis.speech_insights) {
            html += `
                <div class="speech-insights">
                    <h4>Speech Insights</h4>
                    <div class="insights-list">
            `;

            if (analysis.speech_insights.pacing_feedback) {
                html += `<div class="insight-item"><strong>Pacing:</strong> ${analysis.speech_insights.pacing_feedback}</div>`;
            }
            if (analysis.speech_insights.clarity_feedback) {
                html += `<div class="insight-item"><strong>Clarity:</strong> ${analysis.speech_insights.clarity_feedback}</div>`;
            }
            if (analysis.speech_insights.confidence_indicators) {
                html += `<div class="insight-item"><strong>Confidence:</strong> ${analysis.speech_insights.confidence_indicators}</div>`;
            }

            html += `
                    </div>
                </div>
            `;
        }
    }

    html += '</div>';

    speechResultsDiv.innerHTML = html;
}

// Add to your app.js
function updateDebugInfo(analysis) {
    document.getElementById('frameCount').textContent = analysis.frame_analysis?.total_frames || 0;
    document.getElementById('eyeContactFrames').textContent = analysis.frame_analysis?.eye_contact_frames || 0;
    document.getElementById('currentEyeContact').textContent = analysis.eye_contact ? 'Yes' : 'No';
    document.getElementById('detectionStatus').textContent = analysis.frame_analysis?.detection_status || 'Unknown';
}

// Call this in your real_time_analysis handler
socket.on('real_time_analysis', function(data) {
    displayRealTimeAnalysis(data);
    updateRealTimeFeedback(data.analysis);
    updateCharts(data.analysis);
    updateDebugInfo(data.analysis); // ADD THIS LINE
});

function showTemporaryMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `temp-message temp-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
        color: ${type === 'success' ? '#155724' : '#721c24'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

function updateStatus(message) {
    const statusElement = document.getElementById('status');
    typewriterEffect(statusElement, message, 20);
}

// Test function for speech analysis display
function testSpeechAnalysis() {
    const mockData = {
        analysis: {
            speech_metrics: {
                speech_rate: 150,
                pause_count: 8,
                total_words: 245,
                clarity_score: 85
            },
            speech_insights: {
                pacing_feedback: "Your speech rate is excellent - natural and conversational",
                clarity_feedback: "Clear articulation with good pronunciation",
                confidence_indicators: "Strong vocal presence and steady pacing"
            }
        }
    };

    displaySpeechAnalysis(mockData);
    console.log('✅ Speech analysis test data displayed');
}
