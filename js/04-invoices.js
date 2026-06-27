// INVENTORY
let _if='',_is='';
function filterInv(q){_if=q;renderInv();}
function filterInvSt(s){_is=s;renderInv();}
function renderInv(){
  const items=DB.get('inventory').filter(i=>(!_if||i.name.includes(_if))&&(!_is||i.status===_is));
  const tb=document.getElementById('inv-tbody');if(!tb)return;
  tb.innerHTML=items.map(i=>`<tr><td style="font-weight:600">${i.name}</td><td style="font-weight:700;color:${i.qty===0?'var(--rose)':i.qty<=i.reorder?'var(--amber)':'var(--emerald)'}">${i.qty}</td><td>${i.reorder}</td><td style="font-size:12px;color:${i.expiry&&new Date(i.expiry)<new Date()?'var(--rose)':'var(--text-muted)'}">${i.expiry||'—'}</td><td>${i.price} ج</td><td><span class="stk ${i.status==='متوفر'?'stk-ok':i.status==='منخفض'?'stk-low':'stk-out'}">${i.status}</span></td><td><button class="btn btn-ghost btn-xs" onclick="openProductModal('${i.id}')">✏️</button> <button class="btn btn-danger btn-xs" onclick="delInv('${i.id}')">🗑</button></td></tr>`).join('');
  const all=DB.get('inventory');
  const low=all.filter(i=>i.status==='منخفض').length,out=all.filter(i=>i.status==='نفذ').length;
  txt('inv-total',all.length);txt('inv-low',low);txt('inv-out',out);
  txt('inv-val',all.reduce((s,i)=>s+(i.qty*i.price),0).toLocaleString()+' ج');
  txt('badge-stock',low+out);txt('kpi-stk',low+out);
}
function delInv(id){if(confirm('حذف المنتج؟')){DB.del('inventory',id);renderInv();showToast('info','🗑️ تم حذف المنتج');}}
function openProductModal(id){
  const p=id?DB.get('inventory').find(x=>String(x.id)===String(id)):null;
  document.getElementById('prod-modal-title').textContent=p?'✏️ تعديل منتج':'📦 منتج جديد';
  document.getElementById('prod-id').value=p?p.id:'';
  document.getElementById('prod-name').value=p?p.name:'';
  document.getElementById('prod-qty').value=p?p.qty:'';
  document.getElementById('prod-reord').value=p?p.reorder:5;
  document.getElementById('prod-price').value=p?p.price:'';
  document.getElementById('prod-exp').value=p?p.expiry||'':'';
  const catEl=document.getElementById('prod-cat');if(catEl&&p)catEl.value=p.cat||catEl.options[0].value;
  openModal('product-modal');
}
function saveProd(){
  const name=gv('prod-name').trim();if(!name){showToast('warning','⚠️ اسم المنتج مطلوب');return;}
  const qty=parseInt(gv('prod-qty'))||0,reorder=parseInt(gv('prod-reord'))||5;
  const id=gv('prod-id');
  const data={name,cat:gv('prod-cat'),qty,reorder,price:parseFloat(gv('prod-price'))||0,expiry:gv('prod-exp'),status:qty===0?'نفذ':qty<=reorder?'منخفض':'متوفر'};
  if(id){DB.upd('inventory',id,data);showToast('success',`✅ تم تحديث ${name}`);}
  else{DB.push('inventory',data);showToast('success',`✅ تم إضافة ${name}`);}
  closeModal('product-modal');renderInv();
}

