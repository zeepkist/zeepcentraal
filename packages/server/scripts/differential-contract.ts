type Comparison = 'exact' | 'json-shape' | 'sse-json-shape'

interface ContractCase {
	name: string
	path: string
	method?: string
	headers?: Record<string, string>
	body?: unknown
	comparison?: Comparison
}

interface Result {
	status: number
	headers: Record<string, string | null>
	body: unknown
}

const bunBase = requiredUrl('BUN_SERVER_URL')
const rustBase = requiredUrl('RUST_SERVER_URL')
const contractHeaders = ['cache-control', 'content-type', 'location'] as const
const cases: ContractCase[] = [
	{ name: 'health GET', path: '/healthz' },
	{ name: 'health HEAD', path: '/healthz', method: 'HEAD' },
	{ name: 'favicon', path: '/favicon.ico' },
	{ name: 'lobby snapshot', path: '/lobby', comparison: 'json-shape' },
	{ name: 'lobby event stream', path: '/lobby/events', comparison: 'sse-json-shape' },
	{
		name: 'GTR login missing fields',
		path: '/auth/login',
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: {},
	},
	{
		name: 'GTR refresh missing fields',
		path: '/auth/refresh',
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: {},
	},
	{
		name: 'web refresh missing cookies',
		path: '/auth/web/refresh',
		method: 'POST',
	},
	{
		name: 'GTR level request unauthenticated',
		path: '/level/request',
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: { WorkshopId: '3749321871', Hash: '00112233445566778899AABBCCDDEEFF' },
	},
	{
		name: 'GTR record submission unauthenticated',
		path: '/record/submit',
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: {
			Level: 'fixture-level',
			Hash: '00112233445566778899AABBCCDDEEFF',
			Time: 12.345,
			Splits: [1.2, 5.6],
			Speeds: [100, 200],
			GhostData: 'AQAAAAAAAAA=',
			GameVersion: 'fixture',
			ModVersion: 'fixture',
		},
	},
	{
		name: 'web favourite unauthenticated',
		path: '/favourite/add',
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: { hash: '00112233445566778899AABBCCDDEEFF' },
	},
	{
		name: 'web favourite removal unauthenticated',
		path: '/favourite/remove',
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: { hash: '00112233445566778899AABBCCDDEEFF' },
	},
	{
		name: 'web vote unauthenticated',
		path: '/vote/submit',
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: { Hash: '00112233445566778899AABBCCDDEEFF', Value: 1 },
	},
	{
		name: 'GTR Steam name update unauthenticated',
		path: '/user/updateSteamName',
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: { Name: 'Fixture' },
	},
	{
		name: 'Discord ID update unauthenticated',
		path: '/user/updateDiscordId',
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: { Id: '-1' },
	},
	{
		name: 'Discord link code unauthenticated',
		path: '/user/discord/link-code',
		method: 'POST',
	},
	{
		name: 'Discord unlink unauthenticated',
		path: '/user/discord',
		method: 'DELETE',
	},
	{
		name: 'Turnstile invalid request',
		path: '/turnstile/verify',
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: { token: '' },
	},
	{
		name: 'job trigger unauthenticated',
		path: '/job/trigger',
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: { Task: 'fixture', Options: {} },
	},
]

const extraFile = process.env.SERVER_DIFFERENTIAL_FIXTURES
if (extraFile) {
	const extra = (await Bun.file(extraFile).json()) as ContractCase[]
	if (!Array.isArray(extra)) throw new Error('SERVER_DIFFERENTIAL_FIXTURES must contain an array')
	cases.push(...extra)
}

const failures: string[] = []
for (const contract of cases) {
	const [bunResult, rustResult] = await Promise.all([
		execute(bunBase, contract),
		execute(rustBase, contract),
	])
	compare(contract, bunResult, rustResult, failures)
}

if (failures.length > 0) {
	for (const failure of failures) console.error(failure)
	throw new Error(`${failures.length} Bun/Rust contract mismatch(es)`)
}
console.info(`Bun/Rust server contracts match for ${cases.length} unchanged-client requests.`)

async function execute(base: URL, contract: ContractCase): Promise<Result> {
	const response = await fetch(new URL(contract.path, base), {
		method: contract.method,
		headers: expandEnvironment(contract.headers),
		body: contract.body === undefined ? undefined : JSON.stringify(contract.body),
		redirect: 'manual',
		signal: AbortSignal.timeout(15_000),
	})
	const text =
		contract.comparison === 'sse-json-shape'
			? await readFirstServerEvent(response)
			: await response.text()
	let body: unknown = text
	if (text) {
		try {
			body = JSON.parse(text)
		} catch {}
	} else {
		body = null
	}
	return {
		status: response.status,
		headers: Object.fromEntries(contractHeaders.map((name) => [name, response.headers.get(name)])),
		body,
	}
}

