/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Sunting Laman (Landing)
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

const SESSION_KEY = 'emindcare_session';
const SITE_CONFIG_DOC = ['siteConfig', 'main'];

let currentUser = null;
let originalData = {};
let pendingConfirmAction = null;

/* INIT */
window.addEventListener('load', async () => {
  await waitForEMindCare();
  if (!authGuard()) return;
  await waitForSidebar();
  populateSidebarProfile();
  await loadLandingData();
  bindEvents();
});

function waitForEMindCare() {
  return new Promise((resolve, reject) => {
    if (window.EMindCare) return resolve();
    let tries = 0;
    const t = setInterval(() => {
      if (window.EMindCare) { clearInterval(t); resolve(); }
      else if (++tries > 100) { clearInterval(t); reject(new Error('SDK timeout')); }
    }, 50);
  });
}

function waitForSidebar() {
  return new Promise(resolve => {
    if (document.getElementById('sbProfileName')) return resolve();
    const obs = new MutationObserver(() => {
      if (document.getElementById('sbProfileName')) {
        obs.disconnect();
        resolve();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); resolve(); }, 3000);
  });
}

function authGuard() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) { window.location.href = 'login.html'; return false; }
  try {
    const session = JSON.parse(raw);
    if (session.role !== 'kaunselor') {
      window.location.href = 'login.html';
      return false;
    }
    currentUser = session;
    return true;
  } catch {
    window.location.href = 'login.html';
    return false;
  }
}

function populateSidebarProfile() {
  const nameEl = document.getElementById('sbProfileName');
  const avatarEl = document.getElementById('sbAvatar');
  if (nameEl) nameEl.textContent = currentUser.fullName || 'Kaunselor';
  if (avatarEl) {
    if (currentUser.avatarUrl) {
      avatarEl.innerHTML = `<img src="${currentUser.avatarUrl}" alt="">`;
    } else {
      avatarEl.textContent = (currentUser.fullName || 'K').charAt(0).toUpperCase();
    }
  }
}

/* LOAD DATA */
async function loadLandingData() {
  try {
    const { db, fs } = window.EMindCare;
    const snap = await fs.getDoc(fs.doc(db, SITE_CONFIG_DOC[0], SITE_CONFIG_DOC[1]));

    if (snap.exists()) {
      const data = snap.data();
      originalData = JSON.parse(JSON.stringify(data));

      if (data.branding) {
        document.getElementById('siteName').value = data.branding.name || '';
        document.getElementById('siteTagline').value = data.branding.tagline || '';
        if (data.branding.logoUrl) {
          document.getElementById('logoPreviewBox').innerHTML =
            `<img src="${data.branding.logoUrl}" alt="">`;
          document.getElementById('logoPreviewBox').dataset.url = data.branding.logoUrl;
        }
        if (data.branding.faviconUrl) {
          document.getElementById('faviconPreviewBox').innerHTML =
            `<img src="${data.branding.faviconUrl}" alt="">`;
          document.getElementById('faviconPreviewBox').dataset.url = data.branding.faviconUrl;
        }
      }

      if (data.hero) {
        document.getElementById('heroTitle').value = data.hero.title || '';
        document.getElementById('heroSubtitle').value = data.hero.subtitle || '';
        document.getElementById('heroCtaText').value = data.hero.cta1Text || '';
        document.getElementById('heroBadge').value = data.hero.badge || '';
      }

      if (data.visiMisi) {
        document.getElementById('visi').value = data.visiMisi.visi || '';
        document.getElementById('misi').value = data.visiMisi.misi || '';
      }

      if (data.contact) {
        const c = data.contact;
        document.getElementById('contactPhone').value = c.phone || '';
        document.getElementById('contactEmail').value = c.email || '';
        document.getElementById('contactAddress').value = c.address || '';
        document.getElementById('contactHours').value = c.hours || '';
        document.getElementById('contactMapUrl').value = c.mapUrl || '';
        document.getElementById('socialFacebook').value = c.facebook || '';
        document.getElementById('socialInstagram').value = c.instagram || '';
        document.getElementById('socialTiktok').value = c.tiktok || '';
        document.getElementById('socialYoutube').value = c.youtube || '';
      }

      updateCounters();
    }
  } catch (err) {
    console.error('Load error:', err);
    showToast('Ralat', 'Gagal memuat: ' + err.message, 'error');
  }
}

/* BIND EVENTS */
function bindEvents() {
  ['heroSubtitle', 'visi', 'misi'].forEach(id => {
    const el = document.getElementById(id);
    const counterId = id === 'heroSubtitle' ? 'heroSubCounter' : id + 'Counter';
    const counter = document.getElementById(counterId);
    if (el && counter) {
      el.addEventListener('input', () => updateCounter(el, counter));
    }
  });

  document.getElementById('landingForm').addEventListener('input', markDirty);
  document.getElementById('landingForm').addEventListener('submit', handleSave);

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset semua perubahan? Semua perubahan yang belum disimpan akan hilang.')) {
      location.reload();
    }
  });

  document.querySelectorAll('.side-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(item.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.querySelectorAll('.side-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });

  const sections = document.querySelectorAll('.form-section');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        document.querySelectorAll('.side-nav-item').forEach(i => {
          i.classList.toggle('active', i.dataset.target === id);
        });
      }
    });
  }, { threshold: 0.3 });
  sections.forEach(s => observer.observe(s));

  document.getElementById('logoInput').addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0], 'logo');
  });
  document.getElementById('faviconInput').addEventListener('change', (e) => {
    handleImageUpload(e.target.files[0], 'favicon');
  });
}

