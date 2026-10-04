import { expect, type Page, test } from '@playwright/test'

const roundPath = '/super-league/season-8/round-1'
const resultPath = `${roundPath}/votes`
const levels = Array.from({ length: 19 }, (_, index) => ({
	levelId: index + 1,
	xxHash: `vote-fixture-${index + 1}`,
	name:
		index === 0
			? 'A very long submitted level name that stays readable on a narrow mobile screen without hiding vote counts'
			: `Level ${index + 1}`,
	imageUrl: index === 0 ? '/android-chrome-512x512.png' : null,
	votes: 18 - index,
}))
const round = {
	id: 50,
	round: 1,
	seasonId: 8,
	name: 'Fixture round',
	eventDate: '2026-10-04T17:00:00Z',
	season: { name: 'Season 8' },
	zslLevels: { nodes: [] },
}

async function hydrate(page: Page) {
	await page.goto('/cosmetics')
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
}

async function navigate(page: Page, path: string) {
	await page.evaluate(async (target) => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: {
				config: {
					globalProperties: {
						$nuxt: { $router: { push: (path: string) => Promise<unknown> } }
					}
				}
			}
		}
		await root.__vue_app__?.config.globalProperties.$nuxt.$router.push(target)
	}, path)
}

async function setViewer(page: Page, id: number | null) {
	await page.evaluate((viewerId) => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: {
				config: {
					globalProperties: {
						$pinia: { _s: Map<string, { setUser: (value: unknown) => void }> }
					}
				}
			}
		}
		root.__vue_app__?.config.globalProperties.$pinia._s
			.get('session')
			?.setUser(
				viewerId === null
					? null
					: { id: viewerId, steamId: '76561198000000001', steamName: 'Viewer fixture' },
			)
	}, id)
}

async function fixture(
	page: Page,
	options: {
		partial?: boolean
		zero?: boolean
		unavailable?: boolean
		pendingDeadline?: string
	} = {},
) {
	const queries: string[] = []
	let viewer = 1
	await page.route(
		(url) => url.hostname === 'graphql.zeepki.st',
		async (route) => {
			const { query } = route.request().postDataJSON() as { query: string }
			queries.push(query)
			const data = query.includes('ZC_ZslRoundBySeasonAndNumber')
				? { zslRounds: { nodes: [round] } }
				: query.includes('ZC_ZslRoundResults')
					? {
							zslRoundResults: {
								edges: [],
								totalCount: 0,
								pageInfo: { hasPreviousPage: false, hasNextPage: false },
							},
							viewerStanding: { nodes: [] },
						}
					: {}
			await route.fulfill({ json: { data } })
		},
	)
	await page.route('**/api/super-league/vote-results?*', async (route) => {
		const roundId = Number(new URL(route.request().url()).searchParams.get('roundId'))
		await route.fulfill({
			json: {
				roundId,
				categories: [1, 2, 3].map((voteType) => {
					const published = !options.unavailable && (!options.partial || voteType === 1)
					return {
						voteType,
						deadline: published
							? '2026-10-03T17:00:00Z'
							: (options.pendingDeadline ?? '2099-10-04T17:00:00Z'),
						state: options.unavailable
							? 'unavailable'
							: published
								? 'published'
								: 'pending',
						totalVotes: published ? (options.zero ? 0 : 171) : null,
						levels: published
							? levels.map((level) => (options.zero ? { ...level, votes: 0 } : level))
							: [],
					}
				}),
			},
		})
	})
	await page.route('**/api/super-league/vote?*', async (route) => {
		await route.fulfill({
			json: {
				roundId: 50,
				contestId: 1,
				submissionStart: null,
				submissionEnd: null,
				zslVoteEnd: null,
				cosmeticVoteEnd: null,
				submissionsOpen: false,
				votingPending: false,
				openTypes: [],
				votes: viewer === 1 ? [[1], [2], []] : [[2], [], [1]],
				candidates: levels.map((level) => ({
					...level,
					selfAuthored: viewer === 1 ? level.levelId === 3 : level.levelId === 4,
				})),
			},
		})
	})
	await page.route(
		(url) => url.pathname === '/super-league/contests',
		async (route) => {
			await route.fulfill({
				json: [
					{
						roundId: 50,
						contestId: 1,
						seasonId: 8,
						round: 1,
						name: 'Fixture round',
						rules: {},
						steamAnnouncementId: null,
						submissionStart: null,
						submissionEnd: null,
						zslVoteEnd: null,
						cosmeticVoteEnd: null,
						submissionsOpen: false,
						openTypes: [],
						resultTypes: [1, 2, 3],
					},
				],
			})
		},
	)
	return {
		queries,
		viewer: (value: number) => {
			viewer = value
		},
	}
}

