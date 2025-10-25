import time, math, cv2
from collections import deque
import pyautogui

pyautogui.FAILSAFE = False
SCREEN_W, SCREEN_H = pyautogui.size()

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

# ---------------- Tunables ----------------
MODEL_PATH         =  "../models/gesture_recognizer.task"

# Swipe fallback (used only if the model doesn't emit Swipe_* labels)
HISTORY_SECONDS    = 0.40
SWIPE_MIN_DELTA    = 0.20      # fraction of frame width (normalized 0..1)
SWIPE_MIN_SPEED    = 0.80      # fraction-of-width per second
COOLDOWN_SECS      = 1.50      # debounce for slide actions

# Pointer smoothing
POINT_SMOOTH_EMA   = 0.25      # 0..1; higher = snappier

# Use model labels if present (set to True). If False, always use fallback heuristics.
PREFER_MODEL_SWIPES = True
# S=1080
# ------------------------------------------

def lerp(a, b, t): return a + (b - a) * t

def detect_swipe_fallback(x_hist):
    """Small heuristic in case the model doesn't output Swipe_*."""
    if len(x_hist) < 3:
        return None
    t0, x0 = x_hist[0]
    t1, x1 = x_hist[-1]
    dt = max(1e-6, t1 - t0)
    delta = x1 - x0
    speed = abs(delta) / dt
    if abs(delta) >= SWIPE_MIN_DELTA and speed >= SWIPE_MIN_SPEED:
        return "Swipe_Right" if delta > 0 else "Swipe_Left"
    return None

# def center_square(bgr):
#     h, w = bgr.shape[:2]
#     s = min(h, w)
#     y0 = (h - s) // 2; x0 = (w - s) // 2
#     return bgr[y0:y0+s, x0:x0+s]

