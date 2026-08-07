import React from 'react';
import { Link } from '@tanstack/react-router';

export default function FloatingNav() {
  return (
    <nav style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 9999 }}>
      <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
        <Link to="/tools/dxf-converter" className="rounded-full bg-accent/90 text-accent-foreground px-4 py-2 text-sm font-semibold">أدوات</Link>
        <Link to="/tools/dxf-converter" className="rounded-full bg-muted/80 text-muted-foreground px-4 py-2 text-sm">DXF→SVG</Link>
        <Link to="/tools/file-compressor" className="rounded-full bg-muted/80 text-muted-foreground px-4 py-2 text-sm">ZIP</Link>
        <Link to="/contact" className="rounded-full border border-border bg-background px-3 py-2 text-sm">Contact</Link>
      </div>
    </nav>
  );
}
