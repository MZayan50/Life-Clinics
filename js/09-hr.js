// ══════════════════════════════════════════════════════════════════
// 👥 HR MODULE — v4.0  (Event-Driven)
// Doctors · Staff · Services
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
// 📡 EventBus Listeners — تحديث تلقائي بدون استدعاءات يدوية
// ══════════════════════════════════════════
(function _hrListeners(){

  // Doctors: أي تغيير → تحديث شبكة الأطباء + الـ dropdowns
  EventBus.on('doctors:created', () => renderDocs());
  EventBus.on('doctors:updated', () => renderDocs());
  EventBus.on('doctors:deleted', () => renderDocs());

  // Appointments: تؤثر على إحصائيات الأطباء (مواعيد اليوم / الإيرادات)
  EventBus.on('appointments:created', () => renderDocs());
  EventBus.on('appointments:updated', () => renderDocs());
  EventBus.on('appointments:deleted', () => renderDocs());

  // Invoices: تؤثر على إيرادات الأطباء
  EventBus.on('invoices:created', () => renderDocs());
  EventBus.on('invoices:updated', () => renderDocs());

  // Staff: أي تغيير → تحديث شبكة الموظفين
  EventBus.on('staff:created', () => renderStaff());
  EventBus.on('staff:updated', () => renderStaff());
  EventBus.on('staff:deleted', () => renderStaff());

  // Services: أي تغيير → تحديث جدول الخدمات + dropdowns المواعيد
  EventBus.on('services:created', () => { renderSvcs(); fillSvcDropdowns(); });
  EventBus.on('services:updated', () => { renderSvcs(); fillSvcDropdowns(); });
  EventBus.on('services:deleted', () => { renderSvcs(); fillSvcDropdowns(); });

  // Rooms / Equipment: تؤثر على نماذج الخدمات والمواعيد
  EventBus.on('rooms:created',     () => renderSvcs());
  EventBus.on('rooms:updated',     () => renderSvcs());
  EventBus.on('rooms:deleted',     () => renderSvcs());
  EventBus.on('equipment:created', () => renderSvcs());
  EventBus.on('equipment:updated', () => renderSvcs());
  EventBus.on('equipment:deleted', () => renderSvcs());

})();

// ══════════════════════════════════════════
// 👨‍⚕️ DOCTORS
// ══════════════════════════════════════════

function docApptsToday(name){
  const today = new Date().toISOString().split('T')[0];
  return DB.get('appointments').filter(a => a.doctor === name && a.date === today).length;
}
function docApptsTotal(name){
  return DB.get('appointments').filter(a => a.doctor === name).length;
}
function docRevenue(name){
  const svcNames = DB.get('services').filter(s => s.doctor === name).map(s => s.name);
  return DB.get('invoices')
    .filter(i => svcNames.includes(i.service))
    .reduce((s, i) => s + (i.paid || 0), 0);
}

function renderDocs(){
  const grid = document.getElementById('doc-grid'); if(!grid) return;
  const q      = (document.getElementById('doc-search')?.value || '').trim().toLowerCase();
  const branch = document.getElementById('doc-branch-filter')?.value || '';
  let docs = DB.get('doctors');
  if(q)      docs = docs.filter(d => d.name.toLowerCase().includes(q) || (d.specialty || '').toLowerCase().includes(q));
  if(branch) docs = docs.filter(d => d.branch === branch);

  let totalToday = 0, totalRevenue = 0, totalComm = 0;
  DB.get('doctors').forEach(d => {
    totalToday += docApptsToday(d.name);
    const rev = docRevenue(d.name);
    totalRevenue += rev;
    totalComm   += rev * (d.commission || 0) / 100;
  });
  txt('doc-kpi-total',   DB.get('doctors').length);
  txt('doc-kpi-today',   totalToday);
  txt('doc-kpi-revenue', totalRevenue.toLocaleString());
  txt('doc-kpi-comm',    Math.round(totalComm).toLocaleString());

  grid.innerHTML = docs.map((d, i) => {
    const rev   = docRevenue(d.name);
    const comm  = Math.round(rev * (d.commission || 0) / 100);
    const today = docApptsToday(d.name);
    const total = docApptsTotal(d.name);
    return `<div class="bcard">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <div style="display:flex;gap:10px;align-items:center;">
          <div class="tdava" style="background:${AVA[i % AVA.length]}">👨‍⚕️</div>
          <div>
            <div style="font-size:15px;font-weight:800;">${d.name}</div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">${d.specialty || '—'}</div>
          </div>
        </div>
        <span class="ast ${d.status === 'نشط' ? 'sc' : 'sd'}">${d.status}</span>
      </div>
      <div class="g2c" style="gap:8px;margin-bottom:11px;">
        <div style="background:var(--glass);border-radius:8px;padding:9px;text-align:center;">
          <div style="font-size:18px;font-weight:800;color:var(--teal)">${today}</div>
          <div style="font-size:11px;color:var(--text-muted)">مواعيد اليوم</div>
        </div>
        <div style="background:var(--glass);border-radius:8px;padding:9px;text-align:center;">
          <div style="font-size:18px;font-weight:800;color:var(--gold-light)">${rev.toLocaleString()}</div>
          <div style="font-size:11px;color:var(--text-muted)">إيرادات (ج)</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
        📍 ${d.branch || '—'} · ${total} جلسة إجمالي · عمولة ${d.commission || 0}% (${comm.toLocaleString()} ج)
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">📞 ${d.phone || '—'}</div>
      <div style="display:flex;gap:7px;">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="openDocModal('${d.id}')">✏️ تعديل</button>
        <button class="btn btn-danger btn-sm" style="flex:1" onclick="delDoc('${d.id}')">🗑 حذف</button>
      </div>
    </div>`;
  }).join('') || '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted);">لا يوجد أطباء مطابقين</div>';

  fillDocDropdowns();
}

