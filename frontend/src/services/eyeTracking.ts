export interface EyeTrackingData {
  face_detected: boolean;
  landmarks_detected: boolean;
  eye_contact: boolean;
  eye_contact_percentage: number;
  total_eye_contact_time: number;
  blink_count: number;
  gaze_direction: {
    x: number;
    y: number;
  };
  head_pose: {
    pitch: number;
    yaw: number;
    roll: number;
  };
}

export interface EyeTrackingAnalysis {
  core_metrics: {
    eye_contact_score: number;
    focus_consistency: number;
    blink_count: number;
    blink_rate: number;
    total_eye_contact_time: number;
    total_points: number;
  };
  advanced_metrics: {
    engagement_level: string;
    gaze_stability: string;
  };
  session_duration: number;
}

class EyeTrackingService {
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;
  private isTracking = false;
  private animationFrameId: number | null = null;

  // Configuration
  private readonly TARGET_FPS = 10; // Process 10 frames per second
  private readonly FRAME_INTERVAL = 1000 / this.TARGET_FPS;

  private lastFrameTime = 0;
  private onFrameCallback?: (data: EyeTrackingData) => void;

  async initialize(videoElement: HTMLVideoElement, canvasElement?: HTMLCanvasElement): Promise<void> {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement || null;

    try {
      // Request camera access
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      this.videoElement.srcObject = this.stream;

      return new Promise((resolve) => {
        this.videoElement!.onloadedmetadata = () => {
          this.videoElement!.play();
          resolve();
        };
      });
    } catch (error) {
      console.error('Failed to initialize camera:', error);
      throw new Error('Camera access denied or unavailable');
    }
  }

  startTracking(onFrame?: (data: EyeTrackingData) => void): void {
    if (!this.videoElement || !this.stream) {
      throw new Error('Eye tracking not initialized');
    }

    this.isTracking = true;
    this.onFrameCallback = onFrame;
    this.processFrame();
  }

  stopTracking(): void {
    this.isTracking = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private processFrame = (): void => {
    if (!this.isTracking || !this.videoElement) return;

    const currentTime = Date.now();

    if (currentTime - this.lastFrameTime >= this.FRAME_INTERVAL) {
      this.lastFrameTime = currentTime;

      try {
        // Capture frame
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;

        ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

        // Convert to base64 for sending to backend
        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        // Send to backend via WebSocket (will be handled by WebSocket service)
        // For now, simulate processing
        this.simulateEyeTracking(imageData);

      } catch (error) {
        console.error('Frame processing error:', error);
      }
    }

    if (this.isTracking) {
      this.animationFrameId = requestAnimationFrame(this.processFrame);
    }
  };

  private simulateEyeTracking(imageData: string): void {
    // Simulate eye tracking data (in real implementation, this would come from backend)
    const mockData: EyeTrackingData = {
      face_detected: Math.random() > 0.1, // 90% chance of face detection
      landmarks_detected: Math.random() > 0.2, // 80% chance of landmarks
      eye_contact: Math.random() > 0.3, // 70% chance of eye contact
      eye_contact_percentage: Math.floor(Math.random() * 100),
      total_eye_contact_time: Math.floor(Math.random() * 60),
      blink_count: Math.floor(Math.random() * 20),
      gaze_direction: {
        x: (Math.random() - 0.5) * 2, // -1 to 1
        y: (Math.random() - 0.5) * 2  // -1 to 1
      },
      head_pose: {
        pitch: (Math.random() - 0.5) * 60, // -30 to 30 degrees
        yaw: (Math.random() - 0.5) * 60,   // -30 to 30 degrees
        roll: (Math.random() - 0.5) * 30   // -15 to 15 degrees
      }
    };

    if (this.onFrameCallback) {
      this.onFrameCallback(mockData);
    }
  }

  getComprehensiveAnalysis(): EyeTrackingAnalysis {
    // Return mock comprehensive analysis
    return {
      core_metrics: {
        eye_contact_score: Math.floor(Math.random() * 100),
        focus_consistency: Math.floor(Math.random() * 100),
        blink_count: Math.floor(Math.random() * 30),
        blink_rate: Math.floor(Math.random() * 50),
        total_eye_contact_time: Math.floor(Math.random() * 120),
        total_points: Math.floor(Math.random() * 1000)
      },
      advanced_metrics: {
        engagement_level: ['Low', 'Moderate', 'High'][Math.floor(Math.random() * 3)],
        gaze_stability: ['Unstable', 'Moderate', 'Stable'][Math.floor(Math.random() * 3)]
      },
      session_duration: Math.floor(Math.random() * 300)
    };
  }

  calibrate(): void {
    // Reset calibration (in real implementation, this would trigger backend calibration)
    console.log('Eye tracking calibration initiated');
  }

  reset(): void {
    // Reset tracking state
    console.log('Eye tracking reset');
  }

  cleanup(): void {
    this.stopTracking();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.videoElement = null;
    this.canvasElement = null;
    this.onFrameCallback = undefined;
  }

  get isInitialized(): boolean {
    return this.videoElement !== null && this.stream !== null;
  }

  get isActive(): boolean {
    return this.isTracking;
  }
}

// Export singleton instance
export const eyeTrackingService = new EyeTrackingService();
export default eyeTrackingService;
