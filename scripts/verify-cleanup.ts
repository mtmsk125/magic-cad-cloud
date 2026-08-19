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

const passed = Object.values(results).filter((r) => r.pass).length;
const failed = Object.values(results).length - passed;
writeFileSync(join(process.cwd(), "scripts", "verify-result.json"), JSON.stringify({ passed, failed, results }, null, 2));
console.log("RESULT: " + passed + " passed, " + failed + " failed -> scripts/verify-result.json");
console.log(JSON.stringify(results, null, 2));
process.exit(failed > 0 ? 1 : 0);