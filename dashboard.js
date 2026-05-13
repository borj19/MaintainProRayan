// ═══════════════════════════════════════════════
// dashboard.js — Dashboard rendering
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

function rDash() {
  const d = getDashData();
  const c = d.filter(r => r.status === 'Completed').length;
  const u = d.filter(r => r.priority === 'Urgent').length;
  const ip = d.filter(r => r.status === 'In Progress' || r.status === 'In Progress - Contractor').length;
  const pending = d.filter(r => r.status === 'Pending').length;

  // KPI cards — Polish removed, Pending added
  const kpis = [
    { c: '#6ebe2a', l: 'Total tasks', v: d.length, s: 'Filtered view' },
    { c: '#6ebe2a', l: 'Completed',   v: c, tr: d.length ? `${Math.round(c / d.length * 100)}% rate` : '—', tc: 'up' },
    { c: '#5599f5', l: 'In progress', v: ip },
    { c: '#e8534a', l: 'Urgent',      v: u, tr: u > 0 ? u + ' critical' : 'All clear', tc: u > 0 ? 'dn' : 'up' },
    { c: '#a87cf0', l: 'Pending',     v: pending, s: 'Awaiting action' },
    { c: '#2dcfb3', l: 'Handlers',    v: new Set(d.map(r => r.handler)).size, s: 'Active staff' },
  ];
  document.getElementById('d-kpis').innerHTML = kpis.map(k =>
    `<div class="kpi"><div class="kpi-bar" style="background:${k.c}"></div>
       <div class="kpi-lbl">${k.l}</div><div class="kpi-val">${k.v}</div>
       ${k.s ? `<div class="kpi-sub">${k.s}</div>` : ''}
       ${k.tr ? `<div class="kpi-trend ${k.tc}">${k.tr}</div>` : ''}
     </div>`
  ).join('');

  const chartColor = txt => getComputedStyle(document.documentElement).getPropertyValue(txt).trim();
  const gridColor = chartColor('--b0') || '#1d2412';
  const tickColor = chartColor('--t3') || '#3e4d2c';

  // Live rolling 7-day window — based on today's real date
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

  // Daily job count chart — live rolling 7-day window
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

  // Work type doughnut
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

  // Top handlers
  const hC = Object.entries(cb(d, 'handler')).sort((a, b) => b[1] - a[1]),
        mxH = hC[0]?.[1] || 1;
  const hnEl = document.getElementById('d-hn');
  if (hnEl) hnEl.innerHTML = hC.map(([n, c], i) =>
    `<li class="ri"><span class="rn">${i + 1}</span><span class="rnm">${n}</span><div class="rb"><div class="rbf" style="width:${Math.round(c / mxH * 100)}%;background:var(--g)"></div></div><span class="rc">${c}</span></li>`
  ).join('');

  // Top requestors
  const rC = Object.entries(cb(d, 'requestor')).sort((a, b) => b[1] - a[1]),
        mxR = rC[0]?.[1] || 1;
  const rqEl = document.getElementById('d-rq');
  if (rqEl) rqEl.innerHTML = rC.map(([n, c], i) =>
    `<li class="ri"><span class="rn">${i + 1}</span><span class="rnm">${n}</span><div class="rb"><div class="rbf" style="width:${Math.round(c / mxR * 100)}%;background:var(--cyan)"></div></div><span class="rc">${c}</span></li>`
  ).join('');

  // Recent activity — now shows sub type + details
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
        <div class="act-time">${fd(r.date)}</div>
      </div>
      ${sbadge(r.status)}
    </div>
  `).join('');
}
