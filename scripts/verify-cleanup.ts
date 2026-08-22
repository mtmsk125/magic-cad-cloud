/**
 * Verification: the cleanup engine really modifies the DXF, and the
 * downloaded file reflects the changes. Results are written to
 * scripts/verify-result.json.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { analyzeDxf, repairDxf, snapOpenEndpoints } from "../src/lib/dxf";
import { cleanupEntities, DEFAULT_CLEANUP_OPTIONS } from "../src/lib/dxf-cleanup";
import { classifyManufacturing } from "../src/lib/manufacturing";

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

// passed is computed at EOF (see below)

// ===============================================================
// PHASE 2 — Expanded repair tests (§17–§19 of the master prompt)
// ===============================================================

// --- §19: Geometry preservation (STEP 4 conversion is OFF by default) ---

run("Test_default_preserves_arc", () => {
  const dxf = makeDxf(dxfArc(1, 5, 5, 3, 0, 90));
  const analysis = analyzeDxf(dxf);
  const { fixed } = repairDxf(dxf, analysis); // no options → preserve
  const re = analyzeDxf(fixed);
  const arcs = re.entities.filter(e => e.type === "ARC");
  return {
    pass: arcs.length === 1 && re.entities.length === 1,
    detail: "after=" + re.entities.map(e => e.type).join(",") + " arcs=" + arcs.length,
  };
});

run("Test_default_preserves_circle", () => {
  const dxf = makeDxf(dxfCircle(1, 5, 5, 3));
  const analysis = analyzeDxf(dxf);
  const { fixed } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  const circles = re.entities.filter(e => e.type === "CIRCLE");
  return {
    pass: circles.length === 1 && re.entities.length === 1,
    detail: "after=" + re.entities.map(e => e.type).join(",") + " circles=" + circles.length,
  };
});

run("Test_default_preserves_spline", () => {
  const dxf = makeDxf(dxfSpline(1, [[0,0],[5,5],[10,0]]));
  const analysis = analyzeDxf(dxf);
  const { fixed } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  const splines = re.entities.filter(e => e.type === "SPLINE");
  return {
    pass: splines.length === 1,
    detail: "after=" + re.entities.map(e => e.type).join(",") + " splines=" + splines.length,
  };
});

run("Test_default_preserves_ellipse", () => {
  const dxf = makeDxf(dxfEllipse(1, 10, 10, 5, 0, 0.5));
  const analysis = analyzeDxf(dxf);
  const { fixed } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  const ellipses = re.entities.filter(e => e.type === "ELLIPSE");
  return {
    pass: ellipses.length === 1,
    detail: "after=" + re.entities.map(e => e.type).join(",") + " ellipses=" + ellipses.length,
  };
});

// --- §19: Explicit opt-in does convert curves to polylines ---

run("Test_optin_converts_circle_to_polyline", () => {
  const dxf = makeDxf(dxfCircle(1, 5, 5, 3));
  const analysis = analyzeDxf(dxf);
  const { fixed, fixSummary } = repairDxf(dxf, analysis, { convertCurvesToPolylines: true });
  const re = analyzeDxf(fixed);
  const hasConvertMarker = fixSummary.some(f => f.id === "converted_to_polylines");
  return {
    pass: re.entities.length === 1 && re.entities.every(e => e.type === "LWPOLYLINE" || e.type === "POLYLINE") && hasConvertMarker,
    detail: "after=" + re.entities.map(e => e.type).join(",") + " converted=" + hasConvertMarker,
  };
});

// --- §10 + §11: Open contours — tolerance-respecting snap ---

run("Test_snap_tiny_gap_joins", () => {
  // Two lines whose endpoints are 0.0005 apart (< 0.001 tolerance) → snap joins them.
  const a = { type: "LINE", layer: "0", handle: "1", x1: 0, y1: 0, x2: 10, y2: 0 } as any;
  const b = { type: "LINE", layer: "0", handle: "2", x1: 10.0005, y1: 0, x2: 20, y2: 0 } as any;
  const out = snapOpenEndpoints([a, b], 0.001);
  const bSnapped = out[1];
  const moved = Math.abs((bSnapped.x1 ?? 0) - 10.0) < 0.001;
  return { pass: moved, detail: "b.x1=" + (bSnapped.x1 ?? 0).toFixed(5) };
});

run("Test_snap_medium_gap_not_joined", () => {
  // Two lines 0.5 apart (> 0.001) → snap must NOT move them.
  const a = { type: "LINE", layer: "0", handle: "1", x1: 0, y1: 0, x2: 10, y2: 0 } as any;
  const b = { type: "LINE", layer: "0", handle: "2", x1: 10.5, y1: 0, x2: 20, y2: 0 } as any;
  const out = snapOpenEndpoints([a, b], 0.001);
  const bSnapped = out[1];
  const unchanged = Math.abs((bSnapped.x1 ?? 0) - 10.5) < 1e-9;
  return { pass: unchanged, detail: "b.x1=" + (bSnapped.x1 ?? 0).toFixed(5) };
});

run("Test_snap_large_gap_not_joined", () => {
  // Two lines 5.0 apart → snap must NOT move them.
  const a = { type: "LINE", layer: "0", handle: "1", x1: 0, y1: 0, x2: 10, y2: 0 } as any;
  const b = { type: "LINE", layer: "0", handle: "2", x1: 15, y1: 0, x2: 20, y2: 0 } as any;
  const out = snapOpenEndpoints([a, b], 0.001);
  const bSnapped = out[1];
  const unchanged = Math.abs((bSnapped.x1 ?? 0) - 15.0) < 1e-9;
  return { pass: unchanged, detail: "b.x1=" + (bSnapped.x1 ?? 0).toFixed(5) };
});

run("Test_opencontour_distinct_lines_preserved", () => {
  // Two clearly separated parallel lines at y=0 and y=0.5 (large separation)
  // must NOT be joined by the repair pipeline (no geometry destruction).
  const dxf = makeDxf([line(1, 0, 0, 100, 0), line(2, 0, 0.5, 100, 0.5)].join("\n"));
  const analysis = analyzeDxf(dxf);
  const { fixed } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  return {
    pass: re.stats.totalEntities === 2,
    detail: "after=" + re.stats.totalEntities,
  };
});

// --- §18/§16: Exact / reverse / zero-length coverage for more types ---
run("Test_lwpolyline_zero_length_removed", () => {
  // LWPOLYLINE with a single vertex (degenerate) must be removed as zero-length.
  const result = cleanupEntities(
    [ent({ type: "LWPOLYLINE", handle: "1", vertices: [{ x: 5, y: 5 }] }),
     ent({ type: "LINE", handle: "2", x1: 0, y1: 0, x2: 10, y2: 0 })],
    DEFAULT_CLEANUP_OPTIONS);
  return {
    pass: result.report.zeroLengthRemoved === 1 && result.entities.length === 1,
    detail: "zeroRemoved=" + result.report.zeroLengthRemoved + " final=" + result.entities.length,
  };
});


// ---------- Phase 3: manufacturing SAFETY SCAN (classify-only) ----------
// The scan never mutates geometry — it classifies issues so the
// "Verified re-scan result" panel can report them. See src/lib/manufacturing.ts.

run("Test_phase3_duplicate_classified", () => {
  // Two geometrically identical lines: a confirmed, repairable duplicate.
  const a = ent({ type: "LINE", handle: "1", x1: 0, y1: 0, x2: 10, y2: 0, layer: "L1" });
  const b = ent({ type: "LINE", handle: "2", x1: 0, y1: 0, x2: 10, y2: 0, layer: "L1" });
  const res = classifyManufacturing([a, b]);
  const dup = res.findings.find((f) => f.type === "duplicate");
  return {
    pass: dup && dup.category === "confirmed" && dup.repairable === true,
    detail: "dup=" + JSON.stringify(dup),
  };
});

run("Test_phase3_zero_length_classified", () => {
  // A zero-length line is a confirmed, repairable tiny-geometry error.
  const z = ent({ type: "LINE", handle: "1", x1: 1, y1: 1, x2: 1, y2: 1, layer: "L1" });
  const res = classifyManufacturing([z]);
  const tiny = res.findings.find((f) => f.type === "tiny_geometry");
  return {
    pass: tiny && tiny.category === "confirmed" && tiny.repairable === true,
    detail: "tiny=" + JSON.stringify(tiny),
  };
});

run("Test_phase3_near_gap_classified", () => {
  // Short open stub: own endpoints nearly meet AND sit near other geometry -> near_gap.
  // (We classify — §55 — we do NOT auto-close.)
  const nearGapTol = 0.5;
  const isolateTol = 50;
  const a = ent({ type: "LINE", handle: "1", x1: 0, y1: 0, x2: 5, y2: 0, layer: "L1" });
  const b = ent({ type: "LINE", handle: "2", x1: 5.1, y1: 0, x2: 5.5, y2: 0, layer: "L1" }); // short open stub, ~0.1 from a
  const res = classifyManufacturing([a, b], { nearGapTol, isolateTol });
  const gap = res.findings.find((f) => f.type === "near_gap");
  return {
    pass: gap && gap.category === "confirmed" && gap.repairable === false,
    detail: "gap=" + JSON.stringify(gap),
  };
});

run("Test_phase3_isolated_open_classified", () => {
  // A SHORT open stub floating alone (nothing within isolateTol) -> isolated_open_geometry.
  // Long open lines are NOT flagged — "open entity != defect" (§55/§59).
  const nearGapTol = 0.5;
  const isolateTol = 5;
  const scrapLenTol = 1;
  const stub = ent({ type: "LINE", handle: "1", x1: 0, y1: 0, x2: 0.4, y2: 0, layer: "L1" });
  const res = classifyManufacturing([stub], { nearGapTol, isolateTol, scrapLenTol });
  const iso = res.findings.find((f) => f.type === "isolated_open_geometry");
  return {
    pass: iso && iso.category === "potential" && iso.repairable === false,
    detail: "iso=" + JSON.stringify(iso),
  };
});

run("Test_phase3_normal_drawing_not_flagged", () => {
  // Four long lines forming a closed square outline — a normal LINE-based drawing.
  // Their endpoints touch neighbours (minOther ≈ 0), so NONE are flagged as
  // isolated_open_geometry merely because they are LINE entities.
  const lines = [
    ent({ type: "LINE", handle: "1", x1: 0, y1: 0, x2: 10, y2: 0, layer: "L1" }),
    ent({ type: "LINE", handle: "2", x1: 10, y1: 0, x2: 10, y2: 10, layer: "L1" }),
    ent({ type: "LINE", handle: "3", x1: 10, y1: 10, x2: 0, y2: 10, layer: "L1" }),
    ent({ type: "LINE", handle: "4", x1: 0, y1: 10, x2: 0, y2: 0, layer: "L1" }),
  ];
  const res = classifyManufacturing(lines);
  const openFinds = res.findings.filter((f) => f.type === "isolated_open_geometry" || f.type === "near_gap");
  return {
    pass: openFinds.length === 0 && res.potentialCount === 0,
    detail: "openFinds=" + openFinds.length + " potential=" + res.potentialCount,
  };
});

run("Test_phase3_distinct_open_lines_not_flagged", () => {
  // Two long open LINEs far away from each other: technically open, but normal
  // CAD geometry. They must NOT be reported (len > scrapLenTol ⇒ ambiguous).
  const a = ent({ type: "LINE", handle: "1", x1: 0, y1: 0, x2: 100, y2: 0, layer: "L1" });
  const b = ent({ type: "LINE", handle: "2", x1: 300, y1: 0, x2: 400, y2: 0, layer: "L1" }); // far apart
  const res = classifyManufacturing([a, b], { isolateTol: 5, scrapLenTol: 1 });
  const openFinds = res.findings.filter((f) => f.type === "isolated_open_geometry" || f.type === "near_gap");
  return {
    pass: openFinds.length === 0,
    detail: "openFinds=" + openFinds.length,
  };
});

run("Test_phase3_stray_center_classified", () => {
  // A closed circle far from a nearby cluster → potential stray_geometry (centre-based).
  const cluster = [
    ent({ type: "LINE", handle: "1", x1: 0, y1: 0, x2: 10, y2: 0, layer: "L1" }),
    ent({ type: "LINE", handle: "2", x1: 10, y1: 0, x2: 10, y2: 10, layer: "L1" }),
  ];
  const stray = ent({ type: "CIRCLE", handle: "3", cx: 200, cy: 200, radius: 5, layer: "L1" });
  const res = classifyManufacturing([...cluster, stray], { isolateTol: 50 });
  const s = res.findings.find((f) => f.type === "stray_geometry" && f.entityIndices?.[0] === 2);
  return {
    pass: s && s.category === "potential" && s.repairable === false,
    detail: "stray=" + JSON.stringify(s),
  };
});

run("Test_phase3_safe_closed_not_flagged", () => {
  // A closed contour surfaces as a safe/informational finding.
  const c = ent({ type: "LWPOLYLINE", handle: "1", closed: true, layer: "L1", vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] });
  const res = classifyManufacturing([c]);
  return {
    pass: res.safeCount >= 1,
    detail: "safeCount=" + res.safeCount,
  };
});

run("Test_phase3_no_double_count_stray", () => {
  // A closed contour must NOT also be classified as stray (no double counting).
  const closed = ent({ type: "LWPOLYLINE", handle: "1", closed: true, layer: "L1", vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] });
  const res = classifyManufacturing([closed], { isolateTol: 50 });
  const strayOnClosed = res.findings.find((f) => f.type === "stray_geometry" && f.entityIndices?.[0] === 0);
  return {
    pass: !strayOnClosed,
    detail: "strayOnClosed=" + JSON.stringify(strayOnClosed),
  };
});

run("Test_phase3_rescan_after_repair_consistent", () => {
  // Real re-scan consistency (§60): after structural repair (which removes duplicates
  // and zero-length), classifyManufacturing on the repaired entity list must no longer
  // report duplicate/tiny findings. We assert observed behaviour, not hardcoded counts.
  const a = ent({ type: "LINE", handle: "1", x1: 0, y1: 0, x2: 10, y2: 0, layer: "L1" });
  const b = ent({ type: "LINE", handle: "2", x1: 0, y1: 0, x2: 10, y2: 0, layer: "L1" }); // dup of a
  const before = classifyManufacturing([a, b]);
  const beforeHasDup = before.findings.some((f) => f.type === "duplicate");
  const repaired = cleanupEntities([a, b], DEFAULT_CLEANUP_OPTIONS).entities;
  const after = classifyManufacturing(repaired);
  const afterHasDup = after.findings.some((f) => f.type === "duplicate");
  const afterHasTiny = after.findings.some((f) => f.type === "tiny_geometry");
  return {
    pass: beforeHasDup && !afterHasDup && !afterHasTiny,
    detail: "beforeDup=" + beforeHasDup + " afterDup=" + afterHasDup + " afterTiny=" + afterHasTiny + " repairedLen=" + repaired.length,
  };
});


// ============================================================
// Phase 5A: legacy AC1009 POLYLINE/VERTEX parsing + repair safety
// ============================================================

run("Test_p5a_legacy_polyline_grouping", () => {
  // POLYLINE -> VERTEX x3 -> SEQEND must parse as ONE logical POLYLINE
  // carrying its 3 vertices; VERTEX/SEQEND must not become entities.
  const dxf = makeDxf(dxfPolyline(1, [[0, 0], [10, 0], [10, 10]]));
  const analysis = analyzeDxf(dxf);
  const polys = analysis.entities.filter((e) => e.type === "POLYLINE");
  const orphanVerts = analysis.entities.filter((e) => e.type === "VERTEX" || e.type === "SEQEND");
  const v = polys[0]?.vertices ?? [];
  return {
    pass:
      analysis.entities.length === 1 &&
      polys.length === 1 &&
      orphanVerts.length === 0 &&
      v.length === 3 &&
      v[0].x === 0 && v[0].y === 0 &&
      v[2].x === 10 && v[2].y === 10,
    detail: "entities=" + analysis.entities.map(e => e.type).join(",") +
      " verts=" + JSON.stringify(v),
  };
});

run("Test_p5a_closed_flag_detected", () => {
  // Legacy flag code 70 = 1 → closed polyline.
  const dxf = makeDxf(dxfPolyline(1, [[0, 0], [10, 0], [10, 10], [0, 10]], true));
  const p = analyzeDxf(dxf).entities[0];
  return {
    pass: p?.type === "POLYLINE" && p.closed === true && (p.vertices?.length ?? 0) === 4,
    detail: "closed=" + p?.closed + " verts=" + p?.vertices?.length,
  };
});

run("Test_p5a_open_flag_detected", () => {
  // Legacy flag code 70 absent/0 → open polyline.
  const dxf = makeDxf(dxfPolyline(1, [[0, 0], [10, 0], [10, 10]], false));
  const p = analyzeDxf(dxf).entities[0];
  return {
    pass: p?.type === "POLYLINE" && p.closed !== true && (p.vertices?.length ?? 0) === 3,
    detail: "closed=" + p?.closed + " verts=" + p?.vertices?.length,
  };
});

run("Test_p5a_seqend_not_geometry", () => {
  // SEQEND belongs to the legacy POLYLINE structure — never geometry/stats.
  const dxf = makeDxf(dxfPolyline(1, [[0, 0], [10, 0]]) + "\n" + line(2, 50, 50, 60, 60));
  const analysis = analyzeDxf(dxf);
  const bookkeeping = analysis.entities.filter((e) => e.type === "SEQEND" || e.type === "VERTEX");
  return {
    pass: bookkeeping.length === 0 && analysis.stats.totalEntities === 2,
    detail: "total=" + analysis.stats.totalEntities + " bookkeeping=" + bookkeeping.length,
  };
});

run("Test_p5a_genuine_tiny_polyline_detected", () => {
  // A positively-degenerate legacy POLYLINE (sub-tolerance perimeter) must
  // STILL be classified as tiny — we fixed representation, not detection.
  // Phase 6A note: tiny is SCALE-AWARE, so the fixture includes normal-scale
  // context (as real junk always coexists with real geometry). A sliver that
  // constitutes the ENTIRE drawing is not suspicious relative to its own world.
  const normal = ent({ type: "LINE", handle: "2", layer: "L1", x1: 0, y1: 0, x2: 100, y2: 0 });
  const tiny = ent({
    type: "POLYLINE", handle: "1", layer: "L1",
    vertices: [{ x: 10, y: 10 }, { x: 10.0001, y: 10 }],
  });
  const res = classifyManufacturing([normal, tiny]);
  const t = res.findings.find((f) => f.type === "tiny_geometry" && f.category === "confirmed");
  return {
    pass: !!t,
    detail: "tinyFindings=" + res.findings.filter(f => f.type === "tiny_geometry").length,
  };
});

run("Test_p5a_cleanup_preserves_uncertain_polyline", () => {
  // SAFETY (§7): a legacy POLYLINE with an unpopulated vertex list is an
  // UNCERTAIN representation — cleanup must preserve it, not delete it.
  const uncertain = ent({ type: "POLYLINE", handle: "1", layer: "L1", vertices: [] });
  const result = cleanupEntities([uncertain], DEFAULT_CLEANUP_OPTIONS);
  return {
    pass: result.entities.length === 1 && result.entities[0].type === "POLYLINE",
    detail: "kept=" + result.entities.length + " zeroRemoved=" + result.report.zeroLengthRemoved,
  };
});

run("Test_p5a_repair_preserves_header_only_polyline", () => {
  // End-to-end §8 failure guard: a header-only POLYLINE (no VERTEX records)
  // must survive analyze → repair → serialize → re-parse WITHOUT deletion.
  const dxf = makeDxf("  0\nPOLYLINE\n  5\nAAA\n  8\n0\n 70\n0");
  const analysis = analyzeDxf(dxf);
  const { fixed } = repairDxf(dxf, analysis);
  const re = analyzeDxf(fixed);
  const stillThere = re.entities.filter((e) => e.type === "POLYLINE");
  return {
    pass: stillThere.length >= 1,
    detail: "before=" + analysis.stats.totalEntities + " after=" + re.stats.totalEntities +
      " polylinesAfterRepair=" + stillThere.length,
  };
});

run("Test_p5a_roundtrip_legacy_polyline", () => {
  // Full round-trip (§9): parse → repair → serialize → parse again.
  // Logical geometry (count, vertices, coordinates, closed state) must survive.
  const dxf = makeDxf(dxfPolyline(1, [[3, 4], [13, 4], [13, 14]], true));
  const before = analyzeDxf(dxf);
  const bp = before.entities.find((e) => e.type === "POLYLINE");
  const { fixed } = repairDxf(dxf, before);
  const after = analyzeDxf(fixed);
  const ap = after.entities.find((e) => e.type === "POLYLINE");
  const sameCoords =
    !!bp && !!ap &&
    bp.vertices?.length === ap?.vertices?.length &&
    bp.vertices!.every((v, i) =>
      Math.abs(v.x - ap!.vertices![i].x) < 1e-6 && Math.abs(v.y - ap!.vertices![i].y) < 1e-6);
  return {
    pass:
      before.entities.length === after.entities.length &&
      ap?.type === "POLYLINE" &&
      ap?.closed === true &&
      ap?.vertices?.length === 3 &&
      sameCoords,
    detail: "before=" + before.entities.length + " after=" + after.entities.length +
      " verts=" + ap?.vertices?.length + " closed=" + ap?.closed + " sameCoords=" + sameCoords,
  };
});

run("Test_p5a_customer_266_structure", () => {
  // Test G — real customer file integration/regression (§10).
  // Skips gracefully if the fixture is not present in the environment.
  const p = join(process.cwd(), "test-fixtures", "266.dxf");
  if (!existsSync(p)) return { pass: true, detail: "SKIPPED (fixture not present)" };
  const content = readFileSync(p, "utf8");
  const analysis = analyzeDxf(content);
  const polys = analysis.entities.filter((e) => e.type === "POLYLINE");
  const closedN = polys.filter((e) => e.closed === true).length;
  const openPolys = polys.filter((e) => e.closed !== true);
  const bookkeeping = analysis.entities.filter((e) => e.type === "VERTEX" || e.type === "SEQEND");
  const allHaveVerts = polys.every((e) => (e.vertices?.length ?? 0) > 0);
  const scan = classifyManufacturing(analysis.entities);
  const tinyConfirmed = scan.findings.filter(
    (f) => f.type === "tiny_geometry" && f.category === "confirmed").length;
  // Customer-reported facts: 1780 total / 1776 closed / 4 open.
  const structOk = polys.length === 1780 && closedN === 1776 && openPolys.length === 4;
  const opensOk = openPolys.every(
    (e) => (e.vertices?.length ?? 0) === 2 &&
      Math.abs(e.vertices![1].x - e.vertices![0].x) +
        Math.abs(e.vertices![1].y - e.vertices![0].y) > 0);
  return {
    pass: structOk && bookkeeping.length === 0 && allHaveVerts && opensOk && tinyConfirmed === 0,
    detail: "polys=" + polys.length + " closed=" + closedN + " open=" + openPolys.length +
      " bookkeeping=" + bookkeeping.length + " allHaveVerts=" + allHaveVerts +
      " tinyConfirmed=" + tinyConfirmed +
      " confirmed=" + scan.confirmedCount + " potential=" + scan.potentialCount +
      " safe=" + scan.safeCount,
  };
});


/* ========================================================================== */
/* PHASE 6A — regression tests for the two critical geometry-safety bugs     */
/* ========================================================================== */

