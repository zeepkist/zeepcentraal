import { readFile } from 'node:fs/promises'
import type { SQL } from 'bun'

// Only callers guarded to the dedicated loopback fixture database may use these.
const migration = new URL(
	'../../../crates/database/migrations/20261019000800_retire_history_index/',
	import.meta.url,
)

export async function restoreHistoryPreparation(sql: SQL): Promise<boolean> {
	const retired = (
		await sql`select to_regclass('zc_private.history_fact_rollout') is null as value`
	)[0].value
	if (retired) {
		const down = await readFile(new URL('down.sql', migration), 'utf8')
		await sql.begin((tx) => tx.unsafe(down))
	}
	return retired
}

export async function retireHistoryFixture(sql: SQL) {
	while (Number((await sql`select zc_private.backfill_history_fact(1000) as n`)[0].n)) {}
	while (Number((await sql`select zc_private.verify_history_fact(1000) as n`)[0].n)) {}
	const up = await readFile(new URL('up.sql', migration), 'utf8')
	await sql.begin((tx) => tx.unsafe(up))
}
