// ============================================================
// MODUL PENGATURAN
// ============================================================

let openSettingsSection = "";
let masterTerapisCache = [];
let masterLayananCache = [];

async function loadPengaturanCabang() {
  const { data } = await supabaseClient.from("pengaturan_cabang").select("*");
  AppState.pengaturanCabang = {};
  (data || []).forEach((p) => { AppState.pengaturanCabang[p.cabang_id] = p; });
}

async function renderPengaturanTab() {
  await loadPengaturanCabang();

  if (AppState.selectedCabangId === "semua") {
    document.getElementById("pengaturan-content").innerHTML =
      `<p class="muted">Pilih cabang tertentu di atas (bukan "Semua cabang") untuk mengatur lokasi, master data, atau preferensi struk cabang tersebut.</p>`;
    return;
  }
  const cabangId = AppState.selectedCabangId;

  const { data: terapisData } = await supabaseClient.from("master_terapis").select("*").eq("cabang_id", cabangId);
  const { data: layananData } = await supabaseClient.from("master_layanan").select("*").eq("cabang_id", cabangId);
  masterTerapisCache = terapisData || [];
  masterLayananCache = layananData || [];

  renderSettingsSections(cabangId);
}

function renderSettingsSections(cabangId) {
  const cabang = cabangById(cabangId) || {};
  const pengaturan = AppState.pengaturanCabang[cabangId] || { ukuran_kertas_struk: "58", pesan_penutup_struk: "Terima kasih atas kepercayaan Anda" };

  const sections = [
    { key: "lokasi", title: "Info lokasi", editable: isPengawas() },
    { key: "master", title: "Master data", editable: isPengawas() },
    { key: "keamanan", title: "Keamanan", editable: true },
    { key: "struk", title: "Preferensi struk", editable: isPengawas() },
    { key: "backup", title: "Data dan backup", editable: true },
  ];

  const html = sections.map((s) => {
    let body = "";
    if (openSettingsSection === s.key) {
      if (s.key === "lokasi") {
        body = s.editable ? `
          <label>Nama cabang</label>
          <input type="text" id="set-cabang-nama" value="${escapeHtml(cabang.nama || "")}" />
          <label>Alamat</label>
          <input type="text" id="set-cabang-alamat" value="${escapeHtml(cabang.alamat || "")}" />
          <button class="btn-ghost small" data-set-action="simpan-lokasi" style="margin-top:8px;">Simpan</button>
        ` : `<p class="muted">Hanya pengawas yang bisa mengubah info lokasi.</p>`;
      } else if (s.key === "master") {
        body = renderMasterDataSection();
      } else if (s.key === "keamanan") {
        body = `<p class="muted">PIN app-level sudah digantikan login akun Supabase Auth. Untuk mengganti kata sandi akun, gunakan menu "Forgot password" di layar login, atau minta pengawas mengatur ulang lewat Supabase Dashboard.</p>`;
      } else if (s.key === "struk") {
        body = isPengawas() ? `
          <label>Ukuran kertas</label>
          <select id="set-paper">
            <option value="58" ${pengaturan.ukuran_kertas_struk === "58" ? "selected" : ""}>58mm</option>
            <option value="80" ${pengaturan.ukuran_kertas_struk === "80" ? "selected" : ""}>80mm</option>
          </select>
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
  if (AppState.selectedCabangId === "semua") return; // jaga-jaga: tombol ini seharusnya tidak muncul saat "Semua cabang" dipilih
  const cabangId = AppState.selectedCabangId;

  if (action === "toggle") {
    openSettingsSection = openSettingsSection === btn.dataset.key ? "" : btn.dataset.key;
    renderSettingsSections(cabangId);
  }
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
    await supabaseClient.from("pengaturan_cabang").upsert({
      cabang_id: cabangId, ukuran_kertas_struk: ukuran, pesan_penutup_struk: footer,
    });
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
