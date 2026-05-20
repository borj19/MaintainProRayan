// ═══════════════════════════════════════════════
// script.js — Core application
// Depends on: firebase.js, dashboard.js, reports.js
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════
let darkMode = false;
function toggleTheme(){
  darkMode=!darkMode;
  document.documentElement.setAttribute('data-theme',darkMode?'dark':'light');
  const lbl=document.getElementById('theme-lbl');
  if(lbl)lbl.textContent=darkMode?'Dark':'Light';
  // Re-render charts with new colours if visible
  if(document.getElementById('page-dash').classList.contains('on'))rDash();
  if(document.getElementById('page-reports').classList.contains('on'))renderR();
  // Persist user's theme choice across sessions
  try{ localStorage.setItem('mp_theme',darkMode?'dark':'light'); }catch(e){}
}

// Load saved theme on startup — defaults to light if nothing saved
(function loadSavedTheme(){
  try{
    const saved=localStorage.getItem('mp_theme');
    if(saved){
      darkMode=(saved==='dark');
      document.documentElement.setAttribute('data-theme',saved);
    } else {
      darkMode=false; // default light
      document.documentElement.setAttribute('data-theme','light');
    }
  }catch(e){}
})();

// ═══════════════════════════════════════════════
// LOADING SCREEN
// ═══════════════════════════════════════════════
let _lsShownAt=0;
function showLoadingScreen(){
  const ls=document.getElementById('loading-screen');
  if(ls){ls.classList.remove('hidden','fade-out');ls.style.display='flex';}
  _lsShownAt=Date.now();
  // Rotate loading messages for a premium feel
  const msgs=['Initializing workspace','Connecting to database','Loading your data','Almost there'];
  const msgEl=document.getElementById('ls-msg');
  if(msgEl){
    let i=0;msgEl.textContent=msgs[0];
    if(window._lsMsgTimer) clearInterval(window._lsMsgTimer);
    window._lsMsgTimer=setInterval(()=>{
      i=(i+1)%msgs.length;
      msgEl.style.opacity='0';
      setTimeout(()=>{msgEl.textContent=msgs[i];msgEl.style.opacity='1';},180);
    },1400);
  }
  if(window._loadingTimeout) clearTimeout(window._loadingTimeout);
  window._loadingTimeout=setTimeout(()=>hideLoadingScreen(),8000);
}
function hideLoadingScreen(){
  if(window._loadingTimeout){clearTimeout(window._loadingTimeout);window._loadingTimeout=null;}
  if(window._lsMsgTimer){clearInterval(window._lsMsgTimer);window._lsMsgTimer=null;}
  const ls=document.getElementById('loading-screen');
  if(!ls)return;
  ls.classList.add('fade-out');
  setTimeout(()=>{ls.classList.add('hidden');ls.style.display='none';},500);
}
// Hide on page load — only show after login
(function(){
  const ls=document.getElementById('loading-screen');
  if(ls){ls.style.display='none';ls.classList.add('hidden');}
})();

// ═══════════════════════════════════════════════
// ROLE-BASED ACCESS CONTROL — FULL SYSTEM
// ═══════════════════════════════════════════════

// ── Permission keys ──────────────────────────
// Each key maps to a UI capability. Admin can
// toggle any of these per role via the Permissions
// page. Defaults are sensible for a hotel property.
const ALL_PERMS = {
  view_dashboard:      'View dashboard & analytics',
  view_all_tasks:      'View all tasks',
  add_task:            'Add / create new tasks',
  edit_task:           'Edit existing tasks',
  delete_task:         'Delete tasks',
  view_inprogress:     'View in-progress board',
  update_task_status:  'Update task status',
  view_own_tasks:      'View own submitted jobs',
  submit_request:      'Submit job requests',
  view_reports:        'View reports & analytics',
  export_data:         'Export CSV / reports',
  send_email:          'Send email reports',
  manage_users:        'Manage users (create/edit/delete)',
  view_audit_log:      'View audit log (admin-only)',
  manage_permissions:  'Manage role permissions',
  manage_fields:       'Manage field lists (work types etc.)',
  view_online_users:   'View online / active users',
};

// ── Default permissions per role ─────────────
let ROLE_PERMS = {
  admin: Object.fromEntries(Object.keys(ALL_PERMS).map(k=>[k,true])),
  staff: {
    view_dashboard:true, view_all_tasks:true, add_task:true,
    edit_task:true, delete_task:false, view_inprogress:true,
    update_task_status:true, view_own_tasks:true, submit_request:true,
    view_reports:false, export_data:true, send_email:false,
    manage_users:false, manage_permissions:false, manage_fields:false,
    view_online_users:false,
  },
  contractor: {
    view_dashboard:false, view_all_tasks:false, add_task:false,
    edit_task:false, delete_task:false, view_inprogress:true,
    update_task_status:true, view_own_tasks:true, submit_request:false,
    view_reports:false, export_data:false, send_email:false,
    manage_users:false, manage_permissions:false, manage_fields:false,
    view_online_users:false,
  },
  requester: {
    view_dashboard:false, view_all_tasks:false, add_task:false,
    edit_task:false, delete_task:false, view_inprogress:false,
    update_task_status:false, view_own_tasks:true, submit_request:true,
    view_reports:false, export_data:false, send_email:false,
    manage_users:false, manage_permissions:false, manage_fields:false,
    view_online_users:false,
  },
};

// ── User database ─────────────────────────────
// User accounts are managed entirely via Firebase Auth + Firestore
// Local USERS array is populated from Firestore on login
let USERS = [];
let nextUserId = 1;
let currentUser = null;
let regSelectedRole = 'staff';

const ROLE_LABELS  = {admin:'Administrator',staff:'Maintenance Staff',contractor:'Contractor',requester:'Requestor'};
const ROLE_COLORS  = {admin:'#e8534a',staff:'#5599f5',contractor:'#f0a62e',requester:'#2dcfb3'};
const ROLE_ICONS   = {
  admin:      '<svg viewBox="0 0 14 14" fill="none"><path d="M7 1l1.2 2.4L11 4l-2 1.9.5 2.8L7 7.5 4.5 8.7l.5-2.8L3 4l2.8-.6L7 1z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  staff:      '<svg viewBox="0 0 14 14" fill="none"><circle cx="7" cy="4.5" r="2.5" stroke="currentColor" stroke-width="1.2"/><path d="M2 12c0-2.76 2.24-4 5-4s5 1.24 5 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  contractor: '<svg viewBox="0 0 14 14" fill="none"><rect x="2" y="6" width="10" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M5 6V4a2 2 0 014 0v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  requester:  '<svg viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M5 7h4M7 5v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
};

// ── Check if current user has a permission ────
function can(perm){
  if(!currentUser) return false;
  if(currentUser.role==='admin') return true;  // admin always has everything
  return !!(ROLE_PERMS[currentUser.role]||{})[perm];
}

// ── Page → required permission map ───────────
const PAGE_PERM = {
  dash:        'view_dashboard',
  tasks:       'view_all_tasks',
  add:         'add_task',
  inprogress:  'view_inprogress',
  contractor:  'view_inprogress',
  request:     'submit_request',
  reports:     'view_reports',
  email:       'send_email',
  users:       'manage_users',
  audit:       'view_audit_log',
  permissions: 'manage_permissions',
  admin:       'manage_fields',
  rooms:       'view_all_tasks',
};

function switchAuthTab(tab){
  document.getElementById('atab-login').classList.toggle('on',tab==='login');
  document.getElementById('atab-register').classList.toggle('on',tab==='register');
  document.getElementById('auth-login-form').style.display=tab==='login'?'':'none';
  document.getElementById('auth-register-form').style.display=tab==='register'?'':'none';
  ['login-err','reg-err','reg-ok'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.remove('show');});
}

function selectRole(role){
  regSelectedRole=role;
  ['staff','contractor','requester'].forEach(r=>{
    const el=document.getElementById('rc-'+r);
    if(el) el.classList.toggle('selected',r===role);
  });
}

async function doLogin(){
  const email = document.getElementById('l-user').value.trim();
  const pass  = document.getElementById('l-pass').value;
  const errEl = document.getElementById('login-err');
  errEl.classList.remove('show');
  if(!email||!pass){errEl.textContent='Please enter your email and password.';errEl.classList.add('show');return;}

  const btn = document.querySelector('#auth-login-form .auth-btn');
  if(btn){btn.textContent='Signing in…';btn.disabled=true;}

  if(FB_READY){
    // ── Firebase Auth login (works on all devices) ──
    try{
      const cred = await fbAuth.signInWithEmailAndPassword(email, pass);
      // Show app body once authenticated
      const bodyEl=document.getElementById('body');
      if(bodyEl)bodyEl.style.visibility='visible';
      const tbEl=document.getElementById('topbar');
      if(tbEl)tbEl.style.visibility='visible';
      const sbEl=document.getElementById('sidebar');
      if(sbEl)sbEl.style.visibility='visible';
      // Check if account is disabled (soft-deleted)
      try{
        const profSnap = await fbDb.collection('users').doc(cred.user.uid).get();
        if(profSnap.exists && profSnap.data().disabled===true){
          await fbAuth.signOut();
          errEl.textContent = 'This account has been disabled. Please contact your administrator.';
          errEl.classList.add('show');
          if(btn){btn.textContent='Sign in';btn.disabled=false;}
          return;
        }
      }catch(_){}
      try{ if(typeof logAudit==='function') logAudit('auth.login', 'User signed in', 'info', 'auth', currentUser?.uid); }catch(_){}
      document.getElementById('auth-screen').style.display='none';
      showLoadingScreen();
    } catch(e){
      errEl.textContent = e.code==='auth/user-not-found'||e.code==='auth/wrong-password'||e.code==='auth/invalid-credential'
        ? 'Incorrect email or password. Please try again.'
        : 'Login failed: '+e.message;
      errEl.classList.add('show');
      document.getElementById('l-pass').value='';
      document.getElementById('l-pass').focus();
    }
  } else {
    // ── Demo fallback (no Firebase) ──
    const user=USERS.find(x=>(x.email===email||x.username===email)&&x.password===pass);
    if(user){
      currentUser=user;
      document.getElementById('auth-screen').style.display='none';
      showLoadingScreen();
      setTimeout(()=>{
        applyUserSession();
        window._appStarted=true;
        init();
        hideLoadingScreen();
      },5000);
    } else {
      errEl.textContent='Incorrect email or password.';
      errEl.classList.add('show');
      document.getElementById('l-pass').value='';
    }
  }
  if(btn){btn.textContent='Sign in';btn.disabled=false;}
}

function doRegister(){
  // Public registration is disabled — admin creates accounts only
  const errEl=document.getElementById('reg-err');
  errEl.textContent='Public registration is disabled. Please contact your administrator to create an account.';
  errEl.classList.add('show');
}

