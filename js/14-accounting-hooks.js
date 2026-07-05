// ══════════════════════════════════════════
// 🔗 AUTO-POSTING HOOKS — الربط التلقائي بين النظام الحالي ومحرك القيود
// المرحلة 3 من دليل تطوير الطبقة المحاسبية + المرحلة 6 (سندات القبض/الصرف)
// يتحمّل بعد 13-accounting.js
// ⚠️ إضافة صرفة — بيستمع لأحداث EventBus الموجودة، ولا يعدّل أي دالة قائمة
// ✅ المرحلة 6: كل hook فيه كاش فعلي داخل/خارج بيولّد سند (createVoucher) مباشرة
// بعد نجاح postJournalEntry، بنفس رقم القيد (linkedEntryId). الحركات اللي مالهاش
// كاش فعلي (زي استلام مشتريات آجل، أو عكس قيد فاتورة محذوفة) مالهاش سند عمدًا.
// ══════════════════════════════════════════
//
// 📋 نطاق هذه المرحلة (بعد مراجعة الكود الفعلي، مش الافتراض النظري بس):
//   ✅ إيراد الفواتير (فواتير عادية + فواتير باقات + فواتير من الشاشة الطبية —
//      كلها بتعدّي على invoices:created فبتتغطى تلقائيًا مهما كان مصدرها)
//   ✅ تحصيل دفعات الفواتير (سواء من شاشة الفواتير أو التعديل المباشر)
//   ✅ تحصيل دفعات الباقات المباشرة (من ملف العميل أو من شاشة تعديل الباقة)
//   ✅ باقات دخلت الأقساط من زرار "مزامنة الباقات" بدون فاتورة (hook 8ب —
//      بيسجل القيد المفقود Debit 1130/Credit 4300 تلقائيًا وقت إنشاء القسط)
//   ✅ المصروفات
//   ✅ استلام المشتريات من المورد (وقت الاستلام الفعلي مش وقت إنشاء الطلب)
//   ✅ سداد المورد
//
// ⚠️ خارج النطاق دلوقتي (يحتاج مرحلة مخصصة لاحقًا لأنه أعقد مما افترضه الدليل الأصلي):
//   ❌ أي حركة كاش من شاشة الجلسات (07-clinical.js) غير مرتبطة بفاتورة
//   ❌ السلف والرواتب (09-hr.js)
// هذه الحالات بتتسجل في cashlog زي العادة (مفيش أي تغيير في سلوك النظام الحالي)
// لكن لسه مالهاش قيد محاسبي مقابل — هنغطيها في مرحلة لاحقة بعد ما نتأكد
// من دقة القيود الأساسية أولاً (زي ما بينص مبدأ التنفيذ في الدليل).
// ══════════════════════════════════════════

// ══════════════════════════════════════════
// 🧾 ضريبة القيمة المضافة (VAT) — المرحلة 10 من دليل تطوير الطبقة المحاسبية
// ══════════════════════════════════════════
// ✅ إضافة صرفة تمامًا: مفيش أي تعديل على شاشات إدخال السعر أو الإجمالي المعروض
// للعميل. الأسعار الحالية بتتعامل كأسعار "شاملة الضريبة" (Tax-Inclusive) —
// زي المعتاد في التجزئة بمصر — فبدل ما إيراد الفاتورة الكامل يترحّل بالكامل
// على حساب الإيراد (4100/4200/4300)، بنفصل نسبة الضريبة منه رياضيًا ونرحّلها
// على حساب "ضرائب مستحقة" (2200 — موجود بالفعل في دليل الحسابات الافتراضي)،
// والباقي (صافي الإيراد) يترحّل عادي. مجموع السطرين = نفس المبلغ الأصلي،
// فتوازن القيد (مدين = دائن) يفضل سليم زي ما هو من غير أي تغيير في postJournalEntry.
// التفعيل بالكامل اختياري: نسبة الضريبة = صفر (الافتراضي) يعني تعطيل تام،
// ونفس السلوك القديم يفضل شغّال حرفيًا زي ما كان.
function _vatRate(){
  return parseFloat((DB.get('settings')||{}).vatRate) || 0;
}

// بيرجّع سطر واحد عادي لو الضريبة معطّلة، أو سطرين (صافي الإيراد + الضريبة) لو مفعّلة
function _revenueLinesWithVat(accountCode, grossAmount, description){
  const rate = _vatRate();
  if(rate <= 0 || !(grossAmount > 0)){
    return [{accountCode, debit:0, credit:grossAmount, description}];
  }
  const vatAmount = Math.round(grossAmount * rate / (100 + rate) * 100) / 100;
  const netAmount  = Math.round((grossAmount - vatAmount) * 100) / 100;
  return [
    {accountCode, debit:0, credit:netAmount, description},
    {accountCode:'2200', debit:0, credit:vatAmount, description:`ضريبة قيمة مضافة ${rate}% — ${description}`}
  ];
}

// ── تحديد حساب الإيراد المناسب حسب نوع الفاتورة ──
function _revenueAccountFor(invoice){
  if(invoice.pkgId) return '4300';                              // فاتورة باقة
  // ✅ FIX: كان بيدوّر على كلمة "منتج" حرفيًا في اسم الخدمة بس — أي فاتورة
  // لمنتج فعلي من المخزون (زي "لوشن للتحكم في تساقط الشعر") كان بيصنّفها
  // غلط كـ"إيراد خدمات" (4100) بدل "إيراد بيع منتجات" (4200) لأنها مالهاش
  // كلمة "منتج" في الاسم. دلوقتي بنتحقق من اسم الخدمة/الصنف مقابل أسماء
  // المنتجات الفعلية المسجّلة في المخزون.
  const svcName = (invoice.service||'').trim();
  if(svcName.includes('منتج')) return '4200';
  const inv = DB.get('inventory')||[];
  if(inv.some(p => p.name && svcName && p.name.trim() === svcName)) return '4200';
  return '4100';                                                 // خدمة عادية
}

