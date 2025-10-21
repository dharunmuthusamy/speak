import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RotateCcw, Eye, CheckCircle } from 'lucide-react';
import Header from './Header';
import CameraControl from './CameraControl';
import VideoSection from './VideoSection';
import AIFeedback from './AIFeedback';
import AnalysisResults from './AnalysisResults';

import Visualizations from './Visualizations';
import SessionControls from './SessionControls';
import { eyeTrackingService } from '@/services/eyeTracking';
import { speechAnalysisService } from '@/services/speechAnalysis';
import { websocketService } from '@/services/websocket';
import SessionUtils from '@/utils/sessionUtils';
import { usePracticeSession } from '@/contexts/PracticeSessionContext';

interface MainPageProps {
  onViewRecords: () => void;
}

const MainPage: React.FC<MainPageProps> = ({ onViewRecords }) => {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [showStartSession, setShowStartSession] = useState(false);
  const [showStopSession, setShowStopSession] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionStopped, setSessionStopped] = useState(false);
  const [isEyeTrackingInitialized, setIsEyeTrackingInitialized] = useState(false);

  const [analysis, setAnalysis] = useState<any>(null);
  const [aiFeedback, setAiFeedback] = useState<any>(null);
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState<boolean>(false);
  const [aiFeedbackError, setAiFeedbackError] = useState<string>('');

  const [error, setError] = useState<string>('');
  const [showRules, setShowRules] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    websocketService.connect('http://localhost:5000').catch(err => {
      setError('Failed to connect to server: ' + err.message);
    });

    // Set up WebSocket event listeners
    websocketService.on('session_started', (data) => {
      setSessionId(data.session_id);
      setIsSessionActive(true);
      // Stop session button will be shown after 10 seconds in startSession
    });

    websocketService.on('session_stopped', (data) => {
      setIsSessionActive(false);
      setSessionStopped(true);
      setShowStopSession(false);
    });



    websocketService.on('analysis_complete', (data) => {
      setAnalysis(data.analysis);
      // Start AI feedback loading when analysis completes
      setAiFeedbackLoading(true);
      setAiFeedbackError('');
    });

    websocketService.on('ai_feedback_complete', (data) => {
      setAiFeedback(data.ai_feedback);
      setAiFeedbackLoading(false);
      setAiFeedbackError('');
    });

    websocketService.on('ai_feedback_error', (data) => {
      setAiFeedbackError(data.error || 'AI feedback generation failed');
      setAiFeedbackLoading(false);
    });

    return () => {
      websocketService.disconnect();
      eyeTrackingService.cleanup();
      speechAnalysisService.cleanup();
    };
  }, []);

  const startRecord = async () => {
    try {
      setError('');
      if (videoRef.current) {
        await eyeTrackingService.initialize(videoRef.current, canvasRef.current);
        setIsEyeTrackingInitialized(true);
      }
      await speechAnalysisService.initialize();
      setIsRecording(true);
      setShowStartSession(true);
      setShowRules(false); // Hide rules when recording starts
    } catch (err: any) {
      setError('Failed to start recording: ' + err.message);
    }
  };

  const stopRecord = () => {
    setIsRecording(false);
    setShowStartSession(false);
    eyeTrackingService.stopTracking();
    speechAnalysisService.stopVoiceMonitoring();

    // Stop the camera and microphone streams
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    // Cleanup services
    eyeTrackingService.cleanup();
    speechAnalysisService.cleanup();
  };

  const startSession = async () => {
    try {
      setError('');
      const newSessionId = SessionUtils.generateSessionId();

      // Ensure eye tracking is initialized
      if (videoRef.current) {
        await eyeTrackingService.initialize(videoRef.current, canvasRef.current);
      }

      // Start WebSocket session
      websocketService.startSession({ session_id: newSessionId });

      // Start eye tracking
      eyeTrackingService.startTracking((data) => {
        // Send frame to backend via WebSocket
        if (videoRef.current && canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            websocketService.processFrame({
              session_id: newSessionId,
              image_data: imageData
            });
          }
        }
      });

      // Start speech monitoring
      speechAnalysisService.startVoiceMonitoring((volume, pitch, timestamp) => {
        websocketService.sendVoiceData(newSessionId, volume, pitch, timestamp);
      });

      // Hide stop record button when session starts
      setShowStartSession(false);
      setIsSessionActive(true);

      // Show stop session after 10 seconds
      setTimeout(() => {
        setShowStopSession(true);
      }, 10000);

    } catch (err: any) {
      setError('Failed to start session: ' + err.message);
    }
  };

  const stopSession = () => {
    if (sessionId) {
      websocketService.stopSession({ session_id: sessionId });
      eyeTrackingService.stopTracking();
      speechAnalysisService.stopVoiceMonitoring();
    }
    // Stop recording and hide start session button, similar to stopRecord
    setIsRecording(false);
    setShowStartSession(false);
    // Stop the camera and microphone streams
    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      videoRef.current.srcObject = null;
      videoRef.current.pause();
      videoRef.current.load(); // Reset the video element to clear any cached content
    }
    // Cleanup services
    eyeTrackingService.cleanup();
    speechAnalysisService.cleanup();
  };

  const analyzeSession = () => {
    if (sessionId) {
      websocketService.analyzeSession({ session_id: sessionId });
      // AI feedback will be automatically triggered after analysis completes
    }
  };

  const getAIFeedback = () => {
    if (sessionId) {
      websocketService.emit('get_ai_feedback', { session_id: sessionId });
    }
  };

  const calibrate = () => {
    eyeTrackingService.reset();
    websocketService.resetTracker();
  };

  const newSession = () => {
    // Reset all state
    setIsRecording(false);
    setIsSessionActive(false);
    setShowStartSession(false);
    setShowStopSession(false);
    setSessionId('');
    setSessionStopped(false);
    setIsEyeTrackingInitialized(false);

    setAnalysis(null);
    setAiFeedback(null);
    setAiFeedbackLoading(false);
    setAiFeedbackError('');

    setError('');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Header />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <CameraControl
        isRecording={isRecording}
        isSessionActive={isSessionActive}
        showStartSession={showStartSession}
        showStopSession={showStopSession}
        sessionStopped={sessionStopped}
        onStartRecord={startRecord}
        onStopRecord={stopRecord}
        onStartSession={startSession}
        onStopSession={stopSession}
        onAnalyze={analyzeSession}
        onCalibrate={calibrate}
      />

      <VideoSection isActive={isRecording || isSessionActive} videoRef={videoRef} canvasRef={canvasRef} />

      {showRules && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Recording Guidelines
          </h3>
          <div className="space-y-3 text-sm text-blue-800">
            <div className="flex items-start gap-3">
              <span className="font-semibold text-blue-600 min-w-[1.5rem]">1.</span>
              <span>Ensure you are in a quiet, private environment to prevent background noise from interfering with the voice analysis and to protect the privacy of others who are not involved.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-blue-600 min-w-[1.5rem]">2.</span>
              <span>Position your webcam at eye level and look directly into the camera lens when speaking, as this is how the system will measure your eye contact with the virtual audience.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-blue-600 min-w-[1.5rem]">3.</span>
              <span>Use the best microphone available to you, speaking clearly and at a consistent volume to ensure the voice analysis for pace, tone, and clarity is accurate and reliable.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-blue-600 min-w-[1.5rem]">4.</span>
              <span>Sit or stand with your face and upper body centered in the frame, maintaining a neutral and uncluttered background so the software can track your movements and focus without visual distraction.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-blue-600 min-w-[1.5rem]">5.</span>
              <span>Ensure your face is evenly lit from the front, avoiding strong backlighting from a window or lamp behind you, which would create shadows and hinder the eye contact estimation.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-blue-600 min-w-[1.5rem]">6.</span>
              <span>Before starting the official evaluation, complete a short test to verify your audio is clear, your video is smooth, and you are correctly framed within the application's preview window.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-blue-600 min-w-[1.5rem]">7.</span>
              <span>You must explicitly agree to the terms of service and data handling policy, which should explain how your recording and analysis data will be used, stored, and protected, before you begin.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-blue-600 min-w-[1.5rem]">8.</span>
              <span>Use the recording and its analysis solely for your personal development or the intended evaluation purpose, respecting the platform's terms of use and not redistributing the content without authorization.</span>
            </div>
          </div>
        </div>
      )}

      {analysis && <Visualizations analysis={analysis} />}

      {(aiFeedback || aiFeedbackLoading || aiFeedbackError) && (
        <AIFeedback
          aiFeedback={aiFeedback}
          isLoading={aiFeedbackLoading}
          error={aiFeedbackError}
        />
      )}

      <div className="flex justify-center gap-4">
        {sessionId && (
          <Button onClick={() => navigate(`/session-details/${sessionId}`)} size="lg" className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            View Session Details
          </Button>
        )}
        <Button onClick={newSession} size="lg" className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5" />
          New Session
        </Button>
      </div>
    </div>
  );
};

export default MainPage;
