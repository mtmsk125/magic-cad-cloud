import React, { useRef, useState, useCallback } from 'react';
import { saveAs } from 'file-saver';
import { simplifyRDP, type Point } from '@/lib/path-simplify';
import { createFileRoute } from "@tanstack/react-router";

const MS_CASES = [[],[0,3],[0,1],[1,3],[1,2],[0,1,2,3],[0,2],[2,3],[2,3],[0,2],[0,1,2,3],[1,2],[1,3],[0,1],[0,3],[]];
const ES = [[0,1,0,0],[1,1,0,1],[0,0,1,1],[0,0,0,1]];
const EE = [[1,1,0,1],[1,0,0,1],[1,0,1,0],[1,1,0,0]];
interface Contour { points: Point[]; closed: boolean; }

function marchingSquares(g, w, h, t) {
  const cs = []; const v = new Set();
  for (let y=0;y<h-1;y++) for (let x=0;x<w-1;x++) {
    const c=(g[y*w+x]>t?8:0)+(g[y*w+x+1]>t?4:0)+(g[(y+1)*w+x+1]>t?2:0)+(g[(y+1)*w+x]>t?1:0);
    const e=MS_CASES[c]; if(!e.length) continue;
    for(let i=0;i<e.length;i+=2){
      const k=x+','+y+'|'+e[i]+','+e[i+1]; if(v.has(k))continue; v.add(k);
      const sx=x+ES[e[i]][0]+(EE[e[i]][0]-ES[e[i]][0])*0.5, sy=y+ES[e[i]][1]+(EE[e[i]][1]-ES[e[i]][1])*0.5;
      const ex=x+ES[e[i+1]][0]+(EE[e[i+1]][0]-ES[e[i+1]][0])*0.5, ey=y+ES[e[i+1]][1]+(EE[e[i+1]][1]-ES[e[i+1]][1])*0.5;
      cs.push({points:[{x:sx,y:sy},{x:ex,y:ey}],closed:false});
    }
  }
  return cs;
}

function connectContours(cs) {
  if(!cs.length)return[]; const u=new Set(); const r=[];
  for(let i=0;i<cs.length;i++){
    if(u.has(i))continue; const p=[...cs[i].points]; u.add(i);
    let e=true;
    while(e){e=false;const l=p[p.length-1];
      for(let j=0;j<cs.length;j++){if(u.has(j))continue;const c=cs[j];
        if(Math.abs(l.x-c.points[0].x)<0.6&&Math.abs(l.y-c.points[0].y)<0.6){p.push(...c.points.slice(1));u.add(j);e=true;break;}
        else if(Math.abs(l.x-c.points[c.points.length-1].x)<0.6&&Math.abs(l.y-c.points[c.points.length-1].y)<0.6){p.push(...c.points.slice(0,-1).reverse());u.add(j);e=true;break;}}}
    e=true;
    while(e){e=false;const f=p[0];
      for(let j=0;j<cs.length;j++){if(u.has(j))continue;const c=cs[j];
        if(Math.abs(f.x-c.points[c.points.length-1].x)<0.6&&Math.abs(f.y-c.points[c.points.length-1].y)<0.6){p.unshift(...c.points.slice(0,-1));u.add(j);e=true;break;}
        else if(Math.abs(f.x-c.points[0].x)<0.6&&Math.abs(f.y-c.points[0].y)<0.6){p.unshift(...c.points.slice(1).reverse());u.add(j);e=true;break;}}}
    const a=p[0],b=p[p.length-1];
    r.push({points:p,closed:Math.abs(a.x-b.x)<1.5&&Math.abs(a.y-b.y)<1.5});
  }
  return r;
}

function generateDxf(cs, s=1) {
  const l=['0','SECTION','2','HEADER','0','ENDSEC','0','SECTION','2','TABLES','0','TABLE','2','LAYER','70','1','0','LAYER','2','CUT','70','0','62','7','6','Continuous','0','ENDTAB','0','ENDSEC','0','SECTION','2','ENTITIES'];
  for(const c of cs){if(c.points.length<3)continue;l.push('0','LWPOLYLINE','8','CUT','90',String(c.points.length),'70',c.closed?'1':'0');for(const p of c.points)l.push('10',String((p.x*s).toFixed(6)),'20',String((p.y*s).toFixed(6)));}
  l.push('0','ENDSEC','0','EOF');return l.join('\\n');
}

