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

    // 🐛 FIX (اكتُشف أثناء اختبار المرحلة 9): عكس القيد كان بيسيب أي سند قبض/صرف
    // مرتبط بيه (createVoucher في المرحلة 6) "زي ما هو" — يفضل ظاهر في شاشة
    // السندات وكأنه سليم رغم إن العملية اتلغت فعليًا (مثلاً حذف مصروف اتصرف
    // له سند صرف قبل كده). بنبطّله (status:'voided') بدل ما نمسحه — نفس مبدأ
    // "عكس/إبطال مش حذف" المتبع في كل مكان تاني بالنظام.
    const linkedVoucher = (DB.get('vouchers')||[])
      .find(v => String(v.linkedEntryId)===String(original.id) && v.status!=='voided');
    if(linkedVoucher){
      DB.upd('vouchers', linkedVoucher.id, {status:'voided', voidReason:reason, voidedAt:_now()});
    }
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
// 🐛 FIX (اكتُشف أثناء اختبار المرحلة 9): كانت بتستبعد أي قيد status='reversed'
// من الحساب بالكامل. ده غلط محاسبيًا — القيد الأصلي المعكوس لسه واقعة مالية
// حقيقية حصلت فعلاً ولازم تتحسب، وقيد العكس (سطر مقابل بنفس القيمة معكوسة)
// هو اللي بيصفّر أثرها في الميزان. استبعاد الأصلي وسيبان بس قيد العكس كان بيدي
// أثر أحادي الجانب (مثلاً دائن 3000 من غير مدين مقابل) بدل ما يتصفر تمامًا.
// status هنا للعرض فقط (تاج "معكوس" في دفتر اليومية) — مش معيار فلترة للميزان.
function calcTrialBalance(asOfDate){
  const entries = (DB.get('journal_entries')||[])
    .filter(e=>(!asOfDate || e.date<=asOfDate));
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
    notes: notes || '', status: 'active'
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
    const isVoided = v.status==='voided';
    const typeTag = v.type==='receipt'
      ? `<span class="tag tg-green">قبض</span>`
      : `<span class="tag" style="background:rgba(244,63,94,.09);border-color:rgba(244,63,94,.24);color:var(--rose);">صرف</span>`;
    const voidedTag = isVoided ? `<span class="tag tg-rose" style="margin-inline-start:4px;" title="${v.voidReason||''}">ملغى</span>` : '';
    const rowStyle = isVoided ? 'style="opacity:.55;"' : '';
    const amountStyle = isVoided
      ? 'text-decoration:line-through;color:var(--text-muted);font-weight:700'
      : `font-weight:700;color:${v.type==='receipt'?'var(--emerald)':'var(--rose)'}`;
    return `<tr ${rowStyle}>
      <td style="font-weight:700;font-family:monospace;font-size:12px">${v.voucherNumber}</td>
      <td>${typeTag}${voidedTag}</td>
      <td style="font-size:12px">${v.date}</td>
      <td style="font-size:13px;font-weight:600">${v.paidTo_or_receivedFrom||'—'}</td>
      <td style="${amountStyle}">${(v.amount||0).toLocaleString()} ج</td>
      <td style="font-size:12px;color:var(--text-muted)">${v.method||''}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">لا توجد سندات بعد</td></tr>`;
}

