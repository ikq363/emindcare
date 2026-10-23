/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Dashboard Mood Check-In (Kaunselor)
   Logik: Realtime monitoring + filter + moderasi
   VERSION: 1.0
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

const DEBUG = true;
const log = (...a) => DEBUG && console.log('[Mood]', ...a);

log('✅ dashboard-mood.js LOADED');

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const MOOD_POSTS = 'mood_posts';
const DELETED_LOG = 'mood_deleted_log';

const MOOD_CONFIG = {
  happy:  { emoji: '😄', label: 'Gembira', color: '#F59E0B', color2: '#FBBF24' },
  calm:   { emoji: '😌', label: 'Tenang',  color: '#0F766E', color2: '#14B8A6' },
  stress: { emoji: '😰', label: 'Stres',   color: '#F97316', color2: '#F59E0B' },
  sad:    { emoji: '😢', label: 'Sedih',   color: '#6366F1', color2: '#8B5CF6' },
  angry:  { emoji: '😡', label: 'Marah',   color: '#EF4444', color2: '#F43F5E' },
  tired:  { emoji: '🫥', label: 'Penat',   color: '#64748B', color2: '#94A3B8' },
  default:{ emoji: '💭', label: 'Umum',    color: '#0F766E', color2: '#14B8A6' }
};

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let emindcare = null;
let currentUser = null;
let allPosts = [];
let filteredPosts = [];
let unsubPosts = null;

let activeMood = 'all';
let searchTerm = '';
let sortBy = 'newest';

let pendingDelete = null;
let pendingConfirmHandler = null;

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  try {
    emindcare = await waitForEMindCare();
    if (!authGuard()) return;
    applyBranding();
    populateProfile();
    bindEvents();
    setupRealtimeListener();
    log('🎉 INIT COMPLETE');
  } catch (err) {
    console.error('Init error:', err);
    showToast('Ralat', 'Gagal memuatkan halaman: ' + err.message, 'error');
  }
});

function waitForEMindCare() {
  return new Promise((resolve, reject) => {
    if (window.EMindCare) return resolve(window.EMindCare);
    let tries = 0;
    const t = setInterval(() => {
      if (window.EMindCare) { clearInterval(t); resolve(window.EMindCare); }
      else if (++tries > 100) { clearInterval(t); reject(new Error('SDK timeout')); }
    }, 50);
  });
}

/* ═══════════════════════════════════════════════════════════════
   AUTH GUARD
   ═══════════════════════════════════════════════════════════════ */
