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
// يقرأ linkedProductId وconsumeQty من جدول services مباشرةً
// ══════════════════════════════════════════
function deductInventory(serviceId, qty){
  if(!serviceId) return;
  const svc = DB.get('services').find(s => s.id === serviceId);
  if(!svc || !svc.linkedProductId) return;
  const consumeQty = (svc.consumeQty || 1) * (qty || 1);
  const inv  = DB.get('inventory');
  const item = inv.find(i => i.id === svc.linkedProductId);
  if(!item) return;
  const newQty    = Math.max(0, item.qty - consumeQty);
  const newStatus = newQty === 0 ? 'نفذ' : newQty <= item.reorder ? 'منخفض' : 'متوفر';
  // DB.upd يُطلق inventory:updated → EventBus → renderInv تلقائياً
  DB.upd('inventory', item.id, { qty: newQty, status: newStatus });
  if(newQty <= item.reorder){
    showToast('warning', `⚠️ مخزون منخفض: ${item.name}`, `متبقي ${newQty} وحدة`);
  }
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
  txt('sup-kpi-total', all.length);
  txt('sup-kpi-owed', all.reduce((s,x) => s+(x.owed||0), 0).toLocaleString()+' ج');
  txt('sup-kpi-orders', (DB.get('purchases')||[]).filter(p => p.status !== 'ملغي').length);
  txt('sup-count-lbl', sups.length+' مورد');

  const tb = document.getElementById('sup-tbody'); if(!tb) return;
  tb.innerHTML = sups.map(s => `<tr>
    <td style="font-weight:700">${s.name}</td>
    <td><span class="tag tg-purple">${s.cat||'—'}</span></td>
    <td style="font-size:12px">${s.phone||'—'}</td>
    <td style="font-size:11px;color:var(--text-muted)">${s.email||'—'}</td>
    <td style="font-size:12px">${s.terms||'—'}</td>
    <td style="color:${(s.owed||0)>0?'var(--rose)':'var(--emerald)'};font-weight:700">${(s.owed||0).toLocaleString()} ج</td>
    <td><span class="ast ${s.status==='نشط'?'sc':'sd'}">${s.status}</span></td>
    <td style="display:flex;gap:5px;">
      <button class="btn btn-ghost btn-xs" onclick="openSupplierModal('${s.id}')">✏️</button>
      <button class="btn btn-danger btn-xs" onclick="delSupplier('${s.id}')">🗑</button>
    </td>
  </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">لا يوجد موردون</td></tr>';
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
  if(confirm(`حذف ${s?.name}؟`)){ DB.del('suppliers', id); showToast('info','🗑 تم الحذف'); }
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
    _owedUpdated: false
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
