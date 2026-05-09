// ═══════════════════════════════════════════════
// rooms.js — Preventive Maintenance Board v2
// Full-width grid, recency colours, work type
// filtering, room history modal, PDF/CSV export
// ═══════════════════════════════════════════════

// ── Hotel room layout (3F–14F) ────────────────
const ROOM_FLOORS = [
  { floor:'3F',  rooms:['301','302','303','304','305','306','307','308','309','310','311','312','313','314','315','316'] },
  { floor:'4F',  rooms:['401','402','403','404','405','406','407','408','409','410','411','412','413','414','415','416'] },
  { floor:'5F',  rooms:['501','502','503','504','505','506','507','508','509','510','511','512','513','514','515','516'] },
  { floor:'6F',  rooms:['601','602','603','604','605','606','607','608','609','610','611','612','613','614','615','616'] },
  { floor:'7F',  rooms:['701','702','703','704','705','706','707','708','709','710','711','712','714','715','716'] },
  { floor:'8F',  rooms:['801','802','803','804','805','806','807','808','809','810','811','812','814','815','816'] },
  { floor:'9F',  rooms:['901','902','903','904','905','906','907','908','909','910','911','912','914','915','916'] },
  { floor:'10F', rooms:['1001','1002','1003','1004','1005','1006','1007','1008','1009','1010','1011','1012','1014','1015','1016'] },
  { floor:'11F', rooms:['1101','1102','1103','1104','1105','1106','1107','1108','1109','1110','1111','1112','1114','1115','1116'] },
  { floor:'12F', rooms:['1201','1202','1203','1204','1205','1206','1207','1208','1209','1210','1211','1212','1214','1215','1216'] },
  { floor:'13F', rooms:['1301','1302','1303','1304','1305','1306','1307','1308','1309','1310','1311','1312','1314','1315','1316'] },
  { floor:'14F', rooms:['1401','1402','1403','1404','1405','1406','1407','1408','1409','1410','1411','1412','1414','1415','1416'] },
];

// ── Filter state ──────────────────────────────
let ROOMS_FILTER = {
  room: '', workType: '', subType: '',
  handler: '', status: '', dateFrom: '', dateTo: '',
};

// ── Helpers ───────────────────────────────────
function extractRoom(location) {
  if (!location) return null;
  const m = location.match(/\b(\d{3,4})\b/);
  return m ? m[1] : null;
}

function daysSince(dateStr) {
  if (!dateStr) return 9999;
  return Math.floor((new Date() - new Date(dateStr)) / 86400000);
}

// ── Recency colour logic ──────────────────────
// Returns style object based on days since last job
// When work type filter is active, only rooms with
// matching jobs are coloured — others go dim.
function getRoomCellStyle(roomNum, jobsMap) {
  const allJobs = jobsMap[roomNum] || [];

  // If work type / subtype filter active, only show matching jobs
  const relevantJobs = (ROOMS_FILTER.workType || ROOMS_FILTER.subType)
    ? allJobs.filter(j => {
        if (ROOMS_FILTER.workType && j.workType !== ROOMS_FILTER.workType) return false;
        if (ROOMS_FILTER.subType && j.subType !== ROOMS_FILTER.subType) return false;
        return true;
      })
    : allJobs;

  // If filter active but no matching jobs for this room → dim
  if ((ROOMS_FILTER.workType || ROOMS_FILTER.subType) && !relevantJobs.length) {
    return { bg:'#0d1109', border:'#1d2412', text:'#3e4d2c', dim:true };
  }

  const jobs = relevantJobs.length ? relevantJobs : allJobs;

  // Active (in progress) job → blue, highest priority
  const hasActive = jobs.some(j => j.status==='In Progress' || j.status==='In Progress - Contractor');
  if (hasActive) return { bg:'rgba(85,153,245,.2)', border:'#5599f5', text:'#5599f5', dim:false };

  // Urgent pending → red
  const hasUrgent = jobs.some(j => j.priority==='Urgent' && j.status!=='Completed');
  if (hasUrgent) return { bg:'rgba(232,83,74,.2)', border:'#e8534a', text:'#e8534a', dim:false };

  // Completed jobs → colour by recency
  const completed = jobs.filter(j => j.status==='Completed' && j.completion);
  if (completed.length) {
    const latest = completed.sort((a,b) => b.completion.localeCompare(a.completion))[0];
    const days = daysSince(latest.completion);
    if (days <= 30)  return { bg:'rgba(110,190,42,.22)',  border:'#6ebe2a', text:'#6ebe2a',  dim:false }; // green  — recent
    if (days <= 90)  return { bg:'rgba(240,166,46,.2)',   border:'#f0a62e', text:'#f0a62e',  dim:false }; // amber  — aging
    return              { bg:'rgba(232,83,74,.18)',   border:'#e8534a', text:'#e8534a',  dim:false }; // red    — overdue
  }

  // Pending only
  const hasPending = jobs.some(j => j.status==='Pending');
  if (hasPending) return { bg:'rgba(168,124,240,.18)', border:'#a87cf0', text:'#a87cf0', dim:false };

  // No jobs at all
  return { bg:'#111507', border:'#1d2412', text:'#3e4d2c', dim:false };
}

