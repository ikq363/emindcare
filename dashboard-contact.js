/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Dashboard Contact Script
   Logik: Contact Settings + Inbox Messages
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const SETTINGS_COLLECTION = 'site_settings';
const SETTINGS_DOC = 'contact';
const MESSAGES_COLLECTION = 'inquiries'; // cadangan: inquiries / messages

const PAGE_TITLES = {
  settings: ['Hubungi & Lokasi', 'Urus info perhubungan UBK & baca mesej masuk'],
  inbox: ['Peti Mesej', 'Mesej dan pertanyaan dari pengunjung']
};

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let currentUser = null;
let originalSettings = {};
let allMessages = [];
let filteredMessages = [];
let currentFilter = 'all';
let currentSearch = '';
let currentMsgId = null;
let pendingConfirmAction = null;

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  await waitForEMindCare();
  if (!authGuard()) return;
  initUI();
  applyBranding();
  await Promise.all([
    loadContactSettings(),
    loadMessages()
  ]);
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
   AUTH GUARD
   ═══════════════════════════════════════════════════════════════ */
function authGuard() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) { window.location.href = 'login.html'; return false; }
  try {
    const session = JSON.parse(raw);
    if (session.role !== 'kaunselor') {
      const redirects = { guru: 'dashboard-guru.html', murid: 'dashboard-murid.html' };
      window.location.href = redirects[session.role] || 'login.html';
      return false;
    }
    currentUser = session;
    loadProfile();
    return true;
  } catch (e) {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
    return false;
  }
}

function loadProfile() {
  document.getElementById('sbProfileName').textContent = currentUser.fullName || 'Kaunselor';
  const avatar = document.getElementById('sbAvatar');
  if (currentUser.avatarUrl) {
    avatar.innerHTML = `<img src="${currentUser.avatarUrl}" alt="">`;
  } else {
    avatar.textContent = (currentUser.fullName || 'K').charAt(0).toUpperCase();
  }
}

/* ═══════════════════════════════════════════════════════════════
   APPLY BRANDING
   ═══════════════════════════════════════════════════════════════ */
async function applyBranding() {
  try {
    const cfg = await window.EMindCare.getSiteConfig();
    if (!cfg?.branding) return;
    const b = cfg.branding;
    if (b.name) document.getElementById('sbBrandName').textContent = b.name;
    if (b.logoUrl) {
      document.getElementById('sbLogo').innerHTML = `<img src="${b.logoUrl}" alt="">`;
    } else if (b.logoIcon) {
      document.getElementById('sbLogo').innerHTML = `<i class="${b.logoIcon}"></i>`;
    }
    if (b.primaryColor) document.documentElement.style.setProperty('--teal', b.primaryColor);
    if (b.accentColor) document.documentElement.style.setProperty('--indigo', b.accentColor);
  } catch (e) { /* ignore */ }
}

/* ═══════════════════════════════════════════════════════════════
   INIT UI
   ═══════════════════════════════════════════════════════════════ */
function initUI() {
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Contact form
  document.getElementById('contactForm').addEventListener('submit', saveContactSettings);
  document.getElementById('resetContactBtn').addEventListener('click', resetContactForm);

  // Live map preview
  document.getElementById('contactMapEmbed').addEventListener('input', updateMapPreview);

  // Live social preview
  ['socialFacebook', 'socialInstagram', 'socialTiktok', 'socialYoutube'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateSocialPreview);
  });

  // Message filters
  document.getElementById('msgSearch').addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase().trim();
    applyMessageFilter();
  });
  document.getElementById('msgFilterStatus').addEventListener('change', (e) => {
    currentFilter = e.target.value;
    applyMessageFilter();
  });

  // Confirm modal
  document.getElementById('confirmBtn').addEventListener('click', async () => {
    if (typeof pendingConfirmAction === 'function') {
      const action = pendingConfirmAction;
      closeConfirmModal();
      await action();
    }
  });

  // WhatsApp number formatting
  document.getElementById('contactWhatsapp').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 15);
  });
}

/* ═══════════════════════════════════════════════════════════════
   TAB SWITCHING
   ═══════════════════════════════════════════════════════════════ */
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.dataset.panel === tabName);
  });

  const [title, subtitle] = PAGE_TITLES[tabName] || ['', ''];
  document.querySelector('.tb-title h1').textContent = title;
  document.querySelector('.tb-title p').textContent = subtitle;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ═══════════════════════════════════════════════════════════════
   LOAD CONTACT SETTINGS
   ═══════════════════════════════════════════════════════════════ */
