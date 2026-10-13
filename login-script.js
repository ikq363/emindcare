/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Login Script — Premium Edition v2.2
   Case-insensitive role handling + robust matching
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const USERS_COLLECTION = 'users';
const SESSION_KEY = 'emindcare_session';
const SESSION_MAX_HOURS = 24;

// Redirects — lowercase keys (akan dinormalize)
const REDIRECTS = {
  kaunselor: 'dashboard-kaunselor.html',
  guru: 'dashboard-guru.html',
  murid: 'dashboard-murid.html'
};

// Alias untuk handle variations
const ROLE_ALIASES = {
  'kaunselor': 'kaunselor',
  'kaunselor ubk': 'kaunselor',
  'counselor': 'kaunselor',
  'counsellor': 'kaunselor',
  'guru': 'guru',
  'guru bimbingan': 'guru',
  'teacher': 'guru',
  'murid': 'murid',
  'pelajar': 'murid',
  'student': 'murid'
};

const NAME_REGEX = /^[A-Z][A-Z\s'\.]{2,}$/;
const IC_REGEX = /^\d{12}$/;

/* ═══════════════════════════════════════════════════════════════
   DOM
   ═══════════════════════════════════════════════════════════════ */
const form = document.getElementById('loginForm');
const nameInput = document.getElementById('fullName');
const icInput = document.getElementById('icNumber');
const icCounter = document.getElementById('icCounter');
const submitBtn = document.getElementById('submitBtn');
const loginCard = document.getElementById('loginCard');
const authOverlay = document.getElementById('authOverlay');
const authOverlayCard = document.getElementById('authOverlayCard');

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE ROLE (case-insensitive + alias)
   ═══════════════════════════════════════════════════════════════ */
function normalizeRole(rawRole) {
  if (!rawRole) return null;
  const cleaned = String(rawRole).toLowerCase().trim().replace(/\s+/g, ' ');
  
  // Cek terus
  if (REDIRECTS[cleaned]) return cleaned;
  
  // Cek alias
  if (ROLE_ALIASES[cleaned]) return ROLE_ALIASES[cleaned];
  
  // Cek substring (untuk "kaunselor ubk semsira" dll)
  for (const key in ROLE_ALIASES) {
    if (cleaned.includes(key)) return ROLE_ALIASES[key];
  }
  
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE NAME (untuk matching lebih robust)
   ═══════════════════════════════════════════════════════════════ */
function normalizeName(str) {
  if (!str) return '';
  return String(str)
    .toUpperCase()
    .replace(/\s+/g, ' ')     // collapse multiple spaces
    .trim();
}

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE IC (strip non-digits)
   ═══════════════════════════════════════════════════════════════ */
function normalizeIC(str) {
  if (!str) return '';
  return String(str).replace(/\D/g, '').trim();
}

/* ═══════════════════════════════════════════════════════════════
   TOAST NOTIFICATION
   ═══════════════════════════════════════════════════════════════ */
function showToast(title, message, type = 'success', duration = 4500) {
  const container = document.getElementById('toastContainer');
  const icons = {
    success: 'fa-check',
    error: 'fa-times',
    info: 'fa-info',
    warning: 'fa-exclamation'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon"><i class="fas ${icons[type] || 'fa-info'}"></i></div>
    <div class="toast-content">
      <strong>${title}</strong>
      <span>${message}</span>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

/* ═══════════════════════════════════════════════════════════════
   INPUT FORMATTING
   ═══════════════════════════════════════════════════════════════ */
function sanitizeName(str) {
  return str
    .replace(/[^A-Za-z\s'\.]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .slice(0, 80)
    .replace(/^\s+/, '');
}

nameInput.addEventListener('input', (e) => {
  const cursorPos = e.target.selectionStart;
  const before = e.target.value.length;
  e.target.value = sanitizeName(e.target.value);
  const after = e.target.value.length;
  const newPos = cursorPos - (before - after);
  if (newPos >= 0) e.target.setSelectionRange(newPos, newPos);
  clearFieldError(nameInput, 'nameError');
});

nameInput.addEventListener('paste', (e) => {
  e.preventDefault();
  const pasted = (e.clipboardData || window.clipboardData).getData('text');
  nameInput.value = sanitizeName(pasted);
  clearFieldError(nameInput, 'nameError');
});

function sanitizeIC(str) {
  return str.replace(/\D/g, '').slice(0, 12);
}

icInput.addEventListener('input', (e) => {
  const before = e.target.value.length;
  e.target.value = sanitizeIC(e.target.value);
  const after = e.target.value.length;
  updateICCounter(after);
  clearFieldError(icInput, 'icError');
});

icInput.addEventListener('paste', (e) => {
  e.preventDefault();
  const pasted = (e.clipboardData || window.clipboardData).getData('text');
  icInput.value = sanitizeIC(pasted);
  updateICCounter(icInput.value.length);
  clearFieldError(icInput, 'icError');
});

icInput.addEventListener('keypress', (e) => {
  const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Home', 'End'];
  if (!/[0-9]/.test(e.key) && !allowed.includes(e.key) && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
  }
});

function updateICCounter(length) {
  icCounter.textContent = `${length}/12`;
  icCounter.classList.remove('complete', 'incomplete');
  if (length === 12) {
    icCounter.classList.add('complete');
  } else if (length > 0) {
    icCounter.classList.add('incomplete');
  }
}

/* ═══════════════════════════════════════════════════════════════
   FIELD ERRORS
   ═══════════════════════════════════════════════════════════════ */
function clearFieldError(input, errorId) {
  input.classList.remove('error');
  document.getElementById(errorId)?.classList.remove('show');
}

function showFieldError(input, errorId, message) {
  input.classList.add('error');
  const errorEl = document.getElementById(errorId);
  if (errorEl) {
    const textEl = errorEl.querySelector('span');
    if (textEl && message) textEl.textContent = message;
    errorEl.classList.add('show');
  }
}

/* ═══════════════════════════════════════════════════════════════
   VALIDATE FORM
   ═══════════════════════════════════════════════════════════════ */
function validateForm() {
  let isValid = true;

  const name = nameInput.value.trim();
  const ic = icInput.value.trim();

  if (!name) {
    showFieldError(nameInput, 'nameError', 'Sila masukkan nama penuh anda.');
    isValid = false;
  } else if (name.length < 3) {
    showFieldError(nameInput, 'nameError', 'Nama terlalu pendek.');
    isValid = false;
  } else if (!NAME_REGEX.test(name)) {
    showFieldError(nameInput, 'nameError', 'Nama hanya boleh mengandungi huruf dan ruang.');
    isValid = false;
  }

  if (!ic) {
    showFieldError(icInput, 'icError', 'Sila masukkan nombor Kad Pengenalan anda.');
    isValid = false;
  } else if (ic.length !== 12) {
    showFieldError(icInput, 'icError', `Nombor IC perlu 12 digit (anda masukkan ${ic.length} digit).`);
    isValid = false;
  } else if (!IC_REGEX.test(ic)) {
    showFieldError(icInput, 'icError', 'Nombor IC tidak sah.');
    isValid = false;
  }

  return isValid;
}

/* ═══════════════════════════════════════════════════════════════
   CARD SHAKE
   ═══════════════════════════════════════════════════════════════ */
function shakeCard() {
  loginCard.classList.remove('shake');
  void loginCard.offsetWidth;
  loginCard.classList.add('shake');
  setTimeout(() => loginCard.classList.remove('shake'), 700);
}

/* ═══════════════════════════════════════════════════════════════
   BUTTON LOADING STATE
   ═══════════════════════════════════════════════════════════════ */
function setButtonLoading(isLoading) {
  submitBtn.classList.toggle('loading', isLoading);
  submitBtn.disabled = isLoading;
}

/* ═══════════════════════════════════════════════════════════════
   AUTH OVERLAY
   ═══════════════════════════════════════════════════════════════ */
function showAuthOverlay(title = 'Mengesahkan Akaun', sub = 'Sila tunggu sebentar...') {
  authOverlayCard.innerHTML = `
    <div class="auth-spinner-ring"></div>
    <div class="auth-overlay-title">${title}</div>
    <div class="auth-overlay-sub">${sub}</div>
  `;
  authOverlay.classList.add('active');
}

function showAuthSuccess(title = 'Berjaya!', sub = 'Mengalihkan anda...') {
  authOverlayCard.innerHTML = `
    <div class="auth-success"><i class="fas fa-check"></i></div>
    <div class="auth-overlay-title">${title}</div>
    <div class="auth-overlay-sub">${sub}</div>
  `;
}

function hideAuthOverlay() {
  authOverlay.classList.remove('active');
}

/* ═══════════════════════════════════════════════════════════════
   RIPPLE EFFECT
   ═══════════════════════════════════════════════════════════════ */
submitBtn.addEventListener('click', (e) => {
  if (submitBtn.disabled) return;
  const rect = submitBtn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  submitBtn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function waitForEMindCare() {
  return new Promise((resolve, reject) => {
    if (window.EMindCare) return resolve();
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (window.EMindCare) {
        clearInterval(timer);
        resolve();
      } else if (tries > 100) {
        clearInterval(timer);
        reject(new Error('Firebase SDK tidak dimuatkan'));
      }
    }, 50);
  });
}

/* ═══════════════════════════════════════════════════════════════
   FALLBACK QUERY — cari user guna multiple strategy
   ═══════════════════════════════════════════════════════════════ */
async function findUser(db, fs, fullName, icNumber) {
  const { collection, query, where, getDocs } = fs;

  // Strategy 1: Exact match (as-is)
  console.log('🔍 Strategy 1: Exact match');
  let q = query(
    collection(db, USERS_COLLECTION),
    where('fullName', '==', fullName),
    where('icNumber', '==', icNumber)
  );
  let snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0];

  // Strategy 2: Cari by IC sahaja, kemudian filter nama client-side
  console.log('🔍 Strategy 2: By IC only');
  q = query(
    collection(db, USERS_COLLECTION),
    where('icNumber', '==', icNumber)
  );
  snap = await getDocs(q);
  if (!snap.empty) {
    const normalizedInput = normalizeName(fullName);
    const matched = snap.docs.find(d => {
      const docName = normalizeName(d.data().fullName || '');
      return docName === normalizedInput;
    });
    if (matched) return matched;

    // Kalau ada lebih dari 1 dan tak padan nama — kalau cuma 1, ambil terus
    if (snap.size === 1) {
      console.log('⚠️ IC match dengan 1 user, nama tak padan 100% — masih terima');
      return snap.docs[0];
    }
  }

  // Strategy 3: Cari by name sahaja
  console.log('🔍 Strategy 3: By name only');
  q = query(
    collection(db, USERS_COLLECTION),
    where('fullName', '==', fullName)
  );
  snap = await getDocs(q);
  if (!snap.empty) {
    const matched = snap.docs.find(d => normalizeIC(d.data().icNumber) === icNumber);
    if (matched) return matched;
  }

  // Strategy 4: Get ALL users, filter client-side (fallback paling selamat)
  console.log('🔍 Strategy 4: Full scan + client-side filter');
  const allSnap = await getDocs(collection(db, USERS_COLLECTION));
  const normalizedInput = normalizeName(fullName);
  const matched = allSnap.docs.find(d => {
    const data = d.data();
    return normalizeName(data.fullName) === normalizedInput
        && normalizeIC(data.icNumber) === icNumber;
  });
  if (matched) return matched;

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN LOGIN HANDLER
   ═══════════════════════════════════════════════════════════════ */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) {
    shakeCard();
    showToast(
      'Maklumat Tidak Lengkap',
      'Sila semak semula medan yang bertanda merah.',
      'warning'
    );
    return;
  }

  const fullName = nameInput.value.trim().toUpperCase();
  const icNumber = icInput.value.trim();

  setButtonLoading(true);

  try {
    await waitForEMindCare();
    const { db, fs } = window.EMindCare;
    const { doc, updateDoc, serverTimestamp } = fs;

    console.log('🔍 Mencari pengguna:', { fullName, icNumber });

    // Guna fallback query untuk matching lebih robust
    const userDoc = await findUser(db, fs, fullName, icNumber);

    // Tiada padanan
    if (!userDoc) {
      setButtonLoading(false);
      shakeCard();

      showToast(
        'Log Masuk Gagal',
        'Maklumat tidak wujud atau tidak padan. Sila hubungi Kaunselor UBK.',
        'error',
        6500
      );

      nameInput.classList.add('error');
      icInput.classList.add('error');
      setTimeout(() => {
        nameInput.classList.remove('error');
        icInput.classList.remove('error');
      }, 2500);

      return;
    }

    const userData = userDoc.data();
    console.log('✅ Pengguna dijumpai:', userData);
    console.log('📋 Raw role dari Firestore:', JSON.stringify(userData.role));

    // ⚡ NORMALIZE ROLE — case-insensitive + alias
    const role = normalizeRole(userData.role);
    console.log('📋 Normalized role:', role);

    if (!role) {
      setButtonLoading(false);
      showToast(
        'Peranan Tidak Sah',
        `Peranan "${userData.role || '(kosong)'}" tidak dikenali. Sila hubungi Kaunselor UBK.`,
        'error',
        6500
      );
      return;
    }

    // Simpan sesi
    const session = {
      uid: userDoc.id,
      fullName: userData.fullName,
      icNumber: userData.icNumber,
      role: role,
      class: userData.class || null,
      formLevel: userData.formLevel || null,
      title: userData.title || null,
      email: userData.email || null,
      avatarUrl: userData.profileImage || userData.avatarUrl || null,
      loginAt: new Date().toISOString()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    console.log('💾 Sesi disimpan:', session);

    // Update lastLogin (non-blocking)
    updateDoc(doc(db, USERS_COLLECTION, userDoc.id), {
      lastLogin: serverTimestamp()
    }).catch(err => console.warn('⚠️ lastLogin update gagal:', err.message));

    // Show success overlay
    showAuthSuccess(
      `Selamat Datang, ${userData.fullName.split(' ')[0]}!`,
      'Mengalihkan anda ke dashboard...'
    );

    // Redirect
    setTimeout(() => {
      window.location.href = REDIRECTS[role];
    }, 1300);

  } catch (err) {
    console.error('❌ Login error:', err);
    setButtonLoading(false);
    shakeCard();

    let message = 'Ralat sistem. Sila cuba sebentar lagi.';
    if (err.code === 'permission-denied') {
      message = 'Akses ditolak. Sila hubungi Kaunselor UBK.';
    } else if (err.code === 'unavailable') {
      message = 'Tiada sambungan internet. Sila cuba lagi.';
    } else if (err.message?.includes('index')) {
      message = 'Ralat pangkalan data. Sila hubungi pentadbir.';
    } else if (err.message?.includes('SDK')) {
      message = 'Gagal memuatkan sistem. Sila refresh halaman.';
    }

    showToast('Ralat Sistem', message, 'error', 6500);
  }
});

/* ═══════════════════════════════════════════════════════════════
   KEYBOARD NAVIGATION
   ═══════════════════════════════════════════════════════════════ */
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    icInput.focus();
  }
});

icInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (icInput.value.length === 12) {
      form.requestSubmit();
    } else {
      showToast('Nombor IC Tidak Lengkap', 'Sila masukkan 12 digit nombor IC.', 'warning', 3000);
    }
  }
});

