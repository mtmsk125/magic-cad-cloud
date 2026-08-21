import { writeFileSync } from "fs";
import { analyzeDxf, repairDxf } from "../src/lib/dxf";
import { cleanupEntities, DEFAULT_CLEANUP_OPTIONS } from "../src/lib/dxf-cleanup";

function wrap(entities: string): string {
  return [
    "  0", "SECTION", "  2", "HEADER", "  9", "$ACADVER", "  1", "AC1009", "  0", "ENDSEC",
    "  0", "SECTION", "  2", "ENTITIES",
    ...entities.split("\n"),
    "  0", "ENDSEC", "  0", "EOF",
  ].join("\n");
}

// LINE x1 y1 x2 y2  (code 5 = handle, 8 = layer)
function line(handle: number, x1: number, y1: number, x2: number, y2: number, layer = "0"): string {
  return [
    "  0", "LINE",
    "  5", handle.toString(16).padStart(4, "0"),
    "  8", layer,
    " 62", "7",
    " 10", String(x1), " 20", String(y1),
    " 11", String(x2), " 21", String(y2),
  ].join("\n");
}

const parts: string[] = [];
let h = 1;

// 50 identical duplicates of the SAME line  (0,0)-(100,0)
for (let i = 0; i < 50; i++) parts.push(line(h++, 0, 0, 100, 0));
// 3 reversed-direction duplicates of (0,0)-(100,0)
for (let i = 0; i < 3; i++) parts.push(line(h++, 100, 0, 0, 0));
// 2 collinear overlaps: (50,0)-(150,0)  -> merges with the (0,0)-(100,0) span
parts.push(line(h++, 50, 0, 150, 0));
parts.push(line(h++, 25, 0, 175, 0));
// 1 fully contained inside (0,0)-(100,0): (10,0)-(90,0)
parts.push(line(h++, 10, 0, 90, 0));
// 2 zero-length "junk" lines
parts.push(line(h++, 7, 0, 7, 0));
parts.push(line(h++, 1, 0, 1, 0));
// 2 DISTINCT parallel lines kept safely (y=0.05) -> must survive
parts.push(line(h++, 0, 0.05, 100, 0.05));
parts.push(line(h++, 0, 0.10, 100, 0.10));

const dxf = wrap(parts.join("\n"));
const before = analyzeDxf(dxf);
const report = repairDxf(dxf, before);
const after = analyzeDxf(report.fixed);

// The individual geometry counters live on the engine itself, so call it
// directly to show the real numbers for the demo input.
const engine = cleanupEntities(before.entities, DEFAULT_CLEANUP_OPTIONS);
const cr = engine.report;

const real = report.fixSummary.find(s => s.id === "real_cleanup");

console.log("BEFORE:  input entities (analyzed)        =", before.stats.totalEntities);
console.log("AFTER :  output entities (re-analyzed)     =", after.stats.totalEntities);
console.log("REDUCTION                                 =", before.stats.totalEntities - after.stats.totalEntities);
console.log("--- real cleanup engine report ---");
console.log("  duplicateEntitiesRemoved     =", cr.duplicateEntitiesRemoved);
console.log("  reversedDuplicatesRemoved    =", cr.reversedDuplicatesRemoved);
console.log("  overlappingSegmentsMerged    =", cr.overlappingSegmentsMerged);
console.log("  containedSegmentsRemoved     =", cr.containedSegmentsRemoved);
console.log("  zeroLengthRemoved            =", cr.zeroLengthRemoved);
console.log("  duplicateVerticesRemoved     =", cr.duplicateVerticesRemoved);
console.log("  totalChanges                 =", cr.totalChanges);
console.log("--- user-facing summary line ---");
console.log(real ? real.en : "(no cleanup step recorded)");
console.log("--- distinct parallel lines preserved? ---");
const parallels = after.entities.filter(e => Math.abs(e.y1 ?? 0) === 0.05 || Math.abs(e.y1 ?? 0) === 0.10 || Math.abs(e.y2 ?? 0) === 0.05 || Math.abs(e.y2 ?? 0) === 0.10);
console.log("  parallel lines still present =", parallels.length);

writeFileSync("scripts/debug-demo-input.dxf", dxf);
writeFileSync("scripts/debug-demo-fixed.dxf", report.fixed);
