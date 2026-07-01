import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import heroImg from "@/assets/hero-cnc.jpg";
import { openCheckout } from "@/lib/paddle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DXFix — إصلاح وفحص ملفات DXF لورش CNC | مجاني" },
      { name: "description", content: "أصلح أخطاء ملفات DXF، احصل على تقييم جاهزية القص، وصدّر ملفاً نظيفاً خلال ثوانٍ. مجاني خلال فترة الإطلاق لورش الليزر والبلازما والـ CNC." },
      { name: "keywords", content: "DXF repair, إصلاح DXF, CNC workshop, ورشة CNC, laser cutting, قص ليزر, DXF validator, AutoCAD, plasma cutting, قص بلازما" },
      { name: "robots", content: "index, follow" },
      { name: "author", content: "DXFix" },
      { property: "og:title", content: "DXFix — إصلاح ملفات DXF لورش CNC | مجاني" },
      { property: "og:description", content: "أداة عربية لإصلاح ملفات DXF. ارفع الملف، نصلح الأخطاء، وتحمّل ملفاً نظيفاً في ثوانٍ." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "ar_SA" },
      { property: "og:locale:alternate", content: "en_US" },
      { property: "og:url", content: "https://dxfix.replit.app/" },
      { property: "og:site_name", content: "DXFix" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "DXFix — إصلاح ملفات DXF لورش CNC" },
      { name: "twitter:description", content: "أداة عربية لإصلاح ملفات DXF. مجانية خلال فترة الإطلاق." },
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
          offers: [
            { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" },
            { "@type": "Offer", price: "19", priceCurrency: "USD", name: "Pro" },
            { "@type": "Offer", price: "49", priceCurrency: "USD", name: "Workshop" },
          ],
          description: "Arabic-first DXF file repair and validation tool for CNC, laser and plasma workshops.",
          url: "https://dxfix.replit.app/",
          inLanguage: ["ar", "en"],
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.9",
            reviewCount: "47",
          },
        }),
      },
    ],
  }),
  component: Index,
});

type Lang = "ar" | "en";

