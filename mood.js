/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Mood Check-In Anonymous (mood.js)
   Logik: Submit + Random Alias + Filter Kata Sensitif + Realtime
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

const DEBUG = true;
const log = (...a) => DEBUG && console.log('[Mood]', ...a);

log('✅ mood.js LOADED');

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const MOOD_POSTS = 'mood_posts';
const MAX_TEXT_LENGTH = 300;
const REACTED_STORAGE_KEY = 'emindcare_mood_reacted';

const MOODS = {
  happy: { emoji: '😄', label: 'Gembira', color: '#F59E0B' },
  calm:  { emoji: '😌', label: 'Tenang',  color: '#0D9488' },
  stress:{ emoji: '😰', label: 'Stres',   color: '#F97316' },
  sad:   { emoji: '😢', label: 'Sedih',   color: '#6366F1' },
  angry: { emoji: '😡', label: 'Marah',   color: '#EF4444' },
  tired: { emoji: '🫥', label: 'Penat',   color: '#64748B' }
};

/* Nama anonymous generator - prefix + noun */
const ALIAS_PREFIXES = [
  'Awan', 'Bintang', 'Bulan', 'Matahari', 'Pelangi', 'Kabut', 'Salju', 'Angin',
  'Ombak', 'Daun', 'Bunga', 'Kupu', 'Burung', 'Ikan', 'Rusa', 'Arnab',
  'Kucing', 'Anjing', 'Panda', 'Koala', 'Musang', 'Tupai', 'Kancil', 'Merpati',
  'Laut', 'Langit', 'Gunung', 'Hutan', 'Padang', 'Sungai', 'Tasik', 'Gua'
];

const ALIAS_NOUNS = [
  'Biru', 'Merah', 'Hijau', 'Kuning', 'Ungu', 'Emas', 'Perak', 'Putih',
  'Senja', 'Pagi', 'Malam', 'Fajar', 'Kabus', 'Hujan', 'Cerah', 'Teduh',
  'Damai', 'Ceriа', 'Tenang', 'Manis', 'Comel', 'Mesra', 'Hangat', 'Lembut',
  'Kecil', 'Besar', 'Tinggi', 'Cantik', 'Indah', 'Wangі', 'Harum', 'Suci'
];

/* Kata sensitif / bahaya untuk semak */
const SENSITIVE_PATTERNS = [
  /bunuh diri/i,
  /nak mati/i,
  /mahu mati/i,
  /ingin mati/i,
  /mati sahaja/i,
  /akhiri hidup/i,
  /tamatkan hidup/i,
  /tak nak hidup/i,
  /tak mahu hidup/i,
  /lukai diri/i,
  /cederakan diri/i,
  /sakiti diri/i,
  /potong tangan/i,
  /potong urat/i,
  /suicide/i,
  /kill myself/i,
  /end my life/i,
  /self.?harm/i,
  /hurt myself/i
];

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let emindcare = null;
let selectedMood = null;
let selectedColor = '#FCE7F3';
let currentAlias = '';
let pendingPost = null;
let allPosts = [];
let unsubPosts = null;
let reactedPosts = new Set();

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  try {
    emindcare = await waitForEMindCare();
    loadReactedHistory();
    generateAlias();
    bindEvents();
    setupRealtimeListener();
    log('🎉 INIT COMPLETE');
  } catch (err) {
    console.error('Init error:', err);
    showToast('Ralat', 'Gagal memuatkan halaman.', 'error');
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
   BIND EVENTS
   ═══════════════════════════════════════════════════════════════ */
function bindEvents() {
  // Mood selector
  document.querySelectorAll('.mood-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMood = btn.dataset.mood;
      log('Mood selected:', selectedMood);
    });
  });

  // Color picker
  document.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.dataset.color;
      log('Color selected:', selectedColor);
    });
  });

  // Alias refresh
  document.getElementById('aliasRefresh')?.addEventListener('click', () => {
    generateAlias();
    log('Alias refreshed:', currentAlias);
  });

  // Text counter
  const textarea = document.getElementById('moodText');
  if (textarea) {
    textarea.addEventListener('input', (e) => {
      const len = e.target.value.length;
      const limit = document.getElementById('charLimit');
      if (limit) {
        limit.textContent = `${len} / ${MAX_TEXT_LENGTH}`;
        limit.classList.remove('warn', 'danger');
        if (len >= MAX_TEXT_LENGTH * 0.9) limit.classList.add('danger');
        else if (len >= MAX_TEXT_LENGTH * 0.75) limit.classList.add('warn');
      }
    });
  }

  // Form submit
  document.getElementById('moodForm')?.addEventListener('submit', handleSubmit);

  // Close safety modal
  document.getElementById('safetyModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'safetyModal') closeSafetyModal();
  });
}

/* ═══════════════════════════════════════════════════════════════
   🎲 RANDOM ANONYMOUS NAME
   ═══════════════════════════════════════════════════════════════ */
