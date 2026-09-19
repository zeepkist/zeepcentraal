export {}

// Local synthetic transport, never a Discord API proxy. State resets per trial.
const delivered = new Set<number>()
const sent = new Set<number>()
const counters = { requests: 0, acknowledgements: 0, deliveries: 0, cursors: 0, duplicates: 0 }
const attempts = new Map<string, number>()
Bun.serve({
	hostname: '127.0.0.1',
	port: 4321,
	async fetch(request) {
		const path = new URL(request.url).pathname
		if (path === '/healthz') return Response.json({ status: 'ok' })
		if (path === '/stats') return Response.json(counters)
		if (request.method !== 'POST') return new Response(null, { status: 404 })
		const body = (await request.json()) as {
			id: number
			kind: string
			query?: string
			payload: { flags: number; allowed_mentions: { parse: string[] } }
		}
		counters.requests++
		if (path === '/backend/delivery')
			return Response.json({ delivered: delivered.has(body.id) })
		if (path === '/backend/advance') {
			if (!sent.has(body.id))
				return Response.json({ error: 'Unsent cursor' }, { status: 409 })
			delivered.add(body.id)
			counters.cursors++
			return Response.json({ ok: true })
		}
		if (path === '/discord/ack') {
			counters.acknowledgements++
			return Response.json({ ok: true })
		}
		if (path === '/discord/deliver') {
			if (body.id === 9001 || body.id === 9002) {
				const key = `${body.id}`
				const n = attempts.get(key) ?? 0
				attempts.set(key, n + 1)
				if (n === 0)
					return Response.json(
						{ retry_after: 0.01 },
						{ status: body.id === 9001 ? 429 : 500 },
					)
			}
			if (body.id === 9003) return Response.json({ code: 50007 }, { status: 403 })
			if (
				body.kind !== 'autocomplete' &&
				(body.payload.flags !== 32768 || body.payload.allowed_mentions.parse.length !== 0)
			)
				return Response.json({ error: 'Unsafe payload' }, { status: 400 })
			if (sent.has(body.id)) counters.duplicates++
			sent.add(body.id)
			counters.deliveries++
			return Response.json({ ok: true })
		}
		if (path === '/graphql' || path === '/activity') {
			if (typeof body.query !== 'string' || !body.query.includes('ZC_Discord'))
				return Response.json({ error: 'Missing source document' }, { status: 400 })
			return Response.json({
				choices: Array.from({ length: 8 }, (_, i) => ({
					name: `Fixture level ${i}`,
					value: `${i + 1}`,
				})),
				display: {
					title: `${body.kind} ${body.id % 1000}`,
					description: 'Synthetic Discord evaluation',
					sections: [{ heading: 'Details', content: '**Records** 42\n**Time** 28.375' }],
					button: body.kind === 'page' ? `page:${body.id % 256}` : null,
					thumbnail: body.kind === 'feed' ? 'https://example.test/level.png' : null,
					filename: null,
				},
			})
		}
		return new Response(null, { status: 404 })
	},
})
