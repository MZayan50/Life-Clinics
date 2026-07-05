// 📸 PHOTOS SCREEN
// ══════════════════════════════════════════
// تخزين الصور 100% محلي على الجهاز — لا تُرفع أي صورة لـ Firestore أبدًا.
// قاعدة البيانات (وبالتالي المزامنة السحابية) تحفظ فقط مرجع نصي صغير (key) لكل صورة.
// ══════════════════════════════════════════

// ── PhotoStore: طبقة تخزين الصور محليًا (IndexedDB) ──
// • على الكمبيوتر (Chrome/Edge): File System Access API → يسأل المستخدم "حفظ بإسم"
//   ويحفظ الصورة كملف فعلي على القرص باسم = مفتاح الصورة، ويُخزَّن مرجع الملف (handle) في IndexedDB لإعادة فتحه تلقائيًا لاحقًا.
// • على الموبايل/المتصفحات التي لا تدعم هذه الـ API: تُخزَّن الصورة كـ Blob داخل IndexedDB على نفس الجهاز فقط (نفس مبدأ "لا رفع للسحابة" لكن بدون اختيار مسار يدوي، لأن أنظمة الموبايل لا تسمح بذلك من المتصفح).
const PhotoStore = (function(){
  let _db = null;
  function _open(){
    return new Promise((resolve,reject)=>{
      if(_db) return resolve(_db);
      if(!window.indexedDB) return reject(new Error('IndexedDB غير متاح'));
      const req = indexedDB.open('ha_photos_db', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
        if(!db.objectStoreNames.contains('blobs'))   db.createObjectStore('blobs');
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror   = () => reject(req.error);
    });
  }
  async function _store(name, mode){ const db = await _open(); return db.transaction(name, mode).objectStore(name); }
  function _get(store, key){ return new Promise(res=>{ const rq=store.get(key); rq.onsuccess=()=>res(rq.result||null); rq.onerror=()=>res(null); }); }
  const supportsFS = () => typeof window.showSaveFilePicker === 'function';

  // حفظ ملف صورة جديد تحت مفتاح فريد (key). يرجع true لو نجح الحفظ، أو يرمي خطأ AbortError لو المستخدم لغى نافذة الحفظ
  async function save(key, file){
    if(supportsFS()){
      const ext = (file.name||'').match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
      const handle = await window.showSaveFilePicker({
        suggestedName: key + ext,
        types: [{ description:'صورة', accept:{ 'image/*':['.png','.jpg','.jpeg','.webp'] } }]
      }); // قد يرمي AbortError لو المستخدم ضغط "إلغاء" — يُترك ليتعامل معه المستدعي
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      (await _store('handles','readwrite')).put(handle, key);
      return true;
    }
    // الموبايل / متصفحات بدون File System Access API
    (await _store('blobs','readwrite')).put(file, key);
    return true;
  }

  // يرجع object URL للعرض، أو 'PERMISSION_NEEDED' لو محتاج إذن (ويحتاج user gesture لإعادة الطلب)، أو null لو غير موجودة
  async function getURL(key){
    const blob = await _get(await _store('blobs','readonly'), key);
    if(blob) return URL.createObjectURL(blob);
    const handle = await _get(await _store('handles','readonly'), key);
    if(!handle) return null;
    try{
      let perm = await handle.queryPermission({mode:'read'});
      if(perm !== 'granted') perm = await handle.requestPermission({mode:'read'});
      if(perm !== 'granted') return 'PERMISSION_NEEDED';
      const file = await handle.getFile();
      return URL.createObjectURL(file);
    }catch(e){ return 'PERMISSION_NEEDED'; }
  }

  async function remove(key){
    if(!key) return;
    (await _store('blobs','readwrite')).delete(key);
    (await _store('handles','readwrite')).delete(key);
  }

  return { save, getURL, remove, supportsFS };
})();

// ── حالة نافذة إضافة الصور (مؤقتة أثناء فتح المودال فقط) ──
window._photoModalState = { id:null, beforeKey:null, afterKey:null };

function openPhotoModal(patientId){
  window._photoModalState = { id: genUUID(), beforeKey:null, afterKey:null };
  const f = (id,v='') => { const el=document.getElementById(id); if(el) el.value=v; };
  f('photo-id'); f('photo-svc'); f('photo-session',1); f('photo-notes');
  const dEl=document.getElementById('photo-date'); if(dEl) dEl.value=new Date().toISOString().split('T')[0];
  ['before','after'].forEach(slot=>{
    const prev=document.getElementById('photo-'+slot+'-preview'); if(prev){ prev.style.display='none'; prev.src=''; }
    const lbl=document.getElementById('photo-'+slot+'-label'); if(lbl) lbl.textContent='لم تُختار صورة';
  });
  openModal('photo-modal'); // openModal يستدعي fillPatDropdowns تلقائيًا (ويشمل الآن photo-pat)
  if(patientId){ const sel=document.getElementById('photo-pat'); if(sel) sel.value=patientId; }
}

// اختيار صورة من جهاز المستخدم لخانة "قبل" أو "بعد" وحفظها فورًا محليًا (بدون رفعها لأي سيرفر)
function _pickPhotoSlot(slot){
  const input=document.createElement('input');
  input.type='file'; input.accept='image/*';
  input.onchange = async () => {
    const file=input.files[0]; if(!file) return;
    const key = `${window._photoModalState.id}_${slot}`;
    try{
      await PhotoStore.save(key, file);
      window._photoModalState[slot+'Key'] = key;
      const prev=document.getElementById('photo-'+slot+'-preview');
      if(prev){ prev.src=URL.createObjectURL(file); prev.style.display='block'; }
      const lbl=document.getElementById('photo-'+slot+'-label'); if(lbl) lbl.textContent='✅ '+(file.name||'تم الحفظ');
    }catch(err){
      if(err?.name!=='AbortError') showToast('error','❌ فشل حفظ الصورة', err?.message||'');
    }
  };
  input.click();
}

function renderPhotos(q){
  q=q||'';
  const catF=document.getElementById('photo-cat-filter')?.value||'';
  if(!DB.get('photos')) DB.set('photos',[]);
  let photos=DB.get('photos');
  if(q) photos=photos.filter(p=>(p.patientName||'').includes(q)||(p.service||'').includes(q));
  if(catF) photos=photos.filter(p=>p.service===catF);

  // KPIs
  const all=DB.get('photos');
  txt('photo-kpi-total',all.length);
  const uniqPats=new Set(all.map(p=>p.patientName)).size;
  txt('photo-kpi-patients',uniqPats);
  const pairs=all.filter(p=>p.beforeKey&&p.afterKey).length;
  txt('photo-kpi-pairs',pairs);

  const grid=document.getElementById('photo-grid');if(!grid)return;
  if(!photos.length){
    grid.innerHTML=`<div class="card" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">
      <div style="font-size:44px;margin-bottom:12px">📷</div>
      <div style="font-size:14px">لا توجد صور - أضف صور قبل/بعد للعملاء</div>
    </div>`;
    return;
  }
  grid.innerHTML=photos.map(p=>`
    <div class="card" style="padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div>
          <div style="font-weight:700;font-size:14px">${p.patientName}</div>
          <div style="font-size:11px;color:var(--text-muted)">${p.service||'—'} · جلسة ${p.session||1} · ${p.date||'—'}</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-xs" onclick="delPhoto('${p.id}')">🗑</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div id="ph-before-${p.id}" style="background:var(--glass);border:1px solid var(--glass-border);border-radius:8px;padding:20px;text-align:center;min-height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:28px">📷</div><div style="font-size:11px;color:var(--text-muted);margin-top:4px">قبل</div>
        </div>
        <div id="ph-after-${p.id}" style="background:var(--glass);border:1px solid var(--glass-border);border-radius:8px;padding:20px;text-align:center;min-height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:28px">📸</div><div style="font-size:11px;color:var(--text-muted);margin-top:4px">بعد</div>
        </div>
      </div>
      ${p.notes?`<div style="font-size:12px;color:var(--text-muted);border-top:1px solid var(--glass-border);padding-top:8px;">${p.notes}</div>`:''}
    </div>
  `).join('');

  // تحميل المعاينات بشكل غير متزامن من التخزين المحلي (IndexedDB) — لا يوجد طلب شبكة هنا أبدًا
  photos.forEach(p=>{
    if(p.beforeKey) _loadPhotoThumb(`ph-before-${p.id}`, p.beforeKey, 'قبل');
    if(p.afterKey)  _loadPhotoThumb(`ph-after-${p.id}`,  p.afterKey,  'بعد');
  });
}

async function _loadPhotoThumb(elId, key, label){
  const el=document.getElementById(elId); if(!el) return;
  const url = await PhotoStore.getURL(key);
  if(url==='PERMISSION_NEEDED'){
    el.innerHTML=`<button class="btn btn-ghost btn-xs" onclick="_loadPhotoThumb('${elId}','${key}','${label}')">🔓 عرض الصورة</button>`;
  } else if(url){
    el.innerHTML=`<img src="${url}" style="width:100%;height:90px;object-fit:cover;border-radius:8px">`;
  }
  // لو null (الصورة غير موجودة لأي سبب) → يبقى الإيموجي الافتراضي كما هو
}

function delPhoto(id){
  if(confirm('حذف هذه الصور؟')){
    const p=DB.get('photos').find(x=>x.id===id);
    if(p){ PhotoStore.remove(p.beforeKey); PhotoStore.remove(p.afterKey); }
    DB.del('photos', id);
    showToast('info','🗑 تم الحذف');
    renderPhotos();
  }
}

function savePhoto(){
  const patId=gv('photo-pat'); if(!patId){showToast('warning','⚠️ اختر العميل');return;}
  const pat=DB.get('patients').find(x=>x.id===patId);
  const st=window._photoModalState||{};
  if(!st.beforeKey && !st.afterKey){ showToast('warning','⚠️ اختر صورة واحدة على الأقل (قبل أو بعد)'); return; }
  DB.push('photos',{
    id: st.id, patientId: patId, patientName: pat?.name||'',
    service: gv('photo-svc'), date: gv('photo-date')||new Date().toISOString().split('T')[0],
    session: parseInt(gv('photo-session'))||1,
    beforeKey: st.beforeKey||null, afterKey: st.afterKey||null,
    notes: gv('photo-notes')
  });
  closeModal('photo-modal');
  showToast('success',`✅ تم إضافة صور ${pat?.name||''}`);
}

// ══════════════════════════════════════════
// 📊 ACCOUNTS SCREEN
// ══════════════════════════════════════════
// ─── PHASE 2: Smart Auto-Queue (Waitlist) ───────────────────────────────────

// Status auto-transition rules (run every minute)
function _wlAutoUpdateStatuses(){
  const today=new Date().toISOString().split('T')[0];
  const now=new Date();
  const nowMin=now.getHours()*60+now.getMinutes();
  const appts=DB.get('appointments').filter(a=>a.date===today);
  let changed=false;
  appts.forEach(a=>{
    if(['مكتمل','ملغي','لم يحضر'].includes(a.status)) return;
    const apptMin=_timeToMin(a.time||'00:00');
    let newStatus=null;
    if(a.status==='مؤكد'){
      if(nowMin>=apptMin-15 && nowMin<apptMin) newStatus='قادم';
      else if(nowMin>=apptMin && nowMin<apptMin+15) newStatus='انتظار';
      else if(nowMin>=apptMin+15) newStatus='متأخر';
    } else if(a.status==='قادم'){
      if(nowMin>=apptMin) newStatus='انتظار';
    } else if(a.status==='انتظار'){
      if(nowMin>=apptMin+15) newStatus='متأخر';
    }
    if(newStatus){ DB.upd('appointments',a.id,{status:newStatus}); changed=true; }
  });
  return changed;
}

// Timer string: elapsed minutes since checkIn or apptTime
function _wlTimerStr(a){
  const now=new Date();
  const nowMin=now.getHours()*60+now.getMinutes();
  let ref=null;
  if(a.checkInTime) ref=_timeToMin(a.checkInTime);
  else if(a.status==='في الاستشارة'&&a.consultStart) ref=_timeToMin(a.consultStart);
  else if(['انتظار','متأخر'].includes(a.status)) ref=_timeToMin(a.time||'00:00');
  if(ref===null) return '';
  const diff=nowMin-ref;
  if(diff<0) return '';
  const h=Math.floor(diff/60), m=diff%60;
  return h>0?`${h}س ${m}د`:`${m}د`;
}

// Priority order for queue: late > checkin/consult > waiting > upcoming > booked
function _wlPriority(a){
  const P={'متأخر':0,'وصل':1,'في الاستشارة':2,'انتظار':3,'قادم':4,'مؤكد':5};
  const p=P[a.status]??9;
  return p*10000+_timeToMin(a.time||'00:00');
}

function renderWaitlist(){
  const today=new Date().toISOString().split('T')[0];
  const now=new Date();
  // Update date label
  const dlbl=document.getElementById('wl-date-lbl');
  if(dlbl) dlbl.textContent=now.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  // Fill branch filter from DB
  const brSel=document.getElementById('wl-branch-filter');
  if(brSel && brSel.options.length<=1){
    const brs=DB.get('branches')||[];
    brSel.innerHTML='<option value="">كل الفروع</option>'+brs.map(b=>`<option>${b.name||b}</option>`).join('');
  }
  const q=(document.getElementById('wl-search')?.value||'').trim().toLowerCase();
  const branch=document.getElementById('wl-branch-filter')?.value||'';
  const statusF=document.getElementById('wl-status-filter')?.value||'';

  // Load today's appointments as the queue source
  let appts=DB.get('appointments').filter(a=>a.date===today && a.status!=='ملغي');
  if(branch) appts=appts.filter(a=>a.branch===branch);
  if(statusF) appts=appts.filter(a=>a.status===statusF);
  if(q) appts=appts.filter(a=>(a.patient||'').toLowerCase().includes(q)||(a.service||'').toLowerCase().includes(q)||(a.doctor||'').toLowerCase().includes(q));

  // Sort by priority
  appts.sort((a,b)=>_wlPriority(a)-_wlPriority(b));

  // KPIs
  const allToday=DB.get('appointments').filter(a=>a.date===today&&a.status!=='ملغي');
  const active=allToday.filter(a=>['وصل','انتظار','متأخر'].includes(a.status));
  const consult=allToday.filter(a=>a.status==='في الاستشارة');
  const late=allToday.filter(a=>a.status==='متأخر');
  const done=allToday.filter(a=>a.status==='مكتمل');
  txt('wl-kpi-today',allToday.length);
  txt('wl-kpi-active',active.length);
  txt('wl-kpi-consult',consult.length);
  txt('wl-kpi-late',late.length);
  txt('wl-kpi-done',done.length);
  txt('wl-count-lbl',appts.length+' في القائمة');

  const AVA_COLORS=['linear-gradient(135deg,#C4A882,#9A7050)','linear-gradient(135deg,#2DD4BF,#14B8A6)','linear-gradient(135deg,#8B5CF6,#6D28D9)','linear-gradient(135deg,#F43F5E,#BE123C)','linear-gradient(135deg,#10B981,#047857)','linear-gradient(135deg,#F59E0B,#B45309)'];

  const STATUS_LABEL={
    'مؤكد':'مؤكد','قادم':'🔔 قادم','انتظار':'⏳ انتظار','وصل':'✅ وصل',
    'في الاستشارة':'💬 في الاستشارة','متأخر':'⚠️ متأخر','مكتمل':'✔ مكتمل','لم يحضر':'❌ لم يحضر'
  };

  const container=document.getElementById('wl-queue-list');
  if(!container) return;

  if(!appts.length){
    container.innerHTML=`<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px;">
      ${statusF||q||branch?'لا توجد نتائج للفلتر المحدد':'لا توجد مواعيد اليوم 📅'}</div>`;
    return;
  }

  container.innerHTML=appts.map((a,i)=>{
    const cardCls=a.status==='متأخر'?'wq-late':a.status==='في الاستشارة'?'wq-consult':['وصل','انتظار'].includes(a.status)?'wq-checkin':'';
    const stCls=ASC[a.status]||'sd';
    const timer=_wlTimerStr(a);
    const timerCls=a.status==='مكتمل'?'wq-timer-ok':'';
    const avaBg=AVA_COLORS[i%AVA_COLORS.length];
    // Action buttons per status
    let actions='';
    if(a.status==='مؤكد'||a.status==='قادم'||a.status==='انتظار'||a.status==='متأخر'){
      actions=`<button class="btn btn-teal btn-xs" onclick="wlCheckIn('${a.id}')">تسجيل وصول</button>`;
    }
    if(a.status==='وصل'||a.status==='انتظار'){
      actions+=` <button class="btn btn-primary btn-xs" onclick="wlCallPatient('${a.id}')">📢 استدعاء</button>`;
    }
    if(a.status==='في الاستشارة'){
      actions+=` <button class="btn btn-ghost btn-xs" style="border-color:var(--emerald);color:var(--emerald)" onclick="wlFinish('${a.id}')">✅ إنهاء</button>`;
    }
    if(!['مكتمل','ملغي'].includes(a.status)){
      actions+=` <button class="btn btn-ghost btn-xs" onclick="wlMarkNoShow('${a.id}')">❌</button>`;
    }
    return `<div class="wq-card ${cardCls}" id="wq-${a.id}">
      <div class="wq-rank">${i+1}</div>
      <div class="wq-ava" style="background:${avaBg}">${genderAva(_patGender(a.patId,a.patient))}</div>
      <div class="wq-info">
        <div class="wq-name">${a.patient||'—'}</div>
        <div class="wq-meta">${a.time}${a.endTime?' – '+a.endTime:''} · ${a.service||'—'} · ${a.doctor||'—'}</div>
        ${a.checkInTime?`<div style="font-size:11px;color:var(--teal);margin-top:2px;">وصل ${a.checkInTime}</div>`:''}
      </div>
      <div class="wq-timer ${timerCls}">${timer}</div>
      <span class="ast ${stCls}" style="font-size:11.5px;">${STATUS_LABEL[a.status]||a.status}</span>
      <div class="wq-actions">${actions}</div>
    </div>`;
  }).join('');
}

// Check-in: receptionist clicks
// ══════════════════════════════════════════════════════
// 🟠 PHASE 5 — RECEPTION & DOCTOR SCREEN AUTOMATION
// ══════════════════════════════════════════════════════

// Helper: sync all live screens after any status change
function _syncAllScreens(){
  renderTodayAppts();
  renderWaitlist();
  renderReception();
  renderDoctorView();
}

// Reception: Check-In patient
function wlCheckIn(id){
  const now=new Date();
  const t=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  DB.upd('appointments',id,{status:'وصل',checkInTime:t});
  showToast('success','✅ تم تسجيل الوصول',`الوقت: ${t}`);
  _syncAllScreens();
}

// Doctor: Call patient into consultation
function wlCallPatient(id){
  const appt = DB.get('appointments').find(a => a.id === id);
  if(!appt) { showToast('error', '❌ لم يتم العثور على الموعد'); return; }
  
  const docName = appt.doctor || '؟؟';
  const now = new Date();
  const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  
  // ✅ إنشاء استدعاء جديد وإضافته إلى call_queue
  const call = {
    id: genUUID(),
    apptId: appt.id,
    patientId: appt.patId,
    patientName: appt.patient,
    doctor: docName,
    time: t,
    timestamp: new Date().toISOString(),
    status: 'active'  // active / seen / canceled
  };
  
  // حفظ الاستدعاء في DB
  if(!DB.get('call_queue')) DB.set('call_queue', []);
  DB.push('call_queue', call);
  
  // تحديث حالة الموعد
  DB.upd('appointments', id, { status: 'في الاستشارة', consultStart: t });
  
  showToast('success', `📢 تم استدعاء ${appt.patient}`, `الوقت: ${t}`);
  
  // تحديث شاشة الاستقبال فوراً
  if(document.getElementById('screen-reception')?.classList.contains('active')){
    setTimeout(() => renderReception(), 100);
  }
  
  _syncAllScreens();
}

// Doctor: Finish — open billing modal (Phase 4)
function wlFinish(id){
  openConsultDoneModal(id);
}

// Mark no-show
function wlMarkNoShow(id){
  const a=DB.get('appointments').find(x=>x.id===id);
  if(!confirm(`تأكيد: ${a?.patient||'العميل'} لم يحضر؟`)) return;
  DB.upd('appointments',id,{status:'لم يحضر'});
  showToast('info','❌ سُجِّل كـ "لم يحضر"');
  _syncAllScreens();
}

// Legacy waitlist functions (kept for backward compat)
function delWaitlist(id){ if(confirm('حذف من قائمة الانتظار؟')){ DB.del('waitlist',id); renderWaitlist(); } }

// Auto-refresh: update statuses + re-render every 60s
function _startWLAutoRefresh(){
  if(window._wlTimer) clearInterval(window._wlTimer);
  window._wlTimer=setInterval(()=>{
    _wlAutoUpdateStatuses();
    const active=document.querySelector('.screen.active')?.id?.replace('screen-','');
    if(active==='waitlist')     renderWaitlist();
    if(active==='reception')    renderReception();
    if(active==='doctor-view')  renderDoctorView();
    renderTodayAppts(); // keep dashboard in sync
  },60000);
}


// ══════════════════════════════════════════
// ✨ SESSIONS (TREATMENT PLANS)
// ══════════════════════════════════════════
function renderSessions(){
  const grid=document.getElementById('sess-grid');if(!grid)return;
  const q=(document.getElementById('sess-search')?.value||'').toLowerCase();
  const status=document.getElementById('sess-status-filter')?.value||'';
  let items=DB.get('sessions');
  if(q)items=items.filter(s=>s.patName?.toLowerCase().includes(q)||(s.type||'').toLowerCase().includes(q));
  if(status)items=items.filter(s=>s.status===status);
  const active=DB.get('sessions').filter(s=>s.status==='جارية');
  const totalDone=DB.get('sessions').reduce((sum,s)=>sum+(s.done||0),0);
  const totalRemaining=DB.get('sessions').reduce((sum,s)=>sum+Math.max(0,(s.total||0)-(s.done||0)),0);
  txt('sess-kpi-active',active.length);
  txt('sess-kpi-total',DB.get('sessions').length);
  txt('sess-kpi-done',totalDone);
  txt('sess-kpi-remaining',totalRemaining);
  const STATUS_COLOR={جارية:'sc',مكتملة:'nb-teal',متوقفة:'sp'};
  grid.innerHTML=items.map(s=>{
    const pct=s.total>0?Math.round((s.done||0)/s.total*100):0;
    return `<div class="bcard">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <div>
          <div style="font-size:15px;font-weight:800;">${s.patName||'—'}</div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">✨ ${s.type||'—'} · 👨‍⚕️ ${s.doctor||'—'}</div>
        </div>
        <span class="ast ${STATUS_COLOR[s.status]||'sd'}">${s.status}</span>
      </div>
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px;">
          <span style="color:var(--text-muted)">التقدم</span>
          <span style="font-weight:700;color:var(--teal)">${s.done||0} / ${s.total||0} جلسة</span>
        </div>
        <div class="prog"><div class="prog-f" style="background:linear-gradient(90deg,var(--teal),var(--gold));width:${pct}%;"></div></div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;text-align:left">${pct}%</div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">📍 ${s.branch||'—'} · 📅 ${s.startDate||'—'}</div>
      ${s.notes?`<div style="font-size:12px;color:var(--text-secondary);background:var(--glass);border-radius:8px;padding:7px 10px;margin-bottom:10px;">${s.notes}</div>`:''}
      <div style="display:flex;gap:7px;">
        <button class="btn btn-teal btn-sm" style="flex:1" onclick="addSessionProgress('${s.id}')">✅ +جلسة</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="openSessionModal('${s.id}')">✏️ تعديل</button>
        <button class="btn btn-danger btn-sm" onclick="delSession('${s.id}')">🗑</button>
      </div>
    </div>`;
  }).join('')||'<div class="card" style="text-align:center;padding:40px;color:var(--text-muted);grid-column:1/-1;">لا توجد خطط جلسات مطابقة</div>';
}
function openSessionModal(id){
  const s=id?DB.get('sessions').find(x=>x.id===id):null;
  document.getElementById('sess-modal-title').textContent=s?'✏️ تعديل خطة الجلسات':'✨ خطة جلسات جديدة';
  document.getElementById('sess-id').value=s?s.id:'';
  const sel=document.getElementById('sess-pat');
  sel.innerHTML=DB.get('patients').map(p=>`<option value="${p.id}" data-name="${p.name}"${s&&s.patId===p.id?' selected':''}>${p.name}</option>`).join('');
  const docSel=document.getElementById('sess-doc');
  docSel.innerHTML=DB.get('doctors').map(d=>`<option${s&&s.doctor===d.name?' selected':''}>${d.name}</option>`).join('')||'<option>د. منى سامي</option>';
  if(s){
    document.getElementById('sess-type').value=s.type||'ليزر إزالة شعر';
    document.getElementById('sess-total-count').value=s.total||6;
    document.getElementById('sess-done-count').value=s.done||0;
    document.getElementById('sess-branch').value=s.branch||'مدينة نصر';
    document.getElementById('sess-start').value=s.startDate||'';
    document.getElementById('sess-status').value=s.status||'جارية';
    document.getElementById('sess-notes').value=s.notes||'';
  } else {
    document.getElementById('sess-total-count').value=6;
    document.getElementById('sess-done-count').value=0;
    document.getElementById('sess-start').value=new Date().toISOString().split('T')[0];
    document.getElementById('sess-status').value='جارية';
    document.getElementById('sess-notes').value='';
  }
  openModal('session-modal');
}
function saveSession(){
  const sel=document.getElementById('sess-pat');
  const opt=sel.options[sel.selectedIndex];
  if(!opt?.value){showToast('warning','⚠️ اختر عميلاً');return;}
  const id=gv('sess-id');
  const data={patId:opt.value,patName:opt.dataset?.name||opt.text,type:gv('sess-type'),doctor:gv('sess-doc'),total:parseInt(gv('sess-total-count'))||6,done:parseInt(gv('sess-done-count'))||0,branch:gv('sess-branch'),startDate:gv('sess-start'),status:gv('sess-status'),notes:gv('sess-notes')};
  if(id){DB.upd('sessions',id,data);showToast('success','✅ تم تحديث خطة الجلسات');}
  else{DB.push('sessions',data);showToast('success',`✅ تم إنشاء خطة جلسات لـ ${data.patName}`);}
  closeModal('session-modal');renderSessions();
}
function addSessionProgress(id){
  const s=DB.get('sessions').find(x=>x.id===id);if(!s)return;
  if((s.done||0)>=(s.total||0)){showToast('warning','⚠️ اكتملت كل الجلسات المقررة');return;}
  const newDone=(s.done||0)+1;
  const newStatus=newDone>=s.total?'مكتملة':s.status;
  DB.upd('sessions',id,{done:newDone,status:newStatus});
  // ✅ BUG#4 FIX: خصم المخزون بناءً على الخدمة المرتبطة بخطة الجلسات
  const svc = DB.get('services').find(x => x.id === s.serviceId || x.name === s.service);
  if(svc) deductInventory(svc.id, 1);
  showToast('success',`✅ تم تسجيل الجلسة ${newDone} من ${s.total}`,newStatus==='مكتملة'?'🎉 اكتملت خطة الجلسات!':'');
  renderSessions();
}
function delSession(id){
  const s=DB.get('sessions').find(x=>x.id===id);
  if(confirm(`حذف خطة جلسات ${s?.patName||''}؟`)){DB.del('sessions',id);showToast('info','🗑 تم الحذف');renderSessions();}
}

// ══════════════════════════════════════════
// 🎁 PACKAGES (TREATMENT BUNDLES)
// ══════════════════════════════════════════
function renderPackages(){
  const grid=document.getElementById('pkg-grid');if(!grid)return;
  const q=(document.getElementById('pkg-search')?.value||'').toLowerCase();
  const status=document.getElementById('pkg-status-filter')?.value||'';
  let items=DB.get('packages');
  if(q)items=items.filter(p=>p.name?.toLowerCase().includes(q)||p.patName?.toLowerCase().includes(q));
  if(status)items=items.filter(p=>p.status===status);
  const active=DB.get('packages').filter(p=>p.status==='نشطة');
  const revenue=DB.get('packages').reduce((s,p)=>s+(p.paid||0),0);
  const clients=new Set(DB.get('packages').map(p=>p.patId)).size;
  txt('pkg-kpi-total',DB.get('packages').length);
  txt('pkg-kpi-active',active.length);
  txt('pkg-kpi-revenue',revenue.toLocaleString());
  txt('pkg-kpi-clients',clients);
  const SCOL={نشطة:'sc',منتهية:'sd',معلقة:'sp'};
  grid.innerHTML=items.map(p=>{
    const remaining=Math.max(0,(p.price||0)-(p.paid||0));
    const sessUsed = p.sessionsUsed || 0;
    const sessTotal = p.sessionsCount || 0;
    const sessLeft = Math.max(0, sessTotal - sessUsed);
    const sessPct = sessTotal ? Math.round(sessUsed / sessTotal * 100) : 0;
    const sessColor = sessLeft === 0 ? 'var(--rose)' : sessLeft === 1 ? 'var(--gold-light)' : 'var(--emerald)';
    const sessArr = sessTotal > 0 ? Array.from({length: sessTotal}, (_, i) =>
      i < sessUsed
        ? `<span title="جلسة ${i+1} - مستخدمة" style="width:14px;height:14px;border-radius:50%;background:var(--teal);display:inline-block;margin:1px;"></span>`
        : `<span title="جلسة ${i+1} - متبقية" style="width:14px;height:14px;border-radius:50%;background:var(--glass-border);display:inline-block;margin:1px;"></span>`
    ).join('') : '';
    return `<div class="bcard">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <div>
          <div style="font-size:15px;font-weight:800;">${p.name||'—'}</div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">👤 ${p.patName||'—'}</div>
        </div>
        <span class="ast ${SCOL[p.status]||'sd'}">${p.status}</span>
      </div>
      <div class="g2c" style="gap:8px;margin-bottom:11px;">
        <div style="background:var(--glass);border-radius:8px;padding:9px;text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--gold-light)">${(p.price||0).toLocaleString()}</div><div style="font-size:11px;color:var(--text-muted)">السعر (ج)</div></div>
        <div style="background:var(--glass);border-radius:8px;padding:9px;text-align:center;"><div style="font-size:18px;font-weight:800;color:${remaining>0?'var(--rose)':'var(--emerald)'}">${remaining.toLocaleString()}</div><div style="font-size:11px;color:var(--text-muted)">المتبقي (ج)</div></div>
      </div>
      <div style="background:var(--glass);border-radius:8px;padding:9px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:700;">🎯 الجلسات</span>
          <span style="font-size:13px;font-weight:800;color:${sessColor}">${sessUsed} / ${sessTotal} <span style="font-size:11px;color:var(--text-muted);">(متبقي: ${sessLeft})</span></span>
        </div>
        <div class="prog"><div class="prog-f" style="width:${sessPct}%;background:${sessColor}"></div></div>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:2px;">${sessArr}</div>
        ${sessLeft === 1 ? `<div style="font-size:11px;color:var(--gold-light);margin-top:4px;font-weight:700;">⚠️ جلسة أخيرة تبقّت!</div>` : ''}
        ${sessLeft === 0 ? `<div style="font-size:11px;color:var(--rose);margin-top:4px;font-weight:700;">✅ اكتملت كل الجلسات</div>` : ''}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">📅 ${p.startDate||'—'} ← ${p.endDate||'—'}</div>
      ${p.services?`<div style="margin-bottom:8px;"><span class="tag tg-gold" style="font-size:11px;">${p.services}</span></div>`:''}
      <div style="display:flex;gap:7px;margin-bottom:7px;">
        ${sessLeft > 0 ? `<button class="btn btn-teal btn-sm" style="flex:1" onclick="usePackageSession('${p.id}')">✅ تسجيل جلسة</button>` : ''}
        <button class="btn btn-ghost btn-sm" ${sessLeft>0?'':'style="flex:1"'} onclick="openPackageModal('${p.id}')">✏️ تعديل</button>
        <button class="btn btn-danger btn-sm" onclick="delPackage('${p.id}')">🗑 حذف</button>
      </div>
    </div>`;
  }).join('')||'<div class="card" style="text-align:center;padding:40px;color:var(--text-muted);grid-column:1/-1;">لا توجد باقات مطابقة</div>';
}
function openPackageModal(id, presetPatId){
  const p=id?DB.get('packages').find(x=>x.id===id):null;
  // presetPatId: معرّف العميل لو جاء الطلب من شاشة ملف العميل
  const targetPatId = presetPatId || (p?p.patId:null) || window._curPat || null;
  document.getElementById('pkg-modal-title').textContent=p?'✏️ تعديل الباقة':'🎁 باقة علاجية جديدة';
  document.getElementById('pkg-id').value=p?p.id:'';
  const sel=document.getElementById('pkg-pat');
  sel.innerHTML=DB.get('patients').map(pt=>`<option value="${pt.id}" data-name="${pt.name}"${String(pt.id)===String(targetPatId)?' selected':''}>${pt.name}</option>`).join('');
  if(p){
    document.getElementById('pkg-name').value=p.name||'';
    document.getElementById('pkg-services').value=p.services||'';
    document.getElementById('pkg-sessions-count').value=p.sessionsCount||6;
    document.getElementById('pkg-price').value=p.price||0;
    document.getElementById('pkg-paid').value=p.paid||0;
    document.getElementById('pkg-start').value=p.startDate||'';
    document.getElementById('pkg-end').value=p.endDate||'';
    document.getElementById('pkg-status').value=p.status||'نشطة';
    document.getElementById('pkg-notes').value=p.notes||'';
  } else {
    ['pkg-name','pkg-services','pkg-notes'].forEach(fid=>document.getElementById(fid).value='');
    document.getElementById('pkg-sessions-count').value=6;
    document.getElementById('pkg-price').value='';
    document.getElementById('pkg-paid').value=0;
    document.getElementById('pkg-start').value=new Date().toISOString().split('T')[0];
    document.getElementById('pkg-end').value='';
    document.getElementById('pkg-status').value='نشطة';
  }
  openModal('package-modal');
}
function savePackage(){
  const sel=document.getElementById('pkg-pat');
  const opt=sel.options[sel.selectedIndex];
  if(!opt?.value){showToast('warning','⚠️ اختر عميلاً');return;}
  const name=gv('pkg-name').trim();
  if(!name){showToast('warning','⚠️ اسم الباقة مطلوب');return;}
  const id=gv('pkg-id');
  const data={patId:opt.value,patName:opt.dataset?.name||opt.text,name,services:gv('pkg-services'),sessionsCount:parseInt(gv('pkg-sessions-count'))||6,sessionsUsed:id?(DB.get('packages').find(p=>p.id===id)?.sessionsUsed||0):0,price:parseFloat(gv('pkg-price'))||0,paid:parseFloat(gv('pkg-paid'))||0,startDate:gv('pkg-start'),endDate:gv('pkg-end'),status:gv('pkg-status'),notes:gv('pkg-notes')};
  if(id){
    // تحديث باقة موجودة
    const oldPkg = DB.get('packages').find(p=>p.id===id);
    const oldPaid = oldPkg?.paid || 0;
    DB.upd('packages',id,data);
    // إذا زاد المبلغ المدفوع، سجّل الفرق في الخزينة
    const paidDelta = Math.max(0, data.paid - oldPaid);
    if(paidDelta > 0){
      DB.push('cashlog',{
        type:'وارد', source:`باقة — ${data.patName}`, refId:id,
        amount:paidDelta, service:data.name, method:'كاش',
        date:new Date().toISOString().split('T')[0],
        notes:`دفعة إضافية على باقة: ${data.name}`
      });
    }
    // ✅ FIX (مشكلة "شاشة المدفوعات" — الدفع من الباقة لا يتزامن مع ملف العميل):
    // تعديل paid هنا مباشرة من نافذة الباقة كان لا يُحدّث الفاتورة المرتبطة (pkgId)،
    // على عكس كل مسارات الدفع الأخرى (processSmartPayment/processPatientPayment/
    // ppayPayAll/payInstallment) التي تُزامن الفاتورة دائماً. النتيجة: فاتورة الباقة
    // تظل بمتبقٍ قديم (remaining قديم)، وبما أن openPayFromProfile يستثني فقط فواتير
    // الباقات "غير المكتملة السداد" (pendingPkgs)، فباقة أصبحت مسددة بالكامل هنا كانت
    // تختفي من قائمة "الباقات المستحقة" بينما تبقى فاتورتها القديمة تظهر كمبلغ مستحق
    // منفصل في شاشة الدفع من ملف العميل — ازدواجية/تضارب في المبلغ المطلوب فعلياً.
    const pkgInv = DB.get('invoices').find(i => String(i.pkgId) === String(id));
    if(pkgInv){
      const newInvTotal = data.price || pkgInv.total || 0;
      const newInvPaid  = Math.min(newInvTotal, data.paid || 0);
      const newInvRem   = Math.max(0, newInvTotal - newInvPaid);
      DB.upd('invoices', pkgInv.id, {
        total: newInvTotal,
        paid: newInvPaid,
        remaining: newInvRem,
        status: newInvRem === 0 ? 'مدفوع' : (newInvPaid > 0 ? 'جزئي' : 'معلق')
      });
    }
    showToast('success','✅ تم تحديث الباقة');
  } else {
    const newPkg = DB.push('packages',data);
    // الفاتورة هتتعمل بالـ paid الفعلي → EventBus('invoices:created') يسجل cashlog تلقائياً
    const remaining = Math.max(0, data.price - data.paid);
    if(remaining > 0){
      // الفاتورة بتطلق invoices:created → EventBus في 00-core.js هو اللي يعمل القسط تلقائياً
      // _noAutoInstallment:false = مش محتاجين نعمل قسط يدوي هنا تاني
      DB.push('invoices',{
        patId: data.patId, patientId: data.patId,
        patient: data.patName,
        service: `باقة: ${data.name}`,
        originalPrice: data.price,
        discount: 0,
        total: data.price,
        paid: data.paid || 0,
        remaining: remaining,
        status: 'معلق',
        method: 'كاش',
        date: data.startDate || new Date().toISOString().split('T')[0],
        pkgId: newPkg?.id || null,
        notes: `فاتورة مرتبطة بالباقة — متبقي ${remaining.toLocaleString()} ج`
      });
      const pat = DB.get('patients').find(p => String(p.id) === String(data.patId));
      if(pat) DB.upd('patients', pat.id, { status: 'قسط' });
      showToast('success',`✅ تم إنشاء باقة "${name}" لـ ${data.patName}`, `🧾 متبقي ${remaining.toLocaleString()} ج أُضيف للأقساط تلقائياً`);
    } else {
      // باقة مدفوعة بالكامل → فاتورة مغلقة لتسجيل cashlog تلقائياً
      DB.push('invoices',{
        patId: data.patId, patientId: data.patId,
        patient: data.patName,
        service: `باقة: ${data.name}`,
        originalPrice: data.price, discount: 0,
        total: data.price, paid: data.price, remaining: 0,
        status: 'مدفوع', method: 'كاش',
        date: data.startDate || new Date().toISOString().split('T')[0],
        pkgId: newPkg?.id || null,
        notes: `فاتورة باقة مدفوعة بالكامل`
      });
      showToast('success',`✅ تم إنشاء باقة "${name}" لـ ${data.patName}`);
    }
  }
  closeModal('package-modal');renderPackages();
}
function delPackage(id){
  const p=DB.get('packages').find(x=>x.id===id);
  if(confirm(`حذف باقة "${p?.name||''}"؟`)){DB.del('packages',id);showToast('info','🗑 تم الحذف');renderPackages();}
}

// ── خصم جلسة يدوياً من باقة محددة (زر "تسجيل جلسة" في شاشة الباقات) ──
function usePackageSession(pkgId){
  const pkg = DB.get('packages').find(p => p.id === pkgId); if(!pkg) return;
  const sessUsed = pkg.sessionsUsed || 0;
  const sessTotal = pkg.sessionsCount || 0;
  if(sessUsed >= sessTotal){ showToast('warning','⚠️ اكتملت كل جلسات هذه الباقة'); return; }
  const remaining = sessTotal - sessUsed - 1;
  if(!confirm(`تسجيل جلسة للعميل: ${pkg.patName}\nالباقة: ${pkg.name}\nالجلسة: ${sessUsed+1} من ${sessTotal}\nالمتبقي بعد هذه الجلسة: ${remaining} جلسة`)) return;
  const newStatus = remaining <= 0 ? 'منتهية' : 'نشطة';
  DB.upd('packages', pkgId, { sessionsUsed: sessUsed + 1, status: newStatus });
  const msg = remaining <= 0
    ? `🎉 اكتملت جميع جلسات باقة "${pkg.name}" للعميل ${pkg.patName}`
    : remaining === 1
    ? `⚠️ تبقّت جلسة أخيرة فقط من باقة "${pkg.name}"!`
    : `✅ تم تسجيل الجلسة ${sessUsed+1}/${sessTotal} — متبقي: ${remaining} جلسة`;
  showToast(remaining <= 0 ? 'info' : remaining === 1 ? 'warning' : 'success', msg);
  renderPackages();
}

// ── خصم جلسة من باقة العميل النشطة ──
// يُستدعى تلقائياً عند إتمام موعد أو تسجيل جلسة من الخطة
function deductPackageSession(patId, svcName){
  // ابحث عن أول باقة نشطة للعميل تتطابق مع الخدمة (أو أي باقة نشطة)
  const pkgs = DB.get('packages').filter(p =>
    p.patId === patId &&
    p.status === 'نشطة' &&
    (p.sessionsUsed || 0) < (p.sessionsCount || 1)
  );
  if(!pkgs.length) return null; // لا توجد باقة نشطة

  // أولوية: باقة بنفس اسم الخدمة، وإلا أول باقة نشطة
  const pkg = pkgs.find(p => p.services && svcName && p.services.toLowerCase().includes(svcName.toLowerCase())) || pkgs[0];
  const newUsed   = (pkg.sessionsUsed || 0) + 1;
  const remaining = (pkg.sessionsCount || 1) - newUsed;
  const newStatus = remaining <= 0 ? 'منتهية' : 'نشطة';
  DB.upd('packages', pkg.id, { sessionsUsed: newUsed, status: newStatus });
  return { pkg, newUsed, remaining, finished: remaining <= 0 };
}

// ── الحصول على ملخص باقة العميل النشطة (للعرض في المواعيد) ──
function getPatientActivePackage(patId){
  return DB.get('packages').find(p =>
    p.patId === patId &&
    p.status === 'نشطة' &&
    (p.sessionsUsed || 0) < (p.sessionsCount || 1)
  ) || null;
}

// ─── PHASE 3: Reception & Doctor Screens + Consultation Engine ───────────────

function renderReception(){
  const today=new Date().toISOString().split('T')[0];
  const now=new Date();
  const dlbl=document.getElementById('rec-date-lbl');
  if(dlbl) dlbl.textContent=now.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  
  // ✅ عرض الاستدعاءات النشطة أولاً
  const activeCallsContainer = document.getElementById('active-calls-container');
  if(activeCallsContainer){
    const activeCalls = (DB.get('call_queue') || []).filter(c => c.status === 'active');
    
    if(activeCalls.length > 0){
      activeCallsContainer.innerHTML = activeCalls.map(call => `
        <div class="call-alert" style="
          background: linear-gradient(135deg, #FF6B6B 0%, #FF4757 100%);
          border: 3px solid #FF1744;
          border-radius: 12px;
          padding: 20px;
          margin: 15px 0;
          box-shadow: 0 0 20px rgba(255, 23, 68, 0.4), 0 0 40px rgba(255, 107, 107, 0.2);
        ">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px;">
            <div style="flex: 1;">
              <div style="font-size: 28px; font-weight: 900; color: white; margin-bottom: 8px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
                🔴 استدعاء من د. ${call.doctor}
              </div>
              <div style="font-size: 24px; color: white; font-weight: 700; margin-bottom: 5px;">
                👤 ${call.patientName}
              </div>
              <div style="font-size: 14px; color: rgba(255,255,255,0.9);">
                ⏰ ${call.time}
              </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <button 
                onclick="processCall('${call.id}', true); renderReception()"
                style="
                  background: linear-gradient(135deg, #00D084 0%, #00C863 100%);
                  color: white;
                  border: none;
                  padding: 18px 35px;
                  font-size: 18px;
                  font-weight: 700;
                  border-radius: 10px;
                  cursor: pointer;
                  box-shadow: 0 4px 15px rgba(0, 208, 132, 0.4);
                  transition: all 0.3s;
                  white-space: nowrap;
                ">
                ✓ دخول العميل
              </button>
              
              <button 
                onclick="processCall('${call.id}', false); renderReception()"
                style="
                  background: rgba(255,255,255,0.2);
                  color: white;
                  border: 2px solid white;
                  padding: 10px 20px;
                  font-size: 14px;
                  border-radius: 8px;
                  cursor: pointer;
                  transition: all 0.3s;
                ">
                ✕ إلغاء
              </button>
            </div>
          </div>
        </div>
      `).join('');
      
      // تشغيل الصوت عند ظهور استدعاء جديد
      playCallSound();
      
    } else {
      activeCallsContainer.innerHTML = '';
    }
  }
  
  // ── باقي شاشة الاستقبال العادية ──
  const docSel = document.getElementById('rec-doc-filter');
  if(docSel && docSel.options.length<=1){
    DB.get('doctors').forEach(d=>{const o=document.createElement('option');o.value=d.name;o.textContent=d.name;docSel.appendChild(o);});
  }
  const docF=docSel?.value||'';
  let appts=DB.get('appointments').filter(a=>a.date===today&&a.status!=='ملغي');
  if(docF) appts=appts.filter(a=>a.doctor===docF);
  appts.sort((a,b)=>_timeToMin(a.time)-_timeToMin(b.time));
  const allToday=DB.get('appointments').filter(a=>a.date===today&&a.status!=='ملغي');
  txt('rec-kpi-total',allToday.length);
  txt('rec-kpi-checkin',allToday.filter(a=>['وصل','في الاستشارة','مكتمل'].includes(a.status)).length);
  txt('rec-kpi-late',allToday.filter(a=>a.status==='متأخر').length);
  txt('rec-kpi-done',allToday.filter(a=>a.status==='مكتمل').length);
  txt('rec-count-lbl',appts.length+' موعد');
  const AVA_C=['linear-gradient(135deg,#C4A882,#9A7050)','linear-gradient(135deg,#2DD4BF,#14B8A6)','linear-gradient(135deg,#8B5CF6,#6D28D9)','linear-gradient(135deg,#F43F5E,#BE123C)','linear-gradient(135deg,#10B981,#047857)'];
  const ST_LBL={'مؤكد':'مؤكد 📋','قادم':'🔔 قادم','انتظار':'⏳ انتظار','وصل':'✅ وصل','في الاستشارة':'💬 استشارة','متأخر':'⚠️ متأخر','مكتمل':'✔ مكتمل','لم يحضر':'❌ لم يحضر'};
  const container=document.getElementById('rec-queue');
  if(!container) return;
  if(!appts.length){container.innerHTML=`<div style="text-align:center;padding:40px;color:var(--text-muted)">لا توجد مواعيد اليوم${docF?' للطبيب المحدد':''} 📅</div>`;return;}
  container.innerHTML=appts.map((a,i)=>{
    const stCls=ASC[a.status]||'sd';
    const canCheckIn=['مؤكد','قادم','انتظار','متأخر'].includes(a.status);
    const isActive=['وصل','في الاستشارة'].includes(a.status);
    const isDone=['مكتمل','لم يحضر'].includes(a.status);
    const timer=_wlTimerStr(a);
    return `<div class="wq-card ${a.status==='متأخر'?'wq-late':isActive?'wq-checkin':''}">
      <div class="wq-ava" style="background:${AVA_C[i%AVA_C.length]}">${genderAva(_patGender(a.patId,a.patient))}</div>
      <div class="wq-info">
        <div class="wq-name">${a.patient}</div>
        <div class="wq-meta">${a.time}${a.endTime?' – '+a.endTime:''} · ${a.service||'—'} · <span style="color:var(--teal)">${a.doctor||'—'}</span></div>
        ${a.checkInTime?`<div style="font-size:11px;color:var(--teal)">وصل ${a.checkInTime}</div>`:''}
      </div>
      <div class="wq-timer">${timer}</div>
      <span class="ast ${stCls}" style="font-size:11.5px">${ST_LBL[a.status]||a.status}</span>
      <div class="wq-actions">
        ${canCheckIn?`<button class="btn btn-teal btn-sm" onclick="wlCheckIn('${a.id}');renderReception()">✅ وصل</button>`:''}
        ${!isDone?`<button class="btn btn-ghost btn-xs" onclick="wlMarkNoShow('${a.id}');renderReception()" title="لم يحضر">❌</button>`:''}
      </div>
    </div>`;
  }).join('');
}

function _nowTimeStr(){
  const n=new Date();
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}

function renderDoctorView(){
  const today=new Date().toISOString().split('T')[0];
  const now=new Date();
  const dlbl=document.getElementById('dv-date-lbl');
  if(dlbl) dlbl.textContent=now.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const docSel=document.getElementById('dv-doc-select');
  if(docSel){
    // ✅ إعادة ملء القائمة دائماً من DB لضمان تحديثها عند إضافة/حذف أطباء
    const prevVal = docSel.value;
    docSel.innerHTML = '<option value="">— اختر طبيباً —</option>' +
      DB.get('doctors').map(d=>`<option value="${d.name}">${d.name}</option>`).join('');
    if(prevVal && DB.get('doctors').some(d=>d.name===prevVal)) docSel.value = prevVal;
  }
  const docName=docSel?.value||'';
  const docInfo=DB.get('doctors').find(d=>d.name===docName);
  const container=document.getElementById('dv-queue');
  if(!container) return;
  if(!docName){
    container.innerHTML=`<div style="text-align:center;padding:40px;color:var(--text-muted)">اختر طبيباً من القائمة أعلاه 👆</div>`;
    txt('dv-kpi-today',0);txt('dv-kpi-waiting',0);txt('dv-kpi-done',0);txt('dv-kpi-comm','—');txt('dv-count-lbl','');
    return;
  }
  let appts=DB.get('appointments').filter(a=>a.date===today&&a.doctor===docName&&a.status!=='ملغي');
  const PRIO={'في الاستشارة':0,'وصل':1,'متأخر':2,'انتظار':3,'قادم':4,'مؤكد':5,'مكتمل':9,'لم يحضر':10};
  appts.sort((a,b)=>{
    const pa=PRIO[a.status]??8,pb=PRIO[b.status]??8;
    if(pa!==pb) return pa-pb;
    const ta=a.checkInTime?_timeToMin(a.checkInTime):_timeToMin(a.time);
    const tb=b.checkInTime?_timeToMin(b.checkInTime):_timeToMin(b.time);
    return ta-tb;
  });
  const waiting=appts.filter(a=>['وصل','انتظار','متأخر'].includes(a.status)).length;
  const done=appts.filter(a=>a.status==='مكتمل').length;
  const todayInvs=DB.get('invoices').filter(i=>i.doctor===docName&&(i.date||'')==today);
  const todayRev=todayInvs.reduce((s,i)=>s+(i.paid||0),0); // إيراد فواتير اليوم — مقياس عرض منفصل، لا علاقة له بحساب العمولة
  // ✅ FIX (خطة التوحيد — مرحلة 1.1ب): commissionAmount تراكمية على الفاتورة
  // وليست مفصولة يومياً، فلا توجد طريقة دقيقة لعرض "عمولة اليوم فقط" بدون
  // حقل تاريخ منفصل لكل تحديث عمولة. الحل الصحيح: عرض إجمالي العمولة
  // المستحقة الفعلي (وليس تقريباً يومياً خاطئاً بإيراد اليوم × نسبة العمولة).
  const comm=Math.round(getDoctorCommissionDue(docInfo?.id, docName));
  txt('dv-kpi-today',appts.length);txt('dv-kpi-waiting',waiting);txt('dv-kpi-done',done);
  txt('dv-kpi-comm',comm.toLocaleString());txt('dv-count-lbl',appts.length+' مريض');
  const AVA_C=['linear-gradient(135deg,#C4A882,#9A7050)','linear-gradient(135deg,#2DD4BF,#14B8A6)','linear-gradient(135deg,#8B5CF6,#6D28D9)','linear-gradient(135deg,#F43F5E,#BE123C)','linear-gradient(135deg,#10B981,#047857)'];
  if(!appts.length){container.innerHTML=`<div style="text-align:center;padding:40px;color:var(--text-muted)">لا توجد مرضى لـ ${docName} اليوم ✨</div>`;return;}
  const nowMin=new Date().getHours()*60+new Date().getMinutes();
  container.innerHTML=appts.map((a,i)=>{
    const stCls=ASC[a.status]||'sd';
    const canCall=['مؤكد','وصل','انتظار','متأخر'].includes(a.status);
    const inConsult=a.status==='في الاستشارة';
    const isDone=a.status==='مكتمل';
    const timer=_wlTimerStr(a);
    const waitMin=a.checkInTime&&!inConsult&&!isDone?Math.max(0,nowMin-_timeToMin(a.checkInTime)):null;
    return `<div class="wq-card ${inConsult?'wq-consult':canCall?'wq-checkin':''}" style="${isDone?'opacity:.6':''}">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--glass);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--text-muted);flex-shrink:0">${i+1}</div>
      <div class="wq-ava" style="background:${AVA_C[i%AVA_C.length]}">${genderAva(_patGender(a.patId,a.patient))}</div>
      <div class="wq-info">
        <div class="wq-name">${a.patient}</div>
        <div class="wq-meta">${a.service||'—'} · موعد ${a.time}${a.checkInTime?' · وصل '+a.checkInTime:''}</div>
        ${inConsult&&a.consultStart?`<div style="font-size:11px;color:var(--purple)">بدأت ${a.consultStart} · مضى ${timer}</div>`:''}
        ${waitMin!==null?`<div style="font-size:11px;color:var(--amber)">ينتظر ${waitMin} دقيقة</div>`:''}
      </div>
      <span class="ast ${stCls}" style="font-size:11px">${a.status}</span>
      <div class="wq-actions">
        ${canCall?`<button class="btn btn-primary btn-sm" onclick="(()=>{ document.getElementById('dv-appt-id').value='${a.id}'; document.getElementById('dv-doctor-name').value='${docName}'; callPatient(); renderDoctorView(); })()">📢 استدعاء</button>`:''}
        ${inConsult?`<button class="btn btn-sm" style="background:linear-gradient(135deg,var(--emerald),#047857);color:#fff;border:none;padding:6px 12px;border-radius:8px;font-family:Tajawal,sans-serif;font-weight:600;cursor:pointer" onclick="openConsultDoneModal('${a.id}')">✅ إنهاء</button>`:''}
        ${isDone?`<span style="font-size:11px;color:var(--emerald)">✔ مكتمل</span>`:''}
      </div>
    </div>`;
  }).join('');
}

function openConsultDoneModal(apptId){
  const a=DB.get('appointments').find(x=>x.id===apptId);
  if(!a) return;
  document.getElementById('cd-appt-id').value=apptId;
  const now=_nowTimeStr();
  const startMin=a.consultStart?_timeToMin(a.consultStart):_timeToMin(a.time);
  const durMin=Math.max(0,_timeToMin(now)-startMin);
  const dur=durMin>0?`${durMin} دقيقة`:'—';
  const doc=DB.get('doctors').find(d=>d.name===a.doctor);
  document.getElementById('cd-summary').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;">
      <div><span style="color:var(--text-muted)">المريض:</span> <strong>${a.patient}</strong></div>
      <div><span style="color:var(--text-muted)">الطبيب:</span> <strong>${a.doctor||'—'}</strong></div>
      <div><span style="color:var(--text-muted)">بدأت:</span> ${a.consultStart||'—'}</div>
      <div><span style="color:var(--text-muted)">مدة الاستشارة:</span> <strong style="color:var(--teal)">${dur}</strong></div>
      <div><span style="color:var(--text-muted)">الخدمة:</span> ${a.service||'—'}</div>
      <div><span style="color:var(--text-muted)">العمولة:</span> ${doc?.commission||0}%</div>
    </div>`;
  const svcSel=document.getElementById('cd-svc');
  const svcs=DB.get('services')||[];
  svcSel.innerHTML=svcs.length
    ? svcs.map(s=>`<option value="${s.name}" data-price="${s.price||0}">${s.name}${s.price?' — '+Number(s.price).toLocaleString()+' ج':''}</option>`).join('')
    : '<option value="">— لا توجد خدمات —</option>';
  if(a.service) svcSel.value=a.service;
  onCdSvcChange();
  const ntEl=document.getElementById('cd-notes');if(ntEl)ntEl.value='';
  const discEl=document.getElementById('cd-disc');if(discEl)discEl.value=0;
  document.querySelectorAll('#consult-done-modal .pay-m').forEach(el=>el.classList.remove('sel'));
  document.querySelector('#consult-done-modal .pay-m')?.classList.add('sel');
  document.getElementById('consult-done-modal')?.classList.add('open');
}

function onCdSvcChange(){
  const svcSel=document.getElementById('cd-svc');
  const opt=svcSel?.options[svcSel.selectedIndex];
  const price=parseFloat(opt?.dataset?.price)||0;
  const priceEl=document.getElementById('cd-price');
  if(priceEl)priceEl.value=price;
  calcCdTotal();
}

function calcCdTotal(){
  const apptId=document.getElementById('cd-appt-id')?.value;
  const a=DB.get('appointments').find(x=>x.id===apptId);
  const doc=a?DB.get('doctors').find(d=>d.name===a.doctor):null;
  const price=parseFloat(document.getElementById('cd-price')?.value)||0;
  const disc=parseFloat(document.getElementById('cd-disc')?.value)||0;
  const net=Math.max(0,price-disc);
  // ✅ عمولة الطبيب تُحسب من صافي الربح (بعد خصم تكلفة المنتجات/المواد المستخدمة
  // في الخدمة)، وليس من إجمالي سعر الخدمة — نفس منهجية "صافي الربح" المستخدمة
  // في شاشة الخدمات وشاشة الباقات (calcServiceMaterialCost). هذا مجرد استعراض
  // (preview) بدون خصم فعلي من المخزون؛ الخصم الحقيقي والقيمة النهائية للعمولة
  // يحدثان في finalizeConsultation() عند الإنهاء الفعلي.
  const svcSel=document.getElementById('cd-svc');
  const svcName=svcSel?.options[svcSel?.selectedIndex]?.value||a?.service||'';
  const svcRecord=DB.get('services').find(s=>s.name===svcName);
  const matCost=svcRecord&&typeof calcServiceMaterialCost==='function'?calcServiceMaterialCost(svcRecord.id):0;
  // ✅ FIX: لو الجلسة مغطاة بباقة نشطة، قيمة الجلسة الحقيقية هي نصيب الجلسة
  // من سعر بيع الباقة (price/sessionsCount)، مش سعر الخدمة في الفورم (اللي
  // غالبًا صفر للخدمات المُباعة بس جوه باقات). نفس منطق finalizeConsultation.
  const _activePkg=a?getPatientActivePackage(a.patId):null;
  const _covered=_activePkg&&(!_activePkg.services||!_activePkg.services.trim()||_activePkg.services.includes(svcName));
  const pkgSessionValue=_covered?Math.max(0,((_activePkg.price||0)-(_activePkg.discount||0))/(_activePkg.sessionsCount||1)):0;
  const sessionValue=_covered?pkgSessionValue:net;
  const netProfit=Math.max(0,sessionValue-matCost);
  const comm=Math.round(netProfit*(doc?.commission||0)/100);
  const netEl=document.getElementById('cd-net');
  const commEl=document.getElementById('cd-comm-display');
  if(netEl)netEl.textContent=net.toLocaleString()+' ج';
  if(commEl)commEl.textContent=comm.toLocaleString()+' ج ('+(doc?.commission||0)+'% من صافي الربح'+(_covered?' — نصيب الجلسة من الباقة '+sessionValue.toFixed(1)+' ج':'')+(matCost?' — بعد خصم تكلفة مواد '+matCost.toFixed(1)+' ج':'')+')';
}

function finalizeConsultation(){
  const apptId=document.getElementById('cd-appt-id')?.value;
  if(!apptId){showToast('error','❌ خطأ: لا يوجد موعد');return;}
  const a=DB.get('appointments').find(x=>x.id===apptId);
  if(!a){showToast('error','❌ الموعد غير موجود');return;}
  const now=_nowTimeStr();
  const svcSel=document.getElementById('cd-svc');
  const svcName=svcSel?.options[svcSel?.selectedIndex]?.value||a.service||'';
  const price=parseFloat(document.getElementById('cd-price')?.value)||0;
  const disc=parseFloat(document.getElementById('cd-disc')?.value)||0;
  const net=Math.max(0,price-disc);
  const notes=document.getElementById('cd-notes')?.value||'';
  const method=document.querySelector('#consult-done-modal .pay-m.sel')?.textContent?.trim()||'كاش';
  const doc=DB.get('doctors').find(d=>d.name===a.doctor);
  const pat=DB.get('patients').find(p=>String(p.id)===String(a.patId));
  const today=new Date().toISOString().split('T')[0];
  const startMin=a.consultStart?_timeToMin(a.consultStart):_timeToMin(a.time);
  const durMin=Math.max(0,_timeToMin(now)-startMin);
  // 1. Complete appointment
  DB.upd('appointments',apptId,{status:'مكتمل',consultEnd:now,consultDuration:durMin,consultNotes:notes});
  // 2. ✅ FIX: تحقق من باقة نشطة قبل إنشاء الفاتورة
  // لو العميل في باقة تغطي هذه الخدمة → فاتورة بـ total=0 (مغطاة بالباقة) لتجنب المحاسبة المزدوجة
  const _activePkgCheck = getPatientActivePackage(a.patId);
  const _coveredByPkg   = _activePkgCheck &&
    (!_activePkgCheck.services || !_activePkgCheck.services.trim() ||
     _activePkgCheck.services.includes(svcName));
  // 2b. خصم المخزون *قبل* إنشاء الفاتورة عشان نلحق نسجّل تكلفة المواد الفعلية
  // جوه الفاتورة نفسها (materialCost) — تُستخدم لاحقًا لترحيل قيد COGS في
  // 14-accounting-hooks.js (بطلب المستخدم: صافي الربح يعكس تكلفة المواد فعليًا).
  const svcRecord = DB.get('services').find(s => s.name === svcName) || DB.get('services').find(s => s.id === a.serviceId);
  const _materialCost = deductInventory(svcRecord?.id || a.serviceId, 1) || 0;
  // ✅ FIX (الجذر الحقيقي للمشكلة): الخدمات اللي بتتباع بس جوه باقة (زي "جلسة
  // خلايا جزء") غالبًا سعرها في كتالوج الخدمات صفر أو غير معرّف — مفيش سعر
  // مستقل ليها أصلاً، فاستخدام price/net (سعر مربوط بحقل الفورم) كان بيدّي
  // صافي ربح = صفر دايمًا لأي جلسة مغطاة بباقة، أيًا كان تعديل معادلة العمولة.
  // القيمة الحقيقية للجلسة في حالة الباقة هي نصيبها من سعر بيع الباقة نفسها
  // (نفس منطق sellingPrice المستخدم أصلاً في _updatePackageFinancials —
  // 12-financial-integration.js — لحساب ربح الباقة الكلي)، مقسومة على عدد
  // الجلسات، وليس سعر الخدمة في الفورم.
  const _pkgSessionValue = _coveredByPkg
    ? Math.max(0, ((_activePkgCheck.price||0) - (_activePkgCheck.discount||0)) / (_activePkgCheck.sessionsCount || 1))
    : 0;
  // ✅ FIX (بطلب المستخدم): عمولة الطبيب تُحسب من صافي الربح — قيمة الجلسة
  // (سعر الخدمة بعد الخصم لو فاتورة عادية، أو نصيب الجلسة من سعر الباقة لو
  // مغطاة بباقة) مطروحًا منها تكلفة المنتجات/المواد المستهلكة فعليًا
  // (_materialCost) — وليس من إجمالي السعر كما كان سابقًا.
  const _sessionValue = _coveredByPkg ? _pkgSessionValue : net;
  const _netProfit = Math.max(0, _sessionValue - _materialCost);
  const comm = Math.round(_netProfit * (doc?.commission || 0) / 100);
  if(_coveredByPkg){
    // ✅ FIX: كانت الفاتورة المغطاة بباقة تُسجَّل بعمولة صفر للطبيب لأن total/paid=0
    // (تجنبًا للمحاسبة المزدوجة على الإيراد). لكن الطبيب لا يزال يقدّم الخدمة فعليًا،
    // فعمولته يجب أن تُحتسب من صافي ربح الجلسة (قيمة الخدمة − تكلفة المواد)
    // رغم عدم وجود تحصيل نقدي مباشر. نسجّل commissionAmount هنا مباشرة لأن
    // recordDoctorCommission (00-core.js) لا يعمل إلا لو paid>0.
    // ✅ FIX: رقم الجلسة الحالية داخل الباقة (لعرضها في الفاتورة بدل السعر/الخصم
    // بصفر، اللي كان بيظهر للعميل كأنه فاتورة بسعر وخصم كامل). نحسبها هنا قبل
    // استدعاء deductPackageSession (اللي بيحصل بعدين في الخطوة 3ب) عشان نمسك
    // رقم الجلسة الصحيح (sessionsUsed الحالي + 1).
    const _pkgSessionNumber = (_activePkgCheck.sessionsUsed||0) + 1;
    const _pkgSessionsTotal = _activePkgCheck.sessionsCount||1;
    DB.push('invoices',{
      patient:a.patient,patId:a.patId,doctor:a.doctor||'',doctorId:doc?.id||a.doctorId||'',service:svcName,
      date:today,originalPrice:price,discount:price,total:0,paid:0,remaining:0,
      status:'مدفوع',method:'باقة',fromAppt:apptId,
      pkgId:_activePkgCheck.id,pkgName:_activePkgCheck.name,
      sessionNumber:_pkgSessionNumber,sessionsTotal:_pkgSessionsTotal,
      commission:comm,commissionPct:doc?.commission||0,
      commissionAmount:comm,commissionRecorded:true,branch:a.branch||'',
      notes:`مغطاة بباقة: ${_activePkgCheck.name}`,
      materialCost:_materialCost,sessionValue:_sessionValue
    });
  } else {
    DB.push('invoices',{
      patient:a.patient,patId:a.patId,doctor:a.doctor||'',doctorId:doc?.id||a.doctorId||'',service:svcName,
      date:today,originalPrice:price,discount:disc,total:net,paid:net,remaining:0,
      status:'مدفوع',method,fromAppt:apptId,commission:comm,commissionPct:doc?.commission||0,branch:a.branch||'',
      materialCost:_materialCost,sessionValue:_sessionValue
    });
  }
  // 3b. خصم تلقائي من باقة العميل النشطة
  const pkgResult = deductPackageSession(a.patId, svcName);
  if(pkgResult){
    const pkgMsg = pkgResult.finished
      ? `🎁 اكتملت باقة "${pkgResult.pkg.name}"!`
      : pkgResult.remaining === 1
      ? `⚠️ تبقّت جلسة أخيرة في باقة "${pkgResult.pkg.name}"`
      : `🎁 باقة: ${pkgResult.newUsed}/${pkgResult.pkg.sessionsCount} جلسة (متبقي: ${pkgResult.remaining})`;
    setTimeout(()=>showToast(pkgResult.finished?'info':pkgResult.remaining===1?'warning':'success', pkgMsg), 1500);
  }
  // 4. تحديث ملف العميل
  if(pat){
    const sesssDone = DB.get('sessions').filter(s=>s.patId===pat.id).reduce((s,x)=>s+(x.done||0),0);
    const apptsDone = DB.get('appointments').filter(a=>a.patId===pat.id&&a.status==='مكتمل').length;
    DB.upd('patients',pat.id,{sessions: Math.max(sesssDone, apptsDone), lastVisit:today, lastDoctor:a.doctor||''});
  }
  // 5. Sync screens
  if(document.getElementById('screen-doctor-view')?.classList.contains('active')) renderDoctorView();
  if(document.getElementById('screen-reception')?.classList.contains('active')) renderReception();
  if(document.getElementById('screen-waitlist')?.classList.contains('active')) renderWaitlist();
  closeModal('consult-done-modal');
  const _toastMsg = _coveredByPkg
    ? `مغطاة بباقة "${_activePkgCheck.name}" 🎁 · عمولة ${comm.toLocaleString()} ج`
    : `فاتورة ${net.toLocaleString()} ج · عمولة ${comm.toLocaleString()} ج`;
  showToast('success',`✅ اكتملت استشارة ${a.patient}`, _toastMsg);
}

// ✅ reception/doctor-view/waitlist في showScreen الموحدة بـ 00-core.js


// ══════════════════════════════════════════════════════════════════
// 🔧 ENHANCEMENTS v2.0 — Services, Packages, Sessions
// ══════════════════════════════════════════════════════════════════

// ── حساب تكلفة مواد الباقة (يجمع تكاليف الخدمات المضمنة × عدد الجلسات) ──
function calcPackageMaterialCost(serviceIds, sessionsCount){
  if(!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) return 0;
  const costPerSession = serviceIds.reduce((sum, sid) => {
    return sum + (typeof calcServiceMaterialCost==='function' ? calcServiceMaterialCost(sid) : 0);
  }, 0);
  return costPerSession * (parseInt(sessionsCount)||1);
}

// ✅ ميزة: تحديد سعر الباقة تلقائياً = مجموع أسعار الخدمات المختارة (من شاشة
// الخدمات والأسعار) × عدد الجلسات. يتحدّث تلقائيًا عند تغيير الخدمات المختارة
// أو عدد الجلسات. الحقل بقى للعرض فقط (readonly)؛ أي تعديل على السعر النهائي
// (خصم، عرض خاص...) يتم عبر حقل "خصم الباقة" الموجود بجانبه.
function _autoCalcPkgPrice(){
  const priceEl = document.getElementById('pkg-price');
  if(!priceEl) return;
  const checked = [...document.querySelectorAll('#pkg-services-checkboxes input[type=checkbox]:checked')];
  const sessCount = parseInt(document.getElementById('pkg-sessions-count')?.value) || 1;
  const svcs = DB.get('services') || [];
  const pricePerSession = checked.reduce((sum, cb) => {
    const svc = svcs.find(s => s.id === cb.value);
    return sum + (svc?.price || 0);
  }, 0);
  priceEl.value = pricePerSession * sessCount;
}

// ── حساب وعرض ربح الباقة في المودال ──
function calcPkgProfitPreview(){
  const price = parseFloat(document.getElementById('pkg-price')?.value) || 0;
  const discount = parseFloat(document.getElementById('pkg-discount')?.value) || 0;
  const sessCount = parseInt(document.getElementById('pkg-sessions-count')?.value) || 1;
  // جمع الخدمات المحددة
  const checked = [...document.querySelectorAll('#pkg-services-checkboxes input[type=checkbox]:checked')];
  const serviceIds = checked.map(cb => cb.value);
  const matCost = calcPackageMaterialCost(serviceIds, sessCount);
  const effectivePrice = price - discount;
  const profit = effectivePrice - matCost;
  const margin = effectivePrice > 0 ? Math.round(profit / effectivePrice * 100) : 0;

  const el = id => document.getElementById(id);
  if(el('pkg-preview-cost')) el('pkg-preview-cost').textContent = matCost.toFixed(1) + ' ج';
  if(el('pkg-preview-price')) el('pkg-preview-price').textContent = effectivePrice.toLocaleString() + ' ج';
  if(el('pkg-preview-profit')){
    el('pkg-preview-profit').textContent = profit.toFixed(1) + ' ج';
    el('pkg-preview-profit').style.color = profit >= 0 ? 'var(--emerald)' : 'var(--rose)';
  }
  if(el('pkg-preview-margin')){
    el('pkg-preview-margin').textContent = margin + '%';
    el('pkg-preview-margin').style.color = margin >= 0 ? 'var(--teal)' : 'var(--rose)';
  }
}

// ── ملء checkboxes الخدمات في مودال الباقة ──
function _fillPkgServicesCheckboxes(selectedIds){
  const container = document.getElementById('pkg-services-checkboxes');
  if(!container) return;
  const svcs = DB.get('services') || [];
  if(!svcs.length){
    container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:6px;">لا توجد خدمات — أضف خدمات أولاً</div>';
    return;
  }
  container.innerHTML = svcs.map(s => {
    const mc = typeof calcServiceMaterialCost==='function' ? calcServiceMaterialCost(s.id) : 0;
    const checked = selectedIds && selectedIds.includes(s.id) ? 'checked' : '';
    return `<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:3px 0;">
      <input type="checkbox" value="${s.id}" ${checked} onchange="_updatePkgServicesHidden();_autoCalcPkgPrice();calcPkgProfitPreview()">
      <span style="font-weight:600">${s.name}</span>
      <span style="color:var(--text-muted);font-size:11px;">${s.cat} · ${(s.price||0).toLocaleString()} ج</span>
      ${mc > 0 ? `<span style="color:var(--rose);font-size:11px;">(تكلفة: ${mc.toFixed(1)} ج)</span>` : ''}
    </label>`;
  }).join('');
}

function _updatePkgServicesHidden(){
  const checked = [...document.querySelectorAll('#pkg-services-checkboxes input[type=checkbox]:checked')];
  const names = checked.map(cb => {
    const svc = DB.get('services').find(s => s.id === cb.value);
    return svc ? svc.name : '';
  }).filter(Boolean);
  const hiddenEl = document.getElementById('pkg-services');
  if(hiddenEl) hiddenEl.value = names.join('، ');
}

// ── مودال الجلسات: عند تغيير الخدمة المختارة ──
function onSessServiceChange(){
  const sel = document.getElementById('sess-service-id');
  const svcId = sel?.value;
  if(!svcId) return;
  const svc = DB.get('services').find(s => s.id === svcId);
  if(!svc) return;
  // تعبئة تلقائية لاسم نوع العلاج من اسم الخدمة
  const typeEl = document.getElementById('sess-type');
  if(typeEl && !typeEl.value) typeEl.value = svc.name;
  // تعبئة السعر من الخدمة لو لم يُدخل
  const priceEl = document.getElementById('sess-price');
  if(priceEl && (!priceEl.value || priceEl.value == '0')) priceEl.value = svc.price || 0;
  calcSessFinancials();
}

// ── حساب ملخص الجلسات المالي ──
function calcSessFinancials(){
  const svcId = document.getElementById('sess-service-id')?.value;
  const sessCount = parseInt(document.getElementById('sess-total-count')?.value) || 1;
  const price = parseFloat(document.getElementById('sess-price')?.value) || 0;
  const matCostPerSess = svcId && typeof calcServiceMaterialCost==='function'
    ? calcServiceMaterialCost(svcId) : 0;
  const totalRevenue = price * sessCount;
  const totalCost = matCostPerSess * sessCount;
  const totalProfit = totalRevenue - totalCost;

  const el = id => document.getElementById(id);
  if(el('sess-prev-cost')) el('sess-prev-cost').textContent = matCostPerSess.toFixed(1) + ' ج';
  if(el('sess-prev-revenue')) el('sess-prev-revenue').textContent = totalRevenue.toLocaleString() + ' ج';
  if(el('sess-prev-profit')){
    el('sess-prev-profit').textContent = totalProfit.toFixed(1) + ' ج';
    el('sess-prev-profit').style.color = totalProfit >= 0 ? 'var(--emerald)' : 'var(--rose)';
  }
}

// ── Override: openPackageModal Enhanced ──
const _openPackageModal_orig = openPackageModal;
openPackageModal = function(id, presetPatId){
  const p = id ? DB.get('packages').find(x => x.id === id) : null;
  const targetPatId = presetPatId || (p?p.patId:null) || window._curPat || null;
  document.getElementById('pkg-modal-title').textContent = p ? '✏️ تعديل الباقة' : '🎁 باقة علاجية جديدة';
  document.getElementById('pkg-id').value = p ? p.id : '';
  const sel = document.getElementById('pkg-pat');
  if(sel) sel.innerHTML = DB.get('patients').map(pt =>
    `<option value="${pt.id}" data-name="${pt.name}"${String(pt.id)===String(targetPatId)?' selected':''}>${pt.name}</option>`
  ).join('');
  // ملء checkboxes الخدمات
  const selectedIds = p ? (p.serviceIds || []) : [];
  _fillPkgServicesCheckboxes(selectedIds);
  if(p){
    document.getElementById('pkg-name').value = p.name||'';
    document.getElementById('pkg-sessions-count').value = p.sessionsCount||6;
    document.getElementById('pkg-price').value = p.price||0;
    document.getElementById('pkg-discount').value = p.discount||0;
    document.getElementById('pkg-paid').value = p.paid||0;
    document.getElementById('pkg-start').value = p.startDate||'';
    document.getElementById('pkg-end').value = p.endDate||'';
    document.getElementById('pkg-status').value = p.status||'نشطة';
    document.getElementById('pkg-notes').value = p.notes||'';
    document.getElementById('pkg-services').value = p.services||'';
  } else {
    ['pkg-name','pkg-notes'].forEach(fid => { const el=document.getElementById(fid); if(el) el.value=''; });
    document.getElementById('pkg-sessions-count').value = 6;
    document.getElementById('pkg-price').value = '';
    document.getElementById('pkg-discount').value = 0;
    document.getElementById('pkg-paid').value = 0;
    document.getElementById('pkg-start').value = new Date().toISOString().split('T')[0];
    document.getElementById('pkg-end').value = '';
    document.getElementById('pkg-status').value = 'نشطة';
    document.getElementById('pkg-services').value = '';
  }
  calcPkgProfitPreview();
  openModal('package-modal');
};

// ── Override: savePackage Enhanced ──
const _savePackage_orig = savePackage;
savePackage = function(){
  const sel = document.getElementById('pkg-pat');
  const opt = sel.options[sel.selectedIndex];
  if(!opt?.value){ showToast('warning','⚠️ اختر عميلاً'); return; }
  const name = gv('pkg-name').trim();
  if(!name){ showToast('warning','⚠️ اسم الباقة مطلوب'); return; }
  const id = gv('pkg-id');
  // جمع الخدمات المحددة من checkboxes
  const checked = [...document.querySelectorAll('#pkg-services-checkboxes input[type=checkbox]:checked')];
  const serviceIds = checked.map(cb => cb.value);
  const sessCount = parseInt(gv('pkg-sessions-count'))||6;
  const price = parseFloat(gv('pkg-price'))||0;
  const discount = parseFloat(gv('pkg-discount'))||0;
  // حساب تكلفة المواد تلقائياً
  const matCost = calcPackageMaterialCost(serviceIds, sessCount);
  const effectivePrice = price - discount;
  const expectedProfit = effectivePrice - matCost;
  const data = {
    patId: opt.value, patName: opt.dataset?.name||opt.text,
    name, services: gv('pkg-services'),
    serviceIds,
    sessionsCount: sessCount,
    sessionsUsed: id ? (DB.get('packages').find(p=>p.id===id)?.sessionsUsed||0) : 0,
    price, discount, effectivePrice,
    paid: parseFloat(gv('pkg-paid'))||0,
    materialCost: matCost,
    expectedProfit,
    startDate: gv('pkg-start'), endDate: gv('pkg-end'),
    status: gv('pkg-status'), notes: gv('pkg-notes')
  };
  if(id){
    const oldPkg = DB.get('packages').find(p=>p.id===id);
    const oldPaid = oldPkg?.paid || 0;
    DB.upd('packages', id, data);
    const paidDelta = Math.max(0, data.paid - oldPaid);
    if(paidDelta > 0){
      DB.push('cashlog',{
        type:'وارد', source:`باقة — ${data.patName}`, refId:id,
        amount:paidDelta, service:data.name, method:'كاش',
        date:new Date().toISOString().split('T')[0],
        notes:`دفعة إضافية على باقة: ${data.name}`
      });
    }
    showToast('success','✅ تم تحديث الباقة');
  } else {
    const newPkg = DB.push('packages', data);
    const remaining = Math.max(0, data.price - data.paid);
    if(remaining > 0){
      DB.push('invoices',{
        patId:data.patId, patientId:data.patId, patient:data.patName,
        service:`باقة: ${data.name}`,
        originalPrice:data.price, discount:discount,
        total:data.effectivePrice, paid:data.paid||0, remaining,
        status:'معلق', method:'كاش',
        date:data.startDate||new Date().toISOString().split('T')[0],
        pkgId:newPkg?.id||null,
        notes:`فاتورة مرتبطة بالباقة — متبقي ${remaining.toLocaleString()} ج`
      });
      const pat = DB.get('patients').find(p=>String(p.id)===String(data.patId));
      if(pat) DB.upd('patients', pat.id, {status:'قسط'});
      showToast('success',`✅ تم إنشاء باقة "${name}" لـ ${data.patName}`,`🧾 متبقي ${remaining.toLocaleString()} ج أُضيف للأقساط`);
    } else {
      DB.push('invoices',{
        patId:data.patId, patientId:data.patId, patient:data.patName,
        service:`باقة: ${data.name}`,
        originalPrice:data.price, discount:discount,
        total:data.effectivePrice, paid:data.effectivePrice, remaining:0,
        status:'مدفوع', method:'كاش',
        date:data.startDate||new Date().toISOString().split('T')[0],
        pkgId:newPkg?.id||null, notes:`فاتورة باقة مدفوعة بالكامل`
      });
      showToast('success',`✅ تم إنشاء باقة "${name}" لـ ${data.patName}`);
    }
  }
  closeModal('package-modal');
  renderPackages();
};

// ── Override: openSessionModal Enhanced ──
const _openSessionModal_orig = openSessionModal;
openSessionModal = function(id){
  const s = id ? DB.get('sessions').find(x => x.id === id) : null;
  document.getElementById('sess-modal-title').textContent = s ? '✏️ تعديل خطة الجلسات' : '✨ خطة جلسات جديدة';
  document.getElementById('sess-id').value = s ? s.id : '';
  // ملء قائمة العملاء
  const sel = document.getElementById('sess-pat');
  sel.innerHTML = DB.get('patients').map(p =>
    `<option value="${p.id}" data-name="${p.name}"${s&&s.patId===p.id?' selected':''}>${p.name}</option>`
  ).join('');
  // ملء قائمة الخدمات
  const svcSel = document.getElementById('sess-service-id');
  if(svcSel){
    svcSel.innerHTML = '<option value="">-- اختر خدمة --</option>' +
      (DB.get('services')||[]).map(sv =>
        `<option value="${sv.id}" data-price="${sv.price||0}"${s&&(s.serviceId===sv.id||s.service===sv.name)?' selected':''}>${sv.name} — ${(sv.price||0).toLocaleString()} ج</option>`
      ).join('');
  }
  // ملء قائمة الأطباء
  const docSel = document.getElementById('sess-doc');
  if(docSel) docSel.innerHTML = DB.get('doctors').map(d =>
    `<option${s&&s.doctor===d.name?' selected':''}>${d.name}</option>`
  ).join('') || '<option>د. منى سامي</option>';

  if(s){
    document.getElementById('sess-type').value = s.type||'';
    document.getElementById('sess-total-count').value = s.total||6;
    document.getElementById('sess-done-count').value = s.done||0;
    document.getElementById('sess-price').value = s.price||0;
    document.getElementById('sess-branch').value = s.branch||'مدينة نصر';
    document.getElementById('sess-start').value = s.startDate||'';
    document.getElementById('sess-status').value = s.status||'جارية';
    document.getElementById('sess-notes').value = s.notes||'';
  } else {
    document.getElementById('sess-type').value = '';
    document.getElementById('sess-total-count').value = 6;
    document.getElementById('sess-done-count').value = 0;
    document.getElementById('sess-price').value = '';
    document.getElementById('sess-start').value = new Date().toISOString().split('T')[0];
    document.getElementById('sess-status').value = 'جارية';
    document.getElementById('sess-notes').value = '';
  }
  calcSessFinancials();
  openModal('session-modal');
};

// ── Override: saveSession Enhanced ──
const _saveSession_orig = saveSession;
saveSession = function(){
  const sel = document.getElementById('sess-pat');
  const opt = sel.options[sel.selectedIndex];
  if(!opt?.value){ showToast('warning','⚠️ اختر عميلاً'); return; }
  const id = gv('sess-id');
  const svcSel = document.getElementById('sess-service-id');
  const svcId = svcSel?.value || null;
  const svc = svcId ? DB.get('services').find(s => s.id === svcId) : null;
  const sessCount = parseInt(gv('sess-total-count'))||6;
  const pricePerSess = parseFloat(gv('sess-price'))||0;
  const matCostPerSess = svcId && typeof calcServiceMaterialCost==='function'
    ? calcServiceMaterialCost(svcId) : 0;
  const data = {
    patId:opt.value, patName:opt.dataset?.name||opt.text,
    serviceId:svcId, service:svc?.name||gv('sess-type'),
    type:gv('sess-type')||svc?.name||'',
    doctor:gv('sess-doc'),
    total:sessCount, done:parseInt(gv('sess-done-count'))||0,
    price:pricePerSess, materialCostPerSession:matCostPerSess,
    totalRevenue:pricePerSess*sessCount,
    totalMaterialCost:matCostPerSess*sessCount,
    expectedProfit:(pricePerSess-matCostPerSess)*sessCount,
    branch:gv('sess-branch'),
    startDate:gv('sess-start'),
    status:gv('sess-status'),
    notes:gv('sess-notes')
  };
  if(id){ DB.upd('sessions',id,data); showToast('success','✅ تم تحديث خطة الجلسات'); }
  else  { DB.push('sessions',data);   showToast('success',`✅ تم إنشاء خطة جلسات لـ ${data.patName}`); }
  closeModal('session-modal');
  renderSessions();
};

// ── Override: addSessionProgress Enhanced — يسجّل تكاليف وإيرادات عند إتمام جلسة ──
const _addSessionProgress_orig = addSessionProgress;
addSessionProgress = function(id){
  const s = DB.get('sessions').find(x => x.id === id); if(!s) return;
  if((s.done||0) >= (s.total||0)){ showToast('warning','⚠️ اكتملت كل الجلسات المقررة'); return; }
  const newDone = (s.done||0) + 1;
  const newStatus = newDone >= s.total ? 'مكتملة' : s.status;
  DB.upd('sessions', id, {done:newDone, status:newStatus});
  // ✅ خصم المخزون بناءً على الخدمة المرتبطة
  const svc = DB.get('services').find(x => x.id === s.serviceId || x.name === s.service);
  if(svc) deductInventory(svc.id, 1);
  // ✅ حساب وتسجيل التكلفة الفعلية للجلسة
  const matCost = svc && typeof calcServiceMaterialCost==='function'
    ? calcServiceMaterialCost(svc.id) : (s.materialCostPerSession||0);
  const revenue = s.price || 0;
  const profit  = revenue - matCost;
  const today   = new Date().toISOString().split('T')[0];
  // تسجيل إيراد الجلسة في cashlog لو لم يكن مرتبطاً بباقة
  const activePkg = getPatientActivePackage(s.patId);
  if(!activePkg && revenue > 0){
    DB.push('cashlog',{
      type:'وارد', source:`جلسة — ${s.patName}`,
      amount:revenue, method:'كاش', date:today,
      notes:`جلسة ${newDone}/${s.total||0}: ${svc?.name||s.service||'—'}`,
      refType:'session', sessionPlanId:id
    });
  }
  // تسجيل تفاصيل الجلسة المكتملة
  DB.push('session_completions',{
    sessionPlanId:id, patId:s.patId, patName:s.patName,
    serviceId:s.serviceId, serviceName:svc?.name||s.service||'—',
    sessionNo:newDone, date:today,
    revenue, materialCost:matCost, profit,
    inventoryDeducted:!!svc
  });
  showToast('success',
    `✅ تم تسجيل الجلسة ${newDone} من ${s.total}`,
    newStatus==='مكتملة'?'🎉 اكتملت خطة الجلسات!':
    `ربح الجلسة: ${profit.toFixed(1)} ج`
  );
  renderSessions();
};


// ── Override: renderPackages Enhanced — adds material cost & profit display ──
const _renderPackages_orig = renderPackages;
renderPackages = function(){
  const grid = document.getElementById('pkg-grid'); if(!grid) return;
  const q = (document.getElementById('pkg-search')?.value||'').toLowerCase();
  const status = document.getElementById('pkg-status-filter')?.value||'';
  let items = DB.get('packages');
  if(q) items = items.filter(p => p.name?.toLowerCase().includes(q) || p.patName?.toLowerCase().includes(q));
  if(status) items = items.filter(p => p.status === status);
  const all = DB.get('packages');
  const active = all.filter(p => p.status==='نشطة');
  const revenue = all.reduce((s,p) => s+(p.paid||0), 0);
  const clients = new Set(all.map(p => p.patId)).size;
  txt('pkg-kpi-total', all.length);
  txt('pkg-kpi-active', active.length);
  txt('pkg-kpi-revenue', revenue.toLocaleString());
  txt('pkg-kpi-clients', clients);
  const SCOL = {نشطة:'sc',منتهية:'sd',معلقة:'sp'};

  grid.innerHTML = items.map(p => {
    const remaining = Math.max(0, (p.price||0)-(p.paid||0));
    const sessUsed = p.sessionsUsed || 0;
    const sessTotal = p.sessionsCount || 0;
    const sessLeft = Math.max(0, sessTotal - sessUsed);
    const sessPct = sessTotal ? Math.round(sessUsed/sessTotal*100) : 0;
    const sessColor = sessLeft===0 ? 'var(--rose)' : sessLeft===1 ? 'var(--gold-light)' : 'var(--emerald)';
    const sessArr = sessTotal > 0 ? Array.from({length:sessTotal},(_,i) =>
      i < sessUsed
        ? `<span style="width:14px;height:14px;border-radius:50%;background:var(--teal);display:inline-block;margin:1px;"></span>`
        : `<span style="width:14px;height:14px;border-radius:50%;background:var(--glass-border);display:inline-block;margin:1px;"></span>`
    ).join('') : '';
    // حساب تكلفة المواد
    let matCost = p.materialCost || 0;
    if(!matCost && p.serviceIds && Array.isArray(p.serviceIds)){
      matCost = calcPackageMaterialCost(p.serviceIds, sessTotal);
    }
    const effectivePrice = p.effectivePrice || ((p.price||0) - (p.discount||0));
    const pkgProfit = effectivePrice - matCost;
    const profitColor = pkgProfit >= 0 ? 'var(--emerald)' : 'var(--rose)';
    return `<div class="bcard">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <div>
          <div style="font-size:15px;font-weight:800;">${p.name||'—'}</div>
          <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">👤 ${p.patName||'—'}</div>
        </div>
        <span class="ast ${SCOL[p.status]||'sd'}">${p.status}</span>
      </div>
      <div class="g2c" style="gap:8px;margin-bottom:11px;">
        <div style="background:var(--glass);border-radius:8px;padding:9px;text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--gold-light)">${(p.price||0).toLocaleString()}</div><div style="font-size:11px;color:var(--text-muted)">السعر (ج)</div></div>
        <div style="background:var(--glass);border-radius:8px;padding:9px;text-align:center;"><div style="font-size:18px;font-weight:800;color:${remaining>0?'var(--rose)':'var(--emerald)'};">${remaining.toLocaleString()}</div><div style="font-size:11px;color:var(--text-muted)">المتبقي (ج)</div></div>
      </div>
      ${matCost > 0 ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        <div style="background:var(--glass);border-radius:8px;padding:7px;text-align:center;">
          <div style="font-size:13px;font-weight:700;color:var(--rose);">${matCost.toFixed(1)} ج</div>
          <div style="font-size:10px;color:var(--text-muted)">تكلفة المواد</div>
        </div>
        <div style="background:var(--glass);border-radius:8px;padding:7px;text-align:center;">
          <div style="font-size:13px;font-weight:700;color:${profitColor};">${pkgProfit.toFixed(1)} ج</div>
          <div style="font-size:10px;color:var(--text-muted)">الربح المتوقع</div>
        </div>
      </div>` : ''}
      <div style="background:var(--glass);border-radius:8px;padding:9px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:700;">🎯 الجلسات</span>
          <span style="font-size:13px;font-weight:800;color:${sessColor}">${sessUsed} / ${sessTotal} <span style="font-size:11px;color:var(--text-muted);">(متبقي: ${sessLeft})</span></span>
        </div>
        <div class="prog"><div class="prog-f" style="width:${sessPct}%;background:${sessColor}"></div></div>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:2px;">${sessArr}</div>
        ${sessLeft===1?`<div style="font-size:11px;color:var(--gold-light);margin-top:4px;font-weight:700;">⚠️ جلسة أخيرة تبقّت!</div>`:''}
        ${sessLeft===0?`<div style="font-size:11px;color:var(--rose);margin-top:4px;font-weight:700;">✅ اكتملت كل الجلسات</div>`:''}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">📅 ${p.startDate||'—'} ← ${p.endDate||'—'}</div>
      ${p.services?`<div style="margin-bottom:8px;font-size:11px;color:var(--teal);">🔗 ${p.services}</div>`:''}
      <div style="display:flex;gap:7px;">
        ${sessLeft>0?`<button class="btn btn-teal btn-sm" style="flex:1" onclick="usePackageSession('${p.id}')">✅ تسجيل جلسة</button>`:''}
        <button class="btn btn-ghost btn-sm" ${sessLeft>0?'':'style="flex:1"'} onclick="openPackageModal('${p.id}')">✏️ تعديل</button>
        <button class="btn btn-danger btn-sm" onclick="delPackage('${p.id}')">🗑 حذف</button>
      </div>
    </div>`;
  }).join('') || '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted);grid-column:1/-1;">لا توجد باقات مطابقة</div>';
};


