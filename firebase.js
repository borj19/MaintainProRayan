// ═══════════════════════════════════════════════
// firebase.js — Firebase Authentication + Firestore
// MaintainPro — Production
// ═══════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAU5pYiisi4gUdcdN0jG7sA5KQ7Ud35M38",
  authDomain:        "maintainpro-87ed1.firebaseapp.com",
  projectId:         "maintainpro-87ed1",
  storageBucket:     "maintainpro-87ed1.firebasestorage.app",
  messagingSenderId: "698895099207",
  appId:             "1:698895099207:web:6218d86624dc33425cd862",
};

let fbApp  = null;
let fbAuth = null;
let fbDb   = null;
let FB_READY = false;

function initFirebase() {
  try {
    fbApp  = firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb   = firebase.firestore();

    // ── Persist login across refreshes and devices ──
    fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    FB_READY = true;
    console.log('✅ Firebase connected — maintainpro-87ed1');

    // ── Real-time jobs listener ──────────────────
    fbDb.collection('jobs')
      .orderBy('date','desc')
      .onSnapshot(snap => {
        DATA = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        nid  = DATA.length + 1;
        if (typeof fillDrops        === 'function') fillDrops();
        if (typeof updateNavPills   === 'function') updateNavPills();
        if (typeof renderActivePage === 'function') renderActivePage();
        if (typeof refreshRoomsIfVisible === 'function') refreshRoomsIfVisible();
      }, err => console.warn('Firestore jobs error:', err.message));

    // ── Auth state listener ──────────────────────
    // Runs on every page load — restores session automatically
    // Works across all devices and browsers
    fbAuth.onAuthStateChanged(async fbUser => {
      if (fbUser) {
        try {
          const snap = await fbDb.collection('users').doc(fbUser.uid).get();
          if (snap.exists) {
            currentUser = { uid: fbUser.uid, email: fbUser.email, ...snap.data() };
            const authEl = document.getElementById('auth-screen');
            if (authEl) authEl.style.display = 'none';
            if (typeof applyUserSession === 'function') applyUserSession();
            if (typeof init === 'function' && !window._appStarted) {
              window._appStarted = true;
              init();
            }
          } else {
            // Auth user exists but no Firestore profile — show login
            showAuthScreen();
          }
        } catch(e) {
          console.warn('Session restore failed:', e.message);
          showAuthScreen();
        }
      } else {
        // No Firebase user logged in — show login screen
        if (!window._appStarted) showAuthScreen();
      }
    });

  } catch(err) {
    console.error('Firebase init failed:', err.message);
    FB_READY = false;
    showAuthScreen();
  }
}

function showAuthScreen() {
  const a = document.getElementById('auth-screen');
  if (a) a.style.display = 'flex';
}

// ── Add job to Firestore ─────────────────────
async function fbAddJob(job) {
  if (!FB_READY) { DATA.unshift(job); return; }
  try {
    const { id, ...jobData } = job;
    await fbDb.collection('jobs').add({
      ...jobData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch(e) {
    console.error('fbAddJob failed:', e.message);
    if (typeof toast === 'function') toast('Failed to save job.', 'e');
    DATA.unshift(job);
  }
}

// ── Update job in Firestore ──────────────────
async function fbUpdateJob(id, updates) {
  if (!FB_READY) {
    const i = DATA.findIndex(r => String(r.id) === String(id));
    if (i >= 0) DATA[i] = { ...DATA[i], ...updates };
    return;
  }
  try {
    await fbDb.collection('jobs').doc(String(id)).update(updates);
  } catch(e) {
    console.error('fbUpdateJob failed:', e.message);
    if (typeof toast === 'function') toast('Failed to update job.', 'e');
  }
}

// ── Delete job from Firestore ────────────────
async function fbDeleteJob(id) {
  if (!FB_READY) { DATA = DATA.filter(r => String(r.id) !== String(id)); return; }
  try {
    await fbDb.collection('jobs').doc(String(id)).delete();
  } catch(e) {
    console.error('fbDeleteJob failed:', e.message);
    if (typeof toast === 'function') toast('Failed to delete job.', 'e');
  }
}

// ── Re-render current active page ───────────
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
  if (p === 'rooms' && typeof renderRoomsBoard === 'function') renderRoomsBoard();
}

// ── Start Firebase ───────────────────────────
initFirebase();
