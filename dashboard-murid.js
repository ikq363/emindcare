/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Dashboard Murid Script
   Logik: Profile + Avatar Upload + Appointment List
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const CURRENT_SESSION_YEAR = new Date().getFullYear().toString();

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let currentUser = null;
let profileData = null;

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  await waitForEMindCare();
  if (!authGuard()) return;
  initUI();
  applyBranding();
  await loadProfile();
  await loadAppointments();
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
    if (session.role !== 'murid') {
      const redirects = { kaunselor: 'dashboard-kaunselor.html', guru: 'dashboard-guru.html' };
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
   INIT UI
   ═══════════════════════════════════════════════════════════════ */
function initUI() {
  // Avatar upload
  document.getElementById('avatarInput').addEventListener('change', handleAvatarUpload);
}

/* ═══════════════════════════════════════════════════════════════
   APPLY BRANDING
   ═══════════════════════════════════════════════════════════════ */
async function applyBranding() {
  try {
    const cfg = await window.EMindCare.getSiteConfig();
    if (!cfg?.branding) return;
    const b = cfg.branding;
    if (b.name) {
      document.getElementById('tbBrandName').textContent = b.name;
      document.title = 'Dashboard Murid · ' + b.name;
    }
    if (b.tagline) {
      document.getElementById('tbBrandTagline').textContent = b.tagline;
    }
    if (b.logoUrl) {
      document.getElementById('tbLogo').innerHTML = `<img src="${b.logoUrl}" alt="">`;
    } else if (b.logoIcon) {
      document.getElementById('tbLogo').innerHTML = `<i class="${b.logoIcon}"></i>`;
    }
    if (b.primaryColor) document.documentElement.style.setProperty('--teal', b.primaryColor);
    if (b.accentColor) document.documentElement.style.setProperty('--indigo', b.accentColor);
  } catch (e) { /* ignore */ }
}

/* ═══════════════════════════════════════════════════════════════
   LOAD PROFILE
   ═══════════════════════════════════════════════════════════════ */
async function loadProfile() {
  try {
    const { db, fs } = window.EMindCare;
    const { doc, getDoc } = fs;

    const docRef = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      showToast('Ralat', 'Data profil tidak dijumpai.', 'error');
      return;
    }

    profileData = { id: snap.id, ...snap.data() };
    renderProfile(profileData);

    // Update localStorage dengan data terkini
    const updatedSession = {
      ...currentUser,
      fullName: profileData.fullName,
      class: profileData.class,
      avatarUrl: profileData.profileImage || profileData.avatarUrl || null
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));

  } catch (err) {
    console.error('Load profile error:', err);
    showToast('Ralat', 'Gagal memuatkan profil: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   RENDER PROFILE
   ═══════════════════════════════════════════════════════════════ */
function renderProfile(data) {
  const name = data.fullName || 'Murid';
  const firstName = name.split(' ')[0];
  const initial = name.charAt(0).toUpperCase();

  // Greeting
  const hour = new Date().getHours();
  let greeting = 'Selamat Datang! 👋';
  let sub = 'Semoga hari anda ceria dan produktif.';
  if (hour >= 12 && hour < 15) {
    greeting = `Selamat Tengah Hari, ${firstName}! ☀️`;
    sub = 'Jangan lupa makan tengah hari.';
  } else if (hour >= 15 && hour < 19) {
    greeting = `Selamat Petang, ${firstName}! 🌤️`;
    sub = 'Semoga hari anda berjalan lancar.';
  } else if (hour >= 19 || hour < 5) {
    greeting = `Selamat Malam, ${firstName}! 🌙`;
    sub = 'Jangan lupa rehat secukupnya.';
  } else {
    greeting = `Selamat Pagi, ${firstName}! 🌅`;
    sub = 'Mula hari ini dengan semangat baru.';
  }

  document.getElementById('greetingTitle').textContent = greeting;
  document.getElementById('greetingSubtitle').textContent = sub;

  // Avatar
  const avatarEl = document.getElementById('profileAvatar');
  const avatarUrl = data.profileImage || data.avatarUrl || null;

  if (avatarUrl) {
    avatarEl.innerHTML = `
      <img src="${avatarUrl}" alt="${escapeHtml(name)}">
      <label class="profile-avatar-overlay" for="avatarInput">
        <i class="fas fa-camera"></i>
        <span>Tukar</span>
      </label>`;
    // Re-attach file input supaya kekal boleh klik
    const input = document.getElementById('avatarInput');
    input.style.display = 'none';
    avatarEl.parentElement.appendChild(input);
  } else {
    avatarEl.innerHTML = `
      <span id="avatarText">${initial}</span>
      <label class="profile-avatar-overlay" for="avatarInput">
        <i class="fas fa-camera"></i>
        <span>Tukar</span>
      </label>`;
  }

  // Profile name & info
  document.getElementById('profileName').textContent = name;
  document.getElementById('infoName').textContent = name;
  document.getElementById('infoIC').textContent = data.icNumber || '—';
  document.getElementById('infoClass').textContent = data.class || '—';
  document.getElementById('infoSession').textContent = data.sessionYear || CURRENT_SESSION_YEAR;
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

  // Optimistic preview
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
          <span>Tukar</span>
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
    const result = await uploadWithProgress(file, {
      resourceType: 'image',
      folder: `${window.EMindCare.CLOUDINARY_CONFIG.folder}/murid-profiles`,
      onProgress: (pct) => {
        fillEl.style.width = pct + '%';
        pctEl.textContent = pct + '%';
      }
    });

    // Save to Firestore
    const { db, fs } = window.EMindCare;
    await fs.updateDoc(fs.doc(db, 'users', currentUser.uid), {
      profileImage: result.secure_url,
      updatedAt: fs.serverTimestamp()
    });

    // Update local session
    const updatedSession = { ...currentUser, avatarUrl: result.secure_url };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));

    // Update profileData
    if (profileData) profileData.profileImage = result.secure_url;

    labelEl.textContent = '✓ Selesai!';
    pctEl.textContent = '100%';
    fillEl.style.width = '100%';

    setTimeout(() => progressEl.classList.remove('active'), 1500);
    showToast('Berjaya!', 'Gambar profil berjaya dikemas kini.', 'success');

  } catch (err) {
    console.error('Upload error:', err);
    progressEl.classList.remove('active');
    showToast('Upload Gagal', err.message, 'error');

    // Revert preview
    if (profileData?.profileImage) {
      document.getElementById('profileAvatar').querySelector('img').src = profileData.profileImage;
    }
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
   LOAD APPOINTMENTS
   ═══════════════════════════════════════════════════════════════ */
async function loadAppointments() {
  try {
    const { db, fs } = window.EMindCare;
    const { collection, query, where, getDocs } = fs;

    const userIC = currentUser.icNumber || profileData?.icNumber;
    if (!userIC) {
      renderAppointments([]);
      return;
    }

    // Query by studentIc
    const q = query(
      collection(db, 'appointments'),
      where('studentIc', '==', userIC)
    );
    const snap = await getDocs(q);
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));

    // Fallback: query by studentUid
    if (!items.length) {
      try {
        const q2 = query(
          collection(db, 'appointments'),
          where('studentUid', '==', currentUser.uid)
        );
        const snap2 = await getDocs(q2);
        snap2.forEach(d => items.push({ id: d.id, ...d.data() }));
      } catch (e) { /* ignore */ }
    }

    // Sort by date desc
    items.sort((a, b) => {
      const at = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bt = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return bt - at;
    });

    renderAppointments(items);

  } catch (err) {
    console.error('Load appointments error:', err);
    renderAppointments([]);
  }
}

