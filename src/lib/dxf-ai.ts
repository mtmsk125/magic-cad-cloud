/**
 * DXFix AI-Powered DXF Enhancement Engine
 * 
 * Algorithms améliorés pour la détection et la réparation intelligente des fichiers DXF
 * محسّنات ذكية لمعالجة ملفات DXF
 * 
 * Implémente des algorithmes de détection avancée:
 * 1. Détection des lignes en collision/chevauchantes
 * 2. Détection des auto-intersections
 * 3. Fusion intelligente des vecteurs proches
 * 4. Nettoyage intelligent des doublons pour tous types d'entités
 */

import type { DxfEntity, DxfIssue, DxfAnalysis } from './dxf';

// ─── Utilitaires géométriques ──────────────────────────────────────────────

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function crossProduct(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function dotProduct(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

function normalizeAngle(angle: number): number {
  while (angle < 0) angle += Math.PI;
  while (angle >= Math.PI) angle -= Math.PI;
  return angle;
}

/**
 * Vérifie si deux segments [a-b] et [c-d] se croisent
 */
function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
): { intersect: boolean; x: number; y: number } {
  const d1x = bx - ax, d1y = by - ay;
  const d2x = dx - cx, d2y = dy - cy;
  const denom = crossProduct(d1x, d1y, d2x, d2y);

  if (Math.abs(denom) < 1e-10) return { intersect: false, x: 0, y: 0 };

  const t = crossProduct(cx - ax, cy - ay, d2x, d2y) / denom;
  const u = crossProduct(cx - ax, cy - ay, d1x, d1y) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      intersect: true,
      x: ax + t * d1x,
      y: ay + t * d1y,
    };
  }
  return { intersect: false, x: 0, y: 0 };
}

/**
 * Vérifie si deux segments sont colinéaires et se chevauchent
 */
function segmentsOverlap(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
): { overlap: boolean; t1: number; t2: number } {
  const d1x = bx - ax, d1y = by - ay;
  const len1 = dist(ax, ay, bx, by);
  if (len1 < 1e-10) return { overlap: false, t1: 0, t2: 0 };

  // Project c and d onto the line a-b
  const proj = (px: number, py: number) => {
    return dotProduct(px - ax, py - ay, d1x, d1y) / (len1 * len1);
  };

  const tc = proj(cx, cy);
  const td = proj(dx, dy);

  // Check if the perpendicular distance is small (collinear)
  const perpDist = (px: number, py: number) => {
    const t = proj(px, py);
    const projX = ax + t * d1x;
    const projY = ay + t * d1y;
    return dist(px, py, projX, projY);
  };

  const EPS = 0.01; // 0.01mm tolerance
  if (perpDist(cx, cy) > EPS || perpDist(dx, dy) > EPS) {
    return { overlap: false, t1: 0, t2: 0 };
  }

  // Find overlap interval
  const tStart = Math.max(0, Math.min(tc, td));
  const tEnd = Math.min(1, Math.max(tc, td));

  if (tEnd - tStart > 0.01) {
    return { overlap: true, t1: tStart, t2: tEnd };
  }
  return { overlap: false, t1: 0, t2: 0 };
}

/**
 * Obtient les points clés d'une entité DXF pour analyse
 */
function getEntityPoints(e: DxfEntity): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];

  if (e.type === "LINE") {
    points.push({ x: e.x1 ?? 0, y: e.y1 ?? 0 });
    points.push({ x: e.x2 ?? 0, y: e.y2 ?? 0 });
  } else if (e.type === "LWPOLYLINE" && e.vertices) {
    for (const v of e.vertices) {
      points.push({ x: v.x, y: v.y });
    }
  } else if (e.type === "POLYLINE" && e.vertices) {
    for (const v of e.vertices) {
      points.push({ x: v.x, y: v.y });
    }
  } else if (e.type === "SPLINE" && e.vertices) {
    for (const v of e.vertices) {
      points.push({ x: v.x, y: v.y });
    }
  } else if (e.type === "CIRCLE" || e.type === "ARC") {
    const cx = e.cx ?? 0, cy = e.cy ?? 0, r = e.radius ?? 0;
    // Ajoute 4 points de contrôle du cercle
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * 2 * Math.PI;
      points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
  }

  return points;
}

/**
 * Obtient les paires de segments pour chaque entité
 */
