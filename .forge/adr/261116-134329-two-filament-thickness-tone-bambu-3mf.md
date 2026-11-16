---
author: gyuha
decided: 2026-11-16 13:43
---
# Represent tone with 2 filaments (black base + white top) by white thickness, and output a Bambu A1 3MF

Following the reference model (`fourth+wing+ams.3mf`: A1, 0.08mm layers, a single switch to white at Z=0.88), grey tones come only from the number of white layers stacked over the black base. Brightness is split into N even tone steps (step k = k×m white layers). The output is a Bambu 3MF with `Metadata/custom_gcode_per_layer.xml` embedding the color change, pinned to A1 0.4 / 0.08mm / first layer 0.16mm defaults.

## Considered Options
- One grey filament per tone step, swapped N-1 times — needs N filaments and many swaps; rejected.
- STL + manual color change — works in every slicer, but the user must enter the change height by hand; the user chose the 3MF.

## Consequences
- Whether Bambu Studio honors the color change in a hand-built 3MF is unverified. The first part's sample 3MF must be checked by hand; if it fails, revisit this decision (consider STL output).
- Every height must snap to the layer grid (first layer + n×layer height), or the color change shifts by one layer.
