// SETTINGS
function saveSettings(){
  // anthropicKey حساس — يُخزَّن في localStorage فقط، لا يُرفع لـ Firestore
  const anthropicKey = gv('s-anthropic-key');
  try { if(anthropicKey) localStorage.setItem('ha_anthropic_key', anthropicKey); } catch(e){}

  // باقي الإعدادات (بدون anthropicKey) ترفع لـ Firestore
  const s={clinicName:gv('s-cname'),phone:gv('s-cphone'),managerName:gv('s-mname'),managerRole:gv('s-mrole')};
  // تحديث الاسم/الدور فورًا على الشاشة الرئيسية والشريط الجانبي
  if(s.managerName){txt('user-name',s.managerName);txt('dash-uname',s.managerName);}
  if(s.managerRole)txt('user-role',s.managerRole);
  // حفظ الاسم الجديد في حساب المستخدم الحالي
  if(window._session && window._session.username){
    const udb=getUsersDB();
    const cu=udb[window._session.username];
    if(cu && s.managerName){ cu.name=s.managerName; saveUsersDB(udb); }
  }
  // Firestore هو مصدر الحقيقة — احفظ فيه أولاً
  if(window._firestore){
    window._firestore.collection('config').doc('settings').set(s)
      .then(()=>{
        // بعد النجاح: حدّث الـ cache + localStorage كنسخة احتياطية
        DB._cache['settings'] = s;
        try { localStorage.setItem('ha_settings', JSON.stringify(s)); } catch(e){}
        showToast('success','✅ تم حفظ الإعدادات وتزامنها على جميع الأجهزة ☁️');
      })
      .catch(e=>{
        // فشل الكتابة لـ Firestore → احفظ محلياً مع وضعه في الـ queue
        DB._cache['settings'] = s;
        try { localStorage.setItem('ha_settings', JSON.stringify(s)); } catch(err){}
        OQ.push({type:'set', col:'config', id:'settings', data:s, ts: Date.now()});
        updateQueueBadge();
        showToast('warning','⚠️ تم الحفظ محلياً — سيُزامَن عند عودة الاتصال');
      });
  } else {
    // Offline — احفظ محلياً + ضع في الـ queue
    DB._cache['settings'] = s;
    try { localStorage.setItem('ha_settings', JSON.stringify(s)); } catch(err){}
    OQ.push({type:'set', col:'config', id:'settings', data:s, ts: Date.now()});
    updateQueueBadge();
    showToast('warning','⚠️ تم الحفظ محلياً — سيُزامَن عند الاتصال بـ Firebase 💾');
  }
}

// Load settings from Firestore into _cache (called after Firebase init)
async function loadSettingsFromFirestore(){
  if(!window._firestore) return;
  try {
    const doc = await window._firestore.collection('config').doc('settings').get();
    if(doc.exists){
      const remote = doc.data();
      // anthropicKey لا يُرفع لـ Firestore — أزله لو موجود من بيانات قديمة
      if(remote.anthropicKey){
        // انقله لـ localStorage المحلي لو لم يكن موجوداً، ثم احذفه من Firestore
        const localKey = localStorage.getItem('ha_anthropic_key');
        if(!localKey) try { localStorage.setItem('ha_anthropic_key', remote.anthropicKey); } catch(e){}
        delete remote.anthropicKey;
        // احذف من Firestore لتنظيف البيانات القديمة
        window._firestore.collection('config').doc('settings').update({ anthropicKey: firebase.firestore.FieldValue.delete() })
          .catch(()=>{}); // تجاهل الخطأ لو فشل
      }
      // Firestore يفوز دايماً — ضع في الـ cache
      DB._cache['settings'] = remote;
      // حدّث localStorage كنسخة احتياطية فقط
      try { localStorage.setItem('ha_settings', JSON.stringify(remote)); } catch(e){}
      // Update UI if fields are visible
      const fill = (id, val) => { const el=document.getElementById(id); if(el&&val)el.value=val; };
      fill('s-cname', remote.clinicName);
      fill('s-cphone', remote.phone);
      fill('s-mname', remote.managerName);
      fill('s-mrole', remote.managerRole);
      // anthropicKey من localStorage فقط (لا يُخزَّن في Firestore)
      const localKey = localStorage.getItem('ha_anthropic_key')||'';
      fill('s-anthropic-key', localKey);
    }
    // Listen for live changes (another device saves settings)
    window._firestore.collection('config').doc('settings').onSnapshot(doc=>{
      if(doc.exists){
        const remote=doc.data();
        // Firestore يفوز دايماً
        DB._cache['settings'] = remote;
        try { localStorage.setItem('ha_settings', JSON.stringify(remote)); } catch(e){}
      }
    });
  } catch(e){ console.warn('loadSettingsFromFirestore:', e.message); }
}
function loadSettings(){
  // الـ cache (Firestore) هو المصدر الوحيد — localStorage فقط لو offline
  const s = DB._cache['settings'] ||
    (!window._fbReady ? (()=>{ try{ return JSON.parse(localStorage.getItem('ha_settings')||'{}'); }catch{return{};} })() : {});
  // ملاحظة: لا نُحدّث user-name/user-role/dash-uname من هنا، لأنها مرتبطة بحساب المستخدم الفعلي
  ['s-cname','s-cphone','s-mname','s-mrole'].forEach((id,i)=>{const e=document.getElementById(id);if(e)e.value=[s.clinicName,s.phone,s.managerName,s.managerRole][i]||e.value;});
  // anthropicKey من localStorage المخصص فقط (لا يُخزَّن في Firestore)
  const akEl=document.getElementById('s-anthropic-key');
  if(akEl){ akEl.value = localStorage.getItem('ha_anthropic_key') || s.anthropicKey || ''; }
}
// ══════════════════════════════════════════
// 🔥 FIREBASE REAL INTEGRATION
// ══════════════════════════════════════════
window._fbReady = false;
window._fbListeners = {}; // active onSnapshot listeners

async function saveFB(){
  const cfg = {
    apiKey:            gv('fb-key').trim(),
    authDomain:        gv('fb-auth').trim(),
    projectId:         gv('fb-proj').trim(),
    storageBucket:     gv('fb-stor').trim(),
    messagingSenderId: gv('fb-send').trim(),
    appId:             gv('fb-app').trim()
  };
  if(!cfg.apiKey || !cfg.projectId){
    showToast('warning','⚠️ API Key و Project ID مطلوبان');
    return;
  }
  // Save config — ha_fb_config هو المفتاح الرسمي
  // ha_firebase_config للتوافق مع login.html (نفس القيمة دائماً)
  const _cfgStr = JSON.stringify(cfg);
  localStorage.setItem('ha_fb_config',       _cfgStr);
  localStorage.setItem('ha_firebase_config', _cfgStr);
  showToast('info','🔥 جارٍ الاتصال بـ Firebase...');
  await initFirebase(cfg);
}

