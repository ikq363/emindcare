/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Centralized Sidebar
   Auto-inject sidebar HTML ke semua page

   ⭐ MENU BARU DITAMBAH: Mood Check-In → dashboard-mood.html

   ═══════════════════════════════════════════════════════════════
   UNTUK TAMBAH MENU BARU:
   1. Edit SIDEBAR_MENU array di bawah
   2. Tambah object baru dalam section yang sesuai
   3. Semua page auto-update ✅
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   KONFIGURASI MENU SIDEBAR
   Setiap section: { label: string, items: [...] }
   Setiap item: { icon, text, href, badgeId?, key?, special? }
   - key     = identifier unik untuk detect active state
   - special = extra class untuk styling khas (cth: 'mood')
   - emoji   = emoji kecil di kanan (optional)
   ═══════════════════════════════════════════════════ */
const SIDEBAR_MENU = [
  {
    label: 'Utama',
    items: [
      { key: 'overview',   icon: 'fas fa-chart-pie',    text: 'Overview',          href: 'dashboard-kaunselor.html' },
      { key: 'profile',    icon: 'fas fa-user-circle',  text: 'Profil Kaunselor',  href: 'dashboard-profile.html' }
    ]
  },
  {
    label: 'Kandungan Laman',
    items: [
      { key: 'announcements', icon: 'fas fa-bullhorn',     text: 'Pengumuman',           href: 'dashboard-iklan.html?tab=announcements' },
      { key: 'banners',       icon: 'fas fa-images',       text: 'Banner Iklan',         href: 'dashboard-iklan.html?tab=banners' },
      { key: 'collabs',       icon: 'fas fa-handshake',    text: 'Kolaborasi',           href: 'dashboard-iklan.html?tab=collabs' },
      { key: 'landing',       icon: 'fas fa-paint-brush',  text: 'Sunting Laman',        href: 'dashboard-sunting-laman.html' },
      { key: 'gallery',       icon: 'fas fa-photo-video',  text: 'Galeri UBK',           href: 'dashboard-galeri.html' },
      { key: 'contact',       icon: 'fas fa-address-book', text: 'Hubungi & Lokasi',     href: 'dashboard-contact.html', badgeId: 'sbUnreadBadge' }
    ]
  },
  {
    // ⭐ SECTION BARU — Mood & Kesejahteraan
    label: 'Mood & Kesejahteraan',
    items: [
      {
        key: 'mood',
        icon: 'fas fa-face-smile',
        text: 'Mood Check-In',
        href: 'dashboard-mood.html',
        special: 'mood',
        emoji: '🌈'
      }
    ]
  },
  {
    label: 'Pengurusan',
    items: [
      { key: 'inventories',  icon: 'fas fa-clipboard-list', text: 'Ujian Inventori',      href: 'dashboard-inventories.html' },
      { key: 'users',        icon: 'fas fa-users',          text: 'Urus Pengguna',        href: 'dashboard-users.html' },
      { key: 'appointments', icon: 'fas fa-calendar-check', text: 'Tempahan Kaunseling',  href: 'dashboard-appointments.html', badgeId: 'pendingBadge' },
      { key: 'diaries',      icon: 'fas fa-book',           text: 'Diari & Catatan',      href: 'dashboard-diaries.html' }
    ]
  },
  {
    label: 'Analitik',
    items: [
      { key: 'analytics',    icon: 'fas fa-chart-line',     text: 'Data & Laporan',       href: 'dashboard-analytics.html' }
    ]
  }
];

/* ═══════════════════════════════════════════════════════════════
   DETECT ACTIVE PAGE
   Cuba padankan dengan URL saat ini
   ═══════════════════════════════════════════════════════════════ */