// ── 1. فاتورة جديدة → قيد إيراد (كاش/آجل مقابل إيراد) ──
EventBus.on('invoices:created', async (inv)=>{
  // ── 1أ. COGS (تكلفة المواد المستهلكة) — بطلب المستخدم: صافي الربح لازم
  // يعكس تكلفة المواد الفعلية، مش الإيراد الإجمالي بس. مستقل تمامًا عن قيد
  // الإيراد تحت (بيشتغل حتى لو total=0 لفاتورة مغطاة بباقة، لأن المواد
  // بتتستهلك من المخزون فعليًا في الحالتين). inv.materialCost بيتحسب وقت
  // خصم المخزون في finalizeConsultation (07-clinical.js) قبل إنشاء الفاتورة.
  if((inv.materialCost||0) > 0){
    await postJournalEntry({
      date: inv.date || new Date().toISOString().split('T')[0],
      description: `تكلفة مواد — فاتورة #${inv.id}`,
      sourceType: 'invoice',
      sourceId: inv.id,
      lines: [
        {accountCode:'5100', debit:inv.materialCost, credit:0, description:'تكلفة المواد المستهلكة'},
        {accountCode:'1140', debit:0, credit:inv.materialCost, description:'خصم من المخزون'}
      ]
    });
  }

  const revAccount = _revenueAccountFor(inv);
  const lines = [];

  if((inv.paid||0) > 0){
    const cashAccount = (inv.method==='فيزا') ? '1120' : '1110';
    lines.push({accountCode:cashAccount, debit:inv.paid, credit:0, description:'مدفوع نقدًا/بطاقة'});
  }
  if((inv.remaining||0) > 0){
    lines.push({accountCode:'1130', debit:inv.remaining, credit:0, description:'ذمم عميل'});
  }
  const total = (inv.paid||0) + (inv.remaining||0);
  if(total <= 0) return; // فاتورة صفرية — لا داعي لقيد
  lines.push(..._revenueLinesWithVat(revAccount, total, 'إيراد فاتورة'));

  const entry = await postJournalEntry({
    date: inv.date || new Date().toISOString().split('T')[0],
    description: `فاتورة #${inv.id} — ${inv.patient||''}`,
    sourceType: 'invoice',
    sourceId: inv.id,
    lines
  });
  // ── سند قبض للجزء المدفوع نقدًا وقت إنشاء الفاتورة (المرحلة 6) ──
  if(entry && (inv.paid||0) > 0){
    await createVoucher({
      type: 'receipt', date: inv.date, amount: inv.paid,
      linkedInvoiceId: inv.id, linkedEntryId: entry.id,
      paidTo_or_receivedFrom: inv.patient||'', method: inv.method||'كاش'
    });
  }
});

// ── 2. مصروف جديد → قيد مصروف (حساب المصروف مقابل الخزينة) ──
const EXPENSE_ACCOUNT_MAP = {
  'إيجار':'5200', 'رواتب':'5300', 'مرافق':'5400',
  'تسويق':'5500', 'صيانة':'5600',
  // ✅ إصلاح تصنيف السلف: شاشة "إضافة مصروف" العامة (06-finance.js) لسه فيها
  // خيار نوع "سلفة" منفصل عن مودال السلفة المخصص في شاشة الموارد البشرية
  // (09-hr.js/openAdvanceModal). لو حد استخدمه، بنوجّهه لنفس حساب الأصل
  // (1150 سلف الموظفين) بدل ما يقع على الافتراضي 5900 كمصروف نهائي —
  // البنية (مدين account / دائن 1110) سليمة برضه حتى لو الحساب أصل مش مصروف.
  'سلفة':'1150'
};

// ── تأكيد وجود حساب "سلف الموظفين" (1150) في دليل الحسابات ──
// إصلاح تصنيف السلف/الرواتب: قواعد البيانات الموجودة بالفعل شغّلت
// seedChartOfAccounts() قبل إضافة الحساب ده لـ DEFAULT_COA (13-accounting.js)،
// وseedChartOfAccounts() بترفض تعمل حاجة لو فيه حسابات موجودة أصلًا. فبنتأكد
// من وجوده هنا بشكل idempotent قبل أي قيد بيستخدمه — لو مش موجود، calcTrialBalance
// هيتجاهل رصيده تمامًا (بيلف على chart_of_accounts مش على القيود) والميزان
// هيبان "غير متوازن" غلط.
function _ensureAdvancesAccount(){
  const exists = (DB.get('chart_of_accounts')||[]).some(a=>a.code==='1150');
  if(!exists){
    DB.push('chart_of_accounts', {code:'1150', name:'سلف الموظفين', type:'asset', normalBalance:'debit', isActive:true});
  }
}

