import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { analyzeDxf, repairDxf, scoreColor, scoreBg, scoreLabel, getDxfBounds, buildSvgPaths, calculateTotalPerimeter, sortInsideFirst } from "@/lib/dxf";
import type { DxfAnalysis, DxfIssue, FixSummaryItem, DxfBounds, SvgPath, DxfEntity } from "@/lib/dxf";
// Open-path detection: consume the cleanup engine's public API only — NO engine changes.
import { DEFAULT_CLEANUP_OPTIONS, detectOpenPaths } from "@/lib/dxf-cleanup";
import { downloadAllAsZip, triggerSelfDestruct, isSelfDestructTriggered } from "@/lib/zip-export";
import { track } from '@vercel/analytics';
import { FeedbackModal } from "@/components/feedback-modal";
import { SafetyBadge } from "@/components/safety-badge";
import { AdBanner } from "@/components/AdBanner";
import { ShareToolWidget } from "@/components/share-tool-widget";
import { parseSvg, isSvgContent, isSvgFile } from "@/lib/svg-parser";
import { advancedSimplify, arcToPoints, circleToPoints, ellipseToPoints } from "@/lib/path-simplify";
import type { Point } from "@/lib/path-simplify";
import { fullPathCleanup, pathLength } from "@/lib/path-union";
import type { PathSegment } from "@/lib/path-union";
import { pathsToCuttingPaths, advancedOptimize, generateOptimizationReport } from "@/lib/toolpath-optimizer";
import type { CuttingPath } from "@/lib/toolpath-optimizer";
import { recordRepair, recordUpload } from "@/lib/stats";
import { useGeometryFixMode, type GeometryFixState, type GeometryFixMethod } from "./__root";


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

// Unified open-loop pipeline (single source of truth for preview AND report).
// Same engine (detectOpenPaths) and same threshold (0.1mm) as analyzeDxf:
//   gap <  0.1mm → auto-closed by the engine (no red dot)
//   gap >= 0.1mm → real problem (red dot + reported as an error)
interface BridgePreview {
  from: { x: number; y: number };
  to: { x: number; y: number };
  gap: number;
  closable: boolean;
}
function computeOpenLoopData(a: DxfAnalysis | null): { count: number; openPoints: { x: number; y: number }[]; fixedCount: number; bridges: BridgePreview[] } {
  if (!a) return { count: 0, openPoints: [], fixedCount: 0, bridges: [] };
  const manualRepairThreshold = 0.1;
  const openPaths = detectOpenPaths(a.entities, DEFAULT_CLEANUP_OPTIONS);
  const fixedOpen = openPaths.filter(p => p.gap < manualRepairThreshold);
  const needsManualRepair = openPaths.filter(p => p.gap >= manualRepairThreshold);
  const openPoints: { x: number; y: number }[] = [];
  const bridges: BridgePreview[] = [];
  needsManualRepair.forEach(path => {
    openPoints.push(path.start);
    openPoints.push(path.end);
  });
  openPaths.forEach(path => {
    if (path.partner) {
      bridges.push({
        from: path.start,
        to: path.partner,
        gap: path.gap,
        closable: path.gap < manualRepairThreshold,
      });
    }
  });
  return { count: needsManualRepair.length, openPoints, fixedCount: fixedOpen.length, bridges };
}

// ─── Geometry Fix Mode: build replacement geometry for gaps ≥ 0.1mm ─────────
// Creates ONE new DxfEntity per manually-repairable gap. The strategy is always
// "add a bridge entity", NEVER "move/destroy the original endpoints", so the
// surrounding drawing geometry is left 100% untouched (no drawing corruption):
//   method = "smart"    → analyzes drawing style and picks best bridge type
//   method = "straight" → new LINE from start→partner
//   method = "arc"      → new LWPOLYLINE with a single half-circle bulge
//   method = "skip"     → no entity (gap left as-is, user chose to skip)

// --- Smart Detection Helpers ---
type EntityStyle = "line" | "arc" | "spline" | "circle" | "unknown";

interface EndpointStyle {
  style: EntityStyle;
  exitAngle: number;
  radius?: number;
  direction?: "CW" | "CCW";
}

function normaliseAngle(a: number): number {
  let n = a % Math.PI;
  if (n < 0) n += Math.PI;
  return n;
}

function getEndpointStyle(
  entity: DxfEntity,
  endpoint: { x: number; y: number },
): EndpointStyle {
  switch (entity.type) {
    case "LINE": {
      const x1 = entity.x1 ?? 0, y1 = entity.y1 ?? 0;
      const x2 = entity.x2 ?? 0, y2 = entity.y2 ?? 0;
      const dist1 = Math.hypot(endpoint.x - x1, endpoint.y - y1);
      const dist2 = Math.hypot(endpoint.x - x2, endpoint.y - y2);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const tangent = dist1 < dist2 ? angle : angle + Math.PI;
      return { style: "line", exitAngle: normaliseAngle(tangent) };
    }
    case "ARC": {
      const cx = entity.cx ?? 0, cy = entity.cy ?? 0;
      const r = entity.radius ?? 1;
      const start = entity.startAngle ?? 0;
      const end = entity.endAngle ?? Math.PI * 2;
      const epAngle = Math.atan2(endpoint.y - cy, endpoint.x - cx);
      const sweep = end - start;
      const isCCW = sweep > 0;
      const tangent = isCCW ? epAngle + Math.PI / 2 : epAngle - Math.PI / 2;
      return {
        style: "arc",
        exitAngle: normaliseAngle(tangent),
        radius: r,
        direction: isCCW ? "CCW" : "CW",
      };
    }
    case "CIRCLE": {
      const cx = entity.cx ?? 0, cy = entity.cy ?? 0;
      const epAngle = Math.atan2(endpoint.y - cy, endpoint.x - cx);
      return { style: "circle", exitAngle: normaliseAngle(epAngle + Math.PI / 2) };
    }
    default:
      return { style: "unknown", exitAngle: 0 };
  }
}

function entityPointDistance(e: DxfEntity, pt: { x: number; y: number }): number {
  switch (e.type) {
    case "LINE": {
      const x1 = e.x1 ?? 0, y1 = e.y1 ?? 0;
      const x2 = e.x2 ?? 0, y2 = e.y2 ?? 0;
      const A = pt.x - x1, B = pt.y - y1;
      const C = x2 - x1, D = y2 - y1;
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      if (lenSq === 0) return Math.hypot(A, B);
      const t = Math.max(0, Math.min(1, dot / lenSq));
      return Math.hypot(pt.x - (x1 + t * C), pt.y - (y1 + t * D));
    }
    case "ARC":
    case "CIRCLE": {
      const cx = e.cx ?? 0, cy = e.cy ?? 0;
      return Math.abs(Math.hypot(pt.x - cx, pt.y - cy) - (e.radius ?? 1));
    }
    case "LWPOLYLINE":
    case "POLYLINE": {
      if (!e.vertices || e.vertices.length === 0) return Infinity;
      let minDist = Infinity;
      for (let i = 0; i < e.vertices.length - 1; i++) {
        const x1 = e.vertices[i].x, y1 = e.vertices[i].y;
        const x2 = e.vertices[i + 1].x, y2 = e.vertices[i + 1].y;
        const A = pt.x - x1, B = pt.y - y1;
        const C = x2 - x1, D = y2 - y1;
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        if (lenSq === 0) { minDist = Math.min(minDist, Math.hypot(A, B)); continue; }
        const t = Math.max(0, Math.min(1, dot / lenSq));
        minDist = Math.min(minDist, Math.hypot(pt.x - (x1 + t * C), pt.y - (y1 + t * D)));
      }
      return minDist;
    }
    default:
      return Infinity;
  }
}

function makeLine(from: { x: number; y: number }, to: { x: number; y: number }, layer: string, handle: string): DxfEntity {
  return { type: "LINE", layer, handle, rawLines: [], x1: from.x, y1: from.y, x2: to.x, y2: to.y };
}

function makeArcBlend(from: { x: number; y: number }, to: { x: number; y: number }, layer: string, handle: string): DxfEntity {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1e-9;
  return {
    type: "LWPOLYLINE",
    layer,
    handle,
    rawLines: [],
    closed: false,
    vertices: [
      { x: from.x, y: from.y },
      { x: mx + (-dy / len) * (len / 2), y: my + (dx / len) * (len / 2) },
      { x: to.x, y: to.y },
    ],
  };
}

