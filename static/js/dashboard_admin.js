document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnTheme");
  const iconSun = document.getElementById("iconSun");
  const iconMoon = document.getElementById("iconMoon");
  

  // --- 1. Load saved theme ---
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      iconSun.classList.add("opacity-0");
      iconMoon.classList.remove("opacity-0");
  } else {
      document.documentElement.classList.remove("dark");
      iconMoon.classList.add("opacity-0");
      iconSun.classList.remove("opacity-0");
  }


  btn.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");

    // Save theme
  localStorage.setItem("theme", isDark ? "dark" : "light");

    if(isDark){
      iconSun.classList.add("fade-out");
      iconMoon.classList.remove("opacity-0");
      iconMoon.classList.add("fade-in");
    } else {
      iconMoon.classList.add("fade-out");
      iconSun.classList.remove("opacity-0");
      iconSun.classList.add("fade-in");
    }

    setTimeout(() => {
      iconSun.classList.remove("fade-in","fade-out");
      iconMoon.classList.remove("fade-in","fade-out");
      if(!isDark) iconMoon.classList.add("opacity-0");
      if(isDark) iconSun.classList.add("opacity-0");
    }, 300);
  });
});


    // Demo data (replace with fetch to your API)
    const demoPreds = Array.from({length: 24}).map((_,i)=>({
      id: i+1,
      file: `image_${i+1}.jpg`,
      label: i%3===0? 'Tanaman Sakit' : 'Tanaman Sehat',
      confidence: Math.round((60 + Math.random()*40)*10)/10,
      user: i%4===0? 'user1@gmail.com':'user2@gmail.com',
      date: new Date(Date.now() - i*3600*1000).toLocaleString()
    }));

    // UI refs
    const tableBody = document.getElementById('tableBody');
    const countEl = document.getElementById('count');

