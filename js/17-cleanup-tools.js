// ══════════════════════════════════════════════════════════
// 🧹 أداة تنظيف عميل اختبار بالكامل — من واجهة الإعدادات مباشرة
// (بديل عن لصق كود في Console، عشان تشتغل من الموبايل بسهولة)
// حذف حقيقي (DB.del) ومتزامن مع Firestore — غير قابل للتراجع.
// ══════════════════════════════════════════════════════════
function cleanupTestPatientUI(){
  const name = (document.getElementById('cleanup-pat-name')?.value || '').trim();
  if(!name){ showToast('error','❌ اكتب اسم العميل الأول'); return; }
  _runPatientCleanup(name);
}

async function _runPatientCleanup(patientName){
  const patients = DB.get('patients') || [];
  const targets = patients.filter(p => (p.name||'').trim() === patientName.trim());
  if(targets.length === 0){ showToast('error', `❌ مفيش عميل بالاسم: ${patientName}`); return; }

  const patIds = targets.map(p => String(p.id));

  const packages = (DB.get('packages')||[]).filter(pk => patIds.includes(String(pk.patId)));
  const pkgIds = packages.map(pk => String(pk.id));

  const invoices = (DB.get('invoices')||[]).filter(inv =>
    patIds.includes(String(inv.patId)) || pkgIds.includes(String(inv.pkgId))
  );
  const invIds = invoices.map(i => String(i.id));

  const installments = (DB.get('installments')||[]).filter(pl =>
    patIds.includes(String(pl.patientId)) ||
    invIds.includes(String(pl.fromInvId)) ||
    pkgIds.includes(String(pl.fromPkgId))
  );
  const instIds = installments.map(i => String(i.id));

  const appts = (DB.get('appointments')||[]).filter(a => patIds.includes(String(a.patId)));
  const sessions = (DB.get('sessions')||[]).filter(s => patIds.includes(String(s.patId)));

  const journal = (DB.get('journal_entries')||[]).filter(e =>
    (e.sourceType==='invoice'             && invIds.includes(String(e.sourceId))) ||
    (e.sourceType==='package'             && pkgIds.includes(String(e.sourceId))) ||
    (e.sourceType==='installment'         && instIds.includes(String(e.sourceId))) ||
    (e.sourceType==='package_settlement'  && pkgIds.includes(String(e.sourceId)))
  );
  const journalIds = journal.map(e => String(e.id));

  const vouchers = (DB.get('vouchers')||[]).filter(v => journalIds.includes(String(v.linkedEntryId)));

  const cashlog = (DB.get('cashlog')||[]).filter(c =>
    patIds.includes(String(c.patId)) ||
    invIds.includes(String(c.refId)) ||
    instIds.includes(String(c.refId)) ||
    (typeof c.patient === 'string' && c.patient.trim() === patientName.trim())
  );

  const photos = (DB.get('photos')||[]).filter(p => patIds.includes(String(p.patId)));

  const plan = {
    patients: targets, packages, invoices, installments,
    appointments: appts, sessions, journal_entries: journal,
    vouchers, cashlog, photos
  };

  // ── عرض ملخص العدد في مودال بسيط قبل التأكيد ──
  const rows = Object.entries(plan)
    .map(([k, v]) => `<tr><td style="padding:4px 8px;">${k}</td><td style="padding:4px 8px;text-align:center;font-weight:700;">${v.length}</td></tr>`)
    .join('');
  const totalCount = Object.values(plan).reduce((s, v) => s + v.length, 0);

  const ok = confirm(
    `هيتم حذف ${totalCount} سجل نهائيًا للعميل "${patientName}" (المريض نفسه + كل الفواتير/الباقات/الأقساط/القيود/السندات/الخزينة/الصور المرتبطة). الإجراء غير قابل للتراجع. متأكد؟`
  );
  if(!ok) return;

  let deleted = 0;
  for(const [collection, records] of Object.entries(plan)){
    for(const r of records){ DB.del(collection, r.id); deleted++; }
  }

  showToast('success', `✅ تم حذف ${deleted} سجل مرتبط بـ "${patientName}"`);
  console.table(Object.entries(plan).map(([k,v]) => ({collection:k, count:v.length})));
}
