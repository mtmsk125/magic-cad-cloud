import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getLangDir, type Lang } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية | Privacy Policy — DXFix" },
      {
        name: "description",
        content:
          "سياسة الخصوصية وحماية البيانات لموقع DXFix لخدمات فحص وإصلاح ملفات DXF لورش التصنيع.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const dir = getLangDir(lang);

  return (
    <div
      dir={dir}
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        position: "relative",
        overflowX: "hidden",
        fontFamily: "'Space Grotesk', 'IBM Plex Sans Arabic', system-ui, sans-serif",
      }}
    >
      {/* Blueprint grid */}
      <div
        className="absolute inset-0 blueprint-grid"
        style={{ opacity: 0.3, pointerEvents: "none" }}
      />

      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          backdropFilter: "blur(20px)",
          backgroundColor: "rgba(11,14,20,0.85)",
          borderBottom: "1px solid rgba(30,41,59,0.7)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <a
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
              fontSize: 18,
              color: "var(--foreground)",
              textDecoration: "none",
            }}
          >
            <span
              className="animate-spark"
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: "var(--accent)",
              }}
            />
            <span>
              DX<span className="text-gradient-blueprint">fix</span>
            </span>
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a
              href="/tool"
              style={{
                display: "inline-flex",
                padding: "8px 16px",
                borderRadius: 8,
                backgroundColor: "var(--accent)",
                color: "var(--accent-foreground)",
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              {lang === "ar" ? "جرب الأداة" : "Try Tool"}
            </a>
            <LanguageSwitcher currentLang={lang} onLangChange={setLang} />
          </div>
        </div>
      </header>

      {/* Main */}
      <main
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: 800,
          margin: "0 auto",
          padding: "64px 24px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "monospace",
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid rgba(16,185,129,0.4)",
              color: "var(--accent)",
              backgroundColor: "rgba(16,185,129,0.05)",
            }}
          >
            🔒 {lang === "ar" ? "الخصوصية والحماية" : "Privacy & Protection"}
          </span>
          <h1 style={{ fontWeight: 800, fontSize: 40, marginTop: 16, lineHeight: 1.2 }}>
            {lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--muted-foreground)",
              marginTop: 10,
              fontFamily: "monospace",
            }}
          >
            {lang === "ar" ? "آخر تحديث: 12 أغسطس 2026" : "Last updated: August 12, 2026"}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {[
            {
              num: "1",
              titleAr: "جمع البيانات",
              titleEn: "Data Collection",
              textAr:
                "لا يقوم موقع DXFix بجمع أو تخزين ملفات DXF التي يرفعها المستخدمون على خوادمنا. جميع عمليات المعالجة تتم داخل متصفحك مباشرةً وبشكل محلي 100%.",
              textEn:
                "DXFix does not collect or store DXF files uploaded by users on our servers. All processing happens locally in your browser at 100%.",
            },
            {
              num: "2",
              titleAr: "ملفات الارتباط (Cookies)",
              titleEn: "Cookies",
              textAr:
                "نستخدم ملفات تعريف الارتباط فقط لتحسين تجربتك وحفظ تفضيلات اللغة. يمكنك التحكم الكامل في هذه الملفات من إعدادات المتصفح.",
              textEn:
                "We use cookies only to improve your experience and save language preferences. You have full control over these files from your browser settings.",
            },
            {
              num: "3",
              titleAr: "الإعلانات وشركاء التحليل",
              titleEn: "Advertising & Analytics Partners",
              textAr:
                "قد يستخدم الموقع خدمات طرف ثالث (مثل Google AdSense وMonetag) لعرض إعلانات ملائمة. هذه الخدمات لها سياسات خصوصية مستقلة.",
              textEn:
                "The site may use third-party services (such as Google AdSense and Monetag) to display relevant ads. These services have independent privacy policies.",
            },
            {
              num: "4",
              titleAr: "حقوق المستخدم",
              titleEn: "User Rights",
              textAr: "يحق لك طلب حذف أي بيانات تخصك في أي وقت. للتواصل راسلنا عبر صفحة الدعم.",
              textEn:
                "You have the right to request deletion of any data related to you at any time. To contact us, visit our support page.",
            },
          ].map((sec) => (
            <section
              key={sec.num}
              style={{
                backgroundColor: "rgba(17,22,30,0.7)",
                border: "1px solid rgba(30,41,59,0.8)",
                borderRadius: 16,
                padding: 32,
                backdropFilter: "blur(12px)",
                boxShadow: "var(--shadow-elegant)",
              }}
            >
              <h2
                style={{
                  fontWeight: 700,
                  fontSize: 18,
                  marginBottom: 12,
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>{sec.num}.</span>
                <span>{lang === "ar" ? sec.titleAr : sec.titleEn}</span>
              </h2>
              <p style={{ color: "var(--muted-foreground)", fontSize: 15, lineHeight: 1.8 }}>
                {lang === "ar" ? sec.textAr : sec.textEn}
              </p>
            </section>
          ))}
        </div>

        <div style={{ marginTop: 48, textAlign: "center" }}>
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              borderRadius: 12,
              backgroundColor: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.3)",
              color: "var(--accent)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <span>{dir === "rtl" ? "←" : "→"}</span>
            <span>{lang === "ar" ? "العودة إلى الصفحة الرئيسية" : "Back to Home"}</span>
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(30,41,59,0.6)",
          padding: "32px 24px",
          textAlign: "center",
          fontSize: 12,
          color: "var(--muted-foreground)",
          fontFamily: "monospace",
        }}
      >
        © 2026 DXFix. جميع الحقوق محفوظة.
        {" | "}
        <a href="/terms" style={{ color: "var(--accent)", textDecoration: "none" }}>
          {lang === "ar" ? "شروط الخدمة" : "Terms"}
        </a>
      </footer>
    </div>
  );
}
