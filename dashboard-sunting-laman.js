/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Dashboard Sunting Laman Script
   Logik: Fetch & Update Firestore · Cloudinary Upload
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const SETTINGS_COLLECTION = 'site_settings';
const SETTINGS_DOC = 'landing_page';

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let currentUser = null;
let originalData = {};
let currentData = {};
let hasUnsavedChanges = false;
let pendingConfirmAction = null;

// Image upload state (perutusan dibuang)
const images = {
  logo: null,
  favicon: null
};

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  await waitForEMindCare();
  if (!authGuard()) return;
  initUI();
  applyBranding();
  await loadSettings();
});

function waitForEMindCare() {
  return new Promise((resolve, reject) => {
    if (window.EMindCare) return resolve();
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (window.EMindCare) { clearInterval(timer); resolve(); }
      else if (tries > 100) { clearInterval(timer); reject(new Error('SDK timeout')); }
    }, 50);
  });
}

/* ═══════════════════════════════════════════════════════════════
   AUTH GUARD
   ═══════════════════════════════════════════════════════════════ */
function authGuard() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) { window.location.href = 'login.html'; return false; }
  try {
    const session = JSON.parse(raw);
    if (session.role !== 'kaunselor') {
      const redirects = { guru: 'dashboard-guru.html', murid: 'dashboard-murid.html' };
      window.location.href = redirects[session.role] || 'login.html';
      return false;
    }
    currentUser = session;
    loadProfile();
    return true;
  } catch (e) {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
    return false;
  }
}

function loadProfile() {
  document.getElementById('sbProfileName').textContent = currentUser.fullName || 'Kaunselor';
  const avatar = document.getElementById('sbAvatar');
  if (currentUser.avatarUrl) {
    avatar.innerHTML = `<img src="${currentUser.avatarUrl}" alt="">`;
  } else {
    avatar.textContent = (currentUser.fullName || 'K').charAt(0).toUpperCase();
  }
}

/* ═══════════════════════════════════════════════════════════════
   APPLY BRANDING
   ═══════════════════════════════════════════════════════════════ */
async function applyBranding() {
  try {
    const cfg = await window.EMindCare.getSiteConfig();
    if (!cfg?.branding) return;
    const b = cfg.branding;
    if (b.name) document.getElementById('sbBrandName').textContent = b.name;
    if (b.logoUrl) {
      document.getElementById('sbLogo').innerHTML = `<img src="${b.logoUrl}" alt="">`;
    } else if (b.logoIcon) {
      document.getElementById('sbLogo').innerHTML = `<i class="${b.logoIcon}"></i>`;
    }
    if (b.primaryColor) document.documentElement.style.setProperty('--teal', b.primaryColor);
    if (b.accentColor) document.documentElement.style.setProperty('--indigo', b.accentColor);
  } catch (e) { /* ignore */ }
}

/* ═══════════════════════════════════════════════════════════════
   INIT UI
   ═══════════════════════════════════════════════════════════════ */
