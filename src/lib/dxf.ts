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
  type: "duplicate_line" | "open_polyline" | "tiny_entity" | "zero_length" | "overlapping_lines" | "self_intersect";
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
}

export interface DxfAnalysis {
  entities: DxfEntity[];
  issues: DxfIssue[];
  stats: DxfStats;
  score: number;
  headerSection: string;
  tailSection: string;
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

export function analyzeDxf(content: string): DxfAnalysis {
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
    }
    entities.push(entity);
  }

  const issues: DxfIssue[] = [];
  const TINY = 0.01;

  const lineSeenKeys = new Map<string, number>();
  const duplicateIndices: number[] = [];
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
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

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.type !== "LWPOLYLINE" || !e.vertices || e.vertices.length < 2) continue;
    if (e.closed) continue;
    const first = e.vertices[0];
    const last = e.vertices[e.vertices.length - 1];
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

  const layerSet = new Set(entities.map(e => e.layer));
  const layers = [...layerSet];

  const stats: DxfStats = {
    totalEntities: entities.length,
    lines: entities.filter(e => e.type === "LINE").length,
    polylines: entities.filter(e => e.type === "LWPOLYLINE" || e.type === "POLYLINE").length,
    arcs: entities.filter(e => e.type === "ARC").length,
    circles: entities.filter(e => e.type === "CIRCLE").length,
    others: entities.filter(e => !["LINE","LWPOLYLINE","POLYLINE","ARC","CIRCLE"].includes(e.type)).length,
    layers,
  };

  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "error") {
      if (issue.type === "duplicate_line") score -= Math.min(40, issue.entityIndices.length * 3);
      else if (issue.type === "open_polyline") score -= 15;
      else if (issue.type === "zero_length") score -= 5;
    } else {
      score -= 3;
    }
  }
  if (entities.length === 0) score = 0;
  score = Math.max(0, Math.min(100, score));

  return { entities, issues, stats, score, headerSection, tailSection };
}

export function repairDxf(content: string, analysis: DxfAnalysis): { fixed: string; repaired: DxfIssue[] } {
  const repairedIssues: DxfIssue[] = [];
  const toRemove = new Set<number>();

  const dupIssue = analysis.issues.find(i => i.type === "duplicate_line");
  if (dupIssue) {
    const seenKeys = new Set<string>();
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
  }

  for (const issue of analysis.issues) {
    if (issue.type === "zero_length") {
      toRemove.add(issue.entityIndices[0]);
      repairedIssues.push({ ...issue, fixed: true });
    }
  }

  const fixedEntities: DxfEntity[] = [];
  const openPolyIssues = analysis.issues.filter(i => i.type === "open_polyline");

  for (let i = 0; i < analysis.entities.length; i++) {
    if (toRemove.has(i)) continue;
    let entity = { ...analysis.entities[i] };

    const openIssue = openPolyIssues.find(iss => iss.entityIndices[0] === i);
    if (openIssue && entity.vertices && entity.vertices.length >= 2) {
      const first = entity.vertices[0];
      const last = entity.vertices[entity.vertices.length - 1];
      const gap = dist(first.x, first.y, last.x, last.y);
      if (gap < 1.0) {
        entity = { ...entity, closed: true };
        repairedIssues.push({ ...openIssue, fixed: true });
      }
    }
    fixedEntities.push(entity);
  }

  const entitiesSection = generateEntitiesSection(fixedEntities);
  const fixed = analysis.headerSection +
    "\n  0\nSECTION\n  2\nENTITIES\n" +
    entitiesSection +
    "\n  0\nENDSEC" +
    analysis.tailSection;

  return { fixed, repaired: repairedIssues };
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

  for (const e of entities) {
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
  }

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
    } else if (e.type === "LWPOLYLINE" && e.vertices && e.vertices.length > 1) {
      const pts = e.vertices.map(v => `${v.x},${flipY(v.y)}`);
      d = `M ${pts[0]} L ${pts.slice(1).join(" L ")}`;
      if (e.closed) d += " Z";
    }

    if (d) paths.push({ d, entityIndex: i, type: e.type, layer: e.layer });
  }
  return paths;
}
