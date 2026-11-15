import { expect, type Page } from '@playwright/test'
import { test } from '../support/browser'

const roundPath = '/super-league/season-8/round-1'
const resultPath = `${roundPath}/votes`
test.setTimeout(90_000)
const contest = {
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
}
const levels = Array.from({ length: 19 }, (_, index) => ({
	levelId: index + 1,
	xxHash: `vote-fixture-${index + 1}`,
	name:
		index === 0
			? 'A very long submitted level name that stays readable on a narrow mobile screen without hiding vote counts'
			: `Level ${index + 1}`,
	imageUrl: index === 0 ? '/android-chrome-512x512.png' : null,
	authorIds:
		index === 0
			? ['76561198000000001', '76561198000000002', '76561198000000003']
			: index === 1
				? ['76561198000000001', '76561198000000003']
				: index === 2
					? ['76561198000000001']
					: [],
	authorNames:
		index === 0
			? ['justMaki', 'Jakie', 'maou']
			: index === 1
				? ['justMaki', 'maou']
				: index === 2
					? ['justMaki']
					: [],
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
const publicSubmission = {
	id: 1,
	workshopId: '9007199254740993',
	fileUid: 'fixture-uid',
	name: 'Own level',
	authors: ['76561198000000001'],
	authorNames: ['Alice', 'Bob'],
	level: {
		id: 1,
		xxHash: 'public-ballot-level',
		fileUid: 'fixture-uid',
		name: 'Own level',
		favourited: false,
		authorName: 'Alice',
		workshopId: '9007199254740993',
		adventure: false,
		dateCreated: '2026-11-01T12:00:00Z',
		points: 321,
		recordCount: 2,
		personalBestCount: 1,
		rating: 0.8,
		voteCount: 5,
	},
}

async function hydrate(page: Page) {
	await page.goto('/cosmetics', { waitUntil: 'domcontentloaded' })
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
		multiple?: boolean
	} = {},
) {
	const queries: string[] = []
	let viewer = 1
	await page.route(
		(url) =>
			url.hostname === 'graphql.zeepki.st' ||
			(url.hostname === '127.0.0.1' && url.pathname === '/graphql'),
		async (route) => {
			const { query, variables } = route.request().postDataJSON() as {
				query: string
				variables: { seasonId?: number; round?: number }
			}
			queries.push(query)
			const requestedRound = {
				...round,
				id: variables.seasonId === 9 ? 51 : variables.round === 2 ? 52 : 50,
				seasonId: variables.seasonId ?? 8,
				round: variables.round ?? 1,
			}
			const data = query.includes('query ZC_ZslSeason(')
				? {
						zslSeason: {
							id: 8,
							name: 'Season 8',
							pointsStructure: { bestOf: 6 },
							zslRounds: { nodes: [round, { ...round, id: 52, round: 2 }] },
						},
					}
				: query.includes('ZC_ZslRoundBySeasonAndNumber')
					? { zslRounds: { nodes: [requestedRound] } }
					: query.includes('ZC_ZslRoundResults')
						? {
								zslRoundResults: {
									edges: [],
									totalCount: 0,
									pageInfo: { hasPreviousPage: false, hasNextPage: false },
								},
								viewerStanding: { nodes: [] },
							}
						: query.includes('ZC_UserProfile')
							? { users: { nodes: [] } }
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
						uniqueVoters: published ? (options.zero ? 0 : 29) : null,
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
		(url) => url.pathname === '/api/super-league/contests',
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
					...(options.multiple
						? [
								{ ...contest, roundId: 51, seasonId: 9, name: 'New season' },
								{ ...contest, roundId: 52, round: 2, name: 'Second round' },
								{ ...contest, roundId: 53, seasonId: 10, resultTypes: [] },
							]
						: []),
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
			{
				name: 'colour_mode',
				value: theme,
				url: testInfo.project.use.baseURL ?? 'http://127.0.0.1:4173',
			},
		])
		const mocks = await fixture(page)
		const pageErrors: string[] = []
		page.on('pageerror', (error) => pageErrors.push(error.message))
		await hydrate(page)
		await navigate(page, resultPath)
		await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))
		await expect(page.getByRole('heading', { level: 1, name: 'Voting results' })).toBeVisible()
		await expect(page.locator('[data-category-total]')).toHaveCount(3)
		await expect(page.locator('[data-category-total="1"]')).toHaveText(
			'171 votes by 29 players',
		)
		await expect(page.getByRole('button', { name: 'Other tournament results' })).toHaveCount(0)
		await expect(page.locator('[data-result-level]')).toHaveCount(57)
		await expect(
			page.locator('[data-result-level="1"]').first().locator('p').first(),
		).toHaveText(`${levels[0]?.name} by justMaki + Jakie + maou`)
		await expect(
			page.locator('[data-result-level="2"]').first().locator('p').first(),
		).toHaveText('Level 2 by justMaki + maou')
		await expect(
			page.locator('[data-result-level="3"]').first().locator('p').first(),
		).toHaveText('Level 3 by justMaki')
		await expect(
			page.locator('[data-result-level="4"]').first().locator('p').first(),
		).toHaveText('Level 4')
		const firstRow = page.locator('[data-result-level="1"]').first()
		for (const [name, steamId] of [
			['justMaki', '76561198000000001'],
			['Jakie', '76561198000000002'],
			['maou', '76561198000000003'],
		]) {
			await expect(firstRow.getByRole('link', { name, exact: true })).toHaveAttribute(
				'href',
				`/user/${steamId}`,
			)
		}
		await expect(firstRow.locator('a a')).toHaveCount(0)
		await expect(
			firstRow.getByRole('link', { name: levels[0]?.name, exact: true }),
		).toHaveCount(2)
		await expect(page.getByRole('img', { name: /Votes per level/ })).toHaveCount(3)
		await expect
			.poll(() =>
				page
					.getByRole('img', { name: /Votes per level/ })
					.first()
					.locator('svg text')
					.first()
					.evaluate((element) => getComputedStyle(element).fontFamily),
			)
			.toContain('DINish')
		const longLabel = page
			.getByRole('img', { name: /Votes per level/ })
			.first()
			.locator('svg text')
			.filter({ hasText: /^A/ })
		await expect
			.poll(() => longLabel.evaluate((element) => element.getBoundingClientRect().height))
			.toBeLessThan(36)
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
			.locator('path[fill="var(--chart-3)"]')
			.first()
		await expect(votedBar).toBeVisible()
		await votedBar.hover()
		await expect(page.getByRole('tooltip')).toContainText('18 Votes')
		await expect(page.getByRole('tooltip')).toContainText('A very long submitted level name')
		await expect(page.getByRole('tooltip')).toContainText('by justMaki + Jakie + maou')
		await expect(
			page
				.getByRole('img', { name: /Votes per level/ })
				.first()
				.locator('svg text')
				.filter({ hasText: /justMaki|Jakie|maou/ }),
		).toHaveCount(0)
		const regularBars = page
			.getByRole('img', { name: /Votes per level/ })
			.first()
			.locator('path[fill="var(--chart-1)"]')
		await expect(regularBars).toHaveCount(17)
		await regularBars.first().hover()
		await expect(page.getByRole('tooltip')).toContainText('Level 2')
		await expect(page.getByRole('tooltip')).toContainText('by justMaki + maou')
		await expect(page.getByRole('tooltip')).toContainText('17 Votes')
		await page.mouse.move(0, 0)
		await page.screenshot({ path: testInfo.outputPath(`votes-${theme}.png`), fullPage: true })
		await page.screenshot({ path: testInfo.outputPath(`votes-${theme}-viewport.png`) })
		await page.locator('[data-result-level]').first().scrollIntoViewIfNeeded()
		await page.screenshot({ path: testInfo.outputPath(`votes-${theme}-rows.png`) })
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
		expect(pageErrors).toEqual([])
	})
}