async function adminAddUser(){
  const name  = document.getElementById('au-name').value.trim();
  const email = document.getElementById('au-user').value.trim(); // now email
  const p     = document.getElementById('au-pass').value;
  const role  = document.getElementById('au-role').value;
  const dept  = document.getElementById('au-dept')?.value.trim()||'';
  const errEl = document.getElementById('au-err');
  errEl.classList.remove('show');
  if(!name||!email||!p){errEl.textContent='All fields are required.';errEl.classList.add('show');return;}
  if(!email.includes('@')){errEl.textContent='Please enter a valid email address.';errEl.classList.add('show');return;}
  if(p.length<6){errEl.textContent='Password must be at least 6 characters.';errEl.classList.add('show');return;}

  const initials=name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  const btn=document.querySelector('#m-adduser .btn-g');
  if(btn){btn.textContent='Creating…';btn.disabled=true;}

  if(FB_READY&&fbAuth){
    // Create Firebase Auth account — works on all devices
    try{
      // Use secondary app to avoid signing out current admin
      const secondApp=firebase.initializeApp(FIREBASE_CONFIG,'secondary'+Date.now());
      const secondAuth=secondApp.auth();
      const cred=await secondAuth.createUserWithEmailAndPassword(email,p);
      const uid=cred.user.uid;
      await secondAuth.signOut();
      secondApp.delete();

      // Save profile to Firestore
      const profile={uid,email,name,initials,role,dept,lastLogin:null,
        disabled:false,
        createdAt:getTODAY(),
        createdBy:currentUser?.email||currentUser?.username||'system',
        updatedAt:getTODAY(),
        updatedBy:currentUser?.email||currentUser?.username||'system'
      };
      await fbDb.collection('users').doc(uid).set(profile);

      // Add to local USERS array — include both id and firestoreId for compatibility
      // The onSnapshot listener will also pick this up but we add immediately for instant UI
      USERS.push({id:uid,firestoreId:uid,username:email,...profile});
      cm('m-adduser');
      ['au-name','au-user','au-pass'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
      renderUserPage();
      toast(`Account "${name}" created — they can now log in with ${email}`,'s');
    } catch(e){
      errEl.textContent=e.code==='auth/email-already-in-use'
        ?'This email is already registered.'
        :'Error: '+e.message;
      errEl.classList.add('show');
    }
  } else {
    // Demo fallback
    const newUser={id:nextUserId++,username:email,email,password:p,name,initials,role,dept,lastLogin:null};
    USERS.push(newUser);
    cm('m-adduser');
    ['au-name','au-user','au-pass'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    renderUserPage();
    toast(`User "${name}" created`,'s');
  }
  if(btn){btn.textContent='Create account';btn.disabled=false;}
}

function editUserModal(id){
  const u=USERS.find(x=>String(x.id)===String(id)); if(!u) return;
  document.getElementById('eu-id').value=u.id;
  document.getElementById('eu-name').value=u.name;
  // Prefer email; fall back to username; never show 'undefined'
  document.getElementById('eu-user').value=u.email||u.username||'';
  document.getElementById('eu-pass').value='';
  document.getElementById('eu-role').value=u.role;
  document.getElementById('eu-dept').value=u.dept||'';
  document.getElementById('eu-err').classList.remove('show');
  om('m-edituser');
}

function adminSaveUser(){
  if(!confirm('Save changes to this user account?'))return;
  const id=document.getElementById('eu-id').value;
  const name=document.getElementById('eu-name').value.trim();
  const u=document.getElementById('eu-user').value.trim();
  const p=document.getElementById('eu-pass').value;
  const role=document.getElementById('eu-role').value;
  const dept=document.getElementById('eu-dept').value.trim();
  const errEl=document.getElementById('eu-err');
  errEl.classList.remove('show');
  if(!name||!u){errEl.textContent='Name and username are required.';errEl.classList.add('show');return;}
  const dup=USERS.find(x=>x.username===u&&String(x.id)!==String(id));
  if(dup){errEl.textContent='Username already taken.';errEl.classList.add('show');return;}
  const idx=USERS.findIndex(x=>String(x.id)===String(id)); if(idx<0) return;
  const initials=name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  const updates={
    name,username:u,role,dept,initials,email:u,
    updatedAt:getTODAY(),
    updatedBy:currentUser?.email||currentUser?.username||'system'
  };
  USERS[idx]={...USERS[idx],...updates};
  if(p) USERS[idx].password=p;
  // Save changes to Firestore so they persist across devices
  if(typeof fbDb!=='undefined'&&fbDb){
    const fsId=USERS[idx].firestoreId||USERS[idx].uid||id;
    fbDb.collection('users').doc(String(fsId)).update(updates)
      .then(()=>console.log('User updated in Firestore'))
      .catch(e=>{
        console.error('User update failed:',e.message);
        toast('Failed to save changes to database.','e');
      });
  }
  cm('m-edituser');
  // Update session if editing own account
  if(String(currentUser.id)===String(id)){currentUser=USERS[idx];applyUserSession();}
  renderUserPage();
  toast(`User "${name}" updated`,'s');
}

function deleteUser(id){
  if(String(id)===String(currentUser.id)){toast('You cannot delete your own account.','e');return;}
  const u=USERS.find(x=>String(x.id)===String(id));
  if(!u){toast('User not found.','e');return;}
  // Soft delete — mark as disabled, don't physically remove
  const isReactivate = u.disabled===true;
  const action = isReactivate ? 'reactivate' : 'disable';
  if(!confirm(`${isReactivate?'Reactivate':'Disable'} account "${u.name||id}"?\n\n${isReactivate?'They will be able to log in again.':'They will no longer be able to log in, but their data is preserved.'}`))return;
  if(typeof fbDb!=='undefined'&&fbDb){
    const fsId=u.firestoreId||u.uid||id;
    fbDb.collection('users').doc(String(fsId)).update({
      disabled: !isReactivate,
      disabledAt: !isReactivate ? getTODAY() : firebase.firestore.FieldValue.delete(),
      updatedAt: getTODAY(),
      updatedBy: currentUser?.email||currentUser?.username||'system'
    }).catch(e=>console.error('Firestore update failed:',e.message));
  }
  const idx=USERS.findIndex(x=>String(x.id)===String(id));
  if(idx>=0) USERS[idx].disabled = !isReactivate;
  renderUserPage();
  toast(isReactivate?`Account "${u.name}" reactivated`:`Account "${u.name}" disabled`,'i');
}

function doLogout(){
  if(!confirm('Are you sure you want to sign out?'))return;
  if(typeof stopPresence==="function") stopPresence();
  if(typeof stopNotifListener==="function") stopNotifListener();
  // Log logout BEFORE currentUser is cleared so actor info is captured
  try{ if(typeof logAudit==='function') logAudit('auth.logout', 'User signed out', 'info', 'auth', currentUser?.uid); }catch(_){}
  // Hide app while logged out — prevents content flash
  const bodyEl=document.getElementById('body');
  if(bodyEl)bodyEl.style.visibility='hidden';
  const tbEl=document.getElementById('topbar');
  if(tbEl)tbEl.style.visibility='hidden';
  const sbEl=document.getElementById('sidebar');
  if(sbEl)sbEl.style.visibility='hidden';
  currentUser=null;
  window._appStarted=false;
  try{ sessionStorage.removeItem('mp_session'); }catch(e){}
  if(window._refreshInterval){ clearInterval(window._refreshInterval); window._refreshInterval=null; }
  if(typeof fbAuth!=='undefined'&&fbAuth) fbAuth.signOut();
  hideLoadingScreen();
  const a=document.getElementById('auth-screen');if(a)a.style.display='flex';
  const lu=document.getElementById('l-user');if(lu)lu.value='';
  const lp=document.getElementById('l-pass');if(lp)lp.value='';
  const le=document.getElementById('login-err');if(le)le.classList.remove('show');
}

function applyUserSession(){
  // Reveal app — visibility was hidden during login screen
  const bodyEl=document.getElementById('body');
  if(bodyEl)bodyEl.style.visibility='visible';
  const tbEl=document.getElementById('topbar');
  if(tbEl)tbEl.style.visibility='visible';
  const sbEl=document.getElementById('sidebar');
  if(sbEl)sbEl.style.visibility='visible';
  // Start presence tracking when user logs in
  if(typeof startPresence==="function") setTimeout(startPresence, 1000);
  if(typeof startNotifListener==="function") setTimeout(startNotifListener, 2000);
  // Start audit log listener for admins
  if(currentUser && currentUser.role === 'admin' && typeof startAuditListener === 'function') {
    setTimeout(startAuditListener, 2500);
  }
  const u=currentUser;
  const av=document.getElementById('sb-av'); if(av) av.textContent=u.initials;
  const nm=document.getElementById('sb-name'); if(nm) nm.textContent=u.name;
  const rl=document.getElementById('sb-role'); if(rl) rl.textContent=ROLE_LABELS[u.role]||u.role;
  buildSidebarNav();
  // Topbar visibility
  const isReq=u.role==='requester', isCont=u.role==='contractor';
  const sw=document.getElementById('global-search-wrap');
  const nb=document.getElementById('topbar-new-btn');
  if(sw) sw.style.display=(isReq||isCont)?'none':'';
  // Show topbar "+ New request" button ONLY for users who can submit requests
  if(nb) nb.style.display = (typeof can==='function' && can('submit_request')) ? '' : 'none';
}

// ═══════════════════════════════════════════════
// SIDEBAR NAV — fully role & permission driven
// ═══════════════════════════════════════════════
function buildSidebarNav(){
  const r=currentUser.role;
  const navDef=[
    // [ pageId, label, svgPath, section, permKey ]
    ['dash',       'Dashboard',       '<rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/>',  'Overview',        'view_dashboard'],
    ['tasks',      'All tasks',       '<path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',                                                             'Overview',        'view_all_tasks', 'nb-count'],
    ['inprogress', 'In progress',     '<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>', 'Jobs',            'view_inprogress','nb-ip-count','amber'],
    ['contractor', 'My jobs',         '<rect x="2" y="6" width="12" height="8" rx="1" stroke="currentColor" stroke-width="1.4"/><path d="M5 6V4a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>','Jobs','view_inprogress','nb-cont-count','amber'],
    ['request',    'Job requests',    '<rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>','Jobs','submit_request','nb-jq-count'],
    ['reports',    'Reports',         '<rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor"/><rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor"/><rect x="11" y="1" width="3" height="14" rx="1" fill="currentColor"/>','Analytics','view_reports'],
    ['email',      'Email report',    '<rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M1 5l7 5 7-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>','Analytics','send_email'],
    ['users',      'Users',           '<circle cx="6" cy="5" r="2.5" stroke="currentColor" stroke-width="1.4"/><path d="M1 13c0-2.761 2.239-4 5-4s5 1.239 5 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="13" cy="5" r="2" stroke="currentColor" stroke-width="1.2"/><path d="M11.5 13c0-1.5 1-2.5 2-2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>','Administration','manage_users','nb-users-count'],
    ['audit',      'Audit log',       '<rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 6h6M5 9h6M5 12h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>','Administration','view_audit_log'],
    ['permissions','Permissions',     '<path d="M12 1l1.5 3L17 5l-2.5 2.5.5 3.5L12 9.5 9.5 11l.5-3.5L7.5 5l3.5-1L12 1z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="4" cy="12" r="2.5" stroke="currentColor" stroke-width="1.2"/>','Administration','manage_permissions'],
    ['rooms',      'Rooms board','<rect x="1" y="1" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="1" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="1" y="7" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="7" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.4"/>','Jobs','view_all_tasks'],
    ['admin',      'Field mgmt',      '<circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M11 8l1 1 2-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>','Administration','manage_fields'],
  ];

  // Contractor sees 'My jobs' instead of 'In progress', plus request
  // Requester only sees request
  let html=''; let curSection='';
  navDef.forEach(([page,label,icon,section,perm,pillId,pillClass])=>{
    // Skip contractor-only nav item for non-contractors, and skip in-progress for contractors
    if(page==='contractor' && r!=='contractor') return;
    if(page==='inprogress' && r==='contractor') return;
    // Skip request page for contractor (contractor uses their own panel)
    if(page==='request' && r==='contractor') return;
    if(!can(perm)) return;
    if(section!==curSection){
      if(curSection) html+='</div>';
      html+=`<div class="nav-section"><div class="nav-sec-label">${section}</div>`;
      curSection=section;
    }
    const pillHtml=pillId?`<span class="nav-pill${pillClass?' '+pillClass:''}" id="${pillId}">0</span>`:'';
    html+=`<button class="nav-btn" id="nb-${page}" onclick="go('${page}',this)">
      <svg viewBox="0 0 16 16" fill="none" style="width:15px;height:15px;flex-shrink:0">${icon}</svg>
      <span class="lbl">${label}</span>${pillHtml}
    </button>`;
  });
  if(curSection) html+='</div>';
  document.getElementById('sb-nav').innerHTML=html;
  updateNavPills();
}

function updateNavPills(){
  const active=DATA.filter(r=>r.status==='In Progress'||r.status==='In Progress - Contractor').length;
  const pending=DATA.filter(r=>r.status==='Pending').length;
  const contJobs = currentUser? DATA.filter(r=>r.handler==='Contractor'&&r.status!=='Completed').length : 0;
  const setP=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setP('nb-count',DATA.length);
  setP('nb-ip-count',active);
  setP('nb-jq-count',pending);
  setP('nb-cont-count',contJobs);
  setP('nb-users-count',USERS.length);
}


// ═══════════════════════════════════════════════
// FIELD DATA
// ═══════════════════════════════════════════════
let SUBTYPES={
  AC:['AC Too Cold','AC Too Hot','Filter Dirty','Filter Other','Leaking','Noisy','Not Responding','Plant - AHU','Plant - Chiller','Other'],
  Appliances:['Air Freshener','Coffee Machine','Dishwasher','Electric Heater','Hairdryer','Kettle','Lamp','Microwave','Mini Bar Fridge','Speaker','Telephone','Vacuum Cleaner','Washing Machine','Other'],
  Beds:['Mattress','Legs / Wheels','Gliders','Other'],
  Cleaning:['Filter','P-Trap','Lift Rail','Other'],
  Door_Hardware:['Automatic Door','Boom Gate','Door Damaged','Door lock batteries','Door lock faulty','Door seals','Handles','Vincard / Lock Systems','Sliding Door','Other'],
  Electrical_Works:['Exhaust','General Install','Light Fitting','Light Flickering','Light Globe Replacement','Light Switch','PMT-2 Yearly','Power Outlet / GPO','RCD Testing','Switchboard Maintenance','Test & Tag - Rooms','Other'],
  Flooring:['Carpet','Skirting','Tiles','Timber','Vinyl','Polish','Maintenance Oil','Other'],
  Fixtures_Furnishings_Fittings:['Benchtop','Chair','Couch','Cupboard','Curtain','Desk','Exterior Furniture','Lamp','Minibar cabinet','Ottoman','Shelf','Stool','Table','Wardrobe','Other'],
  Plumbing_Hydraulics_Services:['Basin','Bathtub','Cold water','Drain','Floor waste','Hot water','Shower','Toilet','Tap','Valve','Water heater','Other'],
  Painting:['Walls','Skirting','Ceiling','Door and Skirting','Other'],
  Pest_Control:['Bait Stations','Flytraps','Sightings','Other'],
  Refrigeration:['Coolroom','Freezer','Fridge','Ice Machine','Other'],
  Security_Building_Access:['Alarm System','CCTV','Duress / Panic buttons','Other'],
  Walls_Ceiling_Roof:['Ceiling - Chipped','Ceiling - Mouldy','Wall - Chipped','Wall - Marks','Walls - Mouldy','Wall - Skirting','Wallpaper','Other'],
  Other:['Other']
};
let AREAS=['Basement_2','Basement_1','Ground Floor','Level_1','Level_2','Level_3','Level_4','Level_5','Level_6','Level_7','Level_8','Level_9','Level_10','Level_11','Level_12','Level_13','Level_14','Level_15','Level_16','Level_17','Level_18'];
// REQS is now derived from registered users with role==='requester'
// No static dummy data — driven entirely by Firebase Auth + Firestore
let REQS = [];
function refreshReqsFromUsers(){
  REQS = USERS.filter(u=>u.role==='requester').map(u=>u.name).filter(Boolean);
}
let HNDS=['Rayan Borabien','Josh Branson','Terry Allen','Contractor'];
// Auto-assign map: work type → handler
const AUTO_ASSIGN={
  AC:'Rayan Borabien',Electrical_Works:'Rayan Borabien',Plumbing_Hydraulics_Services:'Rayan Borabien',
  Flooring:'Rayan Borabien',Door_Hardware:'Josh Branson',Fixtures_Furnishings_Fittings:'Josh Branson',
  Beds:'Josh Branson',Walls_Ceiling_Roof:'Josh Branson',Painting:'Josh Branson',
  Pest_Control:'Contractor',Refrigeration:'Contractor',Security_Building_Access:'Contractor',
  Appliances:'Terry Allen',Cleaning:'Terry Allen',Other:'Terry Allen'
};

const WTC={Flooring:'#6ebe2a',Plumbing_Hydraulics_Services:'#2dcfb3',Door_Hardware:'#f0a62e',Beds:'#e8534a',Electrical_Works:'#a87cf0',Fixtures_Furnishings_Fittings:'#fb923c',Painting:'#f472b6',Pest_Control:'#34d399',AC:'#5599f5',Other:'#667550'};
const PAL=['#6ebe2a','#2dcfb3','#f0a62e','#e8534a','#a87cf0','#fb923c','#f472b6','#34d399','#5599f5'];
function wc(k){return WTC[k]||PAL[Object.keys(SUBTYPES).indexOf(k)%PAL.length]||'#667550'}

// ═══════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════
function getTODAY(){return new Date().toISOString().slice(0,10);}
const TODAY=getTODAY();

// ═══════════════════════════════════════════════
// PRESENCE — live online user tracking
// ═══════════════════════════════════════════════
let _presenceInterval = null;
let ONLINE_USERS = [];

function startPresence() {
  if (!currentUser || typeof fbDb==='undefined' || !fbDb) return;
  const uid = currentUser.uid || currentUser.id;
  if (!uid) return;
  const heartbeat = ()=>{
    fbDb.collection('presence').doc(String(uid)).set({
      uid: String(uid),
      name: currentUser.name,
      role: currentUser.role,
      lastSeen: Date.now()
    }, {merge:true}).catch(e=>console.warn('Presence write failed:',e.message));
  };
  heartbeat();
  if (_presenceInterval) clearInterval(_presenceInterval);
  _presenceInterval = setInterval(heartbeat, 30000); // every 30s

  // Listen for online users
  if (window._presenceUnsub) window._presenceUnsub();
  window._presenceUnsub = fbDb.collection('presence').onSnapshot(snap=>{
    const now = Date.now();
    ONLINE_USERS = snap.docs.map(d=>d.data())
      .filter(u=>u.lastSeen && (now - u.lastSeen < 60000)); // active within 60s
    renderOnlineBadge();
  }, e=>console.warn('Presence listener:',e.message));
}

function stopPresence() {
  if (_presenceInterval) { clearInterval(_presenceInterval); _presenceInterval=null; }
  if (window._presenceUnsub) { window._presenceUnsub(); window._presenceUnsub=null; }
  if (currentUser && typeof fbDb!=='undefined' && fbDb) {
    const uid = currentUser.uid || currentUser.id;
    if (uid) fbDb.collection('presence').doc(String(uid)).delete().catch(()=>{});
  }
  ONLINE_USERS = [];
}

function renderOnlineBadge() {
  const el = document.getElementById('tb-online');
  if (!el) return;
  const n = ONLINE_USERS.length;
  el.innerHTML = `
    <span style="display:inline-flex;align-items:center;gap:5px;cursor:pointer" onclick="toggleOnlineList()">
      <span style="width:8px;height:8px;border-radius:50%;background:#6ebe2a;box-shadow:0 0 0 3px rgba(110,190,42,.2);display:inline-block"></span>
      <span style="font-size:11.5px;font-weight:600;color:var(--t1)">${n} online</span>
    </span>
  `;
}

function toggleOnlineList() {
  let pop = document.getElementById('online-pop');
  if (pop) { pop.remove(); return; }
  pop = document.createElement('div');
  pop.id = 'online-pop';
  pop.style.cssText = 'position:absolute;top:48px;right:14px;background:var(--s0);border:1px solid var(--b2);border-radius:10px;padding:10px;z-index:9001;min-width:200px;box-shadow:0 8px 24px rgba(0,0,0,.4)';
  pop.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--b0)">Currently online (${ONLINE_USERS.length})</div>
    ${ONLINE_USERS.length
      ? ONLINE_USERS.map(u=>`<div style="padding:5px 0;display:flex;align-items:center;gap:7px">
          <span style="width:7px;height:7px;border-radius:50%;background:#6ebe2a;flex-shrink:0"></span>
          <span style="font-size:12px;color:var(--t0)">${u.name}</span>
          <span style="font-size:10px;color:var(--t3);margin-left:auto">${u.role||''}</span>
        </div>`).join('')
      : '<div style="font-size:12px;color:var(--t3);padding:6px 0">No one online</div>'}
  `;
  document.body.appendChild(pop);
  // Close on outside click
  setTimeout(()=>{
    document.addEventListener('click', function close(e){
      if (!pop.contains(e.target) && e.target.id!=='tb-online') {
        pop.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 100);
}
let DATA=[]; // jobs loaded from Firestore in real-time
let nid=1,fData=[...DATA],sKey=null,sDir=1,cPg=1,eId=null;
let PGS=parseInt(localStorage.getItem('mp_page_size')||'20',10);const chs={};
let SELECTED_TASKS=new Set();
let aR=new Set(),aW=new Set(),rReady=false;
let dashFilter='all';

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fd(d){if(!d)return'—';const[y,m,dy]=d.split('-');return dy+' '+MONTHS[+m-1]+' '+y}
function fds(d){if(!d)return'—';const[,m,dy]=d.split('-');return dy+' '+MONTHS[+m-1]}
function cb(a,k){return a.reduce((o,r)=>{o[r[k]]=(o[r[k]]||0)+1;return o},{})}
function sbadge(s){
  if(s==='Completed')return '<span class="badge b-done">Completed</span>';
  if(s==='In Progress - Contractor')return '<span class="badge b-cont">Contractor</span>';
  if(s==='Pending')return '<span class="badge b-pend">Pending</span>';
  return '<span class="badge b-prog">In Progress</span>';
}
function pbadge(p){const m={Low:'b-low',Medium:'b-med',High:'b-hi',Urgent:'b-urg'};return`<span class="badge ${m[p]||'b-low'}">${p}</span>`}
function mkCh(id,cfg){if(chs[id])chs[id].destroy();const el=document.getElementById(id);if(!el)return;chs[id]=new Chart(el,cfg)}
function om(id){document.getElementById(id).classList.add('open')}
function cm(id){document.getElementById(id).classList.remove('open')}
function setF(id,v){const el=document.getElementById(id);if(el)el.value=v}
document.addEventListener('click',e=>{if(e.target.classList.contains('mov'))e.target.classList.remove('open')});

// ═══════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════
function toast(msg,t='s'){
  const icons={
    s:'<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    e:'<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    i:'<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 7v4M8 5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
  };
  const el=document.createElement('div');
  el.className=`toast t-${t}`;el.innerHTML=icons[t]+msg;
  document.getElementById('tc').appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(()=>el.remove(),300)},3500);
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
function go(p,el){
  // Permission gate
  const perm=PAGE_PERM[p];
  if(perm && !can(perm)){ toast('Access denied — your role cannot view this page.','e'); return; }

  document.querySelectorAll('.page').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.nav-btn').forEach(e=>e.classList.remove('on'));
  const pageEl=document.getElementById('page-'+p);
  if(!pageEl) return;
  pageEl.classList.add('on');
  if(el) el.classList.add('on');

  const T={dash:'Dashboard',tasks:'All tasks',add:'Add new task',
    inprogress:'In Progress — Task board',contractor:'My assigned jobs',
    request:'Job request portal',reports:'Reports & analytics',
    email:'Email report',users:'User management',
    permissions:'Role permissions',admin:'Field management',
    audit:'Audit log',rooms:'Room maintenance board'};
  const ttl=document.getElementById('pg-ttl'); if(ttl) ttl.textContent=T[p]||p;

  if(p==='dash')          rDash();
  if(p==='tasks')         {bTKpis();af();}
  if(p==='inprogress')    renderInProgress();
  if(p==='contractor')    renderContractorPanel();
  if(p==='request')       renderRequestPage();
  if(p==='reports')       {if(!rReady){bChips();rReady=true;}renderR();}
  if(p==='users')         renderUserPage();
  if(p==='permissions')   renderPermissionsPage();
  if(p==='admin')         renderAdminPanels();
  if(p==='rooms'&&typeof renderRoomsBoard==='function') renderRoomsBoard();
  if(p==='audit'&&typeof renderAuditLog==='function') renderAuditLog();

  if(window.innerWidth<=768) closeMobileSB();
  syncMobileNav(p);
}

function toggleSB(){
  if(window.innerWidth<=768) openMobileSB();
  else document.getElementById('sb').classList.toggle('col');
}
function openMobileSB(){
  document.getElementById('sb').classList.add('mopen');
  document.getElementById('sb-overlay').classList.add('show');
  document.body.style.overflow='hidden';
}
function closeMobileSB(){
  document.getElementById('sb').classList.remove('mopen');
  document.getElementById('sb-overlay').classList.remove('show');
  document.body.style.overflow='';
}
function mbnNav(p){ go(p, document.getElementById('nb-'+p)); }
function syncMobileNav(p){
  document.querySelectorAll('.mbn-btn').forEach(b=>b.classList.remove('on'));
  const map={dash:'mbn-dash',tasks:'mbn-tasks',add:'mbn-add',inprogress:'mbn-inprogress',contractor:'mbn-inprogress',request:'mbn-add'};
  const id=map[p]; if(id){const el=document.getElementById(id);if(el)el.classList.add('on');}
}
function gSrch(q){setF('fsrch',q);go('tasks',document.getElementById('nb-tasks'));af();}

// ═══════════════════════════════════════════════
// POPULATE DROPDOWNS
// ═══════════════════════════════════════════════
function fillDrops(){
  if(typeof refreshReqsFromUsers==='function') refreshReqsFromUsers();
  function f(id,arr){const s=document.getElementById(id);if(!s)return;const cur=s.value;while(s.children.length>1)s.removeChild(s.lastChild);arr.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v.replace(/_/g,' ');s.appendChild(o)});s.value=cur;}
  f('far',AREAS.slice().sort());
  f('fwt',Object.keys(SUBTYPES).sort());
  f('fhd',HNDS.slice().sort());
  const nbCount=document.getElementById('nb-count');
  if(nbCount)nbCount.textContent=DATA.length;

  // Add task form

  // Job request form
  const jqWt=document.getElementById('jq-wt');if(jqWt){jqWt.innerHTML=Object.keys(SUBTYPES).map(v=>`<option>${v}</option>`).join('');jqus();}
  const jqAr=document.getElementById('jq-ar');if(jqAr)jqAr.innerHTML=AREAS.map(v=>`<option>${v}</option>`).join('');
  // Requestor dropdown — all registered users; hidden for requester role (auto-fills their name)
  const jqRq=document.getElementById('jq-rq');
  const jqRqWrap=document.getElementById('jq-rq-wrap');
  if(jqRq){
    const isReqRole=currentUser&&currentUser.role==='requester';
    if(jqRqWrap)jqRqWrap.style.display=isReqRole?'none':'';
    if(!isReqRole){
      const allUsers=USERS.filter(u=>u.name).map(u=>u.name);
      const curVal=jqRq.value;
      jqRq.innerHTML='<option value="">— Select requestor —</option>'+allUsers.map(n=>`<option value="${n}" ${n===curVal?'selected':''}>${n}</option>`).join('');
    }
  }

  // Update in-progress pill
  const ipCount=DATA.filter(r=>r.status==='In Progress'||r.status==='In Progress - Contractor').length;
  const ipPill=document.getElementById('nb-ip-count');if(ipPill)ipPill.textContent=ipCount;

  // Job request pill (pending)
  const jqCount=DATA.filter(r=>r.status==='Pending').length;
  const jqPill=document.getElementById('nb-jq-count');if(jqPill)jqPill.textContent=jqCount;
}

function eus(){const wt=document.getElementById('em-wt');if(!wt)return;document.getElementById('em-st').innerHTML=(SUBTYPES[wt.value]||['Other']).map(o=>`<option value="${o}">${o}</option>`).join('')}
function jqus(){const wt=document.getElementById('jq-wt');if(!wt)return;document.getElementById('jq-st').innerHTML=(SUBTYPES[wt.value]||['Other']).map(o=>`<option>${o}</option>`).join('')}

// ═══════════════════════════════════════════════
// FILTER + SORT + TABLE
// ═══════════════════════════════════════════════
function af(){
  const q=(document.getElementById('fsrch').value||'').toLowerCase();
  const st=document.getElementById('fst').value;
  const ar=document.getElementById('far').value;
  const wt=document.getElementById('fwt').value;
  const hd=document.getElementById('fhd').value;
  const pr=document.getElementById('fpr').value;
  fData=DATA.filter(r=>{
    if(st&&r.status!==st&&!(st==='Urgent'&&r.priority==='Urgent'))return false;
    if(ar&&r.area!==ar)return false;
    if(wt&&r.workType!==wt)return false;
    if(hd&&r.handler!==hd)return false;
    if(pr&&r.priority!==pr)return false;
    if(q&&!Object.values(r).join(' ').toLowerCase().includes(q))return false;
    return true;
  });
  if(sKey)fData.sort((a,b)=>(a[sKey]>b[sKey]?1:-1)*sDir);
  cPg=1;
  SELECTED_TASKS.clear();
  rTbl();
}
function clrF(){['fsrch','fst','far','fwt','fhd','fpr'].forEach(id=>{const el=document.getElementById(id);if(el){if(el.tagName==='INPUT')el.value='';else el.value='';}});af();}
function srt(k){if(sKey===k)sDir*=-1;else{sKey=k;sDir=1;}af();}

function rTbl(){
  const tot=fData.length,pages=Math.max(1,Math.ceil(tot/PGS));
  if(cPg>pages)cPg=pages;
  const startIdx=(cPg-1)*PGS;
  const rows=fData.slice(startIdx,startIdx+PGS);
  const showingStart=tot>0?startIdx+1:0;
  const showingEnd=Math.min(startIdx+PGS,tot);
  document.getElementById('fi').textContent=`${tot} task${tot!==1?'s':''} · ${tot===DATA.length?'all records':'filtered from '+DATA.length}`;
  const isAdmin=currentUser&&(currentUser.role==='admin'||currentUser.role==='staff');
  const isFullAdmin=currentUser&&currentUser.role==='admin';
  const tb=document.getElementById('t-body');

  // Check if all currently visible rows are selected (for header checkbox state)
  const visibleIds=rows.map(r=>String(r.id));
  const allVisibleSelected=visibleIds.length>0 && visibleIds.every(id=>SELECTED_TASKS.has(id));

  tb.innerHTML=rows.length?rows.map(r=>{
    const checked=SELECTED_TASKS.has(String(r.id))?'checked':'';
    return `<tr class="${SELECTED_TASKS.has(String(r.id))?'row-selected':''}">
    ${isAdmin?`<td style="width:34px;padding-right:0"><input type="checkbox" class="t-chk" data-id="${r.id}" ${checked} onclick="toggleSelectTask('${r.id}',this.checked,event)" style="width:16px;height:16px;accent-color:var(--g);cursor:pointer"></td>`:''}
    <td>${fds(r.date)}</td><td class="td-h">${r.requestor}</td><td>${r.handler}</td>
    <td>${r.workType.replace(/_/g,' ')}</td><td>${r.subType}</td>
    <td>${r.area.replace(/_/g,' ')}</td><td>${r.location}</td>
    <td title="${r.details}" style="color:var(--t2)">${r.details}</td>
    <td>${sbadge(r.status)}</td><td>${pbadge(r.priority)}</td>
    <td><div style="display:flex;gap:3px">
      <button class="btn btn-o btn-xs" onclick="vTask('${r.id}')" title="View" style="padding:3px 5px"><svg viewBox="0 0 16 16" fill="none" style="width:11px;height:11px"><circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg></button>
      ${isAdmin?`<button class="btn btn-o btn-xs" onclick="eTask('${r.id}')" title="Edit" style="padding:3px 5px"><svg viewBox="0 0 16 16" fill="none" style="width:11px;height:11px"><path d="M11 2l3 3-9 9H2v-3L11 2z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`:''}
      ${isFullAdmin?`<button class="btn btn-r btn-xs" onclick="dTask('${r.id}')" title="Delete" style="padding:3px 5px"><svg viewBox="0 0 16 16" fill="none" style="width:11px;height:11px"><path d="M3 4h10M6 4V2h4v2M5 4v8h6V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`:''}
    </div></td>
  </tr>`}).join(''):`<tr><td colspan="${isAdmin?12:11}" style="text-align:center;padding:36px;color:var(--t2)">No tasks match the current filters.</td></tr>`;

  // Update header checkbox state
  const headerChk=document.getElementById('t-chk-all');
  if(headerChk){
    headerChk.checked=allVisibleSelected;
    headerChk.indeterminate=!allVisibleSelected && visibleIds.some(id=>SELECTED_TASKS.has(id));
  }

  // Render pagination controls
  renderPagination(cPg, pages, tot, showingStart, showingEnd);
  // Update bulk action bar
  updateBulkBar();
}

// ─── Selection state management ───
function toggleSelectTask(id, checked, event){
  id=String(id);
  if(event && event.shiftKey && window._lastSelectedTask){
    // Shift-click range selection
    const ids=fData.map(r=>String(r.id));
    const a=ids.indexOf(window._lastSelectedTask);
    const b=ids.indexOf(id);
    if(a>=0 && b>=0){
      const [s,e]=[Math.min(a,b),Math.max(a,b)];
      for(let i=s;i<=e;i++){
        if(checked) SELECTED_TASKS.add(ids[i]);
        else        SELECTED_TASKS.delete(ids[i]);
      }
    }
  } else {
    if(checked) SELECTED_TASKS.add(id);
    else        SELECTED_TASKS.delete(id);
  }
  window._lastSelectedTask=id;
  rTbl();
}

function toggleSelectAllVisible(checked){
  // Toggle all currently visible (current page) rows
  const startIdx=(cPg-1)*PGS;
  const rows=fData.slice(startIdx,startIdx+PGS);
  rows.forEach(r=>{
    if(checked) SELECTED_TASKS.add(String(r.id));
    else        SELECTED_TASKS.delete(String(r.id));
  });
  rTbl();
}

function clearSelection(){
  SELECTED_TASKS.clear();
  rTbl();
}

// ─── Bulk action bar ───
function updateBulkBar(){
  const bar=document.getElementById('bulk-bar');
  if(!bar) return;
  const n=SELECTED_TASKS.size;
  if(n===0){
    bar.classList.remove('on');
    return;
  }
  bar.classList.add('on');
  const cnt=document.getElementById('bulk-count');
  if(cnt) cnt.textContent=n;
}

async function bulkMarkComplete(){
  const ids=Array.from(SELECTED_TASKS);
  if(!ids.length) return;
  if(!confirm(`Mark ${ids.length} job${ids.length!==1?'s':''} as Completed?`)) return;
  const updates={status:'Completed',completion:getTODAY(),completedAt:typeof nowISO==='function'?nowISO():new Date().toISOString()};
  for(const id of ids){
    try{
      await fbUpdateJob(id, updates);
      if(typeof logAudit==='function') logAudit('job.completed', `Bulk complete: job ${id}`, 'info', 'job', id);
    }catch(e){ console.warn('Bulk complete failed for', id, e.message); }
  }
  toast(`${ids.length} job${ids.length!==1?'s':''} marked complete`, 's');
  clearSelection();
}

async function bulkChangePriority(){
  const ids=Array.from(SELECTED_TASKS);
  if(!ids.length) return;
  const p=prompt('Set priority for ' + ids.length + ' jobs to: Urgent, High, Medium, or Low');
  if(!p) return;
  const priority=p.trim();
  if(!['Urgent','High','Medium','Low'].includes(priority)){
    toast('Invalid priority. Use: Urgent, High, Medium, or Low','e');
    return;
  }
  for(const id of ids){
    try{
      await fbUpdateJob(id, {priority});
      if(typeof logAudit==='function') logAudit('job.updated', `Bulk priority change: ${priority}`, 'info', 'job', id);
    }catch(e){ console.warn('Bulk priority failed for', id, e.message); }
  }
  toast(`Priority set to ${priority} on ${ids.length} job${ids.length!==1?'s':''}`, 's');
  clearSelection();
}

async function bulkDelete(){
  const ids=Array.from(SELECTED_TASKS);
  if(!ids.length) return;
  if(currentUser?.role!=='admin'){ toast('Only admin can delete jobs','e'); return; }
  const confirmed=prompt(`Type "${ids.length}" to confirm deleting ${ids.length} job${ids.length!==1?'s':''}. This cannot be undone.`);
  if(confirmed!==String(ids.length)){
    toast('Bulk delete cancelled','i');
    return;
  }
  for(const id of ids){
    try{
      const r=DATA.find(x=>String(x.id)===String(id));
      await fbDeleteJob(id);
      if(typeof logAudit==='function') logAudit('job.deleted', `Bulk delete: ${r?.workType?.replace(/_/g,' ')||''} at ${r?.location||''}`, 'warning', 'job', id);
    }catch(e){ console.warn('Bulk delete failed for', id, e.message); }
  }
  if(!FB_READY){ DATA=DATA.filter(x=>!ids.includes(String(x.id))); fData=fData.filter(x=>!ids.includes(String(x.id))); }
  toast(`${ids.length} job${ids.length!==1?'s':''} deleted`, 's');
  clearSelection();
}

// ─── Full pagination renderer ───
function renderPagination(currentPage, totalPages, totalItems, showStart, showEnd){
  const wrap=document.getElementById('pag-wrap');
  if(!wrap) return;
  if(totalItems===0){
    wrap.innerHTML='';
    return;
  }
  // Build page number buttons (smart truncation)
  function pageBtns(){
    const btns=[];
    const maxShow=5;
    if(totalPages<=maxShow+2){
      for(let i=1;i<=totalPages;i++) btns.push(i);
    } else {
      btns.push(1);
      let start=Math.max(2, currentPage-1);
      let end=Math.min(totalPages-1, currentPage+1);
      if(start>2) btns.push('…');
      for(let i=start;i<=end;i++) btns.push(i);
      if(end<totalPages-1) btns.push('…');
      btns.push(totalPages);
    }
    return btns;
  }
  const btnHTML=pageBtns().map(b=>{
    if(b==='…') return `<span class="pag-ellipsis">…</span>`;
    const active=b===currentPage?'active':'';
    return `<button class="pag-num ${active}" onclick="goToPage(${b})">${b}</button>`;
  }).join('');

  wrap.innerHTML=`
    <div class="pag-info-wrap">
      <span class="pag-info-text">Showing <strong>${showStart}–${showEnd}</strong> of <strong>${totalItems}</strong></span>
      <select class="pag-size" onchange="setPageSize(this.value)" title="Page size">
        <option value="10" ${PGS===10?'selected':''}>10 / page</option>
        <option value="20" ${PGS===20?'selected':''}>20 / page</option>
        <option value="50" ${PGS===50?'selected':''}>50 / page</option>
        <option value="100" ${PGS===100?'selected':''}>100 / page</option>
      </select>
    </div>
    <div class="pag-nav">
      <button class="pag-arr" onclick="goToPage(${currentPage-1})" ${currentPage<=1?'disabled':''} title="Previous">
        <svg viewBox="0 0 16 16" fill="none" style="width:14px;height:14px"><path d="M10 4l-4 4 4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      ${btnHTML}
      <button class="pag-arr" onclick="goToPage(${currentPage+1})" ${currentPage>=totalPages?'disabled':''} title="Next">
        <svg viewBox="0 0 16 16" fill="none" style="width:14px;height:14px"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  `;
}

function goToPage(p){
  const pages=Math.max(1,Math.ceil(fData.length/PGS));
  cPg=Math.max(1,Math.min(p,pages));
  rTbl();
  // Smooth scroll to top of table
  const tableWrap=document.querySelector('#page-tasks .tbl-wrap');
  if(tableWrap) tableWrap.scrollTop=0;
}

function setPageSize(s){
  PGS=parseInt(s,10)||20;
  try{ localStorage.setItem('mp_page_size', String(PGS)); }catch(_){}
  cPg=1;
  rTbl();
}
// chPg replaced by goToPage()
function chPg(d){goToPage(cPg+d);}

// ═══════════════════════════════════════════════
// TASK KPIs
// ═══════════════════════════════════════════════
function bTKpis(){
  const d=DATA,c=d.filter(r=>r.status==='Completed').length;
  const i=d.filter(r=>r.status==='In Progress'||r.status==='In Progress - Contractor').length;
  const u=d.filter(r=>r.priority==='Urgent'||r.priority==='High').length;
  const pending=d.filter(r=>r.status==='Pending').length;
  document.getElementById('t-kpis').innerHTML=[
    {c:'#6ebe2a',l:'Total tasks',v:d.length,s:'All records'},
    {c:'#6ebe2a',l:'Completed',v:c,tr:d.length?`${Math.round(c/d.length*100)}% rate`:'—',tc:'up'},
    {c:'#5599f5',l:'In progress',v:i},
    {c:'#f0a62e',l:'High priority',v:u,tr:u>3?'Needs attention':'All clear',tc:u>3?'dn':'up'},
    {c:'#a87cf0',l:'Pending',v:pending,s:'Awaiting action'},
    {c:'#2dcfb3',l:'Active handlers',v:new Set(d.map(r=>r.handler)).size,s:'Staff assigned'},
  ].map(k=>`<div class="kpi"><div class="kpi-bar" style="background:${k.c}"></div><div class="kpi-lbl">${k.l}</div><div class="kpi-val">${k.v}</div>${k.s?`<div class="kpi-sub">${k.s}</div>`:''} ${k.tr?`<div class="kpi-trend ${k.tc}">${k.tr}</div>`:''}</div>`).join('');
}

// ═══════════════════════════════════════════════
// VIEW / EDIT / DELETE TASKS
// ═══════════════════════════════════════════════
function vTask(id){
  id=String(id);
  const r=DATA.find(x=>String(x.id)===id);if(!r)return;
  const canEdit=currentUser&&(currentUser.role==='admin'||currentUser.role==='staff');
  document.getElementById('det-body').innerHTML=`
    <div class="dg">
      <div class="di"><div class="dl">Date</div><div class="dv">${fd(r.date)}</div></div>
      <div class="di"><div class="dl">Status</div><div class="dv">${sbadge(r.status)}</div></div>
      <div class="di"><div class="dl">Requestor</div><div class="dv">${r.requestor}</div></div>
      <div class="di"><div class="dl">Handled by</div><div class="dv">${r.handler}</div></div>
      <div class="di"><div class="dl">Work type</div><div class="dv">${r.workType.replace(/_/g,' ')}</div></div>
      <div class="di"><div class="dl">Sub type</div><div class="dv">${r.subType}</div></div>
      <div class="di"><div class="dl">Area</div><div class="dv">${r.area.replace(/_/g,' ')}</div></div>
      <div class="di"><div class="dl">Location</div><div class="dv">${r.location}</div></div>
      <div class="di"><div class="dl">Priority</div><div class="dv">${pbadge(r.priority)}</div></div>
      <div class="di"><div class="dl">Completion date</div><div class="dv">${fd(r.completion)}</div></div>
    </div>
    <div style="padding:12px;background:var(--s2);border-radius:var(--r);border:1px solid var(--b0)">
      <div class="dl" style="margin-bottom:5px">Details</div>
      <div style="font-size:13px;color:var(--t0);line-height:1.6">${r.details}</div>
    </div>`;
  const editBtn=document.getElementById('det-edit');
  editBtn.style.display=canEdit?'':'none';
  editBtn.onclick=()=>{cm('m-det');eTask(id);};
  const mft=document.querySelector('#m-det .mft');
  if(mft&&canEdit){
    const ex=document.getElementById('btn-mark-complete');if(ex)ex.remove();
    if(r.status!=='Completed'){
      const btn=document.createElement('button');
      btn.id='btn-mark-complete';btn.className='btn btn-g';btn.textContent='✓ Mark complete';
      btn.onclick=()=>markJobComplete(id);
      mft.insertBefore(btn,mft.lastElementChild);
    }
  }
  om('m-det');
}

function markJobComplete(id){
  id=String(id);
  // Get the job reference FIRST so audit log + UI updates can reference it safely
  const r=DATA.find(x=>String(x.id)===id);
  const updates={
    status:'Completed',
    completion:getTODAY(),
    completedAt: (typeof nowISO === 'function') ? nowISO() : new Date().toISOString()
  };
  try{ if(typeof logAudit==='function') logAudit('job.completed', `Job marked complete: ${r?.workType?.replace(/_/g,' ')||''} at ${r?.location||''}`, 'info', 'job', id); }catch(_){}
  fbUpdateJob(id,updates);
  if(!FB_READY && r) Object.assign(r, updates);
  cm('m-det');af();renderInProgress();
  toast('Job marked as completed ✓','s');
}

function eTask(id){
  id=String(id);
  const r=DATA.find(x=>String(x.id)===id);if(!r)return;
  eId=id;
  document.getElementById('em-dt').value=r.date;
  document.getElementById('em-lc').value=r.location;
  document.getElementById('em-ss').value=r.status;
  document.getElementById('em-pr').value=r.priority;
  document.getElementById('em-de').value=r.details;
  document.getElementById('em-wt').innerHTML=Object.keys(SUBTYPES).map(k=>`<option value="${k}" ${k===r.workType?'selected':''}>${k.replace(/_/g,' ')}</option>`).join('');
  const emSt=document.getElementById('em-st');
  const emSubs=SUBTYPES[r.workType]||['Other'];
  emSt.innerHTML=emSubs.map(s=>`<option value="${s}" ${s===r.subType?'selected':''}>${s}</option>`).join('');
document.getElementById('em-rq').innerHTML=REQS.map(v=>`<option ${v===r.requestor?'selected':''}>${v}</option>`).join('');
  document.getElementById('em-hd').innerHTML=HNDS.map(v=>`<option ${v===r.handler?'selected':''}>${v}</option>`).join('');
  document.getElementById('em-ar').innerHTML=AREAS.map(v=>`<option ${v===r.area?'selected':''}>${v}</option>`).join('');
  om('m-edit');
}

function saveEdit(){
  if(!confirm('Save changes to this task?'))return;
  const r=DATA.find(x=>String(x.id)===String(eId));if(!r)return;
  const updates={
    date:document.getElementById('em-dt').value,
    requestor:document.getElementById('em-rq').value,
    handler:document.getElementById('em-hd').value,
    workType:document.getElementById('em-wt').value,
    subType:document.getElementById('em-st').value,
    area:document.getElementById('em-ar').value,
    location:document.getElementById('em-lc').value,
    status:document.getElementById('em-ss').value,
    priority:document.getElementById('em-pr').value,
    details:document.getElementById('em-de').value,
  };
  if(updates.status==='Completed'&&!r.completion)updates.completion=getTODAY();
  fbUpdateJob(String(eId),updates);
  if(!FB_READY)Object.assign(r,updates);
  try{ if(typeof logAudit==='function') logAudit('job.updated', `Job updated: ${updates.workType?.replace(/_/g,' ')||r.workType?.replace(/_/g,' ')} at ${updates.location||r.location} (status: ${updates.status||r.status})`, 'info', 'job', eId); }catch(_){}
  cm('m-edit');af();rReady=false;fillDrops();toast('Task updated successfully');
  // Notify handler if changed or assigned; notify requestor of status change
  if (typeof notifyUser === 'function') {
    if (updates.handler && updates.handler !== r.handler) notifyUser(updates.handler, '🔧 Job reassigned to you', updates.workType.replace(/_/g,' ') + ' — ' + updates.location, eId);
    if (updates.status && updates.status !== r.status) notifyUser(r.requestor, '📋 Your request was updated', 'Status changed to: ' + updates.status, eId);
  }
}

function dTask(id){
  const _r=DATA.find(x=>String(x.id)===String(id));
  try{ if(typeof logAudit==='function') logAudit('job.deleted', `Job deleted: ${_r?.workType?.replace(/_/g,' ')||''} at ${_r?.location||''}`, 'warning', 'job', id); }catch(_){}
  id=String(id);
  if(!confirm('Delete this task? This action cannot be undone.'))return;
  fbDeleteJob(id);
  if(!FB_READY){DATA=DATA.filter(x=>String(x.id)!==id);fData=fData.filter(x=>String(x.id)!==id);}
  fillDrops();bTKpis();rTbl();rReady=false;toast('Task deleted','i');
}

// ═══════════════════════════════════════════════
// ADD TASK — auto sets In Progress
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// IN PROGRESS — KANBAN + TABLE
// ═══════════════════════════════════════════════
function renderInProgress(){
  const ip=DATA.filter(r=>r.status==='In Progress'||r.status==='In Progress - Contractor');
  const pend=DATA.filter(r=>r.status==='Pending');
  const badge=document.getElementById('ip-count-badge');
  if(badge)badge.textContent=`${ip.length} active tasks`;

  // Kanban columns: Pending → In Progress → In Progress - Contractor
  const cols=[
    {key:'Pending',label:'Pending assignment',color:'var(--purple)',bg:'rgba(168,124,240,.12)',items:pend},
    {key:'In Progress',label:'In progress',color:'var(--blue)',bg:'rgba(85,153,245,.12)',items:DATA.filter(r=>r.status==='In Progress')},
    {key:'In Progress - Contractor',label:'Contractor',color:'var(--amber)',bg:'rgba(240,166,46,.12)',items:DATA.filter(r=>r.status==='In Progress - Contractor')},
  ];
  const board=document.getElementById('kanban-board');
  board.innerHTML=cols.map(col=>`
    <div class="kanban-col">
      <div class="kanban-col-hd">
        <span class="kanban-col-title" style="color:${col.color}">${col.label}</span>
        <span class="kanban-count" style="background:${col.color}">${col.items.length}</span>
      </div>
      ${col.items.length?col.items.map(r=>`
        <div class="kanban-card" onclick="vTask('${r.id}')">
          <div class="kc-top">
            <span class="kc-id">#${r.id}</span>
            ${pbadge(r.priority)}
          </div>
          <div class="kc-title">${r.workType.replace(/_/g,' ')} — ${r.subType}</div>
          <div class="kc-meta">${r.area.replace(/_/g,' ')} · ${r.location}</div>
          <div class="kc-foot">
            <svg viewBox="0 0 16 16" fill="none" style="width:11px;height:11px;color:var(--t3)"><circle cx="8" cy="5" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M3 13c0-2.761 2.239-4 5-4s5 1.239 5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            <span style="font-size:11px;color:var(--t2)">${r.handler}</span>
            <span style="margin-left:auto;font-size:10.5px;color:var(--t3);font-family:var(--mono)">${fds(r.date)}</span>
          </div>
        </div>`).join(''):`<div class="empty-state" style="padding:24px 10px"><svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg><p>No tasks</p></div>`}
    </div>`).join('');

  // Full list table
  const allActive=[...pend,...ip];
  const ipBody=document.getElementById('ip-body');
  if(ipBody)ipBody.innerHTML=allActive.length?allActive.map(r=>`<tr>
    <td>${fds(r.date)}</td><td class="td-h">${r.requestor}</td><td>${r.handler}</td>
    <td>${r.workType.replace(/_/g,' ')}</td><td>${r.subType}</td>
    <td>${r.area.replace(/_/g,' ')}</td><td>${r.location}</td>
    <td title="${r.details}" style="color:var(--t2)">${r.details}</td>
    <td>${sbadge(r.status)}</td><td>${pbadge(r.priority)}</td>
    <td><button class="btn btn-o btn-xs" onclick="vTask('${r.id}')" style="padding:3px 5px"><svg viewBox="0 0 16 16" fill="none" style="width:11px;height:11px"><circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg></button>
    ${currentUser&&currentUser.role!=='requester'?`<button class="btn btn-o btn-xs" onclick="eTask('${r.id}')" style="padding:3px 5px;margin-left:3px"><svg viewBox="0 0 16 16" fill="none" style="width:11px;height:11px"><path d="M11 2l3 3-9 9H2v-3L11 2z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`:''}</td>
  </tr>`).join(''):`<tr><td colspan="11" style="text-align:center;padding:36px;color:var(--t2)">No active tasks at the moment.</td></tr>`;
}

// ═══════════════════════════════════════════════
// JOB REQUEST PORTAL
// ═══════════════════════════════════════════════
function setReqFilter(f){
  window._reqStatusFilter=f;
  renderRequestPage();
}

function renderRequestPage(){
  // Update locked requestor display with current user info
  if(currentUser){
    const nameEl = document.getElementById('jq-rq-display');
    const roleEl = document.getElementById('jq-rq-role');
    const hiddenEl = document.getElementById('jq-rq');
    if(nameEl) nameEl.textContent = currentUser.name || currentUser.email || 'Unknown';
    if(roleEl){
      const roleLabel = (typeof ROLE_LABELS !== 'undefined' && ROLE_LABELS[currentUser.role]) ? ROLE_LABELS[currentUser.role] : (currentUser.role || 'User');
      roleEl.textContent = roleLabel;
    }
    if(hiddenEl) hiddenEl.value = currentUser.name || currentUser.email || '';
  }
  if(typeof refreshLucide === 'function') setTimeout(refreshLucide, 0);
  const u=currentUser;
  if(!u) return; // guard — Firebase not ready yet
  const heroSub=document.getElementById('request-hero-sub');
  if(heroSub)heroSub.textContent=u.role==='requester'
    ?`Logged in as ${u.name}. Once submitted, your request will be automatically assigned and you can track its progress below.`
    :`Managing job requests. Pending requests can be assigned and actioned from here.`;

  // Stats
  const myReqs=u.role==='requester'
    ? DATA.filter(r=>
        r.requestor===u.name ||
        (u.email && r.createdBy===u.email) ||
        (u.uid && r.createdByUid===u.uid)
      )
    : DATA;
  const pending=myReqs.filter(r=>r.status==='Pending').length;
  const inprog=myReqs.filter(r=>r.status==='In Progress'||r.status==='In Progress - Contractor').length;
  const done=myReqs.filter(r=>r.status==='Completed').length;
  const stats=document.getElementById('req-stats');
  if(stats)stats.innerHTML=[
    {l:'Pending',v:pending,s:'Awaiting assignment',c:'var(--purple)'},
    {l:'In progress',v:inprog,s:'Being actioned',c:'var(--blue)'},
    {l:'Completed',v:done,s:'Resolved',c:'var(--g)'},
  ].map(x=>`<div class="request-status-card"><div class="rsc-label" style="color:${x.c}">${x.l}</div><div class="rsc-count" style="color:${x.c}">${x.v}</div><div class="rsc-sub">${x.s}</div></div>`).join('');

  // My requests list with status filter
  const myAllReqs = u.role==='requester'
    ? DATA.filter(r=>
        r.requestor===u.name ||
        (u.email && r.createdBy===u.email) ||
        (u.username && r.createdBy===u.username) ||
        (u.uid && r.createdByUid===u.uid) ||
        (u.id && r.createdByUid===String(u.id))
      )
    : DATA;

  // Apply status filter for requesters (default = 'all')
  if(!window._reqStatusFilter) window._reqStatusFilter='all';
  const f=window._reqStatusFilter;
  const shown = (u.role==='requester' && f!=='all')
    ? myAllReqs.filter(r=>{
        if(f==='pending') return r.status==='Pending';
        if(f==='inprog')  return r.status==='In Progress'||r.status==='In Progress - Contractor';
        if(f==='done')    return r.status==='Completed';
        return true;
      })
    : myAllReqs;

  // Sort newest first
  shown.sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const list=document.getElementById('my-requests-list');
  const countBadge=document.getElementById('my-req-count');
  if(countBadge)countBadge.textContent=(u.role==='requester'?'My requests':'Pending requests')+' ('+shown.length+')';
  if(!list)return;

  // Status filter buttons for requesters only
  let filterHtml='';
  if(u.role==='requester'){
    const cP=myAllReqs.filter(r=>r.status==='Pending').length;
    const cI=myAllReqs.filter(r=>r.status==='In Progress'||r.status==='In Progress - Contractor').length;
    const cD=myAllReqs.filter(r=>r.status==='Completed').length;
    filterHtml=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;padding:0 4px">
      <button class="btn ${f==='all'?'btn-g':'btn-o'} btn-sm" onclick="setReqFilter('all')">All (${myAllReqs.length})</button>
      <button class="btn ${f==='pending'?'btn-g':'btn-o'} btn-sm" onclick="setReqFilter('pending')">Pending (${cP})</button>
      <button class="btn ${f==='inprog'?'btn-g':'btn-o'} btn-sm" onclick="setReqFilter('inprog')">In progress (${cI})</button>
      <button class="btn ${f==='done'?'btn-g':'btn-o'} btn-sm" onclick="setReqFilter('done')">Completed (${cD})</button>
    </div>`;
  }

  if(!shown.length){list.innerHTML=filterHtml+`<div class="empty-state"><svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg><p>${u.role==='requester'?(f==='all'?'No requests submitted yet.':'No requests with this status.'):'No pending requests.'}</p><small>${u.role==='requester'&&f==='all'?'Use the form above to submit your first request.':''}</small></div>`;return;}
  list.innerHTML=filterHtml+shown.map(r=>`<div class="my-request-item" onclick="vTask('${r.id}')" style="cursor:pointer">
    <div class="mri-top">
      <span class="mri-id">#${r.id}</span>
      <span class="mri-type">${r.workType.replace(/_/g,' ')} — ${r.subType}</span>
      <span class="mri-date">${fd(r.date)}</span>
    </div>
    <div class="mri-desc">${r.details}</div>
    <div class="mri-foot">
      ${sbadge(r.status)}
      <span class="mri-area">${r.area.replace(/_/g,' ')} · ${r.location}</span>
      ${r.status!=='Pending'?`<span style="font-size:11px;color:var(--t2);margin-left:auto">Handler: ${r.handler}</span>`:''}
      ${u.role==='admin'&&r.status==='Pending'?`<button class="btn btn-b btn-xs" onclick="assignRequest('${r.id}')" style="margin-left:auto">Assign</button>`:''}
    </div>
  </div>`).join('');
}

