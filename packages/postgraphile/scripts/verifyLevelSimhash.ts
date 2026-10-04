/** Read-only GraphQL checks against fixture created by Rust level_simhash integration test. */
import assert from 'node:assert/strict'
import { postgraphile } from 'postgraphile'
import { elysiaGrafserv } from '../src/elysiaGrafserv'
import { createPostGraphilePreset } from '../src/postgraphileOptions'

const databaseUrl = process.env.ZC_TEST_DATABASE_URL
if (!databaseUrl) throw new Error('ZC_TEST_DATABASE_URL must point to local simhash_test database')
const parsed = new URL(databaseUrl)
if (parsed.hostname !== '127.0.0.1' || parsed.pathname !== '/simhash_test') {
	throw new Error('GraphQL checks require disposable local simhash_test database')
}

type SimilarConnection = {
	nodes: { id: number; simhash?: string }[]
	totalCount?: number
	pageInfo?: {
		endCursor?: string
		hasNextPage?: boolean
	}
}

const instance = postgraphile(
	createPostGraphilePreset({
		databaseUrl,
		allowExplain: false,
		nodeEnv: 'production',
		databasePoolMax: 2,
		databaseTimeouts: {
			connectMs: 5000,
			statementMs: 15000,
			lockMs: 3000,
			idleTransactionMs: 30000,
		},
		cacheMaxEntries: 128,
		operationPlansPerOperation: 8,
		liveQueries: { enabled: true },
	}),
)

try {
	await instance.getSchema()
	const server = instance.createServ(elysiaGrafserv)
	const query = async (source: string, variables: Record<string, unknown> = {}) => {
		const response = await server.handleGraphQLRequest(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: source, variables }),
			}),
		)
		assert(response)
		const result = (await response.json()) as {
			errors?: unknown
			data?: { similarLevels?: SimilarConnection }
		}
		assert.equal(result.errors, undefined, JSON.stringify(result.errors))
		const connection = result.data?.similarLevels
		assert(connection)
		return connection
	}
	const first = await query(`query {
		similarLevels(xxHash: "00000000000000000000000000000001", maxDistance: 1, first: 2) {
			totalCount nodes { id simhash } pageInfo { endCursor hasNextPage }
		}
	}`)
	assert.deepEqual(
		first.nodes.map((node: { id: number }) => node.id),
		[3, 2],
	)
	assert.equal(first.nodes[0]?.simhash, '-9223372036854775808')
	assert.equal(first.totalCount, 3)
	assert.equal(first.pageInfo?.hasNextPage, true)
	const next = await query(
		`query($after: Cursor!) {
			similarLevels(xxHash: "00000000000000000000000000000001", maxDistance: 1, first: 2, after: $after) {
				nodes { id } pageInfo { hasNextPage }
			}
		}`,
		{ after: first.pageInfo?.endCursor },
	)
	assert.deepEqual(
		next.nodes.map((node: { id: number }) => node.id),
		[4],
	)
	assert.equal(next.pageInfo?.hasNextPage, false)
	const defaultCutoff = await query(`query {
		similarLevels(xxHash: "00000000000000000000000000000001", first: 0) { totalCount }
	}`)
	const explicitCutoff = await query(`query {
		similarLevels(xxHash: "00000000000000000000000000000001", maxDistance: 16, first: 0) { totalCount }
	}`)
	assert.equal(typeof defaultCutoff.totalCount, 'number')
	assert.equal(defaultCutoff.totalCount, explicitCutoff.totalCount)
	for (const xxHash of ['missing', '00000000000000000000000000000007']) {
		const empty = await query(
			'query($hash: String) { similarLevels(xxHash: $hash, maxDistance: 64) { nodes { id } } }',
			{ hash: xxHash },
		)
		assert.deepEqual(empty.nodes, [])
	}
	console.log('GraphQL similarity order, signed BigInt, visibility and forward pagination passed')
} finally {
	await instance.release()
}
