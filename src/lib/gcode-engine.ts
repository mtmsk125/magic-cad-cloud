/**
 * gcode-engine.ts — Pure G-Code analysis engine
 * Used by /tools/g-code-checker. No React / browser dependencies so the
 * engine can be unit-tested with tsx/node directly.
 */

export type GIssueKind = "error" | "warning" | "info";

export interface GIssue {
  line: number;
  kind: GIssueKind;
  code: string;
  messageAr: string;
  messageEn: string;
}

export interface GCheckResult {
  ok: boolean;
  lines: number;
  blocks: number;
  rapidCount: number;
  cutCount: number;
  maxSpeed: number;
  maxFeed: number;
  totalDistance: number;
  totalCutDistance: number;
  cycleTimeSec: number | null;
  bounds: { minX: number; minY: number; maxX: number; maxY: number; minZ: number; maxZ: number };
  issues: GIssue[];
}

export interface MachineLimits {
  maxX: number;
  maxY: number;
  maxZ: number;
  maxFeed: number; // mm/min
}

export const DEFAULT_LIMITS: MachineLimits = { maxX: 1220, maxY: 2440, maxZ: 200, maxFeed: 4000 };

/** Split a G-code file into non-empty, non-comment line blocks. */
function splitBlocks(code: string): string[] {
  return code
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith(";"));
}

function parseWord(block: string, letter: string): number | null {
  // Match GCode words like X10.5, Y-2, F1500, S1000
  const re = new RegExp(`\\b${letter}\\s*([+-]?\\d+(?:\\.\\d+)?)`, "i");
  const m = block.match(re);
  return m ? parseFloat(m[1]) : null;
}

function distance3d(
  a: { x: number | null; y: number | null; z: number | null },
  b: { x: number | null; y: number | null; z: number | null },
): number {
  const x = (b.x ?? 0) - (a.x ?? 0);
  const y = (b.y ?? 0) - (a.y ?? 0);
  const z = (b.z ?? 0) - (a.z ?? 0);
  return Math.sqrt(x * x + y * y + z * z);
}
/**
 * Analyze a G-code program: per-block validation, machine-limit checks,
 * rapid vs cutting distance, and cycle-time estimation (feed-based).
 */
