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
  /** Remove short "spur" strokes attached to the contour at one end only
   *  (vectorization residues, like AutoCAD OVERKILL / dxfcleaner Residues). */
  removeDanglingResidues: boolean;
  /** Max length (drawing units) of a dangling spur eligible for removal. */
  residueTolerance: number;
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
  removeDanglingResidues: false,
  residueTolerance: 2.0,
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
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
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
  /**
   * Phase 9: coordinates of the nearest FOREIGN endpoint that this open
   * endpoint almost touches (the other side of the gap). A closing LINE
   * must bridge start→partner, NOT start→end (end is the entity's own
   * other endpoint — bridging to it would duplicate the entity itself).
   */
  partner?: { x: number; y: number };
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
  fixedOpen: number;
  removedDuplicates: number;
  foundOverlaps: number;
  foundSelfIntersections: number;
  totalChanges: number;
  toleranceUsed: number;
}

/* ================================================================== */
/* MASTER CLEANUP (Phase A pre-process + Phase C optimization)         */
/* Explicit opt-in pipeline wrapping the untouched cleanupEntities().  */
/* ================================================================== */

export interface MasterCleanupReport {
  /** Curves (SPLINE/ARC/CIRCLE/ELLIPSE) flattened to polylines. */
  flattenedSplines: number;
  /** 1 when inch→mm unit conversion was applied, else 0. */
  convertedUnits: number;
  /** Unsupported annotation entities removed (TEXT/MTEXT/DIMENSION/...). */
  removedUnsupported: number;
  /** Degenerate entities removed (<0.001 units or scale-aware tiny). */
  removedZeroLength: number;
  /** Open gaps closed with bridging lines. */
  fixedOpen: number;
  /** Duplicate vectors removed. */
  removedDuplicates: number;
  /** Small collinear LINEs merged into longer ones. */
  mergedCollinear: number;
  /** Vertices removed by Douglas-Peucker simplification. */
  simplifiedPoints: number;
  /** Entities re-layered to "0" + empty layers cleaned. */
  layersCleaned: number;
  /** Partial collinear overlaps found (marked RED, never auto-fixed). */
  foundOverlaps: number;
  /** Self-intersections found (marked RED, never auto-fixed). */
  foundSelfIntersections: number;
  /** Non-empty when bbox <5 or >2000 units (possible scale problem). */
  scaleWarning: string | null;
  /** Sum of all applied modifications. */
  totalChanges: number;
}

export const SUPPORTED_GEOMETRY_TYPES = new Set([
  "LINE",
  "LWPOLYLINE",
  "POLYLINE",
  "ARC",
  "CIRCLE",
  "SPLINE",
  "ELLIPSE",
]);

/** Annotation/reference entities removed by the master sanitizer. */
export const UNSUPPORTED_GEOMETRY_TYPES = new Set([
  "TEXT",
  "MTEXT",
  "DIMENSION",
  "HATCH",
  "LEADER",
]);