// --- Bug 1: open LWPOLYLINE must never silently become closed -------------

run("Test_p6a_A_open_lwpoly_with_dup_endpoints_stays_open", () => {
  // Open LWPOLYLINE whose last vertex RECORD duplicates the first, but the
  // real contour is wide open (gap ≈ 7.07 units). Repair must NOT close it.
  const dxf = makeDxf(dxfLwpolyline(1, [[0, 0], [10, 0], [10, 10], [5, 5], [0, 0]], false));
  const { fixed } = repairDxf(dxf, analyzeDxf(dxf));
  const p = analyzeDxf(fixed).entities[0];
  return {
    pass: p?.type === "LWPOLYLINE" && p.closed === false,
    detail: "closed=" + p?.closed + " verts=" + (p?.vertices?.length ?? 0),
  };
});

run("Test_p6a_B_genuinely_closed_lwpolyline_stays_closed", () => {
  // Explicit closed flag + truly closed ring → remains closed.
  const dxf = makeDxf(dxfLwpolyline(1, [[0, 0], [10, 0], [10, 10], [0, 10]], true));
  const { fixed } = repairDxf(dxf, analyzeDxf(dxf));
  const p = analyzeDxf(fixed).entities[0];
  return {
    pass: p?.closed === true && (p?.vertices?.length ?? 0) === 4,
    detail: "closed=" + p?.closed + " verts=" + (p?.vertices?.length ?? 0),
  };
});

