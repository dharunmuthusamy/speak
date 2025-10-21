export interface SpeechAnalysisData {
  text: string;
  word_count: number;
  duration_seconds: number;
  wpm: number;
  grammar_errors: number;
  spelling_errors: number;
  total_errors: number;
  accuracy_score: number;
  error_details: Array<{
    type: string;
    message: string;
    suggestion: string;
    word: string;
  }>;
}

export interface VoiceMetrics {
  average_volume: number;
  max_volume: number;
  min_volume: number;
  volume_variance: number;
  average_pitch: number;
  pitch_range: number;
  voice_data_points: number;
  voice_duration_seconds: number;
}

class SpeechAnalysisService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timeDomainAnalyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;

  // Voice monitoring
  private voiceData: Array<{ timestamp: number; volume: number; pitch: number }> = [];
  private monitoringInterval: number | null = null;
  private onVoiceDataCallback?: (volume: number, pitch: number, timestamp: number) => void;

  // Smoothing and peak detection
  private _smoothedVolume: number = 0;
  private smoothedPitch: number = 0;
  private volumeAlpha: number = 0.3; // Smoothing factor (0.1 = very smooth, 0.9 = responsive)
  private pitchAlpha: number = 0.2;
  private speakingThreshold: number = 5; // Minimum volume to be considered speaking
  private speakingHoldTime: number = 500; // ms to hold speaking status after volume drops
  private lastSpeakingTime: number = 0;
  private isCurrentlySpeaking: boolean = false;
  private peakVolume: number = 0;
  private peakHoldTime: number = 1000; // ms to hold peak value
  private lastPeakTime: number = 0;

  async initialize(): Promise<void> {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });

      // Set up audio context for real-time analysis
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.timeDomainAnalyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);

      this.analyser.fftSize = 256;
      this.timeDomainAnalyser.fftSize = 256;
      this.microphone.connect(this.analyser);
      this.microphone.connect(this.timeDomainAnalyser);

      console.log('🎤 Speech analysis initialized');
    } catch (error) {
      console.error('Failed to initialize microphone:', error);
      throw new Error('Microphone access denied or unavailable');
    }
  }

  startRecording(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.stream) {
        reject(new Error('Speech analysis not initialized'));
        return;
      }

      try {
        this.audioChunks = [];
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType: 'audio/webm;codecs=opus'
        });

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          console.log('🎤 Recording stopped');
        };

        this.mediaRecorder.start(1000); // Collect data every second
        this.isRecording = true;

        console.log('🎤 Recording started');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('Not currently recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.isRecording = false;
        console.log('🎤 Recording stopped, audio blob created');
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  startVoiceMonitoring(callback?: (volume: number, pitch: number, timestamp: number) => void): void {
    if (!this.analyser || !this.timeDomainAnalyser) return;

    this.onVoiceDataCallback = callback;
    this.voiceData = [];

    // Reset smoothing values
    this._smoothedVolume = 0;
    this.smoothedPitch = 0;
    this.isCurrentlySpeaking = false;
    this.lastSpeakingTime = 0;
    this.peakVolume = 0;
    this.lastPeakTime = 0;

    const bufferLength = this.analyser.frequencyBinCount;
    const freqDataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(bufferLength);

    this.monitoringInterval = window.setInterval(() => {
      this.analyser!.getByteFrequencyData(freqDataArray);
      this.timeDomainAnalyser!.getByteTimeDomainData(timeDataArray);

      // Calculate raw volume (RMS from time domain data for better accuracy)
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const sample = (timeDataArray[i] - 128) / 128; // Convert to -1 to 1 range
        sum += sample * sample;
      }
      const rawVolume = Math.sqrt(sum / bufferLength) * 100; // Scale to 0-100

      // Estimate pitch using autocorrelation (better than dominant frequency)
      const rawPitch = this.calculatePitch(timeDataArray, this.audioContext!.sampleRate);

      // Apply exponential moving average smoothing
      this._smoothedVolume = this.volumeAlpha * rawVolume + (1 - this.volumeAlpha) * this._smoothedVolume;
      this.smoothedPitch = this.pitchAlpha * rawPitch + (1 - this.pitchAlpha) * this.smoothedPitch;

      // Update peak volume with hold/release
      const currentTime = Date.now();
      if (this._smoothedVolume > this.peakVolume) {
        this.peakVolume = this._smoothedVolume;
        this.lastPeakTime = currentTime;
      } else if (currentTime - this.lastPeakTime > this.peakHoldTime) {
        // Release peak gradually
        this.peakVolume = Math.max(this._smoothedVolume, this.peakVolume * 0.95);
      }

      // Determine speaking status with hysteresis
      const isAboveThreshold = this._smoothedVolume > this.speakingThreshold;
      if (isAboveThreshold) {
        this.isCurrentlySpeaking = true;
        this.lastSpeakingTime = currentTime;
      } else if (currentTime - this.lastSpeakingTime > this.speakingHoldTime) {
        this.isCurrentlySpeaking = false;
      }

      const timestamp = currentTime;
      const voicePoint = { timestamp, volume: this._smoothedVolume, pitch: this.smoothedPitch };

      this.voiceData.push(voicePoint);

      if (this.onVoiceDataCallback) {
        this.onVoiceDataCallback(this._smoothedVolume, this.smoothedPitch, timestamp);
      }
    }, 50); // Monitor every 50ms for smoother updates
  }

  private calculatePitch(timeData: Uint8Array, sampleRate: number): number {
    // Simple autocorrelation-based pitch detection
    const bufferLength = timeData.length;
    const correlations = new Array(bufferLength / 2);

    // Calculate autocorrelation
    for (let lag = 0; lag < correlations.length; lag++) {
      let sum = 0;
      for (let i = 0; i < bufferLength - lag; i++) {
        sum += (timeData[i] - 128) * (timeData[i + lag] - 128);
      }
      correlations[lag] = sum;
    }

    // Find the first peak after the initial drop
    let maxCorrelation = 0;
    let bestLag = 0;
    for (let lag = 20; lag < correlations.length; lag++) { // Start from lag 20 to avoid DC component
      if (correlations[lag] > maxCorrelation) {
        maxCorrelation = correlations[lag];
        bestLag = lag;
      }
    }

    // Convert lag to frequency (pitch)
    if (bestLag > 0) {
      return sampleRate / bestLag;
    }

    return 0; // No pitch detected
  }

  stopVoiceMonitoring(): VoiceMetrics | null {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.voiceData.length === 0) return null;

    const volumes = this.voiceData.map(d => d.volume);
    const pitches = this.voiceData.map(d => d.pitch);

    const voiceMetrics: VoiceMetrics = {
      average_volume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
      max_volume: Math.max(...volumes),
      min_volume: Math.min(...volumes),
      volume_variance: volumes.reduce((acc, vol) => {
        const diff = vol - (volumes.reduce((a, b) => a + b, 0) / volumes.length);
        return acc + diff * diff;
      }, 0) / volumes.length,
      average_pitch: pitches.reduce((a, b) => a + b, 0) / pitches.length,
      pitch_range: Math.max(...pitches) - Math.min(...pitches),
      voice_data_points: this.voiceData.length,
      voice_duration_seconds: this.voiceData.length > 1
        ? (this.voiceData[this.voiceData.length - 1].timestamp - this.voiceData[0].timestamp) / 1000
        : 0
    };

    return voiceMetrics;
  }

  // Convert blob to base64 for sending to backend
  blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Simulate speech analysis (in real implementation, this would come from backend)
  simulateAnalysis(audioBlob: Blob): Promise<SpeechAnalysisData> {
    return new Promise((resolve) => {
      // Simulate processing delay
      setTimeout(() => {
        const mockAnalysis: SpeechAnalysisData = {
          text: "This is a sample transcription of the speech that was recorded during the practice session.",
          word_count: 14,
          duration_seconds: Math.random() * 30 + 10, // 10-40 seconds
          wpm: Math.floor(Math.random() * 100) + 100, // 100-200 WPM
          grammar_errors: Math.floor(Math.random() * 3),
          spelling_errors: Math.floor(Math.random() * 2),
          total_errors: 0, // Will be calculated
          accuracy_score: Math.floor(Math.random() * 40) + 60, // 60-100%
          error_details: []
        };

        mockAnalysis.total_errors = mockAnalysis.grammar_errors + mockAnalysis.spelling_errors;

        // Add some mock error details
        if (mockAnalysis.grammar_errors > 0) {
          mockAnalysis.error_details.push({
            type: 'Grammar',
            message: 'Subject-verb agreement error',
            suggestion: 'Use "is" instead of "are" for singular subjects',
            word: 'are'
          });
        }

        if (mockAnalysis.spelling_errors > 0) {
          mockAnalysis.error_details.push({
            type: 'Spelling',
            message: 'Common misspelling detected',
            suggestion: 'Correct spelling: "receive"',
            word: 'recieve'
          });
        }

        resolve(mockAnalysis);
      }, 2000); // 2 second delay
    });
  }

  cleanup(): void {
    this.stopVoiceMonitoring();

    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.mediaRecorder = null;
    this.analyser = null;
    this.timeDomainAnalyser = null;
    this.microphone = null;
    this.audioChunks = [];
    this.voiceData = [];
    this.onVoiceDataCallback = undefined;

    // Reset smoothing values
    this._smoothedVolume = 0;
    this.smoothedPitch = 0;
    this.isCurrentlySpeaking = false;
    this.lastSpeakingTime = 0;
    this.peakVolume = 0;
    this.lastPeakTime = 0;

    console.log('🎤 Speech analysis cleaned up');
  }

  get isInitialized(): boolean {
    return this.stream !== null && this.audioContext !== null;
  }

  get isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  get voiceDataPoints(): number {
    return this.voiceData.length;
  }

  // Public getter for smoothed volume
  get smoothedVolume(): number {
    return this._smoothedVolume;
  }
}

// Export singleton instance
export const speechAnalysisService = new SpeechAnalysisService();
export default speechAnalysisService;
