/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Mood Check-In (mood.js) — FIXED VERSION
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

const DEBUG = true;
const log = (...a) => DEBUG && console.log('[Mood]', ...a);
const err = (...a) => console.error('[Mood:ERROR]', ...a);

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

const ALIAS_PREFIXES = [
  'Awan', 'Bintang', 'Bulan', 'Matahari', 'Pelangi', 'Kabut', 'Salju', 'Angin',
  'Ombak', 'Daun', 'Bunga', 'Kupu', 'Burung', 'Ikan', 'Rusa', 'Arnab',
  'Kucing', 'Anjing', 'Panda', 'Koala', 'Musang', 'Tupai', 'Kancil', 'Merpati',
  'Laut', 'Langit', 'Gunung', 'Hutan', 'Padang', 'Sungai', 'Tasik', 'Gua'
];

const ALIAS_NOUNS = [
  'Biru', 'Merah', 'Hijau', 'Kuning', 'Ungu', 'Emas', 'Perak', 'Putih',
  'Senja', 'Pagi', 'Malam', 'Fajar', 'Kabus', 'Hujan', 'Cerah', 'Teduh',
  'Damai', 'Ceria', 'Tenang', 'Manis', 'Comel', 'Mesra', 'Hangat', 'Lembut',
  'Kecil', 'Besar', 'Tinggi', 'Cantik', 'Indah', 'Wangi', 'Harum', 'Suci'
];

const SENSITIVE_PATTERNS = [
  /bunuh diri/i, /nak mati/i, /mahu mati/i, /ingin mati/i, /mati sahaja/i,
  /akhiri hidup/i, /tamatkan hidup/i, /tak nak hidup/i, /tak mahu hidup/i,
  /lukai diri/i, /cederakan diri/i, /sakiti diri/i, /potong tangan/i,
  /potong urat/i, /suicide/i, /kill myself/i, /end my life/i,
  /self.?harm/i, /hurt myself/i
];

/* ═══════════════════════════════════════════════════════════════
   QUOTES
   ═══════════════════════════════════════════════════════════════ */
