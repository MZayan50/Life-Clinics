// ══════════════════════════════════════════════════════════════════
// 👥 PATIENTS MODULE — v4.0 (Event-Driven)
// ══════════════════════════════════════════════════════════════════
// التغييرات من v3 → v4:
//  1. EventBus listeners لتحديث الواجهة تلقائياً
//  2. savePat / delPat — حُذفت renderPat() اليدوية
// ══════════════════════════════════════════════════════════════════

// ── ربط EventBus ──
EventBus.on('patients:created', () => { if(window.renderPat) renderPat(); });
EventBus.on('patients:updated', () => { if(window.renderPat) renderPat(); });
EventBus.on('patients:deleted', () => { if(window.renderPat) renderPat(); });

const AVA = ['linear-gradient(135deg,#8B5CF6,#3B82F6)','linear-gradient(135deg,#10B981,#2DD4BF)','linear-gradient(135deg,#F59E0B,#EF4444)','linear-gradient(135deg,#C4A882,#8B5CF6)','linear-gradient(135deg,#F43F5E,#8B5CF6)'];
function genderAva(g){ return g==='ذكر'?'👦':'👧'; }
let _pf='', _ps='';
function filterPat(q){ _pf=q; renderPat(); }
function filterPatSt(s){ _ps=s; renderPat(); }

function renderPat(){
  const pats = DB.get('patients').filter(p => (!_pf||(p.name.includes(_pf)||p.phone.includes(_pf))) && (!_ps||p.status===_ps));
  const tb = document.getElementById('pat-tbody'); if(!tb) return;
  const lbl = document.getElementById('pat-count-lbl'); if(lbl) lbl.textContent=`${pats.length} عميل`;
  tb.innerHTML = pats.map((p,i) => `<tr onclick="viewPat('${p.id}')" style="cursor:pointer">
    <td><div style="display:flex;align-items:center;gap:9px;">
      <div class="tdava" style="background:${AVA[i%AVA.length]}">${genderAva(p.gender)}</div>
      <div><div style="font-weight:600">${p.name}</div><div style="font-size:11px;color:var(--text-muted)">#C${String(i+1).padStart(3,'0')}</div></div>
    </div></td>
    <td>${p.phone}</td>
    <td><span class="tag tg-gold">${p.skin}</span></td>
    <td style="color:var(--text-muted);font-size:12px">اليوم</td>
    <td><span style="font-weight:700;color:var(--teal)">${p.sessions||0}</span></td>
    <td style="color:${(p.balance||0)>0?'var(--rose)':'var(--emerald)'};font-weight:700">${(p.balance||0).toLocaleString()} ج</td>
    <td><span class="ast ${p.status==='نشط'?'sc':p.status==='قسط'?'sp':'sd'}">${p.status}</span></td>
    <td>
      <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();viewPat('${p.id}')">عرض</button>
      <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openPatModal('${p.id}')">✏️</button>
      <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();delPat('${p.id}')">🗑</button>
    </td>
  </tr>`).join('');
  txt('badge-patients', DB.get('patients').length);
  txt('kpi-pat', DB.get('patients').length);
}

function openPatWA(){
  const p = DB.get('patients').find(x => x.id == window._curPat);
  if(!p){ showToast('error','❌ لا يوجد عميل محدد'); return; }
  _waSelectedPat = p;
  showScreen('whatsapp');
  renderWAContacts('');
  selectWAPat(p.id);
}

