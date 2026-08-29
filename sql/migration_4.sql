-- ============================================================
-- MIGRASI #4 — KEUANGAN ORIGO
-- Jalankan setelah migration_3.sql (di project yang sama).
--
-- Masalah: Kasir tidak punya izin UPDATE apa pun di tabel transaksi
-- (sengaja, supaya tidak bisa ubah harga/status). Tapi ini juga
-- memblokir mereka menandai "struk sudah dicetak" / "invoice sudah
-- dikirim ke email X" — yang seharusnya boleh.
--
-- Solusi: function khusus (RPC) yang HANYA boleh mengubah 2 kolom itu
-- saja (struk_dicetak, invoice_email), dan tetap mengecek kasir hanya
-- bisa menandai transaksi milik cabangnya sendiri. Data keuangan lain
-- (harga, status, metode, dst) tetap sama sekali tidak bisa diubah
-- lewat jalur ini.
-- ============================================================

create or replace function tandai_bukti_transaksi(
  p_transaksi_id uuid,
  p_struk_dicetak boolean default null,
  p_invoice_email text default null
) returns void as $$
declare
  v_role user_role;
  v_cabang_id uuid;
  v_tx_cabang_id uuid;
begin
  select role, cabang_id into v_role, v_cabang_id from profiles where id = auth.uid();

  select cabang_id into v_tx_cabang_id from transaksi where id = p_transaksi_id and not dihapus;

  if v_tx_cabang_id is null then
    raise exception 'Transaksi tidak ditemukan';
  end if;

  if v_role not in ('kasir', 'pengawas') then
    raise exception 'Tidak punya izin untuk menandai bukti transaksi';
  end if;

  if v_role = 'kasir' and v_tx_cabang_id <> v_cabang_id then
    raise exception 'Tidak punya akses ke transaksi cabang lain';
  end if;

  update transaksi set
    struk_dicetak = coalesce(p_struk_dicetak, struk_dicetak),
    invoice_email = coalesce(p_invoice_email, invoice_email)
  where id = p_transaksi_id;
end;
$$ language plpgsql security definer;

grant execute on function tandai_bukti_transaksi(uuid, boolean, text) to authenticated;