// ── Get last completed date for a room ────────
function getLastCompletedDate(jobs) {
  const done = jobs.filter(j => j.status==='Completed' && j.completion)
    .sort((a,b) => b.completion.localeCompare(a.completion));
  return done[0]?.completion || null;
}

// ── Filtered jobs for the table ───────────────
function getRoomsFilteredJobs() {
  return DATA.filter(j => {
    const room = extractRoom(j.location);
    if (!room) return false;
    if (ROOMS_FILTER.room     && room !== ROOMS_FILTER.room)           return false;
    if (ROOMS_FILTER.workType && j.workType !== ROOMS_FILTER.workType) return false;
    if (ROOMS_FILTER.subType  && j.subType !== ROOMS_FILTER.subType)   return false;
    if (ROOMS_FILTER.handler  && j.handler !== ROOMS_FILTER.handler)   return false;
    if (ROOMS_FILTER.status   && j.status !== ROOMS_FILTER.status)     return false;
    if (ROOMS_FILTER.dateFrom && j.date < ROOMS_FILTER.dateFrom)       return false;
    if (ROOMS_FILTER.dateTo   && j.date > ROOMS_FILTER.dateTo)         return false;
    return true;
  }).sort((a,b) => b.date.localeCompare(a.date));
}

// ── Active filter label for exports ──────────
function getActiveFilterLabel() {
  const parts = [];
  if (ROOMS_FILTER.room)     parts.push(`Room: ${ROOMS_FILTER.room}`);
  if (ROOMS_FILTER.workType) parts.push(`Work type: ${ROOMS_FILTER.workType.replace(/_/g,' ')}`);
  if (ROOMS_FILTER.subType)  parts.push(`Sub type: ${ROOMS_FILTER.subType}`);
  if (ROOMS_FILTER.handler)  parts.push(`Handler: ${ROOMS_FILTER.handler}`);
  if (ROOMS_FILTER.status)   parts.push(`Status: ${ROOMS_FILTER.status}`);
  if (ROOMS_FILTER.dateFrom) parts.push(`From: ${ROOMS_FILTER.dateFrom}`);
  if (ROOMS_FILTER.dateTo)   parts.push(`To: ${ROOMS_FILTER.dateTo}`);
  return parts.length ? parts.join(' · ') : 'All rooms — no filter';
}