function smartBridgeEntity(
  from: { x: number; y: number },
  to: { x: number; y: number },
  entities: DxfEntity[],
  layer: string,
  handle: string,
): DxfEntity {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1e-9;

  function nearestEntity(pt: { x: number; y: number }): DxfEntity | null {
    let best: DxfEntity | null = null;
    let bestDist = Infinity;
    for (const e of entities) {
      const dist = entityPointDistance(e, pt);
      if (dist < bestDist) { bestDist = dist; best = e; }
    }
    return bestDist < len * 5 ? best : null;
  }

  const fromEntity = nearestEntity(from);
  const toEntity = nearestEntity(to);
  const fromStyle = fromEntity ? getEndpointStyle(fromEntity, from) : null;
  const toStyle = toEntity ? getEndpointStyle(toEntity, to) : null;

  if (fromStyle?.style === "line" && toStyle?.style === "line") {
    return makeLine(from, to, layer, handle);
  }

  if (fromStyle?.style === "arc" && toStyle?.style === "arc") {
    if (
      fromStyle.radius != null && toStyle.radius != null &&
      Math.abs(fromStyle.radius - toStyle.radius) < 0.01
    ) {
      return makeArcBlend(from, to, layer, handle);
    }
  }

  return makeLine(from, to, layer, handle);
}

interface FixBridgeEntity {
  entity: DxfEntity;
  bridge: BridgePreview;
}
function buildFixBridgeEntities(
  analysis: DxfAnalysis | null,
  method: GeometryFixMethod,
): FixBridgeEntity[] {
  if (!analysis || method === "skip") return [];
  const openPaths = detectOpenPaths(analysis.entities, DEFAULT_CLEANUP_OPTIONS);
  const manualRepairThreshold = 0.1;
  const manual = openPaths.filter(p => p.gap >= manualRepairThreshold && p.partner);
  const used = new Set<string>();
  const out: FixBridgeEntity[] = [];
  const layer = analysis.entities[0]?.layer ?? "0";
  const maxHandle = analysis.entities.reduce((m, e) => {
    const h = parseInt(e.handle || "0", 16);
    return Number.isFinite(h) ? Math.max(m, h) : m;
  }, 0);

  manual.forEach((path, i) => {
    const from = path.start;
    const to = path.partner!;
    // Key both orientations so each gap is bridged exactly once.
    const key = [from.x, from.y, to.x, to.y].map(n => n.toFixed(6)).join(",");
    const revKey = [to.x, to.y, from.x, from.y].map(n => n.toFixed(6)).join(",");
    if (used.has(key) || used.has(revKey)) return;
    used.add(key);
    used.add(revKey);
    const handle = (maxHandle + i + 1).toString(16);
    const bridge: BridgePreview = { from, to, gap: path.gap, closable: false };

    if (method === "arc") {
      // Half-circle arc → signed bulge 1.0 (bulge = tan(sweep/4); sweep=180° → 1)
      const entity = makeArcBlend(from, to, layer, handle);
      out.push({ entity, bridge });
    } else if (method === "smart") {
      // Smart detection: analyze adjacent entities and pick best bridge style
      const entity = smartBridgeEntity(from, to, analysis.entities, layer, handle);
      out.push({ entity, bridge });
    } else {
      // method === "straight" — default
      const entity = makeLine(from, to, layer, handle);
      out.push({ entity, bridge });
    }
  });
  return out;
}

// Serialize a single fix entity (LINE / LWPOLYLINE) into DXF ENTITIES text.
// Mirrors the serialiser in src/lib/dxf.ts so the downloaded file stays valid.
function serializeFixEntity(e: DxfEntity): string {
  if (e.type === "LWPOLYLINE" && e.vertices) {
    const lines: string[] = [
      "  0", "LWPOLYLINE",
      "  8", e.layer,
      " 90", String(e.vertices.length),
      " 70", e.closed ? "1" : "0",
    ];
    if (e.handle) lines.push("  5", e.handle);
    for (const v of e.vertices) {
      lines.push(" 10", v.x.toFixed(6));
      lines.push(" 20", v.y.toFixed(6));
      if (v.bulge && v.bulge !== 0) lines.push(" 42", v.bulge.toFixed(6));
    }
    return lines.join("\n");
  }
  // LINE
  const lines: string[] = ["  0", "LINE", "  8", e.layer];
  if (e.handle) lines.push("  5", e.handle);
  lines.push(" 10", (e.x1 ?? 0).toFixed(6));
  lines.push(" 20", (e.y1 ?? 0).toFixed(6));
  lines.push(" 11", (e.x2 ?? 0).toFixed(6));
  lines.push(" 21", (e.y2 ?? 0).toFixed(6));
  return lines.join("\n");
}

// Append applied fix bridge entities into an existing DXF string, inserted just
// before the ENTITIES ENDSEC. Returns the original content when nothing to add.
function appendFixEntitiesToDxf(
  content: string,
  fixEntities: FixBridgeEntity[],
): string {
  if (!content || fixEntities.length === 0) return content;
  const block = fixEntities.map(f => serializeFixEntity(f.entity)).join("\n");
  // Insert before "\n  0\nENDSEC" inside the ENTITIES section (the first ENDSEC).
  const endSecIdx = content.indexOf("\n  0\nENDSEC");
  if (endSecIdx === -1) {
    // Fallback: append at EOF (still valid for most consumers).
    return content.endsWith("\n") ? content + block + "\n" : content + "\n" + block + "\n";
  }
  return content.slice(0, endSecIdx) + "\n" + block + content.slice(endSecIdx);
}

// Data bundle rendered by the preview — one for the repaired file ("after")
// and one for the original file ("before") so the user can toggle between
// the pre-repair and post-repair states of the SAME drawing.
interface PreviewData {
  analysis: DxfAnalysis;
  issueIndices: Set<number>;
  openPoints: { x: number; y: number }[];
  pathCount: number;
  bridges: BridgePreview[];
}

