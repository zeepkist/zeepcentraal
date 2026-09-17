// Run with bun.exe on Windows/WSL. Uses synthetic preview data only.
const base = process.argv[2] ?? 'http://127.0.0.1:4310'
const url = new URL(base)
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
	throw new Error('Preview smoke requires local HTTP URL')
}
const check = (value: unknown, message: string) => {
	if (!value) throw new Error(message)
}
for (const path of [
	'/healthz',
	'/admin',
	'/admin/',
	'/admin/openapi.json',
	'/admin/swagger',
	'/admin/scalar',
	'/graphql',
	'/api/level',
]) {
	const response = await fetch(`${base}${path}`)
	check(response.ok, `${path}: ${response.status}`)
}
const graphql = async (query: string) => {
	const response = await fetch(`${base}/graphql`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query }),
	})
	const body = (await response.json()) as { data?: Record<string, unknown>; errors?: unknown[] }
	check(response.ok && !body.errors?.length, `GraphQL failed: ${JSON.stringify(body)}`)
	return body.data
}
check(await graphql('{ level { id name } }'), 'Missing query data')
await graphql(
	'mutation { insert_record(objects: [{id_user: 1, id_level: 1, time: 28.625}]) { affected_rows } }',
)
const socket = new WebSocket(`${base.replace('http:', 'ws:')}/graphql/ws`, 'graphql-transport-ws')
await new Promise<void>((resolve, reject) => {
	let initial = false
	let previousId: unknown
	const timer = setTimeout(() => {
		socket.close()
		reject(new Error('Subscription update timed out'))
	}, 15000)
	const fail = (error: unknown) => {
		clearTimeout(timer)
		socket.close()
		reject(error)
	}
	socket.onopen = () => socket.send(JSON.stringify({ type: 'connection_init' }))
	socket.onerror = () => fail(new Error('WebSocket failed'))
	socket.onmessage = async (event) => {
		try {
			const message = JSON.parse(String(event.data))
			if (message.type === 'connection_ack') {
				socket.send(
					JSON.stringify({
						id: 'schema',
						type: 'subscribe',
						payload: { query: '{ __schema { mutationType { name } } }' },
					}),
				)
			} else if (message.id === 'schema' && message.type === 'next') {
				check(
					message.payload?.data?.__schema?.mutationType === null,
					'WebSocket mutations must be disabled',
				)
				socket.send(
					JSON.stringify({
						id: 'test',
						type: 'subscribe',
						payload: {
							query: 'subscription { record(order_by: [{id: desc}], limit: 1) { id time } }',
						},
					}),
				)
			} else if (message.type === 'error' || message.payload?.errors?.length) {
				fail(new Error(JSON.stringify(message)))
			} else if (message.type === 'complete' && message.id === 'test') {
				fail(new Error('Subscription completed before update'))
			} else if (message.type === 'next') {
				if (!initial) {
					initial = true
					previousId = message.payload?.data?.record?.[0]?.id
					const response = await fetch(`${base}/evaluation/record`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ user: 1, level: 1, time: 28.375 }),
					})
					check(response.status === 204, 'Application write failed')
				} else if (
					message.payload?.data?.record?.[0]?.time === 28.375 &&
					message.payload?.data?.record?.[0]?.id !== previousId
				) {
					clearTimeout(timer)
					socket.send(JSON.stringify({ type: 'complete', id: 'test' }))
					socket.close()
					resolve()
				}
			}
		} catch (error) {
			fail(error)
		}
	}
})
console.log('Preview admin, REST, GraphQL query/mutation and subscription smoke passed')
