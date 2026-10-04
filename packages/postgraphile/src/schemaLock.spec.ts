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

	test('similar levels retain routine order and expose signed BigInt fingerprints', async () => {
		const schema = buildSchema(
			await readFile(join(import.meta.dir, '../../graphql/schema.graphql'), 'utf8'),
		)
		const level = schema.getType('Level')
		expect(
			level && 'getFields' in level ? level.getFields().simhash?.type.toString() : null,
		).toBe('BigInt')
		for (const root of [schema.getQueryType(), schema.getSubscriptionType()]) {
			const similar = root?.getFields().similarLevels
			expect(similar?.type.toString()).toBe('LevelsConnection')
			expect(similar?.args.find((arg) => arg.name === 'xxHash')?.type.toString()).toBe(
				'String',
			)
			expect(similar?.args.find((arg) => arg.name === 'maxDistance')?.type.toString()).toBe(
				'Int',
			)
			expect(similar?.args.map((arg) => arg.name)).toEqual(
				expect.arrayContaining(['first', 'last', 'after', 'before']),
			)
			expect(similar?.args.some((arg) => arg.name === 'orderBy')).toBe(false)
		}
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

	test('published schema exposes flattened read-only record history', async () => {
		const publishedSchema = buildSchema(
			await readFile(join(import.meta.dir, '../../graphql/schema.graphql'), 'utf8'),
		)
		const query = publishedSchema.getQueryType()?.getFields()
		const subscription = publishedSchema.getSubscriptionType()?.getFields()
		const entry = publishedSchema.getType('RecordHistoryEntry')

		expect(query?.recordHistoryEntries).toBeDefined()
		expect(subscription?.recordHistoryEntries).toBeDefined()
		expect(entry && 'getFields' in entry ? Object.keys(entry.getFields()) : []).toEqual(
			expect.arrayContaining([
				'historyView',
				'id',
				'userSteamId',
				'levelXxHash',
				'levelName',
				'levelPosition',
				'contributionRank',
				'levelPoints',
				'levelDecayedPoints',
				'playerDecayedPoints',
				'isPersonalBest',
				'isWorldRecord',
			]),
		)
	})

	test('donations expose only public supporter metadata', async () => {
		const schema = buildSchema(
			await readFile(join(import.meta.dir, '../../graphql/schema.graphql'), 'utf8'),
		)
		const donation = schema.getType('Donation')
		expect(
			donation && 'getFields' in donation ? Object.keys(donation.getFields()).sort() : [],
		).toEqual(['discordUserid', 'isSubscriptionPayment', 'nodeId', 'tierName'])
		const user = schema.getType('User')
		expect(
			user && 'getFields' in user ? user.getFields().donation?.type.toString() : null,
		).toBe('Donation')
		expect(schema.getQueryType()?.getFields().donations).toBeDefined()
		expect(schema.getMutationType()).toBeUndefined()
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