function authGuard() {
  let raw = null;
  try { raw = localStorage.getItem(SESSION_KEY); } catch (e) {}
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

/* ═══════════════════════════════════════════════════════════════
   PROFILE
   ═══════════════════════════════════════════════════════════════ */
function populateProfile() {
  if (!currentUser) return;
  const name = currentUser.fullName || 'Kaunselor';
  const el = document.getElementById('sbProfileName');
  const av = document.getElementById('sbAvatar');
  if (el) el.textContent = name;
  if (av) {
    if (currentUser.avatarUrl) av.innerHTML = `<img src="${currentUser.avatarUrl}" alt="">`;
    else av.textContent = name.charAt(0).toUpperCase();
  }
}

/* ═══════════════════════════════════════════════════════════════
   BRANDING
   ═══════════════════════════════════════════════════════════════ */
async function applyBranding() {
  try {
    const cfg = await emindcare.getSiteConfig();
    if (!cfg?.branding) return;
    const b = cfg.branding;
    if (b.name) {
      const el = document.getElementById('sbBrandName');
      if (el) el.textContent = b.name;
      document.title = 'Urus Mood Check-In · ' + b.name;
    }
    if (b.logoUrl) {
      const el = document.getElementById('sbLogo');
      if (el) el.innerHTML = `<img src="${b.logoUrl}" alt="">`;
    } else if (b.logoIcon) {
      const el = document.getElementById('sbLogo');
      if (el) el.innerHTML = `<i class="${b.logoIcon}"></i>`;
    }
    if (b.primaryColor) document.documentElement.style.setProperty('--teal', b.primaryColor);
    if (b.accentColor) document.documentElement.style.setProperty('--indigo', b.accentColor);
  } catch (e) { /* ignore */ }
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════ */
window.toggleSidebar = function() {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sbBackdrop');
  if (!sb || !bd) return;
  sb.classList.toggle('open');
  bd.classList.toggle('active');
};

window.logout = function() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {}
  window.location.href = 'login.html';
};

window.refreshAll = async function() {
  const btn = document.getElementById('refreshBtn');
  if (btn) btn.classList.add('spinning');
  try {
    await reloadPostsOnce();
    showToast('Berjaya', 'Data telah dikemas kini.', 'success', 2500);
  } catch (e) {
    showToast('Ralat', 'Gagal refresh: ' + e.message, 'error');
  } finally {
    setTimeout(() => btn?.classList.remove('spinning'), 600);
  }
};

/* ═══════════════════════════════════════════════════════════════
   BIND EVENTS
   ═══════════════════════════════════════════════════════════════ */
function bindEvents() {
  // Search
  const search = document.getElementById('searchInput');
  if (search) {
    let t;
    search.addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => {
        searchTerm = e.target.value.toLowerCase().trim();
        applyFilters();
      }, 250);
    });
  }

  // Sort
  const sort = document.getElementById('sortSelect');
  if (sort) {
    sort.addEventListener('change', e => {
      sortBy = e.target.value;
      applyFilters();
    });
  }

  // Mood chips
  document.querySelectorAll('.mood-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeMood = chip.dataset.mood;
      applyFilters();
    });
  });

  // ESC close modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeConfirmModal();
  });

  // Click backdrop close modal
  const modal = document.getElementById('confirmModal');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target.id === 'confirmModal') closeConfirmModal();
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   REALTIME LISTENER
   ═══════════════════════════════════════════════════════════════ */
function setupRealtimeListener() {
  log('👂 Setting up listener on', MOOD_POSTS);
  try {
    const { db, fs } = emindcare;
    if (unsubPosts) unsubPosts();

    unsubPosts = fs.onSnapshot(
      fs.collection(db, MOOD_POSTS),
      (snapshot) => {
        log(`📥 Received ${snapshot.size} posts`);
        allPosts = [];
        snapshot.forEach(doc => {
          allPosts.push({ id: doc.id, ...doc.data() });
        });

        updateStats();
        updateMoodBadge();
        applyFilters();

      },
      (err) => {
        console.error('Snapshot error:', err);
        showToast('Ralat', 'Gagal pantau data: ' + err.message, 'error');
      }
    );
  } catch (err) {
    console.error('Setup listener error:', err);
  }
}

async function reloadPostsOnce() {
  applyFilters();
  updateStats();
}

/* ═══════════════════════════════════════════════════════════════
   UPDATE STATS
   ═══════════════════════════════════════════════════════════════ */
function updateStats() {
  const total = allPosts.length;
  const moodCounts = { happy: 0, calm: 0, stress: 0, sad: 0, angry: 0, tired: 0 };

  allPosts.forEach(p => {
    const mood = p.mood || 'calm';
    if (moodCounts[mood] !== undefined) moodCounts[mood]++;
  });

  const positive = moodCounts.happy + moodCounts.calm;
  const risky = moodCounts.stress + moodCounts.sad + moodCounts.angry + moodCounts.tired;
  const positivePct = total > 0 ? Math.round((positive / total) * 100) : 0;
  const riskyPct = total > 0 ? Math.round((risky / total) * 100) : 0;

  animateNumber('statTotal', total);
  animateNumber('statPositive', positivePct, '%');
  animateNumber('statRisky', riskyPct, '%');

  // Count deleted from log
  countDeleted().then(n => animateNumber('statDeleted', n));

  // Update mood chip counters
  document.getElementById('countAll').textContent = total;
  document.getElementById('countHappy').textContent = moodCounts.happy;
  document.getElementById('countCalm').textContent = moodCounts.calm;
  document.getElementById('countStress').textContent = moodCounts.stress;
  document.getElementById('countSad').textContent = moodCounts.sad;
  document.getElementById('countAngry').textContent = moodCounts.angry;
  document.getElementById('countTired').textContent = moodCounts.tired;
}

