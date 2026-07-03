// ══════════════════════════════════════════
// 💼 ACCOUNTING MODULE — دليل الحسابات (Chart of Accounts)
// المرحلة 1 من دليل تطوير الطبقة المحاسبية
// يتحمّل بعد 12-financial-integration.js في index.html
// ⚠️ لا يلمس أي كود شغّال حاليًا (saveExp/saveInvoice/renderTreasury) —
//    هذا الملف إضافة صرفة فوق النظام الحالي.
// ══════════════════════════════════════════

const DEFAULT_COA = [
  {code:'1110', name:'الخزينة النقدية',   type:'asset',     normalBalance:'debit'},
  {code:'1120', name:'حساب فيزا/بنك',      type:'asset',     normalBalance:'debit'},
  {code:'1130', name:'ذمم العملاء',        type:'asset',     normalBalance:'debit'},
  {code:'1140', name:'المخزون',            type:'asset',     normalBalance:'debit'},
  {code:'1210', name:'أجهزة ومعدات',       type:'asset',     normalBalance:'debit'},
  {code:'2100', name:'ذمم الموردين',       type:'liability', normalBalance:'credit'},
  {code:'2200', name:'ضرائب مستحقة',       type:'liability', normalBalance:'credit'},
  {code:'2300', name:'رواتب مستحقة',       type:'liability', normalBalance:'credit'},
  {code:'3100', name:'رأس مال المالك',     type:'equity',    normalBalance:'credit'},
  {code:'3200', name:'أرباح مرحّلة',       type:'equity',    normalBalance:'credit'},
  {code:'4100', name:'إيراد خدمات',        type:'revenue',   normalBalance:'credit'},
  {code:'4200', name:'إيراد بيع منتجات',   type:'revenue',   normalBalance:'credit'},
  {code:'4300', name:'إيراد باقات',        type:'revenue',   normalBalance:'credit'},
  {code:'5100', name:'تكلفة المواد',       type:'expense',   normalBalance:'debit'},
  {code:'5200', name:'إيجار',              type:'expense',   normalBalance:'debit'},
  {code:'5300', name:'رواتب',              type:'expense',   normalBalance:'debit'},
  {code:'5400', name:'مرافق',              type:'expense',   normalBalance:'debit'},
  {code:'5500', name:'تسويق',              type:'expense',   normalBalance:'debit'},
  {code:'5600', name:'صيانة',              type:'expense',   normalBalance:'debit'},
  {code:'5900', name:'مصروفات متنوعة',     type:'expense',   normalBalance:'debit'},
];

// ── إنشاء دليل الحسابات الافتراضي (مرة واحدة فقط) ──
async function seedChartOfAccounts(){
  const existing = DB.get('chart_of_accounts')||[];
  if(existing.length){
    showToast('info', `ℹ️ دليل الحسابات موجود بالفعل (${existing.length} حساب)`);
    return;
  }
  DEFAULT_COA.forEach(a=>{
    DB.push('chart_of_accounts', {...a, isActive:true});
  });
  showToast('success', `✅ تم إنشاء دليل الحسابات الافتراضي (${DEFAULT_COA.length} حساب)`);
  if(typeof renderChartOfAccounts === 'function') renderChartOfAccounts();
}

// ── جلب حساب بالكود ──
function getAccountByCode(code){
  return (DB.get('chart_of_accounts')||[]).find(a=>a.code===code);
}

// ══════════════════════════════════════════
// 📒 JOURNAL ENTRY ENGINE — محرك القيود المحاسبية
// المرحلة 2 من دليل تطوير الطبقة المحاسبية
// ⚠️ لسه من غير أي ربط تلقائي بالفواتير/المصروفات — هيتضاف في المرحلة 3
// ══════════════════════════════════════════

let _jeCounter = null;

async function _getNextEntryNumber(){
  if(_jeCounter===null){
    const all = DB.get('journal_entries')||[];
    _jeCounter = all.length;
  }
  _jeCounter++;
  return 'JE-' + String(_jeCounter).padStart(6,'0');
}

// ── الدالة المركزية — كل قيد في النظام يمر من هنا ──
async function postJournalEntry({date, description, sourceType, sourceId, lines}){
  const totalDebit  = lines.reduce((s,l)=>s+(l.debit||0),0);
  const totalCredit = lines.reduce((s,l)=>s+(l.credit||0),0);

  // ✅ فحص التوازن — لا نسمح بقيد غير متوازن إطلاقًا
  if(Math.abs(totalDebit - totalCredit) > 0.01){
    console.error('[Accounting] قيد غير متوازن!', {totalDebit, totalCredit, lines});
    showToast('error', '❌ خطأ محاسبي: القيد غير متوازن — راجع المطور');
    return null;
  }

  // ✅ فحص إغلاق الفترة (يُفعّل فعليًا بعد المرحلة 8 — isPeriodLocked لسه مش موجودة)
  if(typeof isPeriodLocked === 'function' && isPeriodLocked(date)){
    showToast('warning', '⚠️ الفترة المحاسبية مقفولة — لا يمكن إضافة قيود');
    return null;
  }

  const entryNumber = await _getNextEntryNumber();
  const entry = {
    entryNumber, date, description, sourceType, sourceId,
    lines, status:'posted', reversedBy:null, reversalOf:null
  };
  return DB.push('journal_entries', entry);
}

