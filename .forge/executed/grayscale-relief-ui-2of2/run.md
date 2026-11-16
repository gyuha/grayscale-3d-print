# run — grayscale-relief-ui-2of2

Run mode: implemented directly in the main session (S1 → S2 → {S3, S4} → S5 is mostly serial and the UI shares a single App.tsx, so no workflow). TDD: `src/ui/model.test.ts` was written first and seen failing (Cannot find module), then implemented.

## Per-slice results
- S1 layout + upload (file picker/drag and drop) + Canvas decoding — ⚠ jsdom has no canvas, so decoding was verified by driving the real browser (agent-browser), not a unit test: uploading a 600×800 photo shows the original and greyscale/tone canvases at 250×333
- S2 parameter panel + pipeline wiring — ✅ as planned (N 7→4 changes step indices, snapped base flows into heights: tests pass)
- S3 2D tone preview — ✅ as planned (toneGray tests; in the browser, the tone canvas's distinct grey values went from 7 [0,43,85,128,170,213,255] → 4 [0,85,170,255] when N changed 7→4)
- S4 three.js relief (worker mesh, black below / white above the color change height, OrbitControls) — ✅ as planned (rotation confirmed by drag, in screenshots)
- S5 info panel + 3MF download — ✅ as planned (shows color change 0.88 / slicer marker 0.96 / max height / size / triangles; download test-photo-4steps.3mf 1.39MB, 8-entry package, export 331ms)

## Plan vs actual
- Added `gray` to `processImage`'s return value (for the greyscale preview, a one-line change to Part 1 code).
- The info panel also shows the slicer marker height (0.96) next to the color change height — matching Part 1's top_z = base+1 layer behavior.
- The 3D view shows only two colors, black/white (as the plan says), so tone steps among the white layers are told apart only by relief shading. Realistic color simulation is a Non-goal.
- Mesh generation runs in a new Worker after a 250ms debounce (the previous worker is terminated). The 3MF export runs on the main thread on click (331ms for 167k triangles).
- Main bundle is 835kB (three.js) → Vite's chunk size warning. Not addressed.
- Added `vite/client` and `resolveJsonModule` to tsconfig.

## DoD baseline → after
1. `npm test`: 34 passed (regression guard — already passing since Part 1 finished) → 43 passed
2. `npm run build`: passing (same) → passing, dist/ includes a separate mesh.worker chunk
3. Browser UAT: none → driven via agent-browser: upload ✓, N 7→4 instant update ✓, 3D rotation ✓, download ✓. User confirmed it works.

## Additions requested mid-run (outside the plan)
- User request: allow connections from other hosts → restarted the dev server with `--host 0.0.0.0` (Network: http://192.168.0.81:5179/)
- User request: added `Taskfile.yml` (install/dev/test/build/preview/sample; dev and preview bind to 0.0.0.0). `task test` → 43 passed
