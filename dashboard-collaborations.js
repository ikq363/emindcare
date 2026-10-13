/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Dashboard Kolaborasi Script
   Logik: Upload Cloudinary · CRUD Firestore collaborations
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const COLLECTION = 'collaborations';

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let currentUser = null;
let allCollabs = [];
let pendingCollabUpload = null;
let pendingConfirmAction = null;

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  await waitForEMindCare();
  if (!authGuard()) return;
  initUI();
  applyBranding();
  await loadCollabs();
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
  document.getElementById('collabForm').addEventListener('submit', handleCollabSubmit);
  initUploadZone('collabUploadZone', 'collabFileInput', handleCollabFile);

  document.getElementById('confirmBtn').addEventListener('click', async () => {
    if (typeof pendingConfirmAction === 'function') {
      const action = pendingConfirmAction;
      closeConfirmModal();
      await action();
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   UPLOAD ZONE
   ═══════════════════════════════════════════════════════════════ */
function initUploadZone(zoneId, inputId, onFile) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;

  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) onFile(file);
  });

  ['dragenter', 'dragover'].forEach(ev => {
    zone.addEventListener(ev, e => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(ev => {
    zone.addEventListener(ev, e => {
      e.preventDefault();
      zone.classList.remove('dragover');
    });
  });
  zone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  });
}

/* ═══════════════════════════════════════════════════════════════
   HANDLE LOGO FILE UPLOAD
   ═══════════════════════════════════════════════════════════════ */
async function handleCollabFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    return showToast('Fail Terlalu Besar', 'Maksimum 5MB untuk logo.', 'error');
  }
  if (!file.type.startsWith('image/')) {
    return showToast('Format Tidak Disokong', 'Sila pilih fail gambar sahaja.', 'error');
  }

  // Preview (putih background)
  const previewEl = document.getElementById('collabPreview');
  previewEl.style.display = 'flex';
  previewEl.innerHTML = `
    <span class="media-badge">
      <i class="fas fa-handshake"></i>
      Logo
    </span>
    <img src="${URL.createObjectURL(file)}" alt="Preview">
    <span class="media-size">${formatSize(file.size)}</span>
    <button type="button" class="remove-btn" onclick="clearCollabFile()">
      <i class="fas fa-times"></i>
    </button>`;

  // Upload progress
  const progressEl = document.getElementById('collabProgress');
  const fillEl = document.getElementById('collabProgressFill');
  const pctEl = document.getElementById('collabProgressPct');
  const labelEl = document.getElementById('collabProgressLabel');

  progressEl.classList.add('active');
  fillEl.style.width = '0%';
  pctEl.textContent = '0%';
  labelEl.textContent = `Memuat naik ${truncate(file.name, 30)}...`;

  try {
    const result = await uploadWithProgress(file, {
      resourceType: 'image',
      folder: `${window.EMindCare.CLOUDINARY_CONFIG.folder}/collabs`,
      onProgress: (pct) => {
        fillEl.style.width = pct + '%';
        pctEl.textContent = pct + '%';
      }
    });

    pendingCollabUpload = {
      logoUrl: result.secure_url,
      publicId: result.public_id
    };

    labelEl.textContent = '✓ Selesai dimuat naik';
    pctEl.textContent = '100%';
    fillEl.style.width = '100%';

    document.getElementById('collabSaveBtn').disabled = false;

    setTimeout(() => progressEl.classList.remove('active'), 1500);
    showToast('Upload Berjaya', 'Logo sedia untuk disimpan.', 'success');

  } catch (err) {
    console.error('Upload error:', err);
    progressEl.classList.remove('active');
    previewEl.style.display = 'none';
    showToast('Upload Gagal', err.message, 'error');
  }
}

window.clearCollabFile = function() {
  pendingCollabUpload = null;
  document.getElementById('collabPreview').style.display = 'none';
  document.getElementById('collabFileInput').value = '';
  document.getElementById('collabProgress').classList.remove('active');
  document.getElementById('collabSaveBtn').disabled = true;
};

window.resetCollabForm = function() {
  clearCollabFile();
  document.getElementById('collabForm').reset();
};

/* ═══════════════════════════════════════════════════════════════
   HANDLE COLLAB SUBMIT
   ═══════════════════════════════════════════════════════════════ */
