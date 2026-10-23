/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Sunting Laman (Landing) — v2.0 FIXED
   Fix: sidebar race condition, data mapping, debug logs
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

const DEBUG = true;
const log = (...a) => DEBUG && console.log('[Landing]', ...a);
const warn = (...a) => DEBUG && console.warn('[Landing]', ...a);
const err = (...a) => console.error('[Landing]', ...a);

log('✅ dashboard-landing.js LOADED');

const SESSION_KEY = 'emindcare_session';
const SITE_CONFIG_DOC = ['siteConfig', 'main'];

let currentUser = null;
let originalData = {};

/* ═══════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  log('📄 Window loaded');

  try {
    await waitForEMindCare();
    log('✅ EMindCare available');

    if (!authGuard()) {
      log('❌ Auth guard failed');
      return;
    }
    log('✅ Auth OK:', currentUser.fullName);

    // ⭐ KUNCI UTAMA: Tunggu sidebar siap INJECT dulu
    await waitForSidebar();
    log('✅ Sidebar injected');

    // Populate profile ke sidebar
    populateSidebarProfile();

    // Load data dari Firestore
    await loadLandingData();

    // Bind events
    bindEvents();
    log('✅ Events bound');

    log('🎉 INIT COMPLETE');

  } catch (e) {
    err('💥 INIT FAILED:', e);
    showToast('Ralat Sistem', e.message, 'error');
  }
});

/* ═══════════════════════════════════════════════════
   WAIT HELPERS
   ═══════════════════════════════════════════════════ */
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
    if (document.getElementById('sbProfileName')) {
      log('Sidebar already injected');
      return resolve();
    }
    log('⏳ Waiting for sidebar inject...');
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (document.getElementById('sbProfileName')) {
        clearInterval(t);
        log(`Sidebar ready after ${tries} tries`);
        resolve();
      } else if (tries > 60) {
        clearInterval(t);
        warn('Sidebar timeout — continuing anyway');
        resolve();
      }
    }, 50);
  });
}

/* ═══════════════════════════════════════════════════
   AUTH GUARD
   ═══════════════════════════════════════════════════ */
