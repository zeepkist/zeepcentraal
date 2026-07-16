import { describe, expect, it } from 'vitest'
import {
	buildLevelPointsHistory,
	getLevelPointsHistoryWindow,
} from '../../app/utils/levelPointsHistory'

describe('level points history', () => {
	it('freezes a rolling 365-day window', () => {
		expect(getLevelPointsHistoryWindow(new Date('2026-07-13T12:00:00.000Z'))).toEqual({
			now: '2026-07-13T12:00:00.000Z',
			since: '2025-07-13T12:00:00.000Z',
		})
	})

	it('prepends baseline, sorts exact history, and appends current live points', () => {
		const points = buildLevelPointsHistory({
			baseline: { dateCreated: '2025-01-01T00:00:00.000Z', points: 100 },
			groups: [
				{ keys: ['2026-06-01T06:00:00.000Z'], max: { points: 140 } },
				{ keys: ['2026-01-01T06:00:00.000Z'], max: { points: 120 } },
			],
			currentPoints: 160,
			createdAt: '2024-01-01T00:00:00.000Z',
			since: '2025-07-13T12:00:00.000Z',
			now: '2026-07-13T12:00:00.000Z',
		})

		expect(points).toEqual([
			{ date: '2025-07-13T12:00:00.000Z', points: 100 },
			{ date: '2026-01-01T06:00:00.000Z', points: 120 },
			{ date: '2026-06-01T06:00:00.000Z', points: 140 },
			{ date: '2026-07-13T12:00:00.000Z', points: 160, synthetic: true },
		])
	})

	it('keeps earlier entries from today and avoids only exact timestamp/value duplicates', () => {
		const input = {
			groups: [
				{ keys: ['2026-07-13T06:00:00.000Z'], max: { points: 150 } },
				{ keys: ['2026-07-13T12:00:00.000Z'], max: { points: 160 } },
			],
			currentPoints: 160,
			createdAt: '2026-01-01T00:00:00.000Z',
			since: '2025-07-13T12:00:00.000Z',
			now: '2026-07-13T12:00:00.000Z',
		}
		expect(buildLevelPointsHistory(input)).toEqual([
			{ date: '2026-07-13T06:00:00.000Z', points: 150 },
			{ date: '2026-07-13T12:00:00.000Z', points: 160 },
		])
	})

	it('builds a flat line when no stored history exists', () => {
		expect(
			buildLevelPointsHistory({
				currentPoints: 200,
				createdAt: '2026-06-01T00:00:00.000Z',
				since: '2025-07-13T12:00:00.000Z',
				now: '2026-07-13T12:00:00.000Z',
			}),
		).toEqual([
			{ date: '2026-06-01T00:00:00.000Z', points: 200 },
			{ date: '2026-07-13T12:00:00.000Z', points: 200, synthetic: true },
		])
	})
})
