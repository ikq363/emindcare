/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Dashboard Banner Iklan Script
   Logik: Upload Cloudinary · CRUD Firestore banners
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const COLLECTION = 'banners';

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let currentUser = null;
let allBanners = [];
let pendingBannerUpload = null;
let pendingConfirmAction = null;

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  await waitForEMindCare();
  if (!authGuard()) return;
  initUI();
  applyBranding();
  await loadBanners();
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
  document.getElementById('bannerForm').addEventListener('submit', handleBannerSubmit);
  initUploadZone('bannerUploadZone', 'bannerFileInput', handleBannerFile);

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
   HANDLE BANNER FILE UPLOAD
   ═══════════════════════════════════════════════════════════════ */
async function handleBannerFile(file) {
  if (file.size > 25 * 1024 * 1024) {
    return showToast('Fail Terlalu Besar', 'Maksimum 25MB untuk gambar/video.', 'error');
  }

  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) {
    return showToast('Format Tidak Disokong', 'Sila pilih gambar atau video.', 'error');
  }

  // Preview
  const previewEl = document.getElementById('bannerPreview');
  previewEl.style.display = 'flex';
  previewEl.innerHTML = `
    <span class="media-badge">
      <i class="fas ${isVideo ? 'fa-video' : 'fa-image'}"></i>
      ${isVideo ? 'Video' : 'Gambar'}
    </span>
    ${isVideo
      ? `<video src="${URL.createObjectURL(file)}" controls muted></video>`
      : `<img src="${URL.createObjectURL(file)}" alt="Preview">`
    }
    <span class="media-size">${formatSize(file.size)}</span>
    <button type="button" class="remove-btn" onclick="clearBannerFile()">
      <i class="fas fa-times"></i>
    </button>`;

  // Upload progress
  const progressEl = document.getElementById('bannerProgress');
  const fillEl = document.getElementById('bannerProgressFill');
  const pctEl = document.getElementById('bannerProgressPct');
  const labelEl = document.getElementById('bannerProgressLabel');

  progressEl.classList.add('active');
  fillEl.style.width = '0%';
  pctEl.textContent = '0%';
  labelEl.textContent = `Memuat naik ${truncate(file.name, 30)}...`;

  try {
    const result = await uploadWithProgress(file, {
      resourceType: isVideo ? 'video' : 'image',
      folder: `${window.EMindCare.CLOUDINARY_CONFIG.folder}/banners`,
      onProgress: (pct) => {
        fillEl.style.width = pct + '%';
        pctEl.textContent = pct + '%';
      }
    });

    pendingBannerUpload = {
      mediaUrl: result.secure_url,
      mediaType: isVideo ? 'video' : 'image',
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      bytes: result.bytes
    };

    labelEl.textContent = '✓ Selesai dimuat naik';
    pctEl.textContent = '100%';
    fillEl.style.width = '100%';

    document.getElementById('bannerSaveBtn').disabled = false;

    setTimeout(() => progressEl.classList.remove('active'), 1500);
    showToast('Upload Berjaya', 'Fail sedia untuk disimpan sebagai banner.', 'success');

  } catch (err) {
    console.error('Upload error:', err);
    progressEl.classList.remove('active');
    previewEl.style.display = 'none';
    showToast('Upload Gagal', err.message, 'error');
  }
}

window.clearBannerFile = function() {
  pendingBannerUpload = null;
  document.getElementById('bannerPreview').style.display = 'none';
  document.getElementById('bannerFileInput').value = '';
  document.getElementById('bannerProgress').classList.remove('active');
  document.getElementById('bannerSaveBtn').disabled = true;
};

window.resetBannerForm = function() {
  clearBannerFile();
  document.getElementById('bannerForm').reset();
};

/* ═══════════════════════════════════════════════════════════════
   HANDLE BANNER SUBMIT
   ═══════════════════════════════════════════════════════════════ */
