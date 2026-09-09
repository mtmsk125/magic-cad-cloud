import { useRef, useState, useEffect } from "react";
import type { DxfEntity, DxfBounds, SvgPath } from "@/lib/dxf";
import { buildSvgPaths, getDxfBounds } from "@/lib/dxf";

type Lang = "ar" | "en";

export interface DesignCompareSliderProps {
  before: DxfEntity[] | null | undefined;
  after: DxfEntity[];
  lang?: Lang;
}

export function DesignCompareSlider({ before, after, lang = "ar" }: DesignCompareSliderProps) {
  const [pct, setPct] = useState(50);
  const dragRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pctRef = useRef(50);

  // Union bounds so both overlays align in the same coordinate space.
  const ab = getDxfBounds(after);
  const bb = before ? getDxfBounds(before) : null;
  let u: DxfBounds | null = ab;
  if (bb && u) {
    u = {
      minX: Math.min(u.minX, bb.minX),
      minY: Math.min(u.minY, bb.minY),
      maxX: Math.max(u.maxX, bb.maxX),
      maxY: Math.max(u.maxY, bb.maxY),
      width: 0,
      height: 0,
    };
    u.width = u.maxX - u.minX;
    u.height = u.maxY - u.minY;
  } else if (bb) u = bb;
  if (!u || after.length === 0) return null;

  const vb = `${u.minX} ${u.minY} ${u.width} ${u.height}`;
  const afterPaths: SvgPath[] = buildSvgPaths(after, u);
  const beforePaths: SvgPath[] | null =
    before && before.length ? buildSvgPaths(before, u) : null;

    const move = (clientX: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const nv = Math.max(2, Math.min(98, ((clientX - r.left) / r.width) * 100));
    pctRef.current = nv;
    setPct(nv);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const cx = "clientX" in e ? (e as MouseEvent).clientX : (e as TouchEvent).touches[0].clientX;
      move(cx);
    };
    const onUp = () => { dragRef.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  const paths = (list: SvgPath[], color: string, w = 1.5) =>
    list.map((p) => (
      <path key={p.entityIndex} d={p.d} stroke={color} strokeWidth={w} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    ));

  const labels =
    lang === "ar"
      ? { before: "قبل الإصلاح", after: "بعد الإصلاح", drag: "اسحب للتبديل" }
      : { before: "Before", after: "After", drag: "Drag to compare" };

  return (
    <div className="rounded-2xl border p-4 bg-slate-950/60">
      <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
        <span>🔍</span> {lang === "ar" ? "مقارنة الشكل قبل وبعد الإصلاح" : "Design comparison: before vs after repair"}
      </h3>
      <div
        ref={wrapRef}
        className="relative w-full h-[340px] cursor-col-resize select-none touch-none"
        style={{ maxWidth: 560 }}
        onMouseDown={(e) => { dragRef.current = true; move(e.clientX); }}
        onTouchStart={(e) => { dragRef.current = true; move(e.touches[0].clientX); }}
      >
        {/* BEFORE (gray) — full, always visible */}
        <svg viewBox={vb} className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          {beforePaths ? paths(beforePaths, "#94a3b8") : paths(afterPaths, "#94a3b8")}
        </svg>
        {/* AFTER (green) — clipped to pct% width */}
        <div className="absolute inset-0 w-full h-full overflow-hidden" style={{ width: `${pct}%` }}>
          <svg viewBox={vb} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            {paths(afterPaths, "#22c57e", 2)}
          </svg>
        </div>
        {/* Drag handle */}
        <div
          className="absolute top-0 bottom-0 w-1.5 bg-sky-400/80 hover:bg-sky-300 transition rounded-sm"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-sky-400 border-2 border-white shadow cursor-ew-open"
          style={{ left: `${pct}%` }}
        />
        {/* Legends */}
        <div className="absolute bottom-2 left-2 text-xs text-gray-400">{labels.before}</div>
        <div className="absolute bottom-2 right-2 text-xs text-emerald-400">{labels.after}</div>
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs text-gray-500">{labels.drag}</div>
      </div>
    </div>
  );
}

export default DesignCompareSlider;
