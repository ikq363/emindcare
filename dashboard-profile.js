/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Dashboard Profile Script
   Logik: Auth Guard · Fetch Firestore · Update Profile · Cloudinary Upload
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const USERS_COLLECTION = 'users';

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let currentUser = null;
let profileData = null;
let originalData = null;
let hasUnsavedChanges = false;
let pendingConfirmAction = null;

/* ═══════════════════════════════════════════════════════════════
   DOM
   ═══════════════════════════════════════════════════════════════ */
const form = document.getElementById('profileForm');
const fields = {
  fullName: document.getElementById('fullName'),
  icNumber: document.getElementById('icNumber'),
  title: document.getElementById('title'),
  phone: document.getElementById('phone'),
  email: document.getElementById('email'),
  education: document.getElementById('education'),
  bio: document.getElementById('bio')
};
const toggles = {
  notifEmail: document.getElementById('notifEmail'),
  notifWhatsapp: document.getElementById('notifWhatsapp'),
  showPhone: document.getElementById('showPhone'),
  showBio: document.getElementById('showBio')
};

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  await waitForEMindCare();
  if (!authGuard()) return;
  initUI();
  applyBranding();
  await loadProfileData();
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
    return true;
  } catch (e) {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   INIT UI EVENT LISTENERS
   ═══════════════════════════════════════════════════════════════ */
function initUI() {
  // Form submit
  form.addEventListener('submit', handleSave);

  // Reset button
  document.getElementById('resetBtn').addEventListener('click', handleReset);

  // Avatar upload
  document.getElementById('avatarInput').addEventListener('change', handleAvatarUpload);

  // Input formatting
  fields.fullName.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^A-Za-z\s'\.]/g, '').toUpperCase();
    markDirty();
  });

  fields.phone.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^\d+\s\-]/g, '').slice(0, 20);
    markDirty();
  });

  // Character counter for bio
  fields.bio.addEventListener('input', (e) => {
    updateBioCounter(e.target.value.length);
    markDirty();
  });

  // Mark dirty on any field change
  ['title', 'email', 'education'].forEach(key => {
    fields[key].addEventListener('input', markDirty);
  });

  // Toggles mark dirty
  Object.values(toggles).forEach(t => {
    t.addEventListener('change', markDirty);
  });

  // Warn on page leave if unsaved
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });

  // Warn on internal navigation (sidebar links)
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
   LOAD PROFILE DATA FROM FIRESTORE
   ═══════════════════════════════════════════════════════════════ */
