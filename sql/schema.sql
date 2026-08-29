-- ============================================================
-- KEUANGAN ORIGO — Skema Database (Supabase / PostgreSQL)
-- Jalankan file ini di Supabase Dashboard > SQL Editor
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- ENUM TYPES ----------
create type user_role as enum ('kasir', 'keuangan', 'pengawas');
create type metode_bayar as enum ('cash', 'transfer', 'qris');
create type status_bayar as enum ('lunas', 'paket', 'belum_bayar');
create type jenis_kas as enum ('topup', 'pengeluaran');
create type status_nota as enum ('ada', 'belum_ada');
create type status_barang as enum ('sudah_diambil', 'belum_diambil');
create type status_hapus as enum ('menunggu', 'disetujui', 'ditolak');

-- ---------- CABANG ----------
create table cabang (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  alamat text,
  dibuat_pada timestamptz not null default now()
);

-- ---------- PROFILES ----------
-- Satu baris per akun peran (kasir per cabang, 1 keuangan, 1 pengawas).
-- id di tabel ini SAMA dengan id di auth.users (dibuat lewat Supabase Auth).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  role user_role not null,
  cabang_id uuid references cabang(id), -- null untuk keuangan & pengawas (akses semua cabang)
  dibuat_pada timestamptz not null default now()
);

-- ---------- PENGATURAN PER CABANG ----------
create table pengaturan_cabang (
  cabang_id uuid primary key references cabang(id) on delete cascade,
  ukuran_kertas_struk text not null default '58',
  pesan_penutup_struk text not null default 'Terima kasih atas kepercayaan Anda',
  batas_saldo_minimum numeric(12,2) not null default 300000
);

-- ---------- MASTER DATA ----------
create table master_terapis (
  id uuid primary key default gen_random_uuid(),
  cabang_id uuid references cabang(id) on delete cascade,
  nama text not null,
  aktif boolean not null default true
);

create table master_layanan (
  id uuid primary key default gen_random_uuid(),
  cabang_id uuid references cabang(id) on delete cascade,
  nama text not null,
  harga numeric(12,2) not null,
  aktif boolean not null default true
);

-- ---------- TRANSAKSI BILLING ----------
create table transaksi (
  index_global bigint generated always as identity,
  id uuid primary key default gen_random_uuid(),
  cabang_id uuid not null references cabang(id),
  tanggal date not null default current_date,
  nama_klien text not null,
  terapis text not null,
  harga numeric(12,2) not null check (harga > 0),
  metode metode_bayar not null,
  status status_bayar not null default 'lunas',
  diinput_oleh uuid references profiles(id),
  struk_dicetak boolean not null default false,
  invoice_email text,
  dihapus boolean not null default false,
  dihapus_oleh uuid references profiles(id),
  alasan_hapus text,
  dibuat_pada timestamptz not null default now()
);

create index idx_transaksi_cabang_tanggal on transaksi (cabang_id, tanggal) where not dihapus;

-- ---------- PERMINTAAN HAPUS TRANSAKSI ----------
create table permintaan_hapus_transaksi (
  id uuid primary key default gen_random_uuid(),
  transaksi_id uuid not null references transaksi(id),
  diajukan_oleh uuid references profiles(id),
  alasan text not null,
  status status_hapus not null default 'menunggu',
  disetujui_oleh uuid references profiles(id),
  waktu_keputusan timestamptz
);

-- ---------- KAS OPERASIONAL ----------
create table kas_operasional_entri (
  index_global bigint generated always as identity,
  id uuid primary key default gen_random_uuid(),
  cabang_id uuid not null references cabang(id),
  tanggal date not null default current_date,
  jenis jenis_kas not null,
  keterangan text not null,
  jumlah numeric(12,2) not null check (jumlah > 0),
  kategori text,
  status_nota status_nota not null default 'belum_ada',
  status_barang status_barang not null default 'belum_diambil',
  diinput_oleh uuid references profiles(id),
  dihapus boolean not null default false,
  dihapus_oleh uuid references profiles(id),
  alasan_hapus text,
  dibuat_pada timestamptz not null default now()
);

