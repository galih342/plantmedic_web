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


  const closeBtn = document.getElementById("closeSidebarBtn");
  const sidebar = document.getElementById("sidebar");
  const toggleSidebar = document.getElementById("toggleSidebar");
  const overlay = document.getElementById("overlay");
  const menuBtn = document.getElementById("menuBtn");

  menuBtn.addEventListener("click", () => {
    sidebar.classList.toggle("-translate-x-full");
    overlay.classList.toggle("hidden");
  });

  overlay.addEventListener("click", () => {
    sidebar.classList.add("-translate-x-full");
    overlay.classList.add("hidden");
  });


  toggleSidebar?.addEventListener("click", () => {
    sidebar.classList.toggle("-translate-x-full");
  });


  // =======================
  // BASIC ELEMENTS
  // =======================
  const uploadForm = document.getElementById("uploadForm");
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
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

  // =======================
  // MODAL: ARCHIVE
  // =======================
archiveChatBtn?.addEventListener("click", () => {
  if (!activeChatId) return;

  // simpan ke archive
  saveChatToArchive();

  // hapus dari history
  let history = JSON.parse(localStorage.getItem("chatHistory")) || [];
  history = history.filter(item => item.id !== activeChatId);
  localStorage.setItem("chatHistory", JSON.stringify(history));

  // 🔥 RESET TOTAL UI
  resetAll();
  activeChatId = null;

  renderHistory();
  renderArchiveList();

  alert("✅ Chat dipindahkan ke Arsip");
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

archiveChatBtn?.addEventListener("click", archiveAndReset);


  closeArchiveModal?.addEventListener("click", () => {
    archiveModal?.classList.add("hidden");
    globalOverlay?.classList.add("hidden");
    globalOverlay?.classList.add("pointer-events-none");
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

  function forceCleanDropzone() {
  dropZone.classList.remove(
    "border-2",
    "border-dashed",
    "border-gray-300",
    "border-primary",
    "hover:border-primary",
    "hover:bg-gray-50",
    "bg-gray-50"
  );

  dropZone.style.border = "none";
  dropZone.style.outline = "none";
  dropZone.style.boxShadow = "none";
}

  // =======================
  // DROPZONE LOGIC
  // =======================
dropZone.addEventListener("click", () => {
  if (isHistoryMode) return;
  fileInput.click(); // 🔥 WAJIB
});


  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    imageDetected = false;
    if (!file) {
      sendBtn.disabled = true;
      return;
    }
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("Ukuran gambar tidak boleh lebih dari 5 MB");
      resetDropzone();
      return;
    }
    showPreview(file);
    sendBtn.disabled = false;
  });

["dragenter", "dragover"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();

    if (isHistoryMode) return; // 🔥 STOP TOTAL

    if (!dropZone.classList.contains("dropzone-preview")) {
      dropZone.classList.add("border-primary", "bg-gray-50");
    }
  });
});


  ["dragleave", "drop"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
    });
  });

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (isHistoryMode) return;

  dropZone.classList.remove("border-primary", "bg-gray-50");

  const file = e.dataTransfer.files[0];
  handleDroppedFile(file);
});


function showPreview(file) {
  const reader = new FileReader();
  reader.onload = () => {
    previewImg.src = reader.result;
    hasImage = true; // ✅ KUNCI UTAMA

    syncClosePreviewBtn();
    dropContent?.classList.add("hidden");
    dropZone.classList.add("dropzone-preview");
    previewCard?.classList.remove("hidden");
    unlockDetect();
  };
  reader.readAsDataURL(file);
}

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



function removeImageOnly() {
  fileInput.value = "";
  previewImg.src = "";
  hasImage = false; // ✅ RESET STATE IMAGE

  previewCard.classList.add("hidden");
  dropContent?.classList.remove("hidden");
  dropZone.classList.remove("dropzone-preview");

  closePreviewBtn?.classList.add("hidden", "opacity-0");
  lockDetect();
}



