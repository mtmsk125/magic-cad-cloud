/**
 * Stage-by-stage profiling of the cleanup ENGINE only (entities built in
 * memory — NO parse step). Isolates engine cost from dxf.ts parse bottleneck.
 */
import type { DxfEntity } from "../src/lib/dxf";
import {
  cleanupEntities,
  removeDuplicatedVectors,
  detectOverlapVectors,
  detectSelfIntersections,
  detectOpenPaths,
  DEFAULT_CLEANUP_OPTIONS,
} from "../src/lib/dxf-cleanup";

function makeLine(i: number): DxfEntity {
  return {
    type: "LINE",
    layer: "0",
    handle: i.toString(16).padStart(4, "0"),
    x1: i * 0.1, y1: 0, z1: 0,
    x2: i * 0.1 + 0.08, y2: 0, z2: 0,
    rawLines: [],
  };
}

const N = 50000;
const entities: DxfEntity[] = [];
for (let i = 0; i < N; i++) entities.push(makeLine(i));
const opts = DEFAULT_CLEANUP_OPTIONS;

let t = Date.now();
detectOpenPaths(entities, opts);
console.log(`detectOpenPaths: ${Date.now() - t}ms`);

t = Date.now();
detectSelfIntersections(entities);
console.log(`detectSelfIntersections: ${Date.now() - t}ms`);

t = Date.now();
detectOverlapVectors(entities, opts);
console.log(`detectOverlapVectors: ${Date.now() - t}ms`);

t = Date.now();
removeDuplicatedVectors(entities, opts);
console.log(`removeDuplicatedVectors: ${Date.now() - t}ms`);

t = Date.now();
cleanupEntities(entities, opts);
console.log(`cleanupEntities (full engine): ${Date.now() - t}ms`);
