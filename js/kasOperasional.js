// ============================================================
// MODUL KAS OPERASIONAL (PETTY CASH)
// Beda dari billing: saldo dihitung dari SELURUH riwayat (bukan
// cuma tanggal terpilih), karena dana kas operasional memang
// dana berjalan (bukan pendapatan harian yang berdiri sendiri).
// Daftar entri yang ditampilkan tetap difilter per tanggal
// terpilih, tapi saldo di kartu atas selalu total sampai hari ini.
// ============================================================

let kasCacheHariIni = [];
let kasSaldoPerCabang = {}; // { [cabang_id]: saldo }

async function loadKasSemua() {
  let query = supabaseClient.from("kas_operasional_entri").select("*").eq("dihapus", false);
  if (AppState.selectedCabangId !== "semua") {
    query = query.eq("cabang_id", AppState.selectedCabangId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("Gagal memuat kas operasional:", error.message);
    return [];
  }
  return data || [];
}

function hitungSaldo(entries) {
  const perCabang = {};
  entries.forEach((e) => {
    if (!perCabang[e.cabang_id]) perCabang[e.cabang_id] = 0;
    perCabang[e.cabang_id] += e.jenis === "topup" ? Number(e.jumlah) : -Number(e.jumlah);
  });
  return perCabang;
}

async function renderKasTab() {
  const semuaEntri = await loadKasSemua();
  kasSaldoPerCabang = hitungSaldo(semuaEntri);
  kasCacheHariIni = semuaEntri
    .filter((e) => e.tanggal === AppState.selectedDate)
    .sort((a, b) => a.index_global - b.index_global);

  renderKasSaldoCard();
  renderKasNotifikasi();
  renderKasForm();
  renderKasList();
}

function renderKasNotifikasi() {
  const box = document.getElementById("kas-saldo-notif");
  if (AppState.selectedCabangId === "semua" || !AppState.pengaturanCabang) { box.innerHTML = ""; return; }

  const pengaturan = AppState.pengaturanCabang[AppState.selectedCabangId];
  const batas = (pengaturan && pengaturan.batas_saldo_minimum) || 300000;
  const saldo = kasSaldoPerCabang[AppState.selectedCabangId] || 0;

  if (saldo < batas) {
    box.innerHTML = `<div class="banner-warning">⚠ Saldo kas operasional mulai menipis: ${formatRupiah(saldo)} (batas notifikasi ${formatRupiah(batas)}). Segera ajukan top-up ke Pengawas.</div>`;
  } else {
    box.innerHTML = "";
  }
}

function renderKasSaldoCard() {
  const box = document.getElementById("kas-saldo");
  if (AppState.selectedCabangId === "semua") {
    const rows = AppState.cabangList.map((c) => {
      const saldo = kasSaldoPerCabang[c.id] || 0;
      return `<div class="row-mid"><span>${escapeHtml(c.nama)}</span><span class="row-amount">${formatRupiah(saldo)}</span></div>`;
    }).join("");
    box.innerHTML = `<h2>Saldo kas per cabang</h2>${rows}`;
  } else {
    const saldo = kasSaldoPerCabang[AppState.selectedCabangId] || 0;
    box.innerHTML = `<h2>Saldo kas operasional saat ini</h2><div class="summary-card" style="border:none; padding:0;"><div class="value" style="font-size:24px;">${formatRupiah(saldo)}</div></div>`;
  }
}

function renderKasForm() {
  const form = document.getElementById("form-kas");
  form.hidden = !(isKasir() || isPengawas());

  const jenisSelect = document.getElementById("k-jenis");
  if (isKasir()) {
    // Kasir hanya boleh pengeluaran — opsi topup disembunyikan sesuai keputusan akses.
    jenisSelect.innerHTML = `<option value="pengeluaran">Pengeluaran (belanja)</option>`;
  } else {
    jenisSelect.innerHTML = `
      <option value="pengeluaran">Pengeluaran (belanja)</option>
      <option value="topup">Top-up dari owner</option>`;
  }
}

function renderKasList() {
  const box = document.getElementById("kas-list");
  const visible = kasCacheHariIni;
  if (visible.length === 0) {
    box.innerHTML = `<div class="muted" style="text-align:center; padding:24px 0;">Belum ada catatan kas di tanggal/cabang ini.</div>`;
    return;
  }
  const showCabangTag = AppState.selectedCabangId === "semua";

  box.innerHTML = visible.map((e) => {
    const cabangTag = showCabangTag ? " · " + escapeHtml((cabangById(e.cabang_id) || {}).nama || "") : "";
    const jenisBadge = e.jenis === "topup"
      ? `<span class="badge-ok">Top-up</span>`
      : `<span class="row-meta">Pengeluaran</span>`;
    const notaBadge = e.status_nota === "belum_ada" ? `<span class="badge-pending">Nota belum ada</span>` : "";
    const barangBadge = e.status_barang === "belum_diambil" ? `<span class="badge-pending">Barang belum diambil</span>` : "";

    let deleteArea = "";
    if ((isKasir() || isPengawas())) {
      deleteArea = `<button class="btn-ghost small" data-kas-action="ajukan-hapus-kas" data-id="${e.id}">Ajukan hapus</button>`;
    }

    return `<div class="row-item">
      <div class="row-top">
        <span class="row-index">#${e.index_global}${cabangTag}</span>
        <span class="row-amount">${e.jenis === "topup" ? "+" : "-"} ${formatRupiah(e.jumlah)}</span>
      </div>
      <div class="row-mid"><span>${escapeHtml(e.keterangan)}</span>${jenisBadge}</div>
      <div class="row-meta">${escapeHtml(e.kategori || "")}</div>
      <div style="margin-top:4px; display:flex; gap:8px;">${notaBadge}${barangBadge}</div>
      <div style="margin-top:6px;">${deleteArea}</div>
    </div>`;
  }).join("");
}

async function submitKas(e) {
  e.preventDefault();
  const jenis = document.getElementById("k-jenis").value;
  const keterangan = document.getElementById("k-keterangan").value.trim();
  const jumlah = parseRibuanInput(document.getElementById("k-jumlah").value);
  const kategori = document.getElementById("k-kategori").value.trim();
  const statusNota = document.getElementById("k-status-nota").value;
  const statusBarang = document.getElementById("k-status-barang").value;

  if (!keterangan || !(jumlah > 0)) {
    showFormError("form-kas-error", "Lengkapi keterangan dan jumlah lebih dari 0.");
    return;
  }
  if (jenis === "topup" && !isPengawas()) {
    showFormError("form-kas-error", "Hanya pengawas yang bisa mencatat top-up.");
    return;
  }
  if (AppState.selectedCabangId === "semua") {
    showFormError("form-kas-error", "Pilih cabang tertentu dulu di atas (bukan \"Semua cabang\") sebelum mencatat entri kas.");
    return;
  }
  showFormError("form-kas-error", null);

  const cabangId = AppState.selectedCabangId;

  const { error } = await supabaseClient.from("kas_operasional_entri").insert({
    cabang_id: cabangId,
    tanggal: AppState.selectedDate,
    jenis: jenis,
    keterangan: keterangan,
    jumlah: jumlah,
    kategori: kategori || null,
    status_nota: statusNota,
    status_barang: statusBarang,
    diinput_oleh: AppState.profile.id,
  });

  if (error) { showFormError("form-kas-error", "Gagal menyimpan: " + error.message); return; }

  document.getElementById("k-keterangan").value = "";
  document.getElementById("k-jumlah").value = "";
  document.getElementById("k-kategori").value = "";
  await renderKasTab();
}

async function ajukanHapusKas(entriId) {
  const alasan = window.prompt("Alasan pengajuan hapus catatan kas ini:");
  if (alasan === null) return;
  const { error } = await supabaseClient.from("permintaan_hapus_kas").insert({
    entri_id: entriId,
    diajukan_oleh: AppState.profile.id,
    alasan: alasan || "(tanpa alasan tertulis)",
  });
  if (error) { alert("Gagal mengajukan hapus: " + error.message); return; }
  await renderKasTab();
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-kas-action]");
  if (!btn) return;
  if (btn.dataset.kasAction === "ajukan-hapus-kas") ajukanHapusKas(btn.dataset.id);
});
