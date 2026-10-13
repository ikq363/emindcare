/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Dashboard Kaunselor
   Logik CRUD Firestore + Cloudinary Upload
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const PAGE_TITLES = {
  overview: ['Overview', 'Ringkasan statistik dan aktiviti UBK'],
  users: ['Pengurusan Pengguna', 'Daftar dan urus akaun guru & murid'],
  announcements: ['Pengumuman', 'Urus mesej running text di landing page'],
  banners: ['Banner Iklan', 'Urus banner slideshow gambar & video'],
  collaborations: ['Kolaborasi', 'Urus logo rakan strategik UBK'],
  appointments: ['Temujanji', 'Urus permohonan sesi kaunseling'],
  articles: ['Artikel', 'Urus kandungan artikel UBK']
};

/* ═══════════════════════════════════════════════════════════════
   GLOBAL STATE
   ═══════════════════════════════════════════════════════════════ */
let currentUser = null;
let allUsers = [];
let allAppointments = [];
let allAnnouncements = [];
let allBanners = [];
let allCollabs = [];

let editingUserId = null;
let editingApptId = null;
let pendingConfirmAction = null;

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  await waitForEMindCare();
  authGuard();
  initUI();
  loadAllData();
});

function waitForEMindCare() {
  return new Promise((resolve, reject) => {
    if (window.EMindCare) return resolve();
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (window.EMindCare) { clearInterval(timer); resolve(); }
      else if (tries > 100) { clearInterval(timer); reject(new Error('Firebase SDK timeout')); }
    }, 50);
  });
}

/* ═══════════════════════════════════════════════════════════════
   AUTH GUARD
   ═══════════════════════════════════════════════════════════════ */
function authGuard() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    window.location.href = 'login.html';
    return;
  }
  try {
    const session = JSON.parse(raw);
    if (session.role !== 'kaunselor') {
      // Bukan kaunselor — halau ke dashboard masing-masing
      const redirects = { guru: 'dashboard-guru.html', murid: 'dashboard-murid.html' };
      window.location.href = redirects[session.role] || 'login.html';
      return;
    }
    currentUser = session;
    // Populate profile
    document.getElementById('sbProfileName').textContent = session.fullName;
    document.getElementById('sbAvatar').textContent = session.fullName.charAt(0).toUpperCase();
    // Apply branding
    applyBranding();
  } catch (e) {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
  }
}

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
   UI HELPERS
   ═══════════════════════════════════════════════════════════════ */
window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sbBackdrop').classList.toggle('active');
};

