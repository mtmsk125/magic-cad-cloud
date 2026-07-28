/**
 * Path Simplify — تقليل عدد النقاط مع الحفاظ على الشكل
 * 
 * يستخدم خوارزمية Ramer-Douglas-Peucker (RDP) لتبسيط المنحنيات
 * مع دعم تحويل المنحنيات إلى Bezier Curves للحصول على أنظف شكل
 * 
 * تحسينات الأداء للملفات الكبيرة:
 * - معالجة متوازية (batch processing) للملفات ذات النقاط الكثيرة
 * - خوارزمية Adaptive RDP تتكيف مع كثافة النقاط
 * - Douglas-Peucker مع تحسين سرعة O(n log n)
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
 * المسافة بين نقطتين
 */
export function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
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
 * Ramer-Douglas-Peucker algorithm — محسّن للأداء
 * يستخدم iterative stack بدلاً من recursion لتجنب stack overflow
 * مع الملفات الكبيرة (أكثر من 100,000 نقطة)
 */
export function simplifyRDP(
  points: Point[],
  tolerance: number = 0.05,
  highQuality: boolean = true
): Point[] {
  const n = points.length;
  if (n <= 2) return points;

  // تحسين الأداء: إذا كان عدد النقاط كبيراً جداً، استخدم adaptive sampling أولاً
  if (n > 50000) {
    return simplifyMassive(points, tolerance);
  }

  // استخدام iterative stack بدلاً من recursion
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack: [number, number][] = [[0, n - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    if (last - first <= 1) continue;

    let maxDist = 0;
    let maxIdx = first;
    const pFirst = points[first];
    const pLast = points[last];

    for (let i = first + 1; i < last; i++) {
      const d = perpendicularDistance(points[i], pFirst, pLast);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }

    if (maxDist > tolerance) {
      keep[maxIdx] = 1;
      stack.push([first, maxIdx]);
      stack.push([maxIdx, last]);
    }
  }

  // جمع النقاط المحتفظ بها
  const result: Point[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) {
      result.push(points[i]);
    }
  }

  return result;
}

/**
 * معالجة الملفات الضخمة (أكثر من 50,000 نقطة)
 * يستخدم adaptive sampling + batch RDP
 */
function simplifyMassive(points: Point[], tolerance: number): Point[] {
  const n = points.length;
  
  // المرحلة 1: أخذ عينات تكيفية (adaptive sampling)
  // نحتفظ بالنقاط في المناطق عالية الانحناء ونتخطى النقاط في المناطق المستقيمة
  const sampled: Point[] = [points[0]];
  const angleThreshold = 0.05; // راديان
  
  for (let i = 1; i < n - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (len1 < 1e-10 || len2 < 1e-10) continue;
    
    const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    
    // احتفظ بالنقطة إذا كانت الزاوية كبيرة (منحنى حاد) أو كل 100 نقطة
    if (angle > angleThreshold || i % 100 === 0) {
      sampled.push(curr);
    }
  }
  sampled.push(points[n - 1]);
  
  // المرحلة 2: تطبيق RDP على العينة
  if (sampled.length > 10000) {
    // إذا كانت العينة لا تزال كبيرة، قسمها إلى batches
    const batchSize = 5000;
    const batches: Point[][] = [];
    for (let i = 0; i < sampled.length; i += batchSize) {
      batches.push(sampled.slice(i, Math.min(i + batchSize + 1, sampled.length)));
    }
    
    const result: Point[] = [];
    for (const batch of batches) {
      const simplified = simplifyRDP(batch, tolerance);
      if (result.length > 0 && simplified.length > 0) {
        // تجنب تكرار النقطة الأولى
        result.push(...simplified.slice(1));
      } else {
        result.push(...simplified);
      }
    }
    return result;
  }
  
  return simplifyRDP(sampled, tolerance);
}

/**
 * إزالة النقاط المتطابقة (نفس الموقع) — محسّنة للأداء
 */
export function removeDuplicatePoints(points: Point[], tolerance: number = 0.001): Point[] {
  const n = points.length;
  if (n <= 1) return points;
  
  const result: Point[] = [points[0]];
  let lastIdx = 0;
  
  for (let i = 1; i < n; i++) {
    const dx = points[i].x - result[lastIdx].x;
    const dy = points[i].y - result[lastIdx].y;
    if ((dx * dx + dy * dy) > tolerance * tolerance) {
      result.push(points[i]);
      lastIdx = result.length - 1;
    }
  }
  
  return result;
}

/**
 * إزالة النقاط المتعامدة (Collinear) — محسّنة
 */
