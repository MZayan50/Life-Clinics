// THEME
function applyTheme(t){
  const html=document.documentElement,btn=document.getElementById('theme-btn'),meta=document.getElementById('theme-color-meta'),lbl=document.getElementById('theme-lbl');
  if(t==='light'){html.classList.add('light');if(btn)btn.textContent='☀️';if(meta)meta.content='#F0F4F8';if(lbl)lbl.textContent='فاتح ☀️';}
  else{html.classList.remove('light');if(btn)btn.textContent='🌙';if(meta)meta.content='#0A0D14';if(lbl)lbl.textContent='داكن 🌙';}
  localStorage.setItem('ha_theme',t);
}
function toggleTheme(){applyTheme(localStorage.getItem('ha_theme')==='light'?'dark':'light');}
function useSysTheme(){localStorage.removeItem('ha_theme');applyTheme(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');showToast('info','🎨 سيتابع ثيم الجهاز تلقائياً');}
(function(){const s=localStorage.getItem('ha_theme');applyTheme(s||(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'));})();
window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change',e=>{if(!localStorage.getItem('ha_theme'))applyTheme(e.matches?'dark':'light');});

// NAVIGATION
// ✅ TITLES و showScreen موحدتان في 00-core.js
// لا تعريف هنا لتجنب التعارض

// MOBILE SIDEBAR
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sb-overlay').classList.toggle('open');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sb-overlay').classList.remove('open');}
let _tx=0;
document.addEventListener('touchstart',e=>_tx=e.touches[0].clientX,{passive:true});
document.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-_tx;if(dx<-55)closeSidebar();if(dx>55&&_tx<30)toggleSidebar();},{passive:true});

// MODAL
function openModal(id){document.getElementById(id)?.classList.add('open');fillPatDropdowns();fillDocDropdowns();fillSvcDropdowns();}
function closeModal(id){document.getElementById(id)?.classList.remove('open');}
document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');}));
function fillPatDropdowns(){
  const pats=DB.get('patients');
  ['am-pat','im-pat','photo-pat'].forEach(did=>{const sel=document.getElementById(did);if(!sel)return;const cur=sel.value;sel.innerHTML='<option value="">-- اختر عميل --</option>'+pats.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');if(cur)sel.value=cur;});
}

// TABS
const ALL_TABS=['t-med','t-ses','t-inv','t-ph','t-hist','se-gen','se-fb','se-perm','se-notif','se-data','acc-pl','acc-bs','acc-cf'];
function stab(el,gid,tid){
  document.getElementById(gid)?.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  ALL_TABS.forEach(i=>{const e=document.getElementById(i);if(e)e.style.display='none';});
  const t=document.getElementById(tid);if(t)t.style.display='block';
  if(tid==='se-perm') setTimeout(renderUsers, 50);
  if(tid==='se-data' && typeof renderChartOfAccounts==='function') setTimeout(renderChartOfAccounts, 50);
}

// TOAST
function showToast(type,msg,sub=''){
  const IC={success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
  const tc=document.getElementById('toast-c');
  const t=document.createElement('div');
  t.className=`toast ${type}`;
  t.innerHTML=`<div class="ticon">${IC[type]||'ℹ️'}</div><div class="ttxt"><p>${msg}</p>${sub?`<span>${sub}</span>`:''}</div><div class="tclose" onclick="this.parentElement.remove()">✕</div>`;
  tc.appendChild(t);
  setTimeout(()=>{t.style.transition='all .3s';t.style.opacity='0';t.style.transform='translateY(8px)';setTimeout(()=>t.remove(),300);},4000);
}

// ══════════════════════════════════════════
// 💰 مصدر الإيراد الموحّد للداشبورد — cashlog فقط
// ══════════════════════════════════════════
// ✅ FIX (مشكلة #6): كل حسابات إيراد الداشبورد كانت مبنية على invoices.filter(...).reduce(paid)
// وهذا يتجاهل تماماً إيراد "خطط الجلسات" (يُسجَّل في cashlog مباشرة دون فاتورة — متعمَّد وموثَّق
// في 12-financial-integration.js). لكن كل مصادر الإيراد الأخرى (فاتورة، دفعة جزئية، قسط، دفعة
// باقة، بيع منتج) تُسجَّل بالفعل في cashlog أيضاً (راجع 00-core.js, 04-invoices.js, 06-finance.js,
// 07-clinical.js, 05-inventory.js) — فـ cashlog هو بالفعل المصدر الموحَّد الصحيح والكامل، تماماً
// كما تعتمد عليه شاشة الحسابات الختامية (06-finance.js). هذه الدالة توحّد الداشبورد على نفس المصدر.
function _dashCashRevenue({ date, monthKey, branch } = {}){
  const cashlog = DB.get('cashlog') || [];
  let rows = cashlog.filter(c => c.type === 'وارد');
  if(date)     rows = rows.filter(c => c.date === date);
  if(monthKey) rows = rows.filter(c => (c.date||'').startsWith(monthKey));
  if(branch){
    const patById = {};
    DB.get('patients').forEach(p => { patById[p.id] = p; });
    rows = rows.filter(c => {
      // معظم قيود الفاتورة/القسط تحمل branch مباشرة. قيود الجلسات وبعض دفعات الباقات
      // لا تحمل branch، فنرجع لفرع العميل نفسه عبر patId كحل بديل دقيق.
      if(c.branch) return c.branch === branch;
      const pat = c.patId ? patById[c.patId] : null;
      return pat ? pat.branch === branch : false;
    });
  }
  return rows.reduce((s,c) => s + (c.amount||0), 0);
}

// CHART — real data from DB
function buildChart(){
  const chart=document.getElementById('revenue-chart'),labels=document.getElementById('revenue-labels');if(!chart)return;
  const invoices=DB.get('invoices');
  // Build last 7 months
  const now=new Date();
  const monthsData=[];
  const monthNames=[];
  const MN2=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  for(let i=6;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const rev=_dashCashRevenue({monthKey:key});
    monthsData.push(rev);
    monthNames.push(MN2[d.getMonth()].slice(0,3));
  }
  const max=Math.max(...monthsData,1);
  chart.innerHTML=monthsData.map((v,i)=>`<div class="bar" style="background:${i===6?'var(--teal)':'var(--glass-border)'};height:${Math.max(v/max*100,4)}%;min-height:6px;transition:height .5s ease;" title="${monthNames[i]}: ${v.toLocaleString()} ج" onclick="showToast('info','📅 ${monthNames[i]}: '+${v}.toLocaleString()+' ج')"></div>`).join('');
  if(labels)labels.innerHTML=monthNames.map((m,i)=>`<div class="blbl" style="flex:1;color:${i===6?'var(--teal)':'var(--text-muted)'}">${m}</div>`).join('');

  // Update dashboard service distribution from real invoices
  updateServiceDistribution();
  buildTopDoctors();
}

// ⚠️ ملاحظة موثَّقة (خطة التوحيد — مرحلة 1.4، الاستثناء الوحيد المقبول):
// هذه الدالة تعتمد على invoices.paid (تاريخ إصدار الفاتورة) وليس cashlog
// (تاريخ التحصيل الفعلي) كباقي الداشبورد، لأن cashlog لا يحمل اسم الخدمة
// بنفس الدقة المطلوبة لتوزيع الإيراد على كل خدمة. لذلك الرقم هنا *تقريبي*
// ولا يجب توقع تطابقه حرفياً مع رقم الإيراد الرئيسي (kpi-rev) في نفس
// الشاشة، والمبني على cashlog. هذا قرار مقصود ومُوثَّق — وليس باجاً منسياً.
function updateServiceDistribution(){
  const el = document.getElementById('dash-svc-dist');
  if(!el) return;
  const COLORS = ['var(--teal)','var(--purple)','var(--gold)','var(--rose)','var(--amber)','var(--blue)','var(--emerald)'];
  const thisMonth = new Date().toISOString().substring(0,7);
  const invoices = DB.get('invoices').filter(i=>(i.date||'').startsWith(thisMonth));
  const svcMap = {};
  invoices.forEach(inv=>{
    const svc = (inv.service||inv.items?.[0]?.name||'أخرى').trim()||'أخرى';
    svcMap[svc] = (svcMap[svc]||0) + (inv.paid||0);
  });
  const total = Object.values(svcMap).reduce((a,b)=>a+b,0);
  if(!total){
    el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">لا توجد فواتير هذا الشهر بعد</div>';
    return;
  }
  const sorted = Object.entries(svcMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  let otherSum = Object.values(svcMap).reduce((a,b)=>a+b,0) - sorted.reduce((a,b)=>a+b[1],0);
  if(otherSum>0) sorted.push(['أخرى', otherSum]);
  el.innerHTML = sorted.map(([name,val],i)=>{
    const pct = Math.round(val/total*100);
    const color = COLORS[i % COLORS.length];
    return `<div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span>${name}</span><span style="color:${color};font-weight:700">${pct}%</span></div><div class="prog"><div class="prog-f" style="width:${pct}%;background:${color}"></div></div></div>`;
  }).join('');
}

function buildTopDoctors(){
  const el = document.getElementById('dash-top-doctors');
  if(!el) return;
  const thisMonth = new Date().toISOString().substring(0,7);
  const invoices = DB.get('invoices').filter(i=>(i.date||'').startsWith(thisMonth));
  const appointments = DB.get('appointments');
  const docRev = {};
  invoices.forEach(inv=>{
    // أولوية 1: doctorId مباشرة في الفاتورة
    // أولوية 2: اسم الطبيب في الفاتورة مباشرة
    // أولوية 3: البحث في الموعد المرتبط
    let doc = (inv.doctor||'').trim();
    if(!doc){
      const appt = appointments.find(a=>
        (inv.appointmentId && a.id===inv.appointmentId) ||
        (a.patientId===inv.patientId && a.date===inv.date) ||
        (a.patient===inv.patient && a.date===inv.date)
      );
      doc = (appt?.doctor||'').trim();
    }
    if(!doc) return;
    docRev[doc] = (docRev[doc]||0) + (inv.paid||0);
  });
  // أضف الأطباء الذين لديهم مواعيد هذا الشهر حتى لو بدون فواتير
  appointments.filter(a=>(a.date||'').startsWith(thisMonth)).forEach(a=>{
    if(a.doctor && !(a.doctor in docRev)) docRev[a.doctor] = 0;
  });
  const sorted = Object.entries(docRev).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  const grads = [
    'linear-gradient(135deg,#8B5CF6,#3B82F6)',
    'linear-gradient(135deg,#10B981,#2DD4BF)',
    'linear-gradient(135deg,#F59E0B,#EF4444)',
    'linear-gradient(135deg,#C4A882,#8B5CF6)',
    'linear-gradient(135deg,#F43F5E,#F59E0B)'
  ];
  if(!sorted.length){
    // Fallback to doctors DB list
    const docs = DB.get('doctors').slice(0,4);
    if(!docs.length){ el.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:16px;font-size:13px">لا توجد بيانات أطباء بعد</div>'; return; }
    el.innerHTML = docs.map((d,i)=>`<div class="drow"><div class="drank">${medals[i]||'⭐'}</div><div class="dava" style="background:${grads[i%5]}">👩‍⚕️</div><div style="flex:1;font-size:13px;font-weight:600">${d.name}</div><div style="color:var(--text-muted);font-size:12px">${d.specialty||'—'}</div></div>`).join('');
    return;
  }
  el.innerHTML = sorted.map(([name,rev],i)=>`<div class="drow"><div class="drank">${medals[i]||'⭐'}</div><div class="dava" style="background:${grads[i%5]}">👩‍⚕️</div><div style="flex:1;font-size:13px;font-weight:600">${name}</div><div style="color:var(--teal);font-weight:700;font-size:12.5px">${rev.toLocaleString()} ج</div></div>`).join('');
}



// ══════════════════════════════════════════
// 🤖 AI ASSISTANT — FULL IMPLEMENTATION
// ══════════════════════════════════════════
const AI_QUICK_PROMPTS = [
  { icon:'📊', label:'تحليل الإيرادات',    sub:'أداء المبيعات',          q:'__REV_PROMPT__' },
  { icon:'💆', label:'خطة علاج',            sub:'بناءً على الملف الطبي',  q:'اقترح خطة علاج متكاملة لعميلة بشرة دهنية مع حب شباب وتصبغات' },
  { icon:'📦', label:'توقع المخزون',        sub:'الاحتياجات القادمة',     q:'توقع احتياجات مخزون عيادة تجميل للشهر القادم بناءً على الخدمات الأكثر طلباً' },
  { icon:'⏰', label:'تحسين المواعيد',      sub:'تحليل أوقات الذروة',     q:'ما أفضل أوقات المواعيد في عيادة تجميل وكيف نزيد الحجوزات وتقليل الغيابات؟' },
  { icon:'🎯', label:'تحليل العملاء',       sub:'الاحتفاظ والولاء',       q:'اقترح استراتيجيات للاحتفاظ بعملاء عيادة تجميل وزيادة معدل العودة' },
  { icon:'💰', label:'تحليل الأرباح',       sub:'الخدمات الأكثر ربحية',   q:'أي خدمات التجميل تحقق أعلى هامش ربح وكيف نركز عليها؟' },
  { icon:'📣', label:'حملة تسويقية',        sub:'زيادة الحجوزات',         q:'اقترح حملة تسويقية لعيادة تجميل على السوشيال ميديا لشهر رمضان' },
  { icon:'🩺', label:'بروتوكول الجلسات',   sub:'أفضل الممارسات',         q:'ما البروتوكول الصحيح لجلسات الليزر وكيف نضمن أفضل نتائج للعملاء؟' },
];

const AI_SYSTEM_PROMPT = `أنت مساعد ذكي متخصص لعيادات الحياة للتجميل. دورك تحليل البيانات وتقديم توصيات عملية ومهنية لمدير العيادة.

قواعد الرد:
- اجب بالعربية الفصحى البسيطة
- استخدم الأرقام والنسب المئوية عند الإمكان
- قدم توصيات عملية وقابلة للتنفيذ
- استخدم نقاط واضحة ومرتبة
- لا تذكر أنك نموذج AI
- ركز على الجانب التجاري والطبي للعيادة`;

// State
window._aiMessages = [];
window._aiLoading = false;

function aiGetSystemPrompt(){
  const pc = DB.get('patients').length;
  const ac = DB.get('appointments').filter(a=>a.date===new Date().toISOString().split('T')[0]).length;
  const ic = DB.get('inventory').filter(i=>i.status==='منخفض'||i.status==='نفذ').length;
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0,7);
  const rev = _dashCashRevenue({date: today});
  const monthRev = _dashCashRevenue({monthKey: thisMonth});
  const branches = [...new Set(DB.get('patients').map(p=>p.branch).filter(Boolean))];
  const branchStr = branches.length ? branches.join('، ') : 'مدينة نصر والمهندسين';
  // Fix dynamic revenue prompt
  AI_QUICK_PROMPTS[0].q = `حلل إيرادات هذا الشهر (${monthRev.toLocaleString()} ج) وقدم توصيات لزيادتها`;
  return AI_SYSTEM_PROMPT + `\n\nبيانات العيادة الحالية:\n- ${pc} عميل نشط\n- ${ac} مواعيد اليوم\n- إيرادات اليوم: ${rev.toLocaleString()} ج\n- إيرادات الشهر: ${monthRev.toLocaleString()} ج\n- ${ic} منتجات مخزون منخفض\n- الفروع: ${branchStr}\n- خدمات رئيسية: هيدرافيشل، ليزر، بوتكس، بلازما، تنظيف بشرة`;
}

function aiFormatText(text){
  return text.split('\n').map(line => {
    if(line.startsWith('**') && line.endsWith('**'))
      return `<div style="font-weight:700;color:var(--gold-light);margin-top:10px;margin-bottom:3px;">${line.slice(2,-2)}</div>`;
    if(line.startsWith('- ') || line.startsWith('• '))
      return `<div style="padding-right:16px;position:relative;margin-bottom:4px;"><span style="position:absolute;right:0;color:var(--teal);">•</span>${line.slice(2)}</div>`;
    if(/^\d+\./.test(line))
      return `<div style="padding-right:20px;position:relative;margin-bottom:4px;"><span style="position:absolute;right:0;color:var(--gold-light);font-weight:700;">${line.match(/^\d+/)[0]}.</span>${line.replace(/^\d+\.\s*/,'')}</div>`;
    if(line === '') return '<div style="height:6px;"></div>';
    return `<div style="margin-bottom:2px;">${line}</div>`;
  }).join('');
}

function aiRenderMessages(){
  const chat = document.getElementById('ai-chat');
  if(!chat) return;
  const empty = document.getElementById('ai-empty');
  if(empty) empty.style.display = window._aiMessages.length === 0 && !window._aiLoading ? 'block' : 'none';

  // Remove old message nodes (keep empty placeholder)
  Array.from(chat.querySelectorAll('.ai-msg')).forEach(el => el.remove());

  window._aiMessages.forEach(msg => {
    const wrap = document.createElement('div');
    wrap.className = 'ai-msg';
    wrap.style.cssText = `display:flex;justify-content:${msg.role==='user'?'flex-start':'flex-end'};`;
    if(msg.role === 'user'){
      wrap.innerHTML = `<div style="max-width:85%;padding:12px 16px;border-radius:14px 14px 14px 3px;background:linear-gradient(135deg,rgba(196,168,130,.18),rgba(45,212,191,.12));border:1px solid rgba(196,168,130,.2);font-size:13.5px;line-height:1.8;color:var(--text-primary);">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:11.5px;color:#94A3B8;"><span>👩‍⚕️</span> أنت</div>
        ${msg.text}
      </div>`;
    } else {
      wrap.innerHTML = `<div style="max-width:85%;padding:12px 16px;border-radius:14px 14px 3px 14px;background:${msg.isError?'rgba(244,63,94,.08)':'rgba(255,255,255,.06)'};border:1px solid ${msg.isError?'rgba(244,63,94,.2)':'rgba(255,255,255,.08)'};font-size:13.5px;line-height:1.8;color:${msg.isError?'var(--rose)':'var(--text-primary)'};">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:11.5px;color:#64748B;"><span>🤖</span> المساعد الذكي</div>
        ${msg.isError ? msg.text : aiFormatText(msg.text)}
      </div>`;
    }
    chat.appendChild(wrap);
  });

  // Loading bubble
  const oldLoader = document.getElementById('ai-loader');
  if(oldLoader) oldLoader.remove();
  if(window._aiLoading){
    const ld = document.createElement('div');
    ld.id = 'ai-loader';
    ld.className = 'ai-msg';
    ld.style.cssText = 'display:flex;justify-content:flex-end;';
    ld.innerHTML = `<div style="padding:12px 18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px 14px 3px 14px;font-size:13px;color:#64748B;display:flex;align-items:center;gap:10px;">
      <div style="display:flex;gap:5px;">
        <span class="ai-dot" style="animation-delay:0s"></span>
        <span class="ai-dot" style="animation-delay:0.2s"></span>
        <span class="ai-dot" style="animation-delay:0.4s"></span>
      </div>
      يحلل البيانات...
    </div>`;
    chat.appendChild(ld);
  }

  chat.scrollTop = chat.scrollHeight;

  // Update send button & clear button
  const btn = document.getElementById('ai-send-btn');
  const inp = document.getElementById('ai-inp');
  const clearBtn = document.getElementById('ai-clear-btn');
  if(btn){
    const hasText = inp && inp.value.trim().length > 0;
    const disabled = window._aiLoading || !hasText;
    btn.disabled = disabled;
    btn.style.background = disabled ? 'rgba(255,255,255,.06)' : 'linear-gradient(135deg,var(--gold),#9A7050)';
    btn.style.color = disabled ? '#475569' : '#fff';
    btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
    btn.style.boxShadow = disabled ? 'none' : '0 3px 14px rgba(196,168,130,.3)';
    btn.textContent = window._aiLoading ? '⏳' : 'إرسال ↩';
  }
  if(clearBtn) clearBtn.style.display = window._aiMessages.length > 0 ? 'block' : 'none';
}

async function aiSend(q){
  const inp = document.getElementById('ai-inp');
  const question = q || (inp ? inp.value.trim() : '');
  if(!question || window._aiLoading) return;
  if(inp) { inp.value = ''; inp.style.height = 'auto'; }

  window._aiMessages.push({ role:'user', text: question });
  window._aiLoading = true;
  aiRenderMessages();

  // Check API key before sending
  const _apiKey = (localStorage.getItem('ha_anthropic_key')||DB.obj('settings').anthropicKey||'').trim();
  if(!_apiKey){
    window._aiMessages.push({ role:'assistant', text:'🔑 لم يتم إعداد مفتاح Anthropic API بعد.\n\nادخل الإعدادات ⚙️ ← تبويب عام ← حقل «مفتاح Anthropic API» والصق مفتاحك ثم اضغط حفظ.\n\nبعد الحفظ سيعمل المساعد على جميع الأجهزة تلقائياً ☁️', isError:true });
    window._aiLoading = false;
    aiRenderMessages();
    return;
  }

  try {
    const history = window._aiMessages.slice(0,-1).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text
    }));
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: aiGetSystemPrompt(),
        messages: [...history, { role:'user', content: question }]
      })
    });
    if(res.status === 401){
      const hasKey = !!(localStorage.getItem('ha_anthropic_key')||DB.obj('settings').anthropicKey||'').trim();
      window._aiMessages.push({ role:'assistant', text: hasKey
        ? '🔑 مفتاح Anthropic API غير صحيح. تحقق منه في الإعدادات ⚙️ ← تبويب عام.'
        : '🔑 لم يتم إعداد مفتاح Anthropic API بعد.\n\nادخل الإعدادات ⚙️ ← تبويب عام ← حقل «مفتاح Anthropic API» والصق مفتاحك ثم اضغط حفظ.\n\nبعد الحفظ سيعمل المساعد على جميع الأجهزة تلقائياً.', isError:true });
    } else if(!res.ok){
      const err = await res.json().catch(()=>({}));
      window._aiMessages.push({ role:'assistant', text:`❌ خطأ من الخادم (${res.status}): ${err?.error?.message||'حاول مرة أخرى'}`, isError:true });
    } else {
      const data = await res.json();
      const reply = data.content?.[0]?.text || 'عذراً، لم أتمكن من الإجابة.';
      window._aiMessages.push({ role:'assistant', text: reply });
    }
  } catch(e) {
    window._aiMessages.push({ role:'assistant', text:'❌ تعذر الاتصال بـ Anthropic API. تحقق من الإنترنت ومفتاح الـ API.', isError:true });
  }

  window._aiLoading = false;
  aiRenderMessages();
}

