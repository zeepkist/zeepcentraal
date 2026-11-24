import { type BrowserContext, expect, type Page } from '@playwright/test'
import { webAuthCookieNames } from '../../shared/authCookies'
import { ghostPlaybackLzma } from '../fixtures/ghostPlayback'
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

test('regular accounts and guests do not get admin navigation', async ({ page, context }) => {
	await page.goto('/terms')
	await hydrated(page)
	await page.getByRole('button', { name: 'Sign in', exact: true }).click()
	await expect(page.getByRole('menuitem', { name: 'Sign in with Steam' })).toBeVisible()
	await expect(page.getByRole('menuitem', { name: 'Admin', exact: true })).toHaveCount(0)

	await seed(context, { role: 'user' })
	await page.goto('/terms')
	await signedIn(page)
	await page.getByRole('button', { name: 'Account', exact: true }).click()
	await expect(page.getByRole('menuitem', { name: 'Language' })).toBeVisible()
	await expect(page.getByRole('menuitem', { name: 'Admin', exact: true })).toHaveCount(0)
})

for (const device of [
	{ width: 1440, height: 900, theme: 'light' },
	{ width: 390, height: 844, theme: 'dark' },
] as const) {
	test(`admin pages support editing and review at ${device.width}px in ${device.theme} mode`, async ({
		page,
		context,
		baseURL,
	}) => {
		test.setTimeout(120_000)
		if (!baseURL) throw new Error('Auth fixture requires a base URL')
		await page.setViewportSize({ width: device.width, height: device.height })
		await seed(context)
		await context.addCookies([{ name: 'colour_mode', value: device.theme, url: baseURL }])
		const report = {
			status: 'pass',
			reasons: ['Fixture comparison'],
			matchedGroups: [],
			missingGroups: [],
			validatorVersion: 'fixture',
		}
		await page.route('**/api/admin/ghost-validation**', async (route) => {
			const { pathname, searchParams } = new URL(route.request().url())
			const json = pathname.endsWith('/audit')
				? { queued: true }
				: pathname.endsWith('/compare')
					? { report }
					: pathname.endsWith('/ghost')
						? { ghost: ghostPlaybackLzma.toString('base64') }
						: pathname.endsWith('/records/9002')
							? {
									record: {
										id: 9002,
										levelId: 51,
										time: 42,
										steamId: '76561198000000000',
										hash: 'fixture',
									},
									snapshots: [
										{
											snapshot: {
												id: 51,
												canonicalHash: 'Fixture snapshot',
												blocks: [],
											},
											overlays: [],
										},
									],
								}
							: {
									attempts:
										searchParams.get('after') === '9001'
											? []
											: [
													{
														id: '9001',
														id_record: 9002,
														status: 'pass',
														updated_at: '2027-07-04',
														validator_version: 'fixture',
														report,
													},
												],
								}
			await route.fulfill({ json })
		})
		await page.route('**/api/admin/zsl', (route) =>
			route.request().method() === 'POST'
				? route.fulfill({ json: { id: 51 } })
				: route.continue(),
		)
		await page.route('**/api/admin/zsl/rounds/51/playlists', (route) =>
			route.fulfill({
				json:
					route.request().method() === 'POST'
						? { revision: 3 }
						: {
								alerts: [],
								tournamentPinned: true,
								playlists: [
									{
										kind: 'practice',
										state: 'failed',
										selectedRevision: 2,
										verifiedRevision: 1,
										playlistErrors: ['Fixture diagnostic'],
										pendingCandidates: [],
										rejectedCandidates: [],
										levels: [
											{
												position: 1,
												name: 'Exact Track',
												workshopId: '42',
												uid: 'exact-track',
												xxHash: 'A'.repeat(32),
												state: 'pending',
												stage: 'Awaits verification after retry',
											},
											{
												position: 2,
												name: 'Missing Track',
												workshopId: '42',
												uid: 'missing-track',
												state: 'failed',
												stage: 'Host payload corrupt',
											},
										],
										verifiedLevels: [
											{
												position: 1,
												name: 'Fixture Track',
												workshopId: '42',
												uid: 'fixture-track',
												state: 'ready',
												stage: 'Payload verified by host',
											},
										],
									},
									{
										kind: 'warmup',
										state: 'failed',
										selectedRevision: 3,
										verifiedRevision: null,
										playlistErrors: [],
										pendingCandidates: [],
										levels: [],
										verifiedLevels: [],
										rejectedCandidates: [
											{
												position: 1,
												name: 'Rejected Track',
												workshopId: '43',
												uid: 'rejected-track',
												state: 'failed',
												stage: 'Workshop UID missing',
											},
										],
									},
								],
							},
			}),
		)
		await page.goto('/terms')
		await signedIn(page)
		const account = page.getByRole('button', { name: 'Account', exact: true })
		await account.press('Enter')
		await page.getByRole('menuitem', { name: 'Admin', exact: true }).press('ArrowRight')
		await expect(page.getByRole('menuitem', { name: 'Ghost Validation' })).toBeVisible()
		await page.getByRole('menuitem', { name: 'ZSL Management' }).press('Enter')
		await expect(
			page.getByRole('heading', { name: 'ZSL Management', exact: true }),
		).toBeVisible()
		await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${device.theme}\\b`))

		await page.getByRole('tab', { name: 'Points structures' }).click()
		await page.getByRole('button', { name: 'Fixture Points' }).click()
		await page.getByRole('button', { name: 'Copy structure' }).click()
		await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveValue(
			'Fixture Points (copy)',
		)
		await page.getByRole('tab', { name: 'Rounds' }).click()
		await page.getByRole('button', { name: 'Fixture Round' }).click()
		await expect(page.getByRole('textbox', { name: 'Timeslot 1 start' })).toHaveValue(
			'2027-07-04T18:00:00+01:00',
		)
		await page.getByRole('textbox', { name: /^Name/ }).fill('Edited Round')
		const save = page.waitForRequest(
			(request) => request.url().endsWith('/api/admin/zsl') && request.method() === 'POST',
		)
		await page.getByRole('button', { name: 'Save', exact: true }).click()
		expect((await save).postDataJSON()).toMatchObject({
			id: 51,
			version: 'fixture-version',
			settings: {
				name: 'Edited Round',
				eventDate: '2027-07-04T17:00:00Z',
				seasonId: 1,
				number: 1,
				workshopId: '9007199254740993',
			},
		})
		await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
		await page.getByRole('button', { name: 'Reload settings' }).click()
		await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveValue('Fixture Round')
		await expect(page.getByText('Tournament revision locked')).toBeVisible()
		await expect(page.getByText('Fixture diagnostic')).toBeVisible()
		await expect(page.getByText('1 Pending', { exact: true })).toBeVisible()
		await expect(page.getByText('1 Failed', { exact: true })).toBeVisible()
		const selected = page
			.getByRole('region', { name: 'Selected play order' })
			.filter({ hasText: 'Exact Track' })
		const rows = selected.getByRole('listitem')
		await expect(rows.nth(0)).toContainText('Pending')
		await expect(rows.nth(0)).toContainText('Awaits verification after retry')
		await expect(rows.nth(1)).toContainText('Failed')
		await expect(rows.nth(1)).toContainText('Host payload corrupt')
		await expect(selected).not.toContainText('Rejected Track')
		await expect(
			page.getByRole('region', { name: 'Rejected warmup candidates' }),
		).toContainText('Rejected Track')

		const exact = rows.nth(0).getByRole('link', { name: /Exact Track/ })
		const workshop = rows.nth(1).getByRole('link', { name: /^Steam Workshop/ })
		const exactPath = `/level/${'A'.repeat(32)}`
		const workshopUrl = 'https://steamcommunity.com/sharedfiles/filedetails/?id=42'
		await expect(exact).toHaveAttribute('href', exactPath)
		await expect(workshop).toHaveAttribute('href', workshopUrl)
		await expect(exact).toHaveAttribute('target', '_blank')
		await expect(workshop).toHaveAttribute('target', '_blank')
		await exact.focus()
		await page.keyboard.press('Tab')
		await expect(workshop).toBeFocused()
		await expect(workshop).toHaveCSS('outline-style', 'solid')
		await page.keyboard.press('Shift+Tab')
		await expect(exact).toBeFocused()
		await expect(exact).toHaveCSS('outline-style', 'solid')

		await context.route(`**${exactPath}`, (route) => route.fulfill({ body: 'Level page' }))
		await context.route(workshopUrl, (route) => route.fulfill({ body: 'Steam Workshop item' }))
		for (const [link, url] of [
			[exact, `http://127.0.0.1:4173${exactPath}`],
			[workshop, workshopUrl],
		] as const) {
			const popup = context.waitForEvent('page')
			await link.press('Enter')
			const tab = await popup
			await expect(tab).toHaveURL(url)
			await tab.close()
		}

		const previous = page
			.locator('details')
			.filter({ hasText: 'Previous verified play order #1' })
		await expect(previous.getByText('Fixture Track', { exact: true })).toBeHidden()
		await previous.locator('summary').press('Enter')
		await expect(previous.getByText('Fixture Track', { exact: true })).toBeVisible()
		await expect(previous.getByText('Ready', { exact: true })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Upload tournament playlist' })).toHaveCount(
			0,
		)
		const playlist = '{"levels":[]}'
		await page.locator('input[type=file]').setInputFiles({
			name: 'fixture.zeeplist',
			mimeType: 'application/json',
			buffer: Buffer.from(playlist),
		})
		const upload = page.waitForRequest(
			(request) => request.url().endsWith('/playlists') && request.method() === 'POST',
		)
		await page.getByRole('button', { name: 'Upload practice playlist' }).click()
		expect((await upload).postDataJSON()).toEqual({
			action: 'uploadPractice',
			source: playlist,
		})
		await expect(
			page.getByRole('status').filter({ hasText: 'Preparation queued' }),
		).toBeVisible()
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			device.width,
		)

		await account.click()
		await page.getByRole('menuitem', { name: 'Admin', exact: true }).press('ArrowRight')
		await page.getByRole('menuitem', { name: 'Ghost Validation' }).click()
		await expect(
			page.getByRole('heading', { name: 'Ghost Validation', exact: true }),
		).toBeVisible()
		const table = page.getByRole('region', { name: 'Validation results table' })
		await expect(table.getByRole('cell', { name: '9002', exact: true })).toBeVisible()
		if (device.width === 390) {
			expect(
				await table.evaluate((element) => element.scrollWidth > element.clientWidth),
			).toBe(true)
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			device.width,
		)
		const exportCsv = page.waitForEvent('download')
		await page.getByRole('button', { name: 'Export loaded CSV' }).click()
		expect((await exportCsv).suggestedFilename()).toBe('ghost-validation.csv')
		await table.getByRole('button', { name: 'Compare', exact: true }).click()
		await page.getByRole('button', { name: 'Compare selected version' }).click()
		await expect(
			page.getByRole('status').filter({ hasText: 'Fixture comparison' }),
		).toBeVisible()
		await page.getByRole('button', { name: 'Play', exact: true }).click({ timeout: 20_000 })
		await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
		await page.getByRole('spinbutton', { name: 'Record ID' }).fill('9002')
		const audit = page.waitForRequest(
			(request) => request.url().endsWith('/audit') && request.method() === 'POST',
		)
		await page.getByRole('button', { name: 'Queue audit', exact: true }).click()
		expect((await audit).postDataJSON()).toEqual({ idRecord: 9002 })
		await expect(page.getByRole('status').filter({ hasText: 'Audit queued' })).toBeVisible()
	})
}

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

