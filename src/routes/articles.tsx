import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getLangDir, type Lang } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AdBanner } from "@/components/AdBanner";

export const Route = createFileRoute("/articles")({
  head: () => ({
    meta: [
      { title: "مقالات ودلائل إصلاح ملفات DXF والقص الميكانيكي | DXFix Blog" },
      { name: "description", content: "مجموعة مقالات ودلائل تعليمية شاملة لمشغلي ماكينات الليزر والبلازما والـ CNC لإصلاح أخطاء DXF وتحسين كفاءة القص." },
      { name: "keywords", content: "إصلاح ملفات DXF, ماكينات CNC, قص ليزر, خطوط مكررة DXF, تحويل SVG إلى DXF, نصائح ورش التصنيع" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: ArticlesPage,
});

const ARTICLES = [
  {
    id: "fix-duplicate-lines-dxf",
    titleAr: "كيفية اكتشاف وإصلاح الخطوط المكررة في ملفات DXF لورش الليزر والـ CNC",
    titleEn: "How to Detect and Fix Duplicate Lines in DXF Files for CNC Laser Cutting",
    summaryAr: "تعد الخطوط المكررة (Overlapping/Duplicate Lines) السبب الأول في توقف ماكينات القص وحرق المواد في ورش الليزر والتصنيع. نتعرف في هذا المقال على كيفية علاجها تلقائياً.",
    summaryEn: "Duplicate and overlapping lines are the leading cause of machine stalls and material burn in CNC laser cutting. Learn how to fix them automatically.",
    date: "2026-08-01",
    readTime: "5 دقائق",
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
    contentAr: `
      من الشروط الأساسية لبدء عملية القص الميكانيكي الصحيحة أن تكون جميع الأشكال المغلقة (الدوائر، المربعات، الأسطح الداخلية) متصلة بنسبة 100%.

      ### ما هي المسارات المفتوحة (Open Loops)؟
      عندما يكون هناك فجوة غير مرئية بالعين المجردة (مثلاً 0.01 مم) بين نقطتين، يعتبر برنامج القص أن الشكل غير مكتمل، مما يمنع البرنامج من حساب المسار الداخلي أو الخارجي (Offset/Kerf Compensation) بالشكل الصحيح.

      ### الحل الرقمي مع DXFix:
      تقوم أداة DXFix بفحص نقاط الاتصال وتعيين التفاوت المسموح (Tolerance)، حيث يتم سد أي فجوات ميكرونية وإغلاق البوليلاين (Polyline) تلقائياً، ليعطيك الملف تقييم 100/100 لسلامة القص.
    `,
  },
  {
    id: "svg-to-dxf-conversion-guide",
    titleAr: "دليل تحويل تصاميم SVG إلى ملفات DXF لورش الـ CNC والقص",
    titleEn: "Complete Guide to Converting SVG Designs to Clean DXF for CNC Machines",
    summaryAr: "تعلم كيفية تحويل تصاميم الفيكتور والشعارات من صيغة SVG إلى صيغة DXF متوافقة مع ماكينات القص مع الحفاظ على الأبعاد والمنحنيات.",
    summaryEn: "Learn how to convert vector art and logos from SVG to DXF format compatible with CNC cutters while preserving smooth curves.",
    date: "2026-07-20",
    readTime: "4 دقائق",
    contentAr: `
      تحتاج العديد من الورش إلى تحويل الصور والشعارات المصممة بصيغة SVG إلى صيغة DXF القياسية.
      
      في هذا الدليل، نوضح كيف تقوم أداة DXFix بتحويل جميع منحنيات البيزيه (Bezier Curves) والأقواس إلى كيانات DXF صحيحة جاهزة للقص دون الحاجة لتثبيت برامج مثل Illustrator أو AutoCAD.
    `,
  },
];

function ArticlesPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const [activeArticle, setActiveArticle] = useState<string | null>(null);
  const dir = getLangDir(lang);

  const selectedArticle = ARTICLES.find((a) => a.id === activeArticle);

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground font-sans selection:bg-accent/30 selection:text-accent">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="/" className="font-display font-bold text-xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent" />
            DXFix
          </a>
          <div className="flex items-center gap-4">
            <a href="/tool" className="text-sm font-semibold hover:text-accent transition">
              {lang === "ar" ? "الأداة" : "Tool"}
            </a>
            <LanguageSwitcher currentLang={lang} onLangChange={setLang} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-12">
        {!selectedArticle ? (
          <div>
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="font-mono text-xs text-accent uppercase tracking-widest">
                {lang === "ar" ? "مدونة ودلائل التصنيع" : "Knowledge Base & Guides"}
              </span>
              <h1 className="font-display text-4xl font-bold mt-2">
                {lang === "ar" ? "مقالات ودلائل قص وحلول ملفات DXF" : "DXF Repair & CNC Cutting Guides"}
              </h1>
              <p className="mt-4 text-muted-foreground text-lg">
                {lang === "ar"
                  ? "كل ما تحتاج معرفته عن تحسين ملفات الـ CAD، إصلاح الأخطاء، وحلول تشغيل ماكينات الليزر والبلازما والـ CNC."
                  : "Everything you need to know about CAD file optimization, error repair, and CNC laser cutting efficiency."}
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
                  className="group bg-card border border-border rounded-2xl p-6 hover:border-accent/50 cursor-pointer transition flex flex-col justify-between"
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
                    <span>{lang === "ar" ? "اقرأ المقال الكامل" : "Read full article"}</span>
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
              className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
            >
              {dir === "rtl" ? "→ العودة إلى قائمة المقالات" : "← Back to all articles"}
            </button>

            <article className="bg-card border border-border rounded-3xl p-8 sm:p-10">
              <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground mb-4">
                <span>📅 {selectedArticle.date}</span>
                <span>⏱️ {selectedArticle.readTime}</span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl font-bold mb-6">
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

      <footer className="border-t border-border/60 mt-16 py-8 text-center text-xs text-muted-foreground">
        © 2026 DXFix. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}
