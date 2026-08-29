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

// ============================================================
// CETAK BLUETOOTH LANGSUNG (EKSPERIMENTAL)
// Mencoba mengirim struk langsung ke printer thermal Bluetooth
// (protokol ESC/POS) tanpa dialog print, memakai Web Bluetooth API.
//
// PERINGATAN JUJUR: UUID service/characteristic di bawah ini adalah
// yang PALING UMUM dipakai printer thermal BLE murah generik — tapi
// tiap merek/tipe printer bisa beda. Kalau gagal atau hasil cetaknya
// kacau, itu bukan berarti aplikasinya rusak — coba dulu tombol
// "Cetak struk" biasa (dialog print) yang sudah pasti berfungsi di
// printer apa pun yang bisa diset sebagai default printer Windows/Mac.
// Kabari kalau ingin disesuaikan ke merek printer spesifik Anda.
// ============================================================

const BT_SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const BT_CHARACTERISTIC_UUID = "00002af1-0000-1000-8000-00805f9b34fb";

// Menyimpan ID printer yang sudah pernah dipilih (per cabang) di localStorage,
// supaya transaksi cash berikutnya tidak perlu buka dialog pilih perangkat
// lagi — cukup sekali di transaksi pertama. Kalau printer beda cabang beda
// unit, tiap cabang menyimpan ID printer-nya sendiri-sendiri.
async function dapatkanPerangkatBluetooth(cabangId) {
  const storageKey = "btPrinterId_" + cabangId;
  const savedId = localStorage.getItem(storageKey);

  if (savedId && navigator.bluetooth.getDevices) {
    try {
      const knownDevices = await navigator.bluetooth.getDevices();
      const match = knownDevices.find((d) => d.id === savedId);
      if (match) return match; // sudah pernah diizinkan, langsung pakai tanpa dialog lagi
    } catch (e) { /* lanjut ke requestDevice biasa di bawah */ }
  }

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [BT_SERVICE_UUID] }],
    optionalServices: [BT_SERVICE_UUID],
  });
  localStorage.setItem(storageKey, device.id);
  return device;
}

async function cetakStrukBluetooth(t) {
  if (!navigator.bluetooth) {
    alert("Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome/Edge di Android atau desktop (tidak didukung di iPhone/Safari).");
    return false;
  }
  try {
    const device = await dapatkanPerangkatBluetooth(t.cabang_id);
    if (!device) return false; // dibatalkan pengguna saat memilih perangkat

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(BT_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(BT_CHARACTERISTIC_UUID);

    const cabang = cabangById(t.cabang_id) || { nama: "Klinik" };
    const pengaturan = AppState.pengaturanCabang && AppState.pengaturanCabang[t.cabang_id];
    const footer = (pengaturan && pengaturan.pesan_penutup_struk) || "Terima kasih atas kepercayaan Anda";

    const lines = [
      cabang.nama,
      "No: #" + t.index_global,
      t.tanggal,
      "Klien: " + t.nama_klien,
      "Terapis: " + t.terapis,
      "Metode: " + t.metode.toUpperCase(),
      "TOTAL: " + formatRupiah(t.harga),
      "",
      footer,
      "", "", "",
    ].join("\n");

    const encoder = new TextEncoder();
    const ESC_INIT = new Uint8Array([0x1b, 0x40]); // reset printer
    const payload = new Uint8Array([...ESC_INIT, ...encoder.encode(lines)]);

    // Kirim per-potong kecil (20 byte) — banyak printer BLE murah tidak
    // menerima data dalam satu kiriman besar sekaligus.
    const CHUNK = 20;
    for (let i = 0; i < payload.length; i += CHUNK) {
      await characteristic.writeValue(payload.slice(i, i + CHUNK));
      await new Promise((r) => setTimeout(r, 30));
    }
    return true;
  } catch (err) {
    alert("Cetak Bluetooth gagal (" + err.message + "). Coba tombol \"Cetak struk\" biasa sebagai gantinya.");
    return false;
  }
}
