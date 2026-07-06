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

  // Advances (السلف): أي تغيير → تحديث شبكة الموظفين (لعرض رصيد السلفة المتبقي)
  EventBus.on('advances:created', () => renderStaff());
  EventBus.on('advances:updated', () => renderStaff());
  EventBus.on('advances:deleted', () => renderStaff());

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
function docRevenue(doctorName, doctorId){
  // البحث بـ doctorId أولاً (دقيق) ثم بالاسم كـ fallback للسجلات القديمة
  return DB.get('invoices')
    .filter(i => (doctorId && i.doctorId === doctorId) || i.doctor === doctorName)
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
    const rev = docRevenue(d.name, d.id);
    totalRevenue += rev;
    // ✅ FIX (خطة التوحيد — مرحلة 1.1أ): العمولة الفعلية المسجَّلة وليس
    // تقديراً بإيراد×نسبة حالية (كانت تُحرّف لو الإيراد شمل غير المسدَّد،
    // أو لو نسبة العمولة تغيّرت بعد فواتير قديمة).
    totalComm   += getDoctorCommissionDue(d.id, d.name);
  });
  txt('doc-kpi-total',   DB.get('doctors').length);
  txt('doc-kpi-today',   totalToday);
  txt('doc-kpi-revenue', totalRevenue.toLocaleString());
  txt('doc-kpi-comm',    Math.round(totalComm).toLocaleString());

  grid.innerHTML = docs.map((d, i) => {
    const rev   = docRevenue(d.name, d.id);
    // ✅ FIX (خطة التوحيد — مرحلة 1.1أ): نفس منطق getDoctorCommissionDue
    // المستخدَم في إجمالي الـKPI أعلاه، لضمان تطابق الرقمين دائماً.
    const comm  = Math.round(getDoctorCommissionDue(d.id, d.name));
    const today = docApptsToday(d.name);
    const total = docApptsTotal(d.name);
    return `<div class="bcard">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <div style="display:flex;gap:10px;align-items:center;">
          <div class="tdava" style="background:${AVA[i % AVA.length]}">👨‍⚕️</div>
          <div>
            <div style="font-size:15px;font-weight:800;">${escapeHtml(d.name)}</div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">${escapeHtml(d.specialty) || '—'}</div>
          </div>
        </div>
        <span class="ast ${d.status === 'نشط' ? 'sc' : 'sd'}">${escapeHtml(d.status)}</span>
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
        📍 ${escapeHtml(d.branch) || '—'} · ${total} جلسة إجمالي · عمولة ${d.commission || 0}% (${comm.toLocaleString()} ج)
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">📞 ${escapeHtml(d.phone) || '—'}</div>
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
    sel.innerHTML = docs.map(d => `<option value="${escapeHtml(d.name)}" data-id="${d.id}">${escapeHtml(d.name)}</option>`).join('')
      || '<option value="">-- لا يوجد أطباء --</option>';
    if(cur && docs.some(d => d.name === cur)) sel.value = cur;
  });
}

function fillSvcDropdowns(){
  const svcs = DB.get('services');
  const sel  = document.getElementById('am-svc'); if(!sel) return;
  const cur  = sel.value;
  sel.innerHTML = svcs.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)} (${s.duration || 60} د)</option>`).join('')
    || '<option value="">-- لا توجد خدمات --</option>';
  if(cur && svcs.some(s => s.name === cur)) sel.value = cur;
}