create table permintaan_hapus_kas (
  id uuid primary key default gen_random_uuid(),
  entri_id uuid not null references kas_operasional_entri(id),
  diajukan_oleh uuid references profiles(id),
  alasan text not null,
  status status_hapus not null default 'menunggu',
  disetujui_oleh uuid references profiles(id),
  waktu_keputusan timestamptz
);

-- ---------- PENUTUPAN KAS HARIAN (pencocokan kas fisik billing) ----------
-- Catatan hasil hitung fisik uang cash di akhir shift/hari, dibandingkan
-- dengan total cash billing yang tercatat sistem. "dihitung_oleh" disimpan
-- sebagai teks bebas (nama orang yang menghitung saat itu), bukan terikat
-- akun login, karena satu akun kasir dipakai bergantian oleh beberapa orang.
create table penutupan_kas_harian (
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
-- Sengaja tidak ada policy update/delete — catatan penutupan kas bersifat
-- permanen begitu disimpan, seperti nota tutup kasir fisik.

-- ---------- LOG AUDIT (write-only, tidak ada policy update/delete sama sekali) ----------
create table log_audit (
  id uuid primary key default gen_random_uuid(),
  aksi text not null,
  aktor uuid references profiles(id),
  target_tabel text,
  target_id uuid,
  waktu timestamptz not null default now(),
  detail jsonb
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table cabang enable row level security;
alter table profiles enable row level security;
alter table pengaturan_cabang enable row level security;
alter table master_terapis enable row level security;
alter table master_layanan enable row level security;
alter table transaksi enable row level security;
alter table permintaan_hapus_transaksi enable row level security;
alter table kas_operasional_entri enable row level security;
alter table permintaan_hapus_kas enable row level security;
alter table log_audit enable row level security;

-- Fungsi bantu: ambil role & cabang milik user yang sedang login.
-- security definer supaya bisa baca tabel profiles tanpa terjebak RLS-nya sendiri (hindari infinite recursion).
create or replace function current_profile()
returns table (role user_role, cabang_id uuid) as $$
  select role, cabang_id from profiles where id = auth.uid();
$$ language sql stable security definer;

-- --- CABANG ---
create policy "cabang_select_semua" on cabang for select using (true);
create policy "cabang_insert_pengawas" on cabang for insert
  with check ((select role from current_profile()) = 'pengawas');
create policy "cabang_update_pengawas" on cabang for update
  using ((select role from current_profile()) = 'pengawas');

-- --- PROFILES ---
create policy "profiles_select_sendiri_atau_pengawas" on profiles for select
  using (id = auth.uid() or (select role from current_profile()) = 'pengawas');

-- --- TRANSAKSI ---
-- Kasir: hanya cabang sendiri, tidak dihapus
create policy "transaksi_select_kasir" on transaksi for select
  using (
    (select role from current_profile()) = 'kasir'
    and cabang_id = (select cabang_id from current_profile())
    and not dihapus
  );
create policy "transaksi_insert_kasir" on transaksi for insert
  with check (
    (select role from current_profile()) = 'kasir'
    and cabang_id = (select cabang_id from current_profile())
  );

-- Keuangan: semua cabang, hanya lihat (tidak ada policy insert/update)
create policy "transaksi_select_keuangan" on transaksi for select
  using ((select role from current_profile()) = 'keuangan' and not dihapus);

-- Pengawas: akses penuh semua cabang
create policy "transaksi_select_pengawas" on transaksi for select
  using ((select role from current_profile()) = 'pengawas');
create policy "transaksi_insert_pengawas" on transaksi for insert
  with check ((select role from current_profile()) = 'pengawas');
create policy "transaksi_update_pengawas" on transaksi for update
  using ((select role from current_profile()) = 'pengawas');

-- PENTING: sengaja TIDAK ADA policy DELETE pada tabel transaksi sama sekali.
-- Penghapusan sungguhan tidak pernah bisa lewat API — hanya lewat kolom
-- "dihapus" yang diubah pengawas (soft-delete), lewat alur permintaan hapus di bawah.

-- --- PERMINTAAN HAPUS TRANSAKSI ---
create policy "p_hapus_tx_insert" on permintaan_hapus_transaksi for insert
  with check (
    (select role from current_profile()) in ('kasir','pengawas')
    and diajukan_oleh = auth.uid()
  );
create policy "p_hapus_tx_select" on permintaan_hapus_transaksi for select
  using ((select role from current_profile()) in ('kasir','pengawas'));
create policy "p_hapus_tx_update_pengawas" on permintaan_hapus_transaksi for update
  using ((select role from current_profile()) = 'pengawas');

-- --- KAS OPERASIONAL ---
-- Kasir: hanya boleh insert jenis 'pengeluaran' di cabang sendiri (topup terkunci untuk pengawas)
create policy "kas_select_kasir" on kas_operasional_entri for select
  using (
    (select role from current_profile()) = 'kasir'
    and cabang_id = (select cabang_id from current_profile())
    and not dihapus
  );
create policy "kas_insert_kasir_pengeluaran" on kas_operasional_entri for insert
  with check (
    (select role from current_profile()) = 'kasir'
    and cabang_id = (select cabang_id from current_profile())
    and jenis = 'pengeluaran'
  );

create policy "kas_select_keuangan" on kas_operasional_entri for select
  using ((select role from current_profile()) = 'keuangan' and not dihapus);

create policy "kas_select_pengawas" on kas_operasional_entri for select
  using ((select role from current_profile()) = 'pengawas');
create policy "kas_insert_pengawas" on kas_operasional_entri for insert
  with check ((select role from current_profile()) = 'pengawas');
create policy "kas_update_pengawas" on kas_operasional_entri for update
  using ((select role from current_profile()) = 'pengawas');

-- --- PERMINTAAN HAPUS KAS ---
create policy "p_hapus_kas_insert" on permintaan_hapus_kas for insert
  with check (
    (select role from current_profile()) in ('kasir','pengawas')
    and diajukan_oleh = auth.uid()
  );
create policy "p_hapus_kas_select" on permintaan_hapus_kas for select
  using ((select role from current_profile()) in ('kasir','pengawas'));
create policy "p_hapus_kas_update_pengawas" on permintaan_hapus_kas for update
  using ((select role from current_profile()) = 'pengawas');

-- --- LOG AUDIT ---
create policy "log_audit_select_pengawas" on log_audit for select
  using ((select role from current_profile()) = 'pengawas');
create policy "log_audit_insert_semua" on log_audit for insert
  with check (auth.uid() is not null);
-- Sengaja tidak ada policy update/delete pada log_audit — write-only, tidak bisa diubah siapa pun.

-- --- MASTER DATA & PENGATURAN ---
create policy "master_terapis_select" on master_terapis for select using (true);
create policy "master_terapis_write_pengawas" on master_terapis for all
  using ((select role from current_profile()) = 'pengawas');

create policy "master_layanan_select" on master_layanan for select using (true);
create policy "master_layanan_write_pengawas" on master_layanan for all
  using ((select role from current_profile()) = 'pengawas');

create policy "pengaturan_select" on pengaturan_cabang for select using (true);
create policy "pengaturan_write_pengawas" on pengaturan_cabang for all
  using ((select role from current_profile()) = 'pengawas');

-- ============================================================
-- DATA AWAL CONTOH (opsional — hapus/ubah sesuai kebutuhan)
-- ============================================================
insert into cabang (nama, alamat) values
  ('Batubulan', ''),
  ('Siulan', '');
