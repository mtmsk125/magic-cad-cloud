import React, { useRef, useState } from 'react';
import DxfParser from 'dxf-parser';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import { Canvg } from 'canvg';
import { simplifyRDP } from '@/lib/path-simplify';

function buildSvgFromDxf(dxf: any) {
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
      const cx = e.center.x, cy = e.center.y, r = e.radius;
      paths.push(`<circle cx="${cx}" cy="${-cy}" r="${r}" stroke="black" stroke-width="0.5" fill="none"/>`);
      updateBounds(cx - r, cy - r); updateBounds(cx + r, cy + r);
    } else if (type === 'ARC') {
      const cx = e.center.x, cy = e.center.y, r = e.radius;
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

  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"${viewBox}\">\n  <g>\n    ${paths.join('\n    ')}\n  </g>\n</svg>`;
  return svg;
}

import { createFileRoute } from "@tanstack/react-router";

// ─────────────────────────────────────────────────────────────
// Image → DXF converter (بسيط: تتبّع حواف الصورة ثنائية الحقل)
// خطوات: تحميل الصورة ← رسم على canvas ← ثنائي (Threshold)
// ← استخراج حلقات الحواف (مشي على أضلاع الخلايا) ← تبسيط RDP
// ← توليد ملف DXF بوليولاينات مغلقة. معيار فعلي للقص بالليزر.
// ─────────────────────────────────────────────────────────────
interface Pt { x: number; y: number; }
function key(p: Pt, q: Pt): string { return `${p.x},${p.y}|${q.x},${q.y}`; }

function traceContours(imgData: ImageData, threshold: number): { x: number; y: number }[][] {
  const { width: w, height: h, data } = imgData;
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    bin[i] = lum < threshold ? 1 : 0; // الداكن = مادة مادية (for laser cut)
  }
  const black = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && bin[y * w + x] === 1;

  // حواف الحدود فقط: كل حافة بين رأسين تُنشأ عندما تكون الخلية المجاورة بيضاء.
  const edgeCount = new Map<string, { p: Pt; q: Pt; n: number }>();
  const push = (p: Pt, q: Pt) => {
    const k = key(p, q);
    const e = edgeCount.get(k);
    if (e) e.n++; else edgeCount.set(k, { p, q, n: 1 });
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!black(x, y)) continue;
      if (!black(x - 1, y)) push({ x, y }, { x, y: y + 1 });          // حافة يسار
      if (!black(x + 1, y)) push({ x: x + 1, y: y + 1 }, { x: x + 1, y }); // حافة يمين
      if (!black(x, y - 1)) push({ x, y }, { x: x + 1, y });          // حافة أعلى
      if (!black(x, y + 1)) push({ x: x + 1, y: y + 1 }, { x, y: y + 1 });  // حافة أسفل
    }
  }

  // مشي الحلقات من الحواف عبر الرؤوس
  const adj = new Map<string, Pt[]>();
  for (const { p, q } of edgeCount.values()) {
    const k = `${p.x},${p.y}`;
    if (!adj.has(k)) adj.set(k, []);
    adj.get(k)!.push(q);
  }
  const visited = new Set<string>();
  const loops: Pt[][] = [];
  for (const { p: sp, q: sq } of edgeCount.values()) {
    const sKey = `${sp.x},${sp.y}`;
    if (visited.has(sKey)) continue;
    const loop: Pt[] = [sp, sq];
    visited.add(sKey);
    let cur = sq;
    let guard = 0;
    while (guard++ < 100000) {
      const ck = `${cur.x},${cur.y}`;
      visited.add(ck);
      const nexts = adj.get(ck) ?? [];
      const nxt = nexts.find((n) => !visited.has(`${n.x},${n.y}`));
      if (!nxt) break;
      loop.push(nxt);
      cur = nxt;
    }
    // كسر العقد: أغلق الحلقة وطبيعها عبر إزالة التكرار
    if (loop.length > 3) loops.push([...new Map(loop.map((pt) => [`${pt.x},${pt.y}`, pt])).values()]);
  }
  return loops;
}

