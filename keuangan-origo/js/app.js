// ============================================================
// BOOTSTRAP APLIKASI
// Menghubungkan event UI ke fungsi-fungsi di modul lain, dan
// menjalankan pengecekan sesi login saat halaman pertama dibuka.
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  // ---------- Login ----------
  document.getElementById("btn-login").addEventListener("click", () => {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    if (!email || !password) {
      showFormError2("login-error", "Isi email dan kata sandi.");
      return;
    }
    handleLogin(email, password);
  });

  document.getElementById("btn-logout").addEventListener("click", handleLogout);

  // ---------- Tab navigasi ----------
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  // ---------- Cabang & tanggal ----------
  document.getElementById("cabang-select").addEventListener("change", (e) => {
    const val = e.target.value;
    AppState.selectedCabangId = val === "semua" ? "semua" : val;
    refreshActiveTab();
  });
  document.getElementById("btn-prev-day").addEventListener("click", () => shiftDate(-1));
  document.getElementById("btn-next-day").addEventListener("click", () => shiftDate(1));

  document.getElementById("btn-tambah-cabang").addEventListener("click", async () => {
    const nama = window.prompt("Nama cabang baru:");
    if (!nama) return;
    const alamat = window.prompt("Alamat cabang (boleh dikosongkan):") || "";
    const { error } = await supabaseClient.from("cabang").insert({ nama, alamat });
    if (error) { alert("Gagal menambah cabang: " + error.message); return; }
    await loadCabangList();
    renderCabangBar();
  });

  // ---------- Form transaksi & kas ----------
  formatRibuanInput(document.getElementById("f-harga"));
  formatRibuanInput(document.getElementById("k-jumlah"));

  document.getElementById("form-transaksi").addEventListener("submit", submitTransaksi);
  document.getElementById("form-kas").addEventListener("submit", submitKas);

  // ---------- Mulai aplikasi: cek apakah sudah pernah login ----------
  restoreSessionIfAny();
});

// ---------- Daftarkan service worker (supaya bisa dipasang sebagai PWA) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => {
      console.warn("Service worker gagal didaftarkan:", err);
    });
  });
}
