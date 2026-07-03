import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect } from "react";
import { analyzeDxf, repairDxf, scoreColor, scoreBg, scoreLabel, getDxfBounds, buildSvgPaths } from "@/lib/dxf";
import type { DxfAnalysis, DxfIssue } from "@/lib/dxf";

interface HistoryEntry {
  id: string;
  fileName: string;
  score: number;
  date: string;
  issueCount: number;
  totalEntities: number;
  layers: number;
  wasRepaired: boolean;
}

const LAYER_COLORS = ["#00d4ff", "#ffd700", "#a855f7", "#34d399", "#f97316", "#ec4899", "#60a5fa"];

function DxfPreview({ analysis, issueIndices, lang }: {
  analysis: DxfAnalysis;
  issueIndices: Set<number>;
  lang: "ar" | "en";
}) {
  const [zoom, setZoom] = useState(1);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [issuesOnly, setIssuesOnly] = useState(false);

  const bounds = getDxfBounds(analysis.entities);
  if (!bounds || bounds.width === 0 || bounds.height === 0) {
    return (
      <p className="text-center font-mono text-xs text-muted-foreground py-8">
        {lang === "ar" ? "لا يمكن رسم معاينة — الملف لا يحتوي على إحداثيات" : "Cannot render preview — no geometry found"}
      </p>
    );
  }

  const PAD = Math.max(bounds.width, bounds.height) * 0.05;
  const vx = bounds.minX - PAD;
  const vy = bounds.minY - PAD;
  const vw = bounds.width + PAD * 2;
  const vh = bounds.height + PAD * 2;
  const allPaths = buildSvgPaths(analysis.entities, bounds);
  const layerList = analysis.stats.layers;

  function layerColor(layer: string) {
    const idx = layerList.indexOf(layer);
    return LAYER_COLORS[idx % LAYER_COLORS.length] ?? "#00d4ff";
  }

  function toggleLayer(layer: string) {
    setHiddenLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer); else next.add(layer);
      return next;
    });
  }

  const visiblePaths = allPaths.filter(p => {
    if (hiddenLayers.has(p.layer)) return false;
    if (issuesOnly && !issueIndices.has(p.entityIndex)) return false;
    return true;
  });

  const strokeW = Math.max(bounds.width, bounds.height) * 0.004;
  const hasIssues = issueIndices.size > 0;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border gap-3 flex-wrap">
        <span className="font-display font-semibold text-sm">
          {lang === "ar" ? "🖼 معاينة الرسم" : "🖼 Drawing Preview"}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {hasIssues && (
            <button
              onClick={() => setIssuesOnly(v => !v)}
              className={`font-mono text-xs px-3 py-1 rounded-lg border transition ${
                issuesOnly
                  ? "border-red-500 bg-red-500/20 text-red-400"
                  : "border-border text-muted-foreground hover:border-red-500/50 hover:text-red-400"
              }`}
            >
              {lang === "ar" ? "المشاكل فقط" : "Issues only"}
            </button>
          )}
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="w-7 h-7 rounded-lg bg-muted text-sm font-bold hover:bg-muted/80 transition">−</button>
          <span className="font-mono text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="w-7 h-7 rounded-lg bg-muted text-sm font-bold hover:bg-muted/80 transition">+</button>
          <button onClick={() => setZoom(1)} className="font-mono text-xs text-muted-foreground/60 hover:text-foreground transition px-2">
            {lang === "ar" ? "ملاءمة" : "Fit"}
          </button>
        </div>
      </div>

      {/* SVG canvas */}
      <div className="overflow-auto" style={{ maxHeight: "440px" }}>
        <svg
          viewBox={`${vx} ${vy} ${vw} ${vh}`}
          width={Math.round(560 * zoom)}
          height={Math.round(560 * zoom * (vh / vw))}
          style={{ display: "block", margin: "0 auto", background: "#0d1117" }}
        >
          {visiblePaths.map((p, i) => {
            const isIssue = issueIndices.has(p.entityIndex);
            const color = isIssue ? "#ef4444" : layerColor(p.layer);
            return (
              <path
                key={i}
                d={p.d}
                stroke={color}
                strokeWidth={strokeW}
                fill="none"
                opacity={isIssue ? 1 : 0.85}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
        </svg>
      </div>

      {/* Layer toggles */}
      <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-border">
        {layerList.map((layer, i) => {
          const color = LAYER_COLORS[i % LAYER_COLORS.length];
          const hidden = hiddenLayers.has(layer);
          return (
            <button
              key={layer}
              onClick={() => toggleLayer(layer)}
              title={hidden
                ? (lang === "ar" ? "اضغط لإظهار الطبقة" : "Click to show layer")
                : (lang === "ar" ? "اضغط لإخفاء الطبقة" : "Click to hide layer")}
              className={`flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-lg border transition select-none ${
                hidden
                  ? "border-border/40 text-muted-foreground/30 line-through"
                  : "border-border/60 text-muted-foreground hover:border-white/30 hover:text-foreground"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shrink-0 transition"
                style={{ background: hidden ? "#444" : color }}
              />
              {layer}
            </button>
          );
        })}
        {hasIssues && (
          <span className="flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 text-red-400">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-red-500" />
            {lang === "ar" ? "مشاكل" : "Issues"}
          </span>
        )}
        {layerList.length > 1 && hiddenLayers.size > 0 && (
          <button
            onClick={() => setHiddenLayers(new Set())}
            className="font-mono text-xs text-muted-foreground/50 hover:text-foreground transition px-1"
          >
            {lang === "ar" ? "إظهار الكل" : "Show all"}
          </button>
        )}
      </div>
    </div>
  );
}

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
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const isRTL = lang === "ar";

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dxfix_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  function saveToHistory(name: string, result: DxfAnalysis, repaired = false) {
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      fileName: name,
      score: repaired ? 100 : result.score,
      date: new Date().toLocaleString("ar-SA"),
      issueCount: result.issues.length,
      totalEntities: result.stats.totalEntities,
      layers: result.stats.layers.length,
      wasRepaired: repaired,
    };
    setHistory(prev => {
      const next = [entry, ...prev].slice(0, 5);
      localStorage.setItem("dxfix_history", JSON.stringify(next));
      return next;
    });
  }

  function clearHistory() {
    localStorage.removeItem("dxfix_history");
    setHistory([]);
  }

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
      historyTitle: "آخر الملفات المحللة",
      historyClear: "مسح السجل",
      historyEmpty: "لا يوجد سجل بعد — ارفع أول ملف DXF",
      historyIssues: "مشاكل",
      historyEntities: "عنصر",
      historyLayers: "طبقة",
      historyRepaired: "مُصلَح",
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
      historyTitle: "Recent Files",
      historyClear: "Clear history",
      historyEmpty: "No history yet — upload your first DXF file",
      historyIssues: "issues",
      historyEntities: "entities",
      historyLayers: "layers",
      historyRepaired: "Repaired",
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
        saveToHistory(file.name, result, false);
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
    saveToHistory(fileName, analysis, true);
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

        {/* FILE HISTORY */}
        {stage === "upload" && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                📋 {t.historyTitle}
              </h3>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="font-mono text-xs text-muted-foreground/60 hover:text-destructive transition"
                >
                  {t.historyClear}
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground/50 text-center py-6 border border-dashed border-border rounded-xl">
                {t.historyEmpty}
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => {
                  const color =
                    entry.score >= 80 ? "text-green-400" :
                    entry.score >= 50 ? "text-yellow-400" : "text-red-400";
                  const bg =
                    entry.score >= 80 ? "border-green-400/20 bg-green-400/5" :
                    entry.score >= 50 ? "border-yellow-400/20 bg-yellow-400/5" :
                                        "border-red-400/20 bg-red-400/5";
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${bg}`}
                    >
                      <div className={`font-display font-bold text-2xl min-w-[3rem] text-center ${color}`}>
                        {entry.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-semibold truncate">{entry.fileName}</p>
                        <p className="font-mono text-xs text-muted-foreground mt-0.5">
                          {entry.totalEntities} {t.historyEntities} · {entry.layers} {t.historyLayers}
                          {entry.issueCount > 0 && ` · ${entry.issueCount} ${t.historyIssues}`}
                          {entry.wasRepaired && (
                            <span className="ml-2 text-green-400">✓ {t.historyRepaired}</span>
                          )}
                        </p>
                      </div>
                      <div className="font-mono text-xs text-muted-foreground/50 shrink-0 text-end">
                        {entry.date}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

            {/* SVG Preview */}
            {(() => {
              const issueIndices = new Set(analysis.issues.flatMap(i => i.entityIndices));
              return <DxfPreview analysis={analysis} issueIndices={issueIndices} lang={lang} />;
            })()}

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
