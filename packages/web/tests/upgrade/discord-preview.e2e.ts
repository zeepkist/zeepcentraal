import { expect } from '@playwright/test'
import { test } from '../support/browser'

const crawlerHeaders = {
	accept: 'text/html',
	'user-agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
}

function payloadFromHtml(html: string) {
	const scripts = [
		...html.matchAll(/<script\b[^>]*\bid="discord:component-embed"[^>]*>([\s\S]*?)<\/script>/g),
	]
	expect(scripts).toHaveLength(1)
	const serialized = scripts[0]?.[1] ?? ''
	expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThanOrEqual(3000)
	const payload = JSON.parse(serialized)
	expect(Object.keys(payload)).toEqual(['component'])
	expect(payload.component.type).toBe(17)
	expect(html).toMatch(/property="og:title"/)
	expect(html).toMatch(/property="og:description"/)
	expect(html).toMatch(/property="og:image"/)
	return payload
}

test('crawler receives component previews across public page families', async ({ request }) => {
	test.setTimeout(180_000)
	for (const path of [
		'/',
		'/levels',
		'/level/fixture-hydration-level',
		'/users',
		'/records',
		'/record/9001',
		'/super-league',
		'/adventure',
		'/adventure/a',
		'/super-league/season-777',
		'/super-league/season-777/round-1',
		'/super-league/season-777/round-1/level-777',
		'/super-league/season-777/round-1/votes',
		'/super-league/vote?roundId=777',
		'/super-league/submit-level?roundId=777',
		'/totd/2026-11-11',
		'/totw/2026-w01',
		'/totm/2026-01',
		'/workshop/777',
		'/user/76561198000000777',
		'/totd',
		'/totw',
		'/totm',
		'/totd/overall',
		'/totw/overall',
		'/totm/overall',
		'/lobby',
		'/lobby/history',
		'/lobby/stats',
		'/workshop',
		'/mods',
		'/mod/zeepkist-gtr',
		'/cosmetics',
		'/cosmetic/1',
		'/wiki',
		'/developer',
		'/developer/graphql',
		'/playlist',
		'/support',
		'/privacy',
		'/terms',
	]) {
		const response = await request.get(path, { headers: crawlerHeaders })
		expect(response.status(), path).toBe(200)
		payloadFromHtml(await response.text())
	}
})

test('detail previews include native placements and relevant links without viewer rows', async ({
	request,
}) => {
	for (const path of [
		'/level/fixture-hydration-level',
		'/super-league/season-777',
		'/super-league/season-777/round-1',
		'/super-league/season-777/round-1/level-777',
		'/totd/2026-11-11',
		'/totw/2026-w01',
		'/totm/2026-01',
		'/adventure',
		'/adventure/a',
	]) {
		const response = await request.get(path, { headers: crawlerHeaders })
		expect(response.status(), path).toBe(200)
		const preview = JSON.stringify(payloadFromHtml(await response.text()))
		expect(preview, path).toContain('Preview player 1')
		expect(preview, path).toContain('Preview player 3')
		expect(preview, path).not.toContain('PRIVATE PINNED PLAYER')
		if (path.startsWith('/tot')) expect(preview).toContain('Overall standings')
	}
})

test('overall previews preserve ties, filters and pagination in SSR', async ({ request }) => {
	for (const root of ['totd', 'totw', 'totm']) {
		const first = payloadFromHtml(
			await (await request.get(`/${root}/overall`, { headers: crawlerHeaders })).text(),
		)
		const initial = JSON.stringify(first)
		expect(initial).toContain('#1 [')
		expect(initial).toContain('player 1')
		expect(initial).toContain('player 2')
		expect(initial).toContain('#3 [')
		for (const query of ['overallAfter=overall-50', 'overallLast=1']) {
			const response = await request.get(`/${root}/overall?${query}&utm_source=discord`, {
				headers: crawlerHeaders,
			})
			const text = JSON.stringify(payloadFromHtml(await response.text()))
			expect(text).toContain('#51 ')
			expect(text).toContain('player 51')
			expect(text).not.toContain('player 1]')
			expect(text).toContain(query)
			expect(text).not.toContain('utm_source')
		}
		const backward = JSON.stringify(
			payloadFromHtml(
				await (
					await request.get(`/${root}/overall?overallBefore=overall-51`, {
						headers: crawlerHeaders,
					})
				).text(),
			),
		)
		expect(backward).toContain('player 1')
		expect(backward).not.toContain('player 51')
		expect(backward).toContain('overallBefore=overall-51')
	}
	const response = await request.get('/mods?q=Timer&sort=name-asc&page=1&essential=1', {
		headers: crawlerHeaders,
	})
	const preview = JSON.stringify(payloadFromHtml(await response.text()))
	expect(preview).toContain('q=Timer')
	expect(preview).toContain('sort=name-asc')
	expect(preview).toContain('essential=1')
})

test('participation previews use public contest data while anonymous', async ({ request }) => {
	for (const activity of ['vote', 'submit-level']) {
		const response = await request.get(`/super-league/${activity}?roundId=777`, {
			headers: crawlerHeaders,
		})
		const text = JSON.stringify(payloadFromHtml(await response.text()))
		expect(text).toContain('Preview contest')
		expect(text).toContain('roundId=777')
		expect(text).not.toContain('selfAuthored')
		expect(text).not.toContain('votes":')
	}
})

test('private and missing routes never emit component previews', async ({ request }) => {
	for (const path of [
		'/settings',
		'/settings/discord',
		'/records/me',
		'/admin/ghost-validation',
		'/not-a-real-route',
		'/record/invalid',
	]) {
		const response = await request.get(path, { headers: crawlerHeaders, maxRedirects: 0 })
		expect(await response.text(), path).not.toContain('id="discord:component-embed"')
	}
})

test('browser navigation updates preview and clears it on private routes', async ({ page }) => {
	await page.goto('/totw/overall')
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
	const preview = page.locator('script[id="discord:component-embed"]')
	await expect(preview).toHaveCount(1)
	await page.getByRole('button', { name: 'Next', exact: true }).click()
	await expect(page).toHaveURL(/overallAfter=/)
	await expect.poll(() => preview.textContent()).toContain('player 51')
	await page.getByRole('link', { name: 'Current Event', exact: true }).click()
	await expect(preview).toHaveCount(1)
	await expect.poll(() => preview.textContent()).not.toContain('player 51')
	await expect.poll(() => preview.textContent()).toContain('Overall standings')
	await page.locator('a[href="/privacy"]').first().click()
	await expect(preview).toHaveCount(1)
	await expect.poll(() => preview.textContent()).not.toContain('Overall standings')
	await page.evaluate(async () => {
		const app = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: {
				config: {
					globalProperties: { $router: { push: (path: string) => Promise<unknown> } }
				}
			}
		}
		await app.__vue_app__?.config.globalProperties.$router.push('/settings')
	})
	await expect(page).toHaveURL(/\/settings$/)
	await expect(preview).toHaveCount(0)
})
