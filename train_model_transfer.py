import os
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras.applications import EfficientNetB3
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.models import Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping

# ================= KONFIGURASI =================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
TRAIN_DIR = os.path.join(DATASET_DIR, "train")  # ✅ Pakai folder train
TEST_DIR = os.path.join(DATASET_DIR, "test")    # ✅ Pakai folder test
MODEL_SAVE_PATH = os.path.join(BASE_DIR, "models", "plantmedic_model_transfer.h5")
LABEL_PATH = os.path.join(BASE_DIR, "labels.json")

# Hyperparameters
IMG_SIZE = 224
BATCH_SIZE = 8
EPOCHS_INITIAL = 50
EPOCHS_FINETUNE = 30
LEARNING_RATE_INITIAL = 0.001
LEARNING_RATE_FINETUNE = 0.0001

# ================= CEK FOLDER =================
if not os.path.exists(TRAIN_DIR):
    raise Exception(f"❌ Folder train tidak ditemukan: {TRAIN_DIR}")
if not os.path.exists(TEST_DIR):
    raise Exception(f"❌ Folder test tidak ditemukan: {TEST_DIR}")

print(f"✅ Train folder: {TRAIN_DIR}")
print(f"✅ Test folder: {TEST_DIR}")

# ================= LOAD LABELS =================
with open(LABEL_PATH, "r") as f:
    label_map_original = json.load(f)

# ✅ Balik mapping (dari {"Daun Mint": 4} jadi {"4": "Daun Mint"})
label_map = {str(v): k for k, v in label_map_original.items()}

num_classes = len(label_map)
print(f"\n📊 Jumlah kelas: {num_classes}")
print(f"📋 Kelas: {list(label_map_original.keys())}")

checkpoint = ModelCheckpoint(
    "model/model_checkpoint.h5",
    monitor="val_accuracy",
    save_best_only=True,
    verbose=1
)

early_stop = EarlyStopping(
    monitor='val_loss',
    patience=5,
    restore_best_weights=True
)


# ================= DATA GENERATORS =================
# Data augmentation untuk training
train_datagen = ImageDataGenerator(
    rescale=1./255,
    rotation_range=30,
    width_shift_range=0.2,
    height_shift_range=0.2,
    shear_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True,
    vertical_flip=True,
    fill_mode='nearest',
    validation_split=0.2  # 80% train, 20% validation dari folder train
)

# Generator untuk test (no augmentation)
test_datagen = ImageDataGenerator(rescale=1./255)

# ✅ Generator untuk TRAINING (dari folder train, subset training)
train_generator = train_datagen.flow_from_directory(
    TRAIN_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='training',
    shuffle=True
)

# ✅ Generator untuk VALIDATION (dari folder train, subset validation)
val_generator = train_datagen.flow_from_directory(
    TRAIN_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='validation',
    shuffle=False
)

# ✅ Generator untuk TEST (dari folder test)
test_generator = test_datagen.flow_from_directory(
    TEST_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    shuffle=False
)

print(f"\n✅ Training samples: {train_generator.samples}")
print(f"✅ Validation samples: {val_generator.samples}")
print(f"✅ Test samples: {test_generator.samples}")

# Cek mapping kelas
print(f"\n📂 Class indices dari generator:")
for class_name, idx in sorted(train_generator.class_indices.items()):
    print(f"   {class_name}: {idx}")

# ================= COMPUTE CLASS WEIGHTS =================
train_labels = train_generator.classes
class_weights = compute_class_weight(
    'balanced',
    classes=np.unique(train_labels),
    y=train_labels
)
class_weight_dict = dict(enumerate(class_weights))

print(f"\n⚖️ Class weights:")
for idx, weight in class_weight_dict.items():
    class_name = list(train_generator.class_indices.keys())[idx]
    print(f"   {class_name}: {weight:.2f}")

# ================= BUILD MODEL =================
print("\n🔄 Loading EfficientNetB3...")

base_model = EfficientNetB3(
    weights='imagenet',
    include_top=False,
    input_shape=(IMG_SIZE, IMG_SIZE, 3)
)

# ✅ Unfreeze sebagian layer
base_model.trainable = True

# Freeze hanya 100 layer pertama
for i, layer in enumerate(base_model.layers):
    if i < 100:
        layer.trainable = False
    else:
        layer.trainable = True

trainable_count = sum([1 for l in base_model.layers if l.trainable])
print(f"🔓 Trainable layers: {trainable_count}/{len(base_model.layers)}")

x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(512, activation='relu', kernel_regularizer=tf.keras.regularizers.l2(0.01))(x)
x = Dropout(0.4)(x)
x = Dense(256, activation='relu', kernel_regularizer=tf.keras.regularizers.l2(0.01))(x)
x = Dropout(0.3)(x)
predictions = Dense(num_classes, activation='softmax')(x)