function detectActiveKey() {
  const path = window.location.pathname.split('/').pop() || 'dashboard-kaunselor.html';
  const urlParams = new URLSearchParams(window.location.search);
  const currentTab = urlParams.get('tab');

  // Special cases — multi-page dengan tab
  if (path === 'dashboard-iklan.html') {
    if (currentTab === 'announcements') return 'announcements';
    if (currentTab === 'banners') return 'banners';
    if (currentTab === 'collabs') return 'collabs';
    return 'announcements';
  }

  // Map filenames → keys
  const fileMap = {
    'dashboard-kaunselor.html':    'overview',
    'dashboard-profile.html':      'profile',
    'dashboard-sunting-laman.html':'landing',
    'dashboard-galeri.html':       'gallery',
    'dashboard-gallery.html':      'gallery',
    'dashboard-contact.html':      'contact',
    'dashboard-mood.html':         'mood',           // ⭐ BARU
    'dashboard-inventories.html':  'inventories',
    'dashboard-users.html':        'users',
    'dashboard-user.html':         'users',
    'dashboard-appointments.html': 'appointments',
    'dashboard-diaries.html':      'diaries',
    'dashboard-analytics.html':    'analytics'
  };

  return fileMap[path] || null;
}

/* ═══════════════════════════════════════════════════════════════
   BUILD SIDEBAR HTML
   ═══════════════════════════════════════════════════════════════ */
function buildSidebarHTML() {
  const activeKey = detectActiveKey();

  const sectionsHTML = SIDEBAR_MENU.map(section => {
    const itemsHTML = section.items.map(item => {
      const isActive = item.key === activeKey;
      const specialClass = item.special ? ` sb-item-${item.special}` : '';
      const badgeHTML = item.badgeId
        ? `<span class="sb-badge" id="${item.badgeId}" style="display:none;">0</span>`
        : '';
      const emojiHTML = item.emoji
        ? `<span class="sb-mood-emoji">${item.emoji}</span>`
        : '';

      return `
        <a href="${item.href}" class="sb-item${specialClass}${isActive ? ' active' : ''}" data-key="${item.key}">
          <i class="${item.icon}"></i>
          <span>${item.text}</span>
          ${badgeHTML}
          ${emojiHTML}
        </a>
      `;
    }).join('');

    return `
      <div class="sb-section-label">${section.label}</div>
      ${itemsHTML}
    `;
  }).join('');

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sb-brand">
        <div class="sb-brand-logo" id="sbLogo"><i class="fas fa-brain"></i></div>
        <div class="sb-brand-text">
          <strong id="sbBrandName">e-MindCare</strong>
          <span>Dashboard Kaunselor</span>
        </div>
      </div>

      <a href="dashboard-profile.html" class="sb-profile">
        <div class="sb-avatar" id="sbAvatar">K</div>
        <div class="sb-profile-info">
          <strong id="sbProfileName">Kaunselor</strong>
          <span>Kaunselor UBK</span>
        </div>
      </a>

      <nav class="sb-menu">
        ${sectionsHTML}
      </nav>

      <div class="sb-footer">
        <button class="sb-footer-btn" onclick="logout()">
          <i class="fas fa-sign-out-alt"></i>
          <span>Log Keluar</span>
        </button>
      </div>
    </aside>
    <div class="sb-backdrop" id="sbBackdrop" onclick="toggleSidebar()"></div>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   INJECT SIDEBAR
   ═══════════════════════════════════════════════════════════════ */
function injectSidebar() {
  const root = document.getElementById('sidebar-root');
  if (!root) {
    console.warn('[Sidebar] #sidebar-root not found — skipping injection');
    return;
  }
  root.innerHTML = buildSidebarHTML();
  console.log('[Sidebar] Injected — active:', detectActiveKey() || 'none');
}

/* Auto-run on DOM ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectSidebar);
} else {
  injectSidebar();
}

/* ═══════════════════════════════════════════════════════════════
   TOGGLE SIDEBAR (untuk mobile)
   ═══════════════════════════════════════════════════════════════ */
window.toggleSidebar = function() {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sbBackdrop');
  if (sb) sb.classList.toggle('open');
  if (bd) bd.classList.toggle('active');
};

/* Expose untuk dashboard-kaunselor.js populate profile */
window.SIDEBAR = { SIDEBAR_MENU, detectActiveKey, injectSidebar };
