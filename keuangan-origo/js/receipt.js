// ============================================================
// MODUL STRUK
// Versi ini mencetak lewat dialog print bawaan browser, dengan
// lebar kertas mengikuti Preferensi Struk (58mm/80mm) di
// Pengaturan — printer thermal biasanya bisa diset sebagai
// default printer di sistem operasi, sehingga print dari
// browser otomatis keluar di printer struk itu.
//
// LANGKAH LANJUTAN (opsional): cetak langsung tanpa dialog print,
// lewat protokol ESC/POS memakai Web Bluetooth API. Ini butuh
// pairing manual ke tiap merek/tipe printer dan tidak bisa
// digeneralisasi tanpa unit printer sungguhan untuk diuji — jadi
// sengaja belum diimplementasikan di sini supaya tidak memberi
// kode yang belum tentu cocok dengan printer Anda.
// ============================================================

function cetakStruk(t) {
  const cabang = cabangById(t.cabang_id) || { nama: "Klinik", alamat: "" };
  const pengaturan = AppState.pengaturanCabang && AppState.pengaturanCabang[t.cabang_id];
  const paperClass = pengaturan && pengaturan.ukuran_kertas_struk === "80" ? "paper-80" : "";
  const footer = (pengaturan && pengaturan.pesan_penutup_struk) || "Terima kasih atas kepercayaan Anda";
  const jam = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const tanggal = new Date(t.tanggal + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const html = `
    <div class="receipt ${paperClass}">
      <div class="center">${escapeHtml(cabang.nama)}</div>
      ${cabang.alamat ? `<div class="center" style="font-size:11px;">${escapeHtml(cabang.alamat)}</div>` : ""}
      <div class="center" style="color:#666;">Jurnal Terapi Anak</div>
      <div class="line">──────────────</div>
      <div>No. Transaksi: #${t.index_global}</div>
      <div>Tanggal: ${tanggal}, ${jam}</div>
      <div class="line">──────────────</div>
      <div>Klien: ${escapeHtml(t.nama_klien)}</div>
      <div>Terapis: ${escapeHtml(t.terapis)}</div>
      <div>Metode: ${t.metode.toUpperCase()}</div>
      <div>Status: ${t.status === "lunas" ? "Lunas" : t.status === "paket" ? "Paket" : "Belum bayar"}</div>
      <div class="line">──────────────</div>
      <div class="flex-row"><span>Sesi terapi</span><span>${formatRupiah(t.harga)}</span></div>
      <div class="line">──────────────</div>
      <div class="flex-row" style="font-weight:500;"><span>TOTAL</span><span>${formatRupiah(t.harga)}</span></div>
      <div class="line">──────────────</div>
      <div class="center" style="color:#666;">${escapeHtml(footer)}</div>
    </div>`;

  const printArea = document.getElementById("print-area");
  printArea.innerHTML = html;
  printArea.hidden = false;
  window.print();
  printArea.hidden = true;
}