function DxfPreview({ analysis, issueIndices, lang, openPoints, pathCount, bridges, before }: {
  analysis: DxfAnalysis;
  issueIndices: Set<number>;
  lang: "ar" | "en";
  openPoints?: { x: number; y: number }[];
  pathCount?: number;
  bridges?: BridgePreview[];
  before?: PreviewData;
}) {
  const [zoom, setZoom] = useState(1);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [showOpenLoops, setShowOpenLoops] = useState(true);
  const [showBefore, setShowBefore] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [simPointer, setSimPointer] = useState<{ x: number; y: number } | null>(null);
  const simRef = useRef<number | null>(null);
  const allPathsRef = useRef<SvgPath[]>([]);

  // Gap magnifier (loupe): shows a zoomed circular view right at the cursor
  // over an open point / bridge so the user sees the gap detail clearly.

  const [magnifier, setMagnifier] = useState<{
    cx: number;   // world-X of the focus point
    cy: number;   // world-Y of the focus point
    mx: number;   // client-X (screen) where the loupe should follow
    my: number;   // client-Y (screen)
    label: string; // e.g. "فجوة 0.23 مم"
  } | null>(null);

  // Geometry Fix Mode integration
  const { geometryFixMode, setGeometryFixMode } = useGeometryFixMode();

  // Active dataset = "after" (default) or "before" (original file) view.
  const active: PreviewData = showBefore && before
    ? before
    : { analysis, issueIndices, openPoints: openPoints ?? [], pathCount: pathCount ?? 0, bridges: bridges ?? [] };

  // Applied bridge entities (live preview of the fix, with Undo support).
  const [fixEntities, setFixEntities] = useState<FixBridgeEntity[]>([]);
  // Rebuild proposed fix entities whenever the file / method / mode changes.
  const proposedFixes = useMemo(
    () => (geometryFixMode.enabled ? buildFixBridgeEntities(active.analysis, geometryFixMode.method) : []),
    [geometryFixMode.enabled, geometryFixMode.method, active.analysis],
  );
  const applyFix = useCallback(() => {
    setFixEntities(proposedFixes);
    setGeometryFixMode(prev => ({ ...prev, applied: proposedFixes.length > 0 }));
  }, [proposedFixes, setGeometryFixMode]);
  const undoFix = useCallback(() => {
    setFixEntities([]);
    setGeometryFixMode(prev => ({ ...prev, applied: false }));
  }, [setGeometryFixMode]);
  // Switching mode off clears both the applied mark and the live entities.
  const toggleFixMode = useCallback(() => {
    setGeometryFixMode(prev => {
      const enabled = !prev.enabled;
      return enabled
        ? { ...prev, enabled }
        : { enabled, method: prev.method, applied: false };
    });
    if (geometryFixMode.enabled) setFixEntities([]);
  }, [geometryFixMode.enabled, setGeometryFixMode]);
  const changeFixMethod = useCallback((method: GeometryFixMethod) => {
    setGeometryFixMode(prev => ({ ...prev, method, applied: false }));
    setFixEntities([]);
  }, [setGeometryFixMode]);

  const bounds = getDxfBounds(active.analysis.entities);
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
  const allPaths = buildSvgPaths(active.analysis.entities, bounds);
  allPathsRef.current = allPaths;
  const layerList = active.analysis.stats.layers;

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
    if (issuesOnly && !active.issueIndices.has(p.entityIndex)) return false;
    return true;
  });

  const strokeW = Math.max(bounds.width, bounds.height) * 0.004;
  const hasIssues = active.issueIndices.size > 0;

  // Gap magnifier window: zoom the area around the cursor (K× relative to the
  // base render). MAG_WIN = the world-unit width of the loupe viewBox window.

  const MAG_K = 12;                     // relative magnification factor
  const MAG_SIZE = 224;                  // loupe diameter in px
  const magWin = vw / MAG_K;             // world-units across the loupe window
  const magHalf = magWin / 2;

  // Calculate open loop points in SVG coordinates
  const { maxY } = bounds;
  const flipY = (y: number) => maxY - y + bounds.minY;
  const svgOpenPoints = active.openPoints.map(p => ({
    x: p.x,
    y: flipY(p.y),
  }));

  // Hover handlers for the gap magnifier — reuse for dots, dashed bridges and
  // blue fix geometry. Stores client coords so the loupe follows the cursorه
  const focusHandlers = (cx: number, cy: number, label: string) => ({
    onMouseEnter: (e: { clientX: number; clientY: number }) => setMagnifier({ cx, cy, mx: e.clientX, my: e.clientY, label }),
    onMouseMove: (e: { clientX: number; clientY: number }) =>
      setMagnifier(m => (m ? { ...m, mx: e.clientX, my: e.clientY } : m)),
    onMouseLeave: () => setMagnifier(null),
  });

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
          {before && (
            showBefore
              ? (lang === "ar" ? " — قبل الإصلاح" : " — Before fix")
              : (lang === "ar" ? " — بعد الإصلاح" : " — After fix")
          )}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Before/After toggle: compare the ORIGINAL file against the repaired one */}
          {before && (
            <div className="flex rounded-lg border border-border overflow-hidden font-mono text-xs">
              <button
                onClick={() => setShowBefore(true)}
                className={`px-3 py-1 transition ${
                  showBefore
                    ? "bg-amber-500/20 text-amber-400 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang === "ar" ? "قبل الإصلاح" : "Before"}
              </button>
              <button
                onClick={() => setShowBefore(false)}
                className={`px-3 py-1 transition ${
                  !showBefore
                    ? "bg-accent/20 text-accent font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang === "ar" ? "بعد الإصلاح" : "After"}
              </button>
            </div>
          )}
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
          {active.openPoints.length > 0 && (
            <button
              onClick={() => setShowOpenLoops(v => !v)}
              className={`font-mono text-xs px-3 py-1 rounded-lg border transition ${
                showOpenLoops
                  ? "border-red-500 bg-red-500/20 text-red-400"
                  : "border-border text-muted-foreground hover:border-red-500/50 hover:text-red-400"
              }`}
            >
              {lang === "ar" ? `🟡 ${active.pathCount} نقطة تحتاج إصلاح` : `🔴 Open points (${active.pathCount})`}
            </button>
          )}
          {active.bridges.length > 0 && (
            <button
              onClick={() => setShowOpenLoops(v => !v)}
              className={`font-mono text-xs px-3 py-1 rounded-lg border transition ${
                showOpenLoops
                  ? "border-green-500 bg-green-500/20 text-green-400"
                  : "border-border text-muted-foreground hover:border-green-500/50 hover:text-green-400"
              }`}
            >
              {lang === "ar" ? `🔗 ${active.bridges.length} خطوط توصيل` : `🔗 Bridges (${active.bridges.length})`}
                        </button>
          )}
          {active.bridges.length > 0 && (
            <button
              onClick={toggleFixMode}
              className={`font-mono text-xs px-3 py-1 rounded-lg border transition ${
                geometryFixMode.enabled
                  ? "border-blue-500 bg-blue-500/20 text-blue-400"
                  : "border-border text-muted-foreground hover:border-blue-500/50 hover:text-blue-400"
              }`}
            >
              {lang === "ar" ? `🔧 وضع إصلاح الهندسة` : `🔧 Geometry Fix Mode`}
            </button>
          )}
          {geometryFixMode.enabled && (
            <div className="flex rounded-lg border border-border overflow-hidden font-mono text-xs">
              <button
                onClick={() => changeFixMethod("smart")}
                className={`px-3 py-1 transition ${
                  geometryFixMode.method === "smart"
                    ? "bg-purple-500/20 text-purple-400 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={lang === "ar"
                  ? "يحلل أسلوب الرسم ويكمل بنفس النمط (خط/قوس/منحنى)"
                  : "Analyzes the drawing style and continues in the same pattern (line/arc/curve)"}
              >
                {lang === "ar" ? `🧠 ذكي` : `🧠 Smart`}
              </button>
              <button
                onClick={() => changeFixMethod("straight")}
                className={`px-3 py-1 transition ${
                  geometryFixMode.method === "straight"
                    ? "bg-blue-500/20 text-blue-400 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang === "ar" ? `خط مستقيم` : `Straight Line`}
              </button>
              <button
                onClick={() => changeFixMethod("arc")}
                className={`px-3 py-1 transition ${
                  geometryFixMode.method === "arc"
                    ? "bg-blue-500/20 text-blue-400 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang === "ar" ? `قوس` : `Arc Blend`}
              </button>
              <button
                onClick={() => changeFixMethod("skip")}
                className={`px-3 py-1 transition ${
                  geometryFixMode.method === "skip"
                    ? "bg-blue-500/20 text-blue-400 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang === "ar" ? `تخطي` : `Skip`}
              </button>
            </div>
          )}
          {geometryFixMode.enabled && proposedFixes.length > 0 && !(showBefore && before) && (
            <div className="flex items-center gap-1.5">
              {geometryFixMode.applied ? (
                <button
                  onClick={undoFix}
                  className="font-mono text-xs px-3 py-1 rounded-lg border border-green-500/50 bg-green-500/15 text-green-400 hover:bg-green-500/25 transition font-bold"
                >
                  {lang === "ar"
                    ? `✓ تم تطبيق ${proposedFixes.length} إصلاح — تراجع`
                    : `✓ Applied ${proposedFixes.length} fixes — Undo`}
                </button>
              ) : (
                <button
                  onClick={applyFix}
                  className="font-mono text-xs px-3 py-1 rounded-lg border border-cyan-500/50 bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 transition font-bold"
                >
                  {lang === "ar" ? `✔ تطبيق ${proposedFixes.length} إصلاح` : `✔ Apply ${proposedFixes.length} fixes`}
                </button>
              )}
              {fixEntities.length > 0 && !geometryFixMode.applied && (
                <button
                  onClick={undoFix}
                  className="font-mono text-xs px-3 py-1 rounded-lg border border-amber-500/50 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition"
                >
                  {lang === "ar" ? "↩ تراجع" : "↩ Undo"}
                </button>
              )}
            </div>
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
            const isIssue = active.issueIndices.has(p.entityIndex);
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
          {/* Bridge preview lines - dashed lines showing how open endpoints will be connected */}
          {showOpenLoops && active.bridges.map((bridge, i) => {
            const { from, to, closable } = bridge;
            const fx = from.x, fy = flipY(from.y);
            const tx = to.x, ty = flipY(to.y);
            const mcx = (from.x + to.x) / 2;
            const mcy = (from.y + to.y) / 2;
            const color = closable ? "#22c55e" : "#ef4444"; // green for auto-closable, red for manual
            const opacity = closable ? 0.7 : 0.5;
            const dash = closable ? "4,2" : "8,4";
            const label = lang === "ar"
              ? `فجوة ${bridge.gap.toFixed(3)} مم`
              : `Gap ${bridge.gap.toFixed(3)} mm`;
            return (
              <line
                key={`bridge-${i}`}
                x1={fx} y1={fy} x2={tx} y2={ty}
                stroke={color}
                strokeWidth={strokeW * 1.2}
                strokeDasharray={dash}
                opacity={opacity}
                strokeLinecap="round"
                {...focusHandlers(mcx, mcy, label)}
              />
            );
          })}
          {/* Applied / proposed Geometry-Fix bridges — solid blue so the user
              sees EXACTLY where the new connecting geometry will be drawn. */}
          {(fixEntities.length > 0 || (geometryFixMode.enabled && proposedFixes.length > 0)) && (
            <g>
              {(fixEntities.length > 0 ? fixEntities : proposedFixes).map((fix, i) => {
                const { from, to } = fix.bridge;
                const fx = from.x, fy = flipY(from.y);
                const tx = to.x, ty = flipY(to.y);
                const mcx = (from.x + to.x) / 2;
                const mcy = (from.y + to.y) / 2;
                const label = lang === "ar"
                  ? `ربط ${fix.bridge.gap.toFixed(3)} مم`
                  : `Bridge ${fix.bridge.gap.toFixed(3)} mm`;
                if (fix.entity.type === "LWPOLYLINE" && fix.entity.vertices && fix.entity.vertices.length > 2) {
                  const pts = [
                    { x: fx, y: fy },
                    ...fix.entity.vertices.slice(1, -1).map(v => ({ x: v.x, y: flipY(v.y) })),
                    { x: tx, y: ty },
                  ];
                  const d = pts.map((p, j) => `${j === 0 ? "M" : "L"} ${p.x.toFixed(4)} ${p.y.toFixed(4)}`).join(" ");
                  return (
                    <path
                      key={`fix-arc-${i}`}
                      d={d}
                      stroke="#3b82f6"
                      strokeWidth={strokeW * 1.4}
                      fill="none"
                      opacity={0.95}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      {...focusHandlers(mcx, mcy, label)}
                    />
                  );
                }
                return (
                  <line
                    key={`fix-line-${i}`}
                    x1={fx} y1={fy} x2={tx} y2={ty}
                    stroke="#3b82f6"
                    strokeWidth={strokeW * 1.4}
                    opacity={0.95}
                    strokeLinecap="round"
                    {...focusHandlers(mcx, mcy, label)}
                  />
                );
              })}
            </g>
          )}
          {/* Open loop indicators - bright red circles */}
          {showOpenLoops && svgOpenPoints.map((pt, i) => (
            <g
              key={`open-${i}`}
              {...focusHandlers(
                active.openPoints[i]?.x ?? pt.x,
                active.openPoints[i]?.y ?? pt.y,
                lang === "ar" ? "نقطة مفتوحة" : "Open point",
              )}
            >
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

      {/* Gap magnifier — circular loupe that follows the cursor over open
          points / bridges, rendering the area magnified so the user sees the
          exact gap detail (and the proposed blue bridge) clearly. */}
      {magnifier && (
        <div
          style={{
            position: "fixed",
            left: magnifier.mx + 18,
            top: magnifier.my + 18,
            width: MAG_SIZE,
            height: MAG_SIZE,
            borderRadius: "50%",
            overflow: "hidden",
            border: "2px solid rgba(59,130,246,0.9)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.7)",
            background: "#0d1117",
            pointerEvents: "none",
            zIndex: 60,
          }}
        >
          <svg
            viewBox={`${magnifier.cx - magHalf} ${flipY(magnifier.cy) - magHalf} ${magWin} ${magWin}`}
            width={MAG_SIZE}
            height={MAG_SIZE}
          >
            {/* Context geometry — dimmed so the gap stands out */}
            {visiblePaths.map((p, i) => (
              <path
                key={`mag-${i}`}
                d={p.d}
                stroke="#64748b"
                strokeWidth={0.5}
                fill="none"
                opacity={0.4}
              />
            ))}
            {/* Dashed bridge lines */}
            {showOpenLoops && active.bridges.map((bridge, i) => (
              <line
                key={`mag-bridge-${i}`}
                x1={bridge.from.x}
                y1={flipY(bridge.from.y)}
                x2={bridge.to.x}
                y2={flipY(bridge.to.y)}
                stroke={bridge.closable ? "#22c55e" : "#ef4444"}
                strokeWidth={1.8}
                strokeDasharray={bridge.closable ? "4,2" : "8,4"}
                opacity={0.95}
              />
            ))}
            {/* Blue fix bridges (proposed or applied) */}
            {(fixEntities.length > 0 || (geometryFixMode.enabled && proposedFixes.length > 0)) &&
              (fixEntities.length > 0 ? fixEntities : proposedFixes).map((fix, i) => {
                const { from, to } = fix.bridge;
                if (fix.entity.type === "LWPOLYLINE" && fix.entity.vertices && fix.entity.vertices.length > 2) {
                  const pts = [
                    { x: from.x, y: flipY(from.y) },
                    ...fix.entity.vertices.slice(1, -1).map(v => ({ x: v.x, y: flipY(v.y) })),
                    { x: to.x, y: flipY(to.y) },
                  ];
                  const d = pts.map((p, j) => `${j === 0 ? "M" : "L"} ${p.x.toFixed(4)} ${p.y.toFixed(4)}`).join(" ");
                  return (
                    <path
                      key={`mag-fix-arc-${i}`}
                      d={d}
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="none"
                      opacity={0.98}
                    />
                  );
                }
                return (
                  <line
                    key={`mag-fix-line-${i}`}
                    x1={from.x}
                    y1={flipY(from.y)}
                    x2={to.x}
                    y2={flipY(to.y)}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    opacity={0.98}
                  />
                );
              })}
            {/* Open point dots */}
            {showOpenLoops && svgOpenPoints.map((pt, i) => (
              <g key={`mag-open-${i}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={3.5}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={2}
                  opacity={0.95}
                />
                <circle cx={pt.x} cy={pt.y} r={1.5} fill="#ef4444" />
              </g>
            ))}
            {/* Center crosshair */}
            <line
              x1={magnifier.cx - magHalf * 0.08}
              y1={flipY(magnifier.cy)}
              x2={magnifier.cx + magHalf * 0.08}
              y2={flipY(magnifier.cy)}
              stroke="rgba(59,130,246,0.5)"
              strokeWidth={1}
            />
            <line
              x1={magnifier.cx}
              y1={flipY(magnifier.cy) - magHalf * 0.08}
              x2={magnifier.cx}
              y2={flipY(magnifier.cy) + magHalf * 0.08}
              stroke="rgba(59,130,246,0.5)"
              strokeWidth={1}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 0,
              right: 0,
              textAlign: "center",
            }}
          >
            <span
              style={{
                background: "rgba(0,0,0,0.75)",
                color: "#e2e8f0",
                padding: "2px 10px",
                borderRadius: 10,
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {magnifier.label}
              </span>
          </div>
        </div>
      )}

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
        {active.openPoints.length > 0 && (
          <span className="flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 text-red-400">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-red-500" />
            {lang === "ar"
              ? `${active.pathCount} نقطة تحتاج إصلاح`
              : `${active.pathCount} points need repair`}
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
  // React #418 fix: /tool is a fully client-interactive page — skip SSR so the
  // server never renders markup that could mismatch the first client render.
  ssr: false,
  // No beforeLoad guard — tool is 100% free, no registration or paywall required
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

/** Phase 7 (UI only): step indicator 01–04 mapped onto the existing Stage machine. */
function StepIndicator({ stage, lang }: { stage: Stage; lang: "ar" | "en" }) {
  const ar = lang === "ar";
  const steps = ar
    ? ["رفع الملف", "فحص DXF", "مراجعة النتائج", "تنزيل الملف"]
    : ["Upload", "Scan DXF", "Review results", "Download"];
  const current =
    stage === "upload" ? 0 :
    stage === "analyzing" ? 1 :
    stage === "result" ? 2 : 3;
  return (
    <div className="max-w-3xl mx-auto mb-10 px-2" dir={ar ? "rtl" : "ltr"}>
      <ol className="flex items-center justify-between gap-1 select-none">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={i} className="flex-1 flex items-center gap-1 min-w-0">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <span
                  className={[
                    "w-8 h-8 rounded-full grid place-items-center font-mono text-xs border transition",
                    done ? "bg-primary text-primary-foreground border-primary"
                      : active ? "border-accent text-accent bg-accent/10 ring-2 ring-accent/30"
                      : "border-border text-muted-foreground",
                  ].join(" ")}
                >
                  {done ? "✓" : `0${i + 1}`}
                </span>
                <span
                  className={[
                    "text-[11px] leading-tight text-center whitespace-nowrap",
                    active ? "text-accent font-semibold" : done ? "text-foreground" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  className={[
                    "flex-1 h-px mx-1 mt-[-18px]",
                    i < current ? "bg-primary" : "bg-border",
                  ].join(" ")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ToolPage() {
  const [lang, setLang] = useState<Lang>("ar");
  const [stage, setStage] = useState<Stage>("upload");
  // Geometry Fix Mode — shared with the preview toolbar (read `applied`).
  const { geometryFixMode } = useGeometryFixMode();
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [analysis, setAnalysis] = useState<DxfAnalysis | null>(null);
  const [repairedContent, setRepairedContent] = useState("");
  const [repairedIssues, setRepairedIssues] = useState<DxfIssue[]>([]);
  const [fixSummary, setFixSummary] = useState<FixSummaryItem[]>([]);
  // Re-scan result of the ACTUAL repaired DXF — the verified source of truth
  // after repair. Never substitute a hard-coded 100 for this.
  const [repairedAnalysis, setRepairedAnalysis] = useState<DxfAnalysis | null>(null);
  const [reScanFailed, setReScanFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const isRTL = lang === "ar";

  // Cost estimator state
  const [pricePerMeter, setPricePerMeter] = useState(5);
  const [showCostEstimator, setShowCostEstimator] = useState(false);

    // Self-destruct state
  const [selfDestructEnabled, setSelfDestructEnabled] = useState(false);
  const [selfDestructTriggered, setSelfDestructTriggered] = useState(false);

  // Phase 7 (UI only): presentation state — no engine changes.
  const [showScanDetails, setShowScanDetails] = useState(false);
  const [repairHadChanges, setRepairHadChanges] = useState(false);

  // Phase 2: optional curve→polyline conversion (OFF by default).
  const [convertCurves, setConvertCurves] = useState(false);

  // React #418 fix: never show engine-derived numbers before the browser has
  // woken up. SSR markup must match the first client render exactly, so the
  // report card renders a skeleton until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    // Client-only: check self-destruct state from localStorage
    setSelfDestructTriggered(isSelfDestructTriggered());
  }, []);

  // Trust notice modal
  const [showTrustModal, setShowTrustModal] = useState(false);

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

  // Tool is 100% free — no subscription checks needed
  const userIsSubscribed = false;

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
      title: "إصلاح ملف DXF",
      sub: "نظّف ملفك قبل إرساله إلى الليزر أو CNC",
      dropZone: "اسحب وأفلت ملف DXF هنا",
      dropOr: "أو",
      dropBtn: "اختر ملف من الجهاز",
      dropNote: "يدعم ملفات .dxf — المعالجة تتم في متصفحك تماماً",
      analyzing: "جاري تحليل الملف...",
      score: "تقييم الجاهزية",
      stats: "إحصائيات الملف",
      issues: "المشاكل المكتشفة",
      noIssues: "✓ لم تُكتشف أي مشاكل — الملف جاهز للقص!",
      repairBtn: "إصلاح المشاكل الآمنة ←",
      downloadFixed: "تنزيل ملف DXF المُصلح",
      downloadReport: "تحميل التقرير",
      reset: "تحليل ملف آخر",
      repaired: "✓ تم تجهيز نسخة DXF",
      repairedSub: "المشاكل التالية تم إصلاحها:",
      fixedSection: "ما تم إصلاحه",
      reviewSection: "تم اكتشافه — يحتاج مراجعة (لم يتم تغييره)",
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
      freeBanner: (remaining: number) => `استخدام مجاني: ${remaining} متبقية`,
      freeSubscribe: "استخدم الأداة بحرية — مجانية 100%",
      unlimited: "استخدام غير محدود ✓",
      // Fix Summary
      fixSummaryTitle: "تقرير الإصلاحات والتعديلات",
      fixSummarySub: "نظرة تفصيلية على التغييرات التي تم إجراؤها على ملف DXF",
      // Unified report (v1.0): single scan & repair card
      reportTitle: "تقرير الفحص والإصلاح",
      reportSub: "نتائج الفحص الفعلية من محرك الإصلاح",
      reportFixedAuto: "تم الإصلاح تلقائياً",
      reportNeedsReview: "يحتاج مراجعة",
      reportFileState: "حالة الملف",
      reportOf100: "(من 100)",
      reportReadyCut: "جاهز للقص ✓",
      reportReadyCutSub: "تمت إعادة فحص الملف بعد الإصلاح — لا توجد حالات بحاجة لمراجعتك",
      techDetails: "تفاصيل تقنية",
      techDupRemoved: "مكررات تم حذفها",
      techOverlaps: "تداخلات معلَّمة (لم تُحذف)",
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
      freeBanner: (remaining: number) => `Free usage: ${remaining} remaining`,
      freeSubscribe: "Use the tool freely — 100% free",
      unlimited: "Unlimited usage ✓",
      // Fix Summary
      fixSummaryTitle: "Fix Summary Report",
      fixSummarySub: "Detailed overview of changes made to your DXF file",
      // Unified report (v1.0): single scan & repair card
      reportTitle: "Scan & Repair Report",
      reportSub: "Actual results from the repair engine",
      reportFixedAuto: "Auto-fixed",
      reportNeedsReview: "Needs review",
      reportFileState: "File state",
      reportOf100: "(/100)",
      reportReadyCut: "Ready to cut ✓",
      reportReadyCutSub: "File re-scanned after repair — nothing needs your review",
      techDetails: "Technical details",
      techDupRemoved: "duplicates removed",
      techOverlaps: "overlaps marked (not deleted)",
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
    const isSvg = file.name.toLowerCase().endsWith(".svg");
    const isDxf = file.name.toLowerCase().endsWith(".dxf");
    
    if (!isDxf && !isSvg) {
      alert(lang === "ar" ? "يرجى رفع ملف بصيغة .dxf أو .svg فقط" : "Please upload a .dxf or .svg file only");
      return;
    }

    // Track file upload (excluding localhost and admin users)
    const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";
    const isAdmin = typeof window !== "undefined" && window.location.search.includes("admin=true");
    if (!isLocalhost && !isAdmin) {
      track('Used DXF Fixer', { timestamp: new Date().toISOString() });
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
        let result: DxfAnalysis;

        if (isSvg) {
          // Parse SVG and convert to DXF entities
          const svgResult = parseSvg(content);
          if (svgResult.errors.length > 0) {
            alert(lang === "ar" 
              ? `خطأ في تحليل SVG: ${svgResult.errors.join(", ")}` 
              : `SVG parse error: ${svgResult.errors.join(", ")}`);
            clearInterval(interval);
            setStage("upload");
            return;
          }
          // Create a temporary DXF content from SVG entities
          const tempHeader = "  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1015\n  0\nENDSEC\n";
          const tempTail = "  0\nEOF\n";
          const tempContent = tempHeader + "\n  0\nSECTION\n  2\nENTITIES\n" + 
            svgResult.entities.map(e => e.rawLines.join("\n")).join("\n") + 
            "\n  0\nENDSEC\n" + tempTail;
          
          result = analyzeDxf(tempContent);
        } else {
          result = analyzeDxf(content);
        }

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
    if (file) { recordUpload(); processFile(file); }
  }, [processFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { recordUpload(); processFile(file); }
  };

  const handleRepair = () => {
    if (!analysis) return;
    // 1) Repair using the real engine.
        const { fixed, repaired, fixSummary: summary } = repairDxf(
      fileContent,
      analysis,
      convertCurves ? { convertCurvesToPolylines: true } : undefined
    );
    setRepairedContent(fixed);
    setRepairedIssues(repaired);
    setFixSummary(summary);
    setRepairHadChanges(repaired && summary.some(s => s.id === "real_cleanup"));
    saveToHistory(fileName, analysis, true);

    // 2) RE-SCAN: re-parse and re-analyze the ACTUAL repaired DXF.
    //    The final score must come from this NEW analysis, never from a
    //    hard-coded 100. "Repair succeeded" does not mean "DXF is perfect".
    try {
      const re = analyzeDxf(fixed);
      setRepairedAnalysis(re);
      setReScanFailed(false);
      // Verification gate: only count the repair if the repaired file is
      // still readable and produces a non-degenerate analysis.
      if (re.stats.totalEntities > 0) {
        recordRepair();
      }
    } catch (e) {
      // Re-scan failed → never claim the file is verified.
      console.error("Re-scan of repaired DXF failed:", e);
      setRepairedAnalysis(null);
      setReScanFailed(true);
    }
    setStage("repaired");
  };

  const handleDownloadFixed = () => {
    // If the user applied Geometry-Fix bridges, inject them into the exported
    // DXF so the downloaded file actually contains the new connecting geometry.
    let content = repairedContent;
    const fixAnalysis = repairedAnalysis ?? analysis;
    if (geometryFixMode.applied && geometryFixMode.enabled && geometryFixMode.method !== "skip" && fixAnalysis) {
      const fixes = buildFixBridgeEntities(fixAnalysis, geometryFixMode.method);
      if (fixes.length > 0) {
        content = appendFixEntitiesToDxf(content, fixes);
      }
    }
    triggerMonetagAdAndDownload(content, fileName.replace(/\.dxf$/i, "_fixed.dxf"));
  };

  const triggerMonetagAdAndDownload = (content: string, name: string) => {
    const monetagLink = import.meta.env.VITE_MONETAG_DIRECT_LINK;
    if (monetagLink && typeof window !== "undefined") {
      try {
        window.open(monetagLink, "_blank");
      } catch (e) {
        console.log("Monetag ad triggered");
      }
    }
    downloadFile(content, name);
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
    setRepairedAnalysis(null);
    setReScanFailed(false);
    setShowScanDetails(false);
    setRepairHadChanges(false);
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
    // No gate — bulk download is free for everyone
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

  // Open loop detection: unified pipeline (v1.2 consistency fix).
  //   gap < 0.1mm  → auto-close (count as FIXED, no red dot)
  //   gap >= 0.1mm → real problem (draw red, needs manual repair)
  // ── SINGLE SOURCE OF TRUTH ─────────────────────────────────────────────────
  // displayAnalysis drives every UI surface (score card, SVG preview, open-point
  // dots, report card). computeOpenLoopData uses the SAME engine (detectOpenPaths)
  // and threshold (0.1mm) as analyzeDxf, so the preview can never contradict the
  // report again.
  const displayAnalysis = stage === "repaired" && repairedAnalysis
    ? repairedAnalysis
    : analysis;

  const openLoopData = computeOpenLoopData(displayAnalysis);
  // "Before" state: the ORIGINAL (pre-repair) file — used by the before/after
  // preview toggle so the user can visually compare both states.
  const beforeLoopData = computeOpenLoopData(analysis);

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
        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl sm:text-5xl font-bold">{t.title}</h1>
          <p className="mt-3 text-muted-foreground text-lg">{t.sub}</p>
        </div>

        {/* Phase 7 (UI only): 4-step progress indicator — reflects the real
            stage state machine, no fake percentages. */}
        <StepIndicator stage={stage} lang={lang} />

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
                accept=".dxf,.svg"
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
            {/* ✨ FEATURES SHOWCASE — إمكانيات الأداة */}
            <div className="mb-10 rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 via-card to-primary/5 p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 className="font-display text-2xl sm:text-3xl font-bold">
                  {lang === "ar" ? "ماذا تفعل الأداة؟" : "What does the tool do?"}
                </h2>
                <p className="text-muted-foreground text-sm mt-2 max-w-xl mx-auto">
                  {lang === "ar"
                    ? "كل ما يفعله مصممو الملفات المحترفون — تلقائياً وبضغطة زر"
                    : "Everything professional file designers do — automatically, with one click"}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Feature 1 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">✏️</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "تقليل النقاط" : "Node Reduction"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "حذف النقاط الزائدة بدون تغيير الشكل — حتى 70% أقل" : "Remove excess nodes without changing shape — up to 70% less"}</p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">🔗</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "دمج الخطوط" : "Merge Paths"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "دمج جميع الخطوط المتلامسة في مسار واحد متصل" : "Join all touching lines into a single continuous path"}</p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">⭕</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "إغلاق المسارات" : "Close Paths"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "إغلاق المسارات المفتوحة عند الحاجة — قبل القطع" : "Close open paths where needed — before cutting"}</p>
                  </div>
                </div>

                {/* Feature 4 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500/20 to-red-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">🔀</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "إزالة التكرارات" : "Remove Duplicates"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "كشف وحذف العناصر المكررة — يمنع القطع المزدوج" : "Detect & delete duplicate entities — prevents double-cutting"}</p>
                  </div>
                </div>

                {/* Feature 5 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">🧹</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "تنظيف الملف" : "File Cleaning"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "إزالة النقاط المعلقة، الخطوط التالفة، الطبقات المخفية" : "Remove dangling nodes, broken lines, hidden layers"}</p>
                  </div>
                </div>

                {/* Feature 6 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500/20 to-pink-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">🔄</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "تحويل المنحنيات" : "Curve Conversion"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "تحويل ARCS, CIRCLES, SPLINES, ELLIPSES إلى POLYLINES" : "Convert ARCS, CIRCLES, SPLINES, ELLIPSES to POLYLINES"}</p>
                  </div>
                </div>

                {/* Feature 7 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">🔍</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "فحص الجودة" : "Quality Check"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "كشف 7 أنواع من المشاكل: تقاطعات، فجوات، منحنيات مكسورة..." : "Detect 7 issue types: intersections, gaps, broken curves..."}</p>
                  </div>
                </div>

                {/* Feature 8 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">📐</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "تحسين سرعة القص" : "Speed Optimization"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "ترتيب مسارات القص لتقليل حركة رأس الليزر حتى 40%" : "Order cut paths to minimize laser head movement up to 40%"}</p>
                  </div>
                </div>

                {/* Feature 9 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500/20 to-teal-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">📊</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "تقييم جاهزية" : "Readiness Score"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "تقييم من 0-100 مع تقرير مفصل بالإصلاحات" : "Score 0-100 with detailed fix report"}</p>
                  </div>
                </div>

                {/* Feature 10 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">📁</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "دعم DXF + SVG" : "DXF + SVG Support"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "ارفع DXF أو SVG — المخرجات DXF جاهز للماكينة" : "Upload DXF or SVG — output is machine-ready DXF"}</p>
                  </div>
                </div>

                {/* Feature 11 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">🖼</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "معاينة تفاعلية" : "Interactive Preview"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "عرض الرسم مع إخفاء/إظهار الطبقات واكتشاف المشاكل بصرياً" : "View drawing with layer toggle and visual issue highlighting"}</p>
                  </div>
                </div>

                {/* Feature 12 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500/20 to-rose-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">▶️</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "محاكاة مسار القص" : "Cut Path Simulation"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "محاكاة متحركة لمسار رأس الليزر على الرسم" : "Animated simulation of laser head path on the drawing"}</p>
                  </div>
                </div>

                {/* Feature 13 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500/20 to-sky-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">💰</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "تقدير تكلفة القص" : "Cost Estimator"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "حساب تكلفة القص التقديرية بناءً على طول المسار والسعر" : "Calculate estimated cutting cost based on path length and rate"}</p>
                  </div>
                </div>

                {/* Feature 14 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">📦</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "معالجة مجمعة" : "Batch Processing"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "رفع عدة ملفات دفعة واحدة وتحميلها كملف ZIP مضغوط" : "Upload multiple files at once and download as ZIP archive"}</p>
                  </div>
                </div>

                {/* Feature 15 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-lime-500/20 to-lime-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">🔒</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "التدمير الذاتي" : "Self-Destruct"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "حذف الملفات تلقائياً من السيرفر بعد التحميل لضمان السرية" : "Auto-delete files from server after download for confidentiality"}</p>
                  </div>
                </div>

                {/* Feature 16 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">📋</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "تقرير مفصل" : "Detailed Report"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "تقرير كامل بالإصلاحات مع إحصائيات الملف وتقييم الجاهزية" : "Full fix report with file statistics and readiness evaluation"}</p>
                  </div>
                </div>

                {/* Feature 17 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">🛡️</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "فحص أمان الماكينة" : "Machine Safety Check"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "التحقق من أن الملف ضمن حدود لوح العمل وبدون حركات فجائية" : "Verify file is within work bed bounds with no jerk movements"}</p>
                  </div>
                </div>

                {/* Feature 18 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-500/20 to-slate-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">🌐</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "عربية + إنجليزية" : "Arabic + English"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "واجهة كاملة بالعربية والإنجليزية مع دعم RTL/LTR" : "Full interface in Arabic and English with RTL/LTR support"}</p>
                  </div>
                </div>

                {/* Feature 19 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-stone-500/20 to-stone-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">📜</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "سجل الملفات" : "File History"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "حفظ آخر 5 ملفات محللة مع نتائج التقييم للإشارة السريعة" : "Save last 5 analyzed files with scores for quick reference"}</p>
                  </div>
                </div>

                {/* Feature 20 */}
                <div className="bg-background/80 border border-border/60 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neutral-500/20 to-neutral-500/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">🔊</div>
                  <div>
                    <h4 className="font-display font-semibold text-sm">{lang === "ar" ? "مشاركة الأداة" : "Share Tool"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{lang === "ar" ? "مشاركة الأداة مع الأصدقاء عبر واتساب، تويتر، فيسبوك، أو نسخ الرابط" : "Share the tool via WhatsApp, Twitter, Facebook, or copy link"}</p>
                  </div>
                </div>
              </div>

              {/* Compatible with badge */}
              <div className="mt-5 pt-4 border-t border-border/40 text-center">
                <p className="text-xs text-muted-foreground/60 font-mono">
                  {lang === "ar" ? "متوافق مع:" : "Compatible with:"}
                  <span className="text-foreground/80"> RDWorks · LightBurn · CorelDRAW · LaserGRBL · CNC · Plasma</span>
                </p>
              </div>
            </div>

            {/* Share Tool Widget — upload stage */}
            <div className="mt-6">
              <ShareToolWidget lang={lang} variant="inline" />
            </div>

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
            {/* Score card — driven by the REAL re-scan of the repaired DXF */}
            {(() => {
              // Final verified score from re-analyzing the repaired file —
              // same source as preview + report card (displayAnalysis).
              const finalScore = (displayAnalysis ?? analysis).score;
              const finalLabel = scoreLabel(finalScore, lang);
              return (
            <div className={`rounded-2xl border p-8 flex flex-col sm:flex-row items-center gap-6 ${scoreBg(finalScore)}`}>
              <div className="text-center">
                <div className={`font-display text-7xl font-bold ${scoreColor(finalScore)}`}>
                  {finalScore}
                </div>
                <div className="font-mono text-xs text-muted-foreground mt-1">/ 100</div>
                {stage === "repaired" && reScanFailed && (
                  <div className="mt-2 text-xs font-bold text-red-400">⚠️ {lang === "ar" ? "فشل إعادة التحقق" : "Verification failed"}</div>
                )}
              </div>
              <div className="flex-1 text-center sm:text-start">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{t.score}</p>
                <h2 className="font-display text-2xl font-bold mt-1">
                  {stage === "repaired" && reScanFailed
                    ? (lang === "ar" ? "تعذر التحقق من الملف المُصلّح" : "Repaired file not verifiable")
                    : finalLabel}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 font-mono">{fileName}</p>
                {stage === "repaired" && !reScanFailed && repairedAnalysis && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {lang === "ar"
                      ? `أعيد فحص الملف المُصلّح: ${repairedAnalysis.stats.totalEntities} كيان · ${repairedAnalysis.issues.length} مشكلة متبقية`
                      : `Repaired file re-scanned: ${repairedAnalysis.stats.totalEntities} entities · ${repairedAnalysis.issues.length} remaining issues`}
                  </p>
                )}
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
              );
            })()}

            {/* SVG Preview */}
            {(() => {
              // Preview + issue markers come from the SAME analysis as the
              // score/report cards (single source of truth). After repair this
              // shows the post-repair state by default, with a toggle to view
              // the original pre-repair file.
              if (!displayAnalysis) return null;
              const issueIndices = new Set(displayAnalysis.issues.flatMap(i => i.entityIndices));
              const beforeIssueIndices = analysis
                ? new Set(analysis.issues.flatMap(i => i.entityIndices))
                : new Set<number>();
              return <DxfPreview
                analysis={displayAnalysis}
                issueIndices={issueIndices}
                lang={lang}
                openPoints={openLoopData.openPoints}
                pathCount={openLoopData.count}
                bridges={openLoopData.bridges}
                before={stage === "repaired" && analysis ? {
                  analysis,
                  issueIndices: beforeIssueIndices,
                  openPoints: beforeLoopData.openPoints,
                  pathCount: beforeLoopData.count,
                  bridges: beforeLoopData.bridges,
                } : undefined}
              />;
            })()}

            {/* Open Loops Count */}
            {openLoopData.count > 0 && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-center">
                <p className="text-sm font-medium text-red-400">
                  {openLoopData.count > 0
                    ? (lang === "ar"
                      ? `🟡 ${openLoopData.count} نقطة مفتوحة (فجوة ≥ 0.1 مم) تحتاج إصلاح يدوي`
                      : `🟡 ${openLoopData.count} open points (gap ≥ 0.1mm) need manual repair`)
                    : (lang === "ar"
                      ? `✓ جميع الفجوات < 0.1 مم أُغلقت تلقائياً`
                      : `✓ All gaps < 0.1mm auto-closed`)}
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
              totalEntities={(displayAnalysis ?? analysis).stats.totalEntities}
              score={(displayAnalysis ?? analysis).score}
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

            {/* v1.0 FINAL: ONE unified scan & repair report card. Numbers come
                ONLY from existing engine output (repairDxf / repairedIssues /
                analysis.issues / cleanupEntities.report). No frontend recomputation.
                The separate Phase 9 card was removed — its technical counters
                (duplicates/overlaps) live in the collapsed "تفاصيل تقنية" panel;
                the false-positive self-intersection counter was deleted. */}
            {stage === "repaired" && (() => {
              // Client-only gate: skeleton until mounted (React #418 fix).
              if (!mounted)
                return (
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
                  </div>
                );
              const fixedCount = mounted ? repairedIssues.length : 0;
              // Needs-review = whatever the VERIFIED re-scan of the repaired
              // file still reports — the same set the preview highlights
              // (single source of truth). v11 test proved this equals
              // original-minus-fixed for the p266 case (4 fixed → 0 review).
              const needsReviewCount = mounted ? (displayAnalysis ?? analysis).issues.length : 0;
              const afterScore = stage === "repaired" && repairedAnalysis ? repairedAnalysis.score : analysis.score;
              return (
                <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 to-card p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-xl">
                      📋
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg">{t.reportTitle}</h3>
                      <p className="text-xs text-muted-foreground">{t.reportSub}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-5 text-center">
                      <p className="font-mono text-3xl font-bold text-green-400">{fixedCount}</p>
                      <p className="text-sm font-semibold mt-1">✅ {t.reportFixedAuto}</p>
                    </div>
                    <div className={`rounded-2xl border p-5 text-center ${needsReviewCount > 0 ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-card"}`}>
                      <p className={`font-mono text-3xl font-bold ${needsReviewCount > 0 ? "text-yellow-400" : "text-muted-foreground"}`}>
                        {needsReviewCount}
                      </p>
                      <p className="text-sm font-semibold mt-1">👁 {t.reportNeedsReview}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-5 text-center">
                      <p className="font-mono text-2xl font-bold text-accent" dir="ltr">
                        {analysis.score} → {afterScore}
                      </p>
                      <p className="text-sm font-semibold mt-1">{t.reportFileState} {t.reportOf100}</p>
                    </div>
                  </div>

                  {needsReviewCount === 0 ? (
                    <div className="mt-5 rounded-2xl border border-green-500/40 bg-green-500/10 p-6 text-center">
                      <p className="font-display text-2xl font-bold text-green-400">{t.reportReadyCut}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.reportReadyCutSub}</p>
                      <button
                        onClick={handleDownloadFixed}
                        className="mt-4 w-full sm:w-auto px-8 py-4 rounded-xl bg-green-500 text-white font-bold text-lg hover:opacity-90 transition shadow-[var(--shadow-spark)]"
                      >
                        ⬇ {t.downloadFixed}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-center">
                      <p className="text-sm font-semibold text-yellow-400">
                        ⚠️ {lang === "ar"
                          ? `${needsReviewCount} حالة لم تُعدَّل تلقائياً حفاظاً على هندسة الرسم — راجعها قبل القص`
                          : `${needsReviewCount} item(s) were left unchanged to preserve the original geometry — review before cutting`}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Phase 7 (UI only): conservative-behavior trust box */}
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
              <p className="text-sm font-bold mb-1">🔒 {lang === "ar" ? "مهم" : "Important"}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "ar"
                  ? "الأداة لا تغيّر المشاكل التي لا تستطيع إصلاحها بأمان. إذا تم اكتشاف عنصر يحتاج مراجعة، سيظهر لك في التقرير بدل تعديله تلقائيًا."
                  : "The tool does not alter problems it cannot safely fix. Anything needing review appears in the report instead of being changed automatically."}
              </p>
            </div>

            {/* Verified Before/After comparison (based on re-scan) */}
            {stage === "repaired" && !reScanFailed && repairedAnalysis && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-xl">🔍</span>
                  <h3 className="font-display font-bold text-lg">
                    {lang === "ar" ? "المقارنة قبل/بعد (إعادة فحص حقيقية)" : "Before / After (verified re-scan)"}
                  </h3>
                </div>
                {(() => {
                  const beforeIssues = analysis.issues;
                  const afterIssues = repairedAnalysis.issues;
                  const beforeErrors = beforeIssues.filter(i => i.severity === "error").length;
                  const beforeWarnings = beforeIssues.filter(i => i.severity === "warning").length;
                  const afterErrors = afterIssues.filter(i => i.severity === "error").length;
                  const afterWarnings = afterIssues.filter(i => i.severity === "warning").length;
                  const fixed = Math.max(0, beforeIssues.length - afterIssues.length);
                  const rows = [
                    { label: lang === "ar" ? "مشاكل مكتشفة قبل الإصلاح" : "Issues detected before", before: beforeIssues.length, after: null },
                    { label: lang === "ar" ? "حرجة قبل" : "Critical before", before: beforeErrors, after: null },
                    { label: lang === "ar" ? "تحذيرات قبل" : "Warnings before", before: beforeWarnings, after: null },
                    { label: lang === "ar" ? "مشاكل متبقية بعد" : "Issues remaining after", before: null, after: afterIssues.length },
                    { label: lang === "ar" ? "حرجة متبقية" : "Critical remaining", before: null, after: afterErrors },
                    { label: lang === "ar" ? "تحذيرات متبقية" : "Warnings remaining", before: null, after: afterWarnings },
                  ];
                  return (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="p-4 rounded-xl border border-border/60">
                        <p className="text-xs text-muted-foreground font-mono mb-2">{lang === "ar" ? "المشاكل المُصلّحة" : "Issues fixed"}</p>
                        <p className="font-display text-3xl font-bold text-accent">{fixed}</p>
                      </div>
                      {rows.map((r, i) => (
                        <div key={i} className="p-4 rounded-xl border border-border/60">
                          <p className="text-xs text-muted-foreground font-mono mb-2">{r.label}</p>
                          <p className="font-display text-3xl font-bold">{r.after !== null ? r.after : r.before}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <p className="text-xs text-muted-foreground mt-4">
                  {lang === "ar"
                    ? "النتيجة النهائية مأخوذة من إعادة فحص الملف المُصلّح فعلياً، وليست قيمة مُتخيّلة."
                    : "Final score is computed by re-scanning the repaired file itself — never a hard-coded value."}
                </p>
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

            {/* Share Tool Widget — result stage */}
            <ShareToolWidget lang={lang} variant="sidebar" />

            {/* Issues */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-display font-semibold mb-4">{stage === "repaired" ? t.repaired : t.issues}</h3>

              {stage === "repaired" && repairedIssues.length > 0 && (
                <div className="space-y-3 mb-4">
                  <p className="text-xs font-semibold text-green-400 font-mono uppercase tracking-wide">
                    ✓ {lang === "ar" ? "ما تم إصلاحه" : "Fixed"}
                  </p>
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
                  <p className="text-xs font-semibold text-yellow-400 font-mono uppercase tracking-wide">
                    ⚠ {lang === "ar" ? "تم اكتشافه — يحتاج مراجعة (لم يتم تغييره)" : "Detected — needs review (unchanged)"}
                  </p>
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
                <>
                  {/* Phase 2: optional curve→polyline conversion toggle */}
                  <label className="flex items-center gap-2 pr-4 border-r border-border/60">
                    <input
                      type="checkbox"
                      checked={convertCurves}
                      onChange={(e) => setConvertCurves(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
                    />
                    <span className={`text-xs ${lang === "ar" ? "font-arabic" : ""} text-muted-foreground`}>
                      {lang === "ar"
                        ? "تحويل المنحنيات (قوس/دائرة/منحنى/قلب نجمة) إلى بوليلاين"
                        : "Convert curves (arc/circle/spline/ellipse) to polylines"}
                    </span>
                  </label>
                  <button
                    onClick={handleRepair}
                    className="px-6 py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 transition shadow-[var(--shadow-spark)]"
                  >
                    🔧 {t.repairBtn}
                  </button>
                </>
              )}
              {stage === "result" && analysis.issues.length === 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => triggerMonetagAdAndDownload(fileContent, fileName)}
                    className="px-6 py-2.5 rounded-lg bg-accent text-accent-foreground font-bold text-sm hover:opacity-90 transition shadow-[var(--shadow-spark)] flex items-center gap-2"
                  >
                    ⬇ {lang === "ar" ? "تحميل الملف" : "Download file"}
                  </button>
                </div>
              )}
              {stage === "repaired" && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleDownloadFixed}
                    className="px-6 py-2.5 rounded-lg bg-accent text-accent-foreground font-bold text-sm hover:opacity-90 transition shadow-[var(--shadow-spark)] flex items-center gap-2"
                  >
                    ⬇ {t.downloadFixed}
                  </button>
                </div>
              )}

              {/* Phase 7 (UI only): conservative download advisory */}
              {stage === "repaired" && (
                <p className="text-xs text-muted-foreground mt-3">
                  {lang === "ar"
                    ? "⚠ ننصح بمراجعة التقرير والملف الناتج قبل إرساله إلى ماكينة الليزر أو CNC."
                    : "⚠ We recommend reviewing the report and output file before sending it to a laser or CNC machine."}
                </p>
              )}

              {/* Phase 7 (UI only): expandable scan-details panel — all values
                  come from the existing engine results, human-readable labels. */}
              {stage === "result" || stage === "repaired" ? (
                <div className="mt-5 rounded-xl border border-border/60 overflow-hidden">
                  <button
                    onClick={() => setShowScanDetails(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/40 transition"
                  >
                    <span>{lang === "ar" ? "تفاصيل الفحص" : "Scan details"}</span>
                    <span className="font-mono text-xs">{showScanDetails ? "▲" : "▼"}</span>
                  </button>
                  {showScanDetails && (() => {
                    const src = displayAnalysis ?? analysis;
                    const needsReview = (displayAnalysis ?? analysis).issues.length;
                    const rows: Array<[string, string]> = [
                      [lang === "ar" ? "عدد العناصر" : "Total entities", String(src.stats.totalEntities)],
                      [lang === "ar" ? "المشاكل المكتشفة" : "Issues detected", String(analysis.issues.length)],
                      ...(stage === "repaired" ? [[
                        lang === "ar" ? "المشاكل المُصلحة" : "Issues repaired",
                        String(repairedIssues.length),
                      ] as [string, string]] : []),
                      ...(stage === "repaired" ? [[
                        lang === "ar" ? "تحتاج مراجعة (لم تُغيَّر)" : "Needs review (unchanged)",
                        String(needsReview),
                      ] as [string, string]] : []),
                      [lang === "ar" ? "أنواع المشاكل" : "Issue types",
                        analysis.issues.length > 0
                          ? [...new Set(analysis.issues.map(i => lang === "ar" ? i.ar : i.en))].join("، ")
                          : lang === "ar" ? "لا يوجد" : "none"],
                      [lang === "ar" ? "حالة الملف قبل/بعد" : "File state before/after",
                        `${analysis.score} → ${stage === "repaired" && repairedAnalysis ? repairedAnalysis.score : analysis.score} ${lang === "ar" ? "(من 100)" : "/100"}`],
                    ];
                    return (
                      <div className="px-4 pb-4 space-y-2">
                        {rows.map(([k, v]) => (
                          <div key={k} className="flex items-start justify-between gap-4 text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0">
                            <span className="text-muted-foreground">{k}</span>
                            <span className="font-medium text-end">{v}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : null}
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
    </div>
  );
}
