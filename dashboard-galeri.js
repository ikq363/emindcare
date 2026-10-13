/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Dashboard Galeri UBK Script (v2)
   Batch upload → 1 dokumen (images array)
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const COLLECTION = 'gallery';

const CATEGORY_CLASS = {
  'Program UBK': 'cat-program-ubk',
  'Lawatan Kerjaya': 'cat-lawatan-kerjaya',
  'Bengkel Minda Sihat': 'cat-bengkel-minda',
  'Aktiviti Kelab': 'cat-aktiviti-kelab',
  'Lain-lain': 'cat-lain'
};

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let currentUser = null;
let allGallery = [];
let filteredGallery = [];
let uploadQueue = []; // { id, file, status, url, publicId, error }
let lightboxIndex = 0;
let editingId = null;
let pendingConfirmAction = null;

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  await waitForEMindCare();
  if (!authGuard()) return;
  initUI();
  applyBranding();
  await loadGallery();
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
  document.getElementById('galleryForm').addEventListener('submit', handleSubmit);
  initUploadZone();

  document.getElementById('gallerySearch').addEventListener('input', applyFilters);
  document.getElementById('galleryFilterCat').addEventListener('change', applyFilters);
  document.getElementById('galleryFilterStatus').addEventListener('change', applyFilters);

  document.getElementById('confirmBtn').addEventListener('click', async () => {
    if (typeof pendingConfirmAction === 'function') {
      const action = pendingConfirmAction;
      closeConfirmModal();
      await action();
    }
  });
  document.getElementById('editSaveBtn').addEventListener('click', saveEdit);

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('lightbox').classList.contains('active')) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') lightboxNav(e, -1);
      if (e.key === 'ArrowRight') lightboxNav(e, 1);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   UPLOAD ZONE
   ═══════════════════════════════════════════════════════════════ */
function initUploadZone() {
  const zone = document.getElementById('galleryUploadZone');
  const input = document.getElementById('galleryFileInput');
  if (!zone || !input) return;

  input.addEventListener('change', e => {
    addFilesToQueue(Array.from(e.target.files));
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
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) addFilesToQueue(files);
  });
}

function addFilesToQueue(files) {
  const validFiles = files.filter(f => {
    if (!f.type.startsWith('image/')) {
      showToast('Format Tidak Sah', `${f.name} — bukan gambar.`, 'warning', 3000);
      return false;
    }
    if (f.size > 10 * 1024 * 1024) {
      showToast('Fail Terlalu Besar', `${f.name} — melebihi 10MB.`, 'warning', 3000);
      return false;
    }
    return true;
  });

  validFiles.forEach(file => {
    const item = {
      id: 'up_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      file,
      status: 'pending',
      url: null,
      publicId: null,
      error: null
    };
    uploadQueue.push(item);
  });

  renderUploadQueue();
  updateSaveBtnState();

  if (validFiles.length) {
    autoUploadQueue();
  }
}

