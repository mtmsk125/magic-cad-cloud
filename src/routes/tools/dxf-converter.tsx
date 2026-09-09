import React, { useRef, useState, useCallback, useMemo } from 'react';
import { saveAs } from 'file-saver';
import { simplifyRDP, type Point } from '@/lib/path-simplify';
import { parseSvg } from '@/lib/svg-parser';
import DxfParser from 'dxf-parser';
import { createFileRoute } from "@tanstack/react-router";

// ===================== DXF → SVG (converter pane) =====================
function buildSvgFromDxf(dxf: any): string {
  const entities = dxf.entities || [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const paths: string[] = [];

  function updateBounds(x: number, y: number) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  entities.forEach((e: any) => {
    const type = e.type;
    if (type === 'LINE') {
      const x1 = e.vertices ? e.vertices[0].x : e.x1 || 0;
      const y1 = e.vertices ? e.vertices[0].y : e.y1 || 0;
      const x2 = e.vertices ? e.vertices[1].x : e.x2 || 0;
      const y2 = e.vertices ? e.vertices[1].y : e.y2 || 0;
      paths.push(`<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}" stroke="black" stroke-width="0.5"/>`);
      updateBounds(x1, y1); updateBounds(x2, y2);
    } else if (type === 'LWPOLYLINE' || type === 'POLYLINE') {
      const verts = e.vertices || [];
      const pts = verts.map((v: any) => `${v.x},${-v.y}`).join(' ');
      paths.push(`<polyline points="${pts}" fill="none" stroke="black" stroke-width="0.5"/>`);
      verts.forEach((v: any) => updateBounds(v.x, v.y));
    } else if (type === 'CIRCLE') {
      const cx = e.center?.x ?? 0, cy = e.center?.y ?? 0, r = e.radius ?? 1;
      paths.push(`<circle cx="${cx}" cy="${-cy}" r="${r}" stroke="black" stroke-width="0.5" fill="none"/>`);
      updateBounds(cx - r, cy - r); updateBounds(cx + r, cy + r);
    } else if (type === 'ARC') {
      const cx = e.center?.x ?? 0, cy = e.center?.y ?? 0, r = e.radius ?? 1;
      const start = e.startAngle || 0, end = e.endAngle || 0;
      const toRad = (a: number) => a * Math.PI / 180;
      const x1 = cx + r * Math.cos(toRad(start));
      const y1 = cy + r * Math.sin(toRad(start));
      const x2 = cx + r * Math.cos(toRad(end));
      const y2 = cy + r * Math.sin(toRad(end));
      const large = Math.abs(end - start) > 180 ? 1 : 0;
      paths.push(`<path d="M ${x1} ${-y1} A ${r} ${r} 0 ${large} 0 ${x2} ${-y2}" stroke="black" stroke-width="0.5" fill="none"/>`);
      updateBounds(cx - r, cy - r); updateBounds(cx + r, cy + r);
    }
  });

  if (minX === Infinity) { minX = minY = -10; maxX = maxY = 10; }
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const viewBox = `${minX} ${-maxY} ${width} ${height}`;

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">\n  <g>\n    ${paths.join('\n    ')}\n  </g>\n</svg>`;
}

// ===================== SVG → DXF (converter pane) =====================
function buildDxfFromSvg(svgContent: string): { dxf: string; entityCount: number; errors: string[] } {
  const result = parseSvg(svgContent);
  if (result.errors.length > 0) {
    return { dxf: '', entityCount: 0, errors: result.errors };
  }
  const header =
    '  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1015\n  9\n$INSUNITS\n  70\n1\n  0\nENDSEC\n' +
    '\n  0\nSECTION\n  2\nENTITIES\n';
  const tail = '  0\nENDSEC\n  0\nEOF\n';
  const body = result.entities.map((e) => e.rawLines.join('\n')).join('\n');
  return { dxf: header + body + '\n' + tail, entityCount: result.entities.length, errors: [] };
}

// Image to DXF Converter - Laser Cutting Ready
// Pipeline: Grayscale -> Blur -> Adaptive Threshold -> Contours -> RDP -> DXF

interface Contour { points: Point[]; closed: boolean; }
interface ConversionStats { contours: number; closed: number; totalPoints: number; }
interface MaterialPreset {
  name: string; nameAr: string;
  threshold: number; blurRadius: number; rdpTolerance: number;
  minPathLength: number; invert: boolean;
}

const MATERIAL_PRESETS: MaterialPreset[] = [
  { name: 'Wood', nameAr: 'خشب', threshold: 128, blurRadius: 1, rdpTolerance: 0.8, minPathLength: 20, invert: false },
  { name: 'Acrylic', nameAr: 'أكريليك', threshold: 140, blurRadius: 2, rdpTolerance: 1.0, minPathLength: 30, invert: false },
  { name: 'Stone/Slate', nameAr: 'حجر/سلايت', threshold: 100, blurRadius: 1, rdpTolerance: 1.2, minPathLength: 25, invert: false },
  { name: 'Paper/Cardboard', nameAr: 'ورق/كرتون', threshold: 160, blurRadius: 0, rdpTolerance: 0.6, minPathLength: 15, invert: false },
  { name: 'Leather', nameAr: 'جلد', threshold: 120, blurRadius: 1, rdpTolerance: 1.0, minPathLength: 20, invert: false },
  { name: 'Fabric', nameAr: 'قماش', threshold: 130, blurRadius: 2, rdpTolerance: 1.5, minPathLength: 40, invert: false },
  { name: 'Photo (Engrave)', nameAr: 'صورة (نقش)', threshold: 0, blurRadius: 0, rdpTolerance: 0, minPathLength: 0, invert: false },
];
// ===================== IMAGE PROCESSING =====================

function toGrayscale(data: Uint8ClampedArray | Uint8Array, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return gray;
}

function gaussianBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius < 1) return src;
  const dst = new Float32Array(w * h);
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size * size);
  const sigma = radius / 2;
  let sum = 0;
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const g = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      kernel[(y + radius) * size + (x + radius)] = g;
      sum += g;
    }
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let val = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const py = Math.min(h - 1, Math.max(0, y + ky));
          val += src[py * w + px] * kernel[(ky + radius) * size + (kx + radius)];
        }
      }
      dst[y * w + x] = val;
    }
  }
  return dst;
}

