import { useEffect, useRef } from "react";
import type { DxfEntity } from "@/lib/dxf";
import { sortInsideFirst } from "@/lib/dxf";

type Lang = "ar" | "en";

interface ArcExact { cx: number; cy: number; radius: number; startAngle: number; endAngle: number; }

/** Exact bulge-segment → arc conversion (re-used from the repair engine math). */
function bulgeToArcExact(px1: number, py1: number, px2: number, py2: number, b: number): ArcExact | null {
  if (!Number.isFinite(b) || Math.abs(b) < 1e-8) return null;
  const dx = px2 - px1, dy = py2 - py1;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) return null;
  const theta = 4 * Math.atan(b);
  if (Math.abs(theta) >= 2 * Math.PI - 1e-6) return null;
  const r = d / (2 * Math.sin(Math.abs(theta) / 2));
  if (!Number.isFinite(r)) return null;
  const midx = (px1 + px2) / 2, midy = (py1 + py2) / 2;
  const ux = dx / d, uy = dy / d;
  const h = Math.sqrt(Math.max(r * r - (d / 2) * (d / 2), 0));
  const sign = b > 0 ? -1 : 1;
  const cx = midx + uy * h * sign, cy = midy + (-ux) * h * sign;
  const a1 = Math.atan2(py1 - cy, px1 - cx);
  const a2 = Math.atan2(py2 - cy, px2 - cx);
  const start = ((b > 0 ? a1 : a2) * 180) / Math.PI;
  const end = ((b > 0 ? a2 : a1) * 180) / Math.PI;
  return { cx, cy, radius: r, startAngle: start, endAngle: end };
}

function arcToPoints(a: ArcExact, samples: number): [number, number][] {
  let s = a.startAngle, en = a.endAngle;
  let sw = en - s; if (sw < 0) sw += 360; if (sw === 0) sw = 360;
  const steps = Math.max(8, Math.ceil((samples * sw) / 360));
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const rad = ((s + (sw * i) / steps) * Math.PI) / 180;
    pts.push([a.cx + a.radius * Math.cos(rad), a.cy + a.radius * Math.sin(rad)]);
  }
  return pts;
}