async function loadContactSettings() {
  try {
    const { db, fs } = window.EMindCare;
    const { doc, getDoc } = fs;

    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC));

    if (snap.exists()) {
      const data = snap.data();
      originalSettings = JSON.parse(JSON.stringify(data));
      populateContactForm(data);
    } else {
      // Try fallback: check siteConfig/main
      try {
        const mainSnap = await getDoc(doc(db, 'siteConfig', 'main'));
        if (mainSnap.exists()) {
          const main = mainSnap.data();
          if (main.footer?.contacts) {
            const fallback = {
              contactPhone: extractContact(main.footer.contacts, 'phone'),
              contactEmail: extractContact(main.footer.contacts, 'envelope'),
              contactAddress: extractContact(main.footer.contacts, 'map-marker-alt')
            };
            populateContactForm(fallback);
            originalSettings = fallback;
          }
        }
      } catch (e) { /* ignore */ }
    }

    updateSocialPreview();
  } catch (err) {
    console.error('Load contact settings error:', err);
    showToast('Ralat', 'Gagal memuatkan tetapan: ' + err.message, 'error');
  }
}

function extractContact(contacts, iconKeyword) {
  const match = contacts.find(c => c.icon && c.icon.includes(iconKeyword));
  return match?.text || '';
}

function populateContactForm(data) {
  document.getElementById('contactPhone').value = data.contactPhone || '';
  document.getElementById('contactWhatsapp').value = data.contactWhatsapp || '';
  document.getElementById('contactEmail').value = data.contactEmail || '';
  document.getElementById('contactHours').value = data.contactHours || '';
  document.getElementById('contactAddress').value = data.contactAddress || '';
  document.getElementById('contactMapEmbed').value = data.contactMapEmbed || '';
  document.getElementById('socialFacebook').value = data.socialFacebook || '';
  document.getElementById('socialInstagram').value = data.socialInstagram || '';
  document.getElementById('socialTiktok').value = data.socialTiktok || '';
  document.getElementById('socialYoutube').value = data.socialYoutube || '';

  updateMapPreview();
}

function resetContactForm() {
  if (!Object.keys(originalSettings).length) return;
  populateContactForm(originalSettings);
  showToast('Info', 'Borang telah direset.', 'info');
}

/* ═══════════════════════════════════════════════════════════════
   MAP PREVIEW
   ═══════════════════════════════════════════════════════════════ */
function updateMapPreview() {
  const url = document.getElementById('contactMapEmbed').value.trim();
  const preview = document.getElementById('mapPreview');

  if (!url || !url.startsWith('http')) {
    preview.innerHTML = `
      <div class="map-placeholder">
        <i class="fas fa-map"></i>
        <span>Preview peta akan muncul di sini bila anda masukkan URL</span>
      </div>`;
    return;
  }

  preview.innerHTML = `<iframe src="${escapeHtml(url)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
}

/* ═══════════════════════════════════════════════════════════════
   SOCIAL PREVIEW
   ═══════════════════════════════════════════════════════════════ */
function updateSocialPreview() {
  const preview = document.getElementById('socialPreview');
  const items = [
    { id: 'socialFacebook', class: 'fb', icon: 'fab fa-facebook-f', label: 'Facebook' },
    { id: 'socialInstagram', class: 'ig', icon: 'fab fa-instagram', label: 'Instagram' },
    { id: 'socialTiktok', class: 'tt', icon: 'fab fa-tiktok', label: 'TikTok' },
    { id: 'socialYoutube', class: 'yt', icon: 'fab fa-youtube', label: 'YouTube' }
  ];

  const chips = items
    .filter(item => document.getElementById(item.id).value.trim())
    .map(item => {
      const url = document.getElementById(item.id).value.trim();
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="social-chip ${item.class}">
        <i class="${item.icon}"></i>
        <span>${item.label}</span>
      </a>`;
    });

  preview.innerHTML = chips.length ? chips.join('') : '';
}

/* ═══════════════════════════════════════════════════════════════
   SAVE CONTACT SETTINGS
   ═══════════════════════════════════════════════════════════════ */
