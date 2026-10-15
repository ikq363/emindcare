/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Tempah Kaunseling Script
   Logik: Profile + Avatar + Kalendar + Slot + Tempahan
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const CURRENT_SESSION_YEAR = new Date().getFullYear().toString();
const BLOCKED_COLLECTION = 'blocked_dates';
const SCHEDULE_COLLECTION = 'schedule_settings';
const SCHEDULE_DOC_ID = 'main';
const APPOINTMENTS_COLLECTION = 'appointments';
const USERS_COLLECTION = 'users';

const MONTHS_MS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const MONTHS_SHORT = ['JAN', 'FEB', 'MAC', 'APR', 'MEI', 'JUN', 'JUL', 'OGO', 'SEP', 'OKT', 'NOV', 'DIS'];
const DAYS_MS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let currentUser = null;
let profileData = null;
let blockedDates = [];
let scheduleSettings = {
  startTime: '08:00',
  endTime: '14:00',
  slotMinutes: 30,
  days: [1, 2, 3, 4, 5]
};
let counselors = [];
let allAppointments = [];
let myAppointments = [];

let viewYear, viewMonth;
let selectedDate = null;
let selectedTime = null;
let selectedCounselorId = '';
let currentTab = 'pending';

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  try {
    await waitForEMindCare();
    if (!authGuard()) return;
    initUI();
    applyBranding();

    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();

    await Promise.all([
      loadProfile(),
      loadScheduleSettings(),
      loadBlockedDates(),
      loadCounselors()
    ]);

    await loadAppointments();

    renderCalendar();
    bindEvents();
    updateTabBadges();

  } catch (err) {
    console.error('Init error:', err);
    showToast('Ralat', 'Gagal memuatkan halaman: ' + err.message, 'error');
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
    if (session.role !== 'murid') {
      const redirects = { kaunselor: 'dashboard-kaunselor.html', guru: 'dashboard-guru.html' };
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
   INIT UI
   ═══════════════════════════════════════════════════════════════ */
function initUI() {
  document.getElementById('avatarInput').addEventListener('change', handleAvatarUpload);
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
      document.getElementById('tbBrandName').textContent = b.name;
      document.title = 'Tempah Kaunseling · ' + b.name;
    }
    if (b.tagline) document.getElementById('tbBrandTagline').textContent = b.tagline;
    if (b.logoUrl) {
      document.getElementById('tbLogo').innerHTML = `<img src="${b.logoUrl}" alt="">`;
    } else if (b.logoIcon) {
      document.getElementById('tbLogo').innerHTML = `<i class="${b.logoIcon}"></i>`;
    }
    if (b.primaryColor) document.documentElement.style.setProperty('--teal', b.primaryColor);
    if (b.accentColor) document.documentElement.style.setProperty('--indigo', b.accentColor);
  } catch (e) { /* ignore */ }
}

/* ═══════════════════════════════════════════════════════════════
   LOAD PROFILE
   ═══════════════════════════════════════════════════════════════ */
