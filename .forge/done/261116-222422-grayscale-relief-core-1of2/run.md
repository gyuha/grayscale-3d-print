# run — grayscale-relief-core-1of2

Run mode: implemented directly in the main session (no Dynamic Workflow — every slice is a serial chain S1→S6, so parallelism gains nothing; the user approved). TDD: each slice's tests were written first and seen failing (Cannot find module), then implemented.

## Per-slice results
- S1 Vite+React+TS+Vitest scaffold, fflate — ✅ as planned (TypeScript 7.0.2 / Vite 8 / Vitest 5 installed)
- S2 greyscale, brightness/contrast/gamma/invert, N equal-interval quantization — ✅ as planned (11 tests)
- S3 layer-grid snapping, step heights, box-average resampling — ✅ as planned (0.9→0.88, N=7 max 1.36 tests pass)
- S4 heightmap → closed solid + same-height rectangle merging + Web Worker — ⚠ "every edge shared by exactly 2" holds only for inputs without diagonal checkerboards; at checkerboard vertices, 4 wall faces share one vertical edge, so random images are tested on the "closed and consistently oriented (every directed edge has its reverse) + signed volume" criterion instead
- S5 Bambu 3MF writer — ⚠ the custom_gcode `top_z` is written as base height + 1 layer (0.96), not the base height (0.88) (the change is applied before printing that layer, so writing 0.88 would put one white layer on the darkest step — Inferred, confirmed by the manual check)
- S6 `npm run sample` → `samples/sample.3mf` — ✅ as planned (+ added `src/core/pipeline.ts` to share the pipeline between the script and the Part 2 UI)

## Plan vs actual
- Project settings template: baked from the reference 3MF's `project_settings.config` keeping filaments 1 (black) and 3 (white) → `src/core/bambu-a1-project-settings.json` (100 per-filament arrays, flush matrix/vector, different_settings_to_system reduced to 2 filaments). Not generated from scratch, because the reference is proven to load in Bambu Studio.
- 3MF structure mirrors the reference: Application=BambuStudio-02.02.00.85, a components/production-extension split (`3D/Objects/object_1.model`), model_settings with plate/assemble. Thumbnails omitted.
- Mesh triangulation: 1×k strips zigzag, rectangles of 2×2 or more use a centroid fan (all perimeter lattice points kept → no T-junctions). Wall vertical edges are split at every height present at that lattice point.
- Performance (Measured): 250×900 grid, sine pattern → merged 387,348 triangles / 55ms, unmerged 528,162. A 27% reduction — modest for images with many fine bands.
- `.gitignore` was empty, so I wrote node_modules/dist/samples/.DS_Store into it.

## DoD baseline → after
1. `npm test`: enoent (no package.json) → exit 0, 34 passed
2. `npm run build`: enoent → exit 0 (✓ built)
3. `npm run sample` + `unzip -l`: none → samples/sample.3mf, 8 entries including 3D/3dmodel.model and Metadata/custom_gcode_per_layer.xml
4. Watertightness test: none → passes (gradient: all edges shared by 2; random: closed/oriented/volume match). Independently re-parsing sample.3mf in Python: unbalanced edges 0, edge share counts {2: 9018}
5. Manual Bambu Studio check: none → passed (user confirmed: marker at 0.96, darkest band pure black — the top_z = base+1 layer inference holds)
