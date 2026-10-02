import { expect, type Page, test } from '@playwright/test'

const author = { steamId: '76561198000000001', steamName: 'Pack Author' }
const imageUrl = '/android-chrome-512x512.png'
const workshops = Array.from({ length: 27 }, (_, index) => ({
	workshopId: String(123 + index),
	name: `Workshop Pack ${index + 1}`,
	imageUrl: index === 26 ? imageUrl : '',
	authorId: author.steamId,
	author: index === 25 ? null : author,
	createdAt: new Date(Date.UTC(2026, 0, Math.min(index + 1, 26))).toISOString(),
	updatedAt: new Date(Date.UTC(2026, 1, 27 - index)).toISOString(),
	fileSize: 1536,
	// Two active files include same canonical level. One deleted file must not match.
	files: [
		{ levelId: 101, deleted: false },
		{ levelId: 101, deleted: false },
		{ levelId: 102, deleted: true },
	],
}))

function levelCard(workshopId: string, index: number) {
	return {
		id: 101 + index,
		xxHash: `workshop-level-${101 + index}`,
		adventure: false,
		dateCreated: '2026-01-01T00:00:00.000Z',
		levelItems: {
			nodes: [
				{
					name: `Pack Level ${index + 1}`,
					imageUrl,
					fileUid: `pack-file-${index}`,
					fileAuthor: 'Pack Author',
					workshopId,
					createdAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-02-01T00:00:00.000Z',
					validationTimeAuthor: 42,
					validationTimeGold: 45,
					validationTimeSilver: 50,
					validationTimeBronze: 60,
					author,
				},
			],
		},
		levelPoints: { points: 1234, rating: 0.9 },
		records: { totalCount: 12 },
		personalBestGlobals: { totalCount: 8 },
		votes: { totalCount: 10 },
		worldRecordGlobal: { record: { time: 39.5 }, user: author },
	}
}

function connection<T>(rows: T[], variables: Record<string, unknown>) {
	const size = Number(variables.first ?? variables.last ?? 24)
	let start = variables.after ? Number(variables.after) + 1 : 0
	if (variables.last)
		start = Math.max(0, (variables.before ? Number(variables.before) : rows.length) - size)
	const nodes = rows.slice(start, start + size)
	return {
		nodes,
		edges: nodes.map((node, index) => ({ node, cursor: String(start + index) })),
		totalCount: rows.length,
		pageInfo: {
			startCursor: nodes.length ? String(start) : null,
			endCursor: nodes.length ? String(start + nodes.length - 1) : null,
			hasPreviousPage: start > 0,
			hasNextPage: start + nodes.length < rows.length,
		},
	}
}

