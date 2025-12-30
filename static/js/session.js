// =======================
// SESSION STATE
// =======================
const DEFAULT_SESSION = {
  isHistoryMode: false,
  hasImage: false,
  stopTyping: false,
  lastPredictionLabel: "",
  activeChatId: null
}

let session = { ...DEFAULT_SESSION }

// =======================
// RESET SESSION
// =======================
function resetSession() {
  session = { ...DEFAULT_SESSION }
  applySessionToUI()
}

// =======================
// APPLY SESSION → UI
// =======================
function applySessionToUI() {
  // 🔥 GLOBAL FLAGS (sinkron)
  window.isHistoryMode = false
  window.hasImage = false
  window.stopTyping = false
  window.lastPredictionLabel = ""
  window.activeChatId = null

  // ===== DROPZONE =====
  if (window.dropZone) {
    dropZone.style.pointerEvents = "auto"
    dropZone.classList.remove("is-history", "dropzone-preview")
  }

  // ===== IMAGE =====
  if (window.fileInput) fileInput.value = ""
  if (window.previewImg) previewImg.src = ""
  if (window.previewCard) previewCard.classList.add("hidden")
  if (window.dropContent) dropContent.classList.remove("hidden")
  if (window.closePreviewBtn) closePreviewBtn.classList.add("hidden")

  // ===== AI RESULT =====
  if (window.aiResult) {
    aiResult.textContent = ""
    aiResult.classList.add("hidden")
  }
  if (window.aiDivider) aiDivider.classList.add("hidden")

  // ===== BUTTON =====
  if (window.sendBtn) sendBtn.disabled = true
  if (window.hideStopBtn) hideStopBtn()
  if (window.hideArchiveBtn) hideArchiveBtn()

  // ===== SCROLL =====
  window.scrollTo({ top: 0, behavior: "smooth" })
}