function setDropzoneMode(mode) {
  if (!dropZone) return;

  // bersihkan semua mode dulu
  dropZone.classList.remove("idle", "dropzone-preview", "is-history");

  // set mode sesuai kondisi
  switch (mode) {
    case "idle":
      dropZone.classList.add("idle");
      break;

    case "preview":
      dropZone.classList.add("dropzone-preview");
      break;

    case "history":
      dropZone.classList.add("is-history");
      break;
  }
}


  closePreviewBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeImageOnly();
  });

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

  function cleanDropzoneStyle() {
  dropZone.classList.remove(
    "border-2",
    "border-dashed",
    "border-gray-300",
    "border-primary",
    "hover:border-primary",
    "hover:bg-gray-50",
    "bg-gray-50"
  );

  dropZone.style.outline = "none";
  dropZone.style.boxShadow = "none";
}



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
  // FORM SUBMISSION
  // =======================
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) {
      alert("Upload gambar dulu");
      return;
    }

    const formData = new FormData();
    formData.append("image", fileInput.files[0]);

        fetch("/api/predict", {
          method: "POST",
          body: formData
        })
        .then(res => res.json())
        .then(data => {
          console.log(data);
        })
        .catch(err => {
          console.error("Error:", err);
        });

    aiDivider.classList.remove("hidden");
    aiResult.classList.remove("hidden");
    aiResult.textContent = "🤖 Menganalisis gambar...";

    try {
      const predictRes = await fetch("/api/predict", { method: "POST", body: formData });
      const predictData = await predictRes.json();
      lastPredictionLabel = predictData.label;

      if (!predictRes.ok) throw new Error("Predict gagal");

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

      const chatData = await chatRes.json();
      if (!chatRes.ok) throw new Error("Chat AI gagal");

      const finalText = `🌱 Hasil Analisis Tanaman
🍃 Jenis Daun : ${predictData.label}
🎯 Akurasi : ${predictData.confidence}%

📝 Deskripsi:
${cleanText(chatData.reply)}`;

      await typeText(aiResult, finalText);
      isTypingDone = true;
      lockDetect();

    } catch (err) {
      console.error(err);
      aiResult.textContent = "⚠️ Terjadi kesalahan saat memproses AI.";
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

  archiveChatBtn?.addEventListener("click", () => {
    saveChatToArchive();
    hideArchiveBtn();
    alert("✅ Chat berhasil diarsipkan");
  });

  function uniqueById(arr) {
  const map = new Map();
  arr.forEach(item => {
    if (item && item.id) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}


function renderArchiveList() {
  const archiveList = document.getElementById("archiveList");
  if (!archiveList) return;

  const archives = JSON.parse(localStorage.getItem("chatArchives")) || [];
  archiveList.innerHTML = "";

  if (!archives.length) {
    archiveList.innerHTML = `
      <div class="text-sm text-gray-400 text-center py-4">
        Belum ada chat diarsipkan
      </div>`;
    return;
  }

  archives.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "group flex justify-between px-3 py-2 rounded-lg hover:bg-slate-100";

    div.innerHTML = `
      <div class="min-w-0">
        <div class="font-medium text-sm truncate">${item.title}</div>
        <div class="text-xs text-gray-400">${new Date(item.createdAt).toLocaleString()}</div>
      </div>

      <div class="flex gap-1 opacity-0 group-hover:opacity-100">
        <button class="unarchive-btn text-emerald-600 p-1.5 hover:bg-emerald-100 rounded">
          <span class="material-symbols-outlined">unarchive</span>
        </button>
        <button class="delete-btn text-red-600 p-1.5 hover:bg-red-100 rounded">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    `;

    div.querySelector(".unarchive-btn").addEventListener("click", () => {
      let history = JSON.parse(localStorage.getItem("chatHistory")) || [];

      history = history.filter(h => h.id !== item.id);
      history.unshift(item);
      archives.splice(index, 1);

      localStorage.setItem("chatHistory", JSON.stringify(history));
      localStorage.setItem("chatArchives", JSON.stringify(archives));

      renderHistory();
      renderArchiveList();

      archiveModal.classList.add("hidden");
      globalOverlay.classList.add("hidden");
    });

    div.querySelector(".delete-btn").addEventListener("click", () => {
      if (confirm("Hapus arsip ini?")) {
        archives.splice(index, 1);
        localStorage.setItem("chatArchives", JSON.stringify(archives));
        renderArchiveList();
      }
    });

    archiveList.appendChild(div);
  });
}

function deleteChatById(chatId) {
  if (!chatId) return;

  let history = JSON.parse(localStorage.getItem("chatHistory")) || [];
  let archives = JSON.parse(localStorage.getItem("chatArchives")) || [];

  history = history.filter(item => item.id !== chatId);
  archives = archives.filter(item => item.id !== chatId);

  localStorage.setItem("chatHistory", JSON.stringify(history));
  localStorage.setItem("chatArchives", JSON.stringify(archives));

  // 🔥 JIKA CHAT AKTIF → BERSIHKAN UI
  if (activeChatId === chatId) {
    resetAll();
    activeChatId = null;
  }

  renderHistory();
  renderArchiveList?.();
}



function renderHistory() {

  const historyList = document.getElementById("historyList");
  if (!historyList) return;

  const history = JSON.parse(localStorage.getItem("chatHistory")) || [];
  historyList.innerHTML = "";

  if (!history.length) {
    historyList.innerHTML = `
      <div class="text-xs text-gray-400 text-center py-4">
        Belum ada chat
      </div>`;
    return;
  }

  history.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "group flex justify-between px-3 py-1 rounded hover:bg-slate-100";

    div.innerHTML = `
      <button class="history-open truncate text-left w-full text-sm">
        ${item.title}
      </button>

      <button class="w-6 h-8 opacity-0 group-hover:opacity-100 text-gray-500"
        onclick="toggleMenu(event, this)">
        <span class="material-symbols-outlined">more_vert</span>
      </button>

      <div class="menu hidden absolute right-2 mt-8 w-32 bg-white border rounded shadow">
        <button class="archiveItemBtn w-full px-3 py-2 flex gap-2 hover:bg-slate-100">
          <span class="material-symbols-outlined">archive</span> Arsip
        </button>
        <button class="deleteItemBtn w-full px-3 py-2 flex gap-2 text-red-600 hover:bg-red-50">
          <span class="material-symbols-outlined">delete</span> Hapus
        </button>
      </div>
    `;

    
    // ✅ BUKA CHAT
    div.querySelector(".history-open").addEventListener("click", () => {
      activeChatId = item.id; 
      restoreChat(item);
    });

    div.querySelector(".archiveItemBtn").addEventListener("click", () => {
      let archives = JSON.parse(localStorage.getItem("chatArchives")) || [];
      archives.unshift(item);
      history.splice(index, 1);

      localStorage.setItem("chatHistory", JSON.stringify(history));
      localStorage.setItem("chatArchives", JSON.stringify(archives));
      renderHistory();
    });



      div.querySelector(".deleteItemBtn").addEventListener("click", () => {
        if (!confirm("Hapus chat ini?")) return;

        deleteChatById(item.id); // 🔥 SATU PINTU
      });
          historyList.appendChild(div);
        });
      }

