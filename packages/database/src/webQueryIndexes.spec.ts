import { describe, expect, test } from 'bun:test'
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'
import {
	level,
	levelItem,
	levelPoints,
	record,
	user,
	userPointContribution,
	userPoints,
	vote,
	zslLevelResult,
	zslRoundResult,
	zslSeasonResult,
} from './schema'

const dialect = new PgDialect()

function indexesFor(table: Parameters<typeof getTableConfig>[0]) {
	return getTableConfig(table).indexes
}

function indexFor(table: Parameters<typeof getTableConfig>[0], name: string) {
	const result = indexesFor(table).find((index) => index.config.name === name)
	if (!result) {
		throw new Error(`Missing index ${name}`)
	}

	return result
}

function columnsFor(table: Parameters<typeof getTableConfig>[0], name: string) {
	return indexFor(table, name).config.columns.map((column) => {
		const indexConfig = 'indexConfig' in column ? column.indexConfig : undefined

		return {
			name: 'name' in column ? column.name : undefined,
			nulls: indexConfig?.nulls,
			opClass: indexConfig?.opClass,
			order: indexConfig?.order,
		}
	})
}

function predicateFor(table: Parameters<typeof getTableConfig>[0], name: string) {
	const predicate = indexFor(table, name).config.where
	if (!predicate) {
		throw new Error(`Missing predicate for ${name}`)
	}

	return dialect.sqlToQuery(predicate).sql
}

describe('web GraphQL query indexes', () => {
	test('matches deterministic record cursor and date-window access paths', () => {
		expect(columnsFor(record, 'IX_records_date_created_id')).toEqual([
			{ name: 'date_created', nulls: 'last', opClass: undefined, order: 'desc' },
			{ name: 'id', nulls: 'last', opClass: undefined, order: 'desc' },
			{ name: 'id_level', nulls: 'last', opClass: undefined, order: 'asc' },
			{ name: 'mod_version', nulls: 'last', opClass: undefined, order: 'asc' },
		])
		expect(columnsFor(record, 'IX_records_level_date_created_id')).toEqual([
			{ name: 'id_level', nulls: 'last', opClass: undefined, order: 'asc' },
			{ name: 'date_created', nulls: 'last', opClass: undefined, order: 'desc' },
			{ name: 'id', nulls: 'last', opClass: undefined, order: 'desc' },
			{ name: 'mod_version', nulls: 'last', opClass: undefined, order: 'asc' },
		])
		expect(columnsFor(record, 'IX_records_user_date_created_id')).toEqual([
			{ name: 'id_user', nulls: 'last', opClass: undefined, order: 'asc' },
			{ name: 'date_created', nulls: 'last', opClass: undefined, order: 'desc' },
			{ name: 'id', nulls: 'last', opClass: undefined, order: 'desc' },
			{ name: 'mod_version', nulls: 'last', opClass: undefined, order: 'asc' },
		])

		const names = indexesFor(record).map((index) => index.config.name)
		expect(names).not.toContain('IX_records_date_created')
		expect(names).not.toContain('IX_records_user_date_created')
	})

	test('uses active partial indexes for level cards and author activity', () => {
		expect(
			columnsFor(levelItem, 'IX_level_item_level_updated_active').map(({ name }) => name),
		).toEqual(['id_level', 'updated_at', 'id'])
		expect(predicateFor(levelItem, 'IX_level_item_level_updated_active')).toBe(
			'"level_item"."deleted" = false',
		)
		expect(
			columnsFor(levelItem, 'IX_level_item_author_created_active').map(({ name }) => name),
		).toEqual(['author_id', 'created_at', 'id', 'id_level'])
		expect(predicateFor(levelItem, 'IX_level_item_author_created_active')).toBe(
			'"level_item"."deleted" = false',
		)
		expect(predicateFor(level, 'IX_level_adventure_date_created_id')).toBe(
			'"level"."adventure" = true',
		)
	})

	test('uses trigram operator classes for every web substring search branch', () => {
		for (const [table, name] of [
			[level, 'IX_level_hash_search'],
			[level, 'IX_level_xx_hash_search'],
			[levelItem, 'IX_level_item_name_search'],
			[user, 'IX_user_steam_name_search'],
		] as const) {
			const index = indexFor(table, name)
			expect(index.config.method).toBe('gin')
			expect(columnsFor(table, name)[0]?.opClass).toBe('gin_trgm_ops')
		}
	})

	test('covers explorer, contribution, metric, and scoped standings ordering', () => {
		const expected = [
			[levelPoints, 'IX_level_points_points_level'],
			[levelPoints, 'IX_level_points_rating_level'],
			[userPointContribution, 'IX_user_point_contribution_user_value_level'],
			[userPointContribution, 'IX_user_point_contribution_player_value_record'],
			[userPointContribution, 'IX_user_point_contribution_level_value_record'],
			[userPointContribution, 'IX_user_point_contribution_user_level_value_record'],
			[userPointContribution, 'IX_user_point_contribution_user_wr_value_level'],
			[userPoints, 'IX_user_points_rank_ranked'],
			[userPoints, 'IX_user_points_points'],
			[userPoints, 'IX_user_points_total_points'],
			[userPoints, 'IX_user_points_world_records'],
			[vote, 'IX_vote_date_created'],
			[zslLevelResult, 'IX_zsl_level_result_level_position_user'],
			[zslRoundResult, 'IX_zsl_round_result_round_position_user'],
			[zslSeasonResult, 'IX_zsl_season_result_season_position_user'],
		] as const

		for (const [table, name] of expected) {
			expect(indexFor(table, name).config.unique).toBe(false)
		}
		expect(
			predicateFor(userPointContribution, 'IX_user_point_contribution_user_wr_value_level'),
		).toBe('"user_point_contribution"."level_position" = 1')
		expect(predicateFor(userPoints, 'IX_user_points_rank_ranked')).toBe(
			'"user_points"."rank" <> -1',
		)
	})

	test('keeps EXPLAIN-gated indexes deferred', () => {
		const names = [
			...indexesFor(record),
			...indexesFor(zslLevelResult),
			...indexesFor(zslRoundResult),
		].map((index) => index.config.name)

		expect(names).not.toContain('IX_records_level_mod_version_id')
		expect(names).not.toContain('IX_records_user_mod_version_date_created_id')
		expect(names).not.toContain('IX_zsl_level_result_user_level')
		expect(names).not.toContain('IX_zsl_round_result_user_round')
	})
})
