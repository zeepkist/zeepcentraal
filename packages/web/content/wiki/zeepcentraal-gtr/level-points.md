---
title: Level Points
description: How finish times, player results, and votes affect a level's points.
editPath: wiki/zeepcentraal-gtr/level-points.md
---

**Level Points** are the points available for first place on a level. Other players earn a smaller share based on their [place on its leaderboard](/wiki/zeepcentraal-gtr/points-and-ranked-points).

ZeepCentraal uses players' personal bests (PBs), information from their runs, and their votes to calculate this score. A level with no valid PB has **0 Level Points**.

## Calculation

The score starts with a maximum of **9,984 points**. Four parts of the calculation decide how much of that maximum the level receives:

| Part | What ZeepCentraal looks at | How it affects points |
| --- | --- | --- |
| Length | The middle finish time among the fastest ten PBs used in the calculation | Levels lasting 20–180 seconds get the full length allowance. Shorter levels get less; very long levels gradually fall to 75% |
| Number of PBs | How many players have set a PB | Starts at 10%. Grows above three PBs and reaches 100% at 16 PBs |
| Challenge | How much control the fastest runs need, and whether stronger racers tend to get better results | Uses steering, braking, other player inputs, and differences between players' results. With little information, the calculation stays closer to a middle score |
| Votes | Player ratings that are at least seven days old | Starts at 80%. Positive votes can raise it; negative votes can lower it |

The challenge calculation gives 55% of its weight to the control needed during runs and 45% to how results relate to player skill.

Each part acts as a multiplier. For example, an 80% allowance multiplies the score by `0.80`:

`Level Points = 9,984 × length factor × PB factor × challenge factor × vote factor`

The result is rounded **up** to an even number. A level with a valid PB receives at least 2 points, and the maximum is 9,984.

A world record that is unusually far ahead of other times can be left out of this calculation. This does **not** delete the record. More PBs alone do not always mean more points, because all four parts affect the result.

Open a [level page](/levels) to see its score breakdown and how its points have changed.

## How voting affects points

Players can rate a level from **−2 to +2**. Positive votes raise its rating; negative votes lower it. Negative votes have **half the strength** of positive votes of the same size. Each player gets one vote per level, and changing it replaces their previous vote.

Votes must be at least **seven days old** before they affect points. Changing your vote restarts this wait. Your vote can appear on the level page during the wait, even though it does not affect points yet.

Until at least **five votes** have passed this wait, the vote factor stays at its starting value of `0.80`. After that, ZeepCentraal averages the votes to work out the vote factor. Positive ratings can raise it as high as `1.00`, giving up to **25% more points** than the starting value, before rounding.

::content-alert{type="notice" title="Vote timing"}
Voting does not update the score straight away. Once the seven-day wait ends, your vote counts the next time the level's points are calculated. This can happen after a new PB or during the weekly update of all levels.
::

See [Points and Ranked Points](/wiki/zeepcentraal-gtr/points-and-ranked-points#when-do-points-update) for the update schedule. If all Workshop copies of a level are removed or cannot be downloaded, it receives zero points. The [FAQ](/wiki/zeepcentraal-gtr/faq) explains Workshop visibility.
