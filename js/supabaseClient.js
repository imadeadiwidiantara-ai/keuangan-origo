// ============================================================
// KONEKSI KE SUPABASE
// ============================================================
// GANTI dua nilai di bawah dengan milik Anda sendiri:
// Supabase Dashboard > Project Settings > API
//   - Project URL       -> SUPABASE_URL
//   - anon public key   -> SUPABASE_ANON_KEY
//
// anon key AMAN ditaruh di kode frontend (memang untuk itu),
// karena semua pembatasan akses sesungguhnya ditegakkan oleh
// Row Level Security di database (lihat sql/schema.sql), bukan
// oleh key ini.
// ============================================================

const SUPABASE_URL = "https://GANTI-DENGAN-PROJECT-ANDA.supabase.co";
const SUPABASE_ANON_KEY = "GANTI-DENGAN-ANON-KEY-ANDA";

if (typeof window.supabase === "undefined") {
  console.error("Supabase JS gagal dimuat. Cek koneksi internet / CDN.");
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
