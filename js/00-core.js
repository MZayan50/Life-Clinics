const CLINIC_LOGO_URI='data:image/jpeg;base64,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';
function clinicLogoHTML(size){size=size||34;return `<img src="${CLINIC_LOGO_URI}" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:8px;flex-shrink:0;" alt="logo">`;}

// ══════════════════════════════════════════════════════════════════
// 🏥 CLINIC CORE — v4.0  (Event-Driven Architecture)
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
// 🛠️ SHARED HELPERS
// ══════════════════════════════════════════
function gv(id){ return document.getElementById(id)?.value || ''; }

// ══════════════════════════════════════════
// 🔑 UUID GENERATOR — v4 compliant
// ══════════════════════════════════════════
function genUUID(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ══════════════════════════════════════════
// 🗄️ AUDIT HELPERS
// ══════════════════════════════════════════
function _now(){ return new Date().toISOString(); }
function _currentUser(){
  // الـ cache (Firestore) هو المصدر الوحيد — localStorage fallback فقط لو offline
  try{
    const s = (DB && DB._cache && DB._cache['settings'])
      || (!window._fbReady ? JSON.parse(localStorage.getItem('ha_settings')||'{}') : {});
    return s.managerName || 'النظام';
  }
  catch{ return 'النظام'; }
}
function _audit(extra = {}){
  const u = _currentUser();
  return { createdAt: _now(), updatedAt: _now(), createdBy: u, updatedBy: u,
           isDeleted: false, deletedAt: null, deletedBy: null, version: 1, ...extra };
}

// ══════════════════════════════════════════
// 📡 EVENT BUS — نظام الأحداث المركزي
// ══════════════════════════════════════════
// الاستخدام:
//   EventBus.on('invoices:saved', handler)
//   EventBus.emit('invoices:saved', { invoice, patient })
//   EventBus.off('invoices:saved', handler)
// ══════════════════════════════════════════
const EventBus = (function(){
  const _listeners = {};
  const _lastValue = {};
  const _hasValue  = {};
  return {
    // opts.replay=true → إذا كان الحدث قد أُطلق من قبل (قبل تسجيل هذا المستمع)،
    // يُستدعى المستمع فوراً بآخر قيمة محفوظة. هذا يحل مشكلة ترتيب تحميل الملفات
    // بدل الاعتماد على متغيرات stub/pending عامة (window._pendingX).
    on(event, fn, opts){
      if(!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(fn);
      if(opts && opts.replay && _hasValue[event]){
        try{ fn(_lastValue[event]); } catch(e){ console.error('[EventBus]', event, e); }
      }
    },
    off(event, fn){
      if(!_listeners[event]) return;
      _listeners[event] = _listeners[event].filter(f => f !== fn);
    },
    emit(event, data){
      _lastValue[event] = data; _hasValue[event] = true;
      if(!_listeners[event]) return;
      _listeners[event].forEach(fn => { try{ fn(data); } catch(e){ console.error('[EventBus]', event, e); } });
    }
  };
})();

// ══════════════════════════════════════════
// 🗃️ DB LAYER — Firestore PRIMARY · localStorage OFFLINE FALLBACK
// ══════════════════════════════════════════
// المبدأ الجديد:
//   • Firestore هو مصدر الحقيقة الوحيد
//   • _cache يُحدَّث من onSnapshot (realtime listener)
//   • localStorage يُستخدم فقط عند انقطاع الإنترنت
//   • أي كتابة (push/upd/del) تروح لـ Firestore مباشرة
//     وفي حالة Offline تُخزَّن في OQ وترسل تلقائياً عند عودة الاتصال
// بعد كل عملية يُطلق حدث تلقائي:
//   push  → '{collection}:created'
//   upd   → '{collection}:updated'
//   del   → '{collection}:deleted'
// ══════════════════════════════════════════
const DB = {
  _fb: [
    'patients', 'appointments', 'inventory', 'invoices', 'invoice_items',
    'services', 'leads', 'doctors', 'staff', 'expenses', 'branches',
    'campaigns', 'packages', 'sessions', 'waitlist', 'rooms', 'equipment',
    'suppliers', 'purchases', 'purchase_items', 'supplier_payments', 'visits',
    'inventory_transactions', 'audit_log', 'transfers',
    'photos', 'installments', 'cashlog', 'advances', 'product_sales',
    // ✅ FIX (مراجعة شاملة): كانت غائبة بالكامل عن هذه القائمة، فكل بيانات
    // تكلفة/ربح الجلسات (session_completions) لم تكن تُكتب إلى Firestore إطلاقاً —
    // محفوظة في الذاكرة المحلية فقط وتختفي نهائياً عند أي إعادة تحميل للصفحة.
    'session_completions',
    // ✅ FIX (نظام الاستدعاء): call_queue كانت غائبة عن هذه القائمة، فـ DB.push/DB.upd
    // كانا يحدّثان الـ cache المحلي فقط (Optimistic UI) ولا ينفذان fbSet() إطلاقاً.
    // النتيجة: الاستدعاء يظهر فورًا على نفس الجهاز/الجلسة اللي عملته (لأن الكاش
    // المحلي اتحدث)، لكنه لا يصل إلى Firestore أبداً، فأي جهاز آخر (يعتمد فقط على
    // onSnapshot) لا يرى الاستدعاء مطلقاً — حتى بعد إصلاح firestore.rules.
    'call_queue'
  ],

  // ── In-memory cache: Firestore data lives here ──
  _cache: {},

  // ── Load from cache (Firestore data) ──
  // لو Firestore متصل → الـ cache هو المصدر الوحيد (لا قراءة من localStorage)
  // لو offline → localStorage كـ fallback مؤقت فقط
  get(k){
    if (DB._cache[k]) return DB._cache[k];
    // Firestore متصل لكن الـ cache فاضي بعد → ارجع array فاضية (لا تقرأ من localStorage)
    if (window._fbReady) return [];
    // Offline fallback فقط
    try { return JSON.parse(localStorage.getItem('ha_' + k)) || []; }
    catch { return []; }
  },
  obj(k){
    if (DB._cache[k] && !Array.isArray(DB._cache[k])) return DB._cache[k];
    if (window._fbReady) return {};
    // Offline fallback فقط
    try { return JSON.parse(localStorage.getItem('ha_' + k)) || {}; }
    catch { return {}; }
  },

  // ── Internal: update cache (+ localStorage كـ offline backup فقط) ──
  set(k, v){
    DB._cache[k] = v;
    // localStorage: يُحدَّث فقط لو offline — لو Firestore متصل، onSnapshot هو اللي يحدّثه
    if(!window._fbReady){
      try { localStorage.setItem('ha_' + k, JSON.stringify(v)); } catch(e){}
    }
  },

  push(k, o){
    if (!o.id) o.id = genUUID();
    if (!o.createdAt) Object.assign(o, _audit());

    // ✅ FIX (مشكلة #3): حارس مركزي ضد تكرار قيود الخزينة — بغض النظر عن المسار
    // الذي أنشأ القيد (فاتورة، تحصيل، باقة، جلسة...). كانت هناك عدة مسارات منفصلة
    // تكتب لـ cashlog بشروط منع تكرار مختلفة عن بعضها، فيحدث أحيانًا قيد مزدوج
    // (وهو سبب الحاجة لزر "تنظيف التكرار" اليدوي في شاشة الخزينة).
    // القاعدة: لو القيد له refId، ونفس refId + source + amount + date مسجّل
    // بالفعل في cashlog، نتجاهل الإضافة الجديدة ونرجّع القيد الموجود.
    if(k === 'cashlog' && o.refId){
      const existing = DB.get('cashlog').find(c =>
        String(c.refId) === String(o.refId) &&
        c.source === o.source &&
        (c.amount || 0) === (o.amount || 0) &&
        c.date === o.date
      );
      if(existing){
        console.warn('[DB.push] تم تجاهل قيد خزينة مكرر:', o);
        return existing;
      }
    }

    // Update local cache immediately (optimistic UI)
    const a = DB.get(k);
    a.push(o);
    DB.set(k, a);
    // Write to Firestore (or queue if offline)
    if (DB._fb.includes(k)) fbSet(k, o.id, o);
    EventBus.emit(k + ':created', o);
    EventBus.emit('db:changed', { collection: k, action: 'created', record: o });
    return o;
  },

  upd(k, id, d){
    const a = DB.get(k);
    const i = a.findIndex(x => x.id == id);
    if (i >= 0){
      const u = _currentUser();
      a[i] = { ...a[i], ...d, updatedAt: _now(), updatedBy: u, version: (a[i].version || 1) + 1 };
      // Update local cache immediately (optimistic UI)
      DB.set(k, a);
      // Write to Firestore (or queue if offline)
      if (DB._fb.includes(k)) fbSet(k, id, a[i]);
      EventBus.emit(k + ':updated', a[i]);
      EventBus.emit('db:changed', { collection: k, action: 'updated', record: a[i] });
    }
  },

  softDel(k, id){
    const u = _currentUser();
    DB.upd(k, id, { isDeleted: true, deletedAt: _now(), deletedBy: u });
  },

  del(k, id){
    const rec = DB.get(k).find(x => x.id == id);
    const filtered = DB.get(k).filter(x => x.id != id);
    // Update local cache immediately (optimistic UI)
    DB.set(k, filtered);
    // Delete from Firestore (or queue if offline)
    if (DB._fb.includes(k)) fbDel(k, id);
    EventBus.emit(k + ':deleted', { id, record: rec });
    EventBus.emit('db:changed', { collection: k, action: 'deleted', id });
  }
};

// ══════════════════════════════════════════
// 🔗 BUSINESS LOGIC HOOKS
// ربط تلقائي بين الوحدات عبر EventBus
// بدل الاستدعاء اليدوي المتكرر في كل دالة
// ══════════════════════════════════════════

// ── دالة مساعدة: إعادة حساب إجمالي إنفاق ومديونية العميل (فواتير + باقات) ──
// ── ✅ FIX: مصدر موحّد لملخص حساب العميل المالي (إنفاق/مدفوع/متبقي/زيارات) ──
// تُستخدم من: viewPat, _refreshProfile, renderPatAccount (02-patients.js)
// بنفس منطق _recalcPatFinancials بالضبط — بما فيها الأقساط المستقلة —
// عشان نمنع تضارب الأرقام بين شاشة وشاشة لما حد يعدّل المنطق في مكان وينسى الباقي.
function getPatientFinancialSummary(patId){
  const pat = DB.get('patients').find(p => String(p.id) === String(patId));
  const patName = pat ? pat.name : null;

  const allInvsRaw = DB.get('invoices').filter(i =>
    String(i.patId) === String(patId) || (i.patId === undefined && i.patient === patName)
  );
  const allInvs = [...new Map(allInvsRaw.map(i => [i.id, i])).values()]; // dedupe
  const allPkgs = DB.get('packages').filter(p => String(p.patId) === String(patId));
  const pkgIds  = new Set(allPkgs.map(p => String(p.id)));

  // استبعاد فواتير الباقات (pkgId) لتجنب الاحتساب المزدوج
  const standaloneInvs = allInvs.filter(i => !i.pkgId || !pkgIds.has(String(i.pkgId)));

  const invSpent   = standaloneInvs.reduce((s, i) => s + (i.total     || 0), 0);
  const invPaid    = standaloneInvs.reduce((s, i) => s + (i.paid      || 0), 0);
  const invBalance = standaloneInvs.reduce((s, i) => s + (i.remaining || 0), 0);

  const pkgSpent   = allPkgs.reduce((s, p) => s + (p.price || 0), 0);
  const pkgPaid    = allPkgs.reduce((s, p) => s + (p.paid  || 0), 0);
  const pkgBalance = allPkgs.reduce((s, p) => s + Math.max(0, (p.price || 0) - (p.paid || 0)), 0);

  // الأقساط "المستقلة" (غير مرتبطة بفاتورة fromInvId ولا بباقة fromPkgId)
  const standaloneInstBalance = DB.get('installments')
    .filter(i => String(i.patientId) === String(patId) && !i.fromInvId && !i.fromPkgId)
    .reduce((s, i) => s + (i.remaining || 0), 0);

  const pkgSessionsDone = allPkgs.reduce((s, p) => s + (p.sessionsUsed || 0), 0);

  return {
    spent:    invSpent + pkgSpent,
    paid:     invPaid + pkgPaid,
    remaining: invBalance + pkgBalance + standaloneInstBalance,
    visits:   standaloneInvs.length + pkgSessionsDone
  };
}

function _recalcPatFinancials(patId){
  const pat = DB.get('patients').find(p => String(p.id) === String(patId));
  if(!pat) return;
  // إجمالي الباقات
  const allPkgs    = DB.get('packages').filter(p => String(p.patId) === String(pat.id));
  const _pkgIds    = new Set(allPkgs.map(p => String(p.id)));
  // ✅ FIX: استثناء فواتير الباقات (pkgId) لتجنب الاحتساب المضاعف
  // فواتير الباقات تُحتسب من جدول packages مباشرةً (pkgSpent/pkgBalance)
  const allInvs    = DB.get('invoices').filter(i =>
    (String(i.patId) === String(pat.id) || i.patient === pat.name) &&
    (!i.pkgId || !_pkgIds.has(String(i.pkgId)))
  );
  const invSpent   = allInvs.reduce((s, i) => s + (i.total     || 0), 0);
  const invBalance = allInvs.reduce((s, i) => s + (i.remaining || 0), 0);
  const pkgSpent   = allPkgs.reduce((s, p) => s + (p.price  || 0), 0);
  const pkgBalance = allPkgs.reduce((s, p) => s + Math.max(0, (p.price || 0) - (p.paid || 0)), 0);
  // ✅ FIX (مشكلة #8): خطط الأقساط "المستقلة" (غير مرتبطة بفاتورة fromInvId ولا بباقة fromPkgId)
  // لم تكن محتسَبة هنا أبداً، فكانت دوال متفرقة (saveInstallment/delInstallment) تعيد حساب
  // الرصيد بمعادلات بديلة يدوية لتعويض هذا النقص — وهو ما تسبب في تضارب الأرقام بين الشاشات.
  // الآن تُحتسب هنا مرة واحدة، فتصبح هذه الدالة المصدر الوحيد الصحيح للرصيد في كل مكان.
  const standaloneInstBalance = DB.get('installments')
    .filter(i => String(i.patientId) === String(pat.id) && !i.fromInvId && !i.fromPkgId)
    .reduce((s, i) => s + (i.remaining || 0), 0);
  const totalSpent   = invSpent   + pkgSpent;
  // ✅ FIX (مشكلة #1): خصم الدفع المسبق (advance) من الرصيد
  const advance = pat.advance || 0;
  const totalBalance = Math.max(0, invBalance + pkgBalance + standaloneInstBalance - advance);
  DB.upd('patients', pat.id, {
    spent:   totalSpent,
    balance: totalBalance,
    advance: advance,  // احفظ الـ advance
    status:  totalBalance > 0 ? 'قسط' : (pat.status === 'قسط' ? 'نشط' : pat.status)
  });
}

// ── ✅ FIX (خطة التوحيد — مرحلة 0.1): مصدر الحقيقة الوحيد لعمولة الطبيب ──
// مجموع commissionAmount الفعلي المسجَّل لحظة كل دفعة (وليس إعادة حساب
// تقديرية بـ إيراد × نسبة العمولة الحالية، لأن النسبة قد تتغيّر لاحقاً
// وتُحرّف كل العمولات السابقة بأثر رجعي إذا اعتمدنا على النسبة الحالية).
// تحل محل أي إعادة حساب يدوي في أي شاشة (09-hr.js، 07-clinical.js).
function getDoctorCommissionDue(doctorId, doctorName){
  const invoices = DB.get('invoices').filter(i =>
    (doctorId && i.doctorId === doctorId) || (!doctorId && i.doctor === doctorName)
  );
  return invoices.reduce((s, i) => s + (i.commissionAmount || 0), 0);
}

// ── ✅ FIX (خطة التوحيد — مرحلة 0.2): مصدر الحقيقة الوحيد لإيراد أي فرع ──
// مبني على cashlog (التحصيل الفعلي/وارد فقط)، وليس على الفواتير (paid عند
// الإصدار)، لأن الفواتير قد تُسدَّد لاحقاً على دفعات بتواريخ مختلفة.
// يدعم فرز بتاريخ محدد أو بشهر (monthKey بصيغة YYYY-MM).
function getBranchRevenue(branchIdOrName, { date, monthKey } = {}){
  let rows = (DB.get('cashlog') || []).filter(c => c.type === 'وارد');
  if(date)     rows = rows.filter(c => c.date === date);
  if(monthKey) rows = rows.filter(c => (c.date || '').startsWith(monthKey));
  const patById = {};
  DB.get('patients').forEach(p => { patById[p.id] = p; });
  rows = rows.filter(c => {
    if(c.branch) return c.branch === branchIdOrName || (c.branch || '').includes(branchIdOrName);
    const pat = c.patId ? patById[c.patId] : null;
    return pat ? (pat.branch === branchIdOrName || (pat.branch || '').includes(branchIdOrName)) : false;
  });
  return rows.reduce((s, c) => s + (c.amount || 0), 0);
}

// ── ✅ FIX: دالة موحدة لتسجيل/تحديث عمولة الطبيب على أي دفعة (أولى أو لاحقة) ──
// تُستخدم من: invoices:created (الدفعة الأولى)، invoices:updated (تعديل يدوي بـ paidDelta)،
// وأيضاً تُستدعى مباشرة من processSmartPayment (شاشة "تحصيل دفعة" — وهي الأكثر استخداماً فعلياً)
// لأن تلك الشاشة لا تضبط paidDelta فكانت العمولة تُفقد على كل تحصيل يمر منها.
function recordDoctorCommission(invId, paymentAmount){
  if(!paymentAmount || paymentAmount <= 0) return;
  const inv = DB.get('invoices').find(i => String(i.id) === String(invId));
  if(!inv || !inv.doctor) return;
  // ✅ FIX (مشكلة #4): الأولوية لمطابقة doctorId (ثابت ودقيق)، والاسم fallback فقط
  // للسجلات القديمة التي لم تكن تخزّن doctorId. كانت المطابقة بالاسم هي الافتراضية
  // فتنكسر صامتة لو الطبيب غيّر اسمه لاحقاً في شاشة الموظفين.
  const doctors = DB.get('doctors');
  const doc = (inv.doctorId && doctors.find(d => String(d.id) === String(inv.doctorId)))
           || doctors.find(d => d.name === inv.doctor);
  if(!doc || !(doc.commission > 0)) return;
  
  // ✅ FIX (مشكلة #8): حساب العمولة من المبلغ المدفوع مباشرة
  // paymentAmount هو بالفعل المبلغ بعد تطبيق الخصم (إن وجد)
  // العمولة = paymentAmount × (نسبة العمولة) ÷ 100
  const commDelta = Math.round(paymentAmount * (doc.commission / 100));
  if(commDelta <= 0) return;
  const prevComm = inv.commissionAmount || 0;
  DB.upd('invoices', invId, {
    commissionRecorded: true,
    commissionAmount: prevComm + commDelta,
    commissionPct: doc.commission
  });
}

// ── 1. فاتورة جديدة → تحديث إنفاق العميل + تسجيل الخزينة ──
EventBus.on('invoices:created', function(inv){
  _recalcPatFinancials(inv.patId);
  if((inv.paid || 0) > 0){
    DB.push('cashlog', {
      type: 'وارد', source: `فاتورة — ${inv.patient||''}`, refId: inv.id,
      patient: inv.patient || '', patId: inv.patId || '',
      amount: inv.paid, service: inv.service || '',
      doctor: inv.doctor || '', branch: inv.branch || '',
      method: inv.method || 'كاش',
      date: inv.date || new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      notes: 'دفعة فاتورة'
    });
  }
  // ── إنشاء قسط تلقائي لو فيه متبقي على الفاتورة ──
  // _noAutoInstallment تمنع التكرار لو saveQuickSell عمل القسط يدوياً
  if((inv.remaining||0) > 0 && !inv._noAutoInstallment){
    DB.push('installments',{
      patientId: inv.patId,
      patientName: inv.patient||'',
      service: inv.service||'فاتورة',
      total: inv.total||0,
      downPayment: inv.paid||0,
      remaining: inv.remaining,
      installmentAmount: inv.remaining,
      count: 1,
      payments: [{ num:1, dueDate: inv.date||new Date().toISOString().split('T')[0], paid:false, paidDate:null }],
      startDate: inv.date||new Date().toISOString().split('T')[0],
      status: 'نشط',
      fromInvId: inv.id
    });
  }
  // ── خصم المنتجات من المخزون تلقائياً ──
  if(inv.products && inv.products.length){
    inv.products.forEach(p => {
      if(!p.productId) return;
      const item = DB.get('inventory').find(i => i.id === p.productId);
      if(!item) return;
      const newQty = Math.max(0, (item.qty||0) - (p.qty||1));
      const newStatus = newQty === 0 ? 'نفذ' : newQty <= (item.reorder||5) ? 'منخفض' : 'متوفر';
      DB.upd('inventory', item.id, { qty: newQty, status: newStatus });
      DB.push('inventory_transactions', {
        type: 'صرف', productId: item.id, productName: item.name,
        qty: p.qty||1, refId: inv.id, refType: 'invoice',
        patId: inv.patId, patient: inv.patient||'',
        date: inv.date || new Date().toISOString().split('T')[0],
        notes: `بيع للعميل — فاتورة`
      });
    });
  }
  // ── عمولة الطبيب: تسجيل تلقائي على الفاتورة (دفعة أولى) ──
  if(inv.doctor && !inv.commissionRecorded){
    recordDoctorCommission(inv.id, inv.paid || 0);
  }
});

// ── 2. تحديث فاتورة → إعادة حساب رصيد العميل + تسجيل الدفع الجديد في الخزينة ──
EventBus.on('invoices:updated', function(inv){
  _recalcPatFinancials(inv.patId || (DB.get('patients').find(p => p.name === inv.patient)?.id));
  // إذا كانت الفاتورة تحمل دفعة جديدة (paidDelta) سجّلها في الخزينة
  if((inv.paidDelta || 0) > 0){
    DB.push('cashlog', {
      type: 'وارد', source: `دفعة فاتورة — ${inv.patient||''}`, refId: inv.id,
      patient: inv.patient || '', patId: inv.patId || '',
      amount: inv.paidDelta, service: inv.service || '',
      doctor: inv.doctor || '', branch: inv.branch || '',
      method: inv.method || 'كاش',
      date: inv.date || new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      notes: 'دفعة جزئية على فاتورة'
    });
    // ── عمولة الطبيب على الدفعة الجديدة ──
    recordDoctorCommission(inv.id, inv.paidDelta);
  }
});

// ── 3. حذف فاتورة → حذف جميع المرتبطات تلقائياً ──
EventBus.on('invoices:deleted', function(e){
  const invId = e.id;
  
  // ✅ حذف قيود الخزينة المقابلة (قد تكون متعددة لو فيها دفعات جزئية)
  const cashlog = DB.get('cashlog') || [];
  const filteredCashlog = cashlog.filter(c => String(c.refId) !== String(invId));
  if(filteredCashlog.length !== cashlog.length) DB.set('cashlog', filteredCashlog);
  
  // ✅ حذف الأقساط المتعلقة بهذه الفاتورة (fromInvId)
  const installments = DB.get('installments') || [];
  const filteredInst = installments.filter(i => String(i.fromInvId) !== String(invId));
  if(filteredInst.length !== installments.length) DB.set('installments', filteredInst);
  
  // ✅ FIX (مشكلة #10): حذف معاملات المخزون المرتبطة
  const invTrans = DB.get('inventory_transactions') || [];
  const filteredTrans = invTrans.filter(t => String(t.refId) !== String(invId));
  if(filteredTrans.length !== invTrans.length) DB.set('inventory_transactions', filteredTrans);
  
  // ✅ حذف العمولات المرتبطة (commissionAmount)
  // لا نحتاج لحذف، فقط إعادة حساب — لكن العمولة كانت مسجلة في invoice.commissionAmount
  // فعندما نحذف الفاتورة، العمولة تختفي تلقائياً
  
  // ✅ تحديث الشاشات تلقائياً
  _scheduleUIRefresh('cashlog');
  _scheduleUIRefresh('installments');
  _scheduleUIRefresh('inventory_transactions');
});

// ══════════════════════════════════════════
// 💰 مديونية المورد — حساب موحَّد (مصدر الحقيقة الوحيد)
// ✅ FIX (مراجعة الموردين/المشتريات/المنتجات):
// كانت مديونية المورد (owed) تُخزَّن كحقل ثابت على suppliers.owed، ويُعاد
// حسابها فقط عند استلام طلب شراء أو عند تسجيل/تعديل دفعة. أي تغيير آخر
// (حذف طلب شراء مستلم، تعديل سعره/كميته، أو كتابة قيمة يدوية في نموذج
// المورد) كان يترك هذا الحقل قديماً وغير صحيح، بينما شاشة الموردين وكشف
// حساب المورد كانا يحسبانها مباشرة من المشتريات والدفعات (الطريقة الصحيحة)
// فيظهر رقمان مختلفان لنفس المورد بين الشاشات (خصوصاً الميزانية في
// شاشة المالية، التي كانت تجمع الحقل الثابت بدل الحساب الحي).
// الحل: دالة واحدة تُستخدم من كل الشاشات (موردين، مشتريات، المالية).
// ══════════════════════════════════════════
function calcSupplierOwed(supplierId){
  const bought = (DB.get('purchases')||[])
    .filter(p => p.supplierId === supplierId && p.status === 'مستلم')
    .reduce((s,p)=>s+(p.total||0), 0);
  const paid = (DB.get('supplier_payments')||[])
    .filter(sp => sp.supplierId === supplierId)
    .reduce((s,sp)=>s+(sp.amount||0), 0);
  return Math.max(0, bought - paid);
}
function calcAllSuppliersOwed(){
  return (DB.get('suppliers')||[]).reduce((s,sup)=>s+calcSupplierOwed(sup.id), 0);
}

// ══════════════════════════════════════════
// 📦 رد كمية طلب شراء مستلم من المخزون (عكس عملية الاستلام)
// ✅ FIX: يُستخدم عند حذف طلب شراء "مستلم" أو تغيير حالته من "مستلم" إلى
// حالة أخرى، أو عند تعديل كمية/سعر طلب مستلم مسبقاً — لمنع بقاء كمية
// "وهمية" في المخزون لا تقابلها فاتورة شراء فعلية.
// ══════════════════════════════════════════
function reverseInventoryForPurchase(purchaseId, itemsOverride){
  const items = itemsOverride || (DB.get('purchase_items')||[]).filter(pi => pi.purchaseId === purchaseId);
  const today = new Date().toISOString().split('T')[0];
  items.forEach(item => {
    const prod = DB.get('inventory').find(p => p.id === item.productId);
    if(!prod) return;
    const qtyPerUnit = item.qtyPerUnit || prod.qtyPerUnit || 1;
    const purchasedConsumeQty = (item.qty || 0) * qtyPerUnit;
    const newQty = parseFloat(Math.max(0, (prod.qty||0) - purchasedConsumeQty).toFixed(4));
    const newStatus = newQty === 0 ? 'نفذ' : newQty <= (prod.reorder||5) ? 'منخفض' : 'متوفر';
    DB.upd('inventory', prod.id, { qty: newQty, status: newStatus });
    DB.push('inventory_transactions', {
      type: 'صادر', productId: prod.id, product: prod.name,
      qty: purchasedConsumeQty, consumeUnit: item.consumeUnit || prod.consumeUnit || 'وحدة',
      refType: 'purchase_reversal', refId: purchaseId, date: today,
      notes: `رد مخزون — إلغاء/تعديل طلب شراء مستلم (${purchasedConsumeQty.toFixed(1)} ${item.consumeUnit||''})`
    });
  });
}

// ── 3. استلام مشتريات → تحديث المخزون + سعر آخر شراء + مديونية المورد + حركة مالية ──
EventBus.on('purchases:updated', function(purchase){
  if(purchase.status !== 'مستلم') return;
  // ── حماية من التكرار: تجاهل إذا تم تحديث المخزون مسبقاً لهذه الطلبية ──
  if(purchase._inventoryUpdated === true) return;
  const today = purchase.deliveryDate || new Date().toISOString().split('T')[0];

  // ── أ. تحديث المخزون + سعر آخر شراء من purchase_items ──
  const items = DB.get('purchase_items').filter(pi => pi.purchaseId === purchase.id);
  items.forEach(item => {
    const prod = DB.get('inventory').find(p => p.id === item.productId);
    if(!prod) return;
    // ── تحويل وحدات الشراء → وحدات الاستهلاك ──
    const qtyPerUnit = item.qtyPerUnit || prod.qtyPerUnit || 1;
    const purchasedConsumeQty = (item.qty || 0) * qtyPerUnit;
    const newQty    = parseFloat(((prod.qty || 0) + purchasedConsumeQty).toFixed(4));
    const newStatus = newQty === 0 ? 'نفذ' : newQty <= (prod.reorder || 5) ? 'منخفض' : 'متوفر';
    // حساب تكلفة وحدة الاستهلاك: سعر الشراء / كمية الاستهلاك لكل وحدة
    const newCostPerConsumeUnit = qtyPerUnit > 0 ? (item.unitPrice || 0) / qtyPerUnit : (item.unitPrice || 0);
    // تحديث الكمية + سعر آخر شراء + التكلفة + وحدات الاستهلاك
    DB.upd('inventory', prod.id, {
      qty: newQty,
      status: newStatus,
      lastPurchasePrice: item.unitPrice || prod.lastPurchasePrice || 0,
      costPrice: item.unitPrice || prod.costPrice || 0,
      costPerConsumeUnit: newCostPerConsumeUnit,
      purchaseUnit: item.purchaseUnit || prod.purchaseUnit || 'قطعة',
      consumeUnit:  item.consumeUnit  || prod.consumeUnit  || 'قطعة',
      qtyPerUnit:   qtyPerUnit,
      // ✅ FIX: مزامنة آخر مورد فعلي اشترينا منه المنتج على شاشة المنتجات
      // (كانت تظل فارغة أو على مورد قديم رغم استلام بضاعة من مورد جديد)
      supplierId:   purchase.supplierId || prod.supplierId || '',
      supplierName: purchase.supplier   || prod.supplierName || ''
    });
    DB.push('inventory_transactions', {
      type: 'وارد', productId: prod.id, product: prod.name,
      qty: purchasedConsumeQty,
      qtyPurchaseUnits: item.qty,
      purchaseUnit: item.purchaseUnit || prod.purchaseUnit || 'قطعة',
      consumeUnit: item.consumeUnit || prod.consumeUnit || 'قطعة',
      qtyPerUnit: qtyPerUnit,
      unitPrice: item.unitPrice || 0,
      costPerConsumeUnit: newCostPerConsumeUnit,
      refType: 'purchase', refId: purchase.id,
      date: today,
      notes: `استلام مشتريات — ${purchase.supplier || ''} (${item.qty} ${item.purchaseUnit||'وحدة'} × ${qtyPerUnit} = ${purchasedConsumeQty.toFixed(1)} ${item.consumeUnit||''})`
    });
  });

  // ── ب. إعادة حساب مديونية المورد (عبر الدالة الموحَّدة) ──
  if(purchase.supplierId){
    const sup = DB.get('suppliers').find(s => s.id === purchase.supplierId);
    if(sup){
      DB.upd('suppliers', sup.id, { owed: calcSupplierOwed(sup.id) });
    }
  }

  // ── ج. ✅ FIX: لا نسجّل حركة خزينة هنا — استلام بضاعة "آجل" ليس خروج كاش فعلي.
  // مديونية المورد تُحدَّث فعلاً في الفقرة (ب) أعلاه عبر suppliers.owed،
  // والحركة النقدية الحقيقية تُسجَّل فقط عند السداد الفعلي للمورد
  // (دالة سداد المورد في 05-inventory.js تسجّل cashlog من نوع "صادر" حينها).
  // (كان هذا القيد يُسجَّل تلقائياً بمجرد الاستلام بغض النظر عن طريقة الدفع،
  //  فيُنقص رصيد الخزينة المعروض بمبلغ لم يخرج فعلياً من الكاش، ثم يتكرر
  //  الخصم مرة أخرى عند السداد الفعلي لاحقاً — ازدواج في صافي حركة الخزينة).

  // ── د. تسجيل أن المخزون تم تحديثه لهذه الطلبية (لمنع التكرار) ──
  // نستخدم setTimeout لتجنب تشغيل الـ hook مرة أخرى من نفس الحدث
  setTimeout(() => {
    const cur = (DB.get('purchases')||[]).find(p => p.id === purchase.id);
    if(cur && !cur._inventoryUpdated){
      DB.upd('purchases', purchase.id, { _inventoryUpdated: true });
    }
  }, 100);
});

// ── 4. إتمام جلسة → تحديث عداد جلسات العميل ──
EventBus.on('sessions:updated', function(session){
  if(!session.patId) return;
  const pat = DB.get('patients').find(p => p.id === session.patId);
  if(!pat) return;
  const allSessions = DB.get('sessions').filter(s => s.patId === session.patId);
  const totalDone = allSessions.reduce((s, x) => s + (x.done || 0), 0);
  DB.upd('patients', pat.id, { sessions: totalDone });
});

// ── 4b. باقة جديدة / تحديث باقة / حذف باقة → إعادة حساب إنفاق ومديونية العميل ──
EventBus.on('packages:created', function(pkg){
  if(pkg && pkg.patId) _recalcPatFinancials(pkg.patId);
});
EventBus.on('packages:updated', function(pkg){
  if(pkg && pkg.patId) _recalcPatFinancials(pkg.patId);
});
EventBus.on('packages:deleted', function(payload){
  const pkg = (typeof payload === 'object' && payload?.record) ? payload.record : null;
  if(pkg && pkg.patId) _recalcPatFinancials(pkg.patId);
});

// ── 5. مصروف جديد → تسجيل في الخزينة ──
// ✅ cashlog يُضاف مباشرةً من saveExp() مع refId للربط — لا حاجة لإعادة الإضافة هنا
EventBus.on('expenses:created', function(exp){
  // تحديث الواجهة فقط — cashlog مُضاف بالفعل في saveExp
  _scheduleUIRefresh('cashlog');
});

// ── 5b. تعديل مصروف → تحديث سجله في الخزينة لتجنب قيم قديمة ──
// ✅ يتم التحديث مباشرة في saveExp — هذا fallback للتأكد فقط
EventBus.on('expenses:updated', function(exp){
  _scheduleUIRefresh('cashlog');
});

// ── 5c. حذف مصروف → حذف سجله من الخزينة ──
// ✅ الحذف يتم مباشرة في delExp() قبل DB.del — هذا للـ Firestore sync فقط
EventBus.on('expenses:deleted', function(payload){
  _scheduleUIRefresh('cashlog');
});

// ══════════════════════════════════════════
// 🔄 UI REFRESH SCHEDULER
// يجمع طلبات التحديث ويطبقها مرة واحدة (debounce 50ms)
// ══════════════════════════════════════════
const _pendingRefresh = new Set();
let _refreshTimer = null;

function _scheduleUIRefresh(hint){
  if(hint) _pendingRefresh.add(hint);
  clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(_flushUIRefresh, 50);
}

function _flushUIRefresh(){
  const active = document.querySelector('.screen.active')?.id?.replace('screen-','');
  _refreshDashKPIs();
  if(!active){ _pendingRefresh.clear(); return; }
  try{
    if(_pendingRefresh.has('appointments')){
      if(active==='appointments') renderAppts();
      if(active==='calendar')     buildCal();
      if(active==='waitlist')     renderWaitlist();
      if(active==='reception')    renderReception();
      if(active==='doctor-view')  renderDoctorView();
      if(active==='dashboard')    { if(typeof buildDashboard==='function') buildDashboard(); else if(typeof renderTodayAppts==='function') renderTodayAppts(); }
    }
    if(_pendingRefresh.has('patients')     && active==='patients')     renderPat();
    // ✅ تحديث لوحة العميل المفتوحة تلقائياً عند أي تغيير مالي أو جلسات
    if(window._curPat && typeof viewPat === 'function'){
      const _needPatPanelRefresh = (
        _pendingRefresh.has('patients') ||
        _pendingRefresh.has('invoices') ||
        _pendingRefresh.has('installments') ||
        _pendingRefresh.has('sessions') ||
        _pendingRefresh.has('cashlog') ||
        // ✅ FIX (مزامنة لحظية — مرحلة 4): كانت ناقصة — لوحة العميل بتعرض
        // أرصدة الباقات وتكلفة/ربح الجلسات كمان، فلازم تتحدث لو اتغيّروا
        _pendingRefresh.has('packages') ||
        _pendingRefresh.has('session_completions')
      );
      if(_needPatPanelRefresh) viewPat(window._curPat);
    }
    if(_pendingRefresh.has('invoices')     && active==='invoices')     renderInvs();
    if(_pendingRefresh.has('invoices')     && active==='installments') renderInstallments();
    if(_pendingRefresh.has('installments') && active==='installments') renderInstallments();
    if(_pendingRefresh.has('installments') && active==='payments')     renderPayments();
    if(_pendingRefresh.has('invoices')     && active==='payments')     renderPayments();
    if(_pendingRefresh.has('inventory')    && active==='inventory')    renderInv();
    if(_pendingRefresh.has('expenses')     && active==='expenses')     renderExpenses();
    if(_pendingRefresh.has('expenses')     && active==='treasury')     renderTreasury();
    if(_pendingRefresh.has('expenses')     && active==='accounts')     { if(typeof renderAccounts==='function') renderAccounts(); }
    if(_pendingRefresh.has('cashlog')      && active==='treasury')     renderTreasury();
    if(_pendingRefresh.has('cashlog')      && active==='payments')     renderPayments();
    if(_pendingRefresh.has('cashlog')      && active==='accounts')     { if(typeof renderAccounts==='function') renderAccounts(); }
    if(_pendingRefresh.has('invoices')     && active==='accounts')     { if(typeof renderAccounts==='function') renderAccounts(); }
    if(_pendingRefresh.has('installments') && active==='accounts')     { if(typeof renderAccounts==='function') renderAccounts(); }
    if(_pendingRefresh.has('patients')     && active==='accounts')     { if(typeof renderAccounts==='function') renderAccounts(); }
    if(_pendingRefresh.has('purchases')    && active==='purchases')    renderPurchases();
    if(_pendingRefresh.has('purchases')    && active==='suppliers')    renderSuppliers();
    if(_pendingRefresh.has('suppliers')    && active==='suppliers')    renderSuppliers();
    if(_pendingRefresh.has('suppliers')    && active==='purchases')    { renderPurchases(); if(typeof fillPurchaseSuppliers==='function') fillPurchaseSuppliers(); }
    if(_pendingRefresh.has('transfers')    && active==='transfers')    renderTransfers();
    if(_pendingRefresh.has('sessions')     && active==='sessions')     renderSessions();
    if(_pendingRefresh.has('sessions')     && active==='packages')     renderPackages();
    if(_pendingRefresh.has('services')     && active==='services')     renderSvcs();
    if(_pendingRefresh.has('leads')        && active==='leads')        renderLeads();
    if(_pendingRefresh.has('photos')       && active==='photos')       renderPhotos();
    // ✅ FIX (مزامنة لحظية — مرحلة 3): إكمال باقي الشاشات
    if(_pendingRefresh.has('doctors')      && active==='doctors')      renderDocs();
    if(_pendingRefresh.has('staff')        && active==='staff')        renderStaff();
    if(_pendingRefresh.has('branches')     && active==='branches')     renderBranches();
    if(_pendingRefresh.has('rooms')        && active==='resources')    renderRooms();
    if(_pendingRefresh.has('equipment')    && active==='resources')    renderEquipment();
    if(_pendingRefresh.has('campaigns')    && active==='campaigns')    renderCampaigns();
    if(_pendingRefresh.has('waitlist')     && active==='waitlist')     renderWaitlist();
    // ✅ FIX (مزامنة لحظية — مرحلة 4): الـ listener الحقيقي بتاع Firestore
    // (attachFirestoreSync في 11-settings.js) بينادي _scheduleUIRefresh(col)
    // بنفس اسم الـ collection الحرفي زي ما هو في قاعدة البيانات — مش بالاسم
    // المستعار اللي كانت بتستخدمه بعض أحداث EventBus المحلية (مثلاً 'packages'
    // كانت بتتسجل محليًا تحت اسم 'sessions'). فكان فيه فرق: تعديل محلي على
    // الباقات بيحدّث الشاشة لأنه بيمر بـ hint='sessions' (متغطّى أعلاه)، لكن
    // **تعديل بعيد من جهاز تاني** كان بيمر بـ hint='packages' الحرفي ومفيش
    // أي شرط بيتحقق منه — فشاشة الباقات/الجلسات ما كانتش بتتحدث لحظيًا إلا
    // بالخروج والرجوع. نفس المشكلة كانت ناقصة بالكامل لباقي الـ collections
    // دي (مفيش أي EventBus hook محلي ولا أي حالة في _flushUIRefresh خالص).
    if(_pendingRefresh.has('packages')             && active==='packages')   renderPackages();
    if(_pendingRefresh.has('packages')             && active==='sessions')   renderSessions();
    if(_pendingRefresh.has('purchase_items')       && active==='purchases')  renderPurchases();
    if(_pendingRefresh.has('supplier_payments')    && active==='suppliers') renderSuppliers();
    if(_pendingRefresh.has('advances')             && active==='staff')     renderStaff();
    if(_pendingRefresh.has('inventory_transactions') && active==='inventory') renderInv();
    if(_pendingRefresh.has('session_completions')  && active==='sessions')   renderSessions();
    if(_pendingRefresh.has('session_completions')  && active==='packages')   renderPackages();
    if(_pendingRefresh.has('waitlist')     && active==='reception')    renderReception();
    // ✅ FIX (نظام الاستدعاء): hint='call_queue' (القادم من attachFirestoreSync عند
    // تغيير بعيد من جهاز آخر) لم يكن له أي شرط هنا، فكانت شاشة الاستقبال تعتمد فقط
    // على الـ poller كل ثانية (_setupCallQueueListener) بدل التحديث الفوري.
    if(_pendingRefresh.has('call_queue')   && active==='reception')    renderReception();
  } catch(e){ console.warn('[UI Refresh]', e); }
  _pendingRefresh.clear();
}

function _refreshDashKPIs(){
  try{
    const today = new Date().toISOString().split('T')[0];
    const txt = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    const patients = DB.get('patients');
    const invoices = DB.get('invoices');
    const inventory = DB.get('inventory');
    const cashlog  = DB.get('cashlog') || [];
    const todayRev = cashlog.filter(c=>c.type==='وارد'&&c.date===today).reduce((s,c)=>s+(c.amount||0),0);
    const pending  = invoices.filter(i=>i.status!=='مدفوع').reduce((s,i)=>s+(i.remaining||0),0);
    const low      = inventory.filter(i=>i.status==='منخفض'||i.status==='نفذ').length;
    const todayA   = DB.get('appointments').filter(a=>a.date===today).length;
    txt('kpi-pat', patients.length);    txt('badge-patients', patients.length);
    txt('kpi-rev', todayRev.toLocaleString());
    txt('kpi-pend', pending.toLocaleString());
    txt('kpi-stk', low);               txt('badge-stock', low);
    txt('kpi-appt', todayA);           txt('badge-appts', todayA);
    txt('badge-inst', invoices.filter(i=>i.remaining>0).length);
    txt('badge-leads', DB.get('leads').filter(l=>l.status==='جديد').length);
  } catch(e){}
}

// ربط EventBus بـ UI Refresh
EventBus.on('appointments:created', () => _scheduleUIRefresh('appointments'));
EventBus.on('appointments:updated', () => _scheduleUIRefresh('appointments'));
EventBus.on('appointments:deleted', () => _scheduleUIRefresh('appointments'));
EventBus.on('patients:created',     () => _scheduleUIRefresh('patients'));
EventBus.on('patients:updated',     () => _scheduleUIRefresh('patients'));
EventBus.on('patients:deleted',     () => _scheduleUIRefresh('patients'));
EventBus.on('invoices:created',     () => _scheduleUIRefresh('invoices'));
EventBus.on('invoices:updated',     () => _scheduleUIRefresh('invoices'));
EventBus.on('invoices:deleted',     () => _scheduleUIRefresh('invoices'));
EventBus.on('inventory:created',    () => _scheduleUIRefresh('inventory'));
EventBus.on('inventory:updated',    () => _scheduleUIRefresh('inventory'));
EventBus.on('inventory:deleted',    () => _scheduleUIRefresh('inventory'));
EventBus.on('expenses:created',     () => _scheduleUIRefresh('expenses'));
EventBus.on('expenses:updated',     () => _scheduleUIRefresh('expenses'));
EventBus.on('expenses:deleted',     () => _scheduleUIRefresh('expenses'));
EventBus.on('purchases:created',    () => _scheduleUIRefresh('purchases'));
EventBus.on('purchases:updated',    () => _scheduleUIRefresh('purchases'));
EventBus.on('purchases:deleted',    () => _scheduleUIRefresh('purchases'));

// ── حذف مشتريات → تحديث مديونية المورد ──
EventBus.on('purchases:deleted', function(e) {
  const purchase = e.record;
  if (purchase && purchase.supplierId && purchase.status === 'مستلم') {
    // ✅ إعادة حساب مديونية المورد تلقائياً
    // سيُستخدم calcSupplierOwed من موقع واحد (غير معالج إضافي هنا)
    // الشاشات الأخرى (موردين، شراء) ستُستدعي calcSupplierOwed مباشرة عند الحاجة
    _scheduleUIRefresh('suppliers');
  }
});
EventBus.on('suppliers:created',    () => _scheduleUIRefresh('suppliers'));
EventBus.on('suppliers:updated',    () => _scheduleUIRefresh('suppliers'));
EventBus.on('suppliers:deleted',    () => _scheduleUIRefresh('suppliers'));
EventBus.on('sessions:created',     () => _scheduleUIRefresh('sessions'));
EventBus.on('sessions:updated',     () => _scheduleUIRefresh('sessions'));
EventBus.on('sessions:deleted',     () => _scheduleUIRefresh('sessions'));
EventBus.on('cashlog:created',      () => _scheduleUIRefresh('cashlog'));
EventBus.on('cashlog:updated',      () => _scheduleUIRefresh('cashlog'));
EventBus.on('installments:created', () => _scheduleUIRefresh('installments'));
EventBus.on('installments:updated', () => _scheduleUIRefresh('installments'));
EventBus.on('installments:deleted', () => _scheduleUIRefresh('installments'));
EventBus.on('services:created',     () => _scheduleUIRefresh('services'));
EventBus.on('services:updated',     () => _scheduleUIRefresh('services'));
EventBus.on('services:deleted',     () => _scheduleUIRefresh('services'));
EventBus.on('leads:created',        () => _scheduleUIRefresh('leads'));
EventBus.on('leads:updated',        () => _scheduleUIRefresh('leads'));
EventBus.on('leads:deleted',        () => _scheduleUIRefresh('leads'));
EventBus.on('transfers:created',    () => _scheduleUIRefresh('transfers'));
EventBus.on('transfers:updated',    () => _scheduleUIRefresh('transfers'));
EventBus.on('transfers:deleted',    () => _scheduleUIRefresh('transfers'));
EventBus.on('photos:created',       () => _scheduleUIRefresh('photos'));
EventBus.on('photos:deleted',       () => _scheduleUIRefresh('photos'));
EventBus.on('packages:created',     () => _scheduleUIRefresh('sessions'));
EventBus.on('packages:updated',     () => _scheduleUIRefresh('sessions'));
EventBus.on('packages:deleted',     () => _scheduleUIRefresh('sessions'));
// ✅ FIX (مزامنة لحظية — مرحلة 3): هذه الـ collections كانت بتتحدّث في الـ
// cache فعليًا من onSnapshot (بيانات صحيحة)، لكن مفيش أي hook بيقول للشاشة
// المفتوحة "حدّثي نفسك" — فلو جهاز تاني ضاف/عدّل/حذف طبيب أو موظف أو فرع أو
// غرفة أو جهاز أو حملة تسويقية وأنت فاتح نفس الشاشة، التحديث ما كنتش تشوفه
// إلا لو خرجت من الشاشة ورجعتلها تاني. دلوقتي بيتحدث تلقائيًا زي باقي الشاشات.
EventBus.on('doctors:created',      () => _scheduleUIRefresh('doctors'));
EventBus.on('doctors:updated',      () => _scheduleUIRefresh('doctors'));
EventBus.on('doctors:deleted',      () => _scheduleUIRefresh('doctors'));
EventBus.on('staff:created',        () => _scheduleUIRefresh('staff'));
EventBus.on('staff:updated',        () => _scheduleUIRefresh('staff'));
EventBus.on('staff:deleted',        () => _scheduleUIRefresh('staff'));
EventBus.on('branches:created',     () => _scheduleUIRefresh('branches'));
EventBus.on('branches:updated',     () => _scheduleUIRefresh('branches'));
EventBus.on('branches:deleted',     () => _scheduleUIRefresh('branches'));
EventBus.on('rooms:created',        () => _scheduleUIRefresh('rooms'));
EventBus.on('rooms:updated',        () => _scheduleUIRefresh('rooms'));
EventBus.on('rooms:deleted',        () => _scheduleUIRefresh('rooms'));
EventBus.on('equipment:created',    () => _scheduleUIRefresh('equipment'));
EventBus.on('equipment:updated',    () => _scheduleUIRefresh('equipment'));
EventBus.on('equipment:deleted',    () => _scheduleUIRefresh('equipment'));
EventBus.on('campaigns:created',    () => _scheduleUIRefresh('campaigns'));
EventBus.on('campaigns:updated',    () => _scheduleUIRefresh('campaigns'));
EventBus.on('campaigns:deleted',    () => _scheduleUIRefresh('campaigns'));
EventBus.on('waitlist:created',     () => _scheduleUIRefresh('waitlist'));
EventBus.on('waitlist:updated',     () => _scheduleUIRefresh('waitlist'));
EventBus.on('waitlist:deleted',     () => _scheduleUIRefresh('waitlist'));
// ✅ FIX (مزامنة لحظية — مرحلة 4)
EventBus.on('purchase_items:created',       () => _scheduleUIRefresh('purchase_items'));
EventBus.on('purchase_items:updated',       () => _scheduleUIRefresh('purchase_items'));
EventBus.on('purchase_items:deleted',       () => _scheduleUIRefresh('purchase_items'));
EventBus.on('supplier_payments:created',    () => _scheduleUIRefresh('supplier_payments'));
EventBus.on('supplier_payments:updated',    () => _scheduleUIRefresh('supplier_payments'));
EventBus.on('supplier_payments:deleted',    () => _scheduleUIRefresh('supplier_payments'));
EventBus.on('advances:created',             () => _scheduleUIRefresh('advances'));
EventBus.on('advances:updated',             () => _scheduleUIRefresh('advances'));
EventBus.on('advances:deleted',             () => _scheduleUIRefresh('advances'));
EventBus.on('inventory_transactions:created', () => _scheduleUIRefresh('inventory_transactions'));
EventBus.on('session_completions:created',  () => _scheduleUIRefresh('session_completions'));

// ══════════════════════════════════════════
// 🔗 LOOKUP HELPERS
// ══════════════════════════════════════════
function _patName(patientId){
  return DB.get('patients').find(p => p.id == patientId)?.name || '—';
}
// أيقونة المريض حسب الجنس — تُستخدم في جميع الشاشات
function genderAva(gender){ return gender==='ذكر'?'👦':'👧'; }
// جلب جنس المريض بالـ ID أو الاسم
function _patGender(patId, patName){
  const p = DB.get('patients').find(x => x.id == patId) ||
            (patName ? DB.get('patients').find(x => x.name === patName) : null);
  return p?.gender || 'أنثى';
}
function _docName(doctorId){
  return DB.get('doctors').find(d => d.id == doctorId)?.name || '—';
}
function _svcName(serviceId){
  return DB.get('services').find(s => s.id == serviceId)?.name || '—';
}
function _patByName(name){
  return DB.get('patients').find(p => p.name === name);
}
function _invsByPat(patientId, patientName){
  return DB.get('invoices').filter(i =>
    (patientId && (i.patId == patientId || i.patientId == patientId)) || i.patient === patientName
  );
}

// ══════════════════════════════════════════
// 🧭 showScreen — موحدة
// ══════════════════════════════════════════
const TITLES = {
  dashboard:'لوحة التحكم', patients:'قائمة العملاء',
  'patient-profile':'ملف العميل', reception:'شاشة الاستقبال',
  'doctor-view':'شاشة الطبيب', calendar:'التقويم',
  appointments:'المواعيد', waitlist:'قائمة الانتظار',
  sessions:'الجلسات', services:'الخدمات', packages:'الباقات',
  doctors:'الأطباء', staff:'الموظفون', invoices:'الفواتير',
  payments:'المدفوعات', installments:'الأقساط', expenses:'المصروفات',
  treasury:'الخزينة', accounts:'الحسابات', inventory:'المخزون',
  suppliers:'الموردون', purchases:'المشتريات', transfers:'تحويل المخزون',
  leads:'العملاء المحتملون', campaigns:'الحملات', whatsapp:'واتساب',
  branches:'الفروع', resources:'الغرف والأجهزة', reports:'التقارير',
  ai:'المساعد الذكي', settings:'الإعدادات', photos:'الصور'
};

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');

  const t = document.getElementById('topbar-title');
  if (t){ t.innerHTML = (TITLES[id] || id) + ' <span class="topbar-date" id="topbar-date"></span>'; setDate(); }
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick')?.includes("'" + id + "'")) n.classList.add('active');
  });

  closeSidebar();
  document.getElementById('main-area')?.scrollTo(0, 0);

  if (id === 'dashboard')      {
    if(typeof buildDashboard === 'function') buildDashboard();
    else { buildChart(); buildDashAlerts(); if(typeof buildDashAlertsEnhanced==='function') buildDashAlertsEnhanced(); if(typeof renderTodayAppts==='function') renderTodayAppts(); if(typeof buildDashExtra==='function') buildDashExtra(); _refreshDashKPIs(); }
  }
  if (id === 'patients')       renderPat();
  if (id === 'appointments')   renderAppts();
  if (id === 'calendar')       buildCal();
  if (id === 'invoices')       renderInvs();
  if (id === 'inventory')      renderInv();
  if (id === 'services')       renderSvcs();
  if (id === 'doctors')        renderDocs();
  if (id === 'staff')          renderStaff();
  if (id === 'expenses')       renderExpenses();
  if (id === 'leads')          renderLeads();
  if (id === 'whatsapp')       renderWA();
  if (id === 'payments')       renderPayments();
  if (id === 'installments')   { renderInstallments(); if(typeof updateInstallmentStatuses==='function') updateInstallmentStatuses(); }
  if (id === 'treasury')       renderTreasury();
  if (id === 'accounts')       renderAccounts();
  if (id === 'suppliers')      renderSuppliers();
  if (id === 'purchases')      { renderPurchases(); fillPurchaseSuppliers(); }
  if (id === 'transfers')      renderTransfers();
  if (id === 'campaigns')      renderCampaigns();
  if (id === 'photos')         renderPhotos();
  if (id === 'branches')       renderBranches();
  if (id === 'resources')      { renderRooms(); renderEquipment(); }
  if (id === 'reports')        renderReports();
  if (id === 'sessions')       renderSessions();
  if (id === 'packages')       renderPackages();
  if (id === 'waitlist')       { _wlAutoUpdateStatuses(); renderWaitlist(); }
  if (id === 'reception')      { _wlAutoUpdateStatuses(); renderReception(); }
  if (id === 'doctor-view')    { _wlAutoUpdateStatuses(); renderDoctorView(); }
  if (id === 'ai')             { aiRenderMessages(); aiRenderChips(); }

  EventBus.emit('screen:changed', { id });
}

