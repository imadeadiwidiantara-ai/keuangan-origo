// ============================================================
// AUTENTIKASI
// Login memakai Supabase Auth (email + password) sungguhan.
// Login ini MENGGANTIKAN "PIN" yang dipakai di prototipe demo —
// karena ini login akun sungguhan yang dijaga Supabase, bukan
// PIN yang hanya dicek di browser (yang gampang dibongkar).
//
// Tiap PERAN punya akun sendiri (bukan tiap orang):
//   - 1 akun kasir per cabang (dipakai bersama di komputer cabang)
//   - 1 akun keuangan (dipakai untuk melihat semua cabang)
//   - 1 akun pengawas (superadmin)
// Cara membuat akun-akun ini ada di README.md.
// ============================================================

async function handleLogin(email, password) {
  showFormError2("login-error", null);

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showFormError2("login-error", "Email atau kata sandi salah.");
    return false;
  }

  AppState.session = data.session;

  const { data: profile, error: profileErr } = await supabaseClient
    .from("profiles")
    .select("id, nama, role, cabang_id")
    .eq("id", data.session.user.id)
    .single();

  if (profileErr || !profile) {
    showFormError2("login-error", "Akun ini belum terdaftar sebagai profil peran. Hubungi pengawas.");
    await supabaseClient.auth.signOut();
    return false;
  }

  AppState.profile = profile;
  await loadCabangList();
  await loadPengaturanCabang();

  AppState.selectedCabangId = profile.role === "pengawas" ? "semua" : profile.cabang_id;

  showScreen("app");
  renderHeaderInfo();
  renderCabangBar();
  renderDateBar();
  setActiveTab("billing");
  return true;
}

async function loadCabangList() {
  const { data, error } = await supabaseClient.from("cabang").select("id, nama, alamat").order("nama");
  if (!error) AppState.cabangList = data || [];
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  AppState.session = null;
  AppState.profile = null;
  showScreen("login");
}

async function restoreSessionIfAny() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, nama, role, cabang_id")
      .eq("id", data.session.user.id)
      .single();
    if (profile) {
      AppState.session = data.session;
      AppState.profile = profile;
      await loadCabangList();
      await loadPengaturanCabang();
      AppState.selectedCabangId = profile.role === "pengawas" ? "semua" : profile.cabang_id;
      showScreen("app");
      renderHeaderInfo();
      renderCabangBar();
      renderDateBar();
      setActiveTab("billing");
      return;
    }
  }
  showScreen("login");
}

// Nama fungsi beda dari showFormError di ui.js supaya tidak bentrok
// dengan elemen id yang formatnya sedikit berbeda (khusus login).
function showFormError2(elId, message) {
  const el = document.getElementById(elId);
  if (!message) { el.hidden = true; el.textContent = ""; return; }
  el.hidden = false;
  el.textContent = message;
}
