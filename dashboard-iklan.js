/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Dashboard Iklan Script (Fixed Sidebar)
   Logik: Pengumuman · Banner · Kolaborasi · URL Tab Sync
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const COLLECTIONS = {
  announcements: 'announcements',
  banners: 'banners',
  collaborations: 'collaborations'
};

const PAGE_TITLES = {
  announcements: ['Pengumuman', 'Urus mesej running text di laman utama'],
  banners: ['Banner Iklan', 'Urus banner slideshow gambar & video'],
  collabs: ['Kolaborasi', 'Urus logo rakan strategik UBK']
};

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let currentUser = null;
let allAnnouncements = [];
let allBanners = [];
let allCollabs = [];

let pendingBannerUpload = null;
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
  await loadAllData();
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
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ═══ AUTO-SWITCH TAB dari URL parameter ═══
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab');
  if (initialTab && ['announcements', 'banners', 'collabs'].includes(initialTab)) {
    switchTab(initialTab, false); // false = jangan update URL (sebab dah ada)
  } else {
    // Default: announcements
    updateSidebarActive('announcements');
  }

  // Announcement form
  document.getElementById('announcementForm').addEventListener('submit', handleAnnouncementSubmit);

  // Banner form
  document.getElementById('bannerForm').addEventListener('submit', handleBannerSubmit);
  initUploadZone('bannerUploadZone', 'bannerFileInput', handleBannerFile);

  // Collab form
  document.getElementById('collabForm').addEventListener('submit', handleCollabSubmit);
  initUploadZone('collabUploadZone', 'collabFileInput', handleCollabFile);

  // Confirm modal
  document.getElementById('confirmBtn').addEventListener('click', async () => {
    if (typeof pendingConfirmAction === 'function') {
      const action = pendingConfirmAction;
      closeConfirmModal();
      await action();
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   SWITCH TAB — sync URL + sidebar + page title
   ═══════════════════════════════════════════════════════════════ */
function switchTab(tabName, updateUrl = true) {
  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });

  // Panels
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.dataset.panel === tabName);
  });

  // Page title
  const [title, subtitle] = PAGE_TITLES[tabName] || ['Dashboard', ''];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSubtitle').textContent = subtitle;

  // Update URL
  if (updateUrl) {
    const url = new URL(window.location);
    url.searchParams.set('tab', tabName);
    window.history.replaceState({}, '', url);
  }

  // Update sidebar highlight
  updateSidebarActive(tabName);

  // Scroll top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ═══════════════════════════════════════════════════════════════
   UPDATE SIDEBAR ACTIVE STATE
   ═══════════════════════════════════════════════════════════════ */
function updateSidebarActive(tabName) {
  document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
  const link = document.querySelector(`.sb-item[data-tab-link="${tabName}"]`);
  if (link) link.classList.add('active');
}

/* ═══════════════════════════════════════════════════════════════
   LOAD ALL DATA
   ═══════════════════════════════════════════════════════════════ */
async function loadAllData() {
  const { getCollection } = window.EMindCare;
  try {
    const [announcements, banners, collabs] = await Promise.all([
      getCollection(COLLECTIONS.announcements),
      getCollection(COLLECTIONS.banners),
      getCollection(COLLECTIONS.collaborations)
    ]);

    allAnnouncements = announcements;
    allBanners = banners;
    allCollabs = collabs;

    renderAnnouncements();
    renderBanners();
    renderCollabs();
    updateTabCounts();
    updatePreview();

  } catch (err) {
    console.error('Load error:', err);
    showToast('Ralat', 'Gagal memuatkan data: ' + err.message, 'error');
  }
}

function updateTabCounts() {
  document.getElementById('tabCountAnn').textContent = allAnnouncements.length;
  document.getElementById('tabCountBan').textContent = allBanners.length;
  document.getElementById('tabCountCol').textContent = allCollabs.length;
}

/* ═══════════════════════════════════════════════════════════════
   TAB 1: ANNOUNCEMENTS
   ═══════════════════════════════════════════════════════════════ */
