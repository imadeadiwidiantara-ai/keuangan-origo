// ============================================================
// MODUL PERSETUJUAN (khusus peran Pengawas)
// Menampilkan semua permintaan hapus (transaksi & kas operasional)
// berstatus "menunggu", lintas cabang.
// ============================================================

async function renderPengawasanTab() {
  const box = document.getElementById("pengawasan-list");
  if (!isPengawas()) {
    box.innerHTML = `<p class="muted">Halaman ini khusus untuk peran Pengawas.</p>`;
    return;
  }

  const { data: pTx } = await supabaseClient
    .from("permintaan_hapus_transaksi")
    .select("*, transaksi(index_global, nama_klien, terapis, harga, cabang_id)")
    .eq("status", "menunggu");

  const { data: pKas } = await supabaseClient
    .from("permintaan_hapus_kas")
    .select("*, kas_operasional_entri(index_global, keterangan, jumlah, cabang_id)")
    .eq("status", "menunggu");

  const txRows = (pTx || []).map((p) => {
    const t = p.transaksi || {};
    return `<div class="row-item">
      <div class="row-top"><span class="row-index">Transaksi #${t.index_global}</span><span class="row-amount">${formatRupiah(t.harga)}</span></div>
      <div class="row-mid"><span>${escapeHtml(t.nama_klien || "")} · ${escapeHtml(t.terapis || "")}</span></div>
      <div class="row-meta">Alasan: ${escapeHtml(p.alasan)}</div>
      <div style="margin-top:6px; display:flex; gap:8px;">
        <button class="btn-ghost small" data-pengawas-action="setuju-tx" data-id="${p.id}" data-tx="${p.transaksi_id}">Setujui hapus</button>
        <button class="btn-ghost small" data-pengawas-action="tolak-tx" data-id="${p.id}">Tolak</button>
      </div>
    </div>`;
  }).join("");

  const kasRows = (pKas || []).map((p) => {
    const k = p.kas_operasional_entri || {};
    return `<div class="row-item">
      <div class="row-top"><span class="row-index">Kas #${k.index_global}</span><span class="row-amount">${formatRupiah(k.jumlah)}</span></div>
      <div class="row-mid"><span>${escapeHtml(k.keterangan || "")}</span></div>
      <div class="row-meta">Alasan: ${escapeHtml(p.alasan)}</div>
      <div style="margin-top:6px; display:flex; gap:8px;">
        <button class="btn-ghost small" data-pengawas-action="setuju-kas" data-id="${p.id}" data-entri="${p.entri_id}">Setujui hapus</button>
        <button class="btn-ghost small" data-pengawas-action="tolak-kas" data-id="${p.id}">Tolak</button>
      </div>
    </div>`;
  }).join("");

  if (!txRows && !kasRows) {
    box.innerHTML = `<div class="muted" style="text-align:center; padding:24px 0;">Tidak ada permintaan hapus yang menunggu.</div>`;
    return;
  }

  box.innerHTML = `
    ${txRows ? `<h2>Permintaan hapus transaksi</h2>${txRows}` : ""}
    ${kasRows ? `<h2 style="margin-top:16px;">Permintaan hapus kas operasional</h2>${kasRows}` : ""}
  `;
}

async function catatLogAudit(aksi, targetTabel, targetId, detail) {
  await supabaseClient.from("log_audit").insert({
    aksi, target_tabel: targetTabel, target_id: targetId, aktor: AppState.profile.id, detail: detail || {},
  });
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-pengawas-action]");
  if (!btn) return;
  const action = btn.dataset.pengawasAction;

  if (action === "setuju-tx") {
    await supabaseClient.from("transaksi").update({
      dihapus: true, dihapus_oleh: AppState.profile.id,
    }).eq("id", btn.dataset.tx);
    await supabaseClient.from("permintaan_hapus_transaksi").update({
      status: "disetujui", disetujui_oleh: AppState.profile.id, waktu_keputusan: new Date().toISOString(),
    }).eq("id", btn.dataset.id);
    await catatLogAudit("hapus_transaksi_disetujui", "transaksi", btn.dataset.tx);
    await renderPengawasanTab();
  }
  if (action === "tolak-tx") {
    await supabaseClient.from("permintaan_hapus_transaksi").update({
      status: "ditolak", disetujui_oleh: AppState.profile.id, waktu_keputusan: new Date().toISOString(),
    }).eq("id", btn.dataset.id);
    await renderPengawasanTab();
  }
  if (action === "setuju-kas") {
    await supabaseClient.from("kas_operasional_entri").update({
      dihapus: true, dihapus_oleh: AppState.profile.id,
    }).eq("id", btn.dataset.entri);
    await supabaseClient.from("permintaan_hapus_kas").update({
      status: "disetujui", disetujui_oleh: AppState.profile.id, waktu_keputusan: new Date().toISOString(),
    }).eq("id", btn.dataset.id);
    await catatLogAudit("hapus_kas_disetujui", "kas_operasional_entri", btn.dataset.entri);
    await renderPengawasanTab();
  }
  if (action === "tolak-kas") {
    await supabaseClient.from("permintaan_hapus_kas").update({
      status: "ditolak", disetujui_oleh: AppState.profile.id, waktu_keputusan: new Date().toISOString(),
    }).eq("id", btn.dataset.id);
    await renderPengawasanTab();
  }
});