// ══════════════════════════════════════════════════════════════════════════════
// 📢 CALL SYSTEM — نظام الاستدعاء والتنبيهات
// الطبيب يستدعي العميل → تنبيه فوري في شاشة الاستقبال
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. تشغيل صوت التنبيه ──
function playCallSound(){
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // ✅ FIX: لو الـ AudioContext اتعمل suspended (سياسة الـ autoplay في المتصفح
    // قبل أي تفاعل مباشر من المستخدم)، لازم نعمل resume() وإلا الصوت مش هيتسمع خالص
    if(audioContext.state === 'suspended'){ audioContext.resume().catch(()=>{}); }

    const now = audioContext.currentTime;

    // ✅ FIX: كل beep لازم يكون على oscillator منفصل — الـ Web Audio API
    // بيمنع استدعاء start() أكتر من مرة على نفس الـ oscillator (بيرمي
    // InvalidStateError من ثاني استدعاء)، فكان عمليًا بيطلع بيب واحد قصير
    // بس من أصل 3، وأحيانًا حتى ده مش واضح.
    const beepTimes = [now, now + 0.25, now + 0.5];
    beepTimes.forEach(t => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.3, t);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  } catch(e) {
    console.warn('صوت التنبيه لم يشتغل:', e);
  }
}

