// LEADS KANBAN
const LCOLS=[{k:'جديد',b:'nb-teal'},{k:'تم التواصل',b:'nb-teal'},{k:'مهتم',b:'nb-amber'},{k:'غير مهتم',b:''},{k:'تم التحويل',b:'nb-green'}];
function renderLeads(){
  const kb=document.getElementById('leads-kanban');if(!kb)return;
  const leads=DB.get('leads');
  txt('badge-leads',leads.filter(l=>l.status==='جديد').length);
  const lbl=document.getElementById('leads-lbl');if(lbl)lbl.textContent=`${leads.length} lead`;
  kb.innerHTML=LCOLS.map(col=>{
    const items=leads.filter(l=>l.status===col.k);
    return `<div class="kcol"><div class="kcol-t"><span>${col.k}</span><span class="nb ${col.b}" style="font-size:10px;padding:2px 7px;">${items.length}</span></div>${items.map(l=>`<div class="lcard" onclick="moveLead('${l.id}')"><div class="lname">${l.name}</div><div class="lsvc">${l.service}</div><div class="ltime">📞 ${l.source}${l.notes?' · '+l.notes:''}</div></div>`).join('')}</div>`;
  }).join('');
}
function moveLead(id){
  const lead=DB.get('leads').find(l=>l.id==id);if(!lead)return;
  const idx=LCOLS.findIndex(c=>c.k===lead.status);
  const next=LCOLS[(idx+1)%LCOLS.length];
  DB.upd('leads',id,{status:next.k});renderLeads();showToast('info',`🎯 ${lead.name} → ${next.k}`);
}
function saveLead(){
  const name=gv('ld-name').trim();if(!name){showToast('warning','⚠️ الاسم مطلوب');return;}
  DB.push('leads',{name,phone:gv('ld-phone'),service:gv('ld-svc'),source:gv('ld-src'),notes:gv('ld-notes'),status:'جديد'});
  closeModal('lead-modal');showToast('success',`🎯 تم إضافة ${name} كـ Lead`);renderLeads();
  ['ld-name','ld-phone','ld-notes'].forEach(i=>{const e=document.getElementById(i);if(e)e.value='';});
}

// WHATSAPP DEMO
// ── WhatsApp real patient-linked implementation ──
let _waSelectedPat = null;

function renderWA(){
  renderWAContacts('');
}

