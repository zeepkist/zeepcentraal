import { Zc_SupporterBadgesDocument, Zc_SupporterUsersDocument } from '@zeepkist/graphql/generated'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import type { SupporterMap } from '../../app/utils/supporters'

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@urql/vue', () => ({ useClientHandle: () => ({ client: { query: mocks.query } }) }))

import { useSupporterBadges } from '../../app/composables/useSupporterBadges'

const monthly = { isSubscriptionPayment: true, tierName: 'Silver' }
const oneOff = { isSubscriptionPayment: false, tierName: null }
const monthlyId = '123456789012345678'
const oneOffId = '223456789012345678'
const unlinkedId = '323456789012345678'

type CacheApp = {
	payload: { data: Record<string, SupporterMap> }
	static: { data: Record<string, SupporterMap> }
}

function setup(cached?: SupporterMap) {
	const app: CacheApp = { payload: { data: {} }, static: { data: {} } }
	if (cached) app.payload.data['supporter-badges'] = cached
	let pending = Promise.resolve()
	const asyncData = vi.fn(
		(
			key: string,
			load: () => Promise<SupporterMap>,
			options: {
				default: () => SupporterMap
				getCachedData: (key: string, app: CacheApp) => SupporterMap | undefined
			},
		) => {
			const cachedData = options.getCachedData(key, app)
			const data = shallowRef(cachedData ?? options.default())
			if (cachedData === undefined) {
				pending = load().then((snapshot) => {
					data.value = snapshot
					app.payload.data[key] = snapshot
				})
			}
			return { data }
		},
	)
	vi.stubGlobal('useAsyncData', asyncData)
	return { loaded: () => pending, asyncData }
}

function response(collection: string, nodes: object[], cursor: string | null = null) {
	return {
		toPromise: async () => ({
			data: {
				[collection]: {
					nodes,
					pageInfo: { hasNextPage: cursor !== null, endCursor: cursor },
				},
			},
		}),
	}
}

function publicDonations() {
	return response('donations', [
		{ discordUserid: monthlyId, ...monthly },
		{ discordUserid: oneOffId, ...oneOff },
		{ discordUserid: unlinkedId, ...oneOff },
	])
}

afterEach(() => {
	mocks.query.mockReset()
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

describe('static supporter snapshot', () => {
	it('matches linked users by exact Discord ID and keeps monthly and one-off status', async () => {
		mocks.query.mockReturnValueOnce(publicDonations()).mockReturnValueOnce(
			response('users', [
				{ id: 1, discordId: monthlyId },
				{ id: 2, discordId: oneOffId },
				{ id: 3, discordId: null },
				{ id: 4, discordId: '123456789012345679' },
				{ id: 5, discordId: monthlyId },
			]),
		)
		const { loaded } = setup()
		const { supporters } = useSupporterBadges()
		await loaded()
		expect(supporters.value).toEqual({ 1: monthly, 2: oneOff, 5: monthly })
		expect(mocks.query.mock.calls[1]).toEqual([
			Zc_SupporterUsersDocument,
			{ discordIds: [monthlyId, oneOffId, unlinkedId], after: undefined },
		])
	})

	it('keeps snapshot across navigation and elapsed time without refreshing', async () => {
		vi.useFakeTimers()
		mocks.query
			.mockReturnValueOnce(publicDonations())
			.mockReturnValueOnce(response('users', [{ id: 1, discordId: monthlyId }]))
		const { loaded, asyncData } = setup()
		const first = useSupporterBadges()
		await loaded()
		await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
		const nextPage = useSupporterBadges()
		await loaded()
		expect(nextPage.supporters.value).toEqual(first.supporters.value)
		expect(mocks.query).toHaveBeenCalledTimes(2)
		expect(vi.getTimerCount()).toBe(0)
		expect(asyncData.mock.calls[0]?.[2]).toMatchObject({ deep: false })
		expect(asyncData.mock.calls[0]?.[2]).not.toHaveProperty('watch')
	})

	it('uses server snapshot on hydration without a second request', async () => {
		const { loaded } = setup({ 1: monthly })
		const { supporters } = useSupporterBadges()
		await loaded()
		expect(supporters.value).toEqual({ 1: monthly })
		expect(mocks.query).not.toHaveBeenCalled()
	})

	it('paginates donations and users, with at most 1,000 Discord IDs per request', async () => {
		const ids = Array.from({ length: 1001 }, (_, index) =>
			String(123456789012345678n + BigInt(index)),
		)
		mocks.query
			.mockReturnValueOnce(
				response(
					'donations',
					ids.slice(0, 1000).map((discordUserid) => ({ discordUserid, ...oneOff })),
					'donation-cursor',
				),
			)
			.mockReturnValueOnce(response('donations', [{ discordUserid: ids[1000], ...monthly }]))
			.mockReturnValueOnce(response('users', [{ id: 1, discordId: ids[0] }], 'user-cursor'))
			.mockReturnValueOnce(response('users', [{ id: 2, discordId: ids[999] }]))
			.mockReturnValueOnce(response('users', [{ id: 3, discordId: ids[1000] }]))
		const { loaded } = setup()
		const { supporters } = useSupporterBadges()
		await loaded()
		expect(supporters.value).toEqual({ 1: oneOff, 2: oneOff, 3: monthly })
		expect(mocks.query.mock.calls[1]).toEqual([
			Zc_SupporterBadgesDocument,
			{ after: 'donation-cursor' },
		])
		expect(mocks.query.mock.calls[2]?.[1]).toEqual({
			discordIds: ids.slice(0, 1000),
			after: undefined,
		})
		expect(mocks.query.mock.calls[3]?.[1]).toEqual({
			discordIds: ids.slice(0, 1000),
			after: 'user-cursor',
		})
		expect(mocks.query.mock.calls[4]?.[1]).toEqual({
			discordIds: ids.slice(1000),
			after: undefined,
		})
	})

	it('skips user lookup when public donations are empty', async () => {
		mocks.query.mockReturnValue(response('donations', []))
		const { loaded } = setup()
		const { supporters } = useSupporterBadges()
		await loaded()
		expect(supporters.value).toEqual({})
		expect(mocks.query).toHaveBeenCalledTimes(1)
	})

	it.each(['donations', 'users'])(
		'keeps page usable when %s lookup fails',
		async (collection) => {
			if (collection === 'users') mocks.query.mockReturnValueOnce(publicDonations())
			mocks.query.mockReturnValueOnce({
				toPromise: async () => ({ error: new Error('fake failure') }),
			})
			const { loaded } = setup()
			const { supporters } = useSupporterBadges()
			await expect(loaded()).resolves.toBeUndefined()
			expect(supporters.value).toEqual({})
		},
	)

	it('handles rejected requests without automatic retries', async () => {
		mocks.query.mockReturnValueOnce({
			toPromise: async () => {
				throw new Error('fake failure')
			},
		})
		const { loaded } = setup()
		useSupporterBadges()
		await loaded()
		const nextPage = useSupporterBadges()
		await loaded()
		expect(nextPage.supporters.value).toEqual({})
		expect(mocks.query).toHaveBeenCalledTimes(1)
	})

	it('stops malformed pagination instead of repeatedly fetching the same page', async () => {
		mocks.query.mockReturnValue(
			response('donations', [{ discordUserid: monthlyId, ...monthly }], 'repeated-cursor'),
		)
		const { loaded } = setup()
		const { supporters } = useSupporterBadges()
		await loaded()
		expect(supporters.value).toEqual({})
		expect(mocks.query).toHaveBeenCalledTimes(2)
	})
})
