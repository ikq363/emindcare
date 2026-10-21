/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Galeri UBK Public Script (v3)
   + Preloader animation
   + Announcement bar (running text)
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const COLLECTION = 'gallery';
const ANNOUNCEMENTS_COLLECTION = 'announcements';
const MIN_PRELOADER_TIME = 1800; // ms minimum tunjuk preloader

const CATEGORY_CLASS = {
  'Program UBK': 'cat-program-ubk',
  'Lawatan Kerjaya': 'cat-lawatan-kerjaya',
  'Bengkel Minda Sihat': 'cat-bengkel-minda',
  'Aktiviti Kelab': 'cat-aktiviti-kelab',
  'Lain-lain': 'cat-lain'
};
const CATEGORY_ICON = {
  'Program UBK': 'fa-hands-helping',
  'Lawatan Kerjaya': 'fa-briefcase',
  'Bengkel Minda Sihat': 'fa-brain',
  'Aktiviti Kelab': 'fa-users',
  'Lain-lain': 'fa-tag'
};

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let allAlbums = [];
let filteredAlbums = [];
let activeCategory = 'all';
let searchTerm = '';
let slideshowTimers = [];

let lightboxImages = [];
let lightboxImageIndex = 0;
let lightboxCurrentAlbum = null;

let preloaderStartTime = Date.now();

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  initPreloader();

  try {
    await waitForEMindCare();
  } catch (e) {
    console.warn('EMindCare not available:', e.message);
  }

  initUI();
  applyBranding();
  loadAnnouncements();
  await loadGallery();

  hidePreloaderWhenReady();
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
   🎬 PRELOADER
   ═══════════════════════════════════════════════════════════════ */
function initPreloader() {
  preloaderStartTime = Date.now();
  animatePreloaderPercent();
}

function animatePreloaderPercent() {
  const el = document.getElementById('preloaderPercent');
  if (!el) return;

  const duration = MIN_PRELOADER_TIME;
  const start = performance.now();

  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(eased * 100) + '%';
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function hidePreloaderWhenReady() {
  const elapsed = Date.now() - preloaderStartTime;
  const remaining = Math.max(0, MIN_PRELOADER_TIME - elapsed);

  setTimeout(() => {
    const preloader = document.getElementById('preloader');
    if (preloader) preloader.classList.add('hidden');
    document.body.style.overflow = '';

    // Remove from DOM after transition
    setTimeout(() => {
      if (preloader && preloader.parentNode) {
        preloader.remove();
      }
    }, 800);
  }, remaining);
}

/* ═══════════════════════════════════════════════════════════════
   📢 ANNOUNCEMENTS
   ═══════════════════════════════════════════════════════════════ */
async function loadAnnouncements() {
  try {
    if (!window.EMindCare?.getActiveAnnouncements) {
      console.log('No announcement helper available');
      return;
    }

    const all = await window.EMindCare.getActiveAnnouncements();
    const textItems = all.filter(i => !i.mediaUrl || !i.mediaType);

    renderAnnouncementBar(textItems);
  } catch (err) {
    console.warn('Load announcements error:', err.message);
  }
}

function renderAnnouncementBar(items) {
  const bar = document.getElementById('announcementBar');
  const marquee = document.getElementById('announcementMarquee');
  if (!bar || !marquee) return;

  if (!items.length) {
    bar.classList.remove('active');
    return;
  }

  const html = items.map(d => {
    const badge = d.badge ? `<span class="announcement-badge">${escapeHtml(d.badge)}</span>` : '';
    return `
      <span class="announcement-item">
        <i class="fas ${d.icon || 'fa-bullhorn'}"></i>
        ${badge}
        <span>${escapeHtml(d.text || '')}</span>
      </span>
    `;
  }).join('<span class="announcement-divider">✦</span>');

  const sep = '<span class="announcement-divider">✦</span>';
  marquee.innerHTML = html + sep + html + sep;

  // Adjust speed based on content
  const duration = Math.max(30, marquee.scrollWidth / 50);
  marquee.style.animationDuration = duration + 's';

  bar.classList.add('active');
  console.log(`✅ ${items.length} pengumuman rendered`);
}

/* ═══════════════════════════════════════════════════════════════
   INIT UI
   ═══════════════════════════════════════════════════════════════ */
function initUI() {
  document.body.style.overflow = 'hidden'; // Lock scroll while preloader

  window.addEventListener('scroll', () => {
    document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 30);
  });

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeCategory = tab.dataset.cat;
      document.querySelectorAll('.filter-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.cat === activeCategory);
      });
      applyFilters();
    });
  });

  let searchTimeout;
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchTerm = e.target.value.toLowerCase().trim();
      applyFilters();
    }, 250);
  });

  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox').classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxNav(e, -1);
    if (e.key === 'ArrowRight') lightboxNav(e, 1);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMobileMenu();
  });
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE MENU
   ═══════════════════════════════════════════════════════════════ */
