import { type BrowserContext, expect, type Page } from '@playwright/test'
import { webAuthCookieNames } from '../../shared/authCookies'
import { test } from '../support/browser'

const fixture = 'http://127.0.0.1:4199'
async function seed(context: BrowserContext, options: Record<string, unknown> = {}) {
	const result = await context.request.post(`${fixture}/__test/seed`, { data: options })
	expect(result.ok()).toBe(true)
	return result.json() as Promise<{ access: string; refresh: string }>
}
async function state(context: BrowserContext) {
	return (await context.request.get(`${fixture}/__test/state`)).json() as Promise<{
		attempts: number
		rotations: number
	}>
}
async function hydrated(page: Page) {
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
}
async function signedIn(page: Page) {
	await hydrated(page)
	await expect(page.getByRole('button', { name: 'Account', exact: true })).toBeVisible()
}

async function reloadPage(page: Page) {
	// Match upgrade/mods.e2e.ts: Firefox Page.reload can abort despite a successful navigation.
	await Promise.all([
		page.waitForEvent('domcontentloaded'),
		page.evaluate(() => window.location.reload()),
	])
	await hydrated(page)
}

for (const mode of ['expired', 'missing'] as const) {
	test(`reload restores ${mode} access cookie through SSR and persists rotation`, async ({
		page,
		context,
	}) => {
		const initial = await seed(context, mode === 'expired' ? { ttl: -1 } : { missing: true })
		const response = await page.goto('/terms')
		const html = await response?.text()
		expect(html).toContain('aria-label="Account"')
		expect(html).not.toContain(initial.refresh)
		expect(response?.headers()['cache-control']).toContain('no-store')
		await signedIn(page)
		const cookies = await context.cookies()
		for (const cookie of cookies.filter(({ name }) =>
			['zeepcentral_access_token', 'zeepcentral_refresh_token'].includes(name),
		)) {
			expect(html).not.toContain(cookie.value)
		}
		expect(cookies.find(({ name }) => name === 'zeepcentral_refresh_token')?.value).not.toBe(
			initial.refresh,
		)
		expect(cookies.find(({ name }) => name === 'zeepcentral_access_token')?.httpOnly).toBe(true)
		expect(await state(context)).toEqual({ attempts: 1, rotations: 1 })
		await reloadPage(page)
		await signedIn(page)
		expect(await state(context)).toEqual({ attempts: 1, rotations: 1 })
	})
}

test('persistent refresh cookies restore session in new browser context', async ({
	page,
	context,
	browser,
}) => {
	await seed(context, { missing: true })
	const saved = await context.storageState()
	const restarted = await browser.newContext({ storageState: saved })
	try {
		const restored = await restarted.newPage()
		await restored.goto('/terms')
		await signedIn(restored)
		expect(await state(restarted)).toEqual({ attempts: 1, rotations: 1 })
	} finally {
		await restarted.close()
	}
	// Keep shared browser runtime fixture on its original page.
	await page.goto('/terms')
})

test('root and admin checks share rotated cookies in one SSR navigation', async ({
	page,
	context,
}) => {
	await seed(context, { missing: true })
	await page.goto('/admin/ghost-validation')
	await signedIn(page)
	await expect(page).toHaveURL('/admin/ghost-validation')
	expect(await state(context)).toEqual({ attempts: 1, rotations: 1 })
})

test('overdue session recovers on resume with overlapping lifecycle events', async ({
	page,
	context,
}) => {
	await seed(context, { ttl: 120 })
	await page.goto('/terms')
	await signedIn(page)
	await page.clock.install()
	await page.clock.setSystemTime(Date.now() + 180_000)
	await page.evaluate(() => {
		window.dispatchEvent(new Event('focus'))
		window.dispatchEvent(new Event('pageshow'))
		document.dispatchEvent(new Event('visibilitychange'))
		window.dispatchEvent(new Event('online'))
	})
	await expect.poll(async () => (await state(context)).rotations).toBe(1)
	await signedIn(page)
	expect(await state(context)).toEqual({ attempts: 1, rotations: 1 })
	await reloadPage(page)
	await signedIn(page)
})

for (const invalid of ['expired', 'revoked', 'mismatched', 'banned']) {
	test(`rejects ${invalid} refresh credentials`, async ({ page, context }) => {
		await seed(context, { missing: true, invalid })
		await page.goto('/terms')
		await hydrated(page)
		await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
		expect((await state(context)).rotations).toBe(0)
	})
}

test('failed refresh shows signed out and retains refresh cookie', async ({ page, context }) => {
	const initial = await seed(context, { ttl: -1, fail: true })
	await page.goto('/terms')
	await hydrated(page)
	await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
	expect(
		(await context.cookies()).find(({ name }) => name === 'zeepcentral_refresh_token')?.value,
	).toBe(initial.refresh)
	expect((await state(context)).rotations).toBe(0)
})

test('logout waits for delayed rotation, then clears all auth cookies', async ({
	page,
	context,
}) => {
	await seed(context, { ttl: 120, delay: 1500 })
	await page.goto('/terms')
	await signedIn(page)
	await page.getByRole('button', { name: 'Account', exact: true }).click()
	await page.clock.install()
	await page.clock.setSystemTime(Date.now() + 180_000)
	const refreshing = page.waitForRequest('**/api/auth/refresh')
	await page.evaluate(() => window.dispatchEvent(new Event('online')))
	await refreshing
	const logout = page.waitForResponse('**/api/auth/logout')
	await page.getByRole('menuitem', { name: 'Log out', exact: true }).click()
	await logout
	await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
	await expect
		.poll(async () =>
			(await context.cookies()).filter(({ name }) =>
				webAuthCookieNames.some((cookieName) => cookieName === name),
			),
		)
		.toEqual([])
	await page.goto('/terms')
	await hydrated(page)
	await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
})