async function countDeleted() {
  try {
    const { db, fs } = emindcare;
    const snap = await fs.getDocs(fs.collection(db, DELETED_LOG));
    return snap.size;
  } catch (e) {
    // Kalau log collection takda, return 0
    return 0;
  }
}

function updateMoodBadge() {
  const badge = document.getElementById('moodBadge');
  if (!badge) return;

  // Count posts hari ini
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = allPosts.filter(p => {
    const ts = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : null);
    return ts && ts >= today;
  }).length;

  if (todayCount > 0) {
    badge.textContent = todayCount;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function animateNumber(elId, target, suffix = '') {
  const el = document.getElementById(elId);
  if (!el) return;
  const duration = 900;
  const start = performance.now();
  (function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.floor(target * eased);
    el.innerHTML = val + (suffix ? `<span class="stat-unit">${suffix}</span>` : '');
    if (p < 1) requestAnimationFrame(tick);
    else el.innerHTML = target + (suffix ? `<span class="stat-unit">${suffix}</span>` : '');
  })(start);
}

/* ═══════════════════════════════════════════════════════════════
   APPLY FILTERS
   ═══════════════════════════════════════════════════════════════ */
function applyFilters() {
  let items = [...allPosts];

  // Filter mood
  if (activeMood !== 'all') {
    items = items.filter(p => (p.mood || 'calm') === activeMood);
  }

  // Search
  if (searchTerm) {
    items = items.filter(p => {
      const haystack = [
        p.text,
        p.alias,
        p.mood,
        p.note
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(searchTerm);
    });
  }

  // Sort
  switch (sortBy) {
    case 'oldest':
      items.sort((a, b) => getTimestamp(a) - getTimestamp(b));
      break;
    case 'popular':
      items.sort((a, b) => getReactionScore(b) - getReactionScore(a));
      break;
    case 'flagged':
      items = items.filter(p => p.isFlagged);
      items.sort((a, b) => getTimestamp(b) - getTimestamp(a));
      break;
    case 'pinned':
      items = items.filter(p => p.isPinned);
      items.sort((a, b) => getTimestamp(b) - getTimestamp(a));
      break;
    case 'newest':
    default:
      items.sort((a, b) => getTimestamp(b) - getTimestamp(a));
  }

  filteredPosts = items;
  renderGrid();
}

function getTimestamp(post) {
  if (!post.createdAt) return 0;
  if (post.createdAt.toDate) return post.createdAt.toDate().getTime();
  return new Date(post.createdAt).getTime();
}

function getReactionScore(post) {
  const r = post.reactions || {};
  return (r.sokong || 0) + (r.semangat || 0) + (r.pelukan || 0);
}

/* ═══════════════════════════════════════════════════════════════
   RENDER GRID
   ═══════════════════════════════════════════════════════════════ */
function renderGrid() {
  const grid = document.getElementById('moodGrid');
  if (!grid) return;

  if (!filteredPosts.length) {
    const isFiltered = allPosts.length > 0;
    grid.innerHTML = `
      <div class="panel-empty">
        <i class="fas ${isFiltered ? 'fa-search' : 'fa-inbox'}"></i>
        <h4>${isFiltered ? 'Tiada Luahan Dijumpai' : 'Belum Ada Luahan'}</h4>
        <p>${isFiltered ? 'Cuba tukar filter atau kata kunci carian.' : 'Luahan murid dari mood.html akan dipaparkan di sini.'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = filteredPosts.map((p, i) => renderCard(p, i)).join('');
}

function renderCard(p, index) {
  const mood = MOOD_CONFIG[p.mood] || MOOD_CONFIG.default;
  const alias = p.alias || 'Anonymous';
  const text = p.text || '—';
  const reactions = p.reactions || {};
  const timeAgo = formatTimeAgo(p.createdAt);
  const isPinned = !!p.isPinned;
  const isFlagged = !!p.isFlagged;

  const pinsHTML = `
    ${isPinned ? `<span class="mood-tag pinned"><i class="fas fa-thumbtack"></i> Disemat</span>` : ''}
    ${isFlagged ? `<span class="mood-tag flagged"><i class="fas fa-flag"></i> Berisiko</span>` : ''}
  `;

  return `
    <div class="mood-card ${isPinned ? 'pinned' : ''} ${isFlagged ? 'flagged' : ''}"
         style="--mood-color:${mood.color}; --mood-color2:${mood.color2}; animation-delay:${index * 0.04}s;">
      <div class="mood-card-head">
        <div class="mood-avatar">${mood.emoji}</div>
        <div class="mood-name-block">
          <div class="mood-alias">${escapeHtml(alias)}</div>
          <div class="mood-meta">
            <i class="fas fa-tag"></i> ${mood.label}
            <span>·</span>
            <i class="fas fa-clock"></i> ${timeAgo}
          </div>
        </div>
        ${pinsHTML ? `<div class="mood-badge-stack">${pinsHTML}</div>` : ''}
      </div>

      <div class="mood-text">${escapeHtml(text)}</div>

      <div class="mood-reactions">
        <span class="reaction-pill"><i class="fas fa-hands-helping"></i> <strong>${reactions.sokong || 0}</strong></span>
        <span class="reaction-pill"><i class="fas fa-fire"></i> <strong>${reactions.semangat || 0}</strong></span>
        <span class="reaction-pill"><i class="fas fa-heart"></i> <strong>${reactions.pelukan || 0}</strong></span>
      </div>

      <div class="mood-actions">
        <button class="action-btn pin ${isPinned ? 'active' : ''}"
                onclick="togglePinPost('${p.id}')"
                title="${isPinned ? 'Nyahsemat' : 'Sematkan ke atas'}">
          <i class="fas fa-thumbtack"></i>
          ${isPinned ? 'Disemat' : 'Semat'}
        </button>
        <button class="action-btn flag ${isFlagged ? 'active' : ''}"
                onclick="toggleFlagPost('${p.id}')"
                title="${isFlagged ? 'Nyah-tanda' : 'Tanda berisiko'}">
          <i class="fas fa-flag"></i>
          ${isFlagged ? 'Ditanda' : 'Tanda'}
        </button>
        <button class="action-btn delete"
                onclick="openDeleteConfirm('${p.id}')"
                title="Padam luahan">
          <i class="fas fa-trash-can"></i>
          Padam
        </button>
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   ACTION: DELETE
   ═══════════════════════════════════════════════════════════════ */
window.openDeleteConfirm = function(postId) {
  const post = allPosts.find(p => p.id === postId);
  if (!post) return;

  pendingDelete = postId;

  const title = document.getElementById('confirmTitle');
  const desc = document.getElementById('confirmDesc');
  const btn = document.getElementById('confirmBtn');

  title.textContent = 'Padam Luahan?';
  desc.innerHTML = `Luahan oleh <strong>${escapeHtml(post.alias || 'Anonymous')}</strong> akan dipadamkan secara kekal dari Firestore.`;
  btn.innerHTML = '<i class="fas fa-trash-can"></i> Ya, Padam';
  btn.className = 'btn btn-danger';

  pendingConfirmHandler = async () => {
    const btn = document.getElementById('confirmBtn');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px;"></span> Memadam...';

    try {
      const { db, fs } = emindcare;
      const docRef = fs.doc(db, MOOD_POSTS, postId);

      // Simpan log sebelum padam (untuk kira statistik)
      try {
        await fs.setDoc(fs.doc(db, DELETED_LOG, postId), {
          deletedAt: fs.serverTimestamp(),
          deletedBy: currentUser?.fullName || 'kaunselor',
          originalMood: post.mood || 'unknown',
          originalAlias: post.alias || 'Anonymous'
        });
      } catch (logErr) {
        log('Log save error (non-critical):', logErr.message);
      }

      // Padam
      await fs.deleteDoc(docRef);

      closeConfirmModal();
      showToast('Berjaya', 'Luahan telah dipadamkan.', 'success');

    } catch (err) {
      console.error('Delete error:', err);
      showToast('Ralat', 'Gagal padam: ' + err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  };

  document.getElementById('confirmModal').classList.add('active');
};

/* ═══════════════════════════════════════════════════════════════
   ACTION: TOGGLE PIN
   ═══════════════════════════════════════════════════════════════ */
window.togglePinPost = async function(postId) {
  const post = allPosts.find(p => p.id === postId);
  if (!post) return;

  const newValue = !post.isPinned;

  try {
    const { db, fs } = emindcare;
    await fs.updateDoc(fs.doc(db, MOOD_POSTS, postId), {
      isPinned: newValue,
      pinnedAt: newValue ? fs.serverTimestamp() : null,
      pinnedBy: newValue ? (currentUser?.fullName || 'kaunselor') : null
    });
    showToast('Berjaya', newValue ? 'Luahan disemat.' : 'Sematan dibuang.', 'success', 2500);
  } catch (err) {
    console.error('Pin error:', err);
    showToast('Ralat', 'Gagal kemas kini: ' + err.message, 'error');
  }
};

/* ═══════════════════════════════════════════════════════════════
   ACTION: TOGGLE FLAG
   ═══════════════════════════════════════════════════════════════ */
window.toggleFlagPost = async function(postId) {
  const post = allPosts.find(p => p.id === postId);
  if (!post) return;

  const newValue = !post.isFlagged;

  try {
    const { db, fs } = emindcare;
    await fs.updateDoc(fs.doc(db, MOOD_POSTS, postId), {
      isFlagged: newValue,
      flaggedAt: newValue ? fs.serverTimestamp() : null,
      flaggedBy: newValue ? (currentUser?.fullName || 'kaunselor') : null
    });
    showToast(
      'Berjaya',
      newValue ? 'Luahan ditanda berisiko untuk follow-up.' : 'Tanda berisiko dibuang.',
      newValue ? 'warning' : 'success',
      3000
    );
  } catch (err) {
    console.error('Flag error:', err);
    showToast('Ralat', 'Gagal kemas kini: ' + err.message, 'error');
  }
};

/* ═══════════════════════════════════════════════════════════════
   CONFIRM MODAL
   ═══════════════════════════════════════════════════════════════ */
window.closeConfirmModal = function() {
  document.getElementById('confirmModal').classList.remove('active');
  pendingDelete = null;
  pendingConfirmHandler = null;
};

document.getElementById('confirmBtn')?.addEventListener('click', async () => {
  if (typeof pendingConfirmHandler === 'function') {
    await pendingConfirmHandler();
  }
});

/* ═══════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════ */
function showToast(title, message, type = 'success', duration = 4000) {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const icons = { success: 'fa-check', error: 'fa-times', info: 'fa-info', warning: 'fa-exclamation' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `
    <div class="toast-icon"><i class="fas ${icons[type] || 'fa-info'}"></i></div>
    <div class="toast-content"><strong>${title}</strong><span>${message}</span></div>
  `;
  c.appendChild(t);
  setTimeout(() => {
    t.classList.add('removing');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Baru sahaja';
  let date;
  try {
    date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  } catch { return '—'; }

  const now = Date.now();
  const diff = now - date.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (sec < 60) return 'Baru sahaja';
  if (min < 60) return `${min} minit lepas`;
  if (hour < 24) return `${hour} jam lepas`;
  if (day < 7) return `${day} hari lepas`;
  return date.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

/* Cleanup */
window.addEventListener('beforeunload', () => {
  if (unsubPosts) {
    try { unsubPosts(); } catch (e) {}
  }
});

console.log(
  "%c 🎭 Dashboard Mood Check-In ",
  "background:linear-gradient(135deg,#0F172A,#0F766E,#4F46E5);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
log('🎯 Ready — Realtime monitoring active');
