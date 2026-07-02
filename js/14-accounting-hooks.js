// ══════════════════════════════════════════
// 🔗 AUTO-POSTING HOOKS — الربط التلقائي بين النظام الحالي ومحرك القيود
// المرحلة 3 من دليل تطوير الطبقة المحاسبية
// يتحمّل بعد 13-accounting.js
// ⚠️ إضافة صرفة — بيستمع لأحداث EventBus الموجودة، ولا يعدّل أي دالة قائمة
// ══════════════════════════════════════════
//
// 📋 نطاق هذه المرحلة (بعد مراجعة الكود الفعلي، مش الافتراض النظري بس):
//   ✅ إيراد الفواتير (فواتير عادية + فواتير باقات + فواتير من الشاشة الطبية —
//      كلها بتعدّي على invoices:created فبتتغطى تلقائيًا مهما كان مصدرها)
//   ✅ تحصيل دفعات الفواتير (سواء من شاشة الفواتير أو التعديل المباشر)
//   ✅ المصروفات
//   ✅ استلام المشتريات من المورد (وقت الاستلام الفعلي مش وقت إنشاء الطلب)
//   ✅ سداد المورد
//
// ⚠️ خارج النطاق دلوقتي (يحتاج مرحلة مخصصة لاحقًا لأنه أعقد مما افترضه الدليل الأصلي):
//   ❌ دفعة إضافية على باقة مفتوحة من شاشة تعديل الباقة (cashlog source: "باقة — X")
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

  await postJournalEntry({
    date: inv.date || new Date().toISOString().split('T')[0],
    description: `فاتورة #${inv.id} — ${inv.patient||''}`,
    sourceType: 'invoice',
    sourceId: inv.id,
    lines
  });
});

// ── 2. مصروف جديد → قيد مصروف (حساب المصروف مقابل الخزينة) ──
const EXPENSE_ACCOUNT_MAP = {
  'إيجار':'5200', 'رواتب':'5300', 'مرافق':'5400',
  'تسويق':'5500', 'صيانة':'5600'
};
EventBus.on('expenses:created', async (exp)=>{
  const account = EXPENSE_ACCOUNT_MAP[exp.type] || '5900';
  await postJournalEntry({
    date: exp.date || new Date().toISOString().split('T')[0],
    description: `مصروف: ${exp.name}`,
    sourceType: 'expense',
    sourceId: exp.id,
    lines: [
      {accountCode:account, debit:exp.amount||0, credit:0, description:exp.name},
      {accountCode:'1110',  debit:0, credit:exp.amount||0, description:'من الخزينة'}
    ]
  });
});

// ── 3. تحصيل دفعة على فاتورة (سواء من شاشة الفواتير أو تعديل الفاتورة) ──
// ملاحظة: النظام الحالي بيسجّل الدفعة كـ حركة في cashlog مباشرة (مش collection
// مستقلة)، وكل مسارات دفع الفواتير بتستخدم نفس نمط الاسم بالظبط:
// "دفعة فاتورة — <اسم العميل>" — الفلترة بادئة دقيقة (مش .includes) عشان منمنعش
// اختلاطها مع دفعات الباقات المباشرة ("باقة — X" / "دفعة باقة — X") اللي لسه
// خارج نطاق هذه المرحلة.
EventBus.on('cashlog:created', async (c)=>{
  if(c.type==='وارد' && (c.source||'').startsWith('دفعة فاتورة —')){
    await postJournalEntry({
      date: c.date || new Date().toISOString().split('T')[0],
      description: `تحصيل: ${c.notes||c.source}`,
      sourceType: 'payment',
      sourceId: c.refId,
      lines: [
        {accountCode:'1110', debit:c.amount||0, credit:0, description:'تحصيل نقدي'},
        {accountCode:'1130', debit:0, credit:c.amount||0, description:'من ذمم العميل'}
      ]
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
  await postJournalEntry({
    date: sp.date || new Date().toISOString().split('T')[0],
    description: `سداد مورد: ${sp.supplierName||''}`,
    sourceType: 'supplier_payment',
    sourceId: sp.id,
    lines: [
      {accountCode:'2100', debit:sp.amount||0, credit:0, description:'سداد ذمم مورد'},
      {accountCode:'1110', debit:0, credit:sp.amount||0, description:'من الخزينة'}
    ]
  });
});
