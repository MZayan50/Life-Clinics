// ══════════════════════════════════════════════════════════════════
// 📦 INVENTORY MODULE — v4.0 (Event-Driven)
// ══════════════════════════════════════════════════════════════════
// التغييرات من v3 → v4:
//  1. deductInventory → DB.upd() بدل DB.set() لتشغيل EventBus
//  2. جميع render() يدوية حُذفت — EventBus يتولى التحديث
//  3. delPurchase / delTransfer → DB.del() بدل DB.set(.filter)
//  4. تسجيل EventBus.on للاستجابة لأحداث inventory:*
// ══════════════════════════════════════════════════════════════════

// ── ربط EventBus: أي تغيير في inventory يُحدِّث واجهة المخزون ──
EventBus.on('inventory:created',  () => { if(window.renderInv) renderInv(); });
EventBus.on('inventory:updated',  () => { if(window.renderInv) renderInv(); });
EventBus.on('inventory:deleted',  () => { if(window.renderInv) renderInv(); });
EventBus.on('suppliers:created',  () => { if(window.renderSuppliers) renderSuppliers(); if(window.fillPurchaseSuppliers) fillPurchaseSuppliers(); });
EventBus.on('suppliers:updated',  () => { if(window.renderSuppliers) renderSuppliers(); if(window.fillPurchaseSuppliers) fillPurchaseSuppliers(); });
EventBus.on('suppliers:deleted',  () => { if(window.renderSuppliers) renderSuppliers(); });
EventBus.on('purchases:created',  () => { if(window.renderPurchases) renderPurchases(); });
EventBus.on('purchases:updated',  () => { if(window.renderPurchases) renderPurchases(); if(window.renderInv) renderInv(); });
EventBus.on('purchases:deleted',  () => { if(window.renderPurchases) renderPurchases(); });
EventBus.on('transfers:created',  () => { if(window.renderTransfers) renderTransfers(); if(window.renderInv) renderInv(); });
EventBus.on('transfers:deleted',  () => { if(window.renderTransfers) renderTransfers(); });

// ══════════════════════════════════════════
// 📦 INVENTORY AUTO-DEDUCT FROM SESSIONS
// يدعم نظام الوصفة (BOM) — قائمة مكونات متعددة لكل خدمة
// الأولوية: recipe[] → ثم linkedProductId (legacy) للتوافق مع البيانات القديمة
// ══════════════════════════════════════════
function deductInventory(serviceId, sessionQty){
  if(!serviceId) return;
  const svc = DB.get('services').find(s => s.id === serviceId);
  if(!svc) return;
  const inv = DB.get('inventory');
  sessionQty = sessionQty || 1;

  // ── نظام الوصفة الجديد (BOM) ──
  const recipe = svc.recipe;
  if(recipe && Array.isArray(recipe) && recipe.length > 0){
    recipe.forEach(ingredient => {
      if(!ingredient.productId || !ingredient.qty) return;
      const item = inv.find(i => i.id === ingredient.productId);
      if(!item) return;
      const deductQty = parseFloat(ingredient.qty) * sessionQty;
      const newQty    = Math.max(0, item.qty - deductQty);
      const newStatus = newQty === 0 ? 'نفذ' : newQty <= (item.reorder||0) ? 'منخفض' : 'متوفر';
      DB.upd('inventory', item.id, { qty: newQty, status: newStatus });
      if(newQty <= (item.reorder||0)){
        showToast('warning', `⚠️ مخزون منخفض: ${item.name}`, `متبقي ${newQty} ${ingredient.unit||'وحدة'}`);
      }
    });
    return;
  }

  // ── نظام المنتج الواحد القديم (legacy fallback) ──
  if(!svc.linkedProductId) return;
  const consumeQty = (svc.consumeQty || 1) * sessionQty;
  const item = inv.find(i => i.id === svc.linkedProductId);
  if(!item) return;
  const newQty    = Math.max(0, item.qty - consumeQty);
  const newStatus = newQty === 0 ? 'نفذ' : newQty <= (item.reorder||0) ? 'منخفض' : 'متوفر';
  DB.upd('inventory', item.id, { qty: newQty, status: newStatus });
  if(newQty <= (item.reorder||0)){
    showToast('warning', `⚠️ مخزون منخفض: ${item.name}`, `متبقي ${newQty} وحدة`);
  }
}

// ══════════════════════════════════════════
// 💰 حساب تكلفة المواد لخدمة معينة
// يُستخدم في التقارير وحساب ربح الجلسة
// ══════════════════════════════════════════
function calcServiceMaterialCost(serviceId){
  if(!serviceId) return 0;
  const svc = DB.get('services').find(s => s.id === serviceId);
  if(!svc) return 0;
  const inv = DB.get('inventory');

  // من الوصفة (BOM)
  if(svc.recipe && Array.isArray(svc.recipe) && svc.recipe.length > 0){
    return svc.recipe.reduce((total, ingredient) => {
      if(!ingredient.productId || !ingredient.qty) return total;
      const item = inv.find(i => i.id === ingredient.productId);
      if(!item) return total;
      const unitCost = item.cost || item.lastPurchasePrice || 0;
      return total + (parseFloat(ingredient.qty) * unitCost);
    }, 0);
  }

  // من المنتج الواحد (legacy)
  if(svc.linkedProductId){
    const item = inv.find(i => i.id === svc.linkedProductId);
    if(item){
      const unitCost = item.cost || item.lastPurchasePrice || 0;
      return (svc.consumeQty || 1) * unitCost;
    }
  }
  return svc.cost || 0;
}

