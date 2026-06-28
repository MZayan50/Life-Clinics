// ══════════════════════════════════════════════════════════════════
// 📅 APPOINTMENTS MODULE — v4.0 (Event-Driven)
// ══════════════════════════════════════════════════════════════════
// التغييرات من v3 → v4:
//  1. EventBus listeners لتحديث الواجهة تلقائياً
//  2. updAppt / delAppt / saveAppt — حُذفت جميع استدعاءات render اليدوية
// ══════════════════════════════════════════════════════════════════

// ── ربط EventBus ──
EventBus.on('appointments:created', _onApptsChanged);
EventBus.on('appointments:updated', _onApptsChanged);
EventBus.on('appointments:deleted', _onApptsChanged);

function _onApptsChanged(){
  if(window.renderAppts)      renderAppts();
  if(window.renderTodayAppts) renderTodayAppts();
  if(window.buildCal)         buildCal();
  if(window.renderReception)  renderReception();
  if(window.renderDoctorView) renderDoctorView();
  if(window.renderWaitlist)   renderWaitlist();
}

let _af='', _as='', _ad='';
function filterAppts(q){ _af=q; renderAppts(); }
function filterApptSt(s){ _as=s; renderAppts(); }
function filterApptDate(d){ _ad=d; renderAppts(); }

const ASC = {
  'مؤكد':'sc', 'قادم':'s-upcoming', 'انتظار':'sp', 'وصل':'s-checkin',
  'في الاستشارة':'s-consult', 'مكتمل':'sd', 'ملغي':'sx',
  'متأخر':'s-late', 'لم يحضر':'s-noshow', 'محول':'s-rescheduled', 'في العيادة':'sw'
};

function renderAppts(){
  const appts = DB.get('appointments').filter(a =>
    (!_af || (a.patient||'').includes(_af)) &&
    (!_as || a.status===_as) &&
    (!_ad || a.date===_ad)
  );
  const tb = document.getElementById('appts-tbody'); if(!tb) return;
  tb.innerHTML = appts.map(a => `<tr>
    <td style="font-weight:600">${_patName(a.patId)||a.patient}</td>
    <td style="font-size:12px">${a.date}</td>
    <td style="font-weight:700;color:var(--teal)">${a.time}${a.endTime?` <span style="color:var(--text-muted);font-weight:400;font-size:11px">- ${a.endTime}</span>`:''}</td>
    <td>${a.service}</td>
    <td>${a.doctor||'—'}</td>
    <td style="font-size:12px">${a.branch||'—'}</td>
    <td><span class="ast ${ASC[a.status]||'sd'}">${a.status}</span></td>
    <td style="display:flex;gap:5px;white-space:nowrap;">
      <button class="btn btn-ghost btn-xs" onclick="openApptModal('${a.id}')">✏️</button>
      <button class="btn btn-ghost btn-xs" onclick="updAppt('${a.id}','مكتمل')">✅</button>
      <button class="btn btn-teal btn-xs" onclick="sendApptWA('${a.id}')" title="إرسال الموعد عبر واتساب">💬</button>
      <button class="btn btn-danger btn-xs" onclick="delAppt('${a.id}')">🗑</button>
    </td>
  </tr>`).join('');
  renderTodayAppts();
}

function updAppt(id, st){
  DB.upd('appointments', id, {status: st});
  // لا داعي لاستدعاءات render — EventBus يتولى ذلك
  showToast('success','✅ تم تحديث حالة الموعد');
}

function delAppt(id){
  if(confirm('حذف الموعد؟')){
    DB.del('appointments', id);
    // لا داعي لاستدعاءات render — EventBus يتولى ذلك
  }
}