window.switchTab = function(tabName) {
  // Update sidebar items
  document.querySelectorAll('.sb-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tabName);
  });
  // Update panels
  document.querySelectorAll('.tab-panel').forEach(el => {
    el.classList.toggle('active', el.dataset.panel === tabName);
  });
  // Update title
  const [title, sub] = PAGE_TITLES[tabName] || ['Dashboard', ''];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSubtitle').textContent = sub;
  // Close sidebar on mobile
  if (window.innerWidth <= 900) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sbBackdrop').classList.remove('active');
  }
  // Scroll top
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.refreshAll = function() {
  showToast('Memuat semula', 'Mengambil data terkini...', 'info', 2000);
  loadAllData();
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
window.showToast = showToast;

/* ═══════════════════════════════════════════════════════════════
   LOADING OVERLAY
   ═══════════════════════════════════════════════════════════════ */
function showLoading(text = 'Memproses...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.add('active');
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('active');
}

/* ═══════════════════════════════════════════════════════════════
   CONFIRM MODAL
   ═══════════════════════════════════════════════════════════════ */
function showConfirmModal({ title, desc, confirmText = 'Ya, Padam', onConfirm }) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmDesc').textContent = desc;
  document.getElementById('confirmBtn').innerHTML = `<i class="fas fa-check"></i> ${confirmText}`;
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
   INIT UI EVENT LISTENERS
   ═══════════════════════════════════════════════════════════════ */
function initUI() {
  // Sidebar navigation
  document.querySelectorAll('.sb-item').forEach(el => {
    el.addEventListener('click', () => switchTab(el.dataset.tab));
  });

  // User form
  document.getElementById('userForm')?.addEventListener('submit', handleUserSubmit);
  document.getElementById('userName')?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/[^A-Za-z\s'\.]/g, '').toUpperCase();
  });
  document.getElementById('userIC')?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
  });

  // User search/filter
  document.getElementById('userSearch')?.addEventListener('input', renderUserTable);
  document.getElementById('userFilterRole')?.addEventListener('change', renderUserTable);

  // Announcement form
  document.getElementById('announcementForm')?.addEventListener('submit', handleAnnouncementSubmit);

  // Banner upload
  initUploadZone('bannerUploadZone', 'bannerFileInput', handleBannerFile);
  document.getElementById('bannerSaveBtn')?.addEventListener('click', saveBannerToFirestore);

  // Collab upload
  initUploadZone('collabUploadZone', 'collabFileInput', handleCollabFile);
  document.getElementById('collabSaveBtn')?.addEventListener('click', saveCollabToFirestore);

  // Appointment search/filter
  document.getElementById('apptSearch')?.addEventListener('input', renderApptTable);
  document.getElementById('apptFilterStatus')?.addEventListener('change', renderApptTable);

  // Edit user modal
  document.getElementById('editUserSaveBtn')?.addEventListener('click', saveEditUser);

  // Appointment modal
  document.getElementById('apptSaveBtn')?.addEventListener('click', saveApptUpdate);
}

/* ═══════════════════════════════════════════════════════════════
   LOAD ALL DATA
   ═══════════════════════════════════════════════════════════════ */