// ══════════════════════════════════════════
// 🩹 MIGRATION — توحيد حقل عمولة الطبيب
// نسخ سابقة كانت تحفظ commissionPercentage بينما كل الحسابات (الفواتير/التقارير) تقرأ commission
// هذا يصحح بيانات أي عيادة مُنشأة قبل هذا التحديث، مرة واحدة فقط
// ══════════════════════════════════════════
if(!localStorage.getItem('ha_fix_commission_v1')){
  const docs = DB.get('doctors');
  let fixed = false;
  docs.forEach(d=>{
    if((d.commission===undefined || d.commission===null) && d.commissionPercentage!==undefined){
      DB.upd('doctors', d.id, { commission: d.commissionPercentage });
      fixed = true;
    }
  });
  localStorage.setItem('ha_fix_commission_v1','1');
}

// ══════════════════════════════════════════
// 🗃️ تهيئة المجموعات الفارغة عند أول تشغيل
// يُنشئ الهيكل فقط — لا بيانات وهمية
// ══════════════════════════════════════════
if(!localStorage.getItem('ha_seeded_v2')){
  localStorage.removeItem('ha_seeded');

  // ── إعدادات افتراضية: فقط لو لا توجد إعدادات في الـ cache (Firestore لم يتصل بعد) ──
  // لو Firestore موصول، loadSettingsFromFirestore() ستُحدِّث الـ cache تلقائياً
  if(!DB._cache['settings'] || !DB._cache['settings'].clinicName){
    DB._cache['settings'] = {clinicName:'عيادتي للتجميل',phone:'',managerName:'',managerRole:'مدير النظام',schemaVersion:2};
    // احفظ في localStorage فقط كـ offline fallback أولي (قبل الاتصال بـ Firestore)
    try{ localStorage.setItem('ha_settings', JSON.stringify(DB._cache['settings'])); } catch(e){}
  }

  // ── تهيئة الـ cache بـ arrays فاضية فقط (بدون كتابة localStorage) ──
  // Firestore هو المصدر — onSnapshot سيملأ الـ cache تلقائياً عند الاتصال
  const EMPTY_COLLECTIONS = [
    'branches','doctors','rooms','equipment','services',
    'patients','appointments','invoices','invoice_items',
    'inventory','suppliers','purchases','purchase_items',
    'leads','staff','expenses','visits','inventory_transactions',
    'sessions','packages','waitlist','campaigns','audit_log',
    'photos','installments','cashlog','transfers','product_sales','supplier_payments'
  ];
  EMPTY_COLLECTIONS.forEach(col => {
    if(!DB._cache[col]) DB._cache[col] = [];
    // localStorage: لا نكتب إليه هنا — onSnapshot هو اللي يكتب الـ backup
  });

  localStorage.setItem('ha_seeded_v2','1');
}