function adaptiveThreshold(src: Float32Array, w: number, h: number, blockSize: number, C: number): Uint8Array {
  const dst = new Uint8Array(w * h);
  const half = Math.floor(blockSize / 2);
  const integral = new Float64Array((w + 1) * (h + 1));

  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += src[y * w + x];
      integral[(y + 1) * (w + 1) + (x + 1)] = rowSum + integral[y * (w + 1) + (x + 1)];
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(w - 1, x + half);
      const y2 = Math.min(h - 1, y + half);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = integral[(y2 + 1) * (w + 1) + (x2 + 1)] - integral[y1 * (w + 1) + (x2 + 1)]
                - integral[(y2 + 1) * (w + 1) + x1] + integral[y1 * (w + 1) + x1];
      const mean = sum / area;
      dst[y * w + x] = src[y * w + x] > mean - C ? 255 : 0;
    }
  }
  return dst;
}

// ===================== MARCHING SQUARES =====================
const MS_CASES = [[],[0,3],[0,1],[1,3],[1,2],[0,1,2,3],[0,2],[2,3],[2,3],[0,2],[0,1,2,3],[1,2],[1,3],[0,1],[0,3],[]];
const ES = [[0,1,0,0],[1,1,0,1],[0,0,1,1],[0,0,0,1]];
const EE = [[1,1,0,1],[1,0,0,1],[1,0,1,0],[1,1,0,0]];