// INVOICES
let _vf='',_vs='';
// ✅ filterInvs و renderInvs الكاملة موجودتان في الأسفل (النسخة المتطورة)
// هذه النسخة البدائية محذوفة لتجنب التعارض
function updInvTotal(){
  const p=parseFloat(document.getElementById('im-price')?.value)||0,d=parseFloat(document.getElementById('im-disc')?.value)||0;
  txt('ig',p+' ج');txt('id2',d+' ج');txt('in2',(p-d)+' ج');
}
document.getElementById('im-svc')?.addEventListener('change',function(){const e=document.getElementById('im-price');if(e){e.value=this.value;updInvTotal();}});
function selPay(el){el.closest('.pay-g').querySelectorAll('.pay-m').forEach(x=>x.classList.remove('sel'));el.classList.add('sel');}
function openInvModal(id){
  const inv=id?DB.get('invoices').find(x=>String(x.id)===String(id)):null;
  document.getElementById('inv-modal-title').textContent=inv?'✏️ تعديل فاتورة':'🧾 فاتورة جديدة';
  document.getElementById('im-id').value=inv?inv.id:'';
  fillPatDropdowns();
  const patSel=document.getElementById('im-pat');
  if(inv&&patSel){
    // prefer patId, fallback to name-match for legacy records
    if(inv.patId) patSel.value=inv.patId;
    else {
      const pt=DB.get('patients').find(p=>p.name===inv.patient);
      if(pt)patSel.value=pt.id;
    }
  }
  const priceEl=document.getElementById('im-price');
  const discEl=document.getElementById('im-disc');
  const dateEl=document.getElementById('im-date');
  if(priceEl)priceEl.value=inv?(inv.originalPrice||inv.total):800;
  if(discEl)discEl.value=inv?(inv.discount||0):0;
  if(dateEl)dateEl.value=inv?inv.date:new Date().toISOString().split('T')[0];
  // reset payment method selection
  document.querySelectorAll('#invoice-modal .pay-m').forEach(el=>{
    el.classList.remove('sel');
    if(inv&&el.textContent.trim()===inv.method)el.classList.add('sel');
  });
  if(!inv)document.querySelector('#invoice-modal .pay-m')?.classList.add('sel');
  updInvTotal();
  openModal('invoice-modal');
}
function saveInv(){
  const pid=gv('im-pat');if(!pid){showToast('warning','⚠️ اختر العميل');return;}
  const pat=DB.get('patients').find(p=>String(p.id)===String(pid));
  const price=parseFloat(document.getElementById('im-price')?.value)||0,disc=parseFloat(document.getElementById('im-disc')?.value)||0,net=price-disc;
  const method=document.querySelector('#invoice-modal .pay-m.sel')?.textContent?.trim()||'كاش';
  const id=gv('im-id');
  const svcRaw=gv('im-svc')||'';
  const svcName=svcRaw.includes(' - ')?svcRaw.split(' - ')[0]:svcRaw;
  // استخراج الطبيب من الموعد المرتبط أو من الخدمة
  const svcObj = DB.get('services').find(s=>s.name===svcName);
  const apptDate = gv('im-date')||new Date().toISOString().split('T')[0];
  const linkedAppt = DB.get('appointments').find(a=>
    (String(a.patientId)===String(pid) || String(a.patId)===String(pid)) &&
    a.date===apptDate
  );
  const doctorName  = linkedAppt?.doctor  || svcObj?.doctor  || '';
  const doctorId    = linkedAppt?.doctorId || svcObj?.doctorId || '';
  const serviceId   = svcObj?.id || '';
  const branchName  = linkedAppt?.branch  || pat?.branch || '';
  const data={patId:pid,patientId:pid,patient:pat?.name||'—',service:svcName,serviceId,doctor:doctorName,doctorId,branch:branchName,
    originalPrice:price,discount:disc,total:net,paid:net,remaining:0,status:'مدفوع',method,
    date:gv('im-date')||new Date().toISOString().split('T')[0]};
  if(id){
    // احسب الفرق في المدفوع مقارنة بالفاتورة الأصلية
    const oldInv = DB.get('invoices').find(i=>String(i.id)===String(id));
    const oldPaid = oldInv?.paid || 0;
    const paidDelta = Math.max(0, net - oldPaid); // الزيادة في المدفوع فقط
    DB.upd('invoices',id,{...data, paidDelta});
    showToast('success','✅ تم تحديث الفاتورة');
  } else {
    DB.push('invoices',data);
    // ✅ spent + balance + cashlog يُحدَّثون تلقائياً عبر EventBus('invoices:created') في 00-core.js
    // لا تحديث يدوي هنا لتجنب الاحتساب المضاعف
    showToast('success','✅ تم إصدار الفاتورة',`${net.toLocaleString()} ج - ${method}`);
  }
  closeModal('invoice-modal');renderInvs();
}

