document.addEventListener("DOMContentLoaded", () => {
  // ⛔ JIKA BUKAN DASHBOARD, STOP
  if (!document.body.classList.contains("dashboard-page")) return;

  // =======================
  // GLOBAL STATE & CONSTANTS
  // =======================
  let imageDetected = false;
  let isTypingDone = false;
  let hasImage = false;
  let stopTyping = false;
  let autoScrollEnabled = true;
  let lastPredictionLabel = "";
  let isHistoryMode = false; // 🔥 FLAG KHUSUS HISTORY
  let activeChatId = null; // 🔥 CHAT YANG SEDANG TERBUKA
  let isSidebarOpen = false;



  const closeBtn = document.getElementById("closeSidebarBtn");
  const sidebar = document.getElementById("sidebar");
  const toggleSidebar = document.getElementById("toggleSidebar");
  const overlay = document.getElementById("overlay");
  const menuBtn = document.getElementById("menuBtn");

  
  window.addEventListener("resize", syncHamburgerVisibility);
  document.addEventListener("visibilitychange", syncHamburgerVisibility);


function openSidebar() {
  isSidebarOpen = true;
  sidebar.classList.remove("-translate-x-full");

  if (isMobile()) {
    overlay.classList.remove("hidden");
    overlay.classList.add("pointer-events-auto");
    document.body.classList.add("overflow-hidden", "body-sidebar-open");
  }

  syncHamburgerVisibility();
}

function closeSidebar() {
  isSidebarOpen = false;

  if (isMobile()) {
    sidebar.classList.add("-translate-x-full");
    overlay.classList.add("hidden");
    overlay.classList.remove("pointer-events-auto");
    document.body.classList.remove("overflow-hidden", "body-sidebar-open");
  }

  syncHamburgerVisibility();
}


    menuBtn?.addEventListener("click", (e) => {
    if (isSidebarOpen) return;
    openSidebar();
  });

  closeBtn?.addEventListener("click", (e) => {
    if (!isSidebarOpen) return;
    closeSidebar();
  });

  overlay?.addEventListener("click", () => {
    if (!isMobile()) return;
    if (!isSidebarOpen) return;
    closeSidebar();
  });


  function isMobile() {
    return window.innerWidth < 1024;
  }

// Tambahkan event listener untuk semua item history chat
function attachHistoryChatListeners() {
  const historyItems = document.querySelectorAll('.history-item, [data-history-item]');
  
  historyItems.forEach(item => {
    item.addEventListener('click', () => {
      // Tutup sidebar di mobile setelah memilih history
      if (isMobile() && isSidebarOpen) {
        closeSidebar();
      }
    });
  });
}

// Panggil setelah DOM ready atau setelah history list di-render
attachHistoryChatListeners();

// Jika history list di-generate dinamis, panggil fungsi ini setiap kali list di-update
// Contoh: setelah loadChatHistory() atau fungsi sejenis

// ✅ PASTIKAN HANYA ADA 1 FUNGSI syncHamburgerVisibility
function syncHamburgerVisibility() {
  if (!menuBtn) return; // Safety check
  
  if (isMobile() && isSidebarOpen) {
    menuBtn.classList.add("hidden");
  } else {
    menuBtn.classList.remove("hidden");
  }

}


  // =======================
  // BASIC ELEMENTS
  // =======================
  const uploadForm = document.getElementById("uploadForm");
  const dropZone = document.getElementById("dropZone");
  const plantInput = document.getElementById("fileInput");
  const previewCard = document.getElementById("previewCard");
  const previewImg = document.getElementById("previewImg");
  const dropContent = document.getElementById("dropContent");
  
  const sendBtn = document.getElementById("sendBtn");
  const closePreviewBtn = document.getElementById("closePreview");
  const stopTypingBtn = document.getElementById("stopTypingBtn");
  const aiResult = document.getElementById("aiResult");
  const aiDivider = document.getElementById("aiDivider");
  const archiveChatBtn = document.getElementById("archiveChatBtn");
  const resetBtn = document.getElementById("resetChatBtn");

  // Elements for Modals
  const accountBtn = document.getElementById("accountBtn");
  const accountMenu = document.getElementById("accountMenu");
  const archiveBtn = document.getElementById("archiveBtn");
  const archiveModal = document.getElementById("archiveModal");
  const globalOverlay = document.getElementById("globalOverlay");
  const closeArchiveModal = document.getElementById("closeArchiveModal");
  
  // Initial State
  if (sendBtn) sendBtn.disabled = true;

  // =======================
  // ACCOUNT MENU LOGIC
  // =======================
  accountBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    accountMenu?.classList.toggle("hidden");
  });

  accountMenu?.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  window.addEventListener("click", (e) => {
    if (accountMenu && !accountMenu.contains(e.target) && !accountBtn?.contains(e.target)) {
      accountMenu.classList.add("hidden");
    }
  });


function archiveAndReset() {
  if (!activeChatId) return;

  saveChatToArchive();

  let history = JSON.parse(localStorage.getItem("chatHistory")) || [];
  history = history.filter(item => item.id !== activeChatId);
  localStorage.setItem("chatHistory", JSON.stringify(history));

  resetAll();
  activeChatId = null;

  renderHistory();
  renderArchiveList();
}

archiveChatBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();

  // 1. Validasi
  if (!activeChatId) {
    alert("⚠️ Tidak ada chat aktif yang tersimpan di database. Silakan analisis dulu.");
    return;
  }

  // 2. Konfirmasi (Opsional)
  if (!confirm("Arsipkan chat ini? Chat akan dipindahkan ke menu Arsip.")) return;

  // 3. Proses Arsip ke Database
  const success = await archiveChatToDatabase(activeChatId);

  if (success) {
    // 4. Jika sukses, Bersihkan UI (Reset ke mode awal)
    resetAll(); // Pastikan fungsi resetAll() kamu sudah mereset text & gambar
    activeChatId = null;
    
    // 5. Refresh List History & Archive (agar sinkron)
    await renderHistory();
    // Jika modal archive sedang terbuka (jarang terjadi, tapi jaga-jaga)
    if (!archiveModal.classList.contains("hidden")) {
      await renderArchiveList();
    }
  }
});

function closeArchive() {
  archiveModal?.classList.add("hidden");
  archiveModal?.classList.remove("flex");
  globalOverlay?.classList.add("hidden");
  
  enterImageMode(); // 🔥 TAMBAHKAN INI
}

closeArchiveModal?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  console.log("❌ Closing archive modal...");
  closeArchive();
});

globalOverlay?.addEventListener("click", (e) => {
  if (e.target === globalOverlay) {
    console.log("🖱️ Overlay clicked, closing archive...");
    closeArchive();
  }
});


  // Close saat klik overlay
  globalOverlay?.addEventListener("click", (e) => {
    if (e.target === globalOverlay) {
      closeArchiveModal?.click();
    }
  });

  // =======================
  // MODAL: PROFILE (EDIT PROFILE)
  // =======================
  const profileBtn = document.getElementById("profileBtn");
  const profileModal = document.getElementById("profileModal");
  const profileOverlay = document.getElementById("profileOverlay");
  const closeProfileModal = document.getElementById("closeProfileModal");

  profileBtn?.addEventListener("click", () => {
    if (hasImage) exitImageMode(); // ✅ pakai STATE, bukan DOM

    profileModal?.classList.remove("hidden");
    profileOverlay?.classList.remove("hidden");
    profileOverlay?.classList.remove("pointer-events-none");
    accountMenu?.classList.add("hidden");
  });