function submitJobRequest(){
  // SECURITY: Requestor is ALWAYS the logged-in user — no spoofing possible
  if(!currentUser){ toast('You must be signed in to submit a request.','e'); return; }

  const loc = document.getElementById('jq-lc').value.trim();
  const det = document.getElementById('jq-de').value.trim();
  if(!loc || !det){ toast('Please fill in all required fields.','e'); return; }

  const wt = document.getElementById('jq-wt').value;
  const handler = (typeof AUTO_ASSIGN !== 'undefined' && AUTO_ASSIGN[wt]) ? AUTO_ASSIGN[wt] : HNDS[0];

  // Requestor = logged-in user (locked, no override)
  const req = currentUser.name || currentUser.email || 'Unknown';

  // Allow custom date if entered, default to today
  const dtField = document.getElementById('jq-dt');
  const jobDate = (dtField && dtField.value) ? dtField.value : getTODAY();

  const t = {
    id: nid++,
    date: jobDate,
    requestor:    req,
    handler:      handler,
    workType:     wt,
    subType:      document.getElementById('jq-st').value,
    area:         document.getElementById('jq-ar').value,
    location:     loc,
    details:      det,
    status:       'In Progress',
    priority:     document.getElementById('jq-pr').value,
    completion:   '',
    createdBy:    currentUser.email || currentUser.username || req,
    createdByUid: currentUser.uid || currentUser.id || '',
    createdAt:    getTODAY(),
    submittedAt:  (typeof nowISO === 'function') ? nowISO() : new Date().toISOString(),
    assignedAt:   (typeof nowISO === 'function') ? nowISO() : new Date().toISOString()
  };

  fbAddJob(t);
  try{ if(typeof logAudit==='function') logAudit('job.created', `Request submitted: ${t.workType.replace(/_/g,' ')} at ${t.location} (by ${req}, assigned to ${handler})`, 'info', 'job', t.id); }catch(_){}
  if(!FB_READY){ fillDrops(); rReady=false; }
  clrJQ();
  renderRequestPage();
  toast(`Request submitted — assigned to ${handler}`);
  // Notify handler of new job request
  if (typeof notifyUser === 'function') notifyUser(handler, '📥 New job request', t.workType.replace(/_/g,' ') + ' — ' + t.location + ' (' + t.area.replace(/_/g,' ') + ')', t.id);
}