async function loadAllData() {
  const { getCollection, getCollectionWhere } = window.EMindCare;

  try {
    const [users, appointments, announcements, banners, collabs] = await Promise.all([
      getCollection('users'),
      getCollection('appointments'),
      getCollection('announcements'),
      getCollection('banners'),
      getCollection('collaborations')
    ]);

    allUsers = users;
    allAppointments = appointments;
    allAnnouncements = announcements;
    allBanners = banners;
    allCollabs = collabs;

    renderStats();
    renderRecentActivity();
    renderUserTable();
    renderAnnouncementList();
    renderBannerGrid();
    renderCollabGrid();
    renderApptTable();
    updatePendingBadge();

  } catch (err) {
    console.error('❌ Load error:', err);
    showToast('Ralat', 'Gagal memuatkan data: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   RENDER: STATS
   ═══════════════════════════════════════════════════════════════ */
function renderStats() {
  const murid = allUsers.filter(u => u.role === 'murid').length;
  const guru = allUsers.filter(u => u.role === 'guru').length;
  const pending = allAppointments.filter(a => a.status === 'pending').length;
  const artikel = allUsers.length; // placeholder

  animateNumber('statMurid', murid);
  animateNumber('statGuru', guru);
  animateNumber('statPending', pending);
  animateNumber('statArtikel', allBanners.length);
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = 0;
  const duration = 900;
  const startTime = performance.now();
  (function tick(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(start + (target - start) * eased);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  })(startTime);
}

function updatePendingBadge() {
  const pending = allAppointments.filter(a => a.status === 'pending').length;
  const badge = document.getElementById('pendingBadge');
  if (badge) {
    if (pending > 0) {
      badge.textContent = pending;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   RENDER: RECENT ACTIVITY
   ═══════════════════════════════════════════════════════════════ */
function renderRecentActivity() {
  const el = document.getElementById('recentActivity');
  const recent = allAppointments.slice(0, 5);

  if (!recent.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada aktiviti terkini.</p></div>`;
    return;
  }

  el.innerHTML = recent.map(a => `
    <div style="display:flex;align-items:center;gap:1rem;padding:0.85rem 0;border-bottom:1px solid var(--line);">
      <div class="user-avatar">${(a.studentName || 'U').charAt(0).toUpperCase()}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:0.88rem;color:var(--ink);">${a.studentName || 'Tanpa Nama'}</div>
        <div style="font-size:0.75rem;color:var(--ink-soft);">${a.reason || 'Temujanji kaunseling'}</div>
      </div>
      <span class="status-badge ${a.status || 'pending'}">${getStatusLabel(a.status)}</span>
    </div>
  `).join('');
}

function getStatusLabel(s) {
  const map = { pending: 'Menunggu', approved: 'Diluluskan', completed: 'Selesai', rejected: 'Ditolak' };
  return map[s] || s;
}

/* ═══════════════════════════════════════════════════════════════
   MODUL: USERS
   ═══════════════════════════════════════════════════════════════ */
async function handleUserSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('userName').value.trim().toUpperCase();
  const ic = document.getElementById('userIC').value.trim();
  const role = document.getElementById('userRole').value;
  const cls = document.getElementById('userClass').value.trim();
  const email = document.getElementById('userEmail').value.trim();

  if (!name || name.length < 3) return showToast('Ralat', 'Nama tidak sah.', 'error');
  if (!/^\d{12}$/.test(ic)) return showToast('Ralat', 'Nombor IC perlu 12 digit.', 'error');

  // Cek duplikasi IC
  const existing = allUsers.find(u => u.icNumber === ic);
  if (existing) {
    return showToast('Nombor IC Berulang', `IC ${ic} sudah wujud dalam sistem.`, 'error', 5000);
  }

  showLoading('Mendaftar pengguna...');
  try {
    const { db, fs } = window.EMindCare;
    const newUser = {
      fullName: name,
      icNumber: ic,
      role: role,
      class: cls || null,
      email: email || null,
      createdAt: fs.serverTimestamp(),
      createdBy: currentUser.uid
    };

    const docRef = await fs.addDoc(fs.collection(db, 'users'), newUser);

    // Add to local list
    allUsers.push({ id: docRef.id, ...newUser });

    document.getElementById('userForm').reset();
    renderUserTable();
    renderStats();
    hideLoading();
    showToast('Berjaya', `Pengguna "${name}" berjaya didaftarkan.`, 'success');

  } catch (err) {
    hideLoading();
    console.error(err);
    showToast('Gagal Mendaftar', err.message, 'error');
  }
}

function renderUserTable() {
  const tbody = document.getElementById('userTableBody');
  const searchTerm = (document.getElementById('userSearch')?.value || '').toLowerCase().trim();
  const roleFilter = document.getElementById('userFilterRole')?.value || '';

  let filtered = allUsers;
  if (roleFilter) filtered = filtered.filter(u => u.role === roleFilter);
  if (searchTerm) {
    filtered = filtered.filter(u =>
      (u.fullName || '').toLowerCase().includes(searchTerm) ||
      (u.icNumber || '').includes(searchTerm) ||
      (u.class || '').toLowerCase().includes(searchTerm)
    );
  }

  document.getElementById('userCountText').textContent = `${filtered.length} daripada ${allUsers.length} pengguna`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="4">
      <div class="empty-state">
        <i class="fas fa-users-slash"></i>
        <p>Tiada pengguna ditemui.</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(u => `
    <tr>
      <td>
        <div class="user-cell">
          <div class="user-avatar">${(u.fullName || 'U').charAt(0).toUpperCase()}</div>
          <div class="user-info">
            <strong>${u.fullName || 'Tanpa Nama'}</strong>
            <span>${u.icNumber || '-'}</span>
          </div>
        </div>
      </td>
      <td><span class="role-badge ${u.role || 'murid'}">${u.role || 'murid'}</span></td>
      <td style="font-size:0.82rem;color:var(--ink-soft);">${u.class || '-'}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editUser('${u.id}')" title="Edit">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteUser('${u.id}')" title="Padam">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.editUser = function(id) {
  const u = allUsers.find(x => x.id === id);
  if (!u) return;
  editingUserId = id;
  document.getElementById('editUserName').value = u.fullName || '';
  document.getElementById('editUserRole').value = u.role || 'murid';
  document.getElementById('editUserClass').value = u.class || '';
  document.getElementById('editUserModal').classList.add('active');
};
window.closeEditModal = function() {
  document.getElementById('editUserModal').classList.remove('active');
  editingUserId = null;
};

async function saveEditUser() {
  if (!editingUserId) return;
  const name = document.getElementById('editUserName').value.trim().toUpperCase();
  const role = document.getElementById('editUserRole').value;
  const cls = document.getElementById('editUserClass').value.trim();

  if (!name || name.length < 3) return showToast('Ralat', 'Nama tidak sah.', 'error');

  showLoading('Menyimpan...');
  try {
    const { db, fs } = window.EMindCare;
    await fs.updateDoc(fs.doc(db, 'users', editingUserId), {
      fullName: name,
      role: role,
      class: cls || null,
      updatedAt: fs.serverTimestamp()
    });

    const idx = allUsers.findIndex(x => x.id === editingUserId);
    if (idx >= 0) allUsers[idx] = { ...allUsers[idx], fullName: name, role, class: cls || null };

    closeEditModal();
    renderUserTable();
    renderStats();
    hideLoading();
    showToast('Berjaya', 'Pengguna dikemaskini.', 'success');
  } catch (err) {
    hideLoading();
    showToast('Gagal', err.message, 'error');
  }
}

window.deleteUser = function(id) {
  const u = allUsers.find(x => x.id === id);
  if (!u) return;
  showConfirmModal({
    title: 'Padam Pengguna?',
    desc: `Padam akaun "${u.fullName}" (${u.icNumber})? Tindakan ini tidak boleh diundur.`,
    confirmText: 'Ya, Padam',
    onConfirm: async () => {
      showLoading('Memadam...');
      try {
        const { db, fs } = window.EMindCare;
        await fs.deleteDoc(fs.doc(db, 'users', id));
        allUsers = allUsers.filter(x => x.id !== id);
        renderUserTable();
        renderStats();
        hideLoading();
        showToast('Berjaya', 'Pengguna dipadam.', 'success');
      } catch (err) {
        hideLoading();
        showToast('Gagal', err.message, 'error');
      }
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   MODUL: ANNOUNCEMENTS
   ═══════════════════════════════════════════════════════════════ */
async function handleAnnouncementSubmit(e) {
  e.preventDefault();
  const text = document.getElementById('annText').value.trim();
  const icon = document.getElementById('annIcon').value.trim() || 'fa-bullhorn';
  const badge = document.getElementById('annBadge').value.trim();
  const active = document.getElementById('annActive').checked;

  if (!text) return showToast('Ralat', 'Sila masukkan teks.', 'error');

  showLoading('Menyimpan...');
  try {
    const { db, fs } = window.EMindCare;
    const data = {
      text,
      icon,
      badge: badge || null,
      active,
      createdAt: fs.serverTimestamp()
    };
    const ref = await fs.addDoc(fs.collection(db, 'announcements'), data);
    allAnnouncements.unshift({ id: ref.id, ...data });

    document.getElementById('announcementForm').reset();
    document.getElementById('annIcon').value = 'fa-bullhorn';
    document.getElementById('annActive').checked = true;

    renderAnnouncementList();
    hideLoading();
    showToast('Berjaya', 'Pengumuman ditambah.', 'success');
  } catch (err) {
    hideLoading();
    showToast('Gagal', err.message, 'error');
  }
}

function renderAnnouncementList() {
  const el = document.getElementById('announcementList');
  if (!allAnnouncements.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-bullhorn"></i><p>Belum ada pengumuman.</p></div>`;
    return;
  }
  el.innerHTML = allAnnouncements.map(a => `
    <div style="display:flex;align-items:center;gap:1rem;padding:1rem;border-radius:14px;border:1px solid var(--line);margin-bottom:0.6rem;background:#fff;transition:all 0.3s;">
      <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,var(--teal-light),var(--indigo-light));color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="fas ${a.icon || 'fa-bullhorn'}"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.88rem;font-weight:600;color:var(--ink);margin-bottom:0.15rem;">
          ${a.badge ? `<span class="role-badge kaunselor" style="margin-right:0.4rem;">${a.badge}</span>` : ''}
          ${escapeHtml(a.text)}
        </div>
        <div style="font-size:0.72rem;color:var(--ink-soft);">${a.active ? '🟢 Aktif' : '⚪ Tidak Aktif'}</div>
      </div>
      <label class="toggle-switch" style="margin-right:0.4rem;">
        <input type="checkbox" ${a.active ? 'checked' : ''} onchange="toggleAnnouncement('${a.id}', this.checked)">
        <span class="toggle-track" style="width:38px;height:22px;"></span>
      </label>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteAnnouncement('${a.id}')">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
}

window.toggleAnnouncement = async function(id, active) {
  try {
    const { db, fs } = window.EMindCare;
    await fs.updateDoc(fs.doc(db, 'announcements', id), { active });
    const a = allAnnouncements.find(x => x.id === id);
    if (a) a.active = active;
    showToast('Berjaya', active ? 'Pengumuman diaktifkan.' : 'Pengumuman dinyahaktifkan.', 'success', 2500);
  } catch (err) {
    showToast('Gagal', err.message, 'error');
  }
};

window.deleteAnnouncement = function(id) {
  showConfirmModal({
    title: 'Padam Pengumuman?',
    desc: 'Pengumuman ini akan dipadamkan secara kekal.',
    onConfirm: async () => {
      showLoading('Memadam...');
      try {
        const { db, fs } = window.EMindCare;
        await fs.deleteDoc(fs.doc(db, 'announcements', id));
        allAnnouncements = allAnnouncements.filter(x => x.id !== id);
        renderAnnouncementList();
        hideLoading();
        showToast('Berjaya', 'Pengumuman dipadam.', 'success');
      } catch (err) {
        hideLoading();
        showToast('Gagal', err.message, 'error');
      }
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   MODUL: UPLOAD HELPER
   ═══════════════════════════════════════════════════════════════ */
let pendingBannerUpload = null;
let pendingCollabUpload = null;

function initUploadZone(zoneId, inputId, onFile) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;

  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) onFile(file);
  });

  // Drag & drop
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

async function uploadFile(file, progressCallback) {
  const { CLOUDINARY_CONFIG } = window.EMindCare;
  const isVideo = file.type.startsWith('video/');
  const resourceType = isVideo ? 'video' : 'image';
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', CLOUDINARY_CONFIG.folder);

  // XMLHttpRequest untuk progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable && progressCallback) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressCallback(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error('Cloudinary upload gagal: ' + xhr.status));
      }
    };
    xhr.onerror = () => reject(new Error('Rangkaian gagal'));
    xhr.send(formData);
  });
}

/* ═══════════════════════════════════════════════════════════════
   MODUL: BANNERS
   ═══════════════════════════════════════════════════════════════ */
async function handleBannerFile(file) {
  // Validasi saiz (max 25MB)
  if (file.size > 25 * 1024 * 1024) {
    return showToast('Fail Terlalu Besar', 'Maksimum 25MB.', 'error');
  }

  const progressBox = document.getElementById('bannerProgress');
  const progressFill = document.getElementById('bannerProgressFill');
  const progressPct = document.getElementById('bannerProgressPct');
  const progressLabel = document.getElementById('bannerProgressLabel');

  progressBox.classList.add('active');
  progressLabel.textContent = `Memuat naik ${file.name}...`;
  progressFill.style.width = '0%';
  progressPct.textContent = '0%';

  try {
    const result = await uploadFile(file, pct => {
      progressFill.style.width = pct + '%';
      progressPct.textContent = pct + '%';
    });

    pendingBannerUpload = {
      mediaUrl: result.secure_url,
      mediaType: file.type.startsWith('video/') ? 'video' : 'image',
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height
    };

    progressLabel.textContent = '✓ Selesai dimuat naik';
    progressPct.textContent = '100%';
    progressFill.style.width = '100%';

    document.getElementById('bannerSaveBtn').disabled = false;
    showToast('Upload Berjaya', 'Klik "Simpan Banner" untuk teruskan.', 'success');

    // Auto-hide progress selepas 2s
    setTimeout(() => progressBox.classList.remove('active'), 2000);

  } catch (err) {
    progressBox.classList.remove('active');
    showToast('Upload Gagal', err.message, 'error', 6000);
  }
}

async function saveBannerToFirestore() {
  if (!pendingBannerUpload) return showToast('Ralat', 'Sila upload fail dahulu.', 'warning');

  const title = document.getElementById('bannerTitle').value.trim();
  const badge = document.getElementById('bannerBadge').value.trim();
  const subtitle = document.getElementById('bannerSubtitle').value.trim();
  const link = document.getElementById('bannerLink').value.trim();

  showLoading('Menyimpan banner...');
  try {
    const { db, fs } = window.EMindCare;
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
      createdAt: fs.serverTimestamp(),
      createdBy: currentUser.uid
    };

    const ref = await fs.addDoc(fs.collection(db, 'banners'), data);
    allBanners.push({ id: ref.id, ...data });

    resetBannerForm();
    renderBannerGrid();
    renderStats();
    hideLoading();
    showToast('Berjaya', 'Banner berjaya disimpan.', 'success');
  } catch (err) {
    hideLoading();
    showToast('Gagal', err.message, 'error');
  }
}

window.resetBannerForm = function() {
  pendingBannerUpload = null;
  document.getElementById('bannerTitle').value = '';
  document.getElementById('bannerBadge').value = '';
  document.getElementById('bannerSubtitle').value = '';
  document.getElementById('bannerLink').value = '';
  document.getElementById('bannerFileInput').value = '';
  document.getElementById('bannerSaveBtn').disabled = true;
  document.getElementById('bannerProgress').classList.remove('active');
};

function renderBannerGrid() {
  const grid = document.getElementById('bannerGrid');
  document.getElementById('bannerCountText').textContent = `${allBanners.length} banner`;

  if (!allBanners.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <i class="fas fa-images"></i>
      <p>Belum ada banner.</p>
    </div>`;
    return;
  }

  grid.innerHTML = allBanners.map(b => `
    <div class="media-item">
      ${b.mediaType === 'video'
        ? `<video src="${b.mediaUrl}" muted preload="metadata"></video>`
        : `<img src="${b.mediaUrl}" alt="${b.text || ''}" loading="lazy">`
      }
      <span class="media-type-badge ${b.mediaType}">${b.mediaType}</span>
      <div class="media-item-overlay">
        <div class="media-item-title">${escapeHtml(b.text || 'Tanpa Tajuk')}</div>
        <div class="media-item-actions">
          <button class="btn-del" onclick="deleteBanner('${b.id}')">
            <i class="fas fa-trash"></i> Padam
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

window.deleteBanner = function(id) {
  showConfirmModal({
    title: 'Padam Banner?',
    desc: 'Banner akan dipadamkan dari landing page.',
    onConfirm: async () => {
      showLoading('Memadam...');
      try {
        const { db, fs } = window.EMindCare;
        await fs.deleteDoc(fs.doc(db, 'banners', id));
        allBanners = allBanners.filter(x => x.id !== id);
        renderBannerGrid();
        hideLoading();
        showToast('Berjaya', 'Banner dipadam.', 'success');
      } catch (err) {
        hideLoading();
        showToast('Gagal', err.message, 'error');
      }
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   MODUL: COLLABORATIONS
   ═══════════════════════════════════════════════════════════════ */
async function handleCollabFile(file) {
  if (file.size > 10 * 1024 * 1024) return showToast('Fail Terlalu Besar', 'Maksimum 10MB.', 'error');

  const progressBox = document.getElementById('collabProgress');
  const progressFill = document.getElementById('collabProgressFill');
  const progressPct = document.getElementById('collabProgressPct');
  const progressLabel = document.getElementById('collabProgressLabel');

  progressBox.classList.add('active');
  progressLabel.textContent = `Memuat naik ${file.name}...`;
  progressFill.style.width = '0%';

  try {
    const result = await uploadFile(file, pct => {
      progressFill.style.width = pct + '%';
      progressPct.textContent = pct + '%';
    });

    pendingCollabUpload = {
      logoUrl: result.secure_url,
      publicId: result.public_id
    };

    progressLabel.textContent = '✓ Selesai dimuat naik';
    progressPct.textContent = '100%';
    progressFill.style.width = '100%';

    document.getElementById('collabSaveBtn').disabled = false;
    showToast('Upload Berjaya', 'Klik "Simpan Logo" untuk teruskan.', 'success');

    setTimeout(() => progressBox.classList.remove('active'), 2000);
  } catch (err) {
    progressBox.classList.remove('active');
    showToast('Upload Gagal', err.message, 'error', 6000);
  }
}

async function saveCollabToFirestore() {
  if (!pendingCollabUpload) return showToast('Ralat', 'Sila upload logo dahulu.', 'warning');
  const name = document.getElementById('collabName').value.trim();
  const link = document.getElementById('collabLink').value.trim();
  if (!name) return showToast('Ralat', 'Sila masukkan nama rakan.', 'error');

  showLoading('Menyimpan...');
  try {
    const { db, fs } = window.EMindCare;
    const data = {
      name,
      logoUrl: pendingCollabUpload.logoUrl,
      publicId: pendingCollabUpload.publicId,
      linkUrl: link || null,
      order: allCollabs.length + 1,
      createdAt: fs.serverTimestamp(),
      createdBy: currentUser.uid
    };

    const ref = await fs.addDoc(fs.collection(db, 'collaborations'), data);
    allCollabs.push({ id: ref.id, ...data });

    resetCollabForm();
    renderCollabGrid();
    hideLoading();
    showToast('Berjaya', 'Logo kolaborasi disimpan.', 'success');
  } catch (err) {
    hideLoading();
    showToast('Gagal', err.message, 'error');
  }
}

window.resetCollabForm = function() {
  pendingCollabUpload = null;
  document.getElementById('collabName').value = '';
  document.getElementById('collabLink').value = '';
  document.getElementById('collabFileInput').value = '';
  document.getElementById('collabSaveBtn').disabled = true;
  document.getElementById('collabProgress').classList.remove('active');
};

function renderCollabGrid() {
  const grid = document.getElementById('collabGrid');
  document.getElementById('collabCountText').textContent = `${allCollabs.length} logo`;

  if (!allCollabs.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <i class="fas fa-handshake"></i>
      <p>Belum ada logo kolaborasi.</p>
    </div>`;
    return;
  }

  grid.innerHTML = allCollabs.map(c => `
    <div class="media-item" style="background:#fff;padding:1rem;display:flex;align-items:center;justify-content:center;">
      <img src="${c.logoUrl}" alt="${c.name || ''}" style="max-width:100%;max-height:100%;object-fit:contain;width:auto;height:auto;" loading="lazy">
      <span class="media-type-badge image">Logo</span>
      <div class="media-item-overlay">
        <div class="media-item-title">${escapeHtml(c.name || '')}</div>
        <div class="media-item-actions">
          <button class="btn-del" onclick="deleteCollab('${c.id}')">
            <i class="fas fa-trash"></i> Padam
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

window.deleteCollab = function(id) {
  showConfirmModal({
    title: 'Padam Logo?',
    desc: 'Logo ini akan dipadamkan dari landing page.',
    onConfirm: async () => {
      showLoading('Memadam...');
      try {
        const { db, fs } = window.EMindCare;
        await fs.deleteDoc(fs.doc(db, 'collaborations', id));
        allCollabs = allCollabs.filter(x => x.id !== id);
        renderCollabGrid();
        hideLoading();
        showToast('Berjaya', 'Logo dipadam.', 'success');
      } catch (err) {
        hideLoading();
        showToast('Gagal', err.message, 'error');
      }
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   MODUL: APPOINTMENTS
   ═══════════════════════════════════════════════════════════════ */
function renderApptTable() {
  const tbody = document.getElementById('apptTableBody');
  const searchTerm = (document.getElementById('apptSearch')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('apptFilterStatus')?.value || '';

  let filtered = allAppointments;
  if (statusFilter) filtered = filtered.filter(a => a.status === statusFilter);
  if (searchTerm) {
    filtered = filtered.filter(a =>
      (a.studentName || '').toLowerCase().includes(searchTerm)
    );
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="4">
      <div class="empty-state">
        <i class="fas fa-calendar-xmark"></i>
        <p>Tiada temujanji ditemui.</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const dateStr = a.appointmentDate
      ? new Date(a.appointmentDate).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-';
    const timeStr = a.appointmentTime || '';
    return `
    <tr>
      <td>
        <div class="user-cell">
          <div class="user-avatar">${(a.studentName || 'U').charAt(0).toUpperCase()}</div>
          <div class="user-info">
            <strong>${a.studentName || 'Tanpa Nama'}</strong>
            <span>${a.reason || 'Kaunseling'}</span>
          </div>
        </div>
      </td>
      <td style="font-size:0.82rem;">
        <div style="font-weight:600;">${dateStr}</div>
        <div style="color:var(--ink-soft);font-size:0.75rem;">${timeStr}</div>
      </td>
      <td><span class="status-badge ${a.status || 'pending'}">${getStatusLabel(a.status)}</span></td>
      <td>
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="openApptModal('${a.id}')" title="Urus">
            <i class="fas fa-edit"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

window.openApptModal = function(id) {
  const a = allAppointments.find(x => x.id === id);
  if (!a) return;
  editingApptId = id;
  document.getElementById('apptModalDesc').textContent =
    `${a.studentName || ''} · ${a.reason || 'Kaunseling'}`;
  document.getElementById('apptStatusUpdate').value = a.status || 'pending';
  document.getElementById('apptNotes').value = a.notes || '';
  document.getElementById('apptModal').classList.add('active');
};

window.closeApptModal = function() {
  document.getElementById('apptModal').classList.remove('active');
  editingApptId = null;
};

async function saveApptUpdate() {
  if (!editingApptId) return;
  const status = document.getElementById('apptStatusUpdate').value;
  const notes = document.getElementById('apptNotes').value.trim();

  showLoading('Menyimpan...');
  try {
    const { db, fs } = window.EMindCare;
    await fs.updateDoc(fs.doc(db, 'appointments', editingApptId), {
      status,
      notes: notes || null,
      updatedAt: fs.serverTimestamp()
    });

    const idx = allAppointments.findIndex(x => x.id === editingApptId);
    if (idx >= 0) allAppointments[idx] = { ...allAppointments[idx], status, notes };

    closeApptModal();
    renderApptTable();
    renderRecentActivity();
    updatePendingBadge();
    hideLoading();
    showToast('Berjaya', 'Temujanji dikemaskini.', 'success');
  } catch (err) {
    hideLoading();
    showToast('Gagal', err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   BRANDING FROM FIRESTORE
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
   UTILS
   ═══════════════════════════════════════════════════════════════ */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

console.log(
  "%c 🎛️ Dashboard Kaunselor ",
  "background:linear-gradient(135deg,#0F766E,#4F46E5,#06B6D4);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Ready · e-MindCare v2");