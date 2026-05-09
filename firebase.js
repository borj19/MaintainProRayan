// ═══════════════════════════════════════════════
// firebase.js — Firebase Integration
// MaintainPro — Production
// ═══════════════════════════════════════════════

// ── Firebase config ───────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAU5pYiisi4gUdcdN0jG7sA5KQ7Ud35M38",
  authDomain:        "maintainpro-87ed1.firebaseapp.com",
  projectId:         "maintainpro-87ed1",
  storageBucket:     "maintainpro-87ed1.firebasestorage.app",
  messagingSenderId: "698895099207",
  appId:             "1:698895099207:web:6218d86624dc33425cd862",
};

// ── Firebase state (used across all JS files) ─
let fbApp  = null;
let fbAuth = null;
let fbDb   = null;
let FB_READY = false;

// ── Initialise Firebase ───────────────────────
function initFirebase() {
  try {
    fbApp  = firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb   = firebase.firestore();

    // Keep user logged in across page refreshes
    fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    FB_READY = true;
    console.log("✅ Firebase connected — maintainpro-87ed1");

    // ── Real-time jobs listener ───────────────
    fbDb.collection("jobs")
      .orderBy("date", "desc")
      .onSnapshot(snapshot => {
        DATA = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        nid = DATA.length + 1;
        if (typeof fillDrops        === "function") fillDrops();
        if (typeof updateNavPills   === "function") updateNavPills();
        if (typeof renderActivePage === "function") renderActivePage();
      }, err => {
        console.warn("Firestore listener error:", err.message);
      });

    // ── Auth state listener ───────────────────
    fbAuth.onAuthStateChanged(async fbUser => {
      if (fbUser && !currentUser) {
        try {
          const snap = await fbDb.collection("users").doc(fbUser.uid).get();
          if (snap.exists) {
            currentUser = { uid: fbUser.uid, ...snap.data() };
            const authEl = document.getElementById("auth-screen");
            if (authEl) authEl.classList.add("hidden");
            if (typeof applyUserSession === "function") applyUserSession();
            if (typeof init             === "function") init();
          } else {
            const authEl = document.getElementById("auth-screen");
            if (authEl) authEl.classList.remove("hidden");
          }
        } catch(e) {
          console.warn("Session restore failed:", e.message);
        }
      }
    });

  } catch(err) {
    console.error("Firebase init failed:", err.message);
    FB_READY = false;
  }
}

// ── Add a job to Firestore ────────────────────
async function fbAddJob(job) {
  if (!FB_READY) { DATA.unshift(job); return; }
  try {
    const { id, ...jobData } = job;
    await fbDb.collection("jobs").add({
      ...jobData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch(e) {
    console.error("fbAddJob failed:", e.message);
    if (typeof toast === "function") toast("Failed to save job — check connection.", "e");
    DATA.unshift(job);
  }
}

// ── Update a job in Firestore ─────────────────
async function fbUpdateJob(id, updates) {
  if (!FB_READY) {
    const i = DATA.findIndex(r => r.id === id);
    if (i >= 0) DATA[i] = { ...DATA[i], ...updates };
    return;
  }
  try {
    await fbDb.collection("jobs").doc(String(id)).update(updates);
  } catch(e) {
    console.error("fbUpdateJob failed:", e.message);
    if (typeof toast === "function") toast("Failed to update job.", "e");
  }
}

// ── Delete a job from Firestore ───────────────
async function fbDeleteJob(id) {
  if (!FB_READY) { DATA = DATA.filter(r => r.id !== id); return; }
  try {
    await fbDb.collection("jobs").doc(String(id)).delete();
  } catch(e) {
    console.error("fbDeleteJob failed:", e.message);
    if (typeof toast === "function") toast("Failed to delete job.", "e");
  }
}

// ── Re-render the currently visible page ──────
function renderActivePage() {
  const active = document.querySelector(".page.on");
  if (!active) return;
  const p = active.id.replace("page-", "");
  if (p === "dash")       rDash();
  if (p === "tasks")      { bTKpis(); af(); }
  if (p === "inprogress") renderInProgress();
  if (p === "contractor") renderContractorPanel();
  if (p === "request")    renderRequestPage();
  if (p === "reports")    renderR();
}

// ── Start Firebase immediately ────────────────
initFirebase();