function closeProfile() {
  profileModal?.classList.add("hidden");
  profileOverlay?.classList.add("hidden");
  profileOverlay?.classList.add("pointer-events-none");
  
  enterImageMode(); // 🔥 SUDAH ADA, pastikan tidak dihapus
}

  closeProfileModal?.addEventListener("click", closeProfile);
  profileOverlay?.addEventListener("click", closeProfile);

  // =======================
  // MODAL: ACCOUNT DETAIL
  // =======================
  const accountModalBtn = document.getElementById("accountModalBtn");
  const accountModal = document.getElementById("accountModal");
  const accountOverlay = document.getElementById("accountOverlay");
  const closeAccountModal = document.getElementById("closeAccountModal");

 accountModalBtn?.addEventListener("click", () => {
    accountModal?.classList.remove("hidden");
    accountOverlay?.classList.remove("hidden");
    accountOverlay?.classList.remove("pointer-events-none");
    accountMenu?.classList.add("hidden");
  });

  function closeAccount() {
    accountModal?.classList.add("hidden");
    accountOverlay?.classList.add("hidden");
    accountOverlay?.classList.add("pointer-events-none");

     enterImageMode(); // 🔥 SUDAH ADA, pastikan tidak dihapus
  }

  closeAccountModal?.addEventListener("click", closeAccount);
  accountOverlay?.addEventListener("click", closeAccount);

  // Check critical upload elements
  if (!uploadForm || !dropZone || !fileInput) return;

  // =======================
  // HELPER UI FUNCTIONS
  // =======================
  window.toggleMenu = function (e, btn) {
    e.stopPropagation();
    document.querySelectorAll(".menu").forEach((menu) => {
      if (menu !== btn.nextElementSibling) {
        menu.classList.add("hidden");
      }
    });
    btn.nextElementSibling.classList.toggle("hidden");
  };

  function showStopBtn() {
    stopTypingBtn?.classList.remove("hidden");
    requestAnimationFrame(() => {
      stopTypingBtn?.classList.remove("opacity-0", "scale-95");
    });
  }

  function hideStopBtn() {
    stopTypingBtn?.classList.add("opacity-0", "scale-95");
    setTimeout(() => {
      stopTypingBtn?.classList.add("hidden");
    }, 200);
  }

  function showArchiveBtn() {
    archiveChatBtn?.classList.remove("hidden");
    requestAnimationFrame(() => {
      archiveChatBtn?.classList.remove("opacity-0", "scale-95");
    });
  }

  function hideArchiveBtn() {
    archiveChatBtn?.classList.add("opacity-0", "scale-95");
    setTimeout(() => {
      archiveChatBtn?.classList.add("hidden");
    }, 200);
  }

  function lockDetect() {
    sendBtn.disabled = true;
    sendBtn.style.pointerEvents = "none";
  }

  function unlockDetect() {
    sendBtn.disabled = false;
    sendBtn.style.pointerEvents = "auto";
  }


  function syncClosePreviewBtn() {
    if (hasImage) {
      closePreviewBtn?.classList.remove("hidden", "opacity-0");
    } else {
      closePreviewBtn?.classList.add("hidden", "opacity-0");
    }
  }


  // =======================
  // DROPZONE LOGIC
  // =======================

  // 1️⃣ Click to upload
  dropZone.addEventListener('click', (e) => {
      if (e.target !== closePreviewBtn) {
          fileInput.click();
      }
  });


// 2️⃣ File selected via input
plantInput.addEventListener("change", (e) => {
  const file = e.target.files[0];

  console.log("Plant image:", file);

  if (!file) return;

  // 🔥 VALIDASI 1: HARUS GAMBAR
  if (!file.type.startsWith("image/")) {
    alert("❌ File harus berupa gambar (JPG, PNG, WebP)");
    plantInput.value = "";
    return;
  }
    
    // 🔥 VALIDASI 2: UKURAN MAKSIMAL 5 MB
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    
    if (file.size > MAX_FILE_SIZE) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        alert(`❌ Ukuran gambar: ${fileSizeMB} MB Maksimal: 5 MB`);
        fileInput.value = '';
        return;
    }
    
    // ✅ JIKA VALID
    showImagePreview(file);
});


// 3️⃣ Drag over
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-primary', 'bg-emerald-50');
});


// 4️⃣ Drag leave
dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-primary', 'bg-emerald-50');
});

// =======================
// HELPER: VALIDATE FILE
// =======================
function validateFile(file) {
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  
  // Check 1: File exists
  if (!file) {
    return { valid: false, error: '❌ Tidak ada file yang dipilih' };
  }
  
  // Check 2: Must be image
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: '❌ File harus berupa gambar (JPG, PNG, WebP)' };
  }
  
  // Check 3: Size limit
  if (file.size > MAX_FILE_SIZE) {
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    return { 
      valid: false, 
      error: `❌ Ukuran gambar: ${fileSizeMB} MB Maksimal: 5 MB`
    };
  }
  
  return { valid: true };
}

// 5️⃣ Drop file
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-primary', 'bg-emerald-50');
    
    const file = e.dataTransfer.files[0];
    
    // 🔥 VALIDASI 1: FILE HARUS ADA
    if (!file) {
        alert('❌ Tidak ada file yang di-drop');
        return;
    }
    
    // 🔥 VALIDASI 2: HARUS GAMBAR
    if (!file.type.startsWith('image/')) {
        alert('❌ File harus berupa gambar (JPG, PNG, WebP)');
        return;
    }
    
    // 🔥 VALIDASI 3: UKURAN MAKSIMAL 5 MB
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    
    if (file.size > MAX_FILE_SIZE) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        alert(`❌ Ukuran gambar: ${fileSizeMB} MB Maksimal: 5 MB`);
        return;
    }
    
    // ✅ JIKA SEMUA VALIDASI LOLOS
    fileInput.files = e.dataTransfer.files;
    showImagePreview(file);
});




//===========================
// SHOW IMAGE PREVIEW
// ===========================
function showImagePreview(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    hasImage = true;
    imageDetected = true;

    // 🔥 SEMBUNYIKAN PLACEHOLDER
    dropContent?.classList.add("hidden");

    previewImg.src = e.target.result;
    previewCard.classList.remove("hidden");

    dropZone.classList.remove("idle");
    dropZone.classList.add("dropzone-preview");

    closePreviewBtn?.classList.remove("hidden", "opacity-0");
    unlockDetect();
  };

  reader.readAsDataURL(file);
}





// ===========================
// RESET/CLEAR PREVIEW
// ===========================
function resetPreview() {
  hasImage = false;
  imageDetected = false;

  previewImg.src = "";
  previewCard.classList.add("hidden");
  closePreviewBtn?.classList.add("hidden", "opacity-0");

  fileInput.value = "";

  dropZone.classList.remove("dropzone-preview", "is-history");

  dropZone.style.cursor = "pointer";
  dropZone.style.opacity = "1";

  // 🔥 TAMPILKAN PLACEHOLDER
  dropContent?.classList.remove("hidden");
  dropContent.style.display = "flex";

  lockDetect();
}




// ===========================
// CLOSE PREVIEW BUTTON
// ===========================
closePreviewBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  console.log("❌ Close preview clicked");
  
  // 🔥 JIKA DALAM MODE HISTORY, JANGAN HAPUS GAMBAR
  if (isHistoryMode) {
    console.log("⚠️ Cannot remove image in history mode");
    return;
  }
  
  // 🔥 HANYA HAPUS JIKA BUKAN HISTORY
  removeImageOnly();
});


function handleDroppedFile(file) {
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("Ukuran gambar tidak boleh lebih dari 5 MB");
    resetAll();
    return;
  }

  // sinkronkan file ke input
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;

  showPreview(file);     // 🔥 tampilkan preview
  unlockDetect();        // 🔥 PAKSA ENABLE
}



function setDropzoneMode(mode) {
  if (!dropZone) return;

  // bersihkan semua mode dulu
  dropZone.classList.remove("idle", "dropzone-preview", "is-history");

  // set mode sesuai kondisi
  switch (mode) {

    case "preview":
      dropZone.classList.add("dropzone-preview");
      break;

    case "history":
      dropZone.classList.add("is-history");
      break;
  }
}



  // =======================
  // CHAT & TYPING LOGIC
  // =======================
  window.addEventListener("scroll", () => {
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 120;
    autoScrollEnabled = nearBottom;
  });

  stopTypingBtn?.addEventListener("click", () => {
    stopTyping = true;
    hideStopBtn();
    lockDetect();
  });

  function typeText(element, text, baseSpeed = 12) {
    return new Promise((resolve) => {
      element.textContent = "";
      let index = 0;
      stopTyping = false;
      lockDetect();
      showStopBtn();
      hideArchiveBtn();

      function typing() {
        if (stopTyping || index >= text.length) {
          hideStopBtn();
          showArchiveBtn();
          lockDetect();
          resolve();
          return;
        }
        element.textContent += text[index];
        index++;
        if (autoScrollEnabled) {
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        }
        setTimeout(typing, baseSpeed);
      }
      typing();
    });
  }


// =======================
// 4. TAMBAHKAN CSS UNTUK CURSOR & ANIMASI
// =======================

