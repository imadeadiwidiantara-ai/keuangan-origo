-- ============================================================
-- MIGRASI #2 — KEUANGAN ORIGO
-- Jalankan file ini di Supabase Dashboard > SQL Editor pada
-- project yang SUDAH dibuat sebelumnya (bukan project baru).
-- Ini menambahkan fitur "Tutup kas harian" dan "Notifikasi
-- saldo kas menipis" tanpa mengubah data yang sudah ada.
-- ============================================================

-- 1. Tabel baru: penutupan kas harian (rincian pecahan uang + nama penghitung)
create table if not exists penutupan_kas_harian (
  id uuid primary key default gen_random_uuid(),
  cabang_id uuid not null references cabang(id),
  tanggal date not null default current_date,
  total_dihitung numeric(12,2) not null,
  total_sistem numeric(12,2) not null,
  selisih numeric(12,2) not null,
  dihitung_oleh text not null,
  catatan text,
  dicatat_oleh uuid references profiles(id),
  dibuat_pada timestamptz not null default now()
);

alter table penutupan_kas_harian enable row level security;

create policy "penutupan_kas_select_kasir" on penutupan_kas_harian for select
  using (
    (select role from current_profile()) = 'kasir'
    and cabang_id = (select cabang_id from current_profile())
  );
create policy "penutupan_kas_insert_kasir" on penutupan_kas_harian for insert
  with check (
    (select role from current_profile()) = 'kasir'
    and cabang_id = (select cabang_id from current_profile())
  );
create policy "penutupan_kas_select_keuangan" on penutupan_kas_harian for select
  using ((select role from current_profile()) = 'keuangan');
create policy "penutupan_kas_select_pengawas" on penutupan_kas_harian for select
  using ((select role from current_profile()) = 'pengawas');
create policy "penutupan_kas_insert_pengawas" on penutupan_kas_harian for insert
  with check ((select role from current_profile()) = 'pengawas');

-- 2. Kolom baru: batas saldo minimum kas operasional (untuk notifikasi saldo menipis)
alter table pengaturan_cabang add column if not exists batas_saldo_minimum numeric(12,2) not null default 300000;

-- 3. Pastikan tiap cabang yang sudah ada punya baris pengaturan (kalau belum)
insert into pengaturan_cabang (cabang_id)
select id from cabang
where id not in (select cabang_id from pengaturan_cabang)
on conflict (cabang_id) do nothing;
