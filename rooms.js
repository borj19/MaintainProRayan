// ═══════════════════════════════════════════════
// rooms.js — Preventive Maintenance Board
// Rooms Panel: tracks maintenance per room,
// highlights rooms with active/completed jobs,
// fully connected to Firebase via shared DATA array.
// ═══════════════════════════════════════════════

// ── Room grid definition (matches hotel layout) ─
// Format: { floor, rooms[] }
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
  room: '',
  workType: '',
  handler: '',
  status: '',
  dateFrom: '',
  dateTo: '',
};

// ── Extract room number from location string ──
// e.g. "Room 712" → "712", "Room 1015" → "1015"
function extractRoom(location) {
  if (!location) return null;
  const m = location.match(/\b(\d{3,4})\b/);
  return m ? m[1] : null;
}

// ── Get all jobs that belong to a specific room ─
function getJobsForRoom(roomNum) {
  return DATA.filter(j => extractRoom(j.location) === roomNum);
}

// ── Get the "worst" status for a room (for colour) ─
// Priority: In Progress > Pending > Completed > none
function getRoomStatus(jobs) {
  if (!jobs.length) return 'none';
  const active = jobs.find(j => j.status === 'In Progress' || j.status === 'In Progress - Contractor');
  if (active) return 'active';
  const pending = jobs.find(j => j.status === 'Pending');
  if (pending) return 'pending';
  const done = jobs.filter(j => j.status === 'Completed');
  if (done.length) return 'completed';
  return 'none';
}

// ── Get filtered jobs for the table below the board ─
function getRoomsFilteredJobs() {
  return DATA.filter(j => {
    const room = extractRoom(j.location);
    if (!room) return false;                                         // non-room locations excluded
    if (ROOMS_FILTER.room && room !== ROOMS_FILTER.room) return false;
    if (ROOMS_FILTER.workType && j.workType !== ROOMS_FILTER.workType) return false;
    if (ROOMS_FILTER.handler && j.handler !== ROOMS_FILTER.handler) return false;
    if (ROOMS_FILTER.status && j.status !== ROOMS_FILTER.status) return false;
    if (ROOMS_FILTER.dateFrom && j.date < ROOMS_FILTER.dateFrom) return false;
    if (ROOMS_FILTER.dateTo && j.date > ROOMS_FILTER.dateTo) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));
}

