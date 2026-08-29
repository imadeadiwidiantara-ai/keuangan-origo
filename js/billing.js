// ============================================================
// MODUL BILLING
// Tampilan & aksi untuk tab "Billing": input transaksi, daftar
// transaksi hari berjalan, ringkasan, kirim bukti (struk/email),
// dan pengajuan hapus.
// ============================================================

let billingCache = []; // transaksi hasil query terakhir, dipakai ulang saat re-render kecil (mis. buka panel bukti)
const buktiPanelOpen = {}; // { [transaksi.id]: boolean }

async function loadTransaksi() {
  let query = supabaseClient
    .from("transaksi")
    .select("*")
    .eq("tanggal", AppState.selectedDate)
    .order("index_global", { ascending: true });

  if (AppState.selectedCabangId !== "semua") {
    query = query.eq("cabang_id", AppState.selectedCabangId);
  }
  // RLS di database yang sesungguhnya menegakkan siapa boleh lihat apa;
  // filter di sini hanya untuk mempersempit tampilan sesuai cabang terpilih.

  const { data, error } = await query;
  if (error) {
    console.error("Gagal memuat transaksi:", error.message);
    return [];
  }
  return data || [];
}

async function renderBillingTab() {
  const form = document.getElementById("form-transaksi");
  form.hidden = !isKasir();

  billingCache = await loadTransaksi();
  renderTxList();
  renderTxSummary();
}

function renderTxList() {
  const box = document.getElementById("tx-list");
  const visible = billingCache.filter((t) => isPengawas() || !t.dihapus);

  if (visible.length === 0) {
    box.innerHTML = `<div class="muted" style="text-align:center; padding:24px 0;">Belum ada transaksi di tanggal/cabang ini.</div>`;
    return;
  }

  const showCabangTag = AppState.selectedCabangId === "semua";

  box.innerHTML = visible.map((t) => {
    const cabangTag = showCabangTag ? " · " + escapeHtml((cabangById(t.cabang_id) || {}).nama || "") : "";
    const statusBadge = t.status === "belum_bayar"
      ? `<span class="badge-warn">Belum bayar</span>`
      : `<span class="badge-ok">${t.status === "lunas" ? "Lunas" : "Paket"}</span>`;

    let deleteArea = "";
    if (isKasir() && !t.dihapus) {
      deleteArea = `<button class="btn-ghost small" data-action="ajukan-hapus-tx" data-id="${t.id}">Ajukan hapus</button>`;
    }
    if (t.dihapus) {
      deleteArea = `<div class="badge-warn">Dihapus (tercatat di log audit)</div>`;
    }

    const buktiArea = isKasir() ? renderBuktiArea(t) : "";

    return `<div class="row-item">
      <div class="row-top">
        <span class="row-index">#${t.index_global}${cabangTag}</span>
        <span class="row-amount">${formatRupiah(t.harga)}</span>
      </div>
      <div class="row-mid">
        <span>${escapeHtml(t.nama_klien)} · ${escapeHtml(t.terapis)}</span>
        ${statusBadge}
      </div>
      <div class="row-meta">${t.metode.toUpperCase()}</div>
      <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">${deleteArea}</div>
      ${buktiArea}
    </div>`;
  }).join("");
}

function renderBuktiArea(t) {
  const open = !!buktiPanelOpen[t.id];
  if (!open) {
    const sudahKirim = t.struk_dicetak || t.invoice_email
      ? `<div class="badge-ok" style="margin-top:4px;">${t.struk_dicetak ? "Struk tercetak. " : ""}${t.invoice_email ? "Invoice ke " + escapeHtml(t.invoice_email) : ""}</div>`
      : "";
    return `<button class="btn-ghost small" data-action="toggle-bukti" data-id="${t.id}" style="margin-top:6px;">Kirim bukti</button>${sudahKirim}`;
  }
  return `<div style="margin-top:8px; background:var(--surface-alt); border-radius:8px; padding:10px;">
    <button class="btn-ghost small" data-action="cetak-struk" data-id="${t.id}">Cetak struk</button>
    <div style="display:flex; gap:8px; margin-top:8px;">
      <input type="email" id="email-input-${t.id}" placeholder="Email orang tua" style="flex:1;" />
      <button class="btn-ghost small" data-action="kirim-email" data-id="${t.id}">Kirim invoice</button>
    </div>
    <button class="btn-ghost small" data-action="toggle-bukti" data-id="${t.id}" style="margin-top:8px;">Tutup</button>
  </div>`;
}

