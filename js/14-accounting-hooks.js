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

// ── تحديد حساب الإيراد المناسب حسب نوع الفاتورة ──
function _revenueAccountFor(invoice){
  if(invoice.pkgId) return '4300';                              // فاتورة باقة
  if((invoice.service||'').includes('منتج')) return '4200';     // بيع منتج
  return '4100';                                                 // خدمة عادية
}

// ── 1. فاتورة جديدة → قيد إيراد (كاش/آجل مقابل إيراد) ──
EventBus.on('invoices:created', async (inv)=>{
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
  lines.push({accountCode:revAccount, debit:0, credit:total, description:'إيراد فاتورة'});

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
  'تسويق':'5500', 'صيانة':'5600'
};
EventBus.on('expenses:created', async (exp)=>{
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
        {accountCode:'4100', debit:0, credit:c.amount||0, description:'إيراد خدمات — جلسة'}
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
        {accountCode:'4200', debit:0, credit:c.amount||0, description:'إيراد بيع منتجات'}
      ]
    });
    if(entry){
      await createVoucher({
        type: 'receipt', date: c.date, amount: c.amount||0,
        linkedEntryId: entry.id, paidTo_or_receivedFrom: c.source||'بيع منتج', method: c.method||'كاش'
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
    const entry = await postJournalEntry({
      date: c.date || new Date().toISOString().split('T')[0],
      description: `تحصيل قسط: ${c.notes||c.source}`,
      sourceType: 'installment',
      sourceId: c.refId || null,
      lines: [
        {accountCode:cashAccount, debit:c.amount||0, credit:0, description:'تحصيل نقدي — قسط'},
        {accountCode:creditAccount, debit:0, credit:c.amount||0, description:creditDesc}
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

  const invoices = DB.get('invoices') || [];
  const hasInvoice = invoices.some(i => String(i.pkgId) === String(plan.fromPkgId));
  if(hasInvoice) return; // الباقة دخلت من savePackage() العادي وعندها فاتورة — مغطاة بالفعل بـ hook رقم 1

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
      {accountCode:'4300', debit:0, credit:amount, description:'إيراد باقات (مزامنة)'}
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
// ⚠️ نطاق معروف متبقي (مش مغطى هنا): حذف مستقل لخطة قسط/باقة/جلسة (packages:deleted,
// installments:deleted, sessions:deleted) بدون حذف فاتورة — نادر عمليًا لأنه بيحصل
// فقط من خلال delPat (حذف العميل بالكامل)، ووقتها بيتحذف كل حاجة مع بعض فمفيش
// تناقض ظاهر في التقارير. يتغطى في مرحلة لاحقة لو ظهرت حاجة فعلية.
EventBus.on('invoices:deleted', async (e)=>{
  const invId = e?.id;
  if(!invId) return;
  const entry = (DB.get('journal_entries')||[])
    .find(je => je.sourceType==='invoice' && String(je.sourceId)===String(invId) && je.status==='posted');
  if(entry) await reverseJournalEntry(entry.id, 'حذف الفاتورة المرتبطة');
});