const QUOTES = [
  { text: "Setiap hari adalah peluang baru untuk menjadi lebih baik.", author: "e-MindCare" },
  { text: "Anda tidak perlu sempurna untuk menjadi hebat.", author: "Anonym" },
  { text: "Perasaan yang diluahkan adalah perasaan yang disembuhkan.", author: "e-MindCare" },
  { text: "Kekuatan sejati bukan pada tidak pernah jatuh, tetapi pada bangkit setiap kali.", author: "Anonym" },
  { text: "Tidak mengapa untuk tidak mengapa. Berehatlah jika perlu.", author: "e-MindCare" },
  { text: "Anda lebih berani daripada yang anda sangka, lebih kuat daripada yang anda nampak.", author: "A.A. Milne" },
  { text: "Setiap perjalanan seribu batu dimulai dengan satu langkah.", author: "Lao Tzu" },
  { text: "Jaga diri sendiri seperti anda menjaga orang yang anda sayangi.", author: "e-MindCare" },
  { text: "Air mata bukan tanda kelemahan. Ia tanda anda sedang berjuang.", author: "Anonym" },
  { text: "Anda tidak bersendirian dalam perjalanan ini.", author: "e-MindCare" },
  { text: "Bahagia bukan tentang memiliki segalanya, tetapi mensyukuri apa yang ada.", author: "Anonym" },
  { text: "Ceritakan pada diri sendiri: 'Saya sedang berusaha, dan itu sudah cukup.'", author: "e-MindCare" },
  { text: "Bunga tidak mekar dengan tergesa-gesa. Begitu juga anda.", author: "Anonym" },
  { text: "Kadang-kadang, perkara terbaik yang boleh anda lakukan adalah bernafas.", author: "e-MindCare" },
  { text: "Anda tidak perlu kuat sepanjang masa. Kadang-kadang, cukup sekadar hadir.", author: "Anonym" },
  { text: "Kesedihan hari ini akan menjadi kebijaksanaan esok.", author: "e-MindCare" },
  { text: "Jangan bandingkan perjalanan anda dengan perjalanan orang lain.", author: "Anonym" },
  { text: "Merawat minda adalah tanda keberanian, bukan kelemahan.", author: "e-MindCare" },
  { text: "Satu langkah kecil hari ini boleh mengubah segalanya esok.", author: "Anonym" },
  { text: "Tiada perasaan yang kekal selamanya. Ini juga akan berlalu.", author: "e-MindCare" },
  { text: "Anda cukup baik, walaupun anda rasa tidak.", author: "Anonym" },
  { text: "Berhenti seketika, bernafas, dan ingat: anda okay.", author: "e-MindCare" },
  { text: "Cerita anda belum berakhir. Masih banyak babak indah menanti.", author: "Anonym" },
  { text: "Jangan takut untuk meminta bantuan. Itu tanda kekuatan, bukan kelemahan.", author: "e-MindCare" },
  { text: "Hari ini mungkin berat, tetapi anda masih di sini. Itu hebat.", author: "Anonym" },
  { text: "Cinta paling penting adalah cinta pada diri sendiri.", author: "e-MindCare" },
  { text: "Hidup bukan tentang menjadi sempurna, tetapi menjadi real.", author: "Anonym" },
  { text: "Setiap nafas adalah peluang baru untuk mula semula.", author: "e-MindCare" },
  { text: "Senyum pada diri sendiri di cermin. Anda layak.", author: "Anonym" },
  { text: "Masa lalu bukan penjara. Ia adalah pelajaran.", author: "e-MindCare" }
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

let currentQuoteIndex = 0;
let quoteIntervalId = null;

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  log('🚀 Page loaded — starting init...');

  // Start UI functions dulu (tak perlu tunggu Firebase)
  try {
    initSparkles();
    initQuoteOfTheDay();
    updateLiveClock();
    setInterval(updateLiveClock, 1000);
    log('✅ UI (sparkles, quotes, clock) ready');
  } catch (e) {
    err('UI init error:', e);
  }

  // Kemudian init Firebase
  try {
    log('⏳ Waiting for EMindCare SDK...');
    emindcare = await waitForEMindCare();
    log('✅ EMindCare SDK ready');
    log('   Firebase project:', emindcare.db?.app?.options?.projectId || 'unknown');
    log('   Collections available: modul, users, announcements, mood_posts, dll');

    loadReactedHistory();
    generateAlias();
    bindEvents();
    log('✅ Events bound');

    setupRealtimeListener();
    log('✅ Realtime listener started');

    loadAnnouncements();
    log('✅ Announcements loading...');

    log('🎉 INIT COMPLETE');
  } catch (e) {
    err('Init error:', e);
    showToast('Ralat Sistem', 'Gagal memuatkan data. Cuba refresh halaman.', 'error');
  }
});

function waitForEMindCare() {
  return new Promise((resolve, reject) => {
    if (window.EMindCare) return resolve(window.EMindCare);
    let tries = 0;
    const t = setInterval(() => {
      if (window.EMindCare) { clearInterval(t); resolve(window.EMindCare); }
      else if (++tries > 200) { clearInterval(t); reject(new Error('SDK timeout — config.js tak load?')); }
    }, 50);
  });
}

/* ═══════════════════════════════════════════════════════════════
   BIND EVENTS
   ═══════════════════════════════════════════════════════════════ */
function bindEvents() {
  document.querySelectorAll('.mood-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMood = btn.dataset.mood;
      log('Mood:', selectedMood);
    });
  });

  document.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.dataset.color;
    });
  });

  document.getElementById('aliasRefresh')?.addEventListener('click', () => generateAlias());

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

  document.getElementById('moodForm')?.addEventListener('submit', handleSubmit);

  document.getElementById('safetyModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'safetyModal') closeSafetyModal();
  });
}

/* ═══════════════════════════════════════════════════════════════
   🕐 LIVE CLOCK
   ═══════════════════════════════════════════════════════════════ */