function getEntitySegments(e: DxfEntity): { x1: number; y1: number; x2: number; y2: number }[] {
  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];

  if (e.type === "LINE") {
    segments.push({ x1: e.x1 ?? 0, y1: e.y1 ?? 0, x2: e.x2 ?? 0, y2: e.y2 ?? 0 });
  } else if ((e.type === "LWPOLYLINE" || e.type === "POLYLINE") && e.vertices) {
    for (let i = 0; i < e.vertices.length - 1; i++) {
      segments.push({
        x1: e.vertices[i].x,
        y1: e.vertices[i].y,
        x2: e.vertices[i + 1].x,
        y2: e.vertices[i + 1].y,
      });
    }
    if (e.closed && e.vertices.length > 1) {
      const first = e.vertices[0];
      const last = e.vertices[e.vertices.length - 1];
      segments.push({
        x1: last.x,
        y1: last.y,
        x2: first.x,
        y2: first.y,
      });
    }
  } else if (e.type === "SPLINE" && e.vertices) {
    for (let i = 0; i < e.vertices.length - 1; i++) {
      segments.push({
        x1: e.vertices[i].x,
        y1: e.vertices[i].y,
        x2: e.vertices[i + 1].x,
        y2: e.vertices[i + 1].y,
      });
    }
  }

  return segments;
}

// ─── Algorithmes de détection avancés ─────────────────────────────────────

/**
 * Détecte les lignes qui se croisent (crossing lines)
 * Ces intersections indésirables peuvent causer des problèmes de coupe
 */
export function detectCrossingLines(entities: DxfEntity[]): DxfIssue[] {
  const issues: DxfIssue[] = [];
  const allSegments: { x1: number; y1: number; x2: number; y2: number; entityIdx: number }[] = [];

  // Collecte tous les segments avec leur index d'entité
  for (let i = 0; i < entities.length; i++) {
    const segs = getEntitySegments(entities[i]);
    for (const seg of segs) {
      allSegments.push({ ...seg, entityIdx: i });
    }
  }

  // Vérifie chaque paire de segments
  const checkedPairs = new Set<string>();
  for (let i = 0; i < allSegments.length; i++) {
    const a = allSegments[i];
    for (let j = i + 1; j < allSegments.length; j++) {
      const b = allSegments[j];
      
      // Ignorer les segments de la même entité
      if (a.entityIdx === b.entityIdx) continue;

      const pairKey = `${Math.min(a.entityIdx, b.entityIdx)}-${Math.max(a.entityIdx, b.entityIdx)}`;
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      // Vérifie les extrémités partagées (les segments adjacents ne sont pas des croisements)
      const sharedEndpoints = 
        (dist(a.x1, a.y1, b.x1, b.y1) < 0.01) ||
        (dist(a.x1, a.y1, b.x2, b.y2) < 0.01) ||
        (dist(a.x2, a.y2, b.x1, b.y1) < 0.01) ||
        (dist(a.x2, a.y2, b.x2, b.y2) < 0.01);

      if (sharedEndpoints) continue;

      const result = segmentsIntersect(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1, b.x2, b.y2);
      if (result.intersect) {
        const entityA = entities[a.entityIdx];
        const entityB = entities[b.entityIdx];
        issues.push({
          id: `crossing_${a.entityIdx}_${b.entityIdx}`,
          type: "overlapping_lines",
          severity: "error",
          ar: `تقاطع خطوط بين "${entityA.layer}" و "${entityB.layer}" عند (${result.x.toFixed(2)}, ${result.y.toFixed(2)})`,
          en: `Crossing lines between "${entityA.layer}" and "${entityB.layer}" at (${result.x.toFixed(2)}, ${result.y.toFixed(2)})`,
          entityIndices: [a.entityIdx, b.entityIdx],
          fixed: false,
        });
      }
    }
  }

  return issues;
}

/**
 * Détecte les auto-intersections dans les polylignes et splines
 */
export function detectSelfIntersections(entities: DxfEntity[]): DxfIssue[] {
  const issues: DxfIssue[] = [];

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    const verts = e.vertices;
    if (!verts || verts.length < 4) continue; // Need at least 4 points for self-intersection

    // Check each segment pair within the same entity
    for (let j = 0; j < verts.length - 1; j++) {
      for (let k = j + 2; k < verts.length - 1; k++) {
        // Skip adjacent segments (they share an endpoint)
        if (k === j + 1) continue;
        // For closed polylines, also skip the wrap-around pair
        if (e.closed && j === 0 && k === verts.length - 2) continue;

        const result = segmentsIntersect(
          verts[j].x, verts[j].y, verts[j + 1].x, verts[j + 1].y,
          verts[k].x, verts[k].y, verts[k + 1].x, verts[k + 1].y
        );

        if (result.intersect) {
          const existing = issues.find(iss => 
            iss.type === "self_intersect" && iss.entityIndices[0] === i
          );
          if (!existing) {
            issues.push({
              id: `self_intersect_${i}`,
              type: "self_intersect",
              severity: "error",
              ar: `تقاطع ذاتي في بوليلاين "${e.layer}" — سيسبب قطع غير صحيح`,
              en: `Self-intersecting polyline on "${e.layer}" — will cause incorrect cutting`,
              entityIndices: [i],
              fixed: false,
            });
            break;
          }
        }
      }
      if (issues.some(iss => iss.type === "self_intersect" && iss.entityIndices[0] === i)) break;
    }
  }

  return issues;
}

