import { analyzeDxf, repairDxf } from "../src/lib/dxf";

// LWPOLYLINE with a single bulge segment = quarter-circle arc.
// P1(0,0) -> P2(10,0), bulge = tan(22.5°) = 0.41421 => quarter circle.
const content = [
  "0", "SECTION", "2", "HEADER",
  "0", "ENDSEC",
  "0", "SECTION", "2", "ENTITIES",
  "0", "LWPOLYLINE", "8", "0", "90", "2", "70", "1",
  "10", "0", "20", "0", "42", "0.4142135624",
  "10", "10", "20", "0", "42", "0",
  "0", "ENDSEC", "0", "EOF", "",
].join("\n");

const an = analyzeDxf(content);
console.log("pre-repair entities:", an.entities.length, "score:", an.score);
console.log("bulge issue found:", an.issues.filter((i) => i.type === "bulge_arc").length > 0);

const res = repairDxf(content, an, {});
console.log("post-repair score:", an.score, "=> repaired");
const arcLine = res.fixed.split("\n").filter((l) => l.trim() === "ARC").length;
console.log("ARC entities in output:", arcLine);
const cx = res.fixed.match(/10\n(-?[\d.]+)/)?.[1];
const r = res.fixed.match(/40\n([\d.]+)/)?.[1];
const a1 = res.fixed.match(/50\n(-?[\d.]+)/)?.[1];
const a2 = res.fixed.match(/51\n(-?[\d.]+)/)?.[1];
console.log("ARC fields → cx/cy:", cx, "r:", r, "start:", a1, "end:", a2);
console.log("bulge fix reported:", res.repaired.filter((i) => i.type === "bulge_arc" && i.fixed).length > 0);

// Expected (exact): center (5,5), r=7.0711, start 225°, end 315°
const expected = { cx: 5, cy: 5, r: 7.0711, a1: 225, a2: 315 };
const ok = Math.abs(parseFloat(cx ?? "0") - 5) < 0.01
  && Math.abs(parseFloat(r ?? "0") - 7.0711) < 0.01
  && Math.abs(parseFloat(a1 ?? "0") - 225) < 1
  && Math.abs(parseFloat(a2 ?? "0") - 315) < 1;
console.log(ok ? "✅ BULGE→ARC MATH VERIFIED" : "❌ MATH MISMATCH");

