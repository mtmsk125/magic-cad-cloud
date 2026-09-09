import { analyzeDxf } from "../src/lib/dxf";

const lines: string[] = [];
const push = (code: string, val: string) => { lines.push(code, val); };

// BLOCKS section with MYSYM definition (a line 0,0 -> 10,0)
push("0", "SECTION"); push("2", "BLOCKS");
push("0", "BLOCK"); push("2", "MYSYM");
push("0", "LINE"); push("10", "0"); push("20", "0"); push("11", "10"); push("21", "0");
push("0", "ENDBLK");
push("0", "ENDSEC");

// ENTITIES with an INSERT of MYSYM at (100,50), scale 2x2
push("0", "SECTION"); push("2", "ENTITIES");
push("0", "INSERT"); push("2", "MYSYM"); push("10", "100"); push("20", "50");
push("41", "2"); push("42", "2"); push("50", "0");
push("0", "ENDSEC");
push("0", "EOF");

const content = lines.join("\n") + "\n";
const r = analyzeDxf(content);
console.log("entities:", r.entities.length);
for (const e of r.entities) {
  console.log(
    e.type,
    `[${e.x1 ?? "?"},${e.y1 ?? "?"} -> ${e.x2 ?? "?"},${e.y2 ?? "?"}]`,
    "layer:", e.layer,
  );
}
// Expected: the INSERT is replaced by a LINE (110,50 -> 120,50) — scaled 2x around origin offset