async function loadProfile() {
  try {
    const { db, fs } = window.EMindCare;
    const snap = await fs.getDoc(fs.doc(db, USERS_COLLECTION, currentUser.uid));
    if (!snap.exists()) {
      showToast('Ralat', 'Data profil tidak dijumpai.', 'error');
      return;
    }
    profileData = { id: snap.id, ...snap.data() };
    renderProfile(profileData);

    const updatedSession = {
      ...currentUser,
      fullName: profileData.fullName,
      class: profileData.class,
      avatarUrl: profileData.profileImage || profileData.avatarUrl || null
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
  } catch (err) {
    console.error('Load profile error:', err);
    showToast('Ralat', 'Gagal memuatkan profil: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   RENDER PROFILE
   ═══════════════════════════════════════════════════════════════ */
function renderProfile(data) {
  const name = data.fullName || 'Murid';
  const firstName = name.split(' ')[0];
  const initial = name.charAt(0).toUpperCase();

  const hour = new Date().getHours();
  let greeting = 'Selamat Datang! 👋';
  let sub = 'Semoga hari anda ceria dan produktif.';
  if (hour >= 12 && hour < 15) {
    greeting = `Selamat Tengah Hari, ${firstName}! ☀️`;
    sub = 'Jangan lupa makan tengah hari.';
  } else if (hour >= 15 && hour < 19) {
    greeting = `Selamat Petang, ${firstName}! 🌤️`;
    sub = 'Semoga hari anda berjalan lancar.';
  } else if (hour >= 19 || hour < 5) {
    greeting = `Selamat Malam, ${firstName}! 🌙`;
    sub = 'Jangan lupa rehat secukupnya.';
  } else {
    greeting = `Selamat Pagi, ${firstName}! 🌅`;
    sub = 'Mula hari ini dengan semangat baru.';
  }

  document.getElementById('greetingTitle').textContent = greeting;
  document.getElementById('greetingSubtitle').textContent = sub;

  const avatarEl = document.getElementById('profileAvatar');
  const avatarUrl = data.profileImage || data.avatarUrl || null;

  if (avatarUrl) {
    avatarEl.innerHTML = `
      <img src="${avatarUrl}" alt="${escapeHtml(name)}">
      <label class="profile-avatar-overlay" for="avatarInput">
        <i class="fas fa-camera"></i>
        <span>Tukar</span>
      </label>`;
    const input = document.getElementById('avatarInput');
    input.style.display = 'none';
    avatarEl.parentElement.appendChild(input);
  } else {
    avatarEl.innerHTML = `
      <span id="avatarText">${initial}</span>
      <label class="profile-avatar-overlay" for="avatarInput">
        <i class="fas fa-camera"></i>
        <span>Tukar</span>
      </label>`;
  }

  document.getElementById('profileName').textContent = name;
  document.getElementById('infoName').textContent = name;
  document.getElementById('infoIC').textContent = data.icNumber || '—';
  document.getElementById('infoClass').textContent = data.class || '—';
  document.getElementById('infoSession').textContent = data.sessionYear || CURRENT_SESSION_YEAR;
}

/* ═══════════════════════════════════════════════════════════════
   AVATAR UPLOAD
   ═══════════════════════════════════════════════════════════════ */
async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    return showToast('Ralat', 'Sila pilih fail gambar sahaja.', 'error');
  }
  if (file.size > 5 * 1024 * 1024) {
    return showToast('Ralat', 'Saiz gambar maksimum 5MB.', 'error');
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    const avatarEl = document.getElementById('profileAvatar');
    const img = avatarEl.querySelector('img');
    if (img) {
      img.src = ev.target.result;
    } else {
      avatarEl.innerHTML = `
        <img src="${ev.target.result}" alt="Preview">
        <label class="profile-avatar-overlay" for="avatarInput">
          <i class="fas fa-camera"></i>
          <span>Tukar</span>
        </label>`;
      const input = document.getElementById('avatarInput');
      input.style.display = 'none';
      avatarEl.parentElement.appendChild(input);
    }
  };
  reader.readAsDataURL(file);

  const progressEl = document.getElementById('uploadProgress');
  const fillEl = document.getElementById('uploadFill');
  const pctEl = document.getElementById('uploadPct');
  const labelEl = document.getElementById('uploadLabel');

  progressEl.classList.add('active');
  fillEl.style.width = '0%';
  pctEl.textContent = '0%';
  labelEl.textContent = 'Memuat naik gambar...';

  try {
    const result = await uploadWithProgress(file, {
      resourceType: 'image',
      folder: `${window.EMindCare.CLOUDINARY_CONFIG.folder}/murid-profiles`,
      onProgress: (pct) => {
        fillEl.style.width = pct + '%';
        pctEl.textContent = pct + '%';
      }
    });

    const { db, fs } = window.EMindCare;
    await fs.updateDoc(fs.doc(db, USERS_COLLECTION, currentUser.uid), {
      profileImage: result.secure_url,
      updatedAt: fs.serverTimestamp()
    });

    const updatedSession = { ...currentUser, avatarUrl: result.secure_url };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
    if (profileData) profileData.profileImage = result.secure_url;

    labelEl.textContent = '✓ Selesai!';
    pctEl.textContent = '100%';
    fillEl.style.width = '100%';
    setTimeout(() => progressEl.classList.remove('active'), 1500);
    showToast('Berjaya!', 'Gambar profil berjaya dikemas kini.', 'success');

  } catch (err) {
    console.error('Upload error:', err);
    progressEl.classList.remove('active');
    showToast('Upload Gagal', err.message, 'error');
    if (profileData?.profileImage) {
      document.getElementById('profileAvatar').querySelector('img').src = profileData.profileImage;
    }
  }

  e.target.value = '';
}

function uploadWithProgress(file, options = {}) {
  const { CLOUDINARY_CONFIG } = window.EMindCare;
  const { resourceType = 'image', folder, onProgress } = options;

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  if (folder) formData.append('folder', folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch (e) { reject(new Error('Respons Cloudinary tidak sah')); }
      } else {
        reject(new Error('Upload Cloudinary gagal: ' + xhr.status));
      }
    };

    xhr.onerror = () => reject(new Error('Rangkaian gagal'));
    xhr.send(formData);
  });
}

