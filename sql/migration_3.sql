-- ============================================================
-- MIGRASI #3 — KEUANGAN ORIGO
-- Jalankan setelah migration_2.sql (di project yang sama).
-- Menambahkan: kop/header tambahan struk, dan izin Pengawas
-- menghapus catatan penutupan kas harian yang salah input.
-- ============================================================

-- 1. Kolom kop/header tambahan struk (nama klinik, kontak, dst).
--    Diisi nilai default sesuai yang diminta — bisa diubah kapan saja
--    lewat Pengaturan > Preferensi struk oleh Pengawas.
alter table pengaturan_cabang add column if not exists kop_tambahan text
  not null default $$ORIGO CHILDREN STIMULATION CENTER
Telp/WhatsApp: 085-910-69999-31 | Instagram: @origo.id | Tiktok: @origocenter$$;

-- 2. Izinkan Pengawas menghapus catatan penutupan kas harian yang salah
--    input (mis. salah pencet saat uji coba). Dicatat juga di log_audit
--    dari sisi aplikasi setiap kali dipakai.
create policy "penutupan_kas_delete_pengawas" on penutupan_kas_harian for delete
  using ((select role from current_profile()) = 'pengawas');