if (tableBody && countEl) {
    // jalankan fungsi renderTable hanya jika elemen ada
    renderTable();
}

    const recentList = document.getElementById('recentList');
    const usersBody = document.getElementById('usersBody');

    let page = 0; const pageSize = 8;

    function renderTable(){
      const start = page*pageSize;
      const items = demoPreds.slice(start, start+pageSize);
      tableBody.innerHTML = items.map(p=>`<tr class=\"hover:bg-slate-50\">\n<td class=\"p-2\">${p.id}</td>\n<td class=\"p-2\">${p.file}</td>\n<td class=\"p-2\">${p.label}</td>\n<td class=\"p-2\">${p.confidence}%</td>\n<td class=\"p-2\">${p.user}</td>\n<td class=\"p-2\">${p.date}</td>\n<td class=\"p-2\"><button class=\"px-2 py-1 text-sm bg-emerald-500 text-white rounded showDetailBtn\" data-id=\"${p.id}\">Detail</button></td>\n</tr>`).join('');
      countEl.textContent = demoPreds.length;
      // bind detail buttons
      document.querySelectorAll('.showDetailBtn').forEach(btn=>btn.addEventListener('click', openDetail));
    }

    function renderRecent(){
      recentList.innerHTML = demoPreds.slice(0,10).map(p=>`<li class=\"flex items-center justify-between\">\n<div class=\"text-sm\">\n<div class=\"font-medium\">${p.label}</div>\n<div class=\"text-xs text-slate-400\">${p.date}</div>\n</div>\n<div class=\"text-sm text-slate-500\">${p.confidence}%</div>\n</li>`).join('');
    }

  

    // modal
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');
    function openDetail(e){
      const id = Number(e.currentTarget.dataset.id);
      const p = demoPreds.find(x=>x.id===id);
      modalContent.innerHTML = `<div class=\"grid grid-cols-1 md:grid-cols-2 gap-4\"><div><img src=\"/static/uploads/${p.file}\" alt=\"img\" class=\"w-full rounded\"/></div><div><h3 class=\"font-semibold\">${p.label}</h3><p class=\"text-sm text-slate-500 mt-2\">Confidence: ${p.confidence}%</p><p class=\"mt-3 text-sm\">User: ${p.user}</p><p class=\"mt-3 text-sm\">Tanggal: ${p.date}</p><div class=\"mt-4\"><button class=\"px-3 py-2 bg-emerald-500 text-white rounded\">Mark as Reviewed</button></div></div></div>`;
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    document.getElementById('modalClose').addEventListener('click', ()=>{ modal.classList.add('hidden'); modal.classList.remove('flex'); });

    // profile menu
    document.getElementById('profileBtn').addEventListener('click', ()=>{ document.getElementById('profileMenu').classList.toggle('hidden'); });

    // sidebar for mobile
    document.getElementById('btnTheme').addEventListener('click', ()=>{
      const sb = document.getElementById('sidebar');
      if(sb.classList.contains('hidden')) sb.classList.remove('hidden'); else sb.classList.add('hidden');
    });



// === THEME CHECKER ===
function isDark() {
  return document.documentElement.classList.contains("dark");
}
document.addEventListener("DOMContentLoaded", function () {

  fetch("/admin/api/visits")
    .then(res => res.json())
    .then(data => {
      const ctx = document.getElementById("visitChart").getContext("2d");

      new Chart(ctx, {
        type: "line",
        data: {
          labels: data.labels,
          datasets: [{
            label: "Website Visits",
            data: data.values,

            // 🔥 HALUS
            tension: 0.4,               // lengkung garis
            borderWidth: 2,
            fill: true,

            // titik
            pointRadius: 4,
            pointHoverRadius: 6,

            // warna (Chart.js auto theme, nggak hardcode)
            backgroundColor: "rgba(54, 162, 235, 0.15)",
            borderColor: "rgba(54, 162, 235, 1)"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,

          animation: {
            duration: 1200,
            easing: "easeOutQuart"
          },

          plugins: {
            legend: {
              display: true
            },
            tooltip: {
              mode: "index",
              intersect: false
            }
          },

          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0
              },
              grid: {
                drawBorder: false
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    });

});


// === WARNA DINAMIS BERDASARKAN TEMA ===
function getChartColors() {
  if (isDark()) {
    return {
      border: "#34d399",
      background: "rgba(52, 211, 153, 0.15)",
      grid: "rgba(255,255,255,0.05)",
      ticks: "#cbd5e1"
    };
  } else {
    return {
      border: "#10b981",
      background: "rgba(16, 185, 129, 0.15)",
      grid: "rgba(0,0,0,0.05)",
      ticks: "#475569"
    };
  }
}
function countUserActivity(users) {
  const now = new Date();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  let active = 0;
  let notActive = 0;

  users.forEach(user => {
    const lastActive = new Date(user.last_active);
    const diff = now - lastActive;

    if (diff <= ONE_DAY) {
      active++;
    } else {
      notActive++;
    }
  });

  return { active, notActive };
}

function renderUserActivityStats(result) {
  const activeEl = document.getElementById("userActiveCount");
  const notActiveEl = document.getElementById("userNotActiveCount");

  if (!activeEl || !notActiveEl) return;

  activeEl.textContent = result.active;
  notActiveEl.textContent = result.notActive;
}


function countUserActivity(users) {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  let active = 0;
  let notActive = 0;

  users.forEach(user => {
    if (!user.last_active) {
      notActive++;
      return;
    }

    // 🔥 FIX UTC
    const lastActive = new Date(user.last_active + "Z").getTime();
    const diff = now - lastActive;

    if (diff <= ONE_DAY) {
      active++;
    } else {
      notActive++;
    }
  });

  return { active, notActive };
}



    
function loadUserActivityStats() {
  fetch("/admin/api/user-stats")
    .then(res => res.json())
    .then(data => {
      document.getElementById("userActiveCount").textContent = data.active;
      document.getElementById("userNotActiveCount").textContent = data.notActive;
    })
    .catch(err => console.error(err));
}

function loadUsers() {
  fetch("/admin/api/users")
    .then(res => res.json())
    .then(users => {
      const tbody = document.getElementById("usersBody");
      tbody.innerHTML = "";

      users.forEach((u, i) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td class="p-2">${i + 1}</td>
          <td class="p-2">${u.username || "-"}</td>
          <td class="p-2">${u.email}</td>
          <td class="p-2">${u.role}</td>
          <td class="p-2">
            <span class="${u.is_active ? 'text-emerald-600' : 'text-red-500'}">
              ${u.is_active ? 'Active' : 'Disabled'}
            </span>
          </td>
          <td class="p-2 text-center space-x-2">
            <button
              onclick="toggleUser(${u.id})"
              class="px-2 py-1 text-xs rounded bg-yellow-500 text-white">
              ${u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </button>

            <button
              onclick="deleteUser(${u.id})"
              class="px-2 py-1 text-xs rounded bg-red-600 text-white">
              Hapus
            </button>
          </td>
        `;

        tbody.appendChild(tr);
      });
    });
}

function toggleUser(userId) {
  if (!confirm("Ubah status user ini?")) return;

  fetch(`/admin/api/users/${userId}/toggle`, {
    method: "POST"
  })
    .then(res => res.json())
    .then(() => loadUsers())
    .catch(err => console.error(err));
}

function deleteUser(userId) {
  if (!confirm("User akan dihapus permanen. Lanjutkan?")) return;

  fetch(`/admin/api/users/${userId}`, {
    method: "DELETE"
  })
    .then(res => res.json())
    .then(() => loadUsers())
    .catch(err => console.error(err));
}


document.addEventListener("DOMContentLoaded", () => {
  loadUserActivityStats();
  setInterval(loadUserActivityStats, 60000);
});

function loadTotalPredictions() {
  fetch("/admin/api/predictions/count")
    .then(res => res.json())
    .then(data => {
      document.getElementById("totalPredictions").textContent = data.total;
    })
    .catch(err => console.error("Total predictions error:", err));
}

function loadRecentPredictions() {
  fetch("/admin/api/predictions/recent")
    .then(res => res.json())
    .then(list => {
      const ul = document.getElementById("recentList");
      ul.innerHTML = "";

      list.forEach(p => {
        const li = document.createElement("li");
        li.className = "text-sm text-slate-600 dark:text-slate-300";
        li.innerHTML = `
          <div class="font-medium">${p.result}</div>
          <div class="text-xs text-slate-400">
            ${p.user} • ${p.confidence}% • ${p.created_at}
          </div>
        `;
        ul.appendChild(li);
      });
    })
    .catch(err => console.error("Recent predictions error:", err));
}

document.addEventListener("DOMContentLoaded", () => {
  loadTotalPredictions();
  renderRecent();
});

document.addEventListener("DOMContentLoaded", () => {
  loadUsers();
});





