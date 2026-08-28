/**
 * Phase 9 verification — run with: npx tsx scripts/verify-phase9.ts
 * Validates: fixOpenVector thresholds, removeDuplicatedVectors,
 * detectOverlapVectors (read-only), detectSelfIntersections (read-only),
 * and the extended cleanupEntities report counters.
 */
import { cleanupEntities, DEFAULT_CLEANUP_OPTIONS, fixOpenVector, removeDuplicatedVectors, detectOverlapVectors, detectSelfIntersections, autoCloseOpenPaths } from "../src/lib/dxf-cleanup";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? "  — " + detail : ""}`);
  else { console.log(`FAIL  ${name}${detail ? "  — " + detail : ""}`); failed++; }
}

/* 1. fixOpenVector thresholds */
check("gap<0.015 → close", fixOpenVector(0.005).action === "close");
check("gap=0.015 → confirm", fixOpenVector(0.015).action === "confirm");
check("gap=0.1 → confirm", fixOpenVector(0.1).action === "confirm");
check("gap=0.2 → skip (intentional)", fixOpenVector(0.2).action === "skip" && fixOpenVector(0.2).reason === "intentional_open");

/* 2. removeDuplicatedVectors */
const ent = (p: any) => ({ type: "LINE", layer: "0", handle: "h", rawLines: [] as string[], ...p });
// two identical lines 5µm apart on same layer → 1 removed (5µm < 10µm)
const dupRes = removeDuplicatedVectors([
  ent({ handle: "1", x1: 0, y1: 0, x2: 100, y2: 0 }),
  ent({ handle: "2", x1: 0.005, y1: 0, x2: 100.005, y2: 0 }),
]);
check("near-duplicate (5µm offset) removed", dupRes.removedDuplicates === 1, `removed=${dupRes.removedDuplicates}`);
// two DIFFERENT lines 50mm apart → nothing removed
const farRes = removeDuplicatedVectors([
  ent({ handle: "1", x1: 0, y1: 0, x2: 100, y2: 0 }),
  ent({ handle: "2", x1: 0, y1: 50, x2: 100, y2: 50 }),
]);
check("distinct parallel lines kept", farRes.removedDuplicates === 0);
// reversed duplicate
const revRes = removeDuplicatedVectors([
  ent({ handle: "1", x1: 0, y1: 0, x2: 100, y2: 0 }),
  ent({ handle: "2", x1: 100, y1: 0, x2: 0, y2: 0 }),
]);
check("reversed duplicate removed", revRes.removedDuplicates === 1);

/* 3. detectOverlapVectors — READ-ONLY, partial overlap */
const partial = [
  ent({ handle: "1", x1: 0, y1: 0, x2: 100, y2: 0 }),
  ent({ handle: "2", x1: 50, y1: 0, x2: 150, y2: 0 }),
];
const ovRes = detectOverlapVectors(partial, DEFAULT_CLEANUP_OPTIONS);
check("partial overlap detected", ovRes.foundOverlaps === 1, `found=${ovRes.foundOverlaps}`);
check("overlap marked RED", ovRes.overlaps[0]?.mark === "RED" && ovRes.overlaps[0]?.type === "overlap");
check("overlap does NOT delete geometry", partial.length === 2 && partial[0].x1 === 0 && partial[1].x2 === 150);
// fully-contained overlap must NOT be reported (that's stage 5's job)
const contained = detectOverlapVectors([
  ent({ handle: "1", x1: 0, y1: 0, x2: 100, y2: 0 }),
  ent({ handle: "2", x1: 10, y1: 0, x2: 90, y2: 0 }),
], DEFAULT_CLEANUP_OPTIONS);
check("fully-contained NOT flagged as partial overlap", contained.foundOverlaps === 0, `found=${contained.foundOverlaps}`);
// angle difference > 0.5deg → not flagged
const angled = detectOverlapVectors([
  ent({ handle: "1", x1: 0, y1: 0, x2: 100, y2: 0 }),
  ent({ handle: "2", x1: 50, y1: 0, x2: 150, y2: 2 }),
], DEFAULT_CLEANUP_OPTIONS);
check("angle diff > 0.5deg not flagged", angled.foundOverlaps === 0);

/* 4. detectSelfIntersections — READ-ONLY */
const bowtie = [{ type: "LWPOLYLINE", layer: "0", handle: "1", rawLines: [] as string[], closed: false, vertexCount: 4, vertices: [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }] }];
const siRes = detectSelfIntersections(bowtie as any);
check("bowtie self-intersection detected", siRes.foundSelfIntersections === 1, `found=${siRes.foundSelfIntersections} at (${siRes.intersections[0]?.point[0]},${siRes.intersections[0]?.point[1]})`);
check("self-intersection marked RED", siRes.intersections[0]?.mark === "RED");
const square = [{ type: "LWPOLYLINE", layer: "0", handle: "1", rawLines: [] as string[], closed: true, vertexCount: 4, vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }];
const siOk = detectSelfIntersections(square as any);
check("clean closed square: no self-intersection", siOk.foundSelfIntersections === 0);
check("self-intersection does NOT modify geometry", bowtie[0].vertices.length === 4);

/* 5. cleanupEntities report integration */
const reportIn = [
  ent({ handle: "1", x1: 0, y1: 0, x2: 100, y2: 0 }),
  ent({ handle: "2", x1: 0.004, y1: 0, x2: 100.004, y2: 0 }),
  ent({ handle: "3", x1: 50, y1: 20, x2: 150, y2: 20 }),
  ent({ handle: "4", x1: 100, y1: 20, x2: 200, y2: 20 }),
  ent({ handle: "5", x1: 0, y1: 500, x2: 100, y2: 500 }),
  ent({ handle: "6", x1: 100.008, y1: 500, x2: 200, y2: 500 }), // 8µm gap → auto-close
];
const ce = cleanupEntities(reportIn as any, DEFAULT_CLEANUP_OPTIONS);
check("report.fixedOpen present", typeof ce.report.fixedOpen === "number");
// near-dup pair (4µm offset) is deduped by the pipeline (stage 2, stage 5's
// collinear merge, or stage 7 near-dup removal — whichever fires first).
// Assert the OUTCOME: exactly ONE line remains along y=0:
check("near-dup pair fully deduped (one y=0 line remains)", ce.entities.filter(e => e.type === "LINE" && e.y1 === 0 && e.y2 === 0).length === 1);
check("report.foundOverlaps counted", ce.report.foundOverlaps === 1, `found=${ce.report.foundOverlaps}`);
// 6 input − 1 near-dup (stage2) − 1 partial-overlap merge (stage5) + 1 closing LINE = 5
check("8µm gap auto-closed (LINE added)", ce.report.fixedOpen === 1 && ce.entities.length === reportIn.length - 2 + 1, `fixedOpen=${ce.report.fixedOpen} len=${ce.entities.length}`);
check("report.foundSelfIntersections present", typeof ce.report.foundSelfIntersections === "number");

/* 6. Part6.txt scenario — confirm-band and intentional gaps are NOT auto-closed */
check("gap=0.11 → NOT closed (intentional)", fixOpenVector(0.11).action === "skip");
const p6 = autoCloseOpenPaths([
  { entityIndex: 0, entityType: "LINE", layer: "0", start: { x: 0, y: 0 }, end: { x: 0.05, y: 0 }, gap: 0.05, closable: true },
], []);
check("Part6 50µm gap → needsConfirm (not auto-closed)", p6.fixedOpen === 0 && p6.unclosed.length === 1);

console.log(failed === 0 ? "\nALL PHASE 9 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
