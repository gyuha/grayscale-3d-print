<!-- forge-slug: grayscale-relief-core-1of2 -->
<!-- task: 1 -->
<!-- part: 1/2 -->
<!-- tdd: on -->
# Grayscale relief core pipeline + Bambu A1 3MF generation (Part 1/2)

## Goal / Non-goals
- Goal: scaffold a Vite+React+TS project and implement and test the core pure-function pipeline that turns an image (pixel array) into greyscale → N tone steps → heights snapped to the layer grid → mesh → Bambu A1 3MF (with color change). Produce a sample 3MF so a person can open it in Bambu Studio and verify it.
- Non-goals: web UI (upload, sliders, 2D/3D preview, download button) — that is Part 2. STL output, other printer profiles, rounded corners/frames, dithering, histogram-based quantization, per-step layer counts, server.

## Source of truth
- Glossary terms: Base, Color change height, White layer, Tone step in .forge/CONTEXT.md
- Related ADRs: .forge/adr/261116-134329-two-filament-thickness-tone-bambu-3mf.md
- Reference data (Measured, this session): `fourth+wing+ams.3mf` → layer_height 0.08, initial_layer_print_height 0.16, filament_colour [#000000, #FFFF00, #FFFFFF], `custom_gcode_per_layer.xml` = `<layer top_z="0.88" type="2" extruder="3" color="#FFFFFF" gcode="tool_change"/>` + `<mode value="MultiAsSingle"/>`, 0.2mm pixel grid. Use the internal structure (`3D/3dmodel.model`, `Metadata/project_settings.config`, `Metadata/model_settings.config`, `[Content_Types].xml`, `_rels/.rels`) as the template reference.
- Agreed parameters (defaults):
  - Tone steps N = 7 (range 2–10), white layers per step m = 1, layer height L = 0.08, first layer 0.16
  - Base thickness B = 0.88 (snapped to first layer + n×L), color change height = B
  - Height of tone step k = B + k·m·L (k=0 darkest, k=N-1 brightest)
  - Quantization: after brightness/contrast/gamma/invert, split 0–255 into N equal intervals
  - Size: width in mm (height follows the aspect ratio), pixel pitch 0.2mm (0.1–0.4), plain rectangle
  - Mesh: closed solid (watertight). Merge same-height regions to cut the triangle count
  - 3MF: filament 1 = black, 2 = white, one tool_change to white at the color change height
- Definition of Done:
  1. `npm test` → exit 0 (Vitest; covers quantization, height, mesh, 3MF tests)
  2. `npm run build` → exit 0
  3. `npm run sample` → creates `samples/sample.3mf` (from a gradient fixture image, N=7); `unzip -l samples/sample.3mf` lists `3D/3dmodel.model` and `Metadata/custom_gcode_per_layer.xml`
  4. Mesh watertightness test: every edge of the generated mesh is shared by exactly 2 triangles (automated test)
  5. **Manual UAT (human)**: open `samples/sample.3mf` in Bambu Studio → it opens without errors, the printer is A1, layer height is 0.08, and the layer slider shows a color change marker at 0.88mm, with the 7 tone steps distinguishable in the preview after slicing. If this item fails, revisit the ADR (STL fallback) and hold Part 2.
  - Pre-state (2026-11-16, run): `npm test` → `npm error enoent` (no package.json), so items 1–4 all fail, which is correct for forward checks.

## Work slices
- [ ] S1. Vite+React+TS+Vitest scaffold, add fflate. `.gitignore` covers node_modules/dist/samples — completion criterion: `npm test` (empty or smoke test) and `npm run build` exit 0
- [ ] S2. Image processing: RGBA → greyscale (luminance), brightness/contrast/gamma/invert, N equal-interval quantization → step index array — completion criterion: unit tests pass for boundary values (0, 255, interval boundaries), invert, and N=2/10 (depends: S1)
- [ ] S3. Height calculation: layer-grid snapping (B snapped to first layer + n×L), step k → B + k·m·L, resampling to the pixel pitch — completion criterion: tests pass for N=7, m=1 → max height 1.36, and B=0.9 input → snapped to 0.88 (depends: S2)
- [ ] S4. Mesh generation: heightmap → closed solid (top + side walls + bottom), merging same-height regions, run in a Web Worker so the UI doesn't block — completion criterion: watertightness test (every edge shared by 2 triangles) passes, and the triangle count after merging is below the unmerged count on a test image (depends: S3)
- [ ] S5. Bambu 3MF writer: model XML + A1 project_settings (0.08/0.16, black/white filaments) + custom_gcode_per_layer.xml (tool_change at the color change height) + content types/rels, zipped with fflate — completion criterion: unzip-and-parse test checks the required entries, that top_z = color change height, and the filament colors (depends: S4)
- [ ] S6. `npm run sample` script: gradient fixture → `samples/sample.3mf` — completion criterion: DoD 3 holds, then hand off for DoD 5 (manual Bambu Studio check) (depends: S5)
