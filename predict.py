import os
import json
import cv2
import traceback
import numpy as np
import tensorflow as tf
import requests  # ✅ TAMBAHAN: Buat download manual
from PIL import Image, ImageEnhance, ImageFilter

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Sesuaikan nama file model kamu di sini
MODEL_FILENAME = "plantmedic_model_transfer.h5" 
MODEL_PATH = os.path.join(BASE_DIR, "models", MODEL_FILENAME)

# ✅ TAMBAHAN: Link RAW GitHub (Pastikan branch main dan path benar)
MODEL_URL = f"https://github.com/galih342/plantmedic_web/raw/main/models/{MODEL_FILENAME}"

LABEL_PATH = os.path.join(BASE_DIR, "labels.json")
DISEASE_DATA_PATH = os.path.join(BASE_DIR, "disease_data.json")

# ================= AUTO-FIX LFS MODEL =================
def download_model_if_needed():
    """Mengecek apakah file model rusak/pointer LFS, jika ya, download ulang."""
    need_download = False
    
    if not os.path.exists(MODEL_PATH):
        print("⚠️ Model file not found locally.")
        need_download = True
    else:
        # Cek ukuran file. File LFS pointer biasanya < 2KB (text file).
        # Model asli harusnya > 1MB.
        file_size = os.path.getsize(MODEL_PATH)
        if file_size < 1000000:  # Jika kurang dari 1MB (Pointer detected)
            print(f"⚠️ File size is only {file_size} bytes. This is likely an LFS pointer. Re-downloading real model...")
            try:
                os.remove(MODEL_PATH) # Hapus file pointer palsu
            except:
                pass
            need_download = True
        else:
            print("✅ Model file seems valid (Size correct).")

    if need_download:
        print(f"⬇️ Downloading model from {MODEL_URL}...")
        try:
            response = requests.get(MODEL_URL, stream=True)
            if response.status_code == 200:
                # Pastikan folder models ada
                os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
                
                with open(MODEL_PATH, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                print("✅ Download complete!")
            else:
                raise Exception(f"Failed to download model. Status code: {response.status_code}")
        except Exception as e:
            print(f"❌ Error downloading model: {e}")
            raise e

# ================= LOAD MODEL =================
model = None

def load_model_once():
    global model
    if model is None:
        # ✅ FIX: Jalankan pengecekan/download sebelum load
        download_model_if_needed()
        
        print("🔄 Loading model...")
        model = tf.keras.models.load_model(MODEL_PATH)
        print("✅ Model loaded successfully")
    return model

# ================= LOAD LABEL =================
with open(LABEL_PATH, "r", encoding="utf-8") as f:
    raw_labels = json.load(f)

# FIX: index (int) -> label (str)
labels = {int(k): v for k, v in raw_labels.items()}


# ================= LOAD DISEASE DATA =================
with open(DISEASE_DATA_PATH, "r", encoding="utf-8") as f:
    disease_data = json.load(f)

# ================= IMAGE UTILS =================
def enhance_image(img):
    img = img.filter(ImageFilter.SHARPEN)
    img = ImageEnhance.Contrast(img).enhance(1.5)
    img = ImageEnhance.Brightness(img).enhance(1.2)
    img = ImageEnhance.Color(img).enhance(1.1)
    return img


def assess_image_quality(image_path):
    try:
        # Method 1: Try cv2.imread
        img = cv2.imread(image_path)
        
        # Method 2: Jika gagal, gunakan PIL
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
        elif blur < 200:
            issues.append("Gambar sedikit blur")
            
        if brightness < 50:
            quality = "poor"
            issues.append("Gambar terlalu gelap")
        elif brightness > 200:
            quality = "poor"
            issues.append("Gambar terlalu terang")
            
        if contrast < 30:
            if quality == "good":
                quality = "medium"
            issues.append("Kontras rendah")

        return {
            "quality": quality,
            "blur": float(blur),
            "brightness": float(brightness),
            "contrast": float(contrast),
            "issues": issues
        }
    except Exception as e:
        print(f"⚠️ Quality assessment error: {e}")
        return {"quality": "unknown", "error": str(e)}

# 🔧 FIX: Preprocessing dengan white background
def preprocess_image(image_path, target_size=(224, 224)):
    try:
        img = Image.open(image_path)

        # 🔥 BATASI RESOLUSI MAKSIMAL
        img.thumbnail((1024, 1024))

        img = img.convert("RGB")
        img = img.resize(target_size)

        img_array = np.array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        return img_array

    except MemoryError:
        raise Exception("Gambar terlalu besar. Silakan upload gambar dengan resolusi lebih kecil.")

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
        CONF_RAGU = 20
        CONF_PERKIRAAN = 35

        top_idx = np.argsort(preds)[-TOP_K:][::-1]

        top3 = []
        for i in top_idx:
            label = labels.get(i, "Tidak Dikenali")
            conf = float(preds[i] * 100)

            top3.append({
                "label": label,
                "confidence": round(conf, 2)
            })

        # Debug logs
        print("=" * 50)
        print("🔍 DEBUG PREDICTIONS:")
        for i, pred in enumerate(top3):
            print(f"{i+1}. {pred['label']}: {pred['confidence']:.2f}%")
        print("=" * 50)

        best = top3[0]
        best_conf = best["confidence"]
        best_label = best["label"]

        # ================= RAGU =================
        if best_conf < CONF_RAGU:
            # ✅ AMBIL DATA PENYAKIT MESKIPUN RAGU
            detail = disease_data.get(best_label, {})

            overview = detail.get("overview", {})
            
            return {
                "status": "ragu",
                "label": best_label, 
                "confidence": best_conf,
                "message": f"Kemungkinan adalah {best_label}, namun tingkat keyakinan masih rendah ({best_conf:.1f}%). Coba foto dengan pencahayaan lebih baik.",
                "description": overview.get("short", "Informasi belum tersedia"), 
                "overview": overview, 
                "treatment": detail.get("treatment", []), 
                "prevention": detail.get("prevention", []), 
                "predictions": top3,
                "quality_info": quality_info
            }

        # ================= PERKIRAAN =================
        if best_conf < CONF_PERKIRAAN:
            detail = disease_data.get(best_label, {})
            overview = detail.get("overview", {})
            
            return {
                "status": "perkiraan",
                "label": best_label,
                "confidence": best_conf,
                "message": f"Kemungkinan besar adalah {best_label}, namun tingkat keyakinan masih rendah.",
                "description": overview.get("short", ""),
                "predictions": top3,
                "treatment": detail.get("treatment", []) if detail else [],
                "prevention": detail.get("prevention", []) if detail else [],
                "quality_info": quality_info
            }

         # ================= YAKIN =================
        detail = disease_data.get(best_label, {})
        overview = detail.get("overview", {})

        # ✅ TAMBAHKAN FALLBACK
        if not detail:
            print(f"⚠️ WARNING: '{best_label}' tidak ada di disease_data.json")
            detail = {
                "overview": {
                    "short": f"Tanaman terdeteksi sebagai {best_label}",
                    "detail": "Informasi detail belum tersedia. Silakan tambahkan data untuk label ini."
                },
                "treatment": ["Data perawatan belum tersedia"],
                "prevention": ["Data pencegahan belum tersedia"],
                "benefits": []
            }
            overview = detail["overview"]

        return {
            "status": "yakin",
            "label": best_label,
            "confidence": best_conf,
            "description": overview.get("short", f"Terdeteksi sebagai {best_label}"),
            "overview": overview,
            "treatment": detail.get("treatment", ["Belum ada data"]),
            "prevention": detail.get("prevention", ["Belum ada data"]),
            "benefits": detail.get("benefits", []),
            "predictions": top3,
            "quality_info": quality_info
        }

    except Exception as e:
        traceback.print_exc()
        raise Exception(f"Prediction failed: {str(e)}")
