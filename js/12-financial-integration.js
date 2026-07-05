// ══════════════════════════════════════════════════════════════════════════════
// 💎 FINANCIAL INTEGRATION MODULE — v1.0
// الوحدة المالية الشاملة — تربط الجلسات بالمخزون والتقارير والداشبورد
// ══════════════════════════════════════════════════════════════════════════════
//
// هذه الوحدة تُكمل المتطلبات التالية:
//  1. حساب تكلفة المواد الفعلية عند إتمام الجلسة
//  2. حساب ربح الجلسة الفعلي
//  3. تحديث تكلفة وربح الباقة من الجلسات المكتملة
//  4. حساب ربح الباقة = سعر البيع - إجمالي التكلفة الفعلية
//  5. خصم المخزون مرة واحدة فقط عند تغيير الحالة إلى مكتمل
//  6. استخدام آخر سعر شراء للمنتجات في الجلسات الجديدة (التاريخية محمية)
//  7. تحديث التقارير المالية تلقائياً بعد كل جلسة مكتملة
//  8. تحديث الداشبورد تلقائياً
//  9. منع التكرار في الخصم والحسابات
// 10. التزامن الكامل بين جميع الوحدات
// ══════════════════════════════════════════════════════════════════════════════

// ── حماية: تشغيل مرة واحدة فقط ──
if (window._financialIntegrationLoaded) {
  console.warn('[FinancialIntegration] Already loaded — skipping');
} else {
  window._financialIntegrationLoaded = true;

// ════════════════════════════════════════════════════════
// §1. GUARD: منع الخصم المزدوج من المخزون
// ════════════════════════════════════════════════════════
// نحتفظ بـ Set من معرّفات الجلسات المكتملة التي تم خصمها
// (يُحمَّل من DB عند البدء ويُحدَّث مع كل خصم جديد)

function _getDeductedSet() {
  try {
    const raw = localStorage.getItem('_inv_deducted_sessions');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch(e) { return new Set(); }
}

function _markDeducted(key) {
  try {
    const set = _getDeductedSet();
    set.add(key);
    localStorage.setItem('_inv_deducted_sessions', JSON.stringify([...set]));
  } catch(e) {}
}

function _isDeducted(key) {
  return _getDeductedSet().has(key);
}

// ════════════════════════════════════════════════════════
// §2. تكلفة المواد الفعلية للجلسة (بآخر سعر شراء)
// ════════════════════════════════════════════════════════

function _calcActualSessionCost(serviceId) {
  if (!serviceId || typeof calcServiceMaterialCost !== 'function') return 0;
  // calcServiceMaterialCost تستخدم item.cost || item.lastPurchasePrice
  // وهو دائماً محدَّث بآخر مشتريات من purchases:updated
  return calcServiceMaterialCost(serviceId);
}

// ════════════════════════════════════════════════════════
// §3. تسجيل إتمام الجلسة مع كامل البيانات المالية
// ════════════════════════════════════════════════════════
// هذه الدالة الأساسية تُستدعى من addSessionProgress و usePackageSession

function _recordSessionCompletion({ sessionPlanId, pkgId, patId, patName,
  serviceId, serviceName, sessionNo, sessionTotal, revenue, date }) {

  const deductKey = pkgId
    ? `pkg:${pkgId}:sess:${sessionNo}`
    : `sess:${sessionPlanId}:no:${sessionNo}`;

  // ── §5: منع الخصم المزدوج ──
  const alreadyDeducted = _isDeducted(deductKey);

  // ── §1: حساب التكلفة الفعلية الآن (بآخر سعر شراء) ──
  const actualMaterialCost = _calcActualSessionCost(serviceId);
  const actualProfit = (revenue || 0) - actualMaterialCost;

  // ── §5: خصم المخزون مرة واحدة فقط ──
  let actualDeductedCost = 0; // ✅ التكلفة الفعلية للمواد المخصومة فعليًا من المخزون (لقيد COGS)
  if (!alreadyDeducted) {
    if (typeof deductInventory === 'function' && serviceId) {
      actualDeductedCost = deductInventory(serviceId, 1) || 0;
    }
    _markDeducted(deductKey);
  }

  // ── §1-2: تسجيل إتمام الجلسة مع بيانات مالية كاملة ──
  const completionRecord = {
    sessionPlanId: sessionPlanId || null,
    pkgId: pkgId || null,
    patId, patName,
    serviceId, serviceName,
    sessionNo, sessionTotal: sessionTotal || 0,
    date: date || new Date().toISOString().split('T')[0],
    revenue: revenue || 0,
    actualMaterialCost,
    actualProfit,
    inventoryDeducted: !alreadyDeducted,
    cogsAmount: alreadyDeducted ? 0 : actualDeductedCost, // ✅ للاستخدام في قيد COGS (14-accounting-hooks.js)
    _protected: true  // يمنع التعديل اليدوي
  };

  DB.push('session_completions', completionRecord);

  // ── §3: تحديث إجماليات خطة الجلسات ──
  if (sessionPlanId) {
    _updateSessionPlanFinancials(sessionPlanId);
  }

  // ── §3-4: تحديث إجماليات الباقة ──
  if (pkgId) {
    _updatePackageFinancials(pkgId);
  }

  // ── §7: تحديث السجل المالي اليومي/الشهري ──
  // ✅ ملاحظة (مشكلة #5): هذا مسار منفصل عن مسار الفاتورة العادية (invoices:created)
  // وهذا مقصود — إيراد "خطة جلسات" (sessionPlanId) مختلف عن إيراد فاتورة كشف عادية،
  // ولا يوجد تداخل بينهما لأن هذا الشرط يعمل فقط لو !pkgId (الباقات لا تُسجَّل إيراد هنا أصلاً).
  // أما تسجيل إتمام الجلسة عبر finalizeConsultation (في _patchFinalizeConsultation أسفل
  // هذا الملف) فلا يكتب لـ cashlog بنفسه إطلاقاً — يعتمد على أن الفاتورة الأصلية
  // أنشأت قيد الخزينة تلقائياً عبر invoices:created، فلا يوجد ازدواج هناك.
  if (!pkgId && (revenue || 0) > 0) {
    // refId موحَّد مع اتفاقية الحارس المركزي في DB.push (00-core.js) لمنع التكرار
    // تلقائياً من أي مصدر، بدل الاعتماد فقط على الفحص اليدوي هنا
    const sessionRefId = `sesscomp:${sessionPlanId || patId}:${sessionNo}`;
    const existing = (DB.get('cashlog') || []).find(c =>
      c.refType === 'session_completion' &&
      c.sessionPlanId === sessionPlanId &&
      c.sessionNo === sessionNo
    );
    if (!existing) {
      DB.push('cashlog', {
        type: 'وارد',
        source: `جلسة — ${patName}`,
        amount: revenue,
        method: 'كاش',
        date: completionRecord.date,
        notes: `جلسة ${sessionNo}/${sessionTotal || '?'}: ${serviceName || '—'}`,
        refType: 'session_completion',
        refId: sessionRefId,
        sessionPlanId,
        sessionNo,
        patId
      });
    }
  }

  // ── §8: تحديث الداشبورد والتقارير ──
  _triggerFullSync();

  return { actualMaterialCost, actualProfit, inventoryDeducted: !alreadyDeducted };
}

// ════════════════════════════════════════════════════════
// §3. تحديث الإجماليات المالية لخطة الجلسات
// ════════════════════════════════════════════════════════

function _updateSessionPlanFinancials(sessionPlanId) {
  if (!sessionPlanId) return;
  const completions = (DB.get('session_completions') || [])
    .filter(c => c.sessionPlanId === sessionPlanId);

  const totalMaterialCost = completions.reduce((s, c) => s + (c.actualMaterialCost || 0), 0);
  const totalRevenue      = completions.reduce((s, c) => s + (c.revenue || 0), 0);
  const totalProfit       = completions.reduce((s, c) => s + (c.actualProfit || 0), 0);
  const sessionsCompleted = completions.length;

  const plan = (DB.get('sessions') || []).find(s => s.id === sessionPlanId);
  if (!plan) return;

  const sessionsRemaining = Math.max(0, (plan.total || 0) - sessionsCompleted);

  DB.upd('sessions', sessionPlanId, {
    actualTotalMaterialCost: totalMaterialCost,
    actualTotalRevenue:      totalRevenue,
    actualTotalProfit:       totalProfit,
    sessionsCompleted,
    sessionsRemaining
  });
}

// ════════════════════════════════════════════════════════
// §4. تحديث الإجماليات المالية للباقة
// ════════════════════════════════════════════════════════

function _updatePackageFinancials(pkgId) {
  if (!pkgId) return;
  const pkg = (DB.get('packages') || []).find(p => p.id === pkgId);
  if (!pkg) return;

  const completions = (DB.get('session_completions') || [])
    .filter(c => c.pkgId === pkgId);

  const totalMaterialCost = completions.reduce((s, c) => s + (c.actualMaterialCost || 0), 0);
  const sessionsCompleted = completions.length;
  const sessionsRemaining = Math.max(0, (pkg.sessionsCount || 0) - sessionsCompleted);

  // §4: ربح الباقة = سعر البيع - إجمالي التكلفة الفعلية
  const sellingPrice  = (pkg.price || 0) - (pkg.discount || 0);
  const actualProfit  = sellingPrice - totalMaterialCost;

  DB.upd('packages', pkgId, {
    actualTotalMaterialCost: totalMaterialCost,
    actualSessionsCompleted: sessionsCompleted,
    actualSessionsRemaining: sessionsRemaining,
    actualProfit,
    sellingPrice
  });
}

// ════════════════════════════════════════════════════════
// §7-8. تحديث شامل: التقارير + الداشبورد
// ════════════════════════════════════════════════════════

function _triggerFullSync() {
  // أخبر EventBus بالتحديث — يُشغِّل _scheduleUIRefresh تلقائياً
  EventBus.emit('session_completions:created', {});

  // إجبار تحديث الداشبورد إذا كان نشطاً
  setTimeout(() => {
    if (typeof buildDashboard === 'function') {
      const active = document.querySelector('.screen.active')?.id;
      if (active === 'screen-dashboard' || active === 'screen-reports') {
        buildDashboard();
      }
    }
    if (typeof renderReports === 'function') {
      const active = document.querySelector('.screen.active')?.id;
      if (active === 'screen-reports') renderReports();
    }
  }, 200);
}

// ════════════════════════════════════════════════════════
// §7. إضافة تكاليف الجلسات إلى حسابات الربح في التقارير
// ════════════════════════════════════════════════════════
// نعيد كتابة renderReports لتشمل تكلفة مواد الجلسات

(function _patchRenderReports() {
  const _orig = window.renderReports;
  if (!_orig) return;

  window.renderReports = function() {
    // شغّل الأصلي أولاً
    _orig.apply(this, arguments);

    // ثم أضف بطاقة تكاليف الجلسات
    const el = document.getElementById('reports-kpi-bar');
    if (!el) return;

    const completions = DB.get('session_completions') || [];
    const today       = new Date().toISOString().split('T')[0];
    const thisMonth   = today.substring(0, 7);

    const monthCompletions = completions.filter(c => (c.date || '').startsWith(thisMonth));
    const monthSessionCost = monthCompletions.reduce((s, c) => s + (c.actualMaterialCost || 0), 0);
    const monthSessionRev  = monthCompletions.reduce((s, c) => s + (c.revenue || 0), 0);
    const monthSessionProfit = monthCompletions.reduce((s, c) => s + (c.actualProfit || 0), 0);
    const totalSessionsDone  = monthCompletions.length;

    if (totalSessionsDone === 0) return; // لا جلسات → لا نضيف بطاقة

    // أضف بطاقات الجلسات بعد الـ KPI البار الحالي
    const sessionCard = document.createElement('div');
    sessionCard.id = 'reports-session-kpi';
    sessionCard.style.cssText = 'margin-top:16px;padding:14px;background:var(--glass);border-radius:12px;border:1px solid var(--glass-border);';
    sessionCard.innerHTML = `
      <div style="font-size:13px;font-weight:800;margin-bottom:10px;color:var(--text-secondary);">
        🔬 تكاليف وأرباح الجلسات — ${thisMonth}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;">
        <div class="kpi-card kc-purple">
          <div class="kpi-icon">🗓</div>
          <div class="kpi-value">${totalSessionsDone}</div>
          <div class="kpi-label">جلسات مكتملة</div>
        </div>
        <div class="kpi-card kc-teal">
          <div class="kpi-icon">💰</div>
          <div class="kpi-value">${monthSessionRev.toLocaleString()} ج</div>
          <div class="kpi-label">إيراد الجلسات</div>
        </div>
        <div class="kpi-card kc-rose">
          <div class="kpi-icon">📦</div>
          <div class="kpi-value">${monthSessionCost.toLocaleString()} ج</div>
          <div class="kpi-label">تكلفة مواد الجلسات</div>
        </div>
        <div class="kpi-card ${monthSessionProfit >= 0 ? 'kc-emerald' : 'kc-amber'}">
          <div class="kpi-icon">📈</div>
          <div class="kpi-value">${(monthSessionProfit >= 0 ? '+' : '') + monthSessionProfit.toLocaleString()} ج</div>
          <div class="kpi-label">صافي ربح الجلسات</div>
        </div>
      </div>`;

    // أزل البطاقة القديمة لو موجودة وأضف الجديدة
    const old = document.getElementById('reports-session-kpi');
    if (old) old.remove();
    el.parentNode.insertBefore(sessionCard, el.nextSibling);
  };
})();

// ════════════════════════════════════════════════════════
// §8. تحديث buildDashboard لإضافة تكاليف الجلسات
// ════════════════════════════════════════════════════════

(function _patchBuildDashboard() {
  const _orig = window.buildDashboard;
  if (!_orig) return;

  window.buildDashboard = function() {
    _orig.apply(this, arguments);

    // إضافة KPI تكاليف الجلسات في الداشبورد
    const today     = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);
    const completions = DB.get('session_completions') || [];
    const todayComp   = completions.filter(c => c.date === today);
    const monthComp   = completions.filter(c => (c.date || '').startsWith(thisMonth));

    const todayMatCost   = todayComp.reduce((s, c) => s + (c.actualMaterialCost || 0), 0);
    const todayProfit    = todayComp.reduce((s, c) => s + (c.actualProfit || 0), 0);
    const monthMatCost   = monthComp.reduce((s, c) => s + (c.actualMaterialCost || 0), 0);
    const monthSessions  = monthComp.length;

    // تحديث KPI المخصصة لو وُجدت
    const _t = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    _t('kpi-session-cost',     todayMatCost.toLocaleString()  + ' ج');
    _t('kpi-session-profit',   todayProfit.toLocaleString()   + ' ج');
    _t('kpi-month-mat-cost',   monthMatCost.toLocaleString()  + ' ج');
    _t('kpi-month-sessions',   monthSessions);
  };
})();

// ════════════════════════════════════════════════════════
// §5. إعادة كتابة addSessionProgress مع ضمان الحماية الكاملة
// ════════════════════════════════════════════════════════

(function _patchAddSessionProgress() {
  const _orig = window.addSessionProgress;
  if (!_orig) return;

  window.addSessionProgress = function(id) {
    const s = (DB.get('sessions') || []).find(x => x.id === id);
    if (!s) return;
    if ((s.done || 0) >= (s.total || 0)) {
      showToast('warning', '⚠️ اكتملت كل الجلسات المقررة');
      return;
    }

    const newDone  = (s.done || 0) + 1;
    const newStatus = newDone >= (s.total || 0) ? 'مكتملة' : (s.status || 'جارية');
    const today    = new Date().toISOString().split('T')[0];

    // تحديث الجلسة أولاً
    DB.upd('sessions', id, { done: newDone, status: newStatus });

    const svc = (DB.get('services') || []).find(x =>
      x.id === s.serviceId || x.name === s.service
    );

    // §1-2-5: تسجيل الإتمام مع خصم المخزون وحسابات مالية كاملة
    const result = _recordSessionCompletion({
      sessionPlanId: id,
      pkgId: null,
      patId: s.patId,
      patName: s.patName || '',
      serviceId: svc?.id || s.serviceId || null,
      serviceName: svc?.name || s.service || s.type || '—',
      sessionNo: newDone,
      sessionTotal: s.total || 0,
      revenue: s.price || 0,
      date: today
    });

    // إشعار للمستخدم
    const profitStr = result.actualProfit !== undefined
      ? ` · ربح: ${result.actualProfit.toFixed(1)} ج` : '';
    showToast(
      'success',
      `✅ تم تسجيل الجلسة ${newDone} من ${s.total || '?'}`,
      newStatus === 'مكتملة'
        ? `🎉 اكتملت خطة الجلسات!${profitStr}`
        : `تكلفة المواد: ${result.actualMaterialCost?.toFixed(1) || 0} ج${profitStr}`
    );

    if (typeof renderSessions === 'function') renderSessions();
  };
})();

// ════════════════════════════════════════════════════════
// §5. إعادة كتابة usePackageSession مع ضمان الحماية
// ════════════════════════════════════════════════════════

(function _patchUsePackageSession() {
  const _orig = window.usePackageSession;
  if (!_orig) return;

  window.usePackageSession = function(pkgId) {
    const pkg = (DB.get('packages') || []).find(p => p.id === pkgId);
    if (!pkg) return;

    const sessUsed  = pkg.sessionsUsed || 0;
    const sessTotal = pkg.sessionsCount || 0;
    if (sessUsed >= sessTotal) {
      showToast('warning', '⚠️ اكتملت كل جلسات هذه الباقة');
      return;
    }

    const remaining = sessTotal - sessUsed - 1;
    if (!confirm(
      `تسجيل جلسة للعميل: ${pkg.patName}\n` +
      `الباقة: ${pkg.name}\n` +
      `الجلسة: ${sessUsed + 1} من ${sessTotal}\n` +
      `المتبقي بعد هذه الجلسة: ${remaining} جلسة`
    )) return;

    const newUsed   = sessUsed + 1;
    const newStatus = remaining <= 0 ? 'منتهية' : 'نشطة';
    const today     = new Date().toISOString().split('T')[0];

    // تحديث الباقة أولاً
    DB.upd('packages', pkgId, { sessionsUsed: newUsed, status: newStatus });

    // الخدمة المرتبطة بالباقة
    const svcIds = pkg.serviceIds || [];
    // استخدم أول خدمة في الباقة (أو آخر واحدة بحسب الترتيب)
    const svcId  = svcIds[0] || pkg.serviceId || null;
    const svc    = svcId ? (DB.get('services') || []).find(s => s.id === svcId) : null;

    // ✅ FIX (نفس باج "ربح الجلسات اليوم" في _patchFinalizeConsultation أعلاه):
    // تسجيل الإيراد كـ 0 هنا كان يخلي كل جلسة باقة تُسجَّل من هذا الزر تظهر
    // كخسارة صافية (تكلفة مواد فقط بدون أي إيراد مقابل) في KPI "تكلفة/ربح
    // الجلسات اليوم" بالداشبورد والتقارير رغم إن العميل دفع مقدَّمًا. نستخدم
    // نصيب الجلسة من سعر بيع الباقة (نفس منطق pkgSessionValue في finalizeConsultation)
    // بدل الصفر، عشان الأرقام تتطابق في كل شاشات التطبيق.
    const pkgSessionValue = Math.max(0, ((pkg.price || 0) - (pkg.discount || 0)) / (sessTotal || 1));

    // §1-2-3-4-5: تسجيل الإتمام مع كامل الحسابات
    const result = _recordSessionCompletion({
      sessionPlanId: null,
      pkgId,
      patId: pkg.patId,
      patName: pkg.patName || '',
      serviceId: svc?.id || svcId,
      serviceName: svc?.name || pkg.services || pkg.name || '—',
      sessionNo: newUsed,
      sessionTotal: sessTotal,
      revenue: pkgSessionValue, // نصيب الجلسة من سعر الباقة المدفوع مقدماً — بدل 0
      date: today
    });

    const profitStr = remaining <= 0 && pkg.actualProfit !== undefined
      ? `\nصافي ربح الباقة: ${((DB.get('packages') || []).find(p => p.id === pkgId)?.actualProfit || 0).toFixed(1)} ج`
      : '';

    const msg = remaining <= 0
      ? `🎉 اكتملت جميع جلسات باقة "${pkg.name}"${profitStr}`
      : remaining === 1
      ? `⚠️ تبقّت جلسة أخيرة فقط من باقة "${pkg.name}"!`
      : `✅ تم تسجيل الجلسة ${newUsed}/${sessTotal} — متبقي: ${remaining} جلسة\nتكلفة المواد: ${result.actualMaterialCost?.toFixed(1) || 0} ج`;

    showToast(remaining <= 0 ? 'info' : remaining === 1 ? 'warning' : 'success', msg);

    if (typeof renderPackages === 'function') renderPackages();
  };
})();

// ════════════════════════════════════════════════════════
// §9. منع إتمام الجلسة أكثر من مرة في finalizeConsultation
// ════════════════════════════════════════════════════════

(function _patchFinalizeConsultation() {
  const _orig = window.finalizeConsultation;
  if (!_orig) return;

  window.finalizeConsultation = function() {
    const apptId = document.getElementById('cd-appt-id')?.value;
    if (!apptId) { _orig.apply(this, arguments); return; }

    const a = (DB.get('appointments') || []).find(x => x.id === apptId);
    if (!a) { _orig.apply(this, arguments); return; }

    // §9: منع إتمام الموعد أكثر من مرة
    if (a.status === 'مكتمل') {
      showToast('warning', '⚠️ هذا الموعد مكتمل بالفعل — لا يمكن تكرار الإتمام');
      closeModal?.('consult-done-modal');
      return;
    }

    // احفظ خصائص الموعد قبل الاستدعاء الأصلي
    const svcSel   = document.getElementById('cd-svc');
    const svcName  = svcSel?.options[svcSel?.selectedIndex]?.value || a.service || '';
    const price    = parseFloat(document.getElementById('cd-price')?.value) || 0;
    const disc     = parseFloat(document.getElementById('cd-disc')?.value) || 0;
    const net      = Math.max(0, price - disc);
    const today    = new Date().toISOString().split('T')[0];

    // ✅ FIX: نحدد هل الجلسة مغطاة بباقة *قبل* استدعاء الدالة الأصلية
    // لأن الدالة الأصلية بتخصم جلسة من الباقة (deductPackageSession) وقد تجعل
    // حالتها "منتهية" فوراً لو كانت آخر جلسة — وهو ما كان يُفقد اكتشاف التغطية
    // ويُسجّل آخر جلسة من كل باقة كإيراد إضافي وهمي بدل خصم من رصيد الباقة المدفوع مقدماً.
    const activePkgBefore = typeof getPatientActivePackage === 'function'
      ? getPatientActivePackage(a.patId) : null;
    const coveredByPkg = activePkgBefore &&
      (!activePkgBefore.services || !activePkgBefore.services.trim() ||
       activePkgBefore.services.includes(svcName));
    const coveredPkgId = coveredByPkg ? activePkgBefore.id : null;
    // ✅ FIX (باج: "ربح الجلسات (اليوم)" في الداشبورد يظهر خسارة وهمية):
    // كانت الجلسات المغطاة بباقة تُسجَّل هنا بإيراد=0 دائماً (لأن الفاتورة
    // المرتبطة بها paid=0 فعلاً، تفاديًا لازدواج الإيراد). لكن العميل بالفعل
    // دفع مقدَّمًا وقت شراء الباقة، ونصيب هذه الجلسة تحديدًا من سعر البيع هو
    // نفس القيمة (pkgSessionValue) المحسوبة والمخزَّنة فعليًا في invoice.sessionValue
    // (راجع 07-clinical.js → finalizeConsultation) والتي تعتمد عليها بالفعل
    // لوحة "أفضل الأطباء" في الداشبورد (buildTopDoctors، 01-app.js). استخدام
    // 0 هنا بدل هذه القيمة كان يخلي كل جلسة ضمن باقة تظهر كخسارة صافية
    // (تكلفة المواد فقط، بلا أي إيراد مقابل) في KPI "تكلفة/ربح الجلسات اليوم"
    // بالداشبورد والتقارير، رغم إن ربح الباقة الفعلي (سعر البيع − التكلفة)
    // موجب. نستخدم نفس منطق نصيب الجلسة من سعر الباقة لضمان تطابق الأرقام
    // في كل شاشات التطبيق.
    const pkgSessionValue = coveredByPkg
      ? Math.max(0, ((activePkgBefore.price || 0) - (activePkgBefore.discount || 0)) / (activePkgBefore.sessionsCount || 1))
      : 0;

    // استدعاء الدالة الأصلية (تتولى الفاتورة + خصم المخزون + خصم جلسة الباقة)
    _orig.apply(this, arguments);

    // §1-2: سجّل إتمام الجلسة مع الحسابات المالية في session_completions
    // (بدون خصم مخزون مجدداً — الأصلية خصمت المخزون بالفعل)
    const svcRecord = (DB.get('services') || []).find(s =>
      s.name === svcName || s.id === a.serviceId
    );

    const deductKey = `appt:${apptId}`;
    _markDeducted(deductKey);

    // نسجّل في session_completions فقط إذا لم يكن هناك سجل مسبق
    const alreadyRecorded = (DB.get('session_completions') || [])
      .some(c => c.apptId === apptId);

    if (!alreadyRecorded) {
      const actualMaterialCost = _calcActualSessionCost(svcRecord?.id || a.serviceId);
      // ✅ FIX: الإيراد الحقيقي للجلسة = نصيبها من سعر الباقة لو مغطاة بباقة،
      // أو صافي سعر الفاتورة العادي لو مش مغطاة — بدل تصفير الإيراد دايمًا
      // للجلسات المغطاة بباقة (راجع شرح الفكس فوق عند تعريف pkgSessionValue).
      const sessionRevenue     = coveredByPkg ? pkgSessionValue : net;
      const actualProfit       = sessionRevenue - actualMaterialCost;

      DB.push('session_completions', {
        apptId,
        sessionPlanId: null,
        pkgId: coveredPkgId,
        patId: a.patId,
        patName: a.patient || '',
        serviceId: svcRecord?.id || a.serviceId || null,
        serviceName: svcName || '—',
        sessionNo: 1,
        date: today,
        revenue: sessionRevenue,
        actualMaterialCost,
        actualProfit,
        inventoryDeducted: true,
        _protected: true
      });

      // §4: تحديث الباقة إذا كانت الجلسة مغطاة (حتى لو أصبحت الآن "منتهية")
      if (coveredPkgId) {
        _updatePackageFinancials(coveredPkgId);
      }

      // §8: تحديث الداشبورد والتقارير
      _triggerFullSync();
    }
  };
})();

// ════════════════════════════════════════════════════════
// §6. تحديث تكاليف خطط الجلسات عند تغيير سعر الشراء
// (البيانات التاريخية محمية — لا نعدّل session_completions القديمة)
// ════════════════════════════════════════════════════════

EventBus.on('purchases:updated', function(purchase) {
  if (purchase.status !== 'مستلم') return;
  // الجلسات المستقبلية ستستخدم السعر الجديد تلقائياً
  // عبر calcServiceMaterialCost → item.cost || item.lastPurchasePrice
  // لا نفعل شيئاً هنا — البيانات التاريخية محمية بـ _protected:true
  // نُحدِّث فقط معاينة تكاليف الخدمات في النموذج
  setTimeout(() => {
    if (typeof calcSessFinancials === 'function') {
      const svcSel = document.getElementById('sess-service-id');
      if (svcSel?.value) calcSessFinancials();
    }
    if (typeof calcPkgProfitPreview === 'function') {
      const el = document.getElementById('pkg-modal');
      if (el && !el.classList.contains('hidden')) calcPkgProfitPreview();
    }
  }, 300);
});

// ════════════════════════════════════════════════════════
// §10. EventBus: session_completions → تحديث الداشبورد والتقارير
// ════════════════════════════════════════════════════════

EventBus.on('session_completions:created', function() {
  if (typeof _scheduleUIRefresh === 'function') {
    _scheduleUIRefresh('sessions');
    _scheduleUIRefresh('cashlog');
    _scheduleUIRefresh('inventory');
  }
});

// ════════════════════════════════════════════════════════
// §7. دالة مساعدة: ملخص مالي للجلسات المكتملة (للتقارير)
// ════════════════════════════════════════════════════════

window.getSessionFinancialSummary = function(filter) {
  const completions = DB.get('session_completions') || [];
  const filtered = filter ? completions.filter(filter) : completions;
  return {
    count:             filtered.length,
    totalRevenue:      filtered.reduce((s, c) => s + (c.revenue || 0), 0),
    totalMaterialCost: filtered.reduce((s, c) => s + (c.actualMaterialCost || 0), 0),
    totalProfit:       filtered.reduce((s, c) => s + (c.actualProfit || 0), 0)
  };
};

// ════════════════════════════════════════════════════════
// §10. إعادة حساب إجماليات الباقات النشطة عند التحميل
// (تصحيح بيانات موجودة قد تكون ناقصة)
// ════════════════════════════════════════════════════════

(function _recalcExistingPackagesOnLoad() {
  try {
    const pkgs = DB.get('packages') || [];
    const completions = DB.get('session_completions') || [];
    pkgs.forEach(pkg => {
      const pkgCompletions = completions.filter(c => c.pkgId === pkg.id);
      if (pkgCompletions.length > 0 && pkg.actualTotalMaterialCost == null) {
        _updatePackageFinancials(pkg.id);
      }
    });

    const plans = DB.get('sessions') || [];
    plans.forEach(plan => {
      const planCompletions = completions.filter(c => c.sessionPlanId === plan.id);
      if (planCompletions.length > 0 && plan.actualTotalMaterialCost == null) {
        _updateSessionPlanFinancials(plan.id);
      }
    });
  } catch(e) {
    console.warn('[FinancialIntegration] Recalc on load error:', e);
  }
})();

// ════════════════════════════════════════════════════════
// تم تحميل الوحدة
// ════════════════════════════════════════════════════════
console.log('✅ [FinancialIntegration] Module loaded — v1.0');

} // end of guard block