// Old askAI kept as alias for backward compat (dashboard quick buttons)
function askAI(q){ aiSwitchTab('chat'); aiSend(q); }

function aiClearChat(){
  window._aiMessages = [];
  window._aiLoading = false;
  aiRenderMessages();
}

function aiSwitchTab(tab){
  const chat = document.getElementById('ai-panel-chat');
  const prompts = document.getElementById('ai-panel-prompts');
  const tChat = document.getElementById('ai-tab-chat');
  const tPrompts = document.getElementById('ai-tab-prompts');
  const activeStyle = 'background:var(--bg-secondary);color:var(--text-primary);box-shadow:0 2px 8px rgba(0,0,0,.25);';
  const inactiveStyle = 'background:transparent;color:var(--text-muted);box-shadow:none;';
  if(tab === 'chat'){
    if(chat) chat.style.display = 'block';
    if(prompts) prompts.style.display = 'none';
    if(tChat) tChat.style.cssText += activeStyle;
    if(tPrompts) tPrompts.style.cssText += inactiveStyle;
  } else {
    if(chat) chat.style.display = 'none';
    if(prompts){ prompts.style.display = 'grid'; aiRenderPrompts(); }
    if(tChat) tChat.style.cssText += inactiveStyle;
    if(tPrompts) tPrompts.style.cssText += activeStyle;
  }
}