// ── Main render ───────────────────────────────
function renderRoomsBoard() {
  const el = document.getElementById('page-rooms');
  if (!el) return;

  const filtered   = getRoomsFilteredJobs();
  const roomJobs   = DATA.filter(j => extractRoom(j.location));
  const activeRooms = new Set(roomJobs.filter(j =>
    j.status==='In Progress'||j.status==='In Progress - Contractor'
  ).map(j=>extractRoom(j.location)).filter(Boolean)).size;

  // subtype dropdown options based on selected workType
  const subtypeOpts = ROOMS_FILTER.workType && SUBTYPES[ROOMS_FILTER.workType]
    ? SUBTYPES[ROOMS_FILTER.workType]
    : [];

  el.innerHTML = `
  <!-- KPI strip -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px">
    ${[
      {c:'var(--g)',    l:'Total room jobs', v:roomJobs.length},
      {c:'var(--blue)', l:'Active rooms',    v:activeRooms},
      {c:'var(--amber)',l:'Pending',          v:roomJobs.filter(j=>j.status==='Pending').length},
      {c:'var(--g)',    l:'Completed',        v:roomJobs.filter(j=>j.status==='Completed').length},
      {c:'var(--red)',  l:'Overdue (>90d)',   v:roomJobs.filter(j=>j.status==='Completed'&&daysSince(j.completion)>90).length},
    ].map(k=>`<div class="kpi">
      <div class="kpi-bar" style="background:${k.c}"></div>
      <div class="kpi-lbl">${k.l}</div>
      <div class="kpi-val">${k.v}</div>
    </div>`).join('')}
  </div>

  <!-- Legend -->
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;align-items:center;padding:8px 12px;background:var(--s1);border-radius:var(--r);border:1px solid var(--b0)">
    <span style="font-size:9.5px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.07em">Legend:</span>
    ${[
      ['#0d1109','#1d2412','#3e4d2c','No history'],
      ['rgba(110,190,42,.22)','#6ebe2a','#6ebe2a','Serviced ≤ 30 days'],
      ['rgba(240,166,46,.2)','#f0a62e','#f0a62e','30–90 days ago'],
      ['rgba(232,83,74,.18)','#e8534a','#e8534a','Over 90 days / Urgent'],
      ['rgba(85,153,245,.2)','#5599f5','#5599f5','Active / In Progress'],
      ['rgba(168,124,240,.18)','#a87cf0','#a87cf0','Pending'],
    ].map(([bg,border,text,label])=>`
      <span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--t1)">
        <span style="width:20px;height:14px;border-radius:3px;background:${bg};border:1.5px solid ${border};display:inline-block;flex-shrink:0"></span>
        ${label}
      </span>`).join('')}
  </div>

  <!-- Filter bar -->
  <div style="display:flex;flex-wrap:wrap;gap:7px;padding:12px 14px;background:var(--s1);border:1px solid var(--b0);border-radius:var(--r2);margin-bottom:14px;align-items:center">
    <input type="text" class="fi" style="width:90px;padding:7px 9px;font-size:12px"
      placeholder="Room no." value="${ROOMS_FILTER.room}"
      oninput="ROOMS_FILTER.room=this.value.trim();renderRoomsBoard()">

    <select class="fi" style="width:auto;padding:7px 9px;font-size:12px"
      onchange="ROOMS_FILTER.workType=this.value;ROOMS_FILTER.subType='';renderRoomsBoard()">
      <option value="">All work types</option>
      ${Object.keys(SUBTYPES).map(w=>`<option value="${w}" ${ROOMS_FILTER.workType===w?'selected':''}>${w.replace(/_/g,' ')}</option>`).join('')}
    </select>

    ${subtypeOpts.length ? `<select class="fi" style="width:auto;padding:7px 9px;font-size:12px"
      onchange="ROOMS_FILTER.subType=this.value;renderRoomsBoard()">
      <option value="">All sub types</option>
      ${subtypeOpts.map(s=>`<option value="${s}" ${ROOMS_FILTER.subType===s?'selected':''}>${s}</option>`).join('')}
    </select>` : ''}

    <select class="fi" style="width:auto;padding:7px 9px;font-size:12px"
      onchange="ROOMS_FILTER.handler=this.value;renderRoomsBoard()">
      <option value="">All handlers</option>
      ${HNDS.map(h=>`<option value="${h}" ${ROOMS_FILTER.handler===h?'selected':''}>${h}</option>`).join('')}
    </select>

    <select class="fi" style="width:auto;padding:7px 9px;font-size:12px"
      onchange="ROOMS_FILTER.status=this.value;renderRoomsBoard()">
      <option value="">All statuses</option>
      <option value="In Progress" ${ROOMS_FILTER.status==='In Progress'?'selected':''}>In Progress</option>
      <option value="In Progress - Contractor" ${ROOMS_FILTER.status==='In Progress - Contractor'?'selected':''}>Contractor</option>
      <option value="Pending" ${ROOMS_FILTER.status==='Pending'?'selected':''}>Pending</option>
      <option value="Completed" ${ROOMS_FILTER.status==='Completed'?'selected':''}>Completed</option>
    </select>

    <input type="date" class="fi" style="width:auto;padding:7px 8px;font-size:12px"
      value="${ROOMS_FILTER.dateFrom}"
      onchange="ROOMS_FILTER.dateFrom=this.value;renderRoomsBoard()" title="From date">
    <span style="font-size:11px;color:var(--t3)">→</span>
    <input type="date" class="fi" style="width:auto;padding:7px 8px;font-size:12px"
      value="${ROOMS_FILTER.dateTo}"
      onchange="ROOMS_FILTER.dateTo=this.value;renderRoomsBoard()" title="To date">

    <button class="btn btn-o btn-sm" onclick="clearRoomsFilter()">Clear</button>

    <span style="font-size:11px;color:var(--t3);margin-left:2px">
      ${filtered.length} record${filtered.length!==1?'s':''}
      ${getActiveFilterLabel()!=='All rooms — no filter'?'· <em style=\'font-style:normal;color:var(--g)\'>'+getActiveFilterLabel()+'</em>':''}
    </span>

    <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn btn-o btn-sm" onclick="exportRoomsCSV()">
        <svg viewBox="0 0 16 16" fill="none" style="width:12px;height:12px"><path d="M8 1v10M4 7l4 4 4-4M2 14h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        CSV
      </button>
      <button class="btn btn-g btn-sm" onclick="exportRoomsPDF()">
        <svg viewBox="0 0 16 16" fill="none" style="width:12px;height:12px"><rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        PDF
      </button>
    </div>
  </div>

  <!-- Room grid -->
  <div class="card" style="margin-bottom:14px">
    <div class="card-hd">
      <span class="card-t">Room maintenance board</span>
      <span class="card-badge">Click room = history · Double-click = add job</span>
    </div>
    <div style="overflow-x:auto">
      <div style="min-width:600px;padding:4px 0" id="rooms-grid">
        ${buildRoomsGrid()}
      </div>
    </div>
  </div>

  <!-- Jobs table -->
  <div class="card">
    <div class="card-hd">
      <span class="card-t">
        ${ROOMS_FILTER.room
          ? `Room ${ROOMS_FILTER.room} — job history`
          : ROOMS_FILTER.workType
            ? `${ROOMS_FILTER.workType.replace(/_/g,' ')}${ROOMS_FILTER.subType?' — '+ROOMS_FILTER.subType:''} jobs`
            : 'All room jobs'}
      </span>
      <span class="card-badge">${filtered.length} record${filtered.length!==1?'s':''}</span>
    </div>
    ${filtered.length ? `
    <div class="tbl-wrap">
      <table>
        <thead><tr>
          <th style="width:70px">Date</th>
          <th style="width:70px">Room</th>
          <th style="width:115px">Work type</th>
          <th style="width:90px">Sub type</th>
          <th style="width:105px">Requestor</th>
          <th style="width:110px">Handler</th>
          <th>Details</th>
          <th style="width:112px">Status</th>
          <th style="width:70px">Priority</th>
          <th style="width:80px">Completed</th>
        </tr></thead>
        <tbody>
          ${filtered.map(j=>`<tr style="cursor:pointer" onclick="vTask('${j.id}')">
            <td style="font-family:var(--mono);font-size:11px">${fds(j.date)}</td>
            <td class="td-h">${extractRoom(j.location)||j.location}</td>
            <td>
              <span style="display:flex;align-items:center;gap:5px">
                <span style="width:7px;height:7px;border-radius:50%;background:${wc(j.workType)};flex-shrink:0"></span>
                ${j.workType.replace(/_/g,' ')}
              </span>
            </td>
            <td style="color:var(--t2)">${j.subType}</td>
            <td>${j.requestor}</td>
            <td>${j.handler}</td>
            <td style="color:var(--t2);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
              title="${j.details}">${j.details}</td>
            <td>${sbadge(j.status)}</td>
            <td>${pbadge(j.priority)}</td>
            <td style="font-family:var(--mono);font-size:11px;color:var(--t2)">${j.completion?fds(j.completion):'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `
    <div class="empty-state">
      <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.2"/></svg>
      <p>${ROOMS_FILTER.room?`No jobs found for Room ${ROOMS_FILTER.room}`:'No jobs match the current filters'}</p>
      <small>Try clearing the filters above</small>
    </div>`}
  </div>

  <!-- Room history modal -->
  <div id="room-history-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9000;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px)"
    onclick="if(event.target===this)closeRoomModal()">
    <div id="room-history-content" style="background:var(--s0);border:1px solid var(--b2);border-radius:14px;width:100%;max-width:720px;max-height:88vh;overflow-y:auto;animation:mIn .18s ease"></div>
  </div>
  `;
}

// ── Build room grid HTML ──────────────────────
function buildRoomsGrid() {
  // Pre-build job map
  const jobsMap = {};
  DATA.forEach(j => {
    const room = extractRoom(j.location);
    if (!room) return;
    if (!jobsMap[room]) jobsMap[room] = [];
    jobsMap[room].push(j);
  });

  return ROOM_FLOORS.map(({ floor, rooms }) => {
    const cells = rooms.map(room => {
      const jobs    = jobsMap[room] || [];
      const style   = getRoomCellStyle(room, jobsMap);
      const lastDate = getLastCompletedDate(jobs);
      const lastDateStr = lastDate ? fds(lastDate) : '';
      const days    = lastDate ? daysSince(lastDate) : null;
      const activeCount = jobs.filter(j=>j.status!=='Completed').length;
      const hasUrgent   = jobs.some(j=>j.priority==='Urgent'&&j.status!=='Completed');

      // Tooltip
      const tip = jobs.length
        ? `Room ${room} · ${jobs.length} job${jobs.length!==1?'s':''}${lastDate?` · Last: ${lastDateStr}`:''}`
        : `Room ${room} · No maintenance history`;

      return `<div
        onclick="openRoomModal('${room}')"
        title="${tip}"
        style="
          width:52px;height:46px;border-radius:5px;
          display:inline-flex;flex-direction:column;
          align-items:center;justify-content:center;
          cursor:pointer;
          background:${style.bg};
          border:1.5px solid ${style.border};
          opacity:${style.dim?0.25:1};
          transition:all .13s;
          position:relative;
          margin:2px;
          flex-shrink:0;
        "
        onmouseover="this.style.transform='translateY(-2px)';this.style.opacity='1';this.style.boxShadow='0 4px 14px rgba(0,0,0,.5)'"
        onmouseout="this.style.transform='';this.style.opacity='${style.dim?0.25:1}';this.style.boxShadow=''"
      >
        <span style="font-size:10.5px;font-weight:700;color:${style.text};line-height:1.1">${room}</span>
        ${lastDateStr
          ? `<span style="font-size:7.5px;color:${style.text};opacity:.75;line-height:1;margin-top:1px">${lastDateStr}</span>`
          : jobs.length
            ? `<span style="font-size:7.5px;color:${style.text};opacity:.6;line-height:1;margin-top:1px">${activeCount}▲</span>`
            : ''}
        ${hasUrgent?`<span style="position:absolute;top:-3px;right:-3px;width:8px;height:8px;border-radius:50%;background:var(--red);border:1.5px solid var(--s0)"></span>`:''}
      </div>`;
    }).join('');

    return `<div style="display:flex;align-items:center;margin-bottom:3px;flex-wrap:nowrap">
      <span style="font-size:10px;font-weight:700;color:var(--t3);width:28px;flex-shrink:0;text-align:right;padding-right:6px">${floor}</span>
      <div style="display:flex;flex-wrap:wrap">${cells}</div>
    </div>`;
  }).join('');
}

// ── Open room history modal ───────────────────
function openRoomModal(roomNum) {
  const jobs = DATA.filter(j => extractRoom(j.location) === roomNum)
    .sort((a,b) => b.date.localeCompare(a.date));

  const completed  = jobs.filter(j=>j.status==='Completed');
  const active     = jobs.filter(j=>j.status==='In Progress'||j.status==='In Progress - Contractor');
  const lastDate   = getLastCompletedDate(jobs);
  const days       = lastDate ? daysSince(lastDate) : null;
  const ageLabel   = days===null ? 'Never serviced'
    : days<=30  ? `Serviced ${days}d ago — ✅ Recent`
    : days<=90  ? `Serviced ${days}d ago — ⚠️ Aging`
    : `Serviced ${days}d ago — 🔴 Overdue`;
  const ageColor = days===null?'var(--t3)':days<=30?'var(--g)':days<=90?'var(--amber)':'var(--red)';

  // Most common work type
  const wtCount = {};
  jobs.forEach(j=>{wtCount[j.workType]=(wtCount[j.workType]||0)+1;});
  const topWt = Object.entries(wtCount).sort((a,b)=>b[1]-a[1])[0];

  const modal = document.getElementById('room-history-modal');
  const content = document.getElementById('room-history-content');

  content.innerHTML = `
    <!-- Modal header -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px 14px;border-bottom:1px solid var(--b0)">
      <div>
        <div style="font-size:18px;font-weight:700;color:var(--t0)">Room ${roomNum}</div>
        <div style="font-size:12px;color:${ageColor};margin-top:3px">${ageLabel}</div>
      </div>
      <button onclick="closeRoomModal()" style="background:none;border:none;color:var(--t2);cursor:pointer;font-size:20px;line-height:1;padding:4px 8px">✕</button>
    </div>

    <!-- Summary stats -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:16px 22px;border-bottom:1px solid var(--b0)">
      ${[
        {l:'Total jobs',     v:jobs.length,      c:'var(--g)'},
        {l:'Completed',      v:completed.length,  c:'var(--g)'},
        {l:'Active now',     v:active.length,     c:'var(--blue)'},
        {l:'Top issue',      v:topWt?topWt[0].replace(/_/g,' '):'—', c:'var(--t1)', sm:true},
      ].map(k=>`<div style="background:var(--s2);border:1px solid var(--b0);border-radius:var(--r);padding:10px 12px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px">${k.l}</div>
        <div style="font-size:${k.sm?'13':'22'}px;font-weight:700;color:${k.c};font-family:var(--mono)">${k.v}</div>
      </div>`).join('')}
    </div>

    <!-- Full job history table -->
    <div style="padding:14px 22px">
      <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Full maintenance history</div>
      ${jobs.length ? `
      <div style="overflow-x:auto;border-radius:var(--r);border:1px solid var(--b0)">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr>
            <th style="padding:8px 10px;background:var(--s2);color:var(--t2);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;border-bottom:1px solid var(--b0);white-space:nowrap">Date</th>
            <th style="padding:8px 10px;background:var(--s2);color:var(--t2);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;border-bottom:1px solid var(--b0);white-space:nowrap">Work type</th>
            <th style="padding:8px 10px;background:var(--s2);color:var(--t2);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;border-bottom:1px solid var(--b0);white-space:nowrap">Sub type</th>
            <th style="padding:8px 10px;background:var(--s2);color:var(--t2);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;border-bottom:1px solid var(--b0);white-space:nowrap">Requestor</th>
            <th style="padding:8px 10px;background:var(--s2);color:var(--t2);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;border-bottom:1px solid var(--b0);white-space:nowrap">Handler</th>
            <th style="padding:8px 10px;background:var(--s2);color:var(--t2);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;border-bottom:1px solid var(--b0)">Details</th>
            <th style="padding:8px 10px;background:var(--s2);color:var(--t2);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;border-bottom:1px solid var(--b0);white-space:nowrap">Status</th>
            <th style="padding:8px 10px;background:var(--s2);color:var(--t2);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;border-bottom:1px solid var(--b0);white-space:nowrap">Completed</th>
          </tr></thead>
          <tbody>
            ${jobs.map((j,i)=>`<tr style="border-bottom:1px solid var(--b0);background:${i%2===0?'transparent':'var(--s2)'}">
              <td style="padding:8px 10px;color:var(--t2);font-family:var(--mono);font-size:11px;white-space:nowrap">${fds(j.date)}</td>
              <td style="padding:8px 10px;color:var(--t0);font-weight:500;white-space:nowrap">
                <span style="display:flex;align-items:center;gap:5px">
                  <span style="width:7px;height:7px;border-radius:50%;background:${wc(j.workType)};flex-shrink:0"></span>
                  ${j.workType.replace(/_/g,' ')}
                </span>
              </td>
              <td style="padding:8px 10px;color:var(--t2)">${j.subType}</td>
              <td style="padding:8px 10px;color:var(--t1)">${j.requestor}</td>
              <td style="padding:8px 10px;color:var(--t1)">${j.handler}</td>
              <td style="padding:8px 10px;color:var(--t2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${j.details}">${j.details}</td>
              <td style="padding:8px 10px;white-space:nowrap">${sbadge(j.status)}</td>
              <td style="padding:8px 10px;color:var(--t2);font-family:var(--mono);font-size:11px;white-space:nowrap">${j.completion?fds(j.completion):'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `<div style="text-align:center;padding:28px;color:var(--t3)">No maintenance history for this room.</div>`}
    </div>

    <!-- Modal footer -->
    <div style="padding:14px 22px;border-top:1px solid var(--b0);display:flex;justify-content:flex-end;gap:8px">
      <button class="btn btn-o btn-sm" onclick="exportRoomHistoryPDF('${roomNum}')">
        <svg viewBox="0 0 16 16" fill="none" style="width:12px;height:12px"><rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        Export PDF
      </button>
      <button class="btn btn-g btn-sm" onclick="closeRoomModal();addJobForRoom('${roomNum}')">
        <svg viewBox="0 0 16 16" fill="none" style="width:12px;height:12px"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        + Add job for Room ${roomNum}
      </button>
      <button class="btn btn-o btn-sm" onclick="closeRoomModal()">Close</button>
    </div>
  `;

  modal.style.display = 'flex';
}

function closeRoomModal() {
  const m = document.getElementById('room-history-modal');
  if (m) m.style.display = 'none';
}

// ── Add job shortcut — pre-fills room ─────────
function addJobForRoom(roomNum) {
  go('add', document.getElementById('nb-add'));
  setTimeout(() => {
    const loc = document.getElementById('af-lc');
    if (loc) { loc.value = `Room ${roomNum}`; loc.focus(); }
  }, 150);
}

// ── Clear all filters ──────────────────────────
function clearRoomsFilter() {
  ROOMS_FILTER = { room:'', workType:'', subType:'', handler:'', status:'', dateFrom:'', dateTo:'' };
  renderRoomsBoard();
}

// ── Export CSV ────────────────────────────────
function exportRoomsCSV() {
  const data = getRoomsFilteredJobs();
  if (!data.length) { toast('No data to export.','e'); return; }

  const BOM = '\uFEFF';
  const label = getActiveFilterLabel();
  const genDate = new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});

  const summary = [
    '"MaintainPro — Room Maintenance Report"',
    `"Filter:","${label}"`,
    `"Generated:","${genDate}"`,
    `"Total records:","${data.length}"`,
    '""',
    '"Date","Room","Work Type","Sub Type","Requestor","Handler","Details","Status","Priority","Completed"',
  ];

  const rows = data.map(j=>[
    j.date,
    extractRoom(j.location)||j.location,
    j.workType.replace(/_/g,' '),
    j.subType,
    j.requestor,
    j.handler,
    j.details,
    j.status,
    j.priority,
    j.completion||''
  ].map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(','));

  const csv = BOM + summary.join('\n') + '\n' + rows.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = `MaintainPro-Rooms-${getTODAY()}.csv`;
  a.click();
  toast(`CSV exported — ${data.length} records`,'s');
}

// ── Export PDF — full board report ────────────
function exportRoomsPDF() {
  const data = getRoomsFilteredJobs();
  if (!data.length) { toast('No data to export.','e'); return; }
  generateRoomsPDF(data, getActiveFilterLabel(), 'All rooms');
}

// ── Export PDF — single room history ──────────
function exportRoomHistoryPDF(roomNum) {
  const data = DATA.filter(j=>extractRoom(j.location)===roomNum)
    .sort((a,b)=>b.date.localeCompare(a.date));
  if (!data.length) { toast('No history to export.','e'); return; }
  generateRoomsPDF(data, `Room ${roomNum}`, `Room ${roomNum}`);
}

// ── Core PDF generator ────────────────────────
function generateRoomsPDF(data, filterLabel, title) {
  const genDate = new Date().toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const comp    = data.filter(j=>j.status==='Completed').length;
  const active  = data.filter(j=>j.status==='In Progress'||j.status==='In Progress - Contractor').length;
  const rate    = data.length ? Math.round(comp/data.length*100) : 0;

  const stColor={'Completed':'#16a34a','In Progress':'#2563eb','In Progress - Contractor':'#d97706','Pending':'#7c3aed'};
  const stBg   ={'Completed':'#dcfce7','In Progress':'#dbeafe','In Progress - Contractor':'#fef3c7','Pending':'#ede9fe'};
  const prColor={Low:'#64748b',Medium:'#2563eb',High:'#d97706',Urgent:'#dc2626'};
  const prBg   ={Low:'#f1f5f9',Medium:'#dbeafe',High:'#fef3c7',Urgent:'#fee2e2'};

  const badge=(text,c,bg)=>`<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;color:${c};background:${bg};white-space:nowrap">${text}</span>`;

  // Group by room for summary section
  const byRoom = {};
  data.forEach(j=>{
    const r=extractRoom(j.location)||j.location;
    if(!byRoom[r])byRoom[r]=[];
    byRoom[r].push(j);
  });

  const rows = data.map((j,i)=>`
    <tr style="background:${i%2===0?'#fff':'#f8fafc'}">
      <td style="padding:6px 9px;font-size:10px;color:#64748b;font-family:monospace;white-space:nowrap">${fds(j.date)}</td>
      <td style="padding:6px 9px;font-size:11px;font-weight:700;color:#0f172a">${extractRoom(j.location)||j.location}</td>
      <td style="padding:6px 9px;font-size:11px;color:#475569">${j.workType.replace(/_/g,' ')}</td>
      <td style="padding:6px 9px;font-size:11px;color:#64748b">${j.subType}</td>
      <td style="padding:6px 9px;font-size:11px;color:#475569">${j.requestor}</td>
      <td style="padding:6px 9px;font-size:11px;color:#475569">${j.handler}</td>
      <td style="padding:6px 9px;font-size:11px;color:#64748b;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${j.details}">${j.details}</td>
      <td style="padding:6px 9px">${badge(j.status,stColor[j.status]||'#475569',stBg[j.status]||'#f1f5f9')}</td>
      <td style="padding:6px 9px">${badge(j.priority,prColor[j.priority]||'#64748b',prBg[j.priority]||'#f1f5f9')}</td>
      <td style="padding:6px 9px;font-size:10px;color:#64748b;font-family:monospace;white-space:nowrap">${j.completion?fds(j.completion):'—'}</td>
    </tr>`).join('');

  const roomSummaryRows = Object.entries(byRoom).sort((a,b)=>a[0]-b[0]).map(([room,jobs])=>{
    const done=jobs.filter(j=>j.status==='Completed').length;
    const act=jobs.filter(j=>j.status!=='Completed').length;
    const last=getLastCompletedDate(jobs);
    const d=last?daysSince(last):null;
    const col=d===null?'#94a3b8':d<=30?'#16a34a':d<=90?'#d97706':'#dc2626';
    return `<tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:6px 10px;font-weight:700;color:#0f172a">${room}</td>
      <td style="padding:6px 10px;text-align:center">${jobs.length}</td>
      <td style="padding:6px 10px;text-align:center">${done}</td>
      <td style="padding:6px 10px;text-align:center">${act}</td>
      <td style="padding:6px 10px;font-size:11px;color:${col}">${last?fds(last)+` (${d}d ago)`:'Never'}</td>
      <td style="padding:6px 10px;font-size:11px;color:#64748b">${[...new Set(jobs.map(j=>j.workType.replace(/_/g,' ')))].slice(0,3).join(', ')}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>MaintainPro — ${title} Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#1a202c;background:#fff}
@page{size:A4 landscape;margin:15mm 14mm}
@media print{.no-print{display:none!important}body{font-size:11px}}
.header{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:22px 28px;border-radius:10px;margin-bottom:20px;display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px}
.brand{display:flex;align-items:center;gap:12px}
.brand-icon{width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#6ebe2a,#2dcfb3);display:flex;align-items:center;justify-content:center}
.brand-name{font-size:20px;font-weight:800;letter-spacing:-.02em}
.brand-sub{font-size:11px;opacity:.7;margin-top:2px}
.meta{text-align:right;font-size:11px;opacity:.8;line-height:1.8}
.kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
.kpi{border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;border-top:3px solid}
.section{font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
table{width:100%;border-collapse:collapse}
th{background:#0f172a;color:#fff;padding:8px 9px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
td{border-bottom:1px solid #e2e8f0}
.footer{margin-top:16px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between}
.print-bar{position:fixed;top:0;left:0;right:0;background:#0f172a;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:999}
.pbtn{padding:7px 16px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:inherit}
@media print{.print-bar{display:none!important}.content{margin-top:0!important}}
</style></head><body>
<div class="print-bar no-print">
  <span style="font-weight:700">MaintainPro — ${title} Report</span>
  <div style="display:flex;gap:8px">
    <button class="pbtn" style="background:rgba(255,255,255,.1);color:#fff" onclick="window.close()">✕ Close</button>
    <button class="pbtn" style="background:#6ebe2a;color:#fff" onclick="window.print()">🖨️ Print / Save PDF</button>
  </div>
</div>
<div class="content" style="margin-top:50px;padding:20px">
<div class="header">
  <div class="brand">
    <div class="brand-icon"><svg viewBox="0 0 20 20" fill="none" width="22" height="22"><rect x="2" y="2" width="6" height="6" rx="1.5" fill="white"/><rect x="12" y="2" width="6" height="6" rx="1.5" fill="white" opacity=".6"/><rect x="2" y="12" width="6" height="6" rx="1.5" fill="white" opacity=".6"/><rect x="12" y="12" width="6" height="6" rx="1.5" fill="white" opacity=".3"/></svg></div>
    <div><div class="brand-name">MaintainPro</div><div class="brand-sub">Room Maintenance Board — ${title}</div></div>
  </div>
  <div class="meta">
    <div>Filter: <strong>${filterLabel}</strong></div>
    <div>Generated: ${genDate}</div>
    <div>${data.length} records · ${comp} completed · ${rate}% rate</div>
    <div style="margin-top:5px;padding:4px 12px;border-radius:99px;background:rgba(110,190,42,.2);border:1px solid rgba(110,190,42,.3);color:#a3e635;display:inline-block;font-weight:700">${title}</div>
  </div>
</div>

<div class="kpi-row">
  ${[
    {v:data.length,l:'Total jobs',c:'#0ea5e9'},
    {v:comp,l:'Completed',c:'#22c55e'},
    {v:rate+'%',l:'Completion rate',c:'#6ebe2a'},
    {v:active,l:'Active now',c:'#3b82f6'},
    {v:Object.keys(byRoom).length,l:'Rooms tracked',c:'#a78bfa'},
  ].map(k=>`<div class="kpi" style="border-top-color:${k.c}">
    <div style="font-size:22px;font-weight:800;color:${k.c};font-family:monospace">${k.v}</div>
    <div style="font-size:9px;color:#64748b;margin-top:3px;text-transform:uppercase;letter-spacing:.06em">${k.l}</div>
  </div>`).join('')}
</div>

<div class="section" style="margin-bottom:10px">Room summary</div>
<table style="margin-bottom:18px">
  <thead><tr>
    <th>Room</th><th style="text-align:center">Jobs</th><th style="text-align:center">Done</th>
    <th style="text-align:center">Active</th><th>Last serviced</th><th>Work types</th>
  </tr></thead>
  <tbody>${roomSummaryRows}</tbody>
</table>

<div class="section" style="margin-bottom:10px">Full job listing (${data.length} records)</div>
<table>
  <thead><tr>
    <th>Date</th><th>Room</th><th>Work type</th><th>Sub type</th>
    <th>Requestor</th><th>Handler</th><th>Details</th><th>Status</th><th>Priority</th><th>Completed</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="footer">
  <span>MaintainPro Hotel Maintenance Platform</span>
  <span>${filterLabel} · ${genDate}</span>
</div>
</div>
<script>setTimeout(()=>window.print(),800);<\/script>
</body></html>`;

  const w = window.open('','_blank','width=1200,height=850');
  if (!w) { toast('Pop-up blocked — allow pop-ups to export PDF.','e'); return; }
  w.document.write(html);
  w.document.close();
  toast('PDF report opened — Print → Save as PDF','s');
}

// ── Re-render if rooms page is active (called by Firebase listener) ──
function refreshRoomsIfVisible() {
  const el = document.getElementById('page-rooms');
  if (el && el.classList.contains('on')) renderRoomsBoard();
}
