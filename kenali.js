/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Kenali UBK SEMSIRA Public Script
   Logik: Firestore data fetch + render kaunselor + scroll reveal
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   FALLBACK DATA
   ═══════════════════════════════════════════════════════════════ */
const FALLBACK = {
  visi: "Menjadi Unit Bimbingan & Kaunseling yang unggul dalam membentuk pelajar holistik — cemerlang akademik, kukuh sahsiah, dan sejahtera minda menjelang 2030.",
  misi: "Menyediakan perkhidmatan bimbingan dan kaunseling yang profesional, mesra dan menyeluruh — menyokong perkembangan sahsiah, akademik dan kerjaya setiap pelajar SMK Syed Sirajuddin.",
  message: {
    text: "Selamat datang ke portal Unit Bimbingan & Kaunseling SMK Syed Sirajuddin.\n\nKami di sini untuk mendengar, membantu dan membimbing setiap pelajar menuju kecemerlangan akademik dan kesejahteraan minda. Jangan pernah rasa bersendirian — kami sentiasa bersedia membantu anda.",
    author: "Ketua Kaunselor",
    title: "Ketua Kaunselor UBK SEMSIRA"
  },
  announcements: [
    { text: "Selamat datang ke portal e-MindCare UBK SEMSIRA", icon: "fa-bullhorn", badge: "Baharu" },
    { text: "Bilik Kaunseling dibuka setiap hari 8.00 pagi - 4.30 petang", icon: "fa-clock" }
  ]
};

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

  // Load content PARALEL
  const [
    siteConfig,
    landing,
    contact,
    kaunselorUsers,
    kolab
  ] = await Promise.all([
    getSiteConfig().catch(() => null),
    getDocSafe('site_settings', 'landing_page'),
    getDocSafe('site_settings', 'contact'),
    getUsersByRole('kaunselor'),
    getCollection('collaborations')
  ]);

  // Apply branding (navbar + footer)
  applyBranding(siteConfig, landing);

  // Apply visi misi
  applyVisiMisi(landing);

  // Apply perutusan (dari kaunselor utama atau fallback)
  applyMessage(kaunselorUsers, landing);

  // Render barisan kaunselor
  renderCounselor(kaunselorUsers);

  // Apply contact
  applyContact(contact, siteConfig);

  // Render kolaborasi navbar
  renderKolaborasiNav(kolab);

  // Announcements
  loadAnnouncements();

  // Setup scroll reveal
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

async function getUsersByRole(role) {
  try {
    const { db, fs } = window.EMindCare;
    const q = fs.query(
      fs.collection(db, 'users'),
      fs.where('role', '==', role)
    );
    const snap = await fs.getDocs(q);
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));

    // Sort: Utama dulu
    items.sort((a, b) => {
      const aT = (a.title || '').toLowerCase();
      const bT = (b.title || '').toLowerCase();
      const priority = t => t.includes('utama') ? 1 : t.includes('penolong') ? 2 : 3;
      return priority(aT) - priority(bT);
    });
    return items;
  } catch (e) {
    console.warn('[users]', e.message);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════
   APPLY BRANDING
   ═══════════════════════════════════════════════════════════════ */
function applyBranding(siteConfig, landing) {
  const b = {
    name: landing?.siteName || siteConfig?.branding?.name || 'e-MindCare',
    tagline: landing?.siteTagline || siteConfig?.branding?.tagline || 'Unit Bimbingan & Kaunseling',
    logoUrl: landing?.logoUrl || siteConfig?.branding?.logoUrl || null,
    logoIcon: siteConfig?.branding?.logoIcon || 'fas fa-brain',
    primaryColor: siteConfig?.branding?.primaryColor || '#0F766E',
    accentColor: siteConfig?.branding?.accentColor || '#4F46E5'
  };

  document.getElementById('brandName').textContent = b.name;
  document.getElementById('brandTagline').textContent = b.tagline;
  document.getElementById('footerBrandName').textContent = b.name;
  document.getElementById('footerBrandTagline').textContent = b.tagline;
  document.title = 'Kenali UBK SEMSIRA · ' + b.name;

  const logoHTML = b.logoUrl
    ? `<img src="${b.logoUrl}" alt="${b.name}">`
    : `<i class="${b.logoIcon}"></i>`;
  document.getElementById('navLogo').innerHTML = logoHTML;
  document.getElementById('footerLogo').innerHTML = logoHTML;

  if (b.primaryColor) document.documentElement.style.setProperty('--teal', b.primaryColor);
  if (b.accentColor) document.documentElement.style.setProperty('--indigo', b.accentColor);

  // Favicon
  if (landing?.faviconUrl) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = landing.faviconUrl;
  }

  // Footer description
  if (landing?.footerDesc) {
    document.getElementById('footerDesc').textContent = landing.footerDesc;
  }
}