EventBus.on('expenses:created', async (exp)=>{
  // ✅ إصلاح (تصنيف السلف والرواتب): راتب اتخصم منه سلفة (exp.advanceDeduction>0)
  // له معالجة خاصة — الراتب الإجمالي (net + الخصم) بيتسجل كامل في حساب 5300
  // عشان بند "رواتب" في التقارير يعكس التكلفة الحقيقية الكاملة، وقيمة الخصم
  // بتقفل حساب السلفة 1150 بدل ما تتسجل كأنها كاش خرج فعليًا من الخزينة.
  // exp.amount نفسه فضل زي ما هو (الصافي المدفوع فعليًا) عشان أي كود تاني بيقرأ
  // exp.amount (مزامنة الخزينة، الداشبورد) يفضل شغّال صح من غير أي تعديل.
  _ensureAdvancesAccount(); // idempotent — رخيصة، وبتغطي أي مسار بيستخدم حساب 1150

  if(exp.type==='رواتب' && (exp.advanceDeduction||0) > 0){
    const net       = exp.amount||0;
    const deduction = exp.advanceDeduction||0;
    const gross     = net + deduction;
    const entry = await postJournalEntry({
      date: exp.date || new Date().toISOString().split('T')[0],
      description: `مصروف: ${exp.name}`,
      sourceType: 'expense',
      sourceId: exp.id,
      lines: [
        {accountCode:'5300', debit:gross, credit:0, description:'راتب إجمالي'},
        {accountCode:'1150', debit:0, credit:deduction, description:'تسوية سلفة موظف'},
        {accountCode:'1110', debit:0, credit:net, description:'صافي مدفوع من الخزينة'}
      ]
    });
    if(entry){
      await createVoucher({
        type: 'payment', date: exp.date, amount: net,
        linkedEntryId: entry.id, paidTo_or_receivedFrom: exp.name||'', method: 'كاش'
      });
    }
    return;
  }

  const account = EXPENSE_ACCOUNT_MAP[exp.type] || '5900';
  const entry = await postJournalEntry({
    date: exp.date || new Date().toISOString().split('T')[0],
    description: `مصروف: ${exp.name}`,
    sourceType: 'expense',
    sourceId: exp.id,
    lines: [
      {accountCode:account, debit:exp.amount||0, credit:0, description:exp.name},
      {accountCode:'1110',  debit:0, credit:exp.amount||0, description:'من الخزينة'}
    ]
  });
  // ── سند صرف (المرحلة 6) ──
  if(entry){
    await createVoucher({
      type: 'payment', date: exp.date, amount: exp.amount||0,
      linkedEntryId: entry.id, paidTo_or_receivedFrom: exp.name||'', method: 'كاش'
    });
  }
});

// ── 2ب. سلفة جديدة → قيد سلفة موظف (أصل متداول قابل للاسترداد، مش مصروف نهائي) ──
// إصلاح تصنيف السلف: كانت بتتسجل كمصروف كامل فورًا (حساب 5900 الافتراضي)
// رغم إنها اقتصاديًا ذمة على الموظف. دلوقتي: مدين 1150 (سلف الموظفين) —
// أصل — / دائن 1110 (الخزينة). لما تُخصم لاحقًا من الراتب، هوك رقم 2 فوق
// بيقفلها من 1150 مش من رصيد الخزينة تاني (عشان منحسبهاش كاش خرج مرتين).
EventBus.on('advances:created', async (a)=>{
  _ensureAdvancesAccount();
  const entry = await postJournalEntry({
    date: a.date || new Date().toISOString().split('T')[0],
    description: `سلفة: ${a.staffName||''}`,
    sourceType: 'advance',
    sourceId: a.id,
    lines: [
      {accountCode:'1150', debit:a.amount||0, credit:0, description:'سلفة موظف'},
      {accountCode:'1110', debit:0, credit:a.amount||0, description:'من الخزينة'}
    ]
  });
  if(entry){
    await createVoucher({
      type: 'payment', date: a.date, amount: a.amount||0,
      linkedEntryId: entry.id, paidTo_or_receivedFrom: a.staffName||'', method: 'كاش'
    });
  }
});

// ── عكس قيد السلفة لو اتحذفت (دفاع احتياطي — نفس مبدأ عكس المصروف تحت،
// حتى لو مفيش زرار حذف سلفة في الواجهة حاليًا) ──
async function _reverseAdvanceJournalEntry(advId, reason){
  if(!advId) return;
  const entry = (DB.get('journal_entries')||[])
    .find(je => je.sourceType==='advance' && String(je.sourceId)===String(advId) && je.status==='posted');
  if(entry) await reverseJournalEntry(entry.id, reason);
}
EventBus.on('advances:deleted', async (e)=>{
  await _reverseAdvanceJournalEntry(e?.id, 'حذف السلفة المرتبطة (حذف فعلي)');
});
EventBus.on('advances:updated', async (a)=>{
  if(a && a.isDeleted){
    await _reverseAdvanceJournalEntry(a.id, 'حذف السلفة المرتبطة (Soft Delete)');
  }
});

// ── 3. تحصيل دفعة على فاتورة (سواء من شاشة الفواتير أو تعديل الفاتورة) ──
// ملاحظة: النظام الحالي بيسجّل الدفعة كـ حركة في cashlog مباشرة (مش collection
// مستقلة)، وكل مسارات دفع الفواتير بتستخدم نفس نمط الاسم بالظبط:
// "دفعة فاتورة — <اسم العميل>" — الفلترة بادئة دقيقة (مش .includes) عشان منمنعش
// اختلاطها مع دفعات الباقات المباشرة ("باقة — X" / "دفعة باقة — X") اللي كانت
// خارج نطاق المرحلة دي — دلوقتي بقى ليها hook مستقل تحت (رقم 3ب).
EventBus.on('cashlog:created', async (c)=>{
  if(c.type==='وارد' && (c.source||'').startsWith('دفعة فاتورة —')){
    const cashAccount = (c.method==='فيزا') ? '1120' : '1110';
    const entry = await postJournalEntry({
      date: c.date || new Date().toISOString().split('T')[0],
      description: `تحصيل: ${c.notes||c.source}`,
      sourceType: 'payment',
      sourceId: c.refId,
      lines: [
        {accountCode:cashAccount, debit:c.amount||0, credit:0, description:'تحصيل نقدي'},
        {accountCode:'1130', debit:0, credit:c.amount||0, description:'من ذمم العميل'}
      ]
    });
    // ── سند قبض (المرحلة 6) ──
    if(entry){
      await createVoucher({
        type: 'receipt', date: c.date, amount: c.amount||0,
        linkedInvoiceId: c.refId, linkedEntryId: entry.id,
        paidTo_or_receivedFrom: c.patient||'', method: c.method||'كاش'
      });
    }
  }
});