function traceContours(binary: Uint8Array, w: number, h: number): Contour[] {
  const segments: Contour[] = [];
  const visited = new Set<string>();

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const c = (binary[y * w + x] > 127 ? 8 : 0) + (binary[y * w + x + 1] > 127 ? 4 : 0)
              + (binary[(y + 1) * w + x + 1] > 127 ? 2 : 0) + (binary[(y + 1) * w + x] > 127 ? 1 : 0);
      const edges = MS_CASES[c];
      if (!edges.length) continue;
      for (let i = 0; i < edges.length; i += 2) {
        const key = x + ',' + y + '|' + edges[i] + ',' + edges[i + 1];
        if (visited.has(key)) continue;
        visited.add(key);
        const sx = x + ES[edges[i]][0] + (EE[edges[i]][0] - ES[edges[i]][0]) * 0.5;
        const sy = y + ES[edges[i]][1] + (EE[edges[i]][1] - ES[edges[i]][1]) * 0.5;
        const ex = x + ES[edges[i + 1]][0] + (EE[edges[i + 1]][0] - ES[edges[i + 1]][0]) * 0.5;
        const ey = y + ES[edges[i + 1]][1] + (EE[edges[i + 1]][1] - ES[edges[i + 1]][1]) * 0.5;
        segments.push({ points: [{ x: sx, y: sy }, { x: ex, y: ey }], closed: false });
      }
    }
  }
  return connectContours(segments);
}

