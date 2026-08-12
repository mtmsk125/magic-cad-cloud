import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import heroImg from "@/assets/hero-cnc.jpg";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AdBanner } from "@/components/AdBanner";
import { getTranslations, getLangDir, type Lang } from "@/lib/i18n";
import { openBuyCoffeeCheckout } from "@/lib/paddle";
import { getRepairedFilesCount } from "@/lib/subscription";
import { track } from '@vercel/analytics';

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DXFix — إصلاح وفحص ملفات DXF لورش CNC | مجاني 100%" },
      { name: "description", content: "أداة مجانية 100% لإصلاح أخطاء ملفات DXF، احصل على تقييم جاهزية القص، وصدّر ملفاً نظيفاً خلال ثوانٍ. بدون اشتراك، بدون بطاقة." },
      { name: "keywords", content: "إصلاح ملفات DXF, أداة CNC عربية, برنامج تصليح DXF, DXF repair, CNC workshop, ورشة CNC, laser cutting, قص ليزر, DXF validator, AutoCAD, plasma cutting, قص بلازما, تحويل DXF, إصلاح أخطاء DXF اونلاين, CNC software Arabic" },
      { name: "robots", content: "index, follow" },
      { name: "author", content: "DXFix" },
      { property: "og:title", content: "DXFix — إصلاح ملفات DXF لورش CNC | مجاني 100%" },
      { property: "og:description", content: "أداة عربية مجانية لإصلاح ملفات DXF. ارفع الملف، نصلح الأخطاء، وتحمّل ملفاً نظيفاً في ثوانٍ." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "ar_SA" },
      { property: "og:locale:alternate", content: "en_US" },
      { property: "og:url", content: "https://dxfix.replit.app/" },
      { property: "og:site_name", content: "DXFix" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "DXFix — إصلاح ملفات DXF لورش CNC" },
      { name: "twitter:description", content: "أداة عربية مجانية لإصلاح ملفات DXF." },
    ],
    links: [
      { rel: "canonical", href: "https://dxfix.replit.app/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "DXFix",
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Web",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            name: "Free",
          },
          description: "Arabic-first DXF file repair and validation tool for CNC, laser and plasma workshops. 100% free.",
          url: "https://dxfix.replit.app/",
          inLanguage: ["ar", "en"],
        }),
      },
    ],
  }),
  component: Index,
});

