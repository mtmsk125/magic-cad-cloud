import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { analyzeDxf, repairDxf, scoreColor, scoreBg, scoreLabel } from "@/lib/dxf";
import type { DxfAnalysis, DxfIssue } from "@/lib/dxf";

export const Route = createFileRoute("/tool")({
  head: () => ({
    meta: [
      { title: "DXFix — أداة إصلاح ملفات DXF" },
      { name: "description", content: "ارفع ملف DXF، نكشف الأخطاء ونصلحها تلقائياً، وتحمّل ملفاً نظيفاً جاهزاً للقص." },
    ],
  }),
  component: ToolPage,
});

type Lang = "ar" | "en";

type Stage = "upload" | "analyzing" | "result" | "repaired";

function ToolPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const [stage, setStage] = useState<Stage>("upload");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [analysis, setAnalysis] = useState<DxfAnalysis | null>(null);
  const [repairedContent, setRepairedContent] = useState("");
  const [repairedIssues, setRepairedIssues] = useState<DxfIssue[]>([]);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const isRTL = lang === "ar";

  const T = {
    ar: {
      nav: "العودة للموقع",
      title: "أداة إصلاح DXF",
      sub: "ارفع ملفك — نحلله ونصلحه تلقائياً",
      dropZone: "اسحب وأفلت ملف DXF هنا",
      dropOr: "أو",
      dropBtn: "اختر ملف من الجهاز",
      dropNote: "يدعم ملفات .dxf — المعالجة تتم في متصفحك تماماً",
      analyzing: "جاري تحليل الملف...",
      score: "تقييم الجاهزية",
      stats: "إحصائيات الملف",
      issues: "المشاكل المكتشفة",
      noIssues: "✓ لم تُكتشف أي مشاكل — الملف جاهز للقص!",
      repairBtn: "إصلاح تلقائي",
      downloadFixed: "تحميل الملف المُصلَح",
      downloadReport: "تحميل التقرير",
      reset: "تحليل ملف آخر",
      repaired: "تم الإصلاح التلقائي",
      repairedSub: "المشاكل التالية تم إصلاحها:",
      statTotal: "إجمالي العناصر",
      statLines: "خطوط",
      statPoly: "بوليلاينات",
      statArcs: "أقواس",
      statCircles: "دوائر",
      statLayers: "طبقات",
      langSwitch: "EN",
      severityError: "خطأ",
      severityWarn: "تحذير",
      fixedLabel: "تم الإصلاح ✓",
    },
    en: {
      nav: "Back to site",
      title: "DXF Repair Tool",
      sub: "Upload your file — we analyze and fix it automatically",
      dropZone: "Drag & drop your DXF file here",
      dropOr: "or",
      dropBtn: "Choose file from device",
      dropNote: "Supports .dxf files — all processing happens in your browser",
      analyzing: "Analyzing file...",
      score: "Readiness Score",
      stats: "File Statistics",
      issues: "Detected Issues",
      noIssues: "✓ No issues found — file is ready to cut!",
      repairBtn: "Auto-repair",
      downloadFixed: "Download Fixed File",
      downloadReport: "Download Report",
      reset: "Analyze another file",
      repaired: "Auto-repair complete",
      repairedSub: "The following issues were fixed:",
      statTotal: "Total entities",
      statLines: "Lines",
      statPoly: "Polylines",
      statArcs: "Arcs",
      statCircles: "Circles",
      statLayers: "Layers",
      langSwitch: "العربية",
      severityError: "Error",
      severityWarn: "Warning",
      fixedLabel: "Fixed ✓",
    },
  };

  const t = T[lang];

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".dxf")) {
      alert(lang === "ar" ? "يرجى رفع ملف بصيغة .dxf فقط" : "Please upload a .dxf file only");
      return;
    }
    setFileName(file.name);
    setStage("analyzing");
    setProgress(0);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);

      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 25;
        if (p >= 90) { clearInterval(interval); p = 90; }
        setProgress(Math.min(90, p));
      }, 120);

      setTimeout(() => {
        const result = analyzeDxf(content);
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => {
          setAnalysis(result);
          setStage("result");
        }, 400);
      }, 800);
    };
    reader.readAsText(file, "utf-8");
  }, [lang]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleRepair = () => {
    if (!analysis) return;
    const { fixed, repaired } = repairDxf(fileContent, analysis);
    setRepairedContent(fixed);
    setRepairedIssues(repaired);
    setStage("repaired");
  };

  const downloadFile = (content: string, name: string) => {
    const blob = new Blob([content], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadReport = () => {
    if (!analysis) return;
    const lines = [
      `DXFix Report — ${fileName}`,
      `Date: ${new Date().toLocaleString()}`,
      `Score: ${analysis.score}/100 — ${scoreLabel(analysis.score, lang)}`,
      "",
      "=== STATISTICS ===",
      `Total entities: ${analysis.stats.totalEntities}`,
      `Lines: ${analysis.stats.lines}`,
      `Polylines: ${analysis.stats.polylines}`,
      `Arcs: ${analysis.stats.arcs}`,
      `Circles: ${analysis.stats.circles}`,
      `Layers: ${analysis.stats.layers.join(", ")}`,
      "",
      "=== ISSUES ===",
      ...analysis.issues.map(i => `[${i.severity.toUpperCase()}] ${lang === "ar" ? i.ar : i.en}`),
      analysis.issues.length === 0 ? "No issues found." : "",
    ];
    downloadFile(lines.join("\n"), fileName.replace(".dxf", "_report.txt"));
  };

  const reset = () => {
    setStage("upload");
    setAnalysis(null);
    setFileContent("");
    setFileName("");
    setRepairedContent("");
    setRepairedIssues([]);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/60">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent" />
            DX<span className="text-accent">fix</span>
          </a>
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition">
              {isRTL ? "←" : "→"} {t.nav}
            </a>
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="font-mono text-xs px-3 py-1.5 rounded-md border border-border hover:border-primary/60 transition"
            >
              {t.langSwitch}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-12">
        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl sm:text-5xl font-bold">{t.title}</h1>
          <p className="mt-3 text-muted-foreground text-lg">{t.sub}</p>
        </div>

        {/* UPLOAD */}
        {stage === "upload" && (
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileRef.current?.click()}
            className={`
              cursor-pointer rounded-2xl border-2 border-dashed transition-all p-16 text-center
              ${dragging
                ? "border-accent bg-accent/10 scale-[1.01]"
                : "border-border hover:border-primary/50 hover:bg-card/60"}
            `}
          >
            <div className="text-6xl mb-5">📁</div>
            <p className="font-display text-xl font-semibold">{t.dropZone}</p>
            <p className="mt-3 text-muted-foreground text-sm">{t.dropOr}</p>
            <div className="mt-4 inline-flex px-6 py-3 rounded-lg bg-accent text-accent-foreground font-semibold shadow-[var(--shadow-spark)] hover:opacity-90 transition">
              {t.dropBtn}
            </div>
            <p className="mt-5 font-mono text-xs text-muted-foreground/60">{t.dropNote}</p>
            <input
              ref={fileRef}
              type="file"
              accept=".dxf"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
        )}

        {/* ANALYZING */}
        {stage === "analyzing" && (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <div className="text-5xl mb-6 animate-pulse">🔍</div>
            <p className="font-display text-xl font-semibold mb-2">{t.analyzing}</p>
            <p className="font-mono text-sm text-muted-foreground mb-8">{fileName}</p>
            <div className="max-w-md mx-auto bg-border rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground">{Math.round(progress)}%</p>
          </div>
        )}

        {/* RESULT */}
        {(stage === "result" || stage === "repaired") && analysis && (
          <div className="space-y-6">
            {/* Score card */}
            <div className={`rounded-2xl border p-8 flex flex-col sm:flex-row items-center gap-6 ${scoreBg(stage === "repaired" ? 100 : analysis.score)}`}>
              <div className="text-center">
                <div className={`font-display text-7xl font-bold ${scoreColor(stage === "repaired" ? 100 : analysis.score)}`}>
                  {stage === "repaired" ? 100 : analysis.score}
                </div>
                <div className="font-mono text-xs text-muted-foreground mt-1">/ 100</div>
              </div>
              <div className="flex-1 text-center sm:text-start">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{t.score}</p>
                <h2 className="font-display text-2xl font-bold mt-1">
                  {stage === "repaired"
                    ? (lang === "ar" ? "جاهز للقص ✓" : "Ready to cut ✓")
                    : scoreLabel(analysis.score, lang)}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 font-mono">{fileName}</p>
              </div>
              {stage === "repaired" && (
                <button
                  onClick={() => downloadFile(repairedContent, fileName.replace(".dxf", "_fixed.dxf"))}
                  className="px-6 py-3.5 rounded-xl bg-accent text-accent-foreground font-semibold hover:opacity-90 transition shadow-[var(--shadow-spark)] whitespace-nowrap"
                >
                  ⬇ {t.downloadFixed}
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-display font-semibold mb-4">{t.stats}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  [t.statTotal, analysis.stats.totalEntities],
                  [t.statLines, analysis.stats.lines],
                  [t.statPoly, analysis.stats.polylines],
                  [t.statArcs, analysis.stats.arcs],
                  [t.statCircles, analysis.stats.circles],
                  [t.statLayers, analysis.stats.layers.length],
                ].map(([label, val]) => (
                  <div key={label} className="bg-background rounded-xl p-4 text-center border border-border/60">
                    <div className="font-display text-2xl font-bold text-primary">{val}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-1">{label}</div>
                  </div>
                ))}
              </div>
              {analysis.stats.layers.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {analysis.stats.layers.map(l => (
                    <span key={l} className="font-mono text-xs px-2 py-1 rounded-md bg-secondary border border-border text-muted-foreground">
                      {l}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Issues */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-display font-semibold mb-4">{stage === "repaired" ? t.repaired : t.issues}</h3>

              {stage === "repaired" && repairedIssues.length > 0 && (
                <div className="space-y-3 mb-4">
                  {repairedIssues.map(issue => (
                    <div key={issue.id} className="flex items-start gap-3 p-4 rounded-xl border border-green-500/30 bg-green-500/5">
                      <span className="text-green-400 text-lg flex-shrink-0">✓</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{lang === "ar" ? issue.ar : issue.en}</p>
                      </div>
                      <span className="font-mono text-xs px-2 py-1 rounded-md bg-green-500/20 text-green-400">{t.fixedLabel}</span>
                    </div>
                  ))}
                </div>
              )}

              {stage === "result" && (
                analysis.issues.length === 0 ? (
                  <div className="p-6 rounded-xl border border-green-500/30 bg-green-500/5 text-center">
                    <p className="text-green-400 font-semibold">{t.noIssues}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analysis.issues.map(issue => (
                      <div
                        key={issue.id}
                        className={`flex items-start gap-3 p-4 rounded-xl border ${
                          issue.severity === "error"
                            ? "border-red-500/30 bg-red-500/5"
                            : "border-yellow-500/30 bg-yellow-500/5"
                        }`}
                      >
                        <span className={`text-lg flex-shrink-0 ${issue.severity === "error" ? "text-red-400" : "text-yellow-400"}`}>
                          {issue.severity === "error" ? "✕" : "⚠"}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{lang === "ar" ? issue.ar : issue.en}</p>
                          <p className="font-mono text-xs text-muted-foreground mt-1">
                            {issue.entityIndices.length} {lang === "ar" ? "عنصر متأثر" : "entity affected"}
                          </p>
                        </div>
                        <span className={`font-mono text-xs px-2 py-1 rounded-md ${
                          issue.severity === "error"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {issue.severity === "error" ? t.severityError : t.severityWarn}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Unrepaired issues in repaired stage */}
              {stage === "repaired" && analysis.issues.filter(i => !repairedIssues.find(r => r.id === i.id)).length > 0 && (
                <div className="space-y-3 mt-3">
                  {analysis.issues.filter(i => !repairedIssues.find(r => r.id === i.id)).map(issue => (
                    <div key={issue.id} className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
                      <span className="text-yellow-400 text-lg flex-shrink-0">⚠</span>
                      <p className="text-sm font-medium">{lang === "ar" ? issue.ar : issue.en}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                onClick={reset}
                className="px-5 py-2.5 rounded-lg border border-border hover:border-primary/60 font-semibold text-sm transition"
              >
                ↩ {t.reset}
              </button>
              <button
                onClick={downloadReport}
                className="px-5 py-2.5 rounded-lg border border-border hover:border-primary/60 font-semibold text-sm transition"
              >
                📄 {t.downloadReport}
              </button>
              {stage === "result" && analysis.issues.some(i => i.severity === "error") && (
                <button
                  onClick={handleRepair}
                  className="px-6 py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition shadow-[var(--shadow-spark)]"
                >
                  🔧 {t.repairBtn}
                </button>
              )}
              {stage === "result" && analysis.issues.length === 0 && (
                <button
                  onClick={() => downloadFile(fileContent, fileName)}
                  className="px-6 py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition shadow-[var(--shadow-spark)]"
                >
                  ⬇ {lang === "ar" ? "تحميل الملف" : "Download file"}
                </button>
              )}
              {stage === "repaired" && (
                <button
                  onClick={() => downloadFile(repairedContent, fileName.replace(".dxf", "_fixed.dxf"))}
                  className="px-6 py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition shadow-[var(--shadow-spark)]"
                >
                  ⬇ {t.downloadFixed}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
