import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { getTableConfig, getViewConfig, PgDialect } from 'drizzle-orm/pg-core'
import { recordHistoryEntry, recordHistoryIndex } from './schema'

const migration = readFileSync(
	new URL('../drizzle/0059_lethal_lila_cheney.sql', import.meta.url),
	'utf8',
)
const scorePerformanceMigration = readFileSync(
	new URL('../drizzle/0062_abnormal_charles_xavier.sql', import.meta.url),
	'utf8',
)
const contributionPerformanceMigration = readFileSync(
	new URL('../drizzle/0063_set_based_contribution_projection.sql', import.meta.url),
	'utf8',
)
const submitPerformanceMigration = readFileSync(
	new URL('../drizzle/0067_record_history_submit_projection.sql', import.meta.url),
	'utf8',
)

describe('record history read model', () => {
	test('uses one indexed projection source before mutable display joins', () => {
		const config = getViewConfig(recordHistoryEntry)
		const query = new PgDialect().sqlToQuery(config.query).sql

		expect(config.with).toEqual({ securityInvoker: true })
		expect(query).toContain('FROM zc_private.record_history_index AS history_entry')
		expect(query).toContain('record_user.steam_name AS user_name')
		expect(query).toContain('record_level.xx_hash AS level_xx_hash')
		expect(query).not.toContain('UNION ALL')
		expect(query).not.toContain('personal_best_global')
		expect(query).not.toContain('world_record_global')
		expect(query).not.toContain('user_point_contribution')
		expect(query).not.toContain('EXISTS (')
	})

	test('indexes every web history and sort combination', () => {
		const indexes = getTableConfig(recordHistoryIndex).indexes
		const indexByName = (name: string) => {
			const index = indexes.find((candidate) => candidate.config.name === name)
			expect(index).toBeDefined()
			return index
		}
		const columnNames = (name: string) => {
			const index = indexByName(name)
			return index?.config.columns.map((column) => ('name' in column ? column.name : null))
		}

		expect(columnNames('IX_record_history_index_latest')).toEqual([
			'history_view',
			'date_created',
			'id',
		])
		expect(columnNames('IX_record_history_index_user_latest')).toEqual([
			'history_view',
			'user_id',
			'date_created',
			'id',
		])
		expect(columnNames('IX_record_history_index_player_value')).toEqual([
			'history_view',
			'has_contribution',
			'player_decayed_points',
			'date_created',
			'id',
		])
		expect(columnNames('IX_record_history_index_user_player_value')).toEqual([
			'history_view',
			'user_id',
			'has_contribution',
			'player_decayed_points',
			'date_created',
			'id',
		])
		expect(columnNames('IX_record_history_index_level_value')).toEqual([
			'history_view',
			'has_contribution',
			'level_points',
			'date_created',
			'id',
		])
		expect(columnNames('IX_record_history_index_user_level_value')).toEqual([
			'history_view',
			'user_id',
			'has_contribution',
			'level_points',
			'date_created',
			'id',
		])
		expect(columnNames('IX_record_history_index_level_projection')).toEqual(['level_id'])
		expect(columnNames('IX_record_history_index_record')).toEqual(['id'])

		for (const index of indexes) {
			if (index.config.name === 'IX_record_history_index_record') continue
			for (const column of index.config.columns) {
				if (
					!('name' in column) ||
					typeof column.name !== 'string' ||
					!['date_created', 'id'].includes(column.name)
				)
					continue
				expect(column.indexConfig).toMatchObject({ order: 'desc', nulls: 'first' })
			}
		}
	})

	test('synchronizes contribution projection changes as transition-table sets', () => {
		expect(contributionPerformanceMigration).toContain(
			'CREATE INDEX IF NOT EXISTS "IX_record_history_index_record"',
		)
		expect(contributionPerformanceMigration).toContain(
			'CREATE OR REPLACE FUNCTION zc_private.sync_record_history_contributions',
		)
		expect(contributionPerformanceMigration).toContain('FROM unnest(p_record_ids)')
		expect(contributionPerformanceMigration).toContain('UPDATE zc_private.record_history_index')
		expect(contributionPerformanceMigration).toContain('IS DISTINCT FROM ROW(')
		expect(contributionPerformanceMigration).toContain('FROM new_contributions')
		expect(contributionPerformanceMigration).toContain('FROM old_contributions')

		for (const triggerFunction of [
			'tg_sync_record_history_contribution_insert',
			'tg_sync_record_history_contribution_delete',
			'tg_sync_record_history_contribution_update',
		]) {
			const functionStart = contributionPerformanceMigration.indexOf(
				`CREATE OR REPLACE FUNCTION zc_private.${triggerFunction}`,
			)
			const functionEnd = contributionPerformanceMigration.indexOf(
				'--> statement-breakpoint',
				functionStart,
			)
			const functionBody = contributionPerformanceMigration.slice(functionStart, functionEnd)
			expect(functionBody).toContain('sync_record_history_contributions')
			expect(functionBody).not.toContain('LOOP')
			expect(functionBody).not.toContain('sync_record_history(record_id)')
		}
	})

	test('indexes and skips unchanged level-point projection writes', () => {
		expect(scorePerformanceMigration).toContain(
			'CREATE INDEX IF NOT EXISTS "IX_record_history_index_level_projection"',
		)
		expect(scorePerformanceMigration).toContain('OLD.points IS NOT DISTINCT FROM NEW.points')
		expect(scorePerformanceMigration).toContain('level_points IS DISTINCT FROM NEW.points')
		expect(scorePerformanceMigration).toContain('has_contribution = false')
		expect(scorePerformanceMigration).toContain('(is_personal_best OR is_world_record)')
	})

	test('uses direct record inserts and set-based relation refreshes', () => {
		expect(submitPerformanceMigration).toContain(
			'CREATE OR REPLACE FUNCTION zc_private.sync_record_history_records',
		)
		expect(submitPerformanceMigration).toContain('FROM unnest(p_record_ids)')
		expect(submitPerformanceMigration).toContain('FROM new_records AS new_record')
		expect(submitPerformanceMigration).toContain('REFERENCING NEW TABLE AS new_relations')
		expect(submitPerformanceMigration).toContain('REFERENCING OLD TABLE AS old_relations')
		expect(submitPerformanceMigration).not.toContain('FOR EACH ROW')
		expect(submitPerformanceMigration).not.toContain('LOOP')
	})

	test('exposes only publicly visible active level metadata', () => {
		const query = new PgDialect().sqlToQuery(getViewConfig(recordHistoryEntry).query).sql

		expect(query).toContain('candidate_level_item.publicly_visible = true')
		expect(query).toContain('candidate_level_item.deleted = false')
		expect(query).toContain(
			'ORDER BY candidate_level_item.updated_at DESC, candidate_level_item.id DESC',
		)
	})

	test('backfills before indexing and installs synchronous maintenance before cutover', () => {
		const sourceLock = migration.indexOf('LOCK TABLE')
		const backfill = migration.indexOf('INSERT INTO zc_private.record_history_index')
		const indexes = migration.indexOf('CREATE INDEX "IX_record_history_index_latest"')
		const helper = migration.indexOf(
			'CREATE OR REPLACE FUNCTION zc_private.sync_record_history',
		)
		const analyze = migration.indexOf('ANALYZE zc_private.record_history_index')
		const cutover = migration.indexOf('DROP VIEW "public"."record_history_entry"')

		expect(sourceLock).toBeGreaterThan(0)
		expect(backfill).toBeGreaterThan(sourceLock)
		expect(indexes).toBeGreaterThan(backfill)
		expect(helper).toBeGreaterThan(indexes)
		expect(analyze).toBeGreaterThan(helper)
		expect(cutover).toBeGreaterThan(analyze)
		expect(migration.match(/INSERT INTO zc_private\.record_history_index/g)).toHaveLength(4)
		expect(migration).toContain('REFERENCING NEW TABLE AS new_contributions')
		expect(migration).toContain('REFERENCING OLD TABLE AS old_contributions')
		expect(migration).toContain('ORDER BY id_record')
		expect(migration).toContain('AFTER INSERT OR UPDATE OR DELETE ON public.record')
		expect(migration).toContain('AFTER INSERT OR UPDATE OR DELETE ON public.level_points')
	})

	test('grants restricted role read-only projection access and declares cursor identity', () => {
		expect(migration).toContain('WITH (security_invoker = true)')
		expect(migration).toContain('@primaryKey history_view,id')
		expect(migration).toContain('@behavior -insert -update -delete')
		expect(migration).toContain(
			'REVOKE ALL ON TABLE zc_private.record_history_index FROM PUBLIC',
		)
		expect(migration).toContain(
			'GRANT SELECT ON TABLE zc_private.record_history_index TO zeepcentraal_graphql',
		)
		expect(migration).toContain('REVOKE ALL ON TABLE public.record_history_entry FROM PUBLIC')
		expect(migration).toContain(
			'GRANT SELECT ON TABLE public.record_history_entry TO zeepcentraal_graphql',
		)
	})
})
