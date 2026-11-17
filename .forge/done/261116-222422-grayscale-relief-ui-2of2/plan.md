<!-- forge-slug: grayscale-relief-ui-2of2 -->
<!-- task: 2 -->
<!-- part: 2/2 -->
<!-- tdd: on -->
# Grayscale relief web UI: upload, parameters, 2D/3D preview, 3MF download (Part 2/2)

## Goal / Non-goals
- Goal: on top of the Part 1 core pipeline, build a single-page web UI where the user uploads an image, adjusts parameters, checks the 2D tone preview and 3D relief, and downloads the Bambu 3MF. Client-only, deployable as a static site.
- Non-goals: per-layer cross-section slider, STL output, other printer profiles, rounded corners/frames, dithering, realistic print-color simulation that accounts for filament translucency (TD), server/storage, deployment automation.

## Source of truth
- Glossary terms: Base, Color change height, White layer, Tone step in .forge/CONTEXT.md
- Related ADRs: .forge/adr/261116-134329-two-filament-thickness-tone-bambu-3mf.md
- Prerequisite: Part 1 (`grayscale-relief-core-1of2`) sealed, with its manual Bambu Studio check passed. If that check failed, re-grill this plan.
- UI parameters: tone steps N (2–10, default 7), white layers per step m (default 1), brightness/contrast/gamma, invert, width (mm), pixel pitch (0.1–0.4, default 0.2), base thickness (default 0.88), layer height (default 0.08), first layer height (default 0.16)
- Preview: 2D shows original | greyscale | N-step tones (linear black→white grey) side by side. 3D is a rotatable three.js relief with the base in black and white layers in white.
- Info shown: color change height, max height, triangle count, model size (mm)
- Definition of Done:
  1. `npm test` → exit 0 (includes the parameter → pipeline wiring and step-color mapping tests)
  2. `npm run build` → exit 0 (static output in dist/)
  3. **Manual/browser UAT**: in `npm run dev`, upload a JPG/PNG → 2D previews show all three images; changing N from 7 to 4 immediately updates the tone preview to 4 steps; the 3D view rotates; the downloaded `.3mf` opens in Bambu Studio with a color change marker at the displayed color change height.
  - Pre-state: before Part 1, package.json does not exist, so items 1–2 fail (forward checks).

## Work slices
- [ ] S1. App layout + image upload (file selection/drag and drop), image decoding into pixel data via a Canvas — completion criterion: test that a decoded fixture image has the expected size and pixels, and upload shows the original preview in the browser
- [ ] S2. Parameter panel (sliders/number inputs/toggle, defaults and ranges as above) and wiring to the core pipeline — completion criterion: test that changing parameters recomputes step indices and heights, with layer-grid snapping applied (depends: S1)
- [ ] S3. 2D tone preview: original | greyscale | N-step tones — completion criterion: test that the step → display grey mapping (k/(N-1)·255) holds, and changing N updates it immediately in the browser (depends: S2)
- [ ] S4. three.js 3D relief preview (Web Worker mesh, base black / white layers white, orbit rotation) — completion criterion: uploading an image shows a rotatable relief in the browser, and the UI does not freeze during generation (depends: S2)
- [ ] S5. Info panel (color change height, max height, triangle count, size) + 3MF download button — completion criterion: DoD 3 manual UAT passes (depends: S3, S4)