/* ═══════════════════════════════════════════════════════════════
   AUTO-FOCUS & SESSION CHECK ON LOAD
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', () => {
  setTimeout(() => {
    if (window.innerWidth > 768) nameInput.focus();
  }, 800);

  checkExistingSession();
  applyBranding();
});

/* ═══════════════════════════════════════════════════════════════
   CHECK EXISTING SESSION
   ═══════════════════════════════════════════════════════════════ */
function checkExistingSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return;

  try {
    const session = JSON.parse(raw);
    const loginTime = new Date(session.loginAt).getTime();
    const hours = (Date.now() - loginTime) / 1000 / 60 / 60;

    if (hours < SESSION_MAX_HOURS && session.role && REDIRECTS[session.role]) {
      console.log('🔐 Sesi aktif:', session.fullName);
    } else {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch (e) {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }
}

/* ═══════════════════════════════════════════════════════════════
   APPLY BRANDING FROM FIRESTORE
   ═══════════════════════════════════════════════════════════════ */
async function applyBranding() {
  try {
    await waitForEMindCare();
    const cfg = await window.EMindCare.getSiteConfig();
    if (!cfg?.branding) return;

    const b = cfg.branding;

    if (b.name) {
      const match = b.name.match(/^(e-)?(.+)$/i);
      if (match) {
        const prefix = match[1] || '';
        const rest = match[2];
        document.getElementById('brandName').innerHTML =
          `${prefix}<span class="accent">${rest}</span>`;
      } else {
        document.getElementById('brandName').innerHTML =
          `<span class="accent">${b.name}</span>`;
      }
      document.title = `Log Masuk · ${b.name} UBK SEMSIRA`;
    }

    if (b.tagline) {
      document.getElementById('brandTagline').textContent = b.tagline;
    }

    const logoEl = document.getElementById('brandLogo');
    if (b.logoUrl) {
      logoEl.innerHTML = `<img src="${b.logoUrl}" alt="Logo">`;
    } else if (b.logoIcon) {
      logoEl.innerHTML = `<i class="${b.logoIcon}"></i>`;
    }

    if (b.primaryColor) {
      document.documentElement.style.setProperty('--teal', b.primaryColor);
    }
    if (b.accentColor) {
      document.documentElement.style.setProperty('--indigo', b.accentColor);
    }
  } catch (e) {
    console.warn('⚠️ Apply branding gagal:', e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   LOG
   ═══════════════════════════════════════════════════════════════ */
console.log(
  "%c 🔐 Login v2.2 ",
  "background:linear-gradient(135deg,#0F766E,#4F46E5,#06B6D4);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("✨ Case-insensitive role + robust matching · Ready");