// ── 3ب. تحصيل دفعة مباشرة على باقة (من ملف العميل أو من شاشة تعديل الباقة) ──
// ✅ إغلاق فجوة كانت موثّقة في الدليل كـ "خارج النطاق": الدفع على الباقة بيحصل
// بمسارين مختلفين وكل واحد بيسجّل مصدر cashlog بصيغة مختلفة:
//   - processPatientPayment (02-patients.js)  → "دفعة باقة — <اسم العميل>"
//   - savePackage/تعديل الباقة (07-clinical.js) → "باقة — <اسم العميل>"
// المسارين بيقللوا من متبقي الباقة فعليًا وبيحصّلوا كاش حقيقي، لكن من غير القيد
// ده كان 1130 (ذمم العملاء) بيفضل واقف على القيمة الأصلية للأبد، والخزينة (1110)
// متعرفش إنها استلمت الفلوس فعليًا — بالظبط زي ما ظهر في اختبار "دفعة باقة" الأخير.
EventBus.on('cashlog:created', async (c)=>{
  if(c.type!=='وارد') return;
  const src = c.source||'';
  const isPkgPayment = src.startsWith('دفعة باقة —') || src.startsWith('باقة —');
  if(!isPkgPayment) return;
  const cashAccount = (c.method==='فيزا') ? '1120' : '1110';
  const entry = await postJournalEntry({
    date: c.date || new Date().toISOString().split('T')[0],
    description: `تحصيل على باقة: ${c.notes||c.source}`,
    sourceType: 'payment',
    sourceId: c.refId || null,
    lines: [
      {accountCode:cashAccount, debit:c.amount||0, credit:0, description:'تحصيل نقدي — باقة'},
      {accountCode:'1130', debit:0, credit:c.amount||0, description:'من ذمم العميل — باقة'}
    ]
  });
  // ── سند قبض (المرحلة 6) ──
  if(entry){
    await createVoucher({
      type: 'receipt', date: c.date, amount: c.amount||0,
      linkedInvoiceId: c.refId || null, linkedEntryId: entry.id,
      paidTo_or_receivedFrom: c.patient||'', method: c.method||'كاش'
    });
  }
});

// ── 4. استلام مشتريات من مورد (وقت الاستلام الفعلي — status='مستلم') ──
// ⚠️ تصحيح عن الدليل الأصلي: الربط هنا على purchases:updated مش purchases:created،
// لأن طلب الشراء ممكن يفضل "معلق" فترة قبل ما يوصل فعليًا، ومفيش أثر مالي حقيقي
// (لا مخزون ولا مديونية مورد) إلا وقت الاستلام. الحارس _inventoryUpdated بيمنع
// تكرار القيد لو النظام شغّل نفس الحدث أكتر من مرة (زي ما بيحصل في hook المخزون
// المطابق في 00-core.js).
let _postedPurchaseIds = new Set();
EventBus.on('purchases:updated', async (purchase)=>{
  if(purchase.status !== 'مستلم') return;
  if(_postedPurchaseIds.has(purchase.id)) return;
  // لو فيه قيد اتسجل بالفعل لنفس الطلبية (مثلاً بعد إعادة تحميل الصفحة)، منكررش
  const already = (DB.get('journal_entries')||[]).find(e=>e.sourceType==='purchase' && e.sourceId===purchase.id);
  if(already) return;

  _postedPurchaseIds.add(purchase.id);
  await postJournalEntry({
    date: purchase.deliveryDate || purchase.orderDate || new Date().toISOString().split('T')[0],
    description: `استلام مشتريات #${purchase.id} — ${purchase.supplier||''}`,
    sourceType: 'purchase',
    sourceId: purchase.id,
    lines: [
      {accountCode:'1140', debit:purchase.total||0, credit:0, description:'إضافة للمخزون'},
      {accountCode:'2100', debit:0, credit:purchase.total||0, description:'ذمم مورد'}
    ]
  });
});

// ── 5. سداد مورد → قيد سداد (ذمم موردين مقابل الخزينة) ──
EventBus.on('supplier_payments:created', async (sp)=>{
  const entry = await postJournalEntry({
    date: sp.date || new Date().toISOString().split('T')[0],
    description: `سداد مورد: ${sp.supplierName||''}`,
    sourceType: 'supplier_payment',
    sourceId: sp.id,
    lines: [
      {accountCode:'2100', debit:sp.amount||0, credit:0, description:'سداد ذمم مورد'},
      {accountCode:'1110', debit:0, credit:sp.amount||0, description:'من الخزينة'}
    ]
  });
  // ── سند صرف (المرحلة 6) ──
  if(entry){
    await createVoucher({
      type: 'payment', date: sp.date, amount: sp.amount||0,
      linkedEntryId: entry.id, paidTo_or_receivedFrom: sp.supplierName||'', method: sp.method||'كاش'
    });
  }
});

// ══════════════════════════════════════════
// 🔗 إغلاق فجوة تغطية إضافية — ما بعد المراجعة الشاملة قبل المرحلة 5
// ✅ راجعنا كل نقطة تكتب مباشرة في cashlog في المشروع (18 موقع) قبل نقل
// renderAccounts() لمصدر journal_entries. الرواتب/السلف (09-hr.js) اتضح إنها
// مغطاة بالفعل لأنها بتعدي على expenses:created (hook #2 فوق). لكن لقينا 5
// حركات مالية حقيقية بتتسجل في cashlog من غير أي قيد محاسبي مقابل — لو نقلنا
// P&L/Balance Sheet لـ journal_entries من غير تغطيتها، الإيراد/المصروف هيظهر
// أقل من الحقيقي. الحركات دي:
//   ✅ إيراد جلسة مباشرة (غير مرتبطة بباقة) — source: "جلسة — X"
//   ✅ بيع منتج مباشر (خارج الفواتير) — source: "بيع منتج — X"
//   ✅ تحصيل قسط — source: "دفعة قسط #N — X"
//   ✅ تسوية باقة كاملة — source: "تسوية باقة — X"
//   ✅ تصحيح دفعة مورد — source: "تصحيح دفعة مورد — X"
// ملاحظة: أي مصدر cashlog يبدأ بـ "إلغاء (حذف" (قيود عكسية من delPat/delAppt
// عند حذف عميل/موعد) بيتجاهله كل الفلاتر دي عمدًا (مفيش startsWith بيطابقها)
// عشان منعملش قيد جديد لحدث هو أصلًا عكس لحدث تاني — التغطية الصحيحة لحذف
// الفاتورة نفسها موجودة تحت في hook "عكس قيد الفاتورة عند حذفها".
// ══════════════════════════════════════════

