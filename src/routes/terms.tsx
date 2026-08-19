import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getLangDir, type Lang } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "شروط الخدمة | Terms of Service — DXFix" },
      {
        name: "description",
        content: "شروط الأحكام والاستخدام لخدمات وموقع DXFix لتقييم وإصلاح ملفات DXF لورش CNC.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: TermsPage,
});

const SECTIONS = [
  {
    num: "1",
    titleAr: "قبول الشروط",
    titleEn: "Acceptance of Terms",
    textAr:
      "باستخدامك لموقع DXFix وأدواته، فإنك توافق على الالتزام بشروط الخدمة هذه وجميع القوانين واللوائح المعمول بها.",
    textEn:
      "By accessing and using DXFix services, you agree to be bound by these Terms of Service and applicable laws.",
  },
  {
    num: "2",
    titleAr: "طبيعة الخدمة والمسؤولية",
    titleEn: "Service Nature & Disclaimer",
    textAr:
      "يوفر موقع DXFix أدوات تحليلية وتلقائية لفحص وإصلاح ملفات DXF. يبذل الموقع قصارى جهده لتقديم أدق نتائج الإصلاح، ولكن يتعين على المشغّل مراجعة وتأكيد أبعاد الملف قبل إجراء عمليات القص الفعلي.",
    textEn:
      "DXFix provides automated tools to analyze and repair DXF files. While we strive for maximum accuracy, operators must verify file dimensions prior to physical cutting.",
  },
  {
    num: "3",
    titleAr: "حقوق الملكية الفكرية",
    titleEn: "Intellectual Property",
    textAr:
      "يحتفظ المستخدم بكامل ملكيته الفكرية والتصميمية للملفات التي يرفعها على الموقع. لا يدعي موقع DXFix أي ملكية لأعمال المستخدمين.",
    textEn:
      "Users retain full intellectual property ownership of all files uploaded to DXFix. DXFix claims no ownership over user work.",
  },
  {
    num: "4",
    titleAr: "الاستخدام المقبول",
    titleEn: "Acceptable Use",
    textAr:
      "يُحظر استخدام الموقع لأغراض غير قانونية أو ضارة أو مخالفة للأنظمة المعمول بها. نحتفظ بالحق في إيقاف الوصول عند الإخلال بهذه الشروط.",
    textEn:
      "Using the site for illegal, harmful, or regulatory-violating purposes is prohibited. We reserve the right to suspend access upon breach of these terms.",
  },
];

function TermsPage() {
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
            📜 {lang === "ar" ? "الشروط والتنظيم" : "Terms & Governance"}
          </span>
          <h1 style={{ fontWeight: 800, fontSize: 40, marginTop: 16, lineHeight: 1.2 }}>
            {lang === "ar" ? "شروط الخدمة والاستخدام" : "Terms of Service"}
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
          {SECTIONS.map((sec) => (
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
        <a href="/privacy" style={{ color: "var(--accent)", textDecoration: "none" }}>
          {lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
        </a>
      </footer>
    </div>
  );
}