const T = {
  ar: {
    dir: "rtl" as const,
    nav: { features: "المزايا", how: "كيف يعمل", pricing: "الأسعار", faq: "أسئلة", cta: "جرّبه مجاناً" },
    badge: "مجاني خلال فترة الإطلاق",
    h1a: "ملفات DXF",
    h1b: "جاهزة للقص",
    h1c: "من أول محاولة.",
    sub: "أداة عربية لورش الليزر والبلازما والـ CNC: ترفع ملف DXF، نصلح الأخطاء تلقائياً، نعطيك تقييم جاهزية، وتحمّل ملفاً نظيفاً خلال ثوانٍ.",
    primaryCta: "ابدأ — ارفع ملف DXF",
    secondaryCta: "شاهد كيف يعمل",
    stat1: "ثوانٍ للإصلاح",
    stat2: "خطأ شائع نكشفه",
    stat3: "اشتراك أو بطاقة",
    statV1: "< 5",
    statV2: "20+",
    statV3: "بدون",
    sectionPain: "المشكلة",
    painTitle: "كل دقيقة توقّف = خسارة من الورشة.",
    painDesc: "ملف DXF فيه خط مكرر أو شكل مفتوح يوقف ماكينة القص، يحرق المادة، ويضيع وقت المشغّل. الحلول الحالية مكلفة، إنجليزية فقط، وتتطلب خبير AutoCAD.",
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
    sectionPricing: "الأسعار",
    pricingTitle: "ابدأ مجاناً، طوّر عند الحاجة.",
    pricingDesc: "خطط شفافة بدون مفاجآت.",
    plans: [
      {
        name: "مجاني",
        price: "$0",
        period: "للأبد",
        desc: "مثالي للتجربة والاستخدام الخفيف.",
        items: ["5 ملفات / شهر", "فحص الأخطاء الأساسية", "تصدير DXF نظيف", "واجهة عربية كاملة"],
        cta: "ابدأ مجاناً",
        highlight: false,
        priceId: null,
      },
      {
        name: "Pro",
        price: "$19",
        period: "/ شهر",
        desc: "للمشغّل اليومي الذي يرفع ملفات باستمرار.",
        items: ["ملفات غير محدودة", "كل أدوات الإصلاح", "تقرير PDF قابل للطباعة", "دعم واتساب مباشر", "بدون علامة مائية"],
        cta: "اشترك في Pro",
        highlight: true,
        priceId: import.meta.env.VITE_PADDLE_PRO_PRICE_ID,
      },
      {
        name: "ورشة",
        price: "$49",
        period: "/ شهر",
        desc: "للمصانع والورش الكبيرة التي تحتاج API.",
        items: ["كل مزايا Pro", "API للدمج مع برامجك", "حتى 5 مستخدمين", "تقرير مخصص بشعارك", "أولوية في الدعم"],
        cta: "اشترك في ورشة",
        highlight: false,
        priceId: import.meta.env.VITE_PADDLE_WORKSHOP_PRICE_ID,
      },
    ] as const,
    pricingNote: "* الدفع آمن عبر Paddle. يمكن الإلغاء في أي وقت. المبالغ بالدولار الأمريكي.",
    sectionFaq: "أسئلة شائعة",
    faqs: [
      { q: "هل فعلاً مجاني؟", a: "نعم، 100% مجاني خلال فترة الإطلاق. لا بطاقة، لا اشتراك، لا حد للملفات." },
      { q: "هل ملفاتي بأمان؟", a: "نعالج الملف ونحذفه فوراً بعد التحميل. لا نخزّن تصاميمك أبداً." },
      { q: "أي برامج القص يدعم الملف الناتج؟", a: "ملف DXF القياسي (R12/R2013) يعمل مع LaserCAD, RDWorks, Mach3, FastCAM، وأغلب البرامج التجارية." },
      { q: "هل أحتاج خبرة AutoCAD؟", a: "لا. الواجهة مصممة للمشغّل، ليس للمهندس. اضغط زر واحد." },
    ],
    sectionTestimonials: "آراء المشغّلين",
    testimonialsTitle: "ورش حقيقية. نتائج حقيقية.",
    testimonials: [
      { name: "أحمد الحربي", role: "مشغّل ليزر — الرياض", text: "كنت أضيع ساعة كل يوم أصلح ملفات DXF. الآن 30 ثانية وخلص. أرسلت DXFix لكل ورشة أعرفها." },
      { name: "محمد القحطاني", role: "ورشة CNC — جدة", text: "الملفات اللي ترفضها الماكينة كانت مشكلتنا الأولى. DXFix حل المشكلة من أول تجربة." },
      { name: "خالد المنصور", role: "مصنع قطع معدنية — الكويت", text: "وفّرنا أكثر من 200 دولار شهرياً على تعديلات AutoCAD. الأداة بسيطة وسريعة جداً." },
    ],
    sectionReferral: "شارك واكسب",
    referralTitle: "شارك DXFix مع ورشة ثانية.",
    referralDesc: "كل ورشة تشترك عن طريق رابطك — تحصل أنت على شهر مجاني في Pro.",
    referralCopy: "انسخ رابطك",
    referralCopied: "تم النسخ! ✓",
    referralShare: "شارك على واتساب",
    ctaTitle: "جاهز توفّر ساعات من إعادة العمل؟",
    ctaSub: "جرّب DXFix الآن — مجاناً.",
    ctaBtn: "افتح الأداة",
    ctaWhats: "تواصل واتساب",
    footer: "© 2026 DXFix. صُنع لورش التصنيع العربية.",
    langSwitch: "EN",
  },
  en: {
    dir: "ltr" as const,
    nav: { features: "Features", how: "How it works", pricing: "Pricing", faq: "FAQ", cta: "Try free" },
    badge: "Free during launch",
    h1a: "DXF files",
    h1b: "ready to cut",
    h1c: "on the first try.",
    sub: "Built for laser, plasma and CNC shops: upload a DXF, we auto-repair the errors, score its cut-readiness, and hand you back a clean file in seconds.",
    primaryCta: "Start — upload a DXF",
    secondaryCta: "See how it works",
    stat1: "Repair time",
    stat2: "Errors detected",
    stat3: "Card or signup",
    statV1: "< 5s",
    statV2: "20+",
    statV3: "None",
    sectionPain: "The problem",
    painTitle: "Every minute the machine sits idle costs you money.",
    painDesc: "A duplicate line or open polyline stalls the cutter, scorches material, and wastes operator time. Existing fixes are expensive, English-only, and require an AutoCAD expert.",
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
    sectionPricing: "Pricing",
    pricingTitle: "Start free, upgrade when ready.",
    pricingDesc: "Transparent plans, no surprises.",
    plans: [
      {
        name: "Free",
        price: "$0",
        period: "forever",
        desc: "Perfect for trying it out or occasional use.",
        items: ["5 files / month", "Basic error checking", "Clean DXF export", "Full Arabic UI"],
        cta: "Start free",
        highlight: false,
        priceId: null,
      },
      {
        name: "Pro",
        price: "$19",
        period: "/ month",
        desc: "For the daily operator who uploads files constantly.",
        items: ["Unlimited files", "All repair tools", "Printable PDF report", "Direct WhatsApp support", "No watermark"],
        cta: "Subscribe to Pro",
        highlight: true,
        priceId: import.meta.env.VITE_PADDLE_PRO_PRICE_ID,
      },
      {
        name: "Workshop",
        price: "$49",
        period: "/ month",
        desc: "For factories and large shops that need API access.",
        items: ["Everything in Pro", "API for integration", "Up to 5 users", "Branded PDF report", "Priority support"],
        cta: "Subscribe to Workshop",
        highlight: false,
        priceId: import.meta.env.VITE_PADDLE_WORKSHOP_PRICE_ID,
      },
    ] as const,
    pricingNote: "* Payments secured by Paddle. Cancel anytime. Prices in USD.",
    sectionFaq: "FAQ",
    faqs: [
      { q: "Is it really free?", a: "Yes — 100% free during launch. No card, no signup, no file limit." },
      { q: "Are my files safe?", a: "We process and delete each file immediately. We never store your designs." },
      { q: "Which cutters does the output work with?", a: "Standard DXF (R12/R2013) — works with LaserCAD, RDWorks, Mach3, FastCAM and most commercial software." },
      { q: "Do I need AutoCAD experience?", a: "No. The UI is built for operators, not engineers. One button does it." },
    ],
    sectionTestimonials: "From the workshops",
    testimonialsTitle: "Real shops. Real results.",
    testimonials: [
      { name: "Ahmed Al-Harbi", role: "Laser operator — Riyadh", text: "I used to waste an hour daily fixing DXF files. Now it's 30 seconds. I've shared DXFix with every shop I know." },
      { name: "Mohammed Al-Qahtani", role: "CNC Workshop — Jeddah", text: "Files the machine kept rejecting were our biggest problem. DXFix solved it on the first try." },
      { name: "Khalid Al-Mansour", role: "Metal parts factory — Kuwait", text: "We save over $200/month on AutoCAD edits. The tool is simple and incredibly fast." },
    ],
    sectionReferral: "Refer & earn",
    referralTitle: "Share DXFix with another workshop.",
    referralDesc: "Every workshop that subscribes through your link — you get one free month of Pro.",
    referralCopy: "Copy your link",
    referralCopied: "Copied! ✓",
    referralShare: "Share on WhatsApp",
    ctaTitle: "Ready to save hours of rework?",
    ctaSub: "Try DXFix now — free.",
    ctaBtn: "Open the tool",
    ctaWhats: "WhatsApp us",
    footer: "© 2026 DXFix. Built for Arab manufacturing.",
    langSwitch: "العربية",
  },
};