model = Model(inputs=base_model.input, outputs=predictions)

print("✅ Model architecture created")
print(f"📊 Total parameters: {model.count_params():,}")

# ================= COMPILE MODEL =================
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=LEARNING_RATE_INITIAL),
    loss='categorical_crossentropy',
    metrics=['accuracy', tf.keras.metrics.TopKCategoricalAccuracy(k=3, name='top_3_accuracy')]
)

# ================= CALLBACKS =================
callbacks = [
    tf.keras.callbacks.EarlyStopping(
        monitor='val_loss',
        patience=10,
        restore_best_weights=True,
        verbose=1
    ),
    tf.keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=5,
        min_lr=1e-7,
        verbose=1
    ),
    tf.keras.callbacks.ModelCheckpoint(
        filepath=MODEL_SAVE_PATH.replace('.h5', '_checkpoint.h5'),
        monitor='val_accuracy',
        save_best_only=True,
        verbose=1
    )
]

# ================= PHASE 1: INITIAL TRAINING =================
print("\n" + "="*60)
print("🚀 PHASE 1: Initial Training (Frozen Base Model)")
print("="*60)

history1 = model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=EPOCHS_INITIAL,
    class_weight=class_weight_dict,
    callbacks=callbacks,
    verbose=1
)

print("\n✅ Phase 1 completed!")
print(f"📊 Best validation accuracy: {max(history1.history['val_accuracy']):.4f}")

# ================= PHASE 2: FINE-TUNING =================
print("\n" + "="*60)
print("🔥 PHASE 2: Fine-Tuning (Unfreeze Base Model)")
print("="*60)

base_model.trainable = True

for layer in base_model.layers[:100]:
    layer.trainable = False

print(f"📊 Trainable parameters: {sum([tf.size(w).numpy() for w in model.trainable_weights]):,}")

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=LEARNING_RATE_FINETUNE),
    loss='categorical_crossentropy',
    metrics=['accuracy', tf.keras.metrics.TopKCategoricalAccuracy(k=3, name='top_3_accuracy')]
)

history2 = model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=EPOCHS_FINETUNE,
    class_weight=class_weight_dict,
    callbacks=callbacks,
    verbose=1
)

print("\n✅ Phase 2 completed!")
print(f"📊 Best validation accuracy: {max(history2.history['val_accuracy']):.4f}")

# ================= SAVE MODEL =================
print("\n💾 Saving final model...")
model.save(MODEL_SAVE_PATH)
print(f"✅ Model saved to: {MODEL_SAVE_PATH}")

# ================= EVALUATION ON TEST SET =================
print("\n" + "="*60)
print("📊 FINAL EVALUATION ON TEST SET")
print("="*60)

test_loss, test_acc, test_top3 = model.evaluate(test_generator, verbose=1)

print(f"\n✅ Test Loss: {test_loss:.4f}")
print(f"✅ Test Accuracy: {test_acc*100:.2f}%")
print(f"✅ Top-3 Accuracy: {test_top3*100:.2f}%")

# Evaluation on validation
val_loss, val_acc, val_top3 = model.evaluate(val_generator, verbose=0)

print(f"\n📊 Validation Accuracy: {val_acc*100:.2f}%")
print(f"📊 Validation Top-3 Accuracy: {val_top3*100:.2f}%")

# ================= SAVE TRAINING HISTORY =================
history_path = os.path.join(BASE_DIR, "training_history.json")
full_history = {
    'phase1': {k: [float(v) for v in val] for k, val in history1.history.items()},
    'phase2': {k: [float(v) for v in val] for k, val in history2.history.items()},
    'final_metrics': {
        'test_loss': float(test_loss),
        'test_accuracy': float(test_acc),
        'test_top3_accuracy': float(test_top3),
        'val_loss': float(val_loss),
        'val_accuracy': float(val_acc),
        'val_top3_accuracy': float(val_top3)
    }
}

with open(history_path, 'w') as f:
    json.dump(full_history, f, indent=2)

print(f"\n✅ Training history saved to: {history_path}")

print("\n" + "="*60)
print("🎉 TRAINING COMPLETED!")
print("="*60)
print(f"\n📁 Model tersimpan di: {MODEL_SAVE_PATH}")
print(f"📈 Test Accuracy: {test_acc*100:.2f}%")
print(f"📈 Validation Accuracy: {val_acc*100:.2f}%")
print(f"\n💡 Untuk menggunakan model ini:")
print(f"   1. Ganti MODEL_PATH di predict.py ke:")
print(f"      MODEL_PATH = os.path.join(BASE_DIR, 'models', 'plantmedic_model_transfer.h5')")
print(f"   2. Restart aplikasi: python app.py")