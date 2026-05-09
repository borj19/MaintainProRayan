// ═══════════════════════════════════════════════
// script.js — Core application
// Depends on: firebase.js, dashboard.js, reports.js
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════
let darkMode = true;
function toggleTheme(){
  darkMode=!darkMode;
  document.documentElement.setAttribute('data-theme',darkMode?'dark':'light');
  const lbl=document.getElementById('theme-lbl');
  if(lbl)lbl.textContent=darkMode?'Dark':'Light';
  // Re-render charts with new colours if visible
  if(document.getElementById('page-dash').classList.contains('on'))rDash();
  if(document.getElementById('page-reports').classList.contains('on'))renderR();
}

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
    update_task_status:true, view_own_tasks:true, submit_request:false,
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
let USERS = [
  {id:1,username:'admin',    password:'admin123',  name:'Hotel Manager',    initials:'HM',role:'admin',      dept:'Management',  lastLogin:null},
  {id:2,username:'staff',    password:'staff123',  name:'Rayan Borabien',   initials:'RB',role:'staff',      dept:'Maintenance', lastLogin:null},
  {id:3,username:'staff2',   password:'staff123',  name:'Josh Branson',     initials:'JB',role:'staff',      dept:'Maintenance', lastLogin:null},
  {id:4,username:'terry',    password:'staff123',  name:'Terry Allen',      initials:'TA',role:'staff',      dept:'Maintenance', lastLogin:null},
  {id:5,username:'contractor',password:'cont123',  name:'Contractor Team',  initials:'CT',role:'contractor', dept:'External',    lastLogin:null},
  {id:6,username:'requester',password:'req123',    name:'HSK - Sakorn',     initials:'SK',role:'requester',  dept:'Housekeeping',lastLogin:null},
  {id:7,username:'requester2',password:'req123',   name:'FO - Shaun',       initials:'SH',role:'requester',  dept:'Front Office', lastLogin:null},
];
let nextUserId = 8;
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
  permissions: 'manage_permissions',
  admin:       'manage_fields',
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

function doLogin(){
  const u=document.getElementById('l-user').value.trim();
  const p=document.getElementById('l-pass').value;
  const errEl=document.getElementById('login-err');
  if(!u||!p){errEl.textContent='Please enter your username and password.';errEl.classList.add('show');return;}
  const user=USERS.find(x=>x.username===u&&x.password===p);
  if(user){
    user.lastLogin=new Date().toISOString();
    currentUser=user;
    errEl.classList.remove('show');
    const as=document.getElementById('auth-screen');if(as){as.style.display='none';}
    applyUserSession();
    init();
  } else {
    errEl.textContent='Incorrect username or password. Please try again.';
    errEl.classList.add('show');
    document.getElementById('l-pass').value='';
    document.getElementById('l-pass').focus();
  }
}

function doRegister(){
  // Public registration is disabled — admin creates accounts only
  const errEl=document.getElementById('reg-err');
  errEl.textContent='Public registration is disabled. Please contact your administrator to create an account.';
  errEl.classList.add('show');
}

