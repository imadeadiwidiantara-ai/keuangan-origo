// ============================================================
// MODUL PENGATURAN
// ============================================================

let openSettingsSection = "";
let masterTerapisCache = [];
let masterLayananCache = [];
let grafikTxCache = [];
let grafikDari = AppState.selectedDate;
let grafikKe = AppState.selectedDate;

async function loadPengaturanCabang() {
  const { data } = await supabaseClient.from("pengaturan_cabang").select("*");
  AppState.pengaturanCabang = {};
  (data || []).forEach((p) => { AppState.pengaturanCabang[p.cabang_id] = p; });
}

async function renderPengaturanTab() {
  await loadPengaturanCabang();

  // cabangId null berarti sedang lihat "Semua cabang" (khusus keuangan/pengawas).
  // Bagian yang memang milik 1 cabang spesifik (lokasi, master data, struk,
  // notifikasi) tetap wajib pilih cabang tertentu — tapi Grafik, Keamanan,
  // dan Data & backup tetap bisa dipakai dalam mode gabungan semua cabang.
  const cabangId = AppState.selectedCabangId === "semua" ? null : AppState.selectedCabangId;

  if (cabangId) {
    const { data: terapisData } = await supabaseClient.from("master_terapis").select("*").eq("cabang_id", cabangId);
    const { data: layananData } = await supabaseClient.from("master_layanan").select("*").eq("cabang_id", cabangId);
    masterTerapisCache = terapisData || [];
    masterLayananCache = layananData || [];
  } else {
    masterTerapisCache = [];
    masterLayananCache = [];
  }

  await loadGrafikData(cabangId);
  renderSettingsSections(cabangId);
}

async function loadGrafikData(cabangId) {
  let query = supabaseClient
    .from("transaksi").select("metode, harga")
    .gte("tanggal", grafikDari).lte("tanggal", grafikKe)
    .eq("dihapus", false);
  if (cabangId) query = query.eq("cabang_id", cabangId);

  const { data } = await query;
  grafikTxCache = data || [];
}

function renderSettingsSections(cabangId) {
  const cabang = cabangId ? (cabangById(cabangId) || {}) : {};
  const pengaturan = (cabangId && AppState.pengaturanCabang[cabangId]) || {
    ukuran_kertas_struk: "58",
    pesan_penutup_struk: "Terima kasih atas kepercayaan Anda",
    kop_tambahan: "",
    batas_saldo_minimum: 300000,
  };
  const pilihCabangDulu = `<p class="muted">Pilih cabang tertentu di atas (bukan "Semua cabang") untuk mengatur bagian ini.</p>`;

  // Grafik metode pembayaran SENGAJA tidak dimasukkan sama sekali ke daftar
  // untuk peran Kasir — bukan cuma disembunyikan tampilannya, section-nya
  // memang tidak pernah dirender untuk Kasir.
  const sections = [
    { key: "lokasi", title: "Info lokasi" },
    { key: "master", title: "Master data" },
    ...(isKasir() ? [] : [{ key: "grafik", title: "Grafik metode pembayaran" }]),
    { key: "keamanan", title: "Keamanan" },
    { key: "struk", title: "Preferensi struk" },
    { key: "notifikasi", title: "Notifikasi saldo kas" },
    { key: "backup", title: "Data dan backup" },
  ];

  const html = sections.map((s) => {
    let body = "";
    if (openSettingsSection === s.key) {
      if (s.key === "lokasi") {
        if (!cabangId) body = pilihCabangDulu;
        else body = isPengawas() ? `
          <label>Nama cabang</label>
          <input type="text" id="set-cabang-nama" value="${escapeHtml(cabang.nama || "")}" />
          <label>Alamat</label>
          <input type="text" id="set-cabang-alamat" value="${escapeHtml(cabang.alamat || "")}" />
          <button class="btn-ghost small" data-set-action="simpan-lokasi" style="margin-top:8px;">Simpan</button>
        ` : `<p class="muted">Hanya pengawas yang bisa mengubah info lokasi.</p>`;
      } else if (s.key === "master") {
        body = !cabangId ? pilihCabangDulu : renderMasterDataSection();
      } else if (s.key === "grafik") {
        body = renderGrafikSection();
      } else if (s.key === "notifikasi") {
        if (!cabangId) body = pilihCabangDulu;
        else body = isPengawas() ? `
          <label>Beri tahu kalau saldo kas operasional di bawah:</label>
          <input type="text" id="set-batas-saldo" inputmode="numeric" value="${Math.round(pengaturan.batas_saldo_minimum || 300000)}" />
          <button class="btn-ghost small" data-set-action="simpan-notifikasi" style="margin-top:8px;">Simpan</button>
        ` : `<p class="muted">Batas notifikasi saat ini: ${formatRupiah(pengaturan.batas_saldo_minimum || 300000)}. Hanya pengawas yang bisa mengubah.</p>`;
      } else if (s.key === "keamanan") {
        body = `<p class="muted">PIN app-level sudah digantikan login akun Supabase Auth. Untuk mengganti kata sandi akun, gunakan menu "Forgot password" di layar login, atau minta pengawas mengatur ulang lewat Supabase Dashboard.</p>`;
      } else if (s.key === "struk") {
        if (!cabangId) body = pilihCabangDulu;
        else body = isPengawas() ? `
          <label>Ukuran kertas</label>
          <select id="set-paper">
            <option value="58" ${pengaturan.ukuran_kertas_struk === "58" ? "selected" : ""}>58mm</option>
            <option value="80" ${pengaturan.ukuran_kertas_struk === "80" ? "selected" : ""}>80mm</option>
          </select>
          <label>Kop / header tambahan struk (nama klinik, kontak, dsb — boleh beberapa baris)</label>
          <textarea id="set-kop" rows="3" style="width:100%; font-family:inherit; padding:8px 10px; border:1px solid var(--border); border-radius:var(--radius);">${escapeHtml(pengaturan.kop_tambahan || "")}</textarea>
          <label>Pesan penutup struk</label>
          <input type="text" id="set-footer" value="${escapeHtml(pengaturan.pesan_penutup_struk)}" />
          <button class="btn-ghost small" data-set-action="simpan-struk" style="margin-top:8px;">Simpan</button>
        ` : `<p class="muted">Hanya pengawas yang bisa mengubah preferensi struk.</p>`;
      } else if (s.key === "backup") {
        body = `<p class="muted">Unduh transaksi tanggal ${AppState.selectedDate} sebagai CSV.</p>
          <button class="btn-ghost small" data-set-action="unduh-csv">Unduh CSV</button>`;
      }
    }
    return `<div class="settings-section">
      <button class="settings-section-title" data-set-action="toggle" data-key="${s.key}">${s.title} ${openSettingsSection === s.key ? "▲" : "▼"}</button>
      ${body}
    </div>`;
  }).join("");

  document.getElementById("pengaturan-content").innerHTML = html;
}

