/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Dashboard User Script (v4)
   Bulk Registration + CSV + Guru Kelas (bukan Subjek)
   ═══════════════════════════════════════════════════════════════ */

import './config.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const SESSION_KEY = 'emindcare_session';
const CURRENT_YEAR = new Date().getFullYear().toString();
const CHUNK_SIZE = 450;

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let currentUser = null;
let allUsers = [];
let csvData = { murid: [], guru: [] };
let pendingConfirmAction = null;
let editingUserId = null;
let editingUserRole = null;
let isSubmittingSingle = { murid: false, guru: false };
let isSubmittingBulk = { murid: false, guru: false };

/* ═══════════════════════════════════════════════════════════════
   HELPER: Extract Birth Year & Age from IC
   ═══════════════════════════════════════════════════════════════ */
function getBirthInfoFromIC(icNumber) {
  if (!icNumber || icNumber.length < 2) return { birthYear: null, age: null };
  const yy = parseInt(icNumber.substring(0, 2), 10);
  if (isNaN(yy)) return { birthYear: null, age: null };

  const currentYear = new Date().getFullYear();
  const currentYY = currentYear % 100;
  let birthYear = yy <= currentYY ? 2000 + yy : 1900 + yy;
  const age = currentYear - birthYear;
  return { birthYear, age };
}

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  await waitForEMindCare();
  if (!authGuard()) return;
  initUI();
  applyBranding();
  await loadUsers();

  // Start rows
  for (let i = 0; i < 3; i++) addRow('murid', true);
  for (let i = 0; i < 2; i++) addRow('guru', true);
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
   INIT UI
   ═══════════════════════════════════════════════════════════════ */