test('opens author Steam ID profile through keyboard navigation', async ({ page }) => {
	await fixture(page, { zero: true })
	await hydrate(page)
	await navigate(page, resultPath)
	const author = page
		.locator('[data-result-level="1"]')
		.first()
		.getByRole('link', { name: 'maou', exact: true })
	await author.focus()
	await author.press('Enter')
	await expect(page).toHaveURL('/user/76561198000000003')
})

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

test('collapses categories and opens fragment targets with keyboard focus', async ({ page }) => {
	await fixture(page, { zero: true })
	await hydrate(page)
	await navigate(page, `${resultPath}#vote-category-2`)
	const decoration = page.getByRole('button', { name: 'Decoration', exact: true })
	await expect(page.locator('#vote-category-2')).toBeFocused()
	await expect(page.locator('[data-category-total="1"]')).toHaveText('0 votes by 0 players')
	await expect(
		page.getByRole('heading', { name: 'Zeepkist Super League', exact: true }),
	).toBeVisible()
	await decoration.focus()
	await decoration.press('Enter')
	await expect(decoration).toHaveAttribute('aria-expanded', 'false')
	await expect(page.locator('#vote-category-content-2')).toBeHidden()
	await expect(page.locator('[data-category-total="2"]')).toBeVisible()
	await page
		.getByRole('navigation', { name: 'Result categories' })
		.getByRole('link', { name: 'Decoration' })
		.click()
	await expect(decoration).toHaveAttribute('aria-expanded', 'true')
	await expect(page.locator('#vote-category-2')).toBeFocused()
	await expect(page).toHaveURL(`${resultPath}#vote-category-2`)
	await decoration.click()
	await navigate(page, '/super-league/season-8/round-2/votes')
	await expect(page.getByRole('button', { name: 'Decoration', exact: true })).toHaveAttribute(
		'aria-expanded',
		'true',
	)
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('navigates across seasons and defaults landing button to latest published tournament', async ({
	page,
}) => {
	await fixture(page, { zero: true, multiple: true })
	await hydrate(page)
	await navigate(page, resultPath)
	await expect(page.locator('[data-category-total="1"]')).toHaveText('0 votes by 0 players')
	await expect(page.getByRole('link', { name: 'Voting results', exact: true })).toHaveAttribute(
		'href',
		resultPath,
	)
	const toggle = page.getByRole('button', { name: 'Other tournament results', exact: true })
	await toggle.click()
	const menu = page.getByRole('menu')
	await expect(menu.getByRole('menuitem')).toHaveCount(3)
	await expect(menu.getByRole('menuitem').first()).toContainText('Season 9 · Round 1')
	await expect(
		menu.getByRole('menuitem', { name: 'Round 1 · Fixture round', exact: true }),
	).toHaveAttribute('aria-current', 'page')
	await menu.getByRole('menuitem', { name: /Season 9 · Round 1/ }).click()
	await expect(page).toHaveURL('/super-league/season-9/round-1/votes')
	await expect(page.getByRole('link', { name: 'Voting results', exact: true })).toHaveAttribute(
		'href',
		'/super-league/season-9/round-1/votes',
	)
	await navigate(page, '/super-league')
	await expect(page.getByRole('link', { name: /^Voting results ·/ })).toHaveAttribute(
		'href',
		'/super-league/season-9/round-1/votes',
	)
	await navigate(page, '/super-league/season-8')
	await expect(page.getByRole('link', { name: /^Voting results ·/ })).toHaveAttribute(
		'href',
		'/super-league/season-8/round-2/votes',
	)
	await expect(page.getByRole('link', { name: /^Voting results ·/ })).toHaveText(
		'Voting results · Round 2 · Second round',
	)
	await toggle.click()
	await expect(menu.getByRole('menuitem')).toHaveCount(2)
	await expect(menu).not.toContainText('Season 9')
	await expect(menu).not.toContainText('Season 8')
	await page.keyboard.press('Escape')
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('hides results navigation when no tournaments have published categories', async ({ page }) => {
	await fixture(page, { zero: true })
	await page.route(
		(url) => url.pathname === '/api/super-league/contests',
		(route) => route.fulfill({ json: [{ ...contest, resultTypes: [] }] }),
	)
	await hydrate(page)
	await navigate(page, resultPath)
	await expect(page.getByRole('heading', { level: 1, name: 'Voting results' })).toBeVisible()
	await expect(page.getByRole('link', { name: /^Voting results/ })).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Other tournament results' })).toHaveCount(0)
})

test('shows vote and result buttons on first client navigation and after remounting', async ({
	page,
}) => {
	await fixture(page)
	const directBackendRequests: string[] = []
	await page.route(
		(url) => url.pathname === '/super-league/contests',
		(route) => {
			directBackendRequests.push(route.request().url())
			return route.abort('blockedbyclient')
		},
	)
	await page.route(
		(url) => url.pathname === '/api/super-league/contests',
		(route) => route.fulfill({ json: [{ ...contest, openTypes: [2, 3] }] }),
	)
	await hydrate(page)
	for (const [path, label] of [
		[roundPath, 'Voting results'],
		['/super-league/season-8', 'Voting results · Round 1 · Fixture round'],
		['/super-league', 'Voting results · Season 8 · Round 1 · Fixture round'],
		[roundPath, 'Voting results'],
	]) {
		if (!path || !label) throw new Error('Missing navigation fixture')
		await navigate(page, path)
		await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute(
			'href',
			resultPath,
		)
		await expect(
			page.getByRole('link', { name: 'Vote for levels', exact: true }),
		).toHaveAttribute('href', '/super-league/vote?roundId=50')
	}
	expect(directBackendRequests).toEqual([])
})

test('downloads all ballot submissions for guests and rejects another round overview', async ({
	page,
}) => {
	await fixture(page)
	const submission = publicSubmission
	await page.route('**/api/super-league/submission-overview?*', (route) =>
		route.fulfill({
			json: {
				contest,
				validCount: 2,
				totalCount: 2,
				submissions: [
					submission,
					{ ...submission, id: 2, fileUid: 'other-uid', name: 'Other level' },
				],
			},
		}),
	)
	await hydrate(page)
	await setViewer(page, null)
	await navigate(page, '/super-league/vote?roundId=50')
	const button = page.getByRole('button', {
		name: 'Download submissions playlist (.zeeplist)',
		exact: true,
	})
	await expect(button).toBeVisible()
	const downloading = page.waitForEvent('download')
	await button.click()
	const download = await downloading
	expect(download.suggestedFilename()).toBe('Fixture round - Submissions.zeeplist')
	const stream = await download.createReadStream()
	if (!stream) throw new Error('Download stream missing')
	let output = ''
	for await (const chunk of stream) output += chunk.toString()
	expect(output).toContain('"WorkshopID":9007199254740993')
	expect(JSON.parse(output)).toMatchObject({
		amountOfLevels: 2,
		UID: ['fixture-uid', 'other-uid'],
		levels: [{ Name: 'Own level', Author: 'Alice, Bob' }, { Name: 'Other level' }],
	})
	await navigate(page, '/super-league/vote?roundId=51')
	await expect(button).toHaveCount(0)
	await expect(page.getByRole('heading', { name: 'Own level', exact: true })).toHaveCount(0)
})

async function publicBallot(page: Page, options: { error?: boolean; empty?: boolean } = {}) {
	await fixture(page)
	await page.route('**/api/super-league/submission-overview?*', (route) =>
		route.fulfill(
			options.error
				? { status: 502, json: { message: 'Submission overview could not be loaded' } }
				: {
						json: {
							contest: { ...contest, roundId: 51, round: 2, openTypes: [1] },
							validCount: options.empty ? 0 : 1,
							totalCount: options.empty ? 0 : 1,
							submissions: options.empty ? [] : [publicSubmission],
						},
					},
		),
	)
	await hydrate(page)
	await setViewer(page, null)
	await navigate(page, '/super-league/vote?roundId=51')
}

test('shows submitted levels below guest sign-in prompt without reading private ballots', async ({
	page,
}, testInfo) => {
	const privateReads: string[] = []
	page.on('request', (request) => {
		if (new URL(request.url()).pathname === '/api/super-league/vote')
			privateReads.push(request.url())
	})
	await publicBallot(page)
	const signIn = page.getByRole('heading', { name: 'Sign in to vote', exact: true })
	await expect(signIn).toBeVisible()
	const levels = page.getByRole('region', { name: 'Valid submissions (1)' })
	await expect(levels.getByRole('heading', { name: 'Own level', exact: true })).toBeVisible()
	await expect(levels).toContainText('Alice, Bob')
	await expect(levels).toContainText('321')
	await expect(levels.getByRole('link', { name: /Own level/ }).first()).toHaveAttribute(
		'href',
		'/level/public-ballot-level',
	)
	const signInBounds = await signIn.boundingBox()
	const levelBounds = await levels.boundingBox()
	expect(levelBounds && signInBounds && levelBounds.y > signInBounds.y).toBe(true)
	await expect(page.getByRole('button', { name: 'Vote for level', exact: true })).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Submit vote', exact: true })).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Download .zeeplist', exact: true })).toHaveCount(
		0,
	)
	expect(privateReads).toEqual([])
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
	await page.screenshot({ path: testInfo.outputPath('guest-ballot.png'), fullPage: true })
})

test('gates vote selection and submission while retaining public levels after logout', async ({
	page,
}) => {
	await publicBallot(page)
	await page.route('**/api/super-league/vote?*', (route) =>
		route.fulfill({
			json: {
				roundId: 51,
				contestId: 1,
				submissionStart: null,
				submissionEnd: null,
				zslVoteEnd: '2099-11-30T12:00:00Z',
				cosmeticVoteEnd: null,
				submissionsOpen: false,
				votingPending: false,
				openTypes: [1],
				votes: [[], [], []],
				candidates: [
					{ ...publicSubmission.level, levelId: 1, workshopId: 1, selfAuthored: false },
				],
			},
		}),
	)
	await setViewer(page, 1)
	const vote = page.getByRole('button', { name: 'Vote for level', exact: true })
	await expect(vote).toBeVisible()
	await vote.click()
	await expect(page.getByText('1 of 14 levels selected', { exact: true })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Submit vote', exact: true })).toBeVisible()
	await expect(page.getByRole('heading', { name: 'Sign in to vote', exact: true })).toHaveCount(0)
	await setViewer(page, null)
	await expect(page.getByRole('heading', { name: 'Sign in to vote', exact: true })).toBeVisible()
	await expect(page.getByRole('heading', { name: 'Own level', exact: true })).toBeVisible()
	await expect(vote).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Submit vote', exact: true })).toHaveCount(0)
})

test('retries public submission failures without requiring sign-in', async ({ page }) => {
	const options = { error: true }
	await publicBallot(page, options)
	await expect(page.getByRole('heading', { name: 'Sign in to vote', exact: true })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
	options.error = false
	await page.getByRole('button', { name: 'Try again', exact: true }).click()
	await expect(page.getByRole('heading', { name: 'Own level', exact: true })).toBeVisible()
})

test('shows empty public submissions below sign-in prompt', async ({ page }) => {
	await publicBallot(page, { empty: true })
	await expect(page.getByRole('heading', { name: 'Sign in to vote', exact: true })).toBeVisible()
	await expect(page.getByText('No valid submissions yet.', { exact: true })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Submit vote', exact: true })).toHaveCount(0)
})
