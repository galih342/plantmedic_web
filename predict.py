import os
import json
import cv2
import traceback
import numpy as np
import tensorflow as tf
import requests
from PIL import Image, ImageEnhance, ImageFilter
from tensorflow.keras.layers import DepthwiseConv2D # Import class asli

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_FILENAME = "plantmedic_model_transfer.h5"
MODEL_PATH = os.path.join(BASE_DIR, "models", MODEL_FILENAME)
MODEL_URL = f"https://github.com/galih342/plantmedic_web/raw/main/models/{MODEL_FILENAME}"

LABEL_PATH = os.path.join(BASE_DIR, "labels.json")
DISEASE_DATA_PATH = os.path.join(BASE_DIR, "disease_data.json")

# ==========================================================
# 🚑 FIX KERAS 3 COMPATIBILITY (OBAT ERROR 'groups=1')
# ==========================================================
class FixedDepthwiseConv2D(DepthwiseConv2D):
    def __init__(self, **kwargs):
        # Kalau ada parameter 'groups', buang aja biar gak error
        if 'groups' in kwargs:
            kwargs.pop('groups')
        super().__init__(**kwargs)

# ================= AUTO-FIX LFS MODEL =================
def download_model_if_needed():
    need_download = False
    
    if not os.path.exists(MODEL_PATH):
        print("⚠️ Model file not found locally.")
        need_download = True
    else:
        file_size = os.path.getsize(MODEL_PATH)
        if file_size < 1000000:
            print(f"⚠️ File size is only {file_size} bytes. LFS pointer detected.")
            try:
                os.remove(MODEL_PATH)
            except:
                pass
            need_download = True
        else:
            print("✅ Model file seems valid.")

    if need_download:
        print(f"⬇️ Downloading model from {MODEL_URL}...")
        try:
            # Pastikan folder ada
            os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
            
            response = requests.get(MODEL_URL, stream=True)
            if response.status_code == 200:
                with open(MODEL_PATH, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                print("✅ Download complete!")
            else:
                raise Exception(f"Failed to download. Status: {response.status_code}")
        except Exception as e:
            print(f"❌ Error downloading model: {e}")
            raise e

# ================= LOAD MODEL =================
model = None

def load_model_once():
    global model
    if model is None:
        download_model_if_needed()
        
        print("🔄 Loading model...")
        
        # ✅ FIX: Masukkan 'FixedDepthwiseConv2D' ke custom_objects
        # Ini biar Python pake class 'penipu' kita saat baca file modelnya
        try:
            model = tf.keras.models.load_model(
                MODEL_PATH, 
                custom_objects={'DepthwiseConv2D': FixedDepthwiseConv2D}
            )
            print("✅ Model loaded successfully (patched)")
        except Exception as e:
            print("⚠️ Load error normal, mencoba tanpa patch...")
            # Fallback kalau errornya bukan itu
            model = tf.keras.models.load_model(MODEL_PATH)
            
    return model

# ================= LOAD LABEL & DATA =================
with open(LABEL_PATH, "r", encoding="utf-8") as f:
    raw_labels = json.load(f)
labels = {int(k): v for k, v in raw_labels.items()}

with open(DISEASE_DATA_PATH, "r", encoding="utf-8") as f:
    disease_data = json.load(f)

# ================= IMAGE UTILS =================
def assess_image_quality(image_path):
    try:
        img = cv2.imread(image_path)
        if img is None:
            pil_img = Image.open(image_path).convert("RGB")
            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        
        if img is None:
            return {"quality": "unknown", "error": "Cannot read image"}

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur = cv2.Laplacian(gray, cv2.CV_64F).var()
        brightness = gray.mean()
        contrast = gray.std() 

        quality = "good"
        issues = []
        if blur < 100:
            quality = "poor"
            issues.append("Gambar terlalu blur")
        if brightness < 50:
            quality = "poor"
            issues.append("Gambar terlalu gelap")
        elif brightness > 200:
            quality = "poor"
            issues.append("Gambar terlalu terang")
        
        return {
            "quality": quality,
            "blur": float(blur),
            "brightness": float(brightness),
            "contrast": float(contrast),
            "issues": issues
        }
    except Exception as e:
        return {"quality": "unknown", "error": str(e)}

def preprocess_image(image_path, target_size=(224, 224)):
    try:
        img = Image.open(image_path)
        img.thumbnail((1024, 1024))
        img = img.convert("RGB")
        img = img.resize(target_size)
        img_array = np.array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)
        return img_array
    except MemoryError:
        raise Exception("Gambar terlalu besar.")
    except Exception as e:
        raise Exception(f"Preprocessing error: {str(e)}")

# ================= MAIN PREDICT =================
def predict_image(image_path):
    try:
        model = load_model_once()
        quality_info = assess_image_quality(image_path)
        img_array = preprocess_image(image_path)

        preds = model.predict(img_array, verbose=0)[0]

        TOP_K = 3
        top_idx = np.argsort(preds)[-TOP_K:][::-1]

        top3 = []
        for i in top_idx:
            label = labels.get(i, "Tidak Dikenali")
            conf = float(preds[i] * 100)
            top3.append({"label": label, "confidence": round(conf, 2)})

        best = top3[0]
        best_conf = best["confidence"]
        best_label = best["label"]
        
        # Ambil data penyakit
        detail = disease_data.get(best_label, {})
        if not detail:
            # Fallback dummy data biar gak error
            detail = {"overview": {"short": f"Terdeteksi: {best_label}"}}
            
        overview = detail.get("overview", {})

        status = "yakin"
        msg = ""
        if best_conf < 20:
            status = "ragu"
            msg = f"Kemungkinan {best_label}, tapi sangat tidak yakin."
        elif best_conf < 35:
            status = "perkiraan"
            msg = f"Kemungkinan besar {best_label}."

        return {
            "status": status,
            "label": best_label,
            "confidence": best_conf,
            "message": msg,
            "description": overview.get("short", ""),
            "overview": overview,
            "treatment": detail.get("treatment", []),
            "prevention": detail.get("prevention", []),
            "predictions": top3,
            "quality_info": quality_info
        }

    except Exception as e:
        traceback.print_exc()
        raise Exception(f"Prediction failed: {str(e)}")
