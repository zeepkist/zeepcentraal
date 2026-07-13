import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildLevelSplitAnalysis } from '../../app/utils/levelSplitAnalysis'

const query = readFileSync(
	new URL('../../app/graphql/queries/levelSplitAnalysis.graphql', import.meta.url),
	'utf8',
)

describe('level checkpoint analysis', () => {
	it('requests exactly five current PBs ordered fastest first', () => {
		expect(query).toContain('first: 5')
		expect(query).toContain('personalBestGlobalsExist: true')
		expect(query).toContain('splits: { isNull: false }')
		expect(query).toContain('speeds: { isNull: false }')
		expect(query).toContain('orderBy: [TIME_ASC, ID_ASC]')
	})

	it('calculates checkpoint deltas against fastest compatible player', () => {
		const result = buildLevelSplitAnalysis([
			{
				id: 1,
				time: 10,
				splits: [4, 10],
				speeds: [80, 90],
				user: { steamId: '1', steamName: 'Fast' },
			},
			{
				id: 2,
				time: 11,
				splits: [4.5, 11],
				speeds: [75, 85],
				user: { steamId: '2', steamName: 'Close' },
			},
		])
		expect(result.series[0]?.deltas).toEqual([0, 0])
		expect(result.series[1]?.deltas).toEqual([0.5, 1])
		expect(result.deltaData).toEqual([
			{ checkpoint: 1, record_1: 0, record_2: 0.5 },
			{ checkpoint: 2, record_1: 0, record_2: 1 },
		])
		expect(result.speedData[1]).toEqual({ checkpoint: 2, record_1: 90, record_2: 85 })
	})

	it('excludes malformed and checkpoint-incompatible arrays', () => {
		const result = buildLevelSplitAnalysis([
			{ id: 1, time: 10, splits: [4, 10], speeds: [80, 90] },
			{ id: 2, time: 11, splits: [4, 8, 11], speeds: [80, 85, 90] },
			{ id: 3, time: 12, splits: [5, null], speeds: [75, 80] },
			{ id: 4, time: 13, splits: [5, 13], speeds: [75] },
		])
		expect(result.series.map((series) => series.recordId)).toEqual([1])
	})
})
