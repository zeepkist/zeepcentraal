import { expect, type Page, test } from '@playwright/test'
import type { SubmissionContest } from '../../app/utils/superLeagueSubmission'

const contest: SubmissionContest = {
	roundId: 50,
	contestId: 1,
	seasonId: 8,
	round: 1,
	name: 'Fixture contest',
	rules: {},
	steamAnnouncementId: null,
	submissionStart: '2000-01-01T00:00:00Z',
	submissionEnd: '2099-10-20T17:00:00Z',
	zslVoteEnd: '2099-10-25T17:00:00Z',
	cosmeticVoteEnd: '2099-10-30T17:00:00Z',
	submissionsOpen: false,
	openTypes: [1, 2, 3],
	resultTypes: [],
}
const contests = [
	{
		...contest,
		roundId: 52,
		submissionsOpen: true,
		openTypes: [],
		submissionEnd: '2099-11-01T17:00:00Z',
	},
	{ ...contest, roundId: 51, submissionsOpen: true, openTypes: [] },
	contest,
]

async function hydrate(page: Page) {
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

test.beforeEach(async ({ request }) => {
	await request.put('http://127.0.0.1:4188/fixture', { data: { contests } })
})

for (const [activity, roundId] of [
	['vote', '50'],
	['submit-level', '51'],
]) {
	test(`SSR redirects ${activity} before rendering closed content`, async ({ request }) => {
		const response = await request.get(`/super-league/${activity}?source=news`, {
			maxRedirects: 0,
		})
		expect(response.status()).toBe(302)
		expect(response.headers().location).toBe(
			`/super-league/${activity}?source=news&roundId=${roundId}`,
		)
		expect(response.headers()['cache-control']).toBe('no-store')
		expect(await response.text()).not.toMatch(/Voting has closed|Submissions are closed|404/)
	})

	test(`client navigation redirects ${activity} without mounting closed content`, async ({
		page,
	}) => {
		await page.route('**/api/session', (route) =>
			route.fulfill({
				json: {
					user: { id: 1, steamId: '76561198000000001', steamName: 'Fixture player' },
					isAdmin: false,
					refreshAt: null,
				},
			}),
		)
		await page.goto('/super-league')
		await hydrate(page)
		const historyLength = await page.evaluate(() => window.history.length)
		await page.evaluate(() => {
			const state = { closed: false }
			Object.assign(window, { redirectObservation: state })
			const observer = new MutationObserver(() => {
				if (
					/Voting has closed|Submissions are closed/.test(document.body.textContent ?? '')
				)
					state.closed = true
			})
			observer.observe(document.body, { childList: true, subtree: true, characterData: true })
		})
		await navigate(page, `/super-league/${activity}?source=news#fixture`)
		await expect(page).toHaveURL(
			`/super-league/${activity}?source=news&roundId=${roundId}#fixture`,
		)
		await expect(
			page.getByRole('heading', {
				name: activity === 'vote' ? 'Vote for contest levels' : 'Submit your level',
				exact: true,
			}),
		).toBeVisible()
		await expect(page.getByText(/Voting has closed|Submissions are closed/)).toHaveCount(0)
		expect(
			await page.evaluate(
				() =>
					(window as typeof window & { redirectObservation: { closed: boolean } })
						.redirectObservation.closed,
			),
		).toBe(false)
		expect(await page.evaluate(() => window.history.length)).toBe(historyLength)
	})

	test(`SSR falls back to overview for ${activity} without an active round`, async ({
		request,
	}) => {
		await request.put('http://127.0.0.1:4188/fixture', { data: { contests: [] } })
		const response = await request.get(`/super-league/${activity}`, { maxRedirects: 0 })
		expect(response.status()).toBe(302)
		expect(response.headers().location).toBe('/super-league')
		expect(response.headers()['cache-control']).toBe('no-store')
	})
}

test('SSR lookup failure redirects to overview', async ({ request }) => {
	await request.put('http://127.0.0.1:4188/fixture', { data: { contests: [], fail: true } })
	const response = await request.get('/super-league/vote', { maxRedirects: 0 })
	expect(response.status()).toBe(302)
	expect(response.headers().location).toBe('/super-league')
})

test('explicit round URLs render without a redirect', async ({ request }) => {
	const response = await request.get('/super-league/submit-level?roundId=51', { maxRedirects: 0 })
	expect(response.status()).toBe(200)
	expect(response.headers().location).toBeUndefined()
})
