---
title: Light Tricks
description: Directional-light techniques for colour, scale, and volumetric effects.
---

::content-alert{type="important" title="Custom lights can cause lag"}
Custom lights are usually very laggy. Use them only when they are necessary and test performance on less powerful computers.
::

Most of these tricks use the new directional light in folder 803, block 2265. Some use Volumetric Lighting and Bloom.

You can change colour, saturation, and brightness, enable or disable Volumetric Lighting, and scale the light. Scaling different axes produces different results.

## Colour change

Use light to change the colour of any object or particle:

1. Disable Volumetric Lighting on the lights.
2. Point a light at the target.
3. Scale the light when necessary.
4. Add multiple lights to create a smoother colour.

## World light

Scale the light to X1000/Y1/Z1000 and place it high enough to light everything. Disable Volumetric Lighting.

## Hidden fan particles

Make fan particles disappear by using a very thin fan with a very high range. The particles take a long time to reach the end of the effect and reset. Example: fan height at 0.001 and range at 2000.
