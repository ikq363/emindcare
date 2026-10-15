import './config.js';

const SESSION_KEY = 'emindcare_session';
let currentUser = null;
const { fs, db, auth, auth_fns } = window.EMindCare;

window.addEventListener('DOMContentLoaded', async () => {
  authGuard();
  applyBranding();
  initListeners();
});

function authGuard() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) { window.location.href = 'login.html'; return; }
  try {
    const session = JSON.parse(raw);
    if (session.role !== 'kaunselor') {
      const redirects = { guru: 'dashboard-guru.html', murid: 'dashboard-murid.html' };
      window.location.href = redirects[session.role] || 'login.html';
      return;
    }
    currentUser = session;
    document.getElementById('sbProfileName').textContent = session.fullName || 'Kaunselor';
    const avatar = document.getElementById('sbAvatar');
    if (session.avatarUrl) {
      avatar.innerHTML = `<img src="${session.avatarUrl}" alt="">`;
    } else {
      avatar.textContent = (session.fullName || 'K').charAt(0).toUpperCase();
    }
  } catch (e) {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
  }
}

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

window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sbBackdrop').classList.toggle('active');
};

window.logout = function() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'login.html';
};

window.refreshAll = function() {
  showToast('Memuat semula', 'Mengambil data terkini...', 'info');
};

function showToast(title, message, type = 'success', duration = 4000) {
  const container = document.getElementById('toastContainer');
  const icons = { success: 'fa-check', error: 'fa-times', info: 'fa-info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div style="display:flex; gap:0.8rem; align-items:center;">
      <i class="fas ${icons[type] || 'fa-info'}"></i>
      <div><strong>${title}</strong><br><span style="font-size:0.78rem; color:var(--ink-soft);">${message}</span></div>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function initListeners() {
  document.getElementById('formBlockDate')?.addEventListener('submit', handleAddBlockedDate);
  document.getElementById('formScheduleSettings')?.addEventListener('submit', handleSaveScheduleSettings);

  fs.onSnapshot(fs.collection(db, 'blocked_dates'), (snapshot) => {
    const container = document.getElementById('blockedDatesList');
    container.innerHTML = '';
    if (snapshot.empty) {
      container.innerHTML = '<p style="font-size:0.75rem; color:var(--ink-soft);">Tiada blocked dates.</p>';
      return;
    }
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const color = data.type === 'red' ? '#EF4444' : '#F59E0B';
      const div = document.createElement('div');
      div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:var(--pearl); padding:0.5rem 0.8rem; border-radius:10px; font-size:0.78rem; border:1px solid var(--line);';
      div.innerHTML = `
        <div><strong style="color:${color};">${data.date}</strong> - ${data.reason}</div>
        <button onclick="deleteBlockedDate('${docSnap.id}')" style="border:none; background:none; color:#EF4444; cursor:pointer;"><i class="fas fa-trash"></i></button>
      `;
      container.appendChild(div);
    });
  });

  fs.onSnapshot(fs.collection(db, 'appointments'), (snapshot) => {
    const pendingList = document.getElementById('pendingList');
    const activeList = document.getElementById('activeList');
    const historyList = document.getElementById('historyList');

    pendingList.innerHTML = ''; activeList.innerHTML = ''; historyList.innerHTML = '';
    let pendingCount = 0;

    snapshot.forEach((docSnap) => {
      const app = { id: docSnap.id, ...docSnap.data() };
      if (app.status === 'pending') {
        pendingCount++;
        pendingList.appendChild(createCard(app));
      } else if (app.status === 'approved' || app.status === 'deferred') {
        activeList.appendChild(createCard(app));
      } else {
        historyList.appendChild(createCard(app));
      }
    });

    const badge = document.getElementById('pendingBadge');
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  });
}

