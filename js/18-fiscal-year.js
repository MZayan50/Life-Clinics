// ══════════════════════════════════════════
// 📆 FISCAL YEAR MANAGEMENT — إقفال السنة المالية
// المرحلة 12 من دليل تطوير الطبقة المحاسبية
// يتحمّل بعد 17-cleanup-tools.js في index.html
// ⚠️ إضافة صرفة — لا تلمس saveExp/saveInvoice/renderAccounts.
//    بتستخدم فقط الدوال الموجودة بالفعل: calcTrialBalance()، postJournalEntry()،
//    reverseJournalEntry()، isPeriodLocked() (من 16-periods.js).
//
// ملاحظة تصحيح على مثال الدليل الأصلي (قسم "المرحلة 12"):
// الكود المقترح هناك كان بيعمل postJournalEntry بسطر واحد فقط (طرف واحد: 3200)
// وده كان هيترفض تلقائيًا من فحص التوازن في postJournalEntry (لازم Σdebit = Σcredit).
// قيد الإقفال الصحيح محاسبيًا لازم "يصفّر" كل حساب إيراد ومصروف فعليًا (مدين
// للإيرادات ودائن للمصروفات بقيمة رصيد كل حساب)، والفرق (صافي الربح/الخسارة)
// هو اللي يترحّل لحساب "أرباح مرحّلة" 3200 — وده اللي بينفّذه الكود تحت.
// ══════════════════════════════════════════

// ── قراءة شهر بداية السنة المالية من الإعدادات (1 = يناير افتراضيًا) ──
function getFiscalYearStartMonth(){
  const m = parseInt((DB.get('settings')||{}).fiscalYearStartMonth, 10);
  return (m>=1 && m<=12) ? m : 1;
}

// ── حدود السنة المالية اللي بتبدأ في شهر/سنة startYear ──
// بترجع {label, startDate, endDate}. لو شهر البداية يناير، السنة المالية = سنة ميلادية عادية.
function fiscalYearBounds(startYear){
  const startMonth = getFiscalYearStartMonth();
  const pad = n => String(n).padStart(2,'0');
  const startDate = `${startYear}-${pad(startMonth)}-01`;
  const endYear  = (startMonth===1) ? startYear : startYear+1;
  const endMonth = (startMonth===1) ? 12 : startMonth-1;
  const endDay   = (typeof _lastDayOfMonth==='function') ? _lastDayOfMonth(endYear, endMonth) : new Date(endYear, endMonth, 0).getDate();
  const endDate  = `${endYear}-${pad(endMonth)}-${pad(endDay)}`;
  return { label: 'FY' + startYear, startYear, startDate, endDate, endPeriod: `${endYear}-${pad(endMonth)}` };
}

// ── تحديد السنة المالية "الحالية" اعتمادًا على تاريخ اليوم وشهر البداية ──
function currentFiscalYearStartYear(){
  const now = new Date();
  const startMonth = getFiscalYearStartMonth();
  const y = now.getFullYear(), m = now.getMonth()+1; // m: 1-12
  // لو الشهر الحالي قبل شهر بداية السنة المالية، يبقى لسه في السنة المالية اللي بدأت في السنة اللي فاتت
  return (m >= startMonth) ? y : y-1;
}