const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

function updateLiveClock() {
  const now = new Date();
  const timeEl = document.getElementById('clockTime');
  const dateEl = document.getElementById('clockDate');
  if (!timeEl || !dateEl) return;

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  timeEl.textContent = `${hh}:${mm}:${ss}`;
  dateEl.textContent = `${HARI[now.getDay()]}, ${now.getDate()} ${BULAN[now.getMonth()]}`;
}

/* ═══════════════════════════════════════════════════════════════
   💬 QUOTE OF THE DAY
   ═══════════════════════════════════════════════════════════════ */
function initQuoteOfTheDay() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  currentQuoteIndex = dayOfYear % QUOTES.length;
  renderQuote();
  buildQuoteDots();

  quoteIntervalId = setInterval(() => {
    currentQuoteIndex = (currentQuoteIndex + 1) % QUOTES.length;
    renderQuote();
  }, 15000);
}

function renderQuote() {
  const q = QUOTES[currentQuoteIndex];
  const textEl = document.getElementById('quoteText');
  const authorEl = document.getElementById('quoteAuthor');
  if (!textEl || !authorEl) return;

  textEl.style.opacity = '0';
  authorEl.style.opacity = '0';

  setTimeout(() => {
    textEl.textContent = `"${q.text}"`;
    authorEl.textContent = q.author;
    textEl.style.transition = 'opacity 0.4s ease';
    authorEl.style.transition = 'opacity 0.4s ease';
    textEl.style.opacity = '1';
    authorEl.style.opacity = '1';
  }, 200);

  updateQuoteDots();
}

function buildQuoteDots() {
  const nav = document.getElementById('quoteNav');
  if (!nav) return;
  nav.innerHTML = '';
  const total = Math.min(QUOTES.length, 8);
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('button');
    dot.className = 'quote-dot' + (i === (currentQuoteIndex % total) ? ' active' : '');
    dot.addEventListener('click', () => {
      currentQuoteIndex = (currentQuoteIndex - (currentQuoteIndex % total) + i) % QUOTES.length;
      renderQuote();
      clearInterval(quoteIntervalId);
      quoteIntervalId = setInterval(() => {
        currentQuoteIndex = (currentQuoteIndex + 1) % QUOTES.length;
        renderQuote();
      }, 15000);
    });
    nav.appendChild(dot);
  }
}

function updateQuoteDots() {
  const nav = document.getElementById('quoteNav');
  if (!nav) return;
  const total = Math.min(QUOTES.length, 8);
  const dots = nav.querySelectorAll('.quote-dot');
  dots.forEach((d, i) => d.classList.toggle('active', i === (currentQuoteIndex % total)));
}

/* ═══════════════════════════════════════════════════════════════
   ✨ SPARKLES
   ═══════════════════════════════════════════════════════════════ */
function initSparkles() {
  const container = document.getElementById('sparkles');
  if (!container) return;
  const colors = ['#22D3EE', '#EC4899', '#F59E0B', '#8B5CF6', '#2DD4BF'];
  for (let i = 0; i < 20; i++) {
    const s = document.createElement('div');
    s.className = 'sparkle';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = '100%';
    const c = colors[Math.floor(Math.random() * colors.length)];
    s.style.background = c;
    s.style.color = c;
    const size = (2 + Math.random() * 4);
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.animationDuration = (6 + Math.random() * 8) + 's';
    s.style.animationDelay = Math.random() * 8 + 's';
    container.appendChild(s);
  }
}

/* ═══════════════════════════════════════════════════════════════
   📢 ANNOUNCEMENTS — FIXED (dengan fallback & debug)
   ═══════════════════════════════════════════════════════════════ */
