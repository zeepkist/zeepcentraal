import { describe, expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { parse, validate } from 'postgraphile/graphql'
import {
	DEFAULT_GRAPHQL_SMOKE_URL,
	GRAPHQL_SMOKE_CLIENT,
	GraphqlSmokeError,
	loadOperationCatalog,
	loadPublishedSchema,
	operationDocument,
	PRODUCTION_GRAPHQL_SMOKE_URL,
	parseSmokeCliArguments,
	printOperation,
	requestGraphql,
	validateOperationCatalog,
	ZRTM_RLS_SMOKE_QUERY,
} from './webGraphqlSmoke'

const webGraphqlDirectory = fileURLToPath(new URL('../../../web/app/graphql', import.meta.url))
const publishedSchemaPath = fileURLToPath(
	new URL('../../../graphql/schema.graphql', import.meta.url),
)

describe('web GraphQL RLS smoke utilities', () => {
	test('loads and validates every checked-in web operation', async () => {
		const catalog = await loadOperationCatalog(webGraphqlDirectory)
		const schema = await loadPublishedSchema(publishedSchemaPath)

		expect(catalog.operations.size).toBe(58)
		expect(
			[...catalog.operations.keys()].filter((name) => name.startsWith('ZC_')),
		).toHaveLength(60)
		expect(validateOperationCatalog(schema, catalog)).toEqual([])
		expect(validate(schema, parse(ZRTM_RLS_SMOKE_QUERY))).toEqual([])
	})

	test('prints only requested operation and transitive fragments', async () => {
		const catalog = await loadOperationCatalog(webGraphqlDirectory)
		const query = printOperation(catalog, 'ZC_RecordDetail')

		expect(operationDocument(catalog, 'ZC_RecordDetail').definitions.length).toBeGreaterThan(1)
		expect(query).toContain('query ZC_RecordDetail')
		expect(query).toContain('fragment ZC_GhostComparisonRecord')
		expect(query).toContain('fragment ZC_RecordStatistic')
		expect(query).not.toContain('query ZC_RecordComparisonCatalog')
	})

	test('requires explicit production selection', () => {
		expect(() => parseSmokeCliArguments(['--url', PRODUCTION_GRAPHQL_SMOKE_URL])).toThrow(
			'Production endpoint requires explicit --production',
		)
		expect(parseSmokeCliArguments(['--production', '--schema-only'])).toEqual({
			endpoint: `${PRODUCTION_GRAPHQL_SMOKE_URL}/`,
			production: true,
			schemaOnly: true,
			timeoutMs: 15_000,
		})
		expect(parseSmokeCliArguments([]).endpoint).toBe(`${DEFAULT_GRAPHQL_SMOKE_URL}/`)
	})

	test('sends named POST requests with bounded client identity', async () => {
		let request: Request | undefined
		const result = await requestGraphql({
			endpoint: 'http://localhost:5000/',
			fetchImpl: async (input, init) => {
				request = input instanceof Request ? input : new Request(input.toString(), init)
				return new Response(JSON.stringify({ data: { levels: { totalCount: 1 } } }), {
					headers: { 'Content-Type': 'application/json', 'X-Query-Cost': '12' },
				})
			},
			operationName: 'ZC_Levels',
			query: 'query ZC_Levels { levels(first: 0) { totalCount } }',
			timeoutMs: 1_000,
		})

		expect(request?.method).toBe('POST')
		expect(request?.headers.get('X-Client')).toBe(GRAPHQL_SMOKE_CLIENT)
		expect(await request?.json()).toEqual({
			operationName: 'ZC_Levels',
			query: 'query ZC_Levels { levels(first: 0) { totalCount } }',
		})
		expect(result.data).toEqual({ levels: { totalCount: 1 } })
		expect(result.queryCost).toBe('12')
	})

	test('reports operation failures without response data', async () => {
		const privatePayload = 'private-level-name'
		const request = requestGraphql({
			endpoint: 'http://localhost:5000/',
			fetchImpl: async () =>
				new Response(
					JSON.stringify({
						data: { levels: { nodes: [{ name: privatePayload }] } },
						errors: [
							{ extensions: { code: 'DATABASE_ERROR' }, message: 'Database failed' },
						],
					}),
					{ headers: { 'Content-Type': 'application/json' } },
				),
			operationName: 'ZC_Levels',
			query: 'query ZC_Levels { levels(first: 1) { nodes { id } } }',
			timeoutMs: 1_000,
		})

		await expect(request).rejects.toEqual(
			new GraphqlSmokeError(
				'ZC_Levels returned GraphQL errors: Database failed [DATABASE_ERROR]',
				'ZC_Levels',
			),
		)
		await expect(request).rejects.not.toThrow(privatePayload)
	})
})