run("Test_p6a_C_explicit_closed_with_dup_last_vertex_keeps_flag", () => {
  // Closed flag set AND last vertex duplicates first → dedupe pops the dup,
  // the entity stays closed (flag preserved), and no silent reopen occurs.
  const dxf = makeDxf(dxfLwpolyline(1, [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], true));
  const { fixed } = repairDxf(dxf, analyzeDxf(dxf));
  const p = analyzeDxf(fixed).entities[0];
  return {
    pass: p?.closed === true && (p?.vertices?.length ?? 0) === 4,
    detail: "closed=" + p?.closed + " verts=" + (p?.vertices?.length ?? 0),
  };
});

run("Test_p6a_D_explicit_open_far_gap_never_closed", () => {
  // Explicitly open (70=0) with a large endpoint gap → cleanup must leave it open.
  const dxf = makeDxf(dxfLwpolyline(1, [[0, 0], [100, 0], [100, 100]], false));
  const { fixed } = repairDxf(dxf, analyzeDxf(dxf));
  const p = analyzeDxf(fixed).entities[0];
  return {
    pass: p?.closed === false,
    detail: "closed=" + p?.closed,
  };
});

run("Test_p6a_E_parliament_fixture_stays_open_roundtrip", () => {
  // Real-world fixture: open LWPOLYLINE with a duplicated first vertex record.
  const f = join("test-fixtures", "os-dataset", "05-houses-of-parliament.dxf");
  if (!existsSync(f)) return { pass: true, detail: "fixture missing — skipped" };
run("Test_p6a_E_parliament_fixture_stays_open_roundtrip", () => {
  // Real-world fixture: open LWPOLYLINE with a duplicated first vertex record.
  const f = join("test-fixtures", "os-dataset", "05-houses-of-parliament.dxf");
  if (!existsSync(f)) return { pass: true, detail: "fixture missing — skipped" };
  const content = readFileSync(f, "utf8");
  const before = analyzeDxf(content);
  const polyBefore = before.entities.find(e => e.type === "LWPOLYLINE");
  const { fixed } = repairDxf(content, before);
  const after = analyzeDxf(fixed);
  const polyAfter = after.entities.find(e => e.type === "LWPOLYLINE");
  return {
    pass: !!polyBefore && !!polyAfter &&
      polyBefore.closed === false && polyAfter.closed === false,
    detail: "before.closed=" + polyBefore?.closed + " after.closed=" + polyAfter?.closed +
      " verts " + (polyBefore?.vertices?.length ?? 0) + "->" + (polyAfter?.vertices?.length ?? 0),
  };
});

// --- Bug 2: tiny-geometry handling must be scale-aware ---------------------

run("Test_p6a_A_small_scale_valid_geometry_preserved", () => {
  // Drawing whose whole bbox is ~0.05 units; segments of ~0.005 are REAL
  // geometry at this scale (10% of the drawing!) and must survive repair.
  const segs: string[] = [];
  for (let i = 0; i < 8; i++) {
    segs.push(line(i + 1, i * 0.005, 0, (i + 1) * 0.005, 0.002));
  }
  const dxf = makeDxf(segs.join("\n"));
  const before = analyzeDxf(dxf);
  const { fixed } = repairDxf(dxf, before);
  const after = analyzeDxf(fixed);
  const linesAfter = after.entities.filter(e => e.type === "LINE").length;
  return {
    pass: linesAfter === 8,
    detail: "lines before=" + before.entities.filter(e => e.type === "LINE").length +
      " after=" + linesAfter,
  };
});

run("Test_p6a_B_normal_scale_tiny_sliver_still_removed", () => {
  // Normal-scale drawing (~100 units): a 1e-7-unit micro sliver is junk
  // relative to the drawing scale and must still be removed by cleanup.
  const dxf = makeDxf([line(1, 0, 0, 100, 0), line(2, 10, 10, 10.0000001, 10)].join("\n"));
  const { fixed } = repairDxf(dxf, analyzeDxf(dxf));
  const after = analyzeDxf(fixed);
  return {
    pass: after.entities.filter(e => e.type === "LINE").length === 1,
    detail: "lines after=" + after.entities.filter(e => e.type === "LINE").length,
  };
});

run("Test_p6a_C_exact_zero_length_still_detected_and_removed", () => {
  // A zero-length LINE is junk at ANY scale — detection + removal unchanged.
  const dxf = makeDxf([line(1, 50, 50, 60, 60), line(2, 10, 10, 10, 10)].join("\n"));
  const scan = classifyManufacturing(analyzeDxf(dxf).entities);
  const zeroFindings = scan.findings.filter(f => f.type === "tiny_geometry" && f.category === "confirmed");
run("Test_p6a_D_large_scale_normal_geometry_not_tiny", () => {
  // Large-scale drawing (bbox ~160 units like the customer file): ordinary
  // 80–130 unit lines must NOT be classified tiny.
  const ents = [
    ent({ type: "LINE", x1: 0, y1: 0, x2: 130, y2: 0 }),
    ent({ type: "LINE", x1: 0, y1: 90, x2: 120, y2: 90 }),
  ] as any[];
  const scan = classifyManufacturing(ents);
  const tiny = scan.findings.filter(f => f.type === "tiny_geometry" && f.category !== "safe");
  return { pass: tiny.length === 0, detail: "tiny findings=" + tiny.length };
});

run("Test_p6a_E_us_states_coastline_not_deleted", () => {
  // Real fixture: small-scale map. Before the fix ~1,407 legitimate segments
  // (< 0.01 absolute) were deleted. They must now survive the round trip.
  const f = join("test-fixtures", "os-dataset", "04-us-states.dxf");
  if (!existsSync(f)) return { pass: true, detail: "fixture missing — skipped" };
  const content = readFileSync(f, "utf8");
  const before = analyzeDxf(content);
  const lenBefore = before.entities.filter(e => e.type === "LINE")
    .reduce((s: number, e: any) => s + Math.hypot((e.x2 ?? 0) - (e.x1 ?? 0), (e.y2 ?? 0) - (e.y1 ?? 0)), 0);
  const { fixed } = repairDxf(content, before);
  const after = analyzeDxf(fixed);
  const shortSegs = after.entities.filter(e => {
    if (e.type !== "LINE") return false;
    const l = Math.hypot((e.x2 ?? 0) - (e.x1 ?? 0), (e.y2 ?? 0) - (e.y1 ?? 0));
    return l > 0.00001 && l < 0.01; // the formerly-deleted coastline band
  }).length;
  const lenAfter = after.entities.filter(e => e.type === "LINE")
    .reduce((s: number, e: any) => s + Math.hypot((e.x2 ?? 0) - (e.x1 ?? 0), (e.y2 ?? 0) - (e.y1 ?? 0)), 0);
  // Duplicates may legitimately be removed; the short-segment band must survive.
  return {
    pass: after.entities.length > 0 && shortSegs > 1000 && lenAfter > lenBefore * 0.55,
    detail: "reparsed=" + (after.entities.length > 0 ? "ok" : "?") +
      " shortSegsSurviving=" + shortSegs +
      " len " + lenBefore.toFixed(2) + "->" + lenAfter.toFixed(2),
  };
});


  const { fixed } = repairDxf(dxf, analyzeDxf(dxf));
  const after = analyzeDxf(fixed);
  return {
    pass: zeroFindings.length === 1 &&
      after.entities.filter(e => e.type === "LINE").length === 1,
    detail: "zeroFindings=" + zeroFindings.length +
      " linesAfter=" + after.entities.filter(e => e.type === "LINE").length,
  };
});


  const content = readFileSync(f, "utf8");
  const before = analyzeDxf(content);
  const polyBefore = before.entities.find(e => e.type === "LWPOLYLINE");
  const { fixed } = repairDxf(content, before);
  const after = analyzeDxf(fixed);
  const polyAfter = after.entities.find(e => e.type === "LWPOLYLINE");
  return {
    pass: !!polyBefore && !!polyAfter &&
      polyBefore.closed === false && polyAfter.closed === false,
    detail: "before.closed=" + polyBefore?.closed + " after.closed=" + polyAfter?.closed +
      " verts " + (polyBefore?.vertices?.length ?? 0) + "->" + (polyAfter?.vertices?.length ?? 0),
  };
});

