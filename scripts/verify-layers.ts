import { cleanupEntities, DEFAULT_CLEANUP_OPTIONS, removeDuplicatedVectors } from "../src/lib/dxf-cleanup";

function lineEnt(layer: string, x1: number, y1: number, x2: number, y2: number) {
  return { type: "LINE", layer, handle: "h", rawLines: [], x1, y1, x2, y2 } as any;
}

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`PASS  ${name} ${detail}`);
  } else {
    fail++;
    console.log(`FAIL  ${name} ${detail}`);
  }
}

// Case A — reversed-identical LINEs on the SAME layer MUST still be de-duplicated
// after the layer-respect fix (regression guard for T1/T2).
{
  const ents = [lineEnt("L1", 0, 0, 100, 0), lineEnt("L1", 100, 0, 0, 0)];
  const r = removeDuplicatedVectors(ents, DEFAULT_CLEANUP_OPTIONS);
  check("A_same_layer_reversed_removed", r.removedDuplicates === 1 && r.entities.length === 1, `removed=${r.removedDuplicates} left=${r.entities.length}`);
}

// Case B — reversed-identical LINEs on DIFFERENT layers with respectLayers:true
// MUST be preserved (each layer is its own design domain). THIS is the bug being
// reported: removeDuplicatedVectors currently ignores layers.
{
  const ents = [lineEnt("L1", 0, 0, 100, 0), lineEnt("L2", 100, 0, 0, 0)];
  const r = removeDuplicatedVectors(ents, { ...DEFAULT_CLEANUP_OPTIONS, respectLayers: true });
  check("B_diff_layer_reversed_kept", r.removedDuplicates === 0 && r.entities.length === 2, `removed=${r.removedDuplicates} left=${r.entities.length}`);
}

// Case C — different layers with respectLayers:FALSE → layer is ignored, so the
// reversed-identical pair IS removed (confirms the guard is gated on the option).
{
  const ents = [lineEnt("L1", 0, 0, 100, 0), lineEnt("L2", 100, 0, 0, 0)];
  const r = removeDuplicatedVectors(ents, { ...DEFAULT_CLEANUP_OPTIONS, respectLayers: false });
  check("C_diff_layer_notRespected_removed", r.removedDuplicates === 1 && r.entities.length === 1, `removed=${r.removedDuplicates} left=${r.entities.length}`);
}

// Case D — end-to-end integration via cleanupEntities: reversed identical pair on
// layer "0" collapses to one entity (mirrors Test2 / Engine_duplicate_removed).
{
  const ents = [lineEnt("0", 0, 0, 100, 0), lineEnt("0", 100, 0, 0, 0)];
  const r = cleanupEntities(ents, DEFAULT_CLEANUP_OPTIONS);
  check("D_integration_reversed_same_layer_removed", r.entities.length === 1 && r.report.duplicateEntitiesRemoved === 1, `kept=${r.entities.length} removed=${r.report.duplicateEntitiesRemoved}`);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