// ── إقفال سنة مالية (قيد إقفال بيصفّر الإيرادات/المصروفات ويرحّل الصافي لـ 3200) ──
async function runYearEndClosing(startYear){
  startYear = parseInt(startYear, 10);
  if(!startYear || startYear < 2000 || startYear > 2100){
    showToast('error','❌ سنة بداية غير صحيحة');
    return null;
  }

  const fy = fiscalYearBounds(startYear);
  const existing = (DB.get('fiscal_years')||[]).find(f=>f.id===fy.label);
  if(existing?.status==='closed'){
    showToast('info', `ℹ️ السنة المالية ${fy.label} مقفولة بالفعل`);
    return existing;
  }

  // ✅ لازم آخر شهر في السنة المالية يكون مقفول أولاً (من المرحلة 8) — ضمان إضافي
  // إن مفيش قيود متأخرة (late entries) ممكن تدخل على فترة اتحسب إقفالها فعلاً
  if(typeof isPeriodLocked==='function' && !isPeriodLocked(fy.endDate)){
    showToast('warning', `⚠️ لازم تقفل فترة ${fy.endPeriod} أولاً (من "إغلاق الفترات المحاسبية" فوق) قبل إقفال السنة المالية`);
    return null;
  }

  // ✅ فحص التوازن حتى آخر يوم في السنة المالية
  const tb = calcTrialBalance(fy.endDate);
  if(!tb.isBalanced){
    showToast('error', `❌ الميزان غير متوازن حتى ${fy.endDate} — لا يمكن إقفال السنة المالية (راجع المطور)`);
    return null;
  }

  const revenueRows = tb.rows.filter(r=>r.type==='revenue' && Math.abs(r.balance)>0.01);
  const expenseRows = tb.rows.filter(r=>r.type==='expense' && Math.abs(r.balance)>0.01);
  const totalRevenue = revenueRows.reduce((s,r)=>s+r.balance,0);
  const totalExpense = expenseRows.reduce((s,r)=>s+r.balance,0);
  const netIncome = totalRevenue - totalExpense;

  let closingEntry = null;

  if(revenueRows.length || expenseRows.length){
    // 🧾 قيد الإقفال: تصفير كل حساب إيراد (مدين بقيمة رصيده) وكل حساب مصروف
    // (دائن بقيمة رصيده)، والفرق (صافي الربح/الخسارة) على حساب 3200
    const lines = [];
    revenueRows.forEach(r=>lines.push({accountCode:r.code, debit:r.balance, credit:0, description:`إقفال ${r.name} — نهاية ${fy.label}`}));
    expenseRows.forEach(r=>lines.push({accountCode:r.code, debit:0, credit:r.balance, description:`إقفال ${r.name} — نهاية ${fy.label}`}));

    if(netIncome >= 0){
      lines.push({accountCode:'3200', debit:0, credit:netIncome, description:`صافي ربح ${fy.label} مرحّل لأرباح مرحّلة`});
    } else {
      lines.push({accountCode:'3200', debit:-netIncome, credit:0, description:`صافي خسارة ${fy.label} مرحّلة من أرباح مرحّلة`});
    }

    // ⚠️ ملاحظة تقنية: القيد ده تاريخه = آخر يوم في السنة المالية، وهي فترة
    // مقفولة بالفعل (تحقّقنا فوق) — postJournalEntry هيرفضه لو مرّ على isPeriodLocked
    // العادي. لذلك بنستخدم علم sourceType='year_end_closing' اللي isPeriodLocked
    // (في 16-periods.js) بيتجاهله عمدًا فقط لقيود الإقفال السنوي/الشهري الرسمية.
    closingEntry = await postJournalEntry({
      date: fy.endDate,
      description: `قيد إقفال السنة المالية ${fy.label} (${fy.startDate} → ${fy.endDate}) — صافي ${netIncome>=0?'ربح':'خسارة'} ${Math.abs(netIncome).toLocaleString()} ج`,
      sourceType: 'year_end_closing',
      sourceId: fy.label,
      lines
    });

    if(!closingEntry){
      showToast('error','❌ فشل تسجيل قيد الإقفال — راجع Console');
      return null;
    }
  }

  const u = _currentUser();
  const saved = existing
    ? DB.upd('fiscal_years', existing.id, {status:'closed', netIncome, closingEntryId: closingEntry?.id||null, closedBy:u, closedAt:_now()})
    : DB.push('fiscal_years', {id:fy.label, startYear:fy.startYear, startDate:fy.startDate, endDate:fy.endDate,
        status:'closed', netIncome, closingEntryId: closingEntry?.id||null, closedBy:u, closedAt:_now()});

  showToast('success', `✅ تم إقفال السنة المالية ${fy.label} — صافي ${netIncome>=0?'ربح':'خسارة'} ${Math.abs(netIncome).toLocaleString()} ج مرحّل لحساب 3200`);
  if(typeof renderFiscalYears==='function') renderFiscalYears();
  return saved;
}