// ── عكس قيد بدل حذفه (الدالة تتكتب هنا، تُستخدم فعليًا في المرحلة 9) ──
async function reverseJournalEntry(entryId, reason){
  const original = (DB.get('journal_entries')||[]).find(e=>e.id===entryId);
  if(!original || original.status==='reversed'){
    showToast('warning', '⚠️ القيد غير موجود أو معكوس بالفعل');
    return null;
  }

  const reversedLines = original.lines.map(l=>({
    accountCode: l.accountCode,
    debit: l.credit,   // عكس القيد
    credit: l.debit,
    description: 'عكس: ' + (l.description||'')
  }));

  const reversal = await postJournalEntry({
    date: new Date().toISOString().split('T')[0],
    description: `عكس قيد ${original.entryNumber} — السبب: ${reason}`,
    sourceType: 'reversal',
    sourceId: original.id,
    lines: reversedLines
  });

  if(reversal){
    DB.upd('journal_entries', original.id, {status:'reversed', reversedBy: reversal.entryNumber});
  }
  return reversal;
}

// ── عرض دليل الحسابات في شاشة الإعدادات (تبويب البيانات) ──
function renderChartOfAccounts(){
  const tb = document.getElementById('coa-tbody');
  if(!tb) return;
  const accounts = [...(DB.get('chart_of_accounts')||[])].sort((a,b)=>a.code.localeCompare(b.code));
  const typeLabels = {asset:'أصول', liability:'التزامات', equity:'حقوق ملكية', revenue:'إيرادات', expense:'مصروفات'};
  const typeColors = {asset:'tg-teal', liability:'tg-rose', equity:'tg-purple', revenue:'tg-teal', expense:'tg-rose'};
  tb.innerHTML = accounts.map(a=>`<tr>
      <td style="font-weight:700;font-family:monospace">${a.code}</td>
      <td style="font-weight:600">${a.name}</td>
      <td><span class="tag ${typeColors[a.type]||''}">${typeLabels[a.type]||a.type}</span></td>
      <td style="font-size:12px;color:var(--text-muted)">${a.normalBalance==='debit'?'مدين':'دائن'}</td>
    </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">لا يوجد دليل حسابات بعد — اضغط "إنشاء دليل الحسابات"</td></tr>`;
}

// ── عرض دفتر اليومية (كل القيود المسجّلة) ──
function renderJournalEntries(){
  const tb = document.getElementById('je-tbody');
  if(!tb) return;
  const entries = [...(DB.get('journal_entries')||[])].sort((a,b)=>(b.entryNumber||'').localeCompare(a.entryNumber||''));
  tb.innerHTML = entries.map(e=>{
    const linesHtml = e.lines.map(l=>{
      const acc = getAccountByCode(l.accountCode);
      const name = acc ? acc.name : l.accountCode;
      return `${name}: ${l.debit?('مدين '+l.debit.toLocaleString()):('دائن '+l.credit.toLocaleString())}`;
    }).join(' | ');
    const statusTag = e.status==='reversed'
      ? `<span class="tag tg-rose">معكوس</span>`
      : `<span class="tag tg-teal">مرحّل</span>`;
    return `<tr>
      <td style="font-weight:700;font-family:monospace;font-size:12px">${e.entryNumber}</td>
      <td style="font-size:12px">${e.date}</td>
      <td style="font-size:12px">${e.description}</td>
      <td style="font-size:11px;color:var(--text-muted)">${linesHtml}</td>
      <td>${statusTag}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">لا توجد قيود بعد — اضغط "تشغيل اختبار القيود"</td></tr>`;
}

// ══════════════════════════════════════════
// ⚖️ TRIAL BALANCE — ميزان المراجعة
// المرحلة 4 من دليل تطوير الطبقة المحاسبية
// ⚠️ قراءة فقط من journal_entries — لا تلمس أي بيانات ولا تعدّل P&L/Balance Sheet
//    الحاليين (دول لسه بيقروا من cashlog زي ما هما لحد المرحلة 5)
// ══════════════════════════════════════════

// ── حساب ميزان المراجعة الكامل لغاية تاريخ معيّن (أو لكل التاريخ لو من غير تاريخ) ──
function calcTrialBalance(asOfDate){
  const entries = (DB.get('journal_entries')||[])
    .filter(e=>e.status==='posted' && (!asOfDate || e.date<=asOfDate));
  const accounts = DB.get('chart_of_accounts')||[];

  const balances = {}; // code -> {debit, credit}
  entries.forEach(e=>{
    (e.lines||[]).forEach(l=>{
      if(!balances[l.accountCode]) balances[l.accountCode]={debit:0,credit:0};
      balances[l.accountCode].debit  += (l.debit||0);
      balances[l.accountCode].credit += (l.credit||0);
    });
  });

  const rows = accounts.map(a=>{
    const b = balances[a.code] || {debit:0,credit:0};
    const net = a.normalBalance==='debit' ? (b.debit-b.credit) : (b.credit-b.debit);
    return {code:a.code, name:a.name, type:a.type, normalBalance:a.normalBalance, debit:b.debit, credit:b.credit, balance:net};
  }).filter(r=>r.debit || r.credit); // اخفِ الحسابات اللي مالهاش أي حركة خالص

  rows.sort((a,b)=>a.code.localeCompare(b.code));

  const totalDebit  = rows.reduce((s,r)=>s+r.debit,0);
  const totalCredit = rows.reduce((s,r)=>s+r.credit,0);

  return {rows, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit-totalCredit)<0.01, entriesCount: entries.length};
}

// ── عرض ميزان المراجعة في شاشة "الحسابات" (تبويب جديد) ──
function renderTrialBalance(){
  const tb = document.getElementById('tb-tbody');
  if(!tb) return;

  const dateEl = document.getElementById('tb-asof-date');
  const asOfDate = dateEl?.value || '';
  const result = calcTrialBalance(asOfDate || null);

  const typeLabels = {asset:'أصول', liability:'التزامات', equity:'حقوق ملكية', revenue:'إيرادات', expense:'مصروفات'};

  if(!result.rows.length){
    tb.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">لا توجد قيود مرحّلة بعد — راجع دفتر اليومية في الإعدادات</td></tr>`;
  } else {
    tb.innerHTML = result.rows.map(r=>`<tr>
        <td style="font-weight:700;font-family:monospace">${r.code}</td>
        <td style="font-weight:600">${r.name}<div style="font-size:10.5px;color:var(--text-muted)">${typeLabels[r.type]||r.type}</div></td>
        <td style="color:var(--emerald)">${r.debit ? r.debit.toLocaleString()+' ج' : '—'}</td>
        <td style="color:var(--rose)">${r.credit ? r.credit.toLocaleString()+' ج' : '—'}</td>
        <td style="font-weight:800">${r.balance.toLocaleString()} ج</td>
      </tr>`).join('');
  }

  const totalDebitEl  = document.getElementById('tb-total-debit');
  const totalCreditEl = document.getElementById('tb-total-credit');
  const statusEl      = document.getElementById('tb-balance-status');
  if(totalDebitEl)  totalDebitEl.textContent  = result.totalDebit.toLocaleString()+' ج';
  if(totalCreditEl) totalCreditEl.textContent = result.totalCredit.toLocaleString()+' ج';
  if(statusEl){
    statusEl.innerHTML = result.isBalanced
      ? `<span class="tag tg-teal">✅ الميزان متوازن</span>`
      : `<span class="tag tg-rose">❌ غير متوازن — فرق ${Math.abs(result.totalDebit-result.totalCredit).toLocaleString()} ج — راجع المطور فورًا</span>`;
  }
}

// ── إعادة حساب الميزان تلقائيًا كل ما توصل بيانات جديدة/محدّثة من المزامنة ──
// ⚠️ إصلاح: setTimeout(50ms) في stab() مش كفاية لو الاتصال بطيء (Firestore onSnapshot
// لسه بيكمّل تحميل journal_entries وقت ما يفتح المستخدم التبويب) — فبيحسب الميزان
// على جزء من القيود بس. الحل: أي تحديث فعلي على journal_entries أو chart_of_accounts
// (created/updated/deleted) يعيد رسم الميزان تاني تلقائيًا، بغض النظر عن التوقيت.
EventBus.on('db:changed', (e)=>{
  if(e && (e.collection==='journal_entries' || e.collection==='chart_of_accounts')){
    if(typeof renderTrialBalance==='function') renderTrialBalance();
  }
});

// ══════════════════════════════════════════
// 🧾 VOUCHERS — سندات القبض والصرف
// المرحلة 6 من دليل تطوير الطبقة المحاسبية
// ⚠️ إضافة صرفة — بتتولد تلقائيًا من نفس الـ hooks اللي بتعمل postJournalEntry
// في 14-accounting-hooks.js، لكل حركة فيها كاش فعلي داخل/خارج (مش كل قيد —
// مثلاً استلام مشتريات آجل مفيهوش كاش فمالوش سند، لكن سداد مورد له سند صرف).
// ══════════════════════════════════════════

let _voucherCounters = { receipt: null, payment: null };

async function _getNextVoucherNumber(type){ // type: 'receipt' | 'payment'
  const prefix = type === 'receipt' ? 'RV' : 'PV';
  if(_voucherCounters[type] === null){
    const all = (DB.get('vouchers')||[]).filter(v=>v.type===type);
    _voucherCounters[type] = all.length;
  }
  _voucherCounters[type]++;
  return prefix + '-' + String(_voucherCounters[type]).padStart(6,'0');
}

// ── إنشاء سند قبض/صرف — يُستدعى مباشرة بعد postJournalEntry الناجح ──
async function createVoucher({type, date, amount, linkedInvoiceId, linkedEntryId, paidTo_or_receivedFrom, method, notes}){
  if(!amount || amount <= 0) return null;
  const voucherNumber = await _getNextVoucherNumber(type);
  return DB.push('vouchers', {
    voucherNumber, type, date: date || new Date().toISOString().split('T')[0],
    amount, linkedInvoiceId: linkedInvoiceId || null, linkedEntryId: linkedEntryId || null,
    paidTo_or_receivedFrom: paidTo_or_receivedFrom || '', method: method || 'كاش',
    notes: notes || ''
  });
}

// ── عرض سندات القبض/الصرف في شاشة الإعدادات (تبويب جديد) ──
function renderVouchers(){
  const tb = document.getElementById('vch-tbody');
  if(!tb) return;
  const filterType = document.getElementById('vch-type-filter')?.value || '';
  let vouchers = [...(DB.get('vouchers')||[])];
  if(filterType) vouchers = vouchers.filter(v=>v.type===filterType);
  vouchers.sort((a,b)=>(b.voucherNumber||'').localeCompare(a.voucherNumber||''));

  tb.innerHTML = vouchers.map(v=>{
    const typeTag = v.type==='receipt'
      ? `<span class="tag tg-green">قبض</span>`
      : `<span class="tag" style="background:rgba(244,63,94,.09);border-color:rgba(244,63,94,.24);color:var(--rose);">صرف</span>`;
    return `<tr>
      <td style="font-weight:700;font-family:monospace;font-size:12px">${v.voucherNumber}</td>
      <td>${typeTag}</td>
      <td style="font-size:12px">${v.date}</td>
      <td style="font-size:13px;font-weight:600">${v.paidTo_or_receivedFrom||'—'}</td>
      <td style="font-weight:700;color:${v.type==='receipt'?'var(--emerald)':'var(--rose)'}">${(v.amount||0).toLocaleString()} ج</td>
      <td style="font-size:12px;color:var(--text-muted)">${v.method||''}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">لا توجد سندات بعد</td></tr>`;
}

EventBus.on('db:changed', (e)=>{
  if(e && e.collection==='vouchers' && typeof renderVouchers==='function') renderVouchers();
});


async function testJournalEntryEngine(){
  // 1) قيد صحيح ومتوازن — المفروض ينجح
  const goodEntry = await postJournalEntry({
    date: new Date().toISOString().split('T')[0],
    description: '🧪 قيد اختبار — تحصيل نقدي تجريبي',
    sourceType: 'manual',
    sourceId: null,
    lines: [
      {accountCode:'1110', debit:100, credit:0, description:'كاش تجريبي'},
      {accountCode:'4100', debit:0, credit:100, description:'إيراد تجريبي'}
    ]
  });

  if(goodEntry){
    showToast('success', `✅ القيد الصحيح نجح: ${goodEntry.entryNumber}`);
  } else {
    showToast('error', '❌ القيد الصحيح فشل — فيه مشكلة في الإعداد، راجع الـ Firestore rules');
    return;
  }

  // 2) قيد غير متوازن عمدًا — المفروض يترفض
  const badEntry = await postJournalEntry({
    date: new Date().toISOString().split('T')[0],
    description: '🧪 قيد اختبار غير متوازن (المفروض يترفض)',
    sourceType: 'manual',
    sourceId: null,
    lines: [
      {accountCode:'1110', debit:100, credit:0, description:'كاش'},
      {accountCode:'4100', debit:0, credit:50, description:'إيراد ناقص عمدًا'}
    ]
  });

  if(badEntry === null){
    showToast('info', '👍 تمام — النظام رفض القيد الغير متوازن زي ما هو متوقع');
  } else {
    showToast('error', '⚠️ خطأ خطير: النظام قبل قيد غير متوازن! راجع المطور فورًا');
  }

  renderJournalEntries();
}