function updateCounters() {
  ['heroSubtitle', 'visi', 'misi'].forEach(id => {
    const el = document.getElementById(id);
    const counterId = id === 'heroSubtitle' ? 'heroSubCounter' : id + 'Counter';
    const counter = document.getElementById(counterId);
    if (el && counter) updateCounter(el, counter);
  });
}

function updateCounter(el, counter) {
  const len = el.value.length;
  const max = parseInt(el.getAttribute('maxlength')) || 500;
  counter.textContent = `${len} / ${max}`;
  counter.classList.remove('warn', 'limit');
  if (len >= max) counter.classList.add('limit');
  else if (len >= max * 0.85) counter.classList.add('warn');
}

function markDirty() {
  document.getElementById('saveBtn').disabled = false;
  document.getElementById('statusDot').classList.add('dirty');
  document.getElementById('statusText').textContent = 'Ada perubahan belum disimpan';
}

/* IMAGE UPLOAD */
async function handleImageUpload(file, type) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Ralat', 'Sila pilih fail gambar sahaja.', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Ralat', 'Saiz gambar maksimum 5MB.', 'error');
    return;
  }

  const previewBox = document.getElementById(type === 'logo' ? 'logoPreviewBox' : 'faviconPreviewBox');
  const reader = new FileReader();
  reader.onload = (e) => { previewBox.innerHTML = `<img src="${e.target.result}" alt="">`; };
  reader.readAsDataURL(file);

  const progressEl = document.getElementById('uploadProgress1');
  progressEl.classList.add('active');

  try {
    const { CLOUDINARY_CONFIG } = window.EMindCare;
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('folder', `${CLOUDINARY_CONFIG.folder}/branding`);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        document.getElementById('uploadFill1').style.width = pct + '%';
        document.getElementById('uploadPct1').textContent = pct + '%';
        document.getElementById('uploadLabel1').textContent = `Memuat naik ${type}...`;
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const res = JSON.parse(xhr.responseText);
        previewBox.dataset.url = res.secure_url;
        markDirty();
        setTimeout(() => progressEl.classList.remove('active'), 1000);
        showToast('Berjaya', `${type === 'logo' ? 'Logo' : 'Favicon'} dimuat naik. Klik Simpan untuk kekalkan.`, 'success');
      } else {
        progressEl.classList.remove('active');
        showToast('Ralat', 'Gagal upload.', 'error');
      }
    };
    xhr.onerror = () => {
      progressEl.classList.remove('active');
      showToast('Ralat', 'Gagal upload.', 'error');
    };
    xhr.send(formData);
  } catch (err) {
    progressEl.classList.remove('active');
    showToast('Ralat', err.message, 'error');
  }
}

window.clearImage = function(type) {
  const box = document.getElementById(type === 'logo' ? 'logoPreviewBox' : 'faviconPreviewBox');
  box.innerHTML = `<span class="placeholder-icon"><i class="fas fa-image"></i></span>`;
  delete box.dataset.url;
  markDirty();
};

/* SAVE */
async function handleSave(e) {
  e.preventDefault();
  const btn = document.getElementById('saveBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const { db, fs } = window.EMindCare;
    const logoBox = document.getElementById('logoPreviewBox');
    const faviconBox = document.getElementById('faviconPreviewBox');

    const data = {
      branding: {
        name: document.getElementById('siteName').value.trim(),
        tagline: document.getElementById('siteTagline').value.trim(),
        logoUrl: logoBox.dataset.url || (logoBox.querySelector('img')?.src || ''),
        faviconUrl: faviconBox.dataset.url || (faviconBox.querySelector('img')?.src || ''),
        updatedAt: fs.serverTimestamp()
      },
      hero: {
        title: document.getElementById('heroTitle').value.trim(),
        subtitle: document.getElementById('heroSubtitle').value.trim(),
        cta1Text: document.getElementById('heroCtaText').value.trim(),
        badge: document.getElementById('heroBadge').value.trim()
      },
      visiMisi: {
        visi: document.getElementById('visi').value.trim(),
        misi: document.getElementById('misi').value.trim()
      },
      contact: {
        phone: document.getElementById('contactPhone').value.trim(),
        email: document.getElementById('contactEmail').value.trim(),
        address: document.getElementById('contactAddress').value.trim(),
        hours: document.getElementById('contactHours').value.trim(),
        mapUrl: document.getElementById('contactMapUrl').value.trim(),
        facebook: document.getElementById('socialFacebook').value.trim(),
        instagram: document.getElementById('socialInstagram').value.trim(),
        tiktok: document.getElementById('socialTiktok').value.trim(),
        youtube: document.getElementById('socialYoutube').value.trim()
      },
      lastUpdated: fs.serverTimestamp(),
      updatedBy: currentUser.fullName || 'kaunselor'
    };

    await fs.setDoc(
      fs.doc(db, SITE_CONFIG_DOC[0], SITE_CONFIG_DOC[1]),
      data,
      { merge: true }
    );

    originalData = JSON.parse(JSON.stringify(data));
    document.getElementById('statusDot').classList.remove('dirty');
    document.getElementById('statusText').textContent = 'Semua perubahan disimpan';
    showToast('Berjaya', 'Perubahan disimpan. Laman utama akan dikemas kini.', 'success');
  } catch (err) {
    console.error('Save error:', err);
    showToast('Ralat', 'Gagal simpan: ' + err.message, 'error');
    btn.disabled = false;
  } finally {
    btn.classList.remove('loading');
  }
}

/* MODAL */
window.closeConfirmModal = function() {
  document.getElementById('confirmModal').classList.remove('active');
  pendingConfirmAction = null;
};

/* TOAST */
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
  "%c 🎨 Sunting Laman ",
  "background:linear-gradient(135deg,#0F766E,#4F46E5,#06B6D4);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