function sendApptWA(id){
  const appt = DB.get('appointments').find(x => String(x.id)===String(id));
  if(!appt){ showToast('error','❌ الموعد غير موجود'); return; }
  const pat   = DB.get('patients').find(p => String(p.id)===String(appt.patId)) || DB.get('patients').find(p => p.name===appt.patient);
  const phone = getWAPhone(pat||{phone:appt.patPhone||''});
  if(!phone){ showToast('error','❌ لا يوجد رقم واتساب لهذا العميل'); return; }
  const clinicName = DB.obj('settings').clinicName || 'عيادات الحياة للتجميل';
  const msg = `مرحباً ${appt.patient} 😊\nنذكرك بموعدك في ${clinicName}\n📅 التاريخ: ${appt.date}\n⏰ الوقت: ${appt.time}\n💆 الخدمة: ${appt.service||'—'}${appt.doctor?`\n👨‍⚕️ الطبيب: ${appt.doctor}`:''}${appt.branch?`\n🏢 الفرع: ${appt.branch}`:''}\n\nنتطلع لرؤيتك 💎`;
  window.open(`https://wa.me/${phone.replace('+','')}?text=${encodeURIComponent(msg)}`,'_blank');
  showToast('success', `✅ فُتح واتساب لإرسال الموعد لـ ${appt.patient}`);
}