function exitImageMode() {
  closePreviewBtn?.classList.add("hidden", "opacity-0");

  if (hasImage) {
    dropZone.style.pointerEvents = "none";
  } else {
    dropZone.style.pointerEvents = "auto"; // 🔥 INI KUNCI
  }
}



function enterImageMode() {
  if (!hasImage) {
    dropZone.style.pointerEvents = "auto"; // 🔥 WAJIB
    return;
  }

  closePreviewBtn?.classList.remove("hidden", "opacity-0");
  dropZone.style.pointerEvents = "auto";
}



closeArchiveModal?.addEventListener("click", () => {
  archiveModal?.classList.add("hidden");
  globalOverlay?.classList.add("hidden");

  enterImageMode(); // ⬅️ KUNCI
});

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

  archiveBtn?.addEventListener("click", () => {
  exitImageMode(); // ⬅️ TAMBAHKAN INI
  renderArchiveList();
  archiveModal?.classList.remove("hidden");
  globalOverlay?.classList.remove("hidden");
});

profileBtn?.addEventListener("click", () => {
  exitImageMode(); // ⬅️ TAMBAHKAN
  profileModal?.classList.remove("hidden");
  profileOverlay?.classList.remove("hidden");
});

accountModalBtn?.addEventListener("click", () => {
  exitImageMode(); // ⬅️ TAMBAHKAN
  accountModal?.classList.remove("hidden");
  accountOverlay?.classList.remove("hidden");
});