function aiRenderPrompts(){
  const grid = document.getElementById('ai-panel-prompts');
  if(!grid) return;
  grid.innerHTML = AI_QUICK_PROMPTS.map(p => `
    <div onclick="aiSwitchTab('chat');aiSend('${p.q.replace(/'/g,"\\'")}');"
      style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:var(--radius);padding:18px;cursor:pointer;transition:all .22s;"
      onmouseover="this.style.background='var(--bg-card-hover)';this.style.transform='translateY(-2px)';this.style.borderColor='rgba(196,168,130,.3)';"
      onmouseout="this.style.background='var(--bg-card)';this.style.transform='translateY(0)';this.style.borderColor='var(--glass-border)';">
      <div style="font-size:24px;margin-bottom:8px;">${p.icon}</div>
      <div style="font-size:13px;font-weight:700;margin-bottom:4px;">${p.label}</div>
      <div style="font-size:11.5px;color:var(--text-muted);">${p.sub}</div>
    </div>`).join('');
}

function aiRenderChips(){
  const chips = document.getElementById('ai-chips');
  if(!chips) return;
  chips.innerHTML = AI_QUICK_PROMPTS.slice(0,4).map(p =>
    `<button onclick="aiSend('${p.q.replace(/'/g,"\\'")}');"
      style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:5px 13px;color:#94A3B8;cursor:pointer;font-size:12px;font-family:'Tajawal',sans-serif;transition:all .18s;"
      onmouseover="this.style.borderColor='rgba(196,168,130,.4)';this.style.color='var(--gold-light)';"
      onmouseout="this.style.borderColor='rgba(255,255,255,.1)';this.style.color='#94A3B8';">
      ${p.icon} ${p.label}
    </button>`).join('');
}

// ✅ 'ai' screen render في showScreen الموحدة بـ 00-core.js

// Watch input to toggle send button
document.addEventListener('input', e => {
  if(e.target.id === 'ai-inp') aiRenderMessages();
});

// 🔔 REAL-TIME DASHBOARD ALERTS
// ══════════════════════════════════════════
function buildDashAlerts(){
  const alerts=[];
  const today=new Date().toISOString().split('T')[0];
  const tomorrow=new Date(Date.now()+86400000).toISOString().split('T')[0];

  // Low/out stock
  const lowStock=DB.get('inventory').filter(i=>i.status==='منخفض'||i.status==='نفذ');
  lowStock.slice(0,3).forEach(i=>{
    alerts.push({cls:'ali-w',icon:'📦',title:`${i.name}: ${i.status==='نفذ'?'نفذ من المخزون':'مخزون منخفض'}`,sub:`متبقي ${i.qty} وحدة`,action:()=>showScreen('inventory')});
  });

  // Overdue installments
  const overdue=DB.get('invoices').filter(i=>i.remaining>0);
  if(overdue.length){
    alerts.push({cls:'ali-d',icon:'💳',title:`${overdue.length} مدفوعات معلقة`,sub:`إجمالي ${overdue.reduce((s,i)=>s+(i.remaining||0),0).toLocaleString()} ج`,action:()=>showScreen('installments')});
  }

  // Tomorrow appointments reminder
  const tomorrowAppts=DB.get('appointments').filter(a=>a.date===tomorrow&&a.status==='مؤكد');
  if(tomorrowAppts.length){
    alerts.push({cls:'ali-i',icon:'📅',title:`${tomorrowAppts.length} مواعيد غداً بلا تذكير`,sub:'اضغط لإرسال تذكيرات واتساب',action:()=>{showScreen('whatsapp');sendBulkWAReminders();}});
  }

  // Expiring inventory
  const expiring=DB.get('inventory').filter(i=>{
    if(!i.expiry)return false;
    const diff=(new Date(i.expiry)-new Date())/(1000*60*60*24);
    return diff>0&&diff<30;
  });
  if(expiring.length){
    alerts.push({cls:'ali-w',icon:'⏰',title:`${expiring.length} منتجات قاربت على الانتهاء`,sub:`خلال 30 يوماً`,action:()=>showScreen('inventory')});
  }

  // Overdue sessions
  const incompleteSess=DB.get('sessions').filter(s=>s.status==='جارية');
  if(incompleteSess.length){
    alerts.push({cls:'ali-i',icon:'✨',title:`${incompleteSess.length} خطط جلسات جارية`,sub:`${incompleteSess.reduce((s,x)=>s+(x.total-x.done||0),0)} جلسة متبقية`,action:()=>showScreen('sessions')});
  }

  const el=document.getElementById('dash-alerts');
  const countEl=document.getElementById('alerts-count');
  if(countEl)countEl.textContent=alerts.length?`${alerts.length} تنبيهات`:'';
  if(el){
    el.innerHTML=alerts.length?alerts.map(a=>`
      <div class="ali ${a.cls}" style="cursor:${a.action?'pointer':'default'}" onclick="${a.action?'('+a.action.toString()+')()':''}">
        <div class="ai-ico">${a.icon}</div>
        <div class="ai-txt"><p>${a.title}</p><span>${a.sub}</span></div>
      </div>`).join('')
      :'<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">✅ لا توجد تنبيهات الآن</div>';
  }

  // Update notification dot
  const dot=document.getElementById('notif-dot');
  if(dot)dot.style.display=alerts.length?'block':'none';

  // Fill notification dropdown
  buildNotifList(alerts);
}