function renderGrafikSection() {
  const totalBy = (m) => grafikTxCache.filter((t) => t.metode === m).reduce((a, t) => a + Number(t.harga), 0);
  const cash = totalBy("cash"), transfer = totalBy("transfer"), qris = totalBy("qris");
  const maxV = Math.max(cash, transfer, qris, 1);
  const bar = (label, val, color) => {
    const pct = Math.round((val / maxV) * 100);
    return `<div class="bar-row">
      <div class="bar-label"><span>${label}</span><span>${formatRupiah(val)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${color};"></div></div>
    </div>`;
  };
  const cakupan = AppState.selectedCabangId === "semua" ? "Semua cabang" : (cabangById(AppState.selectedCabangId) || {}).nama;

  return `
    <div style="display:flex; gap:8px; align-items:flex-end; margin:8px 0 12px; flex-wrap:wrap;">
      <div>
        <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:4px;">Dari tanggal</label>
        <input type="date" id="grafik-dari" value="${grafikDari}" />
      </div>
      <div>
        <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:4px;">Sampai tanggal</label>
        <input type="date" id="grafik-ke" value="${grafikKe}" />
      </div>
      <button class="btn-ghost small" data-set-action="terapkan-grafik">Terapkan</button>
    </div>
    <p class="muted" style="margin:0 0 8px;">${escapeHtml(cakupan)} · ${grafikDari === grafikKe ? grafikDari : grafikDari + " s/d " + grafikKe}</p>
    ${bar("Cash", cash, "var(--blue)")}
    ${bar("Transfer", transfer, "#2f8a4e")}
    ${bar("QRIS", qris, "var(--amber)")}
  `;
}

