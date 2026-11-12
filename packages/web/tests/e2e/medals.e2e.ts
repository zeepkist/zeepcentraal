import { expect, type Page } from '@playwright/test'
import { MEDALS } from '../../app/utils/medals'
import { test } from '../support/browser'

test.setTimeout(90_000)

for (const path of ['/adventure', '/adventure/a']) {
	test(`Adventure level times show earned medals before PB and WR times on ${path}`, async ({
		page,
	}) => {
		await page.goto(path, { waitUntil: 'domcontentloaded' })
		await waitForHydration(page)
		await page.getByRole('button', { name: 'Show level times for Preview player 1' }).click()
		const details = page.getByTestId('adventure-player-levels')
		const rows = details.locator('tr[data-adventure-level]')
		await expect(rows).toHaveCount(path === '/adventure' ? 4 : 2)
		for (const [id, pb, wr] of [
			[9201, 'Bronze', 'Apex'],
			[9202, 'Silver', 'Expert'],
		] as const) {
			const row = details.locator(`tr[data-adventure-level="${id}"]`)
			for (const [index, medal] of [
				[1, pb],
				[2, wr],
			] as const) {
				const cell = row.getByRole('cell').nth(index)
				const image = cell.getByRole('img', { name: medal, exact: true })
				await expect(image).toBeVisible()
				const icon = await image.boundingBox()
				const time = await cell.locator('a > span:last-child').boundingBox()
				expect(icon!.x + icon!.width).toBeLessThanOrEqual(time!.x)
			}
			const height = await row.evaluate((element) => element.getBoundingClientRect().height)
			await row.locator('img').evaluateAll((images) => {
				for (const image of images) image.style.display = 'none'
			})
			expect(await row.evaluate((element) => element.getBoundingClientRect().height)).toBe(
				height,
			)
		}
		if (path === '/adventure') {
			const completed = details.locator('tr[data-adventure-level="9203"]')
			await expect(completed.getByRole('img', { name: 'Gold', exact: true })).toBeVisible()
			await expect(completed.getByRole('img', { name: 'Author', exact: true })).toBeVisible()
			const missing = details
				.locator('tr[data-adventure-level="9204"]')
				.getByRole('cell')
				.nth(1)
			await expect(missing).toHaveText('Not completed')
			await expect(missing.locator('img')).toHaveCount(0)
		}
	})
}

async function waitForHydration(page: Page) {
	await page.waitForFunction(
		() => {
			const root = document.querySelector('#__nuxt') as Element & {
				__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
			}
			return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
		},
		undefined,
		{ timeout: 60_000 },
	)
}

test('profile shows exclusive medal distribution with artwork and donut', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await page.goto('/user/76561198000000888', { waitUntil: 'domcontentloaded' })
	await waitForHydration(page)
	const distribution = page.locator('section[aria-labelledby="profile-medals"]')
	await distribution.scrollIntoViewIfNeeded()
	await expect(distribution.getByRole('heading', { name: 'Medal distribution' })).toBeVisible()
	await expect(distribution.locator('li')).toHaveCount(7)
	await expect(distribution.locator('li').filter({ hasText: 'Apex' })).toContainText('1')
	await expect(distribution.locator('li').filter({ hasText: 'Expert' })).toContainText('2')
	await expect(distribution.locator('img')).toHaveCount(6)
	await expect(distribution.locator('svg path').first()).toBeVisible()
	const medalColors = MEDALS.map(
		({ color }) =>
			`rgb(${[1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16)).join(', ')})`,
	)
	const segmentColors = await distribution
		.locator('svg path')
		.evaluateAll((paths) => paths.map((path) => getComputedStyle(path).fill))
	expect(segmentColors).toEqual(expect.arrayContaining(medalColors))
	const legendColors = await distribution
		.locator('li > span:first-child > span')
		.evaluateAll((dots) => dots.slice(0, 6).map((dot) => getComputedStyle(dot).backgroundColor))
	expect(legendColors).toEqual(medalColors)
	if (test.info().project.name === 'chromium')
		await distribution.screenshot({ path: test.info().outputPath('medal-distribution.png') })
})

