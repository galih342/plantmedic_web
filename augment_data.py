import os
from PIL import Image, ImageEnhance
import numpy as np

def augment_folder(input_folder, target_count=300):
    """Augment semua gambar di folder sampai mencapai target_count"""
    
    # Cek gambar yang ada
    existing_images = [f for f in os.listdir(input_folder) 
                      if f.lower().endswith(('.jpg', '.png', '.jpeg'))]
    
    current_count = len(existing_images)
    folder_name = os.path.basename(input_folder)
    
    print(f"\n📂 {folder_name}")
    print(f"   Gambar saat ini: {current_count}")
    
    if current_count >= target_count:
        print(f"   ✅ Sudah cukup ({current_count} >= {target_count})")
        return
    
    if current_count == 0:
        print(f"   ❌ Folder kosong! Skip.")
        return
    
    augments_needed = target_count - current_count
    augments_per_image = (augments_needed // current_count) + 1
    
    print(f"   Target: {target_count} gambar")
    print(f"   Butuh: {augments_needed} gambar lagi")
    print(f"   Membuat {augments_per_image} variasi per gambar...")
    
    count = 0
    for img_file in existing_images:
        if count >= augments_needed:
            break
            
        img_path = os.path.join(input_folder, img_file)
        base_name = os.path.splitext(img_file)[0]
        
        try:
            img = Image.open(img_path).convert('RGB')
            original_size = img.size
            
            for i in range(augments_per_image):
                if count >= augments_needed:
                    break
                
                aug_img = img.copy()
                
                # 1. Rotate random
                angle = np.random.randint(-30, 30)
                aug_img = aug_img.rotate(angle, fillcolor=(255, 255, 255), expand=False)
                
                # 2. Flip horizontal (50% chance)
                if np.random.rand() > 0.5:
                    aug_img = aug_img.transpose(Image.FLIP_LEFT_RIGHT)
                
                # 3. Brightness
                brightness_factor = np.random.uniform(0.7, 1.3)
                enhancer = ImageEnhance.Brightness(aug_img)
                aug_img = enhancer.enhance(brightness_factor)
                
                # 4. Contrast
                contrast_factor = np.random.uniform(0.8, 1.2)
                enhancer = ImageEnhance.Contrast(aug_img)
                aug_img = enhancer.enhance(contrast_factor)
                
                # 5. Color
                color_factor = np.random.uniform(0.9, 1.1)
                enhancer = ImageEnhance.Color(aug_img)
                aug_img = enhancer.enhance(color_factor)
                
                # 6. Random crop & resize
                width, height = aug_img.size
                crop_factor = np.random.uniform(0.8, 0.95)
                new_w = int(width * crop_factor)
                new_h = int(height * crop_factor)
                
                left = np.random.randint(0, max(1, width - new_w))
                top = np.random.randint(0, max(1, height - new_h))
                
                aug_img = aug_img.crop((left, top, left + new_w, top + new_h))
                aug_img = aug_img.resize(original_size, Image.LANCZOS)
                
                # 7. Save
                output_filename = f"{base_name}_aug{count:04d}.jpg"
                output_path = os.path.join(input_folder, output_filename)
                aug_img.save(output_path, quality=95)
                
                count += 1
                
                # Progress indicator
                if count % 20 == 0:
                    print(f"   Progress: {count}/{augments_needed}", end='\r')
                    
        except Exception as e:
            print(f"\n   ⚠️ Error processing {img_file}: {e}")
            continue
    
    # Final count
    final_count = len([f for f in os.listdir(input_folder) 
                      if f.lower().endswith(('.jpg', '.png', '.jpeg'))])
    print(f"   ✅ Selesai! Total akhir: {final_count} gambar")

# ================= MAIN =================
if __name__ == "__main__":
    TRAIN_DIR = os.path.join("dataset", "train")
    
    if not os.path.exists(TRAIN_DIR):
        print(f"❌ Folder tidak ditemukan: {TRAIN_DIR}")
        print("💡 Pastikan struktur folder:")
        print("   dataset/")
        print("   └── train/")
        print("       ├── Daun Jambu Biji/")
        print("       ├── Daun Kari/")
        print("       └── ...")
        exit(1)
    
    print("="*60)
    print("🚀 DATA AUGMENTATION - PlantMedic")
    print("="*60)
    print(f"📁 Source: {TRAIN_DIR}")
    print(f"🎯 Target: 300 gambar per kelas")
    print("="*60)
    
    # List all class folders
    class_folders = sorted([d for d in os.listdir(TRAIN_DIR) 
                           if os.path.isdir(os.path.join(TRAIN_DIR, d))])
    
    if not class_folders:
        print(f"❌ Tidak ada subfolder di {TRAIN_DIR}")
        exit(1)
    
    print(f"📊 Ditemukan {len(class_folders)} kelas:")
    for folder in class_folders:
        print(f"   • {folder}")
    
    print("\n" + "="*60)
    input("⏸️  Tekan ENTER untuk mulai augmentation...")
    print("="*60)
    
    # Process each class
    for class_folder in class_folders:
        folder_path = os.path.join(TRAIN_DIR, class_folder)
        augment_folder(folder_path, target_count=300)
    
    # Summary
    print("\n" + "="*60)
    print("🎉 AUGMENTATION SELESAI!")
    print("="*60)
    
    total_images = 0
    print("\n📊 Ringkasan:")
    for class_folder in class_folders:
        folder_path = os.path.join(TRAIN_DIR, class_folder)
        count = len([f for f in os.listdir(folder_path) 
                    if f.lower().endswith(('.jpg', '.png', '.jpeg'))])
        print(f"   {class_folder}: {count} gambar")
        total_images += count
    
    print(f"\n✅ Total gambar training: {total_images}")
    print(f"📈 Dari ~640 → {total_images} gambar!")
    print("\n💡 Langkah selanjutnya:")
    print("   1. Jalankan: python train_model_transfer.py")
    print("   2. Monitor Epoch 1 - accuracy harus > 30%")
    print("="*60)