function buildNotifList(alerts){
  const list=document.getElementById('notif-list');if(!list)return;
  list.innerHTML=alerts.length?alerts.map(a=>`
    <div class="ali ${a.cls}" style="margin-bottom:8px;cursor:pointer;" onclick="closeNotifDropdown()">
      <div class="ai-ico">${a.icon}</div>
      <div class="ai-txt"><p>${a.title}</p><span>${a.sub}</span></div>
    </div>`).join('')
    :'<div style="text-align:center;color:var(--text-muted);padding:16px;font-size:13px">✅ لا توجد إشعارات</div>';
}

function toggleNotifDropdown(btn){
  const dd=document.getElementById('notif-dropdown');if(!dd)return;
  if(dd.style.display==='none'||!dd.style.display){
    dd.style.display='block';
    buildDashAlerts();
    setTimeout(()=>document.addEventListener('click',function rmNd(e){if(!dd.contains(e.target)&&e.target!==btn){dd.style.display='none';document.removeEventListener('click',rmNd);}},100));
  } else {
    dd.style.display='none';
  }
}

function closeNotifDropdown(){
  const dd=document.getElementById('notif-dropdown');if(dd)dd.style.display='none';
}

// ══════════════════════════════════════════
// 📥 IMPORT DATA (JSON backup)
// ══════════════════════════════════════════
function importData(){
  const input=document.createElement('input');
  input.type='file';input.accept='.json';
  input.onchange=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data=JSON.parse(ev.target.result);
        const KEYS=['patients','appointments','inventory','invoices','services','leads','expenses','doctors','staff','sessions','packages','installments','suppliers','purchases','transfers','campaigns'];
        let imported=0;
        KEYS.forEach(k=>{
          if(data[k]&&Array.isArray(data[k])){
            // ✅ اكتب كل record عبر DB.push ليصل Firestore مباشرة
            // امسح القديم أولاً ثم أضف الجديد
            const existing = DB.get(k).map(r=>r.id);
            data[k].forEach(rec=>{
              if(!rec.id) return;
              if(existing.includes(rec.id)){
                DB.upd(k, rec.id, rec);
              } else {
                DB.push(k, rec);
              }
            });
            imported++;
          }
        });
        showToast('success',`✅ تم استيراد ${imported} مجموعة بيانات`,window._fbReady?'البيانات رُفعت لـ Firestore':'محفوظة محلياً — تُزامَن عند الاتصال');
        init();
        const as=document.querySelector('.screen.active')?.id?.replace('screen-','');
        if(as)showScreen(as);
      }catch(err){
        showToast('error','❌ فشل استيراد الملف','تأكد أن الملف بصيغة JSON صحيحة');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
function syncData(){
  const ic=document.getElementById('sync-icon');if(ic)ic.classList.add('spin');
  if(window._fbReady && window._firestore){
    // Firestore متصل → flush أي عمليات معلقة
    if(typeof flushOfflineQueue==='function'){
      flushOfflineQueue().then(()=>{
        if(ic)ic.classList.remove('spin');
        showToast('success','☁️ تمت المزامنة مع Firebase','جميع البيانات محدّثة');
      });
    } else {
      if(ic)ic.classList.remove('spin');
      showToast('success','☁️ Firebase متصل','البيانات تتزامن تلقائياً');
    }
  } else {
    // غير متصل → حاول إعادة الاتصال
    const saved = localStorage.getItem('ha_fb_config');
    if(saved){
      try{
        initFirebase(JSON.parse(saved)).then(()=>{
          if(ic)ic.classList.remove('spin');
        });
      } catch(e){
        if(ic)ic.classList.remove('spin');
        showToast('warning','⚠️ فشل الاتصال','تحقق من اتصال الإنترنت أو إعدادات Firebase');
      }
    } else {
      if(ic)ic.classList.remove('spin');
      showToast('info','💾 وضع محلي','أعد إعداد Firebase من شاشة الإعدادات للمزامنة السحابية');
    }
  }
}

// GLOBAL SEARCH
function globalSearch(q){
  if(!q.trim())return;
  const pats=DB.get('patients').filter(p=>p.name.includes(q)||p.phone.includes(q));
  if(pats.length===1){closeSidebar();viewPat(pats[0].id);}
  else if(pats.length>0){showScreen('patients');filterPat(q);}
  else showToast('info',`🔍 "${q}" — لا نتائج`);
}

// ══════════════════════════════════════════
// 📊 DASHBOARD ENHANCED FUNCTIONS
// ══════════════════════════════════════════

// Sparkline mini bars for KPI cards
function buildKpiSparklines(){
  const inv = DB.get('invoices');
  const apts = DB.get('appointments');
  const pats = DB.get('patients');
  const now = new Date();
  // Build last 7 days data
  const days = Array.from({length:7},(_,i)=>{
    const d = new Date(now); d.setDate(d.getDate()-6+i);
    return d.toISOString().split('T')[0];
  });
  // ✅ FIX (خطة التوحيد — مرحلة 1.4): استخدام _dashCashRevenue (مصدر cashlog
  // الموحَّد) بدل جمع inv.paid مباشرة، لمطابقة نفس منهجية buildDashboard().
  // ⚠️ ملاحظة: هذه الدالة (buildKpiSparklines) غير مُستدعاة فعلياً في أي
  // مسار تنفيذ حالي (تُستدعى فقط من buildDashExtra التي تعمل فقط لو
  // buildDashboard غير معرَّفة — وهي معرَّفة دائماً). الإصلاح هنا للأمان
  // المستقبلي ولمنع تكرار نفس الخطأ لو استُخدمت هذه الدالة لاحقاً.
  const revData = days.map(d=>_dashCashRevenue({date:d}));
  const apptData = days.map(d=>apts.filter(a=>a.date===d).length);
  const patData = days.map(d=>pats.filter(p=>(p.created||p.date||'').startsWith(d)).length);
  // reuse revData for monthly KPI sparkline
  function renderSparkline(id, data, color){
    const el = document.getElementById(id); if(!el) return;
    const max = Math.max(...data,1);
    el.innerHTML = data.map((v,i)=>{
      const h = Math.max(Math.round(v/max*36),2);
      const isLast = i===data.length-1;
      return `<div style="flex:1;height:${h}px;border-radius:3px 3px 0 0;background:${isLast?color:color+'55'};transition:height .4s ease;" title="${v}"></div>`;
    }).join('');
  }
  renderSparkline('kpi-rev-sparkline', revData, 'var(--emerald)');
  renderSparkline('kpi-appt-sparkline', apptData, 'var(--rose)');
  renderSparkline('kpi-pat-sparkline', patData, 'var(--amber)');
  renderSparkline('kpi-mrev-sparkline', revData, 'var(--purple)');
}

// Update the additional KPI: completed invoices
function buildDashExtra(){
  const done = DB.get('invoices').filter(i=>i.status==='مدفوع').length;
  txt('kpi-inv-done', done.toLocaleString());
  buildKpiSparklines();
  buildDashActivities();
  // ✅ إعادة تحديث KPIs الرئيسية من مصدر موحد (cashlog) عند كل فتح للداشبورد
  if(typeof _refreshDashKPIs === 'function') _refreshDashKPIs();
}

// Activities panel — built from recent DB events (آخر 7 أيام فقط)
function buildDashActivities(){
  const el = document.getElementById('dash-activities'); if(!el) return;
  const inv  = DB.get('invoices');
  const apts = DB.get('appointments');
  const pats = DB.get('patients');
  const now  = new Date();
  // آخر 7 أيام فقط — لا بيانات قديمة
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7);
  const cutStr = cutoff.toISOString().split('T')[0];

  const activities = [];

  // آخر 3 فواتير خلال 7 أيام
  inv.filter(i => (i.date||'') >= cutStr)
     .sort((a,b) => (b.date||'').localeCompare(a.date||''))
     .slice(0,3)
     .forEach(i => {
       activities.push({
         icon:'🧾', color:'var(--teal),var(--purple)',
         text:`فاتورة: ${(i.patient||'عميل')} — ${(i.paid||0).toLocaleString()} ج`,
         time: i.date||'—'
       });
     });

  // آخر 2 مواعيد خلال 7 أيام
  apts.filter(a => (a.date||'') >= cutStr)
      .sort((a,b) => (b.date||'').localeCompare(a.date||''))
      .slice(0,2)
      .forEach(a => {
        activities.push({
          icon:'📅', color:'var(--gold),var(--amber)',
          text:`موعد: ${(a.patient||'عميل')} مع ${(a.doctor||'طبيب')}`,
          time: a.date||'—'
        });
      });

  // آخر عميل مسجَّل خلال 7 أيام
  pats.filter(p => (p.created||'') >= cutStr)
      .sort((a,b) => (b.created||'').localeCompare(a.created||''))
      .slice(0,1)
      .forEach(p => {
        activities.push({
          icon:'👥', color:'var(--emerald),var(--teal)',
          text:`عميل جديد: ${p.name}`,
          time: p.created||'—'
        });
      });

  if(!activities.length){
    el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:14px;font-size:12.5px">لا توجد نشاطات خلال آخر 7 أيام</div>';
    return;
  }

  // ترتيب حسب التاريخ (الأحدث أولاً)
  activities.sort((a,b) => (b.time||'').localeCompare(a.time||''));

  el.innerHTML = activities.slice(0,5).map(a => `
    <div class="dash-notif-item">
      <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,${a.color});display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">${a.icon}</div>
      <div style="flex:1;overflow:hidden;">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.text}</div>
        <div style="font-size:11px;color:var(--text-muted);">${a.time}</div>
      </div>
    </div>`).join('');
}