/* ═══════════════════════════════════════════════════════════════
   APPLY VISI & MISI
   ═══════════════════════════════════════════════════════════════ */
function applyVisiMisi(landing) {
  const visi = landing?.visi || FALLBACK.visi;
  const misi = landing?.misi || FALLBACK.misi;

  document.getElementById('visiText').textContent = visi;
  document.getElementById('misiText').textContent = misi;
}

/* ═══════════════════════════════════════════════════════════════
   APPLY PERUTUSAN (dari kaunselor utama)
   ═══════════════════════════════════════════════════════════════ */
function applyMessage(users, landing) {
  // Priority 1: Custom message dari site_settings/landing_page (jika ada)
  if (landing?.messageText && landing?.messageTitle) {
    document.getElementById('messageText').textContent = landing.messageText;
    document.getElementById('messageName').textContent = landing.messageAuthor || 'Ketua Kaunselor';
    document.getElementById('messageTitle').textContent = landing.messageTitle;
    if (landing.messagePhotoUrl) {
      document.getElementById('messagePhoto').innerHTML = `
        <img src="${landing.messagePhotoUrl}" alt="Ketua Kaunselor">
        <div class="message-photo-overlay">
          <div class="message-photo-badge">
            <i class="fas fa-star"></i>
            <span>${landing.messageTitle}</span>
          </div>
        </div>`;
    }
    return;
  }

  // Priority 2: Kaunselor pertama (Utama) dari users
  const ketua = users.find(u => (u.title || '').toLowerCase().includes('utama')) || users[0];

  if (ketua) {
    const name = ketua.fullName || 'Ketua Kaunselor';
    const title = ketua.title || 'Ketua Kaunselor UBK SEMSIRA';
    const bio = ketua.bio || ketua.description || FALLBACK.message.text;
    const photo = ketua.profileImage || ketua.avatarUrl || null;

    document.getElementById('messageText').textContent = bio;
    document.getElementById('messageName').textContent = name;
    document.getElementById('messageTitle').textContent = title;
    document.getElementById('messageBadge').innerHTML = `<i class="fas fa-star"></i><span>${title}</span>`;

    if (photo) {
      document.getElementById('messagePhoto').innerHTML = `
        <img src="${photo}" alt="${name}">
        <div class="message-photo-overlay">
          <div class="message-photo-badge">
            <i class="fas fa-star"></i>
            <span>${title}</span>
          </div>
        </div>`;
    }
    return;
  }

  // Priority 3: Fallback
  document.getElementById('messageText').textContent = FALLBACK.message.text;
  document.getElementById('messageName').textContent = FALLBACK.message.author;
  document.getElementById('messageTitle').textContent = FALLBACK.message.title;
}

/* ═══════════════════════════════════════════════════════════════
   RENDER BARISAN KAUNSELOR
   ═══════════════════════════════════════════════════════════════ */
