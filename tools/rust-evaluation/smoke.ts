export {}

// Local fixture only; never uses production credentials or GraphQL.
const base = process.argv[2] ?? 'http://127.0.0.1:4310'
const url = new URL(base)
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
	throw new Error('Preview smoke requires local HTTP URL')
}
const check = (value: unknown, message: string) => {
	if (!value) throw new Error(message)
}
for (const path of ['/healthz', '/docs', '/docs/scalar.js', '/openapi.json']) {
	const response = await fetch(`${base}${path}`)
	check(response.ok, `${path}: ${response.status}`)
	if (path === '/docs') {
		const html = await response.text()
		check(html.includes('/docs/scalar.js'), 'Scalar must use local assets')
		check(!html.includes('cdn.jsdelivr.net'), 'Scalar must work offline')
	}
	if (path === '/docs/scalar.js')
		check((await response.text()).length > 100_000, 'Missing Scalar bundle')
}
const spec = await fetch(`${base}/openapi.json`).then((r) => r.json())
check(spec.paths['/evaluation/record'].post.responses['204'], 'Missing transaction contract')
check(spec.components.schemas.User.properties.steamId, 'Schema must use Serde field casing')
for (const path of ['/graphql', '/graphql/ws', '/admin', '/api/level']) {
	check((await fetch(`${base}${path}`)).status === 404, `Removed surface still exposed: ${path}`)
}
check(
	(await fetch(`${base}/evaluation/user/0`).then((r) => r.json())) === null,
	'Missing user contract',
)
const user = await fetch(`${base}/evaluation/user/76561198000000001`).then((r) => r.json())
check(user.steamId === '76561198000000001', 'User payload mismatch')
const submit = (body: unknown) =>
	fetch(`${base}/evaluation/record`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
check((await submit({ user: 1, level: 1, time: -1 })).status === 400, 'Invalid time accepted')
check(
	(await submit({ user: -1, level: 1, time: 28 })).status === 500,
	'Foreign key failure contract',
)
const written = await submit({ user: 1, level: 1, time: 28.375 })
check(written.status === 204 && (await written.text()) === '', 'Write must return empty 204')
check(
	Array.isArray(await fetch(`${base}/evaluation/leaderboard/1`).then((r) => r.json())),
	'Leaderboard failed',
)
check(
	(await fetch(`${base}/healthz`, { headers: { Origin: 'https://example.org' } })).status === 403,
	'Foreign origin allowed',
)
console.log('Standalone REST, Scalar assets, OpenAPI and response contracts passed')