function DxfConverter() {

  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const onFile = async (file: File | null) => {
    setError(null);
    setSvgContent(null);
    if (!file) return;
    setProcessing(true);
    try {
      const text = await file.text();
      const parser = new (DxfParser as any)();
      const dxf = parser.parseSync(text);
      const svg = buildSvgFromDxf(dxf);
      setSvgContent(svg);
    } catch (err: any) {
      console.error(err);
      setError('Failed to parse DXF: ' + (err?.message || String(err)));
    } finally {
      setProcessing(false);
    }
  };

  // ── Image → DXF ──
  const [imageDxf, setImageDxf] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const onImageFile = async (file: File | null) => {
    setImageError(null); setImageDxf(null); setImageName('');
    setImagePreviewUrl(null);
    if (!file) return;
    setProcessing(true);
    try {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('تعذّر قراءة الصورة'));
        img.src = url;
      });
      const MAX = 512;
      const s = Math.min(1, MAX / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round((img.width || 1) * s));
      const h = Math.max(1, Math.round((img.height || 1) * s));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const loops = traceContours(imgData, 128);
      const mmPerPx = 0.1; // معيار: 10 بكسل = 1 مم (قابل للتعديل لاحقاً)
      const entities: string[] = [];
      for (const loop of loops) {
        const pts = simplifyRDP(loop, 0.6);
        if (pts.length < 3) continue;
        const rows: string[] = ['0', 'LWPOLYLINE', '8', '0', '90', String(pts.length), '70', '1'];
        for (const p of pts) {
          rows.push('10', (p.x * mmPerPx).toFixed(3), '20', ((h - p.y) * mmPerPx).toFixed(3));
        }
        entities.push(rows.join('\n'));
      }
      const header =
        '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n0\nSECTION\n2\nENTITIES';
      const dxf = header + '\n' + entities.join('\n') + '\n0\nENDSEC\n0\nEOF';
      setImageDxf(dxf);
      setImageName(file.name.replace(/\.[^.]+$/, '') + '_traced.dxf');
    } catch (e: any) {
      console.error(e);
      setImageError('Failed to convert image: ' + (e?.message || String(e)));
    } finally {
      setProcessing(false);
    }
  };

  const downloadImageDxf = () => {
    if (!imageDxf) return;
    const blob = new Blob([imageDxf], { type: 'application/dxf' });
    saveAs(blob, imageName || 'image_traced.dxf');
  };

  const downloadSvg = () => {
    if (!svgContent || processing) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    saveAs(blob, 'drawing.svg');
  };

  const exportPdf = async () => {
    if (!svgContent || processing) return;
    setProcessing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200; canvas.height = 800;
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      const v = await Canvg.fromString(ctx, svgContent);
      await v.render();
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('drawing.pdf');
    } catch (e) {
      console.error(e);
      setError('Failed to export PDF');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
        <div className="text-center mb-10">
          <p className="font-mono text-xs text-accent uppercase tracking-[0.25em]">Tools</p>
          <h1 className="font-display mt-3 text-3xl sm:text-4xl font-bold">DXF → SVG / PDF Converter</h1>
          <p className="mt-3 text-sm text-muted-foreground">ارفع ملف DXF ليُحوَّل إلى SVG في المتصفح، ثم نزّله كملف SVG أو PDF.</p>
        </div>

        <div className="bg-card/60 border border-border rounded-2xl p-8 text-center">
          <input
            type="file"
            accept=".dxf"
            onChange={(e) => onFile(e.target.files?.[0] || null)}
            disabled={processing}
            className="mx-auto block text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-accent-foreground file:font-semibold hover:file:opacity-90"
          />
          {processing && <div className="mt-6 font-mono text-xs text-accent animate-pulse">جاري المعالجة... يرجى الانتظار</div>}
          {error && <div className="mt-6 text-sm font-medium text-red-400">{error}</div>}
          {svgContent && (
            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={downloadSvg}
                  disabled={processing}
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground hover:opacity-90 transition"
                >
                  تنزيل SVG
                </button>
                <button
                  onClick={exportPdf}
                  disabled={processing}
                  className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:border-accent/50 transition"
                >
                  تصدير PDF
                </button>
              </div>
              <div className="mt-6 rounded-xl border border-border/60 bg-background p-4">
                <div dangerouslySetInnerHTML={{ __html: svgContent }} />
              </div>
            </div>
          )}
        </div>

        {/* ─────────── Image → DXF ─────────── */}
        <div className="mt-10 bg-card/60 border border-border rounded-2xl p-8">
          <div className="text-center">
            <h2 className="font-display text-xl sm:text-2xl font-bold">🖼 صورة → DXF</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              ارفع صورة (PNG/JPG) وحوّلها إلى ملف DXF بوليولاينات مغلقة جاهزة للقص بالليزر/CNC.
              النص الأسود يُعامل كمساحة قطع؛ استخدم صورة بخطوط واضحة وخلفية بيضاء لأفضل نتيجة.
            </p>
          </div>
          <div className="mt-6 text-center">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/bmp"
              onChange={(e) => onImageFile(e.target.files?.[0] || null)}
              disabled={processing}
              className="mx-auto block text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-accent-foreground file:font-semibold hover:file:opacity-90"
            />
          </div>
          {imageError && <div className="mt-6 text-sm font-medium text-red-400">{imageError}</div>}
          {imagePreviewUrl && (
            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {imageDxf && (
                  <button
                    onClick={downloadImageDxf}
                    disabled={processing}
                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground hover:opacity-90 transition"
                  >
                    ⬇ تنزيل DXF
                  </button>
                )}
                {imageDxf && (
                  <span className="text-xs font-mono text-green-400">
                    {imageDxf.split('\n').filter((l) => l.trim() === 'LWPOLYLINE').length} مسار مغلق جاهز
                  </span>
                )}
              </div>
              <div className="mt-4 rounded-xl border border-border/60 bg-[#0d1117] p-4 flex justify-center">
                <img src={imagePreviewUrl} alt="source" className="max-h-80 rounded-lg" />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute('/tools/dxf-converter')({
  component: DxfConverter,
});