function fillApptRoomDropdown(svcName){
  const sel = document.getElementById('am-room'); if(!sel) return;
  const cur = sel.value;
  const svc = DB.get('services').find(s => s.name === svcName);
  sel.innerHTML = '<option value="">— تلقائي حسب الخدمة —</option>'
    + DB.get('rooms').map(r => `<option>${escapeHtml(r.name)}</option>`).join('');
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
            <div style="font-size:15px;font-weight:800;">${escapeHtml(s.name)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:1px;font-family:monospace;letter-spacing:.5px;">🪪 ${escapeHtml(s.empCode) || '—'}</div>
            <span class="tag ${roleColors[s.role] || 'tg-teal'}" style="font-size:11px;margin-top:3px;display:inline-block;">${escapeHtml(s.role)}</span>
          </div>
        </div>
        <span class="ast ${s.status === 'نشط' ? 'sc' : 'sd'}">${escapeHtml(s.status)}</span>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">📍 ${escapeHtml(s.branch) || '—'}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">📞 ${escapeHtml(s.phone) || '—'}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">📅 استحقاق الراتب: ${s.dueDate ? escapeHtml(s.dueDate) : '<span style="color:var(--rose)">غير محدد</span>'}</div>
      <div style="font-size:13px;font-weight:700;color:var(--gold-light);margin-bottom:6px;">💰 ${(s.salary || 0).toLocaleString()} ج / شهريًا</div>
      ${staffOutstandingAdvance(s.id) > 0
        ? `<div style="font-size:12px;font-weight:700;color:var(--rose);margin-bottom:11px;">🧾 سلفة مستحقة: ${staffOutstandingAdvance(s.id).toLocaleString()} ج (تُخصم من الراتب القادم)</div>`
        : `<div style="margin-bottom:11px;"></div>`}
      <div style="display:flex;gap:7px;margin-bottom:7px;">
        <button class="btn btn-teal btn-sm"   style="flex:1" onclick="payStaffSalary('${s.id}')">💸 صرف الراتب</button>
        <button class="btn btn-ghost btn-sm"           onclick="openAdvanceModal('${s.id}')">💵 سلفة</button>
      </div>
      <div style="display:flex;gap:7px;">
        <button class="btn btn-ghost btn-sm"  style="flex:1" onclick="openStaffModal('${s.id}')">✏️ تعديل</button>
        <button class="btn btn-danger btn-sm" style="flex:1" onclick="delStaff('${s.id}')">🗑 حذف</button>
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
  // ── عرض كود الموظف (للقراءة فقط عند التعديل) ──
  const codeEl = document.getElementById('st-empcode-display');
  if(codeEl) codeEl.textContent = s?.empCode ? `🪪 كود الموظف: ${s.empCode}` : '🪪 سيُولَّد الكود تلقائياً عند الحفظ';
  document.getElementById('st-phone').value  = s ? s.phone || '' : '';
  document.getElementById('st-email').value  = s ? s.email || '' : '';
  document.getElementById('st-salary').value = s ? s.salary || 5000 : 5000;
  document.getElementById('st-duedate').value = s ? s.dueDate || '' : new Date().toISOString().split('T')[0];
  document.getElementById('st-status').value = s ? s.status      : 'نشط';
  openModal('staff-modal');
}

// ── توليد كود الموظف من الاسم ──
// يأخذ الحرف الأول من كل كلمة (حتى 3 كلمات) ويضيف رقماً تسلسلياً
// مثال: "أحمد محمد علي" → "أمع-001"
function generateEmpCode(name){
  const words  = name.trim().split(/\s+/).filter(Boolean);
  const prefix = words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
  // البحث عن أعلى رقم مستخدم لنفس الـ prefix
  const existing = DB.get('staff')
    .map(s => s.empCode || '')
    .filter(c => c.startsWith(prefix + '-'))
    .map(c => parseInt(c.split('-')[1]) || 0);
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

function saveStaff(){
  const name = gv('st-name').trim();
  if(!name){ showToast('warning', '⚠️ اسم الموظف مطلوب'); return; }
  // تاريخ الاستحقاق: لو مش متعبّى (خطأ أو تأخير في التحميل) نستخدم تاريخ اليوم كقيمة افتراضية
  // بدل رفض حفظ الموظف بالكامل
  const dueDate = gv('st-duedate') || new Date().toISOString().split('T')[0];
  const id   = gv('st-id');

  // ── للموظف الجديد: توليد empCode تلقائياً من الاسم ──
  const existingStaff = id ? DB.get('staff').find(x => x.id === id) : null;
  const empCode = existingStaff?.empCode || generateEmpCode(name);

  const data = {
    name,
    empCode,
    role:    gv('st-role'),
    branch:  gv('st-branch'),
    phone:   gv('st-phone'),
    email:   gv('st-email'),
    salary:  parseFloat(gv('st-salary')) || 0,
    dueDate,
    status:  gv('st-status'),
  };
  if(id){ DB.upd('staff', id, data); showToast('success', `✅ تم تحديث بيانات ${name} [${empCode}]`); }
  else  { DB.push('staff', data);    showToast('success', `✅ تم إضافة ${name} [${empCode}]`); }
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

// ── حساب رصيد السلفة المتبقي (غير المخصوم) لموظف معيّن ──
function staffOutstandingAdvance(staffId){
  return DB.get('advances')
    .filter(a => a.staffId === staffId)
    .reduce((sum, a) => sum + (a.remaining ?? a.amount ?? 0), 0);
}

// ── حساب تاريخ الاستحقاق القادم (بعد شهر من تاريخ معيّن) ──
function nextDueDate(dateStr){
  const d = new Date(dateStr);
  if(isNaN(d)) return dateStr;
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfMonth));
  return d.toISOString().split('T')[0];
}

function payStaffSalary(id){
  const s = DB.get('staff').find(x => x.id === id); if(!s) return;

  if(!s.dueDate){
    showToast('warning', '⚠️ لا يوجد تاريخ استحقاق راتب لهذا الموظف', 'أضف تاريخ الاستحقاق أولاً من ✏️ تعديل بيانات الموظف');
    return;
  }

  // ── حماية مزدوجة: منع صرف الراتب أكثر من مرة في نفس الشهر ──
  // 1) نفس dueDate تماماً
  if(s.lastPaidDueDate === s.dueDate){
    showToast('warning', `⚠️ تم صرف راتب ${s.name} لاستحقاق ${s.dueDate} من قبل`, 'لا يمكن صرف الراتب مرتين لنفس تاريخ الاستحقاق');
    return;
  }
  // 2) نفس الشهر والسنة (حتى لو تغيّر الـ dueDate يدوياً)
  if(s.lastPaymentDate){
    const lastPay = new Date(s.lastPaymentDate);
    const today   = new Date();
    if(lastPay.getFullYear() === today.getFullYear() && lastPay.getMonth() === today.getMonth()){
      const monthName = today.toLocaleString('ar-EG', { month: 'long', year: 'numeric' });
      showToast('warning',
        `⚠️ تم صرف راتب ${s.name} بالفعل في ${monthName}`,
        `تاريخ آخر صرف: ${s.lastPaymentDate} — لا يمكن الصرف مرتين في نفس الشهر`);
      return;
    }
  }

  const advances   = DB.get('advances').filter(a => a.staffId === id && (a.remaining ?? a.amount ?? 0) > 0)
                        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const outstanding = advances.reduce((sum, a) => sum + (a.remaining ?? a.amount ?? 0), 0);
  const salary       = s.salary || 0;
  const deduction     = Math.min(outstanding, salary);
  const net           = salary - deduction;

  const confirmMsg = deduction > 0
    ? `صرف راتب ${s.name}\nالراتب: ${salary.toLocaleString()} ج\nخصم سلفة: ${deduction.toLocaleString()} ج\nالصافي: ${net.toLocaleString()} ج\n\nتاريخ الاستحقاق: ${s.dueDate}`
    : `صرف راتب ${s.name} (${salary.toLocaleString()} ج)؟\nتاريخ الاستحقاق: ${s.dueDate}`;
  if(!confirm(confirmMsg)) return;

  // ✅ إصلاح (تصنيف السلف والرواتب): amount هنا فضل الصافي المدفوع فعليًا
  // (زي ما هو من قبل — عشان أي كود تاني بيقرأ amount كـ"كاش خرج فعليًا"
  // يفضل شغّال صح من غير تعديل)، وبنضيف advanceDeduction بس عشان هوك
  // المحاسبة (14-accounting-hooks.js) يقدر يسجل الراتب الإجمالي في حساب
  // 5300 ويقفل جزء الخصم من حساب السلفة 1150 بدل ما يتجاهله.
  const _salExp = DB.push('expenses', {
    name:   `راتب: ${s.name}${deduction > 0 ? ` (بعد خصم سلفة ${deduction.toLocaleString()} ج)` : ''}`,
    type:   'رواتب',
    amount: net,
    advanceDeduction: deduction,
    branch: s.branch,
    date:   new Date().toISOString().split('T')[0],
    notes:  deduction > 0 ? `تم خصم سلفة بقيمة ${deduction.toLocaleString()} ج من راتب استحقاق ${s.dueDate}` : '',
  });
  // ✅ FIX: تسجيل الراتب في الخزينة مباشرةً باستخدام ID المصروف المُنشأ
  DB.push('cashlog', {
    type: 'صادر',
    source: 'مصروف',
    refId: _salExp?.id || null,
    amount: net,
    method: 'كاش',
    date: new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString(),
    notes: `راتب: ${s.name}${deduction > 0 ? ` — خصم سلفة ${deduction.toLocaleString()} ج` : ''}`,
  });

  // ── تسوية السلف المستحقة (الأقدم أولاً) ──
  let remainDeduct = deduction;
  advances.forEach(a => {
    if(remainDeduct <= 0) return;
    const balance = a.remaining ?? a.amount ?? 0;
    const take    = Math.min(balance, remainDeduct);
    DB.upd('advances', a.id, {
      remaining: balance - take,
      status:    (balance - take) <= 0 ? 'مسدد بالكامل' : 'مسدد جزئيًا',
    });
    remainDeduct -= take;
  });

  // ── تحديث الموظف: تسجيل تاريخ الصرف وتقديم الاستحقاق للشهر القادم ──
  DB.upd('staff', id, {
    lastPaidDueDate: s.dueDate,
    lastPaymentDate: new Date().toISOString().split('T')[0],
    dueDate:         nextDueDate(s.dueDate),
  });

  showToast('success', `✅ تم صرف راتب ${s.name}`,
    deduction > 0
      ? `${net.toLocaleString()} ج صافي (بعد خصم سلفة ${deduction.toLocaleString()} ج) - تم تسجيله في المصروفات`
      : `${net.toLocaleString()} ج - تم تسجيله في المصروفات`);
  // ملاحظة: cashlog اتسجل بالفعل أعلاه يدوياً — hook الـ expenses:created في 00-core.js
  // لا يضيف سجل خزينة آخر (فقط refresh للواجهة)، فلا يوجد تكرار.
}

// ══════════════════════════════════════════
// 💵 السلف (ADVANCES)
// ══════════════════════════════════════════

function openAdvanceModal(staffId){
  const s = DB.get('staff').find(x => x.id === staffId); if(!s) return;
  document.getElementById('adv-staff-id').value   = s.id;
  document.getElementById('adv-staff-name').value = s.name;
  document.getElementById('adv-amount').value     = '';
  document.getElementById('adv-date').value       = new Date().toISOString().split('T')[0];
  document.getElementById('adv-note').value       = '';
  openModal('advance-modal');
}

function saveAdvance(){
  const staffId = gv('adv-staff-id');
  const s = DB.get('staff').find(x => x.id === staffId);
  if(!s){ showToast('warning', '⚠️ يجب اختيار موظف'); return; }
  const amount = parseFloat(gv('adv-amount')) || 0;
  if(amount <= 0){ showToast('warning', '⚠️ قيمة السلفة غير صحيحة'); return; }
  const date = gv('adv-date') || new Date().toISOString().split('T')[0];
  const note = gv('adv-note');

  // ✅ إصلاح (تصنيف السلف والرواتب): السلفة بقت بتتسجل في 'advances' بس —
  // مبقتش بتتسجل كمصروف (كانت بتتحط في 'expenses' بنوع 'سلفة' وتتقفل على
  // حساب 5900 "مصروفات متنوعة" افتراضيًا، رغم إنها اقتصاديًا ذمة على الموظف
  // قابلة للاسترداد مش مصروف نهائي). القيد المحاسبي الصحيح (مدين 1150 سلف
  // الموظفين / دائن 1110 الخزينة) بقى بيتسجل تلقائيًا عبر هوك advances:created
  // في 14-accounting-hooks.js. cashlog لسه بيتسجل هنا زي ما هو (كاش خرج
  // فعليًا من الخزينة)، بس بمرجع refId = معرّف السلفة نفسها بدل مصروف وهمي.
  const _adv = DB.push('advances', {
    staffId,
    staffName: s.name,
    branch:    s.branch,
    amount,
    remaining: amount,
    date,
    note,
    status: 'مستحق',
  });

  DB.push('cashlog', {
    type: 'صادر',
    source: 'سلفة موظف',
    refId: _adv?.id || null,
    amount,
    method: 'كاش',
    date,
    timestamp: new Date().toISOString(),
    notes: `سلفة: ${s.name}${note ? ' — ' + note : ''}`,
  });

  showToast('success', `✅ تم صرف سلفة لـ ${s.name}`, `${amount.toLocaleString()} ج - ستُخصم من راتبه القادم`);
  closeModal('advance-modal');
  // renderStaff() يُستدعى تلقائياً عبر advances:created
}

// ══════════════════════════════════════════
// 💅 SERVICES
// ══════════════════════════════════════════

function renderSvcs(){
  const tb = document.getElementById('svc-tbody'); if(!tb) return;
  const invMap = {};
  DB.get('inventory').forEach(p => { invMap[p.id] = p.name; });

  const q = (document.getElementById('svc-search')?.value || '').toLowerCase();
  const catF = document.getElementById('svc-cat-filter')?.value || '';
  const statusF = document.getElementById('svc-status-filter')?.value || '';

  let svcs = DB.get('services');
  if(q) svcs = svcs.filter(s => (s.name||'').toLowerCase().includes(q) || (s.cat||'').includes(q));
  if(catF) svcs = svcs.filter(s => s.cat === catF);
  if(statusF) svcs = svcs.filter(s => (s.status||'نشطة') === statusF);

  // ── KPIs ──
  const allSvcs = DB.get('services');
  const avgPrice = allSvcs.length ? Math.round(allSvcs.reduce((s,x)=>s+(x.price||0),0)/allSvcs.length) : 0;
  const avgProfit = allSvcs.length ? Math.round(allSvcs.reduce((sum,s)=>{
    const mc = typeof calcServiceMaterialCost==='function' ? calcServiceMaterialCost(s.id) : (s.cost||0);
    return sum + ((s.price||0) - mc);
  },0)/allSvcs.length) : 0;
  const withBom = allSvcs.filter(s=>s.recipe && Array.isArray(s.recipe) && s.recipe.length>0).length;
  const needReview = allSvcs.filter(s => getSvcPriceAlert(s).needsReview).length;
  if(document.getElementById('svc-kpi-total')) txt('svc-kpi-total', allSvcs.length);
  if(document.getElementById('svc-kpi-avg-price')) txt('svc-kpi-avg-price', avgPrice.toLocaleString());
  if(document.getElementById('svc-kpi-avg-profit')) txt('svc-kpi-avg-profit', avgProfit.toLocaleString());
  if(document.getElementById('svc-kpi-with-bom')) txt('svc-kpi-with-bom', withBom);
  if(document.getElementById('svc-kpi-need-review')) txt('svc-kpi-need-review', needReview);

  tb.innerHTML = svcs.map(s => {
    const materialCost = typeof calcServiceMaterialCost === 'function' ? calcServiceMaterialCost(s.id) : (s.cost||0);
    const effectiveCost = materialCost;
    const pr = (s.price||0) - effectiveCost;
    const pt = s.price ? Math.round(pr / s.price * 100) : 0;
    const profitColor = pr >= 0 ? 'var(--emerald)' : 'var(--rose)';
    const status = s.status || 'نشطة';
    const statusCls = status === 'نشطة' ? 'sc' : 'sd';
    let prodLabel;
    if(s.recipe && Array.isArray(s.recipe) && s.recipe.length > 0){
      prodLabel = s.recipe.map(ing => {
        const name = escapeHtml(invMap[ing.productId] || '؟');
        return `${name} × ${ing.qty}${ing.unit ? ' '+escapeHtml(ing.unit) : ''}`;
      }).join(' | ');
      prodLabel = `<span style="font-size:11px;color:var(--teal)">${prodLabel}</span>`;
    } else if(s.linkedProductId && invMap[s.linkedProductId]){
      prodLabel = `<span style="font-size:11px;color:var(--text-muted)">${escapeHtml(invMap[s.linkedProductId])} × ${s.consumeQty||1}</span>`;
    } else {
      prodLabel = '<span style="color:var(--text-muted);font-size:11px;">لا مكونات</span>';
    }
    const alertInfo = getSvcPriceAlert(s);
    const clinicColor = alertInfo.clinicProfit >= 0 ? 'var(--emerald)' : 'var(--rose)';
    const clinicProfitCell = `<span style="font-weight:700;color:${clinicColor}">${alertInfo.clinicProfit.toFixed(1)} ج</span>` +
      (alertInfo.commissionPct > 0 ? `<div style="font-size:10px;color:var(--text-muted)">بعد عمولة د. ${alertInfo.commissionPct}% (${alertInfo.commissionAmt.toFixed(1)} ج)</div>` : '');
    const alertLabel = alertInfo.needsReview
      ? `<span class="tag" style="background:rgba(244,63,94,.15);color:var(--rose);font-weight:700;cursor:help;" title="${alertInfo.reasons.join(' | ')}">🔺 ارفع السعر</span>`
      : `<span style="color:var(--text-muted);font-size:11px;">✓ مناسب</span>`;
    return `<tr>
      <td style="font-weight:700">${escapeHtml(s.name)}</td>
      <td><span class="tag tg-teal">${escapeHtml(s.cat)}</span></td>
      <td style="color:var(--gold-light);font-weight:700">${(s.price||0).toLocaleString()} ج</td>
      <td style="font-size:12px">${s.duration||60} د</td>
      <td style="color:var(--rose);font-weight:600">${effectiveCost.toFixed(1)} ج</td>
      <td style="color:${profitColor};font-weight:700">${pr.toFixed(1)} ج</td>
      <td style="color:${profitColor};font-size:12px;font-weight:600">${pt}%</td>
      <td style="font-size:11px">${clinicProfitCell}</td>
      <td style="font-size:11px">${alertLabel}</td>
      <td style="font-size:11px;max-width:160px">${prodLabel}</td>
      <td><span class="ast ${statusCls}">${escapeHtml(status)}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-xs"  onclick="openSvcModal('${s.id}')">✏️</button>
        <button class="btn btn-danger btn-xs" onclick="delSvc('${s.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="12" style="text-align:center;color:var(--text-muted);padding:24px">لا توجد خدمات مطابقة</td></tr>';
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
  document.getElementById('sv-dur').value   = s ? s.duration : 60;
  const catSel = document.getElementById('sv-cat');
  if(catSel && s) catSel.value = s.cat || catSel.options[0].value;
  const docSel = document.getElementById('sv-doc');
  if(docSel && s) docSel.value = s.doctor || docSel.options[0].value;
  const statusSel = document.getElementById('sv-status');
  if(statusSel) statusSel.value = s ? (s.status || 'نشطة') : 'نشطة';
  const roomSel = document.getElementById('sv-room');
  if(roomSel){
    roomSel.innerHTML = '<option value="">— بدون تحديد —</option>'
      + DB.get('rooms').map(r => `<option>${escapeHtml(r.name)}</option>`).join('');
    roomSel.value = s ? s.room || '' : '';
  }
  const equipSel = document.getElementById('sv-equip');
  if(equipSel){
    equipSel.innerHTML = '<option value="">— بدون تحديد —</option>'
      + DB.get('equipment').map(e => `<option>${escapeHtml(e.name)}</option>`).join('');
    equipSel.value = s ? s.equipment || '' : '';
  }
  // ── وصفة المكونات (BOM) ──
  window._svcRecipe = (s && s.recipe && Array.isArray(s.recipe)) ? JSON.parse(JSON.stringify(s.recipe)) : [];
  renderSvcRecipeRows();
  updateSvcProfitPreview();
  openModal('service-modal');
}

function saveSvc(){
  const name = gv('sv-name').trim();
  if(!name){ showToast('warning', '⚠️ اسم الخدمة مطلوب'); return; }
  const id   = gv('sv-id');
  const existing = id ? DB.get('services').find(x => x.id === id) : null;
  // جمع الوصفة من الصفوف المؤقتة (window._svcRecipe)
  const recipe = (window._svcRecipe || []).filter(r => r.productId && parseFloat(r.qty) > 0);
  // حساب تكلفة المواد تلقائياً من الوصفة
  const products = DB.get('inventory') || [];
  const autoCost = recipe.reduce((sum, ing) => {
    const prod = products.find(p => p.id === ing.productId);
    if(!prod) return sum;
    // استخدام تكلفة وحدة الاستهلاك المحسوبة من آخر شراء
    const unitCost = prod.costPerConsumeUnit || prod.cost || prod.costPrice || prod.lastPurchasePrice || 0;
    return sum + (parseFloat(ing.qty)||0) * unitCost;
  }, 0);
  const newPrice = parseFloat(gv('sv-price')) || 0;
  // ✅ تنبيه رفع السعر: نسجّل تكلفة المواد وتاريخها وقت آخر مرة اتغيّر فيها السعر فعلاً
  // (مش وقت أي حفظ)، عشان نقدر نقارن لاحقاً ارتفاع التكلفة منذ آخر تسعير حقيقي
  const priceChanged = !existing || existing.price !== newPrice;
  const priceSetCost = priceChanged ? autoCost : (existing?.priceSetCost ?? autoCost);
  const priceSetDate = priceChanged ? new Date().toISOString() : (existing?.priceSetDate ?? new Date().toISOString());
  const data = {
    name,
    cat:      gv('sv-cat'),
    doctor:   gv('sv-doc'),
    price:    newPrice,
    cost:     autoCost,     // تُحسب تلقائياً من الوصفة — لا إدخال يدوي
    duration: parseInt(gv('sv-dur'))     || 60,
    room:     gv('sv-room'),
    equipment:gv('sv-equip'),
    status:   gv('sv-status') || 'نشطة',
    recipe,
    priceSetCost,
    priceSetDate,
    // legacy fields — محفوظة للتوافق مع البيانات القديمة
    linkedProductId: recipe.length > 0 ? recipe[0].productId : null,
    consumeQty:      recipe.length > 0 ? parseFloat(recipe[0].qty) : 1,
  };
  if(id){ DB.upd('services', id, data); showToast('success', `✅ تم تحديث "${name}"`); }
  else  { DB.push('services', data);    showToast('success', `✅ تم إضافة "${name}"`); }
  closeModal('service-modal');
  // renderSvcs() + fillSvcDropdowns() يُستدعيان تلقائياً عبر services:created / services:updated
}

// ══════════════════════════════════════════
// 🔺 تنبيه رفع سعر الجلسات — تلقائي
// ══════════════════════════════════════════
// يشتغل على أساسين (حسب إعدادات النظام في شاشة "الإعدادات"):
//  1) هامش ربح العيادة الصافي (بعد خصم تكلفة المواد المستخدمة + عمولة الطبيب)
//     أقل من الحد الأدنى المسموح (افتراضي 30%)
//  2) تكلفة المواد الحالية ارتفعت عن تكلفتها وقت آخر مرة اتحدد/اتغيّر فيها السعر،
//     بنسبة أكبر من الحد المسموح (افتراضي 15%)
// ملاحظة: المصاريف العامة (إيجار، رواتب، فواتير...) مش بتتحسب هنا لأنها مصاريف
// عيادة عامة مش مرتبطة بخدمة بعينها — ده overhead منفصل بيظهر في تقرير الأرباح
// والخسائر العام، مش في ربحية كل خدمة على حدة.
function getSvcPriceAlert(s){
  const settings = DB.get('settings') || {};
  const marginThreshold = parseFloat(settings.priceAlertMargin) || 30;
  const costIncreaseThreshold = parseFloat(settings.priceAlertCostIncrease) || 15;

  const materialCost = typeof calcServiceMaterialCost === 'function' ? calcServiceMaterialCost(s.id) : (s.cost||0);
  const price = s.price || 0;
  const grossProfit = price - materialCost; // الربح بعد المواد فقط، قبل عمولة الطبيب

  // ✅ عمولة الطبيب: نفس منهجية الحساب المستخدمة فعليًا عند إقفال الجلسة
  // (calcCdTotal/finalizeConsultation) — نسبة % من صافي الربح بعد خصم تكلفة المواد
  const doctor = (DB.get('doctors')||[]).find(d => d.name === s.doctor);
  const commissionPct = doctor?.commission || 0;
  const commissionAmt = grossProfit > 0 ? Math.round(grossProfit * commissionPct / 100) : 0;
  const clinicProfit = grossProfit - commissionAmt; // ✅ صافي اللي فعليًا بيفضل للعيادة
  const margin = price > 0 ? (clinicProfit / price * 100) : 0;

  const reasons = [];
  if(price > 0 && margin < marginThreshold){
    reasons.push(`صافي ربح العيادة ${margin.toFixed(0)}% (بعد المواد وعمولة الطبيب ${commissionPct}%) أقل من الحد الأدنى (${marginThreshold}%)`);
  }
  const baseCost = s.priceSetCost;
  if(baseCost && baseCost > 0 && materialCost > baseCost){
    const increasePct = (materialCost - baseCost) / baseCost * 100;
    if(increasePct > costIncreaseThreshold){
      reasons.push(`تكلفة المواد ارتفعت ${increasePct.toFixed(0)}% عن آخر تسعير`);
    }
  }
  return { needsReview: reasons.length > 0, reasons, margin, materialCost, grossProfit, commissionPct, commissionAmt, clinicProfit };
}

// ══════════════════════════════════════════
// 🧪 SERVICE BOM (RECIPE) — وصفة مكونات الخدمة
// ══════════════════════════════════════════
// window._svcRecipe = [ { productId, qty, unit }, ... ]
// يُخزَّن مؤقتاً أثناء فتح المودال ويُحفظ عند saveSvc()

function renderSvcRecipeRows(){
  const container = document.getElementById('svc-recipe-rows');
  if(!container) return;
  const products = DB.get('inventory') || [];
  const recipe   = window._svcRecipe || [];

  if(recipe.length === 0){
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:8px;">لا توجد مكونات — اضغط "إضافة مكوّن"</div>';
  } else {
    container.innerHTML = recipe.map((ing, idx) => `
      <div style="display:grid;grid-template-columns:1fr 70px 50px 32px;gap:4px;align-items:center;">
        <select class="fctl" style="font-size:12px;padding:4px 6px;" onchange="setSvcRecipeField(${idx},'productId',this.value)">
          <option value="">— اختر منتج —</option>
          ${products.map(p => `<option value="${p.id}" ${p.id===ing.productId?'selected':''}>${escapeHtml(p.name)}${p.consumeUnit?' ('+escapeHtml(p.consumeUnit)+')':''}</option>`).join('')}
        </select>
        <input class="fctl" type="number" min="0.01" step="0.01" style="font-size:12px;padding:4px 6px;text-align:center;"
               value="${ing.qty||''}" placeholder="الكمية"
               onchange="setSvcRecipeField(${idx},'qty',this.value)">
        <input class="fctl" type="text" style="font-size:12px;padding:4px 6px;text-align:center;"
               value="${escapeHtml(ing.unit)||''}" placeholder="${escapeHtml(products.find(p=>p.id===ing.productId)?.consumeUnit)||'مل/جم'}"
               onchange="setSvcRecipeField(${idx},'unit',this.value)">
        <button type="button" class="btn btn-danger btn-xs" onclick="removeSvcRecipeRow(${idx})" style="padding:4px 6px;">✕</button>
      </div>
    `).join('');
  }

  // تحديث تكلفة المواد المحسوبة
  updateSvcRecipeCostCalc();
}

function addSvcRecipeRow(){
  if(!window._svcRecipe) window._svcRecipe = [];
  window._svcRecipe.push({ productId: '', qty: '', unit: '' });
  renderSvcRecipeRows();
}

function removeSvcRecipeRow(idx){
  if(!window._svcRecipe) return;
  window._svcRecipe.splice(idx, 1);
  renderSvcRecipeRows();
}

function setSvcRecipeField(idx, field, value){
  if(!window._svcRecipe || !window._svcRecipe[idx]) return;
  window._svcRecipe[idx][field] = value;
  if(field === 'qty' || field === 'productId') updateSvcRecipeCostCalc();
}

function updateSvcRecipeCostCalc(){
  const el = document.getElementById('svc-recipe-cost-calc');
  if(!el) return;
  const recipe   = window._svcRecipe || [];
  const products = DB.get('inventory') || [];
  const total = recipe.reduce((sum, ing) => {
    if(!ing.productId || !ing.qty) return sum;
    const prod = products.find(p => p.id === ing.productId);
    if(!prod) return sum;
    const unitCost = prod.costPerConsumeUnit || prod.cost || prod.costPrice || prod.lastPurchasePrice || 0;
    return sum + (parseFloat(ing.qty)||0) * unitCost;
  }, 0);
  el.textContent = total.toFixed(2) + ' ج';
  // تحديث ملخص الربح في نفس الوقت
  updateSvcProfitPreview();
}

// ── حساب وعرض ملخص الربح المتوقع في مودال الخدمة ──
function updateSvcProfitPreview(){
  const price = parseFloat(document.getElementById('sv-price')?.value) || 0;
  const recipe = window._svcRecipe || [];
  const products = DB.get('inventory') || [];
  const cost = recipe.reduce((sum, ing) => {
    if(!ing.productId || !ing.qty) return sum;
    const prod = products.find(p => p.id === ing.productId);
    if(!prod) return sum;
    const unitCost = prod.costPerConsumeUnit || prod.cost || prod.costPrice || prod.lastPurchasePrice || 0;
    return sum + (parseFloat(ing.qty)||0) * unitCost;
  }, 0);
  const profit = price - cost;
  const priceEl = document.getElementById('sv-preview-price');
  const costEl = document.getElementById('sv-preview-cost');
  const profitEl = document.getElementById('sv-preview-profit');
  if(priceEl) priceEl.textContent = price.toLocaleString() + ' ج';
  if(costEl) costEl.textContent = cost.toFixed(2) + ' ج';
  if(profitEl){
    profitEl.textContent = profit.toFixed(2) + ' ج';
    profitEl.style.color = profit >= 0 ? 'var(--emerald)' : 'var(--rose)';
  }
}
