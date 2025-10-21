import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Play, Square, RotateCcw } from 'lucide-react';

interface CameraControlProps {
  isRecording: boolean;
  isSessionActive: boolean;
  showStartSession: boolean;
  showStopSession: boolean;
  sessionStopped: boolean;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onStartSession: () => void;
  onStopSession: () => void;
  onAnalyze: () => void;
  onCalibrate: () => void;
}

const CameraControl: React.FC<CameraControlProps> = ({
  isRecording,
  isSessionActive,
  showStartSession,
  showStopSession,
  sessionStopped,
  onStartRecord,
  onStopRecord,
  onStartSession,
  onStopSession,
  onAnalyze,
  onCalibrate,
}) => {
  return (
    <div className="flex flex-wrap gap-4 justify-center">
      {!isRecording ? (
        <Button onClick={onStartRecord} size="lg" className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Start Record
        </Button>
      ) : !isSessionActive && (
        <Button onClick={onStopRecord} variant="destructive" size="lg" className="flex items-center gap-2">
          <MicOff className="w-5 h-5" />
          Stop Record
        </Button>
      )}

      {showStartSession && (
        <Button onClick={onStartSession} size="lg" className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Start Session
        </Button>
      )}

      {showStopSession && (
        <Button onClick={onStopSession} variant="destructive" size="lg" className="flex items-center gap-2">
          <Square className="w-5 h-5" />
          Stop Session
        </Button>
      )}

      {sessionStopped && (
        <Button onClick={onAnalyze} variant="outline" size="lg">
          Analyze
        </Button>
      )}

      <Button onClick={onCalibrate} variant="outline" size="lg" className="flex items-center gap-2">
        <RotateCcw className="w-5 h-5" />
        Calibrate
      </Button>
    </div>
  );
};

export default CameraControl;