// ── 2. زر الاستدعاء في شاشة الطبيب ──
function callPatient(){
  const apptId = document.getElementById('dv-appt-id')?.value;
  if(!apptId) { showToast('warning', '⚠️ لا توجد استشارة مفتوحة'); return; }
  
  const appt = DB.get('appointments').find(a => a.id === apptId);
  if(!appt) { showToast('error', '❌ لم يتم العثور على الموعد'); return; }
  
  const doctorName = document.getElementById('dv-doctor-name')?.value || '؟؟';
  if(!doctorName || doctorName === '؟؟') { showToast('warning', '⚠️ تسجيل الطبيب غير واضح'); return; }
  
  // ✅ إنشاء استدعاء جديد
  const call = {
    id: genUUID(),
    apptId: appt.id,
    patientId: appt.patId,
    patientName: appt.patient,
    doctor: doctorName,
    time: _nowTimeStr(),
    timestamp: new Date().toISOString(),
    status: 'active'  // active / seen / canceled
  };
  
  // حفظ الاستدعاء في DB
  if(!DB.get('call_queue')) DB.set('call_queue', []);
  DB.push('call_queue', call);
  
  // تحديث حالة الموعد
  DB.upd('appointments', apptId, { status: 'في الاستشارة' });
  
  showToast('success', `📢 تم استدعاء ${appt.patient}`, 'سيتم إخطار الاستقبال فوراً');
  
  // 🔄 تحديث جميع الشاشات النشطة (مزامنة حية بين المستخدمين)
  // هذا سيحدث عند المستخدم الحالي، والمستخدمين الآخرين سيرون التحديث عبر polling
  setTimeout(() => {
    if(document.getElementById('screen-reception')?.classList.contains('active')){
      renderReception();
    }
  }, 100);
}