async function initFirebase(cfg){
  try {
    // Dynamically load Firebase SDK v9 compat (CDN)
    if(!window.firebase){
      await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js');
    }

    // Initialize or get existing app
    if(window.firebase.apps.length === 0){
      window.firebase.initializeApp(cfg);
    }
    const db = window.firebase.firestore();

    // Test connection with a lightweight read
    await db.collection('settings').limit(1).get();

    window._firestore = db;
    window._fbReady = true;

    // Update connection indicator
    txt('conn-txt','متصل بـ Firebase ☁️');
    const dot = document.getElementById('conn-dot');
    if(dot) dot.style.background = 'var(--emerald)';

    showToast('success','✅ تم الاتصال بـ Firebase بنجاح','البيانات ستُزامَن تلقائياً');

    // Start syncing all collections
    const COLLECTIONS = [
      'patients','appointments','inventory','invoices','invoice_items',
      'services','leads','doctors','staff','expenses','branches',
      'campaigns','packages','sessions','waitlist','rooms','equipment',
      'suppliers','purchases','purchase_items','visits','inventory_transactions',
      'cashlog','installments','photos','audit_log','transfers',
      // ✅ FIX (مراجعة شاملة): هذه الأربعة كانت تُكتب إلى Firestore (موجودة في DB._fb بـ 00-core.js)
      // لكن لم يكن لها أي مستمع onSnapshot هنا — فكانت تختفي من الذاكرة المحلية (تُقرأ كـ [])
      // بمجرد إعادة تحميل الصفحة، رغم أنها محفوظة فعلياً في القاعدة. هذا كان يُسبب:
      // مديونية موردين وهمية (تتجاهل الدفعات السابقة)، صرف رواتب دون خصم السلف الحقيقية،
      // واختفاء سجل مبيعات المنتجات وبيانات أرباح/تكاليف الجلسات بعد كل refresh.
      'supplier_payments','advances','product_sales','session_completions',
      // ✅ FIX (نظام الاستدعاء): كانت استدعاءات الطبيب للعميل لا تظهر في شاشة الاستقبال
      // لأن call_queue لم تكن مضمنة في قائمة المجموعات المتزامنة. الآن تزامن حقيقي
      // بين شاشة الطبيب والاستقبال دون تأخير.
      'call_queue',
      // ✅ FIX جذري (السبب الحقيقي وراء اختفاء ميزان المراجعة بعد كل refresh
      // وتكرار قيود الترحيل التاريخي): الطبقة المحاسبية بالكامل كانت موجودة
      // في DB._fb (00-core.js) فتُكتب لـ Firestore بنجاح، لكن غايبة تمامًا عن
      // قايمة المزامنة اللحظية هنا. النتيجة: أي قيد بيتسجل في نفس الجلسة كان
      // بيظهر مؤقتًا (Optimistic cache)، لكن بمجرد أي تحديث للصفحة كان الكاش
      // المحلي بيرجع فاضي تمامًا (مفيش مستمع onSnapshot يجيب البيانات تاني من
      // Firestore) — فيبان الميزان فاضي، وتشغيل "الترحيل التاريخي" تاني كان
      // بيفتكر إن مفيش قيود موجودة أصلاً (hasEntry() بتتحقق من كاش فاضي) ويعيد
      // إنشاء نفس القيود من جديد فوق القديمة الفعلية المخزّنة في Firestore —
      // وده بالظبط سبب تضاعف الأرقام (800 ← 1600) اللي ظهر في الاختبار.
      'chart_of_accounts', 'journal_entries', 'accounting_periods', 'vouchers'
    ];
    COLLECTIONS.forEach(col => attachFirestoreSync(col));

    // ✅ FIX حرج: الاتصال التلقائي بـ Firebase عند تحميل الصفحة بيحصل بعد
    // تأخير setTimeout (1.5 ثانية). أي بيانات تتسجّل في النافذة دي قبل
    // اكتمال الاتصال (_fbReady لسه false) كانت بتتسجّل محلياً (Optimistic UI)
    // ثم تترمى في طابور انتظار (OQ) بدل ما تتبعت لـ Firestore فوراً. الطابور
    // ده ماكنش بيتفرّغ تلقائياً أبداً — بس عند ضغطة "مزامنة" يدوية أو حدث
    // 'online' الفعلي (إعادة اتصال بعد انقطاع نت). فلو حد سجّل بيانات في
    // هالـ 1.5 ثانية، كانت بتفضل عالقة محلياً للأبد وتختفي من الواجهة بمجرد
    // ما أول onSnapshot يجيب بيانات السيرفر الحقيقية (اللي مفيهاش التسجيل
    // الجديد لإنه لسه متأخر في الطابور). الحل: نفرّغ الطابور فوراً هنا بمجرد
    // ما الاتصال يكتمل فعلياً، مش ننتظر مزامنة يدوية أو حدث online.
    if(typeof flushOfflineQueue === 'function' && OQ.size() > 0){
      await flushOfflineQueue();
    }

    // Load shared settings (API key, clinic name, etc.) from Firestore
    await loadSettingsFromFirestore();

    // ── مزامنة المستخدمين في الوقت الفعلي ──
    // لو جهاز ثاني أضاف/عدّل مستخدم، يتحدث تلقائياً
    if(window._fbListeners['users']) window._fbListeners['users']();
    window._fbListeners['users'] = window._firestore.collection('users')
      .onSnapshot(snapshot => {
        if(snapshot.empty) return;
        const usersObj = {};
        snapshot.forEach(doc => {
          const u = doc.data();
          if(u.username) usersObj[u.username] = u;
        });
        // Firestore يفوز دايماً — حدّث الـ cache مباشرة
        window._usersCache = usersObj;
        // حدّث localStorage كنسخة احتياطية offline فقط
        try { localStorage.setItem(USERS_KEY, JSON.stringify(usersObj)); } catch(e){}
        // ✅ FIX (مزامنة لحظية — مرحلة 3): لو شاشة المستخدمين مفتوحة وقت
        // التغيير (مثلاً جهاز تاني ضاف موظف جديد)، حدّثها فورًا من غير ما
        // تحتاج تقفل التاب وتفتحه تاني.
        const usersTabVisible = document.getElementById('se-perm')?.style.display === 'block';
        if(usersTabVisible && typeof renderUsers === 'function') renderUsers();
      }, err => console.warn('Firestore users listener error:', err.message));

  } catch(err) {
    console.error('Firebase init error:', err);
    const msg = err.code === 'permission-denied'
      ? 'تحقق من قواعد Firestore Security Rules'
      : err.message || 'فشل الاتصال';
    showToast('error', '❌ خطأ في الاتصال', msg);
    window._fbReady = false;
  }
}

