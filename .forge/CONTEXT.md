# Grayscale 3D Print

Converts an image into a relief model with 1 to 4 filaments. In layer mode brightness is shown by black and white layers; in color region mode each place is printed in the closest chosen color.

## Language

**Base**:
In layer mode, the bottom part, printed in black filament, from the bed up to the color change height. Where it is exposed it represents the darkest tone.
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

## Color region mode

An alternative to layer mode for images with colors: each place of the image is printed in the chosen filament color closest to it, and tone steps set the height as in layer mode. Used with 3 or more filaments; 1 or 2 filaments use layer mode.

**Color region mode**:
The mode that paints the image with 1 to 4 chosen filament colors side by side, one separate part per color.
_Avoid_: multi-color mode, color group mode

**Palette**:
The filament colors the user chose, one per AMS slot.
_Avoid_: color set, swatch set

**Color region**:
The cells whose color is closest to one palette color. It is printed as one part with that color's filament.
_Avoid_: color group, color zone