// --- Bug 2: tiny-geometry handling must be scale-aware ---------------------

run("Test_p6a_A_small_scale_valid_geometry_preserved", () => {
  // Drawing whose whole bbox is ~0.05 units; segments of ~0.005 are REAL
  // geometry at this scale and must survive repair.
  const segs: string[] = [];
  for (let i = 0; i < 8; i++) {
    segs.push(line(i + 1, i * 0.005, 0, (i + 1) * 0.005, 0.002));
  }
  const dxf = makeDxf(segs.join("\n"));
  const before = analyzeDxf(dxf);
  const { fixed } = repairDxf(dxf, before);
  const after = analyzeDxf(fixed);
  const linesAfter = after.entities.filter(e => e.type === "LINE").length;
  return {
    pass: linesAfter === 8,
    detail: "lines before=" + before.entities.filter(e => e.type === "LINE").length +
      " after=" + linesAfter,
  };
});

run("Test_p6a_B_normal_scale_tiny_sliver_still_removed", () => {
  // Normal-scale drawing (~100 units): a micro sliver is junk relative to
  // the drawing scale and is still removed by cleanup.
  const big = line(1, 0, 0, 100, 0);
  const sliver = line(2, 10, 10, 10.0000001, 10);
  const dxf = makeDxf([big, sliver].join("\n"));
  const { fixed } = repairDxf(dxf, analyzeDxf(dxf));
  const after = analyzeDxf(fixed);
  return {
    pass: after.entities.filter(e => e.type === "LINE").length === 1,
    detail: "lines after=" + after.entities.filter(e => e.type === "LINE").length,
  };
});