// ── إعادة فتح سنة مالية مقفولة (تعكس قيد الإقفال بدل حذفه — نفس فلسفة المرحلة 9) ──
async function reopenFiscalYear(label){
  const existing = (DB.get('fiscal_years')||[]).find(f=>f.id===label);
  if(!existing || existing.status!=='closed'){
    showToast('warning','⚠️ السنة المالية مش مقفولة أصلاً');
    return null;
  }
  if(!confirm(`فتح السنة المالية ${label} تاني هيعكس قيد الإقفال (لو موجود) ويرجّع أرصدة الإيرادات/المصروفات زي ما كانت. متأكد؟`)) return null;

  if(existing.closingEntryId && typeof reverseJournalEntry==='function'){
    await reverseJournalEntry(existing.closingEntryId, `فتح السنة المالية ${label} بواسطة ${_currentUser()}`);
  }
  const saved = DB.upd('fiscal_years', existing.id, {status:'open', reopenedBy:_currentUser(), reopenedAt:_now()});
  showToast('success', `🔓 تم فتح السنة المالية ${label}`);
  if(typeof renderFiscalYears==='function') renderFiscalYears();
  return saved;
}

// ── زرار "إقفال السنة المالية الحالية" ──
async function closeCurrentFiscalYearUI(){
  const startYear = currentFiscalYearStartYear();
  const fy = fiscalYearBounds(startYear);
  if(!confirm(`إقفال السنة المالية ${fy.label} (${fy.startDate} → ${fy.endDate})؟ هيترحّل صافي الربح/الخسارة لحساب "أرباح مرحّلة" ولن يمكن إضافة قيود جديدة بتاريخ داخل هذه السنة بعدها.`)) return;
  await runYearEndClosing(startYear);
}

// ── إقفال سنة مالية مُختارة يدويًا من حقل input[type=number] ──
async function closeSelectedFiscalYearUI(){
  const el = document.getElementById('fy-select-input');
  const startYear = parseInt(el?.value, 10);
  if(!startYear){ showToast('warning','⚠️ اكتب سنة البداية أولاً'); return; }
  const fy = fiscalYearBounds(startYear);
  if(!confirm(`إقفال السنة المالية ${fy.label} (${fy.startDate} → ${fy.endDate})؟`)) return;
  await runYearEndClosing(startYear);
}

// ── عرض جدول السنوات المالية في شاشة الإعدادات ──
function renderFiscalYears(){
  const tb = document.getElementById('fy-tbody');
  if(!tb) return;

  const years = [...(DB.get('fiscal_years')||[])].sort((a,b)=>String(b.id).localeCompare(String(a.id)));

  tb.innerHTML = years.map(f=>{
    const fy = fiscalYearBounds(f.startYear);
    const statusTag = f.status==='closed'
      ? `<span class="tag tg-rose">🔒 مقفولة</span>`
      : `<span class="tag tg-teal">🔓 مفتوحة</span>`;
    const actionBtn = f.status==='closed'
      ? `<button class="btn btn-ghost btn-sm" onclick="reopenFiscalYear('${f.id}')">فتح</button>`
      : `<button class="btn btn-primary btn-sm" onclick="runYearEndClosing(${f.startYear})">إقفال</button>`;
    const meta = f.status==='closed'
      ? `${escapeHtml(f.closedBy)||'—'} · ${f.closedAt ? new Date(f.closedAt).toLocaleString('ar-EG') : '—'}`
      : '—';
    const netColor = (f.netIncome||0)>=0 ? 'var(--emerald)' : 'var(--rose)';
    const netTxt = f.netIncome!==undefined ? `${(f.netIncome>=0?'+':'')}${f.netIncome.toLocaleString()} ج` : '—';
    return `<tr>
      <td style="font-weight:700;font-family:monospace">${f.id}</td>
      <td style="font-size:11.5px;color:var(--text-muted)">${fy.startDate} → ${fy.endDate}</td>
      <td>${statusTag}</td>
      <td style="font-weight:700;color:${netColor}">${netTxt}</td>
      <td style="font-size:11.5px;color:var(--text-muted)">${meta}</td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">لا توجد سنوات مالية مقفولة بعد</td></tr>`;
}

// ── إعادة الرسم تلقائيًا مع أي تغيير على fiscal_years ──
EventBus.on('db:changed', (e)=>{
  if(e && e.collection==='fiscal_years'){
    if(typeof renderFiscalYears==='function') renderFiscalYears();
  }
});