// 🖨️ PRINT INVOICE (REAL PDF)
// ══════════════════════════════════════════
function buildInvoiceHTML(inv, clinicName, clinicPhone, idx){
  if(!clinicName) clinicName = DB.obj('settings').clinicName || 'عيادات الحياة للتجميل';
  if(!clinicPhone) clinicPhone = DB.obj('settings').phone || '';
  const invNum = idx !== undefined ? String(idx+1).padStart(3,'0') : inv.id;
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>فاتورة #${inv.id}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Tajawal',sans-serif;background:#fff;color:#1a1a1a;padding:30px;font-size:14px;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #C4A882;padding-bottom:20px;margin-bottom:20px;}
  .logo{font-size:22px;font-weight:900;color:#C4A882;}
  .logo-sub{font-size:12px;color:#666;margin-top:3px;}
  .inv-num{text-align:left;font-size:13px;color:#666;}
  .inv-num strong{font-size:18px;color:#1a1a1a;display:block;}
  .section{margin-bottom:20px;}
  .section-title{font-size:12px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:5px;}
  .info-row{display:flex;justify-content:space-between;font-size:13.5px;padding:5px 0;}
  .info-row span{color:#666;}
  table{width:100%;border-collapse:collapse;margin-bottom:20px;}
  thead th{background:#f8f4ef;padding:10px 12px;text-align:right;font-size:12px;font-weight:700;color:#666;border-bottom:2px solid #C4A882;}
  tbody td{padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13.5px;}
  .total-box{background:#f8f4ef;border-radius:10px;padding:16px 20px;margin-bottom:20px;}
  .total-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13.5px;}
  .total-row.final{border-top:2px solid #C4A882;margin-top:8px;padding-top:10px;font-size:16px;font-weight:800;}
  .status-badge{display:inline-block;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;}
  .status-paid{background:#dcfce7;color:#166534;}
  .status-partial{background:#fef9c3;color:#713f12;}
  .footer{text-align:center;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin-top:20px;}
  @media print{body{padding:15px;} #inv-toolbar{display:none!important;}}
</style>
</head>
<body>
<div class="header">
  <div style="display:flex;align-items:center;gap:10px;">
    <div>${clinicLogoHTML(42)}</div>
    <div>
      <div class="logo">${clinicName}</div>
      <div class="logo-sub">📞 ${clinicPhone} | فاتورة ضريبية</div>
    </div>
  </div>
  <div class="inv-num">
    <span>رقم الفاتورة</span>
    <strong>#INV-${invNum}</strong>
    <div style="font-size:12px;color:#666;margin-top:4px">📅 ${inv.date}</div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
  <div class="section">
    <div class="section-title">بيانات العميل</div>
    <div class="info-row"><span>الاسم:</span><strong>${_patName(inv.patId)||inv.patient}</strong></div>
    <div class="info-row"><span>الفرع:</span><span>${inv.branch||'مدينة نصر'}</span></div>
  </div>
  <div class="section">
    <div class="section-title">بيانات الدفع</div>
    <div class="info-row"><span>طريقة الدفع:</span><strong>${inv.method||'كاش'}</strong></div>
    <div class="info-row"><span>الحالة:</span><span class="status-badge ${inv.status==='مدفوع'?'status-paid':'status-partial'}">${inv.status}</span></div>
  </div>
</div>

<table>
  <thead><tr><th>الخدمة / المنتج</th><th>الكمية</th><th>السعر الأصلي</th><th>الإجمالي</th></tr></thead>
  <tbody>
    <tr><td>${inv.service}</td><td>1</td><td>${(inv.originalPrice||inv.total)} ج</td><td>${inv.total} ج</td></tr>
  </tbody>
</table>

<div class="total-box">
  <div class="total-row"><span>المجموع:</span><span>${(inv.originalPrice||inv.total)} ج</span></div>
  <div class="total-row"><span>الخصم:</span><span style="color:#dc2626">${(inv.discount||0)>0?'- ':''} ${(inv.discount||0)} ج</span></div>
  <div class="total-row final"><span>الإجمالي المستحق:</span><strong style="color:#C4A882">${inv.total} ج</strong></div>
  <div class="total-row"><span>المدفوع:</span><span style="color:#166534">${inv.paid} ج</span></div>
  ${inv.remaining>0?`<div class="total-row"><span>المتبقي:</span><span style="color:#dc2626">${inv.remaining} ج</span></div>`:''}
</div>

<div class="footer">
  شكراً لثقتكم في ${clinicName}<br>
  هذه الفاتورة صادرة إلكترونياً وسارية بدون توقيع
</div>
</body>
</html>`;
}

function printInvoiceReal(inv){
  if(!inv) return;
  const clinicName = DB.obj('settings').clinicName || 'عيادات الحياة للتجميل';
  const clinicPhone = DB.obj('settings').phone || '';
  const idx = DB.get('invoices').findIndex(x=>String(x.id)===String(inv.id));
  const html = buildInvoiceHTML(inv, clinicName, clinicPhone, idx);
  openInvoiceWindow(html, inv, null);
}

function openInvoiceWindow(html, inv, waUrl){
  const invId = inv ? inv.id : '';
  const waBtnHtml = waUrl
    ? `<button onclick="window.open('`+waUrl+`','_blank')" style="padding:9px 22px;background:#25D366;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Tajawal',sans-serif;">💬 فتح واتساب</button>`
    : '';
  const toolbar = `<div id="inv-toolbar" style="position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:2px solid #C4A882;padding:12px 20px;display:flex;gap:10px;justify-content:center;align-items:center;z-index:9999;font-family:'Tajawal',sans-serif;">
    <button id="pdf-btn" onclick="downloadInvPDF()" style="padding:9px 22px;background:#1a6dcc;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Tajawal',sans-serif;">📄 تحميل PDF</button>
    `+waBtnHtml+`
    <button onclick="window.print()" style="padding:9px 22px;background:#C4A882;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Tajawal',sans-serif;">🖨 طباعة</button>
    <button onclick="window.close()" style="padding:9px 22px;background:#eee;color:#333;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Tajawal',sans-serif;">✕ إغلاق</button>
  </div>
  <div style="height:70px"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
  <script>
  function downloadInvPDF(){
    var btn=document.getElementById('pdf-btn');
    btn.textContent='⏳ جارٍ التحميل...';btn.disabled=true;
    var tb=document.getElementById('inv-toolbar');
    tb.style.display='none';
    html2pdf().set({margin:10,filename:'فاتورة-`+invId+`.pdf',image:{type:'jpeg',quality:0.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(document.body).save().then(function(){tb.style.display='flex';btn.textContent='📄 تحميل PDF';btn.disabled=false;});
  }
  <\/script>`;

  const modifiedHtml = html.replace('</body>', toolbar + '</body>');
  const w = window.open('','_blank','width=820,height=750,scrollbars=yes');
  if(!w){ showToast('error','❌ السماح بفتح النوافذ المنبثقة مطلوب'); return; }
  w.document.write(modifiedHtml);
  w.document.close();
}

// Override the print function
window.printInvoice = function(id){
  const inv = DB.get('invoices').find(i=>String(i.id)===String(id));
  if(inv) printInvoiceReal(inv);
  else showToast('error','❌ لم يتم العثور على الفاتورة');
};

// إرسال فاتورة عبر واتساب - يعرض الفاتورة كـ PDF أولاً + زر واتساب
function sendInvoiceWA(id){
  const inv=DB.get('invoices').find(x=>String(x.id)===String(id));
  if(!inv){showToast('error','❌ الفاتورة غير موجودة');return;}
  const pat=DB.get('patients').find(p=>String(p.id)===String(inv.patId))||DB.get('patients').find(p=>p.name===inv.patient);
  const phone=getWAPhone(pat);
  const clinicName=DB.obj('settings').clinicName||'عيادات الحياة للتجميل';
  const clinicPhone2=DB.obj('settings').phone||'';
  const idx=DB.get('invoices').findIndex(x=>String(x.id)===String(id));
  const waMsg=`مرحباً ${inv.patient} 😊\nإليك تفاصيل فاتورتك من ${clinicName}\n🧾 رقم الفاتورة: #INV-${String(idx+1).padStart(3,'0')}\n💆 الخدمة: ${inv.service||'—'}\n💰 الإجمالي: ${inv.total} ج\n✅ المدفوع: ${inv.paid} ج${inv.remaining>0?`\n⏳ المتبقي: ${inv.remaining} ج`:''}\n💳 طريقة الدفع: ${inv.method||'—'}\n📅 التاريخ: ${inv.date}\n\nشكراً لثقتكم بـ ${clinicName}`;
  const waUrl = phone ? `https://wa.me/${phone.replace('+','')}?text=${encodeURIComponent(waMsg)}` : null;
  const html = buildInvoiceHTML(inv, clinicName, clinicPhone2, idx);
  openInvoiceWindow(html, inv, waUrl);
  if(!phone) showToast('warning','⚠️ لا يوجد رقم واتساب للعميل - يمكنك تحميل PDF فقط');
  else showToast('success',`✅ حمّل PDF ثم اضغط "فتح واتساب" لإرساله لـ ${inv.patient}`);
}

// ══════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// 💳 PHASE 6: SMART PAYMENT MODULE — Full Automation
// ══════════════════════════════════════════════════════════

// ── Enhanced renderInvs with smart payment buttons ──
function renderInvs(){
  const q=(document.getElementById('inv-search-input')?.value||'').toLowerCase();
  const stFilter=document.getElementById('inv-status-filter')?.value||'';
  const methodFilter=document.getElementById('inv-method-filter')?.value||'';
  const dateFilter=document.getElementById('inv-date-filter')?.value||'';

  let invs=DB.get('invoices')||[];
  if(q) invs=invs.filter(i=>(i.patient||'').toLowerCase().includes(q)||(i.service||'').toLowerCase().includes(q));
  if(stFilter) invs=invs.filter(i=>i.status===stFilter);
  if(methodFilter) invs=invs.filter(i=>i.method===methodFilter);
  if(dateFilter) invs=invs.filter(i=>i.date===dateFilter);
  invs=[...invs].sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  // KPIs
  const all=DB.get('invoices')||[];
  const totalRev=all.reduce((s,i)=>s+(i.total||0),0);
  const paidFull=all.filter(i=>i.status==='مدفوع').length;
  const partial=all.filter(i=>i.status==='جزئي'||(i.remaining>0&&i.paid>0)).length;
  const pending=all.reduce((s,i)=>s+(i.remaining||0),0);
  txt('inv-kpi-total',totalRev.toLocaleString()+' ج');
  txt('inv-kpi-paid',paidFull);
  txt('inv-kpi-partial',partial);
  txt('inv-kpi-pending',pending.toLocaleString()+' ج');
  txt('inv-count-lbl',invs.length+' فاتورة');

  const STATUS_CLS={مدفوع:'sc',جزئي:'sp',معلق:'sx'};
  const METHOD_ICO={'كاش':'💵','فيزا':'💳','إنستاباي':'📱','فودافون':'📱','تحويل':'🏦','أقساط':'📆'};
  const tb=document.getElementById('inv-tbody');if(!tb)return;
  tb.innerHTML=invs.map((inv,i)=>`<tr>
    <td style="font-size:11px;color:var(--gold-light);font-weight:700">#INV-${String(i+1).padStart(3,'0')}</td>
    <td style="font-weight:600">${_patName(inv.patId)||inv.patient||'—'}</td>
    <td style="font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${inv.service||'—'}</td>
    <td style="font-size:12px;color:var(--text-muted)">${inv.doctor||'—'}</td>
    <td style="font-weight:800">${(inv.total||0).toLocaleString()} ج</td>
    <td style="color:var(--emerald);font-weight:700">${(inv.paid||0).toLocaleString()} ج</td>
    <td style="color:${(inv.remaining||0)>0?'var(--rose)':'var(--text-muted)'};font-weight:700">${(inv.remaining||0).toLocaleString()} ج</td>
    <td><span class="tag tg-teal">${METHOD_ICO[inv.method]||'💰'} ${inv.method||'—'}</span></td>
    <td style="font-size:12px;color:var(--text-muted)">${inv.date||'—'}</td>
    <td><span class="ast ${STATUS_CLS[inv.status]||'sd'}">${inv.status||'معلق'}</span></td>
    <td style="display:flex;gap:5px;">
      ${(inv.remaining||0)>0?`<button class="btn btn-teal btn-xs" onclick="openSmartPay('${inv.id}')">💳 دفع</button>`:'<span style="color:var(--emerald);font-size:11px;font-weight:700">✅ مكتمل</span>'}
      <button class="btn btn-ghost btn-xs" onclick="printInvoice('${inv.id}')">🖨️</button>
      <button class="btn btn-ghost btn-xs" onclick="sendInvoiceWA('${inv.id}')">💬</button>
    </td>
  </tr>`).join('')||'<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:24px">لا توجد فواتير بعد — ستُنشأ تلقائياً عند اكتمال الاستشارات</td></tr>';
}

function filterInvs(q){
  const inp=document.getElementById('inv-search-input');if(inp)inp.value=q;
  renderInvs();
}

function exportInvs(){
  const invs=DB.get('invoices')||[];
  const rows=[['#','العميل','الخدمة','الطبيب','الإجمالي','المدفوع','المتبقي','الطريقة','التاريخ','الحالة']];
  invs.forEach((inv,i)=>rows.push([
    `INV-${String(i+1).padStart(3,'0')}`,inv.patient,inv.service,inv.doctor,
    inv.total,inv.paid,inv.remaining,inv.method,inv.date,inv.status
  ]));
  const csv=rows.map(r=>r.join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`invoices_${new Date().toISOString().split('T')[0]}.csv`;a.click();
  showToast('success','📊 تم تصدير الفواتير');
}

// ── Open Smart Payment Modal ──
function openSmartPay(invId){
  const inv=(DB.get('invoices')||[]).find(i=>String(i.id)===String(invId));
  if(!inv){showToast('error','❌ الفاتورة غير موجودة');return;}
  const pat=(DB.get('patients')||[]).find(p=>String(p.id)===String(inv.patId)||p.name===inv.patient);
  const idx=(DB.get('invoices')||[]).findIndex(i=>String(i.id)===String(invId));

  // Set hidden id
  document.getElementById('sp-inv-id').value=invId;

  // Basic info
  txt('sp-inv-ref',`#INV-${String(idx+1).padStart(3,'0')}`);
  txt('sp-pat-name',_patName(inv.patId)||inv.patient||'—');
  txt('sp-service-name',inv.service||'—');
  txt('sp-total',(inv.total||0).toLocaleString()+' ج');
  txt('sp-paid-before',(inv.paid||0).toLocaleString()+' ج');
  txt('sp-remaining-display',(inv.remaining||0).toLocaleString()+' ج');

  // Patient credit/balance
  const credit=Math.abs(pat?.credit||0);
  const creditEl=document.getElementById('sp-credit-display');
  if(creditEl){
    creditEl.textContent=credit>0?credit.toLocaleString()+' ج (رصيد دائن)':'لا يوجد';
    creditEl.style.color=credit>0?'var(--teal)':'var(--text-muted)';
  }

  // Quick amount buttons
  const rem=inv.remaining||0;
  const btns=document.getElementById('sp-quick-btns');
  if(btns){
    const opts=[];
    if(rem>0) opts.push({label:`كامل المبلغ — ${rem.toLocaleString()} ج`,val:rem,cls:'btn-teal'});
    if(credit>0&&credit<=rem) opts.push({label:`استخدام الرصيد — ${credit.toLocaleString()} ج`,val:credit,cls:'btn-ghost'});
    [Math.round(rem/2),Math.round(rem/3)].forEach(v=>{ if(v>0&&v<rem) opts.push({label:v.toLocaleString()+' ج',val:v,cls:'btn-ghost'}); });
    btns.innerHTML=opts.map(o=>`<button class="btn ${o.cls} btn-sm" onclick="setSpAmount(${o.val})">${o.label}</button>`).join('');
  }

  // Smart suggestions
  const suggBox=document.getElementById('sp-suggestions');
  const suggContent=document.getElementById('sp-sugg-content');
  const suggestions=[];
  if(credit>0) suggestions.push({icon:'💡',text:`العميل لديه رصيد دائن ${credit.toLocaleString()} ج — يمكن خصمه تلقائياً`});
  // Check outstanding installments
  const instPlans=(DB.get('installments')||[]).filter(p=>p.patientId==pat?.id&&p.status==='نشط');
  if(instPlans.length>0) suggestions.push({icon:'📆',text:`لدى العميل ${instPlans.length} خطة أقساط نشطة`});
  if(rem>500) suggestions.push({icon:'📋',text:`المبلغ كبير — يمكن تحويله لأقساط شهرية ميسرة`});
  if(suggBox&&suggContent){
    if(suggestions.length>0){
      suggContent.innerHTML=suggestions.map(s=>`<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--amber);background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.15);border-radius:8px;padding:8px 12px;">${s.icon} ${s.text}</div>`).join('');
      suggBox.style.display='block';
    } else {
      suggBox.style.display='none';
    }
  }

  // Reset fields
  const amtEl=document.getElementById('sp-amount');if(amtEl){amtEl.value=rem;amtEl.focus();}
  const instOpt=document.getElementById('sp-installment-option');
  if(instOpt) instOpt.style.display=rem>200?'block':'none';
  const instChk=document.getElementById('sp-make-installment');if(instChk)instChk.checked=false;
  const instFields=document.getElementById('sp-inst-fields');if(instFields)instFields.style.display='none';
  document.getElementById('sp-notes').value='';

  onSpAmountChange();
  document.getElementById('smart-pay-modal').classList.add('open');
}

function setSpAmount(val){
  const el=document.getElementById('sp-amount');if(el){el.value=val;el.focus();}
  onSpAmountChange();
}

function onSpAmountChange(){
  const invId=document.getElementById('sp-inv-id')?.value;
  const inv=(DB.get('invoices')||[]).find(i=>String(i.id)===String(invId));
  if(!inv)return;
  const amount=parseFloat(document.getElementById('sp-amount')?.value)||0;
  const rem=inv.remaining||0;
  const newPaid=(inv.paid||0)+amount;
  const newRem=Math.max(0,rem-amount);
  const isOver=amount>rem;
  const isPartial=amount>0&&amount<rem;
  const isFull=amount>=rem&&amount>0;

  const preview=document.getElementById('sp-preview-content');
  if(preview){
    let html='';
    if(amount<=0){html='<span style="color:var(--text-muted)">أدخل المبلغ لعرض ملخص العملية</span>';}
    else if(isOver){html=`<span style="color:var(--rose)">⚠️ المبلغ المدخل (${amount.toLocaleString()} ج) أكبر من المتبقي (${rem.toLocaleString()} ج)</span>`;}
    else{
      html+=`<div>✅ سيُضاف إلى المدفوع: <b style="color:var(--emerald)">${newPaid.toLocaleString()} ج</b></div>`;
      if(isFull) html+=`<div>🎉 الفاتورة ستُغلق بالكامل كـ <b style="color:var(--teal)">مدفوع</b></div>`;
      if(isPartial) html+=`<div>⏳ المتبقي بعد الدفعة: <b style="color:var(--amber)">${newRem.toLocaleString()} ج</b> — الفاتورة بحالة <b>جزئي</b></div>`;
      html+=`<div>🏦 سيُضاف للخزينة: <b style="color:var(--gold-light)">${amount.toLocaleString()} ج</b></div>`;
    }
    preview.innerHTML=html;
  }

  // Enable/disable confirm button
  const btn=document.getElementById('sp-confirm-btn');
  if(btn) btn.disabled=(amount<=0||isOver);

  calcSpInstPreview();
}

function toggleSpInstallment(){
  const chk=document.getElementById('sp-make-installment')?.checked;
  const fields=document.getElementById('sp-inst-fields');
  if(fields) fields.style.display=chk?'grid':'none';
  calcSpInstPreview();
}

function calcSpInstPreview(){
  const invId=document.getElementById('sp-inv-id')?.value;
  const inv=(DB.get('invoices')||[]).find(i=>String(i.id)===String(invId));
  if(!inv)return;
  const amount=parseFloat(document.getElementById('sp-amount')?.value)||0;
  const rem=Math.max(0,(inv.remaining||0)-amount);
  const count=parseInt(document.getElementById('sp-inst-count')?.value)||3;
  const each=count?Math.ceil(rem/count):0;
  const prev=document.getElementById('sp-inst-preview');
  if(prev) prev.textContent=each>0?`${each.toLocaleString()} ج / شهر`:'—';
}

// ── Process Smart Payment ──
function processSmartPayment(){
  const invId=document.getElementById('sp-inv-id')?.value;
  const inv=(DB.get('invoices')||[]).find(i=>String(i.id)===String(invId));
  if(!inv){showToast('error','❌ الفاتورة غير موجودة');return;}

  const amount=parseFloat(document.getElementById('sp-amount')?.value)||0;
  const method=document.getElementById('sp-method')?.value||'كاش';
  const notes=document.getElementById('sp-notes')?.value||'';
  const makeInst=document.getElementById('sp-make-installment')?.checked;
  const instCount=parseInt(document.getElementById('sp-inst-count')?.value)||3;
  const rem=inv.remaining||0;

  if(amount<=0){showToast('warning','⚠️ أدخل المبلغ');return;}
  if(amount>rem){showToast('warning','⚠️ المبلغ أكبر من المتبقي');return;}

  const today=new Date().toISOString().split('T')[0];
  const newPaid=(inv.paid||0)+amount;
  const newRem=Math.max(0,rem-amount);
  const isFull=newRem===0;

  // 1. Update invoice
  DB.upd('invoices',invId,{
    paid:newPaid,
    remaining:newRem,
    status:isFull?'مدفوع':'جزئي',
    method,
    lastPayDate:today,
    lastPayNotes:notes
  });

  // 2. Add treasury cash-in entry automatically
  if(!DB.get('cashlog')) DB.set('cashlog',[]);
  DB.push('cashlog',{
    type:'وارد',
    amount,
    source:`دفعة فاتورة — ${inv.patient}`,
    service:inv.service||'',
    doctor:inv.doctor||'',
    branch:inv.branch||'',
    method,
    date:today,
    invId,
    patId:inv.patId||'',
    notes
  });

  // 3. ✅ تحديث رصيد العميل يحصل تلقائيًا عبر EventBus('invoices:updated') في 00-core.js
  // (كان هنا كود يدوي بيطرح amount من pat.balance مرة ثانية فوق التحديث التلقائي — باج احتساب مضاعف، تم حذفه)
  const pat=(DB.get('patients')||[]).find(p=>String(p.id)===String(inv.patId)||p.name===inv.patient);

  // 4. Auto-create installment plan if selected
  if(makeInst&&newRem>0){
    const each=Math.ceil(newRem/instCount);
    const payments=[];
    for(let i=1;i<=instCount;i++){
      const d=new Date(today);d.setMonth(d.getMonth()+i);
      payments.push({num:i,dueDate:d.toISOString().split('T')[0],paid:false,paidDate:null});
    }
    if(!DB.get('installments')) DB.set('installments',[]);
    DB.push('installments',{
      patientId:pat?.id||inv.patId,patientName:inv.patient,service:inv.service||'',
      total:inv.total,downPayment:newPaid,remaining:newRem,installmentAmount:each,
      count:instCount,payments,startDate:today,status:'نشط',fromInvId:invId
    });
    if(pat) DB.upd('patients',pat.id,{status:'قسط'});
    // Update invoice method to installments
    DB.upd('invoices',invId,{method:'أقساط'});
  }

  // 5. ✅ تحديث الشاشات + KPIs لوحة التحكم يحصل تلقائيًا عبر EventBus
  // (DB.upd للفاتورة وDB.push لـ cashlog يجدولان _scheduleUIRefresh + _refreshDashKPIs في 00-core.js)
  // renderPayments() لسه يدوية لأن شاشة المدفوعات مالها hint مخصص في _scheduleUIRefresh حتى الآن
  renderPayments();
  txt('badge-inst',(DB.get('installments')||[]).filter(p=>p.remaining>0).length);

  closeModal('smart-pay-modal');

  if(isFull){
    showToast('success',`✅ تم استلام كامل المبلغ من ${inv.patient}`,`${amount.toLocaleString()} ج — الفاتورة مغلقة بالكامل 🎉`);
  } else if(makeInst){
    const each2=Math.ceil(newRem/instCount);
    showToast('success',`✅ تم استلام ${amount.toLocaleString()} ج`,`المتبقي ${newRem.toLocaleString()} ج على ${instCount} أقساط × ${each2.toLocaleString()} ج`);
  } else {
    showToast('success',`✅ تم استلام ${amount.toLocaleString()} ج`,`المتبقي: ${newRem.toLocaleString()} ج`);
  }
}

// ── Auto-update installment overdue statuses ──
function updateInstallmentStatuses(){
  const today=new Date().toISOString().split('T')[0];
  let changed=false;
  const plans=DB.get('installments')||[];
  plans.forEach(p=>{
    if(p.status==='مكتمل') return;
    const overdue=p.payments&&p.payments.filter(x=>!x.paid&&x.dueDate<today).length>0;
    if(overdue&&p.status!=='متأخر'){
      DB.upd('installments',p.id,{status:'متأخر'});
      changed=true;
    }
  });
  if(changed) renderInstallments();
}

// ── Enhanced renderPayments with full history ──
