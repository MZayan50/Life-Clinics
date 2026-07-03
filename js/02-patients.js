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

// ── تحديث شاشة الباقات تلقائياً عند أي تغيير في الباقات ──
EventBus.on('packages:created', () => { if(typeof renderPackages==='function') renderPackages(); });
EventBus.on('packages:updated', () => { if(typeof renderPackages==='function') renderPackages(); });
EventBus.on('packages:deleted', () => { if(typeof renderPackages==='function') renderPackages(); });

const AVA = ['linear-gradient(135deg,#8B5CF6,#3B82F6)','linear-gradient(135deg,#10B981,#2DD4BF)','linear-gradient(135deg,#F59E0B,#EF4444)','linear-gradient(135deg,#C4A882,#8B5CF6)','linear-gradient(135deg,#F43F5E,#8B5CF6)'];
// genderAva مُعرَّفة في 00-core.js وتُستخدم هنا مباشرة
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
  // ── ملخص مالي شامل: فواتير + باقات ──
  const patInvoices = DB.get('invoices').filter(i => String(i.patId)===String(id)||(i.patId===undefined&&i.patient===p.name));
  const patPackages = DB.get('packages').filter(pk => String(pk.patId)===String(id));
  const patSessions = DB.get('sessions').filter(s => s.patId===id);

  // ── ملخص مالي موحّد (مصدر واحد: getPatientFinancialSummary في 00-core.js) ──
  const _fin = getPatientFinancialSummary(id);
  const totalSpent  = _fin.spent;
  const totalPaid   = _fin.paid;
  const totalRemain = _fin.remaining;
  const totalVisits = _fin.visits;

  const lastVisitInv = patInvoices.filter(i=>i.date).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
  const lastVisitDate = lastVisitInv ? lastVisitInv.date : '—';

  txt('pp-sessions',  totalVisits);
  txt('pp-spent',     totalSpent.toLocaleString()+' ج');
  txt('pp-paid-total',totalPaid.toLocaleString()+' ج');
  const balEl = document.getElementById('pp-balance');
  if(balEl){ balEl.textContent=totalRemain.toLocaleString()+' ج'; balEl.style.color=totalRemain>0?'var(--rose)':'var(--emerald)'; }
  // زر "دفع متبقي"
  const ppPayBtnV = document.getElementById('pp-pay-btn');
  if(ppPayBtnV) ppPayBtnV.style.display = totalRemain>0 ? '' : 'none';
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
      const sessUsed  = pk.sessionsUsed || 0;
      const sessTotal = pk.sessionsCount || 0;
      const sessLeft  = Math.max(0, sessTotal - sessUsed);
      const sessPct   = sessTotal ? Math.round(sessUsed / sessTotal * 100) : 0;
      const sessColor = sessLeft === 0 ? 'var(--rose)' : sessLeft === 1 ? 'var(--gold-light)' : 'var(--teal)';
      const sessArr   = sessTotal > 0 ? Array.from({length: sessTotal}, (_, i) =>
        `<span title="جلسة ${i+1}" style="width:13px;height:13px;border-radius:50%;background:${i<sessUsed?'var(--teal)':'rgba(148,163,184,.2)'};display:inline-block;margin:1px;"></span>`
      ).join('') : '';
      return `<div style="background:var(--glass);border:1px solid var(--glass-border);border-radius:var(--radius-sm);padding:13px;margin-bottom:9px;">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
          <div>
            <div style="font-weight:700">${pk.name}</div>
            <div style="font-size:12px;color:var(--text-muted)">${pk.services||''}</div>
          </div>
          <div style="text-align:left">
            <div style="color:var(--gold-light);font-weight:700">${(pk.price||0).toLocaleString()} ج</div>
            ${remaining>0?`<div style="color:var(--rose);font-size:12px">متبقي مالي: ${remaining.toLocaleString()} ج</div>`:''}
            <span class="ast ${pk.status==='نشطة'?'sc':'sd'}" style="font-size:10px">${pk.status}</span>
          </div>
        </div>
        <div style="background:rgba(45,212,191,.06);border-radius:8px;padding:8px;margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:12px;font-weight:700;">🎯 الجلسات</span>
            <span style="font-size:13px;font-weight:800;color:${sessColor}">${sessUsed}/${sessTotal} <span style="font-size:11px;color:var(--text-muted)">(متبقي: ${sessLeft})</span></span>
          </div>
          <div class="prog"><div class="prog-f" style="width:${sessPct}%;background:${sessColor}"></div></div>
          <div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:2px;">${sessArr}</div>
          ${sessLeft===1?`<div style="font-size:11px;color:var(--gold-light);margin-top:3px;font-weight:700;">⚠️ جلسة أخيرة تبقّت!</div>`:''}
          ${sessLeft===0?`<div style="font-size:11px;color:var(--rose);margin-top:3px;">✅ اكتملت جميع الجلسات</div>`:''}
        </div>
        <div style="font-size:11px;color:var(--text-muted)">📅 ${pk.startDate||'—'} ← ${pk.endDate||'—'}</div>
      </div>`;
    }).join('') : '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">لا توجد باقات</div>';
  }
  const tg = document.getElementById('pp-tags');
  if(tg) tg.innerHTML = `<span class="tag tg-gold">${p.skin}</span><span class="tag tg-teal">${p.hair}</span>${p.allergies&&p.allergies!=='لا حساسية'?'<span class="tag tg-purple">⚠️ حساسية</span>':'<span class="tag tg-green">✅ لا حساسية</span>'}`;
  const sk = document.getElementById('med-skin');
  if(sk) sk.innerHTML = `<div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">النوع:</span><span class="tag tg-gold">${p.skin}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">المشاكل:</span><span>${p.skinProbs||'—'}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">الحساسية:</span><span>${p.allergies||'—'}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">الحمل:</span><span>${p.pregnancy||'—'}</span></div>`;
  const hr = document.getElementById('med-hair');
  if(hr) hr.innerHTML = `<div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">النوع:</span><span class="tag tg-teal">${p.hair}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">المشاكل:</span><span>${p.hairProbs||'—'}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">الأدوية:</span><span>${p.meds||'لا يوجد'}</span></div>`;
  // ── جدول الفواتير الموسَّع - مزامنة تلقائية ──
  const pinv = patInvoices.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const pitb = document.getElementById('p-inv-tbody');
  if(pitb) pitb.innerHTML = pinv.map((i,idx) => {
    const num = `#${String(idx+1).padStart(3,'0')}`;
    const stCls = i.status==='مدفوع'?'sc':i.status==='جزئي'?'sp':'sd';
    const items = i.items||[];
    const svcs = items.filter(x=>x.type==='service'||!x.type).map(x=>x.name||x.service||'—').join('، ')||i.service||'—';
    const prods = items.filter(x=>x.type==='product').map(x=>`${x.name||'—'} (${x.qty||1})`).join('، ')||'—';
    const disc = (i.discount||0);
    const tax  = (i.tax||0);
    return `<tr>
      <td style="font-size:11px;color:var(--gold-light);font-weight:700">${num}</td>
      <td style="font-size:12px;color:var(--text-muted)">${i.date||'—'}</td>
      <td style="font-size:12px;">${i.doctor||'—'}</td>
      <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${svcs}">${svcs}</td>
      <td style="font-size:12px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${prods}">${prods}</td>
      <td style="font-size:12px;color:var(--amber)">${disc>0?disc.toLocaleString()+' ج':'—'}</td>
      <td style="font-size:12px;color:var(--text-muted)">${tax>0?tax+'%':'—'}</td>
      <td style="font-weight:800;color:var(--gold-light)">${(i.total||0).toLocaleString()} ج</td>
      <td style="color:var(--emerald);font-weight:700">${(i.paid||0).toLocaleString()} ج</td>
      <td style="color:${(i.remaining||0)>0?'var(--rose)':'var(--text-muted)'};font-weight:700">${(i.remaining||0).toLocaleString()} ج</td>
      <td><span class="tag tg-teal" style="font-size:11px">${i.method||'—'}</span></td>
      <td><span class="ast ${stCls}">${i.status||'—'}</span></td>
      <td style="font-size:11px;color:var(--text-muted);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${i.notes||''}">${i.notes||'—'}</td>
      <td style="white-space:nowrap;">
        <div style="display:flex;gap:4px;">
          ${(i.remaining||0)>0?`<button class="btn btn-teal btn-xs" onclick="openSmartPay('${i.id}')">💳</button>`:''}
          <button class="btn btn-ghost btn-xs" onclick="sendInvoiceWA('${i.id}')">💬</button>
          <button class="btn btn-ghost btn-xs" onclick="printInvoice('${i.id}')">🖨️</button>
        </div>
      </td>
    </tr>`;
  }).join('')||'<tr><td colspan="14" style="text-align:center;color:var(--text-muted);padding:20px">لا توجد فواتير</td></tr>';
  showScreen('patient-profile');
  renderPatHistory(id);

  // ── مزامنة لحظية: تحديث ملف العميل تلقائياً عند أي تغيير ──
  if(window._patProfileListener) { try{ window._patProfileListener(); }catch(e){} }
  const _refreshProfile = () => {
    if(window._curPat !== id) return;
    const _scr = document.getElementById('screen-patient-profile');
    if(!_scr || !_scr.classList.contains('active')) return;
    const _p2 = DB.get('patients').find(x => x.id === id);
    if(!_p2) return;
    const _sess = DB.get('sessions').filter(s => s.patId===id);
    const _fin2 = getPatientFinancialSummary(id);
    const _sp = _fin2.spent, _pd = _fin2.paid, _rm = _fin2.remaining, _vis = _fin2.visits;
    txt('pp-sessions', _vis);
    txt('pp-spent',    _sp.toLocaleString()+' ج');
    txt('pp-paid-total',_pd.toLocaleString()+' ج');
    const _bEl = document.getElementById('pp-balance');
    if(_bEl){ _bEl.textContent=_rm.toLocaleString()+' ج'; _bEl.style.color=_rm>0?'var(--rose)':'var(--emerald)'; }
    const _ppPayBtn = document.getElementById('pp-pay-btn');
    if(_ppPayBtn) _ppPayBtn.style.display = _rm>0 ? '' : 'none';
    // لو تاب "حساب العميل" ظاهر، حدّث الجدول أيضاً
    const tInv = document.getElementById('t-inv');
    if(tInv && tInv.style.display !== 'none') renderPatAccount(id);
    // تحديث تاب "السجل" الموحّد
    renderPatHistory(id);
  };
  var _ppEvts = ['invoices:created','invoices:updated','invoices:deleted','packages:created','packages:updated','sessions:updated','appointments:created','appointments:updated','appointments:deleted','db:changed'];
  _ppEvts.forEach(function(ev){ EventBus.on(ev, _refreshProfile); });
  window._patProfileListener = () => {
    _ppEvts.forEach(function(ev){ EventBus.off(ev, _refreshProfile); });
  };
}

