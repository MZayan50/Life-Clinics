/**
 * 📋 Enhanced Supplier Statement Module
 * Professional modern design matching invoice template
 * Includes: Summary KPIs, Detailed Purchases, Payment History, Professional Print/PDF
 */

// ═══════════════════════════════════════════════════════════════════════════
// Build Professional Supplier Statement HTML
// ═══════════════════════════════════════════════════════════════════════════
function buildSupplierStatementHTML(supplier, purchases, payments) {
  if (!supplier) return '';

  // 🛡️ لتضمين نص جوه <script>...</script> بأمان (اسم/تليفون المورد بيتحطوا
  // كـ JS string literal مباشرة هناك). escapeHtml العادي مش مناسب هنا لأن
  // المتصفح ما بيفكش تشفير HTML entities جوه محتوى <script> — فالتهريب
  // اللازم هنا هو تهريب JS نفسه (backslash + quote) + قطع أي "</script>".
  const _jsStr = (str) => String(str||'')
    .replace(/\\/g,'\\\\')
    .replace(/'/g,"\\'")
    .replace(/<\/script/gi,'<\\/script')
    .replace(/\r?\n/g,'\\n');
  
  const clinicName = DB.obj('settings')?.clinicName || 'عيادات الحياة للتجميل';
  const clinicPhone = DB.obj('settings')?.phone || '';
  const today = new Date().toLocaleDateString('ar-EG');
  
  // Calculate financial summary
  const totalPurchases = purchases.filter(p => p.status === 'مستلم').reduce((sum, p) => sum + (p.total || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const balance = Math.max(0, totalPurchases - totalPaid);
  const unpaidCount = purchases.filter(p => p.status === 'مستلم').length;
  
  // Generate rows for purchases table
  const purchasesRows = purchases
    .filter(p => p.status === 'مستلم')
    .sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0))
    .map((p, i) => {
      const itemTotal = p.total || 0;
      const statusColor = p.status === 'مستلم' ? '#10b981' : '#f59e0b';
      return `
        <tr>
          <td style="text-align:center;width:8%">${i + 1}</td>
          <td style="text-align:right;width:15%">${escapeHtml(p.orderDate) || '—'}</td>
          <td style="text-align:right;width:35%">${escapeHtml(p.product) || '—'}</td>
          <td style="text-align:center;width:12%">${(p.qty || 0).toLocaleString('ar-EG')}</td>
          <td style="text-align:center;width:15%">${(p.unitPrice || 0).toLocaleString('ar-EG')} ج</td>
          <td style="text-align:center;width:15%"><strong>${itemTotal.toLocaleString('ar-EG')} ج</strong></td>
        </tr>
      `;
    })
    .join('');

  // Generate rows for payments table
  const paymentsRows = payments
    .sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0))
    .map((p, i) => {
      const method = escapeHtml({
        'كاش': '💵 كاش',
        'تحويل بنكي': '🏦 تحويل بنكي',
        'شيك': '📋 شيك',
        'كارت ائتماني': '💳 كارت ائتماني',
        'تحويل محفظة': '📱 محفظة رقمية'
      }[p.paymentMethod || 'كاش'] || p.paymentMethod || '—');

      return `
        <tr>
          <td style="text-align:center;width:8%">${i + 1}</td>
          <td style="text-align:right;width:20%">${escapeHtml(p.paymentDate) || '—'}</td>
          <td style="text-align:center;width:20%">${method}</td>
          <td style="text-align:center;width:20%"><strong style="color:#10b981">${(p.amount || 0).toLocaleString('ar-EG')} ج</strong></td>
          <td style="text-align:right;width:32%">${escapeHtml(p.notes) || '—'}</td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>كشف حساب ${escapeHtml(supplier.name)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      width: 100%;
      height: 100%;
    }
    
    body {
      font-family: 'Tajawal', sans-serif;
      background: #f8f9fa;
      color: #1a1a1a;
      font-size: 14px;
      line-height: 1.6;
      padding: 30px;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    
    /* ────── HEADER ────── */
    .header {
      background: linear-gradient(135deg, #C4A882 0%, #D4B896 100%);
      color: #fff;
      padding: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 4px solid #B89968;
    }
    
    .header-left h1 {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 8px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .header-left p {
      font-size: 13px;
      opacity: 0.95;
      margin: 4px 0;
    }
    
    .header-right {
      text-align: left;
    }
    
    .stmt-number {
      font-size: 32px;
      font-weight: 800;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 6px;
    }
    
    .stmt-date {
      font-size: 13px;
      opacity: 0.95;
    }
    
    /* ────── MAIN CONTENT ────── */
    .content {
      padding: 30px;
    }
    
    /* ────── SUPPLIER INFO SECTION ────── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 25px;
      margin-bottom: 30px;
      padding-bottom: 25px;
      border-bottom: 2px solid #f0f0f0;
    }
    
    .info-block {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 10px;
      border-left: 4px solid #C4A882;
    }
    
    .info-label {
      font-size: 11px;
      font-weight: 700;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    
    .info-value {
      font-size: 15px;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .info-sub {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }
    
    /* ────── KPI CARDS SECTION ────── */
    .kpi-section {
      margin-bottom: 30px;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 2px solid #C4A882;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .kpi-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .kpi-card {
      background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      padding: 18px;
      text-align: center;
      transition: all 0.3s ease;
      border-top: 4px solid #C4A882;
    }
    
    .kpi-card:hover {
      box-shadow: 0 4px 16px rgba(196, 168, 130, 0.15);
      transform: translateY(-2px);
    }
    
    .kpi-icon {
      font-size: 28px;
      margin-bottom: 8px;
    }
    
    .kpi-value {
      font-size: 24px;
      font-weight: 800;
      color: #C4A882;
      margin-bottom: 4px;
    }
    
    .kpi-label {
      font-size: 12px;
      color: #666;
      font-weight: 600;
    }
    
    .kpi-card.balance .kpi-value {
      color: ${balance > 0 ? '#dc2626' : '#10b981'};
    }
    
    /* ────── TABLES ────── */
    .table-section {
      margin-bottom: 30px;
    }
    
    .table-wrapper {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    
    thead {
      background: linear-gradient(135deg, #f8f9fa 0%, #f0f0f0 100%);
      border-bottom: 2px solid #C4A882;
    }
    
    th {
      padding: 12px 14px;
      text-align: right;
      font-weight: 700;
      color: #333;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    tbody tr {
      border-bottom: 1px solid #f0f0f0;
      transition: background-color 0.2s ease;
    }
    
    tbody tr:hover {
      background-color: #f8f9fa;
    }
    
    tbody tr:last-child {
      border-bottom: none;
    }
    
    td {
      padding: 12px 14px;
      color: #333;
    }
    
    /* ────── SUMMARY SECTION ────── */
    .summary-box {
      background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 30px;
    }
    
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;
      font-size: 14px;
    }
    
    .summary-row:last-child {
      border-bottom: none;
    }
    
    .summary-label {
      color: #666;
      font-weight: 500;
    }
    
    .summary-value {
      font-weight: 700;
      color: #1a1a1a;
    }
    
    .summary-row.final {
      border-top: 2px solid #C4A882;
      padding-top: 12px;
      margin-top: 8px;
      font-size: 16px;
      color: #C4A882;
    }
    
    .summary-row.final .summary-value {
      color: #C4A882;
      font-size: 20px;
    }
    
    /* ────── FOOTER ────── */
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #e0e0e0;
      font-size: 12px;
      color: #999;
    }
    
    .footer p {
      margin: 4px 0;
    }
    
    /* ────── EMPTY STATE ────── */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #999;
      font-size: 14px;
    }
    
    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }
    
    /* ────── TOOLBAR (for print window) ────── */
    #stmt-toolbar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #fff;
      border-top: 2px solid #C4A882;
      padding: 12px 20px;
      display: flex;
      gap: 10px;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      font-family: 'Tajawal', sans-serif;
      box-shadow: 0 -2px 12px rgba(0,0,0,0.08);
    }
    
    #stmt-toolbar button {
      padding: 9px 22px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: 'Tajawal', sans-serif;
      transition: all 0.3s ease;
    }
    
    #stmt-toolbar button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .btn-download {
      background: #1a6dcc;
      color: #fff;
    }
    
    .btn-whatsapp {
      background: #25D366;
      color: #fff;
    }
    
    .btn-print {
      background: #C4A882;
      color: #fff;
    }
    
    .btn-close {
      background: #eee;
      color: #333;
    }
    
    /* ────── PRINT STYLES ────── */
    @media print {
      body {
        padding: 0;
        background: #fff;
      }
      
      .container {
        box-shadow: none;
        border-radius: 0;
      }
      
      #stmt-toolbar {
        display: none !important;
      }
      
      * {
        box-shadow: none !important;
      }
    }
    
    /* ────── RESPONSIVE ────── */
    @media (max-width: 768px) {
      body {
        padding: 15px;
      }
      
      .content {
        padding: 20px;
      }
      
      .header {
        flex-direction: column;
        text-align: center;
        padding: 20px;
      }
      
      .header-right {
        text-align: center;
        margin-top: 15px;
      }
      
      .info-grid {
        grid-template-columns: 1fr;
        gap: 15px;
      }
      
      .kpi-cards {
        gap: 8px;
      }
      
      .kpi-card {
        padding: 10px 6px;
      }
      
      .kpi-icon {
        font-size: 18px;
        margin-bottom: 4px;
      }
      
      .kpi-value {
        font-size: 15px;
      }
      
      .kpi-label {
        font-size: 9px;
      }
      
      table {
        font-size: 12px;
      }
      
      th, td {
        padding: 8px 10px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- HEADER -->
    <div class="header">
      <div class="header-left">
        <h1>📋 كشف حساب ${escapeHtml(supplier.name)}</h1>
        <p style="font-weight:600">${escapeHtml(clinicName)}</p>
        <p>📞 ${escapeHtml(clinicPhone)}</p>
      </div>
      <div class="header-right">
        <div class="stmt-number">#${supplier.id.substring(0, 8).toUpperCase()}</div>
        <div class="stmt-date">📅 ${today}</div>
      </div>
    </div>
    
    <!-- MAIN CONTENT -->
    <div class="content">
      <!-- KPI CARDS SECTION -->
      <div class="kpi-section">
        <div class="section-title">📊 ملخص حساب المورد</div>
        <div class="kpi-cards">
          <div class="kpi-card">
            <div class="kpi-icon">🧾</div>
            <div class="kpi-value">${totalPurchases.toLocaleString('ar-EG')}</div>
            <div class="kpi-label">إجمالي المشتريات (ج)</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">💳</div>
            <div class="kpi-value">${totalPaid.toLocaleString('ar-EG')}</div>
            <div class="kpi-label">إجمالي المدفوعات (ج)</div>
          </div>
          <div class="kpi-card balance">
            <div class="kpi-icon">${balance > 0 ? '⚠️' : '✅'}</div>
            <div class="kpi-value">${balance.toLocaleString('ar-EG')}</div>
            <div class="kpi-label">${balance > 0 ? 'المتبقي عليك' : 'مصفاة الحساب'}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon">📦</div>
            <div class="kpi-value">${unpaidCount}</div>
            <div class="kpi-label">عدد الفواتير المستلمة</div>
          </div>
        </div>
      </div>
      
      <!-- PURCHASES SECTION -->
      <div class="table-section">
        <div class="section-title">📦 تفصيل المشتريات</div>
        <div class="table-wrapper">
          ${purchases.filter(p => p.status === 'مستلم').length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>التاريخ</th>
                  <th>المنتج / الصنف</th>
                  <th>الكمية</th>
                  <th>سعر الوحدة</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                ${purchasesRows}
              </tbody>
            </table>
          ` : `
            <div class="empty-state">
              <div class="empty-state-icon">📭</div>
              <div>لا توجد مشتريات مستلمة حالياً</div>
            </div>
          `}
        </div>
      </div>
      
      <!-- PAYMENTS SECTION -->
      <div class="table-section">
        <div class="section-title">💰 سجل الدفعات</div>
        <div class="table-wrapper">
          ${payments.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>تاريخ الدفع</th>
                  <th>طريقة الدفع</th>
                  <th>المبلغ</th>
                  <th>الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                ${paymentsRows}
              </tbody>
            </table>
          ` : `
            <div class="empty-state">
              <div class="empty-state-icon">💸</div>
              <div>لم يتم تسجيل أي دفعات بعد</div>
            </div>
          `}
        </div>
      </div>
      
      <!-- FINANCIAL SUMMARY -->
      <div class="summary-box">
        <div class="summary-row">
          <span class="summary-label">إجمالي المشتريات:</span>
          <span class="summary-value">${totalPurchases.toLocaleString('ar-EG')} ج</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">إجمالي المدفوعات:</span>
          <span class="summary-value" style="color:#10b981">${totalPaid.toLocaleString('ar-EG')} ج</span>
        </div>
        <div class="summary-row final">
          <span class="summary-label">${balance > 0 ? 'الرصيد المستحق:' : 'الرصيد:'}</span>
          <span class="summary-value">${balance.toLocaleString('ar-EG')} ج</span>
        </div>
      </div>
    </div>
    
    <!-- FOOTER -->
    <div class="footer">
      <p>✅ هذا الكشف صادر إلكترونياً من نظام إدارة العيادة</p>
      <p>📅 ${today} | شكراً لثقتكم بـ ${escapeHtml(clinicName)}</p>
    </div>
  </div>
  
  <!-- TOOLBAR FOR PRINT WINDOW -->
  <div id="stmt-toolbar">
    <button class="btn-download" onclick="downloadStatementPDF()">📄 تحميل PDF</button>
    <button class="btn-whatsapp" onclick="shareStatementViaWhatsApp()">💬 مشاركة واتس</button>
    <button class="btn-print" onclick="window.print()">🖨 طباعة</button>
    <button class="btn-close" onclick="window.close()">✕ إغلاق</button>
  </div>
  
  <!-- HTML2PDF LIBRARY -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
  
  <script>
    // Shared: build the PDF as a Blob (used by both download + WhatsApp share)
    // foreignObjectRendering:true delegates text layout to the browser itself
    // instead of html2canvas's own text engine — this is what fixes broken/
    // reversed Arabic letters (RTL shaping) in the exported PDF.
    function generateStatementPdfBlob() {
      const filename = 'كشف-حساب-${_jsStr(supplier.name)}-${Date.now()}.pdf';
      return html2pdf()
        .set({
          margin: 10,
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, foreignObjectRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(document.body)
        .toPdf()
        .output('blob')
        .then(blob => ({ blob, filename }));
    }

    // Download as PDF
    function downloadStatementPDF() {
      const btn = document.querySelector('.btn-download');
      const originalText = btn.textContent;
      btn.textContent = '⏳ جارٍ التحميل...';
      btn.disabled = true;

      const toolbar = document.getElementById('stmt-toolbar');
      toolbar.style.display = 'none';

      generateStatementPdfBlob()
        .then(({ blob, filename }) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        })
        .catch(err => {
          console.error(err);
          alert('⚠️ حدث خطأ أثناء إنشاء PDF');
        })
        .finally(() => {
          toolbar.style.display = 'flex';
          btn.textContent = originalText;
          btn.disabled = false;
        });
    }

    // Share the actual PDF file directly through WhatsApp (or any share target)
    // via the native share sheet. Falls back to a plain wa.me text link + PDF
    // download when the browser/device doesn't support file sharing.
    function shareStatementViaWhatsApp() {
      const supplierName = '${_jsStr(supplier.name)}';
      const phone = '${_jsStr(supplier.phone)}'.replace(/[^0-9+]/g, '') || '';
      const msg = 'السلام عليكم\\nإليك كشف حساب المشتريات الخاص بك\\nللمزيد من المعلومات برجاء الاتصال بنا';

      const btn = document.querySelector('.btn-whatsapp');
      const originalText = btn.textContent;
      btn.textContent = '⏳ جارٍ التجهيز...';
      btn.disabled = true;

      const toolbar = document.getElementById('stmt-toolbar');
      toolbar.style.display = 'none';

      generateStatementPdfBlob()
        .then(({ blob, filename }) => {
          const file = new File([blob], filename, { type: 'application/pdf' });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            // Opens the native share sheet — user taps WhatsApp and the PDF
            // goes as a real attachment, not just a text link.
            return navigator.share({
              files: [file],
              title: 'كشف حساب ' + supplierName,
              text: msg
            });
          }

          // Fallback (desktop / unsupported browsers): download the PDF and
          // open a WhatsApp chat with the message pre-filled, so the user can
          // attach the downloaded file manually.
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);

          if (phone && phone.length > 5) {
            window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg + '\\n(مرفق: ' + filename + ')'), '_blank');
          } else {
            window.open('https://wa.me/?text=' + encodeURIComponent(msg + '\\n(مرفق: ' + filename + ')'), '_blank');
          }
          alert('📎 تم تحميل الـ PDF — من فضلك أرفقه يدويًا في محادثة الواتس التي فُتحت');
        })
        .catch(err => {
          if (err && err.name === 'AbortError') return; // user cancelled share sheet
          console.error(err);
          alert('⚠️ حدث خطأ أثناء تجهيز الملف للمشاركة');
        })
        .finally(() => {
          toolbar.style.display = 'flex';
          btn.textContent = originalText;
          btn.disabled = false;
        });
    }
  <\/script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Print Supplier Statement with Professional Template
// ═══════════════════════════════════════════════════════════════════════════
function printSupplierStatementEnhanced() {
  const supId = document.getElementById('stmt-id')?.value;
  const sup = DB.get('suppliers')?.find(s => s.id === supId);
  if (!sup) {
    showToast('error', '❌ المورد غير موجود');
    return;
  }

  const purchases = (DB.get('purchases') || []).filter(p => p.supplierId === supId);
  const payments = (DB.get('supplier_payments') || []).filter(sp => sp.supplierId === supId);

  const html = buildSupplierStatementHTML(sup, purchases, payments);
  
  const printWindow = window.open('', '_blank', 'width=900,height=750,scrollbars=yes');
  if (!printWindow) {
    showToast('error', '❌ السماح بفتح النوافذ المنبثقة مطلوب');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  
  showToast('success', '✅ تم فتح الكشف - يمكنك الآن طباعة أو حفظه');
}

// ═══════════════════════════════════════════════════════════════════════════
// Download Statement as PDF
// ═══════════════════════════════════════════════════════════════════════════
function downloadStatementAsPDFEnhanced() {
  printSupplierStatementEnhanced();
}

// Replace old functions with new ones
window.printSupplierStatement = printSupplierStatementEnhanced;
window.downloadStatementAsPDF = downloadStatementAsPDFEnhanced;