/* ═══════════════════════════════════════════════════════════════
   LOAD SCHEDULE / BLOCKED / COUNSELORS
   ═══════════════════════════════════════════════════════════════ */
async function loadScheduleSettings() {
  try {
    const { db, fs } = window.EMindCare;
    const snap = await fs.getDoc(fs.doc(db, SCHEDULE_COLLECTION, SCHEDULE_DOC_ID));
    if (snap.exists()) {
      scheduleSettings = { ...scheduleSettings, ...snap.data() };
    }
  } catch (err) { console.warn('Schedule error:', err); }
}

async function loadBlockedDates() {
  try {
    const { db, fs } = window.EMindCare;
    const snap = await fs.getDocs(fs.collection(db, BLOCKED_COLLECTION));
    blockedDates = [];
    snap.forEach(d => blockedDates.push({ id: d.id, ...d.data() }));
  } catch (err) { console.warn('Blocked error:', err); }
}

async function loadCounselors() {
  try {
    const { db, fs } = window.EMindCare;
    const q = fs.query(
      fs.collection(db, USERS_COLLECTION),
      fs.where('role', '==', 'kaunselor')
    );
    const snap = await fs.getDocs(q);
    counselors = [];
    snap.forEach(d => {
      const data = d.data();
      counselors.push({
        id: d.id,
        fullName: data.fullName || 'Kaunselor',
        avatarUrl: data.profileImage || data.avatarUrl || null
      });
    });
  } catch (err) {
    console.warn('Counselors error:', err);
    counselors = [{ id: 'demo', fullName: 'Kaunselor UBK', avatarUrl: null }];
  }

  const sel = document.getElementById('counselorSelect');
  if (counselors.length === 0) {
    sel.innerHTML = '<option value="">— Tiada kaunselor berdaftar —</option>';
  } else {
    sel.innerHTML = '<option value="">— Pilih Kaunselor —</option>' +
      counselors.map(c => `<option value="${c.id}">${escapeHtml(c.fullName)}</option>`).join('');
  }
}

/* ═══════════════════════════════════════════════════════════════
   LOAD APPOINTMENTS
   ═══════════════════════════════════════════════════════════════ */
async function loadAppointments() {
  try {
    const { db, fs } = window.EMindCare;
    const snap = await fs.getDocs(fs.collection(db, APPOINTMENTS_COLLECTION));
    allAppointments = [];
    snap.forEach(d => allAppointments.push({ id: d.id, ...d.data() }));

    const userIC = profileData?.icNumber || currentUser.icNumber;
    myAppointments = allAppointments.filter(a =>
      (a.studentIc && a.studentIc === userIC) ||
      (a.studentUid && a.studentUid === currentUser.uid)
    );

    myAppointments.sort((a, b) => {
      const at = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bt = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return bt - at;
    });

    renderMyAppointments();
  } catch (err) {
    console.error('Load appts error:', err);
    renderMyAppointments();
  }
}