/* ═══════════════════════════════════════════════════════════════
   RENDER APPOINTMENTS
   ═══════════════════════════════════════════════════════════════ */
function renderAppointments(items) {
  const list = document.getElementById('apptList');

  if (!items.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <i class="fas fa-calendar-plus"></i>
        </div>
        <strong>Belum Ada Tempahan</strong>
        <p>Anda belum membuat sebarang tempahan sesi kaunseling. Mulakan dengan menekan butang di bawah.</p>
        <a href="tempah-kaunseling.html" class="btn">
          <i class="fas fa-plus"></i>
          Buat Tempahan Pertama
        </a>
      </div>`;
    return;
  }

  const statusLabels = {
    pending: 'Menunggu',
    approved: 'Diluluskan',
    completed: 'Selesai',
    rejected: 'Ditolak'
  };
  const statusIcons = {
    pending: 'fa-hourglass-half',
    approved: 'fa-check-circle',
    completed: 'fa-flag-checkered',
    rejected: 'fa-times-circle'
  };

  list.innerHTML = items.slice(0, 8).map(item => {
    const status = item.status || 'pending';
    const dateStr = item.appointmentDate
      ? parseDateForDisplay(item.appointmentDate)
      : parseDateFromCreatedAt(item.createdAt);
    const reason = item.reason || item.subject || 'Sesi Kaunseling';
    const counselor = item.counselorName || 'Kaunselor UBK';
    const time = item.appointmentTime || '';

    return `
      <a href="tempah-kaunseling.html" class="appt-item">
        <div class="appt-date-box">
          <span class="day">${dateStr.day}</span>
          <span class="month">${dateStr.month}</span>
        </div>

        <div class="appt-info">
          <strong>${escapeHtml(reason)}</strong>
          <span>
            <i class="fas fa-user-tie"></i> ${escapeHtml(counselor)}
            ${time ? `· <i class="fas fa-clock"></i> ${escapeHtml(time)}` : ''}
          </span>
        </div>

        <span class="appt-status ${status}">
          <i class="fas ${statusIcons[status]}"></i>
          ${statusLabels[status]}
        </span>

        <div class="appt-arrow">
          <i class="fas fa-chevron-right"></i>
        </div>
      </a>
    `;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   DATE HELPERS
   ═══════════════════════════════════════════════════════════════ */
function parseDateForDisplay(dateStr) {
  const months = ['JAN', 'FEB', 'MAC', 'APR', 'MEI', 'JUN', 'JUL', 'OGO', 'SEP', 'OKT', 'NOV', 'DIS'];
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { day: '—', month: '—' };
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: months[d.getMonth()]
    };
  } catch {
    return { day: '—', month: '—' };
  }
}

function parseDateFromCreatedAt(timestamp) {
  const months = ['JAN', 'FEB', 'MAC', 'APR', 'MEI', 'JUN', 'JUL', 'OGO', 'SEP', 'OKT', 'NOV', 'DIS'];
  try {
    const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(d.getTime())) return { day: '—', month: '—' };
    return {
      day: String(d.getDate()).padStart(2, '0'),
      month: months[d.getMonth()]
    };
  } catch {
    return { day: '—', month: '—' };
  }
}

/* ═══════════════════════════════════════════════════════════════
   LOGOUT
   ═══════════════════════════════════════════════════════════════ */
window.confirmLogout = function() {
  document.getElementById('confirmModal').classList.add('active');
};

window.closeConfirmModal = function() {
  document.getElementById('confirmModal').classList.remove('active');
};

window.doLogout = function() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'login.html';
};

// Close modal bila klik luar
document.getElementById('confirmModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeConfirmModal();
});

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
  "%c 👨‍🎓 Dashboard Murid ",
  "background:linear-gradient(135deg,#0F766E,#4F46E5,#06B6D4);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Ready · v2.0");