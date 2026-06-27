// SETTINGS
function saveSettings(){
  const s={clinicName:gv('s-cname'),phone:gv('s-cphone'),managerName:gv('s-mname'),managerRole:gv('s-mrole'),anthropicKey:gv('s-anthropic-key')};
  DB.set('settings',s);
  // تحديث الاسم/الدور فورًا على الشاشة الرئيسية والشريط الجانبي
  if(s.managerName){txt('user-name',s.managerName);txt('dash-uname',s.managerName);}
  if(s.managerRole)txt('user-role',s.managerRole);
  // حفظ الاسم الجديد في حساب المستخدم الحالي حتى يبقى ظاهرًا بعد إعادة تحميل الصفحة أو تسجيل الدخول مجددًا
  if(window._session && window._session.username){
    const udb=getUsersDB();
    const cu=udb[window._session.username];
    if(cu && s.managerName){ cu.name=s.managerName; saveUsersDB(udb); }
  }
  // Sync to Firestore so all devices share the same settings + API key
  if(window._firestore){
    window._firestore.collection('config').doc('settings').set(s)
      .then(()=>showToast('success','✅ تم حفظ الإعدادات وتزامنها على جميع الأجهزة ☁️'))
      .catch(()=>showToast('success','✅ تم حفظ الإعدادات محلياً'));
  } else {
    showToast('success','✅ تم حفظ الإعدادات');
  }
}