export function analyzeGCode(code: string, limits: MachineLimits = DEFAULT_LIMITS): GCheckResult {
  const blocks = splitBlocks(code);
  const issues: GIssue[] = [];

  let pos = { x: 0 as number | null, y: 0 as number | null, z: 0 as number | null };
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let rapidCount = 0, cutCount = 0;
  let maxSpeed = 0, maxFeed = 0;
  let totalDistance = 0, totalCutDistance = 0;
  let feed = 300; // default feed (mm/min)
  let spindle = 0;
  let cutMode = true; // absolute
  let programModal: "mm" | "inch" = "mm";

  // --- Stage 1: structural scan ---
  for (const [i, block] of blocks.entries()) {
    const lineNo = i + 1;
    if (block.startsWith("%")) continue;

    const doubleG = block.match(/\bG\d+(?:\.\d+)?/g);
    if (doubleG && doubleG.length > 1) {
      issues.push({
        line: lineNo,
        kind: "error",
        code: "MULTI_G",
        messageAr: "أكثر من كود G في نفس السطر يُعدّ خطأ شائعاً في معظم المتحكمات.",
        messageEn: "Multiple G codes on one block is a formatting error on most controllers.",
      });
    }

    const g = parseWord(block, "G");
    if (g !== null) {
      const knownGs = new Set(["0", "1", "2", "3", "4", "17", "18", "19", "20", "21", "28", "40", "49", "53", "54", "55", "56", "57", "58", "59", "80", "81", "82", "83", "84", "85", "86", "89", "90", "91", "92", "94", "95", "98", "99"]);
      const intG = Math.trunc(g);
      if (!knownGs.has(String(intG))) {
        issues.push({
          line: lineNo,
          kind: "warning",
          code: "UNKNOWN_G",
          messageAr: `كود G${intG} غير شائع أو غير مدعوم — تحقق من توافقه مع ماكينتك.`,
          messageEn: `G${intG} is uncommon/unsupported — verify it against your controller.`,
        });
      }
    }

    if (block.startsWith("(")) {
      issues.push({
        line: lineNo,
        kind: "info",
        code: "PAREN_COMMENT",
        messageAr: "يُفضَّل استخدام تعليقات ; لتوافق أوسع.",
        messageEn: "Consider using ; comments for wider compatibility.",
      });
    }
  }

  // --- Stage 2: motion simulation ---
  const next = { ...pos };
  for (const [i, block] of blocks.entries()) {
    const lineNo = i + 1;
    const g = parseWord(block, "G");

    if (g !== null) {
      const intG = Math.trunc(g);
      if (intG === 21) programModal = "mm";
      if (intG === 20) programModal = "inch";
      if (intG === 90) cutMode = true; // absolute
      if (intG === 91) cutMode = false; // incremental
      if (intG === 0) rapidCount++;
      if (intG === 1) cutCount++;
    }

    let x = parseWord(block, "X");
    let y = parseWord(block, "Y");
    let z = parseWord(block, "Z");
    const f = parseWord(block, "F");
    const s = parseWord(block, "S");

    if (f !== null) {
      feed = f;
      maxFeed = Math.max(maxFeed, f);
      if (f > limits.maxFeed) {
        issues.push({
          line: lineNo,
          kind: "warning",
          code: "FEED_LIMIT",
          messageAr: `معدل التغذية ${f} مم/د يتجاوز حد الماكينة (${limits.maxFeed}).`,
          messageEn: `Feed rate ${f} mm/min exceeds the machine limit (${limits.maxFeed}).`,
        });
      }
    }
    if (s !== null) spindle = s;

    // Convert inch to mm for simulation
    if (programModal === "inch") {
      const conv = 25.4;
      if (x !== null) x = x * conv;
      if (y !== null) y = y * conv;
      if (z !== null) z = z * conv;
    }
    if (!cutMode && !(g !== null && Math.trunc(g) === 92)) {
      if (x !== null) x = (next.x ?? 0) + x;
      if (y !== null) y = (next.y ?? 0) + y;
      if (z !== null) z = (next.z ?? 0) + z;
    }

    const hasMove = x !== null || y !== null || z !== null;
    if (hasMove) {
      if (x !== null) next.x = x;
      if (y !== null) next.y = y;
      if (z !== null) next.z = z;

      const d = distance3d(pos, next);
      totalDistance += d;
      const isRapid = g !== null && Math.trunc(g) === 0;
      if (!isRapid && d > 0) totalCutDistance += d;
const tx = next.x ?? 0, ty = next.y ?? 0, tz = next.z ?? 0;
      if (tx < minX) minX = tx;
      if (ty < minY) minY = ty;
      if (tz < minZ) minZ = tz;
      if (tx > maxX) maxX = tx;
      if (ty > maxY) maxY = ty;
      if (tz > maxZ) maxZ = tz;

      const isSetup = g !== null && Math.trunc(g) === 92;
      if (!isSetup) {
        if (tx > limits.maxX || tx < 0) {
          issues.push({
            line: lineNo,
            kind: "error",
            code: "OUT_X",
            messageAr: `الحركة X=${tx.toFixed(2)} خارج حدود الماكينة (0 – ${limits.maxX}).`,
            messageEn: `X=${tx.toFixed(2)} movement is outside machine bounds (0 – ${limits.maxX}).`,
          });
        }
        if (ty > limits.maxY || ty < 0) {
          issues.push({
            line: lineNo,
            kind: "error",
            code: "OUT_Y",
            messageAr: `الحركة Y=${ty.toFixed(2)} خارج حدود الماكينة (0 – ${limits.maxY}).`,
            messageEn: `Y=${ty.toFixed(2)} movement is outside machine bounds (0 – ${limits.maxY}).`,
          });
        }
        if (tz > limits.maxZ) {
          issues.push({
            line: lineNo,
            kind: "error",
            code: "OUT_Z",
            messageAr: `الحركة Z=${tz.toFixed(2)} فوق حد الماكينة الأعلى (${limits.maxZ}).`,
            messageEn: `Z=${tz.toFixed(2)} movement is above the machine top limit (${limits.maxZ}).`,
          });
        } else if (tz < -50) {
          // Deep plunge — likely a probing error or wrong work offset
          issues.push({
            line: lineNo,
            kind: "warning",
            code: "DEEP_Z",
            messageAr: `الغوص Z=${tz.toFixed(2)} عميق جداً (أعمق من -50مم). تأكد من نقطة الصفر للمادة.`,
            messageEn: `Z=${tz.toFixed(2)} plunge is very deep (below -50mm). Verify your material work offset.`,
          });
        }
      }
      pos = { ...next };
    }
  }

  // --- Stage 3: cycle time (only if feed rates present) ---
  let cycleTimeSec: number | null = null;
  if (totalCutDistance > 0 && feed > 0) {
    cycleTimeSec = Math.round((totalCutDistance / feed) * 60 * 100) / 100;
  }

  const hasError = issues.some((i) => i.kind === "error");

  return {
    ok: !hasError,
    lines: blocks.length,
    blocks: blocks.length,
    rapidCount,
    cutCount,
    maxSpeed,
    maxFeed,
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalCutDistance: Math.round(totalCutDistance * 100) / 100,
    cycleTimeSec,
    bounds: {
      minX: minX === Infinity ? 0 : minX,
      minY: minY === Infinity ? 0 : minY,
      minZ: minZ === Infinity ? 0 : minZ,
      maxX: maxX === -Infinity ? 0 : maxX,
      maxY: maxY === -Infinity ? 0 : maxY,
      maxZ: maxZ === -Infinity ? 0 : maxZ,
    },
    issues,
  };
}

/** Format seconds into HH:MM:SS or MM:SS. */
export function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "—";
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export const SAMPLE_GCODE = `; Sample: pocket cut 100x80mm — replace with your own file
G21           ; mm mode
G90           ; absolute positioning
G17           ; XY plane
G0 Z5         ; clear table
M3 S12000     ; spindle on
G0 X0 Y0
G1 Z-2 F600   ; plunge
G1 X100 F1000 ; cut
G1 Y80
G1 X0
G1 Y0
G0 Z5
M5            ; spindle off
M30           ; end`;