// ── 6. إيراد جلسة مباشرة (لما تكتمل جلسة مش مرتبطة بباقة نشطة) ──
EventBus.on('cashlog:created', async (c)=>{
  if(c.type==='وارد' && (c.source||'').startsWith('جلسة —')){
    const cashAccount = (c.method==='فيزا') ? '1120' : '1110';
    const entry = await postJournalEntry({
      date: c.date || new Date().toISOString().split('T')[0],
      description: `إيراد جلسة: ${c.notes||c.source}`,
      sourceType: 'session',
      sourceId: c.sessionPlanId || c.refId || null,
      lines: [
        {accountCode:cashAccount, debit:c.amount||0, credit:0, description:'تحصيل نقدي — جلسة'},
        ..._revenueLinesWithVat('4100', c.amount||0, 'إيراد خدمات — جلسة')
      ]
    });
    if(entry){
      await createVoucher({
        type: 'receipt', date: c.date, amount: c.amount||0,
        linkedEntryId: entry.id, paidTo_or_receivedFrom: c.patient||c.source||'', method: c.method||'كاش'
      });
    }
  }
});

// ── 7. بيع منتج مباشر (شاشة المخزون — بيع مستقل عن الفواتير) ──
EventBus.on('cashlog:created', async (c)=>{
  if(c.type==='وارد' && (c.source||'').startsWith('بيع منتج —')){
    const cashAccount = (c.method==='فيزا') ? '1120' : '1110';
    const entry = await postJournalEntry({
      date: c.date || new Date().toISOString().split('T')[0],
      description: `إيراد بيع منتج: ${c.notes||c.source}`,
      sourceType: 'product_sale',
      sourceId: c.refId || null,
      lines: [
        {accountCode:cashAccount, debit:c.amount||0, credit:0, description:'تحصيل نقدي — بيع منتج'},
        ..._revenueLinesWithVat('4200', c.amount||0, 'إيراد بيع منتجات')
      ]
    });
    if(entry){
      await createVoucher({
        type: 'receipt', date: c.date, amount: c.amount||0,
        linkedEntryId: entry.id, paidTo_or_receivedFrom: c.source||'بيع منتج', method: c.method||'كاش'
      });
    }
    // ✅ COGS — تكلفة المنتج المباع (بطلب المستخدم: صافي الربح يعكس التكلفة
    // الفعلية). product_sales سجّلت unitCost*qty وقت البيع (05-inventory.js)،
    // ومربوطة بنفس c.refId. نفس sourceType/sourceId لقيد الإيراد فوق عشان
    // تتعكس مع بعض تلقائيًا لو حصل حذف/عكس للبيع مستقبلاً.
    const saleRec = c.refId ? (DB.get('product_sales')||[]).find(s=>s.id===c.refId) : null;
    const cogsCost = (saleRec?.unitCost||0) * (saleRec?.qty||0);
    if(cogsCost > 0){
      await postJournalEntry({
        date: c.date || new Date().toISOString().split('T')[0],
        description: `تكلفة مواد — بيع منتج: ${c.notes||c.source}`,
        sourceType: 'product_sale',
        sourceId: c.refId || null,
        lines: [
          {accountCode:'5100', debit:cogsCost, credit:0, description:'تكلفة المنتج المباع'},
          {accountCode:'1140', debit:0, credit:cogsCost, description:'خصم من المخزون'}
        ]
      });
    }
  }
});

// ── 8. تحصيل قسط ──
// ✅ الأقساط نوعين: (أ) مرتبطة بفاتورة/باقة أصلية (fromInvId/fromPkgId) — الذمم
// اتسجلت بالفعل في 1130 وقت إنشاء الفاتورة/الباقة، فالتحصيل هنا لازم يقفل نفس
// الحساب (دائن 1130). (ب) خطة قسط مستقلة تمامًا (بدون فاتورة، من saveInstallment
// في 06-finance.js) — الذمم دي لم تُسجَّل في 1130 من الأساس، فالتحصيل هنا هو
// أول ظهور للإيراد فعليًا، فلازم يُقفَل على حساب الإيراد (4100) مباشرة بدل 1130
// (وإلا هيدخل 1130 في رصيد سالب وهمي).
EventBus.on('cashlog:created', async (c)=>{
  if(c.type==='وارد' && (c.source||'').startsWith('دفعة قسط #')){
    const plan = (DB.get('installments')||[]).find(p=>p.id===c.refId);
    const isLinkedToInvoiceOrPkg = !!(plan && (plan.fromInvId || plan.fromPkgId));
    const cashAccount   = (c.method==='فيزا') ? '1120' : '1110';
    const creditAccount = isLinkedToInvoiceOrPkg ? '1130' : '4100';
    const creditDesc    = isLinkedToInvoiceOrPkg ? 'من ذمم العميل — قسط' : 'إيراد قسط مستقل';
    // ✅ الضريبة بتتفصل بس لما يكون ده أول ظهور فعلي للإيراد (creditAccount==='4100').
    // لو الذمم كانت مسجّلة بالفعل وقت إنشاء الفاتورة/الباقة (1130)، يبقى الإيراد
    // (وبالتبعية نصيب الضريبة منه) كان اتسجّل وقتها أصلًا — ملناش داعي نفصلها تاني هنا.
    const creditLines = isLinkedToInvoiceOrPkg
      ? [{accountCode:creditAccount, debit:0, credit:c.amount||0, description:creditDesc}]
      : _revenueLinesWithVat(creditAccount, c.amount||0, creditDesc);
    const entry = await postJournalEntry({
      date: c.date || new Date().toISOString().split('T')[0],
      description: `تحصيل قسط: ${c.notes||c.source}`,
      sourceType: 'installment',
      sourceId: c.refId || null,
      lines: [
        {accountCode:cashAccount, debit:c.amount||0, credit:0, description:'تحصيل نقدي — قسط'},
        ...creditLines
      ]
    });
    if(entry){
      await createVoucher({
        type: 'receipt', date: c.date, amount: c.amount||0,
        linkedInvoiceId: plan?.fromInvId || null, linkedEntryId: entry.id,
        paidTo_or_receivedFrom: plan?.patientName||c.patient||'', method: c.method||'كاش'
      });
    }
  }
});

