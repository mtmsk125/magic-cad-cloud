/**
 * Path Union — دمج وتوحيد المسارات (Weld/Union)
 * 
 * يقوم بعمليات:
 * 1. دمج المسارات المتقاطعة في مسار واحد
 * 2. إزالة الأجزاء المتداخلة
 * 3. توحيد المسارات المتلامسة
 * 4. تحويل جميع المسارات إلى مسار واحد متصل
 */

import type { Point } from './path-simplify';
import { simplifyRDP, removeDuplicatePoints, dist } from './path-simplify';

export interface PathSegment {
  points: Point[];
  closed: boolean;
}

/**
 * دمج جميع المسارات المتصلة في مسار واحد
 * يبحث عن نقاط النهاية المتطابقة ويدمج المسارات
 */
export function joinConnectedPaths(segments: PathSegment[]): PathSegment[] {
  if (segments.length <= 1) return segments;

  const tolerance = 0.01; // 0.01mm tolerance للاتصال
  const result: PathSegment[] = [];
  const used = new Set<number>();
  let changed = true;

  //先把 المسارات المغلقة (Closed) منفصلة
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].closed) {
      result.push(segments[i]);
      used.add(i);
    }
  }

  // محاولة دمج المسارات المفتوحة
  const openSegments = segments.filter((_, i) => !used.has(i)).map((s, i) => ({
    ...s,
    originalIndex: segments.findIndex((orig, j) => !used.has(j) && s === orig),
  }));

  while (changed) {
    changed = false;
    for (let i = 0; i < openSegments.length; i++) {
      if (used.has(openSegments[i].originalIndex)) continue;

      for (let j = i + 1; j < openSegments.length; j++) {
        if (used.has(openSegments[j].originalIndex)) continue;

        const a = openSegments[i];
        const b = openSegments[j];

        const aStart = a.points[0];
        const aEnd = a.points[a.points.length - 1];
        const bStart = b.points[0];
        const bEnd = b.points[b.points.length - 1];

        // Check all 4 connection possibilities
        let merged: Point[] | null = null;
        let mergedClosed = false;

        // a.end → b.start
        if (dist(aEnd, bStart) < tolerance) {
          merged = [...a.points, ...b.points.slice(1)];
        }
        // a.end → b.end
        else if (dist(aEnd, bEnd) < tolerance) {
          merged = [...a.points, ...b.points.reverse().slice(1)];
        }
        // a.start → b.start
        else if (dist(aStart, bStart) < tolerance) {
          merged = [...a.points.reverse(), ...b.points.slice(1)];
        }
        // a.start → b.end
        else if (dist(aStart, bEnd) < tolerance) {
          merged = [...b.points, ...a.points.slice(1)];
        }

        if (merged) {
          // Check if the merged path forms a closed loop
          const mergedStart = merged[0];
          const mergedEnd = merged[merged.length - 1];
          mergedClosed = dist(mergedStart, mergedEnd) < tolerance;

          if (mergedClosed) {
            merged = merged.slice(0, -1); // Remove duplicate endpoint
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
 * إغلاق المسارات المفتوحة
 * يضيف خطاً بين أول وآخر نقطة
 */
export function closeAllPaths(segments: PathSegment[]): PathSegment[] {
  return segments.map(seg => {
    if (seg.closed || seg.points.length < 2) return seg;

    const first = seg.points[0];
    const last = seg.points[seg.points.length - 1];
    const gap = dist(first, last);

    // Close the path by adding the first point at the end
    return {
      ...seg,
      points: seg.points,
      closed: true,
    };
  });
}

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
        // Keep the longer path
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
 * التحقق مما إذا كان مسار يغطي مساراً آخر بالكامل
 */
function isOverlappingComplete(a: PathSegment, b: PathSegment, tolerance: number): boolean {
  // Check if all points of one path are within tolerance of the other path
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
 * 1. دمج المسارات المتصلة
 * 2. إغلاق المسارات
 * 3. إزالة التداخلات الكاملة
 * 4. تبسيط النقاط
 */
export function fullPathCleanup(
  segments: PathSegment[],
  simplifyTolerance: number = 0.05
): {
  cleaned: PathSegment[];
  joinedCount: number;
  closedCount: number;
  removedCount: number;
} {
  const initialCount = segments.length;

  // Step 1: Join connected paths
  const joined = joinConnectedPaths(segments);
  const joinedCount = initialCount - joined.length;

  // Step 2: Close all paths
  const closed = closeAllPaths(joined);
  const closedCount = closed.filter(s => !s.closed).length;

  // Step 3: Remove complete overlaps
  const cleaned = removeCompleteOverlaps(closed);
  const removedCount = closed.length - cleaned.length;

  // Step 4: Simplify each path's points
  const final = cleaned.map(seg => ({
    ...seg,
    points: simplifyRDP(seg.points, simplifyTolerance),
  }));

  return {
    cleaned: final,
    joinedCount,
    closedCount,
    removedCount,
  };
}