test('two tabs share one refresh rotation and both remain signed in', async ({ page, context }) => {
	await seed(context, { ttl: 120, delay: 1500 })
	const peer = await context.newPage()
	try {
		for (const tab of [page, peer]) {
			await tab.goto('/terms')
			await signedIn(tab)
			await tab.clock.install()
			await tab.clock.setSystemTime(Date.now() + 180_000)
		}
		for (const tab of [page, peer]) {
			await tab.bringToFront()
			await tab.evaluate(() => window.dispatchEvent(new Event('online')))
		}
		for (const tab of [page, peer]) {
			await tab.waitForFunction(
				(minimum) => {
					const root = document.querySelector('#__nuxt') as Element & {
						__vue_app__?: {
							config: {
								globalProperties: {
									$nuxt?: { payload: { state: Record<string, unknown> } }
								}
							}
						}
					}
					const deadline =
						root?.__vue_app__?.config.globalProperties.$nuxt?.payload.state[
							'$ssession-refresh-at'
						]
					return typeof deadline === 'number' && deadline > minimum
				},
				Date.now() + 300_000,
				{ timeout: 10_000 },
			)
			await signedIn(tab)
		}
		expect(await state(context)).toEqual({ attempts: 1, rotations: 1 })
	} finally {
		await peer.close()
	}
})

