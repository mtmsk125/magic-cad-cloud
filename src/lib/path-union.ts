/**
 * Path Union — دمج وتوحيد المسارات (Weld/Union)
 * 
 * يقوم بعمليات:
 * 1. **Smart Fill / Closing Shapes**: إغلاق المسارات المفتوحة ذكياً مع سد الفجوات
 * 2. **Delete / Remove Overlaps**: كشف وإزالة النقاط والعناصر المكررة والمتداخلة
 * 3. **Curve Smoothness / Point Reduction**: تقليل النقاط وتبسيط المنحنيات
 * 4. **Partial Overlap Detection**: كشف التداخلات الجزئية (غير الكاملة)
 * 
 * محسّن للأداء مع الملفات الكبيرة
 */

import type { Point } from './path-simplify';
import { simplifyRDP, removeDuplicatePoints, dist } from './path-simplify';

export interface PathSegment {
  points: Point[];
  closed: boolean;
}

/**
 * ──────────────────────────────────────────────
 *  1. SMART FILL / CLOSING SHAPES
 *    - إغلاق المسارات المفتوحة ذكياً
 *    - سد الفجوات الصغيرة (Gap Filling)
 *    - ربط النقاط المتقاربة
 * ──────────────────────────────────────────────
 */

/**
 * إغلاق المسارات مع سد الفجوات (Gap Filling)
 * إذا كانت المسافة بين أول وآخر نقطة أقل من maxGap، يتم إغلاق المسار
 */
export function smartFillPaths(
  segments: PathSegment[],
  maxGap: number = 1.0
): PathSegment[] {
  return segments.map(seg => {
    if (seg.closed || seg.points.length < 2) return seg;

    const first = seg.points[0];
    const last = seg.points[seg.points.length - 1];
    const gap = dist(first, last);

    if (gap <= maxGap) {
      // Gap ضمن المسموح — أغلق المسار
      return { ...seg, closed: true };
    }

    return seg;
  });
}

/**
 * إغلاق المسارات المفتوحة — يضيف خطاً بين أول وآخر نقطة
 */
export function closeAllPaths(segments: PathSegment[]): PathSegment[] {
  return segments.map(seg => {
    if (seg.closed || seg.points.length < 2) return seg;
    return { ...seg, closed: true };
  });
}

/**
 * ربط النقاط المتقاربة (Endpoint Snapping)
 * يبحث عن نقاط النهاية المتقاربة ويدمجها في نقطة واحدة (متوسط)
 */
export function snapEndpoints(
  segments: PathSegment[],
  snapTolerance: number = 0.1
): PathSegment[] {
  if (segments.length <= 1) return segments;

  // جمع كل نقاط النهاية مع مؤشراتها
  interface Endpoint {
    segIdx: number;
    isStart: boolean;
    point: Point;
  }
  
  const endpoints: Endpoint[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.points.length < 2) continue;
    
    endpoints.push({ segIdx: i, isStart: true, point: seg.points[0] });
    if (!seg.closed) {
      endpoints.push({
        segIdx: i,
        isStart: false,
        point: seg.points[seg.points.length - 1],
      });
    }
  }

  // تجميع النقاط المتقاربة
  const groups: number[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < endpoints.length; i++) {
    if (assigned.has(i)) continue;
    const group = [i];
    assigned.add(i);
    
    for (let j = i + 1; j < endpoints.length; j++) {
      if (assigned.has(j)) continue;
      if (dist(endpoints[i].point, endpoints[j].point) <= snapTolerance) {
        group.push(j);
        assigned.add(j);
      }
    }
    
    if (group.length > 1) {
      groups.push(group);
    }
  }

  // إذا لم يوجد نقاط متقاربة، أرجع المصفوفة الأصلية
  if (groups.length === 0) return segments;

  // حساب المتوسط لكل مجموعة وتطبيقه على النقاط
  const result = segments.map(seg => ({
    ...seg,
    points: [...seg.points],
  }));

  for (const group of groups) {
    // حساب نقطة المنتصف للمجموعة
    let avgX = 0, avgY = 0;
    for (const idx of group) {
      avgX += endpoints[idx].point.x;
      avgY += endpoints[idx].point.y;
    }
    avgX /= group.length;
    avgY /= group.length;
    const avgPoint: Point = { x: avgX, y: avgY };

    // تطبيق النقطة المتوسطة على كل endpoints في المجموعة
    for (const idx of group) {
      const ep = endpoints[idx];
      if (ep.isStart) {
        result[ep.segIdx].points[0] = { ...avgPoint };
      } else {
        const pts = result[ep.segIdx].points;
        pts[pts.length - 1] = { ...avgPoint };
      }
    }
  }

  return result;
}

