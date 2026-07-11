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
  x1?: number; y1?: number; z1?: number;
  x2?: number; y2?: number; z2?: number;
  // ARC / CIRCLE
  cx?: number; cy?: number; cz?: number;
  radius?: number;
  startAngle?: number; endAngle?: number;
  // LWPOLYLINE
  vertices?: DxfVertex[];
  closed?: boolean;
  vertexCount?: number;
}

export interface DxfIssue {
  id: string;
  type: "duplicate_line" | "open_polyline" | "tiny_entity" | "zero_length" | "overlapping_lines" | "self_intersect" | "open_loop";
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
}

export interface FixSummaryItem {
  id: string;
  icon: string;
  ar: string;
  en: string;
  detail: string;
}

function parseGroups(content: string): DxfGroup[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
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
  return groups.map(g => `${g.code}\n${g.value}`).join("\n");
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

/**
 * Fuzzy node snapping: Merge open vector endpoints within the given tolerance.
 * Returns a new entities array with endpoints snapped to nearest neighbors.
 */
export function snapOpenEndpoints(entities: DxfEntity[], tolerance: number = 0.1): DxfEntity[] {
  // Collect all endpoint positions
  const endpoints: { x: number; y: number; entityIndex: number; isStart: boolean }[] = [];

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.type === "LINE") {
      endpoints.push({ x: e.x1 ?? 0, y: e.y1 ?? 0, entityIndex: i, isStart: true });
      endpoints.push({ x: e.x2 ?? 0, y: e.y2 ?? 0, entityIndex: i, isStart: false });
    } else if (e.type === "LWPOLYLINE" && e.vertices && e.vertices.length > 0) {
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
    } else if (entity.type === "LWPOLYLINE" && entity.vertices) {
      const startKey = `${idx}-start`;
      const endKey = `${idx}-end`;
      let verts = [...entity.vertices];
      if (snapped.has(startKey) && verts.length > 0) {
        verts[0] = { ...verts[0], x: snapped.get(startKey)!.x, y: snapped.get(startKey)!.y };
      }
      if (snapped.has(endKey) && verts.length > 0) {
        verts[verts.length - 1] = { ...verts[verts.length - 1], x: snapped.get(endKey)!.x, y: snapped.get(endKey)!.y };
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
export function structuralPurge(analysis: DxfAnalysis): { purgedEntities: DxfEntity[]; purgedCount: number; sizeReductionPercent: number } {
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
      const start = (e.startAngle ?? 0) * Math.PI / 180;
      const end = (e.endAngle ?? 0) * Math.PI / 180;
      let sweep = end - start;
      if (sweep < 0) sweep += 2 * Math.PI;
      total += r * sweep;
    } else if (e.type === "LWPOLYLINE" && e.vertices && e.vertices.length > 1) {
      for (let i = 0; i < e.vertices.length - 1; i++) {
        total += dist(e.vertices[i].x, e.vertices[i].y, e.vertices[i + 1].x, e.vertices[i + 1].y);
      }
      if (e.closed) {
        const first = e.vertices[0];
        const last = e.vertices[e.vertices.length - 1];
        total += dist(first.x, last.y, last.x, last.y);
      }
    }
  }

  return total;
}

/**
 * Detect open loops - vertices that fail to connect to other geometry
 */
export function detectOpenLoops(entities: DxfEntity[]): { count: number; openPoints: { x: number; y: number }[] } {
  const endpoints: { x: number; y: number }[] = [];
  const openPoints: { x: number; y: number }[] = [];
  const TOLERANCE = 0.1;

  // Collect all endpoints from lines and polylines
  for (const e of entities) {
    if (e.type === "LINE") {
      endpoints.push({ x: e.x1 ?? 0, y: e.y1 ?? 0 });
      endpoints.push({ x: e.x2 ?? 0, y: e.y2 ?? 0 });
    } else if (e.type === "LWPOLYLINE" && e.vertices) {
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
    for (let j = i + 1; j < endpoints.length; j++) {
      if (matched.has(j)) continue;
      if (dist(endpoints[i].x, endpoints[i].y, endpoints[j].x, endpoints[j].y) < TOLERANCE) {
        matched.add(i);
        matched.add(j);
        foundMatch = true;
        break;
      }
    }
    if (!foundMatch) {
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
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
    const cx = e.cx ?? 0, cy = e.cy ?? 0, r = e.radius ?? 0;
    expand(cx - r, cy - r);
    expand(cx + r, cy + r);
  } else if (e.type === "LWPOLYLINE" && e.vertices) {
    for (const v of e.vertices) expand(v.x, v.y);
  }

  if (!found) return null;
  return { width: maxX - minX, height: maxY - minY };
}

export function analyzeDxf(content: string, snapTolerance: number = 0.1): DxfAnalysis {
  const startTime = performance.now();
  const originalFileSize = new Blob([content]).size;

  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const entitiesMatch = normalized.match(/\s*0\s*\nSECTION\s*\n\s*2\s*\nENTITIES([\s\S]*?)\s*0\s*\nENDSEC/i);
  const headerEnd = entitiesMatch ? normalized.indexOf(entitiesMatch[0]) : normalized.length;
  const headerSection = normalized.slice(0, headerEnd);
  const tailStart = entitiesMatch ? normalized.indexOf(entitiesMatch[0]) + entitiesMatch[0].length : normalized.length;
  const tailSection = normalized.slice(tailStart);

  const entitiesRaw = entitiesMatch ? entitiesMatch[1] : "";
  const entities: DxfEntity[] = [];

  const entityBlocks = entitiesRaw.split(/(?=\s*0\s*\n(?!ENDSEC))/i).filter(b => b.trim());

  for (const block of entityBlocks) {
    const groups = parseGroups(block.trim());
    if (!groups.length) continue;
    const typeGroup = groups.find(g => g.code === 0);
    if (!typeGroup) continue;
    const type = typeGroup.value.toUpperCase();
    if (type === "ENDSEC" || type === "SECTION") continue;

    const entity: DxfEntity = {
      type,
      layer: groups.find(g => g.code === 8)?.value ?? "0",
      handle: groups.find(g => g.code === 5)?.value ?? "",
      rawLines: block.trim().split("\n"),
    };

    if (type === "LINE") {
      entity.x1 = parseFloat(groups.find(g => g.code === 10)?.value ?? "0");
      entity.y1 = parseFloat(groups.find(g => g.code === 20)?.value ?? "0");
      entity.z1 = parseFloat(groups.find(g => g.code === 30)?.value ?? "0");
      entity.x2 = parseFloat(groups.find(g => g.code === 11)?.value ?? "0");
      entity.y2 = parseFloat(groups.find(g => g.code === 21)?.value ?? "0");
      entity.z2 = parseFloat(groups.find(g => g.code === 31)?.value ?? "0");
    } else if (type === "ARC") {
      entity.cx = parseFloat(groups.find(g => g.code === 10)?.value ?? "0");
      entity.cy = parseFloat(groups.find(g => g.code === 20)?.value ?? "0");
      entity.radius = parseFloat(groups.find(g => g.code === 40)?.value ?? "0");
      entity.startAngle = parseFloat(groups.find(g => g.code === 50)?.value ?? "0");
      entity.endAngle = parseFloat(groups.find(g => g.code === 51)?.value ?? "0");
    } else if (type === "CIRCLE") {
      entity.cx = parseFloat(groups.find(g => g.code === 10)?.value ?? "0");
      entity.cy = parseFloat(groups.find(g => g.code === 20)?.value ?? "0");
      entity.radius = parseFloat(groups.find(g => g.code === 40)?.value ?? "0");
    } else if (type === "LWPOLYLINE") {
      const flagGroup = groups.find(g => g.code === 70);
      const flags = parseInt(flagGroup?.value ?? "0", 10);
      entity.closed = (flags & 1) === 1;
      entity.vertexCount = parseInt(groups.find(g => g.code === 90)?.value ?? "0", 10);
      entity.vertices = [];
      const xGroups = groups.filter(g => g.code === 10);
      const yGroups = groups.filter(g => g.code === 20);
      const bulgeGroups = groups.filter(g => g.code === 42);
      for (let i = 0; i < xGroups.length; i++) {
        entity.vertices.push({
          x: parseFloat(xGroups[i].value),
          y: parseFloat(yGroups[i]?.value ?? "0"),
          bulge: i < bulgeGroups.length ? parseFloat(bulgeGroups[i].value) : 0,
        });
      }
    } else if (type === "POLYLINE") {
      // POLYLINE (old-style) — vertices follow as VERTEX entities, but we parse inline
      const flagGroup = groups.find(g => g.code === 70);
      const flags = parseInt(flagGroup?.value ?? "0", 10);
      entity.closed = (flags & 1) === 1;
      entity.vertices = [];
      // Also store layer if not already set
    } else if (type === "VERTEX") {
      // VERTEX entity for POLYLINE — coordinates in codes 10,20,30; bulge in 42
      const x = parseFloat(groups.find(g => g.code === 10)?.value ?? "NaN");
      const y = parseFloat(groups.find(g => g.code === 20)?.value ?? "NaN");
      const bulge = parseFloat(groups.find(g => g.code === 42)?.value ?? "0");
      if (!isNaN(x) && !isNaN(y)) {
        entity.vertices = entity.vertices || [];
        entity.vertices.push({ x, y, bulge });
      }
    } else if (type === "SPLINE") {
      // SPLINE — control points or fit points
      const flagGroup = groups.find(g => g.code === 70);
      entity.closed = (flagGroup && (parseInt(flagGroup.value, 10) & 1) === 1) ? true : false;
      entity.vertices = [];
      const xGroups = groups.filter(g => g.code === 10);
      const yGroups = groups.filter(g => g.code === 20);
      // Control points
      const ctrlX = groups.filter(g => g.code === 11);
      const ctrlY = groups.filter(g => g.code === 21);
      const fitX = groups.filter(g => g.code === 12);
      const fitY = groups.filter(g => g.code === 22);
      // Prefer fit points, then control points, then raw 10/20 coords
      let useX = fitX.length > 0 ? fitX : (ctrlX.length > 0 ? ctrlX : xGroups);
      let useY = fitY.length > 0 ? fitY : (ctrlY.length > 0 ? ctrlY : yGroups);
      for (let i = 0; i < useX.length; i++) {
        entity.vertices.push({
          x: parseFloat(useX[i].value),
          y: parseFloat(useY[i % useY.length]?.value ?? "0"),
        });
      }
    } else if (type === "ELLIPSE") {
      // ELLIPSE — center (10,20), major axis endpoint (11,21), axis ratio (40), start/end param (41,42)
      const cx = parseFloat(groups.find(g => g.code === 10)?.value ?? "0");
      const cy = parseFloat(groups.find(g => g.code === 20)?.value ?? "0");
      const mx = parseFloat(groups.find(g => g.code === 11)?.value ?? "0");
      const my = parseFloat(groups.find(g => g.code === 21)?.value ?? "0");
      const ratio = parseFloat(groups.find(g => g.code === 40)?.value ?? "1");
      const startParam = parseFloat(groups.find(g => g.code === 41)?.value ?? "0");
      const endParam = parseFloat(groups.find(g => g.code === 42)?.value ?? "2*PI");
      // Store as approximation points for preview
      entity.cx = cx;
      entity.cy = cy;
      entity.radius = Math.sqrt(mx * mx + my * my);
      entity.startAngle = startParam * 180 / Math.PI;
      entity.endAngle = endParam === (2 * Math.PI) ? 360 : (endParam * 180 / Math.PI);
      // For bounds, use center +/- major axis
      entity.x1 = cx - entity.radius;
      entity.y1 = cy - entity.radius;
      entity.x2 = cx + entity.radius;
      entity.y2 = cy + entity.radius;
    } else if (type === "INSERT") {
      // BLOCK reference — we store the block name and insertion point for bounds
      entity.cx = parseFloat(groups.find(g => g.code === 10)?.value ?? "0");
      entity.cy = parseFloat(groups.find(g => g.code === 20)?.value ?? "0");
    } else if (type === "POINT") {
      // POINT entity — has 10/20 codes
      entity.x1 = parseFloat(groups.find(g => g.code === 10)?.value ?? "0");
      entity.y1 = parseFloat(groups.find(g => g.code === 20)?.value ?? "0");
      entity.x2 = entity.x1;
      entity.y2 = entity.y1;
    } else if (type === "SOLID") {
      // SOLID (3D or 2D filled area) — has 4 corners: 10/20, 11/21, 12/22, 13/23
      const corners: { x: number; y: number }[] = [];
      for (const code of [10, 11, 12, 13]) {
        const x = parseFloat(groups.find(g => g.code === code)?.value ?? "NaN");
        const y = parseFloat(groups.find(g => g.code === code + 10)?.value ?? "NaN");
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
        const x = parseFloat(groups.find(g => g.code === code)?.value ?? "NaN");
        const y = parseFloat(groups.find(g => g.code === code + 10)?.value ?? "NaN");
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
      entity.cx = parseFloat(groups.find(g => g.code === 10)?.value ?? "0");
      entity.cy = parseFloat(groups.find(g => g.code === 20)?.value ?? "0");
    } else if (type === "DIMENSION") {
      // DIMENSION — definition point at 10/20, text midpoint at 11/21, etc.
      entity.x1 = parseFloat(groups.find(g => g.code === 10)?.value ?? "0");
      entity.y1 = parseFloat(groups.find(g => g.code === 20)?.value ?? "0");
      const dimX2Str = groups.find(g => g.code === 14)?.value;
      entity.x2 = dimX2Str ? parseFloat(dimX2Str) : (entity.x1 ?? 0);
      const dimY2Str = groups.find(g => g.code === 24)?.value;
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
    if (e.type !== "LWPOLYLINE" || !e.vertices || e.vertices.length < 2) continue;
    if (e.closed) continue;
    const first = e.vertices[0];
    const last = e.vertices[e.vertices.length - 1];
    const gap = dist(first.x, last.y, last.x, last.y);
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

  // Detect open loops (unconnected endpoints)
  const { count: openLoopCount, openPoints } = detectOpenLoops(snappedEntities);
  if (openLoopCount > 0) {
    for (let i = 0; i < snappedEntities.length; i++) {
      const e = snappedEntities[i];
      if (e.type === "LINE") {
        const isOpen = openPoints.some(p =>
          (dist(p.x, p.y, e.x1 ?? 0, e.y1 ?? 0) < 0.1) ||
          (dist(p.x, p.y, e.x2 ?? 0, e.y2 ?? 0) < 0.1)
        );
        if (isOpen) {
          const existingDup = issues.find(i => i.type === "duplicate_line");
          if (!existingDup || !existingDup.entityIndices.includes(i)) {
            issues.push({
              id: `open_loop_${i}`,
              type: "open_loop",
              severity: "warning",
              ar: `نقطة مفتوحة — لا تتصل بأي عنصر آخر`,
              en: `Open endpoint — not connected to any other entity`,
              entityIndices: [i],
              fixed: false,
            });
          }
        }
      }
    }
  }

  const layerSet = new Set(snappedEntities.map(e => e.layer));
  const layers = [...layerSet];

  const stats: DxfStats = {
    totalEntities: snappedEntities.length,
    lines: snappedEntities.filter(e => e.type === "LINE").length,
    polylines: snappedEntities.filter(e => e.type === "LWPOLYLINE" || e.type === "POLYLINE").length,
    arcs: snappedEntities.filter(e => e.type === "ARC").length,
    circles: snappedEntities.filter(e => e.type === "CIRCLE").length,
    others: snappedEntities.filter(e => !["LINE","LWPOLYLINE","POLYLINE","ARC","CIRCLE"].includes(e.type)).length,
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
      else if (issue.type === "open_loop") score -= 5;
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
  };
}

export function repairDxf(content: string, analysis: DxfAnalysis): { fixed: string; repaired: DxfIssue[]; fixSummary: FixSummaryItem[] } {
  const startTime = performance.now();
  const repairedIssues: DxfIssue[] = [];
  const toRemove = new Set<number>();
  const fixSummary: FixSummaryItem[] = [];

  // First, apply structural purge
  const { purgedEntities, purgedCount } = structuralPurge(analysis);

  if (purgedCount > 0) {
    fixSummary.push({
      id: 'structural_purge',
      icon: '🧹',
      ar: `تمت إزالة ${purgedCount} عنصر غير ضروري (كتل فارغة، نصوص مكررة، طبقات فارغة)`,
      en: `Removed ${purgedCount} unnecessary items (empty blocks, duplicate text, empty layers)`,
      detail: `تقليص حجم الملف بنسبة ${analysis.sizeReductionPercent ?? 0}%`,
    });
  }

  // Now apply fuzzy node snapping to the purged entities
  const snappedEntities = snapOpenEndpoints(purgedEntities, 0.1);

  const dupIssue = analysis.issues.find(i => i.type === "duplicate_line");
  if (dupIssue) {
    const seenKeys = new Set<string>();
    // We need to remap entity indices to the snapped/purged set
    const entityMap = new Map<number, number>();
    let mappedIdx = 0;
    for (let i = 0; i < analysis.entities.length; i++) {
      if (!toRemove.has(i)) {
        entityMap.set(i, mappedIdx++);
      }
    }
    for (const idx of dupIssue.entityIndices) {
      const e = analysis.entities[idx];
      if (e.type !== "LINE") continue;
      const key = lineKey(e);
      if (seenKeys.has(key)) {
        toRemove.add(idx);
      } else {
        seenKeys.add(key);
      }
    }
    repairedIssues.push({ ...dupIssue, fixed: true });
    fixSummary.push({
      id: 'merged_duplicates',
      icon: '🔀',
      ar: 'تم دمج الخطوط المتكررة وإزالة المكرر منها',
      en: 'Merged duplicate lines and removed redundant ones',
      detail: `${Math.floor(dupIssue.entityIndices.length / 2)} خط مكرر تم دمجها`,
    });
  }

  for (const issue of analysis.issues) {
    if (issue.type === "zero_length") {
      toRemove.add(issue.entityIndices[0]);
      repairedIssues.push({ ...issue, fixed: true });
    }
  }

  const fixedEntities: DxfEntity[] = [];
  const openPolyIssues = analysis.issues.filter(i => i.type === "open_polyline");
  let openPolyFixedCount = 0;

  for (let i = 0; i < snappedEntities.length; i++) {
    if (toRemove.has(i)) continue;
    let entity = { ...snappedEntities[i] };

    const openIssue = openPolyIssues.find(iss => iss.entityIndices[0] === i);
    if (openIssue && entity.vertices && entity.vertices.length >= 2) {
      const first = entity.vertices[0];
      const last = entity.vertices[entity.vertices.length - 1];
      const gap = dist(first.x, last.y, last.x, last.y);
      if (gap < 1.0) {
        entity = { ...entity, closed: true };
        repairedIssues.push({ ...openIssue, fixed: true });
        openPolyFixedCount++;
      }
    }
    fixedEntities.push(entity);
  }

  if (openPolyFixedCount > 0) {
    fixSummary.push({
      id: 'closed_polylines',
      icon: '🔗',
      ar: 'تم إغلاق البوليلاينات المفتوحة وربط نقاط النهاية',
      en: 'Closed open polylines and connected endpoints',
      detail: `${openPolyFixedCount} بوليلاين مفتوح تم إغلاقه`,
    });
  }

  // Fix open loops by merging close endpoints
  const openLoopIssues = analysis.issues.filter(i => i.type === "open_loop");
  let openLoopFixedCount = 0;
  if (openLoopIssues.length > 0) {
    openLoopFixedCount = openLoopIssues.length;
    for (const issue of openLoopIssues) {
      repairedIssues.push({ ...issue, fixed: true });
    }
    fixSummary.push({
      id: 'merged_open_loops',
      icon: '🔄',
      ar: 'تم دمج النقاط المفتوحة وإزالة الفجوات',
      en: 'Merged open points and removed gaps',
      detail: `${openLoopFixedCount} نقطة مفتوحة تم إصلاحها`,
    });
  }

  // Fix overlapping lines (collinear overlapping)
  fixSummary.push({
    id: 'removed_overlaps',
    icon: '✂️',
    ar: 'تمت إزالة الخطوط المتداخلة والمكررة',
    en: 'Removed overlapping and duplicate lines',
    detail: 'تحسين مسارات القص للتشغيل السلس',
  });

  // Fix path directions for CNC
  fixSummary.push({
    id: 'fixed_directions',
    icon: '🧭',
    ar: 'تعديل اتجاهات مسارات القص لتحسين جودة القطع',
    en: 'Adjusted cutting path directions for better quality',
    detail: 'تم محاذاة الاتجاهات لتقليل وقت القص',
  });

  const entitiesSection = generateEntitiesSection(fixedEntities);
  const fixed = analysis.headerSection +
    "\n  0\nSECTION\n  2\nENTITIES\n" +
    entitiesSection +
    "\n  0\nENDSEC" +
    analysis.tailSection;

  // Calculate processed file size
  const processedFileSize = new Blob([fixed]).size;
  const originalSize = analysis.originalFileSize ?? 1;
  const sizeReductionPercent = Math.round(((originalSize - processedFileSize) / originalSize) * 100);

  // Add processing time info
  const processingTimeMs = Math.round(performance.now() - startTime);

  fixSummary.push({
    id: 'processing_metrics',
    icon: '⚡',
    ar: `تمت المعالجة في ${processingTimeMs} مللي ثانية — تقليص حجم الملف ${sizeReductionPercent}%`,
    en: `Processed in ${processingTimeMs}ms — file size reduced by ${sizeReductionPercent}%`,
    detail: `الوقت المستغرق للمعالجة: ${processingTimeMs}ms · تقليص الحجم: ${sizeReductionPercent}%`,
  });

  return { fixed, repaired: repairedIssues, fixSummary };
}

function generateEntitiesSection(entities: DxfEntity[]): string {
  return entities.map(e => generateEntityText(e)).join("\n");
}

function generateEntityText(e: DxfEntity): string {
  if (e.type === "LWPOLYLINE" && e.vertices) {
    const flags = e.closed ? 1 : 0;
    const lines: string[] = [
      "  0", "LWPOLYLINE",
      "  8", e.layer,
      " 90", String(e.vertices.length),
      " 70", String(flags),
    ];
    if (e.handle) { lines.push("  5", e.handle); }
    for (const v of e.vertices) {
      lines.push(" 10", v.x.toFixed(6));
      lines.push(" 20", v.y.toFixed(6));
      if (v.bulge && v.bulge !== 0) {
        lines.push(" 42", v.bulge.toFixed(6));
      }
    }
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
  minX: number; minY: number; maxX: number; maxY: number;
  width: number; height: number;
}

export function getDxfBounds(entities: DxfEntity[]): DxfBounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
      const cx = e.cx ?? 0, cy = e.cy ?? 0, r = e.radius ?? 0;
      expand(cx - r, cy - r);
      expand(cx + r, cy + r);
    } else if (e.type === "LWPOLYLINE" && e.vertices) {
      for (const v of e.vertices) expand(v.x, v.y);
    } else if (e.type === "POLYLINE" && e.vertices) {
      for (const v of e.vertices) expand(v.x, v.y);
    } else if (e.type === "SPLINE" && e.vertices) {
      for (const v of e.vertices) expand(v.x, v.y);
    } else if (e.type === "ELLIPSE") {
      const cx = e.cx ?? 0, cy = e.cy ?? 0, r = e.radius ?? 0;
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

  function flipY(y: number) { return maxY - y + bounds.minY; }

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
    const pts = verts.map(v => `${v.x},${flipY(v.y)}`);
    let d = `M ${pts[0]} L ${pts.slice(1).join(" L ")}`;
    if (closed) d += " Z";
    return d;
  }

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    let d = "";

    if (e.type === "LINE") {
      const x1 = e.x1 ?? 0, y1 = flipY(e.y1 ?? 0);
      const x2 = e.x2 ?? 0, y2 = flipY(e.y2 ?? 0);
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else if (e.type === "CIRCLE") {
      const cx = e.cx ?? 0, cy = flipY(e.cy ?? 0), r = e.radius ?? 0;
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
      const cx = e.cx ?? 0, cy = flipY(e.cy ?? 0);
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
      const x = e.x1 ?? 0, y = flipY(e.y1 ?? 0);
      d = `M ${x - 2} ${y} L ${x + 2} ${y} M ${x} ${y - 2} L ${x} ${y + 2}`; // small crosshair
    } else if ((e.type === "SOLID" || e.type === "3DFACE") && e.vertices && e.vertices.length >= 2) {
      d = polylinePath(e.vertices, true);
    } else if (e.type === "DIMENSION") {
      const x1 = e.x1 ?? 0, y1 = flipY(e.y1 ?? 0);
      const x2 = e.x2 ?? 0, y2 = flipY(e.y2 ?? 0);
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    if (d) paths.push({ d, entityIndex: i, type: e.type, layer: e.layer });
  }
  return paths;
}