// Load settings from Firestore and merge into localStorage (called after Firebase init)
async function loadSettingsFromFirestore(){
  if(!window._firestore) return;
  try {
    const doc = await window._firestore.collection('config').doc('settings').get();
    if(doc.exists){
      const remote = doc.data();
      // Merge remote over local - remote wins (so API key syncs across devices)
      const local = DB.obj('settings');
      const merged = {...local, ...remote};
      DB.set('settings', merged);
      // Update UI if fields are visible
      const fill = (id, val) => { const el=document.getElementById(id); if(el&&val)el.value=val; };
      fill('s-cname', merged.clinicName);
      fill('s-cphone', merged.phone);
      fill('s-mname', merged.managerName);
      fill('s-mrole', merged.managerRole);
      fill('s-anthropic-key', merged.anthropicKey);
      // اسم/دور المستخدم في الواجهة يُؤخذ من بيانات المستخدم الحقيقية (checkAuth) لا من هذا الحقل
    }
    // Also listen for live changes (another device saves settings)
    window._firestore.collection('config').doc('settings').onSnapshot(doc=>{
      if(doc.exists){
        const remote=doc.data();
        const local=DB.obj('settings');
        DB.set('settings',{...local,...remote});
      }
    });
  } catch(e){ console.warn('loadSettingsFromFirestore:', e.message); }
}
function loadSettings(){
  const s=DB.obj('settings');
  // ملاحظة: لا نُحدّث user-name/user-role/dash-uname من هنا، لأنها مرتبطة بحساب المستخدم الفعلي
  // (يتم تحديثها في checkAuth من بيانات المستخدمين الحقيقية وتتبع آخر تعديل عليها)
  ['s-cname','s-cphone','s-mname','s-mrole'].forEach((id,i)=>{const e=document.getElementById(id);if(e)e.value=[s.clinicName,s.phone,s.managerName,s.managerRole][i]||e.value;});
  const akEl=document.getElementById('s-anthropic-key');if(akEl&&s.anthropicKey)akEl.value=s.anthropicKey;
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
  // Save config to localStorage for reuse after reload
  localStorage.setItem('ha_fb_config', JSON.stringify(cfg));
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
    await db.collection('_ping').limit(1).get();

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
      'suppliers','purchases','purchase_items','visits','inventory_transactions'
    ];
    COLLECTIONS.forEach(col => attachFirestoreSync(col));

    // Load shared settings (API key, clinic name, etc.) from Firestore
    await loadSettingsFromFirestore();

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
      // ✅ نمرّ عبر DB.set (لا نكتب على localStorage مباشرة) حتى تبقى كل قراءة/كتابة موحّدة في DB layer
      // ملاحظة: DB.set لا تُطلق created/updated لكل سجل (لتفادي ضجيج أحداث عند مزامنة كاملة) —
      // بدلاً من ذلك نجدوِل تحديث واحد موحّد عبر _scheduleUIRefresh الموجودة في 00-core.js،
      // وهي بنفسها تُحدّث الشاشة النشطة المطابقة + KPIs لوحة التحكم تلقائياً.
      DB.set(col, docs);
      _scheduleUIRefresh(col);
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
    'rooms','equipment','suppliers','purchases','purchase_items'
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
    'visits','sessions','packages','waitlist','campaigns','audit_log'
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
const _origInitFirebase = initFirebase;
initFirebase = async function(cfg){
  await _origInitFirebase(cfg);
  if(window._fbReady && OQ.size() > 0){
    setTimeout(flushOfflineQueue, 1000);
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
    await window._firestore.collection('_ping').limit(1).get();
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
  txt('conn-txt','وضع محلي 💾');
  const dot = document.getElementById('conn-dot');
  if(dot) dot.style.background = 'var(--amber)';
  showToast('info','🔌 تم قطع الاتصال بـ Firebase');
}

// ── Auto-reconnect on page load if config was saved before ──
(function autoConnectFirebase(){
  const saved = localStorage.getItem('ha_fb_config');
  if(!saved) return;
  try {
    const cfg = JSON.parse(saved);
    if(cfg.apiKey && cfg.projectId){
      // Pre-fill settings fields
      const F = {apiKey:'fb-key',authDomain:'fb-auth',projectId:'fb-proj',storageBucket:'fb-stor',messagingSenderId:'fb-send',appId:'fb-app'};
      Object.entries(F).forEach(([k,id])=>{ const e=document.getElementById(id); if(e) e.value=cfg[k]||''; });
      // Connect after page is ready
      setTimeout(()=>initFirebase(cfg), 1500);
    }
  } catch(e){}
})();
function toggleSw(el){const on=el.style.background.includes('2DD4BF')||el.style.background.includes('teal');el.style.background=on?'var(--glass-border)':'var(--teal)';const k=el.querySelector('div');if(k)k.style.cssText=`width:19px;height:19px;background:#fff;border-radius:50%;position:absolute;top:2px;transition:.2s;${on?'left:2px':'right:2px'}`;}
function exportAll(){
  const ALL_COLS=['patients','appointments','inventory','invoices','invoice_items','services','leads','doctors','staff','expenses','branches','rooms','equipment','suppliers','purchases','purchase_items','sessions','packages','waitlist','campaigns'];
  const d={};
  ALL_COLS.forEach(k=>{d[k]=DB.get(k);});
  d.settings=DB.obj('settings');
  d.exportedAt=new Date().toISOString();
  d.schemaVersion=2;
  const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`alhaya-backup-v2-${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.json`;a.click();
  showToast('success','📥 تم تصدير البيانات (Schema v2)');
}
function clearAll(){if(confirm('⚠️ هذا سيحذف كل البيانات المحلية! متأكد؟')){
  ['patients','appointments','inventory','invoices','invoice_items','services','leads','doctors','staff','expenses','branches','rooms','equipment','suppliers','purchases','purchase_items','sessions','packages','waitlist','campaigns','visits','inventory_transactions','audit_log'].forEach(k=>DB.set(k,[]));
  localStorage.removeItem('ha_seeded');
  localStorage.removeItem('ha_seeded_v2');
  showToast('warning','🗑️ تم مسح كل البيانات المحلية');
  init();
}}

// ══════════════════════════════════════════
// 🏢 BRANCHES — REAL DATA FROM DB
// ══════════════════════════════════════════
function renderBranches(){
  // Seed default branches if none exist
  if(!DB.get('branches')||!DB.get('branches').length){
    DB.set('branches',[
      {id:'br1',name:'مدينة نصر',address:'شارع عباس العقاد، مدينة نصر',phone:'01011112222',manager:'د. سارة محمد',status:'نشط'},
      {id:'br2',name:'المهندسين',address:'شارع البطل أحمد عبد العزيز، المهندسين',phone:'01033334444',manager:'د. منى سامي',status:'نشط'}
    ]);
  }
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
    const branchRevenue = invoices.filter(inv=>(inv.branch||'').includes(bName)||(inv.branchId||'')===(b.id||'')).reduce((s,inv)=>s+(inv.paid||0),0);
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
  const branches = DB.get('branches') || [];
  if(!branches.length) return;
  const names = branches.map(b=>b.name);

  // قائمة كل الـ IDs التي تحتاج فروع (مع/بدون "كل الفروع")
  const withAll   = ['doc-branch-filter','wl-branch-filter'];
  const withoutAll= ['wl-branch','sess-branch','doc-branch','st-branch','exp-branch',
                     'pur-branch','tr-from','tr-to','am-branch','pm-branch',
                     'rm-branch','eq-branch'];

  withAll.forEach(id=>{
    const sel=document.getElementById(id); if(!sel)return;
    const cur=sel.value;
    sel.innerHTML='<option value="">كل الفروع</option>'+names.map(n=>`<option value="${n}">${n}</option>`).join('');
    if(cur)sel.value=cur;
  });

  withoutAll.forEach(id=>{
    const sel=document.getElementById(id); if(!sel)return;
    const cur=sel.value;
    sel.innerHTML=names.map(n=>`<option>${n}</option>`).join('');
    if(cur && names.includes(cur))sel.value=cur;
  });

  // قوائم الفلتر العامة (بدون ID ثابت — select داخل الشاشات)
  document.querySelectorAll('select.selbox').forEach(sel=>{
    const opts=[...sel.options].map(o=>o.value||o.text);
    // إذا يحتوي على "مدينة نصر" أو "المهندسين" فقط (الافتراضية القديمة) → حدّثه
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
  try { return JSON.parse(localStorage.getItem(USERS_KEY)||'{}'); } catch(e){return{};}
}
function saveUsersDB(db){ localStorage.setItem(USERS_KEY, JSON.stringify(db)); }

// ── Seed مبكر ومتزامن عند تحميل الملف (قبل checkAuth) ──
// يضمن وجود ha_users_db حتى لو seedDefaultUsers الـ async لم تكتمل بعد
(function _earlySeedUsers(){
  try {
    const existing = JSON.parse(localStorage.getItem(USERS_KEY)||'{}');
    if(Object.keys(existing).length > 0) return;
    // نفس البيانات الافتراضية — بدون await (الـ hash محسوب مسبقاً)
    const defaults = {
      'admin':      {username:'admin',      hash:'240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', name:'د. سارة محمد',   role:'admin',         branch:'all',       screens:['all']},
      'doctor':     {username:'doctor',     hash:'c3362e4da49c24d379b72152ae6c99f1fa035f52829dceed715a7bf8bb464b98', name:'د. منى سامي',   role:'doctor',        branch:'مدينة نصر', screens:['dashboard','patients','photos','calendar','appointments','waitlist','sessions','services']},
      'reception':  {username:'reception',  hash:'1270ddbd388e309b1234f4e500ea78a83c9d111040fa6cce86c31df0144a3659', name:'نور الاستقبال', role:'receptionist',  branch:'مدينة نصر', screens:['dashboard','patients','calendar','appointments','waitlist','invoices','payments','installments','leads','whatsapp']},
      'accountant': {username:'accountant', hash:'2159157cf71913278f89c4a16bd7462481e41463ea0f8444523cd1c6887d1e4e', name:'أحمد المحاسب',  role:'accountant',    branch:'all',       screens:['dashboard','invoices','payments','installments','expenses','treasury','accounts','reports','inventory']},
      'manager2':   {username:'manager2',   hash:'49a0ac18e26df0b0724f5ac5837e436b336527485fc0a388f578913d6ee70e67', name:'مدير المهندسين',role:'branch_manager',branch:'المهندسين', screens:['dashboard','patients','photos','calendar','appointments','waitlist','sessions','services','packages','doctors','staff','invoices','inventory','leads','campaigns','whatsapp','reports']},
    };
    localStorage.setItem(USERS_KEY, JSON.stringify(defaults));
  } catch(e){ /* تجاهل أخطاء localStorage */ }
})();

// ── Seed default users on first run ──
async function seedDefaultUsers(){
  const db = getUsersDB();
  if(Object.keys(db).length > 0) return; // already seeded
  // Passwords: admin=admin123, doctor=doc123, reception=rec123, accountant=acc123, manager2=mgr123
  const defaults = [
    {username:'admin',      hash:'240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', name:'د. سارة محمد',   role:'admin',         branch:'all',       screens: ROLE_DEFAULTS.admin},
    {username:'doctor',     hash:'c3362e4da49c24d379b72152ae6c99f1fa035f52829dceed715a7bf8bb464b98', name:'د. منى سامي',   role:'doctor',        branch:'مدينة نصر', screens: ROLE_DEFAULTS.doctor},
    {username:'reception',  hash:'1270ddbd388e309b1234f4e500ea78a83c9d111040fa6cce86c31df0144a3659', name:'نور الاستقبال', role:'receptionist',  branch:'مدينة نصر', screens: ROLE_DEFAULTS.receptionist},
    {username:'accountant', hash:'2159157cf71913278f89c4a16bd7462481e41463ea0f8444523cd1c6887d1e4e', name:'أحمد المحاسب',  role:'accountant',    branch:'all',       screens: ROLE_DEFAULTS.accountant},
    {username:'manager2',   hash:'49a0ac18e26df0b0724f5ac5837e436b336527485fc0a388f578913d6ee70e67', name:'مدير المهندسين',role:'branch_manager',branch:'المهندسين', screens: ROLE_DEFAULTS.branch_manager},
  ];
  const db2 = {};
  defaults.forEach(u => { db2[u.username] = u; });
  saveUsersDB(db2);
}

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
  saveUsersDB(db);
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
