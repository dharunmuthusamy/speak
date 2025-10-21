import cv2 as cv
import numpy as np
import mediapipe as mp
import math
import time
import argparse
import sys
import traceback

def check_dependencies():
    """Check if all required dependencies are available"""
    try:
        import cv2
        import numpy
        import mediapipe
        print("✅ All dependencies are available")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Please install required packages:")
        print("pip install opencv-python mediapipe numpy")
        return False

#-----------------------------------------------------------------------------------------------------------------------------------
# Parameters Configuration
#-----------------------------------------------------------------------------------------------------------------------------------

USER_FACE_WIDTH = 140
PRINT_DATA = True
DEFAULT_WEBCAM = 1  # Changed to 1 to use different camera than web app
SHOW_ALL_FEATURES = True
ENABLE_HEAD_POSE = True

# Blink Detection Parameters
TOTAL_BLINKS = 0
EYES_BLINK_FRAME_COUNTER = 0
BLINK_THRESHOLD = 0.51
EYE_AR_CONSEC_FRAMES = 2

# Eye Contact Detection Parameters
EYE_CONTACT_THRESHOLD_YAW = 30
EYE_CONTACT_THRESHOLD_PITCH = 30
GAZE_THRESHOLD = 0.5

# MediaPipe Model Confidence
MIN_DETECTION_CONFIDENCE = 0.5
MIN_TRACKING_CONFIDENCE = 0.5

#-----------------------------------------------------------------------------------------------------------------------------------
# Global Variables
#-----------------------------------------------------------------------------------------------------------------------------------

# Head Pose Calibration
initial_pitch, initial_yaw, initial_roll = None, None, None
calibrated = False

# Eye Contact Detection Variables
is_eye_contact = False
total_eye_contact_time = 0
eye_contact_start_time = None

# Facial Landmark Indices
LEFT_EYE_IRIS = [474, 475, 476, 477]
RIGHT_EYE_IRIS = [469, 470, 471, 472]
LEFT_EYE_OUTER_CORNER = [33]
LEFT_EYE_INNER_CORNER = [133]
RIGHT_EYE_OUTER_CORNER = [362]
RIGHT_EYE_INNER_CORNER = [263]
RIGHT_EYE_POINTS = [33, 160, 159, 158, 133, 153, 145, 144]
LEFT_EYE_POINTS = [362, 385, 386, 387, 263, 373, 374, 380]
NOSE_TIP_INDEX = 4
CHIN_INDEX = 152
LEFT_EYE_LEFT_CORNER_INDEX = 33
RIGHT_EYE_RIGHT_CORNER_INDEX = 263
LEFT_MOUTH_CORNER_INDEX = 61
RIGHT_MOUTH_CORNER_INDEX = 291

#-----------------------------------------------------------------------------------------------------------------------------------
# Utility Classes and Functions
#-----------------------------------------------------------------------------------------------------------------------------------

class AngleBuffer:
    def __init__(self, size=10):
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

def vector_position(point1, point2):
    x1, y1 = point1.ravel()
    x2, y2 = point2.ravel()
    return x2 - x1, y2 - y1

def euclidean_distance_3D(points):
    try:
        P0, P3, P4, P5, P8, P11, P12, P13 = points
        numerator = (np.linalg.norm(P3 - P13) ** 3 + np.linalg.norm(P4 - P12) ** 3 + np.linalg.norm(P5 - P11) ** 3)
        denominator = 3 * np.linalg.norm(P0 - P8) ** 3
        distance = numerator / denominator
        return distance
    except Exception as e:
        return 1.0

