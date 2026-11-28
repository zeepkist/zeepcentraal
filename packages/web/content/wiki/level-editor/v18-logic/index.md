---
title: V18 Logic
description: All about v18 logic.
editPath: wiki/level-editor/v18-logic/index.md
---

V18 Logic can be quite overwhelming. This series of pages aims to introduce each existing blocks. As there is a lot of blocks, they are classified by usage.

An official tutorial by the developer of Zeepkist is available on [YouTube](https://youtu.be/eGk0ySh8wvw)

## How logic in Zeepkist works

Logic works by connecting the logic blocks together and runs on the physic computation thread. To keep the system as simple as possible, the game does not support cyclic connections and works only on integers. These limitations provides challenges when working with coordinates and angles.

::content-info-grid
  ::content-info-card{icon="clock" title="90 Hz" description="Fixed rate of computations. Not affected by framerate."}
  ::
  ::content-info-card{icon="logic-port" title="Port" description="The internal name for the connection points on logic blocks."}
  ::
  ::content-info-card{icon="x" title="10k" description="Mainly used multiplier for output signal in telemetry. Allowing some precision from real numbers."}
  ::
  ::content-info-card{icon="divide" title="10k" description="Mainly used divider for input signal in movers. Allowing some precision from real numbers."}
  ::
  ::content-info-card{icon="angle" title="Degrees" description="Input and output blocks accept angles in degrees, with varying multipliers, 100 or 10k."}
  ::
  ::content-info-card{icon="math-sin" title="Radians" description="Trigonometry operations like sin and cos works with angles in radians, with a 10k multiplier."}
  ::
::

::content-alert{type="notice" title="Real numbers"}
Logic can only use integer for its signal value. However computations and coordinates need more precision or small numbers. Thus there is often a conversion between the value used internally and the value displayed in logic.<br>For example, if you want to put π in a block, you cannot write 1.14159265. You can instead just write, rounded, 11416 and put it as input of a Math logic block with sin operator for example. 
::
::content-alert{type="notice" title="57"}
This is the less precise value to use to convert between radians and degrees, if both have their decimal point on the same position. Use division fro degrees to radians and multiplication the other way.
::


## Rules

::content-info-grid
  ::content-info-card{title="No cycle" description="There can be no cycle in the computation graph."}
  ::
  ::content-info-card{title="Allowed cycle" description="The exception to the previous rule is when a delay block exists in the cycle."}
  ::
  ::content-info-card{title="One input" description="An input port can receive only one signal."}
  ::
  ::content-info-card{title="Output many" description="An output port can send its signal to many."}
  ::
  ::content-info-card{title="Input override" description="When an input override exists for a specific port, meaning the configured value is non-zero, the received signal is not used."}
  ::
  ::content-info-card{title="Setting override" description="Some settings like the math operator can be overrode by a designated input port signal. The override only apply if the value non-zero. It is recommended to comply with the expected value range."}
  ::
  ::content-info-card{title="Underflow & overflow" description="Since our integers are 64 bits, overflow or underflow can happen. Handling is operation dependant. It can be undefined behavior or clamped to limits."}
  ::
  ::content-info-card{title="Player selection" description="Some blocks allow selecting which player is affected. In online lobbies, you are always player 1. Player 2 to 4 only applies to split screen."}
  ::
::

## Browse categories

::content-resource-grid
  ::content-resource-card{to="/wiki/level-editor/v18-logic/signal-generators" icon="wifi" title="Signal generators" description="Simple signal generators and the trigger block."}
  ::
::
