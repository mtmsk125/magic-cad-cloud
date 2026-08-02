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
    <div dir={dir} className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="/" className="font-display font-bold text-xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent" />
            DXFix
          </a>
          <LanguageSwitcher currentLang={lang} onLangChange={setLang} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-12">
        <h1 className="font-display text-4xl font-bold mb-6">
          {lang === "ar" ? "شروط الخدمة والاستخدام (Terms of Service)" : "Terms of Service"}
        </h1>

        <div className="space-y-8 leading-relaxed">
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold mb-3 text-accent">
              {lang === "ar" ? "1. قبول الشروط" : "1. Acceptance of Terms"}
            </h2>
            <p>
              {lang === "ar"
                ? "باستخدامك لموقع DXFix وأدواته، فإنك توافق على الالتزام بشروط الخدمة هذه وجميع القوانين واللوائح المعمول بها."
                : "By accessing and using DXFix services, you agree to be bound by these Terms of Service and applicable laws."}
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold mb-3 text-accent">
              {lang === "ar" ? "2. طبيعة الخدمة والمسؤولية" : "2. Service Nature & Disclaimer"}
            </h2>
            <p>
              {lang === "ar"
                ? "يوفر موقع DXFix أدوات تحليلية وتلقائية لفحص وإصلاح ملفات DXF والتصاميم الهندسية. يبذل الموقع قصارى جهده لتقديم أدق نتائج الإصلاح، ولكن يتعين على المشغّل مراجعة وتأكيد أبعاد الملف قبل إجراء عمليات القص الفعلي على الماكينة."
                : "DXFix provides automated tools to analyze and repair DXF files. While we strive for maximum accuracy, operators must verify file dimensions prior to physical cutting."}
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold mb-3 text-accent">
              {lang === "ar" ? "3. حقوق الملكية الفكرية" : "3. Intellectual Property"}
            </h2>
            <p>
              {lang === "ar"
                ? "يحتفظ المستخدم بكامل ملكيته الفكرية والتصميمية للملفات التي يرفعها على الموقع. لا يدعي موقع DXFix أي ملكية لأعمال المستخدمين."
                : "Users retain full intellectual property ownership of all files uploaded to DXFix."}
            </p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <a href="/" className="inline-flex items-center gap-2 text-accent font-semibold hover:underline">
            ← {lang === "ar" ? "العودة إلى الصفحة الرئيسية" : "Back to Home"}
          </a>
        </div>
      </main>
    </div>
  );
}