function renderWAContacts(q){
  const c=document.getElementById('wa-contacts');if(!c)return;
  const pats=DB.get('patients').filter(p=>!q||(p.name.includes(q)||( p.phone&&p.phone.includes(q))));
  if(!pats.length){c.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">لا يوجد عملاء</div>';return;}
  c.innerHTML=pats.map((p,i)=>{
    const nextAppt=DB.get('appointments').filter(a=>a.patient===p.name&&a.date>=new Date().toISOString().split('T')[0]).sort((a,b)=>a.date.localeCompare(b.date))[0];
    const hasPhone=p.whatsapp||p.phone;
    return`<div class="appt-item" style="padding:11px 14px;cursor:pointer;border-right:3px solid ${_waSelectedPat?.id===p.id?'var(--teal)':'transparent'};transition:all .15s" onclick="selectWAPat('${p.id}')">
      <div class="appt-ava" style="background:${AVA[i%AVA.length]};font-size:14px">👩</div>
      <div class="appt-info" style="flex:1">
        <p style="font-size:13px">${p.name}</p>
        <span style="font-size:11px">${hasPhone?'📱 '+hasPhone:'❌ لا يوجد رقم'}</span>
      </div>
      ${nextAppt?`<div style="font-size:10px;color:var(--teal);text-align:left">${nextAppt.date}<br>${nextAppt.time}</div>`:''}
    </div>`;
  }).join('');
}

function selectWAPat(id){
  _waSelectedPat=DB.get('patients').find(p=>p.id==id);
  if(!_waSelectedPat)return;
  const nameEl=document.getElementById('wa-selected-name');
  const phoneEl=document.getElementById('wa-selected-phone');
  if(nameEl)nameEl.textContent=_waSelectedPat.name;
  if(phoneEl)phoneEl.textContent='📱 '+(  _waSelectedPat.whatsapp||_waSelectedPat.phone||'لا يوجد رقم');
  renderWAContacts(document.getElementById('wa-search')?.value||'');
  renderWATemplates();
}

function renderWATemplates(){
  const tpl=document.getElementById('wa-quick-templates');
  if(!tpl||!_waSelectedPat)return;
  const p=_waSelectedPat;
  const clinicName=DB.obj('settings').clinicName||'عيادات الحياة للتجميل';
  const nextAppt=DB.get('appointments').filter(a=>a.patient===p.name&&a.date>=new Date().toISOString().split('T')[0]).sort((a,b)=>a.date.localeCompare(b.date))[0];
  const balance=p.balance||0;

  const templates=[
    {icon:'📅',title:'تذكير موعد',msg:nextAppt?`مرحباً ${p.name} 😊\nنذكرك بموعدك في ${clinicName}\n📅 التاريخ: ${nextAppt.date}\n⏰ الوقت: ${nextAppt.time}\n💆 الخدمة: ${nextAppt.service||'—'}\n\nنتطلع لرؤيتك 💎`:'لا يوجد موعد قادم'},
    {icon:'💳',title:'تذكير دفعة',msg:balance>0?`مرحباً ${p.name}\nنود تذكيرك بأن لديك رصيد مستحق قدره ${balance.toLocaleString()} ج\nنرجو التواصل معنا لترتيب السداد 📞\n${clinicName}`:'لا يوجد رصيد مستحق'},
    {icon:'🎉',title:'عرض خاص',msg:`مرحباً ${p.name} 🌟\nعندنا عرض حصري لعملائنا المميزين!\nتواصلي معنا لمعرفة التفاصيل 💎\n${clinicName}`},
    {icon:'⭐',title:'طلب تقييم',msg:`مرحباً ${p.name}\nشكراً لزيارتك ${clinicName} 💎\nنتمنى أن تكوني راضية عن خدماتنا\nيسعدنا تقييمك لمساعدتنا على التطور 🙏`},
    {icon:'🎂',title:'تهنئة',msg:`مرحباً ${p.name} 🎂\nفريق ${clinicName} يهنئك بمناسبة عيد ميلادك\nنتمنى لك عاماً مليئاً بالصحة والسعادة 💝`},
  ];

  tpl.style.display='flex';
  tpl.innerHTML=templates.map((t,i)=>`
    <div style="background:var(--glass);border:1px solid var(--glass-border);border-radius:${i===0?'14px':'var(--radius-sm)'};padding:14px;cursor:pointer;transition:all .18s;"
     onmouseover="this.style.borderColor='rgba(45,212,191,.4)'" onmouseout="this.style.borderColor='var(--glass-border)'"
     onclick="sendWAMsg('${encodeURIComponent(t.msg)}')">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-weight:700;font-size:13px;">${t.icon} ${t.title}</div>
        <button class="btn btn-teal btn-xs">فتح واتساب ↗</button>
      </div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.6;white-space:pre-line;">${t.msg}</div>
    </div>`).join('');

  const introEl=document.querySelector('#wa-templates > div');
  if(introEl)introEl.style.display='none';
}

function getWAPhone(p){
  if(!p)return null;
  let ph=(p.whatsapp||p.phone||'').replace(/[\s\-\(\)]/g,'');
  if(!ph)return null;
  if(ph.startsWith('0'))ph='2'+ph; // Egypt: 01xx → 201xx
  if(!ph.startsWith('+'))ph='+'+ph;
  return ph;
}

function sendWAMsg(encodedMsg){
  if(!_waSelectedPat){showToast('warning','⚠️ اختر عميلاً أولاً');return;}
  const phone=getWAPhone(_waSelectedPat);
  if(!phone){showToast('error','❌ لا يوجد رقم واتساب لهذا العميل');return;}
  const msg=decodeURIComponent(encodedMsg);
  const url=`https://wa.me/${phone.replace('+','')}?text=${encodeURIComponent(msg)}`;
  window.open(url,'_blank');
  showToast('success',`✅ فُتح واتساب لـ ${_waSelectedPat.name}`);
}

function sendWACustom(){
  const msg=document.getElementById('wa-custom-msg')?.value?.trim();
  if(!msg){showToast('warning','⚠️ اكتب رسالة أولاً');return;}
  if(!_waSelectedPat){showToast('warning','⚠️ اختر عميلاً أولاً');return;}
  sendWAMsg(encodeURIComponent(msg));
}

function sendWAReminder(){
  if(!_waSelectedPat){showToast('warning','⚠️ اختر عميلاً أولاً');return;}
  const p=_waSelectedPat;
  const nextAppt=DB.get('appointments').filter(a=>a.patient===p.name&&a.date>=new Date().toISOString().split('T')[0]).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(!nextAppt){showToast('warning','⚠️ لا يوجد موعد قادم لهذا العميل');return;}
  const clinicName=DB.obj('settings').clinicName||'عيادات الحياة للتجميل';
  const msg=`مرحباً ${p.name} 😊\nنذكرك بموعدك في ${clinicName}\n📅 التاريخ: ${nextAppt.date}\n⏰ الوقت: ${nextAppt.time}\n💆 الخدمة: ${nextAppt.service||'—'}\n\nنتطلع لرؤيتك 💎`;
  sendWAMsg(encodeURIComponent(msg));
}

function sendWABalance(){
  if(!_waSelectedPat){showToast('warning','⚠️ اختر عميلاً أولاً');return;}
  const p=_waSelectedPat;
  if(!(p.balance>0)){showToast('info','ℹ️ لا يوجد رصيد مستحق لهذا العميل');return;}
  const clinicName=DB.obj('settings').clinicName||'عيادات الحياة للتجميل';
  const msg=`مرحباً ${p.name}\nنود تذكيرك بأن لديك رصيد مستحق قدره ${p.balance.toLocaleString()} ج\nنرجو التواصل معنا لترتيب السداد 📞\n${clinicName}`;
  sendWAMsg(encodeURIComponent(msg));
}

function sendBulkWAReminders(){
  const tomorrow=new Date(Date.now()+86400000).toISOString().split('T')[0];
  const appts=DB.get('appointments').filter(a=>a.date===tomorrow&&a.status==='مؤكد');
  if(!appts.length){showToast('info','ℹ️ لا توجد مواعيد غداً');return;}
  const clinicName=DB.obj('settings').clinicName||'عيادات الحياة للتجميل';
  let sent=0;
  appts.forEach(appt=>{
    const pat=DB.get('patients').find(p=>p.name===appt.patient);
    const phone=getWAPhone(pat);
    if(!phone)return;
    const msg=`مرحباً ${appt.patient} 😊\nنذكرك بموعدك غداً في ${clinicName}\n⏰ الوقت: ${appt.time}\n💆 الخدمة: ${appt.service||'—'}\n💎 في انتظارك`;
    window.open(`https://wa.me/${phone.replace('+','')}?text=${encodeURIComponent(msg)}`,'_blank');
    sent++;
  });
  showToast('success',`✅ تم فتح ${sent} نافذة واتساب`,'تأكد من السماح بفتح النوافذ المنبثقة');
}

// 📣 CAMPAIGNS SCREEN
// ══════════════════════════════════════════
function renderCampaigns(q){
  q=q||'';
  const stFilter=document.getElementById('camp-status-filter')?.value||'';
  if(!DB.get('campaigns')) DB.set('campaigns',[
    {id:'c1',name:'حملة عيد الأم - بوتكس 20%',channel:'إنستجرام',goal:'زيادة الحجوزات',budget:5000,leadsCount:45,converted:18,startDate:'2025-03-01',endDate:'2025-03-31',status:'منتهية',desc:'خصم 20% على جلسات البوتكس بمناسبة عيد الأم'},
    {id:'c2',name:'صيف مثالي - ليزر الجسم',channel:'فيسبوك',goal:'ترويج خدمة',budget:8000,leadsCount:72,converted:31,startDate:'2025-06-01',endDate:'2025-08-31',status:'نشطة',desc:'باقات ليزر الجسم الكاملة بأسعار موسم الصيف'},
    {id:'c3',name:'عروض رمضان الكريم',channel:'واتساب',goal:'ولاء العملاء',budget:3000,leadsCount:28,converted:24,startDate:'2025-09-01',endDate:'2025-09-30',status:'مجدولة',desc:'عروض حصرية لعملاء العيادة الحاليين'},
  ]);
  let camps=DB.get('campaigns');
  if(q) camps=camps.filter(c=>c.name.includes(q));
  if(stFilter) camps=camps.filter(c=>c.status===stFilter);

  const all=DB.get('campaigns');
  txt('camp-kpi-active',all.filter(c=>c.status==='نشطة').length);
  txt('camp-kpi-budget',all.reduce((s,c)=>s+(c.budget||0),0).toLocaleString()+' ج');
  txt('camp-kpi-leads',all.reduce((s,c)=>s+(c.leadsCount||0),0));
  const totalLeads=all.reduce((s,c)=>s+(c.leadsCount||0),0);
  const totalConv=all.reduce((s,c)=>s+(c.converted||0),0);
  txt('camp-kpi-conversion',totalLeads?Math.round(totalConv/totalLeads*100)+'%':'0%');

  const CAMP_COLORS={'نشطة':'kc-teal','منتهية':'kc-rose','مجدولة':'kc-amber'};
  const CHAN_ICONS={'إنستجرام':'📸','فيسبوك':'👥','واتساب':'💬','SMS':'📱','إيميل':'📧','جوجل':'🔍'};
  const grid=document.getElementById('camp-grid');if(!grid)return;
  grid.innerHTML=camps.map(c=>{
    const conv=c.leadsCount?Math.round((c.converted||0)/c.leadsCount*100):0;
    return `<div class="kpi-card ${CAMP_COLORS[c.status]||'kc-purple'}" style="padding:18px;cursor:pointer;">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px;">
        <span style="font-size:18px">${CHAN_ICONS[c.channel]||'📣'}</span>
        <span class="ast ${c.status==='نشطة'?'sc':c.status==='مجدولة'?'sp':'sd'}">${c.status}</span>
      </div>
      <div style="font-size:14px;font-weight:800;margin-bottom:6px;">${c.name}</div>
      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px;">${c.startDate} ← ${c.endDate}</div>
      <div class="g2c" style="gap:8px;margin-bottom:12px;">
        <div style="text-align:center;background:var(--glass);border-radius:8px;padding:8px;"><div style="font-size:17px;font-weight:800;color:var(--teal)">${c.leadsCount||0}</div><div style="font-size:10px;color:var(--text-muted)">Leads</div></div>
        <div style="text-align:center;background:var(--glass);border-radius:8px;padding:8px;"><div style="font-size:17px;font-weight:800;color:var(--emerald)">${conv}%</div><div style="font-size:10px;color:var(--text-muted)">تحويل</div></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;"><span style="color:var(--text-muted)">الميزانية:</span><span style="font-weight:700;color:var(--gold-light)">${(c.budget||0).toLocaleString()} ج</span></div>
      <div style="display:flex;gap:7px;">
        <button class="btn btn-teal btn-sm" style="flex:1;font-size:11px" onclick="convertCampLead('${c.id}')">+1 تحويل</button>
        <button class="btn btn-ghost btn-sm" style="flex:1;font-size:11px" onclick="openCampaignModal('${c.id}')">✏️ تعديل</button>
        <button class="btn btn-danger btn-sm" style="font-size:11px" onclick="delCampaign('${c.id}')">🗑</button>
      </div>
    </div>`;
  }).join('')||'<div class="card" style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد حملات</div>';
}
function openCampaignModal(id){
  const c=id?(DB.get('campaigns')||[]).find(x=>x.id===id):null;
  const titleEl=document.getElementById('camp-modal-title');
  if(titleEl) titleEl.textContent=c?'✏️ تعديل الحملة':'📣 حملة جديدة';
  const fields=['id','name','channel','goal','budget','status','desc'];
  fields.forEach(f=>{
    const el=document.getElementById('camp-'+f);
    if(!el) return;
    if(f==='channel' && !c) el.value='إنستجرام';
    else if(f==='goal' && !c) el.value='زيادة الحجوزات';
    else if(f==='status' && !c) el.value='مجدولة';
    else if(f==='budget' && !c) el.value='';
    else if(f==='desc' && !c) el.value='';
    else if(f==='id') el.value=c?c.id:'';
    else el.value=c?(c[f]||''):'';
  });
  const startEl=document.getElementById('camp-start');
  const endEl=document.getElementById('camp-end');
  const leadsEl=document.getElementById('camp-leads-count');
  if(startEl) startEl.value=c?c.startDate||'':new Date().toISOString().split('T')[0];
  if(endEl) endEl.value=c?c.endDate||'':'';
  if(leadsEl) leadsEl.value=c?c.leadsCount||0:0;
  openModal('campaign-modal');
}
function saveCampaign(){
  const name=gv('camp-name').trim();if(!name){showToast('warning','⚠️ اسم الحملة مطلوب');return;}
  const id=gv('camp-id');
  const existing=id?(DB.get('campaigns')||[]).find(x=>x.id===id):null;
  const data={name,channel:gv('camp-channel'),goal:gv('camp-goal'),budget:parseFloat(gv('camp-budget'))||0,leadsCount:parseInt(gv('camp-leads-count'))||0,converted:existing?.converted||0,startDate:gv('camp-start'),endDate:gv('camp-end'),status:gv('camp-status'),desc:gv('camp-desc')};
  if(id){DB.upd('campaigns',id,data);showToast('success',`✅ تم تحديث ${name}`);}
  else{DB.push('campaigns',data);showToast('success',`✅ تم إضافة حملة "${name}"`);}
  closeModal('campaign-modal');renderCampaigns();
}
function delCampaign(id){
  const c=(DB.get('campaigns')||[]).find(x=>x.id===id);
  if(confirm(`حذف حملة "${c?.name}"؟`)){DB.del('campaigns',id);showToast('info','🗑 تم الحذف');renderCampaigns();}
}
function convertCampLead(id){
  const c=(DB.get('campaigns')||[]).find(x=>x.id===id);if(!c)return;
  DB.upd('campaigns',id,{converted:(c.converted||0)+1});
  showToast('success',`✅ تم تسجيل تحويل في "${c.name}"`,`إجمالي التحويلات: ${(c.converted||0)+1}`);
  renderCampaigns();
}

// ══════════════════════════════════════════