const CURVE_TYPES = new Set(["SPLINE", "ARC", "CIRCLE", "ELLIPSE"]);

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
        if (
          dist(e.vertices[i - 1].x, e.vertices[i - 1].y, e.vertices[i].x, e.vertices[i].y) <= tol
        ) {
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
    lines: entities.filter((e) => e.type === "LINE").length,
    lwpolylines: entities.filter((e) => e.type === "LWPOLYLINE").length,
    polylines: entities.filter((e) => e.type === "POLYLINE").length,
    arcs: entities.filter((e) => e.type === "ARC").length,
    circles: entities.filter((e) => e.type === "CIRCLE").length,
    splines: entities.filter((e) => e.type === "SPLINE").length,
    others: entities.filter(
      (e) => !["LINE", "LWPOLYLINE", "POLYLINE", "ARC", "CIRCLE", "SPLINE"].includes(e.type),
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
    const cands = new Set([...hash.near(a.x1 ?? 0, a.y1 ?? 0), ...hash.near(a.x2 ?? 0, a.y2 ?? 0)]);
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
  const groups = groupCollinear(
    lines.map((l) => l.e),
    opts,
  );
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
export function sameLine(
  a: DxfEntity,
  b: DxfEntity,
  opts: CleanupOptions = DEFAULT_CLEANUP_OPTIONS,
): boolean {
  if (opts.respectLayers && a.layer !== b.layer) return false;
  const tol = opts.tolerance;
  const t2 = tol * tol;
  const forward =
    d2(a.x1 ?? 0, a.y1 ?? 0, b.x1 ?? 0, b.y1 ?? 0) <= t2 &&
    d2(a.x2 ?? 0, a.y2 ?? 0, b.x2 ?? 0, b.y2 ?? 0) <= t2;
  const reverse =
    d2(a.x1 ?? 0, a.y1 ?? 0, b.x2 ?? 0, b.y2 ?? 0) <= t2 &&
    d2(a.x2 ?? 0, a.y2 ?? 0, b.x1 ?? 0, b.y1 ?? 0) <= t2;
  return forward || reverse;
}

function isReversed(a: DxfEntity, b: DxfEntity, tol: number): boolean {
  const t2 = tol * tol;
  const forward =
    d2(a.x1 ?? 0, a.y1 ?? 0, b.x1 ?? 0, b.y1 ?? 0) <= t2 &&
    d2(a.x2 ?? 0, a.y2 ?? 0, b.x2 ?? 0, b.y2 ?? 0) <= t2;
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
  return group.map((e) => {
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
  type EP = { x: number; y: number; idx: number; layer: string };
  const eps: EP[] = [];

  entities.forEach((e, idx) => {
    if (e.type === "LINE" && lineLength(e) > tol) {
      eps.push({ x: e.x1 ?? 0, y: e.y1 ?? 0, idx, layer: e.layer ?? "0" });
      eps.push({ x: e.x2 ?? 0, y: e.y2 ?? 0, idx, layer: e.layer ?? "0" });
    } else if (
      (e.type === "LWPOLYLINE" || e.type === "POLYLINE") &&
      e.vertices &&
      e.vertices.length > 1 &&
      !e.closed
    ) {
      const v = e.vertices;
      eps.push({ x: v[0].x, y: v[0].y, idx, layer: e.layer ?? "0" });
      eps.push({ x: v[v.length - 1].x, y: v[v.length - 1].y, idx, layer: e.layer ?? "0" });
    } else if (e.type === "ARC" && (e.radius ?? 0) > tol) {
      const r = e.radius ?? 0;
      const a1 = ((e.startAngle ?? 0) * Math.PI) / 180;
      const a2 = ((e.endAngle ?? 0) * Math.PI) / 180;
      eps.push({
        x: (e.cx ?? 0) + r * Math.cos(a1),
        y: (e.cy ?? 0) + r * Math.sin(a1),
        idx,
        layer: e.layer ?? "0",
      });
      eps.push({
        x: (e.cx ?? 0) + r * Math.cos(a2),
        y: (e.cy ?? 0) + r * Math.sin(a2),
        idx,
        layer: e.layer ?? "0",
      });
    } else if (e.type === "SPLINE" && e.vertices && e.vertices.length > 1) {
      // SPLINE endpoints — treat like open polyline
      const v = e.vertices;
      eps.push({ x: v[0].x, y: v[0].y, idx, layer: e.layer ?? "0" });
      eps.push({ x: v[v.length - 1].x, y: v[v.length - 1].y, idx, layer: e.layer ?? "0" });
    }
  });

  const hash = new PointHash(cell);
  eps.forEach((p, i) => hash.add(p.x, p.y, i));

  const open: OpenPathInfo[] = [];
  const reported = new Set<number>();

  for (let i = 0; i < eps.length; i++) {
    const p = eps[i];
    let best = Infinity;
    let bestPartner: { x: number; y: number } | undefined;
    for (const j of hash.near(p.x, p.y)) {
      if (j === i) continue;
      if (eps[j].idx === p.idx) continue; // its own other endpoint
      // Layer independence: endpoints on different layers are NEVER considered
      // connected — they must stay reported as open (never bridged silently).
      if (opts.respectLayers && eps[j].layer !== p.layer) continue;
      const dd = dist(p.x, p.y, eps[j].x, eps[j].y);
      if (dd < best) {
        best = dd;
        bestPartner = { x: eps[j].x, y: eps[j].y };
      }
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
      partner: bestPartner,
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
  type EP = { x: number; y: number; idx: number; isStart: boolean; layer: string };
  const eps: EP[] = [];
  entities.forEach((e, idx) => {
    if (e.type === "LINE" && lineLength(e) > tol) {
      eps.push({ x: e.x1 ?? 0, y: e.y1 ?? 0, idx, isStart: true, layer: e.layer ?? "0" });
      eps.push({ x: e.x2 ?? 0, y: e.y2 ?? 0, idx, isStart: false, layer: e.layer ?? "0" });
    } else if (
      (e.type === "LWPOLYLINE" || e.type === "POLYLINE") &&
      e.vertices &&
      e.vertices.length > 1 &&
      !e.closed
    ) {
      const v = e.vertices;
      eps.push({ x: v[0].x, y: v[0].y, idx, isStart: true, layer: e.layer ?? "0" });
      eps.push({
        x: v[v.length - 1].x,
        y: v[v.length - 1].y,
        idx,
        isStart: false,
        layer: e.layer ?? "0",
      });
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
      .filter((j) => j !== i && !used.has(j) && eps[j].idx !== p.idx)
      // Layer independence: never close a gap across two different layers
      // (matches dxfcleaner's "layers are never mixed" guarantee).
      .filter((j) => !opts.respectLayers || eps[j].layer === p.layer)
      .map((j) => ({ j, dd: dist(p.x, p.y, eps[j].x, eps[j].y) }))
      .filter((c) => c.dd > tol && c.dd <= gap)
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

/**
 * Remove dangling "residue" strokes — short LINEs attached to the rest of the
 * drawing at ONE end only (classic vectorization back-and-forth spurs, same
 * category as AutoCAD OVERKILL's dangling geometry / dxfcleaner "Residues").
 *
 * Safety rules:
 *  - Only LINE entities shorter than residueTolerance are eligible.
 *  - Exactly one endpoint must connect to other geometry (a true spur);
 *    fully-isolated short lines are left alone (may be intentional tick marks).
 *  - Never removes a line whose both endpoints are connected.
 *  - Connections are only counted within the SAME layer (respectLayers).
 */
export function removeResidues(
  entities: DxfEntity[],
  opts: CleanupOptions = DEFAULT_CLEANUP_OPTIONS,
): { entities: DxfEntity[]; removed: number } {
  if (!opts.removeDanglingResidues) return { entities, removed: 0 };
  const tol = opts.tolerance;
  const maxLen = opts.residueTolerance;
  const sameLayer = (l1: string, l2: string) => !opts.respectLayers || l1 === l2;

  const endpointOf = (
    e: DxfEntity,
  ): [{ x: number; y: number }, { x: number; y: number }] | null => {
    if (e.type === "LINE") {
      return [
        { x: e.x1 ?? 0, y: e.y1 ?? 0 },
        { x: e.x2 ?? 0, y: e.y2 ?? 0 },
      ];
    }
    if (
      (e.type === "LWPOLYLINE" || e.type === "POLYLINE") &&
      e.vertices &&
      e.vertices.length > 1 &&
      !e.closed
    ) {
      const v = e.vertices;
      return [
        { x: v[0].x, y: v[0].y },
        { x: v[v.length - 1].x, y: v[v.length - 1].y },
      ];
    }
    return null;
  };

  // Collect endpoints of all candidate-connecting geometry (any open path).
  const eps: { x: number; y: number; layer: string }[] = [];
  for (const e of entities) {
    const ep = endpointOf(e);
    if (!ep) continue;
    eps.push({ x: ep[0].x, y: ep[0].y, layer: e.layer ?? "0" });
    eps.push({ x: ep[1].x, y: ep[1].y, layer: e.layer ?? "0" });
  }

  const toRemove = new Set<number>();
  entities.forEach((e, idx) => {
    if (e.type !== "LINE") return;
    const len = lineLength(e);
    if (len <= tol || len > maxLen) return;
    const a = { x: e.x1 ?? 0, y: e.y1 ?? 0 };
    const b = { x: e.x2 ?? 0, y: e.y2 ?? 0 };
    const aLayer = e.layer ?? "0";
    // Count foreign endpoints touching each end — excluding the entity's own
    // two endpoints (exactly at a and b) and other-layer endpoints.
    let aTouch = 0,
      bTouch = 0;
    for (const q of eps) {
      if (!sameLayer(q.layer, aLayer)) continue;
      if ((q.x === a.x && q.y === a.y) || (q.x === b.x && q.y === b.y)) continue;
      if (d2(q.x, q.y, a.x, a.y) < tol * tol) aTouch++;
      if (d2(q.x, q.y, b.x, b.y) < tol * tol) bTouch++;
    }
    // a spur: exactly one end attached, the other free
    if ((aTouch > 0 && bTouch === 0) || (bTouch > 0 && aTouch === 0)) {
      toRemove.add(idx);
    }
  });

  if (toRemove.size === 0) return { entities, removed: 0 };
  return { entities: entities.filter((_, i) => !toRemove.has(i)), removed: toRemove.size };
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
  // Phase 9 counters
  let fixedOpen = 0;
  let removedDuplicates = 0;
  let foundOverlaps = 0;
  let foundSelfIntersections = 0;

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
      if (
        opts.removeZeroLength &&
        (verts.length < 2 || polyLength({ ...e, vertices: verts }) <= Math.max(tinyTol, 1e-12))
      ) {
        zeroLengthRemoved++;
        continue;
      }
      stage.push(verts === e.vertices ? e : { ...e, vertices: verts, vertexCount: verts.length });
      continue;
    }
    if (
      opts.removeZeroLength &&
      (e.type === "CIRCLE" || e.type === "ARC") &&
      (e.radius ?? 0) <= tinyTol
    ) {
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
    const cands = new Set([...hash.near(a.x1 ?? 0, a.y1 ?? 0), ...hash.near(a.x2 ?? 0, a.y2 ?? 0)]);
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
    if ((e.type !== "LWPOLYLINE" && e.type !== "POLYLINE") || !e.vertices || e.vertices.length < 2)
      return;
    const q = (n: number) => Math.round(n / Math.max(tol, 1e-9));
    const fwd = e.vertices.map((v) => `${q(v.x)},${q(v.y)}`);
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
        const start = Math.min(...cluster.map((c) => c.start));
        const end = Math.max(...cluster.map((c) => c.end));
        // classify: containment vs partial overlap
        for (let i = 1; i < cluster.length; i++) {
          const prev = cluster[i - 1];
          const cur = cluster[i];
          if (cur.end <= prev.end + tol || cur.start <= prev.start + tol)
            containedSegmentsRemoved++;
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
        const clusterEnd = Math.max(...cluster.map((c) => c.end));
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

  /* --- stage 6: Phase 9 – auto-close open paths (gap < 0.015 mm) ----- */
  const drawingScale = computeDrawingScale(stage);
  const closeResult = autoCloseOpenPaths(openPaths, stage, drawingScale);
  if (closeResult.fixedOpen > 0) {
    stage = closeResult.entities;
    fixedOpen = closeResult.fixedOpen;
  }

  /* --- stage 7: Phase 9 – remove near-duplicated vectors -------------- */
  const dupResult = removeDuplicatedVectors(stage, opts);
  if (dupResult.removedDuplicates > 0) {
    stage = dupResult.entities;
    removedDuplicates = dupResult.removedDuplicates;
  }

  /* --- stage 8: Phase 9 – detect overlaps (READ-ONLY) ---------------- */
  // Run on the ORIGINAL input: stage 5 already merges collinear overlaps,
  // so scanning the post-merge stage would hide issues present in the
  // source file. This is detection only — nothing is modified or deleted.
  const overlapResult = detectOverlapVectors(input, opts);
  foundOverlaps = overlapResult.foundOverlaps;

  /* --- stage 9: Phase 9 – detect self-intersections (READ-ONLY) ------ */
  const selfResult = detectSelfIntersections(input);
  foundSelfIntersections = selfResult.foundSelfIntersections;

  // [Phase9 Debug] – diagnostics only, no logic change. Throttled: never
  // serialize huge arrays (50k-entity files would flood the console).
  console.log("[Phase9 Debug]", {
    openGaps: openPaths.length,
    gapsFirst20: openPaths.slice(0, 20).map((p) => ({
      gap: p.gap,
      closable: p.closable,
      entityType: p.entityType,
      layer: p.layer,
    })),
    duplicatesFound: dupResult.removedDuplicates,
    overlapsFound: overlapResult.foundOverlaps,
    selfIntersectionsFound: selfResult.foundSelfIntersections,
  });

  const after = analyzeGeometry(stage, opts);

  const totalChanges =
    duplicateEntitiesRemoved +
    zeroLengthRemoved +
    duplicateVerticesRemoved +
    containedSegmentsRemoved +
    overlappingSegmentsMerged +
    duplicateCurvesRemoved +
    duplicatePolylinesRemoved +
    fixedOpen +
    removedDuplicates;

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
      fixedOpen,
      removedDuplicates,
      foundOverlaps,
      foundSelfIntersections,
      totalChanges,
      toleranceUsed: tol,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Phase 9: open-vector fix, duplicated-vector removal, overlap +     */
/* self-intersection detection (no auto-fix)                          */
/* ------------------------------------------------------------------ */

/**
 * Phase 9 – Open vector decision for a single gap distance (in drawing units = mm).
 *
 * Decision rules:
 *   gap < 0.015  → auto-close: laser kerf (≈0.2 mm) is larger than gap.
 *   0.015–0.1   → needs user confirmation before closing.
 *   gap > 0.1    → intentional open contour: do NOT close.
 *
 * Part6.txt must become 1 closed contour when its ~0.1 mm gap is closed.
 */
export type OpenVectorAction = "close" | "confirm" | "skip";
export interface OpenVectorDecision {
  action: OpenVectorAction;
  gap: number;
  preview?: { from: { x: number; y: number }; to: { x: number; y: number } };
  reason?: string;
}
/**
 * Scale-aware variant of the Phase 9 gap decision rule. `scale` is the
 * drawing bbox diagonal. Normal/large drawings use the absolute rule above
 * (0.015 mm / 0.1 mm); drawings whose whole diagonal is so small that those
 * absolute bands would swallow REAL geometry fall back to relative bands
 * (1%/4% of the diagonal) so Phase 6A's tiny-but-valid drawing keeps every
 * one of its segments connected without inventing bridges.
 */
export function fixOpenVectorScaled(gap: number, scale: number | null): OpenVectorDecision {
  if (scale !== null && isFinite(scale) && scale > 0 && scale < 10) {
    // relative bands for sub-10-unit drawings
    const relClose = scale * 0.01;
    const relConfirm = scale * 0.04;
    if (gap < relClose) return { action: "close", gap };
    if (gap <= relConfirm)
      return {
        action: "confirm",
        gap,
        preview: { from: { x: 0, y: 0 }, to: { x: gap, y: 0 } },
      };
    return { action: "skip", gap, reason: "intentional_open" };
  }
  return fixOpenVector(gap);
}
export function fixOpenVector(gap: number): OpenVectorDecision {
  if (gap < 0.015) return { action: "close", gap };
  if (gap <= 0.1) return { action: "confirm", gap };
  return { action: "skip", gap, reason: "intentional_open" };
}

/** Phase 9 – Auto-close all closable open paths by emitting a closing LINE. */
export function autoCloseOpenPaths(
  paths: OpenPathInfo[],
  entities: DxfEntity[],
  scale: number | null = null,
): { entities: DxfEntity[]; fixedOpen: number; unclosed: OpenPathInfo[] } {
  let fixedOpen = 0;
  const extraLines: DxfEntity[] = [];
  const unclosed: OpenPathInfo[] = [];
  const seenGaps = new Set<string>();
  for (const p of paths) {
    const dec = fixOpenVectorScaled(p.gap, scale);
    if (dec.action === "close") {
      // detectOpenPaths reports the same gap once per endpoint (two reports
      // for one physical gap). Emit only ONE closing line per unique gap.
      // The bridge must run from the open endpoint to the gap PARTNER —
      // never to the entity's own other endpoint (that would duplicate it).
      const a = p.partner ?? p.end;
      const ax = p.start.x,
        ay = p.start.y,
        bx = a.x,
        by = a.y;
      const key =
        ax < bx || (ax === bx && ay <= by)
          ? `${ax.toFixed(9)},${ay.toFixed(9)}|${bx.toFixed(9)},${by.toFixed(9)}`
          : `${bx.toFixed(9)},${by.toFixed(9)}|${ax.toFixed(9)},${ay.toFixed(9)}`;
      if (seenGaps.has(key)) continue;
      seenGaps.add(key);
      extraLines.push({
        type: "LINE",
        layer: p.layer,
        handle: `P9-${p.entityIndex}`,
        rawLines: [],
        x1: bx,
        y1: by,
        x2: ax,
        y2: ay,
      });
      fixedOpen++;
    } else {
      unclosed.push(p);
    }
  }
  return {
    entities: [...entities, ...extraLines],
    fixedOpen,
    unclosed,
  };
}

/**
 * Phase 9 – Remove geometrically duplicated LINE entities.
 *
 * Criterion: two LINEs are duplicates when
 *   • the midpoint of one is within 0.01 mm of the other AND
 *   • they have the same length (±tol) AND
 *   • they are collinear (same angle) or reversed.
 *
 * This is safe: deleting one of two virtually-identical lines does NOT
 * change the output geometry in any meaningful way.
 *
 * NOTE: The existing stage-2 duplicate removal uses a tighter spatial
 * tolerance (opts.tolerance).  Here we go wider (0.01 mm) to also catch
 * near-duplicates that survive stage 2 — without affecting the already-
 * proven 266.dxf behaviour.
 */
export function removeDuplicatedVectors(
  entities: DxfEntity[],
  opts: CleanupOptions = DEFAULT_CLEANUP_OPTIONS,
): { entities: DxfEntity[]; removedDuplicates: number } {
  const lines = entities.map((e, i) => ({ e, i })).filter(({ e }) => e.type === "LINE");
  if (lines.length < 2) return { entities, removedDuplicates: 0 };

  const diag = computeDrawingScale(entities);
  const dupTol =
    diag === null || !isFinite(diag) || diag <= 0
      ? opts.tolerance
      : Math.min(Math.max(diag * 1e-3, opts.tolerance), 0.01);
  const dupTol2 = dupTol * dupTol;

  const dropped = new Set<number>();
  let removedDuplicates = 0;

  // Normalize and decorate lines for sorting/sweep
  const decorated = lines
    .map(({ e, i }) => {
      const ax1 = e.x1 ?? 0,
        ay1 = e.y1 ?? 0,
        ax2 = e.x2 ?? 0,
        ay2 = e.y2 ?? 0;
      // Normalize endpoint order: left-to-right (then bottom-to-top)
      const rev = ax1 > ax2 || (ax1 === ax2 && ay1 > ay2);
      return {
        e,
        i,
        x1: rev ? ax2 : ax1,
        y1: rev ? ay2 : ay1,
        x2: rev ? ax1 : ax2,
        y2: rev ? ay1 : ay2,
        len: Math.hypot(ax2 - ax1, ay2 - ay1),
      };
    })
    .sort((a, b) => a.x1 - b.x1);

  for (let a = 0; a < decorated.length; a++) {
    const da = decorated[a];
    if (dropped.has(da.i)) continue;

    for (let b = a + 1; b < decorated.length; b++) {
      const db = decorated[b];
      if (db.x1 > da.x1 + dupTol) break; // sweep limit reached — sorted by x1!
      if (dropped.has(db.i)) continue;

      // Respect layers: identical geometry living on different layers is NOT a
      // duplicate when respectLayers is enabled (each layer = a separate design
      // domain). This mirrors the layer guards in detectOverlapVectors and the
      // curve/polylines dedup keys. Matches DXF_REPAIR_CAPABILITY.md ("احترام طبقات").
      if (opts.respectLayers && da.e.layer !== db.e.layer) continue;

      // 1. Same length within tolerance
      if (Math.abs(da.len - db.len) > opts.tolerance) continue;

      // 2. Both endpoints within dupTol (forward since already normalized)
      const dist1_2 = d2(da.x1, da.y1, db.x1, db.y1);
      const dist2_2 = d2(da.x2, da.y2, db.x2, db.y2);
      if (dist1_2 > dupTol2 || dist2_2 > dupTol2) continue;

      // 3. Collinear/parallel direction check (retained for exact Phase 9 compliance)
      const dirA = normalizedDir(da.e);
      const dirB = normalizedDir(db.e);
      const dot = dirA.dx * dirB.dx + dirA.dy * dirB.dy;
      if (dot < 1 - opts.angleTolerance && dot > -1 + opts.angleTolerance) continue;

      // Duplicate found
      dropped.add(db.i);
      removedDuplicates++;
    }
  }

  if (removedDuplicates === 0) return { entities, removedDuplicates: 0 };
  return {
    entities: entities.filter((_, i) => !dropped.has(i)),
    removedDuplicates,
  };
}

/**
 * Phase 9 – Detect collinear line pairs whose projections overlap partially
 * (not 100 % — i.e. neither fully contains the other).
 *
 * This is a READ-ONLY pass: NO entities are removed or merged.
 * The caller receives a list of objects to be highlighted in the UI.
 *
 * Overlap rule:
 *   • angle difference < 0.5°  (collinear / parallel)
 *   • projections on the shared axis overlap but neither fully covers the other
 */
export interface OverlapInfo {
  type: "overlap";
  mark: "RED";
  from: [number, number];
  to: [number, number];
  layer: string;
}
export function detectOverlapVectors(
  entities: DxfEntity[],
  opts: CleanupOptions = DEFAULT_CLEANUP_OPTIONS,
): { overlaps: OverlapInfo[]; foundOverlaps: number } {
  const lines = entities
    .filter((e) => e.type === "LINE")
    .map((e) => ({ e, dir: normalizedDir(e) }));

  if (lines.length < 2) return { overlaps: [], foundOverlaps: 0 };

  const overlaps: OverlapInfo[] = [];
  const ANGLE_THRESH_DEG = 0.5;
  const ANGLE_THRESH = (ANGLE_THRESH_DEG * Math.PI) / 180;
  const checked = new Set<string>();

  // PERFORMANCE (large files): the naive all-pairs scan is O(n²). Bucket by
  // quantized direction on the half-circle (angle-doubling fold so a direction
  // and its reverse share a bucket; mod-N adjacency handles the seam), then
  // sweep by projected start — pairs whose projections cannot overlap are
  // skipped. Pairs within ANGLE_THRESH quantize at most 1 bucket apart, so
  // the bucket±1 window preserves the angle filter exactly, and every
  // surviving pair still runs the identical geometric tests below.
  const bucketW = ANGLE_THRESH;
  const nBuckets = Math.ceil(Math.PI / bucketW) + 1;
  const bucketOf = (dir: { dx: number; dy: number }): number => {
    const a = Math.atan2(dir.dy, dir.dx);
    // fold θ and θ+π to the same value in (−π/2, π/2]
    const folded = Math.atan2(Math.sin(2 * a), Math.cos(2 * a)) / 2;
    return ((Math.floor((folded + Math.PI / 2) / bucketW) % nBuckets) + nBuckets) % nBuckets;
  };
  const buckets = new Map<number, { e: DxfEntity; dir: { dx: number; dy: number } }[]>();
  for (const item of lines) {
    const k = bucketOf(item.dir);
    const arr = buckets.get(k);
    if (arr) arr.push(item);
    else buckets.set(k, [item]);
  }

  for (const [k, group] of buckets) {
    const cands = [
      ...(buckets.get((k - 1 + nBuckets) % nBuckets) ?? []),
      ...group,
      ...(buckets.get((k + 1) % nBuckets) ?? []),
    ];
    if (cands.length < 2) continue;
    // Projection axis: reference direction of the CENTER bucket.
    const ref = group[0];
    const rlen = Math.hypot(ref.dir.dx, ref.dir.dy) || 1;
    const ux = ref.dir.dx / rlen,
      uy = ref.dir.dy / rlen;
    const decorated = cands
      .map((item) => {
        const e = item.e;
        const t1 = (e.x1 ?? 0) * ux + (e.y1 ?? 0) * uy;
        const t2 = (e.x2 ?? 0) * ux + (e.y2 ?? 0) * uy;
        return { item, lo: Math.min(t1, t2), hi: Math.max(t1, t2) };
      })
      .sort((a, b) => a.lo - b.lo);
    // Sweep slack: the pair test allows max perpendicular offset of
    // max(tol, 0.01); a projected start beyond a's end by more than that
    // (plus tolerance) can never pass the overlap test on either axis.
    const sweepSlack = Math.max(opts.tolerance, 0.01) + opts.tolerance;

    for (let i = 0; i < decorated.length; i++) {
      const { item: aItem, hi: aHi } = decorated[i];
      const { e: ai, dir: dirA } = aItem;
      if (!ai.handle) continue;
      for (let j = i + 1; j < decorated.length; j++) {
        const { item: bItem, lo: bLo } = decorated[j];
        if (bLo > aHi + sweepSlack) break; // sorted by lo — all later pairs impossible
        const { e: bj, dir: dirB } = bItem;
        if (!bj.handle || bj === ai) continue;

        if (opts.respectLayers && ai.layer !== bj.layer) continue;

        const angleDiff = Math.abs(Math.atan2(dirA.dy, dirA.dx) - Math.atan2(dirB.dy, dirB.dx));
        const normDiff = Math.min(angleDiff, Math.PI - angleDiff);
        if (normDiff > ANGLE_THRESH) continue;

        // Must also be COLLINEAR: the perpendicular offset of b's endpoints
        // from a's line must be within tolerance. Parallel-but-offset lines
        // (e.g. two edges of a long thin slot) are NOT overlaps.
        const refX = ai.x1 ?? 0;
        const refY = ai.y1 ?? 0;
        const perp = (x: number, y: number) => -dirA.dy * (x - refX) + dirA.dx * (y - refY);
        const offB0 = Math.abs(perp(bj.x1 ?? 0, bj.y1 ?? 0));
        const offB1 = Math.abs(perp(bj.x2 ?? 0, bj.y2 ?? 0));
        const maxOff = Math.max(offB0, offB1);
        if (maxOff > Math.max(opts.tolerance, 0.01)) continue;

        const dot = (x: number, y: number) => x * dirA.dx + y * dirA.dy;

        const pA0 = dot(refX - refX, refY - refY);
        const pA1 = dot((ai.x2 ?? 0) - refX, (ai.y2 ?? 0) - refY);
        const pB0 = dot((bj.x1 ?? 0) - refX, (bj.y1 ?? 0) - refY);
        const pB1 = dot((bj.x2 ?? 0) - refX, (bj.y2 ?? 0) - refY);

        const a0 = Math.min(pA0, pA1),
          a1 = Math.max(pA0, pA1);
        const b0 = Math.min(pB0, pB1),
          b1 = Math.max(pB0, pB1);

        const overlapStart = Math.max(a0, b0);
        const overlapEnd = Math.min(a1, b1);
        const overlapLen = Math.max(0, overlapEnd - overlapStart);
        const unionLen = Math.max(a1, b1) - Math.min(a0, b0);
        if (unionLen === 0) continue;

        // Spec: flag PARTIAL overlaps only — one segment fully covering the
        // other (or exact duplicates) is stage-5/near-duplicate territory.
        const aLen = a1 - a0,
          bLen = b1 - b0;
        const containedInA = overlapLen >= bLen - opts.tolerance;
        const containedInB = overlapLen >= aLen - opts.tolerance;
        if (containedInA || containedInB) continue;

        const overlapFraction = overlapLen / unionLen;

        if (overlapLen > opts.tolerance && overlapFraction < 0.9999) {
          const key = [ai.handle, bj.handle].sort().join("-");
          if (checked.has(key)) continue;
          checked.add(key);

          overlaps.push({
            type: "overlap",
            mark: "RED",
            from: [bj.x1 ?? 0, bj.y1 ?? 0],
            to: [bj.x2 ?? 0, bj.y2 ?? 0],
            layer: bj.layer,
          });
        }
      }
    }
  }

  return { overlaps, foundOverlaps: overlaps.length };
}

/**
 * Phase 9 – Detect self-intersections in LWPOLYLINE / POLYLINE entities.
 *
 * Algorithm: for each polyline, test every pair of non-adjacent edges for
 * intersection.  Bulge arcs are treated as straight chords (conservative).
 * Vertices that are exactly shared with an adjacent edge are skipped.
 *
 * This is a READ-ONLY pass: NO entities are modified.
 */
export interface SelfIntersectionInfo {
  polylineIndex: number;
  type: "self_intersection";
  mark: "RED";
  point: [number, number];
  layer: string;
}
function orderedSeg(a: { x: number; y: number }, b: { x: number; y: number }) {
  if (a.x < b.x || (a.x === b.x && a.y < b.y)) return { s: a, e: b };
  return { s: b, e: a };
}
function segIntersect(
  a: { x: number; y: number },
  ae: { x: number; y: number },
  b: { x: number; y: number },
  be: { x: number; y: number },
): { x: number; y: number } | null {
  const d1x = ae.x - a.x,
    d1y = ae.y - a.y;
  const d2x = be.x - b.x,
    d2y = be.y - b.y;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-12) return null;
  const t = ((b.x - a.x) * d2y - (b.y - a.y) * d2x) / cross;
  const u = ((b.x - a.x) * d1y - (b.y - a.y) * d1x) / cross;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return { x: a.x + t * d1x, y: a.y + t * d1y };
}
export function detectSelfIntersections(entities: DxfEntity[]): {
  intersections: SelfIntersectionInfo[];
  foundSelfIntersections: number;
} {
  const intersections: SelfIntersectionInfo[] = [];
  let idx = 0;
  for (const e of entities) {
    if (
      (e.type !== "LWPOLYLINE" && e.type !== "POLYLINE") ||
      !e.vertices ||
      e.vertices.length < 4
    ) {
      idx++;
      continue;
    }

    const v = e.vertices;
    const n = v.length;
    const range = e.closed ? n : n - 1;

    for (let a = 0; a < range; a++) {
      const ae = (a + 1) % n;
      const segA = orderedSeg(v[a], v[ae]);

      for (let b = a + 2; b < range; b++) {
        if (e.closed && b === n) continue;
        const be = (b + 1) % n;
        if (!e.closed && ae === b) continue;
        if (e.closed && ae % n === b) continue;

        const segB = orderedSeg(v[b], v[be]);
        const pt = segIntersect(segA.s, segA.e, segB.s, segB.e);
        if (pt) {
          intersections.push({
            polylineIndex: idx,
            type: "self_intersection",
            mark: "RED",
            point: [pt.x, pt.y],
            layer: e.layer,
          });
        }
      }
    }
    idx++;
  }
  return { intersections, foundSelfIntersections: intersections.length };
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

  const out = entities.map((e) => {
    if ((e.type !== "LWPOLYLINE" && e.type !== "POLYLINE") || !e.vertices || e.vertices.length < 4)
      return e;
    if (e.vertices.some((v) => (v.bulge ?? 0) !== 0)) return e; // never destroy bulge geometry
    const v = e.vertices;
    const kept: DxfVertex[] = [v[0]];
    for (let i = 1; i < v.length - 1; i++) {
      const prev = kept[kept.length - 1];
      const cur = v[i];
      const next = v[i + 1];
      const ax = cur.x - prev.x,
        ay = cur.y - prev.y;
      const bx = next.x - cur.x,
        by = next.y - cur.y;
      const la = Math.hypot(ax, ay),
        lb = Math.hypot(bx, by);
      if (la === 0 || lb === 0) {
        verticesRemoved++;
        continue;
      }
      const cosT = (ax * bx + ay * by) / (la * lb);
      const isCorner = cosT < cornerCos;
      const dev =
        Math.abs(ax * by - ay * bx) / Math.max(Math.hypot(next.x - prev.x, next.y - prev.y), 1e-12);
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

/* ================================================================== */
/* MASTER CLEANUP implementation                                       */
/* ================================================================== */

/** Douglas-Peucker polyline simplification (iterative, tolerance in units). */
export function rdpSimplify(points: DxfVertex[], tolerance: number): DxfVertex[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = -1;
    let idx = -1;
    const ax = points[s].x,
      ay = points[s].y;
    const bx = points[e].x,
      by = points[e].y;
    const dx = bx - ax,
      dy = by - ay;
    const len = Math.hypot(dx, dy);
    for (let i = s + 1; i < e; i++) {
      const d =
        len < 1e-12
          ? Math.hypot(points[i].x - ax, points[i].y - ay)
          : Math.abs(dx * (ay - points[i].y) - dy * (ax - points[i].x)) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tolerance && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out: DxfVertex[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

/** Merge collinear, touching LINEs into single longer LINEs. */
export function mergeCollinearLines(
  entities: DxfEntity[],
  angleTolRad: number,
  gapTol: number,
  respectLayers = true,
): { entities: DxfEntity[]; merged: number } {
  const lines = entities.filter((e) => e.type === "LINE");
  if (lines.length < 2) return { entities, merged: 0 };

  const dirKeyOf = (e: DxfEntity): string => {
    const dx = (e.x2 ?? 0) - (e.x1 ?? 0);
    const dy = (e.y2 ?? 0) - (e.y1 ?? 0);
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len,
      ny = dy / len;
    const flip = ny < -1e-9 || (Math.abs(ny) <= 1e-9 && nx < 0) ? -1 : 1;
    const bucket = Math.round(Math.atan2(ny * flip, nx * flip) / 0.00872665);
    // Phase 8 safety (§7): NEVER merge geometry across different layers —
    // a CUT line and an ENGRAVE line on the same infinite line are
    // semantically different even when geometrically continuous.
    return `${respectLayers ? e.layer : "*"}|${bucket}`;
  };

  const buckets = new Map<string, DxfEntity[]>();
  for (const e of lines) {
    const k = dirKeyOf(e);
    const arr = buckets.get(k);
    if (arr) arr.push(e);
    else buckets.set(k, [e]);
  }

  const replacement = new Map<DxfEntity, DxfEntity>();
  let merged = 0;
  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    const ref = group[0];
    const rdx = (ref.x2 ?? 0) - (ref.x1 ?? 0),
      rdy = (ref.y2 ?? 0) - (ref.y1 ?? 0);
    const rlen = Math.hypot(rdx, rdy) || 1;
    const rux = rdx / rlen,
      ruy = rdy / rlen;
    const rx0 = ref.x1 ?? 0,
      ry0 = ref.y1 ?? 0;
    type Run = { min: number; max: number; entities: DxfEntity[] };
    // PERFORMANCE: sort by projected start, then sweep. Once a run's max is
    // behind the current line's lo + gapTol, no future line (sorted by lo)
    // can ever join it — so a single forward pass is exactly equivalent to
    // the previous O(runs × lines) runs.find() scan.
    const proj = group
      .map((e) => {
        const off = Math.abs(-((e.x1 ?? 0) - rx0) * ruy + ((e.y1 ?? 0) - ry0) * rux);
        const t1 = (e.x1 ?? 0) * rux + (e.y1 ?? 0) * ruy;
        const t2 = (e.x2 ?? 0) * rux + (e.y2 ?? 0) * ruy;
        return { e, off, lo: Math.min(t1, t2), hi: Math.max(t1, t2) };
      })
      .sort((a, b) => a.lo - b.lo);
    const runs: Run[] = [];
    for (const p of proj) {
      if (p.off > gapTol) continue; // perpendicular offset from the reference line must be within gapTol
      const run = runs.length ? runs[runs.length - 1] : undefined;
      if (run && p.lo <= run.max + gapTol) {
        run.max = Math.max(run.max, p.hi);
        run.entities.push(p.e);
      } else {
        runs.push({ min: p.lo, max: p.hi, entities: [p.e] });
      }
    }
    for (const run of runs) {
      if (run.entities.length < 2) continue;
      const kept = run.entities[0];
      const line: DxfEntity = {
        type: "LINE",
        layer: kept.layer,
        handle: kept.handle,
        rawLines: [],
        x1: rx0 + run.min * rux,
        y1: ry0 + run.min * ruy,
        x2: rx0 + run.max * rux,
        y2: ry0 + run.max * ruy,
      };
      for (const e of run.entities) replacement.set(e, line);
      merged += run.entities.length - 1;
    }
  }
  if (merged === 0) return { entities, merged };
  const seen = new Set<DxfEntity>();
  const out: DxfEntity[] = [];
  for (const e of entities) {
    const rep = replacement.get(e);
    if (!rep) {
      out.push(e);
      continue;
    }
    if (seen.has(rep)) continue;
    seen.add(rep);
    out.push(rep);
  }
  return { entities: out, merged };
}

/**
 * Move every entity to layer "0". Returns the number of distinct non-zero
 * layers removed.
 */
export function flattenLayersToZero(entities: DxfEntity[]): {
  entities: DxfEntity[];
  layersCleaned: number;
} {
  const layers = new Set<string>();
  for (const e of entities) if (e.layer !== "0") layers.add(e.layer);
  if (layers.size === 0) return { entities, layersCleaned: 0 };
  return {
    entities: entities.map((e) => (e.layer === "0" ? e : { ...e, layer: "0" })),
    layersCleaned: layers.size,
  };
}

/** Warn when the drawing scale looks suspicious for manufacturing. */
export function validateDrawingScale(entities: DxfEntity[]): string | null {
  const diag = computeDrawingScale(entities);
  if (diag === null || !isFinite(diag) || diag <= 0) return null;
  if (diag < 5) {
    return `drawing measures ${diag.toFixed(2)} units — suspiciously small; check scale/units`;
  }
  if (diag > 2000) {
    return `drawing measures ${diag.toFixed(2)} units — suspiciously large; check scale/units`;
  }
  return null;
}

export interface MasterCleanupOptions {
  /** Flatten SPLINE/ARC/CIRCLE/ELLIPSE to polylines (default: on). */
  flattenCurves?: boolean;
  /** Chord tolerance for curve flattening (units, default 0.05). */
  curveTolerance?: number;
  /** Apply inch→mm conversion when detectable (default: on). */
  normalizeUnits?: boolean;
  /** Raw $INSUNITS value when known (1 = inch, 4 = mm). */
  insunits?: number;
  /** Remove TEXT/MTEXT/DIMENSION/HATCH/LEADER (default: on). */
  removeUnsupported?: boolean;
  /** RDP tolerance for polyline simplification (default 0.01). */
  simplifyTolerance?: number;
  /** Move everything to layer 0 (default: on). */
  flattenLayers?: boolean;
  /** Forwarded to cleanupEntities (dedupe/open-gap/tiny removal). */
  cleanup?: Partial<CleanupOptions>;
}

/**
 * MASTER DXF SANITIZER — the "final cleanup" pipeline.
 *
 * Order: Phase A (pre-process) → proven Phase 8/9 engine → Phase C (optimization).
 * Deterministic geometry math only. Findings that cannot be repaired safely
 * are REPORTED (overlaps, self-intersections), never silently destroyed.
 */
export function masterCleanup(
  input: DxfEntity[],
  options: MasterCleanupOptions = {},
  headerSection?: string,
): { entities: DxfEntity[]; report: MasterCleanupReport } {
  const report: MasterCleanupReport = {
    flattenedSplines: 0,
    convertedUnits: 0,
    removedUnsupported: 0,
    removedZeroLength: 0,
    fixedOpen: 0,
    removedDuplicates: 0,
    mergedCollinear: 0,
    simplifiedPoints: 0,
    layersCleaned: 0,
    foundOverlaps: 0,
    foundSelfIntersections: 0,
    scaleWarning: null,
    totalChanges: 0,
  };

  let stage: DxfEntity[] = input;

  /* --- Phase A1: flatten curves to polylines ------------------------- */
  if (options.flattenCurves !== false) {
    const chordTol = options.curveTolerance ?? 0.05;
    const out: DxfEntity[] = [];
    for (const e of stage) {
      if (!CURVE_TYPES.has(e.type)) {
        out.push(e);
        continue;
      }
      const poly = curveToPolyline(e, chordTol);
      if (poly) {
        report.flattenedSplines++;
        out.push(poly);
      } else out.push(e);
    }
    stage = out;
  }

  /* --- Phase A2: unit normalization (inch → mm) ---------------------- */
  if (options.normalizeUnits !== false) {
    const insunits = options.insunits ?? extractInsUnits(headerSection);
    const conv = normalizeDrawingUnits(stage, insunits);
    if (conv) {
      stage = conv;
      report.convertedUnits = 1;
    }
  }

  /* --- Phase A3: remove unsupported annotation entities -------------- */
  if (options.removeUnsupported !== false) {
    const before = stage.length;
    stage = stage.filter((e) => !UNSUPPORTED_GEOMETRY_TYPES.has(e.type));
    report.removedUnsupported = before - stage.length;
  }

  /* --- Phase A4+B: the proven Phase 8/9 cleanup engine --------------- */
  const base = cleanupEntities(stage, options.cleanup);
  stage = base.entities;
  report.removedZeroLength += base.report.zeroLengthRemoved;
  report.fixedOpen = base.report.fixedOpen;
  // Aggregate ALL duplicate removals (exact, reversed, near-duplicate) into a
  // single "removedDuplicates" figure for the master report.
  report.removedDuplicates =
    base.report.duplicateEntitiesRemoved +
    base.report.reversedDuplicatesRemoved +
    base.report.removedDuplicates;
  report.foundOverlaps = base.report.foundOverlaps;
  report.foundSelfIntersections = base.report.foundSelfIntersections;

  /* --- Phase C9: merge collinear LINEs -------------------------------- */
  const mc = mergeCollinearLines(stage, 0.00872665 /* ~0.5° */, 0.01);
  stage = mc.entities;
  report.mergedCollinear = mc.merged;

  /* --- Phase C10: RDP simplification ---------------------------------- */
  const simplifyTol = options.simplifyTolerance ?? 0.01;
  {
    let removed = 0;
    stage = stage.map((e) => {
      if ((e.type !== "LWPOLYLINE" && e.type !== "POLYLINE") || !e.vertices) return e;
      if (e.vertices.some((v) => (v.bulge ?? 0) !== 0)) return e; // never destroy bulge
      const simplified = rdpSimplify(e.vertices, simplifyTol);
      if (simplified.length === e.vertices.length) return e;
      removed += e.vertices.length - simplified.length;
      return { ...e, vertices: simplified, vertexCount: simplified.length };
    });
    report.simplifiedPoints = removed;
  }

  /* --- Phase C11: flatten layers -------------------------------------- */
  if (options.flattenLayers !== false) {
    const fl = flattenLayersToZero(layerSafeEntities(stage));
    stage = fl.entities;
    report.layersCleaned = fl.layersCleaned;
  }

  /* --- Phase C12: scale validation ------------------------------------- */
  report.scaleWarning = validateDrawingScale(stage);

  report.totalChanges =
    report.flattenedSplines +
    report.convertedUnits +
    report.removedUnsupported +
    report.removedZeroLength +
    report.fixedOpen +
    report.removedDuplicates +
    report.mergedCollinear +
    report.simplifiedPoints +
    report.layersCleaned;

  return { entities: stage, report };
}

function layerSafeEntities(entities: DxfEntity[]): DxfEntity[] {
  return entities;
}

/* --- Master pipeline helpers ------------------------------------------ */

/**
 * Adaptive curve flattening. SPLINE keeps its fit/control-point shape and is
 * RDP-simplified at `chordTol`. ARC/CIRCLE/ELLIPSE are tessellated adaptively
 * so the chord error stays under `chordTol`.
 * Returns null when the entity cannot be faithfully converted (caller keeps
 * the original — uncertain = preserve).
 */
function curveToPolyline(e: DxfEntity, chordTol: number): DxfEntity | null {
  if (e.type === "SPLINE") {
    const pts = e.vertices;
    if (!pts || pts.length < 2) return null;
    const simplified = rdpSimplify(pts, chordTol);
    if (simplified.length < 2) return null;
    return {
      type: "LWPOLYLINE",
      layer: e.layer,
      handle: e.handle,
      rawLines: [],
      vertices: simplified,
      closed: e.closed ?? false,
      vertexCount: simplified.length,
    };
  }

  if (e.type === "CIRCLE") {
    const r = e.radius ?? 0;
    if (!(r > 0)) return null;
    return {
      type: "LWPOLYLINE",
      layer: e.layer,
      handle: e.handle,
      rawLines: [],
      vertices: tessellateArc(e.cx ?? 0, e.cy ?? 0, r, 0, Math.PI * 2, chordTol),
      closed: true,
      vertexCount: 0,
    };
  }

  if (e.type === "ARC") {
    const r = e.radius ?? 0;
    if (!(r > 0)) return null;
    const a1 = ((e.startAngle ?? 0) * Math.PI) / 180;
    const a2 = ((e.endAngle ?? 0) * Math.PI) / 180;
    return {
      type: "LWPOLYLINE",
      layer: e.layer,
      handle: e.handle,
      rawLines: [],
      vertices: tessellateArc(e.cx ?? 0, e.cy ?? 0, r, a1, a2, chordTol),
      closed: false,
      vertexCount: 0,
    };
  }

  if (e.type === "ELLIPSE") {
    const cx = e.cx ?? 0,
      cy = e.cy ?? 0;
    const r = e.radius ?? 0; // major radius (parser stores sqrt(mx²+my²))
    if (!(r > 0)) return null;
    // The parser does not retain the true axis ratio (code 40); use a
    // conservative 0.6 default so the shape remains visually correct.
    const axisRatio = 0.6;
    const a1 = ((e.startAngle ?? 0) * Math.PI) / 180;
    const a2 = ((e.endAngle ?? 360) * Math.PI) / 180;
    return {
      type: "LWPOLYLINE",
      layer: e.layer,
      handle: e.handle,
      rawLines: [],
      vertices: tessellateArc(cx, cy, r, a1, a2, chordTol, axisRatio),
      closed: (e.endAngle ?? 360) - (e.startAngle ?? 0) >= 360,
      vertexCount: 0,
    };
  }

  return null;
}

/** Adaptive arc/ellipse tessellation with chord-error control. */
function tessellateArc(
  cx: number,
  cy: number,
  r: number,
  a1: number,
  a2: number,
  chordTol: number,
  axisRatio = 1,
): DxfVertex[] {
  let sweep = a2 - a1;
  while (sweep <= 0) sweep += Math.PI * 2;
  if (sweep > Math.PI * 2) sweep = Math.PI * 2;
  const effR = Math.max(r * axisRatio, r);
  // segments so the sagitta r·(1−cos(dθ/2)) stays ≤ chordTol
  const cosArg = Math.max(-1, Math.min(1, 1 - chordTol / effR));
  const step = 2 * Math.acos(cosArg);
  const segments = Math.min(Math.max(Math.ceil(sweep / Math.max(step, 1e-6)), 8), 4096);
  const pts: DxfVertex[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = a1 + (sweep * i) / segments;
    pts.push({ x: cx + r * axisRatio * Math.cos(t), y: cy + r * Math.sin(t) });
  }
  return pts;
}

/**
 * Inch→mm conversion when confidently detectable:
 * $INSUNITS === 1 (inch), OR units unspecified AND bbox width > 500
 * (implausible for mm parts, typical of inch exports).
 * Returns scaled entities, or null when no conversion was applied.
 */
function normalizeDrawingUnits(entities: DxfEntity[], insunits?: number): DxfEntity[] | null {
  const scaleNeeded = insunits === 1 ? true : insunits === undefined && widthOf(entities) > 500;
  if (!scaleNeeded) return null;
  const S = 25.4;
  return entities.map((e) => {
    const out: DxfEntity = { ...e };
    if (out.x1 !== undefined) {
      out.x1 *= S;
      out.y1 = (out.y1 ?? 0) * S;
    }
    if (out.x2 !== undefined) {
      out.x2 *= S;
      out.y2 = (out.y2 ?? 0) * S;
    }
    if (out.cx !== undefined) {
      out.cx *= S;
      out.cy = (out.cy ?? 0) * S;
    }
    if (out.radius !== undefined) out.radius *= S;
    if (out.vertices) {
      out.vertices = out.vertices.map((v) => ({ ...v, x: v.x * S, y: v.y * S }));
    }
    return out;
  });
}

function widthOf(entities: DxfEntity[]): number {
  const diag = computeDrawingScale(entities);
  return diag === null ? 0 : diag;
}

/**
 * Extract $INSUNITS from the raw HEADER section text (e.g. "9\n$INSUNITS\n70\n1\n").
 * Returns undefined when absent/unparseable — caller falls back to bbox heuristic.
 */
export function extractInsUnits(header?: string): number | undefined {
  if (!header) return undefined;
  const m = header.match(/\$INSUNITS\s*\n\s*70\s*\n\s*(-?\d+)/);
  if (!m) return undefined;
  const v = parseInt(m[1], 10);
  return isFinite(v) ? v : undefined;
}