def estimate_head_pose(landmarks, image_size):
    try:
        scale_factor = USER_FACE_WIDTH / 150.0
        
        model_points = np.array([
            (0.0, 0.0, 0.0),
            (0.0, -330.0 * scale_factor, -65.0 * scale_factor),
            (-225.0 * scale_factor, 170.0 * scale_factor, -135.0 * scale_factor),
            (225.0 * scale_factor, 170.0 * scale_factor, -135.0 * scale_factor),
            (-150.0 * scale_factor, -150.0 * scale_factor, -125.0 * scale_factor),
            (150.0 * scale_factor, -150.0 * scale_factor, -125.0 * scale_factor)
        ])
        
        focal_length = image_size[1]
        center = (image_size[1]/2, image_size[0]/2)
        camera_matrix = np.array(
            [[focal_length, 0, center[0]],
             [0, focal_length, center[1]],
             [0, 0, 1]], dtype="double"
        )

        dist_coeffs = np.zeros((4,1))

        image_points = np.array([
            landmarks[NOSE_TIP_INDEX],
            landmarks[CHIN_INDEX],
            landmarks[LEFT_EYE_LEFT_CORNER_INDEX],
            landmarks[RIGHT_EYE_RIGHT_CORNER_INDEX],
            landmarks[LEFT_MOUTH_CORNER_INDEX],
            landmarks[RIGHT_MOUTH_CORNER_INDEX]
        ], dtype="double")

        (success, rotation_vector, translation_vector) = cv.solvePnP(
            model_points, image_points, camera_matrix, dist_coeffs, flags=cv.SOLVEPNP_ITERATIVE
        )

        if not success:
            return 0, 0, 0

        rotation_matrix, _ = cv.Rodrigues(rotation_vector)
        projection_matrix = np.hstack((rotation_matrix, translation_vector.reshape(-1, 1)))
        _, _, _, _, _, _, euler_angles = cv.decomposeProjectionMatrix(projection_matrix)
        pitch, yaw, roll = euler_angles.flatten()[:3]

        # Normalize pitch
        if pitch > 180:
            pitch -= 360
        pitch = -pitch
        if pitch < -90:
            pitch = -(180 + pitch)
        elif pitch > 90:
            pitch = 180 - pitch
        pitch = -pitch
        
        return pitch, yaw, roll
        
    except Exception as e:
        return 0, 0, 0

def blinking_ratio(landmarks):
    try:
        right_eye_points = [landmarks[i] for i in RIGHT_EYE_POINTS]
        left_eye_points = [landmarks[i] for i in LEFT_EYE_POINTS]
        
        right_eye_ratio = euclidean_distance_3D(right_eye_points)
        left_eye_ratio = euclidean_distance_3D(left_eye_points)
        ratio = (right_eye_ratio + left_eye_ratio + 1) / 2
        return ratio
    except Exception as e:
        return 1.0

def calculate_gaze_direction(landmarks, left_center, right_center):
    try:
        face_center_x = (landmarks[LEFT_EYE_LEFT_CORNER_INDEX][0] + landmarks[RIGHT_EYE_RIGHT_CORNER_INDEX][0]) / 2
        face_center_y = (landmarks[LEFT_EYE_LEFT_CORNER_INDEX][1] + landmarks[RIGHT_EYE_RIGHT_CORNER_INDEX][1]) / 2
        
        gaze_center_x = (left_center[0] + right_center[0]) / 2
        gaze_center_y = (left_center[1] + right_center[1]) / 2
        
        face_width = abs(landmarks[RIGHT_EYE_RIGHT_CORNER_INDEX][0] - landmarks[LEFT_EYE_LEFT_CORNER_INDEX][0])
        face_height = abs(landmarks[CHIN_INDEX][1] - landmarks[NOSE_TIP_INDEX][1])
        
        if face_width == 0 or face_height == 0:
            return 0, 0
            
        gaze_x = (gaze_center_x - face_center_x) / (face_width / 2)
        gaze_y = (gaze_center_y - face_center_y) / (face_height / 2)
        
        gaze_x = max(-1, min(1, gaze_x))
        gaze_y = max(-1, min(1, gaze_y))
        
        return gaze_x, gaze_y
        
    except Exception as e:
        return 0, 0

def detect_eye_contact(head_pitch, head_yaw, head_roll, gaze_x, gaze_y):
    head_forward = (abs(head_yaw) < EYE_CONTACT_THRESHOLD_YAW and 
                   abs(head_pitch) < EYE_CONTACT_THRESHOLD_PITCH)
    
    gaze_forward = (abs(gaze_x) < GAZE_THRESHOLD and 
                   abs(gaze_y) < GAZE_THRESHOLD)
    
    if abs(gaze_x) > 2 or abs(gaze_y) > 2:
        return head_forward
    
    return head_forward and gaze_forward