window.openMobileMenu = function() {
  document.getElementById('mobileMenu').classList.add('active');
  document.body.style.overflow = 'hidden';
};
window.closeMobileMenu = function(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('mobileMenu').classList.remove('active');
  document.body.style.overflow = '';
};

/* ═══════════════════════════════════════════════════════════════
   APPLY BRANDING
   ═══════════════════════════════════════════════════════════════ */
async function applyBranding() {
  try {
    if (!window.EMindCare?.getSiteConfig) return;

    const cfg = await window.EMindCare.getSiteConfig();
    if (!cfg?.branding) return;
    const b = cfg.branding;

    if (b.name) {
      document.getElementById('navBrandName').textContent = b.name;
      document.getElementById('footerBrandName').textContent = b.name;
      document.title = 'Galeri UBK SEMSIRA · ' + b.name;
    }
    if (b.tagline) {
      document.getElementById('navBrandTagline').textContent = b.tagline;
      document.getElementById('footerBrandTagline').textContent = b.tagline;
    }
    if (b.logoUrl) {
      document.getElementById('navLogo').innerHTML = `<img src="${b.logoUrl}" alt="">`;
      document.getElementById('footerLogo').innerHTML = `<img src="${b.logoUrl}" alt="">`;
      const preloaderLogo = document.getElementById('preloaderLogo');
      if (preloaderLogo) {
        preloaderLogo.innerHTML = `<div class="preloader-rings"></div><img src="${b.logoUrl}" alt="">`;
      }
    } else if (b.logoIcon) {
      document.getElementById('navLogo').innerHTML = `<i class="${b.logoIcon}"></i>`;
      document.getElementById('footerLogo').innerHTML = `<i class="${b.logoIcon}"></i>`;
      const preloaderLogo = document.getElementById('preloaderLogo');
      if (preloaderLogo) {
        preloaderLogo.innerHTML = `<div class="preloader-rings"></div><i class="${b.logoIcon}"></i>`;
      }
    }
    if (b.primaryColor) document.documentElement.style.setProperty('--teal', b.primaryColor);
    if (b.accentColor) document.documentElement.style.setProperty('--indigo', b.accentColor);
  } catch (e) { /* ignore */ }
}

/* ═══════════════════════════════════════════════════════════════
   LOAD GALLERY
   ═══════════════════════════════════════════════════════════════ */
async function loadGallery() {
  try {
    const { db, fs } = window.EMindCare;
    const { collection, query, where, orderBy, getDocs } = fs;

    let items = [];

    try {
      const q = query(
        collection(db, COLLECTION),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    } catch (indexErr) {
      console.warn('Ordered query failed, using fallback:', indexErr.message);
      const q = query(collection(db, COLLECTION), where('status', '==', 'published'));
      const snap = await getDocs(q);
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));

      items.sort((a, b) => {
        const at = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bt = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bt - at;
      });
    }

    allAlbums = items;
    updateHeroStats();
    updateCategoryCounts();
    applyFilters();

  } catch (err) {
    console.error('Load gallery error:', err);
    showError('Gagal memuatkan galeri. Sila refresh halaman.');
  }
}

/* ═══════════════════════════════════════════════════════════════
   HERO STATS
   ═══════════════════════════════════════════════════════════════ */
