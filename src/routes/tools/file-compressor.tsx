import React, { useState } from 'react';
import { zipSync, strToU8, ZipOptions } from 'fflate';
import { saveAs } from 'file-saver';

import { createFileRoute } from "@tanstack/react-router";

function FileCompressor() {
  const [files, setFiles] = useState<File[] | null>(null);

  const onFiles = (list: FileList | null) => {
    if (!list) return setFiles(null);
    setFiles(Array.from(list));
  };

  const compressAndDownload = async () => {
    if (!files || files.length === 0) return;
    const entries: Record<string, Uint8Array> = {};
    for (const f of files) {
      const buf = new Uint8Array(await f.arrayBuffer());
      entries[f.name] = buf;
    }
    const zipped = zipSync(entries);
    const blob = new Blob([zipped], { type: 'application/zip' });
    saveAs(blob, 'files.zip');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
        <div className="text-center mb-10">
          <p className="font-mono text-xs text-accent uppercase tracking-[0.25em]">Tools</p>
          <h1 className="font-display mt-3 text-3xl sm:text-4xl font-bold">File Compressor (ZIP)</h1>
          <p className="mt-3 text-sm text-muted-foreground">اختر ملفاً أو أكثر لضغطها في أرشيف ZIP مباشرةً في المتصفح.</p>
        </div>

        <div className="bg-card/60 border border-border rounded-2xl p-8 text-center">
          <input
            type="file"
            multiple
            onChange={(e) => onFiles(e.target.files)}
            className="mx-auto block text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-accent-foreground file:font-semibold hover:file:opacity-90"
          />
          <div className="mt-6">
            <button
              onClick={compressAndDownload}
              disabled={!files || files.length === 0}
              className="rounded-lg bg-accent px-6 py-3 text-sm font-bold text-accent-foreground hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ضغط وتنزيل ZIP
            </button>
          </div>
          {files && (
            <div className="mt-6 text-left">
              <strong className="text-sm text-muted-foreground">الملفات:</strong>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {files.map(f => <li key={f.name}>📄 {f.name} — {f.size.toLocaleString()} bytes</li>)}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute('/tools/file-compressor')({
  component: FileCompressor,
});
