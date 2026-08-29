# Keuangan Origo

Aplikasi billing klinik terapi anak + kas operasional, web app (bisa dipasang jadi ikon desktop lewat PWA), tersambung ke Supabase.

Dokumen ini panduan setup dari nol sampai bisa dipakai di komputer cabang.

---

## Daftar isi
1. Buat project Supabase
2. Jalankan skema database
3. Buat akun peran (kasir, keuangan, pengawas)
4. Hubungkan kode ke project Supabase Anda
5. Coba jalankan di komputer sendiri
6. Publikasikan supaya bisa dibuka dari mana saja
7. Pasang sebagai ikon desktop (PWA)
8. Catatan keamanan & batasan yang perlu diketahui
9. Langkah lanjutan yang belum termasuk di versi ini

---

## 1. Buat project Supabase

1. Buka [supabase.com](https://supabase.com) → daftar/masuk → **New project**.
2. Catat **Project URL** dan **anon public key** dari menu *Project Settings > API* — dua nilai ini dibutuhkan di langkah 4.

## 2. Jalankan skema database

1. Di dashboard Supabase, buka **SQL Editor**.
2. Buka file `sql/schema.sql` di folder ini, salin semua isinya, tempel di SQL Editor, lalu **Run**.
3. Ini otomatis membuat semua tabel, aturan akses (Row Level Security), dan 2 cabang contoh ("Batubulan", "Siulan" — silakan ganti/hapus sesuai kebutuhan lewat tab Pengaturan di aplikasi nanti).

## 3. Buat akun peran

Aplikasi ini **tidak** memakai login per orang — cukup 1 akun per peran (sesuai kesepakatan kita karena satu komputer dipakai bersama):

1. Di dashboard Supabase → **Authentication > Users > Add user**, buat akun berikut (email boleh diganti, password bebas asal diingat):
   - `kasir.batubulan@keuanganorigo.app`
   - `kasir.siulan@keuanganorigo.app`
   - `keuangan@keuanganorigo.app`
   - `pengawas@keuanganorigo.app`
2. Untuk tiap akun, catat **User UID**-nya (terlihat di daftar user).
3. Buka **SQL Editor** lagi, jalankan (ganti `UID-...` dan `id-cabang-...` sesuai punya Anda — id cabang bisa dilihat di tabel `cabang`):

```sql
insert into profiles (id, nama, role, cabang_id) values
  ('UID-AKUN-KASIR-BATUBULAN', 'Kasir Batubulan', 'kasir', 'id-cabang-batubulan'),
  ('UID-AKUN-KASIR-SIULAN', 'Kasir Siulan', 'kasir', 'id-cabang-siulan'),
  ('UID-AKUN-KEUANGAN', 'Bagian Keuangan', 'keuangan', null),
  ('UID-AKUN-PENGAWAS', 'Pengawas', 'pengawas', null);
```

Tanpa baris di tabel `profiles` ini, akun bisa login tapi aplikasi akan menolak (karena tidak tahu perannya).

## 4. Hubungkan kode ke project Supabase Anda

Buka `js/supabaseClient.js`, ganti dua baris ini dengan nilai dari langkah 1:

```js
const SUPABASE_URL = "https://GANTI-DENGAN-PROJECT-ANDA.supabase.co";
const SUPABASE_ANON_KEY = "GANTI-DENGAN-ANON-KEY-ANDA";
```

## 5. Coba jalankan di komputer sendiri

Karena aplikasi ini memuat file lewat `fetch` (manifest, service worker), sebaiknya dibuka lewat server lokal kecil, bukan langsung klik dua kali file HTML-nya:

- Kalau punya Python terinstal: buka folder ini di terminal, jalankan `python -m http.server 8000`, lalu buka `http://localhost:8000` di Chrome.
- Atau pakai ekstensi **Live Server** di VS Code.

## 6. Publikasikan supaya bisa dibuka dari mana saja

Paling mudah untuk pemula: **Vercel** atau **Netlify** (gratis untuk skala ini).

1. Buat akun di [vercel.com](https://vercel.com).
2. Upload folder ini (lewat drag-and-drop di dashboard Vercel, atau hubungkan ke GitHub kalau sudah punya akun GitHub).
3. Setelah selesai deploy, Anda dapat alamat seperti `keuangan-origo.vercel.app` — inilah alamat yang dibuka di komputer tiap cabang.

## 7. Pasang sebagai ikon desktop (PWA)

Setelah web-nya online (langkah 6):
1. Buka alamatnya di **Chrome** atau **Edge**.
2. Klik ikon "Install" di address bar (atau menu titik tiga → *Install Keuangan Origo*).
3. Aplikasi akan muncul sebagai ikon tersendiri di desktop/taskbar, dengan ikon koin "Rp" yang sudah dibuat — dibuka tanpa terlihat address bar browser.

## 8. Catatan keamanan & batasan yang perlu diketahui

- **PIN yang dipakai di demo prototipe sebelumnya sudah diganti** dengan login akun Supabase Auth sungguhan untuk Pengawas — ini lebih aman karena dijaga di server, bukan disimpan/dicek di browser.
- **Pembatasan akses (kasir/keuangan/pengawas) ditegakkan di database** lewat Row Level Security (lihat `sql/schema.sql`), bukan cuma disembunyikan di tampilan — jadi tetap aman meski seseorang mencoba memanggil data langsung.
- **Cetak struk** memakai dialog print browser biasa (bukan protokol Bluetooth ESC/POS langsung) — lihat catatan di `js/receipt.js` untuk alasannya dan opsi lanjutannya.
- **Kirim invoice via email** saat ini baru menyimpan alamat tujuan ke database, belum benar-benar mengirim email — pengiriman otomatis butuh Supabase Edge Function + penyedia email (misalnya Resend), lihat bagian 9.

## 9. Langkah lanjutan yang belum termasuk di versi ini

Ini bukan kekurangan yang disembunyikan — sengaja belum dikerjakan supaya rilis pertama ini bisa segera dicoba dan dievaluasi:

- Pengiriman email invoice otomatis (perlu Supabase Edge Function).
- Cetak struk langsung ke printer Bluetooth tanpa dialog print (perlu pengujian dengan unit printer sungguhan).
- Saran nama otomatis (autocomplete) untuk kolom terapis/klien berdasarkan riwayat.
- Rincian pecahan uang kas (breakdown per lembar 100rb/50rb/dst) untuk pencocokan kas fisik.
- Grafik metode pembayaran di tab Pengaturan.
- Notifikasi otomatis kalau saldo kas operasional mulai menipis.

Silakan minta salah satu dari daftar ini kapan pun siap untuk dikerjakan lebih lanjut.
