import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AdBanner } from "@/components/AdBanner";
import { getLangDir, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "DXFix — الأداة مجانية 100% | ادعمنا بفنجان قهوة" },
      { name: "description", content: "DXFix أداة مجانية 100% لإصلاح ملفات DXF. ادعم استمرار الأداة بفنجان قهوة." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: SupportPage,
});

const COFFEE_URL = "https://www.buymeacoffee.com/dxfix";

function SupportPage() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dxfix_lang") as Lang | null;
      if (stored && ["ar", "en"].includes(stored)) return stored;
    }
    return "ar";
  });
  const isRTL = getLangDir(lang) === "rtl";

  function handleLangChange(newLang: Lang) {
    setLang(newLang);
    localStorage.setItem("dxfix_lang", newLang);
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
              {isRTL ? "←" : "→"} {lang === "ar" ? "العودة للموقع" : "Back to site"}
            </a>
            <LanguageSwitcher currentLang={lang} onLangChange={handleLangChange} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-16">
        {/* FREE BADGE */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-full border border-green-500/40 text-green-400 bg-green-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {lang === "ar" ? "مجاني 100% — بدون اشتراك" : "100% Free — No Subscription"}
          </span>
          <h1 className="font-display mt-6 text-4xl sm:text-5xl font-bold">
            {lang === "ar" ? "الأداة مجانية بالكامل" : "The tool is completely free"}
          </h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            {lang === "ar"
              ? "لا توجد اشتراكات شهرية أو سنوية. لا ورش مدفوعة. كل الميزات متاحة مجاناً للجميع."
              : "No monthly or yearly subscriptions. No paid workshops. All features are free for everyone."}
          </p>
        </div>

        {/* 📢 AdBanner */}
        <AdBanner format="horizontal" lang={lang} />

        {/* SUPPORT SECTION */}
        <div className="mt-12 bg-gradient-to-br from-amber-500/10 via-card to-amber-500/5 border border-amber-500/30 rounded-3xl p-10 text-center">
          <div className="text-7xl mb-6">☕</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold">
            {lang === "ar" ? "ادعم الأداة بفنجان قهوة" : "Support us with a coffee"}
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            {lang === "ar"
              ? "الأداة مجانية 100% ومستمرة بفضل دعم المستخدمين. إذا أفادتك في عملك، يمكنك دعمنا بفنجان قهوة — هذا يساعدنا على إبقاء الأداة مجانية وتطوير ميزات جديدة."
              : "The tool is 100% free and stays that way thanks to user support. If it helped you in your work, consider buying us a coffee — this helps us keep the tool free and build new features."}
          </p>
          <a
            href={COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg hover:opacity-90 transition shadow-[var(--shadow-spark)]"
          >
            ☕ {lang === "ar" ? "اشترِ لي فنجان قهوة" : "Buy me a coffee"}
          </a>
          <p className="mt-4 font-mono text-xs text-muted-foreground/60">
            {lang === "ar" ? "دعمك اختياري وليس شرطاً للاستخدام" : "Your support is optional, not a requirement"}
          </p>
        </div>

        {/* FEATURES FREE */}
        <div className="mt-12 bg-card border border-border rounded-2xl p-8">
          <h3 className="font-display text-2xl font-bold text-center mb-6">
            {lang === "ar" ? "كل الميزات متاحة مجاناً:" : "All features are free:"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              lang === "ar" ? "🛠️ إصلاح وتحميل ملفات DXF" : "🛠️ Repair & download DXF files",
              lang === "ar" ? "📊 تقييم جاهزية القص" : "📊 Cut-readiness score",
              lang === "ar" ? "💰 حاسبة تكلفة القص" : "💰 Cutting cost estimator",
              lang === "ar" ? "🔄 محاكاة مسار الماكينة 3D" : "🔄 3D toolpath simulation",
              lang === "ar" ? "📦 معالجة مجمعة (Batch)" : "📦 Batch processing",
              lang === "ar" ? "🖼️ تحويل SVG إلى DXF" : "🖼️ SVG to DXF conversion",
              lang === "ar" ? "📐 تصدير بصيغ متعددة" : "📐 Multi-format export",
              lang === "ar" ? "🔒 خصوصية كاملة" : "🔒 Full privacy",
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border/60">
                <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs flex-shrink-0">✓</span>
                <span className="text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <a
            href="/tool"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-accent text-accent-foreground font-bold text-lg hover:opacity-90 transition shadow-[var(--shadow-spark)]"
          >
            {lang === "ar" ? "🚀 ابدأ استخدام الأداة مجاناً" : "🚀 Start using the tool free"}
            <span aria-hidden>{isRTL ? "←" : "→"}</span>
          </a>
          <p className="mt-4 font-mono text-xs text-muted-foreground/50">
            {lang === "ar" ? "لا بطاقة، لا تسجيل، لا اشتراك." : "No card. No signup. No subscription."}
          </p>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border/60 mt-12">
        <div className="max-w-6xl mx-auto px-5 py-10 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 font-display font-bold text-foreground mb-2">
            <span className="inline-block w-2 h-2 rounded-sm bg-accent" />
            DXfix
          </div>
          <div className="font-mono text-xs">
            {lang === "ar" ? "© 2026 DXFix. صُنع لورش التصنيع العربية." : "© 2026 DXFix. Built for Arab manufacturing."}
          </div>
        </div>
      </footer>
    </div>
  );
}