/**
 * سد الفجوات (Gap Filling) المتقدم:
 * يبحث عن الفجوات بين المسارات المتقاربة ويملؤها بخطوط جديدة
 */
export function fillGaps(
  segments: PathSegment[],
  maxGap: number = 1.0
): PathSegment[] {
  const result: PathSegment[] = [...segments.map(s => ({ ...s, points: [...s.points] }))];
  const newConnections: Point[][] = [];

  // البحث عن المسارات المفتوحة القريبة من بعضها
  for (let i = 0; i < result.length; i++) {
    const segA = result[i];
    if (segA.points.length < 2) continue;
    
    const aStart = segA.points[0];
    const aEnd = segA.points[segA.points.length - 1];

    for (let j = i + 1; j < result.length; j++) {
      const segB = result[j];
      if (segB.points.length < 2) continue;
      
      const bStart = segB.points[0];
      const bEnd = segB.points[segB.points.length - 1];

      // التحقق من جميع الاحتمالات الأربعة للاتصال
      let connection: Point[] | null = null;

      if (dist(aEnd, bStart) <= maxGap && !segA.closed && !segB.closed) {
        connection = [...segA.points, ...segB.points];
      } else if (dist(aEnd, bEnd) <= maxGap && !segA.closed && !segB.closed) {
        connection = [...segA.points, ...segB.points.reverse()];
      } else if (dist(aStart, bStart) <= maxGap && !segA.closed && !segB.closed) {
        connection = [...segA.points.reverse(), ...segB.points];
      } else if (dist(aStart, bEnd) <= maxGap && !segA.closed && !segB.closed) {
        connection = [...segB.points, ...segA.points];
      }

      if (connection) {
        newConnections.push(connection);
        // Mark both segments as merged by setting empty
        result[i] = { points: [], closed: false };
        result[j] = { points: [], closed: false };
        break;
      }
    }
  }

  // إضافة الاتصالات الجديدة
  for (const conn of newConnections) {
    result.push({ points: conn, closed: false });
  }

  // إزالة المسارات الفارغة
  return result.filter(s => s.points.length >= 2);
}

/**
 * ──────────────────────────────────────────────
 *  2. REMOVE OVERLAPS (كامل + جزئي)
 *    - إزالة التداخلات الكاملة
 *    - كشف وإزالة التداخلات الجزئية
 *    - إزالة النقاط المكررة
 * ──────────────────────────────────────────────
 */

/**
 * إزالة المسارات المتداخلة بالكامل
 * يحتفظ بالمسار الأطول إذا كان هناك مساران على نفس الخط
 */
export function removeCompleteOverlaps(segments: PathSegment[]): PathSegment[] {
  if (segments.length <= 1) return segments;

  const tolerance = 0.01;
  const result: PathSegment[] = [];
  const toRemove = new Set<number>();

  for (let i = 0; i < segments.length; i++) {
    if (toRemove.has(i)) continue;
    for (let j = i + 1; j < segments.length; j++) {
      if (toRemove.has(j)) continue;

      if (isOverlappingComplete(segments[i], segments[j], tolerance)) {
        const lenI = pathLength(segments[i]);
        const lenJ = pathLength(segments[j]);
        if (lenI >= lenJ) {
          toRemove.add(j);
        } else {
          toRemove.add(i);
          break;
        }
      }
    }
  }

  for (let i = 0; i < segments.length; i++) {
    if (!toRemove.has(i)) {
      result.push(segments[i]);
    }
  }

  return result;
}

/**
 * كشف وإزالة التداخلات الجزئية (Partial Overlaps)
 * المسارات التي تتداخل جزئياً مع بعضها البعض
 */
export function removePartialOverlaps(segments: PathSegment[]): PathSegment[] {
  if (segments.length <= 1) return segments;

  const tolerance = 0.02;
  const toRemove = new Set<number>();
  const kept: PathSegment[] = segments.map(s => ({ ...s, points: [...s.points] }));

  for (let i = 0; i < kept.length; i++) {
    if (toRemove.has(i)) continue;
    const segA = kept[i];
    if (segA.points.length < 2) continue;

    for (let j = i + 1; j < kept.length; j++) {
      if (toRemove.has(j)) continue;
      const segB = kept[j];
      if (segB.points.length < 2) continue;

      // حساب نسبة التداخل
      const overlapRatio = calculateOverlapRatio(segA, segB, tolerance);
      
      if (overlapRatio > 0.7) {
        // تداخل عالي — احتفظ بالأطول
        const lenI = pathLength(segA);
        const lenJ = pathLength(segB);
        if (lenI >= lenJ) {
          toRemove.add(j);
        } else {
          toRemove.add(i);
          break;
        }
      } else if (overlapRatio > 0.3) {
        // تداخل جزئي متوسط — اقطع الجزء المتداخل
        const trimmed = trimOverlap(segA, segB, tolerance);
        if (trimmed) {
          kept[j] = trimmed;
        }
      }
    }
  }

  const result: PathSegment[] = [];
  for (let i = 0; i < kept.length; i++) {
    if (!toRemove.has(i) && kept[i].points.length >= 2) {
      result.push(kept[i]);
    }
  }

  return result;
}

