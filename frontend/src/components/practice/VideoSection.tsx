import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera } from 'lucide-react';

interface VideoSectionProps {
  isActive: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const VideoSection: React.FC<VideoSectionProps> = ({ isActive, videoRef, canvasRef }) => {

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Camera Feed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="w-full max-w-sm mx-auto">
            {isActive ? (
              <video
                ref={videoRef}
                className="w-full h-48 object-cover rounded-lg border"
                autoPlay
                muted
                playsInline
                style={{ maxWidth: '384px' }}
              />
            ) : (
              <div className="w-full h-48 bg-gray-100 rounded-lg border flex items-center justify-center" style={{ maxWidth: '384px' }}>
                <p className="text-gray-500 text-lg">Click "Start Record" to begin</p>
              </div>
            )}
          </div>
          {isActive && (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoSection;
