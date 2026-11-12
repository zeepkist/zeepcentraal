import type {
	Zc_AdventurePlayerLevelFragment,
	Zc_AdventureStandingFragment,
} from '@zeepkist/graphql/generated'
import { describe, expect, it } from 'vitest'
import {
	adventureRecordMilliseconds,
	formatAdventureDelta,
	pinAdventureViewer,
} from '../../app/utils/adventureLeaderboard'
import {
	adventurePlaylistPath,
	groupAdventurePlayerLevels,
	mapAdventurePlayerLevels,
} from '../../app/utils/adventurePlayerLevels'
import { parseSafeWorkshopId } from '../../app/utils/playlist'
import {
	collectAdventurePlaylist,
	parseAdventurePlaylistQuery,
} from '../../server/utils/adventurePlaylist'

function membership(
	series: string,
	id: number,
	name: string,
	pb: number | null = null,
	wr: number | null = null,
): Zc_AdventurePlayerLevelFragment & {
	levelItem: NonNullable<Zc_AdventurePlayerLevelFragment['levelItem']>
} {
	return {
		series,
		levelId: id,
		levelItem: { id, name, fileUid: `file-${id}`, workshopId: '0', fileAuthor: 'Author' },
		level: {
			id,
			xxHash: String(id).padStart(32, '0'),
			personalBestGlobals: { nodes: pb === null ? [] : [{ record: { id, time: pb } }] },
			worldRecordGlobal: wr === null ? null : { record: { id: id + 100, time: wr } },
		},
	}
}

describe('Adventure player rows and level comparisons', () => {
	it('preserves independent PB and WR medals, including Bronze zero', () => {
		const entry = membership('a', 1, 'A-01', 12, 10)
		const pb = entry.level?.personalBestGlobals?.nodes[0]?.record
		const wr = entry.level?.worldRecordGlobal?.record
		if (!pb || !wr) throw new Error('Missing record fixture')
		pb.medal = 0
		wr.medal = 5
		const [level] = mapAdventurePlayerLevels([entry])
		expect(level?.pb?.medal).toBe(0)
		expect(level?.worldRecord?.medal).toBe(5)
		expect(level?.delta).toBe(2000)
	})
	it('pins viewer once and preserves ranks and input rows', () => {
		const row = (userId: number): Zc_AdventureStandingFragment => ({
			userId,
			rank: userId,
			completedLevels: 1,
			totalLevels: 2,
			remainingLevels: 1,
			totalTimeMs: 1000,
			isComplete: false,
			user: { id: userId, steamId: String(userId), steamName: 'Player' },
		})
		const entries = [row(1), row(2)]
		expect(pinAdventureViewer(entries, row(2))).toBe(entries)
		expect(pinAdventureViewer(entries, row(65))).toEqual([
			...entries,
			{ ...row(65), pinned: true },
		])
		expect(entries).toHaveLength(2)
		expect(pinAdventureViewer([], null)).toEqual([])
	})
	it('matches real-precision PB rounding and signed WR deltas', () => {
		expect(adventureRecordMilliseconds(60.0005)).toBe(60000)
		expect(adventureRecordMilliseconds(60.0006)).toBe(60001)
		expect(formatAdventureDelta(4)).toBe('+00:00.004')
		expect(formatAdventureDelta(-4)).toBe('−00:00.004')
		expect(formatAdventureDelta(0)).toBe('00:00.000')
	})
	it('deduplicates shared levels into first matching series and sorts naturally', () => {
		const levels = mapAdventurePlayerLevels([
			membership('b', 2, 'B-01'),
			membership('a', 10, 'A-10', 12, 10),
			membership('a', 2, 'A-02', 10, 9),
			membership('xg', 3, 'XG-01'),
		])
		const groups = groupAdventurePlayerLevels(levels, 'level')
		expect(groups.map((group) => group.series.key)).toEqual(['A', 'XG'])
		expect(groups[0]?.levels.map((level) => level.name)).toEqual(['A-02', 'A-10'])
		expect(groups[0]?.levels[0]?.delta).toBe(1000)
		expect(groups[1]?.levels[0]?.delta).toBeNull()
	})
	it('places missing PBs first, largest WR gaps next, and unknown WRs last', () => {
		const levels = mapAdventurePlayerLevels([
			membership('a', 1, 'A-01', 11, 10),
			membership('a', 2, 'A-02', null, 10),
			membership('a', 3, 'A-03', 15, 10),
			membership('a', 4, 'A-04', 12),
		])
		expect(
			groupAdventurePlayerLevels(levels, 'gap')[0]?.levels.map((level) => level.id),
		).toEqual([2, 3, 1, 4])
	})
})

