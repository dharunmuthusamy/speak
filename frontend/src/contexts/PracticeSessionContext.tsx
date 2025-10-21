import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { websocketService } from '../services/websocket';
import { eyeTrackingService, EyeTrackingData } from '../services/eyeTracking';
import { speechAnalysisService, SpeechAnalysisData, VoiceMetrics } from '../services/speechAnalysis';
import { sessionsAPI, eyeTrackingAPI, speechAnalysisAPI } from '../services/api';
import { useAuth } from './AuthContext';
import SessionUtils from '../utils/sessionUtils';

interface PracticeSession {
  id?: number;
  session_id: string;
  title?: string;
  session_type?: string;
  start_time?: string;
  end_time?: string;
  duration?: number;
  total_score?: number;
}

interface RealTimeAnalysis {
  eye_contact: boolean;
  eye_contact_percentage: number;
  speech_accuracy?: number;
  engagement_score?: number;
  voice_volume?: number;
  voice_pitch?: number;
  speaking_status?: boolean;
}

interface PracticeSessionContextType {
  // Session state
  currentSession: PracticeSession | null;
  isSessionActive: boolean;
  sessionDuration: number;
  realTimeAnalysis: RealTimeAnalysis | null;

  // Eye tracking state
  eyeTrackingData: EyeTrackingData | null;
  isEyeTrackingActive: boolean;

  // Speech analysis state
  speechAnalysisData: SpeechAnalysisData | null;
  isSpeechRecording: boolean;
  voiceMetrics: VoiceMetrics | null;

  // AI feedback state
  aiFeedback: string;
  analysisResults: string;
  isAnalyzing: boolean;

  // Error handling state
  error: string | null;
  retryCount: number;
  isRetrying: boolean;

  // Actions
  startSession: (sessionData?: Partial<PracticeSession>) => Promise<void>;
  stopSession: () => Promise<void>;
  initializeMedia: () => Promise<void>;
  initializeMediaWithVideo: (videoElement: HTMLVideoElement) => Promise<void>;
  startEyeTracking: () => Promise<void>;
  stopEyeTracking: () => void;
  startSpeechRecording: () => Promise<void>;
  stopSpeechRecording: () => Promise<void>;
  analyzeSession: () => Promise<void>;
  cleanup: () => void;
  retryOperation: () => Promise<void>;
}

const PracticeSessionContext = createContext<PracticeSessionContextType | undefined>(undefined);

export const usePracticeSession = () => {
  const context = useContext(PracticeSessionContext);
  if (context === undefined) {
    throw new Error('usePracticeSession must be used within a PracticeSessionProvider');
  }
  return context;
};

interface PracticeSessionProviderProps {
  children: ReactNode;
}

