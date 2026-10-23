/* ═══════════════════════════════════════════════════════════════
   🕐 LIVE CLOCK + TARIKH
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

// Update setiap saat
setInterval(updateLiveClock, 1000);
updateLiveClock();

/* ═══════════════════════════════════════════════════════════════
   💬 QUOTE OF THE DAY — 30 Kata-Kata Motivasi
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

let currentQuoteIndex = 0;
let quoteIntervalId = null;

function initQuoteOfTheDay() {
  // Quote berdasarkan hari (deterministik — sama untuk semua orang)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  currentQuoteIndex = dayOfYear % QUOTES.length;

  renderQuote();
  buildQuoteDots();

  // Auto-cycle setiap 15 saat
  quoteIntervalId = setInterval(() => {
    currentQuoteIndex = (currentQuoteIndex + 1) % QUOTES.length;
    renderQuote();
    updateQuoteDots();
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
  // Tunjuk max 8 dot sahaja
  const total = Math.min(QUOTES.length, 8);
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('button');
    dot.className = 'quote-dot' + (i === (currentQuoteIndex % total) ? ' active' : '');
    dot.setAttribute('aria-label', `Quote ${i + 1}`);
    dot.addEventListener('click', () => {
      // Jump ke quote index real
      currentQuoteIndex = (currentQuoteIndex - (currentQuoteIndex % total) + i) % QUOTES.length;
      renderQuote();
      // Reset timer
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
   ✨ FLOATING SPARKLES
   ═══════════════════════════════════════════════════════════════ */
function initSparkles() {
  const container = document.getElementById('sparkles');
  if (!container) return;

  const colors = ['#22D3EE', '#EC4899', '#F59E0B', '#8B5CF6', '#2DD4BF'];
  const count = 20;

  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'sparkle';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = '100%';
    s.style.background = colors[Math.floor(Math.random() * colors.length)];
    s.style.color = s.style.background;
    s.style.width = (2 + Math.random() * 4) + 'px';
    s.style.height = s.style.width;
    s.style.animationDuration = (6 + Math.random() * 8) + 's';
    s.style.animationDelay = Math.random() * 8 + 's';
    container.appendChild(s);
  }
}

/* ═══════════════════════════════════════════════════════════════
   📢 ANNOUNCEMENT BAR — dari Firestore
   ═══════════════════════════════════════════════════════════════ */
async function loadAnnouncements() {
  try {
    const items = await emindcare.getActiveAnnouncements();
    // Fallback pengumuman default jika Firestore kosong
    const fallback = [
      { text: 'Selamat datang ke Dinding Luahan UBK SEMSIRA', icon: 'fa-bullhorn', badge: 'Baharu' },
      { text: 'Semua luahan adalah 100% tanpa nama & sulit', icon: 'fa-shield-alt' },
      { text: 'Kaunselor sedia mendengar — hubungi kami bila-bila masa', icon: 'fa-hands-holding-heart' }
    ];
    const list = items.length ? items : fallback;

    // Tapis iklan media (untuk mood page kita guna teks sahaja)
    const textItems = list.filter(i => !i.mediaUrl || !i.mediaType);
    if (!textItems.length) return;

    const bar = document.getElementById('announcementBar');
    const marquee = document.getElementById('announcementMarquee');
    if (!bar || !marquee) return;

    const html = textItems.map(d => {
      const badge = d.badge ? `<span class="badge">${d.badge}</span>` : '';
      return `<span class="announce-item">
        <i class="fas ${d.icon || 'fa-bullhorn'}"></i>
        ${badge}<span>${escapeHtml(d.text || '')}</span>
      </span>`;
    }).join('<span class="announce-divider">✦</span>');

    const sep = '<span class="announce-divider">✦</span>';
    marquee.innerHTML = html + sep + html + sep;
    marquee.style.animationDuration = Math.max(30, marquee.scrollWidth / 50) + 's';
    bar.classList.add('active');
  } catch (err) {
    console.warn('Announcement load error:', err.message);
    // Fallback masih tunjuk
    const bar = document.getElementById('announcementBar');
    const marquee = document.getElementById('announcementMarquee');
    if (bar && marquee) {
      const fallback = `<span class="announce-item"><i class="fas fa-bullhorn"></i><span>Selamat datang ke Dinding Luahan UBK SEMSIRA</span></span>`;
      const sep = '<span class="announce-divider">✦</span>';
      marquee.innerHTML = fallback + sep + fallback + sep;
      bar.classList.add('active');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   INIT BARU — panggil dalam window.load
   ═══════════════════════════════════════════════════════════════ */
// Tambah dalam fungsi `window.addEventListener('load', ...)` sedia ada:

// SELEPAS: emindcare = await waitForEMindCare();
// TAMBAH:
// initSparkles();
// initQuoteOfTheDay();
// loadAnnouncements();
// updateLiveClock();  // panggil terus
