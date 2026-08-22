/**
 * ============================================================
 *  Magic CAD Cloud — Deterministic DXF Cleanup Engine
 *  OVERKILL-style geometry cleanup. No AI, no randomness.
 *  All decisions are pure geometry tests.
 * ============================================================
 */
import type { DxfEntity, DxfVertex } from "./dxf";

export interface CleanupOptions {
  /** Geometric tolerance in drawing units (conservative by default). */
  tolerance: number;
  /** Angular tolerance in radians used for collinearity tests. */
  angleTolerance: number;
  /** Max endpoint gap that is considered "safely closable". */
  gapTolerance: number;
  removeZeroLength: boolean;
  dedupeVertices: boolean;
  mergeCollinearOverlaps: boolean;
  dedupeCurves: boolean;
  /** Never merge/remove geometry across different layers. */
  respectLayers: boolean;
}

export const DEFAULT_CLEANUP_OPTIONS: CleanupOptions = {
  tolerance: 0.001,
  angleTolerance: 0.0017, // ~0.1 degree
  gapTolerance: 0.05,
  removeZeroLength: true,
  dedupeVertices: true,
  mergeCollinearOverlaps: true,
  dedupeCurves: true,
  respectLayers: true,
};

/* ------------------------------------------------------------------ */
/* Phase 6A (Bug 2): scale-aware tiny-geometry tolerance               */
/* ------------------------------------------------------------------ */
/**
 * Bounding-box diagonal of all measurable geometry (the drawing "scale").
 * Returns null when no measurable geometry exists — in that case callers
 * must PRESERVE geometry rather than delete it (uncertain scale = preserve).
 */
export function computeDrawingScale(entities: DxfEntity[]): number | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let any = false;
  const acc = (x?: number, y?: number) => {
    if (typeof x !== "number" || typeof y !== "number" || !isFinite(x) || !isFinite(y)) return;
    any = true;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const e of entities) {
    if (e.type === "VERTEX" || e.type === "SEQEND") continue; // bookkeeping, not geometry
    acc(e.x1, e.y1);
    acc(e.x2, e.y2);
    if (e.type === "CIRCLE" || e.type === "ARC") {
      const r = Math.abs(e.radius ?? 0);
      acc((e.cx ?? 0) - r, (e.cy ?? 0) - r);
      acc((e.cx ?? 0) + r, (e.cy ?? 0) + r);
      continue;
    }
    acc(e.cx, e.cy);
    for (const v of e.vertices ?? []) acc(v.x, v.y);
  }
  if (!any) return null;
  return Math.hypot(maxX - minX, maxY - minY);
}

/**
 * Effective tiny-geometry removal threshold, SCALE-AWARE (Phase 6A Bug 2).
 *
 * Formula:
 *   diagonal = bounding-box diagonal of the drawing's geometry
 *   tinyTol  = clamp(diagonal * 1e-4, 1e-6, 0.01)
 *
 * Rationale:
 *  - An entity shorter than 0.01% of the drawing diagonal is invisible at
 *    drawing scale → genuine micro-junk → removable.
 *  - Small-scale drawings (e.g. a map whose whole bbox is ~0.5 units) get a
 *    proportionally small threshold, so legitimate coastline-like segments
 *    are NEVER deleted merely because their absolute length is < 0.01.
 *  - Normal/large-scale drawings clamp at the historical absolute 0.01,
 *    preserving existing behavior.
 *  - If scale cannot be determined (no measurable geometry), returns 0 →
 *    only exactly-zero-length entities qualify (§9: uncertain = preserve).
 */
export function effectiveTinyTolerance(entities: DxfEntity[]): number {
  const diag = computeDrawingScale(entities);
  if (diag === null || !isFinite(diag) || diag <= 0) return 0;
  return Math.min(Math.max(diag * 1e-4, 1e-6), 0.01);
}

export interface OpenPathInfo {
  entityIndex: number;
  entityType: string;
  layer: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  /** Distance to the nearest foreign endpoint (Infinity when isolated). */
  gap: number;
  closable: boolean;
}

