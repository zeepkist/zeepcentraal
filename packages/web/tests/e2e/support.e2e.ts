import { expect, test } from '@playwright/test'

test('support page distinguishes recipients and remains usable in both themes', async ({
	page,
}) => {
	// Check our page without relying on Ko-fi availability or submitting any payment.
	await page.route('https://ko-fi.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: '<p>Ko-fi embed placeholder</p>' }),
	)
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await page.goto('/support')
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Support')
	const akane = page.getByRole('region', { name: 'Support Akane / ZeepCentraal' })
	const yannic = page.getByRole('region', { name: 'Support Yannic / Zeepkist' })
	await expect(akane).toContainText('Keep ZeepCentraal ad-free.')
	await expect(akane).toContainText('35 days')
	await expect(akane).toContainText(
		'Does not grant a supporter role on the Official Zeepkist Discord.',
	)
	await expect(akane).toContainText('Does not support Zeepkist.')
	await expect(akane.locator('.tabler-icon-circle-check-filled.text-success')).toHaveCount(3)
	await expect(akane.locator('.tabler-icon-circle-x-filled.text-error')).toHaveCount(2)
	await expect(yannic).toContainText('Receive a supporter role on the Official Zeepkist Discord.')
	await expect(yannic).toContainText(
		'Does not grant a supporter badge on your ZeepCentraal profile.',
	)
	await expect(yannic).toContainText('Does not support ZeepCentraal.')
	await expect(yannic.locator('.tabler-icon-circle-check-filled.text-success')).toHaveCount(2)
	await expect(yannic.locator('.tabler-icon-circle-x-filled.text-error')).toHaveCount(2)
	await expect(yannic).toContainText('No money goes to ZeepCentraal')
	await expect(yannic).toContainText('do not grant a ZeepCentraal supporter badge')
	await expect(akane.getByRole('link', { name: 'Open on Ko-fi' })).toHaveAttribute(
		'href',
		'https://ko-fi.com/wopian',
	)
	await expect(yannic.getByRole('link', { name: 'Open on Ko-fi' })).toHaveAttribute(
		'href',
		'https://ko-fi.com/zeepkist',
	)
	await expect(page.locator('#kofi-zeepcentraal')).toHaveAttribute(
		'src',
		'https://ko-fi.com/wopian/?hidefeed=true&widget=true&embed=true&preview=true',
	)
	await expect(page.locator('#kofi-zeepkist')).toHaveAttribute(
		'src',
		'https://ko-fi.com/zeepkist/?hidefeed=true&widget=true&embed=true&preview=true',
	)
	await expect(page.locator('iframe')).toHaveCount(2)
	for (const panel of [akane, yannic]) {
		const button = panel.getByRole('link', { name: 'Open on Ko-fi' })
		await expect(button).toHaveClass(/bg-primary/)
		const widthGap = await button.evaluate((link) => {
			const parent = link.parentElement
			if (!parent) throw new Error('Donation panel missing')
			const style = getComputedStyle(parent)
			return (
				parent.clientWidth -
				parseFloat(style.paddingLeft) -
				parseFloat(style.paddingRight) -
				link.getBoundingClientRect().width
			)
		})
		expect(Math.abs(widthGap)).toBeLessThanOrEqual(1)
	}
	const header = page.getByTestId('app-header')
	await expect(header.locator('a[href="/support"]')).toBeVisible()
	await expect(header.locator('a[href="/support"] + button')).toHaveAttribute(
		'aria-label',
		/theme/i,
	)
	await expect(page.locator('footer a[href="/support"]')).toHaveCount(1)
	await expect(page.getByRole('link', { name: 'Link Discord to ZeepCentraal' })).toHaveAttribute(
		'href',
		'/settings/discord',
	)
	for (let index = 0; index < 2; index++) {
		await header.getByRole('button', { name: /theme/i }).click()
		await expect(akane).toBeVisible()
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
		).toBe(true)
	}
	expect(errors).toEqual([])
})