describe('Adventure playlist exports', () => {
	it('exports official UIDs with zero Workshop ID without weakening shared validation', async () => {
		const official = membership('a', 1, 'A-01')
		official.levelItem = { ...official.levelItem, fileUid: 'ea1' }
		const workshop = membership('a', 2, 'A-02')
		workshop.levelItem = { ...workshop.levelItem, workshopId: '123' }
		const exported = await collectAdventurePlaylist(async () => ({
			nodes: [workshop, official],
			pageInfo: { hasNextPage: false },
		}))
		expect(JSON.parse(exported.body.replace(/^\uFEFF/, '')).levels).toMatchObject([
			{ UID: 'ea1', WorkshopID: 0, Name: 'A-01' },
			{ UID: 'file-2', WorkshopID: 123, Name: 'A-02' },
		])
		expect(parseSafeWorkshopId('-1')).toBeNull()
	})
	it.each([
		{ workshopId: '-1', fileUid: 'ea1' },
		{ workshopId: '-2', fileUid: 'ea1' },
		{ workshopId: 'invalid', fileUid: 'ea1' },
		{ workshopId: '0', fileUid: '' },
	])('rejects unavailable file mapping %j', async (mapping) => {
		const level = membership('a', 1, 'A-01')
		level.levelItem = { ...level.levelItem, ...mapping }
		await expect(
			collectAdventurePlaylist(async () => ({
				nodes: [level],
				pageInfo: { hasNextPage: false },
			})),
		).rejects.toMatchObject({ status: 422 })
	})
	it('validates multi-character scopes and rejects malformed input', () => {
		expect(parseAdventurePlaylistQuery({ series: 'xg', missing: 'true' })).toEqual({
			series: 'xg',
			missing: true,
		})
		for (const query of [{ series: ['a'] }, { series: 'unknown' }, { missing: 'yes' }])
			expect(() => parseAdventurePlaylistQuery(query)).toThrow()
		expect(adventurePlaylistPath('cl', true)).toBe(
			'/api/adventure/playlist?series=cl&missing=true',
		)
	})
	it('collects cursor pages, deduplicates canonical levels, and exports complete ordered files', async () => {
		const exported = await collectAdventurePlaylist(async (after) =>
			after
				? {
						nodes: [membership('b', 2, 'B-01'), membership('a', 2, 'A-02')],
						pageInfo: { hasNextPage: false },
					}
				: {
						nodes: [membership('a', 10, 'A-10')],
						pageInfo: { hasNextPage: true, endCursor: 'next' },
					},
		)
		const playlist = JSON.parse(exported.body.replace(/^\uFEFF/, ''))
		expect(playlist.levels.map((level: { Name: string }) => level.Name)).toEqual([
			'A-02',
			'A-10',
		])
		expect(playlist).toMatchObject({
			amountOfLevels: 2,
			roundLength: 480,
			shufflePlaylist: false,
		})
		expect(exported.filename).toBe('zeepcentraal-adventure-all.zeeplist')
	})
	it('exports only missing PBs and fails explicitly for unavailable mappings', async () => {
		const page = (nodes: Zc_AdventurePlayerLevelFragment[]) => async () => ({
			nodes,
			pageInfo: { hasNextPage: false },
		})
		const exported = await collectAdventurePlaylist(
			page([membership('a', 1, 'A-01', 10), membership('a', 2, 'A-02')]),
			'a',
			true,
		)
		expect(
			JSON.parse(exported.body.replace(/^\uFEFF/, '')).levels.map(
				(level: { UID: string }) => level.UID,
			),
		).toEqual(['file-2'])
		expect(JSON.parse(exported.body.replace(/^\uFEFF/, '')).levels[0].WorkshopID).toBe(0)
		await expect(collectAdventurePlaylist(page([]))).rejects.toMatchObject({ status: 404 })
		await expect(
			collectAdventurePlaylist(page([{ ...membership('a', 1, 'A-01'), levelItem: null }])),
		).rejects.toMatchObject({ status: 422 })
	})
})