async function mockGraphql(
	page: Page,
	options: { error?: boolean; empty?: boolean; unknownDetail?: boolean } = {},
) {
	const requests: Array<{ query: string; variables: Record<string, unknown> }> = []
	await page.route(
		(url) => url.hostname === 'graphql.zeepki.st',
		async (route) => {
			const { query, variables = {} } = route.request().postDataJSON() as {
				query: string
				variables?: Record<string, unknown>
			}
			requests.push({ query, variables })
			let data: object = {}
			if (query.includes('query ZC_Workshops(')) {
				const filter = variables.filter as
					| {
							and?: Array<{
								name?: { includesInsensitive: string }
								authorId?: { equalTo: string }
								levelItems?: {
									some: {
										levelId: { equalTo: number }
										deleted: { equalTo: boolean }
									}
								}
							}>
					  }
					| undefined
				const search = filter?.and?.find((value) => value.name)?.name?.includesInsensitive
				const authorId = filter?.and?.find((value) => value.authorId)?.authorId?.equalTo
				const membership = filter?.and?.find((value) => value.levelItems)?.levelItems?.some
				let rows = options.empty
					? []
					: workshops.filter(
							(item) =>
								(!search ||
									item.name.toLowerCase().includes(search.toLowerCase())) &&
								(!authorId || item.authorId === authorId) &&
								(!membership ||
									item.files.some(
										(file) =>
											file.levelId === membership.levelId.equalTo &&
											file.deleted === membership.deleted.equalTo,
									)),
						)
				const [sort] = variables.orderBy as string[]
				rows = [...rows].sort((left, right) => {
					const primary =
						sort === 'NAME_ASC'
							? left.name.localeCompare(right.name)
							: String(
									sort === 'UPDATED_AT_DESC' ? right.updatedAt : right.createdAt,
								).localeCompare(
									String(
										sort === 'UPDATED_AT_DESC'
											? left.updatedAt
											: left.createdAt,
									),
								)
					return primary || Number(right.workshopId) - Number(left.workshopId)
				})
				data = { workshopItems: connection(rows, variables) }
			} else if (query.includes('query ZC_WorkshopDetail(')) {
				data = {
					workshopItem: options.unknownDetail
						? null
						: (workshops.find((item) => item.workshopId === variables.workshopId) ??
							null),
				}
			} else if (query.includes('query ZC_WorkshopLevels(')) {
				data = {
					levels: connection(
						Array.from({ length: 27 }, (_, index) =>
							levelCard(String(variables.workshopId), index),
						),
						variables,
					),
				}
			} else if (query.includes('query ZC_UserSuggestions(')) {
				data = { users: { nodes: [author] } }
			} else if (query.includes('query ZC_LevelDetail(')) {
				const card = levelCard('123', 0)
				data = {
					levelByXxHash: {
						...card,
						publiclyVisible: true,
						levelItems: {
							nodes: [
								{
									...card.levelItems.nodes[0],
									authorId: author.steamId,
									author: { id: 1, ...author },
								},
							],
						},
						votes: { totalCount: 10, groupedAggregates: [] },
						favourites: { totalCount: 0 },
						trackTournaments: { nodes: [] },
						worldRecordGlobal: null,
					},
				}
			} else if (query.includes('query ZC_LevelRecords(')) {
				data = { records: connection([], variables) }
			}
			await route.fulfill({
				contentType: 'application/json',
				headers: {
					'access-control-allow-credentials': 'true',
					'access-control-allow-origin': 'http://127.0.0.1:4173',
				},
				body: JSON.stringify(
					options.error && query.includes('query ZC_Workshops(')
						? { errors: [{ message: 'Workshop unavailable' }] }
						: { data },
				),
			})
		},
	)
	return requests
}

async function openExplorer(page: Page) {
	await page.goto('/cosmetics')
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
	if ((page.viewportSize()?.width ?? 1280) < 1024) {
		await page.getByRole('button', { name: 'Open menu', exact: true }).click()
	}
	await page.locator('a[href="/workshop"]:visible').first().click()
	await expect(page).toHaveURL('/workshop')
}

test('explores all workshop pages, applies filters and sorts, and restores browser history', async ({
	page,
}) => {
	const requests = await mockGraphql(page)
	await openExplorer(page)
	const cards = page.locator('article[data-workshop-id]')
	await expect(cards).toHaveCount(24)
	await expect(cards.first()).toContainText('Workshop Pack 27')
	await expect(cards.nth(1)).toContainText('Unknown author')
	await expect(cards.first()).toContainText('1.5 KiB')
	await page.getByRole('button', { name: 'Next', exact: true }).click()
	await expect(page).toHaveURL(/after=23/)
	await expect(cards).toHaveCount(3)
	await page.getByRole('textbox', { name: 'Search workshop titles' }).fill('Workshop Pack 2')
	await page.getByRole('combobox', { name: 'Author', exact: true }).fill('Pack')
	await page.getByRole('option', { name: 'Pack Author', exact: true }).click()
	await page.getByRole('button', { name: 'Apply filters' }).click()
	await expect(cards).toHaveCount(9)
	expect(new URL(page.url()).searchParams.has('after')).toBe(false)
	expect(new URL(page.url()).searchParams.get('author')).toBe(author.steamId)
	await page.getByRole('combobox', { name: 'Sort by' }).click()
	await page.getByRole('option', { name: 'Latest updated', exact: true }).click()
	await page.getByRole('button', { name: 'Apply filters' }).click()
	await expect(page).toHaveURL(/sort=UPDATED_AT_DESC/)
	await expect(
		cards.first().getByRole('heading', { name: 'Workshop Pack 2', exact: true }),
	).toBeVisible()
	expect(
		requests.findLast((request) => request.query.includes('query ZC_Workshops('))?.variables
			.orderBy,
	).toEqual(['UPDATED_AT_DESC', 'WORKSHOP_ID_DESC'])
	await page.goBack()
	await expect(page.getByRole('textbox', { name: 'Search workshop titles' })).toHaveValue(
		'Workshop Pack 2',
	)
	await expect(cards.first()).toContainText('Workshop Pack 27')
	await page.goBack()
	await expect(page.getByRole('textbox', { name: 'Search workshop titles' })).toHaveValue('')
	await expect(cards).toHaveCount(3)
})

