// ══════════════════════════════════════════
// 🔄 BACKFILL — الترحيل التاريخي للقيود المحاسبية
// خطوة تمهيدية قبل المرحلة 5 من دليل تطوير الطبقة المحاسبية
// ⚠️ سكريبت مرة واحدة تحت إشراف المستخدم — بيشتغل فقط لما تضغط الزرار يدويًا،
//    مفيش أي تشغيل تلقائي أو عند تحميل الصفحة.
// النطاق (بعد إغلاق فجوة التغطية الإضافية في 14-accounting-hooks.js):
//   ✅ إيراد الفواتير (عادية + باقات + من الشاشة الطبية)
//   ✅ المصروفات
//   ✅ تحصيل دفعات الفواتير والباقات
//   ✅ باقات دخلت الأقساط من "مزامنة الباقات" بدون فاتورة (فجوة قديمة قبل hook 8ب)
//   ✅ استلام المشتريات (status = مستلم فقط)
//   ✅ سداد الموردين + تصحيحات الدفعات
//   ✅ إيراد الجلسات المباشرة، بيع المنتجات المباشر، تحصيل الأقساط، تسوية الباقات
//   ✅ سندات القبض/الصرف (المرحلة 6) — مرور عام على كل قيد فيه كاش فعلي بعد
//      الترحيل، سواء اتولد دلوقتي أو من الـ hooks الحية قبل إضافة السندات
// آمن للتشغيل أكتر من مرة: أي سجل اتغطى بقيد قبل كده (سواء من الـ Hook الحي
// أو من تشغيل سابق لنفس السكريبت) بيتخطّى تلقائيًا، فمفيش تكرار في القيود
// ولا في السندات.
// يتحمّل بعد 14-accounting-hooks.js (بيعيد استخدام _revenueAccountFor
// و EXPENSE_ACCOUNT_MAP من نفس الملف بدل ما يكرر المنطق).
// ══════════════════════════════════════════