function compare(contract: ContractCase, bun: Result, rust: Result, failures: string[]) {
	if (bun.status !== rust.status) {
		failures.push(`${contract.name}: status ${bun.status} != ${rust.status}`)
	}
	for (const name of contractHeaders) {
		if (bun.headers[name] !== rust.headers[name]) {
			failures.push(`${contract.name}: ${name} header differs`)
		}
	}
	const lobbyShape = contract.comparison === 'json-shape' || contract.comparison === 'sse-json-shape'
	const left = lobbyShape ? snapshotShape(bun.body) : stable(bun.body)
	const right = lobbyShape ? snapshotShape(rust.body) : stable(rust.body)
	if (left !== right) failures.push(`${contract.name}: response body differs`)
}

async function readFirstServerEvent(response: Response): Promise<string> {
	if (!response.body) return ''
	const reader = response.body.getReader()
	const decoder = new TextDecoder()
	let buffered = ''
	try {
		while (!buffered.includes('\n\n')) {
			const { done, value } = await reader.read()
			if (done) break
			buffered += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n')
		}
	} finally {
		await reader.cancel()
	}
	const boundary = buffered.indexOf('\n\n')
	if (boundary === -1) throw new Error('Lobby event stream ended before first event')
	const event = buffered.slice(0, boundary)
	if (
		!event
			.split('\n')
			.some((line) => line.startsWith('event:') && line.slice(6).trim() === 'snapshot')
	) {
		throw new Error('Lobby event stream did not start with snapshot event')
	}
	return event
		.split('\n')
		.filter((line) => line.startsWith('data:'))
		.map((line) => line.slice(5).trimStart())
		.join('\n')
}

function snapshotShape(value: unknown): string {
	const snapshot = object(value, 'lobby snapshot')
	exactKeys(snapshot, ['lobbies', 'staleSince', 'stats', 'status', 'updatedAt'], 'lobby snapshot')
	if (!['connecting', 'live', 'stale', 'unavailable'].includes(String(snapshot.status))) {
		throw new Error('Lobby snapshot has invalid status')
	}
	nullableString(snapshot.updatedAt, 'updatedAt')
	nullableString(snapshot.staleSince, 'staleSince')
	const stats = object(snapshot.stats, 'lobby stats')
	exactKeys(stats, ['lobbyCount', 'onlinePlayers', 'playersInLobbies'], 'lobby stats')
	for (const name of ['lobbyCount', 'onlinePlayers', 'playersInLobbies']) {
		if (stats[name] !== null && typeof stats[name] !== 'number') {
			throw new Error(`Lobby stats ${name} must be number or null`)
		}
	}
	if (!Array.isArray(snapshot.lobbies)) throw new Error('Lobby snapshot lobbies must be array')
	for (const [index, entry] of snapshot.lobbies.entries()) {
		const lobby = object(entry, `lobby ${index}`)
		exactKeys(lobby, ['host', 'isPublic', 'playerLimit', 'players', 'title'], `lobby ${index}`)
		if (typeof lobby.title !== 'string' || typeof lobby.isPublic !== 'boolean') {
			throw new Error(`Lobby ${index} has invalid title or visibility`)
		}
		if (typeof lobby.players !== 'number' || typeof lobby.playerLimit !== 'number') {
			throw new Error(`Lobby ${index} has invalid player counts`)
		}
		const host = object(lobby.host, `lobby ${index} host`)
		exactKeys(host, ['name', 'steamId'], `lobby ${index} host`)
		if (typeof host.name !== 'string' || typeof host.steamId !== 'string') {
			throw new Error(`Lobby ${index} has invalid host`)
		}
	}
	return 'lobby-snapshot-v1'
}

function object(value: unknown, name: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${name} must be object`)
	}
	return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, expected: string[], name: string) {
	if (Object.keys(value).toSorted().join(',') !== expected.toSorted().join(',')) {
		throw new Error(`${name} fields differ from wire contract`)
	}
}

function nullableString(value: unknown, name: string) {
	if (value !== null && typeof value !== 'string') {
		throw new Error(`Lobby snapshot ${name} must be string or null`)
	}
}

function stable(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
	if (value && typeof value === 'object') {
		return `{${Object.entries(value)
			.toSorted(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
			.join(',')}}`
	}
	return JSON.stringify(value)
}

function expandEnvironment(headers: Record<string, string> | undefined) {
	if (!headers) return undefined
	return Object.fromEntries(
		Object.entries(headers).map(([name, value]) => [
			name,
			value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, variable: string) => {
				const resolved = process.env[variable]
				if (!resolved) throw new Error(`Missing ${variable} used by differential fixture`)
				return resolved
			}),
		]),
	)
}

function requiredUrl(name: string) {
	const value = process.env[name]
	if (!value) throw new Error(`${name} is required`)
	return new URL(value.endsWith('/') ? value : `${value}/`)
}