function openDocModal(id){
  const d = id ? DB.get('doctors').find(x => x.id === id) : null;
  document.getElementById('doc-modal-title').textContent = d ? '✏️ تعديل بيانات الطبيب' : '👨‍⚕️ طبيب جديد';
  document.getElementById('doc-id').value         = d ? d.id          : '';
  document.getElementById('doc-name').value       = d ? d.name        : '';
  document.getElementById('doc-specialty').value  = d ? d.specialty || '' : '';
  document.getElementById('doc-branch').value     = d ? d.branch      : 'مدينة نصر';
  document.getElementById('doc-phone').value      = d ? d.phone || '' : '';
  document.getElementById('doc-email').value      = d ? d.email || '' : '';
  document.getElementById('doc-commission').value = d ? d.commission || 15 : 15;
  document.getElementById('doc-status').value     = d ? d.status      : 'نشط';
  document.getElementById('doc-workstart').value  = d ? d.workStart || '09:00' : '09:00';
  document.getElementById('doc-workend').value    = d ? d.workEnd   || '17:00' : '17:00';
  document.getElementById('doc-offday').value     = d ? d.offDay    || '' : '';
  document.getElementById('doc-leaves').value     = d ? d.leaveDates || '' : '';
  openModal('doctor-modal');
}

function saveDoc(){
  const name = gv('doc-name').trim();
  if(!name){ showToast('warning', '⚠️ اسم الطبيب مطلوب'); return; }
  const id   = gv('doc-id');
  const data = {
    name,
    specialty:   gv('doc-specialty'),
    branch:      gv('doc-branch'),
    phone:       gv('doc-phone'),
    email:       gv('doc-email'),
    commission:  parseFloat(gv('doc-commission')) || 0,
    status:      gv('doc-status'),
    workStart:   gv('doc-workstart') || '09:00',
    workEnd:     gv('doc-workend')   || '17:00',
    offDay:      gv('doc-offday'),
    leaveDates:  gv('doc-leaves'),
  };
  if(id){ DB.upd('doctors', id, data); showToast('success', `✅ تم تحديث بيانات ${name}`); }
  else  { DB.push('doctors', data);    showToast('success', `✅ تم إضافة ${name}`); }
  closeModal('doctor-modal');
  // renderDocs() يُستدعى تلقائياً عبر doctors:created / doctors:updated
}

function delDoc(id){
  const d = DB.get('doctors').find(x => x.id === id);
  if(confirm(`حذف ${d?.name || 'الطبيب'}؟`)){
    DB.del('doctors', id);
    showToast('info', '🗑 تم الحذف');
    // renderDocs() يُستدعى تلقائياً عبر doctors:deleted
  }
}

function fillDocDropdowns(){
  const docs = DB.get('doctors');
  ['am-doc','sv-doc'].forEach(did => {
    const sel = document.getElementById(did); if(!sel) return;
    const cur = sel.value;
    sel.innerHTML = docs.map(d => `<option value="${d.name}">${d.name}</option>`).join('')
      || '<option value="">-- لا يوجد أطباء --</option>';
    if(cur && docs.some(d => d.name === cur)) sel.value = cur;
  });
}

function fillSvcDropdowns(){
  const svcs = DB.get('services');
  const sel  = document.getElementById('am-svc'); if(!sel) return;
  const cur  = sel.value;
  sel.innerHTML = svcs.map(s => `<option value="${s.name}">${s.name} (${s.duration || 60} د)</option>`).join('')
    || '<option value="">-- لا توجد خدمات --</option>';
  if(cur && svcs.some(s => s.name === cur)) sel.value = cur;
}

