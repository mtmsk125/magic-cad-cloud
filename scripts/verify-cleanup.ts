/**
 * Verification: the cleanup engine really modifies the DXF, and the
 * downloaded file reflects the changes. Results are written to
 * scripts/verify-result.json.
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { analyzeDxf, repairDxf } from "../src/lib/dxf";
import { cleanupEntities, DEFAULT_CLEANUP_OPTIONS } from "../src/lib/dxf-cleanup";

function makeDxf(entitiesText: string): string {
  return [
    "  0", "SECTION", "  2", "HEADER", "  9", "$ACADVER", "  1", "AC1009", "  0", "ENDSEC",
    "  0", "SECTION", "  2", "ENTITIES",
    ...entitiesText.split("\n"),
    "  0", "ENDSEC", "  0", "EOF",
  ].join("\n");
}

function line(id: number, x1: number, y1: number, x2: number, y2: number, layer = "0"): string {
  return [
    "  0", "LINE", "  5", id.toString(16).padStart(4, "0"), "  8", layer, " 62", "7",
    " 10", String(x1), " 20", String(y1), " 11", String(x2), " 21", String(y2),
  ].join("\n");
}

// ---- helpers to build non-LINE vector entities -------------------------

/** LWPOLYLINE as raw DXF text (used for end-to-end analysis→repair). */
function dxfLwpolyline(id: number, verts: [number, number][], closed = false): string {
  const rows: string[] = ["  0", "LWPOLYLINE", "  5", id.toString(16).padStart(4, "0"), "  8", "0",
    " 90", String(verts.length), " 70", closed ? "1" : "0"];
  for (const [x, y] of verts) rows.push(" 10", String(x), " 20", String(y));
  return rows.join("\n");
}

/** Old-style POLYLINE (+ VERTEX entities) as raw DXF text. */
function dxfPolyline(id: number, verts: [number, number][], closed = false): string {
  const rows: string[] = ["  0", "POLYLINE", "  5", id.toString(16).padStart(4, "0"), "  8", "0", " 70", closed ? "1" : "0"];
  for (const [x, y] of verts) rows.push("  0", "VERTEX", "  8", "0", " 10", String(x), " 20", String(y));
  rows.push("  0", "SEQEND");
  return rows.join("\n");
}

/** CIRCLE raw DXF text. */
function dxfCircle(id: number, cx: number, cy: number, r: number): string {
  return ["  0", "CIRCLE", "  5", id.toString(16).padStart(4, "0"), "  8", "0",
    " 10", String(cx), " 20", String(cy), " 40", String(r)].join("\n");
}

/** ARC raw DXF text (angles in degrees). */
function dxfArc(id: number, cx: number, cy: number, r: number, a1: number, a2: number): string {
  return ["  0", "ARC", "  5", id.toString(16).padStart(4, "0"), "  8", "0",
    " 10", String(cx), " 20", String(cy), " 40", String(r), " 50", String(a1), " 51", String(a2)].join("\n");
}

/** SPLINE raw DXF text via control points (codes 10/20). */
function dxfSpline(id: number, pts: [number, number][]): string {
  const rows: string[] = ["  0", "SPLINE", "  5", id.toString(16).padStart(4, "0"), "  8", "0", " 70", "0"];
  for (const [x, y] of pts) rows.push(" 10", String(x), " 20", String(y));
  return rows.join("\n");
}

/** ELLIPSE raw DXF text. */
function dxfEllipse(id: number, cx: number, cy: number, mx: number, my: number, ratio: number): string {
  return ["  0", "ELLIPSE", "  5", id.toString(16).padStart(4, "0"), "  8", "0",
    " 10", String(cx), " 20", String(cy), " 11", String(mx), " 21", String(my),
    " 40", String(ratio), " 41", "0", " 42", String(2 * Math.PI)].join("\n");
}

/** Build an engine-level entity object for direct cleanupEntities tests. */
function ent(partial: any): any {
  return { type: "LINE", layer: "0", handle: "", x1: 0, y1: 0, x2: 0, y2: 0, ...partial };
}

const results: Record<string, { pass: boolean; detail: string }> = {};

function run(name: string, fn: () => { pass: boolean; detail: string }) {
  try {
    results[name] = fn();
  } catch (e: any) {
    results[name] = { pass: false, detail: String(e && e.message ? e.message : e) };
  }
}

run("Test1_identical_lines_1_removed", () => {
  const dxf = makeDxf([line(1, 0, 0, 100, 0), line(2, 0, 0, 100, 0)].join("\n"));
  const analysis = analyzeDxf(dxf);
  const { fixed, fixSummary } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  return {
    pass: re.stats.totalEntities === 1,
    detail: "after=" + re.stats.totalEntities + " cleanup=" + !!fixSummary.find((f) => f.id === "real_cleanup"),
  };
});

