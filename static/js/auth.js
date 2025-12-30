document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn")
  if (!logoutBtn) return

  logoutBtn.addEventListener("click", () => {

    window.location.replace("/user/logout")
  })
})