async function runAccountingBackfill(){
  if(!confirm(
    'هيتم إنشاء قيود محاسبية وسندات قبض/صرف بأثر رجعي لكل الفواتير/المصروفات/المشتريات المستلمة/سداد الموردين/الجلسات/بيع المنتجات/الأقساط/تسوية الباقات اللي لسه مالهاش قيد أو سند.\n\n' +
    'العملية آمنة وتقدر تشغّلها أكتر من مرة براحتك — أي سجل اتغطى قبل كده (تلقائيًا أو من تشغيل سابق) هيتخطّى ومش هيتكرر.\n\n' +
    'تكمل؟'
  )) return;

  const journal = DB.get('journal_entries')||[];
  const hasEntry = (type, sourceId) =>
    journal.some(e=>e.sourceType===type && String(e.sourceId)===String(sourceId));

  const tasks = []; // {date, run: async fn}

  // ── 1. إيراد الفواتير ──
  (DB.get('invoices')||[]).forEach(inv=>{
    const total = (inv.paid||0) + (inv.remaining||0);
    if(total <= 0) return;                     // فاتورة صفرية — زي الـ Hook بالظبط
    if(hasEntry('invoice', inv.id)) return;     // اتغطت بالفعل

    tasks.push({date: inv.date || '0000-00-00', run: async ()=>{
      const revAccount = _revenueAccountFor(inv);
      const lines = [];
      if((inv.paid||0) > 0){
        const cashAccount = (inv.method==='فيزا') ? '1120' : '1110';
        lines.push({accountCode:cashAccount, debit:inv.paid, credit:0, description:'مدفوع نقدًا/بطاقة'});
      }
      if((inv.remaining||0) > 0){
        lines.push({accountCode:'1130', debit:inv.remaining, credit:0, description:'ذمم عميل'});
      }
      lines.push({accountCode:revAccount, debit:0, credit:total, description:'إيراد فاتورة'});

      return postJournalEntry({
        date: inv.date || new Date().toISOString().split('T')[0],
        description: `[ترحيل] فاتورة #${inv.id} — ${inv.patient||''}`,
        sourceType: 'invoice', sourceId: inv.id, lines
      });
    }});
  });

  // ── 2. المصروفات ──
  (DB.get('expenses')||[]).forEach(exp=>{
    if((exp.amount||0) <= 0) return;
    if(hasEntry('expense', exp.id)) return;

    tasks.push({date: exp.date || '0000-00-00', run: async ()=>{
      const account = EXPENSE_ACCOUNT_MAP[exp.type] || '5900';
      return postJournalEntry({
        date: exp.date || new Date().toISOString().split('T')[0],
        description: `[ترحيل] مصروف: ${exp.name}`,
        sourceType: 'expense', sourceId: exp.id,
        lines: [
          {accountCode:account, debit:exp.amount||0, credit:0, description:exp.name},
          {accountCode:'1110',  debit:0, credit:exp.amount||0, description:'من الخزينة'}
        ]
      });
    }});
  });

  // ── 3. تحصيل دفعات الفواتير (من cashlog) ──
  // ملاحظة: قيود الدفعات (سواء من الـ Hook الحي أو من تشغيل سابق لهذا
  // السكريبت) بتتسجل بنفس sourceId (رقم الفاتورة) لأكتر من دفعة أحيانًا،
  // فمنقدرش نعتمد على sourceId لوحده للتحقق من التكرار زي باقي الأنواع.
  // بدل كده، بنتأكد إن فيه قيد 'payment' بنفس رقم الفاتورة + نفس التاريخ +
  // نفس المبلغ المدين على حساب الخزينة (1110) قبل ما نعتبرها مغطاة.
  (DB.get('cashlog')||[]).forEach(c=>{
    if(c.type !== 'وارد' || !(c.source||'').startsWith('دفعة فاتورة —')) return;
    const amount = c.amount || 0;
    if(amount <= 0) return;

    const covered = journal.some(e =>
      e.sourceType === 'payment' &&
      String(e.sourceId) === String(c.refId) &&
      e.date === c.date &&
      (e.lines||[]).some(l => l.accountCode==='1110' && Math.abs((l.debit||0) - amount) < 0.01)
    );
    if(covered) return;

    tasks.push({date: c.date || '0000-00-00', run: async ()=>{
      return postJournalEntry({
        date: c.date || new Date().toISOString().split('T')[0],
        description: `[ترحيل] تحصيل: ${c.notes || c.source}`,
        sourceType: 'payment', sourceId: c.refId,
        lines: [
          {accountCode:'1110', debit:amount, credit:0, description:'تحصيل نقدي'},
          {accountCode:'1130', debit:0, credit:amount, description:'من ذمم العميل'}
        ]
      });
    }});
  });

  // ── 4. استلام المشتريات (وقت الاستلام الفعلي فقط) ──
  (DB.get('purchases')||[]).forEach(p=>{
    if(p.status !== 'مستلم') return;
    if(hasEntry('purchase', p.id)) return;

    tasks.push({date: p.deliveryDate || p.orderDate || '0000-00-00', run: async ()=>{
      return postJournalEntry({
        date: p.deliveryDate || p.orderDate || new Date().toISOString().split('T')[0],
        description: `[ترحيل] استلام مشتريات #${p.id} — ${p.supplier||''}`,
        sourceType: 'purchase', sourceId: p.id,
        lines: [
          {accountCode:'1140', debit:p.total||0, credit:0, description:'إضافة للمخزون'},
          {accountCode:'2100', debit:0, credit:p.total||0, description:'ذمم مورد'}
        ]
      });
    }});
  });

  // ── 5. سداد الموردين ──
  (DB.get('supplier_payments')||[]).forEach(sp=>{
    if((sp.amount||0) <= 0) return;
    if(hasEntry('supplier_payment', sp.id)) return;

    tasks.push({date: sp.date || '0000-00-00', run: async ()=>{
      return postJournalEntry({
        date: sp.date || new Date().toISOString().split('T')[0],
        description: `[ترحيل] سداد مورد: ${sp.supplierName||''}`,
        sourceType: 'supplier_payment', sourceId: sp.id,
        lines: [
          {accountCode:'2100', debit:sp.amount||0, credit:0, description:'سداد ذمم مورد'},
          {accountCode:'1110', debit:0, credit:sp.amount||0, description:'من الخزينة'}
        ]
      });
    }});
  });

  // ══════════════════════════════════════════
  // 🔗 توسعة الترحيل — نفس النطاق الإضافي اللي اتغطى بـ hooks حية جديدة في
  // 14-accounting-hooks.js (راجع تعليق "إغلاق فجوة تغطية إضافية" هناك).
  // بنستخدم نفس أسلوب dedup بالتاريخ+المبلغ المستخدم في القسم 3 فوق (مش
  // sourceId لوحده) لأن مصادر زي القسط/الجلسة ممكن تتكرر لنفس sourceId
  // (أكتر من دفعة/جلسة لنفس الخطة).
  // ══════════════════════════════════════════
  const coveredByAmount = (sourceType, sourceId, date, amount, cashCode) =>
    journal.some(e =>
      e.sourceType === sourceType &&
      String(e.sourceId) === String(sourceId) &&
      e.date === date &&
      (e.lines||[]).some(l => l.accountCode===cashCode && Math.abs((l.debit||0) - amount) < 0.01)
    );

  // ── 6. تحصيل دفعات الباقات (دفعة باقة — / باقة —) ──
  (DB.get('cashlog')||[]).forEach(c=>{
    if(c.type !== 'وارد') return;
    const src = c.source||'';
    if(!(src.startsWith('دفعة باقة —') || src.startsWith('باقة —'))) return;
    const amount = c.amount || 0;
    if(amount <= 0) return;
    const cashCode = (c.method==='فيزا') ? '1120' : '1110';
    if(coveredByAmount('payment', c.refId, c.date, amount, cashCode)) return;

    tasks.push({date: c.date || '0000-00-00', run: async ()=>{
      return postJournalEntry({
        date: c.date || new Date().toISOString().split('T')[0],
        description: `[ترحيل] تحصيل على باقة: ${c.notes||c.source}`,
        sourceType: 'payment', sourceId: c.refId || null,
        lines: [
          {accountCode:cashCode, debit:amount, credit:0, description:'تحصيل نقدي — باقة'},
          {accountCode:'1130', debit:0, credit:amount, description:'من ذمم العميل — باقة'}
        ]
      });
    }});
  });

  // ── 7. إيراد جلسة مباشرة ──
  (DB.get('cashlog')||[]).forEach(c=>{
    if(c.type !== 'وارد' || !(c.source||'').startsWith('جلسة —')) return;
    const amount = c.amount || 0;
    if(amount <= 0) return;
    const cashCode = (c.method==='فيزا') ? '1120' : '1110';
    const sid = c.sessionPlanId || c.refId || null;
    if(coveredByAmount('session', sid, c.date, amount, cashCode)) return;

    tasks.push({date: c.date || '0000-00-00', run: async ()=>{
      return postJournalEntry({
        date: c.date || new Date().toISOString().split('T')[0],
        description: `[ترحيل] إيراد جلسة: ${c.notes||c.source}`,
        sourceType: 'session', sourceId: sid,
        lines: [
          {accountCode:cashCode, debit:amount, credit:0, description:'تحصيل نقدي — جلسة'},
          {accountCode:'4100', debit:0, credit:amount, description:'إيراد خدمات — جلسة'}
        ]
      });
    }});
  });

  // ── 8. بيع منتج مباشر ──
  (DB.get('cashlog')||[]).forEach(c=>{
    if(c.type !== 'وارد' || !(c.source||'').startsWith('بيع منتج —')) return;
    const amount = c.amount || 0;
    if(amount <= 0) return;
    const cashCode = (c.method==='فيزا') ? '1120' : '1110';
    if(coveredByAmount('product_sale', c.refId, c.date, amount, cashCode)) return;

    tasks.push({date: c.date || '0000-00-00', run: async ()=>{
      return postJournalEntry({
        date: c.date || new Date().toISOString().split('T')[0],
        description: `[ترحيل] إيراد بيع منتج: ${c.notes||c.source}`,
        sourceType: 'product_sale', sourceId: c.refId || null,
        lines: [
          {accountCode:cashCode, debit:amount, credit:0, description:'تحصيل نقدي — بيع منتج'},
          {accountCode:'4200', debit:0, credit:amount, description:'إيراد بيع منتجات'}
        ]
      });
    }});
  });

  // ── 8ب. باقات دخلت الأقساط من "مزامنة الباقات" بدون فاتورة (فجوة قديمة) ──
  // نفس منطق الـ hook الجديد رقم 8ب في 14-accounting-hooks.js، لكن هنا بنلف
  // على installments الموجودة بالفعل (مش حدث لحظي) عشان نغطي أي باقة اتزامنت
  // قبل إضافة الـ hook ولسه مالهاش قيد إيراد/ذمم مسجل.
  (DB.get('installments')||[]).forEach(plan=>{
    if(!plan.fromPkgId) return;
    const amount = plan.total || 0;
    if(amount <= 0) return;

    const hasInvoice = (DB.get('invoices')||[]).some(i => String(i.pkgId) === String(plan.fromPkgId));
    if(hasInvoice) return; // مغطاة بالفعل من بند إيراد الفواتير فوق

    if(hasEntry('package', plan.fromPkgId)) return; // اتغطت قبل كده

    tasks.push({date: plan.startDate || '0000-00-00', run: async ()=>{
      return postJournalEntry({
        date: plan.startDate || new Date().toISOString().split('T')[0],
        description: `[ترحيل] سد فجوة مزامنة باقة: ${plan.service||''} — ${plan.patientName||''}`,
        sourceType: 'package', sourceId: plan.fromPkgId,
        lines: [
          {accountCode:'1130', debit:amount, credit:0, description:'ذمم عميل — باقة (مزامنة)'},
          {accountCode:'4300', debit:0, credit:amount, description:'إيراد باقات (مزامنة)'}
        ]
      });
    }});
  });

  // ── 9. تحصيل أقساط ──
  (DB.get('cashlog')||[]).forEach(c=>{
    if(c.type !== 'وارد' || !(c.source||'').startsWith('دفعة قسط #')) return;
    const amount = c.amount || 0;
    if(amount <= 0) return;
    const cashCode = (c.method==='فيزا') ? '1120' : '1110';
    if(coveredByAmount('installment', c.refId, c.date, amount, cashCode)) return;

    const plan = (DB.get('installments')||[]).find(p=>p.id===c.refId);
    const isLinkedToInvoiceOrPkg = !!(plan && (plan.fromInvId || plan.fromPkgId));
    const creditAccount = isLinkedToInvoiceOrPkg ? '1130' : '4100';
    const creditDesc    = isLinkedToInvoiceOrPkg ? 'من ذمم العميل — قسط' : 'إيراد قسط مستقل';

    tasks.push({date: c.date || '0000-00-00', run: async ()=>{
      return postJournalEntry({
        date: c.date || new Date().toISOString().split('T')[0],
        description: `[ترحيل] تحصيل قسط: ${c.notes||c.source}`,
        sourceType: 'installment', sourceId: c.refId || null,
        lines: [
          {accountCode:cashCode, debit:amount, credit:0, description:'تحصيل نقدي — قسط'},
          {accountCode:creditAccount, debit:0, credit:amount, description:creditDesc}
        ]
      });
    }});
  });

  // ── 10. تسوية باقة كاملة ──
  (DB.get('cashlog')||[]).forEach(c=>{
    if(c.type !== 'وارد' || !(c.source||'').startsWith('تسوية باقة —')) return;
    const amount = c.amount || 0;
    if(amount <= 0) return;
    const cashCode = (c.method==='فيزا') ? '1120' : '1110';
    if(coveredByAmount('package_settlement', c.refId, c.date, amount, cashCode)) return;

    tasks.push({date: c.date || '0000-00-00', run: async ()=>{
      return postJournalEntry({
        date: c.date || new Date().toISOString().split('T')[0],
        description: `[ترحيل] تسوية باقة: ${c.notes||c.source}`,
        sourceType: 'package_settlement', sourceId: c.refId || null,
        lines: [
          {accountCode:cashCode, debit:amount, credit:0, description:'تحصيل نقدي — تسوية باقة'},
          {accountCode:'1130', debit:0, credit:amount, description:'من ذمم العميل — تسوية باقة'}
        ]
      });
    }});
  });

  // ── 11. تصحيحات دفعات الموردين ──
  (DB.get('cashlog')||[]).forEach(c=>{
    if(!(c.source||'').startsWith('تصحيح دفعة مورد —')) return;
    const amount = c.amount || 0;
    if(amount <= 0) return;
    if(coveredByAmount('supplier_payment_correction', c.refId, c.date, amount, c.type==='صادر'?'1110':'2100')) return;

    const isIncrease = c.type === 'صادر';
    tasks.push({date: c.date || '0000-00-00', run: async ()=>{
      return postJournalEntry({
        date: c.date || new Date().toISOString().split('T')[0],
        description: `[ترحيل] تصحيح سداد مورد: ${c.notes||c.source}`,
        sourceType: 'supplier_payment_correction', sourceId: c.refId || null,
        lines: isIncrease
          ? [
              {accountCode:'2100', debit:amount, credit:0, description:'سداد إضافي — تصحيح'},
              {accountCode:'1110', debit:0, credit:amount, description:'من الخزينة'}
            ]
          : [
              {accountCode:'1110', debit:amount, credit:0, description:'استرجاع للخزينة — تصحيح'},
              {accountCode:'2100', debit:0, credit:amount, description:'رجوع لذمم مورد'}
            ]
      });
    }});
  });

  if(tasks.length === 0){
    showToast('info', 'ℹ️ مفيش سجلات محتاجة ترحيل — كل حاجة مغطاة بقيود بالفعل');
    return;
  }

  // ترتيب زمني عشان أرقام القيود (JE-000001...) تطلع بترتيب تاريخ العيادة الحقيقي
  tasks.sort((a,b) => (a.date||'').localeCompare(b.date||''));

  showToast('info', `⏳ جاري ترحيل ${tasks.length} سجل قديم... متسكّرش الصفحة`);

  let posted = 0, failed = 0;
  for(const t of tasks){
    try{
      const r = await t.run();
      if(r) posted++; else failed++;
    }catch(err){
      console.error('[Backfill] فشل ترحيل سجل:', err, t);
      failed++;
    }
  }

  // ══════════════════════════════════════════
  // 🧾 المرحلة 6 — سندات القبض/الصرف التاريخية
  // ✅ بدل ما نربط السند بكل نوع تاسك على حدة (تكرار كبير)، بنعمل مرور عام واحد
  // على *كل* journal_entries المرحّلة (سواء اتولدت دلوقتي أو من الـ hooks الحية
  // قبل ما نضيف توليد السندات فيها) ونطلع سند لأي قيد فيه سطر كاش فعلي (1110/1120)
  // مالوش سند مرتبط بيه لسه. القيود اللي مالهاش سطر كاش (زي استلام مشتريات آجل،
  // أو عكس قيد فاتورة محذوفة) بتتخطى تلقائيًا لأنها مفيهاش حركة كاش حقيقية أصلًا.
  // ══════════════════════════════════════════
  let vouchered = 0;
  const existingVoucherEntryIds = new Set((DB.get('vouchers')||[]).map(v=>String(v.linkedEntryId)));
  const cashCodes = new Set(['1110','1120']);
  const postedEntries = (DB.get('journal_entries')||[]).filter(e=>e.status==='posted' && e.sourceType!=='reversal');
  for(const e of postedEntries){
    if(existingVoucherEntryIds.has(String(e.id))) continue;
    const cashLine = (e.lines||[]).find(l=>cashCodes.has(l.accountCode) && ((l.debit||0)>0 || (l.credit||0)>0));
    if(!cashLine) continue; // مفيش حركة كاش فعلية في القيد ده — مفيش سند مطلوب
    const isReceipt = (cashLine.debit||0) > 0; // مدين كاش = دخول فلوس = قبض؛ دائن كاش = خروج = صرف
    const amount = isReceipt ? cashLine.debit : cashLine.credit;
    try{
      const v = await createVoucher({
        type: isReceipt ? 'receipt' : 'payment',
        date: e.date, amount, linkedEntryId: e.id,
        linkedInvoiceId: e.sourceType==='invoice' ? e.sourceId : null,
        paidTo_or_receivedFrom: (e.description||'').replace(/^\[ترحيل\]\s*/,''),
        method: cashLine.accountCode==='1120' ? 'فيزا' : 'كاش'
      });
      if(v) vouchered++;
    }catch(vErr){ console.error('[Backfill] فشل إنشاء سند تاريخي:', vErr, e); }
  }

  showToast(
    failed ? 'warning' : 'success',
    `✅ تم ترحيل ${posted} قيد و${vouchered} سند بنجاح` + (failed ? ` — فشل ${failed} (تفاصيل الخطأ في الـ console)` : '')
  );

  if(typeof renderJournalEntries === 'function') renderJournalEntries();
  if(typeof renderTrialBalance === 'function') renderTrialBalance();
  if(typeof renderChartOfAccounts === 'function') renderChartOfAccounts();
  if(typeof renderVouchers === 'function') renderVouchers();
}
