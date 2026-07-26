/**
 * SVG Parser — دعم رفع وتحليل ملفات SVG
 * 
 * يحول عناصر SVG (path, circle, rect, line, polyline, polygon, ellipse)
 * إلى كيانات DXF مكافئة للمعالجة
 */

import type { DxfEntity } from './dxf';

export interface SvgParseResult {
  entities: DxfEntity[];
  errors: string[];
  warnings: string[];
}

/**
 * تحليل ملف SVG وتحويله إلى كيانات DXF
 */
export function parseSvg(content: string): SvgParseResult {
  const entities: DxfEntity[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Normalize content
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Parse SVG using DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(normalized, 'image/svg+xml');
    
    const svgElement = doc.querySelector('svg');
    if (!svgElement) {
      errors.push('لم يتم العثور على عنصر SVG');
      return { entities, errors, warnings };
    }

    // Get viewBox for scaling
    const viewBox = svgElement.getAttribute('viewBox');
    let scaleX = 1, scaleY = 1, offsetX = 0, offsetY = 0;
    
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts.every(n => !isNaN(n))) {
        offsetX = parts[0];
        offsetY = parts[1];
        const vbWidth = parts[2];
        const vbHeight = parts[3];
        
        // Get actual SVG dimensions
        const svgWidth = parseFloat(svgElement.getAttribute('width') || String(vbWidth));
        const svgHeight = parseFloat(svgElement.getAttribute('height') || String(vbHeight));
        
        scaleX = svgWidth / vbWidth;
        scaleY = svgHeight / vbHeight;
      }
    }

    // Process all elements
    let entityIndex = 0;

    // Process <path> elements
    const paths = doc.querySelectorAll('path');
    paths.forEach(path => {
      const d = path.getAttribute('d');
      const layer = path.getAttribute('class') || path.getAttribute('id') || '0';
      if (!d) return;

      try {
        const pathEntities = parsePathData(d, layer, scaleX, scaleY, offsetX, offsetY);
        entities.push(...pathEntities);
      } catch (e) {
        warnings.push(`خطأ في تحليل مسار: ${e}`);
      }
    });

    // Process <circle> elements
    const circles = doc.querySelectorAll('circle');
    circles.forEach(circle => {
      const cx = parseFloat(circle.getAttribute('cx') || '0');
      const cy = parseFloat(circle.getAttribute('cy') || '0');
      const r = parseFloat(circle.getAttribute('r') || '0');
      const layer = circle.getAttribute('class') || circle.getAttribute('id') || '0';

      if (r > 0) {
        entities.push({
          type: 'CIRCLE',
          layer,
          handle: `svg_circle_${entityIndex++}`,
          rawLines: [],
          cx: (cx - offsetX) * scaleX,
          cy: (cy - offsetY) * scaleY,
          radius: r * scaleX,
        });
      }
    });

    // Process <rect> elements
    const rects = doc.querySelectorAll('rect');
    rects.forEach(rect => {
      const x = parseFloat(rect.getAttribute('x') || '0');
      const y = parseFloat(rect.getAttribute('y') || '0');
      const w = parseFloat(rect.getAttribute('width') || '0');
      const h = parseFloat(rect.getAttribute('height') || '0');
      const rx = parseFloat(rect.getAttribute('rx') || '0');
      const layer = rect.getAttribute('class') || rect.getAttribute('id') || '0';

      if (w > 0 && h > 0) {
        const sx = (x - offsetX) * scaleX;
        const sy = (y - offsetY) * scaleY;
        const sw = w * scaleX;
        const sh = h * scaleY;

        if (rx > 0) {
          // Rounded rectangle — convert to polyline with arc approximation
          const rr = Math.min(rx, w / 2, h / 2) * scaleX;
          const vertices = [
            { x: sx + rr, y: sy },
            { x: sx + sw - rr, y: sy },
            { x: sx + sw, y: sy + rr },
            { x: sx + sw, y: sy + sh - rr },
            { x: sx + sw - rr, y: sy + sh },
            { x: sx + rr, y: sy + sh },
            { x: sx, y: sy + sh - rr },
            { x: sx, y: sy + rr },
          ];
          entities.push({
            type: 'LWPOLYLINE',
            layer,
            handle: `svg_rect_${entityIndex++}`,
            rawLines: [],
            vertices,
            closed: true,
            vertexCount: vertices.length,
          });
        } else {
          // Simple rectangle — 4 vertices
          const vertices = [
            { x: sx, y: sy },
            { x: sx + sw, y: sy },
            { x: sx + sw, y: sy + sh },
            { x: sx, y: sy + sh },
          ];
          entities.push({
            type: 'LWPOLYLINE',
            layer,
            handle: `svg_rect_${entityIndex++}`,
            rawLines: [],
            vertices,
            closed: true,
            vertexCount: vertices.length,
          });
        }
      }
    });

    // Process <line> elements
    const lines = doc.querySelectorAll('line');
    lines.forEach(line => {
      const x1 = parseFloat(line.getAttribute('x1') || '0');
      const y1 = parseFloat(line.getAttribute('y1') || '0');
      const x2 = parseFloat(line.getAttribute('x2') || '0');
      const y2 = parseFloat(line.getAttribute('y2') || '0');
      const layer = line.getAttribute('class') || line.getAttribute('id') || '0';

      entities.push({
        type: 'LINE',
        layer,
        handle: `svg_line_${entityIndex++}`,
        rawLines: [],
        x1: (x1 - offsetX) * scaleX,
        y1: (y1 - offsetY) * scaleY,
        x2: (x2 - offsetX) * scaleX,
        y2: (y2 - offsetY) * scaleY,
      });
    });

    // Process <polyline> elements
    const polylines = doc.querySelectorAll('polyline');
    polylines.forEach(polyline => {
      const points = polyline.getAttribute('points');
      const layer = polyline.getAttribute('class') || polyline.getAttribute('id') || '0';
      if (!points) return;

      const vertices = parsePointsAttr(points, scaleX, scaleY, offsetX, offsetY);
      if (vertices.length >= 2) {
        entities.push({
          type: 'LWPOLYLINE',
          layer,
          handle: `svg_polyline_${entityIndex++}`,
          rawLines: [],
          vertices,
          closed: false,
          vertexCount: vertices.length,
        });
      }
    });

    // Process <polygon> elements
    const polygons = doc.querySelectorAll('polygon');
    polygons.forEach(polygon => {
      const points = polygon.getAttribute('points');
      const layer = polygon.getAttribute('class') || polygon.getAttribute('id') || '0';
      if (!points) return;

      const vertices = parsePointsAttr(points, scaleX, scaleY, offsetX, offsetY);
      if (vertices.length >= 2) {
        entities.push({
          type: 'LWPOLYLINE',
          layer,
          handle: `svg_polygon_${entityIndex++}`,
          rawLines: [],
          vertices,
          closed: true,
          vertexCount: vertices.length,
        });
      }
    });

    // Process <ellipse> elements
    const ellipses = doc.querySelectorAll('ellipse');
    ellipses.forEach(ellipse => {
      const cx = parseFloat(ellipse.getAttribute('cx') || '0');
      const cy = parseFloat(ellipse.getAttribute('cy') || '0');
      const rx = parseFloat(ellipse.getAttribute('rx') || '0');
      const ry = parseFloat(ellipse.getAttribute('ry') || '0');
      const layer = ellipse.getAttribute('class') || ellipse.getAttribute('id') || '0';

      if (rx > 0 && ry > 0) {
        // Store as approximated circle with radius = average
        entities.push({
          type: 'ELLIPSE',
          layer,
          handle: `svg_ellipse_${entityIndex++}`,
          rawLines: [],
          cx: (cx - offsetX) * scaleX,
          cy: (cy - offsetY) * scaleY,
          radius: (rx + ry) / 2 * scaleX,
          x1: (cx - offsetX - rx) * scaleX,
          y1: (cy - offsetY - ry) * scaleY,
          x2: (cx - offsetX + rx) * scaleX,
          y2: (cy - offsetY + ry) * scaleY,
        });
      }
    });

    if (entities.length === 0) {
      warnings.push('لم يتم العثور على عناصر قابلة للرسم في ملف SVG');
    }

  } catch (e: any) {
    errors.push(`خطأ في تحليل SVG: ${e.message || e}`);
  }

  return { entities, errors, warnings };
}