// ── Main render function ──────────────────────
function renderRoomsBoard() {
  const el = document.getElementById('page-rooms');
  if (!el) return;

  const filtered = getRoomsFilteredJobs();
  const totalRoomJobs = DATA.filter(j => extractRoom(j.location)).length;
  const activeRooms = new Set(DATA.filter(j =>
    j.status === 'In Progress' || j.status === 'In Progress - Contractor'
  ).map(j => extractRoom(j.location)).filter(Boolean)).size;

  el.innerHTML = `
    <!-- ── Stats bar ── -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px">
      ${[
        { c:'var(--g)',    l:'Total room jobs', v: totalRoomJobs },
        { c:'var(--blue)', l:'Active rooms',    v: activeRooms },
        { c:'var(--amber)',l:'Pending',          v: DATA.filter(j=>j.status==='Pending'&&extractRoom(j.location)).length },
        { c:'var(--g)',    l:'Completed',        v: DATA.filter(j=>j.status==='Completed'&&extractRoom(j.location)).length },
      ].map(k=>`<div class="kpi"><div class="kpi-bar" style="background:${k.c}"></div>
        <div class="kpi-lbl">${k.l}</div>
        <div class="kpi-val">${k.v}</div>
      </div>`).join('')}
    </div>

    <!-- ── Legend ── -->
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
      <span style="font-size:10.5px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.07em">Legend:</span>
      ${[
        ['#1a3a1a','var(--t3)','No jobs'],
        ['rgba(85,153,245,.25)','var(--blue)','Active / In Progress'],
        ['rgba(240,166,46,.25)','var(--amber)','Pending'],
        ['rgba(110,190,42,.25)','var(--g)','Completed'],
        ['rgba(232,83,74,.25)','var(--red)','Urgent'],
      ].map(([bg,border,label])=>`
        <span style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--t1)">
          <span style="width:22px;height:16px;border-radius:3px;background:${bg};border:1.5px solid ${border};display:inline-block"></span>
          ${label}
        </span>`).join('')}
    </div>

    <!-- ── Filter bar ── -->
    <div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 14px;background:var(--s1);border:1px solid var(--b0);border-radius:var(--r2);margin-bottom:14px">
      <input type="text" id="rf-room" class="fi" style="width:110px;padding:7px 10px;font-size:12px"
        placeholder="Room no." value="${ROOMS_FILTER.room}"
        oninput="ROOMS_FILTER.room=this.value.trim();renderRoomsBoard()">
      <select id="rf-wt" class="fi" style="width:auto;padding:7px 10px;font-size:12px"
        onchange="ROOMS_FILTER.workType=this.value;renderRoomsBoard()">
        <option value="">All work types</option>
        ${Object.keys(SUBTYPES).map(w=>`<option value="${w}" ${ROOMS_FILTER.workType===w?'selected':''}>${w.replace(/_/g,' ')}</option>`).join('')}
      </select>
      <select id="rf-hd" class="fi" style="width:auto;padding:7px 10px;font-size:12px"
        onchange="ROOMS_FILTER.handler=this.value;renderRoomsBoard()">
        <option value="">All handlers</option>
        ${HNDS.map(h=>`<option value="${h}" ${ROOMS_FILTER.handler===h?'selected':''}>${h}</option>`).join('')}
      </select>
      <select id="rf-st" class="fi" style="width:auto;padding:7px 10px;font-size:12px"
        onchange="ROOMS_FILTER.status=this.value;renderRoomsBoard()">
        <option value="">All statuses</option>
        <option value="In Progress" ${ROOMS_FILTER.status==='In Progress'?'selected':''}>In Progress</option>
        <option value="In Progress - Contractor" ${ROOMS_FILTER.status==='In Progress - Contractor'?'selected':''}>Contractor</option>
        <option value="Pending" ${ROOMS_FILTER.status==='Pending'?'selected':''}>Pending</option>
        <option value="Completed" ${ROOMS_FILTER.status==='Completed'?'selected':''}>Completed</option>
      </select>
      <input type="date" id="rf-from" class="fi" style="width:auto;padding:7px 8px;font-size:12px"
        value="${ROOMS_FILTER.dateFrom}"
        onchange="ROOMS_FILTER.dateFrom=this.value;renderRoomsBoard()" title="Date from">
      <input type="date" id="rf-to" class="fi" style="width:auto;padding:7px 8px;font-size:12px"
        value="${ROOMS_FILTER.dateTo}"
        onchange="ROOMS_FILTER.dateTo=this.value;renderRoomsBoard()" title="Date to">
      <button class="btn btn-o btn-sm" onclick="clearRoomsFilter()">Clear</button>
      <span style="font-size:11px;color:var(--t3);align-self:center;margin-left:4px">
        ${filtered.length} record${filtered.length!==1?'s':''}
      </span>
    </div>

    <!-- ── Room grid board ── -->
    <div class="card" style="margin-bottom:14px;overflow-x:auto">
      <div class="card-hd">
        <span class="card-t">Room maintenance board</span>
        <span class="card-badge">Click any room to filter</span>
      </div>
      <div id="rooms-grid" style="min-width:700px">
        ${renderRoomsGrid()}
      </div>
    </div>

    <!-- ── Jobs table ── -->
    <div class="card">
      <div class="card-hd">
        <span class="card-t">
          ${ROOMS_FILTER.room ? `Room ${ROOMS_FILTER.room} — job history` : 'All room jobs'}
        </span>
        <span class="card-badge">${filtered.length} record${filtered.length!==1?'s':''}</span>
      </div>
      ${filtered.length ? `
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th style="width:72px">Date</th>
            <th style="width:80px">Room</th>
            <th style="width:110px">Work type</th>
            <th style="width:90px">Sub type</th>
            <th style="width:110px">Handler</th>
            <th>Details</th>
            <th style="width:112px">Status</th>
            <th style="width:72px">Priority</th>
            <th style="width:86px">Completed</th>
          </tr></thead>
          <tbody>
            ${filtered.map(j=>`<tr style="cursor:pointer" onclick="vTask('${j.id}')">
              <td style="font-family:var(--mono);font-size:11px">${fds(j.date)}</td>
              <td class="td-h">${extractRoom(j.location)||j.location}</td>
              <td>
                <span style="display:flex;align-items:center;gap:5px">
                  <span style="width:8px;height:8px;border-radius:50%;background:${wc(j.workType)};flex-shrink:0"></span>
                  ${j.workType.replace(/_/g,' ')}
                </span>
              </td>
              <td style="color:var(--t2)">${j.subType}</td>
              <td>${j.handler}</td>
              <td style="color:var(--t2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
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
        <p>${ROOMS_FILTER.room ? `No jobs found for Room ${ROOMS_FILTER.room}` : 'No room jobs match the current filters'}</p>
        <small>Try clearing the filters above</small>
      </div>`}
    </div>
  `;
}

// ── Render the room number grid ───────────────
function renderRoomsGrid() {
  // Build a map: roomNum → status
  const roomStatusMap = {};
  const roomJobsMap = {};
  DATA.forEach(j => {
    const room = extractRoom(j.location);
    if (!room) return;
    if (!roomJobsMap[room]) roomJobsMap[room] = [];
    roomJobsMap[room].push(j);
  });
  Object.keys(roomJobsMap).forEach(room => {
    roomStatusMap[room] = getRoomStatus(roomJobsMap[room]);
  });

  const STATUS_STYLE = {
    none:      { bg:'#1a3a1a',                    border:'var(--b0)',       text:'var(--t3)' },
    active:    { bg:'rgba(85,153,245,.22)',        border:'var(--blue)',     text:'var(--blue)' },
    pending:   { bg:'rgba(240,166,46,.2)',         border:'var(--amber)',    text:'var(--amber)' },
    completed: { bg:'rgba(110,190,42,.2)',         border:'var(--g)',        text:'var(--g)' },
    urgent:    { bg:'rgba(232,83,74,.22)',         border:'var(--red)',      text:'var(--red)' },
  };

  return ROOM_FLOORS.map(({ floor, rooms }) => {
    const cells = rooms.map(room => {
      const jobs = roomJobsMap[room] || [];
      // Check for urgent
      const hasUrgent = jobs.some(j => j.priority === 'Urgent' && j.status !== 'Completed');
      let statusKey = hasUrgent ? 'urgent' : (roomStatusMap[room] || 'none');

      // If filter is active and this room doesn't match, dim it
      const isFiltered = ROOMS_FILTER.room && ROOMS_FILTER.room !== room;
      const style = STATUS_STYLE[statusKey];

      const jobCount = jobs.length;
      const activeCount = jobs.filter(j => j.status !== 'Completed').length;

      // Tooltip content
      const tipJobs = jobs.slice(-3).map(j =>
        `${j.workType.replace(/_/g,' ')} — ${j.status}`
      ).join('&#10;');
      const tip = jobCount
        ? `Room ${room}: ${jobCount} job${jobCount!==1?'s':''}, ${activeCount} active&#10;${tipJobs}`
        : `Room ${room}: No jobs`;

      return `<div
        onclick="selectRoom('${room}')"
        title="${tip}"
        style="
          width:44px;height:36px;border-radius:4px;
          display:inline-flex;flex-direction:column;
          align-items:center;justify-content:center;
          cursor:pointer;
          background:${isFiltered ? '#111507' : style.bg};
          border:1.5px solid ${isFiltered ? 'var(--b0)' : style.border};
          opacity:${isFiltered ? 0.35 : 1};
          transition:all .15s;
          position:relative;
          margin:2px;
        "
        onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,.4)'"
        onmouseout="this.style.transform='';this.style.boxShadow=''"
      >
        <span style="font-size:10px;font-weight:700;color:${isFiltered?'var(--t3)':style.text};line-height:1">${room}</span>
        ${jobCount ? `<span style="font-size:8px;color:${isFiltered?'var(--t3)':style.text};opacity:.8;margin-top:1px">${activeCount>0?activeCount+'▲':jobCount+'✓'}</span>` : ''}
        ${hasUrgent && !isFiltered ? `<span style="position:absolute;top:-3px;right:-3px;width:7px;height:7px;border-radius:50%;background:var(--red);border:1.5px solid var(--s1)"></span>` : ''}
      </div>`;
    }).join('');

    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
      <span style="font-size:10px;font-weight:700;color:var(--t3);width:26px;flex-shrink:0;text-align:right">${floor}</span>
      <div style="display:flex;flex-wrap:wrap;gap:0">${cells}</div>
    </div>`;
  }).join('');
}

// ── Click a room cell → filter to that room ──
function selectRoom(roomNum) {
  if (ROOMS_FILTER.room === roomNum) {
    // Second click clears filter
    ROOMS_FILTER.room = '';
  } else {
    ROOMS_FILTER.room = roomNum;
  }
  renderRoomsBoard();
}

// ── Clear all filters ──────────────────────────
function clearRoomsFilter() {
  ROOMS_FILTER = { room:'', workType:'', handler:'', status:'', dateFrom:'', dateTo:'' };
  renderRoomsBoard();
}

// ── Called by firebase.js onSnapshot when DATA updates ─
// Ensures the board reflects real-time changes
function refreshRoomsIfVisible() {
  const el = document.getElementById('page-rooms');
  if (el && el.classList.contains('on')) {
    renderRoomsBoard();
  }
}