for (const theme of ['dark', 'light']) {
	test(`shows anonymous charts, all levels, and private markers in ${theme} theme`, async ({
		page,
		context,
	}, testInfo) => {
		await context.addCookies([
			{ name: 'colour_mode', value: theme, url: 'http://127.0.0.1:4173' },
		])
		const mocks = await fixture(page)
		await hydrate(page)
		await navigate(page, resultPath)
		await expect(page.getByRole('heading', { level: 1, name: 'Voting results' })).toBeVisible()
		await expect(page.locator('[data-category-total]')).toHaveCount(3)
		await expect(page.locator('[data-result-level]')).toHaveCount(57)
		await expect(page.getByRole('img', { name: /Votes per level/ })).toHaveCount(3)
		await expect(page.getByText('Your Level', { exact: true })).toHaveCount(0)
		expect(mocks.queries.some((query) => query.includes('ZC_ZslRoundResults'))).toBe(false)
		await page.emulateMedia({ reducedMotion: 'reduce' })
		await setViewer(page, 1)
		await expect(page.locator('li[data-result-level="1"]').first()).toContainText('You voted')
		await expect(page.locator('li[data-result-level="1"]').nth(1)).not.toContainText(
			'You voted',
		)
		await expect(page.getByText('Your Level', { exact: true })).toHaveCount(3)
		await expect(page.locator('li[data-result-level="3"]').first()).toContainText('Your Level')
		const votedBar = page
			.getByRole('img', { name: /Votes per level/ })
			.first()
			.locator('path[style*="--chart-3"]')
			.first()
		await expect(votedBar).toBeVisible()
		await votedBar.hover()
		console.log(await votedBar.evaluate((element) => ({ datum: (element as unknown as { __data__: unknown }).__data__, html: element.outerHTML })))
		console.log(await page.locator('[class*="tooltip"]').evaluateAll(elements => elements.map(element => ({ tag: element.tagName, class: element.getAttribute('class'), text: element.textContent, html: element.outerHTML.slice(0, 400) }))))
		await page.screenshot({ path: testInfo.outputPath(`votes-${theme}-viewport.png`) })
		await expect(
			page
				.locator('div[class*="-tooltip"]')
				.filter({ hasText: 'A very long submitted level name' }),
		).toContainText('18 Votes')
		await page.mouse.move(0, 0)
		await page.screenshot({ path: testInfo.outputPath(`votes-${theme}.png`), fullPage: true })
		await page.screenshot({ path: testInfo.outputPath(`votes-${theme}-viewport.png`) })
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth,
		)
		expect(overflow).toBe(false)
		mocks.viewer(2)
		await setViewer(page, 2)
		await expect(page.locator('li[data-result-level="2"]').first()).toContainText('You voted')
		await expect(page.locator('li[data-result-level="1"]').first()).not.toContainText(
			'You voted',
		)
		await expect(page.locator('li[data-result-level="4"]').first()).toContainText('Your Level')
		await setViewer(page, null)
		await expect(page.getByText('Your Level', { exact: true })).toHaveCount(0)
		await expect(page.locator('li').getByText('You voted', { exact: true })).toHaveCount(0)
		await page.getByRole('link', { name: 'Back to round' }).click()
		await expect(
			page.getByRole('link', { name: 'Voting results', exact: true }),
		).toHaveAttribute('href', resultPath)
		await page.getByRole('link', { name: 'Voting results', exact: true }).click()
		await expect(page).toHaveURL(resultPath)
	})
}

test('publishes ZSL without leaking pending category counts', async ({ page }) => {
	const options = { partial: true }
	await fixture(page, options)
	await hydrate(page)
	await navigate(page, resultPath)
	await expect(page.locator('[data-category-total]')).toHaveCount(1)
	await expect(page.locator('[data-result-level]')).toHaveCount(19)
	await expect(
		page.getByText('Voting results are not available yet', { exact: true }),
	).toHaveCount(2)
	options.partial = false
	await page.evaluate(() => window.dispatchEvent(new Event('focus')))
	await expect(page.locator('[data-category-total]')).toHaveCount(3)
	await expect(page.locator('[data-result-level]')).toHaveCount(57)
})

test('keeps zero-vote levels and handles rounds without stored results', async ({ page }) => {
	await fixture(page, { zero: true })
	await hydrate(page)
	await navigate(page, resultPath)
	await expect(page.locator('[data-result-level]')).toHaveCount(57)
	await expect(
		page.getByText('No votes were recorded in this category.', { exact: true }),
	).toHaveCount(3)
	await navigate(page, '/cosmetics')
	await fixture(page, { unavailable: true })
	await navigate(page, resultPath)
	await expect(page.getByText('Voting results unavailable', { exact: true })).toBeVisible()
	await expect(page.locator('[data-result-level]')).toHaveCount(0)
})

test('refreshes publication at next deadline', async ({ page }) => {
	const options = { partial: true, pendingDeadline: '' }
	await fixture(page, options)
	await hydrate(page)
	await page.clock.install()
	options.pendingDeadline = new Date(Date.now() + 10_000).toISOString()
	await navigate(page, resultPath)
	await expect(page.locator('[data-category-total]')).toHaveCount(1)
	options.partial = false
	await page.clock.fastForward(12_000)
	await expect(page.locator('[data-category-total]')).toHaveCount(3)
})
