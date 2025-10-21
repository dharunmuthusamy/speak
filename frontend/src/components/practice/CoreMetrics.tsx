import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, Clock, Volume2, Mic } from 'lucide-react';
import { speechAnalysisService } from '@/services/speechAnalysis';

interface RealTimeData {
  eye_contact_percentage: number;
  total_eye_contact_time: number;
  blink_count: number;
  voice_volume: number;
  voice_pitch: number;
  speaking_status: boolean;
  live_score: number;
  eye_contact?: boolean; // Add backend eye contact boolean
}

interface CoreMetricsProps {
  realTimeData: RealTimeData;
}

const CoreMetrics: React.FC<CoreMetricsProps> = ({ realTimeData }) => {
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [microphoneVolume, setMicrophoneVolume] = useState(0);

  // Track session duration from when the component mounts (session starts)
  useEffect(() => {
    if (!sessionStartTime) {
      setSessionStartTime(Date.now());
    }

    const interval = setInterval(() => {
      if (sessionStartTime) {
        setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Sync with actual microphone volume from speech analysis service
  useEffect(() => {
    if (speechAnalysisService.isInitialized) {
      const volumeInterval = setInterval(() => {
        // Get real-time volume from the speech analysis service
        // This will be more accurate than the backend data
        if (speechAnalysisService['smoothedVolume'] !== undefined) {
          setMicrophoneVolume(speechAnalysisService['smoothedVolume']);
        }
      }, 100); // Update every 100ms for smooth slider

      return () => clearInterval(volumeInterval);
    }
  }, []);

  // Use backend eye contact boolean if available, otherwise fallback to percentage
  const eyeContactStatus = realTimeData.eye_contact !== undefined
    ? realTimeData.eye_contact
    : realTimeData.eye_contact_percentage > 30; // Lower threshold for better sensitivity

  // Use backend speaking status directly
  const speakingStatus = realTimeData.speaking_status;

  // Use synced microphone volume for the slider
  const displayVolume = microphoneVolume || realTimeData.voice_volume || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Real-Time Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col items-center p-4 border rounded-lg">
            <Eye className={`w-6 h-6 mb-2 ${eyeContactStatus ? 'text-green-500' : 'text-gray-400'}`} />
            <div className="text-center">
              <div className="text-2xl font-bold">{eyeContactStatus ? 'Yes' : 'No'}</div>
              <div className="text-sm text-muted-foreground">Eye Contact</div>
              <div className="text-xs text-muted-foreground mt-1">
                {Math.round(realTimeData.eye_contact_percentage)}%
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center p-4 border rounded-lg">
            <Mic className={`w-6 h-6 mb-2 ${speakingStatus ? 'text-green-500' : 'text-gray-400'}`} />
            <div className="text-center">
              <div className="text-2xl font-bold">{speakingStatus ? 'Yes' : 'No'}</div>
              <div className="text-sm text-muted-foreground">Speaking</div>
            </div>
          </div>

          <div className="flex flex-col items-center p-4 border rounded-lg">
            <Volume2 className="w-6 h-6 text-purple-500 mb-2" />
            <div className="text-center">
              <div className="text-2xl font-bold">{Math.round(displayVolume)}</div>
              <div className="text-sm text-muted-foreground">Volume</div>
              <div className="mt-2 bg-gray-200 rounded-full h-2 w-full">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${Math.min(displayVolume, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center p-4 border rounded-lg">
            <Clock className="w-6 h-6 text-green-500 mb-2" />
            <div className="text-center">
              <div className="text-2xl font-bold">{sessionDuration}s</div>
              <div className="text-sm text-muted-foreground">Duration</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CoreMetrics;
