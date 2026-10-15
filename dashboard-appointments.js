/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Dashboard Appointments (Kaunselor)
   Logik: Setup blocked dates + schedule + urus permohonan
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const BLOCKED_COLLECTION = 'blocked_dates';
const SCHEDULE_COLLECTION = 'schedule_settings';
const SCHEDULE_DOC_ID = 'main';
const APPOINTMENTS_COLLECTION = 'appointments';

const MONTHS_SHORT = ['JAN', 'FEB', 'MAC', 'APR', 'MEI', 'JUN', 'JUL', 'OGO', 'SEP', 'OKT', 'NOV', 'DIS'];
const MONTHS_FULL = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const DAYS_MS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let currentUser = null;
let blockedDates = [];
let scheduleSettings = {
  startTime: '08:00',
  endTime: '14:00',
  slotMinutes: 30,
  days: [1, 2, 3, 4, 5]
};
let appointments = {
  pending: [],
  active: [],
  history: []
};
let currentTab = 'pending';
let unsubAppointments = null;

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  try {
    await waitForEMindCare();
    if (!authGuard()) return;
    applyBranding();
    populateProfile();

    initBlockDateDefault();
    bindEvents();
    bindDayChips();

    await Promise.all([
      loadScheduleSettings(),
      loadBlockedDates()
    ]);

    // Real-time listener untuk appointments
    setupAppointmentsListener();

  } catch (err) {
    console.error('Init error:', err);
    showToast('Ralat Sistem', 'Gagal memuatkan halaman: ' + err.message, 'error');
  }
});

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

/* ═══════════════════════════════════════════════════════════════
   AUTH GUARD
   ═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   POPULATE PROFILE
   ═══════════════════════════════════════════════════════════════ */