export interface GeometryCounts {
  totalEntities: number;
  lines: number;
  lwpolylines: number;
  polylines: number;
  arcs: number;
  circles: number;
  splines: number;
  others: number;
  vertices: number;
  zeroLength: number;
  duplicateCandidates: number;
  overlapCandidates: number;
  duplicateVertices: number;
  openPaths: number;
}

export interface CleanupReport {
  before: GeometryCounts;
  after: GeometryCounts;
  duplicateEntitiesRemoved: number;
  reversedDuplicatesRemoved: number;
  zeroLengthRemoved: number;
  duplicateVerticesRemoved: number;
  containedSegmentsRemoved: number;
  overlappingSegmentsMerged: number;
  duplicateCurvesRemoved: number;
  duplicatePolylinesRemoved: number;
  openPaths: OpenPathInfo[];
  totalChanges: number;
  toleranceUsed: number;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const d2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.sqrt(d2(ax, ay, bx, by));

function lineLength(e: DxfEntity): number {
  return dist(e.x1 ?? 0, e.y1 ?? 0, e.x2 ?? 0, e.y2 ?? 0);
}

function polyLength(e: DxfEntity): number {
  const v = e.vertices ?? [];
  let t = 0;
  for (let i = 1; i < v.length; i++) t += dist(v[i - 1].x, v[i - 1].y, v[i].x, v[i].y);
  if (e.closed && v.length > 2) t += dist(v[v.length - 1].x, v[v.length - 1].y, v[0].x, v[0].y);
  return t;
}

function cellKey(x: number, y: number, cell: number): string {
  return `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
}

/** Spatial hash over points → list of payload indices. */
class PointHash {
  private map = new Map<string, number[]>();
  constructor(private cell: number) {}
  add(x: number, y: number, idx: number) {
    const k = cellKey(x, y, this.cell);
    const bucket = this.map.get(k);
    if (bucket) bucket.push(idx);
    else this.map.set(k, [idx]);
  }
  /** All payloads in the 3x3 neighbourhood of (x, y). */
  near(x: number, y: number): number[] {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    const out: number[] = [];
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const b = this.map.get(`${cx + i}:${cy + j}`);
        if (b) out.push(...b);
      }
    }
    return out;
  }
}

/* ------------------------------------------------------------------ */
/* analysis (before / after counts)                                    */
/* ------------------------------------------------------------------ */

export function analyzeGeometry(
  entities: DxfEntity[],
  opts: CleanupOptions = DEFAULT_CLEANUP_OPTIONS,
): GeometryCounts {
  const tol = opts.tolerance;
  let zeroLength = 0;
  let vertices = 0;
  let duplicateVertices = 0;

  for (const e of entities) {
    if (e.type === "LINE" && lineLength(e) <= tol) zeroLength++;
    if (e.vertices) {
      vertices += e.vertices.length;
      for (let i = 1; i < e.vertices.length; i++) {
        if (dist(e.vertices[i - 1].x, e.vertices[i - 1].y, e.vertices[i].x, e.vertices[i].y) <= tol) {
          duplicateVertices++;
        }
      }
      if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices.length < 2) zeroLength++;
    }
  }

  const { duplicates, overlaps } = countLineCandidates(entities, opts);
  const openPaths = detectOpenPaths(entities, opts).length;

  return {
    totalEntities: entities.length,
    lines: entities.filter(e => e.type === "LINE").length,
    lwpolylines: entities.filter(e => e.type === "LWPOLYLINE").length,
    polylines: entities.filter(e => e.type === "POLYLINE").length,
    arcs: entities.filter(e => e.type === "ARC").length,
    circles: entities.filter(e => e.type === "CIRCLE").length,
    splines: entities.filter(e => e.type === "SPLINE").length,
    others: entities.filter(
      e => !["LINE", "LWPOLYLINE", "POLYLINE", "ARC", "CIRCLE", "SPLINE"].includes(e.type),
    ).length,
    vertices,
    zeroLength,
    duplicateCandidates: duplicates,
    overlapCandidates: overlaps,
    duplicateVertices,
    openPaths,
  };
}

/** Count (do not modify) duplicate + overlapping line candidates. */
export function countLineCandidates(
  entities: DxfEntity[],
  opts: CleanupOptions = DEFAULT_CLEANUP_OPTIONS,
): { duplicates: number; overlaps: number } {
  const tol = opts.tolerance;
  const lines = entities
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.type === "LINE" && lineLength(e) > tol);

  const cell = Math.max(tol * 10, 1e-6);
  const hash = new PointHash(cell);
  lines.forEach(({ e }, k) => {
    hash.add(e.x1 ?? 0, e.y1 ?? 0, k);
    hash.add(e.x2 ?? 0, e.y2 ?? 0, k);
  });

  let duplicates = 0;
  const consumed = new Set<number>();
  for (let k = 0; k < lines.length; k++) {
    if (consumed.has(k)) continue;
    const a = lines[k].e;
    const cands = new Set([
      ...hash.near(a.x1 ?? 0, a.y1 ?? 0),
      ...hash.near(a.x2 ?? 0, a.y2 ?? 0),
    ]);
    for (const m of cands) {
      if (m <= k || consumed.has(m)) continue;
      if (sameLine(a, lines[m].e, opts)) {
        duplicates++;
        consumed.add(m);
      }
    }
  }

  // overlap candidates: collinear pairs sharing coverage
  let overlaps = 0;
  const groups = groupCollinear(lines.map(l => l.e), opts);
  for (const group of groups) {
    if (group.length < 2) continue;
    const intervals = projectGroup(group, opts);
    intervals.sort((p, q) => p.start - q.start);
    for (let i = 1; i < intervals.length; i++) {
      if (intervals[i].start < intervals[i - 1].end - tol) overlaps++;
    }
  }

  return { duplicates, overlaps };
}

/** true when two LINE entities are the same segment (either direction). */
export function sameLine(a: DxfEntity, b: DxfEntity, opts: CleanupOptions = DEFAULT_CLEANUP_OPTIONS): boolean {
  if (opts.respectLayers && a.layer !== b.layer) return false;
  const tol = opts.tolerance;
  const t2 = tol * tol;
  const forward =
    d2(a.x1 ?? 0, a.y1 ?? 0, b.x1 ?? 0, b.y1 ?? 0) <= t2 && d2(a.x2 ?? 0, a.y2 ?? 0, b.x2 ?? 0, b.y2 ?? 0) <= t2;
  const reverse =
    d2(a.x1 ?? 0, a.y1 ?? 0, b.x2 ?? 0, b.y2 ?? 0) <= t2 && d2(a.x2 ?? 0, a.y2 ?? 0, b.x1 ?? 0, b.y1 ?? 0) <= t2;
  return forward || reverse;
}

function isReversed(a: DxfEntity, b: DxfEntity, tol: number): boolean {
  const t2 = tol * tol;
  const forward =
    d2(a.x1 ?? 0, a.y1 ?? 0, b.x1 ?? 0, b.y1 ?? 0) <= t2 && d2(a.x2 ?? 0, a.y2 ?? 0, b.x2 ?? 0, b.y2 ?? 0) <= t2;
  return !forward;
}

/* ------------------------------------------------------------------ */
/* collinear grouping / interval projection                            */
/* ------------------------------------------------------------------ */

interface Interval {
  start: number;
  end: number;
  entity: DxfEntity;
}

function normalizedDir(e: DxfEntity): { dx: number; dy: number; len: number } {
  let dx = (e.x2 ?? 0) - (e.x1 ?? 0);
  let dy = (e.y2 ?? 0) - (e.y1 ?? 0);
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  // canonical orientation: angle in [0, PI)
  if (dy < 0 || (Math.abs(dy) < 1e-12 && dx < 0)) {
    dx = -dx;
    dy = -dy;
  }
  return { dx, dy, len };
}

/** Bucket lines that lie on the same infinite line (same layer). */
function groupCollinear(lines: DxfEntity[], opts: CleanupOptions): DxfEntity[][] {
  const tol = opts.tolerance;
  const angStep = Math.max(opts.angleTolerance, 1e-6);
  const offStep = Math.max(tol * 5, 1e-6);
  const buckets = new Map<string, DxfEntity[]>();

  for (const e of lines) {
    const { dx, dy } = normalizedDir(e);
    const angle = Math.atan2(dy, dx); // [0, PI)
    // perpendicular signed offset of the infinite line from origin
    const off = dx * (e.y1 ?? 0) - dy * (e.x1 ?? 0);
    const key = `${opts.respectLayers ? e.layer : ""}|${Math.round(angle / angStep)}|${Math.round(off / offStep)}`;
    const b = buckets.get(key);
    if (b) b.push(e);
    else buckets.set(key, [e]);
  }
  return [...buckets.values()];
}

function projectGroup(group: DxfEntity[], _opts: CleanupOptions): Interval[] {
  const ref = group[0];
  const { dx, dy } = normalizedDir(ref);
  const ox = ref.x1 ?? 0;
  const oy = ref.y1 ?? 0;
  return group.map(e => {
    const t1 = ((e.x1 ?? 0) - ox) * dx + ((e.y1 ?? 0) - oy) * dy;
    const t2 = ((e.x2 ?? 0) - ox) * dx + ((e.y2 ?? 0) - oy) * dy;
    return { start: Math.min(t1, t2), end: Math.max(t1, t2), entity: e };
  });
}

/* ------------------------------------------------------------------ */
/* open path detection                                                 */
/* ------------------------------------------------------------------ */

export function detectOpenPaths(
  entities: DxfEntity[],
  opts: CleanupOptions = DEFAULT_CLEANUP_OPTIONS,
): OpenPathInfo[] {
  const tol = opts.tolerance;
  const cell = Math.max(opts.gapTolerance * 4, tol * 10, 1e-6);
  type EP = { x: number; y: number; idx: number };
  const eps: EP[] = [];

  entities.forEach((e, idx) => {
    if (e.type === "LINE" && lineLength(e) > tol) {
      eps.push({ x: e.x1 ?? 0, y: e.y1 ?? 0, idx });
      eps.push({ x: e.x2 ?? 0, y: e.y2 ?? 0, idx });
    } else if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices && e.vertices.length > 1 && !e.closed) {
      const v = e.vertices;
      eps.push({ x: v[0].x, y: v[0].y, idx });
      eps.push({ x: v[v.length - 1].x, y: v[v.length - 1].y, idx });
    } else if (e.type === "ARC" && (e.radius ?? 0) > tol) {
      const r = e.radius ?? 0;
      const a1 = ((e.startAngle ?? 0) * Math.PI) / 180;
      const a2 = ((e.endAngle ?? 0) * Math.PI) / 180;
      eps.push({ x: (e.cx ?? 0) + r * Math.cos(a1), y: (e.cy ?? 0) + r * Math.sin(a1), idx });
      eps.push({ x: (e.cx ?? 0) + r * Math.cos(a2), y: (e.cy ?? 0) + r * Math.sin(a2), idx });
    }
  });

  const hash = new PointHash(cell);
  eps.forEach((p, i) => hash.add(p.x, p.y, i));

  const open: OpenPathInfo[] = [];
  const reported = new Set<number>();

  for (let i = 0; i < eps.length; i++) {
    const p = eps[i];
    let best = Infinity;
    for (const j of hash.near(p.x, p.y)) {
      if (j === i) continue;
      if (eps[j].idx === p.idx) continue; // its own other endpoint
      const dd = dist(p.x, p.y, eps[j].x, eps[j].y);
      if (dd < best) best = dd;
    }
    if (best <= tol) continue; // connected
    const key = i;
    if (reported.has(key)) continue;
    reported.add(key);
    const e = entities[p.idx];
    open.push({
      entityIndex: p.idx,
      entityType: e.type,
      layer: e.layer,
      start: { x: p.x, y: p.y },
      end: otherEndpoint(e, p.x, p.y),
      gap: best,
      closable: best <= opts.gapTolerance && best > tol,
    });
  }
  return open;
}

function otherEndpoint(e: DxfEntity, x: number, y: number): { x: number; y: number } {
  if (e.type === "LINE") {
    const a = { x: e.x1 ?? 0, y: e.y1 ?? 0 };
    const b = { x: e.x2 ?? 0, y: e.y2 ?? 0 };
    return d2(a.x, a.y, x, y) < d2(b.x, b.y, x, y) ? b : a;
  }
  if (e.vertices && e.vertices.length > 1) {
    const a = e.vertices[0];
    const b = e.vertices[e.vertices.length - 1];
    return d2(a.x, a.y, x, y) < d2(b.x, b.y, x, y) ? { x: b.x, y: b.y } : { x: a.x, y: a.y };
  }
  return { x, y };
}

/**
 * Close only unambiguous small gaps (endpoint pairs within gapTolerance).
 * Large or ambiguous gaps are left untouched and only reported.
 */
export function closeSafeGaps(
  entities: DxfEntity[],
  opts: CleanupOptions = DEFAULT_CLEANUP_OPTIONS,
): { entities: DxfEntity[]; closed: number; skipped: number } {
  const tol = opts.tolerance;
  const gap = opts.gapTolerance;
  type EP = { x: number; y: number; idx: number; isStart: boolean };
  const eps: EP[] = [];
  entities.forEach((e, idx) => {
    if (e.type === "LINE" && lineLength(e) > tol) {
      eps.push({ x: e.x1 ?? 0, y: e.y1 ?? 0, idx, isStart: true });
      eps.push({ x: e.x2 ?? 0, y: e.y2 ?? 0, idx, isStart: false });
    } else if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices && e.vertices.length > 1 && !e.closed) {
      const v = e.vertices;
      eps.push({ x: v[0].x, y: v[0].y, idx, isStart: true });
      eps.push({ x: v[v.length - 1].x, y: v[v.length - 1].y, idx, isStart: false });
    }
  });

  const hash = new PointHash(Math.max(gap * 4, 1e-6));
  eps.forEach((p, i) => hash.add(p.x, p.y, i));

  const moves = new Map<string, { x: number; y: number }>();
  const used = new Set<number>();
  let closed = 0;
  let skipped = 0;

  for (let i = 0; i < eps.length; i++) {
    if (used.has(i)) continue;
    const p = eps[i];
    const candidates = hash
      .near(p.x, p.y)
      .filter(j => j !== i && !used.has(j) && eps[j].idx !== p.idx)
      .map(j => ({ j, dd: dist(p.x, p.y, eps[j].x, eps[j].y) }))
      .filter(c => c.dd > tol && c.dd <= gap)
      .sort((a, b) => a.dd - b.dd);

    if (candidates.length === 0) continue;
    // ambiguous: more than one equally plausible partner → report, do not touch
    if (candidates.length > 1 && Math.abs(candidates[0].dd - candidates[1].dd) <= tol) {
      skipped++;
      continue;
    }
    const q = eps[candidates[0].j];
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    moves.set(`${p.idx}:${p.isStart}`, mid);
    moves.set(`${q.idx}:${q.isStart}`, mid);
    used.add(i);
    used.add(candidates[0].j);
    closed++;
  }

  if (closed === 0) return { entities, closed: 0, skipped };

  const out = entities.map((e, idx) => {
    const s = moves.get(`${idx}:true`);
    const en = moves.get(`${idx}:false`);
    if (!s && !en) return e;
    if (e.type === "LINE") {
      return { ...e, x1: s?.x ?? e.x1, y1: s?.y ?? e.y1, x2: en?.x ?? e.x2, y2: en?.y ?? e.y2 };
    }
    if (e.vertices && e.vertices.length > 1) {
      const v = [...e.vertices];
      if (s) v[0] = { ...v[0], x: s.x, y: s.y };
      if (en) v[v.length - 1] = { ...v[v.length - 1], x: en.x, y: en.y };
      return { ...e, vertices: v };
    }
    return e;
  });

  return { entities: out, closed, skipped };
}

/* ------------------------------------------------------------------ */
/* the cleanup engine                                                  */
/* ------------------------------------------------------------------ */

export function cleanupEntities(
  input: DxfEntity[],
  options: Partial<CleanupOptions> = {},
): { entities: DxfEntity[]; report: CleanupReport } {
  const opts: CleanupOptions = { ...DEFAULT_CLEANUP_OPTIONS, ...options };
  const tol = opts.tolerance;
  // Phase 6A (Bug 2): zero/tiny-length removal is SCALE-AWARE. The fixed
  // absolute tolerance previously deleted legitimate small geometry in
  // small-scale drawings (e.g. 04-us-states.dxf). Duplicate-matching and
  // vertex-dedup tolerances below are intentionally UNCHANGED.
  const tinyTol = effectiveTinyTolerance(input);
  const before = analyzeGeometry(input, opts);

  let zeroLengthRemoved = 0;
  let duplicateVerticesRemoved = 0;
  let duplicateEntitiesRemoved = 0;
  let reversedDuplicatesRemoved = 0;
  let containedSegmentsRemoved = 0;
  let overlappingSegmentsMerged = 0;
  let duplicateCurvesRemoved = 0;
  let duplicatePolylinesRemoved = 0;

  /* --- stage 1: zero-length + duplicate vertices ------------------ */
  let stage: DxfEntity[] = [];
  for (const e of input) {
    if (opts.removeZeroLength && e.type === "LINE" && lineLength(e) <= Math.max(tinyTol, 1e-12)) {
      zeroLengthRemoved++;
      continue;
    }
    if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices) {
      let verts = e.vertices;
      if (opts.dedupeVertices && verts.length > 1) {
        const kept: DxfVertex[] = [verts[0]];
        for (let i = 1; i < verts.length; i++) {
          const prev = kept[kept.length - 1];
          if (dist(prev.x, prev.y, verts[i].x, verts[i].y) <= tol) {
            // keep any non-zero bulge information from the dropped vertex
            const bulge = verts[i].bulge ?? 0;
            if (bulge !== 0 && !(prev.bulge ?? 0)) kept[kept.length - 1] = { ...prev, bulge };
            duplicateVerticesRemoved++;
            continue;
          }
          kept.push(verts[i]);
        }
        // closed polyline whose last vertex duplicates the first
        if (e.closed && kept.length > 2) {
          const first = kept[0];
          const last = kept[kept.length - 1];
          if (dist(first.x, first.y, last.x, last.y) <= tol && !(last.bulge ?? 0)) {
            kept.pop();
            duplicateVerticesRemoved++;
          }
        }
        verts = kept;
      }
      // SAFETY (§7): a legacy POLYLINE with an empty vertex list is an
      // uncertain representation — preserve it rather than deleting it as
      // zero-length. Only positively-known degenerate geometry is removable.
      if (e.type === "POLYLINE" && verts.length === 0) {
        stage.push(e);
        continue;
      }
      if (opts.removeZeroLength && (verts.length < 2 || polyLength({ ...e, vertices: verts }) <= Math.max(tinyTol, 1e-12))) {
        zeroLengthRemoved++;
        continue;
      }
      stage.push(verts === e.vertices ? e : { ...e, vertices: verts, vertexCount: verts.length });
      continue;
    }
    if (opts.removeZeroLength && (e.type === "CIRCLE" || e.type === "ARC") && (e.radius ?? 0) <= tinyTol) {
      zeroLengthRemoved++;
      continue;
    }
    stage.push(e);
  }

  /* --- stage 2: exact + reversed duplicate LINEs ------------------- */
  const lineIdx: number[] = [];
  stage.forEach((e, i) => {
    if (e.type === "LINE") lineIdx.push(i);
  });
  const cell = Math.max(tol * 10, 1e-6);
  const hash = new PointHash(cell);
  lineIdx.forEach((i, k) => {
    hash.add(stage[i].x1 ?? 0, stage[i].y1 ?? 0, k);
    hash.add(stage[i].x2 ?? 0, stage[i].y2 ?? 0, k);
  });
  const dropped = new Set<number>();
  for (let k = 0; k < lineIdx.length; k++) {
    const ai = lineIdx[k];
    if (dropped.has(ai)) continue;
    const a = stage[ai];
    const cands = new Set([
      ...hash.near(a.x1 ?? 0, a.y1 ?? 0),
      ...hash.near(a.x2 ?? 0, a.y2 ?? 0),
    ]);
    for (const m of cands) {
      if (m <= k) continue;
      const bi = lineIdx[m];
      if (dropped.has(bi)) continue;
      const b = stage[bi];
      if (!sameLine(a, b, opts)) continue;
      dropped.add(bi);
      duplicateEntitiesRemoved++;
      if (isReversed(a, b, tol)) reversedDuplicatesRemoved++;
    }
  }

  /* --- stage 3: duplicate polylines (same vertex chain) ----------- */
  const polyKeys = new Map<string, number>();
  stage.forEach((e, i) => {
    if (dropped.has(i)) return;
    if ((e.type !== "LWPOLYLINE" && e.type !== "POLYLINE") || !e.vertices || e.vertices.length < 2) return;
    const q = (n: number) => Math.round(n / Math.max(tol, 1e-9));
    const fwd = e.vertices.map(v => `${q(v.x)},${q(v.y)}`);
    const rev = [...fwd].reverse();
    const layerKey = opts.respectLayers ? e.layer : "";
    const keyF = `${layerKey}|${e.closed ? "C" : "O"}|${fwd.join(";")}`;
    const keyR = `${layerKey}|${e.closed ? "C" : "O"}|${rev.join(";")}`;
    if (polyKeys.has(keyF) || polyKeys.has(keyR)) {
      dropped.add(i);
      duplicatePolylinesRemoved++;
      return;
    }
    polyKeys.set(keyF, i);
  });

  /* --- stage 4: duplicate circles / arcs --------------------------- */
  if (opts.dedupeCurves) {
    const curveKeys = new Set<string>();
    stage.forEach((e, i) => {
      if (dropped.has(i)) return;
      if (e.type !== "CIRCLE" && e.type !== "ARC") return;
      const q = (n: number) => Math.round(n / Math.max(tol, 1e-9));
      const angs =
        e.type === "ARC"
          ? `${Math.round((e.startAngle ?? 0) / Math.max(opts.angleTolerance * 57.2958, 1e-6))}:${Math.round(
              (e.endAngle ?? 0) / Math.max(opts.angleTolerance * 57.2958, 1e-6),
            )}`
          : "";
      const key = `${e.type}|${opts.respectLayers ? e.layer : ""}|${q(e.cx ?? 0)},${q(e.cy ?? 0)},${q(e.radius ?? 0)}|${angs}`;
      if (curveKeys.has(key)) {
        dropped.add(i);
        duplicateCurvesRemoved++;
        return;
      }
      curveKeys.add(key);
    });
  }

  stage = stage.filter((_, i) => !dropped.has(i));

  /* --- stage 5: collinear overlap / containment -------------------- */
  if (opts.mergeCollinearOverlaps) {
    const survivors: DxfEntity[] = [];
    const linePositions: number[] = [];
    const lines: DxfEntity[] = [];
    stage.forEach((e, i) => {
      if (e.type === "LINE") {
        linePositions.push(i);
        lines.push(e);
      }
    });

    const replacement = new Map<DxfEntity, DxfEntity | null>();
    const groups = groupCollinear(lines, opts);
    for (const group of groups) {
      if (group.length < 2) continue;
      const intervals = projectGroup(group, opts);
      intervals.sort((a, b) => a.start - b.start || a.end - b.end);
      let cluster: Interval[] = [intervals[0]];
      const flush = () => {
        if (cluster.length === 1) return;
        const start = Math.min(...cluster.map(c => c.start));
        const end = Math.max(...cluster.map(c => c.end));
        // classify: containment vs partial overlap
        for (let i = 1; i < cluster.length; i++) {
          const prev = cluster[i - 1];
          const cur = cluster[i];
          if (cur.end <= prev.end + tol || cur.start <= prev.start + tol) containedSegmentsRemoved++;
          else overlappingSegmentsMerged++;
        }
        const keep = cluster[0].entity;
        const { dx, dy } = normalizedDir(keep);
        const ref = group[0];
        const ox = ref.x1 ?? 0;
        const oy = ref.y1 ?? 0;
        const refDir = normalizedDir(ref);
        const merged: DxfEntity = {
          ...keep,
          x1: ox + refDir.dx * start,
          y1: oy + refDir.dy * start,
          x2: ox + refDir.dx * end,
          y2: oy + refDir.dy * end,
        };
        void dx;
        void dy;
        replacement.set(keep, merged);
        for (let i = 1; i < cluster.length; i++) replacement.set(cluster[i].entity, null);
      };
      for (let i = 1; i < intervals.length; i++) {
        const cur = intervals[i];
        const clusterEnd = Math.max(...cluster.map(c => c.end));
        // merge only on real overlap (not mere touching)
        if (cur.start < clusterEnd - tol) {
          cluster.push(cur);
        } else {
          flush();
          cluster = [cur];
        }
      }
      flush();
    }

    for (const e of stage) {
      if (!replacement.has(e)) {
        survivors.push(e);
        continue;
      }
      const rep = replacement.get(e);
      if (rep) survivors.push(rep);
    }
    stage = survivors;
  }

  const openPaths = detectOpenPaths(stage, opts);
  const after = analyzeGeometry(stage, opts);

  const totalChanges =
    duplicateEntitiesRemoved +
    zeroLengthRemoved +
    duplicateVerticesRemoved +
    containedSegmentsRemoved +
    overlappingSegmentsMerged +
    duplicateCurvesRemoved +
    duplicatePolylinesRemoved;

  return {
    entities: stage,
    report: {
      before,
      after,
      duplicateEntitiesRemoved,
      reversedDuplicatesRemoved,
      zeroLengthRemoved,
      duplicateVerticesRemoved,
      containedSegmentsRemoved,
      overlappingSegmentsMerged,
      duplicateCurvesRemoved,
      duplicatePolylinesRemoved,
      openPaths,
      totalChanges,
      toleranceUsed: tol,
    },
  };
}

/* ------------------------------------------------------------------ */
/* smoothing (real geometry, corner preserving)                        */
/* ------------------------------------------------------------------ */

/**
 * Conservative polyline smoothing: removes noise vertices whose deviation
 * from their neighbours is under `deviation`, while keeping corners whose
 * turn angle exceeds `cornerAngleDeg`. Closed/open state and scale kept.
 */
export function smoothEntities(
  entities: DxfEntity[],
  deviation = 0.02,
  cornerAngleDeg = 25,
): { entities: DxfEntity[]; verticesRemoved: number; polylinesTouched: number } {
  let verticesRemoved = 0;
  let polylinesTouched = 0;
  const cornerCos = Math.cos((cornerAngleDeg * Math.PI) / 180);

  const out = entities.map(e => {
    if ((e.type !== "LWPOLYLINE" && e.type !== "POLYLINE") || !e.vertices || e.vertices.length < 4) return e;
    if (e.vertices.some(v => (v.bulge ?? 0) !== 0)) return e; // never destroy bulge geometry
    const v = e.vertices;
    const kept: DxfVertex[] = [v[0]];
    for (let i = 1; i < v.length - 1; i++) {
      const prev = kept[kept.length - 1];
      const cur = v[i];
      const next = v[i + 1];
      const ax = cur.x - prev.x, ay = cur.y - prev.y;
      const bx = next.x - cur.x, by = next.y - cur.y;
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la === 0 || lb === 0) { verticesRemoved++; continue; }
      const cosT = (ax * bx + ay * by) / (la * lb);
      const isCorner = cosT < cornerCos;
      const dev = Math.abs(ax * by - ay * bx) / Math.max(Math.hypot(next.x - prev.x, next.y - prev.y), 1e-12);
      if (!isCorner && dev <= deviation) {
        verticesRemoved++;
        continue;
      }
      kept.push(cur);
    }
    kept.push(v[v.length - 1]);
    if (kept.length === v.length) return e;
    polylinesTouched++;
    return { ...e, vertices: kept, vertexCount: kept.length, closed: e.closed };
  });

  return { entities: out, verticesRemoved, polylinesTouched };
}
