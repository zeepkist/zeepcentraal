import assert from 'node:assert/strict'
import { buildSchema } from 'postgraphile/graphql'
import { bunSqlAdaptor, makeBunPgService } from '../src/bunSqlAdaptor'
import { buildPostGraphileServer } from '../src/server'

async function main() {
	const url = process.env.ZC_TEST_DATABASE_URL
	if (!url) throw new Error('Missing isolated database')
	const parsed = new URL(url)
	if (parsed.hostname !== '127.0.0.1' || parsed.pathname !== '/record_eligibility_flags_test') {
		throw new Error('Isolated local flag test database required')
	}
	const service = makeBunPgService({
		connectionString: url,
		schemas: ['public'],
		pubsub: false,
		poolConfig: {
			max: 2,
			connectionTimeoutMillis: 1000,
			statement_timeout: 12000,
			lock_timeout: 1000,
			idle_in_transaction_session_timeout: 15000,
		},
	})
	const settings = service.adaptorSettings
	if (!settings) throw new Error('Missing SQL pool')
	const withClient = await bunSqlAdaptor.createWithPgClient(settings, 'DEFAULT')
	const transport = {
		async handleGraphQLRequest() {
			await withClient(null, async (client) => {
				await client.query({ text: 'SELECT pg_sleep(11)' })
			})
			return Response.json({ data: { ok: true } })
		},
		async handleGraphiQLStaticRequest() {
			return null
		},
	}
	const app = buildPostGraphileServer(
		{
			createServ: () => transport,
			getSchema: () => buildSchema('type Query { ok: Boolean }'),
		} as unknown as Parameters<typeof buildPostGraphileServer>[0],
		{ check: async () => ({ ok: true }), dispose: async () => {} },
	).listen(0)
	try {
		const port = app.server?.port
		if (!port) throw new Error('Test listener did not bind')
		const response = await fetch(`http://127.0.0.1:${port}/`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query: '{ ok }' }),
			signal: AbortSignal.timeout(14000),
		})
		assert.equal(response.status, 200)
		assert.deepEqual(await response.json(), { data: { ok: true } })
		await withClient(null, async (client) => {
			await client.query({ text: "SET statement_timeout='100ms'" })
			await assert.rejects(client.query({ text: 'SELECT pg_sleep(1)' }), {
				code: '57014',
			})
			assert.equal((await client.query({ text: 'SELECT 1' })).rowCount, 1)
		})
	} finally {
		await app.stop(true)
		await service.release?.()
	}
}

await main()
console.log(
	'HTTP and reserved SQL survive 11 seconds; PostgreSQL deadline cancels queries without poisoning connection.',
)
