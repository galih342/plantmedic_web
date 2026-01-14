import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.models import Model
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from sklearn.model_selection import train_test_split
import albumentations as A
import cv2, os, json
import numpy as np

# =====================
# CONFIG
# =====================
IMG_SIZE = 224
BATCH_SIZE = 16
EPOCHS_INITIAL = 20  # Dari 50
EPOCHS_FINETUNE = 10  # Dari 30
DATASET_DIR = "dataset"

# =====================
# AUGMENTATION YANG BENAR
# =====================
# Untuk TRAINING saja
train_aug = A.Compose([
    A.RandomResizedCrop(IMG_SIZE, IMG_SIZE, scale=(0.7, 1.0)),  # Tidak terlalu agresif
    A.HorizontalFlip(p=0.5),
    A.Rotate(limit=15, p=0.3),  # Kurangi rotasi
    A.OneOf([  # Pilih SALAH SATU blur saja
        A.GaussianBlur(blur_limit=(3, 5), p=1.0),
        A.MotionBlur(blur_limit=5, p=1.0),
    ], p=0.2),
    A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.4),
    A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=20, val_shift_limit=10, p=0.3),
    A.GaussNoise(var_limit=(5.0, 20.0), p=0.2),
    A.ImageCompression(quality_lower=70, quality_upper=100, p=0.3),  # Quality lebih tinggi
])

# Untuk VALIDATION/TEST - TIDAK ADA AUGMENTASI
val_transform = A.Compose([
    A.Resize(IMG_SIZE, IMG_SIZE),
])

# =====================
# LOAD DATA DENGAN BENAR
# =====================
def load_images_proper(folder):
    """Load gambar tanpa augmentasi dulu"""
    X, y, paths = [], [], []
    class_map = {c: i for i, c in enumerate(sorted(os.listdir(folder)))}
    
    print(f"📂 Kelas yang ditemukan: {list(class_map.keys())}")
    
    for cls in class_map:
        cls_path = os.path.join(folder, cls)
        img_files = [f for f in os.listdir(cls_path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        
        print(f"   {cls}: {len(img_files)} gambar")
        
        for img_name in img_files:
            path = os.path.join(cls_path, img_name)
            img = cv2.imread(path)
            
            if img is None:
                print(f"⚠️ Gagal baca: {path}")
                continue
            
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            X.append(img)
            y.append(class_map[cls])
            paths.append(path)
    
    return X, y, class_map, paths

# Load semua data
X_raw, y_raw, class_map, img_paths = load_images_proper(DATASET_DIR)
print(f"\n✅ Total gambar: {len(X_raw)}")

# Split DULU sebelum augmentasi
X_train_raw, X_val_raw, y_train, y_val = train_test_split(
    X_raw, y_raw, 
    test_size=0.2, 
    random_state=42, 
    stratify=y_raw  # Pastikan setiap kelas proporsional
)

print(f"📊 Training: {len(X_train_raw)} | Validation: {len(X_val_raw)}")

# =====================
# APPLY AUGMENTASI
# =====================
def preprocess_images(images, augmentor, is_training=False):
    """Preprocess dengan/tanpa augmentasi"""
    processed = []
    for img in images:
        # Apply augmentasi
        augmented = augmentor(image=img)["image"]
        
        # Normalize
        augmented = augmented.astype(np.float32) / 255.0
        processed.append(augmented)
    
    return np.array(processed)

# Proses training data DENGAN augmentasi
print("\n🔄 Memproses training data...")
X_train = preprocess_images(X_train_raw, train_aug, is_training=True)

# Proses validation data TANPA augmentasi
print("🔄 Memproses validation data...")
X_val = preprocess_images(X_val_raw, val_transform, is_training=False)

# Convert labels ke categorical
y_train = tf.keras.utils.to_categorical(y_train, num_classes=len(class_map))
y_val = tf.keras.utils.to_categorical(y_val, num_classes=len(class_map))

print(f"✅ Shape - Train: {X_train.shape}, Val: {X_val.shape}")

# =====================
# MODEL YANG LEBIH BAIK
# =====================
base = MobileNetV2(
    weights="imagenet",
    include_top=False,
    input_shape=(IMG_SIZE, IMG_SIZE, 3)
)

# Freeze semua layer dulu
for layer in base.layers:
    layer.trainable = False

x = GlobalAveragePooling2D()(base.output)
x = Dense(256, activation="relu")(x)
x = Dropout(0.5)(x)  # Tambah dropout
x = Dense(128, activation="relu")(x)
x = Dropout(0.3)(x)
out = Dense(len(class_map), activation="softmax")(x)

model = Model(base.input, out)

# =====================
# COMPILE
# =====================
model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-3),  # Learning rate lebih tinggi untuk awal
    loss="categorical_crossentropy",
    metrics=["accuracy"]
)

print("\n📋 Model Summary:")
model.summary()

# =====================
# CALLBACKS
# =====================
callbacks = [
    EarlyStopping(
        monitor='val_accuracy',
        patience=10,
        restore_best_weights=True,
        verbose=1
    ),
    ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=5,
        min_lr=1e-7,
        verbose=1
    )
]

# =====================
# TRAIN PHASE 1: Freeze base model
# =====================
print("\n🚀 PHASE 1: Training classifier layers...")
history1 = model.fit(
    X_train, y_train,
    batch_size=BATCH_SIZE,
    epochs=20,
    validation_data=(X_val, y_val),
    callbacks=callbacks,
    verbose=1
)

# =====================
# TRAIN PHASE 2: Fine-tune
# =====================
print("\n🚀 PHASE 2: Fine-tuning top layers...")

# Unfreeze top layers
for layer in base.layers[-50:]:
    layer.trainable = True

# Compile ulang dengan learning rate lebih kecil
model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-5),  # LR sangat kecil untuk fine-tuning
    loss="categorical_crossentropy",
    metrics=["accuracy"]
)

history2 = model.fit(
    X_train, y_train,
    batch_size=BATCH_SIZE,
    epochs=30,
    validation_data=(X_val, y_val),
    callbacks=callbacks,
    verbose=1
)

# =====================
# EVALUATE
# =====================
print("\n📊 EVALUASI FINAL:")
train_loss, train_acc = model.evaluate(X_train, y_train, verbose=0)
val_loss, val_acc = model.evaluate(X_val, y_val, verbose=0)

print(f"Training Accuracy: {train_acc*100:.2f}%")
print(f"Validation Accuracy: {val_acc*100:.2f}%")

if val_acc < 0.7:
    print("\n⚠️ WARNING: Akurasi validasi masih rendah (<70%)")
    print("Kemungkinan penyebab:")
    print("  - Dataset terlalu kecil (butuh minimal 100 gambar/kelas)")
    print("  - Gambar terlalu bervariasi/mirip antar kelas")
    print("  - Kualitas gambar rendah")

# =====================
# SAVE
# =====================
os.makedirs("models", exist_ok=True)
model.save("models/plantmedic_model.h5")

# Simpan class map dengan urutan yang benar
reverse_map = {v: k for k, v in class_map.items()}
with open("labels.json", "w") as f:
    json.dump(reverse_map, f, indent=2)

print("\n✅ MODEL TERSIMPAN!")
print(f"📁 Model: models/plantmedic_model.h5")
print(f"📁 Labels: labels.json")
print(f"\n🎯 Kelas: {list(class_map.keys())}")