/**
 * Détecte les segments colinéaires qui se chevauchent (overlapping collinear lines)
 * Ceci étend la détection de base des lignes dupliquées
 */
export function detectCollinearOverlaps(entities: DxfEntity[]): DxfIssue[] {
  const issues: DxfIssue[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < entities.length; i++) {
    const e1 = entities[i];
    if (e1.type !== "LINE") continue;
    const ax = e1.x1 ?? 0, ay = e1.y1 ?? 0;
    const bx = e1.x2 ?? 0, by = e1.y2 ?? 0;
    const len1 = dist(ax, ay, bx, by);
    if (len1 < 0.001) continue;

    for (let j = i + 1; j < entities.length; j++) {
      const pairKey = `${i}-${j}`;
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const e2 = entities[j];
      if (e2.type !== "LINE") continue;
      const cx = e2.x1 ?? 0, cy = e2.y1 ?? 0;
      const dx = e2.x2 ?? 0, dy = e2.y2 ?? 0;

      const result = segmentsOverlap(ax, ay, bx, by, cx, cy, dx, dy);
      if (result.overlap) {
        issues.push({
          id: `overlap_${i}_${j}`,
          type: "overlapping_lines",
          severity: "warning",
          ar: `خطوط متداخلة في الطبقات "${e1.layer}" و "${e2.layer}"`,
          en: `Overlapping lines on layers "${e1.layer}" and "${e2.layer}"`,
          entityIndices: [i, j],
          fixed: false,
        });
        break; // One issue per pair
      }
    }
  }

  return issues;
}

/**
 * Détection améliorée des doublons pour tous types d'entités (pas seulement les lignes)
 */
export function detectSmartDuplicates(entities: DxfEntity[]): DxfIssue[] {
  const issues: DxfIssue[] = [];
  const seenEntities = new Map<string, number[]>();

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    const points = getEntityPoints(e);
    
    // Crée une signature unique basée sur les points pour la comparaison
    const signature = points
      .map(p => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)
      .sort()
      .join("|");

    if (e.type === "LINE") {
      // Pour les lignes, utilise aussi l'ordre inverse
      const revSignature = points
        .slice()
        .reverse()
        .map(p => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)
        .sort()
        .join("|");
      
      const sigs = [signature, revSignature];
      for (const sig of sigs) {
        if (seenEntities.has(sig)) {
          seenEntities.get(sig)!.push(i);
        } else {
          seenEntities.set(sig, [i]);
        }
      }
    } else {
      if (seenEntities.has(signature)) {
        seenEntities.get(signature)!.push(i);
      } else {
        seenEntities.set(signature, [i]);
      }
    }
  }

  for (const [sig, indices] of seenEntities) {
    if (indices.length > 1) {
      const types = [...new Set(indices.map(idx => entities[idx].type))];
      const layers = [...new Set(indices.map(idx => entities[idx].layer))];
      
      issues.push({
        id: `smart_duplicate_${indices[0]}`,
        type: "duplicate_line",
        severity: "error",
        ar: `عناصر مكررة (${types.join(", ")}) في الطبقات (${layers.join(", ")}) — ${indices.length} نسخة`,
        en: `Duplicate entities (${types.join(", ")}) on layers (${layers.join(", ")}) — ${indices.length} copies`,
        entityIndices: indices,
        fixed: false,
      });
    }
  }

  return issues;
}

/**
 * Analyse avancée: combine tous les détecteurs intelligents
 */