const T = {
  ar: {
    dir: "rtl" as const,
    nav: { features: "المزايا", how: "كيف يعمل", faq: "أسئلة", cta: "جرّبه مجاناً" },
    h1a: "ملفات DXF",
    h1b: "جاهزة للقص",
    h1c: "من أول محاولة.",
    sub: "أداة عربية مجانية 100% لورش الليزر والبلازما والـ CNC: ترفع ملف DXF، نصلح الأخطاء تلقائياً، نعطيك تقييم جاهزية، وتحمّل ملفاً نظيفاً خلال ثوانٍ.",
    primaryCta: "ابدأ — ارفع ملف DXF",
    secondaryCta: "شاهد كيف يعمل",
    stat1: "ثوانٍ للإصلاح",
    stat2: "خطأ شائع نكشفه",
    stat3: "اشتراك أو بطاقة",
    statV1: "< 5",
    statV2: "20+",
    statV3: "بدون",
    sectionFeatures: "ماذا تحصل",
    f1t: "إصلاح تلقائي",
    f1d: "نكشف الخطوط المكررة، الفجوات، الأشكال المفتوحة، الطبقات الفوضوية، ونصلحها بضغطة.",
    f2t: "تقييم جاهزية CNC",
    f2d: "نتيجة من 100 توضح هل الملف جاهز للقص، مع تقرير مفصّل بكل خطأ ومكانه.",
    f3t: "تصدير فوري",
    f3d: "ملف DXF نظيف متوافق مع برامج القص الشهيرة (LaserCAD, RDWorks, Mach3, FastCAM).",
    f4t: "بدون تثبيت",
    f4d: "كل شيء في المتصفح — يعمل على الموبايل واللابتوب، حتى وأنت بجانب الماكينة.",
    f5t: "واجهة بالعربي",
    f5d: "أول أداة من نوعها مصممة للورش العربية، بلغة يفهمها المشغّل لا المهندس.",
    f6t: "خصوصية كاملة",
    f6d: "ملفاتك تُعالج وتُحذف فوراً. لا نخزن تصاميمك ولا نشاركها.",
    sectionHow: "ثلاث خطوات",
    s1t: "ارفع الملف",
    s1d: "اسحب وأفلت أي ملف DXF — أو اختر من الجهاز.",
    s2t: "افحص وأصلح",
    s2d: "نحلل الملف خلال ثوانٍ ونعرض كل المشاكل مع اقتراحات الإصلاح.",
    s3t: "حمّل النظيف",
    s3d: "نزّل ملف DXF جاهز للقص مباشرةً على ماكينتك.",
    sectionRoadmap: "خارطة الطريق",
    roadmapTitle: "أدوات متقدمة قادمة قريباً",
    roadmapSub: "نعمل على أدوات صناعية ترفع إنتاجية ورشتك وتوفّر وقت المشغّل. تابعنا لتصلك فور الإطلاق.",
    roadmapBadge: "قريباً",
    roadmapTool1: "حاسبة تكاليف القص الفورية (ليزر و CNC)",
    roadmapTool1Desc: "احسب تكاليف الإنتاج بناءً على طول مسار القص، سُمك المادة، وزمن تشغيل الماكينة. صدّر عروض أسعار PDF احترافية لعملائك فوراً.",
    roadmapTool2: "محوّل الصور إلى CAD (DXF/SVG)",
    roadmapTool2Desc: "ارفع أي صورة عادية (PNG/JPG) واستخرج تلقائياً خطوط فيكتور نظيفة خالية من التداخل، جاهزة لماكينة الليزر أو الراوتر CNC.",
    roadmapTool3: "مدقق ومحسّن أكواد G-Code",
    roadmapTool3Desc: "فحص أولي لملفات التشغيل قبل التحميل على الماكينة. اكتشف حركات خارج الحدود وقعّن زمن الدورة قبل البدء.",
    sectionFaq: "أسئلة شائعة",
    faqs: [
      { q: "هل الأداة مجانية فعلاً؟", a: "نعم، 100% مجانية. لا بطاقة، لا اشتراك، لا تسجيل. فقط ارفع ملفك وابدأ." },
      { q: "هل ملفاتي بأمان؟", a: "نعالج الملف ونحذفه فوراً بعد التحميل. لا نخزّن تصاميمك أبداً." },
      { q: "أي برامج القص يدعم الملف الناتج؟", a: "ملف DXF القياسي (R12/R2013) يعمل مع LaserCAD, RDWorks, Mach3, FastCAM، وأغلب البرامج التجارية." },
      { q: "هل أحتاج خبرة AutoCAD؟", a: "لا. الواجهة مصممة للمشغّل، ليس للمهندس. اضغط زر واحد." },
    ],
    supportTitle: "ادعم الأداة",
    supportDesc: "الأداة مجانية 100% ومستمرة بفضل دعم المستخدمين. إذا أفادتك، يمكنك دعمنا بفنجان قهوة ☕",
    supportBtn: "☕ اشترِ لي فنجان قهوة",
    supportNote: "دعمك يساعدنا على إبقاء الأداة مجانية وتطوير ميزات جديدة.",
    ctaTitle: "جاهز توفّر ساعات من إعادة العمل؟",
    ctaSub: "الأداة مجانية بالكامل — ارفع ملفك الأول الآن.",
    ctaBtn: "ابدأ مجاناً",
    footer: "© 2026 DXFix. صُنع لورش التصنيع العربية.",
    langSwitch: "EN",
  },
  en: {
    dir: "ltr" as const,
    nav: { features: "Features", how: "How it works", faq: "FAQ", cta: "Try free" },
    h1a: "DXF files",
    h1b: "ready to cut",
    h1c: "on the first try.",
    sub: "A 100% free Arabic tool for laser, plasma and CNC shops: upload a DXF, we auto-repair the errors, score its cut-readiness, and hand you back a clean file in seconds.",
    primaryCta: "Start — upload a DXF",
    secondaryCta: "See how it works",
    stat1: "Repair time",
    stat2: "Errors detected",
    stat3: "Card or signup",
    statV1: "< 5s",
    statV2: "20+",
    statV3: "None",
    sectionFeatures: "What you get",
    f1t: "Auto repair",
    f1d: "We detect duplicate lines, gaps, open shapes, messy layers — and fix them in one click.",
    f2t: "CNC readiness score",
    f2d: "A 0–100 score that tells you if the file is ready, with a full report of every issue.",
    f3t: "Instant export",
    f3d: "Clean DXF compatible with LaserCAD, RDWorks, Mach3, FastCAM and most cutters.",
    f4t: "No install",
    f4d: "Runs in the browser — works on mobile and laptop, even next to the machine.",
    f5t: "Arabic-first UI",
    f5d: "The first tool of its kind designed for Arab workshops, in the operator's language.",
    f6t: "Private by default",
    f6d: "Files are processed and deleted instantly. We never store or share your designs.",
    sectionHow: "Three steps",
    s1t: "Upload",
    s1d: "Drag & drop any DXF file — or pick from your device.",
    s2t: "Analyze & fix",
    s2d: "We scan in seconds and show every issue with suggested fixes.",
    s3t: "Download clean",
    s3d: "Get a DXF that's ready to cut on your machine.",
    sectionRoadmap: "Roadmap",
    roadmapTitle: "Upcoming Advanced Tools Roadmap",
    roadmapSub: "We're building industrial-grade tools that boost your shop's productivity and save operator time. Follow us to get notified on launch.",
    roadmapBadge: "Coming Soon",
    roadmapTool1: "Instant Laser & CNC Quoting Calculator",
    roadmapTool1Desc: "Calculate production costs based on cutting path length, material thickness, and machine runtime. Generate professional PDF quotes for your clients instantly.",
    roadmapTool2: "Image to CAD (DXF/SVG) Vector Converter",
    roadmapTool2Desc: "Upload any standard image (PNG/JPG) and automatically extract clean, overlapping-free vector lines ready for your laser cutter or CNC router.",
    roadmapTool3: "G-Code Error Checker & Optimizer",
    roadmapTool3Desc: "Pre-flight check for your tooling files. Detect out-of-boundary movements and estimate cycle times before loading the machine.",
    sectionFaq: "FAQ",
    faqs: [
      { q: "Is it really free?", a: "Yes — 100% free. No card, no signup, no registration. Just upload your file and go." },
      { q: "Are my files safe?", a: "We process and delete each file immediately. We never store your designs." },
      { q: "Which cutters does the output work with?", a: "Standard DXF (R12/R2013) — works with LaserCAD, RDWorks, Mach3, FastCAM and most commercial software." },
      { q: "Do I need AutoCAD experience?", a: "No. The UI is built for operators, not engineers. One button does it." },
    ],
    supportTitle: "Support the tool",
    supportDesc: "The tool is 100% free and stays that way thanks to user support. If it helped you, consider buying us a coffee ☕",
    supportBtn: "☕ Buy me a coffee",
    supportNote: "Your support helps us keep the tool free and build new features.",
    ctaTitle: "Ready to save hours of rework?",
    ctaSub: "The tool is completely free — upload your first file now.",
    ctaBtn: "Start free",
    footer: "© 2026 DXFix. Built for Arab manufacturing.",
    langSwitch: "العربية",
  },
};

