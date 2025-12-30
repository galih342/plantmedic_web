import tensorflow as tf
import numpy as np
import json
from PIL import Image
import os

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(BASE_DIR, "models", "plantmedic_model.h5")
LABEL_PATH = os.path.join(BASE_DIR, "labels.json")
DISEASE_DATA_PATH = os.path.join(BASE_DIR, "disease_data.json")

# LOAD MODEL
model = tf.keras.models.load_model(MODEL_PATH)
model = None

# LOAD LABEL
with open(LABEL_PATH, "r") as f:
    label_map = json.load(f)
 
labels = {v: k for k, v in label_map.items()}

# LOAD DISEASE DATA
with open(DISEASE_DATA_PATH, "r", encoding="utf-8") as f:
    disease_data = json.load(f)

    
def preprocess_image(image_path):
    img = Image.open(image_path).convert("RGB")
    img.thumbnail((224, 224), Image.Resampling.LANCZOS)

    new_img = Image.new("RGB", (224, 224), (0, 0, 0))
    paste_x = (224 - img.width) // 2
    paste_y = (224 - img.height) // 2
    new_img.paste(img, (paste_x, paste_y))

    img_array = np.array(new_img) / 255.0
    return np.expand_dims(img_array, axis=0)



def predict_image(image_path):
    model = load_model_once()
    img_array = preprocess_image(image_path)
    preds = model.predict(img_array, verbose=0)[0]

    top3_idx = preds.argsort()[-3:][::-1]
    top3 = [
        {
            "label": labels[i].strip(),
            "confidence": round(float(preds[i]) * 100, 2)
        }
        for i in top3_idx
    ]

    best = top3[0]
    label = best["label"]
    confidence = best["confidence"]

    detail = disease_data.get(label, {})

    # ===== LEVEL 1: < 40% =====
    if confidence < 40:
        return {
            "status": "tidak_dikenali",
            "label": "Tidak dikenali",
            "confidence": confidence,
            "description": (
                "Gambar belum dapat dikenali dengan baik. "
                "Pastikan foto daun jelas, fokus, dan pencahayaan cukup."
            ),
            "predictions": top3,
            "treatment": [],
            "prevention": [],
            "benefits": []
        }
 
    # ===== LEVEL 2: 40% – 69% =====
    if confidence < 70:
        return {
            "status": "perkiraan",
            "label": label,
            "confidence": confidence,
            "description": (
                "Tanaman ini belum dapat dikenali secara pasti. "
                "Namun memiliki kemiripan dengan beberapa tanaman berikut."
            ),
            "predictions": top3,
            "treatment": detail.get("treatment", []),
            "prevention": detail.get("prevention", []),
            "benefits": detail.get("benefits", [])
        }

    # ===== LEVEL 3: >= 70% =====
    overview = detail.get("overview", {})

    return {
        "status": "yakin",
        "label": label,
        "confidence": confidence,
        "description": overview.get("short", ""),
        "overview": overview,
        "treatment": detail.get("treatment", []),
        "prevention": detail.get("prevention", []),
        "benefits": detail.get("benefits", [])
    }
 

def load_model_once():
    global model
    if model is None:
        model = tf.keras.models.load_model(MODEL_PATH)
    return model







