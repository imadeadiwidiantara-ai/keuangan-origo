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
  return new Date().toISOString().slice(0, 10);
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