function fillApptRoomDropdown(svcName){
  const sel = document.getElementById('am-room'); if(!sel) return;
  const cur = sel.value;
  const svc = DB.get('services').find(s => s.name === svcName);
  sel.innerHTML = '<option value="">— تلقائي حسب الخدمة —</option>'
    + DB.get('rooms').map(r => `<option>${r.name}</option>`).join('');
  if(svc && svc.room) sel.value = svc.room;
  else if(cur) sel.value = cur;
}

function onApptSvcChange(){
  fillApptRoomDropdown(gv('am-svc'));
}

// ══════════════════════════════════════════
// 👩‍💼 STAFF
// ══════════════════════════════════════════

function renderStaff(){
  const grid = document.getElementById('st-grid'); if(!grid) return;
  const q    = (document.getElementById('st-search')?.value || '').trim().toLowerCase();
  const role = document.getElementById('st-role-filter')?.value || '';
  let staff  = DB.get('staff');
  if(q)    staff = staff.filter(s => s.name.toLowerCase().includes(q));
  if(role) staff = staff.filter(s => s.role === role);

  const all           = DB.get('staff');
  const totalSalaries = all.reduce((s, x) => s + (x.salary || 0), 0);
  const branches      = new Set(all.map(x => x.branch).filter(Boolean));
  txt('st-kpi-total',    all.length);
  txt('st-kpi-active',   all.filter(x => x.status === 'نشط').length);
  txt('st-kpi-salaries', totalSalaries.toLocaleString());
  txt('st-kpi-branches', branches.size);

  const roleColors = { 'استقبال': 'tg-teal', 'محاسب': 'tg-gold', 'مدير فرع': 'tg-purple', 'أخرى': 'tg-green' };
  grid.innerHTML = staff.map((s, i) => `
    <div class="bcard">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <div style="display:flex;gap:10px;align-items:center;">
          <div class="tdava" style="background:${AVA[i % AVA.length]}">👩‍💼</div>
          <div>
            <div style="font-size:15px;font-weight:800;">${s.name}</div>
            <span class="tag ${roleColors[s.role] || 'tg-teal'}" style="font-size:11px;margin-top:3px;display:inline-block;">${s.role}</span>
          </div>
        </div>
        <span class="ast ${s.status === 'نشط' ? 'sc' : 'sd'}">${s.status}</span>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">📍 ${s.branch || '—'}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">📞 ${s.phone || '—'}</div>
      <div style="font-size:13px;font-weight:700;color:var(--gold-light);margin-bottom:11px;">💰 ${(s.salary || 0).toLocaleString()} ج / شهريًا</div>
      <div style="display:flex;gap:7px;">
        <button class="btn btn-teal btn-sm"   style="flex:1" onclick="payStaffSalary('${s.id}')">💸 صرف الراتب</button>
        <button class="btn btn-ghost btn-sm"           onclick="openStaffModal('${s.id}')">✏️</button>
        <button class="btn btn-danger btn-sm"          onclick="delStaff('${s.id}')">🗑</button>
      </div>
    </div>`).join('')
    || '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted);">لا يوجد موظفون مطابقون</div>';
}

function openStaffModal(id){
  const s = id ? DB.get('staff').find(x => x.id === id) : null;
  document.getElementById('st-modal-title').textContent = s ? '✏️ تعديل بيانات الموظف' : '👩‍💼 موظف جديد';
  document.getElementById('st-id').value     = s ? s.id          : '';
  document.getElementById('st-name').value   = s ? s.name        : '';
  document.getElementById('st-role').value   = s ? s.role        : 'استقبال';
  document.getElementById('st-branch').value = s ? s.branch      : 'مدينة نصر';
  document.getElementById('st-phone').value  = s ? s.phone || '' : '';
  document.getElementById('st-email').value  = s ? s.email || '' : '';
  document.getElementById('st-salary').value = s ? s.salary || 5000 : 5000;
  document.getElementById('st-status').value = s ? s.status      : 'نشط';
  openModal('staff-modal');
}

function saveStaff(){
  const name = gv('st-name').trim();
  if(!name){ showToast('warning', '⚠️ اسم الموظف مطلوب'); return; }
  const id   = gv('st-id');
  const data = {
    name,
    role:   gv('st-role'),
    branch: gv('st-branch'),
    phone:  gv('st-phone'),
    email:  gv('st-email'),
    salary: parseFloat(gv('st-salary')) || 0,
    status: gv('st-status'),
  };
  if(id){ DB.upd('staff', id, data); showToast('success', `✅ تم تحديث بيانات ${name}`); }
  else  { DB.push('staff', data);    showToast('success', `✅ تم إضافة ${name}`); }
  closeModal('staff-modal');
  // renderStaff() يُستدعى تلقائياً عبر staff:created / staff:updated
}