function initUI() {
  document.getElementById('landingForm').addEventListener('submit', handleSave);
  document.getElementById('resetBtn').addEventListener('click', handleReset);

  // Image inputs (perutusan dibuang)
  document.getElementById('logoInput').addEventListener('change', e => handleImageUpload(e, 'logo'));
  document.getElementById('faviconInput').addEventListener('change', e => handleImageUpload(e, 'favicon'));

  // Mark dirty on all fields
  document.querySelectorAll('#landingForm input, #landingForm textarea').forEach(el => {
    if (el.type !== 'file') {
      el.addEventListener('input', markDirty);
    }
  });

  // Char counters (perutusan dibuang)
  attachCounter('heroSubtitle', 'heroSubCounter', 250);
  attachCounter('visi', 'visiCounter', 500);
  attachCounter('misi', 'misiCounter', 500);

  // Side nav
  document.querySelectorAll('.side-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const target = document.getElementById(item.dataset.target);
      if (target) {
        const top = target.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  window.addEventListener('scroll', updateActiveNav);

  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });

  document.querySelectorAll('a[href$=".html"]').forEach(link => {
    link.addEventListener('click', (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        const url = link.href;
        showConfirmModal({
          icon: 'warning',
          title: 'Perubahan Belum Disimpan',
          desc: 'Anda ada perubahan yang belum disimpan. Keluar tanpa simpan?',
          confirmText: 'Ya, Keluar',
          onConfirm: () => {
            hasUnsavedChanges = false;
            window.location.href = url;
          }
        });
      }
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   CHARACTER COUNTER
   ═══════════════════════════════════════════════════════════════ */
function attachCounter(inputId, counterId, max) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(counterId);
  if (!input || !counter) return;

  const update = () => {
    const len = input.value.length;
    counter.textContent = `${len} / ${max}`;
    counter.classList.remove('warn', 'limit');
    if (len >= max) counter.classList.add('limit');
    else if (len > max * 0.8) counter.classList.add('warn');
  };

  input.addEventListener('input', update);
  update();
}

/* ═══════════════════════════════════════════════════════════════
   LOAD SETTINGS FROM FIRESTORE
   ═══════════════════════════════════════════════════════════════ */
async function loadSettings() {
  try {
    const { db, fs } = window.EMindCare;
    const { doc, getDoc } = fs;

    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      currentData = snap.data();
      originalData = JSON.parse(JSON.stringify(currentData));
      populateForm(currentData);
    } else {
      currentData = {};
      originalData = {};
      populateDefaults();
      showToast('Info', 'Belum ada tetapan tersimpan. Sila isi dan simpan.', 'info', 5000);
    }

    resetDirty();
  } catch (err) {
    console.error('Load settings error:', err);
    showToast('Ralat', 'Gagal memuatkan tetapan: ' + err.message, 'error');
    populateDefaults();
  }
}

/* ═══════════════════════════════════════════════════════════════
   POPULATE FORM (perutusan dibuang)
   ═══════════════════════════════════════════════════════════════ */
function populateForm(data) {
  // Section 1
  document.getElementById('siteName').value = data.siteName || 'e-MindCare';
  document.getElementById('siteTagline').value = data.siteTagline || 'Unit Bimbingan & Kaunseling SMK Syed Sirajuddin';

  // Section 2
  document.getElementById('heroTitle').value = data.heroTitle || 'Selamat Datang Ke e-MindCare';
  document.getElementById('heroSubtitle').value = data.heroSubtitle || 'Empowering Minds Through Interactive Navigation, Digital Counseling, and Resilience Excellence';
  document.getElementById('heroCtaText').value = data.heroCtaText || 'Mulai Teroka';
  document.getElementById('heroBadge').value = data.heroBadge || 'Unit Bimbingan & Kaunseling · SMK Syed Sirajuddin';

  // Section 3 (Visi & Misi sahaja)
  document.getElementById('visi').value = data.visi || '';
  document.getElementById('misi').value = data.misi || '';

  // Section 4
  document.getElementById('contactPhone').value = data.contactPhone || '';
  document.getElementById('contactEmail').value = data.contactEmail || '';
  document.getElementById('contactAddress').value = data.contactAddress || '';
  document.getElementById('contactHours').value = data.contactHours || '';
  document.getElementById('contactMapUrl').value = data.contactMapUrl || '';
  document.getElementById('socialFacebook').value = data.socialFacebook || '';
  document.getElementById('socialInstagram').value = data.socialInstagram || '';
  document.getElementById('socialTiktok').value = data.socialTiktok || '';
  document.getElementById('socialYoutube').value = data.socialYoutube || '';

  // Images
  setPreviewImage('logoPreviewBox', data.logoUrl);
  setPreviewImage('faviconPreviewBox', data.faviconUrl, 'favicon');

  images.logo = data.logoUrl || null;
  images.favicon = data.faviconUrl || null;

  // Update counters
  ['heroSubtitle', 'visi', 'misi'].forEach(id => {
    document.getElementById(id).dispatchEvent(new Event('input'));
  });
}

/* ═══════════════════════════════════════════════════════════════
   POPULATE DEFAULTS
   ═══════════════════════════════════════════════════════════════ */
function populateDefaults() {
  document.getElementById('siteName').value = 'e-MindCare';
  document.getElementById('siteTagline').value = 'Unit Bimbingan & Kaunseling SMK Syed Sirajuddin';
  document.getElementById('heroTitle').value = 'Selamat Datang Ke e-MindCare';
  document.getElementById('heroSubtitle').value = 'Empowering Minds Through Interactive Navigation, Digital Counseling, and Resilience Excellence';
  document.getElementById('heroCtaText').value = 'Mulai Teroka';
  document.getElementById('heroBadge').value = 'Unit Bimbingan & Kaunseling · SMK Syed Sirajuddin';
}

/* ═══════════════════════════════════════════════════════════════
   SET PREVIEW IMAGE
   ═══════════════════════════════════════════════════════════════ */
function setPreviewImage(boxId, url, mode = '') {
  const box = document.getElementById(boxId);
  if (!box) return;

  if (url) {
    const badge = mode !== 'favicon' ? `<span class="preview-badge"><i class="fas fa-check"></i></span>` : '';
    box.innerHTML = `<img src="${url}" alt="Preview">${badge}`;
  } else {
    const defaultIcon = {
      logoPreviewBox: 'fa-image',
      faviconPreviewBox: 'fa-star'
    }[boxId] || 'fa-image';
    box.innerHTML = `<span class="placeholder-icon"><i class="fas ${defaultIcon}"></i></span>`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   CLEAR IMAGE (perutusan dibuang)
   ═══════════════════════════════════════════════════════════════ */
window.clearImage = function(type) {
  const map = {
    logo: { input: 'logoInput', box: 'logoPreviewBox', key: 'logoUrl' },
    favicon: { input: 'faviconInput', box: 'faviconPreviewBox', key: 'faviconUrl' }
  };
  const conf = map[type];
  if (!conf) return;

  showConfirmModal({
    icon: 'warning',
    title: 'Buang Gambar?',
    desc: 'Gambar ini akan dibuang dari paparan. Anda perlu simpan perubahan untuk kekalkan.',
    confirmText: 'Ya, Buang',
    onConfirm: () => {
      images[type] = null;
      document.getElementById(conf.input).value = '';
      setPreviewImage(conf.box, null, type === 'favicon' ? 'favicon' : '');
      markDirty();
      showToast('Berjaya', 'Gambar dibuang. Simpan perubahan untuk kekalkan.', 'info');
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   HANDLE IMAGE UPLOAD (perutusan dibuang)
   ═══════════════════════════════════════════════════════════════ */
async function handleImageUpload(e, type) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    return showToast('Ralat', 'Sila pilih fail gambar sahaja.', 'error');
  }
  if (file.size > 5 * 1024 * 1024) {
    return showToast('Ralat', 'Saiz gambar maksimum 5MB.', 'error');
  }

  const map = {
    logo: { box: 'logoPreviewBox', progressId: 1, key: 'logoUrl' },
    favicon: { box: 'faviconPreviewBox', progressId: 1, key: 'faviconUrl' }
  };
  const conf = map[type];

  // Optimistic preview
  const reader = new FileReader();
  reader.onload = (ev) => {
    const mode = type === 'favicon' ? 'favicon' : '';
    setPreviewImage(conf.box, ev.target.result, mode);
  };
  reader.readAsDataURL(file);

  // Show progress
  const progressEl = document.getElementById(`uploadProgress${conf.progressId}`);
  const fillEl = document.getElementById(`uploadFill${conf.progressId}`);
  const pctEl = document.getElementById(`uploadPct${conf.progressId}`);
  const labelEl = document.getElementById(`uploadLabel${conf.progressId}`);

  progressEl.classList.add('active');
  fillEl.style.width = '0%';
  pctEl.textContent = '0%';
  labelEl.textContent = `Memuat naik ${file.name.substring(0, 25)}...`;

  try {
    const result = await uploadWithProgress(file, {
      resourceType: 'image',
      folder: `${window.EMindCare.CLOUDINARY_CONFIG.folder}/landing`,
      onProgress: (pct) => {
        fillEl.style.width = pct + '%';
        pctEl.textContent = pct + '%';
      }
    });

    images[type] = result.secure_url;
    labelEl.textContent = '✓ Selesai dimuat naik';
    pctEl.textContent = '100%';
    fillEl.style.width = '100%';

    markDirty();

    setTimeout(() => progressEl.classList.remove('active'), 1500);
    showToast('Upload Berjaya', 'Gambar sedia untuk disimpan.', 'success');

  } catch (err) {
    console.error('Upload error:', err);
    progressEl.classList.remove('active');
    showToast('Upload Gagal', err.message, 'error');
    setPreviewImage(conf.box, images[type], type === 'favicon' ? 'favicon' : '');
  }

  e.target.value = '';
}

/* ═══════════════════════════════════════════════════════════════
   CLOUDINARY UPLOAD WITH PROGRESS
   ═══════════════════════════════════════════════════════════════ */
function uploadWithProgress(file, options = {}) {
  const { CLOUDINARY_CONFIG } = window.EMindCare;
  const { resourceType = 'image', folder, onProgress } = options;

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  if (folder) formData.append('folder', folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch (e) { reject(new Error('Respons Cloudinary tidak sah')); }
      } else {
        reject(new Error('Upload Cloudinary gagal: ' + xhr.status));
      }
    };

    xhr.onerror = () => reject(new Error('Rangkaian gagal'));
    xhr.send(formData);
  });
}

/* ═══════════════════════════════════════════════════════════════
   DIRTY STATE
   ═══════════════════════════════════════════════════════════════ */
function markDirty() {
  hasUnsavedChanges = true;
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  dot.classList.add('dirty');
  text.textContent = 'Ada perubahan belum disimpan';
  document.getElementById('saveBtn').disabled = false;
}

function resetDirty() {
  hasUnsavedChanges = false;
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  dot.classList.remove('dirty');
  text.textContent = 'Semua perubahan disimpan';
  document.getElementById('saveBtn').disabled = true;
}

/* ═══════════════════════════════════════════════════════════════
   HANDLE SAVE (perutusan dibuang)
   ═══════════════════════════════════════════════════════════════ */
async function handleSave(e) {
  e.preventDefault();

  const siteName = document.getElementById('siteName').value.trim();
  const heroTitle = document.getElementById('heroTitle').value.trim();

  if (!siteName) return showToast('Ralat', 'Nama website diperlukan.', 'error');
  if (!heroTitle) return showToast('Ralat', 'Tajuk hero diperlukan.', 'error');

  const btn = document.getElementById('saveBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const { db, fs } = window.EMindCare;
    const { doc, setDoc, serverTimestamp } = fs;

    const updateData = {
      // Section 1
      siteName,
      siteTagline: document.getElementById('siteTagline').value.trim() || null,
      logoUrl: images.logo || null,
      faviconUrl: images.favicon || null,

      // Section 2
      heroTitle,
      heroSubtitle: document.getElementById('heroSubtitle').value.trim() || null,
      heroCtaText: document.getElementById('heroCtaText').value.trim() || null,
      heroBadge: document.getElementById('heroBadge').value.trim() || null,

      // Section 3 (Visi & Misi sahaja)
      visi: document.getElementById('visi').value.trim() || null,
      misi: document.getElementById('misi').value.trim() || null,

      // Section 4
      contactPhone: document.getElementById('contactPhone').value.trim() || null,
      contactEmail: document.getElementById('contactEmail').value.trim() || null,
      contactAddress: document.getElementById('contactAddress').value.trim() || null,
      contactHours: document.getElementById('contactHours').value.trim() || null,
      contactMapUrl: document.getElementById('contactMapUrl').value.trim() || null,
      socialFacebook: document.getElementById('socialFacebook').value.trim() || null,
      socialInstagram: document.getElementById('socialInstagram').value.trim() || null,
      socialTiktok: document.getElementById('socialTiktok').value.trim() || null,
      socialYoutube: document.getElementById('socialYoutube').value.trim() || null,

      // Meta
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    };

    await setDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC), updateData, { merge: true });

    currentData = { ...currentData, ...updateData };
    originalData = JSON.parse(JSON.stringify(currentData));
    resetDirty();

    btn.classList.remove('loading');
    showToast('Berjaya!', 'Tetapan laman telah dikemas kini.', 'success');

  } catch (err) {
    console.error('Save error:', err);
    btn.classList.remove('loading');
    btn.disabled = false;
    showToast('Ralat', 'Gagal menyimpan: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   HANDLE RESET
   ═══════════════════════════════════════════════════════════════ */
function handleReset() {
  if (!hasUnsavedChanges) {
    return showToast('Info', 'Tiada perubahan untuk direset.', 'info');
  }

  showConfirmModal({
    icon: 'warning',
    title: 'Reset Borang?',
    desc: 'Semua perubahan yang belum disimpan akan dibuang.',
    confirmText: 'Ya, Reset',
    onConfirm: () => {
      populateForm(originalData);
      resetDirty();
      showToast('Info', 'Borang telah direset.', 'info');
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   SCROLL SPY
   ═══════════════════════════════════════════════════════════════ */
function updateActiveNav() {
  const sections = ['section-1', 'section-2', 'section-3', 'section-4'];
  const scrollY = window.scrollY + 150;
  let activeId = sections[0];

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.offsetTop <= scrollY) activeId = id;
  });

  document.querySelectorAll('.side-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.target === activeId);
  });
}

/* ═══════════════════════════════════════════════════════════════
   CONFIRM MODAL
   ═══════════════════════════════════════════════════════════════ */
function showConfirmModal({ icon = 'warning', title, desc, confirmText, onConfirm }) {
  const iconEl = document.getElementById('confirmIcon');
  iconEl.className = 'modal-icon ' + icon;
  const iconMap = {
    danger: 'fa-exclamation-triangle',
    warning: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };
  iconEl.innerHTML = `<i class="fas ${iconMap[icon] || 'fa-exclamation-triangle'}"></i>`;

  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmDesc').textContent = desc;
  document.getElementById('confirmBtn').innerHTML = `<i class="fas fa-check"></i> ${confirmText || 'Ya, Teruskan'}`;
  pendingConfirmAction = onConfirm;
  document.getElementById('confirmModal').classList.add('active');
}

window.closeConfirmModal = function() {
  document.getElementById('confirmModal').classList.remove('active');
  pendingConfirmAction = null;
};

document.getElementById('confirmBtn')?.addEventListener('click', async () => {
  if (typeof pendingConfirmAction === 'function') {
    const action = pendingConfirmAction;
    closeConfirmModal();
    await action();
  }
});

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR + LOGOUT
   ═══════════════════════════════════════════════════════════════ */
window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sbBackdrop').classList.toggle('active');
};

window.logout = function() {
  if (hasUnsavedChanges) {
    showConfirmModal({
      icon: 'warning',
      title: 'Perubahan Belum Disimpan',
      desc: 'Log keluar tanpa menyimpan perubahan?',
      confirmText: 'Ya, Log Keluar',
      onConfirm: () => {
        hasUnsavedChanges = false;
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = 'login.html';
      }
    });
    return;
  }

  showConfirmModal({
    icon: 'danger',
    title: 'Log Keluar?',
    desc: 'Anda akan dikembalikan ke halaman log masuk.',
    confirmText: 'Ya, Log Keluar',
    onConfirm: () => {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href = 'login.html';
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════ */
function showToast(title, message, type = 'success', duration = 4000) {
  const container = document.getElementById('toastContainer');
  const icons = { success: 'fa-check', error: 'fa-times', info: 'fa-info', warning: 'fa-exclamation' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon"><i class="fas ${icons[type] || 'fa-info'}"></i></div>
    <div class="toast-content"><strong>${title}</strong><span>${message}</span></div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

console.log(
  "%c 🎨 Dashboard Sunting Laman ",
  "background:linear-gradient(135deg,#0F766E,#4F46E5,#8B5CF6);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Ready · v2.1 (Perutusan dibuang)");