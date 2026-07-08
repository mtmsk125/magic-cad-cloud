import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { openCheckout } from "@/lib/paddle";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "DXFix — خطط الأسعار والاشتراك | اشترك الآن لاستخدام الأداة" },
      { name: "description", content: "اختر خطة الاشتراك المناسبة لورشة CNC الخاصة بك. ابدأ مجاناً أو اشترك في Pro أو Enterprise لفتح جميع ميزات إصلاح DXF." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PricingPage,
});

type Lang = "ar" | "en";

// Plan type to avoid TS literal comparison issues
interface PlanItem {
  name: string;
  price: string;
  period: string;
  desc: string;
  items: readonly string[];
  cta: string;
  highlight: boolean;
  priceId: string | null;
  badge: string | null;
  creditOption?: {
    label: string;
    price: string;
    per: string;
    desc: string;
  };
}

interface LangContent {
  nav: string;
  title: string;
  subtitle: string;
  badge: string;
  sectionTitle: string;
  sectionDesc: string;
  plans: PlanItem[];
  pricingNote: string;
  footer: string;
  langSwitch: string;
  whySubscribe: string;
  whyDesc: string;
  features: string[];
}

const T: { ar: LangContent; en: LangContent } = {
  ar: {
    nav: "العودة للموقع",
    title: "اشتراك مطلوب",
    subtitle: "يجب الاشتراك أولاً لاستخدام أداة إصلاح ورفع وتعديل ملفات CAD",
    badge: "اختر خطتك",
    sectionTitle: "خطط الأسعار",
    sectionDesc: "خطط شفافة بدون مفاجآت",
    plans: [
      {
        name: "مجاني",
        price: "$0",
        period: "للأبد",
        desc: "مثالي للتجربة والاستخدام الخفيف.",
        items: [
          "معاينة بصرية للملف",
          "تقرير بالمشاكل المكتشفة (دون إصلاح)",
          "إحصائيات العناصر الأساسية",
        ],
        cta: "ابدأ مجاناً",
        highlight: false,
        priceId: null,
        badge: null,
      },
      {
        name: "Pro",
        price: "$19",
        period: "/ شهر",
        desc: "للمشغّل اليومي الذي يرفع ملفات باستمرار.",
        items: [
          "إصلاح وتحميل ملفات DXF مصلحة",
          "حاسبة تكلفة القص التقديرية",
          "محاكاة حركة رأس الماكينة 3D",
          "تصدير بصيغ SVG و PDF",
        ],
        cta: "اشترك في Pro",
        highlight: true,
        priceId: import.meta.env.VITE_PADDLE_PRO_PRICE_ID || 'pri_pro_monthly',
        badge: null,
        creditOption: {
          label: "أو ادفع لكل ملف — رصيد ائتماني",
          price: "$5",
          per: "لكل ملف",
          desc: "لا تريد اشتراكاً شهرياً؟ اشتر رصيداً مدفوعاً مسبقاً لتنزيل الملفات المصلحة بشكل فردي.",
        },
      },
      {
        name: "Enterprise",
        price: "$49",
        period: "/ شهر",
        desc: "للمصانع والورش الكبيرة التي تحتاج معالجة جماعية.",
        items: [
          "معالجة جماعية للملفات (Bulk / Zip processing)",
          "ميزة الترتيب الذكي لتقليل الهدر (Nesting Optimization)",
          "التدمير الذاتي وحذف الملفات الفوري للسرية المطلقة",
        ],
        cta: "تواصل معنا",
        highlight: false,
        priceId: null,
        badge: "حماية صارمة للبيانات - متوافق مع معايير المصانع",
      },
    ],
    pricingNote: "* الدفع آمن عبر Paddle. يمكن الإلغاء في أي وقت. المبالغ بالدولار الأمريكي.",
    footer: "© 2026 DXFix. صُنع لورش التصنيع العربية.",
    langSwitch: "EN",
    whySubscribe: "لماذا الاشتراك؟",
    whyDesc: "أداة DXFix تمنحك إمكانية إصلاح ورفع وتعديل ملفات CAD (DXF) بسهولة. اشترك الآن لفتح جميع الميزات والبدء في توفير الوقت والمال.",
    features: [
      "إصلاح تلقائي للمشاكل",
      "تقييم جاهزية CNC",
      "تصدير فوري",
      "بدون تثبيت",
      "واجهة بالعربي",
      "خصوصية كاملة",
    ],
  },
  en: {
    nav: "Back to site",
    title: "Subscription Required",
    subtitle: "You need to subscribe first to use the CAD file upload, repair and editing tool",
    badge: "Choose your plan",
    sectionTitle: "Pricing Plans",
    sectionDesc: "Transparent plans, no surprises",
    plans: [
      {
        name: "Free",
        price: "$0",
        period: "forever",
        desc: "Perfect for trying it out or occasional use.",
        items: [
          "Visual file preview",
          "Issue detection report (no repair)",
          "Basic entity statistics",
        ],
        cta: "Start free",
        highlight: false,
        priceId: null,
        badge: null,
      },
      {
        name: "Pro",
        price: "$19",
        period: "/ month",
        desc: "For the daily operator who uploads files constantly.",
        items: [
          "Repair & download fixed DXF files",
          "Cutting cost estimator",
          "3D CNC toolpath simulation",
          "Export to SVG and PDF",
        ],
        cta: "Subscribe to Pro",
        highlight: true,
        priceId: import.meta.env.VITE_PADDLE_PRO_PRICE_ID || 'pri_pro_monthly',
        badge: null,
        creditOption: {
          label: "Or pay per file — Credit-based downloads",
          price: "$5",
          per: "per file",
          desc: "Don't want a monthly subscription? Purchase pre-paid credits to download individual fixed files.",
        },
      },
      {
        name: "Enterprise",
        price: "$49",
        period: "/ month",
        desc: "For factories and large shops needing bulk processing.",
        items: [
          "Bulk file processing (Bulk / Zip processing)",
          "Smart nesting optimization to reduce waste",
          "Self-destruct & instant file deletion for confidentiality",
        ],
        cta: "Contact Us",
        highlight: false,
        priceId: null,
        badge: "Strict data protection - Compliant with factory standards",
      },
    ],
    pricingNote: "* Payments secured by Paddle. Cancel anytime. Prices in USD.",
    footer: "© 2026 DXFix. Built for Arab manufacturing.",
    langSwitch: "العربية",
    whySubscribe: "Why subscribe?",
    whyDesc: "DXFix gives you the ability to easily repair, upload and edit CAD (DXF) files. Subscribe now to unlock all features and start saving time and money.",
    features: [
      "Auto repair",
      "CNC readiness score",
      "Instant export",
      "No install",
      "Arabic-first UI",
      "Private by default",
    ],
  },
};

function PricingPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const [redirectParam, setRedirectParam] = useState(false);
  const t = T[lang];
  const isRTL = lang === "ar";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("redirect") === "tool") {
      setRedirectParam(true);
    }
  }, []);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/60">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent" />
            DX<span className="text-accent">fix</span>
          </a>
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition">
              {isRTL ? "←" : "→"} {t.nav}
            </a>
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="font-mono text-xs px-3 py-1.5 rounded-md border border-border hover:border-primary/60 transition"
            >
              {t.langSwitch}
            </button>
          </div>
        </div>
      </header>

      {/* REDIRECT BANNER */}
      {redirectParam && (
        <div className="bg-accent/10 border-b border-accent/30">
          <div className="max-w-6xl mx-auto px-5 py-4 text-center">
            <p className="text-accent font-semibold text-lg">
              {lang === "ar" ? "🔒 يجب الاشتراك أولاً لاستخدام أداة رفع وتعديل ملفات CAD" : "🔒 You must subscribe first to use the CAD file upload and editing tool"}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {lang === "ar" ? "اختر إحدى الخطط أدناه للبدء فوراً" : "Choose a plan below to get started immediately"}
            </p>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-5 py-12">
        {/* HEADER */}
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-full border border-accent/40 text-accent bg-accent/5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            {t.badge}
          </span>
          <h1 className="font-display mt-6 text-4xl sm:text-5xl font-bold">{t.title}</h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">{t.subtitle}</p>
        </div>

        {/* WHY SUBSCRIBE */}
        <div className="mt-10 bg-card border border-border rounded-2xl p-8 max-w-3xl mx-auto">
          <h2 className="font-display text-2xl font-bold text-center">{t.whySubscribe}</h2>
          <p className="mt-3 text-muted-foreground text-center">{t.whyDesc}</p>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {t.features.map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-sm text-foreground/90">
                <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs flex-shrink-0">✓</span>
                {feat}
              </div>
            ))}
          </div>
        </div>

        {/* PRICING PLANS - THREE COLUMNS */}
        <div className="mt-14">
          <div className="text-center mb-10">
            <p className="font-mono text-xs text-primary uppercase tracking-[0.25em]">{t.sectionTitle}</p>
            <h2 className="font-display mt-3 text-3xl sm:text-4xl font-bold">{t.sectionDesc}</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {t.plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-8 flex flex-col transition ${
                  plan.highlight
                    ? "border-accent/70 bg-gradient-to-br from-accent/10 to-card shadow-[var(--shadow-spark)] scale-105 md:scale-105"
                    : plan.name === "Enterprise" || plan.name === "باقة الشركات"
                    ? "border-purple-500/70 bg-gradient-to-br from-purple-500/10 to-card shadow-[var(--shadow-elegant)]"
                    : "border-border bg-card"
                }`}
              >
                {plan.highlight && (
                  <>
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent rounded-t-2xl" />
                    <span className="absolute -top-3 start-1/2 -translate-x-1/2 font-mono text-xs px-3 py-1 rounded-full bg-accent text-accent-foreground uppercase tracking-wider whitespace-nowrap">
                      {lang === "ar" ? "الأكثر طلباً" : "Most popular"}
                    </span>
                  </>
                )}

                {/* Enterprise badge */}
                {plan.badge && (
                  <div className="absolute -top-3 end-4">
                    <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 whitespace-nowrap">
                      🛡 {plan.badge}
                    </span>
                  </div>
                )}

                <div>
                  <p className="font-display font-bold text-lg">
                    {plan.name === "Enterprise" && !isRTL ? "Enterprise" : plan.name}
                    {plan.name === "باقة الشركات" ? "باقة الشركات" : ""}
                    {plan.name === "Enterprise" && isRTL ? "باقة الشركات" : ""}
                    {plan.name === "مجاني" ? "مجاني" : ""}
                    {plan.name === "Free" ? "Free" : ""}
                    {plan.name === "Pro" ? "Pro" : ""}
                  </p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className={`font-display text-5xl font-bold ${
                      plan.highlight ? "text-gradient-spark" :
                      plan.name === "Enterprise" || plan.name === "باقة الشركات" ? "text-purple-400" :
                      "text-foreground"
                    }`}>{plan.price}</span>
                    <span className="text-muted-foreground/80 font-mono text-sm">{plan.period}</span>
                  </div>
                  <p className="mt-3 text-sm text-foreground/80">{plan.desc}</p>
                </div>

                <ul className="mt-7 space-y-3 flex-1">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-foreground/90">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                        plan.highlight ? "bg-accent/20 text-accent" :
                        plan.name === "Enterprise" || plan.name === "باقة الشركات" ? "bg-purple-500/20 text-purple-400" :
                        "bg-primary/10 text-primary"
                      }`}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>

                {/* Free Plan: No download/repair - locked */}
                {(plan.name === "مجاني" || plan.name === "Free") && (
                  <div className="mt-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-center">
                    <span className="text-xs text-yellow-400 font-mono">
                      🔒 {lang === "ar" ? "الإصلاح والتحميل مخصصان للمشتركين" : "Repair & download for subscribers only"}
                    </span>
                  </div>
                )}

                {/* Pro Credit Option */}
                {plan.creditOption && (
                  <div className="mt-4 p-4 rounded-xl border border-accent/20 bg-accent/5">
                    <p className="text-xs font-semibold text-accent mb-2">{plan.creditOption.label}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-2xl font-bold text-accent">{plan.creditOption.price}</span>
                      <span className="font-mono text-xs text-muted-foreground">{plan.creditOption.per}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{plan.creditOption.desc}</p>
                  </div>
                )}

                <div className="mt-8">
                  {plan.priceId ? (
                    <button
                      onClick={() => {
                        try {
                          console.log("Clicked checkout button for plan:", plan.name, "with priceId:", plan.priceId);
                          if (!plan.priceId) {
                            throw new Error("Price ID is not defined for this plan");
                          }
                          openCheckout(plan.priceId);
                        } catch (error) {
                          console.error("Checkout error:", error);
                          alert(lang === "ar" ? "عذراً، حدث خطأ. حاول مرة أخرى." : "Sorry, an error occurred. Please try again.");
                        }
                      }}
                      className={`w-full py-3.5 rounded-md font-semibold transition cursor-pointer ${
                        plan.highlight
                          ? "bg-accent text-accent-foreground hover:opacity-90 shadow-[var(--shadow-spark)]"
                          : "border border-border hover:border-primary/60 hover:text-primary"
                      }`}
                    >
                      {plan.cta} {isRTL ? "←" : "→"}
                    </button>
                  ) : (
                    <a
                      href={plan.name === "Enterprise" || plan.name === "باقة الشركات" ? "mailto:enterprise@dxfix.app" : "/tool"}
                      className={`block w-full py-3.5 rounded-md font-semibold transition text-center ${
                        plan.name === "Enterprise" || plan.name === "باقة الشركات"
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30"
                          : "border border-border hover:border-primary/60 hover:text-primary"
                      }`}
                    >
                      {plan.cta} {isRTL ? "←" : "→"}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Lock icons for Pro/Enterprise features description */}
          <div className="mt-10 max-w-2xl mx-auto bg-card border border-border rounded-2xl p-6">
            <h3 className="font-display font-bold text-lg text-center mb-4">
              {lang === "ar" ? "🔒 الميزات الحصرية للمشتركين" : "🔒 Exclusive Subscriber Features"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <span className="text-accent">🔒</span>
                <span className="text-sm">{lang === "ar" ? "إصلاح وتحميل الملفات" : "File repair & download"}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <span className="text-accent">🔒</span>
                <span className="text-sm">{lang === "ar" ? "محاكاة مسار الماكينة" : "Toolpath simulation"}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <span className="text-accent">🔒</span>
                <span className="text-sm">{lang === "ar" ? "تقدير تكلفة القص" : "Cost estimator"}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <span className="text-accent">🔒</span>
                <span className="text-sm">{lang === "ar" ? "المعالجة الجماعية" : "Bulk processing"}</span>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground font-mono">{t.pricingNote}</p>
        </div>

        {/* BACK TO HOME */}
        <div className="mt-16 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition font-semibold"
          >
            {isRTL ? "←" : "→"} {lang === "ar" ? "العودة للصفحة الرئيسية" : "Back to homepage"}
          </a>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border/60 mt-12">
        <div className="max-w-6xl mx-auto px-5 py-10 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 font-display font-bold text-foreground mb-2">
            <span className="inline-block w-2 h-2 rounded-sm bg-accent" />
            DXfix
          </div>
          <div className="font-mono text-xs">{t.footer}</div>
        </div>
      </footer>
    </div>
  );
}