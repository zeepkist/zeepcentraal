import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

test('migration creates private resumable points-history pruning state', () => {
	const migration = readFileSync(
		new URL('../drizzle/0082_low_captain_america.sql', import.meta.url),
		'utf8',
	)

	expect(migration).toContain('CREATE TABLE "zc_private"."points_history_prune_state"')
	expect(migration).toContain('"week_start" timestamp with time zone NOT NULL')
	expect(migration).toContain('"budget_date" date NOT NULL')
	expect(migration).toContain('"deleted_today" integer DEFAULT 0 NOT NULL')
	expect(migration).toContain("IN ('level_points_history', 'user_points_history')")
	expect(migration).not.toContain('GRANT')
})

test('migration snapshots form one linear chain after schema-neutral adventure backfill', () => {
	const snapshots = [80, 81, 82].map(
		(index) =>
			JSON.parse(
				readFileSync(
					new URL(`../drizzle/meta/00${index}_snapshot.json`, import.meta.url),
					'utf8',
				),
			) as { id: string; prevId: string },
	)

	expect(snapshots[1]?.prevId).toBe(snapshots[0]?.id)
	expect(snapshots[2]?.prevId).toBe(snapshots[1]?.id)
	expect(new Set(snapshots.map((snapshot) => snapshot.id)).size).toBe(3)
})
