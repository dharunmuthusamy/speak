import cv2 as cv
import numpy as np
import mediapipe as mp
import math
import time
import base64

class AngleBuffer:
    def __init__(self, size=5):  # Reduced for faster response
        self.size = size
        self.buffer = []
    
    def add(self, angles):
        self.buffer.append(angles)
        if len(self.buffer) > self.size:
            self.buffer.pop(0)
    
    def get_average(self):
        if not self.buffer:
            return [0, 0, 0]
        return np.mean(self.buffer, axis=0).tolist()

class AdvancedEyeTracker:
    def __init__(self):
        # SIMPLIFIED PARAMETERS - More sensitive detection
        self.PRINT_DATA = True
        
        # Blink Detection
        self.TOTAL_BLINKS = 0
        self.EYES_BLINK_FRAME_COUNTER = 0
        self.BLINK_THRESHOLD = 0.51
        self.EYE_AR_CONSEC_FRAMES = 2
        
        # EYE CONTACT DETECTION - VERY RELAXED FOR TESTING
        self.EYE_CONTACT_THRESHOLD_YAW = 45  # Very relaxed
        self.EYE_CONTACT_THRESHOLD_PITCH = 45  # Very relaxed
        self.GAZE_THRESHOLD = 0.8  # Very relaxed
        
        # Persistence - Reduced for testing
        self.eye_contact_start_time = None
        self.eye_contact_confirmed = False
        self.PERSISTENCE_THRESHOLD = 2.0  # Reduced to 2 seconds
        
        # MediaPipe
        self.mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            static_image_mode=False
        )
        
        # Detection variables
        self.face_detected = False
        self.landmarks_detected = False
        self.total_frames = 0
        self.eye_contact_frames = 0
        self.eye_contact_percentage = 0
        
        # Calibration
        self.initial_pitch, self.initial_yaw, self.initial_roll = None, None, None
        self.calibrated = False
        self.angle_buffer = AngleBuffer(size=5)
        
        # Session data
        self.session_data = {
            'gaze_points': [],
            'blink_count': 0,
            'eye_contact_percentage': 0,
        }
        
        # Landmark indices
        self.LEFT_EYE_IRIS = [474, 475, 476, 477]
        self.RIGHT_EYE_IRIS = [469, 470, 471, 472]
        self.LEFT_EYE_OUTER_CORNER = [33]
        self.LEFT_EYE_INNER_CORNER = [133]
        self.RIGHT_EYE_OUTER_CORNER = [362]
        self.RIGHT_EYE_INNER_CORNER = [263]
        
        print("✅ Eye Tracker Initialized - RELAXED DETECTION MODE")

    def detect_eye_contact_simple(self, head_pitch, head_yaw, gaze_x, gaze_y):
        """
        SIMPLIFIED eye contact detection - No persistence for testing
        """
        # Convert to Python types to avoid numpy serialization issues
        head_yaw = float(head_yaw)
        head_pitch = float(head_pitch)
        gaze_x = float(gaze_x)
        gaze_y = float(gaze_y)

        # Very relaxed thresholds
        head_forward = (abs(head_yaw) < self.EYE_CONTACT_THRESHOLD_YAW and
                       abs(head_pitch) < self.EYE_CONTACT_THRESHOLD_PITCH)

        gaze_forward = (abs(gaze_x) < self.GAZE_THRESHOLD and
                       abs(gaze_y) < self.GAZE_THRESHOLD)

        eye_contact_detected = bool(head_forward and gaze_forward)

        # DEBUG OUTPUT
        if self.PRINT_DATA and self.total_frames % 15 == 0:  # Print every 15 frames
            print(f"🎯 Head: Yaw={head_yaw:.1f}°, Pitch={head_pitch:.1f}° | "
                  f"Gaze: X={gaze_x:.3f}, Y={gaze_y:.3f} | "
                  f"Eye Contact: {eye_contact_detected}")

        return eye_contact_detected

    def process_frame(self, image_data):
        """Simplified process_frame method"""
        try:
            # Convert base64 to image
            if ',' in image_data:
                image_bytes = base64.b64decode(image_data.split(',')[1])
            else:
                image_bytes = base64.b64decode(image_data)
                
            np_arr = np.frombuffer(image_bytes, np.uint8)
            frame = cv.imdecode(np_arr, cv.IMREAD_COLOR)
            
            if frame is None:
                return self.get_frame_analysis()

            # Resize for consistency
            frame = cv.resize(frame, (640, 480))
            rgb_frame = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
            
            # Process with face mesh
            results = self.mp_face_mesh.process(rgb_frame)

            if results.multi_face_landmarks:
                self.face_detected = True
                landmarks = results.multi_face_landmarks[0].landmark
                img_h, img_w = frame.shape[:2]
                
                # Convert landmarks to pixel coordinates
                mesh_points = np.array([
                    [int(landmark.x * img_w), int(landmark.y * img_h)] 
                    for landmark in landmarks
                ])
                
                # Get eye centers
                (l_cx, l_cy), l_radius = cv.minEnclosingCircle(mesh_points[self.LEFT_EYE_IRIS])
                (r_cx, r_cy), r_radius = cv.minEnclosingCircle(mesh_points[self.RIGHT_EYE_IRIS])
                
                # Simple gaze calculation
                gaze_x, gaze_y = self.calculate_gaze_direction_simple(mesh_points, (l_cx, l_cy), (r_cx, r_cy))
                
                # Simple head pose estimation
                pitch, yaw, roll = self.estimate_head_pose_simple(mesh_points, (img_h, img_w))
                
                # Auto-calibrate
                if self.initial_pitch is None:
                    self.initial_pitch, self.initial_yaw, self.initial_roll = pitch, yaw, roll
                    self.calibrated = True
                    print(f"🎯 AUTO-CALIBRATED: Pitch={pitch:.1f}, Yaw={yaw:.1f}")
                
                # Apply calibration
                if self.calibrated:
                    pitch -= self.initial_pitch
                    yaw -= self.initial_yaw
                
                # Detect eye contact
                current_eye_contact = self.detect_eye_contact_simple(pitch, yaw, gaze_x, gaze_y)
                
                # Update counters
                self.total_frames += 1
                if current_eye_contact:
                    self.eye_contact_frames += 1
                
                # Calculate percentage
                if self.total_frames > 0:
                    self.eye_contact_percentage = (self.eye_contact_frames / self.total_frames) * 100
                
                self.landmarks_detected = True
                
                return self.get_frame_analysis(current_eye_contact, gaze_x, gaze_y, pitch, yaw, roll)
                
            else:
                self.face_detected = False
                self.landmarks_detected = False
                
        except Exception as e:
            print(f"❌ Frame processing error: {e}")
            self.face_detected = False
            self.landmarks_detected = False
        
        return self.get_frame_analysis()

    def calculate_gaze_direction_simple(self, landmarks, left_center, right_center):
        """Simplified gaze calculation"""
        try:
            # Left eye
            left_outer = landmarks[self.LEFT_EYE_OUTER_CORNER][0]
            left_inner = landmarks[self.LEFT_EYE_INNER_CORNER][0]
            
            # Right eye  
            right_outer = landmarks[self.RIGHT_EYE_OUTER_CORNER][0]
            right_inner = landmarks[self.RIGHT_EYE_INNER_CORNER][0]
            
            # Calculate normalized gaze
            left_eye_width = np.linalg.norm(left_inner - left_outer)
            right_eye_width = np.linalg.norm(right_inner - right_outer)
            
            if left_eye_width == 0 or right_eye_width == 0:
                return 0, 0
                
            left_gaze_x = (left_center[0] - left_outer[0]) / left_eye_width
            right_gaze_x = (right_center[0] - right_outer[0]) / right_eye_width
            
            # Normalize to [-1, 1]
            left_gaze_x = (left_gaze_x - 0.5) * 2
            right_gaze_x = (right_gaze_x - 0.5) * 2
            
            avg_gaze_x = (left_gaze_x + right_gaze_x) / 2
            
            # Simple vertical gaze
            return avg_gaze_x, 0  # Ignore vertical for now
            
        except Exception as e:
            print(f"Gaze calculation error: {e}")
            return 0, 0

    def estimate_head_pose_simple(self, landmarks, image_size):
        """Simplified head pose estimation"""
        try:
            # Use simple geometric approach
            nose_tip = landmarks[1]  # Nose tip
            chin = landmarks[152]    # Chin
            left_eye = landmarks[33] # Left eye corner
            right_eye = landmarks[263] # Right eye corner
            
            # Calculate simple angles
            dx = (left_eye[0] + right_eye[0]) / 2 - nose_tip[0]
            dy = nose_tip[1] - chin[1]
            
            # Normalize
            yaw = (dx / image_size[1]) * 100  # Rough yaw estimate
            pitch = (dy / image_size[0]) * 50  # Rough pitch estimate
            
            return pitch, yaw, 0  # Ignore roll
            
        except Exception as e:
            print(f"Head pose error: {e}")
            return 0, 0, 0

    def get_frame_analysis(self, eye_contact=False, gaze_x=0, gaze_y=0, pitch=0, yaw=0, roll=0):
        """Return analysis in web-compatible format"""
        # Convert numpy types to Python types for JSON serialization
        return {
            'face_detected': bool(self.face_detected),
            'landmarks_detected': bool(self.landmarks_detected),
            'eye_contact': bool(eye_contact),
            'eye_contact_percentage': float(round(self.eye_contact_percentage, 1)),
            'total_eye_contact_time': float(round(self.eye_contact_frames / 10, 1)),  # Approximate seconds
            'blink_count': int(self.TOTAL_BLINKS),
            'gaze_direction': {
                'x': float(round(gaze_x, 3)),
                'y': float(round(gaze_y, 3))
            },
            'head_pose': {
                'pitch': float(round(pitch, 1)),
                'yaw': float(round(yaw, 1)),
                'roll': float(round(roll, 1))
            }
        }

    def get_comprehensive_analysis(self):
        """Web-compatible comprehensive analysis"""
        session_duration = self.total_frames / 10.0
        
        return {
            'core_metrics': {
                'eye_contact_score': round(self.eye_contact_percentage, 1),
                'focus_consistency': round(self.eye_contact_percentage * 0.8, 1),
                'blink_count': self.TOTAL_BLINKS,
                'blink_rate': round((self.TOTAL_BLINKS / max(1, session_duration)) * 60, 1),
                'total_eye_contact_time': round(self.eye_contact_frames / 10.0, 1),
                'total_points': self.total_frames
            },
            'advanced_metrics': {
                'engagement_level': 'High' if self.eye_contact_percentage >= 60 else 'Moderate' if self.eye_contact_percentage >= 30 else 'Low',
                'gaze_stability': 'Stable' if self.eye_contact_percentage >= 50 else 'Moderate',
            },
            'session_duration': round(session_duration, 1),
        }

    def reset_session(self):
        """Reset session data"""
        self.TOTAL_BLINKS = 0
        self.total_frames = 0
        self.eye_contact_frames = 0
        self.eye_contact_percentage = 0
        self.face_detected = False
        self.landmarks_detected = False
        self.initial_pitch, self.initial_yaw, self.initial_roll = None, None, None
        self.calibrated = False
        print("🔄 Session reset")

    def calibrate_head_pose(self):
        """Recalibrate head pose"""
        self.initial_pitch = None
        self.initial_yaw = None
        self.initial_roll = None
        self.calibrated = False
        print("📐 Calibration reset")