function delStaff(id){
  const s = DB.get('staff').find(x => x.id === id);
  if(confirm(`حذف ${s?.name || 'الموظف'}؟`)){
    DB.del('staff', id);
    showToast('info', '🗑 تم الحذف');
    // renderStaff() يُستدعى تلقائياً عبر staff:deleted
  }
}

function payStaffSalary(id){
  const s = DB.get('staff').find(x => x.id === id); if(!s) return;
  if(!confirm(`صرف راتب ${s.name} (${(s.salary || 0).toLocaleString()} ج)؟`)) return;
  DB.push('expenses', {
    name:   `راتب: ${s.name}`,
    type:   'رواتب',
    amount: s.salary || 0,
    branch: s.branch,
    date:   new Date().toISOString().split('T')[0],
    notes:  '',
  });
  showToast('success', `✅ تم صرف راتب ${s.name}`, `${(s.salary || 0).toLocaleString()} ج - تم تسجيله في المصروفات`);
  // expenses:created → hook في 00-core.js يُسجّل في الخزينة تلقائياً
}

// ══════════════════════════════════════════
// 💅 SERVICES
// ══════════════════════════════════════════

function renderSvcs(){
  const tb = document.getElementById('svc-tbody'); if(!tb) return;
  tb.innerHTML = DB.get('services').map(s => {
    const pr = s.price - s.cost;
    const pt = s.price ? Math.round(pr / s.price * 100) : 0;
    return `<tr>
      <td style="font-weight:600">${s.name}</td>
      <td><span class="tag tg-teal">${s.cat}</span></td>
      <td style="color:var(--gold-light);font-weight:700">${s.price} ج</td>
      <td>${s.duration} د</td>
      <td>${s.cost} ج</td>
      <td style="color:var(--emerald)">${pr} ج (${pt}%)</td>
      <td style="font-size:12px">${s.doctor}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-xs"  onclick="openSvcModal('${s.id}')">✏️</button>
        <button class="btn btn-danger btn-xs" onclick="delSvc('${s.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function delSvc(id){
  if(confirm('حذف الخدمة؟')){
    DB.del('services', id);
    // renderSvcs() + fillSvcDropdowns() يُستدعيان تلقائياً عبر services:deleted
  }
}

function openSvcModal(id){
  const s = id ? DB.get('services').find(x => x.id === id) : null;
  document.getElementById('svc-modal-title').textContent = s ? '✏️ تعديل خدمة' : '💅 خدمة جديدة';
  document.getElementById('sv-id').value    = s ? s.id    : '';
  document.getElementById('sv-name').value  = s ? s.name  : '';
  document.getElementById('sv-price').value = s ? s.price : '';
  document.getElementById('sv-cost').value  = s ? s.cost  : '';
  document.getElementById('sv-dur').value   = s ? s.duration : 60;
  const catSel = document.getElementById('sv-cat');
  if(catSel && s) catSel.value = s.cat || catSel.options[0].value;
  const docSel = document.getElementById('sv-doc');
  if(docSel && s) docSel.value = s.doctor || docSel.options[0].value;
  const roomSel = document.getElementById('sv-room');
  if(roomSel){
    roomSel.innerHTML = '<option value="">— بدون تحديد —</option>'
      + DB.get('rooms').map(r => `<option>${r.name}</option>`).join('');
    roomSel.value = s ? s.room || '' : '';
  }
  const equipSel = document.getElementById('sv-equip');
  if(equipSel){
    equipSel.innerHTML = '<option value="">— بدون تحديد —</option>'
      + DB.get('equipment').map(e => `<option>${e.name}</option>`).join('');
    equipSel.value = s ? s.equipment || '' : '';
  }
  openModal('service-modal');
}

function saveSvc(){
  const name = gv('sv-name').trim();
  if(!name){ showToast('warning', '⚠️ اسم الخدمة مطلوب'); return; }
  const id   = gv('sv-id');
  const data = {
    name,
    cat:       gv('sv-cat'),
    doctor:    gv('sv-doc'),
    price:     parseFloat(gv('sv-price')) || 0,
    cost:      parseFloat(gv('sv-cost'))  || 0,
    duration:  parseInt(gv('sv-dur'))     || 60,
    room:      gv('sv-room'),
    equipment: gv('sv-equip'),
  };
  if(id){ DB.upd('services', id, data); showToast('success', `✅ تم تحديث "${name}"`); }
  else  { DB.push('services', data);    showToast('success', `✅ تم إضافة "${name}"`); }
  closeModal('service-modal');
  // renderSvcs() + fillSvcDropdowns() يُستدعيان تلقائياً عبر services:created / services:updated
}