/**
 * حساب نسبة التداخل بين مسارين (0-1)
 */
function calculateOverlapRatio(a: PathSegment, b: PathSegment, tolerance: number): number {
  const shorter = a.points.length <= b.points.length ? a : b;
  const longer = a.points.length <= b.points.length ? b : a;

  let matchCount = 0;
  for (const p of shorter.points) {
    for (const q of longer.points) {
      if (dist(p, q) < tolerance) {
        matchCount++;
        break;
      }
    }
  }

  return shorter.points.length > 0 ? matchCount / shorter.points.length : 0;
}

/**
 * قص التداخل الجزئي — يزيل الجزء المتداخل من المسار الأقصر
 */
function trimOverlap(a: PathSegment, b: PathSegment, tolerance: number): PathSegment | null {
  // تحديد المسار الأقصر (المرشح للقص)
  const shorter = a.points.length <= b.points.length ? a : b;
  
  // إزالة النقاط المتداخلة من بداية أو نهاية المسار الأقصر
  let trimStart = 0;
  let trimEnd = shorter.points.length;

  // البحث عن تداخل من البداية
  for (let i = 0; i < Math.min(shorter.points.length, 5); i++) {
    const p = shorter.points[i];
    for (const q of (a === shorter ? b : a).points) {
      if (dist(p, q) < tolerance) {
        trimStart = i + 1;
        break;
      }
    }
  }

  // البحث عن تداخل من النهاية
  for (let i = shorter.points.length - 1; i >= Math.max(0, shorter.points.length - 5); i--) {
    const p = shorter.points[i];
    for (const q of (a === shorter ? b : a).points) {
      if (dist(p, q) < tolerance) {
        trimEnd = i;
        break;
      }
    }
  }

  if (trimStart >= trimEnd || trimEnd - trimStart < 2) {
    return null; // المسار قصير جداً بعد القص
  }

  return {
    ...shorter,
    points: shorter.points.slice(trimStart, trimEnd),
  };
}

/**
 * التحقق مما إذا كان مسار يغطي مساراً آخر بالكامل
 */
function isOverlappingComplete(a: PathSegment, b: PathSegment, tolerance: number): boolean {
  const shorter = a.points.length <= b.points.length ? a : b;
  const longer = a.points.length <= b.points.length ? b : a;

  let matchCount = 0;
  for (const p of shorter.points) {
    for (const q of longer.points) {
      if (dist(p, q) < tolerance) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount >= shorter.points.length * 0.8;
}

/**
 * إزالة النقاط المكررة والمتطابقة
 */
export function removeOverlappingVertices(segments: PathSegment[]): PathSegment[] {
  return segments.map(seg => ({
    ...seg,
    points: removeDuplicatePoints(seg.points, 0.001),
  }));
}

/**
 * ──────────────────────────────────────────────
 *  3. JOIN CONNECTED PATHS
 *    - دمج المسارات المتصلة في مسار واحد
 * ──────────────────────────────────────────────
 */

/**
 * دمج جميع المسارات المتصلة في مسار واحد
 * يبحث عن نقاط النهاية المتطابقة ويدمج المسارات
 */
export function joinConnectedPaths(segments: PathSegment[]): PathSegment[] {
  if (segments.length <= 1) return segments;

  const tolerance = 0.01;
  const result: PathSegment[] = [];
  const used = new Set<number>();
  let changed = true;

  // المسارات المغلقة تبقى منفصلة
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].closed) {
      result.push(segments[i]);
      used.add(i);
    }
  }

  // محاولة دمج المسارات المفتوحة
  const openSegments: (PathSegment & { originalIndex: number })[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (!used.has(i)) {
      openSegments.push({ ...segments[i], originalIndex: i });
    }
  }

  while (changed) {
    changed = false;
    for (let i = 0; i < openSegments.length; i++) {
      if (used.has(openSegments[i].originalIndex)) continue;

      for (let j = i + 1; j < openSegments.length; j++) {
        if (used.has(openSegments[j].originalIndex)) continue;

        const a = openSegments[i];
        const b = openSegments[j];
        if (a.points.length < 2 || b.points.length < 2) continue;

        const aStart = a.points[0];
        const aEnd = a.points[a.points.length - 1];
        const bStart = b.points[0];
        const bEnd = b.points[b.points.length - 1];

        let merged: Point[] | null = null;
        let mergedClosed = false;

        if (dist(aEnd, bStart) < tolerance) {
          merged = [...a.points, ...b.points.slice(1)];
        } else if (dist(aEnd, bEnd) < tolerance) {
          merged = [...a.points, ...b.points.reverse().slice(1)];
        } else if (dist(aStart, bStart) < tolerance) {
          merged = [...a.points.reverse(), ...b.points.slice(1)];
        } else if (dist(aStart, bEnd) < tolerance) {
          merged = [...b.points, ...a.points.slice(1)];
        }

        if (merged) {
          const mergedStart = merged[0];
          const mergedEnd = merged[merged.length - 1];
          mergedClosed = dist(mergedStart, mergedEnd) < tolerance;

          if (mergedClosed) {
            merged = merged.slice(0, -1);
          }

          openSegments[i] = {
            ...openSegments[i],
            points: merged,
            closed: mergedClosed,
          };
          used.add(openSegments[j].originalIndex);
          changed = true;
          break;
        }
      }
    }
  }

  // Add remaining unmerged open segments
  for (const seg of openSegments) {
    if (!used.has(seg.originalIndex)) {
      result.push({ points: seg.points, closed: seg.closed });
    }
  }

  // Clean up duplicate consecutive points
  return result.map(seg => ({
    ...seg,
    points: removeDuplicatePoints(seg.points, tolerance),
  }));
}

