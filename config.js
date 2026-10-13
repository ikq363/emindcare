/* ═══════════════════════════════════════════════════════════════
   e-MindCare · Firebase SDK v10 + Cloudinary Setup
   Unit Bimbingan & Kaunseling SMK Syed Sirajuddin (SEMSIRA)
   ═══════════════════════════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ═══════════════════════════════════════════════════════════════
   FIREBASE CONFIGURATION — eMindCare v2
   ═══════════════════════════════════════════════════════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyAkTjkh2jIxYTu4-rq3ZIH3euz5twHeVLQ",
  authDomain: "emindcarev2.firebaseapp.com",
  projectId: "emindcarev2",
  storageBucket: "emindcarev2.firebasestorage.app",
  messagingSenderId: "763227967971",
  appId: "1:763227967971:web:29d828e90bc4d3550bd0d6",
  measurementId: "G-7YS1XTQ9CY"
};

/* ═══════════════════════════════════════════════════════════════
   CLOUDINARY CONFIGURATION — emindcarev2
   ═══════════════════════════════════════════════════════════════ */
const CLOUDINARY_CONFIG = {
  cloudName: "tt0ofn22",
  uploadPreset: "emindcarev2",
  folder: "emindcare",
  // URL builder untuk pelbagai jenis media
  imageUrl: (publicId, opts = "") =>
    `https://res.cloudinary.com/tt0ofn22/image/upload/${opts}${publicId}`,
  videoUrl: (publicId, opts = "") =>
    `https://res.cloudinary.com/tt0ofn22/video/upload/${opts}${publicId}`
};

/* ═══════════════════════════════════════════════════════════════
   INITIALIZE FIREBASE
   ═══════════════════════════════════════════════════════════════ */
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
const auth = getAuth(app);
const db = getFirestore(app);

/* ═══════════════════════════════════════════════════════════════
   CLOUDINARY UPLOAD HELPER
   ═══════════════════════════════════════════════════════════════ */
async function uploadToCloudinary(file, options = {}) {
  const {
    resourceType = "auto",       // "image" | "video" | "auto"
    folder = CLOUDINARY_CONFIG.folder,
    tags = [],
    publicId = null
  } = options;

  // Tentukan resourceType jika auto
  let type = resourceType;
  if (type === "auto") {
    if (file.type.startsWith("video/")) type = "video";
    else if (file.type.startsWith("image/")) type = "image";
    else type = "raw";
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${type}/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  if (folder) formData.append("folder", folder);
  if (tags.length) formData.append("tags", tags.join(","));
  if (publicId) formData.append("public_id", publicId);

  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Upload Cloudinary gagal");
  }
  const data = await res.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    format: data.format,
    resourceType: data.resource_type,
    width: data.width,
    height: data.height,
    duration: data.duration,
    bytes: data.bytes,
    createdAt: data.created_at
  };
}

/* ═══════════════════════════════════════════════════════════════
   FIRESTORE HELPERS
   ═══════════════════════════════════════════════════════════════ */

// Ambil siteConfig utama
async function getSiteConfig() {
  try {
    const snap = await getDoc(doc(db, "siteConfig", "main"));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("[siteConfig] error:", e.message);
    return null;
  }
}

// Ambil sebarang collection dengan sorting client-side
async function getCollection(name, orderField = "order") {
  try {
    const snap = await getDocs(collection(db, name));
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (a[orderField] ?? 999) - (b[orderField] ?? 999));
    return items;
  } catch (e) {
    console.warn(`[${name}] error:`, e.message);
    return [];
  }
}

// Ambil collection dengan query where
async function getCollectionWhere(name, field, value, orderField = "order") {
  try {
    const q = query(collection(db, name), where(field, "==", value));
    const snap = await getDocs(q);
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (a[orderField] ?? 999) - (b[orderField] ?? 999));
    return items;
  } catch (e) {
    console.warn(`[${name}] error:`, e.message);
    return [];
  }
}

// Ambil pengumuman aktif
async function getActiveAnnouncements() {
  try {
    const q = query(collection(db, "announcements"), where("active", "==", true));
    const snap = await getDocs(q);
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => {
      const at = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bt = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return bt - at;
    });
    return items;
  } catch (e) {
    console.warn("[announcements] error:", e.message);
    return [];
  }
}

// Real-time listener untuk siteConfig
function watchSiteConfig(callback) {
  return onSnapshot(doc(db, "siteConfig", "main"), snap => {
    callback(snap.exists() ? snap.data() : null);
  });
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT TO WINDOW — supaya boleh akses dari index.html
   ═══════════════════════════════════════════════════════════════ */
window.EMindCare = {
  // Core
  app, auth, db, analytics,

  // Cloudinary
  CLOUDINARY_CONFIG,
  uploadToCloudinary,

  // Firestore Helpers
  getSiteConfig,
  getCollection,
  getCollectionWhere,
  getActiveAnnouncements,
  watchSiteConfig,

  // Firestore raw functions (untuk dashboard kaunselor)
  fs: {
    doc, getDoc, setDoc, updateDoc,
    collection, getDocs, query, where, orderBy, limit,
    addDoc, deleteDoc, serverTimestamp, onSnapshot
  },

  // Auth functions
  auth_fns: { onAuthStateChanged, signOut }
};

console.log(
  "%c e-MindCare ",
  "background:linear-gradient(135deg,#0F766E,#4F46E5);color:#fff;font-weight:900;padding:6px 14px;border-radius:6px;font-size:13px;"
);
console.log("🧠 Firebase SDK + Cloudinary ready (eMindCare v2)");