function connectContours(segments: Contour[]): Contour[] {
  if (!segments.length) return [];
  const used = new Set<number>();
  const result: Contour[] = [];

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    const path = [...segments[i].points];
    used.add(i);

    let extended = true;
    while (extended) {
      extended = false;
      const last = path[path.length - 1];
      for (let j = 0; j < segments.length; j++) {
        if (used.has(j)) continue;
        const c = segments[j];
        if (Math.abs(last.x - c.points[0].x) < 0.7 && Math.abs(last.y - c.points[0].y) < 0.7) {
          path.push(...c.points.slice(1)); used.add(j); extended = true; break;
        } else if (Math.abs(last.x - c.points[c.points.length - 1].x) < 0.7 && Math.abs(last.y - c.points[c.points.length - 1].y) < 0.7) {
          path.push(...c.points.slice(0, -1).reverse()); used.add(j); extended = true; break;
        }
      }
    }

    extended = true;
    while (extended) {
      extended = false;
      const first = path[0];
      for (let j = 0; j < segments.length; j++) {
        if (used.has(j)) continue;
        const c = segments[j];
        if (Math.abs(first.x - c.points[c.points.length - 1].x) < 0.7 && Math.abs(first.y - c.points[c.points.length - 1].y) < 0.7) {
          path.unshift(...c.points.slice(0, -1)); used.add(j); extended = true; break;
        } else if (Math.abs(first.x - c.points[0].x) < 0.7 && Math.abs(first.y - c.points[0].y) < 0.7) {
          path.unshift(...c.points.slice(1).reverse()); used.add(j); extended = true; break;
        }
      }
    }

    const a = path[0], b = path[path.length - 1];
    result.push({ points: path, closed: Math.abs(a.x - b.x) < 1.5 && Math.abs(a.y - b.y) < 1.5 });
  }
  return result;
}
// ===================== DXF GENERATION =====================
function generateDxf(contours: Contour[], scale = 1): string {
  const l: string[] = ['0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC', '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', '1', '0', 'LAYER', '2', 'CUT', '70', '0', '62', '7', '6', 'Continuous', '0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
  let count = 0;
  for (const c of contours) {
    if (c.points.length < 3) continue;
    l.push('0', 'LWPOLYLINE', '8', 'CUT', '90', String(c.points.length), '70', c.closed ? '1' : '0');
    for (const p of c.points) {
      l.push('10', String((p.x * scale).toFixed(6)), '20', String((p.y * scale).toFixed(6)));
    }
    count++;
  }
  l.push('0', 'ENDSEC', '0', 'EOF');
  return l.join('\n');
}

// ===================== SVG PREVIEW =====================
function generateSvgPreview(contours: Contour[], w: number, h: number): string {
  const paths = contours.filter(c => c.points.length >= 2).map(c => {
    const d = c.points.map((p, i) => (i === 0 ? 'M' : 'L') + ' ' + p.x.toFixed(2) + ' ' + (h - p.y).toFixed(2)).join(' ') + (c.closed ? ' Z' : '');
    return '<path d="' + d + '" fill="none" stroke="#00d4ff" stroke-width="0.5"/>';
  });
  const pathStr = paths.join('\n  ');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%">\n  <rect width="100%" height="100%" fill="#0d1117"/>\n  ' + pathStr + '\n</svg>';
}

// ===================== GREYSCALE ENGRAVE =====================
function generateEngraveSvg(gray: Float32Array, w: number, h: number, threshold: number): string {
  const rects: string[] = [];
  const step = 2;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const val = gray[y * w + x];
      if (val < threshold) {
        const darkness = 1 - val / 255;
        rects.push('<rect x="' + x + '" y="' + (h - y - step) + '" width="' + step + '" height="' + step + '" fill="rgba(0,212,255,' + darkness.toFixed(2) + ')"/>');
      }
    }
  }
  const rectStr = rects.join('\n  ');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%">\n  <rect width="100%" height="100%" fill="#0d1117"/>\n  ' + rectStr + '\n</svg>';
}
function DxfConverter() {
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [svgPreview, setSvgPreview] = useState<string | null>(null);
  const [dxfContent, setDxfContent] = useState<string | null>(null);
  const [materialIdx, setMaterialIdx] = useState(0);
  const [customThreshold, setCustomThreshold] = useState(128);
  const [customBlur, setCustomBlur] = useState(1);
  const [customRdp, setCustomRdp] = useState(1.0);
  const [useCustom, setUseCustom] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [mode, setMode] = useState('cut');
  const [tab, setTab] = useState<'image' | 'dxf2svg' | 'svg2dxf'>('dxf2svg');
  const [dxfSvgContent, setDxfSvgContent] = useState<string | null>(null);
  const [dxfSvgError, setDxfSvgError] = useState<string | null>(null);
  const [svgDxfContent, setSvgDxfContent] = useState<string | null>(null);
  const [svgDxfName, setSvgDxfName] = useState<string>('output.dxf');
  const [svgDxfCount, setSvgDxfCount] = useState(0);
  const [svgDxfError, setSvgDxfError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ---- DXF → SVG ----
  const onDxfFile = async (file: File | null) => {
    setDxfSvgError(null);
    setDxfSvgContent(null);
    if (!file) return;
    try {
      const text = await file.text();
      const parser = new (DxfParser as any)();
      const dxf = parser.parseSync(text);
      setDxfSvgContent(buildSvgFromDxf(dxf));
      setDxfSvgError(null);
    } catch (err: any) {
      console.error(err);
      setDxfSvgError('Failed to parse DXF: ' + (err?.message || String(err)));
    }
  };

  const downloadDxfSvg = () => {
    if (!dxfSvgContent) return;
    saveAs(new Blob([dxfSvgContent], { type: 'image/svg+xml' }), 'drawing.svg');
  };

  // ---- SVG → DXF ----
  const onSvgFile = async (file: File | null) => {
    setSvgDxfError(null);
    setSvgDxfContent(null);
    setSvgDxfCount(0);
    if (!file) return;
    try {
      const text = await file.text();
      const { dxf, entityCount, errors } = buildDxfFromSvg(text);
      if (errors.length > 0) {
        setSvgDxfError('SVG parse error: ' + errors.join(', '));
        return;
      }
      setSvgDxfContent(dxf);
      setSvgDxfCount(entityCount);
      setSvgDxfName(file.name.replace(/\.svg$/i, '') + '.dxf');
    } catch (err: any) {
      console.error(err);
      setSvgDxfError('Failed to convert SVG: ' + (err?.message || String(err)));
    }
  };

  const downloadSvgDxf = () => {
    if (!svgDxfContent) return;
    saveAs(new Blob([svgDxfContent], { type: 'application/dxf' }), svgDxfName);
  };

  const currentPreset = MATERIAL_PRESETS[materialIdx];
  const threshold = useCustom ? customThreshold : currentPreset.threshold;
  const blurRadius = useCustom ? customBlur : currentPreset.blurRadius;
  const rdpTolerance = useCustom ? customRdp : currentPreset.rdpTolerance;

  const processImage = useCallback(async (file: File) => {
    setProcessing(true); setError(null); setSvgPreview(null); setDxfContent(null); setStats(null);
    try {
      const img = new Image(); const url = URL.createObjectURL(file); setImagePreviewUrl(url);
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Image load failed')); img.src = url; });
      const canvas = canvasRef.current; if(!canvas) throw new Error('No canvas');
      const maxDim = 600; let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) { const r = Math.min(maxDim/w, maxDim/h); w = Math.floor(w*r); h = Math.floor(h*r); }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d'); if(!ctx) throw new Error('No context');
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);

      if (mode === 'engrave') {
        const gray = toGrayscale(imgData.data, w, h);
        const svg = generateEngraveSvg(gray, w, h, threshold || 200);
        setSvgPreview(svg);
        setDxfContent(generateDxf([], 1));
        setStats({contours: 0, closed: 0, totalPoints: 0});
        URL.revokeObjectURL(url); setProcessing(false); return;
      }

      const gray = toGrayscale(imgData.data, w, h);
      const blurred = gaussianBlur(gray, w, h, blurRadius);
      const binary = adaptiveThreshold(blurred, w, h, 15, 10);
      const contours = traceContours(binary, w, h);
      const simplified = contours.map(c => ({...c, points: simplifyRDP(c.points, rdpTolerance)})).filter(c => c.points.length >= 3);
      setSvgPreview(generateSvgPreview(simplified, w, h));
      setDxfContent(generateDxf(simplified, 1));
      setStats({contours: simplified.length, closed: simplified.filter(c=>c.closed).length, totalPoints: simplified.reduce((s,c)=>s+c.points.length,0)});
      URL.revokeObjectURL(url);
    } catch (err: any) { setError(err.message || 'Processing error'); }
    finally { setProcessing(false); }
  }, [threshold, blurRadius, rdpTolerance, mode]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if(f) processImage(f); };
  const downloadDxf = () => { if(!dxfContent)return; saveAs(new Blob([dxfContent],{type:'application/dxf'}), 'laser-cut.dxf'); };
  const downloadSvg = () => { if(!svgPreview)return; saveAs(new Blob([svgPreview],{type:'image/svg+xml'}), 'preview.svg'); };
  return (
    <div className="min-h-screen bg-background text-foreground">
      <canvas ref={canvasRef} className="hidden" />
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-12">
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl sm:text-4xl font-bold">
            {tab === 'image'
              ? '🖼 محول الصورة إلى DXF'
              : tab === 'dxf2svg'
                ? '📄 محول DXF إلى SVG'
                : '🖼 محول SVG إلى DXF'}
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            {tab === 'image'
              ? 'حوّل أي صورة إلى ملف DXF جاهز للقص بالليزر/CNC.'
              : tab === 'dxf2svg'
                ? 'ارفع ملف DXF واحصل على معاينة SVG قابلة للتنزيل مباشرة في المتصفح.'
                : 'ارفع ملف SVG (من Illustrator, Inkscape, CorelDRAW) واحصل على DXF جاهز للماكينة.'}
          </p>
        </div>
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          <button onClick={() => setTab('dxf2svg')} className={'px-5 py-2 rounded-lg text-sm font-semibold ' + (tab === 'dxf2svg' ? 'bg-accent text-accent-foreground' : 'bg-card border border-border')}>📄 DXF إلى SVG</button>
          <button onClick={() => setTab('svg2dxf')} className={'px-5 py-2 rounded-lg text-sm font-semibold ' + (tab === 'svg2dxf' ? 'bg-accent text-accent-foreground' : 'bg-card border border-border')}>SVG إلى DXF</button>
          <button onClick={() => setTab('image')} className={'px-5 py-2 rounded-lg text-sm font-semibold ' + (tab === 'image' ? 'bg-accent text-accent-foreground' : 'bg-card border border-border')}>🖼 صورة إلى DXF</button>
        </div>

        {tab === 'dxf2svg' && (
          <div className="bg-card border border-border rounded-2xl p-6 mb-8">
            <div className="text-center">
              <input type="file" accept=".dxf" onChange={(e) => onDxfFile(e.target.files?.[0] || null)} className="mx-auto block text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-accent-foreground file:font-semibold" />
              <p className="text-xs text-muted-foreground mt-2">ملفات .dxf — التحويل يتم بالكامل في متصفحك</p>
            </div>
            {dxfSvgError && <div className="mt-6 text-sm text-red-400 text-center">{dxfSvgError}</div>}
            {dxfSvgContent && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-4">
                  <h3 className="text-sm font-semibold mb-3 text-center">معاينة SVG</h3>
                  <div className="rounded-lg overflow-hidden bg-[#ffffff] flex justify-center min-h-[18rem]" dangerouslySetInnerHTML={{__html: dxfSvgContent}} />
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <button onClick={downloadDxfSvg} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-accent-foreground hover:opacity-90">⬇ تنزيل SVG</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'svg2dxf' && (
          <div className="bg-card border border-border rounded-2xl p-6 mb-8">
            <div className="text-center">
              <input type="file" accept=".svg" onChange={(e) => onSvgFile(e.target.files?.[0] || null)} className="mx-auto block text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-accent-foreground file:font-semibold" />
              <p className="text-xs text-muted-foreground mt-2">ملفات .svg — يُحوَّل إلى DXF (R12) جاهز للماكينة</p>
            </div>
            {svgDxfError && <div className="mt-6 text-sm text-red-400 text-center">{svgDxfError}</div>}
            {svgDxfContent && (
              <div className="space-y-6">
                <div className="flex flex-wrap justify-center gap-4">
                  <div className="bg-card border border-border rounded-xl px-5 py-3 text-center"><div className="text-2xl font-bold text-green-400">{svgDxfCount}</div><div className="text-xs text-muted-foreground">كيانات DXF</div></div>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <button onClick={downloadSvgDxf} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-accent-foreground hover:opacity-90">⬇ تنزيل DXF</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'image' && (
        <>
        <div className="flex justify-center gap-2 mb-6">
          <button onClick={() => setMode('cut')} className={'px-5 py-2 rounded-lg text-sm font-semibold ' + (mode === 'cut' ? 'bg-accent text-accent-foreground' : 'bg-card border border-border')}>✂️ قص</button>
          <button onClick={() => setMode('engrave')} className={'px-5 py-2 rounded-lg text-sm font-semibold ' + (mode === 'engrave' ? 'bg-accent text-accent-foreground' : 'bg-card border border-border')}>🎨 نقش</button>
        </div>
        {mode === 'cut' && (
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <h3 className="font-display font-bold mb-4">🪵 اختر نوع المادة</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MATERIAL_PRESETS.filter(p => p.name !== 'Photo (Engrave)').map((preset, idx) => (
                <button key={idx} onClick={() => { setMaterialIdx(idx); setUseCustom(false); }}
                  className={'p-3 rounded-lg text-sm font-medium text-center ' + (materialIdx === idx && !useCustom ? 'bg-accent text-accent-foreground' : 'bg-background border border-border')}>
                  {preset.nameAr}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input type="checkbox" id="custom" checked={useCustom} onChange={e => setUseCustom(e.target.checked)} className="rounded" />
              <label htmlFor="custom" className="text-sm text-muted-foreground">إعدادات مخصصة</label>
            </div>
          </div>
        )}
        {useCustom && mode === 'cut' && (
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <div className="grid sm:grid-cols-3 gap-6">
              <div><label className="block text-sm font-semibold mb-2">حد الثنائية: {customThreshold}</label><input type="range" min="30" max="220" value={customThreshold} onChange={e => setCustomThreshold(Number(e.target.value))} className="w-full" /></div>
              <div><label className="block text-sm font-semibold mb-2">تنعيم: {customBlur}</label><input type="range" min="0" max="5" value={customBlur} onChange={e => setCustomBlur(Number(e.target.value))} className="w-full" /></div>
              <div><label className="block text-sm font-semibold mb-2">تبسيط: {customRdp.toFixed(1)}</label><input type="range" min="0.5" max="5" step="0.1" value={customRdp} onChange={e => setCustomRdp(Number(e.target.value))} className="w-full" /></div>
            </div>
          </div>
        )}
        <div className="bg-card border border-border rounded-2xl p-6 mb-8">
          <div className="text-center">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/bmp" onChange={onFile} disabled={processing} className="mx-auto block text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-accent-foreground file:font-semibold" />
            <p className="text-xs text-muted-foreground mt-2">PNG, JPG, WebP, BMP — حتى 600×600 بكسل</p>
          </div>
        </div>
        {processing && <div className="text-center py-8 text-accent animate-pulse">جاري المعالجة...</div>}
        {error && <div className="mt-6 text-sm text-red-400 text-center">{error}</div>}
        {svgPreview && dxfContent && (
          <div className="space-y-6">
            {stats && stats.contours > 0 && (
              <div className="flex flex-wrap justify-center gap-4">
                <div className="bg-card border border-border rounded-xl px-5 py-3 text-center"><div className="text-2xl font-bold text-primary">{stats.contours}</div><div className="text-xs text-muted-foreground">مسار مكتشف</div></div>
                <div className="bg-card border border-border rounded-xl px-5 py-3 text-center"><div className="text-2xl font-bold text-green-400">{stats.closed}</div><div className="text-xs text-muted-foreground">مسار مغلق</div></div>
                <div className="bg-card border border-border rounded-xl px-5 py-3 text-center"><div className="text-2xl font-bold text-accent">{stats.totalPoints}</div><div className="text-xs text-muted-foreground">إجمالي النقاط</div></div>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-4"><h3 className="text-sm font-semibold mb-3 text-center">الصورة الأصلية</h3>{imagePreviewUrl && <div className="rounded-lg overflow-hidden bg-[#0d1117] flex justify-center"><img src={imagePreviewUrl} alt="original" className="max-h-72 object-contain" /></div>}</div>
              <div className="bg-card border border-border rounded-2xl p-4"><h3 className="text-sm font-semibold mb-3 text-center">{mode === 'cut' ? 'معاينة DXF' : 'معاينة النقش'}</h3><div className="rounded-lg overflow-hidden bg-[#0d1117] flex justify-center min-h-[18rem]" dangerouslySetInnerHTML={{__html: svgPreview}} /></div>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {mode === 'cut' && <button onClick={downloadDxf} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-accent-foreground hover:opacity-90">⬇ تنزيل DXF</button>}
              <button onClick={downloadSvg} className="rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-semibold">تنزيل SVG</button>
            </div>
          </div>
        )}
        </>
        )}
        <div className="mt-12 bg-card/60 border border-border rounded-2xl p-6">
          <h3 className="font-display font-bold mb-3">💡 نصائح للحصول على أفضل نتيجة</h3>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li><strong>للقص (Cut):</strong> استخدم صورة بخطوط واضحة وخلفية بيضاء</li>
            <li><strong>للنقش (Engrave):</strong> استخدم صورة رمادية أو ملونة</li>
            <li>بعد التحويل، ارفع الملف في الأداة الرئيسية لتنظيفه وإصلاحه</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute('/tools/dxf-converter')({
  component: DxfConverter,
});
