import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getLangDir, type Lang } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AdBanner } from "@/components/AdBanner";

export const Route = createFileRoute("/articles")({
  head: () => ({
    meta: [
      { title: "الدليل الشامل والمقالات | DXFix User Manual & Guides" },
      { name: "description", content: "دليل الاستخدام الشامل لأداة DXFix ومجموعة مقالات ودلائل تعليمية لورش القص بالليزر والبلازما والـ CNC." },
      { name: "keywords", content: "دليل استخدام DXFix, إصلاح ملفات DXF, ماكينات CNC, قص ليزر, خطوط مكررة DXF, تحويل SVG إلى DXF, نصائح ورش التصنيع" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: ArticlesPage,
});

const ARTICLES = [
  {
    id: "user-guide-full-manual",
    titleAr: "📖 دليل الاستخدام الشامل: كيفية فحص وإصلاح ملفات DXF لورش الـ CNC والليزر والبلازما",
    titleEn: "📖 Complete User Guide: How to Inspect & Repair DXF Files for CNC Laser Workshops",
    summaryAr: "دليل الاستخدام التفصيلي لأداة DXFix: كيفية رفع الملفات، قراءة نتائج الفحص الميكانيكي، إغلاق المسارات، معالجة الملفات المجمعة، واستخراج ملفات قياسية جاهزة للماكينة.",
    summaryEn: "Comprehensive step-by-step user manual for DXFix: uploading files, reading mechanical diagnostics, closing loops, bulk processing, and exporting clean DXF files.",
    date: "2026-08-12",
    readTime: "8 دقائق",
    isGuide: true,
    contentAr: `
      مرحباً بك في الدليل الرسمي والتعليمي المعتمد لأداة **DXFix** المصممة خصيصاً لورش القص بالليزر، البلازما، والراوتر CNC في الوطن العربي.

      ---

      ### 1️⃣ الخطوة الأولى: رفع وإدخال التصميم
      - قم بفتح أداة **DXFix** واضغط على زر **"ارفع ملف DXF"** أو اسحب الملف مباشرة وإفلاته داخل مربع الرفع.
      - تدعم الأداة ملفات **DXF** بجميع إصداراتها (AutoCAD R12 إلى R2026) بالإضافة إلى تحويل صيغ **SVG** الرسومية.

      ---

      ### 2️⃣ الخطوة الثانية: التشخيص والتقييم الآلي (CNC Readiness Score)
      تقوم الخوارزمية بفحص الملف خلال أقل من 5 ثوانٍ وتعرض لك تقريراً من **100 درجة**:
      - **كشف الخطوط المكررة (Duplicate Lines):** دمج الخطوط المتراكبة لمنع إمرار شعاع الليزر مرتين وحرق الحواف.
      - **كشف المسارات المفتوحة (Open Loops):** تحديد الفجوات الصغيرة التي تمنع برنامج القص من التعرف على الشكل المغلق.
      - **الطبقات الفوضوية (Unorganized Layers):** تجميع خطوط القطع الداخلي والقطع الخارجي والنقش تلقائياً.
      - **حساب الأبعاد الكلية والحجم (Bounds & Perimeter):** حساب الطول الإجمالي للمسار لساعات التشغيل وتكلفة المتر.

      ---

      ### 3️⃣ الخطوة الثالثة: الضغط على زر الإصلاح المباشر 🔧
      - بنقرة واحدة على زر **"إصلاح الكيانات والأخطاء"**، يتم تطبيق العلاج التلقائي لكافة المشاكل دون التأثير على الأبعاد الهندسية الأصلية.
      - يمكنك استخدام خيار **"محاكاة مسار القص 3D"** لمشاهدة حركة رأس الماكينة افتراضياً قبل البدء بالقص الفعلي.

      ---

      ### 4️⃣ الخطوة الرابعة: التنزيل المباشر للملف النظيف ⬇️
      - بعد الإصلاح، اضغط على زر **"تحميل الملف"** للحصول على ملف DXF نظيف ومصقول بنسبة 100%.
      - الملف الناتج متوافق 100% مع جميع برامج التشغيل الشهيرة مثل: **LaserCAD, RDWorks, Mach3, FastCAM, SheetCAM, ArtCAM**.
    `,
  },
  {
    id: "fix-duplicate-lines-dxf",
    titleAr: "كيفية اكتشاف وإصلاح الخطوط المكررة في ملفات DXF لورش الليزر والـ CNC",
    titleEn: "How to Detect and Fix Duplicate Lines in DXF Files for CNC Laser Cutting",
    summaryAr: "تعد الخطوط المكررة (Overlapping/Duplicate Lines) السبب الأول في توقف ماكينات القص وحرق المواد في ورش الليزر والتصنيع. نتعرف في هذا المقال على كيفية علاجها تلقائياً.",
    summaryEn: "Duplicate and overlapping lines are the leading cause of machine stalls and material burn in CNC laser cutting. Learn how to fix them automatically.",
    date: "2026-08-01",
    readTime: "5 دقائق",
    isGuide: false,
    contentAr: `
      تعتبر مشكلة الخطوط المكررة والمتداخلة في ملفات التصميم الهندسية (DXF) من أكثر المشاكل الشائعة التي تواجه مشغلي ورش القص بالليزر والبلازما والـ CNC.
      
      ### ما هي الخطوط المكررة ولماذا تسبب مشكلة؟
      عند رسم الأشكال المعقدة أو نقل التصاميم بين برامج مثل AutoCAD و CorelDraw و Illustrator، قد يتم رسم نفس الخط مرتين في نفس الموقع بزيادة خط سميك أو محاذات خاطئة.
      عند نقل هذا الملف إلى ماكينة القص (مثل برامج RDWorks أو LaserCAD أو Mach3)، تقوم الماكينة بـ:
      1. إمرار شعاع الليزر أو رأس القص مرتين فوق نفس المسار.
      2. حرق حواف الخامة (المعدن، الأكريليك، أو الخشب).
      3. إهدار وقت المشغّل وزيادة استهلاك الكهرباء والغاز.

      ### كيف تقوم أداة DXFix بإصلاح هذه المشكلة؟
      تعتمد أداة DXFix على خوارزميات هندسية متقدمة لدمج الخطوط والمتجهات (Vector Merging):
      - تحليل كافة الكيانات ومطابقة نقاط البداية والنهاية.
      - إزالة القطع المستقيمة المكررة أو المتداخلة جزئياً.
      - تصدير ملف نظيف ذو خط واحد متصل لكل عنصر، مما يقلل وقت القص بنسبة تصل إلى 40%.
    `,
  },
  {
    id: "close-open-polylines-dxf",
    titleAr: "إغلاق الأشكال والمسارات المفتوحة في ملفات DXF لضمان جاهزية القص",
    titleEn: "Closing Open Shapes and Polylines in DXF Files for Clean Cutting",
    summaryAr: "دليل شامل حول كيفية الكشف عن الفجوات الصغيرة بين الخطوط في تصميمات DXF وإغلاقها تلقائياً لتفادي خروج رأس القص عن المسار.",
    summaryEn: "A complete guide on detecting microscopic gaps in DXF paths and closing open polylines to prevent cutter interruptions.",
    date: "2026-07-28",
    readTime: "6 دقائق",
    isGuide: false,
    contentAr: `
      من الشروط الأساسية لبدء عملية القص الميكانيكي الصحيحة أن تكون جميع الأشكال المغلقة (الدوائر، المربعات، الأسطح الداخلية) متصلة بنسبة 100%.

      ### ما هي المسارات المفتوحة (Open Loops)؟
      عندما يكون هناك فجوة غير مرئية بالعين المجردة (مثلاً 0.01 مم) بين نقطتين، يعتبر برنامج القص أن الشكل غير مكتمل، مما يمنع البرنامج من حساب المسار الداخلي أو الخارجي (Offset/Kerf Compensation) بالشكل الصحيح.

      ### الحل الرقمي مع DXFix:
      تقوم أداة DXFix بفحص نقاط الاتصال وتعيين التفاوت المسموح (Tolerance)، حيث يتم سد أي فجوات ميكرونية وإغلاق البوليلاين (Polyline) تلقائياً، ليعطيك الملف تقييم 100/100 لسلامة القص.
    `,
  },
];

function ArticlesPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const [activeArticle, setActiveArticle] = useState<string | null>("user-guide-full-manual");
  const dir = getLangDir(lang);

  const selectedArticle = ARTICLES.find((a) => a.id === activeArticle);

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground font-sans selection:bg-accent/30 selection:text-accent relative overflow-x-hidden">
      {/* Background blueprint grid */}
      <div className="absolute inset-0 blueprint-grid opacity-30 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent animate-spark" />
            <span>DX<span className="text-gradient-blueprint">fix</span></span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/tool" className="hidden sm:inline-flex px-4 py-2 rounded-md bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition shadow-[var(--shadow-spark)]">
              {lang === "ar" ? "الأداة المباشرة" : "Tool"}
            </a>
            <LanguageSwitcher currentLang={lang} onLangChange={setLang} />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 py-14">
        {!selectedArticle ? (
          <div>
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="inline-flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-full border border-accent/40 text-accent bg-accent/5">
                📚 {lang === "ar" ? "مدونة ودلائل استخدام DXFix" : "User Manual & Guides"}
              </span>
              <h1 className="font-display text-4xl sm:text-5xl font-bold mt-4">
                {lang === "ar" ? "الدليل الشامل ومقالات القص الميكانيكي" : "DXF Manual & CNC Cutting Guides"}
              </h1>
              <p className="mt-4 text-muted-foreground text-base sm:text-lg leading-relaxed">
                {lang === "ar"
                  ? "كل ما تحتاج معرفته عن كيفية استخدام أداة DXFix، إصلاح أخطاء الـ CAD، وحلول تشغيل ماكينات الليزر والبلازما والـ CNC."
                  : "Everything you need to know about using DXFix, CAD file error repair, and CNC laser cutting efficiency."}
              </p>
            </div>

            {/* Ad Banner for AdSense */}
            <div className="my-8">
              <AdBanner format="horizontal" lang={lang} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {ARTICLES.map((art) => (
                <div
                  key={art.id}
                  onClick={() => setActiveArticle(art.id)}
                  className={`group bg-card/70 border rounded-2xl p-6 hover:border-accent/60 cursor-pointer transition flex flex-col justify-between backdrop-blur-sm shadow-[var(--shadow-elegant)] ${
                    art.isGuide ? "border-accent/50 bg-gradient-to-br from-accent/10 to-card" : "border-border/80"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between font-mono text-xs text-muted-foreground mb-3">
                      <span>📅 {art.date}</span>
                      <span>⏱️ {art.readTime}</span>
                    </div>
                    <h2 className="font-display font-bold text-xl mb-3 group-hover:text-accent transition">
                      {lang === "ar" ? art.titleAr : art.titleEn}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {lang === "ar" ? art.summaryAr : art.summaryEn}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-2 font-semibold text-accent text-sm">
                    <span>{lang === "ar" ? "اقرأ الدليل الكامل" : "Read full guide"}</span>
                    <span>{dir === "rtl" ? "←" : "→"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setActiveArticle(null)}
              className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent font-semibold text-sm hover:bg-accent/20 transition"
            >
              <span>{dir === "rtl" ? "→" : "←"}</span>
              <span>{lang === "ar" ? "العودة لقائمة المقالات والدليل" : "Back to all guides"}</span>
            </button>

            <article className="bg-card/80 border border-border/80 rounded-3xl p-8 sm:p-10 backdrop-blur-md shadow-[var(--shadow-spark)]">
              <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground mb-4">
                <span>📅 {selectedArticle.date}</span>
                <span>⏱️ {selectedArticle.readTime}</span>
                {selectedArticle.isGuide && (
                  <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/40 font-semibold">
                    {lang === "ar" ? "دليل معتمد" : "Official Guide"}
                  </span>
                )}
              </div>

              <h1 className="font-display text-3xl sm:text-4xl font-bold mb-6 text-foreground">
                {lang === "ar" ? selectedArticle.titleAr : selectedArticle.titleEn}
              </h1>

              <div className="my-6 border-y border-border/60 py-4">
                <AdBanner format="horizontal" lang={lang} />
              </div>

              <div className="prose prose-invert max-w-none text-foreground/90 leading-relaxed space-y-4 whitespace-pre-line text-base">
                {lang === "ar" ? selectedArticle.contentAr : selectedArticle.contentAr}
              </div>
            </article>
          </div>
        )}
      </main>

      <footer className="border-t border-border/60 mt-16 py-8 text-center text-xs text-muted-foreground font-mono">
        © 2026 DXFix. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}