// Update bagian style CSS dengan menambahkan animasi ini
const style = document.createElement('style');
style.textContent = `
  /* Existing styles... */
  
  /* ===== NEW ANIMATIONS ===== */
  
  /* Fade In Animation */
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.5s ease-out;
  }
  
  /* Slide Up Animation */
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-slideUp {
    animation: slideUp 0.6s ease-out;
  }
  
  /* Progress Bar Animation */
  @keyframes progressBar {
    from {
      width: 0%;
    }
  }
  
  .animate-progressBar {
    animation: progressBar 1.5s ease-out forwards;
  }
  
  /* Bounce Animation (for icons) */
  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-5px);
    }
  }
  
  .animate-bounce {
    animation: bounce 1s infinite;
  }
  
  /* Pulse Animation */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  /* Gradient Animation */
  @keyframes gradientShift {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
  
  .animate-gradient {
    background-size: 200% 200%;
    animation: gradientShift 3s ease infinite;
  }
  
  /* Smooth transitions for all elements */
  .transition-all {
    transition: all 0.3s ease;
  }
  
  /* Hover effects */
  .hover-lift:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  }

  /* Existing typing cursor and other styles... */
  .typing-cursor {
    display: inline-block;
    animation: blink 1s step-end infinite;
    margin-left: 2px;
    color: #10b981;
    font-weight: bold;
  }

  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  
  /* Rest of existing styles... */
`;
document.head.appendChild(style);


  function cleanText(text) {
    if (!text) return "";
    return text
      .replace(/Hasil Analisis Tanaman/gi, "")
      .replace(/🌿|🧾/g, "")
      .replace(/\*\*/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  

// =======================
// 5. UPDATE FORM SUBMISSION DENGAN ANIMASI
// =======================

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const file = fileInput.files[0];
  if (!file) {
    alert("Upload gambar dulu");
    return;
  }

  // ✅ Validasi tipe file
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    alert("Format file tidak didukung. Gunakan JPG, PNG, atau WEBP");
    return;
  }

  // ✅ Validasi ukuran file (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert("Ukuran file terlalu besar. Maksimal 5MB");
    return;
  }

  const formData = new FormData();
  formData.append("image", file);

  // 🔥 TAMPILKAN LOADING
  aiDivider.classList.remove("hidden");
  aiResult.classList.remove("hidden");
  aiResult.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="typing-cursor">▋</div>
      <span>Menganalisis gambar...</span>
    </div>
  `;
  
  lockDetect();

  try {
    // ========== STEP 1: PREDIKSI GAMBAR ==========
    console.log("📤 Mengirim gambar ke /api/predict...");
    
    const predictRes = await fetch("/api/predict", { 
      method: "POST", 
      body: formData 
    });
    
    console.log("📥 Response status:", predictRes.status);
    
    if (!predictRes.ok) {
      // ✅ Tangkap error detail dari server
      let errorMessage = `Server error ${predictRes.status}`;
      try {
        const errorData = await predictRes.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        const errorText = await predictRes.text();
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    
    const predictData = await predictRes.json();
    console.log("✅ Prediction result:", predictData);
    
    lastPredictionLabel = predictData.label;
    window.uploadedImageFilename = predictData.filename || file.name;

    // ========== STEP 2: ANALISIS AI ==========
    aiResult.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="typing-cursor">▋</div>
        <span>Menganalisis dengan AI...</span>
      </div>
    `;

    console.log("📤 Mengirim ke /api/chat...");
    
    const chatRes = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Jelaskan secara lengkap hasil analisis berikut.
        Tanaman: ${predictData.label}
        Akurasi: ${predictData.confidence}%
        Gunakan format:
        Penyebab:
        Dampak:
        Kandungan:
        Manfaat:
        Asal:
        Pencegahan:`,
        mode: "full"
      })
    });

    console.log("📥 Chat response status:", chatRes.status);

    if (!chatRes.ok) {
      let errorMessage = `AI analysis failed (${chatRes.status})`;
      try {
        const errorData = await chatRes.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        const errorText = await chatRes.text();
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const chatData = await chatRes.json();
    console.log("✅ Chat result received");

    const finalText = `🌱 Hasil Analisis Tanaman
🍃 Jenis Daun : ${predictData.label}
🎯 Akurasi : ${predictData.confidence}%

