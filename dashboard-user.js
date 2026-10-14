/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Dashboard User Script (v5 — Clean)
   Bulk + CSV + Guru Kelas (TANPA Jawatan Tambahan)
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
let isSubmittingSingle = { murid: false, guru: false };
let isSubmittingBulk = { murid: false, guru: false };

/* ═══════════════════════════════════════════════════════════════
   🔧 HELPER: Normalize Role (case-insensitive)
   ═══════════════════════════════════════════════════════════════ */
function normalizeRole(rawRole) {
  if (!rawRole) return null;
  const cleaned = String(rawRole).toLowerCase().trim().replace(/\s+/g, ' ');

  const aliasMap = {
    'kaunselor': 'kaunselor',
    'kaunselor ubk': 'kaunselor',
    'kaunselor semsira': 'kaunselor',
    'counselor': 'kaunselor',
    'counsellor': 'kaunselor',
    'guru': 'guru',
    'teacher': 'guru',
    'murid': 'murid',
    'pelajar': 'murid',
    'student': 'murid'
  };

  if (aliasMap[cleaned]) return aliasMap[cleaned];

  for (const key in aliasMap) {
    if (cleaned.includes(key)) return aliasMap[key];
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   🔧 HELPER: Get Birth Year & Age from IC
   ═══════════════════════════════════════════════════════════════ */
function getBirthInfoFromIC(icNumber) {
  if (!icNumber || icNumber.length < 2) return { birthYear: null, age: null };
  const yy = parseInt(icNumber.substring(0, 2), 10);
  if (isNaN(yy)) return { birthYear: null, age: null };

  const currentYear = new Date().getFullYear();
  const currentYY = currentYear % 100;
  const birthYear = yy <= currentYY ? 2000 + yy : 1900 + yy;
  const age = currentYear - birthYear;
  return { birthYear, age };
}

/* ═══════════════════════════════════════════════════════════════
   🚀 INIT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('load', async () => {
  console.log('🚀 Dashboard User loading...');

  try {
    await waitForEMindCare();
    console.log('✅ EMindCare SDK ready');

    if (!authGuard()) {
      console.warn('❌ Auth guard failed');
      return;
    }

    console.log('✅ Auth guard passed');

    initUI();
    console.log('✅ UI initialized');

    applyBranding();
    console.log('✅ Branding applied');

    await loadUsers();
    console.log('✅ Users loaded:', allUsers.length);

    for (let i = 0; i < 3; i++) addRow('murid', true);
    for (let i = 0; i < 2; i++) addRow('guru', true);
    console.log('✅ Rows added');

    console.log('🎉 Dashboard User READY');
  } catch (err) {
    console.error('💥 INIT ERROR:', err);
    showToast('Ralat Sistem', 'Gagal memuatkan dashboard: ' + err.message, 'error', 8000);
  }
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
   🔒 AUTH GUARD
   ═══════════════════════════════════════════════════════════════ */
function authGuard() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    console.warn('⚠️ No session found — redirect to login');
    window.location.href = 'login.html';
    return false;
  }

  try {
    const session = JSON.parse(raw);
    console.log('📋 Session loaded:', {
      uid: session.uid,
      fullName: session.fullName,
      role: session.role
    });

    const role = normalizeRole(session.role);
    console.log('📋 Normalized role:', role);

    if (!role) {
      console.warn('⚠️ Invalid role:', session.role);
      showToast('Ralat Peranan', 'Peranan anda tidak sah. Sila login semula.', 'error', 5000);
      localStorage.removeItem(SESSION_KEY);
      setTimeout(() => { window.location.href = 'login.html'; }, 2000);
      return false;
    }

    if (role !== 'kaunselor') {
      const redirects = {
        guru: 'dashboard-guru.html',
        murid: 'dashboard-murid.html'
      };
      console.warn(`⚠️ Role = ${role}, redirecting to ${redirects[role]}`);
      window.location.href = redirects[role] || 'login.html';
      return false;
    }

    currentUser = session;
    loadProfile();
    return true;

  } catch (e) {
    console.error('❌ Session parse error:', e);
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   👤 LOAD PROFILE
   ═══════════════════════════════════════════════════════════════ */
function loadProfile() {
  if (!currentUser) return;

  const name = currentUser.fullName || 'Kaunselor';
  const initial = name.charAt(0).toUpperCase();

  console.log('👤 Loading profile:', name);

  const nameEl = document.getElementById('sbProfileName');
  if (nameEl) nameEl.textContent = name;

  const avatarEl = document.getElementById('sbAvatar');
  if (avatarEl) {
    const avatarUrl = currentUser.avatarUrl || currentUser.profileImage;
    if (avatarUrl) {
      avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${name}">`;
    } else {
      avatarEl.textContent = initial;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   🎨 APPLY BRANDING
   ═══════════════════════════════════════════════════════════════ */
async function applyBranding() {
  try {
    const cfg = await window.EMindCare.getSiteConfig();
    if (!cfg?.branding) return;
    const b = cfg.branding;

    if (b.name) {
      const el = document.getElementById('sbBrandName');
      if (el) el.textContent = b.name;
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
  } catch (e) {
    console.warn('⚠️ Branding error:', e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   🎯 INIT UI
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
  document.getElementById('guruFilterKelas')?.addEventListener('change', renderGuruTable);
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
   📝 MULTI-ROW
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

  // Sama untuk murid & guru: Nama | IC | Tingkatan | Kelas | Tahun
  row.innerHTML = `
    <div class="multi-row-header">
      <div class="multi-row-title">
        <span class="multi-row-num">${rowNum}</span>
        <span class="multi-row-label">${isGuru ? 'Guru' : 'Murid'} #${rowNum}</span>
      </div>
      <button type="button" class="multi-row-delete" onclick="removeRow(this, '${group}')" title="Hapus baris">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="multi-row-grid ${isGuru ? 'guru-grid' : 'murid-grid'}">
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
        <label class="multi-row-field-label">${isGuru ? 'Guru Kelas' : 'Nama Kelas'}</label>
        <input type="text" class="multi-row-input upper" placeholder="MAWAR" data-field="className" maxlength="40">
      </div>
      <div class="multi-row-field">
        <label class="multi-row-field-label">Tahun</label>
        <input type="text" class="multi-row-input" placeholder="${CURRENT_YEAR}" data-field="sessionYear" maxlength="4" inputmode="numeric">
      </div>
    </div>
  `;

  const nameInput = row.querySelector('[data-field="fullName"]');
  const icInput = row.querySelector('[data-field="icNumber"]');
  const classInput = row.querySelector('[data-field="className"]');
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

  yearInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  });

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
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nameInput.focus();
  }
};

function updateAutoHint(row, icValue) {
  const hint = row.querySelector('.auto-hint');
  if (!hint) return;

  if (icValue.length < 2) {
    hint.classList.remove('show');
    hint.textContent = '';
    return;
  }

  const { birthYear, age } = getBirthInfoFromIC(icValue);
  if (birthYear && age) {
    hint.innerHTML = `<i class="fas fa-cake-candles"></i> <span>Lahir ${birthYear} · ${age} tahun</span>`;
    hint.classList.add('show');
  } else {
    hint.classList.remove('show');
  }
}

window.removeRow = function(btn, group) {
  const container = document.getElementById(`multiRowList${capitalize(group)}`);
  const row = btn.closest('.multi-row');
  if (!row) return;

  if (container.children.length <= 1) {
    showToast('Info', 'Perlu ada sekurang-kurangnya 1 baris.', 'warning');
    return;
  }

  row.style.transition = 'all 0.3s';
  row.style.opacity = '0';
  row.style.transform = 'translateX(-20px)';
  setTimeout(() => {
    row.remove();
    renumberRows(group);
  }, 300);
};

function renumberRows(group) {
  const container = document.getElementById(`multiRowList${capitalize(group)}`);
  if (!container) return;
  const isGuru = group === 'guru';
  [...container.children].forEach((row, idx) => {
    const num = row.querySelector('.multi-row-num');
    const label = row.querySelector('.multi-row-label');
    if (num) num.textContent = idx + 1;
    if (label) label.textContent = `${isGuru ? 'Guru' : 'Murid'} #${idx + 1}`;
  });
}

function getMultiRowData(group) {
  const container = document.getElementById(`multiRowList${capitalize(group)}`);
  if (!container) return [];

  const data = [];
  [...container.children].forEach(row => {
    const fullName = row.querySelector('[data-field="fullName"]')?.value.trim() || '';
    const icNumber = row.querySelector('[data-field="icNumber"]')?.value.trim() || '';
    const className = row.querySelector('[data-field="className"]')?.value.trim() || '';
    const sessionYear = row.querySelector('[data-field="sessionYear"]')?.value.trim() || CURRENT_YEAR;
    const formLevel = row.querySelector('[data-field="formLevel"]')?.value || '';

    if (!fullName && !icNumber) return;

    let finalClass = className;
    if (formLevel && className) {
      finalClass = `${formLevel} ${className}`.trim();
    } else if (formLevel) {
      finalClass = formLevel;
    }

    data.push({
      fullName,
      icNumber,
      formLevel,
      className: finalClass,
      sessionYear: sessionYear || CURRENT_YEAR
    });
  });
  return data;
}

function clearAllRows(group) {
  const container = document.getElementById(`multiRowList${capitalize(group)}`);
  if (container) container.innerHTML = '';
}

/* ═══════════════════════════════════════════════════════════════
   📤 BULK SUBMIT
   ═══════════════════════════════════════════════════════════════ */
window.submitBulk = async function(group) {
  if (isSubmittingBulk[group]) return;

  const data = getMultiRowData(group);

  if (!data.length) {
    return showToast('Ralat', 'Sila isi sekurang-kurangnya 1 pengguna.', 'warning');
  }

  const invalid = data.filter(d => !d.fullName || d.fullName.length < 3 || !/^\d{12}$/.test(d.icNumber));
  if (invalid.length) {
    return showToast('Ralat Validasi', `${invalid.length} pengguna tidak lengkap (nama atau IC tidak sah).`, 'error', 6000);
  }

  const icSet = new Set();
  const dupInList = [];
  data.forEach(d => {
    if (icSet.has(d.icNumber)) dupInList.push(d.fullName);
    icSet.add(d.icNumber);
  });
  if (dupInList.length) {
    return showToast('IC Berulang', `${dupInList.length} IC berulang dalam senarai.`, 'error', 6000);
  }

  const existing = new Set(allUsers.map(u => u.icNumber));
  const dupInDb = data.filter(d => existing.has(d.icNumber));
  if (dupInDb.length) {
    return showToast('IC Sudah Wujud', `${dupInDb.length} IC sudah berdaftar dalam sistem.`, 'error', 6000);
  }

  showConfirmModal({
    title: `Daftar ${data.length} Pengguna?`,
    desc: `Anda akan mendaftarkan ${data.length} akaun ${group} baharu.`,
    confirmText: `Ya, Daftar ${data.length}`,
    onConfirm: async () => {
      await processBulkInsert(group, data);
    }
  });
};

async function processBulkInsert(group, data) {
  isSubmittingBulk[group] = true;

  const btn = document.getElementById(`bulkSubmit${capitalize(group)}`);
  const progressEl = document.getElementById(`bulkProgress${capitalize(group)}`);
  const fillEl = document.getElementById(`bulkProgressFill${capitalize(group)}`);
  const pctEl = document.getElementById(`bulkProgressPct${capitalize(group)}`);
  const labelEl = document.getElementById(`bulkProgressLabel${capitalize(group)}`);

  btn?.classList.add('loading');
  if (btn) btn.disabled = true;

  progressEl?.classList.add('active');
  if (fillEl) fillEl.style.width = '0%';
  if (pctEl) pctEl.textContent = '0%';

  try {
    const { db, fs } = window.EMindCare;
    const { doc, collection, writeBatch, serverTimestamp } = fs;

    let processed = 0;
    const total = data.length;

    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach(item => {
        const docRef = doc(collection(db, 'users'));
        const { birthYear, age } = getBirthInfoFromIC(item.icNumber);

        batch.set(docRef, {
          fullName: item.fullName,
          icNumber: item.icNumber,
          role: group,
          formLevel: item.formLevel || null,
          class: item.className || null,
          sessionYear: item.sessionYear || CURRENT_YEAR,
          birthYear: birthYear || null,
          age: age || null,
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid
        });
      });

      await batch.commit();
      processed += chunk.length;

      const pct = Math.round((processed / total) * 100);
      if (fillEl) fillEl.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
      if (labelEl) labelEl.textContent = `Menyimpan ${processed}/${total}...`;
    }

    if (labelEl) labelEl.textContent = `✓ Selesai — ${total} akaun didaftarkan`;
    showToast('Berjaya!', `${total} akaun ${group} berjaya didaftarkan.`, 'success', 6000);

    clearAllRows(group);
    const initialRows = group === 'murid' ? 3 : 2;
    for (let i = 0; i < initialRows; i++) addRow(group, true);

    await loadUsers();

    setTimeout(() => progressEl?.classList.remove('active'), 2000);

  } catch (err) {
    console.error('Bulk insert error:', err);
    showToast('Gagal', 'Ralat: ' + err.message, 'error', 6000);
    progressEl?.classList.remove('active');
  } finally {
    btn?.classList.remove('loading');
    if (btn) btn.disabled = false;
    isSubmittingBulk[group] = false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   📁 CSV HANDLING
   ═══════════════════════════════════════════════════════════════ */
function initCsvDrop(group) {
  const zone = document.getElementById(`csvDrop${capitalize(group)}`);
  const input = document.getElementById(`csvInput${capitalize(group)}`);
  if (!zone || !input) return;

  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleCsvFile(group, file);
  });

  ['dragenter', 'dragover'].forEach(ev => {
    zone.addEventListener(ev, e => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(ev => {
    zone.addEventListener(ev, e => {
      e.preventDefault();
      zone.classList.remove('dragover');
    });
  });
  zone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) handleCsvFile(group, file);
  });
}

function handleCsvFile(group, file) {
  if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
    return showToast('Format Salah', 'Sila pilih fail CSV sahaja.', 'error');
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const data = results.data.map(row => {
        const fullName = (row.fullName || row.nama || row.name || row['Nama Penuh'] || row['NAMA PENUH'] || '').trim().toUpperCase();
        const icNumber = (row.icNumber || row.ic || row['Nombor IC'] || row['NOMBOR IC'] || row['no_ic'] || '').toString().replace(/\D/g, '').slice(0, 12);
        const sessionYear = (row.sessionYear || row.tahun || row.year || row['Tahun'] || row['TAHUN'] || CURRENT_YEAR).toString().trim();

        let formLevel = (row.formLevel || row.tingkatan || row.level || row['Tingkatan'] || row['TINGKATAN'] || '').toString().trim();
        let className = (row.className || row.kelas || row.class || row['Kelas'] || row['KELAS'] || '').trim().toUpperCase();

        if (formLevel) {
          const match = formLevel.match(/\d+/);
          formLevel = match ? match[0] : formLevel;
        }

        if (!formLevel && className) {
          const match = className.match(/^(\d+)\s+(.+)$/);
          if (match) {
            formLevel = match[1];
            className = match[2];
          }
        }

        let finalClass = className;
        if (formLevel && className) {
          finalClass = `${formLevel} ${className}`.trim();
        } else if (formLevel) {
          finalClass = formLevel;
        }

        const { birthYear, age } = getBirthInfoFromIC(icNumber);

        return {
          fullName,
          icNumber,
          formLevel,
          className: finalClass,
          sessionYear: sessionYear || CURRENT_YEAR,
          birthYear,
          age
        };
      }).filter(d => d.fullName && d.icNumber);

      if (!data.length) {
        return showToast('Fail Kosong', 'Tiada data sah dijumpai.', 'warning');
      }

      csvData[group] = data;
      renderCsvPreview(group);
    },
    error: (err) => {
      console.error('CSV parse error:', err);
      showToast('Ralat CSV', 'Gagal membaca fail: ' + err.message, 'error');
    }
  });
}

function renderCsvPreview(group) {
  const wrap = document.getElementById(`csvPreview${capitalize(group)}`);
  const tbody = document.getElementById(`csvPreviewBody${capitalize(group)}`);
  const countEl = document.getElementById(`csvCount${capitalize(group)}`);
  if (!wrap || !tbody) return;

  const data = csvData[group];
  wrap.classList.add('active');
  if (countEl) countEl.textContent = `${data.length} rekod`;

  tbody.innerHTML = data.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong>${escapeHtml(item.fullName)}</strong></td>
      <td class="td-mono">${escapeHtml(item.icNumber)}</td>
      <td>${escapeHtml(item.className || '—')}</td>
      <td>${item.age ? `${item.age} thn` : '—'}</td>
    </tr>
  `).join('');
}

window.clearCsv = function(group) {
  csvData[group] = [];
  document.getElementById(`csvPreview${capitalize(group)}`)?.classList.remove('active');
  document.getElementById(`csvInput${capitalize(group)}`).value = '';
};

window.downloadTemplate = function(group) {
  const isGuru = group === 'guru';

  let csv;
  if (isGuru) {
    csv = 'fullName,icNumber,formLevel,className,sessionYear\n' +
      'AHMAD BIN ALI,850101015678,3,MAWAR,2026\n' +
      'SITI BINTI HASSAN,860202016789,5,DEDIKASI,2026';
  } else {
    csv = 'fullName,icNumber,formLevel,className,sessionYear\n' +
      'AHMAD BIN ALI,080101015678,1,MAWAR,2026\n' +
      'SITI BINTI HASSAN,080202016789,2,MELATI,2026\n' +
      'MUHAMMAD IKQRAM,080303017890,5,DEDIKASI,2026';
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `template-${group}-emindcare.csv`;
  link.click();
  showToast('Template Dimuat', 'Fail template CSV telah dimuat turun.', 'success', 3000);
};

window.importCsv = async function(group) {
  const data = csvData[group];
  if (!data || !data.length) {
    return showToast('Ralat', 'Tiada data untuk diimport.', 'warning');
  }

  const invalid = data.filter(d => !/^\d{12}$/.test(d.icNumber));
  if (invalid.length) {
    return showToast('Ralat Validasi', `${invalid.length} rekod mempunyai IC tidak sah.`, 'error', 6000);
  }

  const icSet = new Set();
  const dupInList = [];
  data.forEach(d => {
    if (icSet.has(d.icNumber)) dupInList.push(d.fullName);
    icSet.add(d.icNumber);
  });
  if (dupInList.length) {
    return showToast('IC Berulang', `${dupInList.length} IC berulang.`, 'error', 6000);
  }

  const existing = new Set(allUsers.map(u => u.icNumber));
  const dupInDb = data.filter(d => existing.has(d.icNumber));
  if (dupInDb.length) {
    return showToast('IC Sudah Wujud', `${dupInDb.length} IC sudah berdaftar.`, 'error', 6000);
  }

  showConfirmModal({
    title: `Import ${data.length} Pengguna?`,
    desc: `Anda akan mengimport ${data.length} akaun ${group} dari fail CSV.`,
    confirmText: `Ya, Import ${data.length}`,
    onConfirm: async () => {
      await processCsvImport(group, data);
    }
  });
};

async function processCsvImport(group, data) {
  const progressEl = document.getElementById(`csvProgress${capitalize(group)}`);
  const fillEl = document.getElementById(`csvProgressFill${capitalize(group)}`);
  const pctEl = document.getElementById(`csvProgressPct${capitalize(group)}`);
  const labelEl = document.getElementById(`csvProgressLabel${capitalize(group)}`);

  progressEl?.classList.add('active');
  if (fillEl) fillEl.style.width = '0%';

  try {
    const { db, fs } = window.EMindCare;
    const { doc, collection, writeBatch, serverTimestamp } = fs;

    let processed = 0;
    const total = data.length;

    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach(item => {
        const docRef = doc(collection(db, 'users'));
        const { birthYear, age } = getBirthInfoFromIC(item.icNumber);

        batch.set(docRef, {
          fullName: item.fullName,
          icNumber: item.icNumber,
          role: group,
          formLevel: item.formLevel || null,
          class: item.className || null,
          sessionYear: item.sessionYear || CURRENT_YEAR,
          birthYear: birthYear || null,
          age: age || null,
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid
        });
      });

      await batch.commit();
      processed += chunk.length;

      const pct = Math.round((processed / total) * 100);
      if (fillEl) fillEl.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
      if (labelEl) labelEl.textContent = `Mengimport ${processed}/${total}...`;
    }

    if (labelEl) labelEl.textContent = `✓ Selesai — ${total} akaun diimport`;
    showToast('Berjaya!', `${total} akaun ${group} berjaya diimport.`, 'success', 6000);

    clearCsv(group);
    await loadUsers();

    setTimeout(() => progressEl?.classList.remove('active'), 2000);

  } catch (err) {
    console.error('CSV import error:', err);
    showToast('Gagal', 'Ralat: ' + err.message, 'error', 6000);
    progressEl?.classList.remove('active');
  }
}

/* ═══════════════════════════════════════════════════════════════
   📝 SINGLE REGISTRATION
   ═══════════════════════════════════════════════════════════════ */
window.submitSingle = async function(e, group) {
  if (e) e.preventDefault();
  if (isSubmittingSingle[group]) return;

  const form = e?.target || document.getElementById(`singleForm${capitalize(group)}`);
  if (!form) return;
  const btn = form.querySelector('button[type="submit"]');

  const fullName = form.querySelector('[name="fullName"]').value.trim().toUpperCase();
  const icNumber = form.querySelector('[name="icNumber"]').value.trim();
  const className = form.querySelector('[name="className"]')?.value.trim().toUpperCase() || '';
  const sessionYear = form.querySelector('[name="sessionYear"]')?.value.trim() || CURRENT_YEAR;
  const formLevel = form.querySelector('[name="formLevel"]')?.value || '';

  let finalClass = className;
  if (formLevel && className) {
    finalClass = `${formLevel} ${className}`;
  } else if (formLevel) {
    finalClass = formLevel;
  }

  if (!fullName || fullName.length < 3) return showToast('Ralat', 'Nama tidak sah.', 'error');
  if (!/^\d{12}$/.test(icNumber)) return showToast('Ralat', 'IC perlu 12 digit.', 'error');

  if (allUsers.find(u => u.icNumber === icNumber)) {
    return showToast('IC Berulang', `IC ${icNumber} sudah wujud.`, 'error', 6000);
  }

  isSubmittingSingle[group] = true;
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const { db, fs } = window.EMindCare;
    const { addDoc, collection, serverTimestamp } = fs;
    const { birthYear, age } = getBirthInfoFromIC(icNumber);

    const data = {
      fullName,
      icNumber,
      role: group,
      formLevel: formLevel || null,
      class: finalClass || null,
      sessionYear,
      birthYear: birthYear || null,
      age: age || null,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    };

    await addDoc(collection(db, 'users'), data);
    form.reset();
    await loadUsers();
    showToast('Berjaya', `${group === 'murid' ? 'Murid' : 'Guru'} baharu didaftarkan.`, 'success');
  } catch (err) {
    console.error('Single submit error:', err);
    showToast('Gagal', err.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    isSubmittingSingle[group] = false;
  }
};

/* ═══════════════════════════════════════════════════════════════
   📊 LOAD USERS
   ═══════════════════════════════════════════════════════════════ */
async function loadUsers() {
  try {
    const { db, fs } = window.EMindCare;
    console.log('📥 Loading users from Firestore...');

    const snap = await fs.getDocs(fs.collection(db, 'users'));
    allUsers = [];
    snap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));

    allUsers.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

    console.log(`📥 Loaded ${allUsers.length} users`);

    updateCounts();
    populateFilters();
    renderMuridTable();
    renderGuruTable();
    renderKaunselorTable();

  } catch (err) {
    console.error('❌ Load users error:', err);
    showToast('Ralat', 'Gagal memuatkan data pengguna: ' + err.message, 'error', 8000);
  }
}

function updateCounts() {
  const murid = allUsers.filter(u => u.role === 'murid').length;
  const guru = allUsers.filter(u => u.role === 'guru').length;
  const kaunselor = allUsers.filter(u => u.role === 'kaunselor').length;

  const mcEl = document.getElementById('muridCount');
  const gcEl = document.getElementById('guruCount');
  const kcEl = document.getElementById('kaunselorCount');

  if (mcEl) mcEl.textContent = murid;
  if (gcEl) gcEl.textContent = guru;
  if (kcEl) kcEl.textContent = kaunselor;
}

function populateFilters() {
  const murid = allUsers.filter(u => u.role === 'murid');
  const guru = allUsers.filter(u => u.role === 'guru');

  const kelasSet = [...new Set(murid.map(u => u.class).filter(Boolean))].sort();
  const kelasSel = document.getElementById('muridFilterKelas');
  if (kelasSel) {
    kelasSel.innerHTML = '<option value="">Semua Kelas</option>' +
      kelasSet.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('');
  }

  const guruKelasSet = [...new Set(guru.map(u => u.class).filter(Boolean))].sort();
  const guruKelasSel = document.getElementById('guruFilterKelas');
  if (guruKelasSel) {
    guruKelasSel.innerHTML = '<option value="">Semua Kelas</option>' +
      guruKelasSet.map(j => `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`).join('');
  }

  const tahunSet = [...new Set(allUsers.map(u => u.sessionYear).filter(Boolean))].sort().reverse();
  const tahunOpts = '<option value="">Semua Tahun</option>' +
    tahunSet.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');

  const mtEl = document.getElementById('muridFilterTahun');
  const gtEl = document.getElementById('guruFilterTahun');
  if (mtEl) mtEl.innerHTML = tahunOpts;
  if (gtEl) gtEl.innerHTML = tahunOpts;
}

/* ═══════════════════════════════════════════════════════════════
   📋 RENDER TABLES
   ═══════════════════════════════════════════════════════════════ */
function renderMuridTable() {
  const tbody = document.getElementById('muridTableBody');
  if (!tbody) return;

  const search = document.getElementById('muridSearch')?.value.toLowerCase().trim() || '';
  const kelas = document.getElementById('muridFilterKelas')?.value || '';
  const tahun = document.getElementById('muridFilterTahun')?.value || '';

  let list = allUsers.filter(u => u.role === 'murid');
  if (search) list = list.filter(u => (u.fullName || '').toLowerCase().includes(search) || (u.icNumber || '').includes(search));
  if (kelas) list = list.filter(u => u.class === kelas);
  if (tahun) list = list.filter(u => u.sessionYear === tahun);

  const countEl = document.getElementById('muridListCount');
  if (countEl) countEl.textContent = `${list.length} daripada ${allUsers.filter(u => u.role === 'murid').length} murid`;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="fas fa-user-graduate"></i><strong>Tiada murid</strong><p>Belum ada murid berdaftar.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(u => renderUserRow(u)).join('');
}

function renderGuruTable() {
  const tbody = document.getElementById('guruTableBody');
  if (!tbody) return;

  const search = document.getElementById('guruSearch')?.value.toLowerCase().trim() || '';
  const kelas = document.getElementById('guruFilterKelas')?.value || '';
  const tahun = document.getElementById('guruFilterTahun')?.value || '';

  let list = allUsers.filter(u => u.role === 'guru');
  if (search) list = list.filter(u => (u.fullName || '').toLowerCase().includes(search) || (u.icNumber || '').includes(search));
  if (kelas) list = list.filter(u => u.class === kelas);
  if (tahun) list = list.filter(u => u.sessionYear === tahun);

  const countEl = document.getElementById('guruListCount');
  if (countEl) countEl.textContent = `${list.length} daripada ${allUsers.filter(u => u.role === 'guru').length} guru`;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="fas fa-chalkboard-teacher"></i><strong>Tiada guru</strong><p>Belum ada guru berdaftar.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(u => renderUserRow(u)).join('');
}

function renderUserRow(u) {
  const initial = (u.fullName || 'U').charAt(0).toUpperCase();
  const avatarHTML = u.profileImage ? `<img src="${u.profileImage}" alt="">` : initial;
  let age = u.age;
  if (!age && u.icNumber) age = getBirthInfoFromIC(u.icNumber).age;

  return `
    <tr>
      <td>
        <div class="user-cell">
          <div class="user-avatar">${avatarHTML}</div>
          <div class="user-info">
            <strong>${escapeHtml(u.fullName || 'Tanpa Nama')}</strong>
            <span>${escapeHtml(u.icNumber || '—')}</span>
          </div>
        </div>
      </td>
      <td>${escapeHtml(u.class || '—')}</td>
      <td>${age ? `${age} thn` : '—'}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-secondary btn-icon btn-sm" onclick="viewUser('${u.id}')" title="Lihat">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-secondary btn-icon btn-sm" onclick="editUser('${u.id}')" title="Edit">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn btn-danger btn-icon btn-sm" onclick="deleteUser('${u.id}')" title="Padam">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function renderKaunselorTable() {
  const tbody = document.getElementById('kaunselorTableBody');
  if (!tbody) return;

  const list = allUsers.filter(u => u.role === 'kaunselor');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><i class="fas fa-user-shield"></i><strong>Tiada kaunselor</strong><p>Belum ada kaunselor berdaftar.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(u => {
    const initial = (u.fullName || 'K').charAt(0).toUpperCase();
    const avatarHTML = u.profileImage ? `<img src="${u.profileImage}" alt="">` : initial;
    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-avatar">${avatarHTML}</div>
            <div class="user-info">
              <strong>${escapeHtml(u.fullName || 'Tanpa Nama')}</strong>
              <span>${escapeHtml(u.icNumber || '—')}</span>
            </div>
          </div>
        </td>
        <td>${escapeHtml(u.title || 'Kaunselor UBK')}</td>
        <td>${escapeHtml(u.email || '—')}</td>
      </tr>
    `;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   👁️ VIEW / EDIT / DELETE
   ═══════════════════════════════════════════════════════════════ */
window.viewUser = function(id) {
  const u = allUsers.find(x => x.id === id);
  if (!u) return;

  const info = u.icNumber ? getBirthInfoFromIC(u.icNumber) : {};
  const age = u.age || info.age;
  const birthYear = u.birthYear || info.birthYear;
  const isGuru = u.role === 'guru';

  const modal = document.getElementById('viewModal');
  const container = document.getElementById('viewUserInfo');
  if (!modal || !container) return;

  container.innerHTML = `
    <div class="view-row">
      <i class="fas fa-user"></i>
      <div class="view-row-content">
        <strong>Nama Penuh</strong>
        <span>${escapeHtml(u.fullName || '—')}</span>
      </div>
    </div>
    <div class="view-row">
      <i class="fas fa-id-card"></i>
      <div class="view-row-content">
        <strong>Nombor IC</strong>
        <span>${escapeHtml(u.icNumber || '—')}</span>
      </div>
    </div>
    <div class="view-row">
      <i class="fas fa-user-tag"></i>
      <div class="view-row-content">
        <strong>Peranan</strong>
        <span>${escapeHtml(capitalize(u.role || 'murid'))}</span>
      </div>
    </div>
    ${u.formLevel ? `
      <div class="view-row">
        <i class="fas fa-layer-group"></i>
        <div class="view-row-content">
          <strong>Tingkatan</strong>
          <span>Tingkatan ${escapeHtml(u.formLevel)}</span>
        </div>
      </div>
    ` : ''}
    <div class="view-row">
      <i class="fas fa-graduation-cap"></i>
      <div class="view-row-content">
        <strong>${isGuru ? 'Guru Kelas' : 'Kelas'}</strong>
        <span>${escapeHtml(u.class || '—')}</span>
      </div>
    </div>
    <div class="view-row">
      <i class="fas fa-calendar"></i>
      <div class="view-row-content">
        <strong>Tahun / Sesi</strong>
        <span>${escapeHtml(u.sessionYear || '—')}</span>
      </div>
    </div>
    ${birthYear ? `
      <div class="view-row">
        <i class="fas fa-cake-candles"></i>
        <div class="view-row-content">
          <strong>Umur</strong>
          <span>${age} tahun (lahir ${birthYear})</span>
        </div>
      </div>
    ` : ''}
  `;

  modal.classList.add('active');
};

window.closeViewModal = function() {
  document.getElementById('viewModal')?.classList.remove('active');
};

window.editUser = function(id) {
  const u = allUsers.find(x => x.id === id);
  if (!u) return;
  editingUserId = id;

  document.getElementById('editFullName').value = u.fullName || '';
  document.getElementById('editFormLevel').value = u.formLevel || '';
  document.getElementById('editClassName').value = u.class || '';
  document.getElementById('editSessionYear').value = u.sessionYear || CURRENT_YEAR;

  document.getElementById('editModal')?.classList.add('active');
};

window.closeEditModal = function() {
  document.getElementById('editModal')?.classList.remove('active');
  editingUserId = null;
};

window.saveEdit = async function() {
  if (!editingUserId) return;

  const fullName = document.getElementById('editFullName').value.trim().toUpperCase();
  const formLevel = document.getElementById('editFormLevel').value.trim().toUpperCase();
  const className = document.getElementById('editClassName').value.trim().toUpperCase();
  const sessionYear = document.getElementById('editSessionYear').value.trim() || CURRENT_YEAR;

  if (!fullName || fullName.length < 3) return showToast('Ralat', 'Nama tidak sah.', 'error');

  const btn = document.getElementById('editSaveBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const { db, fs } = window.EMindCare;
    await fs.updateDoc(fs.doc(db, 'users', editingUserId), {
      fullName,
      formLevel: formLevel || null,
      class: className || null,
      sessionYear,
      updatedAt: fs.serverTimestamp()
    });

    const u = allUsers.find(x => x.id === editingUserId);
    if (u) {
      u.fullName = fullName;
      u.formLevel = formLevel || null;
      u.class = className || null;
      u.sessionYear = sessionYear;
    }

    closeEditModal();
    renderMuridTable();
    renderGuruTable();
    showToast('Berjaya', 'Pengguna dikemas kini.', 'success');
  } catch (err) {
    showToast('Gagal', err.message, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
};

window.deleteUser = function(id) {
  const u = allUsers.find(x => x.id === id);
  if (!u) return;

  showConfirmModal({
    title: 'Padam Pengguna?',
    desc: `Padam akaun "${u.fullName}" (${u.icNumber})?`,
    confirmText: 'Ya, Padam',
    onConfirm: async () => {
      try {
        const { db, fs } = window.EMindCare;
        await fs.deleteDoc(fs.doc(db, 'users', id));
        allUsers = allUsers.filter(x => x.id !== id);
        updateCounts();
        renderMuridTable();
        renderGuruTable();
        renderKaunselorTable();
        showToast('Berjaya', 'Pengguna dipadam.', 'success');
      } catch (err) {
        showToast('Gagal', err.message, 'error');
      }
    }
  });
};

/* ═══════════════════════════════════════════════════════════════
   ✅ CONFIRM MODAL
   ═══════════════════════════════════════════════════════════════ */
function showConfirmModal({ title, desc, confirmText, onConfirm }) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmDesc').textContent = desc;
  document.getElementById('confirmBtn').innerHTML = `<i class="fas fa-check"></i> ${confirmText || 'Ya, Teruskan'}`;
  pendingConfirmAction = onConfirm;
  document.getElementById('confirmModal')?.classList.add('active');
}

window.closeConfirmModal = function() {
  document.getElementById('confirmModal')?.classList.remove('active');
  pendingConfirmAction = null;
};

/* ═══════════════════════════════════════════════════════════════
   🧭 SIDEBAR + LOGOUT
   ═══════════════════════════════════════════════════════════════ */
window.toggleSidebar = function() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sbBackdrop')?.classList.toggle('active');
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

window.refreshAll = function() {
  showToast('Memuat semula', 'Mengambil data terkini...', 'info', 2000);
  loadUsers();
};

/* ═══════════════════════════════════════════════════════════════
   🔔 TOAST
   ═══════════════════════════════════════════════════════════════ */
function showToast(title, message, type = 'success', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

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

console.log(
  "%c 👥 Dashboard User v5 ",
  "background:linear-gradient(135deg,#0F766E,#4F46E5,#06B6D4);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("Guru Kelas (NO Jawatan Tambahan) · Ready");