async function loadProfileData() {
  try {
    const { db, fs } = window.EMindCare;
    const { doc, getDoc } = fs;

    const docRef = doc(db, USERS_COLLECTION, currentUser.uid);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      showToast('Ralat', 'Data profil tidak dijumpai dalam sistem.', 'error');
      return;
    }

    profileData = { id: snap.id, ...snap.data() };
    originalData = { ...profileData };

    // Populate sidebar + profile hero
    populateUI(profileData);

    // Populate form fields
    populateForm(profileData);

    // Clear dirty state
    resetDirty();

  } catch (err) {
    console.error('Load error:', err);
    showToast('Ralat', 'Gagal memuatkan profil: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   POPULATE UI (Sidebar + Hero)
   ═══════════════════════════════════════════════════════════════ */
function populateUI(data) {
  const name = data.fullName || 'Kaunselor';
  const firstWord = name.split(' ')[0];
  const initial = name.charAt(0).toUpperCase();

  // Sidebar
  document.getElementById('sbProfileName').textContent = name;
  const sbAvatar = document.getElementById('sbAvatar');
  if (data.profileImage || data.avatarUrl) {
    sbAvatar.innerHTML = `<img src="${data.profileImage || data.avatarUrl}" alt="">`;
  } else {
    sbAvatar.textContent = initial;
  }

  // Hero
  document.getElementById('profileName').textContent = name;

  const titleEl = document.getElementById('profileTitle');
  if (data.title) {
    titleEl.innerHTML = `<i class="fas fa-user-shield"></i><span>${escapeHtml(data.title)}</span>`;
  }

  // Meta
  document.getElementById('metaIC').textContent = data.icNumber || '—';
  document.getElementById('metaEmail').textContent = data.email || 'Belum ditetapkan';
  document.getElementById('metaPhone').textContent = data.phone || 'Belum ditetapkan';

  // Avatar
  const avatarEl = document.getElementById('profileAvatar');
  const avatarTextEl = document.getElementById('avatarText');
  if (data.profileImage || data.avatarUrl) {
    avatarEl.innerHTML = `
      <img src="${data.profileImage || data.avatarUrl}" alt="${name}">
      <label class="profile-avatar-overlay" for="avatarInput">
        <i class="fas fa-camera"></i>
        <span>Tukar Gambar</span>
      </label>`;
    // Re-attach input reference
    const input = document.getElementById('avatarInput');
    input.style.display = 'none';
    // Move input after avatar
    avatarEl.parentElement.appendChild(input);
  } else {
    avatarTextEl.textContent = initial;
  }

  document.title = `${name} · Profil Kaunselor · e-MindCare`;
}

/* ═══════════════════════════════════════════════════════════════
   POPULATE FORM FIELDS
   ═══════════════════════════════════════════════════════════════ */
function populateForm(data) {
  fields.fullName.value = data.fullName || '';
  fields.icNumber.value = data.icNumber || '';
  fields.title.value = data.title || '';
  fields.phone.value = data.phone || '';
  fields.email.value = data.email || '';
  fields.education.value = data.education || '';
  fields.bio.value = data.bio || '';
  updateBioCounter(fields.bio.value.length);

  // Toggles (with defaults)
  toggles.notifEmail.checked = data.notifEmail !== false;
  toggles.notifWhatsapp.checked = data.notifWhatsapp === true;
  toggles.showPhone.checked = data.showPhone !== false;
  toggles.showBio.checked = data.showBio !== false;
}

/* ═══════════════════════════════════════════════════════════════
   BIO COUNTER
   ═══════════════════════════════════════════════════════════════ */
function updateBioCounter(len) {
  const el = document.getElementById('bioCounter');
  el.textContent = `${len} / 600`;
  el.classList.remove('warn', 'limit');
  if (len >= 600) el.classList.add('limit');
  else if (len > 480) el.classList.add('warn');
}

/* ═══════════════════════════════════════════════════════════════
   DIRTY STATE TRACKING
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
   HANDLE SAVE
   ═══════════════════════════════════════════════════════════════ */
async function handleSave(e) {
  e.preventDefault();

  const fullName = fields.fullName.value.trim();
  const email = fields.email.value.trim();

  // Validate
  if (!fullName || fullName.length < 3) {
    return showToast('Ralat', 'Nama penuh tidak sah.', 'error');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return showToast('Ralat', 'Format e-mel tidak sah.', 'error');
  }

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.classList.add('loading');
  saveBtn.disabled = true;

  try {
    const { db, fs } = window.EMindCare;
    const { doc, updateDoc, serverTimestamp } = fs;

    const updateData = {
      fullName,
      title: fields.title.value.trim() || null,
      phone: fields.phone.value.trim() || null,
      email: email || null,
      education: fields.education.value.trim() || null,
      bio: fields.bio.value.trim() || null,
      notifEmail: toggles.notifEmail.checked,
      notifWhatsapp: toggles.notifWhatsapp.checked,
      showPhone: toggles.showPhone.checked,
      showBio: toggles.showBio.checked,
      updatedAt: serverTimestamp()
    };

    // Update Firestore
    await updateDoc(doc(db, USERS_COLLECTION, currentUser.uid), updateData);

    // Update localStorage session
    const newSession = {
      ...currentUser,
      fullName,
      email: email || null,
      phone: updateData.phone,
      title: updateData.title,
      bio: updateData.bio
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    currentUser = newSession;

    // Update local state
    profileData = { ...profileData, ...updateData };
    originalData = { ...profileData };

    // Refresh UI
    populateUI(profileData);
    resetDirty();

    saveBtn.classList.remove('loading');
    showToast('Berjaya!', 'Profil anda telah dikemas kini.', 'success');

  } catch (err) {
    console.error('Save error:', err);
    saveBtn.classList.remove('loading');
    saveBtn.disabled = false;
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
   HANDLE AVATAR UPLOAD
   ═══════════════════════════════════════════════════════════════ */
async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate
  if (!file.type.startsWith('image/')) {
    return showToast('Ralat', 'Sila pilih fail gambar sahaja.', 'error');
  }
  if (file.size > 5 * 1024 * 1024) {
    return showToast('Ralat', 'Saiz gambar maksimum 5MB.', 'error');
  }

  // Preview immediately (optimistic UI)
  const reader = new FileReader();
  reader.onload = (ev) => {
    const avatarEl = document.getElementById('profileAvatar');
    const img = avatarEl.querySelector('img');
    if (img) {
      img.src = ev.target.result;
    } else {
      avatarEl.innerHTML = `
        <img src="${ev.target.result}" alt="Preview">
        <label class="profile-avatar-overlay" for="avatarInput">
          <i class="fas fa-camera"></i>
          <span>Tukar Gambar</span>
        </label>`;
      const input = document.getElementById('avatarInput');
      input.style.display = 'none';
      avatarEl.parentElement.appendChild(input);
    }
  };
  reader.readAsDataURL(file);

  // Show progress
  const progressEl = document.getElementById('uploadProgress');
  const fillEl = document.getElementById('uploadFill');
  const pctEl = document.getElementById('uploadPct');
  const labelEl = document.getElementById('uploadLabel');

  progressEl.classList.add('active');
  fillEl.style.width = '0%';
  pctEl.textContent = '0%';
  labelEl.textContent = 'Memuat naik gambar...';

  try {
    const { uploadToCloudinary, db, fs, CLOUDINARY_CONFIG } = window.EMindCare;

    // Upload to Cloudinary with progress
    const result = await uploadWithProgress(file, {
      resourceType: 'image',
      folder: `${CLOUDINARY_CONFIG.folder}/profiles`,
      onProgress: (pct) => {
        fillEl.style.width = pct + '%';
        pctEl.textContent = pct + '%';
      }
    });

    // Save URL to Firestore
    const { doc, updateDoc, serverTimestamp } = fs;
    await updateDoc(doc(db, USERS_COLLECTION, currentUser.uid), {
      profileImage: result.secure_url,
      updatedAt: serverTimestamp()
    });

    // Update localStorage
    const newSession = { ...currentUser, avatarUrl: result.secure_url };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    currentUser = newSession;

    // Update local state
    profileData.profileImage = result.secure_url;
    originalData.profileImage = result.secure_url;

    // Update sidebar avatar
    document.getElementById('sbAvatar').innerHTML = `<img src="${result.secure_url}" alt="">`;
    document.getElementById('profileAvatar').querySelector('img').src = result.secure_url;

    // Complete
    labelEl.textContent = 'Gambar berjaya dimuat naik!';
    fillEl.style.width = '100%';
    pctEl.textContent = '100%';

    setTimeout(() => {
      progressEl.classList.remove('active');
    }, 1500);

    showToast('Berjaya!', 'Gambar profil telah dikemas kini.', 'success');

  } catch (err) {
    console.error('Upload error:', err);
    progressEl.classList.remove('active');
    showToast('Upload Gagal', err.message, 'error');

    // Revert preview
    if (profileData.profileImage) {
      document.getElementById('profileAvatar').querySelector('img').src = profileData.profileImage;
    }
  }

  // Reset file input
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
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error('Respons Cloudinary tidak sah'));
        }
      } else {
        reject(new Error('Upload Cloudinary gagal: ' + xhr.status));
      }
    };

    xhr.onerror = () => reject(new Error('Rangkaian gagal'));
    xhr.send(formData);
  });
}

/* ═══════════════════════════════════════════════════════════════
   CONFIRM MODAL
   ═══════════════════════════════════════════════════════════════ */
function showConfirmModal({ icon = 'danger', title, desc, confirmText, onConfirm }) {
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
   SIDEBAR TOGGLE
   ═══════════════════════════════════════════════════════════════ */
window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sbBackdrop').classList.toggle('active');
};

/* ═══════════════════════════════════════════════════════════════
   LOGOUT
   ═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   UTILS
   ═══════════════════════════════════════════════════════════════ */
function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

console.log(
  "%c 👤 Dashboard Profile ",
  "background:linear-gradient(135deg,#0F766E,#4F46E5,#EC4899);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Ready · v2.0");