function openApptModal(id){
  const a = id ? DB.get('appointments').find(x => x.id===id) : null;
  document.getElementById('appt-modal-title').textContent = a ? '✏️ تعديل موعد' : '📅 موعد جديد';
  clearApptConflictBox();
  document.getElementById('am-id').value = a ? a.id : '';
  fillPatDropdowns();
  fillSvcDropdowns();
  if(a){
    document.getElementById('am-pat').value    = a.patId||'';
    document.getElementById('am-type').value   = a.type||'كشف';
    document.getElementById('am-doc').value    = a.doctor||'';
    document.getElementById('am-date').value   = a.date||'';
    document.getElementById('am-time').value   = a.time||'';
    document.getElementById('am-svc').value    = a.service||'';
    fillApptRoomDropdown(a.service||'');
    document.getElementById('am-room').value   = a.room||'';
    document.getElementById('am-branch').value = a.branch||'';
    const notesEl = document.getElementById('am-notes'); if(notesEl) notesEl.value = a.notes||'';
  } else {
    document.getElementById('am-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('am-time').value = '10:00';
    fillApptRoomDropdown(gv('am-svc'));
    const notesEl = document.getElementById('am-notes'); if(notesEl) notesEl.value = '';
    document.getElementById('am-id').value = '';
  }
  openModal('appt-modal');
}

function saveAppt(){
  const pid=gv('am-pat'), date=gv('am-date'), time=gv('am-time');
  if(!pid||!date||!time){ showToast('warning','⚠️ اختر العميل والتاريخ والوقت'); return; }
  const pat      = DB.get('patients').find(p => String(p.id)===String(pid));
  const id       = gv('am-id');
  const svcName  = gv('am-svc');
  const svc      = DB.get('services').find(s => s.name===svcName);
  const duration = svc ? (svc.duration||60) : 60;
  const endTime  = addMinutesToTime(time, duration);
  const doctor   = gv('am-doc');
  // استخراج doctorId من الـ select
  const amDocSel = document.getElementById('am-doc');
  const doctorId = amDocSel?.options[amDocSel?.selectedIndex]?.dataset?.id || DB.get('doctors').find(d=>d.name===doctor)?.id || '';
  const room     = gv('am-room') || svc?.room || '';
  const equipment = svc?.equipment || '';
  const conflict = checkApptConflict({doctor, date, time, duration, room, equipment, excludeId: id});
  if(!conflict.ok){
    const suggestions = suggestApptSlots({doctor, date, duration, room, equipment, excludeId: id});
    renderApptConflictBox(conflict.reasons, suggestions);
    showToast('warning','⚠️ تعارض في الموعد — راجع التفاصيل');
    return;
  }
  clearApptConflictBox();
  const data = { patId:pid, patient:pat?.name||pid, service:svcName, type:gv('am-type'),
                 doctor, doctorId, date, time, endTime, duration, room, equipment,
                 branch:gv('am-branch'), notes:gv('am-notes') };
  if(id){
    DB.upd('appointments', id, data);
    showToast('success','✅ تم تحديث الموعد');
  } else {
    DB.push('appointments', {...data, status:'مؤكد'});
    showToast('success','📅 تم حجز الموعد بنجاح', `${pat?.name} - ${date} ${time}`);
  }
  // لا داعي لاستدعاءات render — EventBus يتولى ذلك
  closeModal('appt-modal');
  const e = document.getElementById('am-notes'); if(e) e.value='';
}

function addMinutesToTime(time, mins){
  const [h,m] = (time||'00:00').split(':').map(Number);
  const total  = h*60 + m + (mins||0);
  const hh = String(Math.floor((total%1440)/60)).padStart(2,'0');
  const mm = String(total%60).padStart(2,'0');
  return `${hh}:${mm}`;
}
function _timeToMin(t){ const [h,m]=(t||'00:00').split(':').map(Number); return h*60+(m||0); }
function _rangesOverlap(s1,e1,s2,e2){ return s1<e2 && s2<e1; }
const AR_WEEKDAYS = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

function checkApptConflict({doctor,date,time,duration,room,equipment,excludeId}){
  const reasons = [];
  const start = _timeToMin(time), end = start+(duration||60);
  const docInfo = DB.get('doctors').find(d => d.name===doctor);
  if(docInfo){
    if(docInfo.workStart && start<_timeToMin(docInfo.workStart)) reasons.push(`الوقت قبل بداية دوام ${doctor} (${docInfo.workStart})`);
    if(docInfo.workEnd   && end>_timeToMin(docInfo.workEnd))     reasons.push(`الوقت بعد نهاية دوام ${doctor} (${docInfo.workEnd})`);
    const dow = AR_WEEKDAYS[new Date(date+'T00:00:00').getDay()];
    if(docInfo.offDay && docInfo.offDay===dow) reasons.push(`${doctor} في إجازته الأسبوعية (${dow})`);
    const leaves = (docInfo.leaveDates||'').split(',').map(s=>s.trim()).filter(Boolean);
    if(leaves.includes(date)) reasons.push(`${doctor} في إجازة بتاريخ ${date}`);
  }
  const others = DB.get('appointments').filter(a => a.date===date && a.status!=='ملغي' && String(a.id)!==String(excludeId));
  for(const a of others){
    const aStart=_timeToMin(a.time), aEnd=_timeToMin(a.endTime)||aStart+(a.duration||60);
    if(!_rangesOverlap(start,end,aStart,aEnd)) continue;
    if(doctor    && a.doctor===doctor)       reasons.push(`الطبيب ${doctor} محجوز بموعد آخر (${a.patient} - ${a.time})`);
    if(room      && a.room===room)           reasons.push(`الغرفة "${room}" محجوزة في نفس الوقت (${a.patient} - ${a.time})`);
    if(equipment && a.equipment===equipment) reasons.push(`الجهاز "${equipment}" محجوز في نفس الوقت (${a.patient} - ${a.time})`);
  }
  return reasons.length ? {ok:false, reasons:[...new Set(reasons)]} : {ok:true};
}

function suggestApptSlots({doctor,date,duration,room,equipment,excludeId}, count=3){
  const docInfo  = DB.get('doctors').find(d => d.name===doctor);
  const dayStart = docInfo?.workStart ? _timeToMin(docInfo.workStart) : 540;
  const dayEnd   = docInfo?.workEnd   ? _timeToMin(docInfo.workEnd)   : 1080;
  const found = [];
  for(let t=dayStart; t+(duration||60)<=dayEnd; t+=15){
    const hh=String(Math.floor(t/60)).padStart(2,'0'), mm=String(t%60).padStart(2,'0');
    const timeStr = `${hh}:${mm}`;
    const res = checkApptConflict({doctor,date,time:timeStr,duration,room,equipment,excludeId});
    if(res.ok){ found.push(timeStr); if(found.length>=count) break; }
  }
  return found;
}

function clearApptConflictBox(){
  const box = document.getElementById('am-conflict-box');
  if(box){ box.style.display='none'; box.innerHTML=''; }
}
function renderApptConflictBox(reasons, suggestions){
  const box = document.getElementById('am-conflict-box'); if(!box) return;
  box.style.display = 'block';
  let html = `<div style="font-weight:700;margin-bottom:4px;">⚠️ في تعارض بالموعد:</div><ul style="margin:0;padding-right:18px;">${reasons.map(r=>`<li>${r}</li>`).join('')}</ul>`;
  if(suggestions && suggestions.length){
    html += `<div style="margin-top:8px;font-weight:700;color:var(--text-primary);">أقرب أوقات متاحة:</div><div style="display:flex;gap:6px;margin-top:5px;flex-wrap:wrap;">${suggestions.map(s=>`<button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('am-time').value='${s}';clearApptConflictBox();">${s}</button>`).join('')}</div>`;
  } else {
    html += `<div style="margin-top:8px;">لا يوجد وقت متاح آخر لنفس اليوم — جرّب يوم آخر.</div>`;
  }
  box.innerHTML = html;
}

function renderTodayAppts(){
  const today = new Date().toISOString().split('T')[0];
  const ta    = DB.get('appointments').filter(a => a.date===today);
  const el    = document.getElementById('today-appts'); if(!el) return;
  el.innerHTML = ta.slice(0,5).map((a,i) => `<div class="appt-item">
    <div class="appt-time">${a.time}</div>
    <div class="appt-ava" style="background:${AVA[i%AVA.length]}">${genderAva(_patGender(a.patId,a.patient))}</div>
    <div class="appt-info"><p>${_patName(a.patId)||a.patient}</p><span>${a.service}</span></div>
    <span class="ast ${ASC[a.status]||'sd'}">${a.status}</span>
  </div>`).join('') || '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">لا توجد مواعيد اليوم</div>';
  txt('kpi-appt', ta.length);
  txt('badge-appts', ta.length);
}

// ══════════════════════════════════════════
// 📆 CALENDAR
// ══════════════════════════════════════════
let _cy=new Date().getFullYear(), _cm=new Date().getMonth();
const MN = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function buildCal(){
  const grid=document.getElementById('cal-grid'), mn=document.getElementById('cal-mn'); if(!grid) return;
  if(mn) mn.textContent = `${MN[_cm]} ${_cy}`;
  const DAYS = ['أح','إث','ثل','أر','خم','جم','سب'];
  let html = DAYS.map(d => `<div class="cal-dh">${d}</div>`).join('');
  const fd=new Date(_cy,_cm,1).getDay(), dim=new Date(_cy,_cm+1,0).getDate(), pd=new Date(_cy,_cm,0).getDate();
  const today=new Date(), tY=today.getFullYear(), tM=today.getMonth(), tD=today.getDate();
  const appts = DB.get('appointments');
  for(let i=fd-1; i>=0; i--) html+=`<div class="cal-d other">${pd-i}</div>`;
  for(let d=1; d<=dim; d++){
    const ds = `${_cy}-${String(_cm+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hasEv = appts.some(a => a.date===ds);
    const isT   = _cy===tY && _cm===tM && d===tD;
    html += `<div class="cal-d${isT?' today':''} ${hasEv?'has-ev':''}" onclick="calSel(this,'${ds}')">${d}</div>`;
  }
  let nx=1; while((fd+dim+nx-1)%7!==0) html+=`<div class="cal-d other">${nx++}</div>`;
  grid.innerHTML = html;
  calSel(null, new Date().toISOString().split('T')[0]);
}

function calSel(el, ds){
  document.querySelectorAll('.cal-d').forEach(x => x.classList.remove('selected'));
  if(el) el.classList.add('selected');
  const lbl = document.getElementById('cal-sel-date'); if(lbl) lbl.textContent=ds;
  const da  = DB.get('appointments').filter(a => a.date===ds);
  const el2 = document.getElementById('cal-day-appts');
  if(el2) el2.innerHTML = da.map(a => `<div class="appt-item">
    <div class="appt-time">${a.time}</div>
    <div class="appt-ava" style="background:linear-gradient(135deg,#8B5CF6,#3B82F6);font-size:13px">${genderAva(_patGender(a.patId,a.patient))}</div>
    <div class="appt-info"><p style="font-size:12.5px">${_patName(a.patId)||a.patient}</p><span style="font-size:11px">${a.service}</span></div>
    <span class="ast ${ASC[a.status]||'sd'}" style="font-size:10px">${a.status}</span>
  </div>`).join('') || '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:12.5px">لا توجد مواعيد</div>';
}

document.getElementById('cal-prev')?.addEventListener('click', () => { _cm--; if(_cm<0){_cm=11;_cy--;} buildCal(); });
document.getElementById('cal-next')?.addEventListener('click', () => { _cm++; if(_cm>11){_cm=0;_cy++;} buildCal(); });
