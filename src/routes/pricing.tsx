import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { openCheckout } from "@/lib/paddle";
import { ViralUnlockModal } from "@/components/viral-unlock-modal";
import { getUserSubscribed, setUserSubscribed } from "@/lib/viral-launch";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getLangDir, type Lang, type PlanItem } from "@/lib/i18n";
import { FREE_USAGE_LIMIT } from "@/lib/subscription";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "DXFix — خطط الأسعار والاشتراك | اشترك الآن لاستخدام الأداة" },
      { name: "description", content: "اختر خطة الاشتراك المناسبة لورشة CNC الخاصة بك. ابدأ مجاناً أو ادفع لكل ملف أو اشترك شهرياً لفتح جميع ميزات إصلاح DXF." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PricingPage,
});

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
  whySubscribe: string;
  whyDesc: string;
  features: string[];
}

const T: Record<Lang, LangContent> = {
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
        period: `${FREE_USAGE_LIMIT} استخدامات`,
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
        name: "لكل ملف",
        price: "$2",
        period: "لكل ملف",
        desc: "ادفع فقط عند الحاجة. كل ملف $2 — صالح لمدة 24 ساعة.",
        items: [
          "إصلاح وتحميل ملف DXF واحد",
          "حاسبة تكلفة القص التقديرية",
          "تصدير بصيغ SVG و PDF",
          "صالح لمدة 24 ساعة",
        ],
        cta: "ادفع $2 الآن",
        highlight: false,
        priceId: import.meta.env.VITE_PADDLE_PER_FILE_PRICE_ID || 'pri_per_file',
        badge: "مرن",
      },
      {
        name: "شهري",
        price: "$7",
        period: "/ شهر",
        desc: "للاستخدام المنتظم والشهري. اشتراك شهري بأسعار مناسبة للجميع.",
        items: [
          "إصلاح وتحميل ملفات DXF مصلحة",
          "حاسبة تكلفة القص التقديرية",
          "محاكاة حركة رأس الماكينة 3D",
          "تصدير بصيغ SVG و PDF",
        ],
        cta: "اشترك شهرياً",
        highlight: true,
        priceId: import.meta.env.VITE_PADDLE_PRO_PRICE_ID || 'pri_pro_monthly',
        badge: null,
      },
      {
        name: "مشغل",
        price: "$10",
        period: "/ شهر",
        desc: "لأصحاب ورش CNC المحترفين. مميزات متقدمة للورش الكبيرة.",
        items: [
          "جميع مميزات الباقة الشهرية",
          "معالجة جماعية للملفات (Bulk / Zip)",
          "ميزة الترتيب الذكي لتقليل الهدر (Nesting)",
          "دعم فني مخصص وأولوية في المعالجة",
        ],
        cta: "اشترك في المشغل",
        highlight: false,
        priceId: import.meta.env.VITE_PADDLE_WORKSHOP_PRICE_ID || 'pri_workshop_monthly',
        badge: null,
      },
    ],
    pricingNote: "* الدفع آمن عبر Paddle. يمكن الإلغاء في أي وقت. المبالغ بالدولار الأمريكي.",
    footer: "© 2026 DXFix. صُنع لورش التصنيع العربية.",
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
        period: `${FREE_USAGE_LIMIT} uses`,
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
        name: "Per File",
        price: "$2",
        period: "per file",
        desc: "Pay only when you need it. $2 per file — valid for 24 hours.",
        items: [
          "Repair & download one DXF file",
          "Cutting cost estimator",
          "Export to SVG and PDF",
          "Valid for 24 hours",
        ],
        cta: "Pay $2 now",
        highlight: false,
        priceId: import.meta.env.VITE_PADDLE_PER_FILE_PRICE_ID || 'pri_per_file',
        badge: "Flexible",
      },
      {
        name: "Monthly",
        price: "$7",
        period: "/ month",
        desc: "For regular monthly use. Affordable subscription for everyone.",
        items: [
          "Repair & download fixed DXF files",
          "Cutting cost estimator",
          "3D CNC toolpath simulation",
          "Export to SVG and PDF",
        ],
        cta: "Subscribe Monthly",
        highlight: true,
        priceId: import.meta.env.VITE_PADDLE_PRO_PRICE_ID || 'pri_pro_monthly',
        badge: null,
      },
      {
        name: "Workshop",
        price: "$10",
        period: "/ month",
        desc: "For professional CNC workshops. Advanced features for large shops.",
        items: [
          "All monthly plan features",
          "Bulk file processing (Bulk / Zip)",
          "Smart nesting optimization to reduce waste",
          "Dedicated support & priority processing",
        ],
        cta: "Subscribe Workshop",
        highlight: false,
        priceId: import.meta.env.VITE_PADDLE_WORKSHOP_PRICE_ID || 'pri_workshop_monthly',
        badge: null,
      },
    ],
    pricingNote: "* Payments secured by Paddle. Cancel anytime. Prices in USD.",
    footer: "© 2026 DXFix. Built for Arab manufacturing.",
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
  fr: {
    nav: "Retour au site",
    title: "Abonnement requis",
    subtitle: "Vous devez vous abonner d'abord pour utiliser l'outil de réparation et d'édition de fichiers CAD",
    badge: "Choisissez votre plan",
    sectionTitle: "Plans tarifaires",
    sectionDesc: "Plans transparents, sans surprises",
    plans: [
      {
        name: "Gratuit",
        price: "$0",
        period: `${FREE_USAGE_LIMIT} utilisations`,
        desc: "Parfait pour essayer ou une utilisation occasionnelle.",
        items: [
          "Aperçu visuel du fichier",
          "Rapport de détection des problèmes (sans réparation)",
          "Statistiques de base des entités",
        ],
        cta: "Commencer gratuit",
        highlight: false,
        priceId: null,
        badge: null,
      },
      {
        name: "Par fichier",
        price: "$2",
        period: "par fichier",
        desc: "Payez seulement quand vous en avez besoin. $2 par fichier — valable 24h.",
        items: [
          "Réparation et téléchargement d'un fichier DXF",
          "Estimateur de coût de coupe",
          "Export en SVG et PDF",
          "Valable 24 heures",
        ],
        cta: "Payer $2",
        highlight: false,
        priceId: import.meta.env.VITE_PADDLE_PER_FILE_PRICE_ID || 'pri_per_file',
        badge: "Flexible",
      },
      {
        name: "Mensuel",
        price: "$7",
        period: "/ mois",
        desc: "Pour une utilisation mensuelle régulière. Abonnement abordable pour tous.",
        items: [
          "Réparation et téléchargement des fichiers DXF",
          "Estimateur de coût de coupe",
          "Simulation 3D du parcours d'outil CNC",
          "Export en SVG et PDF",
        ],
        cta: "S'abonner mensuel",
        highlight: true,
        priceId: import.meta.env.VITE_PADDLE_PRO_PRICE_ID || 'pri_pro_monthly',
        badge: null,
      },
      {
        name: "Atelier",
        price: "$10",
        period: "/ mois",
        desc: "Pour les ateliers CNC professionnels. Fonctionnalités avancées pour les grands ateliers.",
        items: [
          "Toutes les fonctionnalités du plan mensuel",
          "Traitement par lots (Bulk / Zip)",
          "Optimisation intelligente du nesting",
          "Support dédié et traitement prioritaire",
        ],
        cta: "S'abonner Atelier",
        highlight: false,
        priceId: import.meta.env.VITE_PADDLE_WORKSHOP_PRICE_ID || 'pri_workshop_monthly',
        badge: null,
      },
    ],
    pricingNote: "* Paiements sécurisés par Paddle. Annulez à tout moment. Prix en USD.",
    footer: "© 2026 DXFix. Conçu pour la fabrication arabe.",
    whySubscribe: "Pourquoi s'abonner ?",
    whyDesc: "DXFix vous donne la possibilité de réparer, télécharger et éditer facilement des fichiers CAD (DXF). Abonnez-vous maintenant pour débloquer toutes les fonctionnalités.",
    features: [
      "Réparation automatique",
      "Score de préparation CNC",
      "Exportation instantanée",
      "Sans installation",
      "Interface en arabe",
      "Confidentialité totale",
    ],
  },
  zh: {
    nav: "返回网站",
    title: "需要订阅",
    subtitle: "您需要先订阅才能使用CAD文件上传、修复和编辑工具",
    badge: "选择您的计划",
    sectionTitle: "定价计划",
    sectionDesc: "透明计划，无隐藏费用",
    plans: [
      {
        name: "免费",
        price: "$0",
        period: `${FREE_USAGE_LIMIT}次使用`,
        desc: "非常适合试用或偶尔使用。",
        items: [
          "文件视觉预览",
          "问题检测报告（无修复）",
          "基本实体统计",
        ],
        cta: "免费开始",
        highlight: false,
        priceId: null,
        badge: null,
      },
      {
        name: "按文件",
        price: "$2",
        period: "每文件",
        desc: "只在需要时付费。每文件$2 — 24小时有效。",
        items: [
          "修复和下载一个DXF文件",
          "切割成本估算",
          "导出为SVG和PDF",
          "24小时有效",
        ],
        cta: "支付$2",
        highlight: false,
        priceId: import.meta.env.VITE_PADDLE_PER_FILE_PRICE_ID || 'pri_per_file',
        badge: "灵活",
      },
      {
        name: "月度",
        price: "$7",
        period: "/ 月",
        desc: "适合定期月度使用。适合所有人的实惠订阅。",
        items: [
          "修复和下载DXF文件",
          "切割成本估算",
          "3D CNC刀具路径模拟",
          "导出为SVG和PDF",
        ],
        cta: "订阅月度",
        highlight: true,
        priceId: import.meta.env.VITE_PADDLE_PRO_PRICE_ID || 'pri_pro_monthly',
        badge: null,
      },
      {
        name: "工坊",
        price: "$10",
        period: "/ 月",
        desc: "适合专业CNC工坊。大型工坊的高级功能。",
        items: [
          "所有月度计划功能",
          "批量文件处理（Bulk / Zip）",
          "智能嵌套优化以减少浪费",
          "专属支持和优先处理",
        ],
        cta: "订阅工坊",
        highlight: false,
        priceId: import.meta.env.VITE_PADDLE_WORKSHOP_PRICE_ID || 'pri_workshop_monthly',
        badge: null,
      },
    ],
    pricingNote: "* 支付由Paddle保护。随时取消。价格为美元。",
    footer: "© 2026 DXFix. 为阿拉伯制造业打造。",
    whySubscribe: "为什么要订阅？",
    whyDesc: "DXFix让您轻松修复、上传和编辑CAD（DXF）文件。立即订阅以解锁所有功能，开始节省时间和金钱。",
    features: [
      "自动修复",
      "CNC准备评分",
      "即时导出",
      "无需安装",
      "阿拉伯语界面",
      "默认私密",
    ],
  },
};

