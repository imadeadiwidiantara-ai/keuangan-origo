// ============================================================
// MODUL BILLING
// Tampilan & aksi untuk tab "Billing": input transaksi, daftar
// transaksi hari berjalan, ringkasan, kirim bukti (struk/email),
// dan pengajuan hapus.
// ============================================================

let billingCache = []; // transaksi hasil query terakhir, dipakai ulang saat re-render kecil (mis. buka panel bukti)
const buktiPanelOpen = {}; // { [transaksi.id]: boolean }
let autocompleteCabangId = null; // cabang terakhir yang datalist-nya sudah dimuat, hindari query berulang

// ---------- Autocomplete nama klien & terapis (berdasarkan riwayat) ----------
async function loadAutocompleteLists() {
  if (AppState.selectedCabangId === autocompleteCabangId) return; // sudah dimuat untuk cabang ini
  let query = supabaseClient
    .from("transaksi")
    .select("nama_klien, terapis")
    .eq("dihapus", false)
    .order("index_global", { ascending: false })
    .limit(300);
  if (AppState.selectedCabangId !== "semua") query = query.eq("cabang_id", AppState.selectedCabangId);

  const { data, error } = await query;
  if (error) return;

  const namaSet = new Set();
  const terapisSet = new Set();
  (data || []).forEach((r) => {
    if (r.nama_klien) namaSet.add(r.nama_klien);
    if (r.terapis) terapisSet.add(r.terapis);
  });

  document.getElementById("datalist-klien").innerHTML =
    [...namaSet].map((n) => `<option value="${escapeHtml(n)}">`).join("");
  document.getElementById("datalist-terapis").innerHTML =
    [...terapisSet].map((n) => `<option value="${escapeHtml(n)}">`).join("");

  autocompleteCabangId = AppState.selectedCabangId;
}

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
  if (isKasir()) loadAutocompleteLists(); // tidak perlu ditunggu (await), boleh jalan di belakang

  billingCache = await loadTransaksi();
  renderTxList();
  renderTxSummary();
  renderTutupKasCard();
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
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn-ghost small" data-action="cetak-struk" data-id="${t.id}">Cetak struk</button>
      <button class="btn-ghost small" data-action="cetak-struk-bt" data-id="${t.id}" title="Eksperimental — lihat catatan di js/receipt.js">Cetak Bluetooth (eksperimental)</button>
    </div>
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

  if (metode === "cash") {
    await renderBillingTab(); // refresh dulu supaya transaksi baru ini "dikenal" sebelum dicetak
    await cetakStrukTransaksiBluetooth(data.id);
  } else {
    await renderBillingTab();
  }
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
  cetakStruk(t); // fungsi dari receipt.js — membuka dialog print browser
  await renderBillingTab();
}

async function cetakStrukTransaksiBluetooth(txId) {
  const t = billingCache.find((x) => x.id === txId);
  if (!t) return;
  const berhasil = await cetakStrukBluetooth(t); // fungsi dari receipt.js
  if (berhasil) {
    await supabaseClient.from("transaksi").update({ struk_dicetak: true }).eq("id", txId);
    await renderBillingTab();
  }
}

async function kirimEmailInvoice(txId) {
  const input = document.getElementById("email-input-" + txId);
  const email = input ? input.value.trim() : "";
  if (!email || email.indexOf("@") === -1) {
    alert("Isi email yang valid dulu.");
    return;
  }

  const { error } = await supabaseClient.from("transaksi").update({ invoice_email: email }).eq("id", txId);
  if (error) { alert("Gagal menyimpan: " + error.message); return; }

  // Coba kirim sungguhan lewat Edge Function "send-invoice-email".
  try {
    const { error: fnError } = await supabaseClient.functions.invoke("send-invoice-email", {
      body: { transaksi_id: txId },
    });
    if (fnError) {
      console.error("Edge Function error:", fnError);
      let detail = fnError.message || "penyebab tidak diketahui";
      // Function ini biasanya mengirim pesan error yang lebih jelas di body respons —
      // coba baca itu supaya pesan ke pengguna lebih berguna daripada teks generik.
      try {
        if (fnError.context && typeof fnError.context.json === "function") {
          const body = await fnError.context.json();
          if (body && body.error) detail = body.error;
        }
      } catch (_) { /* biarkan pakai fnError.message di atas */ }
      alert("Gagal mengirim invoice: " + detail);
    } else {
      alert("Invoice terkirim ke " + email + ".");
    }
  } catch (e) {
    console.error(e);
    alert("Gagal mengirim invoice: " + e.message);
  }

  await renderBillingTab();
}

// ---------- Tutup kas harian (rincian pecahan uang + nama penghitung) ----------
const PECAHAN = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
const pecahanCount = {};
PECAHAN.forEach((p) => { pecahanCount[p] = 0; });

async function renderTutupKasCard() {
  const card = document.getElementById("tutup-kas-card");
  card.hidden = !(isKasir() || isPengawas());
  if (!isKasir() && !isPengawas()) return;

  document.getElementById("tutup-kas-form-area").hidden = !isKasir();

  if (isKasir()) {
    const inputsBox = document.getElementById("pecahan-inputs");
    inputsBox.innerHTML = PECAHAN.map((p) => `
      <div>
        <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:4px;">${formatRupiah(p)} × lembar</label>
        <input type="number" min="0" data-pecahan="${p}" value="${pecahanCount[p]}" />
      </div>`).join("");

    inputsBox.querySelectorAll("input[data-pecahan]").forEach((inp) => {
      inp.addEventListener("input", function () {
        pecahanCount[Number(this.dataset.pecahan)] = parseInt(this.value, 10) || 0;
        updateTutupKasHasil();
      });
    });
    updateTutupKasHasil();
  }

  await renderRiwayatTutupKas();
}

