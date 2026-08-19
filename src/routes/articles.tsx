import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getLangDir, type Lang } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export const Route = createFileRoute("/articles")({
  head: () => ({
    meta: [
      { title: "الدليل الشامل والمقالات | DXFix User Manual & Guides" },
      {
        name: "description",
        content:
          "دليل الاستخدام الشامل لأداة DXFix ومجموعة مقالات ودلائل تعليمية لورش القص بالليزر والبلازما والـ CNC.",
      },
      {
        name: "keywords",
        content: "دليل استخدام DXFix, إصلاح ملفات DXF, ماكينات CNC, قص ليزر, خطوط مكررة DXF",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: ArticlesPage,
});

const ARTICLES = [
  {
    id: "user-guide",
    emoji: "📖",
    titleAr: "دليل الاستخدام الشامل: فحص وإصلاح ملفات DXF لورش الـ CNC والليزر والبلازما",
    titleEn: "Complete User Guide: Inspect & Repair DXF Files for CNC Laser Workshops",
    summaryAr:
      "دليل خطوة بخطوة: رفع الملفات، قراءة تقرير التشخيص، إصلاح المسارات، ومحاكاة القص 3D قبل البدء الفعلي.",
    summaryEn:
      "Step-by-step guide: upload files, read diagnostic report, repair paths, and simulate cutting before the real job.",
    date: "2026-08-12",
    isGuide: true,
    contentAr: `الخطوة 1️⃣ — رفع الملف\nاضغط على زر "ارفع ملف DXF" أو اسحب الملف وأفلته. تدعم الأداة DXF بجميع الإصدارات إضافةً إلى تحويل SVG.\n\nالخطوة 2️⃣ — التشخيص والتقييم (0-100)\nتفحص الخوارزمية الملف خلال أقل من 5 ثوانٍ وتعطيك:\n• كشف الخطوط المكررة (Duplicate Lines)\n• كشف المسارات المفتوحة (Open Loops)\n• تنظيم الطبقات (Layers)\n• حساب الأبعاد والمحيط الكلي\n\nالخطوة 3️⃣ — الإصلاح التلقائي 🔧\nبنقرة واحدة يتم علاج كافة المشاكل دون المساس بالأبعاد الأصلية.\n\nالخطوة 4️⃣ — التنزيل ⬇️\nحمّل ملف DXF نظيف 100% متوافق مع: LaserCAD, RDWorks, Mach3, FastCAM, SheetCAM.`,
  },
  {
    id: "duplicate-lines",
    emoji: "🔁",
    titleAr: "كيفية اكتشاف وإصلاح الخطوط المكررة في ملفات DXF",
    titleEn: "How to Detect and Fix Duplicate Lines in DXF Files",
    summaryAr:
      "الخطوط المكررة هي السبب الأول في حرق الحواف وتوقف الماكينات. تعرّف على كيفية إصلاحها تلقائياً بأداة DXFix.",
    summaryEn:
      "Duplicate lines are the leading cause of edge burning and machine stalls. Learn how to auto-fix them with DXFix.",
    date: "2026-08-01",
    isGuide: false,
    contentAr: `ما هي الخطوط المكررة؟\nعند نقل التصميم بين برامج مثل AutoCAD وCorelDraw وIllustrator، قد يُرسم نفس الخط مرتين. النتيجة:\n• إمرار الليزر مرتين فوق نفس المسار\n• حرق حواف الخامة (معدن / أكريليك / خشب)\n• إهدار وقت التشغيل والكهرباء\n\nكيف تصلحها DXFix؟\nنستخدم خوارزميات دمج المتجهات (Vector Merging) لتحليل كل الكيانات ومطابقة نقاط البداية والنهاية، ثم نصدر ملفاً نظيفاً يقلل وقت القص حتى 40%.`,
  },
  {
    id: "open-loops",
    emoji: "🔓",
    titleAr: "إغلاق الأشكال والمسارات المفتوحة في ملفات DXF",
    titleEn: "Closing Open Shapes and Polylines in DXF Files",
    summaryAr:
      "الفجوات الميكرونية بين الخطوط تمنع الماكينة من التعرف على الشكل المغلق. تعرّف على طريقة إغلاقها.",
    summaryEn:
      "Micro gaps between lines prevent the machine from recognizing closed shapes. Learn how to close them.",
    date: "2026-07-28",
    isGuide: false,
    contentAr: `ما هي المسارات المفتوحة؟\nعند وجود فجوة غير مرئية (مثلاً 0.01mm) بين نقطتين، يعتبر برنامج القص أن الشكل غير مكتمل ولا يمكنه حساب مسار الـ Offset بشكل صحيح.\n\nالحل مع DXFix:\nتفحص الأداة كل نقاط الاتصال وتغلق أي فجوات ميكرونية تلقائياً، لتحصل على تقييم 100/100 لجاهزية القص.`,
  },
];

function ArticlesPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const [activeId, setActiveId] = useState<string | null>("user-guide");
  const dir = getLangDir(lang);

  const selected = ARTICLES.find((a) => a.id === activeId);

  const cardStyle = (isGuide: boolean): React.CSSProperties => ({
    backgroundColor: isGuide ? "rgba(16,185,129,0.08)" : "rgba(17,22,30,0.7)",
    border: `1px solid ${isGuide ? "rgba(16,185,129,0.4)" : "rgba(30,41,59,0.8)"}`,
    borderRadius: 16,
    padding: 24,
    cursor: "pointer",
    transition: "border-color 0.2s",
    boxShadow: "var(--shadow-elegant)",
  });

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
              {lang === "ar" ? "الأداة" : "Tool"}
            </a>
            <LanguageSwitcher currentLang={lang} onLangChange={setLang} />
          </div>
        </div>
      </header>

      <main
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: 960,
          margin: "0 auto",
          padding: "56px 24px",
        }}
      >
        {!selected ? (
          <>
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
                📚 {lang === "ar" ? "مدونة ودلائل DXFix" : "Guides & Blog"}
              </span>
              <h1 style={{ fontWeight: 800, fontSize: 38, marginTop: 16, lineHeight: 1.2 }}>
                {lang === "ar"
                  ? "الدليل الشامل ومقالات القص الميكانيكي"
                  : "DXF Manual & CNC Cutting Guides"}
              </h1>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 20,
              }}
            >
              {ARTICLES.map((art) => (
                <div
                  key={art.id}
                  style={cardStyle(art.isGuide)}
                  onClick={() => setActiveId(art.id)}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "var(--muted-foreground)",
                      fontFamily: "monospace",
                      marginBottom: 12,
                    }}
                  >
                    <span>📅 {art.date}</span>
                    {art.isGuide && (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          backgroundColor: "rgba(16,185,129,0.2)",
                          color: "var(--accent)",
                          border: "1px solid rgba(16,185,129,0.4)",
                        }}
                      >
                        {lang === "ar" ? "دليل معتمد" : "Official Guide"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{art.emoji}</div>
                  <h2 style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.5, marginBottom: 10 }}>
                    {lang === "ar" ? art.titleAr : art.titleEn}
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
                    {lang === "ar" ? art.summaryAr : art.summaryEn}
                  </p>
                  <div
                    style={{ marginTop: 16, color: "var(--accent)", fontWeight: 600, fontSize: 13 }}
                  >
                    {lang === "ar" ? "اقرأ الدليل ←" : "Read guide →"}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <button
              onClick={() => setActiveId(null)}
              style={{
                marginBottom: 24,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 18px",
                borderRadius: 10,
                cursor: "pointer",
                backgroundColor: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.3)",
                color: "var(--accent)",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {dir === "rtl" ? "→" : "←"} {lang === "ar" ? "العودة للمقالات" : "Back to articles"}
            </button>

            <article
              style={{
                backgroundColor: "rgba(17,22,30,0.85)",
                border: "1px solid rgba(30,41,59,0.8)",
                borderRadius: 20,
                padding: 40,
                boxShadow: "var(--shadow-elegant)",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 16 }}>{selected.emoji}</div>
              {selected.isGuide && (
                <span
                  style={{
                    display: "inline-block",
                    marginBottom: 12,
                    padding: "3px 12px",
                    borderRadius: 999,
                    backgroundColor: "rgba(16,185,129,0.2)",
                    color: "var(--accent)",
                    border: "1px solid rgba(16,185,129,0.4)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {lang === "ar" ? "دليل معتمد" : "Official Guide"}
                </span>
              )}
              <h1 style={{ fontWeight: 800, fontSize: 28, lineHeight: 1.4, marginBottom: 24 }}>
                {lang === "ar" ? selected.titleAr : selected.titleEn}
              </h1>
              <div
                style={{
                  color: "var(--muted-foreground)",
                  lineHeight: 2,
                  fontSize: 15,
                  whiteSpace: "pre-line",
                }}
              >
                {selected.contentAr}
              </div>
              <div
                style={{
                  marginTop: 32,
                  paddingTop: 24,
                  borderTop: "1px solid rgba(30,41,59,0.6)",
                  textAlign: "center",
                }}
              >
                <a
                  href="/tool"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 28px",
                    borderRadius: 12,
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-foreground)",
                    fontWeight: 700,
                    fontSize: 15,
                    textDecoration: "none",
                  }}
                >
                  🚀 {lang === "ar" ? "جرب الأداة الآن" : "Try Tool Now"}
                </a>
              </div>
            </article>
          </div>
        )}
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
      </footer>
    </div>
  );
}
