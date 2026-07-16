---
title: Pre-V18 Logic Blocks
description: Legacy Zeepkist triggers, logic gates, truth tables, and effect gates.
editPath: wiki/level-editor/pre-v18-logic-blocks.md
---

Pre-V18 logic blocks can be triggered by any physics block, including the player, balls, haybales, and rotating signs. Fans do not work as triggers.

## Ball Dropper

The Ball Dropper drops a ball when the player or another physics block enters its trigger box. It cannot trigger again for 0.5s after activation.

## Single Input Logic Gates

Single Input Logic Gates have 1 Input and 1 Output with 6 logic behaviours:

- **Buffer:** Makes the Output disappear when you enter and remain in the trigger box. It can trigger again for the same effect.
- **Inverted:** Makes the Output appear when you enter and remain in the trigger box. It can trigger again for the same effect.
- **Flip Flop:** Makes the Output disappear when you enter the trigger box. Trigger it again for the opposite effect.
- **Flip Flop Inverted:** Makes the Output appear when you enter the trigger box. Trigger it again for the opposite effect.
- **Single Use:** Makes the Output disappear when you enter the trigger box. It cannot trigger again.
- **Single Use Inverted:** Makes the Output appear when you enter the trigger box. It cannot trigger again.

## Double Input Logic Gates

Double Input Logic Gates have 2 Inputs and 1 Output with 6 logic behaviours.

For Input, 0 means nothing is in the trigger box and 1 means something is in it. For Output, 0 means the block is visible and 1 means it is not visible.

| A | B | AND | NAND | OR | NOR | XOR | XNOR |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 |
| 0 | 1 | 0 | 1 | 1 | 0 | 1 | 0 |
| 1 | 0 | 0 | 1 | 1 | 0 | 1 | 0 |
| 1 | 1 | 1 | 0 | 1 | 0 | 0 | 1 |

## Logic Gates with Effect Gates

These work like single or double input gates, but use gates with effects instead of ordinary blocks. Examples include Glider, Soap, and Kill gates.

::content-alert{type="reminder" title="Legacy behaviour"}
This page documents Pre-V18 logic blocks. Confirm behaviour in the current editor before relying on it in a published level.
::
