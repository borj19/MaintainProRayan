// ═══════════════════════════════════════════════
// dashboard.js — with personalized hero banner
// ═══════════════════════════════════════════════

let dashFilteredData = DATA;

function setDashFilter(f, el) {
  dashFilter = f;
  document.querySelectorAll('.dash-filter-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  rDash();
}

function getDashData() {
  const today = getTODAY();
  const now = new Date(today);
  if (dashFilter === 'today') return DATA.filter(r => r.date === today);
  if (dashFilter === 'week') {
    const cut = new Date(now); cut.setDate(cut.getDate() - 7);
    return DATA.filter(r => new Date(r.date) >= cut);
  }
  if (dashFilter === 'month') {
    const cut = new Date(now); cut.setDate(1);
    return DATA.filter(r => new Date(r.date) >= cut);
  }
  return DATA;
}

// ═══════════════════════════════════════════════
// PERSONALIZED HERO BANNER
// ═══════════════════════════════════════════════
function renderDashHero() {
  const heroEl = document.getElementById('d-hero');
  if (!heroEl || !currentUser) return;

  const hour = new Date().getHours();
  let greeting, icon;
  if (hour >= 5 && hour < 12)       { greeting = 'Good morning';   icon = '☀️'; }
  else if (hour >= 12 && hour < 17) { greeting = 'Good afternoon'; icon = '🌤️'; }
  else if (hour >= 17 && hour < 22) { greeting = 'Good evening';   icon = '🌙'; }
  else                              { greeting = 'Hello';          icon = '✨'; }

  const firstName = (currentUser.name || 'there').split(' ')[0];
  const roleLabel = (typeof ROLE_LABELS !== 'undefined' && ROLE_LABELS[currentUser.role])
    ? ROLE_LABELS[currentUser.role]
    : (currentUser.role || 'User');
  const dept = currentUser.dept || '';
  const subtitle = dept ? `${roleLabel} · ${dept}` : roleLabel;
  const todayStr = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const role = currentUser.role;
  const myEmail = currentUser.email || '';
  const myName = currentUser.name || '';
  const myUid = currentUser.uid || currentUser.id || '';
  let stats = [];
  let scope = '';

  if (role === 'admin') {
    scope = 'across the system';
    const urgent = DATA.filter(r => r.priority === 'Urgent' && r.status !== 'Completed').length;
    const inProg = DATA.filter(r => r.status === 'In Progress' || r.status === 'In Progress - Contractor').length;
    const today = DATA.filter(r => r.date === getTODAY()).length;
    stats = [
      { v: urgent, l: 'urgent',      c: 'var(--red)' },
      { v: inProg, l: 'in progress', c: 'var(--blue)' },
      { v: today,  l: 'today',       c: 'var(--g)' },
    ];
  } else if (role === 'staff') {
    scope = 'assigned to you';
    const mine = DATA.filter(r => r.handler === myName);
    const myUrgent = mine.filter(r => r.priority === 'Urgent' && r.status !== 'Completed').length;
    const myActive = mine.filter(r => r.status === 'In Progress' || r.status === 'In Progress - Contractor').length;
    const myDone = mine.filter(r => r.status === 'Completed' && r.completion === getTODAY()).length;
    stats = [
      { v: myUrgent, l: 'urgent',     c: 'var(--red)' },
      { v: myActive, l: 'active',     c: 'var(--blue)' },
      { v: myDone,   l: 'done today', c: 'var(--g)' },
    ];
  } else if (role === 'requester') {
    scope = 'in your requests';
    const mine = DATA.filter(r =>
      r.requestor === myName ||
      r.createdBy === myEmail ||
      r.createdByUid === myUid
    );
    const pending = mine.filter(r => r.status === 'Pending').length;
    const inProg = mine.filter(r => r.status === 'In Progress' || r.status === 'In Progress - Contractor').length;
    const done = mine.filter(r => r.status === 'Completed').length;
    stats = [
      { v: pending, l: 'pending',     c: 'var(--amber)' },
      { v: inProg,  l: 'in progress', c: 'var(--blue)' },
      { v: done,    l: 'completed',   c: 'var(--g)' },
    ];
  } else if (role === 'contractor') {
    scope = 'assigned to you';
    const mine = DATA.filter(r => r.status === 'In Progress - Contractor');
    const myUrgent = mine.filter(r => r.priority === 'Urgent' && r.status !== 'Completed').length;
    stats = [
      { v: mine.length, l: 'active jobs', c: 'var(--blue)' },
      { v: myUrgent,    l: 'urgent',      c: 'var(--red)' },
    ];
  }

  const actions = [];
  if (typeof can === 'function') {
    if (can('submit_request')) actions.push({
      label: 'Submit request', page: 'request',
      icon: '<path d="M3 3h10v10H3z" stroke="currentColor" stroke-width="1.5"/><path d="M6 7h4M6 10h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
    });
    if (can('view_inprogress')) actions.push({
      label: 'In progress', page: 'inprogress',
      icon: '<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    });
    if (can('view_all_tasks')) actions.push({
      label: 'Rooms board', page: 'rooms',
      icon: '<rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>'
    });
  }
  const visibleActions = actions.slice(0, 4);

  heroEl.innerHTML = `
    <div class="hero-bg"></div>
    <div class="hero-content">
      <div class="hero-main">
        <div class="hero-greeting">
          <span class="hero-icon">${icon}</span>
          <span class="hero-text">${greeting}, <strong>${firstName}</strong></span>
        </div>
        <div class="hero-meta">
          <span class="hero-role">${subtitle}</span>
          <span class="hero-dot">·</span>
          <span class="hero-date">${todayStr}</span>
        </div>
        ${stats.length ? `
          <div class="hero-stats">
            ${stats.map(s => `
              <span class="hero-stat">
                <span class="hero-stat-dot" style="background:${s.c}"></span>
                <strong>${s.v}</strong>
                <span class="hero-stat-lbl">${s.l}</span>
              </span>
            `).join('')}
            <span class="hero-stats-scope">${scope}</span>
          </div>
        ` : ''}
      </div>
      ${visibleActions.length ? `
        <div class="hero-actions">
          ${visibleActions.map(a => `
            <button class="hero-chip" onclick="go('${a.page}', null)">
              <svg viewBox="0 0 16 16" fill="none">${a.icon}</svg>
              <span>${a.label}</span>
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ─── Sparkline generator — tiny 7-day trend line ───
function buildSparkline(values, color){
  if(!values || values.length < 2) return '';
  const w = 100, h = 22, pad = 2;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const xStep = (w - pad*2) / (values.length - 1);
  // Build smooth path
  const pts = values.map((v,i) => {
    const x = pad + i * xStep;
    const y = h - pad - ((v - min) / range) * (h - pad*2);
    return [x, y];
  });
  let path = `M ${pts[0][0]} ${pts[0][1]}`;
  for(let i = 1; i < pts.length; i++){
    const [px, py] = pts[i-1];
    const [cx, cy] = pts[i];
    const mx = (px + cx) / 2;
    path += ` Q ${px} ${py} ${mx} ${(py+cy)/2}`;
    path += ` T ${cx} ${cy}`;
  }
  // Area fill path
  const areaPath = path + ` L ${pts[pts.length-1][0]} ${h-pad} L ${pts[0][0]} ${h-pad} Z`;
  const lastY = pts[pts.length-1][1];
  const lastX = pts[pts.length-1][0];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs>
      <linearGradient id="spg-${Date.now()}-${Math.random().toString(36).slice(2,6)}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".25"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="${color}" fill-opacity=".12"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lastX}" cy="${lastY}" r="2" fill="${color}"/>
  </svg>`;
}

// ─── Build last-7-days values for sparkline ───
function last7Days(allData, predicate){
  const today = new Date(getTODAY());
  const result = [];
  for(let i = 6; i >= 0; i--){
    const dt = new Date(today);
    dt.setDate(dt.getDate() - i);
    const iso = dt.toISOString().slice(0, 10);
    result.push(allData.filter(r => r.date === iso && (!predicate || predicate(r))).length);
  }
  return result;
}

function rDash() {
  renderDashHero();
  const d = getDashData();
  const c = d.filter(r => r.status === 'Completed').length;
  const u = d.filter(r => r.priority === 'Urgent' && r.status !== 'Completed').length;
  const ip = d.filter(r => r.status === 'In Progress' || r.status === 'In Progress - Contractor').length;
  const pending = d.filter(r => r.status === 'Pending').length;

  // Build sparkline data — last 7 days from ALL data (not filtered)
  const sparkTotal     = last7Days(DATA, null);
  const sparkCompleted = last7Days(DATA, r => r.status === 'Completed');
  const sparkInProg    = last7Days(DATA, r => r.status === 'In Progress' || r.status === 'In Progress - Contractor');
  const sparkUrgent    = last7Days(DATA, r => r.priority === 'Urgent');
  const sparkPending   = last7Days(DATA, r => r.status === 'Pending');

  const kpis = [
    { c: '#6ebe2a', l: 'Total tasks', v: d.length,                                       s: 'Filtered view',  spark: sparkTotal,     featured: true },
    { c: '#6ebe2a', l: 'Completed',   v: c,                                              tr: d.length ? `${Math.round(c / d.length * 100)}% rate` : '—', tc: 'up', spark: sparkCompleted },
    { c: '#5599f5', l: 'In progress', v: ip,                                             spark: sparkInProg },
    { c: '#e8534a', l: 'Urgent',      v: u,                                              tr: u > 0 ? u + ' critical' : 'All clear', tc: u > 0 ? 'dn' : 'up', spark: sparkUrgent },
    { c: '#a87cf0', l: 'Pending',     v: pending,                                        s: 'Awaiting action', spark: sparkPending },
    { c: '#2dcfb3', l: 'Handlers',    v: new Set(d.map(r => r.handler)).size,             s: 'Active staff' },
  ];

  document.getElementById('d-kpis').innerHTML = kpis.map(k =>
    `<div class="kpi${k.featured ? ' kpi-featured' : ''}"><div class="kpi-bar" style="background:${k.c}"></div>
       <div class="kpi-lbl">${k.l}</div><div class="kpi-val">${k.v}</div>
       ${k.s ? `<div class="kpi-sub">${k.s}</div>` : ''}
       ${k.tr ? `<div class="kpi-trend ${k.tc}">${k.tr}</div>` : ''}
       ${k.spark ? `<div class="kpi-spark">${buildSparkline(k.spark, k.c)}</div>` : ''}
     </div>`
  ).join('');

  const chartColor = txt => getComputedStyle(document.documentElement).getPropertyValue(txt).trim();
  const gridColor = chartColor('--b0') || '#1d2412';
  const tickColor = chartColor('--t3') || '#3e4d2c';

  const todayDate = new Date(getTODAY());
  const days = [];
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(todayDate);
    dt.setDate(dt.getDate() - i);
    const iso = dt.toISOString().slice(0, 10);
    dates.push(iso);
    days.push(dt.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' }));
  }
  const firstDate = new Date(dates[0]);
  const lastDate  = new Date(dates[6]);
  const weekLabel = `${firstDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}–${lastDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const wkLblEl = document.getElementById('d-wk-lbl');
  if (wkLblEl) wkLblEl.textContent = weekLabel;

  const wtK = [...new Set(d.map(r => r.workType))];
  const dlEl = document.getElementById('d-dl');
  if (dlEl) dlEl.innerHTML = wtK.map(k =>
    `<span class="leg-i"><span class="leg-sq" style="background:${wc(k)}"></span>${k.replace(/_/g, ' ')}</span>`
  ).join('');

  mkCh('ch-dd', {
    type: 'bar',
    data: {
      labels: days,
      datasets: wtK.map(wt => ({
        label: wt,
        data: dates.map(dd => d.filter(r => r.date === dd && r.workType === wt).length),
        backgroundColor: wc(wt),
        stack: 's',
        borderRadius: 2
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, ticks: { color: tickColor, font: { size: 10 } }, grid: { color: gridColor }, border: { color: gridColor } },
        y: { stacked: true, beginAtZero: true, ticks: { color: tickColor, stepSize: 1 }, grid: { color: gridColor }, border: { color: gridColor } }
      }
    }
  });

  const wtC = cb(d, 'workType'),
        wtL = Object.keys(wtC),
        wtV = Object.values(wtC),
        wtT = wtV.reduce((a, b) => a + b, 0) || 1;
  const wlEl = document.getElementById('d-wl');
  if (wlEl) wlEl.innerHTML = wtL.map((k, i) =>
    `<span class="leg-i"><span class="leg-sq" style="background:${wc(k)}"></span>${k.replace(/_/g, ' ')} (${Math.round(wtV[i] / wtT * 100)}%)</span>`
  ).join('');
  mkCh('ch-dw', {
    type: 'doughnut',
    data: { labels: wtL.map(k => k.replace(/_/g, ' ')), datasets: [{ data: wtV, backgroundColor: wtL.map(k => wc(k)), borderWidth: 2, borderColor: 'transparent' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '62%' }
  });

  const hC = Object.entries(cb(d, 'handler')).sort((a, b) => b[1] - a[1]),
        mxH = hC[0]?.[1] || 1;
  const hnEl = document.getElementById('d-hn');
  if (hnEl) hnEl.innerHTML = hC.map(([n, c], i) =>
    `<li class="ri"><span class="rn">${i + 1}</span><span class="rnm">${n}</span><div class="rb"><div class="rbf" style="width:${Math.round(c / mxH * 100)}%;background:var(--g)"></div></div><span class="rc">${c}</span></li>`
  ).join('');

  const rC = Object.entries(cb(d, 'requestor')).sort((a, b) => b[1] - a[1]),
        mxR = rC[0]?.[1] || 1;
  const rqEl = document.getElementById('d-rq');
  if (rqEl) rqEl.innerHTML = rC.map(([n, c], i) =>
    `<li class="ri"><span class="rn">${i + 1}</span><span class="rnm">${n}</span><div class="rb"><div class="rbf" style="width:${Math.round(c / mxR * 100)}%;background:var(--cyan)"></div></div><span class="rc">${c}</span></li>`
  ).join('');

  const actEl = document.getElementById('d-act');
  if (actEl) actEl.innerHTML = DATA.slice(0, 6).map(r => `
    <div class="act-i" onclick="vTask('${r.id}')" style="cursor:pointer">
      <div class="act-dot" style="background:${r.status === 'Completed' ? 'var(--g)' : r.status === 'In Progress' ? 'var(--blue)' : 'var(--amber)'}"></div>
      <div class="act-body" style="flex:1;min-width:0">
        <div class="act-txt">
          <span style="color:var(--t0);font-weight:600">${r.requestor}</span> · ${r.workType.replace(/_/g, ' ')}
        </div>
        <div class="act-sub" style="color:var(--t2);font-size:11.5px;margin-top:2px">
          <strong style="color:var(--t1)">${r.subType || '—'}</strong>${r.details ? ' · ' + (r.details.length > 60 ? r.details.substring(0, 60) + '…' : r.details) : ''}
        </div>
        <div class="act-sub" style="margin-top:2px">${r.location}</div>
        <div class="act-time" title="${typeof formatTimestamp==='function' ? formatTimestamp(r.submittedAt||r.createdAt) : ''}">${typeof fdts==='function' ? fdts(r) : fd(r.date)}</div>
      </div>
      ${sbadge(r.status)}
    </div>
  `).join('');
}
