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

    // Listeners (jobs + users) start AFTER login to avoid permission errors
    let _jobsUnsub = null;
    let _usersUnsub = null;

    function startListeners() {
      if (_jobsUnsub || _usersUnsub) return; // already started

      // Real-time jobs listener
      _jobsUnsub = fbDb.collection('jobs')
        .orderBy('date','desc')
        .onSnapshot(snap => {
          DATA = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          nid = DATA.length + 1;
          if (typeof fillDrops        === 'function') fillDrops();
          if (typeof updateNavPills   === 'function') updateNavPills();
          if (typeof renderActivePage === 'function') renderActivePage();
          if (typeof refreshRoomsIfVisible === 'function') refreshRoomsIfVisible();
        }, err => console.warn('Firestore jobs error:', err.message));

      // Real-time users listener
      _usersUnsub = fbDb.collection('users').onSnapshot(snap => {
        USERS = snap.docs.map(d => ({ id: d.id, firestoreId: d.id, ...d.data() }));
        if (typeof fillDrops === 'function') fillDrops();
        const userPage = document.getElementById('page-users');
        if (userPage && userPage.classList.contains('on')
            && typeof renderUserPage === 'function') {
          renderUserPage();
        }
      }, err => console.warn('Firestore users error:', err.message));
    }

    function stopListeners() {
      if (_jobsUnsub)  { _jobsUnsub();  _jobsUnsub  = null; }
      if (_usersUnsub) { _usersUnsub(); _usersUnsub = null; }
    }
    window.startFbListeners = startListeners;
    window.stopFbListeners  = stopListeners;

    // ── Auth state listener ──────────────────────
    fbAuth.onAuthStateChanged(async fbUser => {
      if (fbUser) {
        try {
          startListeners();
          // Load field data (SUBTYPES, HNDS, AREAS) before init
          await fbLoadFields();
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
            // Init push notifications after login
            setTimeout(() => { if (typeof initFCM === 'function') initFCM(); }, 1500);
          } else {
            showAuthScreen();
          }
        } catch(e) {
          console.warn('Session restore failed:', e.message);
          showAuthScreen();
        }
      } else {
        stopListeners();
        showAuthScreen();
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

// ── Load field data from Firestore ──────────
async function fbLoadFields() {
  if (!FB_READY) return;
  try {
    const snap = await fbDb.collection('settings').doc('fields').get();
    if (snap.exists) {
      const data = snap.data();
      if (data.SUBTYPES) SUBTYPES = data.SUBTYPES;
      if (data.HNDS)     HNDS     = data.HNDS;
      if (data.AREAS)    AREAS    = data.AREAS;
      console.log('✅ Fields loaded from Firestore');
    }
  } catch(e) {
    console.warn('fbLoadFields failed:', e.message);
  }
}

// ── Save field data to Firestore ─────────────
async function fbSaveFields() {
  if (!FB_READY) return;
  console.log('💾 Saving fields to Firestore...', { SUBTYPES, HNDS, AREAS });
  try {
    await fbDb.collection('settings').doc('fields').set(
      { SUBTYPES, HNDS, AREAS },
      { merge: true }
    );
    console.log('✅ Fields saved successfully');
  } catch(e) {
    console.warn('fbSaveFields failed:', e.message);
    if (typeof toast === 'function') toast('Failed to save field changes.', 'e');
    throw e; // re-throw so callers can catch and show error toast
  }
}

// ── Add job to Firestore ─────────────────────
async function fbAddJob(job) {
  if (!FB_READY) { DATA.unshift(job); return; }
  try {
    const { id, ...jobData } = job;
    const docRef = await fbDb.collection('jobs').add({
      ...jobData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    const localJob = DATA.find(r => String(r.id) === String(id));
    if (localJob) localJob.id = docRef.id;
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
// Skip re-render on pages with active form input to preserve user's typing
function renderActivePage() {
  const active = document.querySelector('.page.on');
  if (!active) return;
  const p = active.id.replace('page-', '');

  // Pages with forms: only re-render if user is NOT typing
  const formPages = ['add', 'request'];
  if (formPages.includes(p)) {
    const focused = document.activeElement;
    const isTyping = focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.tagName === 'SELECT');
    if (isTyping) return; // skip — user is filling the form
    // Check if any field on this page has user-entered content
    const formInputs = active.querySelectorAll('input, textarea');
    const hasContent = Array.from(formInputs).some(el => el.value && el.value.trim() !== '' && el.type !== 'date' && el.type !== 'hidden');
    if (hasContent) return; // skip — preserve partially filled form
  }
  // Also skip if any modal is open (editing/viewing)
  const openModal = document.querySelector('.modal.show, .modal[style*="display: flex"], .modal[style*="display:flex"]');
  if (openModal) return;

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

// ═══════════════════════════════════════════════
// FCM — Push Notifications
// ═══════════════════════════════════════════════
const FCM_VAPID_KEY = 'BIZCBRzkWKJhgFtU7NitJEPUBNx0lsWmqsl73kGIuCvmk8e-W3iYmjUPyhEpOFi8Qz4wZCrPu8zBD1kDufbWZ88';
let fbMessaging = null;

async function initFCM() {
  if (!FB_READY || !currentUser) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('Push notifications not supported in this browser.');
    return;
  }
  try {
    fbMessaging = firebase.messaging();
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ Service worker registered');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { console.warn('🔕 Notification permission denied'); return; }
    const token = await fbMessaging.getToken({ vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: swReg });
    if (token) { console.log('✅ FCM token obtained'); await saveFCMToken(token); }
    fbMessaging.onMessage(payload => {
      console.log('[FCM] Foreground message:', payload);
      const { title, body } = payload.notification || {};
      if (typeof toast === 'function') toast(`🔔 ${title}: ${body}`, 'i');
    });
  } catch (e) {
    console.warn('FCM init failed:', e.message);
  }
}
window.initFCM = initFCM;

async function saveFCMToken(token) {
  if (!FB_READY || !currentUser) return;
  try {
    const uid = currentUser.uid || currentUser.id;
    await fbDb.collection('users').doc(String(uid)).update({
      fcmTokens: firebase.firestore.FieldValue.arrayUnion(token),
      fcmUpdatedAt: getTODAY ? getTODAY() : new Date().toISOString().slice(0,10),
    });
    console.log('✅ FCM token saved');
  } catch (e) { console.warn('saveFCMToken failed:', e.message); }
}

async function notifyUser(targetName, title, body, jobId) {
  if (!FB_READY) return;
  try {
    const target = (typeof USERS !== 'undefined' ? USERS : []).find(u => u.name === targetName);
    if (!target) return;
    const targetUid = target.uid || target.firestoreId || target.id;
    if (!targetUid) return;
    await fbDb.collection('notifications').add({
      toUid: String(targetUid), toName: targetName,
      title, body, jobId: String(jobId || ''),
      sentAt: firebase.firestore.FieldValue.serverTimestamp(),
      sentBy: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'System',
      read: false,
    });
    console.log(`✅ Notification queued for ${targetName}`);
  } catch (e) { console.warn('notifyUser failed:', e.message); }
}
window.notifyUser = notifyUser;

async function notifyByUid(targetUid, title, body, jobId) {
  if (!FB_READY || !targetUid) return;
  try {
    await fbDb.collection('notifications').add({
      toUid: String(targetUid), title, body, jobId: String(jobId || ''),
      sentAt: firebase.firestore.FieldValue.serverTimestamp(),
      sentBy: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'System',
      read: false,
    });
    console.log(`✅ Notification queued for UID: ${targetUid}`);
  } catch (e) { console.warn('notifyByUid failed:', e.message); }
}
window.notifyByUid = notifyByUid;