async function handleBannerSubmit(e) {
  e.preventDefault();
  if (!pendingBannerUpload) {
    return showToast('Ralat', 'Sila upload fail banner dahulu.', 'warning');
  }

  const btn = document.getElementById('bannerSaveBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  const title = document.getElementById('bannerTitle').value.trim();
  const badge = document.getElementById('bannerBadge').value.trim();
  const subtitle = document.getElementById('bannerSubtitle').value.trim();
  const link = document.getElementById('bannerLink').value.trim();

  try {
    const { db, fs } = window.EMindCare;
    const { addDoc, collection, serverTimestamp } = fs;

    const data = {
      text: title || null,
      subtitle: subtitle || null,
      badge: badge || null,
      linkUrl: link || null,
      mediaUrl: pendingBannerUpload.mediaUrl,
      mediaType: pendingBannerUpload.mediaType,
      publicId: pendingBannerUpload.publicId,
      active: true,
      order: allBanners.length + 1,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    };

    const ref = await addDoc(collection(db, COLLECTION), data);
    allBanners.push({ id: ref.id, ...data });

    resetBannerForm();
    renderBanners();

    showToast('Berjaya', 'Banner berjaya ditambah.', 'success');
  } catch (err) {
    console.error('Save banner error:', err);
    showToast('Gagal', err.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   LOAD BANNERS
   ═══════════════════════════════════════════════════════════════ */
async function loadBanners() {
  try {
    const { getCollection } = window.EMindCare;
    allBanners = await getCollection(COLLECTION);
    renderBanners();
  } catch (err) {
    console.error('Load error:', err);
    showToast('Ralat', 'Gagal memuatkan banner: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   RENDER BANNERS
   ═══════════════════════════════════════════════════════════════ */
function renderBanners() {
  const grid = document.getElementById('bannerGrid');
  const countText = document.getElementById('bannerCountText');
  const totalEl = document.getElementById('bannerTotal');

  countText.textContent = `${allBanners.length} banner`;
  totalEl.textContent = allBanners.length;

  if (!allBanners.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-images"></i>
        <strong>Belum ada banner</strong>
        <p>Upload banner pertama untuk dipaparkan sebagai slideshow di laman utama.</p>
      </div>`;
    return;
  }

  grid.innerHTML = allBanners.map(b => `
    <div class="media-card${b.active === false ? ' inactive' : ''}">
      <div class="media-card-media">
        ${b.mediaType === 'video'
          ? `<video src="${b.mediaUrl}" muted preload="metadata"></video>`
          : `<img src="${b.mediaUrl}" alt="${escapeHtml(b.text || '')}" loading="lazy">`
        }
        <span class="media-badge ${b.mediaType}">
          <i class="fas ${b.mediaType === 'video' ? 'fa-video' : 'fa-image'}"></i>
          ${b.mediaType === 'video' ? 'Video' : 'Gambar'}
        </span>
      </div>
      <div class="media-card-body">
        <div class="media-card-title">${escapeHtml(b.text || 'Tanpa Tajuk')}</div>
        ${b.subtitle ? `<div class="media-card-sub">${escapeHtml(b.subtitle)}</div>` : ''}
        <div class="media-card-meta">
          <div class="media-card-meta-info">
            <span class="status-pill ${b.active !== false ? 'active' : 'inactive'}">
              <span class="dot"></span>
              ${b.active !== false ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
          <div class="media-card-actions">
            <label class="toggle-switch" title="Toggle aktif">
              <input type="checkbox" ${b.active !== false ? 'checked' : ''} onchange="toggleBanner('${b.id}', this.checked)">
              <span class="toggle-track" style="width:38px;height:22px;"></span>
            </label>
            <button class="btn btn-danger btn-icon btn-sm" onclick="deleteBanner('${b.id}')" title="Padam">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════════════════════════════
   TOGGLE BANNER
   ═══════════════════════════════════════════════════════════════ */
window.toggleBanner = async function(id, active) {
  try {
    const { db, fs } = window.EMindCare;
    await fs.updateDoc(fs.doc(db, COLLECTION, id), { active });
    const item = allBanners.find(x => x.id === id);
    if (item) item.active = active;
    renderBanners();
    showToast('Berjaya', active ? 'Banner diaktifkan.' : 'Banner dinyahaktifkan.', 'success', 2500);
  } catch (err) {
    showToast('Gagal', err.message, 'error');
  }
};

/* ═══════════════════════════════════════════════════════════════
   DELETE BANNER
   ═══════════════════════════════════════════════════════════════ */
window.deleteBanner = function(id) {
  const banner = allBanners.find(x => x.id === id);
  if (!banner) return;

  showConfirmModal({
    title: 'Padam Banner?',
    desc: `Padam banner "${truncate(banner.text || 'Tanpa Tajuk', 60)}"? Tindakan ini tidak boleh diundur.`,
    confirmText: 'Ya, Padam',
    onConfirm: async () => {
      try {
        const { db, fs } = window.EMindCare;
        await fs.deleteDoc(fs.doc(db, COLLECTION, id));
        allBanners = allBanners.filter(x => x.id !== id);
        renderBanners();
        showToast('Berjaya', 'Banner dipadam.', 'success');
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

console.log(
  "%c 🖼️ Dashboard Banner Iklan ",
  "background:linear-gradient(135deg,#F59E0B,#EC4899);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Ready · v2.0");