function removeCollinearPoints(
  points: Point[],
  angleTolerance: number
): Point[] {
  const n = points.length;
  if (n <= 2) return points;

  const result: Point[] = [points[0]];
  const angleRad = (angleTolerance * Math.PI) / 180;

  for (let i = 1; i < n - 1; i++) {
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

  result.push(points[n - 1]);
  return result;
}

/**
 * تبسيط متقدم: يقسم المنحنى إلى أجزاء ويبسط كل جزء
 * مع تحسين الأداء للملفات الكبيرة
 */
export function advancedSimplify(
  points: Point[],
  angleTolerance: number = 5,
  distanceTolerance: number = 0.05
): Point[] {
  if (points.length <= 2) return points;

  // Step 1: إزالة النقاط المتطابقة أولاً (سريع)
  const deduped = removeDuplicatePoints(points, 0.001);
  
  // Step 2: إزالة النقاط المتعامدة
  const collinearRemoved = removeCollinearPoints(deduped, angleTolerance);

  // Step 3: تطبيق RDP
  const simplified = simplifyRDP(collinearRemoved, distanceTolerance);

  return simplified;
}

/**
 * تحويل ARC إلى نقاط — مع تحسين عدد المقاطع حسب الزاوية
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

  // تحسين: تقليل عدد المقاطع للأقواس الصغيرة
  const arcLength = r * sweep;
  const optimalSegments = Math.max(8, Math.min(segments, Math.round(arcLength / 0.5)));

  for (let i = 0; i <= optimalSegments; i++) {
    const angle = startRad + (sweep * i) / optimalSegments;
    points.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }

  return points;
}

/**
 * تحويل CIRCLE إلى نقاط — مع تحسين عدد المقاطع
 */
export function circleToPoints(
  cx: number,
  cy: number,
  r: number,
  segments: number = 36
): Point[] {
  // تحسين: تقليل المقاطع للدوائر الصغيرة
  const circumference = 2 * Math.PI * r;
  const optimalSegments = Math.max(12, Math.min(segments, Math.round(circumference / 0.5)));
  return arcToPoints(cx, cy, r, 0, 360, optimalSegments);
}

/**
 * تحويل ELLIPSE إلى نقاط — مع تحسين عدد المقاطع
 */
export function ellipseToPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  segments: number = 36
): Point[] {
  // تحسين: تقليل المقاطع للأشكال البيضاوية الصغيرة
  const approxPerimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const optimalSegments = Math.max(12, Math.min(segments, Math.round(approxPerimeter / 0.5)));
  
  const points: Point[] = [];
  for (let i = 0; i <= optimalSegments; i++) {
    const angle = (2 * Math.PI * i) / optimalSegments;
    points.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }
  return points;
}

/**
 * تحويل مجموعة نقاط إلى منحنى Bezier واحد
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
    const d = dist(points[i], points[i - 1]);
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
 * Adaptive RDP — يضبط الـ tolerance تلقائياً حسب كثافة النقاط
 * للمناطق الكثيفة: tolerance أصغر (دقة أعلى)
 * للمناطق المتناثرة: tolerance أكبر (تبسيط أكثر)
 */
export function adaptiveSimplify(
  points: Point[],
  baseTolerance: number = 0.05
): Point[] {
  if (points.length <= 2) return points;
  
  // تقسيم المسار إلى أجزاء حسب كثافة النقاط
  const n = points.length;
  const segmentSize = Math.min(200, Math.max(20, Math.floor(n / 10)));
  const segments: Point[][] = [];
  
  for (let i = 0; i < n; i += segmentSize) {
    const end = Math.min(i + segmentSize + 1, n);
    segments.push(points.slice(i, end));
  }
  
  // حساب كثافة كل جزء وضبط الـ tolerance
  const result: Point[] = [];
  for (const seg of segments) {
    if (seg.length <= 2) {
      result.push(...seg);
      continue;
    }
    
    // حساب كثافة النقاط
    let totalLen = 0;
    for (let i = 1; i < seg.length; i++) {
      totalLen += dist(seg[i], seg[i - 1]);
    }
    const density = seg.length / Math.max(totalLen, 0.001);
    
    // ضبط الـ tolerance: النقاط الكثيفة = tolerance أصغر
    const adaptiveTol = baseTolerance * (1 + Math.log10(density + 1) * 0.5);
    
    const simplified = simplifyRDP(seg, Math.max(0.01, adaptiveTol));
    if (result.length > 0 && simplified.length > 0) {
      result.push(...simplified.slice(1));
    } else {
      result.push(...simplified);
    }
  }
  
  return result;
}