function initUI() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll('.mode-switcher').forEach(switcher => {
    const group = switcher.dataset.group;
    switcher.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switcher.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        switchMode(group, btn.dataset.mode);
      });
    });
  });

  ['murid', 'guru'].forEach(group => initCsvDrop(group));

  document.getElementById('muridSearch')?.addEventListener('input', renderMuridTable);
  document.getElementById('muridFilterKelas')?.addEventListener('change', renderMuridTable);
  document.getElementById('muridFilterTahun')?.addEventListener('change', renderMuridTable);
  document.getElementById('guruSearch')?.addEventListener('input', renderGuruTable);
  document.getElementById('guruFilterJawatan')?.addEventListener('change', renderGuruTable);
  document.getElementById('guruFilterTahun')?.addEventListener('change', renderGuruTable);

  document.getElementById('confirmBtn')?.addEventListener('click', async () => {
    if (typeof pendingConfirmAction === 'function') {
      const action = pendingConfirmAction;
      closeConfirmModal();
      await action();
    }
  });

  document.getElementById('singleFormMurid')?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitSingle(e, 'murid');
  });
  document.getElementById('singleFormGuru')?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitSingle(e, 'guru');
  });

  document.querySelectorAll('.input-field.upper').forEach(el => {
    if (el.dataset.fmtAttached) return;
    el.dataset.fmtAttached = '1';
    el.addEventListener('input', (e) => {
      const start = e.target.selectionStart;
      const oldLen = e.target.value.length;
      e.target.value = e.target.value.replace(/[^A-Za-z0-9\s'\.\-]/g, '').toUpperCase();
      const diff = oldLen - e.target.value.length;
      if (diff > 0) e.target.setSelectionRange(Math.max(0, start - diff), Math.max(0, start - diff));
    });
  });

  document.querySelectorAll('.input-field.mono').forEach(el => {
    if (el.dataset.fmtAttached) return;
    el.dataset.fmtAttached = '1';
    el.addEventListener('input', (e) => {
      const start = e.target.selectionStart;
      const oldLen = e.target.value.length;
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
      const diff = oldLen - e.target.value.length;
      if (diff > 0) e.target.setSelectionRange(Math.max(0, start - diff), Math.max(0, start - diff));
    });
  });
}

window.switchTab = function(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.dataset.panel === tabName);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.switchMode = function(group, mode) {
  document.querySelectorAll(`[data-panel-${group}]`).forEach(p => {
    p.classList.toggle('active', p.dataset[`panel${capitalize(group)}`] === mode);
  });
};

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ═══════════════════════════════════════════════════════════════
   BRANDING
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
   ⚡ MULTI-ROW (Fixed + Tingkatan + Guru Kelas)
   ═══════════════════════════════════════════════════════════════ */
window.addRow = function(group, silent = false) {
  const container = document.getElementById(`multiRowList${capitalize(group)}`);
  if (!container) return;

  const rowNum = container.children.length + 1;
  const isGuru = group === 'guru';
  const rowId = 'row_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  const row = document.createElement('div');
  row.className = 'multi-row';
  row.dataset.rowId = rowId;

  if (isGuru) {
    // GURU: Nama | IC | Tingkatan | Kelas | Jawatan Tambahan | Tahun
    row.innerHTML = `
      <div class="multi-row-header">
        <div class="multi-row-title">
          <span class="multi-row-num">${rowNum}</span>
          <span class="multi-row-label">Guru #${rowNum}</span>
        </div>
        <button type="button" class="multi-row-delete" onclick="removeRow(this, '${group}')" title="Hapus baris">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="multi-row-grid guru-grid">
        <div class="multi-row-field">
          <label class="multi-row-field-label">Nama Penuh</label>
          <input type="text" class="multi-row-input upper" placeholder="SEPERTI DALAM IC" data-field="fullName" maxlength="100">
        </div>
        <div class="multi-row-field">
          <label class="multi-row-field-label">Nombor IC</label>
          <input type="text" class="multi-row-input mono" placeholder="12 DIGIT" data-field="icNumber" maxlength="12" inputmode="numeric">
          <span class="auto-hint" data-hint-for="${rowId}"></span>
        </div>
        <div class="multi-row-field">
          <label class="multi-row-field-label">Tingkatan</label>
          <select class="multi-row-select" data-field="formLevel">
            <option value="">—</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
          </select>
        </div>
        <div class="multi-row-field">
          <label class="multi-row-field-label">Guru Kelas</label>
          <input type="text" class="multi-row-input upper" placeholder="MAWAR" data-field="className" maxlength="40">
        </div>
        <div class="multi-row-field">
          <label class="multi-row-field-label">Jawatan Tambahan</label>
          <input type="text" class="multi-row-input upper" placeholder="GURU MATEMATIK" data-field="title" maxlength="80">
        </div>
        <div class="multi-row-field">
          <label class="multi-row-field-label">Tahun</label>
          <input type="text" class="multi-row-input" placeholder="${CURRENT_YEAR}" data-field="sessionYear" maxlength="4" inputmode="numeric">
        </div>
      </div>
    `;
  } else {
    // MURID: Nama | IC | Tingkatan | Kelas | Tahun
    row.innerHTML = `
      <div class="multi-row-header">
        <div class="multi-row-title">
          <span class="multi-row-num">${rowNum}</span>
          <span class="multi-row-label">Murid #${rowNum}</span>
        </div>
        <button type="button" class="multi-row-delete" onclick="removeRow(this, '${group}')" title="Hapus baris">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="multi-row-grid murid-grid">
        <div class="multi-row-field">
          <label class="multi-row-field-label">Nama Penuh</label>
          <input type="text" class="multi-row-input upper" placeholder="SEPERTI DALAM IC" data-field="fullName" maxlength="100">
        </div>
        <div class="multi-row-field">
          <label class="multi-row-field-label">Nombor IC</label>
          <input type="text" class="multi-row-input mono" placeholder="12 DIGIT" data-field="icNumber" maxlength="12" inputmode="numeric">
          <span class="auto-hint" data-hint-for="${rowId}"></span>
        </div>
        <div class="multi-row-field">
          <label class="multi-row-field-label">Tingkatan</label>
          <select class="multi-row-select" data-field="formLevel">
            <option value="">—</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
          </select>
        </div>
        <div class="multi-row-field">
          <label class="multi-row-field-label">Nama Kelas</label>
          <input type="text" class="multi-row-input upper" placeholder="MAWAR" data-field="className" maxlength="40">
        </div>
        <div class="multi-row-field">
          <label class="multi-row-field-label">Tahun</label>
          <input type="text" class="multi-row-input" placeholder="${CURRENT_YEAR}" data-field="sessionYear" maxlength="4" inputmode="numeric">
        </div>
      </div>
    `;
  }

  // Auto-format
  const nameInput = row.querySelector('[data-field="fullName"]');
  const icInput = row.querySelector('[data-field="icNumber"]');
  const classInput = row.querySelector('[data-field="className"]');
  const titleInput = row.querySelector('[data-field="title"]');
  const yearInput = row.querySelector('[data-field="sessionYear"]');

  nameInput.addEventListener('input', (e) => {
    const start = e.target.selectionStart;
    const oldLen = e.target.value.length;
    e.target.value = e.target.value.replace(/[^A-Za-z\s'\.]/g, '').toUpperCase();
    const diff = oldLen - e.target.value.length;
    if (diff > 0) e.target.setSelectionRange(Math.max(0, start - diff), Math.max(0, start - diff));
  });

  icInput.addEventListener('input', (e) => {
    const start = e.target.selectionStart;
    const oldLen = e.target.value.length;
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
    const diff = oldLen - e.target.value.length;
    if (diff > 0) e.target.setSelectionRange(Math.max(0, start - diff), Math.max(0, start - diff));
    updateAutoHint(row, e.target.value);
  });

  classInput.addEventListener('input', (e) => {
    const start = e.target.selectionStart;
    const oldLen = e.target.value.length;
    e.target.value = e.target.value.replace(/[^A-Za-z0-9\s'\.\-]/g, '').toUpperCase();
    const diff = oldLen - e.target.value.length;
    if (diff > 0) e.target.setSelectionRange(Math.max(0, start - diff), Math.max(0, start - diff));
  });

  if (titleInput) {
    titleInput.addEventListener('input', (e) => {
      const start = e.target.selectionStart;
      const oldLen = e.target.value.length;
      e.target.value = e.target.value.replace(/[^A-Za-z0-9\s'\.\-]/g, '').toUpperCase();
      const diff = oldLen - e.target.value.length;
      if (diff > 0) e.target.setSelectionRange(Math.max(0, start - diff), Math.max(0, start - diff));
    });
  }

  yearInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  });

  // Enter key → tambah baris
  row.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.tagName !== 'SELECT') {
        e.preventDefault();
        if (row === container.lastElementChild) addRow(group);
      }
    });
  });

  container.appendChild(row);

  if (!silent) {
    row.scrollIntoView({ behavior: 's