run("Test_p6a_C_exact_zero_length_still_detected_and_removed", () => {
  // A zero-length LINE is junk at ANY scale — detection + removal unchanged.
  const dxf = makeDxf([line(1, 50, 50, 60, 60), line(2, 10, 10, 10, 10)].join("\n"));
  const scan = classifyManufacturing(analyzeDxf(dxf).entities);
  const zeroFindings = scan.findings.filter(f => f.type === "tiny_geometry" && f.category === "confirmed");
  const { fixed } = repairDxf(dxf, analyzeDxf(dxf));
  const after = analyzeDxf(fixed);
  return {
    pass: zeroFindings.length === 1 &&
      after.entities.filter(e => e.type === "LINE").length === 1,
    detail: "zeroFindings=" + zeroFindings.length +
      " linesAfter=" + after.entities.filter(e => e.type === "LINE").length,
  };
});

run("Test_p6a_D_large_scale_normal_geometry_not_tiny", () => {
  // Large-scale drawing (bbox ~160 units like the customer file): ordinary
  // 80–150 unit lines must NOT be classified tiny.
  const ents = [
    ent({ type: "LINE", x1: 0, y1: 0, x2: 130, y2: 0 }),
    ent({ type: "LINE", x1: 0, y1: 90, x2: 120, y2: 90 }),
  ] as any[];
  const scan = classifyManufacturing(ents);
  const tiny = scan.findings.filter(f => f.type === "tiny_geometry" && f.category !== "safe");
  return { pass: tiny.length === 0, detail: "tiny findings=" + tiny.length };
});

