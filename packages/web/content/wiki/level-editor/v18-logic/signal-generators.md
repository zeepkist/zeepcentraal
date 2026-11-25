---
title: Signal generators
description: Blocks generating deterministic signals. And the trigger block.
editPath: wiki/level-editor/v18-logic/signal-generators.md
---

Signals generator are blocks which only provides data. It can be a simple value or a set of associated values.
These blocks often have at least one setting to configure what it provides.

## Block 2413 – Trigger Logic Block

This detects how many dynamic objects are into the block volume. Objects can be filtered using "Trigger Filter" property.
Dynamic objects includes:
* physics object – for example, old logic balls;
* zeepkist;
* mover associated object.

These filters are available:
* everything: no filter applied;
* except zeepkist: exclude zeepkists;
* only zeepkist: any zeepkist;
* player *n*: the zeepkist of the specified player.

::content-alert{type="notice" title=""}
Zero is emitted for the first 10 ticks, to prevent bugs.
::

Examples:
* A platform from a mover and a zeepkist gives 2;
* Your zeepkist and a detached wheel also gives 2, as they became separate objects.

:trigger-example

## Block 2414 – Generator Logic Block

The simplest of the set. This generator outputs the value you set in its "Signal Power" property.

## Block 2429 – Ticker Logic Block

Provides the current logic tick on its output.

:ticker-example

## Block 2430 – DateTime Logic Block 🧀

Provides your current date and time components to the level. This is an unfair block since its values depends something
you do not control. You can choose to use UTC time instead of your local time in "Use UTC Time" property.

Output|Range|Component
---|---|---
Output 1|–|Year
Output 2|1-12|Month
Output 3|1-31|Day
Output 4|0-23|Hour
Output 5|0-59|Minute
Output 6|0-59|Second

:date-time-example

## Block 2438 – Player Input Logic Block

Provides a player current controller input. You can select the player to get values from.

Output|Range|Signal
---|---|---
Output 1|0-1|Arms-up state
Output 2|0-1|Break state
Output 3|0-1|Digital left state
Output 4|0-1|Digital right state
Output 5|0-10000|Analog left steering value
Output 6|0-10000|Analog right steering value
Output 7|0-1|Horn state

::content-alert{type="notice" title=""}
Steering values are normalized to fit the range.
::

## Block 2440 – Simple Telemetry Logic Block

Provides telemetry for a selected player zeepkist. To simplify the block design, you have to select a variant in the block properties.

::content-alert{type="notice" title="Global vs Local"}
Global coordinate system refers to the fixed world coordinate system. X, Y and Z values follows its axes. Angles are provided relative to these axes, using the object origin.<br>Local coordinate system refers to the object internal coordinate system. X, Y and Z values follows these axes which result from the current translation and rotation of the object. Angles are also relative to these axes.
::

> TODO: Illustrations, put on the main page?

### Variant 1 – Speed and Heading telemetry

Output|Range|Signal
---|---|---
Output 1|–|Velocity Magnitude (km/h) (x100)
Output 2|0-36000|Global Y-axis Rotation (x100)
Output 3|-100-100|Up Vector Dot Product (x100)
Output 4|0-4|Current Zeepkist State

State values:
* 0 = normal
* 1 = soap
* 2 = off-road
* 3 = paraglider
* 4 = bulldozer

> TODO: Illustration

### Variant 2 – Drift angle and Local velocity

Output|Range|Signal
---|---|---
Output 1|0-36000|Drift Angle (x100)
Output 2|–|Local Velocity X (km/h) (x100)
Output 3|–|Local Velocity Y (km/h) (x100)
Output 4|–|Local Velocity Z (km/h) (x100)

> TODO: Illustration

### Variant 3 – Global velocity and Compass

Output|Range|Signal
---|---|---
Output 1|–|Global Velocity X (km/h) (x100)
Output 2|–|Global Velocity Y (km/h) (x100)
Output 3|–|Global Velocity Z (km/h) (x100)
Output 4|0-36000|Global Velocity Compass Direction (x100)

> TODO: Illustration

### Variant 4 – Euler angles

This represents the direction the zeepkist is facing using angles.

Output|Range|Signal
---|---|---
Output 1|0-36000|Euler Angle X (x100)
Output 2|0-36000|Euler Angle Y (x100)
Output 3|0-36000|Euler Angle Z (x100)

> TODO: Illustration

### Variant 5 – Lookat vector

This represents the direction the zeepkist is facing using a normalized vector. Can be multiplied by a factor to
always show an object in front of the zeepkist after the required translations.

Output|Range|Signal
---|---|---
Output 1|0-10000|Forward Lookat X (x10000)
Output 2|0-10000|Forward Lookat Y (x10000)
Output 3|0-10000|Forward Lookat Z (x10000)

> TODO: Illustration

## Block 2441 – Wheel Telemetry Logic Block (Advanced)

Provides telemetry for each wheels of a selected player zeepkist. To simplify the block design, you have to select a variant in the block properties.

Output|Wheel
---|---
Output 1|All wheels combined
Output 2|Any wheel combined
Output 3|Front left wheel
Output 4|Front right wheel
Output 5|Back left wheel
Output 6|Back right wheel

Variant|What
---|---
Variant 1|Wheel state. 0=airborne, 1=grounded, 2=dead (destroyed or missing). All is 1 if all wheel grounded, otherwise 0. Any is 1 if no wheel is airborne.
Variant 2|Wheel slipping. Simple booleans.
Variant 3|Wheel material ID. The material ID the wheel is touching. -1 is the corresponding wheel is not grounded. All and Any are unused, thus 0.
Variant 4|Wheel physics material ID. The physics material ID the wheel is touching. -1 is the corresponding wheel is not grounded. All and Any are unused, thus 0.

ID|Physic material
---|---
0|Tarmac
1|Grass
2|Sand
3|Mud
4|Soap
5|Wood
6|Ice 0.05
7|Ice 0.10
8|Ice 0.15

## Block 2442 – Distance Sensor Logic Block (Advanced)

Sense the distance between the selected player zeepkist and the block gizmo. The reference axes can be set to use global coordinate instead of local in "Distance Coordinate System" property. Raw values are multiplied by 10k.

Output|Signal
---|---
Output 1|Direct distance
Output 2|Axis X distance
Output 3|Axis Y distance
Output 4|Axis Z distance

> TODO: 2D interactive illustration
