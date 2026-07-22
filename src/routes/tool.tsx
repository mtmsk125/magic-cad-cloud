import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect } from "react";
import { analyzeDxf, repairDxf, scoreColor, scoreBg, scoreLabel, getDxfBounds, buildSvgPaths, calculateTotalPerimeter, detectOpenLoops, sortInsideFirst } from "@/lib/dxf";
import type { DxfAnalysis, DxfIssue, FixSummaryItem, DxfBounds, SvgPath } from "@/lib/dxf";
import { getSubscriptionData, isSubscribed, getFreeUsageCount, incrementFreeUsage, FREE_USAGE_LIMIT } from "@/lib/subscription";
import { downloadAllAsZip, triggerSelfDestruct, isSelfDestructTriggered } from "@/lib/zip-export";
import { track } from '@vercel/analytics';
import { FeedbackModal } from "@/components/feedback-modal";
import { ViralUnlockModal } from "@/components/viral-unlock-modal";
import { SafetyBadge } from "@/components/safety-badge";
import { AdBanner } from "@/components/AdBanner";
import { getUserSubscribed as isViralUnlocked, setUserSubscribed } from "@/lib/viral-launch";

/**
 * Ad slot component — only renders for free/unsubscribed users.
 * Hides completely for Pro/Workshop subscribers.
 * Integrates Google AdSense automatically when ad container is visible.
 */
function AdSlot({ lang, userIsSubscribed }: { lang: "ar" | "en"; userIsSubscribed: boolean }) {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only load AdSense ads for non-subscribed users
    if (userIsSubscribed) return;

    // Push a new ad slot to the global AdSense queue
    try {
      if ((window as any).adsbygoogle) {
        (window as any).adsbygoogle.push({});
      }
    } catch (e) {
      console.warn("AdSense push failed:", e);
    }
  }, [userIsSubscribed]);

  if (userIsSubscribed) return null;

  return (
    <div className="my-6 rounded-xl border border-border/60 bg-card/30 p-4 text-center">
      <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-2">
        {lang === "ar" ? "إعلان" : "Advertisement"}
      </div>
      <div ref={adRef} className="flex items-center justify-center gap-4 flex-wrap">
        {/* Google AdSense responsive ad unit — replace IDs below with your own */}
        <ins
          className="adsbygoogle"
          style={{ display: "block", minWidth: "250px", maxWidth: "300px", width: "100%", height: "100px" }}
          data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
          data-ad-slot="XXXXXXXXXX"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
      <p className="font-mono text-[10px] text-muted-foreground/30 mt-2">
        {lang === "ar"
          ? "اشترك في Pro أو Workshop لإزالة الإعلانات والحصول على تجربة خالية من المشتتات"
          : "Subscribe to Pro or Workshop to remove ads and enjoy a distraction-free experience"}
      </p>
    </div>
  );
}

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

interface BulkFileEntry {
  id: string;
  file: File;
  content: string;
  status: "pending" | "analyzing" | "done" | "error";
  analysis?: DxfAnalysis;
  fixedContent?: string;
  fixSummary?: FixSummaryItem[];
  error?: string;
}

const LAYER_COLORS = ["#00d4ff", "#ffd700", "#a855f7", "#34d399", "#f97316", "#ec4899", "#60a5fa"];

