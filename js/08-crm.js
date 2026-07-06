// ══════════════════════════════════════════════════════════════════
// 📣 CRM MODULE — v4.0  (Event-Driven)
// Leads · WhatsApp · Campaigns
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════
// 📡 EventBus Listeners — تحديث تلقائي بدون استدعاءات يدوية
// ══════════════════════════════════════════
(function _crmListeners(){

  // Leads: أي تغيير على الـ leads → تحديث الكانبان تلقائياً
  EventBus.on('leads:created', () => { renderLeads(); renderCampaigns(); });
  EventBus.on('leads:updated', () => { renderLeads(); renderCampaigns(); });
  EventBus.on('leads:deleted', () => { renderLeads(); renderCampaigns(); });

  // Patients: تغيير بيانات المرضى → تحديث قائمة واتساب
  EventBus.on('patients:created', () => { if(_waSelectedPat===null) renderWAContacts(''); });
  EventBus.on('patients:updated', (pat) => {
    renderWAContacts(document.getElementById('wa-search')?.value || '');
    // لو العميل المحدد هو اللي اتغير → حدّث القوالب
    if(_waSelectedPat && String(_waSelectedPat.id) === String(pat.id)){
      _waSelectedPat = pat;
      renderWATemplates();
    }
  });
  EventBus.on('patients:deleted', () => renderWAContacts(''));

  // Appointments: تغيير المواعيد → القوالب تتغير (الموعد القادم)
  EventBus.on('appointments:created', () => { if(_waSelectedPat) renderWATemplates(); });
  EventBus.on('appointments:updated', () => { if(_waSelectedPat) renderWATemplates(); });
  EventBus.on('appointments:deleted', () => { if(_waSelectedPat) renderWATemplates(); });

  // Campaigns: أي تغيير على الحملات → تحديث الشاشة
  EventBus.on('campaigns:created', () => renderCampaigns());
  EventBus.on('campaigns:updated', () => renderCampaigns());
  EventBus.on('campaigns:deleted', () => renderCampaigns());

})();

// ══════════════════════════════════════════
// 🔗 ربط حقيقي Leads ↔ Campaigns
// leadsCount/converted بتاع كل حملة بيُحسبوا دايماً من جدول leads
// الفعلي عبر campaignId — مش من إدخال يدوي. كده مفيش تضارب بين
// رقم تكتبه بإيدك ورقم حقيقي.
// ══════════════════════════════════════════
function campLeadStats(campaignId){
  if(!campaignId) return { leadsCount: 0, converted: 0 };
  const camLeads = DB.get('leads').filter(l => String(l.campaignId) === String(campaignId));
  return {
    leadsCount: camLeads.length,
    converted:  camLeads.filter(l => l.status === 'تم التحويل').length,
  };
}


const LCOLS = [
  { k: 'جديد',       b: 'nb-teal'  },
  { k: 'تم التواصل', b: 'nb-teal'  },
  { k: 'مهتم',       b: 'nb-amber' },
  { k: 'غير مهتم',   b: ''         },
  { k: 'تم التحويل', b: 'nb-green' },
];

let _leadsSearch = '';