/* ═══════════════════════════════════════════════════════════════
   CALENDAR
   ═══════════════════════════════════════════════════════════════ */
function renderCalendar() {
  const grid = document.getElementById('calGrid');
  document.getElementById('calMonthDisplay').innerHTML =
    `${MONTHS_MS[viewMonth]} ${viewYear}<small id="calYearDisplay">${viewYear}</small>`;

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = dateToStr(today);

  const cells = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, other: true });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewYear, viewMonth, d);
    const dateStr = dateToStr(date);
    const isPast = date < today;
    const isToday = dateStr === todayStr;
    const dow = date.getDay();
    const blocked = blockedDates.find(b => b.date === dateStr);
    const isOperational = scheduleSettings.days.includes(dow);

    let disabled = false, blockType = null, note = '';
    if (blocked) {
      disabled = true;
      blockType = blocked.type === 'red' ? 'red' : 'amber';
      note = blocked.note || '';
    } else if (isPast) {
      disabled = true;
    } else if (!isOperational) {
      disabled = true;
      blockType = 'amber';
    }

    cells.push({
      day: d, dateStr, other: false, isToday,
      disabled, blockType, note,
      selected: dateStr === selectedDate
    });
  }

  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) cells.push({ day: i, other: true });

  grid.innerHTML = cells.map(c => {
    if (c.other) return `<div class="cal-day other-month">${c.day}</div>`;
    let cls = 'cal-day';
    if (c.isToday) cls += ' today';
    if (c.selected) cls += ' selected';
    if (c.disabled && !c.selected) {
      cls += ' disabled';
      if (c.blockType === 'red') cls += ' blocked-red';
      if (c.blockType === 'amber') cls += ' blocked-amber';
    }
    const title = c.note ? ` title="${escapeHtml(c.note)}"` : '';
    const click = c.disabled ? '' : ` onclick="selectDate('${c.dateStr}')"`;
    const dot = (!c.disabled && !c.selected) ? '<span class="day-dot"></span>' : '';
    return `<div class="${cls}"${title}${click}>${c.day}${dot}</div>`;
  }).join('');
}

window.selectDate = function(dateStr) {
  if (dateStr === selectedDate) return;
  selectedDate = dateStr;
  selectedTime = null;
  selectedCounselorId = '';
  document.getElementById('counselorSelect').value = '';

  renderCalendar();

  const date = new Date(dateStr + 'T00:00:00');
  document.getElementById('selDateDay').textContent = DAYS_MS[date.getDay()];
  document.getElementById('selDateFull').textContent =
    `${date.getDate()} ${MONTHS_MS[date.getMonth()]} ${date.getFullYear()}`;

  document.getElementById('noDateState').style.display = 'none';
  document.getElementById('bookingForm').style.display = 'block';

  renderTimeSlots(dateStr);
};

/* ═══════════════════════════════════════════════════════════════
   TIME SLOTS
   ═══════════════════════════════════════════════════════════════ */
function renderTimeSlots(dateStr) {
  const container = document.getElementById('timeSlots');
  const hint = document.getElementById('slotHint');

  const slots = generateSlots(
    scheduleSettings.startTime,
    scheduleSettings.endTime,
    scheduleSettings.slotMinutes
  );

  if (!slots.length) {
    container.innerHTML = `<div class="time-slots-empty">Tiada slot untuk tarikh ini.</div>`;
    hint.textContent = '';
    return;
  }

  const bookedSet = new Set(
    allAppointments
      .filter(a => a.date === dateStr && ['pending', 'approved', 'deferred'].includes(a.status))
      .map(a => a.timeSlot)
  );

  const available = slots.filter(s => !bookedSet.has(s)).length;
  hint.textContent = `${available} / ${slots.length} tersedia`;

  if (available === 0) {
    container.innerHTML = `<div class="time-slots-empty">Semua slot telah ditempah. Sila pilih tarikh lain.</div>`;
    return;
  }

  container.innerHTML = slots.map(slot => {
    const isBooked = bookedSet.has(slot);
    const isSelected = slot === selectedTime;
    const cls = ['time-slot'];
    if (isBooked) cls.push('booked');
    if (isSelected) cls.push('selected');
    const click = isBooked ? '' : ` onclick="selectTime('${slot}')"`;
    return `<div class="${cls.join(' ')}"${click}>${slot}</div>`;
  }).join('');
}