// ── 8ب. سد فجوة "مزامنة الباقات" (syncPackageInstallments في 06-finance.js) ──
// ⚠️ المشكلة: زرار "مزامنة الباقات" بيعمل DB.push('installments', {..., fromPkgId})
// مباشرة من بيانات الباقة، من غير ما يمر على invoices:created أبدًا — يعني
// مفيش قيد إيراد (Debit 1130 / Credit 4300) اتسجل للباقة دي أصلًا وقت إنشائها.
// النتيجة: hook رقم 8 فوق بيفترض إن isLinkedToInvoiceOrPkg==true يبقى معناه
// 1130 متسجل بالفعل، ويعمل credit عليه وقت التحصيل — فيدخل 1130 في رصيد سالب
// وهمي لأي باقة دخلت من مسار المزامنة بدل مسار savePackage() العادي.
// الحل: نسمع على installments:created، ولو الخطة جايه من fromPkgId وملهاش
// فاتورة مرتبطة (يعني أكيد جايه من المزامنة مش من savePackage)، نعمل القيد
// المفقود فورًا بنفس قيمة الباقة كاملة (plan.total) — ده هيسجل الذمم والإيراد
// اللي كان المفروض يتسجلوا وقت إنشاء الباقة، فيتوازن الحساب صح وقت التحصيل بعد كده.
// محمي ضد التكرار بالتحقق من sourceType:'package' قبل النشر.
EventBus.on('installments:created', async (plan)=>{
  if(!plan || !plan.fromPkgId) return; // مش خطة جايه من باقة أصلًا

  // ⚠️ إصلاح: مينفعش نتحقق بمجرد "فيه فاتورة بنفس pkgId" لأن شاشة الطبيب
  // (finalizeConsultation في 07-clinical.js) بتعمل فاتورة بـ total=0/paid=0/remaining=0
  // لكل جلسة "مغطاة بالباقة" — دي فاتورة استهلاك مش فاتورة بيع، ومالهاش أي قيد
  // في hook رقم 1 (لأنه بيرجع فورًا لو total<=0). لو اعتمدنا على وجودها بس،
  // هنفوّت تسجيل ذمم/إيراد الباقة الحقيقية لأي باقة دخلت الأقساط عن طريق المزامنة
  // وكان ليها جلسات مستهلكة قبل أي فاتورة بيع حقيقية — وده بالظبط اللي بيسيب 1130
  // من غير مدين يقابل دائن التحصيل لاحقًا فيدخل رصيد سالب وهمي.
  // الحل: فاتورة "حقيقية" للباقة هي اللي قيمتها (مدفوع+متبقي) أكبر من صفر بس.
  const invoices = DB.get('invoices') || [];
  const hasRealInvoice = invoices.some(i =>
    String(i.pkgId) === String(plan.fromPkgId) && ((i.paid||0) + (i.remaining||0)) > 0
  );
  if(hasRealInvoice) return; // الباقة دخلت من savePackage() العادي وعندها فاتورة بيع حقيقية — مغطاة بالفعل بـ hook رقم 1

  const journal = DB.get('journal_entries') || [];
  const alreadyPosted = journal.some(e => e.sourceType === 'package' && String(e.sourceId) === String(plan.fromPkgId));
  if(alreadyPosted) return; // اتغطت قبل كده — منع تكرار

  const amount = plan.total || 0;
  if(amount <= 0) return;

  await postJournalEntry({
    date: plan.startDate || new Date().toISOString().split('T')[0],
    description: `[سد فجوة مزامنة] باقة: ${plan.service||''} — ${plan.patientName||''}`,
    sourceType: 'package',
    sourceId: plan.fromPkgId,
    lines: [
      {accountCode:'1130', debit:amount, credit:0, description:'ذمم عميل — باقة (مزامنة)'},
      ..._revenueLinesWithVat('4300', amount, 'إيراد باقات (مزامنة)')
    ]
  });
  // ⚠️ مفيش createVoucher هنا عمدًا — مفيش حركة كاش فعلية وقت المزامنة نفسها
  // (المزامنة مش بتحرك فلوس، بس بتسجل قيد كان ناقص). أي تحصيل فعلي بعد كده
  // هيتغطى بسند من hook رقم 8 العادي وقت التحصيل الحقيقي.
});

