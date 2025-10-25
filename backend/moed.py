import cv2

cam = cv2.VideoCapture(0, cv2.CAP_DSHOW)
if not cam.isOpened():
    raise RuntimeError("Webcam not accessible")

while True:
    ok, frame = cam.read()
    if not ok:
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (3, 3), 5)
    cv2.imshow("Blur", blur)
    edges = cv2.Canny(blur, 10, 200)

    cv2.imshow("Sketch-My-Face (press q to quit)", edges)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cam.release()
cv2.destroyAllWindows()