test('user leaderboard displays six medal counts and supports medal sorting', async ({ page }) => {
	await page.goto('/users?q=Medal%20fixture', { waitUntil: 'domcontentloaded' })
	await waitForHydration(page)
	const row = page.getByRole('row').filter({ hasText: 'Medal fixture' })
	await expect(row).toBeVisible()
	await expect(page.getByRole('columnheader').getByRole('img')).toHaveCount(6)
	const iconSizes = await page
		.getByRole('columnheader')
		.getByRole('img')
		.evaluateAll((images) =>
			images.map((image) => ({
				height: image.getBoundingClientRect().height,
				rowHeight: image.closest('tr')?.getBoundingClientRect().height ?? 0,
			})),
		)
	expect(iconSizes.every(({ height, rowHeight }) => height === 32 && height < rowHeight)).toBe(
		true,
	)
	const header = page.getByRole('columnheader').first().locator('..')
	const headerHeight = await header.evaluate((element) => element.getBoundingClientRect().height)
	await header.locator('img').evaluateAll((images) => {
		for (const image of images) image.style.display = 'none'
	})
	expect(await header.evaluate((element) => element.getBoundingClientRect().height)).toBe(
		headerHeight,
	)
	await header.locator('img').evaluateAll((images) => {
		for (const image of images) image.style.removeProperty('display')
	})
	await expect(row.getByRole('cell')).toHaveCount(11)
	await expect(row.getByRole('cell').nth(5)).toHaveText('1')
	await page.getByRole('combobox', { name: 'Leaderboard order' }).click()
	await page.getByRole('option', { name: 'Apex', exact: true }).click()
	const query = page.waitForRequest((request) => {
		if (request.method() !== 'POST') return false
		try {
			const body = request.postDataJSON()
			return (
				body.query?.includes('ZC_Users') &&
				body.variables.orderBy?.[0] === 'MEDAL_APEX_DESC' &&
				body.variables.orderBy?.[1] === 'PRIMARY_KEY_ASC'
			)
		} catch {
			return false
		}
	})
	await page.getByRole('button', { name: 'Apply filters', exact: true }).click()
	await query
	await expect(page).toHaveURL(/sort=MEDAL_APEX_DESC/)
	if (test.info().project.name === 'chromium')
		await page
			.locator('table')
			.screenshot({ path: test.info().outputPath('medal-leaderboard.png') })
})

test('level shows calculated targets and one medal immediately before time', async ({ page }) => {
	await page.goto('/level/medal-fixture-level', { waitUntil: 'domcontentloaded' })
	await waitForHydration(page)
	await expect(page.getByText('0:38.251', { exact: true })).toBeVisible()
	await expect(page.getByText('0:36.433', { exact: true })).toBeVisible()
	await expect(
		page.locator('.level-hero').getByRole('img', { name: 'Apex', exact: true }),
	).toBeVisible()
	await page.getByRole('tab', { name: 'Records', exact: true }).click()
	await page.locator('section[aria-labelledby="personal-bests-heading"]').scrollIntoViewIfNeeded()
	const table = page.locator('table').first()
	await expect(table).toBeVisible({ timeout: 20_000 })
	const row = table.getByRole('row').filter({ hasText: 'Medal fixture' })
	await expect(row.getByRole('img', { name: 'Apex', exact: true })).toBeVisible()
	await expect(row.getByRole('img', { name: 'World Record', exact: true })).toHaveCount(0)
	const headers = await table.getByRole('columnheader').allTextContents()
	const medalIndex = headers.findIndex((header) => header.trim() === 'Medal')
	expect(medalIndex).toBeGreaterThanOrEqual(0)
	expect(headers[medalIndex + 1]?.trim()).toBe('Time')
	const medalCell = row.getByRole('cell').nth(medalIndex)
	await expect(medalCell.getByRole('img')).toHaveCount(1)
	const medalSize = await medalCell.getByRole('img').evaluate((image) => ({
		height: image.getBoundingClientRect().height,
		rowHeight: image.closest('tr')?.getBoundingClientRect().height ?? 0,
	}))
	expect(medalSize.height).toBe(32)
	expect(medalSize.height).toBeLessThan(medalSize.rowHeight)
	const rowHeight = await row.evaluate((element) => element.getBoundingClientRect().height)
	const badge = medalCell.locator('span').first()
	await badge.evaluate((element) => {
		element.style.display = 'none'
	})
	expect(await row.evaluate((element) => element.getBoundingClientRect().height)).toBe(rowHeight)
	await badge.evaluate((element) => {
		element.style.removeProperty('display')
	})
	expect(
		await medalCell.evaluate((cell) => cell.getBoundingClientRect().width),
	).toBeLessThanOrEqual(80)
	if (test.info().project.name === 'chromium')
		await table.screenshot({ path: test.info().outputPath('record-medal.png') })
})