function populateProfile() {
  if (!currentUser) return;
  const name = currentUser.fullName || 'Kaunselor';
  document.getElementById('sbProfileName').textContent = name;
  document.getElementById('sbAvatar').textContent = name.charAt(0).toUpperCase();
  if (currentUser.avatarUrl) {
    document.getElementById('sbAvatar').innerHTML =
      `<img src="${currentUser.avatarUrl}" alt="${escapeHtml(name)}">`;
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
    if (b.name) {
      document.getElementById('sbBrandName').textContent = b.name;
      document.title = 'Tempahan Kaunseling · ' + b.name;
    }
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
   SIDEBAR TOGGLE
   ═══════════════════════════════════════════════════════════════ */
window.toggleSidebar = function() {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sbBackdrop');
  const isOpen = sb.classList.contains('open');
  if (isOpen) {
    sb.classList.remove('open');
    bd.classList.remove('active');
    document.body.style.overflow = '';
  } else {
    sb.classList.add('open');
    bd.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

/* ═══════════════════════════════════════════════════════════════
   LOGOUT
   ═══════════════════════════════════════════════════════════════ */
window.logout = function() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'login.html';
};

/* ═══════════════════════════════════════════════════════════════
   REFRESH
   ═══════════════════════════════════════════════════════════════ */
window.refreshAll = async function() {
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('spinning');
  try {
    await Promise.all([
      loadScheduleSettings(),
      loadBlockedDates(),
      reloadAppointmentsOnce()
    ]);
    showToast('Berjaya', 'Data telah dikemas kini.', 'success', 2500);
  } catch (err) {
    showToast('Ralat', 'Gagal refresh: ' + err.message, 'error');
  } finally {
    setTimeout(() => btn.classList.remove('spinning'), 600);
  }
};

/* ═══════════════════════════════════════════════════════════════
   TAB SWITCHER
   ═══════════════════════════════════════════════════════════════ */
window.switchTab = function(tabName) {
  currentTab = tabName;

  // Update active tab class
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab' + capitalize(tabName) + 'Btn')?.classList.add('active');

  // Update panel visible
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('partisi' + capitalize(tabName))?.classList.add('active');

  renderPanels();
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ═══════════════════════════════════════════════════════════════
   BIND EVENTS
   ═══════════════════════════════════════════════════════════════ */
function bindEvents() {
  document.getElementById('formBlockDate').addEventListener('submit', handleAddBlockDate);
  document.getElementById('formScheduleSettings').addEventListener('submit', handleSaveSchedule);

  // Close modal when clicking backdrop
  document.getElementById('actionModal').addEventListener('click', (e) => {
    if (e.target.id === 'actionModal') closeActionModal();
  });

  // ESC closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeActionModal();
  });
}

function bindDayChips() {
  const chips = document.querySelectorAll('#workDaysGrid .day-chip');
  chips.forEach(chip => {
    const d = parseInt(chip.dataset.day);
    if (scheduleSettings.days.includes(d)) chip.classList.add('selected');
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });
}

/* ═══════════════════════════════════════════════════════════════
   BLOCKED DATES
   ═══════════════════════════════════════════════════════════════ */
function initBlockDateDefault() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('blockDateInput').value = toDateStr(tomorrow);
}

async function loadBlockedDates() {
  try {
    const { db, fs } = window.EMindCare;
    const snap = await fs.getDocs(fs.collection(db, BLOCKED_COLLECTION));
    blockedDates = [];
    snap.forEach(d => blockedDates.push({ id: d.id, ...d.data() }));
    blockedDates.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    renderBlockedDates();
  } catch (err) {
    console.warn('Blocked dates error:', err);
  }
}

async function handleAddBlockDate(e) {
  e.preventDefault();
  const date = document.getElementById('blockDateInput').value;
  const type = document.getElementById('blockTypeSelect').value;
  const note = document.getElementById('blockReasonInput').value.trim();

  if (!date || !note) {
    return showToast('Ralat', 'Sila isi semua medan.', 'error');
  }

  // Check duplicate
  if (blockedDates.some(b => b.date === date)) {
    return showToast('Ralat', 'Tarikh ini sudah di-block.', 'warning');
  }

  const btn = document.getElementById('saveBlockBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    const { db, fs } = window.EMindCare;
    const ref = fs.doc(fs.collection(db, BLOCKED_COLLECTION));
    await fs.setDoc(ref, {
      date, type, note,
      createdBy: currentUser?.fullName || 'unknown',
      createdAt: fs.serverTimestamp()
    });

    blockedDates.push({ id: ref.id, date, type, note });
    blockedDates.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    renderBlockedDates();

    document.getElementById('blockReasonInput').value = '';
    showToast('Berjaya', 'Tarikh block telah disimpan.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Ralat', 'Gagal simpan: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

function renderBlockedDates() {
  const list = document.getElementById('blockedDatesList');
  const count = document.getElementById('blockedCount');
  count.textContent = blockedDates.length;

  if (blockedDates.length === 0) {
    list.innerHTML = `<div class="blocked-empty"><i class="fas fa-inbox"></i> Belum ada tarikh block</div>`;
    return;
  }

  list.innerHTML = blockedDates.map(b => `
    <div class="blocked-item ${b.type === 'amber' ? 'amber' : ''}">
      <div class="blocked-item-info">
        <div class="blocked-item-date">${formatDateFull(b.date)}</div>
        <div class="blocked-item-note">${escapeHtml(b.note || '')}</div>
      </div>
      <button class="blocked-item-delete" onclick="deleteBlockedDate('${b.id}')" title="Padam">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
}

window.deleteBlockedDate = async function(id) {
  if (!confirm('Padam tarikh block ini?')) return;
  try {
    const { db, fs } = window.EMindCare;
    await fs.deleteDoc(fs.doc(db, BLOCKED_COLLECTION, id));
    blockedDates = blockedDates.filter(b => b.id !== id);
    renderBlockedDates();
    showToast('Berjaya', 'Tarikh block telah dipadam.', 'success');
  } catch (err) {
    showToast('Ralat', 'Gagal padam: ' + err.message, 'error');
  }
};

/* ═══════════════════════════════════════════════════════════════
   SCHEDULE SETTINGS
   ═══════════════════════════════════════════════════════════════ */
async function loadScheduleSettings() {
  try {
    const { db, fs } = window.EMindCare;
    const snap = await fs.getDoc(fs.doc(db, SCHEDULE_COLLECTION, SCHEDULE_DOC_ID));
    if (snap.exists()) {
      scheduleSettings = { ...scheduleSettings, ...snap.data() };
    }
    applyScheduleToForm();
  } catch (err) {
    console.warn('Schedule error:', err);
  }
}

function applyScheduleToForm() {
  document.getElementById('startTimeInput').value = scheduleSettings.startTime || '08:00';
  document.getElementById('endTimeInput').value = scheduleSettings.endTime || '14:00';
  document.getElementById('slotIntervalSelect').value = scheduleSettings.slotMinutes || 30;

  document.querySelectorAll('#workDaysGrid .day-chip').forEach(chip => {
    const d = parseInt(chip.dataset.day);
    chip.classList.toggle('selected', scheduleSettings.days?.includes(d));
  });
}

async function handleSaveSchedule(e) {
  e.preventDefault();
  const startTime = document.getElementById('startTimeInput').value;
  const endTime = document.getElementById('endTimeInput').value;
  const slotMinutes = parseInt(document.getElementById('slotIntervalSelect').value);
  const days = Array.from(document.querySelectorAll('#workDaysGrid .day-chip.selected'))
    .map(c => parseInt(c.dataset.day));

  if (startTime >= endTime) {
    return showToast('Ralat', 'Masa tamat mesti selepas masa mula.', 'error');
  }
  if (!days.length) {
    return showToast('Ralat', 'Pilih sekurang-kurangnya satu hari.', 'error');
  }

  const btn = document.getElementById('saveScheduleBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

  try {
    const { db, fs } = window.EMindCare;
    await fs.setDoc(fs.doc(db, SCHEDULE_COLLECTION, SCHEDULE_DOC_ID), {
      startTime, endTime, slotMinutes, days,
      updatedAt: fs.serverTimestamp(),
      updatedBy: currentUser?.fullName || 'kaunselor'
    });
    scheduleSettings = { startTime, endTime, slotMinutes, days };
    showToast('Berjaya', 'Tetapan operasi telah disimpan.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Ralat', 'Gagal simpan tetapan: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

/* ═══════════════════════════════════════════════════════════════
   REAL-TIME APPOINTMENTS LISTENER
   ═══════════════════════════════════════════════════════════════ */
function setupAppointmentsListener() {
  const { db, fs } = window.EMindCare;
  if (unsubAppointments) unsubAppointments();

  unsubAppointments = fs.onSnapshot(
    fs.collection(db, APPOINTMENTS_COLLECTION),
    (snapshot) => {
      const all = [];
      snapshot.forEach(d => all.push({ id: d.id, ...d.data() }));

      // Sort by createdAt desc
      all.sort((a, b) => {
        const at = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bt = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bt - at;
      });

      appointments.pending = all.filter(a => a.status === 'pending');
      appointments.active = all.filter(a => ['approved', 'deferred'].includes(a.status));
      appointments.history = all.filter(a => ['completed', 'cancelled', 'rejected'].includes(a.status));

      updateBadges();
      renderPanels();
    },
    (err) => {
      console.error('Snapshot error:', err);
      showToast('Ralat', 'Gagal memantau data: ' + err.message, 'error');
    }
  );
}

async function reloadAppointmentsOnce() {
  // Snapshot already live — paksa re-render
  renderPanels();
}

/* ═══════════════════════════════════════════════════════════════
   UPDATE BADGES
   ═══════════════════════════════════════════════════════════════ */
function updateBadges() {
  const pending = appointments.pending.length;
  document.getElementById('tabBadgePending').textContent = pending;
  document.getElementById('tabBadgeActive').textContent = appointments.active.length;
  document.getElementById('tabBadgeHistory').textContent = appointments.history.length;

  const sbBadge = document.getElementById('pendingBadge');
  sbBadge.textContent = pending;
  sbBadge.classList.toggle('hidden', pending === 0);
}

/* ═══════════════════════════════════════════════════════════════
   RENDER PANELS
   ═══════════════════════════════════════════════════════════════ */
function renderPanels() {
  renderPendingList();
  renderActiveList();
  renderHistoryList();
}

/* ═══════════════════════════════════════════════════════════════
   RENDER PENDING CARDS
   ═══════════════════════════════════════════════════════════════ */
function renderPendingList() {
  const list = document.getElementById('pendingList');
  const items = appointments.pending;

  if (!items.length) {
    list.innerHTML = `
      <div class="panel-empty" style="grid-column:1/-1;">
        <i class="fas fa-check-circle"></i>
        <h4>Tiada Permohonan Baru</h4>
        <p>Semua permohonan telah diuruskan. Rehat seketika!</p>
      </div>`;
    return;
  }

  list.innerHTML = items.map((a, i) => renderApptCard(a, i, 'pending')).join('');
}

/* ═══════════════════════════════════════════════════════════════
   RENDER ACTIVE CARDS
   ═══════════════════════════════════════════════════════════════ */
function renderActiveList() {
  const list = document.getElementById('activeList');
  const items = appointments.active;

  if (!items.length) {
    list.innerHTML = `
      <div class="panel-empty" style="grid-column:1/-1;">
        <i class="fas fa-calendar"></i>
        <h4>Tiada Sesi Aktif</h4>
        <p>Tiada temujanji yang diluluskan buat masa ini.</p>
      </div>`;
    return;
  }

  list.innerHTML = items.map((a, i) => renderApptCard(a, i, 'active')).join('');
}

/* ═══════════════════════════════════════════════════════════════
   RENDER HISTORY CARDS
   ═══════════════════════════════════════════════════════════════ */
function renderHistoryList() {
  const list = document.getElementById('historyList');
  const items = appointments.history;

  if (!items.length) {
    list.innerHTML = `
      <div class="panel-empty" style="grid-column:1/-1;">
        <i class="fas fa-history"></i>
        <h4>Tiada Rekod</h4>
        <p>Belum ada sejarah temujanji yang selesai atau dibatalkan.</p>
      </div>`;
    return;
  }

  list.innerHTML = items.map((a, i) => renderApptCard(a, i, 'history')).join('');
}

/* ═══════════════════════════════════════════════════════════════
   RENDER SINGLE APPOINTMENT CARD
   ═══════════════════════════════════════════════════════════════ */
function renderApptCard(a, index, panelType) {
  const initials = (a.studentName || 'M')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const statusColors = {
    pending: '#F59E0B',
    approved: '#10B981',
    deferred: '#6366F1',
    completed: '#0F766E',
    cancelled: '#EF4444',
    rejected: '#EF4444'
  };

  const statusLabels = {
    pending: 'Menunggu',
    approved: 'Diluluskan',
    deferred: 'Ditangguh',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    rejected: 'Ditolak'
  };

  const urgencyMap = {
    high: { cls: 'high', label: '🔴 URGENT' },
    medium: { cls: 'medium', label: '🟡 MODERATE' },
    low: { cls: 'low', label: '🔵 LOW' }
  };
  const urg = urgencyMap[a.urgencyLevel] || urgencyMap.low;

  // Actions per panel
  let actionsHTML = '';
  if (panelType === 'pending') {
    actionsHTML = `
      <button class="btn btn-success btn-sm" onclick="openActionModal('${a.id}','${escapeAttr(a.studentName)}','approve')">
        <i class="fas fa-check"></i> Luluskan
      </button>
      <button class="btn btn-warning btn-sm" onclick="openActionModal('${a.id}','${escapeAttr(a.studentName)}','defer')">
        <i class="fas fa-clock"></i> Tangguh
      </button>
      <button class="btn btn-danger btn-sm" onclick="openActionModal('${a.id}','${escapeAttr(a.studentName)}','reject')">
        <i class="fas fa-times"></i> Tolak
      </button>`;
  } else if (panelType === 'active') {
    actionsHTML = `
      <button class="btn btn-primary btn-sm" onclick="markCompleted('${a.id}')">
        <i class="fas fa-check-double"></i> Tanda Selesai
      </button>
      <button class="btn btn-danger btn-sm" onclick="openActionModal('${a.id}','${escapeAttr(a.studentName)}','reject')">
        <i class="fas fa-ban"></i> Batal
      </button>`;
  } else {
    // history — no actions, just info
    actionsHTML = '';
  }

  const extraNote = a.counselorNotes
    ? `<div class="appt-info-item full">
         <div class="appt-info-icon"><i class="fas fa-comment-dots"></i></div>
         <div class="appt-info-text">
           <div class="appt-info-label">Nota Kaunselor</div>
           <div class="appt-info-value">${escapeHtml(a.counselorNotes)}</div>
         </div>
       </div>`
    : '';

  const locationLine = a.location
    ? `<div class="appt-info-item full">
         <div class="appt-info-icon"><i class="fas fa-map-marker-alt"></i></div>
         <div class="appt-info-text">
           <div class="appt-info-label">Lokasi Sesi</div>
           <div class="appt-info-value">${escapeHtml(a.location)}</div>
         </div>
       </div>`
    : '';

  return `
    <div class="appt-card" style="--status-color:${statusColors[a.status]};animation-delay:${index * 0.05}s;">
      <div class="appt-card-head">
        <div class="appt-avatar">${initials}</div>
        <div class="appt-name-block">
          <div class="appt-name">${escapeHtml(a.studentName || 'Murid')}</div>
          <div class="appt-meta-line">
            <i class="fas fa-graduation-cap"></i> ${escapeHtml(a.studentClass || '-')}
            · <i class="fas fa-id-card"></i> ${escapeHtml(a.studentIc || '-')}
          </div>
        </div>
        <span class="urgency-pill ${urg.cls}">${urg.label}</span>
      </div>

      <div class="appt-info">
        <div class="appt-info-item">
          <div class="appt-info-icon"><i class="fas fa-calendar"></i></div>
          <div class="appt-info-text">
            <div class="appt-info-label">Tarikh</div>
            <div class="appt-info-value mono">${formatDateShort(a.date)}</div>
          </div>
        </div>
        <div class="appt-info-item">
          <div class="appt-info-icon"><i class="fas fa-clock"></i></div>
          <div class="appt-info-text">
            <div class="appt-info-label">Masa</div>
            <div class="appt-info-value mono">${escapeHtml(a.timeSlot || '-')}</div>
          </div>
        </div>
        ${a.counselorName ? `
          <div class="appt-info-item full">
            <div class="appt-info-icon"><i class="fas fa-user-tie"></i></div>
            <div class="appt-info-text">
              <div class="appt-info-label">Kaunselor</div>
              <div class="appt-info-value">${escapeHtml(a.counselorName)}</div>
            </div>
          </div>` : ''}
        ${locationLine}
        ${extraNote}
      </div>

      ${a.feelingNotes ? `
        <div class="appt-note">${escapeHtml(a.feelingNotes)}</div>
      ` : ''}

      ${a.proposedDate ? `
        <div class="appt-note" style="border-left-color:var(--indigo);background:rgba(99,102,241,0.06);">
          <strong style="font-style:normal;">Cadangan Baharu:</strong>
          ${formatDateShort(a.proposedDate)} ${escapeHtml(a.proposedTime || '')}
        </div>
      ` : ''}

      <div class="appt-card-foot">
        <span class="status-badge ${a.status}">
          <i class="fas fa-circle" style="font-size:0.4rem;"></i>
          ${statusLabels[a.status] || a.status}
        </span>
        <span class="appt-time-ago">${formatTimeAgo(a.createdAt)}</span>
      </div>

      ${actionsHTML ? `<div class="appt-actions">${actionsHTML}</div>` : ''}
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   ACTION MODAL
   ═══════════════════════════════════════════════════════════════ */
window.openActionModal = function(id, studentName, action) {
  const modal = document.getElementById('actionModal');
  const icon = document.getElementById('modalIcon');
  const title = document.getElementById('modalTitle');
  const desc = document.getElementById('modalDesc');
  const rescheduleFields = document.getElementById('rescheduleFields');
  const notesLabel = document.getElementById('notesLabel');
  const notesInput = document.getElementById('modalCounselorNotes');
  const confirmBtn = document.getElementById('modalConfirmBtn');

  document.getElementById('modalAppointmentId').value = id;
  document.getElementById('modalActionType').value = action;

  // Reset
  rescheduleFields.classList.remove('active');
  document.getElementById('modalNewDate').value = '';
  document.getElementById('modalNewTime').value = '';
  notesInput.value = '';

  if (action === 'approve') {
    icon.className = 'modal-icon success';
    icon.innerHTML = '<i class="fas fa-check-circle"></i>';
    title.textContent = 'Luluskan Temujanji?';
    desc.innerHTML = `Anda akan meluluskan permohonan <strong>${escapeHtml(studentName)}</strong>.`;
    notesLabel.textContent = 'Nota / Lokasi Sesi (Optional)';
    notesInput.placeholder = 'Cth: Bilik Kaunseling 1 · Datang 5 minit awal';
    confirmBtn.className = 'btn btn-success';
    confirmBtn.innerHTML = '<i class="fas fa-check"></i> <span>Luluskan</span>';

  } else if (action === 'defer') {
    icon.className = 'modal-icon warning';
    icon.innerHTML = '<i class="fas fa-clock"></i>';
    title.textContent = 'Tangguhkan Temujanji';
    desc.innerHTML = `Cadangkan masa baharu untuk <strong>${escapeHtml(studentName)}</strong>.`;
    notesLabel.textContent = 'Sebab Penangguhan';
    notesInput.placeholder = 'Cth: Saya ada taklimat pada masa tersebut';
    rescheduleFields.classList.add('active');
    confirmBtn.className = 'btn btn-warning';
    confirmBtn.innerHTML = '<i class="fas fa-clock"></i> <span>Tangguh</span>';

    // Fill default new date with same as original
    const appt = [...appointments.pending, ...appointments.active].find(x => x.id === id);
    if (appt) {
      document.getElementById('modalNewDate').value = appt.date || '';
      document.getElementById('modalNewTime').value = appt.timeSlot || '';
    }

  } else if (action === 'reject') {
    icon.className = 'modal-icon danger';
    icon.innerHTML = '<i class="fas fa-times-circle"></i>';
    title.textContent = 'Tolak Permohonan?';
    desc.innerHTML = `Tolak permohonan <strong>${escapeHtml(studentName)}</strong>?`;
    notesLabel.textContent = 'Sebab Penolakan';
    notesInput.placeholder = 'Cth: Sila walk-in pada waktu rehat';
    confirmBtn.className = 'btn btn-danger';
    confirmBtn.innerHTML = '<i class="fas fa-times"></i> <span>Tolak</span>';
  }

  modal.classList.add('active');
};

window.closeActionModal = function() {
  document.getElementById('actionModal').classList.remove('active');
};

window.submitModalAction = async function() {
  const id = document.getElementById('modalAppointmentId').value;
  const action = document.getElementById('modalActionType').value;
  const notes = document.getElementById('modalCounselorNotes').value.trim();

  if (!id || !action) return;

  if (action === 'defer') {
    const newDate = document.getElementById('modalNewDate').value;
    const newTime = document.getElementById('modalNewTime').value.trim();
    if (!newDate || !newTime) {
      return showToast('Ralat', 'Sila isi tarikh dan masa baharu.', 'error');
    }
    if (!notes) {
      return showToast('Ralat', 'Sila berikan sebab penangguhan.', 'error');
    }
  }

  if ((action === 'reject') && !notes) {
    return showToast('Ralat', 'Sila berikan sebab penolakan.', 'error');
  }

  const btn = document.getElementById('modalConfirmBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Memproses...';

  try {
    const { db, fs } = window.EMindCare;
    const ref = fs.doc(db, APPOINTMENTS_COLLECTION, id);

    let updateData = {
      updatedAt: fs.serverTimestamp(),
      updatedBy: currentUser?.fullName || 'kaunselor'
    };

    if (action === 'approve') {
      updateData.status = 'approved';
      if (notes) updateData.counselorNotes = notes;
      if (notes) updateData.location = notes;

    } else if (action === 'defer') {
      updateData.status = 'deferred';
      updateData.counselorNotes = notes;
      updateData.proposedDate = document.getElementById('modalNewDate').value;
      updateData.proposedTime = document.getElementById('modalNewTime').value.trim();

    } else if (action === 'reject') {
      updateData.status = 'cancelled';
      updateData.counselorNotes = notes;
    }

    await fs.updateDoc(ref, updateData);

    closeActionModal();
    showToast(
      'Berjaya',
      action === 'approve' ? 'Permohonan telah diluluskan.' :
      action === 'defer' ? 'Penangguhan telah dihantar.' :
      'Permohonan telah ditolak.',
      'success'
    );

  } catch (err) {
    console.error(err);
    showToast('Ralat', 'Gagal memproses: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
};

/* ═══════════════════════════════════════════════════════════════
   MARK COMPLETED
   ═══════════════════════════════════════════════════════════════ */
window.markCompleted = async function(id) {
  if (!confirm('Tandakan sesi ini sebagai SELESAI?')) return;

  try {
    const { db, fs } = window.EMindCare;
    await fs.updateDoc(fs.doc(db, APPOINTMENTS_COLLECTION, id), {
      status: 'completed',
      completedAt: fs.serverTimestamp(),
      completedBy: currentUser?.fullName || 'kaunselor'
    });
    showToast('Berjaya', 'Sesi telah ditandakan selesai.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Ralat', 'Gagal kemas kini: ' + err.message, 'error');
  }
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
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDateFull(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return dateStr; }
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return `${String(d.getDate()).padStart(2,'0')} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return dateStr; }
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const sec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (sec < 60) return 'baru sahaja';
    if (sec < 3600) return Math.floor(sec / 60) + ' min lalu';
    if (sec < 86400) return Math.floor(sec / 3600) + ' jam lalu';
    if (sec < 604800) return Math.floor(sec / 86400) + ' hari lalu';
    return date.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

function escapeHtml(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function escapeAttr(str) {
  if (str == null) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

console.log(
  "%c 📋 Dashboard Appointments ",
  "background:linear-gradient(135deg,#0F172A,#0F766E,#4F46E5);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Ready · Kaunselor v2.0");