function authGuard() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) { window.location.href = 'login.html'; return false; }
  try {
    const session = JSON.parse(raw);
    if (session.role !== 'kaunselor') {
      const redirects = { murid: 'dashboard-murid.html', guru: 'dashboard-guru.html' };
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

/* ═══════════════════════════════════════════════════
   POPULATE SIDEBAR PROFILE
   ═══════════════════════════════════════════════════ */
function populateSidebarProfile() {
  if (!currentUser) {
    warn('No currentUser to populate sidebar');
    return;
  }

  const nameEl = document.getElementById('sbProfileName');
  const avatarEl = document.getElementById('sbAvatar');
  const brandEl = document.getElementById('sbBrandName');
  const logoEl = document.getElementById('sbLogo');

  if (nameEl) {
    nameEl.textContent = currentUser.fullName || 'Kaunselor';
    log('✅ Sidebar name:', nameEl.textContent);
  } else {
    warn('❌ #sbProfileName not found');
  }

  if (avatarEl) {
    if (currentUser.avatarUrl) {
      avatarEl.innerHTML = `<img src="${currentUser.avatarUrl}" alt="">`;
    } else {
      avatarEl.textContent = (currentUser.fullName || 'K').charAt(0).toUpperCase();
    }
    log('✅ Sidebar avatar populated');
  } else {
    warn('❌ #sbAvatar not found');
  }

  // Try apply branding ke sidebar
  applyBrandingToSidebar();
}

async function applyBrandingToSidebar() {
  try {
    const cfg = await window.EMindCare.getSiteConfig();
    if (!cfg?.branding) return;

    const b = cfg.branding;
    const brandEl = document.getElementById('sbBrandName');
    const logoEl = document.getElementById('sbLogo');

    if (b.name && brandEl) brandEl.textContent = b.name;

    if (logoEl) {
      if (b.logoUrl) {
        logoEl.innerHTML = `<img src="${b.logoUrl}" alt="">`;
      } else if (b.logoIcon) {
        logoEl.innerHTML = `<i class="${b.logoIcon}"></i>`;
      }
    }
  } catch (e) {
    warn('Branding error:', e.message);
  }
}

/* ═══════════════════════════════════════════════════
   LOAD DATA DARI FIRESTORE
   ═══════════════════════════════════════════════════ */
async function loadLandingData() {
  log('📥 Loading landing data...');

  try {
    const { db, fs } = window.EMindCare;
    const snap = await fs.getDoc(fs.doc(db, SITE_CONFIG_DOC[0], SITE_CONFIG_DOC[1]));

    if (!snap.exists()) {
      warn('⚠️ siteConfig/main does not exist — form will be empty');
      return;
    }

    const data = snap.data();
    originalData = JSON.parse(JSON.stringify(data));
    log('📦 Data loaded:', Object.keys(data));

    // ─── BRANDING ───
    if (data.branding) {
      const b = data.branding;
      setValue('siteName', b.name);
      setValue('siteTagline', b.tagline);

      if (b.logoUrl) {
        const box = document.getElementById('logoPreviewBox');
        if (box) {
          box.innerHTML = `<img src="${b.logoUrl}" alt="Logo">`;
          box.dataset.url = b.logoUrl;
        }
      }
      if (b.faviconUrl) {
        const box = document.getElementById('faviconPreviewBox');
        if (box) {
          box.innerHTML = `<img src="${b.faviconUrl}" alt="Favicon">`;
          box.dataset.url = b.faviconUrl;
        }
      }
      log('✅ Branding loaded');
    } else {
      warn('⚠️ No branding data');
    }

    // ─── HERO ───
    if (data.hero) {
      const h = data.hero;
      setValue('heroTitle', h.title);
      setValue('heroSubtitle', h.subtitle);
      setValue('heroCtaText', h.cta1Text);
      setValue('heroBadge', h.badge);
      log('✅ Hero loaded');
    } else {
      warn('⚠️ No hero data');
    }

    // ─── VISI & MISI ───
    if (data.visiMisi) {
      setValue('visi', data.visiMisi.visi);
      setValue('misi', data.visiMisi.misi);
      log('✅ Visi/Misi loaded');
    } else {
      warn('⚠️ No visiMisi data');
    }

    // ─── CONTACT & SOCIAL ───
    if (data.contact) {
      const c = data.contact;
      setValue('contactPhone', c.phone);
      setValue('contactEmail', c.email);
      setValue('contactAddress', c.address);
      setValue('contactHours', c.hours);
      setValue('contactMapUrl', c.mapUrl);
      setValue('socialFacebook', c.facebook);
      setValue('socialInstagram', c.instagram);
      setValue('socialTiktok', c.tiktok);
      setValue('socialYoutube', c.youtube);
      log('✅ Contact loaded');
    } else {
      warn('⚠️ No contact data');
    }

    // Update counters
    updateAllCounters();

    // Reset dirty status (data baru load)
    document.getElementById('statusDot')?.classList.remove('dirty');
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = 'Semua perubahan disimpan';
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.disabled = true;

    log('✅ LOAD COMPLETE');

  } catch (e) {
    err('💥 Load error:', e);
    showToast('Ralat', 'Gagal memuat data: ' + e.message, 'error');
  }
}

/* ─── Helper: set value ke input/textarea ─── */
function setValue(id, value) {
  const el = document.getElementById(id);
  if (!el) {
    warn(`⚠️ #${id} not found`);
    return;
  }
  el.value = value || '';
}

/* ═══════════════════════════════════════════════════
   BIND EVENTS
   ═══════════════════════════════════════════════════ */
function bindEvents() {
  // Character counters
  ['heroSubtitle', 'visi', 'misi'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => updateCounter(el));
    }
  });

  // Mark dirty on any input/change
  const form = document.getElementById('landingForm');
  if (form) {
    form.addEventListener('input', markDirty);
    form.addEventListener('change', markDirty);
    form.addEventListener('submit', handleSave);
  }

  // Reset
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset semua perubahan? Perubahan yang belum disimpan akan hilang.')) {
        location.reload();
      }
    });
  }

  // Side nav section jumper
  document.querySelectorAll('.side-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.dataset.target;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      document.querySelectorAll('.side-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // Scroll spy
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

  // Logo upload
  const logoInput = document.getElementById('logoInput');
  if (logoInput) {
    logoInput.addEventListener('change', (e) => {
      handleImageUpload(e.target.files[0], 'logo');
    });
  }

  // Favicon upload
  const faviconInput = document.getElementById('faviconInput');
  if (faviconInput) {
    faviconInput.addEventListener('change', (e) => {
      handleImageUpload(e.target.files[0], 'favicon');
    });
  }
}

/* ═══════════════════════════════════════════════════
   COUNTERS
   ═══════════════════════════════════════════════════ */
function updateAllCounters() {
  ['heroSubtitle', 'visi', 'misi'].forEach(id => {
    const el = document.getElementById(id);
    if (el) updateCounter(el);
  });
}

function updateCounter(el) {
  const id = el.id;
  const counterId = id === 'heroSubtitle' ? 'heroSubCounter' : id + 'Counter';
  const counter = document.getElementById(counterId);
  if (!counter) return;

  const len = el.value.length;
  const max = parseInt(el.getAttribute('maxlength')) || 500;
  counter.textContent = `${len} / ${max}`;
  counter.classList.remove('warn', 'limit');
  if (len >= max) counter.classList.add('limit');
  else if (len >= max * 0.85) counter.classList.add('warn');
}