function adminAddUser(){
  const name=document.getElementById('au-name').value.trim();
  const u=document.getElementById('au-user').value.trim();
  const p=document.getElementById('au-pass').value;
  const role=document.getElementById('au-role').value;
  const dept=document.getElementById('au-dept')?.value.trim()||'';
  const errEl=document.getElementById('au-err');
  errEl.classList.remove('show');
  if(!name||!u||!p){errEl.textContent='All fields are required.';errEl.classList.add('show');return;}
  if(p.length<6){errEl.textContent='Password must be at least 6 characters.';errEl.classList.add('show');return;}
  if(USERS.find(x=>x.username===u)){errEl.textContent='Username already exists.';errEl.classList.add('show');return;}
  const initials=name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  const newUser={id:nextUserId++,username:u,password:p,name,initials,role,dept,lastLogin:null};
  USERS.push(newUser);
  // Save to Firestore so users persist after refresh
  if(typeof fbDb!=='undefined'&&fbDb){
    fbDb.collection('users').add(newUser).catch(e=>console.warn('User save failed:',e.message));
  }
  cm('m-adduser');
  ['au-name','au-user','au-pass'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderUserPage();
  toast(`User "${name}" (${ROLE_LABELS[role]}) created`,'s');
}

function editUserModal(id){
  const u=USERS.find(x=>String(x.id)===String(id)); if(!u) return;
  document.getElementById('eu-id').value=u.id;
  document.getElementById('eu-name').value=u.name;
  document.getElementById('eu-user').value=u.username;
  document.getElementById('eu-pass').value='';
  document.getElementById('eu-role').value=u.role;
  document.getElementById('eu-dept').value=u.dept||'';
  document.getElementById('eu-err').classList.remove('show');
  om('m-edituser');
}

function adminSaveUser(){
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
  USERS[idx]={...USERS[idx],name,username:u,role,dept,initials:name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()};
  if(p) USERS[idx].password=p;
  cm('m-edituser');
  // Update session if editing own account
  if(String(currentUser.id)===String(id)){currentUser=USERS[idx];applyUserSession();}
  renderUserPage();
  toast(`User "${name}" updated`,'s');
}

function deleteUser(id){
  if(String(id)===String(currentUser.id)){toast('You cannot delete your own account.','e');return;}
  const u=USERS.find(x=>String(x.id)===String(id));
  if(!confirm(`Delete account "${u?.name||id}"? This cannot be undone.`))return;
  USERS=USERS.filter(x=>String(x.id)!==String(id));
  renderUserPage();
  toast('User removed','i');
}

function doLogout(){
  currentUser=null;
  try{ sessionStorage.removeItem('mp_session'); }catch(e){}
  if(window._refreshInterval){ clearInterval(window._refreshInterval); window._refreshInterval=null; }
  const as=document.getElementById('auth-screen');if(as){as.style.display='flex';}
  document.getElementById('l-user').value=''; document.getElementById('l-pass').value='';
  const errEl=document.getElementById('login-err'); if(errEl) errEl.classList.remove('show');
}

function applyUserSession(){
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
  if(nb) nb.style.display=(isReq||isCont)?'none':'';
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
    ['add',        'Add task',        '<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v6M5 8h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>','Jobs',            'add_task'],
    ['inprogress', 'In progress',     '<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>', 'Jobs',            'view_inprogress','nb-ip-count','amber'],
    ['contractor', 'My jobs',         '<rect x="2" y="6" width="12" height="8" rx="1" stroke="currentColor" stroke-width="1.4"/><path d="M5 6V4a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>','Jobs','view_inprogress','nb-cont-count','amber'],
    ['request',    'Job requests',    '<rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>','Jobs','submit_request','nb-jq-count'],
    ['reports',    'Reports',         '<rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor"/><rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor"/><rect x="11" y="1" width="3" height="14" rx="1" fill="currentColor"/>','Analytics','view_reports'],
    ['email',      'Email report',    '<rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M1 5l7 5 7-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>','Analytics','send_email'],
    ['users',      'Users',           '<circle cx="6" cy="5" r="2.5" stroke="currentColor" stroke-width="1.4"/><path d="M1 13c0-2.761 2.239-4 5-4s5 1.239 5 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="13" cy="5" r="2" stroke="currentColor" stroke-width="1.2"/><path d="M11.5 13c0-1.5 1-2.5 2-2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>','Administration','manage_users','nb-users-count'],
    ['permissions','Permissions',     '<path d="M12 1l1.5 3L17 5l-2.5 2.5.5 3.5L12 9.5 9.5 11l.5-3.5L7.5 5l3.5-1L12 1z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="4" cy="12" r="2.5" stroke="currentColor" stroke-width="1.2"/>','Administration','manage_permissions'],
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
let REQS=['HSK - Sakorn','HSK - Yati','HSK - Sinta','HSK - Karma','MT - Terry','FO - Shaun','FO - Roan','FO - Kwan','FO - Emma','FO - Amol','F&B - Robin','RT - Remy'];
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
let DATA=[
  {id:1,date:'2026-04-11',requestor:'HSK - Sakorn',handler:'Rayan Borabien',workType:'Plumbing_Hydraulics_Services',subType:'Shower',area:'Level_10',location:'Room 1015',details:'Shower head rusty — replaced.',status:'Completed',priority:'Medium',completion:'2026-04-11',createdBy:'requester'},
  {id:2,date:'2026-04-11',requestor:'HSK - Sakorn',handler:'Rayan Borabien',workType:'Flooring',subType:'Polish',area:'Level_8',location:'Room 810',details:'Full floor polish treatment applied.',status:'Completed',priority:'Low',completion:'2026-04-11',createdBy:'staff'},
  {id:3,date:'2026-04-11',requestor:'HSK - Sakorn',handler:'Rayan Borabien',workType:'Flooring',subType:'Polish',area:'Level_12',location:'Room 1208',details:'Full floor polish treatment applied.',status:'Completed',priority:'Low',completion:'2026-04-11',createdBy:'staff'},
  {id:4,date:'2026-04-11',requestor:'HSK - Yati',handler:'Rayan Borabien',workType:'Flooring',subType:'Polish',area:'Level_4',location:'Room 415',details:'Full floor polish treatment applied.',status:'Completed',priority:'Low',completion:'2026-04-11',createdBy:'staff'},
  {id:5,date:'2026-04-11',requestor:'HSK - Sakorn',handler:'Rayan Borabien',workType:'Flooring',subType:'Polish',area:'Level_11',location:'Room 1102',details:'Full floor polish treatment applied.',status:'Completed',priority:'Low',completion:'2026-04-11',createdBy:'staff'},
  {id:6,date:'2026-04-11',requestor:'HSK - Sakorn',handler:'Rayan Borabien',workType:'Plumbing_Hydraulics_Services',subType:'Shower',area:'Level_9',location:'Room 915',details:'Shower head rusty — replaced.',status:'Completed',priority:'Medium',completion:'2026-04-11',createdBy:'staff'},
  {id:7,date:'2026-04-11',requestor:'HSK - Sinta',handler:'Rayan Borabien',workType:'Beds',subType:'Gliders',area:'Basement_2',location:'HK Storage 1',details:'Replaced baby cot gliders (set of 4).',status:'Completed',priority:'Low',completion:'2026-04-11',createdBy:'staff'},
  {id:8,date:'2026-04-11',requestor:'HSK - Sakorn',handler:'Rayan Borabien',workType:'Plumbing_Hydraulics_Services',subType:'Basin',area:'Level_11',location:'Room 1108',details:'Removed basin and bathtub stains.',status:'Completed',priority:'Medium',completion:'2026-04-11',createdBy:'staff'},
  {id:9,date:'2026-04-11',requestor:'HSK - Sakorn',handler:'Rayan Borabien',workType:'Plumbing_Hydraulics_Services',subType:'Basin',area:'Level_13',location:'Room 1311',details:'Removed basin and bathtub stains.',status:'Completed',priority:'Medium',completion:'2026-04-11',createdBy:'staff'},
  {id:10,date:'2026-04-11',requestor:'HSK - Sakorn',handler:'Rayan Borabien',workType:'Door_Hardware',subType:'Other',area:'Level_8',location:'Room 809',details:'Missing door stopper — installed replacement.',status:'Completed',priority:'Low',completion:'2026-04-11',createdBy:'staff'},
  {id:11,date:'2026-04-11',requestor:'HSK - Yati',handler:'Rayan Borabien',workType:'Electrical_Works',subType:'Light Switch',area:'Level_6',location:'Room 614',details:'Light switch cover missing — replaced.',status:'Completed',priority:'Medium',completion:'2026-04-11',createdBy:'staff'},
  {id:12,date:'2026-04-11',requestor:'RT - Remy',handler:'Josh Branson',workType:'Fixtures_Furnishings_Fittings',subType:'Ottoman',area:'Level_18',location:'Rooftop Bar',details:'Ottoman upholstery repaired.',status:'Completed',priority:'Low',completion:'2026-04-11',createdBy:'staff'},
  {id:13,date:'2026-04-11',requestor:'RT - Remy',handler:'Josh Branson',workType:'Fixtures_Furnishings_Fittings',subType:'Ottoman',area:'Level_18',location:'Rooftop Bar',details:'Ottoman upholstery repaired — unit 2.',status:'Completed',priority:'Low',completion:'2026-04-11',createdBy:'staff'},
  {id:14,date:TODAY,requestor:'HSK - Sakorn',handler:'Rayan Borabien',workType:'AC',subType:'Leaking',area:'Level_7',location:'Room 712',details:'AC unit leaking — requires inspection and seal replacement.',status:'In Progress',priority:'High',completion:'',createdBy:'requester'},
  {id:15,date:TODAY,requestor:'FO - Shaun',handler:'Josh Branson',workType:'Door_Hardware',subType:'Door lock faulty',area:'Level_5',location:'Room 503',details:'Door lock not engaging properly — guest unable to secure room.',status:'In Progress',priority:'Urgent',completion:'',createdBy:'requester'},
  {id:16,date:TODAY,requestor:'FO - Emma',handler:'Contractor',workType:'Pest_Control',subType:'Sightings',area:'Ground Floor',location:'Restaurant',details:'Cockroach sightings reported near kitchen entrance.',status:'In Progress - Contractor',priority:'Urgent',completion:'',createdBy:'staff'},
  {id:17,date:TODAY,requestor:'MT - Terry',handler:'Terry Allen',workType:'Cleaning',subType:'P-Trap',area:'Basement_1',location:'Laundry Room',details:'Drainage slow — P-trap blockage suspected.',status:'In Progress',priority:'Medium',completion:'',createdBy:'staff'},
];
let nid=18,fData=[...DATA],sKey=null,sDir=1,cPg=1,eId=null;
const PGS=12,chs={};
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
    permissions:'Role permissions',admin:'Field management'};
  const ttl=document.getElementById('pg-ttl'); if(ttl) ttl.textContent=T[p]||p;

  if(p==='dash')          rDash();
  if(p==='tasks')         {bTKpis();af();}
  if(p==='add')           rAddSide();
  if(p==='inprogress')    renderInProgress();
  if(p==='contractor')    renderContractorPanel();
  if(p==='request')       renderRequestPage();
  if(p==='reports')       {if(!rReady){bChips();rReady=true;}renderR();}
  if(p==='users')         renderUserPage();
  if(p==='permissions')   renderPermissionsPage();
  if(p==='admin')         renderAdminPanels();

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
  function f(id,arr){const s=document.getElementById(id);if(!s)return;const cur=s.value;while(s.children.length>1)s.removeChild(s.lastChild);arr.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v.replace(/_/g,' ');s.appendChild(o)});s.value=cur;}
  f('far',AREAS.slice().sort());
  f('fwt',Object.keys(SUBTYPES).sort());
  f('fhd',HNDS.slice().sort());
  const nbCount=document.getElementById('nb-count');
  if(nbCount)nbCount.textContent=DATA.length;

  // Add task form
  const afRq=document.getElementById('af-rq');if(afRq)afRq.innerHTML=REQS.map(v=>`<option>${v}</option>`).join('');
  const afHd=document.getElementById('af-hd');if(afHd)afHd.innerHTML=HNDS.map(v=>`<option>${v}</option>`).join('');
  const afWt=document.getElementById('af-wt');if(afWt){afWt.innerHTML=Object.keys(SUBTYPES).map(v=>`<option>${v}</option>`).join('');aus();}
  const afAr=document.getElementById('af-ar');if(afAr)afAr.innerHTML=AREAS.map(v=>`<option>${v}</option>`).join('');

  // Job request form
  const jqWt=document.getElementById('jq-wt');if(jqWt){jqWt.innerHTML=Object.keys(SUBTYPES).map(v=>`<option>${v}</option>`).join('');jqus();}
  const jqAr=document.getElementById('jq-ar');if(jqAr)jqAr.innerHTML=AREAS.map(v=>`<option>${v}</option>`).join('');

  // Update in-progress pill
  const ipCount=DATA.filter(r=>r.status==='In Progress'||r.status==='In Progress - Contractor').length;
  const ipPill=document.getElementById('nb-ip-count');if(ipPill)ipPill.textContent=ipCount;

  // Job request pill (pending)
  const jqCount=DATA.filter(r=>r.status==='Pending').length;
  const jqPill=document.getElementById('nb-jq-count');if(jqPill)jqPill.textContent=jqCount;
}

