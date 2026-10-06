import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Guard = (to: { path: string }) => Promise<unknown>
const lookup = vi.fn()
const redirect = vi.fn(() => 'redirected')
let guard: Guard
let requestHeaders: { cookie: string } | undefined
let responseCookies: { value: string[] }
function sessionResponse(data: unknown, cookies: string[] = []) {
	const headers = new Headers()
	for (const cookie of cookies) headers.append('set-cookie', cookie)
	return { _data: data, headers }
}

afterEach(() => vi.unstubAllGlobals())

beforeEach(async () => {
	lookup.mockReset()
	redirect.mockClear()
	requestHeaders = undefined
	responseCookies = { value: [] }
	vi.stubGlobal('defineNuxtRouteMiddleware', (middleware: Guard) => middleware)
	vi.stubGlobal('$fetch', { raw: lookup })
	vi.stubGlobal('navigateTo', redirect)
	vi.stubGlobal('useRequestHeaders', () => requestHeaders)
	vi.stubGlobal('useResponseHeader', () => responseCookies)
	guard = (await import('../../app/middleware/admin.global')).default as unknown as Guard
})

describe('admin route access', () => {
	it('does not check public routes', async () => {
		await guard({ path: '/levels' })
		expect(lookup).not.toHaveBeenCalled()
		expect(redirect).not.toHaveBeenCalled()
	})
	it.each(['/admin', '/admin/ghost-validation', '/administrator', '/ADMIN/ghost-validation'])(
		'redirects logged-out and non-admin sessions from %s',
		async (path) => {
			lookup.mockResolvedValue(sessionResponse({ isAdmin: false }))
			expect(await guard({ path })).toBe('redirected')
			expect(redirect).toHaveBeenCalledWith('/', { replace: true })
		},
	)
	it('allows verified admin sessions', async () => {
		lookup.mockResolvedValue(sessionResponse({ isAdmin: true }))
		await guard({ path: '/admin/ghost-validation' })
		expect(lookup).toHaveBeenCalledWith('/api/session', {
			headers: undefined,
			credentials: 'include',
		})
		expect(redirect).not.toHaveBeenCalled()
	})
	it('checks role again on each navigation', async () => {
		lookup.mockResolvedValueOnce(sessionResponse({ isAdmin: true }))
		lookup.mockResolvedValueOnce(sessionResponse({ isAdmin: false }))
		await guard({ path: '/admin/ghost-validation' })
		expect(redirect).not.toHaveBeenCalled()
		await guard({ path: '/admin/ghost-validation' })
		expect(lookup).toHaveBeenCalledTimes(2)
		expect(redirect).toHaveBeenCalledWith('/', { replace: true })
	})
	it.each([undefined, {}, { isAdmin: 'admin' }])(
		'denies incomplete or invalid authorization: %s',
		async (data) => {
			lookup.mockResolvedValue(sessionResponse(data))
			expect(await guard({ path: '/admin/ghost-validation' })).toBe('redirected')
		},
	)
	it('redirects when session verification fails', async () => {
		lookup.mockRejectedValue(new Error('Session unavailable'))
		expect(await guard({ path: '/admin/ghost-validation' })).toBe('redirected')
	})
	it.runIf(import.meta.server)(
		'forwards SSR auth cookies and preserves refreshed response cookies',
		async () => {
			requestHeaders = { cookie: 'access_token=fake' }
			responseCookies.value = ['existing=fake']
			lookup.mockResolvedValue(
				sessionResponse({ isAdmin: true }, [
					'access_token=refreshed; HttpOnly',
					'refresh_token=refreshed; HttpOnly',
				]),
			)
			await guard({ path: '/admin/ghost-validation' })
			expect(lookup).toHaveBeenCalledWith('/api/session', {
				headers: { cookie: 'access_token=fake' },
				credentials: 'include',
			})
			expect(responseCookies.value).toEqual([
				'existing=fake',
				'access_token=refreshed; HttpOnly',
				'refresh_token=refreshed; HttpOnly',
			])
			expect(redirect).not.toHaveBeenCalled()
		},
	)
})
