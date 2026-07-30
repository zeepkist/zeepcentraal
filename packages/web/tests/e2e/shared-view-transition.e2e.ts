import { expect, type Page, test } from '@playwright/test'

const imageUrl = '/android-chrome-512x512.png'

const levelCard = {
	id: 101,
	xxHash: 'transition-level',
	adventure: false,
	dateCreated: '2026-01-01T00:00:00.000Z',
	levelItems: {
		nodes: [
			{
				name: 'Transition Preview Level',
				imageUrl,
				validationTimeAuthor: 42,
				validationTimeGold: 45,
				validationTimeSilver: 50,
				validationTimeBronze: 60,
				author: { steamId: '76561198000000001', steamName: 'Preview Player' },
			},
		],
	},
	levelPoints: { points: 1234, rating: 0.9 },
	records: { totalCount: 12 },
	personalBestGlobals: { totalCount: 8 },
	votes: { totalCount: 10 },
	worldRecordGlobal: {
		record: { time: 39.5 },
		user: { steamId: '76561198000000002', steamName: 'Fast Player' },
	},
}

const levelDetail = {
	...levelCard,
	publiclyVisible: true,
	levelItems: {
		nodes: [
			{
				...levelCard.levelItems.nodes[0],
				name: 'Canonical Transition Level',
				authorId: 4,
				workshopId: '123',
				author: {
					id: 4,
					steamId: '76561198000000001',
					steamName: 'Preview Player',
				},
			},
		],
	},
	levelPoints: {
		...levelCard.levelPoints,
		modifierCompetitiveness: 1,
	},
	votes: { totalCount: 10, groupedAggregates: [] },
	favourites: { totalCount: 2 },
	trackTournaments: { nodes: [] },
	worldRecordGlobal: {
		record: {
			id: 501,
			time: 39.5,
			dateCreated: '2026-01-02T00:00:00.000Z',
			levelId: 101,
			userId: 5,
			recordStatistic: { distance: 500 },
		},
		user: { id: 5, steamId: '76561198000000002', steamName: 'Fast Player' },
	},
}

async function mockLevelGraphql(page: Page, detailDelay = 1_200) {
	await page.route(
		(url) => url.hostname === 'graphql.zeepki.st',
		async (route) => {
			const query = String(route.request().postDataJSON()?.query ?? '')
			let data: object
			if (query.includes('query ZC_LevelDetail')) {
				await new Promise((resolve) => setTimeout(resolve, detailDelay))
				data = { levelByXxHash: levelDetail }
			} else if (query.includes('query ZC_Levels')) {
				data = {
					levels: {
						edges: [{ cursor: 'level-101', node: levelCard }],
						pageInfo: {
							startCursor: 'level-101',
							endCursor: 'level-101',
							hasNextPage: false,
							hasPreviousPage: false,
						},
						totalCount: 1,
					},
				}
			} else {
				data = {}
			}
			await route.fulfill({
				contentType: 'application/json',
				headers: {
					'access-control-allow-credentials': 'true',
					'access-control-allow-origin': 'http://127.0.0.1:4173',
				},
				body: JSON.stringify({ data }),
			})
		},
	)
}

async function openLevelsFromShell(page: Page) {
	await page.goto('/wiki')
	await page.locator('a[href="/levels"]:visible').first().click()
	await expect(page).toHaveURL('/levels')
	await expect(page.getByRole('heading', { name: 'Transition Preview Level' })).toBeVisible()
}

test('level media morphs forward, previews immediately, and returns to exact source', async ({
	page,
}) => {
	test.skip(({ browserName }) => browserName !== 'chromium', 'View Transition API needs Chromium')
	await page.addInitScript(() => {
		const original = document.startViewTransition?.bind(document)
		const state = window as typeof window & {
			__sharedTransitionSnapshots: string[][]
			__sharedTransitionTypes: string[][]
		}
		state.__sharedTransitionSnapshots = []
		state.__sharedTransitionTypes = []
		if (!original) return
		document.startViewTransition = ((...args: Parameters<typeof original>) => {
			state.__sharedTransitionSnapshots.push(
				[...document.querySelectorAll<HTMLElement>('[data-shared-transition-source]')]
					.map((element) => getComputedStyle(element).viewTransitionName)
					.filter((name) => name !== 'none'),
			)
			const transition = original(...args)
			void transition.ready.then(() => {
				state.__sharedTransitionTypes.push([...transition.types])
			})
			return transition
		}) as typeof document.startViewTransition
	})
	await mockLevelGraphql(page)
	await openLevelsFromShell(page)

	await page.getByRole('heading', { name: 'Transition Preview Level' }).click()
	await expect(page).toHaveURL('/level/transition-level')
	await expect(page.locator('[aria-busy="true"]')).toContainText('Transition Preview Level')
	await expect(page.locator('[data-shared-transition-target="media"]')).toHaveCSS(
		'view-transition-name',
		'shared-media',
	)
	await expect(page.getByRole('heading', { name: 'Canonical Transition Level' })).toBeVisible()

	await page.goBack()
	await expect(page).toHaveURL('/levels')
	await expect(page.getByRole('heading', { name: 'Transition Preview Level' })).toBeVisible()

	const state = await page.evaluate(() => {
		const value = window as typeof window & {
			__sharedTransitionSnapshots: string[][]
			__sharedTransitionTypes: string[][]
		}
		return {
			snapshots: value.__sharedTransitionSnapshots,
			types: value.__sharedTransitionTypes,
		}
	})
	expect(
		state.snapshots.some(
			(names) => names.filter((name) => name === 'shared-media').length === 1,
		),
	).toBe(true)
	expect(state.types.some((types) => types.includes('detail-forward'))).toBe(true)
	expect(state.types.some((types) => types.includes('detail-back'))).toBe(true)
})

test('reduced motion navigates without shared activation', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await mockLevelGraphql(page, 0)
	await openLevelsFromShell(page)
	await page.getByRole('heading', { name: 'Transition Preview Level' }).click()
	await expect(page).toHaveURL('/level/transition-level')
	await expect(page.getByRole('heading', { name: 'Canonical Transition Level' })).toBeVisible()
	await expect(page.locator('[data-shared-transition-target="media"]')).toHaveCSS(
		'view-transition-name',
		'none',
	)
})