function aus(){const wt=document.getElementById('af-wt');if(!wt)return;document.getElementById('af-st').innerHTML=(SUBTYPES[wt.value]||['Other']).map(o=>`<option>${o}</option>`).join('')}
function eus(){const wt=document.getElementById('em-wt');if(!wt)return;document.getElementById('em-st').innerHTML=(SUBTYPES[wt.value]||['Other']).map(o=>`<option>${o}</option>`).join('')}
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
  cPg=1;rTbl();
}
function clrF(){['fsrch','fst','far','fwt','fhd','fpr'].forEach(id=>{const el=document.getElementById(id);if(el){if(el.tagName==='INPUT')el.value='';else el.value='';}});af();}
function srt(k){if(sKey===k)sDir*=-1;else{sKey=k;sDir=1;}af();}

function rTbl(){
  const tot=fData.length,pages=Math.max(1,Math.ceil(tot/PGS));
  if(cPg>pages)cPg=pages;
  const rows=fData.slice((cPg-1)*PGS,cPg*PGS);
  document.getElementById('fi').textContent=`${tot} task${tot!==1?'s':''} · ${tot===DATA.length?'all records':'filtered from '+DATA.length}`;
  const isAdmin=currentUser&&(currentUser.role==='admin'||currentUser.role==='staff');
  const tb=document.getElementById('t-body');
  tb.innerHTML=rows.length?rows.map(r=>`<tr>
    <td>${fds(r.date)}</td><td class="td-h">${r.requestor}</td><td>${r.handler}</td>
    <td>${r.workType.replace(/_/g,' ')}</td><td>${r.subType}</td>
    <td>${r.area.replace(/_/g,' ')}</td><td>${r.location}</td>
    <td title="${r.details}" style="color:var(--t2)">${r.details}</td>
    <td>${sbadge(r.status)}</td><td>${pbadge(r.priority)}</td>
    <td><div style="display:flex;gap:3px">
      <button class="btn btn-o btn-xs" onclick="vTask('${r.id}')" title="View" style="padding:3px 5px"><svg viewBox="0 0 16 16" fill="none" style="width:11px;height:11px"><circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg></button>
      ${isAdmin?`<button class="btn btn-o btn-xs" onclick="eTask('${r.id}')" title="Edit" style="padding:3px 5px"><svg viewBox="0 0 16 16" fill="none" style="width:11px;height:11px"><path d="M11 2l3 3-9 9H2v-3L11 2z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`:''}
      ${currentUser&&currentUser.role==='admin'?`<button class="btn btn-r btn-xs" onclick="dTask('${r.id}')" title="Delete" style="padding:3px 5px"><svg viewBox="0 0 16 16" fill="none" style="width:11px;height:11px"><path d="M3 4h10M6 4V2h4v2M5 4v8h6V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`:''}
    </div></td>
  </tr>`).join(''):`<tr><td colspan="11" style="text-align:center;padding:36px;color:var(--t2)">No tasks match the current filters.</td></tr>`;
  document.getElementById('p-inf').textContent=`Page ${cPg} of ${pages} (${tot} tasks)`;
  document.getElementById('p-pv').disabled=cPg<=1;
  document.getElementById('p-nx').disabled=cPg>=pages;
}
function chPg(d){cPg+=d;rTbl();}

// ═══════════════════════════════════════════════
// TASK KPIs
// ═══════════════════════════════════════════════
function bTKpis(){
  const d=DATA,c=d.filter(r=>r.status==='Completed').length;
  const i=d.filter(r=>r.status==='In Progress'||r.status==='In Progress - Contractor').length;
  const u=d.filter(r=>r.priority==='Urgent'||r.priority==='High').length;
  const p=d.filter(r=>r.subType==='Polish').length;
  document.getElementById('t-kpis').innerHTML=[
    {c:'#6ebe2a',l:'Total tasks',v:d.length,s:'All records'},
    {c:'#6ebe2a',l:'Completed',v:c,tr:`${Math.round(c/d.length*100)}% rate`,tc:'up'},
    {c:'#5599f5',l:'In progress',v:i},
    {c:'#f0a62e',l:'High priority',v:u,tr:u>3?'Needs attention':'All clear',tc:u>3?'dn':'up'},
    {c:'#2dcfb3',l:'Polish jobs',v:p},
    {c:'#a87cf0',l:'Active handlers',v:new Set(d.map(r=>r.handler)).size,s:'Staff assigned'},
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
  om('m-det');
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
  document.getElementById('em-wt').innerHTML=Object.keys(SUBTYPES).map(k=>`<option ${k===r.workType?'selected':''}>${k}</option>`).join('');
  eus();setTimeout(()=>{document.getElementById('em-st').value=r.subType;},60);
  document.getElementById('em-rq').innerHTML=REQS.map(v=>`<option ${v===r.requestor?'selected':''}>${v}</option>`).join('');
  document.getElementById('em-hd').innerHTML=HNDS.map(v=>`<option ${v===r.handler?'selected':''}>${v}</option>`).join('');
  document.getElementById('em-ar').innerHTML=AREAS.map(v=>`<option ${v===r.area?'selected':''}>${v}</option>`).join('');
  om('m-edit');
}

function saveEdit(){
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
  cm('m-edit');af();rReady=false;fillDrops();toast('Task updated successfully');
}

function dTask(id){
  id=String(id);
  if(!confirm('Delete this task? This action cannot be undone.'))return;
  fbDeleteJob(id);
  if(!FB_READY){DATA=DATA.filter(x=>String(x.id)!==id);fData=fData.filter(x=>String(x.id)!==id);}
  fillDrops();bTKpis();rTbl();rReady=false;toast('Task deleted','i');
}

// ═══════════════════════════════════════════════
// ADD TASK — auto sets In Progress
// ═══════════════════════════════════════════════
function addTask(){
  const loc=document.getElementById('af-lc').value.trim();
  const det=document.getElementById('af-de').value.trim();
  if(!loc||!det){toast('Location and details are required.','e');return;}
  const t={
    id:nid++,date:document.getElementById('af-dt').value||TODAY,
    requestor:document.getElementById('af-rq').value,
    handler:document.getElementById('af-hd').value,
    workType:document.getElementById('af-wt').value,
    subType:document.getElementById('af-st').value,
    area:document.getElementById('af-ar').value,
    location:loc,details:det,
    status:'In Progress', // always In Progress on creation
    priority:document.getElementById('af-pr').value,
    completion:document.getElementById('af-cd').value||'',
    createdBy:currentUser?currentUser.role:'staff'
  };
  DATA.unshift(t);fillDrops();rReady=false;clrAF();rAddSide();
  document.getElementById('nb-count').textContent=DATA.length;
  toast(`Task #${t.id} added — marked In Progress`);
}
function clrAF(){
  ['af-lc','af-de','af-cd'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}

function rAddSide(){
  const d=DATA,tc=d.filter(r=>r.date===TODAY).length;
  const co=d.filter(r=>r.status==='Completed').length;
  const arc=document.getElementById('add-rc');if(arc)arc.textContent=tc+' today';
  const qs=document.getElementById('add-qs');
  if(qs)qs.innerHTML=[
    {bg:'rgba(110,190,42,.12)',c:'#6ebe2a',l:'Total tasks',v:d.length},
    {bg:'rgba(45,207,179,.1)',c:'#2dcfb3',l:'Completed',v:`${co} (${Math.round(co/d.length*100)}%)`},
    {bg:'rgba(85,153,245,.1)',c:'#5599f5',l:'In progress',v:d.filter(r=>r.status==='In Progress').length},
    {bg:'rgba(232,83,74,.1)',c:'#e8534a',l:'High / Urgent',v:d.filter(r=>r.priority==='High'||r.priority==='Urgent').length},
  ].map(x=>`<div class="qsi"><div class="qsi-ico" style="background:${x.bg};color:${x.c}"><svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.4"/></svg></div><div><div class="qsi-l">${x.l}</div><div class="qsi-v">${x.v}</div></div></div>`).join('');
  const rl=document.getElementById('add-rl');
  if(rl)rl.innerHTML=DATA.slice(0,5).map(r=>`<div class="act-i"><div class="act-dot" style="background:${r.status==='Completed'?'var(--g)':r.status==='In Progress'?'var(--blue)':'var(--amber)'}"></div><div class="act-body"><div class="act-txt"><strong style="color:var(--t0)">${r.requestor}</strong> · ${r.workType.replace(/_/g,' ')}</div><div class="act-sub">${r.location} · ${r.area.replace(/_/g,' ')}</div><div class="act-time">${fd(r.date)}</div></div></div>`).join('');
}

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
function renderRequestPage(){
  const u=currentUser;
  const heroSub=document.getElementById('request-hero-sub');
  if(heroSub)heroSub.textContent=u.role==='requester'
    ?`Logged in as ${u.name}. Once submitted, your request will be automatically assigned and you can track its progress below.`
    :`Managing job requests. Pending requests can be assigned and actioned from here.`;

  // Stats
  const myReqs=u.role==='requester'?DATA.filter(r=>r.requestor===u.name):DATA;
  const pending=myReqs.filter(r=>r.status==='Pending').length;
  const inprog=myReqs.filter(r=>r.status==='In Progress'||r.status==='In Progress - Contractor').length;
  const done=myReqs.filter(r=>r.status==='Completed').length;
  const stats=document.getElementById('req-stats');
  if(stats)stats.innerHTML=[
    {l:'Pending',v:pending,s:'Awaiting assignment',c:'var(--purple)'},
    {l:'In progress',v:inprog,s:'Being actioned',c:'var(--blue)'},
    {l:'Completed',v:done,s:'Resolved',c:'var(--g)'},
  ].map(x=>`<div class="request-status-card"><div class="rsc-label" style="color:${x.c}">${x.l}</div><div class="rsc-count" style="color:${x.c}">${x.v}</div><div class="rsc-sub">${x.s}</div></div>`).join('');

  // My requests list
  const shown=u.role==='requester'
    ?DATA.filter(r=>r.requestor===u.name&&(r.status==='Pending'||r.status==='In Progress'||r.status==='In Progress - Contractor'||r.status==='Completed'))
    :DATA.filter(r=>r.status==='Pending');
  const list=document.getElementById('my-requests-list');
  const countBadge=document.getElementById('my-req-count');
  if(countBadge)countBadge.textContent=(u.role==='requester'?'My requests':'Pending requests')+' ('+shown.length+')';
  if(!list)return;
  if(!shown.length){list.innerHTML=`<div class="empty-state"><svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg><p>${u.role==='requester'?'No requests submitted yet.':'No pending requests.'}</p><small>${u.role==='requester'?'Use the form above to submit your first request.':''}</small></div>`;return;}
  list.innerHTML=shown.map(r=>`<div class="my-request-item">
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
  const loc=document.getElementById('jq-lc').value.trim();
  const det=document.getElementById('jq-de').value.trim();
  if(!loc||!det){toast('Please fill in all required fields.','e');return;}
  const wt=document.getElementById('jq-wt').value;
  const handler=AUTO_ASSIGN[wt]||HNDS[0];
  const req=currentUser.role==='requester'?currentUser.name:(REQS[0]||'Guest');
  const t={
    id:nid++,date:TODAY,
    requestor:req,
    handler:handler,
    workType:wt,
    subType:document.getElementById('jq-st').value,
    area:document.getElementById('jq-ar').value,
    location:loc,details:det,
    status:'In Progress', // auto move to In Progress with assigned handler
    priority:document.getElementById('jq-pr').value,
    completion:'',
    createdBy:currentUser?currentUser.username:'guest'
  };
  DATA.unshift(t);fillDrops();rReady=false;clrJQ();renderRequestPage();
  toast(`Request #${t.id} submitted — assigned to ${handler}`);
}

function assignRequest(id){
  const r=DATA.find(x=>x.id===id);if(!r)return;
  const wt=r.workType;
  r.handler=AUTO_ASSIGN[wt]||HNDS[0];
  r.status='In Progress';
  fillDrops();renderRequestPage();rReady=false;
  toast(`Request #${id} assigned to ${r.handler}`);
}

function clrJQ(){
  ['jq-lc','jq-de'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}

// ═══════════════════════════════════════════════

// EMAIL (email page buttons)
// ═══════════════════════════════════════════════
function doEmail(){const em=document.getElementById('eml-to').value;if(!em||!em.includes('@')){toast('Please enter a valid email address.','e');return;}cm('m-email');toast(`Report sent to ${em}`);}
function sendFromPage(){const em=document.getElementById('cfg-to').value;if(!em||!em.includes('@')){toast('Please enter a manager email address first.','e');return;}toast(`Report queued for ${em}`);}
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
        @${u.username} · ${u.dept||'—'} ·
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
      ${u.id!==currentUser.id?`<button class="btn btn-r btn-sm" onclick="deleteUser('${u.id}')">
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
function renderAdminPanels(){renderWorkTypes();renderRequestors();renderHandlers();renderAreas();renderSubTypes();}

function renderWorkTypes(){
  const wts=Object.keys(SUBTYPES);
  document.getElementById('wt-count').textContent=wts.length+' types';
  document.getElementById('wt-list').innerHTML=wts.map(w=>`<li class="field-item"><span class="field-item-label">${w.replace(/_/g,' ')}</span><span class="field-item-meta">${SUBTYPES[w].length} sub types</span><div class="field-item-actions"><button class="field-delete-btn" onclick="delWorkType('${w}')"><svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2h4v2M5 4v8h6V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></li>`).join('');
}
function addWorkType(){const inp=document.getElementById('wt-new');const val=inp.value.trim().replace(/\s+/g,'_');if(!val){toast('Please enter a work type name.','e');return;}if(SUBTYPES[val]){toast('This work type already exists.','e');return;}SUBTYPES[val]=['Other'];inp.value='';fillDrops();renderAdminPanels();rReady=false;toast(`Work type "${val.replace(/_/g,' ')}" added`);}
function delWorkType(key){if(Object.keys(SUBTYPES).length<=1){toast('At least one work type must remain.','e');return;}if(!confirm(`Remove work type "${key.replace(/_/g,' ')}"?`))return;delete SUBTYPES[key];fillDrops();renderAdminPanels();rReady=false;toast('Work type removed','i');}

function renderSubTypes(){
  const container=document.getElementById('subtype-list');
  container.innerHTML=Object.entries(SUBTYPES).map(([wt,subs])=>`<div class="subtype-section"><div class="subtype-wt-label">${wt.replace(/_/g,' ')}<button class="subtype-wt-expand" onclick="toggleSubSection('ss-${wt}')">${subs.length} sub types</button></div><div class="subtype-items" id="ss-${wt}">${subs.map(s=>`<span class="subtype-chip">${s}<button onclick="delSubType('${wt}','${s.replace(/'/g,"\\'")}')"><svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></span>`).join('')}<input type="text" placeholder="Add…" style="padding:4px 8px;font-size:11px;background:var(--s2);border:1px dashed var(--b2);border-radius:5px;color:var(--t0);width:100px;font-family:var(--font)" onkeydown="if(event.key==='Enter')addSubType('${wt}',this)"></div></div>`).join('');
}
function toggleSubSection(id){const el=document.getElementById(id);if(el)el.classList.toggle('open');}
function addSubType(wt,inp){const val=inp.value.trim();if(!val)return;if(SUBTYPES[wt].includes(val)){toast('Already exists.','e');return;}SUBTYPES[wt].push(val);inp.value='';renderAdminPanels();rReady=false;toast(`Sub type "${val}" added`);}
function delSubType(wt,sub){if(SUBTYPES[wt].length<=1){toast('At least one sub type must remain.','e');return;}SUBTYPES[wt]=SUBTYPES[wt].filter(s=>s!==sub);renderAdminPanels();rReady=false;toast('Sub type removed','i');}

function renderRequestors(){document.getElementById('rq-count').textContent=REQS.length+' requestors';document.getElementById('rq-list').innerHTML=REQS.map(r=>`<li class="field-item"><span class="field-item-label">${r}</span><div class="field-item-actions"><button class="field-delete-btn" onclick="delRequestor('${r.replace(/'/g,"\\'")}')"><svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2h4v2M5 4v8h6V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></li>`).join('');}
function addRequestor(){const inp=document.getElementById('rq-new');const val=inp.value.trim();if(!val){toast('Please enter a requestor name.','e');return;}if(REQS.includes(val)){toast('Already exists.','e');return;}REQS.push(val);inp.value='';fillDrops();renderAdminPanels();rReady=false;toast(`Requestor "${val}" added`);}
function delRequestor(name){if(REQS.length<=1){toast('At least one requestor must remain.','e');return;}if(!confirm(`Remove requestor "${name}"?`))return;REQS=REQS.filter(r=>r!==name);fillDrops();renderAdminPanels();rReady=false;toast('Requestor removed','i');}

function renderHandlers(){document.getElementById('hd-count').textContent=HNDS.length+' handlers';document.getElementById('hd-list').innerHTML=HNDS.map(h=>`<li class="field-item"><span class="field-item-label">${h}</span><div class="field-item-actions"><button class="field-delete-btn" onclick="delHandler('${h.replace(/'/g,"\\'")}')"><svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2h4v2M5 4v8h6V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></li>`).join('');}
function addHandler(){const inp=document.getElementById('hd-new');const val=inp.value.trim();if(!val){toast('Please enter a handler name.','e');return;}if(HNDS.includes(val)){toast('Already exists.','e');return;}HNDS.push(val);inp.value='';fillDrops();renderAdminPanels();rReady=false;toast(`Handler "${val}" added`);}
function delHandler(name){if(HNDS.length<=1){toast('At least one handler must remain.','e');return;}if(!confirm(`Remove handler "${name}"?`))return;HNDS=HNDS.filter(h=>h!==name);fillDrops();renderAdminPanels();rReady=false;toast('Handler removed','i');}

function renderAreas(){document.getElementById('ar-count').textContent=AREAS.length+' areas';document.getElementById('ar-list').innerHTML=AREAS.map(a=>`<li class="field-item"><span class="field-item-label">${a.replace(/_/g,' ')}</span><span class="field-item-meta" style="font-family:var(--mono);font-size:10px">${a}</span><div class="field-item-actions"><button class="field-delete-btn" onclick="delArea('${a.replace(/'/g,"\\'")}')"><svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2h4v2M5 4v8h6V4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></li>`).join('');}
function addArea(){const inp=document.getElementById('ar-new');const val=inp.value.trim();if(!val){toast('Please enter an area name.','e');return;}if(AREAS.includes(val)){toast('Already exists.','e');return;}AREAS.push(val);inp.value='';fillDrops();renderAdminPanels();rReady=false;toast(`Area "${val.replace(/_/g,' ')}" added`);}
function delArea(name){if(AREAS.length<=1){toast('At least one area must remain.','e');return;}if(!confirm(`Remove area "${name.replace(/_/g,' ')}"?`))return;AREAS=AREAS.filter(a=>a!==name);fillDrops();renderAdminPanels();rReady=false;toast('Area removed','i');}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
function init(){
  const dtEl=document.getElementById('af-dt'); if(dtEl) dtEl.value=TODAY;
  const cdEl=document.getElementById('af-cd'); if(cdEl) cdEl.value=TODAY;
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

  // Try to restore session from sessionStorage (prevents logout on refresh)
  try {
    const saved=sessionStorage.getItem('mp_session');
    if(saved){
      const s=JSON.parse(saved);
      const user=USERS.find(u=>u.id===s.id && u.username===s.username);
      if(user){
        currentUser=user;
        const authEl=document.getElementById('auth-screen');
        if(authEl){authEl.style.display='none';}
        applyUserSession();
        init();
        return;
      }
    }
  } catch(e){ try{sessionStorage.removeItem('mp_session');}catch(_){} }

  // Load persisted users from Firestore
  if(typeof fbDb!=='undefined'&&fbDb){
    fbDb.collection('users').get().then(snap=>{
      snap.forEach(doc=>{
        const u={...doc.data(),firestoreId:doc.id};
        if(!USERS.find(x=>x.username===u.username))USERS.push(u);
      });
    }).catch(e=>console.warn('Could not load users:',e.message));
  }

  // No saved session — show login screen
  const authEl=document.getElementById('auth-screen');
  if(authEl){authEl.style.display='flex';}
});