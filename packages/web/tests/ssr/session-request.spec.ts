import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthRequestCookies } from '../../app/composables/useAuthRequestCookies'
import { useSessionRequest } from '../../app/composables/useSessionRequest'

const old = 'zeepcentral_steam_id=76561198000000000; zeepcentral_refresh_token=old; preference=dark'
const next = [
	'zeepcentral_access_token=new-access; Path=/; HttpOnly',
	'zeepcentral_refresh_token=new-refresh; Path=/; HttpOnly',
	'zeepcentral_steam_id=76561198000000000; Path=/',
]
const data = { user: { id: 1 }, isAdmin: true, refreshAt: 2_000_000_000_000 }

function setup() {
	const issued = { value: ['preference=dark; Path=/'] }
	const cache = { value: '' }
	vi.stubGlobal('useRequestHeaders', () => ({ cookie: old }))
	vi.stubGlobal('useResponseHeader', (name: string) => (name === 'set-cookie' ? issued : cache))
	const raw = vi.fn().mockImplementation(async (_url, options) => {
		const headers = new Headers()
		if (options.headers.cookie.includes('refresh_token=old')) {
			for (const cookie of next) headers.append('set-cookie', cookie)
		}
		return { _data: data, headers }
	})
	vi.stubGlobal('$fetch', { raw })
	return { issued, cache, raw }
}

afterEach(() => vi.unstubAllGlobals())

describe('SSR rotation cookies', () => {
	it('reuses rotated tuple across root, admin and authenticated page requests', async () => {
		const flow = setup()
		const graphql = useAuthRequestCookies()
		expect(await useSessionRequest()()).toEqual(data)
		expect(await useSessionRequest()()).toEqual(data)
		expect(flow.raw.mock.calls[1]?.[1]?.headers.cookie).toBe(
			'zeepcentral_steam_id=76561198000000000; zeepcentral_refresh_token=new-refresh; preference=dark; zeepcentral_access_token=new-access',
		)
		expect(graphql.headers()?.cookie).toBe(flow.raw.mock.calls[1]?.[1]?.headers.cookie)
		expect(flow.issued.value).toEqual(['preference=dark; Path=/', ...next])
		expect(flow.cache.value).toBe('private, no-store')
	})

	it('does not share cookies between SSR requests', async () => {
		setup()
		const first = useSessionRequest()
		await first()
		const second = setup()
		await useSessionRequest()()
		expect(second.raw.mock.calls[0]?.[1]?.headers.cookie).toContain('refresh_token=old')
	})
})
