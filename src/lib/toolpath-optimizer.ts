/**
 * Toolpath Optimizer — تحسين مسارات القطع لتقليل وقت الماكينة
 * 
 * يستخدم خوارزمية Nearest Neighbor (TSP approximation)
 * لترتيب مسارات القطع بأقصر مسافة انتقال ممكنة
 */

import type { Point } from './path-simplify';
import { dist } from './path-simplify';

export interface CuttingPath {
  id: number;
  points: Point[];
  closed: boolean;
  layer: string;
  length: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number; cx: number; cy: number };
}

/**
 * حساب bounds للمسار
 */
function calculateBounds(points: Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX, minY, maxX, maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

/**
 * تحويل المسارات إلى CuttingPath objects
 */
export function pathsToCuttingPaths(
  segments: { points: Point[]; closed: boolean; layer?: string }[]
): CuttingPath[] {
  return segments.map((seg, i) => {
    const bounds = calculateBounds(seg.points);
    let length = 0;
    for (let j = 0; j < seg.points.length - 1; j++) {
      length += dist(seg.points[j], seg.points[j + 1]);
    }
    if (seg.closed && seg.points.length > 1) {
      length += dist(seg.points[0], seg.points[seg.points.length - 1]);
    }
    return {
      id: i,
      points: seg.points,
      closed: seg.closed,
      layer: seg.layer || '0',
      length,
      bounds,
    };
  });
}

/**
 * ترتيب المسارات باستخدام Nearest Neighbor
 * يبدأ من أقرب مسار لنقطة البداية (0,0) ثم يبحث عن أقرب مسار تالٍ
 */
export function optimizeToolpath(
  paths: CuttingPath[],
  startPoint: Point = { x: 0, y: 0 }
): {
  orderedPaths: CuttingPath[];
  totalTravelDistance: number;
  totalCutDistance: number;
  optimizationGain: number;
} {
  if (paths.length <= 1) {
    const totalCut = paths.reduce((s, p) => s + p.length, 0);
    return {
      orderedPaths: paths,
      totalTravelDistance: 0,
      totalCutDistance: totalCut,
      optimizationGain: 0,
    };
  }

  // Calculate original (unsorted) travel distance
  const originalTravel = calculateTotalTravel(paths);

  const remaining = new Set(paths.map(p => p.id));
  const ordered: CuttingPath[] = [];
  let currentPoint = startPoint;
  let totalTravel = 0;

  while (remaining.size > 0) {
    let nearestId = -1;
    let nearestDist = Infinity;
    let nearestStart: Point = { x: 0, y: 0 };

    // Find nearest path to current point
    for (const id of remaining) {
      const path = paths.find(p => p.id === id)!;
      
      // Check distance to both start and end of path
      const toStart = dist(currentPoint, path.points[0]);
      const toEnd = dist(currentPoint, path.points[path.points.length - 1]);
      
      if (toStart < nearestDist) {
        nearestDist = toStart;
        nearestId = id;
        nearestStart = path.points[0];
      }
      if (toEnd < nearestDist) {
        nearestDist = toEnd;
        nearestId = id;
        nearestStart = path.points[path.points.length - 1];
      }
    }

    if (nearestId === -1) break;

    const nearestPath = paths.find(p => p.id === nearestId)!;
    
    // Decide direction: if end is closer, reverse the path
    const distToStart = dist(currentPoint, nearestPath.points[0]);
    const distToEnd = dist(currentPoint, nearestPath.points[nearestPath.points.length - 1]);
    
    let orderedPath: CuttingPath;
    if (distToStart <= distToEnd) {
      orderedPath = nearestPath;
      currentPoint = nearestPath.points[nearestPath.points.length - 1];
    } else {
      // Reverse the path
      orderedPath = {
        ...nearestPath,
        points: [...nearestPath.points].reverse(),
      };
      currentPoint = orderedPath.points[orderedPath.points.length - 1];
    }

    totalTravel += nearestDist;
    ordered.push(orderedPath);
    remaining.delete(nearestId);
  }

  const totalCut = ordered.reduce((s, p) => s + p.length, 0);
  const optimizationGain = originalTravel > 0 
    ? Math.round(((originalTravel - totalTravel) / originalTravel) * 100) 
    : 0;

  return {
    orderedPaths: ordered,
    totalTravelDistance: totalTravel,
    totalCutDistance: totalCut,
    optimizationGain,
  };
}

/**
 * حساب مسافة الانتقال الكلية لترتيب معين
 */
function calculateTotalTravel(paths: CuttingPath[]): number {
  if (paths.length <= 1) return 0;
  let travel = 0;
  let prev = paths[0].points[paths[0].points.length - 1];
  for (let i = 1; i < paths.length; i++) {
    travel += dist(prev, paths[i].points[0]);
    prev = paths[i].points[paths[i].points.length - 1];
  }
  return travel;
}

/**
 * ترتيب المسارات حسب الحجم (من الأصغر إلى الأكبر)
 * هذا مفيد للقطع الداخلي أولاً
 */
export function sortBySize(paths: CuttingPath[]): CuttingPath[] {
  return [...paths].sort((a, b) => {
    const areaA = (a.bounds.maxX - a.bounds.minX) * (a.bounds.maxY - a.bounds.minY);
    const areaB = (b.bounds.maxX - b.bounds.minX) * (b.bounds.maxY - b.bounds.minY);
    return areaA - areaB;
  });
}

/**
 * ترتيب المسارات حسب الطبقة
 */
export function sortByLayer(paths: CuttingPath[]): CuttingPath[] {
  return [...paths].sort((a, b) => a.layer.localeCompare(b.layer));
}

/**
 * تحسين متقدم: يجمع بين الترتيب حسب الحجم + Nearest Neighbor
 * 1. يرتب حسب الحجم (داخلي → خارجي)
 * 2. يطبق Nearest Neighbor داخل كل مجموعة حجم
 */
export function advancedOptimize(
  paths: CuttingPath[],
  startPoint: Point = { x: 0, y: 0 }
): {
  orderedPaths: CuttingPath[];
  totalTravelDistance: number;
  totalCutDistance: number;
  optimizationGain: number;
} {
  if (paths.length <= 1) {
    const totalCut = paths.reduce((s, p) => s + p.length, 0);
    return {
      orderedPaths: paths,
      totalTravelDistance: 0,
      totalCutDistance: totalCut,
      optimizationGain: 0,
    };
  }

  // Step 1: Sort by size (smallest first = inside first)
  const bySize = sortBySize(paths);

  // Step 2: Group by size ranges
  const groups: CuttingPath[][] = [];
  const sortedAreas = bySize.map(p => (p.bounds.maxX - p.bounds.minX) * (p.bounds.maxY - p.bounds.minY));
  const maxArea = Math.max(...sortedAreas);
  const minArea = Math.min(...sortedAreas);
  const range = maxArea - minArea;
  const numGroups = Math.min(5, Math.ceil(paths.length / 3));

  if (range < 0.001 || numGroups <= 1) {
    // All similar size, just optimize normally
    return optimizeToolpath(paths, startPoint);
  }

  const groupSize = range / numGroups;
  for (let g = 0; g < numGroups; g++) {
    groups.push([]);
  }

  for (const p of bySize) {
    const area = (p.bounds.maxX - p.bounds.minX) * (p.bounds.maxY - p.bounds.minY);
    const groupIdx = Math.min(numGroups - 1, Math.floor((area - minArea) / groupSize));
    groups[groupIdx].push(p);
  }

  // Step 3: Optimize each group with Nearest Neighbor
  const orderedPaths: CuttingPath[] = [];
  let currentPoint = startPoint;
  let totalTravel = 0;

  for (const group of groups) {
    if (group.length === 0) continue;
    
    const result = optimizeToolpath(group, currentPoint);
    orderedPaths.push(...result.orderedPaths);
    totalTravel += result.totalTravelDistance;
    
    if (result.orderedPaths.length > 0) {
      const last = result.orderedPaths[result.orderedPaths.length - 1];
      currentPoint = last.points[last.points.length - 1];
    }
  }

  const totalCut = orderedPaths.reduce((s, p) => s + p.length, 0);
  const originalTravel = calculateTotalTravel(paths);
  const optimizationGain = originalTravel > 0
    ? Math.round(((originalTravel - totalTravel) / originalTravel) * 100)
    : 0;

  return {
    orderedPaths,
    totalTravelDistance: totalTravel,
    totalCutDistance: totalCut,
    optimizationGain,
  };
}

/**
 * توليد إحصائيات التحسين
 */
export function generateOptimizationReport(
  original: CuttingPath[],
  optimized: CuttingPath[],
  travelDistance: number,
  gain: number
): string[] {
  const originalCut = original.reduce((s, p) => s + p.length, 0);
  const optimizedCut = optimized.reduce((s, p) => s + p.length, 0);

  return [
    `📐 تحسين مسار القص (Toolpath Optimization)`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `عدد المسارات الأصلية: ${original.length}`,
    `عدد المسارات بعد التحسين: ${optimized.length}`,
    `مسافة القطع الإجمالية: ${originalCut.toFixed(2)} مم`,
    `مسافة الانتقال الإجمالية: ${travelDistance.toFixed(2)} مم`,
    `نسبة التحسين: ${gain}%`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `✅ تم ترتيب المسارات لتقليل حركة رأس الليزر`,
  ];
}