// ── 3. معالجة الاستدعاء (دخول أو إلغاء) ──
function processCall(callId, entered){
  const call = (DB.get('call_queue') || []).find(c => c.id === callId);
  if(!call) return;
  
  const appt = DB.get('appointments').find(a => a.id === call.apptId);
  if(!appt) return;
  
  if(entered){
    // ✅ العميل دخل
    DB.upd('call_queue', callId, { status: 'seen' });
    DB.upd('appointments', call.apptId, { 
      status: 'في الاستشارة',
      checkInTime: _nowTimeStr()
    });
    showToast('success', `✓ ${appt.patient} دخل الاستشارة`);
  } else {
    // ❌ إلغاء الاستدعاء
    DB.upd('call_queue', callId, { status: 'canceled' });
    showToast('info', `الاستدعاء ملغى`);
  }
  
  // تحديث شاشة الاستقبال فوراً
  setTimeout(() => renderReception(), 300);
}

// ── 4. تحديث renderReception لعرض التنبيهات ──
// (هذا يتم دمجه مع الدالة الموجودة)

// ── 5. إضافة CSS للرسالة المتحركة ──
if(!document.getElementById('call-alert-styles')){
  const style = document.createElement('style');
  style.id = 'call-alert-styles';
  style.innerHTML = `
    @keyframes pulse-call {
      0%, 100% { box-shadow: 0 0 20px rgba(255, 23, 68, 0.4), 0 0 40px rgba(255, 107, 107, 0.2); }
      50% { box-shadow: 0 0 30px rgba(255, 23, 68, 0.6), 0 0 60px rgba(255, 107, 107, 0.4); }
    }
    .call-alert {
      animation: pulse-call 1s infinite;
    }
  `;
  document.head.appendChild(style);
}

