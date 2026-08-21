# AUDIT_BEFORE_UPDATE.md
# =========================================================
# MAGIC CAD CLOUD — PHASE 0 AUDIT (التدقيق قبل أي تحديث)
# حالة: جارية على الفرع main (82c8105) — baseline أخضر
# =========================================================

> هذه الوثيقة هي ناتج **PHASE 0 — AUDIT** وفق البرومبت الشامل.
> القاعدة الحاكمة: AUDIT → VERIFY → IMPROVE → EXTEND ، وليس REBUILD.
> لم يتم إجراء أي تعديل جوهري على الكود بعد — فقط توثيق للحالة الحالية.

---

## 1) ماذا يوجد حاليًا؟ (البنية)

### DXF / الهندسة
| الملف | الدور |
|------|-------|
| `src/lib/dxf.ts` | المحلل الرئيسي `analyzeDxf` + خط إصلاح `repairDxf` + `buildSvgPaths` + `getDxfBounds` + `calculateTotalPerimeter` + `score` الحتمي |
| `src/lib/dxf-cleanup.ts` | محرك التنظيف `cleanupEntities` الحتمي (محرك OVERKILL) |
| `src/lib/dxf-advanced.ts` | Nesting، مدير طبقات، محوّل إصدارات، مركز ثقل، تقرير جودة مسار الأداة، تحسين SVG |
| `src/lib/dxf-ai.ts` | كشف محسّن (تداخلات، auto-intersections، دمج ذكي) + `calculateEnhancedScore` |
| `src/lib/path-simplify.ts` | تبسيط RDP + تحويل قوس/دائرة/قطع ناقص إلى نقاط |
| `src/lib/path-union.ts` | لحام/اتحاد المسارات، إزالة التداخلات، إغلاق الأشكال |
| `src/lib/toolpath-optimizer.ts` | ترتيب مسار القص + تقرير مسافة الانتقال |
| `src/lib/svg-parser.ts` | SVG -> DXF (`parseSvg`, `isSvgContent`) |

### العارض (Viewer)
- `src/routes/tool.tsx` يعرض **SVG** (ليس Canvas/WebGL): `buildSvgPaths` -> `<svg>` مع:
  - zoom (متغير `zoom`)
  - viewBox + `overflow-auto`
  - ألوان الطبقات + إخفاء طبقة
  - تمييز الأخطاء بالأحمر + `issuesOnly`
  - نقاط الحلقات المفتوحة
  - محاكاة مؤشر القص (`simPointer`)

### الإحصائيات / الاشتراك / Paddle
| الملف | الدور |
|------|-------|
| `src/lib/stats.ts` + `/api/stats` | عدّادات حقيقية (filesRepaired/visitors) بدل localStorage الوهمي |
| `src/server.ts` | `/api/v1/webhooks/paddle`, `/api/subscribe`, `/api/check`, `/api/portal`, `/api/waitlist`, `/api/stats`, `/api/admin` |
| `src/lib/subscription.ts` / `subscription-auth.ts` / `subscription-server.ts` | اشتراك (localStorage + JSON ملف عبر subscription-server.ts) |
| `src/lib/paddle.ts` | تهيئة Paddle v2 + checkout |
| `src/hooks/use-subscription.tsx` | هوك React للاشتراك |
| `src/controllers/customerPortal.ts`, `src/db/paddleMirror.ts` | بوابة العميل + mirror Paddle |

### الواجهات (Routes)
`index.tsx` (هبوط), `tool.tsx` (الأداة), `pricing.tsx`, `admin.tsx` (لوحة), `privacy.tsx`, `terms.tsx`, `contact.tsx`, `articles.tsx`, `tools/dxf-converter.tsx`, `tools/file-compressor.tsx`.

### اختبارات / سكريبتات
`scripts/verify-cleanup.ts` (17 اختبار), `scripts/demo-overkill.ts`, `scripts/debug-cleanup.ts` + مخرجات JSON/DXF.
---

