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

const SUPABASE_URL = "https://axnsdczqnzrqvptsjehb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4bnNkY3pxbnpycXZwdHNqZWhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MjI4NjksImV4cCI6MjEwMzQ5ODg2OX0.naK3viTLLQ9QI1RdcJAUUHy1FHWpaoMkjRf4-IgfGOc";

if (typeof window.supabase === "undefined") {
  console.error("Supabase JS gagal dimuat. Cek koneksi internet / CDN.");
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