// ── 6. EventBus للتحديثات الفورية ──
EventBus.on('call_queue:created', function(){
  if(document.getElementById('screen-reception')?.classList.contains('active')){
    renderReception();
  }
});

EventBus.on('call_queue:updated', function(){
  if(document.getElementById('screen-reception')?.classList.contains('active')){
    renderReception();
  }
});

// ── 8. Modal لاختيار الموعد (الزر البرتقالي الرئيسي) ──
function openCallPatientModal(){
  const today = new Date().toISOString().split('T')[0];
  let appts = DB.get('appointments').filter(a => a.date === today && a.status !== 'ملغي' && a.status !== 'مكتمل');
  
  // ترتيب: الأولويات الأولى
  const PRIO = {'في الاستشارة':0,'وصل':1,'متأخر':2,'انتظار':3,'قادم':4,'مؤكد':5};
  appts.sort((a,b) => {
    const pa = PRIO[a.status] ?? 8;
    const pb = PRIO[b.status] ?? 8;
    if(pa !== pb) return pa - pb;
    return _timeToMin(a.time || '00:00') - _timeToMin(b.time || '00:00');
  });
  
  if(appts.length === 0) {
    showToast('info', '⏰ لا توجد مواعيد متاحة اليوم');
    return;
  }
  
  // عرض قائمة المواعيد في الـ modal
  const listHTML = appts.map(a => `
    <div style="padding:12px;background:var(--glass);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div style="flex:1;">
        <div style="font-weight:600;color:var(--text);">${a.patient}</div>
        <div style="font-size:12px;color:var(--text-muted);">د. ${a.doctor} · ${a.service || '—'}</div>
        <div style="font-size:11px;color:var(--amber);margin-top:4px;">⏰ ${a.time} · ${a.status}</div>
      </div>
      <button onclick="quickCallPatient('${a.id}')" style="
        padding:8px 16px;
        background:linear-gradient(135deg,var(--emerald),#047857);
        color:white;
        border:none;
        border-radius:8px;
        cursor:pointer;
        font-weight:600;
        font-size:13px;
        white-space:nowrap;
      ">📢 استدعاء</button>
    </div>
  `).join('');
  
  document.getElementById('call-patient-list').innerHTML = listHTML;
  document.getElementById('modal-call-patient').style.display = 'flex';
}

