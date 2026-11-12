---
title: Medals
description: How to earn Bronze, Silver, Gold, Author, Expert and Apex medals on ZeepCentraal.
editPath: wiki/zeepcentraal-gtr/medals.md
---

Medals show how your **personal best (PB)** compares with a level's target times. Finish at or below a target time to earn that medal. **A shorter time is harder to beat.**

Your PB shows only the highest medal it earns. An Apex PB counts as one Apex medal, rather than one of every medal. A time slower than Bronze earns no medal.

## The six medals

| Medal | How to earn it |
| --- | --- |
| ![Bronze medal](/assets/medals/MED_Bronze.png){width="48" height="48"} **Bronze** | Match or beat the Bronze Time. This is the first medal target. |
| ![Silver medal](/assets/medals/MED_Silver.png){width="48" height="48"} **Silver** | Match or beat the Silver Time, a harder target than Bronze. |
| ![Gold medal](/assets/medals/MED_Gold.png){width="48" height="48"} **Gold** | Match or beat the Gold Time, a harder target than Silver. |
| ![Author medal](/assets/medals/MED_Author.png){width="48" height="48"} **Author** | Match or beat the author's fastest time from validating the level. |
| ![Expert medal](/assets/medals/MED_Expert.png){width="48" height="48"} **Expert** | Match or beat ZeepCentraal's calculated Expert Time. This is faster than Author Time. |
| ![Apex medal](/assets/medals/MED_Apex.png){width="48" height="48"} **Apex** | Match or beat ZeepCentraal's calculated Apex Time. This is the hardest medal target. |

## Bronze, Silver, Gold and Author Times

These four targets come from the Adventure level or community Workshop level.

**Author Time (AT)** is the fastest time the level author set when validating their level. The game automatically sets Gold, Silver and Bronze Times based on AT. The author can also set those three times themselves.

You do not need a particular leaderboard position to earn a medal. Your finish time decides which medal you earn.

## Expert and Apex Times

Expert and Apex are exclusive to ZeepCentraal. They use players' times to create two targets faster than AT.

A level needs **at least 10 different players with valid PBs strictly faster than AT**. A PB equal to AT does not count. Each player contributes only one PB.

Once the level meets this requirement, a **seven-day settling period** begins. At the end of that period, ZeepCentraal uses the latest **10 fastest qualifying PBs** to calculate both targets. More than 10 players can qualify, but only the fastest 10 times enter the formulas.

### Expert formula

First, add the 10 times together and divide by 10. This gives their average, called the **Expert reference**.

Then move 45% of the way from that reference towards AT:

```text
Expert reference = sum of the fastest 10 qualifying PBs ÷ 10
Expert Time = Expert reference + 0.45 × (AT − Expert reference)
```

This leaves some room behind the fastest players while keeping the target faster than AT.

### Apex formula

Apex uses the same 10 PBs, but gives more weight to the fastest times. Multiply each time by its share from the table below, then add the results. This gives the **Apex reference**.

Then move only **5%** of the way from that reference towards AT:

```text
Apex reference = sum of each PB × its share
Apex Time = Apex reference + 0.05 × (AT − Apex reference)
```

The fastest four PBs contribute 68% of the Apex reference. This keeps Apex closer to the best times and makes it harder than Expert.

## Worked example

Suppose AT is **40.000 seconds** and these are the 10 fastest qualifying PBs. Each time belongs to a different player.

| PB rank | Time | Share used for Apex |
| --- | ---: | ---: |
| 1st | 35.200s | 20% |
| 2nd | 35.800s | 18% |
| 3rd | 36.100s | 16% |
| 4th | 36.400s | 14% |
| 5th | 36.700s | 10% |
| 6th | 36.900s | 8% |
| 7th | 37.200s | 5% |
| 8th | 37.500s | 4% |
| 9th | 38.000s | 3% |
| 10th | 38.400s | 2% |

The Expert reference is **36.820s**. The Apex reference is **36.246s**.

```text
Expert = 36.820 + 0.45 × (40.000 − 36.820)
       = 38.251s

Apex   = 36.246 + 0.05 × (40.000 − 36.246)
       = 36.4337s
       = 36.433s after rounding down to milliseconds
```

Both targets are rounded **down** to the nearest millisecond.

| Your PB | Highest medal earned |
| ---: | --- |
| 39.000s | Author |
| 38.251s | Expert |
| 37.000s | Expert |
| 36.433s | Apex |

You can earn Apex without holding the world record. In this example, the fastest PB is still **35.200s**.

## Do the targets change?

Once generated, **Expert and Apex Times stay fixed**. More players beating AT, or faster PBs arriving later, do not make those targets harder.

If a level updates its Author Time, Expert and Apex may be recalculated.

Some levels do not have Expert or Apex targets yet. They may still need 10 qualifying players or be in the settling period. If rounding would make the targets equal or put Apex faster than the fastest qualifying PB, neither target is generated.

Player profiles show medal distributions. Leaderboards show the highest medal earned by each time.
