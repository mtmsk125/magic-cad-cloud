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

export const T: Record<Lang, Translations> = {
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
  fr: {
    dir: "ltr",
    nav: { features: "Fonctionnalités", how: "Comment ça marche", pricing: "Tarifs", faq: "FAQ", cta: "Essayer gratuit" },
    badge: "Gratuit pendant le lancement",
    h1a: "Fichiers DXF",
    h1b: "prêts à couper",
    h1c: "dès la première tentative.",
    sub: "Conçu pour les ateliers laser, plasma et CNC : téléchargez un DXF, nous réparons les erreurs automatiquement et retournons un fichier propre en secondes.",
    primaryCta: "Commencer — télécharger un DXF",
    secondaryCta: "Voir comment ça marche",
    stat1: "Temps de réparation",
    stat2: "Erreurs détectées",
    stat3: "Carte ou inscription",
    statV1: "< 5s",
    statV2: "20+",
    statV3: "Aucun",
    sectionPain: "Le problème",
    painTitle: "Chaque minute d'arrêt de la machine vous coûte de l'argent.",
    painDesc: "Une ligne en double ou un polygone ouvert bloque la coupe et fait perdre du temps.",
    sectionFeatures: "Ce que vous obtenez",
    f1t: "Réparation automatique",
    f1d: "Nous détectons les doublons, les espaces, les formes ouvertes et les corrigeons en un clic.",
    f2t: "Score de préparation CNC",
    f2d: "Un score de 0 à 100 indiquant si le fichier est prêt à couper.",
    f3t: "Exportation instantanée",
    f3d: "DXF propre compatible avec LaserCAD, RDWorks, Mach3, FastCAM.",
    f4t: "Sans installation",
    f4d: "Fonctionne dans le navigateur sur mobile et ordinateur.",
    f5t: "Interface en arabe",
    f5d: "Conçue pour les ateliers arabes.",
    f6t: "Confidentialité totale",
    f6d: "Fichiers traités et supprimés instantanément.",
    sectionHow: "Trois étapes",
    s1t: "Téléchargez",
    s1d: "Glissez-déposez un fichier DXF ou choisissez depuis votre appareil.",
    s2t: "Analysez & réparez",
    s2d: "Nous scannons en secondes et affichons tous les problèmes.",
    s3t: "Téléchargez propre",
    s3d: "Obtenez un DXF prêt à couper sur votre machine.",
    sectionPricing: "Tarifs",
    pricingTitle: "Commencez gratuitement, passez à un niveau supérieur quand vous voulez.",
    pricingDesc: "Forfaits transparents, sans surprises.",
    plans: [
      { name: "Gratuit", price: "$0", period: "3 utilisations", desc: "Parfait pour essayer.", items: ["🔍 Aperçu du fichier", "📋 Rapport d'erreurs", "📊 Statistiques", "🆓 Sans carte"], cta: "Commencer gratuit", highlight: false, priceId: null, badge: null },
      { name: "Par fichier", price: "$2", period: "par fichier", desc: "Payez seulement quand vous en avez besoin.", items: ["🛠️ Réparation & téléchargement 1 fichier", "💰 Calculateur de coûts", "📐 Export SVG/PDF", "✅ Valable 24h"], cta: "Payer $2", highlight: false, priceId: "pri_per_file", badge: "Flexible" },
      { name: "Mensuel", price: "$7", period: "/ mois", desc: "Pour une utilisation régulière.", items: ["🛠️ Réparation & téléchargement illimité", "💰 Calculateur de coûts", "🔄 Simulation 3D", "📐 Export SVG/PDF", "✅ Illimité"], cta: "S'abonner", highlight: true, priceId: "pri_pro_monthly", badge: null },
      { name: "Atelier", price: "$10", period: "/ mois", desc: "Pour les ateliers CNC professionnels.", items: ["🛠️ Réparation illimitée", "💰 Calculateur de coûts", "🔄 Simulation 3D", "📐 Export SVG/PDF", "📦 Traitement par lots", "⭐ Support prioritaire"], cta: "S'abonner Atelier", highlight: false, priceId: "pri_workshop_monthly", badge: "Professionnel" },
    ],
    pricingPerFile: "💡 Payer $2 par fichier",
    pricingNote: "* Paiements sécurisés par Paddle. Prix en USD.",
    sectionFaq: "FAQ",
    faqs: [
      { q: "Est-ce vraiment gratuit ?", a: "Oui — 100% gratuit pendant le lancement." },
      { q: "Mes fichiers sont-ils sûrs ?", a: "Nous traitons et supprimons chaque fichier instantanément." },
      { q: "Quels logiciels sont compatibles ?", a: "Le DXF standard fonctionne avec la plupart des logiciels." },
      { q: "Ai-je besoin d'expérience ?", a: "Non. L'interface est conçue pour les opérateurs." },
    ],
    sectionTestimonials: "Des ateliers",
    testimonialsTitle: "Vrais ateliers. Vrais résultats.",
    testimonials: [
      { name: "Ahmed Al-Harbi", role: "Opérateur laser — Riyad", text: "Je perdais une heure par jour. Maintenant 30 secondes." },
      { name: "Mohammed Al-Qahtani", role: "Atelier CNC — Jeddah", text: "DXFix a résolu le problème du premier coup." },
      { name: "Khalid Al-Mansour", role: "Usine — Koweït", text: "Nous économisons plus de $200/mois." },
    ],
    footer: "© 2026 DXFix. Conçu pour la fabrication arabe.",
    langSwitch: "FR",
  },
  zh: {
    dir: "ltr",
    nav: { features: "功能", how: "工作原理", pricing: "价格", faq: "常见问题", cta: "免费试用" },
    badge: "发布期间免费",
    h1a: "DXF文件",
    h1b: "准备切割",
    h1c: "一次成功。",
    sub: "为激光、等离子和CNC车间打造：上传DXF文件，我们自动修复错误，评估切割准备状态，几秒钟内返回干净文件。",
    primaryCta: "开始 — 上传DXF",
    secondaryCta: "查看工作原理",
    stat1: "修复时间",
    stat2: "检测到错误",
    stat3: "卡片或注册",
    statV1: "< 5秒",
    statV2: "20+",
    statV3: "无需",
    sectionPain: "问题",
    painTitle: "机器闲置的每一分钟都在浪费你的钱。",
    painDesc: "重复线条或开放多边形会停机的切割头，浪费操作员的时间。",
    sectionFeatures: "你将获得",
    f1t: "自动修复",
    f1d: "检测重复线、间隙、开放形状，一键修复。",
    f2t: "CNC准备评分",
    f2d: "0–100分，显示文件是否准备好切割。",
    f3t: "即时导出",
    f3d: "干净的DXF兼容LaserCAD、RDWorks、Mach3、FastCAM。",
    f4t: "无需安装",
    f4d: "在浏览器中运行，支持手机和电脑。",
    f5t: "阿拉伯语界面",
    f5d: "专为阿拉伯车间设计。",
    f6t: "默认私密",
    f6d: "文件立即处理并删除。",
    sectionHow: "三个步骤",
    s1t: "上传",
    s1d: "拖放DXF文件或从设备中选择。",
    s2t: "分析和修复",
    s2d: "几秒钟内扫描并显示所有问题。",
    s3t: "下载干净文件",
    s3d: "获取准备好在机器上切割的DXF。",
    sectionPricing: "价格",
    pricingTitle: "免费开始，需要时升级。",
    pricingDesc: "透明计划，无隐藏费用。",
    plans: [
      { name: "免费", price: "$0", period: "3次使用", desc: "非常适合试用。", items: ["🔍 文件预览", "📋 错误报告", "📊 统计", "🆓 无需卡"], cta: "免费开始", highlight: false, priceId: null, badge: null },
      { name: "按文件", price: "$2", period: "每文件", desc: "只在需要时付费。", items: ["🛠️ 修复和下载1个文件", "💰 成本计算器", "📐 导出SVG/PDF", "✅ 24小时有效"], cta: "支付$2", highlight: false, priceId: "pri_per_file", badge: "灵活" },
      { name: "月度", price: "$7", period: "/ 月", desc: "适合定期使用。", items: ["🛠️ 无限修复和下载", "💰 成本计算器", "🔄 3D模拟", "📐 导出SVG/PDF", "✅ 无限"], cta: "订阅", highlight: true, priceId: "pri_pro_monthly", badge: null },
      { name: "工坊", price: "$10", period: "/ 月", desc: "适合专业CNC工坊。", items: ["🛠️ 无限修复", "💰 成本计算器", "🔄 3D模拟", "📐 导出SVG/PDF", "📦 批量处理", "⭐ 优先支持"], cta: "订阅工坊", highlight: false, priceId: "pri_workshop_monthly", badge: "专业" },
    ],
    pricingPerFile: "💡 每文件$2",
    pricingNote: "* 支付由Paddle保护。价格为美元。",
    sectionFaq: "常见问题",
    faqs: [
      { q: "真的免费吗？", a: "是的 — 发布期间100%免费。" },
      { q: "我的文件安全吗？", a: "我们立即处理并删除每个文件。" },
      { q: "支持哪些软件？", a: "标准DXF兼容大多数切割软件。" },
      { q: "需要经验吗？", a: "不需要。界面为操作员设计。" },
    ],
    sectionTestimonials: "来自车间",
    testimonialsTitle: "真实车间。真实结果。",
    testimonials: [
      { name: "艾哈迈德·哈尔比", role: "激光操作员 — 利雅得", text: "我每天浪费一小时。现在只需30秒。" },
      { name: "穆罕默德·卡塔尼", role: "CNC车间 — 吉达", text: "DXFix第一次就解决了问题。" },
      { name: "哈立德·曼苏尔", role: "工厂 — 科威特", text: "我们每月节省超过200美元。" },
    ],
    footer: "© 2026 DXFix. 为阿拉伯制造业打造。",
    langSwitch: "中文",
  },
};

export function getTranslations(lang: Lang): Translations {
  return T[lang] || T.en;
}