/* ═══════════════════════════════════════════════════
   DIRTY STATE
   ═══════════════════════════════════════════════════ */
function markDirty() {
  const saveBtn = document.getElementById('saveBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  if (saveBtn) saveBtn.disabled = false;
  if (statusDot) statusDot.classList.add('dirty');
  if (statusText) statusText.textContent = 'Ada perubahan belum disimpan';
}

/* ═══════════════════════════════════════════════════
   IMAGE UPLOAD
   ═══════════════════════════════════════════════════ */
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
  if (!previewBox) return;

  // Optimistic preview
  const reader = new FileReader();
  reader.onload = (e) => {
    previewBox.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
  };
  reader.readAsDataURL(file);

  const progressEl = document.getElementById('uploadProgress1');
  const fillEl = document.getElementById('uploadFill1');
  const pctEl = document.getElementById('uploadPct1');
  const labelEl = document.getElementById('uploadLabel1');

  if (progressEl) progressEl.classList.add('active');
  if (fillEl) fillEl.style.width = '0%';
  if (pctEl) pctEl.textContent = '0%';
  if (labelEl) labelEl.textContent = `Memuat naik ${type}...`;

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
        if (fillEl) fillEl.style.width = pct + '%';
        if (pctEl) pctEl.textContent = pct + '%';
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const res = JSON.parse(xhr.responseText);
        previewBox.dataset.url = res.secure_url;
        markDirty();
        if (labelEl) labelEl.textContent = '✓ Selesai!';
        if (pctEl) pctEl.textContent = '100%';
        if (fillEl) fillEl.style.width = '100%';
        setTimeout(() => progressEl?.classList.remove('active'), 1200);
        showToast('Berjaya', `${type === 'logo' ? 'Logo' : 'Favicon'} dimuat naik. Klik Simpan untuk kekalkan.`, 'success');
        log(`✅ ${type} uploaded:`, res.secure_url);
      } else {
        progressEl?.classList.remove('active');
        showToast('Ralat', 'Gagal upload.', 'error');
        err('Upload failed:', xhr.status);
      }
    };

    xhr.onerror = () => {
      progressEl?.classList.remove('active');
      showToast('Ralat', 'Rangkaian gagal.', 'error');
    };

    xhr.send(formData);
  } catch (e) {
    progressEl?.classList.remove('active');
    showToast('Ralat', e.message, 'error');
    err('Upload error:', e);
  }
}

window.clearImage = function(type) {
  const previewId = type === 'logo' ? 'logoPreviewBox' : 'faviconPreviewBox';
  const box = document.getElementById(previewId);
  if (!box) return;

  box.innerHTML = `<span class="placeholder-icon"><i class="fas fa-${type === 'logo' ? 'image' : 'star'}"></i></span>`;
  delete box.dataset.url;
  markDirty();
};

/* ═══════════════════════════════════════════════════
   SAVE
   ═══════════════════════════════════════════════════ */
async function handleSave(e) {
  e.preventDefault();
  log('💾 Saving...');

  const btn = document.getElementById('saveBtn');
  const origHTML = btn.innerHTML;
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const { db, fs } = window.EMindCare;

    const logoBox = document.getElementById('logoPreviewBox');
    const faviconBox = document.getElementById('faviconPreviewBox');

    const data = {
      branding: {
        name: getValue('siteName'),
        tagline: getValue('siteTagline'),
        logoUrl: logoBox?.dataset.url || logoBox?.querySelector('img')?.src || '',
        faviconUrl: faviconBox?.dataset.url || faviconBox?.querySelector('img')?.src || '',
        updatedAt: fs.serverTimestamp()
      },
      hero: {
        title: getValue('heroTitle'),
        subtitle: getValue('heroSubtitle'),
        cta1Text: getValue('heroCtaText'),
        badge: getValue('heroBadge')
      },
      visiMisi: {
        visi: getValue('visi'),
        misi: getValue('misi')
      },
      contact: {
        phone: getValue('contactPhone'),
        email: getValue('contactEmail'),
        address: getValue('contactAddress'),
        hours: getValue('contactHours'),
        mapUrl: getValue('contactMapUrl'),
        facebook: getValue('socialFacebook'),
        instagram: getValue('socialInstagram'),
        tiktok: getValue('socialTiktok'),
        youtube: getValue('socialYoutube')
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

    document.getElementById('statusDot')?.classList.remove('dirty');
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = 'Semua perubahan disimpan';

    showToast('Berjaya', 'Perubahan disimpan. Laman utama akan dikemas kini.', 'success');
    log('✅ Saved successfully');

  } catch (e) {
    err('💥 Save error:', e);
    showToast('Ralat', 'Gagal simpan: ' + e.message, 'error');
    btn.disabled = false;
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = origHTML;
  }
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/* ═══════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════ */
function showToast(title, message, type = 'success', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

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

log('🎯 Ready — debug enabled');