window.selectTime = function(slot) {
  selectedTime = slot;
  renderTimeSlots(selectedDate);
};

function generateSlots(startTime, endTime, minutes) {
  const out = [];
  try {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + minutes <= end) {
      out.push(minutesToLabel(cur));
      cur += minutes;
    }
  } catch (e) { console.warn(e); }
  return out;
}

function minutesToLabel(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${period}`;
}

/* ═══════════════════════════════════════════════════════════════
   BIND EVENTS
   ═══════════════════════════════════════════════════════════════ */
function bindEvents() {
  document.getElementById('calPrev').addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  });

  const ta = document.getElementById('feelingNotes');
  ta.addEventListener('input', () => {
    document.getElementById('feelingCounter').textContent = `${ta.value.length} / 500`;
  });

  document.getElementById('counselorSelect').addEventListener('change', (e) => {
    selectedCounselorId = e.target.value;
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderMyAppointments();
    });
  });

  document.getElementById('bookingForm').addEventListener('submit', handleSubmit);
}

/* ═══════════════════════════════════════════════════════════════
   SUBMIT BOOKING
   ═══════════════════════════════════════════════════════════════ */
async function handleSubmit(e) {
  e.preventDefault();

  if (!selectedDate) return showToast('Ralat', 'Sila pilih tarikh.', 'error');
  if (!selectedTime) return showToast('Ralat', 'Sila pilih masa.', 'error');
  if (!selectedCounselorId) return showToast('Ralat', 'Sila pilih kaunselor.', 'error');

  const urgEl = document.querySelector('input[name="urgency"]:checked');
  const urgency = urgEl?.value || 'low';
  const notes = document.getElementById('feelingNotes').value.trim();

  const counselor = counselors.find(c => c.id === selectedCounselorId);
  const studentName = profileData?.fullName || currentUser.fullName || 'Murid';
  const studentIC = profileData?.icNumber || currentUser.icNumber || '';
  const studentClass = profileData?.class || currentUser.class || '';

  const conflict = allAppointments.find(a =>
    a.date === selectedDate &&
    a.timeSlot === selectedTime &&
    ['pending', 'approved', 'deferred'].includes(a.status)
  );
  if (conflict) {
    renderTimeSlots(selectedDate);
    return showToast('Slot Tidak Tersedia', 'Slot ini baru ditempah. Sila pilih masa lain.', 'warning');
  }

  const btn = document.getElementById('submitBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span><span>Menghantar...</span>';

  try {
    const { db, fs } = window.EMindCare;
    const ref = fs.doc(fs.collection(db, APPOINTMENTS_COLLECTION));

    const payload = {
      studentUid: currentUser.uid,
      studentName, studentIc: studentIC, studentClass,
      counselorId: selectedCounselorId,
      counselorName: counselor?.fullName || 'Kaunselor',
      date: selectedDate,
      timeSlot: selectedTime,
      feelingNotes: notes,
      urgencyLevel: urgency,
      status: 'pending',
      counselorNotes: '',
      location: '',
      createdAt: fs.serverTimestamp()
    };

    await fs.setDoc(ref, payload);

    allAppointments.push({ id: ref.id, ...payload });
    myAppointments.unshift({ id: ref.id, ...payload });

    const successInfo = {
      date: selectedDate,
      time: selectedTime,
      counselor: counselor?.fullName || 'Kaunselor'
    };

    selectedTime = null;
    selectedCounselorId = '';
    document.getElementById('feelingNotes').value = '';
    document.getElementById('feelingCounter').textContent = '0 / 500';
    document.getElementById('counselorSelect').value = '';
    document.querySelector('input[name="urgency"][value="low"]').checked = true;

    renderTimeSlots(selectedDate);
    renderMyAppointments();
    updateTabBadges();
    showSuccessModal(successInfo);
    showToast('Berjaya!', 'Permohonan temujanji telah dihantar.', 'success');

  } catch (err) {
    console.error('Submit error:', err);
    showToast('Ralat', 'Gagal menghantar: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

/* ═══════════════════════════════════════════════════════════════
   RENDER MY APPOINTMENTS
   ═══════════════════════════════════════════════════════════════ */
function renderMyAppointments() {
  const list = document.getElementById('myAppointmentsList');

  let items = [];
  if (currentTab === 'pending') {
    items = myAppointments.filter(a => a.status === 'pending');
  } else if (currentTab === 'active') {
    items = myAppointments.filter(a => ['approved', 'deferred'].includes(a.status));
  } else {
    items = myAppointments.filter(a => ['completed', 'cancelled', 'rejected'].includes(a.status));
  }

  if (!items.length) {
    const msgs = {
      pending: { icon: 'fa-inbox', title: 'Tiada Permohonan Menunggu', desc: 'Anda belum membuat tempahan atau semua telah diuruskan.' },
      active: { icon: 'fa-calendar-check', title: 'Tiada Sesi Aktif', desc: 'Tiada temujanji yang diluluskan buat masa ini.' },
      history: { icon: 'fa-flag-checkered', title: 'Tiada Rekod', desc: 'Rekod sesi selesai atau dibatalkan akan muncul di sini.' }
    };
    const m = msgs[currentTab];
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-wrap"><i class="fas ${m.icon}"></i></div>
        <strong>${m.title}</strong>
        <p>${m.desc}</p>
        ${currentTab === 'pending' ? `
          <a href="#bookingForm" class="btn" onclick="document.getElementById('bookingForm').scrollIntoView({behavior:'smooth'})">
            <i class="fas fa-plus"></i> Buat Tempahan
          </a>` : ''}
      </div>`;
    return;
  }

  const statusLabels = {
    pending: 'Menunggu',
    approved: 'Diluluskan',
    deferred: 'Ditangguh',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    rejected: 'Ditolak'
  };
  const statusIcons = {
    pending: 'fa-hourglass-half',
    approved: 'fa-check-circle',
    deferred: 'fa-clock',
    completed: 'fa-flag-checkered',
    cancelled: 'fa-times-circle',
    rejected: 'fa-times-circle'
  };

  list.innerHTML = items.map(item => {
    const dateStr = item.date || '';
    const dObj = dateStr ? new Date(dateStr + 'T00:00:00') : null;
    const day = dObj ? String(dObj.getDate()).padStart(2, '0') : '—';
    const month = dObj ? MONTHS_SHORT[dObj.getMonth()] : '—';
    const counselor = item.counselorName || 'Kaunselor UBK';
    const time = item.timeSlot || '';

    let sub = `<i class="fas fa-user-tie"></i> ${escapeHtml(counselor)}`;
    if (time) sub += ` · <i class="fas fa-clock"></i> ${escapeHtml(time)}`;
    if (item.status === 'deferred' && item.proposedDate) {
      sub += ` · <i class="fas fa-exchange-alt"></i> ${formatDateShort(item.proposedDate)}`;
    }

    const reason = getReasonLabel(item);

    return `
      <div class="appt-item" onclick="openApptDetail('${item.id}')">
        <div class="appt-date-box">
          <span class="day">${day}</span>
          <span class="month">${month}</span>
        </div>
        <div class="appt-info">
          <strong>${escapeHtml(reason)}</strong>
          <span>${sub}</span>
        </div>
        <span class="appt-status ${item.status}">
          <i class="fas ${statusIcons[item.status] || 'fa-circle'}"></i>
          ${statusLabels[item.status] || item.status}
        </span>
        <div class="appt-arrow"><i class="fas fa-chevron-right"></i></div>
      </div>`;
  }).join('');
}