function renderCounselor(users) {
  const grid = document.getElementById('counselorGrid');

  // Empty state
  if (!users.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-user-tie"></i></div>
        <strong>Belum Ada Kaunselor Berdaftar</strong>
        <p>Barisan kaunselor UBK SEMSIRA akan dipaparkan di sini setelah didaftarkan.</p>
      </div>`;
    return;
  }

  grid.innerHTML = users.map((u, i) => {
    const name = u.fullName || 'Kaunselor';
    const title = u.title || 'Kaunselor UBK';
    const bio = u.bio || u.description || 'Bersedia membantu anda dengan penuh prihatin.';
    const photo = u.profileImage || u.avatarUrl || null;
    const initial = name.charAt(0).toUpperCase();

    // Specialty (optional)
    const specialty = u.specialty || u.education || null;

    // Badge Utama?
    const isUtama = title.toLowerCase().includes('utama');
    const badgeClass = isUtama ? 'counselor-badge utama' : 'counselor-badge';

    const photoHTML = photo
      ? `<img src="${photo}" alt="${escapeHtml(name)}" loading="lazy">`
      : `<div class="counselor-initial">${initial}</div>`;

    return `
      <a href="perkhidmatan.html" class="counselor-card reveal" style="animation-delay: ${i * 0.05}s;">
        <div class="counselor-photo">
          ${photoHTML}
          <div class="${badgeClass}">${escapeHtml(title)}</div>
        </div>
        <div class="counselor-body">
          <h3 class="counselor-name">${escapeHtml(name)}</h3>
          <div class="counselor-title">${escapeHtml(title)}</div>
          ${specialty ? `
            <div class="counselor-specialty">
              <i class="fas fa-star"></i>
              ${escapeHtml(specialty)}
            </div>
          ` : ''}
          <p class="counselor-bio">${escapeHtml(bio)}</p>
          <div class="counselor-cta">
            <i class="fas fa-calendar-check"></i>
            Buat Temujanji
          </div>
        </div>
      </a>
    `;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   APPLY CONTACT
   ═══════════════════════════════════════════════════════════════ */
function applyContact(contact, siteConfig) {
  const contacts = [];

  if (contact?.contactPhone) {
    contacts.push({
      icon: 'fas fa-phone',
      text: contact.contactPhone,
      url: `tel:${contact.contactPhone.replace(/\s/g, '')}`
    });
  }
  if (contact?.contactWhatsapp) {
    contacts.push({
      icon: 'fab fa-whatsapp',
      text: contact.contactWhatsapp,
      url: `https://wa.me/${contact.contactWhatsapp}`
    });
  }
  if (contact?.contactEmail) {
    contacts.push({
      icon: 'fas fa-envelope',
      text: contact.contactEmail,
      url: `mailto:${contact.contactEmail}`
    });
  }
  if (contact?.contactAddress) {
    contacts.push({
      icon: 'fas fa-map-marker-alt',
      text: contact.contactAddress,
      url: '#'
    });
  }

  if (!contacts.length && siteConfig?.footer?.contacts) {
    contacts.push(...siteConfig.footer.contacts);
  }

  if (!contacts.length) {
    contacts.push(
      { icon: 'fas fa-envelope', text: 'ubk@smksyed.edu.my', url: 'mailto:ubk@smksyed.edu.my' },
      { icon: 'fas fa-phone', text: '+60 4-XXX XXXX', url: '#' },
      { icon: 'fas fa-map-marker-alt', text: 'SMK Syed Sirajuddin, Perlis', url: '#' }
    );
  }

  document.getElementById('footerContact').innerHTML = contacts.map(c =>
    `<li><a href="${c.url || '#'}"><i class="${c.icon}"></i> ${escapeHtml(c.text)}</a></li>`
  ).join('');

  // Social media links
  const socialMap = {
    facebook: contact?.socialFacebook,
    instagram: contact?.socialInstagram,
    youtube: contact?.socialYoutube,
    tiktok: contact?.socialTiktok
  };
  document.querySelectorAll('[data-social]').forEach(el => {
    const platform = el.dataset.social;
    const url = socialMap[platform];
    if (url) el.href = url;
  });
}

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
  if (!items.length) items = FALLBACK.announcements;

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
   UTILS
   ═══════════════════════════════════════════════════════════════ */
function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

console.log(
  "%c 👥 Kenali UBK SEMSIRA ",
  "background:linear-gradient(135deg,#0F766E,#4F46E5,#EC4899);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Ready · v2.0");