function generateSvg(cs, w, h) {
  const ps=cs.filter(c=>c.points.length>=2).map(c=>{const d=c.points.map((p,i)=>(i===0?'M':'L')+' '+p.x.toFixed(2)+' '+(h-p.y).toFixed(2)).join(' ')+(c.closed?' Z':'');return '<path d="'+d+'" fill="none" stroke="#00d4ff" stroke-width="0.5"/>';});
  return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" width="100%" height="100%">\n  <rect width="100%" height="100%" fill="#0d1117"/>\n  '+ps.join('\n  ')+'\n</svg>';
}
function DxfConverter() {
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [svgPreview, setSvgPreview] = useState(null);
  const [dxfContent, setDxfContent] = useState(null);
  const [threshold, setThreshold] = useState(128);
  const [rdpTolerance, setRdpTolerance] = useState(1.0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const canvasRef = useRef(null);

  const processImage = useCallback(async (file) => {
    setProcessing(true); setError(null); setSvgPreview(null); setDxfContent(null); setStats(null);
    try {
      const img = new Image(); const url = URL.createObjectURL(file); setImagePreviewUrl(url);
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Image load failed')); img.src = url; });
      const canvas = canvasRef.current; if(!canvas) throw new Error('No canvas');
      const maxDim = 800; let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) { const r = Math.min(maxDim/w, maxDim/h); w = Math.floor(w*r); h = Math.floor(h*r); }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d'); if(!ctx) throw new Error('No context');
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const gray = new Uint8Array(w*h);
      for (let i=0; i<w*h; i++) { gray[i] = Math.round(0.299*imgData.data[i*4]+0.587*imgData.data[i*4+1]+0.114*imgData.data[i*4+2]); }
      const raw = marchingSquares(gray, w, h, threshold);
      const connected = connectContours(raw);
      const simplified = connected.map(c=>({...c, points:simplifyRDP(c.points,rdpTolerance)})).filter(c=>c.points.length>=3);
      setSvgPreview(generateSvg(simplified, w, h));
      setDxfContent(generateDxf(simplified, 1));
      setStats({contours:simplified.length, closed:simplified.filter(c=>c.closed).length});
      URL.revokeObjectURL(url);
    } catch(err) { setError(err.message || 'Processing error'); }
    finally { setProcessing(false); }
  }, [threshold, rdpTolerance]);

  const onFile = (e) => { const f = e.target.files?.[0]; if(f) processImage(f); };
  const downloadDxf = () => { if(!dxfContent)return; saveAs(new Blob([dxfContent],{type:'application/dxf'}), 'converted.dxf'); };
  const downloadSvg = () => { if(!svgPreview)return; saveAs(new Blob([svgPreview],{type:'image/svg+xml'}), 'converted.svg'); };
  return (
    <div className="min-h-screen bg-background text-foreground">
      <canvas ref={canvasRef} className="hidden" />
      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-bold">🖼 محول الصورة إلى DXF</h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">حوّل أي صورة (PNG/JPG/BMP) إلى ملف DXF بوليولاينات مغلقة جاهزة للقص بالليزر/CNC باستخدام خوارزمية Marching Squares.</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 mb-8">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold mb-2">حد الثنائية: {threshold}</label>
              <input type="range" min="30" max="220" value={threshold} onChange={e=>setThreshold(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">تبسيط المسار: {rdpTolerance.toFixed(1)}</label>
              <input type="range" min="0.5" max="5" step="0.1" value={rdpTolerance} onChange={e=>setRdpTolerance(Number(e.target.value))} className="w-full" />
            </div>
          </div>
          <div className="mt-6"><input type="file" accept="image/png,image/jpeg,image/webp,image/bmp" onChange={onFile} disabled={processing} className="mx-auto block text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-accent-foreground file:font-semibold" /></div>
        </div>
        {processing && <div className="text-center py-8 text-accent animate-pulse">جاري المعالجة...</div>}
        {error && <div className="mt-6 text-sm text-red-400 text-center">{error}</div>}
        {svgPreview && dxfContent && (
          <div className="space-y-6">
            {stats && <div className="flex flex-wrap justify-center gap-4">
              <div className="bg-card border border-border rounded-xl px-5 py-3 text-center"><div className="text-2xl font-bold text-primary">{stats.contours}</div><div className="text-xs text-muted-foreground">مسار مكتشف</div></div>
              <div className="bg-card border border-border rounded-xl px-5 py-3 text-center"><div className="text-2xl font-bold text-green-400">{stats.closed}</div><div className="text-xs text-muted-foreground">مسار مغلق</div></div>
            </div>}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-4"><h3 className="text-sm font-semibold mb-3 text-center">الصورة الأصلية</h3>{imagePreviewUrl && <div className="rounded-lg overflow-hidden bg-[#0d1117] flex justify-center"><img src={imagePreviewUrl} alt="original" className="max-h-64 object-contain" /></div>}</div>
              <div className="bg-card border border-border rounded-2xl p-4"><h3 className="text-sm font-semibold mb-3 text-center">معاينة DXF (تحويل)</h3><div className="rounded-lg overflow-hidden bg-[#0d1117] flex justify-center min-h-[16rem]" dangerouslySetInnerHTML={{__html: svgPreview}} /></div>
            </div>
            <div className="flex flex-wrap justify-center gap-3"><button onClick={downloadDxf} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-accent-foreground hover:opacity-90">⬇ تنزيل DXF</button><button onClick={downloadSvg} className="rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-semibold">تنزيل SVG</button></div>
          </div>
        )}
        <div className="mt-12 bg-card/60 border border-border rounded-2xl p-6">
          <h3 className="font-display font-bold mb-3">💡 نصائح لأفضل نتيجة</h3>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside"><li>استخدم صورة بخطوط واضحة وخلفية بيضاء (شعارات، رسومات خطية)</li><li>للنصوص: استخدم صورة عالية التباين (أسود على أبيض)</li><li>بعد التحويل، ارفع الملف في الأداة الرئيسية لتنظيفه وإصلاحه</li></ul>
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute('/tools/dxf-converter')({
  component: DxfConverter,
});