function renderTxSummary() {
  const scoped = billingCache.filter((t) => !t.dihapus);
  const totalBy = (metode) => scoped.filter((t) => t.metode === metode).reduce((a, t) => a + Number(t.harga), 0);
  const cash = totalBy("cash");
  const transfer = totalBy("transfer");
  const qris = totalBy("qris");
  const semua = cash + transfer + qris;

  const cards = [
    ["Total cash", cash], ["Total transfer", transfer], ["Total QRIS", qris], ["Total hari ini", semua],
  ];
  document.getElementById("tx-summary").innerHTML = cards.map(([label, val]) =>
    `<div class="summary-card"><div class="label">${label}</div><div class="value">${formatRupiah(val)}</div></div>`
  ).join("");
}

async function submitTransaksi(e) {
  e.preventDefault();
  const nama = document.getElementById("f-nama").value.trim();
  const terapis = document.getElementById("f-terapis").value.trim();
  const harga = parseRibuanInput(document.getElementById("f-harga").value);
  const metode = document.getElementById("f-metode").value;
  const status = document.getElementById("f-status").value;

  if (!nama || !terapis || !(harga > 0)) {
    showFormError("form-tx-error", "Lengkapi nama, terapis, dan harga lebih dari 0.");
    return;
  }
  showFormError("form-tx-error", null);

  const cabangId = AppState.selectedCabangId === "semua" ? AppState.profile.cabang_id : AppState.selectedCabangId;

  const { data, error } = await supabaseClient.from("transaksi").insert({
    cabang_id: cabangId,
    tanggal: AppState.selectedDate,
    nama_klien: nama,
    terapis: terapis,
    harga: harga,
    metode: metode,
    status: status,
    diinput_oleh: AppState.profile.id,
  }).select().single();

  if (error) {
    showFormError("form-tx-error", "Gagal menyimpan: " + error.message);
    return;
  }

  document.getElementById("f-nama").value = "";
  document.getElementById("f-terapis").value = "";
  document.getElementById("f-harga").value = "";
  buktiPanelOpen[data.id] = true; // langsung buka panel bukti setelah tersimpan
  await renderBillingTab();
}

async function ajukanHapusTransaksi(txId) {
  const alasan = window.prompt("Alasan pengajuan hapus transaksi ini:");
  if (alasan === null) return; // dibatalkan
  const { error } = await supabaseClient.from("permintaan_hapus_transaksi").insert({
    transaksi_id: txId,
    diajukan_oleh: AppState.profile.id,
    alasan: alasan || "(tanpa alasan tertulis)",
  });
  if (error) { alert("Gagal mengajukan hapus: " + error.message); return; }
  await renderBillingTab();
}

async function cetakStrukTransaksi(txId) {
  const t = billingCache.find((x) => x.id === txId);
  if (!t) return;
  await supabaseClient.from("transaksi").update({ struk_dicetak: true }).eq("id", txId);
  cetakStruk(t); // fungsi dari receipt.js — membuka window print
  await renderBillingTab();
}

async function kirimEmailInvoice(txId) {
  const input = document.getElementById("email-input-" + txId);
  const email = input ? input.value.trim() : "";
  if (!email || email.indexOf("@") === -1) {
    alert("Isi email yang valid dulu.");
    return;
  }
  // CATATAN: pengiriman email sungguhan butuh Supabase Edge Function +
  // penyedia email (mis. Resend) — lihat README.md bagian "Langkah lanjutan".
  // Baris ini baru menyimpan alamat tujuan sebagai bukti niat kirim.
  const { error } = await supabaseClient.from("transaksi").update({ invoice_email: email }).eq("id", txId);
  if (error) { alert("Gagal menyimpan: " + error.message); return; }
  alert("Alamat email tersimpan. Pengiriman otomatis perlu Edge Function tambahan (lihat README.md).");
  await renderBillingTab();
}

// ---------- Event delegation untuk daftar transaksi ----------
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === "ajukan-hapus-tx") ajukanHapusTransaksi(id);
  if (action === "toggle-bukti") { buktiPanelOpen[id] = !buktiPanelOpen[id]; renderTxList(); }
  if (action === "cetak-struk") cetakStrukTransaksi(id);
  if (action === "kirim-email") kirimEmailInvoice(id);
});
