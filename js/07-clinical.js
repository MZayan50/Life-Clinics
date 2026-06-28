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
  const now=new Date();
  const t=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  DB.upd('appointments',id,{status:'في الاستشارة',consultStart:t});
  showToast('info','💬 بدأت الاستشارة',`الوقت: ${t}`);
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
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">🎯 ${p.sessionsCount||0} جلسة · 📅 ${p.startDate||'—'} ← ${p.endDate||'—'}</div>
      ${p.services?`<div style="margin-bottom:8px;"><span class="tag tg-gold" style="font-size:11px;">${p.services}</span></div>`:''}
      <div style="display:flex;gap:7px;">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="openPackageModal('${p.id}')">✏️ تعديل</button>
        <button class="btn btn-danger btn-sm" onclick="delPackage('${p.id}')">🗑 حذف</button>
      </div>
    </div>`;
  }).join('')||'<div class="card" style="text-align:center;padding:40px;color:var(--text-muted);grid-column:1/-1;">لا توجد باقات مطابقة</div>';
}
function openPackageModal(id){
  const p=id?DB.get('packages').find(x=>x.id===id):null;
  document.getElementById('pkg-modal-title').textContent=p?'✏️ تعديل الباقة':'🎁 باقة علاجية جديدة';
  document.getElementById('pkg-id').value=p?p.id:'';
  const sel=document.getElementById('pkg-pat');
  sel.innerHTML=DB.get('patients').map(pt=>`<option value="${pt.id}" data-name="${pt.name}"${p&&p.patId===pt.id?' selected':''}>${pt.name}</option>`).join('');
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
    ['pkg-name','pkg-services','pkg-notes'].forEach(id=>document.getElementById(id).value='');
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
  const data={patId:opt.value,patName:opt.dataset?.name||opt.text,name,services:gv('pkg-services'),sessionsCount:parseInt(gv('pkg-sessions-count'))||6,price:parseFloat(gv('pkg-price'))||0,paid:parseFloat(gv('pkg-paid'))||0,startDate:gv('pkg-start'),endDate:gv('pkg-end'),status:gv('pkg-status'),notes:gv('pkg-notes')};
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
    showToast('success','✅ تم تحديث الباقة');
  } else {
    const newPkg = DB.push('packages',data);
    // ✅ BUG#3 FIX: تسجيل الدفعة الأولى في الخزينة عند إنشاء الباقة
    if(data.paid > 0){
      DB.push('cashlog',{
        type:'وارد', source:`باقة — ${data.patName}`, refId:newPkg?.id||null,
        amount:data.paid, service:data.name, method:'كاش',
        date:data.startDate||new Date().toISOString().split('T')[0],
        notes:`دفعة باقة: ${data.name}`
      });
    }
    showToast('success',`✅ تم إنشاء باقة "${name}" لـ ${data.patName}`);
  }
  closeModal('package-modal');renderPackages();
}
function delPackage(id){
  const p=DB.get('packages').find(x=>x.id===id);
  if(confirm(`حذف باقة "${p?.name||''}"؟`)){DB.del('packages',id);showToast('info','🗑 تم الحذف');renderPackages();}
}

// ─── PHASE 3: Reception & Doctor Screens + Consultation Engine ───────────────

function renderReception(){
  const today=new Date().toISOString().split('T')[0];
  const now=new Date();
  const dlbl=document.getElementById('rec-date-lbl');
  if(dlbl) dlbl.textContent=now.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const docSel=document.getElementById('rec-doc-filter');
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
  if(docSel && docSel.options.length<=1){
    DB.get('doctors').forEach(d=>{const o=document.createElement('option');o.value=d.name;o.textContent=d.name;docSel.appendChild(o);});
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
  const todayRev=todayInvs.reduce((s,i)=>s+(i.paid||0),0);
  const comm=Math.round(todayRev*(docInfo?.commission||0)/100);
  txt('dv-kpi-today',appts.length);txt('dv-kpi-waiting',waiting);txt('dv-kpi-done',done);
  txt('dv-kpi-comm',comm.toLocaleString());txt('dv-count-lbl',appts.length+' مريض');
  const AVA_C=['linear-gradient(135deg,#C4A882,#9A7050)','linear-gradient(135deg,#2DD4BF,#14B8A6)','linear-gradient(135deg,#8B5CF6,#6D28D9)','linear-gradient(135deg,#F43F5E,#BE123C)','linear-gradient(135deg,#10B981,#047857)'];
  if(!appts.length){container.innerHTML=`<div style="text-align:center;padding:40px;color:var(--text-muted)">لا توجد مرضى لـ ${docName} اليوم ✨</div>`;return;}
  const nowMin=new Date().getHours()*60+new Date().getMinutes();
  container.innerHTML=appts.map((a,i)=>{
    const stCls=ASC[a.status]||'sd';
    const canCall=['وصل','انتظار','متأخر'].includes(a.status);
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
        ${canCall?`<button class="btn btn-primary btn-sm" onclick="wlCallPatient('${a.id}');renderDoctorView()">📢 استدعاء</button>`:''}
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
  const comm=Math.round(net*(doc?.commission||0)/100);
  const netEl=document.getElementById('cd-net');
  const commEl=document.getElementById('cd-comm-display');
  if(netEl)netEl.textContent=net.toLocaleString()+' ج';
  if(commEl)commEl.textContent=comm.toLocaleString()+' ج ('+(doc?.commission||0)+'%)';
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
  const comm=Math.round(net*(doc?.commission||0)/100);
  const startMin=a.consultStart?_timeToMin(a.consultStart):_timeToMin(a.time);
  const durMin=Math.max(0,_timeToMin(now)-startMin);
  // 1. Complete appointment
  DB.upd('appointments',apptId,{status:'مكتمل',consultEnd:now,consultDuration:durMin,consultNotes:notes});
  // 2. Auto-generate invoice
  DB.push('invoices',{
    patient:a.patient,patId:a.patId,doctor:a.doctor||'',service:svcName,
    date:today,originalPrice:price,discount:disc,total:net,paid:net,remaining:0,
    status:'مدفوع',method,fromAppt:apptId,commission:comm,commissionPct:doc?.commission||0,branch:a.branch||''
  });
  // 3. Deduct inventory — نبحث عن serviceId من جدول services بالاسم أو من الموعد مباشرةً
  const svcRecord = DB.get('services').find(s => s.name === svcName) || DB.get('services').find(s => s.id === a.serviceId);
  deductInventory(svcRecord?.id || a.serviceId, 1);
  // 4. تحديث ملف العميل — ✅ spent يُحدَّث تلقائيًا عبر EventBus('invoices:created') في 00-core.js
  // sessions: نحسب من الـ sessions collection + عدد الاستشارات المكتملة من appointments
  // بدل +1 اليدوية لتجنب التعارض مع sessions:updated hook في 00-core.js
  if(pat){
    const sesssDone = DB.get('sessions').filter(s=>s.patId===pat.id).reduce((s,x)=>s+(x.done||0),0);
    const apptsDone = DB.get('appointments').filter(a=>a.patId===pat.id&&a.status==='مكتمل').length;
    DB.upd('patients',pat.id,{sessions: Math.max(sesssDone, apptsDone), lastVisit:today, lastDoctor:a.doctor||''});
  }
  // 5. ✅ Sync screens — EventBus يتولى renderInvs وتحديث KPIs تلقائياً
  // نُحدِّث فقط شاشات الاستقبال/الطبيب/الانتظار التي لا تغطيها آلية _flushUIRefresh
  if(document.getElementById('screen-doctor-view')?.classList.contains('active')) renderDoctorView();
  if(document.getElementById('screen-reception')?.classList.contains('active')) renderReception();
  if(document.getElementById('screen-waitlist')?.classList.contains('active')) renderWaitlist();
  closeModal('consult-done-modal');
  showToast('success',`✅ اكتملت استشارة ${a.patient}`,`فاتورة ${net.toLocaleString()} ج · عمولة ${comm.toLocaleString()} ج`);
}

// ✅ reception/doctor-view/waitlist في showScreen الموحدة بـ 00-core.js