test('leaderboard shows monthly and one-off badges with accessible labels', async ({ page }) => {
	const names = ['Fake monthly supporter', 'Fake one-off supporter', 'Fake non-supporter']
	const discordIds = ['12345678901234567', '22345678901234567']
	const requests = { donations: 0, users: 0 }
	await page.route('**/*', async (route) => {
		if (
			route.request().method() !== 'POST' ||
			!route.request().headers()['content-type']?.includes('application/json')
		)
			return route.continue()
		const body = route.request().postDataJSON() as { query?: string }
		let data: object
		if (body.query?.includes('ZC_Users(')) {
			data = {
				userPoints: {
					totalCount: 3,
					pageInfo: {
						hasNextPage: false,
						hasPreviousPage: false,
						startCursor: '1',
						endCursor: '3',
					},
					edges: names.map((steamName, index) => ({
						cursor: String(index + 1),
						node: {
							points: 100,
							totalPoints: 200,
							worldRecords: 1,
							rank: index + 1,
							user: {
								id: index + 1,
								steamId: `7656119800000000${index + 1}`,
								steamName,
							},
						},
					})),
				},
			}
		} else if (body.query?.includes('ZC_SupporterBadges(')) {
			requests.donations++
			data = {
				donations: {
					nodes: [
						{
							discordUserid: discordIds[0],
							isSubscriptionPayment: true,
							tierName: 'Silver',
						},
						{
							discordUserid: discordIds[1],
							isSubscriptionPayment: false,
							tierName: null,
						},
					],
					pageInfo: { hasNextPage: false, endCursor: null },
				},
			}
		} else if (body.query?.includes('ZC_SupporterUsers(')) {
			requests.users++
			data = {
				users: {
					nodes: discordIds.map((discordId, index) => ({ id: index + 1, discordId })),
					pageInfo: { hasNextPage: false, endCursor: null },
				},
			}
		} else return route.continue()
		await route.fulfill({
			json: { data },
			headers: {
				'access-control-allow-credentials': 'true',
				'access-control-allow-origin': new URL(page.url()).origin,
			},
		})
	})
	await page.route('https://ko-fi.com/**', (route) => route.fulfill({ body: '' }))
	await page.goto('/support')
	await page.waitForFunction(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}))
	await page.locator('a[href="/users"]:visible').first().click()
	const monthly = page.getByRole('row').filter({ hasText: names[0] })
	const oneOff = page.getByRole('row').filter({ hasText: names[1] })
	const nonSupporter = page.getByRole('row').filter({ hasText: names[2] })
	await expect(monthly.getByRole('img')).toHaveAttribute(
		'aria-label',
		'Monthly ZeepCentraal supporter · Silver',
	)
	await expect(monthly.getByRole('img')).toHaveClass(/text-pink-500 dark:text-pink-400/)
	await expect(oneOff.getByRole('img')).toHaveAttribute('aria-label', 'ZeepCentraal supporter')
	await expect(oneOff.getByRole('img')).not.toHaveClass(/text-pink/)
	await expect(nonSupporter.getByRole('img')).toHaveCount(0)
	const monthlyColour = await monthly
		.getByRole('img')
		.evaluate((badge) => getComputedStyle(badge).color)
	const oneOffColour = await oneOff
		.getByRole('img')
		.evaluate((badge) => getComputedStyle(badge).color)
	expect(monthlyColour).not.toBe(oneOffColour)
	await page.getByTestId('app-header').getByRole('button', { name: /theme/i }).click()
	await expect
		.poll(() => monthly.getByRole('img').evaluate((badge) => getComputedStyle(badge).color))
		.not.toBe(monthlyColour)
	await page.getByTestId('app-header').locator('a[href="/support"]').click()
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Support')
	await page.locator('a[href="/users"]:visible').first().click()
	await expect(monthly.getByRole('img')).toHaveAttribute(
		'aria-label',
		'Monthly ZeepCentraal supporter · Silver',
	)
	expect(requests).toEqual({ donations: 1, users: 1 })
})