function renderLeads(q){
  if(q !== undefined) _leadsSearch = q;
  const kb = document.getElementById('leads-kanban'); if(!kb) return;
  let leads = DB.get('leads');
  txt('badge-leads', leads.filter(l => l.status === 'جديد').length);
  const lbl = document.getElementById('leads-lbl');
  if(lbl) lbl.textContent = `${leads.length} lead`;
  const searchEl = document.getElementById('leads-search');
  if(searchEl && searchEl.value !== _leadsSearch) searchEl.value = _leadsSearch;
  const term = (_leadsSearch || '').trim();
  if(term){
    leads = leads.filter(l =>
      (l.name && l.name.includes(term)) ||
      (l.source && l.source.includes(term)) ||
      (l.service && l.service.includes(term)) ||
      (l.phone && l.phone.includes(term))
    );
  }
  const camps = DB.get('campaigns');
  kb.innerHTML = LCOLS.map(col => {
    const items = leads.filter(l => l.status === col.k);
    return `<div class="kcol">
      <div class="kcol-t">
        <span>${col.k}</span>
        <span class="nb ${col.b}" style="font-size:10px;padding:2px 7px;">${items.length}</span>
      </div>
      ${items.map(l => {
        const camp = l.campaignId ? camps.find(c => c.id === l.campaignId) : null;
        return `
        <div class="lcard">
          <div class="lname">${escapeHtml(l.name)}</div>
          <div class="lsvc">${escapeHtml(l.service)}</div>
          <div class="ltime">📞 ${escapeHtml(l.source)}${l.notes ? ' · ' + escapeHtml(l.notes) : ''}</div>
          ${camp ? `<div style="font-size:10px;color:var(--teal);margin-top:3px;">📣 ${escapeHtml(camp.name)}</div>` : ''}
          <div style="display:flex;gap:5px;margin-top:8px;">
            ${l.status !== 'تم التحويل' ? `<button class="btn btn-ghost btn-xs" style="flex:1" onclick="moveLead('${l.id}')">→ تقدّم</button>` : ''}
            ${['مهتم','تم التواصل'].includes(l.status) ? `<button class="btn btn-teal btn-xs" style="flex:1" onclick="convertToAppt('${l.id}')">📅 حوّل لموعد</button>` : ''}
            ${l.status !== 'تم التحويل' ? `<button class="btn btn-ghost btn-xs" onclick="openLeadModal('${l.id}')">✏️</button>` : ''}
            <button class="btn btn-danger btn-xs" onclick="delLead('${l.id}')">🗑</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

function moveLead(id){
  const lead = DB.get('leads').find(l => l.id == id); if(!lead) return;
  const idx = LCOLS.findIndex(c => c.k === lead.status);
  // ✅ FIX (باگ منطقي): "تقدّم" ما ينقلش لـ "تم التحويل" أبداً — الحالة دي
  // لازم تحصل فقط من خلال confirmConvertToAppt الفعلية (عميل + موعد حقيقيين)،
  // عشان "تم التحويل" يفضل معناها دايماً تحويل حقيقي، مش مجرد كليكات.
  const lastNonConvertedIdx = LCOLS.length - 2; // 'غير مهتم'
  if(idx >= lastNonConvertedIdx){
    showToast('warning', '⚠️ استخدم "حوّل لموعد" لإكمال التحويل الفعلي', 'لا يمكن الوصول لحالة "تم التحويل" بدون عميل وموعد حقيقيين');
    return;
  }
  const next = LCOLS[idx + 1];
  DB.upd('leads', id, { status: next.k });
  showToast('info', `🎯 ${lead.name} → ${next.k}`);
  // renderLeads() يُستدعى تلقائياً عبر leads:updated
}

function delLead(id){
  const lead = DB.get('leads').find(l => l.id == id); if(!lead) return;
  if(confirm(`حذف Lead "${lead.name}"؟`)){
    DB.del('leads', id);
    showToast('info', '🗑 تم حذف الـ Lead');
    // renderLeads() يُستدعى تلقائياً عبر leads:deleted
  }
}

// ── فتح modal لإضافة Lead جديد أو تعديل لو تم تمرير id ──
function openLeadModal(id){
  const lead = id ? DB.get('leads').find(l => l.id == id) : null;
  const campSel = document.getElementById('ld-campaign');
  if(campSel){
    const camps = DB.get('campaigns');
    campSel.innerHTML = '<option value="">— بدون حملة —</option>' +
      camps.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }
  const set = (id, v) => { const e = document.getElementById(id); if(e) e.value = v || ''; };
  document.getElementById('lead-modal-id') && (document.getElementById('lead-modal-id').value = id || '');
  if(lead){
    set('ld-name', lead.name); set('ld-phone', lead.phone); set('ld-svc', lead.service);
    set('ld-src', lead.source); set('ld-campaign', lead.campaignId); set('ld-notes', lead.notes);
  } else {
    ['ld-name','ld-phone','ld-notes'].forEach(i => set(i, ''));
    set('ld-campaign', '');
  }
  const titleEl = document.querySelector('#lead-modal .mtitle');
  if(titleEl) titleEl.textContent = lead ? '✏️ تعديل Lead' : '🎯 Lead جديد';
  openModal('lead-modal');
}

function saveLead(){
  const name = gv('ld-name').trim();
  if(!name){ showToast('warning', '⚠️ الاسم مطلوب'); return; }
  const editId = document.getElementById('lead-modal-id')?.value;
  const data = {
    name,
    phone:      gv('ld-phone'),
    service:    gv('ld-svc'),
    source:     gv('ld-src'),
    campaignId: gv('ld-campaign') || null,
    notes:      gv('ld-notes'),
  };
  if(editId){
    DB.upd('leads', editId, data);
    showToast('success', `✅ تم تحديث ${name}`);
  } else {
    DB.push('leads', { ...data, status: 'جديد' });
    showToast('success', `🎯 تم إضافة ${name} كـ Lead`);
  }
  closeModal('lead-modal');
  ['ld-name','ld-phone','ld-notes'].forEach(i => {
    const e = document.getElementById(i); if(e) e.value = '';
  });
  // renderLeads() يُستدعى تلقائياً عبر leads:created / leads:updated
}

// ── فتح modal لاختيار تاريخ الموعد قبل التحويل ──
function convertToAppt(leadId){
  const lead = DB.get('leads').find(l => l.id === leadId);
  if(!lead){ showToast('error', '❌ الـ Lead غير موجود'); return; }
  if(lead.status === 'تم التحويل'){ showToast('warning', '⚠️ هذا الـ Lead تم تحويله مسبقاً'); return; }

  // تعيين الـ ID وتاريخ افتراضي (غداً)
  const el = document.getElementById('cvt-lead-id');
  if(el) el.value = leadId;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const dateEl = document.getElementById('cvt-appt-date');
  if(dateEl) dateEl.value = tomorrow.toISOString().split('T')[0];
  const notesEl = document.getElementById('cvt-appt-notes');
  if(notesEl) notesEl.value = '';

  // ✅ FIX (مشكلة الخدمة/الطبيب الخطأ): بدل ما نقع على أول خدمة في القايمة
  // بالصدفة لو الاسم متطابقش، نعرض كل الخدمات الحقيقية في select ونحاول
  // نطابق تلقائياً، ونحذّر المستخدم لو مفيش تطابق دقيق عشان يتأكد بنفسه.
  const services = DB.get('services');
  const svcSel  = document.getElementById('cvt-service');
  const warnEl  = document.getElementById('cvt-svc-warn');
  const exactMatch = services.find(s => s.name === lead.service);
  if(svcSel){
    svcSel.innerHTML = services.map(s =>
      `<option value="${s.id}" ${exactMatch && s.id === exactMatch.id ? 'selected' : ''}>${escapeHtml(s.name)}${s.doctor ? ' — ' + escapeHtml(s.doctor) : ''}</option>`
    ).join('') || '<option value="">لا توجد خدمات مسجّلة</option>';
  }
  if(warnEl) warnEl.style.display = (!exactMatch && lead.service) ? 'block' : 'none';
  openModal('lead-convert-modal');
}

// ── تنفيذ التحويل الفعلي بعد اختيار التاريخ ──
function confirmConvertToAppt(){
  const leadId = document.getElementById('cvt-lead-id')?.value;
  const apptDate = document.getElementById('cvt-appt-date')?.value;
  const apptTime = document.getElementById('cvt-appt-time')?.value || '10:00';
  const extraNotes = document.getElementById('cvt-appt-notes')?.value || '';
  const svcId = document.getElementById('cvt-service')?.value;

  if(!apptDate){ showToast('warning', '⚠️ اختر تاريخ الموعد'); return; }

  const lead = DB.get('leads').find(l => l.id === leadId);
  if(!lead){ showToast('error', '❌ الـ Lead غير موجود'); return; }

  // 1. إيجاد أو إنشاء عميل
  let pat = DB.get('patients').find(p => (lead.phone && p.phone === lead.phone) || p.name === lead.name);
  if(!pat){
    pat = DB.push('patients', {
      name: lead.name, phone: lead.phone || '', email: '', gender: 'أنثى',
      skin: '', hair: '', skinProbs: '', hairProbs: '', allergies: '',
      pregnancy: 'لا', meds: '', source: lead.source || 'Lead', branch: '',
      status: 'نشط', sessions: 0, spent: 0, balance: 0,
      loyaltyPoints: 0, creditBalance: 0, outstandingBalance: 0, isVIP: false,
    });
    showToast('info', `👤 تم إنشاء ملف عميل جديد لـ ${lead.name}`);
  }

  // 2. إنشاء موعد بالخدمة المختارة فعلياً من المستخدم (مفيش fallback عشوائي)
  const svc = DB.get('services').find(s => s.id === svcId);
  if(!svc){ showToast('warning', '⚠️ اختر خدمة صحيحة للموعد'); return; }
  DB.push('appointments', {
    patId: pat.id, patient: pat.name,
    serviceId: svc.id, service: svc.name,
    type: 'كشف', doctor: svc.doctor || '', doctorId: svc.doctorId || '',
    date: apptDate, time: apptTime, status: 'مؤكد',
    branch: pat.branch || '',
    notes: `محوّل من Lead${extraNotes ? ' — ' + extraNotes : (lead.notes ? ' — ' + lead.notes : '')}`,
  });

  // 3. تحديث حالة الـ Lead
  DB.upd('leads', leadId, {
    status: 'تم التحويل',
    convertedPatId: pat.id,
    convertedAt: new Date().toISOString(),
  });

  closeModal('lead-convert-modal');
  showToast('success', `✅ تم تحويل ${lead.name} إلى عميل وموعد`, `📅 ${apptDate} — راجع شاشة المواعيد لتأكيد الوقت`);
  // renderLeads() يُستدعى تلقائياً عبر leads:updated
}

// ══════════════════════════════════════════
// 💬 WHATSAPP — ربط حقيقي بالمرضى
// ══════════════════════════════════════════
let _waSelectedPat = null;

function renderWA(){
  renderWAContacts('');
}

function renderWAContacts(q){
  const c = document.getElementById('wa-contacts'); if(!c) return;
  const pats = DB.get('patients').filter(p =>
    !q || p.name.includes(q) || (p.phone && p.phone.includes(q))
  );
  if(!pats.length){
    c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">لا يوجد عملاء</div>';
    return;
  }
  const today = new Date().toISOString().split('T')[0];
  c.innerHTML = pats.map((p, i) => {
    const nextAppt = DB.get('appointments')
      .filter(a => a.patient === p.name && a.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const hasPhone = p.whatsapp || p.phone;
    return `<div class="appt-item" style="padding:11px 14px;cursor:pointer;border-right:3px solid ${_waSelectedPat?.id === p.id ? 'var(--teal)' : 'transparent'};transition:all .15s" onclick="selectWAPat('${p.id}')">
      <div class="appt-ava" style="background:${AVA[i % AVA.length]};font-size:14px">${genderAva(p.gender)}</div>
      <div class="appt-info" style="flex:1">
        <p style="font-size:13px">${escapeHtml(p.name)}</p>
        <span style="font-size:11px">${hasPhone ? '📱 ' + escapeHtml(hasPhone) : '❌ لا يوجد رقم'}</span>
      </div>
      ${nextAppt ? `<div style="font-size:10px;color:var(--teal);text-align:left">${escapeHtml(nextAppt.date)}<br>${escapeHtml(nextAppt.time)}</div>` : ''}
    </div>`;
  }).join('');
}

function selectWAPat(id){
  _waSelectedPat = DB.get('patients').find(p => p.id == id);
  if(!_waSelectedPat) return;
  const nameEl  = document.getElementById('wa-selected-name');
  const phoneEl = document.getElementById('wa-selected-phone');
  if(nameEl)  nameEl.textContent  = _waSelectedPat.name;
  if(phoneEl) phoneEl.textContent = '📱 ' + (_waSelectedPat.whatsapp || _waSelectedPat.phone || 'لا يوجد رقم');
  renderWAContacts(document.getElementById('wa-search')?.value || '');
  renderWATemplates();
}

function renderWATemplates(){
  const tpl = document.getElementById('wa-quick-templates');
  if(!tpl || !_waSelectedPat) return;
  const p           = _waSelectedPat;
  const clinicName  = DB.obj('settings').clinicName || 'عيادات الحياة للتجميل';
  const today       = new Date().toISOString().split('T')[0];
  const nextAppt    = DB.get('appointments')
    .filter(a => a.patient === p.name && a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const balance = p.balance || 0;

  const templates = [
    {
      icon: '📅', title: 'تذكير موعد',
      msg: nextAppt
        ? `مرحباً ${p.name} 😊\nنذكرك بموعدك في ${clinicName}\n📅 التاريخ: ${nextAppt.date}\n⏰ الوقت: ${nextAppt.time}\n💆 الخدمة: ${nextAppt.service || '—'}\n\nنتطلع لرؤيتك 💎`
        : 'لا يوجد موعد قادم',
    },
    {
      icon: '💳', title: 'تذكير دفعة',
      msg: balance > 0
        ? `مرحباً ${p.name}\nنود تذكيرك بأن لديك رصيد مستحق قدره ${balance.toLocaleString()} ج\nنرجو التواصل معنا لترتيب السداد 📞\n${clinicName}`
        : 'لا يوجد رصيد مستحق',
    },
    {
      icon: '🎉', title: 'عرض خاص',
      msg: `مرحباً ${p.name} 🌟\nعندنا عرض حصري لعملائنا المميزين!\nتواصلي معنا لمعرفة التفاصيل 💎\n${clinicName}`,
    },
    {
      icon: '⭐', title: 'طلب تقييم',
      msg: `مرحباً ${p.name}\nشكراً لزيارتك ${clinicName} 💎\nنتمنى أن تكوني راضية عن خدماتنا\nيسعدنا تقييمك لمساعدتنا على التطور 🙏`,
    },
    {
      icon: '🎂', title: 'تهنئة',
      msg: `مرحباً ${p.name} 🎂\nفريق ${clinicName} يهنئك بمناسبة عيد ميلادك\nنتمنى لك عاماً مليئاً بالصحة والسعادة 💝`,
    },
  ];

  tpl.style.display = 'flex';
  tpl.innerHTML = templates.map((t, i) => `
    <div style="background:var(--glass);border:1px solid var(--glass-border);border-radius:${i === 0 ? '14px' : 'var(--radius-sm)'};padding:14px;cursor:pointer;transition:all .18s;"
      onmouseover="this.style.borderColor='rgba(45,212,191,.4)'"
      onmouseout="this.style.borderColor='var(--glass-border)'"
      onclick="sendWAMsg('${encodeURIComponent(t.msg)}')">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-weight:700;font-size:13px;">${t.icon} ${t.title}</div>
        <button class="btn btn-teal btn-xs">فتح واتساب ↗</button>
      </div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.6;white-space:pre-line;">${t.msg}</div>
    </div>`).join('');

  const introEl = document.querySelector('#wa-templates > div');
  if(introEl) introEl.style.display = 'none';
}

function getWAPhone(p){
  if(!p) return null;
  let ph = (p.whatsapp || p.phone || '').replace(/[\s\-\(\)]/g, '');
  if(!ph) return null;
  if(ph.startsWith('0')) ph = '2' + ph; // Egypt: 01xx → 201xx
  if(!ph.startsWith('+')) ph = '+' + ph;
  return ph;
}

function sendWAMsg(encodedMsg){
  if(!_waSelectedPat){ showToast('warning', '⚠️ اختر عميلاً أولاً'); return; }
  const phone = getWAPhone(_waSelectedPat);
  if(!phone){ showToast('error', '❌ لا يوجد رقم واتساب لهذا العميل'); return; }
  const msg = decodeURIComponent(encodedMsg);
  const url = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
  showToast('success', `✅ فُتح واتساب لـ ${_waSelectedPat.name}`);
}

function sendWACustom(){
  const msg = document.getElementById('wa-custom-msg')?.value?.trim();
  if(!msg){ showToast('warning', '⚠️ اكتب رسالة أولاً'); return; }
  if(!_waSelectedPat){ showToast('warning', '⚠️ اختر عميلاً أولاً'); return; }
  sendWAMsg(encodeURIComponent(msg));
}

function sendWAReminder(){
  if(!_waSelectedPat){ showToast('warning', '⚠️ اختر عميلاً أولاً'); return; }
  const p    = _waSelectedPat;
  const today = new Date().toISOString().split('T')[0];
  const nextAppt = DB.get('appointments')
    .filter(a => a.patient === p.name && a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if(!nextAppt){ showToast('warning', '⚠️ لا يوجد موعد قادم لهذا العميل'); return; }
  const clinicName = DB.obj('settings').clinicName || 'عيادات الحياة للتجميل';
  const msg = `مرحباً ${p.name} 😊\nنذكرك بموعدك في ${clinicName}\n📅 التاريخ: ${nextAppt.date}\n⏰ الوقت: ${nextAppt.time}\n💆 الخدمة: ${nextAppt.service || '—'}\n\nنتطلع لرؤيتك 💎`;
  sendWAMsg(encodeURIComponent(msg));
}

function sendWABalance(){
  if(!_waSelectedPat){ showToast('warning', '⚠️ اختر عميلاً أولاً'); return; }
  const p = _waSelectedPat;
  if(!(p.balance > 0)){ showToast('info', 'ℹ️ لا يوجد رصيد مستحق لهذا العميل'); return; }
  const clinicName = DB.obj('settings').clinicName || 'عيادات الحياة للتجميل';
  const msg = `مرحباً ${p.name}\nنود تذكيرك بأن لديك رصيد مستحق قدره ${p.balance.toLocaleString()} ج\nنرجو التواصل معنا لترتيب السداد 📞\n${clinicName}`;
  sendWAMsg(encodeURIComponent(msg));
}

function sendBulkWAReminders(){
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const appts = DB.get('appointments').filter(a => a.date === tomorrow && a.status === 'مؤكد');
  if(!appts.length){ showToast('info', 'ℹ️ لا توجد مواعيد غداً'); return; }
  const clinicName = DB.obj('settings').clinicName || 'عيادات الحياة للتجميل';
  let sent = 0;
  appts.forEach(appt => {
    const pat   = DB.get('patients').find(p => p.name === appt.patient);
    const phone = getWAPhone(pat);
    if(!phone) return;
    const msg = `مرحباً ${appt.patient} 😊\nنذكرك بموعدك غداً في ${clinicName}\n⏰ الوقت: ${appt.time}\n💆 الخدمة: ${appt.service || '—'}\n💎 في انتظارك`;
    window.open(`https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(msg)}`, '_blank');
    sent++;
  });
  showToast('success', `✅ تم فتح ${sent} نافذة واتساب`, 'تأكد من السماح بفتح النوافذ المنبثقة');
}

// ══════════════════════════════════════════
// 📣 CAMPAIGNS SCREEN
// ══════════════════════════════════════════

// بيانات أولية للحملات إن لم توجد
// _initCampaignsSeed أُزيلت — لا بيانات وهمية، الشاشة تعرض empty state حقيقي

const CAMP_COLORS = { 'نشطة': 'kc-teal', 'منتهية': 'kc-rose', 'مجدولة': 'kc-amber' };
const CHAN_ICONS  = { 'إنستجرام': '📸', 'فيسبوك': '👥', 'واتساب': '💬', 'SMS': '📱', 'إيميل': '📧', 'جوجل': '🔍' };

let _campSearch = '';

function renderCampaigns(q){
  // ✅ FIX (فقدان فلتر البحث): لو الشاشة بتتحدث تلقائياً من EventBus بدون
  // تمرير q (مثلاً بعد إضافة/تعديل حملة)، كنا بنصفّر الفلتر فعلياً بينما
  // صندوق البحث في الشاشة لسه عارض النص القديم. دلوقتي نحتفظ بآخر نص بحث
  // في متغير ونعيد مزامنة الـ input معه عند كل render.
  if(q !== undefined) _campSearch = q;
  const searchInput = document.querySelector('#screen-campaigns input[type="text"]');
  if(searchInput && searchInput.value !== _campSearch) searchInput.value = _campSearch;

  const stFilter = document.getElementById('camp-status-filter')?.value || '';
  let camps = DB.get('campaigns');
  if(_campSearch) camps = camps.filter(c => c.name.includes(_campSearch));
  if(stFilter)    camps = camps.filter(c => c.status === stFilter);

  // ✅ FIX (ربط حقيقي): leadsCount/converted بيُحسبوا من جدول leads
  // الفعلي (campLeadStats) بدل القيم اليدوية المخزّنة على الحملة.
  const all = DB.get('campaigns');
  const allStats = all.map(c => campLeadStats(c.id));
  txt('camp-kpi-active',     all.filter(c => c.status === 'نشطة').length);
  txt('camp-kpi-budget',     all.reduce((s, c) => s + (c.budget || 0), 0).toLocaleString() + ' ج');
  const totalLeads = allStats.reduce((s, st) => s + st.leadsCount, 0);
  const totalConv  = allStats.reduce((s, st) => s + st.converted, 0);
  txt('camp-kpi-leads',      totalLeads);
  txt('camp-kpi-conversion', totalLeads ? Math.round(totalConv / totalLeads * 100) + '%' : '0%');

  const grid = document.getElementById('camp-grid'); if(!grid) return;
  grid.innerHTML = camps.map(c => {
    const st = campLeadStats(c.id);
    const conv = st.leadsCount ? Math.round(st.converted / st.leadsCount * 100) : 0;
    return `<div class="kpi-card ${CAMP_COLORS[c.status] || 'kc-purple'}" style="padding:18px;cursor:pointer;">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px;">
        <span style="font-size:18px">${CHAN_ICONS[c.channel] || '📣'}</span>
        <span class="ast ${c.status === 'نشطة' ? 'sc' : c.status === 'مجدولة' ? 'sp' : 'sd'}">${escapeHtml(c.status)}</span>
      </div>
      <div style="font-size:14px;font-weight:800;margin-bottom:6px;">${escapeHtml(c.name)}</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px;">${escapeHtml(c.startDate)} ← ${escapeHtml(c.endDate)}</div>
      <div class="g2c" style="gap:8px;margin-bottom:12px;">
        <div style="text-align:center;background:var(--glass);border-radius:8px;padding:8px;">
          <div style="font-size:17px;font-weight:800;color:var(--teal)">${st.leadsCount}</div>
          <div style="font-size:10px;color:var(--text-muted)">Leads</div>
        </div>
        <div style="text-align:center;background:var(--glass);border-radius:8px;padding:8px;">
          <div style="font-size:17px;font-weight:800;color:var(--emerald)">${conv}%</div>
          <div style="font-size:10px;color:var(--text-muted)">تحويل</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;">
        <span style="color:var(--text-muted)">الميزانية:</span>
        <span style="font-weight:700;color:var(--gold-light)">${(c.budget || 0).toLocaleString()} ج</span>
      </div>
      <div style="display:flex;gap:7px;">
        <button class="btn btn-ghost btn-sm"   style="flex:1;font-size:11px" onclick="openCampaignModal('${c.id}')">✏️ تعديل</button>
        <button class="btn btn-danger btn-sm"  style="font-size:11px"        onclick="delCampaign('${c.id}')">🗑</button>
      </div>
    </div>`;
  }).join('') || `<div class="card" style="text-align:center;padding:48px 24px;color:var(--text-muted);">
      <div style="font-size:40px;margin-bottom:12px;">📣</div>
      <div style="font-size:15px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">لا توجد حملات تسويقية بعد</div>
      <div style="font-size:13px;margin-bottom:20px;">أنشئ أول حملة لتتبع الليدز والميزانية ومعدل التحويل</div>
      <button class="btn btn-teal btn-sm" onclick="openCampaignModal()">+ حملة جديدة</button>
    </div>`;
}

function openCampaignModal(id){
  const c = id ? (DB.get('campaigns') || []).find(x => x.id === id) : null;
  const titleEl = document.getElementById('camp-modal-title');
  if(titleEl) titleEl.textContent = c ? '✏️ تعديل الحملة' : '📣 حملة جديدة';
  const fields = ['id','name','channel','goal','budget','status','desc'];
  fields.forEach(f => {
    const el = document.getElementById('camp-' + f); if(!el) return;
    if(f === 'channel' && !c)      el.value = 'إنستجرام';
    else if(f === 'goal' && !c)    el.value = 'زيادة الحجوزات';
    else if(f === 'status' && !c)  el.value = 'مجدولة';
    else if(f === 'budget' && !c)  el.value = '';
    else if(f === 'desc' && !c)    el.value = '';
    else if(f === 'id')            el.value = c ? c.id : '';
    else                           el.value = c ? (c[f] || '') : '';
  });
  const startEl  = document.getElementById('camp-start');
  const endEl    = document.getElementById('camp-end');
  const leadsEl  = document.getElementById('camp-leads-count');
  if(startEl) startEl.value = c ? c.startDate || '' : new Date().toISOString().split('T')[0];
  if(endEl)   endEl.value   = c ? c.endDate   || '' : '';
  // ✅ الحقل دلوقتي للعرض فقط — رقم حقيقي محسوب من leads المرتبطة، مش إدخال يدوي
  if(leadsEl) leadsEl.value = c ? campLeadStats(c.id).leadsCount : 0;
  openModal('campaign-modal');
}

function saveCampaign(){
  const name = gv('camp-name').trim();
  if(!name){ showToast('warning', '⚠️ اسم الحملة مطلوب'); return; }
  const id = gv('camp-id');
  const data = {
    name,
    channel:    gv('camp-channel'),
    goal:       gv('camp-goal'),
    budget:     parseFloat(gv('camp-budget'))     || 0,
    startDate:  gv('camp-start'),
    endDate:    gv('camp-end'),
    status:     gv('camp-status'),
    desc:       gv('camp-desc'),
  };
  if(id){
    DB.upd('campaigns', id, data);
    showToast('success', `✅ تم تحديث ${name}`);
  } else {
    DB.push('campaigns', data);
    showToast('success', `✅ تم إضافة حملة "${name}"`);
  }
  closeModal('campaign-modal');
  // renderCampaigns() يُستدعى تلقائياً عبر campaigns:created / campaigns:updated
}

function delCampaign(id){
  const c = (DB.get('campaigns') || []).find(x => x.id === id);
  if(confirm(`حذف حملة "${c?.name}"؟`)){
    DB.del('campaigns', id);
    showToast('info', '🗑 تم الحذف');
    // renderCampaigns() يُستدعى تلقائياً عبر campaigns:deleted
  }
}
