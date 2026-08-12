import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getLangDir, type Lang } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "شروط الخدمة | Terms of Service — DXFix" },
      { name: "description", content: "شروط الأحكام والاستخدام لخدمات وموقع DXFix لتقييم وإصلاح ملفات DXF لورش CNC." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const dir = getLangDir(lang);

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
              {lang === "ar" ? "جرب الأداة" : "Try Tool"}
            </a>
            <LanguageSwitcher currentLang={lang} onLangChange={setLang} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 py-16">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-full border border-accent/40 text-accent bg-accent/5">
            📜 {lang === "ar" ? "الشروط والتنظيم" : "Terms & Governance"}
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-bold mt-4">
            {lang === "ar" ? "شروط الخدمة والاستخدام" : "Terms of Service"}
          </h1>
          <p className="text-sm text-muted-foreground mt-3 font-mono">
            {lang === "ar" ? "آخر تحديث: 12 أغسطس 2026" : "Last updated: August 12, 2026"}
          </p>
        </div>

        <div className="space-y-8 leading-relaxed">
          <section className="bg-card/70 border border-border/80 rounded-2xl p-8 backdrop-blur-sm shadow-[var(--shadow-elegant)]">
            <h2 className="font-display text-xl font-bold mb-3 text-accent flex items-center gap-2">
              <span>1.</span>
              <span>{lang === "ar" ? "قبول الشروط" : "Acceptance of Terms"}</span>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              {lang === "ar"
                ? "باستخدامك لموقع DXFix وأدواته، فإنك توافق على الالتزام بشروط الخدمة هذه وجميع القوانين واللوائح المعمول بها."
                : "By accessing and using DXFix services, you agree to be bound by these Terms of Service and applicable laws."}
            </p>
          </section>

          <section className="bg-card/70 border border-border/80 rounded-2xl p-8 backdrop-blur-sm shadow-[var(--shadow-elegant)]">
            <h2 className="font-display text-xl font-bold mb-3 text-accent flex items-center gap-2">
              <span>2.</span>
              <span>{lang === "ar" ? "طبيعة الخدمة والمسؤولية" : "Service Nature & Disclaimer"}</span>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              {lang === "ar"
                ? "يوفر موقع DXFix أدوات تحليلية وتلقائية لفحص وإصلاح ملفات DXF والتصاميم الهندسية. يبذل الموقع قصارى جهده لتقديم أدق نتائج الإصلاح، ولكن يتعين على المشغّل مراجعة وتأكيد أبعاد الملف قبل إجراء عمليات القص الفعلي على الماكينة."
                : "DXFix provides automated tools to analyze and repair DXF files. While we strive for maximum accuracy, operators must verify file dimensions prior to physical cutting."}
            </p>
          </section>

          <section className="bg-card/70 border border-border/80 rounded-2xl p-8 backdrop-blur-sm shadow-[var(--shadow-elegant)]">
            <h2 className="font-display text-xl font-bold mb-3 text-accent flex items-center gap-2">
              <span>3.</span>
              <span>{lang === "ar" ? "حقوق الملكية الفكرية" : "Intellectual Property"}</span>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              {lang === "ar"
                ? "يحتفظ المستخدم بكامل ملكيته الفكرية والتصميمية للملفات التي يرفعها على الموقع. لا يدعي موقع DXFix أي ملكية لأعمال المستخدمين."
                : "Users retain full intellectual property ownership of all files uploaded to DXFix."}
            </p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <a href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent/10 border border-accent/30 text-accent font-semibold hover:bg-accent/20 transition">
            <span>{dir === "rtl" ? "←" : "→"}</span>
            <span>{lang === "ar" ? "العودة إلى الصفحة الرئيسية" : "Back to Home"}</span>
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground font-mono">
        © 2026 DXFix. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}