// Rebuild dash-alerts with new card style matching screenshot
function buildDashAlertsEnhanced(){
  const el = document.getElementById('dash-alerts'); if(!el) return;
  const alerts = [];
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now()+86400000).toISOString().split('T')[0];
  const _relTime = (dateStr) => {
    if(!dateStr) return 'الآن';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if(diff < 1) return 'الآن';
    if(diff < 60) return `منذ ${diff} دقيقة`;
    if(diff < 1440) return `منذ ${Math.floor(diff/60)} ساعة`;
    return `منذ ${Math.floor(diff/1440)} يوم`;
  };
  const lowStock = DB.get('inventory').filter(i=>i.status==='منخفض'||i.status==='نفذ');
  lowStock.slice(0,2).forEach(i=>alerts.push({dot:'var(--rose)',icon:'📦',title:`${i.name}: ${i.status}`,time:_relTime(i.updatedAt||i.createdAt)}));
  const overdue = DB.get('invoices').filter(i=>i.remaining>0);
  if(overdue.length){
    const last = overdue.sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
    alerts.push({dot:'var(--amber)',icon:'💳',title:`${overdue.length} مدفوعات معلقة`,time:_relTime(last.updatedAt||last.date+'T00:00:00')});
  }
  const tomAppts = DB.get('appointments').filter(a=>a.date===tomorrow);
  if(tomAppts.length) alerts.push({dot:'var(--blue)',icon:'📅',title:`${tomAppts.length} مواعيد غداً`,time:'غداً'});
  const expire = DB.get('inventory').filter(i=>{if(!i.expiry)return false;const d=(new Date(i.expiry)-new Date())/(86400000);return d>0&&d<30;});
  if(expire.length) alerts.push({dot:'var(--purple)',icon:'⏰',title:`${expire.length} منتجات قاربت على الانتهاء`,time:'هذا الشهر'});
  const countEl = document.getElementById('alerts-count');
  if(countEl) countEl.textContent = alerts.length||'';
  el.innerHTML = alerts.length ? alerts.map(a=>`
    <div class="dash-notif-item">
      <div class="dash-notif-dot" style="background:${a.dot};"></div>
      <div style="flex:1;">
        <div style="font-size:12.5px;font-weight:600;">${a.icon} ${a.title}</div>
        <div style="font-size:11px;color:var(--text-muted);">${a.time}</div>
      </div>
    </div>`).join('')
  : '<div style="text-align:center;color:var(--text-muted);padding:16px;font-size:12.5px">✅ لا توجد تنبيهات</div>';
  const nd = document.getElementById('notif-dot'); if(nd) nd.style.display = alerts.length?'block':'none';
  buildNotifList(alerts.map(a=>({cls:'ali-w',icon:a.icon,title:a.title,sub:a.time})));
}

// Period / tab switcher for dashboard header (legacy compat)
function dashSetPeriod(period, btn){
  document.querySelectorAll('.dash-period-btn').forEach(b=>{b.style.color='var(--text-muted)';b.style.background='transparent';});
  if(btn){btn.style.color='var(--teal)';btn.style.background='rgba(45,212,191,.15)';}
}

// Chart filter buttons (legacy compat)
function dashChartFilter(type, btn){
  document.querySelectorAll('.dash-cf-btn').forEach(b=>{b.style.color='var(--text-muted)';b.style.background='var(--glass)';});
  if(btn){btn.style.color='var(--teal)';btn.style.background='rgba(45,212,191,.15)';}
}

// ══════════════════════════════════════════
// 🏠 NEW UNIFIED DASHBOARD BUILDER
// ══════════════════════════════════════════
window._dashApptFilter = 'all';

function buildDashboard(){
  const today = new Date().toISOString().split('T')[0];
  const branch = (document.getElementById('dash-branch-sel')?.value)||'';

  // Filter helpers
  const filterBranch = arr => branch ? arr.filter(x=>x.branch===branch||x.branchId===branch) : arr;

  const allPats  = DB.get('patients');
  const allInvs  = DB.get('invoices');
  const allApts  = DB.get('appointments');
  const allInv   = DB.get('inventory');
  const cashlog  = DB.get('cashlog');

  // ── KPI 1: Total Patients ──
  const pats = filterBranch(allPats);
  txt('kpi-pat', pats.length.toLocaleString());

  // ── KPI 2: Today Appointments ──
  const todayApts = filterBranch(allApts.filter(a=>a.date===today));
  txt('kpi-appt', todayApts.length.toLocaleString());

  // ── KPI 3: Today Revenue (✅ من cashlog — يشمل خطط الجلسات أيضاً) ──
  const todayRevInvs = filterBranch(allInvs.filter(i=>i.date===today));
  const todayRev = _dashCashRevenue({date: today, branch});
  txt('kpi-rev', todayRev.toLocaleString());

  // ── KPI 4: Cash Balance from cashlog (وارد/صادر هي القيم الحقيقية المُخزَّنة) ──
  const cashBal = cashlog.reduce((s,e)=>{
    if(e.type==='وارد') return s+(e.amount||0);
    if(e.type==='صادر') return s-(e.amount||0);
    return s;
  },0);
  txt('kpi-mrev', cashBal.toLocaleString());

  // ── Sparklines ──
  const now = new Date();
  const days7 = Array.from({length:7},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-6+i);return d.toISOString().split('T')[0];});
  const revData  = days7.map(d=>_dashCashRevenue({date:d, branch}));
  const apptData = days7.map(d=>allApts.filter(a=>a.date===d).length);
  const patData  = days7.map(d=>allPats.filter(p=>(p.createdAt||'').startsWith(d)).length);

  function sparkline(elId, data, color){
    const el=document.getElementById(elId);if(!el)return;
    const max=Math.max(...data,1);
    el.innerHTML=data.map((v,i)=>{
      const h=Math.max(Math.round(v/max*32),2);
      return `<div style="flex:1;height:${h}px;border-radius:2px 2px 0 0;background:${i===data.length-1?color:color+'55'};transition:height .4s;" title="${v}"></div>`;
    }).join('');
  }
  sparkline('kpi-rev-sparkline',  revData,  'var(--emerald)');
  sparkline('kpi-appt-sparkline', apptData, 'var(--rose)');
  sparkline('kpi-pat-sparkline',  patData,  'var(--amber)');
  sparkline('kpi-mrev-sparkline', revData,  'var(--purple)');

  // ── Bottom stats ──
  const lowStock = allInv.filter(i=>i.status==='منخفض'||i.status==='نفذ');
  txt('kpi-stk', lowStock.length.toLocaleString());
  const pending = allInvs.filter(i=>(i.remaining||0)>0).reduce((s,i)=>s+(i.remaining||0),0);
  txt('kpi-pend', pending.toLocaleString());
  const todayDone = todayRevInvs.filter(i=>i.status==='مدفوع').length;
  txt('kpi-inv-done', todayDone.toLocaleString());

  // ── Today's appointment widget (primary) ──
  renderTodayApptsDash(todayApts);

  // ── Alerts ──
  buildDashAlertsEnhanced();

  // ── Activities ──
  buildDashActivities();

  // ── Service distribution ──
  updateServiceDistribution();

  // ── Top doctors ──
  buildTopDoctors();

  // ── Date label ──
  const sub=document.getElementById('dash-sub');
  if(sub) sub.textContent=new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+(branch?` · فرع ${branch}`:'');

  // ── Dashboard v2 widgets (بيانات حقيقية 100%) ──
  buildInvoiceDonut();
  buildIncomeOverview();
  buildDashTaskCards();
  buildProfitChart();
  buildBranchDonut();
  buildDashMiniCards();
}

// ══════════════════════════════════════════
// 🆕 DASHBOARD v2 — Donut / Income / Reports / Tasks / Profit / Branches
// كل الأرقام والرسوم هنا تُحسَب من قاعدة البيانات الفعلية مباشرة
// ══════════════════════════════════════════

// رسم دونات بـ conic-gradient — segments: [{value,color}]
function buildDonut(elId, segments, totalOverride){
  const el = document.getElementById(elId); if(!el) return;
  const total = totalOverride!=null ? totalOverride : segments.reduce((s,x)=>s+x.value,0);
  if(!total){ el.style.background='var(--glass)'; el.style.webkitMask=''; el.style.mask=''; return; }
  let acc = 0;
  const stops = segments.filter(s=>s.value>0).map(seg=>{
    const start = acc/total*360; acc += seg.value; const end = acc/total*360;
    return `${seg.color} ${start}deg ${end}deg`;
  }).join(',');
  el.style.background = `conic-gradient(${stops})`;
  el.style.webkitMask = 'radial-gradient(circle,transparent 56%,#000 57%)';
  el.style.mask = 'radial-gradient(circle,transparent 56%,#000 57%)';
}