## 2) ماذا يعمل؟ (تحت الفحص فعلياً)
- ✔ محلل DXF يفكك الكيانات بأكواد المجموعات `code===0` (لا تجزئة على القيمة `0`).
- ✔ `parseGroups` مع trim يثبّر أزواج (code,value).
- ✔ `generateEntityText` يبني LINE من الإحداثيات المحدّثة.
- ✔ تسامح التبليق الحذر 0.001 (يحفظ المتوازي المتقارب).
- ✔ `cleanupEntities`: إزالة مكررات/معكوسة/صفرية/رؤوس مكررة/بوليلاينات/أقواس/دوائر + دمج التداخل الخطي والمحتوي.
- ✔ خط التصليح STEP 1-11 (تنظيف بنيوي، طبقات مخفية، عقد معلقة، تحويل إلى polylines، تبليط، دمج، إغلاق، تنظيف حقيقي، تحسين ترتيب، تبسيط RDP).
- ✔ `score` منطقي (0 - عقوبات) في dxf.ts.
- ✔ عدّادات حقيقية عبر stats.ts + /api/stats.
- ✔ اشتراك + Paddle (server-side verification + webhook).
- ✔ تنزيل DXF + تنزيل تقرير نصي.

## 3) ماذا لا يعمل / ناقص (الفجوات مقابل البرومبت)
| # | المطلوب في البرومبت | الحالة |
|---|---|---|
| 7 | **Near duplicates** كشف | غير موجود (وضع فقط تكرار تام عبر tolerance) |
| 14 | **Self-intersections** | موجود في dxf-ai.ts لكن **غير موصول** لـ issues[]/score الرئيسي |
| 15 | **Stray geometry** (منعزل/بعيد) | غير موجود |
| 16 | **Scale و Units** على level | غير موجود |
| 17 | **Layer analysis** (count/far آه/مخفي) | قائمة + إخفاء فقط، لا تقرير |
| 18 | **Entity breakdown** (manufacturing vs geometric) | stats فقط لا فصل |
| 19 | **SPLINE/ELLIPSE محفوظة** | **تعارض**: STEP 4 يحولها تلقائياً لـ POLYLINE، يجب جعل التحويل اختيار |
| 22 | **Geometry stats** (contours/vertices/طول) | جزئي (perimeter) |
| 23 | **MFG Readiness 0-100** مفصّل | score بسيط فقط |
| 24 | **Profiles** (LASER/CNC/FCF) | غير موجود |
| 25 | **Viewer zoom/pan/fit/selection** | zoom فقط |
| 26 | **Problem map** (markers+click-zoom) | أحمر فقط |
| 27 | **Before/After** | غير موجود |
| 29/30 | **Re-scan + verification في الواجهة** | **حرج**: score=100 بعد repair دون reanalysis |
| 33/34 | **Free 5 checks + usage** | غير موجود |
| 36 | **Dashboard per-user** | غير موجود (admin وهمي) |
| 37-40 | **Landing redesign** | index تسويقي لا يتبع الرسالة |
| 43 | **Performance** (workers/cancel/Canvas) | SVG كثيف |
| 44/45 | **Security/privacy** | لا قيود تحديث
---

## 4) ماذا تم اختباره؟ (الغطاء)
- **17/17** اختبار تحقق (`scripts/verify-cleanup.ts`) - أخضر: مكرر/معكوس/صفر/تداخل جزئي محتوى + polylines/old-polyline/circle/arc + SPLINE/ELLIPSE محفوظة + end-to-end (تحليل->إصلاح->إعادة تحليل).
- **`scripts/demo-overkill.ts`**: 60 كيان -> 3، بأرقام فعلية (52 مكرر، 2 محتوى، 1 تداخل، 2 صفري)، المتوازي المتباعد محفوظ.
- `typecheck` نظيف، `build` نظيف.
- بينة: اختبارات end-to-end للـ CIRCLE/ARC تُظهر تحويلها إلى LWPOLYLINE داخل خط الإصلاح (يتقاطع مع المتطلب §19).

## 5) ما الذي يتكرر؟ (Duplicate Implementations)
- **تنظيف/دمج تداخل**: `dxf-cleanup.ts` + `dxf-ai.ts` + `path-union.ts` - 3 طبقات متداخلة. (قبل الحذف: تحليل dependencies).
- **التحويل إلى polylines**: `dxf.ts STEP4` + `dxf-advanced` + `path-simplify`.
- **العدّادات**: `stats.ts` (/api/stats) + `subscription.ts` (getRepairedFilesCount) + `auto-marketing.ts` (getUserStats) - مصادر متعددة.
- **الـ score**: `analysis.score` (dxf.ts) + `calculateEnhancedScore` (dxf-ai) + UI فرض 100 يدوي بعد repair.

