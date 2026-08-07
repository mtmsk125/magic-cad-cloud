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
    <div style={{ padding: 20 }}>
      <h2>File Compressor (ZIP)</h2>
      <p>Select one or more files to compress into a ZIP archive in the browser.</p>
      <input type="file" multiple onChange={(e) => onFiles(e.target.files)} />
      <div style={{ marginTop: 12 }}>
        <button onClick={compressAndDownload} disabled={!files || files.length === 0}>Compress & Download ZIP</button>
      </div>
      {files && (
        <div style={{ marginTop: 12 }}>
          <strong>Files:</strong>
          <ul>
            {files.map(f => <li key={f.name}>{f.name} — {f.size} bytes</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute('/tools/file-compressor')({
  component: FileCompressor,
});