function updateHeroStats() {
  const totalAlbums = allAlbums.length;
  const totalImages = allAlbums.reduce((sum, a) => sum + (a.images?.length || 0), 0);
  const categories = new Set(allAlbums.map(i => i.category).filter(Boolean));

  document.getElementById('heroTotal').textContent = totalImages;
  document.getElementById('heroAlbums').textContent = categories.size;

  if (allAlbums.length && allAlbums[0].date) {
    try {
      const d = new Date(allAlbums[0].date);
      const monthShort = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'][d.getMonth()];
      document.getElementById('heroLatest').textContent = `${monthShort} ${d.getFullYear()}`;
    } catch {
      document.getElementById('heroLatest').textContent = '—';
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   CATEGORY COUNTS
   ═══════════════════════════════════════════════════════════════ */
function updateCategoryCounts() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const cat = el.dataset.count;
    if (cat === 'all') {
      el.textContent = allAlbums.length;
    } else {
      el.textContent = allAlbums.filter(i => i.category === cat).length;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   APPLY FILTERS
   ═══════════════════════════════════════════════════════════════ */
function applyFilters() {
  filteredAlbums = allAlbums.filter(item => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;

    if (searchTerm) {
      const haystack = [
        item.title,
        item.description,
        item.category
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }

    return true;
  });

  renderGallery();
}

/* ═══════════════════════════════════════════════════════════════
   RENDER GALLERY
   ═══════════════════════════════════════════════════════════════ */
function renderGallery() {
  const grid = document.getElementById('galleryGrid');

  if (!filteredAlbums.length) {
    const isFiltered = allAlbums.length > 0;
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <i class="fas ${isFiltered ? 'fa-search' : 'fa-photo-video'}"></i>
        </div>
        <strong>${isFiltered ? 'Tiada rekod dijumpai' : 'Belum ada koleksi galeri'}</strong>
        <p>${isFiltered
          ? 'Cuba tukar kategori atau kata kunci carian anda.'
          : 'Koleksi gambar akan dipaparkan di sini apabila kaunselor memuat naiknya.'
        }</p>
      </div>`;
    return;
  }

  grid.innerHTML = filteredAlbums.map((album, idx) => {
    const catClass = CATEGORY_CLASS[album.category] || 'cat-lain';
    const catIcon = CATEGORY_ICON[album.category] || 'fa-tag';
    const dateStr = album.date ? formatDateShort(album.date) : '';
    const images = album.images || [];
    const imgCount = images.length;

    return `
      <article class="gallery-card" data-album-id="${album.id}" style="animation-delay: ${Math.min(idx * 0.05, 0.4)}s;">
        <div class="gallery-image" onclick="openLightbox('${album.id}')">
          <div class="gallery-slideshow">
            ${images.map((img, i) => `
              <img src="${img.url}" alt="${escapeHtml(album.title || '')} - ${i + 1}"
                   class="slide ${i === 0 ? 'active' : ''}"
                   data-slide-idx="${i}"
                   loading="${i === 0 ? 'eager' : 'lazy'}">
            `).join('')}
          </div>

          <span class="gallery-badge ${catClass}">
            <i class="fas ${catIcon}"></i>
            ${escapeHtml(album.category || 'Lain-lain')}
          </span>

          ${imgCount > 1 ? `
            <span class="gallery-count-badge">
              <i class="fas fa-images"></i>
              ${imgCount}
            </span>
          ` : ''}

          <div class="gallery-zoom">
            <i class="fas fa-search-plus"></i>
          </div>

          ${imgCount > 1 ? `
            <div class="gallery-slideshow-dots">
              ${images.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('')}
            </div>
          ` : ''}
        </div>

        <div class="gallery-body">
          ${dateStr ? `<span class="gallery-date"><i class="fas fa-calendar"></i> ${dateStr}</span>` : ''}
          <h3 class="gallery-title">${escapeHtml(album.title || 'Tanpa Tajuk')}</h3>
          ${album.description ? `<p class="gallery-desc">${escapeHtml(album.description)}</p>` : ''}
        </div>
      </article>
    `;
  }).join('');

  startAllSlideshows();
}

/* ═══════════════════════════════════════════════════════════════
   SLIDESHOW AUTO-ROTATE
   ═══════════════════════════════════════════════════════════════ */
function startAllSlideshows() {
  slideshowTimers.forEach(t => clearInterval(t));
  slideshowTimers = [];

  document.querySelectorAll('.gallery-card').forEach(card => {
    const slideshow = card.querySelector('.gallery-slideshow');
    if (!slideshow) return;

    const slides = slideshow.querySelectorAll('.slide');
    if (slides.length <= 1) return;

    const dots = card.querySelectorAll('.gallery-slideshow-dots .dot');
    let current = 0;
    let paused = false;

    card.addEventListener('mouseenter', () => { paused = true; });
    card.addEventListener('mouseleave', () => { paused = false; });

    document.addEventListener('visibilitychange', () => {
      paused = document.hidden;
    });

    const timer = setInterval(() => {
      if (paused) return;
      current = (current + 1) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('active', i === current));
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
    }, 3000);

    slideshowTimers.push(timer);
  });
}

function stopAllSlideshows() {
  slideshowTimers.forEach(t => clearInterval(t));
  slideshowTimers = [];
}

/* ═══════════════════════════════════════════════════════════════
   LIGHTBOX
   ═══════════════════════════════════════════════════════════════ */
window.openLightbox = function(albumId) {
  const album = filteredAlbums.find(x => x.id === albumId);
  if (!album || !album.images?.length) return;

  lightboxCurrentAlbum = album;
  lightboxImages = album.images;
  lightboxImageIndex = 0;

  updateLightbox();

  document.getElementById('lightbox').classList.add('active');
  document.body.style.overflow = 'hidden';

  stopAllSlideshows();
};

window.closeLightbox = function(e) {
  if (e && e.target !== e.currentTarget && !e.target.closest('.lightbox-close')) {
    if (e.target.closest('.lightbox-content') || e.target.closest('.lightbox-nav')) return;
  }
  document.getElementById('lightbox').classList.remove('active');
  document.body.style.overflow = '';

  startAllSlideshows();
};

window.lightboxNav = function(e, direction) {
  if (e) e.stopPropagation();
  if (lightboxImages.length <= 1) return;

  lightboxImageIndex = (lightboxImageIndex + direction + lightboxImages.length) % lightboxImages.length;
  updateLightbox();
};

function updateLightbox() {
  if (!lightboxCurrentAlbum || !lightboxImages.length) return;

  const album = lightboxCurrentAlbum;
  const catClass = CATEGORY_CLASS[album.category] || 'cat-lain';
  const catIcon = CATEGORY_ICON[album.category] || 'fa-tag';

  document.getElementById('lightboxImage').src = lightboxImages[lightboxImageIndex]?.url || '';
  document.getElementById('lightboxImage').alt = album.title || '';

  const badge = document.getElementById('lightboxBadge');
  badge.className = `lightbox-badge ${catClass}`;
  badge.innerHTML = `<i class="fas ${catIcon}"></i> ${escapeHtml(album.category || 'Lain-lain')}`;

  document.getElementById('lightboxTitle').textContent = album.title || 'Tanpa Tajuk';
  document.getElementById('lightboxDesc').textContent = album.description || '';

  const dateEl = document.getElementById('lightboxDate');
  if (album.date) {
    dateEl.querySelector('span').textContent = formatDateLong(album.date);
    dateEl.style.display = 'inline-flex';
  } else {
    dateEl.style.display = 'none';
  }

  document.getElementById('lightboxCounter').textContent =
    `${lightboxImageIndex + 1} / ${lightboxImages.length}`;

  const showNav = lightboxImages.length > 1;
  document.querySelectorAll('.lightbox-nav').forEach(btn => {
    btn.style.display = showNav ? 'flex' : 'none';
  });
}

/* ═══════════════════════════════════════════════════════════════
   ERROR STATE
   ═══════════════════════════════════════════════════════════════ */
function showError(message) {
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon-wrap" style="background: rgba(239, 68, 68, 0.1); color: var(--rose);">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <strong>Ralat Memuatkan</strong>
      <p>${escapeHtml(message)}</p>
    </div>`;
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

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return dateStr; }
}

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ms-MY', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

console.log(
  "%c 🖼️ Galeri UBK v3 ",
  "background:linear-gradient(135deg,#06B6D4,#4F46E5,#8B5CF6);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Preloader + Announcement bar ready");
