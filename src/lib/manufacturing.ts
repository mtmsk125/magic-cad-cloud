/*
 * Phase 3 — Manufacturing classification layer (detection/classification only).
 * Imports only *types* from dxf.ts (type-only) to avoid a runtime cycle.
 * Buckets: confirmed / potential / safe (see classifyManufacturing).
 */
import type { DxfEntity, ManufacturingFinding, ManufacturingScan } from "./dxf";
// Runtime helper (not a cycle: dxf-cleanup only imports *types* from dxf.ts).
import { effectiveTinyTolerance } from "./dxf-cleanup";

export interface ClassifyOptions {
  snapTolerance?: number;
  nearGapTol?: number;
  isolateTol?: number;
  scrapLenTol?: number; // max length of an open stub still considered "short/scrap"
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function lineKey(e: DxfEntity, tol: number = 1e-6): string {
  const x1 = Math.round((e.x1 ?? 0) / tol) * tol;
  const y1 = Math.round((e.y1 ?? 0) / tol) * tol;
  const x2 = Math.round((e.x2 ?? 0) / tol) * tol;
  const y2 = Math.round((e.y2 ?? 0) / tol) * tol;
  const a = `${x1},${y1}`;
  const b = `${x2},${y2}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Phase 3 classification entry point.
 * NEVER repairs / closes / snaps / merges / deletes / converts geometry.
 * Reuses the engine's existing snap tolerance (0.001) so it never contradicts Phase 2.
 */
export function classifyManufacturing(
  entities: DxfEntity[],
  opts?: ClassifyOptions
): ManufacturingScan {
  const snapTolerance = opts?.snapTolerance ?? 0.001;
  const nearGapTol = opts?.nearGapTol ?? 0.5;   // gap considered a near-miss on the same contour
  const isolateTol = opts?.isolateTol ?? 5.0;  // beyond this, open geometry is "isolated"
  // Phase 6A (Bug 2): tiny threshold is SCALE-AWARE — derived from the
  // drawing's bounding-box diagonal so legitimate small geometry in
  // small-scale drawings is never flagged as junk (matches cleanup engine).
  const TINY = Math.max(effectiveTinyTolerance(entities), 1e-12);
  const findings: ManufacturingFinding[] = [];

  const lenOf = (e: DxfEntity): number => {
    if (e.type === "LINE") return dist(e.x1 ?? 0, e.y1 ?? 0, e.x2 ?? 0, e.y2 ?? 0);
    if (e.type === "LWPOLYLINE" || e.type === "POLYLINE") {
      const v = e.vertices ?? [];
      let l = 0; for (let i = 1; i < v.length; i++) l += dist(v[i - 1].x, v[i - 1].y, v[i].x, v[i].y);
      if (!e.closed && v.length > 1) l += dist(v[0].x, v[0].y, v[v.length - 1].x, v[v.length - 1].y);
      return l;
    }
    return 0;
  };

  // Gap between the open endpoints of an open LINE / open polyline (null if closed).
  const openGap = (e: DxfEntity): number | null => {
    if (e.type === "LINE") return dist(e.x1 ?? 0, e.y1 ?? 0, e.x2 ?? 0, e.y2 ?? 0);
    if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices && e.vertices.length > 0) {
      if (e.closed) return null;
      const v = e.vertices;
      return dist(v[0].x, v[0].y, v[v.length - 1].x, v[v.length - 1].y);
    }
    return null;
  };

  // Distance from (x,y) to the nearest other entity's geometry.
  const nearestOtherDist = (x: number, y: number, selfIndex: number): number => {
    let best = Infinity;
    for (let k = 0; k < entities.length; k++) {
      if (k === selfIndex) continue;
      const e = entities[k];
      if (e.type === "LINE") {
        best = Math.min(best, dist(x, y, e.x1 ?? 0, e.y1 ?? 0));
        best = Math.min(best, dist(x, y, e.x2 ?? 0, e.y2 ?? 0));
      } else if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices) {
        for (const v of e.vertices) best = Math.min(best, dist(x, y, v.x, v.y));
      } else if (e.type === "CIRCLE" || e.type === "ARC") {
        best = Math.min(best, dist(x, y, e.cx ?? 0, e.cy ?? 0) - (e.radius ?? 0));
      }
    }
    return best;
  };

  // --- 1) duplicates (exact / reversed identical geometry, 1e-6 quantised) ---
  const lineSeen = new Map<string, number>();
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.type !== "LINE") continue;
    const key = lineKey(e);
    if (lineSeen.has(key)) {
      const prev = lineSeen.get(key)!;
      findings.push({
        id: `duplicate_${prev}_${i}`,
        category: "confirmed",
        type: "duplicate",
        severity: "warning",
        confidence: 0.95,
        repairable: true,
        reason: "Two distinct entities are geometrically identical; a safe duplicate-removal pass can handle this.",
        entityIndices: [prev, i],
      });
    } else {
      lineSeen.set(key, i);
    }
  }

      // --- 2) tiny / zero-length geometry (per entity) --------------------------
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    // VERTEX / SEQEND are bookkeeping records of legacy POLYLINEs, not geometry.
    if (e.type === "VERTEX" || e.type === "SEQEND") continue;
    const l = lenOf(e);
    if (l < TINY) {
      findings.push({
        id: `zero_length_${i}`,
        category: "confirmed",
        type: "tiny_geometry",
        severity: "error",
        confidence: 0.9,
        repairable: true,
        reason: `Entity on layer "${e.layer}" has near-zero length (${l.toFixed(4)}); safe zero-length cleanup can remove it.`,
        entityIndices: [i],
        detail: `length=${l.toFixed(4)} type=${e.type}`,
      });
    } else if (l < TINY * 10 && e.type === "LINE") {
      findings.push({
        id: `tiny_${i}`,
        category: "potential",
        type: "tiny_geometry",
        severity: "warning",
        confidence: 0.6,
        repairable: false,
        reason: `Very short line (${l.toFixed(4)}) — may be an intentional detail or a drafting artefact; report only.`,
        entityIndices: [i],
        detail: `length=${l.toFixed(4)}`,
      });
    }
  }

  // --- 3) open contours: near_gap + isolated short/open scrap (classify only) ---
  /*
   * A bare LINE is itself always "open" (start != end) — that is NOT a defect.
   * We only report an open entity when there is contextual evidence it is
   * suspicious (§55/§59 — never auto-close/merge/delete; conservative §7):
   *   near_gap          : a short open stub whose own endpoints nearly meet AND it
   *                       sits near other geometry (a stub bridging a small gap).
   *   isolated_open     : a SHORT open stub that is far (> isolateTol) from ALL other
   *                       geometry (likely scrap/leftover).
   * Long open lines are deliberately NOT reported — "open entity != defect".
   */
  const scrapLenTol = opts?.scrapLenTol ?? 1.0;
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    const gap = openGap(e);
    if (gap === null) continue;            // closed contour / non-line entity
    if (gap <= snapTolerance) continue;    // already snapped shut by Phase 2

    const isLine = e.type === "LINE";
    const p0 = isLine ? { x: e.x1 ?? 0, y: e.y1 ?? 0 }
      : { x: e.vertices![0].x, y: e.vertices![0].y };
    const p1 = isLine ? { x: e.x2 ?? 0, y: e.y2 ?? 0 }
      : { x: e.vertices![e.vertices!.length - 1].x, y: e.vertices![e.vertices!.length - 1].y };
    const d1 = nearestOtherDist(p0.x, p0.y, i);
    const d2 = nearestOtherDist(p1.x, p1.y, i);
    const minOther = Math.min(d1, d2);
    const nearOther = minOther <= nearGapTol;    // geometry close enough to be related
    const isolated  = minOther > isolateTol;     // nothing nearby at all
    const len = lenOf(e);

    if (gap <= nearGapTol && nearOther) {
      // Short stub: own endpoints nearly touch AND near other geometry -> near-gap.
      findings.push({
        id: `near_gap_${i}`,
        category: "confirmed",
        type: "near_gap",
        severity: "warning",
        confidence: 0.8,
        repairable: false,
        reason: `Open stub (len ${len.toFixed(4)}) whose endpoints nearly meet and sit near other geometry — possible unjoined near-gap; not auto-closed (gap > snap tolerance).`,
        entityIndices: [i],
        detail: `gap=${gap.toFixed(4)} len=${len.toFixed(4)} minOther=${minOther.toFixed(4)}`,
      });
    } else if (isolated && len <= scrapLenTol) {
      // Short open stub floating alone -> suspected scrap. Long lines are NOT flagged.
      findings.push({
        id: `isolated_${i}`,
        category: "potential",
        type: "isolated_open_geometry",
        severity: "warning",
        confidence: 0.75,
        repairable: false,
        reason: `Short open stub (len ${len.toFixed(4)}) isolated (>= ${isolateTol}) from all other geometry — likely scrap; report only, do not close/snap/delete/merge.`,
        entityIndices: [i],
        detail: `gap=${gap.toFixed(4)} len=${len.toFixed(4)} minOther=${minOther.toFixed(4)}`,
      });
    }
    // else: a long open line (isolated or near other geometry) is ambiguous/legitimate
    // CAD geometry — do NOT report (conservative; §7).
  }

  // --- 4) stray geometry: isolated closed/non-open entity (nearest-neighbour) ----------
  const strayIndices = new Set<number>();
  const centerOf = (e: DxfEntity): { x: number; y: number } | null => {
    if (e.type === "LWPOLYLINE" || e.type === "POLYLINE" || e.type === "SPLINE") {
      const v = e.vertices ?? []; if (!v.length) return null;
      return { x: v.reduce((a, b) => a + b.x, 0) / v.length, y: v.reduce((a, b) => a + b.y, 0) / v.length };
    }
    if (e.type === "LINE") return { x: (e.x1! + e.x2!) / 2, y: (e.y1! + e.y2!) / 2 };
    if (e.type === "CIRCLE" || e.type === "ARC" || e.type === "ELLIPSE") return { x: e.cx ?? 0, y: e.cy ?? 0 };
    return null;
  };
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (openGap(e) !== null) continue; // open contours are handled in section 3
    const c = centerOf(e);
    if (!c) continue;
    const nn = nearestOtherDist(c.x, c.y, i);
    if (nn > isolateTol && nn < Infinity) {
      strayIndices.add(i);
      findings.push({
        id: `stray_${i}`,
        category: "potential",
        type: "stray_geometry",
        severity: "warning",
        confidence: 0.7,
        repairable: false,
        reason: `Entity on layer "${e.layer}" is isolated from all other geometry — likely stray/imported geometry; report only.`,
        entityIndices: [i],
        detail: `nearestOther=${nn.toFixed(4)}`,
      });
    }
  }

  // --- 5) Safe (closed) contours are informational only ---------------------
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (strayIndices.has(i)) continue; // already classified as stray above
    const isClosedContour = (e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.closed === true;
    if (isClosedContour) {
      findings.push({
        id: `safe_closed_${i}`,
        category: "safe",
        type: "tiny_geometry", // informational bucket label
        severity: "warning",
        confidence: 0.95,
        repairable: false,
        reason: `Closed contour (layer "${e.layer}") — no open endpoints, safe as-is.`,
        entityIndices: [i],
      });
    }
  }

  // NOTE: self-intersection detection is intentionally NOT implemented here.
  // It requires robust curve-segment intersection math (SPLINE/ELLIPSE/Arc),
  // and a naive implementation would produce many false positives. Per policy,
  // we report the limitation rather than ship an unreliable detector.

  let confirmed = 0, potential = 0, safe = 0;
  for (const f of findings) {
    if (f.category === "confirmed") confirmed++;
    else if (f.category === "potential") potential++;
    else safe++;
  }

  return {
    findings,
    confirmedCount: confirmed,
    potentialCount: potential,
    safeCount: safe,
    summary: [
      `Confirmed issues: ${confirmed}`,
      `Potential issues: ${potential}`,
      `Safe findings: ${safe}`,
    ],
  };
}
