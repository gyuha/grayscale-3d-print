# Grayscale 3D Print

Converts a grayscale image into a relief model that represents brightness with black and white filament stacked layer by layer.

## Language

**Base**:
The bottom part, printed in black filament, from the bed up to the color change height. Where it is exposed it represents the darkest tone.
_Avoid_: black layer, floor

**Color change height**:
The single Z height where the filament switches from black to white.
_Avoid_: swap point, filament change

**White layer**:
A layer of white filament stacked above the color change height. The more there are, the more the black is hidden and the lighter it looks.
_Avoid_: top layer, cover layer

**Tone step**:
One of the N discrete levels the image brightness is split into. Each tone step is defined by its number of white layers (0…N-1).
_Avoid_: level, layer (a slicer layer is a separate concept), brightness band
