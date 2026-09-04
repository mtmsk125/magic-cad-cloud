export interface DxfGroup {
  code: number;
  value: string;
}

export interface DxfVertex {
  x: number;
  y: number;
  bulge?: number;
}

export interface DxfEntity {
  type: string;
  layer: string;
  handle: string;
  rawLines: string[];
  // LINE
  x1?: number;
  y1?: number;
  z1?: number;
  x2?: number;
  y2?: number;
  z2?: number;
  // ARC / CIRCLE
  cx?: number;
  cy?: number;
  cz?: number;
  radius?: number;
  ratio?: number; // ELLIPSE: minor/major axis ratio
  startAngle?: number;
  endAngle?: number;
  // LWPOLYLINE
  vertices?: DxfVertex[];
  closed?: boolean;
  vertexCount?: number;
}

export interface DxfIssue {
  id: string;
  type:
    | "duplicate_line"
    | "open_polyline"
    | "tiny_entity"
    | "zero_length"
    | "overlapping_lines"
    | "self_intersect"
    | "open_loop";
  severity: "error" | "warning";
  ar: string;
  en: string;
  entityIndices: number[];
  fixed: boolean;
}

export interface DxfStats {
  totalEntities: number;
  lines: number;
  polylines: number;
  arcs: number;
  circles: number;
  others: number;
  layers: string[];
  originalFileSize?: number;
  processedFileSize?: number;
  sizeReductionPercent?: number;
  processingTimeMs?: number;
}

export interface DxfAnalysis {
  entities: DxfEntity[];
  issues: DxfIssue[];
  stats: DxfStats;
  score: number;
  headerSection: string;
  tailSection: string;
  totalPerimeter?: number;
  openLoopCount?: number;
  processingTimeMs?: number;
  originalFileSize?: number;
  processedFileSize?: number;
  sizeReductionPercent?: number;
  manufacturing?: ManufacturingScan;
}
export type ManufacturingCategory = "confirmed" | "potential" | "safe";

/** Phase 3: manufacturing classification types — detection/classification only. */
export type ManufacturingType =
  | "near_gap"
  | "isolated_open_geometry"
  | "duplicate"
  | "overlap"
  | "tiny_geometry"
  | "stray_geometry"
  | "self_intersection";

export interface ManufacturingFinding {
  id: string;
  category: ManufacturingCategory;
  type: ManufacturingType;
  severity: "error" | "warning";
  confidence: number; // 0..1
  repairable: boolean; // whether an existing safe repair can handle it
  reason: string; // human-readable (en) classification rationale
  entityIndices: number[];
  detail?: string;
}

export interface ManufacturingScan {
  findings: ManufacturingFinding[];
  confirmedCount: number;
  potentialCount: number;
  safeCount: number;
  summary: string[];
}

export interface FixSummaryItem {
  id: string;
  icon: string;
  ar: string;
  en: string;
  detail: string;
}

import {
  cleanupEntities,
  closeSafeGaps,
  removeResidues,
  DEFAULT_CLEANUP_OPTIONS,
  detectOpenPaths,
  effectiveTinyTolerance,
} from "./dxf-cleanup";
import { classifyManufacturing } from "./manufacturing";

function parseGroups(content: string): DxfGroup[] {
  // Trim leading/trailing blank lines first. A leftover "\n" before the first
  // code line (e.g. the newline right after the "ENTITIES" header) would shift
  // the (code, value) pairing by one line and mis-decode every entity.
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  const groups: DxfGroup[] = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (!isNaN(code)) {
      groups.push({ code, value: lines[i + 1]?.trim() ?? "" });
    }
  }
  return groups;
}

