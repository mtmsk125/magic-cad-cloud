import { writeFileSync } from "fs";
import { analyzeDxf, repairDxf } from "../src/lib/dxf";

function makeDxf(entitiesText: string): string {
  return [
    "  0", "SECTION", "  2", "HEADER", "  9", "$ACADVER", "  1", "AC1009", "  0", "ENDSEC",
    "  0", "SECTION", "  2", "ENTITIES",
    ...entitiesText.split("\n"),
    "  0", "ENDSEC", "  0", "EOF",
  ].join("\n");
}
function line(id: number, x1: number, y1: number, x2: number, y2: number): string {
  return [
    "  0", "LINE", "  5", id.toString(16).padStart(4, "0"), "  8", "0", " 62", "7",
    " 10", String(x1), " 20", String(y1), " 11", String(x2), " 21", String(y2),
  ].join("\n");
}

const dxf = makeDxf([line(1, 0, 0, 100, 0), line(2, 50, 0, 150, 0)].join("\n"));
const analysis = analyzeDxf(dxf);
writeFileSync("scripts/debug-input-analysis.json", JSON.stringify({
  total: analysis.stats.totalEntities,
  entities: analysis.entities.map((e) => ({ type: e.type, layer: e.layer, handle: e.handle, raw: e.rawLines.slice(0, 8), x1: e.x1, x2: e.x2 })),
}, null, 2));
const { fixed } = repairDxf(dxf, analysis);
writeFileSync("scripts/debug-fixed.dxf", "OUTPUT:\n" + fixed);
const re = analyzeDxf(fixed);
writeFileSync("scripts/debug-fixed-analysis.json", JSON.stringify({
  total: re.stats.totalEntities,
  entities: re.entities.map((e) => ({ type: e.type, raw: e.rawLines.slice(0, 6) })),
}, null, 2));
console.log("input total=" + analysis.stats.totalEntities + " after=" + re.stats.totalEntities);