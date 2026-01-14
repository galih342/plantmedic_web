document.addEventListener("DOMContentLoaded", () => {
  const usersBody = document.getElementById("usersBody");

  async function loadUsers() {
    const res = await fetch("/admin/api/users");
    const users = await res.json();

    usersBody.innerHTML = users.map((u, i) => `
      <tr>
        <td class="p-2">${i + 1}</td>
        <td class="p-2">${u.username}</td>
        <td class="p-2">${u.email}</td>
        <td class="p-2">${u.role}</td>
        <td class="p-2">
          <span class="${u.is_active ? 'text-green-600' : 'text-red-600'}">
            ${u.is_active ? 'Aktif' : 'Nonaktif'}
          </span>
        </td>

        <td class="p-2 text-center flex gap-2 justify-center">
        <button onclick="toggleUser(${u.id})"
          class="px-2 py-1 text-xs rounded bg-yellow-500 text-white">
          ${u.is_active ? "Nonaktifkan" : "Aktifkan"}
        </button>

        <button onclick="deleteUser(${u.id})"
          class="px-2 py-1 text-xs rounded bg-red-600 text-white">
          Hapus
        </button>
      </td>

      </tr>
    `).join("");
  }

  loadUsers();


  async function toggleUser(id) {
  await fetch(`/admin/api/users/${id}/toggle`, { method: "POST" });
  loadUsers();
}

async function deleteUser(id) {
  if (!confirm("Yakin ingin menghapus user ini?")) return;
  await fetch(`/admin/api/users/${id}`, { method: "DELETE" });
  loadUsers();
}


async function loadStats() {
  const res = await fetch("/admin/api/stats");
  const data = await res.json();

  document.getElementById("totalPredictions").innerText =
    data.total_predictions;
}

async function loadRecentPredictions() {
  const res = await fetch("/admin/api/recent-predictions");
  const data = await res.json();

  const body = document.getElementById("recentPredictionsBody");
  body.innerHTML = data.map(p => `
    <tr>
      <td>${p.user}</td>
      <td>${p.result}</td>
      <td>${p.confidence}%</td>
      <td>${p.time}</td>
    </tr>
  `).join("");
}

async function loadVisitChart() {
  const res = await fetch("/admin/api/visits");
  const data = await res.json();

  trendChart.data.labels = data.labels;
  trendChart.data.datasets[0].data = data.values;
  trendChart.update();

  
loadVisitChart();

setInterval(loadVisitChart, 60000); // 1 menit sekali
}




});