test('concurrent tab reloads recover after single-use SSR rotation', async ({ page, context }) => {
	await seed(context, { missing: true, delay: 1500, responseDelay: 750 })
	const peer = await context.newPage()
	try {
		await Promise.all([page.goto('/terms'), peer.goto('/terms')])
		await Promise.all([signedIn(page), signedIn(peer)])
		expect((await state(context)).rotations).toBe(1)
	} finally {
		await peer.close()
	}
})

test('logout in one tab waits for another tab rotation and signs both out', async ({
	page,
	context,
}) => {
	await seed(context, { ttl: 120, delay: 1500 })
	const peer = await context.newPage()
	try {
		await page.goto('/terms')
		await peer.goto('/terms')
		await Promise.all([signedIn(page), signedIn(peer)])
		await page.getByRole('button', { name: 'Account', exact: true }).click()
		await peer.clock.install()
		await peer.clock.setSystemTime(Date.now() + 180_000)
		const rotating = peer.waitForRequest('**/api/auth/refresh')
		await peer.bringToFront()
		await peer.evaluate(() => window.dispatchEvent(new Event('online')))
		await rotating
		const logout = page.waitForResponse('**/api/auth/logout')
		await page.getByRole('menuitem', { name: 'Log out', exact: true }).click()
		await logout
		for (const tab of [page, peer]) {
			await expect(tab.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
		}
		await reloadPage(peer)
		await expect(peer.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
	} finally {
		await peer.close()
	}
})
