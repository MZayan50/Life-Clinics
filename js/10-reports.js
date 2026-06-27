// ══════════════════════════════════════════════════════════════════
// 📊 REPORTS MODULE — v4.0  (Event-Driven)
// Reports · Export PDF
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
// 📡 EventBus Listeners — تحديث KPI bar تلقائياً
// ══════════════════════════════════════════
(function _reportsListeners(){

  // أي تغيير في البيانات الرئيسية → أعد حساب KPIs
  const refresh = () => renderReports();

  EventBus.on('invoices:created',     refresh);
  EventBus.on('invoices:updated',     refresh);
  EventBus.on('invoices:deleted',     refresh);
  EventBus.on('patients:created',     refresh);
  EventBus.on('patients:updated',     refresh);
  EventBus.on('patients:deleted',     refresh);
  EventBus.on('appointments:created', refresh);
  EventBus.on('appointments:updated', refresh);
  EventBus.on('appointments:deleted', refresh);
  EventBus.on('expenses:created',     refresh);
  EventBus.on('expenses:updated',     refresh);
  EventBus.on('expenses:deleted',     refresh);

}());

// 📊 REAL REPORTS FROM DATA
// ══════════════════════════════════════════
// ══════════════════════════════════════════
// 📊 renderReports — يُستدعى تلقائياً من showScreen
// يعبّي KPI cards في أعلى الشاشة بأرقام حقيقية
// ══════════════════════════════════════════
function renderReports(){
  const el = document.getElementById('reports-kpi-bar');
  if(!el) return;
  const invoices  = DB.get('invoices')  || [];
  const patients  = DB.get('patients')  || [];
  const appts     = DB.get('appointments') || [];
  const expenses  = DB.get('expenses')  || [];
  const today     = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0,7);

  const monthRev  = invoices.filter(i=>(i.date||'').startsWith(thisMonth)).reduce((s,i)=>s+(i.paid||0),0);
  const totalPend = invoices.reduce((s,i)=>s+(i.remaining||0),0);
  const newPats   = patients.filter(p=>(p.createdAt||'').startsWith(thisMonth)).length;
  const todayAppt = appts.filter(a=>a.date===today).length;
  const monthExp  = expenses.filter(e=>(e.date||'').startsWith(thisMonth)).reduce((s,e)=>s+(e.amount||0),0);
  const netProfit = monthRev - monthExp;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px;">
      <div class="kpi-card kc-emerald"><div class="kpi-icon">💰</div><div class="kpi-value">${monthRev.toLocaleString()} ج</div><div class="kpi-label">إيرادات الشهر</div></div>
      <div class="kpi-card kc-rose"><div class="kpi-icon">💸</div><div class="kpi-value">${monthExp.toLocaleString()} ج</div><div class="kpi-label">مصروفات الشهر</div></div>
      <div class="kpi-card ${netProfit>=0?'kc-teal':'kc-amber'}"><div class="kpi-icon">📈</div><div class="kpi-value">${(netProfit>=0?'+':'')+netProfit.toLocaleString()} ج</div><div class="kpi-label">صافي الربح</div></div>
      <div class="kpi-card kc-gold"><div class="kpi-icon">⏳</div><div class="kpi-value">${totalPend.toLocaleString()} ج</div><div class="kpi-label">مستحقات معلقة</div></div>
      <div class="kpi-card kc-purple" style="--kc-color:#8B5CF6"><div class="kpi-icon">👥</div><div class="kpi-value">${newPats}</div><div class="kpi-label">عملاء جدد الشهر</div></div>
      <div class="kpi-card kc-teal"><div class="kpi-icon">📅</div><div class="kpi-value">${todayAppt}</div><div class="kpi-label">مواعيد اليوم</div></div>
    </div>`;
}

function generateReport(type){
  const invoices = DB.get('invoices');
  const patients = DB.get('patients');
  const appointments = DB.get('appointments');
  const inventory = DB.get('inventory');
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0,7);

  switch(type){
    case 'revenue': return generateRevenueReport(invoices, thisMonth);
    case 'patients': return generatePatientsReport(patients, appointments);
    case 'inventory': return generateInventoryReport(inventory);
    case 'appointments': return generateAppointmentsReport(appointments, today);
    case 'doctors': return generateDoctorsReport();
    case 'branches': return generateBranchesReport();
    case 'campaigns': return generateCampaignsReport();
    case 'accounts': showScreen('accounts'); return null;
  }
}

function generateRevenueReport(invoices, month){
  const monthInvs = invoices.filter(i=>i.date && i.date.startsWith(month));
  const totalRevenue = monthInvs.reduce((s,i)=>s+i.total, 0);
  const totalPaid = monthInvs.reduce((s,i)=>s+i.paid, 0);
  const totalPending = monthInvs.reduce((s,i)=>s+i.remaining, 0);
  const byService = {};
  monthInvs.forEach(i=>{ byService[i.service] = (byService[i.service]||0)+i.total; });
  const byMethod = {};
  monthInvs.forEach(i=>{ byMethod[i.method] = (byMethod[i.method]||0)+i.paid; });

  const avgInv=monthInvs.length?Math.round(totalRevenue/monthInvs.length):0;
  const collectionRate=totalRevenue?Math.round(totalPaid/totalRevenue*100):0;
  return {
    title: 'تقرير الإيرادات',
    period: month,
    summary: [
      {label:'إجمالي الإيرادات', value:totalRevenue.toLocaleString()+' ج', color:'var(--emerald)'},
      {label:'المحصل فعلاً', value:totalPaid.toLocaleString()+' ج', color:'var(--teal)'},
      {label:'المتبقي', value:totalPending.toLocaleString()+' ج', color:'var(--rose)'},
      {label:'عدد الفواتير', value:monthInvs.length, color:'var(--purple)'},
      {label:'متوسط الفاتورة', value:avgInv.toLocaleString()+' ج', color:'var(--gold-light)'},
      {label:'نسبة التحصيل', value:collectionRate+'%', color:'var(--teal)'}
    ],
    byService,
    byMethod
  };
}

function generatePatientsReport(patients, appointments){
  const active = patients.filter(p=>p.status==='نشط').length;
  const withBalance = patients.filter(p=>p.balance>0).length;
  const totalDebt = patients.reduce((s,p)=>s+(p.balance||0),0);
  const bySource = {};
  patients.forEach(p=>{ bySource[p.source||'غير محدد'] = (bySource[p.source||'غير محدد']||0)+1; });

  const vipCount=patients.filter(p=>p.isVIP).length;
  const totalSpent=patients.reduce((s,p)=>s+(p.spent||0),0);
  return {
    title: 'تقرير العملاء',
    summary: [
      {label:'إجمالي العملاء', value:patients.length, color:'var(--teal)'},
      {label:'العملاء النشطون', value:active, color:'var(--emerald)'},
      {label:'VIP', value:vipCount, color:'var(--gold-light)'},
      {label:'إجمالي الديون', value:totalDebt.toLocaleString()+' ج', color:'var(--rose)'},
      {label:'إجمالي الإنفاق', value:totalSpent.toLocaleString()+' ج', color:'var(--purple)'},
      {label:'عملاء لديهم ديون', value:withBalance, color:'var(--amber)'}
    ],
    bySource
  };
}

function generateInventoryReport(inventory){
  const lowStock = inventory.filter(i=>i.status==='منخفض');
  const outStock = inventory.filter(i=>i.status==='نفذ');
  const totalValue = inventory.reduce((s,i)=>s+(i.qty*i.price),0);
  const expiringSoon = inventory.filter(i=>{
    if(!i.expiry) return false;
    const diff = (new Date(i.expiry)-new Date())/(1000*60*60*24);
    return diff>0 && diff<30;
  });
  return {
    title: 'تقرير المخزون',
    summary: [
      {label:'إجمالي المنتجات', value:inventory.length, color:'var(--teal)'},
      {label:'مخزون منخفض', value:lowStock.length, color:'var(--amber)'},
      {label:'نفذ من المخزون', value:outStock.length, color:'var(--rose)'},
      {label:'قيمة المخزون', value:totalValue.toLocaleString()+' ج', color:'var(--emerald)'}
    ],
    lowStock,
    expiringSoon
  };
}

function generateAppointmentsReport(appointments, today){
  const todayAppts = appointments.filter(a=>a.date===today);
  const confirmed = todayAppts.filter(a=>a.status==='مؤكد').length;
  const done = appointments.filter(a=>a.status==='مكتمل').length;
  const cancelled = appointments.filter(a=>a.status==='ملغي').length;
  return {
    title: 'تقرير المواعيد',
    summary: [
      {label:'مواعيد اليوم', value:todayAppts.length, color:'var(--teal)'},
      {label:'مؤكدة', value:confirmed, color:'var(--emerald)'},
      {label:'مكتملة (الكل)', value:done, color:'var(--purple)'},
      {label:'ملغاة', value:cancelled, color:'var(--rose)'}
    ]
  };
}

function showReport(type){
  const report = generateReport(type);
  if(!report) return;

  const modal = document.createElement('div');
  modal.className='modal-overlay open';
  modal.style.zIndex='500';
  const summary = report.summary.map(s=>`
    <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:12px;padding:16px;text-align:center;">
      <div style="font-size:20px;font-weight:800;color:${s.color}">${s.value}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${s.label}</div>
    </div>`).join('');

  let extra = '';
  if(report.byService){
    const svcs = Object.entries(report.byService).sort((a,b)=>b[1]-a[1]);
    extra += `<div style="margin-top:16px;"><div style="font-weight:700;font-size:14px;margin-bottom:10px;">توزيع الإيرادات حسب الخدمة</div>`;
    const totalRev = svcs.reduce((s,[,v])=>s+v,0)||1;
    svcs.forEach(([k,v])=>{
      const pct = Math.round(v/totalRev*100);
      extra += `<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span>${k}</span><span style="font-weight:700;color:var(--teal)">${v.toLocaleString()} ج</span></div><div style="height:6px;background:var(--glass);border-radius:3px;overflow:hidden;"><div style="height:100%;background:var(--teal);width:${Math.min(pct,100)}%;border-radius:3px;"></div></div></div>`;
    });
    extra += '</div>';
  }
  if(report.byMethod){
    extra += `<div style="margin-top:16px;"><div style="font-weight:700;font-size:14px;margin-bottom:10px;">توزيع طرق الدفع</div>`;
    Object.entries(report.byMethod).forEach(([k,v])=>{
      extra += `<div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--glass);border-radius:8px;margin-bottom:6px;font-size:13px;"><span>${k}</span><span style="font-weight:700;color:var(--gold-light)">${v.toLocaleString()} ج</span></div>`;
    });
    extra += '</div>';
  }
  if(report.bySource){
    extra += `<div style="margin-top:16px;"><div style="font-weight:700;font-size:14px;margin-bottom:10px;">مصادر العملاء</div>`;
    Object.entries(report.bySource).forEach(([k,v])=>{
      extra += `<div style="display:flex;justify-content:space-between;padding:8px 12px;background:var(--glass);border-radius:8px;margin-bottom:6px;font-size:13px;"><span>${k}</span><span style="font-weight:700;color:var(--purple)">${v} عميل</span></div>`;
    });
    extra += '</div>';
  }
  if(report.lowStock && report.lowStock.length){
    extra += `<div style="margin-top:16px;"><div style="font-weight:700;font-size:14px;margin-bottom:10px;color:var(--amber);">⚠️ منتجات تحتاج إعادة طلب</div>`;
    report.lowStock.forEach(i=>{
      extra += `<div style="display:flex;justify-content:space-between;padding:8px 12px;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.2);border-radius:8px;margin-bottom:6px;font-size:13px;"><span>${i.name}</span><span style="color:var(--amber)">متبقي: ${i.qty}</span></div>`;
    });
    extra += '</div>';
  }
  if(report.doctorsTable){
    extra += `<div style="margin-top:16px;"><div style="font-weight:700;font-size:14px;margin-bottom:10px;">أداء الأطباء</div><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="background:var(--glass);"><th style="padding:8px;text-align:right;color:var(--text-muted);">الطبيب</th><th style="padding:8px;text-align:right;color:var(--text-muted);">التخصص</th><th style="padding:8px;text-align:center;color:var(--text-muted);">العملاء</th><th style="padding:8px;text-align:center;color:var(--text-muted);">الجلسات</th><th style="padding:8px;text-align:left;color:var(--text-muted);">الإيرادات</th></tr></thead><tbody>`;
    const total = report.totalRev||1;
    report.doctorsTable.forEach((d,i)=>{
      const colors=['var(--teal)','var(--gold-light)','var(--purple)','var(--emerald)','var(--rose)'];
      const pct = Math.round(d.revenue/total*100);
      extra += `<tr style="border-bottom:1px solid var(--glass-border);"><td style="padding:9px 8px;font-weight:700;">${i===0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':''}${d.name}</td><td style="padding:9px 8px;color:var(--text-muted);font-size:12px;">${d.specialty}</td><td style="padding:9px 8px;text-align:center;color:var(--purple);font-weight:700;">${d.patients}</td><td style="padding:9px 8px;text-align:center;color:var(--teal);font-weight:700;">${d.sessions}</td><td style="padding:9px 8px;text-align:left;"><div style="color:${colors[i%5]};font-weight:800;">${d.revenue.toLocaleString()} ج</div><div style="height:4px;background:var(--glass);border-radius:2px;margin-top:4px;overflow:hidden;"><div style="height:100%;background:${colors[i%5]};width:${pct}%;"></div></div></td></tr>`;
    });
    extra += '</tbody></table></div></div>';
  }
  if(report.branchesTable){
    extra += `<div style="margin-top:16px;"><div style="font-weight:700;font-size:14px;margin-bottom:10px;">أداء الفروع</div><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="background:var(--glass);"><th style="padding:8px;text-align:right;color:var(--text-muted);">الفرع</th><th style="padding:8px;text-align:center;color:var(--text-muted);">العملاء</th><th style="padding:8px;text-align:center;color:var(--text-muted);">المواعيد</th><th style="padding:8px;text-align:left;color:var(--text-muted);">الإيرادات</th></tr></thead><tbody>`;
    const total = report.totalRev||1;
    const colors=['var(--teal)','var(--gold-light)','var(--purple)','var(--emerald)'];
    report.branchesTable.forEach((b,i)=>{
      const pct = Math.round(b.revenue/total*100);
      extra += `<tr style="border-bottom:1px solid var(--glass-border);"><td style="padding:9px 8px;font-weight:700;">${i===0?'🏆 ':'🏢 '}${b.name}</td><td style="padding:9px 8px;text-align:center;color:var(--purple);font-weight:700;">${b.patients}</td><td style="padding:9px 8px;text-align:center;color:var(--teal);font-weight:700;">${b.appointments}</td><td style="padding:9px 8px;text-align:left;"><div style="color:${colors[i%4]};font-weight:800;">${b.revenue.toLocaleString()} ج</div><div style="height:4px;background:var(--glass);border-radius:2px;margin-top:4px;overflow:hidden;"><div style="height:100%;background:${colors[i%4]};width:${pct}%;"></div></div></td></tr>`;
    });
    extra += '</tbody></table></div></div>';
  }
  if(report.byChannel){
    extra += `<div style="margin-top:16px;"><div style="font-weight:700;font-size:14px;margin-bottom:10px;">أداء القنوات التسويقية</div>`;
    const colors=['var(--teal)','var(--purple)','var(--gold-light)','var(--rose)','var(--emerald)'];
    Object.entries(report.byChannel).forEach(([ch,data],i)=>{
      const conv = data.leads?Math.round(data.converted/data.leads*100):0;
      extra += `<div style="background:var(--glass);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="font-weight:700;">${ch}</span><span style="color:${colors[i%5]};font-weight:700;">${data.budget.toLocaleString()} ج</span></div><div style="display:flex;gap:12px;font-size:12px;color:var(--text-muted)"><span>ليدز: <b style="color:var(--text-primary)">${data.leads}</b></span><span>محوّل: <b style="color:var(--emerald)">${data.converted}</b></span><span>تحويل: <b style="color:${conv>=30?'var(--teal)':'var(--amber)'}">${conv}%</b></span></div></div>`;
    });
    extra += '</div>';
  }

  modal.innerHTML = `<div class="modal" style="max-width:650px;">
    <div class="mhdr"><div class="mtitle">📊 ${report.title}</div><button class="mclose" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
    <div class="mbody" style="max-height:70vh;overflow-y:auto;">
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:4px;">${summary}</div>
      ${extra}
    </div>
    <div class="mfoot">
      <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
      <button class="btn btn-primary" onclick="exportReportPDF('${type}',this.closest('.modal-overlay'))">📄 تصدير PDF</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
}

function exportReportPDF(type, modalEl){
  const report = generateReport(type);
  if(!report) return;
  const clinicName = DB.obj('settings').clinicName || 'عيادات الحياة للتجميل';
  const clinicPhone = DB.obj('settings').phone || '';
  const now = new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'});

  const summaryHtml = report.summary.map(s=>`<div style="background:#f8f4ef;border-radius:10px;padding:14px;text-align:center;"><div style="font-size:19px;font-weight:800;color:#7A5C38">${s.value}</div><div style="font-size:11px;color:#666;margin-top:3px">${s.label}</div></div>`).join('');

  let bodyHtml = `<div style="display:grid;grid-template-columns:repeat(${Math.min(report.summary.length,4)},1fr);gap:12px;margin-bottom:20px;">${summaryHtml}</div>`;

  if(report.byService){
    const svcs = Object.entries(report.byService).sort((a,b)=>b[1]-a[1]);
    const total = svcs.reduce((s,[,v])=>s+v,0)||1;
    bodyHtml += `<h3 style="font-size:13px;font-weight:700;color:#333;margin:16px 0 8px;">توزيع الإيرادات حسب الخدمة</h3>`;
    svcs.forEach(([k,v])=>{ const pct=Math.round(v/total*100); bodyHtml+=`<div style="margin-bottom:7px;"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px;"><span>${k}</span><span style="font-weight:700;color:#0D9488">${v.toLocaleString()} ج (${pct}%)</span></div><div style="height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden;"><div style="height:100%;background:#0D9488;width:${pct}%;"></div></div></div>`; });
  }
  if(report.byMethod){
    bodyHtml += `<h3 style="font-size:13px;font-weight:700;color:#333;margin:16px 0 8px;">طرق الدفع</h3><table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="background:#f8f4ef;"><th style="padding:7px;text-align:right;border-bottom:2px solid #C4A882;">الطريقة</th><th style="padding:7px;text-align:left;border-bottom:2px solid #C4A882;">المبلغ</th></tr></thead><tbody>${Object.entries(report.byMethod).map(([k,v])=>`<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:7px;">${k}</td><td style="padding:7px;font-weight:700;color:#047857;">${v.toLocaleString()} ج</td></tr>`).join('')}</tbody></table>`;
  }
  if(report.bySource){
    bodyHtml += `<h3 style="font-size:13px;font-weight:700;color:#333;margin:16px 0 8px;">مصادر العملاء</h3><table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="background:#f8f4ef;"><th style="padding:7px;text-align:right;border-bottom:2px solid #C4A882;">المصدر</th><th style="padding:7px;text-align:center;border-bottom:2px solid #C4A882;">العدد</th></tr></thead><tbody>${Object.entries(report.bySource).map(([k,v])=>`<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:7px;">${k}</td><td style="padding:7px;text-align:center;font-weight:700;">${v}</td></tr>`).join('')}</tbody></table>`;
  }
  if(report.doctorsTable){
    bodyHtml += `<h3 style="font-size:13px;font-weight:700;color:#333;margin:16px 0 8px;">أداء الأطباء</h3><table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="background:#f8f4ef;"><th style="padding:7px;text-align:right;border-bottom:2px solid #C4A882;">#</th><th style="padding:7px;text-align:right;border-bottom:2px solid #C4A882;">الطبيب</th><th style="padding:7px;text-align:center;border-bottom:2px solid #C4A882;">التخصص</th><th style="padding:7px;text-align:center;border-bottom:2px solid #C4A882;">العملاء</th><th style="padding:7px;text-align:center;border-bottom:2px solid #C4A882;">الجلسات</th><th style="padding:7px;text-align:left;border-bottom:2px solid #C4A882;">الإيرادات</th></tr></thead><tbody>${report.doctorsTable.map((d,i)=>`<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:7px;font-size:11px;color:#999;">${i+1}</td><td style="padding:7px;font-weight:700;">${d.name}</td><td style="padding:7px;text-align:center;font-size:11px;color:#666;">${d.specialty}</td><td style="padding:7px;text-align:center;">${d.patients}</td><td style="padding:7px;text-align:center;">${d.sessions}</td><td style="padding:7px;font-weight:700;color:#047857;">${d.revenue.toLocaleString()} ج</td></tr>`).join('')}</tbody></table>`;
  }
  if(report.branchesTable){
    bodyHtml += `<h3 style="font-size:13px;font-weight:700;color:#333;margin:16px 0 8px;">أداء الفروع</h3><table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="background:#f8f4ef;"><th style="padding:7px;text-align:right;border-bottom:2px solid #C4A882;">الفرع</th><th style="padding:7px;text-align:center;border-bottom:2px solid #C4A882;">العملاء</th><th style="padding:7px;text-align:center;border-bottom:2px solid #C4A882;">المواعيد</th><th style="padding:7px;text-align:left;border-bottom:2px solid #C4A882;">الإيرادات</th></tr></thead><tbody>${report.branchesTable.map(b=>`<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:7px;font-weight:700;">${b.name}</td><td style="padding:7px;text-align:center;">${b.patients}</td><td style="padding:7px;text-align:center;">${b.appointments}</td><td style="padding:7px;font-weight:700;color:#047857;">${b.revenue.toLocaleString()} ج</td></tr>`).join('')}</tbody></table>`;
  }
  if(report.byChannel){
    bodyHtml += `<h3 style="font-size:13px;font-weight:700;color:#333;margin:16px 0 8px;">القنوات التسويقية</h3><table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="background:#f8f4ef;"><th style="padding:7px;text-align:right;border-bottom:2px solid #C4A882;">القناة</th><th style="padding:7px;text-align:center;border-bottom:2px solid #C4A882;">الميزانية</th><th style="padding:7px;text-align:center;border-bottom:2px solid #C4A882;">الليدز</th><th style="padding:7px;text-align:center;border-bottom:2px solid #C4A882;">المحوّل</th><th style="padding:7px;text-align:left;border-bottom:2px solid #C4A882;">نسبة التحويل</th></tr></thead><tbody>${Object.entries(report.byChannel).map(([k,d])=>`<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:7px;font-weight:700;">${k}</td><td style="padding:7px;text-align:center;">${d.budget.toLocaleString()} ج</td><td style="padding:7px;text-align:center;">${d.leads}</td><td style="padding:7px;text-align:center;color:#047857;font-weight:700;">${d.converted}</td><td style="padding:7px;font-weight:700;">${d.leads?Math.round(d.converted/d.leads*100):0}%</td></tr>`).join('')}</tbody></table>`;
  }
  if(report.lowStock && report.lowStock.length){
    bodyHtml += `<h3 style="font-size:13px;font-weight:700;color:#B45309;margin:16px 0 8px;">⚠️ منتجات تحتاج إعادة طلب</h3><table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="background:#fef9c3;"><th style="padding:7px;text-align:right;border-bottom:2px solid #B45309;">المنتج</th><th style="padding:7px;text-align:center;border-bottom:2px solid #B45309;">الكمية المتبقية</th><th style="padding:7px;text-align:center;border-bottom:2px solid #B45309;">حد إعادة الطلب</th></tr></thead><tbody>${report.lowStock.map(i=>`<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:7px;font-weight:700;">${i.name}</td><td style="padding:7px;text-align:center;color:#dc2626;font-weight:700;">${i.qty}</td><td style="padding:7px;text-align:center;">${i.reorder}</td></tr>`).join('')}</tbody></table>`;
  }

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${report.title}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Tajawal',sans-serif;background:#fff;color:#1a1a1a;padding:28px;font-size:13.5px;}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #C4A882;padding-bottom:18px;margin-bottom:20px;}
.logo{font-size:20px;font-weight:900;color:#C4A882;}.logo-sub{font-size:11px;color:#666;margin-top:3px;}
.rpt-meta{text-align:left;font-size:12px;color:#666;}.rpt-meta strong{font-size:16px;color:#1a1a1a;display:block;}
.footer{text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:14px;margin-top:20px;}
@media print{body{padding:14px;}}</style></head><body>
<div class="header"><div style="display:flex;align-items:center;gap:10px;"><div>${clinicLogoHTML(38)}</div><div><div class="logo">${clinicName}</div><div class="logo-sub">📞 ${clinicPhone}</div></div></div>
<div class="rpt-meta"><span>تقرير رسمي</span><strong>${report.title}</strong><div style="margin-top:3px">📅 ${now}</div></div></div>
${bodyHtml}
<div class="footer">أُنشئ بواسطة نظام عيادات الحياة للتجميل 💎 · ${now}</div>
<script>setTimeout(()=>window.print(),400);<\/script></body></html>`;

  const w = window.open('','_blank','width=860,height=700,scrollbars=yes');
  if(!w){ showToast('error','❌ السماح بفتح النوافذ المنبثقة مطلوب'); return; }
  w.document.write(html);
  w.document.close();
  showToast('success','📄 تم فتح نافذة الطباعة');
}

// Report cards use inline onclick handlers (see screen-reports HTML)

function generateDoctorsReport(){
  const invoices = DB.get('invoices');
  const appointments = DB.get('appointments');
  const doctors = DB.get('doctors');
  const docStats = {};
  doctors.forEach(d=>{ docStats[d.name]={name:d.name,specialty:d.specialty||'—',revenue:0,sessions:0,patients:new Set()}; });
  invoices.forEach(inv=>{
    // البحث بـ doctorId أولاً ثم بالاسم كـ fallback
    let docName='';
    if(inv.doctorId){
      const d=doctors.find(x=>x.id===inv.doctorId);
      docName=d?.name||'';
    }
    if(!docName){
      const appt=appointments.find(a=>(a.patId===inv.patId||a.patient===inv.patient)&&a.date===inv.date);
      docName=(appt?.doctor||inv.doctor||'').trim();
    }
    if(!docName)return;
    if(!docStats[docName]) docStats[docName]={name:docName,specialty:doctors.find(d=>d.name===docName)?.specialty||'—',revenue:0,sessions:0,patients:new Set()};
    docStats[docName].revenue += inv.paid||0;
    docStats[docName].patients.add(inv.patId||inv.patient);
  });
  appointments.forEach(a=>{
    const d=a.doctor;if(!d)return;
    if(!docStats[d]) docStats[d]={name:d,specialty:doctors.find(x=>x.name===d)?.specialty||'—',revenue:0,sessions:0,patients:new Set()};
    docStats[d].sessions++;
    if(a.patId||a.patient) docStats[d].patients.add(a.patId||a.patient);
  });
  const sorted = Object.values(docStats).sort((a,b)=>b.revenue-a.revenue);
  const totalRev = sorted.reduce((s,d)=>s+d.revenue,0);
  return {
    title:'تقرير الأطباء',
    summary:[
      {label:'عدد الأطباء',value:sorted.length,color:'var(--teal)'},
      {label:'إجمالي الإيرادات',value:totalRev.toLocaleString()+' ج',color:'var(--emerald)'},
      {label:'إجمالي الجلسات',value:sorted.reduce((s,d)=>s+d.sessions,0),color:'var(--purple)'},
      {label:'إجمالي العملاء',value:new Set(appointments.map(a=>a.patient)).size,color:'var(--gold-light)'}
    ],
    doctorsTable: sorted.map(d=>({...d,patients:d.patients.size})),
    totalRev
  };
}

function generateBranchesReport(){
  const invoices = DB.get('invoices');
  const appointments = DB.get('appointments');
  const patients = DB.get('patients');
  const branches = [...new Set([...invoices.map(i=>i.branch||'غير محدد'),...appointments.map(a=>a.branch||'غير محدد'),...patients.map(p=>p.branch||'غير محدد')])].filter(Boolean);
  const branchStats = {};
  branches.forEach(b=>branchStats[b]={name:b,revenue:0,appointments:0,patients:new Set()});
  invoices.forEach(i=>{ const b=i.branch||'غير محدد'; if(!branchStats[b])branchStats[b]={name:b,revenue:0,appointments:0,patients:new Set()}; branchStats[b].revenue+=i.paid||0; branchStats[b].patients.add(i.patient); });
  appointments.forEach(a=>{ const b=a.branch||'غير محدد'; if(!branchStats[b])branchStats[b]={name:b,revenue:0,appointments:0,patients:new Set()}; branchStats[b].appointments++; });
  patients.forEach(p=>{ const b=p.branch||'غير محدد'; if(!branchStats[b])branchStats[b]={name:b,revenue:0,appointments:0,patients:new Set()}; branchStats[b].patients.add(p.name); });
  const sorted = Object.values(branchStats).sort((a,b)=>b.revenue-a.revenue);
  const totalRev = sorted.reduce((s,b)=>s+b.revenue,0);
  return {
    title:'تقرير الفروع',
    summary:[
      {label:'عدد الفروع',value:sorted.length,color:'var(--teal)'},
      {label:'إجمالي الإيرادات',value:totalRev.toLocaleString()+' ج',color:'var(--emerald)'},
      {label:'إجمالي المواعيد',value:sorted.reduce((s,b)=>s+b.appointments,0),color:'var(--purple)'},
      {label:'إجمالي العملاء',value:patients.length,color:'var(--gold-light)'}
    ],
    branchesTable: sorted.map(b=>({...b,patients:b.patients.size})),
    totalRev
  };
}

function generateCampaignsReport(){
  const camps = DB.get('campaigns')||[];
  const leads = DB.get('leads')||[];
  const totalBudget = camps.reduce((s,c)=>s+(c.budget||0),0);
  const totalLeads = camps.reduce((s,c)=>s+(c.leadsCount||0),0);
  const totalConv = camps.reduce((s,c)=>s+(c.converted||0),0);
  const byChannel = {};
  camps.forEach(c=>{ const ch=c.channel||'غير محدد'; if(!byChannel[ch])byChannel[ch]={budget:0,leads:0,converted:0}; byChannel[ch].budget+=c.budget||0; byChannel[ch].leads+=c.leadsCount||0; byChannel[ch].converted+=c.converted||0; });
  return {
    title:'تقرير الحملات التسويقية',
    summary:[
      {label:'عدد الحملات',value:camps.length,color:'var(--teal)'},
      {label:'إجمالي الميزانية',value:totalBudget.toLocaleString()+' ج',color:'var(--rose)'},
      {label:'إجمالي الليدز',value:totalLeads,color:'var(--purple)'},
      {label:'معدل التحويل',value:totalLeads?Math.round(totalConv/totalLeads*100)+'%':'0%',color:'var(--emerald)'}
    ],
    byChannel
  };
}

// ══════════════════════════════════════════