function PricingPage() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dxfix_lang") as Lang | null;
      if (stored && ["ar", "en", "fr", "zh"].includes(stored)) return stored;
    }
    return "ar";
  });
  const [redirectParam, setRedirectParam] = useState(false);
  const [showViralModal, setShowViralModal] = useState(false);
  const t = T[lang] || T.en;
  const isRTL = getLangDir(lang) === "rtl";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("redirect") === "tool") {
      setRedirectParam(true);
    }
  }, []);

  function handleLangChange(newLang: Lang) {
    setLang(newLang);
    localStorage.setItem("dxfix_lang", newLang);
    // Notify root shell to update html dir attribute
    window.dispatchEvent(new CustomEvent("dxfix-lang-change", { detail: newLang }));
  }

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
            <LanguageSwitcher currentLang={lang} onLangChange={handleLangChange} />
          </div>
        </div>
      </header>

      {/* REDIRECT BANNER */}
      {redirectParam && (
        <div className="bg-accent/10 border-b border-accent/30">
          <div className="max-w-6xl mx-auto px-5 py-4 text-center">
            <p className="text-accent font-semibold text-lg">
              {lang === "ar" ? "🔒 يجب الاشتراك أولاً لاستخدام أداة رفع وتعديل ملفات CAD" :
               lang === "en" ? "🔒 You must subscribe first to use the CAD file upload and editing tool" :
               lang === "fr" ? "🔒 Vous devez vous abonner d'abord pour utiliser l'outil de fichiers CAD" :
               "🔒 您需要先订阅才能使用CAD文件上传和编辑工具"}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {lang === "ar" ? "اختر إحدى الخطط أدناه للبدء فوراً" :
               lang === "en" ? "Choose a plan below to get started immediately" :
               lang === "fr" ? "Choisissez un plan ci-dessous pour commencer immédiatement" :
               "选择下面的计划立即开始"}
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

        {/* PRICING PLANS - FOUR COLUMNS */}
        <div className="mt-14">
          <div className="text-center mb-10">
            <p className="font-mono text-xs text-primary uppercase tracking-[0.25em]">{t.sectionTitle}</p>
            <h2 className="font-display mt-3 text-3xl sm:text-4xl font-bold">{t.sectionDesc}</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {t.plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-8 flex flex-col transition ${
                  plan.highlight
                    ? "border-accent/70 bg-gradient-to-br from-accent/10 to-card shadow-[var(--shadow-spark)] scale-105 md:scale-105"
                    : plan.name === "لكل ملف" || plan.name === "Per File" || plan.name === "Par fichier" || plan.name === "按文件"
                    ? "border-emerald-500/70 bg-gradient-to-br from-emerald-500/10 to-card"
                    : "border-border bg-card"
                }`}
              >
                {plan.highlight && (
                  <>
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent rounded-t-2xl" />
                    <span className="absolute -top-3 start-1/2 -translate-x-1/2 font-mono text-xs px-3 py-1 rounded-full bg-accent text-accent-foreground uppercase tracking-wider whitespace-nowrap">
                      {lang === "ar" ? "الأكثر طلباً" :
                       lang === "en" ? "Most popular" :
                       lang === "fr" ? "Le plus populaire" :
                       "最受欢迎"}
                    </span>
                  </>
                )}

                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 end-4">
                    <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                      ⭐ {plan.badge}
                    </span>
                  </div>
                )}

                <div>
                  <p className="font-display font-bold text-lg">
                    {plan.name}
                  </p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className={`font-display text-5xl font-bold ${
                      plan.highlight ? "text-gradient-spark" :
                      plan.name === "لكل ملف" || plan.name === "Per File" || plan.name === "Par fichier" || plan.name === "按文件" ? "text-emerald-400" :
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
                        plan.name === "لكل ملف" || plan.name === "Per File" || plan.name === "Par fichier" || plan.name === "按文件" ? "bg-emerald-500/20 text-emerald-400" :
                        "bg-primary/10 text-primary"
                      }`}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>

                {/* Free Plan: No download/repair - locked */}
                {(plan.name === "مجاني" || plan.name === "Free" || plan.name === "Gratuit" || plan.name === "免费") && (
                  <div className="mt-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-center">
                    <span className="text-xs text-yellow-400 font-mono">
                      🔒 {lang === "ar" ? "الإصلاح والتحميل مخصصان للمشتركين" :
                          lang === "en" ? "Repair & download for subscribers only" :
                          lang === "fr" ? "Réparation et téléchargement réservés aux abonnés" :
                          "仅限订阅者修复和下载"}
                    </span>
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
                          alert(lang === "ar" ? "عذراً، حدث خطأ. حاول مرة أخرى." :
                                lang === "en" ? "Sorry, an error occurred. Please try again." :
                                lang === "fr" ? "Désolé, une erreur s'est produite. Veuillez réessayer." :
                                "抱歉，发生错误。请重试。");
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
                      href="/tool"
                      className={`block w-full py-3.5 rounded-md font-semibold transition text-center border border-border hover:border-primary/60 hover:text-primary`}
                    >
                      {plan.cta} {isRTL ? "←" : "→"}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Lock icons for subscriber features */}
          <div className="mt-10 max-w-2xl mx-auto bg-card border border-border rounded-2xl p-6">
            <h3 className="font-display font-bold text-lg text-center mb-4">
              {lang === "ar" ? "🔒 الميزات الحصرية للمشتركين" :
               lang === "en" ? "🔒 Exclusive Subscriber Features" :
               lang === "fr" ? "🔒 Fonctionnalités exclusives aux abonnés" :
               "🔒 独家订阅功能"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <span className="text-accent">🔒</span>
                <span className="text-sm">{lang === "ar" ? "إصلاح وتحميل الملفات" :
                    lang === "en" ? "File repair & download" :
                    lang === "fr" ? "Réparation et téléchargement" :
                    "文件修复和下载"}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <span className="text-accent">🔒</span>
                <span className="text-sm">{lang === "ar" ? "محاكاة مسار الماكينة" :
                    lang === "en" ? "Toolpath simulation" :
                    lang === "fr" ? "Simulation de parcours" :
                    "刀具路径模拟"}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <span className="text-accent">🔒</span>
                <span className="text-sm">{lang === "ar" ? "تقدير تكلفة القص" :
                    lang === "en" ? "Cost estimator" :
                    lang === "fr" ? "Estimation des coûts" :
                    "成本估算"}</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <span className="text-accent">🔒</span>
                <span className="text-sm">{lang === "ar" ? "المعالجة الجماعية" :
                    lang === "en" ? "Bulk processing" :
                    lang === "fr" ? "Traitement par lots" :
                    "批量处理"}</span>
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
            {isRTL ? "←" : "→"} {lang === "ar" ? "العودة للصفحة الرئيسية" :
                lang === "en" ? "Back to homepage" :
                lang === "fr" ? "Retour à l'accueil" :
                "返回首页"}
          </a>
        </div>
      </main>

      {/* Viral Unlock Modal */}
      <ViralUnlockModal
        lang={lang}
        isOpen={showViralModal}
        onClose={() => setShowViralModal(false)}
        onUnlocked={() => {
          setUserSubscribed(true);
          setShowViralModal(false);
          window.location.href = '/tool';
        }}
      />

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