// ══════════════════════════════════════════
// 🚚 SUPPLIERS SCREEN
// ══════════════════════════════════════════
function renderSuppliers(q){
  q = q || '';
  const stFilter = document.getElementById('sup-status-filter')?.value || '';
  // لا seed وهمي — البيانات تأتي من قاعدة البيانات الفعلية فقط
  let sups = DB.get('suppliers');
  if(q) sups = sups.filter(s => s.name.includes(q) || (s.cat||'').includes(q));
  if(stFilter) sups = sups.filter(s => s.status === stFilter);

  const all = DB.get('suppliers');
  const _allPurchases = DB.get('purchases') || [];
  const _allPayments  = DB.get('supplier_payments') || [];
  const _thisMonthSup = new Date().toISOString().slice(0,7);
  const _totalPurchases = _allPurchases.filter(p=>p.status==='مستلم').reduce((s,p)=>s+(p.total||0),0);
  const _totalPayments  = _allPayments.reduce((s,sp)=>s+(sp.amount||0),0);
  const _totalOwed      = Math.max(0, _totalPurchases - _totalPayments);
  txt('sup-kpi-total',    all.length);
  txt('sup-kpi-purchases', _totalPurchases.toLocaleString()+' ج');
  txt('sup-kpi-payments',  _totalPayments.toLocaleString()+' ج');
  txt('sup-kpi-owed',      _totalOwed.toLocaleString()+' ج');
  txt('sup-kpi-orders',    _allPurchases.filter(p => p.status==='مستلم' && (p.orderDate||p.deliveryDate||'').startsWith(_thisMonthSup)).length);
  txt('sup-count-lbl', sups.length+' مورد');

  const allPurchases = DB.get('purchases') || [];
  const allPayments  = DB.get('supplier_payments') || [];

  // حساب owed لكل مورد من المشتريات
  const calcOwed = (supId) => {
    const bought = allPurchases.filter(p => p.supplierId === supId && p.status === 'مستلم').reduce((s,p)=>s+(p.total||0),0);
    const paid   = allPayments.filter(sp => sp.supplierId === supId).reduce((s,sp)=>s+(sp.amount||0),0);
    return Math.max(0, bought - paid);
  };

  const tb = document.getElementById('sup-tbody'); if(!tb) return;
  tb.innerHTML = sups.map(s => {
    const owed = calcOwed(s.id);
    return `<tr>
      <td style="font-weight:700">${s.name}</td>
      <td><span class="tag tg-purple">${s.cat||'—'}</span></td>
      <td style="font-size:12px">${s.phone||'—'}</td>
      <td style="font-size:11px;color:var(--text-muted)">${s.email||'—'}</td>
      <td style="font-size:12px">${s.terms||'—'}</td>
      <td style="color:${owed>0?'var(--rose)':'var(--emerald)'};font-weight:700">${owed.toLocaleString()} ج</td>
      <td><span class="ast ${s.status==='نشط'?'sc':'sd'}">${s.status}</span></td>
      <td style="display:flex;gap:5px;">
        <button class="btn btn-teal btn-xs" onclick="openSupplierDetail('${s.id}')">📋 حساب</button>
        <button class="btn btn-ghost btn-xs" onclick="openSupplierModal('${s.id}')">✏️</button>
        <button class="btn btn-danger btn-xs" onclick="delSupplier('${s.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px">لا يوجد موردون</td></tr>';

}

function openSupplierModal(id){
  const s = id ? DB.get('suppliers').find(x => x.id === id) : null;
  document.getElementById('sup-modal-title').textContent = s ? '✏️ تعديل مورد' : '🚚 مورد جديد';
  ['id','name','cat','phone','email','contact','terms','owed','status','notes'].forEach(f => {
    const el = document.getElementById('sup-'+f); if(el) el.value = s ? s[f]||'' : '';
  });
  if(!s){ document.getElementById('sup-status').value = 'نشط'; document.getElementById('sup-terms').value = '30 يوم'; }
  openModal('supplier-modal');
}

function saveSupplier(){
  const name = document.getElementById('sup-name')?.value.trim();
  if(!name){ showToast('warning','⚠️ اسم المورد مطلوب'); return; }
  const id   = document.getElementById('sup-id')?.value;
  const data = { name, cat:gv('sup-cat'), phone:gv('sup-phone'), email:gv('sup-email'),
                 contact:gv('sup-contact'), terms:gv('sup-terms'),
                 owed:parseFloat(gv('sup-owed'))||0, status:gv('sup-status'), notes:gv('sup-notes') };
  if(id){ DB.upd('suppliers', id, data); showToast('success', `✅ تم تحديث ${name}`); }
  else  { DB.push('suppliers', data);   showToast('success', `✅ تم إضافة ${name}`); }
  // لا داعي لاستدعاء renderSuppliers يدوياً — EventBus يتولى ذلك
  closeModal('supplier-modal');
}

function delSupplier(id){
  const s = DB.get('suppliers').find(x => x.id === id);
  if(!s) return;
  // ── منع حذف المورد إذا كان لديه معاملات شراء ──
  const hasPurchases = (DB.get('purchases')||[]).some(p => p.supplierId === id);
  const hasPayments  = (DB.get('supplier_payments')||[]).some(sp => sp.supplierId === id);
  if(hasPurchases || hasPayments){
    showToast('warning', `⚠️ لا يمكن حذف المورد "${s.name}" لأن لديه معاملات مرتبطة به`);
    return;
  }
  if(confirm(`حذف ${s.name}؟`)){ DB.del('suppliers', id); showToast('info','🗑 تم الحذف'); }
}
// ══════════════════════════════════════════
// 📋 حساب المورد التفصيلي
// ══════════════════════════════════════════
function openSupplierDetail(supId){
  const sup = DB.get('suppliers').find(s => s.id === supId);
  if(!sup) return;

  const purchases = (DB.get('purchases')||[]).filter(p => p.supplierId === supId);
  const payments  = (DB.get('supplier_payments')||[]).filter(sp => sp.supplierId === supId);

  const totalBought = purchases.filter(p=>p.status==='مستلم').reduce((s,p)=>s+(p.total||0),0);
  const totalPaid   = payments.reduce((s,sp)=>s+(sp.amount||0),0);
  const owed        = Math.max(0, totalBought - totalPaid);

  const modal = document.getElementById('supplier-detail-modal');
  if(!modal){ showToast('error','❌ modal غير موجود'); return; }

  document.getElementById('sd-name').textContent  = sup.name;
  document.getElementById('sd-phone').textContent = sup.phone||'—';
  document.getElementById('sd-owed').textContent  = owed.toLocaleString()+' ج';
  document.getElementById('sd-id').value          = supId;
  // ── KPI: إجمالي المشتريات وإجمالي المدفوعات ──
  const sdTotalPur = document.getElementById('sd-total-purchases');
  const sdTotalPaid = document.getElementById('sd-total-paid');
  if(sdTotalPur)  sdTotalPur.textContent  = totalBought.toLocaleString()+' ج';
  if(sdTotalPaid) sdTotalPaid.textContent = totalPaid.toLocaleString()+' ج';

  // جدول المشتريات
  const purTb = document.getElementById('sd-pur-tbody');
  if(purTb){
    purTb.innerHTML = purchases.length ? purchases.sort((a,b)=>(b.orderDate||'').localeCompare(a.orderDate||'')).map(p=>`
      <tr>
        <td style="font-size:12px">${p.orderDate||'—'}</td>
        <td style="font-weight:600">${p.product||'—'}</td>
        <td>${(p.qty||0).toLocaleString()}</td>
        <td>${(p.unitPrice||0).toLocaleString()} ج</td>
        <td style="font-weight:700">${(p.total||0).toLocaleString()} ج</td>
        <td><span class="ast ${p.status==='مستلم'?'sc':p.status==='ملغي'?'sd':'sp'}">${p.status||'—'}</span></td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:16px">لا توجد مشتريات</td></tr>';
  }

  // جدول الدفعات
  const payTb = document.getElementById('sd-pay-tbody');
  if(payTb){
    payTb.innerHTML = payments.length ? payments.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(sp=>`
      <tr>
        <td style="font-size:12px">${sp.date||'—'}</td>
        <td style="color:var(--emerald);font-weight:700">${(sp.amount||0).toLocaleString()} ج</td>
        <td style="font-size:12px">${sp.method||'كاش'}</td>
        <td style="font-size:11px;color:var(--text-muted)">${sp.notes||'—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:16px">لا توجد دفعات</td></tr>';
  }

  openModal('supplier-detail-modal');
}

function paySupplier(){
  const supId  = document.getElementById('sd-id')?.value;
  const amount = parseFloat(document.getElementById('sd-pay-amount')?.value)||0;
  const method = document.getElementById('sd-pay-method')?.value||'كاش';
  const notes  = document.getElementById('sd-pay-notes')?.value||'';
  if(!supId){ showToast('error','❌ مورد غير محدد'); return; }
  if(amount <= 0){ showToast('warning','⚠️ أدخل مبلغ صحيح'); return; }

  const sup = DB.get('suppliers').find(s => s.id === supId);
  if(!sup) return;

  const today = new Date().toISOString().split('T')[0];
  DB.push('supplier_payments',{ supplierId:supId, supplierName:sup.name, amount, method, date:today, notes });
  DB.push('cashlog',{ type:'صادر', source:`دفعة مورد — ${sup.name}`, amount, method, date:today, notes });

  // إعادة حساب owed
  const totalBought = (DB.get('purchases')||[]).filter(p=>p.supplierId===supId&&p.status==='مستلم').reduce((s,p)=>s+(p.total||0),0);
  const totalPaid   = (DB.get('supplier_payments')||[]).filter(sp=>sp.supplierId===supId).reduce((s,sp)=>s+(sp.amount||0),0);
  DB.upd('suppliers', supId, { owed: Math.max(0, totalBought - totalPaid) });

  document.getElementById('sd-pay-amount').value = '';
  document.getElementById('sd-pay-notes').value  = '';
  showToast('success',`✅ تم تسجيل دفعة ${amount.toLocaleString()} ج للمورد ${sup.name}`);
  openSupplierDetail(supId); // تحديث الـ modal
  renderSuppliers();
}



// ══════════════════════════════════════════
// 🛒 PURCHASES SCREEN
// ══════════════════════════════════════════
function renderPurchases(q){
  q = q || (document.getElementById('pur-search')?.value||'');
  const stFilter   = document.getElementById('pur-status-filter')?.value || '';
  const dateFilter = document.getElementById('pur-date-filter')?.value || '';
  let purs = DB.get('purchases') || [];
  if(q) purs = purs.filter(p => (p.product||'').includes(q) || (p.supplier||'').includes(q) || (p.notes||'').includes(q));
  if(stFilter) purs = purs.filter(p => p.status === stFilter);
  if(dateFilter) purs = purs.filter(p => p.orderDate === dateFilter);
  purs = [...purs].sort((a,b) => (b.orderDate||'').localeCompare(a.orderDate||''));

  const all = DB.get('purchases') || [];
  const thisMonth = new Date().toISOString().slice(0,7);
  txt('pur-kpi-pending',  all.filter(p => p.status==='معلق').length);
  txt('pur-kpi-received', all.filter(p => p.status==='مستلم' && (p.deliveryDate||'').startsWith(thisMonth)).length);
  txt('pur-kpi-total',    all.reduce((s,p) => s+(p.total||0), 0).toLocaleString()+' ج');
  txt('pur-kpi-items',    all.filter(p => p.status==='مستلم').length);
  txt('pur-count-lbl',    purs.length+' طلب');

  const stClass = {'معلق':'sp','موافق عليه':'sw','مستلم':'sc','ملغي':'sx'};
  const tb = document.getElementById('pur-tbody'); if(!tb) return;
  tb.innerHTML = purs.map((p,i) => `<tr>
    <td style="font-size:11px;color:var(--gold-light);font-weight:700">#PO-${String(i+1).padStart(3,'0')}</td>
    <td style="font-weight:600">${p.product}</td>
    <td style="font-size:12px">${p.supplier||'—'}</td>
    <td style="text-align:center;font-weight:700">${p.qty||0}</td>
    <td style="color:var(--gold-light);font-weight:700">${(p.total||0).toLocaleString()} ج</td>
    <td style="font-size:12px">${p.orderDate||'—'}</td>
    <td style="font-size:12px;color:${p.deliveryDate&&new Date(p.deliveryDate)<new Date()&&p.status!=='مستلم'?'var(--rose)':'var(--text-muted)'}">${p.deliveryDate||'—'}</td>
    <td><span class="ast ${stClass[p.status]||'sd'}">${p.status}</span></td>
    <td style="font-size:11px;color:var(--text-muted);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${p.notes||''}">${p.notes||'—'}</td>
    <td style="display:flex;gap:5px;">
      ${p.status==='معلق'||p.status==='موافق عليه'?`<button class="btn btn-teal btn-xs" onclick="recvPurchase('${p.id}')">✅ استلام</button>`:''}
      <button class="btn btn-ghost btn-xs" onclick="openPurchaseModal('${p.id}')">✏️</button>
      <button class="btn btn-danger btn-xs" onclick="delPurchase('${p.id}')">🗑</button>
    </td>
  </tr>`).join('') || '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:24px">لا توجد طلبات شراء</td></tr>';
}

function openPurchaseModal(id){
  fillPurchaseSuppliers();
  fillPurchaseProducts();
  const p = id ? (DB.get('purchases')||[]).find(x => String(x.id) === String(id)) : null;
  const titleEl = document.getElementById('pur-modal-title');
  if(titleEl) titleEl.textContent = p ? '✏️ تعديل طلب شراء' : '🛒 طلب شراء جديد';
  document.getElementById('pur-id').value           = p ? p.id : '';
  // ملء الـ select بالمنتج المحفوظ
  const purProdSel = document.getElementById('pur-product');
  if(purProdSel && p) purProdSel.value = p.productId || '';
  document.getElementById('pur-product-id').value   = p ? (p.productId||'') : '';
  document.getElementById('pur-qty').value          = p ? p.qty : '';
  document.getElementById('pur-unit-price').value   = p ? p.unitPrice : '';
  document.getElementById('pur-total-preview').textContent = p ? (p.total||0).toLocaleString()+' ج' : '0 ج';
  document.getElementById('pur-order-date').value   = p ? p.orderDate : new Date().toISOString().split('T')[0];
  document.getElementById('pur-delivery-date').value = p ? p.deliveryDate||'' : '';
  const statusEl = document.getElementById('pur-status');
  if(statusEl) statusEl.value = p ? p.status : 'معلق';
  const notesEl=document.getElementById('pur-notes'); if(notesEl) notesEl.value=p?p.notes||'':'';
  openModal('purchase-modal');
}

function fillPurchaseProducts(){
  const sel = document.getElementById('pur-product'); if(!sel) return;
  const items = DB.get('inventory') || [];
  sel.innerHTML = '<option value="">-- اختر منتج من المخزون --</option>' +
    items.map(i => `<option value="${i.id}" data-name="${i.name}" data-branch="${i.branch||''}">${i.name}${i.branch?' ('+i.branch+')':''} — مخزون: ${i.qty}</option>`).join('');
}

function fillPurchaseSuppliers(){
  const sel = document.getElementById('pur-supplier'); if(!sel) return;
  const sups = DB.get('suppliers') || [];
  sel.innerHTML = '<option value="">-- اختر مورد --</option>' + sups.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join('');
}

function calcPurTotal(){
  const q = parseFloat(document.getElementById('pur-qty')?.value) || 0;
  const p = parseFloat(document.getElementById('pur-unit-price')?.value) || 0;
  txt('pur-total-preview', (q*p).toLocaleString()+' ج');
}

function savePurchase(){
  const purSel = document.getElementById('pur-product');
  const productId = purSel?.value || '';
  const productName = purSel?.options[purSel?.selectedIndex]?.dataset?.name || '';
  if(!productId || !productName){ showToast('warning','⚠️ يجب اختيار منتج من المخزون'); return; }
  const qty = parseInt(gv('pur-qty'))||0;
  const unitPrice = parseFloat(gv('pur-unit-price'))||0;
  if(qty <= 0){ showToast('warning','⚠️ الكمية يجب أن تكون أكبر من صفر'); return; }
  const id = gv('pur-id');
  const supSel = document.getElementById('pur-supplier');
  const supplierId = supSel?.value || '';
  const supplierName = supSel?.options[supSel?.selectedIndex]?.dataset?.name || supplierId;
  const data = { productId, product:productName, supplierId, supplier:supplierName,
                 qty, unitPrice, total:qty*unitPrice,
                 orderDate:gv('pur-order-date'), deliveryDate:gv('pur-delivery-date'),
                 branch:gv('pur-branch'), status:gv('pur-status'),
                 notes: (document.getElementById('pur-notes')?.value||'').trim() };
  if(!DB.get('purchases').length) DB.set('purchases',[]);
  let purchaseId;
  if(id){
    DB.upd('purchases', id, data);
    purchaseId = id;
    showToast('success', `✅ تم تحديث طلب: ${productName}`);
    // تحديث سجل purchase_items الموجود
    const existing = (DB.get('purchase_items')||[]).filter(i => i.purchaseId !== id);
    existing.push({ purchaseId: id, productId, productName, qty, unitPrice });
    DB.set('purchase_items', existing);
  } else {
    const newPur = DB.push('purchases', data);
    purchaseId = newPur?.id;
    // إنشاء سجل في purchase_items
    DB.push('purchase_items', { purchaseId, productId, productName, qty, unitPrice });
    showToast('success', `✅ تم إرسال طلب شراء: ${productName}`);
  }
  closeModal('purchase-modal');
}

function recvPurchase(id){
  const pur = DB.get('purchases').find(p => p.id === id);
  if(!pur){ showToast('error','❌ الطلبية غير موجودة'); return; }
  if(pur.status === 'مستلم'){ showToast('warning','⚠️ هذه الطلبية مستلمة بالفعل'); return; }
  // ✅ تحديث المخزون + مديونية المورد يحصلان تلقائياً عبر hook في 00-core.js
  // نضيف _owedUpdated:false صراحةً حتى يعمل الـ hook على المورد
  DB.upd('purchases', id, {
    status: 'مستلم',
    deliveryDate: new Date().toISOString().split('T')[0],
    _inventoryUpdated: false
  });
  const itemCount = (DB.get('purchase_items')||[]).filter(i => i.purchaseId === id).length;
  showToast('success', `✅ تم استلام الطلبية وتحديث ${itemCount} منتج في المخزون`);
}

function delPurchase(id){
  if(confirm('حذف طلب الشراء؟')){ DB.del('purchases', id); showToast('info','🗑 تم الحذف'); }
}

// ══════════════════════════════════════════
// 🔄 TRANSFERS SCREEN
// ══════════════════════════════════════════
function renderTransfers(q){
  q = q || '';
  const stFilter = document.getElementById('tr-status-filter')?.value || '';
  if(!DB.get('transfers').length) DB.set('transfers',[]);
  let trs = DB.get('transfers');
  if(q) trs = trs.filter(t => t.product.includes(q));
  if(stFilter) trs = trs.filter(t => t.status === stFilter);
  txt('tr-count-lbl', trs.length+' تحويل');
  const tb = document.getElementById('tr-tbody'); if(!tb) return;
  tb.innerHTML = trs.map((t,i) => `<tr>
    <td style="font-size:11px;color:var(--gold-light)">#TR-${String(i+1).padStart(3,'0')}</td>
    <td style="font-weight:600">${t.product}</td>
    <td><span class="tag tg-gold">${t.from}</span></td>
    <td><span class="tag tg-teal">${t.to}</span></td>
    <td style="font-weight:700;color:var(--teal)">${t.qty}</td>
    <td style="font-size:12px">${t.date||'—'}</td>
    <td style="font-size:12px">${t.staff||'—'}</td>
    <td><span class="ast ${t.status==='مكتمل'?'sc':'sp'}">${t.status}</span></td>
    <td><button class="btn btn-danger btn-xs" onclick="delTransfer('${t.id}')">🗑</button></td>
  </tr>`).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px">لا توجد تحويلات</td></tr>';
}

function openTransferModal(){
  const invSel = document.getElementById('tr-product');
  if(invSel) invSel.innerHTML = '<option value="">-- اختر منتج --</option>' +
    (DB.get('inventory')||[]).map(i => `<option value="${i.name}" data-branch="${i.branch||''}">${i.name}${i.branch?' ('+i.branch+')':''} — مخزون: ${i.qty}</option>`).join('');
  document.getElementById('tr-id').value   = '';
  document.getElementById('tr-date').value = new Date().toISOString().split('T')[0];
  openModal('transfer-modal');
}

function saveTransfer(){
  const product = gv('tr-product');
  const qty     = parseInt(gv('tr-qty')) || 0;
  if(!product || !qty){ showToast('warning','⚠️ المنتج والكمية مطلوبان'); return; }
  const from = gv('tr-from'), to = gv('tr-to');
  if(from === to){ showToast('warning','⚠️ الفرعان متطابقان'); return; }
  // ── التحقق من وجود الكمية في المخزون ──
  // نبحث أولاً بالاسم + الفرع، فإن لم يوجد نبحث بالاسم فقط (للمنتجات القديمة بدون branch)
  const srcItem = DB.get('inventory').find(i => i.name === product && (i.branch === from || (!i.branch && from)));
  if(!srcItem){ showToast('error', `❌ المنتج "${product}" غير موجود في فرع ${from}`); return; }
  if((srcItem.qty||0) < qty){ showToast('error', `❌ الكمية المتاحة في ${from} هي ${srcItem.qty} فقط`); return; }
  // ── خصم من الفرع المصدر ──
  const newSrcQty = (srcItem.qty||0) - qty;
  // DB.upd يُطلق inventory:updated → EventBus → renderInv تلقائياً
  DB.upd('inventory', srcItem.id, {
    qty: newSrcQty,
    status: newSrcQty === 0 ? 'نفذ' : newSrcQty <= srcItem.reorder ? 'منخفض' : 'متوفر'
  });
  // ── إضافة للفرع الوجهة ──
  const dstItem = DB.get('inventory').find(i => i.name === product && i.branch === to);
  if(dstItem){
    const newDstQty = (dstItem.qty||0) + qty;
    DB.upd('inventory', dstItem.id, {
      qty: newDstQty,
      status: newDstQty === 0 ? 'نفذ' : newDstQty <= dstItem.reorder ? 'منخفض' : 'متوفر'
    });
  } else {
    // المنتج غير موجود في الفرع الوجهة — ننشئ سجل جديد
    DB.push('inventory', {
      name: srcItem.name, cat: srcItem.cat, qty, reorder: srcItem.reorder,
      price: srcItem.price, cost: srcItem.cost||0, expiry: srcItem.expiry||'',
      status: qty <= srcItem.reorder ? 'منخفض' : 'متوفر', branch: to
    });
  }
  // DB.push يُطلق transfers:created → EventBus → renderTransfers + renderInv تلقائياً
  DB.push('transfers', {
    product, from, to, qty,
    date: gv('tr-date'), notes: gv('tr-notes'),
    staff: window._session?.name || '—', status: 'مكتمل'
  });
  closeModal('transfer-modal');
  showToast('success', `✅ تم تحويل ${qty} × ${product} من ${from} إلى ${to} وتحديث المخزون`);
}

function delTransfer(id){
  if(confirm('حذف سجل التحويل؟')){ DB.del('transfers', id); showToast('info','🗑 تم الحذف'); }
}

// ══════════════════════════════════════════


// ══════════════════════════════════════════
// 📊 تسوية المخزون (Inventory Adjustment)
// ══════════════════════════════════════════
function openAdjustModal(productId){
  const items = DB.get('inventory');
  const adjSel = document.getElementById('adj-product');
  if(adjSel){
    adjSel.innerHTML = '<option value="">-- اختر منتج --</option>' +
      items.map(i => `<option value="${i.id}" data-qty="${i.qty}" data-name="${i.name}">${i.name} — مخزون: ${i.qty}</option>`).join('');
    if(productId) adjSel.value = productId;
    updateAdjPreview();
  }
  const adjQtyEl = document.getElementById('adj-qty');
  const adjTypeEl = document.getElementById('adj-type');
  const adjReasonEl = document.getElementById('adj-reason');
  if(adjQtyEl) adjQtyEl.value = '';
  if(adjTypeEl) adjTypeEl.value = 'إضافة';
  if(adjReasonEl) adjReasonEl.value = '';
  openModal('adjustment-modal');
}

function updateAdjPreview(){
  const sel    = document.getElementById('adj-product');
  const opt    = sel?.options[sel?.selectedIndex];
  const curQty = parseInt(opt?.dataset?.qty) || 0;
  const adjQty = parseInt(document.getElementById('adj-qty')?.value) || 0;
  const type   = document.getElementById('adj-type')?.value || 'إضافة';
  const newQty = type === 'إضافة' ? curQty + adjQty : Math.max(0, curQty - adjQty);
  const el = document.getElementById('adj-preview');
  if(el) el.textContent = `الكمية الحالية: ${curQty} → بعد التسوية: ${newQty}`;
}

function saveAdjustment(){
  const sel       = document.getElementById('adj-product');
  const productId = sel?.value;
  const prodName  = sel?.options[sel?.selectedIndex]?.dataset?.name || '';
  if(!productId){ showToast('warning','⚠️ اختر منتجاً'); return; }
  const adjQty = parseInt(document.getElementById('adj-qty')?.value) || 0;
  if(adjQty <= 0){ showToast('warning','⚠️ أدخل كمية صحيحة'); return; }
  const type   = document.getElementById('adj-type')?.value || 'إضافة';
  const reason = document.getElementById('adj-reason')?.value || 'تسوية يدوية';
  const prod   = DB.get('inventory').find(i => i.id === productId);
  if(!prod){ showToast('error','❌ المنتج غير موجود'); return; }
  const newQty    = type === 'إضافة' ? (prod.qty||0) + adjQty : Math.max(0, (prod.qty||0) - adjQty);
  const newStatus = newQty === 0 ? 'نفذ' : newQty <= (prod.reorder||5) ? 'منخفض' : 'متوفر';
  DB.upd('inventory', productId, { qty: newQty, status: newStatus });
  DB.push('inventory_transactions', {
    type: type === 'إضافة' ? 'تسوية+' : 'تسوية-',
    productId, product: prodName,
    qty: adjQty, refType: 'adjustment',
    date: new Date().toISOString().split('T')[0],
    notes: reason
  });
  closeModal('adjustment-modal');
  showToast('success', `✅ تم تسوية مخزون ${prodName}: ${type === 'إضافة' ? '+' : '-'}${adjQty} → المجموع: ${newQty}`);
}

// ══════════════════════════════════════════
// 🛒 بيع منتج مباشر (Product Direct Sale)
// ══════════════════════════════════════════
function openProductSaleModal(productId){
  const items = DB.get('inventory').filter(i => i.qty > 0);
  const sel = document.getElementById('psale-product');
  if(sel){
    sel.innerHTML = '<option value="">-- اختر منتج للبيع --</option>' +
      items.map(i => `<option value="${i.id}" data-name="${i.name}" data-price="${i.price||0}" data-cost="${i.costPrice||i.lastPurchasePrice||0}" data-qty="${i.qty}">${i.name} — سعر: ${i.price||0} ج — متاح: ${i.qty}</option>`).join('');
    if(productId) sel.value = productId;
    updateSalePreview();
  }
  const psaleQtyEl = document.getElementById('psale-qty');
  const psalePatEl = document.getElementById('psale-patient');
  const psaleMethodEl = document.getElementById('psale-method');
  const psaleNotesEl = document.getElementById('psale-notes');
  if(psaleQtyEl) psaleQtyEl.value = 1;
  if(psalePatEl) psalePatEl.value = '';
  if(psaleMethodEl) psaleMethodEl.value = 'كاش';
  if(psaleNotesEl) psaleNotesEl.value = '';
  openModal('product-sale-modal');
}

function updateSalePreview(){
  const sel   = document.getElementById('psale-product');
  const opt   = sel?.options[sel?.selectedIndex];
  const price = parseFloat(opt?.dataset?.price) || 0;
  const cost  = parseFloat(opt?.dataset?.cost)  || 0;
  const qty   = parseInt(document.getElementById('psale-qty')?.value) || 1;
  const total  = price * qty;
  const profit = (price - cost) * qty;
  const el = document.getElementById('psale-preview');
  if(el){
    const profitColor = profit >= 0 ? 'var(--emerald)' : 'var(--rose)';
    el.innerHTML = `الإجمالي: <strong style="color:var(--gold-light)">${total.toLocaleString()} ج</strong> &nbsp;|&nbsp; الربح: <strong style="color:${profitColor}">${profit.toLocaleString()} ج</strong>`;
  }
}

function saveProductSale(){
  const sel       = document.getElementById('psale-product');
  const productId = sel?.value;
  const opt       = sel?.options[sel?.selectedIndex];
  if(!productId){ showToast('warning','⚠️ اختر منتجاً'); return; }
  const prodName  = opt?.dataset?.name || '';
  const price     = parseFloat(opt?.dataset?.price) || 0;
  const cost      = parseFloat(opt?.dataset?.cost)  || 0;
  const available = parseInt(opt?.dataset?.qty)     || 0;
  const qty       = parseInt(document.getElementById('psale-qty')?.value) || 1;
  if(qty <= 0){ showToast('warning','⚠️ الكمية يجب أن تكون أكبر من صفر'); return; }
  if(qty > available){ showToast('error',`❌ الكمية المطلوبة (${qty}) أكبر من المتاح (${available})`); return; }
  const method  = document.getElementById('psale-method')?.value || 'كاش';
  const patName = document.getElementById('psale-patient')?.value || '';
  const notes   = document.getElementById('psale-notes')?.value  || '';
  const total   = price * qty;
  const profit  = (price - cost) * qty;
  const today   = new Date().toISOString().split('T')[0];
  const prod    = DB.get('inventory').find(i => i.id === productId);
  const newQty  = Math.max(0, (prod?.qty||0) - qty);
  DB.upd('inventory', productId, {
    qty: newQty,
    status: newQty === 0 ? 'نفذ' : newQty <= (prod?.reorder||5) ? 'منخفض' : 'متوفر'
  });
  DB.push('inventory_transactions', {
    type: 'صادر', productId, product: prodName,
    qty, unitPrice: price, refType: 'sale',
    date: today, notes: `بيع مباشر${patName ? ' — ' + patName : ''}`
  });
  DB.push('cashlog', {
    type: 'وارد',
    source: `بيع منتج — ${prodName}`,
    amount: total, method,
    date: today,
    notes: `${qty} × ${prodName}${patName ? ' | ' + patName : ''}`,
    refType: 'product_sale'
  });
  DB.push('product_sales', {
    productId, productName: prodName,
    qty, unitPrice: price, unitCost: cost,
    total, profit, method,
    patientName: patName, date: today, notes
  });
  closeModal('product-sale-modal');
  showToast('success', `✅ تم بيع ${qty} × ${prodName} بقيمة ${total.toLocaleString()} ج | ربح: ${profit.toLocaleString()} ج`);
}

// ══════════════════════════════════════════
// 🛒 فاتورة شراء متعددة الأصناف
// ══════════════════════════════════════════
let _purItems = [];

function openMultiPurchaseModal(){
  _purItems = [];
  const sel = document.getElementById('mpur-supplier');
  if(sel){
    const sups = DB.get('suppliers') || [];
    sel.innerHTML = '<option value="">-- اختر مورد --</option>' + sups.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join('');
  }
  fillMpurProducts();
  const today = new Date().toISOString().split('T')[0];
  const mpurIdEl = document.getElementById('mpur-id');
  const mpurDateEl = document.getElementById('mpur-order-date');
  const mpurDeliveryEl = document.getElementById('mpur-delivery-date');
  const mpurStatusEl = document.getElementById('mpur-status');
  const mpurNotesEl = document.getElementById('mpur-notes');
  if(mpurIdEl) mpurIdEl.value = '';
  if(mpurDateEl) mpurDateEl.value = today;
  if(mpurDeliveryEl) mpurDeliveryEl.value = '';
  if(mpurStatusEl) mpurStatusEl.value = 'معلق';
  if(mpurNotesEl) mpurNotesEl.value = '';
  renderPurItems();
  openModal('multi-purchase-modal');
}

function fillMpurProducts(){
  const sel = document.getElementById('mpur-item-product'); if(!sel) return;
  sel.innerHTML = '<option value="">-- اختر منتج --</option>' +
    (DB.get('inventory')||[]).map(i => `<option value="${i.id}">${i.name} — مخزون: ${i.qty}</option>`).join('');
}

function addPurItem(){
  const sel = document.getElementById('mpur-item-product');
  const productId   = sel?.value;
  const productName = sel?.options[sel?.selectedIndex]?.text?.split(' — ')[0] || '';
  const qty         = parseInt(document.getElementById('mpur-item-qty')?.value)   || 0;
  const unitPrice   = parseFloat(document.getElementById('mpur-item-price')?.value) || 0;
  if(!productId){ showToast('warning','⚠️ اختر منتجاً'); return; }
  if(qty <= 0){ showToast('warning','⚠️ الكمية مطلوبة'); return; }
  const existing = _purItems.find(i => i.productId === productId);
  if(existing){ existing.qty += qty; existing.unitPrice = unitPrice; }
  else { _purItems.push({ productId, productName, qty, unitPrice }); }
  const mpurQtyEl = document.getElementById('mpur-item-qty');
  const mpurPriceEl = document.getElementById('mpur-item-price');
  if(mpurQtyEl) mpurQtyEl.value = '';
  if(mpurPriceEl) mpurPriceEl.value = '';
  renderPurItems();
}

function removePurItem(idx){
  _purItems.splice(idx, 1);
  renderPurItems();
}

function renderPurItems(){
  const tb = document.getElementById('mpur-items-tbody'); if(!tb) return;
  if(!_purItems.length){
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:12px">لم تُضَف أصناف بعد</td></tr>';
    txt('mpur-grand-total','0 ج');
    return;
  }
  tb.innerHTML = _purItems.map((item, i) => `<tr>
    <td style="font-weight:600">${item.productName}</td>
    <td style="text-align:center">${item.qty}</td>
    <td>${(item.unitPrice).toLocaleString()} ج</td>
    <td style="font-weight:700;color:var(--gold-light)">${(item.qty*item.unitPrice).toLocaleString()} ج</td>
    <td><button class="btn btn-danger btn-xs" onclick="removePurItem(${i})">🗑</button></td>
  </tr>`).join('');
  const grand = _purItems.reduce((s,i)=>s+i.qty*i.unitPrice,0);
  txt('mpur-grand-total', grand.toLocaleString()+' ج');
}

function saveMultiPurchase(){
  if(!_purItems.length){ showToast('warning','⚠️ أضف صنفاً واحداً على الأقل'); return; }
  const supSel       = document.getElementById('mpur-supplier');
  const supplierId   = supSel?.value || '';
  const supplierName = supSel?.options[supSel?.selectedIndex]?.dataset?.name || '';
  const grandTotal   = _purItems.reduce((s,i)=>s+i.qty*i.unitPrice,0);
  const status       = document.getElementById('mpur-status')?.value || 'معلق';
  const orderDate    = document.getElementById('mpur-order-date')?.value   || new Date().toISOString().split('T')[0];
  const deliveryDate = document.getElementById('mpur-delivery-date')?.value || '';
  const notes        = document.getElementById('mpur-notes')?.value || '';
  const data = {
    supplierId, supplier: supplierName,
    product: _purItems.map(i=>i.productName).join('، '),
    qty: _purItems.reduce((s,i)=>s+i.qty,0),
    unitPrice: 0, total: grandTotal,
    orderDate, deliveryDate, status, notes,
    itemsCount: _purItems.length
  };
  const newPur = DB.push('purchases', data);
  const purchaseId = newPur?.id;
  _purItems.forEach(item => {
    DB.push('purchase_items', { purchaseId, ...item });
  });
  // إذا تم الإنشاء كـ "مستلم"، شغّل hook الاستلام عبر upd (لا يحتوي _inventoryUpdated → سيعمل)
  if(status === 'مستلم'){
    DB.upd('purchases', purchaseId, {
      status: 'مستلم',
      deliveryDate: deliveryDate || orderDate,
      _inventoryUpdated: false
    });
  }
  closeModal('multi-purchase-modal');
  showToast('success', `✅ فاتورة شراء — ${_purItems.length} صنف — ${grandTotal.toLocaleString()} ج`);
  _purItems = [];
}

// ══════════════════════════════════════════
// 📊 تقرير حركة المخزون
// ══════════════════════════════════════════
function renderInventoryTransactions(productId){
  const txs = (DB.get('inventory_transactions')||[])
    .filter(t => !productId || t.productId === productId)
    .sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const tb = document.getElementById('inv-tx-tbody'); if(!tb) return;
  tb.innerHTML = txs.map(t => `<tr>
    <td style="font-size:12px">${t.date||'—'}</td>
    <td style="font-weight:600">${t.product||'—'}</td>
    <td><span class="tag ${t.type.includes('وارد')||t.type.includes('+') ? 'tg-teal' : 'tg-rose'}">${t.type}</span></td>
    <td style="font-weight:700;color:${t.type.includes('وارد')||t.type.includes('+') ? 'var(--emerald)' : 'var(--rose)'}">${t.qty||0}</td>
    <td style="font-size:11px;color:var(--text-muted)">${t.refType||'—'}</td>
    <td style="font-size:11px;color:var(--text-muted)">${t.notes||'—'}</td>
  </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:16px">لا توجد حركات</td></tr>';
}

// حساب ربح المنتج
function calcProductProfit(productId){
  const prod = DB.get('inventory').find(i => i.id === productId);
  if(!prod) return 0;
  const cost  = prod.lastPurchasePrice || prod.costPrice || 0;
  const price = prod.price || 0;
  return price - cost;
}
