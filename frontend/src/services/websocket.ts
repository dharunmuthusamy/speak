import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Event listeners
  private eventListeners: { [event: string]: ((data: any) => void)[] } = {};

  connect(url: string = 'http://localhost:5000'): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
      });

      this.socket.on('connect', () => {
        console.log('🔌 Connected to WebSocket server');
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from WebSocket server:', reason);
        this.handleReconnect();
      });

      this.socket.on('connect_error', (error) => {
        console.error('🔌 WebSocket connection error:', error);
        this.handleReconnect();
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(error);
        }
      });

      // Set up event forwarding
      this.setupEventForwarding();
    });
  }

  private setupEventForwarding() {
    if (!this.socket) return;

    // Forward all server events to registered listeners
    const events = [
      'connected',
      'session_started',
      'session_stopped',
      'real_time_analysis',
      'speech_started',
      'speech_stopped',
      'speech_analysis_complete',
      'speech_error',
      'analysis_complete',
      'analysis_error',
      'ai_feedback_complete',
      'ai_feedback_error',
      'calibration_complete',
      'tracker_reset',
      'debug_info',
      'voice_update'
    ];

    events.forEach(event => {
      this.socket.on(event, (data) => {
        this.notifyListeners(event, data);
      });
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      setTimeout(() => {
        if (this.socket && !this.socket.connected) {
          this.socket.connect();
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('🔌 Manually disconnected from WebSocket server');
    }
  }

  // Send events to server
  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('🔌 Cannot emit event: WebSocket not connected', event);
    }
  }

  // Register event listeners
  on(event: string, callback: (data: any) => void) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  // Remove event listeners
  off(event: string, callback?: (data: any) => void) {
    if (!this.eventListeners[event]) return;

    if (callback) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    } else {
      delete this.eventListeners[event];
    }
  }

  private notifyListeners(event: string, data: any) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  // Session management
  startSession(sessionData: { session_id?: string; user_id?: string }) {
    this.emit('start_session', sessionData);
  }

  stopSession(sessionData: { session_id: string }) {
    this.emit('stop_session', sessionData);
  }

  // Real-time data processing
  processFrame(frameData: { session_id: string; image_data: string }) {
    this.emit('process_frame', frameData);
  }

  // Speech analysis
  startSpeech(sessionData: { session_id: string }) {
    this.emit('start_speech', sessionData);
  }

  stopSpeech(sessionData: { session_id: string }) {
    this.emit('stop_speech', sessionData);
  }

  uploadAudio(sessionId: string, audioData: string) {
    this.emit('upload_audio', { session_id: sessionId, audio_data: audioData });
  }

  // Analysis
  analyzeSession(sessionData: { session_id: string }) {
    this.emit('analyze_session', sessionData);
  }

  // Voice real-time
  sendVoiceData(sessionId: string, volume: number, pitch: number, timestamp?: number) {
    this.emit('voice_real_time', {
      session_id: sessionId,
      volume,
      pitch,
      timestamp: timestamp || Date.now()
    });
  }

  // Calibration and debugging
  calibrateTracker() {
    this.emit('calibrate_tracker', {});
  }

  resetTracker() {
    this.emit('reset_tracker', {});
  }

  getDebugInfo() {
    this.emit('get_debug_info', {});
  }

  // Connection status
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  get connectionState(): string {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected) return 'connected';
    if (this.socket.disconnected) return 'disconnected';
    return 'connecting';
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;