// ── دالة صيانة لمرة واحدة (تُشغَّل يدويًا من الـ Console) ──
// السندات اللي اتعملت *قبل* إضافة إبطال السند التلقائي في reverseJournalEntry()
// فوق فضلت 'active' رغم إن قيدها المرتبط بقى 'reversed' من زمان. الدالة دي
// بتراجع كل السندات وتبطّل أي واحد فيها مرتبط بقيد معكوس. آمنة تتكرر (idempotent).
async function repairVoidedVouchers(){
  const reversedIds = new Set(
    (DB.get('journal_entries')||[]).filter(e=>e.status==='reversed').map(e=>String(e.id))
  );
  let fixed = 0;
  (DB.get('vouchers')||[]).forEach(v=>{
    if(v.status==='voided') return;
    if(v.linkedEntryId && reversedIds.has(String(v.linkedEntryId))){
      DB.upd('vouchers', v.id, {status:'voided', voidReason:'إصلاح تلقائي — القيد المرتبط كان معكوس بالفعل', voidedAt:_now()});
      fixed++;
    }
  });
  showToast(fixed ? 'success' : 'info',
    fixed ? `✅ تم إبطال ${fixed} سند قديم مرتبط بقيود معكوسة` : 'ℹ️ مفيش سندات محتاجة إصلاح');
  if(typeof renderVouchers==='function') renderVouchers();
  return fixed;
}

EventBus.on('db:changed', (e)=>{
  if(e && e.collection==='vouchers' && typeof renderVouchers==='function') renderVouchers();
});


// ══════════════════════════════════════════
// 🕵️ AUDIT TRAIL VIEWER — المرحلة 7 من دليل تطوير الطبقة المحاسبية
// منطق التسجيل نفسه في DB.upd (00-core.js) — هنا العرض فقط
// ══════════════════════════════════════════

const AUDIT_COLLECTION_LABELS = {
  patients:'العملاء', invoices:'الفواتير', expenses:'المصروفات', appointments:'المواعيد',
  inventory:'المخزون', purchases:'المشتريات', suppliers:'الموردين', packages:'الباقات',
  installments:'الأقساط', journal_entries:'القيود المحاسبية', vouchers:'السندات',
  chart_of_accounts:'دليل الحسابات', accounting_periods:'الفترات المحاسبية',
  users:'المستخدمين', settings:'الإعدادات', doctors:'الأطباء'
};

function _auditFieldValue(v){
  if(v===null || v===undefined || v==='') return '—';
  if(typeof v==='object') return JSON.stringify(v);
  return String(v);
}

