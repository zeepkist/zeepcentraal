import assert from 'node:assert/strict'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { SQL } from 'bun'
import { isObjectType } from 'postgraphile/graphql'
import { createPostGraphileHandler } from '../src/postgraphileOptions'
import { buildPostGraphileServer } from '../src/server'

const databaseUrl = process.env.ZC_TEST_DATABASE_URL
assert.ok(databaseUrl, 'ZC_TEST_DATABASE_URL required')
const url = new URL(databaseUrl)
assert.equal(url.hostname, '127.0.0.1')
assert.equal(url.pathname, '/competitive_medal_test')
const admin = new SQL(url.href)
const role = `schema_watch_${crypto.randomUUID().replaceAll('-', '')}`
const password = crypto.randomUUID().replaceAll('-', '')
await admin.unsafe(
	'CREATE TABLE public.schema_watch_probe(id integer PRIMARY KEY); INSERT INTO public.schema_watch_probe VALUES(1)',
)
await admin.unsafe('GRANT SELECT ON public.schema_watch_probe TO zeepcentraal_graphql')
await admin.unsafe(
	`CREATE ROLE ${role} LOGIN INHERIT PASSWORD '${password}' IN ROLE zeepcentraal_graphql`,
)
url.username = role
url.password = password
const handler = createPostGraphileHandler({
	...postgraphileConfig,
	databaseUrl: url.href,
	superuserDatabaseUrl: databaseUrl,
	nodeEnv: 'production',
})
const app = buildPostGraphileServer(handler).listen({ hostname: '127.0.0.1', port: 0 })
const socket = new WebSocket(`ws://127.0.0.1:${app.server?.port}/`, ['graphql-transport-ws'])
const messages: { id?: string; type: string; payload?: unknown }[] = []
socket.addEventListener('message', (event) => messages.push(JSON.parse(String(event.data))))
try {
	await new Promise<void>((resolve, reject) => {
		socket.addEventListener('open', () => resolve(), { once: true })
		socket.addEventListener('error', () => reject(new Error('Test WebSocket failed')), {
			once: true,
		})
	})
	socket.send(JSON.stringify({ type: 'connection_init' }))
	const initial = await handler.getSchema()
	const [triggers] = await admin.unsafe(
		"SELECT count(*)::integer AS count FROM pg_event_trigger WHERE evtname IN ('postgraphile_watch_ddl', 'postgraphile_watch_drop') AND evtenabled = 'O'",
	)
	assert.equal(triggers.count, 2, 'PostGraphile must install enabled schema-watch event triggers')
	const type = initial.getType('SchemaWatchProbe')
	assert.ok(type && isObjectType(type))
	assert.equal(type.getFields().added, undefined)
	await admin.unsafe('ALTER TABLE public.schema_watch_probe ADD COLUMN added integer DEFAULT 7')
	const deadline = Date.now() + 15_000
	while (Date.now() < deadline) {
		const schema = await handler.getSchema()
		const updated = schema.getType('SchemaWatchProbe')
		if (updated && isObjectType(updated) && updated.getFields().added) break
		await Bun.sleep(50)
	}
	const schema = await handler.getSchema()
	const updated = schema.getType('SchemaWatchProbe')
	assert.ok(
		updated && isObjectType(updated) && updated.getFields().added,
		'Production schema must rebuild after committed DDL',
	)
	const response = await app.handle(
		new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				query: '{ schemaWatchProbes(first: 1) { nodes { id added } } }',
			}),
		}),
	)
	const body = (await response.json()) as {
		errors?: unknown
		data: { schemaWatchProbes: { nodes: { id: number; added: number }[] } }
	}
	assert.equal(body.errors, undefined)
	assert.deepEqual(body.data.schemaWatchProbes.nodes, [{ id: 1, added: 7 }])
	socket.send(
		JSON.stringify({
			id: 'added',
			type: 'subscribe',
			payload: {
				query: 'subscription { schemaWatchProbes(first: 1) { nodes { id added } } }',
			},
		}),
	)
	const messageDeadline = Date.now() + 15_000
	while (!messages.some((message) => message.id === 'added') && Date.now() < messageDeadline)
		await Bun.sleep(20)
	const next = messages.find((message) => message.id === 'added')
	assert.equal(next?.type, 'next')
	const payload = next?.payload as typeof body
	assert.equal(payload.errors, undefined)
	assert.deepEqual(payload.data.schemaWatchProbes.nodes, [{ id: 1, added: 7 }])
	socket.send(JSON.stringify({ id: 'added', type: 'complete' }))
	await admin.unsafe('ALTER TABLE public.schema_watch_probe DROP COLUMN added')
	const dropDeadline = Date.now() + 15_000
	while (Date.now() < dropDeadline) {
		const current = (await handler.getSchema()).getType('SchemaWatchProbe')
		if (current && isObjectType(current) && !current.getFields().added) break
		await Bun.sleep(50)
	}
	const dropped = (await handler.getSchema()).getType('SchemaWatchProbe')
	assert.ok(dropped && isObjectType(dropped) && !dropped.getFields().added)
	console.log(
		'Production restricted-role schema rebuilds after ADD/DROP COLUMN; HTTP and existing WebSocket connections see new fields without restart',
	)
} finally {
	socket.close()
	await app.stop(true)
	await admin.unsafe('DROP TABLE public.schema_watch_probe')
	await admin.unsafe(`DROP ROLE ${role}`)
	await admin.close()
}
