/**
 * Internationalization (i18n) System
 * Supports: العربية (ar), English (en), Français (fr), 中文 (zh)
 */

export type Lang = "ar" | "en" | "fr" | "zh";

export const LANGS: { code: Lang; name: string; dir: "rtl" | "ltr" }[] = [
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "en", name: "English", dir: "ltr" },
  { code: "fr", name: "Français", dir: "ltr" },
  { code: "zh", name: "中文", dir: "ltr" },
];

export function getLangDir(lang: Lang): "rtl" | "ltr" {
  return LANGS.find(l => l.code === lang)?.dir || "ltr";
}

export function getLangName(lang: Lang): string {
  return LANGS.find(l => l.code === lang)?.name || lang;
}

export interface NavTranslations {
  features: string;
  how: string;
  pricing: string;
  faq: string;
  cta: string;
}

export interface PlanItem {
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

export interface Translations {
  dir: "rtl" | "ltr";
  nav: NavTranslations;
  badge: string;
  h1a: string;
  h1b: string;
  h1c: string;
  sub: string;
  primaryCta: string;
  secondaryCta: string;
  stat1: string;
  stat2: string;
  stat3: string;
  statV1: string;
  statV2: string;
  statV3: string;
  sectionPain: string;
  painTitle: string;
  painDesc: string;
  sectionFeatures: string;
  f1t: string;
  f1d: string;
  f2t: string;
  f2d: string;
  f3t: string;
  f3d: string;
  f4t: string;
  f4d: string;
  f5t: string;
  f5d: string;
  f6t: string;
  f6d: string;
  sectionHow: string;
  s1t: string;
  s1d: string;
  s2t: string;
  s2d: string;
  s3t: string;
  s3d: string;
  sectionPricing: string;
  pricingTitle: string;
  pricingDesc: string;
  plans: PlanItem[];
  pricingPerFile: string;
  pricingNote: string;
  sectionFaq: string;
  faqs: { q: string; a: string }[];
  sectionTestimonials: string;
  testimonialsTitle: string;
  testimonials: { name: string; role: string; text: string }[];
  footer: string;
  langSwitch: string;
}

export const T: Partial<Record<Lang, Translations>> = {
  ar: {
    dir: "rtl",
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
    painDesc: "ملف DXF فيه خط مكرر أو شكل مفتوح يوقف ماكينة القص، يحرق المادة، ويضيع وقت المشغّل.",
    sectionFeatures: "ماذا تحصل",
    f1t: "إصلاح تلقائي",
    f1d: "نكشف الخطوط المكررة، الفجوات، الأشكال المفتوحة، ونصلحها بضغطة.",
    f2t: "تقييم جاهزية CNC",
    f2d: "نتيجة من 100 توضح هل الملف جاهز للقص، مع تقرير مفصّل.",
    f3t: "تصدير فوري",
    f3d: "ملف DXF نظيف متوافق مع برامج القص الشهيرة.",
    f4t: "بدون تثبيت",
    f4d: "كل شيء في المتصفح — يعمل على الموبايل واللابتوب.",
    f5t: "واجهة بالعربي",
    f5d: "أول أداة من نوعها مصممة للورش العربية.",
    f6t: "خصوصية كاملة",
    f6d: "ملفاتك تُعالج وتُحذف فوراً. لا نخزن تصاميمك.",
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
      { name: "مجاني", price: "$0", period: "3 استخدامات", desc: "مثالي للتجربة.", items: ["🔍 معاينة الملف", "📋 تقرير المشاكل", "📊 إحصائيات", "🆓 بدون بطاقة"], cta: "ابدأ مجاناً", highlight: false, priceId: null, badge: null },
      { name: "لكل ملف", price: "$2", period: "لكل ملف", desc: "ادفع فقط عند الحاجة.", items: ["🛠️ إصلاح وتحميل ملف واحد", "💰 حاسبة التكاليف", "📐 تصدير SVG/PDF", "✅ صالح 24 ساعة"], cta: "ادفع $2", highlight: false, priceId: "pri_per_file", badge: "مرن" },
      { name: "شهري", price: "$7", period: "/ شهر", desc: "للاستخدام المنتظم.", items: ["🛠️ إصلاح وتحميل غير محدود", "💰 حاسبة التكاليف", "🔄 محاكاة 3D", "📐 تصدير SVG/PDF", "✅ غير محدود"], cta: "اشترك شهرياً", highlight: true, priceId: "pri_pro_monthly", badge: null },
      { name: "مشغل", price: "$10", period: "/ شهر", desc: "لأصحاب ورش CNC المحترفين.", items: ["🛠️ إصلاح غير محدود", "💰 حاسبة التكاليف", "🔄 محاكاة 3D", "📐 تصدير SVG/PDF", "📦 معالجة جماعية", "⭐ دعم أولوية"], cta: "اشترك في المشغل", highlight: false, priceId: "pri_workshop_monthly", badge: "احترافي" },
    ],
    pricingPerFile: "💡 ادفع $2 لكل ملف",
    pricingNote: "* الدفع آمن عبر Paddle. المبالغ بالدولار الأمريكي.",
    sectionFaq: "أسئلة شائعة",
    faqs: [
      { q: "هل فعلاً مجاني؟", a: "نعم، 100% مجاني خلال فترة الإطلاق." },
      { q: "هل ملفاتي بأمان؟", a: "نعالج الملف ونحذفه فوراً." },
      { q: "أي برامج القص يدعم؟", a: "DXF القياسي يعمل مع معظم برامج القص." },
      { q: "هل أحتاج خبرة؟", a: "لا. الواجهة مصممة للمشغّل." },
    ],
    sectionTestimonials: "آراء المشغّلين",
    testimonialsTitle: "ورش حقيقية. نتائج حقيقية.",
    testimonials: [
      { name: "أحمد الحربي", role: "مشغّل ليزر — الرياض", text: "كنت أضيع ساعة كل يوم أصلح ملفات DXF. الآن 30 ثانية." },
      { name: "محمد القحطاني", role: "ورشة CNC — جدة", text: "DXFix حل المشكلة من أول تجربة." },
      { name: "خالد المنصور", role: "مصنع — الكويت", text: "وفّرنا أكثر من 200 دولار شهرياً." },
    ],
    footer: "© 2026 DXFix. صُنع لورش التصنيع العربية.",
    langSwitch: "EN",
  },
  en: {
    dir: "ltr",
    nav: { features: "Features", how: "How it works", pricing: "Pricing", faq: "FAQ", cta: "Try free" },
    badge: "Free during launch",
    h1a: "DXF files",
    h1b: "ready to cut",
    h1c: "on the first try.",
    sub: "Built for laser, plasma and CNC shops: upload a DXF, we auto-repair errors, score cut-readiness, and return a clean file in seconds.",
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
    painDesc: "A duplicate line or open polyline stalls the cutter, scorches material, and wastes operator time.",
    sectionFeatures: "What you get",
    f1t: "Auto repair",
    f1d: "We detect duplicate lines, gaps, open shapes — and fix them in one click.",
    f2t: "CNC readiness score",
    f2d: "A 0–100 score that tells you if the file is ready, with a full report.",
    f3t: "Instant export",
    f3d: "Clean DXF compatible with LaserCAD, RDWorks, Mach3, FastCAM.",
    f4t: "No install",
    f4d: "Runs in the browser on mobile and laptop.",
    f5t: "Arabic-first UI",
    f5d: "Designed for Arab workshops, in the operator's language.",
    f6t: "Private by default",
    f6d: "Files processed and deleted instantly. We never store your designs.",
    sectionHow: "Three steps",
    s1t: "Upload",
    s1d: "Drag & drop any DXF file — or pick from your device.",
    s2t: "Analyze & fix",
    s2d: "We scan in seconds and show every issue with suggested fixes.",
    s3t: "Download clean",
    s3d: "Get a DXF ready to cut on your machine.",
    sectionPricing: "Pricing",
    pricingTitle: "Start free, upgrade when ready.",
    pricingDesc: "Transparent plans, no surprises.",
    plans: [
      { name: "Free", price: "$0", period: "3 uses", desc: "Perfect for trying it out.", items: ["🔍 File preview", "📋 Issue report", "📊 Statistics", "🆓 No card"], cta: "Start free", highlight: false, priceId: null, badge: null },
      { name: "Per File", price: "$2", period: "per file", desc: "Pay only when you need it.", items: ["🛠️ Repair & download 1 file", "💰 Cost estimator", "📐 Export SVG/PDF", "✅ Valid 24 hours"], cta: "Pay $2", highlight: false, priceId: "pri_per_file", badge: "Flexible" },
      { name: "Monthly", price: "$7", period: "/ month", desc: "For regular monthly use.", items: ["🛠️ Unlimited repair & download", "💰 Cost estimator", "🔄 3D simulation", "📐 Export SVG/PDF", "✅ Unlimited"], cta: "Subscribe Monthly", highlight: true, priceId: "pri_pro_monthly", badge: null },
      { name: "Workshop", price: "$10", period: "/ month", desc: "For professional CNC workshops.", items: ["🛠️ Unlimited repair", "💰 Cost estimator", "🔄 3D simulation", "📐 Export SVG/PDF", "📦 Bulk processing", "⭐ Priority support"], cta: "Subscribe Workshop", highlight: false, priceId: "pri_workshop_monthly", badge: "Professional" },
    ],
    pricingPerFile: "💡 Pay $2 per file",
    pricingNote: "* Payments secured by Paddle. Prices in USD.",
    sectionFaq: "FAQ",
    faqs: [
      { q: "Is it really free?", a: "Yes — 100% free during launch." },
      { q: "Are my files safe?", a: "We process and delete each file instantly." },
      { q: "Which cutters work?", a: "Standard DXF works with most cutting software." },
      { q: "Do I need experience?", a: "No. The UI is built for operators." },
    ],
    sectionTestimonials: "From the workshops",
    testimonialsTitle: "Real shops. Real results.",
    testimonials: [
      { name: "Ahmed Al-Harbi", role: "Laser operator — Riyadh", text: "I used to waste an hour daily fixing DXF files. Now it's 30 seconds." },
      { name: "Mohammed Al-Qahtani", role: "CNC Workshop — Jeddah", text: "DXFix solved it on the first try." },
      { name: "Khalid Al-Mansour", role: "Factory — Kuwait", text: "We save over $200/month." },
    ],
    footer: "© 2026 DXFix. Built for Arab manufacturing.",
    langSwitch: "العربية",
  },
};
export function getTranslations(lang: Lang): Translations {
  return (T[lang] || T.en) as Translations;
}