run("Test_p6a_E_us_states_coastline_not_deleted", () => {
  // Real fixture: small-scale map. Before the fix ~1,407 legitimate segments
  // (< 0.01 absolute) were deleted. They must now survive the round trip.
  const f = join("test-fixtures", "os-dataset", "04-us-states.dxf");
  if (!existsSync(f)) return { pass: true, detail: "fixture missing — skipped" };
  const content = readFileSync(f, "utf8");
  const before = analyzeDxf(content);
  const lenBefore = before.entities.filter((e: any) => e.type === "LINE")
    .reduce((s: number, e: any) => s + Math.hypot((e.x2 ?? 0) - (e.x1 ?? 0), (e.y2 ?? 0) - (e.y1 ?? 0)), 0);
  const { fixed } = repairDxf(content, before);
  const after = analyzeDxf(fixed);
  const shortSegs = after.entities.filter((e: any) => {
    if (e.type !== "LINE") return false;
    const l = Math.hypot((e.x2 ?? 0) - (e.x1 ?? 0), (e.y2 ?? 0) - (e.y1 ?? 0));
    return l > 0.00001 && l < 0.01; // the formerly-deleted coastline band
  }).length;
  const lenAfter = after.entities.filter((e: any) => e.type === "LINE")
    .reduce((s: number, e: any) => s + Math.hypot((e.x2 ?? 0) - (e.x1 ?? 0), (e.y2 ?? 0) - (e.y1 ?? 0)), 0);
  // Duplicates may legitimately be removed; the short-segment band must survive.
  return {
    pass: after.entities.length > 0 && shortSegs > 1000 && lenAfter > lenBefore * 0.55,
    detail: "shortSegsSurviving=" + shortSegs +
      " len " + lenBefore.toFixed(2) + "->" + lenAfter.toFixed(2),
  };
});


const passed = Object.values(results).filter((r) => r.pass).length;
const failed = Object.values(results).length - passed;
writeFileSync(join(process.cwd(), "scripts", "verify-result.json"), JSON.stringify({ passed, failed, results }, null, 2));
console.log("RESULT: " + passed + " passed, " + failed + " failed -> scripts/verify-result.json");
console.log(JSON.stringify(results, null, 2));
process.exit(failed > 0 ? 1 : 0);