def main():
    # --- Build Gesture Recognizer (VIDEO mode for per-frame timestamps) ---
    base = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
    options = mp_vision.GestureRecognizerOptions(
        base_options=base,
        running_mode=mp_vision.RunningMode.VIDEO,
        num_hands=2,  # one control hand is usually cleaner on stage
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )
    recognizer = mp_vision.GestureRecognizer.create_from_options(options)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise SystemExit("No webcam found")

    # State
    control_on = True
    last_toggle = 0.0
    last_action = 0.0
    x_history = deque()
    cur_x, cur_y = pyautogui.position()
    prevTopLabel=None
    displayedTopLabel=None
    print("Controls:")
    print("  👍 Thumb_Up          = toggle ON/OFF")
    print("  👉 Pointing_Up       = move mouse cursor (air-pointer)")
    print("  👋 Swipe Left/Right  = next/prev slide (uses model labels if available; falls back to landmarks)")
    print("Tip: keep slideshow focused; press Q to quit.")

    while True:
        ok, frame_bgr = cap.read()
        if not ok:
            break

        frame_bgr = cv2.flip(frame_bgr, 1)  # natural mirror
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB).copy()
        h, w = frame_bgr.shape[:2]
        now = time.time()

        # Build MP Image and run recognizer
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        timestamp_ms = int(now * 1000)
        result = recognizer.recognize_for_video(mp_image, timestamp_ms)

        # Defaults
        status = "No hand"
        top_label = None
        top_score = 0.0
        landmarks = None

        # Parse result for one hand (top candidate)
        if result.gestures and len(result.gestures) > 0:
            # result.gestures: list per hand, each is a list of Classifications with categories
            categories = result.gestures[0]  # <-- list[Category]


            # debugLog("N-Class Classifier",categories) # Explain about Similarities/Differences between classification & Clustering
            if categories and len(categories) > 0:
                top = categories[0]  # Category
                top_label = top.category_name
                top_score = top.score

            if prevTopLabel != top_label and displayedTopLabel != top_label:
                # print("N-Class Classifier")
                displayedTopLabel=top_label
                for gest in result.gestures:
                    print([f"{c.category_name}:{c.score:.2f}" for c in gest])


        if result.hand_landmarks and len(result.hand_landmarks) > 0:
            # Normalized landmarks [0..1]
            landmarks = result.hand_landmarks[0] # list[NormalizedLandmark] for the first hand

        # ---- Control On  with Thumb_Up ----
        if top_label == "Thumb_Up" and (time.time() - last_toggle) > 1.0:
            control_on = True
            last_toggle = time.time()

        # ---- Control Off  with Thumb_Down  ----
        if top_label == "Thumb_Down" and (time.time() - last_toggle) > 1.0:
            control_on = False
            last_toggle = time.time()

        # ---- Pointer mode with Pointing_Up ----
        if control_on and (top_label == "Pointing_Up") and landmarks:
            status = "Pointer"
            idx = landmarks[8]  # index fingertip
            x_norm, y_norm = float(idx.x), float(idx.y)
            tgt_x = max(0, min(SCREEN_W - 1, int(x_norm * SCREEN_W)))
            tgt_y = max(0, min(SCREEN_H - 1, int(y_norm * SCREEN_H)))
            cur_x = int(lerp(cur_x, tgt_x, POINT_SMOOTH_EMA))
            cur_y = int(lerp(cur_y, tgt_y, POINT_SMOOTH_EMA))
            pyautogui.moveTo(cur_x, cur_y, duration=0)

        # ---- Slide navigation (prefer model labels if present) ----
        slide_decided = False
        if control_on and (time.time() - last_action) > COOLDOWN_SECS:
            # 1) Try model-provided dynamic gesture names if available
            if PREFER_MODEL_SWIPES and top_label in ("Swipe_Left", "Swipe_Right"):
                if top_label == "Swipe_Left":
                    pyautogui.press("right")  # Next slide
                    status = "Model: Swipe_Left → Next"
                else:
                    pyautogui.press("left")   # Prev slide
                    status = "Model: Swipe_Right → Prev"
                last_action = time.time()
                slide_decided = True

            # 2) Fallback: simple swipe from index x history (requires landmarks)
            if not slide_decided and landmarks:
                idx = landmarks[8]
                x_history.append((time.time(), float(idx.x)))
                # trim history
                cutoff = time.time() - HISTORY_SECONDS
                while x_history and x_history[0][0] < cutoff:
                    x_history.popleft()

                swipe = detect_swipe_fallback(x_history)
                if swipe == "Swipe_Left":
                    pyautogui.press("right")  # Next
                    status = "FB: Swipe_Left → Next"
                    last_action = time.time()
                elif swipe == "Swipe_Right":
                    pyautogui.press("left")   # Prev
                    status = "FB: Swipe_Right → Prev"
                    last_action = time.time()

        # ---- HUD ----
        cv2.putText(frame_bgr, "Gesture Recognizer", (10, 28),
                    cv2.FONT_HERSHEY_DUPLEX, 0.8, (255,255,255), 2, cv2.LINE_AA)
        cv2.putText(frame_bgr, f"Mode: {'CONTROL ON' if control_on else 'CONTROL OFF (Thumb_Up to toggle)'}", (10, 56),
                    cv2.FONT_HERSHEY_COMPLEX, 0.7,
                    (0,200,255) if control_on else (120,120,120), 2, cv2.LINE_AA)
        if top_label:
            cv2.putText(frame_bgr, f"Gesture: {top_label} ({top_score:.2f})", (10, 84),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200,255,200), 2, cv2.LINE_AA)
        cv2.putText(frame_bgr, f"Status: {status}", (10, 112),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7,
                    (0,255,0) if "Swipe" in status or status=="Pointer" else (180,180,180), 2, cv2.LINE_AA)

        # Optional: draw landmarks for teaching
        if landmarks:
            for j, lm in enumerate(landmarks):
                cx, cy = int(lm.x * w), int(lm.y * h)
                cv2.circle(frame_bgr, (cx, cy), 2, (0,255,0), -1)

        cv2.imshow("Gesture Slides + Pointer (Q to quit)", frame_bgr)
        k = cv2.waitKey(1) & 0xFF
        if k in (ord('q'), 27):
            break

        prevTopLabel = top_label

    cap.release()
    cv2.destroyAllWindows()


def debugLog(label,value):
    print("\n###########     ",label,"     ###########")
    print(value)
    print("###########     ######################     ###########\n")


if __name__ == "__main__":
    main()
