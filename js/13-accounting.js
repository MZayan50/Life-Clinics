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

// ── اختبار محرك القيود — يعمل قيد صحيح متوازن + يحاول قيد خاطئ غير متوازن للتأكد إنه بيترفض ──
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