def draw_enhanced_eye_detection(frame, landmarks, left_center, right_center, left_radius, right_radius):
    """Draw comprehensive eye detection visualization"""
    
    # Draw all facial landmarks in light green
    for point in landmarks:
        cv.circle(frame, tuple(point), 1, (0, 255, 0), -1)
    
    # Draw eye regions with different colors
    for point_idx in LEFT_EYE_POINTS:
        cv.circle(frame, tuple(landmarks[point_idx]), 2, (255, 255, 0), -1)
    
    for point_idx in RIGHT_EYE_POINTS:
        cv.circle(frame, tuple(landmarks[point_idx]), 2, (255, 255, 0), -1)
    
    # Highlight iris regions
    for point_idx in LEFT_EYE_IRIS:
        cv.circle(frame, tuple(landmarks[point_idx]), 2, (0, 255, 255), -1)
    
    for point_idx in RIGHT_EYE_IRIS:
        cv.circle(frame, tuple(landmarks[point_idx]), 2, (0, 255, 255), -1)
    
    # Draw iris centers with larger circles
    cv.circle(frame, tuple(left_center), int(left_radius), (255, 0, 255), 3, cv.LINE_AA)
    cv.circle(frame, tuple(right_center), int(right_radius), (255, 0, 255), 3, cv.LINE_AA)
    
    # Draw eye corners
    cv.circle(frame, tuple(landmarks[LEFT_EYE_INNER_CORNER][0]), 5, (255, 255, 255), -1, cv.LINE_AA)
    cv.circle(frame, tuple(landmarks[LEFT_EYE_OUTER_CORNER][0]), 5, (0, 255, 255), -1, cv.LINE_AA)
    cv.circle(frame, tuple(landmarks[RIGHT_EYE_INNER_CORNER][0]), 5, (255, 255, 255), -1, cv.LINE_AA)
    cv.circle(frame, tuple(landmarks[RIGHT_EYE_OUTER_CORNER][0]), 5, (0, 255, 255), -1, cv.LINE_AA)
    
    # Draw connecting lines for eye contours
    for i in range(len(LEFT_EYE_POINTS)):
        next_idx = (i + 1) % len(LEFT_EYE_POINTS)
        cv.line(frame, 
               tuple(landmarks[LEFT_EYE_POINTS[i]]), 
               tuple(landmarks[LEFT_EYE_POINTS[next_idx]]), 
               (0, 255, 0), 1)
    
    for i in range(len(RIGHT_EYE_POINTS)):
        next_idx = (i + 1) % len(RIGHT_EYE_POINTS)
        cv.line(frame, 
               tuple(landmarks[RIGHT_EYE_POINTS[i]]), 
               tuple(landmarks[RIGHT_EYE_POINTS[next_idx]]), 
               (0, 255, 0), 1)
    
    return frame