function DxfPreview({ analysis, issueIndices, lang, openPoints }: {
  analysis: DxfAnalysis;
  issueIndices: Set<number>;
  lang: "ar" | "en";
  openPoints?: { x: number; y: number }[];
}) {
  const [zoom, setZoom] = useState(1);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [showOpenLoops, setShowOpenLoops] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [simPointer, setSimPointer] = useState<{ x: number; y: number } | null>(null);
  const simRef = useRef<number | null>(null);
  const allPathsRef = useRef<SvgPath[]>([]);

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
  allPathsRef.current = allPaths;
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

  // Calculate open loop points in SVG coordinates
  const { maxY } = bounds;
  const flipY = (y: number) => maxY - y + bounds.minY;
  const svgOpenPoints = openPoints?.map(p => ({
    x: p.x,
    y: flipY(p.y),
  })) || [];

  // CNC Toolpath Simulation
  const startSimulation = useCallback(() => {
    if (simulating) return;
    setSimulating(true);
    setSimProgress(0);
    setSimPointer(null);

    // Collect all path points for animation
    const allPoints: { x: number; y: number }[] = [];
    for (const p of allPaths) {
      const matches = p.d.match(/[ML]\s+([\d.-]+)\s+([\d.-]+)/g);
      if (matches) {
        for (const m of matches) {
          const parts = m.split(/\s+/);
          if (parts.length >= 3) {
            allPoints.push({ x: parseFloat(parts[1]), y: parseFloat(parts[2]) });
          }
        }
      }
    }

    if (allPoints.length === 0) {
      setSimulating(false);
      return;
    }

    let step = 0;
    const totalSteps = allPoints.length;
    const interval = 50; // ms per step

    simRef.current = window.setInterval(() => {
      step++;
      const idx = Math.min(step, totalSteps - 1);
      setSimPointer(allPoints[idx]);
      setSimProgress(Math.round((idx / totalSteps) * 100));

      if (idx >= totalSteps - 1) {
        if (simRef.current) clearInterval(simRef.current);
        setSimulating(false);
        setSimProgress(100);
        setTimeout(() => {
          setSimPointer(null);
          setSimProgress(0);
        }, 1000);
      }
    }, interval);
  }, [allPaths, simulating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simRef.current) clearInterval(simRef.current);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border gap-3 flex-wrap">
        <span className="font-display font-semibold text-sm">
          {lang === "ar" ? "🖼 معاينة الرسم" : "🖼 Drawing Preview"}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Simulation Button */}
          <button
            onClick={startSimulation}
            disabled={simulating}
            className={`font-mono text-xs px-3 py-1 rounded-lg border transition ${
              simulating
                ? "border-accent bg-accent/20 text-accent animate-pulse"
                : "border-border text-muted-foreground hover:border-accent/50 hover:text-accent"
            }`}
          >
            {simulating
              ? (lang === "ar" ? `⏳ ${simProgress}%` : `⏳ ${simProgress}%`)
              : (lang === "ar" ? "▶ تشغيل المحاكاة" : "▶ Play Simulation")}
          </button>
          {openPoints && openPoints.length > 0 && (
            <button
              onClick={() => setShowOpenLoops(v => !v)}
              className={`font-mono text-xs px-3 py-1 rounded-lg border transition ${
                showOpenLoops
                  ? "border-red-500 bg-red-500/20 text-red-400"
                  : "border-border text-muted-foreground hover:border-red-500/50 hover:text-red-400"
              }`}
            >
              {lang === "ar" ? `🟡 نقاط مفتوحة (${openPoints.length})` : `🔴 Open points (${openPoints.length})`}
            </button>
          )}
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
          {/* Simulation pointer */}
          {simPointer && (
            <g>
              <circle
                cx={simPointer.x}
                cy={simPointer.y}
                r={Math.max(bounds.width, bounds.height) * 0.02}
                fill="#10b981"
                opacity={0.9}
              />
              <circle
                cx={simPointer.x}
                cy={simPointer.y}
                r={Math.max(bounds.width, bounds.height) * 0.04}
                fill="none"
                stroke="#10b981"
                strokeWidth={strokeW}
                opacity={0.4}
              />
            </g>
          )}
          {/* Open loop indicators - bright red circles */}
          {showOpenLoops && svgOpenPoints.map((pt, i) => (
            <g key={`open-${i}`}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={Math.max(bounds.width, bounds.height) * 0.015}
                fill="none"
                stroke="#ef4444"
                strokeWidth={strokeW * 2}
                opacity={0.9}
              />
              <circle
                cx={pt.x}
                cy={pt.y}
                r={Math.max(bounds.width, bounds.height) * 0.005}
                fill="#ef4444"
                opacity={1}
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Simulation progress bar */}
      {simulating && (
        <div className="px-5 py-2 border-t border-border">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-accent">
              {lang === "ar" ? "محاكاة مسار القص..." : "Simulating toolpath..."}
            </span>
            <div className="flex-1 bg-border rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-200 rounded-full"
                style={{ width: `${simProgress}%` }}
              />
            </div>
            <span className="font-mono text-xs text-muted-foreground">{simProgress}%</span>
          </div>
        </div>
      )}

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
        {openPoints && openPoints.length > 0 && (
          <span className="flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 text-red-400">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-red-500" />
            {lang === "ar" ? `نقاط مفتوحة: ${openPoints.length}` : `Open points: ${openPoints.length}`}
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
  beforeLoad: async () => {
    // Check subscription status
    const subscriptionData = getSubscriptionData();
    const userIsSubscribed = isSubscribed(subscriptionData);
    const freeUsageCount = getFreeUsageCount();

    console.log("🔍 Subscription check on /tool:", {
      subscriptionData,
      userIsSubscribed,
      freeUsageCount,
      freeUsageRemaining: FREE_USAGE_LIMIT - freeUsageCount,
    });

    // Allow access if:
    // 1. User is subscribed (pro/workshop/enterprise), OR
    // 2. User has remaining free usage
    const canAccess = userIsSubscribed || freeUsageCount < FREE_USAGE_LIMIT;

    if (!canAccess) {
      console.warn("❌ No free uses remaining - redirecting to /?redirect=pricing");
      throw redirect({
        to: "/",
        search: { redirect: "tool" },
      });
    }
    
    console.log("✅ User allowed access to /tool");
  },
  head: () => ({
    meta: [
      { title: "DXFix — أداة إصلاح وفحص ملفات DXF اونلاين | مجاني" },
      { name: "description", content: "ارفع ملف DXF، نكشف الأخطاء ونصلحها تلقائياً، ونعطيك تقييم جاهزية القص. حمّل ملفاً نظيفاً جاهزاً للماكينة خلال ثوانٍ. مجاني." },
      { name: "keywords", content: "إصلاح DXF, فحص DXF, أداة DXF اونلاين, DXF repair tool, CNC, laser cutting, تصليح ملفات DXF" },
      { property: "og:title", content: "DXFix — أداة إصلاح وفحص ملفات DXF اونلاين" },
      { property: "og:description", content: "ارفع ملف DXF، نصلح الأخطاء تلقائياً وتحمّل ملفاً نظيفاً جاهزاً للقص. مجاني." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://dxfix.com/tool" },
      { name: "robots", content: "index, follow" },
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
  const [fixSummary, setFixSummary] = useState<FixSummaryItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [freeUsageCount, setFreeUsageCount] = useState(getFreeUsageCount());
  const fileRef = useRef<HTMLInputElement>(null);
  const isRTL = lang === "ar";

  // Cost estimator state
  const [pricePerMeter, setPricePerMeter] = useState(5);
  const [showCostEstimator, setShowCostEstimator] = useState(false);

  // Self-destruct state
  const [selfDestructEnabled, setSelfDestructEnabled] = useState(false);
  const [selfDestructTriggered, setSelfDestructTriggered] = useState(isSelfDestructTriggered());

  // Trust notice modal
  const [showTrustModal, setShowTrustModal] = useState(false);

  // Subscription prompt modal for download gating
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  // Viral Unlock Modal (Phase 1 - replaces old subscribe modal for free users)
  const [showViralUnlockModal, setShowViralUnlockModal] = useState(false);
  const [showAdGateModal, setShowAdGateModal] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [adTimer, setAdTimer] = useState(0);
  const [viralUnlocked, setViralUnlocked] = useState(false);

  // Bulk upload state
  const [bulkFiles, setBulkFiles] = useState<BulkFileEntry[]>([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const [copiedReport, setCopiedReport] = useState(false);

  const copyReportToClipboard = useCallback(() => {
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
      `Total perimeter: ${(analysis.totalPerimeter ?? 0).toFixed(2)} mm`,
      `Processing time: ${analysis.processingTimeMs ?? 0} ms`,
      `File size reduction: ${analysis.sizeReductionPercent ?? 0}%`,
      "",
      "=== ISSUES ===",
      ...analysis.issues.map(i => `[${i.severity.toUpperCase()}] ${lang === "ar" ? i.ar : i.en}`),
      analysis.issues.length === 0 ? "No issues found." : "",
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    }).catch((err) => {
      console.warn("Clipboard write failed:", err);
    });
  }, [analysis, fileName, lang]);

  const subscriptionData = getSubscriptionData();
  const userIsSubscribed = isSubscribed(subscriptionData);
  const freeRemaining = FREE_USAGE_LIMIT - freeUsageCount;

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
      freeBanner: (remaining: number) => `استخدام مجاني: ${remaining} من ${FREE_USAGE_LIMIT} متبقية`,
      freeSubscribe: "اشترك الآن لرفع عدد غير محدود من الملفات",
      unlimited: "رفع غير محدود ✓",
      // Fix Summary
      fixSummaryTitle: "تقرير الإصلاحات والتعديلات",
      fixSummarySub: "نظرة تفصيلية على التغييرات التي تم إجراؤها على ملف DXF",
      // Cost Estimator
      costTitle: "تقدير تكلفة القص",
      costSub: "احسب التكلفة التقديرية للقص بناءً على الطول الإجمالي",
      totalLength: "مسافة القص الإجمالية",
      pricePerMeter: "سعر المتر أو الدقيقة ($)",
      estimatedCost: "التكلفة التقديرية للقص",
      costNote: "* هذا تقدير تقريبي. قد تختلف التكلفة الفعلية حسب الماكينة والمواد.",
      // Open Loops
      openLoopsDetected: "عدد النقاط المفتوحة المكتشفة والمصلحة",
      // Bulk Upload
      bulkUpload: "رفع متعدد",
      bulkDropZone: "اسحب وأفلت عدة ملفات DXF أو ملف ZIP",
      bulkBtn: "اختر ملفات متعددة",
      bulkNote: "يدعم .dxf و .zip — معالجة مجمعة",
      bulkTableTitle: "قائمة الملفات",
      bulkStatusPending: "قيد الانتظار",
      bulkStatusAnalyzing: "قيد التحليل",
      bulkStatusDone: "مكتمل",
      bulkStatusError: "فشل",
      bulkDownloadAll: "تحميل الكل",
      bulkProcessing: "جاري معالجة الملفات...",
      // Self-Destruct
      selfDestructToggle: "تفعيل التدمير الذاتي للملف لضمان السرية",
      selfDestructNotice: "سيتم حذف الملف نهائياً من السيرفرات فور اكتمال التحميل",
      selfDestructTriggered: "✓ تم تفعيل التدمير الذاتي — تم حذف الملفات نهائياً",
      // Trust Notice
      trustTitle: "اتفاقية سرية البيانات الهندسية",
      trustPoint1: "الرسومات الهندسية لا تُخزَّن على سيرفراتنا بعد المعالجة — تُحذف فوراً",
      trustPoint2: "لا نشارك أو نبيع أو ننقل أي بيانات هندسية لأطراف ثالثة",
      trustPoint3: "نستخدم تشفير HTTPS لحماية بياناتك أثناء النقل والمعالجة",
      trustBtn: "سياسة الخصوصية",
      // Processing Metrics
      processingTime: "الوقت المستغرق للمعالجة",
      fileSizeReduction: "نسبة تقليص حجم الملف التلقائي",
      // Safety Badge
      safetyTitle: "فحص أمان الماكينة",
      safetyBoundingBox: "الملف يقع ضمن حدود لوح العمل (Bounding Box Security)",
      safetyNoJerk: "لا يوجد حركات فجائية حادة لرأس الماكينة",
      safetyCompliant: "متوافق مع معايير الأمان والسلامة الصناعية",
      // Subscribe Modal
      subscribeRequired: "هذه الميزة متاحة للمشتركين فقط",
      subscribePrompt: "اشترك الآن لإصلاح ملفك وتحميله فوراً للماكينة!",
      subscribeBtn: "اشترك الآن",
      // Lock icons
      proFeature: "ميزة Pro",
      enterpriseFeature: "ميزة Enterprise",
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
      freeBanner: (remaining: number) => `Free usage: ${remaining}/${FREE_USAGE_LIMIT} remaining`,
      freeSubscribe: "Subscribe now for unlimited uploads",
      unlimited: "Unlimited uploads ✓",
      // Fix Summary
      fixSummaryTitle: "Fix Summary Report",
      fixSummarySub: "Detailed overview of changes made to your DXF file",
      // Cost Estimator
      costTitle: "Cutting Cost Estimator",
      costSub: "Estimate cutting cost based on total path length",
      totalLength: "Total Cutting Distance",
      pricePerMeter: "Price per meter/minute ($)",
      estimatedCost: "Estimated Cutting Cost",
      costNote: "* This is an approximate estimate. Actual cost may vary by machine and material.",
      // Open Loops
      openLoopsDetected: "Open points detected and fixed",
      // Bulk Upload
      bulkUpload: "Bulk Upload",
      bulkDropZone: "Drag & drop multiple DXF files or a ZIP archive",
      bulkBtn: "Choose multiple files",
      bulkNote: "Supports .dxf and .zip — batch processing",
      bulkTableTitle: "File Queue",
      bulkStatusPending: "Pending",
      bulkStatusAnalyzing: "Analyzing",
      bulkStatusDone: "Completed",
      bulkStatusError: "Failed",
      bulkDownloadAll: "Download All",
      bulkProcessing: "Processing files...",
      // Self-Destruct
      selfDestructToggle: "Enable file self-destruct for confidentiality",
      selfDestructNotice: "Files will be permanently deleted from servers immediately after download",
      selfDestructTriggered: "✓ Self-destruct enabled — files have been permanently deleted",
      // Trust Notice
      trustTitle: "Engineering Data Confidentiality Agreement",
      trustPoint1: "Engineering drawings are never stored on our servers after processing — deleted immediately",
      trustPoint2: "We do not share, sell, or transfer any engineering data to third parties",
      trustPoint3: "We use HTTPS encryption to protect your data during transmission and processing",
      trustBtn: "Privacy Policy",
      // Processing Metrics
      processingTime: "Processing Time",
      fileSizeReduction: "Auto File Size Reduction",
      // Safety Badge
      safetyTitle: "Machine Safety Check",
      safetyBoundingBox: "File is within work bed bounds (Bounding Box Security)",
      safetyNoJerk: "No sharp jerky movements for machine head",
      safetyCompliant: "Compliant with industrial safety standards",
      // Subscribe Modal
      subscribeRequired: "This feature is for subscribers only",
      subscribePrompt: "Subscribe now to fix your file and download it immediately to your machine!",
      subscribeBtn: "Subscribe Now",
      // Lock icons
      proFeature: "Pro Feature",
      enterpriseFeature: "Enterprise Feature",
    },
  };

  const t = T[lang];

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".dxf")) {
      alert(lang === "ar" ? "يرجى رفع ملف بصيغة .dxf فقط" : "Please upload a .dxf file only");
      return;
    }

    // Track file upload (excluding localhost and admin users)
    const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";
    const isAdmin = typeof window !== "undefined" && window.location.search.includes("admin=true");
    if (!isLocalhost && !isAdmin) {
      track('Used DXF Fixer', { timestamp: new Date().toISOString() });
    }

    // Increment free usage counter for non-subscribed users
    if (!userIsSubscribed) {
      const newCount = incrementFreeUsage();
      setFreeUsageCount(newCount);
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
  }, [lang, userIsSubscribed]);

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
    const { fixed, repaired, fixSummary: summary } = repairDxf(fileContent, analysis);
    setRepairedContent(fixed);
    setRepairedIssues(repaired);
    setFixSummary(summary);
    saveToHistory(fileName, analysis, true);
    setStage("repaired");
  };

  const handleDownloadFixed = () => {
    // Allow all users (free and subscribed) to download directly
    downloadFile(repairedContent, fileName.replace(".dxf", "_fixed.dxf"));
  };

  const downloadFile = (content: string, name: string) => {
    const blob = new Blob([content], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);

    // Self-destruct: clear data after download
    if (selfDestructEnabled) {
      triggerSelfDestruct([name]);
      setSelfDestructTriggered(true);
    }
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
      `Total perimeter: ${(analysis.totalPerimeter ?? 0).toFixed(2)} mm`,
      `Processing time: ${analysis.processingTimeMs ?? 0} ms`,
      `File size reduction: ${analysis.sizeReductionPercent ?? 0}%`,
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
    setFixSummary([]);
    setProgress(0);
    setShowCostEstimator(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Bulk upload handlers
  const handleBulkFiles = useCallback((files: FileList | File[]) => {
    const entries: BulkFileEntry[] = [];
    for (const file of Array.from(files)) {
      if (file.name.toLowerCase().endsWith(".dxf")) {
        entries.push({
          id: `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          file,
          content: "",
          status: "pending",
        });
      }
    }
    setBulkFiles(prev => [...prev, ...entries]);
  }, []);

  const processBulkFiles = useCallback(async () => {
    setBulkProcessing(true);
    const pending = bulkFiles.filter(f => f.status === "pending");
    
    for (const entry of pending) {
      setBulkFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: "analyzing" as const } : f));
      
      try {
        const content = await entry.file.text();
        const result = analyzeDxf(content);
        const { fixed, fixSummary: summary } = repairDxf(content, result);
        
        setBulkFiles(prev => prev.map(f => f.id === entry.id ? {
          ...f,
          content,
          status: "done" as const,
          analysis: result,
          fixedContent: fixed,
          fixSummary: summary,
        } : f));
      } catch (err: any) {
        setBulkFiles(prev => prev.map(f => f.id === entry.id ? {
          ...f,
          status: "error" as const,
          error: err.message,
        } : f));
      }
    }
    
    setBulkProcessing(false);
  }, [bulkFiles]);

  const downloadAllBulk = async () => {
    // Gate: Check if user is subscribed
    if (!userIsSubscribed) {
      setShowSubscribeModal(true);
      return;
    }
    const doneFiles = bulkFiles.filter(f => f.status === "done" && f.fixedContent);
    const filesToZip = doneFiles.map(f => ({
      name: f.file.name.replace(".dxf", "_fixed.dxf"),
      content: f.fixedContent!,
      type: "application/dxf",
    }));
    
    await downloadAllAsZip(filesToZip, "dxfix-bulk-processed.zip");

    if (selfDestructEnabled) {
      triggerSelfDestruct(filesToZip.map(f => f.name));
      setSelfDestructTriggered(true);
    }
  };

  // Calculate perimeter for cost estimator
  const perimeter = analysis ? (analysis.totalPerimeter ?? calculateTotalPerimeter(analysis.entities)) : 0;
  const perimeterMeters = perimeter / 1000;
  const estimatedCost = perimeterMeters * pricePerMeter;

  // Open loop detection
  const openLoopData = analysis ? detectOpenLoops(analysis.entities) : { count: 0, openPoints: [] };

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
            {/* Subscription status badge */}
            {!userIsSubscribed && (
              <span className="font-mono text-xs px-2.5 py-1 rounded-full border border-primary/30 text-primary bg-primary/5">
                {t.freeBanner(freeRemaining)}
              </span>
            )}
            {userIsSubscribed && (
              <span className="font-mono text-xs px-2.5 py-1 rounded-full border border-accent/30 text-accent bg-accent/5">
                {t.unlimited}
              </span>
            )}
            {/* Trust button */}
            <button
              onClick={() => setShowTrustModal(true)}
              className="font-mono text-xs px-2.5 py-1.5 rounded-md border border-border hover:border-primary/60 transition text-muted-foreground hover:text-foreground"
              title={lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}
            >
              🔒
            </button>
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
        {/* FREE USAGE BANNER */}
        {!userIsSubscribed && freeRemaining > 0 && freeRemaining <= 3 && (
          <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-sm text-primary font-medium">
              ⚡ {t.freeBanner(freeRemaining)} — <a href="/?redirect=pricing" className="underline font-semibold hover:text-primary/80">{t.freeSubscribe}</a>
            </p>
          </div>
        )}

        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl sm:text-5xl font-bold">{t.title}</h1>
          <p className="mt-3 text-muted-foreground text-lg">{t.sub}</p>
        </div>

        {/* UPLOAD */}
        {stage === "upload" && (
          <>
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

            {/* Self-Destruct Toggle */}
            <div className="mt-4 flex items-center justify-center">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => setSelfDestructEnabled(!selfDestructEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    selfDestructEnabled ? "bg-red-500" : "bg-border"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    selfDestructEnabled ? "translate-x-6" : "translate-x-0.5"
                  }`} />
                </div>
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition">
                  🔒 {t.selfDestructToggle}
                </span>
              </label>
            </div>
            {selfDestructEnabled && (
              <div className="mt-2 text-center">
                <span className="font-mono text-xs text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/30">
                  ⚠ {t.selfDestructNotice}
                </span>
              </div>
            )}
            {selfDestructTriggered && (
              <div className="mt-2 text-center">
                <span className="font-mono text-xs text-green-400 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/30">
                  {t.selfDestructTriggered}
                </span>
              </div>
            )}

            {/* Bulk Upload Section */}
            <div className="mt-6">
              <button
                onClick={() => setShowBulkUpload(!showBulkUpload)}
                className="w-full py-3 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-card/60 transition text-sm text-muted-foreground hover:text-foreground font-medium"
              >
                📦 {t.bulkUpload} {showBulkUpload ? "▲" : "▼"}
              </button>

              {showBulkUpload && (
                <div className="mt-4 rounded-2xl border border-border bg-card p-6">
                  <div
                    onDrop={(e) => { e.preventDefault(); handleBulkFiles(e.dataTransfer.files); }}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition cursor-pointer"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.dxf,.zip';
                      input.multiple = true;
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (files) handleBulkFiles(files);
                      };
                      input.click();
                    }}
                  >
                    <div className="text-4xl mb-3">📦</div>
                    <p className="font-display font-semibold">{t.bulkDropZone}</p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">{t.bulkNote}</p>
                  </div>

                  {bulkFiles.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display font-semibold">{t.bulkTableTitle} ({bulkFiles.length})</h3>
                        <div className="flex gap-2">
                          {bulkFiles.some(f => f.status === "pending") && (
                            <button
                              onClick={processBulkFiles}
                              disabled={bulkProcessing}
                              className="px-4 py-2 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
                            >
                              {bulkProcessing ? "⏳ ..." : "🔧 معالجة"}
                            </button>
                          )}
                          {bulkFiles.some(f => f.status === "done") && (
                            <button
                              onClick={downloadAllBulk}
                              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition"
                            >
                              ⬇ {t.bulkDownloadAll}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {bulkFiles.map((entry) => (
                          <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-background">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              entry.status === "done" ? "bg-green-400" :
                              entry.status === "analyzing" ? "bg-yellow-400 animate-pulse" :
                              entry.status === "error" ? "bg-red-400" : "bg-muted-foreground/30"
                            }`} />
                            <span className="flex-1 font-mono text-sm truncate">{entry.file.name}</span>
                            <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                              entry.status === "done" ? "bg-green-500/10 text-green-400" :
                              entry.status === "analyzing" ? "bg-yellow-500/10 text-yellow-400" :
                              entry.status === "error" ? "bg-red-500/10 text-red-400" :
                              "bg-muted/30 text-muted-foreground"
                            }`}>
                              {entry.status === "done" ? t.bulkStatusDone :
                               entry.status === "analyzing" ? t.bulkStatusAnalyzing :
                               entry.status === "error" ? t.bulkStatusError :
                               t.bulkStatusPending}
                            </span>
                            {entry.analysis && (
                              <span className={`font-mono text-xs ${
                                entry.analysis.score >= 80 ? "text-green-400" :
                                entry.analysis.score >= 50 ? "text-yellow-400" : "text-red-400"
                              }`}>
                                {entry.analysis.score}/100
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 📢 Smart AdBanner — Upload stage (automatically hidden for premium users) */}
            <AdBanner format="horizontal" lang={lang} />

            {/* FILE HISTORY */}
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
                              <span className="mr-2 text-green-400">✓ {t.historyRepaired}</span>
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
          </>
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

            {/* 📢 AdBanner while analyzing — highest CPM opportunity while user waits */}
            <AdBanner format="horizontal" lang={lang} />
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
                  onClick={handleDownloadFixed}
                  className="px-6 py-3.5 rounded-xl bg-accent text-accent-foreground font-semibold hover:opacity-90 transition shadow-[var(--shadow-spark)] whitespace-nowrap"
                >
                  ⬇ {t.downloadFixed}
                </button>
              )}
            </div>

            {/* SVG Preview */}
            {(() => {
              const issueIndices = new Set(analysis.issues.flatMap(i => i.entityIndices));
              return <DxfPreview analysis={analysis} issueIndices={issueIndices} lang={lang} openPoints={openLoopData.openPoints} />;
            })()}

            {/* Open Loops Count */}
            {openLoopData.count > 0 && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-center">
                <p className="text-sm font-medium text-red-400">
                  🟡 {t.openLoopsDetected}: <span className="font-bold">{openLoopData.count}</span>
                </p>
              </div>
            )}

            {/* Processing Metrics Dashboard */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 to-card p-5 text-center">
                <div className="text-2xl mb-2">⚡</div>
                <p className="font-display text-2xl font-bold text-accent">
                  {analysis.processingTimeMs ?? 0} <span className="text-sm font-normal text-muted-foreground">ms</span>
                </p>
                <p className="font-mono text-xs text-muted-foreground mt-1">{t.processingTime}</p>
              </div>
              <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-card p-5 text-center">
                <div className="text-2xl mb-2">📦</div>
                <p className="font-display text-2xl font-bold text-primary">
                  {analysis.sizeReductionPercent ?? 0}%
                </p>
                <p className="font-mono text-xs text-muted-foreground mt-1">{t.fileSizeReduction}</p>
              </div>
            </div>

            {/* Machine Safety & G-Code Verification Badge */}
            <SafetyBadge
              lang={lang}
              totalEntities={analysis.stats.totalEntities}
              score={stage === "repaired" ? 100 : analysis.score}
            />

            {/* Fix Summary Widget */}
            {stage === "repaired" && fixSummary.length > 0 && (
              <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 to-card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-xl">
                    📋
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg">{t.fixSummaryTitle}</h3>
                    <p className="text-xs text-muted-foreground">{t.fixSummarySub}</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {fixSummary.map((item) => (
                    <div key={item.id} className="bg-background border border-border/60 rounded-xl p-4 flex items-start gap-3">
                      <span className="text-xl flex-shrink-0">{item.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{lang === "ar" ? item.ar : item.en}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cost Estimator */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setShowCostEstimator(!showCostEstimator)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/20 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">💰</span>
                  <span className="font-display font-semibold">{t.costTitle}</span>
                </div>
                <span className="text-muted-foreground">{showCostEstimator ? "▲" : "▼"}</span>
              </button>
              {showCostEstimator && (
                <div className="px-6 pb-6 space-y-4">
                  <p className="text-sm text-muted-foreground">{t.costSub}</p>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-background border border-border/60 rounded-xl p-4">
                      <p className="text-xs text-muted-foreground font-mono mb-1">{t.totalLength}</p>
                      <p className="font-display text-2xl font-bold text-primary">
                        {perimeter.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">mm</span>
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {(perimeterMeters).toFixed(2)} m
                      </p>
                    </div>
                    <div className="bg-background border border-border/60 rounded-xl p-4">
                      <p className="text-xs text-muted-foreground font-mono mb-1">{t.pricePerMeter}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">$</span>
                        <input
                          type="number"
                          min="0.1"
                          step="0.5"
                          value={pricePerMeter}
                          onChange={(e) => setPricePerMeter(parseFloat(e.target.value) || 0)}
                          className="w-20 bg-transparent border-b border-border text-foreground font-display text-2xl font-bold focus:outline-none focus:border-accent"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/30 rounded-xl p-5 text-center">
                    <p className="text-xs text-muted-foreground font-mono mb-1">{t.estimatedCost}</p>
                    <p className="font-display text-4xl font-bold text-gradient-spark">
                      ${estimatedCost.toFixed(2)}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground mt-2">{t.costNote}</p>
                  </div>
                </div>
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

            {/* 📢 Smart AdBanner — Result stage (automatically hidden for premium users) */}
            <AdBanner format="rectangle" lang={lang} />

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
                onClick={copyReportToClipboard}
                className="px-5 py-2.5 rounded-lg border border-border hover:border-primary/60 font-semibold text-sm transition"
              >
                📋 {copiedReport ? (lang === "ar" ? "تم النسخ ✓" : "Copied ✓") : (lang === "ar" ? "نسخ التقرير" : "Copy Report")}
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
                  onClick={() => {
                    if (!userIsSubscribed) {
                      setShowSubscribeModal(true);
                      return;
                    }
                    downloadFile(fileContent, fileName);
                  }}
                  className="px-6 py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition shadow-[var(--shadow-spark)]"
                >
                  ⬇ {lang === "ar" ? "تحميل الملف" : "Download file"}
                </button>
              )}
              {stage === "repaired" && (
                <button
                  onClick={handleDownloadFixed}
                  className="px-6 py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition shadow-[var(--shadow-spark)]"
                >
                  ⬇ {t.downloadFixed}
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Trust & Privacy Modal */}
      {showTrustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative bg-card border border-accent/40 rounded-2xl p-8 max-w-lg w-full shadow-[var(--shadow-spark)]">
            <button
              onClick={() => setShowTrustModal(false)}
              className="absolute top-4 end-4 text-muted-foreground hover:text-foreground transition font-mono text-lg"
            >✕</button>
            <div className="text-4xl mb-4 text-center">🔒</div>
            <h3 className="font-display text-2xl font-bold text-center mb-6">{t.trustTitle}</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                <span className="text-green-400 text-lg flex-shrink-0">✓</span>
                <p className="text-sm text-foreground/90">{t.trustPoint1}</p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                <span className="text-green-400 text-lg flex-shrink-0">✓</span>
                <p className="text-sm text-foreground/90">{t.trustPoint2}</p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                <span className="text-green-400 text-lg flex-shrink-0">✓</span>
                <p className="text-sm text-foreground/90">{t.trustPoint3}</p>
              </div>
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowTrustModal(false)}
                className="px-6 py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition"
              >
                {t.trustBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      <FeedbackModal lang={lang} />

      {/* Viral Unlock Modal (Phase 1) */}
      <ViralUnlockModal
        lang={lang}
        isOpen={showViralUnlockModal}
        onClose={() => setShowViralUnlockModal(false)}
        onUnlocked={() => {
          setViralUnlocked(true);
          setUserSubscribed(true);
          setShowViralUnlockModal(false);
          // Retry the download if possible
          if (repairedContent) {
            downloadFile(repairedContent, fileName.replace(".dxf", "_fixed.dxf"));
          }
        }}
      />

      {/* Ad Gate Modal (Watch ad to download) */}
      {showAdGateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative bg-card border border-accent/40 rounded-2xl p-8 max-w-md w-full shadow-[var(--shadow-spark)] text-center">
            <button
              onClick={() => setShowAdGateModal(false)}
              className="absolute top-4 end-4 text-muted-foreground hover:text-foreground transition font-mono text-lg"
            >✕</button>
            <div className="text-5xl mb-4">
              {adWatched ? "✅" : "📺"}
            </div>
            <h3 className="font-display text-2xl font-bold mb-3">
              {lang === "ar" ? "شاهد إعلاناً قصيراً لتحميل الملف" : "Watch a short ad to download"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {lang === "ar"
                ? "ادعم الأداة بمشاهدة إعلان قصير. سيتم تفعيل التحميل فور انتهاء الإعلان."
                : "Support the tool by watching a short ad. Download will be enabled once the ad ends."}
            </p>

            {/* Ad Container */}
            <div className="bg-background border border-border/60 rounded-xl p-4 mb-4 min-h-[120px] flex flex-col items-center justify-center">
              {adWatched ? (
                <div className="text-green-400 font-semibold">
                  {lang === "ar" ? "✓ تم مشاهدة الإعلان!" : "✓ Ad watched!"}
                </div>
              ) : (
                <>
                  <div className="text-3xl mb-2">📺</div>
                  <div className="font-mono text-xs text-muted-foreground mb-3">
                    {lang === "ar" ? "Google AdSense" : "Advertisement"}
                  </div>
                  {/* Google AdSense container */}
                  <ins
                    className="adsbygoogle"
                    style={{ display: "block", minWidth: "200px", width: "100%", height: "60px" }}
                    data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                    data-ad-slot="XXXXXXXXXX"
                    data-ad-format="auto"
                  />
                </>
              )}
            </div>

            {/* Timer / Watch Button */}
            {!adWatched && (
              <div className="flex flex-col gap-3">
                {adTimer > 0 ? (
                  <div className="w-full py-3 rounded-lg bg-accent/20 text-accent font-semibold">
                    {lang === "ar" ? `⏳ انتظر ${adTimer} ثوانٍ...` : `⏳ Wait ${adTimer}s...`}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      // Start 10-second ad timer
                      setAdTimer(10);
                      const interval = setInterval(() => {
                        setAdTimer(prev => {
                          if (prev <= 1) {
                            clearInterval(interval);
                            setAdWatched(true);
                            return 0;
                          }
                          return prev - 1;
                        });
                      }, 1000);
                    }}
                    className="w-full py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 transition shadow-[var(--shadow-spark)]"
                  >
                    {lang === "ar" ? "▶ شاهد الإعلان" : "▶ Watch Ad"}
                  </button>
                )}
              </div>
            )}

            {/* Download Button (only after ad watched) */}
            {adWatched && (
              <button
                onClick={() => {
                  setShowAdGateModal(false);
                  if (repairedContent) {
                    downloadFile(repairedContent, fileName.replace(".dxf", "_fixed.dxf"));
                  }
                }}
                className="w-full py-3.5 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 transition shadow-[var(--shadow-spark)]"
              >
                ⬇ {lang === "ar" ? "حمّل الملف الآن" : "Download now"}
              </button>
            )}

            {/* Skip link */}
            <div className="mt-4">
              <a
                href="/?redirect=pricing"
                className="font-mono text-xs text-muted-foreground/60 hover:text-foreground transition underline"
              >
                {lang === "ar" ? "اشترك لإزالة الإعلانات" : "Subscribe to remove ads"}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Required Modal (Download Gating - fallback) */}
      {showSubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative bg-card border border-accent/40 rounded-2xl p-8 max-w-md w-full shadow-[var(--shadow-spark)] text-center">
            <button
              onClick={() => setShowSubscribeModal(false)}
              className="absolute top-4 end-4 text-muted-foreground hover:text-foreground transition font-mono text-lg"
            >✕</button>
            <div className="text-5xl mb-4">🔒</div>
            <h3 className="font-display text-2xl font-bold mb-3">{t.subscribeRequired}</h3>
            <p className="text-muted-foreground mb-6">{t.subscribePrompt}</p>
            <div className="flex flex-col gap-3">
              <a
                href="/?redirect=pricing"
                className="w-full py-3.5 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 transition shadow-[var(--shadow-spark)] text-center"
              >
                {t.subscribeBtn} {isRTL ? "←" : "→"}
              </a>
              <button
                onClick={() => setShowSubscribeModal(false)}
                className="w-full py-3 rounded-lg border border-border hover:border-primary/60 font-semibold text-sm transition"
              >
                {lang === "ar" ? "ربما لاحقاً" : "Maybe later"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}