function renderUploadQueue() {
  const queue = document.getElementById('uploadQueue');

  if (!uploadQueue.length) {
    queue.innerHTML = '';
    return;
  }

  queue.innerHTML = uploadQueue.map(item => {
    const thumbHTML = item.url
      ? `<img src="${item.url}" alt="">`
      : `<i class="fas ${item.status === 'error' ? 'fa-exclamation-triangle' : 'fa-image'} thumb-icon"></i>`;

    let statusHTML = '';
    let barHTML = '';

    if (item.status === 'uploading') {
      statusHTML = `<span class="upload-status" data-progress-id="${item.id}">0%</span>`;
      barHTML = `<div class="upload-bar"><div class="upload-bar-fill" data-fill-id="${item.id}"></div></div>`;
    } else if (item.status === 'complete') {
      statusHTML = `<span class="upload-status"><i class="fas fa-check"></i> Selesai</span>`;
      barHTML = `<div class="upload-bar"><div class="upload-bar-fill" style="width:100%"></div></div>`;
    } else if (item.status === 'error') {
      statusHTML = `<span class="upload-status"><i class="fas fa-times"></i> Gagal</span>`;
      barHTML = `<div class="upload-bar"><div class="upload-bar-fill" style="width:100%"></div></div>`;
    } else {
      statusHTML = `<span class="upload-status">Menunggu</span>`;
      barHTML = `<div class="upload-bar"><div class="upload-bar-fill"></div></div>`;
    }

    return `
      <div class="upload-item ${item.status}" data-item-id="${item.id}">
        <div class="upload-thumb">${thumbHTML}</div>
        <div class="upload-info">
          <div class="upload-name">${escapeHtml(item.file.name)}</div>
          ${barHTML}
        </div>
        ${statusHTML}
        <button type="button" class="upload-remove" onclick="removeFromQueue('${item.id}')" title="Buang">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  }).join('');
}

window.removeFromQueue = function(id) {
  uploadQueue = uploadQueue.filter(item => item.id !== id);
  renderUploadQueue();
  updateSaveBtnState();
};

async function autoUploadQueue() {
  const pending = uploadQueue.filter(i => i.status === 'pending');
  if (!pending.length) return;

  for (const item of pending) {
    if (!uploadQueue.find(i => i.id === item.id)) continue;
    item.status = 'uploading';
    renderUploadQueue();

    try {
      const result = await uploadWithProgress(item.file, {
        resourceType: 'image',
        folder: `${window.EMindCare.CLOUDINARY_CONFIG.folder}/gallery`,
        onProgress: (pct) => {
          const statusEl = document.querySelector(`[data-progress-id="${item.id}"]`);
          const fillEl = document.querySelector(`[data-fill-id="${item.id}"]`);
          if (statusEl) statusEl.textContent = pct + '%';
          if (fillEl) fillEl.style.width = pct + '%';
        }
      });
      item.status = 'complete';
      item.url = result.secure_url;
      item.publicId = result.public_id;
    } catch (err) {
      console.error('Upload error for', item.file.name, err);
      item.status = 'error';
      item.error = err.message;
    }
    renderUploadQueue();
    updateSaveBtnState();
  }

  const complete = uploadQueue.filter(i => i.status === 'complete').length;
  const errors = uploadQueue.filter(i => i.status === 'error').length;

  if (complete > 0 && errors === 0) {
    showToast('Upload Berjaya', `${complete} gambar sedia disimpan ke galeri.`, 'success');
  } else if (errors > 0) {
    showToast('Sebahagian Gagal', `${complete} berjaya, ${errors} gagal.`, 'warning', 5000);
  }
}

function updateSaveBtnState() {
  const hasComplete = uploadQueue.some(i => i.status === 'complete');
  const hasUploading = uploadQueue.some(i => i.status === 'uploading' || i.status === 'pending');
  document.getElementById('gallerySaveBtn').disabled = !hasComplete || hasUploading;
}

window.resetGalleryForm = function() {
  uploadQueue = [];
  renderUploadQueue();
  document.getElementById('galleryForm').reset();
  document.getElementById('galleryFileInput').value = '';
  updateSaveBtnState();
};

/* ═══════════════════════════════════════════════════════════════
   HANDLE SUBMIT — simpan SEMUA gambar dalam 1 dokumen
   ═══════════════════════════════════════════════════════════════ */
async function handleSubmit(e) {
  e.preventDefault();

  const completedUploads = uploadQueue.filter(i => i.status === 'complete');
  if (!completedUploads.length) {
    return showToast('Ralat', 'Sila upload sekurang-kurangnya satu gambar.', 'warning');
  }

  const title = document.getElementById('galleryTitle').value.trim();
  const category = document.getElementById('galleryCategory').value;
  const date = document.getElementById('galleryDate').value;
  const description = document.getElementById('galleryDesc').value.trim();

  if (!title) return showToast('Ralat', 'Tajuk program diperlukan.', 'error');
  if (!category) return showToast('Ralat', 'Kategori diperlukan.', 'error');

  const btn = document.getElementById('gallerySaveBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const { db, fs } = window.EMindCare;
    const { addDoc, collection, serverTimestamp } = fs;

    // ⚡ SIMPAN SEMUA DALAM 1 DOKUMEN
    const images = completedUploads.map(item => ({
      url: item.url,
      publicId: item.publicId || null
    }));

    const data = {
      images, // ← ARRAY gambar
      title,
      category,
      date: date || null,
      description: description || null,
      status: 'published',
      coverIndex: 0, // gambar pertama jadi cover
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    };

    const ref = await addDoc(collection(db, COLLECTION), data);
    allGallery.unshift({ id: ref.id, ...data });

    resetGalleryForm();
    applyFilters();
    updateStats();

    showToast('Berjaya!', `1 album dengan ${images.length} gambar ditambah ke galeri.`, 'success');

  } catch (err) {
    console.error('Save error:', err);
    showToast('Gagal', err.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   LOAD GALLERY
   ═══════════════════════════════════════════════════════════════ */
async function loadGallery() {
  try {
    const { getCollection } = window.EMindCare;
    allGallery = await getCollection(COLLECTION);

    allGallery.sort((a, b) => {
      const at = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bt = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return bt - at;
    });

    applyFilters();
    updateStats();

  } catch (err) {
    console.error('Load error:', err);
    showToast('Ralat', 'Gagal memuatkan galeri: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   APPLY FILTERS
   ═══════════════════════════════════════════════════════════════ */
function applyFilters() {
  const search = document.getElementById('gallerySearch').value.toLowerCase().trim();
  const cat = document.getElementById('galleryFilterCat').value;
  const status = document.getElementById('galleryFilterStatus').value;

  filteredGallery = allGallery.filter(item => {
    if (search && !(item.title || '').toLowerCase().includes(search)) return false;
    if (cat && item.category !== cat) return false;
    if (status && item.status !== status) return false;
    return true;
  });

  renderGallery();
}

/* ═══════════════════════════════════════════════════════════════
   RENDER GALLERY GRID
   ═══════════════════════════════════════════════════════════════ */
function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  const countText = document.getElementById('galleryCountText');

  countText.textContent = `${filteredGallery.length} album (${countTotalImages(filteredGallery)} gambar)`;

  if (!filteredGallery.length) {
    const isFiltered = allGallery.length > 0;
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas ${isFiltered ? 'fa-search' : 'fa-photo-video'}"></i>
        <strong>${isFiltered ? 'Tiada padanan' : 'Belum ada gambar'}</strong>
        <p>${isFiltered ? 'Cuba tukar carian atau filter anda.' : 'Upload gambar pertama untuk dipaparkan di galeri.html'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = filteredGallery.map((item) => {
    const catClass = CATEGORY_CLASS[item.category] || 'cat-lain';
    const isHidden = item.status === 'hidden';
    const dateStr = item.date ? formatDate(item.date) : '';
    const images = item.images || [];
    const imgCount = images.length;

    return `
      <div class="gallery-card${isHidden ? ' hidden-status' : ''}">
        <div class="gallery-image" onclick="openLightbox('${item.id}')">
          <div class="gallery-slideshow">
            ${images.map((img, idx) => `
              <img src="${img.url}" alt="${escapeHtml(item.title)} - ${idx + 1}"
                   class="slide ${idx === 0 ? 'active' : ''}"
                   data-slide-idx="${idx}"
                   loading="${idx === 0 ? 'eager' : 'lazy'}">
            `).join('')}
          </div>
          <div class="gallery-image-overlay">
            <div class="gallery-zoom-icon"><i class="fas fa-search-plus"></i></div>
          </div>
          <span class="gallery-badge ${catClass}">
            <i class="fas fa-tag"></i>
            ${escapeHtml(item.category || 'Lain-lain')}
          </span>
          ${imgCount > 1 ? `<span class="gallery-count-badge"><i class="fas fa-images"></i> ${imgCount}</span>` : ''}
          ${isHidden ? `<span class="gallery-hidden-badge"><i class="fas fa-eye-slash"></i> Sembunyi</span>` : ''}
          ${imgCount > 1 ? `
            <div class="gallery-slideshow-dots">
              ${images.map((_, idx) => `<span class="dot ${idx === 0 ? 'active' : ''}" data-dot-idx="${idx}"></span>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="gallery-body">
          <div class="gallery-title">${escapeHtml(item.title || 'Tanpa Tajuk')}</div>
          ${dateStr ? `<div class="gallery-date"><i class="fas fa-calendar"></i> ${dateStr}</div>` : ''}
          ${item.description ? `<div class="gallery-desc">${escapeHtml(item.description)}</div>` : ''}
          <div class="gallery-meta">
            <label class="toggle-switch" title="${isHidden ? 'Sembunyi' : 'Papar'}">
              <input type="checkbox" ${!isHidden ? 'checked' : ''} onchange="toggleStatus('${item.id}', this.checked)">
              <span class="toggle-track"></span>
            </label>
            <div class="gallery-actions">
              <button class="btn btn-secondary btn-icon btn-sm" onclick="openEditModal('${item.id}')" title="Edit">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn btn-danger btn-icon btn-sm" onclick="deleteItem('${item.id}')" title="Padam">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // ⚡ Auto-start slideshow untuk setiap kad yang ada > 1 gambar
  startAllSlideshows();
}

/* ═══════════════════════════════════════════════════════════════
   SLIDESHOW AUTO-ROTATE (dalam kad)
   ═══════════════════════════════════════════════════════════════ */
let slideshowTimers = [];

function startAllSlideshows() {
  // Clear timers lama
  slideshowTimers.forEach(t => clearInterval(t));
  slideshowTimers = [];

  // Untuk setiap kad yang ada slideshow
  document.querySelectorAll('.gallery-slideshow').forEach(slideshow => {
    const slides = slideshow.querySelectorAll('.slide');
    if (slides.length <= 1) return;

    const card = slideshow.closest('.gallery-card');
    const dots = card.querySelectorAll('.gallery-slideshow-dots .dot');
    let current = 0;

    // Pause pada hover
    let paused = false;
    card.addEventListener('mouseenter', () => { paused = true; });
    card.addEventListener('mouseleave', () => { paused = false; });

    const timer = setInterval(() => {
      if (paused) return;
      current = (current + 1) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('active', i === current));
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
    }, 3000); // 3 detik

    slideshowTimers.push(timer);
  });
}

/* ═══════════════════════════════════════════════════════════════
   UPDATE STATS
   ═══════════════════════════════════════════════════════════════ */
function countTotalImages(items) {
  return items.reduce((sum, item) => sum + (item.images?.length || 0), 0);
}

function updateStats() {
  const total = allGallery.length;
  const published = allGallery.filter(i => i.status !== 'hidden').length;
  const hidden = total - published;
  const totalImages = countTotalImages(allGallery);

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPublished').textContent = published;
  document.getElementById('statHidden').textContent = hidden;

  // Kalau ada element untuk total gambar
  const totalImgEl = document.getElementById('statTotalImages');
  if (totalImgEl) totalImgEl.textContent = totalImages;
}

/* ═══════════════════════════════════════════════════════════════
   TOGGLE STATUS
   ═══════════════════════════════════════════════════════════════ */
window.toggleStatus = async function(id, isPublished) {
  try {
    const { db, fs } = window.EMindCare;
    const newStatus = isPublished ? 'published' : 'hidden';
    await fs.updateDoc(fs.doc(db, COLLECTION, id), { status: newStatus });

    const item = allGallery.find(x => x.id === id);
    if (item) item.status = newStatus;

    applyFilters();
    updateStats();
    showToast('Berjaya', isPublished ? 'Album dipaparkan.' : 'Album disembunyikan.', 'success', 2500);
  } catch (err) {
    showToast('Gagal', err.message, 'error');
  }
};

/* ═══════════════════════════════════════════════════════════════
   DELETE
   ═══════════════════════════════════════════════════════════════ */
window.deleteItem = function(id) {
  const item = allGallery.find(x => x.id === id);
  if (!item) return;

  const imgCount = item.images?.length || 0;
  showConfirmModal({
    title: 'Padam Album?',
    desc: `Padam "${truncate(item.title, 60)}" (${imgCount} gambar)? Tindakan ini tidak boleh diundur.`,
    confirmText: 'Ya, Padam',
    onConfirm: async () => {
      try {
        const { db, fs } = window.EMindCare;
        await fs.deleteDoc(fs.doc(db, COLLECTION, id));
        allGallery = allGallery.filter(x => x.id !== id);
        applyFilters();
        updateStats();
        showToast('Berjaya', 'Album dipadam.', 'success');
      } catch (err) {
        showToast('Gagal', err.message, 'error');
      }
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   EDIT MODAL
   ═══════════════════════════════════════════════════════════════ */
window.openEditModal = function(id) {
  const item = allGallery.find(x => x.id === id);
  if (!item) return;

  editingId = id;
  const coverUrl = item.images?.[0]?.url || '';
  document.getElementById('editPreviewImg').src = coverUrl;
  document.getElementById('editTitle').value = item.title || '';
  document.getElementById('editCategory').value = item.category || 'Lain-lain';
  document.getElementById('editDate').value = item.date || '';
  document.getElementById('editDesc').value = item.description || '';

  document.getElementById('editModal').classList.add('active');
};

window.closeEditModal = function() {
  document.getElementById('editModal').classList.remove('active');
  editingId = null;
};

async function saveEdit() {
  if (!editingId) return;

  const title = document.getElementById('editTitle').value.trim();
  const category = document.getElementById('editCategory').value;
  const date = document.getElementById('editDate').value;
  const description = document.getElementById('editDesc').value.trim();

  if (!title) return showToast('Ralat', 'Tajuk diperlukan.', 'error');

  const btn = document.getElementById('editSaveBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const { db, fs } = window.EMindCare;
    const { doc, updateDoc, serverTimestamp } = fs;

    await updateDoc(doc(db, COLLECTION, editingId), {
      title,
      category,
      date: date || null,
      description: description || null,
      updatedAt: serverTimestamp()
    });

    const item = allGallery.find(x => x.id === editingId);
    if (item) {
      item.title = title;
      item.category = category;
      item.date = date || null;
      item.description = description || null;
    }

    closeEditModal();
    applyFilters();
    showToast('Berjaya', 'Album dikemas kini.', 'success');

  } catch (err) {
    showToast('Gagal', err.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   LIGHTBOX (paparkan semua gambar dalam album)
   ═══════════════════════════════════════════════════════════════ */
let lightboxImages = [];
let lightboxImageIndex = 0;

window.openLightbox = function(id) {
  const item = filteredGallery.find(x => x.id === id);
  if (!item) return;

  lightboxImages = item.images || [];
  lightboxImageIndex = 0;
  updateLightboxContent(item);
  document.getElementById('lightbox').classList.add('active');
  document.body.style.overflow = 'hidden';

  // Stop semua slideshow bila lightbox open
  slideshowTimers.forEach(t => clearInterval(t));
};

window.closeLightbox = function(e) {
  if (e && e.target !== e.currentTarget && !e.target.closest('.lightbox-close')) {
    if (e.target.closest('.lightbox-content') || e.target.closest('.lightbox-nav')) return;
  }
  document.getElementById('lightbox').classList.remove('active');
  document.body.style.overflow = '';

  // Restart slideshows
  startAllSlideshows();
};

window.lightboxNav = function(e, direction) {
  if (e) e.stopPropagation();
  if (lightboxImages.length <= 1) return;
  lightboxImageIndex = (lightboxImageIndex + direction + lightboxImages.length) % lightboxImages.length;

  // Get current item
  const item = filteredGallery.find(x => x.images?.includes(lightboxImages[0]));
  // Fallback: cari dari semua
  const parentItem = filteredGallery.find(x =>
    x.images?.some(img => img.url === lightboxImages[lightboxImageIndex]?.url)
  );
  if (parentItem) updateLightboxContent(parentItem, lightboxImageIndex);
};

function updateLightboxContent(item, imgIdx = 0) {
  lightboxImageIndex = imgIdx;

  document.getElementById('lightboxImage').src = lightboxImages[lightboxImageIndex]?.url || '';
  document.getElementById('lightboxTitle').textContent = item.title || 'Tanpa Tajuk';
  document.getElementById('lightboxDesc').textContent = item.description || '';
  document.getElementById('lightboxCounter').textContent =
    `${lightboxImageIndex + 1} / ${lightboxImages.length}`;

  const dateEl = document.getElementById('lightboxDate');
  if (item.date) {
    dateEl.innerHTML = `<i class="fas fa-calendar"></i> ${formatDate(item.date)}`;
    dateEl.style.display = 'inline-flex';
  } else {
    dateEl.style.display = 'none';
  }
}

/* ═══════════════════════════════════════════════════════════════
   CLOUDINARY UPLOAD
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
   SIDEBAR + LOGOUT
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

function truncate(str, len = 50) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

console.log(
  "%c 📸 Dashboard Galeri v2 ",
  "background:linear-gradient(135deg,#06B6D4,#4F46E5,#8B5CF6);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Batch upload → 1 album · Ready");