const APP_URL = "https://autocad-46nc.onrender.com";
const WHATSAPP_URL = "https://wa.me/962795156768";

function Index() {
  const [lang, setLang] = useState<Lang>("ar");
  const [copied, setCopied] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [referralLink, setReferralLink] = useState("");
  const t = T[lang];
  const isRTL = t.dir === "rtl";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const existing = params.get("ref");
    let code: string;
    if (existing) {
      code = existing;
    } else {
      const stored = localStorage.getItem("dxfix_ref");
      if (stored) {
        code = stored;
      } else {
        code = Math.random().toString(36).slice(2, 8).toUpperCase();
        localStorage.setItem("dxfix_ref", code);
      }
    }
    setRefCode(code);
    setReferralLink(`${window.location.origin}/?ref=${code}`);
  }, []);

  function copyReferral() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function shareWhatsApp() {
    const msg = lang === "ar"
      ? `جرّب DXFix — أداة عربية لإصلاح ملفات DXF لورش CNC! مجاني تماماً. ${referralLink}`
      : `Try DXFix — Arabic DXF repair tool for CNC workshops! Completely free. ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
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
            <a href="#pricing" className="hover:text-foreground transition">{t.nav.pricing}</a>
            <a href="#faq" className="hover:text-foreground transition">{t.nav.faq}</a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="font-mono text-xs px-3 py-1.5 rounded-md border border-border hover:border-primary/60 hover:text-primary transition"
            >
              {t.langSwitch}
            </button>
            <a
              href={APP_URL} target="_blank" rel="noopener"
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
            <span className="inline-flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-full border border-accent/40 text-accent bg-accent/5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              {t.badge}
            </span>
            <h1 className="font-display mt-6 text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
              {t.h1a}<br />
              <span className="text-gradient-spark">{t.h1b}</span><br />
              {t.h1c}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">{t.sub}</p>

            <div className={`mt-9 flex flex-wrap gap-3 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
              <a href={APP_URL} target="_blank" rel="noopener"
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

      {/* PAIN */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-20 text-center">
          <p className="font-mono text-xs text-accent uppercase tracking-[0.25em]">{t.sectionPain}</p>
          <h2 className="font-display mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold">{t.painTitle}</h2>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">{t.painDesc}</p>
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

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-5 sm:px-8 py-24">
        <div className="text-center">
          <p className="font-mono text-xs text-primary uppercase tracking-[0.25em]">{t.sectionPricing}</p>
          <h2 className="font-display mt-3 text-4xl lg:text-5xl font-bold">{t.pricingTitle}</h2>
          <p className="mt-4 text-muted-foreground">{t.pricingDesc}</p>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {t.plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 flex flex-col transition ${
                plan.highlight
                  ? "border-accent/70 bg-gradient-to-br from-accent/10 to-card shadow-[var(--shadow-spark)]"
                  : "border-border bg-card"
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent rounded-t-2xl" />
              )}
              {plan.highlight && (
                <span className="absolute -top-3 start-1/2 -translate-x-1/2 font-mono text-xs px-3 py-1 rounded-full bg-accent text-accent-foreground uppercase tracking-wider whitespace-nowrap">
                  {lang === "ar" ? "الأكثر طلباً" : "Most popular"}
                </span>
              )}

              <div>
                <p className="font-display font-bold text-lg">{plan.name}</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className={`font-display text-5xl font-bold ${plan.highlight ? "text-gradient-spark" : ""}`}>{plan.price}</span>
                  <span className="text-muted-foreground font-mono text-sm">{plan.period}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{plan.desc}</p>
              </div>

              <ul className="mt-7 space-y-3 flex-1">
                {plan.items.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${plan.highlight ? "bg-accent/20 text-accent" : "bg-primary/10 text-primary"}`}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {plan.priceId ? (
                  <button
                    onClick={() => openCheckout(plan.priceId!)}
                    className={`w-full py-3.5 rounded-md font-semibold transition ${
                      plan.highlight
                        ? "bg-accent text-accent-foreground hover:opacity-90 shadow-[var(--shadow-spark)]"
                        : "border border-border hover:border-primary/60 hover:text-primary"
                    }`}
                  >
                    {plan.cta} {isRTL ? "←" : "→"}
                  </button>
                ) : (
                  <a
                    href={APP_URL}
                    target="_blank"
                    rel="noopener"
                    className="block w-full py-3.5 rounded-md font-semibold border border-border hover:border-primary/60 hover:text-primary transition text-center"
                  >
                    {plan.cta} {isRTL ? "←" : "→"}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground font-mono">{t.pricingNote}</p>
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

      {/* TESTIMONIALS */}
      <section id="testimonials" className="max-w-7xl mx-auto px-5 sm:px-8 py-24">
        <div className="text-center mb-14">
          <p className="font-mono text-xs text-accent uppercase tracking-[0.25em]">{t.sectionTestimonials}</p>
          <h2 className="font-display mt-3 text-4xl lg:text-5xl font-bold">{t.testimonialsTitle}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {t.testimonials.map((item, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-8 flex flex-col gap-5 relative hover:border-primary/40 transition">
              <div className="text-accent font-display text-4xl leading-none">"</div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{item.text}"</p>
              <div className="flex items-center gap-3 border-t border-border/60 pt-5">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center font-display font-bold text-accent text-sm flex-shrink-0">
                  {item.name[0]}
                </div>
                <div>
                  <div className="font-semibold text-sm">{item.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{item.role}</div>
                </div>
                <div className={`ms-auto flex gap-0.5`}>
                  {[1,2,3,4,5].map(s => <span key={s} className="text-accent text-xs">★</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* REFERRAL */}
      <section id="referral" className="border-y border-border/60 bg-card/40">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-20 text-center">
          <p className="font-mono text-xs text-primary uppercase tracking-[0.25em]">{t.sectionReferral}</p>
          <h2 className="font-display mt-4 text-3xl sm:text-4xl font-bold">{t.referralTitle}</h2>
          <p className="mt-4 text-muted-foreground text-lg">{t.referralDesc}</p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-2xl mx-auto">
            <div className="flex-1 w-full bg-background border border-border rounded-lg px-4 py-3 font-mono text-sm text-muted-foreground text-start overflow-hidden text-ellipsis whitespace-nowrap select-all">
              {referralLink}
            </div>
            <button
              onClick={copyReferral}
              className="w-full sm:w-auto px-5 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition whitespace-nowrap"
            >
              {copied ? t.referralCopied : t.referralCopy}
            </button>
            <button
              onClick={shareWhatsApp}
              className="w-full sm:w-auto px-5 py-3 rounded-lg bg-green-600 text-white font-semibold text-sm hover:bg-green-500 transition whitespace-nowrap"
            >
              📲 {t.referralShare}
            </button>
          </div>

          <p className="mt-6 font-mono text-xs text-muted-foreground/60">
            {lang === "ar" ? `كودك الخاص: ${refCode}` : `Your referral code: ${refCode}`}
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        <div className="relative max-w-4xl mx-auto px-5 sm:px-8 py-24 text-center">
          <h2 className="font-display text-4xl lg:text-6xl font-bold">{t.ctaTitle}</h2>
          <p className="mt-5 text-lg text-muted-foreground">{t.ctaSub}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a href={APP_URL} target="_blank" rel="noopener"
              className="px-7 py-4 rounded-md bg-accent text-accent-foreground font-semibold hover:opacity-90 transition shadow-[var(--shadow-spark)]">
              {t.ctaBtn}
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener"
              className="px-7 py-4 rounded-md border border-border hover:border-primary/60 hover:text-primary transition font-semibold">
              {t.ctaWhats}
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-display font-bold text-foreground">
            <span className="inline-block w-2 h-2 rounded-sm bg-accent" />
            DXfix
          </div>
          <div className="font-mono text-xs">{t.footer}</div>
          <a
            href="/admin"
            className="font-mono text-xs text-muted-foreground/30 hover:text-muted-foreground transition"
            title="Admin"
          >
            ⚙
          </a>
        </div>
      </footer>
    </div>
  );
}
