import { expect, type Page } from '@playwright/test'
import { test } from '../support/browser'

async function openSignText(page: Page) {
	await page.goto('/wiki/level-editor/sign-text')
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
}

test('lists sprites individually and copies complete grids with double line spacing', async ({
	page,
	context,
	browserName,
}) => {
	test.skip(browserName !== 'chromium', 'Native clipboard permissions require Chromium')
	await context.grantPermissions(['clipboard-read', 'clipboard-write'])
	await openSignText(page)
	const groups = page
		.getByRole('group')
		.filter({ has: page.getByRole('button', { name: /grid for game/ }) })
	await expect(groups).toHaveCount(8)
	let total = 0
	for (const group of await groups.all()) {
		const list = await group.locator('pre code').textContent()
		const sprites = list?.trim().split('\n') ?? []
		expect(sprites.length).toBeGreaterThan(0)
		for (const sprite of sprites) expect(sprite).toMatch(/^<sprite="[^"]+" name="[^"]+">$/)
		total += sprites.length
		await group.getByRole('button', { name: /grid for game/ }).click()
		await expect(group.getByRole('status')).toHaveText('Grid copied')
		await expect(group.getByRole('status')).toHaveClass('sr-only')
		await expect(group.getByRole('button', { name: /grid for game/ })).toHaveText('Grid copied')
		const grid = await page.evaluate(() => navigator.clipboard.readText())
		expect(grid).toMatch(/^<align=left><line-height=200%>/)
		expect(grid).toMatch(/<\/line-height><\/align>$/)
		expect(grid.match(/<sprite\b[^>]*>/g)).toEqual(sprites)
		const rows = grid.split('\n')
		expect(rows).toHaveLength(Math.ceil(sprites.length / 4))
		for (const [index, row] of rows.entries()) {
			const columns = Math.min(4, sprites.length - index * 4)
			expect(row.match(/<pos=\d+em>/g)).toEqual(
				Array.from({ length: columns }, (_, column) => `<pos=${column * 4}em>`),
			)
		}
	}
	expect(total).toBe(86)
})

test('keeps copied feedback while another clipboard write is pending', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText: () => Promise.resolve() },
		})
	})
	await openSignText(page)
	const group = page.getByRole('group', { name: 'zeepkist', exact: true })
	const button = group.getByRole('button', { name: /grid for game/ })
	await button.click()
	await expect(button).toHaveText('Grid copied')
	await page.evaluate(() => {
		Object.defineProperty(navigator, 'clipboard', {
			value: {
				writeText: () =>
					new Promise<void>((resolve) => {
						document.documentElement.dataset.gridCopyPending = 'true'
						window.addEventListener('finish-grid-copy', () => resolve(), { once: true })
					}),
			},
		})
	})
	await button.click()
	await expect(page.locator('html')).toHaveAttribute('data-grid-copy-pending', 'true')
	await expect(button).toHaveText('Grid copied')
	await expect(group.getByRole('status')).toHaveText('Grid copied')
	await page.evaluate(() => window.dispatchEvent(new Event('finish-grid-copy')))
	await expect(button).toHaveText('Grid copied')
})

test('resets copied feedback three seconds after the latest successful copy', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: () => Promise.resolve() },
		})
	})
	await openSignText(page)
	await page.clock.install()
	await page.clock.pauseAt(Date.now() + 1000)
	const group = page.getByRole('group', { name: 'zeepkist', exact: true })
	const button = group.getByRole('button', { name: /grid for game/ })
	await button.click()
	await expect(button).toHaveText('Grid copied')
	await page.clock.fastForward(2000)
	await button.click()
	await page.clock.fastForward(2999)
	await expect(button).toHaveText('Grid copied')
	await page.clock.fastForward(1)
	await expect(button).toHaveText('Copy grid for game')
	await expect(group.getByRole('status')).toBeEmpty()
})

test('reports clipboard failure and allows retry', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText: () => Promise.reject(new Error('Clipboard denied')) },
		})
	})
	await openSignText(page)
	const group = page.getByRole('group', { name: 'zeepkist', exact: true })
	await group.getByRole('button', { name: /grid for game/ }).click()
	await expect(group.getByRole('status')).toHaveText(
		'Could not copy. Allow clipboard access and try again.',
	)
	await expect(group.getByRole('status')).not.toHaveClass(/sr-only/)
	await expect(group.getByRole('button', { name: /grid for game/ })).toHaveText(
		'Copy grid for game',
	)
	await page.evaluate(() => {
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: () => Promise.resolve() },
		})
	})
	await group.getByRole('button', { name: /grid for game/ }).click()
	await expect(group.getByRole('status')).toHaveText('Grid copied')
})