function loadScript(src){
  return new Promise((resolve, reject) => {
    if(document.querySelector(`script[src="${src}"]`)){resolve();return;}
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── Attach a realtime listener for one collection ──
function attachFirestoreSync(col){
  if(!window._firestore) return;
  // Unsubscribe previous listener if any
  if(window._fbListeners[col]) window._fbListeners[col]();

  window._fbListeners[col] = window._firestore
    .collection(col)
    .onSnapshot(snapshot => {
      const docs = [];
      snapshot.forEach(doc => docs.push({...doc.data(), id: doc.id}));
      // ✅ Firestore هو مصدر الحقيقة — دايماً نحدث الـ cache منه
      // لو الـ collection فاضية في Firestore → نمسح الـ cache (ده قرار عمد)
      // لو مكنش فيه Firestore بيانات قبل كده → نستعمل localStorage كـ fallback أولي
      const prev = DB._cache[col] || [];
      // ✅ كشف التغيير الحقيقي: عدد المستندات أو محتواها (بما فيه التعديلات)
      const prevStr = JSON.stringify(prev.map(d=>d.id).sort());
      const newStr  = JSON.stringify(docs.map(d=>d.id).sort());
      const countChanged   = docs.length !== prev.length;
      const idsChanged     = prevStr !== newStr;
      // تحقق من تغيير المحتوى (تعديلات من أجهزة أخرى)
      const contentChanged = !countChanged && !idsChanged && window._fbFirstSync && window._fbFirstSync[col]
        ? JSON.stringify(docs) !== JSON.stringify(prev)
        : false;
      const changed = countChanged || idsChanged || contentChanged;
      // سواء Firestore فاضية أو لأ — هي مصدر الحقيقة، حدّث الـ cache دايماً
      DB._cache[col] = docs;
      // حدّث localStorage كنسخة احتياطية offline فقط
      try { localStorage.setItem('ha_' + col, JSON.stringify(docs)); } catch(e){}
      // ✅ أطلق EventBus لكل تغيير (إضافة أو تعديل أو حذف) من أي جهاز آخر
      if(changed && window._fbFirstSync && window._fbFirstSync[col]){
        EventBus.emit(col + ':remote-sync', { docs });
        EventBus.emit('db:changed', { collection: col, action: 'remote-sync' });
        // لو الباقات أو الفواتير تغيّرت من جهاز آخر → أعد حساب الماليات
        if((col==='invoices'||col==='packages'||col==='installments')&&typeof _recalcPatFinancials==='function'){
          const patIds = new Set(docs.map(d=>d.patId||d.patientId).filter(Boolean));
          patIds.forEach(pid => { try{ _recalcPatFinancials(pid); }catch(e){} });
        }
      }
      _scheduleUIRefresh(col);
      // أول sync → شيل loading indicator لو موجود
      if(!window._fbFirstSync) window._fbFirstSync = {};
      if(!window._fbFirstSync[col]){
        window._fbFirstSync[col] = true;
        const allCols = ['patients','appointments','invoices','inventory','services','doctors','staff','expenses','leads','branches'];
        if(allCols.every(c => window._fbFirstSync[c])){
          const syncEl = document.getElementById('fb-sync-indicator');
          if(syncEl) syncEl.style.display = 'none';
          if(typeof dashHideSkeleton === 'function') dashHideSkeleton();
          if(typeof buildDashboard === 'function') buildDashboard();
        }
      }
    }, err => {
      console.error('Firestore listener error on', col, err);
    });
}

// ══════════════════════════════════════════
// 📦 OFFLINE QUEUE SYSTEM
// ══════════════════════════════════════════
const OQ = {
  _key: 'ha_offline_queue',
  get(){ try{ return JSON.parse(localStorage.getItem(this._key))||[]; }catch{ return []; } },
  push(op){ const q=this.get(); q.push(op); localStorage.setItem(this._key,JSON.stringify(q)); },
  clear(){ localStorage.removeItem(this._key); },
  set(q){ localStorage.setItem(this._key,JSON.stringify(q)); },
  size(){ return this.get().length; }
};

// Update queue badge in connection bar
function updateQueueBadge(){
  const n = OQ.size();
  const el = document.getElementById('conn-txt');
  if(!el) return;
  if(n > 0 && !window._fbReady){
    el.textContent = `وضع محلي 💾 · ${n} عملية معلقة`;
  } else if(n > 0 && window._fbReady){
    el.textContent = `متصل بـ Firebase ☁️ · جارٍ المزامنة...`;
  } else if(window._fbReady){
    el.textContent = `متصل بـ Firebase ☁️`;
  } else {
    el.textContent = `وضع محلي 💾`;
  }
}

// ── Write a single record to Firestore (with queue fallback) ──
async function fbSet(col, id, data){
  if(!window._fbReady || !window._firestore){
    // Offline: save to queue
    OQ.push({type:'set', col, id:String(id), data, ts: Date.now()});
    updateQueueBadge();
    return;
  }
  try {
    await window._firestore.collection(col).doc(String(id)).set(data, {merge: true});
  } catch(e){
    // Network error mid-session: queue it
    console.warn('Firestore write error, queuing:', e.message);
    OQ.push({type:'set', col, id:String(id), data, ts: Date.now()});
    updateQueueBadge();
  }
}

// ── Delete a single record from Firestore (with queue fallback) ──
async function fbDel(col, id){
  if(!window._fbReady || !window._firestore){
    OQ.push({type:'del', col, id:String(id), ts: Date.now()});
    updateQueueBadge();
    return;
  }
  try {
    await window._firestore.collection(col).doc(String(id)).delete();
  } catch(e){
    console.warn('Firestore delete error, queuing:', e.message);
    OQ.push({type:'del', col, id:String(id), ts: Date.now()});
    updateQueueBadge();
  }
}

// ── Flush offline queue to Firestore ──
async function flushOfflineQueue(){
  const queue = OQ.get();
  if(queue.length === 0) return;
  if(!window._fbReady || !window._firestore) return;

  const failed = [];
  for(const op of queue){
    try {
      if(op.type === 'set'){
        await window._firestore.collection(op.col).doc(op.id).set(op.data, {merge: true});
      } else if(op.type === 'del'){
        await window._firestore.collection(op.col).doc(op.id).delete();
      }
    } catch(e){
      failed.push(op); // keep failed ops for next retry
    }
  }

  if(failed.length === 0){
    OQ.clear();
    const synced = queue.length;
    showToast('success', `☁️ تمت المزامنة`, `${synced} عملية معلقة تمت مزامنتها`);
  } else {
    OQ.set(failed);
    showToast('warning', `⚠️ مزامنة جزئية`, `${queue.length - failed.length} نجحت، ${failed.length} فشلت`);
  }
  updateQueueBadge();
}

// ── Listen to online/offline events ──
window.addEventListener('online', async () => {
  txt('conn-txt', 'جارٍ إعادة الاتصال...');
  const saved = localStorage.getItem('ha_fb_config');
  if(saved && !window._fbReady){
    try{ await initFirebase(JSON.parse(saved)); } catch(e){}
  }
  if(window._fbReady && OQ.size() > 0){
    await flushOfflineQueue();
  }
  updateQueueBadge();
});

window.addEventListener('offline', () => {
  txt('conn-txt', 'غير متصل بالنت 📴');
  const dot = document.getElementById('conn-dot');
  if(dot) dot.style.background = 'var(--rose)';
});

// ── Upload full localStorage collection to Firestore (first-time seed) ──
async function uploadSeedToFirestore(){
  if(!window._fbReady || !window._firestore){
    showToast('warning','⚠️ اتصل بـ Firebase أولاً');
    return;
  }
  const SEED_COLS = [
    'patients','appointments','inventory','invoices','invoice_items',
    'services','leads','doctors','staff','expenses','branches',
    'rooms','equipment','suppliers','purchases','purchase_items',
    'sessions','packages','cashlog','installments','photos','transfers','audit_log',
    // ✅ FIX: كانت غائبة فلا تُرفع لـ Firestore عند الترحيل من بيانات محلية
    'supplier_payments','inventory_transactions','advances','product_sales','session_completions'
  ];
  let total = 0;
  showToast('info','☁️ جارٍ رفع البيانات إلى Firebase...');
  for(const col of SEED_COLS){
    const items = DB.get(col);
    if(!items.length) continue;
    // Firestore batch max 500 — split if needed
    const chunks = [];
    for(let i=0;i<items.length;i+=400) chunks.push(items.slice(i,i+400));
    for(const chunk of chunks){
      const batch = window._firestore.batch();
      chunk.forEach(item => {
        const ref = window._firestore.collection(col).doc(String(item.id));
        batch.set(ref, item, {merge: true});
      });
      await batch.commit();
      total += chunk.length;
    }
  }
  // رفع المستخدمين إلى Firestore حتى يتمكن الجهاز الثاني من تسجيل الدخول
  try {
    const usersObj = getUsersDB();
    const batch = window._firestore.batch();
    Object.entries(usersObj).forEach(([username, userData]) => {
      const ref = window._firestore.collection('users').doc(username);
      batch.set(ref, {...userData, username}, {merge: true});
    });
    await batch.commit();
    total += Object.keys(usersObj).length;
  } catch(e){ console.warn('Users seed error:', e.message); }

  showToast('success', `☁️ تم رفع ${total} سجل إلى Firebase`);
}

// ── Wipe Firestore collections and re-seed from localStorage ──
async function migrateToFirestore(){
  if(!window._fbReady || !window._firestore){
    showToast('warning','⚠️ اتصل بـ Firebase أولاً');
    return;
  }
  if(!confirm('⚠️ سيتم مسح جميع بيانات Firestore واستبدالها بالبيانات المحلية الصحيحة.\n\nهل أنت متأكد؟')) return;

  showToast('info','🔄 جارٍ الترحيل...');

  const COLS_TO_WIPE = [
    'patients','appointments','inventory','invoices','invoice_items',
    'services','leads','doctors','staff','expenses','branches',
    'rooms','equipment','suppliers','purchases','purchase_items',
    'visits','sessions','packages','waitlist','campaigns','audit_log',
    'transfers','cashlog','installments','photos',
    // ✅ FIX: كانت غائبة فتبقى بيانات قديمة في Firestore حتى بعد "ترحيل/مسح كامل"
    'supplier_payments','inventory_transactions','advances','product_sales','session_completions'
  ];

  // Step 1: Wipe existing Firestore docs
  for(const col of COLS_TO_WIPE){
    try{
      const snap = await window._firestore.collection(col).limit(200).get();
      if(snap.empty) continue;
      const batch = window._firestore.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }catch(e){ console.warn('Wipe error on', col, e); }
  }

  // Step 2: Re-seed from localStorage
  await uploadSeedToFirestore();

  // Step 3: Write config/settings
  try{
    const settings = DB.obj('settings');
    await window._firestore.collection('config').doc('settings').set(settings, {merge:true});
  }catch(e){}

  showToast('success','✅ اكتمل الترحيل — Firestore الآن يحتوي schema v2 صحيح');
}

// ✅ DB.push/upd/del تستدعي fbSet/fbDel تلقائياً من 00-core.js
// لا حاجة لأي patch إضافي هنا — تم حذفه لتجنب double-write لـ Firestore

// Flush any pending queue after Firebase connects
// ✅ FIX حرج: كانت هنا setTimeout(flushOfflineQueue, 1000) بدون await — أي
// تأخير إضافي بعد اتصال Firebase بينفتح فيه نفس نافذة الخطر اللي بسببها
// بيانات بتتسجّل وتفضل عالقة في الطابور (OQ) من غير ما تتبعت فعلياً، ولو
// المستخدم عمل F5 سريع قبل ما الـ timeout يشتغل، العملية المعلَّقة بتتقطع
// (الصفحة بتعاد تحميلها وتاخد طابور جديد) بدل ما تتزامن. الحل: await فوري
// بمجرد ما _fbReady = true، بدون أي تأخير صناعي إضافي.
const _origInitFirebase = initFirebase;
initFirebase = async function(cfg){
  await _origInitFirebase(cfg);
  if(window._fbReady && OQ.size() > 0){
    await flushOfflineQueue();
  }
  updateQueueBadge();
};

// ── Test connection ──
async function testFBConnection(){
  if(!window._fbReady || !window._firestore){
    showToast('warning','⚠️ Firebase غير متصل — احفظ الإعدادات أولاً');
    return;
  }
  showToast('info','🧪 جارٍ اختبار الاتصال...');
  try {
    const start = Date.now();
    await window._firestore.collection('settings').limit(1).get();
    const ms = Date.now() - start;
    showToast('success', `✅ الاتصال يعمل`, `زمن الاستجابة: ${ms}ms`);
  } catch(e) {
    showToast('error', '❌ فشل الاتصال', e.message);
  }
}

// ── Schema v2 info popup ──
function showSchemaInfo(){
  const html=`
  <div style="font-size:13px;line-height:1.9;direction:rtl;">
    <div style="font-weight:700;color:var(--gold-light);margin-bottom:10px;">📐 Collections في Schema v2</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;">
      <div>✅ <strong>patients</strong> — UUID + audit fields</div>
      <div>✅ <strong>appointments</strong> — patientId + doctorId</div>
      <div>✅ <strong>visits</strong> — رحلة المريض الكاملة</div>
      <div>✅ <strong>invoices</strong> — patientId (بدل اسم)</div>
      <div>✅ <strong>invoice_items</strong> — جدول مستقل</div>
      <div>✅ <strong>services</strong> — doctorId + roomId</div>
      <div>✅ <strong>inventory</strong> — branchId + cost</div>
      <div>✅ <strong>inventory_transactions</strong> — تتبع المخزون</div>
      <div>✅ <strong>suppliers</strong> — جديد</div>
      <div>✅ <strong>purchases</strong> — supplierId</div>
      <div>✅ <strong>purchase_items</strong> — productId</div>
      <div>✅ <strong>doctors</strong> — commissionType</div>
      <div>✅ <strong>branches</strong> — كامل</div>
      <div>✅ <strong>packages</strong> / <strong>sessions</strong></div>
      <div>✅ <strong>leads</strong> / <strong>campaigns</strong></div>
      <div>✅ <strong>staff</strong> / <strong>expenses</strong></div>
    </div>
    <div style="margin-top:12px;padding:10px;background:rgba(16,185,129,.08);border-radius:8px;font-size:12px;color:var(--emerald);">
      كل جدول يحتوي: id(UUID) · createdAt · updatedAt · createdBy · updatedBy · isDeleted · version · branchId
    </div>
  </div>`;
  // Reuse existing modal or alert
  alert('Schema v2 يشمل 20 collection مترابطة بـ UUID حقيقي.\nافتح الـ console لرؤية البيانات: JSON.parse(localStorage.getItem("ha_patients"))');
}

// ── Disconnect Firebase ──
function disconnectFirebase(){
  // Unsubscribe all listeners
  Object.values(window._fbListeners).forEach(unsub => { try{ unsub(); }catch(e){} });
  window._fbListeners = {};
  window._fbReady = false;
  window._firestore = null;
  localStorage.removeItem('ha_fb_config');
  localStorage.removeItem('ha_firebase_config');
  txt('conn-txt','وضع محلي 💾');
  const dot = document.getElementById('conn-dot');
  if(dot) dot.style.background = 'var(--amber)';
  showToast('info','🔌 تم قطع الاتصال بـ Firebase');
}

// ── Auto-connect on page load — config ثابت في الكود ──
(function autoConnectFirebase(){
  const cfg = {
    apiKey: "AIzaSyCSRzNyTLgcyCbFNXlIE4CbBGEJ943bMYg",
    authDomain: "life-clinics2.firebaseapp.com",
    projectId: "life-clinics2",
    storageBucket: "life-clinics2.firebasestorage.app",
    messagingSenderId: "1095839174310",
    appId: "1:1095839174310:web:eac6d293e473cfafed6e67",
    measurementId: "G-9TVH7J2N9E"
  };
  const F = {apiKey:'fb-key',authDomain:'fb-auth',projectId:'fb-proj',storageBucket:'fb-stor',messagingSenderId:'fb-send',appId:'fb-app'};
  Object.entries(F).forEach(([k,id])=>{ const e=document.getElementById(id); if(e) e.value=cfg[k]||''; });
  const _cfgStr = JSON.stringify(cfg);
  localStorage.setItem('ha_fb_config', _cfgStr);
  localStorage.setItem('ha_firebase_config', _cfgStr);
  setTimeout(()=>initFirebase(cfg), 1500);
})();
function toggleSw(el){const on=el.style.background.includes('2DD4BF')||el.style.background.includes('teal');el.style.background=on?'var(--glass-border)':'var(--teal)';const k=el.querySelector('div');if(k)k.style.cssText=`width:19px;height:19px;background:#fff;border-radius:50%;position:absolute;top:2px;transition:.2s;${on?'left:2px':'right:2px'}`;}
function exportAll(){
  // ✅ FIX: كانت قائمة التصدير ناقصة supplier_payments وغيرها — فالنسخة
  // الاحتياطية لم تكن تشمل دفعات الموردين والسلف ومبيعات المنتجات إطلاقاً
  const ALL_COLS=['patients','appointments','inventory','invoices','invoice_items','services','leads','doctors','staff','expenses','branches','rooms','equipment','suppliers','supplier_payments','purchases','purchase_items','sessions','packages','waitlist','campaigns','transfers','cashlog','installments','photos','audit_log','inventory_transactions','advances','product_sales','session_completions'];
  const d={};
  ALL_COLS.forEach(k=>{d[k]=DB.get(k);});
  d.settings=DB.obj('settings');
  d.exportedAt=new Date().toISOString();
  d.schemaVersion=2;
  const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`alhaya-backup-v2-${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.json`;a.click();
  showToast('success','📥 تم تصدير البيانات (Schema v2)');
}
// ══════════════════════════════════════════════════════════════════
// 🗑️ CLEAR ALL — يحذف كل البيانات من Firestore + localStorage
//    العملية لحظية: كل مجموعة تُحذف doc-by-doc عبر DB.del
//    مما يطلق fbDel → Firestore فوراً
// ══════════════════════════════════════════════════════════════════
// ✅ FIX (سبب ظهور أرقام مالية "وهمية" بعد حذف البيانات): كانت هذه القائمة
// لا تشمل supplier_payments و advances و product_sales و session_completions —
// فعند استخدام "حذف كل البيانات" أو حذف تجميعة بعينها (مثل الموردين أو
// المشتريات)، تظل سجلات دفعات الموردين/السلف/مبيعات المنتجات قديمة في
// Firestore دون حذف، فتستمر مجاميعها (مثل "إجمالي المدفوعات") بالظهور
// بأرقام من بيانات يظن المستخدم أنه حذفها فعلاً.
const _ALL_COLLECTIONS = [
  'patients','appointments','invoices','invoice_items',
  'cashlog','installments','packages','sessions','photos',
  'inventory','inventory_transactions','purchases','purchase_items',
  'expenses','suppliers','supplier_payments','leads','services','doctors','staff',
  'branches','rooms','equipment','campaigns','waitlist',
  'visits','audit_log','transfers','advances','product_sales','session_completions',
  // ✅ FIX (ميزان المراجعة بيطلع مضاعف/غلط بعد "حذف كل البيانات"):
  // القائمة دي ماكنتش شايلة مجموعات الطبقة المحاسبية (المرحلة 0 من دليل التطوير)،
  // فكانت journal_entries/vouchers القديمة فاضلة في Firestore رغم حذف
  // invoices/cashlog/packages، فالقيود القديمة بتتجمع فوق القيود الجديدة
  // وتضاعف أرصدة زي إيراد الباقات وذمم العملاء في ميزان المراجعة.
  'chart_of_accounts','journal_entries','accounting_periods','vouchers'
];

async function clearAll(){
  if(!confirm('⚠️ تحذير: سيتم حذف كل البيانات من Firebase و الجهاز!\n\nهذا لا يمكن التراجع عنه. هل أنت متأكد تماماً؟')) return;
  if(!confirm('تأكيد أخير: حذف كل بيانات العيادة من Firestore؟')) return;

  showToast('info', '⏳ جارٍ حذف البيانات من Firebase...');

  // ── 1. إيقاف كل الـ onSnapshot listeners أولاً لمنع Firestore من إعادة تحميل البيانات ──
  if(window._fbListeners){
    Object.values(window._fbListeners).forEach(unsub => { try{ unsub(); }catch(e){} });
    window._fbListeners = {};
  }

  let totalDeleted = 0;

  // ── 2. بدل DB.del (اللي بيطلق EventBus ويخلق race conditions)
  //       نمسح الـ cache + localStorage فوراً ثم نحذف من Firestore بـ batch ──
  for(const col of _ALL_COLLECTIONS){
    // snapshot من الـ IDs قبل أي تعديل
    const ids = (DB.get(col)||[]).map(r => r.id).filter(Boolean);

    // مسح الـ cache + localStorage فوراً (بدون EventBus)
    DB._cache[col] = [];
    try{ localStorage.setItem('ha_' + col, '[]'); }catch(e){}

    // حذف من Firestore بـ batch (max 500 per batch)
    if(window._fbReady && window._firestore && ids.length){
      const BATCH_SIZE = 400;
      for(let i = 0; i < ids.length; i += BATCH_SIZE){
        const batch = window._firestore.batch();
        ids.slice(i, i + BATCH_SIZE).forEach(id => {
          batch.delete(window._firestore.collection(col).doc(String(id)));
        });
        try{ await batch.commit(); }catch(e){ console.warn('batch delete error on', col, e.message); }
      }
    }
    totalDeleted += ids.length;
  }

  // ── 3. مسح الذاكرة المحلية بالكامل (localStorage + cache) ──
  // مسح كل collections من localStorage حتى لا يعيد uploadSeedToFirestore رفعها
  for(const col of _ALL_COLLECTIONS){
    try{ localStorage.removeItem('ha_' + col); }catch(e){}
    DB._cache[col] = [];
  }
  localStorage.removeItem('ha_seeded');
  localStorage.removeItem('ha_seeded_v2');
  localStorage.removeItem('ha_offline_queue');
  window._fbFirstSync = {};

  showToast('success', 'تم حذف ' + totalDeleted + ' سجل من Firebase', 'سيتم تحديث الصفحة...');

  // ── 4. إعادة تحميل الصفحة (يبدأ onSnapshot من صفر نظيف) ──
  setTimeout(() => { location.reload(); }, 2000);
}


// ══════════════════════════════════════════════════════════════════
// 🧹 تنظيف دفعات الموردين اليتيمة (Orphaned supplier_payments)
// ✅ FIX: كانت قوائم الحذف (clearAll / clearCollection القديمة) لا تشمل
// supplier_payments، فإذا حذف المستخدم موردين أو طلبات شراء سابقاً، ظلت
// دفعاتهم القديمة محفوظة في Firestore دون أن تشير لأي مورد موجود فعلياً،
// فتستمر "إجمالي المدفوعات" في شاشة الموردين بجمعها ضمن الإجمالي العام
// رغم أن المورد نفسه لم يعد موجوداً. هذه الأداة تحذف فقط الدفعات اليتيمة
// (المرتبطة بمورد محذوف) وتترك دفعات الموردين الحاليين سليمة تماماً.
// ══════════════════════════════════════════════════════════════════
async function cleanOrphanedSupplierPayments(){
  const validSupplierIds = new Set((DB.get('suppliers')||[]).map(s => s.id));
  const all = DB.get('supplier_payments')||[];
  const orphaned = all.filter(sp => !validSupplierIds.has(sp.supplierId));
  if(!orphaned.length){ showToast('info','✅ لا توجد دفعات يتيمة — كل البيانات سليمة'); return; }
  const totalOrphaned = orphaned.reduce((s,sp)=>s+(sp.amount||0),0);
  if(!confirm(`تم العثور على ${orphaned.length} دفعة مورد مرتبطة بموردين محذوفين، بإجمالي ${totalOrphaned.toLocaleString()} ج.\n\nهذا هو سبب ظهور رقم "إجمالي المدفوعات" أكبر من الصحيح. هل تريد حذف هذه الدفعات اليتيمة فقط (دفعات الموردين الحاليين لن تتأثر)؟`)) return;
  // ✅ FIX (نفس مشكلة delPat): forEach كانت بتطلق كل طلبات الحذف من غير
  // انتظار، فتوست النجاح كان بيظهر قبل ما يتأكد وصولها لـ Firestore. لو
  // المستخدم قفل التاب فور ظهور التوست، بعض الدفعات ممكن ترجع تاني.
  const _delPromises = orphaned.map(sp => DB.del('supplier_payments', sp.id));
  showToast('info', '⏳ جارٍ الحذف...');
  await Promise.all(_delPromises).then(()=>{
    showToast('success', `🧹 تم حذف ${orphaned.length} دفعة يتيمة بإجمالي ${totalOrphaned.toLocaleString()} ج — آمن تقفل الصفحة دلوقتي`);
  }).catch(err=>{
    console.error('[cleanOrphanedSupplierPayments] فشل حذف بعض السجلات:', err);
    showToast('error', '⚠️ فيه سجلات محتمل ماتحذفتش', 'افتح الصفحة وحاول تاني قبل ما تقفل المتصفح');
  });
  if(typeof renderSuppliers === 'function') renderSuppliers();
}

// ══════════════════════════════════════════════════════════════════
// 🩹 إصلاح أقساط البيع السريع القديمة (Orphaned quick-sell installments)
// ✅ FIX: قبل إصلاح saveQuickSell في 04-invoices.js، كان القسط التلقائي
// اللي بيتعمل لما عميل ياخد منتج بالتقسيط من "البيع السريع" بيتسجل من غير
// fromInvId. فكانت getPatientFinancialSummary / _recalcPatFinancials في
// 00-core.js بتعتبره قسط "مستقل" غير مرتبط بفاتورة، فتجمع متبقي الفاتورة
// + متبقي القسط مرة تانية فوق بعض — فيظهر "المتبقي" في ملف العميل مضاعفًا.
// الإصلاح الجديد بيتعامل مع أي عملية بيع سريع جديدة صح من الأول، لكن
// السجلات القديمة اللي اتعملت قبل الإصلاح لسه ناقصة fromInvId. الأداة دي
// بتدور على الأقساط دي وتحاول تربطها تلقائيًا بفاتورتها (نفس العميل، نفس
// الإجمالي، نفس المتبقي، نفس التاريخ، وفاتورة فيها منتجات) — وتسيب أي قسط
// مش واثقة من مطابقته من غير تغيير عشان محدش يتربط بفاتورة غلط.
// ══════════════════════════════════════════════════════════════════
async function fixQuickSellInstallments(){
  const installments = DB.get('installments')||[];
  const invoices = DB.get('invoices')||[];

  // أقساط بيع سريع "يتيمة": مالهاش fromInvId ولا fromPkgId، ومربوطة بمنتج
  const candidates = installments.filter(p =>
    !p.fromInvId && !p.fromPkgId && p.service && p.service.indexOf('منتج: ')===0
  );
  if(!candidates.length){ showToast('info','✅ لا توجد أقساط بيع سريع قديمة تحتاج إصلاح — كل البيانات سليمة'); return; }

  const matches = [];
  const unmatched = [];
  candidates.forEach(inst=>{
    const inv = invoices.find(iv =>
      (String(iv.patId)===String(inst.patientId) || String(iv.patientId)===String(inst.patientId)) &&
      Array.isArray(iv.products) && iv.products.length>0 &&
      (iv.total||0)===(inst.total||0) &&
      (iv.remaining||0)===(inst.remaining||0) &&
      iv.date===inst.startDate
    );
    if(inv) matches.push({inst, inv}); else unmatched.push(inst);
  });

  if(!matches.length){
    showToast('warning',`⚠️ فيه ${candidates.length} قسط بيع سريع قديم، لكن مقدرناش نلاقي الفاتورة المطابقة تلقائيًا — محتاجين مراجعة يدوية`);
    return;
  }

  const msg = `تم العثور على ${matches.length} قسط بيع سريع قديم غير مربوط بفاتورته (وده سبب مضاعفة "المتبقي" في ملف العميل).`
    + (unmatched.length ? `\n\n⚠️ ${unmatched.length} قسط تاني معندناش ثقة كافية في مطابقته تلقائيًا، هنسيبه من غير تغيير.` : '')
    + `\n\nهل تريد ربط الـ ${matches.length} قسط بفواتيرها الآن؟`;
  if(!confirm(msg)) return;

  matches.forEach(({inst, inv}) => DB.upd('installments', inst.id, { fromInvId: inv.id }));

  // إعادة حساب رصيد كل عميل متأثر فورًا عشان ملف العميل يتحدث على طول
  const affectedPatIds = [...new Set(matches.map(m => m.inst.patientId))];
  affectedPatIds.forEach(pid => { if(typeof _recalcPatFinancials === 'function') _recalcPatFinancials(pid); });

  showToast('success', `🩹 تم إصلاح ${matches.length} قسط`, 'بيانات ملف العميل هتتحدث تلقائيًا');
  if(typeof renderPatients === 'function') renderPatients();
}



async function clearCollection(col){
  if(!col || !_ALL_COLLECTIONS.includes(col)) return;
  const ids = (DB.get(col)||[]).map(r => r.id).filter(Boolean);
  if(!ids.length){ showToast('info', 'المجموعة ' + col + ' فارغة'); return; }
  if(!confirm('حذف كل بيانات "' + col + '" (' + ids.length + ' سجل) من Firebase؟')) return;

  // مسح فوري من الـ cache + localStorage
  DB._cache[col] = [];
  try{ localStorage.setItem('ha_' + col, '[]'); }catch(e){}

  // حذف batch من Firestore
  if(window._fbReady && window._firestore){
    const BATCH_SIZE = 400;
    for(let i = 0; i < ids.length; i += BATCH_SIZE){
      const batch = window._firestore.batch();
      ids.slice(i, i + BATCH_SIZE).forEach(id => {
        batch.delete(window._firestore.collection(col).doc(String(id)));
      });
      try{ await batch.commit(); }catch(e){ console.warn('batch delete error:', e.message); }
    }
  }
  showToast('success', 'تم حذف ' + ids.length + ' سجل من "' + col + '"');
}


// ══════════════════════════════════════════
// 🏢 BRANCHES — REAL DATA FROM DB
// ══════════════════════════════════════════
function renderBranches(){
  // ✅ FIX حرج: كان هنا "تلقيم" تلقائي لفرعين وهميين (مدينة نصر/المهندسين
  // بـ id ثابت br1/br2) في كل مرة تكون فيها قائمة الفروع فاضية. بما إن
  // delBranch() بينادي renderBranches() فورًا بعد كل حذف، فكانت النتيجة إن
  // أي حذف لآخر فرع (أو كل الفروع) بيرجّع نفس الفرعين الوهميين تاني فورًا —
  // وأحيانًا بييترفعوا فعليًا لـ Firestore لو حد ضغط "رفع البيانات" والـ
  // cache فيها وقتها البيانات الوهمية دي. الحل: منعرض شاشة فاضية حقيقية لو
  // مفيش فروع، من غير ما نخترع بيانات.
  const branches = DB.get('branches')||[];
  const patients = DB.get('patients');
  const invoices = DB.get('invoices');
  const doctors = DB.get('doctors');
  const staff = DB.get('staff');
  const appointments = DB.get('appointments');

  const grid = document.getElementById('branches-grid');
  if(!grid) return;

  const cards = branches.map((b,i)=>{
    const bName = b.name || '';
    // مطابقة بالاسم أو بالـ branchId
    const branchPats = patients.filter(p=>(p.branch||'').includes(bName)||(p.branchId||'')===(b.id||'')).length;
    // ✅ FIX (خطة التوحيد — مرحلة 1.2): مصدر الحقيقة الموحَّد لإيراد الفرع
    // (cashlog وارد فقط، يطابق نفس الرقم المعروض بدائرة "توزيع الفروع" بالداشبورد).
    // ⚠️ نستخدم bName (اسم الفرع) وليس b.id لأن حقل branch في invoices/cashlog
    // يخزَّن دائماً كاسم نصي — لا يوجد أي مكان في الكود يعبّئ branchId فعلياً،
    // فتمرير b.id كان سيُرجع صفراً دائماً لعدم وجود تطابق.
    const branchRevenue = getBranchRevenue(bName);
    const branchDocs = doctors.filter(d=>(d.branch||'').includes(bName)||(d.branchId||'')===(b.id||'')).length;
    const branchStaff = staff.filter(s=>(s.branch||'').includes(bName)||(s.branchId||'')===(b.id||'')).length;
    const todayAppts = appointments.filter(a=>((a.branch||'').includes(bName)||(a.branchId||'')===(b.id||''))&&a.date===new Date().toISOString().split('T')[0]).length;
    // دعم حقلي manager و managerName
    const managerName = b.manager || b.managerName || '';
    return `<div class="bcard">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <div>
          <div style="font-size:15px;font-weight:800;">🏢 ${bName}</div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">📍 ${b.address||'—'}</div>
          ${b.phone?`<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">📞 ${b.phone}</div>`:''}
        </div>
        <span class="ast ${(b.status||'نشط')==='نشط'?'sc':'sd'}">${b.status||'نشط'}</span>
      </div>
      <div class="g2c" style="gap:8px;margin-bottom:11px;">
        <div style="background:var(--glass);border-radius:8px;padding:9px;text-align:center;">
          <div style="font-size:18px;font-weight:800;color:var(--teal)">${branchPats||'—'}</div>
          <div style="font-size:11px;color:var(--text-muted)">عملاء</div>
        </div>
        <div style="background:var(--glass);border-radius:8px;padding:9px;text-align:center;">
          <div style="font-size:18px;font-weight:800;color:var(--gold-light)">${branchRevenue?Math.round(branchRevenue/1000)+'K':'—'}</div>
          <div style="font-size:11px;color:var(--text-muted)">إيرادات (ج)</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">
        ${branchDocs?`👩‍⚕️ ${branchDocs} طبيب`:''}${branchStaff?` · 👥 ${branchStaff} موظف`:''}
      </div>
      ${managerName?`<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">👤 مدير: ${managerName}</div>`:''}
      ${todayAppts?`<div style="font-size:12px;color:var(--teal);font-weight:600;margin-bottom:10px;">📅 ${todayAppts} موعد اليوم</div>`:''}
      <div style="display:flex;gap:7px;">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="showBranchReport('${bName}')">📊 تقرير</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="openBranchModal('${b.id}')">✏️ تعديل</button>
        <button class="btn btn-danger btn-sm" onclick="delBranch('${b.id}')">🗑</button>
      </div>
    </div>`;
  });

  cards.push(`<div class="bcard" style="border-style:dashed;opacity:.5;cursor:pointer;" onclick="openBranchModal()">
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:180px;gap:9px;">
      <div style="font-size:36px;">🏢</div>
      <div style="font-size:13.5px;font-weight:600;color:var(--text-muted)">إضافة فرع جديد</div>
    </div>
  </div>`);

  grid.innerHTML = cards.join('');
  // تحديث كل قوائم الفروع في البرنامج
  fillAllBranchSelects();
}

function showBranchReport(branchName){
  const br = generateBranchesReport ? generateBranchesReport() : null;
  if(!br) return;
  const bd = br.branchesTable?.find(b=>b.name===branchName);
  if(!bd){ showToast('info','ℹ️ لا توجد بيانات لهذا الفرع'); return; }
  showToast('info',`🏢 ${branchName}: ${bd.revenue.toLocaleString()} ج · ${bd.patients} عميل · ${bd.appointments} موعد`);
}

function openBranchModal(id){
  const b = id ? (DB.get('branches')||[]).find(x=>x.id===id) : null;
  let modal = document.getElementById('branch-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.className='modal-overlay';
    modal.id='branch-modal';
    modal.innerHTML=`<div class="modal" style="max-width:480px;">
      <div class="mhdr"><div class="mtitle" id="branch-modal-title">🏢 فرع جديد</div><button class="mclose" onclick="closeModal('branch-modal')">✕</button></div>
      <div class="mbody">
        <input type="hidden" id="branch-id">
        <div class="fg" style="gap:12px;">
          <div class="fgrp full"><label class="flbl">اسم الفرع</label><input class="fctl" id="branch-name" placeholder="مثال: المعادي"></div>
          <div class="fgrp full"><label class="flbl">العنوان</label><input class="fctl" id="branch-address" placeholder="الشارع والحي"></div>
          <div class="fgrp"><label class="flbl">الهاتف</label><input class="fctl" id="branch-phone" placeholder="010xxxxxxxx"></div>
          <div class="fgrp"><label class="flbl">المدير</label><input class="fctl" id="branch-manager" placeholder="د. اسم المدير"></div>
          <div class="fgrp"><label class="flbl">الحالة</label><select class="selbox" id="branch-status"><option>نشط</option><option>متوقف</option></select></div>
        </div>
      </div>
      <div class="mfoot">
        <button class="btn btn-ghost" onclick="closeModal('branch-modal')">إلغاء</button>
        <button class="btn btn-primary" onclick="saveBranch()">💾 حفظ</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal('branch-modal');});
  }
  document.getElementById('branch-modal-title').textContent = b ? '✏️ تعديل الفرع' : '🏢 فرع جديد';
  document.getElementById('branch-id').value = b?.id||'';
  document.getElementById('branch-name').value = b?.name||'';
  document.getElementById('branch-address').value = b?.address||'';
  document.getElementById('branch-phone').value = b?.phone||'';
  document.getElementById('branch-manager').value = b?.manager||'';
  document.getElementById('branch-status').value = b?.status||'نشط';
  openModal('branch-modal');
}

function saveBranch(){
  const name = document.getElementById('branch-name')?.value.trim();
  if(!name){ showToast('warning','⚠️ اسم الفرع مطلوب'); return; }
  const id = document.getElementById('branch-id')?.value;
  const data = {name, address:gv('branch-address'), phone:gv('branch-phone'), manager:gv('branch-manager'), status:gv('branch-status')};
  if(!DB.get('branches')) DB.set('branches',[]);
  if(id){ DB.upd('branches',id,data); showToast('success',`✅ تم تحديث فرع ${name}`); }
  else { DB.push('branches',data); showToast('success',`✅ تم إضافة فرع ${name}`); }
  closeModal('branch-modal');
  renderBranches();
  // تحديث كل قوائم الفروع في البرنامج فور الحفظ
  fillAllBranchSelects();
}

function delBranch(id){
  const b = (DB.get('branches')||[]).find(x=>x.id===id);
  if(confirm(`حذف فرع "${b?.name}"؟`)){ DB.del('branches',id); renderBranches(); fillAllBranchSelects(); showToast('info','🗑 تم حذف الفرع'); }
}

// ROOMS & EQUIPMENT
function fillResBranchSelect(id,cur){
  const sel=document.getElementById(id);if(!sel)return;
  sel.innerHTML=DB.get('branches').map(b=>`<option>${b.name}</option>`).join('')||'<option>مدينة نصر</option>';
  if(cur)sel.value=cur;
}

// ══════════════════════════════════════════
// 🏢 DYNAMIC BRANCH SELECTS — يملأ كل قوائم الفروع في البرنامج من قاعدة البيانات
// ══════════════════════════════════════════
function fillAllBranchSelects(){
  // ✅ FIX حرج (الفروع الوهمية — الجزء الثاني): الدالة كانت بترجع فورًا
  // (return) من غير ما تعمل أي حاجة لو مفيش فروع حقيقية في قاعدة البيانات
  // (branches.length === 0) — وده بالظبط حالة "حذفت كل الفروع". النتيجة:
  // كل الـ <select> بتاعة الفرع المنتشرة في الصفحات التانية (فاتورة جديدة،
  // جلسة، طبيب، موظف، مصروف، شراء، تحويل...) كانت بتفضل عارضة القيم
  // الوهمية الجاهزة (مدينة نصر/المهندسين) المكتوبة يدويًا جوه index.html —
  // لأن مفيش حد بينضّفها. الحل: منشتغلش بشرط، ونمسح القيم القديمة دايمًا.
  const branches = DB.get('branches') || [];
  const names = branches.map(b=>b.name);

  // قائمة كل الـ IDs التي تحتاج فروع (مع/بدون "كل الفروع")
  const withAll   = ['doc-branch-filter','wl-branch-filter','dash-branch-sel'];
  const withoutAll= ['wl-branch','sess-branch','doc-branch','st-branch','exp-branch',
                     'pur-branch','tr-from','tr-to','am-branch','pm-branch',
                     'rm-branch','eq-branch','prod-branch'];

  withAll.forEach(id=>{
    const sel=document.getElementById(id); if(!sel)return;
    const cur=sel.value;
    sel.innerHTML='<option value="">كل الفروع</option>'+names.map(n=>`<option value="${n}">${n}</option>`).join('');
    if(cur && (cur===''||names.includes(cur)))sel.value=cur;
  });

  withoutAll.forEach(id=>{
    const sel=document.getElementById(id); if(!sel)return;
    const cur=sel.value;
    sel.innerHTML = names.length
      ? names.map(n=>`<option>${n}</option>`).join('')
      : '<option value="">-- أضف فرعًا أولاً من الإعدادات --</option>';
    if(cur && names.includes(cur))sel.value=cur;
  });

  // قوائم الفلتر العامة (بدون ID ثابت — select داخل الشاشات)
  document.querySelectorAll('select.selbox').forEach(sel=>{
    const opts=[...sel.options].map(o=>o.value||o.text);
    // إذا يحتوي على "مدينة نصر" أو "المهندسين" (الافتراضية القديمة المكتوبة
    // يدويًا في الـ HTML) ومفيش فيها أي فرع حقيقي فعلي → نضّفه دايمًا، حتى
    // لو مفيش فروع حقيقية نهائيًا الآن (في الحالة دي نسيبه بـ "كل الفروع" فقط).
    const hasOldBranch = opts.some(o=>o==='مدينة نصر'||o==='المهندسين');
    const hasDynamic = opts.some(o=>o&&!['','كل الفروع','مدينة نصر','المهندسين'].includes(o));
    if(hasOldBranch && !hasDynamic){
      const hasAll=opts.includes('كل الفروع')||opts.includes('');
      const cur=sel.value;
      sel.innerHTML=(hasAll?'<option value="">كل الفروع</option>':'')+names.map(n=>`<option>${n}</option>`).join('');
      if(cur && names.includes(cur))sel.value=cur;
    }
  });
}

// استدعاء عند تحميل الصفحة وعند أي تغيير في الفروع
document.addEventListener('DOMContentLoaded', fillAllBranchSelects);
function renderRooms(){
  const grid=document.getElementById('rooms-grid');if(!grid)return;
  const rooms=DB.get('rooms');
  grid.innerHTML=rooms.map(r=>`<div class="bcard"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div><div style="font-weight:700;font-size:14px;">🚪 ${r.name}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${r.branch||'—'}</div></div><span class="ast ${r.status==='متاحة'?'sc':'sd'}">${r.status||'متاحة'}</span></div><div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-ghost btn-sm" onclick="openRoomModal('${r.id}')">✏️ تعديل</button><button class="btn btn-ghost btn-sm" onclick="delRoom('${r.id}')">🗑️ حذف</button></div></div>`).join('')||'<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">لا توجد غرف مضافة</div>';
}
function openRoomModal(id){
  const r=id?DB.get('rooms').find(x=>x.id===id):null;
  document.getElementById('room-modal-title').textContent=r?'✏️ تعديل غرفة':'🚪 غرفة جديدة';
  document.getElementById('rm-id').value=r?r.id:'';
  document.getElementById('rm-name').value=r?r.name:'';
  fillResBranchSelect('rm-branch',r?r.branch:null);
  document.getElementById('rm-status').value=r?(r.status||'متاحة'):'متاحة';
  openModal('room-modal');
}
function saveRoom(){
  const name=gv('rm-name').trim();if(!name){showToast('warning','⚠️ اسم الغرفة مطلوب');return;}
  const id=gv('rm-id');
  const data={name,branch:gv('rm-branch'),status:gv('rm-status')};
  if(id){DB.upd('rooms',id,data);showToast('success','✅ تم تحديث الغرفة');}
  else{DB.push('rooms',data);showToast('success','✅ تم إضافة الغرفة');}
  closeModal('room-modal');renderRooms();
}
function delRoom(id){
  const r=DB.get('rooms').find(x=>x.id===id);
  if(confirm(`حذف "${r?.name}"؟`)){DB.del('rooms',id);renderRooms();showToast('info','🗑️ تم حذف الغرفة');}
}
function renderEquipment(){
  const grid=document.getElementById('equip-grid');if(!grid)return;
  const eq=DB.get('equipment');
  grid.innerHTML=eq.map(e=>`<div class="bcard"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div><div style="font-weight:700;font-size:14px;">🔌 ${e.name}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${e.branch||'—'}</div></div><span class="ast ${e.status==='شغال'?'sc':'sd'}">${e.status||'شغال'}</span></div><div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-ghost btn-sm" onclick="openEquipModal('${e.id}')">✏️ تعديل</button><button class="btn btn-ghost btn-sm" onclick="delEquip('${e.id}')">🗑️ حذف</button></div></div>`).join('')||'<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">لا توجد أجهزة مضافة</div>';
}
function openEquipModal(id){
  const e=id?DB.get('equipment').find(x=>x.id===id):null;
  document.getElementById('equip-modal-title').textContent=e?'✏️ تعديل جهاز':'🔌 جهاز جديد';
  document.getElementById('eq-id').value=e?e.id:'';
  document.getElementById('eq-name').value=e?e.name:'';
  fillResBranchSelect('eq-branch',e?e.branch:null);
  document.getElementById('eq-status').value=e?(e.status||'شغال'):'شغال';
  openModal('equip-modal');
}
function saveEquip(){
  const name=gv('eq-name').trim();if(!name){showToast('warning','⚠️ اسم الجهاز مطلوب');return;}
  const id=gv('eq-id');
  const data={name,branch:gv('eq-branch'),status:gv('eq-status')};
  if(id){DB.upd('equipment',id,data);showToast('success','✅ تم تحديث الجهاز');}
  else{DB.push('equipment',data);showToast('success','✅ تم إضافة الجهاز');}
  closeModal('equip-modal');renderEquipment();
}
function delEquip(id){
  const e=DB.get('equipment').find(x=>x.id===id);
  if(confirm(`حذف "${e?.name}"؟`)){DB.del('equipment',id);renderEquipment();showToast('info','🗑️ تم حذف الجهاز');}
}

const ALL_SCREENS = [
  {key:'dashboard',    label:'لوحة التحكم',       icon:'🏠', group:'عام'},
  {key:'patients',     label:'العملاء',            icon:'👥', group:'عام'},
  {key:'photos',       label:'الصور قبل/بعد',     icon:'📸', group:'عام'},
  {key:'calendar',     label:'التقويم',            icon:'📅', group:'مواعيد'},
  {key:'appointments', label:'المواعيد',           icon:'🕐', group:'مواعيد'},
  {key:'waitlist',     label:'قائمة الانتظار',    icon:'⏳', group:'مواعيد'},
  {key:'sessions',     label:'الجلسات العلاجية',  icon:'✨', group:'طبي'},
  {key:'services',     label:'الخدمات والأسعار',  icon:'💅', group:'طبي'},
  {key:'packages',     label:'الباقات العلاجية',  icon:'🎁', group:'طبي'},
  {key:'doctors',      label:'الأطباء',            icon:'👨‍⚕️', group:'طبي'},
  {key:'staff',        label:'الموظفون',           icon:'👩‍💼', group:'طبي'},
  {key:'invoices',     label:'الفواتير',           icon:'🧾', group:'مالي'},
  {key:'payments',     label:'المدفوعات',          icon:'💳', group:'مالي'},
  {key:'installments', label:'الأقساط',            icon:'📆', group:'مالي'},
  {key:'expenses',     label:'المصروفات',          icon:'💸', group:'مالي'},
  {key:'treasury',     label:'الخزينة',            icon:'🏦', group:'مالي'},
  {key:'accounts',     label:'الحسابات',           icon:'📊', group:'مالي'},
  {key:'inventory',    label:'المنتجات',           icon:'📦', group:'مخزون'},
  {key:'suppliers',    label:'الموردون',           icon:'🚚', group:'مخزون'},
  {key:'purchases',    label:'المشتريات',          icon:'🛒', group:'مخزون'},
  {key:'transfers',    label:'تحويل المخزون',      icon:'🔄', group:'مخزون'},
  {key:'leads',        label:'العملاء المحتملون',  icon:'🎯', group:'تسويق'},
  {key:'campaigns',    label:'الحملات',            icon:'📣', group:'تسويق'},
  {key:'whatsapp',     label:'واتساب',             icon:'💬', group:'تسويق'},
  {key:'branches',     label:'الفروع',             icon:'🏢', group:'إدارة'},
  {key:'resources',    label:'الغرف والأجهزة',     icon:'🏗️', group:'إدارة'},
  {key:'reports',      label:'التقارير',           icon:'📈', group:'إدارة'},
  {key:'ai',           label:'المساعد الذكي',      icon:'🤖', group:'إدارة'},
  {key:'settings',     label:'الإعدادات',          icon:'⚙️', group:'إدارة'},
];

// Default screens per role
const ROLE_DEFAULTS = {
  admin:          ALL_SCREENS.map(s=>s.key),
  branch_manager: ['dashboard','patients','photos','calendar','appointments','waitlist','sessions','services','packages','doctors','staff','invoices','inventory','leads','campaigns','whatsapp','reports'],
  doctor:         ['dashboard','patients','photos','calendar','appointments','waitlist','sessions','services'],
  receptionist:   ['dashboard','patients','calendar','appointments','waitlist','invoices','payments','installments','leads','whatsapp'],
  accountant:     ['dashboard','invoices','payments','installments','expenses','treasury','accounts','reports','inventory'],
};

// ── SHA-256 (same as login.html) ──
async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ── localStorage key for users DB ──
const USERS_KEY = 'ha_users_db';

function getUsersDB(){
  // Firestore فقط — الـ cache يُملأ من onSnapshot عند الاتصال
  // localStorage يُستخدم كـ offline cache (تم ملؤه من Firestore سابقاً)
  if(window._usersCache && Object.keys(window._usersCache).length > 0) return window._usersCache;
  // offline fallback: نسخة Firestore المحفوظة محلياً (ليس hardcoded)
  try { return JSON.parse(localStorage.getItem(USERS_KEY)||'{}'); } catch(e){return{};}
}
function saveUsersDB(db){
  // حدّث الـ cache
  window._usersCache = db;
  // احفظ في localStorage كنسخة احتياطية offline فقط
  try { localStorage.setItem(USERS_KEY, JSON.stringify(db)); } catch(e){}
  // Firestore هو المصدر الأساسي — ارفع إليه
  if(window._firestore){
    Object.entries(db).forEach(([username, userData]) => {
      window._firestore.collection('users').doc(username).set({...userData, username}, {merge:true})
        .catch(e => console.warn('Firestore users sync error:', e.message));
    });
  } else {
    // Offline — ضع في الـ queue
    Object.entries(db).forEach(([username, userData]) => {
      if(typeof OQ !== 'undefined') OQ.push({type:'set', col:'users', id:username, data:{...userData, username}, ts:Date.now()});
    });
    if(typeof updateQueueBadge !== 'undefined') updateQueueBadge();
  }
}

// ✅ _earlySeedUsers حُذفت — المستخدمون من Firestore فقط عبر onSnapshot

// ✅ seedDefaultUsers حُذفت — المستخدمون من Firestore فقط
function seedDefaultUsers(){ /* no-op */ }

// ── Apply permissions from session ──
function applyPermissions(role, perms, screens){
  const isAdmin = role === 'admin';
  // Show/hide tab for users management
  const tabUsers = document.getElementById('tab-users');
  if(tabUsers) tabUsers.style.display = isAdmin ? '' : 'none';

  if(isAdmin || !screens || screens.includes('all')) return; // admin sees all

  document.querySelectorAll('.nav-item').forEach(n => {
    const onclick = n.getAttribute('onclick') || '';
    const m = onclick.match(/showScreen\('([^']+)'\)/);
    if(!m) return;
    const scr = m[1];
    if(scr === 'patient-profile') return; // always accessible via patients
    n.style.display = screens.includes(scr) ? '' : 'none';
  });
}

// ── الاستماع لحدث الصلاحيات (موحَّد عبر EventBus بدل stub/pending في 01-app.js) ──
// {replay:true}: إذا checkAuth() في 01-app.js أطلقت الحدث قبل تحميل هذا الملف،
// سيُستدعى applyPermissions فوراً بآخر قيمة محفوظة — بلا حاجة لمتغير window._pendingPermissions
EventBus.on('auth:resolved', ({role, perms, screens}) => applyPermissions(role, perms, screens), {replay:true});

// ══════════════════════════════════════════
// 👤 USER MANAGEMENT UI
// ══════════════════════════════════════════
const ROLE_LABELS = {admin:'مدير النظام',branch_manager:'مدير فرع',doctor:'طبيب',receptionist:'استقبال',accountant:'محاسب'};
const ROLE_COLORS = {admin:'var(--gold)',branch_manager:'var(--purple)',doctor:'var(--teal)',receptionist:'var(--emerald)',accountant:'var(--amber)'};

function renderUsers(){
  const db = getUsersDB();
  const tbody = document.getElementById('users-tbody');
  if(!tbody) return;
  const rows = Object.values(db).map(u => {
    const screenCount = u.screens ? (u.screens.includes('all') ? 'الكل' : u.screens.length + ' شاشة') : '—';
    const roleColor = ROLE_COLORS[u.role] || 'var(--text-secondary)';
    return `<tr>
      <td><span style="font-family:monospace;font-size:12px;background:var(--glass);padding:3px 8px;border-radius:6px;direction:ltr;display:inline-block;">${u.username}</span></td>
      <td style="font-weight:600;">${u.name}</td>
      <td><span style="color:${roleColor};font-weight:600;font-size:12px;">${ROLE_LABELS[u.role]||u.role}</span></td>
      <td>${u.branch==='all'?'كل الفروع':u.branch||'—'}</td>
      <td><span style="background:var(--glass);padding:3px 8px;border-radius:6px;font-size:12px;">${screenCount}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openUserModal('${u.username}')">✏️ تعديل</button>
      </td>
    </tr>`;
  }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">لا يوجد مستخدمون</td></tr>';
}

function buildScreensGrid(selected=[]){
  const grid = document.getElementById('um-screens-grid');
  if(!grid) return;
  const groups = {};
  ALL_SCREENS.forEach(s => {
    if(!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  });
  let html = '';
  Object.entries(groups).forEach(([grp, screens]) => {
    html += `<div style="grid-column:1/-1;font-size:11px;font-weight:700;color:var(--text-muted);margin-top:6px;padding-bottom:4px;border-bottom:1px solid var(--glass-border);">${grp}</div>`;
    screens.forEach(s => {
      const chk = selected.includes(s.key) || selected.includes('all') ? 'checked' : '';
      html += `<label style="display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--glass);border-radius:8px;cursor:pointer;font-size:12.5px;">
        <input type="checkbox" class="um-scr-chk" value="${s.key}" ${chk} style="accent-color:var(--gold);width:15px;height:15px;">
        <span>${s.icon} ${s.label}</span>
      </label>`;
    });
  });
  grid.innerHTML = html;
}

function fillBranchSelect(){
  const sel = document.getElementById('um-branch');
  if(!sel) return;
  sel.innerHTML = '<option value="all">كل الفروع</option>';
  DB.get('branches').forEach(b => {
    sel.innerHTML += `<option value="${b.name}">${b.name}</option>`;
  });
}

function openUserModal(username=''){
  const db = getUsersDB();
  const u = username ? db[username] : null;
  document.getElementById('user-modal-title').textContent = u ? `✏️ تعديل: ${u.name}` : '👤 مستخدم جديد';
  document.getElementById('um-id').value = username;
  document.getElementById('um-username').value = u ? u.username : '';
  document.getElementById('um-username').disabled = !!u; // can't change username
  document.getElementById('um-name').value = u ? u.name : '';
  document.getElementById('um-password').value = '';
  document.getElementById('um-pass-hint').style.display = u ? 'inline' : 'none';
  document.getElementById('um-role').value = u ? u.role : 'receptionist';
  fillBranchSelect();
  document.getElementById('um-branch').value = u ? (u.branch||'all') : 'all';
  const delBtn = document.getElementById('um-del-btn');
  if(delBtn) delBtn.style.display = (u && username !== 'admin') ? 'inline-flex' : 'none';
  buildScreensGrid(u ? (u.screens||[]) : ROLE_DEFAULTS.receptionist);
  openModal('user-modal');
}

function umSelectAll(val){
  document.querySelectorAll('.um-scr-chk').forEach(c => c.checked = val);
}

function umApplyRole(){
  const role = document.getElementById('um-role').value;
  const defaults = ROLE_DEFAULTS[role] || [];
  document.querySelectorAll('.um-scr-chk').forEach(c => {
    c.checked = defaults.includes(c.value);
  });
}

async function saveUser(){
  const username = (document.getElementById('um-id').value || document.getElementById('um-username').value).trim().toLowerCase();
  const name     = document.getElementById('um-name').value.trim();
  const pass     = document.getElementById('um-password').value;
  const role     = document.getElementById('um-role').value;
  const branch   = document.getElementById('um-branch').value;

  if(!username){ showToast('warning','⚠️ أدخل اسم المستخدم'); return; }
  if(!name)    { showToast('warning','⚠️ أدخل الاسم الكامل'); return; }
  if(!/^[a-z0-9_]+$/.test(username)){ showToast('warning','⚠️ اسم المستخدم: حروف إنجليزية وأرقام فقط'); return; }

  const screens = Array.from(document.querySelectorAll('.um-scr-chk:checked')).map(c=>c.value);
  if(!screens.length){ showToast('warning','⚠️ اختر شاشة واحدة على الأقل'); return; }

  const db = getUsersDB();
  const isNew = !db[username];

  if(isNew && !pass){ showToast('warning','⚠️ أدخل كلمة مرور للمستخدم الجديد'); return; }

  let hash = db[username]?.hash || '';
  if(pass){ hash = await sha256(pass); }

  db[username] = { username, name, role, branch, screens, hash };
  saveUsersDB(db);
  closeModal('user-modal');
  renderUsers();
  if(window._session && window._session.username === username){
    const RLBL={admin:'مدير النظام',branch_manager:'مدير فرع',doctor:'طبيب',receptionist:'استقبال',accountant:'محاسب'};
    const uName=document.getElementById('user-name');if(uName)uName.textContent=name;
    const dashName=document.getElementById('dash-uname');if(dashName)dashName.textContent=name;
    const uRole=document.getElementById('user-role');if(uRole)uRole.textContent=RLBL[role]||role;
  }
  showToast('success', isNew ? `✅ تم إضافة ${name}` : `✅ تم تحديث ${name}`);
}

function deleteUser(){
  const username = document.getElementById('um-id').value;
  if(username === 'admin'){ showToast('error','❌ لا يمكن حذف حساب admin'); return; }
  const sess = JSON.parse(localStorage.getItem('ha_session')||'{}');
  if(sess.username === username){ showToast('error','❌ لا يمكن حذف حسابك الحالي'); return; }
  if(!confirm(`هل تريد حذف المستخدم "${username}"؟ هذا لا يمكن التراجع عنه.`)) return;
  const db = getUsersDB();
  delete db[username];
  // حدّث الـ cache + localStorage
  window._usersCache = db;
  try { localStorage.setItem(USERS_KEY, JSON.stringify(db)); } catch(e){}
  // احذف من Firestore مباشرة (مش set — عشان الحذف يكون فعلي)
  if(window._firestore){
    window._firestore.collection('users').doc(username).delete()
      .catch(e => console.warn('Firestore delete user error:', e.message));
  } else if(typeof OQ !== 'undefined'){
    OQ.push({type:'del', col:'users', id:username, ts:Date.now()});
    if(typeof updateQueueBadge !== 'undefined') updateQueueBadge();
  }
  closeModal('user-modal');
  renderUsers();
  showToast('info','🗑️ تم حذف المستخدم');
}

function toggleUmPass(){
  const inp = document.getElementById('um-password');
  const eye = document.getElementById('um-eye');
  if(inp.type==='password'){inp.type='text';eye.textContent='🙈';}
  else{inp.type='password';eye.textContent='👁️';}
}



// ══════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// 🧹 RESET DEMO DATA — مسح بيانات التجربة
// يمسح: عملاء، مواعيد، فواتير، باقات، جلسات، خزينة، مخزون،
//        مصروفات، leads، حملات، transfers، installments، صور، audit
// يحتفظ بـ: فروع، أطباء، غرف، أجهزة، خدمات، موردين
// ══════════════════════════════════════════════════════════════════
async function resetDemoData(){
  // ── تأكيد مزدوج لأن العملية لا رجعة منها ──
  const first = confirm(
    '⚠️ تحذير: سيتم مسح جميع بيانات التجربة!\n\n' +
    '✅ سيُحتفظ بـ: الفروع · الأطباء · الغرف · الأجهزة · الخدمات · الموردين\n\n' +
    '❌ سيُمسح: العملاء · المواعيد · الفواتير · الباقات · الجلسات · الخزينة · المصروفات · المخزون · العملاء المحتملين · الأقساط · الصور · السجلات\n\n' +
    'هل تريد المتابعة؟'
  );
  if(!first) return;

  const second = confirm('⛔ تأكيد نهائي — هذه العملية لا يمكن التراجع عنها.\n\nاضغط موافق للمسح الآن.');
  if(!second) return;

  showToast('info', '🧹 جارٍ مسح بيانات التجربة...');

  // Collections المطلوب مسحها
  const COLS_TO_CLEAR = [
    'patients','appointments','invoices','invoice_items',
    'packages','sessions','cashlog','installments',
    'expenses','inventory','inventory_transactions',
    'purchases','purchase_items','leads','campaigns',
    'waitlist','visits','transfers','photos','audit_log'
  ];

  // ── 1. مسح localStorage / Cache ──
  COLS_TO_CLEAR.forEach(col => DB.set(col, []));

  // ── 2. إعادة ضبط العدادات ──
  localStorage.removeItem('ha_seeded');
  localStorage.removeItem('ha_seeded_v2');

  // ── 4. تحديث الـ UI ──
  showToast('success',
    '✅ تم مسح بيانات التجربة بنجاح',
    'تم الاحتفاظ بـ: الفروع · الأطباء · الغرف · الأجهزة'
  );
  setTimeout(() => {
    if(typeof renderPat       === 'function') renderPat();
    if(typeof renderDashboard === 'function') renderDashboard();
    if(typeof init            === 'function') init();
  }, 500);
}