// ── عرض آخر التعديلات في شاشة الإعدادات (تبويب البيانات) ──
function renderAuditLog(){
  const tb = document.getElementById('audit-tbody');
  if(!tb) return;

  const filterCol = document.getElementById('audit-collection-filter')?.value || '';
  let logs = [...(DB.get('audit_log')||[])];
  if(filterCol) logs = logs.filter(l=>l.collection===filterCol);
  logs.sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||''));
  logs = logs.slice(0, 100); // آخر 100 تعديل فقط — منعًا لثقل الشاشة

  tb.innerHTML = logs.map(l=>{
    const colLabel = AUDIT_COLLECTION_LABELS[l.collection] || l.collection;
    const changesHtml = (l.changes||[]).map(c=>
      `<div><b>${c.field}</b>: ${_auditFieldValue(c.oldValue)} ← ${_auditFieldValue(c.newValue)}</div>`
    ).join('');
    const dt = l.timestamp ? new Date(l.timestamp) : null;
    const dtLabel = dt ? dt.toLocaleString('ar-EG', {dateStyle:'short', timeStyle:'short'}) : '—';
    return `<tr>
      <td style="font-size:12px;white-space:nowrap">${dtLabel}</td>
      <td><span class="tag tg-purple">${colLabel}</span></td>
      <td style="font-size:11px;font-family:monospace;color:var(--text-muted)">${(l.recordId||'').slice(0,8)}</td>
      <td style="font-size:11px;color:var(--text-muted);max-width:320px">${changesHtml||'—'}</td>
      <td style="font-size:12px;font-weight:600">${l.user||'—'}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">لا توجد تعديلات مسجّلة بعد</td></tr>`;
}

function _auditCollectionOptions(){
  const sel = document.getElementById('audit-collection-filter');
  if(!sel || sel.options.length > 1) return; // اتعمل قبل كده
  const cols = Object.keys(AUDIT_COLLECTION_LABELS);
  sel.innerHTML = '<option value="">كل الجداول</option>' +
    cols.map(c=>`<option value="${c}">${AUDIT_COLLECTION_LABELS[c]}</option>`).join('');
}

EventBus.on('db:changed', (e)=>{
  if(e && e.collection==='audit_log' && typeof renderAuditLog==='function') renderAuditLog();
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

// ══════════════════════════════════════════
// 🧪 اختبار المرحلة 9 — Soft Delete + عكس القيد المحاسبي
// ينشئ مصروف تجريبي → يتأكد إن قيده اتسجل → يحذفه (Soft Delete) →
// يتأكد إن القيد الأصلي بقى 'reversed' وإن فيه قيد عكسي جديد اتسجل →
// يتأكد إن المصروف مختفي من DB.getActive('expenses') لكن موجود فعليًا
// (isDeleted:true) في DB.get('expenses') الخام.
// ══════════════════════════════════════════
async function testExpenseReversalCycle(){
  const testAmount = 77;
  const testExp = DB.push('expenses', {
    name: '🧪 مصروف اختبار — المرحلة 9',
    type: 'مصروفات متنوعة',
    amount: testAmount,
    branch: '',
    date: new Date().toISOString().split('T')[0],
    notes: 'اختبار تلقائي — يُترك isDeleted:true بعد الاختبار (مخفي من كل الشاشات)'
  });

  // استنى الـ hook غير المتزامن (EventBus.on('expenses:created', async...)) يخلّص
  await new Promise(r=>setTimeout(r,150));

  const originalEntry = (DB.get('journal_entries')||[])
    .find(je=>je.sourceType==='expense' && String(je.sourceId)===String(testExp.id));

  if(!originalEntry){
    showToast('error','❌ فشل: لم يتم إنشاء قيد للمصروف التجريبي — راجع hook رقم 2 في 14-accounting-hooks.js');
    return;
  }
  if(originalEntry.status!=='posted'){
    showToast('error','❌ فشل: القيد الأصلي مش posted — راجع المطور');
    return;
  }

  // ── الحذف الفعلي (Soft Delete) ──
  DB.softDel('expenses', testExp.id);
  await new Promise(r=>setTimeout(r,150));

  const reloadedOriginal = (DB.get('journal_entries')||[]).find(je=>je.id===originalEntry.id);
  const reversalEntry = (DB.get('journal_entries')||[])
    .find(je=>je.sourceType==='reversal' && String(je.sourceId)===String(originalEntry.id));

  const stillInActive = DB.getActive('expenses').some(e=>e.id===testExp.id);
  const rawRecord = (DB.get('expenses')||[]).find(e=>e.id===testExp.id);

  const checks = [
    {label:'القيد الأصلي اتعكس (status=reversed)', ok: reloadedOriginal?.status==='reversed'},
    {label:'اتسجل قيد عكسي جديد ومتوازن',           ok: !!reversalEntry},
    {label:'المصروف مختفي من DB.getActive',          ok: !stillInActive},
    {label:'السجل الخام لسه موجود (isDeleted:true)',  ok: rawRecord?.isDeleted===true},
  ];

  const allPass = checks.every(c=>c.ok);
  console.log('[اختبار المرحلة 9]', checks, {testExp, originalEntry, reloadedOriginal, reversalEntry});

  if(allPass){
    showToast('success','✅ اختبار المرحلة 9 نجح بالكامل', checks.map(c=>'✓ '+c.label).join(' | '));
  } else {
    showToast('error','❌ اختبار المرحلة 9 فشل جزئيًا — افتح الـ Console للتفاصيل',
      checks.filter(c=>!c.ok).map(c=>'✗ '+c.label).join(' | '));
  }

  renderJournalEntries();
}


// ══════════════════════════════════════════
// 📤 EXPORT — ميزان المراجعة / الأرباح والخسائر / الميزانية العمومية / التدفق النقدي
// المرحلة 11 من دليل تطوير الطبقة المحاسبية
// ⚠️ نفس قالب exportReportPDF (10-reports.js) للـ PDF، ونفس أسلوب exportInvs
// (04-invoices.js) للـ CSV — بس مطبّقين على تبويبات شاشة "الحسابات"
// (screen-accounts) بدل شاشة "التقارير". قراءة فقط، مفيش أي تعديل على
// renderAccounts()/calcTrialBalance() الموجودين.
// ══════════════════════════════════════════

// ── تجميع بيانات التقرير المطلوب تصديره (view: 'tb' | 'pl' | 'bs' | 'cf') ──
function _buildAccountingReportData(view){
  if(view==='tb'){
    const asOfDate = document.getElementById('tb-asof-date')?.value || '';
    const tb = calcTrialBalance(asOfDate || null);
    const typeLabels = {asset:'أصول', liability:'التزامات', equity:'حقوق ملكية', revenue:'إيرادات', expense:'مصروفات'};
    return {
      title: 'ميزان المراجعة' + (asOfDate ? ` — حتى ${asOfDate}` : ' — كل التاريخ'),
      headers: ['الكود','اسم الحساب','النوع','مدين','دائن','الرصيد'],
      rows: tb.rows.map(r=>[r.code, r.name, typeLabels[r.type]||r.type, r.debit, r.credit, r.balance]),
      totalsRow: ['','','الإجمالي', tb.totalDebit, tb.totalCredit, tb.isBalanced?'✅ متوازن':'❌ غير متوازن']
    };
  }
  if(view==='pl'){
    const tb = calcTrialBalance(null);
    const revRows = tb.rows.filter(r=>r.type==='revenue');
    const expRows = tb.rows.filter(r=>r.type==='expense');
    let totalRevenue, totalExpense, rows;
    if(tb && tb.rows.length){
      totalRevenue = revRows.reduce((s,r)=>s+r.balance,0);
      totalExpense = expRows.reduce((s,r)=>s+r.balance,0);
      rows = [
        ...revRows.map(r=>['إيراد', r.name, r.balance]),
        ...expRows.map(r=>['مصروف', r.name, r.balance])
      ];
    } else {
      // ✅ نفس الـ Fallback في renderAccounts() — قبل وجود قيود مرحّلة كفاية
      const cashlog = DB.get('cashlog')||[];
      totalRevenue = cashlog.filter(c=>c.type==='وارد').reduce((s,c)=>s+(c.amount||0),0);
      totalExpense = cashlog.filter(c=>c.type==='صادر').reduce((s,c)=>s+(c.amount||0),0);
      rows = [
        ['إيراد', 'إجمالي الإيراد (من سجل الخزينة)', totalRevenue],
        ['مصروف', 'إجمالي المصروف (من سجل الخزينة)', totalExpense]
      ];
    }
    return {
      title: 'قائمة الأرباح والخسائر',
      headers: ['النوع','الحساب','القيمة'],
      rows,
      totalsRow: ['', 'صافي الربح / الخسارة', totalRevenue-totalExpense]
    };
  }
  if(view==='bs'){
    const tb = calcTrialBalance(null);
    const balOf = code => tb.rows.find(r=>r.code===code)?.balance||0;
    // ✅ نفس منطق الـ Fallback الموجود في renderAccounts() (06-finance.js):
    // لو مفيش قيود محاسبية كفاية بعد (قبل تشغيل الترحيل التاريخي)، الاعتماد
    // على calcTrialBalance بس كان بيطلّع كل الأرقام صفر رغم إن الشاشة الحية
    // بتعرض قيم حقيقية من مصادر تانية. من غير الـ fallback ده، التصدير كان
    // بيطلع فاضي فعليًا حتى لو الشاشة نفسها ظاهرة فيها أرقام.
    let cash, receivables, inventory, suppliers;
    if(tb && tb.rows.length){
      cash        = balOf('1110') + balOf('1120');
      receivables = balOf('1130');
      inventory   = balOf('1140');
      suppliers   = balOf('2100');
    } else {
      inventory = typeof calcInventoryCostValue==='function' ? calcInventoryCostValue()
        : (DB.get('inventory')||[]).reduce((s,i)=>s+(i.qty*(i.costPerConsumeUnit||i.costPrice||i.lastPurchasePrice||0)),0);
      receivables = (DB.get('patients')||[]).reduce((s,p)=>s+Math.max(0,p.balance||0),0);
      suppliers = typeof calcAllSuppliersOwed==='function' ? calcAllSuppliersOwed()
        : (DB.get('suppliers')||[]).reduce((s,x)=>s+(x.owed||0),0);
      const cashlog = DB.get('cashlog')||[];
      const rev = cashlog.filter(c=>c.type==='وارد').reduce((s,c)=>s+(c.amount||0),0);
      const exp = cashlog.filter(c=>c.type==='صادر').reduce((s,c)=>s+(c.amount||0),0);
      cash = Math.max(0, rev-exp);
    }
    const equity = cash + inventory + receivables - suppliers;
    return {
      title: 'الميزانية العمومية',
      headers: ['البند','النوع','القيمة'],
      rows: [
        ['النقدية في الخزينة','أصول', cash],
        ['قيمة المخزون','أصول', inventory],
        ['ذمم مدينة (أقساط)','أصول', receivables],
        ['مستحقات موردين','التزامات', suppliers],
        ['صافي حقوق الملكية (= الأصول - مستحقات الموردين)','حقوق ملكية', equity]
      ],
      totalsRow: ['إجمالي الأصول','', cash+inventory+receivables]
    };
  }
  if(view==='cf'){
    const cashlog = DB.get('cashlog')||[];
    const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const year = new Date().getFullYear();
    let cumulative = 0;
    const rows = MONTHS.map((m,i)=>{
      const mStr = `${year}-${String(i+1).padStart(2,'0')}`;
      const inflow  = cashlog.filter(c=>c.type==='وارد'&&(c.date||'').startsWith(mStr)).reduce((s,c)=>s+(c.amount||0),0);
      const outflow = cashlog.filter(c=>c.type==='صادر'&&(c.date||'').startsWith(mStr)).reduce((s,c)=>s+(c.amount||0),0);
      const net = inflow-outflow; cumulative += net;
      return [m, inflow, outflow, net, cumulative];
    });
    return {
      title: 'التدفق النقدي الشهري — ' + year,
      headers: ['الشهر','الوارد','الصادر','الصافي','الرصيد التراكمي'],
      rows,
      totalsRow: null
    };
  }
  return null;
}

// ── تصدير CSV — نفس أسلوب exportInvs (04-invoices.js) ──
function exportAccountingCSV(view){
  const data = _buildAccountingReportData(view);
  if(!data){ showToast('error','❌ نوع تقرير غير معروف'); return; }
  const allRows = [data.headers, ...data.rows];
  if(data.totalsRow) allRows.push(data.totalsRow);
  const csv = allRows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.title.replace(/[^ء-يa-zA-Z0-9]+/g,'-')}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('success', '📊 تم تصدير ' + data.title);
}

// ── تصدير PDF — نفس قالب exportReportPDF (10-reports.js: نافذة جديدة + html2pdf) ──
function exportAccountingPDF(view){
  const data = _buildAccountingReportData(view);
  if(!data){ showToast('error','❌ نوع تقرير غير معروف'); return; }

  const clinicName  = DB.obj('settings').clinicName || 'عيادات الحياة للتجميل';
  const clinicPhone = DB.obj('settings').phone || '';
  const now = new Date().toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'});

  const fmt = v => typeof v==='number' ? v.toLocaleString()+' ج' : (v??'—');
  const tableRows = data.rows.map(r=>`<tr>${r.map((c,i)=>`<td style="padding:7px;border-bottom:1px solid #f0f0f0;${i===0?'font-weight:700;':''}${typeof c==='number'?'text-align:left;font-family:monospace;color:#047857;':''}">${fmt(c)}</td>`).join('')}</tr>`).join('');
  const totalsHtml = data.totalsRow
    ? `<tr style="font-weight:800;background:#f8f4ef;">${data.totalsRow.map(c=>`<td style="padding:7px;">${fmt(c)}</td>`).join('')}</tr>`
    : '';

  const bodyHtml = `<table style="width:100%;border-collapse:collapse;font-size:12.5px;">
    <thead><tr style="background:#f8f4ef;">${data.headers.map(h=>`<th style="padding:7px;text-align:right;border-bottom:2px solid #C4A882;">${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}${totalsHtml}</tbody>
  </table>`;

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${data.title}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Tajawal',sans-serif;background:#fff;color:#1a1a1a;padding:28px;font-size:13.5px;}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #C4A882;padding-bottom:18px;margin-bottom:20px;}
.logo{font-size:20px;font-weight:900;color:#C4A882;}.logo-sub{font-size:11px;color:#666;margin-top:3px;}
.rpt-meta{text-align:left;font-size:12px;color:#666;}.rpt-meta strong{font-size:16px;color:#1a1a1a;display:block;}
.footer{text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:14px;margin-top:20px;}
@media print{body{padding:14px;}}</style></head><body>
<div class="header"><div style="display:flex;align-items:center;gap:10px;"><div>${clinicLogoHTML(38)}</div><div><div class="logo">${clinicName}</div><div class="logo-sub">📞 ${clinicPhone}</div></div></div>
<div class="rpt-meta"><span>تقرير محاسبي رسمي</span><strong>${data.title}</strong><div style="margin-top:3px">📅 ${now}</div></div></div>
${bodyHtml}
<div class="footer">أُنشئ بواسطة نظام عيادات الحياة للتجميل 💎 · ${now}</div>
</body></html>`;

  const fileName = `${data.title.replace(/[^ء-يa-zA-Z0-9]+/g,'-')}-${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.pdf`;
  const toolbar = `<div id="rpt-toolbar" style="position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:3px solid #C4A882;padding:12px 20px;display:flex;gap:10px;justify-content:center;align-items:center;z-index:9999;font-family:'Tajawal',sans-serif;">
    <button id="rpt-pdf-btn" onclick="downloadRptPDF()" style="padding:9px 26px;background:#1a6dcc;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Tajawal',sans-serif;">📄 تحميل PDF</button>
    <button onclick="window.print()" style="padding:9px 22px;background:#C4A882;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Tajawal',sans-serif;">🖨 طباعة</button>
    <button onclick="window.close()" style="padding:9px 22px;background:#eee;color:#333;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Tajawal',sans-serif;">✕ إغلاق</button>
  </div>
  <div style="height:70px"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
  <script>
  function downloadRptPDF(){
    var btn=document.getElementById('rpt-pdf-btn');
    btn.textContent='⏳ جارٍ التحميل...'; btn.disabled=true;
    var tb=document.getElementById('rpt-toolbar');
    tb.style.display='none';
    html2pdf().set({
      margin:[8,8,8,8],
      filename:'${fileName}',
      image:{type:'jpeg',quality:0.97},
      html2canvas:{scale:2,useCORS:true,letterRendering:true},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    }).from(document.body).save().then(function(){
      tb.style.display='flex';
      btn.textContent='📄 تحميل PDF'; btn.disabled=false;
    });
  }
  <\/script>`;

  const fullHtml = html.replace('</body>', toolbar + '</body>');

  const w = window.open('','_blank','width=860,height=750,scrollbars=yes');
  if(!w){ showToast('error','❌ السماح بفتح النوافذ المنبثقة مطلوب'); return; }
  w.document.write(fullHtml);
  w.document.close();
  showToast('success', '📄 جاهز للتحميل أو الطباعة');
}

// ══════════════════════════════════════════
// 🩺 فحوصات سلامة البيانات — المرحلة 13 من دليل تطوير الطبقة المحاسبية
// ══════════════════════════════════════════
// كل فحص بيرجع { severity: 'error'|'warning', category, message, recordId? }
// error = خلل محاسبي/مالي فعلي (رقم غلط). warning = يستاهل مراجعة لكن مش بالضرورة خطأ.

function validateSystemIntegrity(){
  const issues = [];

  // 1. مخزون بكمية سالبة — يعني حصل بيع/استهلاك أكتر مما هو متاح فعليًا
  (DB.get('inventory')||[]).forEach(i=>{
    if((i.qty||0) < 0){
      issues.push({severity:'error', category:'المخزون', message:`مخزون سالب: "${i.name}" (${i.qty})`, recordId:i.id});
    }
  });

  // 2. قيود محاسبية غير متوازنة (مدين ≠ دائن) — مايفترضش يحصل لأن postJournalEntry بيرفضها،
  // لكن الفحص هنا شبكة أمان ضد أي بيانات دخلت بطريقة تانية (استيراد يدوي مثلاً)
  (DB.get('journal_entries')||[]).forEach(e=>{
    const d = (e.lines||[]).reduce((s,l)=>s+(l.debit||0),0);
    const c = (e.lines||[]).reduce((s,l)=>s+(l.credit||0),0);
    if(Math.abs(d-c) > 0.01){
      issues.push({severity:'error', category:'القيود المحاسبية', message:`قيد غير متوازن: ${e.entryNumber} (مدين ${d.toFixed(2)} / دائن ${c.toFixed(2)})`, recordId:e.id});
    }
  });

  // 3. ميزان المراجعة الإجمالي — لازم إجمالي المدين = إجمالي الدائن على مستوى النظام كله
  if(typeof calcTrialBalance === 'function'){
    const tb = calcTrialBalance(null);
    if(!tb.isBalanced){
      issues.push({severity:'error', category:'ميزان المراجعة', message:`الميزان غير متوازن إجماليًا: مدين ${tb.totalDebit.toLocaleString()} ج / دائن ${tb.totalCredit.toLocaleString()} ج`});
    }
  }

  // 4. مدفوعات أكبر من قيمة الفاتورة
  (DB.get('invoices')||[]).forEach(i=>{
    if((i.paid||0) > (i.total||0) + 0.01){
      issues.push({severity:'error', category:'الفواتير', message:`دفعة أكبر من الفاتورة: #${i.id} (مدفوع ${i.paid} من إجمالي ${i.total})`, recordId:i.id});
    }
  });

  // 5. فواتير بإجمالي صفر أو سالب — غالبًا بيانات اختبار أو خطأ إدخال (كانت سبب فروق سابقة)
  (DB.get('invoices')||[]).forEach(i=>{
    if(!(i.total > 0)){
      issues.push({severity:'warning', category:'الفواتير', message:`فاتورة بإجمالي صفر/غير صحيح: #${i.id} — ${i.patient||'—'}`, recordId:i.id});
    }
  });

  // 6. خطط أقساط مكررة على نفس الفاتورة (fromInvId) — كانت سبب تضاعف "المتبقي" في ملف العميل
  const instByInv = {};
  (DB.get('installments')||[]).forEach(p=>{
    if(!p.fromInvId) return;
    (instByInv[p.fromInvId] = instByInv[p.fromInvId] || []).push(p);
  });
  Object.entries(instByInv).forEach(([invId, plans])=>{
    if(plans.length > 1){
      issues.push({severity:'error', category:'الأقساط', message:`${plans.length} خطط أقساط مكررة على نفس الفاتورة #${invId}`, recordId:invId});
    }
  });

  // 7. قيود محاسبية "يتيمة" — مصدرها (فاتورة/مصروف) اتحذف حذفًا فعليًا (مش Soft Delete) فمابقاش موجود
  const liveInvoiceIds = new Set((DB.get('invoices')||[]).map(i=>String(i.id)));
  const liveExpenseIds = new Set((DB.get('expenses')||[]).map(e=>String(e.id))); // شاملة الـ soft-deleted لو DB.get بيرجعها
  (DB.get('journal_entries')||[]).forEach(e=>{
    if(e.status==='reversed') return;
    if(e.sourceType==='invoice' && e.sourceId && !liveInvoiceIds.has(String(e.sourceId))){
      issues.push({severity:'warning', category:'القيود المحاسبية', message:`قيد مرتبط بفاتورة محذوفة نهائيًا: ${e.entryNumber}`, recordId:e.id});
    }
    if(e.sourceType==='expense' && e.sourceId && !liveExpenseIds.has(String(e.sourceId))){
      issues.push({severity:'warning', category:'القيود المحاسبية', message:`قيد مرتبط بمصروف محذوف نهائيًا: ${e.entryNumber}`, recordId:e.id});
    }
  });

  // 8. سندات لسه شغالة (غير مبطلة) رغم إن القيد المرتبط بيها اتعكس بالفعل
  const reversedEntryIds = new Set((DB.get('journal_entries')||[]).filter(e=>e.status==='reversed').map(e=>String(e.id)));
  (DB.get('vouchers')||[]).forEach(v=>{
    if(v.status!=='voided' && v.linkedEntryId && reversedEntryIds.has(String(v.linkedEntryId))){
      issues.push({severity:'warning', category:'السندات', message:`سند ${v.voucherNumber||v.id} مرتبط بقيد معكوس ولسه مش مبطّل — استخدم "إصلاح السندات القديمة"`, recordId:v.id});
    }
  });

  return issues;
}

// ── عرض نتيجة الفحص في شاشة الإعدادات (تبويب البيانات) ──
function runSystemIntegrityCheckUI(){
  const box = document.getElementById('integrity-check-results');
  if(!box) return;
  const issues = validateSystemIntegrity();
  const errors = issues.filter(i=>i.severity==='error');
  const warnings = issues.filter(i=>i.severity==='warning');

  if(!issues.length){
    box.innerHTML = `<div style="padding:14px;background:rgba(52,211,153,.1);border-radius:var(--radius-sm);color:var(--emerald);font-weight:700;">✅ مفيش أي مشاكل — البيانات سليمة 100%</div>`;
    showToast('success', '✅ فحص السلامة تمّ — لا توجد مشاكل');
    return;
  }

  const row = it => `<div style="padding:9px 12px;border-radius:var(--radius-sm);margin-bottom:6px;background:${it.severity==='error'?'rgba(244,63,94,.1)':'rgba(212,175,55,.1)'};border-inline-start:3px solid ${it.severity==='error'?'var(--rose)':'var(--gold)'};">
    <span style="font-size:11px;font-weight:700;color:${it.severity==='error'?'var(--rose)':'var(--gold)'};">${it.severity==='error'?'❌ خطأ':'⚠️ تنبيه'} — ${it.category}</span>
    <div style="font-size:12.5px;margin-top:2px;">${it.message}</div>
  </div>`;

  box.innerHTML = `<div style="font-size:12.5px;font-weight:700;margin-bottom:10px;">
      ${errors.length ? `<span style="color:var(--rose)">${errors.length} خطأ</span>` : ''}
      ${errors.length && warnings.length ? ' · ' : ''}
      ${warnings.length ? `<span style="color:var(--gold)">${warnings.length} تنبيه</span>` : ''}
    </div>` + issues.map(row).join('');
  showToast(errors.length ? 'error' : 'warning',
    errors.length ? `❌ فيه ${errors.length} خطأ محاسبي محتاج مراجعة` : `⚠️ فيه ${warnings.length} تنبيه يستاهل مراجعة`);
}