def draw_detection_info(frame, eye_contact, pitch, yaw, roll, gaze_x, gaze_y, blink_count, total_eye_contact_time):
    """Draw detection information on frame"""
    
    # Main status
    status_color = (0, 255, 0) if eye_contact else (0, 0, 255)
    status_text = "EYE CONTACT: YES" if eye_contact else "EYE CONTACT: NO"
    cv.putText(frame, status_text, (20, 40), cv.FONT_HERSHEY_SIMPLEX, 1, status_color, 3)
    
    # Head pose information
    cv.putText(frame, f"Head Yaw: {yaw:.1f}°", (20, 80), cv.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv.putText(frame, f"Head Pitch: {pitch:.1f}°", (20, 110), cv.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv.putText(frame, f"Head Roll: {roll:.1f}°", (20, 140), cv.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    
    # Gaze information
    cv.putText(frame, f"Gaze X: {gaze_x:.2f}", (20, 180), cv.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv.putText(frame, f"Gaze Y: {gaze_y:.2f}", (20, 210), cv.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    
    # Statistics
    cv.putText(frame, f"Blinks: {blink_count}", (20, 250), cv.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv.putText(frame, f"Eye Contact Time: {total_eye_contact_time:.1f}s", (20, 280), cv.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    
    # Threshold information
    cv.putText(frame, f"Thresholds - Yaw: {EYE_CONTACT_THRESHOLD_YAW}°, Pitch: {EYE_CONTACT_THRESHOLD_PITCH}°, Gaze: {GAZE_THRESHOLD}", 
               (20, frame.shape[0] - 20), cv.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    # Draw legend
    legend_y = 320
    cv.putText(frame, "Legend:", (20, legend_y), cv.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    cv.putText(frame, "Green: Facial Landmarks", (20, legend_y + 25), cv.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
    cv.putText(frame, "Cyan: Eye Contours", (20, legend_y + 45), cv.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
    cv.putText(frame, "Yellow: Iris Points", (20, legend_y + 65), cv.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
    cv.putText(frame, "Magenta: Iris Centers", (20, legend_y + 85), cv.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 1)
    
    return frame

def list_available_cameras():
    """List all available cameras"""
    print("🔍 Scanning for available cameras...")
    available_cameras = []
    for i in range(5):  # Check first 5 camera indices
        cap = cv.VideoCapture(i)
        if cap.isOpened():
            ret, frame = cap.read()
            if ret:
                available_cameras.append(i)
                print(f"✅ Camera {i} is available")
            cap.release()
        else:
            print(f"❌ Camera {i} is not available")
    
    return available_cameras

#-----------------------------------------------------------------------------------------------------------------------------------
# Main Monitor Application
#-----------------------------------------------------------------------------------------------------------------------------------

def main():
    global initial_pitch, initial_yaw, initial_roll, calibrated
    global is_eye_contact, total_eye_contact_time, eye_contact_start_time
    global TOTAL_BLINKS, EYES_BLINK_FRAME_COUNTER
    
    print("=" * 60)
    print("🚀 ENHANCED EYE CONTACT MONITOR")
    print("=" * 60)
    print("📍 This is a standalone monitor for reference during recording")
    print("🎯 Look straight at the camera for calibration")
    print("")
    print("CONTROLS:")
    print("  'c' - Recalibrate head pose")
    print("  'r' - Reset statistics") 
    print("  'q' - Quit monitor")
    print("=" * 60)
    
    # Check dependencies first
    if not check_dependencies():
        print("❌ Press any key to exit...")
        input()
        return
    
    # List available cameras
    available_cameras = list_available_cameras()
    
    if not available_cameras:
        print("❌ No cameras available!")
        print("Press any key to exit...")
        input()
        return
    
    # Use the first available camera that's not 0 (to avoid conflict with web app)
    camera_to_use = available_cameras[0]
    if len(available_cameras) > 1:
        # Prefer camera 1 if available to avoid conflict with web app using camera 0
        if 1 in available_cameras:
            camera_to_use = 1
        else:
            camera_to_use = available_cameras[0]
    
    print(f"🎥 Using camera: {camera_to_use}")
    
    # Initialize MediaPipe
    try:
        mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=MIN_DETECTION_CONFIDENCE,
            min_tracking_confidence=MIN_TRACKING_CONFIDENCE,
        )
        print("✅ MediaPipe initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize MediaPipe: {e}")
        print("Press any key to exit...")
        input()
        return
    
    # Initialize camera with better error handling
    cap = None
    try:
        cap = cv.VideoCapture(camera_to_use)
        
        # Try different backends if default fails
        if not cap.isOpened():
            print("🔄 Trying alternative camera backend...")
            cap = cv.VideoCapture(camera_to_use, cv.CAP_DSHOW)  # DirectShow backend for Windows
        
        if not cap.isOpened():
            print(f"❌ Cannot open camera {camera_to_use}")
            print("Possible reasons:")
            print("  - Camera is already in use by another application")
            print("  - Camera drivers need updating")
            print("  - Camera is disconnected")
            print("Press any key to exit...")
            input()
            return
        
        # Set camera resolution for consistency
        cap.set(cv.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv.CAP_PROP_FPS, 15)
        
        print(f"✅ Camera {camera_to_use} initialized successfully")
        
    except Exception as e:
        print(f"❌ Camera initialization failed: {e}")
        print("Press any key to exit...")
        input()
        return
    
    angle_buffer = AngleBuffer(size=10)
    frame_count = 0
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("❌ Failed to grab frame from camera - trying to reconnect...")
                # Try to reinitialize camera
                cap.release()
                time.sleep(1)
                cap = cv.VideoCapture(camera_to_use, cv.CAP_DSHOW)
                if not cap.isOpened():
                    print("❌ Could not reconnect to camera")
                    break
                continue
            
            # Flip frame horizontally for mirror effect
            frame = cv.flip(frame, 1)
            
            rgb_frame = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
            img_h, img_w = frame.shape[:2]
            results = mp_face_mesh.process(rgb_frame)

            if results.multi_face_landmarks:
                mesh_points = np.array(
                    [
                        np.multiply([p.x, p.y], [img_w, img_h]).astype(int)
                        for p in results.multi_face_landmarks[0].landmark
                    ]
                )

                mesh_points_3D = np.array(
                    [[n.x, n.y, n.z] for n in results.multi_face_landmarks[0].landmark]
                )

                # Blink detection
                eyes_aspect_ratio = blinking_ratio(mesh_points_3D)
                
                if eyes_aspect_ratio <= BLINK_THRESHOLD:
                    EYES_BLINK_FRAME_COUNTER += 1
                else:
                    if EYES_BLINK_FRAME_COUNTER > EYE_AR_CONSEC_FRAMES:
                        TOTAL_BLINKS += 1
                        if PRINT_DATA:
                            print(f"Blink detected! Total: {TOTAL_BLINKS}")
                    EYES_BLINK_FRAME_COUNTER = 0

                # Get eye centers
                (l_cx, l_cy), l_radius = cv.minEnclosingCircle(mesh_points[LEFT_EYE_IRIS])
                (r_cx, r_cy), r_radius = cv.minEnclosingCircle(mesh_points[RIGHT_EYE_IRIS])
                center_left = np.array([l_cx, l_cy], dtype=np.int32)
                center_right = np.array([r_cx, r_cy], dtype=np.int32)

                # Draw enhanced eye detection
                frame = draw_enhanced_eye_detection(frame, mesh_points, center_left, center_right, l_radius, r_radius)

                # Calculate gaze direction
                gaze_x, gaze_y = calculate_gaze_direction(mesh_points, center_left, center_right)

                # Head pose estimation
                pitch, yaw, roll = 0, 0, 0
                if ENABLE_HEAD_POSE:
                    pitch, yaw, roll = estimate_head_pose(mesh_points, (img_h, img_w))
                    angle_buffer.add([pitch, yaw, roll])
                    pitch, yaw, roll = angle_buffer.get_average()

                    # Initial calibration
                    if initial_pitch is None and frame_count > 30:
                        initial_pitch, initial_yaw, initial_roll = pitch, yaw, roll
                        calibrated = True
                        if PRINT_DATA:
                            print(f"🎯 Initial calibration complete - Pitch: {pitch:.1f}, Yaw: {yaw:.1f}, Roll: {roll:.1f}")

                    # Adjust angles based on calibration
                    if calibrated:
                        pitch -= initial_pitch
                        yaw -= initial_yaw
                        roll -= initial_roll

                # Eye contact detection
                current_eye_contact = detect_eye_contact(pitch, yaw, roll, gaze_x, gaze_y)
                
                # Update eye contact state and timing
                if current_eye_contact != is_eye_contact:
                    if current_eye_contact:
                        is_eye_contact = True
                        eye_contact_start_time = time.time()
                        if PRINT_DATA:
                            print("=== EYE CONTACT STARTED ===")
                    else:
                        if eye_contact_start_time is not None:
                            contact_duration = time.time() - eye_contact_start_time
                            total_eye_contact_time += contact_duration
                            if PRINT_DATA:
                                print(f"=== EYE CONTACT ENDED: {contact_duration:.2f}s ===")
                        is_eye_contact = False

                # Draw detection information
                frame = draw_detection_info(frame, is_eye_contact, pitch, yaw, roll, gaze_x, gaze_y, TOTAL_BLINKS, total_eye_contact_time)

            else:
                # No face detected
                cv.putText(frame, "NO FACE DETECTED", (20, 40), cv.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)
                cv.putText(frame, "Ensure good lighting and face the camera", (20, 80), cv.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

            # Display the frame
            cv.imshow("Enhanced Eye Contact Monitor - Reference Display", frame)
            
            # Handle key presses
            key = cv.waitKey(1) & 0xFF
            
            # Recalibrate on 'c' press
            if key == ord('c'):
                if ENABLE_HEAD_POSE and results and results.multi_face_landmarks:
                    initial_pitch, initial_yaw, initial_roll = pitch, yaw, roll
                    calibrated = True
                    print("🎯 Head pose recalibrated!")
            
            # Reset statistics on 'r' press
            if key == ord('r'):
                TOTAL_BLINKS = 0
                total_eye_contact_time = 0
                print("🔄 Statistics reset")
            
            # Exit on 'q' press
            if key == ord('q'):
                break
                
            frame_count += 1

    except Exception as e:
        print(f"❌ Error in monitor: {e}")
        print("Stack trace:")
        traceback.print_exc()
        print("Press any key to exit...")
        input()

    finally:
        if cap is not None:
            cap.release()
        cv.destroyAllWindows()
        print("👋 Eye Contact Monitor closed")

if __name__ == "__main__":
    main()