// ── 9. تسوية باقة كاملة (سداد كل المتبقي دفعة واحدة من ملف العميل) ──
EventBus.on('cashlog:created', async (c)=>{
  if(c.type==='وارد' && (c.source||'').startsWith('تسوية باقة —')){
    const cashAccount = (c.method==='فيزا') ? '1120' : '1110';
    const entry = await postJournalEntry({
      date: c.date || new Date().toISOString().split('T')[0],
      description: `تسوية باقة: ${c.notes||c.source}`,
      sourceType: 'package_settlement',
      sourceId: c.refId || null,
      lines: [
        {accountCode:cashAccount, debit:c.amount||0, credit:0, description:'تحصيل نقدي — تسوية باقة'},
        {accountCode:'1130', debit:0, credit:c.amount||0, description:'من ذمم العميل — تسوية باقة'}
      ]
    });
    if(entry){
      await createVoucher({
        type: 'receipt', date: c.date, amount: c.amount||0,
        linkedEntryId: entry.id, paidTo_or_receivedFrom: c.patient||c.source||'', method: c.method||'كاش'
      });
    }
  }
});

// ── 10. تصحيح دفعة مورد (تعديل مبلغ دفعة سابقة من شاشة الموردين) ──
EventBus.on('cashlog:created', async (c)=>{
  if((c.source||'').startsWith('تصحيح دفعة مورد —')){
    // زيادة المبلغ (صادر إضافي) = سداد إضافي فعلي لذمم المورد
    // تقليل المبلغ (وارد استرجاع) = رجوع جزء من الذمم اللي كانت اتقفلت غلط
    const isIncrease = c.type==='صادر';
    const entry = await postJournalEntry({
      date: c.date || new Date().toISOString().split('T')[0],
      description: `تصحيح سداد مورد: ${c.notes||c.source}`,
      sourceType: 'supplier_payment_correction',
      sourceId: c.refId || null,
      lines: isIncrease
        ? [
            {accountCode:'2100', debit:c.amount||0, credit:0, description:'سداد إضافي — تصحيح'},
            {accountCode:'1110', debit:0, credit:c.amount||0, description:'من الخزينة'}
          ]
        : [
            {accountCode:'1110', debit:c.amount||0, credit:0, description:'استرجاع للخزينة — تصحيح'},
            {accountCode:'2100', debit:0, credit:c.amount||0, description:'رجوع لذمم مورد'}
          ]
    });
    if(entry){
      await createVoucher({
        type: isIncrease ? 'payment' : 'receipt', date: c.date, amount: c.amount||0,
        linkedEntryId: entry.id, paidTo_or_receivedFrom: c.notes||c.source||'', method: c.method||'كاش'
      });
    }
  }
});

// ── 11. عكس قيد الفاتورة عند حذفها (delPat / delAppt) ──
// ✅ الحذف الحالي في 00-core.js (invoices:deleted) بيمسح سجلات cashlog محليًا
// من غير قيد عكسي، فلو سبنا قيد الإيراد الأصلي زي ما هو، هيفضل ظاهر في ميزان
// المراجعة كإيراد حقيقي رغم إن الفاتورة اتحذفت فعليًا. بنستخدم reverseJournalEntry
// (المبنية بالفعل في المرحلة 2/9) بدل حذف القيد — نفس مبدأ "عكس مش حذف" المتبع
// في كل مكان تاني بالنظام (cashlog, إلخ).
// ✅ الحذف المستقل لخطة قسط/باقة/جلسة (بدون حذف فاتورة) بقى مغطّى في هوك رقم 13
// تحت (packages:deleted, installments:deleted, sessions:deleted).
EventBus.on('invoices:deleted', async (e)=>{
  const invId = e?.id;
  if(!invId) return;
  // ✅ FIX: كانت بتعكس أول قيد بس (.find) — بعد إضافة قيد COGS المستقل بجانب
  // قيد الإيراد لنفس sourceId، لازم نعكس *كل* القيود المرتبطة مش واحد بس.
  await _reverseAllSourceJournalEntries('invoice', invId, 'حذف الفاتورة المرتبطة');
});

// ── 12. عكس قيد المصروف عند حذفه (delExp في 06-finance.js) ──
// المرحلة 9 من دليل تطوير الطبقة المحاسبية.
// ✅ delExp() بقت تستخدم DB.softDel('expenses', id) بدل DB.del() (Soft
// Delete حقيقي — كل نقاط القراءة اتحدّثت لـ DB.getActive() في 06-finance.js/
// 10-reports.js/15-accounting-backfill.js عشان تستبعد isDeleted:true).
// DB.softDel() بتنادي DB.upd() داخليًا، يعني الحدث اللي بيتطلق هو
// 'expenses:updated' (مش 'expenses:deleted') مع record.isDeleted===true.
// بنسمع للحالتين مع بعض: 'updated' مع isDeleted (المسار الفعلي دلوقتي)،
// و'deleted' الفعلي (دفاع احتياطي لو ظهر مسار حذف فعلي تاني مستقبلاً).
// reverseJournalEntry() نفسها idempotent (بترفض تعكس قيد معكوس بالفعل)،
// فمفيش خطر من استدعائها أكتر من مرة لنفس المصروف.
async function _reverseExpenseJournalEntry(expId, reason){
  if(!expId) return;
  const entry = (DB.get('journal_entries')||[])
    .find(je => je.sourceType==='expense' && String(je.sourceId)===String(expId) && je.status==='posted');
  if(entry) await reverseJournalEntry(entry.id, reason);
}

EventBus.on('expenses:deleted', async (e)=>{
  await _reverseExpenseJournalEntry(e?.id, 'حذف المصروف المرتبط (حذف فعلي)');
});

EventBus.on('expenses:updated', async (exp)=>{
  if(exp && exp.isDeleted){
    await _reverseExpenseJournalEntry(exp.id, 'حذف المصروف المرتبط (Soft Delete)');
  }
});