test('level cards show each earned WR medal beside both text lines', async ({ page }) => {
	await page.goto('/levels?q=Medal%20card%20fixture', { waitUntil: 'domcontentloaded' })
	await waitForHydration(page)
	for (const name of ['Apex', 'Expert', 'Author', 'Gold', 'Silver', 'Bronze']) {
		const card = page.locator('article').filter({ hasText: `Medal card fixture ${name}` })
		await card.scrollIntoViewIfNeeded()
		const icon = card.getByRole('img', { name, exact: true })
		await expect(icon).toBeVisible()
		const iconBox = await icon.boundingBox()
		const labelBox = await card.getByText('WR', { exact: true }).boundingBox()
		const authorBox = await card
			.getByText('by Medal card holder', { exact: true })
			.boundingBox()
		expect(iconBox).not.toBeNull()
		expect(labelBox).not.toBeNull()
		expect(authorBox).not.toBeNull()
		if (!iconBox || !labelBox || !authorBox) throw new Error('Missing WR card layout')
		expect(iconBox.height).toBe(32)
		expect(iconBox.x + iconBox.width).toBeLessThanOrEqual(labelBox.x)
		expect(iconBox.y).toBeLessThanOrEqual(labelBox.y + 1)
		expect(iconBox.y + iconBox.height).toBeGreaterThanOrEqual(
			authorBox.y + authorBox.height - 1,
		)
	}
})

test('WR header shows earned tier including Expert and Apex', async ({ page }) => {
	test.setTimeout(180_000)
	for (const medal of MEDALS) {
		await page.goto(`/level/medal-fixture-level-${medal.key}`, {
			waitUntil: 'domcontentloaded',
		})
		await waitForHydration(page)
		const icon = page
			.locator('.level-hero')
			.getByRole('img', { name: new RegExp(`^${medal.key}$`, 'i') })
		await expect(icon).toBeVisible()
		await expect(icon).toHaveAttribute('src', medal.src)
	}
	await page.goto('/level/medal-fixture-level-none', { waitUntil: 'domcontentloaded' })
	await waitForHydration(page)
	await expect(page.locator('.level-hero img[src^="/assets/medals/"][width="44"]')).toHaveCount(0)
})

test('profile result tables preserve medals across valuable and latest sorts', async ({ page }) => {
	await page.goto('/user/76561198000000888', { waitUntil: 'domcontentloaded' })
	await waitForHydration(page)
	await page.getByRole('tab', { name: 'Records', exact: true }).click()
	for (const [id, medal] of [
		['profile-world-records', 'Apex'],
		['profile-personal-bests', 'Expert'],
		['profile-recent', 'Bronze'],
	]) {
		const section = page.locator(`section[aria-labelledby="${id}"]`)
		await section.scrollIntoViewIfNeeded()
		await expect(section.getByRole('img', { name: medal, exact: true })).toBeVisible()
		if (id === 'profile-recent') continue
		await section.getByRole('combobox').click()
		await page.getByRole('option', { name: 'Latest', exact: true }).click()
		await expect(section.getByRole('img', { name: medal, exact: true })).toBeVisible()
	}
})

for (const path of [
	'/totd/2026-11-11',
	'/totw/2026-w01',
	'/totm/2026-01',
	'/super-league/season-777/round-1/level-777',
]) {
	test(`${path} shows earned medals before time`, async ({ page }) => {
		await page.goto(path, { waitUntil: 'domcontentloaded' })
		await waitForHydration(page)
		const table = page.locator('table').first()
		await table.scrollIntoViewIfNeeded()
		const headers = await table.getByRole('columnheader').allTextContents()
		const medalIndex = headers.findIndex((header) => header.trim() === 'Medal')
		expect(medalIndex).toBeGreaterThanOrEqual(0)
		expect(headers[medalIndex + 1]?.trim()).toBe('Time')
		for (const [index, medal] of ['Apex', 'Expert', 'Bronze'].entries()) {
			const cell = table.locator('tbody tr').nth(index).getByRole('cell').nth(medalIndex)
			await expect(cell.getByRole('img', { name: medal, exact: true })).toBeVisible()
		}
	})
}