export function enhancedAnalyze(entities: DxfEntity[], baseIssues: DxfIssue[]): DxfIssue[] {
  const allIssues = [...baseIssues];

  // 1. Détection des auto-intersections
  const selfIntersections = detectSelfIntersections(entities);
  for (const issue of selfIntersections) {
    if (!allIssues.some(ex => ex.type === issue.type && ex.entityIndices[0] === issue.entityIndices[0])) {
      allIssues.push(issue);
    }
  }

  // 2. Détection des lignes qui se croisent
  const crossingLines = detectCrossingLines(entities);
  for (const issue of crossingLines) {
    if (!allIssues.some(ex => ex.type === issue.type && 
      ex.entityIndices[0] === issue.entityIndices[0] &&
      ex.entityIndices[1] === issue.entityIndices[1])) {
      allIssues.push(issue);
    }
  }

  // 3. Détection des chevauchements colinéaires
  const collinearOverlaps = detectCollinearOverlaps(entities);
  for (const issue of collinearOverlaps) {
    if (!allIssues.some(ex => ex.type === "overlapping_lines" &&
      ex.entityIndices[0] === issue.entityIndices[0])) {
      allIssues.push(issue);
    }
  }

  // 4. Détection intelligente des doublons pour tous types d'entités
  const smartDuplicates = detectSmartDuplicates(entities);
  for (const issue of smartDuplicates) {
    const existingDuplicate = allIssues.find(ex => ex.type === "duplicate_line");
    if (existingDuplicate) {
      // Fusionne les indices
      for (const idx of issue.entityIndices) {
        if (!existingDuplicate.entityIndices.includes(idx)) {
          existingDuplicate.entityIndices.push(idx);
        }
      }
      existingDuplicate.ar += ` + ${issue.entityIndices.length} نسخ إضافية`;
      existingDuplicate.en += ` + ${issue.entityIndices.length} extra copies`;
    } else {
      allIssues.push(issue);
    }
  }

  return allIssues;
}

/**
 * Calcule un score amélioré basé sur l'analyse intelligente
 */
export function calculateEnhancedScore(baseScore: number, aiIssues: DxfIssue[]): number {
  let score = baseScore;

  for (const issue of aiIssues) {
    if (issue.fixed) continue;
    
    if (issue.type === "self_intersect") {
      score -= 20; // Les auto-intersections sont graves
    } else if (issue.type === "overlapping_lines") {
      score -= 10;
    } else if (issue.type === "duplicate_line" && issue.entityIndices.length > 2) {
      score -= Math.min(30, issue.entityIndices.length * 2);
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Génère des suggestions de réparation améliorées
 */
export function generateEnhancedFixSummary(aiIssues: DxfIssue[], lang: "ar" | "en"): string[] {
  const suggestions: string[] = [];

  const selfIntersectCount = aiIssues.filter(i => i.type === "self_intersect" && !i.fixed).length;
  const overlapCount = aiIssues.filter(i => i.type === "overlapping_lines" && !i.fixed).length;
  const crossingCount = aiIssues.filter(i => i.id.startsWith("crossing") && !i.fixed).length;
  const enhancedDupCount = aiIssues.filter(i => i.id.startsWith("smart_duplicate") && !i.fixed).length;

  if (selfIntersectCount > 0) {
    suggestions.push(
      lang === "ar"
        ? `🔧 ${selfIntersectCount} بوليلاين فيها تقاطعات ذاتية — تحتاج إعادة بناء المسار`
        : `🔧 ${selfIntersectCount} polyline(s) with self-intersections — needs path reconstruction`
    );
  }

  if (overlapCount > 0) {
    suggestions.push(
      lang === "ar"
        ? `✂️ ${overlapCount} خطوط متداخلة — سيتم دمجها لتجنب القطع المزدوج`
        : `✂️ ${overlapCount} overlapping line(s) — will be merged to avoid double-cutting`
    );
  }

  if (crossingCount > 0) {
    suggestions.push(
      lang === "ar"
        ? `⚠️ ${crossingCount} تقاطع بين خطوط مختلفة — قد يسبب قطع غير متوقع`
        : `⚠️ ${crossingCount} crossing(s) between different lines — may cause unexpected cutting`
    );
  }

  if (enhancedDupCount > 0) {
    suggestions.push(
      lang === "ar"
        ? `🔄 ${enhancedDupCount} عناصر مكررة متقدمة — سيتم إزالة النسخ الإضافية`
        : `🔄 ${enhancedDupCount} advanced duplicate(s) — extra copies will be removed`
    );
  }

  if (suggestions.length === 0) {
    suggestions.push(
      lang === "ar"
        ? "✅ لا توجد مشاكل إضافية — الملف جاهز للقص"
        : "✅ No additional issues found — file is ready for cutting"
    );
  }

  return suggestions;
}