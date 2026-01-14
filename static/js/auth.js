// auth.js
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    
    // Clear localStorage
    localStorage.removeItem("profileData");
    localStorage.removeItem("chatHistory");
    localStorage.removeItem("chatArchives");
    sessionStorage.clear();

    // 🔥 Redirect ke /auth/logout (dengan prefix)
    window.location.href = "/auth/logout";
  });
});