async function handleAnnouncementSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');

  const text = document.getElementById('annText').value.trim();
  const icon = document.getElementById('annIcon').value.trim() || 'fa-bullhorn';
  const badge = document.getElementById('annBadge').value.trim();
  const active = document.getElementById('annActive').checked;

  if (!text) {
    return showToast('Ralat', 'Sila masukkan teks pengumuman.', 'error');
  }

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const { db, fs } = window.EMindCare;
    const { addDoc, collection, serverTimestamp } = fs;

    const data = {
      text,
      icon,
      badge: badge || null,
      active,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    };

    const ref = await addDoc(collection(db, COLLECTIONS.announcements), data);
    allAnnouncements.unshift({ id: ref.id, ...data });

    document.getElementById('announcementForm').reset();
    document.getElementById('annIcon').value = 'fa-bullhorn';
    document.getElementById('annActive').checked = true;

    renderAnnouncements();
    updateTabCounts();
    updatePreview();

    showToast('Berjaya', 'Pengumuman ditambah.', 'success');
  } catch (err) {
    console.error('Add announcement error:', err);
    showToast('Gagal', err.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function renderAnnouncements() {
  const list = document.getElementById('announcementList');
  const countText = document.getElementById('annCountText');

  countText.textContent = `${allAnnouncements.length} pengumuman`;

  if (!allAnnouncements.length) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-bullhorn"></i>
        <strong>Belum ada pengumuman</strong>
        <p>Tambah pengumuman pertama untuk dipaparkan di laman utama.</p>
      </div>`;
    return;
  }

  list.innerHTML = allAnnouncements.map(a => `
    <div class="list-item${a.active ? '' : ' inactive'}">
      <div class="list-item-icon">
        <i class="fas ${a.icon || 'fa-bullhorn'}"></i>
      </div>
      <div class="list-item-content">
        <div class="list-item-title">
          ${a.badge ? `<span class="badge-inline">${escapeHtml(a.badge)}</span> ` : ''}
          ${escapeHtml(a.text || '')}
        </div>
        <div class="list-item-meta">
          <span><i class="fas fa-clock"></i> ${getTimeAgo(a.createdAt)}</span>
        </div>
      </div>
      <div class="list-item-actions">
        <span class="status-pill ${a.active ? 'active' : 'inactive'}">
          <span class="dot"></span>
          ${a.active ? 'Aktif' : 'Nonaktif'}
        </span>
        <label class="toggle-switch" title="Toggle aktif">
          <input type="checkbox" ${a.active ? 'checked' : ''} onchange="toggleAnnouncement('${a.id}', this.checked)">
          <span class="toggle-track"></span>
        </label>
        <button class="btn btn-danger btn-icon btn-sm" onclick="deleteAnnouncement('${a.id}')" title="Padam">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

window.toggleAnnouncement = async function(id, active) {
  try {
    const { db, fs } = window.EMindCare;
    const { doc, updateDoc } = fs;

    await updateDoc(doc(db, COLLECTIONS.announcements, id), { active });

    const item = allAnnouncements.find(x => x.id === id);
    if (item) item.active = active;

    renderAnnouncements();
    updatePreview();

    showToast('Berjaya', active ? 'Pengumuman diaktifkan.' : 'Pengumuman dinyahaktifkan.', 'success', 2500);
  } catch (err) {
    console.error('Toggle error:', err);
    showToast('Gagal', err.message, 'error');
  }
};

window.deleteAnnouncement = function(id) {
  const ann = allAnnouncements.find(x => x.id === id);
  if (!ann) return;

  showConfirmModal({
    title: 'Padam Pengumuman?',
    desc: `Padam "${truncate(ann.text, 60)}"? Tindakan ini tidak boleh diundur.`,
    confirmText: 'Ya, Padam',
    onConfirm: async () => {
      try {
        const { db, fs } = window.EMindCare;
        const { doc, deleteDoc } = fs;
        await deleteDoc(doc(db, COLLECTIONS.announcements, id));
        allAnnouncements = allAnnouncements.filter(x => x.id !== id);
        renderAnnouncements();
        updateTabCounts();
        updatePreview();
        showToast('Berjaya', 'Pengumuman dipadam.', 'success');
      } catch (err) {
        showToast('Gagal', err.message, 'error');
      }
    }
  });
};

function updatePreview() {
  const active = allAnnouncements.filter(a => a.active);
  const marquee = document.getElementById('previewMarquee');

  if (!active.length) {
    marquee.innerHTML = `
      <span class="preview-item">
        <i class="fas fa-circle-info"></i>
        <span style="opacity:0.7;">Belum ada pengumuman aktif. Tambah di bawah.</span>
      </span>`;
    return;
  }

  const itemsHTML = active.map(a => {
    const badge = a.badge ? `<span class="badge">${escapeHtml(a.badge)}</span>` : '';
    return `<span class="preview-item">
      <i class="fas ${a.icon || 'fa-bullhorn'}"></i>
      ${badge}
      <span>${escapeHtml(a.text || '')}</span>
    </span>`;
  }).join('<span class="preview-divider">✦</span>');

  const sep = '<span class="preview-divider">✦</span>';
  marquee.innerHTML = itemsHTML + sep + itemsHTML + sep;
}

/* ═══════════════════════════════════════════════════════════════
   TAB 2: BANNERS
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

async function handleBannerFile(file) {
  if (file.size > 25 * 1024 * 1024) {
    return showToast('Fail Terlalu Besar', 'Maksimum 25MB.', 'error');
  }

  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) {
    return showToast('Format Tidak Disokong', 'Sila pilih gambar atau video.', 'error');
  }

  const previewEl = document.getElementById('bannerPreview');
  previewEl.style.display = 'flex';
  previewEl.innerHTML = `
    <span class="media-badge">${isVideo ? '🎬 Video' : '🖼️ Gambar'}</span>
    ${isVideo
      ? `<video src="${URL.createObjectURL(file)}" controls muted></video>`
      : `<img src="${URL.createObjectURL(file)}" alt="Preview">`
    }
    <span class="media-size">${formatSize(file.size)}</span>
    <button type="button" class="remove-btn" onclick="clearBannerFile()">
      <i class="fas fa-times"></i>
    </button>`;

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

    const ref = await addDoc(collection(db, COLLECTIONS.banners), data);
    allBanners.push({ id: ref.id, ...data });

    resetBannerForm();
    renderBanners();
    updateTabCounts();

    showToast('Berjaya', 'Banner berjaya ditambah.', 'success');
  } catch (err) {
    console.error('Save banner error:', err);
    showToast('Gagal', err.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function renderBanners() {
  const grid = document.getElementById('bannerGrid');
  const countText = document.getElementById('bannerCountText');

  countText.textContent = `${allBanners.length} banner`;

  if (!allBanners.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-images"></i>
        <strong>Belum ada banner</strong>
        <p>Upload banner pertama untuk dipaparkan di laman utama.</p>
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
          <span class="status-pill ${b.active !== false ? 'active' : 'inactive'}">
            <span class="dot"></span>
            ${b.active !== false ? 'Aktif' : 'Nonaktif'}
          </span>
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

window.toggleBanner = async function(id, active) {
  try {
    const { db, fs } = window.EMindCare;
    await fs.updateDoc(fs.doc(db, COLLECTIONS.banners, id), { active });
    const item = allBanners.find(x => x.id === id);
    if (item) item.active = active;
    renderBanners();
    showToast('Berjaya', active ? 'Banner diaktifkan.' : 'Banner dinyahaktifkan.', 'success', 2500);
  } catch (err) {
    showToast('Gagal', err.message, 'error');
  }
};

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
        await fs.deleteDoc(fs.doc(db, COLLECTIONS.banners, id));
        allBanners = allBanners.filter(x => x.id !== id);
        renderBanners();
        updateTabCounts();
        showToast('Berjaya', 'Banner dipadam.', 'success');
      } catch (err) {
        showToast('Gagal', err.message, 'error');
      }
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   TAB 3: COLLABORATIONS
   ═══════════════════════════════════════════════════════════════ */
async function handleCollabFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    return showToast('Fail Terlalu Besar', 'Maksimum 10MB.', 'error');
  }
  if (!file.type.startsWith('image/')) {
    return showToast('Format Tidak Disokong', 'Sila pilih fail gambar.', 'error');
  }

  const previewEl = document.getElementById('collabPreview');
  previewEl.style.display = 'flex';
  previewEl.innerHTML = `
    <span class="media-badge">🖼️ Logo</span>
    <img src="${URL.createObjectURL(file)}" alt="Preview" style="max-height:180px;">
    <span class="media-size">${formatSize(file.size)}</span>
    <button type="button" class="remove-btn" onclick="clearCollabFile()">
      <i class="fas fa-times"></i>
    </button>`;

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

    const ref = await addDoc(collection(db, COLLECTIONS.collaborations), data);
    allCollabs.push({ id: ref.id, ...data });

    resetCollabForm();
    renderCollabs();
    updateTabCounts();

    showToast('Berjaya', 'Logo kolaborasi ditambah.', 'success');
  } catch (err) {
    console.error('Save collab error:', err);
    showToast('Gagal', err.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function renderCollabs() {
  const grid = document.getElementById('collabGrid');
  const countText = document.getElementById('collabCountText');

  countText.textContent = `${allCollabs.length} logo`;

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
      <div class="media-card-media logo-mode">
        <img src="${c.logoUrl}" alt="${escapeHtml(c.name || '')}" loading="lazy">
        <span class="media-badge logo">
          <i class="fas fa-handshake"></i>
          Logo
        </span>
      </div>
      <div class="media-card-body">
        <div class="media-card-title">${escapeHtml(c.name || 'Tanpa Nama')}</div>
        ${c.linkUrl ? `<div class="media-card-sub">${escapeHtml(c.linkUrl)}</div>` : ''}
        <div class="media-card-meta">
          <span style="font-size:0.7rem;color:var(--ink-soft);">
            <i class="fas fa-clock" style="color:var(--teal);"></i> ${getTimeAgo(c.createdAt)}
          </span>
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

window.deleteCollab = function(id) {
  const collab = allCollabs.find(x => x.id === id);
  if (!collab) return;

  showConfirmModal({
    title: 'Padam Logo?',
    desc: `Padam logo "${truncate(collab.name, 50)}"? Tindakan ini tidak boleh diundur.`,
    confirmText: 'Ya, Padam',
    onConfirm: async () => {
      try {
        const { db, fs } = window.EMindCare;
        await fs.deleteDoc(fs.doc(db, COLLECTIONS.collaborations, id));
        allCollabs = allCollabs.filter(x => x.id !== id);
        renderCollabs();
        updateTabCounts();
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
  "%c 📢 Dashboard Iklan ",
  "background:linear-gradient(135deg,#0F766E,#4F46E5,#EC4899);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Ready · v2.1 (Fixed Sidebar)");