function createCard(app) {
  const card = document.createElement('div');
  card.className = 'app-card';
  card.innerHTML = `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
        <strong style="font-size:0.9rem;">${app.studentName || 'Murid'}</strong>
        <span class="status-badge ${app.status}">${app.status}</span>
      </div>
      <p style="font-size:0.78rem; color:var(--ink-soft);"><strong>IC/Kelas:</strong> ${app.studentIc || '-'} (${app.studentClass || '-'})</p>
      <p style="font-size:0.78rem; color:var(--ink-soft);"><strong>Masa:</strong> ${app.date} @ ${app.timeSlot}</p>
      <p style="font-size:0.78rem; color:var(--teal); margin-top:0.3rem;"><strong>Tahap:</strong> ${app.urgencyLevel}</p>
      <p style="font-size:0.78rem; font-style:italic; margin-top:0.4rem; background:var(--pearl); padding:0.5rem; border-radius:8px;">"${app.feelingNotes}"</p>
      ${app.counselorNotes ? `<p style="font-size:0.75rem; color:var(--indigo); margin-top:0.4rem;"><strong>Nota:</strong> ${app.counselorNotes}</p>` : ''}
    </div>
    <div style="margin-top:1rem; display:flex; gap:0.4rem;">
      ${app.status === 'pending' ? `
        <button onclick="openActionModal('${app.id}', '${app.studentName}', 'approved')" class="btn btn-teal" style="flex:1; font-size:0.72rem; padding:0.4rem;">Lulus</button>
        <button onclick="openActionModal('${app.id}', '${app.studentName}', 'deferred')" class="btn" style="background:var(--pearl); flex:1; font-size:0.72rem; padding:0.4rem;">Tangguh</button>
        <button onclick="openActionModal('${app.id}', '${app.studentName}', 'cancelled')" class="btn" style="background:#FEE2E2; color:#DC2626; font-size:0.72rem; padding:0.4rem;">Tolak</button>
      ` : ''}
      ${(app.status === 'approved' || app.status === 'deferred') ? `
        <button onclick="markCompleted('${app.id}')" class="btn btn-teal" style="width:100%; font-size:0.75rem;">Tanda Selesai</button>
      ` : ''}
    </div>
  `;
  return card;
}

window.switchTab = function(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  if (tab === 'pending') { document.getElementById('tabPendingBtn').classList.add('active'); document.getElementById('partisiPending').style.display = 'block'; }
  else if (tab === 'active') { document.getElementById('tabActiveBtn').classList.add('active'); document.getElementById('partisiActive').style.display = 'block'; }
  else { document.getElementById('tabHistoryBtn').classList.add('active'); document.getElementById('partisiHistory').style.display = 'block'; }
};

async function handleAddBlockedDate(e) {
  e.preventDefault();
  const date = document.getElementById('blockDateInput').value;
  const type = document.getElementById('blockTypeSelect').value;
  const reason = document.getElementById('blockReasonInput').value;
  await fs.setDoc(fs.doc(db, 'blocked_dates', date), { date, type, reason, createdAt: fs.serverTimestamp() });
  document.getElementById('formBlockDate').reset();
  showToast('Berjaya', 'Blocked date disimpan.');
}

window.deleteBlockedDate = async function(id) {
  if (confirm('Padam tarikh ini?')) {
    await fs.deleteDoc(fs.doc(db, 'blocked_dates', id));
    showToast('Berjaya', 'Tarikh dipadam.');
  }
};

async function handleSaveScheduleSettings(e) {
  e.preventDefault();
  const startTime = document.getElementById('startTimeInput').value;
  const endTime = document.getElementById('endTimeInput').value;
  const slotInterval = parseInt(document.getElementById('slotIntervalSelect').value);
  const workDays = Array.from(document.querySelectorAll('input[name="workDays"]:checked')).map(cb => parseInt(cb.value));
  await fs.setDoc(fs.doc(db, 'schedule_settings', 'default'), { startTime, endTime, slotInterval, workDays, updatedAt: fs.serverTimestamp() });
  showToast('Berjaya', 'Tetapan operasi disimpan.');
}

window.openActionModal = function(id, name, action) {
  document.getElementById('modalAppointmentId').value = id;
  document.getElementById('modalActionType').value = action;
  document.getElementById('modalStudentName').textContent = `Permohonan oleh: ${name}`;
  document.getElementById('rescheduleFields').style.display = action === 'deferred' ? 'block' : 'none';
  document.getElementById('actionModal').classList.add('active');
};

window.closeActionModal = function() { document.getElementById('actionModal').classList.remove('active'); };

window.submitModalAction = async function() {
  const id = document.getElementById('modalAppointmentId').value;
  const status = document.getElementById('modalActionType').value;
  const counselorNotes = document.getElementById('modalCounselorNotes').value;
  const updateData = { status, counselorNotes, updatedAt: fs.serverTimestamp() };
  if (status === 'deferred') {
    const newDate = document.getElementById('modalNewDate').value;
    const newTime = document.getElementById('modalNewTime').value;
    if (newDate) updateData.date = newDate;
    if (newTime) updateData.timeSlot = newTime;
  }
  await fs.updateDoc(fs.doc(db, 'appointments', id), updateData);
  closeActionModal();
  showToast('Berjaya', 'Permohonan dikemaskini.');
};

window.markCompleted = async function(id) {
  if (confirm('Tanda selesai?')) {
    await fs.updateDoc(fs.doc(db, 'appointments', id), { status: 'completed', updatedAt: fs.serverTimestamp() });
    showToast('Berjaya', 'Sesi ditanda selesai.');
  }
};
