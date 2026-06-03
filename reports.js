// ═══════════════════════════════════════════════
// reports.js — Reports, filters, CSV and PDF export
// ═══════════════════════════════════════════════

// REPORTS — filter state
// ═══════════════════════════════════════════════
let RPT = {
  period: 'all',     // all | today | week | month | custom
  single: '',        // YYYY-MM-DD — overrides period when set
  from:   '',        // YYYY-MM-DD custom range start
  to:     '',        // YYYY-MM-DD custom range end
  status: '',        // '' = all
  priority: '',      // '' = all
};

function setRptPeriod(p, el){
  RPT.period = p; RPT.single = '';
  document.getElementById('rpt-single').value = '';
  const custom = document.getElementById('rpt-custom-dates');
  if(custom) custom.style.display = p==='custom' ? 'flex' : 'none';
  document.querySelectorAll('#rpt-period-chips .chip').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  renderR();
}

function setRptSingleDate(v){
  RPT.single = v;
  if(v){
    // deactivate all period chips
    document.querySelectorAll('#rpt-period-chips .chip').forEach(b=>b.classList.remove('on'));
  } else {
    // re-activate 'all'
    const all = document.querySelector('#rpt-period-chips .chip[data-period="all"]');
    if(all) all.classList.add('on');
    RPT.period='all';
  }
  renderR();
}
function clearRptSingle(){
  document.getElementById('rpt-single').value='';
  setRptSingleDate('');
}

function setRptStatus(s, el){
  RPT.status = s;
  document.querySelectorAll('#rpt-status-chips .chip').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  renderR();
}

function setRptPriority(p, el){
  RPT.priority = p;
  document.querySelectorAll('#rpt-priority-chips .chip').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  renderR();
}

function bChips(){
  const reqs=[...new Set(DATA.map(r=>r.requestor))];
  const wts=[...new Set(DATA.map(r=>r.workType))];
  document.getElementById('r-rchips').innerHTML=reqs.map(r=>`<button class="chip ${aR.has(r)?'on':''}" onclick="tChip('r','${r.replace(/'/g,"\\'")}',this)">${r.replace(/^[A-Z&]+ - /,'')}</button>`).join('');
  document.getElementById('r-wchips').innerHTML=wts.map(w=>`<button class="chip ${aW.has(w)?'on':''}" onclick="tChip('w','${w}',this)">${w.replace(/_/g,' ')}</button>`).join('');
}
function tChip(t,v,el){
  const s=t==='r'?aR:aW;
  if(s.has(v)){s.delete(v);el.classList.remove('on');}
  else{s.add(v);el.classList.add('on');}
  renderR();
}

// ── Core filter function ──────────────────────
function getRD(){
  let d = DATA;

  // Single-date override
  if(RPT.single){
    d = DATA.filter(r=>r.date===RPT.single);
    // update count label
    const lbl=document.getElementById('rpt-date-count');
    if(lbl) lbl.textContent='';
    return applySecondaryFilters(d);
  }

  // Period
  const now = new Date(TODAY);
  if(RPT.period==='today')  d=DATA.filter(r=>r.date===TODAY);
  else if(RPT.period==='week'){
    const cut=new Date(now); cut.setDate(cut.getDate()-7);
    d=DATA.filter(r=>new Date(r.date)>=cut);
  }
  else if(RPT.period==='month'){
    const cut=new Date(now); cut.setDate(1);
    d=DATA.filter(r=>new Date(r.date)>=cut);
  }
  else if(RPT.period==='custom'){
    const f=document.getElementById('rpt-from')?.value;
    const t=document.getElementById('rpt-to')?.value;
    RPT.from=f||''; RPT.to=t||'';
    if(f) d=d.filter(r=>r.date>=f);
    if(t) d=d.filter(r=>r.date<=t);
    // Show day count
    if(f&&t){
      const days=Math.round((new Date(t)-new Date(f))/86400000)+1;
      const lbl=document.getElementById('rpt-date-count');
      if(lbl) lbl.textContent=`${days} day${days!==1?'s':''}`;
    }
  }

  return applySecondaryFilters(d);
}

