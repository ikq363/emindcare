/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Hubungi Kami Script
   Logik: Load contact info + submit form ke Firestore
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const INQUIRIES_COLLECTION = 'inquiries';
const DEFAULT_MAP_EMBED = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3962.6393847!2d100.278!3d6.4385!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNsKwMjYnMTguNiJOIDEwMMKwMTYnNDAuOCJF!5e0!3m2!1sen!2smy!4v1700000000000';

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  await waitForEMindCare();
  setTimeout(() => document.getElementById('preloader')?.classList.add('hidden'), 600);
  initPage();
});

function waitForEMindCare() {
  return new Promise(res => {
    if (window.EMindCare) return res();
    const t = setInterval(() => {
      if (window.EMindCare) { clearInterval(t); res(); }
    }, 50);
  });
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE MENU
   ═══════════════════════════════════════════════════════════════ */
window.openMobileMenu = () => {
  document.getElementById('mobileMenu').classList.add('active');
  document.body.style.overflow = 'hidden';
};
window.closeMobileMenu = (e) => {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('mobileMenu').classList.remove('active');
  document.body.style.overflow = '';
};

/* ═══════════════════════════════════════════════════════════════
   NAVBAR SCROLL
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('scroll', () => {
  document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 30);
});

/* ═══════════════════════════════════════════════════════════════
   🚀 MAIN INIT
   ═══════════════════════════════════════════════════════════════ */
async function initPage() {
  const { getSiteConfig, getCollection, getActiveAnnouncements, auth_fns, auth, db, fs } = window.EMindCare;

  const [
    siteConfig,
    contact,
    kolab
  ] = await Promise.all([
    getSiteConfig().catch(() => null),
    getDocSafe('site_settings', 'contact'),
    getCollection('collaborations')
  ]);

  // Apply branding
  applyBranding(siteConfig, contact);

  // Apply contact info
  applyContact(contact, siteConfig);

  // Render kolaborasi navbar
  renderKolaborasiNav(kolab);

  // Announcements
  loadAnnouncements();

  // Setup form
  initForm();

  // Setup reveal
  setupReveal();

  // Auth state
  auth_fns.onAuthStateChanged(auth, async user => {
    const btn = document.getElementById('navCtaBtn');
    if (!user) return;
    try {
      const uDoc = await fs.getDoc(fs.doc(db, 'users', user.uid));
      const role = uDoc.exists() ? uDoc.data().role : 'murid';
      const url = role === 'kaunselor' ? 'dashboard-kaunselor.html' :
                  role === 'guru' ? 'dashboard-guru.html' : 'dashboard-murid.html';
      if (btn) {
        btn.href = url;
        btn.innerHTML = `<i class="fas fa-tachometer-alt"></i> Dashboard`;
      }
    } catch (e) { console.warn(e); }
  });
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
async function getDocSafe(collection, docId) {
  try {
    const { db, fs } = window.EMindCare;
    const snap = await fs.getDoc(fs.doc(db, collection, docId));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn(`[${collection}/${docId}]`, e.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   APPLY BRANDING
   ═══════════════════════════════════════════════════════════════ */
function applyBranding(siteConfig, contact) {
  const b = {
    name: siteConfig?.branding?.name || 'e-MindCare',
    tagline: siteConfig?.branding?.tagline || 'Unit Bimbingan & Kaunseling',
    logoUrl: siteConfig?.branding?.logoUrl || null,
    logoIcon: siteConfig?.branding?.logoIcon || 'fas fa-brain'
  };

  document.getElementById('brandName').textContent = b.name;
  document.getElementById('brandTagline').textContent = b.tagline;
  document.getElementById('footerBrandName').textContent = b.name;
  document.getElementById('footerBrandTagline').textContent = b.tagline;
  document.title = 'Hubungi Kami · ' + b.name + ' UBK SEMSIRA';

  const logoHTML = b.logoUrl
    ? `<img src="${b.logoUrl}" alt="${b.name}">`
    : `<i class="${b.logoIcon}"></i>`;
  document.getElementById('navLogo').innerHTML = logoHTML;
  document.getElementById('footerLogo').innerHTML = logoHTML;

  if (siteConfig?.branding?.primaryColor) {
    document.documentElement.style.setProperty('--teal', siteConfig.branding.primaryColor);
  }
  if (siteConfig?.branding?.accentColor) {
    document.documentElement.style.setProperty('--indigo', siteConfig.branding.accentColor);
  }
}

/* ═══════════════════════════════════════════════════════════════
   APPLY CONTACT INFO
   ═══════════════════════════════════════════════════════════════ */
function applyContact(contact, siteConfig) {
  const c = contact || {};

  // Address
  if (c.contactAddress) {
    document.getElementById('infoAddress').textContent = c.contactAddress;
  }

  // Phone
  if (c.contactPhone) {
    document.getElementById('infoPhone').textContent = c.contactPhone;
  }

  // Email
  if (c.contactEmail) {
    document.getElementById('infoEmail').textContent = c.contactEmail;
  }

  // Hours
  if (c.contactHours) {
    // Kalau ada format "Isnin - Jumaat: 7:30 AM - 2:00 PM"
    // Cuba parse
    document.getElementById('hoursMonThu').textContent = c.contactHours;
    document.getElementById('hoursFri').textContent = '';
  }

  // WhatsApp button
  if (c.contactWhatsapp) {
    const waLink = document.getElementById('infoWhatsapp');
    const cleanNum = String(c.contactWhatsapp).replace(/\D/g, '');
    waLink.href = `https://wa.me/${cleanNum}?text=${encodeURIComponent('Assalamualaikum, saya ingin bertanya kepada Unit Bimbingan & Kaunseling SMK Syed Sirajuddin.')}`;
  }

  // Map link
  if (c.contactMapEmbed || siteConfig?.footer?.contacts) {
    const mapLink = document.getElementById('infoMapLink');
    // Guna Google Maps search query
    const address = c.contactAddress || 'SMK Syed Sirajuddin';
    mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  // Social media
  const socialMap = {
    facebook: c.socialFacebook,
    instagram: c.socialInstagram,
    tiktok: c.socialTiktok,
    youtube: c.socialYoutube
  };
  document.querySelectorAll('[data-social]').forEach(el => {
    const platform = el.dataset.social;
    const url = socialMap[platform];
    if (url) {
      el.href = url;
    } else {
      // Hide chip if no URL
      if (el.classList.contains('social-chip') || el.parentElement?.classList.contains('footer-social')) {
        el.style.display = 'none';
      }
    }
  });

  // Google Maps embed
  const mapEmbed = document.getElementById('mapEmbed');
  const embedUrl = c.contactMapEmbed || DEFAULT_MAP_EMBED;

  if (embedUrl && embedUrl.startsWith('http')) {
    mapEmbed.innerHTML = `<iframe src="${escapeHtml(embedUrl)}" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  } else {
    mapEmbed.innerHTML = `
      <div class="map-placeholder">
        <i class="fas fa-map-location-dot"></i>
        <span>Peta lokasi belum ditetapkan</span>
        <span style="font-size:0.75rem; font-weight:500;">Sila hubungi kaunselor untuk maklumat lanjut</span>
      </div>
    `;
  }

  // Footer contact
  const contacts = [];
  if (c.contactEmail) {
    contacts.push({ icon: 'fas fa-envelope', text: c.contactEmail, url: `mailto:${c.contactEmail}` });
  }
  if (c.contactPhone) {
    contacts.push({ icon: 'fas fa-phone', text: c.contactPhone, url: `tel:${c.contactPhone.replace(/\s/g, '')}` });
  }
  if (c.contactAddress) {
    contacts.push({ icon: 'fas fa-map-marker-alt', text: c.contactAddress, url: '#' });
  }

  if (contacts.length) {
    document.getElementById('footerContact').innerHTML = contacts.map(ct =>
      `<li><a href="${ct.url}"><i class="${ct.icon}"></i> ${escapeHtml(ct.text)}</a></li>`
    ).join('');
  }
}

/* ═══════════════════════════════════════════════════════════════
   INIT FORM
   ═══════════════════════════════════════════════════════════════ */
function initForm() {
  const form = document.getElementById('contactForm');
  const nameInput = document.getElementById('senderName');

  // Auto-uppercase name
  nameInput.addEventListener('input', (e) => {
    const start = e.target.selectionStart;
    const oldLen = e.target.value.length;
    e.target.value = e.target.value.replace(/[^A-Za-z\s'\.]/g, '').toUpperCase();
    const diff = oldLen - e.target.value.length;
    if (diff > 0) e.target.setSelectionRange(Math.max(0, start - diff), Math.max(0, start - diff));
  });

  // Phone — allow digits, +, space, -
  document.getElementById('phone').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^\d+\s\-]/g, '').slice(0, 20);
  });

  // Submit
  form.addEventListener('submit', handleSubmit);
}

/* ═══════════════════════════════════════════════════════════════
   HANDLE FORM SUBMIT
   ═══════════════════════════════════════════════════════════════ */
let isSubmitting = false;

async function handleSubmit(e) {
  e.preventDefault();
  if (isSubmitting) return;

  const form = document.getElementById('contactForm');
  const btn = document.getElementById('submitBtn');

  const senderName = document.getElementById('senderName').value.trim().toUpperCase();
  const category = document.getElementById('category').value;
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const subject = document.getElementById('subject').value.trim();
  const message = document.getElementById('message').value.trim();

  // Validation
  if (!senderName || senderName.length < 3) {
    return showToast('Ralat', 'Sila masukkan nama penuh anda.', 'error');
  }
  if (!category) {
    return showToast('Ralat', 'Sila pilih kategori pengunjung.', 'error');
  }
  if (!phone || phone.replace(/\D/g, '').length < 9) {
    return showToast('Ralat', 'Sila masukkan nombor telefon yang sah.', 'error');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return showToast('Ralat', 'Format e-mel tidak sah.', 'error');
  }
  if (!subject || subject.length < 3) {
    return showToast('Ralat', 'Sila masukkan subjek mesej.', 'error');
  }
  if (!message || message.length < 10) {
    return showToast('Ralat', 'Sila taipkan mesej sekurang-kurangnya 10 aksara.', 'error');
  }

  // Set flag
  isSubmitting = true;
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const { db, fs } = window.EMindCare;
    const { addDoc, collection, serverTimestamp } = fs;

    const data = {
      senderName,
      category,
      phone,
      email: email || null,
      subject,
      message,
      status: 'unread',
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, INQUIRIES_COLLECTION), data);

    console.log('✅ Mesej dihantar:', data);

    // Show success state
    document.getElementById('formContent').style.display = 'none';
    document.getElementById('formSuccess').classList.add('active');

    // Scroll ke success card
    document.getElementById('formSuccess').scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

  } catch (err) {
    console.error('❌ Submit error:', err);
    showToast('Gagal Menghantar', err.message, 'error', 6000);
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    isSubmitting = false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   RESET FORM (untuk butang "Hantar Mesej Baharu")
   ═══════════════════════════════════════════════════════════════ */
window.resetForm = function() {
  const form = document.getElementById('contactForm');
  form.reset();

  document.getElementById('formSuccess').classList.remove('active');
  document.getElementById('formContent').style.display = 'block';

  // Scroll ke form
  document.getElementById('contactForm').scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
};

/* ═══════════════════════════════════════════════════════════════
   RENDER KOLABORASI NAVBAR
   ═══════════════════════════════════════════════════════════════ */
function renderKolaborasiNav(items) {
  if (!items.length) return;

  const navKolab = document.getElementById('navKolab');
  const navIcons = document.getElementById('navKolabIcons');
  const topItems = items.slice(0, 4);
  if (topItems.length) {
    navKolab.style.display = 'flex';
    navIcons.innerHTML = topItems.map(k => `
      <a href="${k.linkUrl || '#'}" class="nav-kolab-icon" title="${escapeHtml(k.name || '')}" target="${k.linkUrl ? '_blank' : '_self'}" rel="noopener">
        <img src="${k.logoUrl}" alt="${escapeHtml(k.name || '')}">
      </a>`).join('');
  }
}

/* ═══════════════════════════════════════════════════════════════
   LOAD ANNOUNCEMENTS
   ═══════════════════════════════════════════════════════════════ */
async function loadAnnouncements() {
  let items = await window.EMindCare.getActiveAnnouncements();
  if (!items.length) return;

  const textItems = items.filter(i => !i.mediaUrl || !i.mediaType);
  renderAnnouncementBar(textItems);
}

function renderAnnouncementBar(items) {
  const bar = document.getElementById('announcementBar');
  const marquee = document.getElementById('announcementMarquee');
  if (!items.length) return;

  const html = items.map(d => {
    const badge = d.badge ? `<span class="badge">${escapeHtml(d.badge)}</span>` : '';
    return `<span class="announce-item">
      <i class="fas ${d.icon || 'fa-bullhorn'}"></i>
      ${badge}<span>${escapeHtml(d.text || '')}</span>
    </span>`;
  }).join('<span class="announce-divider">✦</span>');

  const sep = '<span class="announce-divider">✦</span>';
  marquee.innerHTML = html + sep + html + sep;
  marquee.style.animationDuration = Math.max(30, marquee.scrollWidth / 50) + 's';
  bar.classList.add('active');
}

/* ═══════════════════════════════════════════════════════════════
   SCROLL REVEAL
   ═══════════════════════════════════════════════════════════════ */
function setupReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
  document.querySelectorAll('.reveal:not(.observed)').forEach(el => {
    el.classList.add('observed'); obs.observe(el);
  });
}

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
  "%c 📞 Hubungi Kami ",
  "background:linear-gradient(135deg,#0F766E,#4F46E5,#06B6D4);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Contact form + Map embed + Firestore submissions · Ready");