function generateAlias() {
  const prefix = ALIAS_PREFIXES[Math.floor(Math.random() * ALIAS_PREFIXES.length)];
  const noun = ALIAS_NOUNS[Math.floor(Math.random() * ALIAS_NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;

  currentAlias = `${prefix} ${noun} #${num}`;
  const el = document.getElementById('aliasName');
  if (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    setTimeout(() => {
      el.textContent = currentAlias;
      el.style.transition = 'all 0.3s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 100);
  }
}

/* ═══════════════════════════════════════════════════════════════
   🛡️ SENSITIVE CONTENT FILTER
   ═══════════════════════════════════════════════════════════════ */
function containsSensitiveContent(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(lower));
}

window.closeSafetyModal = function() {
  document.getElementById('safetyModal').classList.remove('active');
  // User pilih continue — submit post tanpa block
  if (pendingPost) {
    const post = pendingPost;
    pendingPost = null;
    actuallySubmitPost(post);
  }
};

/* ═══════════════════════════════════════════════════════════════
   SUBMIT HANDLER
   ═══════════════════════════════════════════════════════════════ */
async function handleSubmit(e) {
  e.preventDefault();

  if (!selectedMood) {
    showToast('Pilih Mood', 'Sila pilih emoji mood anda dahulu.', 'warning');
    return;
  }

  const text = document.getElementById('moodText').value.trim();
  if (!text) {
    showToast('Luahan Kosong', 'Sila tulis luahan anda.', 'warning');
    return;
  }
  if (text.length < 5) {
    showToast('Terlalu Pendek', 'Luahan perlu sekurang-kurangnya 5 aksara.', 'warning');
    return;
  }

  const post = {
    alias: currentAlias,
    mood: selectedMood,
    text: text,
    color: selectedColor,
    reactions: { sokong: 0, semangat: 0, pelukan: 0 }
  };

  // Semak sensitive content
  if (containsSensitiveContent(text)) {
    pendingPost = post;
    document.getElementById('safetyModal').classList.add('active');
    return;
  }

  await actuallySubmitPost(post);
}

async function actuallySubmitPost(post) {
  const btn = document.getElementById('submitBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span><span>Menghantar...</span>';

  try {
    const { db, fs } = emindcare;

    await fs.addDoc(fs.collection(db, MOOD_POSTS), {
      alias: post.alias,
      mood: post.mood,
      text: post.text,
      color: post.color,
      reactions: post.reactions,
      isPinned: false,
      isFlagged: false,
      createdAt: fs.serverTimestamp()
    });

    // Reset form
    document.getElementById('moodForm').reset();
    document.querySelectorAll('.mood-option').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.color-option').forEach((b, i) => b.classList.toggle('selected', i === 0));
    document.getElementById('charLimit').textContent = `0 / ${MAX_TEXT_LENGTH}`;
    document.getElementById('charLimit').classList.remove('warn', 'danger');

    selectedMood = null;
    selectedColor = '#FCE7F3';
    generateAlias();

    showToast('Berjaya! 💗', 'Luahan anda telah dihantar. Terima kasih kerana berkongsi.', 'success');

  } catch (err) {
    console.error('Submit error:', err);
    showToast('Gagal Hantar', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

/* ═══════════════════════════════════════════════════════════════
   REALTIME LISTENER
   ═══════════════════════════════════════════════════════════════ */
function setupRealtimeListener() {
  try {
    const { db, fs } = emindcare;
    if (unsubPosts) unsubPosts();

    unsubPosts = fs.onSnapshot(
      fs.collection(db, MOOD_POSTS),
      (snapshot) => {
        allPosts = [];
        snapshot.forEach(doc => {
          allPosts.push({ id: doc.id, ...doc.data() });
        });
        log(`📥 Received ${allPosts.length} posts`);

        allPosts.sort((a, b) => getTimestamp(b) - getTimestamp(a));
        updateMoodMeter();
        renderWall();
      },
      (err) => {
        console.error('Snapshot error:', err);
        showToast('Ralat', 'Gagal pantau luahan: ' + err.message, 'error');
      }
    );
  } catch (err) {
    console.error('Setup listener error:', err);
  }
}

function getTimestamp(post) {
  if (!post.createdAt) return 0;
  if (post.createdAt.toDate) return post.createdAt.toDate().getTime();
  return new Date(post.createdAt).getTime();
}

/* ═══════════════════════════════════════════════════════════════
   UPDATE MOOD METER (Today's mood percentages)
   ═══════════════════════════════════════════════════════════════ */
function updateMoodMeter() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayPosts = allPosts.filter(p => {
    const ts = getTimestamp(p);
    return ts >= today.getTime();
  });

  const counts = { happy: 0, calm: 0, stress: 0, sad: 0, angry: 0, tired: 0 };
  todayPosts.forEach(p => {
    if (counts[p.mood] !== undefined) counts[p.mood]++;
  });

  const total = todayPosts.length;
  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;

  const map = {
    happy: 'pctHappy',
    calm: 'pctCalm',
    stress: 'pctStress',
    sad: 'pctSad',
    angry: 'pctAngry',
    tired: 'pctTired'
  };

  Object.keys(map).forEach(mood => {
    const el = document.getElementById(map[mood]);
    if (el) el.textContent = total > 0 ? `${pct(counts[mood])}%` : '—';
  });
}

/* ═══════════════════════════════════════════════════════════════
   RENDER WALL
   ═══════════════════════════════════════════════════════════════ */
function renderWall() {
  const grid = document.getElementById('wallGrid');
  const countEl = document.getElementById('wallCount');
  if (!grid) return;

  if (countEl) countEl.textContent = allPosts.length;

  if (!allPosts.length) {
    grid.innerHTML = `
      <div class="wall-empty">
        <i class="fas fa-comment-dots"></i>
        <h4>Belum Ada Luahan</h4>
        <p>Jadi yang pertama berkongsi perasaan anda hari ini.</p>
      </div>`;
    return;
  }

  // Papar 20 luahan terkini sahaja
  const displayPosts = allPosts.slice(0, 20);

  grid.innerHTML = displayPosts.map((p, i) => {
    const mood = MOODS[p.mood] || MOODS.calm;
    const textColor = getTextColorForBg(p.color || '#FCE7F3');
    const reactions = p.reactions || {};
    const hasReacted = reactedPosts.has(p.id);

    return `
      <div class="wall-card ${p.isPinned ? 'pinned' : ''}"
           style="--card-bg: ${p.color || '#FCE7F3'}; --card-avatar: linear-gradient(135deg, ${mood.color}, var(--violet)); animation-delay: ${i * 0.04}s;">

        ${p.isPinned ? `<div style="position: absolute; top: 0.8rem; right: 0.8rem; color: #B45309; font-size: 0.9rem;"><i class="fas fa-thumbtack"></i></div>` : ''}

        <div class="wall-card-head">
          <div class="wall-avatar">${mood.emoji}</div>
          <div class="wall-name-block">
            <div class="wall-alias">${escapeHtml(p.alias || 'Anonymous')}</div>
            <div class="wall-time">
              <i class="fas fa-clock"></i>
              ${formatTimeAgo(p.createdAt)}
            </div>
          </div>
        </div>

        <div class="wall-text">${escapeHtml(p.text || '')}</div>

        <div class="wall-reactions">
          <button class="reaction-btn ${hasReacted ? 'reacted' : ''}"
                  onclick="reactToPost('${p.id}', 'sokong')"
                  data-post="${p.id}" data-reaction="sokong">
            <i class="fas fa-hands-helping"></i>
            <span class="cnt">${reactions.sokong || 0}</span>
          </button>
          <button class="reaction-btn ${hasReacted ? 'reacted' : ''}"
                  onclick="reactToPost('${p.id}', 'semangat')"
                  data-post="${p.id}" data-reaction="semangat">
            <i class="fas fa-fire"></i>
            <span class="cnt">${reactions.semangat || 0}</span>
          </button>
          <button class="reaction-btn ${hasReacted ? 'reacted' : ''}"
                  onclick="reactToPost('${p.id}', 'pelukan')"
                  data-post="${p.id}" data-reaction="pelukan">
            <i class="fas fa-heart"></i>
            <span class="cnt">${reactions.pelukan || 0}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function getTextColorForBg(hex) {
  return '#0F172A'; // Untuk pastel, sentiasa gelap
}

/* ═══════════════════════════════════════════════════════════════
   REACTION
   ═══════════════════════════════════════════════════════════════ */
window.reactToPost = async function(postId, reactionType) {
  if (reactedPosts.has(postId)) {
    showToast('Sudah Bertindak', 'Anda sudah memberi reaksi pada luahan ini.', 'info', 2500);
    return;
  }

  try {
    const { db, fs } = emindcare;
    const postRef = fs.doc(db, MOOD_POSTS, postId);
    await fs.updateDoc(postRef, {
      [`reactions.${reactionType}`]: fs.increment(1)
    });

    reactedPosts.add(postId);
    saveReactedHistory();
    showToast('Terima Kasih 💗', 'Reaksi anda telah dihantar.', 'success', 2000);

  } catch (err) {
    console.error('React error:', err);
    showToast('Gagal', err.message, 'error');
  }
};

function saveReactedHistory() {
  try {
    sessionStorage.setItem(REACTED_STORAGE_KEY, JSON.stringify([...reactedPosts]));
  } catch (e) {}
}

function loadReactedHistory() {
  try {
    const raw = sessionStorage.getItem(REACTED_STORAGE_KEY);
    if (raw) reactedPosts = new Set(JSON.parse(raw));
  } catch (e) {}
}

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
function formatTimeAgo(ts) {
  if (!ts) return 'Baru sahaja';
  let date;
  try { date = ts.toDate ? ts.toDate() : new Date(ts); } catch { return '—'; }
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return 'Baru sahaja';
  if (min < 60) return `${min} minit lepas`;
  if (hr < 24) return `${hr} jam lepas`;
  if (day < 7) return `${day} hari lepas`;
  return date.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' });
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

window.addEventListener('beforeunload', () => {
  if (unsubPosts) {
    try { unsubPosts(); } catch (e) {}
  }
});

console.log(
  "%c 🎭 Mood Check-In ",
  "background:linear-gradient(135deg,#EC4899,#8B5CF6,#0D9488);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
log('🎯 Ready — Anonymous wall active');
