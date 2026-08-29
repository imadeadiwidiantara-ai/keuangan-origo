// ============================================================
// STATE TERPUSAT APLIKASI
// Objek tunggal yang menyimpan kondisi aplikasi saat ini.
// Setiap modul lain (billing.js, kasOperasional.js, dst) membaca
// dan mengubah objek ini, lalu memanggil fungsi render ulang.
// ============================================================

const AppState = {
  session: null,       // sesi Supabase Auth yang sedang login
  profile: null,       // { id, nama, role, cabang_id }
  cabangList: [],       // daftar semua cabang (dari tabel cabang)
  selectedCabangId: null, // uuid cabang aktif, atau 'semua' (khusus pengawas)
  selectedDate: todayISO(),
  activeTab: "billing",
};

function todayISO() {
  return toLocalISODate(new Date());
}

// PENTING: jangan pakai date.toISOString().slice(0,10) untuk tanggal lokal —
// toISOString() selalu mengonversi ke waktu UTC, yang bisa mundur satu hari
// dari tanggal lokal Anda (mis. WITA/UTC+8) tergantung jam saat itu. Fungsi
// ini menghitung tanggal langsung dari komponen waktu lokal, jadi selalu
// sama dengan tanggal yang terlihat di kalender/jam komputer Anda.
function toLocalISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isPengawas() {
  return AppState.profile && AppState.profile.role === "pengawas";
}
function isKasir() {
  return AppState.profile && AppState.profile.role === "kasir";
}
function isKeuangan() {
  return AppState.profile && AppState.profile.role === "keuangan";
}

function formatRupiah(n) {
  const angka = Math.round(Number(n) || 0);
  return "Rp " + angka.toLocaleString("id-ID");
}

function cabangById(id) {
  return AppState.cabangList.find((c) => c.id === id);
}
