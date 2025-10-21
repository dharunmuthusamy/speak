// static/js/speech_recording.js - Speech Recording Functions

// Speech recording variables
let mediaRecorder = null;
let audioChunks = [];
let isRecordingSpeech = false;

// Real-time voice analysis variables
let audioContext = null;
let analyser = null;
let microphone = null;
let dataArray = null;
let realTimeInterval = null;
let isRealTimeActive = false;

// ==================== SPEECH RECORDING FUNCTIONS ====================

async function startSpeechRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            sendAudioToServer(audioBlob);
            // Stop all tracks to release microphone
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecordingSpeech = true;
        updateStatus('🎤 Recording speech... Click "Stop Speech" when done.');
        document.getElementById('startSpeechBtn').disabled = true;
        document.getElementById('stopSpeechBtn').disabled = false;
    } catch (error) {
        console.error('Error starting speech recording:', error);
        updateStatus('❌ Error accessing microphone: ' + error.message);
    }
}

function stopSpeechRecording() {
    if (mediaRecorder && isRecordingSpeech) {
        mediaRecorder.stop();
        isRecordingSpeech = false;
        updateStatus('⏹️ Speech recording stopped. Processing...');
        document.getElementById('startSpeechBtn').disabled = false;
        document.getElementById('stopSpeechBtn').disabled = true;
    }
}

function sendAudioToServer(audioBlob) {
    // Generate waveform visualization before sending
    generateWaveform(audioBlob);

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    fetch('/process_speech', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateStatus('✅ Speech processed successfully');
            displaySpeechAnalysis(data);
        } else {
            updateStatus('❌ Speech processing failed: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error sending audio:', error);
        updateStatus('❌ Error processing speech: ' + error.message);
    });
}

// ==================== REAL-TIME VOICE ANALYSIS FUNCTIONS ====================

async function initRealTimeVoice() {
    if (isRealTimeActive) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        analyser.fftSize = 2048;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        microphone.connect(analyser);

        isRealTimeActive = true;
        realTimeInterval = setInterval(updateRealTimeVoice, 100); // Update every 100ms
        console.log('Real-time voice analysis initialized');
    } catch (error) {
        console.error('Error initializing real-time voice:', error);
        updateStatus('❌ Error accessing microphone for real-time analysis: ' + error.message);
    }
}

function updateRealTimeVoice() {
    if (!analyser || !isRealTimeActive) return;

    analyser.getByteFrequencyData(dataArray);
    const volume = computeVolume(dataArray);
    const pitch = computePitch(dataArray);
    const isSpeaking = volume > -50; // Threshold for speaking detection

    // Update UI elements
    updateVoiceFeedback(volume, pitch, isSpeaking);

    // Emit to socket if available
    if (typeof socket !== 'undefined' && socket) {
        socket.emit('voice_real_time', {
            sessionId: currentSessionId,
            volume: volume,
            pitch: pitch,
            isSpeaking: isSpeaking,
            timestamp: Date.now()
        });
    }
}

function computeVolume(dataArray) {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    // Convert to dB scale
    return average > 0 ? 20 * Math.log10(average / 255) : -Infinity;
}

function computePitch(dataArray) {
    // Simple pitch estimation using autocorrelation
    let maxCorr = 0;
    let bestLag = 0;
    const sampleRate = audioContext.sampleRate;
    const bufferLength = dataArray.length;

    for (let lag = 20; lag < Math.min(bufferLength / 2, 1000); lag++) {
        let corr = 0;
        for (let i = 0; i < bufferLength - lag; i++) {
            corr += dataArray[i] * dataArray[i + lag];
        }
        if (corr > maxCorr) {
            maxCorr = corr;
            bestLag = lag;
        }
    }

    if (bestLag > 0) {
        return sampleRate / bestLag;
    }
    return 0; // No pitch detected
}

function updateVoiceFeedback(volume, pitch, isSpeaking) {
    // Update volume meter
    const volumeMeter = document.getElementById('volumeMeter');
    if (volumeMeter) {
        const percentage = Math.min(100, Math.max(0, (volume + 60) / 60 * 100)); // Map -60dB to 0dB to 0-100%
        volumeMeter.style.width = percentage + '%';
        volumeMeter.className = volume > -30 ? 'high' : volume > -45 ? 'medium' : 'low';
    }

    // Update speaking indicator
    const speakingIndicator = document.getElementById('speakingIndicator');
    if (speakingIndicator) {
        speakingIndicator.classList.toggle('active', isSpeaking);
    }

    // Update text displays
    const volumeDisplay = document.getElementById('voiceVolume');
    if (volumeDisplay) {
        volumeDisplay.textContent = volume.toFixed(1) + ' dB';
    }

    const pitchDisplay = document.getElementById('voicePitch');
    if (pitchDisplay) {
        pitchDisplay.textContent = pitch > 0 ? pitch.toFixed(0) + ' Hz' : 'N/A';
    }
}

function stopRealTimeVoice() {
    if (realTimeInterval) {
        clearInterval(realTimeInterval);
        realTimeInterval = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }
    analyser = null;
    isRealTimeActive = false;
    console.log('Real-time voice analysis stopped');
}

function generateWaveform(audioBlob) {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;

    const canvasCtx = canvas.getContext('2d');
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    audioBlob.arrayBuffer().then(arrayBuffer => {
        audioContext.decodeAudioData(arrayBuffer).then(audioBuffer => {
            const channelData = audioBuffer.getChannelData(0);
            const width = canvas.width;
            const height = canvas.height;
            const step = Math.ceil(channelData.length / width);
            const amp = height / 2;

            canvasCtx.fillStyle = 'rgb(200, 200, 200)';
            canvasCtx.fillRect(0, 0, width, height);
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = 'rgb(0, 123, 255)';
            canvasCtx.beginPath();

            for (let i = 0; i < width; i++) {
                let min = 1.0;
                let max = -1.0;
                for (let j = 0; j < step; j++) {
                    const datum = channelData[(i * step) + j];
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }
                canvasCtx.moveTo(i, (1 + min) * amp);
                canvasCtx.lineTo(i, (1 + max) * amp);
            }
            canvasCtx.stroke();
        });
    });
}

// Expose real-time update function
function realTimeVoiceUpdate() {
    updateRealTimeVoice();
}
