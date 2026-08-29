// ============================================================
// HELPER UI UMUM
// Fungsi-fungsi yang dipakai lintas modul: pindah tab, render
// pilihan cabang, navigasi tanggal, menampilkan pesan error.
// ============================================================

function showScreen(name) {
  document.getElementById("screen-login").hidden = name !== "login";
  document.getElementById("screen-app").hidden = name !== "app";
}

function setActiveTab(tabName) {
  AppState.activeTab = tabName;
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== "tab-" + tabName;
  });
  refreshActiveTab();
}

function refreshActiveTab() {
  if (AppState.activeTab === "billing") renderBillingTab();
  else if (AppState.activeTab === "kas") renderKasTab();
  else if (AppState.activeTab === "pengawasan") renderPengawasanTab();
  else if (AppState.activeTab === "pengaturan") renderPengaturanTab();
}

function renderHeaderInfo() {
  const p = AppState.profile;
  if (!p) return;
  const roleLabel = { kasir: "Kasir", keuangan: "Keuangan", pengawas: "Pengawas" }[p.role];
  const cabangLabel = p.cabang_id ? " · " + (cabangById(p.cabang_id) || {}).nama : " · Semua cabang";
  document.getElementById("header-user-info").textContent = p.nama + " (" + roleLabel + ")" + (p.role !== "kasir" ? "" : cabangLabel);
  document.getElementById("tab-btn-pengawasan").hidden = p.role !== "pengawas";
}

function renderCabangBar() {
  const sel = document.getElementById("cabang-select");
  const wrap = document.getElementById("tambah-cabang-wrap");
  let options = "";

  if (isPengawas()) {
    options += `<option value="semua" ${AppState.selectedCabangId === "semua" ? "selected" : ""}>Semua cabang</option>`;
  }
  AppState.cabangList.forEach((c) => {
    const selected = AppState.selectedCabangId === c.id ? "selected" : "";
    options += `<option value="${c.id}" ${selected}>${escapeHtml(c.nama)}</option>`;
  });
  sel.innerHTML = options;
  wrap.hidden = !isPengawas();
}

function renderDateBar() {
  const dt = new Date(AppState.selectedDate + "T00:00:00");
  document.getElementById("date-label").textContent = dt.toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function shiftDate(days) {
  const dt = new Date(AppState.selectedDate + "T00:00:00");
  dt.setDate(dt.getDate() + days);
  AppState.selectedDate = dt.toISOString().slice(0, 10);
  renderDateBar();
  refreshActiveTab();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function formatRibuanInput(inputEl) {
  inputEl.addEventListener("input", function () {
    const digits = this.value.replace(/\D/g, "");
    this.value = digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
  });
}

function parseRibuanInput(value) {
  return parseFloat(String(value).replace(/\./g, "")) || 0;
}

function showFormError(elId, message) {
  const el = document.getElementById(elId);
  if (!message) { el.hidden = true; el.textContent = ""; return; }
  el.hidden = false;
  el.textContent = message;
}