function assignRequest(id){
  id=String(id);
  const r=DATA.find(x=>String(x.id)===id);if(!r)return;
  const updates={
    handler:AUTO_ASSIGN[r.workType]||HNDS[0],
    status:'In Progress'
  };
  fbUpdateJob(id,updates);
  if(!FB_READY) Object.assign(r,updates);
  fillDrops();renderRequestPage();rReady=false;
  toast(`Request assigned to ${updates.handler}`);
  // Notify assigned handler
  if (typeof notifyUser === 'function') notifyUser(updates.handler, '🔧 Job assigned to you', r.workType.replace(/_/g,' ') + ' — ' + r.location, id);
}

function clrJQ(){
  ['jq-lc','jq-de'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}

// ═══════════════════════════════════════════════

// EMAIL (email page buttons)
// ═══════════════════════════════════════════════

// ── EmailJS credentials ──────────────────────
const EJS_SERVICE  = 'service_cw4vy2r';
const EJS_TEMPLATE = 'template_0igvo38';
const EJS_KEY      = 'hLesnjx-SaT9SBUTQ';

// Initialise EmailJS once
(function(){ try{ emailjs.init(EJS_KEY); }catch(e){ console.warn('EmailJS init failed:',e.message); } })();

// ── Build email template params from data ────
function buildEmailParams(toEmail, ccEmail, periodType, customMsg){
  // Filter data by period
  let d = DATA;
  const now = new Date(TODAY);
  if(periodType==='daily')       d = DATA.filter(r=>r.date===TODAY);
  else if(periodType==='weekly'){ const cut=new Date(now);cut.setDate(cut.getDate()-7);d=DATA.filter(r=>new Date(r.date)>=cut); }

  const total     = d.length;
  const completed = d.filter(r=>r.status==='Completed').length;
  const inProg    = d.filter(r=>r.status==='In Progress'||r.status==='In Progress - Contractor').length;
  const pending   = d.filter(r=>r.status==='Pending').length;
  const urgent    = d.filter(r=>r.priority==='Urgent').length;
  const rate      = total ? Math.round(completed/total*100) : 0;
  const periodLabel = periodType==='daily'?'Today':periodType==='weekly'?'Last 7 days':'All time';
  const genDate   = new Date().toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

  // Build plain-text task table for the email
  const taskRows = d.slice(0,50).map((r,i)=>
    `${i+1}. [${r.date}] ${r.requestor} → ${r.handler} | ${r.workType.replace(/_/g,' ')} | ${r.location||'—'} | ${r.status} | ${r.priority}`
  ).join('\n');
  const taskTable = total
    ? taskRows + (total>50 ? `\n\n... and ${total-50} more tasks. Export CSV for full list.` : '')
    : 'No tasks for this period.';

  return {
    to_email:    toEmail,
    email:       toEmail,       // reply-to in template
    name:        currentUser?.name || 'MaintainPro',
    sender_name: currentUser?.name || 'MaintainPro',
    period:      periodLabel,
    generated:   genDate,
    total:       String(total),
    completed:   String(completed),
    in_progress: String(inProg),
    pending:     String(pending),
    urgent:      String(urgent),
    rate:        String(rate),
    message:     customMsg || '—',
    task_table:  taskTable,
    ...(ccEmail ? { cc: ccEmail } : {}),
  };
}

// ── Modal "Send report" button ───────────────
async function doEmail(){
  const em  = document.getElementById('eml-to').value.trim();
  const cc  = document.getElementById('eml-cc').value.trim();
  const typ = document.getElementById('eml-type').value;
  const msg = document.getElementById('eml-msg').value.trim();

  if(!em||!em.includes('@')){ toast('Please enter a valid email address.','e'); return; }

  const btn = document.querySelector('#m-email .btn-g');
  if(btn){ btn.textContent='Sending…'; btn.disabled=true; }

  try{
    const params = buildEmailParams(em, cc, typ, msg);
    await emailjs.send(EJS_SERVICE, EJS_TEMPLATE, params);
    cm('m-email');
    toast(`✅ Report sent to ${em}`,'s');
  } catch(err){
    console.error('EmailJS send failed:',err);
    toast('Failed to send email. Check your connection and try again.','e');
  } finally{
    if(btn){ btn.textContent='Send report'; btn.disabled=false; }
  }
}

// ── Email page "Send now" button ─────────────
async function sendFromPage(){
  const em  = document.getElementById('cfg-to').value.trim();
  const cc  = document.getElementById('cfg-cc').value.trim();
  const typ = document.getElementById('cfg-type').value;
  const msg = document.getElementById('cfg-msg').value.trim();

  if(!em||!em.includes('@')){ toast('Please enter a manager email address first.','e'); return; }

  const btn = document.querySelector('#page-email .btn-g');
  if(btn){ btn.textContent='Sending…'; btn.disabled=true; }

  try{
    const params = buildEmailParams(em, cc, typ, msg);
    await emailjs.send(EJS_SERVICE, EJS_TEMPLATE, params);
    toast(`✅ Report sent to ${em}`,'s');
  } catch(err){
    console.error('EmailJS send failed:',err);
    toast('Failed to send email. Check your connection and try again.','e');
  } finally{
    if(btn){ btn.textContent='Send now'; btn.disabled=false; }
  }
}
function prevRpt(){expPDF();}

// ═══════════════════════════════════════════════
// USER MANAGEMENT PAGE — full CRUD
// ═══════════════════════════════════════════════
function renderUserPage(){
  const lbl=document.getElementById('user-count-label');
  if(lbl) lbl.textContent=`${USERS.length} account${USERS.length!==1?'s':''} · ${USERS.filter(u=>u.lastLogin).length} have logged in`;
  const list=document.getElementById('user-list');
  if(!list) return;
  const roleOrder={admin:0,staff:1,contractor:2,requester:3};
  const sorted=[...USERS].sort((a,b)=>(roleOrder[a.role]??9)-(roleOrder[b.role]??9));
  list.innerHTML=sorted.map(u=>`
  <div class="user-card" style="margin-bottom:8px">
    <div class="user-card-av" style="background:${ROLE_COLORS[u.role]||'#667550'}">${u.initials}</div>
    <div class="user-card-info">
      <div class="user-card-name">
        ${u.name}
        ${u.id===currentUser.id?'<span style="font-size:9.5px;background:var(--g3);color:var(--g);padding:2px 6px;border-radius:4px;margin-left:4px">You</span>':''}
        ${u.lastLogin?`<span style="font-size:9.5px;color:var(--t3);margin-left:4px">● Online recently</span>`:''}
      </div>
      <div class="user-card-meta">
        ${u.email||(u.username?'@'+u.username:'(no email)')} · ${u.dept||'—'} ·
        <span class="role-badge rb-${u.role==='admin'?'admin':u.role==='staff'?'staff':u.role==='contractor'?'req':'req'}"
          style="background:${ROLE_COLORS[u.role]}22;color:${ROLE_COLORS[u.role]}">${ROLE_LABELS[u.role]||u.role}</span>
      </div>
      <div style="font-size:10px;color:var(--t3);margin-top:2px">
        Last login: ${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Never'}
      </div>
    </div>
    <div class="user-card-actions" style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
      <button class="btn btn-b btn-sm" onclick="editUserModal('${u.id}')">
        <svg viewBox="0 0 14 14" fill="none"><path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Edit
      </button>
      ${u.id!==currentUser.id?`<button class="btn ${u.disabled?'btn-g':'btn-r'} btn-sm" onclick="deleteUser('${u.id}')">
        <svg viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2h4v1.5M4.5 3.5v7h5v-7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Remove
      </button>`:''}
    </div>
  </div>`).join('');
}

// ═══════════════════════════════════════════════
// CONTRACTOR PANEL — only shows their assigned jobs
// ═══════════════════════════════════════════════
function renderContractorPanel(){
  const el=document.getElementById('page-contractor'); if(!el) return;
  const myName=currentUser.name;
  // Contractor sees jobs assigned to "Contractor" handler OR their own name
  const myJobs=DATA.filter(r=>(r.handler==='Contractor'||r.handler===myName)&&r.status!=='Completed');
  const doneJobs=DATA.filter(r=>(r.handler==='Contractor'||r.handler===myName)&&r.status==='Completed');

  el.innerHTML=`
  <div style="background:rgba(240,166,46,.08);border:1px solid rgba(240,166,46,.2);border-radius:var(--r2);padding:16px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
    <svg viewBox="0 0 16 16" fill="none" style="width:20px;height:20px;color:var(--amber);flex-shrink:0"><rect x="2" y="6" width="12" height="8" rx="1" stroke="currentColor" stroke-width="1.4"/><path d="M5 6V4a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--t0)">Contractor Panel — ${currentUser.name}</div>
      <div style="font-size:11.5px;color:var(--t2);margin-top:2px">Showing all jobs assigned to you. Update status to keep the team informed.</div>
    </div>
  </div>

  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi"><div class="kpi-bar" style="background:var(--amber)"></div><div class="kpi-lbl">Active jobs</div><div class="kpi-val">${myJobs.length}</div></div>
    <div class="kpi"><div class="kpi-bar" style="background:var(--red)"></div><div class="kpi-lbl">Urgent</div><div class="kpi-val">${myJobs.filter(j=>j.priority==='Urgent').length}</div></div>
    <div class="kpi"><div class="kpi-bar" style="background:var(--g)"></div><div class="kpi-lbl">Completed</div><div class="kpi-val">${doneJobs.length}</div></div>
    <div class="kpi"><div class="kpi-bar" style="background:var(--blue)"></div><div class="kpi-lbl">Total assigned</div><div class="kpi-val">${myJobs.length+doneJobs.length}</div></div>
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="card-hd"><span class="card-t">Active assigned jobs</span><span class="card-badge">${myJobs.length} jobs</span></div>
    ${myJobs.length===0?`<div class="empty-state"><svg viewBox="0 0 16 16" fill="none"><path d="M5 8l2 2 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/></svg><p>No active jobs assigned to you</p></small>Great work — nothing pending!</small></div>`:
    myJobs.map(j=>`
      <div style="border:1px solid var(--b0);border-radius:var(--r);padding:13px 15px;margin-bottom:8px;background:var(--s2);transition:border-color .13s" onmouseover="this.style.borderColor='var(--b3)'" onmouseout="this.style.borderColor='var(--b0)'">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;flex-wrap:wrap">
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--g);margin-bottom:3px">${j.workType.replace(/_/g,' ')} — ${j.subType}</div>
            <div style="font-size:11px;color:var(--t2)">${j.area.replace(/_/g,' ')} · ${j.location}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${sbadge(j.status)} ${pbadge(j.priority)}
          </div>
        </div>
        <div style="font-size:12.5px;color:var(--t1);margin-bottom:10px;line-height:1.5">${j.details}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span style="font-size:10.5px;color:var(--t3)">Requested by ${j.requestor} · ${fd(j.date)}</span>
          <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
            ${j.status!=='In Progress - Contractor'?`<button class="btn btn-a btn-sm" onclick="setContractorStatus('${j.id}','In Progress - Contractor')">Mark active</button>`:''}
            <button class="btn btn-g btn-sm" onclick="setContractorStatus('${j.id}','Completed')">
              <svg viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Mark complete
            </button>
          </div>
        </div>
      </div>`).join('')}
  </div>

  <div class="card">
    <div class="card-hd"><span class="card-t">Recently completed</span><span class="card-badge">${doneJobs.length} completed</span></div>
    ${doneJobs.slice(0,5).map(j=>`
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b0)">
        <div style="width:7px;height:7px;border-radius:50%;background:var(--g);flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;color:var(--t0);font-weight:500">${j.workType.replace(/_/g,' ')} — ${j.location}</div>
          <div style="font-size:10.5px;color:var(--t2)">${fd(j.completion||j.date)}</div>
        </div>
        ${sbadge(j.status)}
      </div>`).join('')||'<div style="padding:16px 0;text-align:center;color:var(--t3);font-size:12px">No completed jobs yet</div>'}
  </div>`;
}

function setContractorStatus(id,status){
  const r=DATA.find(x=>x.id===id); if(!r) return;
  r.status=status;
  if(status==='Completed') r.completion=TODAY;
  renderContractorPanel();
  updateNavPills();
  fillDrops();
  toast(status==='Completed'?'Job marked complete ✓':'Job status updated','s');
}

// ═══════════════════════════════════════════════
// PERMISSIONS PAGE — admin toggles per role
// ═══════════════════════════════════════════════
function renderPermissionsPage(){
  const el=document.getElementById('page-permissions'); if(!el) return;
  const roles=['staff','contractor','requester'];
  const roleColors={staff:ROLE_COLORS.staff,contractor:ROLE_COLORS.contractor,requester:ROLE_COLORS.requester};

  el.innerHTML=`
  <div style="background:rgba(232,83,74,.07);border:1px solid rgba(232,83,74,.18);border-radius:var(--r2);padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:12px">
    <svg viewBox="0 0 16 16" fill="none" style="width:18px;height:18px;color:var(--red);flex-shrink:0"><rect x="4" y="7" width="8" height="7" rx="1" stroke="currentColor" stroke-width="1.4"/><path d="M4 7V5a4 4 0 018 0v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
    <div style="font-size:13px;color:var(--t1)"><strong style="color:var(--t0)">Role permissions</strong> — Toggle what each role can access. Changes apply immediately. Admin always has full access.</div>
  </div>

  <div class="tbl-wrap">
  <table style="min-width:500px">
    <thead>
      <tr>
        <th style="text-align:left;width:260px">Permission</th>
        ${roles.map(r=>`<th style="text-align:center;width:110px"><span style="color:${roleColors[r]}">${ROLE_LABELS[r]}</span></th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${Object.entries(ALL_PERMS).map(([key,label])=>`
        <tr>
          <td style="font-size:12px;color:var(--t1);padding:9px 12px">${label}</td>
          ${roles.map(r=>`
            <td style="text-align:center;padding:7px">
              <button
                onclick="togglePerm('${r}','${key}',this)"
                style="width:38px;height:22px;border-radius:99px;border:none;cursor:pointer;position:relative;transition:background .2s;background:${ROLE_PERMS[r][key]?'var(--g)':'var(--b2)'}"
                title="${ROLE_PERMS[r][key]?'Enabled — click to disable':'Disabled — click to enable'}"
              >
                <span style="position:absolute;top:3px;left:${ROLE_PERMS[r][key]?'19':'3'}px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;display:block"></span>
              </button>
            </td>`).join('')}
        </tr>`).join('')}
    </tbody>
  </table>
  </div>

  <div style="margin-top:16px;padding:12px 14px;background:var(--g3);border:1px solid var(--g4);border-radius:var(--r);font-size:11.5px;color:var(--t1);line-height:1.7">
    <strong style="color:var(--t0)">How permissions work:</strong> Each toggle grants or removes access to a feature for that role. 
    Staff and Contractors see only the navigation items they have permission for. 
    Requestors are always limited to submitting and tracking their own jobs.
    <strong style="color:var(--t0)"> Note:</strong> Disabling permissions takes effect on next navigation.
  </div>`;
}

function togglePerm(role,perm,btn){
  if(role==='admin'){ toast('Admin permissions cannot be changed.','e'); return; }
  ROLE_PERMS[role][perm]=!ROLE_PERMS[role][perm];
  try{ if(typeof logAudit==='function') logAudit('permission.toggled', `Role '${role}' permission '${perm}' set to ${ROLE_PERMS[role][perm]}`, 'warning', 'setting', role); }catch(_){}
  const enabled=ROLE_PERMS[role][perm];
  btn.style.background=enabled?'var(--g)':'var(--b2)';
  btn.querySelector('span').style.left=enabled?'19px':'3px';
  btn.title=enabled?'Enabled — click to disable':'Disabled — click to enable';
  // If changing current user's own role, rebuild nav
  if(role===currentUser.role) buildSidebarNav();
  toast(`${ROLE_LABELS[role]} — "${ALL_PERMS[perm]}" ${enabled?'enabled':'disabled'}`,'i');
}

// ═══════════════════════════════════════════════
// ADMIN — FIELD MANAGEMENT
// ═══════════════════════════════════════════════
function switchAdminTab(panel,el){
  document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('apanel-'+panel).classList.add('on');
  renderAdminPanels();
}
function renderAdminPanels(){
  if(!currentUser||currentUser.role!=='admin'){
    toast('Access denied — Field management is admin-only.','e');
    go('dash',null);
    return;
  }
  renderWorkTypes();renderRequestors();renderHandlers();renderAreas();renderSubTypes();
}

function _requireAdmin(action){
  if(!currentUser||currentUser.role!=='admin'){
    toast(`Access denied — ${action||'this action'} is admin-only.`,'e');
    return false;
  }
  return true;
}

function renderWorkTypes(){
  const wts=Object.keys(SUBTYPES);
  document.getElementById('wt-count').textContent=wts.length+' types';
  document.getElementById('wt-list').innerHTML=wts.map(w=>`<li class="field-item"><span class="field-item-label">${w.replace(/_/g,' ')}</span><span class="field-item-meta">${SUBTYPES[w].length} sub types</span><div class="field-item-actions"><button class="field-delete-btn" onclick="delWorkType('${w}')"><svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2h4v2M5 4v8h6V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></li>`).join('');
}
function addWorkType(){
  if(!_requireAdmin('add work type')) return;
  const inp=document.getElementById('wt-new');
  const val=inp.value.trim().replace(/\s+/g,'_');
  if(!val){toast('Please enter a work type name.','e');return;}
  if(SUBTYPES[val]){toast('This work type already exists.','e');return;}
  SUBTYPES[val]=['Other'];
  inp.value='';
  fillDrops();
  renderAdminPanels();
  rReady=false;
  toast('Saving work type…','i');
  fbSaveFields().then(()=>{
    toast(`Work type "${val.replace(/_/g,' ')}" saved ✓`,'s');
  }).catch(()=>{
    toast('Failed to save work type. Check your connection.','e');
  });
}
function delWorkType(key){
  if(!_requireAdmin('delete work type')) return;
  if(Object.keys(SUBTYPES).length<=1){toast('At least one work type must remain.','e');return;}
  if(!confirm(`Remove work type "${key.replace(/_/g,' ')}"?`)) return;
  delete SUBTYPES[key];
  fillDrops();
  renderAdminPanels();
  rReady=false;
  toast('Saving changes…','i');
  fbSaveFields().then(()=>{
    toast('Work type removed ✓','s');
  }).catch(()=>{
    toast('Failed to remove work type. Check your connection.','e');
  });
}

function renderSubTypes(){
  const container=document.getElementById('subtype-list');
  container.innerHTML=Object.entries(SUBTYPES).map(([wt,subs])=>`<div class="subtype-section"><div class="subtype-wt-label">${wt.replace(/_/g,' ')}<button class="subtype-wt-expand" onclick="toggleSubSection('ss-${wt}')">${subs.length} sub types</button></div><div class="subtype-items" id="ss-${wt}">${subs.map(s=>`<span class="subtype-chip">${s}<button onclick="delSubType('${wt}','${s.replace(/'/g,"\\'")}')"><svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></span>`).join('')}<input type="text" placeholder="Add…" style="padding:4px 8px;font-size:11px;background:var(--s2);border:1px dashed var(--b2);border-radius:5px;color:var(--t0);width:100px;font-family:var(--font)" onkeydown="if(event.key==='Enter')addSubType('${wt}',this)"></div></div>`).join('');
}
function toggleSubSection(id){const el=document.getElementById(id);if(el)el.classList.toggle('open');}
function addSubType(wt,inp){
  if(!_requireAdmin('add sub type')) return;
  const val=inp.value.trim();
  if(!val) return;
  if(SUBTYPES[wt].includes(val)){toast('Already exists.','e');return;}
  SUBTYPES[wt].push(val);
  inp.value='';
  renderAdminPanels();
  rReady=false;
  toast('Saving sub type…','i');
  fbSaveFields().then(()=>{
    toast(`Sub type "${val}" saved ✓`,'s');
  }).catch(()=>{
    toast('Failed to save sub type. Check your connection.','e');
  });
}
function delSubType(wt,sub){
  if(!_requireAdmin('delete sub type')) return;
  if(SUBTYPES[wt].length<=1){toast('At least one sub type must remain.','e');return;}
  SUBTYPES[wt]=SUBTYPES[wt].filter(s=>s!==sub);
  renderAdminPanels();
  rReady=false;
  toast('Saving changes…','i');
  fbSaveFields().then(()=>{
    toast('Sub type removed ✓','s');
  }).catch(()=>{
    toast('Failed to remove sub type. Check your connection.','e');
  });
}

function renderRequestors(){document.getElementById('rq-count').textContent=REQS.length+' requestors';document.getElementById('rq-list').innerHTML=REQS.map(r=>`<li class="field-item"><span class="field-item-label">${r}</span><div class="field-item-actions"><button class="field-delete-btn" onclick="delRequestor('${r.replace(/'/g,"\\'")}')"><svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2h4v2M5 4v8h6V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></li>`).join('');}
function addRequestor(){toast('Requestors are added by creating user accounts with the Requestor role.','i');}
function delRequestor(name){toast('Requestors are managed via the Users page. Delete the user account to remove a requestor.','i');}

function renderHandlers(){document.getElementById('hd-count').textContent=HNDS.length+' handlers';document.getElementById('hd-list').innerHTML=HNDS.map(h=>`<li class="field-item"><span class="field-item-label">${h}</span><div class="field-item-actions"><button class="field-delete-btn" onclick="delHandler('${h.replace(/'/g,"\\'")}')"><svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2h4v2M5 4v8h6V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></li>`).join('');}
function addHandler(){
  if(!_requireAdmin('add handler')) return;
  const inp=document.getElementById('hd-new');
  const val=inp.value.trim();
  if(!val){toast('Please enter a handler name.','e');return;}
  if(HNDS.includes(val)){toast('Already exists.','e');return;}
  HNDS.push(val);
  inp.value='';
  fillDrops();
  renderAdminPanels();
  rReady=false;
  toast('Saving handler…','i');
  fbSaveFields().then(()=>{
    toast(`Handler "${val}" saved ✓`,'s');
  }).catch(()=>{
    toast('Failed to save handler. Check your connection.','e');
  });
}
function delHandler(name){
  if(!_requireAdmin('delete handler')) return;
  if(HNDS.length<=1){toast('At least one handler must remain.','e');return;}
  if(!confirm(`Remove handler "${name}"?`)) return;
  HNDS=HNDS.filter(h=>h!==name);
  fillDrops();
  renderAdminPanels();
  rReady=false;
  toast('Saving changes…','i');
  fbSaveFields().then(()=>{
    toast('Handler removed ✓','s');
  }).catch(()=>{
    toast('Failed to remove handler. Check your connection.','e');
  });
}

function renderAreas(){document.getElementById('ar-count').textContent=AREAS.length+' areas';document.getElementById('ar-list').innerHTML=AREAS.map(a=>`<li class="field-item"><span class="field-item-label">${a.replace(/_/g,' ')}</span><span class="field-item-meta" style="font-family:var(--mono);font-size:10px">${a}</span><div class="field-item-actions"><button class="field-delete-btn" onclick="delArea('${a.replace(/'/g,"\\'")}')"><svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2h4v2M5 4v8h6V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></li>`).join('');}
function addArea(){
  if(!_requireAdmin('add area')) return;
  const inp=document.getElementById('ar-new');
  const val=inp.value.trim();
  if(!val){toast('Please enter an area name.','e');return;}
  if(AREAS.includes(val)){toast('Already exists.','e');return;}
  AREAS.push(val);
  inp.value='';
  fillDrops();
  renderAdminPanels();
  rReady=false;
  toast('Saving area…','i');
  fbSaveFields().then(()=>{
    toast(`Area "${val.replace(/_/g,' ')}" saved ✓`,'s');
  }).catch(()=>{
    toast('Failed to save area. Check your connection.','e');
  });
}
function delArea(name){
  if(!_requireAdmin('delete area')) return;
  if(AREAS.length<=1){toast('At least one area must remain.','e');return;}
  if(!confirm(`Remove area "${name.replace(/_/g,' ')}"?`)) return;
  AREAS=AREAS.filter(a=>a!==name);
  fillDrops();
  renderAdminPanels();
  rReady=false;
  toast('Saving changes…','i');
  fbSaveFields().then(()=>{
    toast('Area removed ✓','s');
  }).catch(()=>{
    toast('Failed to remove area. Check your connection.','e');
  });
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
function init(){
  // Loading screen is now hidden by firebase.js after data is ready (not here)
  function updateClock(){
    const el=document.getElementById('tb-dt');if(!el)return;
    const now=new Date();
    el.textContent=now.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'})
      +' '+now.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'});
  }
  updateClock();
  if(window._clockInterval)clearInterval(window._clockInterval);
  window._clockInterval=setInterval(updateClock,1000);
  fillDrops();
  updateNavPills();

  // Save session for refresh persistence
  try{ sessionStorage.setItem('mp_session', JSON.stringify({id:currentUser.id,username:currentUser.username,role:currentUser.role})); }catch(e){}

  // Role-based landing page
  const landing={admin:'dash',staff:'dash',contractor:'contractor',requester:'request'};
  const landPage=landing[currentUser.role]||'dash';
  // For contractor / requester, show/hide bottom nav items
  if(currentUser.role==='contractor'||currentUser.role==='requester'){
    ['mbn-dash','mbn-tasks'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  }
  go(landPage, document.getElementById('nb-'+landPage));

  // Urgent flag
  const urg=DATA.filter(r=>r.priority==='Urgent'&&r.status!=='Completed').length;
  if(urg>0){const p=document.getElementById('nb-ip-count');if(p)p.classList.add('red');}

  // Auto-refresh every 60 seconds
  if(window._refreshInterval) clearInterval(window._refreshInterval);
  window._refreshInterval=setInterval(()=>{
    fillDrops(); updateNavPills();
    const active=document.querySelector('.page.on');
    if(active){
      const p=active.id.replace('page-','');
      if(p==='dash') rDash();
      else if(p==='inprogress') renderInProgress();
      else if(p==='contractor') renderContractorPanel();
      else if(p==='tasks'){bTKpis();af();}
      else if(p==='request') renderRequestPage();
      else if(p==='rooms'&&typeof renderRoomsBoard==='function') renderRoomsBoard();
  if(p==='audit'&&typeof renderAuditLog==='function') renderAuditLog();
    }
  },60000);
}

// ═══════════════════════════════════════════════
// BOOT — runs after DOM is fully ready
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  // Wire Enter key shortcuts on login form
  const lPass=document.getElementById('l-pass');
  const lUser=document.getElementById('l-user');
  if(lPass) lPass.addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  if(lUser) lUser.addEventListener('keydown', e=>{ if(e.key==='Enter' && lPass) lPass.focus(); });

  // Session restore is handled by firebase.js onAuthStateChanged
  // which runs automatically on every page load for all devices
  // No action needed here — firebase.js will show login or restore session
  window._appStarted = false;
});

// ═══════════════════════════════════════════════
// IN-APP NOTIFICATIONS — Bell + Sound
// ═══════════════════════════════════════════════
let _notifUnsub = null;
let _notifItems = [];

// ── Start listening to notifications for current user ──
function startNotifListener() {
  if (!FB_READY || !currentUser) return;
  if (_notifUnsub) { _notifUnsub(); _notifUnsub = null; }
  const uid = currentUser.uid || currentUser.id;
  _notifUnsub = fbDb.collection('notifications')
    .where('toUid', '==', String(uid))
    .orderBy('sentAt', 'desc')
    .limit(30)
    .onSnapshot(snap => {
      const prev = _notifItems.length;
      _notifItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateNotifBadge();
      renderNotifList();
      // Play sound if new notification arrived
      if (_notifItems.length > prev && prev > 0) playNotifSound();
    }, e => console.warn('Notif listener:', e.message));
}

// ── Stop listener on logout ──
function stopNotifListener() {
  if (_notifUnsub) { _notifUnsub(); _notifUnsub = null; }
  _notifItems = [];
  updateNotifBadge();
}

// ── Update bell badge count ──
function updateNotifBadge() {
  const unread = _notifItems.filter(n => !n.read).length;
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (unread > 0) {
    badge.textContent = unread > 99 ? '99+' : unread;
    badge.style.display = 'block';
    // Animate bell
    const btn = document.getElementById('notif-bell-btn');
    if (btn) { btn.style.animation = 'none'; setTimeout(() => btn.style.animation = '', 10); }
  } else {
    badge.style.display = 'none';
  }
}

// ── Render notification list in panel ──
function renderNotifList() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!_notifItems.length) {
    list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--t3);font-size:13px">No notifications yet</div>';
    return;
  }
  list.innerHTML = _notifItems.map(n => {
    const time = n.sentAt ? new Date(n.sentAt.seconds ? n.sentAt.seconds * 1000 : n.sentAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '';
    const date = n.sentAt ? new Date(n.sentAt.seconds ? n.sentAt.seconds * 1000 : n.sentAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '';
    return `<div onclick="openNotif('${n.id}')" style="padding:12px 16px;border-bottom:1px solid var(--b0);cursor:pointer;background:${n.read ? 'transparent' : 'rgba(110,190,42,.06)'};transition:background .2s" onmouseover="this.style.background='var(--s1)'" onmouseout="this.style.background='${n.read ? 'transparent' : 'rgba(110,190,42,.06)'}'">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="width:8px;height:8px;border-radius:50%;background:${n.read ? 'var(--b2)' : 'var(--g)'};margin-top:5px;flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px;font-weight:${n.read ? '400' : '600'};color:var(--t0);margin-bottom:3px">${n.title || 'Notification'}</div>
          <div style="font-size:11.5px;color:var(--t2);line-height:1.4">${n.body || ''}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:4px">${date} ${time}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Open notification and mark as read ──
function openNotif(id) {
  const n = _notifItems.find(x => x.id === id);
  if (!n) return;
  // Mark as read
  if (!n.read && FB_READY) {
    fbDb.collection('notifications').doc(id).update({ read: true }).catch(() => {});
    n.read = true;
    updateNotifBadge();
    renderNotifList();
  }
  // Navigate to the job if there's a jobId
  if (n.jobId) {
    toggleNotifPanel();
    setTimeout(() => vTask(n.jobId), 200);
  }
}

// ── Mark all as read ──
function markAllNotifsRead() {
  if (!FB_READY) return;
  const unread = _notifItems.filter(n => !n.read);
  unread.forEach(n => {
    fbDb.collection('notifications').doc(n.id).update({ read: true }).catch(() => {});
    n.read = true;
  });
  updateNotifBadge();
  renderNotifList();
  toast('All notifications marked as read', 'i');
}

// ── Toggle notification panel ──
function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const isOpen = panel.style.display === 'flex';
  panel.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) renderNotifList();
}

// ── Close panel on outside click ──
document.addEventListener('click', e => {
  const panel = document.getElementById('notif-panel');
  const bell  = document.getElementById('notif-bell-btn');
  if (panel && panel.style.display === 'flex' && !panel.contains(e.target) && !bell.contains(e.target)) {
    panel.style.display = 'none';
  }
});

// ── Play notification sound ──
function playNotifSound() {
  try {
    // Generate a pleasant ding sound using Web Audio API
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) { console.warn('Sound failed:', e.message); }
}


// ═══════════════════════════════════════════════
// PHASE 1 ENHANCEMENTS
// Animated counters, skeletons, command palette
// ═══════════════════════════════════════════════

// ── KPI counter animation ─────────────────────
// Animates numbers from 0 to their final value smoothly
function animateCounters(scope) {
  scope = scope || document;
  const els = scope.querySelectorAll('.kpi-val:not([data-animated])');
  els.forEach(el => {
    const raw = el.textContent.trim();
    // Skip if it's not a number or has special formatting
    const m = raw.match(/^(\d+)(.*)$/);
    if (!m) return;
    const finalVal = parseInt(m[1], 10);
    const suffix = m[2] || '';
    if (isNaN(finalVal) || finalVal === 0) {
      el.setAttribute('data-animated', '1');
      return;
    }
    el.setAttribute('data-animated', '1');
    el.classList.add('counting');
    const duration = 900;
    const start = performance.now();
    const startVal = 0;
    function step(now) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(startVal + (finalVal - startVal) * eased);
      el.textContent = current + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = finalVal + suffix;
    }
    requestAnimationFrame(step);
  });
}

// Hook into dashboard render — animate after KPIs are rendered
const _origRDash = typeof rDash === 'function' ? rDash : null;
if (_origRDash) {
  window.rDash = function() {
    _origRDash.apply(this, arguments);
    // Trigger counter animation after DOM update
    requestAnimationFrame(() => {
      const kpis = document.querySelectorAll('#d-kpis .kpi-val');
      kpis.forEach(el => el.removeAttribute('data-animated'));
      animateCounters(document.getElementById('d-kpis'));
    });
  };
}

// ── Skeleton loaders ──────────────────────────
function renderKPISkeletons(targetId, count) {
  count = count || 6;
  const el = document.getElementById(targetId);
  if (!el) return;
  let html = '';
  for (let i = 0; i < count; i++) {
    html += '<div class="skel-kpi"><div class="skel skel-line sm" style="margin-bottom:14px"></div><div class="skel skel-line xl"></div><div class="skel skel-line sm" style="margin-top:8px;width:40%"></div></div>';
  }
  el.innerHTML = html;
}

function renderTableSkeleton(targetId, rows) {
  rows = rows || 5;
  const el = document.getElementById(targetId);
  if (!el) return;
  let html = '<div style="padding:6px">';
  for (let i = 0; i < rows; i++) {
    html += '<div style="display:flex;gap:12px;padding:10px 0;align-items:center">';
    html += '<div class="skel skel-circle" style="width:28px;height:28px;flex-shrink:0"></div>';
    html += '<div style="flex:1"><div class="skel skel-line md" style="margin-bottom:6px"></div><div class="skel skel-line sm"></div></div>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// ── Command palette (⌘K / Ctrl+K) ─────────────
let _cmdSel = 0;
let _cmdItems = [];

function cmdOpen() {
  const p = document.getElementById('cmd-palette');
  if (!p) return;
  p.classList.add('on');
  const inp = document.getElementById('cmd-input');
  if (inp) {
    inp.value = '';
    setTimeout(() => inp.focus(), 50);
  }
  cmdRender();
}

function cmdClose() {
  const p = document.getElementById('cmd-palette');
  if (p) p.classList.remove('on');
  _cmdSel = 0;
}

function cmdBuildItems(query) {
  const q = (query || '').toLowerCase().trim();
  const items = [];

  // Pages — available based on user permissions
  const pages = [
    {id:'dash',     title:'Dashboard',         sub:'Overview & analytics',          perm:'view_dashboard',    icon:'<path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z" stroke="currentColor" stroke-width="1.4"/>'},
    {id:'tasks',    title:'All tasks',         sub:'Manage all jobs',                perm:'view_all_tasks',    icon:'<path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'},
    {id:'inprogress',title:'In progress',      sub:'Active tasks',                   perm:'view_inprogress',   icon:'<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'},
    {id:'request',  title:'Job requests',      sub:'Submit & track requests',        perm:'submit_request',    icon:'<path d="M3 3h10v10H3z" stroke="currentColor" stroke-width="1.4"/><path d="M6 7h4M6 10h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'},
    {id:'reports',  title:'Reports',           sub:'View analytics & exports',       perm:'view_reports',      icon:'<path d="M2 13l4-5 3 3 5-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'},
    {id:'rooms',    title:'Rooms board',       sub:'Hotel room maintenance grid',    perm:'view_all_tasks',    icon:'<rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/>'},
    {id:'users',    title:'Users',             sub:'Manage user accounts',           perm:'manage_users',      icon:'<circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M2 14c0-3 3-5 6-5s6 2 6 5" stroke="currentColor" stroke-width="1.4"/>'},
    {id:'permissions',title:'Permissions',     sub:'Role-based access control',      perm:'manage_permissions',icon:'<path d="M8 1l6 3v4c0 4-3 6-6 7-3-1-6-3-6-7V4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'},
    {id:'admin',    title:'Field management',  sub:'Configure work types & areas',   perm:'manage_fields',     icon:'<circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'},
  ];

  pages.forEach(p => {
    if (p.perm && typeof can === 'function' && !can(p.perm)) return;
    if (!q || p.title.toLowerCase().includes(q) || p.sub.toLowerCase().includes(q)) {
      items.push({...p, _kind:'page', _section:'Pages'});
    }
  });

  // Jobs — search DATA
  if (q && typeof DATA !== 'undefined' && DATA.length) {
    const matched = DATA.filter(r => {
      const hay = `${r.requestor||''} ${r.handler||''} ${r.workType||''} ${r.subType||''} ${r.location||''} ${r.details||''} ${r.area||''}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 6);
    matched.forEach(r => {
      items.push({
        _kind: 'job',
        _section: 'Jobs',
        id: r.id,
        title: `${r.workType.replace(/_/g,' ')} — ${r.location}`,
        sub: `${r.requestor} · ${r.status} · ${r.priority}`,
        icon: '<rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 7h6M5 10h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
        action: () => { cmdClose(); if(typeof vTask==='function') vTask(String(r.id)); }
      });
    });
  }

  // Users — search USERS
  if (q && typeof USERS !== 'undefined' && USERS.length) {
    const matched = USERS.filter(u => {
      const hay = `${u.name||''} ${u.email||''} ${u.role||''} ${u.dept||''}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 5);
    matched.forEach(u => {
      items.push({
        _kind: 'user',
        _section: 'Users',
        id: u.id,
        title: u.name,
        sub: `${u.role||'—'} · ${u.dept||u.email||''}`,
        icon: '<circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M2 14c0-3 3-5 6-5s6 2 6 5" stroke="currentColor" stroke-width="1.4"/>'
      });
    });
  }

  // Actions
  const actions = [
    {title:'Toggle theme',          sub:'Switch between light and dark mode', icon:'<circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.4"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>', action:()=>{ cmdClose(); if(typeof toggleTheme==='function') toggleTheme(); }},
    {title:'Sign out',              sub:'End your session', icon:'<path d="M6 2H3v12h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>', action:()=>{ cmdClose(); if(typeof doLogout==='function') doLogout(); }},
  ];
  actions.forEach(a => {
    if (!q || a.title.toLowerCase().includes(q)) {
      items.push({...a, _kind:'action', _section:'Actions'});
    }
  });

  return items;
}

function cmdRender() {
  const inp = document.getElementById('cmd-input');
  const out = document.getElementById('cmd-results');
  if (!out) return;
  const q = inp ? inp.value : '';
  _cmdItems = cmdBuildItems(q);
  _cmdSel = 0;

  if (!_cmdItems.length) {
    out.innerHTML = `
      <div class="cmd-empty">
        <svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.4"/><path d="M11 11l3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        No matches for "${q}"
      </div>`;
    return;
  }

  // Group by section
  const grouped = {};
  _cmdItems.forEach((it, i) => {
    if (!grouped[it._section]) grouped[it._section] = [];
    grouped[it._section].push({...it, _idx: i});
  });

  let html = '';
  Object.keys(grouped).forEach(section => {
    html += `<div class="cmd-section-label">${section}</div>`;
    grouped[section].forEach(it => {
      html += `<div class="cmd-item${it._idx === _cmdSel ? ' sel' : ''}" data-idx="${it._idx}" onclick="cmdSelect(${it._idx})">
        <div class="cmd-item-ico"><svg viewBox="0 0 16 16" fill="none">${it.icon}</svg></div>
        <div class="cmd-item-body">
          <div class="cmd-item-title">${it.title}</div>
          <div class="cmd-item-sub">${it.sub||''}</div>
        </div>
        <span class="cmd-item-tag">${it._kind}</span>
      </div>`;
    });
  });
  out.innerHTML = html;
}

function cmdSelect(idx) {
  const it = _cmdItems[idx];
  if (!it) return;
  if (it._kind === 'page') {
    cmdClose();
    if (typeof go === 'function') go(it.id, null);
  } else if (it.action) {
    it.action();
  }
}

function cmdKey(e) {
  if (e.key === 'Escape') { cmdClose(); return; }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _cmdSel = Math.min(_cmdSel + 1, _cmdItems.length - 1);
    cmdRender();
    const sel = document.querySelector('.cmd-item.sel');
    if (sel) sel.scrollIntoView({block:'nearest'});
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _cmdSel = Math.max(_cmdSel - 1, 0);
    cmdRender();
    const sel = document.querySelector('.cmd-item.sel');
    if (sel) sel.scrollIntoView({block:'nearest'});
  } else if (e.key === 'Enter') {
    e.preventDefault();
    cmdSelect(_cmdSel);
  }
}

// Global keyboard shortcut: ⌘K / Ctrl+K
document.addEventListener('keydown', e => {
  // Only when user is logged in (auth screen hidden)
  const auth = document.getElementById('auth-screen');
  if (auth && auth.style.display !== 'none' && !auth.classList.contains('hidden')) return;
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    const p = document.getElementById('cmd-palette');
    if (p && p.classList.contains('on')) cmdClose();
    else cmdOpen();
  }
});


// ═══════════════════════════════════════════════
// AUDIT LOG PAGE RENDERER
// ═══════════════════════════════════════════════
let AUDIT_LOGS = [];
let _auditUnsub = null;
let _auditFilters = { category: 'all', timeRange: 'week', severity: 'all', search: '' };

function startAuditListener() {
  if (_auditUnsub) return;
  if (!FB_READY || !fbDb) return;
  if (!currentUser || currentUser.role !== 'admin') return;
  _auditUnsub = fbDb.collection('audit_logs')
    .orderBy('timestamp', 'desc')
    .limit(500)
    .onSnapshot(snap => {
      AUDIT_LOGS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (document.getElementById('page-audit')?.classList.contains('on')) {
        renderAuditList();
      }
    }, err => console.warn('Audit listener error:', err.message));
}

function stopAuditListener() {
  if (_auditUnsub) { _auditUnsub(); _auditUnsub = null; }
}

function renderAuditLog() {
  if (!currentUser || currentUser.role !== 'admin') {
    const el = document.getElementById('page-audit');
    if (el) el.innerHTML = '<div class="empty-state"><p>Access denied</p><small>Audit log is admin-only.</small></div>';
    return;
  }
  startAuditListener();

  const el = document.getElementById('page-audit');
  if (!el) return;

  el.innerHTML = `
    <div class="hero">
      <h2>Audit log</h2>
      <p>Track important system actions for security & compliance. <strong id="audit-count">${AUDIT_LOGS.length}</strong> events.</p>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div style="padding:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input id="audit-search" type="text" placeholder="Search by actor, action, or details..." class="fi" style="flex:1;min-width:200px" oninput="setAuditFilter('search', this.value)">

        <select class="fi" style="flex:0 0 auto;width:auto" onchange="setAuditFilter('category', this.value)">
          <option value="all">All categories</option>
          <option value="auth">Authentication</option>
          <option value="job">Jobs</option>
          <option value="user">Users</option>
          <option value="setting">Settings</option>
        </select>

        <select class="fi" style="flex:0 0 auto;width:auto" onchange="setAuditFilter('timeRange', this.value)">
          <option value="today">Today</option>
          <option value="week" selected>Last 7 days</option>
          <option value="month">Last 30 days</option>
          <option value="all">All time</option>
        </select>

        <select class="fi" style="flex:0 0 auto;width:auto" onchange="setAuditFilter('severity', this.value)">
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>

        <button class="btn btn-o btn-sm" onclick="exportAuditCSV()">
          <svg viewBox="0 0 16 16" fill="none" style="width:14px;height:14px"><path d="M8 1v9M5 7l3 3 3-3M2 14h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Export CSV
        </button>
      </div>
    </div>

    <div class="card">
      <div id="audit-list"></div>
    </div>
  `;
  renderAuditList();
}

function setAuditFilter(key, value) {
  _auditFilters[key] = value;
  renderAuditList();
}

function filterAuditLogs() {
  const f = _auditFilters;
  const now = Date.now();
  return AUDIT_LOGS.filter(log => {
    // Category filter
    if (f.category !== 'all' && log.targetType !== f.category) return false;
    // Severity filter
    if (f.severity !== 'all' && log.severity !== f.severity) return false;
    // Time range
    const ts = log.timestampISO ? new Date(log.timestampISO).getTime() : 0;
    if (f.timeRange === 'today') {
      if (now - ts > 86400000) return false;
    } else if (f.timeRange === 'week') {
      if (now - ts > 7 * 86400000) return false;
    } else if (f.timeRange === 'month') {
      if (now - ts > 30 * 86400000) return false;
    }
    // Search
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = `${log.actorName||''} ${log.action||''} ${log.details||''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderAuditList() {
  const list = document.getElementById('audit-list');
  const cnt  = document.getElementById('audit-count');
  if (!list) return;
  const filtered = filterAuditLogs();
  if (cnt) cnt.textContent = filtered.length;

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2"/></svg>
        <p>No audit events match your filters</p>
        <small>Try adjusting the time range or category.</small>
      </div>`;
    return;
  }

  const sevColor = { info: 'var(--blue)', warning: 'var(--amber)', critical: 'var(--red)' };
  const sevIcon  = { info: 'ℹ', warning: '⚠', critical: '🔴' };

  list.innerHTML = filtered.map(log => {
    const time = log.timestampISO ? new Date(log.timestampISO) : null;
    const timeStr = time
      ? time.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + ' · ' + time.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
      : '—';
    const color = sevColor[log.severity] || sevColor.info;
    return `
      <div class="audit-row" style="border-left-color:${color}">
        <div class="audit-dot" style="background:${color}"></div>
        <div class="audit-body">
          <div class="audit-head">
            <span class="audit-actor">${log.actorName || 'System'}</span>
            <span class="audit-sep">·</span>
            <span class="audit-action">${log.action || '—'}</span>
            <span class="audit-time">${timeStr}</span>
          </div>
          <div class="audit-details">${log.details || ''}</div>
          ${log.actorRole ? `<span class="audit-role">${log.actorRole}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function exportAuditCSV() {
  const filtered = filterAuditLogs();
  if (!filtered.length) {
    if (typeof toast === 'function') toast('No events to export', 'i');
    return;
  }
  const headers = ['Timestamp', 'Actor', 'Role', 'Action', 'Category', 'Severity', 'Details'];
  const rows = filtered.map(log => [
    log.timestampISO || '',
    log.actorName || '',
    log.actorRole || '',
    log.action || '',
    log.targetType || '',
    log.severity || '',
    (log.details || '').replace(/"/g, '""')
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  if (typeof toast === 'function') toast('Audit log exported','s');
}