## 6) ما الذي يمكن إعادة استخدامه؟
- `analyzeDxf` / `repairDxf` / `buildSvgPaths` / `getDxfBounds` من `dxf.ts`.
- `cleanupEntities` + `DEFAULT_CLEANUP_OPTIONS` من `dxf-cleanup.ts`.
- `dxf-advanced.ts` (`nesting` / `layer manager` / `toolpath quality report`).
- `stats.ts` + `/api/stats` (إطار "إحصائيات حقيقية server-side").
- `/api/subscribe` + `/api/check` + Paddle webhook (إطار المصادقة).
- `buildSvgPaths` كأساس لترقية العارض.

## 7) ما الذي يحتاج تعديل؟
- **`dxf.ts`**: جعل STEP4 (التحويل إلى POLYLINE) اختيارياً ولا يشمل SPLINE/ELLIPSE (§19)؛ صَدْر فجوات الكشف (near/stray/self-intersection/scale-units/layers breakdown)؛ تطوير score إلى Readiness.
- **`src/routes/tool.tsx`**: **إصلاح re-scan الحقيقي** (لا عرض score=100 يدوي بعد repair)، إضافة verification و before/after و problem map و pan/fit، وتقرير IDX inspection.
- **`src/routes/index.tsx`**: إعادة تصميم الـ landing وفق الرسالة المطلوبة (Check your DXF before you cut).
- **`src/server.ts`**: إضافة endpoints للـ usage المجاني بحسب النموذج الحالي.

## 8) ما الذي يجب إضافته (مقابل البرومبت)
- Near-duplicate detector (ASSISTED).
- Self-intersection detector (DETECT ONLY).
- Stray-geometry detector (ASSISTED/REVIEW).
- Scale & Units analysis.
- Layer analysis module.
- Entity breakdown (manufacturing vs annotation).
- Geometry stats (contours/closed/open/vertices/path-length).
- Manufacturing/Readiness Score (0-100) مفصّل ومفسر.
- Profiles (LASER / CNC / GENERAL CAD).
- Visual problem map (markers + click-zoom).
- Before/After (toggle/side-by-side/overlay/synchronized).
- Rescan + Verification module (مدمج الواجهة).
- DXF Inspection Report قابل للتنزيل.
- Free 5 checks + usage API + dashboard per-user.
- Landing redesign (WHY-DXF-FAIL + HOW-IT-WORKS + positioning).
---

## 9) ما الذي يجب عدم لمسه (preserve)
- محرك `cleanupEntities` في `dxf-cleanup.ts` (baseline مثبت).
- إصلاحات المحلل (entity-splitting, parseGroups, generateEntityText, snap 0.001).
- `/api/stats` + `stats.ts` (النموذجة الصحيحة للعدادات الحقيقية).
- نظام Paddle/الاشتراك (لا تنشئ نظام دفع ثانٍ).
- الاختبارات الـ 17 الحالية (يجب أن تبقى ويزيد العدد).
- baseline أخضر: 17/17 + typecheck + build.

---

## 10) التوصية بترتيب التنفيذ (للمراحل اللاحقة)
1. **إصلاح re-scan الحقيقي + verification** في الواجهة (الأولوية القصوى - أساس "الحقيقة").
2. **جعل STEP4 اختيارياً وحماية SPLINE/ELLIPSE** (§19).
3. **إضافة detectors**: near-dup -> stray -> self-intersection -> scale/units -> layers -> breakdown.
4. **Geometry statistics + Manufacturing Readiness + Profiles**.
5. **Visual problem map + Before/After** (تصريح فوق `buildSvgPaths`).
6. **Inspection report قابل للتنزيل**.
7. **Free 5 checks + usage API + dashboard per-user**.
8. **Landing redesign**.
9. **Performance / Security / Testing**.
10. إعادة تشغيل typecheck + tests (يجب أن يزيد عن 17) + build بعد كل مرحلة.

---

> ملاحظة ختامية: وفق البرومبت §51، لا ننتقل لما بعد هذه الوثيقة إلا بعد موافقة/طلب صريح.
> هذه الوثيقة لا تُغيّر أي كود — هي ناتج PHASE 0 — AUDIT فقط.
- Performance: Workers/cancellation للرسم/التحليل.