async function saveContactSettings(e) {
  e.preventDefault();

  const btn = document.getElementById('saveContactBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const { db, fs } = window.EMindCare;
    const { doc, setDoc, serverTimestamp } = fs;

    const data = {
      contactPhone: document.getElementById('contactPhone').value.trim() || null,
      contactWhatsapp: document.getElementById('contactWhatsapp').value.trim() || null,
      contactEmail: document.getElementById('contactEmail').value.trim() || null,
      contactHours: document.getElementById('contactHours').value.trim() || null,
      contactAddress: document.getElementById('contactAddress').value.trim() || null,
      contactMapEmbed: document.getElementById('contactMapEmbed').value.trim() || null,
      socialFacebook: document.getElementById('socialFacebook').value.trim() || null,
      socialInstagram: document.getElementById('socialInstagram').value.trim() || null,
      socialTiktok: document.getElementById('socialTiktok').value.trim() || null,
      socialYoutube: document.getElementById('socialYoutube').value.trim() || null,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    };

    await setDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC), data, { merge: true });

    originalSettings = JSON.parse(JSON.stringify(data));

    btn.classList.remove('loading');
    showToast('Berjaya!', 'Maklumat perhubungan telah dikemas kini.', 'success');
  } catch (err) {
    console.error('Save error:', err);
    btn.classList.remove('loading');
    btn.disabled = false;
    showToast('Ralat', 'Gagal menyimpan: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   LOAD MESSAGES
   ═══════════════════════════════════════════════════════════════ */
async function loadMessages() {
  try {
    const { db, fs } = window.EMindCare;
    const { collection, query, orderBy, getDocs } = fs;

    let items = [];

    try {
      const q = query(collection(db, MESSAGES_COLLECTION), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    } catch (indexErr) {
      console.warn('Ordered query failed, using fallback:', indexErr.message);
      const snap = await getDocs(collection(db, MESSAGES_COLLECTION));
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));

      items.sort((a, b) => {
        const at = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bt = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bt - at;
      });
    }

    allMessages = items;
    applyMessageFilter();
    updateMessageStats();
  } catch (err) {
    console.error('Load messages error:', err);
    document.getElementById('messageList').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-wrap" style="background: rgba(239, 68, 68, 0.1); color: var(--rose);">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <strong>Ralat Memuatkan</strong>
        <p>Gagal memuatkan mesej. Cuba refresh halaman.</p>
      </div>`;
  }
}

window.refreshInbox = async function() {
  showToast('Info', 'Memuat semula mesej...', 'info', 2000);
  await loadMessages();
};

/* ═══════════════════════════════════════════════════════════════
   APPLY MESSAGE FILTER
   ═══════════════════════════════════════════════════════════════ */
function applyMessageFilter() {
  filteredMessages = allMessages.filter(msg => {
    // Status filter
    if (currentFilter) {
      const status = msg.status || 'unread';
      if (status !== currentFilter) return false;
    }

    // Search filter
    if (currentSearch) {
      const haystack = [
        msg.name, msg.senderName,
        msg.email, msg.senderEmail,
        msg.phone, msg.senderPhone,
        msg.subject,
        msg.message, msg.body
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(currentSearch)) return false;
    }

    return true;
  });

  renderMessages();
}

/* ═══════════════════════════════════════════════════════════════
   RENDER MESSAGES
   ═══════════════════════════════════════════════════════════════ */
function renderMessages() {
  const list = document.getElementById('messageList');

  if (!filteredMessages.length) {
    const isFiltered = allMessages.length > 0;
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <i class="fas ${isFiltered ? 'fa-search' : 'fa-inbox'}"></i>
        </div>
        <strong>${isFiltered ? 'Tiada padanan' : 'Tiada mesej'}</strong>
        <p>${isFiltered
          ? 'Cuba tukar carian atau filter status.'
          : 'Mesej dari pengunjung akan dipaparkan di sini.'}</p>
      </div>`;
    return;
  }

  list.innerHTML = filteredMessages.map(msg => {
    const name = msg.name || msg.senderName || 'Tanpa Nama';
    const email = msg.email || msg.senderEmail || '';
    const phone = msg.phone || msg.senderPhone || '';
    const subject = msg.subject || '(Tanpa Subjek)';
    const body = msg.message || msg.body || '';
    const status = msg.status || 'unread';
    const timeAgo = getTimeAgo(msg.createdAt);
    const initial = name.charAt(0).toUpperCase();

    const statusLabels = {
      unread: 'Belum Baca',
      read: 'Sudah Baca',
      completed: 'Selesai'
    };

    // WhatsApp deep link
    let waLink = null;
    if (phone) {
      const cleanPhone = phone.replace(/[^\d]/g, '').replace(/^0/, '60');
      waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Assalamualaikum ${name}, terima kasih kerana menghubungi UBK SEMSIRA. Saya ingin membalas pertanyaan anda...`)}`;
    }

    // Email link
    let mailLink = null;
    if (email) {
      mailLink = `mailto:${email}?subject=${encodeURIComponent('Re: ' + subject)}`;
    }

    return `
      <div class="message-card ${status}" data-msg-id="${msg.id}">
        <div class="message-avatar">${initial}</div>
        <div class="message-content">
          <div class="message-header">
            <div class="message-sender">
              <div class="message-name">${escapeHtml(name)}</div>
              <div class="message-contact">
                ${email ? `<span><i class="fas fa-envelope"></i> ${escapeHtml(email)}</span>` : ''}
                ${phone ? `<span><i class="fas fa-phone"></i> ${escapeHtml(phone)}</span>` : ''}
              </div>
            </div>
            <div class="message-meta">
              <span class="status-badge ${status}">
                <span class="dot"></span>
                ${statusLabels[status]}
              </span>
              <span class="message-time">${timeAgo}</span>
            </div>
          </div>

          <div class="message-subject">${escapeHtml(subject)}</div>
          <div class="message-body">${escapeHtml(body)}</div>

          <div class="message-actions">
            <button class="btn btn-secondary btn-sm" onclick="viewMessage('${msg.id}')">
              <i class="fas fa-eye"></i>
              <span>Lihat</span>
            </button>

            ${status === 'unread' ? `
              <button class="btn btn-warning btn-sm" onclick="markAsRead('${msg.id}')" style="background: rgba(245, 158, 11, 0.1); color: var(--orange); border: 1px solid rgba(245, 158, 11, 0.2);">
                <i class="fas fa-check"></i>
                <span>Tanda Baca</span>
              </button>
            ` : ''}

            ${status !== 'completed' ? `
              <button class="btn btn-emerald btn-sm" onclick="markAsCompleted('${msg.id}')">
                <i class="fas fa-flag-checkered"></i>
                <span>Selesai</span>
              </button>
            ` : ''}

            ${waLink ? `
              <a href="${waLink}" target="_blank" rel="noopener" class="btn btn-whatsapp btn-sm">
                <i class="fab fa-whatsapp"></i>
                <span>Balas WA</span>
              </a>
            ` : ''}

            ${mailLink ? `
              <a href="${mailLink}" class="btn btn-secondary btn-sm">
                <i class="fas fa-reply"></i>
                <span>Balas E-mel</span>
              </a>
            ` : ''}

            <button class="btn btn-danger btn-sm" onclick="deleteMessage('${msg.id}')">
              <i class="fas fa-trash"></i>
              <span>Padam</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   UPDATE MESSAGE STATS
   ═══════════════════════════════════════════════════════════════ */
function updateMessageStats() {
  const total = allMessages.length;
  const unread = allMessages.filter(m => (m.status || 'unread') === 'unread').length;
  const read = allMessages.filter(m => m.status === 'read').length;
  const completed = allMessages.filter(m => m.status === 'completed').length;

  document.getElementById('statTotalMsg').textContent = total;
  document.getElementById('statUnreadMsg').textContent = unread;
  document.getElementById('statReadMsg').textContent = read;
  document.getElementById('statCompletedMsg').textContent = completed;

  // Tab count
  const tabCount = document.getElementById('inboxTabCount');
  if (tabCount) {
    tabCount.textContent = total;
    tabCount.classList.toggle('alert', unread > 0);
  }

  // Sidebar badge
  const sbBadge = document.getElementById('sbUnreadBadge');
  if (sbBadge) {
    if (unread > 0) {
      sbBadge.textContent = unread;
      sbBadge.style.display = 'inline-block';
    } else {
      sbBadge.style.display = 'none';
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   VIEW MESSAGE
   ═══════════════════════════════════════════════════════════════ */
window.viewMessage = function(id) {
  const msg = allMessages.find(m => m.id === id);
  if (!msg) return;

  currentMsgId = id;

  document.getElementById('msgDetailName').textContent = msg.name || msg.senderName || '—';
  document.getElementById('msgDetailEmail').textContent = msg.email || msg.senderEmail || '—';
  document.getElementById('msgDetailPhone').textContent = msg.phone || msg.senderPhone || '—';
  document.getElementById('msgDetailSubject').textContent = msg.subject || '(Tanpa Subjek)';
  document.getElementById('msgDetailBody').textContent = msg.message || msg.body || '—';

  const timeAgo = getTimeAgo(msg.createdAt);
  document.getElementById('msgDetailSubtitle').textContent = `Dihantar ${timeAgo}`;

  document.getElementById('msgDetailModal').classList.add('active');

  // Auto mark as read
  if ((msg.status || 'unread') === 'unread') {
    setTimeout(() => markAsRead(id, true), 500);
  }
};

window.closeMsgDetailModal = function() {
  document.getElementById('msgDetailModal').classList.remove('active');
  currentMsgId = null;
};

/* ═══════════════════════════════════════════════════════════════
   MARK AS READ / COMPLETED
   ═══════════════════════════════════════════════════════════════ */
window.markAsRead = async function(id, silent = false) {
  try {
    const { db, fs } = window.EMindCare;
    const { doc, updateDoc, serverTimestamp } = fs;

    await updateDoc(doc(db, MESSAGES_COLLECTION, id), {
      status: 'read',
      readAt: serverTimestamp(),
      readBy: currentUser.uid
    });

    const msg = allMessages.find(m => m.id === id);
    if (msg) msg.status = 'read';

    applyMessageFilter();
    updateMessageStats();

    if (!silent) showToast('Berjaya', 'Mesej ditanda sebagai sudah dibaca.', 'success', 2500);
  } catch (err) {
    console.error('Mark read error:', err);
    showToast('Gagal', err.message, 'error');
  }
};

window.markAsCompleted = async function(id) {
  try {
    const { db, fs } = window.EMindCare;
    const { doc, updateDoc, serverTimestamp } = fs;

    await updateDoc(doc(db, MESSAGES_COLLECTION, id), {
      status: 'completed',
      completedAt: serverTimestamp(),
      completedBy: currentUser.uid
    });

    const msg = allMessages.find(m => m.id === id);
    if (msg) msg.status = 'completed';

    applyMessageFilter();
    updateMessageStats();

    showToast('Berjaya', 'Mesej ditanda selesai.', 'success', 2500);
  } catch (err) {
    console.error('Mark completed error:', err);
    showToast('Gagal', err.message, 'error');
  }
};

/* ═══════════════════════════════════════════════════════════════
   DELETE MESSAGE
   ═══════════════════════════════════════════════════════════════ */
window.deleteMessage = function(id) {
  const msg = allMessages.find(m => m.id === id);
  if (!msg) return;

  const name = msg.name || msg.senderName || 'Tanpa Nama';
  showConfirmModal({
    title: 'Padam Mesej?',
    desc: `Padam mesej dari "${truncate(name, 40)}"? Tindakan ini tidak boleh diundur.`,
    confirmText: 'Ya, Padam',
    onConfirm: async () => {
      try {
        const { db, fs } = window.EMindCare;
        await fs.deleteDoc(fs.doc(db, MESSAGES_COLLECTION, id));
        allMessages = allMessages.filter(m => m.id !== id);
        applyMessageFilter();
        updateMessageStats();
        showToast('Berjaya', 'Mesej dipadam.', 'success');
      } catch (err) {
        showToast('Gagal', err.message, 'error');
      }
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   CONFIRM MODAL
   ═══════════════════════════════════════════════════════════════ */
function showConfirmModal({ title, desc, confirmText, onConfirm }) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmDesc').textContent = desc;
  document.getElementById('confirmBtn').innerHTML = `<i class="fas fa-trash"></i> ${confirmText || 'Ya, Padam'}`;
  pendingConfirmAction = onConfirm;
  document.getElementById('confirmModal').classList.add('active');
}

window.closeConfirmModal = function() {
  document.getElementById('confirmModal').classList.remove('active');
  pendingConfirmAction = null;
};

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR + LOGOUT
   ═══════════════════════════════════════════════════════════════ */
window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sbBackdrop').classList.toggle('active');
};

window.logout = function() {
  showConfirmModal({
    title: 'Log Keluar?',
    desc: 'Anda akan dikembalikan ke halaman log masuk.',
    confirmText: 'Ya, Log Keluar',
    onConfirm: () => {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href = 'login.html';
    }
  });
};

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

function truncate(str, len = 50) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function getTimeAgo(timestamp) {
  if (!timestamp) return 'Baru sahaja';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Baru sahaja';
    if (mins < 60) return `${mins} min lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 7) return `${days} hari lalu`;
    return date.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short' });
  } catch { return ''; }
}

console.log(
  "%c 📞 Dashboard Contact ",
  "background:linear-gradient(135deg,#0F766E,#4F46E5,#EC4899);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Contact Settings + Inbox Messages · Ready");