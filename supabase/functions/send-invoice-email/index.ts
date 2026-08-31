// ============================================================
// EDGE FUNCTION: send-invoice-email
// Mengirim invoice transaksi ke email orang tua, memakai Resend
// (resend.com) sebagai penyedia pengiriman email.
//
// CARA MENGAKTIFKAN (lihat juga README.md bagian "Langkah lanjutan"):
//   1. Daftar akun gratis di https://resend.com, ambil API key-nya.
//   2. Install Supabase CLI di komputer Anda (butuh Node.js):
//        npm install -g supabase
//   3. Login & hubungkan ke project:
//        supabase login
//        supabase link --project-ref XXXX   (XXXX dari Project Settings)
//   4. Simpan API key Resend sebagai secret (jangan taruh di kode):
//        supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
//   5. Deploy function ini:
//        supabase functions deploy send-invoice-email
//
// Setelah ini aktif, tombol "Kirim invoice" di aplikasi akan benar-benar
// mengirim email, bukan cuma menyimpan alamat tujuan.
// ============================================================

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS: WAJIB ada supaya browser (bukan server-ke-server) diizinkan
// memanggil Edge Function ini. Tanpa ini, permintaan langsung ditolak
// oleh browser SEBELUM sempat sampai ke kode di bawah — makanya errornya
// terlihat seperti "gagal kirim permintaan", padahal function-nya sendiri
// tidak sempat jalan sama sekali.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Browser selalu mengirim permintaan "OPTIONS" duluan (preflight) sebelum
  // POST sungguhan, khusus untuk mengecek izin CORS ini. Harus dijawab
  // duluan sebelum apa pun yang lain.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { transaksi_id } = await req.json();
    if (!transaksi_id) {
      return new Response(JSON.stringify({ error: "transaksi_id wajib diisi" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: t, error } = await supabaseAdmin
      .from("transaksi")
      .select("*, cabang(nama, alamat)")
      .eq("id", transaksi_id)
      .single();

    if (error || !t) {
      return new Response(JSON.stringify({ error: "Transaksi tidak ditemukan" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!t.invoice_email) {
      return new Response(JSON.stringify({ error: "Transaksi ini belum punya alamat email tujuan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY belum diatur di secrets" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ambil kop tambahan & pesan penutup dari Pengaturan cabang yang sama
    // dipakai struk cetak — supaya isi email konsisten dengan struk fisik.
    const { data: pengaturan } = await supabaseAdmin
      .from("pengaturan_cabang")
      .select("kop_tambahan, pesan_penutup_struk")
      .eq("cabang_id", t.cabang_id)
      .maybeSingle();

    const kopHtml = pengaturan?.kop_tambahan
      ? `<p style="color:#666; white-space:pre-line; margin:0 0 8px;">${pengaturan.kop_tambahan}</p>`
      : "";
    const footerText = pengaturan?.pesan_penutup_struk || "Terima kasih atas kepercayaan Anda.";

    const html = `
      <div style="font-family:sans-serif; max-width:400px;">
        <h2 style="margin-bottom:4px;">${t.cabang?.nama || "Klinik"}</h2>
        ${t.cabang?.alamat ? `<p style="color:#666; margin:0 0 8px;">${t.cabang.alamat}</p>` : ""}
        ${kopHtml}
        <p>No. Transaksi: #${t.index_global}</p>
        <p>Tanggal: ${t.tanggal}</p>
        <hr />
        <p>Klien: ${t.nama_klien}<br/>Terapis: ${t.terapis}<br/>Metode: ${t.metode.toUpperCase()}</p>
        <hr />
        <p><strong>Total: Rp ${Number(t.harga).toLocaleString("id-ID")}</strong></p>
        <p style="color:#666;">${footerText}</p>
      </div>`;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "invoice@resend.dev", // ganti dengan domain terverifikasi Anda sendiri di Resend kalau sudah siap
        to: t.invoice_email,
        subject: `Invoice #${t.index_global} — ${t.cabang?.nama || "Klinik"}`,
        html,
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      return new Response(JSON.stringify({ error: "Gagal kirim email: " + errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