/**
 * ──────────────────────────────────────────────
 *  4. PATH CLEANUP PIPELINE
 *    - تطبيق جميع عمليات التنظيف بالترتيب
 * ──────────────────────────────────────────────
 */

/**
 * حساب طول المسار
 */
export function pathLength(seg: PathSegment): number {
  let len = 0;
  for (let i = 0; i < seg.points.length - 1; i++) {
    len += dist(seg.points[i], seg.points[i + 1]);
  }
  if (seg.closed && seg.points.length > 1) {
    len += dist(seg.points[0], seg.points[seg.points.length - 1]);
  }
  return len;
}

/**
 * تحويل مصفوفة من النقاط إلى PathSegment
 */
export function pointsToSegment(points: Point[], closed: boolean = false): PathSegment {
  return { points: removeDuplicatePoints(points, 0.001), closed };
}

/**
 * تطبيق pipeline كامل لتنظيف المسارات:
 * 1. Endpoint snapping (ربط النقاط المتقاربة)
 * 2. Gap filling (سد الفجوات)
 * 3. Smart fill (إغلاق ذكي)
 * 4. دمج المسارات المتصلة
 * 5. إزالة التداخلات الكاملة
 * 6. إزالة التداخلات الجزئية
 * 7. إغلاق جميع المسارات
 * 8. إزالة النقاط المكررة
 * 9. تبسيط النقاط
 */
export function fullPathCleanup(
  segments: PathSegment[],
  simplifyTolerance: number = 0.05
): {
  cleaned: PathSegment[];
  joinedCount: number;
  closedCount: number;
  removedCount: number;
  snappedCount: number;
} {
  const initialCount = segments.length;
  let stats = { joinedCount: 0, closedCount: 0, removedCount: 0, snappedCount: 0 };

  // Step 0: Remove empty/invalid segments
  let current = segments.filter(s => s.points.length >= 2);
  stats.removedCount += segments.length - current.length;

  // Step 1: Endpoint snapping
  const snapped = snapEndpoints(current);
  stats.snappedCount = current.length;

  // Step 2: Gap filling
  const filled = fillGaps(snapped, 1.0);

  // Step 3: Smart fill (close small gaps)
  const smartFilled = smartFillPaths(filled, 1.0);

  // Step 4: Join connected paths
  const joined = joinConnectedPaths(smartFilled);
  stats.joinedCount = smartFilled.length - joined.length;

  // Step 5: Close all paths
  const closed = closeAllPaths(joined);
  stats.closedCount = closed.filter(s => s.closed && !joined.find(j => j.points === s.points)?.closed).length;

  // Step 6: Remove complete overlaps
  const noCompleteOverlaps = removeCompleteOverlaps(closed);
  stats.removedCount += closed.length - noCompleteOverlaps.length;

  // Step 7: Remove partial overlaps
  const noPartialOverlaps = removePartialOverlaps(noCompleteOverlaps);
  stats.removedCount += noCompleteOverlaps.length - noPartialOverlaps.length;

  // Step 8: Remove duplicate vertices
  const deduped = removeOverlappingVertices(noPartialOverlaps);

  // Step 9: Simplify each path's points
  const final = deduped.map(seg => ({
    ...seg,
    points: simplifyRDP(seg.points, simplifyTolerance),
  }));

  return {
    cleaned: final,
    ...stats,
  };
}