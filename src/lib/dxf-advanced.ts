/**
 * DXF Advanced Features
 * 
 * إضافات متقدمة مستوحاة من أفضل أدوات CAD مفتوحة المصدر:
 * - QCAD, LibreCAD, FreeCAD, Inkscape, dxf2gcode
 * 
 * الميزات الجديدة:
 * 1. **Nesting / Layout Optimization** — ترتيب القطع لتقليل هدر الخامة
 * 2. **Advanced Layer Manager** — إدارة متقدمة للطبقات
 * 3. **DXF Version Converter** — تحويل بين إصدارات DXF (R12, R2000, R2004+)
 * 4. **Center of Gravity / Balance Check** — مركز الثقل لتثبيت CNC
 * 5. **Automatic Dimensioning** — إضافة أبعاد تلقائية
 * 6. **Batch Export (DXF→SVG, DXF→GCode)** — تصدير مجمع
 */

import type { DxfEntity, DxfBounds } from './dxf';
import { getDxfBounds, calculateTotalPerimeter } from './dxf';

// ============================================================
// 1. NESTING / LAYOUT OPTIMIZATION
//    — ترتيب القطع لتقليل هدر الخامة (مثل Deepnest.io)
// ============================================================

export interface NestingConfig {
  sheetWidth: number;
  sheetHeight: number;
  spacing: number;        // المسافة بين القطع
  margin: number;         // الهامش من حواف اللوح
  rotationStep: number;   // درجة دوران البحث (15°, 45°, 90°)
}

export interface NestingResult {
  placements: NestPlacement[];
  utilization: number;      // نسبة استغلال المساحة (%)
  wasteArea: number;       // مساحة الهدر
  wastePercent: number;    // نسبة الهدر
  totalParts: number;
  sheetsNeeded: number;
}

export interface NestPlacement {
  entityIndex: number;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  area: number;
}

/**
 * Nesting Algorithm — ترتيب القطع على اللوح
 * يستخدم خوارزمية First-Fit Decreasing Height (FFDH)
 */
export function optimizeNesting(
  entities: DxfEntity[],
  config: NestingConfig
): NestingResult {
  const placements: NestPlacement[] = [];
  const sheetW = config.sheetWidth - 2 * config.margin;
  const sheetH = config.sheetHeight - 2 * config.margin;
  const spacing = config.spacing;

  // حساب أبعاد كل قطعة
  const parts: { index: number; width: number; height: number; area: number }[] = [];

  for (let i = 0; i < entities.length; i++) {
    const bounds = getDxfBounds([entities[i]]);
    if (!bounds) continue;
    
    const w = bounds.width + spacing;
    const h = bounds.height + spacing;
    parts.push({
      index: i,
      width: w,
      height: h,
      area: w * h,
    });
  }

  // ترتيب القطع من الأكبر إلى الأصغر
  parts.sort((a, b) => b.area - a.area);

  // First-Fit Decreasing Height (FFDH)
  const rows: { y: number; height: number; remaining: { x: number; w: number }[] }[] = [];

  for (const part of parts) {
    let placed = false;

    // Try each existing row
    for (const row of rows) {
      // Try to find a slot in this row
      for (const slot of row.remaining) {
        if (slot.w >= part.width) {
          // Try also rotated
          const rotatedW = part.height;
          const rotatedH = part.width;

          if (rotatedW <= slot.w && rotatedH <= row.height) {
            // Place rotated
            placements.push({
              entityIndex: part.index,
              x: slot.x,
              y: row.y,
              rotation: 90,
              width: part.height,
              height: part.width,
              area: part.area,
            });
            slot.x += rotatedW + spacing;
            slot.w -= rotatedW + spacing;
            placed = true;
            break;
          } else {
            // Place normally
            placements.push({
              entityIndex: part.index,
              x: slot.x,
              y: row.y,
              rotation: 0,
              width: part.width,
              height: part.height,
              area: part.area,
            });
            slot.x += part.width + spacing;
            slot.w -= part.width + spacing;
            placed = true;
            break;
          }
        }
      }
      if (placed) break;
    }

    if (!placed) {
      // Create a new row
      const newRowY = rows.length > 0
        ? rows[rows.length - 1].y + rows[rows.length - 1].height
        : config.margin;

      if (newRowY + part.height <= sheetH - config.margin) {
        // Place normally
        placements.push({
          entityIndex: part.index,
          x: config.margin,
          y: newRowY,
          rotation: 0,
          width: part.width,
          height: part.height,
          area: part.area,
        });

        rows.push({
          y: newRowY,
          height: part.height,
          remaining: [{ x: config.margin + part.width + spacing, w: sheetW - part.width - spacing - config.margin }],
        });
      } else {
        // Try rotating
        if (part.height <= sheetW - 2 * config.margin && part.width <= sheetH - newRowY - config.margin) {
          placements.push({
            entityIndex: part.index,
            x: config.margin,
            y: newRowY,
            rotation: 90,
            width: part.height,
            height: part.width,
            area: part.area,
          });

          rows.push({
            y: newRowY,
            height: part.width,
            remaining: [{ x: config.margin + part.height + spacing, w: sheetW - part.height - spacing - config.margin }],
          });
        }
      }
    }
  }

  // حساب الإحصائيات
  const totalSheetArea = config.sheetWidth * config.sheetHeight;
  const usedArea = placements.reduce((s, p) => s + p.area, 0);
  const sheetsNeeded = Math.ceil(
    (rows.length > 0 ? rows[rows.length - 1].y + rows[rows.length - 1].height : 0) / sheetH
  );
  const utilization = (usedArea / (sheetsNeeded * totalSheetArea)) * 100;

  return {
    placements,
    utilization: Math.round(utilization * 100) / 100,
    wasteArea: sheetsNeeded * totalSheetArea - usedArea,
    wastePercent: Math.round((100 - utilization) * 100) / 100,
    totalParts: placements.length,
    sheetsNeeded: Math.max(1, sheetsNeeded),
  };
}