function disableDropzoneUI() {
  isHistoryMode = true; // 🔒 LOCK HISTORY

  dropZone.classList.add("dropzone-preview", "is-history");

  forceCleanDropzone(); // 🔥 PAKSA BERSIH

  dropZone.style.pointerEvents = "none";
}




function restoreChat(item) {
  isHistoryMode = true;

  aiResult.textContent = item.content;
  aiResult.classList.remove("hidden");
  aiDivider.classList.remove("hidden");

  if (item.image) {
    hasImage = true;
    previewImg.src = item.image;

    previewCard.classList.remove("hidden");
    dropContent.classList.add("hidden");

    syncClosePreviewBtn();
    disableDropzoneUI(); // sudah bersih total
  } else {
    resetAll();
  }

  lockDetect();
}


  // =======================
  // RESET ALL
  // =======================
function resetAll() {
  isHistoryMode = false; // 🔓 BUKA KUNCI
  

  stopTyping = true;
  hideStopBtn();

  hasImage = false;
  previewImg.src = "";
  fileInput.value = "";

  closePreviewBtn?.classList.add("hidden", "opacity-0");
  previewCard.classList.add("hidden");

  dropContent?.classList.remove("hidden");
  dropZone.classList.remove("dropzone-preview", "is-history");

  dropZone.style.pointerEvents = "auto";
  dropZone.style.border = ""; 
  dropZone.style.outline = ""; 
  dropZone.style.boxShadow = "";

  aiResult.innerHTML = "";
  aiResult.classList.add("hidden");
  aiDivider.classList.add("hidden");

  hideArchiveBtn();
  unlockDetect();

  
}


  resetBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetAll();
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


function saveProfile() {
  const newUsername = usernameInput?.value.trim();
  const newPhoto = profilePhotoPreview?.src;

  if (!newUsername) {
    alert("Username tidak boleh kosong");
    return;
  }

  // Navbar
  if (navbarUsername) navbarUsername.textContent = newUsername;
  if (navbarAvatar && newPhoto) navbarAvatar.src = newPhoto;

  // Profile menu
  syncAccountMenu(newUsername, newPhoto);

  // Welcome section
  syncWelcomeUser(newUsername, newPhoto);


  syncAccountBtn(newUsername, newPhoto);

  // Simpan localStorage
  localStorage.setItem("profileData", JSON.stringify({
    username: newUsername,
    photo: newPhoto
  }));

  alert("✅ Profile berhasil diperbarui");
}
saveProfileBtn?.addEventListener("click", saveProfile);


// =====================
// LOAD PROFILE
// =====================
(function loadProfile() {
  const saved = JSON.parse(localStorage.getItem("profileData"));
  if (!saved) return;

  if (navbarUsername) navbarUsername.textContent = saved.username;
  if (navbarAvatar) navbarAvatar.src = saved.photo;

  if (profilePhotoPreview && saved.photo) {
    showAvatarImage(saved.photo);
  }

  if (usernameInput) usernameInput.value = saved.username;

  syncAccountMenu(saved.username, saved.photo);
  syncWelcomeUser(saved.username, saved.photo);
  syncAccountBtn(saved.username, saved.photo);

})();



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

const newChatBtn = document.getElementById("newChatBtn");

newChatBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  hasImage = false;          // 🔐 kunci utama

  resetAll();

  activeChatId = null;
  lastPredictionLabel = "";
  isHistoryMode = false;

  dropZone.style.pointerEvents = "auto";

  disableDetect();           // ⛔ detect mati PASTI

  window.scrollTo({ top: 0, behavior: "smooth" });
});


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






});