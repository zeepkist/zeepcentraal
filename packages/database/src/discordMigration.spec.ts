import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

const migration = Bun.file(join(import.meta.dir, '../drizzle/0072_loving_norrin_radd.sql'))
const deliveryMigration = Bun.file(join(import.meta.dir, '../drizzle/0073_lean_jimmy_woo.sql'))
const manyToManyMigration = Bun.file(
	join(import.meta.dir, '../drizzle/0074_disable_discord_activity_many_to_many.sql'),
)
const reverseRelationMigration = Bun.file(
	join(import.meta.dir, '../drizzle/0075_name_discord_activity_reverse_relations.sql'),
)

describe('Discord database migrations', () => {
	test('exposes only public activity through GraphQL', async () => {
		const sql = await migration.text()
		expect(sql).toContain('ALTER TABLE "discord_activity_event" ENABLE ROW LEVEL SECURITY')
		expect(sql).toContain('graphql_select_visible_discord_activity_event')
		expect(sql).toContain('GRANT SELECT ON TABLE public.discord_activity_event')
		expect(sql).not.toContain('GRANT SELECT ON TABLE "zc_private"')
	})

	test('captures workshop, PB, WR, vote, and live invalidation events', async () => {
		const sql = await migration.text()
		for (const trigger of [
			'trg__discord_workshop_event',
			'trg__discord_personal_best_event',
			'trg__discord_world_record_event',
			'trg__discord_vote_event',
			'trg__live_query_invalidate',
		]) {
			expect(sql).toContain(trigger)
		}
	})

	test('adds durable global watch cursor and per-watch delivery key', async () => {
		const sql = await deliveryMigration.text()
		expect(sql).toContain('"discord_worker_state"')
		expect(sql).toContain('"last_delivery_key"')
	})

	test('prevents event log foreign keys from becoming many-to-many GraphQL edges', async () => {
		const sql = await manyToManyMigration.text()
		expect(sql).toContain(
			"COMMENT ON TABLE public.discord_activity_event IS E'@behavior -manyToMany'",
		)
	})

	test('gives parallel event relations distinct reverse GraphQL names', async () => {
		const sql = await reverseRelationMigration.text()
		expect(sql).toContain('@foreignFieldName discordActivityEvents')
		expect(sql).toContain('@foreignFieldName discordActivityEventsAsPreviousUser')
		expect(sql).toContain('@foreignFieldName discordActivityEventsAsPreviousRecord')
	})
})