function renderMasterDataSection() {
  if (!isPengawas()) return `<p class="muted">Hanya pengawas yang bisa mengelola master data.</p>`;
  const terapisRows = masterTerapisCache.map((t) =>
    `<div class="row-mid"><span>${escapeHtml(t.nama)}</span><button class="btn-ghost small" data-set-action="hapus-terapis" data-id="${t.id}">Hapus</button></div>`
  ).join("") || `<p class="muted">Belum ada terapis tersimpan.</p>`;

  const layananRows = masterLayananCache.map((l) =>
    `<div class="row-mid"><span>${escapeHtml(l.nama)} — ${formatRupiah(l.harga)}</span><button class="btn-ghost small" data-set-action="hapus-layanan" data-id="${l.id}">Hapus</button></div>`
  ).join("") || `<p class="muted">Belum ada layanan tersimpan.</p>`;

  return `
    <p style="font-weight:500; margin:8px 0 4px;">Daftar terapis</p>
    ${terapisRows}
    <div style="display:flex; gap:8px; margin:8px 0;">
      <input type="text" id="new-terapis-nama" placeholder="Nama terapis baru" style="flex:1;" />
      <button class="btn-ghost small" data-set-action="tambah-terapis">Tambah</button>
    </div>
    <p style="font-weight:500; margin:16px 0 4px;">Daftar layanan dan harga</p>
    ${layananRows}
    <div style="display:flex; gap:8px; margin:8px 0;">
      <input type="text" id="new-layanan-nama" placeholder="Nama layanan" style="flex:1;" />
      <input type="text" id="new-layanan-harga" inputmode="numeric" placeholder="Harga" style="width:110px;" />
      <button class="btn-ghost small" data-set-action="tambah-layanan">Tambah</button>
    </div>`;
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-set-action]");
  if (!btn) return;
  const action = btn.dataset.setAction;
  const cabangId = AppState.selectedCabangId === "semua" ? null : AppState.selectedCabangId;

  if (action === "toggle") {
    openSettingsSection = openSettingsSection === btn.dataset.key ? "" : btn.dataset.key;
    renderSettingsSections(cabangId);
  }
  if (action === "terapkan-grafik") {
    grafikDari = document.getElementById("grafik-dari").value || AppState.selectedDate;
    grafikKe = document.getElementById("grafik-ke").value || AppState.selectedDate;
    await loadGrafikData(cabangId);
    renderSettingsSections(cabangId);
  }
  if (!cabangId) return; // aksi di bawah ini semua butuh 1 cabang spesifik

  if (action === "simpan-lokasi") {
    const nama = document.getElementById("set-cabang-nama").value.trim();
    const alamat = document.getElementById("set-cabang-alamat").value.trim();
    await supabaseClient.from("cabang").update({ nama, alamat }).eq("id", cabangId);
    await loadCabangList();
    renderCabangBar();
    renderSettingsSections(cabangId);
  }
  if (action === "simpan-struk") {
    const ukuran = document.getElementById("set-paper").value;
    const footer = document.getElementById("set-footer").value.trim();
    const kop = document.getElementById("set-kop").value;
    await supabaseClient.from("pengaturan_cabang").upsert({
      cabang_id: cabangId, ukuran_kertas_struk: ukuran, pesan_penutup_struk: footer, kop_tambahan: kop,
    });
    await loadPengaturanCabang();
    renderSettingsSections(cabangId);
  }
  if (action === "simpan-notifikasi") {
    const batas = parseFloat(document.getElementById("set-batas-saldo").value.replace(/\D/g, "")) || 0;
    await supabaseClient.from("pengaturan_cabang").upsert({ cabang_id: cabangId, batas_saldo_minimum: batas });
    await loadPengaturanCabang();
    renderSettingsSections(cabangId);
  }
  if (action === "tambah-terapis") {
    const nama = document.getElementById("new-terapis-nama").value.trim();
    if (!nama) return;
    await supabaseClient.from("master_terapis").insert({ cabang_id: cabangId, nama });
    await renderPengaturanTab();
  }
  if (action === "hapus-terapis") {
    await supabaseClient.from("master_terapis").delete().eq("id", btn.dataset.id);
    await renderPengaturanTab();
  }
  if (action === "tambah-layanan") {
    const nama = document.getElementById("new-layanan-nama").value.trim();
    const harga = parseRibuanInput(document.getElementById("new-layanan-harga").value);
    if (!nama || !(harga > 0)) return;
    await supabaseClient.from("master_layanan").insert({ cabang_id: cabangId, nama, harga });
    await renderPengaturanTab();
  }
  if (action === "hapus-layanan") {
    await supabaseClient.from("master_layanan").delete().eq("id", btn.dataset.id);
    await renderPengaturanTab();
  }
  if (action === "unduh-csv") {
    await unduhCsvTransaksi();
  }
});

async function unduhCsvTransaksi() {
  const rows = await loadTransaksi();
  let csv = "Index,Tanggal,Cabang,Klien,Terapis,Harga,Metode,Status\n";
  rows.forEach((t) => {
    const namaCabang = (cabangById(t.cabang_id) || {}).nama || "";
    csv += [t.index_global, t.tanggal, namaCabang, t.nama_klien, t.terapis, t.harga, t.metode, t.status].join(",") + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "billing-" + AppState.selectedDate + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