async function loadAnnouncements() {
  log('📢 Loading announcements...');
  const bar = document.getElementById('announcementBar');
  const marquee = document.getElementById('announcementMarquee');
  if (!bar || !marquee) {
    err('Announcement elements not found in DOM!');
    return;
  }

  let textItems = [];

  try {
    if (!emindcare) {
      log('⚠️ emindcare not ready, skipping Firestore...');
    } else {
      log('🔍 Querying Firestore collection "announcements"...');
      const items = await emindcare.getActiveAnnouncements();
      log(`📥 Got ${items.length} announcements from Firestore`);

      if (items.length > 0) {
        log('   Sample:', JSON.stringify(items[0], null, 2));
      }

      // Tapis iklan teks sahaja
      textItems = items.filter(i => !i.mediaUrl || !i.mediaType);
      log(`📝 Filtered to ${textItems.length} text announcements`);
    }
  } catch (e) {
    err('Firestore announcement load error:', e);
  }

  // Fallback jika tiada data
  if (!textItems.length) {
    log('ℹ️ No announcements in Firestore — using fallback');
    textItems = [
      { text: 'Selamat datang ke Dinding Luahan UBK SEMSIRA', icon: 'fa-bullhorn', badge: 'Baharu' },
      { text: 'Semua luahan adalah 100% tanpa nama & sulit', icon: 'fa-shield-alt' },
      { text: 'Kaunselor sedia mendengar — hubungi kami bila-bila masa', icon: 'fa-hands-holding-heart' }
    ];
  }

  // Render
  try {
    const html = textItems.map(d => {
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
    log(`✅ Rendered ${textItems.length} announcements`);
  } catch (e) {
    err('Render announcements error:', e);
  }
}

/* ═══════════════════════════════════════════════════════════════
   RANDOM ALIAS
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
   SENSITIVE FILTER
   ═══════════════════════════════════════════════════════════════ */
function containsSensitiveContent(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return SENSITIVE_PATTERNS.some(p => p.test(lower));
}

window.closeSafetyModal = function() {
  document.getElementById('safetyModal').classList.remove('active');
  if (pendingPost) {
    const post = pendingPost;
    pendingPost = null;
    actuallySubmitPost(post);
  }
};

/* ═══════════════════════════════════════════════════════════════
   SUBMIT
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
    text,
    color: selectedColor,
    reactions: { sokong: 0, semangat: 0, pelukan: 0 }
  };

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
    if (!emindcare) throw new Error('SDK not ready');

    const { db, fs } = emindcare;

    log('📤 Submitting post to Firestore...');
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
    log('✅ Post submitted');

    document.getElementById('moodForm').reset();
    document.querySelectorAll('.mood-option').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.color-option').forEach((b, i) => b.classList.toggle('selected', i === 0));
    document.getElementById('charLimit').textContent = `0 / ${MAX_TEXT_LENGTH}`;
    document.getElementById('charLimit').classList.remove('warn', 'danger');

    selectedMood = null;
    selectedColor = '#FCE7F3';
    generateAlias();

    showToast('Berjaya! 💗', 'Luahan anda telah dihantar. Terima kasih kerana berkongsi.', 'success');
  } catch (e) {
    err('Submit error:', e);
    showToast('Gagal Hantar', e.message || 'Sila cuba lagi.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

/* ═══════════════════════════════════════════════════════════════
   REALTIME LISTENER — FIXED
   ═══════════════════════════════════════════════════════════════ */
function setupRealtimeListener() {
  try {
    if (!emindcare) {
      err('Cannot setup listener: SDK not ready');
      return;
    }

    const { db, fs } = emindcare;
    if (unsubPosts) unsubPosts();

    log('🔗 Setting up realtime listener on "mood_posts"...');

    unsubPosts = fs.onSnapshot(
      fs.collection(db, MOOD_POSTS),
      (snapshot) => {
        allPosts = [];
        snapshot.forEach(doc => {
          allPosts.push({ id: doc.id, ...doc.data() });
        });
        log(`📥 Received ${allPosts.length} posts from Firestore`);

        if (allPosts.length > 0) {
          log('   First post:', {
            id: allPosts[0].id,
            mood: allPosts[0].mood,
            alias: allPosts[0].alias,
            hasCreatedAt: !!allPosts[0].createdAt
          });
        }

        allPosts.sort((a, b) => getTimestamp(b) - getTimestamp(a));
        updateMoodMeter();
        renderWall();
      },
      (error) => {
        err('Snapshot error:', error);
        log('Error code:', error.code);
        log('Error message:', error.message);

        if (error.code === 'permission-denied') {
          showToast(
            'Akses Ditolak',
            'Firestore rules block read access. Semak Firebase Console → Rules.',
            'error',
            8000
          );
        } else {
          showToast('Ralat Realtime', 'Gagal pantau luahan: ' + error.message, 'error');
        }
      }
    );
  } catch (e) {
    err('Setup listener error:', e);
  }
}

function getTimestamp(post) {
  if (!post.createdAt) return 0;
  if (post.createdAt.toDate) return post.createdAt.toDate().getTime();
  return new Date(post.createdAt).getTime();
}

/* ═══════════════════════════════════════════════════════════════
   MOOD METER
   ═══════════════════════════════════════════════════════════════ */
function updateMoodMeter() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayPosts = allPosts.filter(p => getTimestamp(p) >= today.getTime());

  const counts = { happy: 0, calm: 0, stress: 0, sad: 0, angry: 0, tired: 0 };
  todayPosts.forEach(p => {
    if (counts[p.mood] !== undefined) counts[p.mood]++;
  });

  const total = todayPosts.length;
  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;

  const map = {
    happy: 'pctHappy', calm: 'pctCalm', stress: 'pctStress',
    sad: 'pctSad', angry: 'pctAngry', tired: 'pctTired'
  };

  Object.keys(map).forEach(mood => {
    const el = document.getElementById(map[mood]);
    if (el) el.textContent = total > 0 ? `${pct(counts[mood])}%` : '—';
  });
}

/* ═══════════════════════════════════════════════════════════════
   RENDER WALL — FIXED
   ═══════════════════════════════════════════════════════════════ */
function renderWall() {
  const grid = document.getElementById('wallGrid');
  const countEl = document.getElementById('wallCount');
  if (!grid) {
    err('wallGrid not found');
    return;
  }

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

  const displayPosts = allPosts.slice(0, 20);

  grid.innerHTML = displayPosts.map((p, i) => {
    const mood = MOODS[p.mood] || MOODS.calm;
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
                  data-post="${p.id}">
            <i class="fas fa-hands-helping"></i>
            <span class="cnt">${reactions.sokong || 0}</span>
          </button>
          <button class="reaction-btn ${hasReacted ? 'reacted' : ''}"
                  onclick="reactToPost('${p.id}', 'semangat')"
                  data-post="${p.id}">
            <i class="fas fa-fire"></i>
            <span class="cnt">${reactions.semangat || 0}</span>
          </button>
          <button class="reaction-btn ${hasReacted ? 'reacted' : ''}"
                  onclick="reactToPost('${p.id}', 'pelukan')"
                  data-post="${p.id}">
            <i class="fas fa-heart"></i>
            <span class="cnt">${reactions.pelukan || 0}</span>
          </button>
        </div>
      </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   REACTIONS
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
  } catch (e) {
    err('React error:', e);
    showToast('Gagal', e.message, 'error');
  }
};

function saveReactedHistory() {
  try { sessionStorage.setItem(REACTED_STORAGE_KEY, JSON.stringify([...reactedPosts])); } catch {}
}

function loadReactedHistory() {
  try {
    const raw = sessionStorage.getItem(REACTED_STORAGE_KEY);
    if (raw) reactedPosts = new Set(JSON.parse(raw));
  } catch {}
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
    <div class="toast-content"><strong>${title}</strong><span>${message}</span></div>`;
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
    try { unsubPosts(); } catch {}
  }
});

console.log(
  "%c 🎭 Mood Check-In ",
  "background:linear-gradient(135deg,#EC4899,#8B5CF6,#0D9488);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
log('🎯 Ready — Anonymous wall active (FIXED VERSION)');