run("Test2_reversed_identical_1_removed", () => {
  const dxf = makeDxf([line(1, 0, 0, 100, 0), line(2, 100, 0, 0, 0)].join("\n"));
  const analysis = analyzeDxf(dxf);
  const { fixed } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  return { pass: re.stats.totalEntities === 1, detail: "after=" + re.stats.totalEntities };
});

run("Test3_zero_length_removed", () => {
  const dxf = makeDxf([line(1, 5, 5, 5, 5), line(2, 0, 0, 10, 0)].join("\n"));
  const analysis = analyzeDxf(dxf);
  const { fixed } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  return { pass: re.stats.totalEntities === 1, detail: "after=" + re.stats.totalEntities };
});

run("Test8_nearby_distinct_both_preserved", () => {
  const dxf = makeDxf([line(1, 0, 0, 10, 0), line(2, 0, 0.05, 10, 0.05)].join("\n"));
  const analysis = analyzeDxf(dxf);
  const { fixed } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  return { pass: re.stats.totalEntities === 2, detail: "after=" + re.stats.totalEntities };
});

run("Test6_partial_overlap_merged_span_written", () => {
  const dxf = makeDxf([line(1, 0, 0, 100, 0), line(2, 50, 0, 150, 0)].join("\n"));
  const analysis = analyzeDxf(dxf);
  const { fixed, fixSummary } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  return {
    pass: re.stats.totalEntities === 1 && fixed.includes("150"),
    detail: "after=" + re.stats.totalEntities + " has150=" + fixed.includes("150") + " cleanup=" + !!fixSummary.find((f) => f.id === "real_cleanup"),
  };
});

run("Test5_contained_redundant_removed", () => {
  const dxf = makeDxf([line(1, 0, 0, 100, 0), line(2, 25, 0, 75, 0)].join("\n"));
  const analysis = analyzeDxf(dxf);
  const { fixed } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  return { pass: re.stats.totalEntities === 1, detail: "after=" + re.stats.totalEntities };
});

run("Engine_duplicate_removed", () => {
  const entities = [
    { type: "LINE", layer: "0", handle: "1", rawLines: line(1, 0, 0, 10, 0).split("\n"), x1: 0, y1: 0, x2: 10, y2: 0 },
    { type: "LINE", layer: "0", handle: "2", rawLines: line(2, 10, 0, 0, 0).split("\n"), x1: 10, y1: 0, x2: 0, y2: 0 },
  ] as any;
  const result = cleanupEntities(entities, DEFAULT_CLEANUP_OPTIONS);
  return {
    pass: result.report.duplicateEntitiesRemoved === 1 && result.entities.length === 1,
    detail: "removed=" + result.report.duplicateEntitiesRemoved + " final=" + result.entities.length,
  };
});

run("Engine_polyline_dup_removed", () => {
  const result = cleanupEntities(
    [ent({ type:"LWPOLYLINE", handle:"1", vertices: [{x:0,y:0},{x:10,y:0},{x:10,y:10}] }),
     ent({ type:"LWPOLYLINE", handle:"2", vertices: [{x:0,y:0},{x:10,y:0},{x:10,y:10}] })],
    DEFAULT_CLEANUP_OPTIONS);
  return {
    pass: result.report.duplicatePolylinesRemoved === 1 && result.entities.length === 1,
    detail: "removed=" + result.report.duplicatePolylinesRemoved + " final=" + result.entities.length,
  };
});

run("Engine_polyline_reversed_dup_removed", () => {
  const result = cleanupEntities(
    [ent({ type:"LWPOLYLINE", handle:"1", vertices: [{x:0,y:0},{x:10,y:0},{x:10,y:10}] }),
     ent({ type:"LWPOLYLINE", handle:"2", vertices: [{x:10,y:10},{x:10,y:0},{x:0,y:0}] })],
    DEFAULT_CLEANUP_OPTIONS);
  return {
    pass: result.report.duplicatePolylinesRemoved === 1 && result.entities.length === 1,
    detail: "removed=" + result.report.duplicatePolylinesRemoved + " final=" + result.entities.length,
  };
});

run("Engine_oldpolyline_dup_removed", () => {
  const result = cleanupEntities(
    [ent({ type:"POLYLINE", handle:"1", vertices: [{x:0,y:0},{x:5,y:5}] }),
     ent({ type:"POLYLINE", handle:"2", vertices: [{x:0,y:0},{x:5,y:5}] })],
    DEFAULT_CLEANUP_OPTIONS);
  return {
    pass: result.report.duplicatePolylinesRemoved === 1 && result.entities.length === 1,
    detail: "removed=" + result.report.duplicatePolylinesRemoved + " final=" + result.entities.length,
  };
});

