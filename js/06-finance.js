// EXPENSES
function renderExpenses(){
  const tb=document.getElementById('exp-tbody');if(!tb)return;
  const q=(document.getElementById('exp-search')?.value||'').trim().toLowerCase();
  const type=document.getElementById('exp-type-filter')?.value||'';
  let exps=DB.get('expenses');
  if(q)exps=exps.filter(e=>e.name.toLowerCase().includes(q));
  if(type)exps=exps.filter(e=>e.type===type);
  exps=[...exps].sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const all=DB.get('expenses');
  const total=all.reduce((s,e)=>s+(e.amount||0),0);
  const thisMonth=new Date().toISOString().slice(0,7);
  const monthTotal=all.filter(e=>(e.date||'').startsWith(thisMonth)).reduce((s,e)=>s+(e.amount||0),0);
  const byType={};
  all.forEach(e=>{byType[e.type]=(byType[e.type]||0)+(e.amount||0);});
  const topType=Object.keys(byType).sort((a,b)=>byType[b]-byType[a])[0]||'—';

  txt('exp-kpi-total',total.toLocaleString());
  txt('exp-kpi-month',monthTotal.toLocaleString());
  txt('exp-kpi-top',topType);
  txt('exp-kpi-count',all.length);

  tb.innerHTML=exps.map(e=>`<tr><td style="font-weight:600">${e.name}</td><td><span class="tag tg-purple">${e.type}</span></td><td style="font-size:12px">${e.branch||'—'}</td><td style="color:var(--rose);font-weight:700">${(e.amount||0).toLocaleString()} ج</td><td style="font-size:12px">${e.date||'—'}</td><td style="display:flex;gap:5px;"><button class="btn btn-ghost btn-xs" onclick="openExpModal('${e.id}')">✏️</button><button class="btn btn-danger btn-xs" onclick="delExp('${e.id}')">🗑</button></td></tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">لا توجد مصروفات مطابقة</td></tr>';
}
function openExpModal(id){
  const e=id?DB.get('expenses').find(x=>x.id===id):null;
  document.getElementById('exp-modal-title').textContent=e?'✏️ تعديل المصروف':'💸 مصروف جديد';
  document.getElementById('exp-id').value=e?e.id:'';
  document.getElementById('exp-name').value=e?e.name:'';
  document.getElementById('exp-type').value=e?e.type:'إيجار';
  document.getElementById('exp-amount').value=e?e.amount:'';
  document.getElementById('exp-branch').value=e?e.branch:'مدينة نصر';
  document.getElementById('exp-date').value=e?e.date:new Date().toISOString().split('T')[0];
  document.getElementById('exp-notes').value=e?e.notes||'':'';
  openModal('expense-modal');
}
function saveExp(){
  const name=gv('exp-name').trim();if(!name){showToast('warning','⚠️ بيان المصروف مطلوب');return;}
  const amount=parseFloat(gv('exp-amount'))||0;if(amount<=0){showToast('warning','⚠️ أدخل مبلغًا صحيحًا');return;}
  const id=gv('exp-id');
  const data={name,type:gv('exp-type'),amount,branch:gv('exp-branch'),date:gv('exp-date')||new Date().toISOString().split('T')[0],notes:gv('exp-notes')};
  if(id){DB.upd('expenses',id,data);showToast('success',`✅ تم تحديث ${name}`);}
  else{DB.push('expenses',data);showToast('success',`✅ تم إضافة مصروف: ${name}`,`${amount.toLocaleString()} ج`);}
  closeModal('expense-modal');renderExpenses();
  if(document.getElementById('screen-treasury')?.classList.contains('active'))renderTreasury();
}
function delExp(id){
  const e=DB.get('expenses').find(x=>x.id===id);
  if(confirm(`حذف مصروف "${e?.name||''}"؟`)){DB.del('expenses',id);showToast('info','🗑 تم الحذف');renderExpenses();if(document.getElementById('screen-treasury')?.classList.contains('active'))renderTreasury();}
}

// ✅ renderInstallments الكاملة موجودة في الأسفل (النسخة المتطورة بـ plans)
// هذه النسخة البسيطة محذوفة

// ── collectPayment() مُلغاة — كانت كود ميت (مش مستدعاة من أي مكان، التحصيل كله بقى
// عبر openSmartPay/processSmartPayment) وكانت فيها نفس باج طرح المبلغ مرتين من رصيد العميل ──

function sendAllReminders(){
  const invoices = DB.get('invoices').filter(i=>i.remaining>0);
  showToast('success',`📱 تم إرسال ${invoices.length} تذكير عبر واتساب`,'للعملاء الذين لديهم أقساط متأخرة');
}

// ✅ renderInstallments تُستدعى من showScreen الموحدة في 00-core.js

// ══════════════════════════════════════════
// 🏦 TREASURY SCREEN — النسخة الكاملة بـ cashlog في الأسفل
// ══════════════════════════════════════════

// ✅ renderTreasury تُستدعى من showScreen الموحدة في 00-core.js

// ✅ renderPayments الكاملة بـ cashlog موجودة في الأسفل

// ══════════════════════════════════════════
// 📆 INSTALLMENTS SCREEN
// ══════════════════════════════════════════
function renderInstallments(q){
  q = q||'';
  const stFilter = document.getElementById('inst-status-filter')?.value||'';
  let plans = DB.get('installments')||[];
  if(q) plans = plans.filter(p=>p.patientName.includes(q));
  if(stFilter) plans = plans.filter(p=>p.status===stFilter);

  const all = DB.get('installments')||[];
  const totalRemaining = all.reduce((s,p)=>s+(p.remaining||0),0);
  const overdue = all.filter(p=>p.status==='متأخر').length;
  const thisMonth = new Date().toISOString().slice(0,7);
  const paidThisMonth = all.filter(p=>p.status==='مكتمل'&&(p.startDate||'').startsWith(thisMonth)).length;
  const clientsWithPlans = [...new Set(all.map(p=>p.patientId))].length;

  txt('inst-kpi-total', totalRemaining.toLocaleString()+' ج');
  txt('inst-kpi-overdue', overdue);
  txt('inst-kpi-paid', paidThisMonth);
  txt('inst-kpi-clients', clientsWithPlans);
  txt('inst-count-lbl', plans.length+' خطة');

  const tb = document.getElementById('inst-tbody'); if(!tb) return;
  tb.innerHTML = plans.map(p=>{
    const paidCount = p.payments ? p.payments.filter(x=>x.paid).length : 0;
    const nextDue = p.payments ? p.payments.find(x=>!x.paid) : null;
    const stClass = p.status==='مكتمل'?'sc':p.status==='متأخر'?'sx':'sp';
    return `<tr>
      <td style="font-weight:600">${p.patientName||'—'}</td>
      <td style="font-size:12px">${p.service||'—'}</td>
      <td style="font-weight:700">${(p.total||0).toLocaleString()} ج</td>
      <td style="color:var(--emerald);font-weight:700">${(p.downPayment||0).toLocaleString()} ج</td>
      <td style="color:${(p.remaining||0)>0?'var(--rose)':'var(--emerald)'};font-weight:700">${(p.remaining||0).toLocaleString()} ج</td>
      <td><div class="prog"><div class="prog-f" style="width:${p.count?Math.round(paidCount/p.count*100):0}%;background:var(--teal)"></div></div><div style="font-size:10px;color:var(--text-muted);margin-top:3px">${paidCount}/${p.count||0}</div></td>
      <td style="font-size:12px;color:var(--amber)">${nextDue?nextDue.dueDate:'—'}</td>
      <td><span class="ast ${stClass}">${p.status||'نشط'}</span></td>
      <td style="display:flex;gap:5px;">
        ${nextDue?`<button class="btn btn-teal btn-xs" onclick="payInstallment('${p.id}')">💰 دفع</button>`:''}
        <button class="btn btn-danger btn-xs" onclick="delInstallment('${p.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('')||'<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px">لا توجد خطط أقساط</td></tr>';

  const logTb = document.getElementById('inst-log-tbody'); if(!logTb) return;
  const logs = [];
  (DB.get('installments')||[]).forEach(p=>{
    (p.payments||[]).filter(x=>x.paid).forEach(x=>{
      logs.push({patient:p.patientName, installNum:x.num, amount:p.installmentAmount, date:x.paidDate});
    });
  });
  logs.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  logTb.innerHTML = logs.map(l=>`<tr>
    <td style="font-weight:600">${l.patient}</td>
    <td style="color:var(--text-muted)">قسط #${l.installNum}</td>
    <td style="color:var(--emerald);font-weight:700">${(l.amount||0).toLocaleString()} ج</td>
    <td style="font-size:12px">${l.date||'—'}</td>
    <td><span class="ast sc">مدفوع</span></td>
  </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:16px">لا توجد سجلات</td></tr>';
}

function openInstModal(){
  const pats = DB.get('patients');
  const sel = document.getElementById('inst-pat'); if(!sel) return;
  sel.innerHTML = '<option value="">-- اختر عميل --</option>'+pats.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('inst-edit-id').value='';
  document.getElementById('inst-total').value='';
  document.getElementById('inst-down').value='0';
  document.getElementById('inst-count-sel').value='3';
  document.getElementById('inst-start').value=new Date().toISOString().split('T')[0];
  calcInstPlan();
  openModal('installment-modal');
}
function calcInstPlan(){
  const total=parseFloat(document.getElementById('inst-total')?.value)||0;
  const down=parseFloat(document.getElementById('inst-down')?.value)||0;
  const count=parseInt(document.getElementById('inst-count-sel')?.value)||3;
  const remain=Math.max(0,total-down);
  const each=count?Math.ceil(remain/count):0;
  txt('inst-preview-remain',remain.toLocaleString()+' ج');
  txt('inst-preview-each',each.toLocaleString()+' ج');
}
function saveInstallment(){
  const pid=document.getElementById('inst-pat')?.value;
  const total=parseFloat(document.getElementById('inst-total')?.value)||0;
  if(!pid||!total){showToast('warning','⚠️ اختر العميل والمبلغ');return;}
  const pat=DB.get('patients').find(p=>p.id==pid);
  const down=parseFloat(document.getElementById('inst-down')?.value)||0;
  const count=parseInt(document.getElementById('inst-count-sel')?.value)||3;
  const svc=document.getElementById('inst-svc')?.value||'';
  const startDate=document.getElementById('inst-start')?.value||new Date().toISOString().split('T')[0];
  const remain=Math.max(0,total-down);
  const each=Math.ceil(remain/count);
  const payments=[];
  for(let i=1;i<=count;i++){
    const d=new Date(startDate);d.setMonth(d.getMonth()+i);
    payments.push({num:i,dueDate:d.toISOString().split('T')[0],paid:false,paidDate:null});
  }
  const plan={patientId:pid,patientName:pat?.name||'—',service:svc,total,downPayment:down,remaining:remain,installmentAmount:each,count,payments,startDate,status:'نشط'};
  if(!DB.get('installments')) DB.set('installments',[]);
  DB.push('installments',plan);
  if(pat) DB.upd('patients',pat.id,{status:'قسط',balance:(pat.balance||0)+remain});
  closeModal('installment-modal');
  showToast('success',`✅ تم إنشاء خطة أقساط لـ ${pat?.name}`,`${count} أقساط × ${each.toLocaleString()} ج`);
  renderInstallments();
}
function payInstallment(planId){
  const plans=DB.get('installments')||[];
  const plan=plans.find(p=>p.id===planId); if(!plan) return;
  const nextInst=plan.payments.find(x=>!x.paid); if(!nextInst) return;
  if(!confirm(`تأكيد دفع القسط #${nextInst.num} بمبلغ ${plan.installmentAmount.toLocaleString()} ج؟`)) return;
  nextInst.paid=true;
  nextInst.paidDate=new Date().toISOString().split('T')[0];
  plan.remaining=Math.max(0,plan.remaining-plan.installmentAmount);
  if(plan.payments.every(x=>x.paid)) plan.status='مكتمل';
  DB.upd('installments',planId,plan);
  const pat=DB.get('patients').find(p=>p.id===plan.patientId);
  if(pat) DB.upd('patients',pat.id,{balance:Math.max(0,(pat.balance||0)-plan.installmentAmount)});
  // ✅ تسجيل دفعة القسط في الخزينة — كانت غير موجودة، فدفعات الأقساط ما كانت توصل لـ cashlog إطلاقًا
  DB.push('cashlog',{
    type:'وارد', source:`دفعة قسط #${nextInst.num} — ${plan.patientName}`,
    service:plan.service||'', amount:plan.installmentAmount, method:'كاش',
    date:nextInst.paidDate, refId:planId, notes:`قسط ${nextInst.num}/${plan.count}`
  });
  showToast('success',`✅ تم تسجيل دفع القسط #${nextInst.num}`,`${plan.installmentAmount.toLocaleString()} ج`);
  renderInstallments();
}
function delInstallment(id){
  if(confirm('حذف خطة الأقساط؟')){
    const plan=(DB.get('installments')||[]).find(p=>p.id===id);
    if(plan){
      const patsArr=DB.get('installments').filter(p=>p.id!==id);
      DB.set('installments',patsArr);
    }
    showToast('info','🗑️ تم حذف خطة الأقساط');
    renderInstallments();
  }
}

// ══════════════════════════════════════════
function renderAccounts(){
  const invoices=DB.get('invoices');
  const expenses=DB.get('expenses');
  const today=new Date().toISOString().slice(0,7);

  document.getElementById('acc-period-lbl').textContent=new Date().toLocaleDateString('ar-EG',{month:'long',year:'numeric'});

  // P&L
  const cashlog=DB.get('cashlog')||[];
  const totalRevenue=invoices.reduce((s,i)=>s+(i.paid||0),0);
  const totalExpense=expenses.reduce((s,e)=>s+(e.amount||0),0);
  const staffSalariesMonth=DB.get('staff').reduce((s,x)=>s+(x.salary||0),0);
  const totalCost=totalExpense+staffSalariesMonth;
  const netProfit=totalRevenue-totalCost;
  const margin=totalRevenue?Math.round(netProfit/totalRevenue*100):0;

  // Revenue breakdown
  const revByService={};
  invoices.forEach(i=>{revByService[i.service]=(revByService[i.service]||0)+(i.paid||0);});
  const revEl=document.getElementById('acc-revenues');
  if(revEl) revEl.innerHTML=Object.entries(revByService).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--glass-border);"><span style="color:var(--text-muted)">${k}</span><span style="font-weight:700;color:var(--emerald)">${v.toLocaleString()} ج</span></div>`).join('')||'<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">لا توجد إيرادات</div>';

  // Expense breakdown — تشمل المصروفات + الرواتب
  const expByType={};
  expenses.forEach(e=>{expByType[e.type]=(expByType[e.type]||0)+(e.amount||0);});
  if(staffSalariesMonth>0) expByType['رواتب الموظفين']=(expByType['رواتب الموظفين']||0)+staffSalariesMonth;
  const expEl=document.getElementById('acc-expenses-list');
  if(expEl) expEl.innerHTML=Object.entries(expByType).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--glass-border);"><span style="color:var(--text-muted)">${k}</span><span style="font-weight:700;color:var(--rose)">${v.toLocaleString()} ج</span></div>`).join('')||'<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">لا توجد مصروفات</div>';

  txt('acc-total-revenue',totalRevenue.toLocaleString()+' ج');
  txt('acc-total-expense',totalCost.toLocaleString()+' ج');
  const npEl=document.getElementById('acc-net-profit');
  if(npEl){npEl.textContent=(netProfit>=0?'+':'')+netProfit.toLocaleString()+' ج';npEl.style.color=netProfit>=0?'var(--emerald)':'var(--rose)';}
  txt('acc-margin',margin+'%');

  // Balance Sheet
  const invValue=DB.get('inventory').reduce((s,i)=>s+(i.qty*i.price),0);
  const receivables=(DB.get('installments')||[]).reduce((s,p)=>s+(p.remaining||0),0);
  const suppliersOwed=(DB.get('suppliers')||[]).reduce((s,x)=>s+(x.owed||0),0);
  // الكاش الفعلي = كل الوارد (من cashlog + فواتير مباشرة) ناقص كل المصروفات
  const cashIn=cashlog.filter(c=>c.type==='وارد').reduce((s,c)=>s+(c.amount||0),0);
  const invPaidDirect=(DB.get('invoices')||[]).filter(i=>i.paid>0&&!cashlog.find(c=>c.invId===String(i.id))).reduce((s,i)=>s+(i.paid||0),0);
  const cashBalance=Math.max(0,(cashIn+invPaidDirect)-totalCost);
  txt('bs-cash',cashBalance.toLocaleString()+' ج');
  txt('bs-inventory',invValue.toLocaleString()+' ج');
  txt('bs-receivables',receivables.toLocaleString()+' ج');
  txt('bs-total-assets',(cashBalance+invValue+receivables).toLocaleString()+' ج');
  txt('bs-suppliers',suppliersOwed.toLocaleString()+' ج');
  txt('bs-salaries',staffSalariesMonth.toLocaleString()+' ج');
  txt('bs-equity',(cashBalance+invValue+receivables-suppliersOwed-staffSalariesMonth).toLocaleString()+' ج');

  // Cash flow table
  const cfTb=document.getElementById('cf-tbody');if(!cfTb)return;
  const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const year=new Date().getFullYear();
  let cumulative=0;
  cfTb.innerHTML=MONTHS.map((m,i)=>{
    const mStr=`${year}-${String(i+1).padStart(2,'0')}`;
    const inflow=invoices.filter(x=>(x.date||'').startsWith(mStr)).reduce((s,x)=>s+(x.paid||0),0);
    const expOutflow=expenses.filter(x=>(x.date||'').startsWith(mStr)).reduce((s,x)=>s+(x.amount||0),0);
    // الرواتب تظهر شهرياً حتى لو مش مسجلة بتاريخ
    const outflow=expOutflow+staffSalariesMonth;
    const net=inflow-outflow;cumulative+=net;
    return `<tr>
      <td style="font-weight:600">${m}</td>
      <td style="color:var(--emerald);font-weight:700">${inflow.toLocaleString()} ج</td>
      <td style="color:var(--rose);font-weight:700">${outflow.toLocaleString()} ج</td>
      <td style="color:${net>=0?'var(--teal)':'var(--rose)'};font-weight:800">${net>=0?'+':''}${net.toLocaleString()} ج</td>
      <td style="color:${cumulative>=0?'var(--gold-light)':'var(--rose)'};font-weight:700">${cumulative.toLocaleString()} ج</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════
// PATCH showScreen for new screens
// ══════════════════════════════════════════
// ✅ كل render calls منقولة لـ showScreen الموحدة في 00-core.js

// ✅ DB.push و DB.get معرّفان في 00-core.js بشكل صحيح مع audit + fbSet
// لا حاجة لأي override هنا

// ══════════════════════════════════════════
// 💳 PAYMENTS — النسخة الكاملة بـ cashlog
// ══════════════════════════════════════════
function renderPayments(q){
  q=q||(document.getElementById('pay-search')?.value||'').toLowerCase();
  const method=document.getElementById('pay-method-filter')?.value||'';
  const dateFilter=document.getElementById('pay-date-filter')?.value||'';

  // Payments = all cashlog entries + paid invoices
  const cashlog=DB.get('cashlog')||[];
  let entries=cashlog.filter(c=>c.type==='وارد');

  // Also include direct paid invoices not yet in cashlog
  const invsPaid=(DB.get('invoices')||[]).filter(i=>i.paid>0&&!cashlog.find(c=>c.invId===String(i.id)));
  invsPaid.forEach(inv=>{
    entries.push({id:'_inv_'+inv.id,type:'وارد',amount:inv.paid,patId:inv.patId,source:`دفعة فاتورة — ${inv.patient}`,service:inv.service,method:inv.method||'كاش',date:inv.date,invId:String(inv.id),notes:''});
  });

  if(q) entries=entries.filter(e=>(e.source||'').includes(q)||(e.service||'').includes(q));
  if(method) entries=entries.filter(e=>e.method===method);
  if(dateFilter) entries=entries.filter(e=>e.date===dateFilter);
  entries=[...entries].sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const today=new Date().toISOString().split('T')[0];
  const allPaid=cashlog.filter(c=>c.type==='وارد');
  const todayTotal=allPaid.filter(c=>c.date===today).reduce((s,c)=>s+(c.amount||0),0);
  const visa=allPaid.filter(c=>c.method==='فيزا').reduce((s,c)=>s+(c.amount||0),0);
  const cash=allPaid.filter(c=>c.method==='كاش').reduce((s,c)=>s+(c.amount||0),0);
  const transfer=allPaid.filter(c=>['إنستاباي','فودافون','تحويل'].includes(c.method)).reduce((s,c)=>s+(c.amount||0),0);
  const totalAll=allPaid.reduce((s,c)=>s+(c.amount||0),0);

  txt('pay-kpi-total',totalAll.toLocaleString()+' ج');
  txt('pay-kpi-today',todayTotal.toLocaleString()+' ج');
  txt('pay-kpi-visa',visa.toLocaleString()+' ج');
  txt('pay-kpi-cash',cash.toLocaleString()+' ج');
  txt('pay-kpi-transfer',transfer.toLocaleString()+' ج');
  txt('pay-count-lbl',entries.length+' عملية');

  const PAY_ICONS={'كاش':'💵','فيزا':'💳','إنستاباي':'📱','فودافون':'📱','تحويل':'🏦','أقساط':'📆'};
  const tb=document.getElementById('pay-tbody');if(!tb)return;
  tb.innerHTML=entries.map((e,i)=>`<tr>
    <td style="font-size:11px;color:var(--gold-light);font-weight:700">#PAY-${String(i+1).padStart(3,'0')}</td>
    <td style="font-weight:600">${e.patId?(_patName(e.patId)||(e.source||'').replace('دفعة فاتورة — ','')):(e.source||'').replace('دفعة فاتورة — ','')}</td>
    <td style="font-size:12px">${e.service||'—'}</td>
    <td style="font-weight:800;color:var(--emerald)">${(e.amount||0).toLocaleString()} ج</td>
    <td><span class="tag tg-teal">${PAY_ICONS[e.method]||'💰'} ${e.method||'—'}</span></td>
    <td style="font-size:12px;color:var(--text-muted)">${e.date||'—'}</td>
    <td style="font-size:11px;color:var(--text-muted)">${e.invId?`#INV ref`:'—'}</td>
    <td><span class="ast sc">مكتمل</span></td>
  </tr>`).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">لا توجد مدفوعات</td></tr>';
};

// ── Treasury rendering using cashlog ──
function renderTreasury(){
  const cashlog=DB.get('cashlog')||[];
  const expenses=DB.get('expenses')||[];
  const today=new Date().toISOString().split('T')[0];

  // Total in = all وارد entries + invoice paid that's not in cashlog
  const invPaid=(DB.get('invoices')||[]).filter(i=>i.paid>0&&!cashlog.find(c=>c.invId===String(i.id))).reduce((s,i)=>s+(i.paid||0),0);
  const totalIn=cashlog.filter(c=>c.type==='وارد').reduce((s,c)=>s+(c.amount||0),0)+invPaid;
  const totalOut=expenses.reduce((s,e)=>s+(e.amount||0),0);
  const balance=totalIn-totalOut;

  const todayIn=(DB.get('invoices')||[]).filter(i=>i.date===today).reduce((s,i)=>s+(i.paid||0),0)+cashlog.filter(c=>c.type==='وارد'&&c.date===today).reduce((s,c)=>s+(c.amount||0),0);
  const todayOut=expenses.filter(e=>e.date===today).reduce((s,e)=>s+(e.amount||0),0);

  // Recent movements
  const movements=[
    ...cashlog.filter(c=>c.type==='وارد').map(c=>({...c,dir:'in'})),
    ...(DB.get('invoices')||[]).filter(i=>i.paid>0&&!cashlog.find(c=>c.invId===String(i.id))).map(i=>({dir:'in',amount:i.paid,source:`دفعة — ${i.patient}`,service:i.service,date:i.date,method:i.method})),
    ...expenses.map(e=>({dir:'out',amount:e.amount,source:`مصروف — ${e.category||e.desc||''}`,date:e.date,method:'نقدي'}))
  ].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,30);

  const el=document.getElementById('treasury-content');if(!el)return;
  el.innerHTML=`
    <div class="kpi-grid" style="margin-bottom:18px;">
      <div class="kpi-card kc-emerald"><div class="kpi-icon">🏦</div><div class="kpi-value">${balance.toLocaleString()} ج</div><div class="kpi-label">رصيد الخزينة الحالي</div></div>
      <div class="kpi-card kc-teal"><div class="kpi-icon">📥</div><div class="kpi-value">${totalIn.toLocaleString()} ج</div><div class="kpi-label">إجمالي الوارد</div></div>
      <div class="kpi-card kc-rose"><div class="kpi-icon">📤</div><div class="kpi-value">${totalOut.toLocaleString()} ج</div><div class="kpi-label">إجمالي الصادر</div></div>
      <div class="kpi-card kc-gold"><div class="kpi-icon">📅</div><div class="kpi-value">${todayIn.toLocaleString()} ج</div><div class="kpi-label">وارد اليوم</div></div>
      <div class="kpi-card kc-amber"><div class="kpi-icon">💸</div><div class="kpi-value">${todayOut.toLocaleString()} ج</div><div class="kpi-label">صادر اليوم</div></div>
    </div>
    <div class="card">
      <div class="card-hdr"><div class="card-title">📋 حركات الخزينة</div><span class="card-sub">آخر 30 حركة</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>النوع</th><th>المصدر</th><th>الخدمة</th><th>المبلغ</th><th>الطريقة</th><th>التاريخ</th></tr></thead>
        <tbody>${movements.map(m=>`<tr>
          <td><span class="ast ${m.dir==='in'?'sc':'sx'}">${m.dir==='in'?'📥 وارد':'📤 صادر'}</span></td>
          <td style="font-size:12.5px">${m.source||'—'}</td>
          <td style="font-size:12px;color:var(--text-muted)">${m.service||'—'}</td>
          <td style="font-weight:800;color:${m.dir==='in'?'var(--emerald)':'var(--rose)'}">${(m.amount||0).toLocaleString()} ج</td>
          <td style="font-size:12px">${m.method||'—'}</td>
          <td style="font-size:12px;color:var(--text-muted)">${m.date||'—'}</td>
        </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">لا توجد حركات</td></tr>'}
        </tbody>
      </table></div>
    </div>`;
}

// ✅ treasury و invoices في showScreen الموحدة بـ 00-core.js

// Run installment status check on load + every 5 minutes
setTimeout(updateInstallmentStatuses, 3000);
setInterval(updateInstallmentStatuses, 5 * 60 * 1000);

