// ═══════════════════════════════════════════════
// firebase.js — Firebase Integration
// MaintainPro v5 — Production
// ═══════════════════════════════════════════════

// ── YOUR FIREBASE CONFIG ─────────────────────
// Paste your values from Firebase Console →
// Project Settings → Your apps → Web app
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

// ── Firebase state (used by script.js) ───────
let fbApp  = null;
let fbAuth = null;
let fbDb   = null;
let FB_READY = false;

// ── Initialise Firebase ───────────────────────
// Called at the bottom of this file automatically.
function initFirebase() {
  if (FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
    console.info("ℹ️ Demo mode — add your Firebase config to firebase.js");
    return;
  }
  try {
    fbApp  = firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb   = firebase.firestore();

    // Persist login across page refreshes
    fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    FB_READY = true;
    console.log("✅ Firebase connected");

    // ── Real-time Firestore listener ──────────
    // Replaces the 60-second polling interval.
    // Every time any job changes in Firestore,
    // DATA is updated and the current page re-renders.
    fbDb.collection("jobs")
      .orderBy("date", "desc")
      .onSnapshot(snapshot => {
        DATA = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        nid = DATA.length + 1; // keep local id counter in sync
        fillDrops();
        updateNavPills();
        renderActivePage();
      }, err => {
        console.warn("Firestore listener error:", err.message);
      });

    // ── Auth state listener ───────────────────
    // Restores session automatically on page refresh.
    // No more sessionStorage needed for auth.
    fbAuth.onAuthStateChanged(async fbUser => {
      if (fbUser && !currentUser) {
        // User is already logged in from a previous session
        try {
          const doc = await fbDb.collection("users").doc(fbUser.uid).get();
          if (doc.exists) {
            currentUser = { uid: fbUser.uid, ...doc.data() };
            const authEl = document.getElementById('auth-screen');
            if (authEl) authEl.style.display='none';
            applyUserSession();
            init();
          }
        } catch(e) {
          console.warn("Could not restore session:", e.message);
        }
      }
    });

  } catch(err) {
    console.warn("Firebase init failed:", err.message);
    FB_READY = false;
  }
}

// ── Firestore: Add a job ──────────────────────
async function fbAddJob(job) {
  if (!FB_READY) {
    DATA.unshift(job);
    return;
  }
  try {
    // Remove local numeric id — Firestore generates its own
    const { id, ...jobData } = job;
    await fbDb.collection("jobs").add({
      ...jobData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // No need to update DATA manually — the onSnapshot listener does it
  } catch(e) {
    console.error("fbAddJob error:", e.message);
    toast("Failed to save job. Check your connection.", "e");
    DATA.unshift(job); // fallback: at least show it locally
  }
}

// ── Firestore: Update a job ───────────────────
async function fbUpdateJob(id, updates) {
  if (!FB_READY) {
    const i = DATA.findIndex(r => r.id === id);
    if (i >= 0) DATA[i] = { ...DATA[i], ...updates };
    return;
  }
  try {
    await fbDb.collection("jobs").doc(String(id)).update(updates);
  } catch(e) {
    console.error("fbUpdateJob error:", e.message);
    toast("Failed to update job.", "e");
  }
}

// ── Firestore: Delete a job ───────────────────
async function fbDeleteJob(id) {
  if (!FB_READY) {
    DATA = DATA.filter(r => r.id !== id);
    return;
  }
  try {
    await fbDb.collection("jobs").doc(String(id)).delete();
  } catch(e) {
    console.error("fbDeleteJob error:", e.message);
    toast("Failed to delete job.", "e");
  }
}

// ── Re-render whichever page is active ───────
function renderActivePage() {
  const active = document.querySelector('.page.on');
  if (!active) return;
  const p = active.id.replace('page-', '');
  if (p === 'dash')       rDash();
  if (p === 'tasks')      { bTKpis(); af(); }
  if (p === 'inprogress') renderInProgress();
  if (p === 'contractor') renderContractorPanel();
  if (p === 'request')    renderRequestPage();
  if (p === 'reports')    renderR();
}

// ── Run immediately ───────────────────────────
initFirebase();