function totalCashSistemHariIni() {
  return billingCache.filter((t) => !t.dihapus && t.metode === "cash").reduce((a, t) => a + Number(t.harga), 0);
}

function updateTutupKasHasil() {
  const totalHitung = PECAHAN.reduce((a, p) => a + p * pecahanCount[p], 0);
  document.getElementById("pecahan-total").textContent = "Total dihitung: " + formatRupiah(totalHitung);

  const totalSistem = totalCashSistemHariIni();
  const selisih = totalHitung - totalSistem;
  const hasilBox = document.getElementById("tutup-kas-hasil");
  if (totalHitung === 0) {
    hasilBox.innerHTML = `<span class="muted">Isi jumlah lembar tiap pecahan di atas.</span>`;
  } else if (selisih === 0) {
    hasilBox.innerHTML = `<span class="badge-ok">Sesuai — cash cocok dengan sistem (${formatRupiah(totalSistem)}).</span>`;
  } else if (selisih < 0) {
    hasilBox.innerHTML = `<span class="badge-warn">Kekurangan ${formatRupiah(Math.abs(selisih))} dari total sistem (${formatRupiah(totalSistem)}).</span>`;
  } else {
    hasilBox.innerHTML = `<span class="badge-warn">Kelebihan ${formatRupiah(selisih)} dari total sistem (${formatRupiah(totalSistem)}).</span>`;
  }
}

async function simpanTutupKas() {
  const totalHitung = PECAHAN.reduce((a, p) => a + p * pecahanCount[p], 0);
  const dihitungOleh = document.getElementById("tutup-dihitung-oleh").value.trim();
  if (!(totalHitung > 0) || !dihitungOleh) {
    alert("Isi rincian pecahan uang dan nama yang menghitung dulu.");
    return;
  }
  const totalSistem = totalCashSistemHariIni();
  const cabangId = AppState.selectedCabangId === "semua" ? AppState.profile.cabang_id : AppState.selectedCabangId;

  const { error } = await supabaseClient.from("penutupan_kas_harian").insert({
    cabang_id: cabangId,
    tanggal: AppState.selectedDate,
    total_dihitung: totalHitung,
    total_sistem: totalSistem,
    selisih: totalHitung - totalSistem,
    dihitung_oleh: dihitungOleh,
    dicatat_oleh: AppState.profile.id,
  });
  if (error) { alert("Gagal menyimpan: " + error.message); return; }

  PECAHAN.forEach((p) => { pecahanCount[p] = 0; });
  document.getElementById("tutup-dihitung-oleh").value = "";
  await renderTutupKasCard();
}

async function renderRiwayatTutupKas() {
  const box = document.getElementById("tutup-kas-riwayat");

  if (AppState.selectedCabangId === "semua") {
    box.innerHTML = `<p class="muted">Pilih cabang tertentu di atas untuk melihat riwayat penutupan kas.</p>`;
    return;
  }
  const cabangId = AppState.selectedCabangId;

  const { data } = await supabaseClient
    .from("penutupan_kas_harian")
    .select("*")
    .eq("cabang_id", cabangId)
    .eq("tanggal", AppState.selectedDate)
    .order("dibuat_pada", { ascending: false });

  if (!data || data.length === 0) { box.innerHTML = ""; return; }

  box.innerHTML = `<p style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">Riwayat penutupan kas tanggal ini:</p>` +
    data.map((r) => {
      const statusClass = Number(r.selisih) === 0 ? "badge-ok" : "badge-warn";
      const statusText = Number(r.selisih) === 0 ? "sesuai" : (r.selisih < 0 ? "kurang " + formatRupiah(Math.abs(r.selisih)) : "lebih " + formatRupiah(r.selisih));
      const hapusBtn = isPengawas()
        ? `<button class="btn-ghost small" data-action="hapus-tutup-kas" data-id="${r.id}" style="margin-left:8px;">Hapus</button>`
        : "";
      return `<div class="row-meta">${formatRupiah(r.total_dihitung)} oleh ${escapeHtml(r.dihitung_oleh)} — <span class="${statusClass}">${statusText}</span>${hapusBtn}</div>`;
    }).join("");
}

async function hapusPenutupanKas(id) {
  if (!confirm("Hapus catatan penutupan kas ini? Tindakan ini tidak bisa dibatalkan.")) return;
  const { error } = await supabaseClient.from("penutupan_kas_harian").delete().eq("id", id);
  if (error) { alert("Gagal menghapus: " + error.message); return; }
  await catatLogAudit("hapus_penutupan_kas", "penutupan_kas_harian", id);
  await renderTutupKasCard();
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest('[data-action="hapus-tutup-kas"]');
  if (btn) hapusPenutupanKas(btn.dataset.id);
});

document.getElementById("btn-simpan-tutup-kas").addEventListener("click", simpanTutupKas);

// ---------- Event delegation untuk daftar transaksi ----------
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === "ajukan-hapus-tx") ajukanHapusTransaksi(id);
  if (action === "toggle-bukti") { buktiPanelOpen[id] = !buktiPanelOpen[id]; renderTxList(); }
  if (action === "cetak-struk") cetakStrukTransaksi(id);
  if (action === "cetak-struk-bt") cetakStrukTransaksiBluetooth(id);
  if (action === "kirim-email") kirimEmailInvoice(id);
});
