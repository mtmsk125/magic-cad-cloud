import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getLangDir, type Lang } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية | Privacy Policy — DXFix" },
      { name: "description", content: "سياسة الخصوصية وحماية البيانات لموقع DXFix لخدمات فحص وإصلاح ملفات DXF لورش التصنيع." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const dir = getLangDir(lang);

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground font-sans selection:bg-accent/30 selection:text-accent relative overflow-x-hidden">
      {/* Background blueprint grid matching homepage */}
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

      {/* Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 py-16">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-full border border-accent/40 text-accent bg-accent/5">
            🔒 {lang === "ar" ? "حماية البيانات والسرية" : "Data Protection & Privacy"}
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-bold mt-4">
            {lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
          </h1>
          <p className="text-sm text-muted-foreground mt-3 font-mono">
            {lang === "ar" ? "آخر تحديث: 12 أغسطس 2026" : "Last updated: August 12, 2026"}
          </p>
        </div>

        <div className="space-y-8 leading-relaxed">
          <section className="bg-card/70 border border-border/80 rounded-2xl p-8 backdrop-blur-sm shadow-[var(--shadow-elegant)]">
            <h2 className="font-display text-xl font-bold mb-3 text-accent flex items-center gap-2">
              <span>1.</span>
              <span>{lang === "ar" ? "مقدمة والتزام بالخصوصية" : "Introduction & Commitment"}</span>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              {lang === "ar"
                ? "في موقع DXFix، نولي أهمية قصوى لخصوصية زوارنا ومستخدمينا. توضح هذه الوثيقة أنواع البيانات التي نجمعها وكيفية استخدامها وحمايتها عند استخدامك لخدماتنا في فحص وإصلاح ملفات DXF والتصاميم الهندسية."
                : "At DXFix, we prioritize the privacy of our visitors and users. This Privacy Policy outlines the types of personal information collected, how it is used, and how it is protected when using our DXF file repair and analysis services."}
            </p>
          </section>

          <section className="bg-card/70 border border-border/80 rounded-2xl p-8 backdrop-blur-sm shadow-[var(--shadow-elegant)]">
            <h2 className="font-display text-xl font-bold mb-3 text-accent flex items-center gap-2">
              <span>2.</span>
              <span>{lang === "ar" ? "معالجة وحفظ ملفات التصاميم (DXF/SVG)" : "Processing & Security of CAD Files"}</span>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-4">
              {lang === "ar"
                ? "نحن نحترم الملكية الفكرية لتصاميمك الهندسية والمصانع والورش. تتم معالجة جميع ملفات DXF/SVG داخل المتصفح وبسرية تامة:"
                : "We strictly respect the intellectual property of your engineering files. All CAD files are processed with extreme confidentiality:"}
            </p>
            <ul className="space-y-3 text-sm text-foreground/90">
              <li className="flex items-start gap-3 bg-background/50 p-3 rounded-lg border border-border/50">
                <span className="text-accent font-bold">✓</span>
                <span>{lang === "ar" ? "لا يتم تخزين تصاميمك على أي خوادم دائمية." : "Your design files are never permanently stored on servers."}</span>
              </li>
              <li className="flex items-start gap-3 bg-background/50 p-3 rounded-lg border border-border/50">
                <span className="text-accent font-bold">✓</span>
                <span>{lang === "ar" ? "يتم حذف الملفات المعالجة فورياً بمجرد إغلاق الجلسة أو التحميل." : "Processed files are purged immediately upon session closure or download."}</span>
              </li>
              <li className="flex items-start gap-3 bg-background/50 p-3 rounded-lg border border-border/50">
                <span className="text-accent font-bold">✓</span>
                <span>{lang === "ar" ? "لا نطلع أو نبيع أي تصاميم أو ملفات تخص الورشة لأي طرف ثالث." : "We never inspect, share, or sell your proprietary designs to third parties."}</span>
              </li>
            </ul>
          </section>

          <section className="bg-card/70 border border-border/80 rounded-2xl p-8 backdrop-blur-sm shadow-[var(--shadow-elegant)]">
            <h2 className="font-display text-xl font-bold mb-3 text-accent flex items-center gap-2">
              <span>3.</span>
              <span>{lang === "ar" ? "ملفات تعريف الارتباط والإعلانات (Google AdSense & Cookies)" : "Cookies & Advertisements"}</span>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-4">
              {lang === "ar"
                ? "يستخدم موقعنا شركاء إعلانات موثوقين مثل Google AdSense وMonetag لعرض الإعلانات المناسبة للزوار:"
                : "Our site works with trusted advertising partners such as Google AdSense and Monetag to serve relevant ads:"}
            </p>
            <ul className="space-y-3 text-sm text-foreground/90">
              <li className="flex items-start gap-3 bg-background/50 p-3 rounded-lg border border-border/50">
                <span className="text-accent font-bold">✓</span>
                <span>{lang === "ar" ? "تستخدم Google ملفات تعريف الارتباط DART لتخصيص الإعلانات بناءً على زياراتك للموقع." : "Google uses DART cookies to serve ads based on your visits to our site."}</span>
              </li>
              <li className="flex items-start gap-3 bg-background/50 p-3 rounded-lg border border-border/50">
                <span className="text-accent font-bold">✓</span>
                <span>{lang === "ar" ? "يمكن للمستخدمين إلغاء استخدام ملفات تعريف الارتباط عبر إعدادات الإعلانات." : "Users can opt out of personalized advertising by visiting Google Ads Settings."}</span>
              </li>
            </ul>
          </section>

          <section className="bg-card/70 border border-border/80 rounded-2xl p-8 backdrop-blur-sm shadow-[var(--shadow-elegant)]">
            <h2 className="font-display text-xl font-bold mb-3 text-accent flex items-center gap-2">
              <span>4.</span>
              <span>{lang === "ar" ? "مدفوعات Paddle والأمان" : "Paddle Payments & Security"}</span>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              {lang === "ar"
                ? "تتم جميع عمليات التبرع والاشتراكات بشكل آمن ومشفّر عبر بوابة Paddle المعتمدة عالمياً. لا نحتفظ بأي بيانات لبطاقاتك الائتمانية على خوادمنا."
                : "All payments and donations are processed securely via Paddle. We never store credit card numbers or financial details on our servers."}
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