// ── 1) نظرة عامة على الفواتير (Donut: المدفوع / المتبقي / الخصومات) ──
function buildInvoiceDonut(){
  const invoices = DB.get('invoices')||[];
  const totalPaid = invoices.reduce((s,i)=>s+(i.paid||0),0);
  const totalRemaining = invoices.reduce((s,i)=>s+(i.remaining||0),0);
  const totalDiscount = invoices.reduce((s,i)=>s+(i.discount||0),0);
  const total = totalPaid+totalRemaining+totalDiscount;
  txt('dash-donut-total', total.toLocaleString());
  buildDonut('dash-donut', [
    {value:totalPaid, color:'var(--emerald)'},
    {value:totalRemaining, color:'var(--rose)'},
    {value:totalDiscount, color:'var(--amber)'}
  ], total);
  const leg = document.getElementById('dash-donut-legend');
  if(leg) leg.innerHTML = `
    <div class="dleg-item"><span class="dleg-dot" style="background:var(--emerald)"></span>المدفوع <span class="dleg-val">${totalPaid.toLocaleString()} ج</span></div>
    <div class="dleg-item"><span class="dleg-dot" style="background:var(--rose)"></span>المتبقي <span class="dleg-val">${totalRemaining.toLocaleString()} ج</span></div>
    <div class="dleg-item"><span class="dleg-dot" style="background:var(--amber)"></span>الخصومات <span class="dleg-val">${totalDiscount.toLocaleString()} ج</span></div>`;
}

// ── 2) نظرة عامة على الدخل (Bar chart بفلتر السنة) ──
function buildIncomeOverview(){
  const invoices = DB.get('invoices')||[];
  const sel = document.getElementById('dash-income-year-sel');
  const curYear = String(new Date().getFullYear());
  const years = [...new Set(invoices.map(i=>(i.date||'').substring(0,4)).filter(Boolean).concat([curYear]))].sort((a,b)=>b-a);
  if(sel && !sel.dataset.filled){
    sel.innerHTML = years.map(y=>`<option value="${y}">${y}</option>`).join('');
    sel.value = curYear;
    sel.dataset.filled = '1';
  }
  const year = (sel && sel.value) || curYear;
  const MN = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const monthsData = MN.map((_,i)=>{
    const key = `${year}-${String(i+1).padStart(2,'0')}`;
    return _dashCashRevenue({monthKey:key});
  });
  const max = Math.max(...monthsData,1);
  const curMonthIdx = (year===curYear) ? new Date().getMonth() : -1;
  const chart = document.getElementById('dash-income-chart');
  if(chart) chart.innerHTML = monthsData.map((v,i)=>`<div class="bar" style="background:${i===curMonthIdx?'var(--gold)':'var(--teal)'};opacity:${i===curMonthIdx?1:.55};height:${Math.max(v/max*100,3)}%;" title="${MN[i]}: ${v.toLocaleString()} ج" onclick="showToast('info','📅 ${MN[i]} ${year}: '+(${v}).toLocaleString()+' ج')"></div>`).join('');
  const labels = document.getElementById('dash-income-labels');
  if(labels) labels.innerHTML = MN.map((m,i)=>`<div class="blbl" style="flex:1;color:${i===curMonthIdx?'var(--gold-light)':'var(--text-muted)'}">${m}</div>`).join('');
  const subEl = document.getElementById('dash-income-sub');
  if(subEl) subEl.textContent = `دخل عام ${year} — ${monthsData.reduce((a,b)=>a+b,0).toLocaleString()} ج`;
}

// ── 3) خطط العلاج النشطة (Task cards بتفاصيل حقيقية) ──
function buildDashTaskCards(){
  const el = document.getElementById('dash-task-cards'); if(!el) return;
  const sessions = (DB.get('sessions')||[]).filter(s=>s.status==='جارية');
  const patients = DB.get('patients')||[];
  const grads = ['linear-gradient(135deg,#6366F1,#3B82F6)','linear-gradient(135deg,#F59E0B,#F43F5E)','linear-gradient(135deg,#8B5CF6,#EC4899)'];
  if(!sessions.length){
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:24px;font-size:13px;">لا توجد خطط علاج جارية حالياً</div>';
    return;
  }
  const top3 = sessions.slice(-3).reverse();
  el.innerHTML = top3.map((s,i)=>{
    const pat = patients.find(p=>String(p.id)===String(s.patId));
    const done=s.done||0, total=s.total||1, pct=Math.round(done/total*100);
    return `<div class="task-card" style="background:${grads[i%grads.length]};cursor:pointer;" onclick="${pat?`viewPat('${pat.id}')`:`showScreen('sessions')`}">
      <div>
        <div class="tc-title">${s.type||'خطة علاج'}</div>
        <div class="tc-sub">${pat?pat.name:'—'} ${s.doc?'· د. '+s.doc:''}</div>
      </div>
      <div>
        <div class="tc-meta"><span>${done}/${total} جلسة</span><span>${pct}%</span></div>
        <div class="tc-bar"><div class="tc-bar-f" style="width:${pct}%"></div></div>
      </div>
    </div>`;
  }).join('');
}