async function handleCollabSubmit(e) {
  e.preventDefault();
  if (!pendingCollabUpload) {
    return showToast('Ralat', 'Sila upload logo dahulu.', 'warning');
  }

  const name = document.getElementById('collabName').value.trim();
  if (!name) {
    return showToast('Ralat', 'Sila masukkan nama rakan kolaborasi.', 'error');
  }

  const btn = document.getElementById('collabSaveBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  const link = document.getElementById('collabLink').value.trim();

  try {
    const { db, fs } = window.EMindCare;
    const { addDoc, collection, serverTimestamp } = fs;

    const data = {
      name,
      logoUrl: pendingCollabUpload.logoUrl,
      publicId: pendingCollabUpload.publicId,
      linkUrl: link || null,
      order: allCollabs.length + 1,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    };

    const ref = await addDoc(collection(db, COLLECTION), data);
    allCollabs.push({ id: ref.id, ...data });

    resetCollabForm();
    renderCollabs();

    showToast('Berjaya', 'Logo kolaborasi berjaya ditambah.', 'success');
  } catch (err) {
    console.error('Save collab error:', err);
    showToast('Gagal', err.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   LOAD COLLABS
   ═══════════════════════════════════════════════════════════════ */
async function loadCollabs() {
  try {
    const { getCollection } = window.EMindCare;
    allCollabs = await getCollection(COLLECTION);
    renderCollabs();
  } catch (err) {
    console.error('Load error:', err);
    showToast('Ralat', 'Gagal memuatkan kolaborasi: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   RENDER COLLABS
   ═══════════════════════════════════════════════════════════════ */
function renderCollabs() {
  const grid = document.getElementById('collabGrid');
  const countText = document.getElementById('collabCountText');
  const totalEl = document.getElementById('collabTotal');

  countText.textContent = `${allCollabs.length} logo`;
  totalEl.textContent = allCollabs.length;

  if (!allCollabs.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-handshake"></i>
        <strong>Belum ada logo kolaborasi</strong>
        <p>Tambah logo rakan strategik untuk dipaparkan di laman utama.</p>
      </div>`;
    return;
  }

  grid.innerHTML = allCollabs.map(c => `
    <div class="media-card">
      <div class="media-card-logo">
        <img src="${c.logoUrl}" alt="${escapeHtml(c.name || '')}" loading="lazy">
        <span class="media-badge">
          <i class="fas fa-handshake"></i>
          Logo
        </span>
      </div>
      <div class="media-card-body">
        <div class="media-card-title">${escapeHtml(c.name || 'Tanpa Nama')}</div>
        ${c.linkUrl ? `
          <a href="${c.linkUrl}" target="_blank" rel="noopener" class="media-card-link">
            <i class="fas fa-external-link-alt"></i>
            <span>${escapeHtml(c.linkUrl)}</span>
          </a>
        ` : ''}
        <div class="media-card-meta">
          <div class="media-card-meta-info">
            <i class="fas fa-clock"></i>
            <span>${getTimeAgo(c.createdAt)}</span>
          </div>
          <div class="media-card-actions">
            <button class="btn btn-danger btn-icon btn-sm" onclick="deleteCollab('${c.id}')" title="Padam">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════════════════════════════
   DELETE COLLAB
   ═══════════════════════════════════════════════════════════════ */
window.deleteCollab = function(id) {
  const collab = allCollabs.find(x => x.id === id);
  if (!collab) return;

  showConfirmModal({
    title: 'Padam Logo?',
    desc: `Padam logo "${truncate(collab.name || 'Tanpa Nama', 50)}"? Tindakan ini tidak boleh diundur.`,
    confirmText: 'Ya, Padam',
    onConfirm: async () => {
      try {
        const { db, fs } = window.EMindCare;
        await fs.deleteDoc(fs.doc(db, COLLECTION, id));
        allCollabs = allCollabs.filter(x => x.id !== id);
        renderCollabs();
        showToast('Berjaya', 'Logo dipadam.', 'success');
      } catch (err) {
        showToast('Gagal', err.message, 'error');
      }
    }
  });
};

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
   CONFIRM MODAL
   ═══════════════════════════════════════════════════════════════ */
function showConfirmModal({ title, desc, confirmText, onConfirm }) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmDesc').textContent = desc;
  document.getElementById('confirmBtn').innerHTML = `<i class="fas fa-trash"></i> ${confirmText || 'Ya, Padam'}`;
  pendingConfirmAction = onConfirm;
  document.getElementById('confirmModal').classList.add('active');
}

window.closeConfirmModal = function() {
  document.getElementById('confirmModal').classList.remove('active');
  pendingConfirmAction = null;
};

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR + LOGOUT + TOAST
   ═══════════════════════════════════════════════════════════════ */
window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sbBackdrop').classList.toggle('active');
};

window.logout = function() {
  showConfirmModal({
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

function truncate(str, len = 50) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function getTimeAgo(timestamp) {
  if (!timestamp) return 'Baru sahaja';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Baru sahaja';
    if (mins < 60) return `${mins} min lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 7) return `${days} hari lalu`;
    return date.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short' });
  } catch { return ''; }
}

console.log(
  "%c 🤝 Dashboard Kolaborasi ",
  "background:linear-gradient(135deg,#4F46E5,#8B5CF6,#EC4899);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Ready · v2.0");