📝 Deskripsi:
${cleanText(chatData.reply)}`;

    // 🔥 TYPING ANIMATION
    await typeText(aiResult, finalText);
    isTypingDone = true;
    
    await saveChatToHistory();

  } catch (err) {
    console.error("❌ Error during analysis:", err);
    
    // ✅ Error message yang lebih informatif
    aiResult.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-start gap-2">
          <span class="text-2xl">⚠️</span>
          <div>
            <h3 class="font-bold text-red-700">Terjadi Kesalahan</h3>
            <p class="text-red-600 mt-1">${err.message}</p>
            <p class="text-sm text-red-500 mt-2">
              Coba lagi dengan gambar yang berbeda atau refresh halaman.
            </p>
          </div>
        </div>
      </div>
    `;
  } finally {
    lockDetect();
  }
});
  // =======================
  // ARCHIVE & HISTORY LOGIC
  // =======================
  function saveChatToArchive() {
    const chatText = aiResult.textContent.trim();
    if (!chatText) return;
    const archives = JSON.parse(localStorage.getItem("chatArchives")) || [];
    archives.unshift({
      id: Date.now(),
      title: lastPredictionLabel ? `Analisis Daun ${lastPredictionLabel}` : "Analisis Tanaman",
      content: chatText,
      image: previewImg.src || "",
      label: lastPredictionLabel || "",
      createdAt: new Date().toISOString()
    });
    localStorage.setItem("chatArchives", JSON.stringify(archives));
  }
  

  function uniqueById(arr) {
  const map = new Map();
  arr.forEach(item => {
    if (item && item.id) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}


// =======================
// PERBAIKI FUNGSI renderArchiveList()
// =======================

async function renderArchiveList() {
  const archiveList = document.getElementById("archiveList");
  if (!archiveList) return;

  archiveList.innerHTML = `<div class="text-center py-4 text-gray-400">Loading...</div>`;

  try {
    const response = await fetch("/api/chat/archives"); 
    if (!response.ok) throw new Error("Gagal mengambil data arsip");

    const archives = await response.json();
    archiveList.innerHTML = "";

    if (!archives.length) {
      archiveList.innerHTML = `
        <div class="text-sm text-gray-400 text-center py-4">
          Belum ada chat diarsipkan
        </div>`;
      return;
    }

    archives.forEach((item) => {
      const div = document.createElement("div");
      div.className = "group flex justify-between px-3 py-2 rounded-lg hover:bg-slate-100 items-center border-b border-gray-100 last:border-0";

      div.innerHTML = `
        <div class="min-w-0 flex-1 cursor-pointer archive-item-click">
          <div class="font-medium text-sm truncate text-gray-700">${item.title}</div>
          <div class="text-xs text-gray-400">${new Date(item.created_at || item.createdAt).toLocaleString('id-ID')}</div>
        </div>

        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button class="unarchive-btn text-emerald-600 p-1.5 hover:bg-emerald-100 rounded transition" title="Kembalikan ke History">
            <span class="material-symbols-outlined text-[18px]">unarchive</span>
          </button>
          
          <button class="delete-archive-btn text-red-600 p-1.5 hover:bg-red-100 rounded transition" title="Hapus Permanen">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      `;

      // 🔥 EVENT: UNARCHIVE (Kembalikan ke History)
      div.querySelector(".unarchive-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        
        if (!confirm(`Kembalikan "${item.title}" ke riwayat chat?`)) return;
        
        try {
          console.log("🔓 Unarchiving chat ID:", item.id);
          
          const response = await fetch(`/api/chat/archives/${item.id}/unarchive`, {
            method: "POST"
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const result = await response.json();
          
          if (result.success) {
            console.log("✅ Chat berhasil dikembalikan ke history");
            
            // 🔥 REFRESH KEDUA LIST
            await renderArchiveList(); // Refresh archive list
            await renderHistory();      // Refresh history list
            
            // 🔥 TAMPILKAN NOTIFIKASI SUCCESS
            showNotification("✅ Chat berhasil dikembalikan ke history!", "success");
            
          } else {
            throw new Error(result.error || "Gagal mengembalikan chat");
          }
          
        } catch (error) {
          console.error("❌ Error unarchiving:", error);
          showNotification("❌ Gagal mengembalikan chat: " + error.message, "error");
        }
      });

      // 🔥 EVENT: DELETE PERMANEN
      div.querySelector(".delete-archive-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        
        if (!confirm(`Hapus permanen "${item.title}"?\n\nTindakan ini tidak dapat dibatalkan!`)) return;
        
        try {
          console.log("🗑️ Deleting archive ID:", item.id);
          
          const response = await fetch(`/api/chat/archives/${item.id}`, {
            method: "DELETE"
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const result = await response.json();
          
          if (result.success) {
            console.log("✅ Archive deleted permanently");
            
            // Refresh archive list
            await renderArchiveList();
            
            showNotification("✅ Arsip berhasil dihapus", "success");
            
          } else {
            throw new Error(result.error || "Gagal menghapus arsip");
          }
          
        } catch (error) {
          console.error("❌ Error deleting archive:", error);
          showNotification("❌ Gagal menghapus: " + error.message, "error");
        }
      });

      // 🔥 EVENT: KLIK ITEM (Preview Archive - Optional)
      div.querySelector(".archive-item-click").addEventListener("click", async (e) => {
        e.stopPropagation();
        
        try {
          console.log("👁️ Viewing archive:", item.id);
          
          // Tampilkan preview di modal atau area terpisah
          // Anda bisa custom sesuai kebutuhan
          alert(`Preview arsip:\n\nTitle: ${item.title}\n\nContent: ${item.content.substring(0, 200)}...`);
          
        } catch (error) {
          console.error("❌ Error viewing archive:", error);
        }
      });

      archiveList.appendChild(div);
    });

  } catch (error) {
    console.error("❌ Error render archive:", error);
    archiveList.innerHTML = `<div class="text-red-500 text-center text-sm py-2">Gagal memuat arsip</div>`;
  }
}

// =======================
// FUNGSI HELPER: SHOW NOTIFICATION
// =======================

function showNotification(message, type = "info") {
  // Buat element notifikasi
  const notification = document.createElement("div");
  notification.className = `fixed top-4 right-4 z-[9999] px-4 py-3 rounded-lg shadow-lg transition-all transform translate-x-0 opacity-100`;
  
  // Set warna berdasarkan type
  if (type === "success") {
    notification.className += " bg-emerald-500 text-white";
  } else if (type === "error") {
    notification.className += " bg-red-500 text-white";
  } else {
    notification.className += " bg-blue-500 text-white";
  }
  
  notification.textContent = message;
  
  // Tambahkan ke body
  document.body.appendChild(notification);
  
  // Auto hide after 3 seconds
  setTimeout(() => {
    notification.style.transform = "translateX(400px)";
    notification.style.opacity = "0";
    
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}


// =======================
// UPDATE FUNGSI deleteArchive() JIKA MASIH PAKAI FUNGSI TERPISAH
// =======================

async function deleteArchive(archiveId) {
  try {
    const response = await fetch(`/api/chat/archives/${archiveId}`, {
      method: "DELETE"
    });

    const result = await response.json();
    
    if (result.success) {
      await renderArchiveList();
      showNotification("✅ Arsip berhasil dihapus", "success");
    } else {
      throw new Error(result.error || "Gagal menghapus");
    }
  } catch (error) {
    console.error("❌ Delete archive error:", error);
    showNotification("❌ " + error.message, "error");
  }
}


// =======================
// REFRESH HISTORY SIDEBAR OTOMATIS
// =======================

async function renderHistory() {
  const historyList = document.getElementById("historyList");
  if (!historyList) return;

  try {
    const response = await fetch("/api/chat/history");
    if (!response.ok) throw new Error("Failed to load history");

    const history = await response.json();
    historyList.innerHTML = "";

    if (!history.length) {
      historyList.innerHTML = `<div class="text-xs text-gray-400 text-center py-4">Belum ada chat</div>`;
      return;
    }

    history.forEach((item) => {
      const div = document.createElement("div");
      div.className = "group flex justify-between px-3 py-1 rounded hover:bg-slate-100 relative";

      div.innerHTML = `
        <button class="history-open truncate text-left w-full text-sm py-2">
          ${item.title}
        </button>
        
        <button class="menu-toggle w-8 h-full mt-2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-700">
          <span class="material-symbols-outlined text-[18px]">more_vert</span>
        </button>
        
        <div class="menu hidden absolute right-0 top-8 w-32 bg-white border rounded shadow-lg z-50 overflow-hidden ">
          <button class="archiveItemBtn w-full px-3 py-2 flex gap-2 hover:bg-slate-100 text-left text-xs items-center">
            <span class="material-symbols-outlined text-[16px]">archive</span> 
            Arsip
          </button>
          <button class="deleteItemBtn w-full px-3 py-2 flex gap-2 text-red-600 hover:bg-red-50 text-left text-xs items-center">
            <span class="material-symbols-outlined text-[16px]">delete</span> 
            Hapus
          </button>
        </div>
      `;

      const menuToggle = div.querySelector(".menu-toggle");
      const menu = div.querySelector(".menu");

      // Toggle Menu
      menuToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".menu").forEach(m => {
            if (m !== menu) m.classList.add("hidden");
        });
        menu.classList.toggle("hidden");
      });

// Archive Button
div.querySelector(".archiveItemBtn").addEventListener("click", async (e) => {
  e.stopPropagation();
  menu.classList.add("hidden");
  if (confirm(`Arsipkan "${item.title}"?`)) {
    await archiveChatFromHistory(item.id);
    
    // 🔥 TUTUP SIDEBAR DI MOBILE
    if (isMobile() && isSidebarOpen) {
      closeSidebar();
    }
  }
});

// Delete Button
div.querySelector(".deleteItemBtn").addEventListener("click", async (e) => {
  e.stopPropagation();
  menu.classList.add("hidden");
  if (confirm(`Hapus permanen "${item.title}"?`)) {
    await deleteChatById(item.id);
    
    // 🔥 TUTUP SIDEBAR DI MOBILE
    if (isMobile() && isSidebarOpen) {
      closeSidebar();
    }
  }
});

// Open Chat
div.querySelector(".history-open").addEventListener("click", async (e) => {
  e.stopPropagation();
  document.querySelectorAll(".menu").forEach(m => m.classList.add("hidden"));
  
  try {
    const chatRes = await fetch(`/api/chat/history/${item.id}`);
    if (!chatRes.ok) throw new Error(`Failed to fetch chat: ${chatRes.status}`);
    
    const chatData = await chatRes.json();
    await restoreChatSafe(chatData);
    
    // 🔥 TUTUP SIDEBAR DI MOBILE - INI YANG PENTING!
    if (isMobile() && isSidebarOpen) {
      closeSidebar();
    }
    
  } catch (err) {
    console.error("❌ Failed to open chat:", err);
    showNotification("❌ Gagal membuka chat: " + err.message, "error");
  }
});

      historyList.appendChild(div);
    });

  } catch (error) {
    console.error("❌ Load history failed:", error);
    historyList.innerHTML = `<div class="text-red-500 text-center text-xs py-4">Gagal memuat riwayat</div>`;
  }
}




// Ganti fungsi deleteChatById yang lama dengan ini
async function deleteChatById(chatId) {
  if (!chatId) return;

  try {
    // Panggil API untuk menghapus data di server
    const response = await fetch(`/api/chat/delete/${chatId}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (result.success) {
      console.log("✅ Berhasil dihapus dari database");
      
      // Jika chat yang dihapus sedang dibuka, reset UI
      if (typeof activeChatId !== 'undefined' && activeChatId === chatId) {
        resetAll(); // Pastikan fungsi resetAll() tersedia
        activeChatId = null;
      }

      // Refresh list history dari server
      await renderHistory();
    } else {
      alert("Gagal menghapus: " + result.error);
    }
  } catch (error) {
    console.error("❌ Error deleting chat:", error);
    alert("Terjadi kesalahan koneksi saat menghapus.");
  }
}


// =======================
// INITIAL LOAD
// =======================

document.addEventListener("DOMContentLoaded", () => {
  if (!document.body.classList.contains("dashboard-page")) return;
  
  // Load data from server
  renderHistory();
  loadProfileFromServer();
});


// =======================
// SAVE CHAT TO HISTORY (DATABASE)
// =======================
async function saveChatToHistory() {
  const chatText = aiResult.textContent.trim();
  if (!chatText) return;
  
  // 🔥 GUNAKAN FILENAME DARI GLOBAL VARIABLE
  const imagePath = window.uploadedImageFilename || null;
  
  console.log("💾 Saving chat...");
  console.log("   - Image filename:", imagePath);
  console.log("   - Label:", lastPredictionLabel);
  
  try {
    const response = await fetch("/api/chat/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: lastPredictionLabel ? `Analisis Daun ${lastPredictionLabel}` : "Analisis Tanaman",
        content: chatText,
        image_path: imagePath,  // 🔥 Filename only, NOT base64!
        label: lastPredictionLabel
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      activeChatId = data.chat_id;
      console.log("✅ Chat saved, ID:", activeChatId);
      
      renderHistory();
      return data.chat_id;
    } else {
      console.error("❌ Save failed:", data.error);
    }
  } catch (error) {
    console.error("❌ Failed to save chat:", error);
  }
}

// Handler Global untuk menutup menu jika klik di luar
document.addEventListener("click", (e) => {
  if (!e.target.closest(".group")) {
    document.querySelectorAll(".menu").forEach(m => m.classList.add("hidden"));
  }
});


// ✅ FUNGSI BARU: Pindahkan chat ke Arsip (Database)
async function archiveChatToDatabase(chatId) {
  if (!chatId) {
    alert("⚠️ ID Chat tidak valid.");
    return false;
  }

  try {
    console.log("🗂️ Mengarsipkan chat ID:", chatId);
    
    // Panggil API Backend (Sesuaikan endpoint jika beda)
    const response = await fetch(`/api/chat/archive/${chatId}`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" }
    });

    const result = await response.json();

    if (result.success) {
      console.log("✅ Berhasil diarsipkan ke database");
      return true;
    } else {
      throw new Error(result.error || "Gagal mengarsipkan");
    }
  } catch (error) {
    console.error("❌ Error archiving:", error);
    alert("❌ Gagal mengarsipkan: " + error.message);
    return false;
  }
}


async function archiveChatFromHistory(chatId) {
  if (!chatId) return;

  try {
    // Panggil API untuk memindahkan status ke arsip
    // Asumsi endpoint API-nya adalah /api/chat/archive
    const response = await fetch(`/api/chat/archive/${chatId}`, {
      method: "POST", // Atau PUT, tergantung backend kamu
      headers: { "Content-Type": "application/json" }
    });

    const result = await response.json();

    if (result.success) {
      console.log("✅ Berhasil diarsipkan");
      
      // Refresh kedua list agar sinkron
      await renderHistory(); 
      if (typeof renderArchiveList === 'function') {
        renderArchiveList(); // Jika ada endpoint arsip terpisah
      }
    } else {
      alert("Gagal mengarsipkan: " + result.error);
    }
  } catch (error) {
    console.error("❌ Error archiving chat:", error);
    alert("Terjadi kesalahan koneksi saat mengarsipkan.");
  }
}


// =======================
// HELPER FUNCTIONS
// =======================
async function deleteChatById(chatId) {
    console.log("🗑️ Deleting chat:", chatId);
    
    try {
      const response = await fetch(`/api/chat/history/${chatId}`, {
        method: "DELETE"
      });
      
      if (!response.ok) throw new Error("Delete failed");
      
      await renderHistory();
      
      if (activeChatId === chatId) {
        resetAll();
        activeChatId = null;
      }
      
    } catch (error) {
      console.error("❌ Delete failed:", error);
      alert("❌ Gagal menghapus chat");
    }
  }


async function archiveChatById(chatId) {
  // Move to archive via unarchive endpoint (reuse logic)
  try {
    const historyItem = await fetch(`/api/chat/history/${chatId}`).then(r => r.json());
    
    await fetch("/api/chat/archives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(historyItem)
    });
    
    await deleteChatById(chatId);
    renderArchiveList();
  } catch (error) {
    console.error("❌ Archive failed:", error);
  }
}

 


function exitImageMode() {
  closePreviewBtn?.classList.add("hidden", "opacity-0");

  if (hasImage) {
    dropZone.style.pointerEvents = "none";
  } else {
  }
}



function enterImageMode() {
  if (!hasImage) {
    return;
  }

  closePreviewBtn?.classList.remove("hidden", "opacity-0");
}


// Untuk index.html (non-login) - mode SHORT
fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        message: "info",
        mode: "short"  // ⬅️ Hanya deskripsi singkat
    })
})

// Untuk dashboard (login) - mode FULL
fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        message: "info",
        mode: "full"  // ⬅️ Deskripsi + Manfaat + Kandungan + Fungsi
    })
})


closeProfileModal?.addEventListener("click", () => {
  closeProfile();
  enterImageMode(); // ⬅️
});

closeAccountModal?.addEventListener("click", () => {
  closeAccount();
  enterImageMode(); // ⬅️
});


closePreviewBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  removeImageOnly(); // ← hanya di sini gambar dihapus
});

// =======================
// ARCHIVE MODAL
// =======================
archiveBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  exitImageMode(); // 🔥 TAMBAHKAN INI
  
  console.log("📂 Opening archive modal...");
  
  accountMenu?.classList.add("hidden");
  
  archiveModal?.classList.remove("hidden");
  archiveModal?.classList.add("flex");
  globalOverlay?.classList.remove("hidden");
  
  await renderArchiveList();
});

// =======================
// PROFILE MODAL
// =======================
profileBtn?.addEventListener("click", () => {
  exitImageMode(); // 🔥 SUDAH ADA, pastikan tidak dihapus
  
  profileModal?.classList.remove("hidden");
  profileOverlay?.classList.remove("hidden");
  profileOverlay?.classList.remove("pointer-events-none");
  accountMenu?.classList.add("hidden");
});

// =======================
// ACCOUNT MODAL
// =======================
accountModalBtn?.addEventListener("click", () => {
  exitImageMode(); // 🔥 SUDAH ADA, pastikan tidak dihapus
  
  accountModal?.classList.remove("hidden");
  accountOverlay?.classList.remove("hidden");
  accountOverlay?.classList.remove("pointer-events-none");
  accountMenu?.classList.add("hidden");
});

function disableDropzoneUI() {
  isHistoryMode = true; // 🔒 LOCK HISTORY

  dropZone.classList.add("dropzone-preview", "is-history");

  forceCleanDropzone(); // 🔥 PAKSA BERSIH

  dropZone.style.pointerEvents = "none";
  dropZone.style.cursor = "default";
}



// =======================
// RESTORE CHAT WITH ERROR HANDLING (FIXED)
// =======================

async function restoreChatSafe(item) {
  console.log("📂 Restoring chat:", item);
  
  // 🔥 SET MODE HISTORY
  isHistoryMode = true;
  activeChatId = item.id;
  lastPredictionLabel = item.label || "";

  // 🔥 TAMPILKAN HASIL AI
  aiResult.textContent = item.content;
  aiResult.classList.remove("hidden");
  aiDivider.classList.remove("hidden");

  // 🔥 JIKA ADA GAMBAR
  if (item.image_path) {
    hasImage = true;
    
    // 🔥 CONSTRUCT URL DENGAN BENAR
    let imageUrl;
    
    // Jika sudah ada /static di awal, gunakan langsung
    if (item.image_path.startsWith('/static')) {
      imageUrl = item.image_path;
    } 
    // Jika sudah ada /uploads di awal
    else if (item.image_path.startsWith('/uploads')) {
      imageUrl = '/static' + item.image_path;
    }
    // Jika hanya filename saja
    else {
      imageUrl = `/static/uploads/plant/${item.image_path}`;
    }
    
    console.log("🖼️ Loading image from:", imageUrl);
    
    // 🔥 ERROR HANDLER
    previewImg.onerror = function() {
      console.error("❌ Image failed to load:", imageUrl);
      
      // Coba ekstrak filename
      const filename = imageUrl.split('/').pop();
      
      // List fallback paths
      const fallbackPaths = [
        `/static/uploads/plant/${filename}`,
        `/static/uploads/${filename}`,
        `/uploads/plant/${filename}`
      ];
      
      // Coba fallback
      const currentIndex = fallbackPaths.indexOf(previewImg.src.replace(window.location.origin, ''));
      const nextIndex = currentIndex + 1;
      
      if (nextIndex < fallbackPaths.length) {
        console.log("🔄 Trying fallback:", fallbackPaths[nextIndex]);
        previewImg.src = fallbackPaths[nextIndex];
      } else {
        // Semua fallback gagal
        console.error("❌ All paths failed, showing placeholder");
        hasImage = false;
        previewCard.classList.add("hidden");
        dropContent?.classList.remove("hidden");
        dropZone.classList.remove("dropzone-preview", "is-history");
      }
    };
    
    previewImg.onload = function() {
      console.log("✅ Image loaded successfully");
      
      // 🔥 HIDE DROP CONTENT (placeholder)
      dropContent?.classList.add("hidden");
      
      // 🔥 SHOW PREVIEW CARD
      previewCard.classList.remove("hidden");
      
      // 🔥 UPDATE DROPZONE MODE
      dropZone.classList.remove("idle");
      dropZone.classList.add("dropzone-preview", "is-history");
      
      // 🔥 SHOW CLOSE BUTTON (INI YANG PENTING!)
      closePreviewBtn?.classList.remove("hidden", "opacity-0");
      
      // 🔥 DISABLE DROPZONE INTERACTION
      disableDropzoneUI();
      
      console.log("✅ Preview shown with close button visible");
    };
    
    // Set src
    previewImg.src = imageUrl;
    
  } else {
    // TIDAK ADA GAMBAR
    console.log("ℹ️ No image for this chat");
    
    hasImage = false;
    
    // 🔥 HIDE PREVIEW
    previewCard.classList.add("hidden");
    closePreviewBtn?.classList.add("hidden", "opacity-0");
    
    // 🔥 SHOW DROP CONTENT
    dropContent?.classList.remove("hidden");
    
    // 🔥 RESET DROPZONE MODE
    dropZone.classList.remove("dropzone-preview", "is-history");
    
    // 🔥 DISABLE DROPZONE (karena mode history tanpa gambar)
    dropZone.style.pointerEvents = "none";
  }

  // 🔥 LOCK DETECT BUTTON
  lockDetect();
  
  // 🔥 SHOW ARCHIVE BUTTON
  showArchiveBtn();
  
  // 🔥 SCROLL TO RESULT
  setTimeout(() => {
    aiResult.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}


// =======================
// RESET ALL
// =======================
function resetAll() {
  console.log("🔄 Resetting all...");
  
  // 🔓 UNLOCK HISTORY MODE DULU (PENTING!)
  isHistoryMode = false;
  activeChatId = null;
  lastPredictionLabel = "";

  // Stop typing animation
  stopTyping = true;
  hideStopBtn();

  // 🔥 CLEAR IMAGE EVENT HANDLERS DULU
  previewImg.onload = null;
  previewImg.onerror = null;
  
  // 🔥 RESET IMAGE STATE
  hasImage = false;
  imageDetected = false;
  previewImg.src = "";
  fileInput.value = "";
  window.uploadedImageFilename = null;

  // 🔥 HIDE PREVIEW CARD & CLOSE BUTTON
  closePreviewBtn?.classList.add("hidden", "opacity-0");
  previewCard.classList.add("hidden");
  dropContent?.classList.remove("hidden");
  
  // 🔥 RESET DROPZONE - PENTING! HAPUS is-history
  dropZone.classList.remove("dropzone-preview", "is-history");
  forceCleanDropzone();
  applyIdleDropzone(); // 🔥 WAJIB
  
  // 🔥 ENABLE DROPZONE (karena history mode disable ini)
  dropZone.style.cursor = "pointer";
  dropZone.style.opacity = "1"; // Tambahkan ini juga!
  
  // 🔥 HIDE AI RESULT
  aiResult.innerHTML = "";
  aiResult.textContent = "";
  aiResult.classList.add("hidden");
  aiDivider.classList.add("hidden");

  // 🔥 HIDE BUTTONS
  hideArchiveBtn();
  lockDetect();
  
  window.scrollTo({ top: 0, behavior: "smooth" });
  console.log("✅ Reset complete - hasImage:", hasImage, "isHistoryMode:", isHistoryMode);
}

if (!dropZone) return;

function forceCleanDropzone() {
  dropZone.classList.remove(
  
  // Remove all border classes
    "border-2",
    "border-dashed",
    "border-gray-300",
    "border-primary",
    "hover:border-primary",
    "hover:bg-gray-50",
    "bg-gray-50"
  );

  // Reset inline styles
  dropZone.style.border = "";
  dropZone.style.outline = "";
  dropZone.style.boxShadow = "";
  dropZone.style.backgroundColor = "";
}

// 🔥 UPDATE EVENT LISTENER RESET BUTTON
resetBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (activeChatId || aiResult.textContent.trim()) {
    if (!confirm("Reset chat? Semua data yang belum diarsipkan akan hilang.")) {
      return;
    }
  }

  resetAll();
  applyIdleDropzone(); // 🔥 SATU PINTU



  // 🔥 RESTORE DROPZONE UI (WAJIB)
dropZone.style.cursor = "pointer";
dropZone.style.opacity = "1";

// 🔥 TAMPILKAN PLACEHOLDER
dropContent?.classList.remove("hidden");
dropContent?.classList.remove("opacity-0");
});


function displayImage(file) {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    // 🔥 CLEAR OLD HANDLERS DULU
    previewImg.onload = null;
    previewImg.onerror = null;
    
    // 🔥 SETUP NEW HANDLERS
    previewImg.onload = () => {
      console.log("✅ Image loaded, showing close button");
      closePreviewBtn?.classList.remove("hidden", "opacity-0");
    };
    
    previewImg.onerror = () => {
      console.error("❌ Failed to load image");
      closePreviewBtn?.classList.add("hidden", "opacity-0");
    };
    
    // Set src
    previewImg.src = e.target.result;
    
    // 🔥 PASTIKAN TIDAK ADA CLASS is-history
    dropZone.classList.remove("is-history");
    dropZone.classList.add("dropzone-preview");
    
    dropContent?.classList.add("hidden");
    previewCard.classList.remove("hidden");
    
    hasImage = true;
    imageDetected = true;
    unlockDetect();
    
    console.log("📸 Display image done - hasImage:", hasImage);
  };
  
  reader.readAsDataURL(file);
}

// 🔥 UPDATE FUNGSI removeImageOnly() JUGA
function removeImageOnly() {
  console.log("🗑️ Removing image only...");
  
  // Clear file input
  fileInput.value = "";
  
  // Clear image
  previewImg.src = "";
  previewImg.onload = null;
  previewImg.onerror = null;
  
  // Reset state
  hasImage = false;
  imageDetected = false;
  window.uploadedImageFilename = null;

  // Hide preview
  previewCard.classList.add("hidden");
  closePreviewBtn?.classList.add("hidden", "opacity-0");
  
  // Show drop content
  dropContent?.classList.remove("hidden");
  
  // Remove preview mode
  dropZone.classList.remove("dropzone-preview");
  
  // Lock detect button
  lockDetect();
  applyIdleDropzone();
  
  console.log("✅ Image removed - hasImage:", hasImage);
}


// 🔥 UPDATE NEW CHAT BUTTON JUGA
const newChatBtn = document.getElementById("newChatBtn");

newChatBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (activeChatId || aiResult.textContent.trim()) {
    if (!confirm("Buat chat baru? Chat saat ini akan hilang jika belum diarsipkan.")) {
      return;
    }
  }

  resetAll();

  // 🔥 PAKSA KELUAR DARI HISTORY MODE
  isHistoryMode = false;
  dropZone.style.pointerEvents = "auto";

  window.scrollTo({ top: 0, behavior: "smooth" });
});




// Initial render
renderHistory();

const changePhotoBtn = document.getElementById("changeAvatarBtn");
const photoInput = document.getElementById("avatarInput");
const profilePhotoPreview = document.getElementById("avatarPreview");
const usernameInput = document.getElementById("usernameInput");
const saveProfileBtn = document.getElementById("saveProfileBtn");

// navbar
const navbarAvatar = document.getElementById("navbarAvatar");
const navbarUsername = document.getElementById("navbarUsername");

// =====================
// CHANGE PHOTO
// =====================
changePhotoBtn?.addEventListener("click", () => {
  photoInput?.click();
});

photoInput?.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    if (!profilePhotoPreview) return;

    profilePhotoPreview.src = reader.result;

    // 🔥 TAMPILKAN IMAGE
    profilePhotoPreview.classList.remove("hidden");

    // 🔥 SEMBUNYIKAN INITIAL
    document.getElementById("avatarInitial")?.classList.add("hidden");
  };
  reader.readAsDataURL(file);
});


// =====================
// SAVE PROFILE → DATABASE
// =====================
async function saveProfile() {
  try {
    const newUsername = usernameInput.value.trim();
    const photoFile = photoInput.files[0];

    if (!newUsername) {
      alert("Username tidak boleh kosong");
      return;
    }

    const formData = new FormData();
    formData.append("username", newUsername);
    if (photoFile) {
      formData.append("avatar", photoFile);
    }

    const res = await fetch("/api/user/profile", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.error || "Gagal update profile");
      return;
    }

    // ✅ UPDATE UI
    const finalUsername = data.username;
    const finalPhoto = data.photo_url;

    if (navbarUsername) navbarUsername.textContent = finalUsername;
    if (navbarAvatar && finalPhoto) {
      navbarAvatar.src = finalPhoto + "?t=" + Date.now();
    }

    syncAccountMenu(finalUsername, finalPhoto);
    syncWelcomeUser(finalUsername, finalPhoto);
    syncAccountBtn(finalUsername, finalPhoto);

    localStorage.setItem("profileData", JSON.stringify({
      username: finalUsername,
      photo: finalPhoto
    }));

    alert("✅ Profile berhasil diperbarui");
    closeProfile();

  } catch (error) {
    console.error("Save profile error:", error);
    alert("❌ Terjadi kesalahan saat menyimpan profile");
  }
}

saveProfileBtn?.addEventListener("click", saveProfile);


// =====================
// LOAD PROFILE FROM SERVER
// =====================
async function loadProfileFromServer() {
  try {
    const response = await fetch("/api/user/profile");
    
    if (!response.ok) {
      console.error("Failed to load profile");
      return;
    }

    const data = await response.json();
    
    console.log("🔍 Profile loaded:", data); // 🔥 DEBUG
    
    if (data.username) {
      // Update UI
      if (navbarUsername) navbarUsername.textContent = data.username;
      
      const finalPhoto = data.photo_url || "/static/default-avatar.png";
      
      if (navbarAvatar) {
        navbarAvatar.src = finalPhoto + "?t=" + Date.now();
      }

      if (usernameInput) usernameInput.value = data.username;
      
      if (profilePhotoPreview && data.photo_url) {
        showAvatarImage(finalPhoto);
      }

      syncAccountMenu(data.username, finalPhoto);
      syncWelcomeUser(data.username, finalPhoto);
      syncAccountBtn(data.username, finalPhoto);

      // Cache ke localStorage
      localStorage.setItem("profileData", JSON.stringify({
        username: data.username,
        photo: finalPhoto
      }));
    }

  } catch (error) {
    console.error("Error loading profile:", error);
    
    // Fallback ke localStorage
    const saved = JSON.parse(localStorage.getItem("profileData"));
    if (saved) {
      if (navbarUsername) navbarUsername.textContent = saved.username;
      if (navbarAvatar) navbarAvatar.src = saved.photo || "/static/default-avatar.png";
      
      syncAccountMenu(saved.username, saved.photo);
      syncWelcomeUser(saved.username, saved.photo);
      syncAccountBtn(saved.username, saved.photo);
    }
  }
}

// 🔥 PANGGIL saat page load
loadProfileFromServer();


function applyIdleDropzone() {
  if (!dropZone) return;

  dropZone.classList.remove("dropzone-preview", "is-history");

  dropZone.classList.add(
    "idle",
    "border-2",
    "border-dashed",
    "border-gray-300",
    "hover:border-primary",
    "hover:bg-gray-50"
  );

  // 🔥 WAJIB: UNLOCK POINTER EVENTS
  dropZone.style.pointerEvents = "auto";
  dropZone.style.cursor = "pointer";
  dropZone.style.opacity = "1";

  dropContent?.classList.remove("hidden");
}




function showAvatarImage(src) {
  profilePhotoPreview.src = src;
  profilePhotoPreview.classList.remove("hidden");
  document.getElementById("avatarInitial")?.classList.add("hidden");
}



function syncWelcomeUser(username, photo) {
  const welcomeUsername = document.getElementById("welcomeUsername");
  const welcomeInitial = document.getElementById("welcomeInitial");
  const welcomeAvatarImg = document.getElementById("welcomeAvatarImg");

  // Username
  if (welcomeUsername) {
    welcomeUsername.textContent = `Hello ${username}`;
  }

  // Avatar
  if (photo) {
    welcomeAvatarImg.src = photo;
    welcomeAvatarImg.classList.remove("hidden");
    welcomeInitial?.classList.add("hidden");
  } else {
    welcomeAvatarImg?.classList.add("hidden");
    if (welcomeInitial) {
      welcomeInitial.textContent = username[0]?.toUpperCase() || "";
      welcomeInitial.classList.remove("hidden");
    }
  }
}

function syncAccountMenu(username, photo) {
  const menuAvatar = document.getElementById("accountMenuAvatar");
  const menuUsername = document.getElementById("accountMenuUsername");

  if (menuUsername) {
    menuUsername.textContent = username;
  }

  if (menuAvatar && photo) {
    menuAvatar.src = photo;
  }
}

function syncAccountBtn(username, photo) {
  const usernameEl = document.getElementById("accountBtnUsername");
  const initialEl = document.getElementById("accountBtnInitial");
  const imgEl = document.getElementById("accountBtnImg");

  if (usernameEl) {
    usernameEl.textContent = username;
  }

  if (photo) {
    imgEl.src = photo;
    imgEl.classList.remove("hidden");
    initialEl?.classList.add("hidden");
  } else {
    imgEl?.classList.add("hidden");
    if (initialEl) {
      initialEl.textContent = username[0]?.toUpperCase() || "";
      initialEl.classList.remove("hidden");
    }
  }
}


//source delete account
document.getElementById("deleteAccountBtn").addEventListener("click", function () {
  const confirmDelete = confirm(
    "Apakah kamu yakin ingin menghapus akun ini?\nAkun akan dihapus permanen!"
  );

  if (!confirmDelete) return;

fetch("/api/user/delete", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  }
})
.then(res => res.json())
.then(data => {
  if (data.status === "success") {
    alert("Akun berhasil dihapus");
    window.location.href = "/index";
  } else {
    alert(data.message);
  }
})
.catch(() => {
  alert("Terjadi kesalahan");
});

});

// =======================
// LOGOUT HANDLER
// =======================
// Update logout handler di main.js
const logoutBtn = document.getElementById("logoutBtn");

logoutBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  
  // 🔥 HANYA HAPUS PROFILE DATA (chat tetap di database)
  localStorage.removeItem("profileData");
  sessionStorage.clear();
  
  // Redirect
  window.location.href = "/logout";
});

// 🔥 Debug: Cek apakah button ada
console.log("Logout button:", logoutBtn ? "Found" : "Not found");



// Tambahkan search box di archive modal
const archiveSearch = document.getElementById("archiveSearch");
  
  archiveSearch?.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const items = document.querySelectorAll("#archiveList > div");
    
    items.forEach(item => {
      const title = item.querySelector(".font-medium")?.textContent.toLowerCase() || "";
      item.style.display = title.includes(query) ? "flex" : "none";
    });
  });

   renderHistory();

   // =======================
// DISPLAY AI RESULT WITH TYPING ANIMATION (ChatGPT Style)
// =======================

async function displayAIResultWithTyping(result) {
  aiDivider.classList.remove('hidden');
  aiResult.classList.remove('hidden');
  
  // 🔥 CLEAR PREVIOUS CONTENT
  aiResult.innerHTML = '';
  
  // 🔥 CREATE CONTAINER
  const container = document.createElement('div');
  aiResult.appendChild(container);
  
  let fullHTML = '';
  
  // ===== BUILD HTML BASED ON STATUS =====
  switch(result.status) {
    
    // 🔴 STATUS: RAGU (< 40%)
   // Di dalam switch statement, bagian case 'ragu':

case 'ragu':
  fullHTML = `
    <div class="border-l-4 border-yellow-500 bg-yellow-50 rounded-r-lg px-4 py-3 mb-6 shadow-sm">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-2xl animate-bounce">⚠️</span>
        <h2 class="text-xl font-bold text-yellow-700">Hasil Analisis - Tidak Dapat Dikenali</h2>
      </div>
      <p class="text-sm text-gray-700 mb-1">
        <span class="font-semibold">🎯 Tingkat Keyakinan Tertinggi:</span> 
        <span class="text-yellow-700 font-bold">${result.confidence}%</span>
        <span class="text-xs text-gray-500 ml-1">(Terlalu Rendah)</span>
      </p>
      <p class="text-sm text-gray-600 italic mt-2">
        ${result.message || 'Tanaman belum dapat dikenali dengan yakin.'}
      </p>
    </div>
    
    <!-- TOP 3 PREDICTIONS WITH CONFIDENCE -->
    <div class="mb-6">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-2xl">🔍</span>
        <h3 class="text-lg font-bold text-gray-900">Top 3 Kemungkinan Daun:</h3>
      </div>
      <div class="space-y-3">
        ${result.predictions && result.predictions.length > 0 ? result.predictions.map((pred, index) => `
          <div class="bg-white rounded-xl p-4 border ${
            index === 0 ? 'border-yellow-400 shadow-md' : 
            index === 1 ? 'border-yellow-300 shadow-sm' :
            'border-gray-200 shadow-sm'
          } hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
            <div class="flex justify-between items-center mb-3">
              <div class="flex items-center gap-3 flex-1">
                <span class="flex items-center justify-center w-8 h-8 rounded-full ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white' : 
                  index === 1 ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-white' :
                  'bg-gray-300 text-gray-700'
                } text-sm font-bold shadow-sm">#${index + 1}</span>
                <div class="flex-1">
                  <p class="text-gray-800 font-bold text-base">${pred.label}</p>
                  <p class="text-xs text-gray-500 mt-0.5">
                    ${index === 0 ? '🥇 Kemungkinan Tertinggi' : 
                      index === 1 ? '🥈 Kemungkinan Kedua' : 
                      '🥉 Kemungkinan Ketiga'}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <span class="text-lg font-bold px-3 py-1.5 rounded-lg ${
                  pred.confidence < 20 ? 'text-red-600 bg-red-50 border border-red-200' : 
                  pred.confidence < 40 ? 'text-yellow-600 bg-yellow-50 border border-yellow-200' : 
                  'text-gray-600 bg-gray-100 border border-gray-200'
                }">${pred.confidence}%</span>
              </div>
            </div>
            
            <!-- Progress Bar -->
            <div class="relative bg-gray-200 rounded-full h-3 overflow-hidden">
              <div class="absolute inset-0 ${
                pred.confidence < 20 ? 'bg-gradient-to-r from-red-400 to-red-500' : 
                pred.confidence < 40 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 
                'bg-gradient-to-r from-gray-400 to-gray-500'
              } transition-all duration-1000 ease-out" 
                   style="width: ${pred.confidence}%">
                <div class="h-full w-full bg-gradient-to-r from-white/0 to-white/20"></div>
              </div>
            </div>
            
            <!-- Confidence Level Indicator -->
            <div class="mt-2 flex items-center gap-2">
              <div class="flex-1 bg-gray-100 rounded-full h-1.5">
                <div class="h-full rounded-full ${
                  pred.confidence < 20 ? 'bg-red-400' : 
                  pred.confidence < 40 ? 'bg-yellow-400' : 
                  'bg-gray-400'
                }" style="width: ${pred.confidence}%"></div>
              </div>
              <span class="text-xs font-medium ${
                pred.confidence < 20 ? 'text-red-600' : 
                pred.confidence < 40 ? 'text-yellow-600' : 
                'text-gray-600'
              }">
                ${pred.confidence < 20 ? 'Sangat Rendah' : 
                  pred.confidence < 40 ? 'Rendah' : 
                  'Sedang'}
              </span>
            </div>
          </div>
        `).join('') : '<p class="text-gray-500 text-sm">Tidak ada data prediksi</p>'}
      </div>
    </div>
    
    <!-- TIPS SECTION -->
    <div class="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4 mb-6 shadow-sm">
      <div class="flex items-start gap-3">
        <span class="text-2xl">💡</span>
        <div class="flex-1">
          <h3 class="font-bold text-blue-900 mb-3 text-base">Tips untuk Hasil Lebih Akurat:</h3>
          <ul class="text-sm text-gray-700 space-y-2">
            <li class="flex items-start gap-2">
              <span class="text-blue-500 mt-1">✓</span>
              <span>Pastikan pencahayaan cukup terang dan merata</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-blue-500 mt-1">✓</span>
              <span>Ambil foto daun dari jarak dekat (close-up)</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-blue-500 mt-1">✓</span>
              <span>Fokuskan kamera pada daun yang ingin dianalisis</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-blue-500 mt-1">✓</span>
              <span>Gunakan background yang kontras (terang atau gelap)</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-blue-500 mt-1">✓</span>
              <span>Hindari foto yang blur atau buram</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
    
    <!-- IMAGE QUALITY INFO -->
    ${result.quality_info ? `
      <div class="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-300 rounded-lg p-4 shadow-sm">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xl">📊</span>
          <h4 class="font-bold text-gray-800">Kualitas Gambar Terdeteksi:</h4>
        </div>
        <div class="grid grid-cols-1 gap-3 text-sm">
          <div class="bg-white rounded-lg p-3 border border-gray-200">
            <div class="flex justify-between items-center">
              <span class="text-gray-600 font-medium">Kejernihan:</span> 
              <span class="font-bold text-base ${
                result.quality_info.quality === 'good' ? 'text-green-600' :
                result.quality_info.quality === 'medium' ? 'text-yellow-600' :
                'text-red-600'
              }">${
                result.quality_info.quality === 'good' ? 'Baik ✓' :
                result.quality_info.quality === 'medium' ? 'Sedang ⚠' :
                'Buruk ✗'
              }</span>
            </div>
          </div>
          
          ${result.quality_info.blur !== undefined ? `
            <div class="bg-white rounded-lg p-3 border border-gray-200">
              <div class="flex justify-between items-center">
                <span class="text-gray-600 font-medium">Skor Blur:</span>
                <span class="font-bold text-gray-700">${result.quality_info.blur.toFixed(2)}</span>
              </div>
            </div>
          ` : ''}
          
          ${result.quality_info.brightness !== undefined ? `
            <div class="bg-white rounded-lg p-3 border border-gray-200">
              <div class="flex justify-between items-center">
                <span class="text-gray-600 font-medium">Kecerahan:</span>
                <span class="font-bold text-gray-700">${result.quality_info.brightness.toFixed(2)}</span>
              </div>
            </div>
          ` : ''}
          
          ${result.quality_info.issues && result.quality_info.issues.length > 0 ? `
            <div class="col-span-full bg-red-50 rounded-lg p-3 border border-red-200">
              <span class="text-gray-700 font-semibold block mb-2">⚠️ Masalah Terdeteksi:</span>
              <ul class="text-xs text-red-700 space-y-1">
                ${result.quality_info.issues.map(issue => `
                  <li class="flex items-start gap-2">
                    <span class="text-red-500 mt-0.5">•</span>
                    <span>${issue}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    ` : ''}
  `;
  break;
}

  
// =======================
// TYPING ANIMATION FUNCTION (HTML Content)
// =======================
async function typeHTMLContent(container, htmlString) {
  return new Promise((resolve) => {
    // Parse HTML string ke temporary div
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    
    // Get all elements
    const elements = Array.from(tempDiv.children);
    
    let currentIndex = 0;
    
    function showNextElement() {
      if (stopTyping || currentIndex >= elements.length) {
        resolve();
        return;
      }
      
      const element = elements[currentIndex].cloneNode(true);
      container.appendChild(element);
      
      // Auto scroll if enabled
      if (autoScrollEnabled) {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
      
      currentIndex++;
      
      // Delay between elements (simulate typing)
      setTimeout(showNextElement, 300);
    }
    
    showNextElement();
  });
}
}


// =======================
// TYPING ANIMATION FUNCTION (HTML Content)
// =======================
async function typeHTMLContent(container, htmlString) {
  return new Promise((resolve) => {
    // Parse HTML string ke temporary div
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    
    // Get all elements
    const elements = Array.from(tempDiv.children);
    
    let currentIndex = 0;
    
    function showNextElement() {
      if (stopTyping || currentIndex >= elements.length) {
        resolve();
        return;
      }
      
      const element = elements[currentIndex].cloneNode(true);
      container.appendChild(element);
      
      // Auto scroll if enabled
      if (autoScrollEnabled) {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
      
      currentIndex++;
      
      // Delay between elements (simulate typing)
      setTimeout(showNextElement, 300);
    }
    
    showNextElement();
  });
}

});