/**
 * Path Simplify — تقليل عدد النقاط مع الحفاظ على الشكل
 * 
 * يستخدم خوارزمية Ramer-Douglas-Peucker (RDP) لتبسيط المنحنيات
 * مع دعم تحويل المنحنيات إلى Bezier Curves للحصول على أنظف شكل
 */

export interface Point {
  x: number;
  y: number;
}

export interface BezierCurve {
  start: Point;
  cp1: Point;
  cp2: Point;
  end: Point;
}

/**
 * Ramer-Douglas-Peucker algorithm
 * يقلل عدد النقاط مع الحفاظ على الشكل ضمن tolerance معين
 */
export function simplifyRDP(
  points: Point[],
  tolerance: number = 0.05,
  highQuality: boolean = true
): Point[] {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDist > tolerance) {
    const left = simplifyRDP(points.slice(0, maxIdx + 1), tolerance, highQuality);
    const right = simplifyRDP(points.slice(maxIdx), tolerance, highQuality);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

/**
 * المسافة العمودية من نقطة إلى خط
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) {
    return Math.sqrt(
      (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2
    );
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (len * len);
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * تحويل مجموعة نقاط إلى منحنى Bezier واحد
 * يستخدم Least Squares Fitting لتقريب المنحنى
 */
export function fitBezier(points: Point[]): BezierCurve | null {
  if (points.length < 2) return null;
  if (points.length === 2) {
    return {
      start: points[0],
      cp1: {
        x: (points[0].x + points[1].x) / 3,
        y: (points[0].y + points[1].y) / 3,
      },
      cp2: {
        x: (2 * (points[0].x + points[1].x)) / 3,
        y: (2 * (points[0].y + points[1].y)) / 3,
      },
      end: points[1],
    };
  }

  const start = points[0];
  const end = points[points.length - 1];
  const n = points.length;

  // Calculate chord length parameterization
  const chords: number[] = [0];
  for (let i = 1; i < n; i++) {
    const d = Math.sqrt(
      (points[i].x - points[i - 1].x) ** 2 +
      (points[i].y - points[i - 1].y) ** 2
    );
    chords.push(chords[i - 1] + d);
  }
  const totalLen = chords[n - 1];
  const t = chords.map(c => (totalLen > 0 ? c / totalLen : 0));

  // Least squares fitting for control points
  const A: number[][] = [];
  const bx: number[] = [];
  const by: number[] = [];

  for (let i = 0; i < n; i++) {
    const ti = t[i];
    const u = 1 - ti;
    const b0 = u * u * u;
    const b1 = 3 * u * u * ti;
    const b2 = 3 * u * ti * ti;
    const b3 = ti * ti * ti;

    A.push([b1, b2]);
    bx.push(points[i].x - b0 * start.x - b3 * end.x);
    by.push(points[i].y - b0 * start.y - b3 * end.y);
  }

  // Solve using normal equations (simplified)
  const a11 = A.reduce((s, row) => s + row[0] * row[0], 0);
  const a12 = A.reduce((s, row) => s + row[0] * row[1], 0);
  const a22 = A.reduce((s, row) => s + row[1] * row[1], 0);
  const det = a11 * a22 - a12 * a12;

  if (Math.abs(det) < 1e-10) {
    // Fallback: simple midpoint approximation
    return {
      start,
      cp1: {
        x: (start.x + end.x) / 3,
        y: (start.y + end.y) / 3,
      },
      cp2: {
        x: (2 * (start.x + end.x)) / 3,
        y: (2 * (start.y + end.y)) / 3,
      },
      end,
    };
  }

  const b1x = A.reduce((s, row, i) => s + row[0] * bx[i], 0);
  const b2x = A.reduce((s, row, i) => s + row[1] * bx[i], 0);
  const b1y = A.reduce((s, row, i) => s + row[0] * by[i], 0);
  const b2y = A.reduce((s, row, i) => s + row[1] * by[i], 0);

  const cp1x = (a22 * b1x - a12 * b2x) / det;
  const cp2x = (a11 * b2x - a12 * b1x) / det;
  const cp1y = (a22 * b1y - a12 * b2y) / det;
  const cp2y = (a11 * b2y - a12 * b1y) / det;

  return {
    start,
    cp1: { x: cp1x, y: cp1y },
    cp2: { x: cp2x, y: cp2y },
    end,
  };
}

/**
 * تحويل منحنى Bezier إلى نقاط (للتقطيع)
 */
export function bezierToPoints(
  curve: BezierCurve,
  segments: number = 20
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const x =
      u * u * u * curve.start.x +
      3 * u * u * t * curve.cp1.x +
      3 * u * t * t * curve.cp2.x +
      t * t * t * curve.end.x;
    const y =
      u * u * u * curve.start.y +
      3 * u * u * t * curve.cp1.y +
      3 * u * t * t * curve.cp2.y +
      t * t * t * curve.end.y;
    points.push({ x, y });
  }
  return points;
}

/**
 * تبسيط متقدم: يقسم المنحنى إلى أجزاء ويبسط كل جزء
 * ثم يحاول تحويل الأجزاء المستقيمة إلى Bezier
 */
export function advancedSimplify(
  points: Point[],
  angleTolerance: number = 5, // degrees
  distanceTolerance: number = 0.05
): Point[] {
  if (points.length <= 2) return points;

  // Step 1: Remove collinear points (points on same line)
  const collinearRemoved = removeCollinearPoints(points, angleTolerance);

  // Step 2: Apply RDP simplification
  const simplified = simplifyRDP(collinearRemoved, distanceTolerance);

  return simplified;
}

/**
 * إزالة النقاط الواقعة على نفس الخط (Collinear)
 */
function removeCollinearPoints(
  points: Point[],
  angleTolerance: number
): Point[] {
  if (points.length <= 2) return points;

  const result: Point[] = [points[0]];
  const angleRad = (angleTolerance * Math.PI) / 180;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };

    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (len1 < 1e-10 || len2 < 1e-10) continue;

    const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

    if (angle > angleRad) {
      result.push(curr);
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

/**
 * تحويل ARC إلى نقاط (للاستخدام في تقليل النقاط)
 */
export function arcToPoints(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  segments: number = 36
): Point[] {
  const points: Point[] = [];
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  let sweep = endRad - startRad;
  if (sweep < 0) sweep += 2 * Math.PI;

  for (let i = 0; i <= segments; i++) {
    const angle = startRad + (sweep * i) / segments;
    points.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }

  return points;
}

/**
 * تحويل CIRCLE إلى نقاط
 */
export function circleToPoints(
  cx: number,
  cy: number,
  r: number,
  segments: number = 36
): Point[] {
  return arcToPoints(cx, cy, r, 0, 360, segments);
}

/**
 * تحويل ELLIPSE إلى نقاط
 */
export function ellipseToPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  segments: number = 36
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    points.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }
  return points;
}

/**
 * حساب المسافة بين نقطتين
 */
export function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * إزالة النقاط المتطابقة (نفس الموقع)
 */
export function removeDuplicatePoints(points: Point[], tolerance: number = 0.001): Point[] {
  if (points.length <= 1) return points;
  
  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (dist(points[i], result[result.length - 1]) > tolerance) {
      result.push(points[i]);
    }
  }
  return result;
}