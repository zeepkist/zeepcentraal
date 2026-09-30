---
title: ZeepCentraal & GTR FAQ
description: When Workshop levels appear and why your PB can seem missing after a level update.
editPath: wiki/zeepcentraal-gtr/faq.md
---

## When does ZeepCentraal discover Workshop levels?

ZeepCentraal checks the Steam Workshop **every Sunday at 01:00 Europe/London time**. It looks for new or updated Workshop items and processes their levels. This can take some time after the check starts.

Levels can also be found **when played online with GTR**. If GTR sees a level that ZeepCentraal does not know yet, it can ask ZeepCentraal to check the Workshop item. Submitting a record can also prompt ZeepCentraal to look up the level's details.

These checks happen in the background. Playing a level online without GTR does not guarantee that ZeepCentraal will find it.

## When does a level become visible?

ZeepCentraal sees and stores **all Workshop items**, regardless of their Steam Workshop visibility setting. Storing a Workshop item does not make its level public.

| Steam Workshop setting | Level downloaded and details stored? | Can players find the level on ZeepCentraal or through its GraphQL API? |
| --- | --- | --- |
| Public | Yes | Yes, once processing finishes |
| Unlisted | Yes | Only after a record is submitted for that version of the level and processing finishes |
| Friends-only | No | No |
| Hidden | No | No |

Public and unlisted levels are downloaded so ZeepCentraal can read and store their level details, also called **metadata**. For friends-only and hidden items, ZeepCentraal stores the Workshop item, but does **not** download the level or store its level metadata.

Only **public levels** and **unlisted levels with a submitted record** are discoverable on the website or through the GraphQL API. Unlisted levels without records stay hidden from both.

::content-alert{type="important" title="Blind tournament levels"}
Upload a new tournament level as **unlisted** to keep it hidden on ZeepCentraal before the tournament. Once players submit times with GTR, that version of the level becomes visible and players can see their PBs and compare times. Allow some time for processing if the level has only just been uploaded.
::

Changing an existing level to unlisted does not hide it if that same version already has submitted records.

## What happened to my PB after a level update?

If your PB seems missing after a creator updates a level, you are usually looking at **a new version's leaderboard**. Your old time is still saved. This does not mean GTR lost your run or ZeepCentraal deleted it.

Each version of a level has its own leaderboard, so everyone on it raced the **same track**. ZeepCentraal tells versions apart using a fingerprint called a **hash**. Only the level's **blocks** are used to make this fingerprint. Changing the blocks changes the fingerprint and creates a new leaderboard.

Changing the **author, collaborators, or medal times** does not change the fingerprint. These edits keep the same level and leaderboard, including everyone's existing PBs.

- Your previous PB stays on the **old version's leaderboard**.
- Times set on the updated level go to the **new version's leaderboard**.
- Your old time is not copied across, because it was set on a different version of the track.

::content-alert{type="important" title="Level updates do not delete records"}
ZeepCentraal keeps player records. Records are only removed in rare exceptional circumstances. A routine level update does not delete your PB, and a fresh leaderboard after a level updates is expected behaviour, not a GTR bug.
::

Steam Workshop now provides the updated level, so the old version may no longer be available to play. Its records stay saved even if that version no longer appears in level searches.

To get a PB on the new leaderboard, set a time on the updated level with GTR. See [Setup Modkist and GTR](/wiki/setup-modkist) for help with submitting times.