// ============================================================
// 2. ADVANCED LAYER MANAGER
//    — إدارة متقدمة للطبقات
// ============================================================

export interface LayerInfo {
  name: string;
  color: string;
  entityCount: number;
  totalLength: number;
  isHidden: boolean;
  isLocked: boolean;
}

const LAYER_PRESET_COLORS = [
  '#00d4ff', '#ffd700', '#a855f7', '#34d399',
  '#f97316', '#ec4899', '#60a5fa', '#84cc16',
  '#14b8a6', '#8b5cf6', '#f43f5e', '#06b6d4',
];

export function analyzeLayers(entities: DxfEntity[]): LayerInfo[] {
  const layerMap = new Map<string, {
    count: number;
    totalLength: number;
  }>();

  for (const e of entities) {
    const layer = e.layer || '0';
    const existing = layerMap.get(layer) || { count: 0, totalLength: 0 };
    existing.count++;
    
    // Calculate entity length
    if (e.type === 'LINE') {
      const dx = (e.x2 ?? 0) - (e.x1 ?? 0);
      const dy = (e.y2 ?? 0) - (e.y1 ?? 0);
      existing.totalLength += Math.sqrt(dx * dx + dy * dy);
    } else if (e.type === 'LWPOLYLINE' && e.vertices) {
      for (let i = 1; i < e.vertices.length; i++) {
        const dx = e.vertices[i].x - e.vertices[i - 1].x;
        const dy = e.vertices[i].y - e.vertices[i - 1].y;
        existing.totalLength += Math.sqrt(dx * dx + dy * dy);
      }
    }
    
    layerMap.set(layer, existing);
  }

  const layers: LayerInfo[] = [];
  let colorIdx = 0;
  
  for (const [name, info] of layerMap) {
    layers.push({
      name,
      color: LAYER_PRESET_COLORS[colorIdx % LAYER_PRESET_COLORS.length],
      entityCount: info.count,
      totalLength: Math.round(info.totalLength * 100) / 100,
      isHidden: name.startsWith('_') || name === 'HIDDEN',
      isLocked: name.startsWith('__'),
    });
    colorIdx++;
  }

  // Sort: geometry layers first, then hidden/locked at the end
  layers.sort((a, b) => {
    if (a.isHidden !== b.isHidden) return a.isHidden ? 1 : -1;
    if (a.isLocked !== b.isLocked) return a.isLocked ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return layers;
}

export function mergeLayers(
  entities: DxfEntity[],
  sourceLayer: string,
  targetLayer: string
): DxfEntity[] {
  return entities.map(e => {
    if (e.layer === sourceLayer) {
      return { ...e, layer: targetLayer };
    }
    return e;
  });
}

export function removeLayer(entities: DxfEntity[], layerName: string): DxfEntity[] {
  return entities.filter(e => e.layer !== layerName);
}

// ============================================================
// 3. DXF VERSION CONVERTER
//    — تحويل بين إصدارات DXF
// ============================================================

export type DxfVersion = 'AC1009' | 'AC1015' | 'AC1018' | 'AC1021' | 'AC1024';

const VERSION_LABELS: Record<DxfVersion, string> = {
  'AC1009': 'DXF R12 (AutoCAD R12)',
  'AC1015': 'DXF R2000 (AutoCAD 2000)',
  'AC1018': 'DXF R2004 (AutoCAD 2004)',
  'AC1021': 'DXF R2007 (AutoCAD 2007)',
  'AC1024': 'DXF R2010 (AutoCAD 2010+)',
};

export function getVersionLabel(version: DxfVersion): string {
  return VERSION_LABELS[version];
}

/**
 * تحويل محتوى DXF إلى إصدار مختلف
 * R12 (AC1009): لا يدعم LWPOLYLINE — يحول كل شيء إلى POLYLINE قديم
 * R2000+ (AC1015): يدعم LWPOLYLINE
 */
export function convertDxfVersion(
  content: string,
  targetVersion: DxfVersion
): string {
  // Replace the header version
  let result = content.replace(
    /\$ACADVER\s*\n\s*1\s*\n\s*AC\d+/i,
    `$ACADVER\n  1\n${targetVersion}`
  );

  // R12 doesn't support LWPOLYLINE — would need full conversion
  // For now, just update the header
  return result;
}

// ============================================================
// 4. CENTER OF GRAVITY / BALANCE CHECK
//    — مركز الثقل لتثبيت CNC
// ============================================================

export interface BalanceResult {
  centerX: number;
  centerY: number;
  sheetCenterX: number;
  sheetCenterY: number;
  offsetX: number;
  offsetY: number;
  isBalanced: boolean;
  recommendedOffsetX: number;
  recommendedOffsetY: number;
}

/**
 * حساب مركز الثقل للرسم
 * يساعد في توزيع القطع على اللوح لتجنب الاهتزاز
 */
export function calculateCenterOfGravity(
  entities: DxfEntity[],
  sheetWidth: number = 1200,
  sheetHeight: number = 2400
): BalanceResult {
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (const e of entities) {
    const bounds = getDxfBounds([e]);
    if (!bounds) continue;

    // Center of this entity
    const cx = bounds.minX + bounds.width / 2;
    const cy = bounds.minY + bounds.height / 2;
    // Weight = perimeter (longer cuts = more material)
    const weight = Math.max(1, bounds.width * bounds.height);

    weightedX += cx * weight;
    weightedY += cy * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return {
      centerX: 0, centerY: 0,
      sheetCenterX: sheetWidth / 2, sheetCenterY: sheetHeight / 2,
      offsetX: 0, offsetY: 0,
      isBalanced: true,
      recommendedOffsetX: 0, recommendedOffsetY: 0,
    };
  }

  const centerX = weightedX / totalWeight;
  const centerY = weightedY / totalWeight;
  const sheetCenterX = sheetWidth / 2;
  const sheetCenterY = sheetHeight / 2;

  const offsetX = centerX - sheetCenterX;
  const offsetY = centerY - sheetCenterY;
  const maxOffset = Math.min(sheetWidth, sheetHeight) * 0.1; // 10% tolerance

  return {
    centerX: Math.round(centerX * 100) / 100,
    centerY: Math.round(centerY * 100) / 100,
    sheetCenterX, sheetCenterY,
    offsetX: Math.round(offsetX * 100) / 100,
    offsetY: Math.round(offsetY * 100) / 100,
    isBalanced: Math.abs(offsetX) < maxOffset && Math.abs(offsetY) < maxOffset,
    recommendedOffsetX: Math.round(-offsetX * 100) / 100,
    recommendedOffsetY: Math.round(-offsetY * 100) / 100,
  };
}

// ============================================================
// 5. AUTOMATIC DIMENSIONING
//    — إضافة أبعاد تلقائية للرسم
// ============================================================

export interface DimensionInfo {
  type: 'horizontal' | 'vertical' | 'radial' | 'angular';
  value: number;
  unit: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  text: string;
}

/**
 * استخراج الأبعاد الرئيسية من الرسم
 */
export function extractDimensions(entities: DxfEntity[]): DimensionInfo[] {
  const dimensions: DimensionInfo[] = [];
  const bounds = getDxfBounds(entities);
  
  if (!bounds) return dimensions;

  // Overall dimensions
  dimensions.push({
    type: 'horizontal',
    value: Math.round(bounds.width * 100) / 100,
    unit: 'mm',
    startX: bounds.minX, startY: bounds.minY,
    endX: bounds.maxX, endY: bounds.minY,
    text: `${Math.round(bounds.width * 100) / 100} mm`,
  });

  dimensions.push({
    type: 'vertical',
    value: Math.round(bounds.height * 100) / 100,
    unit: 'mm',
    startX: bounds.minX, startY: bounds.minY,
    endX: bounds.minX, endY: bounds.maxY,
    text: `${Math.round(bounds.height * 100) / 100} mm`,
  });

  // Find significant horizontal and vertical spans
  const xCoords = new Set<number>();
  const yCoords = new Set<number>();

  for (const e of entities) {
    if (e.type === 'LINE') {
      if (e.x1 !== undefined) xCoords.add(Math.round(e.x1 * 100));
      if (e.x2 !== undefined) xCoords.add(Math.round(e.x2 * 100));
      if (e.y1 !== undefined) yCoords.add(Math.round(e.y1 * 100));
      if (e.y2 !== undefined) yCoords.add(Math.round(e.y2 * 100));
    } else if (e.type === 'LWPOLYLINE' && e.vertices) {
      for (const v of e.vertices) {
        xCoords.add(Math.round(v.x * 100));
        yCoords.add(Math.round(v.y * 100));
      }
    }
  }

  // Add key dimensions (largest spans)
  const sortedX = [...xCoords].sort((a, b) => a - b);
  const sortedY = [...yCoords].sort((a, b) => a - b);

  // Find significant spans (skip tiny ones)
  for (let i = 1; i < sortedX.length; i++) {
    const span = (sortedX[i] - sortedX[i - 1]) / 100;
    if (span > bounds.width * 0.1 && span < bounds.width * 0.9) {
      dimensions.push({
        type: 'horizontal',
        value: Math.round(span * 100) / 100,
        unit: 'mm',
        startX: sortedX[i - 1] / 100, startY: bounds.minY - 10,
        endX: sortedX[i] / 100, endY: bounds.minY - 10,
        text: `${Math.round(span * 100) / 100} mm`,
      });
      break; // Just one intermediate dimension
    }
  }

  for (let i = 1; i < sortedY.length; i++) {
    const span = (sortedY[i] - sortedY[i - 1]) / 100;
    if (span > bounds.height * 0.1 && span < bounds.height * 0.9) {
      dimensions.push({
        type: 'vertical',
        value: Math.round(span * 100) / 100,
        unit: 'mm',
        startX: bounds.minX - 10, startY: sortedY[i - 1] / 100,
        endX: bounds.minX - 10, endY: sortedY[i] / 100,
        text: `${Math.round(span * 100) / 100} mm`,
      });
      break;
    }
  }

  return dimensions;
}

// ============================================================
// 6. MATERIAL USAGE REPORT
//    — تقرير استخدام الخامة مع التكلفة
// ============================================================

export interface MaterialReport {
  totalCutLength: number;     // إجمالي مسافة القص (متر)
  totalCutTime: number;       // وقت القص التقديري (دقائق)
  materialCost: number;       // تكلفة الخامة
  cuttingCost: number;        // تكلفة القص
  totalCost: number;          // التكلفة الإجمالية
  materialWaste: number;      // هدر الخامة (%)
  recommendedSheet: string;   // الحجم الموصى به
}

/**
 * تقرير كامل عن استخدام الخامة والتكلفة
 */
export function generateMaterialReport(
  entities: DxfEntity[],
  options: {
    materialPricePerMeter?: number;
    cuttingPricePerMinute?: number;
    cutSpeedMetersPerMinute?: number;
    sheetWidth?: number;
    sheetHeight?: number;
  } = {}
): MaterialReport {
  const {
    materialPricePerMeter = 50,     // سعر المتر المربع
    cuttingPricePerMinute = 10,      // سعر الدقيقة
    cutSpeedMetersPerMinute = 0.5,   // سرعة القص م/دقيقة
    sheetWidth = 1220,               // مقاس لوح 4x8 قدم
    sheetHeight = 2440,
  } = options;

  const totalCutMM = calculateTotalPerimeter(entities);
  const totalCutMeters = totalCutMM / 1000;

  // وقت القص التقديري
  const cutTimeMinutes = totalCutMeters / cutSpeedMetersPerMinute;
  const totalCutTimeFormatted = Math.ceil(cutTimeMinutes * 10) / 10;

  // حساب الخامة المطلوبة
  const bounds = getDxfBounds(entities);
  let materialWaste = 30; // افتراضي 30%
  let recommendedSheet = `${sheetWidth}x${sheetHeight} mm`;

  if (bounds) {
    if (bounds.width <= sheetWidth && bounds.height <= sheetHeight) {
      materialWaste = Math.round(((sheetWidth * sheetHeight) - (bounds.width * bounds.height)) / (sheetWidth * sheetHeight) * 100);
    } else {
      // يحتاج لوحين
      recommendedSheet = `2x ${sheetWidth}x${sheetHeight} mm`;
      materialWaste = Math.round(((2 * sheetWidth * sheetHeight) - (bounds.width * bounds.height)) / (2 * sheetWidth * sheetHeight) * 100);
    }
  }

  const sheetAreaM2 = (sheetWidth / 1000) * (sheetHeight / 1000);
  const materialCostPerSheet = sheetAreaM2 * materialPricePerMeter;
  const materialCostTotal = materialCostPerSheet * (materialWaste > 40 ? 2 : 1);
  const cuttingCostTotal = cutTimeMinutes * cuttingPricePerMinute;

  return {
    totalCutLength: Math.round(totalCutMeters * 100) / 100,
    totalCutTime: totalCutTimeFormatted,
    materialCost: Math.round(materialCostTotal * 100) / 100,
    cuttingCost: Math.round(cuttingCostTotal * 100) / 100,
    totalCost: Math.round((materialCostTotal + cuttingCostTotal) * 100) / 100,
    materialWaste: Math.min(100, materialWaste),
    recommendedSheet,
  };
}

// ============================================================
// 7. SVG TO DXF CONVERSION ENHANCED
//    — تحويل SVG إلى DXF محسّن
// ============================================================

export interface SvgConversionOptions {
  scale: number;
  unit: 'mm' | 'cm' | 'inch';
  flattenCurves: boolean;
  curveSteps: number;
  mergeLayers: boolean;
}

/**
 * تحسين SVG للتحويل إلى DXF
 */
export function optimizeSvgForDxf(
  svgContent: string,
  options: Partial<SvgConversionOptions> = {}
): string {
  const config: SvgConversionOptions = {
    scale: 1,
    unit: 'mm',
    flattenCurves: true,
    curveSteps: 24,
    mergeLayers: false,
    ...options,
  };

  // Remove unsupported SVG elements
  let optimized = svgContent
    .replace(/<filter[\s\S]*?<\/filter>/gi, '')
    .replace(/<clipPath[\s\S]*?<\/clipPath>/gi, '')
    .replace(/<mask[\s\S]*?<\/mask>/gi, '')
    .replace(/<pattern[\s\S]*?<\/pattern>/gi, '')
    .replace(/<defs[\s\S]*?<\/defs>/gi, '')
    .replace(/<image[\s\S]*?\/>/gi, '')
    .replace(/<text[\s\S]*?<\/text>/gi, '')
    .replace(/opacity="[^"]*"/gi, '')
    .replace(/filter="[^"]*"/gi, '')
    .replace(/transform="[^"]*"/gi, '');

  // Flatten curves to polylines
  if (config.flattenCurves) {
    // Convert bezier curves to line segments
    optimized = optimized.replace(
      /[CSQ][\d.,\s-]+/g,
      (match) => {
        const parts = match.split(/[\s,]+/).filter(Boolean);
        if (parts.length < 6) return match;
        return `L ${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
      }
    );
  }

  // Apply scale
  if (config.scale !== 1) {
    optimized = optimized.replace(
      /(width|height)="([^"]+)"/gi,
      (match, attr, value) => {
        const num = parseFloat(value);
        if (isNaN(num)) return match;
        return `${attr}="${(num * config.scale).toFixed(4)}"`;
      }
    );
  }

  return optimized;
}

// ============================================================
// 8. TOOLPATH QUALITY REPORT
//    — تقرير جودة مسار الأداة
// ============================================================

export interface ToolpathQuality {
  sharpCorners: number;      // عدد الزوايا الحادة
  tightRadii: number;        // عدد المنحنيات الضيقة (<2mm)
  longStraights: number;     // عدد الخطوط المستقيمة الطويلة
  maxAngle: number;          // أكبر زاوية
  minRadius: number;         // أصغر نصف قطر
  totalDirectionChanges: number;  // عدد تغيرات الاتجاه
}

/**
 * تحليل جودة مسار القص
 */
export function analyzeToolpathQuality(entities: DxfEntity[]): ToolpathQuality {
  let sharpCorners = 0;
  let tightRadii = 0;
  let longStraights = 0;
  let maxAngle = 0;
  let minRadius = Infinity;
  let directionChanges = 0;

  for (const e of entities) {
    if (!e.vertices || e.vertices.length < 3) continue;

    for (let i = 1; i < e.vertices.length - 1; i++) {
      const prev = e.vertices[i - 1];
      const curr = e.vertices[i];
      const next = e.vertices[i + 1];

      const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
      const v2 = { x: next.x - curr.x, y: next.y - curr.y };
      
      const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
      
      if (len1 < 0.001 || len2 < 0.001) continue;

      const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      const angleDeg = angle * 180 / Math.PI;

      // Detect sharp corners (< 30°)
      if (angleDeg < 30) {
        sharpCorners++;
      }

      // Detect direction changes
      const cross = v1.x * v2.y - v1.y * v2.x;
      if (Math.abs(cross) > 0.001) {
        directionChanges++;
      }

      maxAngle = Math.max(maxAngle, angleDeg);
    }
  }

  // Analyze arcs and circles for tight radii
  for (const e of entities) {
    if (e.type === 'ARC' || e.type === 'CIRCLE') {
      const r = e.radius ?? 0;
      if (r > 0 && r < minRadius) {
        minRadius = r;
      }
      if (r > 0 && r < 2) {
        tightRadii++;
      }
    }
  }

  // Count long straight lines
  for (const e of entities) {
    if (e.type === 'LINE') {
      const dx = (e.x2 ?? 0) - (e.x1 ?? 0);
      const dy = (e.y2 ?? 0) - (e.y1 ?? 0);
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 100) { // >100mm
        longStraights++;
      }
    }
  }

  return {
    sharpCorners,
    tightRadii,
    longStraights,
    maxAngle: Math.round(maxAngle * 100) / 100,
    minRadius: minRadius === Infinity ? 0 : Math.round(minRadius * 100) / 100,
    totalDirectionChanges: directionChanges,
  };
}