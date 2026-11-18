import { expect, mock, test } from 'bun:test'
import { createGtrUpdateMessageProvider } from './gtrVersion'

const headers = (version: string) => new Headers({ 'X-GTR-Version': version })
const payload = (minimum: unknown = '1.10.0', latest: unknown = '1.11.0') => ({
	data: { versions: { nodes: [{ minimum, latest }] } },
})

test.each([
	['1.9.0', '1.10.0', true],
	['1.10.0', '1.10.0', false],
	['1.11.0', '1.10.0', false],
	['1.10.0-beta.1', '1.10.0', true],
	['1.11.0-beta.1', '1.10.0', false],
	['1.10.0-beta.2', '1.10.0-beta.10', true],
	['1.10.0+build.7', '1.10.0+build.8', false],
	[' v1.9.0 ', ' v1.10.0 ', true],
])('compares client %s against minimum %s', async (current, minimum, outdated) => {
	const getMessage = createGtrUpdateMessageProvider({
		async handleGraphQLRequest() {
			return Response.json(payload(minimum, ' v1.11.0+build.1 '))
		},
	})
	expect(await getMessage(headers(current))).toBe(
		outdated ? 'Update GTR to 1.11.0+build.1' : undefined,
	)
})

test.each(['', 'invalid', '1.9', '^1.9.0', '01.9.0', '1.9.0-01', '1.9.0, 1.8.0'])(
	'invalid header %s skips version lookup',
	async (version) => {
		const handleGraphQLRequest = mock(async () => Response.json(payload()))
		const getMessage = createGtrUpdateMessageProvider({ handleGraphQLRequest })
		expect(await getMessage(headers(version))).toBeUndefined()
		expect(await getMessage(new Headers())).toBeUndefined()
		expect(handleGraphQLRequest).not.toHaveBeenCalled()
	},
)

test('shares refresh and caches successful lookup for one hour per provider', async () => {
	let now = 0
	const pending = Promise.withResolvers<Response>()
	const handleGraphQLRequest = mock(async () => pending.promise)
	const getMessage = createGtrUpdateMessageProvider({ handleGraphQLRequest }, () => now)
	const requests = [getMessage(headers('1.9.0')), getMessage(headers('1.10.0'))]
	expect(handleGraphQLRequest).toHaveBeenCalledTimes(1)
	pending.resolve(Response.json(payload()))
	expect(await Promise.all(requests)).toEqual(['Update GTR to 1.11.0', undefined])
	const [request, body] = handleGraphQLRequest.mock.calls[0] as unknown as [Request, unknown]
	expect(request.headers.get('X-GTR-Version')).toBeNull()
	expect(body).toEqual({
		operationName: 'ZC_GtrVersions',
		query: 'query ZC_GtrVersions { versions(first: 1, orderBy: ID_ASC) { nodes { minimum latest } } }',
	})

	now = 60 * 60 * 1000 - 1
	expect(await getMessage(headers('1.9.0'))).toBe('Update GTR to 1.11.0')
	expect(handleGraphQLRequest).toHaveBeenCalledTimes(1)
	handleGraphQLRequest.mockImplementation(async () => Response.json(payload('1.12.0', '1.13.0')))
	now += 1
	expect(await getMessage(headers('1.11.0'))).toBe('Update GTR to 1.13.0')
	expect(handleGraphQLRequest).toHaveBeenCalledTimes(2)

	const separate = createGtrUpdateMessageProvider({ handleGraphQLRequest }, () => now)
	await separate(headers('1.9.0'))
	expect(handleGraphQLRequest).toHaveBeenCalledTimes(3)
})

test.each([
	undefined,
	null,
	{},
	{ data: { versions: { nodes: [] } } },
	payload(null),
	payload('invalid'),
	payload('1.10.0', null),
	payload('1.10.0', 'invalid'),
	{ ...payload(), errors: [{ message: 'lookup failed' }] },
])('invalid version data %j leaves names unchanged and retries after 30 seconds', async (data) => {
	let now = 0
	const handleGraphQLRequest = mock(async () => Response.json(data ?? null))
	const getMessage = createGtrUpdateMessageProvider({ handleGraphQLRequest }, () => now)
	expect(await getMessage(headers('1.9.0'))).toBeUndefined()
	now = 29_999
	expect(await getMessage(headers('1.9.0'))).toBeUndefined()
	expect(handleGraphQLRequest).toHaveBeenCalledTimes(1)
	handleGraphQLRequest.mockImplementation(async () => Response.json(payload()))
	now = 30_000
	expect(await getMessage(headers('1.9.0'))).toBe('Update GTR to 1.11.0')
	expect(handleGraphQLRequest).toHaveBeenCalledTimes(2)
})

test.each(['exception', 'http', 'json', 'missing'])(
	'lookup failure %s clears expired versions without rejecting request',
	async (failure) => {
		let now = 0
		const handleGraphQLRequest = mock(
			async (): Promise<Response | null> => Response.json(payload()),
		)
		const getMessage = createGtrUpdateMessageProvider({ handleGraphQLRequest }, () => now)
		expect(await getMessage(headers('1.9.0'))).toBe('Update GTR to 1.11.0')
		handleGraphQLRequest.mockImplementation(async () => {
			if (failure === 'exception') throw new Error('lookup failed')
			if (failure === 'http') return Response.json(payload(), { status: 503 })
			if (failure === 'missing') return null
			return new Response('not JSON')
		})
		now = 60 * 60 * 1000
		expect(await getMessage(headers('1.9.0'))).toBeUndefined()
		expect(await getMessage(headers('1.9.0'))).toBeUndefined()
		expect(handleGraphQLRequest).toHaveBeenCalledTimes(2)
	},
)