function viewPat(id){
  const p = DB.get('patients').find(x => x.id == id); if(!p) return;
  window._curPat = id;
  const phEl = document.getElementById('pp-photo'); if(phEl) phEl.textContent = genderAva(p.gender);
  txt('pp-name', p.name);
  txt('pp-contact', `📞 ${p.phone}${p.email?' · 📧 '+p.email:''}`);
  txt('pp-meta', `مصدر: ${p.source||'—'} · فرع: ${p.branch||'—'}${p.dob?' · '+age(p.dob)+' سنة':''}`);
  txt('pp-sessions', p.sessions||0);
  txt('pp-spent', (p.spent||0).toLocaleString()+' ج');
  const balEl = document.getElementById('pp-balance');
  if(balEl){ balEl.textContent=(p.balance||0).toLocaleString()+' ج'; balEl.style.color=(p.balance||0)>0?'var(--rose)':'var(--emerald)'; }
  const patSessions = DB.get('sessions').filter(s => s.patId===id);
  const patPackages = DB.get('packages').filter(pk => pk.patId===id);
  txt('pp-plans', patSessions.length+patPackages.length);
  txt('pp-sessions', p.sessions||patSessions.reduce((s,x)=>s+(x.done||0),0));
  // Pre-render sessions tab
  const sessCont = document.getElementById('pp-sessions-content');
  if(sessCont){
    if(!patSessions.length && !patPackages.length){
      sessCont.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">لا توجد خطط جلسات بعد</div>';
    } else {
      sessCont.innerHTML = patSessions.map(s => {
        const done=s.done||0, total=s.total||1, pct=Math.round(done/total*100);
        const sessArr = Array.from({length:total},(_,i) => i<done
          ?`<span style="font-size:11.5px;padding:3px 9px;border-radius:20px;background:rgba(16,185,129,.13);color:var(--emerald)">✅ جلسة ${i+1}</span>`
          :`<span style="font-size:11.5px;padding:3px 9px;border-radius:20px;background:rgba(148,163,184,.1);color:var(--text-muted)">○ جلسة ${i+1}</span>`);
        return `<div style="background:rgba(45,212,191,.07);border:1px solid rgba(45,212,191,.2);border-radius:var(--radius-sm);padding:14px;margin-bottom:11px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;">
            <span style="font-weight:700">${s.type||'جلسات'} ${s.doc?'· د. '+s.doc:''}</span>
            <span style="color:var(--teal);font-weight:700">${done}/${total}</span>
          </div>
          <div class="prog"><div class="prog-f" style="width:${pct}%;background:var(--teal)"></div></div>
          <div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap;">${sessArr.join('')}</div>
          <div style="display:flex;gap:7px;margin-top:10px;">
            <button class="btn btn-teal btn-xs" onclick="addSessionProgress('${s.id}')">✅ تسجيل جلسة</button>
            <span class="ast ${s.status==='مكتملة'?'sc':s.status==='متوقفة'?'sx':'sp'}" style="margin-right:auto">${s.status}</span>
          </div>
        </div>`;
      }).join('')||'';
    }
  }
  // Pre-render packages
  const pkgCont = document.getElementById('pp-packages-content');
  if(pkgCont){
    pkgCont.innerHTML = patPackages.length ? patPackages.map(pk => {
      const remaining = Math.max(0,(pk.price||0)-(pk.paid||0));
      return `<div style="background:var(--glass);border:1px solid var(--glass-border);border-radius:var(--radius-sm);padding:13px;margin-bottom:9px;display:flex;justify-content:space-between;align-items:center;">
        <div><div style="font-weight:700">${pk.name}</div><div style="font-size:12px;color:var(--text-muted)">${pk.services||''} · ${pk.sessionsCount||0} جلسات</div></div>
        <div style="text-align:left">
          <div style="color:var(--gold-light);font-weight:700">${(pk.price||0).toLocaleString()} ج</div>
          ${remaining>0?`<div style="color:var(--rose);font-size:12px">متبقي: ${remaining.toLocaleString()} ج</div>`:''}
          <span class="ast ${pk.status==='نشطة'?'sc':'sd'}" style="font-size:10px">${pk.status}</span>
        </div>
      </div>`;
    }).join('') : '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">لا توجد باقات</div>';
  }
  const tg = document.getElementById('pp-tags');
  if(tg) tg.innerHTML = `<span class="tag tg-gold">${p.skin}</span><span class="tag tg-teal">${p.hair}</span>${p.allergies&&p.allergies!=='لا حساسية'?'<span class="tag tg-purple">⚠️ حساسية</span>':'<span class="tag tg-green">✅ لا حساسية</span>'}`;
  const sk = document.getElementById('med-skin');
  if(sk) sk.innerHTML = `<div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">النوع:</span><span class="tag tg-gold">${p.skin}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">المشاكل:</span><span>${p.skinProbs||'—'}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">الحساسية:</span><span>${p.allergies||'—'}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">الحمل:</span><span>${p.pregnancy||'—'}</span></div>`;
  const hr = document.getElementById('med-hair');
  if(hr) hr.innerHTML = `<div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">النوع:</span><span class="tag tg-teal">${p.hair}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">المشاكل:</span><span>${p.hairProbs||'—'}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">الأدوية:</span><span>${p.meds||'لا يوجد'}</span></div>`;
  const pinv = DB.get('invoices').filter(i => String(i.patId)===String(id)||(i.patId===undefined&&i.patient===p.name));
  const pitb = document.getElementById('p-inv-tbody');
  if(pitb) pitb.innerHTML = pinv.map(i => `<tr><td style="font-size:12px">${i.date}</td><td>${i.service}</td><td style="font-weight:700">${i.total} ج</td><td>${i.method}</td><td><span class="ast ${i.status==='مدفوع'?'sc':'sp'}">${i.status}</span></td><td><button class="btn btn-teal btn-xs" onclick="sendInvoiceWA('${i.id}')" title="إرسال عبر واتساب">💬</button></td></tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">لا توجد فواتير</td></tr>';
  showScreen('patient-profile');
}

function age(d){ return d ? Math.floor((Date.now()-new Date(d))/(365.25*24*3600*1000)) : 0; }

function delPat(id){
  if(confirm('حذف العميل؟')){
    DB.del('patients', id);
    // لا داعي لـ renderPat() — EventBus يتولى ذلك
    showToast('info','🗑️ تم حذف العميل');
  }
}
function deleteCurrentPat(){ if(window._curPat){ delPat(window._curPat); showScreen('patients'); } }

function exportPat(){
  const patients = DB.get('patients');
  if(!patients.length){ showToast('warning','⚠️ لا توجد بيانات للتصدير'); return; }
  const headers = ['الاسم','الهاتف','البريد','نوع البشرة','نوع الشعر','المشاكل الجلدية','الحساسية','المصدر','الفرع','الحالة','الجلسات','الإنفاق (ج)','المديونية (ج)'];
  const rows = patients.map(p => [
    p.name||'',p.phone||'',p.email||'',p.skin||'',p.hair||'',
    p.skinProbs||'',p.allergies||'',p.source||'',p.branch||'',
    p.status||'',p.sessions||0,p.spent||0,p.balance||0
  ]);
  const csvContent = [headers,...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom+csvContent],{type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `عملاء-${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.csv`;
  a.click();
  showToast('success',`✅ تم تصدير ${patients.length} عميل`,`افتح الملف بـ Excel`);
}

function exportInvoices(){
  const invoices = DB.get('invoices');
  if(!invoices.length){ showToast('warning','⚠️ لا توجد فواتير للتصدير'); return; }
  const headers = ['#','العميل','التاريخ','الخدمة','الإجمالي (ج)','المدفوع (ج)','المتبقي (ج)','طريقة الدفع','الحالة'];
  const rows = invoices.map((inv,i) => [
    `INV-${String(i+1).padStart(3,'0')}`,inv.patient||'',inv.date||'',
    inv.service||'',inv.total||0,inv.paid||0,inv.remaining||0,
    inv.method||'',inv.status||''
  ]);
  const bom = '\uFEFF';
  const csvContent = [headers,...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([bom+csvContent],{type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `فواتير-${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.csv`;
  a.click();
  showToast('success',`✅ تم تصدير ${invoices.length} فاتورة`);
}

function printProfile(){
  const id = window._curPat;
  if(!id){ showToast('error','❌ لا يوجد عميل محدد'); return; }
  const p = DB.get('patients').find(x => x.id==id);
  if(!p){ showToast('error','❌ لم يُعثر على العميل'); return; }
  const invs     = DB.get('invoices').filter(i => String(i.patId)===String(id)||(i.patId===undefined&&i.patient===p.name));
  const sessions = DB.get('sessions').filter(s => s.patId===id);
  const packages = DB.get('packages').filter(pk => pk.patId===id);
  const clinicName  = DB.obj('settings').clinicName || 'عيادات الحياة للتجميل';
  const clinicPhone = DB.obj('settings').phone || '';
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><title>ملف العميل - ${p.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Tajawal',sans-serif;background:#fff;color:#1a1a1a;padding:28px;font-size:13px;}
  .header{display:flex;justify-content:space-between;align-items:start;border-bottom:3px solid #C4A882;padding-bottom:16px;margin-bottom:18px;}
  .logo{font-size:20px;font-weight:900;color:#C4A882;}
  h2{font-size:15px;font-weight:800;color:#1a1a1a;margin-bottom:10px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:18px;}
  .section{background:#f9f6f2;border-radius:10px;padding:14px;}
  .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:13px;}
  .row:last-child{border:none;}
  .row span{color:#666;}
  table{width:100%;border-collapse:collapse;margin-bottom:14px;}
  th{background:#f0ece6;padding:8px 10px;text-align:right;font-size:11.5px;font-weight:700;color:#666;border-bottom:2px solid #C4A882;}
  td{padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;}
  .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;}
  .badge-green{background:#dcfce7;color:#166534;}
  .badge-yellow{background:#fef9c3;color:#713f12;}
  .footer{text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:14px;margin-top:20px;}
  @media print{body{padding:12px;}}
</style>
</head>
<body>
<div class="header">
  <div style="display:flex;align-items:center;gap:10px;"><div>${clinicLogoHTML(38)}</div><div><div class="logo">${clinicName}</div><div style="color:#666;font-size:12px;margin-top:3px;">📞 ${clinicPhone}</div></div></div>
  <div style="text-align:left;font-size:12px;color:#666;">ملف العميل<br><strong>#C${String(DB.get('patients').findIndex(x=>x.id==id)+1).padStart(3,'0')}</strong><br>${new Date().toLocaleDateString('ar-EG')}</div>
</div>
<h2>👤 البيانات الشخصية</h2>
<div class="grid2">
  <div class="section">
    <div class="row"><span>الاسم:</span><strong>${p.name}</strong></div>
    <div class="row"><span>الهاتف:</span><span>${p.phone}</span></div>
    <div class="row"><span>البريد:</span><span>${p.email||'—'}</span></div>
    <div class="row"><span>الفرع:</span><span>${p.branch||'—'}</span></div>
    <div class="row"><span>المصدر:</span><span>${p.source||'—'}</span></div>
    <div class="row"><span>الحالة:</span><span>${p.status||'—'}</span></div>
  </div>
  <div class="section">
    <div class="row"><span>نوع البشرة:</span><span>${p.skin||'—'}</span></div>
    <div class="row"><span>مشاكل البشرة:</span><span>${p.skinProbs||'لا يوجد'}</span></div>
    <div class="row"><span>نوع الشعر:</span><span>${p.hair||'—'}</span></div>
    <div class="row"><span>الحساسية:</span><span>${p.allergies||'لا حساسية'}</span></div>
    <div class="row"><span>أدوية:</span><span>${p.meds||'لا يوجد'}</span></div>
    <div class="row"><span>الحمل:</span><span>${p.pregnancy||'—'}</span></div>
  </div>
</div>
<div class="grid2" style="margin-bottom:18px;">
  <div class="section" style="text-align:center;"><div style="font-size:24px;font-weight:900;color:#C4A882">${(p.spent||0).toLocaleString()} ج</div><div style="color:#666;font-size:12px">إجمالي الإنفاق</div></div>
  <div class="section" style="text-align:center;"><div style="font-size:24px;font-weight:900;color:${(p.balance||0)>0?'#dc2626':'#166534'}">${(p.balance||0).toLocaleString()} ج</div><div style="color:#666;font-size:12px">المديونية</div></div>
</div>
${invs.length?`<h2>🧾 الفواتير (${invs.length})</h2>
<table><thead><tr><th>التاريخ</th><th>الخدمة</th><th>الإجمالي</th><th>المدفوع</th><th>الحالة</th></tr></thead>
<tbody>${invs.map(i=>`<tr><td>${i.date}</td><td>${i.service}</td><td>${i.total} ج</td><td>${i.paid} ج</td><td><span class="badge ${i.status==='مدفوع'?'badge-green':'badge-yellow'}">${i.status}</span></td></tr>`).join('')}</tbody>
</table>`:''}
${sessions.length?`<h2>✨ خطط الجلسات (${sessions.length})</h2>
<table><thead><tr><th>نوع العلاج</th><th>الطبيب</th><th>المنجز</th><th>الكلي</th><th>الحالة</th></tr></thead>
<tbody>${sessions.map(s=>`<tr><td>${s.type}</td><td>${s.doc||'—'}</td><td>${s.done||0}</td><td>${s.total}</td><td>${s.status}</td></tr>`).join('')}</tbody>
</table>`:''}
<div class="footer">طُبع في: ${new Date().toLocaleString('ar-EG')} | ${clinicName}</div>
</body></html>`;
  const patFileName = `ملف-${p.name.replace(/\s+/g,'-')}-${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.pdf`;
  const toolbar = `<div id="prof-toolbar" style="position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:3px solid #C4A882;padding:12px 20px;display:flex;gap:10px;justify-content:center;align-items:center;z-index:9999;font-family:'Tajawal',sans-serif;">
    <button id="prof-pdf-btn" onclick="downloadProfPDF()" style="padding:9px 26px;background:#1a6dcc;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Tajawal',sans-serif;">📄 تحميل PDF</button>
    <button onclick="window.print()" style="padding:9px 22px;background:#C4A882;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Tajawal',sans-serif;">🖨 طباعة</button>
    <button onclick="window.close()" style="padding:9px 22px;background:#eee;color:#333;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Tajawal',sans-serif;">✕ إغلاق</button>
  </div>
  <div style="height:70px"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
  <script>
  function downloadProfPDF(){
    var btn=document.getElementById('prof-pdf-btn');
    btn.textContent='⏳ جارٍ التحميل...'; btn.disabled=true;
    var tb=document.getElementById('prof-toolbar');
    tb.style.display='none';
    html2pdf().set({
      margin:[8,8,8,8],
      filename:'${patFileName}',
      image:{type:'jpeg',quality:0.97},
      html2canvas:{scale:2,useCORS:true},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    }).from(document.body).save().then(function(){
      tb.style.display='flex';
      btn.textContent='📄 تحميل PDF'; btn.disabled=false;
    });
  }
  <\/script>`;

  const fullHtml = html.replace('</body>', toolbar + '</body>');
  const w = window.open('','_blank','width=900,height=750');
  if(!w){ showToast('error','❌ السماح بفتح النوافذ المنبثقة مطلوب'); return; }
  w.document.write(fullHtml);
  w.document.close();
}

// ══════════════════════════════════════════
// SAVE / OPEN PATIENT MODAL
// ══════════════════════════════════════════
function openPatModal(id){
  const p = id ? DB.get('patients').find(x => String(x.id)===String(id)) : null;
  document.getElementById('pat-modal-title').textContent = p ? '✏️ تعديل عميل' : '👥 عميل جديد';
  document.getElementById('pm-id').value = p ? p.id : '';
  const fields = {
    'pm-name':p?.name||'','pm-phone':p?.phone||'','pm-email':p?.email||'',
    'pm-skin':p?.skin||'','pm-hair':p?.hair||'','pm-skinp':p?.skinProbs||'',
    'pm-hairp':p?.hairProbs||'','pm-allergy':p?.allergies||'','pm-preg':p?.pregnancy||'لا',
    'pm-meds':p?.meds||'','pm-src':p?.source||'','pm-branch':p?.branch||'',
    'pm-status':p?.status||'نشط','pm-dob':p?.dob||'','pm-job':p?.job||'','pm-wa':p?.whatsapp||''
  };
  Object.entries(fields).forEach(([id,val]) => { const el=document.getElementById(id); if(el) el.value=val; });
  const genderEl = document.getElementById('pm-gender'); if(genderEl) genderEl.value = p?.gender||'أنثى';
  openModal('patient-modal');
}

function savePat(){
  const name  = gv('pm-name').trim();
  const phone = gv('pm-phone').trim();
  if(!name||!phone){ showToast('warning','⚠️ الاسم والهاتف مطلوبان'); return; }
  const id   = gv('pm-id');
  const data = {
    name, phone, email:gv('pm-email'), gender:gv('pm-gender')||'أنثى',
    skin:gv('pm-skin'), hair:gv('pm-hair'), skinProbs:gv('pm-skinp'), hairProbs:gv('pm-hairp'),
    allergies:gv('pm-allergy'), pregnancy:gv('pm-preg'), meds:gv('pm-meds'),
    source:gv('pm-src'), branch:gv('pm-branch'), status:gv('pm-status'),
    dob:gv('pm-dob'), job:gv('pm-job'), whatsapp:gv('pm-wa')
  };
  if(id){
    const old = DB.get('patients').find(p => p.id===id);
    DB.upd('patients', id, data);
    // cascade: لو الاسم اتغير، حدّث appointments + invoices
    if(old && old.name !== name){
      DB.get('appointments').filter(a => a.patId===id||a.patient===old.name).forEach(a => DB.upd('appointments',a.id,{patient:name}));
      DB.get('invoices').filter(i => i.patId===id||i.patient===old.name).forEach(i => DB.upd('invoices',i.id,{patient:name}));
    }
    showToast('success', `✅ تم تحديث بيانات ${name}`);
  } else {
    DB.push('patients', {...data, sessions:0, spent:0, balance:0});
    showToast('success', `✅ تم إضافة ${name}`, `فرع: ${gv('pm-branch')}`);
  }
  // لا داعي لـ renderPat() — EventBus يتولى ذلك
  closeModal('patient-modal');
  ['pm-name','pm-phone','pm-email','pm-skinp','pm-hairp','pm-allergy','pm-meds','pm-job','pm-wa','pm-dob'].forEach(i => { const e=document.getElementById(i); if(e) e.value=''; });
}
