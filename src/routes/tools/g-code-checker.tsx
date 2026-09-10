import React, { useRef, useState, useCallback } from "react";
import { saveAs } from "file-saver";
import { createFileRoute } from "@tanstack/react-router";
import {
  analyzeGCode,
  formatDuration,
  SAMPLE_GCODE,
  DEFAULT_LIMITS,
  type GCheckResult,
  type GIssue,
  type GIssueKind,
  type MachineLimits,
} from "@/lib/gcode-engine";

// ===================== UI Component =====================

function GCodeChecker() {
  const [code, setCode] = useState(SAMPLE_GCODE);
  const [result, setResult] = useState<GCheckResult | null>(null);
  const [limitX, setLimitX] = useState(DEFAULT_LIMITS.maxX);
  const [limitY, setLimitY] = useState(DEFAULT_LIMITS.maxY);
  const [limitZ, setLimitZ] = useState(DEFAULT_LIMITS.maxZ);
  const [limitFeed, setLimitFeed] = useState(DEFAULT_LIMITS.maxFeed);
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [fileName, setFileName] = useState("program.gcode");
  const fileRef = useRef<HTMLInputElement>(null);

  const runCheck = useCallback(() => {
    const res = analyzeGCode(code, { maxX: limitX, maxY: limitY, maxZ: limitZ, maxFeed: limitFeed });
    setResult(res);
  }, [code, limitX, limitY, limitZ, limitFeed]);

  const onFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setCode(text);
    setFileName(file.name);
  };

  const downloadReport = () => {
    if (!result) return;
    const t = lang === "ar";
    const lines = [
      t ? "تقرير فحص G-Code — DXFix" : "G-Code Inspection Report — DXFix",
      `File: ${fileName}`,
      t ? `الحالة: ${result.ok ? "✅ جاهز" : "❌ فيه أخطاء"}` : `Status: ${result.ok ? "✅ Ready" : "❌ Has errors"}`,
      `--------------------------------------------------`,
      t ? `عدد الأسطر/الكتل: ${result.lines}` : `Blocks/Lines: ${result.lines}`,
      t ? `حركات سريعة (G0): ${result.rapidCount}` : `Rapid moves (G0): ${result.rapidCount}`,
      t ? `حركات قص (G1): ${result.cutCount}` : `Cutting moves (G1): ${result.cutCount}`,
      t ? `إجمالي المسافة: ${result.totalDistance} مم` : `Total distance: ${result.totalDistance} mm`,
      t ? `مسافة القص: ${result.totalCutDistance} مم` : `Cutting distance: ${result.totalCutDistance} mm`,
      t ? `زمن الدورة التقديري: ${formatDuration(result.cycleTimeSec ?? 0)}` : `Estimated cycle time: ${formatDuration(result.cycleTimeSec ?? 0)}`,
      `--------------------------------------------------`,
      t ? `الحدود: X [${result.bounds.minX} – ${result.bounds.maxX}] Y [${result.bounds.minY} – ${result.bounds.maxY}] Z [${result.bounds.minZ} – ${result.bounds.maxZ}]` : `Bounds: X [${result.bounds.minX} – ${result.bounds.maxX}] Y [${result.bounds.minY} – ${result.bounds.maxY}] Z [${result.bounds.minZ} – ${result.bounds.maxZ}]`,
      ``,
      t ? `الملاحظات (${result.issues.length}):` : `Findings (${result.issues.length}):`,
      ...result.issues.map((i) => `[L${i.line}] ${i.kind.toUpperCase()} ${i.code}: ${lang === "ar" ? i.messageAr : i.messageEn}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    saveAs(blob, fileName.replace(/\.(gcode|nc|tap|cnc)$/i, "") + "_report.txt");
  };

  const cleanCode = () => {
    const cleaned = code
      .split(/\r?\n/)
      .map((l) => l.replace(/\s*$/, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
    setCode(cleaned.trim());
    runCheck();
  };

  const t = lang === "ar";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
        <div className="text-center mb-10">
          <p className="font-mono text-xs text-accent uppercase tracking-[0.25em]">Tools</p>
          <h1 className="font-display mt-3 text-3xl sm:text-4xl font-bold">
            {t ? "مدقق ومحسّن أكواد G-Code" : "G-Code Error Checker & Optimizer"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl mx-auto">
            {t
              ? "افحص ملف التشغيل قبل التحميل على الماكينة: حركات خارج الحدود، معدلات تغذية زائدة، كتل مكررة، وتقدير زمن الدورة."
              : "Pre-flight your tooling files: out-of-bounds moves, excessive feed rates, duplicate blocks, and cycle-time estimation."}
          </p>
        </div>

        {/* Language toggle */}
        <div className="flex justify-center gap-2 mb-8">
          <button onClick={() => setLang("ar")} className={`px-5 py-2 rounded-lg text-sm font-semibold ${lang === "ar" ? "bg-accent text-accent-foreground" : "bg-card border border-border"}`}>
            العربية
          </button>
          <button onClick={() => setLang("en")} className={`px-5 py-2 rounded-lg text-sm font-semibold ${lang === "en" ? "bg-accent text-accent-foreground" : "bg-card border border-border"}`}>
            English
          </button>
        </div>
{/* Machine limits */}
        <div className="bg-card/60 border border-border rounded-2xl p-6 mb-8">
          <h3 className="font-display font-bold mb-4">{t ? "🛠️ حدود الماكينة" : "🛠️ Machine limits"}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">X max (mm)</label>
              <input type="number" value={limitX} onChange={(e) => setLimitX(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Y max (mm)</label>
              <input type="number" value={limitY} onChange={(e) => setLimitY(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Z max (mm)</label>
              <input type="number" value={limitZ} onChange={(e) => setLimitZ(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Feed max (mm/min)</label>
              <input type="number" value={limitFeed} onChange={(e) => setLimitFeed(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        {/* Code input */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-display font-bold">{t ? "📄 كود G-Code" : "📄 G-Code program"}</h3>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".gcode,.nc,.tap,.cnc,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:border-accent/60 transition">
                {t ? "📂 رفع ملف" : "📂 Upload file"}
              </button>
              <button onClick={() => setCode(SAMPLE_GCODE)} className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:border-accent/60 transition">
                {t ? "مثال" : "Sample"}
              </button>
            </div>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            dir="ltr"
            className="w-full h-64 rounded-lg border border-border bg-background p-4 font-mono text-sm leading-relaxed focus:outline-none focus:border-accent/60 transition resize-y"
          />
          <div className="flex flex-wrap gap-3 mt-4">
            <button onClick={runCheck} className="rounded-lg bg-accent px-6 py-3 text-sm font-bold text-accent-foreground hover:opacity-90 transition shadow-[var(--shadow-spark)]">
              {t ? "🔍 تشغيل الفحص" : "🔍 Run inspection"}
            </button>
            <button onClick={cleanCode} className="rounded-lg border border-border bg-background px-6 py-3 text-sm font-semibold hover:border-accent/60 transition">
              {t ? "🧹 تنظيف التنسيق" : "🧹 Clean formatting"}
            </button>
          </div>
        </div>
{/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Summary */}
            <div className={`rounded-2xl p-6 border ${result.ok ? "border-green-500/40 bg-green-500/5" : "border-red-500/40 bg-red-500/5"}`}>
              <div className="flex flex-wrap items-center gap-4">
                <div className={`text-4xl ${result.ok ? "text-green-400" : "text-red-400"}`}>{result.ok ? "✅" : "❌"}</div>
                <div>
                  <h3 className="font-display text-xl font-bold">
                    {result.ok ? (t ? "الملف جاهز للماكينة" : "File is machine-ready") : (t ? "تم العثور على أخطاء" : "Errors found")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t ? `${result.issues.filter(i => i.kind === "error").length} خطأ، ${result.issues.filter(i => i.kind === "warning").length} تحذير` : `${result.issues.filter(i => i.kind === "error").length} errors, ${result.issues.filter(i => i.kind === "warning").length} warnings`}
                  </p>
                </div>
                <div className="ms-auto flex gap-2">
                  <button onClick={downloadReport} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:opacity-90 transition">
                    {t ? "⬇ تقرير TXT" : "⬇ TXT report"}
                  </button>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  [t ? "أسطر" : "Blocks", String(result.lines)],
                  [t ? "مسافة القص" : "Cut dist.", `${result.totalCutDistance} mm`],
                  [t ? "زمن الدورة" : "Cycle time", formatDuration(result.cycleTimeSec ?? 0)],
                  [t ? "أقصى تغذية" : "Max feed", `${result.maxFeed} mm/min`],
                ].map(([label, val]) => (
                  <div key={String(label)} className="bg-background border border-border rounded-xl px-4 py-3 text-center">
                    <div className="text-xl font-bold text-primary">{val}</div>
                    <div className="text-xs text-muted-foreground mt-1">{label}</div>
                  </div>
                ))}
              </div>
              {/* Bounds */}
              <div className="mt-4 flex flex-wrap gap-4 font-mono text-xs text-muted-foreground">
                <span>X: [{result.bounds.minX.toFixed(1)} – {result.bounds.maxX.toFixed(1)}]</span>
                <span>Y: [{result.bounds.minY.toFixed(1)} – {result.bounds.maxY.toFixed(1)}]</span>
                <span>Z: [{result.bounds.minZ.toFixed(1)} – {result.bounds.maxZ.toFixed(1)}]</span>
              </div>
            </div>

            {/* Issues list */}
            {result.issues.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="font-display font-bold mb-4">{t ? "📋 الملاحظات" : "📋 Findings"}</h3>
                <div className="space-y-3">
                  {result.issues.map((issue, i) => (
                    <div key={i} className={`flex gap-3 items-start p-3 rounded-xl border text-sm ${
                      issue.kind === "error"
                        ? "border-red-500/30 bg-red-500/5 text-red-300"
                        : issue.kind === "warning"
                          ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-200"
                          : "border-blue-500/30 bg-blue-500/5 text-blue-300"
                    }`}>
                      <span className="font-mono text-xs opacity-70">L{issue.line}</span>
                      <span>{lang === "ar" ? issue.messageAr : issue.messageEn}</span>
                      <span className="ms-auto font-mono text-xs opacity-60">{issue.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.issues.length === 0 && (
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-sm text-muted-foreground">{t ? "لا توجد ملاحظات — الكود نظيف." : "No findings — the program is clean."}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-12 bg-card/60 border border-border rounded-2xl p-6">
          <h3 className="font-display font-bold mb-3">{t ? "💡 نصائح" : "💡 Tips"}</h3>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>{t ? "اضبط حدود الماكينة على أبعاد سريرك الفعلية قبل الفحص." : "Set machine limits to your actual bed size before inspecting."}</li>
            <li>{t ? "زمن الدورة تقديري ويُحسب من معدل التغذية فقط — أضف زمن الثقب/النبض للحصول على أدق رقم." : "Cycle time is an estimate from feed rate only — add pierce time for a tighter number."}</li>
            <li>{t ? "الملفات .nc و.tap من محوّلات CAM تُفحص مباشرةً." : ".nc / .tap files from CAM converters can be inspected directly."}</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/tools/g-code-checker")({
  component: GCodeChecker,
});