function applySecondaryFilters(d){
  if(RPT.status)   d=d.filter(r=>r.status===RPT.status);
  if(RPT.priority) d=d.filter(r=>r.priority===RPT.priority);
  if(aR.size) d=d.filter(r=>aR.has(r.requestor));
  if(aW.size) d=d.filter(r=>aW.has(r.workType));
  return d;
}

function getPeriodLabel(){
  if(RPT.single) return `Date: ${fd(RPT.single)}`;
  if(RPT.period==='today')  return 'Today';
  if(RPT.period==='week')   return 'Last 7 days';
  if(RPT.period==='month')  return 'This month';
  if(RPT.period==='custom'){
    const f=RPT.from?fd(RPT.from):'—', t=RPT.to?fd(RPT.to):'—';
    return `${f} → ${t}`;
  }
  return 'All time';
}

// ── Render reports page ───────────────────────
function renderR(){
  const d=getRD();
  const c=d.filter(r=>r.status==='Completed').length;
  const ip=d.filter(r=>r.status==='In Progress'||r.status==='In Progress - Contractor').length;
  const urg=d.filter(r=>r.priority==='Urgent'&&r.status!=='Completed').length;
  const topR=(d.length?(Object.entries(cb(d,'requestor')).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—'):'—').replace(/^[A-Z&]+ - /,'');

  // Record count label
  const rcEl=document.getElementById('rpt-record-count');
  if(rcEl) rcEl.textContent=`${d.length} record${d.length!==1?'s':''} · ${getPeriodLabel()}`;

  // KPIs
  const kpis=[
    {c:'#6ebe2a',l:'Total jobs',v:d.length,s:getPeriodLabel()},
    {c:'#6ebe2a',l:'Completed',v:c,tr:`${d.length?Math.round(c/d.length*100):0}% rate`,tc:'up'},
    {c:'#5599f5',l:'In progress',v:ip},
    {c:'#e8534a',l:'Urgent open',v:urg,tr:urg>0?urg+' critical':'All clear',tc:urg>0?'dn':'up'},
    {c:'#a87cf0',l:'Top requestor',v:topR,sm:true},
    {c:'#f0a62e',l:'Work types',v:new Set(d.map(r=>r.workType)).size},
  ];
  document.getElementById('r-kpis').innerHTML=kpis.map(k=>`<div class="kpi"><div class="kpi-bar" style="background:${k.c}"></div><div class="kpi-lbl">${k.l}</div><div class="kpi-val" ${k.sm?'style="font-size:15px;padding-top:6px"':''}>${k.v}</div>${k.s?`<div class="kpi-sub">${k.s}</div>`:''} ${k.tr?`<div class="kpi-trend ${k.tc}">${k.tr}</div>`:''}</div>`).join('');

  const gridColor=getComputedStyle(document.documentElement).getPropertyValue('--b0').trim()||'#1d2412';
  const tickColor=getComputedStyle(document.documentElement).getPropertyValue('--t3').trim()||'#3e4d2c';

  // Build dynamic date axis from filtered data
  const allDates=[...new Set(d.map(r=>r.date))].sort();
  const axisDates = allDates.length<=14 ? allDates : (() => {
    // For large ranges, show up to 14 representative dates
    const step=Math.ceil(allDates.length/14);
    return allDates.filter((_,i)=>i%step===0);
  })();
  const axisLabels=axisDates.map(dt=>{ const[,m,dy]=dt.split('-'); return `${dy} ${MONTHS[+m-1]}`; });
  const wtK=[...new Set(d.map(r=>r.workType))];

  const rng=document.getElementById('r-chart-range');
  if(rng) rng.textContent = allDates.length>0 ? `${axisLabels[0]} → ${axisLabels[axisLabels.length-1]}` : getPeriodLabel();

  document.getElementById('r-dl').innerHTML=wtK.map(k=>`<span class="leg-i"><span class="leg-sq" style="background:${wc(k)}"></span>${k.replace(/_/g,' ')}</span>`).join('');
  mkCh('ch-rd',{type:'bar',data:{labels:axisLabels,datasets:wtK.map(wt=>({label:wt,data:axisDates.map(dd=>d.filter(r=>r.date===dd&&r.workType===wt).length),backgroundColor:wc(wt),stack:'s',borderRadius:2}))},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{stacked:true,ticks:{color:tickColor,font:{size:10},maxRotation:45},grid:{color:gridColor},border:{color:gridColor}},y:{stacked:true,beginAtZero:true,ticks:{color:tickColor,stepSize:1},grid:{color:gridColor},border:{color:gridColor}}}}});

  const wtC=cb(d,'workType'),wtL=Object.keys(wtC),wtV=Object.values(wtC),wtT=wtV.reduce((a,b)=>a+b,0)||1;
  document.getElementById('r-wl').innerHTML=wtL.map((k,i)=>`<span class="leg-i"><span class="leg-sq" style="background:${wc(k)}"></span>${k.replace(/_/g,' ')} (${Math.round(wtV[i]/wtT*100)}%)</span>`).join('');
  mkCh('ch-rw',{type:'doughnut',data:{labels:wtL.map(k=>k.replace(/_/g,' ')),datasets:[{data:wtV,backgroundColor:wtL.map(k=>wc(k)),borderWidth:2,borderColor:'transparent'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:'62%'}});

  const stC=cb(d,'status'),stL=Object.keys(stC),stCol={'Completed':'#6ebe2a','In Progress':'#5599f5','In Progress - Contractor':'#f0a62e','Pending':'#a87cf0'};
  document.getElementById('r-sl').innerHTML=stL.map(s=>`<span class="leg-i"><span class="leg-sq" style="background:${stCol[s]||'#667550'}"></span>${s} (${stC[s]})</span>`).join('');
  mkCh('ch-rs',{type:'doughnut',data:{labels:stL,datasets:[{data:Object.values(stC),backgroundColor:stL.map(s=>stCol[s]||'#667550'),borderWidth:2,borderColor:'transparent'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:'58%'}});

  const priC=cb(d,'priority'),priL=Object.keys(priC),priCol={Low:'#667550',Medium:'#5599f5',High:'#f0a62e',Urgent:'#e8534a'};
  document.getElementById('r-pl').innerHTML=priL.map(p=>`<span class="leg-i"><span class="leg-sq" style="background:${priCol[p]||'#667550'}"></span>${p} (${priC[p]})</span>`).join('');
  mkCh('ch-rpri',{type:'doughnut',data:{labels:priL,datasets:[{data:Object.values(priC),backgroundColor:priL.map(p=>priCol[p]||'#667550'),borderWidth:2,borderColor:'transparent'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:'55%'}});

  const hC=Object.entries(cb(d,'handler')).sort((a,b)=>b[1]-a[1]),mxH=hC[0]?.[1]||1;
  document.getElementById('r-hn').innerHTML=hC.map(([n,c],i)=>`<li class="ri"><span class="rn">${i+1}</span><span class="rnm">${n}</span><div class="rb"><div class="rbf" style="width:${Math.round(c/mxH*100)}%;background:var(--g)"></div></div><span class="rc">${c}</span></li>`).join('');
  const rC=Object.entries(cb(d,'requestor')).sort((a,b)=>b[1]-a[1]),mxR=rC[0]?.[1]||1;
  document.getElementById('r-rq').innerHTML=rC.map(([n,c],i)=>`<li class="ri"><span class="rn">${i+1}</span><span class="rnm">${n}</span><div class="rb"><div class="rbf" style="width:${Math.round(c/mxR*100)}%;background:var(--cyan)"></div></div><span class="rc">${c}</span></li>`).join('');

  const hComp={};[...new Set(d.map(r=>r.handler))].forEach(h=>{const t=d.filter(r=>r.handler===h),done=t.filter(r=>r.status==='Completed').length;hComp[h]={total:t.length,done,rate:t.length?Math.round(done/t.length*100):0};});
  document.getElementById('r-crates').innerHTML=Object.entries(hComp).map(([h,v])=>`<div style="margin-bottom:13px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:12px;color:var(--t0);font-weight:500">${h}</span><span style="font-size:12px;font-weight:700;color:${v.rate===100?'var(--g)':v.rate>70?'var(--cyan)':'var(--amber)'}">${v.rate}%</span></div><div class="pbg"><div class="pfg" style="width:${v.rate}%;background:${v.rate===100?'var(--g)':v.rate>70?'var(--cyan)':'var(--amber)'}"></div></div><div style="font-size:10px;color:var(--t2);margin-top:3px">${v.done}/${v.total} tasks completed</div></div>`).join('');

  // Task table — with search, sort, pagination
  window._rptTableData = d;            // full filtered dataset for table operations
  renderRptTable();
}

// ── Reports table state ──
let RPT_TBL = { search:'', sortKey:'date', sortDir:-1, page:1, pageSize:20 };

function renderRptTable(){
  let d = (window._rptTableData||[]).slice();

  // Search
  const q = (RPT_TBL.search||'').trim().toLowerCase();
  if(q){
    d = d.filter(r => [r.date,r.requestor,r.handler,r.workType,r.subType,r.area,r.location,r.details,r.status,r.priority]
      .filter(Boolean).join(' ').toLowerCase().includes(q));
  }

  // Sort
  if(RPT_TBL.sortKey){
    const k=RPT_TBL.sortKey, dir=RPT_TBL.sortDir;
    const prioRank={Urgent:4,High:3,Medium:2,Low:1};
    d.sort((a,b)=>{
      let av=a[k], bv=b[k];
      if(k==='priority'){ av=prioRank[av]||0; bv=prioRank[bv]||0; }
      else { av=(av||'').toString().toLowerCase(); bv=(bv||'').toString().toLowerCase(); }
      if(av<bv) return -1*dir;
      if(av>bv) return 1*dir;
      return 0;
    });
  }

  const total=d.length;
  const ps=RPT_TBL.pageSize;
  const pages=Math.max(1,Math.ceil(total/ps));
  if(RPT_TBL.page>pages) RPT_TBL.page=pages;
  if(RPT_TBL.page<1) RPT_TBL.page=1;
  const cur=RPT_TBL.page;
  const start=(cur-1)*ps;
  const rows=d.slice(start,start+ps);

  // Count badge
  const tblCount=document.getElementById('r-tbl-count');
  if(tblCount) tblCount.textContent=`${total} task${total!==1?'s':''}`;

  // Sort indicators
  document.querySelectorAll('.rpt-sort-ind').forEach(el=>{
    const col=el.getAttribute('data-col');
    el.textContent = (col===RPT_TBL.sortKey) ? (RPT_TBL.sortDir===1?'↑':'↓') : '';
  });

  const tbody=document.getElementById('r-tbody');
  if(tbody) tbody.innerHTML=rows.length ? rows.map(r=>`<tr>
    <td style="font-family:var(--mono);font-size:11px">${fds(r.date)}</td>
    <td class="td-h">${r.requestor}</td>
    <td>${r.handler}</td>
    <td>${r.workType.replace(/_/g,' ')}</td>
    <td style="color:var(--t2)">${r.subType||'—'}</td>
    <td>${(r.area||'').replace(/_/g,' ')}</td>
    <td>${r.location||'—'}</td>
    <td style="color:var(--t2);max-width:160px;overflow:hidden;text-overflow:ellipsis" title="${r.details||''}">${r.details||'—'}</td>
    <td>${sbadge(r.status)}</td>
    <td>${pbadge(r.priority)}</td>
  </tr>`).join('') : `<tr><td colspan="10" style="text-align:center;padding:28px;color:var(--t2)">${q?'No tasks match your search.':'No tasks match the current filters.'}</td></tr>`;

  // Pagination controls
  const pag=document.getElementById('rpt-pagination');
  if(pag){
    if(total<=ps && ps===20 && !q){
      pag.innerHTML='';
    } else {
      pag.innerHTML=`
        <div class="list-pag-info">${total?`Showing ${start+1}–${Math.min(start+ps,total)} of ${total}`:'No records'}</div>
        <div class="list-pag-controls">${typeof buildRptPagButtons==='function'?buildRptPagButtons(cur,pages):''}</div>
        <div class="list-pag-size"><span>Rows:</span>
          <select onchange="rptSetPageSize(this.value)">
            ${[10,20,50,100].map(s=>`<option value="${s}" ${s===ps?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>`;
    }
  }
}

function buildRptPagButtons(cur,pages){
  if(pages<=1) return `<button class="list-pag-btn on" disabled>1</button>`;
  let html=`<button class="list-pag-btn ${cur===1?'disabled':''}" ${cur===1?'disabled':''} onclick="rptGotoPage(${cur-1})">‹</button>`;
  const nums=[]; const add=n=>{if(!nums.includes(n)&&n>=1&&n<=pages)nums.push(n);};
  add(1);add(2);add(pages);add(pages-1);add(cur);add(cur-1);add(cur+1);
  const sorted=[...new Set(nums)].sort((a,b)=>a-b);
  let prev=0;
  for(const n of sorted){
    if(n-prev>1) html+=`<span class="list-pag-ellipsis">…</span>`;
    html+=`<button class="list-pag-btn ${n===cur?'on':''}" onclick="rptGotoPage(${n})">${n}</button>`;
    prev=n;
  }
  html+=`<button class="list-pag-btn ${cur===pages?'disabled':''}" ${cur===pages?'disabled':''} onclick="rptGotoPage(${cur+1})">›</button>`;
  return html;
}
function rptGotoPage(p){ RPT_TBL.page=p; renderRptTable(); }
function rptSetPageSize(s){ RPT_TBL.pageSize=parseInt(s,10); RPT_TBL.page=1; renderRptTable(); }
function rptTblSearch(q){ RPT_TBL.search=q; RPT_TBL.page=1; renderRptTable(); }
function rptSort(col){
  if(RPT_TBL.sortKey===col) RPT_TBL.sortDir*=-1;
  else { RPT_TBL.sortKey=col; RPT_TBL.sortDir=1; }
  RPT_TBL.page=1;
  renderRptTable();
}

// ═══════════════════════════════════════════════
// EXPORT CSV  (opens in Excel perfectly)
// ═══════════════════════════════════════════════
function expCSV(){
  const d=getRD();
  if(!d.length){toast('No data to export for this filter.','e');return;}

  // BOM for Excel to read UTF-8 correctly
  const BOM='\uFEFF';
  const headers=['#','Date','Requestor','Handler','Work Type','Sub Type','Area','Location','Details','Status','Priority','Completion'];
  const rows=d.map((r,i)=>[
    i+1,
    r.date,
    r.requestor,
    r.handler,
    r.workType.replace(/_/g,' '),
    r.subType||'',
    (r.area||'').replace(/_/g,' '),
    r.location||'',
    (r.details||'').replace(/"/g,'""'),
    r.status,
    r.priority,
    r.completion||''
  ].map(v=>`"${v}"`).join(','));

  // Summary section at top
  const comp=d.filter(r=>r.status==='Completed').length;
  const period=getPeriodLabel();
  const genDate=new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const summary=[
    `"MaintainPro — Maintenance Report"`,
    `"Period:","${period}"`,
    `"Generated:","${genDate}"`,
    `"Total tasks:","${d.length}"`,
    `"Completed:","${comp} (${d.length?Math.round(comp/d.length*100):0}%)"`,
    `"In progress:","${d.filter(r=>r.status==='In Progress'||r.status==='In Progress - Contractor').length}"`,
    `"Urgent (open):","${d.filter(r=>r.priority==='Urgent'&&r.status!=='Completed').length}"`,
    `""`,
    headers.map(h=>`"${h}"`).join(','),
  ];

  const csv=BOM+summary.join('\n')+'\n'+rows.join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`MaintainPro-Report-${TODAY}.csv`;
  a.click();
  toast(`CSV exported — ${d.length} tasks (opens in Excel)`,'s');
}

// ═══════════════════════════════════════════════
// EXPORT PDF  (full branded report, opens print dialog)
// ═══════════════════════════════════════════════
function expPDF(){
  const d=getRD();
  if(!d.length){toast('No data to export for this filter.','e');return;}

  const comp=d.filter(r=>r.status==='Completed').length;
  const ip=d.filter(r=>r.status==='In Progress'||r.status==='In Progress - Contractor').length;
  const pend=d.filter(r=>r.status==='Pending').length;
  const urg=d.filter(r=>r.priority==='Urgent'&&r.status!=='Completed').length;
  const compRate=d.length?Math.round(comp/d.length*100):0;
  const period=getPeriodLabel();
  const genDate=new Date().toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const topH=Object.entries(cb(d,'handler')).sort((a,b)=>b[1]-a[1]);
  const topR=Object.entries(cb(d,'requestor')).sort((a,b)=>b[1]-a[1]);
  const byWt=Object.entries(cb(d,'workType')).sort((a,b)=>b[1]-a[1]);
  const stC=cb(d,'status');

  const statusColor={Completed:'#16a34a','In Progress':'#2563eb','In Progress - Contractor':'#d97706',Pending:'#7c3aed'};
  const statusBg   ={Completed:'#dcfce7','In Progress':'#dbeafe','In Progress - Contractor':'#fef3c7',Pending:'#ede9fe'};
  const prioColor  ={Low:'#64748b',Medium:'#2563eb',High:'#d97706',Urgent:'#dc2626'};
  const prioBg     ={Low:'#f1f5f9',Medium:'#dbeafe',High:'#fef3c7',Urgent:'#fee2e2'};

  const badge=(text,c,bg)=>`<span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;color:${c};background:${bg};white-space:nowrap">${text}</span>`;

  const kpiCard=(val,label,color)=>`
    <div style="text-align:center;padding:14px 10px;border:1px solid #e2e8f0;border-radius:10px;border-top:3px solid ${color}">
      <div style="font-size:30px;font-weight:800;color:${color};font-family:monospace;line-height:1">${val}</div>
      <div style="font-size:10px;color:#64748b;margin-top:5px;text-transform:uppercase;letter-spacing:.06em">${label}</div>
    </div>`;

  const hRow=(name,count,max,color)=>{
    const pct=Math.round(count/max*100);
    return `<tr><td style="padding:7px 10px;font-size:12px;font-weight:500;color:#0f172a;width:180px">${name}</td><td style="padding:7px 10px"><div style="background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${color};border-radius:99px"></div></div></td><td style="padding:7px 10px;font-size:13px;font-weight:700;color:#0f172a;width:40px;text-align:right">${count}</td></tr>`;
  };

  const taskRows=d.slice(0,200).map((r,i)=>`
    <tr style="background:${i%2===0?'#ffffff':'#f8fafc'}">
      <td style="padding:7px 9px;font-size:10px;color:#64748b;font-family:monospace;white-space:nowrap">${fds(r.date)}</td>
      <td style="padding:7px 9px;font-size:11px;font-weight:600;color:#0f172a">${r.requestor}</td>
      <td style="padding:7px 9px;font-size:11px;color:#475569">${r.handler}</td>
      <td style="padding:7px 9px;font-size:11px;color:#475569">${r.workType.replace(/_/g,' ')}</td>
      <td style="padding:7px 9px;font-size:11px;color:#64748b">${(r.area||'').replace(/_/g,' ')}</td>
      <td style="padding:7px 9px;font-size:11px;color:#64748b">${r.location||'—'}</td>
      <td style="padding:7px 9px;font-size:11px;color:#475569;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.details||'—'}</td>
      <td style="padding:7px 9px">${badge(r.status, statusColor[r.status]||'#475569', statusBg[r.status]||'#f1f5f9')}</td>
      <td style="padding:7px 9px">${badge(r.priority, prioColor[r.priority]||'#64748b', prioBg[r.priority]||'#f1f5f9')}</td>
    </tr>`).join('');

  const html=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MaintainPro — Maintenance Report</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#1a202c;background:#fff;line-height:1.5}
  @page{size:A4 landscape;margin:18mm 16mm}
  @media print{
    .no-print{display:none!important}
    body{font-size:11px}
    .page-break{page-break-before:always}
  }

  /* ─── Header ─── */
  .report-header{
    background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);
    color:#fff;padding:28px 32px;border-radius:12px;margin-bottom:24px;
    display:flex;align-items:flex-start;justify-content:space-between;
    gap:20px;flex-wrap:wrap;
  }
  .report-brand{display:flex;align-items:center;gap:14px}
  .report-brand-icon{
    width:48px;height:48px;border-radius:12px;
    background:linear-gradient(135deg,#6ebe2a,#2dcfb3);
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
  }
  .report-brand-icon svg{width:26px;height:26px;color:#fff}
  .report-brand-name{font-size:22px;font-weight:800;letter-spacing:-.03em}
  .report-brand-sub{font-size:12px;opacity:.7;margin-top:2px}
  .report-meta{text-align:right;font-size:11.5px;opacity:.85;line-height:1.8}
  .report-period-badge{
    display:inline-block;margin-top:6px;padding:5px 14px;border-radius:99px;
    background:rgba(110,190,42,.25);border:1px solid rgba(110,190,42,.4);
    color:#a3e635;font-size:12px;font-weight:700;
  }

  /* ─── Section labels ─── */
  .section-label{
    font-size:9.5px;font-weight:800;color:#64748b;text-transform:uppercase;
    letter-spacing:.1em;margin-bottom:10px;padding-bottom:7px;
    border-bottom:2px solid #e2e8f0;
  }

  /* ─── KPI grid ─── */
  .kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:22px}

  /* ─── Analytics grid ─── */
  .analytics-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px}
  .analytics-card{border:1px solid #e2e8f0;border-radius:10px;padding:16px}
  .analytics-card h3{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px}

  /* ─── Bars ─── */
  .bar-table{width:100%;border-collapse:collapse}

  /* ─── Task table ─── */
  .task-table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
  .task-table thead th{
    background:#0f172a;color:#fff;padding:9px 9px;text-align:left;
    font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
    white-space:nowrap;
  }
  .task-table tbody tr:hover{background:#f0f9ff}
  .task-table tbody td{border-bottom:1px solid #e2e8f0}

  /* ─── Footer ─── */
  .report-footer{
    margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;
    font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;
    flex-wrap:wrap;gap:8px;
  }

  /* ─── Print button ─── */
  .print-bar{
    position:fixed;top:0;left:0;right:0;z-index:999;
    background:#0f172a;color:#fff;padding:12px 24px;
    display:flex;align-items:center;justify-content:space-between;gap:16px;
  }
  .print-bar-title{font-size:13px;font-weight:700}
  .print-bar-actions{display:flex;gap:10px}
  .print-btn{
    padding:8px 18px;border-radius:7px;font-size:12px;font-weight:700;
    cursor:pointer;border:none;font-family:inherit;
  }
  .print-btn-primary{background:#6ebe2a;color:#fff}
  .print-btn-primary:hover{background:#5aab1e}
  .print-btn-secondary{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.2)}
  .print-content{margin-top:56px;padding:24px}
  @media print{.print-bar{display:none!important}.print-content{margin-top:0;padding:0}}
</style>
</head>
<body>

<!-- Print toolbar -->
<div class="print-bar no-print">
  <div class="print-bar-title">📄 MaintainPro Report — ${period}</div>
  <div class="print-bar-actions">
    <button class="print-btn print-btn-secondary" onclick="window.close()">✕ Close</button>
    <button class="print-btn print-btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
</div>

<div class="print-content">

<!-- ═══ HEADER ═══ -->
<div class="report-header">
  <div class="report-brand">
    <div class="report-brand-icon">
      <svg viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="12" y="2" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="2" y="12" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="12" y="12" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5"/></svg>
    </div>
    <div>
      <div class="report-brand-name">MaintainPro</div>
      <div class="report-brand-sub">Hotel Maintenance Platform — Official Report</div>
    </div>
  </div>
  <div class="report-meta">
    <div>Generated by: <strong>${currentUser?.name||'Admin'}</strong></div>
    <div>${genDate}</div>
    <div>${d.length} total records</div>
    <div class="report-period-badge">📅 ${period}</div>
  </div>
</div>

<!-- ═══ KPI CARDS ═══ -->
<div class="section-label">Performance overview</div>
<div class="kpi-grid">
  ${kpiCard(d.length,'Total jobs','#0ea5e9')}
  ${kpiCard(comp,'Completed','#22c55e')}
  ${kpiCard(compRate+'%','Completion rate','#6ebe2a')}
  ${kpiCard(ip,'In progress','#3b82f6')}
  ${kpiCard(pend,'Pending','#8b5cf6')}
  ${kpiCard(urg,'Urgent','#ef4444')}
</div>

<!-- ═══ ANALYTICS GRID ═══ -->
<div class="section-label">Analytics breakdown</div>
<div class="analytics-grid">

  <!-- Handler workload -->
  <div class="analytics-card">
    <h3>Handler workload</h3>
    <table class="bar-table">
      ${topH.map(([n,c])=>hRow(n,c,topH[0]?.[1]||1,'#6ebe2a')).join('')}
    </table>
  </div>

  <!-- Top requestors -->
  <div class="analytics-card">
    <h3>Top requestors</h3>
    <table class="bar-table">
      ${topR.slice(0,8).map(([n,c])=>hRow(n,c,topR[0]?.[1]||1,'#06b6d4')).join('')}
    </table>
  </div>

  <!-- Work type distribution -->
  <div class="analytics-card">
    <h3>Work type distribution</h3>
    <table class="bar-table">
      ${byWt.map(([k,c])=>hRow(k.replace(/_/g,' '),c,byWt[0]?.[1]||1,'#8b5cf6')).join('')}
    </table>
  </div>

  <!-- Status + Priority summary -->
  <div class="analytics-card">
    <h3>Status &amp; priority summary</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      ${Object.entries(stC).map(([s,c])=>`<tr><td style="padding:5px 0;font-size:12px;color:#475569;width:55%">${s}</td><td style="padding:5px 0">${badge(String(c)+' task'+(c!==1?'s':''),statusColor[s]||'#475569',statusBg[s]||'#f1f5f9')}</td></tr>`).join('')}
    </table>
    <div style="font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Completion rates by handler</div>
    ${Object.entries(cb(d,'handler')).map(([h])=>{
      const t=d.filter(r=>r.handler===h),dn=t.filter(r=>r.status==='Completed').length,rt=t.length?Math.round(dn/t.length*100):0;
      const col=rt>=80?'#16a34a':rt>=50?'#d97706':'#dc2626';
      return `<div style="margin-bottom:7px"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:11px;color:#0f172a">${h}</span><span style="font-size:11px;font-weight:700;color:${col}">${rt}%</span></div><div style="background:#e2e8f0;border-radius:99px;height:6px;overflow:hidden"><div style="width:${rt}%;height:100%;background:${col};border-radius:99px"></div></div></div>`;
    }).join('')}
  </div>
</div>

<!-- ═══ TASK LISTING ═══ -->
<div class="section-label page-break">Full task listing (${d.length} record${d.length!==1?'s':''}${d.length>200?' — showing first 200':''})</div>
<table class="task-table">
  <thead>
    <tr>
      <th>Date</th><th>Requestor</th><th>Handler</th><th>Work type</th>
      <th>Area</th><th>Location</th><th>Details</th><th>Status</th><th>Priority</th>
    </tr>
  </thead>
  <tbody>${taskRows}</tbody>
</table>
${d.length>200?`<div style="text-align:center;padding:12px;font-size:11px;color:#64748b;border:1px dashed #e2e8f0;border-radius:8px;margin-top:10px">⚠️ Report truncated — ${d.length-200} additional records not shown. Export CSV for the full dataset.</div>`:''}

<!-- ═══ FOOTER ═══ -->
<div class="report-footer">
  <div>MaintainPro — Hotel Maintenance Platform &nbsp;·&nbsp; Generated ${genDate}</div>
  <div>Period: ${period} &nbsp;·&nbsp; ${d.length} records &nbsp;·&nbsp; ${compRate}% completion rate</div>
</div>

</div><!-- .print-content -->
${'<'+'script>'}
  // Auto-trigger print dialog after a short delay for the page to render
  setTimeout(()=>window.print(),800);
${'<'+'/script>'}
</body>
</html>`;

  const w=window.open('','_blank','width=1200,height=850');
  if(!w){toast('Pop-up blocked — please allow pop-ups to export PDF.','e');return;}
  w.document.write(html);
  w.document.close();
  toast('PDF report opened — use Print → Save as PDF','s');
}

// ═══════════════════════════════════════════════