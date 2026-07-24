"""Run YOLO pose on gamma-brightened frames of the concert video and save raw keypoints."""
import cv2
import numpy as np
import json
from ultralytics import YOLO

SRC = "/root/.claude/uploads/12e8e7a5-18ea-5e25-a6ea-4c8ab5751032/6057c3ec-oIYs1INpH8ApyNYcCVFD5C_TgdtTLaSa9jPkwBSa43Q.mp4"
OUT = "/tmp/claude-0/-home-user-claude/12e8e7a5-18ea-5e25-a6ea-4c8ab5751032/scratchpad/pose_raw.json"

model = YOLO("yolov8m-pose.pt")

lut = np.clip(((np.arange(256) / 255.0) ** 0.4) * 255.0, 0, 255).astype(np.uint8)

cap = cv2.VideoCapture(SRC)
records = []
idx = 0
while True:
    ok, frame = cap.read()
    if not ok:
        break
    bright = cv2.LUT(frame, lut)
    res = model.predict(bright, imgsz=640, conf=0.15, verbose=False)[0]
    people = []
    if res.keypoints is not None and res.boxes is not None:
        kps = res.keypoints.data.cpu().numpy()  # (N,17,3)
        boxes = res.boxes.data.cpu().numpy()    # (N,6) x1,y1,x2,y2,conf,cls
        for p in range(kps.shape[0]):
            people.append({
                "box": [round(float(v), 1) for v in boxes[p][:5]],
                "kp": [[round(float(v), 1) for v in kp] for kp in kps[p]],
            })
    records.append(people)
    idx += 1
cap.release()

with open(OUT, "w") as f:
    json.dump(records, f)

nz = sum(1 for r in records if r)
print(f"frames={len(records)} frames_with_person={nz}")
