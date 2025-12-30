document.addEventListener("DOMContentLoaded", () => {

  // ================= BASIC ELEMENT =================
  const fileInput = document.getElementById("fileInput");
  const loading = document.getElementById("loading");
  const resultArea = document.getElementById("resultArea");
  const predLabel = document.getElementById("predLabel");
  const confidence = document.getElementById("confidence");
  const fileName = document.getElementById("fileName");
  const clearBtn = document.getElementById("clearBtn");
  const detectBtn = document.getElementById("detectBtn");
  const explanationBox = document.getElementById("explanationBox");
  const explanationContent = document.getElementById("explanationContent");

  // ================= TYPING EFFECT =================
  function chatGPTTyping(element, text, speed = 18) {
    element.textContent = "";
    let i = 0;
    text = String(text || "");

    function typing() {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
        setTimeout(typing, speed);
      }
    }
    typing();
  }

  function sendChat(message) {
  fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: message,
      mode: "full"   // 🔥 INI BEDANYA
    })
  })
  .then(res => res.json())
  .then(data => {
    showChatReply(data.reply)
  })
}

  // ================= CLEAR =================
  clearBtn.addEventListener("click", () => {
    fileInput.value = "";
    fileName.innerText = "";

    document.getElementById("dropPreviewImg").classList.add("hidden");
    document.getElementById("dropPlaceholder").classList.remove("hidden");
    document.getElementById("dropPreviewImg").src = "";

    explanationBox.classList.add("hidden");
    explanationContent.innerHTML = "";
    resultArea.classList.add("hidden");
  });

  // ================= DETECT =================
detectBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  if (!fileInput.files.length) {
    alert("Silakan pilih gambar terlebih dahulu");
    return;
  }

  loading.classList.remove("hidden");
  resultArea.classList.add("hidden");

  try {
    const formData = new FormData();
    formData.append("image", fileInput.files[0]);

    const res = await fetch("/api/predict", {
      method: "POST",
      body: formData
    });
 
    const data = await res.json();

    if (data.error === "login_required") {
      alert("Silakan login terlebih dahulu untuk mendeteksi tanaman 🌱");
      window.location.href = "/login";
      return;
    }

    /* ================= EXPLANATION ================= */
    let explanationText = "";

    if (data.status === "yakin") {
      explanationText = data.description || "";

    } else if (data.status === "perkiraan") {
      explanationText =
        (data.message || "") + "\n\n" +
        (data.predictions || []).map(
          p => `• ${p.label} (${p.confidence}%)`
        ).join("\n");

    } else {
      explanationText = data.description || "";
    }

    explanationBox.classList.remove("hidden");
    explanationContent.innerHTML = `
      <div class="fade-section">
        <p class="desc-text" id="descText"></p>
      </div>
    `;

    chatGPTTyping(
      document.getElementById("descText"),
      explanationText,
      18
    );

    /* ================= RESULT ================= */
    predLabel.innerText = data.label || "-";
    confidence.innerText = data.confidence
      ? `Confidence: ${data.confidence}%`
      : "";

    resultArea.classList.remove("hidden");

  } catch (err) {
    console.error(err);
    alert("Gagal memproses gambar");
  } finally {
    loading.classList.add("hidden");
  }
});


  // ================= DROPZONE =================
  const dropZone = document.getElementById("dropZone");

  ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  dropZone.addEventListener("dragover", () => {
    dropZone.classList.add("border-green-500", "bg-green-50");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("border-green-500", "bg-green-50");
  });

  dropZone.addEventListener("drop", (e) => {
    dropZone.classList.remove("border-green-500", "bg-green-50");

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran file maksimal 5MB");
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event("change"));
  });

  // ================= FILE INPUT CHANGE =================
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const dropPreviewImg = document.getElementById("dropPreviewImg");
    const dropPlaceholder = document.getElementById("dropPlaceholder");

    const imgURL = URL.createObjectURL(file);
    dropPreviewImg.src = imgURL;
    dropPreviewImg.classList.remove("hidden");
    dropPlaceholder.classList.add("hidden");

    dropPreviewImg.onload = () => URL.revokeObjectURL(imgURL);

    fileName.innerText = file.name;

    explanationBox.classList.remove("hidden");
    explanationContent.innerHTML = `
      <p class="text-gray-600">
        <strong>Image loaded.</strong><br>
        Please click <em>Detect now</em> to analyze the plant leaf.
      </p>
    `;
  });

  const params = new URLSearchParams(window.location.search)
  if (params.get("deleted") === "1") {
    const popup = document.getElementById("deleteSuccess")
    popup.classList.remove("hidden")

    setTimeout(() => {
      popup.classList.add("hidden")
    }, 3000)
  }

  confirmBtn.addEventListener("click", async () => {
  try {
    const res = await fetch("/api/user/delete", {
      method: "POST",
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    })

    if (!res.ok) throw new Error("Delete failed")

    // 🔥 redirect ke index + flag sukses
    window.location.href = "/?deleted=1"

  } catch (err) {
    alert("Failed to delete account")
    console.error(err)
  }
})

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search)

  if (params.get("deleted") === "1") {
    const toast = document.getElementById("deleteSuccess")

    if (toast) {
      toast.classList.remove("hidden")

      setTimeout(() => {
        toast.classList.add("hidden")
      }, 3000)
    }

    // 🧹 bersihkan URL
    window.history.replaceState({}, document.title, "/")
  }
})


});
