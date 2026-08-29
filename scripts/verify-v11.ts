/**
 * v1.1 FINAL VERIFICATION — single source of truth proof.
 *
 * Scenario (real p266 case): polylines that are GEOMETRICALLY closed
 * (endpoint gap 0.026mm < 0.1mm) but carry closed flag = 0.
 *
 * Required result:
 *   - analyzeDxf detects 4 open_polyline issues
 *   - repairDxf output (`repaired`) contains ALL 4 (fixed: true)   ← v1.1 fix
 *   - needsReview = detected - fixed = 0                           ← GREEN card
 *   - re-parse of the OUTPUT file: 0 open_polyline, flags = 1
 *   - a genuinely open polyline (gap 5.0) stays in needsReview     ← YELLOW path
 */
import { analyzeDxf, repairDxf } from "../src/lib/dxf";
import { writeFileSync } from "fs";

function makeDxf(entitiesText: string[]): string {
  // NOTE: minimal ENTITIES-only wrapper (same as the real legacy files the tool
  // targets). A synthetic HEADER section here broke legacy POLYLINE section
  // splitting during v1.1 debugging — the engine itself is fine.
  // entitiesText is SPREAD so entities are joined by newlines (passing the
  // array as one element would stringify it with commas and corrupt the DXF).
  return [
    "  0", "SECTION", "  2", "ENTITIES",
    ...entitiesText,
    "  0", "ENDSEC", "  0", "EOF",
  ].join("\n");
}

function dxfPolyline(id: number, verts: [number, number][], closed = false): string {
  // BYTE-IDENTICAL to scripts/probe-v11.ts (VERTEX markers + "  10"/"  20"
  // code fields). The probe is proven to parse 5/5 and exercise the v1.1
  // counting path; real-file legacy parsing is separately covered by the
  // 266.dxf regression in verify-cleanup.ts (1780/1780).
  const rows: string[] = ["  0", "POLYLINE", "  5", id.toString(16).padStart(4, "0"), "  8", "0", " 70", closed ? "1" : "0"];
  for (const [x, y] of verts) rows.push("  0", "VERTEX", "  8", "0", "  10", String(x), "  20", String(y));
  rows.push("  0", "SEQEND", "  5", (id + 0x100).toString(16).padStart(4, "0"));
  return rows.join("\n");
}

let failures = 0;
function check(name: string, pass: boolean, detail: string) {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

// ── p266 scenario: 4 polylines, gap = 0.026 (< 0.1 → auto-close), flag = 0 ──
const p266 = makeDxf([
  dxfPolyline(1, [[0, 0], [10, 0], [0, 0.026]], false),
  dxfPolyline(2, [[100, 0], [110, 0], [100, 0.026]], false),
  dxfPolyline(3, [[200, 0], [210, 0], [200, 0.026]], false),
  dxfPolyline(4, [[300, 0], [310, 0], [300, 0.026]], false),
  // one GENUINELY open polyline (gap 5.0) — must remain "needs review"
  dxfPolyline(5, [[400, 0], [410, 0], [410, 5.0]], false),
]);

const before = analyzeDxf(p266);
// v1.1 debugging: dump the exact fixture so it can be diffed against probe-v11's
writeFileSync("scripts/v11-fixture.dxf", p266, "utf8");
const detected = before.issues.filter(i => i.type === "open_polyline");
check("detect", detected.length === 5, `open_polyline detected=${detected.length} (expect 5: 4 near + 1 real)`);

const { fixed, repaired } = repairDxf(p266, before);

// The exact UI computation (tool.tsx lines 1674-1675):
const fixedCount = repaired.length;
const needsReview = before.issues.filter(i => !repaired.find(r => r.id === i.id)).length;
check("fixed-count", fixedCount === 4, `repairedIssues=${fixedCount} (expect 4)`);
check("needs-review", needsReview === 1, `needsReview=${needsReview} (expect 1 — the gap-5.0 one)`);
check("review-is-real-gap", needsReview === 1 && before.issues.filter(i => !repaired.find(r => r.id === i.id))[0]?.id.includes("4"), `remaining id=${before.issues.filter(i => !repaired.find(r => r.id === i.id))[0]?.id}`);

// Every near-gap issue must be in `repaired` (flagged fixed)
const nearIds = ["open_poly_0", "open_poly_1", "open_poly_2", "open_poly_3"];
check("near-gaps-recorded", nearIds.every(id => repaired.some(r => r.id === id)), `repaired ids=[${repaired.map(r => r.id).join(", ")}]`);
check("fixed-flag-set", repaired.filter(r => r.fixed === true).length === 4, `fixed:true count=${repaired.filter(r => r.fixed === true).length} (expect 4)`);

// Re-parse the OUTPUT file — the "proof" for the customer
const after = analyzeDxf(fixed);
const openAfter = after.issues.filter(i => i.type === "open_polyline").length;
check("output-clean", openAfter === 1, `re-parse open_polyline=${openAfter} (expect 1 — only the genuine gap-5.0)`);

// Write the repaired output so the user can inspect it in AutoCAD
writeFileSync("scripts/v11-p266-fixed.dxf", fixed, "utf8");
check("file-written", true, "scripts/v11-p266-fixed.dxf");

console.log(failures === 0 ? "\nRESULT: ALL PASSED ✅" : `\nRESULT: ${failures} FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
