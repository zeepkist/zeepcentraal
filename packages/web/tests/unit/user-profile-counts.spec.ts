import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useUserProfileSummary } from '../../app/composables/useUserProfileSummary'

const query = vi.hoisted(() => ({ result: {} as { data: unknown } }))
vi.mock('@urql/vue', () => ({ useQuery: () => query.result }))

describe('user profile available-level counts', () => {
	beforeEach(() => vi.stubGlobal('computed', computed))
	afterEach(() => vi.unstubAllGlobals())

	it('uses cached totals, reacts to workshop refresh, and handles missing cache rows', () => {
		const account = {
			id: 1,
			steamId: '43',
			steamName: 'Player',
			dateCreated: '2026-01-01',
			userPoints: { points: 0, rank: -1, totalPoints: 0, personalBests: 2, worldRecords: 1 },
			records: { totalCount: 99 },
			// Historical rows remain present but never drive summary counters.
			personalBestGlobals: { totalCount: 50 },
			worldRecordGlobals: { totalCount: 25 },
			levelItems: { totalCount: 0 },
			votes: { totalCount: 0, groupedAggregates: [] },
		}
		const data = ref({ users: { nodes: [account] } })
		query.result = { data }
		const profile = useUserProfileSummary(ref('43'))
		expect(profile.summary.value).toMatchObject({
			personalBests: 2,
			worldRecords: 1,
			records: 99,
		})
		const current = data.value.users.nodes[0]
		if (!current) throw new Error('Profile fixture missing')
		current.userPoints.personalBests = 1
		current.userPoints.worldRecords = 0
		expect(profile.summary.value).toMatchObject({ personalBests: 1, worldRecords: 0 })
		data.value = {
			users: { nodes: [{ ...account, userPoints: null } as unknown as typeof account] },
		}
		expect(profile.summary.value).toMatchObject({ personalBests: 0, worldRecords: 0 })
	})
})
