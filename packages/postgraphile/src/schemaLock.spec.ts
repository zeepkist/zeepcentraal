import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildSchema, lexicographicSortSchema, printSchema } from 'postgraphile/graphql'
import { createPostGraphileHandler } from './postgraphileOptions'

function normalizeSchema(schema: string) {
	return printSchema(lexicographicSortSchema(buildSchema(schema)))
		.replace(/\r\n/g, '\n')
		.trim()
}

describe('PostGraphile schema lock', () => {
	test('published schema excludes private level requests and retains public level routines', async () => {
		const publishedSchema = await readFile(
			join(import.meta.dir, '../../graphql/schema.graphql'),
			'utf8',
		)

		expect(publishedSchema).not.toContain('LevelRequest')
		expect(publishedSchema).not.toContain('levelRequest')
		expect(publishedSchema).toContain('hotLevelsSince(')
		expect(publishedSchema).toContain('zRtm(')
	})

	test('published schema exposes discovery visibility without internal persistence state', async () => {
		const publishedSchema = buildSchema(
			await readFile(join(import.meta.dir, '../../graphql/schema.graphql'), 'utf8'),
		)
		const fields = (typeName: string) => {
			const type = publishedSchema.getType(typeName)
			if (!type || !('getFields' in type)) throw new Error(`Missing object type ${typeName}`)
			return Object.keys(type.getFields())
		}

		expect(fields('Level')).toContain('publiclyVisible')
		expect(fields('Level')).not.toContain('hasRecords')
		for (const typeName of ['LevelItem', 'LevelMetadatum', 'WorkshopItem']) {
			expect(fields(typeName)).not.toContain('publiclyVisible')
		}
		for (const typeName of [
			'LevelDistinctCountAggregates',
			'LevelItemDistinctCountAggregates',
			'LevelMetadatumDistinctCountAggregates',
			'WorkshopItemDistinctCountAggregates',
		]) {
			expect(fields(typeName)).not.toContain('hasRecords')
			if (typeName !== 'LevelDistinctCountAggregates') {
				expect(fields(typeName)).not.toContain('publiclyVisible')
			}
		}
	})

	test('matches published GraphQL schema when schema lock is enabled', async () => {
		if (process.env.POSTGRAPHILE_SCHEMA_LOCK !== '1') {
			return
		}

		const expectedSchema = await readFile(
			join(import.meta.dir, '../../graphql/schema.graphql'),
			'utf8',
		)
		const handler = createPostGraphileHandler()
		const actualSchema = printSchema(lexicographicSortSchema(await handler.getSchema()))

		expect(normalizeSchema(actualSchema)).toBe(normalizeSchema(expectedSchema))
	})
})
