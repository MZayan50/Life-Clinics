#!/bin/bash
# ══════════════════════════════════════════════════════
# 🚀 سكريبت التحديث التلقائي — شغّله قبل كل رفع على GitHub
# الاستخدام: bash update-sw.sh
# ══════════════════════════════════════════════════════

TS=$(date +%Y%m%d%H%M%S)
sed -i "s/v__BUILD_TS__/v$TS/" sw.js
echo "✅ sw.js updated → version: v$TS"
echo ""
echo "الآن ارفع الملفات على GitHub:"
echo "  git add -A && git commit -m '🔄 update v$TS' && git push"