// ── 4) صافي الربح (Profit line chart — آخر 6 شهور، نفس معادلة شاشة التقارير) ──
function buildProfitChart(){
  const invoices  = DB.get('invoices')||[];
  const cashlog   = DB.get('cashlog')||[];
  const purchases = DB.get('purchases')||[];
  const now = new Date();
  const months = Array.from({length:6},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const data = months.map(key=>{
    const rev = _dashCashRevenue({monthKey:key});
    const exp = cashlog.filter(c=>c.type==='صادر'&&(c.date||'').startsWith(key)).reduce((s,c)=>s+(c.amount||0),0);
    const pur = purchases.filter(p=>(p.orderDate||'').startsWith(key)&&p.status==='مستلم').reduce((s,p)=>s+(p.total||0),0);
    return rev-exp-pur;
  });
  const curProfit = data[data.length-1];
  const valEl = document.getElementById('dash-profit-val');
  if(valEl){ valEl.textContent = (curProfit>=0?'+':'')+curProfit.toLocaleString()+' ج'; valEl.style.color = curProfit>=0?'var(--emerald)':'var(--rose)'; }
  const subEl = document.getElementById('dash-profit-sub');
  if(subEl) subEl.textContent = `صافي الربح — ${now.toLocaleDateString('ar-EG',{month:'long',year:'numeric'})}`;

  const wrap = document.getElementById('dash-profit-chart'); if(!wrap) return;
  const w=300,h=100,pad=8;
  const min = Math.min(...data,0), max = Math.max(...data,1);
  const range = (max-min)||1;
  const pts = data.map((v,i)=>{
    const x = pad + i*(w-2*pad)/(data.length-1);
    const y = h-pad - ((v-min)/range)*(h-2*pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lineColor = curProfit>=0 ? 'var(--emerald)' : 'var(--rose)';
  const zeroY = (h-pad-((0-min)/range)*(h-2*pad)).toFixed(1);
  wrap.innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:100%;overflow:visible;" preserveAspectRatio="none">
    <line x1="0" y1="${zeroY}" x2="${w}" y2="${zeroY}" stroke="var(--glass-border)" stroke-dasharray="3,3"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="${lineColor}" stroke-width="2.5"/>
    ${pts.map((p,i)=>{const [x,y]=p.split(','); return `<circle cx="${x}" cy="${y}" r="3" fill="${lineColor}"><title>${months[i]}: ${data[i].toLocaleString()} ج</title></circle>`;}).join('')}
  </svg>`;
}

// ── 5) توزيع الفروع (Branch revenue donut) ──
function buildBranchDonut(){
  // ✅ FIX (مشكلة #6): كان مبنياً على invoices فقط، فيتجاهل إيراد خطط الجلسات بالكامل.
  // الآن من cashlog (المصدر الموحَّد)، مع نسب كل قيد لفرعه مباشرة، أو لفرع العميل
  // كحل بديل لو القيد نفسه لا يحمل فرعاً (مثل بعض قيود الجلسات/الباقات).
  const cashlog = (DB.get('cashlog')||[]).filter(c=>c.type==='وارد');
  const patById = {};
  DB.get('patients').forEach(p=>{ patById[p.id]=p; });
  const colors = ['var(--purple)','var(--teal)','var(--amber)','var(--rose)','var(--blue)'];
  const map = {};
  cashlog.forEach(c=>{
    const pat = c.patId ? patById[c.patId] : null;
    const b = c.branch || pat?.branch || 'غير محدد';
    map[b] = (map[b]||0) + (c.amount||0);
  });
  const entries = Object.entries(map).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const total = entries.reduce((s,[,v])=>s+v,0);
  txt('dash-branch-total', total?total.toLocaleString():'0');
  const leg = document.getElementById('dash-branch-legend');
  if(!entries.length){
    buildDonut('dash-branch-donut', [], 0);
    if(leg) leg.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:11px;">لا توجد بيانات</div>';
    return;
  }
  buildDonut('dash-branch-donut', entries.map(([,v],i)=>({value:v,color:colors[i%colors.length]})), total);
  if(leg) leg.innerHTML = entries.map(([name,v],i)=>{
    const pct = total?Math.round(v/total*100):0;
    return `<div class="dleg-item" style="font-size:11px;"><span class="dleg-dot" style="background:${colors[i%colors.length]}"></span>${name} <span class="dleg-val">${pct}%</span></div>`;
  }).join('');
}

// ── 6) بطاقات مصغّرة: العملاء + الخزينة (Sparkbars حقيقية) ──
function buildDashMiniCards(){
  const pats = DB.get('patients')||[];
  const cashlog = DB.get('cashlog')||[];
  txt('dash-mini-pat', pats.length.toLocaleString());
  const now = new Date();
  const months6 = Array.from({length:6},(_,i)=>{
    const d=new Date(now.getFullYear(), now.getMonth()-5+i,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const patBars = months6.map(key=>pats.filter(p=>(p.createdAt||'').startsWith(key)).length);
  const maxP = Math.max(...patBars,1);
  const patEl = document.getElementById('dash-mini-pat-bars');
  if(patEl) patEl.innerHTML = patBars.map((v,i)=>`<div style="height:${Math.max(v/maxP*100,6)}%;background:${i===patBars.length-1?'var(--amber)':'rgba(245,158,11,.35)'}" title="${v}"></div>`).join('');

  const cashBal = cashlog.reduce((s,e)=>{
    if(e.type==='وارد') return s+(e.amount||0);
    if(e.type==='صادر') return s-(e.amount||0);
    return s;
  },0);
  txt('dash-mini-cash', cashBal.toLocaleString()+' ج');
  const cashBars = months6.map(key=>{
    const inAmt  = cashlog.filter(c=>c.type==='وارد'&&(c.date||'').startsWith(key)).reduce((s,c)=>s+(c.amount||0),0);
    const outAmt = cashlog.filter(c=>c.type==='صادر'&&(c.date||'').startsWith(key)).reduce((s,c)=>s+(c.amount||0),0);
    return inAmt-outAmt;
  });
  const maxC = Math.max(...cashBars.map(Math.abs),1);
  const cashEl = document.getElementById('dash-mini-cash-bars');
  if(cashEl) cashEl.innerHTML = cashBars.map((v,i)=>`<div style="height:${Math.max(Math.abs(v)/maxC*100,6)}%;background:${v<0?'var(--rose)':(i===cashBars.length-1?'var(--purple)':'rgba(139,92,246,.35)')}" title="${v.toLocaleString()} ج"></div>`).join('');
}

// Render today's appointments in the main dashboard widget
function renderTodayApptsDash(todayApts){
  const el = document.getElementById('dash-today-appts'); if(!el) return;
  const filterVal = window._dashApptFilter || 'all';
  const statusMap = {waiting:'ينتظر',inprogress:'داخل العيادة',done:'مكتمل',cancelled:'ملغي'};
  let apts = [...todayApts].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  if(filterVal !== 'all'){
    const statusAr = statusMap[filterVal]||filterVal;
    apts = apts.filter(a=>{
      const st = (a.status||'').toLowerCase();
      return st.includes(filterVal) || a.status===statusAr;
    });
  }
  const total = todayApts.length;
  const sub = document.getElementById('dash-appt-sub');
  if(sub) sub.textContent = `${total} موعد اليوم — ${todayApts.filter(a=>a.status==='مكتمل'||a.status==='done').length} مكتمل`;

  if(!apts.length){
    el.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:13px;">لا توجد مواعيد تطابق الفلتر</div>';
    return;
  }

  const stCls={
    'مكتمل':'sc','done':'sc','مكتملة':'sc',
    'ينتظر':'sw','waiting':'sw',
    'داخل العيادة':'sp','inprogress':'sp',
    'ملغي':'sx','cancelled':'sx','ملغى':'sx'
  };
  const stAr = {'مكتمل':'مكتمل','done':'مكتمل','ينتظر':'ينتظر','waiting':'ينتظر','داخل العيادة':'داخل','inprogress':'داخل','ملغي':'ملغي','cancelled':'ملغي','ملغى':'ملغي'};

  el.innerHTML = apts.slice(0,8).map(a=>{
    const sc = stCls[a.status||'']||'sd';
    const stLabel = stAr[a.status||'']||(a.status||'—');
    const avatarColors=['linear-gradient(135deg,#8B5CF6,#3B82F6)','linear-gradient(135deg,#10B981,#2DD4BF)','linear-gradient(135deg,#F59E0B,#F43F5E)','linear-gradient(135deg,#C4A882,#8B5CF6)','linear-gradient(135deg,#F43F5E,#F59E0B)'];
    const aColor = avatarColors[((a.patient||'').charCodeAt(0)||0)%avatarColors.length];
    const initials = (a.patient||'?').charAt(0);
    return `<div class="dash-appt-row">
      <div style="font-size:11.5px;font-weight:800;color:var(--gold-light);width:44px;text-align:center;flex-shrink:0;">${a.time||'—'}</div>
      <div style="width:34px;height:34px;border-radius:50%;background:${aColor};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0;color:#fff;">${initials}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.patient||'—'}</div>
        <div style="font-size:11.5px;color:var(--text-muted);">د. ${a.doctor||'—'} ${a.service?'· '+a.service:''}</div>
      </div>
      <span class="ast ${sc}" style="flex-shrink:0;">${stLabel}</span>
      <div style="display:flex;gap:4px;flex-shrink:0;">
        <button class="btn btn-teal btn-xs" onclick="event.stopPropagation();startVisitFromDash('${a.id}')" title="بدء الزيارة">▶</button>
        <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openEditAppt('${a.id}')" title="تعديل">✏️</button>
        <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();cancelApptFromDash('${a.id}')" title="إلغاء">✕</button>
      </div>
    </div>`;
  }).join('');
  if(apts.length > 8){
    el.innerHTML += `<div style="text-align:center;padding:10px;"><button class="btn btn-ghost btn-sm" onclick="showScreen('calendar')" style="font-size:12px;">عرض ${apts.length-8} موعد إضافي →</button></div>`;
  }
}

// Appointment filter in dashboard
function dashApptFilter(filter, btn){
  window._dashApptFilter = filter;
  document.querySelectorAll('.dash-af-btn').forEach(b=>{
    b.style.background='transparent';b.style.color='var(--text-muted)';b.classList.remove('active');
  });
  if(btn){btn.style.background='rgba(45,212,191,.15)';btn.style.color='var(--teal)';btn.classList.add('active');}
  const today=new Date().toISOString().split('T')[0];
  const allApts = DB.get('appointments').filter(a=>a.date===today);
  renderTodayApptsDash(allApts);
}

// Start visit from dashboard shortcut
function startVisitFromDash(id){
  const a=DB.get('appointments').find(x=>x.id===id); if(!a)return;
  DB.upd('appointments',id,{status:'داخل العيادة'});
  showToast('success',`▶ بدأت زيارة ${a.patient}`);
  buildDashboard();
}

// Cancel appointment from dashboard
function cancelApptFromDash(id){
  const a=DB.get('appointments').find(x=>x.id===id); if(!a)return;
  if(!confirm(`إلغاء موعد ${a.patient}؟`))return;
  DB.upd('appointments',id,{status:'ملغي'});
  showToast('info','تم إلغاء الموعد');
  buildDashboard();
}

// Open edit appointment (fallback to calendar screen)
function openEditAppt(id){
  showScreen('calendar');
  setTimeout(()=>{ if(typeof editAppt==='function') editAppt(id); },300);
}

// HELPERS
function txt(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function setDate(){const el=document.getElementById('topbar-date');if(el)el.textContent=new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'});}

// INIT
function init(){
  buildDashboard();buildChart();loadSettings();setDate();
  // تحديث حالة الأقساط المتأخرة عند بدء التشغيل
  setTimeout(()=>{ if(typeof updateInstallmentStatuses==='function') updateInstallmentStatuses(); }, 1500);
  // seedDefaultUsers() حُذفت — المستخدمون من Firestore فقط
  // لو في Firebase config → أظهر مؤشر sync مؤقت حتى تكتمل المزامنة
  if(localStorage.getItem('ha_fb_config')){
    const bar = document.getElementById('conn-bar');
    if(bar){
      const ind = document.createElement('div');
      ind.id = 'fb-sync-indicator';
      ind.style.cssText = 'background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:7px 14px;font-size:12px;color:var(--amber);display:flex;align-items:center;gap:7px;margin-top:6px;';
      ind.innerHTML = '<span style="animation:spin 1s linear infinite;display:inline-block">🔄</span> جارٍ مزامنة البيانات من Firebase...';
      bar.parentNode?.insertBefore(ind, bar.nextSibling);
      setTimeout(()=>{ if(ind.parentNode) ind.style.display='none'; }, 8000); // fallback بعد 8 ثواني
    }
  }
  const sub=document.getElementById('dash-sub');if(sub)sub.textContent=new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+' · فرع مدينة نصر';
  // ✅ KPIs الرئيسية تُحسب مرة واحدة من _refreshDashKPIs لضمان التوحيد
  // (كانت تُحسب مرتين: مرة هنا بمصادر مختلفة ومرة في _refreshDashKPIs — تم توحيدها)
  if(typeof _refreshDashKPIs === 'function') _refreshDashKPIs();
  // conn status — لا نكتب "وضع محلي" لو Firebase متصل بالفعل
  if(!window._fbReady){
    txt('conn-txt','وضع محلي 💾');const d=document.getElementById('conn-dot');if(d)d.style.background='#F59E0B';
  }
  // Set today date on inputs
  const td=new Date().toISOString().split('T')[0];
  ['am-date','im-date'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=td;});
  // Show setup on first visit
  if(!localStorage.getItem('ha_setup_shown')){setTimeout(()=>{document.getElementById('setup-screen')?.classList.add('show');localStorage.setItem('ha_setup_shown','1');},800);}
  // Phase 2: run first status auto-update, then start 60s timer
  window._wlTimer=null;
  _wlAutoUpdateStatuses();
  _startWLAutoRefresh();
}
// init() called from index.html after all scripts load
// ✅ branches و resources في showScreen الموحدة بـ 00-core.js
// ══════════════════════════════════════════
// 🔐 SESSION MANAGEMENT (Secure — supports plain JSON & base64 encoded session)
// ══════════════════════════════════════════
function _parseSession(raw) {
  if (!raw) return null;
  // محاولة قراءة base64 أولاً (النظام الجديد المشفر)
  try {
    const decoded = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (decoded && decoded.expiry) return decoded;
  } catch (e1) { /* ليس base64 */ }
  // fallback: plain JSON (النظام الحالي)
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.expiry) return parsed;
  } catch (e2) { /* تالف */ }
  return null;
}

// ── applyPermissions موحَّدة الآن عبر EventBus('auth:resolved') — لا حاجة لـ stub/pending ──
// (انظر 11-settings.js: EventBus.on('auth:resolved', ..., {replay:true}))

(function checkAuth(){
  const sess = localStorage.getItem('ha_session');
  if(!sess){ window.location.href = 'login.html'; return; }
  try {
    const s = _parseSession(sess);
    if(!s || s.expiry < Date.now()){
      localStorage.removeItem('ha_session');
      window.location.href = 'login.html'; return;
    }
    window._session = s;
    // getUsersDB قد تكون معرّفة في 11-settings.js — نستخدمها بأمان
    const _udb = (typeof getUsersDB === 'function') ? getUsersDB() : (()=>{ try{return JSON.parse(localStorage.getItem('ha_users_db')||'{}');}catch(e){return{};} })();
    const _usr = _udb[s.username];
    const liveName = _usr?.name || s.name;
    const liveRole = _usr?.role || s.role;
    const uName = document.getElementById('user-name');
    const uRole = document.getElementById('user-role');
    const dashName = document.getElementById('dash-uname');
    const RLBL={admin:'مدير النظام',branch_manager:'مدير فرع',doctor:'طبيب',receptionist:'استقبال',accountant:'محاسب'};
    if(uName && liveName) uName.textContent = liveName;
    if(dashName && liveName) dashName.textContent = liveName;
    if(uRole && liveRole) uRole.textContent = RLBL[liveRole] || liveRole;
    // Read live screens from users DB (may have been updated by admin)
    const _screens = _usr ? (_usr.screens || s.permissions) : s.permissions;
    window._userScreens = _screens;
    // ✅ موحّد عبر EventBus بدل stub/pending — applyPermissions في 11-settings.js
    // مسجَّلة بـ {replay:true} فتُستدعى فوراً بآخر قيمة حتى لو حدث هذا الحدث قبل تحميل ملفها
    EventBus.emit('auth:resolved', { role: liveRole, perms: s.permissions, screens: _screens });
  } catch(e){
    // لا نمسح الجلسة عند أي خطأ عام — فقط عند فشل التحليل الفعلي
    try {
      const s2 = _parseSession(localStorage.getItem('ha_session'));
      if(!s2){ localStorage.removeItem('ha_session'); window.location.href = 'login.html'; }
    } catch(e2){
      localStorage.removeItem('ha_session'); window.location.href = 'login.html';
    }
  }
})();

function doLogout(){
  if(confirm('هل تريد تسجيل الخروج؟')){
    localStorage.removeItem('ha_session');
    window.location.href = 'login.html';
  }
}

function renewSession(){
  const sess = localStorage.getItem('ha_session');
  if(sess){
    try{
      const s = _parseSession(sess);
      if(!s) return;
      s.expiry = Date.now() + (8 * 60 * 60 * 1000);
      localStorage.setItem('ha_session', JSON.stringify(s));
      showToast('success','✅ تم تجديد الجلسة لـ 8 ساعات');
    }catch(e){}
  }
}


// ══════════════════════════════════════════
// 🔐 SCREENS DEFINITION & PERMISSION SYSTEM
// ══════════════════════════════════════════
// ⏰ SESSION TIMER DISPLAY
// ══════════════════════════════════════════
function updateSessionTimer(){
  const sess = localStorage.getItem('ha_session');
  if(!sess) return;
  try{
    const s = _parseSession(sess);
    if(!s) return;
    const remaining = s.expiry - Date.now();
    if(remaining <= 0){ doLogout(); return; }
    const hours = Math.floor(remaining/3600000);
    const mins = Math.floor((remaining%3600000)/60000);
    const timerEl = document.getElementById('session-timer');
    if(timerEl) timerEl.textContent = `${hours}:${String(mins).padStart(2,'0')}`;
  }catch(e){}
}
setInterval(updateSessionTimer, 60000);
updateSessionTimer();

// ══════════════════════════════════════════
// 🔔 AUTO NOTIFICATIONS CHECK
// ══════════════════════════════════════════
function checkNotifications(){
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now()+86400000).toISOString().split('T')[0];
  const nowMin = new Date().getHours()*60 + new Date().getMinutes();

  // ── 1. تنبيه مواعيد الغد ──
  const tomorrowAppts = DB.get('appointments').filter(a=>a.date===tomorrow && a.status==='مؤكد');
  if(tomorrowAppts.length > 0){
    setTimeout(()=>{
      showToast('info',`📅 ${tomorrowAppts.length} مواعيد غداً لم يُرسل لها تذكير`,'اضغط لإرسال تذكيرات واتساب');
    }, 3000);
  }

  // ── 2. تنبيه مخزون منخفض ──
  const lowStock = DB.get('inventory').filter(i=>i.status==='منخفض'||i.status==='نفذ');
  if(lowStock.length > 0){
    setTimeout(()=>{
      showToast('warning',`⚠️ ${lowStock.length} منتجات تحتاج إعادة طلب`);
    }, 5000);
  }

  // ── 3. شارة الأقساط ──
  const overdueInvs = DB.get('invoices').filter(i=>i.remaining>0);
  if(overdueInvs.length > 0) txt('badge-inst', overdueInvs.length);

  // ── 4. Auto No-Show: موعد اليوم فات وقته بأكثر من 60 دقيقة ولم يحضر ──
  const _toMin = (t) => { const [h,m]=(t||'00:00').split(':').map(Number); return h*60+(m||0); };
  const todayAppts = DB.get('appointments').filter(a=>a.date===today);
  let noShowChanged = false;
  todayAppts.forEach(a=>{
    if(['مكتمل','ملغي','لم يحضر','وصل','في الاستشارة'].includes(a.status)) return;
    const apptMin = _toMin(a.time||'00:00');
    if(nowMin >= apptMin + 60){ // فات الموعد أكثر من ساعة
      DB.upd('appointments', a.id, { status:'لم يحضر' });
      noShowChanged = true;
    }
  });
  if(noShowChanged){
    renderTodayAppts();
    if(typeof renderWaitlist==='function') renderWaitlist();
    if(typeof renderReception==='function') renderReception();
  }

  // ── 5. Auto overdue installments: تحديث حالة الأقساط المتأخرة ──
  if(typeof updateInstallmentStatuses==='function') updateInstallmentStatuses();

  // ── 6. Auto doctor commission record: تسجيل عمولة الطبيب على الفواتير الجديدة ──
  _autoRecordCommissions();
}

// تسجيل عمولة الطبيب تلقائياً على كل فاتورة لم تُسجَّل عمولتها بعد
// ✅ FIX (مشكلة #5): كان هذا مسار ثالث منفصل بمنطق حساب وشرط مطابقة طبيب مختلفين
// عن recordDoctorCommission في 00-core.js — تم توحيدهما لمنع تضارب/ازدواج محتمل
// في حساب العمولة من نفس الدفعة عبر مسارين مختلفين.
function _autoRecordCommissions(){
  const today = new Date().toISOString().split('T')[0];
  const invoices = DB.get('invoices').filter(i=>i.date===today && i.doctor && !i.commissionRecorded);
  invoices.forEach(inv=>{
    if(typeof recordDoctorCommission === 'function') recordDoctorCommission(inv.id, inv.paid || 0);
  });
}

// Run checks after 2 seconds of loading, then every 5 minutes
setTimeout(checkNotifications, 2000);
setInterval(checkNotifications, 5 * 60 * 1000);

// ══════════════════════════════════════════
// 📱 ADD LOGOUT TO USER CARD
// ══════════════════════════════════════════
document.querySelector('.user-card')?.addEventListener('click', function(){
  const menu = document.createElement('div');
  menu.style.cssText='position:fixed;bottom:70px;right:14px;background:var(--modal-bg);border:1px solid var(--glass-border);border-radius:12px;padding:8px;z-index:500;min-width:180px;box-shadow:var(--shadow);';
  menu.innerHTML = `
    <div style="padding:8px 12px;font-size:13px;font-weight:600;color:var(--text-muted);border-bottom:1px solid var(--glass-border);margin-bottom:6px;">${window._session?.name||'المستخدم'}</div>
    <div onclick="renewSession();this.closest('div[style]').remove();" style="padding:9px 12px;border-radius:8px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='var(--glass)'" onmouseout="this.style.background='transparent'">🔄 تجديد الجلسة</div>
    <div onclick="showScreen('settings');this.closest('div[style]').remove();" style="padding:9px 12px;border-radius:8px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='var(--glass)'" onmouseout="this.style.background='transparent'">⚙️ الإعدادات</div>
    <div onclick="doLogout()" style="padding:9px 12px;border-radius:8px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;color:var(--rose);" onmouseover="this.style.background='rgba(244,63,94,.08)'" onmouseout="this.style.background='transparent'">🚪 تسجيل الخروج</div>`;
  document.body.appendChild(menu);
  setTimeout(()=>document.addEventListener('click',function rm(e){if(!menu.contains(e.target)){menu.remove();document.removeEventListener('click',rm);}},100));
});

// ══════════════════════════════════════════
// ✅ التحديث الدوري كل 60 ثانية موحَّد الآن في مكان واحد:
//    _startWLAutoRefresh() في 07-clinical.js (يُستدعى مرة واحدة من init())
//    DB.upd عند تغيّر حالة موعد → EventBus → _scheduleUIRefresh تلقائياً (00-core.js)
// تمت إزالة المؤقّت المكرر الذي كان هنا (كان يُستبدَل فوراً بمؤقّت 07-clinical.js
// عند استدعاء init() — أي أنه كان كوداً ميتاً عملياً).
