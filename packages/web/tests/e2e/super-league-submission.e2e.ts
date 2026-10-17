import { expect, type Page } from '@playwright/test'
import { test } from '../support/browser'

// Nuxt compiles initial routes on demand before browser assertions begin.
test.setTimeout(90_000)

const contest = {
	roundId: 50,
	contestId: 1,
	seasonId: 8,
	round: 1,
	name: 'Fixture contest',
	rules: {},
	steamAnnouncementId: '705530288588981646',
	submissionStart: '2026-10-01T17:00:00Z',
	submissionEnd: '2099-10-20T17:00:00Z',
	zslVoteEnd: null,
	cosmeticVoteEnd: null,
	submissionsOpen: true,
	openTypes: [],
	resultTypes: [],
}
const entry = {
	id: 1,
	workshopId: '9007199254740993',
	fileUid: 'fixture',
	name: 'Valid fixture',
	authors: ['76561198000000001', '76561198000000002'],
	authorNames: ['Alice', 'Bob'],
	level: {
		id: 1,
		xxHash: 'fixture',
		name: 'Valid fixture',
		authorName: 'Alice',
		points: 321,
		recordCount: 2,
		personalBestCount: 1,
		rating: 0.8,
		voteCount: 5,
		adventure: false,
		dateCreated: '2026-10-01T17:00:00Z',
		favourited: false,
	},
}
async function session(page: Page, user: boolean) {
	await page.evaluate((signedIn) => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: {
				config: {
					globalProperties: {
						$pinia: { _s: Map<string, { setUser: (user: unknown) => void }> }
					}
				}
			}
		}
		root.__vue_app__?.config.globalProperties.$pinia._s
			.get('session')
			?.setUser(signedIn ? { id: 1, steamId: '76561198000000001', steamName: 'Alice' } : null)
	}, user)
}
async function fixture(
	page: Page,
	options: {
		empty?: boolean
		closed?: boolean
		error?: boolean
		missing?: boolean
		privateError?: boolean
	} = {},
) {
	await page.route('**/api/super-league/submission-overview*', async (route) => {
		if (options.error)
			await route.fulfill({
				status: 502,
				json: { message: 'Submission overview could not be loaded' },
			})
		else
			await route.fulfill({
				json: {
					contest: options.missing
						? null
						: { ...contest, submissionsOpen: !options.closed },
					validCount: options.empty ? 0 : 1,
					totalCount: options.empty ? 0 : 3,
					submissions: options.empty ? [] : [entry],
				},
			})
	})
	await page.route('**/api/super-league/submit-level*', (route) =>
		route.fulfill(
			options.privateError
				? { status: 503, json: { message: 'Private submission unavailable' } }
				: { json: { contest, submission: null } },
		),
	)
	await page.route('**/api/session', (route) =>
		route.fulfill({ json: { user: null, refreshAt: null } }),
	)
	await page.goto('/cosmetics', { waitUntil: 'domcontentloaded' })
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
	await page.evaluate(async () => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: {
				config: {
					globalProperties: {
						$nuxt: { $router: { push: (path: string) => Promise<unknown> } }
					}
				}
			}
		}
		await root.__vue_app__?.config.globalProperties.$nuxt.$router.push(
			'/super-league/submit-level?roundId=50',
		)
	})
}