/**
 * تحليل بيانات مسار SVG (d attribute)
 * يدعم: M, L, H, V, C, Q, Z
 */
function parsePathData(
  d: string,
  layer: string,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number
): DxfEntity[] {
  const entities: DxfEntity[] = [];
  const commands = d.match(/[MLHVZCQ][^MLHVZCQ]*/gi);
  if (!commands) return entities;

  let currentX = 0, currentY = 0;
  let startX = 0, startY = 0;
  let firstMove = true;
  let polylineVertices: { x: number; y: number }[] = [];
  let entityIndex = 0;

  function addPoint(x: number, y: number) {
    const sx = (x - offsetX) * scaleX;
    const sy = (y - offsetY) * scaleY;
    polylineVertices.push({ x: sx, y: sy });
  }

  function flushPolyline(closed: boolean) {
    if (polylineVertices.length >= 2) {
      entities.push({
        type: 'LWPOLYLINE',
        layer,
        handle: `svg_path_${entities.length}`,
        rawLines: [],
        vertices: [...polylineVertices],
        closed,
        vertexCount: polylineVertices.length,
      });
    }
    polylineVertices = [];
  }

  for (const cmd of commands) {
    const type = cmd[0].toUpperCase();
    const isRelative = cmd[0] === cmd[0].toLowerCase();
    const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

    switch (type) {
      case 'M': {
        // Move to — start new subpath
        if (polylineVertices.length > 0) {
          flushPolyline(false);
        }
        const mx = isRelative ? currentX + nums[0] : nums[0];
        const my = isRelative ? currentY + nums[1] : nums[1];
        startX = mx;
        startY = my;
        currentX = mx;
        currentY = my;
        addPoint(mx, my);
        firstMove = false;
        break;
      }
      case 'L': {
        // Line to
        for (let i = 0; i < nums.length; i += 2) {
          const lx = isRelative ? currentX + nums[i] : nums[i];
          const ly = isRelative ? currentY + nums[i + 1] : nums[i + 1];
          addPoint(lx, ly);
          currentX = lx;
          currentY = ly;
        }
        break;
      }
      case 'H': {
        // Horizontal line
        for (const n of nums) {
          const hx = isRelative ? currentX + n : n;
          addPoint(hx, currentY);
          currentX = hx;
        }
        break;
      }
      case 'V': {
        // Vertical line
        for (const n of nums) {
          const vy = isRelative ? currentY + n : n;
          addPoint(currentX, vy);
          currentY = vy;
        }
        break;
      }
      case 'C': {
        // Cubic Bezier curve — approximate with line segments
        for (let i = 0; i < nums.length; i += 6) {
          if (i + 5 >= nums.length) break;
          const cx1 = isRelative ? currentX + nums[i] : nums[i];
          const cy1 = isRelative ? currentY + nums[i + 1] : nums[i + 1];
          const cx2 = isRelative ? currentX + nums[i + 2] : nums[i + 2];
          const cy2 = isRelative ? currentY + nums[i + 3] : nums[i + 3];
          const ex = isRelative ? currentX + nums[i + 4] : nums[i + 4];
          const ey = isRelative ? currentY + nums[i + 5] : nums[i + 5];

          // Approximate Bezier with 10 segments
          for (let t = 0.1; t <= 1.0; t += 0.1) {
            const u = 1 - t;
            const bx = u * u * u * currentX + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * ex;
            const by = u * u * u * currentY + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * ey;
            addPoint(bx, by);
          }

          currentX = ex;
          currentY = ey;
        }
        break;
      }
      case 'Q': {
        // Quadratic Bezier curve
        for (let i = 0; i < nums.length; i += 4) {
          if (i + 3 >= nums.length) break;
          const qx1 = isRelative ? currentX + nums[i] : nums[i];
          const qy1 = isRelative ? currentY + nums[i + 1] : nums[i + 1];
          const ex = isRelative ? currentX + nums[i + 2] : nums[i + 2];
          const ey = isRelative ? currentY + nums[i + 3] : nums[i + 3];

          // Approximate with 8 segments
          for (let t = 0.125; t <= 1.0; t += 0.125) {
            const u = 1 - t;
            const bx = u * u * currentX + 2 * u * t * qx1 + t * t * ex;
            const by = u * u * currentY + 2 * u * t * qy1 + t * t * ey;
            addPoint(bx, by);
          }

          currentX = ex;
          currentY = ey;
        }
        break;
      }
      case 'Z': {
        // Close path
        if (polylineVertices.length > 0) {
          flushPolyline(true);
        }
        currentX = startX;
        currentY = startY;
        break;
      }
    }
  }

  // Flush remaining polyline
  if (polylineVertices.length > 0) {
    flushPolyline(false);
  }

  return entities;
}

/**
 * تحليل سمة points (لـ polyline و polygon)
 */
function parsePointsAttr(
  points: string,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number
): { x: number; y: number }[] {
  const vertices: { x: number; y: number }[] = [];
  const nums = points.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

  for (let i = 0; i < nums.length - 1; i += 2) {
    vertices.push({
      x: (nums[i] - offsetX) * scaleX,
      y: (nums[i + 1] - offsetY) * scaleY,
    });
  }

  return vertices;
}

/**
 * التحقق مما إذا كان المحتوى هو SVG
 */
export function isSvgContent(content: string): boolean {
  const trimmed = content.trim().toLowerCase();
  return trimmed.startsWith('<svg') || trimmed.startsWith('<?xml') && trimmed.includes('<svg');
}

/**
 * التحقق من امتداد الملف
 */
export function isSvgFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.svg');
}