test('shows details, all included levels, and unique level memberships below recent records', async ({
	page,
}) => {
	const requests = await mockGraphql(page)
	await openExplorer(page)
	await page.getByRole('heading', { name: 'Workshop Pack 27', exact: true }).click()
	await expect(page).toHaveURL('/workshop/149')
	await expect(page.getByRole('heading', { level: 1, name: 'Workshop Pack 27' })).toBeVisible()
	await expect(page.getByRole('link', { name: 'View on Steam' })).toHaveAttribute(
		'href',
		'https://steamcommunity.com/sharedfiles/filedetails/?id=149',
	)
	await expect(page.getByRole('link', { name: 'Pack Author', exact: true })).toHaveAttribute(
		'href',
		`/user/${author.steamId}`,
	)
	const levels = page.getByRole('region', { name: 'Included levels' })
	await expect(levels.getByRole('heading', { level: 3 })).toHaveCount(24)
	await levels.getByRole('button', { name: 'Next', exact: true }).click()
	await expect(page).toHaveURL(/levelsAfter=23/)
	await expect(levels.getByRole('heading', { level: 3 })).toHaveCount(3)
	await levels.getByRole('button', { name: 'First', exact: true }).click()
	await expect(levels.getByRole('heading', { name: 'Pack Level 1', exact: true })).toBeVisible()
	await levels.getByRole('heading', { name: 'Pack Level 1', exact: true }).click()
	await expect(page).toHaveURL('/level/workshop-level-101')
	const memberships = page.getByRole('region', { name: 'Workshop items', exact: true })
	await memberships.scrollIntoViewIfNeeded()
	await expect(memberships.locator('article')).toHaveCount(24)
	await expect(memberships.locator('article').first()).toContainText('Workshop Pack 27')
	const order = await page.evaluate(() => {
		const recent = document.getElementById('recent-records-heading')
		const workshop = document.getElementById('level-workshop-heading')
		return recent && workshop
			? Boolean(recent.compareDocumentPosition(workshop) & Node.DOCUMENT_POSITION_FOLLOWING)
			: false
	})
	expect(order).toBe(true)
	await memberships.getByRole('button', { name: 'Next', exact: true }).click()
	await expect(page).toHaveURL(/workshopAfter=23/)
	await expect(memberships.locator('article')).toHaveCount(3)
	const membershipRequest = requests.findLast(
		(request) => request.query.includes('query ZC_Workshops(') && request.variables.filter,
	)
	expect(membershipRequest?.variables.filter).toMatchObject({
		and: [{ levelItems: { some: { levelId: { equalTo: 101 }, deleted: { equalTo: false } } } }],
	})
})

test('shows empty explorer results', async ({ page }) => {
	await mockGraphql(page, { empty: true })
	await openExplorer(page)
	await expect(page.getByText('No results found', { exact: true })).toBeVisible()
})

test('shows query failures', async ({ page }) => {
	await mockGraphql(page, { error: true })
	await openExplorer(page)
	await expect(page.getByText('Workshop unavailable', { exact: false })).toBeVisible()
})

test('shows unknown and invalid workshop IDs', async ({ page }) => {
	await mockGraphql(page, { unknownDetail: true })
	await openExplorer(page)
	await page.getByRole('heading', { name: 'Workshop Pack 27', exact: true }).click()
	await expect(page.getByText('Workshop item not found', { exact: true })).toBeVisible()
	await page.goto('/workshop/invalid')
	await expect(page.getByText('Workshop item not found', { exact: true })).toBeVisible()
})