function getReasonLabel(item) {
  return { high: 'Sesi Segera', medium: 'Sesi Bimbingan', low: 'Sesi Perbincangan' }[item.urgencyLevel] || 'Sesi Kaunseling';
}

/* ═══════════════════════════════════════════════════════════════
   TAB BADGES
   ═══════════════════════════════════════════════════════════════ */
function updateTabBadges() {
  document.getElementById('tabBadgePending').textContent = myAppointments.filter(a => a.status === 'pending').length;
  document.getElementById('tabBadgeActive').textContent = myAppointments.filter(a => ['approved', 'deferred'].includes(a.status)).length;
  document.getElementById('tabBadgeHistory').textContent = myAppointments.filter(a => ['completed', 'cancelled', 'rejected'].includes(a.status)).length;
}

/* ═══════════════════════════════════════════════════════════════
   APPOINTMENT DETAIL
   ═══════════════════════════════════════════════════════════════ */
window.openApptDetail = function(id) {
  const a = myAppointments.find(x => x.id === id);
  if (!a) return;

  const labels = {
    pending: 'Menunggu Pengesahan',
    approved: 'Telah Diluluskan',
    deferred: 'Ditangguhkan',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    rejected: 'Ditolak'
  };
  const urgLabels = {
    high: '🔴 Sangat Memerlukan',
    medium: '🟡 Sederhana',
    low: '🔵 Santai'
  };

  const icon = document.getElementById('confirmIcon');
  icon.className = 'modal-icon info';
  icon.innerHTML = '<i class="fas fa-calendar-alt"></i>';

  document.getElementById('confirmTitle').textContent = 'Butiran Tempahan';
  document.getElementById('confirmDesc').innerHTML = `
    <div class="modal-info-block" style="text-align:left;">
      <div class="modal-info-row"><span>Status</span><span>${labels[a.status] || a.status}</span></div>
      <div class="modal-info-row"><span>Tarikh</span><span>${formatDateFull(a.date)}</span></div>
      <div class="modal-info-row"><span>Masa</span><span>${escapeHtml(a.timeSlot || '-')}</span></div>
      <div class="modal-info-row"><span>Kaunselor</span><span>${escapeHtml(a.counselorName || '-')}</span></div>
      <div class="modal-info-row"><span>Tahap</span><span>${urgLabels[a.urgencyLevel] || '-'}</span></div>
      ${a.location ? `<div class="modal-info-row"><span>Lokasi</span><span>${escapeHtml(a.location)}</span></div>` : ''}
      ${a.counselorNotes ? `
        <div class="modal-info-row" style="flex-direction:column;align-items:flex-start;gap:0.3rem;">
          <span>Nota Kaunselor:</span>
          <span style="text-align:left;font-weight:500;color:var(--ink-soft);font-style:italic;">${escapeHtml(a.counselorNotes)}</span>
        </div>` : ''}
      ${a.proposedDate ? `
        <div class="modal-info-row"><span>Cadangan Baharu</span><span>${formatDateShort(a.proposedDate)} ${escapeHtml(a.proposedTime || '')}</span></div>
      ` : ''}
    </div>`;

  const actions = document.getElementById('confirmActions');
  const canCancel = a.status === 'pending';
  actions.innerHTML = canCancel
    ? `<button class="btn btn-secondary" onclick="closeConfirmModal()">Tutup</button>
       <button class="btn btn-danger" onclick="cancelAppt('${a.id}')"><i class="fas fa-times"></i> Batal</button>`
    : `<button class="btn btn-secondary" style="flex:1;" onclick="closeConfirmModal()">Tutup</button>`;

  document.getElementById('confirmModal').classList.add('active');
};

