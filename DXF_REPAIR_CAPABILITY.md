# DXF_REPAIR_CAPABILITY.md
# =========================================================
# MAGIC CAD CLOUD — Repair Capability Report
# (تقرير قدرات الإصلاح — PHASE 0 AUDIT)
# =========================================================

> القاعدة: لا نضع **Verified** إلا بعد اختبار فعلي (تحليل -> إصلاح -> إعادة تحليل).
> التصنيف: **SAFE AUTO-FIX** | **ASSISTED FIX** | **DETECT ONLY**.
> الأساس: `scripts/verify-cleanup.ts` (17/17) + `scripts/demo-overkill.ts`.

## الاصطلاحات
- **Detect**: هل المحرك يكتشف المشكلة؟
- **Repair**: هل يُصلحها تلقائياً/بمساعدة؟
- **Re-scan**: هل تثبت إعادة التحليل زوالها؟
- **Verified**: هل اختُبرت فعلياً الآن؟

---

| Problem | Detect | Repair | Re-scan | Verified | Classification |
|---------|:------:|:------:|:-------:|:--------:|----------------|
| Exact duplicate (LINE) | Yes | Yes | Yes | **Yes** (T1: 2->1) | SAFE AUTO-FIX |
| Reverse duplicate (LINE) | Yes | Yes | Yes | **Yes** (T2: 2->1) | SAFE AUTO-FIX |
| Near duplicate | No | No | No | No | **DETECT ONLY** (جديد: يجب ASSISTED) |
| Partial overlap (LINE) | Yes | Yes | Yes | **Yes** (T6: span يَكتب 150) | SAFE AUTO-FIX |
| Contained segment | Yes | Yes | Yes | **Yes** (T5: 2->1) | SAFE AUTO-FIX |
| Zero-length (LINE) | Yes | Yes | Yes | **Yes** (T3) | SAFE AUTO-FIX |
| Tiny geometry | Warning | No | No | No | DETECT ONLY (تنبيه) |
| Open contour / gap | Yes | Yes | Partial | ⚠️ جزئي | ASSISTED FIX |
| Near-open contour | No | No | No | No | DETECT ONLY |
| Broken endpoints | Snap 0.001 | Yes | Partial | ⚠️ جزئي | ASSISTED FIX |
| Collinear segments | Yes | Yes | Yes | **Yes** (T6/T5) | SAFE AUTO-FIX |
| Self-intersection | dxf-ai (غير موصول) | No | No | No | **DETECT ONLY** (جديد) |
| Stray geometry | No | No | No | No | **DETECT ONLY** (جديد) |
| Multiple layers | Yes (احترام طبقات) | Preserve | Yes | **Yes** (respectLayers) | SAFE AUTO-FIX |
| Empty layers | Purge (STEP1) | Yes | Partial | ⚠️ جزئي | ASSISTED FIX |
| LINE dup | Yes | Yes | Yes | **Yes** (T1-T3) | SAFE AUTO-FIX |
| POLYLINE dup | Yes | Yes | Yes | **Yes** (Engine_oldpolyline) | SAFE AUTO-FIX |
| LWPOLYLINE dup | Yes | Yes | Yes | **Yes** (T_lwpolyline) | SAFE AUTO-FIX |
| ARC dup | Yes | Yes | Yes* | **Yes** (Engine_arc + end-to-end) | SAFE AUTO-FIX |
| CIRCLE dup | Yes | Yes | Yes* | **Yes** (Engine_circle + end-to-end) | SAFE AUTO-FIX |
| SPLINE preserved | Yes (لا إزالة) | N/A | Yes | **Yes** (T_spline) | DETECT ONLY (احتفاظ) |
| ELLIPSE preserved | Yes (لا إزالة) | N/A | Yes | **Yes** (T_ellipse) | DETECT ONLY (احتفاظ) |
| BLOCK / INSERT | Purge (STEP1) | Partial | ⚠️ | ⚠️ جزئي | ASSISTED FIX |
| TEXT / MTEXT / DIMENSION | Purge (STEP1) | Partial | ⚠️ | ⚠️ جزئي | ASSISTED FIX (annotation) |
| Mixed geometry | Yes | Yes | Yes | **Yes** (demo 60->3) | SAFE AUTO-FIX |
| Mixed-problem DXF | Yes | Yes | Yes | **Yes** (demo 60->3) | SAFE AUTO-FIX |

> `*` ملاحظة حاسمة §19: عند التحويل داخل خط الإصلاح الكامل (`repairDxf`)، تُحَوَّل
> ARC/CIRCLE/SPLINE/ELLIPSE تلقائياً إلى POLYLINE (STEP 4). هذا **يتعارض** مع متطلب
> البرومبت §19 (حفظ SPLINE/ELLIPSE). يجب جعل التحويل **اختيارياً** لا تلقائياً.

---

## ملاحظات على "Verified" (المُختبر فعلياً)
1. **ZERO-LENGTH**: اختُبر على LINE فقط (T3). بحاجة اختبارات POLYLINE/LWPOLYLINE (§12/13 من البرومبت).
2. **OPEN CONTOUR**: الكشف موجود (نقاط فتح + إغلاق)، لكن لا توجد اختبارات end-to-end بمقادير فجوة مختلفة (صغير/متوسط/كبير) (§10).
3. **EXACT DUPLICATE**: المحرك يفهم A->B و B->A هندسياً عبر `sameLine` + `isReversed` (§6). ✅
4. **NEAR DUPLICATE / SELF-INTERSECTION / STRAY / SCALE-UNITS**: **غير موصولة** في `issues[]` الرئيسي — يجب إضافتها كمراحل جديدة.

---

## الأولوية المقترحة (بناءً على التصنيف أعلاه)
1. ربط re-scan الحقيقي في الواجهة (scale=100 اليدوي يُزال).
2. جعل STEP4 اختيارياً (§19).
3. إضافة detectors كـ DETECT ONLY أولاً: near-dup / self-intersection / stray / scale-units / layers-breakdown.
4. ثم ترقية ما ثبت أمانه إلى SAFE AUTO-FIX أو ASSISTED.