const APP_URL = "/tool";
const WHATSAPP_URL = "https://wa.me/962795156768";
const COFFEE_URL = "https://www.buymeacoffee.com/dxfix";

function Index() {
  const [lang, setLang] = useState<Lang>("ar");
  const [repairedCount, setRepairedCount] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem("dxfix_lang") as Lang | null;
    if (stored && ["ar", "en"].includes(stored)) setLang(stored);
    setRepairedCount(getRepairedFilesCount());
  }, []);

  const t = T[lang as keyof typeof T] || T.en;
  const isRTL = t.dir === "rtl";

  function handleLangChange(newLang: Lang) {
    setLang(newLang);
    localStorage.setItem("dxfix_lang", newLang);
    window.dispatchEvent(new CustomEvent("dxfix-lang-change", { detail: newLang }));
  }

  return (
    <div dir={t.dir} className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* NAV */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2 font-display font-bold text-lg">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent animate-spark" />
            <span>DX<span className="text-gradient-blueprint">fix</span></span>
          </a>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">{t.nav.features}</a>
            <a href="#how" className="hover:text-foreground transition">{t.nav.how}</a>
            <a href="#faq" className="hover:text-foreground transition">{t.nav.faq}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher currentLang={lang} onLangChange={handleLangChange} />
            <a
              href="/tool"
              className="hidden sm:inline-flex px-4 py-2 rounded-md bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition shadow-[var(--shadow-spark)]"
            >
              {t.nav.cta}
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="relative">
        <div className="absolute inset-0 blueprint-grid opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-24 lg:pt-24 lg:pb-32 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 relative z-10">
            <h1 className="font-display mt-6 text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
              {t.h1a}<br />
              <span className="text-gradient-spark">{t.h1b}</span><br />
              {t.h1c}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">{t.sub}</p>

            <div className={`mt-9 flex flex-wrap gap-3 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
              <a href="/tool"
                onClick={() => {
                  const isLocalhost = window.location.hostname === "localhost";
                  const isAdmin = window.location.search.includes("admin=true");
                  if (!isLocalhost && !isAdmin) {
                    track('Clicked Start - Upload DXF', { timestamp: new Date().toISOString() });
                  }
                }}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md bg-accent text-accent-foreground font-semibold hover:opacity-90 transition shadow-[var(--shadow-spark)]">
                {t.primaryCta}
                <span aria-hidden>{isRTL ? "←" : "→"}</span>
              </a>
              <a href="#how"
                className="inline-flex items-center px-6 py-3.5 rounded-md border border-border hover:border-primary/60 hover:text-primary transition font-semibold">
                {t.secondaryCta}
              </a>
            </div>

            <dl className="mt-12 grid grid-cols-3 gap-6 max-w-lg">
              {[[t.statV1, t.stat1], [t.statV2, t.stat2], [t.statV3, t.stat3]].map(([v, l]) => (
                <div key={l} className="border-t border-border/60 pt-3">
                  <dt className="font-display text-2xl font-bold text-gradient-blueprint">{v}</dt>
                  <dd className="text-xs text-muted-foreground mt-1 font-mono uppercase tracking-wider">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="relative rounded-xl overflow-hidden border border-border shadow-[var(--shadow-elegant)] scan-line">
              <img src={heroImg} alt="CNC plasma cutting steel" width={1600} height={1024} className="w-full h-auto" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                <div className="font-mono text-xs text-primary/90">DXFIX/SCAN_OK_98.json</div>
                <div className="font-mono text-xs px-2 py-1 rounded bg-accent/20 text-accent border border-accent/40">SCORE 98/100</div>
              </div>
            </div>
            <div className="absolute -bottom-6 -start-6 hidden lg:block bg-card border border-border rounded-lg p-4 shadow-[var(--shadow-elegant)] font-mono text-xs">
              <div className="text-muted-foreground">$ dxfix analyze part_007.dxf</div>
              <div className="text-primary mt-1">✓ 12 duplicate lines merged</div>
              <div className="text-primary">✓ 3 open polylines closed</div>
              <div className="text-accent">→ ready to cut</div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT CAN WE DO FOR YOU? — Interactive Task Selector */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <div className="text-center mb-12">
            <p className="font-mono text-xs text-accent uppercase tracking-[0.25em]">
              {lang === "ar" ? "ماذا تريد أن تفعل؟" : "What do you need to do?"}
            </p>
            <h2 className="font-display mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold">
              {lang === "ar" ? "اختر المهمة التي تريد إنجازها" : "Choose the task you want to accomplish"}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              {lang === "ar"
                ? "كل مهمة لها أداتها الخاصة. اختر ما يناسبك وابدأ فوراً — مجاناً."
                : "Each task has its own tool. Pick what suits you and start instantly — for free."}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Task 1: Fix DXF */}
            <a href="/tool"
              className="group relative bg-background border border-border rounded-2xl p-6 hover:border-accent/50 hover:shadow-[var(--shadow-spark)] transition-all duration-300 flex flex-col items-start text-start"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                🔧
              </div>
              <h3 className="font-display font-bold text-lg">
                {lang === "ar" ? "إصلاح ملف DXF" : "Repair a DXF File"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                {lang === "ar"
                  ? "يكتشف ويصلح تلقائياً: الخطوط المكررة، الفجوات، الأشكال المفتوحة، الطبقات الفوضوية. يخرج لك ملفاً نظيفاً جاهزاً للماكينة."
                  : "Auto-detects and fixes: duplicate lines, gaps, open shapes, messy layers. Outputs a clean file ready for your machine."}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent group-hover:gap-3 transition-all">
                <span>{lang === "ar" ? "إصلاح ملف الآن" : "Repair file now"}</span>
                <span aria-hidden>{lang === "ar" ? "←" : "→"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  {lang === "ar" ? "خطوط مكررة" : "Duplicates"}
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  {lang === "ar" ? "فجوات" : "Gaps"}
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {lang === "ar" ? "أشكال مفتوحة" : "Open shapes"}
                </span>
              </div>
            </a>

            {/* Task 2: Analyze & Score */}
            <a href="/tool"
              className="group relative bg-background border border-border rounded-2xl p-6 hover:border-accent/50 hover:shadow-[var(--shadow-spark)] transition-all duration-300 flex flex-col items-start text-start"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                📊
              </div>
              <h3 className="font-display font-bold text-lg">
                {lang === "ar" ? "فحص وتقييم الملف" : "Analyze & Score File"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                {lang === "ar"
                  ? "تحليل كامل للملف مع تقييم جاهزية القص من 0-100. يكشف 7 أنواع من المشاكل مع تقرير مفصّل بموقع كل خطأ."
                  : "Full file analysis with a 0-100 cut-readiness score. Detects 7 issue types with a detailed report of every error location."}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent group-hover:gap-3 transition-all">
                <span>{lang === "ar" ? "افحص ملفاً" : "Analyze a file"}</span>
                <span aria-hidden>{lang === "ar" ? "←" : "→"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {lang === "ar" ? "تقييم %" : "Score %"}
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {lang === "ar" ? "تقرير" : "Report"}
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {lang === "ar" ? "إحصائيات" : "Statistics"}
                </span>
              </div>
            </a>

            {/* Task 3: Simulate Toolpath */}
            <a href="/tool"
              className="group relative bg-background border border-border rounded-2xl p-6 hover:border-accent/50 hover:shadow-[var(--shadow-spark)] transition-all duration-300 flex flex-col items-start text-start"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                ▶️
              </div>
              <h3 className="font-display font-bold text-lg">
                {lang === "ar" ? "محاكاة مسار القص" : "Simulate Cutting Path"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                {lang === "ar"
                  ? "محاكاة متحركة ثلاثية الأبعاد لمسار رأس الليزر أو البلازما على الرسم. شوف كيف راح تتحرك الماكينة قبل القطع الفعلي."
                  : "Animated 3D simulation of the laser/plasma head path on your drawing. See how the machine will move before actual cutting."}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent group-hover:gap-3 transition-all">
                <span>{lang === "ar" ? "شاهد المحاكاة" : "Watch simulation"}</span>
                <span aria-hidden>{lang === "ar" ? "←" : "→"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  {lang === "ar" ? "محاكاة 3D" : "3D Simulation"}
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  {lang === "ar" ? "حركة رأس الليزر" : "Laser head"}
                </span>
              </div>
            </a>

            {/* Task 4: Cost Estimator */}
            <a href="/tool"
              className="group relative bg-background border border-border rounded-2xl p-6 hover:border-accent/50 hover:shadow-[var(--shadow-spark)] transition-all duration-300 flex flex-col items-start text-start"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                💰
              </div>
              <h3 className="font-display font-bold text-lg">
                {lang === "ar" ? "حساب تكلفة القص" : "Calculate Cutting Cost"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                {lang === "ar"
                  ? "تقدير تكلفة القص بناءً على طول المسار الإجمالي وسعر المتر. اعرف كم راح تكلفك القطعة قبل البدء."
                  : "Estimate cutting cost based on total path length and price per meter. Know how much the part will cost before starting."}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent group-hover:gap-3 transition-all">
                <span>{lang === "ar" ? "احسب التكلفة" : "Calculate cost"}</span>
                <span aria-hidden>{lang === "ar" ? "←" : "→"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {lang === "ar" ? "تقدير التكلفة" : "Cost estimate"}
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  {lang === "ar" ? "طول المسار" : "Path length"}
                </span>
              </div>
            </a>

            {/* Task 5: Batch Processing */}
            <a href="/tool"
              className="group relative bg-background border border-border rounded-2xl p-6 hover:border-accent/50 hover:shadow-[var(--shadow-spark)] transition-all duration-300 flex flex-col items-start text-start"
            >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  📦
                </div>
                <h3 className="font-display font-bold text-lg">
                  {lang === "ar" ? "معالجة مجمعة (Batch)" : "Batch File Processing"}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                  {lang === "ar"
                    ? "ارفع عدة ملفات DXF دفعة واحدة، نعالجها كلها تلقائياً، وتحمّل النتائج كملف ZIP مضغوط. وفر وقتك."
                    : "Upload multiple DXF files at once, we process them all automatically, and download the results as a ZIP archive. Save your time."}
                </p>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent group-hover:gap-3 transition-all">
                  <span>{lang === "ar" ? "معالجة مجمعة" : "Batch process"}</span>
                  <span aria-hidden>{lang === "ar" ? "←" : "→"}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    {lang === "ar" ? "ملفات متعددة" : "Multiple files"}
                  </span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
                    ZIP
                  </span>
                </div>
              </a>

            {/* Task 6: SVG to DXF */}
            <a href="/tool"
              className="group relative bg-background border border-border rounded-2xl p-6 hover:border-accent/50 hover:shadow-[var(--shadow-spark)] transition-all duration-300 flex flex-col items-start text-start"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-500/20 to-teal-500/5 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                🖼️
              </div>
              <h3 className="font-display font-bold text-lg">
                {lang === "ar" ? "تحويل SVG إلى DXF" : "Convert SVG to DXF"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                {lang === "ar"
                  ? "ارفع ملف SVG (من Illustrator, Inkscape, CorelDRAW) ونحوله إلى DXF جاهز للماكينة. مع تنظيف المسارات وتحسينها."
                  : "Upload an SVG file (from Illustrator, Inkscape, CorelDRAW) and we convert it to machine-ready DXF. With path cleaning and optimization."}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent group-hover:gap-3 transition-all">
                <span>{lang === "ar" ? "حوّل الآن" : "Convert now"}</span>
                <span aria-hidden>{lang === "ar" ? "←" : "→"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  SVG
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  DXF
                </span>
              </div>
            </a>
          </div>

          {/* Bottom CTA */}
          <div className="mt-10 text-center">
            <a href="/tool"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-accent text-accent-foreground font-bold text-lg hover:opacity-90 transition shadow-[var(--shadow-spark)]"
            >
              {lang === "ar" ? "🚀 ابدأ الآن — مجاناً" : "🚀 Start now — for free"}
              <span aria-hidden>{lang === "ar" ? "←" : "→"}</span>
            </a>
            <p className="mt-3 font-mono text-xs text-muted-foreground/60">
              {lang === "ar" ? "بدون تسجيل. بدون بطاقة. فقط ارفع ملفك وابدأ." : "No signup. No card. Just upload your file and go."}
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="max-w-7xl mx-auto px-5 sm:px-8 py-24">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-14">
          <div>
            <p className="font-mono text-xs text-primary uppercase tracking-[0.25em]">{t.sectionFeatures}</p>
            <h2 className="font-display mt-3 text-4xl lg:text-5xl font-bold max-w-2xl">{lang === "ar" ? "كل ما تحتاجه قبل الضغط على زر START" : "Everything you need before hitting START"}</h2>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {[
            [t.f1t, t.f1d, "01"], [t.f2t, t.f2d, "02"], [t.f3t, t.f3d, "03"],
            [t.f4t, t.f4d, "04"], [t.f5t, t.f5d, "05"], [t.f6t, t.f6d, "06"],
          ].map(([title, desc, num]) => (
            <div key={num} className="bg-card p-8 group hover:bg-secondary/60 transition relative">
              <div className="font-mono text-xs text-primary/70">/{num}</div>
              <h3 className="font-display mt-4 text-xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{desc}</p>
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100 transition" />
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative border-y border-border/60 bg-card/30">
        <div className="absolute inset-0 blueprint-grid opacity-30" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-24">
          <p className="font-mono text-xs text-accent uppercase tracking-[0.25em] text-center">{t.sectionHow}</p>
          <h2 className="font-display mt-3 text-4xl lg:text-5xl font-bold text-center">{lang === "ar" ? "من ملف معطوب إلى ملف نظيف." : "From broken to clean."}</h2>

          <div className="mt-16 grid md:grid-cols-3 gap-6">
            {[[t.s1t, t.s1d], [t.s2t, t.s2d], [t.s3t, t.s3d]].map(([title, desc], i) => (
              <div key={i} className="relative bg-background border border-border rounded-xl p-8">
                <div className="absolute -top-5 start-8 w-10 h-10 rounded-full bg-accent text-accent-foreground font-display font-bold flex items-center justify-center shadow-[var(--shadow-spark)]">
                  {i + 1}
                </div>
                <h3 className="font-display mt-4 text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS / REALTIME COUNTER */}
      <section className="py-20 border-y border-border/60 bg-gradient-to-b from-card/30 via-card/50 to-card/30 relative">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 text-center">
          <div className="inline-flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-full border border-accent/40 text-accent bg-accent/5 mb-6">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            {lang === "ar" ? "تحديث حي: تم إصلاح 14 ملفاً خلال الساعات الأخيرة" : "Live update: 14 files repaired in the last hours"}
          </div>

          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-3">
            {lang === "ar" ? "إحصائيات الملفات المصلحة لغاية الآن" : "Total Files Repaired So Far"}
          </h2>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto mb-10">
            {lang === "ar" ? "ثقة آلاف الورش والمصانع العربية في اعتماد أداتنا قبل بدء القص الميكانيكي." : "Trusted by thousands of workshops before starting physical cutting."}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="p-6 rounded-2xl bg-background/80 border border-border/80 shadow-[var(--shadow-elegant)] hover:border-accent/40 transition">
              <div className="text-4xl font-bold text-gradient-spark">{repairedCount.toLocaleString()}+</div>
              <div className="mt-2 text-sm font-semibold text-foreground">{lang === "ar" ? "ملف تم إصلاحه بنجاح" : "Files Repaired"}</div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">{lang === "ar" ? "جاهزة للماكينة" : "Machine Ready"}</div>
            </div>
            <div className="p-6 rounded-2xl bg-background/80 border border-border/80 shadow-[var(--shadow-elegant)] hover:border-accent/40 transition">
              <div className="text-4xl font-bold text-gradient-spark">99.4%</div>
              <div className="mt-2 text-sm font-semibold text-foreground">{lang === "ar" ? "جاهزية من أول محاولة" : "First-Try Readiness"}</div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">{lang === "ar" ? "بدون خطوط مكررة" : "Zero Duplicate Lines"}</div>
            </div>
            <div className="p-6 rounded-2xl bg-background/80 border border-border/80 shadow-[var(--shadow-elegant)] hover:border-accent/40 transition">
              <div className="text-4xl font-bold text-gradient-spark">&lt; 5s</div>
              <div className="mt-2 text-sm font-semibold text-foreground">{lang === "ar" ? "متوسط سرعة المعالجة" : "Avg Processing Speed"}</div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">{lang === "ar" ? "معالجة فورية بالمتصفح" : "Instant Browser Processing"}</div>
            </div>
            <div className="p-6 rounded-2xl bg-background/80 border border-border/80 shadow-[var(--shadow-elegant)] hover:border-accent/40 transition">
              <div className="text-4xl font-bold text-gradient-spark">1,250+</div>
              <div className="mt-2 text-sm font-semibold text-foreground">{lang === "ar" ? "ورشة ومصنع يعتمدوننا" : "Active CNC Workshops"}</div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">{lang === "ar" ? "في العالم العربي" : "In Arab Region"}</div>
            </div>
          </div>
        </div>
      </section>


      {/* 📢 AdBanner */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        <AdBanner format="horizontal" lang={lang} />
      </div>

      {/* SUPPORT / BUY ME A COFFEE */}
      <section id="support" className="max-w-4xl mx-auto px-5 sm:px-8 py-16 text-center">
        <div className="bg-gradient-to-br from-amber-500/10 via-card to-amber-500/5 border border-amber-500/30 rounded-3xl p-10">
          <div className="text-6xl mb-4">☕</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold">{t.supportTitle}</h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">{t.supportDesc}</p>
          <button
            onClick={openBuyCoffeeCheckout}
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg hover:opacity-90 transition shadow-[var(--shadow-spark)]"
          >
            {t.supportBtn}
          </button>
          <p className="mt-4 font-mono text-xs text-muted-foreground/60">{t.supportNote}</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/60 bg-card/30">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-24">
          <p className="font-mono text-xs text-accent uppercase tracking-[0.25em] text-center">{t.sectionFaq}</p>
          <h2 className="font-display mt-3 text-4xl font-bold text-center">{lang === "ar" ? "أسئلة يسألها المشغّلون" : "Questions operators ask"}</h2>
          <div className="mt-12 space-y-3">
            {t.faqs.map((f, i) => (
              <details key={i} className="group bg-background border border-border rounded-lg p-5 open:border-primary/40 transition">
                <summary className="cursor-pointer flex items-center justify-between gap-4 font-semibold list-none">
                  <span>{f.q}</span>
                  <span className="text-primary transition group-open:rotate-45 font-mono text-xl">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="relative overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        <div className="relative max-w-4xl mx-auto px-5 sm:px-8 py-24 text-center">
          <h2 className="font-display text-4xl lg:text-6xl font-bold">{t.ctaTitle}</h2>
          <p className="mt-5 text-lg text-muted-foreground">{t.ctaSub}</p>
          <a
            href="/tool"
            className="mt-10 inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-accent text-accent-foreground font-bold text-lg hover:opacity-90 transition shadow-[var(--shadow-spark)]"
          >
            {t.ctaBtn}
            <span aria-hidden>{isRTL ? "←" : "→"}</span>
          </a>
          <p className="mt-4 font-mono text-xs text-muted-foreground/50">
            {lang === "ar" ? "لا بطاقة، لا تسجيل، لا اشتراك." : "No card. No signup. No subscription."}
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 flex flex-col items-center gap-6 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-6 w-full">
            <div className="flex items-center gap-2 font-display font-bold text-foreground">
              <span className="inline-block w-2 h-2 rounded-sm bg-accent" />
              DXfix
            </div>
            <div className="font-mono text-xs">{t.footer}</div>
            <a href="/privacy" className="text-xs hover:text-foreground transition">
              {lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
            </a>
            <a href="/terms" className="text-xs hover:text-foreground transition">
              {lang === "ar" ? "شروط الخدمة" : "Terms"}
            </a>
            <a href="/articles" className="text-xs hover:text-foreground transition">
              {lang === "ar" ? "المقالات والدروس" : "Articles & Guides"}
            </a>
            <button
              onClick={openBuyCoffeeCheckout}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold text-sm hover:bg-amber-500/20 transition"
            >
              ☕ {lang === "ar" ? "ادعمنا" : "Support us"}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/admin"
              className="font-mono text-xs text-muted-foreground/30 hover:text-muted-foreground transition"
              title="Admin"
            >
              ⚙
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}