export const PracticeSessionProvider: React.FC<PracticeSessionProviderProps> = ({ children }) => {
  const { user } = useAuth();

  // Session state
  const [currentSession, setCurrentSession] = useState<PracticeSession | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [realTimeAnalysis, setRealTimeAnalysis] = useState<RealTimeAnalysis | null>(null);

  // Eye tracking state
  const [eyeTrackingData, setEyeTrackingData] = useState<EyeTrackingData | null>(null);
  const [isEyeTrackingActive, setIsEyeTrackingActive] = useState(false);

  // Speech analysis state
  const [speechAnalysisData, setSpeechAnalysisData] = useState<SpeechAnalysisData | null>(null);
  const [isSpeechRecording, setIsSpeechRecording] = useState(false);
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);

  // AI feedback state
  const [aiFeedback, setAiFeedback] = useState('');
  const [analysisResults, setAnalysisResults] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Error handling state
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isSessionActive && sessionStartTime) {
      interval = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSessionActive, sessionStartTime]);

  // WebSocket event handlers
  useEffect(() => {
    const handleSessionStarted = (data: any) => {
      console.log('Session started:', data);
      setIsSessionActive(true);
      setSessionStartTime(Date.now());
    };

    const handleSessionStopped = (data: any) => {
      console.log('Session stopped:', data);
      setIsSessionActive(false);
      setSessionDuration(0);
      setSessionStartTime(null);
    };

    const handleRealTimeAnalysis = (data: any) => {
      setRealTimeAnalysis({
        eye_contact: data.analysis.eye_contact,
        eye_contact_percentage: data.analysis.eye_contact_percentage,
        speech_accuracy: speechAnalysisData?.accuracy_score,
        engagement_score: calculateEngagementScore(data.analysis.eye_contact_percentage, speechAnalysisData?.accuracy_score)
      });
    };

    const handleSpeechAnalysisComplete = (data: any) => {
      setSpeechAnalysisData(data.analysis);
      console.log('Speech analysis complete:', data.analysis);
    };

    const handleAnalysisComplete = (data: any) => {
      console.log('Session analysis complete:', data.analysis);
      setAiFeedback(data.feedback || '');
      setAnalysisResults(data.results || '');
      setIsAnalyzing(false);
      // Update session with final analysis
      if (currentSession) {
        const engagementScore: number = Number(data.analysis.overall_engagement) || 0;
        setCurrentSession(prev => prev ? {
          ...prev,
          total_score: engagementScore
        } : null);
      }
    };

    const handleVoiceUpdate = (data: any) => {
      // Update real-time voice metrics
      setVoiceMetrics(prev => ({
        ...prev,
        average_volume: data.voice_volume || 0,
        average_pitch: data.voice_pitch || 0,
        voice_data_points: (prev?.voice_data_points || 0) + 1,
        voice_duration_seconds: (prev?.voice_duration_seconds || 0) + 0.1 // Approximate 100ms intervals
      }));

      // Update real-time analysis with voice data
      setRealTimeAnalysis(prev => ({
        ...prev,
        voice_volume: data.voice_volume || 0,
        voice_pitch: data.voice_pitch || 0,
        speaking_status: data.speaking_status || false
      }));
    };

    // Register event listeners
    websocketService.on('session_started', handleSessionStarted);
    websocketService.on('session_stopped', handleSessionStopped);
    websocketService.on('real_time_analysis', handleRealTimeAnalysis);
    websocketService.on('speech_analysis_complete', handleSpeechAnalysisComplete);
    websocketService.on('analysis_complete', handleAnalysisComplete);
    websocketService.on('voice_update', handleVoiceUpdate);

    return () => {
      // Cleanup event listeners
      websocketService.off('session_started', handleSessionStarted);
      websocketService.off('session_stopped', handleSessionStopped);
      websocketService.off('real_time_analysis', handleRealTimeAnalysis);
      websocketService.off('speech_analysis_complete', handleSpeechAnalysisComplete);
      websocketService.off('analysis_complete', handleAnalysisComplete);
      websocketService.off('voice_update', handleVoiceUpdate);
    };
  }, [currentSession, speechAnalysisData]);

  const calculateEngagementScore = (eyeContactPercent: number, speechAccuracy?: number): number => {
    const eyeWeight = 0.4;
    const speechWeight = 0.6;

    const eyeScore = eyeContactPercent;
    const speechScore = speechAccuracy || 0;

    return Math.round(eyeScore * eyeWeight + speechScore * speechWeight);
  };

  const startSession = async (sessionData: Partial<PracticeSession> = {}) => {
    try {
      setError(null);
      setRetryCount(0);

      // Generate consistent session ID
      const sessionId = sessionData.session_id || SessionUtils.generateSessionId();

      // Create session in database
      const response = await sessionsAPI.createSession({
        title: sessionData.title || 'Practice Session',
        session_type: sessionData.session_type || 'general',
        session_id: sessionId
      });

      const session = response.data.session;
      setCurrentSession(session);

      // Connect to WebSocket if not connected
      if (!websocketService.isConnected) {
        await websocketService.connect();
      }

      // Start WebSocket session
      websocketService.startSession({
        session_id: session.session_id,
        user_id: user?.id.toString()
      });

    } catch (error) {
      console.error('Failed to start session:', error);
      setError('Failed to start session. Please try again.');
      throw error;
    }
  };

  const stopSession = async () => {
    if (!currentSession) return;

    try {
      setError(null);

      // Stop WebSocket session
      websocketService.stopSession({ session_id: currentSession.session_id });

      // Update session in database
      await sessionsAPI.updateSession(currentSession.id!, {
        end_time: new Date().toISOString(),
        duration: sessionDuration,
        total_score: (realTimeAnalysis?.engagement_score || 0).toString()
      });

      // Stop media tracking
      stopEyeTracking();
      if (isSpeechRecording) {
        await stopSpeechRecording();
      }

      setCurrentSession(null);
      setRealTimeAnalysis(null);

    } catch (error) {
      console.error('Failed to stop session:', error);
      setError('Failed to stop session. Please try again.');
      throw error;
    }
  };

  const initializeMedia = async () => {
    try {
      // Initialize camera for eye tracking
      const videoElement = document.createElement('video');
      videoElement.style.display = 'none';
      document.body.appendChild(videoElement);

      await eyeTrackingService.initialize(videoElement);

      // Initialize microphone for speech analysis
      await speechAnalysisService.initialize();

      console.log('Media initialized successfully');
    } catch (error) {
      console.error('Failed to initialize media:', error);
      throw error;
    }
  };

  const startEyeTracking = async () => {
    if (!currentSession) return;

    try {
      eyeTrackingService.startTracking((data) => {
        setEyeTrackingData(data);

        // Send frame to backend via WebSocket
        const videoElement = document.querySelector('video') as HTMLVideoElement;
        if (videoElement && websocketService.isConnected) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            ctx.drawImage(videoElement, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);

            websocketService.processFrame({
              session_id: currentSession.session_id,
              image_data: imageData
            });
          }
        }

        // Store eye tracking data in database periodically
        if (Math.random() < 0.1) { // Store ~10% of frames
          eyeTrackingAPI.storeData({
            session_id: currentSession.id!,
            eye_contact_score: data.eye_contact ? 100 : 0,
            focus_consistency: data.eye_contact_percentage,
            blink_rate: data.blink_count,
            total_eye_contact_time: data.total_eye_contact_time,
            gaze_points: {
              x: data.gaze_direction.x,
              y: data.gaze_direction.y,
              timestamp: Date.now()
            },
            engagement_level: data.eye_contact_percentage > 70 ? 'High' :
                            data.eye_contact_percentage > 40 ? 'Moderate' : 'Low',
            gaze_stability: data.eye_contact_percentage > 60 ? 'Stable' : 'Moderate'
          }).catch(err => console.error('Failed to store eye tracking data:', err));
        }
      });

      setIsEyeTrackingActive(true);
      console.log('Eye tracking started');
    } catch (error) {
      console.error('Failed to start eye tracking:', error);
      throw error;
    }
  };

  const stopEyeTracking = () => {
    eyeTrackingService.stopTracking();
    setIsEyeTrackingActive(false);
    setEyeTrackingData(null);
    console.log('Eye tracking stopped');
  };

  const startSpeechRecording = async () => {
    if (!currentSession) return;

    try {
      await speechAnalysisService.startRecording();

      // Start voice monitoring
      speechAnalysisService.startVoiceMonitoring((volume, pitch, timestamp) => {
        // Send voice data to WebSocket
        if (websocketService.isConnected) {
          websocketService.sendVoiceData(currentSession.session_id, volume, pitch, timestamp);
        }
      });

      setIsSpeechRecording(true);
      websocketService.startSpeech({ session_id: currentSession.session_id });

      console.log('Speech recording started');
    } catch (error) {
      console.error('Failed to start speech recording:', error);
      throw error;
    }
  };

  const stopSpeechRecording = async () => {
    if (!currentSession) return;

    try {
      const audioBlob = await speechAnalysisService.stopRecording();
      const voiceMetricsData = speechAnalysisService.stopVoiceMonitoring();

        setVoiceMetrics(voiceMetricsData || null);
      setIsSpeechRecording(false);

      websocketService.stopSpeech({ session_id: currentSession.session_id });

      // Convert blob to base64 and send to backend
      const audioBase64 = await speechAnalysisService.blobToBase64(audioBlob);

      // Send audio to WebSocket for analysis
      websocketService.uploadAudio(currentSession.session_id, audioBase64);

      // Also store in database
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      speechAnalysisAPI.uploadAudio(currentSession.id!, new File([audioBlob], 'recording.webm', { type: 'audio/webm' }))
        .catch(err => console.error('Failed to upload audio to API:', err));

      console.log('Speech recording stopped');
    } catch (error) {
      console.error('Failed to stop speech recording:', error);
      throw error;
    }
  };

  const analyzeSession = async () => {
    if (!currentSession) return;

    try {
      setIsAnalyzing(true);
      websocketService.analyzeSession({ session_id: currentSession.session_id });
    } catch (error) {
      console.error('Failed to analyze session:', error);
      setIsAnalyzing(false);
      throw error;
    }
  };

  const initializeMediaWithVideo = async (videoElement: HTMLVideoElement) => {
    try {
      await eyeTrackingService.initialize(videoElement);
      await speechAnalysisService.initialize();
      console.log('Media initialized successfully with video element');
    } catch (error) {
      console.error('Failed to initialize media:', error);
      throw error;
    }
  };

  const retryOperation = async () => {
    if (!error || retryCount >= 3) return;

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    try {
      // Retry the last failed operation
      if (error.includes('start session')) {
        await startSession();
      } else if (error.includes('stop session')) {
        await stopSession();
      }
      setError(null);
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  };

  const cleanup = () => {
    stopEyeTracking();
    speechAnalysisService.cleanup();
    websocketService.disconnect();

    setCurrentSession(null);
    setIsSessionActive(false);
    setSessionDuration(0);
    setSessionStartTime(null);
    setRealTimeAnalysis(null);
    setEyeTrackingData(null);
    setSpeechAnalysisData(null);
    setVoiceMetrics(null);
    setAiFeedback('');
    setAnalysisResults('');
    setIsAnalyzing(false);
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);
  };

  const value: PracticeSessionContextType = {
    currentSession,
    isSessionActive,
    sessionDuration,
    realTimeAnalysis,
    eyeTrackingData,
    isEyeTrackingActive,
    speechAnalysisData,
    isSpeechRecording,
    voiceMetrics,
    aiFeedback,
    analysisResults,
    isAnalyzing,
    error,
    retryCount,
    isRetrying,
    startSession,
    stopSession,
    initializeMedia,
    initializeMediaWithVideo,
    startEyeTracking,
    stopEyeTracking,
    startSpeechRecording,
    stopSpeechRecording,
    analyzeSession,
    cleanup,
    retryOperation,
  };

  return (
    <PracticeSessionContext.Provider value={value}>
      {children}
    </PracticeSessionContext.Provider>
  );
};
