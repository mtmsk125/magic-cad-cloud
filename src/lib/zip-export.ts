/**
 * Utility for creating and downloading ZIP archives of processed files
 */

/**
 * Generate a ZIP file from multiple file contents and trigger a download.
 * Uses the Compression Streams API if available, or falls back to manual concatenation.
 */
export async function downloadAllAsZip(
  files: { name: string; content: string; type: string }[],
  zipName: string = "dxfix-processed-files.zip"
): Promise<void> {
  try {
    // Try to use JSZip-like approach with native APIs
    const encoder = new TextEncoder();

    // Build a simple ZIP file manually (PKZIP format)
    const localFileHeaders: Uint8Array[] = [];
    const fileDataEntries: Uint8Array[] = [];
    const centralDirectory: Uint8Array[] = [];
    let offset = 0;
    let fileNumber = 0;

    for (const file of files) {
      const contentBytes = encoder.encode(file.content);
      const fileNameBytes = encoder.encode(file.name);
      const crc = crc32(contentBytes);
      const uncompressedSize = contentBytes.length;

      // Local file header
      const localHeader = new Uint8Array(30 + fileNameBytes.length);
      const lhView = new DataView(localHeader.buffer);
      lhView.setUint32(0, 0x04034b50, true); // Local file header signature
      lhView.setUint16(4, 20, true); // Version needed
      lhView.setUint16(6, 0, true); // General purpose bit flag
      lhView.setUint16(8, 0, true); // Compression method (store)
      lhView.setUint16(10, 0, true); // Last mod time
      lhView.setUint16(12, 0, true); // Last mod date
      lhView.setUint32(14, crc, true); // CRC-32
      lhView.setUint32(18, uncompressedSize, true); // Compressed size
      lhView.setUint32(22, uncompressedSize, true); // Uncompressed size
      lhView.setUint16(26, fileNameBytes.length, true); // File name length
      lhView.setUint16(28, 0, true); // Extra field length
      localHeader.set(fileNameBytes, 30);

      localFileHeaders.push(localHeader);
      fileDataEntries.push(contentBytes);

      // Central directory entry
      const centralEntry = new Uint8Array(46 + fileNameBytes.length);
      const ceView = new DataView(centralEntry.buffer);
      ceView.setUint32(0, 0x02014b50, true); // Central directory signature
      ceView.setUint16(4, 20, true); // Version made by
      ceView.setUint16(6, 20, true); // Version needed
      ceView.setUint16(8, 0, true); // General purpose bit flag
      ceView.setUint16(10, 0, true); // Compression method
      ceView.setUint16(12, 0, true); // Last mod time
      ceView.setUint16(14, 0, true); // Last mod date
      ceView.setUint32(16, crc, true); // CRC-32
      ceView.setUint32(20, uncompressedSize, true); // Compressed size
      ceView.setUint32(24, uncompressedSize, true); // Uncompressed size
      ceView.setUint16(28, fileNameBytes.length, true); // File name length
      ceView.setUint16(30, 0, true); // Extra field length
      ceView.setUint16(32, 0, true); // File comment length
      ceView.setUint16(34, 0, true); // Disk number start
      ceView.setUint16(36, 0, true); // Internal file attributes
      ceView.setUint32(38, 0, true); // External file attributes
      ceView.setUint32(42, offset, true); // Relative offset of local header
      centralEntry.set(fileNameBytes, 46);

      centralDirectory.push(centralEntry);
      offset += localHeader.length + contentBytes.length;
      fileNumber++;
    }

    // End of central directory record
    const centralDirSize = centralDirectory.reduce((sum, e) => sum + e.length, 0);
    const centralDirOffset = localFileHeaders.reduce((sum, h, i) => sum + h.length + fileDataEntries[i].length, 0);
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // End of central directory signature
    eocdView.setUint16(4, 0, true); // Disk number
    eocdView.setUint16(6, 0, true); // Disk number with start of central directory
    eocdView.setUint16(8, fileNumber, true); // Total entries on this disk
    eocdView.setUint16(10, fileNumber, true); // Total entries
    eocdView.setUint32(12, centralDirSize, true); // Size of central directory
    eocdView.setUint32(16, centralDirOffset, true); // Offset of start of central directory
    eocdView.setUint16(20, 0, true); // Comment length

    // Combine everything
    const totalSize = localFileHeaders.reduce((sum, h, i) => sum + h.length + fileDataEntries[i].length, 0) +
      centralDirectory.reduce((sum, e) => sum + e.length, 0) + eocd.length;

    const zipBytes = new Uint8Array(totalSize);
    let pos = 0;
    for (let i = 0; i < localFileHeaders.length; i++) {
      zipBytes.set(localFileHeaders[i], pos);
      pos += localFileHeaders[i].length;
      zipBytes.set(fileDataEntries[i], pos);
      pos += fileDataEntries[i].length;
    }
    for (const entry of centralDirectory) {
      zipBytes.set(entry, pos);
      pos += entry.length;
    }
    zipBytes.set(eocd, pos);

    // Create blob and download
    const blob = new Blob([zipBytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to create ZIP:', error);
    // Fallback: download files individually
    console.warn('Falling back to individual file downloads');
    for (const file of files) {
      const blob = new Blob([file.content], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * Calculate CRC-32 checksum for a Uint8Array
 */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Simulates self-destruct: shows a cleanup notice and prevents re-download.
 * In a real production scenario, this would call a server endpoint to delete files.
 */
export function triggerSelfDestruct(fileNames: string[]): void {
  console.log(`🔒 Self-destruct triggered for files: ${fileNames.join(', ')}`);
  
  // Clear file data from memory
  if (typeof sessionStorage !== 'undefined') {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && fileNames.some(name => key.includes(name))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
  }

  // Store self-destruct flag
  localStorage.setItem('dxfix_self_destruct_triggered', 'true');
  localStorage.setItem('dxfix_self_destruct_time', new Date().toISOString());
}

/**
 * Check if self-destruct has been triggered
 */
export function isSelfDestructTriggered(): boolean {
  return localStorage.getItem('dxfix_self_destruct_triggered') === 'true';
}