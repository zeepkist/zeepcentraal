---
title: Points and Ranked Points
description: How your personal bests earn points and affect your place in the player rankings.
editPath: wiki/zeepcentraal-gtr/points-and-ranked-points.md
---

Your **personal best (PB)** is your fastest submitted time on a level. Every level has a [Level Points score](/wiki/zeepcentraal-gtr/level-points). Your place on its leaderboard decides how many of those points you earn.

## Points from one level

First place earns all of the level's points. Each place after that earns **1.5% less than the place before it**. Players with the same time share the same place.

The formula is:

`Level Points × 0.985^(level position − 1)`

| Level position | Share of Level Points | Example on a 1,000-point level |
| --- | ---: | ---: |
| 1st | 100% | 1,000 |
| 2nd | 98.5% | 985 |
| 3rd | 97.0225% | 970.225 |
| 10th | 87.2823% | 872.823 |
| 50th | 47.6843% | 476.843 |
| 100th | 22.3968% | 223.968 |
| 200th | 4.9409% | 49.409 |
| 500th | 0.0530% | 0.530 |

Table values are rounded for readability.

A faster PB can move you up the leaderboard and earn you more points. If someone beats your time, you can move down and earn fewer points. Your points also change when the level's own score changes.

## Ranked Points

**Ranked Points** decide your place in the global player rankings. ZeepCentraal sorts your PBs by how many Points they earn, from highest to lowest. It then counts a smaller share of each PB's points:

| PB in your points list | Share counted toward Ranked Points | Example for a PB earning 1,000 Points |
| --- | ---: | ---: |
| Highest points | 100% | 1,000 |
| Second highest | 95% | 950 |
| Third highest | 90.25% | 902.5 |
| 10th highest | 63.0249% | 630.249 |
| 50th highest | 8.0995% | 80.995 |
| 100th highest | 0.6232% | 6.232 |
| 200th highest | 0.0037% | 0.037 |
| 500th highest | Almost 0% | Almost 0 |

Each share is **5% smaller than the one before it**. All of your PBs that earn points are included, but those further down your list have less effect on your global rank.

`Ranked Points from a PB = Points from that PB × 0.95^(place in your points list − 1)`

| Value on your profile | What it means |
| --- | --- |
| Total Points | All of the Points earned by your PBs added together |
| Ranked Points | Your PB points added together after applying the shares above; used for your global rank |

For example, you finish first on one 1,000-point level and second on another. You earn 1,000 and 985 Points, giving **1,985 Total Points**. If these are your two highest-scoring PBs, your Ranked Points are `1,000 + (985 × 0.95) = 1,935.75`, shown as **1,936**.

Totals are rounded after adding everything together. Rounded values shown for individual PBs may not add up exactly to the displayed total.

## When do points update?

| Update | When it happens |
| --- | --- |
| After a new or improved PB | ZeepCentraal starts a background update for that level |
| Levels with recent runs | Checked every 30 minutes, on the hour and half past |
| All levels | Recalculated every Monday at 01:00 Europe/London time |
| Player totals and global ranks | Recalculated every 10 minutes, at 05, 15, 25, 35, 45, and 55 minutes past the hour |

Updates run in the background, so your new time and your updated point totals may appear at different times. Updates can take longer when the site is busy.

If your PB seems to have disappeared after a level update, see the [FAQ](/wiki/zeepcentraal-gtr/faq#what-happened-to-my-pb-after-a-level-update).
