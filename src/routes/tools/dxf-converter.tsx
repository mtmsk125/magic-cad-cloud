import React, { useRef, useState } from 'react';
import DxfParser from 'dxf-parser';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import { Canvg } from 'canvg';

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
      </main>
    </div>
  );
}

export const Route = createFileRoute('/tools/dxf-converter')({
  component: DxfConverter,
});