function groupsToLines(groups: DxfGroup[]): string {
  return groups.map((g) => `${g.code}\n${g.value}`).join("\n");
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function lineKey(e: DxfEntity, tol = 1e-6): string {
  const x1 = Math.round((e.x1 ?? 0) / tol) * tol;
  const y1 = Math.round((e.y1 ?? 0) / tol) * tol;
  const x2 = Math.round((e.x2 ?? 0) / tol) * tol;
  const y2 = Math.round((e.y2 ?? 0) / tol) * tol;
  const a = `${x1},${y1}`;
  const b = `${x2},${y2}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function snapOpenEndpoints(entities: DxfEntity[], tolerance: number = 0.001): DxfEntity[] {
  // Collect all endpoint positions
  const endpoints: { x: number; y: number; entityIndex: number; isStart: boolean }[] = [];

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.type === "LINE") {
      endpoints.push({ x: e.x1 ?? 0, y: e.y1 ?? 0, entityIndex: i, isStart: true });
      endpoints.push({ x: e.x2 ?? 0, y: e.y2 ?? 0, entityIndex: i, isStart: false });
    } else if (
      (e.type === "LWPOLYLINE" || e.type === "POLYLINE") &&
      e.vertices &&
      e.vertices.length > 0
    ) {
      endpoints.push({ x: e.vertices[0].x, y: e.vertices[0].y, entityIndex: i, isStart: true });
      const last = e.vertices[e.vertices.length - 1];
      if (!e.closed) {
        endpoints.push({ x: last.x, y: last.y, entityIndex: i, isStart: false });
      }
    }
  }

  // For each endpoint, find nearest neighbor and snap
  const snapped = new Map<string, { x: number; y: number }>();
  const matched = new Set<number>();

  for (let i = 0; i < endpoints.length; i++) {
    if (matched.has(i)) continue;
    let nearestDist = tolerance;
    let nearestIdx = -1;
    for (let j = i + 1; j < endpoints.length; j++) {
      if (matched.has(j)) continue;
      const d = dist(endpoints[i].x, endpoints[i].y, endpoints[j].x, endpoints[j].y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = j;
      }
    }
    if (nearestIdx >= 0) {
      // Snap both endpoints to their midpoint (or to the first point)
      const avgX = (endpoints[i].x + endpoints[nearestIdx].x) / 2;
      const avgY = (endpoints[i].y + endpoints[nearestIdx].y) / 2;
      const key1 = `${endpoints[i].entityIndex}-${endpoints[i].isStart ? "start" : "end"}`;
      const key2 = `${endpoints[nearestIdx].entityIndex}-${endpoints[nearestIdx].isStart ? "start" : "end"}`;
      snapped.set(key1, { x: avgX, y: avgY });
      snapped.set(key2, { x: avgX, y: avgY });
      matched.add(i);
      matched.add(nearestIdx);
    }
  }

  // Apply snapped positions to a copy of entities
  return entities.map((e, idx) => {
    let entity = { ...e };
    if (entity.type === "LINE") {
      const startKey = `${idx}-start`;
      const endKey = `${idx}-end`;
      if (snapped.has(startKey)) {
        entity = { ...entity, x1: snapped.get(startKey)!.x, y1: snapped.get(startKey)!.y };
      }
      if (snapped.has(endKey)) {
        entity = { ...entity, x2: snapped.get(endKey)!.x, y2: snapped.get(endKey)!.y };
      }
    } else if ((entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") && entity.vertices) {
      const startKey = `${idx}-start`;
      const endKey = `${idx}-end`;
      const verts = [...entity.vertices];
      if (snapped.has(startKey) && verts.length > 0) {
        verts[0] = { ...verts[0], x: snapped.get(startKey)!.x, y: snapped.get(startKey)!.y };
      }
      if (snapped.has(endKey) && verts.length > 0) {
        verts[verts.length - 1] = {
          ...verts[verts.length - 1],
          x: snapped.get(endKey)!.x,
          y: snapped.get(endKey)!.y,
        };
      }
      entity = { ...entity, vertices: verts };
    }
    return entity;
  });
}

/**
 * Structural Purge & Cleanup: Strip unused blocks, empty layers, duplicate text,
 * and redundant vector lines from the output.
 */
export function structuralPurge(analysis: DxfAnalysis): {
  purgedEntities: DxfEntity[];
  purgedCount: number;
  sizeReductionPercent: number;
} {
  const entities = analysis.entities;
  const keptEntities: DxfEntity[] = [];
  let purgedCount = 0;

  // Track which layers actually have geometry
  const usedLayers = new Set<string>();
  for (const e of entities) {
    if (e.type !== "BLOCK" && e.type !== "TEXT" && e.type !== "MTEXT") {
      usedLayers.add(e.layer);
    }
  }

  // Filter out BLOCK entities, empty-layer entities, TEXT/MTEXT, and zero-length lines
  for (const e of entities) {
    // Skip BLOCK definitions
    if (e.type === "BLOCK" || e.type === "ENDBLK") {
      purgedCount++;
      continue;
    }
    // Skip TEXT/MTEXT entities
    if (e.type === "TEXT" || e.type === "MTEXT") {
      purgedCount++;
      continue;
    }
    // Skip entities on layers with no real geometry (unused BLOCK layers etc)
    if (!usedLayers.has(e.layer) && e.type !== "LAYER") {
      purgedCount++;
      continue;
    }
    // Skip zero-length entities
    if (e.type === "LINE") {
      const len = dist(e.x1 ?? 0, e.y1 ?? 0, e.x2 ?? 0, e.y2 ?? 0);
      if (len < 0.001) {
        purgedCount++;
        continue;
      }
    }
    keptEntities.push(e);
  }

  const originalCount = entities.length;
  const newCount = keptEntities.length;
  const reductionRatio = originalCount > 0 ? (originalCount - newCount) / originalCount : 0;
  const sizeReductionPercent = Math.round(reductionRatio * 100);

  return { purgedEntities: keptEntities, purgedCount, sizeReductionPercent };
}

/**
 * Calculate the total geometric length (perimeter) of all entities in millimeters.
 * Assumes 1 drawing unit = 1 mm for DXF files.
 */
export function calculateTotalPerimeter(entities: DxfEntity[]): number {
  let total = 0;

  for (const e of entities) {
    if (e.type === "LINE") {
      total += dist(e.x1 ?? 0, e.y1 ?? 0, e.x2 ?? 0, e.y2 ?? 0);
    } else if (e.type === "CIRCLE") {
      const r = e.radius ?? 0;
      total += 2 * Math.PI * r;
    } else if (e.type === "ARC") {
      const r = e.radius ?? 0;
      const start = ((e.startAngle ?? 0) * Math.PI) / 180;
      const end = ((e.endAngle ?? 0) * Math.PI) / 180;
      let sweep = end - start;
      if (sweep < 0) sweep += 2 * Math.PI;
      total += r * sweep;
    } else if (
      (e.type === "LWPOLYLINE" || e.type === "POLYLINE") &&
      e.vertices &&
      e.vertices.length > 1
    ) {
      for (let i = 0; i < e.vertices.length - 1; i++) {
        total += dist(e.vertices[i].x, e.vertices[i].y, e.vertices[i + 1].x, e.vertices[i + 1].y);
      }
      if (e.closed) {
        const first = e.vertices[0];
        const last = e.vertices[e.vertices.length - 1];
        total += dist(first.x, first.y, last.x, last.y);
      }
    } else if (e.type === "SPLINE" && e.vertices && e.vertices.length > 1) {
      // SPLINE length approximated by the control/fit-point chain (chord sum).
      // Without this, spline-heavy drawings reported 0 length → 0 time & 0 cost.
      for (let i = 0; i < e.vertices.length - 1; i++) {
        total += dist(e.vertices[i].x, e.vertices[i].y, e.vertices[i + 1].x, e.vertices[i + 1].y);
      }
      if (e.closed) {
        const first = e.vertices[0];
        const last = e.vertices[e.vertices.length - 1];
        total += dist(first.x, first.y, last.x, last.y);
      }
    } else if (e.type === "ELLIPSE" && e.radius != null) {
      // ELLIPSE perimeter via Ramanujan's approximation (a = major, b = minor).
      const a = e.radius;
      const b = a * Math.min(e.ratio ?? 1, 1);
      if (a > 0 && b > 0) {
        const h = ((a - b) * (a - b)) / ((a + b) * (a + b));
        const fullPerimeter = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
        // Scale by sweep for partial ellipses (start/end angles stored in degrees).
        const start = ((e.startAngle ?? 0) * Math.PI) / 180;
        const end = ((e.endAngle ?? 360) * Math.PI) / 180;
        let sweep = Math.abs(end - start);
        if (sweep < 0.01) sweep = 2 * Math.PI;
        total += (fullPerimeter * Math.min(sweep, 2 * Math.PI)) / (2 * Math.PI);
      }
    }
  }

  return total;
}

/**
 * Detect open loops - vertices that fail to connect to other geometry
 */
export function detectOpenLoops(
  entities: DxfEntity[],
  minGap: number = 0.1,
): { count: number; openPoints: { x: number; y: number }[] } {
  const endpoints: { x: number; y: number }[] = [];
  const openPoints: { x: number; y: number }[] = [];
  const TOLERANCE = 0.1;

  // Collect all endpoints from lines and polylines
  for (const e of entities) {
    if (e.type === "LINE") {
      endpoints.push({ x: e.x1 ?? 0, y: e.y1 ?? 0 });
      endpoints.push({ x: e.x2 ?? 0, y: e.y2 ?? 0 });
    } else if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices) {
      if (e.vertices.length > 0) {
        endpoints.push({ x: e.vertices[0].x, y: e.vertices[0].y });
        const last = e.vertices[e.vertices.length - 1];
        if (!e.closed) {
          endpoints.push({ x: last.x, y: last.y });
        }
      }
    } else if (e.type === "ARC" || e.type === "CIRCLE") {
      // Arcs and circles are closed by nature
    }
  }

  // For each endpoint, check if there's another endpoint nearby
  const matched = new Set<number>();
  for (let i = 0; i < endpoints.length; i++) {
    if (matched.has(i)) continue;
    let foundMatch = false;
    let minDist = Infinity;
    for (let j = i + 1; j < endpoints.length; j++) {
      if (matched.has(j)) continue;
      const d = dist(endpoints[i].x, endpoints[i].y, endpoints[j].x, endpoints[j].y);
      if (d < minDist) minDist = d;
      if (d < TOLERANCE) {
        matched.add(i);
        matched.add(j);
        foundMatch = true;
        break;
      }
    }
    // Only count as "open" if the nearest endpoint is >= minGap
    if (!foundMatch && minDist >= minGap) {
      openPoints.push(endpoints[i]);
    }
  }

  return { count: openPoints.length, openPoints };
}

/**
 * Sort entities so that inner contours (smaller) are processed BEFORE outer boundaries.
 * Uses bounding box area as heuristic: smaller area = inner contour.
 */
export function sortInsideFirst(entities: DxfEntity[]): DxfEntity[] {
  return [...entities].sort((a, b) => {
    const boundsA = getEntityBounds(a);
    const boundsB = getEntityBounds(b);
    if (!boundsA) return 1;
    if (!boundsB) return -1;
    const areaA = boundsA.width * boundsA.height;
    const areaB = boundsB.width * boundsB.height;
    return areaA - areaB;
  });
}

function getEntityBounds(e: DxfEntity): { width: number; height: number } | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let found = false;

  function expand(x: number, y: number) {
    found = true;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  if (e.type === "LINE") {
    expand(e.x1 ?? 0, e.y1 ?? 0);
    expand(e.x2 ?? 0, e.y2 ?? 0);
  } else if (e.type === "CIRCLE" || e.type === "ARC") {
    const cx = e.cx ?? 0,
      cy = e.cy ?? 0,
      r = e.radius ?? 0;
    expand(cx - r, cy - r);
    expand(cx + r, cy + r);
  } else if (e.type === "LWPOLYLINE" && e.vertices) {
    for (const v of e.vertices) expand(v.x, v.y);
  }

  if (!found) return null;
  return { width: maxX - minX, height: maxY - minY };
}

export function analyzeDxf(content: string, snapTolerance: number = 0.001): DxfAnalysis {
  const startTime = performance.now();
  const originalFileSize = new Blob([content]).size;

  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const entitiesMatch = normalized.match(
    /\s*0\s*\nSECTION\s*\n\s*2\s*\nENTITIES([\s\S]*?)\s*0\s*\nENDSEC/i,
  );
  const headerEnd = entitiesMatch ? normalized.indexOf(entitiesMatch[0]) : normalized.length;
  const headerSection = normalized.slice(0, headerEnd);
  const tailStart = entitiesMatch
    ? normalized.indexOf(entitiesMatch[0]) + entitiesMatch[0].length
    : normalized.length;
  const tailSection = normalized.slice(tailStart);

  const entitiesRaw = (entitiesMatch ? entitiesMatch[1] : "").trim();
  const entities: DxfEntity[] = [];

  // Split the ENTITIES section into entity blocks using the parsed group
  // pairs (code/value). Splitting by raw lines is WRONG: a value line that
  // happens to be "0" (layer "0", coordinate 0, ...) would otherwise be
  // mistaken for a new entity start, fragmenting every LINE/ARC/etc. into
  // bogus "62"/"11"/"21" pseudo-entities and corrupting the whole analysis.
  const allGroups = parseGroups(entitiesRaw);
  const entityBlocks: string[] = [];
  let current: string[] = [];
  // Legacy (AC1009) POLYLINE structures span multiple records
  // (POLYLINE -> VERTEX ... -> SEQEND). Fold the VERTEX / SEQEND records into
  // the one logical POLYLINE block so the parser can attach its vertices.
  let inLegacyPolyline = false;

  const flushBlock = () => {
    if (current.length > 0) {
      entityBlocks.push(current.join("\n"));
      current = [];
    }
    inLegacyPolyline = false;
  };

  for (const g of allGroups) {
    if (g.code !== 0) {
      current.push(`${g.code}\n${g.value}`);
      continue;
    }
    const t = (g.value || "").toUpperCase();
    if (t === "POLYLINE") {
      flushBlock();
      inLegacyPolyline = true;
      current.push(`${g.code}\n${g.value}`);
      continue;
    }
    if (t === "VERTEX" && inLegacyPolyline) {
      // VERTEX sub-record belongs to the open legacy POLYLINE — fold it in
      current.push(`${g.code}\n${g.value}`);
      continue;
    }
    if (t === "SEQEND" && inLegacyPolyline) {
      // Legacy POLYLINE terminator — closes the block
      current.push(`${g.code}\n${g.value}`);
      flushBlock();
      continue;
    }
    flushBlock();
    current.push(`${g.code}\n${g.value}`);
  }
  flushBlock();

  for (const block of entityBlocks) {
    const groups = parseGroups(block.trim());
    if (!groups.length) continue;
    const typeGroup = groups.find((g) => g.code === 0);
    if (!typeGroup) continue;
    const type = typeGroup.value.toUpperCase();
    if (type === "ENDSEC" || type === "SECTION") continue;

    const entity: DxfEntity = {
      type,
      layer: groups.find((g) => g.code === 8)?.value ?? "0",
      handle: groups.find((g) => g.code === 5)?.value ?? "",
      rawLines: block.trim().split("\n"),
    };

    if (type === "LINE") {
      entity.x1 = parseFloat(groups.find((g) => g.code === 10)?.value ?? "0");
      entity.y1 = parseFloat(groups.find((g) => g.code === 20)?.value ?? "0");
      entity.z1 = parseFloat(groups.find((g) => g.code === 30)?.value ?? "0");
      entity.x2 = parseFloat(groups.find((g) => g.code === 11)?.value ?? "0");
      entity.y2 = parseFloat(groups.find((g) => g.code === 21)?.value ?? "0");
      entity.z2 = parseFloat(groups.find((g) => g.code === 31)?.value ?? "0");
    } else if (type === "ARC") {
      entity.cx = parseFloat(groups.find((g) => g.code === 10)?.value ?? "0");
      entity.cy = parseFloat(groups.find((g) => g.code === 20)?.value ?? "0");
      entity.radius = parseFloat(groups.find((g) => g.code === 40)?.value ?? "0");
      entity.startAngle = parseFloat(groups.find((g) => g.code === 50)?.value ?? "0");
      entity.endAngle = parseFloat(groups.find((g) => g.code === 51)?.value ?? "0");
    } else if (type === "CIRCLE") {
      entity.cx = parseFloat(groups.find((g) => g.code === 10)?.value ?? "0");
      entity.cy = parseFloat(groups.find((g) => g.code === 20)?.value ?? "0");
      entity.radius = parseFloat(groups.find((g) => g.code === 40)?.value ?? "0");
    } else if (type === "LWPOLYLINE") {
      const flagGroup = groups.find((g) => g.code === 70);
      const flags = parseInt(flagGroup?.value ?? "0", 10);
      entity.closed = (flags & 1) === 1;
      entity.vertexCount = parseInt(groups.find((g) => g.code === 90)?.value ?? "0", 10);
      entity.vertices = [];
      const xGroups = groups.filter((g) => g.code === 10);
      const yGroups = groups.filter((g) => g.code === 20);
      const bulgeGroups = groups.filter((g) => g.code === 42);
      for (let i = 0; i < xGroups.length; i++) {
        entity.vertices.push({
          x: parseFloat(xGroups[i].value),
          y: parseFloat(yGroups[i]?.value ?? "0"),
          bulge: i < bulgeGroups.length ? parseFloat(bulgeGroups[i].value) : 0,
        });
      }
    } else if (type === "POLYLINE") {
      // Legacy (AC1009) POLYLINE — the block splitter folded the VERTEX /
      // SEQEND sub-records into this block. Rebuild vertices from them so a
      // valid legacy POLYLINE never reports an empty vertex list.
      const flagGroup = groups.find((g) => g.code === 70);
      const flags = parseInt(flagGroup?.value ?? "0", 10);
      entity.closed = (flags & 1) === 1;
      entity.vertices = [];
      const raw = entity.rawLines ?? [];
      for (let r = 0; r + 1 < raw.length; r += 2) {
        const c = parseInt(raw[r].trim(), 10);
        const v = (raw[r + 1] || "").trim();
        if (c === 0 && v.toUpperCase() === "VERTEX") {
          let vx: number | undefined;
          let vy: number | undefined;
          let vBulge = 0;
          let k = r + 2;
          while (k + 1 < raw.length && parseInt(raw[k].trim(), 10) !== 0) {
            const cc = parseInt(raw[k].trim(), 10);
            const vv = raw[k + 1]?.trim() ?? "";
            if (cc === 10) vx = parseFloat(vv);
            else if (cc === 20) vy = parseFloat(vv);
            else if (cc === 42) vBulge = parseFloat(vv);
            k += 2;
          }
          if (vx !== undefined && vy !== undefined) {
            entity.vertices.push({ x: vx, y: vy, bulge: vBulge });
          }
        } else if (c === 0 && v.toUpperCase() === "SEQEND") {
          break;
        }
      }
      entity.vertexCount = entity.vertices.length;
    } else if (type === "VERTEX") {
      // VERTEX entity for POLYLINE — coordinates in codes 10,20,30; bulge in 42
      const x = parseFloat(groups.find((g) => g.code === 10)?.value ?? "NaN");
      const y = parseFloat(groups.find((g) => g.code === 20)?.value ?? "NaN");
      const bulge = parseFloat(groups.find((g) => g.code === 42)?.value ?? "0");
      if (!isNaN(x) && !isNaN(y)) {
        entity.vertices = entity.vertices || [];
        entity.vertices.push({ x, y, bulge });
      }
    } else if (type === "SPLINE") {
      // SPLINE — control points or fit points
      const flagGroup = groups.find((g) => g.code === 70);
      entity.closed = flagGroup && (parseInt(flagGroup.value, 10) & 1) === 1 ? true : false;
      entity.vertices = [];
      const xGroups = groups.filter((g) => g.code === 10);
      const yGroups = groups.filter((g) => g.code === 20);
      // Control points
      const ctrlX = groups.filter((g) => g.code === 11);
      const ctrlY = groups.filter((g) => g.code === 21);
      const fitX = groups.filter((g) => g.code === 12);
      const fitY = groups.filter((g) => g.code === 22);
      // Prefer fit points, then control points, then raw 10/20 coords
      const useX = fitX.length > 0 ? fitX : ctrlX.length > 0 ? ctrlX : xGroups;
      const useY = fitY.length > 0 ? fitY : ctrlY.length > 0 ? ctrlY : yGroups;
      for (let i = 0; i < useX.length; i++) {
        entity.vertices.push({
          x: parseFloat(useX[i].value),
          y: parseFloat(useY[i % useY.length]?.value ?? "0"),
        });
      }
    } else if (type === "ELLIPSE") {
      // ELLIPSE — center (10,20), major axis endpoint (11,21), axis ratio (40), start/end param (41,42)
      const cx = parseFloat(groups.find((g) => g.code === 10)?.value ?? "0");
      const cy = parseFloat(groups.find((g) => g.code === 20)?.value ?? "0");
      const mx = parseFloat(groups.find((g) => g.code === 11)?.value ?? "0");
      const my = parseFloat(groups.find((g) => g.code === 21)?.value ?? "0");
      const ratio = parseFloat(groups.find((g) => g.code === 40)?.value ?? "1");
      const startParam = parseFloat(groups.find((g) => g.code === 41)?.value ?? "0");
      const endParam = parseFloat(groups.find((g) => g.code === 42)?.value ?? String(2 * Math.PI));
      // Store as approximation points for preview
      entity.cx = cx;
      entity.cy = cy;
      entity.radius = Math.sqrt(mx * mx + my * my);
      entity.ratio = ratio > 0 ? Math.min(ratio, 1) : 1;
      entity.startAngle = (startParam * 180) / Math.PI;
      entity.endAngle = endParam === 2 * Math.PI ? 360 : (endParam * 180) / Math.PI;
      // For bounds, use center +/- major axis
      entity.x1 = cx - entity.radius;
      entity.y1 = cy - entity.radius;
      entity.x2 = cx + entity.radius;
      entity.y2 = cy + entity.radius;
    } else if (type === "INSERT") {
      // BLOCK reference — we store the block name and insertion point for bounds
      entity.cx = parseFloat(groups.find((g) => g.code === 10)?.value ?? "0");
      entity.cy = parseFloat(groups.find((g) => g.code === 20)?.value ?? "0");
    } else if (type === "POINT") {
      // POINT entity — has 10/20 codes
      entity.x1 = parseFloat(groups.find((g) => g.code === 10)?.value ?? "0");
      entity.y1 = parseFloat(groups.find((g) => g.code === 20)?.value ?? "0");
      entity.x2 = entity.x1;
      entity.y2 = entity.y1;
    } else if (type === "SOLID") {
      // SOLID (3D or 2D filled area) — has 4 corners: 10/20, 11/21, 12/22, 13/23
      const corners: { x: number; y: number }[] = [];
      for (const code of [10, 11, 12, 13]) {
        const x = parseFloat(groups.find((g) => g.code === code)?.value ?? "NaN");
        const y = parseFloat(groups.find((g) => g.code === code + 10)?.value ?? "NaN");
        if (!isNaN(x) && !isNaN(y)) corners.push({ x, y });
      }
      if (corners.length >= 2) {
        entity.vertices = corners;
        entity.x1 = corners[0].x;
        entity.y1 = corners[0].y;
        entity.x2 = corners[corners.length - 1].x;
        entity.y2 = corners[corners.length - 1].y;
      }
    } else if (type === "3DFACE") {
      // 3DFACE — has 4 corners: 10/20, 11/21, 12/22, 13/23
      const corners: { x: number; y: number }[] = [];
      for (const code of [10, 11, 12, 13]) {
        const x = parseFloat(groups.find((g) => g.code === code)?.value ?? "NaN");
        const y = parseFloat(groups.find((g) => g.code === code + 10)?.value ?? "NaN");
        if (!isNaN(x) && !isNaN(y)) corners.push({ x, y });
      }
      if (corners.length >= 2) {
        entity.vertices = corners;
        entity.x1 = corners[0].x;
        entity.y1 = corners[0].y;
        entity.x2 = corners[corners.length - 1].x;
        entity.y2 = corners[corners.length - 1].y;
      }
    } else if (type === "HATCH") {
      // HATCH boundaries — store for possible preview
      entity.cx = parseFloat(groups.find((g) => g.code === 10)?.value ?? "0");
      entity.cy = parseFloat(groups.find((g) => g.code === 20)?.value ?? "0");
    } else if (type === "DIMENSION") {
      // DIMENSION — definition point at 10/20, text midpoint at 11/21, etc.
      entity.x1 = parseFloat(groups.find((g) => g.code === 10)?.value ?? "0");
      entity.y1 = parseFloat(groups.find((g) => g.code === 20)?.value ?? "0");
      const dimX2Str = groups.find((g) => g.code === 14)?.value;
      entity.x2 = dimX2Str ? parseFloat(dimX2Str) : (entity.x1 ?? 0);
      const dimY2Str = groups.find((g) => g.code === 24)?.value;
      entity.y2 = dimY2Str ? parseFloat(dimY2Str) : (entity.y1 ?? 0);
    }
    entities.push(entity);
  }

  // Apply fuzzy node snapping before analysis
  const snappedEntities = snapOpenEndpoints(entities, snapTolerance);

  const issues: DxfIssue[] = [];
  const TINY = 0.01;

  const lineSeenKeys = new Map<string, number>();
  const duplicateIndices: number[] = [];
  for (let i = 0; i < snappedEntities.length; i++) {
    const e = snappedEntities[i];
    if (e.type !== "LINE") continue;
    const len = dist(e.x1 ?? 0, e.y1 ?? 0, e.x2 ?? 0, e.y2 ?? 0);
    if (len < TINY) {
      issues.push({
        id: `zero_${i}`,
        type: "zero_length",
        severity: "error",
        ar: `خط طوله صفر في طبقة "${e.layer}"`,
        en: `Zero-length line on layer "${e.layer}"`,
        entityIndices: [i],
        fixed: false,
      });
      continue;
    }
    if (len < TINY * 10) {
      issues.push({
        id: `tiny_${i}`,
        type: "tiny_entity",
        severity: "warning",
        ar: `خط صغير جداً (${len.toFixed(4)}) في طبقة "${e.layer}"`,
        en: `Tiny line (${len.toFixed(4)}) on layer "${e.layer}"`,
        entityIndices: [i],
        fixed: false,
      });
    }
    const key = lineKey(e);
    if (lineSeenKeys.has(key)) {
      const prev = lineSeenKeys.get(key)!;
      if (!duplicateIndices.includes(prev)) duplicateIndices.push(prev);
      duplicateIndices.push(i);
    } else {
      lineSeenKeys.set(key, i);
    }
  }

  if (duplicateIndices.length > 0) {
    const unique = [...new Set(duplicateIndices)];
    issues.push({
      id: "duplicates",
      type: "duplicate_line",
      severity: "error",
      ar: `${Math.floor(unique.length / 2)} خط مكرر — سيسبب مسارات مزدوجة على الماكينة`,
      en: `${Math.floor(unique.length / 2)} duplicate line(s) — will cause double-cutting`,
      entityIndices: unique,
      fixed: false,
    });
  }

  for (let i = 0; i < snappedEntities.length; i++) {
    const e = snappedEntities[i];
    if ((e.type !== "LWPOLYLINE" && e.type !== "POLYLINE") || !e.vertices || e.vertices.length < 2)
      continue;
    if (e.closed) continue;
    const first = e.vertices[0];
    const last = e.vertices[e.vertices.length - 1];
    // Phase 8 (Bug: gap under-report): measure the TRUE Euclidean endpoint
    // gap. The previous call passed `last.y` as the first point's y, which
    // reduced the "gap" to the horizontal component only and under-reported
    // real open contours (real-world 266.dxf: reported 0.023 vs actual 0.026).
    const gap = dist(first.x, first.y, last.x, last.y);
    if (gap > TINY) {
      issues.push({
        id: `open_poly_${i}`,
        type: "open_polyline",
        severity: "error",
        ar: `بوليلاين مفتوح (فجوة ${gap.toFixed(3)}) في طبقة "${e.layer}"`,
        en: `Open polyline (gap ${gap.toFixed(3)}) on layer "${e.layer}"`,
        entityIndices: [i],
        fixed: false,
      });
    }
  }

  // Detect open endpoints — UNIFIED WITH THE PREVIEW ENGINE (v1.2 consistency fix).
  // The SVG preview (tool.tsx) uses detectOpenPaths from dxf-cleanup, which covers
  // LINE + open POLYLINE + ARC endpoints and measures the true Euclidean gap.
  // The old detectOpenLoops pass ignored ARC endpoints entirely, so the report
  // claimed "0 issues / score 100" while the preview highlighted hundreds of open
  // arc endpoints (real-world bug: 346 red dots vs score 100). From now on BOTH
  // surfaces derive from the SAME engine and the SAME threshold:
  //   gap <  0.1mm → engine auto-closes it (not reported)
  //   gap >= 0.1mm → real open geometry, reported AND drawn as a red dot
  const MANUAL_REPAIR_GAP = 0.1;
  const openPathInfos = detectOpenPaths(snappedEntities, DEFAULT_CLEANUP_OPTIONS);
  const manualRepairPaths = openPathInfos.filter((p) => p.gap >= MANUAL_REPAIR_GAP);
  const openLoopCount = manualRepairPaths.length;
  if (openLoopCount > 0) {
    issues.push({
      id: "open_loops",
      type: "open_loop",
      severity: "error",
      ar: `${openLoopCount} نقطة مفتوحة (فجوة ≥ 0.1مم) — يجب إغلاقها قبل القص`,
      en: `${openLoopCount} open endpoint(s) (gap ≥ 0.1mm) — must be closed before cutting`,
      entityIndices: [...new Set(manualRepairPaths.map((p) => p.entityIndex))],
      fixed: false,
    });
  }

  const layerSet = new Set(snappedEntities.map((e) => e.layer));
  const layers = [...layerSet];

  // VERTEX / SEQEND are bookkeeping records of legacy POLYLINEs, not standalone
  // geometry — they must not be counted as entities or reported as geometry.
  const geometryEntities = snappedEntities.filter(
    (e) => e.type !== "VERTEX" && e.type !== "SEQEND",
  );

  const stats: DxfStats = {
    totalEntities: geometryEntities.length,
    lines: geometryEntities.filter((e) => e.type === "LINE").length,
    polylines: geometryEntities.filter((e) => e.type === "LWPOLYLINE" || e.type === "POLYLINE")
      .length,
    arcs: geometryEntities.filter((e) => e.type === "ARC").length,
    circles: geometryEntities.filter((e) => e.type === "CIRCLE").length,
    others: geometryEntities.filter(
      (e) => !["LINE", "LWPOLYLINE", "POLYLINE", "ARC", "CIRCLE"].includes(e.type),
    ).length,
    layers,
    originalFileSize,
    processingTimeMs: 0,
  };

  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "error") {
      if (issue.type === "duplicate_line") score -= Math.min(40, issue.entityIndices.length * 3);
      else if (issue.type === "open_polyline") score -= 15;
      else if (issue.type === "zero_length") score -= 5;
      // open_loop is now ONE aggregated error whose entityIndices hold every
      // affected entity — scale the penalty with the real open-endpoint count.
      else if (issue.type === "open_loop") score -= Math.min(60, issue.entityIndices.length * 2);
    } else {
      score -= 3;
    }
  }
  if (snappedEntities.length === 0) score = 0;
  score = Math.max(0, Math.min(100, score));

  const totalPerimeter = calculateTotalPerimeter(snappedEntities);
  const endTime = performance.now();
  const processingTimeMs = Math.round(endTime - startTime);

  // Perform structural purge to calculate reduction
  const tempAnalysis: DxfAnalysis = {
    entities: snappedEntities,
    issues,
    stats,
    score,
    headerSection,
    tailSection,
    totalPerimeter,
    openLoopCount,
  };
  const { sizeReductionPercent } = structuralPurge(tempAnalysis);

  // Phase 3: manufacturing classification layer (detect/classify only — no repair).
  const mfg = classifyManufacturing(snappedEntities);

  return {
    entities: snappedEntities,
    issues,
    stats: {
      ...stats,
      processingTimeMs,
      sizeReductionPercent,
    },
    score,
    headerSection,
    tailSection,
    totalPerimeter,
    openLoopCount,
    processingTimeMs,
    originalFileSize,
    sizeReductionPercent,
    manufacturing: mfg,
  };
}

/**
 * تحويل ARC إلى LWPOLYLINE
 */
function convertArcToPolyline(e: DxfEntity): DxfEntity {
  const cx = e.cx ?? 0,
    cy = e.cy ?? 0,
    r = e.radius ?? 0;
  const startAngle = ((e.startAngle ?? 0) * Math.PI) / 180;
  const endAngle = ((e.endAngle ?? 0) * Math.PI) / 180;
  let sweep = endAngle - startAngle;
  if (sweep < 0) sweep += 2 * Math.PI;

  const segments = 24; // عدد المقاطع لتقريب القوس
  const vertices: DxfVertex[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + (sweep * i) / segments;
    vertices.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }

  return {
    type: "LWPOLYLINE",
    layer: e.layer,
    handle: e.handle,
    rawLines: e.rawLines,
    vertices,
    closed: false,
    vertexCount: vertices.length,
  };
}

/**
 * تحويل CIRCLE إلى LWPOLYLINE
 */
function convertCircleToPolyline(e: DxfEntity): DxfEntity {
  const cx = e.cx ?? 0,
    cy = e.cy ?? 0,
    r = e.radius ?? 0;
  const segments = 36;
  const vertices: DxfVertex[] = [];

  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    vertices.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }

  return {
    type: "LWPOLYLINE",
    layer: e.layer,
    handle: e.handle,
    rawLines: e.rawLines,
    vertices,
    closed: true,
    vertexCount: vertices.length,
  };
}

/**
 * تحويل SPLINE إلى LWPOLYLINE
 */
function convertSplineToPolyline(e: DxfEntity): DxfEntity {
  if (!e.vertices || e.vertices.length < 2) return e;

  // تبسيط نقاط SPLINE باستخدام خوارزمية RDP
  const points = e.vertices.map((v) => ({ x: v.x, y: v.y }));
  const simplified = simplifyRDP(points, 0.05);
  const vertices: DxfVertex[] = simplified.map((p) => ({ x: p.x, y: p.y }));

  return {
    type: "LWPOLYLINE",
    layer: e.layer,
    handle: e.handle,
    rawLines: e.rawLines,
    vertices,
    closed: e.closed ?? false,
    vertexCount: vertices.length,
  };
}

/**
 * تحويل ELLIPSE إلى LWPOLYLINE
 */
function convertEllipseToPolyline(e: DxfEntity): DxfEntity {
  const cx = e.cx ?? 0,
    cy = e.cy ?? 0;
  const r = e.radius ?? 1;
  const rx = r;
  const ry = r * 0.6; // approximate ratio
  const startAngle = ((e.startAngle ?? 0) * Math.PI) / 180;
  const endAngle = ((e.endAngle ?? 0) * Math.PI) / 180;
  let sweep = endAngle - startAngle;
  if (sweep <= 0) sweep += 2 * Math.PI;

  const segments = 36;
  const vertices: DxfVertex[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = startAngle + (sweep * i) / segments;
    vertices.push({
      x: cx + rx * Math.cos(t),
      y: cy + ry * Math.sin(t),
    });
  }

  const isFullEllipse = Math.abs(sweep - 2 * Math.PI) < 0.01;

  return {
    type: "LWPOLYLINE",
    layer: e.layer,
    handle: e.handle,
    rawLines: e.rawLines,
    vertices,
    closed: isFullEllipse,
    vertexCount: vertices.length,
  };
}

/**
 * نسخة مبسطة من simplifyRDP لتجنب مشاكل الاستيراد
 */
function simplifyRDP(
  points: { x: number; y: number }[],
  tolerance: number,
): { x: number; y: number }[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDist(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyRDP(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyRDP(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDist(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len);
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

/**
 * تحويل جميع الكيانات إلى LWPOLYLINE
 * ARCS → POLYLINE, CIRCLES → POLYLINE, SPLINES → POLYLINE, ELLIPSES → POLYLINE
 */
function convertAllToPolylines(entities: DxfEntity[]): {
  converted: DxfEntity[];
  convertCount: number;
} {
  const result: DxfEntity[] = [];
  let convertCount = 0;

  for (const e of entities) {
    if (e.type === "ARC") {
      result.push(convertArcToPolyline(e));
      convertCount++;
    } else if (e.type === "CIRCLE") {
      result.push(convertCircleToPolyline(e));
      convertCount++;
    } else if (e.type === "SPLINE") {
      result.push(convertSplineToPolyline(e));
      convertCount++;
    } else if (e.type === "ELLIPSE") {
      result.push(convertEllipseToPolyline(e));
      convertCount++;
    } else {
      result.push(e);
    }
  }

  return { converted: result, convertCount };
}

/**
 * دمج المسارات المتصلة في مسار واحد
 * يستخدم خوارزمية مشابهة لـ path-union.ts لكن بدون استيراد
 */
function joinConnectedEntities(entities: DxfEntity[]): { joined: DxfEntity[]; joinCount: number } {
  const tolerance = 0.01;
  const used = new Set<number>();
  const result: DxfEntity[] = [];
  let joinCount = 0;

  // أولاً: جمع كل المسارات المغلقة (Closed)
  for (let i = 0; i < entities.length; i++) {
    if (entities[i].type !== "LWPOLYLINE" || entities[i].closed) {
      result.push(entities[i]);
      used.add(i);
    }
  }

  // ثانياً: محاولة دمج المسارات المفتوحة
  let changed = true;
  const openIndices = entities
    .map((e, i) => ({ idx: i, used: used.has(i) }))
    .filter((e) => !e.used)
    .map((e) => e.idx);

  while (changed) {
    changed = false;
    for (let i = 0; i < openIndices.length; i++) {
      if (used.has(openIndices[i])) continue;
      const a = entities[openIndices[i]];
      const aVerts = a.vertices;
      if (!aVerts || aVerts.length < 2) continue;

      for (let j = i + 1; j < openIndices.length; j++) {
        if (used.has(openIndices[j])) continue;
        const b = entities[openIndices[j]];
        const bVerts = b.vertices;
        if (!bVerts || bVerts.length < 2) continue;

        const aStart = aVerts[0],
          aEnd = aVerts[aVerts.length - 1];
        const bStart = bVerts[0],
          bEnd = bVerts[bVerts.length - 1];

        let merged: DxfVertex[] | null = null;
        let mergedClosed = false;

        if (dist(aEnd.x, aEnd.y, bStart.x, bStart.y) < tolerance) {
          merged = [...aVerts, ...bVerts.slice(1)];
        } else if (dist(aEnd.x, aEnd.y, bEnd.x, bEnd.y) < tolerance) {
          merged = [...aVerts, ...bVerts.reverse().slice(1)];
        } else if (dist(aStart.x, aStart.y, bStart.x, bStart.y) < tolerance) {
          merged = [...aVerts.reverse(), ...bVerts.slice(1)];
        } else if (dist(aStart.x, aStart.y, bEnd.x, bEnd.y) < tolerance) {
          merged = [...bVerts, ...aVerts.slice(1)];
        }

        if (merged) {
          const mStart = merged[0],
            mEnd = merged[merged.length - 1];
          mergedClosed = dist(mStart.x, mStart.y, mEnd.x, mEnd.y) < tolerance;
          if (mergedClosed) merged = merged.slice(0, -1);

          entities[openIndices[i]] = {
            ...a,
            vertices: merged,
            closed: mergedClosed,
            vertexCount: merged.length,
          };
          used.add(openIndices[j]);
          joinCount++;
          changed = true;
          break;
        }
      }
    }
  }

  // إضافة المسارات المتبقية
  for (const idx of openIndices) {
    if (!used.has(idx)) {
      result.push(entities[idx]);
    }
  }

  return { joined: result, joinCount };
}

/**
 * Auto-fix: set closed flag to 1 for polylines that are geometrically
 * closed (gap < 0.1mm) but have the flag set to 0.
 * Also closes polylines whose first/last vertices are within 0.1mm.
 */
function closeAllPolylines(entities: DxfEntity[]): { closed: DxfEntity[]; closeCount: number } {
  // Threshold: gap < 0.1mm → geometrically closed → set flag to 1
  const GEOMETRIC_CLOSE_TOL = 0.1; // mm
  const snapTol = DEFAULT_CLEANUP_OPTIONS.tolerance;
  const result = entities.map((e) => {
    // Only LWPOLYLINE and legacy POLYLINE are closable.
    if (
      (e.type !== "LWPOLYLINE" && e.type !== "POLYLINE") ||
      e.closed ||
      !e.vertices ||
      e.vertices.length < 2
    )
      return e;
    // Ignore trailing vertices that merely duplicate the first (serialization
    // style), not proof of geometric closure. Measure from the last DISTINCT
    // vertex instead.
    let n = e.vertices.length - 1;
    while (
      n > 0 &&
      dist(e.vertices[n].x, e.vertices[n].y, e.vertices[0].x, e.vertices[0].y) <= snapTol
    )
      n--;
    const lastMeaningful = e.vertices[n];
    const gap = dist(e.vertices[0].x, e.vertices[0].y, lastMeaningful.x, lastMeaningful.y);
    if (gap > GEOMETRIC_CLOSE_TOL) return e; // genuinely open → PRESERVE open state
    return { ...e, closed: true };
  });

  const closeCount = result.filter((e, i) => e.closed && !entities[i].closed).length;
  return { closed: result, closeCount };
}

/**
 * إزالة النقاط المعلقة (Dangling Nodes) — نقاط منفردة لا تنتمي لأي مسار
 */
function removeDanglingNodes(entities: DxfEntity[]): {
  cleaned: DxfEntity[];
  removedCount: number;
} {
  // Phase 6A (Bug 2): scale-aware tiny threshold — a LINE shorter than the
  // drawing-relative tolerance is dangling; legitimate small geometry in
  // small-scale drawings is preserved. Unknown scale → 0 → only exact zeros.
  const tinyTol = effectiveTinyTolerance(entities);
  const result = entities.filter((e) => {
    if (e.type === "POINT") return false;
    if (e.type === "LINE") {
      const len = dist(e.x1 ?? 0, e.y1 ?? 0, e.x2 ?? 0, e.y2 ?? 0);
      return len > tinyTol;
    }
    if (e.type === "LWPOLYLINE") {
      // Only drop a lightweight polyline when the vertex list is positively
      // present and degenerate (fewer than 2 vertices). Unknown/absent vertex
      // representation is preserved (§7 safety).
      if (!e.vertices) return true;
      return e.vertices.length >= 2;
    }
    if (e.type === "POLYLINE") {
      // SAFETY (§7): NEVER delete a legacy POLYLINE merely because its vertex
      // list is unpopulated/uncertain — a valid legacy POLYLINE always carries
      // its VERTEX sub-records which the parser now reconstructs. If we cannot
      // positively establish it is empty geometry, PRESERVE it.
      return true;
    }
    return true;
  });

  return {
    cleaned: result,
    removedCount: entities.length - result.length,
  };
}

/**
 * إزالة العناصر المخفية (من طبقات محددة تبدأ بـ _ أو __)
 */
function removeHiddenLayers(entities: DxfEntity[]): { cleaned: DxfEntity[]; removedCount: number } {
  const result = entities.filter((e) => {
    const layer = e.layer || "";
    // إزالة الطبقات المخفية (تبدأ بـ _ أو __ أو HIDDEN أو DEFPOINTS)
    if (
      layer.startsWith("_") ||
      layer.startsWith("__") ||
      layer.toUpperCase() === "HIDDEN" ||
      layer.toUpperCase() === "DEFPOINTS"
    )
      return false;
    if (layer.toUpperCase().includes("HATCH") || layer.toUpperCase().includes("TEXT")) {
      // احتفظ بها إذا كانت تحتوي على عناصر
      return true;
    }
    return true;
  });

  return {
    cleaned: result,
    removedCount: entities.length - result.length,
  };
}

/**
 * تحسين مسار القص: ترتيب المسارات لتقليل حركة رأس الليزر
 */
function optimizeCutOrder(entities: DxfEntity[]): DxfEntity[] {
  // فصل المسارات المغلقة عن المفتوحة
  const closedPolylines: DxfEntity[] = [];
  const otherEntities: DxfEntity[] = [];

  for (const e of entities) {
    if (e.type === "LWPOLYLINE" && e.closed && e.vertices && e.vertices.length >= 2) {
      closedPolylines.push(e);
    } else {
      otherEntities.push(e);
    }
  }

  // ترتيب المسارات المغلقة حسب المساحة (من الأصغر إلى الأكبر = داخلي أولاً)
  closedPolylines.sort((a, b) => {
    const boundsA = getEntityBounds(a);
    const boundsB = getEntityBounds(b);
    const areaA = boundsA ? boundsA.width * boundsA.height : 0;
    const areaB = boundsB ? boundsB.width * boundsB.height : 0;
    return areaA - areaB;
  });

  // Nearest Neighbor لترتيب المسارات
  const ordered: DxfEntity[] = [];
  const remaining = new Set(closedPolylines);
  let currentX = 0,
    currentY = 0;

  while (remaining.size > 0) {
    let nearest: DxfEntity | null = null;
    let nearestDist = Infinity;

    for (const poly of remaining) {
      if (!poly.vertices || poly.vertices.length === 0) continue;
      const first = poly.vertices[0];
      const d = Math.sqrt((first.x - currentX) ** 2 + (first.y - currentY) ** 2);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = poly;
      }
    }

    if (nearest && nearest.vertices) {
      ordered.push(nearest);
      const last = nearest.vertices[nearest.vertices.length - 1];
      currentX = last.x;
      currentY = last.y;
      remaining.delete(nearest);
    } else {
      break;
    }
  }

  return [...ordered, ...otherEntities];
}

export interface RepairOptions {
  /**
   * Convert ARC/CIRCLE/SPLINE/ELLIPSE entities into POLYLINES.
   * Default: OFF — original geometry is PRESERVED (§19 of the master prompt).
   * The user must explicitly opt in for a manufacturing workflow that
   * requires every entity to be a polyline path.
   */
  convertCurvesToPolylines?: boolean;
  /**
   * Endpoint snap tolerance in drawing units (STEP 5).
   * Default: 0.001 (conservative — never destroy nearby-but-distinct geometry).
   */
  snapTolerance?: number;
  /**
   * Auto-close geometrically-closed polylines (STEP 7). Default: true.
   * When false, open polylines keep their open flag (user opt-out).
   */
  closeOpenPolylines?: boolean;
  /**
   * Close small endpoint gaps by EXTENDING the original strokes to their
   * meeting midpoint — NO new bridge entity is added (opt-in, default off
   * to keep the prior always-on repair behavior unchanged). This matches
   * dxfcleaner's "never adds geometry" guarantee for small gaps.
   */
  closeGapsByExtension?: boolean;
  /**
   * Selective OVERKILL cleanup (STEP 8). Provided keys override
   * DEFAULT_CLEANUP_OPTIONS; omitted keys keep the engine defaults.
   * Booleans set to false DISABLE that cleanup pass (processing checkboxes).
   */
  cleanup?: {
    tolerance?: number;
    gapTolerance?: number;
    removeZeroLength?: boolean;
    dedupeVertices?: boolean;
    mergeCollinearOverlaps?: boolean;
    dedupeCurves?: boolean;
    removeDanglingResidues?: boolean;
    residueTolerance?: number;
  };
}

/**
 * pipeline المعالجة الكامل
 */
export function repairDxf(
  content: string,
  analysis: DxfAnalysis,
  options: RepairOptions = {},
): { fixed: string; repaired: DxfIssue[]; fixSummary: FixSummaryItem[] } {
  const startTime = performance.now();
  const repairedIssues: DxfIssue[] = [];
  const fixSummary: FixSummaryItem[] = [];
  const originalSize = analysis.originalFileSize ?? new Blob([content]).size;

  // ─── STEP 1: Structural Purge ───
  const { purgedEntities, purgedCount } = structuralPurge(analysis);
  if (purgedCount > 0) {
    fixSummary.push({
      id: "structural_purge",
      icon: "🧹",
      ar: `تمت إزالة ${purgedCount} عنصر غير ضروري (كتل فارغة، نصوص مكررة، طبقات فارغة)`,
      en: `Removed ${purgedCount} unnecessary items (empty blocks, duplicate text, empty layers)`,
      detail: `تنظيف هيكلي للملف`,
    });
  }

  let entities = purgedEntities;

  // ─── STEP 2: Remove hidden layers ───
  const { cleaned: noHidden, removedCount: hiddenRemoved } = removeHiddenLayers(entities);
  if (hiddenRemoved > 0) {
    fixSummary.push({
      id: "removed_hidden",
      icon: "👁️",
      ar: `تمت إزالة ${hiddenRemoved} عنصر من الطبقات المخفية`,
      en: `Removed ${hiddenRemoved} items from hidden layers`,
      detail: "إزالة العناصر المخفية وغير المرئية",
    });
  }
  entities = noHidden;

  // ─── STEP 3: Remove dangling nodes ───
  const { cleaned: noDangling, removedCount: danglingRemoved } = removeDanglingNodes(entities);
  if (danglingRemoved > 0) {
    fixSummary.push({
      id: "removed_dangling",
      icon: "🔗",
      ar: `تمت إزالة ${danglingRemoved} نقطة معلقة أو عنصر تالف`,
      en: `Removed ${danglingRemoved} dangling nodes or broken items`,
      detail: "إزالة النقاط المعلقة والخطوط التالفة",
    });
  }
  entities = noDangling;

  // ─── STEP 4: Optional ARCS/CIRCLES/SPLINES/ELLIPSES → POLYLINES ───
  // Default behavior PRESERVES original geometry (§19). Converting valid
  // SPLINE/ELLIPSE/ARC/CIRCLE to polylines would silently modify the design,
  // so it is OFF by default and only runs when the caller explicitly opts in.
  if (options.convertCurvesToPolylines === true) {
    const { converted, convertCount } = convertAllToPolylines(entities);
    if (convertCount > 0) {
      fixSummary.push({
        id: "converted_to_polylines",
        icon: "🔄",
        ar: `تم تحويل ${convertCount} عنصر (أقواس، دوائر، منحنيات) إلى POLYLINES`,
        en: `Converted ${convertCount} entities (arcs, circles, curves) to POLYLINES`,
        detail: "تحويل جميع الكيانات إلى مسارات متعددة الخطوط",
      });
    }
    entities = converted;
  }

  // ─── STEP 5: Snap open endpoints (conservative tolerance — never destroy
  // nearby-but-distinct geometry). Tolerance is caller-configurable. ───
  const snappedEntities = snapOpenEndpoints(entities, options.snapTolerance ?? 0.001);

  // ─── STEP 6: Join connected paths ───
  const { joined, joinCount } = joinConnectedEntities(snappedEntities);
  if (joinCount > 0) {
    fixSummary.push({
      id: "joined_paths",
      icon: "🔗",
      ar: `تم دمج ${joinCount} مسار متصل في مسار واحد`,
      en: `Joined ${joinCount} connected paths into single paths`,
      detail: "دمج الخطوط المتلامسة في مسار واحد متصل",
    });
  }
  entities = joined;

  // ─── STEP 7: Auto-fix closed flag for geometrically-closed polylines ───
  // If a polyline is geometrically closed (gap < 0.1mm) but flag is 0,
  // auto-set the flag to 1. This is the user's explicit requirement.
  // Opt-out: processing checkbox "close open contours".
  let closedEntities = entities;
  let closeCount = 0;
  const doCloseOpen = options.closeOpenPolylines !== false;
  if (doCloseOpen) {
    const closed = closeAllPolylines(entities);
    closedEntities = closed.closed;
    closeCount = closed.closeCount;
  }
  if (doCloseOpen && closeCount > 0) {
    fixSummary.push({
      id: "closed_paths",
      icon: "⭕",
      ar: `تم إغلاق ${closeCount} مسار مفتوح (gap < 0.1 مم) تلقائياً`,
      en: `Auto-closed ${closeCount} open paths (gap < 0.1mm)`,
      detail: "إغلاق جميع المسارات المفتوحة (gap < 0.1mm)",
    });

    // v1.1 SINGLE SOURCE OF TRUTH: record WHICH detected issues were actually
    // fixed by this step, so the UI report (fixed vs needs-review) reflects the
    // engine result. closeAllPolylines maps 1:1 in order, so an index whose
    // object reference changed is exactly one that got closed (flag 0→1).
    // NOTE: earlier repair steps (snap/join/purge) may clone entities, so object
    // identity with analysis.entities is NOT reliable — match by a geometric key
    // (type|layer|first vertex|vertex count) that survives cloning.
    // Report-recording only — the geometry behavior above is unchanged.
    const entKey = (e: DxfEntity) =>
      `${e.type}|${e.layer}|${e.vertices?.[0]?.x ?? "?"},${e.vertices?.[0]?.y ?? "?"}|${e.vertices?.length ?? 0}`;
    const openIssueByKey = new Map<string, DxfIssue>();
    for (const issue of analysis.issues) {
      if (
        issue.type === "open_polyline" &&
        issue.entityIndices &&
        issue.entityIndices.length === 1
      ) {
        const ent = analysis.entities[issue.entityIndices[0]];
        if (ent) openIssueByKey.set(entKey(ent), issue);
      }
    }
    for (let j = 0; j < entities.length; j++) {
      if (entities[j] !== closedEntities[j]) {
        const issue = openIssueByKey.get(entKey(entities[j]));
        if (issue && !repairedIssues.some((r) => r.id === issue.id)) {
          repairedIssues.push({ ...issue, fixed: true });
        }
      }
    }
  }
  entities = closedEntities;

  // ─── STEP 7b: Close small gaps BY EXTENSION (no new geometry added) ───
  // Same promise as professional cleaners: unambiguous endpoint pairs within
  // gapTolerance are closed by MOVING both endpoints to their midpoint —
  // the original geometry is extended, never a new bridge entity added.
  // Ambiguous or large gaps are left untouched and reported instead.
  // Layer guarantee: endpoints on different layers are never joined.
  // Note: runs AFTER the flag-close issue mapping above (endpoint moves would
  // break the geometric key matching used there).
  const cleanupOptsEarly = { ...DEFAULT_CLEANUP_OPTIONS, ...(options.cleanup ?? {}) };
  if (options.closeGapsByExtension === true && options.closeOpenPolylines !== false) {
    const ext = closeSafeGaps(entities, cleanupOptsEarly);
    entities = ext.entities;
    if (ext.closed > 0) {
      fixSummary.push({
        id: "closed_by_extension",
        icon: "📐",
        ar: `تم إغلاق ${ext.closed} فجوة صغيرة بالتمديد — بدون إضافة أي هندسة جديدة${ext.skipped > 0 ? ` (تُركت ${ext.skipped} غامضة للمراجعة)` : ""}`,
        en: `Closed ${ext.closed} small gap(s) by extension — no new geometry added${ext.skipped > 0 ? ` (${ext.skipped} ambiguous left for review)` : ""}`,
        detail: "تمديد الخطوط الأصلية حتى الالتقاء (≤ عتبة الإغلاق) — الطبقات لا تُخلط أبداً",
      });
    }
  }

  // ─── STEP 7c: Remove dangling residues (short one-end-attached spurs) ───
  // Opt-in via the Processing checkbox — classic vectorization back-and-forth
  // strokes that would cause double cutting. Fully-isolated short lines are
  // preserved (may be intentional marks). Never touches other-layer geometry.
  if (cleanupOptsEarly.removeDanglingResidues) {
    const res = removeResidues(entities, cleanupOptsEarly);
    entities = res.entities;
    if (res.removed > 0) {
      fixSummary.push({
        id: "removed_residues",
        icon: "🧽",
        ar: `تم حذف ${res.removed} شوكة معلّقة (Residues) أقصر من ${cleanupOptsEarly.residueTolerance} مم`,
        en: `Removed ${res.removed} dangling residue stroke(s) shorter than ${cleanupOptsEarly.residueTolerance}mm`,
        detail: "حذف الشوكات المتصلة من طرف واحد فقط (بقايا الـ vectorization)",
      });
    }
  }

  // ─── STEP 8: REAL OVERKILL-STYLE CLEANUP (deterministic geometry engine) ───
  // This actually MODIFIES the geometry: removes duplicates (both directions),
  // zero-length entities, duplicate vertices, contained segments, and merges
  // collinear overlaps. The numbers in the report come from the real result.
  // Selective processing: user checkboxes override individual passes.
  const cleanupOpts = { ...DEFAULT_CLEANUP_OPTIONS, ...(options.cleanup ?? {}) };
  const cleanupResult = cleanupEntities(entities, cleanupOpts);
  entities = cleanupResult.entities;

  const cr = cleanupResult.report;
  if (cr.totalChanges > 0) {
    const parts: string[] = [];
    if (cr.duplicateEntitiesRemoved > 0) parts.push(`${cr.duplicateEntitiesRemoved} مكرر`);
    if (cr.zeroLengthRemoved > 0) parts.push(`${cr.zeroLengthRemoved} صفري الطول`);
    if (cr.duplicateVerticesRemoved > 0) parts.push(`${cr.duplicateVerticesRemoved} رأس مكرر`);
    if (cr.containedSegmentsRemoved > 0) parts.push(`${cr.containedSegmentsRemoved} قطعة محتواة`);
    if (cr.overlappingSegmentsMerged > 0)
      parts.push(`${cr.overlappingSegmentsMerged} قطعة متداخلة`);
    fixSummary.push({
      id: "real_cleanup",
      icon: "🔧",
      ar: `تم تنظيف الهندسة فعلياً: ${parts.join("، ")} — الكيانات (قبل: ${cr.before.totalEntities} → بعد: ${cr.after.totalEntities})`,
      en: `Real geometry cleanup applied: ${parts.join(", ")} — entities (before: ${cr.before.totalEntities} → after: ${cr.after.totalEntities})`,
      detail: `إزالة ${cr.duplicateEntitiesRemoved} مكرر · ${cr.zeroLengthRemoved} صفري الطول · ${cr.duplicateVerticesRemoved} رأس مكرر · دمج ${cr.overlappingSegmentsMerged} تداخل`,
    });
  } else {
    fixSummary.push({
      id: "real_cleanup",
      icon: "✅",
      ar: "لا توجد تكرارات أو تداخلات تحتاج تنظيفاً — لم يتم تغيير أي هندسة (لا تغييرات كاذبة)",
      en: "No duplicates or overlaps needed cleanup — no geometry was changed (no false changes)",
      detail: "نتيجة فحص هندسي حقيقي حتمي",
    });
  }

  // ─── STEP 9: Optimize cut order ───
  const finalEntities = optimizeCutOrder(entities);

  fixSummary.push({
    id: "optimized_cut_order",
    icon: "📐",
    ar: "تم ترتيب مسارات القص لتقليل حركة رأس الليزر",
    en: "Optimized cutting order to minimize laser head movement",
    detail: "تحسين سرعة الماكينة",
  });

  // ─── STEP 11: Simplify nodes ───
  const simplifiedEntities = finalEntities.map((e) => {
    if (e.type !== "LWPOLYLINE" || !e.vertices || e.vertices.length < 5) return e;
    const points = e.vertices.map((v) => ({ x: v.x, y: v.y }));
    const simplified = simplifyRDP(points, 0.02);
    if (simplified.length < e.vertices.length) {
      return {
        ...e,
        vertices: simplified.map((p) => ({ x: p.x, y: p.y })),
        vertexCount: simplified.length,
      };
    }
    return e;
  });

  const nodeReduction =
    finalEntities.length > 0
      ? Math.round(
          (1 -
            simplifiedEntities.reduce((s, e) => s + (e.vertices?.length || 0), 0) /
              Math.max(
                1,
                finalEntities.reduce((s, e) => s + (e.vertices?.length || 0), 0),
              )) *
            100,
        )
      : 0;

  if (nodeReduction > 0) {
    fixSummary.push({
      id: "nodes_optimized",
      icon: "✏️",
      ar: `تم تقليل عدد النقاط بنسبة ${nodeReduction}% مع الحفاظ على الشكل`,
      en: `Reduced node count by ${nodeReduction}% while preserving shape`,
      detail: "تبسيط المنحنيات وتقليل النقاط الزائدة",
    });
  }

  // Generate final DXF
  const entitiesSection = generateEntitiesSection(simplifiedEntities);
  const fixed =
    analysis.headerSection +
    "\n  0\nSECTION\n  2\nENTITIES\n" +
    entitiesSection +
    "\n  0\nENDSEC" +
    analysis.tailSection;

  // Calculate metrics
  const processedFileSize = new Blob([fixed]).size;
  const sizeReductionPercent =
    originalSize > 0 ? Math.round(((originalSize - processedFileSize) / originalSize) * 100) : 0;
  const processingTimeMs = Math.round(performance.now() - startTime);

  fixSummary.push({
    id: "processing_metrics",
    icon: "⚡",
    ar: `تمت المعالجة في ${processingTimeMs} مللي ثانية — تقليص حجم الملف ${sizeReductionPercent}%`,
    en: `Processed in ${processingTimeMs}ms — file size reduced by ${sizeReductionPercent}%`,
    detail: `الوقت المستغرق للمعالجة: ${processingTimeMs}ms · تقليص الحجم: ${sizeReductionPercent}%`,
  });

  return { fixed, repaired: repairedIssues, fixSummary };
}

function generateEntitiesSection(entities: DxfEntity[]): string {
  return entities.map((e) => generateEntityText(e)).join("\n");
}

function generateEntityText(e: DxfEntity): string {
  if (e.type === "LWPOLYLINE" && e.vertices) {
    const flags = e.closed ? 1 : 0;
    const lines: string[] = [
      "  0",
      "LWPOLYLINE",
      "  8",
      e.layer,
      " 90",
      String(e.vertices.length),
      " 70",
      String(flags),
    ];
    if (e.handle) {
      lines.push("  5", e.handle);
    }
    for (const v of e.vertices) {
      lines.push(" 10", v.x.toFixed(6));
      lines.push(" 20", v.y.toFixed(6));
      if (v.bulge && v.bulge !== 0) {
        lines.push(" 42", v.bulge.toFixed(6));
      }
    }
    return lines.join("\n");
  }
  if (e.type === "POLYLINE") {
    // Legacy (AC1009) POLYLINE: serialise as old-style POLYLINE → VERTEX →
    // SEQEND rebuilt from the (possibly cleaned) vertex list.
    const lines: string[] = ["  0", "POLYLINE", "  8", e.layer];
    if (e.handle) lines.push("  5", e.handle);
    lines.push(" 66", "1");
    // Preserve original header attributes (color, linetype, lineweight,
    // thickness, extrusion) but not geometry that we regenerate (8/5/66/70).
    const raw = e.rawLines ?? [];
    const preservedCodes = new Set<number>([6, 39, 48, 62, 370, 420]);
    for (let r = 0; r + 1 < raw.length; r += 2) {
      const c = parseInt(raw[r].trim(), 10);
      const v = (raw[r + 1] || "").trim();
      if (c === 0 && v.toUpperCase() === "VERTEX") break; // stop at the VERTEX body
      if (preservedCodes.has(c)) lines.push(raw[r].trim(), v);
    }
    lines.push(" 70", e.closed ? "1" : "0");
    const verts = e.vertices ?? [];
    for (const v of verts) {
      lines.push("  0", "VERTEX", "  8", "0", " 10", v.x.toFixed(6), " 20", v.y.toFixed(6));
      if (v.bulge && v.bulge !== 0) lines.push(" 42", v.bulge.toFixed(6));
    }
    lines.push("  0", "SEQEND");
    return lines.join("\n");
  }
  // LINE: regenerate the entity fully from its current (possibly cleaned/
  // merged) fields so the downloaded DXF always reflects the real geometry.
  // Layer + handle are always written; color (62/420), linetype (6) and
  // lineweight (370) are preserved when present in the raw data.
  if (e.type === "LINE") {
    const lines: string[] = ["  0", "LINE", "  8", e.layer];
    if (e.handle) lines.push("  5", e.handle);
    if (e.rawLines && e.rawLines.length >= 2) {
      for (let i = 0; i + 1 < e.rawLines.length; i += 2) {
        const c = parseInt(e.rawLines[i].trim(), 10);
        if (c === 62 || c === 6 || c === 370 || c === 420) {
          const v = e.rawLines[i + 1];
          if (v !== undefined) lines.push(e.rawLines[i], v);
        }
      }
    }
    lines.push(" 10", (e.x1 ?? 0).toFixed(6));
    lines.push(" 20", (e.y1 ?? 0).toFixed(6));
    if (e.z1 !== undefined) lines.push(" 30", e.z1.toFixed(6));
    lines.push(" 11", (e.x2 ?? 0).toFixed(6));
    lines.push(" 21", (e.y2 ?? 0).toFixed(6));
    if (e.z2 !== undefined) lines.push(" 31", e.z2.toFixed(6));
    return lines.join("\n");
  }
  return e.rawLines.join("\n");
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

export function scoreBg(score: number): string {
  if (score >= 80) return "border-green-500/40 bg-green-500/10";
  if (score >= 50) return "border-yellow-500/40 bg-yellow-500/10";
  return "border-red-500/40 bg-red-500/10";
}

export function scoreLabel(score: number, lang: "ar" | "en"): string {
  if (lang === "ar") {
    if (score >= 90) return "جاهز للقص ✓";
    if (score >= 70) return "جاهز مع تحفظات";
    if (score >= 50) return "يحتاج إصلاح";
    return "غير جاهز";
  }
  if (score >= 90) return "Ready to cut ✓";
  if (score >= 70) return "Ready with warnings";
  if (score >= 50) return "Needs repair";
  return "Not ready";
}

export interface DxfBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function getDxfBounds(entities: DxfEntity[]): DxfBounds | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let found = false;

  function expand(x: number, y: number) {
    found = true;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  function expandEntity(e: DxfEntity) {
    if (e.type === "LINE") {
      expand(e.x1 ?? 0, e.y1 ?? 0);
      expand(e.x2 ?? 0, e.y2 ?? 0);
    } else if (e.type === "CIRCLE" || e.type === "ARC") {
      const cx = e.cx ?? 0,
        cy = e.cy ?? 0,
        r = e.radius ?? 0;
      expand(cx - r, cy - r);
      expand(cx + r, cy + r);
    } else if (e.type === "LWPOLYLINE" && e.vertices) {
      for (const v of e.vertices) expand(v.x, v.y);
    } else if (e.type === "POLYLINE" && e.vertices) {
      for (const v of e.vertices) expand(v.x, v.y);
    } else if (e.type === "SPLINE" && e.vertices) {
      for (const v of e.vertices) expand(v.x, v.y);
    } else if (e.type === "ELLIPSE") {
      const cx = e.cx ?? 0,
        cy = e.cy ?? 0,
        r = e.radius ?? 0;
      expand(cx - r, cy - r);
      expand(cx + r, cy + r);
    } else if ((e.type === "SOLID" || e.type === "3DFACE") && e.vertices) {
      for (const v of e.vertices) expand(v.x, v.y);
    } else if (e.type === "POINT") {
      expand(e.x1 ?? 0, e.y1 ?? 0);
    } else if (e.type === "INSERT") {
      expand(e.cx ?? 0, e.cy ?? 0);
    } else if (e.type === "DIMENSION") {
      expand(e.x1 ?? 0, e.y1 ?? 0);
      expand(e.x2 ?? 0, e.y2 ?? 0);
    } else if (e.type === "HATCH") {
      expand(e.cx ?? 0, e.cy ?? 0);
    }
  }

  for (const e of entities) expandEntity(e);

  if (!found) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export interface SvgPath {
  d: string;
  entityIndex: number;
  type: string;
  layer: string;
}

export function buildSvgPaths(entities: DxfEntity[], bounds: DxfBounds): SvgPath[] {
  const paths: SvgPath[] = [];
  const { maxY } = bounds;

  function flipY(y: number) {
    return maxY - y + bounds.minY;
  }

  function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s);
    const y1 = flipY(cy + r * Math.sin(s));
    const x2 = cx + r * Math.cos(e);
    const y2 = flipY(cy + r * Math.sin(e));
    let sweep = endDeg - startDeg;
    if (sweep < 0) sweep += 360;
    const large = sweep > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}`;
  }

  function polylinePath(verts: DxfVertex[], closed: boolean | undefined): string {
    if (!verts || verts.length < 1) return "";
    const pts = verts.map((v) => `${v.x},${flipY(v.y)}`);
    let d = `M ${pts[0]} L ${pts.slice(1).join(" L ")}`;
    if (closed) d += " Z";
    return d;
  }

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    let d = "";

    if (e.type === "LINE") {
      const x1 = e.x1 ?? 0,
        y1 = flipY(e.y1 ?? 0);
      const x2 = e.x2 ?? 0,
        y2 = flipY(e.y2 ?? 0);
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else if (e.type === "CIRCLE") {
      const cx = e.cx ?? 0,
        cy = flipY(e.cy ?? 0),
        r = e.radius ?? 0;
      d = `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`;
    } else if (e.type === "ARC") {
      d = arcPath(e.cx ?? 0, e.cy ?? 0, e.radius ?? 0, e.startAngle ?? 0, e.endAngle ?? 0);
    } else if (e.type === "LWPOLYLINE" && e.vertices && e.vertices.length > 0) {
      d = polylinePath(e.vertices, e.closed);
    } else if (e.type === "POLYLINE" && e.vertices && e.vertices.length > 0) {
      d = polylinePath(e.vertices, e.closed);
    } else if (e.type === "SPLINE" && e.vertices && e.vertices.length > 0) {
      d = polylinePath(e.vertices, e.closed);
    } else if (e.type === "ELLIPSE") {
      const cx = e.cx ?? 0,
        cy = flipY(e.cy ?? 0);
      const rx = e.radius ?? 1;
      const ry = rx * 0.6; // approximate ratio
      const startDeg = e.startAngle ?? 0;
      const endDeg = e.endAngle ?? 360;
      if (endDeg - startDeg >= 360) {
        // Full ellipse = two arcs
        d = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
      } else {
        d = arcPath(e.cx ?? 0, e.cy ?? 0, e.radius ?? 1, startDeg, endDeg);
      }
    } else if (e.type === "POINT") {
      const x = e.x1 ?? 0,
        y = flipY(e.y1 ?? 0);
      d = `M ${x - 2} ${y} L ${x + 2} ${y} M ${x} ${y - 2} L ${x} ${y + 2}`; // small crosshair
    } else if (
      (e.type === "SOLID" || e.type === "3DFACE") &&
      e.vertices &&
      e.vertices.length >= 2
    ) {
      d = polylinePath(e.vertices, true);
    } else if (e.type === "DIMENSION") {
      const x1 = e.x1 ?? 0,
        y1 = flipY(e.y1 ?? 0);
      const x2 = e.x2 ?? 0,
        y2 = flipY(e.y2 ?? 0);
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    if (d) paths.push({ d, entityIndex: i, type: e.type, layer: e.layer });
  }
  return paths;
}