// ── 9. استدعاء سريع من الـ modal ──
function quickCallPatient(apptId){
  const appt = DB.get('appointments').find(a => a.id === apptId);
  if(!appt) { showToast('error', '❌ لم يتم العثور على الموعد'); return; }
  
  // استدعاء wlCallPatient للعملية الصحيحة
  wlCallPatient(apptId);
  
  // إغلاق الـ modal
  document.getElementById('modal-call-patient').style.display = 'none';
  
  showToast('success', `📢 تم استدعاء ${appt.patient}`);
}
let _lastCallQueueHash = '';
function _setupCallQueueListener(){
  if(window._callQueueListenerActive) return;
  window._callQueueListenerActive = true;
  
  // polling: مراقبة call_queue كل ثانية للتحديثات الحية من مستخدمين آخرين
  window._callQueuePoller = setInterval(() => {
    const receptionScreen = document.getElementById('screen-reception');
    if(!receptionScreen?.classList.contains('active')) return;
    
    try {
      const calls = DB.get('call_queue') || [];
      const activeCalls = calls.filter(c => c.status === 'active');
      const callQueueHash = JSON.stringify(activeCalls);
      
      // إذا تغير عدد الاستدعاءات النشطة أو محتواها، قم بتحديث الشاشة
      if(callQueueHash !== _lastCallQueueHash) {
        _lastCallQueueHash = callQueueHash;
        renderReception(); // تحديث فوري عند وصول استدعاء جديد
      }
    } catch(e) {
      console.warn('⚠️ [Call Queue Polling] خطأ:', e.message);
    }
  }, 1000); // كل ثانية
  
  console.log('✅ [Call Queue Listener] تم تفعيل مراقبة الاستدعاءات الحية');

  // ✅ إعادة تشغيل صوت التنبيه كل 15 ثانية طالما فيه استدعاء نشط لم يُعالَج بعد
  // (قبل هذا الإصلاح كان الصوت يُشغَّل مرة واحدة فقط عند renderReception الأول
  // للاستدعاء، فلو انشغل الاستقبال ولم يلاحظه، ما كان فيه أي تنبيه صوتي لاحق)
  if(!window._callSoundRepeater){
    window._callSoundRepeater = setInterval(() => {
      const receptionScreen = document.getElementById('screen-reception');
      if(!receptionScreen?.classList.contains('active')) return;
      try {
        const activeCalls = (DB.get('call_queue') || []).filter(c => c.status === 'active');
        if(activeCalls.length > 0) playCallSound();
      } catch(e) {
        console.warn('⚠️ [Call Sound Repeater] خطأ:', e.message);
      }
    }, 15000); // كل 15 ثانية
    console.log('✅ [Call Sound Repeater] تكرار صوت التنبيه كل 15 ثانية مُفعّل');
  }
}

// تشغيل listener عند تحميل الصفحة أو عند الانتقال لـ reception screen
EventBus.on('screen:changed', function(e) {
  if(e.id === 'reception' && !window._callQueueListenerActive) {
    _setupCallQueueListener();
  }
});

// تشغيل أولي
setTimeout(() => _setupCallQueueListener(), 1000);

console.log('✅ [Call System] نظام الاستدعاء جاهز');