/** Return sampled point-rings for a single DXF entity. */
function sampleEntity(e: DxfEntity, samplesPerArc = 32): { pts: [number, number][][]; closed: boolean } {
  if (e.type === "LINE") return { pts: [[[e.x1 ?? 0, e.y1 ?? 0], [e.x2 ?? 0, e.y2 ?? 0]]], closed: false };
  if (e.type === "CIRCLE") {
    const cx = e.cx ?? 0, cy = e.cy ?? 0, r = e.radius ?? 0;
    const ring: [number, number][] = [];
    for (let i = 0; i < samplesPerArc; i++) { const a = (i / samplesPerArc) * Math.PI * 2; ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    ring.push(ring[0]);
    return { pts: [ring], closed: true };
  }
  if (e.type === "ARC") return { pts: [arcToPoints({ cx: e.cx ?? 0, cy: e.cy ?? 0, radius: e.radius ?? 0, startAngle: e.startAngle ?? 0, endAngle: e.endAngle ?? 0 }, samplesPerArc)], closed: false };
  if (e.type === "LWPOLYLINE" || e.type === "POLYLINE") {
    const vs = e.vertices;
    if (!vs || vs.length < 2) return { pts: [], closed: !!e.closed };
        const rings: [number, number][] = [];
    for (let i = 0; i < vs.length - 1; i++) {
      const p1 = vs[i], p2 = vs[i + 1];
      if (!p1 || !p2) continue;
      const b = typeof p1.bulge === "number" ? p1.bulge : 0;
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (Math.abs(b) < 1e-8 || d < 1e-9) rings.push([p1.x, p1.y], [p2.x, p2.y]);
      else {
        const arc = bulgeToArcExact(p1.x, p1.y, p2.x, p2.y, b);
        if (arc) for (const p of arcToPoints(arc, samplesPerArc)) rings.push(p);
        else rings.push([p1.x, p1.y], [p2.x, p2.y]);
      }
    }
    if (e.closed && vs.length > 0) {
      const last = vs[vs.length - 1], first = vs[0];
      if (last && first) rings.push([last.x, last.y], [first.x, first.y]);
    }
    return { pts: [rings], closed: !!e.closed };
  }
  return { pts: [], closed: false };
}

function unionBounds(lists: (DxfEntity[] | null | undefined)[]): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;
  const expand = (x: number, y: number) => { found = true; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; };
  for (const list of lists) if (list) for (const e of list) for (const p of sampleEntity(e).pts) for (const [x, y] of p) expand(x, y);
  if (!found) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export interface CutSimulatorProps {
  before: DxfEntity[] | null | undefined;
  after: DxfEntity[];
  lang?: Lang;
}

interface Seg { x1: number; y1: number; x2: number; y2: number; len: number; }

export function CutSimulator({ before, after, lang = "ar" }: CutSimulatorProps) {
  const beforeRef = useRef<HTMLCanvasElement | null>(null);
  const afterRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);

  const labels = lang === "ar"
    ? { before: "قبل الإصلاح (تمثيل ثابت)", after: "بعد الإصلاح — محاكاة مسار القطع", play: "تشغيل", pause: "إيقاف", reset: "إعادة تشغيل", none: "لا توجد كيانات للعرض" }
    : { before: "Before repair (static silhouette)", after: "After repair — cutting simulation", play: "Play", pause: "Pause", reset: "Reset", none: "No entities to display" };

  const all = unionBounds([before, after]);
  if (!all) return <div className="text-center py-8 text-muted-foreground font-mono text-xs">{labels.none}</div>;

  const pad = Math.max(all.w, all.h) * 0.05;
  const minX = all.minX - pad, minY = all.minY - pad, maxX = all.maxX + pad, maxY = all.maxY + pad;
  const w = maxX - minX, h = maxY - minY;
  const CW = 560, CH = Math.min(420, Math.max(240, (h / w) * CW));
  const sx = (x: number) => (x - minX) * Math.min(CW / w, CH / h);
  const sy = (y: number) => CH - (y - minY) * Math.min(CW / w, CH / h);
  const toScreen = (ring: [number, number][]): [number, number][] => ring.map(([x, y]) => [sx(x), sy(y)] as [number, number]);

    const orderedAfter = sortInsideFirst([...after]);
  const afterSegs: Seg[] = [];
  for (const e of orderedAfter) {
    for (const ring of sampleEntity(e).pts) {
      for (let i = 1; i < ring.length; i++) {
        const x1 = ring[i - 1][0], y1 = ring[i - 1][1], x2 = ring[i][0], y2 = ring[i][1];
        const len = Math.hypot(x2 - x1, y2 - y1);
        if (len < 1e-9) continue;
        afterSegs.push({ x1, y1, x2, y2, len });
      }
    }
  }
  const afterTotal = afterSegs.reduce((s, g) => s + g.len, 0);

  const drawPolyline = (ctx: CanvasRenderingContext2D, pts: [number, number][], stroke: string, width = 1) => {
    if (pts.length < 2) return;
    ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); const [fx, fy] = pts[0]; ctx.moveTo(fx, fy);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };

  const drawBefore = () => {
    const ctx = beforeRef.current?.getContext("2d"); if (!ctx || !before) { if (ctx) { ctx.clearRect(0, 0, CW, CH); ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, CW, CH); } return; }
    ctx.clearRect(0, 0, CW, CH); ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, CW, CH);
    for (const e of before) for (const p of sampleEntity(e).pts) drawPolyline(ctx, toScreen(p), "#64748b", 1);
  };

  const drawAfter = (progress: number) => {
    const ctx = afterRef.current?.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, CW, CH); ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, CW, CH);
    for (const e of after) for (const p of sampleEntity(e).pts) drawPolyline(ctx, toScreen(p), "#334155", 1);
    const target = afterTotal * progress;
    let acc = 0; let lastX = afterSegs[0]?.x1 ?? 0, lastY = afterSegs[0]?.y1 ?? 0;
    for (const s of afterSegs) {
      if (acc + s.len >= target) {
        const frac = (target - acc) / Math.max(s.len, 1e-12);
        const x2 = s.x1 + (s.x2 - s.x1) * frac, y2 = s.y1 + (s.y2 - s.y1) * frac;
        drawPolyline(ctx, toScreen([[s.x1, s.y1], [x2, y2]]), "#22d3ee", 2);
        lastX = x2; lastY = y2; break;
      }
      drawPolyline(ctx, toScreen([[s.x1, s.y1], [s.x2, s.y2]]), "#22d3ee", 2);
      acc += s.len; lastX = s.x2; lastY = s.y2;
    }
    ctx.fillStyle = "#fbbf24"; ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx(lastX), sy(lastY), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  };

  useEffect(() => { drawBefore(); drawAfter(0); progressRef.current = 0; }, [before, after]);
  const stop = () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); playingRef.current = false; };
  const start = () => { if (playingRef.current) return; playingRef.current = true; loop(); };
  const reset = () => { stop(); progressRef.current = 0; drawAfter(0); };
  const loop = () => {
    if (!playingRef.current) return;
    const inc = afterTotal > 0 ? (afterTotal / 10000) * 16 * speedRef.current : 0;
    progressRef.current = Math.min(1, (progressRef.current ?? 0) + inc);
    drawAfter(progressRef.current);
    if (progressRef.current < 1 && playingRef.current) rafRef.current = requestAnimationFrame(loop);
    else playingRef.current = false;
  };
  void beforeRef; void afterRef;

    if (!before && after.length === 0) return null;

  return (
    <div className="grid md:grid-cols-2 gap-4 w-full" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div>
        <h4 className="font-mono text-xs text-muted-foreground mb-1">{labels.before}</h4>
        <canvas ref={beforeRef} width={CW} height={CH} className="w-full rounded-lg border bg-slate-950" />
      </div>
      <div className="flex flex-col gap-2">
        <h4 className="font-mono text-xs text-muted-foreground">{labels.after}</h4>
        <canvas ref={afterRef} width={CW} height={CH} className="w-full rounded-lg border bg-slate-950" />
        <div className="flex items-center gap-2 flex-wrap text-xs" dir="ltr">
          <button onClick={playingRef.current ? reset : start} className="px-3 py-1 rounded bg-accent text-accent-foreground hover:opacity-90">
            {playingRef.current ? labels.pause : labels.play}
          </button>
          <button onClick={reset} className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700">{labels.reset}</button>
          <select value={speedRef.current} onChange={(e) => { speedRef.current = +e.target.value; }} className="px-1 rounded bg-slate-800">
            <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={5}>5×</option>
          </select>
          <span className="text-muted-foreground">{(progressRef.current * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

export default CutSimulator;