// ── 13. إغلاق الفجوة المعروفة من هوك رقم 11: حذف مستقل لخطة قسط/جلسة/باقة ──
// المرحلة 9 من دليل تطوير الطبقة المحاسبية (تكملة).
// خلافًا للفاتورة/المصروف (قيد واحد لكل مصدر عادةً)، خطة القسط وخطة الجلسات
// ممكن يتسجلّهم أكتر من قيد على مدار الوقت لنفس الـ sourceId (كل تحصيل قسط،
// وكل جلسة بتتحصّل إيرادها لوحدها — هوك 6 و8 فوق). فلما تتحذف الخطة نفسها
// (delInstallment/delSession في 06-finance.js/07-clinical.js) أو الباقة
// (delPackage) لازم نعكس *كل* القيود المرتبطة، مش أول واحدة بس، وإلا هيفضل
// جزء من الإيراد ظاهر في ميزان المراجعة رغم إن مصدره اتحذف بالكامل.
async function _reverseAllSourceJournalEntries(sourceType, sourceId, reason){
  if(!sourceId) return;
  const entries = (DB.get('journal_entries')||[])
    .filter(je => je.sourceType===sourceType && String(je.sourceId)===String(sourceId) && je.status==='posted');
  for(const je of entries){
    await reverseJournalEntry(je.id, reason);
  }
}

EventBus.on('installments:deleted', async (e)=>{
  await _reverseAllSourceJournalEntries('installment', e?.id, 'حذف خطة الأقساط المرتبطة');
});

EventBus.on('sessions:deleted', async (e)=>{
  await _reverseAllSourceJournalEntries('session', e?.id, 'حذف خطة الجلسات المرتبطة');
});

EventBus.on('packages:deleted', async (e)=>{
  await _reverseAllSourceJournalEntries('package', e?.id, 'حذف الباقة المرتبطة');
});

// ── 14. COGS لاستهلاك المخزون في الجلسات العلاجية/الباقات ──
// بطلب المستخدم: صافي الربح يعكس تكلفة المواد الفعلية. session_completions
// بيتسجل في _recordSessionCompletion (12-financial-integration.js) بعد كل
// خصم مخزون فعلي، وبيحمل cogsAmount = القيمة الحقيقية اللي رجّعتها
// deductInventory() (مش تقدير نظري). لو الجلسة مرتبطة بخطة جلسات (sessionPlanId)
// نستخدم sourceType:'session' بنفس sourceId بتاع قيد الإيراد (هوك 6) عشان
// تتعكس مع بعض تلقائيًا لو الخطة اتحذفت (هوك 13). لو مرتبطة بباقة (pkgId)
// بدل كده، نستخدم sourceType:'package' بنفس منطق حذف الباقة.
EventBus.on('session_completions:created', async (rec)=>{
  const cost = rec?.cogsAmount || 0;
  if(cost <= 0) return;
  const sourceType = rec.sessionPlanId ? 'session' : (rec.pkgId ? 'package' : null);
  const sourceId   = rec.sessionPlanId || rec.pkgId || null;
  if(!sourceType || !sourceId) return; // مفيش مصدر نقدر نربط بيه القيد أو نعكسه لاحقًا
  await postJournalEntry({
    date: rec.date || new Date().toISOString().split('T')[0],
    description: `تكلفة مواد — جلسة: ${rec.serviceName||''} (${rec.patName||''})`,
    sourceType, sourceId,
    lines: [
      {accountCode:'5100', debit:cost, credit:0, description:'تكلفة المواد المستهلكة'},
      {accountCode:'1140', debit:0, credit:cost, description:'خصم من المخزون'}
    ]
  });
});

// ── 15. حملات إعلانية → مصروف تلقائي (تسويق) ──
// بطلب المستخدم: ميزانية الحملة لازم تنعكس في المصروفات عشان صافي الربح
// يبقى حقيقي 100% ويشمل تكلفة التسويق. بنعتمد على البنية الموجودة بالفعل:
// مصروف جديد بنوع 'تسويق' بيتحول تلقائيًا لقيد محاسبي (حساب 5500) عبر
// هوك رقم 2 فوق — إحنا هنا بس بنولّد/بنحدّث/بنعكس المصروف "المرتبط" بالحملة
// (عبر حقل linkedCampaignId)، والباقي بيحصل لوحده عبر الهوكس الموجودة.
// ⚠️ افتراض: حقل "الميزانية" (budget) في نموذج الحملة بيمثل مبلغ فعلي
// (مش رقم تخطيطي بس)، ومُسجَّل كمصروف بتاريخ بداية الحملة.
function _findActiveCampaignExpense(campaignId){
  return (DB.getActive ? DB.getActive('expenses') : DB.get('expenses')).find(e => e.linkedCampaignId === campaignId);
}
function _campaignExpensePayload(c){
  return {
    name: `حملة إعلانية: ${c.name}`,
    type: 'تسويق',
    amount: c.budget || 0,
    branch: c.branch || '',
    date: c.startDate || new Date().toISOString().split('T')[0],
    notes: `ميزانية حملة "${c.name}"${c.channel?' — '+c.channel:''}`,
    linkedCampaignId: c.id
  };
}

EventBus.on('campaigns:created', (c)=>{
  if(!c || !((c.budget||0) > 0)) return;
  DB.push('expenses', _campaignExpensePayload(c)); // بيولّد expenses:created → قيد 5500 تلقائيًا
});

EventBus.on('campaigns:updated', (c)=>{
  if(!c) return;
  const existing = _findActiveCampaignExpense(c.id);
  const newBudget = c.budget || 0;
  const newDate   = c.startDate || (existing?.date) || new Date().toISOString().split('T')[0];
  if(existing && existing.amount === newBudget && existing.date === newDate) return; // مفيش تغيير مالي فعلي
  if(existing) DB.softDel('expenses', existing.id); // بيعكس القيد القديم تلقائيًا (هوك 12 فوق)
  if(newBudget > 0) DB.push('expenses', _campaignExpensePayload(c));
});

EventBus.on('campaigns:deleted', (e)=>{
  const existing = _findActiveCampaignExpense(e?.id);
  if(existing) DB.softDel('expenses', existing.id); // بيعكس القيد تلقائيًا (هوك 12 فوق)
});