test('signed-out guidance, prominent rules, valid cards, and exact-ID download', async ({
	page,
}, testInfo) => {
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await fixture(page)
	await expect(page.getByRole('heading', { name: 'Enter your level' })).toBeVisible()
	await expect(page.getByRole('heading', { name: 'Contest rules' })).toBeVisible()
	await expect(page.getByText('Completion time', { exact: true })).toBeVisible()
	await expect(page.getByText('1 valid / 3 total submissions')).toBeVisible()
	await expect(page.getByRole('button', { name: 'Building for Super League' })).toBeVisible()
	await expect(
		page.getByPlaceholder('https://steamcommunity.com/sharedfiles/filedetails/?id=…'),
	).toHaveCount(0)
	const rules = page.getByRole('link', { name: 'View the full level submission rules on Steam' })
	await expect(rules).toHaveClass(/bg-primary/)
	await expect(rules).toHaveAttribute('target', '_blank')
	await expect(page.getByRole('heading', { name: 'Valid fixture' })).toBeVisible()
	const cards = page.locator('section[aria-labelledby="valid-submissions-title"]')
	await expect(cards.getByRole('link', { name: 'Steam Workshop', exact: true })).toHaveCount(0)
	await expect(cards.getByText('Alice, Bob', { exact: true })).toHaveCount(1)
	await expect(cards.locator('article').getByText('Alice, Bob', { exact: true })).toBeVisible()
	for (const metric of ['321', '2', '1', '80%'])
		await expect(cards.locator('article').getByText(metric, { exact: true })).toBeVisible()
	const before = await page.getByRole('link', { name: 'Back to Super League' }).boundingBox()
	const list = await page.locator('#valid-submissions-title').boundingBox()
	if (!list || !before) throw new Error('Submission layout missing')
	expect(list.y).toBeGreaterThan(before.y)
	const pending = page.waitForEvent('download')
	await page.getByRole('button', { name: 'Download .zeeplist' }).click()
	const download = await pending
	expect(download.suggestedFilename()).toBe('Fixture contest - Submissions.zeeplist')
	const stream = await download.createReadStream()
	let output = ''
	if (!stream) throw new Error('Download stream missing')
	for await (const chunk of stream) output += chunk.toString()
	expect(output).toContain('"WorkshopID":9007199254740993')
	expect(JSON.parse(output).levels[0].Author).toBe('Alice, Bob')
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
	await page.screenshot({ path: testInfo.outputPath('submission-page.png'), fullPage: true })
	expect(errors).toEqual([])
})
test('session transitions replace only submission card', async ({ page }) => {
	await fixture(page)
	await session(page, true)
	await expect(page.getByRole('textbox', { name: 'Steam Workshop item URL' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Submit level', exact: true })).toBeVisible()
	await expect(page.getByRole('heading', { name: 'Enter your level' })).toHaveCount(0)
	await session(page, false)
	await expect(page.getByRole('heading', { name: 'Enter your level' })).toBeVisible()
	await expect(page.getByRole('heading', { name: 'Contest rules' })).toBeVisible()
	await expect(page.getByRole('textbox', { name: 'Steam Workshop item URL' })).toHaveCount(0)
})
test('closed period retains guidance and disables empty download', async ({ page }) => {
	await fixture(page, { closed: true, empty: true })
	await expect(page.getByText('Submissions are closed for this round.')).toBeVisible()
	await expect(page.getByRole('heading', { name: 'Contest rules' })).toBeVisible()
	await expect(page.getByText('No valid submissions yet.')).toBeVisible()
	await expect(page.getByRole('button', { name: 'Download .zeeplist' })).toBeDisabled()
})
test('private read failure leaves public requirements and entries visible', async ({ page }) => {
	await fixture(page, { privateError: true })
	await session(page, true)
	await expect(page.getByRole('heading', { name: 'Contest rules' })).toBeVisible()
	await expect(page.getByRole('heading', { name: 'Valid fixture' })).toBeVisible()
	const cards = page.locator('section[aria-labelledby="valid-submissions-title"]')
	await expect(cards.getByRole('link', { name: 'Steam Workshop', exact: true })).toHaveCount(0)
	await expect(cards.getByText('Alice, Bob', { exact: true })).toHaveCount(1)
	await expect(cards.locator('article').getByText('Alice, Bob', { exact: true })).toBeVisible()
	for (const metric of ['321', '2', '1', '80%'])
		await expect(cards.locator('article').getByText(metric, { exact: true })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
test('missing contest has explicit empty state', async ({ page }) => {
	await fixture(page, { missing: true, empty: true })
	await expect(page.getByText('No submission contest available.')).toBeVisible()
})

test('failed public overview offers retry', async ({ page }) => {
	await fixture(page, { error: true })
	await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
	await expect(page.getByText('No submission contest available.')).toHaveCount(0)
})

test('unresolved session leaves public guidance visible', async ({ page }) => {
	await fixture(page)
	await page.evaluate(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: {
				config: {
					globalProperties: {
						$pinia: { _s: Map<string, { pending: boolean; resolved: boolean }> }
					}
				}
			}
		}
		const store = root.__vue_app__?.config.globalProperties.$pinia._s.get('session')
		if (store) {
			store.pending = true
			store.resolved = false
		}
	})
	await expect(page.getByRole('heading', { name: 'Contest rules' })).toBeVisible()
	await expect(page.getByText('1 valid / 3 total submissions')).toBeVisible()
	await expect(page.getByRole('heading', { name: 'Enter your level' })).toHaveCount(0)
	await expect(page.getByRole('textbox', { name: 'Steam Workshop item URL' })).toHaveCount(0)
})