window.cancelAppt = function(id) {
  const a = myAppointments.find(x => x.id === id);
  if (!a) return;

  const icon = document.getElementById('confirmIcon');
  icon.className = 'modal-icon';
  icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';

  document.getElementById('confirmTitle').textContent = 'Batal Tempahan?';
  document.getElementById('confirmDesc').innerHTML =
    `Tempahan pada <strong>${formatDateFull(a.date)}</strong> (${escapeHtml(a.timeSlot)}) akan dibatalkan.`;

  const actions = document.getElementById('confirmActions');
  actions.innerHTML = `
    <button class="btn btn-secondary" onclick="closeConfirmModal()">Kekalkan</button>
    <button class="btn btn-danger" id="confirmYesBtn"><i class="fas fa-times"></i> Ya, Batal</button>`;

  document.getElementById('confirmYesBtn').addEventListener('click', async () => {
    const btn = document.getElementById('confirmYesBtn');
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Memproses...';

    try {
      const { db, fs } = window.EMindCare;
      await fs.updateDoc(fs.doc(db, APPOINTMENTS_COLLECTION, id), {
        status: 'cancelled',
        cancelledBy: 'murid',
        cancelledAt: fs.serverTimestamp()
      });

      const i1 = myAppointments.findIndex(x => x.id === id);
      if (i1 >= 0) myAppointments[i1].status = 'cancelled';
      const i2 = allAppointments.findIndex(x => x.id === id);
      if (i2 >= 0) allAppointments[i2].status = 'cancelled';

      renderMyAppointments();
      updateTabBadges();
      if (selectedDate) renderTimeSlots(selectedDate);

      closeConfirmModal();
      showToast('Berjaya', 'Tempahan telah dibatalkan.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Ralat', 'Gagal membatalkan: ' + err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });

  document.getElementById('confirmModal').classList.add('active');
};

/* ═══════════════════════════════════════════════════════════════
   SUCCESS MODAL
   ═══════════════════════════════════════════════════════════════ */
function showSuccessModal(info) {
  document.getElementById('successDetails').innerHTML = `
    <div class="modal-info-row"><span>Tarikh</span><span>${formatDateFull(info.date)}</span></div>
    <div class="modal-info-row"><span>Masa</span><span>${escapeHtml(info.time)}</span></div>
    <div class="modal-info-row"><span>Kaunselor</span><span>${escapeHtml(info.counselor)}</span></div>
    <div class="modal-info-row"><span>Status</span><span style="color:var(--orange);">Menunggu Pengesahan</span></div>`;
  document.getElementById('successModal').classList.add('active');
}

window.closeSuccessModal = function() {
  document.getElementById('successModal').classList.remove('active');
};

/* ═══════════════════════════════════════════════════════════════
   LOGOUT
   ═══════════════════════════════════════════════════════════════ */
window.confirmLogout = function() {
  const icon = document.getElementById('confirmIcon');
  icon.className = 'modal-icon';
  icon.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
  document.getElementById('confirmTitle').textContent = 'Log Keluar?';
  document.getElementById('confirmDesc').innerHTML = 'Anda akan dikembalikan ke halaman log masuk.';

  const actions = document.getElementById('confirmActions');
  actions.innerHTML = `
    <button class="btn btn-secondary" onclick="closeConfirmModal()">Batal</button>
    <button class="btn btn-danger" onclick="doLogout()"><i class="fas fa-sign-out-alt"></i> Ya, Log Keluar</button>`;

  document.getElementById('confirmModal').classList.add('active');
};

window.closeConfirmModal = function() {
  document.getElementById('confirmModal').classList.remove('active');
};

window.doLogout = function() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'login.html';
};

document.getElementById('confirmModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeConfirmModal();
});

document.getElementById('successModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeSuccessModal();
});

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
    <div class="toast-content"><strong>${title}</strong><span>${message}</span></div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDateFull(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()} ${MONTHS_MS[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return dateStr; }
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return `${String(d.getDate()).padStart(2,'0')} ${MONTHS_SHORT[d.getMonth()]}`;
  } catch { return dateStr; }
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

console.log(
  "%c 📅 Tempah Kaunseling ",
  "background:linear-gradient(135deg,#0F766E,#4F46E5,#06B6D4);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Ready · v2.0");
