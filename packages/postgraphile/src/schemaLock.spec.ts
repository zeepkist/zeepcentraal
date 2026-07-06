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