// ══════════════════════════════════════════════════════
// 📋 RENDER PATIENT HISTORY — تبويب "السجل" الموحّد
// يجمع: مواعيد + فواتير + باقات في خط زمني واحد
// (كان التبويب موجوداً في الواجهة بدون أي دالة تملأه)
// ══════════════════════════════════════════════════════
function renderPatHistory(id){
  if(!id) return;
  const el = document.getElementById('hist-list');
  if(!el) return;
  const p = DB.get('patients').find(x => x.id === id);
  if(!p) return;

  const appts = DB.get('appointments').filter(a => String(a.patId)===String(id) || a.patient===p.name);
  const invs  = DB.get('invoices').filter(i => String(i.patId)===String(id) || (i.patId===undefined && i.patient===p.name));
  const pkgs  = DB.get('packages').filter(pk => String(pk.patId)===String(id));

  // ✅ FIX: استبعاد الفواتير المغطاة بباقة (total=0, method='باقة') من السجل —
  // كانت تظهر كسطر "فاتورة" منفصل رغم أن نفس الجلسة أصلاً موثّقة كسطر "موعد"،
  // فتظهر كل جلسة من باقة مرتين في السجل (مرة كموعد ومرة كفاتورة 0 ج).
  // نفس الاستبعاد المطبَّق بالفعل في renderPatAccount (تاب "حساب العميل").
  const _pkgIdsSet = new Set(pkgs.map(pk => String(pk.id)));
  const invsForHistory = invs.filter(i => !i.pkgId || !_pkgIdsSet.has(String(i.pkgId)));

  const items = [];
  appts.forEach(a => items.push({
    _date: a.date||'', _time: a.time||'',
    _icon: a.status==='مكتمل'?'✅':a.status==='ملغي'?'🚫':a.status==='لم يحضر'?'❌':'📅',
    _title: `موعد — ${a.service||'—'}${a.doctor?' · د. '+a.doctor:''}`,
    _sub: `${a.status||'—'}${a.branch?' · '+a.branch:''}`,
    _color: a.status==='مكتمل'?'var(--emerald)':a.status==='ملغي'||a.status==='لم يحضر'?'var(--rose)':'var(--teal)'
  }));
  invsForHistory.forEach(i => items.push({
    _date: i.date||'', _time: '',
    _icon: '🧾',
    _title: `فاتورة — ${i.service||'—'}`,
    _sub: `${(i.total||0).toLocaleString()} ج · ${i.status||'—'}`,
    _color: 'var(--gold-light)'
  }));
  pkgs.forEach(pk => items.push({
    _date: pk.startDate||'', _time: '',
    _icon: '🎁',
    _title: `باقة — ${pk.name||'—'}`,
    _sub: `${(pk.price||0).toLocaleString()} ج · ${pk.status||'—'}`,
    _color: 'var(--teal)'
  }));

  items.sort((x,y) => (y._date+y._time).localeCompare(x._date+x._time));

  el.innerHTML = items.length ? items.map(it => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--glass);border:1px solid var(--glass-border);border-radius:var(--radius-sm);">
      <div style="font-size:18px;flex-shrink:0;">${it._icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:13px;">${it._title}</div>
        <div style="font-size:11.5px;color:${it._color};">${it._sub}</div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${it._date||'—'}${it._time?' · '+it._time:''}</div>
    </div>`).join('')
    : '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">لا يوجد سجل بعد</div>';
}

// ══════════════════════════════════════════════════════
// 💰 RENDER PATIENT ACCOUNT — سجل التعاملات الموحد
// يجمع: فواتير + باقات + مدفوعات cashlog
// يُستدعى عند الضغط على تاب "حساب العميل"
// ══════════════════════════════════════════════════════
function renderPatAccount(id){
  if(!id) return;
  const p = DB.get('patients').find(x => x.id === id);
  if(!p) return;

  // ── جمع كل مصادر البيانات ──
  const _allInvRaw = DB.get('invoices').filter(i => String(i.patId)===String(id)||(i.patId===undefined&&i.patient===p.name));
  const allPatInvs = [...new Map(_allInvRaw.map(i=>[i.id,i])).values()]; // deduplicate by id
  const allPatPkgs = DB.get('packages').filter(pk => String(pk.patId)===String(id));
  const allCashLog = (DB.get('cashlog')||[]).filter(c => String(c.patId)===String(id));

  // ── تحديث الكروت الإحصائية في رأس الملف (فواتير مستقلة + باقات) ──
  const _txt = (elId,v) => { const el=document.getElementById(elId); if(el) el.textContent=v; };
  const _fin3 = getPatientFinancialSummary(id);
  const _totalSpent  = _fin3.spent;
  const _totalPaid   = _fin3.paid;
  const _totalRemain = _fin3.remaining;
  const _totalVisits = _fin3.visits;
  _txt('pp-sessions',  _totalVisits);
  _txt('pp-spent',     _totalSpent.toLocaleString()+' ج');
  _txt('pp-paid-total',_totalPaid.toLocaleString()+' ج');
  const _balEl = document.getElementById('pp-balance');
  if(_balEl){ _balEl.textContent=_totalRemain.toLocaleString()+' ج'; _balEl.style.color=_totalRemain>0?'var(--rose)':'var(--emerald)'; }
  const ppPayBtn = document.getElementById('pp-pay-btn');
  if(ppPayBtn) ppPayBtn.style.display = _totalRemain>0 ? '' : 'none';

  // ══════════════════════════════════════════════════════
  // جدول حساب العميل: باقات + cashlog فقط
  // الفواتير تظهر في الطباعة فقط — راجع printProfile()
  // ══════════════════════════════════════════════════════
  const allTx = [];

  // 1️⃣ الفواتير المستقلة (مش مرتبطة بباقة)
  const _pkgIdsSet = new Set(allPatPkgs.map(pk => String(pk.id)));
  allPatInvs.filter(i => !i.pkgId || !_pkgIdsSet.has(String(i.pkgId))).forEach(i => {
    allTx.push({ _date: i.date||'', _type: 'invoice', _raw: i });
  });

  // 2️⃣ كل الباقات
  allPatPkgs.forEach(pk => {
    allTx.push({ _date: pk.startDate||'', _type: 'package', _raw: pk });
  });

  // 3️⃣ مدفوعات cashlog المرتبطة بالعميل (مش مرتبطة بفاتورة موجودة)
  const _invRefIds = new Set(allPatInvs.map(i => String(i.id)));
  // فلترة cashlog:
  // 1. مش مرتبط بفاتورة موجودة (refId)
  // 2. مش بيع منتج بدون refId (كان يتعمل يدوياً قبل الإصلاح)
  allCashLog.filter(c => {
    // لو عنده refId وموجود في الفواتير → مش يظهر (الفاتورة بتظهر بدله)
    if(c.refId && _invRefIds.has(String(c.refId))) return false;
    // لو مصدره "بيع منتج" أو notes فيها "بيع" ومش عنده refId → تحقق لو فيه فاتورة تغطيه
    if(!c.refId && (c.source||'').includes('بيع منتج')) return false;
    return true;
  }).forEach(c => {
    allTx.push({ _date: c.date||'', _type: 'cashlog', _raw: c });
  });

  // ترتيب تنازلي بالتاريخ
  allTx.sort((a,b) => (b._date||'').localeCompare(a._date||''));

  // ══════════════════════════════════════════════════════
  // رسم الجدول الموحد في p-inv-tbody
  // ══════════════════════════════════════════════════════
  const pitbFull = document.getElementById('p-inv-tbody');
  if(pitbFull){
    if(!allTx.length){
      pitbFull.innerHTML = '<tr><td colspan="14" style="text-align:center;color:var(--text-muted);padding:30px;font-size:13px">لا توجد تعاملات مالية مسجلة لهذا العميل</td></tr>';
    } else {
      pitbFull.innerHTML = allTx.map((tx, rowIdx) => {
        const num = '#' + String(rowIdx+1).padStart(3,'0');

        // ── الأعمدة بالترتيب الدقيق للجدول (14 عمود): ──
        // 1:#  2:التاريخ  3:الطبيب  4:الخدمات  5:المنتجات  6:الخصم  7:الضريبة
        // 8:الإجمالي  9:المدفوع  10:المتبقي  11:طريقة الدفع  12:الحالة  13:ملاحظات  14:إجراءات

        if(tx._type === 'invoice'){
          const i = tx._raw;
          const stCls = i.status==='مدفوع'?'sc':i.status==='جزئي'?'sp':'sd';
          const prods = (i.products||[]).map(x=>(x.productName||'—')+' × '+(x.qty||1)).join('، ')||'—';
          const svcs  = i.service||'—';
          const disc  = i.discount||0;
          const tax   = i.tax||0;
          // badge النوع يظهر داخل عمود # مع الرقم
          return '<tr style="border-right:3px solid var(--gold-light)">'
            + '<td style="font-size:11px;color:var(--gold-light);font-weight:700">'+num+'<br><span class="tag tg-gold" style="font-size:9px">🧾</span></td>'  // 1:#
            + '<td style="font-size:12px;color:var(--text-muted)">'+(i.date||'—')+'</td>'  // 2:التاريخ
            + '<td style="font-size:12px">'+(i.doctor||'—')+'</td>'  // 3:الطبيب
            + '<td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+svcs+'">'+svcs+'</td>'  // 4:الخدمات
            + '<td style="font-size:12px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+prods+'">'+prods+'</td>'  // 5:المنتجات
            + '<td style="font-size:12px;color:var(--amber)">'+(disc>0?disc.toLocaleString()+' ج':'—')+'</td>'  // 6:الخصم
            + '<td style="font-size:12px;color:var(--text-muted)">'+(tax>0?tax+'%':'—')+'</td>'  // 7:الضريبة
            + '<td style="font-weight:800;color:var(--gold-light)">'+(i.total||0).toLocaleString()+' ج</td>'  // 8:الإجمالي
            + '<td style="color:var(--emerald);font-weight:700">'+(i.paid||0).toLocaleString()+' ج</td>'  // 9:المدفوع
            + '<td style="color:'+((i.remaining||0)>0?'var(--rose)':'var(--text-muted)')+';font-weight:700">'+(i.remaining||0).toLocaleString()+' ج</td>'  // 10:المتبقي
            + '<td><span class="tag tg-teal" style="font-size:11px">'+(i.method||'—')+'</span></td>'  // 11:طريقة الدفع
            + '<td><span class="ast '+stCls+'">'+(i.status||'—')+'</span></td>'  // 12:الحالة
            + '<td style="font-size:11px;color:var(--text-muted);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+(i.notes||'')+'">'+(i.notes||'—')+'</td>'  // 13:ملاحظات
            + '<td style="white-space:nowrap"><div style="display:flex;gap:4px;">'  // 14:إجراءات
            + ((i.remaining||0)>0?'<button class="btn btn-teal btn-xs" onclick="openSmartPay(\''+i.id+'\')">💳</button>':'')
            + '<button class="btn btn-ghost btn-xs" onclick="sendInvoiceWA(\''+i.id+'\')">💬</button>'
            + '<button class="btn btn-ghost btn-xs" onclick="printInvoice(\''+i.id+'\')">🖨️</button>'
            + '</div></td>'
            + '</tr>';

        } else if(tx._type === 'package'){
          const pk       = tx._raw;
          const pkgPrice = pk.price||0;
          const pkgPaid  = pk.paid||0;
          const pkgRem   = Math.max(0,pkgPrice-pkgPaid);
          const stCls    = pk.status==='نشطة'?'sc':pk.status==='منتهية'?'sd':'sp';
          const sessInfo = (pk.sessionsUsed||0)+'/'+(pk.sessionsCount||0)+' جلسة';
          const pkgLabel = pk.name+(pk.services?' · '+pk.services:'');
          return '<tr style="border-right:3px solid var(--teal)">'
            + '<td style="font-size:11px;color:var(--teal);font-weight:700">'+num+'<br><span class="tag tg-teal" style="font-size:9px">🎁</span></td>'  // 1:#
            + '<td style="font-size:12px;color:var(--text-muted)">'+(pk.startDate||'—')+'</td>'  // 2:التاريخ
            + '<td style="font-size:12px">—</td>'  // 3:الطبيب
            + '<td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+pkgLabel+'">'+pkgLabel+'</td>'  // 4:الخدمات
            + '<td style="font-size:12px;color:var(--text-muted)">'+sessInfo+'</td>'  // 5:المنتجات → جلسات
            + '<td>—</td>'  // 6:الخصم
            + '<td>—</td>'  // 7:الضريبة
            + '<td style="font-weight:800;color:var(--gold-light)">'+pkgPrice.toLocaleString()+' ج</td>'  // 8:الإجمالي
            + '<td style="color:var(--emerald);font-weight:700">'+pkgPaid.toLocaleString()+' ج</td>'  // 9:المدفوع
            + '<td style="color:'+(pkgRem>0?'var(--rose)':'var(--text-muted)')+';font-weight:700">'+pkgRem.toLocaleString()+' ج</td>'  // 10:المتبقي
            + '<td><span class="tag tg-teal" style="font-size:11px">'+(pk.payMethod||'—')+'</span></td>'  // 11:طريقة الدفع
            + '<td><span class="ast '+stCls+'">'+(pk.status||'—')+'</span></td>'  // 12:الحالة
            + '<td style="font-size:11px;color:var(--text-muted)">'+(pk.startDate||'—')+' ← '+(pk.endDate||'—')+'</td>'  // 13:ملاحظات
            + '<td style="white-space:nowrap"><div style="display:flex;gap:4px;">'  // 14:إجراءات
            + (pkgRem>0?'<button class="btn btn-teal btn-xs" onclick="openPayFromProfile()">💳</button>':'')
            + '</div></td>'
            + '</tr>';

        } else {
          // cashlog — 14 عمود بنفس الترتيب
          const c = tx._raw;
          return '<tr style="border-right:3px solid var(--emerald);opacity:.85">'
            + '<td style="font-size:11px;color:var(--emerald);font-weight:700">'+num+'<br><span class="tag tg-green" style="font-size:9px">💰</span></td>'  // 1:#
            + '<td style="font-size:12px;color:var(--text-muted)">'+(c.date||'—')+'</td>'  // 2:التاريخ
            + '<td style="font-size:12px">—</td>'  // 3:الطبيب
            + '<td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+(c.source||c.service||'')+'">'+(c.source||c.service||'دفعة')+'</td>'  // 4:الخدمات
            + '<td>—</td>'  // 5:المنتجات
            + '<td>—</td>'  // 6:الخصم
            + '<td>—</td>'  // 7:الضريبة
            + '<td>—</td>'  // 8:الإجمالي
            + '<td style="color:var(--emerald);font-weight:800">'+(c.amount||0).toLocaleString()+' ج</td>'  // 9:المدفوع
            + '<td style="color:var(--text-muted)">—</td>'  // 10:المتبقي
            + '<td><span class="tag tg-teal" style="font-size:11px">'+(c.method||'—')+'</span></td>'  // 11:طريقة الدفع
            + '<td><span class="ast sc">مدفوع</span></td>'  // 12:الحالة
            + '<td style="font-size:11px;color:var(--text-muted)">'+(c.notes||'—')+'</td>'  // 13:ملاحظات
            + '<td>—</td>'  // 14:إجراءات
            + '</tr>';
        }
      }).join('');
    }
  }

  // ── جلسات بتفاصيل (pac-sessions-list) — لا تغيير ──
  const sessions = DB.get('sessions').filter(s => s.patId===id);
  const sessCont = document.getElementById('pac-sessions-list');
  if(sessCont){
    if(!sessions.length){
      sessCont.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">لا توجد جلسات مسجلة</div>';
    } else {
      sessCont.innerHTML = sessions.map(s => {
        const done=s.done||0, total=s.total||1, pct=Math.round(done/total*100);
        const stCls = s.status==='مكتملة'?'sc':s.status==='متوقفة'?'sx':'sp';
        const sessRows = Array.from({length:total},(_,i)=>{
          const sessNum = i+1;
          const isDone  = i < done;
          return '<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-bottom:1px solid var(--glass-border);font-size:12.5px;">'
            + '<div style="width:26px;height:26px;border-radius:50%;background:'+(isDone?'var(--teal)':'var(--glass-border)')+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:'+(isDone?'#fff':'var(--text-muted)')+';">'+sessNum+'</div>'
            + '<div style="flex:1;"><span style="font-weight:600">'+(s.type||'جلسة')+' '+sessNum+'</span>'
            + (s.doc?'<span style="color:var(--text-muted);font-size:11px;margin-right:6px;">· د. '+s.doc+'</span>':'')
            + '</div>'
            + '<div>'+(isDone?'<span class="ast sc" style="font-size:11px">✅ مكتملة</span>':'<span class="ast sd" style="font-size:11px">○ لم تُنفَّذ</span>')+'</div>'
            + '</div>';
        }).join('');
        return '<div style="margin-bottom:12px;border:1px solid var(--glass-border);border-radius:var(--radius-sm);overflow:hidden;">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--glass);">'
          + '<div><span style="font-weight:800;font-size:14px;">'+(s.type||'جلسات')+'</span>'
          + (s.doc?'<span style="color:var(--text-muted);font-size:12px;margin-right:8px;">د. '+s.doc+'</span>':'')
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:10px;">'
          + '<span style="color:var(--teal);font-weight:800;">'+done+'/'+total+'</span>'
          + '<span class="ast '+stCls+'" style="font-size:11px">'+s.status+'</span>'
          + '</div></div>'
          + '<div class="prog" style="border-radius:0;height:4px;"><div class="prog-f" style="width:'+pct+'%;background:var(--teal)"></div></div>'
          + sessRows
          + '</div>';
      }).join('');
    }
  }

  // ── باقات بتفاصيل مالية (pac-packages-list) — لا تغيير ──
  const packages = DB.get('packages').filter(pk => pk.patId===id);
  const pkgCont = document.getElementById('pac-packages-list');
  if(pkgCont){
    if(!packages.length){
      pkgCont.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">لا توجد باقات</div>';
    } else {
      pkgCont.innerHTML = packages.map(pk => {
        const pkgPaid   = pk.paid||0;
        const pkgPrice  = pk.price||0;
        const pkgRemain = Math.max(0,pkgPrice-pkgPaid);
        const sessUsed  = pk.sessionsUsed||0;
        const sessTotal = pk.sessionsCount||0;
        const sessLeft  = Math.max(0,sessTotal-sessUsed);
        const sessPct   = sessTotal?Math.round(sessUsed/sessTotal*100):0;
        const stCls     = pk.status==='نشطة'?'sc':pk.status==='منتهية'?'sd':'sp';
        const sessColor = sessLeft===0?'var(--rose)':sessLeft===1?'var(--gold-light)':'var(--teal)';
        const sessRows  = sessTotal>0 ? Array.from({length:sessTotal},(_,i)=>{
          const sessNum = i+1;
          const isDone  = i < sessUsed;
          return '<div style="display:flex;align-items:center;gap:10px;padding:7px 12px;border-bottom:1px solid var(--glass-border);font-size:12.5px;">'
            + '<div style="width:26px;height:26px;border-radius:50%;background:'+(isDone?'var(--teal)':'rgba(148,163,184,.15)')+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:'+(isDone?'#fff':'var(--text-muted)')+';">'+sessNum+'</div>'
            + '<div style="flex:1;"><span style="font-weight:600">'+(pk.services||pk.name)+' — جلسة '+sessNum+'</span></div>'
            + '<div>'+(isDone?'<span class="ast sc" style="font-size:11px">✅ مكتملة</span>':'<span class="ast sd" style="font-size:11px">○ لم تُنفَّذ</span>')+'</div>'
            + '</div>';
        }).join('') : '';
        return '<div style="border:1px solid var(--glass-border);border-radius:var(--radius-sm);overflow:hidden;margin-bottom:14px;">'
          + '<div style="padding:12px 14px;background:var(--glass);display:flex;justify-content:space-between;align-items:start;">'
          + '<div><div style="font-weight:800;font-size:14px;">🎁 '+pk.name+'</div>'
          + '<div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">'+(pk.services||'—')+' · '+(pk.startDate||'—')+' ← '+(pk.endDate||'—')+'</div></div>'
          + '<span class="ast '+stCls+'" style="font-size:11px">'+pk.status+'</span>'
          + '</div>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--glass-border);">'
          + '<div style="padding:10px;background:var(--bg-secondary);text-align:center;"><div style="font-weight:800;color:var(--gold-light);font-size:15px;">'+pkgPrice.toLocaleString()+' ج</div><div style="font-size:11px;color:var(--text-muted);">سعر الباقة</div></div>'
          + '<div style="padding:10px;background:var(--bg-secondary);text-align:center;"><div style="font-weight:800;color:var(--emerald);font-size:15px;">'+pkgPaid.toLocaleString()+' ج</div><div style="font-size:11px;color:var(--text-muted);">المدفوع</div></div>'
          + '<div style="padding:10px;background:var(--bg-secondary);text-align:center;"><div style="font-weight:800;color:'+(pkgRemain>0?'var(--rose)':'var(--teal)')+';font-size:15px;">'+pkgRemain.toLocaleString()+' ج</div><div style="font-size:11px;color:var(--text-muted);">المتبقي</div></div>'
          + '</div>'
          + '<div style="padding:10px 14px;background:var(--bg-secondary);">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;"><span style="font-size:12px;font-weight:700;">🎯 الجلسات</span>'
          + '<span style="font-size:13px;font-weight:800;color:'+sessColor+'">'+sessUsed+'/'+sessTotal+' <span style="font-size:11px;color:var(--text-muted)">(متبقي: '+sessLeft+')</span></span></div>'
          + '<div class="prog"><div class="prog-f" style="width:'+sessPct+'%;background:'+sessColor+'"></div></div>'
          + '</div>'
          + sessRows
          + (pkgRemain>0?'<div style="padding:10px 14px;background:var(--bg-secondary);"><button class="btn btn-teal btn-sm" onclick="openPayFromProfile()" style="width:100%">💳 دفع المتبقي ('+pkgRemain.toLocaleString()+' ج)</button></div>':'')
          + '</div>';
      }).join('');
    }
  }
}

function age(d){ return d ? Math.floor((Date.now()-new Date(d))/(365.25*24*3600*1000)) : 0; }

// ══════════════════════════════════════════════════════════════════
// 🗑️ DEEP DELETE PATIENT — يحذف العميل + كل بياناته المرتبطة
//    من Firestore وlocalStorage معاً بشكل فوري ولحظي
// ══════════════════════════════════════════════════════════════════
function delPat(id){
  const pat = DB.get('patients').find(p => p.id === id);
  if(!pat){ showToast('error','❌ العميل غير موجود'); return; }

  // إظهار مربع تأكيد مفصل
  const invCount   = DB.get('invoices').filter(i => String(i.patId)===String(id)||i.patient===pat.name).length;
  const pkgCount   = DB.get('packages').filter(pk => String(pk.patId)===String(id)).length;
  const sessCount  = DB.get('sessions').filter(s => String(s.patId)===String(id)).length;
  const apptCount  = DB.get('appointments').filter(a => String(a.patId||a.patientId)===String(id)||a.patient===pat.name).length;
  const instCount  = (DB.get('installments')||[]).filter(p => String(p.patientId)===String(id)).length;
  const photoCount = (DB.get('photos')||[]).filter(ph => String(ph.patId)===String(id)).length;

  const msg = [
    `⚠️ حذف العميل: ${pat.name}`,
    `سيتم حذف جميع بياناته من Firebase بشكل نهائي:`,
    `• ${invCount} فاتورة`,
    `• ${pkgCount} باقة · ${sessCount} جلسة`,
    `• ${apptCount} موعد`,
    `• ${instCount} خطة أقساط`,
    `• ${photoCount} صورة`,
    ``,
    `هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.`
  ].join('\n');

  if(!confirm(msg)) return;

  let deleted = 0;
  // ✅ FIX (عميل محذوف بيرجع تاني بعد قفل المتصفح): DB.del كانت fire-and-forget،
  // فتوست "تم الحذف" كان بيظهر فورًا قبل ما الحذف يوصل فعليًا لـ Firestore.
  // المستخدم بيقفل التاب لما يشوف التوست — فآخر طلبات الحذف (وأهمها سجل
  // العميل نفسه، رقم 11 في الترتيب) بتتلغي مع قفل التاب لو لسه في الطريق.
  // الحل: نجمع كل الـ promises ونستنى Promise.all قبل ما نأكّد النجاح.
  const _delPromises = [];

  // ── 1. فواتير العميل ──
  DB.get('invoices')
    .filter(i => String(i.patId)===String(id) || i.patient===pat.name)
    .forEach(i => { _delPromises.push(DB.del('invoices', i.id)); deleted++; });

  // ── 2. بنود الفواتير ──
  (DB.get('invoice_items')||[])
    .filter(ii => String(ii.patId)===String(id))
    .forEach(ii => { _delPromises.push(DB.del('invoice_items', ii.id)); deleted++; });

  // ── 3. سجلات الخزينة المرتبطة بالعميل ──
  // ✅ FIX حرج: cashlog غير قابل للحذف بتصميم متعمَّد (دفتر append-only —
  // انظر firestore.rules: "allow delete: if false" على /cashlog). DB.del()
  // هنا كانت بتتظبط محلياً فقط (Optimistic UI) ثم تُرفَض صامتاً من السيرفر
  // وتدخل في طابور إعادة محاولة لا ينجح أبداً (OQ)، فالقيود كانت ترجع تظهر
  // بعد أي F5 أو من جهاز تاني رغم حذف العميل. الحل: تسجيل قيد عكسي (إلغاء)
  // بنفس المبلغ ونوع معاكس لكل قيد، فيتصفّر الأثر على رصيد الخزينة مع
  // الحفاظ على السجل التاريخي الأصلي سليماً للمراجعة لاحقاً.
  (DB.get('cashlog')||[])
    .filter(c => String(c.patId)===String(id))
    .forEach(c => {
      DB.push('cashlog', {
        type: c.type==='وارد' ? 'صادر' : 'وارد', // عكس النوع لتصفير الأثر
        source: `إلغاء (حذف عميل) — ${c.source||''}`,
        refId: c.id,
        patient: c.patient||'', patId: c.patId||'',
        amount: c.amount||0,
        method: c.method||'كاش',
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        notes: `إلغاء تلقائي بسبب حذف العميل "${pat.name}"`
      });
      deleted++;
    });

  // ── 4. خطط الأقساط ──
  (DB.get('installments')||[])
    .filter(p => String(p.patientId)===String(id))
    .forEach(p => { _delPromises.push(DB.del('installments', p.id)); deleted++; });

  // ── 5. الباقات ──
  DB.get('packages')
    .filter(pk => String(pk.patId)===String(id))
    .forEach(pk => { _delPromises.push(DB.del('packages', pk.id)); deleted++; });

  // ── 6. الجلسات ──
  DB.get('sessions')
    .filter(s => String(s.patId)===String(id))
    .forEach(s => { _delPromises.push(DB.del('sessions', s.id)); deleted++; });

  // ── 7. المواعيد ──
  DB.get('appointments')
    .filter(a => String(a.patId||a.patientId)===String(id) || a.patient===pat.name)
    .forEach(a => { _delPromises.push(DB.del('appointments', a.id)); deleted++; });

  // ── 8. الصور ──
  (DB.get('photos')||[])
    .filter(ph => String(ph.patId)===String(id))
    .forEach(ph => { _delPromises.push(DB.del('photos', ph.id)); deleted++; });

  // ── 9. قائمة الانتظار ──
  (DB.get('waitlist')||[])
    .filter(w => String(w.patId||w.patientId)===String(id) || w.patient===pat.name)
    .forEach(w => { _delPromises.push(DB.del('waitlist', w.id)); deleted++; });

  // ── 10. الزيارات ──
  (DB.get('visits')||[])
    .filter(v => String(v.patId||v.patientId)===String(id))
    .forEach(v => { _delPromises.push(DB.del('visits', v.id)); deleted++; });

  // ── 11. أخيراً: حذف العميل نفسه ──
  _delPromises.push(DB.del('patients', id));
  deleted++;

  showToast('info', `⏳ جارٍ حذف ${pat.name} من Firebase...`);
  Promise.all(_delPromises).then(()=>{
    showToast('success', `✅ تم حذف ${pat.name} بالكامل`, `${deleted} سجل محذوف من Firebase — آمن تقفل الصفحة دلوقتي`);
  }).catch(err=>{
    console.error('[delPat] فشل حذف بعض السجلات:', err);
    showToast('error', `⚠️ فيه سجلات محتمل ماتحذفتش`, 'افتح الصفحة وحاول تاني قبل ما تقفل المتصفح');
  });
  // EventBus يتولى تحديث الواجهة تلقائياً
}

function deleteCurrentPat(){
  if(window._curPat){
    delPat(window._curPat);
    showScreen('patients');
  }
}

// ── فتح باقة جديدة مرتبطة بالعميل الحالي من شاشة ملف العميل ──
function openPackageFromProfile(){
  const id = window._curPat;
  if(!id){ showToast('error','❌ لا يوجد عميل محدد'); return; }
  if(typeof openPackageModal === 'function'){
    openPackageModal(null, id);
  } else {
    showToast('error','❌ وحدة الباقات غير محملة');
  }
}

// ✅ FIX (شاشة الأقساط لا تتحدث): الدفع من شاشة ملف العميل كان يُحدّث invoices/packages
// فقط، بينما شاشة الأقساط تعرض بيانات من مجموعة installments المنفصلة (خطة مستقلة لها
// remaining/payments خاصة بها) ولا تُحدَّث تلقائياً أبداً من هذا المسار — فتظل تعرض
// المتبقي والحالة القديمة رغم تحصيل المبلغ فعليًا. هذه الدالة تربط الاتجاه الناقص.
function _syncInstallmentPlanOnPayment({invoiceId, pkgId, paidAmount, newRemaining}){
  const plans = DB.get('installments')||[];
  let plan;
  if(invoiceId){
    plan = plans.find(p => String(p.fromInvId)===String(invoiceId));
  } else {
    // ✅ FIX (تكرار قسط الباقة): القسط اللي بيتعمل تلقائياً عند إنشاء فاتورة الباقة
    // (00-core.js → invoices:created) بيتربط بـ fromInvId (فاتورة الباقة)، مش بـ
    // fromPkgId — القسط مبيتعملش fromPkgId إلا لو جه من زرار "مزامنة الباقات"
    // (syncPackageInstallments في 06-finance.js). فكانت الدالة دي بتدور بـ fromPkgId
    // بس، متلاقيش القسط الأصلي، وترجع من غير تعديل — فيفضل القسط الأصلي عالق بالمتبقي
    // القديم، ولو "مزامنة الباقات" اتشغّلت بعدين بتضيف قسط تاني صحيح فوقه = تكرار.
    // الحل: دور بالاتنين — fromPkgId أو fromInvId بتاع فاتورة الباقة المرتبطة.
    const pkgInv = DB.get('invoices').find(i => String(i.pkgId)===String(pkgId));
    plan = plans.find(p => String(p.fromPkgId)===String(pkgId)
      || (pkgInv && String(p.fromInvId)===String(pkgInv.id)));
  }
  if(!plan) return;
  const today = new Date().toISOString().split('T')[0];
  const update = {
    remaining: newRemaining,
    downPayment: (plan.downPayment||0) + paidAmount,
    installmentAmount: newRemaining,
    status: newRemaining===0 ? 'مكتمل' : 'نشط'
  };
  if(newRemaining===0 && Array.isArray(plan.payments)){
    update.payments = plan.payments.map(x => ({...x, paid:true, paidDate:x.paidDate||today}));
  }
  DB.upd('installments', plan.id, update);
}

// ── دفع المتبقي من شاشة ملف العميل ──
function openPayFromProfile(){
  const id = window._curPat;
  if(!id){ showToast('error','❌ لا يوجد عميل محدد'); return; }
  const pat = DB.get('patients').find(p => p.id === id);
  if(!pat){ return; }

  const pendingPkgs = DB.get('packages').filter(pk =>
    pk.patId===id && ((pk.price||0)-(pk.paid||0)) > 0
  );
  // استبعاد فواتير الباقات لتجنب الاحتساب المزدوج
  // نستبعد بـ pkgId أو باسم الخدمة (للبيانات القديمة اللي pkgId فيها null)
  // ✅ FIX: الاستثناء لازم يشمل كل باقات العميل (وليس فقط "المستحقة" منها)،
  // بنفس منطق _recalcPatFinancials الموحّد في 00-core.js — وإلا فباقة أصبحت
  // مسددة بالكامل لتوّها (فخرجت من pendingPkgs) قد تترك فاتورتها المرتبطة
  // (لو لم تتزامن remaining فيها بعد لأي سبب) تظهر كمبلغ مستحق منفصل هنا.
  const _allPatPkgs = DB.get('packages').filter(pk => pk.patId===id);
  const _pkgIds = new Set(_allPatPkgs.map(pk => String(pk.id)));
  const _pkgNames = new Set(_allPatPkgs.map(pk => `باقة: ${pk.name}`));
  const pendingInvs = DB.get('invoices').filter(i =>
    (String(i.patId)===String(id) || i.patient===pat.name) &&
    (i.remaining||0) > 0 &&
    (!i.pkgId || !_pkgIds.has(String(i.pkgId))) &&
    !_pkgNames.has(i.service||'')
  );

  if(!pendingInvs.length && !pendingPkgs.length){
    showToast('info','✅ لا يوجد مبالغ متبقية لهذا العميل');
    return;
  }

  // حساب الإجمالي الكلي
  const totalInvDue  = pendingInvs.reduce((s,i)=>s+(i.remaining||0),0);
  const totalPkgDue  = pendingPkgs.reduce((s,pk)=>s+Math.max(0,(pk.price||0)-(pk.paid||0)),0);
  const grandTotal   = totalInvDue + totalPkgDue;
  const totalCount   = pendingInvs.length + pendingPkgs.length;

  // ملخص
  document.getElementById('ppay-total-due').textContent = grandTotal.toLocaleString() + ' ج';
  document.getElementById('ppay-count').textContent = totalCount;

  // بناء قائمة الفواتير والباقات
  let optionsHtml = '';
  pendingInvs.forEach(inv => {
    const rem = inv.remaining||0;
    const allInvs = DB.get('invoices');
    const idx = allInvs.findIndex(x=>String(x.id)===String(inv.id));
    optionsHtml += `<div class="pay-option" data-type="invoice" data-id="${inv.id}" data-rem="${rem}" onclick="selectPayOption(this)"
      style="padding:11px;background:var(--glass);border:2px solid var(--glass-border);border-radius:10px;cursor:pointer;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:13px;">🧾 #INV-${String(idx+1).padStart(3,'0')} — ${inv.service||'—'}</div>
          <div style="font-size:11px;color:var(--text-muted);">فاتورة · ${inv.date||'—'} · إجمالي: ${(inv.total||0).toLocaleString()} ج · مدفوع: ${(inv.paid||0).toLocaleString()} ج</div>
        </div>
        <div style="text-align:left;min-width:70px;">
          <div style="color:var(--rose);font-weight:800;font-size:15px;">${rem.toLocaleString()} ج</div>
          <div style="font-size:11px;color:var(--text-muted);">متبقي</div>
        </div>
      </div>
    </div>`;
  });
  pendingPkgs.forEach(pk => {
    const rem = Math.max(0,(pk.price||0)-(pk.paid||0));
    optionsHtml += `<div class="pay-option" data-type="package" data-id="${pk.id}" data-rem="${rem}" onclick="selectPayOption(this)"
      style="padding:11px;background:var(--glass);border:2px solid var(--glass-border);border-radius:10px;cursor:pointer;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:13px;">🎁 ${pk.name}</div>
          <div style="font-size:11px;color:var(--text-muted);">باقة علاجية · إجمالي: ${(pk.price||0).toLocaleString()} ج · مدفوع: ${(pk.paid||0).toLocaleString()} ج</div>
        </div>
        <div style="text-align:left;min-width:70px;">
          <div style="color:var(--rose);font-weight:800;font-size:15px;">${rem.toLocaleString()} ج</div>
          <div style="font-size:11px;color:var(--text-muted);">متبقي</div>
        </div>
      </div>
    </div>`;
  });

  document.getElementById('ppay-pat-name').textContent = pat.name;
  document.getElementById('ppay-options').innerHTML = optionsHtml;
  document.getElementById('ppay-amount').value = '';
  document.getElementById('ppay-method').value = 'كاش';
  document.getElementById('ppay-selected-id').value = '';
  document.getElementById('ppay-selected-type').value = '';
  document.getElementById('ppay-preview').textContent = 'اختر فاتورة أو باقة أعلاه ثم أدخل المبلغ';
  openModal('patient-pay-modal');
}

// دفع الكل دفعة واحدة (يوزع على الفواتير تسلسلياً)
function ppayPayAll(){
  const method = document.getElementById('ppay-method')?.value||'كاش';
  const patId  = window._curPat;
  const pat    = DB.get('patients').find(p=>String(p.id)===String(patId));
  if(!pat){ return; }
  const today  = new Date().toISOString().split('T')[0];

  const pendingPkgs = DB.get('packages').filter(pk =>
    pk.patId===patId && ((pk.price||0)-(pk.paid||0)) > 0
  );
  // ✅ FIX: نفس إصلاح openPayFromProfile — الاستثناء من كل باقات العميل وليس المستحقة فقط
  const _allPatPkgsForAll = DB.get('packages').filter(pk => pk.patId===patId);
  const _pkgIdsAll = new Set(_allPatPkgsForAll.map(pk => String(pk.id)));
  const _pkgNamesAll = new Set(_allPatPkgsForAll.map(pk => `باقة: ${pk.name}`));
  const pendingInvs = DB.get('invoices').filter(i =>
    (String(i.patId)===String(patId) || i.patient===pat.name) &&
    (i.remaining||0) > 0 &&
    (!i.pkgId || !_pkgIdsAll.has(String(i.pkgId))) &&
    !_pkgNamesAll.has(i.service||'')
  );

  let totalPaid = 0;
  pendingInvs.forEach(inv => {
    const rem = inv.remaining||0;
    const newPaid = (inv.paid||0) + rem;
    // paidDelta يُفعّل تسجيل cashlog تلقائياً عبر EventBus('invoices:updated') في 00-core.js
    DB.upd('invoices', inv.id, { paid:newPaid, remaining:0, status:'مدفوع', method, lastPayDate:today, paidDelta:rem });
    _syncInstallmentPlanOnPayment({ invoiceId: inv.id, paidAmount: rem, newRemaining: 0 });
    totalPaid += rem;
  });
  pendingPkgs.forEach(pk => {
    const rem = Math.max(0,(pk.price||0)-(pk.paid||0));
    DB.upd('packages', pk.id, { paid:(pk.paid||0)+rem });
    // ✅ FIX (فاتورة الباقة لا تتحدث): كان يُحدَّث pk.paid فقط، فتُغلق الباقة
    // وتتحدث patients.balance (يُحسب من packages مباشرة) لكن سجل invoices
    // المرتبط (pkgId) يبقى بمتبقي قديم — وشاشة الفواتير تقرأ من invoices
    // مباشرة فتظل تُظهر الدين القديم رغم تحصيله فعليًا.
    const pkgInv = DB.get('invoices').find(i => String(i.pkgId) === String(pk.id));
    if(pkgInv){
      const newInvPaid = Math.min(pkgInv.total||pk.price||0, (pkgInv.paid||0) + rem);
      const newInvRem  = Math.max(0, (pkgInv.total||pk.price||0) - newInvPaid);
      DB.upd('invoices', pkgInv.id, { paid:newInvPaid, remaining:newInvRem, status:newInvRem===0?'مدفوع':'جزئي' });
    }
    DB.push('cashlog',{ type:'وارد', amount:rem, source:`تسوية باقة — ${pat.name}`, service:pk.name||'', method, date:today, patId, patient:pat.name });
    _syncInstallmentPlanOnPayment({ pkgId: pk.id, paidAmount: rem, newRemaining: 0 });
    totalPaid += rem;
  });

  closeModal('patient-pay-modal');
  showToast('success', `✅ تم سداد ${totalPaid.toLocaleString()} ج بالكامل`, `تمت تسوية ${pendingInvs.length+pendingPkgs.length} فاتورة/باقة`);
  if(window._curPat && typeof viewPat==='function') viewPat(window._curPat);
}

function selectPayOption(el){
  document.querySelectorAll('.pay-option').forEach(x => x.style.border='2px solid var(--glass-border)');
  el.style.border = '2px solid var(--teal)';
  document.getElementById('ppay-selected-id').value   = el.dataset.id;
  document.getElementById('ppay-selected-type').value = el.dataset.type;
  // اقتراح المبلغ الكامل للعنصر المختار
  const rem = parseFloat(el.dataset.rem)||0;
  document.getElementById('ppay-amount').value = rem;
  updatePatPayPreview();
}

function updatePatPayPreview(){
  const amount = parseFloat(document.getElementById('ppay-amount')?.value)||0;
  const type   = document.getElementById('ppay-selected-type')?.value;
  const id     = document.getElementById('ppay-selected-id')?.value;
  const prev   = document.getElementById('ppay-preview');
  if(!id||!type){ if(prev) prev.textContent='اختر فاتورة أو باقة أعلاه'; return; }
  if(amount<=0){ if(prev) prev.textContent='أدخل المبلغ المراد سداده'; return; }
  if(type==='invoice'){
    const inv = DB.get('invoices').find(i=>String(i.id)===String(id));
    if(inv){
      if(amount > (inv.remaining||0)){ if(prev) prev.innerHTML=`<span style="color:var(--rose)">⚠️ المبلغ أكبر من المتبقي (${(inv.remaining||0).toLocaleString()} ج)</span>`; return; }
      const newRem = Math.max(0,(inv.remaining||0)-amount);
      if(prev) prev.innerHTML = `سيُضاف <b style="color:var(--emerald)">${amount.toLocaleString()} ج</b> — المتبقي بعد الدفع: <b style="color:${newRem>0?'var(--amber)':'var(--teal)'}">${newRem.toLocaleString()} ج</b> ${newRem===0?'<span style="color:var(--teal)">✅ مغلقة</span>':''}`;
    }
  } else {
    const pk = DB.get('packages').find(p=>String(p.id)===String(id));
    if(pk){
      const rem = Math.max(0,(pk.price||0)-(pk.paid||0));
      if(amount > rem){ if(prev) prev.innerHTML=`<span style="color:var(--rose)">⚠️ المبلغ أكبر من المتبقي (${rem.toLocaleString()} ج)</span>`; return; }
      const newRem = Math.max(0,rem-amount);
      if(prev) prev.innerHTML = `سيُضاف <b style="color:var(--emerald)">${amount.toLocaleString()} ج</b> على الباقة — المتبقي: <b style="color:${newRem>0?'var(--amber)':'var(--teal)'}">${newRem.toLocaleString()} ج</b> ${newRem===0?'<span style="color:var(--teal)">✅ مسددة</span>':''}`;
    }
  }
}

function processPatientPayment(){
  const amount = parseFloat(document.getElementById('ppay-amount')?.value)||0;
  const method = document.getElementById('ppay-method')?.value||'كاش';
  const type   = document.getElementById('ppay-selected-type')?.value;
  const id     = document.getElementById('ppay-selected-id')?.value;
  const patId  = window._curPat;

  if(!id||!type){ showToast('warning','⚠️ اختر فاتورة أو باقة أولاً'); return; }
  if(amount<=0){ showToast('warning','⚠️ أدخل مبلغاً صحيحاً'); return; }

  const today = new Date().toISOString().split('T')[0];

  if(type==='invoice'){
    const inv = DB.get('invoices').find(i=>String(i.id)===String(id));
    if(!inv){ showToast('error','❌ الفاتورة غير موجودة'); return; }
    if(amount > (inv.remaining||0)){ showToast('warning',`⚠️ المبلغ أكبر من المتبقي (${(inv.remaining||0).toLocaleString()} ج)`); return; }
    const newPaid = (inv.paid||0)+amount;
    const newRem  = Math.max(0,(inv.remaining||0)-amount);
    DB.upd('invoices',id,{ paid:newPaid, remaining:newRem, status:newRem===0?'مدفوع':'جزئي', method, lastPayDate:today, paidDelta:amount }); // paidDelta → cashlog عبر EventBus
    _syncInstallmentPlanOnPayment({ invoiceId:id, paidAmount:amount, newRemaining:newRem });
    showToast('success',`✅ تم استلام ${amount.toLocaleString()} ج`, newRem===0?'الفاتورة مغلقة بالكامل':'المتبقي: '+newRem.toLocaleString()+' ج');
  } else {
    const pk = DB.get('packages').find(p=>String(p.id)===String(id));
    if(!pk){ showToast('error','❌ الباقة غير موجودة'); return; }
    const rem = Math.max(0,(pk.price||0)-(pk.paid||0));
    if(amount > rem){ showToast('warning',`⚠️ المبلغ أكبر من المتبقي (${rem.toLocaleString()} ج)`); return; }
    const newPaid = (pk.paid||0)+amount;
    DB.upd('packages',id,{ paid:newPaid });
    // ✅ FIX (فاتورة الباقة لا تتحدث): نفس إصلاح ppayPayAll — تحديث الفاتورة
    // المرتبطة بالباقة (pkgId) حتى لا تفضل شاشة الفواتير عارضة متبقي قديم.
    const pkgInv = DB.get('invoices').find(i => String(i.pkgId) === String(pk.id));
    if(pkgInv){
      const newInvPaid = Math.min(pkgInv.total||pk.price||0, (pkgInv.paid||0) + amount);
      const newInvRem  = Math.max(0, (pkgInv.total||pk.price||0) - newInvPaid);
      DB.upd('invoices', pkgInv.id, { paid:newInvPaid, remaining:newInvRem, status:newInvRem===0?'مدفوع':'جزئي' });
    }
    const _patObj = DB.get('patients').find(p=>String(p.id)===String(patId));
    DB.push('cashlog',{ type:'وارد', amount, source:`دفعة باقة — ${_patObj?.name||pk.patName||''}`, service:pk.name||'', method, date:today, patId, patient:_patObj?.name||pk.patName||'' });
    _syncInstallmentPlanOnPayment({ pkgId:id, paidAmount:amount, newRemaining:Math.max(0, rem-amount) });
    showToast('success',`✅ تم استلام ${amount.toLocaleString()} ج على الباقة "${pk.name}"`);
  }
  closeModal('patient-pay-modal');
  if(window._curPat && typeof viewPat==='function') viewPat(window._curPat);
}

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
function toggleMedSection(){
  const skinChk = document.getElementById('pm-chk-skin');
  const hairChk = document.getElementById('pm-chk-hair');
  const skinSec = document.getElementById('pm-skin-section');
  const hairSec = document.getElementById('pm-hair-section');
  if(skinSec) skinSec.style.display = skinChk&&skinChk.checked ? 'block' : 'none';
  if(hairSec) hairSec.style.display = hairChk&&hairChk.checked ? 'block' : 'none';
}

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
  // استعادة checkboxes الملف الطبي
  const skinChk = document.getElementById('pm-chk-skin');
  const hairChk = document.getElementById('pm-chk-hair');
  if(skinChk) skinChk.checked = p ? !!(p.skin||p.skinProbs) : false;
  if(hairChk) hairChk.checked = p ? !!(p.hair||p.hairProbs) : false;
  toggleMedSection();
  openModal('patient-modal');
}

function savePat(){
  const name  = gv('pm-name').trim();
  const phone = gv('pm-phone').trim();
  if(!name||!phone){ showToast('warning','⚠️ الاسم والهاتف مطلوبان'); return; }
  const id   = gv('pm-id');
  const data = {
    name, phone, email:gv('pm-email'), gender:gv('pm-gender')||'أنثى',
    skin: (document.getElementById('pm-chk-skin')?.checked ? gv('pm-skin') : ''),
    hair: (document.getElementById('pm-chk-hair')?.checked ? gv('pm-hair') : ''),
    skinProbs: (document.getElementById('pm-chk-skin')?.checked ? gv('pm-skinp') : ''),
    hairProbs: (document.getElementById('pm-chk-hair')?.checked ? gv('pm-hairp') : ''),
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
  ['pm-chk-skin','pm-chk-hair'].forEach(i => { const e=document.getElementById(i); if(e) e.checked=false; });
  toggleMedSection();
}