run("Engine_circle_dup_removed", () => {
  const result = cleanupEntities(
    [ent({ type:"CIRCLE", handle:"1", cx:5, cy:5, radius:3 }),
     ent({ type:"CIRCLE", handle:"2", cx:5, cy:5, radius:3 })],
    DEFAULT_CLEANUP_OPTIONS);
  return {
    pass: result.report.duplicateCurvesRemoved === 1 && result.entities.length === 1,
    detail: "removed=" + result.report.duplicateCurvesRemoved + " final=" + result.entities.length,
  };
});

run("Engine_arc_dup_removed", () => {
  const result = cleanupEntities(
    [ent({ type:"ARC", handle:"1", cx:5, cy:5, radius:3, startAngle:0, endAngle:90 }),
     ent({ type:"ARC", handle:"2", cx:5, cy:5, radius:3, startAngle:0, endAngle:90 })],
    DEFAULT_CLEANUP_OPTIONS);
  return {
    pass: result.report.duplicateCurvesRemoved === 1 && result.entities.length === 1,
    detail: "removed=" + result.report.duplicateCurvesRemoved + " final=" + result.entities.length,
  };
});

run("Test_lwpolyline_dup_endtoend", () => {
  const dxf = makeDxf([dxfLwpolyline(1, [[0,0],[10,0],[10,10]]), dxfLwpolyline(2, [[0,0],[10,0],[10,10]])].join("\n"));
  const analysis = analyzeDxf(dxf);
  const { fixed } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  const lw = re.entities.filter(e => e.type === "LWPOLYLINE");
  return {
    pass: lw.length === 1 && re.stats.totalEntities === 1,
    detail: "after=" + re.stats.totalEntities + " lwpolylines=" + lw.length,
  };
});

run("Test_circle_dup_endtoend", () => {
  const dxf = makeDxf([dxfCircle(1, 5, 5, 3), dxfCircle(2, 5, 5, 3)].join("\n"));
  const analysis = analyzeDxf(dxf);
  const before = analysis.entities.map(e => e.type).join(",");
  const { fixed } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  const types = re.entities.map(e => e.type).join(",");
  return {
    // The key guarantee: duplication is gone (only 1 entity survives).
    pass: re.stats.totalEntities === 1,
    detail: "after=" + re.stats.totalEntities + " inTypes=" + before + " outTypes=" + types,
  };
});

run("Test_arc_dup_endtoend", () => {
  const dxf = makeDxf([dxfArc(1, 5, 5, 3, 0, 90), dxfArc(2, 5, 5, 3, 0, 90)].join("\n"));
  const analysis = analyzeDxf(dxf);
  const before = analysis.entities.map(e => e.type).join(",");
  const { fixed } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  const types = re.entities.map(e => e.type).join(",");
  return {
    pass: re.stats.totalEntities === 1,
    detail: "after=" + re.stats.totalEntities + " inTypes=" + before + " outTypes=" + types,
  };
});

run("Test_spline_preserved", () => {
  // A single distinct SPLINE must NOT be removed by the cleanup engine.
  const result = cleanupEntities(
    [ent({ type:"SPLINE", handle:"1", vertices: [{x:0,y:0},{x:5,y:5},{x:10,y:0}] })],
    DEFAULT_CLEANUP_OPTIONS);
  return {
    pass: result.entities.length === 1 && result.entities[0].type === "SPLINE",
    detail: "final=" + result.entities.length + " type=" + result.entities[0].type,
  };
});

run("Test_ellipse_preserved", () => {
  // A single distinct ELLIPSE must NOT be removed by the cleanup engine.
  const result = cleanupEntities(
    [ent({ type:"ELLIPSE", handle:"1", cx:10, cy:10, radius:5, startAngle:0, endAngle:360 })],
    DEFAULT_CLEANUP_OPTIONS);
  return {
    pass: result.entities.length === 1 && result.entities[0].type === "ELLIPSE",
    detail: "final=" + result.entities.length + " type=" + result.entities[0].type,
  };
});

const passed = Object.values(results).filter((r) => r.pass).length;
const failed = Object.values(results).length - passed;
writeFileSync(join(process.cwd(), "scripts", "verify-result.json"), JSON.stringify({ passed, failed, results }, null, 2));
console.log("RESULT: " + passed + " passed, " + failed + " failed -> scripts/verify-result.json");
console.log(JSON.stringify(results, null, 2));
process.exit(failed > 0 ? 1 : 0);