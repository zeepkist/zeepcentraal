import { expect, test } from 'bun:test'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { constant, lambda } from 'postgraphile/grafast'
import { defaultPreset, makeSchema } from 'postgraphile/graphile-build'
import { extendSchema } from 'postgraphile/utils'
import { ElysiaGrafserv } from './elysiaGrafserv'
import { GtrUpdateMessagePlugin } from './plugins/GtrUpdateMessagePlugin'
import { createPostGraphilePreset } from './postgraphileOptions'
import { createPostGraphileRuntime } from './postgraphileRuntime'

async function createRuntime() {
	const { schema } = await makeSchema({
		extends: [defaultPreset],
		plugins: [
			extendSchema({
				typeDefs: `
						extend type Query {
							users: [TestUser]!
							broken: String
							versions(first: Int, orderBy: TestVersionOrder): TestVersions
						}
						type TestUser { steamName: String other: String friend: TestUser }
						extend type Subscription { users: [TestUser]! }
						type TestVersions { nodes: [TestVersion!]! }
						type TestVersion { id: Int minimum: String latest: String }
						enum TestVersionOrder { ID_ASC }
					`,
				plans: {
					Query: {
						users: () =>
							constant([
								{ steamName: 'Alice', other: 'keep', friend: { steamName: 'Bob' } },
								null,
								{ steamName: null, other: 'also keep', friend: null },
							]),
						versions: () =>
							constant({ nodes: [{ id: 1, minimum: '1.10.0', latest: '1.11.0' }] }),
						broken: () =>
							lambda(constant(null), () => {
								throw new Error('test field failure')
							}),
					},
				},
			}),
			GtrUpdateMessagePlugin,
		],
	})
	const { grafast, grafserv } = createPostGraphilePreset()
	const server = new ElysiaGrafserv({
		schema,
		preset: {
			grafast: { ...grafast, explain: false },
			grafserv: { ...grafserv, maskError: (error) => error },
		},
	})
	const runtime = createPostGraphileRuntime(
		{ createServ: () => server, getSchema: () => schema },
		{
			...postgraphileConfig,
			liveQueries: { ...postgraphileConfig.liveQueries, enabled: false },
		},
	)
	return { runtime, server }
}

const body = {
	query: `
		query Names($show: Boolean!, $skip: Boolean!) {
			users {
				...Names
				... on TestUser { renamed: steamName @include(if: $show) }
				hidden: steamName @skip(if: $skip)
				steamName: other
				friend { ...Names }
			}
		}
		fragment Names on TestUser { name: steamName }
	`,
	variables: { show: true, skip: true },
}

function request(version?: string) {
	return new Request('http://localhost/', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...(version ? { 'X-GTR-Version': version } : {}),
		},
	})
}

test('HTTP names include aliases, fragments, arrays, directives and null values without plan leaks', async () => {
	const { runtime } = await createRuntime()
	try {
		for (const version of ['1.9.0', '1.10.0', undefined, 'invalid', '1.9.0']) {
			const response = await runtime.graphqlRoute({ request: request(version), body })
			expect(response.status).toBe(200)
			expect(response.headers.get('content-type')).toContain(
				'application/graphql-response+json',
			)
			expect(response.headers.get('X-Query-Cost')).not.toBeNull()
			const message = version === '1.9.0' ? 'Update GTR to 1.11.0' : undefined
			expect(await response.json()).toEqual({
				data: {
					users: [
						{
							name: message ?? 'Alice',
							renamed: message ?? 'Alice',
							steamName: 'keep',
							friend: { name: message ?? 'Bob' },
						},
						null,
						{
							name: message ?? null,
							renamed: message ?? null,
							steamName: 'also keep',
							friend: null,
						},
					],
				},
			})
		}
	} finally {
		await runtime.stop()
	}
})

test('HTTP replacement preserves GraphQL errors and internal executions ignore client header', async () => {
	const { runtime, server } = await createRuntime()
	try {
		const errorBody = { query: '{ users { steamName } broken }' }
		const plain = await runtime.graphqlRoute({ request: request(), body: errorBody })
		const outdated = await runtime.graphqlRoute({ request: request('1.9.0'), body: errorBody })
		expect(outdated.status).toBe(plain.status)
		const plainJson = (await plain.json()) as {
			errors: unknown[]
			data: { broken: null; users: { steamName: string }[] }
		}
		const outdatedJson = (await outdated.json()) as typeof plainJson
		expect(outdatedJson.errors).toEqual(plainJson.errors)
		expect(outdatedJson.data.broken).toBeNull()
		expect(outdatedJson.data.users[0]?.steamName).toBe('Update GTR to 1.11.0')

		const internal = await server.handleGraphQLRequest(request('1.9.0'), errorBody)
		if (!internal) throw new Error('Missing GraphQL response')
		const internalJson = (await internal.json()) as typeof plainJson
		expect(internalJson.data.users[0]?.steamName).toBe('Alice')
		await runtime.readinessProbe.start().promise
	} finally {
		await runtime.stop()
	}
})

test('WebSocket results keep original names even after outdated HTTP request', async () => {
	const { runtime } = await createRuntime()
	const sent: { type: string; payload?: unknown }[] = []
	const ws = {
		request: new Request('http://localhost/', {
			headers: { 'X-GTR-Version': '1.9.0', 'sec-websocket-protocol': 'graphql-transport-ws' },
		}),
		send: (message: unknown) => sent.push(JSON.parse(String(message))),
		close() {},
	}
	try {
		await runtime.graphqlRoute({ request: request('1.9.0'), body })
		runtime.liveQueryWebSocket.open(ws)
		await runtime.liveQueryWebSocket.message(ws, JSON.stringify({ type: 'connection_init' }))
		await runtime.liveQueryWebSocket.message(
			ws,
			JSON.stringify({
				type: 'subscribe',
				id: 'names',
				payload: { query: 'subscription { users { steamName } }' },
			}),
		)
		for (let i = 0; i < 100 && !sent.some((message) => message.type === 'next'); i++) {
			await Bun.sleep(1)
		}
		expect(sent.find((message) => message.type === 'next')?.payload).toEqual({
			data: { users: [{ steamName: 'Alice' }, null, { steamName: null }] },
		})
	} finally {
		await runtime.stop()
	}
})
