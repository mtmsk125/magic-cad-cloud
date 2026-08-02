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
    <div dir={dir} className="min-h-screen bg-background text-foreground font-sans selection:bg-accent/30 selection:text-accent">
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
          {lang === "ar" ? "سياسة الخصوصية (Privacy Policy)" : "Privacy Policy"}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {lang === "ar" ? "آخر تحديث: 2 أغسطس 2026" : "Last updated: August 2, 2026"}
        </p>

        <div className="space-y-8 leading-relaxed text-foreground/90">
          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold mb-3 text-accent">
              {lang === "ar" ? "1. مقدمة والتزام بالخصوصية" : "1. Introduction & Commitment"}
            </h2>
            <p>
              {lang === "ar"
                ? "في موقع DXFix، نولي أهمية قصوى لخصوصية زوارنا ومستخدمينا. توضح هذه الوثيقة أنواع البيانات الشخصية التي نجمعها وكيفية استخدامها وحمايتها عند استخدامك لخدماتنا في فحص وإصلاح ملفات DXF والتصاميم الهندسية."
                : "At DXFix, we prioritize the privacy of our visitors and users. This Privacy Policy outlines the types of personal information collected, how it is used, and how it is protected when using our DXF file repair and analysis services."}
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold mb-3 text-accent">
              {lang === "ar" ? "2. معالجة وحفظ ملفات التصاميم (DXF/SVG)" : "2. Processing & Security of CAD Files"}
            </h2>
            <p className="mb-3">
              {lang === "ar"
                ? "نحن نحترم الملكية الفكرية لتصاميمك الهندسية والمصانع والورش. تتم معالجة جميع ملفات DXF/SVG داخل المتصفح أو بشكل مؤقت وسري:"
                : "We strictly respect the intellectual property of your engineering files. All CAD files are processed with extreme confidentiality:"}
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>{lang === "ar" ? "لا يتم تخزين تصاميمك على أي خوادم دائمية." : "Your design files are never permanently stored on servers."}</li>
              <li>{lang === "ar" ? "يتم حذف الملفات المعالجة فورياً بمجرد إغلاق الجلسة أو التحميل." : "Processed files are purged immediately upon session closure or download."}</li>
              <li>{lang === "ar" ? "لا نطلع أو نبيع أي تصاميم أو ملفات تخص الورشة لأي طرف ثالث." : "We never inspect, share, or sell your proprietary designs to third parties."}</li>
            </ul>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold mb-3 text-accent">
              {lang === "ar" ? "3. ملفات تعريف الارتباط والإعلانات (Google AdSense & Cookies)" : "3. Cookies & Advertisements"}
            </h2>
            <p className="mb-3">
              {lang === "ar"
                ? "يستخدم موقعنا شركاء إعلانات موثوقين مثل Google AdSense وMonetag لعرض الإعلانات المناسبة للزوار:"
                : "Our site works with trusted advertising partners such as Google AdSense and Monetag to serve relevant ads:"}
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                {lang === "ar"
                  ? "تستخدم Google ملفات تعريف الارتباط DART لتخصيص الإعلانات بناءً على زياراتك لموقعنا والمواقع الأخرى."
                  : "Google uses DART cookies to serve ads based on your visits to our site and other sites across the internet."}
              </li>
              <li>
                {lang === "ar"
                  ? "يمكن للمستخدمين إلغاء استخدام ملفات تعريف الارتباط للإعلانات المخصصة عبر زيارة إعدادات إعلانات جوجل."
                  : "Users can opt out of personalized advertising by visiting Google Ads Settings."}
              </li>
            </ul>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold mb-3 text-accent">
              {lang === "ar" ? "4. مدفوعات Paddle والأمان" : "4. Paddle Payments & Security"}
            </h2>
            <p>
              {lang === "ar"
                ? "تتم جميع عمليات التبرع والاشتراكات بشكل آمن ومشفّر عبر بوابة Paddle المعتمدة عالمياً. لا نحتفظ بأي بيانات لبطاقاتك الائتمانية على خوادمنا."
                : "All payments and donations are processed securely via Paddle. We never store credit card numbers or financial details on our servers."}
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display text-xl font-bold mb-3 text-accent">
              {lang === "ar" ? "5. التواصل معنا" : "5. Contact Us"}
            </h2>
            <p>
              {lang === "ar"
                ? "إذا كان لديك أي استفسار حول سياسة الخصوصية أو حماية البيانات، يمكنك التواصل معنا عبر البريد الإلكتروني: support@dxfix.com"
                : "If you have any questions regarding this Privacy Policy, please contact us at support@dxfix.com"}
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
