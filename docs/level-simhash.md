# Level similarity

`level.simhash` stores frequency-weighted 64-bit SimHash of block IDs from
`level_metadata.blocks`. CSV uses `Id`; JSON uses `i`. Every block counts, including
present blocks. Position, rotation, scale, paints, options, and order have no effect.
Same ID proportions produce identical fingerprints. SimHash describes block
composition, not track layout or proof of copying. `xx_hash` remains exact identity.

Version 1 hashes each distinct non-negative integer ID with XXH3-64, seed zero,
over little-endian i64 bytes. Frequency weights signed bit votes. Positive votes
set bits; ties clear bits. PostgreSQL signed bigint preserves all 64 bits.
Empty or invalid blocks leave SimHash null. Populated fingerprints remain unchanged.

## Backfill

Apply `20261003010000_level_simhash` before deploying updated server/jobs.
Set `BACKEND_URL` and `TRIGGER_JOB_TOKEN`, then run existing script:

```sh
bun jobs:trigger
```

Choose Local or Production, then Workshop · Backfill level SimHash. Review
`{ "Task": "backfillLevelSimhash", "Options": {} }` before sending.
Local requests require confirmation. Production requests require typing exact task
name. Existing job menu and option prompts remain available.

Task reads only stored blocks. No Steam or storage calls. It processes missing
fingerprints in ID pages of 100, loads one metadata array at a time, and skips
missing/empty/invalid metadata. Logs report processed, updated, skipped, and cursor.
Concurrent runs share queue group. Writes verify metadata version under locks and
never overwrite populated fingerprints. DB failures retry up to three attempts;
reruns reuse completed fingerprints. Normal workshop scans still download updates.

## Query

`public.similar_levels(xx_hash text, max_distance integer DEFAULT 16)` returns
public `level` rows ordered by Hamming distance, then ID. Source must be public.
Source row and missing fingerprints are excluded. Cutoff is inclusive, `0..64`.
Missing source, null arguments, and invalid cutoffs return no rows.

GraphQL exposes `similarLevels(xxHash, maxDistance)` with Level connection
pagination using `first`/`after`. PostGraphile natural-order routines do not reliably
support `last`/`before`; use forward pagination to preserve distance order.
`simhash` uses BigInt scalar. Fingerprint is not a similarity percentage.
Partial covering index scans public fingerprints; query never reads block arrays.
Search remains linear in indexed fingerprint count.

```graphql
query SimilarLevels($xxHash: String!) {
  similarLevels(xxHash: $xxHash, maxDistance: 16, first: 20) {
    nodes { id xxHash }
  }
}
```

## Validation

Create empty disposable local PostgreSQL DB named `simhash_test`. Set
`ZC_TEST_DATABASE_URL` to that DB. Integration test creates fixtures, exercises
migration up/down/up, concurrent backfill, metadata races, visibility and distance,
and measures a 100,001-row fingerprint scan. It leaves fixtures for GraphQL checks:

```sh
cargo test --locked -j 2 -p zc-database --test level_simhash -- --ignored --nocapture
bun packages/postgraphile/scripts/verifyLevelSimhash.ts
```

Run GraphQL checks outside Bun unit-test preload. Schema lock and generated types
include `simhash` and `similarLevels`; full schema comparison requires migrated DB.
