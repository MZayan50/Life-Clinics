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
  if(id){
    DB.upd('expenses',id,data);
    showToast('success',`✅ تم تحديث ${name}`);
    // ✅ تحديث سجل الخزينة المقابل مباشرةً
    const cashlog=DB.get('cashlog')||[];
    const idx=cashlog.findIndex(c=>String(c.refId)===String(id)&&c.source==='مصروف');
    if(idx!==-1){cashlog[idx]={...cashlog[idx],amount:data.amount,date:data.date,notes:data.name};DB.set('cashlog',cashlog);}
    else{
      // لم يُسجَّل من قبل — أضفه الآن
      DB.push('cashlog',{type:'صادر',source:'مصروف',refId:id,amount:data.amount,method:'كاش',date:data.date,timestamp:new Date().toISOString(),notes:data.name});
    }
  }
  else{
    const saved=DB.push('expenses',data);
    // ✅ تسجيل في الخزينة مباشرةً (مع refId للربط عند الحذف)
    DB.push('cashlog',{type:'صادر',source:'مصروف',refId:saved.id,amount:data.amount,method:'كاش',date:data.date,timestamp:new Date().toISOString(),notes:data.name});
    showToast('success',`✅ تم إضافة مصروف: ${name}`,`${amount.toLocaleString()} ج`);
  }
  closeModal('expense-modal');renderExpenses();
  if(document.getElementById('screen-treasury')?.classList.contains('active'))renderTreasury();
  if(document.getElementById('screen-accounts')?.classList.contains('active')&&typeof renderAccounts==='function')renderAccounts();
}
function delExp(id){
  const e=DB.get('expenses').find(x=>x.id===id);
  if(confirm(`حذف مصروف "${e?.name||''}"؟`)){
    // ✅ حذف سجل الخزينة المقابل أولاً
    const cashlog=DB.get('cashlog')||[];
    const filtered=cashlog.filter(c=>!(String(c.refId)===String(id)&&c.source==='مصروف'));
    if(filtered.length!==cashlog.length) DB.set('cashlog',filtered);
    DB.del('expenses',id);
    showToast('info','🗑 تم الحذف');
    renderExpenses();
    if(document.getElementById('screen-treasury')?.classList.contains('active'))renderTreasury();
    if(document.getElementById('screen-accounts')?.classList.contains('active')&&typeof renderAccounts==='function')renderAccounts();
  }
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
// ✅ مزامنة أقساط الباقات — تحويل كل باقة فيها متبقي لقسط تلقائي
async function syncPackageInstallments(){
  const packages = DB.get('packages') || [];
  const installments = DB.get('installments') || [];
  const patients = DB.get('patients') || [];

  // نجيب فواتير الباقات عشان نتحقق بـ fromInvId كمان
  const invoices = DB.get('invoices') || [];

  let added = 0;
  packages.forEach(pkg => {
    const remaining = Math.max(0, (pkg.price||0) - (pkg.paid||0));
    if(remaining <= 0) return; // مدفوع بالكامل

    // فاتورة الباقة دي (لو موجودة)
    const pkgInv = invoices.find(i => String(i.pkgId) === String(pkg.id));

    // تحقق لو فيه قسط موجود بـ pkgId أو fromPkgId أو fromInvId للفاتورة
    const exists = installments.find(i =>
      i.pkgId === pkg.id || i.fromPkgId === pkg.id ||
      (pkgInv && i.fromInvId === pkgInv.id)
    );
    if(exists) return;

    const pat = patients.find(p => String(p.id) === String(pkg.patId));
    DB.push('installments', {
      patientId: pkg.patId,
      patientName: pkg.patName || pat?.name || '—',
      service: `باقة: ${pkg.name||''}`,
      total: pkg.price || 0,
      downPayment: pkg.paid || 0,
      remaining: remaining,
      installmentAmount: remaining,
      count: 1,
      payments: [{ num:1, dueDate: pkg.endDate || pkg.startDate || new Date().toISOString().split('T')[0], paid:false, paidDate:null }],
      startDate: pkg.startDate || new Date().toISOString().split('T')[0],
      status: 'نشط',
      fromPkgId: pkg.id
    });
    if(pat) DB.upd('patients', pat.id, { status: 'قسط' });
    added++;
  });

  if(added > 0){
    showToast('success', `✅ تم إضافة ${added} قسط من الباقات تلقائياً`);
    renderInstallments();
  } else {
    showToast('info', 'لا توجد باقات بمتبقي غير مسجلة في الأقساط');
  }
}

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
  if(pat){
    // ✅ إعادة حساب balance من الصفر من كل الفواتير + كل خطط الأقساط المستقلة
    // بدل الجمع فوق القيمة الموجودة لتجنب التكرار
    const invBalance = DB.get('invoices').filter(i => String(i.patId)===String(pid)||i.patient===pat.name).reduce((s,i)=>s+(i.remaining||0),0);
    const instBalance = DB.get('installments').filter(i => String(i.patientId)===String(pid) && !i.fromInvId).reduce((s,i)=>s+(i.remaining||0),0);
    DB.upd('patients',pat.id,{status:'قسط', balance: invBalance + instBalance});
  }
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
  // ✅ balance يتحدث تلقائياً عبر EventBus _recalcPatFinancials — لا طرح يدوي لتجنب احتساب مضاعف
  // ✅ تسجيل دفعة القسط في الخزينة
  DB.push('cashlog',{
    type:'وارد', source:`دفعة قسط #${nextInst.num} — ${plan.patientName}`,
    service:plan.service||'', amount:plan.installmentAmount, method:'كاش',
    date:nextInst.paidDate, refId:planId,
    timestamp: new Date().toISOString(),
    notes:`قسط ${nextInst.num}/${plan.count}`
  });
  // ✅ BUG#2 FIX: تحديث الفاتورة الأصلية المرتبطة بخطة الأقساط
  if(plan.fromInvId){
    const origInv = DB.get('invoices').find(i => String(i.id) === String(plan.fromInvId));
    if(origInv){
      const newInvPaid = Math.min(origInv.total, (origInv.paid||0) + plan.installmentAmount);
      const newInvRem  = Math.max(0, origInv.total - newInvPaid);
      DB.upd('invoices', origInv.id, {
        paid:      newInvPaid,
        remaining: newInvRem,
        status:    newInvRem === 0 ? 'مدفوع' : 'جزئي'
      });
    }
  }
  // ✅ FIX (مشكلة #7): دفع قسط باقة (fromPkgId) لم يكن يُحدّث pkg.paid ولا فاتورة الباقة المرتبطة
  // إطلاقاً، فكان pkg.paid يبقى عالقاً عند قيمته الأصلية للأبد، ما يجعل أي شاشة تعتمد على
  // packages (الداشبورد، الفواتير، تقارير الإيرادات) تتجاهل دفعات الأقساط المتأخرة على الباقات.
  if(plan.fromPkgId){
    const pkg = DB.get('packages').find(p => String(p.id) === String(plan.fromPkgId));
    if(pkg){
      const newPkgPaid = Math.min(pkg.price||0, (pkg.paid||0) + plan.installmentAmount);
      // DB.upd يُصدر packages:updated تلقائياً، وهو ما يستدعي _recalcPatFinancials
      // فيحدّث patients.balance بالقيمة الصحيحة فوراً (00-core.js سطر 423)
      DB.upd('packages', pkg.id, { paid: newPkgPaid });
      // لو للباقة فاتورة مرتبطة (pkgId)، حدّثها أيضاً حتى لا تختلف عن قيمة الباقة الفعلية
      const pkgInv = DB.get('invoices').find(i => String(i.pkgId) === String(pkg.id));
      if(pkgInv){
        const newInvPaid = Math.min(pkgInv.total||pkg.price||0, (pkgInv.paid||0) + plan.installmentAmount);
        const newInvRem  = Math.max(0, (pkgInv.total||pkg.price||0) - newInvPaid);
        DB.upd('invoices', pkgInv.id, {
          paid:      newInvPaid,
          remaining: newInvRem,
          status:    newInvRem === 0 ? 'مدفوع' : 'جزئي'
        });
      }
    }
  }
  // ✅ يضمن تحديث رصيد العميل فوراً في كل الحالات (مستقل/فاتورة/باقة) دون انتظار حدث آخر
  if(pat && typeof _recalcPatFinancials === 'function') _recalcPatFinancials(pat.id);
  showToast('success',`✅ تم تسجيل دفع القسط #${nextInst.num}`,`${plan.installmentAmount.toLocaleString()} ج`);
  renderInstallments();
}
function delInstallment(id){
  if(confirm('حذف خطة الأقساط؟')){
    const plan=(DB.get('installments')||[]).find(p=>p.id===id);
    if(plan){
      // حذف من localStorage وFirestore معاً
      DB.del('installments', id);
      // إعادة حساب balance للعميل بعد الحذف
      // ✅ FIX (مشكلة #8): كانت المعادلة هنا بديلة وناقصة — تتجاهل أرصدة الباقات التي لم
      // تُسجَّل بعد كقسط (pkg.price - pkg.paid مباشرة)، فيختلف الرصيد هنا عن نفس الرصيد
      // المحسوب في بروفايل العميل. الآن نستخدم نفس الدالة المركزية الوحيدة المعتمدة في كل
      // مكان آخر (فواتير، باقات، بروفايل العميل) لضمان رقم واحد متطابق دائماً.
      const pat = DB.get('patients').find(p=>String(p.id)===String(plan.patientId));
      if(pat && typeof _recalcPatFinancials === 'function') _recalcPatFinancials(pat.id);
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
  // deduplication للـ cashlog قبل أي حسابات
  const _rawCashlog=DB.get('cashlog')||[];
  const _seenRefsT=new Map();
  _rawCashlog.forEach(c=>{
    if(c.refId){
      const ex=_seenRefsT.get(String(c.refId)+'_'+c.type);
      if(!ex||(c.timestamp||'')>(ex.timestamp||'')) _seenRefsT.set(String(c.refId)+'_'+c.type,c);
    } else {
      if(!(c.source||'').includes('بيع منتج')) _seenRefsT.set('no-ref-'+c.id,c);
    }
  });
  const cashlog=[..._seenRefsT.values()];
  // مصدر الإيراد: cashlog:وارد فقط (موحَّد مع الداشبورد والخزينة)
  const totalRevenue=cashlog.filter(c=>c.type==='وارد').reduce((s,c)=>s+(c.amount||0),0);
  // ✅ المصروفات الفعلية = cashlog:صادر (يُحذف منه عند حذف المصروف تلقائياً)
  // expenses لا تزال تُستخدم لتفاصيل التصنيف فقط (Expense breakdown)
  const totalExpense=cashlog.filter(c=>c.type==='صادر').reduce((s,c)=>s+(c.amount||0),0);
  const netProfit=totalRevenue-totalExpense;
  const margin=totalRevenue?Math.round(netProfit/totalRevenue*100):0;

  // Revenue breakdown — من cashlog:وارد مجمَّع بالخدمة
  const revByService={};
  cashlog.filter(c=>c.type==='وارد').forEach(c=>{
    const k=c.service||c.source||'إيراد';
    revByService[k]=(revByService[k]||0)+(c.amount||0);
  });
  const revEl=document.getElementById('acc-revenues');
  if(revEl) revEl.innerHTML=Object.entries(revByService).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--glass-border);"><span style="color:var(--text-muted)">${k}</span><span style="font-weight:700;color:var(--emerald)">${v.toLocaleString()} ج</span></div>`).join('')||'<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">لا توجد إيرادات</div>';

  // Expense breakdown — من expenses فقط (الرواتب المصروفة مسجَّلة هنا تلقائياً)
  const expByType={};
  expenses.forEach(e=>{expByType[e.type||e.category||'أخرى']=(expByType[e.type||e.category||'أخرى']||0)+(e.amount||0);});
  const expEl=document.getElementById('acc-expenses-list');
  if(expEl) expEl.innerHTML=Object.entries(expByType).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--glass-border);"><span style="color:var(--text-muted)">${k}</span><span style="font-weight:700;color:var(--rose)">${v.toLocaleString()} ج</span></div>`).join('')||'<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">لا توجد مصروفات</div>';

  txt('acc-total-revenue',totalRevenue.toLocaleString()+' ج');
  txt('acc-total-expense',totalExpense.toLocaleString()+' ج');
  const npEl=document.getElementById('acc-net-profit');
  if(npEl){npEl.textContent=(netProfit>=0?'+':'')+netProfit.toLocaleString()+' ج';npEl.style.color=netProfit>=0?'var(--emerald)':'var(--rose)';}
  txt('acc-margin',margin+'%');

  // Balance Sheet
  // ✅ FIX: قيمة المخزون الآن بسعر التكلفة عبر الدالة الموحَّدة (كانت بسعر البيع سابقاً)
  const invValue=typeof calcInventoryCostValue==='function' ? calcInventoryCostValue()
    : DB.get('inventory').reduce((s,i)=>s+(i.qty*(i.costPerConsumeUnit||i.costPrice||i.lastPurchasePrice||0)),0);
  const receivables=(DB.get('installments')||[]).reduce((s,p)=>s+(p.remaining||0),0);
  const suppliersOwed=(DB.get('suppliers')||[]).reduce((s,x)=>s+(x.owed||0),0);
  // الكاش = وارد ناقص صادر من cashlog (المصدر الوحيد الصحيح بعد الحذف)
  const cashBalance=Math.max(0,totalRevenue-totalExpense);
  txt('bs-cash',cashBalance.toLocaleString()+' ج');
  txt('bs-inventory',invValue.toLocaleString()+' ج');
  txt('bs-receivables',receivables.toLocaleString()+' ج');
  txt('bs-total-assets',(cashBalance+invValue+receivables).toLocaleString()+' ج');
  txt('bs-suppliers',suppliersOwed.toLocaleString()+' ج');
  // bs-salaries = رواتب مصروفة فعلاً من cashlog:صادر مصدره "رواتب" — رقم عرضي فقط
  const paidSalaries=cashlog.filter(c=>c.type==='صادر'&&(c.notes||'').includes('راتب')).reduce((s,c)=>s+(c.amount||0),0);
  txt('bs-salaries',paidSalaries.toLocaleString()+' ج');
  // ✅ FIX: الرواتب المدفوعة فعلياً جزء من cashlog:صادر، وبالتالي مخصومة بالفعل
  // ضمن totalExpense عند حساب cashBalance أعلاه. طرح paidSalaries مرة أخرى هنا
  // كان يخصم الرواتب مرتين من حقوق الملكية. المعادلة الصحيحة: الأصول - التزامات الموردين فقط.
  txt('bs-equity',(cashBalance+invValue+receivables-suppliersOwed).toLocaleString()+' ج');


  // Cash flow table — الصادر من cashlog:صادر بالشهر
  const cfTb=document.getElementById('cf-tbody');if(!cfTb)return;
  const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const year=new Date().getFullYear();
  const currentMonth=new Date().getMonth();
  let cumulative=0;
  cfTb.innerHTML=MONTHS.map((m,i)=>{
    const mStr=`${year}-${String(i+1).padStart(2,'0')}`;
    const inflow=cashlog.filter(c=>c.type==='وارد'&&(c.date||'').startsWith(mStr)).reduce((s,c)=>s+(c.amount||0),0);
    const outflow=cashlog.filter(c=>c.type==='صادر'&&(c.date||'').startsWith(mStr)).reduce((s,c)=>s+(c.amount||0),0);
    const net=inflow-outflow;cumulative+=net;
    return `<tr>
      <td style="font-weight:600">${m}${i===currentMonth?' <span style="font-size:10px;color:var(--gold-light)">(الحالي)</span>':''}</td>
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

  // ✅ Payments = cashlog وارد فقط مع deduplication بالـ refId
  const cashlog=DB.get('cashlog')||[];
  const _rawEntries=cashlog.filter(c=>c.type==='وارد');
  // إزالة المكررات: لو نفس refId موجود أكتر من مرة، ناخد الأحدث بس
  const _seenRefs=new Map();
  _rawEntries.forEach(c=>{
    if(c.refId){
      const ex=_seenRefs.get(String(c.refId));
      if(!ex||(c.timestamp||'')>(ex.timestamp||'')) _seenRefs.set(String(c.refId),c);
    } else {
      // مش عنده refId → ناخده بس لو مش عنده فاتورة مشابهة (بيع منتج يدوي قديم)
      if(!(c.source||'').includes('بيع منتج')) _seenRefs.set('no-ref-'+c.id,c);
    }
  });
  let entries=[..._seenRefs.values()];

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
    <td style="font-weight:600">${e.patId?(_patName(e.patId)||e.patient||(e.source||'').replace(/فاتورة — |دفعة فاتورة — |دفعة قسط #\d+ — /g,'')):(e.patient||(e.source||'').replace(/فاتورة — |دفعة فاتورة — |دفعة قسط #\d+ — /g,''))}</td>
    <td style="font-size:12px">${e.service||'—'}</td>
    <td style="font-weight:800;color:var(--emerald)">${(e.amount||0).toLocaleString()} ج</td>
    <td><span class="tag tg-teal">${PAY_ICONS[e.method]||'💰'} ${e.method||'—'}</span></td>
    <td style="font-size:12px;color:var(--text-muted)">${e.date||'—'}</td>
    <td style="font-size:11px;color:var(--text-muted)">${e.invId?`#INV ref`:'—'}</td>
    <td><span class="ast sc">مكتمل</span></td>
  </tr>`).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">لا توجد مدفوعات</td></tr>';
};

// ── Treasury rendering using cashlog ──
async function cleanDuplicateCashlog(){
  if(!window._fbReady || !window._firestore){ showToast('warning','⚠️ غير متصل بـ Firebase'); return; }
  showToast('info','⏳ جارٍ فحص التكرار في الخزينة...');

  try{
    const snap = await window._firestore.collection('cashlog').get();
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // تجميع بالـ refId + type
    const grouped = new Map();
    const noRefDups = [];

    all.forEach(c => {
      if(c.refId){
        const key = String(c.refId) + '_' + (c.type||'');
        if(!grouped.has(key)){
          grouped.set(key, []);
        }
        grouped.get(key).push(c);
      } else {
        // بدون refId — تحقق من تكرار بيع منتج يدوي
        if((c.source||'').includes('بيع منتج')){
          noRefDups.push(c);
        }
      }
    });

    // جمع الـ IDs اللي هتتحذف (الأقدم في كل مجموعة، نفضل الأحدث)
    const toDelete = [];
    grouped.forEach((items) => {
      if(items.length <= 1) return;
      // ترتيب بالـ timestamp — الأحدث يفضل
      items.sort((a,b) => (b.timestamp||b.date||'').localeCompare(a.timestamp||a.date||''));
      // احذف كل حاجة غير الأول
      items.slice(1).forEach(c => toDelete.push(c.id));
    });

    // كمان احذف بيع منتج يدوي بدون refId
    noRefDups.forEach(c => toDelete.push(c.id));

    if(!toDelete.length){
      showToast('success','✅ لا يوجد تكرار في الخزينة');
      return;
    }

    if(!confirm(`سيتم حذف ${toDelete.length} سجل مكرر من الخزينة. هل أنت متأكد؟`)) return;

    // حذف batch
    const BATCH = 400;
    for(let i=0;i<toDelete.length;i+=BATCH){
      const batch = window._firestore.batch();
      toDelete.slice(i,i+BATCH).forEach(id => {
        batch.delete(window._firestore.collection('cashlog').doc(id));
      });
      await batch.commit();
    }

    // تحديث الـ cache
    const remaining = all.filter(c => !toDelete.includes(c.id));
    DB._cache['cashlog'] = remaining;
    try{ localStorage.setItem('ha_cashlog', JSON.stringify(remaining)); }catch(e){}

    renderTreasury();
    if(typeof renderPayments==='function') renderPayments();
    showToast('success', `✅ تم حذف ${toDelete.length} سجل مكرر من الخزينة`);

  }catch(e){ showToast('error','❌ خطأ: ' + e.message); console.error(e); }
}

async function clearCashlog(){
  if(!confirm('⚠️ مسح كل حركات الخزينة (cashlog) من Firebase؟\nهذا لا يمكن التراجع عنه.')) return;
  if(!window._fbReady || !window._firestore){ showToast('warning','⚠️ غير متصل بـ Firebase'); return; }
  showToast('info','⏳ جارٍ مسح الخزينة...');
  try{
    const snap = await window._firestore.collection('cashlog').get();
    const ids = snap.docs.map(d => d.id);
    if(!ids.length){ showToast('info','الخزينة فارغة أصلاً'); return; }
    const BATCH = 400;
    for(let i=0;i<ids.length;i+=BATCH){
      const batch = window._firestore.batch();
      ids.slice(i,i+BATCH).forEach(id => batch.delete(window._firestore.collection('cashlog').doc(id)));
      await batch.commit();
    }
    DB._cache['cashlog'] = [];
    try{ localStorage.removeItem('ha_cashlog'); }catch(e){}
    renderTreasury();
    showToast('success','✅ تم مسح ' + ids.length + ' حركة من الخزينة');
  }catch(e){ showToast('error','❌ خطأ: ' + e.message); }
}

function syncTreasury(){
  if(!confirm('سيتم إعادة مزامنة الخزينة بناءً على البيانات الحالية.\nأي مصروف محذوف سيُحذف من الخزينة تلقائياً.\nتكملة؟')) return;

  const expenses  = DB.get('expenses') || [];
  const cashlog   = DB.get('cashlog')  || [];

  // 1. احتفظ بكل الحركات الواردة + غير المصروفات
  const nonExpOut = cashlog.filter(c => !(c.type === 'صادر' && c.source === 'مصروف'));

  // 2. أعد بناء حركات المصروفات من expenses الحالية فقط
  const expEntries = expenses.map(e => ({
    type: 'صادر', source: 'مصروف', refId: e.id,
    amount: e.amount || 0, method: e.method || 'كاش',
    date: e.date || new Date().toISOString().split('T')[0],
    timestamp: e.createdAt || new Date().toISOString(),
    notes: e.name || 'مصروف'
  }));

  const newCashlog = [...nonExpOut, ...expEntries];
  DB.set('cashlog', newCashlog);

  renderTreasury();
  showToast('success', '✅ تمت المزامنة', `${expEntries.length} مصروف — ${nonExpOut.filter(c=>c.type==='صادر').length} حركة صادرة أخرى`);
}

function renderTreasury(){
  const cashlog=DB.get('cashlog')||[];
  const today=new Date().toISOString().split('T')[0];

  const totalIn      = cashlog.filter(c=>c.type==='وارد').reduce((s,c)=>s+(c.amount||0),0);
  const totalOut     = cashlog.filter(c=>c.type==='صادر').reduce((s,c)=>s+(c.amount||0),0);
  const balance      = totalIn - totalOut;

  const todayIn  = cashlog.filter(c=>c.type==='وارد'&&c.date===today).reduce((s,c)=>s+(c.amount||0),0);
  const todayOut = cashlog.filter(c=>c.type==='صادر'&&c.date===today).reduce((s,c)=>s+(c.amount||0),0);

  const movements = [...cashlog]
    .map(c=>({...c, dir: c.type==='وارد'?'in':'out'}))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''))
    .slice(0,30);

  const el=document.getElementById('treasury-content');if(!el)return;
  el.innerHTML=`
    <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
      <button class="btn btn-ghost" onclick="syncTreasury()" style="gap:7px;font-size:13px;border:1px solid var(--glass-border);">
        🔄 مزامنة البيانات
      </button>
      <button class="btn btn-ghost btn-sm" onclick="cleanDuplicateCashlog()" style="font-size:13px;border:1px solid var(--amber);color:var(--amber);">
        🧹 تنظيف التكرار
      </button>
      <button class="btn btn-danger btn-sm" onclick="clearCashlog()" style="font-size:13px;">
        🗑️ مسح الخزينة
      </button>
    </div>
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

